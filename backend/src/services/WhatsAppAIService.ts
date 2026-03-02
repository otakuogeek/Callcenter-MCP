/**
 * WhatsApp AI Service - Valeria Bot
 * Servicio de IA para WhatsApp con soporte multi-proveedor (OpenAI, Groq, LangGraph)
 * Integra las herramientas MCP para gestión de citas médicas
 * 
 * @version 5.0.0
 * @description Mejoras incluidas:
 *   - Sistema de personalidad avanzado (Valeria - recepcionista colombiana)
 *   - Gestión de estados de conversación
 *   - Detección de intenciones MEJORADA
 *   - Manejo contextual mejorado
 *   - Soporte para LangGraph (agente con estado)
 *   - Cache con TTL real por conversación
 *   - Mejor manejo de errores en tool calls
 *   - Logging estructurado con pino
 *   - Métricas de rendimiento
 *   - Feedback claro al usuario en errores
 *   - 🆕 MEMORIA SEMÁNTICA PERSISTENTE (inspirado en moltbot)
 *   - 🆕 AUTO-RECALL de memorias relevantes
 *   - 🆕 AUTO-CAPTURE de información importante
 *   - 🆕 COMPRENSIÓN MEJORADA con extracción de entidades
 *   - 🆕 v5: FLUJO CONTEXTUAL DINÁMICO - No repite preguntas, usa contexto real
 */

import axios from 'axios';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import pino from 'pino';
import DirectDBTools from './DirectDBTools';
import * as ChatMemoryService from './ChatMemoryService';
import { personalityManager } from './WhatsAppPersonality';
import { conversationManager } from './WhatsAppConversationManager';
import {
  formatDateColombia,
  formatTimeColombia,
  formatDateTimeColombia,
  formatFullDateColombia,
  getTodayColombia
} from '../utils/dateUtils';
import {
  getStateContext,
  updateState,
  ConversationState,
  incrementRetry,
  shouldResetDueToErrors,
  resetState,
  getRecoveryMessage,
  isAffirmative,
  isNegative
} from './WhatsAppStateManager';
import * as PersistenceService from './WhatsAppPersistenceService';
// 🆕 NUEVOS SERVICIOS DE MEMORIA SEMÁNTICA Y COMPRENSIÓN MEJORADA
import SemanticMemory from './WhatsAppSemanticMemory';
import EnhancedUnderstanding from './WhatsAppEnhancedUnderstanding';

// 🆕 UTILIDADES DE PROMPT PARA IA
import {
  isPlaceholder,
  fixToolCallPlaceholders,
  cleanResponseFromToolResults,
  limitEmojisPerLine,
  getToolErrorMessage,
  normalizeToolResultDatesForWhatsApp,
  summarizeToolResult,
  parseToolCalls
} from './WhatsAppPromptUtils';
// 🆕 PERSISTENCIA DE CONVERSACIÓN EN JSON Y BD
import ConversationPersistence, {
  generateContextForAI,
  getConversation,
  updatePatient,
  recordMessage,
  addAppointment,
  autoIdentify,
  updateContext,
  markQuestion,
  saveAnswer,
  KnownPatientData,
  ConversationData
} from './ConversationPersistence';

// ============================================================================
// FUNCIONES AUXILIARES PARA PERSISTENCIA
// ============================================================================

/**
 * Obtiene el session_id de WhatsApp para un número de teléfono
 */
async function getSessionIdForPhone(phone: string): Promise<number | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM whatsapp_chat_sessions WHERE phone = ? LIMIT 1',
      [phone]
    );
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    aiLogger.error({ error }, 'Error obteniendo session_id');
    return null;
  }
}

// ============================================================================
// LOGGER ESTRUCTURADO
// ============================================================================

const aiLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'whatsapp-ai',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined
});

// Configuración de proveedores de IA
// WHATSAPP_USE_GROQ=true -> Groq, WHATSAPP_USE_GROQ=false -> ChatGPT
const USE_GROQ = process.env.WHATSAPP_USE_GROQ?.toLowerCase() === 'true';

// Groq Configuration (más rápido y económico)
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ChatGPT Configuration (más preciso)
const CHATGPT_API_URL = 'https://api.openai.com/v1/chat/completions';
const CHATGPT_API_KEY = process.env.WHATSAPP_CHATGPT_API_KEY || process.env.OPENAI_API_KEY;
const CHATGPT_MODEL = process.env.CHATGPT_MODEL || 'gpt-4o';

// Variable global del modelo activo (usada en saveMessage)
const AI_MODEL = USE_GROQ ? GROQ_MODEL : CHATGPT_MODEL;

// LangGraph feature flag
const USE_LANGGRAPH = process.env.WHATSAPP_USE_LANGGRAPH === 'true';
let LangGraphAgent: any = null;
if (USE_LANGGRAPH) {
  try {
    // Dynamic import to avoid hard dependency
    const mod = require('./WhatsAppAgentCore');
    LangGraphAgent = mod.agentCore || mod.default;
    aiLogger.info('LangGraph agent loaded');
  } catch (e) {
    aiLogger.warn('LangGraph agent not available');
  }
}

// Determinar configuración activa basada en WHATSAPP_USE_GROQ
function getAIConfig() {
  if (USE_GROQ) {
    return {
      apiUrl: GROQ_API_URL,
      apiKey: GROQ_API_KEY,
      model: GROQ_MODEL,
      provider: 'Groq',
      isGPT5: false
    };
  }
  // ChatGPT cuando WHATSAPP_USE_GROQ=false
  const isGPT5 = CHATGPT_MODEL.startsWith('gpt-5');
  return {
    apiUrl: CHATGPT_API_URL,
    apiKey: CHATGPT_API_KEY,
    model: CHATGPT_MODEL,
    provider: 'ChatGPT',
    isGPT5
  };
}

// ============================================================================
// HELPER: Actualizar estado de conversación según intención detectada
// ============================================================================

async function updateConversationStateByIntent(
  phone: string,
  intent: string,
  currentState: string
): Promise<void> {
  try {
    switch (intent) {
      case 'greeting':
        // Solo transicionar a greeting si está idle o completado
        if (currentState === 'idle' || currentState === 'completed') {
          await conversationManager.transitionState(phone, 'greeting');
        }
        break;

      case 'schedule':
        // Flujo de agendamiento según estado actual
        if (currentState === 'idle' || currentState === 'greeting') {
          await conversationManager.transitionState(phone, 'identifying', 'awaiting_document');
        } else if (currentState === 'identifying') {
          await conversationManager.transitionState(phone, 'scheduling');
        } else if (currentState === 'checking_availability') {
          await conversationManager.transitionState(phone, 'confirming');
        }
        break;

      case 'cancel':
        await conversationManager.transitionState(phone, 'canceling');
        break;

      case 'reschedule':
        await conversationManager.transitionState(phone, 'rescheduling');
        break;

      case 'availability':
        await conversationManager.transitionState(phone, 'checking_availability');
        break;

      case 'waiting_list':
        await conversationManager.transitionState(phone, 'waiting_list');
        break;

      case 'info':
        await conversationManager.transitionState(phone, 'info_request');
        break;

      case 'goodbye':
        // Marcar como completado
        await conversationManager.completeConversation(phone, 'Usuario se despidió');
        // Limpiar historial de personalidad
        personalityManager.clearConversationHistory(phone);
        break;

      case 'help':
      case 'thanks':
        // No cambiar estado, solo responder
        break;

      case 'unknown':
      default:
        // Mantener estado actual
        break;
    }
  } catch (error) {
    aiLogger.error({ error, phone, intent, currentState }, 'Error actualizando estado por intención');
  }
}

// ============================================================================
// 🆕 GENERADOR DE CONTEXTO DINÁMICO - v5.0
// ============================================================================
// Esta función genera un resumen contextual que le dice al modelo EXACTAMENTE
// qué información ya tiene, para que NO repita preguntas innecesariamente

interface StateContextType {
  currentState?: string;
  patientId?: number;
  patientName?: string;
  patientDocument?: string;
  patientPhone?: string;
  specialtyId?: number;
  specialtyName?: string;
  selectedDoctor?: string;
  selectedDoctorId?: number;
  selectedDate?: string;
  selectedTime?: string;
  availabilityId?: number;
  availableAppointments?: any[];
  availableDoctors?: string[];
  lastAppointmentId?: number;
  scheduledDatetime?: string;
  timeSlots?: any[];
}

function generateDynamicContext(stateContext: StateContextType, phone?: string): string {
  const lines: string[] = [];

  // 🆕 PRIMERO: Agregar contexto de persistencia JSON si hay teléfono
  if (phone) {
    const persistentContext = generateContextForAI(phone);
    if (persistentContext && persistentContext.includes('PACIENTE IDENTIFICADO')) {
      lines.push(persistentContext);
      lines.push('');
    }
  }

  lines.push('## 📋 CONTEXTO ACTUAL');
  lines.push('');

  // Información del paciente - CONCISA
  if (stateContext.patientId) {
    lines.push(`✅ **Paciente:** ${stateContext.patientName || 'Identificado'} (ID: ${stateContext.patientId})`);
    if (stateContext.patientDocument) lines.push(`   Documento: ${stateContext.patientDocument}`);
    lines.push('   → NO pidas cédula de nuevo');
  } else {
    lines.push('❌ **Paciente:** No identificado → Pedir cédula');
  }

  // Especialidad - CONCISA
  if (stateContext.specialtyName) {
    lines.push(`✅ **Especialidad:** ${stateContext.specialtyName}`);
    lines.push('   → NO preguntes especialidad de nuevo');
  } else if (stateContext.patientId) {
    lines.push('❌ **Especialidad:** Pendiente → Preguntar qué necesita');
  }

  // Doctor y cita
  if (stateContext.selectedDoctor) {
    lines.push(`✅ **Doctor:** ${stateContext.selectedDoctor}`);
  }
  if (stateContext.selectedDate) {
    lines.push(`✅ **Fecha:** ${stateContext.selectedDate} ${stateContext.selectedTime || ''}`);
  }
  if (stateContext.availabilityId) {
    lines.push(`✅ **Availability ID:** ${stateContext.availabilityId}`);
  }

  // Opciones disponibles
  if (stateContext.availableAppointments?.length) {
    lines.push(`📅 **Opciones cargadas:** ${stateContext.availableAppointments.length} citas disponibles`);
  }

  // Cita reciente
  if (stateContext.lastAppointmentId) {
    lines.push(`🎉 **Cita #${stateContext.lastAppointmentId}** ya confirmada - NO agendar de nuevo`);
  }

  lines.push('');
  lines.push('---');

  return lines.join('\n');
}

// ============================================================================
// SYSTEM PROMPT - VALERIA v8.0 (Registro Completo + Validación EPS + CUPS)
// ============================================================================

const VALERIA_SYSTEM_PROMPT = `# Valeria - Fundación Biosanar IPS

Eres Valeria, asistente virtual de Fundación Biosanar IPS (San Gil, Santander).

## 🎯 TU PERSONALIDAD
- Amable, cálida y profesional
- Respuestas CORTAS y DIRECTAS (máximo 3-4 líneas)
- Usa emojis con moderación (1-2 por mensaje)
- SIEMPRE usa el nombre del paciente cuando lo tengas
- SOLO preséntate como "Valeria" en el PRIMER mensaje de la conversación

## 📍 INFORMACIÓN BÁSICA
- **Hoy:** {{CURRENT_DATETIME}}
- **Sede:** Cra. 9 #10-29, San Gil
- **Teléfono:** 6076911308

## 📋 REGISTRO DE PACIENTES (CAMPOS COMPLETOS)

### CAMPOS OBLIGATORIOS:
1. **Cédula** (normalizada: sin puntos, espacios ni guiones)
2. **Nombre completo**
3. **Fecha de nacimiento** (formato DD/MM/AAAA, convertir a YYYY-MM-DD)
4. **Teléfono** (10 dígitos)

### CAMPOS OPCIONALES (IMPORTANTE):
5. **EPS** - Pregunta: "¿Cuál es su EPS?" (MUY IMPORTANTE para validar especialidades)
6. **Género** (M/F/Otro) - Pregunta: "¿Es usted masculino o femenino?"
7. **Correo electrónico** - Pregunta: "¿Tiene correo electrónico?" (aceptar "no tengo")
8. **Dirección** - Pregunta: "¿Cuál es su dirección?" (aceptar "no tengo")
9. **Municipio** - Pregunta: "¿En qué municipio vive?" (aceptar "no tengo")

### FLUJO DE REGISTRO:
1. Solicita cédula → busca con searchPatient
2. Si NO existe:
   a. Solicita nombre completo
   b. Solicita fecha de nacimiento (valida formato DD/MM/AAAA)
   c. Solicita teléfono
   d. Solicita EPS (RECOMIENDA proporcionarla: "Tener su EPS registrada nos ayuda a verificar qué especialidades están autorizadas")
   e. Opcionalmente solicita: género, email, dirección, municipio
   f. Confirma datos con el paciente
   g. Llama a registerPatientSimple con TODOS los datos capturados
3. Si SÍ existe: guarda patient_id y continúa

## 🏥 VALIDACIÓN DE EPS Y ESPECIALIDADES

### DESPUÉS DEL REGISTRO:
1. **Si tiene EPS registrada:**
   - Llama a getAuthorizedSpecialtiesForEPS(eps_id)
   - Muestra SOLO las especialidades autorizadas
   - Si no hay autorizadas: "Su EPS no tiene autorización para [especialidad]. ¿Desea ver otras opciones o registrarse en lista de espera?"

2. **Si NO tiene EPS:**
   - Muestra todas las especialidades disponibles
   - Recomienda: "Si desea, puede actualizarnos su EPS para verificar autorizaciones"

### EJEMPLO:
Usuario: "Necesito medicina general"
Valeria: [Si tiene EPS] "Veo que su EPS es Sanitas. Déjeme verificar..."
         [Llama getAuthorizedSpecialtiesForEPS]
         - Si autorizado: "Perfecto, medicina general está autorizada ✓"
         - Si NO autorizado: "Su EPS no tiene autorización para medicina general. Puedo ofrecerle [otras opciones] o lista de espera"

## 🩺 CÓDIGOS CUPS PARA ECOGRAFÍAS

### SI LA ESPECIALIDAD REQUIERE CUPS (Ecografía):
1. Solicita código CUPS: "Necesito el código CUPS que aparece en su orden médica (ejemplo: 881101)"
2. Llama a getCUPSInfo(cups_code)
3. **Si existe:** Confirma el nombre → "Perfecto, código 881101: Ecografía Abdominal Superior ✓"
4. **Si NO existe:** Solicita nombre manualmente → "No encuentro ese código. ¿Cuál es el nombre del examen?"
5. Pasa cups_code Y cups_manual_name al scheduleAppointment

### EJEMPLO:
Usuario: "Necesito ecografía"
Valeria: "Con gusto. ¿Puede proporcionarme el código CUPS de su orden médica?"
Usuario: "881101"
Valeria: [Busca con getCUPSInfo] "Perfecto, corresponde a Ecografía Abdominal Superior ✓"

## 👥 CITAS DOBLES (PROCEDIMIENTOS LARGOS)

### PARA ECOGRAFÍAS U OTROS PROCEDIMIENTOS:
1. Pregunta: "¿Necesita cita doble? (dos turnos consecutivos para exámenes largos)"
2. **Si acepta:** pasa create_double_appointment=true al scheduleAppointment
3. **Confirma ambas citas:** "Listo, le agendé dos citas consecutivas: 8:00 AM y 8:20 AM"

### EJEMPLO:
Valeria: "Para ecografías ofrecemos cita doble si el examen requiere más tiempo. ¿La necesita?"
Usuario: "Sí"
Valeria: [Agenda con create_double_appointment=true]
         "Perfecto, le agendé dos turnos consecutivos: 8:00 AM y 8:20 AM con el/la Dr/a López"

## ✅ CONFIRMACIÓN FINAL MEJORADA

### AL CONFIRMAR CITA, MENCIONA:
1. ✅ **Nombre del doctor** (ANTES de confirmar)
2. ✅ **Fecha completa** (día de la semana + fecha)
3. ✅ **Hora** (formato conversacional: 8:00 AM)
4. ✅ **Sede/ubicación**
5. ✅ **Especialidad**
6. ✅ **Número de cita** (appointment_id)
7. ✅ **Si es cita doble:** menciona ambos horarios
8. ✅ **Si tiene CUPS:** menciona código y nombre del examen

### EJEMPLO COMPLETO:
"Perfecto [Nombre], su cita ha sido confirmada ✓

📋 **Detalles:**
- Doctor/a: Dr. Juan López
- Fecha: Lunes 10 de febrero de 2025
- Hora: 8:00 AM a 8:40 AM (cita doble)
- Sede: Socorro
- Especialidad: Ecografía
- Examen: Ecografía Abdominal Superior (CUPS 881101)
- Número de cita: #12345

Le enviaremos recordatorios por WhatsApp 📱"

## � FLUJO CORRECTO DE SELECCIÓN DE FECHA Y HORA

### PASO 1: MOSTRAR FECHAS DISPONIBLES (SIN HORAS)
Cuando consultes disponibilidad, muestra SOLO las fechas.
Ejemplo: Tenemos disponible Martes 10, Miércoles 11, Jueves 12 de febrero. ¿Cuál te sirve?

### PASO 2: USUARIO ELIGE UNA FECHA
Cuando el usuario diga "martes 10", "para el martes", "el 10", "martes", etc:

**ACCION OBLIGATORIA - LLAMAR getAvailableTimeSlots:**
1. Identifica el availability_id de la fecha elegida
2. DEBES llamar [TOOL:getAvailableTimeSlots:{"availability_id":XXX}]
3. Muestra SOLO los horarios que retorne la herramienta

**NUNCA INVENTES HORARIOS:**
- NO digas "8:00 am" si la disponibilidad empieza a la 1:00 pm
- NO digas "10:30 am" (las citas son cada 20 min: X:00, X:20, X:40)
- SIEMPRE verifica el rango start_time a end_time

Ejemplo CORRECTO:
Usuario: para el martes
Valeria: [TOOL:getAvailableTimeSlots:{"availability_id":857}]
"Perfecto, para el martes 10 tenemos: 1:00 pm, 1:20 pm. Cual hora prefieres?"

### PASO 3: USUARIO ELIGE HORA
Cuando diga "2:00 pm", "a las 2", etc:
1. Confirma fecha + hora + doctor
2. Ejecuta scheduleAppointment inmediatamente

## 🔄 CUANDO EL USUARIO RECHAZA UNA FECHA

### SI DICE "NO", "NO PUEDO", "QUE OTRO DÍA TIENES", "OTRA FECHA":
1. **ENTIENDE:** El usuario está RECHAZANDO la fecha ofrecida
2. **NO ES:** Reagendar una cita existente
3. **ACCIÓN:** Muestra automáticamente las SIGUIENTES opciones disponibles (solo fechas)

### EJEMPLO CORRECTO:
Valeria: "Tenemos el martes 10 de febrero ¿Te sirve?"
Usuario: "no que otro día tienes"
Valeria: [ENTIENDE: quiere ver otras opciones]
         "Claro, también tenemos:
         • Miércoles 11 de febrero
         • Jueves 12 de febrero
         ¿Cuál te viene mejor?"

### FRASES QUE SIGNIFICAN SELECCIÓN DE FECHA:
- "martes 10", "el martes", "martes"
- "para el 10", "el 10 de febrero"
- "miércoles", "jueves", "viernes"
- "ese día", "esa fecha", "sí, el martes"

**Cuando detectes estas frases:** NO preguntes de nuevo, muestra horarios directamente

## ⛔⛔⛔ REGLAS CRÍTICAS - CERO INVENCIÓN ⛔⛔⛔

### 🚫 PROHIBIDO ABSOLUTAMENTE:
1. NUNCA inventes fechas, días, horarios, doctores o especialidades
2. NUNCA calcules días de la semana (Lunes, Martes, etc.) - SOLO usa los datos
3. NUNCA ofrezcas horarios inventados - SIEMPRE usa getAvailableTimeSlots
4. NUNCA digas "8:00 am" o "10:30 am" sin llamar a getAvailableTimeSlots primero
5. NUNCA uses horarios X:30 (solo existen X:00, X:20, X:40)
4. NUNCA digas "Jueves 5 de febrero" si no está en los resultados
5. NUNCA ofrezcas citas para HOY ({{CURRENT_DATETIME}})
6. NUNCA uses "placeholders" en scheduleAppointment, usa valores REALES
7. NUNCA confirmes una cita sin haber ejecutado scheduleAppointment
8. NUNCA confundas "ver otras fechas" con "reagendar cita existente"

### ✅ OBLIGATORIO:
1. SIEMPRE usa EXACTAMENTE el valor de "appointment_date_formatted" de los resultados
2. SIEMPRE usa EXACTAMENTE los valores de "start_time_formatted" o "available_times_formatted"
3. SOLO muestra opciones que tengan slots_available > 0
4. Si no tienes datos de herramientas, ejecuta getAvailableAppointments PRIMERO
5. SIEMPRE ejecuta scheduleAppointment cuando tengas TODOS los datos necesarios
6. SIEMPRE menciona el nombre del doctor en la confirmación final
7. Si el usuario rechaza una fecha, muestra OTRAS opciones automáticamente

### 📊 FORMATO DE DATOS QUE RECIBIRÁS:
Los resultados de getAvailableAppointments incluyen:
- appointment_date_formatted: "Martes 10 de febrero" (USAR TAL CUAL)
- start_time_formatted: "8:00 AM" (USAR TAL CUAL)
- slots_available: número de cupos (IGNORAR si es 0)
- doctor_name: "Dra. Laura Julia Podeva" (USAR TAL CUAL)

### ⚠️ VALIDACIÓN DE HORARIOS:
Las citas son cada 20 minutos: 8:00, 8:20, 8:40, 9:00, 9:20, 9:40, 10:00, 10:20, 10:40...
NUNCA ofrezcas: 8:30, 10:30, 11:30, etc. - ESTOS NO EXISTEN

## 🤫 SILENT TOKEN
Responde SOLO con [NO_REPLY] cuando:
- Solo emojis sin texto
- Spam o publicidad
- Caracteres random
- "ok" o "gracias" después de completar

## 🔧 HERRAMIENTAS DISPONIBLES

**Ver disponibilidad:**
[TOOL:getAvailableAppointments:{"specialty_name":"Odontologia"}]

**Buscar paciente:**
[TOOL:searchPatient:{"document":"12345678"}]

**Registrar paciente (COMPLETO):**
[TOOL:registerPatientSimple:{"document":"12345678","name":"Juan Pérez","phone":"3001234567","eps_id":1,"birth_date":"1990-05-15","gender":"M","email":"juan@email.com","address":"Cra 10 #5-20","city":"San Gil"}]

**Validar EPS:**
[TOOL:getAuthorizedSpecialtiesForEPS:{"eps_id":1}]

**Buscar CUPS:**
[TOOL:getCUPSInfo:{"cups_code":"881101"}]

**Agendar (CON CUPS Y CITA DOBLE):**
[TOOL:scheduleAppointment:{"patient_id":1,"availability_id":2,"scheduled_date":"2026-02-10 13:00:00","reason":"Ecografía","cups_code":"881101","cups_manual_name":"Ecografía Renal","create_double_appointment":true}]

## 💬 EJEMPLO CONVERSACIÓN COMPLETA

**Usuario:** "Hola, necesito una cita"
**Valeria:** "¡Hola! Soy Valeria de Biosanar 😊 ¿Cuál es su número de cédula?"

**Usuario:** "12345678"
**Valeria:** [searchPatient] "No lo encuentro registrado. ¿Cuál es su nombre completo?"

**Usuario:** "Juan Pérez"
**Valeria:** "Perfecto Juan. ¿Cuál es su fecha de nacimiento? (formato DD/MM/AAAA)"

**Usuario:** "15/05/1990"
**Valeria:** "Gracias. ¿Cuál es su teléfono?"

**Usuario:** "3001234567"
**Valeria:** "Último dato importante: ¿Cuál es su EPS? (Tener su EPS registrada nos ayuda a verificar autorizaciones)"

**Usuario:** "Sanitas"
**Valeria:** [registerPatientSimple con todos los datos]
         [getAuthorizedSpecialtiesForEPS]
         "Listo Juan, ya está registrado ✓ Para su EPS puedo agendar: Medicina General, Odontología, Psicología. ¿Cuál necesita?"

**Usuario:** "Ecografía"
**Valeria:** "Con gusto. Necesito el código CUPS de su orden médica (ejemplo: 881101)"

**Usuario:** "881101"
**Valeria:** [getCUPSInfo] "Perfecto, código 881101: Ecografía Abdominal Superior ✓
         ¿Necesita cita doble? (dos turnos consecutivos)"

**Usuario:** "Sí"
**Valeria:** [getAvailableAppointments]
         "Tenemos disponible con el Dr. López:
         • Lunes 10 de febrero a las 8:00 AM
         ¿Le agendo la cita doble?"

**Usuario:** "Sí"
**Valeria:** [scheduleAppointment con create_double_appointment=true y cups_code]
         "Perfecto Juan, su cita ha sido confirmada ✓
         
         📋 Detalles:
         - Doctor: Dr. Juan López
         - Fecha: Lunes 10 de febrero de 2025
         - Hora: 8:00 AM a 8:40 AM (cita doble)
         - Sede: Socorro
         - Examen: Ecografía Abdominal Superior (CUPS 881101)
         - Número de cita: #12345
         
         Le enviaremos recordatorios 📱"
`;


