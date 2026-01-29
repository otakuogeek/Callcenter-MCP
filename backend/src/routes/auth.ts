import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';
import { loginLimiter } from '../middleware/rateLimiters';
import { logAudit } from '../services/auditService';

const router = Router();

// Helper para extraer IP real
function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Aplicar rate limiting específico a login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] ?? null;
  
  try {
  const [rows] = await pool.query(
      'SELECT id, name, email, role, status, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = Array.isArray(rows) && rows.length ? (rows as any)[0] : null;
    
    if (!user) {
      // 🔒 AUDITORÍA: Login fallido - usuario no existe
      await logAudit({
        userId: null,
        userEmail: email,
        actionType: 'LOGIN_FAILED',
        entityType: 'session',
        description: `Intento de login fallido - usuario no encontrado: ${email}`,
        metadata: { reason: 'user_not_found' },
        requestMethod: 'POST',
        requestPath: '/api/auth/login',
        ipAddress: clientIP,
        userAgent
      });
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    if (user.status !== 'Activo') {
      // 🔒 AUDITORÍA: Login fallido - usuario inactivo
      await logAudit({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        actionType: 'LOGIN_FAILED',
        entityType: 'session',
        description: `Intento de login fallido - usuario inactivo: ${email}`,
        metadata: { reason: 'user_inactive', status: user.status },
        requestMethod: 'POST',
        requestPath: '/api/auth/login',
        ipAddress: clientIP,
        userAgent
      });
      return res.status(403).json({ message: 'Usuario inactivo' });
    }
    
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      // 🔒 AUDITORÍA: Login fallido - contraseña incorrecta
      await logAudit({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        actionType: 'LOGIN_FAILED',
        entityType: 'session',
        description: `Intento de login fallido - contraseña incorrecta: ${email}`,
        metadata: { reason: 'invalid_password' },
        requestMethod: 'POST',
        requestPath: '/api/auth/login',
        ipAddress: clientIP,
        userAgent
      });
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
    
    // 🔒 AUDITORÍA: Login exitoso
    await logAudit({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      actionType: 'LOGIN',
      entityType: 'session',
      description: `Login exitoso: ${user.name} (${user.email}) - Rol: ${user.role}`,
      metadata: { tokenExpiry: '8h' },
      requestMethod: 'POST',
      requestPath: '/api/auth/login',
      ipAddress: clientIP,
      userAgent
    });
    
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
