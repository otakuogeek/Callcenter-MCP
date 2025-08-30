import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  zone_id: z.number().int().min(1),
  name: z.string().min(1),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const zoneId = req.query.zone_id ? Number(req.query.zone_id) : undefined;
    if (zoneId && Number.isNaN(zoneId)) return res.status(400).json({ message: 'Invalid zone_id' });
    const where = zoneId ? 'WHERE m.zone_id = ?' : '';
    const params: any[] = zoneId ? [zoneId] : [];
    const [rows] = await pool.query(
      `SELECT m.*, z.name AS zone_name FROM municipalities m JOIN zones z ON z.id = m.zone_id ${where} ORDER BY m.name ASC`,
      params
    );
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
      'INSERT INTO municipalities (zone_id, name) VALUES (?, ?)',
      [d.zone_id, d.name]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d });
  } catch (e: any) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Municipality already exists in this zone' });
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
      values.push(d[k]);
    }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE municipalities SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (e: any) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Municipality already exists in this zone' });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM municipalities WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (e: any) {
    if (e && (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED')) {
      return res.status(409).json({ message: 'Cannot delete municipality referenced by locations or patients' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
