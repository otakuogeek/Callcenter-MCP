import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const baseSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['consulta','laboratorio','imagen','procedimiento','otro']).default('consulta'),
  description: z.string().optional().nullable(),
  base_price: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('COP'),
  active: z.boolean().default(true)
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM services ORDER BY name ASC');
    return res.json(rows);
  } catch (e: any) {
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) {
      return res.json([]);
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

// Búsqueda rápida (?q=texto)
router.get('/search/q', requireAuth, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const [rows] = await pool.query('SELECT id, name, category FROM services WHERE name LIKE ? ORDER BY name ASC LIMIT 20', ['%'+q+'%']);
    return res.json(rows);
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  if (d.base_price < 0) return res.status(400).json({ code: 'BASE_PRICE_NEGATIVE', message: 'Precio base no puede ser negativo' });
  try {
    const [result] = await pool.query(
      'INSERT INTO services (name, category, description, base_price, currency, active) VALUES (?,?,?,?,?,?)',
      [d.name, d.category, d.description ?? null, d.base_price, d.currency, d.active ? 1 : 0]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ code: 'DUPLICATE_NAME', message: 'Nombre ya existe' });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = baseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  if (d.base_price != null && d.base_price < 0) return res.status(400).json({ code: 'BASE_PRICE_NEGATIVE', message: 'Precio base no puede ser negativo' });
  try {
    const fields: string[] = []; const values: any[] = [];
    for (const k of Object.keys(d) as (keyof typeof d)[]) {
      fields.push(`${k} = ?`); // @ts-ignore
      values.push(k === 'active' ? (d[k] ? 1 : 0) : d[k]);
    }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ code: 'DUPLICATE_NAME', message: 'Nombre ya existe' });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    // Evitar eliminar si hay precios asociados
    const [[{ c_prices }]]: any = await pool.query('SELECT COUNT(*) as c_prices FROM doctor_service_prices WHERE service_id = ?', [id]);
    if (Number(c_prices) > 0) return res.status(409).json({ message: 'Servicio en uso (precios de doctor)' });
    await pool.query('DELETE FROM services WHERE id = ?', [id]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
