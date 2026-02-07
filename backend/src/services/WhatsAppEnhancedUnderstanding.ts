/**
 * WhatsApp Enhanced Understanding Service
 * 
 * Servicio de comprensión mejorada para WhatsApp que integra:
 * - Memoria semántica persistente
 * - Detección avanzada de intenciones
 * - Extracción de entidades
 * - Contexto enriquecido para respuestas más personalizadas
 * 
 * Inspirado en moltbot para mejor comprensión contextual
 * 
 * @version 1.0.0
 */

import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import pino from 'pino';
import SemanticMemory, { MemoryCategory } from './WhatsAppSemanticMemory';
import * as ChatMemoryService from './ChatMemoryService';

const logger = pino({
  name: 'whatsapp-understanding',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// TIPOS
// ============================================================================

export interface ExtractedEntities {
  document?: string;
  phone?: string;
  email?: string;
  date?: string;
  time?: string;
  specialty?: string;
  location?: string;
  doctorName?: string;
  numbers?: string[];
  names?: string[];
}

export interface IntentAnalysis {
  primaryIntent: string;
  secondaryIntents: string[];
  confidence: number;
  entities: ExtractedEntities;
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface EnrichedContext {
  session: ChatMemoryService.ChatSession | null;
  patientInfo: {
    id: number;
    name: string;
    document: string;
    phone: string;
    epsName: string | null;
    birthDate: string | null;
  } | null;
  recentMessages: ChatMemoryService.ChatMessage[];
  relevantMemories: string | null;
  userPreferences: {
    preferredSpecialtyId?: number;
    preferredLocationId?: number;
    preferredDoctorId?: number;
  } | null;
  lastSummary: string | null;
  intentAnalysis: IntentAnalysis;
}

// ============================================================================
// PATRONES DE EXTRACCIÓN DE ENTIDADES
// ============================================================================

const ENTITY_PATTERNS = {
  // Documento de identidad colombiano
  document: [
    /\b(\d{6,12})\b/,
    /[cC][cC]\s*:?\s*(\d+)/,
    /[cC][eE]dula\s*:?\s*(\d+)/i,
    /documento\s*:?\s*(\d+)/i,
  ],
  
  // Teléfonos
  phone: [
    /\+?\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,
    /\+?\d{10,13}/,
    /\(\d{3}\)\s*\d{3}[\s.-]?\d{4}/,
  ],
  
  // Email
  email: [
    /[\w.-]+@[\w.-]+\.\w+/,
  ],
  
  // Fechas en español
  date: [
    /(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s*(?:de|del)?\s*(\d{4}))?/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(lunes|martes|mi[ée]rcoles|jueves|viernes|s[aá]bado|domingo)/i,
    /(hoy|ma[nñ]ana|pasado ma[nñ]ana|la pr[oó]xima semana)/i,
  ],
  
  // Horas
  time: [
    /(\d{1,2})\s*(?::|h|hrs?)?\s*(am|pm|a\.?m\.?|p\.?m\.?)/i,
    /(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i,
    /(ma[nñ]ana|tarde|noche)/i,
    /(temprano|medio d[ií]a|mediod[ií]a)/i,
  ],
  
  // Especialidades médicas
  specialty: [
    /(medicina\s*general|medico\s*general)/i,
    /(odontolog[ií]a|dentista|dientes)/i,
    /(psicolog[ií]a|psicologo)/i,
    /(ginecolog[ií]a|ginecologo)/i,
    /(pediatr[ií]a|pediatra)/i,
    /(cardiolog[ií]a|cardiologo|coraz[oó]n)/i,
    /(oftalmolog[ií]a|oftalmologo|ojos)/i,
    /(dermatolog[ií]a|dermatologo|piel)/i,
    /(traumatolog[ií]a|traumatologo|huesos)/i,
    /(nutrici[oó]n|nutricionista)/i,
    /(fisioterapia|fisioterapeuta)/i,
    /(control\s*prenatal|embarazo)/i,
  ],
};

// Mapeo de especialidades detectadas a nombres estándar
const SPECIALTY_MAPPING: Record<string, string> = {
  'medicina general': 'Medicina General',
  'medico general': 'Medicina General',
  'odontologia': 'Odontología',
  'odontología': 'Odontología',
  'dentista': 'Odontología',
  'dientes': 'Odontología',
  'psicologia': 'Psicología',
  'psicología': 'Psicología',
  'psicologo': 'Psicología',
  'ginecologia': 'Ginecología',
  'ginecología': 'Ginecología',
  'ginecologo': 'Ginecología',
  'pediatria': 'Pediatría',
  'pediatría': 'Pediatría',
  'pediatra': 'Pediatría',
  'cardiologia': 'Cardiología',
  'cardiología': 'Cardiología',
  'cardiologo': 'Cardiología',
  'corazon': 'Cardiología',
  'oftalmologia': 'Oftalmología',
  'oftalmología': 'Oftalmología',
  'oftalmologo': 'Oftalmología',
  'ojos': 'Oftalmología',
  'dermatologia': 'Dermatología',
  'dermatología': 'Dermatología',
  'dermatologo': 'Dermatología',
  'piel': 'Dermatología',
  'traumatologia': 'Traumatología',
  'traumatología': 'Traumatología',
  'traumatologo': 'Traumatología',
  'huesos': 'Traumatología',
  'nutricion': 'Nutrición',
  'nutrición': 'Nutrición',
  'nutricionista': 'Nutrición',
  'fisioterapia': 'Fisioterapia',
  'fisioterapeuta': 'Fisioterapia',
  'control prenatal': 'Control Prenatal',
  'embarazo': 'Control Prenatal',
};

// ============================================================================
// ANÁLISIS DE INTENCIÓN AVANZADO
// ============================================================================

const INTENT_PATTERNS: Record<string, { patterns: RegExp[]; weight: number }> = {
  'greeting': {
    patterns: [
      /^(hola|buenas?( tardes?| dias?| noches?)?|saludos?|hey|hi|hello)$/i,
      /^(ola|holaa+|buenas+)$/i,
    ],
    weight: 1.0
  },
  'schedule': {
    patterns: [
      /quiero( una)?( la)? cita/i,
      /necesito (una )?cita/i,
      /agendar(me)?( una)?( cita)?/i,
      /sacar( una)? cita/i,
      /pedir( una)? cita/i,
      /reservar( una)? cita/i,
      /(me )?(puede[ns]?|podria[ns]?) agendar/i,
      /tiene[ns]? disponibilidad/i,
      /hay cupos?/i,
    ],
    weight: 0.95
  },
  'check_appointment': {
    patterns: [
      /mi[s]? cita[s]?/i,
      /cita[s]? que tengo/i,
      /tengo cita[s]?/i,
      /cita[s]? pendiente[s]?/i,
      /cuando (es|tengo) (mi )?cita/i,
      /estado de mi cita/i,
      /consultar (mi )?cita/i,
      /ver (mi[s]? )?cita[s]?/i,
      /revisar (mi[s]? )?cita[s]?/i,
      /lista de espera/i,
      /que citas tengo/i,
      /cuales son mis citas/i,
    ],
    weight: 0.9
  },
  'cancel': {
    patterns: [
      /cancelar( la| mi)?( cita)?/i,
      /anular( la| mi)?( cita)?/i,
      /no (voy a |puedo )?(ir|asistir)/i,
      /eliminar( la| mi)?( cita)?/i,
    ],
    weight: 0.9
  },
  'reschedule': {
    patterns: [
      /cambiar( la| mi)?( cita| hora| fecha)?/i,
      /reprogramar( la| mi)?( cita)?/i,
      /mover( la| mi)?( cita)?/i,
      /otro (dia|horario|fecha)/i,
      /posponer( la| mi)?( cita)?/i,
    ],
    weight: 0.9
  },
  'medical_question': {
    patterns: [
      /que especialidad necesito/i,
      /que (doctor|medico) (debo|tengo que) ver/i,
      /me duele/i,
      /tengo (dolor|molestia)/i,
      /sintomas?/i,
      /es urgente/i,
      /emergencia/i,
    ],
    weight: 0.85
  },
  'info': {
    patterns: [
      /informacion( sobre)?/i,
      /que servicios/i,
      /que especialidades/i,
      /donde queda[n]?/i,
      /direccion/i,
      /ubicacion/i,
      /horarios? de atencion/i,
      /telefono/i,
    ],
    weight: 0.8
  },
  'waiting_list': {
    patterns: [
      /lista de espera/i,
      /cola de espera/i,
      /espera(r)?( turno)?/i,
      /avisarme cuando haya/i,
      /notificarme/i,
      /(mi )?posicion en (la )?lista/i,
    ],
    weight: 0.85
  },
  'confirm': {
    patterns: [
      /^(si|sip|sep|claro|dale|ok|vale|listo|perfecto|confirmo|correcto|exacto|asi es)$/i,
      /^(si,? por favor|esta bien|de acuerdo)$/i,
    ],
    weight: 1.0
  },
  'deny': {
    patterns: [
      /^(no|nop|nope|nel|negativo|para nada)$/i,
      /^(no,? gracias|prefiero no|mejor no)$/i,
    ],
    weight: 1.0
  },
  'thanks': {
    patterns: [
      /(muchas? )?gracias/i,
      /te lo agradezco/i,
      /muy amable/i,
    ],
    weight: 0.8
  },
  'goodbye': {
    patterns: [
      /adios/i,
      /chao/i,
      /hasta (luego|pronto|manana)/i,
      /nos vemos/i,
      /bye/i,
    ],
    weight: 0.9
  },
  'complaint': {
    patterns: [
      /queja/i,
      /reclamo/i,
      /molest(o|a|ia)/i,
      /no me gusta/i,
      /mal servicio/i,
      /pesimo/i,
    ],
    weight: 0.9
  },
  'update_info': {
    patterns: [
      /actualizar (mi )?datos?/i,
      /cambiar (mi )?(telefono|numero|direccion|correo)/i,
      /mi nuevo (telefono|numero)/i,
      /me cambi[eé]/i,
    ],
    weight: 0.85
  },
};

// Análisis de sentimiento simple
const SENTIMENT_PATTERNS = {
  positive: [
    /gracias/i, /excelente/i, /perfecto/i, /genial/i, /maravilloso/i,
    /bueno/i, /bien/i, /feliz/i, /contento/i, /satisfecho/i, /😊|😀|👍|💚|❤️|✨/,
  ],
  negative: [
    /mal/i, /horrible/i, /pesimo/i, /terrible/i, /queja/i, /molest/i,
    /frustrad/i, /enojad/i, /decepcionad/i, /😠|😡|😤|😞|😢/,
  ],
};

// Indicadores de urgencia
const URGENCY_PATTERNS = {
  critical: [
    /emergencia/i, /urgente/i, /inmediato/i, /ahora mismo/i,
    /dolor intenso/i, /no puedo respirar/i, /sangrado/i, /accidente/i,
  ],
  high: [
    /lo antes posible/i, /hoy/i, /necesito ya/i, /es urgente/i,
    /muy importante/i, /pronto/i,
  ],
  medium: [
    /esta semana/i, /pronto/i, /cuando pueda/i,
  ],
};

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Extrae entidades de un mensaje
 */
export function extractEntities(message: string): ExtractedEntities {
  const entities: ExtractedEntities = {};
  const cleanMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Extraer documento
  for (const pattern of ENTITY_PATTERNS.document) {
    const match = message.match(pattern);
    if (match) {
      const doc = (match[1] || match[0]).replace(/[^\d]/g, '');
      if (doc.length >= 6 && doc.length <= 12) {
        entities.document = doc;
        break;
      }
    }
  }
  
  // Extraer teléfono
  for (const pattern of ENTITY_PATTERNS.phone) {
    const match = message.match(pattern);
    if (match) {
      entities.phone = match[0].replace(/[^\d+]/g, '');
      break;
    }
  }
  
  // Extraer email
  for (const pattern of ENTITY_PATTERNS.email) {
    const match = message.match(pattern);
    if (match) {
      entities.email = match[0].toLowerCase();
      break;
    }
  }
  
  // Extraer especialidad
  for (const pattern of ENTITY_PATTERNS.specialty) {
    const match = cleanMessage.match(pattern);
    if (match) {
      const detected = match[0].toLowerCase();
      // Buscar en el mapeo
      for (const [key, value] of Object.entries(SPECIALTY_MAPPING)) {
        if (detected.includes(key)) {
          entities.specialty = value;
          break;
        }
      }
      if (entities.specialty) break;
    }
  }
  
  // Extraer fecha
  for (const pattern of ENTITY_PATTERNS.date) {
    const match = message.match(pattern);
    if (match) {
      entities.date = match[0];
      break;
    }
  }
  
  // Extraer hora
  for (const pattern of ENTITY_PATTERNS.time) {
    const match = message.match(pattern);
    if (match) {
      entities.time = match[0];
      break;
    }
  }
  
  // Extraer todos los números (para posibles selecciones)
  const numberMatches = message.match(/\b\d+\b/g);
  if (numberMatches) {
    entities.numbers = numberMatches;
  }
  
  return entities;
}

/**
 * Analiza la intención del mensaje con confianza
 */
export function analyzeIntent(message: string): IntentAnalysis {
  const cleanMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const entities = extractEntities(message);
  
  // Detectar intenciones
  const detectedIntents: Array<{ intent: string; confidence: number }> = [];
  
  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(cleanMessage)) {
        detectedIntents.push({
          intent,
          confidence: config.weight
        });
        break;
      }
    }
  }
  
  // Si solo hay un número largo, probablemente es un documento
  if (detectedIntents.length === 0 && entities.document && !entities.specialty) {
    detectedIntents.push({ intent: 'provide_document', confidence: 0.85 });
  }
  
  // Si menciona una especialidad sin otra intención clara, probablemente quiere agendar
  if (entities.specialty && !detectedIntents.some(d => d.intent === 'schedule')) {
    detectedIntents.push({ intent: 'schedule', confidence: 0.7 });
  }
  
  // Ordenar por confianza
  detectedIntents.sort((a, b) => b.confidence - a.confidence);
  
  const primaryIntent = detectedIntents[0]?.intent || 'unknown';
  const confidence = detectedIntents[0]?.confidence || 0;
  const secondaryIntents = detectedIntents.slice(1, 3).map(d => d.intent);
  
  // Analizar sentimiento
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  const positiveCount = SENTIMENT_PATTERNS.positive.filter(p => p.test(message)).length;
  const negativeCount = SENTIMENT_PATTERNS.negative.filter(p => p.test(message)).length;
  
  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > positiveCount) sentiment = 'negative';
  
  // Analizar urgencia
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  
  if (URGENCY_PATTERNS.critical.some(p => p.test(cleanMessage))) {
    urgency = 'critical';
  } else if (URGENCY_PATTERNS.high.some(p => p.test(cleanMessage))) {
    urgency = 'high';
  } else if (URGENCY_PATTERNS.medium.some(p => p.test(cleanMessage))) {
    urgency = 'medium';
  }
  
  return {
    primaryIntent,
    secondaryIntents,
    confidence,
    entities,
    sentiment,
    urgency
  };
}

