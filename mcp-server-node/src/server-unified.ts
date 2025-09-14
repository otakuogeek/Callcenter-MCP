import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { setupPatientModularRoutes } from './patient-modular';

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

// Herramientas MCP unificadas - Sistema médico completo
const UNIFIED_TOOLS = [
  // === PACIENTES ===
  {
    name: 'searchPatients',
    description: 'Buscar pacientes por nombre, documento o teléfono',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Término de búsqueda (nombre, documento, teléfono)' },
        limit: { type: 'number', description: 'Máximo resultados (1-100)', minimum: 1, maximum: 100, default: 20 }
      },
      required: ['q']
    }
  },
  {
    name: 'getPatient',
    description: 'Obtener información detallada de un paciente por ID',
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
    description: 'Crear nuevo paciente en el sistema',
    inputSchema: {
      type: 'object',
      properties: {
        document: { type: 'string', description: 'Documento de identidad' },
        document_type_id: { type: 'number', description: 'ID del tipo de documento' },
        name: { type: 'string', description: 'Nombre completo' },
        phone: { type: 'string', description: 'Teléfono principal' },
        phone_alt: { type: 'string', description: 'Teléfono alternativo' },
        email: { type: 'string', description: 'Email' },
        birth_date: { type: 'string', description: 'Fecha nacimiento YYYY-MM-DD' },
        gender: { type: 'string', enum: ['Masculino','Femenino','Otro','No especificado'], description: 'Género' },
        address: { type: 'string', description: 'Dirección' },
        municipality_id: { type: 'number', description: 'ID del municipio' },
        zone_id: { type: 'number', description: 'ID de la zona' },
        insurance_eps_id: { type: 'number', description: 'ID de la EPS' },
        insurance_affiliation_type: { type: 'string', enum: ['Contributivo','Subsidiado','Vinculado','Particular','Otro'], description: 'Tipo de afiliación' },
        blood_group_id: { type: 'number', description: 'ID del grupo sanguíneo' },
        population_group_id: { type: 'number', description: 'ID del grupo poblacional' },
        education_level_id: { type: 'number', description: 'ID del nivel educativo' },
        marital_status_id: { type: 'number', description: 'ID del estado civil' },
        has_disability: { type: 'boolean', description: 'Tiene discapacidad', default: false },
        disability_type_id: { type: 'number', description: 'ID del tipo de discapacidad' },
        estrato: { type: 'number', description: 'Estrato socioeconómico (0-6)', minimum: 0, maximum: 6 },
        notes: { type: 'string', description: 'Notas adicionales' }
      },
      required: [
        'document', 
        'document_type_id',
        'name', 
        'birth_date',
        'gender',
        'address',
        'municipality_id',
        'phone',
        'email',
        'insurance_eps_id',
        'insurance_affiliation_type',
        'blood_group_id',
        'population_group_id',
        'education_level_id',
        'marital_status_id',
        'estrato'
      ]
    }
  },
  {
    name: 'updatePatient',
    description: 'Actualizar información de un paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        name: { type: 'string', description: 'Nombre completo' },
        phone: { type: 'string', description: 'Teléfono principal' },
        phone_alt: { type: 'string', description: 'Teléfono alternativo' },
        email: { type: 'string', description: 'Email' },
        address: { type: 'string', description: 'Dirección' },
        municipality_id: { type: 'number', description: 'ID del municipio' },
        zone_id: { type: 'number', description: 'ID de la zona' },
        insurance_eps_id: { type: 'number', description: 'ID de la EPS' },
        insurance_affiliation_type: { type: 'string', enum: ['Contributivo','Subsidiado','Vinculado','Particular','Otro'], description: 'Tipo de afiliación' },
        blood_group_id: { type: 'number', description: 'ID del grupo sanguíneo' },
        population_group_id: { type: 'number', description: 'ID del grupo poblacional' },
        education_level_id: { type: 'number', description: 'ID del nivel educativo' },
        marital_status_id: { type: 'number', description: 'ID del estado civil' },
        has_disability: { type: 'boolean', description: 'Tiene discapacidad' },
        disability_type_id: { type: 'number', description: 'ID del tipo de discapacidad' },
        estrato: { type: 'number', description: 'Estrato socioeconómico (0-6)', minimum: 0, maximum: 6 },
        notes: { type: 'string', description: 'Notas adicionales' },
        status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado del paciente' }
      },
      required: ['patient_id']
    }
  },

  // === CITAS ===
  {
    name: 'getAppointments',
    description: 'Obtener citas por fecha específica',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' },
        status: { type: 'string', enum: ['Pendiente','Confirmada','Completada','Cancelada'], description: 'Filtrar por estado' },
        patient_id: { type: 'number', description: 'Filtrar por paciente' },
        doctor_id: { type: 'number', description: 'Filtrar por médico' }
      }
    }
  },
  {
    name: 'createAppointment',
    description: 'Crear nueva cita médica',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' },
        location_id: { type: 'number', description: 'ID de la sede' },
        scheduled_at: { type: 'string', description: 'Fecha y hora YYYY-MM-DD HH:MM:SS' },
        duration_minutes: { type: 'number', description: 'Duración en minutos', default: 30 },
        appointment_type: { type: 'string', enum: ['Presencial', 'Telemedicina'], description: 'Tipo de cita' },
        reason: { type: 'string', description: 'Motivo de la cita' }
      },
      required: ['patient_id', 'doctor_id', 'specialty_id', 'location_id', 'scheduled_at']
    }
  },
  {
    name: 'updateAppointmentStatus',
    description: 'Actualizar estado de una cita',
    inputSchema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'number', description: 'ID de la cita' },
        status: { type: 'string', enum: ['Pendiente','Confirmada','Completada','Cancelada'], description: 'Nuevo estado' },
        notes: { type: 'string', description: 'Notas adicionales' },
        cancellation_reason: { type: 'string', description: 'Razón de cancelación (si aplica)' }
      },
      required: ['appointment_id', 'status']
    }
  },

  // === MÉDICOS ===
  {
    name: 'getDoctors',
    description: 'Listar médicos con sus especialidades y ubicaciones',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: { type: 'boolean', description: 'Solo médicos activos', default: true },
        specialty_id: { type: 'number', description: 'Filtrar por especialidad' },
        location_id: { type: 'number', description: 'Filtrar por ubicación' }
      }
    }
  },
  {
    name: 'createDoctor',
    description: 'Crear nuevo médico en el sistema',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre completo' },
        email: { type: 'string', description: 'Email' },
        phone: { type: 'string', description: 'Teléfono' },
        license_number: { type: 'string', description: 'Número de licencia médica' },
        specialties: { type: 'array', items: { type: 'number' }, description: 'IDs de especialidades' },
        locations: { type: 'array', items: { type: 'number' }, description: 'IDs de ubicaciones' }
      },
      required: ['name', 'license_number']
    }
  },

  // === ESPECIALIDADES ===
  {
    name: 'getSpecialties',
    description: 'Listar todas las especialidades médicas',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: { type: 'boolean', description: 'Solo especialidades activas', default: true }
      }
    }
  },
  {
    name: 'createSpecialty',
    description: 'Crear nueva especialidad médica',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la especialidad' },
        description: { type: 'string', description: 'Descripción' },
        default_duration_minutes: { type: 'number', description: 'Duración por defecto en minutos', default: 30 }
      },
      required: ['name']
    }
  },

  // === UBICACIONES ===
  {
    name: 'getLocations',
    description: 'Listar sedes/ubicaciones disponibles',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: { type: 'boolean', description: 'Solo ubicaciones activas', default: true }
      }
    }
  },
  {
    name: 'createLocation',
    description: 'Crear nueva sede/ubicación',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la sede' },
        address: { type: 'string', description: 'Dirección' },
        phone: { type: 'string', description: 'Teléfono' },
        type: { type: 'string', description: 'Tipo de ubicación', default: 'Sucursal' },
        capacity: { type: 'number', description: 'Capacidad', default: 0 }
      },
      required: ['name']
    }
  },

  // === CONSULTAS ESPECIALES ===
  {
    name: 'getDaySummary',
    description: 'Resumen completo del día con estadísticas de citas',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
      }
    }
  },
  {
    name: 'getPatientHistory',
    description: 'Historial completo de citas de un paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        limit: { type: 'number', description: 'Número máximo de registros', default: 10 }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'getDoctorSchedule',
    description: 'Agenda de un médico en una fecha específica',
    inputSchema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'number', description: 'ID del médico' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
      },
      required: ['doctor_id']
    }
  },

  // === TABLAS LOOKUP ===
  {
    name: 'getDocumentTypes',
    description: 'Obtener tipos de documento disponibles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'getBloodGroups',
    description: 'Obtener grupos sanguíneos disponibles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'getEducationLevels',
    description: 'Obtener niveles educativos disponibles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'getMaritalStatuses',
    description: 'Obtener estados civiles disponibles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'getPopulationGroups',
    description: 'Obtener grupos poblacionales disponibles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'getDisabilityTypes',
    description: 'Obtener tipos de discapacidad disponibles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'getMunicipalities',
    description: 'Obtener municipios disponibles',
    inputSchema: {
      type: 'object',
      properties: {
        zone_id: { type: 'number', description: 'Filtrar por zona' }
      }
    }
  },
  {
    name: 'getZones',
    description: 'Obtener zonas disponibles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'getEPS',
    description: 'Obtener EPS disponibles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  {
    name: 'executeCustomQuery',
    description: 'Ejecutar consulta SQL personalizada (solo SELECT)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Consulta SQL SELECT' },
        params: { type: 'array', description: 'Parámetros para la consulta', items: { type: 'string' } }
      },
      required: ['query']
    }
  },

  // === MEMORIA CONVERSACIONAL ===
  {
    name: 'initializeMemory',
    description: 'Inicializar memoria de conversación para un paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_document: { type: 'string', description: 'Documento del paciente' },
        session_id: { type: 'string', description: 'ID único de la sesión' },
        purpose: { type: 'string', description: 'Propósito de la conversación (registro, cita, consulta)', default: 'general' }
      },
      required: ['patient_document', 'session_id']
    }
  },
  {
    name: 'addToMemory',
    description: 'Agregar información a la memoria de conversación',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'ID de la sesión' },
        type: { type: 'string', enum: ['question', 'answer', 'action', 'verification'], description: 'Tipo de interacción' },
        content: { type: 'string', description: 'Contenido de la interacción' },
        field: { type: 'string', description: 'Campo relacionado (opcional)' },
        data: { type: 'object', description: 'Datos adicionales (opcional)' }
      },
      required: ['session_id', 'type', 'content']
    }
  },
  {
    name: 'checkMemory',
    description: 'Verificar si existe información específica en la memoria',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'ID de la sesión' },
        field: { type: 'string', description: 'Campo a verificar' }
      },
      required: ['session_id', 'field']
    }
  },
  {
    name: 'getMemory',
    description: 'Obtener memoria completa de la conversación',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'ID de la sesión' }
      },
      required: ['session_id']
    }
  },
  {
    name: 'updateContext',
    description: 'Actualizar contexto de la conversación',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'ID de la sesión' },
        current_step: { type: 'string', description: 'Paso actual de la conversación' },
        purpose: { type: 'string', description: 'Propósito actualizado' },
        topics_discussed: { type: 'array', items: { type: 'string' }, description: 'Temas discutidos' },
        voice_preferences: { type: 'object', description: 'Preferencias de voz' },
        medical_context: { type: 'object', description: 'Contexto médico actualizado' }
      },
      required: ['session_id']
    }
  },
  {
    name: 'closeMemory',
    description: 'Cerrar sesión de memoria de conversación',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'ID de la sesión' },
        reason: { type: 'string', description: 'Razón del cierre', default: 'completed' }
      },
      required: ['session_id']
    }
  },
  {
    name: 'searchMemory',
    description: 'Buscar información específica en la memoria de conversación',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'ID de la sesión' },
        query: { type: 'string', description: 'Término de búsqueda' },
        type: { type: 'string', description: 'Tipo específico de interacción (opcional)' }
      },
      required: ['session_id', 'query']
    }
  },
  {
    name: 'getMemoryStats',
    description: 'Obtener estadísticas de rendimiento del sistema de memoria',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  // === DISPONIBILIDADES ===
  {
    name: 'getAvailabilities',
    description: 'Obtener disponibilidades de médicos por fecha y filtros',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional)' },
        doctor_id: { type: 'number', description: 'ID del médico (opcional)' },
        specialty_id: { type: 'number', description: 'ID de la especialidad (opcional)' },
        location_id: { type: 'number', description: 'ID de la ubicación (opcional)' },
        status: { type: 'string', enum: ['Activa', 'Cancelada', 'Completa'], description: 'Estado (opcional)' }
      }
    }
  },
  {
    name: 'createAvailability',
    description: 'Crear nueva disponibilidad para un médico',
    inputSchema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'number', description: 'ID del médico' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' },
        location_id: { type: 'number', description: 'ID de la ubicación' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        start_time: { type: 'string', description: 'Hora inicio HH:MM' },
        end_time: { type: 'string', description: 'Hora fin HH:MM' },
        capacity: { type: 'number', description: 'Capacidad de pacientes' },
        duration_minutes: { type: 'number', description: 'Duración por cita en minutos', default: 30 },
        notes: { type: 'string', description: 'Notas adicionales (opcional)' }
      },
      required: ['doctor_id', 'specialty_id', 'location_id', 'date', 'start_time', 'end_time', 'capacity']
    }
  },
  {
    name: 'updateAvailability',
    description: 'Actualizar disponibilidad existente',
    inputSchema: {
      type: 'object',
      properties: {
        availability_id: { type: 'number', description: 'ID de la disponibilidad' },
        capacity: { type: 'number', description: 'Nueva capacidad' },
        status: { type: 'string', enum: ['Activa', 'Cancelada', 'Completa'], description: 'Nuevo estado' },
        notes: { type: 'string', description: 'Notas actualizadas' }
      },
      required: ['availability_id']
    }
  },
  // === RELACIONES MÉDICO-ESPECIALIDAD ===
  {
    name: 'assignSpecialtyToDoctor',
    description: 'Asignar especialidad a un médico',
    inputSchema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'number', description: 'ID del médico' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' }
      },
      required: ['doctor_id', 'specialty_id']
    }
  },
  {
    name: 'removeSpecialtyFromDoctor',
    description: 'Remover especialidad de un médico',
    inputSchema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'number', description: 'ID del médico' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' }
      },
      required: ['doctor_id', 'specialty_id']
    }
  },
  // === ESTADÍSTICAS AVANZADAS ===
  {
    name: 'getDashboardStats',
    description: 'Obtener estadísticas completas del dashboard',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (opcional)' },
        date_to: { type: 'string', description: 'Fecha fin YYYY-MM-DD (opcional)' }
      }
    }
  },
  {
    name: 'getAppointmentStats',
    description: 'Estadísticas detalladas de citas por período',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        doctor_id: { type: 'number', description: 'ID del médico (opcional)' },
        specialty_id: { type: 'number', description: 'ID de la especialidad (opcional)' }
      },
      required: ['date_from', 'date_to']
    }
  }
];

