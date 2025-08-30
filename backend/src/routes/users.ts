import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'supervisor', 'agent', 'doctor', 'reception']).default('agent'),
  status: z.enum(['Activo', 'Inactivo']).default('Activo'),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
  const [rows] = await pool.query('SELECT id, name, email, role, status, phone, department, created_at FROM users ORDER BY id DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { name, email, role, status, phone, department, password } = parsed.data;
  try {
    const hash = password ? await bcrypt.hash(password, 10) : await bcrypt.genSalt(10).then(s => bcrypt.hash('Cambiar123!', s));
    const [result] = await pool.query(
      'INSERT INTO users (name, email, role, status, phone, department, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, role, status, phone ?? null, department ?? null, hash]
    );
    // @ts-ignore
    res.status(201).json({ id: result.insertId, name, email, role, status, phone: phone ?? null, department: department ?? null });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email ya existe' });
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = userSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { name, email, role, status, phone, department, password } = parsed.data;
  try {
    const fields: string[] = [];
    const values: any[] = [];
    if (name) { fields.push('name = ?'); values.push(name); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (status) { fields.push('status = ?'); values.push(status); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone ?? null); }
    if (department !== undefined) { fields.push('department = ?'); values.push(department ?? null); }
    if (password) { fields.push('password_hash = ?'); values.push(await bcrypt.hash(password, 10)); }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ id, ...parsed.data });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email ya existe' });
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
