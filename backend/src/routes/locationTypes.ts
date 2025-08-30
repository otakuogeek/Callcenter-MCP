import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth as auth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  name: z.string().min(2),
  status: z.enum(['active', 'inactive']).default('active')
});

router.get('/', auth, async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM location_types ORDER BY name ASC');
  res.json(rows);
});

router.post('/', auth, async (req, res) => {
  const d = schema.parse(req.body);
  try {
    const [r] = await pool.query(
      'INSERT INTO location_types (name, status) VALUES (?, ?)',
      [d.name, d.status]
    );
    // @ts-ignore
    const id = r.insertId as number;
    const [rows] = await pool.query('SELECT * FROM location_types WHERE id = ?', [id]);
    // @ts-ignore
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Tipo ya existe' });
    res.status(500).json({ message: 'Error creando tipo' });
  }
});

router.put('/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = schema.partial().parse(req.body);
  const fields: string[] = [];
  const values: any[] = [];
  for (const k of Object.keys(parsed) as (keyof typeof parsed)[]) {
    fields.push(`${k} = ?`);
    // @ts-ignore
    values.push(parsed[k]);
  }
  values.push(id);
  try {
    if (!fields.length) return res.json({ ok: true });
    await pool.query(`UPDATE location_types SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM location_types WHERE id = ?', [id]);
    // @ts-ignore
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Error actualizando tipo' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    // Evitar borrar si hay ubicaciones que usan el nombre (compat con esquema actual basado en string)
    const [rows] = await pool.query('SELECT name FROM location_types WHERE id = ?', [id]);
    // @ts-ignore
    const type = rows[0]?.name as string | undefined;
    if (!type) return res.status(404).json({ message: 'No encontrado' });
    const [cntRows] = await pool.query('SELECT COUNT(*) as c FROM locations WHERE type = ?', [type]);
    // @ts-ignore
    if ((cntRows[0]?.c ?? 0) > 0) return res.status(409).json({ message: 'Hay ubicaciones usando este tipo' });
    await pool.query('DELETE FROM location_types WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ message: 'Error eliminando tipo' });
  }
});

export default router;
