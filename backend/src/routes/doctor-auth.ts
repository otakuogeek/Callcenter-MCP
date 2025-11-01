import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

const router = Router();

// Interfaz para Doctor
interface Doctor extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  license_number: string;
  active: number;
  password_hash: string | null;
  last_login: Date | null;
  login_attempts: number;
  locked_until: Date | null;
}

// Interfaz para sesión
interface DoctorSession {
  id: number;
  doctor_id: number;
  token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
}

/**
 * POST /api/doctor-auth/login
 * Login de doctores
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    // Buscar doctor por email
    const [doctors] = await pool.query<Doctor[]>(
      'SELECT * FROM doctors WHERE email = ? AND active = 1',
      [email]
    );

    if (doctors.length === 0) {
      // Registrar intento fallido
      await pool.query(
        `INSERT INTO doctor_login_audit (email, success, ip_address, user_agent, failure_reason) 
         VALUES (?, 0, ?, ?, ?)`,
        [email, req.ip, req.get('user-agent'), 'Doctor no encontrado o inactivo']
      );

      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    const doctor = doctors[0];

    // Verificar si la cuenta está bloqueada
    if (doctor.locked_until && new Date(doctor.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(doctor.locked_until).getTime() - new Date().getTime()) / 60000
      );
      return res.status(423).json({
        success: false,
        error: `Cuenta bloqueada. Intente nuevamente en ${minutesLeft} minutos.`
      });
    }

    // Verificar contraseña
    if (!doctor.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'Cuenta sin contraseña configurada. Contacte al administrador.'
      });
    }

    const passwordValid = await bcrypt.compare(password, doctor.password_hash);

    if (!passwordValid) {
      // Incrementar intentos fallidos
      const newAttempts = (doctor.login_attempts || 0) + 1;
      let lockedUntil = null;

      // Bloquear cuenta después de 5 intentos fallidos
      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
      }

      await pool.query(
        'UPDATE doctors SET login_attempts = ?, locked_until = ? WHERE id = ?',
        [newAttempts, lockedUntil, doctor.id]
      );

      // Registrar intento fallido
      await pool.query(
        `INSERT INTO doctor_login_audit (doctor_id, email, success, ip_address, user_agent, failure_reason) 
         VALUES (?, ?, 0, ?, ?, ?)`,
        [doctor.id, email, req.ip, req.get('user-agent'), 'Contraseña incorrecta']
      );

      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas',
        attemptsLeft: Math.max(0, 5 - newAttempts)
      });
    }

    // Login exitoso - resetear intentos fallidos
    await pool.query(
      'UPDATE doctors SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?',
      [doctor.id]
    );

    // Generar token JWT
    const token = jwt.sign(
      { id: doctor.id, email: doctor.email, name: doctor.name, type: 'doctor' },
      process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security',
      { expiresIn: '2d' }
    );

    // Guardar sesión en la base de datos
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 días
    await pool.query(
      `INSERT INTO doctor_sessions (doctor_id, token, ip_address, user_agent, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [doctor.id, token, req.ip, req.get('user-agent'), expiresAt]
    );

    // Registrar login exitoso
    await pool.query(
      `INSERT INTO doctor_login_audit (doctor_id, email, success, ip_address, user_agent) 
       VALUES (?, ?, 1, ?, ?)`,
      [doctor.id, email, req.ip, req.get('user-agent')]
    );

    res.json({
      success: true,
      data: {
        token,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          license_number: doctor.license_number
        }
      }
    });
  } catch (error) {
    console.error('Error en login de doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar login'
    });
  }
});

/**
 * POST /api/doctor-auth/logout
 * Logout de doctores
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      // Eliminar sesión
      await pool.query('DELETE FROM doctor_sessions WHERE token = ?', [token]);
    }

    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar logout'
    });
  }
});

/**
 * GET /api/doctor-auth/me
 * Obtener información del doctor autenticado
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    // Verificar token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security'
    ) as any;

    if (decoded.type !== 'doctor') {
      return res.status(403).json({
        success: false,
        error: 'Token no válido para doctores'
      });
    }

    // Verificar sesión en la base de datos
    const [sessions] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM doctor_sessions WHERE token = ? AND expires_at > NOW()',
      [token]
    );

    if (sessions.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Sesión expirada'
      });
    }

    // Obtener datos del doctor
    const [doctors] = await pool.query<Doctor[]>(
      'SELECT id, name, email, phone, license_number, active FROM doctors WHERE id = ?',
      [decoded.id]
    );

    if (doctors.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor no encontrado'
      });
    }

    res.json({
      success: true,
      data: doctors[0]
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido'
      });
    }

    console.error('Error al obtener información del doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener información'
    });
  }
});

/**
 * POST /api/doctor-auth/change-password
 * Cambiar contraseña del doctor
 */
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { currentPassword, newPassword } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Contraseña actual y nueva contraseña son requeridas'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 8 caracteres'
      });
    }

    // Verificar token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security'
    ) as any;

    // Obtener doctor
    const [doctors] = await pool.query<Doctor[]>(
      'SELECT * FROM doctors WHERE id = ?',
      [decoded.id]
    );

    if (doctors.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor no encontrado'
      });
    }

    const doctor = doctors[0];

    // Verificar contraseña actual
    if (!doctor.password_hash) {
      return res.status(400).json({
        success: false,
        error: 'No hay contraseña configurada'
      });
    }

    const passwordValid = await bcrypt.compare(currentPassword, doctor.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña actual incorrecta'
      });
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await pool.query(
      'UPDATE doctors SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, doctor.id]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar contraseña'
    });
  }
});

/**
 * GET /api/doctor-auth/appointments
 * Obtener citas del doctor autenticado
 */
