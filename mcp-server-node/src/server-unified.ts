import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8977;

// Configuración CORS amplia para MCP Inspector
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-requested-with'],
  credentials: false
}));

app.use(express.json({ limit: '50mb' }));

// Middleware para logging de requests del MCP Inspector
app.use((req, res, next) => {
  if (req.path.includes('mcp')) {
    console.log(`🔍 MCP Request: ${req.method} ${req.path}`);
    console.log(`🔍 Headers:`, req.headers);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`🔍 Body:`, JSON.stringify(req.body, null, 2));
    }
  }
  next();
});

let pool: mysql.Pool;

// Crear pool de conexiones
try {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'biosanar',
    charset: 'utf8mb4',
    timezone: '+00:00',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  console.log('✓ Configuración de pool MySQL completada');
} catch (error) {
  console.error('✗ Error configurando pool MySQL:', error);
  process.exit(1);
}

// Tipos MCP Protocol
interface JSONRPCRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Helper functions
function createSuccessResponse(id: string | number, result: any): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

function createErrorResponse(id: string | number, code: number, message: string, data?: any): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data }
  };
}

// ===================================================================
// HERRAMIENTAS MCP PARA REGISTRO DE PACIENTES Y CITAS MÉDICAS
// ===================================================================
const UNIFIED_TOOLS = [
  {
    name: 'listActiveEPS',
    description: 'Consulta las EPS (Entidades Promotoras de Salud) activas disponibles para registro de pacientes. Retorna ID, nombre y código de cada EPS.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'registerPatientSimple',
    description: 'Registro simplificado de pacientes con datos mínimos requeridos: nombre, cédula, teléfono y EPS. Use listActiveEPS para obtener los IDs válidos de EPS antes de registrar.',
    inputSchema: {
      type: 'object',
      properties: {
        document: { 
          type: 'string', 
          description: 'Cédula o documento de identidad del paciente' 
        },
        name: { 
          type: 'string', 
          description: 'Nombre completo del paciente' 
        },
        phone: { 
          type: 'string', 
          description: 'Número de teléfono principal' 
        },
        insurance_eps_id: { 
          type: 'number', 
          description: 'ID de la EPS (1-17). Principales: 1=NUEVA EPS, 2=SANITAS, 3=SURA, 4=SALUD TOTAL, 5=COMPENSAR' 
        },
        notes: { 
          type: 'string', 
          description: 'Notas adicionales opcionales sobre el paciente' 
        }
      },
      required: ['document', 'name', 'phone', 'insurance_eps_id']
    }
  },
  {
    name: 'getAvailableAppointments',
    description: 'Lista todas las citas médicas disponibles. Permite filtrar por médico, especialidad y ubicación. Muestra médicos, horarios, duraciones y cupos disponibles ordenados por fecha.',
    inputSchema: {
      type: 'object',
      properties: {
        doctor_id: {
          type: 'number',
          description: 'ID del médico (opcional, filtra por doctor específico)'
        },
        specialty_id: {
          type: 'number',
          description: 'ID de la especialidad médica (opcional, filtra por especialidad)'
        },
        location_id: {
          type: 'number',
          description: 'ID de la ubicación/sede (opcional, filtra por sede)'
        },
        limit: {
          type: 'number',
          description: 'Número máximo de resultados a retornar (default: 50)',
          default: 50
        }
      },
      required: []
    }
  },
  {
    name: 'checkAvailabilityQuota',
    description: 'Verifica cuántos cupos hay disponibles para una ESPECIALIDAD en una SEDE específica. Agrega TODOS los cupos de todos los doctores de esa especialidad. Retorna información detallada sobre quotas totales, asignados, disponibles y si puede agendar directamente o debe ir a lista de espera. DEBE LLAMARSE ANTES de scheduleAppointment para tomar decisiones informadas.',
    inputSchema: {
      type: 'object',
      properties: {
        specialty_id: {
          type: 'number',
          description: 'ID de la especialidad a verificar (obtenido de getAvailableAppointments en specialty.id)'
        },
        location_id: {
          type: 'number',
          description: 'ID de la sede/ubicación a verificar (obtenido de getAvailableAppointments en location.id)'
        },
        day_date: {
          type: 'string',
          description: 'Fecha específica a verificar en formato YYYY-MM-DD (opcional). Si no se especifica, retorna todas las fechas disponibles.',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        }
      },
      required: ['specialty_id', 'location_id']
    }
  },
  {
    name: 'scheduleAppointment',
    description: 'Asigna una cita médica al paciente. Actualiza la disponibilidad y crea el registro de la cita. Requiere availability_id y día específico del availability_distribution.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'number',
          description: 'ID del paciente (obtenido de registerPatientSimple)'
        },
        availability_id: {
          type: 'number',
          description: 'ID de la disponibilidad (obtenido de getAvailableAppointments)'
        },
        scheduled_date: {
          type: 'string',
          description: 'Fecha y hora de la cita en formato YYYY-MM-DD HH:MM:SS',
          pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$'
        },
        appointment_type: {
          type: 'string',
          enum: ['Presencial', 'Telemedicina'],
          description: 'Tipo de consulta',
          default: 'Presencial'
        },
        reason: {
          type: 'string',
          description: 'Motivo de la consulta'
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales (opcional)'
        },
        priority_level: {
          type: 'string',
          enum: ['Baja', 'Normal', 'Alta', 'Urgente'],
          description: 'Nivel de prioridad de la cita',
          default: 'Normal'
        }
      },
      required: ['patient_id', 'availability_id', 'scheduled_date', 'reason']
    }
  },
  {
    name: 'getPatientAppointments',
    description: 'Consulta todas las citas de un paciente (pasadas y futuras) con detalles completos de médico, especialidad, ubicación y estado.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'number',
          description: 'ID del paciente'
        },
        status: {
          type: 'string',
          enum: ['Pendiente', 'Confirmada', 'Completada', 'Cancelada', 'Todas'],
          description: 'Filtrar por estado de la cita (opcional)',
          default: 'Todas'
        },
        from_date: {
          type: 'string',
          description: 'Fecha desde (formato YYYY-MM-DD, opcional)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'getWaitingListAppointments',
    description: 'Consulta las solicitudes de citas en lista de espera. Permite filtrar por paciente, médico, especialidad o ubicación. Muestra la posición en la cola y tiempo de espera.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'number',
          description: 'ID del paciente (opcional, filtra por paciente específico)'
        },
        doctor_id: {
          type: 'number',
          description: 'ID del médico (opcional, filtra por doctor)'
        },
        specialty_id: {
          type: 'number',
          description: 'ID de la especialidad (opcional, filtra por especialidad)'
        },
        location_id: {
          type: 'number',
          description: 'ID de la ubicación (opcional, filtra por sede)'
        },
        priority_level: {
          type: 'string',
          enum: ['Baja', 'Normal', 'Alta', 'Urgente', 'Todas'],
          description: 'Filtrar por nivel de prioridad (opcional)',
          default: 'Todas'
        },
        status: {
          type: 'string',
          enum: ['pending', 'reassigned', 'cancelled', 'expired', 'all'],
          description: 'Estado de la solicitud en lista de espera',
          default: 'pending'
        },
        limit: {
          type: 'number',
          description: 'Número máximo de resultados (default: 50)',
          default: 50
        }
      },
      required: []
    }
  },
  {
    name: 'reassignWaitingListAppointments',
    description: 'Procesa automáticamente la lista de espera para una disponibilidad específica. Reasigna citas pendientes a cupos disponibles según prioridad (Urgente > Alta > Normal > Baja).',
    inputSchema: {
      type: 'object',
      properties: {
        availability_id: {
          type: 'number',
          description: 'ID de la disponibilidad a procesar'
        }
      },
      required: ['availability_id']
    }
  }
];

// ===================================================================
// IMPLEMENTACIÓN DE HERRAMIENTAS
// ===================================================================
async function executeToolCall(name: string, args: any): Promise<any> {
  try {
    if (name === 'listActiveEPS') {
      return await listActiveEPS();
    }
    
    if (name === 'registerPatientSimple') {
      return await registerPatientSimple(args);
    }
    
    if (name === 'getAvailableAppointments') {
      return await getAvailableAppointments(args);
    }
    
    if (name === 'checkAvailabilityQuota') {
      return await checkAvailabilityQuota(args);
    }
    
    if (name === 'scheduleAppointment') {
      return await scheduleAppointment(args);
    }
    
    if (name === 'getPatientAppointments') {
      return await getPatientAppointments(args);
    }
    
    if (name === 'getWaitingListAppointments') {
      return await getWaitingListAppointments(args);
    }
    
    if (name === 'reassignWaitingListAppointments') {
      return await reassignWaitingListAppointments(args);
    }
    
    throw new Error(`Herramienta no implementada: ${name}`);
  } catch (error: any) {
    console.error(`Error ejecutando ${name}:`, error);
    throw new Error(`Error en ${name}: ${error.message}`);
  }
}

