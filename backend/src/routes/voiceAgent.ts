import express from 'express';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';
import mysql from 'mysql2/promise';
import { pool } from '../db/connection';

const router = express.Router();

// Esquemas de validación
const voiceMessageSchema = z.object({
  message: z.string().min(1, 'Mensaje requerido'),
  from: z.string().min(1, 'Número de origen requerido'),
  messageType: z.literal('voice'),
  context: z.object({
    isVoiceCall: z.boolean().default(true),
    conversationHistory: z.array(z.string()).default([]),
    patientData: z.record(z.any()).default({}),
    currentIntent: z.string().default('unknown'),
    channel: z.literal('voice')
  }).optional()
});

const mcpToolCallSchema = z.object({
  tool: z.string(),
  parameters: z.record(z.any()),
  context: z.object({
    callerNumber: z.string(),
    intent: z.string().optional()
  })
});

/**
 * Procesa mensaje de voz usando lógica similar al agente de WhatsApp
 * Este endpoint simula el procesamiento del agente para llamadas de voz
 */
router.post('/process-voice', async (req, res) => {
  try {
    const validatedData = voiceMessageSchema.parse(req.body);
    const { message, from, context } = validatedData;

    console.log(`[Voice Agent] Procesando mensaje de ${from}: "${message.substring(0, 100)}..."`);

    // Simular procesamiento del agente de WhatsApp
    const response = await processVoiceMessage(message, from, context);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('[Voice Agent] Error procesando mensaje:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error procesando mensaje de voz'
    });
  }
});

/**
 * Endpoint para llamadas directas a herramientas MCP desde el sistema de voz
 */
router.post('/mcp-call', async (req, res) => {
  try {
    const validatedData = mcpToolCallSchema.parse(req.body);
    const { tool, parameters, context } = validatedData;

    console.log(`[Voice MCP] Llamando herramienta ${tool} desde ${context.callerNumber}`);

    // Procesar llamada MCP según la herramienta
    const result = await processMCPTool(tool, parameters, context);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Voice MCP] Error en llamada MCP:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error en llamada MCP'
    });
  }
});

/**
 * Procesa mensaje de voz simulando la lógica del agente de WhatsApp
 */
async function processVoiceMessage(message: string, from: string, context?: any) {
  // Detectar intent del mensaje
  const intent = determineIntent(message);
  console.log(`[Voice Agent] Intent detectado: ${intent}`);

  // Extraer datos relevantes del mensaje
  const extractedData = extractPatientData(message);
  
  // Generar respuesta según el intent
  const response = await generateContextualResponse(intent, message, extractedData, from);

  return {
    message: response.message,
    followUpQuestions: response.followUpQuestions || [],
    suggestedActions: response.suggestedActions || [],
    requiresHumanIntervention: (response as any).requiresHumanIntervention || false,
    mcpToolsUsed: (response as any).mcpToolsUsed || [],
    confidence: response.confidence || 0.8,
    extractedData,
    intent
  };
}

/**
 * Determina el intent principal del mensaje de voz
 */
function determineIntent(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Patrones de intent para contexto médico
  const intentPatterns = {
    'appointment_request': ['cita', 'consulta', 'turno', 'agendar', 'reservar', 'solicitar'],
    'patient_registration': ['registrar', 'nuevo paciente', 'primera vez', 'inscribir', 'alta'],
    'appointment_cancel': ['cancelar', 'anular', 'suspender cita', 'quitar cita'],
    'appointment_reschedule': ['cambiar cita', 'mover cita', 'reprogramar', 'modificar'],
    'information_request': ['información', 'horarios', 'precio', 'costos', 'tarifas'],
    'emergency': ['urgencia', 'emergencia', 'grave', 'dolor fuerte', 'urgente'],
    'greeting': ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos'],
    'complaint': ['queja', 'reclamo', 'problema', 'mala atención', 'inconveniente']
  };

  for (const [intent, keywords] of Object.entries(intentPatterns)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return intent;
    }
  }

  return 'general_inquiry';
}

/**
 * Extrae datos de paciente del mensaje de voz
 */
function extractPatientData(message: string) {
  const data: any = {};

  // Patrones para extraer información
  const patterns = {
    name: /(?:me llamo|soy|mi nombre es)\s+([a-záéíóúñ\s]+)/i,
    document: /(?:cedula|documento|identificación|id)\s*:?\s*(\d+)/i,
    phone: /(?:teléfono|celular|número)\s*:?\s*([\d\s\-\+]+)/i,
    email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    specialty: /(?:especialidad|doctor|médico|consulta)\s+([a-záéíóúñ\s]+)/i
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let value = match[1].trim();
      
      if (key === 'name') {
        // Capitalizar nombre
        value = value.replace(/\s+/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      } else if (key === 'document') {
        // Solo números
        value = value.replace(/\D/g, '');
      } else if (key === 'phone') {
        // Limpiar teléfono
        value = value.replace(/[^\d+]/g, '');
      } else if (key === 'email') {
        value = value.toLowerCase();
      }
      
      data[key] = value;
    }
  }

  return data;
}

/**
 * Genera respuesta contextual según el intent
 */
