import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const baseSchema = z.object({
  patient_id: z.number().int().optional().nullable(),
  specialty_id: z.number().int().optional().nullable(),
  queue_id: z.number().int().optional().nullable(),
  user_id: z.number().int().optional().nullable(),
  channel: z.enum(['AI','Manual']).optional(),
  outcome: z.enum(['Cita agendada','No contestó','Rechazó','Número inválido','Otro']).optional(),
  notes: z.string().max(255).optional().nullable(),
  status_id: z.number().int().optional().nullable(),
});

const createSchema = baseSchema.extend({
  channel: z.enum(['AI','Manual']).default('AI'),
  outcome: z.enum(['Cita agendada','No contestó','Rechazó','Número inválido','Otro']),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  // Filters: date (YYYY-MM-DD), status_id, channel, q (patient name or notes)
  const date = String(req.query.date || '');
  const statusId = req.query.status_id ? Number(req.query.status_id) : undefined;
  const channel = String(req.query.channel || '');
  const q = String(req.query.q || '');
  const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
  const filters: string[] = []; const values: any[] = [];
  if (date) { filters.push('DATE(cl.created_at) = ?'); values.push(date); }
  if (typeof statusId === 'number' && !Number.isNaN(statusId)) { filters.push('cl.status_id = ?'); values.push(statusId); }
  if (channel) { filters.push('cl.channel = ?'); values.push(channel); }
  if (q) { filters.push('(p.name LIKE ? OR cl.notes LIKE ?)'); values.push(`%${q}%`, `%${q}%`); }
  if (typeof patientId === 'number' && !Number.isNaN(patientId)) { filters.push('cl.patient_id = ?'); values.push(patientId); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(
      `SELECT cl.*, 
              p.name AS patient_name, p.phone AS patient_phone,
              s.name AS specialty_name,
              u.name AS user_name,
              cs.name AS status_name, cs.color AS status_color
       FROM call_logs cl
       LEFT JOIN patients p ON p.id = cl.patient_id
       LEFT JOIN specialties s ON s.id = cl.specialty_id
       LEFT JOIN users u ON u.id = cl.user_id
       LEFT JOIN call_statuses cs ON cs.id = cl.status_id
       ${where}
       ORDER BY cl.created_at DESC
       LIMIT 300`,
      values
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const userId = (req as any).user?.id ?? d.user_id ?? null;
    const [result] = await pool.query(
      `INSERT INTO call_logs (patient_id, specialty_id, queue_id, user_id, channel, outcome, notes, status_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.patient_id ?? null, d.specialty_id ?? null, d.queue_id ?? null, userId, d.channel ?? 'AI', d.outcome, d.notes ?? null, d.status_id ?? null]
    );
    // @ts-ignore
    const id = result.insertId as number;
    return res.status(201).json({ id, ...d, user_id: userId });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const fields: string[] = []; const values: any[] = [];
    for (const k of Object.keys(d) as (keyof typeof d)[]) {
      fields.push(`${k} = ?`);
      // @ts-ignore
      values.push(d[k] ?? null);
    }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE call_logs SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
