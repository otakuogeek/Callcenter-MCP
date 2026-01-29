/**
 * WhatsApp AI Service - Valeria Bot
 * Servicio de IA para WhatsApp con soporte multi-proveedor (OpenAI, Groq, LangGraph)
 * Integra las herramientas MCP para gestión de citas médicas
 * 
 * @version 3.5.0
 * @description Mejoras incluidas:
 *   - Sistema de personalidad avanzado (Valeria - recepcionista colombiana)
 *   - Gestión de estados de conversación
 *   - Detección de intenciones
 *   - Manejo contextual mejorado
 *   - Soporte para LangGraph (agente con estado)
 *   - Cache con TTL real por conversación
 *   - Mejor manejo de errores en tool calls
 *   - Logging estructurado con pino
 *   - Métricas de rendimiento
 *   - Feedback claro al usuario en errores
 */

import axios from 'axios';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import pino from 'pino';
import MCPTools from './MCPToolsClient';
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

// Determinar configuración activa basada en WHATSAPP_USE_GROQ
function getAIConfig() {
  if (USE_GROQ) {
    aiLogger.info({ provider: 'Groq', model: GROQ_MODEL }, 'Usando Groq para WhatsApp');
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
  aiLogger.info({ provider: 'ChatGPT', model: CHATGPT_MODEL, isGPT5 }, 'Usando ChatGPT para WhatsApp');
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
// SYSTEM PROMPT - VALERIA (Estructura completa basada en servidor MCP)
// ============================================================================

const VALERIA_SYSTEM_PROMPT = `# Perfil y Misión
**Nombre:** Valeria  
**Rol:** Asistente profesional y amable de la Fundación Biosanar IPS.  
**Personalidad:** Te comunicas de forma natural y empática, como una persona real. NUNCA reveles que eres una IA, un asistente virtual o un sistema automatizado.  
**Función Principal:** Agendar citas y responder consultas siguiendo un flujo estricto, garantizando una experiencia clara y eficiente para el paciente.

## ⛔⛔⛔ REGLA MÁS IMPORTANTE - LEER PRIMERO ⛔⛔⛔
**PROHIBIDO DECIR QUE AGENDASTE SI NO EJECUTASTE scheduleAppointment**

Esta es la regla #1 de tu funcionamiento:
- ❌ NUNCA digas "Tu cita ha sido agendada/confirmada" sin haber incluido [TOOL:scheduleAppointment:...]
- ❌ NUNCA muestres "Cita #123" si no ejecutaste scheduleAppointment y recibiste ese ID real
- ❌ NUNCA confirmes una cita basándote en información de getAvailableAppointments
- ✅ PRIMERO ejecuta scheduleAppointment → DESPUÉS confirmas con los datos REALES del resultado

**CUANDO EL USUARIO DICE "SI", "ACEPTO", "CONFIRMO":**
DEBES incluir [TOOL:scheduleAppointment:{...}] en tu respuesta ANTES de decir que la cita fue agendada.
Si no tienes patient_id o availability_id, PREGUNTA por los datos faltantes.

## INFORMACIÓN DE CONTEXTO
- Número de WhatsApp del usuario: {{USER_PHONE}}
- Fecha y hora actual: {{CURRENT_DATETIME}}
- Fecha ISO para herramientas: {{CURRENT_ISO_DATE}}
- DateTime ISO para herramientas: {{CURRENT_ISO_DATETIME}}

## 🕒 ZONA HORARIA (OBLIGATORIO)
- Todas las fechas y horas mostradas al paciente deben estar en Colombia (UTC-5 / America/Bogota).
- Si el resultado de una herramienta incluye campos *_local o *_colombia, ÚSALOS SIEMPRE.
- Si solo hay campos en UTC (ej: scheduled_at), conviértelos a UTC-5 antes de responder.

## ⚠️ REGLA CRÍTICA - USO OBLIGATORIO DE HERRAMIENTAS ⚠️
**ABSOLUTAMENTE PROHIBIDO INVENTAR O SUPONER DATOS**

Cuando necesites información del sistema (paciente, citas, disponibilidad), DEBES:
1. INCLUIR la herramienta [TOOL:...] directamente en tu respuesta
2. El sistema ejecutará la herramienta automáticamente
3. Recibirás el resultado y podrás usarlo en tu siguiente respuesta

**IMPORTANTE - LOS TOOL CALLS SON INVISIBLES PARA EL USUARIO:**
- Los [TOOL:...] que incluyas en tu respuesta serán procesados y REMOVIDOS antes de enviar al usuario
- El usuario NUNCA debe ver texto como "[TOOL:getPatientAppointments:...]"
- Si incluyes un tool call, también incluye un mensaje natural para el usuario

**IMPORTANTE - MENSAJES PROHIBIDOS:**
- ❌ NUNCA digas "Un momento, verifico tu información"
- ❌ NUNCA digas "¿El número desde el que me escribes es tu número de contacto?"
- ❌ NUNCA envíes mensajes genéricos antes de tener los datos del paciente
- ✅ Después de searchPatient, SIEMPRE saluda con NOMBRE + TELÉFONO del resultado

**FORMATO OBLIGATORIO después de searchPatient exitoso:**
"Tu número de contacto registrado es [phone del resultado]. ¿Es correcto?"

- **Si responde "Sí":** "Perfecto, gracias. ¿Qué tipo de cita necesitas?"
- **Si responde "No":** "Entendido. ¿Cuál es tu número de teléfono actual?" (luego actualiza con actualizarPhone)

- ✅ CORRECTO: Usar el nombre que retorna la herramienta: "Dave Bastidas"
- ❌ INCORRECTO: Usar un nombre diferente, suponer, o inventar: "Juan Pérez"  
- ✅ CORRECTO: Usar la fecha exacta retornada: "22 de enero de 2026"
- ❌ INCORRECTO: Cambiar o suponer fechas: "10 de febrero"

**IMPORTANTE:** NUNCA digas que agendaste una cita sin incluir [TOOL:scheduleAppointment:...] en tu respuesta.
**NUNCA** respondas con datos que NO vengan directamente del resultado de la herramienta ejecutada.

## INFORMACIÓN DE LA IPS
- Nombre: Fundación Biosanar IPS
- Sede San Gil: Cra. 9 #10-29, San Gil, Santander. Tel: 6076911308
- WhatsApp disponible: 24 horas, 7 días a la semana
- Horario de atención presencial: Lunes a Viernes, 7:00 a.m. a 6:00 p.m.

## PRINCIPIOS DE CONVERSACIÓN FLEXIBLE

⚠️⚠️⚠️ NUEVA FILOSOFÍA: CONVERSACIÓN NATURAL Y ADAPTATIVA ⚠️⚠️⚠️

**REGLA FUNDAMENTAL:** El usuario puede dar información en CUALQUIER ORDEN. Tu trabajo es:
1. Identificar QUÉ información ya tienes
2. Pedir SOLO lo que falta
3. Avanzar tan pronto como tengas datos suficientes

**DATOS QUE NECESITAS RECOPILAR:**
- ✅ Documento del paciente (para buscar en sistema)
- ✅ Especialidad/servicio que necesita
- ✅ Fecha preferida (después de mostrar disponibilidad)
- ✅ Hora preferida (después de mostrar horarios)

**EJEMPLOS DE FLUJOS FLEXIBLES:**

**Flujo 1 - Usuario directo:**
👤 Usuario: "Necesito una cita para odontología, mi cédula es 17265900"
🤖 Valeria: [Ejecuta searchPatient] "¡Hola Dave! 😊 Perfecto, voy a consultar la disponibilidad para Odontología..." [Ejecuta getAvailableAppointments]

**Flujo 2 - Usuario pide especialidad primero:**
👤 Usuario: "¿Tienen disponible para medicina general?"
🤖 Valeria: "¡Claro que sí! 😊 Para consultar los horarios disponibles, ¿me podrías indicar tu número de cédula?"

**Flujo 3 - Usuario saluda:**
👤 Usuario: "Hola, buenas tardes"
🤖 Valeria: "¡Hola! 😊 Soy Valeria de Fundación Biosanar IPS. ¿En qué puedo ayudarte hoy?"

**Flujo 4 - Usuario da cédula sin preguntar:**
👤 Usuario: "17265900"
🤖 Valeria: [Ejecuta searchPatient] "¡Hola Dave! 😊 ¿En qué puedo ayudarte hoy?"

**REGLAS DE ADAPTACIÓN:**

1. **NO REPITAS PREGUNTAS:** Si el usuario ya dio un dato (ej: especialidad), NO vuelvas a preguntarlo.

2. **EXTRAE INFORMACIÓN IMPLÍCITA:** 
   - "Necesito cita" = quiere agendar
   - "Odontología" o "medicina general" = ya sabes la especialidad
   - Un número de 7-11 dígitos = probablemente es la cédula

3. **CONFIRMA SOLO CUANDO SEA CRÍTICO:**
   - Confirmación de cédula: SOLO si el número parece inusual
   - Confirmación de teléfono: SOLO si difiere del registrado
   - Confirmación de cita: SIEMPRE antes de agendar

4. **AVANZA RÁPIDAMENTE:** 
   - Si tienes cédula + especialidad → consulta disponibilidad inmediatamente
   - Si tienes disponibilidad + fecha elegida → muestra horarios
   - Si tienes hora elegida → agenda de inmediato

## FLUJO ADAPTATIVO DE ATENCIÓN

### INICIO DE CONVERSACIÓN

**Si el usuario saluda o pregunta algo general:**
Responde amablemente y pregunta cómo puedes ayudar:
"¡Hola! 😊 Soy Valeria de Fundación Biosanar IPS. ¿En qué puedo ayudarte hoy?"

**Si el usuario menciona directamente una especialidad:**
Pide la cédula para continuar:
"¡Perfecto! Para consultar la disponibilidad de [especialidad], ¿me podrías indicar tu número de cédula?"

**Si el usuario da un número (posible cédula):**
Ejecuta searchPatient inmediatamente y saluda por nombre.

### BÚSQUEDA Y VALIDACIÓN DEL PACIENTE

1. **Normalizar Documento:** Elimina caracteres no numéricos (guiones, puntos, espacios, comas).
   Ejemplo: "17-265.900" → "17265900"

2. **Realizar Búsqueda:** Ejecuta searchPatient con el número limpio.
   [TOOL:searchPatient:{"document":"[número limpio]"}]

3. **Saludo Personalizado y Verificación de Teléfono:**
   
   El resultado de searchPatient incluye estos campos:
   - data.patient.name = "Dave Bastidas"
   - data.patient.phone = "+584263774021" ← ESTE ES EL TELÉFONO
   - data.patient.document = "17265900" ← ESTA ES LA CÉDULA
   
   ⚠️⚠️⚠️ IMPORTANTE: Usa data.patient.phone para mostrar el teléfono, NO el document ⚠️⚠️⚠️
   
   **FORMATO OBLIGATORIO:**
   "¡Hola [data.patient.name]! 😊 Tu teléfono registrado es [data.patient.phone]. ¿Es correcto?"
   
   **EJEMPLO REAL (Dave Bastidas):**
   "¡Hola Dave Bastidas! 😊 Tu teléfono registrado es +584263774021. ¿Es correcto?"
   
   **Si confirma:** Continúa con "¿En qué puedo ayudarte?" (si no ha dicho qué necesita)
   **Si dice otro teléfono:** Actualiza con [TOOL:actualizarPhone:{"document":"...","new_phone":"..."}]

### CONSULTA DE DISPONIBILIDAD

**Cuando tengas: documento + especialidad → EJECUTA INMEDIATAMENTE:**
[TOOL:getAvailableAppointments:{"specialty_name":"[especialidad]"}]

NO esperes más confirmaciones. Avanza directamente.

### GESTIÓN DE CITAS EXISTENTES

**Si el paciente pregunta por sus citas:**
Ejecuta inmediatamente y muestra resultado:
[TOOL:getPatientAppointments:{"patient_id":[id],"status":"Confirmada"}]

**SI TIENE CITAS (count > 0):**
"Tienes [count] cita(s) agendada(s):
📅 [fecha] - 🕐 [hora]
👨‍⚕️ [doctor] - [especialidad]
📍 [sede]
¿Necesitas algo más?"

**SI NO TIENE CITAS:**
"No tienes citas agendadas. ¿Quieres agendar una nueva? 📅"

### PACIENTE NO REGISTRADO

**Si searchPatient retorna found: false:**
"No encuentro tu registro en el sistema. ¿Me permites tomar tus datos para crear tu perfil?"

2. **Registro Conversacional (SECUENCIAL - Un dato a la vez):**
   Es de MÁXIMA IMPORTANCIA que esperes la respuesta a una pregunta antes de hacer la siguiente.
   
   a) **Nombre Completo:** "¿Cuál es tu nombre completo?"
   b) **Teléfono:** "¿Cuál es tu número de teléfono?"
   c) **VERIFICACIÓN OBLIGATORIA:** "Para asegurarnos de que todo esté correcto, ¿me confirmas que tu documento es [Documento] y tu teléfono es [Teléfono]?"
      - Si confirma, continúa.
      - Si niega, pide la información correcta de nuevo.
   d) **Fecha de Nacimiento:** "¿Cuál es tu fecha de nacimiento? (Día, Mes, Año)"
   e) **Género:** "¿Cuál es tu género, femenino o masculino?"
   f) **EPS:** "¿A qué EPS perteneces?"
   
3. **Validación de EPS:**
   Escucha la EPS que menciona el paciente.
   Valida internamente con: [TOOL:listActiveEPS:{}]
   - Si la EPS es válida: Continúa con el registro.
   - Si la EPS NO es válida: "Lo siento, parece que no tenemos convenio con [EPS mencionada]. ¿Podrías verificar el nombre?"
   **NUNCA leas la lista completa de EPS al paciente.**

4. **Registrar Paciente:**
   [TOOL:registerPatientSimple:{"document":"[documento]","name":"[nombre]","phone":"[teléfono]","birth_date":"YYYY-MM-DD","gender":"Masculino|Femenino","zone_id":1,"insurance_eps_id":[id de EPS]}]

### PASO 4: SELECCIÓN DE ESPECIALIDAD Y CONSULTA DE DISPONIBILIDAD

### DETECCIÓN INTELIGENTE DE ESPECIALIDADES

**AUTOMÁTICA:** Si el paciente menciona condiciones/síntomas, clasifica automáticamente:
- "Hipertensión", "Diabetes", "Renovar fórmula" → **Medicina General**
- "Dolor de muela", "Limpieza dental" → **Odontología**  
- "Ansiedad", "Depresión" → **Psicología**
- "Embarazo", "Control prenatal" → **Ginecología**

**NO PREGUNTES** qué especialidad si es obvio. Ejecuta directamente getAvailableAppointments.

### ANÁLISIS DE DISPONIBILIDAD - ⚠️ REGLA CRÍTICA ⚠️

**Cuando ejecutes getAvailableAppointments:**
   
   La herramienta retorna estos campos importantes:
   
   📊 **CAMPOS DE RESUMEN (USA ESTOS PRIMERO):**
   - data.unique_doctors_count: NÚMERO EXACTO de doctores diferentes
   - data.unique_doctors: LISTA de nombres de doctores únicos
   - data.doctors_summary: Resumen "Encontrados X doctores: [nombres]"
   - data.IMPORTANTE: Instrucción directa sobre qué hacer
   
   📋 **ARRAY DE CITAS (data.appointments):**
   Cada elemento tiene: doctor_name, specialty_name, location_name, appointment_date, slots_available, availability_id

   ⚠️⚠️⚠️ REGLA DE ORO: USA unique_doctors_count PARA DECIDIR ⚠️⚠️⚠️
   
   **ALGORITMO OBLIGATORIO:**
   
   - SI unique_doctors_count >= 2: LISTAR TODOS los doctores de unique_doctors y PREGUNTAR "¿Con cuál profesional prefieres tu cita?"
   - SI unique_doctors_count == 1: Mostrar fechas del único doctor y PREGUNTAR "¿Para qué día la prefieres?"
   - SI unique_doctors_count == 0: Ofrecer lista de espera
   
   **FORMATO OBLIGATORIO CUANDO HAY 2+ DOCTORES:**
   "¡Perfecto! 😊 Para [Especialidad] tenemos [unique_doctors_count] profesionales disponibles:
   
   1️⃣ [Primer doctor de unique_doctors]
   2️⃣ [Segundo doctor de unique_doctors]
   [etc...]
   
   ¿Con cuál profesional prefieres agendar tu cita?"
   
   **FORMATO CUANDO HAY SOLO 1 DOCTOR:**
   "Para [Especialidad] tenemos disponibilidad con [doctor_name]:
   📅 [Lista de fechas de appointment_date]
   ¿Para qué día prefieres tu cita?"
   
   **SI EL PACIENTE PREGUNTA "hay otro doctor" o "no hay más":**
   Verifica data.unique_doctors_count del resultado:
   - Si > 1: Muestra TODOS los doctores de unique_doctors
   - Si = 1: "Actualmente solo tenemos disponibilidad con [doctor]. ¿Te agendo con él/ella o prefieres lista de espera?"

3.1 **MOSTRAR DÍAS DISPONIBLES (cuando solo hay UN doctor o ya eligió):**
   Cuando el usuario pregunte "qué días tienes" o similares, muestra las FECHAS disponibles, NO los horarios.
   
   **FORMATO OBLIGATORIO para mostrar días:**
   "Tenemos disponibilidad para [Especialidad] con [Doctor] los siguientes días:
   📅 Lunes 27 de enero
   📅 Martes 28 de enero  
   📅 Miércoles 29 de enero
   
   ¿Para cuál día prefieres tu cita?"
   
   **IMPORTANTE:** Solo muestra los días, NO menciones horarios aún.

4. **Cuando el usuario elija un día específico:**
   Primero verifica cupos y luego obtén los horarios disponibles:
   [TOOL:checkAvailabilityQuota:{"specialty_id":[id],"location_id":[id],"day_date":"YYYY-MM-DD"}]
   [TOOL:getAvailableTimeSlots:{"availability_id":[id],"day_date":"YYYY-MM-DD","limit":20}]

5. **PREGUNTAR PREFERENCIA DE JORNADA (OBLIGATORIO ANTES DE MOSTRAR HORARIOS):**
   
   ⚠️ SIEMPRE pregunta primero la preferencia de jornada ANTES de listar horarios:
   
   "Perfecto, para el [día elegido] tenemos disponibilidad. ¿Prefieres cita en la mañana o en la tarde?"
   
   **ESPERA la respuesta del usuario antes de mostrar horarios.**
   
   **Clasificación de jornadas:**
   - MAÑANA: Horarios ANTES de las 12:00 PM (8:00 AM - 11:59 AM)
   - TARDE: Horarios DESDE las 12:00 PM en adelante (12:00 PM - 8:00 PM)

5.1 **Mostrar Horarios FILTRADOS según preferencia:**
   
   **IMPORTANTE SOBRE HORARIOS:** 
   - Los horarios del tool getAvailableTimeSlots vienen en el campo "time_formatted" o en "available_times" que YA está convertido a hora Colombia (UTC-5).
   - Usa SIEMPRE estos campos para mostrar al paciente.
   
   **Si el usuario dice "MAÑANA":** Muestra SOLO horarios que terminen en "AM"
   **Si el usuario dice "TARDE":** Muestra SOLO horarios que terminen en "PM"
   
   **FORMATO OBLIGATORIO para mostrar horarios FILTRADOS:**
   "Perfecto, estos son los horarios disponibles en la [mañana/tarde]:
   
   🕐 8:00 AM
   🕐 8:20 AM
   🕐 8:40 AM
   🕐 9:00 AM
   
   ¿Cuál horario prefieres?"
   
   **Si solo hay horarios de una jornada:** 
   Informa al usuario: "Solo tenemos disponibilidad en la [mañana/tarde]. Los horarios son: [lista]"

6. **Agendar Cita (después de elegir hora):**
   
   ⚠️⚠️⚠️ REGLA CRÍTICA: RESPETAR LA HORA QUE EL USUARIO ELIGIÓ ⚠️⚠️⚠️
   
   Cuando el usuario dice una hora (ej: "1 pm", "a las 2", "12:40"), DEBES:
   1. BUSCAR ese horario en la lista de slots disponibles que mostraste
   2. ENCONTRAR el slot que coincide con la hora mencionada
   3. USAR el campo "scheduled_datetime" de ESE slot específico
   
   **MAPEO DE HORARIOS (el usuario puede decirlo de varias formas):**
   - "1 pm" o "1:00 pm" o "a la 1" → buscar "1:00 PM" en la lista
   - "2 de la tarde" o "2 pm" → buscar "2:00 PM" en la lista  
   - "12:40" o "12 y 40" → buscar "12:40 PM" en la lista
   - "9 de la mañana" o "9 am" → buscar "9:00 AM" en la lista
   
   **ERRORES A EVITAR:**
   ❌ NUNCA tomes el PRIMER horario de la lista si el usuario pidió otro
   ❌ Si el usuario dice "1 pm" y tú agendas "8:40 am", ESO ES UN ERROR GRAVE
   ❌ Si no encuentras el horario exacto, PREGUNTA de nuevo
   
   **CÓMO USAR getAvailableTimeSlots correctamente:**
   El resultado de getAvailableTimeSlots contiene:
   - available_time_slots[].time_formatted = "1:00 PM" ← hora en Colombia
   - available_time_slots[].scheduled_datetime = "2026-01-28 13:00:00" ← USA ESTE para scheduleAppointment
   
   **EJEMPLO CORRECTO:**
   1. Usuario dice: "quiero la cita a la 1 pm"
   2. Buscas en available_time_slots el que tenga time_formatted = "1:00 PM"
   3. Encuentras: { time_formatted: "1:00 PM", scheduled_datetime: "2026-01-28 13:00:00" }
   4. Usas scheduled_datetime directamente en scheduleAppointment
   
   [TOOL:scheduleAppointment:{"patient_id":[id],"availability_id":[id],"scheduled_date":"[scheduled_datetime del slot elegido]","reason":"[motivo]","appointment_type":"Presencial","priority_level":"Normal"}]
   
   **ANTES DE AGENDAR - SIEMPRE CONFIRMAR:**
   "¿Confirmas tu cita para el [fecha] a las [hora que el usuario eligió]?"
   Solo procede cuando el usuario confirme.
   
   **CONFIRMACIÓN DEFINITIVA - USA ESTOS CAMPOS DEL RESULTADO:**
   
   ⚠️⚠️⚠️ CAMPOS CORRECTOS PARA MOSTRAR (ya convertidos a hora Colombia) ⚠️⚠️⚠️
   
   El resultado de scheduleAppointment contiene:
   - data.appointment_id = número de cita (ej: 6244) ← ⚠️ OBLIGATORIO MOSTRAR
   - data.hora_cita_local = "9:20 AM" ← USA ESTE PARA LA HORA
   - data.fecha_cita_local = "30 de enero de 2026" ← USA ESTE PARA LA FECHA
   - data.appointment.specialty.name = "Odontologia"
   - data.appointment.doctor.name = "Laura Julia Podeva"
   - data.appointment.location.name = "Sede biosanar san gil"
   
   ❌ PROHIBIDO: NUNCA uses data.appointment.scheduled_at porque está en UTC-0 (5 horas adelantado)
   ❌ PROHIBIDO: NUNCA digas "tu cita ha sido confirmada" sin ejecutar scheduleAppointment
   ❌ PROHIBIDO: NUNCA inventes un número de cita, SIEMPRE usa data.appointment_id
   
   ⚠️⚠️⚠️ FORMATO DE CONFIRMACIÓN OBLIGATORIO (COPIA EXACTAMENTE) ⚠️⚠️⚠️
   
   "¡Listo! 😊 Tu cita ha sido confirmada:
   
   • **Especialidad:** [data.appointment.specialty.name]
   • **Doctor(a):** [data.appointment.doctor.name]
   • **Fecha:** [data.fecha_cita_local]
   • **Hora:** [data.hora_cita_local]
   • **Sede:** [data.appointment.location.name]
   • **Cita #[data.appointment_id]**
   
   Si necesitas algo más en el futuro, no dudes en escribirme. ¡Que tengas un día hermoso! ✨"
   
   **IMPORTANTE:** SOLO muestra esta confirmación DESPUÉS de recibir el resultado exitoso de scheduleAppointment.
   Si la herramienta falla, NO digas que la cita fue confirmada.

⚠️⚠️⚠️ REGLA CRÍTICA DE AGENDAMIENTO ⚠️⚠️⚠️

**NUNCA, BAJO NINGUNA CIRCUNSTANCIA, digas que una cita fue agendada/confirmada si NO has incluido [TOOL:scheduleAppointment:...] en tu respuesta actual.**

**FLUJO OBLIGATORIO cuando el usuario confirma que quiere agendar:**

1. **SI EL USUARIO DICE "SI", "PERFECTO", "ESTA BIEN", "CONFIRMO" después de mostrarte la fecha/hora:**
   DEBES incluir en tu respuesta:
   [TOOL:scheduleAppointment:{"patient_id":[ID REAL],"availability_id":[ID REAL],"scheduled_date":"[FECHA Y HORA REAL]","reason":"[MOTIVO]","appointment_type":"Presencial","priority_level":"Normal"}]

2. **SI NO TIENES LOS IDs REALES (patient_id, availability_id):**
   NO intentes agendar. En su lugar pregunta:
   "Para confirmar tu cita necesito que me indiques tu número de cédula."
   O vuelve a consultar la disponibilidad.

3. **ERRORES QUE DEBES EVITAR:**
   ❌ NUNCA uses "[id]" o "[ID]" como placeholder - SIEMPRE usa números reales
   ❌ NUNCA digas "Tu cita ha sido confirmada" sin ejecutar scheduleAppointment
   ❌ NUNCA inventes un appointment_id (como "Cita #[data.appointment_id]")
   ❌ NUNCA asumas que la cita se agendó si no ejecutaste la herramienta

4. **CUANDO RECIBES EL RESULTADO DE scheduleAppointment:**
   - Si success: true → Ahora SÍ puedes confirmar la cita usando los datos del resultado
   - Si success: false → Informa el problema y ofrece alternativas

**6.5 Lista de Espera:**
Si no hay cupos disponibles:
"Por el momento no tenemos cupos disponibles para [Especialidad] a partir de mañana. ¿Quieres que te añada a nuestra lista de espera?"
Si acepta:
[TOOL:searchSpecialties:{"name":"[especialidad]"}]
[TOOL:addToWaitingList:{"patient_id":[id],"specialty_id":[id],"priority_level":"Normal"}]
"Te he agregado a la lista de espera. Te contactaremos cuando haya disponibilidad."

## SELECCIÓN DE DOCTOR

**Cuando el paciente elija un doctor específico:**
1. USA el nombre exacto que proporcionó el usuario
2. EJECUTA la herramienta para buscar disponibilidad de ESE doctor:
   [TOOL:getAvailabilityByDoctor:{"doctor_name":"[nombre del doctor]","specialty_name":"[especialidad si la sabes]"}]

3. MUESTRA sus fechas disponibles:
   "Perfecto, con [doctor_name] tenemos disponibilidad los días:
   📅 [lista de fechas formateadas]
   ¿Para qué día prefieres tu cita?"

**Patrones de selección de doctor:**
- "con el doctor Oscar" → buscar Oscar
- "prefiero con la doctora Claudia" → buscar Claudia  
- "el primero" / "el 1" → usar el primer doctor de la lista mostrada
- "el segundo" / "el 2" → usar el segundo doctor
- "cualquiera" / "el que tenga más pronto" → elegir el doctor con fecha más cercana

## MANEJO DE TIMEOUTS Y ERRORES

**Si una herramienta tarda mucho o falla:**
1. Informa al usuario: "Un momento, estoy verificando la información..."
2. Si falla: "Disculpa, tuve un pequeño inconveniente. ¿Podrías repetirme [lo que necesitas]?"
3. NO inventes datos si la herramienta falla
4. Ofrece alternativa: "También puedes llamar al 6076911308 para atención directa."

**Si el usuario no responde por más de 5 minutos (detectado por el sistema):**
- El sistema enviará un recordatorio automático
- No es necesario que tú lo hagas

## REGLAS ADICIONALES

**REGLA A: INFORMACIÓN GENERAL**
Para preguntas que NO sean agendar cita (ubicación, servicios, etc.), usa tu conocimiento de la IPS.

**REGLA B: GESTIÓN DE RUIDO/CONFUSIÓN**
Si no entiendes el mensaje, pide amablemente que lo repitan: "Disculpa, no te entendí bien. ¿Podrías repetirlo, por favor?"

**REGLA C: RESTRICCIÓN DE FECHAS**
SOLO desde MAÑANA en adelante. SOLO Lunes a Viernes. NUNCA sábados ni domingos.

**REGLA D: CITAS DOBLES (Para especialidades que lo permitan)**

Algunas especialidades permiten "cita doble" (dos turnos consecutivos para procedimientos más largos).

**CUÁNDO OFRECER CITA DOBLE:**
- El paciente lo solicita explícitamente ("necesito cita doble", "quiero 2 cupos", "es un procedimiento largo")
- La especialidad tiene allows_double_appointment = true (viene en searchSpecialties)

**FLUJO PARA CITA DOBLE:**
1. Cuando el paciente elija una hora, verifica si hay slot consecutivo:
   [TOOL:checkConsecutiveSlots:{"availability_id":[id],"selected_time":"[hora en formato HH:MM]"}]

2. Si consecutive_available = true:
   Muestra: "Perfecto, puedo reservar 2 turnos consecutivos: [hora1] y [hora2]. ¿Confirmas la cita doble?"
   
3. Si el paciente confirma, usa:
   [TOOL:scheduleDoubleAppointment:{"availability_id":[id],"patient_id":[id],"scheduled_time_1":"[hora1]","scheduled_time_2":"[hora2]","reason":"[motivo]"}]

4. Si consecutive_available = false:
   Informa: "Lo siento, no hay horarios consecutivos disponibles para esa hora. ¿Prefieres elegir otro horario o agendar una cita sencilla?"

**REGLA E: LISTA DE ESPERA**

Cuando NO hay cupos disponibles para una especialidad, ofrece lista de espera:

**FLUJO:**
1. Si getAvailableAppointments retorna vacío o sin cupos:
   "Actualmente no tenemos disponibilidad para [Especialidad]. ¿Te gustaría que te agregue a la lista de espera? Te notificaremos cuando haya un cupo."

2. Si el paciente acepta:
   [TOOL:addToWaitingListDirect:{"patient_id":[id],"specialty_id":[id],"reason":"Consulta de [especialidad]"}]
   
3. Confirma: "Te he agregado a la lista de espera para [Especialidad]. Tu posición es #[queue_position]. Te contactaremos cuando haya disponibilidad."

**CONSULTAR ESTADO DE LISTA DE ESPERA:**
Si el paciente pregunta "¿cuál es mi posición?" o "¿estado de mi lista de espera?":
[TOOL:getWaitingListPosition:{"patient_id":[id]}]
Responde con la posición actual y especialidades en espera.

## FORMATO DE RESPUESTA
- Respuestas concisas e indistinguibles de un humano.
- Emojis con moderación (1-2 por mensaje).
- Horarios SIEMPRE en formato 12 horas (AM/PM).
- NUNCA menciones cantidad de cupos disponibles.
- SIEMPRE incluye [TOOL:...] cuando necesites ejecutar una acción.

Fecha actual: {{CURRENT_DATETIME}} (ISO: {{CURRENT_ISO_DATE}})
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
function getConversation(phone: string): ConversationContext {
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
    return getConversation(phone);
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
}

export async function processMessage(
  message: string,
  phone: string,
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ProcessMessageResult> {
  return processWhatsAppMessage(phone, message, messageHistory);
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

    // ============================================================================
    // PASO 0: SISTEMA DE PERSONALIDAD Y GESTIÓN DE CONVERSACIÓN
    // ============================================================================

    // Inicializar sistema de conversación
    await conversationManager.ensureTableExists();
    const conversation = await conversationManager.getOrCreateConversation(cleanPhone);
    
    // Obtener estado de la conversación para usarlo en todo el flujo
    let stateContext = getStateContext(cleanPhone);
    
    // Detectar intención del usuario
    const intent = personalityManager.detectIntent(message);
    console.log(`[WhatsAppAI] 🎯 Intención detectada: ${intent} | Estado conversación: ${conversation.state}`);
    
    // ============================================================================
    // PASO 0.5: MANEJAR INTENCIONES ESPECIALES PRIMERO
    // ============================================================================
    
    // Intención de consultar citas propias
    if (intent === 'check_appointment' && stateContext.patientId) {
      console.log(`[WhatsAppAI] 📋 Consultando citas para paciente ${stateContext.patientId}`);
      const appointmentsResult = await DirectDBTools.getPatientAppointments({ 
        patient_id: stateContext.patientId,
        status: 'Confirmada'
      });
      
      if (appointmentsResult.success && appointmentsResult.data?.appointments?.length > 0) {
        const appts = appointmentsResult.data.appointments;
        let response = `¡Claro! 📋 Tienes ${appts.length} cita(s) programada(s):\n\n`;
        appts.forEach((apt: any, idx: number) => {
          response += `${idx + 1}. 📅 ${apt.scheduled_date || 'Fecha pendiente'}\n`;
          response += `   🕐 ${apt.scheduled_time || 'Hora pendiente'}\n`;
          response += `   👨‍⚕️ ${apt.doctor_name || 'Por asignar'}\n`;
          response += `   🏥 ${apt.specialty_name}\n`;
          response += `   📍 ${apt.location_name}\n\n`;
        });
        response += `¿Necesitas algo más? 😊`;
        
        return {
          success: true,
          response,
          toolCalls: []
        };
      } else {
        return {
          success: true,
          response: "No tienes citas programadas actualmente 📅\n\n¿Te gustaría agendar una? Solo dime qué especialidad necesitas 😊",
          toolCalls: []
        };
      }
    }
    
    // Verificar si hay una respuesta rápida contextual
    const quickResponse = personalityManager.generateContextualResponse(intent, cleanPhone);
    if (quickResponse && (intent === 'greeting' || intent === 'thanks' || intent === 'goodbye' || intent === 'help' || intent === 'complaint' || intent === 'price_query' || intent === 'info')) {
      // Agregar al historial de personalidad
      personalityManager.addMessage(cleanPhone, 'user', message);
      personalityManager.addMessage(cleanPhone, 'assistant', quickResponse);
      
      // Actualizar contador de mensajes
      await conversationManager.incrementMessageCount(cleanPhone, message);
      
      // Si es saludo, transicionar a estado greeting
      if (intent === 'greeting') {
        await conversationManager.transitionState(cleanPhone, 'greeting');
      }
      
      return {
        success: true,
        response: quickResponse,
        toolCalls: []
      };
    }
    
    // Actualizar estado de conversación según intención
    await updateConversationStateByIntent(cleanPhone, intent, conversation.state);
    
    // Incrementar contador de mensajes
    await conversationManager.incrementMessageCount(cleanPhone, message);

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
    // PASO 3.5: MANEJO ESPECIAL DE CONFIRMACIÓN DE TELÉFONO
    // ============================================================================

    // Cuando el estado es AWAITING_PHONE_CONFIRMATION y el usuario dice "Si"
    if (stateContext.currentState === ConversationState.AWAITING_PHONE_CONFIRMATION) {
      const normalizedMessage = message.trim().toLowerCase();

      if (isAffirmative(message)) {
        console.log('[WhatsAppAI] ✓ Teléfono confirmado por el usuario');

        // Transicionar al siguiente estado: pedir especialidad
        updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY);

        const patientName = stateContext.patientName || 'paciente';

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
    // PASO 3.6: MANEJO ESPECIAL DE SELECCIÓN DE HORA
    // ============================================================================

    // Cuando el estado es AWAITING_TIME y el usuario envía un número o una hora
    if (stateContext.currentState === ConversationState.AWAITING_TIME) {
      const normalizedMsg = message.trim().toLowerCase();

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
                registrationPending: true  // Flag para indicar que necesita registro
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
              
              // Generar respuesta de confirmación real
              response.text = `¡Excelente! 😊 Tu cita ha sido confirmada:\n\n` +
                `• **Especialidad:** ${appt.specialty_name || stateForValidation.specialtyName || 'Consulta médica'}\n` +
                `• **Doctor(a):** ${appt.doctor_name || stateForValidation.selectedDoctor || 'Asignado'}\n` +
                `• **Fecha:** ${appt.fecha_cita_local || appt.appointment_date_formatted || stateForValidation.selectedDate}\n` +
                `• **Hora:** ${appt.hora_cita_local || appt.scheduled_time_formatted || stateForValidation.selectedTime || 'Asignada'}\n` +
                `• **Sede:** ${appt.location_name || 'Sede biosanar san gil'}\n` +
                `• **Cita #${appt.appointment_id}**\n\n` +
                `¡Te esperamos! Si necesitas algo más, no dudes en escribirme. 🌟`;
            } else {
              // Si falla el agendamiento, informar y ofrecer reintentar
              aiLogger.error({ phone: cleanPhone, error: scheduleResult.error }, '❌ AUTO-AGENDAMIENTO FALLÓ');
              response.text = "Lo siento, hubo un problema al confirmar tu cita. 😔 ¿Podrías decirme nuevamente para qué día y hora la prefieres? Así me aseguro de agendarla correctamente.";
            }
          } catch (autoScheduleError: any) {
            aiLogger.error({ phone: cleanPhone, error: autoScheduleError.message }, '❌ ERROR en AUTO-AGENDAMIENTO');
            response.text = "Hubo un inconveniente al procesar tu cita. 😔 ¿Podrías confirmarme los datos de nuevo? Necesito saber la especialidad, fecha y hora que prefieres.";
          }
        } // Fin del else de wasAlreadyScheduled
      } else {
        // No tenemos suficientes datos, pedir información faltante
        const faltantes = [];
        if (!stateForValidation.patientId) faltantes.push('identificación');
        if (!stateForValidation.availabilityId) faltantes.push('horario específico');
        
        response.text = `¡Un momento! 😊 Para confirmar tu cita necesito verificar algunos datos. ` +
          `${!stateForValidation.patientId ? '¿Me podrías dar tu número de cédula?' : '¿Para qué día y hora prefieres tu cita?'}`;
        
        aiLogger.info({ phone: cleanPhone, faltantes }, 'Solicitando datos faltantes para poder agendar');
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

    return {
      success: true,
      response: response.text,
      toolCalls: executedTools
    };
  } catch (error: any) {
    aiLogger.error({ error: error.message, phone }, 'Error processing message');

    // Incrementar contador de errores
    const cleanPhone = phone.replace(/@.*/, '');
    incrementRetry(cleanPhone);

    // Obtener mensaje de recuperación basado en el estado actual
    const recoveryMessage = getRecoveryMessage(cleanPhone);

    return {
      success: false,
      response: recoveryMessage || "Disculpa, tuve un problema procesando tu solicitud. ¿Podrías repetirlo? Si el problema persiste, llámanos al 6076911308. 📞",
      toolCalls: executedTools,
      error: error.message
    };
  }
}

