import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { publish, subscribe } from '../events/sse';

const router = Router();

// SSE stream for transfers updates
router.get('/stream', requireAuth as any, async (req: Request, res: Response) => {
  subscribe('transfers', req, res);
});

// POST /api/transfers/public -> endpoint para que la IA cree una transferencia (x-api-key)
const publicTransferSchema = z.object({
  patient_id: z.number().int().optional(),
  patient_name: z.string().min(1).optional(),
  patient_identifier: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  specialty_id: z.number().int().optional(),
  preferred_location_id: z.number().int().optional(),
  priority: z.enum(['Alta','Media','Baja']).default('Media').optional(),
  transfer_reason: z.string().max(255).optional(),
  ai_observation: z.string().optional(),
});

router.post('/public', async (req: Request, res: Response) => {
  const apiKey = req.header('x-api-key');
  const expected = process.env.AI_API_KEY;
  if (!expected) return res.status(503).json({ message: 'AI transfers disabled (no API key configured)' });
  if (!apiKey || apiKey !== expected) return res.status(401).json({ message: 'Unauthorized' });
  const parsed = publicTransferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
  const [result] = await pool.query(
      `INSERT INTO ai_transfers (status, patient_id, patient_name, patient_identifier, phone, specialty_id, preferred_location_id, priority, transfer_reason, ai_observation)
       VALUES ('pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [d.patient_id ?? null, d.patient_name ?? null, d.patient_identifier ?? null, d.phone ?? null, d.specialty_id ?? null, d.preferred_location_id ?? null, d.priority ?? 'Media', d.transfer_reason ?? null, d.ai_observation ?? null]
    );
    // @ts-ignore
  const id = (result as any).insertId as number;
  publish('transfers', 'created', { id, ...d, status: 'pending' });
  return res.status(201).json({ id, status: 'pending' });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/transfers?status=pending|accepted|rejected|completed (default pending)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const status = (String(req.query.status || 'pending').toLowerCase());
  const allowed = new Set(['pending','accepted','rejected','completed']);
  const st = allowed.has(status) ? status : 'pending';
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT t.*, 
              s.name AS specialty_name, 
              l.name AS preferred_location_name,
              TIMESTAMPDIFF(MINUTE, t.created_at, NOW()) AS wait_minutes
       FROM ai_transfers t
       LEFT JOIN specialties s ON s.id = t.specialty_id
       LEFT JOIN locations l ON l.id = t.preferred_location_id
       WHERE t.status = ?
       ORDER BY t.created_at ASC
       LIMIT 200`,
      [st]
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/transfers/:id/accept
router.post('/:id/accept', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const userId = (req as any).user?.id ?? null;
  try {
    const [r]: any = await pool.query(
      `UPDATE ai_transfers SET status='accepted', assigned_user_id = ?, accepted_at = NOW() WHERE id = ? AND status = 'pending'`,
      [userId, id]
    );
  if (r.affectedRows === 0) return res.status(409).json({ message: 'Transfer already processed' });
  publish('transfers', 'accepted', { id, assigned_user_id: userId });
  return res.json({ id, status: 'accepted', assigned_user_id: userId });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/transfers/:id/reject
const rejectSchema = z.object({ reason: z.string().max(255).optional() });
router.post('/:id/reject', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { reason } = parsed.data;
  try {
    const [r]: any = await pool.query(
      `UPDATE ai_transfers SET status='rejected', rejected_reason = ? WHERE id = ? AND status IN ('pending','accepted')`,
      [reason ?? null, id]
    );
  if (r.affectedRows === 0) return res.status(409).json({ message: 'Transfer already processed' });
  publish('transfers', 'rejected', { id, reason });
  return res.json({ id, status: 'rejected' });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/transfers/:id/complete
router.post('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [r]: any = await pool.query(
      `UPDATE ai_transfers SET status='completed' WHERE id = ? AND status IN ('accepted','pending')`,
      [id]
    );
  if (r.affectedRows === 0) return res.status(409).json({ message: 'Transfer already processed' });
  publish('transfers', 'completed', { id });
  return res.json({ id, status: 'completed' });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