router.get('/appointments', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security') as any;
    
    if (decoded.type !== 'doctor') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado'
      });
    }

    const doctorId = decoded.id;
    const { status, date, limit = 50, include_cancelled = 'false', availability_id } = req.query;

    // Query base
    let query = `
      SELECT 
        a.id,
        a.patient_id,
        a.availability_id,
        DATE_FORMAT(DATE(a.scheduled_at), '%Y-%m-%d') as scheduled_date,
        TIME_FORMAT(TIME(a.scheduled_at), '%H:%i:%s') as start_time,
        TIME_FORMAT(ADDTIME(TIME(a.scheduled_at), SEC_TO_TIME(a.duration_minutes * 60)), '%H:%i:%s') as end_time,
        a.status,
        a.reason,
        a.notes,
        a.created_at,
        p.name as patient_name,
        p.document as patient_document,
        p.phone as patient_phone,
        p.email as patient_email,
        s.name as specialty_name,
        l.name as location_name,
        l.address as location_address
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.doctor_id = ?
    `;

    const params: any[] = [doctorId];

    // SIEMPRE excluir pacientes fantasma (citas de pausa)
    query += ' AND p.document != ?';
    params.push('SISTEMA-PAUSA');

    // Por defecto, excluir citas canceladas a menos que se solicite explícitamente
    if (include_cancelled !== 'true') {
      query += ' AND a.status != ?';
      params.push('Cancelada');
    }

    // Filtros opcionales
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    if (date) {
      query += ' AND DATE(a.scheduled_at) = ?';
      params.push(date);
    }

    // Filtro por agenda específica (igual que en endpoint admin)
    if (availability_id) {
      const availId = Number(availability_id);
      if (!Number.isNaN(availId)) {
        query += ' AND a.availability_id = ?';
        params.push(availId);
      }
    }

    query += ' ORDER BY a.scheduled_at DESC LIMIT ?';
    params.push(Number(limit));

    const [appointments] = await pool.query<RowDataPacket[]>(query, params);

    console.log('🔍 Doctor ID:', doctorId);
    console.log('📊 Total citas encontradas:', appointments.length);
    if (appointments.length > 0) {
      console.log('📅 Primera cita:', {
        id: appointments[0].id,
        scheduled_date: appointments[0].scheduled_date,
        start_time: appointments[0].start_time,
        patient_name: appointments[0].patient_name,
        status: appointments[0].status
      });
    }

    res.json({
      success: true,
      data: {
        appointments,
        total: appointments.length
      }
    });

  } catch (error: any) {
    console.error('Error al obtener citas:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al obtener citas'
    });
  }
});

/**
 * GET /api/doctor-auth/appointments/today
 * Obtener citas de hoy del doctor autenticado
 */
router.get('/appointments/today', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security') as any;
    
    if (decoded.type !== 'doctor') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado'
      });
    }

    const doctorId = decoded.id;

    // Obtener citas de hoy
    const query = `
      SELECT 
        a.id,
        a.patient_id,
        a.availability_id,
        a.scheduled_at as scheduled_date,
        TIME(a.scheduled_at) as start_time,
        ADDTIME(TIME(a.scheduled_at), SEC_TO_TIME(a.duration_minutes * 60)) as end_time,
        a.status,
        a.reason,
        a.notes,
        a.created_at,
        p.name as patient_name,
        p.document as patient_document,
        p.phone as patient_phone,
        p.email as patient_email,
        s.name as specialty_name,
        l.name as location_name,
        l.address as location_address
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.doctor_id = ?
        AND DATE(a.scheduled_at) = CURDATE()
        AND a.status IN ('Pendiente', 'Confirmada')
        AND p.document != 'SISTEMA-PAUSA'
      ORDER BY TIME(a.scheduled_at) ASC
    `;

    const [appointments] = await pool.query<RowDataPacket[]>(query, [doctorId]);

    res.json({
      success: true,
      data: {
        appointments,
        total: appointments.length,
        date: new Date().toISOString().split('T')[0]
      }
    });

  } catch (error: any) {
    console.error('Error al obtener citas de hoy:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al obtener citas de hoy'
    });
  }
});

/**
 * GET /api/doctor-auth/stats
 * Obtener estadísticas del doctor
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security') as any;
    
    if (decoded.type !== 'doctor') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado'
      });
    }

    const doctorId = decoded.id;

    // Citas de hoy (solo no canceladas y sin pacientes de pausa)
    const [todayAppointments] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.doctor_id = ? 
         AND DATE(a.scheduled_at) = CURDATE() 
         AND a.status != 'Cancelada'
         AND p.document != 'SISTEMA-PAUSA'`,
      [doctorId]
    );

    // Total de pacientes únicos (solo de citas no canceladas y sin pacientes de pausa)
    const [totalPatients] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT a.patient_id) as count FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.doctor_id = ? 
         AND a.status != 'Cancelada'
         AND p.document != 'SISTEMA-PAUSA'`,
      [doctorId]
    );

    // Consultas este mes (solo no canceladas y sin pacientes de pausa)
    const [monthConsultations] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.doctor_id = ? 
       AND MONTH(a.scheduled_at) = MONTH(CURDATE()) 
       AND YEAR(a.scheduled_at) = YEAR(CURDATE())
       AND a.status != 'Cancelada'
       AND p.document != 'SISTEMA-PAUSA'`,
      [doctorId]
    );

    res.json({
      success: true,
      data: {
        todayAppointments: todayAppointments[0]?.count || 0,
        totalPatients: totalPatients[0]?.count || 0,
        monthConsultations: monthConsultations[0]?.count || 0
      }
    });

  } catch (error: any) {
    console.error('Error al obtener estadísticas:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

export default router;