// ============================================================================
// INTERFACES
// ============================================================================

interface ConversationContext {
  phone: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  patient_id?: number;
  patient_name?: string;
  patient_document?: string;
  patient_eps_id?: number;
  pending_action?: string;
  collected_data?: Record<string, any>;
  last_tool_result?: any;
  createdAt: number;
  lastActivityAt: number;
  // Campos de memoria persistente
  db_session_id?: number;
}

interface AIResponse {
  text: string;
  toolCalls?: Array<{ name: string; args: Record<string, any> }>;
  shouldContinue: boolean;
}

interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  userFriendlyError?: string;
}

// ============================================================================
// CACHE DE CONVERSACIONES CON TTL REAL
// ============================================================================

interface CacheEntry {
  context: ConversationContext;
  expiresAt: number;
}

const conversationCache = new Map<string, CacheEntry>();
const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutos
const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Limpiar cada 5 minutos
const MAX_CACHE_SIZE = 500; // Límite máximo de conversaciones en cache

/**
 * Obtener o crear conversación con TTL (versión síncrona para cache en memoria)
 */
function getOrCreateCachedConversation(phone: string): ConversationContext {
  const now = Date.now();
  const entry = conversationCache.get(phone);

  // Si existe y no ha expirado, actualizar lastActivityAt y renovar TTL
  if (entry && entry.expiresAt > now) {
    entry.context.lastActivityAt = now;
    entry.expiresAt = now + CONVERSATION_TTL_MS;
    return entry.context;
  }

  // Si expiró o no existe, crear nueva
  if (entry) {
    aiLogger.debug({ phone }, 'Conversation expired, creating new one');
  }

  const newContext: ConversationContext = {
    phone,
    messages: [],
    createdAt: now,
    lastActivityAt: now
  };

  conversationCache.set(phone, {
    context: newContext,
    expiresAt: now + CONVERSATION_TTL_MS
  });

  return newContext;
}

/**
 * Obtener conversación con memoria persistente de la base de datos
 * Combina cache en memoria + historial de DB para mejor contexto
 */
async function getConversationWithMemory(phone: string): Promise<ConversationContext> {
  const now = Date.now();
  const entry = conversationCache.get(phone);

  // Si existe en cache y no ha expirado, usarlo
  if (entry && entry.expiresAt > now) {
    entry.context.lastActivityAt = now;
    entry.expiresAt = now + CONVERSATION_TTL_MS;
    return entry.context;
  }

  // Cargar contexto desde la base de datos
  try {
    const dbContext = await ChatMemoryService.getSessionContext(phone);

    let messages: Array<{ role: string; content: string }> = [];

    // Si hay sesión en DB, cargar mensajes recientes
    if (dbContext.sessionId) {
      const dbMessages = await ChatMemoryService.getRecentMessages(dbContext.sessionId, 15);
      messages = ChatMemoryService.messagesToAIFormat(dbMessages);

      aiLogger.info({
        phone,
        sessionId: dbContext.sessionId,
        patientName: dbContext.patientName,
        messagesLoaded: messages.length
      }, 'Loaded conversation from database');
    }

    const newContext: ConversationContext = {
      phone,
      messages,
      createdAt: now,
      lastActivityAt: now,
      patient_id: dbContext.patientId || undefined,
      patient_name: dbContext.patientName || undefined,
      patient_document: dbContext.patientDocument || undefined,
      db_session_id: dbContext.sessionId || undefined
    };

    conversationCache.set(phone, {
      context: newContext,
      expiresAt: now + CONVERSATION_TTL_MS
    });

    return newContext;
  } catch (error) {
    aiLogger.warn({ phone, error }, 'Failed to load memory from DB, using fresh context');
    return getOrCreateCachedConversation(phone);
  }
}

/**
 * Guardar mensaje en la memoria persistente
 */
async function saveMessageToMemory(phone: string, role: 'user' | 'assistant' | 'tool', content: string, options?: {
  toolName?: string;
  toolResult?: any;
  tokensUsed?: number;
  responseTimeMs?: number;
}): Promise<void> {
  try {
    const session = await ChatMemoryService.getOrCreateSession(phone);
    await ChatMemoryService.saveMessage(session.id, role, content, options);
  } catch (error) {
    aiLogger.warn({ phone, error }, 'Failed to save message to DB');
    // No lanzamos error - la memoria es opcional
  }
}

/**
 * Actualizar información del paciente en la sesión
 */
async function updateSessionPatient(phone: string, patientId: number, patientName: string, patientDocument: string): Promise<void> {
  try {
    const session = await ChatMemoryService.getOrCreateSession(phone);
    await ChatMemoryService.updateSessionPatient(session.id, patientId, patientName, patientDocument);

    // También actualizar el cache en memoria
    const entry = conversationCache.get(phone);
    if (entry) {
      entry.context.patient_id = patientId;
      entry.context.patient_name = patientName;
      entry.context.patient_document = patientDocument;
    }
  } catch (error) {
    aiLogger.warn({ phone, error }, 'Failed to update patient in session');
  }
}

/**
 * Limpiar conversaciones expiradas y controlar tamaño del cache
 */
function cleanupExpiredConversations(): void {
  const now = Date.now();
  let expiredCount = 0;

  for (const [phone, entry] of conversationCache.entries()) {
    if (entry.expiresAt <= now) {
      conversationCache.delete(phone);
      expiredCount++;
    }
  }

  // Si aún hay demasiadas, eliminar las más antiguas
  if (conversationCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(conversationCache.entries())
      .sort((a, b) => a[1].context.lastActivityAt - b[1].context.lastActivityAt);

    const toRemove = entries.slice(0, conversationCache.size - MAX_CACHE_SIZE);
    for (const [phone] of toRemove) {
      conversationCache.delete(phone);
    }

    aiLogger.info({
      removed: toRemove.length,
      remaining: conversationCache.size
    }, 'Removed oldest conversations due to cache size limit');
  }

  if (expiredCount > 0) {
    aiLogger.debug({ expiredCount, remaining: conversationCache.size }, 'Cleaned up expired conversations');
  }
}

// Iniciar limpieza periódica
setInterval(cleanupExpiredConversations, CACHE_CLEANUP_INTERVAL_MS);

// ============================================================================
// FUNCIÓN PRINCIPAL DE PROCESAMIENTO
// ============================================================================

interface ProcessMessageResult {
  success: boolean;
  response?: string;
  toolCalls?: Array<{ name: string; result: string }>;
  error?: string;
  intent?: string; // 🆕 Intent detectado para métricas
}

