import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  municipality_id: z.number().int().optional().nullable(),
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  // Validaremos este campo contra location_types en runtime para permitir tipos dinámicos
  type: z.string().min(1).default('Sucursal'),
  status: z.enum(['active','maintenance','inactive']).default('active'),
  capacity: z.number().int().min(0).default(0),
  current_patients: z.number().int().min(0).default(0),
  hours: z.string().optional().nullable(),
  emergency_hours: z.string().optional().nullable(),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { eps_id, specialty_id } = req.query;
    let query = `
      SELECT l.*, z.name as zone_name
      FROM locations l
      LEFT JOIN zones z ON l.zone_id = z.id
    `;
    const params: any[] = [];

    // Filtrar por autorizaciones de EPS si se especifica
    if (eps_id) {
      query += `
        WHERE l.id IN (
          SELECT DISTINCT location_id 
          FROM eps_specialty_location_authorizations 
          WHERE eps_id = ? AND authorized = 1
          ${specialty_id ? 'AND specialty_id = ?' : ''}
        )
      `;
      params.push(eps_id);
      if (specialty_id) {
        params.push(specialty_id);
      }
    }

    query += ' ORDER BY l.name ASC';
    
    const [rows] = await pool.query(query, params);
    return res.json(rows);
  } catch (e: any) {
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) {
      return res.json([]);
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

// Métricas por sede basadas en citas y disponibilidades
router.get('/:id/metrics', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const month = Number(req.query.month) || (new Date().getMonth() + 1); // 1-12
  const year = Number(req.query.year) || (new Date().getFullYear());
  try {
  // Obtener capacidad configurada de la sede
  const [locRows] = await pool.query<any[]>('SELECT capacity FROM locations WHERE id = ?', [id]);
  if (!Array.isArray(locRows) || locRows.length === 0) return res.status(404).json({ message: 'Location not found' });
  const locationCapacity = Number((locRows as any)[0].capacity) || 0;

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0)); // exclusive
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const weeksInMonth = Math.ceil(daysInMonth / 7);

    // Appointments grouped by week-of-month
    const [apptRows] = await pool.query<any[]>(
      `SELECT FLOOR((DAY(scheduled_at) - 1) / 7) + 1 AS wom, COUNT(*) AS cnt
       FROM appointments
       WHERE location_id = ? AND scheduled_at >= ? AND scheduled_at < ?
       GROUP BY wom`,
      [id, start, end]
    );

  const apptMap = new Map<number, number>();
  for (const r of apptRows) apptMap.set(Number(r.wom), Number(r.cnt));

    const weeks: { wom: number; citas: number; capacidad: number }[] = [];
    for (let w = 1; w <= weeksInMonth; w++) {
      weeks.push({ wom: w, citas: apptMap.get(w) || 0, capacidad: locationCapacity });
    }

    const totalAppointments = weeks.reduce((s, x) => s + x.citas, 0);
    const totalCapacity = locationCapacity * weeksInMonth;
    const busiestWeekCitas = weeks.reduce((m, x) => Math.max(m, x.citas), 0);
    const avgOccupancyPct = weeksInMonth > 0 && totalCapacity > 0
      ? Math.round((totalAppointments / totalCapacity) * 100)
      : 0;

    return res.json({
      month,
      year,
      weeks,
      totals: {
        totalAppointments,
        totalCapacity,
        busiestWeekCitas,
        avgOccupancyPct,
        locationCapacity,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Obtener especialidades disponibles para una sede específica
router.get('/:id/specialties', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.name, s.active
       FROM location_specialties ls
       JOIN specialties s ON s.id = ls.specialty_id
       WHERE ls.location_id = ? AND s.active = 1
       ORDER BY s.name ASC`,
      [id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Reemplazar el set de especialidades de una sede
router.put('/:id/specialties', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const body = req.body as { specialty_ids?: number[] };
  const ids = Array.isArray(body?.specialty_ids) ? body.specialty_ids.map(Number).filter(n => Number.isInteger(n)) : [];
  try {
    // Validar que las especialidades existan (si se envían)
    if (ids.length) {
      const [rows] = await pool.query('SELECT id FROM specialties WHERE id IN (?)', [ids]);
      // @ts-ignore
      const found = new Set(rows.map((r: any) => r.id));
      const allExist = ids.every(id2 => found.has(id2));
      if (!allExist) return res.status(400).json({ message: 'Algunas especialidades no existen' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM location_specialties WHERE location_id = ?', [id]);
      if (ids.length) {
        const values = ids.map(sid => [id, sid]);
        await conn.query('INSERT INTO location_specialties (location_id, specialty_id) VALUES ?' as any, [values]);
      }
      await conn.commit();
    } catch (e) {
      await (async () => { try { await conn.rollback(); } catch { /* ignore */ } })();
      throw e;
    } finally {
      conn.release();
    }
    return res.json({ location_id: id, specialty_ids: ids });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    // Validar que el tipo exista y esté activo en location_types
    if (d.type) {
      const [typeRows] = await pool.query('SELECT id FROM location_types WHERE name = ? AND status = "active"', [d.type]);
      // @ts-ignore
      if (!Array.isArray(typeRows) || typeRows.length === 0) {
        return res.status(400).json({ message: 'Tipo de sede inválido o inactivo' });
      }
    }
    const [result] = await pool.query(
  `INSERT INTO locations (municipality_id, name, address, phone, type, status, capacity, current_patients, hours, emergency_hours)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [d.municipality_id ?? null, d.name, d.address ?? null, d.phone ?? null, d.type, d.status, d.capacity, d.current_patients, d.hours ?? null, d.emergency_hours ?? null]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    // Si se cambia el tipo, validar contra location_types activos
    if (d.type) {
      const [typeRows] = await pool.query('SELECT id FROM location_types WHERE name = ? AND status = "active"', [d.type]);
      // @ts-ignore
      if (!Array.isArray(typeRows) || typeRows.length === 0) {
        return res.status(400).json({ message: 'Tipo de sede inválido o inactivo' });
      }
    }
    const fields: string[] = []; const values: any[] = [];
    for (const k of Object.keys(d) as (keyof typeof d)[]) { fields.push(`${k} = ?`); // @ts-ignore
      values.push(d[k] ?? null); }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE locations SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM locations WHERE id = ?', [id]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Estadísticas de capacidad diaria por sede
router.get('/:id/daily-capacity', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  
  try {
    // Obtener información de la sede
    const [locRows] = await pool.query<any[]>('SELECT name, capacity FROM locations WHERE id = ?', [id]);
    if (!Array.isArray(locRows) || locRows.length === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }
    const location = locRows[0];
    
    // Obtener citas confirmadas por día (últimos 30 días y próximos 30 días)
    const [appointmentsData] = await pool.query<any[]>(`
      SELECT 
        DATE(a.scheduled_at) as date,
        COUNT(a.id) as total_appointments,
        SUM(CASE WHEN a.status = 'Confirmada' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN a.status = 'Completada' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN a.status = 'Cancelada' THEN 1 ELSE 0 END) as cancelled
      FROM appointments a
      INNER JOIN availabilities av ON a.availability_id = av.id
      WHERE av.location_id = ?
        AND a.scheduled_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND a.scheduled_at <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(a.scheduled_at)
      ORDER BY date ASC
    `, [id]);
    
    // Obtener disponibilidad total por día (slots disponibles)
    const [availabilityData] = await pool.query<any[]>(`
      SELECT 
        av.date,
        SUM(av.capacity) as total_slots,
        SUM(GREATEST(0, CAST(av.capacity AS SIGNED) - CAST(av.booked_slots AS SIGNED))) as available_slots,
        SUM(av.booked_slots) as booked_slots
      FROM availabilities av
      WHERE av.location_id = ?
        AND av.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND av.date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      GROUP BY av.date
      ORDER BY av.date ASC
    `, [id]);
    
    return res.json({
      location: {
        id,
        name: location.name,
        capacity: location.capacity
      },
      appointments: appointmentsData,
      availability: availabilityData
    });
  } catch (error) {
    console.error('Error getting daily capacity:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint para debugging: mostrar resumen de autorizaciones por zona
router.get('/zones/authorizations', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        z.name as zone_name,
        e.name as eps_name,
        l.name as location_name,
        COUNT(DISTINCT auth.specialty_id) as specialty_count,
        COUNT(auth.id) as total_authorizations
      FROM zones z
      LEFT JOIN locations l ON z.id = l.zone_id
      LEFT JOIN eps_specialty_location_authorizations auth ON l.id = auth.location_id AND auth.authorized = 1
      LEFT JOIN eps e ON auth.eps_id = e.id
      GROUP BY z.id, e.id, l.id
      HAVING total_authorizations > 0
      ORDER BY z.name, e.name, l.name
    `);
    
    return res.json(rows);
  } catch (e: any) {
    console.error('Error fetching zone authorizations:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint público para obtener ubicaciones autorizadas para un EPS (sin autenticación)
router.get('/public/eps/:eps_id', async (req: Request, res: Response) => {
  const epsId = Number(req.params.eps_id);
  if (Number.isNaN(epsId)) return res.status(400).json({ message: 'Invalid EPS ID' });

  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT l.*, z.name as zone_name, e.name as eps_name
      FROM locations l
      LEFT JOIN zones z ON l.zone_id = z.id
      JOIN eps_specialty_location_authorizations auth ON l.id = auth.location_id
      JOIN eps e ON auth.eps_id = e.id
      WHERE auth.eps_id = ? AND auth.authorized = 1
      ORDER BY l.name ASC
    `, [epsId]);
    
    return res.json(rows);
  } catch (e: any) {
    console.error('Error fetching locations for EPS (public):', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint específico para obtener ubicaciones autorizadas para un EPS (requiere auth)
router.get('/eps/:eps_id', requireAuth, async (req: Request, res: Response) => {
  const epsId = Number(req.params.eps_id);
  if (Number.isNaN(epsId)) return res.status(400).json({ message: 'Invalid EPS ID' });

  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT l.*, z.name as zone_name, e.name as eps_name
      FROM locations l
      LEFT JOIN zones z ON l.zone_id = z.id
      JOIN eps_specialty_location_authorizations auth ON l.id = auth.location_id
      JOIN eps e ON auth.eps_id = e.id
      WHERE auth.eps_id = ? AND auth.authorized = 1
      ORDER BY l.name ASC
    `, [epsId]);
    
    return res.json(rows);
  } catch (e: any) {
    console.error('Error fetching locations for EPS:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