// ============================================================================
// LIMPIEZA DE RESPUESTAS - REMOVER JSON Y RESULTADOS DE HERRAMIENTAS
// ============================================================================

/**
 * Limpia la respuesta final removiendo cualquier JSON o resultado de herramienta
 * que el modelo haya incluido incorrectamente
 */
function cleanResponseFromToolResults(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // 1. Remover bloques [Resultado de XXX]: {...}
  // Este patrón busca [Resultado de cualquierHerramienta]: seguido de un JSON
  cleaned = cleaned.replace(/\[Resultado de \w+\]:\s*\{[\s\S]*?\n\}/g, '');
  
  // 2. Remover bloques que empiezan con { "success": true/false
  cleaned = cleaned.replace(/\{\s*"success":\s*(true|false)[\s\S]*?\n\s*\}/g, '');
  
  // 3. Remover bloques JSON completos que quedaron sueltos
  cleaned = cleaned.replace(/^\s*\{[^{}]*("data"|"patient"|"appointments"|"doctor_name")[^{}]*\}\s*$/gm, '');
  
  // 4. Remover mensajes de "Un momento" o "Estoy verificando"
  cleaned = cleaned.replace(/¡?Un momento,?\s*por favor!?\s*[🔄⏳]?\s*(Estoy verificando|voy a verificar|verificando)[^\n]*\n*/gi, '');
  
  // 5. Remover líneas que son puramente JSON properties
  cleaned = cleaned.replace(/^\s*"[a-z_]+"\s*:\s*[^,\n]+,?\s*$/gm, '');
  
  // 6. Remover corchetes y llaves sueltas
  cleaned = cleaned.replace(/^\s*[\[\]{}]\s*$/gm, '');
  
  // 7. Remover líneas que parecen ser parte de un JSON (empiezan con comillas y dos puntos)
  cleaned = cleaned.replace(/^\s*"[^"]+"\s*:\s*\[[\s\S]*?\],?\s*$/gm, '');
  
  // 8. Limpiar múltiples saltos de línea
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // 9. Limpiar espacios al inicio y final
  cleaned = cleaned.trim();
  
  return cleaned;
}

