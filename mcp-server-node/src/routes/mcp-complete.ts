import { Router } from 'express';
import { pool } from '../db/mysql';
import logger from '../logger-mysql';

const router = Router();

// Tipos y interfaces
interface JSONRPCRequest {
  jsonrpc: string;
  method: string;
  params?: any;
  id: string | number;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Funciones de respuesta JSON-RPC
function createSuccessResponse(id: string | number, result: any) {
  return { jsonrpc: '2.0', id, result };
}

function createErrorResponse(id: string | number, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// Middleware de autenticación para algunos endpoints
const authenticateApiKey = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
  const expectedApiKey = 'biosanarcall_mcp_node_2025';
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required in X-API-Key header or Authorization Bearer token',
      timestamp: new Date().toISOString(),
      help: {
        header: 'X-API-Key',
        example: `X-API-Key: ${expectedApiKey}`,
        documentation: 'https://biosanarcall.site/mcp-node-info'
      }
    });
  }

  if (apiKey !== expectedApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Definición completa de herramientas MCP
const COMPLETE_TOOLS: Tool[] = [
  // PACIENTES
  {
    name: 'searchPatients',
    description: 'Buscar pacientes por nombre, documento o teléfono',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Término de búsqueda (nombre, documento, teléfono)' },
        limit: { type: 'number', description: 'Límite de resultados (1-100)', minimum: 1, maximum: 100 }
      },
      required: ['q']
    }
  },
  {
    name: 'getPatient',
    description: 'Obtener detalles de un paciente por ID',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'createPatient',
    description: 'Crear un nuevo paciente',
    inputSchema: {
      type: 'object',
      properties: {
        document: { type: 'string', description: 'Documento de identidad' },
        name: { type: 'string', description: 'Nombre completo' },
        phone: { type: 'string', description: 'Teléfono (opcional)' },
        email: { type: 'string', description: 'Email (opcional)' },
        birth_date: { type: 'string', description: 'Fecha de nacimiento YYYY-MM-DD (opcional)' },
        gender: { type: 'string', enum: ['Masculino', 'Femenino', 'Otro', 'No especificado'], description: 'Género' },
        address: { type: 'string', description: 'Dirección (opcional)' }
      },
      required: ['document', 'name']
    }
  },

  // CITAS
  {
    name: 'getAppointments',
    description: 'Obtener citas con filtros opcionales',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional)' },
        status: { type: 'string', enum: ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'], description: 'Estado de la cita' },
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del doctor' }
      }
    }
  },
  {
    name: 'createAppointment',
    description: 'Crear una nueva cita médica',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del doctor' },
        location_id: { type: 'number', description: 'ID de la ubicación' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' },
        scheduled_at: { type: 'string', description: 'Fecha y hora YYYY-MM-DD HH:MM:SS' },
        duration_minutes: { type: 'number', description: 'Duración en minutos (por defecto 30)', minimum: 5, maximum: 480 },
        appointment_type: { type: 'string', enum: ['Presencial', 'Telemedicina'], description: 'Tipo de cita' },
        reason: { type: 'string', description: 'Motivo de la cita (opcional)' }
      },
      required: ['patient_id', 'doctor_id', 'location_id', 'specialty_id', 'scheduled_at']
    }
  },

  // DOCTORES
  {
    name: 'getDoctors',
    description: 'Obtener lista de doctores con filtros opcionales',
    inputSchema: {
      type: 'object',
      properties: {
        specialty_id: { type: 'number', description: 'Filtrar por especialidad' },
        location_id: { type: 'number', description: 'Filtrar por ubicación' },
        status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado del doctor' }
      }
    }
  },
  {
    name: 'getDoctor',
    description: 'Obtener detalles de un doctor por ID',
    inputSchema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'number', description: 'ID del doctor' }
      },
      required: ['doctor_id']
    }
  },

  // ESPECIALIDADES
  {
    name: 'getSpecialties',
    description: 'Obtener lista de especialidades médicas',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado de la especialidad' }
      }
    }
  },

  // UBICACIONES
  {
    name: 'getLocations',
    description: 'Obtener lista de ubicaciones/consultorios',
    inputSchema: {
      type: 'object',
      properties: {
        location_type_id: { type: 'number', description: 'Filtrar por tipo de ubicación' },
        status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado de la ubicación' }
      }
    }
  },

  // DISPONIBILIDAD
  {
    name: 'getAvailabilities',
    description: 'Obtener disponibilidad de doctores',
    inputSchema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'number', description: 'ID del doctor' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        location_id: { type: 'number', description: 'ID de la ubicación' }
      }
    }
  },

  // ESTADÍSTICAS Y REPORTES
  {
    name: 'getDashboardStats',
    description: 'Obtener estadísticas generales del dashboard',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (opcional)' },
        date_to: { type: 'string', description: 'Fecha fin YYYY-MM-DD (opcional)' }
      }
    }
  },
  {
    name: 'getDaySummary',
    description: 'Resumen completo del día para voz (citas, pacientes, estadísticas)',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
      }
    }
  },

  // SERVICIOS Y PRECIOS
  {
    name: 'getServices',
    description: 'Obtener lista de servicios médicos',
    inputSchema: {
      type: 'object',
      properties: {
        specialty_id: { type: 'number', description: 'Filtrar por especialidad' },
        status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado del servicio' }
      }
    }
  },

  // CONSULTAS PERSONALIZADAS
  {
    name: 'executeCustomQuery',
    description: 'Ejecutar consulta SQL personalizada (solo SELECT)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Consulta SQL SELECT' },
        params: { type: 'array', description: 'Parámetros para la consulta (opcional)' }
      },
      required: ['query']
    }
  }
];