/**
 * Construye el contexto enriquecido para el AI
 */
export async function buildEnrichedContext(
  phone: string,
  message: string
): Promise<EnrichedContext> {
  const cleanPhone = phone.replace(/@.*/, '');
  
  // Análisis de intención
  const intentAnalysis = analyzeIntent(message);
  
  // Obtener sesión y contexto de memoria
  const sessionContext = await ChatMemoryService.getSessionContext(cleanPhone);
  
  // Obtener memorias relevantes
  let relevantMemories: string | null = null;
  if (sessionContext?.session.id) {
    relevantMemories = await SemanticMemory.generateMemoryContext(
      sessionContext.session.id,
      message
    );
  }
  
  // Obtener preferencias del usuario
  const userPreferences = await SemanticMemory.getUserPreferences(cleanPhone);
  
  // Obtener último resumen
  let lastSummary: string | null = null;
  if (sessionContext?.session.id) {
    try {
      const [summaryRows] = await pool.execute<RowDataPacket[]>(
        `SELECT summary FROM whatsapp_chat_summaries 
         WHERE session_id = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [sessionContext.session.id]
      );
      if (summaryRows.length > 0) {
        lastSummary = summaryRows[0].summary;
      }
    } catch (error) {
      // Ignorar errores de resumen
    }
  }
  
  // Construir info del paciente
  let patientInfo = null;
  if (sessionContext?.patientInfo) {
    patientInfo = {
      id: sessionContext.patientInfo.id,
      name: sessionContext.patientInfo.name,
      document: sessionContext.patientInfo.document,
      phone: sessionContext.patientInfo.phone,
      epsName: sessionContext.patientInfo.eps_name,
      birthDate: null // Si está disponible
    };
  }
  
  return {
    session: sessionContext?.session || null,
    patientInfo,
    recentMessages: sessionContext?.recentMessages || [],
    relevantMemories,
    userPreferences,
    lastSummary,
    intentAnalysis
  };
}

/**
 * Genera el prompt de contexto para inyectar al sistema
 */
export function generateContextPrompt(context: EnrichedContext): string {
  const parts: string[] = [];
  
  // Análisis de intención
  parts.push(`📊 ANÁLISIS DEL MENSAJE:
- Intención detectada: ${context.intentAnalysis.primaryIntent} (${Math.round(context.intentAnalysis.confidence * 100)}% confianza)
- Sentimiento: ${context.intentAnalysis.sentiment}
- Urgencia: ${context.intentAnalysis.urgency}`);
  
  // Entidades extraídas
  const entities = context.intentAnalysis.entities;
  if (Object.keys(entities).length > 0) {
    const entityList: string[] = [];
    if (entities.document) entityList.push(`📄 Documento: ${entities.document}`);
    if (entities.phone) entityList.push(`📞 Teléfono: ${entities.phone}`);
    if (entities.specialty) entityList.push(`🏥 Especialidad: ${entities.specialty}`);
    if (entities.date) entityList.push(`📅 Fecha: ${entities.date}`);
    if (entities.time) entityList.push(`🕐 Hora: ${entities.time}`);
    
    if (entityList.length > 0) {
      parts.push(`\n🔍 ENTIDADES DETECTADAS:\n${entityList.join('\n')}`);
    }
  }
  
  // Información del paciente - INCLUIR patient_id EXPLÍCITAMENTE
  if (context.patientInfo) {
    parts.push(`\n👤 PACIENTE IDENTIFICADO:
- ⚠️ patient_id: ${context.patientInfo.id} ← USA ESTE NÚMERO EN scheduleAppointment
- Nombre: ${context.patientInfo.name}
- Documento: ${context.patientInfo.document}
- Teléfono: ${context.patientInfo.phone}
- EPS: ${context.patientInfo.epsName || 'No especificada'}`);
  }
  
  // Preferencias del usuario
  if (context.userPreferences) {
    const prefs: string[] = [];
    if (context.userPreferences.preferredSpecialtyId) {
      prefs.push(`Especialidad preferida ID: ${context.userPreferences.preferredSpecialtyId}`);
    }
    if (context.userPreferences.preferredLocationId) {
      prefs.push(`Sede preferida ID: ${context.userPreferences.preferredLocationId}`);
    }
    if (context.userPreferences.preferredDoctorId) {
      prefs.push(`Doctor preferido ID: ${context.userPreferences.preferredDoctorId}`);
    }
    if (prefs.length > 0) {
      parts.push(`\n⭐ PREFERENCIAS DEL USUARIO:\n${prefs.join('\n')}`);
    }
  }
  
  // Memorias relevantes
  if (context.relevantMemories) {
    parts.push(context.relevantMemories);
  }
  
  // Resumen de conversación anterior
  if (context.lastSummary) {
    parts.push(`\n📝 RESUMEN CONVERSACIÓN ANTERIOR:\n${context.lastSummary}`);
  }
  
  // Estado de la sesión
  if (context.session && context.session.current_state !== 'idle') {
    parts.push(`\n📌 ESTADO DE CONVERSACIÓN: ${context.session.current_state}`);
  }
  
  // ⚠️ INFORMACIÓN CRÍTICA DE CITA SELECCIONADA (si existe)
  if (context.session && context.session.availability_id) {
    parts.push(`\n🔴🔴🔴 CITA PENDIENTE DE AGENDAR - USA ESTOS IDs EXACTOS 🔴🔴🔴
- ⚠️ availability_id: ${context.session.availability_id} ← USA ESTE NÚMERO
- ⚠️ patient_id: ${context.session.patient_id} ← USA ESTE NÚMERO
- Doctor(a): ${context.session.selected_doctor || 'No especificado'}
- Fecha: ${context.session.selected_date || 'No especificada'}
- Hora: ${context.session.selected_time || 'No especificada'}
- Especialidad: ${context.session.specialty_name || 'No especificada'}

⚠️ CUANDO EL USUARIO CONFIRME, EJECUTA:
[TOOL:scheduleAppointment:{"patient_id":${context.session.patient_id},"availability_id":${context.session.availability_id},"scheduled_date":"${context.session.selected_date} ${context.session.selected_time}","reason":"Consulta de ${context.session.specialty_name || 'medicina'}","appointment_type":"Presencial","priority_level":"Normal"}]`);
  }
  
  return `
---
🧠 CONTEXTO ENRIQUECIDO (Usar para personalizar respuesta):
${parts.join('\n')}
---
`;
}

/**
 * Post-procesa una respuesta del bot para auto-capturar memorias
 */
export async function postProcessResponse(
  sessionId: number,
  userMessage: string,
  botResponse: string,
  patientId?: number
): Promise<void> {
  try {
    // Auto-captura de memorias del mensaje del usuario
    await SemanticMemory.autoCapture(
      sessionId,
      [{ role: 'user', content: userMessage }],
      patientId
    );
    
    // Registrar analytics
    await pool.execute(
      `INSERT INTO whatsapp_bot_analytics 
       (session_id, action_type, action_details)
       VALUES (?, 'message_received', ?)`,
      [sessionId, JSON.stringify({ messageLength: userMessage.length })]
    );
    
    await pool.execute(
      `INSERT INTO whatsapp_bot_analytics 
       (session_id, action_type, action_details)
       VALUES (?, 'message_sent', ?)`,
      [sessionId, JSON.stringify({ responseLength: botResponse.length })]
    );
    
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error en post-procesamiento');
  }
}

// ============================================================================
// EXPORTACIÓN
// ============================================================================

export default {
  // Extracción de entidades
  extractEntities,
  
  // Análisis de intención
  analyzeIntent,
  
  // Contexto enriquecido
  buildEnrichedContext,
  generateContextPrompt,
  
  // Post-procesamiento
  postProcessResponse,
};