// ===================================================================
// FUNCIÓN PARA LISTAR EPS ACTIVAS
// ===================================================================
async function listActiveEPS(): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        id,
        name,
        code,
        status,
        has_agreement,
        agreement_date,
        notes,
        created_at
      FROM eps 
      WHERE status = 'active'
      ORDER BY name ASC
    `);
    
    const epsList = (rows as any[]).map(eps => ({
      id: eps.id,
      name: eps.name,
      code: eps.code,
      has_agreement: eps.has_agreement === 1,
      agreement_date: eps.agreement_date,
      notes: eps.notes || '',
      created_at: eps.created_at
    }));
    
    return {
      success: true,
      count: epsList.length,
      eps_list: epsList,
      message: `Se encontraron ${epsList.length} EPS activas disponibles`,
      usage_note: 'Use el campo "id" para registrar pacientes con registerPatientSimple'
    };
    
  } catch (error: any) {
    console.error('Error consultando EPS:', error);
    return {
      success: false,
      error: 'Error al consultar EPS activas',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN DE REGISTRO SIMPLIFICADO DE PACIENTES
// ===================================================================
async function registerPatientSimple(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 1. Validar duplicados
    const [duplicates] = await connection.execute(`
      SELECT id, document, name, phone, status
      FROM patients 
      WHERE document = ? AND status = 'Activo'
      LIMIT 1
    `, [args.document]);
    
    if ((duplicates as any[]).length > 0) {
      const duplicate = (duplicates as any[])[0];
      await connection.rollback();
      return {
        success: false,
        error: 'Paciente duplicado encontrado',
        duplicate_patient: {
          id: duplicate.id,
          document: duplicate.document,
          name: duplicate.name,
          phone: duplicate.phone
        },
        suggestion: 'Ya existe un paciente activo con este documento'
      };
    }
    
    // 2. Verificar que la EPS existe
    const [epsCheck] = await connection.execute(`
      SELECT id, name FROM eps WHERE id = ? AND status = 'active'
    `, [args.insurance_eps_id]);
    
    if ((epsCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'EPS no válida',
        available_eps: 'Use IDs entre 1-17. Principales: 1=NUEVA EPS, 2=SANITAS, 3=SURA, 4=SALUD TOTAL'
      };
    }
    
    // 3. Insertar paciente con datos mínimos
    const [result] = await connection.execute(`
      INSERT INTO patients (
        document, name, phone, insurance_eps_id, 
        notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'Activo', NOW())
    `, [
      args.document,
      args.name.trim(),
      args.phone,
      args.insurance_eps_id,
      args.notes || null
    ]);
    
    const patient_id = (result as any).insertId;
    await connection.commit();
    
    // 4. Obtener datos del paciente creado
    const [patientData] = await connection.execute(`
      SELECT 
        p.id, p.document, p.name, p.phone, p.status, p.created_at,
        eps.name as eps_name, eps.code as eps_code
      FROM patients p
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      WHERE p.id = ?
    `, [patient_id]);
    
    const patient = (patientData as any[])[0];
    
    return {
      success: true,
      message: 'Paciente registrado exitosamente',
      patient_id: patient_id,
      patient: {
        id: patient.id,
        document: patient.document,
        name: patient.name,
        phone: patient.phone,
        eps: patient.eps_name,
        eps_code: patient.eps_code,
        status: patient.status,
        created_at: patient.created_at
      }
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error registrando paciente:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        error: 'Documento duplicado'
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: CONSULTAR CITAS DISPONIBLES (AGRUPADAS POR ESPECIALIDAD)
// ===================================================================
async function getAvailableAppointments(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { doctor_id, specialty_id, location_id, limit = 50 } = args;
    
    // Query base que obtiene availabilities activas
    let query = `
      SELECT 
        a.id as availability_id,
        a.date as appointment_date,
        a.start_time,
        a.end_time,
        a.duration_minutes,
        a.capacity as total_capacity,
        a.status as availability_status,
        d.id as doctor_id,
        d.name as doctor_name,
        d.email as doctor_email,
        d.phone as doctor_phone,
        s.id as specialty_id,
        s.name as specialty_name,
        l.id as location_id,
        l.name as location_name,
        l.address as location_address,
        l.phone as location_phone,
        SUM(ad.quota) as total_quota_distributed,
        SUM(ad.assigned) as total_assigned,
        SUM(ad.quota - ad.assigned) as slots_available,
        COUNT(ad.id) as distribution_count,
        COALESCE((
          SELECT COUNT(*)
          FROM appointments_waiting_list wl
          WHERE wl.availability_id = a.id AND wl.status = 'pending'
        ), 0) as waiting_list_count
      FROM availabilities a
      INNER JOIN availability_distribution ad ON a.id = ad.availability_id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE a.date >= CURDATE()
        AND a.status = 'Activa'
    `;
    
    const params: any[] = [];
    
    if (doctor_id) {
      query += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }
    
    if (specialty_id) {
      query += ' AND a.specialty_id = ?';
      params.push(specialty_id);
    }
    
    if (location_id) {
      query += ' AND a.location_id = ?';
      params.push(location_id);
    }
    
    query += ` 
      GROUP BY a.id, a.date, a.start_time, a.end_time, a.duration_minutes, a.capacity, a.status,
               d.id, d.name, d.email, d.phone,
               s.id, s.name,
               l.id, l.name, l.address, l.phone
      ORDER BY s.name, l.name, a.date, a.start_time
      LIMIT ?
    `;
    params.push(limit);
    
    const [rows] = await connection.execute(query, params);
    const appointments = rows as any[];
    
    if (appointments.length === 0) {
      return {
        success: true,
        message: 'No hay agendas programadas con los filtros aplicados',
        count: 0,
        specialties: [],
        available_appointments: []
      };
    }
    
    // ===================================================================
    // AGRUPACIÓN POR ESPECIALIDAD + SEDE
    // ===================================================================
    
    const groupedBySpecialtyLocation: any = {};
    
    appointments.forEach(apt => {
      // Clave: especialidad + sede
      const groupKey = `specialty${apt.specialty_id}_location${apt.location_id}`;
      
      if (!groupedBySpecialtyLocation[groupKey]) {
        groupedBySpecialtyLocation[groupKey] = {
          specialty: {
            id: apt.specialty_id,
            name: apt.specialty_name
          },
          location: {
            id: apt.location_id,
            name: apt.location_name,
            address: apt.location_address,
            phone: apt.location_phone
          },
          doctors: [],
          availabilities: [],
          total_slots_available: 0,
          total_waiting_list: 0,
          earliest_date: apt.appointment_date,
          has_direct_availability: false
        };
      }
      
      // Agregar availability
      groupedBySpecialtyLocation[groupKey].availabilities.push({
        availability_id: apt.availability_id,
        appointment_date: apt.appointment_date,
        time_range: `${apt.start_time.slice(0,5)} - ${apt.end_time.slice(0,5)}`,
        start_time: apt.start_time.slice(0,5),
        end_time: apt.end_time.slice(0,5),
        duration_minutes: apt.duration_minutes,
        doctor: {
          id: apt.doctor_id,
          name: apt.doctor_name
        },
        slots_available: apt.slots_available,
        waiting_list_count: apt.waiting_list_count || 0
      });
      
      // Agregar doctor (sin duplicar)
      const doctorExists = groupedBySpecialtyLocation[groupKey].doctors.some(
        (d: any) => d.id === apt.doctor_id
      );
      if (!doctorExists) {
        groupedBySpecialtyLocation[groupKey].doctors.push({
          id: apt.doctor_id,
          name: apt.doctor_name,
          email: apt.doctor_email,
          phone: apt.doctor_phone
        });
      }
      
      groupedBySpecialtyLocation[groupKey].total_slots_available += apt.slots_available;
      groupedBySpecialtyLocation[groupKey].total_waiting_list += (apt.waiting_list_count || 0);
      
      if (apt.slots_available > 0) {
        groupedBySpecialtyLocation[groupKey].has_direct_availability = true;
      }
      
      // Actualizar fecha más temprana
      if (apt.appointment_date < groupedBySpecialtyLocation[groupKey].earliest_date) {
        groupedBySpecialtyLocation[groupKey].earliest_date = apt.appointment_date;
      }
    });
    
    // Convertir a array y ordenar
    const specialtiesArray = Object.values(groupedBySpecialtyLocation).map((group: any) => {
      // Ordenar availabilities por fecha y hora
      group.availabilities.sort((a: any, b: any) => {
        if (a.appointment_date !== b.appointment_date) {
          return a.appointment_date.getTime() - b.appointment_date.getTime();
        }
        return a.start_time.localeCompare(b.start_time);
      });
      
      // Formatear earliest_date
      group.earliest_date = group.earliest_date.toISOString().split('T')[0];
      
      return group;
    });
    
    // Ordenar por especialidad
    specialtiesArray.sort((a: any, b: any) => 
      a.specialty.name.localeCompare(b.specialty.name)
    );
    
    // Extraer lista única de especialidades
    const uniqueSpecialties = Array.from(
      new Set(specialtiesArray.map((g: any) => g.specialty.name))
    ).sort();
    
    // Formato plano para compatibilidad
    const formattedAppointments = appointments.map(apt => ({
      availability_id: apt.availability_id,
      appointment_date: apt.appointment_date,
      time_range: `${apt.start_time.slice(0,5)} - ${apt.end_time.slice(0,5)}`,
      duration_minutes: apt.duration_minutes,
      slots_available: apt.slots_available,
      waiting_list_count: apt.waiting_list_count || 0,
      doctor_id: apt.doctor_id,
      doctor_name: apt.doctor_name,
      specialty_id: apt.specialty_id,
      specialty_name: apt.specialty_name,
      location_id: apt.location_id,
      location_name: apt.location_name
    }));
    
    return {
      success: true,
      message: `Se encontraron ${uniqueSpecialties.length} especialidades con agendas disponibles`,
      count: appointments.length,
      specialties_count: uniqueSpecialties.length,
      specialties_list: uniqueSpecialties,
      specialties: specialtiesArray,
      available_appointments: formattedAppointments,
      info: {
        grouping: 'Agrupado por ESPECIALIDAD + SEDE',
        specialty_focus: 'Cada especialidad muestra todas sus sedes y doctores disponibles',
        slots_available_info: 'slots_available=0 permite lista de espera automática',
        usage: 'Use specialty_id + location_id para verificar cupos con checkAvailabilityQuota'
      }
    };
    
  } catch (error: any) {
    console.error('Error consultando citas disponibles:', error);
    return {
      success: false,
      error: 'Error al consultar citas disponibles',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: VERIFICAR CUPOS DISPONIBLES POR ESPECIALIDAD Y SEDE
// VERSIÓN 3.5: Agrupado por ESPECIALIDAD + SEDE (no por availability_id individual)
// ===================================================================
async function checkAvailabilityQuota(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { specialty_id, location_id, day_date } = args;
    
    if (!specialty_id || !location_id) {
      return {
        success: false,
        error: 'specialty_id y location_id son requeridos'
      };
    }
    
    // 1. Obtener información de la especialidad y sede
    const [specialtyInfo] = await connection.execute(`
      SELECT 
        s.id as specialty_id,
        s.name as specialty_name,
        l.id as location_id,
        l.name as location_name,
        l.address as location_address,
        l.phone as location_phone
      FROM specialties s
      CROSS JOIN locations l
      WHERE s.id = ? AND l.id = ?
    `, [specialty_id, location_id]);
    
    if ((specialtyInfo as any[]).length === 0) {
      return {
        success: false,
        error: 'Especialidad o sede no encontrada'
      };
    }
    
    const info = (specialtyInfo as any[])[0];
    
    // 2. Obtener TODAS las availabilities de esta especialidad en esta sede
    let availQuery = `
      SELECT 
        a.id as availability_id,
        a.date as appointment_date,
        a.start_time,
        a.end_time,
        a.duration_minutes,
        a.capacity as total_capacity,
        d.id as doctor_id,
        d.name as doctor_name,
        d.email as doctor_email
      FROM availabilities a
      INNER JOIN doctors d ON a.doctor_id = d.id
      WHERE a.specialty_id = ? 
        AND a.location_id = ? 
        AND a.status = 'Activa'
    `;
    
    const queryParams: any[] = [specialty_id, location_id];
    
    if (day_date) {
      availQuery += ' AND a.date >= ?';
      queryParams.push(day_date);
    }
    
    availQuery += ' ORDER BY a.date ASC, a.start_time ASC';
    
    const [availabilities] = await connection.execute(availQuery, queryParams);
    const availArray = availabilities as any[];
    
    if (availArray.length === 0) {
      return {
        success: false,
        error: 'No hay agendas activas para esta especialidad en esta sede',
        specialty: { id: info.specialty_id, name: info.specialty_name },
        location: { id: info.location_id, name: info.location_name },
        suggestion: 'Intente con otra sede o consulte las especialidades disponibles'
      };
    }
    
    // 3. Para cada availability, obtener su distribución de cupos
    const availabilityIds = availArray.map(a => a.availability_id);
    
    let distQuery = `
      SELECT 
        availability_id,
        day_date,
        quota,
        assigned,
        (quota - assigned) as slots_available
      FROM availability_distribution
      WHERE availability_id IN (${availabilityIds.map(() => '?').join(',')})
    `;
    
    const distParams = [...availabilityIds];
    
    if (day_date) {
      distQuery += ' AND day_date >= ?';
      distParams.push(day_date);
    }
    
    const [distributions] = await connection.execute(distQuery, distParams);
    const distArray = distributions as any[];
    
    // 4. Calcular totales agregados por especialidad+sede
    let totalQuota = 0;
    let totalAssigned = 0;
    let totalAvailable = 0;
    
    const distributionsByAvailability: any = {};
    
    distArray.forEach((dist: any) => {
      totalQuota += dist.quota;
      totalAssigned += dist.assigned;
      totalAvailable += dist.slots_available;
      
      if (!distributionsByAvailability[dist.availability_id]) {
        distributionsByAvailability[dist.availability_id] = [];
      }
      distributionsByAvailability[dist.availability_id].push(dist);
    });
    
    // 5. Contar lista de espera para esta especialidad+sede
    const [waitingList] = await connection.execute(`
      SELECT COUNT(*) as waiting_count
      FROM appointments_waiting_list wl
      INNER JOIN availabilities a ON wl.availability_id = a.id
      WHERE a.specialty_id = ? 
        AND a.location_id = ? 
        AND wl.status = 'pending'
    `, [specialty_id, location_id]);
    
    const waitingCount = (waitingList as any[])[0].waiting_count;
    
    // 6. Obtener doctores únicos
    const uniqueDoctors = Array.from(new Set(availArray.map(a => a.doctor_name)));
    
    // 7. Construir información detallada de availabilities con cupos
    const availabilitiesWithQuota = availArray.map(avail => {
      const dists = distributionsByAvailability[avail.availability_id] || [];
      const availQuota = dists.reduce((sum: number, d: any) => sum + d.quota, 0);
      const availAssigned = dists.reduce((sum: number, d: any) => sum + d.assigned, 0);
      const availAvailable = availQuota - availAssigned;
      
      return {
        availability_id: avail.availability_id,
        appointment_date: avail.appointment_date,
        time_range: `${avail.start_time.slice(0, 5)} - ${avail.end_time.slice(0, 5)}`,
        doctor: {
          id: avail.doctor_id,
          name: avail.doctor_name
        },
        quota: availQuota,
        assigned: availAssigned,
        slots_available: availAvailable,
        has_availability: availAvailable > 0
      };
    });
    
    // 8. Determinar si puede agendar directamente o debe ir a lista de espera
    const canScheduleDirect = totalAvailable > 0;
    const hasAnyAvailability = availabilitiesWithQuota.some(a => a.has_availability);
    
    // 9. Seleccionar primera availability con cupos (para recomendación)
    const recommendedAvailability = availabilitiesWithQuota.find(a => a.has_availability);
    
    return {
      success: true,
      specialty: {
        id: info.specialty_id,
        name: info.specialty_name
      },
      location: {
        id: info.location_id,
        name: info.location_name,
        address: info.location_address,
        phone: info.location_phone
      },
      doctors_available: uniqueDoctors.length,
      doctors_list: uniqueDoctors,
      total_availabilities: availArray.length,
      quota_summary: {
        total_quota: totalQuota,
        total_assigned: totalAssigned,
        total_available: totalAvailable,
        waiting_list_count: waitingCount
      },
      availabilities: availabilitiesWithQuota,
      recommendation: {
        can_schedule_direct: canScheduleDirect,
        should_use_waiting_list: !canScheduleDirect,
        suggested_availability_id: recommendedAvailability?.availability_id || availabilitiesWithQuota[0]?.availability_id,
        action: canScheduleDirect 
          ? 'Proceder con scheduleAppointment (sin priority_level)' 
          : 'Proceder con scheduleAppointment (incluir priority_level: "Normal")',
        message: canScheduleDirect
          ? `Puede agendar cita directa.`
          : 'Se procesará solicitud. Operador contactará al paciente.'
      },
      info: {
        grouping: 'Agregado por ESPECIALIDAD + SEDE',
        scope: 'Incluye TODOS los doctores de esta especialidad en esta sede',
        usage: 'Use suggested_availability_id para agendar con scheduleAppointment'
      }
    };
    
  } catch (error: any) {
    console.error('Error verificando cupos disponibles:', error);
    return {
      success: false,
      error: 'Error al verificar cupos disponibles',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: AGENDAR CITA
// ===================================================================
async function scheduleAppointment(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { 
      patient_id, 
      availability_id, 
      scheduled_date,
      appointment_type = 'Presencial',
      reason,
      notes,
      priority_level = 'Normal'
    } = args;
    
    // 1. Validar que el paciente existe
    const [patientCheck] = await connection.execute(
      'SELECT id, name, document FROM patients WHERE id = ? AND status = "Activo"',
      [patient_id]
    );
    
    if ((patientCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Paciente no encontrado o inactivo'
      };
    }
    
    const patient = (patientCheck as any[])[0];
    
    // 2. Obtener información de disponibilidad
    const [availCheck] = await connection.execute(`
      SELECT 
        a.id, a.date, a.start_time, a.end_time, a.duration_minutes,
        a.location_id, a.specialty_id, a.doctor_id,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM availabilities a
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE a.id = ? AND a.status = 'Activa'
    `, [availability_id]);
    
    if ((availCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Disponibilidad no encontrada o inactiva'
      };
    }
    
    const availability = (availCheck as any[])[0];
    
    // 3. Extraer día de scheduled_date para verificar distribución
    const scheduledDateTime = scheduled_date; // "2025-10-15 09:00:00"
    const appointmentDate = scheduled_date.split(' ')[0]; // "2025-10-15"
    
    // 4. Verificar que la fecha de la cita coincida con la disponibilidad
    const availabilityDate = availability.date.toISOString().split('T')[0];
    if (appointmentDate !== availabilityDate) {
      await connection.rollback();
      return {
        success: false,
        error: `La fecha de la cita (${appointmentDate}) no coincide con la disponibilidad del doctor (${availabilityDate})`
      };
    }
    
    // 5. Verificar cupo disponible en availability_distribution
    // Buscar por availability_id (puede haber múltiples day_date para la misma availability)
    const [distCheck] = await connection.execute(`
      SELECT id, day_date, quota, assigned, (quota - assigned) as available
      FROM availability_distribution
      WHERE availability_id = ?
      ORDER BY (quota - assigned) DESC
      LIMIT 1
    `, [availability_id]);
    
    if ((distCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'No hay distribución de disponibilidad para esta cita',
        suggestion: 'Contacte al administrador para crear la distribución de cupos'
      };
    }
    
    const distribution = (distCheck as any[])[0];
    
    // **NUEVA LÓGICA**: Si no hay cupos, guardar en lista de espera
    if (distribution.available <= 0) {
      // Insertar en appointments_waiting_list en lugar de rechazar
      // La fecha programada puede ser flexible, se asignará cuando haya cupo
      const [waitingInsert] = await connection.execute(`
        INSERT INTO appointments_waiting_list (
          patient_id,
          availability_id,
          scheduled_date,
          appointment_type,
          reason,
          notes,
          priority_level,
          status,
          requested_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'Sistema_MCP', NOW())
      `, [
        patient_id,
        availability_id,
        scheduledDateTime,
        appointment_type,
        reason,
        notes || null,
        priority_level
      ]);
      
      const waiting_list_id = (waitingInsert as any).insertId;
      
      // Contar cuántas personas están esperando para esta ESPECIALIDAD (no solo esta availability)
      const [countResult] = await connection.execute(`
        SELECT COUNT(*) as total_waiting
        FROM appointments_waiting_list wl
        INNER JOIN availabilities a ON wl.availability_id = a.id
        WHERE a.specialty_id = ? 
          AND wl.status = 'pending'
      `, [availability.specialty_id]);
      
      const totalWaiting = (countResult as any[])[0].total_waiting;
      
      // Calcular posición en la cola según prioridad
      const [queueResult] = await connection.execute(`
        SELECT COUNT(*) + 1 as queue_position
        FROM appointments_waiting_list wl
        INNER JOIN availabilities a ON wl.availability_id = a.id
        WHERE a.specialty_id = ?
          AND wl.status = 'pending'
          AND (
            (wl.priority_level = 'Urgente' AND ? != 'Urgente')
            OR (wl.priority_level = 'Alta' AND ? NOT IN ('Urgente', 'Alta'))
            OR (wl.priority_level = 'Normal' AND ? = 'Baja')
            OR (wl.priority_level = ? AND wl.created_at < NOW())
          )
      `, [availability.specialty_id, priority_level, priority_level, priority_level, priority_level]);
      
      const queuePosition = (queueResult as any[])[0].queue_position;
      
      await connection.commit();
      
      return {
        success: true,
        waiting_list: true,
        message: 'No hay cupos disponibles. Ha sido agregado a la lista de espera prioritaria',
        waiting_list_id: waiting_list_id,
        queue_position: queuePosition,
        total_waiting_specialty: totalWaiting,
        patient: {
          id: patient.id,
          name: patient.name,
          document: patient.document
        },
        requested_for: {
          appointment_type: appointment_type,
          priority_level: priority_level,
          reason: reason,
          specialty: {
            id: availability.specialty_id,
            name: availability.specialty_name
          },
          location: {
            id: availability.location_id,
            name: availability.location_name
          }
        },
        info: `Ha sido agregado a la lista de espera para ${availability.specialty_name} con prioridad ${priority_level}. Una operadora se comunicará con usted cuando haya disponibilidad.`,
        next_steps: 'Una de nuestras operadoras se comunicará con usted tan pronto tengamos una cita disponible para confirmarle la fecha y hora.'
      };
    }
    
    // 6. Verificar que el paciente no tenga cita duplicada en la misma fecha/hora
    const [dupCheck] = await connection.execute(`
      SELECT id FROM appointments
      WHERE patient_id = ? 
        AND scheduled_at = ?
        AND status IN ('Pendiente', 'Confirmada')
    `, [patient_id, scheduledDateTime]);
    
    if ((dupCheck as any[]).length > 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'El paciente ya tiene una cita agendada en este horario'
      };
    }
    
    // 7. Insertar la cita en appointments
    const [insertResult] = await connection.execute(`
      INSERT INTO appointments (
        patient_id,
        availability_id,
        location_id,
        specialty_id,
        doctor_id,
        scheduled_at,
        duration_minutes,
        appointment_type,
        status,
        reason,
        notes,
        priority_level,
        appointment_source,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Confirmada', ?, ?, ?, 'Sistema_Inteligente', NOW())
    `, [
      patient_id,
      availability_id,
      availability.location_id,
      availability.specialty_id,
      availability.doctor_id,
      scheduledDateTime, // Fecha y hora completa de la cita
      availability.duration_minutes,
      appointment_type,
      reason,
      notes || null,
      priority_level
    ]);
    
    const appointment_id = (insertResult as any).insertId;
    
    // 8. Actualizar availability_distribution (incrementar assigned)
    await connection.execute(`
      UPDATE availability_distribution
      SET assigned = assigned + 1
      WHERE id = ?
    `, [distribution.id]);
    
    await connection.commit();
    
    // 9. Retornar confirmación con información clara
    return {
      success: true,
      message: 'Cita agendada exitosamente',
      appointment_id: appointment_id,
      appointment: {
        id: appointment_id,
        patient: {
          id: patient.id,
          name: patient.name,
          document: patient.document
        },
        scheduled_at: scheduledDateTime, // Fecha y hora de la cita
        appointment_date: appointmentDate, // Solo fecha de la cita
        duration_minutes: availability.duration_minutes,
        appointment_type: appointment_type,
        status: 'Confirmada',
        doctor: {
          id: availability.doctor_id,
          name: availability.doctor_name
        },
        specialty: {
          id: availability.specialty_id,
          name: availability.specialty_name
        },
        location: {
          id: availability.location_id,
          name: availability.location_name
        },
        reason: reason,
        priority_level: priority_level
      },
      availability_info: {
        distribution_date: distribution.day_date, // Fecha en que se distribuyeron cupos
        quota: distribution.quota,
        assigned: distribution.assigned + 1,
        remaining: distribution.available - 1
      },
      info: 'La cita fue registrada y el cupo actualizado exitosamente'
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error agendando cita:', error);
    return {
      success: false,
      error: 'Error al agendar la cita',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: CONSULTAR CITAS DEL PACIENTE
// ===================================================================
async function getPatientAppointments(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { patient_id, status = 'Todas', from_date } = args;
    
    // Construir query con filtros
    let query = `
      SELECT 
        a.id,
        a.scheduled_at,
        a.duration_minutes,
        a.appointment_type,
        a.status,
        a.reason,
        a.notes,
        a.priority_level,
        a.created_at,
        d.id as doctor_id,
        d.name as doctor_name,
        s.id as specialty_id,
        s.name as specialty_name,
        l.id as location_id,
        l.name as location_name,
        l.address as location_address,
        l.phone as location_phone
      FROM appointments a
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE a.patient_id = ?
    `;
    
    const params: any[] = [patient_id];
    
    if (status !== 'Todas') {
      query += ' AND a.status = ?';
      params.push(status);
    }
    
    if (from_date) {
      query += ' AND DATE(a.scheduled_at) >= ?';
      params.push(from_date);
    }
    
    query += ' ORDER BY a.scheduled_at DESC';
    
    const [rows] = await connection.execute(query, params);
    const appointments = rows as any[];
    
    if (appointments.length === 0) {
      return {
        success: true,
        message: 'No se encontraron citas para este paciente',
        count: 0,
        appointments: []
      };
    }
    
    const formattedAppointments = appointments.map(apt => ({
      id: apt.id,
      scheduled_at: apt.scheduled_at,
      duration_minutes: apt.duration_minutes,
      appointment_type: apt.appointment_type,
      status: apt.status,
      reason: apt.reason,
      notes: apt.notes,
      priority_level: apt.priority_level,
      created_at: apt.created_at,
      doctor: {
        id: apt.doctor_id,
        name: apt.doctor_name
      },
      specialty: {
        id: apt.specialty_id,
        name: apt.specialty_name
      },
      location: {
        id: apt.location_id,
        name: apt.location_name,
        address: apt.location_address,
        phone: apt.location_phone
      }
    }));
    
    // Clasificar citas
    const now = new Date();
    const upcoming = formattedAppointments.filter(apt => 
      new Date(apt.scheduled_at) > now && 
      ['Pendiente', 'Confirmada'].includes(apt.status)
    );
    
    const past = formattedAppointments.filter(apt => 
      new Date(apt.scheduled_at) <= now ||
      ['Completada', 'Cancelada'].includes(apt.status)
    );
    
    return {
      success: true,
      message: `Se encontraron ${appointments.length} citas`,
      count: appointments.length,
      summary: {
        total: appointments.length,
        upcoming: upcoming.length,
        past: past.length,
        by_status: {
          pendiente: appointments.filter(a => a.status === 'Pendiente').length,
          confirmada: appointments.filter(a => a.status === 'Confirmada').length,
          completada: appointments.filter(a => a.status === 'Completada').length,
          cancelada: appointments.filter(a => a.status === 'Cancelada').length
        }
      },
      upcoming_appointments: upcoming,
      past_appointments: past
    };
    
  } catch (error: any) {
    console.error('Error consultando citas del paciente:', error);
    return {
      success: false,
      error: 'Error al consultar citas del paciente',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: CONSULTAR LISTA DE ESPERA
// ===================================================================
async function getWaitingListAppointments(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { 
      patient_id,
      doctor_id,
      specialty_id,
      location_id,
      priority_level = 'Todas',
      status = 'pending',
      limit = 50
    } = args;
    
    // Construir query con filtros
    let query = `
      SELECT 
        wl.id as waiting_list_id,
        wl.status,
        wl.priority_level,
        wl.scheduled_date as requested_date,
        wl.appointment_type,
        wl.reason,
        wl.notes,
        wl.created_at as added_to_waiting_list_at,
        wl.expires_at,
        DATEDIFF(wl.expires_at, NOW()) as days_until_expiration,
        wl.reassigned_at,
        wl.reassigned_appointment_id,
        
        -- Información del paciente
        p.id as patient_id,
        p.name as patient_name,
        p.document as patient_document,
        p.phone as patient_phone,
        p.email as patient_email,
        
        -- Información de la disponibilidad
        a.id as availability_id,
        a.date as availability_date,
        a.start_time,
        a.end_time,
        a.duration_minutes,
        a.capacity as total_capacity,
        
        -- Cupos actuales
        (
          SELECT COUNT(*)
          FROM appointments app
          WHERE app.availability_id = a.id 
            AND app.status IN ('Pendiente', 'Confirmada')
        ) as current_appointments_count,
        (
          a.capacity - (
            SELECT COUNT(*)
            FROM appointments app
            WHERE app.availability_id = a.id 
              AND app.status IN ('Pendiente', 'Confirmada')
          )
        ) as slots_currently_available,
        
        -- Información del doctor
        d.id as doctor_id,
        d.name as doctor_name,
        d.email as doctor_email,
        
        -- Información de la especialidad
        s.id as specialty_id,
        s.name as specialty_name,
        
        -- Información de la ubicación
        l.id as location_id,
        l.name as location_name,
        l.address as location_address,
        
        -- Posición en la cola (por ESPECIALIDAD, no por availability específico)
        (
          SELECT COUNT(*) + 1
          FROM appointments_waiting_list wl2
          INNER JOIN availabilities a2 ON wl2.availability_id = a2.id
          WHERE a2.specialty_id = s.id
            AND wl2.status = 'pending'
            AND (
              (wl2.priority_level = 'Urgente' AND wl.priority_level != 'Urgente')
              OR (wl2.priority_level = 'Alta' AND wl.priority_level NOT IN ('Urgente', 'Alta'))
              OR (wl2.priority_level = 'Normal' AND wl.priority_level = 'Baja')
              OR (wl2.priority_level = wl.priority_level AND wl2.created_at < wl.created_at)
            )
        ) as queue_position
      
      FROM appointments_waiting_list wl
      INNER JOIN patients p ON wl.patient_id = p.id
      INNER JOIN availabilities a ON wl.availability_id = a.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (patient_id) {
      query += ' AND wl.patient_id = ?';
      params.push(patient_id);
    }
    
    if (doctor_id) {
      query += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }
    
    if (specialty_id) {
      query += ' AND a.specialty_id = ?';
      params.push(specialty_id);
    }
    
    if (location_id) {
      query += ' AND a.location_id = ?';
      params.push(location_id);
    }
    
    if (priority_level !== 'Todas') {
      query += ' AND wl.priority_level = ?';
      params.push(priority_level);
    }
    
    if (status !== 'all') {
      query += ' AND wl.status = ?';
      params.push(status);
    }
    
    query += ` 
      ORDER BY 
        CASE wl.priority_level
          WHEN 'Urgente' THEN 1
          WHEN 'Alta' THEN 2
          WHEN 'Normal' THEN 3
          WHEN 'Baja' THEN 4
        END,
        wl.created_at ASC
      LIMIT ?
    `;
    params.push(limit);
    
    const [rows] = await connection.execute(query, params);
    const waitingList = rows as any[];
    
    if (waitingList.length === 0) {
      return {
        success: true,
        message: 'No hay solicitudes en lista de espera con los filtros aplicados',
        count: 0,
        waiting_list: [],
        filters_applied: {
          patient_id: patient_id || 'Ninguno',
          doctor_id: doctor_id || 'Ninguno',
          specialty_id: specialty_id || 'Ninguno',
          location_id: location_id || 'Ninguno',
          priority_level: priority_level,
          status: status,
          limit: limit
        }
      };
    }
    
    const formattedWaitingList = waitingList.map(item => ({
      waiting_list_id: item.waiting_list_id,
      queue_position: item.queue_position,
      status: item.status,
      priority_level: item.priority_level,
      requested_date: item.requested_date,
      appointment_type: item.appointment_type,
      reason: item.reason,
      notes: item.notes,
      added_to_waiting_list_at: item.added_to_waiting_list_at,
      days_waiting: Math.floor((Date.now() - new Date(item.added_to_waiting_list_at).getTime()) / (1000 * 60 * 60 * 24)),
      patient: {
        id: item.patient_id,
        name: item.patient_name,
        document: item.patient_document,
        phone: item.patient_phone,
        email: item.patient_email
      },
      availability: {
        id: item.availability_id,
        date: item.availability_date,
        time_range: `${item.start_time.slice(0,5)} - ${item.end_time.slice(0,5)}`,
        duration_minutes: item.duration_minutes,
        total_capacity: item.total_capacity,
        current_appointments: item.current_appointments_count,
        slots_currently_available: item.slots_currently_available,
        can_be_reassigned: item.slots_currently_available > 0
      },
      doctor: {
        id: item.doctor_id,
        name: item.doctor_name,
        email: item.doctor_email
      },
      specialty: {
        id: item.specialty_id,
        name: item.specialty_name
      },
      location: {
        id: item.location_id,
        name: item.location_name,
        address: item.location_address
      },
      reassignment_info: item.status === 'reassigned' ? {
        reassigned_at: item.reassigned_at,
        appointment_id: item.reassigned_appointment_id
      } : null
    }));
    
    // Estadísticas
    const stats = {
      total_waiting: waitingList.length,
      by_priority: {
        urgente: waitingList.filter(w => w.priority_level === 'Urgente').length,
        alta: waitingList.filter(w => w.priority_level === 'Alta').length,
        normal: waitingList.filter(w => w.priority_level === 'Normal').length,
        baja: waitingList.filter(w => w.priority_level === 'Baja').length
      },
      can_be_reassigned_now: waitingList.filter(w => w.slots_currently_available > 0).length
    };
    
    return {
      success: true,
      message: `Se encontraron ${waitingList.length} solicitudes en lista de espera`,
      count: waitingList.length,
      waiting_list: formattedWaitingList,
      statistics: stats,
      filters_applied: {
        patient_id: patient_id || 'Ninguno',
        doctor_id: doctor_id || 'Ninguno',
        specialty_id: specialty_id || 'Ninguno',
        location_id: location_id || 'Ninguno',
        priority_level: priority_level,
        status: status,
        limit: limit
      },
      info: {
        queue_order: 'Las solicitudes están ordenadas por prioridad (Urgente > Alta > Normal > Baja) y luego por antigüedad',
        reassignment: 'Use reassignWaitingListAppointments para procesar automáticamente cuando haya cupos disponibles'
      }
    };
    
  } catch (error: any) {
    console.error('Error consultando lista de espera:', error);
    return {
      success: false,
      error: 'Error al consultar lista de espera',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: REASIGNAR DESDE LISTA DE ESPERA
// ===================================================================
async function reassignWaitingListAppointments(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { availability_id } = args;
    
    // Verificar que la disponibilidad existe
    const [availCheck] = await connection.execute(`
      SELECT 
        a.id, a.date, a.start_time, a.end_time,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name,
        a.capacity,
        (
          SELECT COUNT(*)
          FROM appointments app
          WHERE app.availability_id = a.id 
            AND app.status IN ('Pendiente', 'Confirmada')
        ) as current_appointments
      FROM availabilities a
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `, [availability_id]);
    
    if ((availCheck as any[]).length === 0) {
      return {
        success: false,
        error: 'Disponibilidad no encontrada'
      };
    }
    
    const availability = (availCheck as any[])[0];
    const slotsAvailable = availability.capacity - availability.current_appointments;
    
    if (slotsAvailable <= 0) {
      return {
        success: false,
        message: 'No hay cupos disponibles para reasignar',
        availability_info: {
          availability_id: availability.id,
          date: availability.date,
          doctor: availability.doctor_name,
          specialty: availability.specialty_name,
          location: availability.location_name,
          capacity: availability.capacity,
          current_appointments: availability.current_appointments,
          slots_available: slotsAvailable
        }
      };
    }
    
    // Llamar al procedimiento almacenado
    await connection.execute(`CALL process_waiting_list_for_availability(?)`, [availability_id]);
    
    // Consultar resultados
    const [reassignedResult] = await connection.execute(`
      SELECT COUNT(*) as total_reassigned
      FROM appointments_waiting_list
      WHERE availability_id = ? AND status = 'reassigned'
    `, [availability_id]);
    
    const totalReassigned = (reassignedResult as any[])[0].total_reassigned;
    
    const [stillWaitingResult] = await connection.execute(`
      SELECT COUNT(*) as still_waiting
      FROM appointments_waiting_list
      WHERE availability_id = ? AND status = 'pending'
    `, [availability_id]);
    
    const stillWaiting = (stillWaitingResult as any[])[0].still_waiting;
    
    // Nueva consulta de cupos actuales
    const [updatedAvailCheck] = await connection.execute(`
      SELECT 
        a.capacity,
        (
          SELECT COUNT(*)
          FROM appointments app
          WHERE app.availability_id = a.id 
            AND app.status IN ('Pendiente', 'Confirmada')
        ) as current_appointments
      FROM availabilities a
      WHERE a.id = ?
    `, [availability_id]);
    
    const updated = (updatedAvailCheck as any[])[0];
    const slotsRemainingAfter = updated.capacity - updated.current_appointments;
    
    return {
      success: true,
      message: `Se procesó la lista de espera exitosamente`,
      reassigned_count: totalReassigned,
      still_waiting_count: stillWaiting,
      availability_info: {
        availability_id: availability.id,
        date: availability.date,
        doctor: availability.doctor_name,
        specialty: availability.specialty_name,
        location: availability.location_name,
        capacity: updated.capacity,
        appointments_before: availability.current_appointments,
        appointments_after: updated.current_appointments,
        slots_available_before: slotsAvailable,
        slots_available_after: slotsRemainingAfter
      },
      info: totalReassigned > 0
        ? `Se reasignaron ${totalReassigned} solicitudes de la lista de espera a citas confirmadas`
        : 'No se reasignó ninguna solicitud (puede que no hayan solicitudes o los cupos ya estén llenos)'
    };
    
  } catch (error: any) {
    console.error('Error procesando lista de espera:', error);
    return {
      success: false,
      error: 'Error al procesar lista de espera',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// === IMPLEMENTACIONES DE FUNCIONES AUXILIARES (YA NO SE USAN) ===

async function searchPatients(query: string, limit: number = 20) {
  const like = `%${query}%`;
  const [rows] = await pool.query(
    'SELECT id, document, name, phone, email, birth_date, gender, status FROM patients WHERE name LIKE ? OR document LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT ?',
    [like, like, like, limit]
  );
  return {
    patients: rows,
    total: (rows as any[]).length,
    query: query
  };
}

async function getPatientById(patientId: number) {
  const [rows] = await pool.query(
    'SELECT * FROM patients WHERE id = ? LIMIT 1',
    [patientId]
  );
  if (!(rows as any[]).length) {
    throw new Error('Paciente no encontrado');
  }
  return (rows as any[])[0];
}

// Función para inferir género basado en nombre (heurística simple)
function inferGenderFromName(name: string): string {
  const nameLower = name.toLowerCase().trim();
  
  // Nombres típicamente masculinos (terminaciones comunes)
  const maleEndings = ['o', 'an', 'el', 'on', 'en', 'ar', 'er', 'ir', 'or', 'ur'];
  const maleNames = ['juan', 'carlos', 'luis', 'miguel', 'jose', 'david', 'jorge', 'manuel', 'ricardo', 'francisco', 'antonio', 'sebastian', 'andres', 'diego', 'pablo', 'alejandro', 'pedro', 'rafael', 'jesus', 'daniel'];
  
  // Nombres típicamente femeninos (terminaciones comunes)
  const femaleEndings = ['a', 'ia', 'na', 'ra', 'ta', 'da', 'la', 'sa', 'ma', 'ca'];
  const femaleNames = ['maria', 'ana', 'carmen', 'lucia', 'patricia', 'rosa', 'laura', 'marta', 'elena', 'sofia', 'claudia', 'gabriela', 'andrea', 'paola', 'monica', 'teresa', 'cristina', 'diana', 'sandra', 'beatriz'];
  
  // Extraer primer nombre
  const firstName = nameLower.split(' ')[0];
  
  // Verificar nombres específicos
  if (maleNames.includes(firstName)) return 'Masculino';
  if (femaleNames.includes(firstName)) return 'Femenino';
  
  // Verificar terminaciones
  for (const ending of femaleEndings) {
    if (firstName.endsWith(ending)) return 'Femenino';
  }
  
  for (const ending of maleEndings) {
    if (firstName.endsWith(ending)) return 'Masculino';
  }
  
  return 'No especificado';
}

async function createPatient(data: any) {
  // Validar campos obligatorios
  const requiredFields = [
    'document', 'document_type_id', 'name', 'birth_date', 'gender',
    'address', 'municipality_id', 'phone', 'email', 'insurance_eps_id',
    'insurance_affiliation_type', 'blood_group_id', 'population_group_id',
    'education_level_id', 'marital_status_id', 'estrato'
  ];
  
  const missingFields = requiredFields.filter(field => !data[field] && data[field] !== 0);
  if (missingFields.length > 0) {
    throw new Error(`Campos obligatorios faltantes: ${missingFields.join(', ')}`);
  }
  
  // Validar formato de email
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw new Error('Formato de email inválido');
  }
  
  // Validar formato de fecha de nacimiento
  if (data.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.birth_date)) {
    throw new Error('Formato de fecha de nacimiento inválido (debe ser YYYY-MM-DD)');
  }
  
  // Validar estrato
  if (data.estrato && (data.estrato < 0 || data.estrato > 6)) {
    throw new Error('Estrato debe estar entre 0 y 6');
  }

  // Inferir género si no se proporciona o es "No especificado"
  let gender = data.gender;
  if (!gender || gender === 'No especificado') {
    gender = inferGenderFromName(data.name);
  }

  const {
    document, document_type_id, name, phone, phone_alt, email, birth_date, 
    address, municipality_id, zone_id, 
    insurance_eps_id, insurance_affiliation_type, blood_group_id, 
    population_group_id, education_level_id, marital_status_id, 
    has_disability = false, disability_type_id, estrato, notes
  } = data;
  
  const [result] = await pool.query(
    `INSERT INTO patients (
      document, document_type_id, name, phone, phone_alt, email, birth_date, 
      gender, address, municipality_id, zone_id, insurance_eps_id, 
      insurance_affiliation_type, blood_group_id, population_group_id, 
      education_level_id, marital_status_id, has_disability, disability_type_id, 
      estrato, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo')`,
    [
      document, document_type_id || null, name, phone || null, phone_alt || null, 
      email || null, birth_date || null, gender, address || null, 
      municipality_id || null, zone_id || null, insurance_eps_id || null, 
      insurance_affiliation_type || null, blood_group_id || null, 
      population_group_id || null, education_level_id || null, 
      marital_status_id || null, has_disability, disability_type_id || null, 
      estrato || null, notes || null
    ]
  );
  
  return {
    id: (result as any).insertId,
    ...data,
    status: 'Activo'
  };
}

async function createSimplePatient(data: any) {
  // Validar campos mínimos requeridos - SOLO nombre y documento
  const requiredFields = ['document', 'name'];
  const missingFields = requiredFields.filter(field => !data[field] || String(data[field]).trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Campos obligatorios faltantes: ${missingFields.join(', ')}`);
  }

  // Limpiar y validar datos
  const document = String(data.document).trim();
  const name = String(data.name).trim();
  
  if (document.length < 3) {
    throw new Error('El documento debe tener al menos 3 caracteres');
  }
  
  if (name.length < 2) {
    throw new Error('El nombre debe tener al menos 2 caracteres');
  }

  // Convertir fecha de nacimiento si viene en formato DD/MM/YYYY (opcional)
  let birthDate = null;
  if (data.birth_date) {
    if (data.birth_date.includes('/')) {
      const parts = data.birth_date.split('/');
      if (parts.length === 3) {
        // Convertir DD/MM/YYYY a YYYY-MM-DD
        birthDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(data.birth_date)) {
      birthDate = data.birth_date;
    }
  }

  // Inferir género si no se proporciona (opcional)
  let gender = 'No especificado';
  if (data.gender) {
    gender = data.gender;
  } else {
    gender = inferGenderFromName(name);
  }

  // Validar email si se proporciona (opcional)
  let email = null;
  if (data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    email = data.email;
  }

  // Validar teléfono si se proporciona (opcional)
  let phone = null;
  if (data.phone && String(data.phone).trim().length >= 7) {
    phone = String(data.phone).trim();
  }

  // Crear paciente con datos ultra-mínimos
  const patientData = {
    document: document,
    name: name,
    phone: phone,
    email: email,
    birth_date: birthDate,
    gender: gender,
    status: 'Activo',
    notes: 'Registro ultra-simple desde WhatsApp'
  };

  const [result] = await pool.query(
    `INSERT INTO patients (document, name, phone, email, birth_date, gender, status, has_disability, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      patientData.document, 
      patientData.name, 
      patientData.phone, 
      patientData.email, 
      patientData.birth_date, 
      patientData.gender, 
      patientData.status, 
      patientData.notes
    ]
  );

  const patientId = (result as any).insertId;
  
  return {
    id: patientId,
    document: patientData.document,
    name: patientData.name,
    phone: patientData.phone,
    email: patientData.email,
    birth_date: patientData.birth_date,
    gender: patientData.gender,
    notes: patientData.notes,
    status: patientData.status,
    message: 'Paciente registrado exitosamente con datos ultra-mínimos'
  };
}

async function updatePatient(patientId: number, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  
  const allowedFields = [
    'name', 'phone', 'phone_alt', 'email', 'address', 'municipality_id', 
    'zone_id', 'insurance_eps_id', 'insurance_affiliation_type', 
    'blood_group_id', 'population_group_id', 'education_level_id', 
    'marital_status_id', 'has_disability', 'disability_type_id', 
    'estrato', 'notes', 'status'
  ];
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(data[field]);
    }
  }
  
  if (!fields.length) {
    throw new Error('No hay campos para actualizar');
  }
  
  values.push(patientId);
  await pool.execute(
    `UPDATE patients SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  
  return { id: patientId, ...data };
}

async function getAppointments(filters: any = {}) {
  const where: string[] = [];
  const values: any[] = [];
  
  if (filters.date) {
    where.push('DATE(a.scheduled_at) = ?');
    values.push(filters.date);
  }
  if (filters.status) {
    where.push('a.status = ?');
    values.push(filters.status);
  }
  if (filters.patient_id) {
    where.push('a.patient_id = ?');
    values.push(filters.patient_id);
  }
  if (filters.doctor_id) {
    where.push('a.doctor_id = ?');
    values.push(filters.doctor_id);
  }
  
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  
  const [rows] = await pool.execute(
    `SELECT a.*, 
            p.name AS patient_name, p.phone AS patient_phone, p.document AS patient_document,
            d.name AS doctor_name, 
            s.name AS specialty_name,
            l.name AS location_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN doctors d ON d.id = a.doctor_id
     JOIN specialties s ON s.id = a.specialty_id
     JOIN locations l ON l.id = a.location_id
     ${whereClause}
     ORDER BY a.scheduled_at ASC
     LIMIT 100`,
    values
  );
  
  return {
    appointments: rows,
    total: (rows as any[]).length,
    filters
  };
}

async function createAppointment(data: any) {
  const {
    patient_id, doctor_id, specialty_id, location_id, scheduled_at,
    duration_minutes = 30, appointment_type = 'Presencial', reason
  } = data;
  
  // Verificar conflictos de horario
  const [conflicts] = await pool.execute(
    `SELECT id FROM appointments
     WHERE doctor_id = ? AND status != 'Cancelada'
       AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
       AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
     LIMIT 1`,
    [doctor_id, scheduled_at, duration_minutes, scheduled_at]
  );
  
  if ((conflicts as any[]).length > 0) {
    throw new Error('Conflicto de horario: el médico ya tiene una cita en ese horario');
  }
  
  const [result] = await pool.execute(
    `INSERT INTO appointments (patient_id, doctor_id, specialty_id, location_id, scheduled_at, duration_minutes, appointment_type, status, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)`,
    [patient_id, doctor_id, specialty_id, location_id, scheduled_at, duration_minutes, appointment_type, reason]
  );
  
  return {
    id: (result as any).insertId,
    ...data,
    status: 'Pendiente'
  };
}

async function updateAppointmentStatus(appointmentId: number, data: any) {
  const { status, notes, cancellation_reason } = data;
  
  const fields = ['status = ?'];
  const values = [status];
  
  if (notes !== undefined) {
    fields.push('notes = ?');
    values.push(notes);
  }
  
  if (cancellation_reason !== undefined) {
    fields.push('cancellation_reason = ?');
    values.push(cancellation_reason);
  }
  
  values.push(appointmentId);
  
  await pool.execute(
    `UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  
  return { id: appointmentId, ...data };
}

async function getDoctors(filters: any = {}) {
  let query = 'SELECT * FROM doctors';
  const values: any[] = [];
  
  if (filters.active_only !== false) {
    query += ' WHERE active = true';
  }
  
  query += ' ORDER BY name ASC';
  
  const [doctors] = await pool.execute(query, values);
  
  // Obtener especialidades y ubicaciones para cada médico
  const [specRows] = await pool.execute(
    `SELECT ds.doctor_id, s.id, s.name
     FROM doctor_specialties ds
     JOIN specialties s ON s.id = ds.specialty_id`
  );
  
  const [locRows] = await pool.execute(
    `SELECT dl.doctor_id, l.id, l.name
     FROM doctor_locations dl
     JOIN locations l ON l.id = dl.location_id`
  );
  
  // Mapear especialidades y ubicaciones
  const specMap = new Map();
  const locMap = new Map();
  
  for (const row of specRows as any[]) {
    if (!specMap.has(row.doctor_id)) specMap.set(row.doctor_id, []);
    specMap.get(row.doctor_id).push({ id: row.id, name: row.name });
  }
  
  for (const row of locRows as any[]) {
    if (!locMap.has(row.doctor_id)) locMap.set(row.doctor_id, []);
    locMap.get(row.doctor_id).push({ id: row.id, name: row.name });
  }
  
  const result = (doctors as any[]).map(doctor => ({
    ...doctor,
    specialties: specMap.get(doctor.id) || [],
    locations: locMap.get(doctor.id) || []
  }));
  
  return {
    doctors: result,
    total: result.length
  };
}

async function createDoctor(data: any) {
  const { name, email, phone, license_number, specialties = [], locations = [] } = data;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [result] = await connection.execute(
      'INSERT INTO doctors (name, email, phone, license_number, active) VALUES (?, ?, ?, ?, true)',
      [name, email || null, phone || null, license_number]
    );
    
    const doctorId = (result as any).insertId;
    
    // Agregar especialidades
    if (specialties.length > 0) {
      const specValues = specialties.map((sid: number) => [doctorId, sid]);
      await connection.query('INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES ?', [specValues]);
    }
    
    // Agregar ubicaciones
    if (locations.length > 0) {
      const locValues = locations.map((lid: number) => [doctorId, lid]);
      await connection.query('INSERT INTO doctor_locations (doctor_id, location_id) VALUES ?', [locValues]);
    }
    
    await connection.commit();
    
    return {
      id: doctorId,
      name,
      email,
      phone,
      license_number,
      specialties,
      locations,
      active: true
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getSpecialties(activeOnly: boolean = true) {
  let query = 'SELECT * FROM specialties';
  if (activeOnly) {
    query += ' WHERE active = true';
  }
  query += ' ORDER BY name ASC';
  
  const [rows] = await pool.execute(query);
  return {
    specialties: rows,
    total: (rows as any[]).length
  };
}

async function createSpecialty(data: any) {
  const { name, description, default_duration_minutes = 30 } = data;
  
  const [result] = await pool.execute(
    'INSERT INTO specialties (name, description, default_duration_minutes, active) VALUES (?, ?, ?, true)',
    [name, description || null, default_duration_minutes]
  );
  
  return {
    id: (result as any).insertId,
    name,
    description,
    default_duration_minutes,
    active: true
  };
}

async function getLocations(activeOnly: boolean = true) {
  let query = 'SELECT * FROM locations';
  if (activeOnly) {
    query += " WHERE status = 'Activa'";
  }
  query += ' ORDER BY name ASC';
  
  const [rows] = await pool.execute(query);
  return {
    locations: rows,
    total: (rows as any[]).length
  };
}

async function createLocation(data: any) {
  const { name, address, phone, type = 'Sucursal', capacity = 0 } = data;
  
  const [result] = await pool.execute(
    `INSERT INTO locations (name, address, phone, type, status, capacity, current_patients)
     VALUES (?, ?, ?, ?, 'Activa', ?, 0)`,
    [name, address || null, phone || null, type, capacity]
  );
  
  return {
    id: (result as any).insertId,
    name,
    address,
    phone,
    type,
    status: 'Activa',
    capacity,
    current_patients: 0
  };
}

async function getDaySummary(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const [stats] = await pool.execute(
    `SELECT 
       COUNT(*) as total_citas,
       SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) as completadas,
       SUM(CASE WHEN status = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
       SUM(CASE WHEN status = 'Confirmada' THEN 1 ELSE 0 END) as confirmadas,
       SUM(CASE WHEN status = 'Cancelada' THEN 1 ELSE 0 END) as canceladas
     FROM appointments 
     WHERE DATE(scheduled_at) = ?`,
    [targetDate]
  );
  
  const [topDoctors] = await pool.execute(
    `SELECT d.name, COUNT(*) as citas
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     WHERE DATE(a.scheduled_at) = ?
     GROUP BY a.doctor_id, d.name
     ORDER BY citas DESC
     LIMIT 5`,
    [targetDate]
  );
  
  const summary = (stats as any[])[0];
  
  return {
    fecha: targetDate,
    estadisticas: summary,
    medicos_mas_activos: topDoctors,
    mensaje_resumen: `Resumen del ${targetDate}: ${summary.total_citas} citas programadas, ${summary.completadas} completadas, ${summary.pendientes} pendientes.`
  };
}

async function getPatientHistory(patientId: number, limit: number = 10) {
  const [appointments] = await pool.execute(
    `SELECT a.*, d.name as doctor_name, s.name as specialty_name, l.name as location_name
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     JOIN specialties s ON s.id = a.specialty_id
     JOIN locations l ON l.id = a.location_id
     WHERE a.patient_id = ?
     ORDER BY a.scheduled_at DESC
     LIMIT ?`,
    [patientId, limit]
  );
  
  const [patient] = await pool.execute(
    'SELECT name, document FROM patients WHERE id = ? LIMIT 1',
    [patientId]
  );
  
  return {
    paciente: (patient as any[])[0] || null,
    historial: appointments,
    total: (appointments as any[]).length
  };
}

async function getDoctorSchedule(doctorId: number, date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const [appointments] = await pool.execute(
    `SELECT a.*, p.name as patient_name, p.phone as patient_phone, s.name as specialty_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN specialties s ON s.id = a.specialty_id
     WHERE a.doctor_id = ? AND DATE(a.scheduled_at) = ?
     ORDER BY a.scheduled_at ASC`,
    [doctorId, targetDate]
  );
  
  const [doctor] = await pool.execute(
    'SELECT name FROM doctors WHERE id = ? LIMIT 1',
    [doctorId]
  );
  
  return {
    medico: (doctor as any[])[0] || null,
    fecha: targetDate,
    agenda: appointments,
    total_citas: (appointments as any[]).length
  };
}

async function executeCustomQuery(query: string, params: any[] = []) {
  // Validar que sea solo SELECT
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery.startsWith('select')) {
    throw new Error('Solo se permiten consultas SELECT');
  }
  
  // Prevenir múltiples declaraciones
  if (trimmedQuery.includes(';') && !trimmedQuery.endsWith(';')) {
    throw new Error('No se permiten múltiples declaraciones SQL');
  }
  
  const [rows] = await pool.execute(query, params);
  return {
    resultados: rows,
    total: (rows as any[]).length,
    consulta: query
  };
}

// === FUNCIONES LOOKUP ===

async function getDocumentTypes() {
  const [rows] = await pool.query('SELECT id, code, name FROM document_types ORDER BY name');
  return { document_types: rows };
}

async function getBloodGroups() {
  const [rows] = await pool.query('SELECT id, code, name FROM blood_groups ORDER BY code');
  return { blood_groups: rows };
}

async function getEducationLevels() {
  const [rows] = await pool.query('SELECT id, name FROM education_levels ORDER BY id');
  return { education_levels: rows };
}

async function getMaritalStatuses() {
  const [rows] = await pool.query('SELECT id, name FROM marital_statuses ORDER BY name');
  return { marital_statuses: rows };
}

async function getPopulationGroups() {
  const [rows] = await pool.query('SELECT id, name FROM population_groups ORDER BY name');
  return { population_groups: rows };
}

async function getDisabilityTypes() {
  const [rows] = await pool.query('SELECT id, name FROM disability_types ORDER BY name');
  return { disability_types: rows };
}

async function getMunicipalities(zoneId?: number) {
  let query = 'SELECT m.id, m.name, m.zone_id, z.name as zone_name FROM municipalities m LEFT JOIN zones z ON m.zone_id = z.id';
  const params: any[] = [];
  
  if (zoneId) {
    query += ' WHERE m.zone_id = ?';
    params.push(zoneId);
  }
  
  query += ' ORDER BY m.name';
  
  const [rows] = await pool.query(query, params);
  return { municipalities: rows };
}

async function getZones() {
  const [rows] = await pool.query('SELECT id, name, description FROM zones ORDER BY name');
  return { zones: rows };
}

async function getEPS() {
  const [rows] = await pool.query('SELECT id, name FROM eps ORDER BY name');
  return { eps: rows };
}

// === ENDPOINTS MCP ===

// Ruta GET para mostrar información del servidor MCP
app.get('/mcp-unified', (req, res) => {
  res.json({
    name: "Biosanarcall Medical MCP Server",
    version: "1.0.0",
    description: "Servidor MCP unificado para gestión médica con 42 herramientas especializadas",
    protocol: "JSON-RPC 2.0",
    endpoint: "/mcp-unified",
    method: "POST",
    tools_count: UNIFIED_TOOLS.length,
    categories: [
      "Gestión de Pacientes",
      "Sistema de Citas",
      "Análisis y Reportes",
      "Notificaciones",
      "Operaciones de Archivo"
    ],
    usage: {
      example_request: {
        jsonrpc: "2.0",
        id: "test",
        method: "tools/list"
      },
      content_type: "application/json"
    },
    status: "active",
    timestamp: new Date().toISOString()
  });
});

// Endpoint principal para tools/list
app.post('/mcp-unified', async (req, res) => {
  try {
    const request: JSONRPCRequest = req.body;
    
    // Soporte para inicialización MCP
    if (request.method === 'initialize') {
      return res.json(createSuccessResponse(request.id, {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {
            listChanged: true
          }
        },
        serverInfo: {
          name: "Biosanarcall Medical MCP Server",
          version: "1.0.0"
        }
      }));
    }
    
    if (request.method === 'tools/list') {
      return res.json(createSuccessResponse(request.id, {
        tools: UNIFIED_TOOLS
      }));
    }
    
    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;
      const result = await executeToolCall(name, args || {});
      return res.json(createSuccessResponse(request.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }));
    }
    
    return res.json(createErrorResponse(request.id, -32601, 'Método no encontrado'));
    
  } catch (error: any) {
    console.error('Error en MCP unified:', error);
    return res.json(createErrorResponse(req.body?.id || 'unknown', -32603, error.message));
  }
});

