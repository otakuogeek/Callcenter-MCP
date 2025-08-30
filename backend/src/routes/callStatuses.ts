import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().min(1).max(24).optional().nullable(),
  sort_order: z.number().int().min(0).max(32767).optional().nullable(),
  active: z.enum(['active','inactive']).optional(),
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, color, sort_order, active FROM call_statuses ORDER BY COALESCE(sort_order, 32767), name ASC'
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const [result] = await pool.query(
      'INSERT INTO call_statuses (name, color, sort_order, active) VALUES (?, ?, ?, COALESCE(?, "active"))',
      [d.name, d.color ?? null, d.sort_order ?? null, d.active]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d, active: d.active ?? 'active' });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Nombre de estado ya existe' });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = createSchema.partial().safeParse(req.body);
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
    await pool.query(`UPDATE call_statuses SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Nombre de estado ya existe' });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    // Borrado lógico para evitar conflictos con logs existentes
    await pool.query('UPDATE call_statuses SET active = "inactive" WHERE id = ?', [id]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
