import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  default_duration_minutes: z.number().int().positive().max(480).default(30),
  active: z.boolean().default(true),
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM specialties ORDER BY name ASC');
    return res.json(rows);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const s = parsed.data;
  try {
    const [result] = await pool.query(
      'INSERT INTO specialties (name, description, default_duration_minutes, active) VALUES (?, ?, ?, ?)',
      [s.name, s.description ?? null, s.default_duration_minutes, s.active]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...s });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Nombre ya existe' });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const s = parsed.data;
  try {
    const fields: string[] = []; const values: any[] = [];
    for (const k of Object.keys(s) as (keyof typeof s)[]) { fields.push(`${k} = ?`); // @ts-ignore
      values.push(s[k] ?? null); }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE specialties SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...s });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    // Evitar eliminar si existen relaciones en uso
    const [[{ c_doctors }]]: any = await pool.query('SELECT COUNT(*) as c_doctors FROM doctor_specialties WHERE specialty_id = ?', [id]);
    const [[{ c_locations }]]: any = await pool.query('SELECT COUNT(*) as c_locations FROM location_specialties WHERE specialty_id = ?', [id]);
    const [[{ c_queue }]]: any = await pool.query('SELECT COUNT(*) as c_queue FROM queue_entries WHERE specialty_id = ?', [id]).catch(() => [[{ c_queue: 0 }]]);
    const total = Number(c_doctors || 0) + Number(c_locations || 0) + Number(c_queue || 0);
    if (total > 0) {
      return res.status(409).json({ message: 'Especialidad en uso', usage: { doctors: c_doctors, locations: c_locations, queue: c_queue } });
    }
    await pool.query('DELETE FROM specialties WHERE id = ?', [id]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /specialties/:id/usage - obtener conteos de uso para confirmar antes de eliminar
router.get('/:id/usage', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [[{ c_doctors }]]: any = await pool.query('SELECT COUNT(*) as c_doctors FROM doctor_specialties WHERE specialty_id = ?', [id]);
    const [[{ c_locations }]]: any = await pool.query('SELECT COUNT(*) as c_locations FROM location_specialties WHERE specialty_id = ?', [id]);
    const [[{ c_queue }]]: any = await pool.query('SELECT COUNT(*) as c_queue FROM queue_entries WHERE specialty_id = ?', [id]).catch(() => [[{ c_queue: 0 }]]);
    return res.json({ doctors: c_doctors, locations: c_locations, queue: c_queue });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