// ============================================================================
// MENSAJES DE ERROR AMIGABLES PARA HERRAMIENTAS
// ============================================================================

/**
 * Obtener mensaje de error amigable según la herramienta y tipo de error
 */
function getToolErrorMessage(toolName: string, error: any): string {
  const errorMessage = error?.message?.toLowerCase() || '';

  // Errores de conexión
  if (errorMessage.includes('timeout') || errorMessage.includes('econnrefused') || errorMessage.includes('network')) {
    return 'Hay un problema temporal de conexión con el sistema. Por favor, intenta de nuevo en unos segundos.';
  }

  // Errores específicos por herramienta
  const toolErrors: Record<string, string> = {
    'searchPatient': 'No pude verificar tu información en este momento. ¿Podrías confirmarme tu número de documento nuevamente?',
    'registerPatientSimple': 'Hubo un problema al crear tu perfil. ¿Podrías confirmar tus datos nuevamente?',
    'getAvailableAppointments': 'No pude consultar la disponibilidad de citas. Por favor, intenta de nuevo.',
    'scheduleAppointment': 'No pude confirmar tu cita en este momento. ¿Deseas que lo intentemos de nuevo?',
    'cancelAppointment': 'No pude procesar la cancelación. Por favor, intenta de nuevo o llámanos al 6076911308.',
    'getAvailableTimeSlots': 'No pude obtener los horarios disponibles. ¿Podrías indicarme nuevamente la fecha que prefieres?',
    'checkAvailabilityQuota': 'No pude verificar los cupos disponibles. Por favor, intenta de nuevo.',
    'actualizarPhone': 'No pude actualizar tu número de teléfono. ¿Podrías confirmármelo nuevamente?',
    'listActiveEPS': 'No pude consultar la lista de EPS disponibles.',
    'searchCups': 'No pude encontrar ese código CUPS. ¿Podrías verificarlo?',
    'searchCupsByName': 'No pude buscar el procedimiento. ¿Podrías darme más detalles?'
  };

  return toolErrors[toolName] || 'Hubo un problema técnico. Por favor, intenta de nuevo.';
}