async function generateContextualResponse(intent: string, message: string, extractedData: any, from: string) {
  const responses = {
    'appointment_request': {
      message: 'Entiendo que desea solicitar una cita médica. Para agendar su consulta necesito algunos datos.',
      followUpQuestions: ['¿Para qué especialidad es la consulta?', '¿Cuál es su número de documento?', '¿Qué fecha prefiere?'],
      suggestedActions: ['request_patient_data', 'check_availability'],
      mcpToolsUsed: [],
      confidence: 0.9
    },
    'patient_registration': {
      message: 'Le ayudo con el registro como nuevo paciente. Solo necesito su nombre completo y número de documento.',
      followUpQuestions: ['¿Cuál es su nombre completo?', '¿Número de documento de identidad?'],
      suggestedActions: ['collect_patient_data'],
      mcpToolsUsed: [],
      confidence: 0.85
    },
    'emergency': {
      message: 'Entiendo que tiene una situación urgente. Le voy a conectar inmediatamente con nuestro personal médico.',
      followUpQuestions: [],
      suggestedActions: ['escalate_to_human', 'priority_attention'],
      requiresHumanIntervention: true,
      mcpToolsUsed: [],
      confidence: 0.95
    },
    'greeting': {
      message: 'Hola, bienvenido al sistema de atención telefónica de Biosanarcall. ¿En qué puedo ayudarle hoy?',
      followUpQuestions: ['¿Desea agendar una cita?', '¿Es paciente nuevo?', '¿Necesita información?'],
      suggestedActions: ['show_menu'],
      mcpToolsUsed: [],
      confidence: 0.8
    }
  };

  let response = responses[intent as keyof typeof responses] || {
    message: 'He recibido su mensaje. ¿Podría especificar cómo puedo ayudarle? Puede solicitar citas, registrarse como paciente o consultar información.',
    followUpQuestions: ['¿Desea agendar una cita médica?', '¿Es nuevo paciente?', '¿Necesita información sobre servicios?'],
    suggestedActions: ['clarify_intent'],
    mcpToolsUsed: [],
    confidence: 0.6
  };

  // Si se detectaron datos del paciente, intentar procesarlos
  if (extractedData.name && extractedData.document && intent === 'patient_registration') {
    try {
      // Simular registro de paciente
      const registrationResult = await registerSimplePatient(extractedData, from);
      
      if (registrationResult.success) {
        response.message = `Perfecto, ${extractedData.name}. Su registro ha sido completado exitosamente con el documento ${extractedData.document}. ¿Desea agendar una cita?`;
        (response as any).mcpToolsUsed = ['createSimplePatient'];
        response.confidence = 0.95;
        response.followUpQuestions = ['¿Para qué especialidad desea la cita?', '¿Qué fecha prefiere?'];
      }
    } catch (error) {
      console.error('[Voice Agent] Error registrando paciente:', error);
    }
  }

  return response;
}

/**
 * Registra paciente simple (simulando MCP)
 */
async function registerSimplePatient(data: any, callerNumber: string) {
  try {
    // Verificar si ya existe
    const [existing] = await pool.execute(
      'SELECT id FROM patients WHERE document = ?',
      [data.document]
    );

    if ((existing as any[]).length > 0) {
      return {
        success: false,
        error: 'Paciente ya registrado',
        patientId: (existing as any[])[0].id
      };
    }

    // Registrar nuevo paciente simple
    const [result] = await pool.execute(
      `INSERT INTO patients (name, document, phone, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [data.name, data.document, callerNumber]
    );

    const patientId = (result as mysql.ResultSetHeader).insertId;
    
    console.log(`[Voice Agent] Paciente registrado vía voz: ID ${patientId}`);
    
    return {
      success: true,
      patientId,
      message: 'Paciente registrado exitosamente'
    };

  } catch (error) {
    console.error('[Voice Agent] Error en registro simple:', error);
    throw error;
  }
}

/**
 * Procesa llamadas directas a herramientas MCP
 */
async function processMCPTool(tool: string, parameters: any, context: any) {
  console.log(`[Voice MCP] Procesando herramienta: ${tool}`);

  switch (tool) {
    case 'createSimplePatient':
      return await registerSimplePatient(parameters, context.callerNumber);
    
    case 'searchPatients':
      return await searchPatients(parameters);
    
    case 'checkAvailability':
      return await checkDoctorAvailability(parameters);
    
    default:
      throw new Error(`Herramienta MCP no soportada: ${tool}`);
  }
}

/**
 * Busca pacientes (simulando MCP)
 */
async function searchPatients(params: any) {
  try {
    const { query, limit = 10 } = params;
    
    const [rows] = await pool.execute(
      `SELECT id, name, document, phone, email 
       FROM patients 
       WHERE name LIKE ? OR document LIKE ?
       LIMIT ?`,
      [`%${query}%`, `%${query}%`, limit]
    );

    return {
      success: true,
      patients: rows,
      count: (rows as any[]).length
    };

  } catch (error) {
    console.error('[Voice MCP] Error buscando pacientes:', error);
    throw error;
  }
}

/**
 * Verifica disponibilidad de doctores (simulando MCP)
 */
async function checkDoctorAvailability(params: any) {
  try {
    const { specialty, date } = params;
    
    // Simulación básica de disponibilidad
    const [rows] = await pool.execute(
      `SELECT d.id, d.name AS name, s.name as specialty_name
       FROM doctors d 
       JOIN specialties s ON d.specialty_id = s.id
       WHERE s.name LIKE ?
       LIMIT 5`,
      [`%${specialty}%`]
    );

    return {
      success: true,
      doctors: rows,
      availableSlots: ['09:00', '10:30', '14:00', '15:30'], // Simulado
      message: `Encontrados ${(rows as any[]).length} doctores disponibles`
    };

  } catch (error) {
    console.error('[Voice MCP] Error verificando disponibilidad:', error);
    throw error;
  }
}

export default router;