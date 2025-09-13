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
  preallocation_publish_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional()
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
  } catch {
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

  return res.status(201).json({ success: true, id: availabilityId, ...d, preallocation });
  } catch (e: any) {
    return res.status(500).json({ message: 'Server error' });
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

export default router;

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

    const [holidays] = await pool.query(query, params);

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
