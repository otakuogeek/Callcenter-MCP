import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { publish, subscribe } from '../events/sse';

const router = Router();

// SSE stream for queue updates
router.get('/stream', requireAuth as any, async (req: Request, res: Response) => {
  subscribe('queue', req, res);
});

// GET /api/queue/overview -> tarjetas: en espera, promedio, mayor espera, agentes disponibles
router.get('/overview', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [cntRows] = await pool.query<any[]>(
      `SELECT 
         SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
         TIMESTAMPDIFF(SECOND, MIN(CASE WHEN status='waiting' THEN created_at ELSE NULL END), NOW()) AS max_wait_seconds,
         AVG(CASE WHEN status='waiting' THEN TIMESTAMPDIFF(SECOND, created_at, NOW()) END) AS avg_wait_seconds
       FROM queue_entries`
    );
    const cnt = Array.isArray(cntRows) && cntRows.length ? (cntRows as any)[0] : {};

    // Agentes disponibles: conteo básico por usuarios activos (ajustable si existe presencia/estado en otra tabla)
    let agentsAvailable = 0;
    try {
      const [aRows] = await pool.query<any[]>("SELECT COUNT(*) AS c FROM users WHERE role IN ('agent','reception') AND status='Activo'");
      agentsAvailable = Number((aRows as any)[0]?.c || 0);
    } catch (error) { 
      console.error('Error counting available agents:', error);
      agentsAvailable = 0; 
    }

    const waiting = Number(cnt.waiting || 0);
    const avg_wait_seconds = cnt.avg_wait_seconds != null ? Math.round(Number(cnt.avg_wait_seconds)) : 0;
    const max_wait_seconds = cnt.max_wait_seconds != null ? Number(cnt.max_wait_seconds) : 0;
    const fmt = (s: number) => {
      const m = Math.floor(s / 60), ss = s % 60; return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    };
    return res.json({
      waiting,
      avg_wait_seconds,
      avg_wait_hm: fmt(avg_wait_seconds),
      max_wait_seconds,
      max_wait_hm: fmt(max_wait_seconds),
      agents_available: agentsAvailable,
    });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/queue -> lista plana de entradas en espera
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT q.*, 
              s.name AS specialty_name,
              p.name AS patient_name, p.phone AS patient_phone
       FROM queue_entries q
       JOIN specialties s ON s.id = q.specialty_id
       JOIN patients p ON p.id = q.patient_id
       WHERE q.status = 'waiting'
       ORDER BY s.name ASC, q.created_at ASC`
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/queue/grouped -> agrupado por especialidad incluyendo posición y tiempo de espera
router.get('/grouped', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT 
         q.id,
         q.created_at,
         q.priority,
         TIMESTAMPDIFF(SECOND, q.created_at, NOW()) AS wait_seconds,
         ROW_NUMBER() OVER (PARTITION BY q.specialty_id ORDER BY q.created_at ASC) AS position,
         s.id AS specialty_id,
         s.name AS specialty_name,
         p.id AS patient_id,
         p.name AS patient_name,
         p.phone AS patient_phone
       FROM queue_entries q
       JOIN specialties s ON s.id = q.specialty_id
       JOIN patients p ON p.id = q.patient_id
       WHERE q.status = 'waiting'
       ORDER BY s.name ASC, q.created_at ASC`
    );
    // Agrupar en memoria
    const groups: Record<string, any> = {};
    for (const r of rows as any[]) {
      const key = `${r.specialty_id}`;
      if (!groups[key]) groups[key] = { specialty_id: r.specialty_id, specialty_name: r.specialty_name, count: 0, items: [] as any[] };
      groups[key].count++;
      groups[key].items.push({
        id: r.id,
        position: r.position,
        priority: r.priority,
        wait_seconds: r.wait_seconds,
        patient: { id: r.patient_id, name: r.patient_name, phone: r.patient_phone },
      });
    }
    return res.json(Object.values(groups));
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

const enqueueSchema = z.object({
  patient_id: z.number().int(),
  specialty_id: z.number().int(),
  priority: z.enum(['Alta','Normal','Baja']).default('Normal'),
  reason: z.string().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
});

