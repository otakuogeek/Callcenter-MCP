import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  location_id: z.number().int(),
  specialty_id: z.number().int(),
  doctor_id: z.number().int(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  capacity: z.number().int().min(1).default(1),
  status: z.enum(['Activa','Cancelada','Completa']).default('Activa'),
  notes: z.string().optional().nullable(),
  auto_preallocate: z.boolean().optional(),
  preallocation_publish_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  // Nuevos campos para distribución automática
  auto_distribute: z.boolean().optional(),
  distribution_start_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  distribution_end_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  exclude_weekends: z.boolean().optional().default(true)
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const date = String(req.query.date || '');
  try {
    if (date) {
      const [rows] = await pool.query(
        `SELECT a.*, 
                d.name AS doctor_name, 
                s.name AS specialty_name, 
                l.name AS location_name,
                (SELECT COUNT(*) FROM appointments ap WHERE ap.availability_id = a.id AND ap.status != 'Cancelada') AS booked_slots
         FROM availabilities a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN specialties s ON s.id = a.specialty_id  
         JOIN locations l ON l.id = a.location_id
         WHERE a.date = ? 
         ORDER BY a.start_time ASC`, 
        [date]
      );
      return res.json(rows);
    }
    const [rows] = await pool.query(
      `SELECT a.*, 
              d.name AS doctor_name, 
              s.name AS specialty_name, 
              l.name AS location_name,
              (SELECT COUNT(*) FROM appointments ap WHERE ap.availability_id = a.id AND ap.status != 'Cancelada') AS booked_slots
       FROM availabilities a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id  
       JOIN locations l ON l.id = a.location_id
       ORDER BY a.date DESC, a.start_time ASC 
       LIMIT 200`
    );
    return res.json(rows);
  } catch (e: any) {
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) {
      return res.json([]);
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data as any;
  try {
    const [result] = await pool.query(
      `INSERT INTO availabilities (location_id, specialty_id, doctor_id, date, start_time, end_time, capacity, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.location_id, d.specialty_id, d.doctor_id, d.date, d.start_time, d.end_time, d.capacity, d.status, d.notes ?? null]
    );
    // @ts-ignore
    const availabilityId = result.insertId as number;

    let preallocation: any = null;
    if (d.auto_preallocate) {
      try {
        const { generateRandomPreallocation } = await import('../utils/randomPreallocation');
        preallocation = await generateRandomPreallocation({
          target_date: d.date,
          total_slots: d.capacity,
          publish_date: d.preallocation_publish_date,
          doctor_id: d.doctor_id,
          location_id: d.location_id,
          specialty_id: d.specialty_id,
          availability_id: availabilityId,
          apply: true
        });
      } catch (e) {
        console.warn('Fallo preallocation automática:', e);
      }
    }

    // Nueva funcionalidad: Distribución automática de cupos
    let distribution: any = null;
    if (d.auto_distribute && d.distribution_start_date && d.distribution_end_date) {
      try {
        const { generateAvailabilityDistribution } = await import('../utils/availabilityDistribution');
        distribution = await generateAvailabilityDistribution({
          availability_id: availabilityId,
          start_date: d.distribution_start_date,
          end_date: d.distribution_end_date,
          total_quota: d.capacity,
          exclude_weekends: d.exclude_weekends ?? true
        });
      } catch (e) {
        console.warn('Fallo distribución automática:', e);
        return res.status(400).json({ 
          message: 'Error en distribución automática', 
          error: e instanceof Error ? e.message : 'Error desconocido' 
        });
      }
    }

  return res.status(201).json({ 
    success: true, 
    id: availabilityId, 
    ...d, 
    preallocation,
    distribution 
  });
  } catch (e: any) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint para actualizar cupos asignados de una distribución específica
router.put('/distributions/:id/assigned', requireAuth, async (req: Request, res: Response) => {
  const distributionId = Number(req.params.id);
  const { assigned } = req.body;
  
  if (Number.isNaN(distributionId)) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de distribución inválido' 
    });
  }
  
  if (typeof assigned !== 'number' || assigned < 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'El número de asignados debe ser un número mayor o igual a 0' 
    });
  }
  
  try {
    // Verificar que la distribución existe
    const [existing] = await pool.query(
      'SELECT * FROM availability_distribution WHERE id = ?',
      [distributionId]
    );
    
    if (!Array.isArray(existing) || existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Distribución no encontrada' 
      });
    }
    
    const distribution = existing[0] as any;
    
    // Verificar que no se exceda la cuota
    if (assigned > distribution.quota) {
      return res.status(400).json({ 
        success: false, 
        message: `No se pueden asignar ${assigned} cupos. La cuota máxima es ${distribution.quota}` 
      });
    }
    
    // Actualizar la distribución
    await pool.query(
      'UPDATE availability_distribution SET assigned = ? WHERE id = ?',
      [assigned, distributionId]
    );
    
    // Obtener la distribución actualizada con información completa
    const [updated] = await pool.query(`
      SELECT 
        ad.id,
        ad.availability_id,
        ad.day_date,
        ad.quota,
        ad.assigned,
        ad.created_at,
        a.doctor_id,
        a.specialty_id,
        a.location_id,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        a.date AS availability_date,
        a.start_time,
        a.end_time,
        a.capacity AS total_capacity,
        (ad.quota - ad.assigned) AS remaining
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE ad.id = ?
    `, [distributionId]);
    
    return res.json({
      success: true,
      message: 'Cupos asignados actualizados correctamente',
      data: (updated as any[])[0]
    });
  } catch (error: any) {
    console.error('Error updating assigned slots:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al actualizar cupos asignados', 
      error: error.message 
    });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const fields: string[] = []; const values: any[] = [];
    for (const k of Object.keys(d) as (keyof typeof d)[]) { fields.push(`${k} = ?`); // @ts-ignore
      values.push(d[k] ?? null); }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE availabilities SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM availabilities WHERE id = ?', [id]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// New schemas for batch creation and holidays
const batchSchema = z.object({
  doctor_id: z.number().int(),
  location_id: z.number().int(),
  specialty_id: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  capacity: z.number().int().min(1).default(1),
  slot_duration_minutes: z.number().int().min(15).max(120).default(30),
  exclude_weekends: z.boolean().default(true),
  exclude_holidays: z.boolean().default(true),
  batch_id: z.string().optional(),
});

const holidaySchema = z.object({
  date: z.string(),
  name: z.string().min(1),
  type: z.enum(['national','regional','local','personal']).default('national'),
  location_id: z.number().int().optional(),
  is_recurring: z.boolean().default(false),
  description: z.string().optional(),
});

// Create availabilities for date range
router.post('/batch', requireAuth, async (req: Request, res: Response) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const d = parsed.data;
  const batchId = d.batch_id || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Call stored procedure to create batch availabilities
    const [result] = await pool.query(
      `CALL create_batch_availabilities(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.doctor_id,
        d.location_id,
        d.specialty_id,
        d.start_date,
        d.end_date,
        d.start_time,
        d.end_time,
        d.capacity,
        d.slot_duration_minutes,
        batchId,
        d.exclude_weekends,
        d.exclude_holidays
      ]
    );

    // Get created availabilities count
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as count FROM availabilities WHERE batch_id = ?',
      [batchId]
    );

    const count = Array.isArray(countResult) && countResult[0] ? (countResult[0] as any).count : 0;

    return res.status(201).json({
      batch_id: batchId,
      created_count: count,
      message: 'Batch availabilities created successfully'
    });
  } catch (error: any) {
    console.error('Batch creation error:', error);
    return res.status(500).json({ message: 'Failed to create batch availabilities', error: error.message });
  }
});