export async function processMessage(
  message: string,
  phone: string,
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ProcessMessageResult> {
  const result = await processWhatsAppMessage(phone, message, messageHistory);

  if (result.response) {
    result.response = limitEmojisPerLine(result.response, 1);
  }

  return result;
}

// ============================================================================
// FUNCIONES AUXILIARES PARA REGISTRO DE PACIENTES
// ============================================================================

/**
 * Parsea una fecha de nacimiento en varios formatos comunes
 * Retorna YYYY-MM-DD o null si no se puede parsear
 */
function parseBirthDate(input: string): string | null {
  const cleaned = input.trim();
  
  // Meses en español
  const meses: Record<string, string> = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };

  // Formato: dd/mm/yyyy o dd-mm-yyyy o dd.mm.yyyy
  const slashMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (slashMatch) {
    const dd = slashMatch[1].padStart(2, '0');
    const mm = slashMatch[2].padStart(2, '0');
    const yyyy = slashMatch[3];
    if (parseInt(mm) >= 1 && parseInt(mm) <= 12 && parseInt(dd) >= 1 && parseInt(dd) <= 31) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // Formato: yyyy-mm-dd (ISO)
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Formato: "15 de marzo de 1990" o "15 marzo 1990"
  const textMatch = cleaned.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .match(/(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(?:de\s+|del?\s+)?(\d{4})/);
  if (textMatch) {
    const dd = textMatch[1].padStart(2, '0');
    const mm = meses[textMatch[2]];
    const yyyy = textMatch[3];
    if (mm) return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

/**
 * Formatea YYYY-MM-DD a dd/mm/yyyy para mostrar al usuario
 */
function formatBirthDateDisplay(dateStr: string): string {
  if (!dateStr) return 'No especificada';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Construye la lista numerada de EPS activas con convenio
 */
async function buildActiveEPSList(labelPronombre: string): Promise<string> {
  try {
    const epsResult = await DirectDBTools.listActiveEPS();
    if (epsResult.success && epsResult.data?.eps_list?.length > 0) {
      let list = '';
      epsResult.data.eps_list.forEach((eps: any, idx: number) => {
        list += `${idx + 1}. ${eps.name}\n`;
      });
      list += `\n_Responde con el número o el nombre de ${labelPronombre} EPS_`;
      return list;
    }
  } catch (err) {
    console.error('[WhatsAppAI] Error construyendo lista EPS:', err);
  }
  return `_Escribe el nombre de ${labelPronombre} EPS_`;
}

export async function processWhatsAppMessage(
  phone: string,
  message: string,
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  profileName?: string
): Promise<ProcessMessageResult> {
  const startTime = Date.now();
  const executedTools: Array<{ name: string; result: string }> = [];

  try {
    // Limpiar el teléfono del formato WhatsApp
    const cleanPhone = phone.replace(/@.*/, '');

    // Helpers: convertir fecha/hora UTC-0 a UTC-5 (Colombia) y formatear
    const convertToColombiaTime = (dateStr: string, timeStr: string): { date: string; time: string } => {
      if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };

      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);

      const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
      utcDate.setUTCHours(utcDate.getUTCHours() - 5);

      const colYear = utcDate.getUTCFullYear();
      const colMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
      const colDay = String(utcDate.getUTCDate()).padStart(2, '0');
      const colHours = String(utcDate.getUTCHours()).padStart(2, '0');
      const colMinutes = String(utcDate.getUTCMinutes()).padStart(2, '0');

      return {
        date: `${colYear}-${colMonth}-${colDay}`,
        time: `${colHours}:${colMinutes}`
      };
    };

    const formatDate = (dateStr: string): string => {
      if (!dateStr) return 'Fecha pendiente';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const formatTime = (timeStr: string): string => {
      if (!timeStr) return 'Hora pendiente';
      const parts = timeStr.split(':');
      if (parts.length < 2) return timeStr;
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    };

    // ============================================================================
    // 🆕 PASO 0.1: CARGAR/CREAR CONVERSACIÓN PERSISTENTE
    // ============================================================================

    // Intentar identificar automáticamente al paciente por teléfono
    const persistedConversation = await autoIdentify(cleanPhone);

    // Si el paciente fue identificado por teléfono, sincronizar con el estado
    if (persistedConversation.isIdentified && persistedConversation.patient.patientId) {
      const patient = persistedConversation.patient;

      // Sincronizar con el StateManager SOLO si no estamos en flujo de tercero
      const currentState = getStateContext(cleanPhone);
      const isSuppressed = currentState.suppressAutoIdentifyUntil && currentState.suppressAutoIdentifyUntil > Date.now();
      
      if (!currentState.patientId && !isSuppressed) {
        console.log(`[WhatsAppAI] 🔑 Paciente auto-identificado por teléfono: ${patient.fullName}`);
        updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY, {
          patientId: patient.patientId,
          patientName: patient.fullName,
          patientDocument: patient.documentNumber,
          patientPhone: patient.phone
        });
      } else if (isSuppressed) {
        console.log(`[WhatsAppAI] 🔒 Auto-identificación suprimida (flujo de beneficiario)`);
      }
    }

    // ============================================================================
    // PASO 0: SISTEMA DE PERSONALIDAD Y GESTIÓN DE CONVERSACIÓN
    // ============================================================================

    // Inicializar sistema de conversación
    await conversationManager.ensureTableExists();
    const conversation = await conversationManager.getOrCreateConversation(cleanPhone);

    // Obtener estado de la conversación para usarlo en todo el flujo
    let stateContext = getStateContext(cleanPhone);

    // 🆕 ANÁLISIS DE INTENCIÓN MEJORADO CON EXTRACCIÓN DE ENTIDADES
    const intentAnalysis = EnhancedUnderstanding.analyzeIntent(message);
    const intent = intentAnalysis.primaryIntent;
    const extractedEntities = intentAnalysis.entities;

    aiLogger.info({
      phone: cleanPhone,
      intent,
      confidence: intentAnalysis.confidence,
      entities: extractedEntities,
      sentiment: intentAnalysis.sentiment,
      urgency: intentAnalysis.urgency,
      state: conversation.state
    }, '🎯 Análisis de intención mejorado');

    // 🆕 CONSTRUIR CONTEXTO ENRIQUECIDO CON MEMORIA SEMÁNTICA
    let enrichedContextPrompt = '';
    try {
      const enrichedContext = await EnhancedUnderstanding.buildEnrichedContext(cleanPhone, message);
      if (enrichedContext) {
        enrichedContextPrompt = EnhancedUnderstanding.generateContextPrompt(enrichedContext);

        // Si detectamos entidades importantes, usarlas para mejorar el flujo
        if (enrichedContext.intentAnalysis.entities.document && !stateContext.patientDocument) {
          aiLogger.info({ document: enrichedContext.intentAnalysis.entities.document }, '📄 Documento detectado en mensaje');
        }
        if (enrichedContext.intentAnalysis.entities.specialty) {
          aiLogger.info({ specialty: enrichedContext.intentAnalysis.entities.specialty }, '🏥 Especialidad detectada en mensaje');

          // ⚠️ GUARDAR ESPECIALIDAD EN ESTADO PARA NO VOLVER A PREGUNTAR
          const detectedSpecialty = enrichedContext.intentAnalysis.entities.specialty;
          if (!stateContext.specialtyName) {
            updateState(cleanPhone, {
              specialtyName: detectedSpecialty
            });
            // 🆕 PERSISTIR ESPECIALIDAD EN CONVERSACIÓN JSON
            await updateContext(cleanPhone, {
              state: 'specialty_selection',
              selectedSpecialty: detectedSpecialty
            });
            await markQuestion(cleanPhone, 'especialidad');
            await saveAnswer(cleanPhone, 'especialidad', detectedSpecialty);
            aiLogger.info({ specialty: detectedSpecialty }, '✅ Especialidad guardada en estado y persistencia');

            // Actualizar stateContext para que esté disponible
            stateContext = getStateContext(cleanPhone);
          }
        }
      }
    } catch (error) {
      aiLogger.warn({ error }, 'Error construyendo contexto enriquecido');
    }

    // ============================================================================
    // PASO 0.41: CONSULTA AUTOMÁTICA DE DISPONIBILIDAD SI YA TENEMOS ESPECIALIDAD
    // ============================================================================
    // Si ya tenemos paciente Y especialidad, consultar disponibilidad automáticamente

    if (stateContext.patientId && stateContext.specialtyName && !stateContext.availableAppointments) {
      console.log(`[WhatsAppAI] 🔄 PASO 0.41: Tenemos paciente (${stateContext.patientId}) y especialidad (${stateContext.specialtyName}), consultando disponibilidad...`);

      const availResult = await DirectDBTools.getAvailableAppointments({
        specialty_name: stateContext.specialtyName
      });

      if (availResult.success && availResult.data?.appointments?.length > 0) {
        const appts = availResult.data.appointments;
        const opciones = availResult.data.opciones_disponibles || [];

        // Extraer info del doctor (auto-seleccionar si solo hay uno)
        const uniqueDoctors = [...new Set(appts.map((a: any) => a.doctor_name))];
        const firstAppt = appts[0];

        // Guardar en estado con AWAITING_DATE (no AWAITING_DATE_SELECTION que no existe)
        const stateUpdate: Record<string, any> = {
          availableAppointments: appts,
          specialtyId: firstAppt?.specialty_id
        };

        // Auto-seleccionar doctor si solo hay uno disponible
        if (uniqueDoctors.length === 1 && firstAppt) {
          stateUpdate.selectedDoctor = firstAppt.doctor_name;
          stateUpdate.selectedDoctorId = firstAppt.doctor_id;
        }

        updateState(cleanPhone, ConversationState.AWAITING_DATE, stateUpdate);

        // Actualizar stateContext
        stateContext = getStateContext(cleanPhone);

        const firstName = stateContext.patientName?.split(' ')[0] || '';

        // Mostrar SOLO FECHAS, luego cuando elija fecha mostrar horarios
        const uniqueDates = [...new Set(appts.map((a: any) => a.appointment_date_formatted))].slice(0, 5);

        let response = `¡Perfecto${firstName ? ', ' + firstName : ''}! 📅\n\nPara ${stateContext.specialtyName} tenemos disponibilidad en:\n\n`;
        uniqueDates.forEach((fecha: string, idx: number) => {
          response += `${idx + 1}. ${fecha}\n`;
        });

        response += `\n¿Cuál fecha te sirve? 😊`;

        executedTools.push({ name: 'getAvailableAppointments', result: `${appts.length} citas, ${uniqueDates.length} fechas` });

        return {
          success: true,
          response,
          toolCalls: executedTools
        };
      } else {
        // No hay disponibilidad
        const firstName = stateContext.patientName?.split(' ')[0] || '';
        return {
          success: true,
          response: `${firstName ? firstName + ', no' : 'No'} hay citas disponibles para ${stateContext.specialtyName} en este momento. 😔\n\n¿Te agrego a la lista de espera?`,
          toolCalls: []
        };
      }
    }

    console.log(`[WhatsAppAI] 🎯 Intención detectada: ${intent} (${Math.round(intentAnalysis.confidence * 100)}%) | Estado conversación: ${conversation.state}`);

    // ============================================================================
    // PASO 0.4: BÚSQUEDA AUTOMÁTICA DE PACIENTE SI SE DETECTA CÉDULA
    // ============================================================================

    // Detectar si el mensaje es principalmente un número de cédula (6-12 dígitos)
    const cleanMessage = message.replace(/[.\-\s,]/g, ''); // Limpiar puntos, guiones, espacios, comas
    const cedMatch = cleanMessage.match(/^(\d{6,12})$/);

    // No interceptar como cédula si estamos en flujo de registro (ej: pidiendo teléfono)
    if (cedMatch && !stateContext.patientId &&
        stateContext.currentState !== ConversationState.AWAITING_PATIENT_DATA) {
      const document = cedMatch[1];
      console.log(`[WhatsAppAI] 📄 Cédula detectada: ${document} - Ejecutando searchPatient automáticamente`);

      // Ejecutar searchPatient directamente
      const searchResult = await DirectDBTools.searchPatient({ document });

      if (searchResult.success && searchResult.data?.found) {
        const patient = searchResult.data.patient || searchResult.data.patients?.[0];
        const patientName = patient?.full_name || patient?.name;
        const patientPhone = patient?.phone || patient?.mobile || '';
        const patientId = patient?.id;
        const patientEps = patient?.eps_name || patient?.eps || '';

        // Si estamos en flujo de tercero, ir directo a selección de especialidad
        if (stateContext.isThirdParty) {
          console.log(`[WhatsAppAI] 👥 BENEFICIARIO encontrado: ${patientName} (ID: ${patientId}) - Flujo tercero`);
          
          updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY, {
            patientId,
            patientName,
            patientDocument: document,
            patientPhone
            // isThirdParty y requestorPatient* se mantienen del estado anterior
          });

          executedTools.push({ name: 'searchPatient', result: `Beneficiario encontrado: ${patientName}` });
          
          const firstName = patientName?.split(' ')[0] || '';
          return {
            success: true,
            response: `¡Encontré a ${firstName} en el sistema! 😊\n\n¿Para qué especialidad necesita la cita?`,
            toolCalls: executedTools,
            intent: 'schedule'
          };
        }

        // Flujo normal: Guardar en estado y confirmar teléfono
        updateState(cleanPhone, ConversationState.AWAITING_PHONE_CONFIRMATION, {
          patientId,
          patientName,
          patientDocument: document,
          patientPhone
        });

        // 🆕 PERSISTIR EN CONVERSACIÓN JSON
        await updatePatient(cleanPhone, {
          patientId,
          fullName: patientName,
          firstName: patientName?.split(' ')[0],
          documentNumber: document,
          phone: patientPhone,
          eps: patientEps
        });
        await markQuestion(cleanPhone, 'cedula');
        await markQuestion(cleanPhone, 'nombre');
        await updateContext(cleanPhone, { state: 'identification' });

        // Persistir en sesión de memoria
        if (patientId) {
          updateSessionPatient(cleanPhone, patientId, patientName, document).catch(() => { });
        }

        console.log(`[WhatsAppAI] ✓ Paciente encontrado y persistido: ${patientName} (ID: ${patientId})`);

        executedTools.push({ name: 'searchPatient', result: `Encontrado: ${patientName}` });

        // Preparar respuesta según si ya tenemos especialidad
        if (stateContext.specialtyName) {
          // Ya tenemos especialidad, buscar disponibilidad
          console.log(`[WhatsAppAI] 🎯 Ya tenemos especialidad ${stateContext.specialtyName}, buscando disponibilidad...`);

          const availResult = await DirectDBTools.getAvailableAppointments({
            specialty_name: stateContext.specialtyName
          });

          if (availResult.success && availResult.data?.appointments?.length > 0) {
            const appts = availResult.data.appointments;
            updateState(cleanPhone, ConversationState.AWAITING_DOCTOR_SELECTION, {
              availableAppointments: appts,
              specialtyId: appts[0]?.specialty_id
            });

            let response = `¡Hola ${patientName}! 😊\n\nPara ${stateContext.specialtyName} tenemos:\n\n`;

            appts.slice(0, 5).forEach((apt: any, idx: number) => {
              const fecha = apt.appointment_date_formatted || apt.appointment_date;
              const hora = apt.start_time_formatted || apt.start_time;
              response += `${idx + 1}. ${apt.doctor_name} - ${fecha} a las ${hora}\n`;
            });

            response += `\n¿Cuál te agendo?`;

            return { success: true, response, toolCalls: executedTools, intent: 'schedule' };
          }
        }

        // Sin especialidad, saludar por nombre y preguntar qué necesita
        const firstName = patientName.split(' ')[0]; // Solo primer nombre para más cercanía
        let response = `¡Hola ${firstName}! 😊 Ya te encontré en el sistema.\n\n¿Para qué especialidad necesitas la cita?`;

        return { success: true, response, toolCalls: executedTools, intent: 'identification' };

      } else {
        // Paciente no encontrado
        console.log(`[WhatsAppAI] ⚠ Paciente con cédula ${document} no encontrado`);
        executedTools.push({ name: 'searchPatient', result: `No encontrado: ${document}` });

        updateState(cleanPhone, ConversationState.AWAITING_PATIENT_DATA, {
          patientDocument: document,
          registrationPending: true,
          regStep: 'name'
        });

        // Personalizar mensaje según si es flujo de tercero
        const msgLabel = stateContext.isThirdParty
          ? `No encontré a esa persona con cédula ${document}. 😊\n\nPara registrarla, ¿cuál es su nombre completo?`
          : `No te encuentro con cédula ${document}. 😊\n\nPara crearte un perfil, ¿cuál es tu nombre completo?`;

        return {
          success: true,
          response: msgLabel,
          toolCalls: executedTools,
          intent: 'registration'
        };
      }
    }

    // ============================================================================
    // PASO 0.5: MANEJAR INTENCIONES ESPECIALES PRIMERO
    // ============================================================================

    // Intención de consultar citas propias
    if (intent === 'check_appointment' && stateContext.patientId) {
      console.log(`[WhatsAppAI] 📋 Consultando citas y lista de espera para paciente ${stateContext.patientId}`);

      // Consultar citas confirmadas
      const appointmentsResult = await DirectDBTools.getPatientAppointments({
        patient_id: stateContext.patientId,
        status: 'Confirmada'
      });

      // Consultar lista de espera
      const waitingListResult = await DirectDBTools.getPatientWaitingList({
        patient_id: stateContext.patientId
      });

      let response = '';

      // Mostrar citas confirmadas
      if (appointmentsResult.success && appointmentsResult.data?.appointments?.length > 0) {
        const appts = appointmentsResult.data.appointments;
        response += `📋 **Tienes ${appts.length} cita(s) programada(s):**\n\n`;
        appts.forEach((apt: any, idx: number) => {
          // Convertir de UTC-0 a UTC-5 (Colombia)
          const colombiaDateTime = convertToColombiaTime(apt.scheduled_date, apt.scheduled_time);
          response += `${idx + 1}. 📅 ${formatDate(colombiaDateTime.date)}\n`;
          response += `   🕐 ${formatTime(colombiaDateTime.time)}\n`;
          response += `   👨‍⚕️ ${apt.doctor_name || 'Por asignar'}\n`;
          response += `   🏥 ${apt.specialty_name}\n`;
          response += `   📍 ${apt.location_name}\n`;
          if (apt.reason) response += `   📝 ${apt.reason}\n`;
          response += `\n`;
        });
      } else {
        response += `📅 No tienes citas programadas actualmente.\n\n`;
      }

      // Mostrar lista de espera
      if (waitingListResult.success && waitingListResult.data?.waiting_list?.length > 0) {
        const waitingList = waitingListResult.data.waiting_list;
        response += `⏳ **Lista de espera (${waitingList.length}):**\n\n`;
        waitingList.forEach((item: any, idx: number) => {
          response += `${idx + 1}. 🏥 ${item.specialty_name}\n`;
          if (item.priority_level && item.priority_level !== 'Normal') {
            response += `   ⚡ Prioridad: ${item.priority_level}\n`;
          }
          response += `\n`;
        });
      }

      // Si no tiene nada
      if ((!appointmentsResult.success || !appointmentsResult.data?.appointments?.length) &&
        (!waitingListResult.success || !waitingListResult.data?.waiting_list?.length)) {
        response = "No tienes citas programadas ni solicitudes en lista de espera actualmente 📅\n\n¿Te gustaría agendar una cita? Solo dime qué especialidad necesitas 😊";
      } else {
        response += `¿Necesitas algo más? 😊`;
      }

      return {
        success: true,
        response,
        toolCalls: []
      };
    }

    // Intención de cancelar cita
    if (intent === 'cancel' && stateContext.patientId) {
      console.log(`[WhatsAppAI] ❌ Iniciando cancelación para paciente ${stateContext.patientId}`);

      const appointmentsResult = await DirectDBTools.getPatientAppointments({
        patient_id: stateContext.patientId,
        status: 'Confirmada'
      });

      if (!appointmentsResult.success || !appointmentsResult.data?.appointments?.length) {
        return {
          success: true,
          response: 'No tienes citas confirmadas para cancelar en este momento. 📅\n\n¿Quieres agendar una nueva cita?',
          toolCalls: []
        };
      }

      const appts = appointmentsResult.data.appointments;
      updateState(cleanPhone, ConversationState.CANCELING_APPOINTMENT, {
        availableAppointments: appts
      });

      let response = '📋 Estas son tus citas confirmadas:\n\n';
      appts.forEach((apt: any, idx: number) => {
        const colombiaDateTime = convertToColombiaTime(apt.scheduled_date, apt.scheduled_time);
        response += `${idx + 1}. 📅 ${formatDate(colombiaDateTime.date)}\n`;
        response += `   🕐 ${formatTime(colombiaDateTime.time)}\n`;
        response += `   👨‍⚕️ ${apt.doctor_name || 'Por asignar'}\n`;
        response += `   🏥 ${apt.specialty_name}\n`;
        response += `   📍 ${apt.location_name}\n\n`;
      });

      response += '¿Cuál cita deseas cancelar? Responde con el número.';

      return {
        success: true,
        response,
        toolCalls: []
      };
    }

    // Intención de reagendar cita
    if (intent === 'reschedule' && stateContext.patientId) {
      console.log(`[WhatsAppAI] 🔄 Iniciando reagendamiento para paciente ${stateContext.patientId}`);

      const appointmentsResult = await DirectDBTools.getPatientAppointments({
        patient_id: stateContext.patientId,
        status: 'Confirmada'
      });

      if (!appointmentsResult.success || !appointmentsResult.data?.appointments?.length) {
        return {
          success: true,
          response: 'No tienes citas confirmadas para reagendar en este momento. 📅\n\n¿Quieres agendar una nueva cita?',
          toolCalls: []
        };
      }

      const appts = appointmentsResult.data.appointments;
      updateState(cleanPhone, ConversationState.RESCHEDULING, {
        availableAppointments: appts
      });

      let response = '📋 Estas son tus citas confirmadas:\n\n';
      appts.forEach((apt: any, idx: number) => {
        const colombiaDateTime = convertToColombiaTime(apt.scheduled_date, apt.scheduled_time);
        response += `${idx + 1}. 📅 ${formatDate(colombiaDateTime.date)}\n`;
        response += `   🕐 ${formatTime(colombiaDateTime.time)}\n`;
        response += `   👨‍⚕️ ${apt.doctor_name || 'Por asignar'}\n`;
        response += `   🏥 ${apt.specialty_name}\n`;
        response += `   📍 ${apt.location_name}\n\n`;
      });

      response += '¿Cuál cita deseas reagendar? Responde con el número.';

      return {
        success: true,
        response,
        toolCalls: []
      };
    }

    // ============================================================================
    // PASO 0.45: SALUDO INICIAL - SIEMPRE PEDIR CÉDULA PRIMERO
    // ============================================================================
    // Si es un saludo y no tenemos paciente identificado, pedir cédula de inmediato

    if (intent === 'greeting' && !stateContext.patientId) {
      console.log('[WhatsAppAI] 👋 Saludo detectado sin paciente - Pidiendo cédula');

      // Actualizar estado a esperando documento
      updateState(cleanPhone, ConversationState.AWAITING_DOCUMENT);
      await conversationManager.transitionState(cleanPhone, 'greeting');

      return {
        success: true,
        response: "¡Hola! 😊 Soy Valeria de Fundación Biosanar IPS.\n\nPara atenderte mejor, ¿me compartes tu número de cédula?",
        toolCalls: []
      };
    }

    // Si ya tenemos paciente, usar respuestas personalizadas con su nombre
    if (intent === 'greeting' && stateContext.patientId && stateContext.patientName) {
      console.log(`[WhatsAppAI] 👋 Saludo con paciente identificado: ${stateContext.patientName}`);

      return {
        success: true,
        response: `¡Hola ${stateContext.patientName}! 😊 Qué gusto saludarte.\n\n¿En qué puedo ayudarte hoy?`,
        toolCalls: []
      };
    }

    // ============================================================================
    // PASO 0.46: INTERCEPTOR DE BENEFICIARIO - ¿Para quién es la cita?
    // ============================================================================
    // Cuando el usuario quiere agendar, SIEMPRE preguntar si es para sí mismo o para otra persona
    if (intent === 'schedule' && stateContext.patientId && stateContext.currentState !== ConversationState.AWAITING_BENEFICIARY) {
      console.log(`[WhatsAppAI] 🎯 BENEFICIARIO: Preguntando para quién es la cita`);
      
      updateState(cleanPhone, ConversationState.AWAITING_BENEFICIARY);
      
      const firstName = stateContext.patientName?.split(' ')[0] || '';
      
      return {
        success: true,
        response: `${firstName ? firstName + ', ¿' : '¿'}la cita es para ti o para otra persona? 😊`,
        toolCalls: []
      };
    }

    // Si el intent es 'schedule' PERO no tenemos patientId, pedir cédula primero
    // (luego al identificarse, el flujo pasará por AWAITING_BENEFICIARY)
    if (intent === 'schedule' && !stateContext.patientId) {
      console.log('[WhatsAppAI] 🎯 Schedule sin paciente - Pidiendo cédula');
      updateState(cleanPhone, ConversationState.AWAITING_DOCUMENT, {
        pendingIntent: 'schedule'
      });
      return {
        success: true,
        response: "¡Con gusto te ayudo a agendar! 😊\n\nPrimero, ¿me compartes tu número de cédula?",
        toolCalls: []
      };
    }

    // Para otras intenciones (thanks, goodbye, help), usar respuestas con nombre si lo tenemos
    const quickResponse = personalityManager.generateContextualResponse(intent, cleanPhone);
    if (quickResponse && (intent === 'thanks' || intent === 'goodbye' || intent === 'help' || intent === 'complaint' || intent === 'price_query' || intent === 'info')) {
      // Personalizar con nombre si lo tenemos
      let personalizedResponse = quickResponse;
      if (stateContext.patientName) {
        // Agregar nombre al inicio si no lo tiene
        if (!quickResponse.includes(stateContext.patientName)) {
          const firstName = stateContext.patientName.split(' ')[0];
          if (intent === 'goodbye') {
            personalizedResponse = quickResponse.replace('!', `, ${firstName}!`);
          }
        }
      }

      personalityManager.addMessage(cleanPhone, 'user', message);
      personalityManager.addMessage(cleanPhone, 'assistant', personalizedResponse);
      await conversationManager.incrementMessageCount(cleanPhone, message);

      return {
        success: true,
        response: personalizedResponse,
        toolCalls: []
      };
    }

    // Actualizar estado de conversación según intención
    await updateConversationStateByIntent(cleanPhone, intent, conversation.state);

    // Incrementar contador de mensajes
    await conversationManager.incrementMessageCount(cleanPhone, message);

    // ============================================================================
    // PASO 0.5: CONSULTA DIRECTA DE ESPECIALISTAS/DOCTORES (SIN REQUERIR CÉDULA)
    // ============================================================================
    // Cuando el usuario pregunta por especialistas, doctores o disponibilidad general,
    // buscamos directamente en la BD sin pedir cédula primero

    const askingForSpecialists = /especiali|doctore?s?|médico|quiénes|quienes|cuáles|cuales|profesional|atiende|disponible/i.test(message);
    const hasSpecialtyContext = stateContext.specialtyName || /odontolog|medicina|psicolog|nutrici|general/i.test(message);

    if (askingForSpecialists && hasSpecialtyContext) {
      // Detectar especialidad del mensaje o usar la del contexto
      let specialtyToSearch = stateContext.specialtyName;

      if (!specialtyToSearch) {
        // Detectar especialidad del mensaje
        if (/odontolog/i.test(message)) specialtyToSearch = 'Odontologia';
        else if (/psicolog/i.test(message)) specialtyToSearch = 'Psicologia';
        else if (/nutrici/i.test(message)) specialtyToSearch = 'Nutricion';
        else if (/medicina.*general|general/i.test(message)) specialtyToSearch = 'Medicina General';
      }

      if (specialtyToSearch) {
        console.log(`[WhatsAppAI] 🔍 CONSULTA DIRECTA DE ESPECIALISTAS: ${specialtyToSearch}`);

        const availResult = await DirectDBTools.getAvailableAppointments({
          specialty_name: specialtyToSearch
        });

        if (availResult.success && availResult.data?.appointments?.length > 0) {
          const appts = availResult.data.appointments;

          // Extraer doctores únicos
          const doctorsMap = new Map<string, { name: string, dates: string[], location: string }>();
          appts.forEach((apt: any) => {
            const doctorName = apt.doctor_name;
            if (!doctorsMap.has(doctorName)) {
              doctorsMap.set(doctorName, {
                name: doctorName,
                dates: [],
                location: apt.location_name || 'Sede San Gil'
              });
            }
            const fecha = apt.appointment_date_formatted || apt.appointment_date;
            if (!doctorsMap.get(doctorName)!.dates.includes(fecha)) {
              doctorsMap.get(doctorName)!.dates.push(fecha);
            }
          });

          // Guardar especialidad en estado
          updateState(cleanPhone, ConversationState.AWAITING_DOCTOR_SELECTION, {
            specialtyName: specialtyToSearch,
            availableAppointments: appts,
            availableDoctors: Array.from(doctorsMap.keys())
          });

          // Construir respuesta con doctores disponibles
          let response = `Para ${specialtyToSearch} tenemos:\n\n`;

          doctorsMap.forEach((info, doctorName) => {
            response += `👨‍⚕️ **${doctorName}**\n`;
            response += `   📍 ${info.location}\n`;
            response += `   📅 ${info.dates.slice(0, 3).join(', ')}${info.dates.length > 3 ? '...' : ''}\n\n`;
          });

          response += `¿Con cuál doctor prefieres tu cita? 😊`;

          // Si no tenemos paciente identificado, agregar nota
          if (!stateContext.patientId) {
            response += `\n\n_Cuando elijas, te pediré tu cédula para agendar._`;
          }

          return {
            success: true,
            response,
            toolCalls: [{ name: 'getAvailableAppointments', result: `${appts.length} citas, ${doctorsMap.size} doctores` }]
          };
        } else {
          return {
            success: true,
            response: `No hay especialistas disponibles para ${specialtyToSearch} en este momento. 😔\n\n¿Te agrego a la lista de espera?`,
            toolCalls: []
          };
        }
      }
    }

    // ============================================================================
    // PASO 0.6: EJECUCIÓN AUTOMÁTICA DE getAvailableAppointments
    // ============================================================================
    // Si el usuario pide disponibilidad y ya tenemos la especialidad,
    // ejecutamos la herramienta DIRECTAMENTE sin pasar por el modelo AI
    // Esto EVITA que el modelo invente datos

    const availabilityKeywords = /disponib|opciones|citas|agenda|horarios|cuando|qué hay|que hay|muestr/i;
    const wantsAvailability = availabilityKeywords.test(message) || intent === 'availability' || intent === 'schedule';

    if (wantsAvailability && stateContext.specialtyName && stateContext.patientId) {
      console.log(`[WhatsAppAI] 🔍 EJECUCIÓN AUTOMÁTICA: Buscando disponibilidad para ${stateContext.specialtyName}`);

      const availResult = await DirectDBTools.getAvailableAppointments({
        specialty_name: stateContext.specialtyName
      });

      if (availResult.success && availResult.data?.appointments?.length > 0) {
        const appts = availResult.data.appointments;
        const uniqueDoctors = availResult.data.unique_doctors || [];

        // Guardar en estado
        updateState(cleanPhone, ConversationState.AWAITING_DOCTOR_SELECTION, {
          availableAppointments: appts,
          availableDoctors: uniqueDoctors,
          specialtyId: appts[0]?.specialty_id
        });

        // Obtener nombre del paciente para personalizar
        const firstName = stateContext.patientName?.split(' ')[0] || '';
        const greeting = firstName ? `${firstName}, para` : 'Para';

        // Construir respuesta PERSONALIZADA
        let response = `${greeting} ${stateContext.specialtyName} tenemos:\n\n`;

        // Mostrar máximo 5 opciones de forma compacta
        const shownAppts = appts.slice(0, 5);
        shownAppts.forEach((apt: any, idx: number) => {
          const fecha = apt.appointment_date_formatted || apt.date || apt.appointment_date;
          const hora = apt.start_time_formatted || apt.start_time;
          const doctor = apt.doctor_name;

          response += `${idx + 1}. ${doctor} - ${fecha} a las ${hora}\n`;
        });

        response += `\n¿Cuál te agendo${firstName ? `, ${firstName}` : ''}? 😊`;

        executedTools.push({ name: 'getAvailableAppointments', result: `${appts.length} citas encontradas` });

        return {
          success: true,
          response,
          toolCalls: executedTools
        };
      } else {
        // No hay disponibilidad - personalizar con nombre
        const firstName = stateContext.patientName?.split(' ')[0] || '';
        return {
          success: true,
          response: `${firstName ? firstName + ', no' : 'No'} hay citas disponibles para ${stateContext.specialtyName} en este momento. 😔\n\n¿Te agrego a la lista de espera?`,
          toolCalls: []
        };
      }
    }

    // ============================================================================
    // PASO 0.7: DETECCIÓN AUTOMÁTICA DE FECHA Y BÚSQUEDA DE SLOTS REALES
    // ============================================================================
    // Cuando el usuario menciona una fecha (día de la semana o fecha numérica),
    // buscamos automáticamente los slots reales para evitar que la IA invente horarios.

    const userWantsDate = /(?:el\s+)?(?:día\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?:\s+(\d{1,2}))?/i.test(message) ||
      /(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(message);

    console.log(`[WhatsAppAI] 📅 PASO 0.7 CHECK: message="${message}", userWantsDate=${userWantsDate}, specialtyName=${stateContext.specialtyName}, patientId=${stateContext.patientId}`);

    // Si el usuario menciona una fecha Y tenemos especialidad (patientId ya no es requerido)
    if (userWantsDate && stateContext.specialtyName) {
      console.log(`[WhatsAppAI] 📅 DETECCIÓN DE FECHA: Usuario mencionó una fecha, buscando slots reales...`);

      // Primero, obtener las fechas disponibles para la especialidad
      const availResult = await DirectDBTools.getAvailableAppointments({
        specialty_name: stateContext.specialtyName
      });

      if (availResult.success && availResult.data?.appointments?.length > 0) {
        const appts = availResult.data.appointments;
        const normalizedMsg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Mapeo de días de la semana en español
        const diasSemana: Record<string, number> = {
          'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3,
          'jueves': 4, 'viernes': 5, 'sabado': 6
        };

        // Detectar qué día de la semana mencionó el usuario
        let targetDay: number | null = null;
        let targetDayNum: number | null = null;

        for (const [dia, num] of Object.entries(diasSemana)) {
          if (normalizedMsg.includes(dia)) {
            targetDay = num;
            // Buscar si también mencionó el número del día
            const dayNumMatch = normalizedMsg.match(new RegExp(dia + '\\s*(\\d{1,2})', 'i'));
            if (dayNumMatch) {
              targetDayNum = parseInt(dayNumMatch[1]);
            }
            break;
          }
        }

        // Detectar fecha numérica (ej: "11 de febrero")
        const fechaNumMatch = normalizedMsg.match(/(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
        if (fechaNumMatch) {
          targetDayNum = parseInt(fechaNumMatch[1]);
        }

        // Buscar la agenda que coincida con la fecha mencionada
        let matchingAppt: any = null;

        for (const appt of appts) {
          const apptDate = new Date(appt.appointment_date + 'T12:00:00');
          const apptDayOfWeek = apptDate.getDay();
          const apptDayOfMonth = apptDate.getDate();

          // Coincidencia por día de la semana
          if (targetDay !== null && apptDayOfWeek === targetDay) {
            // Si también hay número de día, verificar que coincida
            if (targetDayNum === null || apptDayOfMonth === targetDayNum) {
              matchingAppt = appt;
              break;
            }
          }

          // Coincidencia por número de día del mes
          if (targetDayNum !== null && apptDayOfMonth === targetDayNum) {
            matchingAppt = appt;
            break;
          }
        }

        if (matchingAppt) {
          console.log(`[WhatsAppAI] ✅ Fecha encontrada: ${matchingAppt.appointment_date_formatted} (ID: ${matchingAppt.availability_id})`);

          // Ahora buscar los slots REALES disponibles para esa fecha
          const slotsResult = await DirectDBTools.getAvailableTimeSlotsForDoctorOnDate({
            doctor_id: matchingAppt.doctor_id,
            date: matchingAppt.appointment_date,
            specialty_id: matchingAppt.specialty_id
          });

          if (slotsResult.success && slotsResult.data?.available_times?.length > 0) {
            const availableTimes = slotsResult.data.available_times_formatted || slotsResult.data.available_times;
            const slotsDetail = slotsResult.data.slots_detail || [];

            // Guardar en el estado
            updateState(cleanPhone, ConversationState.AWAITING_TIME, {
              timeSlots: slotsDetail,
              selectedDate: matchingAppt.appointment_date,
              selectedDoctor: matchingAppt.doctor_name,
              selectedDoctorId: matchingAppt.doctor_id,
              availabilityId: matchingAppt.availability_id,
              specialtyId: matchingAppt.specialty_id
            });

            const firstName = stateContext.patientName?.split(' ')[0] || '';
            const displaySlots = availableTimes.slice(0, 6);

            let response = `¡Genial${firstName ? ', ' + firstName : ''}! 😊 Para el ${matchingAppt.appointment_date_formatted}, tenemos las siguientes horas disponibles con ${matchingAppt.doctor_name}:\n\n`;
            displaySlots.forEach((time: string) => {
              response += `• ${time}\n`;
            });

            if (availableTimes.length > 6) {
              response += `\n... y ${availableTimes.length - 6} horarios más.`;
            }

            response += `\n\n¿Te gustaría agendar una cita en alguna de estas horas${firstName ? ', ' + firstName : ''}? 🕐\n\n¿Cuál te queda mejor?`;

            return {
              success: true,
              response,
              toolCalls: [{ name: 'getAvailableTimeSlotsForDoctorOnDate', result: `${availableTimes.length} slots disponibles` }]
            };

          } else {
            // No hay slots para esa fecha
            const firstName = stateContext.patientName?.split(' ')[0] || '';

            // Buscar alternativas
            const alternativas = appts.filter((a: any) => a.appointment_date !== matchingAppt.appointment_date).slice(0, 3);

            let response = `Lo siento${firstName ? ', ' + firstName : ''}, no hay horarios disponibles para el ${matchingAppt.appointment_date_formatted}. Todas las citas de ese día están ocupadas. 😕\n\n`;

            if (alternativas.length > 0) {
              response += `Te puedo ofrecer estas otras fechas:\n\n`;
              alternativas.forEach((alt: any) => {
                response += `• ${alt.appointment_date_formatted} a las ${alt.start_time_formatted}\n`;
              });
              response += `\n¿Alguna te sirve?`;
            } else {
              response += `¿Te agrego a la lista de espera para que te avisemos cuando haya disponibilidad?`;
            }

            return {
              success: true,
              response,
              toolCalls: []
            };
          }
        } else {
          // No encontramos esa fecha en las disponibles
          const firstName = stateContext.patientName?.split(' ')[0] || '';
          const fechasDisponibles = appts.slice(0, 4).map((a: any) => a.appointment_date_formatted).join(', ');

          return {
            success: true,
            response: `${firstName ? firstName + ', no' : 'No'} tenemos disponibilidad para esa fecha. 😕\n\nLas fechas disponibles son: ${fechasDisponibles}.\n\n¿Te sirve alguna de estas?`,
            toolCalls: []
          };
        }
      }
    }

    // ============================================================================
    // PASO 0.8: AGENDAMIENTO AUTOMÁTICO CUANDO SE TIENE TODA LA INFORMACIÓN
    // ============================================================================
    // Si el usuario está en AWAITING_REASON y proporciona el motivo, ejecutar
    // scheduleAppointment automáticamente para evitar que la IA solo responda sin agendar.

    if (stateContext.currentState === ConversationState.AWAITING_REASON &&
      message.length > 3 &&
      stateContext.patientId &&
      stateContext.availabilityId &&
      stateContext.scheduledDatetime) {

      console.log(`[WhatsAppAI] 🎯 AGENDAMIENTO AUTOMÁTICO: Todos los datos disponibles, ejecutando scheduleAppointment...`);

      // Verificar si ya existe una cita agendada recientemente
      const wasAlreadyScheduled = await PersistenceService.wasScheduleAppointmentExecuted(cleanPhone, 5);

      if (wasAlreadyScheduled) {
        console.log(`[WhatsAppAI] ⚠️ Ya se agendó una cita recientemente, saltando`);
        const lastScheduled = await PersistenceService.getLastScheduledAppointment(cleanPhone);

        return {
          success: true,
          response: `Ya tienes una cita confirmada:\n\n• **Cita #${lastScheduled?.appointment_id}**\n• **Doctor:** ${lastScheduled?.doctor_name}\n• **Fecha:** ${lastScheduled?.scheduled_date}\n• **Hora:** ${lastScheduled?.scheduled_time}\n\n¿Necesitas algo más? 😊`,
          toolCalls: []
        };
      }

      // Usar el mensaje del usuario como motivo de la consulta
      const reason = message.length > 100 ? message.substring(0, 100) : message;

      try {
        const scheduleResult = await DirectDBTools.scheduleAppointment({
          patient_id: stateContext.patientId,
          availability_id: stateContext.availabilityId,
          scheduled_date: stateContext.scheduledDatetime,
          reason: reason,
          appointment_type: 'Presencial',
          priority_level: 'Normal'
        });

        if (scheduleResult.success) {
          const appointmentId = scheduleResult.data?.appointment_id;
          const doctorName = scheduleResult.data?.doctor_name || stateContext.selectedDoctor || 'El especialista';
          const fecha = scheduleResult.data?.appointment_date || scheduleResult.data?.scheduled_date?.split(' ')[0] || stateContext.selectedDate;
          const hora = scheduleResult.data?.hora_cita_local || scheduleResult.data?.scheduled_time || stateContext.selectedTime;
          const location = scheduleResult.data?.location_name || 'Sede principal';

          // Guardar en el estado
          updateState(cleanPhone, ConversationState.COMPLETED, {
            lastAppointmentId: appointmentId
          });

          // Persistir en BD
          try {
            const sessionId = await getSessionIdForPhone(cleanPhone);
            await PersistenceService.recordScheduledAppointment({
              session_id: sessionId || 0,
              phone: cleanPhone,
              patient_id: stateContext.patientId,
              appointment_id: appointmentId,
              availability_id: stateContext.availabilityId,
              doctor_name: doctorName,
              specialty_name: stateContext.specialtyName || 'Consulta',
              scheduled_date: fecha,
              scheduled_time: hora,
              location_name: location,
              status: 'scheduled'
            });
          } catch (err) {
            console.error('[WhatsAppAI] Error al persistir cita:', err);
          }

          const firstName = stateContext.patientName?.split(' ')[0] || '';

          return {
            success: true,
            response: `¡Listo${firstName ? ', ' + firstName : ''}! 🎉 Tu cita ha sido confirmada:\n\n` +
              `• **Cita #${appointmentId}**\n` +
              `• **Doctor:** ${doctorName}\n` +
              `• **Fecha:** ${fecha}\n` +
              `• **Hora:** ${hora}\n` +
              `• **Sede:** ${location}\n` +
              `• **Motivo:** ${reason}\n\n` +
              `Te esperamos${firstName ? ', ' + firstName : ''}. 😊\n\n¿Deseas agendar otra cita?`,
            toolCalls: [{ name: 'scheduleAppointment', result: `Cita #${appointmentId} agendada` }]
          };
        } else {
          // Error al agendar
          console.error(`[WhatsAppAI] Error al agendar:`, scheduleResult.error);

          return {
            success: true,
            response: `Disculpa, tuve un inconveniente al confirmar tu cita: ${scheduleResult.error}\n\n¿Intentamos de nuevo o prefieres llamarnos al 6076911308?`,
            toolCalls: []
          };
        }
      } catch (error: any) {
        console.error(`[WhatsAppAI] Error ejecutando scheduleAppointment:`, error);

        return {
          success: true,
          response: `Disculpa, tuve un problema técnico al confirmar tu cita. Por favor, llámanos al 6076911308 para agendarla. 🏥`,
          toolCalls: []
        };
      }
    }

    // ============================================================================
    // PASO 1: VERIFICAR ESTADO Y RECUPERACIÓN DE ERRORES
    // ============================================================================

    // Refrescar estado después de las transiciones
    stateContext = getStateContext(cleanPhone);

    // Verificar si necesitamos resetear por exceso de errores
    if (shouldResetDueToErrors(cleanPhone)) {
      console.log(`[WhatsAppAI] Reseteando conversación por exceso de errores: ${cleanPhone}`);
      resetState(cleanPhone);
      resetConversation(cleanPhone);
      return {
        success: true,
        response: "Disculpa, tuvimos algunos problemas. Empecemos de nuevo desde el principio. 😊\n\n¿Cuál es tu número de cédula?",
        toolCalls: []
      };
    }

    console.log(`[WhatsAppAI] Estado actual: ${stateContext.currentState} | Reintentos: ${stateContext.retryCount}`);

    // ============================================================================
    // PASO 2: VERIFICAR CONFIGURACIÓN
    // ============================================================================

    const aiConfig = getAIConfig();
    if (!aiConfig.apiKey) {
      console.warn(`[WhatsAppAI] ${aiConfig.provider} API KEY no configurada`);
      incrementRetry(cleanPhone);
      return {
        success: true,
        response: "Disculpa, tenemos una dificultad técnica momentánea. Por favor, llámanos al 6076911308 o intenta más tarde. 🏥",
        toolCalls: []
      };
    }

    // ============================================================================
    // PASO 3: DETECTAR SALUDOS Y RESETEAR
    // ============================================================================

    const greetings = /^(hola|buenas|buenos días|buenas tardes|buenas noches|hey|hi|hello|saludos)/i;
    const isGreeting = greetings.test(message.trim());

    if (isGreeting && stateContext.currentState !== ConversationState.IDLE) {
      console.log('[WhatsAppAI] Saludo detectado - Reseteando conversación completa');
      resetState(cleanPhone);
      resetConversation(cleanPhone);
      updateState(cleanPhone, ConversationState.AWAITING_DOCUMENT);
    }

    // ============================================================================
    // PASO 3.1: MANEJO DE CICLO POST-AGENDAMIENTO (COMPLETED)
    // ============================================================================
    // Después de agendar, si el usuario quiere otra cita, volver a AWAITING_BENEFICIARY
    if (stateContext.currentState === ConversationState.COMPLETED) {
      if (isAffirmative(message) || /otra\s*cita|agendar|nueva\s*cita|s[ií]|quiero/i.test(message.trim().toLowerCase())) {
        console.log('[WhatsAppAI] 🔄 CICLO: Usuario quiere agendar otra cita');
        
        // Restaurar patientId del solicitante si fue tercero
        const patientId = stateContext.requestorPatientId || stateContext.patientId;
        const patientName = stateContext.requestorPatientName || stateContext.patientName;
        const patientDocument = stateContext.requestorPatientDocument || stateContext.patientDocument;
        
        // Resetear estado pero mantener identidad
        updateState(cleanPhone, ConversationState.AWAITING_BENEFICIARY, {
          patientId,
          patientName,
          patientDocument,
          // Limpiar datos de la cita anterior
          specialtyName: undefined,
          specialtyId: undefined,
          selectedDoctor: undefined,
          selectedDoctorId: undefined,
          selectedDate: undefined,
          selectedTime: undefined,
          scheduledDatetime: undefined,
          availabilityId: undefined,
          availableAppointments: undefined,
          availableDoctors: undefined,
          timeSlots: undefined,
          reason: undefined,
          isThirdParty: undefined,
          requestorPatientId: undefined,
          requestorPatientName: undefined,
          requestorPatientDocument: undefined,
          lastAppointmentId: undefined
        });
        
        const firstName = patientName?.split(' ')[0] || '';
        return {
          success: true,
          response: `¡Claro${firstName ? ', ' + firstName : ''}! 😊 ¿La cita es para ti o para otra persona?`,
          toolCalls: []
        };
      }
      
      if (isNegative(message) || /no|nada|eso.*todo|gracias|listo/i.test(message.trim().toLowerCase())) {
        console.log('[WhatsAppAI] 👋 CICLO: Usuario no quiere más citas');
        const firstName = stateContext.patientName?.split(' ')[0] || '';
        
        // Resetear al estado inicial
        updateState(cleanPhone, ConversationState.IDLE);
        
        return {
          success: true,
          response: `¡Perfecto${firstName ? ', ' + firstName : ''}! Fue un gusto atenderte. Si necesitas algo más, aquí estoy. 😊`,
          toolCalls: []
        };
      }
    }

    // ============================================================================
    // PASO 3.45: MANEJO DE BENEFICIARIO (¿Para ti o para otra persona?)
    // ============================================================================
    if (stateContext.currentState === ConversationState.AWAITING_BENEFICIARY) {
      const normalizedMsg = message.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // Detectar "para mí" / "para mi" / "mía" / "yo" / afirmativo
      const isForSelf = /para\s*m[ií]|m[ií]a|es\s*m[ií]a|yo\s*mism|para\s*m[eé]|es\s*para\s*m[ií]|^(si|s[ií]|claro|ok|sí|aja|ajá|por supuesto)$/i.test(normalizedMsg) || isAffirmative(message);
      
      // Detectar "para otra persona" / "para alguien más" / "tercero"
      const isForOther = /otra\s*persona|alguien\s*m[áa]s|tercero|otra|otro|familiar|pariente|hijo|hija|mama|papá|papa|esposo|esposa|abuelo|abuela|no.*para.*m[ií]/i.test(normalizedMsg) || isNegative(message);
      
      if (isForSelf) {
        console.log(`[WhatsAppAI] ✅ BENEFICIARIO: Cita para sí mismo (${stateContext.patientName})`);
        
        // Limpiar flags de tercero
        updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY, {
          isThirdParty: false,
          requestorPatientId: undefined,
          requestorPatientName: undefined,
          requestorPatientDocument: undefined
        });
        
        const firstName = stateContext.patientName?.split(' ')[0] || '';
        return {
          success: true,
          response: `¡Perfecto${firstName ? ', ' + firstName : ''}! 😊 ¿Para qué especialidad necesitas la cita?`,
          toolCalls: []
        };
      }
      
      if (isForOther) {
        console.log(`[WhatsAppAI] 👥 BENEFICIARIO: Cita para otra persona - Pidiendo cédula del beneficiario`);
        
        // Guardar datos del solicitante (quien tiene la conversación)
        updateState(cleanPhone, ConversationState.AWAITING_DOCUMENT, {
          isThirdParty: true,
          requestorPatientId: stateContext.patientId,
          requestorPatientName: stateContext.patientName,
          requestorPatientDocument: stateContext.patientDocument,
          // Limpiar datos del paciente actual para que el flujo de cédula busque al beneficiario
          patientId: undefined,
          patientName: undefined,
          patientDocument: undefined,
          // NO limpiar suppressAutoIdentifyUntil — evitar re-auto-identificar al solicitante
          suppressAutoIdentifyUntil: Date.now() + 600_000 // 10 min
        });
        
        return {
          success: true,
          response: "Entendido. 😊 Por favor, indícame el número de cédula de la persona para quien es la cita.",
          toolCalls: []
        };
      }
      
      // Si no entendemos la respuesta, preguntar de nuevo
      return {
        success: true,
        response: "Disculpa, no te entendí bien. ¿La cita es *para ti* o *para otra persona*? 🤔",
        toolCalls: []
      };
    }

    // ============================================================================
    // PASO 3.48: REGISTRO CONVERSACIONAL DE PACIENTE NUEVO
    // ============================================================================
    // Cuando el paciente no fue encontrado por cédula, recopilamos datos paso a paso
    // igual que el formulario web: nombre, fecha nacimiento, género, teléfono, EPS
    if (stateContext.currentState === ConversationState.AWAITING_PATIENT_DATA && stateContext.registrationPending) {
      const step = stateContext.regStep || 'name';
      const trimmedMsg = message.trim();
      const isThirdPartyReg = stateContext.isThirdParty;
      const labelPaciente = isThirdPartyReg ? 'del paciente' : 'tu';
      const labelPronombre = isThirdPartyReg ? 'su' : 'tu';

      console.log(`[WhatsAppAI] 📝 REGISTRO paso=${step}, mensaje="${trimmedMsg}"`);

      // --- PASO 1: NOMBRE ---
      if (step === 'name') {
        // Validar que parece un nombre (al menos 2 palabras, solo letras/espacios)
        const nameClean = trimmedMsg.replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]/g, '').trim();
        if (nameClean.length < 3 || nameClean.split(/\s+/).length < 2) {
          return {
            success: true,
            response: `Por favor, indícame ${labelPronombre} nombre completo (nombres y apellidos). 😊`,
            toolCalls: []
          };
        }
        updateState(cleanPhone, ConversationState.AWAITING_PATIENT_DATA, {
          regStep: 'birth_date',
          regName: nameClean
        });
        return {
          success: true,
          response: `Perfecto, *${nameClean}*. 😊\n\n¿Cuál es ${labelPronombre} fecha de nacimiento?\n_Ejemplo: 15/03/1990 o 15 de marzo de 1990_`,
          toolCalls: []
        };
      }

      // --- PASO 2: FECHA DE NACIMIENTO ---
      if (step === 'birth_date') {
        const parsed = parseBirthDate(trimmedMsg);
        if (!parsed) {
          return {
            success: true,
            response: `No logré entender la fecha. 😅\n\nPor favor escríbela así: *dd/mm/aaaa*\n_Ejemplo: 15/03/1990_`,
            toolCalls: []
          };
        }
        updateState(cleanPhone, ConversationState.AWAITING_PATIENT_DATA, {
          regStep: 'gender',
          regBirthDate: parsed
        });
        return {
          success: true,
          response: `¿Cuál es ${labelPronombre} género?\n\n1. Masculino\n2. Femenino`,
          toolCalls: []
        };
      }

      // --- PASO 3: GÉNERO ---
      if (step === 'gender') {
        const genderNorm = trimmedMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        let gender: string | null = null;
        if (/^(1|m|masculino|hombre|masc|varon|male)$/i.test(genderNorm)) gender = 'Masculino';
        else if (/^(2|f|femenino|mujer|fem|female)$/i.test(genderNorm)) gender = 'Femenino';

        if (!gender) {
          return {
            success: true,
            response: "Por favor responde *1* para Masculino o *2* para Femenino. 😊",
            toolCalls: []
          };
        }
        updateState(cleanPhone, ConversationState.AWAITING_PATIENT_DATA, {
          regStep: 'phone',
          regGender: gender
        });
        return {
          success: true,
          response: `¿Cuál es ${labelPronombre} número de teléfono? 📱`,
          toolCalls: []
        };
      }

      // --- PASO 4: TELÉFONO ---
      if (step === 'phone') {
        const phoneClean = trimmedMsg.replace(/[\s\-\.\(\)]/g, '');
        if (!/^\d{7,15}$/.test(phoneClean)) {
          return {
            success: true,
            response: "Por favor ingresa un número de teléfono válido (solo dígitos, entre 7 y 15). 📱",
            toolCalls: []
          };
        }
        updateState(cleanPhone, ConversationState.AWAITING_PATIENT_DATA, {
          regStep: 'eps',
          regPhone: phoneClean
        });

        // Cargar lista de EPS
        let epsMsg = `¿Cuál es ${labelPronombre} EPS? 🏥\n\n`;
        try {
          const epsResult = await DirectDBTools.listActiveEPS();
          if (epsResult.success && epsResult.data?.eps_list?.length > 0) {
            epsResult.data.eps_list.forEach((eps: any, idx: number) => {
              epsMsg += `${idx + 1}. ${eps.name}\n`;
            });
            epsMsg += `\n_Responde con el número o el nombre de ${labelPronombre} EPS_`;
          } else {
            epsMsg += `_Escribe el nombre de ${labelPronombre} EPS_`;
          }
        } catch (err) {
          epsMsg += `_Escribe el nombre de ${labelPronombre} EPS_`;
        }

        return { success: true, response: epsMsg, toolCalls: [] };
      }

      // --- PASO 5: EPS ---
      if (step === 'eps') {
        let epsId: number | undefined;
        let epsName: string | undefined;

        try {
          const epsResult = await DirectDBTools.listActiveEPS();
          if (epsResult.success && epsResult.data?.eps_list?.length > 0) {
            const epsList = epsResult.data.eps_list;
            // Intentar por número
            const numChoice = parseInt(trimmedMsg, 10);
            if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= epsList.length) {
              epsId = epsList[numChoice - 1].id;
              epsName = epsList[numChoice - 1].name;
            } else {
              // Buscar por nombre (fuzzy)
              const msgLower = trimmedMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const match = epsList.find((e: any) => 
                e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(msgLower) ||
                msgLower.includes(e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
              );
              if (match) {
                epsId = match.id;
                epsName = match.name;
              }
            }
          }
        } catch (err) {
          console.error('[WhatsAppAI] Error buscando EPS:', err);
        }

        if (!epsId) {
          // Buscar en TODAS las EPS (activas e inactivas) para dar mensaje apropiado
          try {
            const allEpsResult = await DirectDBTools.findEPSByName(trimmedMsg);
            if (allEpsResult.success && allEpsResult.found && !allEpsResult.eps.isActive) {
              return {
                success: true,
                response: `Lo sentimos, actualmente *no estamos prestando servicio* para la EPS *${allEpsResult.eps.name}*. 😔\n\nPor favor selecciona una de las EPS con las que tenemos convenio activo:\n\n` +
                  await buildActiveEPSList(labelPronombre),
                toolCalls: []
              };
            }
          } catch (err) {
            console.error('[WhatsAppAI] Error buscando EPS en todas:', err);
          }

          return {
            success: true,
            response: "No encontré esa EPS. 😅 Por favor responde con el *número* de la lista o escribe el nombre exacto de la EPS.",
            toolCalls: []
          };
        }

        updateState(cleanPhone, ConversationState.AWAITING_PATIENT_DATA, {
          regStep: 'confirm',
          regEpsId: epsId,
          regEpsName: epsName
        });

        // Mostrar resumen para confirmación
        const genderLabel = stateContext.regGender || 'No especificado';
        const patronLabel = isThirdPartyReg ? 'Datos del paciente' : 'Tus datos';

        return {
          success: true,
          response: `📋 *${patronLabel} para registro:*\n\n` +
            `• *Nombre:* ${stateContext.regName}\n` +
            `• *Cédula:* ${stateContext.patientDocument}\n` +
            `• *Fecha de nacimiento:* ${formatBirthDateDisplay(stateContext.regBirthDate || '')}\n` +
            `• *Género:* ${genderLabel}\n` +
            `• *Teléfono:* ${stateContext.regPhone}\n` +
            `• *EPS:* ${epsName}\n\n` +
            `¿Los datos son correctos? (Sí/No)`,
          toolCalls: []
        };
      }

      // --- PASO 6: CONFIRMACIÓN ---
      if (step === 'confirm') {
        if (isAffirmative(message)) {
          console.log('[WhatsAppAI] ✅ REGISTRO: Datos confirmados, registrando paciente...');

          try {
            const regResult = await DirectDBTools.registerPatientSimple({
              document: stateContext.patientDocument || '',
              name: stateContext.regName || '',
              phone: stateContext.regPhone,
              eps_id: stateContext.regEpsId,
              birth_date: stateContext.regBirthDate,
              gender: stateContext.regGender,
              city: 'San Gil'
            });

            if (regResult.success && regResult.data?.patient_id) {
              const newPatientId = regResult.data.patient_id;
              const firstName = (stateContext.regName || '').split(' ')[0];

              console.log(`[WhatsAppAI] ✅ Paciente registrado: ID=${newPatientId}`);

              // Persistir en ConversationPersistence
              await updatePatient(cleanPhone, {
                patientId: newPatientId,
                fullName: stateContext.regName,
                firstName,
                documentNumber: stateContext.patientDocument,
                phone: stateContext.regPhone
              });

              // Actualizar estado — paciente registrado, pasar a selección de especialidad
              updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY, {
                patientId: newPatientId,
                patientName: stateContext.regName,
                patientDocument: stateContext.patientDocument,
                patientPhone: stateContext.regPhone,
                registrationPending: false,
                regStep: undefined,
                regName: undefined,
                regBirthDate: undefined,
                regGender: undefined,
                regPhone: undefined,
                regEpsId: undefined,
                regEpsName: undefined
              });

              return {
                success: true,
                response: `¡Listo! 🎉 *${firstName}* ha sido registrad${stateContext.regGender === 'Femenino' ? 'a' : 'o'} exitosamente.\n\n¿Para qué especialidad necesita la cita? 😊`,
                toolCalls: [{ name: 'registerPatientSimple', result: `Paciente #${newPatientId} registrado` }]
              };
            } else {
              // Error en el registro
              console.error('[WhatsAppAI] Error al registrar:', regResult.error);
              return {
                success: true,
                response: `Disculpa, hubo un error al crear el perfil: ${regResult.error || 'Error desconocido'}. 😔\n\nPor favor, intenta de nuevo más tarde o llámanos al 6076911308.`,
                toolCalls: []
              };
            }
          } catch (error: any) {
            console.error('[WhatsAppAI] Error registrando paciente:', error);
            return {
              success: true,
              response: "Disculpa, tuve un problema técnico al crear el perfil. Por favor, llámanos al 6076911308. 🏥",
              toolCalls: []
            };
          }
        } else if (isNegative(message)) {
          // Reiniciar registro
          updateState(cleanPhone, ConversationState.AWAITING_PATIENT_DATA, {
            regStep: 'name',
            regName: undefined,
            regBirthDate: undefined,
            regGender: undefined,
            regPhone: undefined,
            regEpsId: undefined,
            regEpsName: undefined
          });
          return {
            success: true,
            response: "Entendido, empecemos de nuevo. 😊\n\n¿Cuál es el nombre completo (nombres y apellidos)?",
            toolCalls: []
          };
        } else {
          return {
            success: true,
            response: "¿Los datos son correctos? Responde *Sí* para confirmar o *No* para corregir. 😊",
            toolCalls: []
          };
        }
      }
    }

    // ============================================================================
    // PASO 3.5: MANEJO ESPECIAL DE CONFIRMACIÓN DE TELÉFONO
    // ============================================================================

    // Cuando el estado es AWAITING_PHONE_CONFIRMATION y el usuario dice "Si"
    if (stateContext.currentState === ConversationState.AWAITING_PHONE_CONFIRMATION) {
      const normalizedMessage = message.trim().toLowerCase();

      if (isAffirmative(message)) {
        console.log('[WhatsAppAI] ✓ Teléfono confirmado por el usuario');

        const patientName = stateContext.patientName || 'paciente';

        // ⚠️ MEJORA: Si ya tenemos la especialidad guardada, buscar disponibilidad directamente
        if (stateContext.specialtyName || stateContext.specialtyId) {
          console.log(`[WhatsAppAI] 🎯 Especialidad ya conocida: ${stateContext.specialtyName} - Buscando disponibilidad...`);

          // Transicionar al estado de selección de doctor
          updateState(cleanPhone, ConversationState.AWAITING_DOCTOR_SELECTION);

          // Buscar disponibilidad para la especialidad que ya mencionó
          const availabilityResult = await DirectDBTools.getAvailableAppointments({
            specialty_name: stateContext.specialtyName,
            specialty_id: stateContext.specialtyId
          });

          if (availabilityResult.success && availabilityResult.data?.appointments?.length > 0) {
            const appointments = availabilityResult.data.appointments;
            const uniqueDoctors = availabilityResult.data.unique_doctors || [];

            // Guardar disponibilidad en estado
            updateState(cleanPhone, ConversationState.AWAITING_DOCTOR_SELECTION, {
              availableAppointments: appointments,
              availableDoctors: uniqueDoctors,
              specialtyName: stateContext.specialtyName,
              specialtyId: appointments[0]?.specialty_id
            });

            // Construir respuesta con opciones
            let response = `¡Perfecto, ${patientName}! 😊 He encontrado disponibilidad para ${stateContext.specialtyName}:\n\n`;

            // Mostrar las primeras opciones disponibles
            const firstOptions = appointments.slice(0, 5);
            firstOptions.forEach((apt: any, idx: number) => {
              response += `${idx + 1}. 👨‍⚕️ ${apt.doctor_name}\n`;
              response += `   📅 ${apt.appointment_date_formatted || apt.appointment_date}\n`;
              response += `   🕐 ${apt.start_time_formatted || apt.start_time} - ${apt.end_time_formatted || apt.end_time}\n`;
              response += `   📍 ${apt.location_name}\n`;
              response += `   🎫 ${apt.slots_available} cupos disponibles\n\n`;
            });

            response += `¿Cuál opción prefieres? Puedes decirme el número o el nombre del doctor. 😊`;

            return {
              success: true,
              response,
              toolCalls: []
            };
          } else {
            // No hay disponibilidad para esa especialidad
            return {
              success: true,
              response: `¡Perfecto, ${patientName}! 😊 Lamentablemente no encontré disponibilidad inmediata para ${stateContext.specialtyName}. ¿Te gustaría que te agregue a la lista de espera o prefieres otra especialidad?`,
              toolCalls: []
            };
          }
        }

        // Si NO hay especialidad guardada, preguntar beneficiario o especialidad
        if (stateContext.pendingIntent === 'schedule') {
          // Vino del flujo de "quiero una cita" → preguntar beneficiario
          updateState(cleanPhone, ConversationState.AWAITING_BENEFICIARY, {
            pendingIntent: undefined
          });
          return {
            success: true,
            response: `¡Perfecto, ${patientName}! 😊 ¿La cita es para ti o para otra persona?`,
            toolCalls: []
          };
        }

        updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY);

        // Responder directamente sin pasar por el modelo para evitar loop
        return {
          success: true,
          response: `¡Perfecto, ${patientName}! 😊 ¿Qué tipo de cita necesitas? Tenemos disponible Medicina General, Odontología, Psicología y más especialidades.`,
          toolCalls: []
        };
      } else if (isNegative(message)) {
        console.log('[WhatsAppAI] ⚠ Usuario quiere cambiar teléfono');

        // Usuario quiere dar otro número
        return {
          success: true,
          response: "Entendido. ¿Cuál es tu número de teléfono correcto? 📱",
          toolCalls: []
        };
      }
      // Si no es ni afirmativo ni negativo, podría ser un nuevo número de teléfono
      // Detectar si es un número de teléfono (solo dígitos, entre 7-15 caracteres)
      const cleanedMessage = normalizedMessage.replace(/[\s\-\.\(\)]/g, '');
      if (/^\d{7,15}$/.test(cleanedMessage)) {
        console.log(`[WhatsAppAI] 📞 Nuevo teléfono detectado: ${cleanedMessage}`);

        // Transicionar al siguiente estado y guardar el nuevo teléfono
        updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY);

        const patientName = stateContext.patientName || 'paciente';

        return {
          success: true,
          response: `¡Perfecto ${patientName}! He registrado tu número ${cleanedMessage}. 😊 ¿Qué tipo de cita necesitas?`,
          toolCalls: []
        };
      }
    }

    // ==========================================================================
    // PASO 3.56: MANEJO ESPECIAL DE CANCELAR CITA
    // ==========================================================================
    if (stateContext.currentState === ConversationState.CANCELING_APPOINTMENT) {
      const appts = stateContext.availableAppointments || [];

      if (!appts.length) {
        updateState(cleanPhone, ConversationState.IDLE);
        return {
          success: true,
          response: 'No encuentro citas confirmadas para cancelar. ¿Quieres consultar tus citas o agendar una nueva?',
          toolCalls: []
        };
      }

      const match = message.match(/\d+/);
      const selectedIndex = match ? parseInt(match[0], 10) - 1 : -1;

      if (selectedIndex < 0 || selectedIndex >= appts.length) {
        return {
          success: true,
          response: 'Por favor responde con el número de la cita que deseas cancelar. 📋',
          toolCalls: []
        };
      }

      const selected = appts[selectedIndex];
      const cancelResult = await DirectDBTools.cancelAppointment({
        appointment_id: selected.appointment_id,
        reason: 'Cancelada por paciente'
      });

      if (!cancelResult.success) {
        return {
          success: true,
          response: 'No pude cancelar la cita en este momento. ¿Quieres intentar de nuevo?',
          toolCalls: []
        };
      }

      updateState(cleanPhone, ConversationState.COMPLETED, {
        appointmentToCancel: undefined
      });

      const colombiaDateTime = convertToColombiaTime(selected.scheduled_date, selected.scheduled_time);
      return {
        success: true,
        response: `✅ Tu cita de ${selected.specialty_name} para el ${formatDate(colombiaDateTime.date)} a las ${formatTime(colombiaDateTime.time)} fue cancelada correctamente.`,
        toolCalls: []
      };
    }

    // ==========================================================================
    // PASO 3.57: MANEJO ESPECIAL DE REAGENDAR CITA
    // ==========================================================================
    if (stateContext.currentState === ConversationState.RESCHEDULING) {
      const appts = stateContext.availableAppointments || [];

      if (!appts.length) {
        updateState(cleanPhone, ConversationState.IDLE);
        return {
          success: true,
          response: 'No encuentro citas confirmadas para reagendar. ¿Quieres consultar tus citas o agendar una nueva?',
          toolCalls: []
        };
      }

      const match = message.match(/\d+/);
      const selectedIndex = match ? parseInt(match[0], 10) - 1 : -1;

      if (selectedIndex < 0 || selectedIndex >= appts.length) {
        return {
          success: true,
          response: 'Por favor responde con el número de la cita que deseas reagendar. 📋',
          toolCalls: []
        };
      }

      const selected = appts[selectedIndex];

      // Cancelar la cita actual
      const cancelResult = await DirectDBTools.cancelAppointment({
        appointment_id: selected.appointment_id,
        reason: 'Reagendada por paciente'
      });

      if (!cancelResult.success) {
        return {
          success: true,
          response: 'No pude cancelar la cita actual para reagendar. ¿Quieres intentar de nuevo?',
          toolCalls: []
        };
      }

      // Buscar nuevas opciones para la misma especialidad
      const availabilityResult = await DirectDBTools.getAvailableAppointments({
        specialty_id: selected.specialty_id,
        specialty_name: selected.specialty_name
      });

      if (availabilityResult.success && availabilityResult.data?.appointments?.length > 0) {
        const appointments = availabilityResult.data.appointments;
        const uniqueDoctors = availabilityResult.data.unique_doctors || [];

        updateState(cleanPhone, ConversationState.AWAITING_DOCTOR_SELECTION, {
          availableAppointments: appointments,
          availableDoctors: uniqueDoctors,
          specialtyName: selected.specialty_name,
          specialtyId: selected.specialty_id,
          appointmentToReschedule: selected.appointment_id
        });

        let response = `✅ Tu cita fue cancelada y ahora vamos a reagendarla. He encontrado disponibilidad para ${selected.specialty_name}:\n\n`;

        const firstOptions = appointments.slice(0, 5);
        firstOptions.forEach((apt: any, idx: number) => {
          response += `${idx + 1}. 👨‍⚕️ ${apt.doctor_name}\n`;
          response += `   📅 ${apt.appointment_date_formatted || apt.appointment_date}\n`;
          response += `   🕐 ${apt.start_time_formatted || apt.start_time} - ${apt.end_time_formatted || apt.end_time}\n`;
          response += `   📍 ${apt.location_name}\n`;
          response += `   🎫 ${apt.slots_available} cupos disponibles\n\n`;
        });

        response += '¿Cuál opción prefieres? Puedes decirme el número o el nombre del doctor. 😊';

        return {
          success: true,
          response,
          toolCalls: []
        };
      }

      updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY, {
        appointmentToReschedule: undefined
      });

      return {
        success: true,
        response: `Cancelé tu cita, pero no encontré disponibilidad inmediata para ${selected.specialty_name}. ¿Quieres otra especialidad o te agrego a la lista de espera?`,
        toolCalls: []
      };
    }

    // ============================================================================
    // PASO 3.55: MANEJO ESPECIAL DE SELECCIÓN DE DOCTOR
    // ============================================================================

    // Cuando el estado es AWAITING_DOCTOR_SELECTION
    if (stateContext.currentState === ConversationState.AWAITING_DOCTOR_SELECTION) {
      const normalizedMsg = message.trim().toLowerCase();
      const availableDoctors = stateContext.availableDoctors || [];

      if (availableDoctors.length > 0) {
        // Patrones para seleccionar por número
        const numberPatterns = [
          /^(el )?primero?$/i,
          /^(el )?1$/,
          /^(el )?segundo$/i,
          /^(el )?2$/,
          /^(el )?tercero$/i,
          /^(el )?3$/,
          /^opci[oó]n\s*(\d)$/i,
          /^(\d)$/
        ];

        let selectedIndex: number | null = null;

        // Verificar si selecciona por número
        for (const pattern of numberPatterns) {
          const match = normalizedMsg.match(pattern);
          if (match) {
            // Extraer el número
            if (/primero?/i.test(normalizedMsg) || match[1] === '1' || normalizedMsg === '1') {
              selectedIndex = 0;
            } else if (/segundo/i.test(normalizedMsg) || match[1] === '2' || normalizedMsg === '2') {
              selectedIndex = 1;
            } else if (/tercero/i.test(normalizedMsg) || match[1] === '3' || normalizedMsg === '3') {
              selectedIndex = 2;
            } else if (match[1]) {
              selectedIndex = parseInt(match[1]) - 1;
            }
            break;
          }
        }

        // Verificar si menciona un nombre de doctor
        if (selectedIndex === null) {
          for (let i = 0; i < availableDoctors.length; i++) {
            const doctorName = availableDoctors[i].toLowerCase();
            if (normalizedMsg.includes(doctorName) || doctorName.includes(normalizedMsg)) {
              selectedIndex = i;
              break;
            }
            // También verificar partes del nombre
            const nameParts = doctorName.split(' ');
            for (const part of nameParts) {
              if (part.length > 3 && normalizedMsg.includes(part)) {
                selectedIndex = i;
                break;
              }
            }
          }
        }

        // Seleccionar el doctor si encontramos una coincidencia
        if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < availableDoctors.length) {
          const selectedDoctor = availableDoctors[selectedIndex];
          console.log(`[WhatsAppAI] 👨‍⚕️ Doctor seleccionado: ${selectedDoctor} (índice ${selectedIndex})`);

          // Buscar el availability_id del doctor seleccionado en availableAppointments
          const availableAppointments = stateContext.availableAppointments || [];
          const doctorAppointment = availableAppointments.find(
            (appt: any) => appt.doctor_name?.toLowerCase() === selectedDoctor.toLowerCase()
          );

          // Guardar el doctor seleccionado y su availability_id en el contexto
          const stateUpdate: Record<string, any> = {
            selectedDoctor: selectedDoctor
          };

          if (doctorAppointment) {
            stateUpdate.availabilityId = doctorAppointment.availability_id;
            stateUpdate.selectedDoctorId = doctorAppointment.doctor_id;
            stateUpdate.selectedDate = doctorAppointment.appointment_date;
            stateUpdate.specialtyId = doctorAppointment.specialty_id;
            aiLogger.info({
              phone: cleanPhone,
              doctor: selectedDoctor,
              availabilityId: doctorAppointment.availability_id,
              date: doctorAppointment.appointment_date
            }, '✅ Doctor seleccionado con availability_id');
          }

          updateState(cleanPhone, ConversationState.AWAITING_DATE, stateUpdate);

          // Continuar al modelo con el doctor seleccionado para mostrar fechas
          // No hacer return aquí, dejar que el modelo procese con la info del doctor
        }
      }
    }

    // ============================================================================
    // PASO 3.56: MANEJO DE SELECCIÓN DE FECHA - OBTENER SLOTS REALES DISPONIBLES
    // ============================================================================

    // Cuando el estado es AWAITING_DATE y el usuario menciona una fecha
    if (stateContext.currentState === ConversationState.AWAITING_DATE && stateContext.availableAppointments) {
      const normalizedMsg = message.trim().toLowerCase();

      // Patrones para detectar selección de fecha
      const datePatterns = [
        /(?:el\s+)?(?:día\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*(\d{1,2})?/i,
        /(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
        /fecha\s*(\d+)/i,
        /opci[oó]n\s*(\d+)/i,
        /^(\d)$/,
        /me gusta(?:ría)?\s+(?:el\s+)?(\w+\s*\d*)/i,
        /prefiero\s+(?:el\s+)?(\w+\s*\d*)/i,
        /quiero\s+(?:el\s+)?(\w+\s*\d*)/i,
        /para\s+(?:el\s+)?(\w+\s*\d*)/i
      ];

      let dateMatched = false;
      for (const pattern of datePatterns) {
        if (pattern.test(normalizedMsg)) {
          dateMatched = true;
          break;
        }
      }

      if (dateMatched) {
        const availableAppts = stateContext.availableAppointments || [];
        // Obtener fechas únicas mostradas al usuario
        const uniqueDates = [...new Set(availableAppts.map((a: any) => a.appointment_date_formatted))].slice(0, 5) as string[];

        // Intentar hacer match de la fecha seleccionada
        let selectedDateFormatted: string | null = null;

        // Match por número de opción (1, 2, 3, etc.)
        const numMatch = normalizedMsg.match(/(?:opci[oó]n\s*)?(\d)$/);
        if (numMatch) {
          const idx = parseInt(numMatch[1]) - 1;
          if (idx >= 0 && idx < uniqueDates.length) {
            selectedDateFormatted = uniqueDates[idx];
          }
        }

        // Match por nombre de día (lunes, martes, etc.)
        if (!selectedDateFormatted) {
          const dayNames = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
          for (const dayName of dayNames) {
            if (normalizedMsg.includes(dayName)) {
              // Buscar la fecha que contenga ese día
              const matchingDate = uniqueDates.find(d => d.toLowerCase().includes(dayName) ||
                (dayName === 'miercoles' && d.toLowerCase().includes('miércoles')) ||
                (dayName === 'sabado' && d.toLowerCase().includes('sábado')));
              if (matchingDate) {
                selectedDateFormatted = matchingDate;
                break;
              }
            }
          }
        }

        // Match por número de día (ej: "10 de febrero", "el 10")
        if (!selectedDateFormatted) {
          const dayNumMatch = normalizedMsg.match(/(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(\w+)?/i);
          if (dayNumMatch) {
            const dayNum = dayNumMatch[1];
            const monthStr = dayNumMatch[2] || '';
            const matchingDate = uniqueDates.find(d => {
              const lower = d.toLowerCase();
              if (monthStr && lower.includes(monthStr.toLowerCase())) {
                return lower.includes(dayNum);
              }
              return lower.includes(` ${dayNum} `);
            });
            if (matchingDate) {
              selectedDateFormatted = matchingDate;
            }
          }
        }

        // Si la primera opción es la más probable y no pudimos hacer match
        if (!selectedDateFormatted && uniqueDates.length === 1) {
          selectedDateFormatted = uniqueDates[0];
        }

        if (selectedDateFormatted) {
          // Encontrar los appointments que corresponden a esa fecha
          const matchingAppts = availableAppts.filter(
            (a: any) => a.appointment_date_formatted === selectedDateFormatted
          );

          if (matchingAppts.length > 0) {
            const selectedAppt = matchingAppts[0];
            const doctorId = stateContext.selectedDoctorId || selectedAppt.doctor_id;
            const doctorName = stateContext.selectedDoctor || selectedAppt.doctor_name;
            const selectedDate = selectedAppt.appointment_date;
            const specialtyId = stateContext.specialtyId || selectedAppt.specialty_id;

            console.log(`[WhatsAppAI] 📅 Fecha seleccionada: ${selectedDateFormatted} → ${selectedDate} | Doctor: ${doctorName} (ID: ${doctorId})`);

            // Obtener slots REALES disponibles verificando citas existentes
            const slotsResult = await DirectDBTools.getAvailableTimeSlotsForDoctorOnDate({
              doctor_id: doctorId,
              date: selectedDate,
              specialty_id: specialtyId
            });

            if (slotsResult.success && slotsResult.data?.available_times?.length > 0) {
              const availableTimes = slotsResult.data.available_times_formatted || slotsResult.data.available_times;
              const slotsDetail = slotsResult.data.slots_detail || [];

              // Guardar slots y doctor en el estado
              updateState(cleanPhone, ConversationState.AWAITING_TIME, {
                timeSlots: slotsDetail,
                selectedDate: selectedDate,
                selectedDoctor: doctorName,
                selectedDoctorId: doctorId,
                availabilityId: selectedAppt.availability_id,
                specialtyId: specialtyId
              });

              aiLogger.info({
                phone: cleanPhone,
                doctor: doctorName,
                date: selectedDate,
                slotsCount: availableTimes.length,
                agendaSummary: slotsResult.data.agendas_summary
              }, '✅ Slots reales disponibles obtenidos (desde PASO 0.41 flow)');

              // Mostrar solo los primeros 5 slots
              const displaySlots = availableTimes.slice(0, 5);

              const dateLabel = slotsResult.data.date_formatted || selectedDateFormatted;
              let response = `¡Excelente elección! 😊 Para el ${dateLabel}, tenemos estos horarios disponibles:\n\n`;
              displaySlots.forEach((time: string, idx: number) => {
                response += `${idx + 1}. ${time}\n`;
              });

              if (availableTimes.length > 5) {
                response += `\n... y ${availableTimes.length - 5} horarios más.`;
              }

              response += `\n\n¿Cuál horario te queda mejor? 🕐`;

              return {
                success: true,
                response,
                toolCalls: [{ name: 'getAvailableTimeSlotsForDoctorOnDate', result: `${availableTimes.length} slots disponibles` }]
              };

            } else if (slotsResult.success && slotsResult.data?.available_times?.length === 0) {
              const dateLabel = slotsResult.data.date_formatted || selectedDateFormatted;

              return {
                success: true,
                response: `Lo siento, no hay horarios disponibles para el ${dateLabel}. Todas las agendas de ese día están completas. 😕\n\n¿Te gustaría ver otra fecha disponible o te agrego a la lista de espera?`,
                toolCalls: []
              };
            }
          }
        }
        // Si no pudimos hacer match de la fecha, dejar que el LLM maneje
      }
    }

    // PASO 3.56 LEGACY: Cuando tenemos selectedDoctor explícito y selectedDate ya establecido
    if (stateContext.currentState === ConversationState.AWAITING_DATE && stateContext.selectedDoctor && !stateContext.availableAppointments) {
      const normalizedMsg = message.trim().toLowerCase();

      // Patrones para detectar selección de fecha
      const datePatterns = [
        /(?:el\s+)?(?:día\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*(\d{1,2})?/i,
        /(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
        /fecha\s*(\d+)/i,
        /opci[oó]n\s*(\d+)/i,
        /^(\d)$/,
        /me gusta(?:ría)?\s+(?:el\s+)?(\w+\s*\d*)/i,
        /prefiero\s+(?:el\s+)?(\w+\s*\d*)/i,
        /quiero\s+(?:el\s+)?(\w+\s*\d*)/i
      ];

      let dateMatched = false;
      for (const pattern of datePatterns) {
        if (pattern.test(normalizedMsg)) {
          dateMatched = true;
          break;
        }
      }

      // Si el usuario selecciona una fecha y tenemos doctor y fecha en el contexto
      if (dateMatched && stateContext.selectedDoctorId && stateContext.selectedDate) {
        console.log(`[WhatsAppAI] 📅 Fecha seleccionada detectada - Buscando slots reales disponibles`);

        // NUEVO: Obtener slots REALES disponibles verificando citas existentes
        const slotsResult = await DirectDBTools.getAvailableTimeSlotsForDoctorOnDate({
          doctor_id: stateContext.selectedDoctorId,
          date: stateContext.selectedDate,
          specialty_id: stateContext.specialtyId
        });

        if (slotsResult.success && slotsResult.data?.available_times?.length > 0) {
          const availableTimes = slotsResult.data.available_times_formatted || slotsResult.data.available_times;
          const slotsDetail = slotsResult.data.slots_detail || [];

          // Guardar slots en el estado para validación posterior
          updateState(cleanPhone, ConversationState.AWAITING_TIME, {
            timeSlots: slotsDetail,
            selectedDate: stateContext.selectedDate
          });

          aiLogger.info({
            phone: cleanPhone,
            doctor: stateContext.selectedDoctor,
            date: stateContext.selectedDate,
            slotsCount: availableTimes.length,
            agendaSummary: slotsResult.data.agendas_summary
          }, '✅ Slots reales disponibles obtenidos');

          // Mostrar solo los primeros 5 slots
          const displaySlots = availableTimes.slice(0, 5);

          let response = `¡Perfecto! 😊 Para el ${slotsResult.data.date_formatted} con ${stateContext.selectedDoctor}, tenemos estos horarios disponibles:\n\n`;
          displaySlots.forEach((time: string, idx: number) => {
            response += `• ${time}\n`;
          });

          if (availableTimes.length > 5) {
            response += `\n... y ${availableTimes.length - 5} horarios más.`;
          }

          response += `\n\n¿Cuál de estos horarios te queda mejor? 🕐`;

          return {
            success: true,
            response,
            toolCalls: [{ name: 'getAvailableTimeSlotsForDoctorOnDate', result: `${availableTimes.length} slots disponibles` }]
          };

        } else if (slotsResult.success && slotsResult.data?.available_times?.length === 0) {
          // No hay slots disponibles para esa fecha
          aiLogger.warn({
            phone: cleanPhone,
            doctor: stateContext.selectedDoctor,
            date: stateContext.selectedDate,
            agendaSummary: slotsResult.data?.agendas_summary
          }, '⚠️ No hay slots disponibles para esta fecha');

          return {
            success: true,
            response: `Lo siento, no hay horarios disponibles para el ${slotsResult.data.date_formatted} con ${stateContext.selectedDoctor}. Todas las agendas de ese día están completas. 😕\n\n¿Te gustaría ver otra fecha disponible o te agrego a la lista de espera?`,
            toolCalls: []
          };
        }
        // Si hay error, continuar con flujo normal de IA
      }
    }

    // ============================================================================
    // PASO 3.6: MANEJO ESPECIAL DE SELECCIÓN DE HORA
    // ============================================================================

    // Cuando el estado es AWAITING_TIME y el usuario envía un número o una hora
    if (stateContext.currentState === ConversationState.AWAITING_TIME) {
      const normalizedMsg = message.trim().toLowerCase();

      // NUEVO: Handler para "dame más opciones" o "más horarios"
      if (/m[aá]s\s*(opciones|horarios)|otras?\s*(opciones|horarios)|otro\s*horario|otras\s*horas/i.test(normalizedMsg)) {
        // Si tenemos todos los slots, mostrar más
        if (stateContext.timeSlots && stateContext.timeSlots.length > 5) {
          const allTimes = stateContext.timeSlots.map((s: any) => s.time_formatted || s.time_colombia);

          let response = `¡Claro! 😊 Estos son todos los horarios disponibles:\n\n`;
          allTimes.forEach((time: string) => {
            response += `• ${time}\n`;
          });
          response += `\n¿Cuál te queda mejor?`;

          return {
            success: true,
            response,
            toolCalls: []
          };
        } else if (stateContext.selectedDoctorId && stateContext.selectedDate) {
          // Si no tenemos slots, obtenerlos de nuevo
          const slotsResult = await DirectDBTools.getAvailableTimeSlotsForDoctorOnDate({
            doctor_id: stateContext.selectedDoctorId,
            date: stateContext.selectedDate,
            specialty_id: stateContext.specialtyId
          });

          if (slotsResult.success && slotsResult.data?.available_times?.length > 0) {
            const availableTimes = slotsResult.data.available_times_formatted || slotsResult.data.available_times;
            const slotsDetail = slotsResult.data.slots_detail || [];

            // Actualizar slots en estado
            updateState(cleanPhone, ConversationState.AWAITING_TIME, {
              timeSlots: slotsDetail
            });

            let response = `¡Claro! 😊 Estos son todos los horarios disponibles para el ${slotsResult.data.date_formatted}:\n\n`;
            availableTimes.forEach((time: string) => {
              response += `• ${time}\n`;
            });
            response += `\n¿Cuál te queda mejor?`;

            return {
              success: true,
              response,
              toolCalls: [{ name: 'getAvailableTimeSlotsForDoctorOnDate', result: `${availableTimes.length} slots` }]
            };
          } else {
            return {
              success: true,
              response: `Lo siento, no hay más horarios disponibles para esa fecha. ¿Te gustaría ver otra fecha o te agrego a la lista de espera?`,
              toolCalls: []
            };
          }
        }
      }

      // PRIORIDAD 1: Buscar si el usuario mencionó una HORA ESPECÍFICA (ej: "1 pm", "2 de la tarde", "9:30 am")
      const timePatterns = [
        /(\d{1,2})\s*(?:de la)?\s*(tarde|pm)/i,     // "1 pm", "2 de la tarde", "1 de la tarde"
        /(\d{1,2})\s*(?:de la)?\s*(mañana|am)/i,    // "9 am", "10 de la mañana"  
        /(\d{1,2}):(\d{2})\s*(am|pm)?/i,            // "9:30", "10:00 am", "2:30 pm"
        /a las?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i, // "a las 2", "a la 1 pm"
      ];

      let requestedHour: number | null = null;
      let requestedMinute: number = 0;
      let isPM: boolean = false;
      let isAM: boolean = false;

      for (const pattern of timePatterns) {
        const match = normalizedMsg.match(pattern);
        if (match) {
          requestedHour = parseInt(match[1]);
          // Verificar si hay minutos
          if (match[2] && /^\d{2}$/.test(match[2])) {
            requestedMinute = parseInt(match[2]);
          }
          // Verificar AM/PM
          const ampmPart = match[3] || match[2] || '';
          if (/pm|tarde/i.test(ampmPart)) {
            isPM = true;
          } else if (/am|mañana/i.test(ampmPart)) {
            isAM = true;
          }
          break;
        }
      }

      // Si encontramos una hora específica, buscarla en los time slots
      if (requestedHour !== null && stateContext.timeSlots && stateContext.timeSlots.length > 0) {
        console.log(`[WhatsAppAI] 🔍 Buscando hora: ${requestedHour}:${requestedMinute.toString().padStart(2, '0')} ${isPM ? 'PM' : isAM ? 'AM' : ''}`);

        // Función para normalizar la hora a formato comparable
        const normalizeTime = (hour: number, minute: number, isPm: boolean, isAm: boolean): string[] => {
          const variations: string[] = [];
          let h = hour;

          // Si es PM y hora < 12, puede ser 1 PM, 2 PM, etc.
          if (isPm && h <= 12) {
            // Formato "1:00 PM", "2:30 PM"
            variations.push(`${h}:${minute.toString().padStart(2, '0')} PM`);
            if (minute === 0) {
              variations.push(`${h}:00 PM`);
            }
          }

          // Si es AM o hora > 12 es mañana
          if (isAm || (!isPm && h <= 12)) {
            variations.push(`${h}:${minute.toString().padStart(2, '0')} AM`);
            if (minute === 0) {
              variations.push(`${h}:00 AM`);
            }
          }

          // Sin especificar AM/PM, probar ambos
          if (!isPm && !isAm) {
            variations.push(`${h}:${minute.toString().padStart(2, '0')} PM`);
            variations.push(`${h}:${minute.toString().padStart(2, '0')} AM`);
          }

          return variations;
        };

        const possibleTimes = normalizeTime(requestedHour, requestedMinute, isPM, isAM);
        console.log(`[WhatsAppAI] 🔍 Posibles formatos a buscar: ${possibleTimes.join(', ')}`);

        // Buscar en los time slots
        let foundSlot: any = null;
        for (const slot of stateContext.timeSlots) {
          const slotTime = typeof slot === 'string' ? slot : (slot.time_formatted || slot.time);
          const slotTimeNormalized = slotTime.toUpperCase().replace(/\s+/g, ' ').trim();

          for (const possibleTime of possibleTimes) {
            const possibleNormalized = possibleTime.toUpperCase().replace(/\s+/g, ' ').trim();
            if (slotTimeNormalized === possibleNormalized) {
              foundSlot = slot;
              console.log(`[WhatsAppAI] ✓ Hora encontrada: ${slotTime}`);
              break;
            }
          }
          if (foundSlot) break;
        }

        if (foundSlot) {
          const selectedTime = typeof foundSlot === 'string' ? foundSlot : (foundSlot.time_formatted || foundSlot.time);
          const scheduledDatetime = typeof foundSlot === 'object' ? foundSlot.scheduled_datetime : null;

          console.log(`[WhatsAppAI] ✓ Slot seleccionado por HORA ESPECÍFICA: ${selectedTime} (scheduled: ${scheduledDatetime})`);

          // Guardar el scheduled_datetime para usarlo después
          if (scheduledDatetime) {
            updateState(cleanPhone, ConversationState.AWAITING_REASON, {
              selectedTime,
              scheduledDatetime
            });
          } else {
            updateState(cleanPhone, ConversationState.AWAITING_REASON);
          }

          return {
            success: true,
            response: `¡Perfecto! Has seleccionado las ${selectedTime}. 📋 ¿Cuál es el motivo de tu consulta?`,
            toolCalls: []
          };
        } else {
          // No encontramos esa hora en los slots disponibles
          console.log(`[WhatsAppAI] ⚠️ Hora ${requestedHour}:${requestedMinute.toString().padStart(2, '0')} NO está disponible`);

          const availableSlots = stateContext.timeSlots.slice(0, 5).map((s: any) =>
            typeof s === 'string' ? s : (s.time_formatted || s.time)
          ).join(', ');

          return {
            success: true,
            response: `Disculpa, el horario de las ${requestedHour}${requestedMinute > 0 ? ':' + requestedMinute.toString().padStart(2, '0') : ''} ${isPM ? 'PM' : isAM ? 'AM' : ''} no está disponible. Los horarios que tenemos son: ${availableSlots}. ¿Cuál prefieres?`,
            toolCalls: []
          };
        }
      }

      // PRIORIDAD 2: Detectar selección por número simple (1, 2, 3) como índice
      const numberMatch = normalizedMsg.match(/^(\d{1,2})$/);

      if (numberMatch && stateContext.timeSlots && stateContext.timeSlots.length > 0) {
        const selectedNumber = parseInt(numberMatch[1]);
        console.log(`[WhatsAppAI] 🕐 Usuario seleccionó opción por número: ${selectedNumber}`);

        // Solo tratar como índice si es un número pequeño (1-10) y está en rango
        if (selectedNumber >= 1 && selectedNumber <= Math.min(10, stateContext.timeSlots.length)) {
          const selectedSlot = stateContext.timeSlots[selectedNumber - 1];
          const selectedTime = typeof selectedSlot === 'string' ? selectedSlot : (selectedSlot.time_formatted || selectedSlot.time);
          const scheduledDatetime = typeof selectedSlot === 'object' ? selectedSlot.scheduled_datetime : null;

          console.log(`[WhatsAppAI] ✓ Slot seleccionado por índice ${selectedNumber}: ${selectedTime}`);

          if (scheduledDatetime) {
            updateState(cleanPhone, ConversationState.AWAITING_REASON, {
              selectedTime,
              scheduledDatetime
            });
          } else {
            updateState(cleanPhone, ConversationState.AWAITING_REASON);
          }

          return {
            success: true,
            response: `¡Perfecto! Has seleccionado las ${selectedTime}. 📋 ¿Cuál es el motivo de tu consulta?`,
            toolCalls: []
          };
        }
      }

      // PRIORIDAD 3: Detectar selección por texto como "mañana", "tarde"
      if (/mañana|temprano|primera hora/i.test(normalizedMsg) && stateContext.timeSlots?.length > 0) {
        const firstSlot = stateContext.timeSlots[0];
        const firstTime = typeof firstSlot === 'string' ? firstSlot : (firstSlot.time_formatted || firstSlot.time);

        updateState(cleanPhone, ConversationState.AWAITING_REASON);

        return {
          success: true,
          response: `¡Perfecto! Te agendo a primera hora, a las ${firstTime}. 📋 ¿Cuál es el motivo de tu consulta?`,
          toolCalls: []
        };
      }

      // Si es "tarde", buscar el primer slot de tarde (>= 12:00 PM)
      if (/tarde/i.test(normalizedMsg) && stateContext.timeSlots?.length > 0) {
        const afternoonSlot = stateContext.timeSlots.find((s: any) => {
          const time = typeof s === 'string' ? s : (s.time_formatted || s.time);
          return /PM/i.test(time) && !/^12:/i.test(time); // PM pero no 12 PM (mediodía)
        }) || stateContext.timeSlots.find((s: any) => {
          const time = typeof s === 'string' ? s : (s.time_formatted || s.time);
          return /PM/i.test(time); // Cualquier PM
        });

        if (afternoonSlot) {
          const selectedTime = typeof afternoonSlot === 'string' ? afternoonSlot : (afternoonSlot.time_formatted || afternoonSlot.time);

          updateState(cleanPhone, ConversationState.AWAITING_REASON);

          return {
            success: true,
            response: `¡Perfecto! Te agendo en la tarde, a las ${selectedTime}. 📋 ¿Cuál es el motivo de tu consulta?`,
            toolCalls: []
          };
        }
      }
    }

    // ============================================================================
    // PASO 4: OBTENER CONTEXTO DE CONVERSACIÓN CON MEMORIA PERSISTENTE
    // ============================================================================

    const context = await getConversationWithMemory(cleanPhone);

    // Si hay historial previo, usarlo
    if (messageHistory.length > 0 && context.messages.length === 0) {
      context.messages = messageHistory.map(m => ({ role: m.role, content: m.content }));
    }

    // Agregar mensaje del usuario
    context.messages.push({ role: 'user', content: message });

    // Guardar mensaje del usuario en memoria persistente
    saveMessageToMemory(cleanPhone, 'user', message).catch(() => { });

    // Limitar historial a últimos 20 mensajes
    if (context.messages.length > 20) {
      context.messages = context.messages.slice(-20);
    }

    // ============================================================================
    // PASO 5: GENERAR RESPUESTA CON IA
    // ============================================================================

    let response = await generateAIResponse(context);

    // ============================================================================
    // PASO 6: PROCESAR TOOL CALLS CON MANEJO DE ESTADOS (TRANSPARENTE)
    // ============================================================================

    let iterations = 0;
    const MAX_ITERATIONS = 5;
    let lastSuccessfulTool: string | null = null;
    const executedToolKeys = new Set<string>(); // Para evitar ejecutar el mismo tool call duplicado

    while (response.toolCalls && response.toolCalls.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      // Filtrar tool calls duplicados (mismo nombre + mismos argumentos)
      const uniqueToolCalls = response.toolCalls.filter(tc => {
        const key = `${tc.name}:${JSON.stringify(tc.args)}`;
        if (executedToolKeys.has(key)) {
          console.log(`[WhatsAppAI] ⏭ Ignorando tool call duplicado: ${tc.name}`);
          return false;
        }
        executedToolKeys.add(key);
        return true;
      });

      if (uniqueToolCalls.length === 0) {
        console.log(`[WhatsAppAI] ✓ Todos los tool calls ya fueron ejecutados, usando respuesta actual`);
        // Si todos los tool calls son duplicados, la respuesta.text actual es la final
        break;
      }

      for (const toolCall of uniqueToolCalls) {
        try {
          // ============================================================================
          // INYECTAR scheduled_date SI TENEMOS scheduledDatetime GUARDADO
          // ============================================================================
          if (toolCall.name === 'scheduleAppointment') {
            const stateCtx = getStateContext(cleanPhone);

            // ⚠️ SI YA HAY UNA CITA AGENDADA EN ESTA SESIÓN, NO VOLVER A AGENDAR
            if (stateCtx.lastAppointmentId) {
              console.log(`[WhatsAppAI] ⚠️ Ya existe cita #${stateCtx.lastAppointmentId} en esta sesión, saltando scheduleAppointment`);
              // Agregar resultado simulado como si ya estuviera agendado
              context.messages.push({
                role: 'system',
                content: `[Resultado de scheduleAppointment]: La cita ya fue agendada previamente con ID #${stateCtx.lastAppointmentId}. No es necesario agendar de nuevo.`
              });
              executedTools.push({
                name: 'scheduleAppointment (YA AGENDADA)',
                result: `Cita #${stateCtx.lastAppointmentId} ya existe`
              });
              continue; // Saltar a la siguiente herramienta
            }

            // Si tenemos un scheduledDatetime guardado del slot que el usuario eligió
            if (stateCtx.scheduledDatetime) {
              console.log(`[WhatsAppAI] 📅 Inyectando scheduledDatetime del estado: ${stateCtx.scheduledDatetime}`);

              // SIEMPRE usar el scheduledDatetime guardado - el usuario ya lo seleccionó
              toolCall.args.scheduled_date = stateCtx.scheduledDatetime;

              console.log(`[WhatsAppAI] ✓ scheduled_date fijado a: ${toolCall.args.scheduled_date}`);
            }
          }

          const toolResult = await executeToolCall(toolCall.name, toolCall.args, context);
          context.last_tool_result = toolResult;
          lastSuccessfulTool = toolCall.name;

          // ============================================================================
          // ACTUALIZAR ESTADO SEGÚN LA HERRAMIENTA EJECUTADA (SIN INTERFERIR)
          // ============================================================================

          // Actualizar estados de forma silenciosa para tracking, NO para controlar el flujo
          if (toolCall.name === 'searchPatient') {
            if (toolResult.success && toolResult.data?.found) {
              // Paciente encontrado - puede venir como patient (singular) o patients (array)
              const patient = toolResult.data.patient || toolResult.data.patients?.[0];
              const patientName = patient?.full_name || patient?.name;
              const patientDocument = toolCall.args.document;
              const patientPhone = patient?.phone || patient?.mobile || '';  // Obtener teléfono del paciente

              updateState(cleanPhone, ConversationState.AWAITING_PHONE_CONFIRMATION, {
                patientId: patient?.id,
                patientName: patientName,
                patientDocument: patientDocument,
                patientPhone: patientPhone  // Guardar teléfono del paciente en el estado
              });

              // Persistir información del paciente en la sesión de memoria
              if (patient?.id) {
                updateSessionPatient(cleanPhone, patient.id, patientName, patientDocument).catch(() => { });

                // Guardar resultado de la herramienta en memoria
                saveMessageToMemory(cleanPhone, 'tool', `Paciente encontrado: ${patientName}`, {
                  toolName: 'searchPatient',
                  toolResult: { found: true, patientId: patient.id, patientName, patientPhone }
                }).catch(() => { });
              }

              console.log(`[WhatsAppAI] ✓ Paciente encontrado: ${patientName} (ID: ${patient?.id}, Phone: ${patientPhone})`);
            } else {
              // Paciente no encontrado - necesita registro
              updateState(cleanPhone, ConversationState.AWAITING_PATIENT_DATA, {
                patientDocument: toolCall.args.document,
                registrationPending: true,  // Flag para indicar que necesita registro
                regStep: 'name'
              });
              console.log(`[WhatsAppAI] ⚠ Paciente no encontrado, requiere registro`);

              // Añadir instrucción explícita al contexto para forzar solicitud de registro
              context.messages.push({
                role: 'system',
                content: `⚠️ ACCIÓN REQUERIDA: El paciente con documento ${toolCall.args.document} NO existe en el sistema. 
                
DEBES solicitar los datos para registrarlo. Responde EXACTAMENTE con:
"No encuentro tu registro en el sistema con el documento ${toolCall.args.document}. 😊 Para poder ayudarte, necesito crear tu perfil.

¿Cuál es tu nombre completo (nombres y apellidos)?"`
              });
            }

          } else if (toolCall.name === 'registerPatientSimple' && toolResult.success) {
            // Paciente registrado exitosamente
            const patientId = toolResult.data?.id;
            const patientName = toolCall.args.name || toolCall.args.full_name;

            updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY, {
              patientId: patientId,
              patientName: patientName
            });

            // Persistir información del paciente recién registrado
            if (patientId) {
              updateSessionPatient(cleanPhone, patientId, patientName, toolCall.args.document || '').catch(() => { });
            }

            aiLogger.info({ patientId: patientId, name: patientName }, 'Patient registered');

          } else if (toolCall.name === 'actualizarPhone' && toolResult.success) {
            // Teléfono actualizado
            aiLogger.info({ document: toolCall.args.document }, 'Phone updated');

          } else if (toolCall.name === 'getEPSServices' && toolResult.success) {
            // Servicios EPS obtenidos
            aiLogger.debug('EPS services fetched');

          } else if (toolCall.name === 'getPatientAppointments' && toolResult.success) {
            // Citas del paciente obtenidas
            aiLogger.debug({ count: toolResult.data?.appointments?.length || 0 }, 'Patient appointments fetched');

          } else if (toolCall.name === 'cancelAppointment' && toolResult.success) {
            // Cita cancelada
            aiLogger.info({ appointmentId: toolCall.args.appointment_id }, 'Appointment cancelled');

          } else if (toolCall.name === 'getAvailableAppointments' && toolResult.success) {
            // Disponibilidad consultada
            aiLogger.debug('Availability fetched');

          } else if (toolCall.name === 'checkAvailabilityQuota' && toolResult.success) {
            // Cupos verificados
            const canSchedule = toolResult.data?.can_schedule;
            aiLogger.debug({ canSchedule }, 'Quota checked');
            if (canSchedule) {
              updateState(cleanPhone, ConversationState.AWAITING_TIME);
            }

          } else if (toolCall.name === 'getAvailableTimeSlots' && toolResult.success) {
            // Horarios obtenidos
            const slotsCount = toolResult.data?.available_time_slots?.length || 0;
            aiLogger.debug({ slotsCount }, 'Time slots fetched');
            updateState(cleanPhone, ConversationState.AWAITING_TIME, {
              timeSlots: toolResult.data?.available_time_slots
            });

          } else if (toolCall.name === 'getAvailableTimeSlotsForDoctorOnDate' && toolResult.success) {
            // NUEVO: Horarios verificados contra citas existentes
            const slotsCount = toolResult.data?.available_times?.length || 0;
            const slotsDetail = toolResult.data?.slots_detail || [];
            aiLogger.info({
              slotsCount,
              agendaSummary: toolResult.data?.agendas_summary
            }, 'Verified time slots fetched');
            updateState(cleanPhone, ConversationState.AWAITING_TIME, {
              timeSlots: slotsDetail,
              selectedDate: toolResult.data?.date
            });

          } else if (toolCall.name === 'searchSpecialties' && toolResult.success) {
            // Especialidades consultadas
            aiLogger.debug('Specialties fetched');

          } else if (toolCall.name === 'searchCups' && toolResult.success) {
            // CUPS consultado
            aiLogger.debug({ cups_code: toolCall.args.cups_code }, 'CUPS fetched');

          } else if (toolCall.name === 'searchCupsByName' && toolResult.success) {
            // CUPS por nombre
            aiLogger.debug({ name: toolCall.args.name }, 'CUPS searched by name');

          } else if (toolCall.name === 'scheduleAppointment' && toolResult.success) {
            // Cita agendada o lista de espera
            if (toolResult.data?.waiting_list) {
              aiLogger.info({
                waitingListId: toolResult.data.waiting_list_id,
                position: toolResult.data.queue_position
              }, 'Added to waiting list');
              updateState(cleanPhone, ConversationState.COMPLETED, {
                lastQuestion: `Lista de espera (Posición: ${toolResult.data.queue_position})`
              });

              // Guardar en memoria
              saveMessageToMemory(cleanPhone, 'tool', `Añadido a lista de espera - Posición: ${toolResult.data.queue_position}`, {
                toolName: 'scheduleAppointment',
                toolResult: { waitingList: true, position: toolResult.data.queue_position }
              }).catch(() => { });
            } else {
              const appointmentId = toolResult.data?.appointment_id;
              aiLogger.info({ appointmentId }, 'Appointment scheduled');

              // ⚠️ GUARDAR EL APPOINTMENT_ID EN EL ESTADO PARA EVITAR DOBLES AGENDAMIENTOS
              updateState(cleanPhone, ConversationState.COMPLETED, {
                lastQuestion: `Cita #${appointmentId}`,
                lastAppointmentId: appointmentId  // ← NUEVO: Guardar ID de cita
              });

              // 🆕 PERSISTIR CITA AGENDADA EN CONVERSACIÓN JSON
              addAppointment(cleanPhone, {
                appointmentId: appointmentId,
                specialty: toolResult.data?.specialty_name || stateContext.specialtyName || '',
                doctorName: toolResult.data?.doctor_name || stateContext.selectedDoctor || '',
                date: toolResult.data?.scheduled_date?.split(' ')[0] || '',
                time: toolResult.data?.scheduled_time || stateContext.selectedTime || '',
                location: toolResult.data?.location_name || '',
                status: 'Confirmada',
                scheduledAt: new Date().toISOString()
              }).catch(() => { });
              await updateContext(cleanPhone, { state: 'completed' });

              // Guardar cita agendada en memoria
              saveMessageToMemory(cleanPhone, 'tool', `Cita agendada exitosamente - ID: ${appointmentId}`, {
                toolName: 'scheduleAppointment',
                toolResult: { appointmentId, scheduled: true }
              }).catch(() => { });
            }

            // NO auto-resetear - la conversación continúa hasta que el usuario diga "hola" o saludo
            // El estado COMPLETED permite seguir interactuando
            aiLogger.debug({ phone: cleanPhone }, 'Cita completada - conversación continúa activa');

          } else if (toolCall.name === 'addToWaitingList' && toolResult.success) {
            // Lista de espera manual
            aiLogger.info('Added to waiting list manually');
            updateState(cleanPhone, ConversationState.COMPLETED);
          }

          // Guardar info de herramientas ejecutadas para logging
          executedTools.push({
            name: toolCall.name,
            result: JSON.stringify(toolResult).substring(0, 200)
          });

          // Agregar resultado COMPLETO de la herramienta al contexto del AI
          // ESTO ES CRÍTICO: El modelo necesita ver los resultados para mantener el contexto
          context.messages.push({
            role: 'system',
            content: `[Resultado de ${toolCall.name}]: ${JSON.stringify(normalizeToolResultDatesForWhatsApp(toolResult), null, 2)}`
          });

        } catch (error: any) {
          aiLogger.error({ tool: toolCall.name, error: error.message }, 'Error executing tool');
          incrementRetry(cleanPhone);

          // Determinar mensaje amigable según el tipo de error
          const userFriendlyError = getToolErrorMessage(toolCall.name, error);

          // Agregar error al contexto para que el AI pueda recuperarse con mensaje amigable
          context.messages.push({
            role: 'system',
            content: `[Error en ${toolCall.name}]: ${userFriendlyError}. Error técnico: ${error instanceof Error ? error.message : 'Error desconocido'}`
          });

          // Guardar herramienta fallida también para métricas
          executedTools.push({
            name: `${toolCall.name} (ERROR)`,
            result: userFriendlyError
          });
        }
      }

      // Generar nueva respuesta basada en los resultados
      if (response.shouldContinue) {
        console.log(`[WhatsAppAI] 🔄 Generando nueva respuesta después de ejecutar herramientas...`);
        response = await generateAIResponse(context);
        console.log(`[WhatsAppAI] 📝 Nueva respuesta: "${response.text.substring(0, 100)}..." (toolCalls: ${response.toolCalls?.length || 0})`);
      } else {
        break;
      }
    }

    // ============================================================================
    // PASO 7: VALIDAR RESPUESTA Y APLICAR FALLBACKS
    // ============================================================================

    // Obtener estado actual para verificar si ya se agendó una cita
    let stateForValidation = getStateContext(cleanPhone);
    const lastAppointmentId = stateForValidation.lastAppointmentId;

    // ============================================================================
    // ⚠️ PASO 7.1: EXTRAER AVAILABILITY_ID SI EL BOT OFRECE UNA CITA ESPECÍFICA
    // ============================================================================
    // Si el bot menciona una fecha/hora/doctor específico en su respuesta,
    // extraer el availability_id del array de appointments guardados
    if (!stateForValidation.availabilityId && stateForValidation.availableAppointments?.length > 0) {
      const appointments = stateForValidation.availableAppointments;
      const responseText = response.text.toLowerCase();

      // Buscar si la respuesta menciona un doctor específico
      let matchedAppointment = null;

      for (const appt of appointments) {
        const doctorName = (appt.doctor_name || '').toLowerCase();
        const firstName = doctorName.split(' ')[0];
        const lastName = doctorName.split(' ').slice(1).join(' ');

        // Verificar si el bot mencionó este doctor
        const doctorMentioned = doctorName && (
          responseText.includes(doctorName) ||
          (firstName.length > 3 && responseText.includes(firstName)) ||
          (lastName.length > 3 && responseText.includes(lastName))
        );

        // Verificar si mencionó la fecha (formato variado)
        const dateStr = appt.appointment_date || '';
        const dateMentioned = dateStr && (
          responseText.includes(dateStr) ||
          responseText.includes(formatDateForComparison(dateStr))
        );

        // Verificar hora
        const timeStr = appt.start_time || '';
        const timeMentioned = timeStr && responseText.includes(formatTimeForComparison(timeStr));

        // Si menciona el doctor O (fecha Y hora), es match
        if (doctorMentioned || (dateMentioned && timeMentioned)) {
          matchedAppointment = appt;
          aiLogger.info({
            phone: cleanPhone,
            matchedDoctor: appt.doctor_name,
            matchedDate: appt.appointment_date,
            availabilityId: appt.availability_id
          }, '🎯 Detectada cita específica en respuesta del bot');
          break;
        }
      }

      // Si encontramos match, guardar el availability_id
      if (matchedAppointment) {
        updateState(cleanPhone, {
          availabilityId: matchedAppointment.availability_id,
          selectedDoctor: matchedAppointment.doctor_name,
          selectedDoctorId: matchedAppointment.doctor_id,
          selectedDate: matchedAppointment.appointment_date,
          selectedTime: matchedAppointment.start_time
        });

        // Refrescar el estado
        stateForValidation = getStateContext(cleanPhone);

        // ✅ PERSISTIR EN BASE DE DATOS
        const sessionIdForUpdate = await getSessionIdForPhone(cleanPhone);
        if (sessionIdForUpdate) {
          await ChatMemoryService.updateSessionAppointmentSelection(sessionIdForUpdate, {
            availability_id: matchedAppointment.availability_id,
            selected_doctor: matchedAppointment.doctor_name,
            selected_doctor_id: matchedAppointment.doctor_id,
            selected_date: matchedAppointment.appointment_date,
            selected_time: matchedAppointment.start_time,
            specialty_name: stateForValidation.specialtyName,
            specialty_id: stateForValidation.specialtyId
          });
        }

        aiLogger.info({
          phone: cleanPhone,
          availabilityId: matchedAppointment.availability_id
        }, '✅ Availability ID guardado de la opción ofrecida');
      }
    }

    // ⚠️ DETECCIÓN DE CONFIRMACIÓN FALSA DE CITA ⚠️
    // Si el bot dice que agendó pero NO ejecutó scheduleAppointment, corregir la respuesta
    const scheduleWasExecuted = executedTools.some(t =>
      t.name === 'scheduleAppointment' ||
      t.name === 'scheduleAppointment (ERROR)' ||
      t.name === 'scheduleAppointment (YA AGENDADA)'
    );

    // ⚠️⚠️⚠️ REGEX MEJORADO PARA DETECTAR FALSAS CONFIRMACIONES ⚠️⚠️⚠️
    // Patrones que indican que el bot afirma haber agendado una cita:
    const responseClaimsScheduled = new RegExp([
      'cita (ha sido|fue|está) (confirmada|agendada)',
      'tu cita.*(confirmada|agendada)',
      '(he |ya |te )?agend(ado|ada|é|amos)',
      'cita #\\d+',
      'Cita #.*\\d+',
      'confirmada.*cita',
      'registrada tu cita',
      'tu cita.*queda.*para',
      'cita ha sido exitosamente',
      'cita quedó programada',
      '¡listo!.*cita'
    ].join('|'), 'i').test(response.text);

    const hasPlaceholders = /\[data\.|data\.appointment_id\]|\[appointment_id\]|\[esperando.*herramienta\]/i.test(response.text);

    // Si hay placeholders Y tenemos un appointment_id real, reemplazarlo
    if (hasPlaceholders && lastAppointmentId) {
      aiLogger.info({ phone: cleanPhone, appointmentId: lastAppointmentId }, 'Reemplazando placeholders con appointment_id real');
      response.text = response.text
        .replace(/\[data\.appointment_id\]/gi, String(lastAppointmentId))
        .replace(/data\.appointment_id/gi, String(lastAppointmentId))
        .replace(/\[esperando.*herramienta\]/gi, String(lastAppointmentId))
        .replace(/\*\*Cita #\*\*:\s*\[.*?\]/gi, `**Cita #**: ${lastAppointmentId}`)
        .replace(/Cita #\*:\s*\[.*?\]/gi, `Cita #*: ${lastAppointmentId}`);
    }

    if ((responseClaimsScheduled || hasPlaceholders) && !scheduleWasExecuted && !lastAppointmentId) {
      aiLogger.warn({
        phone: cleanPhone,
        response: response.text.substring(0, 200),
        executedTools: executedTools.map(t => t.name),
        stateContext: {
          patientId: stateForValidation.patientId,
          availabilityId: stateForValidation.availabilityId,
          selectedDoctor: stateForValidation.selectedDoctor,
          selectedDate: stateForValidation.selectedDate,
          specialtyName: stateForValidation.specialtyName
        }
      }, '⚠️ FALSA CONFIRMACIÓN DETECTADA - Bot dice que agendó pero NO ejecutó scheduleAppointment');

      // ⚠️ INTENTAR AGENDAR AUTOMÁTICAMENTE SI TENEMOS LOS DATOS NECESARIOS
      if (stateForValidation.patientId && stateForValidation.availabilityId) {

        // 🔒 VERIFICAR SI YA SE EJECUTÓ scheduleAppointment EN ESTA CONVERSACIÓN (EVITAR DUPLICADOS)
        const wasAlreadyScheduled = await PersistenceService.wasScheduleAppointmentExecuted(cleanPhone, 5);
        if (wasAlreadyScheduled) {
          aiLogger.info({
            phone: cleanPhone
          }, '🔒 AUTO-AGENDAMIENTO CANCELADO: Ya se ejecutó scheduleAppointment recientemente');

          // Obtener la última cita agendada
          const lastScheduled = await PersistenceService.getLastScheduledAppointment(cleanPhone);
          if (lastScheduled) {
            response.text = `Ya tienes una cita agendada recientemente:\n\n` +
              `• **Doctor(a):** ${lastScheduled.doctor_name || 'Asignado'}\n` +
              `• **Fecha:** ${lastScheduled.scheduled_date}\n` +
              `• **Hora:** ${lastScheduled.scheduled_time}\n` +
              `• **Sede:** ${lastScheduled.location_name || 'Sede principal'}\n` +
              `• **Cita #${lastScheduled.appointment_id}**\n\n` +
              `¿Hay algo más en lo que pueda ayudarte? 😊`;
          }
        } else {
          aiLogger.info({
            phone: cleanPhone,
            patientId: stateForValidation.patientId,
            availabilityId: stateForValidation.availabilityId
          }, '🔧 AUTO-AGENDAMIENTO: Intentando agendar automáticamente con datos del estado');

          try {
            const scheduleParams: Record<string, any> = {
              patient_id: stateForValidation.patientId,
              availability_id: stateForValidation.availabilityId,
              appointment_type: 'Presencial',
              priority_level: 'Normal'
            };

            // Agregar fecha si está disponible
            if (stateForValidation.scheduledDatetime) {
              scheduleParams.scheduled_date = stateForValidation.scheduledDatetime;
            } else if (stateForValidation.selectedDate && stateForValidation.selectedTime) {
              scheduleParams.scheduled_date = `${stateForValidation.selectedDate} ${stateForValidation.selectedTime}`;
            } else if (stateForValidation.selectedDate) {
              scheduleParams.scheduled_date = stateForValidation.selectedDate;
            }

            // Agregar motivo si tenemos la especialidad
            if (stateForValidation.specialtyName) {
              scheduleParams.reason = `Consulta de ${stateForValidation.specialtyName}`;
            } else {
              scheduleParams.reason = 'Consulta médica';
            }

            // Ejecutar scheduleAppointment
            const scheduleResult = await DirectDBTools.scheduleAppointment(scheduleParams);

            if (scheduleResult.success && scheduleResult.data?.appointment_id) {
              const appt = scheduleResult.data;

              // Actualizar estado con el appointment_id
              updateState(cleanPhone, {
                lastAppointmentId: appt.appointment_id
              });

              // 🔒 REGISTRAR EN PERSISTENCIA
              try {
                const sessionId = await getSessionIdForPhone(cleanPhone);
                await PersistenceService.recordScheduledAppointment({
                  session_id: sessionId || 0,
                  phone: cleanPhone,
                  patient_id: stateForValidation.patientId,
                  appointment_id: appt.appointment_id,
                  availability_id: stateForValidation.availabilityId,
                  doctor_name: appt.doctor_name,
                  specialty_name: appt.specialty_name || stateForValidation.specialtyName,
                  scheduled_date: appt.appointment_date || stateForValidation.selectedDate,
                  scheduled_time: appt.hora_cita_local || stateForValidation.selectedTime,
                  location_name: appt.location_name,
                  status: 'scheduled'
                });
              } catch (persistErr: any) {
                aiLogger.debug({ error: persistErr.message }, 'Error registrando auto-agendamiento en persistencia');
              }

              aiLogger.info({
                phone: cleanPhone,
                appointmentId: appt.appointment_id
              }, '✅ AUTO-AGENDAMIENTO EXITOSO');

              // ✅ RESETEAR SELECCIÓN EN BD DESPUÉS DE AGENDAR
              const sessionIdForReset = await getSessionIdForPhone(cleanPhone);
              if (sessionIdForReset) {
                await ChatMemoryService.updateSessionAppointmentSelection(sessionIdForReset, {
                  last_appointment_id: appt.appointment_id
                });
                await ChatMemoryService.resetSessionAppointmentSelection(sessionIdForReset);
              }

              // Generar respuesta de confirmación CONCISA
              response.text = `¡Listo! Tu cita quedó agendada:\n\n` +
                `📅 ${appt.fecha_cita_local || appt.appointment_date_formatted || stateForValidation.selectedDate}\n` +
                `🕐 ${appt.hora_cita_local || appt.scheduled_time_formatted || stateForValidation.selectedTime}\n` +
                `👨‍⚕️ ${appt.doctor_name || stateForValidation.selectedDoctor}\n` +
                `📍 Sede San Gil\n` +
                `🎫 Cita #${appt.appointment_id}\n\n` +
                `¡Te esperamos! 😊`;
            } else {
              // Si falla el agendamiento, informar brevemente
              aiLogger.error({ phone: cleanPhone, error: scheduleResult.error }, '❌ AUTO-AGENDAMIENTO FALLÓ');
              response.text = "No pude confirmar tu cita. 😔 ¿Me repites la fecha y hora que prefieres?";
            }
          } catch (autoScheduleError: any) {
            aiLogger.error({ phone: cleanPhone, error: autoScheduleError.message }, '❌ ERROR en AUTO-AGENDAMIENTO');
            response.text = "Hubo un problema. 😔 ¿Me confirmas la especialidad, fecha y hora?";
          }
        } // Fin del else de wasAlreadyScheduled
      } else {
        // No tenemos suficientes datos, pedir información faltante
        response.text = !stateForValidation.patientId
          ? '¿Me das tu número de cédula?'
          : '¿Para qué fecha y hora quieres la cita?';

        aiLogger.info({ phone: cleanPhone }, 'Solicitando datos faltantes para poder agendar');
      }
    }

    // ⚠️ LIMPIEZA FINAL CRÍTICA: Remover cualquier JSON o resultado de herramienta
    response.text = cleanResponseFromToolResults(response.text);

    // ⚠️ VALIDACIÓN PARA ESTADO AWAITING_PATIENT_DATA (Paciente no encontrado)
    // Si el estado indica que necesita registro pero la respuesta NO solicita datos, corregir
    const currentStateCheck = getStateContext(cleanPhone);
    if (currentStateCheck.currentState === ConversationState.AWAITING_PATIENT_DATA &&
      currentStateCheck.registrationPending) {

      const responseAsksForData = /nombre completo|tu nombre|cómo te llamas|datos|crear.*perfil|registr/i.test(response.text);

      if (!responseAsksForData) {
        aiLogger.warn({
          phone: cleanPhone,
          originalResponse: response.text.substring(0, 100),
          document: currentStateCheck.patientDocument
        }, '⚠️ Estado AWAITING_PATIENT_DATA pero respuesta no solicita datos - corrigiendo');

        response.text = `No encuentro tu registro en el sistema con el documento ${currentStateCheck.patientDocument || 'proporcionado'}. 😊 Para poder ayudarte, necesito crear tu perfil.\n\n¿Cuál es tu nombre completo (nombres y apellidos)?`;
      }
    }

    // Limpiar cualquier placeholder residual
    response.text = response.text
      .replace(/\[data\.appointment_id\]/gi, '')
      .replace(/data\.appointment_id/gi, '')
      .replace(/\[esperando.*herramienta\]/gi, '')
      .replace(/\*\*Cita #\*\*:\s*$/gm, '')
      .trim();

    // ⚠️ VALIDACIÓN CRÍTICA: Detectar confirmaciones falsas de cita
    // Si la respuesta dice "cita agendada/confirmada" pero NO tenemos lastAppointmentId, es una alucinación
    const finalStateCheck = getStateContext(cleanPhone);
    const claimsAppointmentScheduled = /cita.*(?:agendada|confirmada|programada)|ha sido (?:agendada|confirmada)|Cita #\s*\[|Cita #:\s*\[|\[número de cita\]/i.test(response.text);
    const hasRealAppointmentId = !!finalStateCheck.lastAppointmentId;

    if (claimsAppointmentScheduled && !hasRealAppointmentId) {
      aiLogger.warn({
        phone: cleanPhone,
        originalResponse: response.text.substring(0, 200),
        hasAppointmentId: hasRealAppointmentId,
        state: finalStateCheck
      }, '⚠️ ALERTA: Respuesta dice "cita agendada" pero NO hay appointment_id real - CORRIGIENDO');

      // Intentar auto-agendar si tenemos los datos necesarios
      if (finalStateCheck.patientId && finalStateCheck.availabilityId) {
        try {
          const autoScheduleParams: any = {
            availability_id: finalStateCheck.availabilityId,
            patient_id: finalStateCheck.patientId,
            reason: finalStateCheck.specialtyName ? `Consulta de ${finalStateCheck.specialtyName}` : 'Consulta médica',
            priority_level: 'Normal'
          };

          if (finalStateCheck.scheduledDatetime) {
            autoScheduleParams.scheduled_date = finalStateCheck.scheduledDatetime;
          }

          aiLogger.info({ phone: cleanPhone, params: autoScheduleParams }, '🔧 Intentando auto-agendar para corregir respuesta falsa');

          const scheduleResult = await DirectDBTools.scheduleAppointment(autoScheduleParams);

          if (scheduleResult.success && scheduleResult.data?.appointment_id) {
            const appt = scheduleResult.data;

            updateState(cleanPhone, ConversationState.COMPLETED, {
              lastAppointmentId: appt.appointment_id
            });

            // Generar respuesta CONCISA con el ID real
            response.text = `¡Listo! Tu cita quedó agendada:\n\n` +
              `📅 ${appt.fecha_cita_local || appt.appointment_date || finalStateCheck.selectedDate}\n` +
              `🕐 ${appt.hora_cita_local || appt.scheduled_time || finalStateCheck.selectedTime}\n` +
              `👨‍⚕️ ${appt.doctor_name || finalStateCheck.selectedDoctor}\n` +
              `📍 Sede San Gil\n` +
              `🎫 Cita #${appt.appointment_id}\n\n` +
              `¿Algo más? 😊`;

            aiLogger.info({ phone: cleanPhone, appointmentId: appt.appointment_id }, '✅ Auto-agendamiento correctivo exitoso');
          } else {
            // Falló el agendamiento
            response.text = "No pude confirmar la cita. 😔 ¿Me confirmas la fecha y hora?";
            aiLogger.error({ phone: cleanPhone, error: scheduleResult.error }, '❌ Auto-agendamiento correctivo falló');
          }
        } catch (autoErr: any) {
          response.text = "Hubo un problema. 😔 ¿Me repites la fecha y hora que quieres?";
          aiLogger.error({ phone: cleanPhone, error: autoErr.message }, '❌ Error en auto-agendamiento correctivo');
        }
      } else {
        // No tenemos datos suficientes
        response.text = !finalStateCheck.patientId
          ? '¿Me das tu cédula para verificarte?'
          : '¿Para qué fecha y hora quieres la cita?';
        aiLogger.warn({ phone: cleanPhone }, 'Corrigiendo respuesta falsa - datos faltantes');
      }
    }

    // Si la respuesta está vacía o es muy corta, usar mensaje de recuperación
    if (!response.text || response.text.trim().length < 10) {
      aiLogger.warn({ phone: cleanPhone }, 'Empty or too short response, using recovery message');
      const recoveryMessage = getRecoveryMessage(cleanPhone);
      response.text = recoveryMessage || "Disculpa, ¿puedes repetir eso? No te entendí bien. 😊";
      incrementRetry(cleanPhone);
    }

    // Agregar respuesta final al historial
    context.messages.push({ role: 'assistant', content: response.text });

    // Guardar respuesta en memoria persistente
    const processingDuration = Date.now() - startTime;
    saveMessageToMemory(cleanPhone, 'assistant', response.text, {
      responseTimeMs: processingDuration
    }).catch(() => { });

    // 🆕 POST-PROCESAMIENTO: Auto-captura de memorias semánticas
    try {
      const sessionId = await getSessionIdForPhone(cleanPhone);
      if (sessionId) {
        // Capturar memorias del mensaje del usuario
        const capturedCount = await SemanticMemory.autoCapture(
          sessionId,
          [{ role: 'user', content: message }],
          stateContext.patientId
        );

        if (capturedCount > 0) {
          aiLogger.info({ sessionId, capturedCount }, '🧠 Memorias auto-capturadas');
        }

        // Post-procesar para analytics
        await EnhancedUnderstanding.postProcessResponse(
          sessionId,
          message,
          response.text,
          stateContext.patientId
        );
      }
    } catch (error) {
      aiLogger.warn({ error }, 'Error en post-procesamiento de memorias');
    }

    // ============================================================================
    // PASO 8: LOGGING Y RETORNO EXITOSO
    // ============================================================================

    const duration = Date.now() - startTime;
    const currentState = getStateContext(cleanPhone);

    aiLogger.info({
      phone: cleanPhone,
      duration,
      state: currentState.currentState,
      toolsCount: executedTools.length,
      retryCount: currentState.retryCount,
      lastTool: lastSuccessfulTool
    }, 'Message processed successfully');

    response.text = limitEmojisPerLine(response.text, 1);

    // ============================================================================
    // 🆕 SILENT TOKEN: No responder si el bot decide que no es necesario
    // Inspirado en moltbot - permite al bot "callar" ante mensajes irrelevantes
    // ============================================================================
    const SILENT_TOKENS = ['[NO_REPLY]', '[SILENCIO]', '[NO_RESPONDER]', '{{NO_REPLY}}', '<<NO_REPLY>>'];
    const shouldBeSilent = SILENT_TOKENS.some(token =>
      response.text.includes(token) || response.text.trim() === token.replace(/[\[\]{}><]/g, '')
    );

    if (shouldBeSilent) {
      aiLogger.info({
        phone: cleanPhone,
        originalResponse: response.text.substring(0, 100),
        reason: 'Silent token detected'
      }, '🤫 Bot decidió no responder (silent token)');

      return {
        success: true,
        response: '', // Respuesta vacía = no enviar mensaje
        toolCalls: executedTools,
        intent: 'silent',
        silent: true // Flag para el caller
      };
    }

    return {
      success: true,
      response: response.text,
      toolCalls: executedTools,
      intent: intent // 🆕 Devolver intent para métricas
    };
  } catch (error: any) {
    aiLogger.error({ error: error.message, phone }, 'Error processing message');

    // Incrementar contador de errores
    const cleanPhone = phone.replace(/@.*/, '');
    incrementRetry(cleanPhone);

    // Obtener mensaje de recuperación basado en el estado actual
    const recoveryMessage = getRecoveryMessage(cleanPhone);

    const fallbackResponse = recoveryMessage || "Disculpa, tuve un problema procesando tu solicitud. ¿Podrías repetirlo? Si el problema persiste, llámanos al 6076911308. 📞";

    return {
      success: false,
      response: limitEmojisPerLine(fallbackResponse, 1),
      toolCalls: executedTools,
      error: error.message,
      intent: 'error' // 🆕 Marcar como error para métricas
    };
  }
}


// ============================================================================
// GENERACIÓN DE RESPUESTA CON OPENAI (ChatGPT)
// ============================================================================

async function generateAIResponse(context: ConversationContext): Promise<AIResponse> {
  const now = new Date();

  // Formato amigable para el bot
  const currentDateTime = now.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  // Formato ISO para herramientas (YYYY-MM-DDTHH:mm:ss)
  const isoDateTime = now.toISOString().split('.')[0];

  // Solo la fecha (YYYY-MM-DD) en Colombia
  const isoDate = getTodayColombia();

  // Limpiar número de teléfono del contexto (quitar @lid, @s.whatsapp.net, etc.)
  const cleanPhone = context.phone.replace(/@.*/, '');

  // ============================================================================
  // 🆕 v5: OBTENER CONTEXTO DINÁMICO BASADO EN EL ESTADO ACTUAL
  // ============================================================================
  const stateContext = getStateContext(cleanPhone);
  const dynamicContext = generateDynamicContext(stateContext, cleanPhone);
  aiLogger.debug({
    phone: cleanPhone,
    hasPatientId: !!stateContext.patientId,
    hasSpecialty: !!stateContext.specialtyName,
    hasDoctor: !!stateContext.selectedDoctor
  }, '🎯 Contexto dinámico generado');

  // ============================================================================
  // PERSONALIDAD: Construir mensajes con contexto de personalidad de Valeria
  // ============================================================================

  // Agregar mensaje del usuario al historial de personalidad
  personalityManager.addMessage(cleanPhone, 'user', context.messages[context.messages.length - 1]?.content || '');

  // Construir system prompt con variables reemplazadas
  const systemPrompt = VALERIA_SYSTEM_PROMPT
    .replace(/{{CURRENT_DATETIME}}/g, currentDateTime)
    .replace(/{{CURRENT_ISO_DATE}}/g, isoDate)
    .replace(/{{CURRENT_ISO_DATETIME}}/g, isoDateTime)
    .replace(/{{USER_PHONE}}/g, cleanPhone);

  // Combinar system prompt original con personalidad (buildSystemPrompt usa defaultPersonality automáticamente)
  let enhancedSystemPrompt = systemPrompt + '\n\n' + personalityManager.buildSystemPrompt();

  // 🆕 v5: INYECTAR CONTEXTO DINÁMICO (QUÉ DATOS YA TENEMOS) - MUY IMPORTANTE
  // Esto le dice al modelo qué información ya tiene para que NO repita preguntas
  enhancedSystemPrompt = dynamicContext + '\n\n' + enhancedSystemPrompt;
  aiLogger.debug({ dynamicContextSize: dynamicContext.length }, '🎯 Contexto dinámico inyectado al prompt');

  // 🆕 AGREGAR CONTEXTO ENRIQUECIDO CON MEMORIA SEMÁNTICA
  // NOTA: buildEnrichedContext ya se llamó en processWhatsAppMessage (paso 0),
  // aquí solo inyectamos el enrichedContextPrompt pre-calculado si está disponible
  // en el contexto de la conversación para evitar doble llamada costosa.
  if (context.messages.some(m => m.content?.includes('CONTEXTO ENRIQUECIDO'))) {
    aiLogger.debug('Contexto enriquecido ya presente en historial, omitiendo segunda llamada');
  } else {
    try {
      const enrichedContext = await EnhancedUnderstanding.buildEnrichedContext(cleanPhone, context.messages[context.messages.length - 1]?.content || '');
      if (enrichedContext) {
        const memoryContext = EnhancedUnderstanding.generateContextPrompt(enrichedContext);
        if (memoryContext) {
          enhancedSystemPrompt += '\n\n' + memoryContext;
          aiLogger.debug({ memoryContextSize: memoryContext.length }, '🧠 Contexto de memoria inyectado');
        }
      }
    } catch (error) {
      aiLogger.warn({ error }, 'Error inyectando contexto de memoria');
    }
  }

  // Construir mensajes para la API con contexto de personalidad
  const messages = [
    { role: 'system', content: enhancedSystemPrompt },
    ...context.messages.slice(-15) // Últimos 15 mensajes para contexto
  ];

  // Calcular tamaño aproximado del contexto para debugging
  const contextSize = JSON.stringify(messages).length;
  const lastToolResult = context.messages.filter(m => m.content?.includes('[Resultado de')).pop()?.content || '';

  aiLogger.info({
    messagesCount: messages.length,
    contextSizeBytes: contextSize,
    lastToolResultSize: lastToolResult.length,
    lastToolResultPreview: lastToolResult.substring(0, 300)
  }, 'Sending context to AI');

  // Obtener configuración del proveedor de IA
  const aiConfig = getAIConfig();

  try {
    aiLogger.debug({ provider: aiConfig.provider, model: aiConfig.model }, 'Calling AI provider');

    // GPT-4o usa max_tokens, temperatura 0 para máxima precisión y evitar alucinaciones
    // Aumentamos tokens a 1200 para respuestas más completas
    const tokenParam = aiConfig.isGPT5 ? { max_completion_tokens: 3000 } : { max_tokens: 1200 };
    // Temperatura 0 = determinístico, sin creatividad, máxima precisión
    const tempParam = aiConfig.isGPT5 ? {} : { temperature: 0 };

    const response = await axios.post(
      aiConfig.apiUrl,
      {
        model: aiConfig.model,
        messages,
        ...tokenParam,
        ...tempParam,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const aiMessage = response.data.choices[0]?.message?.content || '';

    // Log detallado de la respuesta de ChatGPT para depuración
    const finishReason = response.data.choices[0]?.finish_reason;
    const usage = response.data.usage;

    aiLogger.info({
      responseLength: aiMessage.length,
      finishReason,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      model: response.data.model,
      messagePreview: aiMessage.substring(0, 200) || '(VACÍO)'
    }, 'AI response received');

    // Si la respuesta está vacía, loguear más detalles
    if (!aiMessage || aiMessage.trim().length === 0) {
      aiLogger.warn({
        fullResponse: JSON.stringify(response.data).substring(0, 1000),
        finishReason,
        choices: response.data.choices?.length || 0
      }, 'AI returned empty response - full debug');
    }

    // Parsear tool calls del mensaje
    const { text, toolCalls } = parseToolCalls(aiMessage);

    // ============================================================================
    // PERSONALIDAD: Guardar respuesta del AI en historial
    // ============================================================================
    if (text && text.trim().length > 0) {
      personalityManager.addMessage(cleanPhone, 'assistant', text);
    }

    // cleanupInactiveContexts se ejecuta en intervalo (ver módulo de inicialización abajo)

    return {
      text,
      toolCalls,
      shouldContinue: toolCalls.length > 0
    };
  } catch (error: any) {
    aiLogger.error({
      provider: aiConfig.provider,
      error: error.response?.data || error.message
    }, 'AI provider error');
    throw error;
  }
}

// ============================================================================
// EJECUCIÓN DE HERRAMIENTAS MCP
// ============================================================================

async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  context: ConversationContext
): Promise<any> {
  aiLogger.debug({ tool: toolName, args }, 'Executing tool');
  const toolStartTime = Date.now();

  try {
    let result: any;

    // HERRAMIENTAS DIRECTAS A BD (más rápidas, sin MCP)
    switch (toolName) {
      case 'searchPatient': {
        result = await DirectDBTools.searchPatient(args);
        if (result.success && result.data?.found) {
          context.patient_id = result.data.patient?.id;
          context.patient_name = result.data.patient?.full_name;
          context.patient_document = args.document;
          context.patient_eps_id = result.data.patient?.insurance_eps_id;
        }
        break;
      }

      case 'registerPatientSimple':
        result = await DirectDBTools.registerPatientSimple(args as any);
        break;

      case 'listActiveEPS':
        result = await DirectDBTools.listActiveEPS();
        break;

      case 'getAvailableAppointments':
        result = await DirectDBTools.getAvailableAppointments(args);
        // Guardar doctores disponibles y datos de disponibilidad para manejo de selección
        if (result.success && result.data) {
          const phone = context.phone;
          if (phone) {
            // Guardar TODOS los datos necesarios para el agendamiento
            const appointments = result.data.appointments || [];
            const stateUpdate: Record<string, any> = {
              specialtyName: args.specialty_name || appointments[0]?.specialty_name,
              specialtyId: appointments[0]?.specialty_id
            };

            // Si hay doctores únicos, guardarlos para selección
            if (result.data.unique_doctors) {
              stateUpdate.availableDoctors = result.data.unique_doctors;
            }

            // Si solo hay UN doctor o UNA disponibilidad, pre-seleccionarla
            if (appointments.length === 1) {
              stateUpdate.availabilityId = appointments[0].availability_id;
              stateUpdate.selectedDoctor = appointments[0].doctor_name;
              stateUpdate.selectedDoctorId = appointments[0].doctor_id;
              stateUpdate.selectedDate = appointments[0].appointment_date;
              aiLogger.info({
                phone,
                availabilityId: appointments[0].availability_id,
                doctor: appointments[0].doctor_name
              }, 'Pre-selected single availability option');
            }

            // Guardar el array completo de appointments para referencia
            stateUpdate.availableAppointments = appointments;

            updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, stateUpdate);

            aiLogger.info({
              phone,
              doctors: result.data.unique_doctors,
              appointmentsCount: appointments.length
            }, 'Saved availability data to state');
          }
        }
        break;

      case 'getAvailableTimeSlots':
        result = await DirectDBTools.getAvailableTimeSlots(args as any);
        break;

      case 'getAvailableTimeSlotsForDoctorOnDate':
        // NUEVA herramienta: Obtiene slots reales disponibles verificando citas existentes
        result = await DirectDBTools.getAvailableTimeSlotsForDoctorOnDate(args as any);
        break;

      case 'scheduleAppointment': {
        // ⚠️ CORRECCIÓN DE PLACEHOLDERS: Si la IA envió "[id]" en lugar del número real
        const phone = context.phone;
        const stateCtx = phone ? getStateContext(phone) : null;

        // Función para detectar si es un placeholder
        const isPlaceholder = (val: any): boolean => {
          if (val === null || val === undefined) return true;
          if (typeof val === 'string') {
            const lower = val.toLowerCase().trim();
            return lower === '[id]' || lower === '[id real]' ||
              lower === 'id' || lower === '[numero]' ||
              lower.includes('[') || lower.includes('real');
          }
          return false;
        };

        // Corregir patient_id si es placeholder
        if (isPlaceholder(args.patient_id)) {
          const realPatientId = stateCtx?.patientId || context.patient_id;
          if (realPatientId) {
            aiLogger.warn({
              phone,
              originalPatientId: args.patient_id,
              correctedPatientId: realPatientId
            }, '🔧 CORRECCIÓN: Reemplazando patient_id placeholder con valor real del estado');
            args.patient_id = realPatientId;
          } else {
            aiLogger.error({ phone, args }, '❌ No se puede corregir patient_id - no hay valor en estado');
          }
        }

        // Corregir availability_id si es placeholder
        if (isPlaceholder(args.availability_id)) {
          const realAvailabilityId = stateCtx?.availabilityId;
          if (realAvailabilityId) {
            aiLogger.warn({
              phone,
              originalAvailabilityId: args.availability_id,
              correctedAvailabilityId: realAvailabilityId
            }, '🔧 CORRECCIÓN: Reemplazando availability_id placeholder con valor real del estado');
            args.availability_id = realAvailabilityId;
          } else {
            aiLogger.error({ phone, args }, '❌ No se puede corregir availability_id - no hay valor en estado');
          }
        }

        // Corregir scheduled_date si usa placeholder o está vacío
        if (!args.scheduled_date || isPlaceholder(args.scheduled_date)) {
          if (stateCtx?.selectedDate && stateCtx?.selectedTime) {
            const correctedDate = `${stateCtx.selectedDate} ${stateCtx.selectedTime}`;
            aiLogger.warn({
              phone,
              originalScheduledDate: args.scheduled_date,
              correctedScheduledDate: correctedDate
            }, '🔧 CORRECCIÓN: Construyendo scheduled_date desde estado');
            args.scheduled_date = correctedDate;
          }
        }

        aiLogger.info({
          phone,
          correctedArgs: {
            patient_id: args.patient_id,
            availability_id: args.availability_id,
            scheduled_date: args.scheduled_date
          }
        }, '📋 Args finales para scheduleAppointment');

        result = await DirectDBTools.scheduleAppointment(args as any);

        // ⚠️ REGISTRAR CITA EN PERSISTENCIA SI FUE EXITOSA
        if (result.success && result.data?.appointment_id && context.phone) {
          try {
            // Obtener session_id de la base de datos
            const sessionId = await getSessionIdForPhone(context.phone);

            // Registrar en whatsapp_scheduled_appointments
            await PersistenceService.recordScheduledAppointment({
              session_id: sessionId || 0,
              phone: context.phone,
              patient_id: args.patient_id || result.data.patient_id,
              appointment_id: result.data.appointment_id,
              availability_id: args.availability_id,
              doctor_name: result.data.doctor_name,
              specialty_name: result.data.specialty_name,
              scheduled_date: result.data.appointment_date || args.scheduled_date?.split(' ')[0],
              scheduled_time: result.data.hora_cita_local || args.scheduled_date?.split(' ')[1],
              location_name: result.data.location_name,
              status: 'scheduled'
            });

            // Actualizar sesión en BD con el appointment_id
            if (sessionId) {
              await ChatMemoryService.updateSessionAppointmentSelection(sessionId, {
                last_appointment_id: result.data.appointment_id
              });
            }

            aiLogger.info({
              phone: context.phone,
              appointmentId: result.data.appointment_id
            }, '✅ Cita registrada en persistencia');
          } catch (persistError: any) {
            aiLogger.error({ error: persistError.message }, 'Error registrando cita en persistencia');
          }
        }
        break;
      }

      case 'cancelAppointment':
        result = await DirectDBTools.cancelAppointment(args as any);
        break;

      case 'searchSpecialties':
        result = await DirectDBTools.searchSpecialties(args);
        break;

      case 'getPatientAppointments':
        result = await DirectDBTools.getPatientAppointments(args);
        break;

      case 'actualizarPhone':
        result = await DirectDBTools.actualizarPhone(args as any);
        break;

      // NUEVAS HERRAMIENTAS DIRECTAS A BD (lógica del portal)
      case 'checkConsecutiveSlots':
        result = await DirectDBTools.checkConsecutiveSlots(args as any);
        break;

      case 'scheduleDoubleAppointment':
        result = await DirectDBTools.scheduleDoubleAppointment(args as any);
        break;

      case 'addToWaitingListDirect':
        result = await DirectDBTools.addToWaitingList(args as any);
        break;

      case 'getWaitingListPosition':
        result = await DirectDBTools.getWaitingListPosition(args as any);
        break;

      case 'getAvailabilityByDoctor':
        result = await DirectDBTools.getAvailabilityByDoctor(args as any);
        break;

      // HERRAMIENTAS ADICIONALES (AHORA DIRECTAS A BD)
      case 'listZones':
        result = await DirectDBTools.listZones();
        break;

      case 'getEPSServices':
        result = await DirectDBTools.getEPSServices({ eps_id: args.eps_id });
        break;

      case 'checkAvailabilityQuota':
        result = await DirectDBTools.checkAvailabilityQuota(args as any);
        break;

      case 'searchCups':
        result = await DirectDBTools.searchCups({ code: args.cups_code, ...args });
        break;

      case 'searchCupsByName':
        result = await DirectDBTools.searchCupsByName({ name: args.name, limit: args.limit });
        break;

      case 'addToWaitingList':
        // Usar la versión DirectDB que ya existe
        result = await DirectDBTools.addToWaitingList(args as any);
        break;

      case 'getWaitingListAppointments':
        result = await DirectDBTools.getWaitingListAppointments(args);
        break;

      case 'reassignWaitingListAppointments':
        result = await DirectDBTools.reassignWaitingListAppointments(args as any);
        break;

      case 'cancelarCitasVencidas':
        result = await DirectDBTools.cancelarCitasVencidas(args as any);
        break;

      default:
        aiLogger.warn({ tool: toolName }, 'Unknown tool requested');
        return { success: false, error: `Herramienta desconocida: ${toolName}` };
    }

    const elapsed = Date.now() - toolStartTime;
    aiLogger.info({ tool: toolName, elapsed, success: result?.success }, 'Tool execution completed');

    // ⚠️ REGISTRAR LLAMADA A HERRAMIENTA EN LA BD PARA AUDITORÍA
    if (context.phone) {
      try {
        await PersistenceService.recordToolCall({
          phone: context.phone,
          tool_name: toolName,
          tool_args: args,
          tool_result: result?.success ? { success: true, summary: getSummaryFromResult(result) } : result,
          success: result?.success ?? false,
          execution_time_ms: elapsed,
          error_message: result?.error || null
        });
      } catch (recordError: any) {
        aiLogger.debug({ error: recordError.message }, 'Error registrando tool call (no crítico)');
      }
    }

    return result;
  } catch (error: any) {
    const elapsed = Date.now() - toolStartTime;
    aiLogger.error({ tool: toolName, error: error.message }, 'Tool execution failed');

    // Registrar error también
    if (context.phone) {
      try {
        await PersistenceService.recordToolCall({
          phone: context.phone,
          tool_name: toolName,
          tool_args: args,
          tool_result: null,
          success: false,
          execution_time_ms: elapsed,
          error_message: error.message
        });
      } catch (recordError: any) {
        // Ignorar errores de registro
      }
    }

    return { success: false, error: error.message };
  }
}

// ============================================================================
// PERSISTENCIA DE MENSAJES
// ============================================================================

async function saveMessage(
  phone: string,
  userMessage: string,
  aiResponse: string,
  responseTimeMs: number
): Promise<void> {
  try {
    // 🆕 PERSISTIR INTERACCIÓN EN CONVERSACIÓN JSON
    await recordMessage(phone, userMessage, aiResponse).catch(err => {
      aiLogger.warn({ error: err }, 'Error guardando en persistencia JSON');
    });

    const connection = await pool.getConnection();
    try {
      // Guardar mensaje entrante
      await connection.execute(`
        INSERT INTO wa_messages 
        (session_id, message_id, from_number, body, direction, status, ai_response, ai_model, response_time_ms)
        VALUES ('default', ?, ?, ?, 'inbound', 'delivered', ?, ?, ?)
      `, [
        `msg_${Date.now()}_in`,
        phone,
        userMessage,
        aiResponse,
        AI_MODEL,
        responseTimeMs
      ]);

      // Actualizar conversación
      await connection.execute(`
        INSERT INTO wa_conversations (session_id, phone_number, last_message, last_activity, status)
        VALUES ('default', ?, ?, NOW(), 'active')
        ON DUPLICATE KEY UPDATE 
          last_message = VALUES(last_message),
          last_activity = NOW(),
          status = 'active'
      `, [phone, userMessage]);

    } finally {
      connection.release();
    }
  } catch (error) {
    aiLogger.error({ phone, error }, 'Error saving message to database');
  }
}

// ============================================================================
// UTILIDADES PÚBLICAS
// ============================================================================

/**
 * Resetear conversación de un usuario
 */
export function resetConversation(phone: string): void {
  const deleted = conversationCache.delete(phone);
  aiLogger.info({ phone, deleted }, 'Conversation reset');
}

/**
 * Obtener estadísticas del cache de conversaciones
 */
export function getCacheStats(): {
  activeConversations: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  expiringWithin5Min: number;
} {
  const now = Date.now();
  const fiveMinutesFromNow = now + 5 * 60 * 1000;

  let oldestCreated = Infinity;
  let newestCreated = 0;
  let expiringWithin5Min = 0;

  conversationCache.forEach((entry) => {
    if (entry.context.createdAt < oldestCreated) {
      oldestCreated = entry.context.createdAt;
    }
    if (entry.context.createdAt > newestCreated) {
      newestCreated = entry.context.createdAt;
    }
    if (entry.expiresAt <= fiveMinutesFromNow) {
      expiringWithin5Min++;
    }
  });

  return {
    activeConversations: conversationCache.size,
    oldestEntry: oldestCreated !== Infinity ? new Date(oldestCreated) : null,
    newestEntry: newestCreated !== 0 ? new Date(newestCreated) : null,
    expiringWithin5Min
  };
}

/**
 * Obtener estadísticas del servicio
 */
export function getServiceStats(): {
  activeConversations: number;
  aiProvider: string;
  aiModel: string;
  cacheStats: ReturnType<typeof getCacheStats>;
} {
  const aiConfig = getAIConfig();
  return {
    activeConversations: conversationCache.size,
    aiProvider: aiConfig.provider,
    aiModel: aiConfig.model,
    cacheStats: getCacheStats()
  };
}

/**
 * Verificar si el servicio está configurado
 */
export function isConfigured(): boolean {
  const aiConfig = getAIConfig();
  return !!aiConfig.apiKey;
}

/**
 * Verificar si LangGraph está activo
 */
export function isLangGraphEnabled(): boolean {
  return USE_LANGGRAPH && LangGraphAgent !== null;
}

/**
 * Obtener estadísticas de LangGraph
 */
export function getLangGraphStats() {
  if (LangGraphAgent) {
    return LangGraphAgent.getAgentStats();
  }
  return null;
}

// ============================================================================
// LIMPIEZA PERIÓDICA DE CONTEXTOS DE PERSONALIDAD
// ============================================================================
const _personalityCleanupTimer = setInterval(() => {
  try {
    personalityManager.cleanupInactiveContexts(60);
  } catch (_) { /* silenciar errores de limpieza */ }
}, 10 * 60 * 1000); // cada 10 minutos
_personalityCleanupTimer.unref(); // No bloquear cierre del proceso

export default {
  processMessage,
  processWhatsAppMessage,
  resetConversation,
  getServiceStats,
  getCacheStats,
  isConfigured,
  isLangGraphEnabled,
  getLangGraphStats
};