// POST /api/queue -> encolar una nueva entrada
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = enqueueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    // evitar duplicados: si ya hay un waiting con mismo patient y specialty, devolver el existente
    const [dups] = await pool.query<any[]>(
      `SELECT id FROM queue_entries WHERE status='waiting' AND patient_id = ? AND specialty_id = ? ORDER BY created_at ASC LIMIT 1`,
      [d.patient_id, d.specialty_id]
    );
    if (Array.isArray(dups) && dups.length) {
      return res.status(200).json({ id: (dups as any)[0].id, ...d, status: 'waiting', duplicate: true });
    }
    const [result] = await pool.query(
      `INSERT INTO queue_entries (patient_id, specialty_id, priority, reason, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [d.patient_id, d.specialty_id, d.priority, d.reason ?? null, d.phone ?? null]
    );
    // @ts-ignore
  const payload = { id: (result as any).insertId, ...d, status: 'waiting' } as any;
  // Notificar a suscriptores SSE
  publish('queue', 'enqueue', payload);
  return res.status(201).json(payload);
  } catch (error) {
    console.error('Error enqueuing entry:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/queue/next -> asignar el siguiente de una especialidad al usuario actual
const nextSchema = z.object({ specialty_id: z.number().int() });
router.post('/next', requireAuth, async (req: Request, res: Response) => {
  const parsed = nextSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { specialty_id } = parsed.data;
  const userId = (req as any).user?.id ?? null;
  try {
    // Intento atómico: actualizar el más antiguo waiting de esa especialidad
    const [r]: any = await pool.query(
      `UPDATE queue_entries 
         SET status='assigned', assigned_user_id = ?, assigned_at = NOW()
       WHERE id = (
         SELECT id FROM (
           SELECT id FROM queue_entries WHERE status='waiting' AND specialty_id = ? ORDER BY created_at ASC LIMIT 1
         ) t
       ) AND status='waiting'`
      , [userId, specialty_id]
    );
  if (r.affectedRows === 0) return res.status(404).json({ message: 'No hay entradas en espera para la especialidad' });
    const [row] = await pool.query<any[]>(
      `SELECT q.*, s.name AS specialty_name, p.name AS patient_name, p.phone AS patient_phone
       FROM queue_entries q
       JOIN specialties s ON s.id = q.specialty_id
       JOIN patients p ON p.id = q.patient_id
       WHERE q.status='assigned' AND q.specialty_id = ? AND q.assigned_user_id = ?
       ORDER BY q.assigned_at DESC LIMIT 1`,
      [specialty_id, userId]
    );
  const item = Array.isArray(row) && row.length ? row[0] : null;
  if (item) publish('queue', 'assign', { id: item.id, specialty_id: item.specialty_id, assigned_user_id: userId });
  return res.json(item);
  } catch (error) {
    console.error('Error assigning next queue entry:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/queue/:id/assign -> asignar una entrada específica al usuario autenticado
router.post('/:id/assign', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const userId = (req as any).user?.id ?? null;
    await pool.query(
      `UPDATE queue_entries 
         SET status = 'assigned', assigned_user_id = ?, assigned_at = NOW()
       WHERE id = ? AND status = 'waiting'`,
      [userId, id]
    );
    return res.json({ id, status: 'assigned', assigned_user_id: userId });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/queue/:id/schedule -> marcar como scheduled y crear call_log opcional
const scheduleSchema = z.object({
  outcome: z.enum(['Cita agendada','No contestó','Rechazó','Número inválido','Otro']).default('Cita agendada'),
  notes: z.string().max(255).optional().nullable(),
});
router.post('/:id/schedule', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const userId = (req as any).user?.id ?? null;
  await pool.query(`UPDATE queue_entries SET status='scheduled' WHERE id = ?`, [id]);
    try {
      const [row] = await pool.query<any[]>(`SELECT patient_id, specialty_id FROM queue_entries WHERE id = ? LIMIT 1`, [id]);
      const e = Array.isArray(row) && row.length ? (row as any)[0] : null;
      if (e) {
        await pool.query(
          `INSERT INTO call_logs (patient_id, specialty_id, queue_id, user_id, channel, outcome, notes, status_id)
           VALUES (?, ?, ?, ?, 'Manual', ?, ?, NULL)`,
          [e.patient_id, e.specialty_id, id, userId, d.outcome, d.notes ?? null]
        );
      }
    } catch (logError) { 
      console.error('Error logging call outcome:', logError);
      /* Continue with scheduling even if logging fails */ 
    }
  publish('queue', 'scheduled', { id });
  return res.json({ id, status: 'scheduled' });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/queue/:id -> cancelar entrada
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query(`UPDATE queue_entries SET status='cancelled' WHERE id = ?`, [id]);
    publish('queue', 'cancelled', { id });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