// Endpoint ULTRA-OPTIMIZADO específico para ElevenLabs
app.post('/elevenlabs-mcp', async (req, res) => {
  // Headers optimizados para ElevenLabs
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-ElevenLabs-Optimized', 'true');
  res.setHeader('X-Response-Time', Date.now());
  
  try {
    const request: JSONRPCRequest = req.body;
    
    // Soporte para inicialización de ElevenLabs
    if (request.method === 'initialize') {
      return res.json({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: {
            tools: {
              listChanged: true
            }
          },
          serverInfo: {
            name: "Biosanarcall Medical MCP Server",
            version: "1.0.0"
          }
        }
      });
    }
    
    // Respuesta ultra-rápida para tools/list
    if (request.method === 'tools/list') {
      const response = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: UNIFIED_TOOLS
        }
      };
      return res.json(response);
    }
    
    // Ejecución de herramientas optimizada
    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;
      const result = await executeToolCall(name, args || {});
      return res.json({
        jsonrpc: "2.0", 
        id: request.id, 
        result: { 
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] 
        }
      });
    }
    
    return res.json({
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32601, message: 'Método no encontrado' }
    });
    
  } catch (error: any) {
    console.error('Error en ElevenLabs MCP:', error);
    return res.json({
      jsonrpc: "2.0",
      id: req.body?.id || 'unknown',
      error: { code: -32603, message: error.message }
    });
  }
});

