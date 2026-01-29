import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { logAudit } from '../services/auditService';

const router = Router();

// Helper para extraer IP real
function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';
}

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['superadmin', 'admin', 'supervisor', 'agent', 'doctor', 'reception']).default('agent'),
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
  
  // 🔒 PROTECCIÓN: Solo superadmin puede crear otros superadmin
  const authUser = (req as any).user;
  if (role === 'superadmin' && authUser?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Solo un Super Admin puede crear otro Super Admin' });
  }
  
  try {
    const hash = password ? await bcrypt.hash(password, 10) : await bcrypt.genSalt(10).then(s => bcrypt.hash('Cambiar123!', s));
    const [result] = await pool.query(
      'INSERT INTO users (name, email, role, status, phone, department, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, role, status, phone ?? null, department ?? null, hash]
    );
    // @ts-ignore
    const newUserId = result.insertId;
    
    // 🔒 AUDITORÍA: Registrar creación de usuario
    const authUser = (req as any).user;
    await logAudit({
      userId: authUser?.id ?? null,
      userName: authUser?.name ?? null,
      userEmail: authUser?.email ?? null,
      userRole: authUser?.role ?? null,
      actionType: 'USER_CREATED',
      entityType: 'user',
      entityId: newUserId,
      entityName: name,
      newValues: { name, email, role, status, phone, department },
      description: `Usuario "${name}" (${email}) creado con rol ${role}`,
      requestMethod: 'POST',
      requestPath: '/api/users',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] ?? null
    });
    
    res.status(201).json({ id: newUserId, name, email, role, status, phone: phone ?? null, department: department ?? null });
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
  
  const authUser = (req as any).user;
  
  try {
    // 🔒 AUDITORÍA: Obtener valores anteriores
    const [oldRows] = await pool.query(
      'SELECT id, name, email, role, status, phone, department FROM users WHERE id = ?',
      [id]
    );
    const oldUser = Array.isArray(oldRows) && oldRows.length ? (oldRows as any)[0] : null;
    
    // 🔒 PROTECCIÓN: Solo superadmin puede modificar a otro superadmin
    if (oldUser?.role === 'superadmin' && authUser?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Solo un Super Admin puede modificar a otro Super Admin' });
    }
    
    // 🔒 PROTECCIÓN: Solo superadmin puede asignar el rol superadmin
    if (role === 'superadmin' && authUser?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Solo un Super Admin puede asignar el rol de Super Admin' });
    }
    
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
    
    // 🔒 AUDITORÍA: Registrar actualización de usuario
    const changedFields: string[] = [];
    if (name && oldUser?.name !== name) changedFields.push('name');
    if (email && oldUser?.email !== email) changedFields.push('email');
    if (role && oldUser?.role !== role) changedFields.push('role');
    if (status && oldUser?.status !== status) changedFields.push('status');
    if (phone !== undefined && oldUser?.phone !== phone) changedFields.push('phone');
    if (department !== undefined && oldUser?.department !== department) changedFields.push('department');
    if (password) changedFields.push('password');
    
    await logAudit({
      userId: authUser?.id ?? null,
      userName: authUser?.name ?? null,
      userEmail: authUser?.email ?? null,
      userRole: authUser?.role ?? null,
      actionType: 'UPDATE',
      entityType: 'user',
      entityId: id,
      entityName: oldUser?.name || name,
      oldValues: oldUser,
      newValues: { ...parsed.data, password: password ? '[CHANGED]' : undefined },
      changedFields,
      description: `Usuario "${oldUser?.name || name}" actualizado. Campos: ${changedFields.join(', ')}`,
      requestMethod: 'PUT',
      requestPath: '/api/users/' + id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] ?? null
    });
    
    res.json({ id, ...parsed.data });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email ya existe' });
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  
  const authUser = (req as any).user;
  
  try {
    // 🔒 AUDITORÍA: Obtener datos del usuario antes de eliminar
    const [oldRows] = await pool.query(
      'SELECT id, name, email, role, status, phone, department FROM users WHERE id = ?',
      [id]
    );
    const deletedUser = Array.isArray(oldRows) && oldRows.length ? (oldRows as any)[0] : null;
    
    // 🔒 PROTECCIÓN: Solo superadmin puede eliminar a otro superadmin
    if (deletedUser?.role === 'superadmin' && authUser?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Solo un Super Admin puede eliminar a otro Super Admin' });
    }
    
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
    // 🔒 AUDITORÍA: Registrar eliminación de usuario
    await logAudit({
      userId: authUser?.id ?? null,
      userName: authUser?.name ?? null,
      userEmail: authUser?.email ?? null,
      userRole: authUser?.role ?? null,
      actionType: 'USER_DELETED',
      entityType: 'user',
      entityId: id,
      entityName: deletedUser?.name,
      oldValues: deletedUser,
      description: `Usuario "${deletedUser?.name}" (${deletedUser?.email}) eliminado`,
      requestMethod: 'DELETE',
      requestPath: '/api/users/' + id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] ?? null
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