// Funciones de ejecución de herramientas
async function executeCompleteTool(name: string, args: any): Promise<string> {
  logger.info(`Executing complete tool: ${name}`, { args });

  try {
    switch (name) {
      // PACIENTES
      case 'searchPatients':
        const query = args.q?.trim();
        if (!query) throw new Error('Query parameter is required');
        
        const limit = Math.min(args.limit || 20, 100);
        const like = `%${query}%`;
        
        const [patients] = await pool.execute(
          `SELECT id, document, name, phone, email, birth_date, gender, status,
                  CONCAT(name, ' (', document, ')') as display_name
           FROM patients 
           WHERE name LIKE ? OR document LIKE ? OR phone LIKE ? 
           ORDER BY name ASC 
           LIMIT ?`,
          [like, like, like, limit]
        );
        
        const patientArray = patients as any[];
        if (patientArray.length === 0) {
          return `No se encontraron pacientes con el término "${query}"`;
        }
        
        return `${patientArray.length} paciente(s) encontrados:\n` +
               patientArray.map(p => `• ${p.display_name} - Tel: ${p.phone || 'N/A'} - Estado: ${p.status}`).join('\n');

      case 'getPatient':
        const patientId = parseInt(args.patient_id);
        if (!patientId) throw new Error('Valid patient_id is required');
        
        const [patientRows] = await pool.execute(
          `SELECT p.*, m.name as municipality_name, z.name as zone_name, e.name as eps_name
           FROM patients p
           LEFT JOIN municipalities m ON p.municipality_id = m.id
           LEFT JOIN zones z ON p.zone_id = z.id
           LEFT JOIN eps e ON p.insurance_eps_id = e.id
           WHERE p.id = ?`,
          [patientId]
        );
        
        const patient = (patientRows as any[])[0];
        if (!patient) return `Paciente con ID ${patientId} no encontrado`;
        
        return `PACIENTE: ${patient.name}\n` +
               `Documento: ${patient.document}\n` +
               `Teléfono: ${patient.phone || 'N/A'}\n` +
               `Email: ${patient.email || 'N/A'}\n` +
               `Fecha Nacimiento: ${patient.birth_date || 'N/A'}\n` +
               `Género: ${patient.gender}\n` +
               `Dirección: ${patient.address || 'N/A'}\n` +
               `Municipio: ${patient.municipality_name || 'N/A'}\n` +
               `Zona: ${patient.zone_name || 'N/A'}\n` +
               `EPS: ${patient.eps_name || 'N/A'}\n` +
               `Estado: ${patient.status}`;

      case 'createPatient':
        const newPatient = {
          document: args.document,
          name: args.name,
          phone: args.phone || null,
          email: args.email || null,
          birth_date: args.birth_date || null,
          gender: args.gender || 'No especificado',
          address: args.address || null,
          status: 'Activo'
        };
        
        const [insertResult] = await pool.execute(
          `INSERT INTO patients (document, name, phone, email, birth_date, gender, address, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newPatient.document, newPatient.name, newPatient.phone, newPatient.email, 
           newPatient.birth_date, newPatient.gender, newPatient.address, newPatient.status]
        );
        
        const insertId = (insertResult as any).insertId;
        return `Paciente creado exitosamente:\nID: ${insertId}\nNombre: ${newPatient.name}\nDocumento: ${newPatient.document}`;

      // CITAS
      case 'getAppointments':
        let appointmentQuery = `
          SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, p.document AS patient_document,
                 d.name AS doctor_name, s.name AS specialty_name, l.name AS location_name,
                 DATE_FORMAT(a.scheduled_at, '%Y-%m-%d %H:%i') as formatted_time
          FROM appointments a
          JOIN patients p ON p.id = a.patient_id
          JOIN doctors d ON d.id = a.doctor_id
          JOIN specialties s ON s.id = a.specialty_id
          JOIN locations l ON l.id = a.location_id
        `;
        
        const appointmentFilters: string[] = [];
        const appointmentValues: any[] = [];
        
        if (args.date) {
          appointmentFilters.push('DATE(a.scheduled_at) = ?');
          appointmentValues.push(args.date);
        }
        if (args.status) {
          appointmentFilters.push('a.status = ?');
          appointmentValues.push(args.status);
        }
        if (args.patient_id) {
          appointmentFilters.push('a.patient_id = ?');
          appointmentValues.push(args.patient_id);
        }
        if (args.doctor_id) {
          appointmentFilters.push('a.doctor_id = ?');
          appointmentValues.push(args.doctor_id);
        }
        
        if (appointmentFilters.length > 0) {
          appointmentQuery += ' WHERE ' + appointmentFilters.join(' AND ');
        }
        
        appointmentQuery += ' ORDER BY a.scheduled_at DESC LIMIT 50';
        
        const [appointments] = await pool.execute(appointmentQuery, appointmentValues);
        const appointmentArray = appointments as any[];
        
        if (appointmentArray.length === 0) {
          return 'No se encontraron citas con los filtros especificados';
        }
        
        return `${appointmentArray.length} cita(s) encontradas:\n` +
               appointmentArray.map(a => 
                 `• ${a.formatted_time} - ${a.patient_name} con Dr. ${a.doctor_name}\n` +
                 `  Especialidad: ${a.specialty_name} | Estado: ${a.status} | Ubicación: ${a.location_name}`
               ).join('\n');

      case 'createAppointment':
        const appointmentData = {
          patient_id: args.patient_id,
          doctor_id: args.doctor_id,
          location_id: args.location_id,
          specialty_id: args.specialty_id,
          scheduled_at: args.scheduled_at,
          duration_minutes: args.duration_minutes || 30,
          appointment_type: args.appointment_type || 'Presencial',
          status: 'Pendiente',
          reason: args.reason || null
        };
        
        // Verificar que no haya conflictos de horario
        const [conflicts] = await pool.execute(
          `SELECT id FROM appointments
           WHERE doctor_id = ? AND status != 'Cancelada'
             AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
             AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
           LIMIT 1`,
          [appointmentData.doctor_id, appointmentData.scheduled_at, appointmentData.duration_minutes, appointmentData.scheduled_at]
        );
        
        if ((conflicts as any[]).length > 0) {
          return 'Error: El doctor ya tiene una cita que se solapa con ese horario';
        }
        
        const [appointmentInsert] = await pool.execute(
          `INSERT INTO appointments (patient_id, doctor_id, location_id, specialty_id, scheduled_at, 
                                   duration_minutes, appointment_type, status, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [appointmentData.patient_id, appointmentData.doctor_id, appointmentData.location_id,
           appointmentData.specialty_id, appointmentData.scheduled_at, appointmentData.duration_minutes,
           appointmentData.appointment_type, appointmentData.status, appointmentData.reason]
        );
        
        const appointmentId = (appointmentInsert as any).insertId;
        return `Cita creada exitosamente:\nID: ${appointmentId}\nFecha: ${appointmentData.scheduled_at}\nDuración: ${appointmentData.duration_minutes} minutos`;

      // DOCTORES
      case 'getDoctors':
        let doctorQuery = `
          SELECT d.*, s.name as specialty_name, l.name as location_name
          FROM doctors d
          LEFT JOIN specialties s ON d.specialty_id = s.id
          LEFT JOIN locations l ON d.location_id = l.id
        `;
        
        const doctorFilters: string[] = [];
        const doctorValues: any[] = [];
        
        if (args.specialty_id) {
          doctorFilters.push('d.specialty_id = ?');
          doctorValues.push(args.specialty_id);
        }
        if (args.location_id) {
          doctorFilters.push('d.location_id = ?');
          doctorValues.push(args.location_id);
        }
        if (args.status) {
          doctorFilters.push('d.status = ?');
          doctorValues.push(args.status);
        }
        
        if (doctorFilters.length > 0) {
          doctorQuery += ' WHERE ' + doctorFilters.join(' AND ');
        }
        
        doctorQuery += ' ORDER BY d.name ASC';
        
        const [doctors] = await pool.execute(doctorQuery, doctorValues);
        const doctorArray = doctors as any[];
        
        if (doctorArray.length === 0) {
          return 'No se encontraron doctores con los filtros especificados';
        }
        
        return `${doctorArray.length} doctor(es) encontrados:\n` +
               doctorArray.map(d => 
                 `• Dr. ${d.name} - ${d.specialty_name || 'Sin especialidad'}\n` +
                 `  Ubicación: ${d.location_name || 'Sin ubicación'} | Estado: ${d.status}`
               ).join('\n');

      case 'getDoctor':
        const doctorId = parseInt(args.doctor_id);
        if (!doctorId) throw new Error('Valid doctor_id is required');
        
        const [doctorRows] = await pool.execute(
          `SELECT d.*, s.name as specialty_name, l.name as location_name
           FROM doctors d
           LEFT JOIN specialties s ON d.specialty_id = s.id
           LEFT JOIN locations l ON d.location_id = l.id
           WHERE d.id = ?`,
          [doctorId]
        );
        
        const doctor = (doctorRows as any[])[0];
        if (!doctor) return `Doctor con ID ${doctorId} no encontrado`;
        
        return `DOCTOR: ${doctor.name}\n` +
               `Especialidad: ${doctor.specialty_name || 'Sin especialidad'}\n` +
               `Ubicación: ${doctor.location_name || 'Sin ubicación'}\n` +
               `Teléfono: ${doctor.phone || 'N/A'}\n` +
               `Email: ${doctor.email || 'N/A'}\n` +
               `Estado: ${doctor.status}`;

      // ESPECIALIDADES
      case 'getSpecialties':
        let specialtyQuery = 'SELECT * FROM specialties';
        const specialtyValues: any[] = [];
        
        if (args.status) {
          specialtyQuery += ' WHERE status = ?';
          specialtyValues.push(args.status);
        }
        
        specialtyQuery += ' ORDER BY name ASC';
        
        const [specialties] = await pool.execute(specialtyQuery, specialtyValues);
        const specialtyArray = specialties as any[];
        
        return `${specialtyArray.length} especialidad(es):\n` +
               specialtyArray.map(s => `• ${s.name} - ${s.status}`).join('\n');

      // UBICACIONES
      case 'getLocations':
        let locationQuery = `
          SELECT l.*, lt.name as location_type_name
          FROM locations l
          LEFT JOIN location_types lt ON l.location_type_id = lt.id
        `;
        
        const locationFilters: string[] = [];
        const locationValues: any[] = [];
        
        if (args.location_type_id) {
          locationFilters.push('l.location_type_id = ?');
          locationValues.push(args.location_type_id);
        }
        if (args.status) {
          locationFilters.push('l.status = ?');
          locationValues.push(args.status);
        }
        
        if (locationFilters.length > 0) {
          locationQuery += ' WHERE ' + locationFilters.join(' AND ');
        }
        
        locationQuery += ' ORDER BY l.name ASC';
        
        const [locations] = await pool.execute(locationQuery, locationValues);
        const locationArray = locations as any[];
        
        return `${locationArray.length} ubicación(es):\n` +
               locationArray.map(l => 
                 `• ${l.name} - ${l.location_type_name || 'Sin tipo'} | Estado: ${l.status}`
               ).join('\n');

      // DISPONIBILIDAD
      case 'getAvailabilities':
        let availabilityQuery = `
          SELECT av.*, d.name as doctor_name, l.name as location_name,
                 DATE_FORMAT(av.start_time, '%H:%i') as start_formatted,
                 DATE_FORMAT(av.end_time, '%H:%i') as end_formatted
          FROM availabilities av
          JOIN doctors d ON av.doctor_id = d.id
          LEFT JOIN locations l ON av.location_id = l.id
        `;
        
        const availabilityFilters: string[] = [];
        const availabilityValues: any[] = [];
        
        if (args.doctor_id) {
          availabilityFilters.push('av.doctor_id = ?');
          availabilityValues.push(args.doctor_id);
        }
        if (args.date) {
          availabilityFilters.push('av.date = ?');
          availabilityValues.push(args.date);
        }
        if (args.location_id) {
          availabilityFilters.push('av.location_id = ?');
          availabilityValues.push(args.location_id);
        }
        
        if (availabilityFilters.length > 0) {
          availabilityQuery += ' WHERE ' + availabilityFilters.join(' AND ');
        }
        
        availabilityQuery += ' ORDER BY av.date ASC, av.start_time ASC';
        
        const [availabilities] = await pool.execute(availabilityQuery, availabilityValues);
        const availabilityArray = availabilities as any[];
        
        if (availabilityArray.length === 0) {
          return 'No se encontró disponibilidad con los filtros especificados';
        }
        
        return `${availabilityArray.length} horario(s) disponibles:\n` +
               availabilityArray.map(av => 
                 `• ${av.date} ${av.start_formatted}-${av.end_formatted} - Dr. ${av.doctor_name}\n` +
                 `  Ubicación: ${av.location_name || 'Sin ubicación'} | Estado: ${av.status}`
               ).join('\n');

      // ESTADÍSTICAS
      case 'getDashboardStats':
        const dateFrom = args.date_from || new Date().toISOString().split('T')[0];
        const dateTo = args.date_to || new Date().toISOString().split('T')[0];
        
        // Estadísticas de citas
        const [appointmentStats] = await pool.execute(
          `SELECT 
             COUNT(*) as total_appointments,
             SUM(CASE WHEN status = 'Pendiente' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'Confirmada' THEN 1 ELSE 0 END) as confirmed,
             SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'Cancelada' THEN 1 ELSE 0 END) as cancelled
           FROM appointments 
           WHERE DATE(scheduled_at) BETWEEN ? AND ?`,
          [dateFrom, dateTo]
        );
        
        // Estadísticas de pacientes
        const [patientStats] = await pool.execute(
          `SELECT COUNT(*) as total_patients,
                  SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) as active_patients
           FROM patients`
        );
        
        const stats = (appointmentStats as any[])[0];
        const pStats = (patientStats as any[])[0];
        
        return `ESTADÍSTICAS DEL SISTEMA (${dateFrom} a ${dateTo}):\n\n` +
               `CITAS:\n` +
               `• Total: ${stats.total_appointments}\n` +
               `• Pendientes: ${stats.pending}\n` +
               `• Confirmadas: ${stats.confirmed}\n` +
               `• Completadas: ${stats.completed}\n` +
               `• Canceladas: ${stats.cancelled}\n\n` +
               `PACIENTES:\n` +
               `• Total: ${pStats.total_patients}\n` +
               `• Activos: ${pStats.active_patients}`;

      case 'getDaySummary':
        const summaryDate = args.date || new Date().toISOString().split('T')[0];
        
        // Citas del día
        const [dayCitas] = await pool.execute(
          `SELECT COUNT(*) as total,
                  SUM(CASE WHEN status = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
                  SUM(CASE WHEN status = 'Confirmada' THEN 1 ELSE 0 END) as confirmadas,
                  SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) as completadas
           FROM appointments 
           WHERE DATE(scheduled_at) = ?`,
          [summaryDate]
        );
        
        const daySummaryStats = (dayCitas as any[])[0];
        
        if (daySummaryStats.total === 0) {
          return `Sin citas programadas para el ${summaryDate}`;
        }
        
        return `RESUMEN DEL DÍA ${summaryDate}:\n` +
               `Total de citas: ${daySummaryStats.total}\n` +
               `Pendientes: ${daySummaryStats.pendientes}\n` +
               `Confirmadas: ${daySummaryStats.confirmadas}\n` +
               `Completadas: ${daySummaryStats.completadas}`;

      // SERVICIOS
      case 'getServices':
        let serviceQuery = `
          SELECT s.*, sp.name as specialty_name
          FROM services s
          LEFT JOIN specialties sp ON s.specialty_id = sp.id
        `;
        
        const serviceFilters: string[] = [];
        const serviceValues: any[] = [];
        
        if (args.specialty_id) {
          serviceFilters.push('s.specialty_id = ?');
          serviceValues.push(args.specialty_id);
        }
        if (args.status) {
          serviceFilters.push('s.status = ?');
          serviceValues.push(args.status);
        }
        
        if (serviceFilters.length > 0) {
          serviceQuery += ' WHERE ' + serviceFilters.join(' AND ');
        }
        
        serviceQuery += ' ORDER BY s.name ASC';
        
        const [services] = await pool.execute(serviceQuery, serviceValues);
        const serviceArray = services as any[];
        
        return `${serviceArray.length} servicio(s):\n` +
               serviceArray.map(s => 
                 `• ${s.name} - ${s.specialty_name || 'Sin especialidad'}\n` +
                 `  Precio: $${s.price || 'N/A'} | Estado: ${s.status}`
               ).join('\n');

      // CONSULTA PERSONALIZADA
      case 'executeCustomQuery':
        const sqlQuery = args.query?.trim();
        if (!sqlQuery) throw new Error('Query is required');
        
        // Validar que sea solo SELECT
        if (!sqlQuery.toLowerCase().startsWith('select')) {
          throw new Error('Only SELECT queries are allowed');
        }
        
        const params = args.params || [];
        const [customResults] = await pool.execute(sqlQuery, params);
        const resultArray = customResults as any[];
        
        if (resultArray.length === 0) {
          return 'Query ejecutada exitosamente - Sin resultados';
        }
        
        // Formatear resultados
        const columns = Object.keys(resultArray[0]);
        let output = `Query ejecutada exitosamente - ${resultArray.length} resultado(s):\n\n`;
        
        resultArray.slice(0, 10).forEach((row, index) => {
          output += `Registro ${index + 1}:\n`;
          columns.forEach(col => {
            output += `• ${col}: ${row[col]}\n`;
          });
          output += '\n';
        });
        
        if (resultArray.length > 10) {
          output += `... y ${resultArray.length - 10} registro(s) más`;
        }
        
        return output;

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error) {
    logger.error(`Error executing tool ${name}:`, error);
    throw error;
  }
}

export { COMPLETE_TOOLS };

// Endpoint completo con todas las herramientas (requiere autenticación)
router.post('/mcp-complete', authenticateApiKey, async (req, res) => {
  const request: JSONRPCRequest = req.body;
  
  logger.info('MCP Complete request:', { method: request.method, params: request.params });
  
  try {
    switch (request.method) {
      case 'initialize':
        res.json(createSuccessResponse(request.id, {
          protocolVersion: '2024-11-05',
          capabilities: { 
            tools: { listChanged: false }
          },
          serverInfo: { 
            name: 'biosanarcall-mcp-complete', 
            version: '1.0.0' 
          }
        }));
        return;

      case 'tools/list':
        res.json(createSuccessResponse(request.id, { tools: COMPLETE_TOOLS }));
        return;

      case 'tools/call':
        const toolName = request.params?.name;
        const toolArgs = request.params?.arguments || {};
        
        if (!toolName) {
          return res.json(createErrorResponse(request.id, -32602, 'Missing tool name'));
        }

        const result = await executeCompleteTool(toolName, toolArgs);
        res.json(createSuccessResponse(request.id, {
          content: [{ type: 'text', text: result }]
        }));
        return;

      case 'ping':
        res.json(createSuccessResponse(request.id, {}));
        return;

      default:
        res.json(createErrorResponse(request.id, -32601, `Method not found: ${request.method}`));
        return;
    }
  } catch (error) {
    logger.error('MCP Complete endpoint error:', error);
    res.json(createErrorResponse(request.id, -32000, 
      error instanceof Error ? error.message : 'Internal error'));
  }
});

// Endpoint de demostración sin autenticación (solo para MCP Inspector)
router.post('/mcp-demo', async (req, res) => {
  const request: JSONRPCRequest = req.body;
  
  logger.info('MCP Demo request:', { method: request.method, params: request.params });
  
  try {
    switch (request.method) {
      case 'initialize':
        res.json(createSuccessResponse(request.id, {
          protocolVersion: '2024-11-05',
          capabilities: { 
            tools: { listChanged: false }
          },
          serverInfo: { 
            name: 'biosanarcall-mcp-demo', 
            version: '1.0.0' 
          }
        }));
        break;

      case 'tools/list':
        // Solo mostrar herramientas de lectura para demo
        const demoTools = COMPLETE_TOOLS.filter(tool => 
          tool.name.startsWith('get') || tool.name.startsWith('search')
        );
        res.json(createSuccessResponse(request.id, { tools: demoTools }));
        break;

      case 'tools/call':
        const demoToolName = request.params?.name;
        const demoToolArgs = request.params?.arguments || {};
        
        if (!demoToolName) {
          return res.json(createErrorResponse(request.id, -32602, 'Missing tool name'));
        }

        // Solo permitir herramientas de lectura en demo
        if (!demoToolName.startsWith('get') && !demoToolName.startsWith('search')) {
          return res.json(createErrorResponse(request.id, -32601, 'Demo mode: only read operations allowed'));
        }

        const demoResult = await executeCompleteTool(demoToolName, demoToolArgs);
        res.json(createSuccessResponse(request.id, {
          content: [{ type: 'text', text: demoResult }]
        }));
        break;

      case 'ping':
        res.json(createSuccessResponse(request.id, {}));
        break;

      default:
        res.json(createErrorResponse(request.id, -32601, `Method not found: ${request.method}`));
    }
  } catch (error) {
    logger.error('MCP Demo endpoint error:', error);
    res.json(createErrorResponse(request.id, -32000, 
      error instanceof Error ? error.message : 'Internal error'));
  }
});

export default router;