// Endpoint específico para MCP Inspector con soporte StreamableHttp
app.all('/mcp-inspector', async (req, res) => {
  console.log(`=== MCP Inspector Request ===`);
  console.log(`Method: ${req.method}`);
  console.log(`Headers:`, req.headers);
  console.log(`Body:`, req.body);
  console.log(`URL: ${req.url}`);
  
  // Headers específicos para MCP Inspector
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MCP-Transport, X-MCP-Session');
  
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled');
    return res.status(200).end();
  }
  
  try {
    // Manejar solicitudes GET para MCP Inspector
    if (req.method === 'GET') {
      console.log('GET request to MCP Inspector endpoint');
      return res.json({
        message: 'MCP Inspector endpoint ready',
        server: 'Biosanar MCP Unified Server',
        version: '1.0.0',
        protocol: '2024-11-05',
        transport: ['streamable-http', 'http'],
        tools: UNIFIED_TOOLS.length,
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        endpoints: {
          initialize: 'POST /mcp-inspector',
          tools_list: 'POST /mcp-inspector',
          tools_call: 'POST /mcp-inspector'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const request: JSONRPCRequest = req.body || {};
    console.log('Parsed request:', JSON.stringify(request, null, 2));
    
    // Soporte para initialize request del MCP Inspector
    if (request.method === 'initialize') {
      console.log('Initialize method detected');
      const response = createSuccessResponse(request.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        serverInfo: {
          name: 'Biosanar MCP Unified Server',
          version: '1.0.0'
        }
      });
      console.log('Initialize response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }
    
    if (request.method === 'tools/list') {
      return res.json(createSuccessResponse(request.id, {
        tools: UNIFIED_TOOLS,
        serverInfo: {
          name: 'Biosanar MCP Unified Server',
          version: '1.0.0'
        }
      }));
    }
    
    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;
      const result = await executeToolCall(name, args || {});
      return res.json(createSuccessResponse(request.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }));
    }
    
    // Si no hay método específico, redirigir al endpoint principal
    if (!request.method) {
      console.log('No method specified - returning default response');
      return res.json(createSuccessResponse('unknown', {
        message: 'MCP Inspector endpoint ready',
        server: 'Biosanar MCP Unified Server',
        tools: UNIFIED_TOOLS.length
      }));
    }
    
    console.log(`Unknown method: ${request.method}`);
    return res.json(createErrorResponse(request.id || 'unknown', -32601, `Método no encontrado: ${request.method}`));
    
  } catch (error: any) {
    console.error('Error en MCP inspector:', error);
    return res.json(createErrorResponse(req.body?.id || 'unknown', -32603, error.message));
  }
});

// Endpoint de salud
app.get('/health', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 as connected');
    res.json({
      status: 'healthy',
      database: 'connected',
      tools: UNIFIED_TOOLS.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: (error as Error).message
    });
  }
});

