import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { email, password } = parsed.data;
  try {
  const [rows] = await pool.query(
      'SELECT id, name, email, role, status, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = Array.isArray(rows) && rows.length ? (rows as any)[0] : null;
    if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });
  if (user.status !== 'Activo') return res.status(403).json({ message: 'Usuario inactivo' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET || (() => {
      console.error('⚠️  WARNING: JWT_SECRET not set, using insecure default');
      return 'biosanarcall_default_jwt_secret_2025_change_in_production';
    })(), { expiresIn: '8h' });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