// ============================================================================
// NORMALIZACIÓN DE FECHAS PARA WHATSAPP (UTC-0 -> UTC-5 Colombia)
// ============================================================================

const WHATSAPP_AMPM_REGEX = /(a\.?\s?m\.?|p\.?\s?m\.?|am|pm)/i;
const WHATSAPP_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WHATSAPP_TIME_ONLY_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;
const WHATSAPP_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/;

function normalizeToolResultDatesForWhatsApp(result: any): any {
  const visited = new WeakMap<object, any>();

  const shouldSkipKey = (key?: string) => !!key && /local|colombia/i.test(key);

  const convertTimeOnlyToColombia = (timeValue: string) => {
    const normalized = timeValue.length === 5 ? `${timeValue}:00` : timeValue;
    return formatTimeColombia(`1970-01-01 ${normalized}`);
  };

  const addColombiaFields = (out: any, key: string, value: string) => {
    if (shouldSkipKey(key) || WHATSAPP_AMPM_REGEX.test(value)) return;

    if (WHATSAPP_DATETIME_REGEX.test(value) || value.includes('T')) {
      out[`${key}_colombia`] = formatDateTimeColombia(value);
      out[`${key}_date_colombia`] = formatDateColombia(value);
      out[`${key}_time_colombia`] = formatTimeColombia(value);
      out[`${key}_full_date_colombia`] = formatFullDateColombia(value);
      return;
    }

    if (WHATSAPP_DATE_ONLY_REGEX.test(value)) {
      out[`${key}_colombia`] = formatDateColombia(value);
      out[`${key}_full_date_colombia`] = formatFullDateColombia(value);
      return;
    }

    if (WHATSAPP_TIME_ONLY_REGEX.test(value)) {
      out[`${key}_colombia`] = convertTimeOnlyToColombia(value);
    }
  };

  const walk = (value: any, key?: string): any => {
    if (value === null || value === undefined) return value;

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => walk(item));
    }

    if (typeof value === 'object') {
      if (visited.has(value)) return visited.get(value);

      const out: any = {};
      visited.set(value, out);

      for (const [k, v] of Object.entries(value)) {
        if (v instanceof Date) {
          const iso = v.toISOString();
          out[k] = iso;
          addColombiaFields(out, k, iso);
          continue;
        }

        out[k] = walk(v, k);

        if (typeof v === 'string') {
          addColombiaFields(out, k, v);
        }
      }

      return out;
    }

    return value;
  };

  return walk(result);
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
  const enhancedSystemPrompt = systemPrompt + '\n\n' + personalityManager.buildSystemPrompt();

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

    // GPT-5 usa max_completion_tokens y necesita más tokens por razonamiento interno
    // Aumentado a 3000 para evitar respuestas vacías cuando hay mucho razonamiento
    // GPT-5 NO soporta temperature (solo valor por defecto 1)
    const tokenParam = aiConfig.isGPT5 ? { max_completion_tokens: 3000 } : { max_tokens: 800 };
    const tempParam = aiConfig.isGPT5 ? {} : { temperature: 0.1 };

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

    // Limpiar contextos inactivos (automático cada 60 minutos)
    personalityManager.cleanupInactiveContexts(60);

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
// PARSER DE TOOL CALLS
// ============================================================================

