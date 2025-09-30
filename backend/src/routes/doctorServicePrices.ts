import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  doctor_id: z.number().int(),
  service_id: z.number().int(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default('COP'),
  active: z.boolean().default(true)
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const doctorId = req.query.doctor_id ? Number(req.query.doctor_id) : undefined;
  const serviceId = req.query.service_id ? Number(req.query.service_id) : undefined;
  const filters: string[] = []; const values: any[] = [];
  if (doctorId) { filters.push('dsp.doctor_id = ?'); values.push(doctorId); }
  if (serviceId) { filters.push('dsp.service_id = ?'); values.push(serviceId); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
    try {
      const [rows] = await pool.query(
        `SELECT dsp.*, d.name AS doctor_name, s.name AS service_name
       FROM doctor_service_prices dsp
       JOIN doctors d ON d.id = dsp.doctor_id
       JOIN services s ON s.id = dsp.service_id
       ${where}
       ORDER BY s.name, d.name`,
      values
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
  const d = parsed.data;
  try {
    const [result] = await pool.query(
      'INSERT INTO doctor_service_prices (doctor_id, service_id, price, currency, active) VALUES (?,?,?,?,?)',
      [d.doctor_id, d.service_id, d.price, d.currency, d.active ? 1 : 0]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Precio ya definido para doctor/servicio' });
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
      fields.push(`${k} = ?`); // @ts-ignore
      values.push(k === 'active' ? (d[k] ? 1 : 0) : d[k]);
    }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE doctor_service_prices SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM doctor_service_prices WHERE id = ?', [id]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