// Get availabilities by batch
router.get('/batch/:batchId', requireAuth, async (req: Request, res: Response) => {
  const { batchId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT a.*,
              d.name AS doctor_name,
              s.name AS specialty_name,
              l.name AS location_name,
              (SELECT COUNT(*) FROM appointments ap WHERE ap.availability_id = a.id AND ap.status != 'Cancelada') AS booked_slots
       FROM availabilities a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       WHERE a.batch_id = ?
       ORDER BY a.date ASC, a.start_time ASC`,
      [batchId]
    );
    return res.json(rows);
  } catch (error: any) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.json([]);
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete availabilities by batch
router.delete('/batch/:batchId', requireAuth, async (req: Request, res: Response) => {
  const { batchId } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM availabilities WHERE batch_id = ?',
      [batchId]
    );
    // @ts-ignore
    return res.json({ deleted_count: result.affectedRows, message: 'Batch deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get non-working days (holidays + weekends)
router.get('/non-working-days', requireAuth, async (req: Request, res: Response) => {
  const { start_date, end_date, location_id } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ message: 'start_date and end_date are required' });
  }

  try {
    let query = `
      SELECT date, name, type, location_id, is_recurring, description
      FROM holidays
      WHERE date BETWEEN ? AND ?
    `;
    const params = [start_date, end_date];

    if (location_id) {
      query += ' AND (location_id IS NULL OR location_id = ?)';
      params.push(location_id);
    }

    let holidays: any = [];
    try {
      const [rows] = await pool.query(query, params);
      holidays = rows;
    } catch (e: any) {
      if (!(e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146))) throw e;
      holidays = [];
    }

    // Generate weekends in the date range
    const weekends: any[] = [];
    const start = new Date(start_date as string);
    const end = new Date(end_date as string);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekends.push({
          date: date.toISOString().split('T')[0],
          name: dayOfWeek === 0 ? 'Domingo' : 'Sábado',
          type: 'weekend',
          is_recurring: true,
          description: 'Fin de semana'
        });
      }
    }

    return res.json({
      holidays: Array.isArray(holidays) ? holidays : [],
      weekends,
      non_working_days: [...(Array.isArray(holidays) ? holidays : []), ...weekends]
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Holiday management endpoints
router.get('/holidays', requireAuth, async (req: Request, res: Response) => {
  const { year, type, location_id } = req.query;
  try {
    let query = 'SELECT * FROM holidays WHERE 1=1';
    const params: any[] = [];

    if (year) {
      query += ' AND YEAR(date) = ?';
      params.push(year);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (location_id) {
      query += ' AND (location_id IS NULL OR location_id = ?)';
      params.push(location_id);
    }

    query += ' ORDER BY date ASC';

    const [rows] = await pool.query(query, params);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/holidays', requireAuth, async (req: Request, res: Response) => {
  const parsed = holidaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const d = parsed.data;
  try {
    const [result] = await pool.query(
      `INSERT INTO holidays (date, name, type, location_id, is_recurring, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.date, d.name, d.type, d.location_id || null, d.is_recurring, d.description || null]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Holiday already exists for this date and location' });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/holidays/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const parsed = holidaySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const d = parsed.data;
  try {
    const fields: string[] = [];
    const values: any[] = [];

    for (const k of Object.keys(d) as (keyof typeof d)[]) {
      fields.push(`${k} = ?`);
      // @ts-ignore
      values.push(d[k] ?? null);
    }

    if (!fields.length) return res.status(400).json({ message: 'No changes' });

    values.push(id);
    await pool.query(`UPDATE holidays SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/holidays/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    await pool.query('DELETE FROM holidays WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Distribute appointments randomly across batch availabilities
router.post('/distribute-appointments', requireAuth, async (req: Request, res: Response) => {
  const { batch_id, total_appointments } = req.body;

  if (!batch_id || !total_appointments) {
    return res.status(400).json({ message: 'batch_id and total_appointments are required' });
  }

  try {
    // Get available dates for this batch
    const [availabilities] = await pool.query(
      'SELECT id, date, capacity FROM availabilities WHERE batch_id = ? AND status = "Activa" ORDER BY date ASC',
      [batch_id]
    );

    const availabilitiesArray = Array.isArray(availabilities) ? availabilities : [];

    if (availabilitiesArray.length === 0) {
      return res.status(404).json({ message: 'No availabilities found for this batch' });
    }

    // Calculate distribution
    const appointmentsPerDate = Math.floor(total_appointments / availabilitiesArray.length);
    const remainingAppointments = total_appointments % availabilitiesArray.length;

    const distribution = availabilitiesArray.map((avail: any, index: number) => ({
      availability_id: avail.id,
      date: avail.date,
      appointments: appointmentsPerDate + (index < remainingAppointments ? 1 : 0)
    }));

    return res.json({
      batch_id,
      total_appointments,
      distribution,
      summary: {
        dates_count: availabilitiesArray.length,
        appointments_per_date: appointmentsPerDate,
        remaining_appointments: remainingAppointments
      }
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Endpoint para obtener la distribución de un availability
router.get('/:id/distribution', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid availability id' });

  try {
    const { getAvailabilityDistribution } = await import('../utils/availabilityDistribution');
    const distribution = await getAvailabilityDistribution(id);
    return res.json({
      success: true,
      availability_id: id,
      distribution
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Endpoint para regenerar la distribución de un availability
router.post('/:id/regenerate-distribution', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid availability id' });

  const distributionSchema = z.object({
    start_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    end_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    total_quota: z.number().int().min(1),
    exclude_weekends: z.boolean().optional().default(true)
  });

  const parsed = distributionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  try {
    const { generateAvailabilityDistribution } = await import('../utils/availabilityDistribution');
    const distribution = await generateAvailabilityDistribution({
      availability_id: id,
      ...parsed.data
    });
    
    return res.json({
      success: true,
      message: 'Distribución regenerada exitosamente',
      distribution
    });
  } catch (error: any) {
    return res.status(400).json({ 
      message: 'Error al regenerar distribución', 
      error: error.message 
    });
  }
});

// Endpoint para obtener todas las distribuciones existentes
router.get('/distributions', requireAuth, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ad.id,
        ad.availability_id,
        ad.day_date,
        ad.quota,
        ad.assigned,
        ad.created_at,
        a.doctor_id,
        a.specialty_id,
        a.location_id,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        a.date AS availability_date,
        a.start_time,
        a.end_time,
        a.capacity AS total_capacity
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE a.status = 'Activa'
      ORDER BY ad.day_date ASC, a.start_time ASC
    `);
    
    return res.json({
      success: true,
      data: rows
    });
  } catch (error: any) {
    console.error('Error fetching all distributions:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener las distribuciones', 
      error: error.message 
    });
  }
});

