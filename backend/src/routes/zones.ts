import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM zones ORDER BY name ASC');
    return res.json(rows);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const [result] = await pool.query(
      'INSERT INTO zones (name, description) VALUES (?, ?)',
      [d.name, d.description ?? null]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d });
  } catch (e: any) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Zone name already exists' });
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
    for (const k of Object.keys(d) as (keyof typeof d)[]) {
      fields.push(`${k} = ?`);
      // @ts-ignore
      values.push(d[k] ?? null);
    }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE zones SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (e: any) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Zone name already exists' });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM zones WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (e: any) {
    if (e && (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED')) {
      return res.status(409).json({ message: 'Cannot delete zone with related municipalities or patients' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
