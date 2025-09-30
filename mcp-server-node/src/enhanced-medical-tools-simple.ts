// ===================================================================
// HERRAMIENTAS MCP MEJORADAS SIMPLIFICADAS - SISTEMA MÉDICO BIOSANARCALL
// ===================================================================

import mysql from 'mysql2/promise';

// Herramientas MCP mejoradas (selección esencial)
export const ENHANCED_MEDICAL_TOOLS = [
  {
    name: 'searchPatientsAdvanced',
    description: 'Búsqueda avanzada de pacientes con múltiples filtros',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Término de búsqueda general' },
        name: { type: 'string', description: 'Buscar por nombre' },
        document: { type: 'string', description: 'Buscar por documento' },
        phone: { type: 'string', description: 'Buscar por teléfono' },
        municipality_id: { type: 'number', description: 'Filtrar por municipio' },
        eps_id: { type: 'number', description: 'Filtrar por EPS' },
        age_min: { type: 'number', description: 'Edad mínima' },
        age_max: { type: 'number', description: 'Edad máxima' },
        gender: { type: 'string', description: 'Filtrar por género' },
        limit: { type: 'number', description: 'Máximo resultados', default: 50 }
      }
    }
  },
  
  {
    name: 'getPatientProfile',
    description: 'Obtener perfil completo del paciente con estadísticas',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        include_appointments: { type: 'boolean', description: 'Incluir estadísticas de citas', default: true },
        days_back: { type: 'number', description: 'Días hacia atrás para estadísticas', default: 90 }
      },
      required: ['patient_id']
    }
  },
  
  {
    name: 'getAppointmentsAdvanced',
    description: 'Búsqueda avanzada de citas con múltiples filtros',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' },
        status: { type: 'string', description: 'Estado de la cita' },
        patient_name: { type: 'string', description: 'Buscar por nombre de paciente' },
        limit: { type: 'number', description: 'Máximo resultados', default: 100 }
      }
    }
  },
  
  {
    name: 'scheduleAppointmentAdvanced',
    description: 'Programar cita con validaciones avanzadas',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' },
        location_id: { type: 'number', description: 'ID de la ubicación' },
        scheduled_at: { type: 'string', description: 'Fecha y hora YYYY-MM-DD HH:MM:SS' },
        duration_minutes: { type: 'number', description: 'Duración en minutos', default: 30 },
        appointment_type: { type: 'string', description: 'Tipo de cita', default: 'Presencial' },
        reason: { type: 'string', description: 'Motivo de la cita' },
        notes: { type: 'string', description: 'Notas adicionales' },
        check_availability: { type: 'boolean', description: 'Verificar disponibilidad', default: true }
      },
      required: ['patient_id', 'doctor_id', 'specialty_id', 'location_id', 'scheduled_at']
    }
  },
  
  {
    name: 'getDashboardStats',
    description: 'Obtener estadísticas para dashboard administrativo',
    inputSchema: {
      type: 'object',
      properties: {
        date_range: { type: 'string', enum: ['today','week','month','year'], description: 'Rango de fechas', default: 'today' },
        location_id: { type: 'number', description: 'Filtrar por ubicación' },
        specialty_id: { type: 'number', description: 'Filtrar por especialidad' }
      }
    }
  },
  
  {
    name: 'getSystemHealth',
    description: 'Verificar estado de salud del sistema',
    inputSchema: {
      type: 'object',
      properties: {
        include_stats: { type: 'boolean', description: 'Incluir estadísticas básicas', default: true }
      }
    }
  }
];

// ===================================================================
// FUNCIÓN DE EJECUCIÓN
// ===================================================================

export async function executeEnhancedMedicalTool(
  toolName: string, 
  args: any, 
  pool: mysql.Pool
): Promise<any> {
  
  try {
    switch (toolName) {
      case 'searchPatientsAdvanced':
        return await searchPatientsAdvanced(args, pool);
      
      case 'getPatientProfile':
        return await getPatientProfile(args, pool);
      
      case 'getAppointmentsAdvanced':
        return await getAppointmentsAdvanced(args, pool);
      
      case 'scheduleAppointmentAdvanced':
        return await scheduleAppointmentAdvanced(args, pool);
      
      case 'getDashboardStats':
        return await getDashboardStats(args, pool);
      
      case 'getSystemHealth':
        return await getSystemHealth(args, pool);
      
      default:
        throw new Error(`Herramienta ${toolName} no implementada`);
    }
    
  } catch (error: any) {
    console.error(`Error ejecutando herramienta ${toolName}:`, error);
    throw new Error(`Error en ${toolName}: ${error.message}`);
  }
}

// ===================================================================
// IMPLEMENTACIONES DE FUNCIONES
// ===================================================================

