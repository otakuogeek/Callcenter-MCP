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
    const { status, date, limit = 500, include_cancelled = 'false', availability_id } = req.query;

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
        a.appointment_source,
        a.created_at,
        a.created_by_user_id,
        u.name as created_by_name,
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
      LEFT JOIN users u ON a.created_by_user_id = u.id
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

/**
 * GET /api/doctor-auth/enhanced-stats
 * Estadísticas extendidas para el dashboard del doctor
 */
router.get('/enhanced-stats', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security') as any;
    if (decoded.type !== 'doctor') {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    const doctorId = decoded.id;

    // ---- Ejecutar todas las queries en paralelo ----
    const [
      [todayRows],
      [weekRows],
      [monthRows],
      [totalPatientsRows],
      [completedRows],
      [pendingTodayRows],
      [confirmedTodayRows],
      [completedTodayRows],
      [nextAppointmentRows],
      [recentPatientsRows],
      [recordsCountRows],
      [avgDurationRows],
      [weeklyTrendRows]
    ] = await Promise.all([
      // Citas de hoy (no canceladas, sin sistema-pausa)
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND DATE(a.scheduled_at) = CURDATE()
           AND a.status != 'Cancelada' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Citas esta semana
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND YEARWEEK(a.scheduled_at, 1) = YEARWEEK(CURDATE(), 1)
           AND a.status != 'Cancelada' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Citas este mes
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND MONTH(a.scheduled_at) = MONTH(CURDATE())
           AND YEAR(a.scheduled_at) = YEAR(CURDATE())
           AND a.status != 'Cancelada' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Total pacientes únicos
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT a.patient_id) as count FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND a.status != 'Cancelada' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Citas completadas total
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND a.status = 'Completada' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Pendientes hoy
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND DATE(a.scheduled_at) = CURDATE()
           AND a.status = 'Pendiente' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Confirmadas hoy
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND DATE(a.scheduled_at) = CURDATE()
           AND a.status = 'Confirmada' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Completadas hoy
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND DATE(a.scheduled_at) = CURDATE()
           AND a.status = 'Completada' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Próxima cita
      pool.query<RowDataPacket[]>(
        `SELECT 
           a.id,
           DATE_FORMAT(DATE(a.scheduled_at), '%Y-%m-%d') as scheduled_date,
           TIME_FORMAT(TIME(a.scheduled_at), '%H:%i') as start_time,
           p.name as patient_name,
           s.name as specialty_name
         FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         LEFT JOIN specialties s ON a.specialty_id = s.id
         WHERE a.doctor_id = ? AND a.scheduled_at >= NOW()
           AND a.status IN ('Pendiente', 'Confirmada') AND p.document != 'SISTEMA-PAUSA'
         ORDER BY a.scheduled_at ASC LIMIT 1`,
        [doctorId]
      ),
      // Últimos 5 pacientes atendidos
      pool.query<RowDataPacket[]>(
        `SELECT DISTINCT
           p.id as patient_id, p.name, p.document, p.phone,
           p.birth_date, p.gender,
           TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
           ie.name as eps_name,
           MAX(a.scheduled_at) as last_visit,
           (SELECT COUNT(*) FROM appointments a2 WHERE a2.patient_id = p.id AND a2.doctor_id = ? AND a2.status != 'Cancelada') as visit_count
         FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         LEFT JOIN eps ie ON p.insurance_eps_id = ie.id
         WHERE a.doctor_id = ? AND a.status = 'Completada' AND p.document != 'SISTEMA-PAUSA'
         GROUP BY p.id, p.name, p.document, p.phone, p.birth_date, p.gender, ie.name
         ORDER BY last_visit DESC LIMIT 5`,
        [doctorId, doctorId]
      ),
      // Total de historias clínicas creadas
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM medical_records WHERE doctor_id = ?`,
        [doctorId]
      ),
      // Duración promedio de consulta (basado en duration_minutes)
      pool.query<RowDataPacket[]>(
        `SELECT AVG(a.duration_minutes) as avg_duration FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND a.status = 'Completada' AND p.document != 'SISTEMA-PAUSA'`,
        [doctorId]
      ),
      // Tendencia semanal (últimas 4 semanas)
      pool.query<RowDataPacket[]>(
        `SELECT 
           YEARWEEK(a.scheduled_at, 1) as week_number,
           DATE_FORMAT(MIN(DATE(a.scheduled_at)), '%Y-%m-%d') as week_start,
           COUNT(*) as total,
           SUM(CASE WHEN a.status = 'Completada' THEN 1 ELSE 0 END) as completed,
           COUNT(DISTINCT a.patient_id) as unique_patients
         FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND a.scheduled_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
           AND a.status != 'Cancelada' AND p.document != 'SISTEMA-PAUSA'
         GROUP BY YEARWEEK(a.scheduled_at, 1)
         ORDER BY week_number DESC
         LIMIT 4`,
        [doctorId]
      ),
    ]);

    const todayTotal = todayRows[0]?.count || 0;
    const completedTotal = completedRows[0]?.count || 0;
    const monthTotal = monthRows[0]?.count || 0;
    const allTotalNonCancelled = completedTotal + (todayTotal); // approximation
    const completionRate = allTotalNonCancelled > 0 ? Math.round((completedTotal / allTotalNonCancelled) * 100) : 0;

    res.json({
      success: true,
      data: {
        today: {
          total: todayTotal,
          pending: pendingTodayRows[0]?.count || 0,
          confirmed: confirmedTodayRows[0]?.count || 0,
          completed: completedTodayRows[0]?.count || 0,
        },
        week: {
          total: weekRows[0]?.count || 0,
        },
        month: {
          total: monthTotal,
        },
        overall: {
          totalPatients: totalPatientsRows[0]?.count || 0,
          totalCompleted: completedTotal,
          totalRecords: recordsCountRows[0]?.count || 0,
          avgDurationMinutes: Math.round(avgDurationRows[0]?.avg_duration || 0),
          completionRate,
        },
        nextAppointment: nextAppointmentRows[0] || null,
        recentPatients: recentPatientsRows || [],
        weeklyTrend: weeklyTrendRows || [],
      }
    });

  } catch (error: any) {
    console.error('Error al obtener estadísticas extendidas:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
    }
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/doctor-auth/my-availabilities
 * Obtener las agendas del doctor con datos de ocupación (vista similar al panel admin)
 */
router.get('/my-availabilities', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security') as any;
    if (decoded.type !== 'doctor') {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    const doctorId = decoded.id;

    // Obtener todas las agendas futuras del doctor con datos de ocupación
    const [availabilities] = await pool.query<RowDataPacket[]>(`
      SELECT 
        av.id as availability_id,
        av.date,
        av.start_time,
        av.end_time,
        av.capacity,
        av.status,
        l.name as location_name,
        l.address as location_address,
        s.id as specialty_id,
        s.name as specialty_name,
        COALESCE(confirmed.confirmed_count, 0) as confirmed_appointments,
        COALESCE(cancelled.cancelled_count, 0) as cancelled_appointments
      FROM availabilities av
      JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN locations l ON av.location_id = l.id
      LEFT JOIN (
        SELECT 
          availability_id,
          COUNT(*) as confirmed_count
        FROM appointments
        WHERE status NOT IN ('Cancelada', 'No asistió')
          AND availability_id IS NOT NULL
        GROUP BY availability_id
      ) confirmed ON confirmed.availability_id = av.id
      LEFT JOIN (
        SELECT 
          availability_id,
          COUNT(*) as cancelled_count
        FROM appointments
        WHERE status IN ('Cancelada', 'No asistió')
          AND availability_id IS NOT NULL
        GROUP BY availability_id
      ) cancelled ON cancelled.availability_id = av.id
      WHERE av.doctor_id = ?
        AND av.date >= CURDATE()
        AND av.status IN ('Activa', 'Completa')
      ORDER BY av.date ASC, av.start_time ASC
    `, [doctorId]);

    // Agrupar por especialidad
    const specialtyMap: Record<number, {
      specialty_id: number;
      specialty_name: string;
      availabilities: any[];
      summary: { totalCapacity: number; totalConfirmed: number; totalCancelled: number; availableSlots: number; occupancyRate: number; totalAvailabilities: number };
    }> = {};

    for (const av of availabilities) {
      const specId = av.specialty_id;
      if (!specialtyMap[specId]) {
        specialtyMap[specId] = {
          specialty_id: specId,
          specialty_name: av.specialty_name,
          availabilities: [],
          summary: { totalCapacity: 0, totalConfirmed: 0, totalCancelled: 0, availableSlots: 0, occupancyRate: 0, totalAvailabilities: 0 }
        };
      }

      // Formatear fecha
      let dateStr = av.date;
      if (av.date instanceof Date) {
        dateStr = av.date.toISOString().split('T')[0];
      } else if (typeof av.date === 'string' && av.date.includes('T')) {
        dateStr = av.date.split('T')[0];
      }

      const confirmed = av.confirmed_appointments;
      const available = Math.max(0, av.capacity - confirmed);
      const occupancy = av.capacity > 0 ? Math.round((confirmed / av.capacity) * 100) : 0;

      specialtyMap[specId].availabilities.push({
        id: av.availability_id,
        date: dateStr,
        startTime: av.start_time,
        endTime: av.end_time,
        location: av.location_name || 'Sin sede',
        locationAddress: av.location_address || '',
        capacity: av.capacity,
        confirmedAppointments: confirmed,
        cancelledAppointments: av.cancelled_appointments,
        availableSlots: available,
        occupancyRate: occupancy,
        status: av.status,
        isOverbooked: confirmed > av.capacity
      });

      specialtyMap[specId].summary.totalCapacity += av.capacity;
      specialtyMap[specId].summary.totalConfirmed += confirmed;
      specialtyMap[specId].summary.totalCancelled += av.cancelled_appointments;
      specialtyMap[specId].summary.totalAvailabilities++;
    }

    // Calcular resúmenes
    const specialties = Object.values(specialtyMap).map(spec => {
      spec.summary.availableSlots = spec.summary.totalCapacity - spec.summary.totalConfirmed;
      spec.summary.occupancyRate = spec.summary.totalCapacity > 0
        ? Math.round((spec.summary.totalConfirmed / spec.summary.totalCapacity) * 100)
        : 0;
      return spec;
    });

    // Resumen global
    const globalSummary = specialties.reduce((acc, spec) => {
      acc.totalCapacity += spec.summary.totalCapacity;
      acc.totalConfirmed += spec.summary.totalConfirmed;
      acc.totalAvailabilities += spec.summary.totalAvailabilities;
      return acc;
    }, { totalCapacity: 0, totalConfirmed: 0, totalAvailabilities: 0, availableSlots: 0, occupancyRate: 0 });

    globalSummary.availableSlots = globalSummary.totalCapacity - globalSummary.totalConfirmed;
    globalSummary.occupancyRate = globalSummary.totalCapacity > 0
      ? Math.round((globalSummary.totalConfirmed / globalSummary.totalCapacity) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        globalSummary,
        specialties
      }
    });

  } catch (error: any) {
    console.error('Error al obtener agendas del doctor:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
    }
    res.status(500).json({ success: false, error: 'Error al obtener agendas' });
  }
});

export default router;