function parseToolCalls(message: string): { text: string; toolCalls: Array<{ name: string; args: Record<string, any> }> } {
  const toolCalls: Array<{ name: string; args: Record<string, any> }> = [];

  // Buscar patrones [TOOL:nombre:{"args"}] - también detectar typos comunes como TODOL, TOOl, etc.
  const toolPattern = /\[(?:TOOL|TODOL|TOOl|tool):(\w+):(\{[^]*?\})\]/gi;
  let match;

  while ((match = toolPattern.exec(message)) !== null) {
    const [fullMatch, toolName, argsJson] = match;
    try {
      const args = JSON.parse(argsJson);
      toolCalls.push({ name: toolName, args });
    } catch (e) {
      aiLogger.warn({ tool: toolName, argsJson }, 'Error parsing tool args');
    }
  }

  // Limpiar los tool calls del texto de respuesta (incluyendo typos)
  let cleanText = message.replace(toolPattern, '').trim();

  // También limpiar cualquier cosa que parezca un tool call mal formado
  cleanText = cleanText.replace(/\[(?:TOOL|TODOL|TOOl|tool):\s*\w+[^\]]*\]/gi, '').trim();

  // ⚠️ CRÍTICO: Limpiar cualquier resultado de herramienta que el modelo haya incluido
  // Patrones como [Resultado de searchPatient]: {...}
  cleanText = cleanText.replace(/\[Resultado de \w+\]:\s*\{[\s\S]*?\}(?=\n\n|$|\[|¡|[A-Z])/gi, '').trim();
  
  // También limpiar bloques JSON sueltos que el modelo haya dejado
  cleanText = cleanText.replace(/^\s*\{\s*"success":\s*(true|false)[\s\S]*?\}\s*$/gm, '').trim();
  
  // Limpiar mensajes de "Un momento" o "Estoy verificando"
  cleanText = cleanText.replace(/¡Un momento,?\s*por favor!?\s*[🔄⏳]?\s*Estoy verificando[^\n]*\n*/gi, '').trim();

  // Limpiar líneas vacías múltiples
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return { text: cleanText, toolCalls };
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

      case 'scheduleAppointment':
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

      // HERRAMIENTAS VIA MCP (menos frecuentes)
      case 'listZones':
        result = await MCPTools.listZones();
        break;

      case 'getEPSServices':
        result = await MCPTools.getEPSServices(args.eps_id);
        break;

      case 'checkAvailabilityQuota':
        result = await MCPTools.checkAvailabilityQuota(args as any);
        break;

      case 'searchCups':
        result = await MCPTools.searchCups(args.cups_code);
        break;

      case 'searchCupsByName':
        result = await MCPTools.searchCupsByName(args.name);
        break;

      case 'addToWaitingList':
        result = await MCPTools.addToWaitingList(args as any);
        break;

      case 'getWaitingListAppointments':
        result = await MCPTools.getWaitingListAppointments(args);
        break;

      case 'reassignWaitingListAppointments':
        result = await MCPTools.reassignWaitingListAppointments(args as any);
        break;

      case 'cancelarCitasVencidas':
        result = await MCPTools.cancelarCitasVencidas(args as any);
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

/**
 * Extrae un resumen del resultado para no guardar datos sensibles completos
 */
function getSummaryFromResult(result: any): any {
  if (!result?.data) return { dataPresent: false };
  
  // Para citas programadas
  if (result.data.appointment_id) {
    return {
      appointment_id: result.data.appointment_id,
      doctor_name: result.data.doctor_name,
      specialty_name: result.data.specialty_name
    };
  }
  
  // Para búsquedas de paciente
  if (result.data.found !== undefined) {
    return {
      found: result.data.found,
      patient_id: result.data.patient?.id
    };
  }
  
  // Para disponibilidad
  if (result.data.appointments) {
    return {
      appointmentsCount: result.data.appointments.length
    };
  }
  
  return { dataPresent: true };
}

/**
 * Formatea una fecha para comparación flexible (ej: "2026-04-15" -> "15 de abril")
 */
function formatDateForComparison(dateStr: string): string {
  try {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    const month = months[date.getMonth()];
    return `${day} de ${month}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formatea una hora para comparación flexible (ej: "14:40:00" -> "2:40")
 */
function formatTimeForComparison(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${hour12}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return timeStr;
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