// Test de conexión de base de datos
app.get('/test-db', async (req, res) => {
  try {
    const [result] = await pool.execute('SELECT COUNT(*) as patients FROM patients');
    const [result2] = await pool.execute('SELECT COUNT(*) as doctors FROM doctors');
    const [result3] = await pool.execute('SELECT COUNT(*) as appointments FROM appointments');
    
    res.json({
      database: 'connected',
      stats: {
        patients: (result as any[])[0].patients,
        doctors: (result2 as any[])[0].doctors,
        appointments: (result3 as any[])[0].appointments
      }
    });
  } catch (error: any) {
    res.status(500).json({
      database: 'error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      tools: UNIFIED_TOOLS.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Test database endpoint
app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as patient_count FROM patients');
    res.json({
      status: 'database_ok',
      patient_count: (rows as any[])[0].patient_count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'database_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// === IMPLEMENTACIONES DE NUEVAS FUNCIONES ===

async function getAvailabilities(args: any) {
  let query = `
    SELECT 
      av.id,
      av.date,
      av.start_time,
      av.end_time,
      av.capacity,
      av.booked_slots,
      av.status,
      av.notes,
      av.duration_minutes,
      d.name as doctor_name,
      s.name as specialty_name,
      l.name as location_name
    FROM availabilities av
    LEFT JOIN doctors d ON av.doctor_id = d.id
    LEFT JOIN specialties s ON av.specialty_id = s.id
    LEFT JOIN locations l ON av.location_id = l.id
  `;
  
  const filters: string[] = [];
  const values: any[] = [];
  
  if (args.date) {
    filters.push('av.date = ?');
    values.push(args.date);
  }
  
  if (args.doctor_id) {
    filters.push('av.doctor_id = ?');
    values.push(args.doctor_id);
  }
  
  if (args.specialty_id) {
    filters.push('av.specialty_id = ?');
    values.push(args.specialty_id);
  }
  
  if (args.location_id) {
    filters.push('av.location_id = ?');
    values.push(args.location_id);
  }
  
  if (args.status) {
    filters.push('av.status = ?');
    values.push(args.status);
  }
  
  if (filters.length > 0) {
    query += ' WHERE ' + filters.join(' AND ');
  }
  
  query += ' ORDER BY av.date ASC, av.start_time ASC';
  
  const [rows] = await pool.query(query, values);
  return {
    availabilities: rows,
    total: (rows as any[]).length,
    filters: args
  };
}

async function createAvailability(args: any) {
  const [result] = await pool.query(
    'INSERT INTO availabilities (doctor_id, specialty_id, location_id, date, start_time, end_time, capacity, duration_minutes, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [args.doctor_id, args.specialty_id, args.location_id, args.date, args.start_time, args.end_time, args.capacity, args.duration_minutes || 30, args.notes || '']
  );
  
  const insertId = (result as any).insertId;
  const [availability] = await pool.query('SELECT * FROM availabilities WHERE id = ?', [insertId]);
  
  return {
    success: true,
    availability: (availability as any[])[0],
    message: 'Disponibilidad creada exitosamente'
  };
}

async function updateAvailability(availabilityId: number, args: any) {
  const updates: string[] = [];
  const values: any[] = [];
  
  if (args.capacity !== undefined) {
    updates.push('capacity = ?');
    values.push(args.capacity);
  }
  
  if (args.status) {
    updates.push('status = ?');
    values.push(args.status);
  }
  
  if (args.notes !== undefined) {
    updates.push('notes = ?');
    values.push(args.notes);
  }
  
  if (updates.length === 0) {
    throw new Error('No hay campos para actualizar');
  }
  
  values.push(availabilityId);
  
  await pool.query(
    `UPDATE availabilities SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  const [updated] = await pool.query('SELECT * FROM availabilities WHERE id = ?', [availabilityId]);
  
  return {
    success: true,
    availability: (updated as any[])[0],
    message: 'Disponibilidad actualizada exitosamente'
  };
}

async function assignSpecialtyToDoctor(doctorId: number, specialtyId: number) {
  // Verificar si ya existe la relación
  const [existing] = await pool.query(
    'SELECT * FROM doctor_specialties WHERE doctor_id = ? AND specialty_id = ?',
    [doctorId, specialtyId]
  );
  
  if ((existing as any[]).length > 0) {
    return {
      success: false,
      message: 'El médico ya tiene asignada esta especialidad'
    };
  }
  
  await pool.query(
    'INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES (?, ?)',
    [doctorId, specialtyId]
  );
  
  return {
    success: true,
    message: 'Especialidad asignada exitosamente al médico'
  };
}

async function removeSpecialtyFromDoctor(doctorId: number, specialtyId: number) {
  const [result] = await pool.query(
    'DELETE FROM doctor_specialties WHERE doctor_id = ? AND specialty_id = ?',
    [doctorId, specialtyId]
  );
  
  if ((result as any).affectedRows === 0) {
    return {
      success: false,
      message: 'No se encontró la relación médico-especialidad'
    };
  }
  
  return {
    success: true,
    message: 'Especialidad removida exitosamente del médico'
  };
}

async function getDashboardStats(args: any) {
  const dateFrom = args.date_from || new Date().toISOString().split('T')[0];
  const dateTo = args.date_to || new Date().toISOString().split('T')[0];
  
  // Estadísticas de citas
  const [appointmentStats] = await pool.query(`
    SELECT 
      COUNT(*) as total_appointments,
      SUM(CASE WHEN status = 'Pendiente' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'Confirmada' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'Cancelada' THEN 1 ELSE 0 END) as cancelled
    FROM appointments 
    WHERE DATE(scheduled_at) BETWEEN ? AND ?
  `, [dateFrom, dateTo]);
  
  // Estadísticas de pacientes
  const [patientStats] = await pool.query(`
    SELECT COUNT(*) as total_patients
    FROM patients 
    WHERE DATE(created_at) BETWEEN ? AND ?
  `, [dateFrom, dateTo]);
  
  // Disponibilidades
  const [availabilityStats] = await pool.query(`
    SELECT 
      COUNT(*) as total_slots,
      SUM(capacity) as total_capacity,
      SUM(booked_slots) as total_booked
    FROM availabilities 
    WHERE date BETWEEN ? AND ?
  `, [dateFrom, dateTo]);
  
  return {
    period: { from: dateFrom, to: dateTo },
    appointments: (appointmentStats as any[])[0],
    patients: (patientStats as any[])[0],
    availabilities: (availabilityStats as any[])[0],
    generated_at: new Date().toISOString()
  };
}

async function getAppointmentStats(args: any) {
  let query = `
    SELECT 
      DATE(a.scheduled_at) as date,
      COUNT(*) as total_appointments,
      SUM(CASE WHEN a.status = 'Pendiente' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN a.status = 'Confirmada' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN a.status = 'Completada' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN a.status = 'Cancelada' THEN 1 ELSE 0 END) as cancelled,
      s.name as specialty_name,
      d.name as doctor_name
    FROM appointments a
    LEFT JOIN specialties s ON a.specialty_id = s.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    WHERE DATE(a.scheduled_at) BETWEEN ? AND ?
  `;
  
  const values = [args.date_from, args.date_to];
  
  if (args.doctor_id) {
    query += ' AND a.doctor_id = ?';
    values.push(args.doctor_id);
  }
  
  if (args.specialty_id) {
    query += ' AND a.specialty_id = ?';
    values.push(args.specialty_id);
  }
  
  query += ' GROUP BY DATE(a.scheduled_at), a.specialty_id, a.doctor_id ORDER BY date DESC';
  
  const [rows] = await pool.query(query, values);
  
  return {
    period: { from: args.date_from, to: args.date_to },
    stats: rows,
    total_records: (rows as any[]).length
  };
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor MCP Unificado ejecutándose en puerto ${PORT}`);
  console.log(`📊 ${UNIFIED_TOOLS.length} herramientas MCP disponibles`);
  console.log(`🔗 Endpoints disponibles:`);
  console.log(`   POST /mcp-unified - Protocolo MCP principal`);
  console.log(`   GET  /health - Estado del servidor`);
  console.log(`   GET  /test-db - Test de conexión a base de datos`);
  console.log(`✨ Sistema médico completo integrado`);
});

export default app;