// Endpoint para obtener distribuciones por rango de fechas
router.get('/distributions/range', requireAuth, async (req: Request, res: Response) => {
  const { start_date, end_date, doctor_id, specialty_id, location_id } = req.query;
  
  try {
    let whereConditions = ['a.status = ?'];
    let params: any[] = ['Activa'];
    
    if (start_date) {
      whereConditions.push('ad.day_date >= ?');
      params.push(start_date);
    }
    
    if (end_date) {
      whereConditions.push('ad.day_date <= ?');
      params.push(end_date);
    }
    
    if (doctor_id) {
      whereConditions.push('a.doctor_id = ?');
      params.push(Number(doctor_id));
    }
    
    if (specialty_id) {
      whereConditions.push('a.specialty_id = ?');
      params.push(Number(specialty_id));
    }
    
    if (location_id) {
      whereConditions.push('a.location_id = ?');
      params.push(Number(location_id));
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const [rows] = await pool.query(`
      SELECT 
        ad.id,
        ad.availability_id,
        ad.day_date,
        ad.quota,
        ad.assigned,
        ad.created_at,
        a.doctor_id,
        a.specialty_id,
        a.location_id,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        a.date AS availability_date,
        a.start_time,
        a.end_time,
        a.capacity AS total_capacity,
        (ad.quota - ad.assigned) AS remaining
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE ${whereClause}
      ORDER BY ad.day_date ASC, a.start_time ASC
    `, params);
    
    return res.json({
      success: true,
      data: rows,
      filters: {
        start_date,
        end_date,
        doctor_id,
        specialty_id,
        location_id
      }
    });
  } catch (error: any) {
    console.error('Error fetching distributions by range:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener las distribuciones por rango', 
      error: error.message 
    });
  }
});

