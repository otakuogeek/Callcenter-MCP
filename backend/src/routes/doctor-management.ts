import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { requireAuth } from '../middleware/auth';

const router = Router();

interface Doctor extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  license_number: string;
  active: number;
  password_hash: string | null;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date | null;
}

/**
 * GET /api/doctor-management
 * Listar todos los doctores (solo para admin)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para realizar esta acción'
      });
    }

    const [doctors] = await pool.query<Doctor[]>(
      `SELECT id, name, email, phone, license_number, active, last_login, created_at, updated_at,
              CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password
       FROM doctors 
       ORDER BY name ASC`
    );

    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    console.error('Error al obtener doctores:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener doctores'
    });
  }
});

/**
 * POST /api/doctor-management/:id/set-password
 * Establecer contraseña para un doctor (solo admin)
 */
router.post('/:id/set-password', requireAuth, async (req: Request, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para realizar esta acción'
      });
    }

    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    // Verificar que el doctor existe
    const [doctors] = await pool.query<Doctor[]>(
      'SELECT * FROM doctors WHERE id = ?',
      [id]
    );

    if (doctors.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor no encontrado'
      });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar contraseña
    await pool.query(
      `UPDATE doctors 
       SET password_hash = ?, 
           login_attempts = 0, 
           locked_until = NULL,
           updated_at = NOW() 
       WHERE id = ?`,
      [hashedPassword, id]
    );

    res.json({
      success: true,
      message: 'Contraseña establecida exitosamente'
    });
  } catch (error) {
    console.error('Error al establecer contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al establecer contraseña'
    });
  }
});

/**
 * POST /api/doctor-management/:id/generate-password
 * Generar contraseña aleatoria para un doctor (solo admin)
 */
router.post('/:id/generate-password', requireAuth, async (req: Request, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para realizar esta acción'
      });
    }

    const { id } = req.params;

    // Verificar que el doctor existe
    const [doctors] = await pool.query<Doctor[]>(
      'SELECT * FROM doctors WHERE id = ?',
      [id]
    );

    if (doctors.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor no encontrado'
      });
    }

    // Generar contraseña aleatoria segura
    const generatedPassword = generateSecurePassword();

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Actualizar contraseña
    await pool.query(
      `UPDATE doctors 
       SET password_hash = ?, 
           login_attempts = 0, 
           locked_until = NULL,
           updated_at = NOW() 
       WHERE id = ?`,
      [hashedPassword, id]
    );

    res.json({
      success: true,
      message: 'Contraseña generada exitosamente',
      data: {
        password: generatedPassword,
        doctor: {
          id: doctors[0].id,
          name: doctors[0].name,
          email: doctors[0].email
        }
      }
    });
  } catch (error) {
    console.error('Error al generar contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar contraseña'
    });
  }
});

/**
 * POST /api/doctor-management/:id/reset-password
 * Resetear contraseña y desbloquear cuenta (solo admin)
 */
router.post('/:id/reset-password', requireAuth, async (req: Request, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para realizar esta acción'
      });
    }

    const { id } = req.params;

    // Verificar que el doctor existe
    const [doctors] = await pool.query<Doctor[]>(
      'SELECT * FROM doctors WHERE id = ?',
      [id]
    );

    if (doctors.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor no encontrado'
      });
    }

    // Generar nueva contraseña temporal
    const tempPassword = 'temp123';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Actualizar contraseña y resetear intentos de login
    await pool.query(
      `UPDATE doctors 
       SET password_hash = ?,
           login_attempts = 0, 
           locked_until = NULL,
           updated_at = NOW() 
       WHERE id = ?`,
      [hashedPassword, id]
    );

    // Eliminar todas las sesiones activas del doctor
    await pool.query(
      'DELETE FROM doctor_sessions WHERE doctor_id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Contraseña reseteada exitosamente',
      data: {
        tempPassword: tempPassword,
        email: doctors[0].email,
        name: doctors[0].name
      }
    });
  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al resetear contraseña'
    });
  }
});

/**
 * GET /api/doctor-management/:id/login-history
 * Obtener historial de logins de un doctor (solo admin)
 */
router.get('/:id/login-history', requireAuth, async (req: Request, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para realizar esta acción'
      });
    }

    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const [history] = await pool.query<RowDataPacket[]>(
      `SELECT 
        id, doctor_id, email, success, ip_address, user_agent, 
        failure_reason, created_at
       FROM doctor_login_audit 
       WHERE doctor_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [id, limit]
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error al obtener historial de login:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial'
    });
  }
});

/**
 * GET /api/doctor-management/:id/active-sessions
 * Obtener sesiones activas de un doctor (solo admin)
 */
router.get('/:id/active-sessions', requireAuth, async (req: Request, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para realizar esta acción'
      });
    }

    const { id } = req.params;

    const [sessions] = await pool.query<RowDataPacket[]>(
      `SELECT 
        id, ip_address, user_agent, expires_at, created_at
       FROM doctor_sessions 
       WHERE doctor_id = ? AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Error al obtener sesiones activas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener sesiones'
    });
  }
});

/**
 * DELETE /api/doctor-management/:id/sessions
 * Cerrar todas las sesiones de un doctor (solo admin)
 */
router.delete('/:id/sessions', requireAuth, async (req: Request, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para realizar esta acción'
      });
    }

    const { id } = req.params;

    const [result]: any = await pool.query(
      'DELETE FROM doctor_sessions WHERE doctor_id = ?',
      [id]
    );

    res.json({
      success: true,
      message: `${result.affectedRows} sesiones cerradas exitosamente`
    });
  } catch (error) {
    console.error('Error al cerrar sesiones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cerrar sesiones'
    });
  }
});

// Función auxiliar para generar contraseña segura
function generateSecurePassword(): string {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Asegurar que tenga al menos uno de cada tipo
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Rellenar el resto
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Mezclar caracteres
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default router;