async function searchPatientsAdvanced(args: any, pool: mysql.Pool): Promise<any> {
  try {
    let query = `
      SELECT DISTINCT
        p.id,
        p.document,
        p.name,
        p.phone,
        p.phone_alt,
        p.email,
        p.birth_date,
        p.gender,
        p.address,
        p.status,
        p.created_at,
        m.name as municipality_name,
        eps.name as eps_name,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        COUNT(a.id) as total_appointments,
        MAX(a.scheduled_at) as last_appointment_date,
        SUM(CASE WHEN a.status = 'Pendiente' THEN 1 ELSE 0 END) as pending_appointments
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN appointments a ON p.id = a.patient_id
      WHERE p.status = 'Activo'
    `;
    
    const params: any[] = [];
    
    if (args.query) {
      query += ` AND (p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)`;
      const searchTerm = `%${args.query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (args.name) {
      query += ` AND p.name LIKE ?`;
      params.push(`%${args.name}%`);
    }
    
    if (args.document) {
      query += ` AND p.document = ?`;
      params.push(args.document);
    }
    
    if (args.phone) {
      query += ` AND (p.phone LIKE ? OR p.phone_alt LIKE ?)`;
      params.push(`%${args.phone}%`, `%${args.phone}%`);
    }
    
    if (args.municipality_id) {
      query += ` AND p.municipality_id = ?`;
      params.push(args.municipality_id);
    }
    
    if (args.eps_id) {
      query += ` AND p.insurance_eps_id = ?`;
      params.push(args.eps_id);
    }
    
    if (args.gender) {
      query += ` AND p.gender = ?`;
      params.push(args.gender);
    }
    
    query += ` GROUP BY p.id`;
    
    if (args.age_min || args.age_max) {
      query += ` HAVING 1=1`;
      if (args.age_min) {
        query += ` AND age >= ?`;
        params.push(args.age_min);
      }
      if (args.age_max) {
        query += ` AND age <= ?`;
        params.push(args.age_max);
      }
    }
    
    query += ` ORDER BY p.name ASC LIMIT ?`;
    params.push(args.limit || 50);
    
    const [rows] = await pool.execute(query, params);
    
    return { 
      patients: rows, 
      total: (rows as any[]).length,
      search_criteria: args
    };
    
  } catch (error: any) {
    throw new Error(`Error en búsqueda avanzada de pacientes: ${error.message}`);
  }
}

async function getPatientProfile(args: any, pool: mysql.Pool): Promise<any> {
  try {
    // Información básica del paciente
    const [patientRows] = await pool.execute(`
      SELECT 
        p.*,
        m.name as municipality_name,
        eps.name as eps_name,
        bg.name as blood_group_name,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      WHERE p.id = ?
    `, [args.patient_id]);
    
    if ((patientRows as any[]).length === 0) {
      throw new Error('Paciente no encontrado');
    }
    
    const patient = (patientRows as any[])[0];
    const profile: any = { patient };
    
    // Estadísticas de citas si se solicita
    if (args.include_appointments) {
      const [appointmentStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN status = 'Completada' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pending_appointments,
          COUNT(CASE WHEN status = 'Cancelada' THEN 1 END) as cancelled_appointments,
          MAX(scheduled_at) as last_appointment_date,
          MIN(scheduled_at) as first_appointment_date
        FROM appointments 
        WHERE patient_id = ? AND scheduled_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [args.patient_id, args.days_back || 90]);
      
      profile.appointment_stats = (appointmentStats as any[])[0];
      
      // Próximas citas
      const [upcomingAppointments] = await pool.execute(`
        SELECT 
          a.scheduled_at,
          a.reason,
          a.status,
          d.name as doctor_name,
          s.name as specialty_name,
          l.name as location_name
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN specialties s ON a.specialty_id = s.id
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE a.patient_id = ? AND a.scheduled_at >= NOW()
        ORDER BY a.scheduled_at ASC
        LIMIT 5
      `, [args.patient_id]);
      
      profile.upcoming_appointments = upcomingAppointments;
    }
    
    return profile;
    
  } catch (error: any) {
    throw new Error(`Error obteniendo perfil del paciente: ${error.message}`);
  }
}

async function getAppointmentsAdvanced(args: any, pool: mysql.Pool): Promise<any> {
  try {
    let query = `
      SELECT 
        a.id,
        a.scheduled_at,
        a.duration_minutes,
        a.status,
        a.reason,
        a.notes,
        a.appointment_type,
        a.created_at,
        p.name as patient_name,
        p.document as patient_document,
        p.phone as patient_phone,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (args.date_from) {
      query += ` AND DATE(a.scheduled_at) >= ?`;
      params.push(args.date_from);
    }
    
    if (args.date_to) {
      query += ` AND DATE(a.scheduled_at) <= ?`;
      params.push(args.date_to);
    }
    
    if (args.patient_id) {
      query += ` AND a.patient_id = ?`;
      params.push(args.patient_id);
    }
    
    if (args.doctor_id) {
      query += ` AND a.doctor_id = ?`;
      params.push(args.doctor_id);
    }
    
    if (args.specialty_id) {
      query += ` AND a.specialty_id = ?`;
      params.push(args.specialty_id);
    }
    
    if (args.status) {
      query += ` AND a.status = ?`;
      params.push(args.status);
    }
    
    if (args.patient_name) {
      query += ` AND p.name LIKE ?`;
      params.push(`%${args.patient_name}%`);
    }
    
    query += ` ORDER BY a.scheduled_at DESC LIMIT ?`;
    params.push(args.limit || 100);
    
    const [rows] = await pool.execute(query, params);
    
    return { 
      appointments: rows, 
      total: (rows as any[]).length,
      search_criteria: args
    };
    
  } catch (error: any) {
    throw new Error(`Error en búsqueda avanzada de citas: ${error.message}`);
  }
}

async function scheduleAppointmentAdvanced(args: any, pool: mysql.Pool): Promise<any> {
  try {
    // Verificar disponibilidad si se solicita
    if (args.check_availability) {
      const [conflicts] = await pool.execute(`
        SELECT COUNT(*) as conflicts 
        FROM appointments 
        WHERE doctor_id = ? 
        AND DATE(scheduled_at) = DATE(?) 
        AND TIME(scheduled_at) = TIME(?)
        AND status IN ('Pendiente', 'Confirmada')
      `, [args.doctor_id, args.scheduled_at, args.scheduled_at]);
      
      if ((conflicts as any[])[0].conflicts > 0) {
        throw new Error('El médico ya tiene una cita programada en ese horario');
      }
    }
    
    // Crear la cita
    const [result] = await pool.execute(`
      INSERT INTO appointments (
        patient_id, doctor_id, specialty_id, location_id, 
        scheduled_at, duration_minutes, appointment_type, 
        reason, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', NOW())
    `, [
      args.patient_id,
      args.doctor_id,
      args.specialty_id,
      args.location_id,
      args.scheduled_at,
      args.duration_minutes || 30,
      args.appointment_type || 'Presencial',
      args.reason,
      args.notes
    ]);
    
    const appointmentId = (result as any).insertId;
    
    // Obtener detalles de la cita creada
    const [appointmentDetails] = await pool.execute(`
      SELECT 
        a.*,
        p.name as patient_name,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `, [appointmentId]);
    
    return {
      success: true,
      appointment_id: appointmentId,
      appointment: (appointmentDetails as any[])[0],
      message: 'Cita programada correctamente'
    };
    
  } catch (error: any) {
    throw new Error(`Error programando cita: ${error.message}`);
  }
}

async function getDashboardStats(args: any, pool: mysql.Pool): Promise<any> {
  try {
    const stats: any = {
      timestamp: new Date().toISOString(),
      date_range: args.date_range || 'today'
    };
    
    // Determinar rango de fechas
    let dateCondition = '';
    switch (args.date_range) {
      case 'today':
        dateCondition = 'DATE(created_at) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      case 'year':
        dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
        break;
      default:
        dateCondition = '1=1';
    }
    
    // Estadísticas de pacientes
    const [patientStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_patients,
        COUNT(CASE WHEN status = 'Activo' THEN 1 END) as active_patients,
        COUNT(CASE WHEN ${dateCondition} THEN 1 END) as new_patients_period
      FROM patients
    `);
    stats.patients = (patientStats as any[])[0];
    
    // Estadísticas de citas
    const appointmentDateCondition = dateCondition.replace('created_at', 'scheduled_at');
    const [appointmentStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pending_appointments,
        COUNT(CASE WHEN status = 'Completada' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN status = 'Cancelada' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN ${appointmentDateCondition} THEN 1 END) as appointments_period
      FROM appointments
      WHERE scheduled_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    `);
    stats.appointments = (appointmentStats as any[])[0];
    
    // Citas de hoy
    const [todayAppointments] = await pool.execute(`
      SELECT 
        COUNT(*) as total_today,
        COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pending_today,
        COUNT(CASE WHEN status = 'Completada' THEN 1 END) as completed_today
      FROM appointments
      WHERE DATE(scheduled_at) = CURDATE()
    `);
    stats.today = (todayAppointments as any[])[0];
    
    return { dashboard_stats: stats };
    
  } catch (error: any) {
    throw new Error(`Error obteniendo estadísticas del dashboard: ${error.message}`);
  }
}

async function getSystemHealth(args: any, pool: mysql.Pool): Promise<any> {
  try {
    const health: any = {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      enhanced_tools: ENHANCED_MEDICAL_TOOLS.length
    };
    
    if (args.include_stats) {
      // Estadísticas básicas del sistema
      const [stats] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM patients WHERE status = 'Activo') as active_patients,
          (SELECT COUNT(*) FROM doctors WHERE active = 1) as active_doctors,
          (SELECT COUNT(*) FROM appointments WHERE DATE(scheduled_at) = CURDATE()) as appointments_today,
          (SELECT COUNT(*) FROM appointments WHERE status = 'Pendiente') as pending_appointments
      `);
      
      health.system_stats = (stats as any[])[0];
    }
    
    return health;
    
  } catch (error: any) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}