// Endpoint para obtener estadísticas de distribución
router.get('/distributions/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const [totalStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_days,
        SUM(ad.quota) as total_quota,
        SUM(ad.assigned) as total_assigned,
        SUM(ad.quota - ad.assigned) as total_remaining,
        ROUND(AVG(ad.quota), 2) as avg_quota_per_day,
        ROUND((SUM(ad.assigned) / SUM(ad.quota)) * 100, 2) as utilization_percentage
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      WHERE a.status = 'Activa'
    `);
    
    const [byDoctor] = await pool.query(`
      SELECT 
        d.name as doctor_name,
        COUNT(DISTINCT ad.day_date) as days_with_distribution,
        SUM(ad.quota) as total_quota,
        SUM(ad.assigned) as total_assigned,
        SUM(ad.quota - ad.assigned) as total_remaining,
        ROUND((SUM(ad.assigned) / SUM(ad.quota)) * 100, 2) as utilization_percentage
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.status = 'Activa'
      GROUP BY a.doctor_id, d.name
      ORDER BY total_quota DESC
    `);
    
    const [bySpecialty] = await pool.query(`
      SELECT 
        s.name as specialty_name,
        COUNT(DISTINCT ad.day_date) as days_with_distribution,
        SUM(ad.quota) as total_quota,
        SUM(ad.assigned) as total_assigned,
        SUM(ad.quota - ad.assigned) as total_remaining,
        ROUND((SUM(ad.assigned) / SUM(ad.quota)) * 100, 2) as utilization_percentage
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN specialties s ON s.id = a.specialty_id
      WHERE a.status = 'Activa'
      GROUP BY a.specialty_id, s.name
      ORDER BY total_quota DESC
    `);
    
    const [recentActivity] = await pool.query(`
      SELECT 
        ad.day_date,
        COUNT(*) as availabilities_count,
        SUM(ad.quota) as day_total_quota,
        SUM(ad.assigned) as day_total_assigned,
        SUM(ad.quota - ad.assigned) as day_total_remaining
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      WHERE a.status = 'Activa'
        AND ad.day_date >= CURDATE()
      GROUP BY ad.day_date
      ORDER BY ad.day_date ASC
      LIMIT 30
    `);
    
    return res.json({
      success: true,
      data: {
        overview: (totalStats as any[])[0],
        by_doctor: byDoctor,
        by_specialty: bySpecialty,
        upcoming_days: recentActivity
      }
    });
  } catch (error: any) {
    console.error('Error fetching distribution stats:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener estadísticas de distribución', 
      error: error.message 
    });
  }
});

// Endpoint para obtener availabilities activas (para el dropdown de selección)
router.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.status,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        (SELECT COUNT(*) FROM availability_distribution ad WHERE ad.availability_id = a.id) as has_distribution
      FROM availabilities a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE a.status = 'Activa'
        AND a.date >= CURDATE()
      ORDER BY a.date ASC, a.start_time ASC
    `);
    
    return res.json({
      success: true,
      data: rows
    });
  } catch (error: any) {
    console.error('Error fetching active availabilities:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener disponibilidades activas', 
      error: error.message 
    });
  }
});