// Implementación de herramientas
async function executeToolCall(name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case 'searchPatients':
        return await searchPatients(args.q, args.limit || 20);
      
      case 'getPatient':
        return await getPatientById(args.patient_id);
      
      case 'createPatient':
        return await createPatient(args);
      
      case 'updatePatient':
        return await updatePatient(args.patient_id, args);
      
      case 'getAppointments':
        return await getAppointments(args);
      
      case 'createAppointment':
        return await createAppointment(args);
      
      case 'updateAppointmentStatus':
        return await updateAppointmentStatus(args.appointment_id, args);
      
      case 'getDoctors':
        return await getDoctors(args);
      
      case 'createDoctor':
        return await createDoctor(args);
      
      case 'getSpecialties':
        return await getSpecialties(args?.active_only !== false);
      
      case 'createSpecialty':
        return await createSpecialty(args);
      
      case 'getLocations':
        return await getLocations(args?.active_only !== false);
      
      case 'createLocation':
        return await createLocation(args);
      
      case 'getDaySummary':
        return await getDaySummary(args.date);
      
      case 'getPatientHistory':
        return await getPatientHistory(args.patient_id, args.limit || 10);
      
      case 'getDoctorSchedule':
        return await getDoctorSchedule(args.doctor_id, args.date);
      
      case 'getDocumentTypes':
        return await getDocumentTypes();
      
      case 'getBloodGroups':
        return await getBloodGroups();
      
      case 'getEducationLevels':
        return await getEducationLevels();
      
      case 'getMaritalStatuses':
        return await getMaritalStatuses();
      
      case 'getPopulationGroups':
        return await getPopulationGroups();
      
      case 'getDisabilityTypes':
        return await getDisabilityTypes();
      
      case 'getMunicipalities':
        return await getMunicipalities(args.zone_id);
      
      case 'getZones':
        return await getZones();
      
      case 'getEPS':
        return await getEPS();
      
      case 'executeCustomQuery':
        return await executeCustomQuery(args.query, args.params);
      
      // === MEMORIA CONVERSACIONAL ===
      case 'initializeMemory':
        const { ConversationMemoryManager } = await import('./memory-manager.js');
        return await ConversationMemoryManager.initializeMemory(args.session_id || args.patient_document, args.purpose || 'patient_consultation');
      
      case 'addToMemory':
        const { ConversationMemoryManager: CMM1 } = await import('./memory-manager.js');
        return await CMM1.addToMemory(args.session_id, args.type, args.content, args.field, args.data);
      
      case 'checkMemory':
        const { ConversationMemoryManager: CMM2 } = await import('./memory-manager.js');
        return await CMM2.checkMemory(args.session_id, args.field);
      
      case 'getMemory':
        const { ConversationMemoryManager: CMM3 } = await import('./memory-manager.js');
        return await CMM3.getMemory(args.session_id);
      
      case 'updateContext':
        const { ConversationMemoryManager: CMM4 } = await import('./memory-manager.js');
        return await CMM4.updateContext(args.session_id, {
          current_step: args.current_step,
          purpose: args.purpose,
          topics_discussed: args.topics_discussed || [],
          voice_preferences: args.voice_preferences,
          medical_context: args.medical_context
        });
      
      case 'closeMemory':
        const { ConversationMemoryManager: CMM5 } = await import('./memory-manager.js');
        return await CMM5.closeMemory(args.session_id, args.reason);
      
      case 'searchMemory':
        const { ConversationMemoryManager: CMM6 } = await import('./memory-manager.js');
        return await CMM6.searchMemory(args.session_id, args.query, args.type);
      
      case 'getMemoryStats':
        const { ConversationMemoryManager: CMM7 } = await import('./memory-manager.js');
        return await CMM7.getMemoryStats();
      
      // === DISPONIBILIDADES ===
      case 'getAvailabilities':
        return await getAvailabilities(args);
      
      case 'createAvailability':
        return await createAvailability(args);
      
      case 'updateAvailability':
        return await updateAvailability(args.availability_id, args);
      
      // === RELACIONES MÉDICO-ESPECIALIDAD ===
      case 'assignSpecialtyToDoctor':
        return await assignSpecialtyToDoctor(args.doctor_id, args.specialty_id);
      
      case 'removeSpecialtyFromDoctor':
        return await removeSpecialtyFromDoctor(args.doctor_id, args.specialty_id);
      
      // === ESTADÍSTICAS AVANZADAS ===
      case 'getDashboardStats':
        return await getDashboardStats(args);
      
      case 'getAppointmentStats':
        return await getAppointmentStats(args);
      
      default:
        throw new Error(`Herramienta no implementada: ${name}`);
    }
  } catch (error: any) {
    console.error(`Error ejecutando ${name}:`, error);
    throw new Error(`Error en ${name}: ${error.message}`);
  }
}

// === IMPLEMENTACIONES DE FUNCIONES ===

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

// === CONFIGURACIÓN DE RUTAS MODULARES ===
// Configurar las nuevas rutas modulares de pacientes
setupPatientModularRoutes(app, pool);

// === ENDPOINTS MCP ===

// Endpoint principal para tools/list
app.post('/mcp-unified', async (req, res) => {
  try {
    const request: JSONRPCRequest = req.body;
    
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
