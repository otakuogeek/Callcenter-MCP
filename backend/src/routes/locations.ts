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
  status: z.enum(['Activa','En Mantenimiento','Inactiva']).default('Activa'),
  capacity: z.number().int().min(0).default(0),
  current_patients: z.number().int().min(0).default(0),
  hours: z.string().optional().nullable(),
  emergency_hours: z.string().optional().nullable(),
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM locations ORDER BY name ASC');
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
       WHERE ls.location_id = ?
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

export default router;