// Obtener listas para filtros (doctores, especialidades, ubicaciones)
router.get('/filters/options', requireAuth, async (req, res) => {
  try {
    // Obtener doctores únicos
    const [doctorsRows] = await pool.execute(`
      SELECT DISTINCT d.id, d.name 
      FROM doctors d
      INNER JOIN availabilities a ON d.id = a.doctor_id
      WHERE a.is_active = 1
      ORDER BY d.name
    `);

    // Obtener especialidades únicas
    const [specialtiesRows] = await pool.execute(`
      SELECT DISTINCT s.id, s.name 
      FROM specialties s
      INNER JOIN availabilities a ON s.id = a.specialty_id
      WHERE a.is_active = 1
      ORDER BY s.name
    `);

    // Obtener ubicaciones únicas
    const [locationsRows] = await pool.execute(`
      SELECT DISTINCT l.id, l.name 
      FROM locations l
      INNER JOIN availabilities a ON l.id = a.location_id
      WHERE a.is_active = 1
      ORDER BY l.name
    `);

    res.json({
      success: true,
      data: {
        doctors: doctorsRows,
        specialties: specialtiesRows,
        locations: locationsRows
      }
    });
  } catch (error) {
    console.error('Error getting filter options:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// GET /api/availabilities/:id/distribution - Obtener distribución de cupos para una agenda específica
router.get('/:id/distribution', requireAuth, async (req: Request, res: Response) => {
  const availabilityId = Number(req.params.id);
  
  if (Number.isNaN(availabilityId)) {
    return res.status(400).json({
      success: false,
      message: 'ID de agenda inválido'
    });
  }

  try {
    // Obtener información de la agenda
    const [availabilityRows] = await pool.query(
      `SELECT a.*, d.name as doctor_name, s.name as specialty_name, l.name as location_name
       FROM availabilities a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       WHERE a.id = ?`,
      [availabilityId]
    );

    if (!Array.isArray(availabilityRows) || availabilityRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agenda no encontrada'
      });
    }

    // Obtener distribución
    const [distributionRows] = await pool.query(
      `SELECT * FROM availability_distribution 
       WHERE availability_id = ? 
       ORDER BY day_date ASC`,
      [availabilityId]
    );

    const availability = availabilityRows[0];
    const distribution = Array.isArray(distributionRows) ? distributionRows : [];

    // Calcular estadísticas
    const totalQuota = distribution.reduce((sum: number, d: any) => sum + (d.quota || 0), 0);
    const totalAssigned = distribution.reduce((sum: number, d: any) => sum + (d.assigned || 0), 0);
    const remaining = totalQuota - totalAssigned;

    return res.json({
      success: true,
      data: {
        availability: availability,
        distribution: distribution,
        stats: {
          total_quota: totalQuota,
          total_assigned: totalAssigned,
          remaining: remaining,
          distribution_days: distribution.length,
          average_per_day: distribution.length > 0 ? Number((totalQuota / distribution.length).toFixed(2)) : 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting availability distribution:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;
