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
    name: 'listZones',
    description: 'Consulta las zonas geográficas disponibles en el sistema. Retorna ID, nombre y descripción de cada zona.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getEPSServices',
    description: 'Consulta los servicios (especialidades y sedes) autorizados para una EPS específica. Retorna solo los servicios activos y no expirados. Útil para saber qué especialidades y sedes puede usar un paciente según su EPS.',
    inputSchema: {
      type: 'object',
      properties: {
        eps_id: {
          type: 'number',
          description: 'ID de la EPS para consultar sus servicios autorizados (obligatorio). Use listActiveEPS para obtener los IDs disponibles.'
        }
      },
      required: ['eps_id']
    }
  },
  {
    name: 'searchPatient',
    description: 'Busca y consulta pacientes en la base de datos. Puede buscar por documento (cédula), nombre, teléfono o ID. Solo muestra pacientes ACTIVOS. Si el paciente existe pero está inactivo, no aparecerá en los resultados. Útil para verificar si un paciente ya está registrado antes de crear uno nuevo.',
    inputSchema: {
      type: 'object',
      properties: {
        document: {
          type: 'string',
          description: 'Número de cédula o documento de identidad para buscar (opcional)'
        },
        name: {
          type: 'string',
          description: 'Nombre completo o parcial del paciente para buscar (opcional)'
        },
        phone: {
          type: 'string',
          description: 'Número de teléfono para buscar (opcional)'
        },
        patient_id: {
          type: 'number',
          description: 'ID del paciente para consultar datos completos (opcional)'
        }
      },
      required: []
    }
  },
  {
    name: 'registerPatientSimple',
    description: 'Registro completo de pacientes con datos obligatorios: documento, nombre, teléfono, fecha de nacimiento, género, zona e EPS. Todos estos campos son REQUERIDOS para completar el registro.',
    inputSchema: {
      type: 'object',
      properties: {
        document: { 
          type: 'string', 
          description: 'Cédula o documento de identidad del paciente (OBLIGATORIO)' 
        },
        name: { 
          type: 'string', 
          description: 'Nombre completo del paciente (OBLIGATORIO)' 
        },
        phone: { 
          type: 'string', 
          description: 'Número de teléfono principal (OBLIGATORIO)' 
        },
        phone_alt: { 
          type: 'string', 
          description: 'Número de teléfono alternativo/secundario (OPCIONAL)' 
        },
        birth_date: {
          type: 'string',
          description: 'Fecha de nacimiento en formato YYYY-MM-DD (OBLIGATORIO)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        gender: {
          type: 'string',
          enum: ['Masculino', 'Femenino', 'Otro', 'No especificado'],
          description: 'Género del paciente (OBLIGATORIO)'
        },
        zone_id: {
          type: 'number',
          description: 'ID de la zona geográfica (OBLIGATORIO). Use listZones para consultar zonas disponibles'
        },
        insurance_eps_id: { 
          type: 'number', 
          description: 'ID de la EPS (OBLIGATORIO). Use listActiveEPS para consultar EPS disponibles' 
        },
        notes: { 
          type: 'string', 
          description: 'Notas adicionales opcionales sobre el paciente' 
        }
      },
      required: ['document', 'name', 'phone', 'birth_date', 'gender', 'zone_id', 'insurance_eps_id']
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
    description: 'Asigna una cita médica al paciente. Actualiza la disponibilidad y crea el registro de la cita. IMPORTANTE: Medicina General (ID 1) y Odontología (ID 5) permiten agendar en CUALQUIER DÍA mientras exista disponibilidad. Otras especialidades requieren que la fecha coincida exactamente con la availability.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'number',
          description: 'ID del paciente (obtenido de registerPatientSimple)'
        },
        availability_id: {
          type: 'number',
          description: 'ID de la disponibilidad (obtenido de getAvailableAppointments o checkAvailabilityQuota)'
        },
        scheduled_date: {
          type: 'string',
          description: 'Fecha y hora de la cita en formato YYYY-MM-DD HH:MM:SS. Para Medicina General y Odontología puede ser cualquier día futuro. Para otras especialidades debe coincidir con la fecha de la availability.',
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
    name: 'addToWaitingList',
    description: 'Agrega un paciente a la lista de espera cuando NO hay cupos disponibles para la especialidad solicitada. Lista de espera = NO HAY DISPONIBILIDAD. Solo requiere patient_id, specialty_id y reason. El doctor y la cita se asignarán posteriormente cuando haya disponibilidad. IMPORTANTE: La respuesta incluye available_specialties con el listado COMPLETO de todas las especialidades disponibles (incluyendo IDs), permitiendo agendar en cualquier especialidad incluso si no está autorizada por la EPS del paciente.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'number',
          description: 'ID del paciente (obtenido de registerPatientSimple o searchPatient)'
        },
        specialty_id: {
          type: 'number',
          description: 'ID de la especialidad solicitada (usa available_specialties de la respuesta para obtener los IDs). Ejemplos: 1=Medicina General, 3=Cardiología, 5=Odontología, 7=Psicología, etc.'
        },
        cups_id: {
          type: 'number',
          description: 'ID del procedimiento CUPS (OPCIONAL - obtenido de searchCups). Ej: 325 para Ecografía de mama (código 881201). Si se proporciona, se almacenará la referencia al procedimiento específico solicitado.'
        },
        scheduled_date: {
          type: 'string',
          description: 'Fecha y hora deseada en formato YYYY-MM-DD HH:MM:SS (OPCIONAL - no se sabe cuándo se podrá asignar, se asignará cuando haya cupo disponible)',
          pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$'
        },
        appointment_type: {
          type: 'string',
          enum: ['Presencial', 'Telemedicina'],
          description: 'Tipo de consulta deseada',
          default: 'Presencial'
        },
        reason: {
          type: 'string',
          description: 'Motivo de la consulta (obligatorio)'
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales sobre la solicitud (opcional)'
        },
        priority_level: {
          type: 'string',
          enum: ['Baja', 'Normal', 'Alta', 'Urgente'],
          description: 'Nivel de prioridad - determina posición en cola',
          default: 'Normal'
        },
        requested_by: {
          type: 'string',
          description: 'Quién solicita (operadora, sistema, etc.)',
          default: 'Sistema_MCP'
        },
        call_type: {
          type: 'string',
          enum: ['normal', 'reagendar'],
          description: 'Tipo de llamada que origina la solicitud',
          default: 'normal'
        }
      },
      required: ['patient_id', 'specialty_id', 'reason']
    }
  },
  {
    name: 'getPatientAppointments',
    description: 'Consulta todas las citas de un paciente (pasadas y futuras) con detalles completos de médico, especialidad, ubicación y estado. Puede buscar por patient_id O por document (cédula).',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'number',
          description: 'ID del paciente (opcional si se proporciona document)'
        },
        document: {
          type: 'string',
          description: 'Número de cédula o documento del paciente (opcional si se proporciona patient_id)'
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
      required: []
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
    name: 'searchSpecialties',
    description: 'Lista y busca especialidades médicas del sistema. Permite buscar por ID, nombre o listar todas. Retorna información completa incluyendo ID, nombre, descripción, duración y estado activo/inactivo. Útil para encontrar el specialty_id necesario para agendar citas o agregar a lista de espera.',
    inputSchema: {
      type: 'object',
      properties: {
        specialty_id: {
          type: 'number',
          description: 'ID de la especialidad a buscar (opcional, busca una específica)'
        },
        name: {
          type: 'string',
          description: 'Nombre o parte del nombre de la especialidad a buscar (opcional, búsqueda parcial)'
        },
        active_only: {
          type: 'boolean',
          description: 'Si es true, solo muestra especialidades activas. Si es false, muestra todas (default: false)',
          default: false
        }
      },
      required: []
    }
  },
  {
    name: 'searchCups',
    description: 'Busca procedimientos médicos en la tabla CUPS (Clasificación Única de Procedimientos en Salud). Permite buscar por código CUPS, nombre del procedimiento, categoría (ej: Ecografía) o especialidad. Retorna información completa incluyendo precio, duración estimada, requisitos de autorización, etc. Útil para identificar ecografías y otros procedimientos médicos.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Código CUPS a buscar (ej: 881201, 881302). Búsqueda exacta o parcial.'
        },
        name: {
          type: 'string',
          description: 'Nombre del procedimiento a buscar (búsqueda parcial, case-insensitive). Ej: "ecografia mama", "abdomen"'
        },
        category: {
          type: 'string',
          description: 'Categoría del procedimiento (ej: Ecografía, Laboratorio, Radiología)'
        },
        specialty_id: {
          type: 'number',
          description: 'ID de la especialidad asociada'
        },
        status: {
          type: 'string',
          enum: ['Activo', 'Inactivo', 'Descontinuado', 'Todos'],
          description: 'Filtrar por estado del procedimiento (default: Activo)',
          default: 'Activo'
        },
        limit: {
          type: 'number',
          description: 'Número máximo de resultados a retornar (default: 20, max: 100)',
          default: 20
        }
      },
      required: []
    }
  },
  {
    name: 'searchCupsByName',
    description: 'Búsqueda RÁPIDA de procedimientos CUPS por NOMBRE usando coincidencias parciales. Herramienta optimizada para encontrar procedimientos cuando solo conoce el nombre (ej: "mama", "abdomen", "hemograma"). Retorna ID, código y nombre del procedimiento. Ideal para obtener el cups_id necesario para addToWaitingList.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nombre o PARTE del nombre del procedimiento a buscar (case-insensitive). Ej: "mama" encuentra "ECOGRAFIA DE MAMA", "abdomen" encuentra "ECOGRAFIA DE ABDOMEN", etc.'
        },
        limit: {
          type: 'number',
          description: 'Número máximo de resultados a retornar (default: 10, max: 50)',
          default: 10
        }
      },
      required: ['name']
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
  },
  {
    name: 'registerPregnancy',
    description: 'Registra un nuevo embarazo para una paciente. Solo requiere la Fecha de Última Menstruación (FUM). El sistema calcula automáticamente: Fecha Probable de Parto (FPP = FUM + 280 días), semanas y días de gestación actual, días hasta el parto, y permite marcar como embarazo de alto riesgo. Debe usarse SOLO para pacientes de sexo femenino.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'number',
          description: 'ID de la paciente (obtenido de registerPatientSimple o búsqueda de paciente)'
        },
        last_menstrual_date: {
          type: 'string',
          description: 'Fecha de Última Menstruación (FUM) en formato YYYY-MM-DD o DD/MM/YYYY',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$|^\\d{2}/\\d{2}/\\d{4}$'
        },
        high_risk: {
          type: 'boolean',
          description: 'Indica si el embarazo es de alto riesgo (opcional, default: false)',
          default: false
        },
        risk_factors: {
          type: 'string',
          description: 'Factores de riesgo si es embarazo de alto riesgo (opcional)'
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales sobre el embarazo (opcional)'
        }
      },
      required: ['patient_id', 'last_menstrual_date']
    }
  },
  {
    name: 'getActivePregnancies',
    description: 'Consulta los embarazos activos. Puede filtrar por paciente específico o listar todos. Retorna información completa: edad gestacional actual (semanas y días), días hasta el parto, fecha probable de parto, nivel de riesgo, y cantidad de controles prenatales realizados.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'number',
          description: 'ID de la paciente (opcional, filtra por paciente específico)'
        },
        high_risk_only: {
          type: 'boolean',
          description: 'Si es true, retorna solo embarazos de alto riesgo (opcional)',
          default: false
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
    name: 'updatePregnancyStatus',
    description: 'Actualiza el estado de un embarazo. Permite marcarlo como Completado (parto exitoso) o Interrumpido (aborto, muerte fetal, etc.). Al completar, se puede registrar información del parto: fecha, tipo de parto, género y peso del bebé.',
    inputSchema: {
      type: 'object',
      properties: {
        pregnancy_id: {
          type: 'number',
          description: 'ID del embarazo a actualizar'
        },
        status: {
          type: 'string',
          enum: ['Activa', 'Completada', 'Interrumpida'],
          description: 'Nuevo estado del embarazo'
        },
        delivery_date: {
          type: 'string',
          description: 'Fecha del parto (requerido si status=Completada, formato YYYY-MM-DD)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        delivery_type: {
          type: 'string',
          enum: ['Parto natural', 'Cesárea', 'Fórceps', 'Vacuum', 'Otro'],
          description: 'Tipo de parto (opcional si status=Completada)'
        },
        baby_gender: {
          type: 'string',
          enum: ['Masculino', 'Femenino', 'No especificado'],
          description: 'Género del bebé (opcional si status=Completada)'
        },
        baby_weight_grams: {
          type: 'number',
          description: 'Peso del bebé en gramos (opcional si status=Completada)'
        },
        interruption_date: {
          type: 'string',
          description: 'Fecha de interrupción (requerido si status=Interrumpida, formato YYYY-MM-DD)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        interruption_reason: {
          type: 'string',
          enum: ['Aborto espontáneo', 'Aborto terapéutico', 'Muerte fetal', 'Embarazo ectópico', 'Otra causa'],
          description: 'Razón de la interrupción (opcional si status=Interrumpida)'
        },
        interruption_notes: {
          type: 'string',
          description: 'Notas sobre la interrupción (opcional si status=Interrumpida)'
        },
        complications: {
          type: 'string',
          description: 'Complicaciones durante el embarazo o parto (opcional)'
        }
      },
      required: ['pregnancy_id', 'status']
    }
  },
  {
    name: 'registerPrenatalControl',
    description: 'Registra un control prenatal para un embarazo activo. Permite documentar: fecha del control, edad gestacional, peso, presión arterial, altura uterina, frecuencia cardíaca fetal, observaciones, recomendaciones, exámenes de laboratorio solicitados y ecografías realizadas.',
    inputSchema: {
      type: 'object',
      properties: {
        pregnancy_id: {
          type: 'number',
          description: 'ID del embarazo'
        },
        control_date: {
          type: 'string',
          description: 'Fecha del control prenatal (formato YYYY-MM-DD)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        gestational_weeks: {
          type: 'number',
          description: 'Semanas de gestación en el momento del control'
        },
        gestational_days: {
          type: 'number',
          description: 'Días adicionales de gestación (0-6, opcional)',
          default: 0
        },
        weight_kg: {
          type: 'number',
          description: 'Peso de la paciente en kilogramos (opcional)'
        },
        blood_pressure_systolic: {
          type: 'number',
          description: 'Presión arterial sistólica (opcional)'
        },
        blood_pressure_diastolic: {
          type: 'number',
          description: 'Presión arterial diastólica (opcional)'
        },
        fundal_height_cm: {
          type: 'number',
          description: 'Altura uterina en centímetros (opcional)'
        },
        fetal_heart_rate: {
          type: 'number',
          description: 'Frecuencia cardíaca fetal en latidos por minuto (opcional)'
        },
        observations: {
          type: 'string',
          description: 'Observaciones del control (opcional)'
        },
        recommendations: {
          type: 'string',
          description: 'Recomendaciones para la paciente (opcional)'
        },
        next_control_date: {
          type: 'string',
          description: 'Fecha sugerida para próximo control (formato YYYY-MM-DD, opcional)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        lab_tests_ordered: {
          type: 'string',
          description: 'Exámenes de laboratorio ordenados (opcional)'
        },
        ultrasound_performed: {
          type: 'boolean',
          description: 'Si se realizó ecografía (opcional, default: false)',
          default: false
        },
        ultrasound_notes: {
          type: 'string',
          description: 'Notas de la ecografía si se realizó (opcional)'
        }
      },
      required: ['pregnancy_id', 'control_date', 'gestational_weeks']
    }
  },
  {
    name: 'cancelAppointment',
    description: 'Cancela una cita médica existente y LIBERA AUTOMÁTICAMENTE el cupo en availability_distribution. Actualiza el estado a "Cancelada" y registra motivo de cancelación. Esta es la forma correcta de cancelar citas para mantener la consistencia de cupos.',
    inputSchema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'number',
          description: 'ID de la cita a cancelar'
        },
        cancellation_reason: {
          type: 'string',
          description: 'Motivo de la cancelación (requerido para trazabilidad)',
          minLength: 5
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales sobre la cancelación (opcional)'
        }
      },
      required: ['appointment_id', 'cancellation_reason']
    }
  },
  {
    name: 'syncAvailabilityQuotas',
    description: 'Sincroniza los cupos de availability_distribution con el conteo REAL de citas activas. Recalcula el campo "assigned" basándose en citas con estado Pendiente/Confirmada. Útil para corregir inconsistencias. Puede ejecutarse para un availability_id específico o para todos los disponibles.',
    inputSchema: {
      type: 'object',
      properties: {
        availability_id: {
          type: 'number',
          description: 'ID del availability a sincronizar. Si no se proporciona, sincroniza TODOS los availabilities.'
        },
        dry_run: {
          type: 'boolean',
          description: 'Si es true, solo muestra qué se actualizaría sin hacer cambios reales (default: false)',
          default: false
        }
      },
      required: []
    }
  },
  {
    name: 'auditAvailabilityQuotas',
    description: 'Audita la consistencia de cupos entre availability_distribution.assigned y el conteo real de citas activas. Identifica discrepancias y genera reporte detallado. NO hace cambios, solo reporta problemas.',
    inputSchema: {
      type: 'object',
      properties: {
        availability_id: {
          type: 'number',
          description: 'ID del availability a auditar. Si no se proporciona, audita TODOS.'
        },
        show_only_inconsistencies: {
          type: 'boolean',
          description: 'Si es true, solo muestra registros con inconsistencias (default: true)',
          default: true
        },
        limit: {
          type: 'number',
          description: 'Número máximo de registros a retornar (default: 50)',
          default: 50
        }
      },
      required: []
    }
  },
  {
    name: 'actualizarPhone',
    description: 'Consulta y actualiza los números telefónicos de un paciente usando su documento de identificación. Permite ver los teléfonos actuales y actualizar el teléfono principal, el teléfono alternativo, o ambos. Si solo desea consultar sin actualizar, no proporcione los parámetros de teléfonos nuevos.',
    inputSchema: {
      type: 'object',
      properties: {
        document: {
          type: 'string',
          description: 'Número de cédula o documento de identidad del paciente (OBLIGATORIO)'
        },
        new_phone: {
          type: 'string',
          description: 'Nuevo número de teléfono principal (OPCIONAL - solo si desea actualizarlo)'
        },
        new_phone_alt: {
          type: 'string',
          description: 'Nuevo número de teléfono alternativo/secundario (OPCIONAL - solo si desea actualizarlo o agregarlo)'
        }
      },
      required: ['document']
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
    
    if (name === 'listZones') {
      return await listZones();
    }
    
    if (name === 'getEPSServices') {
      return await getEPSServices(args.eps_id);
    }
    
    if (name === 'searchPatient') {
      return await searchPatient(args);
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
    
    if (name === 'addToWaitingList') {
      return await addToWaitingList(args);
    }
    
    if (name === 'getPatientAppointments') {
      return await getPatientAppointments(args);
    }
    
    if (name === 'getWaitingListAppointments') {
      return await getWaitingListAppointments(args);
    }
    
    if (name === 'searchSpecialties') {
      return await searchSpecialties(args);
    }
    
    if (name === 'searchCups') {
      return await searchCups(args);
    }
    
    if (name === 'searchCupsByName') {
      return await searchCupsByName(args);
    }
    
    if (name === 'reassignWaitingListAppointments') {
      return await reassignWaitingListAppointments(args);
    }
    
    if (name === 'registerPregnancy') {
      return await registerPregnancy(args);
    }
    
    if (name === 'getActivePregnancies') {
      return await getActivePregnancies(args);
    }
    
    if (name === 'updatePregnancyStatus') {
      return await updatePregnancyStatus(args);
    }
    
    if (name === 'registerPrenatalControl') {
      return await registerPrenatalControl(args);
    }
    
    if (name === 'cancelAppointment') {
      return await cancelAppointment(args);
    }
    
    if (name === 'syncAvailabilityQuotas') {
      return await syncAvailabilityQuotas(args);
    }
    
    if (name === 'auditAvailabilityQuotas') {
      return await auditAvailabilityQuotas(args);
    }
    
    if (name === 'actualizarPhone') {
      return await actualizarPhone(args);
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
    
    // Crear lista de presentación amigable (sin IDs)
    const displayList = epsList.map(eps => eps.name).join(', ');
    
    return {
      success: true,
      count: epsList.length,
      eps_list: epsList,
      display_list: displayList,
      message: `Se encontraron ${epsList.length} EPS activas disponibles`,
      usage_note: 'Use el campo "id" como insurance_eps_id para registrar pacientes con registerPatientSimple (opcional)',
      presentation_note: 'Al mencionar las EPS al paciente, use el campo "display_list" para una presentación más natural sin IDs'
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
// FUNCIÓN PARA LISTAR ZONAS GEOGRÁFICAS
// ===================================================================
async function listZones(): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        id,
        name,
        description,
        created_at
      FROM zones 
      ORDER BY name ASC
    `);
    
    const zonesList = (rows as any[]).map(zone => ({
      id: zone.id,
      name: zone.name,
      description: zone.description || '',
      created_at: zone.created_at
    }));
    
    // Crear lista de presentación amigable (sin IDs)
    const displayList = zonesList.map(zone => zone.name).join(' o ');
    
    return {
      success: true,
      count: zonesList.length,
      zones_list: zonesList,
      display_list: displayList,
      message: `Se encontraron ${zonesList.length} zonas disponibles`,
      usage_note: 'Use el campo "id" como zone_id para registrar pacientes con registerPatientSimple (OBLIGATORIO)',
      presentation_note: 'Al mencionar las zonas al paciente, use el campo "display_list" para una presentación más natural sin IDs'
    };
    
  } catch (error: any) {
    console.error('Error consultando zonas:', error);
    return {
      success: false,
      error: 'Error al consultar zonas',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN PARA CONSULTAR SERVICIOS AUTORIZADOS POR EPS
// ===================================================================
async function getEPSServices(eps_id: number): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    // Validar que eps_id sea proporcionado
    if (!eps_id) {
      return {
        success: false,
        error: 'El parámetro eps_id es obligatorio',
        usage: 'Proporcione el ID de la EPS para consultar sus servicios autorizados'
      };
    }

    // Consultar servicios autorizados con información completa
    const [rows] = await connection.execute(`
      SELECT 
        a.id as authorization_id,
        a.eps_id,
        e.name as eps_name,
        e.code as eps_code,
        a.specialty_id,
        s.name as specialty_name,
        s.description as specialty_description,
        a.location_id,
        l.name as location_name,
        l.address as location_address,
        a.authorized,
        a.authorization_date,
        a.expiration_date,
        a.max_monthly_appointments,
        a.copay_percentage,
        a.requires_prior_authorization,
        a.notes,
        a.created_at
      FROM eps_specialty_location_authorizations a
      INNER JOIN eps e ON a.eps_id = e.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE a.eps_id = ?
        AND a.authorized = 1
        AND (a.expiration_date IS NULL OR a.expiration_date >= CURDATE())
      ORDER BY s.name ASC, l.name ASC
    `, [eps_id]);

    const servicesList = (rows as any[]).map(service => ({
      authorization_id: service.authorization_id,
      eps: {
        id: service.eps_id,
        name: service.eps_name,
        code: service.eps_code
      },
      specialty: {
        id: service.specialty_id,
        name: service.specialty_name,
        description: service.specialty_description || ''
      },
      location: {
        id: service.location_id,
        name: service.location_name,
        address: service.location_address || ''
      },
      authorization_details: {
        authorized: service.authorized === 1,
        authorization_date: service.authorization_date,
        expiration_date: service.expiration_date,
        max_monthly_appointments: service.max_monthly_appointments,
        copay_percentage: service.copay_percentage,
        requires_prior_authorization: service.requires_prior_authorization === 1
      },
      notes: service.notes || '',
      created_at: service.created_at
    }));

    // Si no hay servicios autorizados
    if (servicesList.length === 0) {
      // Verificar si la EPS existe
      const [epsCheck] = await connection.execute(
        'SELECT id, name FROM eps WHERE id = ?',
        [eps_id]
      );

      if ((epsCheck as any[]).length === 0) {
        return {
          success: false,
          error: 'EPS no encontrada',
          message: `No existe una EPS con id ${eps_id}`,
          suggestion: 'Use la herramienta listActiveEPS para ver las EPS disponibles'
        };
      }

      const epsName = (epsCheck as any[])[0].name;
      return {
        success: true,
        found: false,
        eps_id: eps_id,
        eps_name: epsName,
        count: 0,
        services: [],
        message: `La EPS "${epsName}" no tiene servicios autorizados actualmente`,
        note: 'No hay especialidades ni sedes autorizadas para esta EPS o sus autorizaciones han expirado'
      };
    }

    // Crear lista de especialidades únicas para presentación
    const uniqueSpecialties = [...new Set(servicesList.map(s => s.specialty.name))];
    const specialtiesDisplay = uniqueSpecialties.join(', ');

    // Crear lista de sedes únicas
    const uniqueLocations = [...new Set(servicesList.map(s => s.location.name))];
    const locationsDisplay = uniqueLocations.join(', ');

    return {
      success: true,
      found: true,
      eps_id: eps_id,
      eps_name: servicesList[0].eps.name,
      eps_code: servicesList[0].eps.code,
      count: servicesList.length,
      services: servicesList,
      summary: {
        total_authorizations: servicesList.length,
        unique_specialties: uniqueSpecialties.length,
        unique_locations: uniqueLocations.length,
        specialties_list: uniqueSpecialties,
        locations_list: uniqueLocations,
        specialties_display: specialtiesDisplay,
        locations_display: locationsDisplay
      },
      message: `Se encontraron ${servicesList.length} servicio(s) autorizado(s) para ${servicesList[0].eps.name}`,
      usage_note: 'Los servicios listados son los únicos autorizados para esta EPS. Solo puede agendar citas en estas especialidades y sedes.',
      presentation_note: 'Al informar al paciente, use summary.specialties_display para mencionar las especialidades disponibles'
    };
    
  } catch (error: any) {
    console.error('Error consultando servicios de EPS:', error);
    return {
      success: false,
      error: 'Error al consultar servicios de EPS',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN PARA BUSCAR PACIENTES
// ===================================================================
async function searchPatient(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { document, name, phone, patient_id } = args;
    
    // Validar que al menos un criterio de búsqueda fue proporcionado
    if (!document && !name && !phone && !patient_id) {
      return {
        success: false,
        error: 'Debe proporcionar al menos un criterio de búsqueda',
        available_criteria: {
          document: 'Número de cédula o documento',
          name: 'Nombre completo o parcial',
          phone: 'Número de teléfono',
          patient_id: 'ID del paciente'
        }
      };
    }
    
    let query = `
      SELECT 
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
        p.notes,
        eps.id as eps_id,
        eps.name as eps_name,
        eps.code as eps_code,
        z.id as zone_id,
        z.name as zone_name,
        z.description as zone_description,
        m.name as municipality_name
      FROM patients p
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      WHERE p.status = 'Activo'
    `;
    
    const params: any[] = [];
    
    // Construir query dinámicamente según los criterios proporcionados
    if (patient_id) {
      query += ' AND p.id = ?';
      params.push(patient_id);
    }
    
    if (document) {
      query += ' AND p.document = ?';
      params.push(document);
    }
    
    if (name) {
      query += ' AND p.name LIKE ?';
      params.push(`%${name}%`);
    }
    
    if (phone) {
      query += ' AND p.phone LIKE ?';
      params.push(`%${phone}%`);
    }
    
    query += ' ORDER BY p.created_at DESC LIMIT 20';
    
    const [rows] = await connection.execute(query, params);
    const patients = rows as any[];
    
    if (patients.length === 0) {
      return {
        success: true,
        found: false,
        count: 0,
        message: 'No se encontraron pacientes activos con los criterios proporcionados',
        search_criteria: {
          document: document || null,
          name: name || null,
          phone: phone || null,
          patient_id: patient_id || null
        },
        note: 'Solo se muestran pacientes con estado ACTIVO'
      };
    }
    
    // Formatear resultados con edad calculada
    const patientsFormatted = patients.map(patient => {
      let age = null;
      if (patient.birth_date) {
        const birthDate = new Date(patient.birth_date);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
      
      return {
        id: patient.id,
        document: patient.document,
        name: patient.name,
        phone: patient.phone,
        phone_alt: patient.phone_alt || null,
        email: patient.email || null,
        birth_date: patient.birth_date,
        age: age,
        gender: patient.gender,
        address: patient.address || null,
        municipality: patient.municipality_name || null,
        zone: patient.zone_name ? {
          id: patient.zone_id,
          name: patient.zone_name,
          description: patient.zone_description
        } : null,
        eps: patient.eps_name ? {
          id: patient.eps_id,
          name: patient.eps_name,
          code: patient.eps_code
        } : null,
        status: patient.status,
        notes: patient.notes || null,
        created_at: patient.created_at
      };
    });
    
    return {
      success: true,
      found: true,
      count: patientsFormatted.length,
      patients: patientsFormatted,
      message: `Se encontraron ${patientsFormatted.length} paciente(s) activo(s)`,
      search_criteria: {
        document: document || null,
        name: name || null,
        phone: phone || null,
        patient_id: patient_id || null
      }
    };
    
  } catch (error: any) {
    console.error('Error buscando paciente:', error);
    return {
      success: false,
      error: 'Error al buscar paciente',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN DE REGISTRO COMPLETO DE PACIENTES
// ===================================================================
async function registerPatientSimple(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 1. Validar campos obligatorios
    const requiredFields = ['document', 'name', 'phone', 'birth_date', 'gender', 'zone_id', 'insurance_eps_id'];
    const missingFields = requiredFields.filter(field => !args[field]);
    
    if (missingFields.length > 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Campos obligatorios faltantes',
        missing_fields: missingFields,
        required_fields: {
          document: 'Número de cédula o documento',
          name: 'Nombre completo',
          phone: 'Número de teléfono',
          birth_date: 'Fecha de nacimiento (YYYY-MM-DD)',
          gender: 'Género (Masculino, Femenino, Otro, No especificado)',
          zone_id: 'ID de la zona (use listZones)',
          insurance_eps_id: 'ID de la EPS (use listActiveEPS)'
        }
      };
    }
    
    // 2. Validar formato de fecha de nacimiento
    const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthDateRegex.test(args.birth_date)) {
      await connection.rollback();
      return {
        success: false,
        error: 'Formato de fecha de nacimiento inválido',
        expected_format: 'YYYY-MM-DD',
        example: '1990-05-15'
      };
    }
    
    // 3. Validar género
    const validGenders = ['Masculino', 'Femenino', 'Otro', 'No especificado'];
    if (!validGenders.includes(args.gender)) {
      await connection.rollback();
      return {
        success: false,
        error: 'Género inválido',
        valid_values: validGenders,
        received: args.gender
      };
    }
    
    // 4. Validar duplicados
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
    
    // 5. Verificar que la EPS existe y está activa
    const [epsCheck] = await connection.execute(`
      SELECT id, name, code FROM eps WHERE id = ? AND status = 'active'
    `, [args.insurance_eps_id]);
    
    if ((epsCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'EPS no válida o inactiva',
        provided_eps_id: args.insurance_eps_id,
        suggestion: 'Use la herramienta listActiveEPS para consultar las EPS disponibles'
      };
    }
    
    // 6. Verificar que la zona existe
    const [zoneCheck] = await connection.execute(`
      SELECT id, name FROM zones WHERE id = ?
    `, [args.zone_id]);
    
    if ((zoneCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Zona no válida',
        provided_zone_id: args.zone_id,
        suggestion: 'Use la herramienta listZones para consultar las zonas disponibles'
      };
    }
    
    // 7. Insertar paciente con todos los datos obligatorios
    const [result] = await connection.execute(`
      INSERT INTO patients (
        document, name, phone, phone_alt, birth_date, gender, 
        zone_id, insurance_eps_id, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', NOW())
    `, [
      args.document,
      args.name.trim(),
      args.phone,
      args.phone_alt || null,
      args.birth_date,
      args.gender,
      args.zone_id,
      args.insurance_eps_id,
      args.notes || null
    ]);
    
    const patient_id = (result as any).insertId;
    await connection.commit();
    
    // 8. Obtener datos completos del paciente creado
    const [patientData] = await connection.execute(`
      SELECT 
        p.id, p.document, p.name, p.phone, p.phone_alt, p.birth_date, p.gender, 
        p.status, p.created_at,
        eps.name as eps_name, eps.code as eps_code,
        z.name as zone_name, z.description as zone_description
      FROM patients p
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN zones z ON p.zone_id = z.id
      WHERE p.id = ?
    `, [patient_id]);
    
    const patient = (patientData as any[])[0];
    
    // Calcular edad
    const birthDate = new Date(patient.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return {
      success: true,
      message: 'Paciente registrado exitosamente',
      patient_id: patient_id,
      patient: {
        id: patient.id,
        document: patient.document,
        name: patient.name,
        phone: patient.phone,
        phone_alt: patient.phone_alt,
        birth_date: patient.birth_date,
        age: age,
        gender: patient.gender,
        zone: {
          name: patient.zone_name,
          description: patient.zone_description
        },
        eps: {
          name: patient.eps_name,
          code: patient.eps_code
        },
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
    const requestedDate = scheduled_date.split(' ')[0]; // "2025-10-15"
    
    // 4. ESPECIALIDADES FLEXIBLES: Medicina General (ID 1) y Odontología (ID 5)
    // Permiten agendar en cualquier día mientras exista disponibilidad
    const flexibleSpecialties = [1, 5]; // 1 = Medicina General, 5 = Odontología
    const isFlexibleSpecialty = flexibleSpecialties.includes(availability.specialty_id);
    
    // 4.1 Para especialidades NO flexibles, verificar coincidencia de fecha
    if (!isFlexibleSpecialty) {
      const availabilityDate = availability.date.toISOString().split('T')[0];
      if (requestedDate !== availabilityDate) {
        await connection.rollback();
        return {
          success: false,
          error: `La fecha de la cita (${requestedDate}) no coincide con la disponibilidad del doctor (${availabilityDate})`,
          info: `La especialidad ${availability.specialty_name} requiere que la fecha de la cita coincida exactamente con la fecha de la availability`
        };
      }
    }
    
    // 4.2 Para especialidades flexibles, solo verificar que la fecha no sea pasada
    if (isFlexibleSpecialty) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const requestedDateObj = new Date(requestedDate);
      
      if (requestedDateObj < today) {
        await connection.rollback();
        return {
          success: false,
          error: `No se puede agendar una cita en fecha pasada (${requestedDate})`,
          info: `${availability.specialty_name} permite fechas flexibles, pero deben ser futuras`
        };
      }
    }
    
    // 4.5. CALCULAR PRÓXIMA HORA DISPONIBLE
    // Buscar la última cita agendada para esta availability en esta fecha
    const [lastAppointment] = await connection.execute(`
      SELECT 
        scheduled_at,
        duration_minutes,
        DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) as end_time
      FROM appointments
      WHERE availability_id = ?
        AND DATE(scheduled_at) = ?
        AND status IN ('Pendiente', 'Confirmada')
      ORDER BY scheduled_at DESC
      LIMIT 1
    `, [availability_id, requestedDate]);
    
    let calculatedDateTime: string;
    
    if ((lastAppointment as any[]).length > 0) {
      // Si hay citas previas, calcular siguiente hora disponible
      const lastAppt = (lastAppointment as any[])[0];
      const lastEndTime = new Date(lastAppt.end_time);
      
      // La nueva cita empieza justo cuando termina la anterior
      calculatedDateTime = lastEndTime.toISOString().slice(0, 19).replace('T', ' ');
      
      // Verificar que no exceda el end_time de la availability
      const availEndTime = `${requestedDate} ${availability.end_time}`;
      const availEnd = new Date(availEndTime);
      const newEnd = new Date(lastEndTime);
      newEnd.setMinutes(newEnd.getMinutes() + availability.duration_minutes);
      
      if (newEnd > availEnd) {
        await connection.rollback();
        return {
          success: false,
          error: 'No hay espacio en este horario. La nueva cita excedería el horario de cierre',
          details: {
            last_appointment_ends_at: lastEndTime.toISOString().slice(0, 19).replace('T', ' '),
            availability_ends_at: availEndTime,
            requested_duration: availability.duration_minutes
          },
          suggestion: 'Esta availability está llena. Intente con otra fecha u hora'
        };
      }
    } else {
      // Si no hay citas previas, usar el start_time de la availability
      calculatedDateTime = `${requestedDate} ${availability.start_time}`;
    }
    
    const scheduledDateTime = calculatedDateTime;
    const appointmentDate = requestedDate;
    
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
    
    // 6. NUEVA LÓGICA: Verificar si el paciente tiene cita activa
    // Un paciente solo puede tener 1 cita activa (Pendiente o Confirmada)
    // Si tiene una o más, se cancelan automáticamente TODAS para registrar la nueva
    const [activeAppointments] = await connection.execute(`
      SELECT 
        a.id,
        a.scheduled_at,
        a.status,
        a.availability_id,
        s.name as specialty_name,
        d.name as doctor_name,
        l.name as location_name
      FROM appointments a
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE a.patient_id = ? 
        AND a.status IN ('Pendiente', 'Confirmada')
      ORDER BY a.scheduled_at
    `, [patient_id]);
    
    let cancelledAppointments: any[] = [];
    
    if ((activeAppointments as any[]).length > 0) {
      // Tiene citas activas - cancelarlas TODAS automáticamente
      for (const oldAppointment of (activeAppointments as any[])) {
        // Cancelar cada cita anterior
        await connection.execute(`
          UPDATE appointments
          SET status = 'Cancelada',
              notes = CONCAT(IFNULL(notes, ''), ' | CANCELADA AUTOMÁTICAMENTE: Paciente solicitó nueva cita. Reagendado a ', ?)
          WHERE id = ?
        `, [scheduledDateTime, oldAppointment.id]);
        
        // Liberar el cupo de la availability anterior SOLO si hay cupos assigned > 0
        await connection.execute(`
          UPDATE availability_distribution ad
          INNER JOIN availabilities a ON ad.availability_id = a.id
          SET ad.assigned = ad.assigned - 1
          WHERE ad.availability_id = ?
            AND DATE(ad.day_date) = DATE(?)
            AND ad.assigned > 0
        `, [oldAppointment.availability_id, oldAppointment.scheduled_at]);
        
        cancelledAppointments.push({
          id: oldAppointment.id,
          scheduled_at: oldAppointment.scheduled_at,
          specialty: oldAppointment.specialty_name,
          doctor: oldAppointment.doctor_name,
          location: oldAppointment.location_name
        });
      }
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
        scheduled_at: scheduledDateTime, // Fecha y hora CALCULADA automáticamente
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
      scheduling_info: {
        requested_time: scheduled_date,
        calculated_time: scheduledDateTime,
        auto_scheduled: scheduledDateTime !== scheduled_date,
        message: scheduledDateTime !== scheduled_date 
          ? `La hora fue ajustada automáticamente para evitar solapamientos. Hora calculada: ${scheduledDateTime}`
          : 'Primera cita del día en esta availability'
      },
      cancelled_appointments: cancelledAppointments.length > 0 
        ? cancelledAppointments.map(appt => ({
            id: appt.id,
            scheduled_at: appt.scheduled_at,
            specialty: appt.specialty,
            doctor: appt.doctor,
            location: appt.location,
            reason: 'Cancelada automáticamente al solicitar nueva cita'
          }))
        : [],
      info: cancelledAppointments.length > 0
        ? `La cita fue registrada exitosamente. NOTA: Se cancelaron automáticamente ${cancelledAppointments.length} cita(s) anterior(es) y se liberaron los cupos.`
        : 'La cita fue registrada y el cupo actualizado exitosamente'
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
// FUNCIÓN: AGREGAR A LISTA DE ESPERA
// ===================================================================

// ===================================================================
// FUNCIÓN: AGREGAR A LISTA DE ESPERA (V1.7 - SIN availability_id)
// ===================================================================
async function addToWaitingList(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { 
      patient_id, 
      specialty_id,
      cups_id,
      scheduled_date,
      appointment_type = 'Presencial',
      reason,
      notes,
      priority_level = 'Normal',
      requested_by = 'Sistema_MCP',
      call_type = 'normal'
    } = args;
    
    // Validación: Solo requerimos patient_id, specialty_id y reason
    // NO requiere availability_id porque es LISTA DE ESPERA (no hay cupo disponible)
    // cups_id es OPCIONAL para especificar un procedimiento específico
    if (!patient_id || !specialty_id || !reason) {
      await connection.rollback();
      return {
        success: false,
        error: 'Faltan parámetros obligatorios para lista de espera',
        required: ['patient_id', 'specialty_id', 'reason'],
        provided: { patient_id, specialty_id, reason },
        note: 'Lista de espera NO requiere availability_id - Solo paciente, especialidad y motivo. cups_id es opcional.'
      };
    }
    
    const finalScheduledDate = scheduled_date || null;
    const finalNotes = notes || null;
    const finalCupsId = cups_id || null;
    
    // 1. Validar paciente activo
    const [patientCheck] = await connection.execute(
      `SELECT id, name, document, insurance_eps_id, phone, phone_alt 
       FROM patients 
       WHERE id = ? AND status = "Activo"`,
      [patient_id]
    );
    
    if ((patientCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Paciente no encontrado o inactivo',
        patient_id: patient_id
      };
    }
    
    const patient = (patientCheck as any[])[0];
    
    // 2. Validar que la especialidad existe (CUALQUIER especialidad - activa o inactiva)
    // Lista de espera permite TODAS las especialidades sin restricción
    const [specialtyCheck] = await connection.execute(
      `SELECT id, name, description FROM specialties WHERE id = ?`,
      [specialty_id]
    );
    
    if ((specialtyCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Especialidad no encontrada en el sistema',
        specialty_id: specialty_id
      };
    }
    
    const specialty = (specialtyCheck as any[])[0];
    
    // 2.5. Validar CUPS si se proporciona (OPCIONAL)
    let cupsInfo = null;
    if (finalCupsId) {
      const [cupsCheck] = await connection.execute(
        `SELECT id, code, name, category, specialty_id, price FROM cups WHERE id = ?`,
        [finalCupsId]
      );
      
      if ((cupsCheck as any[]).length === 0) {
        await connection.rollback();
        return {
          success: false,
          error: 'Procedimiento CUPS no encontrado',
          cups_id: finalCupsId,
          suggestion: 'Use searchCups para encontrar el ID correcto del procedimiento'
        };
      }
      
      cupsInfo = (cupsCheck as any[])[0];
    }
    
    // 3. Insertar en lista de espera (SIN availability_id - se asignará después)
    const [waitingInsert] = await connection.execute(`
      INSERT INTO appointments_waiting_list (
        patient_id, specialty_id, cups_id, availability_id, scheduled_date, 
        appointment_type, reason, notes, priority_level, 
        status, requested_by, call_type, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())
    `, [
      patient_id,
      specialty_id,
      finalCupsId,
      finalScheduledDate,
      appointment_type,
      reason,
      finalNotes,
      priority_level,
      requested_by,
      call_type
    ]);
    
    const waiting_list_id = (waitingInsert as any).insertId;
    
    // 4. Contar personas en lista de espera para esta especialidad
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total_waiting
      FROM appointments_waiting_list
      WHERE specialty_id = ? AND status = 'pending'
    `, [specialty_id]);
    
    const totalWaiting = (countResult as any[])[0].total_waiting;
    
    // 5. Calcular posición en cola según prioridad
    const [queueResult] = await connection.execute(`
      SELECT COUNT(*) + 1 as queue_position
      FROM appointments_waiting_list
      WHERE specialty_id = ?
        AND status = 'pending'
        AND id != ?
        AND (
          (priority_level = 'Urgente' AND ? != 'Urgente')
          OR (priority_level = 'Alta' AND ? NOT IN ('Urgente', 'Alta'))
          OR (priority_level = 'Normal' AND ? = 'Baja')
          OR (priority_level = ? AND created_at < NOW())
        )
    `, [specialty_id, waiting_list_id, priority_level, priority_level, priority_level, priority_level]);
    
    const queuePosition = (queueResult as any[])[0].queue_position;
    
    // 6. Obtener EPS del paciente
    const [epsInfo] = await connection.execute(
      'SELECT id, name, code FROM eps WHERE id = ?',
      [patient.insurance_eps_id]
    );
    
    const eps = (epsInfo as any[]).length > 0 ? (epsInfo as any[])[0] : null;
    
    // 7. Obtener TODAS las especialidades (activas E inactivas)
    // Para lista de espera NO hay restricciones
    const [allSpecialties] = await connection.execute(`
      SELECT id, name, description, default_duration_minutes, active
      FROM specialties
      ORDER BY name
    `);
    
    await connection.commit();
    
    // 8. Retornar respuesta completa
    return {
      success: true,
      message: 'Paciente agregado exitosamente a la lista de espera',
      waiting_list_id: waiting_list_id,
      status: 'pending',
      queue_info: {
        position: queuePosition,
        total_waiting_specialty: totalWaiting,
        priority_level: priority_level
      },
      patient: {
        id: patient.id,
        name: patient.name,
        document: patient.document,
        phone: patient.phone,
        phone_alt: patient.phone_alt,
        eps: eps ? {
          id: eps.id,
          name: eps.name,
          code: eps.code
        } : null
      },
      requested_for: {
        specialty: {
          id: specialty_id,
          name: specialty.name,
          description: specialty.description
        },
        cups_procedure: cupsInfo ? {
          id: cupsInfo.id,
          code: cupsInfo.code,
          name: cupsInfo.name,
          category: cupsInfo.category,
          price: parseFloat(cupsInfo.price)
        } : null,
        scheduled_date: finalScheduledDate,
        scheduled_date_status: finalScheduledDate ? 'Fecha específica solicitada' : 'Se asignará cuando haya cupo',
        appointment_type: appointment_type,
        reason: reason,
        notes: notes
      },
      available_specialties: (allSpecialties as any[]).map(sp => ({
        id: sp.id,
        name: sp.name,
        description: sp.description,
        duration_minutes: sp.default_duration_minutes,
        active: sp.active === 1
      })),
      info: `Agregado a lista de espera para ${specialty.name}${cupsInfo ? ` - ${cupsInfo.name} (${cupsInfo.code})` : ''} con prioridad ${priority_level}. Posición: ${queuePosition} de ${totalWaiting} personas.${finalScheduledDate ? ` Fecha deseada: ${finalScheduledDate}` : ' Se asignará cuando haya disponibilidad.'}`,
      next_steps: 'Un operador se comunicará para confirmar fecha y hora de su cita.',
      specialty_note: 'available_specialties contiene TODAS las especialidades del sistema (activas e inactivas). Lista de espera permite cualquier especialidad sin restricción.'
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error agregando a lista de espera:', error);
    return {
      success: false,
      error: 'Error al agregar a lista de espera',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

async function getPatientAppointments(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { patient_id, document, status = 'Todas', from_date } = args;
    
    // Validar que se proporcione al menos patient_id o document
    if (!patient_id && !document) {
      return {
        success: false,
        error: 'Debe proporcionar patient_id o document para buscar citas',
        required: 'patient_id OR document'
      };
    }
    
    let finalPatientId = patient_id;
    let patientInfo = null;
    
    // Si se proporciona document, buscar el patient_id
    if (!patient_id && document) {
      const [patientCheck] = await connection.execute(
        `SELECT id, name, document, phone, insurance_eps_id 
         FROM patients 
         WHERE document = ? AND status = "Activo"`,
        [document]
      );
      
      if ((patientCheck as any[]).length === 0) {
        return {
          success: false,
          error: 'Paciente no encontrado con ese documento',
          document: document,
          suggestion: 'Verifique el número de documento o use searchPatient para buscar'
        };
      }
      
      const patient = (patientCheck as any[])[0];
      finalPatientId = patient.id;
      patientInfo = patient;
    } else if (patient_id) {
      // Si se proporciona patient_id, obtener info del paciente
      const [patientCheck] = await connection.execute(
        `SELECT id, name, document, phone, insurance_eps_id 
         FROM patients 
         WHERE id = ? AND status = "Activo"`,
        [patient_id]
      );
      
      if ((patientCheck as any[]).length > 0) {
        patientInfo = (patientCheck as any[])[0];
      }
    }
    
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
    
    const params: any[] = [finalPatientId];
    
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
        patient: patientInfo ? {
          id: patientInfo.id,
          name: patientInfo.name,
          document: patientInfo.document,
          phone: patientInfo.phone
        } : null,
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
      patient: patientInfo ? {
        id: patientInfo.id,
        name: patientInfo.name,
        document: patientInfo.document,
        phone: patientInfo.phone
      } : null,
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
// FUNCIÓN: BUSCAR ESPECIALIDADES
// ===================================================================
async function searchSpecialties(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { 
      specialty_id,
      name,
      active_only = false
    } = args;
    
    let query = `
      SELECT 
        id,
        name,
        description,
        default_duration_minutes,
        active,
        created_at
      FROM specialties
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Filtro por ID específico
    if (specialty_id) {
      query += ` AND id = ?`;
      params.push(specialty_id);
    }
    
    // Filtro por nombre (búsqueda parcial, case-insensitive)
    if (name) {
      query += ` AND name LIKE ?`;
      params.push(`%${name}%`);
    }
    
    // Filtro por estado activo
    if (active_only) {
      query += ` AND active = 1`;
    }
    
    query += ` ORDER BY name`;
    
    const [specialties] = await connection.execute(query, params);
    const specialtiesList = specialties as any[];
    
    if (specialtiesList.length === 0) {
      return {
        success: false,
        message: 'No se encontraron especialidades con los criterios especificados',
        search_criteria: {
          specialty_id: specialty_id || 'No especificado',
          name: name || 'No especificado',
          active_only: active_only
        },
        total: 0,
        specialties: []
      };
    }
    
    // Formatear respuesta
    const formattedSpecialties = specialtiesList.map(sp => ({
      id: sp.id,
      name: sp.name,
      description: sp.description,
      duration_minutes: sp.default_duration_minutes,
      active: sp.active === 1,
      created_at: sp.created_at
    }));
    
    return {
      success: true,
      message: `Se encontraron ${specialtiesList.length} especialidad(es)`,
      search_criteria: {
        specialty_id: specialty_id || 'Todas',
        name: name || 'Todas',
        active_only: active_only ? 'Solo activas' : 'Todas (activas e inactivas)'
      },
      total: specialtiesList.length,
      specialties: formattedSpecialties,
      usage_note: 'Use el campo "id" para specialty_id al agendar citas o agregar a lista de espera'
    };
    
  } catch (error: any) {
    console.error('Error consultando especialidades:', error);
    return {
      success: false,
      error: 'Error al consultar especialidades',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: BUSCAR PROCEDIMIENTOS CUPS POR NOMBRE (SIMPLIFICADA)
// ===================================================================
async function searchCupsByName(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { name, limit = 10 } = args;
    
    // Validación: name es obligatorio
    if (!name || name.trim() === '') {
      return {
        success: false,
        error: 'El parámetro "name" es obligatorio',
        usage: 'Proporcione un nombre o parte del nombre del procedimiento a buscar'
      };
    }
    
    // Validar y ajustar límite
    const validLimit = Math.min(Math.max(1, limit), 50);
    
    // Búsqueda por nombre con LIKE (case-insensitive)
    const searchPattern = `%${name.trim()}%`;
    
    const query = `
      SELECT 
        c.id,
        c.code,
        c.name,
        c.category,
        c.price,
        c.status,
        s.id as specialty_id,
        s.name as specialty_name
      FROM cups c
      LEFT JOIN specialties s ON c.specialty_id = s.id
      WHERE c.name LIKE ?
        AND c.status = 'Activo'
      ORDER BY c.category, c.name
      LIMIT ?
    `;
    
    const [cupsList] = await connection.execute(query, [searchPattern, validLimit]);
    const cupsArray = cupsList as any[];
    
    if (cupsArray.length === 0) {
      return {
        success: true,
        message: `No se encontraron procedimientos con el nombre "${name}"`,
        search_term: name,
        total: 0,
        procedures: [],
        suggestion: 'Intente con otro término de búsqueda o use palabras más generales (ej: "mama", "abdomen", "hemograma")'
      };
    }
    
    // Formatear resultados
    const formattedProcedures = cupsArray.map(cup => ({
      id: cup.id,
      code: cup.code,
      name: cup.name,
      category: cup.category,
      price: parseFloat(cup.price),
      specialty: cup.specialty_id ? {
        id: cup.specialty_id,
        name: cup.specialty_name
      } : null,
      status: cup.status
    }));
    
    // Agrupar por categoría para mejor visualización
    const byCategory: any = {};
    formattedProcedures.forEach(proc => {
      if (!byCategory[proc.category]) {
        byCategory[proc.category] = [];
      }
      byCategory[proc.category].push(proc);
    });
    
    return {
      success: true,
      message: `Se encontraron ${cupsArray.length} procedimiento(s) con el nombre "${name}"`,
      search_term: name,
      total: cupsArray.length,
      procedures: formattedProcedures,
      by_category: byCategory,
      usage_note: 'Use el campo "id" como cups_id al agregar a lista de espera (addToWaitingList)',
      example: `addToWaitingList({ ..., cups_id: ${formattedProcedures[0].id} })`
    };
    
  } catch (error: any) {
    console.error('Error buscando CUPS por nombre:', error);
    return {
      success: false,
      error: 'Error al buscar procedimientos CUPS',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: BUSCAR PROCEDIMIENTOS CUPS
// ===================================================================
async function searchCups(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { 
      code,
      name,
      category,
      specialty_id,
      status = 'Activo',
      limit = 20
    } = args;
    
    // Validar límite
    const finalLimit = Math.min(Math.max(1, limit), 100);
    
    // Construir query base
    let query = `
      SELECT 
        c.id,
        c.code,
        c.name,
        c.category,
        c.subcategory,
        c.description,
        c.specialty_id,
        s.name as specialty_name,
        c.price,
        c.requires_authorization,
        c.complexity_level,
        c.estimated_duration_minutes,
        c.requires_anesthesia,
        c.requires_hospitalization,
        c.requires_previous_studies,
        c.status,
        c.is_surgical,
        c.notes
      FROM cups c
      LEFT JOIN specialties s ON c.specialty_id = s.id
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    
    // Filtro por código
    if (code) {
      query += ` AND c.code LIKE ?`;
      queryParams.push(`%${code}%`);
    }
    
    // Filtro por nombre
    if (name) {
      query += ` AND c.name LIKE ?`;
      queryParams.push(`%${name}%`);
    }
    
    // Filtro por categoría
    if (category) {
      query += ` AND c.category LIKE ?`;
      queryParams.push(`%${category}%`);
    }
    
    // Filtro por especialidad
    if (specialty_id) {
      query += ` AND c.specialty_id = ?`;
      queryParams.push(specialty_id);
    }
    
    // Filtro por estado
    if (status !== 'Todos') {
      query += ` AND c.status = ?`;
      queryParams.push(status);
    }
    
    // Ordenar y limitar
    query += ` ORDER BY c.category, c.name LIMIT ?`;
    queryParams.push(finalLimit);
    
    // Ejecutar query
    const [cupsList] = await connection.execute(query, queryParams);
    
    // Si no hay resultados
    if ((cupsList as any[]).length === 0) {
      return {
        success: true,
        message: 'No se encontraron procedimientos CUPS con los criterios especificados',
        search_criteria: {
          code: code || 'No especificado',
          name: name || 'No especificado',
          category: category || 'No especificado',
          specialty_id: specialty_id || 'No especificado',
          status: status
        },
        total: 0,
        procedures: []
      };
    }
    
    // Formatear respuesta
    const formattedProcedures = (cupsList as any[]).map(cup => ({
      id: cup.id,
      code: cup.code,
      name: cup.name,
      category: cup.category,
      subcategory: cup.subcategory,
      description: cup.description,
      specialty: cup.specialty_id ? {
        id: cup.specialty_id,
        name: cup.specialty_name
      } : null,
      pricing: {
        price: parseFloat(cup.price),
        requires_authorization: cup.requires_authorization === 1
      },
      requirements: {
        complexity_level: cup.complexity_level,
        estimated_duration_minutes: cup.estimated_duration_minutes,
        requires_anesthesia: cup.requires_anesthesia === 1,
        requires_hospitalization: cup.requires_hospitalization === 1,
        requires_previous_studies: cup.requires_previous_studies === 1,
        is_surgical: cup.is_surgical === 1
      },
      status: cup.status,
      notes: cup.notes
    }));
    
    return {
      success: true,
      message: `Se encontraron ${formattedProcedures.length} procedimiento(s) CUPS`,
      search_criteria: {
        code: code || 'Todos',
        name: name || 'Todos',
        category: category || 'Todas',
        specialty_id: specialty_id || 'Todas',
        status: status
      },
      total: formattedProcedures.length,
      procedures: formattedProcedures,
      usage_note: 'Use el campo "code" (código CUPS) o "id" para referenciar procedimientos en el sistema'
    };
    
  } catch (error: any) {
    console.error('Error consultando CUPS:', error);
    return {
      success: false,
      error: 'Error al consultar procedimientos CUPS',
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

// ===================================================================
// FUNCIONES DE GESTIÓN DE EMBARAZOS
// ===================================================================

// ===================================================================
// FUNCIÓN: REGISTRAR EMBARAZO
// ===================================================================
async function registerPregnancy(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { patient_id, last_menstrual_date, high_risk, risk_factors, notes } = args;
    
    // 1. Verificar que el paciente existe y es de sexo femenino
    const [patientCheck] = await connection.execute(`
      SELECT id, name, document, gender, status
      FROM patients 
      WHERE id = ? AND status = 'Activo'
      LIMIT 1
    `, [patient_id]);
    
    if ((patientCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Paciente no encontrado o inactivo',
        patient_id: patient_id
      };
    }
    
    const patient = (patientCheck as any[])[0];
    
    // Verificar género (debe ser femenino)
    if (patient.gender !== 'Femenino' && patient.gender !== 'F') {
      await connection.rollback();
      return {
        success: false,
        error: 'El registro de embarazo solo aplica para pacientes de sexo femenino',
        patient: {
          id: patient.id,
          name: patient.name,
          gender: patient.gender
        }
      };
    }
    
    // 2. Verificar si ya tiene un embarazo activo
    const [activeCheck] = await connection.execute(`
      SELECT id, start_date, expected_due_date, status
      FROM pregnancies 
      WHERE patient_id = ? AND status = 'Activa'
      LIMIT 1
    `, [patient_id]);
    
    if ((activeCheck as any[]).length > 0) {
      const activePregnancy = (activeCheck as any[])[0];
      await connection.rollback();
      return {
        success: false,
        error: 'La paciente ya tiene un embarazo activo registrado',
        active_pregnancy: {
          pregnancy_id: activePregnancy.id,
          start_date: activePregnancy.start_date,
          expected_due_date: activePregnancy.expected_due_date
        },
        suggestion: 'Debe completar o interrumpir el embarazo actual antes de registrar uno nuevo'
      };
    }
    
    // 3. Convertir FUM a formato correcto si viene en DD/MM/YYYY
    let fumDate = last_menstrual_date;
    if (fumDate.includes('/')) {
      const parts = fumDate.split('/');
      fumDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // Convertir a YYYY-MM-DD
    }
    
    // 4. Calcular Fecha Probable de Parto (FPP = FUM + 280 días)
    const fum = new Date(fumDate);
    const fpp = new Date(fum);
    fpp.setDate(fpp.getDate() + 280);
    
    // 5. Calcular edad gestacional actual
    const today = new Date();
    const gestationalDays = Math.floor((today.getTime() - fum.getTime()) / (1000 * 60 * 60 * 24));
    const gestationalWeeks = Math.floor(gestationalDays / 7);
    const gestationalDaysRemainder = gestationalDays % 7;
    
    // 6. Calcular días hasta el parto
    const daysUntilDue = Math.floor((fpp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // 7. Insertar embarazo
    const [result] = await connection.execute(`
      INSERT INTO pregnancies (
        patient_id, 
        status, 
        start_date, 
        expected_due_date,
        gestational_weeks_at_registration,
        current_gestational_weeks,
        high_risk,
        risk_factors,
        notes,
        created_at
      ) VALUES (?, 'Activa', ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      patient_id,
      fumDate,
      fpp.toISOString().split('T')[0],
      gestationalWeeks,
      gestationalWeeks,
      high_risk ? 1 : 0,
      risk_factors || null,
      notes || null
    ]);
    
    const pregnancy_id = (result as any).insertId;
    await connection.commit();
    
    // 8. Formatear fechas para respuesta
    const formatDate = (date: Date) => {
      const day = date.getDate();
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} de ${month} de ${year}`;
    };
    
    return {
      success: true,
      message: 'Embarazo registrado exitosamente',
      pregnancy_id: pregnancy_id,
      patient: {
        id: patient.id,
        name: patient.name,
        document: patient.document
      },
      pregnancy_details: {
        fum: {
          date: fumDate,
          formatted: formatDate(fum)
        },
        fpp: {
          date: fpp.toISOString().split('T')[0],
          formatted: formatDate(fpp)
        },
        gestational_age: {
          weeks: gestationalWeeks,
          days: gestationalDaysRemainder,
          text: `${gestationalWeeks} semanas y ${gestationalDaysRemainder} días`
        },
        days_until_due: daysUntilDue,
        high_risk: high_risk || false,
        risk_factors: risk_factors || 'Ninguno',
        status: 'Activa'
      },
      recommendations: {
        prenatal_controls: 'Se recomienda realizar controles prenatales periódicos',
        next_steps: 'Use registerPrenatalControl para registrar cada control prenatal'
      }
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error registrando embarazo:', error);
    return {
      success: false,
      error: 'Error al registrar embarazo',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: CONSULTAR EMBARAZOS ACTIVOS
// ===================================================================
async function getActivePregnancies(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { patient_id, high_risk_only, limit } = args;
    
    let query = `
      SELECT 
        p.pregnancy_id,
        p.patient_id,
        p.patient_name,
        p.patient_document,
        p.status,
        p.start_date as fum,
        p.expected_due_date as fpp,
        p.high_risk,
        p.current_weeks,
        p.current_days,
        p.days_until_due,
        p.prenatal_controls_count,
        p.last_prenatal_control_date,
        p.created_at
      FROM active_pregnancies p
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (patient_id) {
      query += ' AND p.patient_id = ?';
      params.push(patient_id);
    }
    
    if (high_risk_only) {
      query += ' AND p.high_risk = 1';
    }
    
    query += ' ORDER BY p.expected_due_date ASC';
    query += ' LIMIT ?';
    params.push(limit || 50);
    
    const [rows] = await connection.execute(query, params);
    const pregnancies = rows as any[];
    
    // Formatear resultados
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const day = date.getDate();
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} de ${month} de ${year}`;
    };
    
    const formattedPregnancies = pregnancies.map(preg => ({
      pregnancy_id: preg.pregnancy_id,
      patient: {
        id: preg.patient_id,
        name: preg.patient_name,
        document: preg.patient_document
      },
      status: preg.status,
      dates: {
        fum: {
          date: preg.fum,
          formatted: formatDate(preg.fum)
        },
        fpp: {
          date: preg.fpp,
          formatted: formatDate(preg.fpp)
        }
      },
      gestational_age: {
        weeks: preg.current_weeks,
        days: preg.current_days,
        text: `${preg.current_weeks} semanas y ${preg.current_days} días`
      },
      days_until_due: preg.days_until_due,
      high_risk: preg.high_risk === 1,
      prenatal_controls: {
        count: preg.prenatal_controls_count,
        last_date: preg.last_prenatal_control_date ? formatDate(preg.last_prenatal_control_date) : 'Sin controles registrados'
      },
      registered_at: preg.created_at
    }));
    
    return {
      success: true,
      count: formattedPregnancies.length,
      filters: {
        patient_id: patient_id || 'Todos',
        high_risk_only: high_risk_only || false
      },
      pregnancies: formattedPregnancies,
      info: {
        total_active: formattedPregnancies.length,
        high_risk_count: formattedPregnancies.filter(p => p.high_risk).length,
        normal_risk_count: formattedPregnancies.filter(p => !p.high_risk).length
      }
    };
    
  } catch (error: any) {
    console.error('Error consultando embarazos activos:', error);
    return {
      success: false,
      error: 'Error al consultar embarazos activos',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: ACTUALIZAR ESTADO DE EMBARAZO
// ===================================================================
async function updatePregnancyStatus(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { 
      pregnancy_id, 
      status, 
      delivery_date, 
      delivery_type, 
      baby_gender, 
      baby_weight_grams,
      interruption_date,
      interruption_reason,
      interruption_notes,
      complications
    } = args;
    
    // 1. Verificar que el embarazo existe
    const [pregnancyCheck] = await connection.execute(`
      SELECT 
        p.id,
        p.patient_id,
        p.status,
        p.start_date,
        p.expected_due_date,
        pat.name as patient_name
      FROM pregnancies p
      INNER JOIN patients pat ON p.patient_id = pat.id
      WHERE p.id = ?
      LIMIT 1
    `, [pregnancy_id]);
    
    if ((pregnancyCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Embarazo no encontrado',
        pregnancy_id: pregnancy_id
      };
    }
    
    const pregnancy = (pregnancyCheck as any[])[0];
    
    // 2. Validaciones según el estado
    if (status === 'Completada') {
      if (!delivery_date) {
        await connection.rollback();
        return {
          success: false,
          error: 'Se requiere delivery_date para completar el embarazo'
        };
      }
      
      // Actualizar embarazo como completado
      await connection.execute(`
        UPDATE pregnancies 
        SET 
          status = 'Completada',
          actual_end_date = ?,
          delivery_date = ?,
          delivery_type = ?,
          baby_gender = ?,
          baby_weight_grams = ?,
          complications = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [
        delivery_date,
        delivery_date,
        delivery_type || null,
        baby_gender || null,
        baby_weight_grams || null,
        complications || null,
        pregnancy_id
      ]);
      
      await connection.commit();
      
      return {
        success: true,
        message: 'Embarazo marcado como completado exitosamente',
        pregnancy_id: pregnancy_id,
        patient: {
          id: pregnancy.patient_id,
          name: pregnancy.patient_name
        },
        outcome: {
          status: 'Completada',
          delivery_date: delivery_date,
          delivery_type: delivery_type || 'No especificado',
          baby_gender: baby_gender || 'No especificado',
          baby_weight_grams: baby_weight_grams || 'No registrado',
          complications: complications || 'Ninguna'
        }
      };
      
    } else if (status === 'Interrumpida') {
      if (!interruption_date) {
        await connection.rollback();
        return {
          success: false,
          error: 'Se requiere interruption_date para interrumpir el embarazo'
        };
      }
      
      // Actualizar embarazo como interrumpido
      await connection.execute(`
        UPDATE pregnancies 
        SET 
          status = 'Interrumpida',
          actual_end_date = ?,
          interruption_date = ?,
          interruption_reason = ?,
          interruption_notes = ?,
          complications = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [
        interruption_date,
        interruption_date,
        interruption_reason || null,
        interruption_notes || null,
        complications || null,
        pregnancy_id
      ]);
      
      await connection.commit();
      
      return {
        success: true,
        message: 'Embarazo marcado como interrumpido',
        pregnancy_id: pregnancy_id,
        patient: {
          id: pregnancy.patient_id,
          name: pregnancy.patient_name
        },
        outcome: {
          status: 'Interrumpida',
          interruption_date: interruption_date,
          interruption_reason: interruption_reason || 'No especificado',
          interruption_notes: interruption_notes || 'Sin notas',
          complications: complications || 'Ninguna'
        }
      };
      
    } else if (status === 'Activa') {
      // Reactivar embarazo (poco común)
      await connection.execute(`
        UPDATE pregnancies 
        SET 
          status = 'Activa',
          updated_at = NOW()
        WHERE id = ?
      `, [pregnancy_id]);
      
      await connection.commit();
      
      return {
        success: true,
        message: 'Embarazo reactivado',
        pregnancy_id: pregnancy_id
      };
    }
    
    await connection.rollback();
    return {
      success: false,
      error: 'Estado no válido. Debe ser: Activa, Completada o Interrumpida'
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error actualizando estado de embarazo:', error);
    return {
      success: false,
      error: 'Error al actualizar estado de embarazo',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// FUNCIÓN: REGISTRAR CONTROL PRENATAL
// ===================================================================
async function registerPrenatalControl(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const {
      pregnancy_id,
      control_date,
      gestational_weeks,
      gestational_days,
      weight_kg,
      blood_pressure_systolic,
      blood_pressure_diastolic,
      fundal_height_cm,
      fetal_heart_rate,
      observations,
      recommendations,
      next_control_date,
      lab_tests_ordered,
      ultrasound_performed,
      ultrasound_notes
    } = args;
    
    // 1. Verificar que el embarazo existe y está activo
    const [pregnancyCheck] = await connection.execute(`
      SELECT 
        p.id,
        p.patient_id,
        p.status,
        pat.name as patient_name
      FROM pregnancies p
      INNER JOIN patients pat ON p.patient_id = pat.id
      WHERE p.id = ? AND p.status = 'Activa'
      LIMIT 1
    `, [pregnancy_id]);
    
    if ((pregnancyCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Embarazo no encontrado o no está activo',
        pregnancy_id: pregnancy_id
      };
    }
    
    const pregnancy = (pregnancyCheck as any[])[0];
    
    // 2. Insertar control prenatal
    const [result] = await connection.execute(`
      INSERT INTO prenatal_controls (
        pregnancy_id,
        control_date,
        gestational_weeks,
        gestational_days,
        weight_kg,
        blood_pressure_systolic,
        blood_pressure_diastolic,
        fundal_height_cm,
        fetal_heart_rate,
        observations,
        recommendations,
        next_control_date,
        lab_tests_ordered,
        ultrasound_performed,
        ultrasound_notes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      pregnancy_id,
      control_date,
      gestational_weeks,
      gestational_days || 0,
      weight_kg || null,
      blood_pressure_systolic || null,
      blood_pressure_diastolic || null,
      fundal_height_cm || null,
      fetal_heart_rate || null,
      observations || null,
      recommendations || null,
      next_control_date || null,
      lab_tests_ordered || null,
      ultrasound_performed ? 1 : 0,
      ultrasound_notes || null
    ]);
    
    const control_id = (result as any).insertId;
    
    // 3. Actualizar contador de controles en el embarazo
    await connection.execute(`
      UPDATE pregnancies 
      SET 
        prenatal_controls_count = prenatal_controls_count + 1,
        last_prenatal_control_date = ?,
        current_gestational_weeks = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [control_date, gestational_weeks, pregnancy_id]);
    
    await connection.commit();
    
    // 4. Formatear respuesta
    return {
      success: true,
      message: 'Control prenatal registrado exitosamente',
      control_id: control_id,
      pregnancy_id: pregnancy_id,
      patient: {
        id: pregnancy.patient_id,
        name: pregnancy.patient_name
      },
      control_details: {
        date: control_date,
        gestational_age: {
          weeks: gestational_weeks,
          days: gestational_days || 0,
          text: `${gestational_weeks} semanas y ${gestational_days || 0} días`
        },
        vital_signs: {
          weight_kg: weight_kg || 'No registrado',
          blood_pressure: (blood_pressure_systolic && blood_pressure_diastolic) 
            ? `${blood_pressure_systolic}/${blood_pressure_diastolic}` 
            : 'No registrado'
        },
        measurements: {
          fundal_height_cm: fundal_height_cm || 'No registrado',
          fetal_heart_rate: fetal_heart_rate || 'No registrado'
        },
        ultrasound: ultrasound_performed ? 'Sí realizada' : 'No realizada',
        next_control_date: next_control_date || 'No programado'
      },
      recommendations: recommendations || 'Sin recomendaciones específicas'
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error registrando control prenatal:', error);
    return {
      success: false,
      error: 'Error al registrar control prenatal',
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

// ===================================================================
// NUEVAS FUNCIONES: GESTIÓN AVANZADA DE CUPOS
// ===================================================================

/**
 * Cancela una cita y libera automáticamente el cupo en availability_distribution
 */
async function cancelAppointment(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { appointment_id, cancellation_reason, notes } = args;
    
    // 1. Verificar que la cita existe y obtener información
    const [appointmentCheck] = await connection.execute(`
      SELECT 
        a.id,
        a.patient_id,
        a.availability_id,
        a.scheduled_at,
        a.status,
        a.reason,
        p.name as patient_name,
        p.document as patient_document,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `, [appointment_id]);
    
    if ((appointmentCheck as any[]).length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Cita no encontrada',
        appointment_id
      };
    }
    
    const appointment = (appointmentCheck as any[])[0];
    
    // Verificar si ya está cancelada
    if (appointment.status === 'Cancelada') {
      await connection.rollback();
      return {
        success: false,
        error: 'La cita ya está cancelada',
        appointment: {
          id: appointment.id,
          scheduled_at: appointment.scheduled_at,
          patient: appointment.patient_name,
          status: appointment.status
        }
      };
    }
    
    // Verificar si ya está completada
    if (appointment.status === 'Completada') {
      await connection.rollback();
      return {
        success: false,
        error: 'No se puede cancelar una cita que ya fue completada',
        appointment: {
          id: appointment.id,
          scheduled_at: appointment.scheduled_at,
          patient: appointment.patient_name,
          status: appointment.status
        },
        suggestion: 'Si desea corregir el estado, contacte al administrador del sistema'
      };
    }
    
    // 2. Cancelar la cita
    const notesText = notes 
      ? `${notes} | Motivo: ${cancellation_reason}`
      : `CANCELADA: ${cancellation_reason}`;
    
    await connection.execute(`
      UPDATE appointments
      SET status = 'Cancelada',
          notes = CONCAT(IFNULL(notes, ''), ' | ', ?),
          cancellation_reason = ?
      WHERE id = ?
    `, [notesText, cancellation_reason, appointment_id]);
    
    // 3. Liberar el cupo en availability_distribution
    const [liberationResult] = await connection.execute(`
      UPDATE availability_distribution ad
      SET ad.assigned = ad.assigned - 1
      WHERE ad.availability_id = ?
        AND DATE(ad.day_date) = DATE(?)
        AND ad.assigned > 0
    `, [appointment.availability_id, appointment.scheduled_at]);
    
    const quotaLiberated = (liberationResult as any).affectedRows > 0;
    
    await connection.commit();
    
    return {
      success: true,
      message: 'Cita cancelada exitosamente y cupo liberado',
      appointment: {
        id: appointment.id,
        patient: {
          id: appointment.patient_id,
          name: appointment.patient_name,
          document: appointment.patient_document
        },
        scheduled_at: appointment.scheduled_at,
        previous_status: appointment.status,
        new_status: 'Cancelada',
        doctor: appointment.doctor_name,
        specialty: appointment.specialty_name,
        location: appointment.location_name,
        cancellation_reason,
        notes: notesText
      },
      quota_info: {
        availability_id: appointment.availability_id,
        quota_liberated: quotaLiberated,
        message: quotaLiberated 
          ? 'Cupo liberado exitosamente en availability_distribution'
          : 'No fue necesario liberar cupo (no había cupos assigned)'
      },
      next_steps: [
        'El cupo está disponible para nuevas citas',
        'Puede procesar lista de espera con reassignWaitingListAppointments si hay solicitudes pendientes'
      ]
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error cancelando cita:', error);
    return {
      success: false,
      error: 'Error al cancelar la cita',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

/**
 * Sincroniza cupos de availability_distribution con el conteo real de citas activas
 */
async function syncAvailabilityQuotas(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { availability_id, dry_run = false } = args;
    
    // Construir query base con subquery para evitar error de referencia
    let whereClause = availability_id ? `WHERE availability_id = ${availability_id}` : '';
    
    // Obtener datos actuales vs reales usando subquery
    const [data] = await connection.execute(`
      SELECT * FROM (
        SELECT 
          ad.id,
          ad.availability_id,
          ad.day_date,
          ad.quota,
          ad.assigned as assigned_current,
          COUNT(a.id) as assigned_real,
          CAST(ad.assigned AS SIGNED) - CAST(COUNT(a.id) AS SIGNED) as difference,
          av.date as availability_date,
          d.name as doctor_name,
          s.name as specialty_name,
          l.name as location_name
        FROM availability_distribution ad
        INNER JOIN availabilities av ON ad.availability_id = av.id
        INNER JOIN doctors d ON av.doctor_id = d.id
        INNER JOIN specialties s ON av.specialty_id = s.id
        INNER JOIN locations l ON av.location_id = l.id
        LEFT JOIN appointments a ON a.availability_id = ad.availability_id 
          AND DATE(a.scheduled_at) = ad.day_date
          AND a.status IN ('Pendiente', 'Confirmada')
        GROUP BY ad.id, ad.availability_id, ad.day_date, ad.quota, ad.assigned,
                 av.date, d.name, s.name, l.name
      ) AS subq
      ${whereClause}
      WHERE difference != 0
      ORDER BY ABS(difference) DESC
    `);
    
    if ((data as any[]).length === 0) {
      return {
        success: true,
        message: 'Todos los cupos están sincronizados correctamente',
        records_checked: availability_id ? 1 : 'todos',
        inconsistencies_found: 0,
        dry_run
      };
    }
    
    const records = data as any[];
    const updates: any[] = [];
    
    if (!dry_run) {
      await connection.beginTransaction();
      
      for (const record of records) {
        await connection.execute(`
          UPDATE availability_distribution
          SET assigned = ?
          WHERE id = ?
        `, [record.assigned_real, record.id]);
        
        updates.push({
          distribution_id: record.id,
          availability_id: record.availability_id,
          day_date: record.day_date,
          doctor: record.doctor_name,
          specialty: record.specialty_name,
          location: record.location_name,
          assigned_before: record.assigned_current,
          assigned_after: record.assigned_real,
          difference: record.difference,
          corrected: true
        });
      }
      
      await connection.commit();
    } else {
      // Modo dry-run: solo reportar qué se actualizaría
      for (const record of records) {
        updates.push({
          distribution_id: record.id,
          availability_id: record.availability_id,
          day_date: record.day_date,
          doctor: record.doctor_name,
          specialty: record.specialty_name,
          location: record.location_name,
          assigned_current: record.assigned_current,
          assigned_should_be: record.assigned_real,
          difference: record.difference,
          action: 'WOULD UPDATE (dry-run mode)'
        });
      }
    }
    
    return {
      success: true,
      message: dry_run 
        ? `Simulación completada. Se encontraron ${records.length} inconsistencias que SE ACTUALIZARÍAN`
        : `Sincronización completada. Se corrigieron ${records.length} registros`,
      dry_run,
      total_inconsistencies: records.length,
      updates,
      summary: {
        records_checked: availability_id ? `availability_id = ${availability_id}` : 'TODOS los availabilities',
        inconsistencies_fixed: dry_run ? 0 : records.length,
        largest_difference: Math.max(...records.map((r: any) => Math.abs(r.difference)))
      },
      next_steps: dry_run 
        ? ['Ejecute con dry_run: false para aplicar los cambios']
        : ['Los cupos ahora reflejan el conteo real de citas activas', 'Puede verificar con auditAvailabilityQuotas']
    };
    
  } catch (error: any) {
    if (!args.dry_run) {
      await connection.rollback();
    }
    console.error('Error sincronizando cupos:', error);
    return {
      success: false,
      error: 'Error al sincronizar cupos',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

/**
 * Audita la consistencia de cupos sin hacer cambios
 */
async function auditAvailabilityQuotas(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { availability_id, show_only_inconsistencies = true, limit = 50 } = args;
    
    let whereClause = availability_id ? `WHERE ad.availability_id = ${availability_id}` : '';
    let havingClause = show_only_inconsistencies ? 'WHERE difference != 0' : '';
    
    const [data] = await connection.execute(`
      SELECT * FROM (
        SELECT 
          ad.id as distribution_id,
          ad.availability_id,
          ad.day_date,
          ad.quota,
          ad.assigned as assigned_in_db,
          COUNT(a.id) as real_active_appointments,
          CAST(ad.quota AS SIGNED) - CAST(ad.assigned AS SIGNED) as slots_available_by_db,
          CAST(ad.quota AS SIGNED) - CAST(COUNT(a.id) AS SIGNED) as slots_available_real,
          CAST(ad.assigned AS SIGNED) - CAST(COUNT(a.id) AS SIGNED) as difference,
          av.date as availability_date,
          av.start_time,
          av.end_time,
          d.name as doctor_name,
          s.name as specialty_name,
          l.name as location_name,
          CASE 
            WHEN CAST(ad.assigned AS SIGNED) - CAST(COUNT(a.id) AS SIGNED) > 0 THEN 'OVER-ASSIGNED'
            WHEN CAST(ad.assigned AS SIGNED) - CAST(COUNT(a.id) AS SIGNED) < 0 THEN 'UNDER-ASSIGNED'
            ELSE 'CORRECT'
          END as status
        FROM availability_distribution ad
        INNER JOIN availabilities av ON ad.availability_id = av.id
        INNER JOIN doctors d ON av.doctor_id = d.id
        INNER JOIN specialties s ON av.specialty_id = s.id
        INNER JOIN locations l ON av.location_id = l.id
        LEFT JOIN appointments a ON a.availability_id = ad.availability_id 
          AND DATE(a.scheduled_at) = ad.day_date
          AND a.status IN ('Pendiente', 'Confirmada')
        ${whereClause}
        GROUP BY ad.id, ad.availability_id, ad.day_date, ad.quota, ad.assigned,
                 av.date, av.start_time, av.end_time, d.name, s.name, l.name
      ) AS subq
      ${havingClause}
      ORDER BY ABS(difference) DESC
      LIMIT ?
    `, [limit]);
    
    const records = data as any[];
    
    // Calcular estadísticas
    const stats = {
      total_checked: records.length,
      correct: records.filter((r: any) => r.status === 'CORRECT').length,
      over_assigned: records.filter((r: any) => r.status === 'OVER-ASSIGNED').length,
      under_assigned: records.filter((r: any) => r.status === 'UNDER-ASSIGNED').length,
      total_difference: records.reduce((sum: number, r: any) => sum + Math.abs(r.difference), 0),
      largest_difference: records.length > 0 
        ? Math.max(...records.map((r: any) => Math.abs(r.difference)))
        : 0
    };
    
    return {
      success: true,
      message: `Auditoría completada. Se analizaron ${stats.total_checked} registros`,
      filters: {
        availability_id: availability_id || 'TODOS',
        show_only_inconsistencies,
        limit
      },
      statistics: stats,
      records,
      interpretation: {
        over_assigned: 'Campo "assigned" mayor que citas reales - indica liberaciones no registradas o citas canceladas sin actualizar cupo',
        under_assigned: 'Campo "assigned" menor que citas reales - indica citas creadas sin incrementar cupo',
        correct: 'Cupos sincronizados correctamente con citas reales'
      },
      recommendations: stats.over_assigned > 0 || stats.under_assigned > 0
        ? [
            `Se encontraron ${stats.over_assigned + stats.under_assigned} inconsistencias`,
            'Ejecute syncAvailabilityQuotas con dry_run: true para ver qué se corregiría',
            'Luego ejecute syncAvailabilityQuotas con dry_run: false para aplicar correcciones'
          ]
        : [
            'Todos los cupos están consistentes',
            'No se requiere acción correctiva'
          ]
    };
    
  } catch (error: any) {
    console.error('Error auditando cupos:', error);
    return {
      success: false,
      error: 'Error al auditar cupos',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// SERVIDOR HTTP Y ENDPOINTS
// ===================================================================

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

// ===================================================================
// FUNCIÓN: ACTUALIZAR TELÉFONOS DE PACIENTE
// ===================================================================
async function actualizarPhone(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { document, new_phone, new_phone_alt } = args;
    
    // 1. Validar que se proporcionó el documento
    if (!document) {
      return {
        success: false,
        error: 'El número de documento es obligatorio',
        usage: 'Proporcione el documento del paciente para consultar o actualizar sus teléfonos'
      };
    }
    
    // 2. Buscar paciente por documento
    const [patientCheck] = await connection.execute(`
      SELECT 
        p.id, 
        p.document, 
        p.name, 
        p.phone, 
        p.phone_alt,
        p.status,
        eps.name as eps_name
      FROM patients p
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      WHERE p.document = ?
      LIMIT 1
    `, [document]);
    
    if ((patientCheck as any[]).length === 0) {
      return {
        success: false,
        error: 'Paciente no encontrado',
        document: document,
        suggestion: 'Verifique el número de documento e intente nuevamente'
      };
    }
    
    const patient = (patientCheck as any[])[0];
    
    // 3. Si el paciente está inactivo, informar
    if (patient.status === 'Inactivo') {
      return {
        success: false,
        error: 'Paciente inactivo',
        patient: {
          id: patient.id,
          name: patient.name,
          document: patient.document,
          status: patient.status
        },
        suggestion: 'Este paciente está marcado como inactivo. Contacte al administrador.'
      };
    }
    
    // 4. Obtener teléfonos actuales
    const currentPhones = {
      phone: patient.phone,
      phone_alt: patient.phone_alt
    };
    
    // 5. Si NO se proporcionan teléfonos nuevos, solo consultar
    if (!new_phone && !new_phone_alt) {
      return {
        success: true,
        action: 'consultation',
        message: 'Consulta de teléfonos realizada exitosamente',
        patient: {
          id: patient.id,
          name: patient.name,
          document: patient.document,
          eps: patient.eps_name
        },
        phones: {
          phone_principal: currentPhones.phone || 'No registrado',
          phone_alternativo: currentPhones.phone_alt || 'No registrado'
        },
        info: 'Para actualizar, proporcione new_phone o new_phone_alt en la solicitud'
      };
    }
    
    // 6. Actualizar teléfonos
    await connection.beginTransaction();
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (new_phone) {
      updates.push('phone = ?');
      params.push(new_phone);
    }
    
    if (new_phone_alt) {
      updates.push('phone_alt = ?');
      params.push(new_phone_alt);
    }
    
    // Agregar documento al final de params
    params.push(document);
    
    const updateQuery = `
      UPDATE patients 
      SET ${updates.join(', ')}
      WHERE document = ?
    `;
    
    await connection.execute(updateQuery, params);
    await connection.commit();
    
    // 7. Preparar respuesta con cambios realizados
    const changes: any = {};
    
    if (new_phone) {
      changes.phone_principal = {
        anterior: currentPhones.phone || 'No registrado',
        nuevo: new_phone
      };
    }
    
    if (new_phone_alt) {
      changes.phone_alternativo = {
        anterior: currentPhones.phone_alt || 'No registrado',
        nuevo: new_phone_alt
      };
    }
    
    return {
      success: true,
      action: 'update',
      message: 'Teléfonos actualizados exitosamente',
      patient: {
        id: patient.id,
        name: patient.name,
        document: patient.document,
        eps: patient.eps_name
      },
      changes: changes,
      phones_updated: {
        phone_principal: new_phone || currentPhones.phone || 'No registrado',
        phone_alternativo: new_phone_alt || currentPhones.phone_alt || 'No registrado'
      }
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error actualizando teléfonos:', error);
    return {
      success: false,
      error: 'Error al actualizar teléfonos del paciente',
      details: error.message
    };
  } finally {
    connection.release();
  }
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
