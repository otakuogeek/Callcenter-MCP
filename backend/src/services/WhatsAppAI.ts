/**
 * Servicio de IA para WhatsApp usando DeepSeek
 * Implementa el flujo de Valeria - Asistente de Biosanar IPS
 */

import axios from 'axios';
import { mcpClient } from './MCPClient';

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Convierte hora de formato 24h a 12h AM/PM
 * Ejemplo: "19:00" -> "7:00 p.m.", "08:30" -> "8:30 a.m."
 */
function convertTo12Hour(time24: string): string {
  if (!time24) return time24;
  
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  
  if (isNaN(hour)) return time24;
  
  const period = hour >= 12 ? 'p.m.' : 'a.m.';
  hour = hour % 12 || 12; // Convierte 0 a 12 para medianoche
  
  return `${hour}:${minute} ${period}`;
}

// =========================================================================
// PROMPT DE SISTEMA - VALERIA
// =========================================================================

const VALERIA_SYSTEM_PROMPT = `# Perfil y Misión
**Nombre:** Valeria
**Rol:** Asistente profesional y amable de la Fundación Biosanar IPS.
**Personalidad:** Se comunica de forma natural y empática, como una persona. Nunca revela que es una IA, un asistente virtual o un sistema automatizado.
**Función Principal:** Agendar citas y responder consultas, garantizando una experiencia clara y eficiente para el paciente.

## ⭐⭐⭐ REGLA DE ORO — CERO INVENCIÓN DE DATOS ⭐⭐⭐
**NUNCA, BAJO NINGUNA CIRCUNSTANCIA, inventes, supongas o imagines datos sobre:**
- Nombres de pacientes, doctores o especialistas
- Fechas, horarios o disponibilidad de citas
- Números de cita (appointment_id), posiciones en lista de espera
- Sedes, direcciones, teléfonos
- Especialidades, servicios o EPS
- Cualquier otro dato clínico o administrativo

**TODO dato que menciones DEBE provenir de:**
1. Resultado REAL de una herramienta (searchPatient, getAvailableAppointments, scheduleAppointment, etc.)
2. Información proporcionada directamente por el paciente en la conversación
3. El contexto dinámico inyectado en este prompt

**Si NO tienes datos reales:**
- NO inventes una respuesta
- Indica honestamente que no encontraste la información
- SIEMPRE redirige al paciente: "No logré encontrar esa información en nuestro sistema. Le invito a visitar nuestro portal web https://biosanarcall.site/ donde puede agendar su cita directamente, o llámenos al 607 691 1308 📞"

# Canal de Comunicación
Este es un chat de WhatsApp. Tus respuestas deben ser:
- Concisas y directas (máximo 3-4 oraciones por mensaje)
- Usar emojis moderadamente para ser amigable
- Evitar bloques de texto largos
- Usar saltos de línea para separar ideas

# Horario de Atención
- Lunes a Viernes: 7:00 AM a 6:00 PM
- Sábados: 7:00 AM a 12:00 PM
- Domingos y festivos: Cerrado

# FLUJO DE ATENCIÓN

## PASO 1: Bienvenida
Saluda cordialmente y solicita el número de documento para identificar al paciente.
Ejemplo: "¡Hola! 👋 Soy Valeria de Biosanar IPS. Para atenderte mejor, ¿me podrías indicar tu número de cédula?"

## PASO 2: Identificación del Paciente
- Si el paciente proporciona un documento, búscalo en el sistema
- Si existe: Saluda por su nombre y pregunta en qué puedes ayudarle
- Si NO existe: Ofrece registrarlo solicitando los datos necesarios

## PASO 3: Atención de Solicitudes
El paciente puede solicitar:
1. **Agendar cita**: Pregunta la especialidad, consulta disponibilidad y agenda
2. **Consultar citas**: Muestra sus citas programadas
3. **Cancelar cita**: Confirma cuál cita desea cancelar
4. **Información general**: Horarios, sedes, servicios

## PASO 4: Agendamiento de Citas
1. Preguntar qué especialidad necesita
2. Consultar disponibilidad para esa especialidad
3. Ofrecer las fechas y horarios disponibles
4. Confirmar la cita con todos los datos
5. Despedirse cordialmente

# ESPECIALIDADES COMUNES
- Medicina General (citas de control, medicamentos, fórmulas)
- Odontología
- Psicología
- Cardiología
- Ginecología
- Control prenatal

# REGLAS IMPORTANTES

1. **Verificación de teléfono**: Siempre confirma si el número de teléfono sigue siendo el mismo
2. **Una especialidad por cita**: Cada cita es para una especialidad específica
3. **Datos obligatorios para registro**: documento, nombre completo, teléfono, fecha de nacimiento, género, zona, EPS
4. **Motivos de Medicina General**: Control de hipertensión, diabetes, medicamentos crónicos = Medicina General
5. **Lista de espera**: Si no hay agenda, menciona la cantidad de personas en espera (si la herramienta lo indica) y ofrece agregar a la lista.
   - **IMPORTANTE**: Si acepta, DEBES preguntar la prioridad: "¿Considera su solicitud Urgente, Alta, Normal o Baja?" antes de confirmar.
6. **NO mencionar cupos**: NUNCA digas cuántos cupos hay disponibles (ej: "11 cupos"). Solo menciona fechas y horarios.
7. **Horarios en formato 12h**: SIEMPRE usa formato AM/PM (ej: "7:00 p.m." NO "19:00")

# FORMATO DE RESPUESTAS

Usa este formato para confirmar citas:
"✅ *Cita Confirmada*
📅 Fecha: [fecha]
🕐 Hora: [hora]  
🏥 Sede: [sede]
👨‍⚕️ Especialidad: [especialidad]
📋 Motivo: [motivo]"

Usa este formato para confirmar ingreso a LISTA DE ESPERA:
"⏳ *Añadido a Lista de Espera*
🔢 Posición: [queue_position]
🚨 Prioridad: [priority_level]
👨‍⚕️ Especialidad: [especialidad]
🆔 Referencia: [waiting_list_id]
Le notificaremos en cuanto se libere un cupo."

Para despedirte:
"¿Hay algo más en lo que pueda ayudarte? 😊"

# ERRORES COMUNES A EVITAR
- No digas "Soy una IA" o "Soy un asistente virtual"
- No envíes mensajes muy largos
- No repitas información innecesariamente
- No uses lenguaje técnico complicado`;

// =========================================================================
// INTERFACES
// =========================================================================

interface ConversationState {
  phone: string;
  step: 'greeting' | 'awaiting_document' | 'identified' | 'selecting_specialty' | 'selecting_date' | 'confirming' | 'general';
  patientId?: number;
  patientName?: string;
  patientDocument?: string;
  patientPhone?: string;
  patientEpsId?: number;
  selectedSpecialtyId?: number;
  selectedSpecialtyName?: string;
  availabilities?: any[];
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  lastActivity: Date;
}

interface AIResponse {
  text: string;
  toolCalls?: Array<{ name: string; result: any }>;
}

// =========================================================================
// GESTIÓN DE CONVERSACIONES
// =========================================================================

// Almacén de conversaciones en memoria (en producción usar Redis)
const conversations = new Map<string, ConversationState>();

// Tiempo de expiración de sesión (30 minutos)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Obtener o crear estado de conversación
 */
function getConversation(phone: string): ConversationState {
  const existing = conversations.get(phone);
  
  if (existing) {
    // Verificar si la sesión expiró
    const timeSinceLastActivity = Date.now() - existing.lastActivity.getTime();
    if (timeSinceLastActivity > SESSION_TIMEOUT_MS) {
      // Sesión expirada, crear nueva
      console.log(`[WhatsAppAI] Sesión expirada para ${phone}, creando nueva`);
    } else {
      existing.lastActivity = new Date();
      return existing;
    }
  }

  // Crear nueva conversación
  const newConversation: ConversationState = {
    phone,
    step: 'greeting',
    messages: [{
      role: 'system',
      content: VALERIA_SYSTEM_PROMPT
    }],
    lastActivity: new Date()
  };
  
  conversations.set(phone, newConversation);
  return newConversation;
}

/**
 * Limpiar conversaciones antiguas
 */
function cleanupOldConversations(): void {
  const now = Date.now();
  for (const [phone, conv] of conversations) {
    if (now - conv.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
      conversations.delete(phone);
    }
  }
}

// Limpiar cada 5 minutos
setInterval(cleanupOldConversations, 5 * 60 * 1000);

// =========================================================================
// FUNCIONES DE HERRAMIENTAS MCP
// =========================================================================

/**
 * Detectar intención del mensaje
 */
function detectIntent(message: string): string {
  const lower = message.toLowerCase();
  
  // Detectar documento (números con 6+ dígitos)
  const docMatch = message.match(/\d{6,}/);
  if (docMatch) return 'document';
  
  // Detectar solicitud de cita
  if (lower.includes('cita') || lower.includes('agendar') || lower.includes('reservar')) return 'schedule';
  
  // Detectar consulta de citas
  if (lower.includes('mis citas') || lower.includes('tengo cita') || lower.includes('consultar')) return 'check_appointments';
  
  // Detectar cancelación
  if (lower.includes('cancelar') || lower.includes('anular')) return 'cancel';
  
  // Detectar especialidades comunes
  if (lower.includes('medicina general') || lower.includes('medico general')) return 'specialty_general';
  if (lower.includes('odontolog') || lower.includes('dentista') || lower.includes('dientes')) return 'specialty_dental';
  if (lower.includes('psicolog')) return 'specialty_psychology';
  if (lower.includes('ginecolog') || lower.includes('embarazo') || lower.includes('prenatal')) return 'specialty_gynecology';
  if (lower.includes('cardiolog') || lower.includes('corazon')) return 'specialty_cardiology';
  
  // Medicamentos = Medicina General
  if (lower.includes('medicamento') || lower.includes('formula') || lower.includes('hipertens') || 
      lower.includes('diabetes') || lower.includes('control')) return 'specialty_general';
  
  // Confirmación
  if (lower === 'si' || lower === 'sí' || lower === 'ok' || lower === 'dale' || lower === 'correcto') return 'confirm';
  if (lower === 'no' || lower === 'cancelar') return 'deny';
  
  return 'general';
}

/**
 * Ejecutar herramientas MCP según el contexto
 */
async function executeMCPTools(conv: ConversationState, intent: string, message: string): Promise<string> {
  let context = '';
  
  try {
    // Si hay un documento en el mensaje, buscar paciente
    if (intent === 'document') {
      const docMatch = message.match(/\d{6,}/);
      if (docMatch) {
        const document = docMatch[0];
        const result = await mcpClient.searchPatient(document);
        
        if (result.success && result.data?.found) {
          const patient = result.data.patient;
          conv.step = 'identified';
          conv.patientId = patient.id;
          conv.patientName = patient.full_name;
          conv.patientDocument = document;
          conv.patientPhone = patient.phone;
          conv.patientEpsId = patient.insurance_eps_id;
          
          // Obtener citas activas
          const appointments = await mcpClient.getPatientAppointments(patient.id);
          
          context = `[PACIENTE ENCONTRADO]
Nombre: ${patient.full_name}
ID: ${patient.id}
Teléfono registrado: ${patient.phone}
EPS: ${patient.eps_name || 'No especificada'}
`;
          // La respuesta MCP tiene upcoming_appointments y past_appointments, no 'appointments'
          const upcomingAppts = appointments.data?.upcoming_appointments || [];
          const allAppts = [...upcomingAppts, ...(appointments.data?.past_appointments || [])];
          if (appointments.success && upcomingAppts.length > 0) {
            context += `\nCitas próximas: ${upcomingAppts.length}`;
            upcomingAppts.forEach((a: any) => {
              context += `\n- ${a.specialty?.name || a.specialty_name}: ${a.scheduled_date_display || a.scheduled_at} (${a.status})`;
            });
          }
        } else {
          context = `[PACIENTE NO ENCONTRADO]
El documento ${document} no está registrado en el sistema.
Puedes ofrecerle registrarse proporcionando: nombre completo, teléfono, fecha de nacimiento, género, zona y EPS.`;
        }
      }
    }
    
    // Si está identificado y busca especialidades
    if (conv.step === 'identified' && (intent.startsWith('specialty_') || intent === 'schedule')) {
      let specialtyName = '';
      let specialtyId: number | undefined;
      
      switch (intent) {
        case 'specialty_general':
          specialtyName = 'Medicina General';
          specialtyId = 1;
          break;
        case 'specialty_dental':
          specialtyName = 'Odontología';
          specialtyId = 5;
          break;
        case 'specialty_psychology':
          specialtyName = 'Psicología';
          specialtyId = 7;
          break;
        case 'specialty_gynecology':
          specialtyName = 'Ginecología';
          break;
        case 'specialty_cardiology':
          specialtyName = 'Cardiología';
          break;
      }
      
      if (specialtyName) {
        // Buscar disponibilidad
        const availability = await mcpClient.getAvailableAppointments({ 
          specialty_id: specialtyId,
          limit: 10 
        });
        
        if (availability.success && availability.data?.availabilities?.length > 0) {
          const avails = availability.data.availabilities;
          conv.selectedSpecialtyId = specialtyId || avails[0].specialty_id;
          conv.selectedSpecialtyName = specialtyName;
          conv.availabilities = avails;
          conv.step = 'selecting_date';
          
          context = `[DISPONIBILIDAD PARA ${specialtyName.toUpperCase()}]
Horarios disponibles:`;
          avails.slice(0, 5).forEach((a: any) => {
            // Convertir hora a formato AM/PM
            const timeFormatted = convertTo12Hour(a.start_time);
            context += `\n- ID ${a.id}: ${a.appointment_date} ${timeFormatted} en ${a.location_name} (Dr. ${a.doctor_name})`;
          });
        } else {
          context = `[SIN DISPONIBILIDAD]
No hay agenda disponible para ${specialtyName} en los próximos días.
Puedes ofrecerle agregarlo a la lista de espera.`;
        }
      }
    }
    
    // Si quiere consultar sus citas
    if (intent === 'check_appointments' && conv.patientId) {
      const appointments = await mcpClient.getPatientAppointments(conv.patientId);
      // La respuesta MCP tiene upcoming_appointments y past_appointments
      const upcomingAppts = appointments.data?.upcoming_appointments || [];
      if (appointments.success && upcomingAppts.length > 0) {
        context = `[CITAS DEL PACIENTE]`;
        upcomingAppts.forEach((a: any) => {
          context += `\n- ID ${a.id}: ${a.specialty?.name || a.specialty_name} - ${a.scheduled_date_display || a.scheduled_at} ${a.scheduled_time_display || ''} (${a.status})`;
        });
      } else {
        context = `[SIN CITAS]\nEl paciente no tiene citas programadas.`;
      }
    }
    
  } catch (error: any) {
    console.error('[WhatsAppAI] Error ejecutando MCP:', error);
    context = `[ERROR MCP]: ${error.message}`;
  }
  
  return context;
}

// =========================================================================
// LLAMADA A AI (ChatGPT, GROQ o DEEPSEEK)
// =========================================================================

/**
 * Generar respuesta con ChatGPT (OpenAI)
 * Usa WHATSAPP_CHATGPT_API_KEY y CHATGPT_MODEL cuando WHATSAPP_USE_GROQ=false
 * Soporta modelos GPT-5 que requieren max_completion_tokens
 */
async function callOpenAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  // Usar la API key específica de WhatsApp ChatGPT, o fallback a OPENAI_API_KEY
  const apiKey = process.env.WHATSAPP_CHATGPT_API_KEY || process.env.OPENAI_API_KEY;
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  const model = process.env.CHATGPT_MODEL || 'gpt-4o';
  
  if (!apiKey) {
    console.warn('[WhatsAppAI] WHATSAPP_CHATGPT_API_KEY y OPENAI_API_KEY no configuradas');
    return 'Disculpa, estoy teniendo problemas técnicos. Por favor intenta más tarde o llámanos al 6076911308. 📞';
  }
  
  // GPT-5 usa max_completion_tokens y necesita más tokens por razonamiento interno
  // GPT-5 NO soporta temperature (solo valor por defecto 1)
  const isGPT5 = model.startsWith('gpt-5');
  const tokenParam = isGPT5 ? { max_completion_tokens: 1500 } : { max_tokens: 500 };
  const tempParam = isGPT5 ? {} : { temperature: 0.7 };
  
  try {
    console.log(`[WhatsAppAI] Llamando a ChatGPT modelo: ${model} (GPT-5: ${isGPT5})`);
    const response = await axios.post(apiUrl, {
      model,
      messages,
      ...tokenParam,
      ...tempParam,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    return response.data.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';
    
  } catch (error: any) {
    console.error('[WhatsAppAI] Error llamando ChatGPT:', error.response?.data || error.message);
    return 'Disculpa, estoy teniendo problemas para responder. ¿Podrías repetir tu solicitud? 🙏';
  }
}

/**
 * Generar respuesta con DeepSeek AI
 */
async function callDeepSeek(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  
  if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
    console.warn('[WhatsAppAI] DEEPSEEK_API_KEY no configurada');
    return 'Disculpa, estoy teniendo problemas técnicos. Por favor intenta más tarde o llámanos al 6076911308. 📞';
  }
  
  try {
    const response = await axios.post(apiUrl, {
      model: process.env.WHATSAPP_AI_MODEL || 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 300,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    return response.data.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';
    
  } catch (error: any) {
    console.error('[WhatsAppAI] Error llamando DeepSeek:', error.response?.data || error.message);
    return 'Disculpa, estoy teniendo problemas para responder. ¿Podrías repetir tu solicitud? 🙏';
  }
}

/**
 * Generar respuesta con Groq AI (Llama)
 * Usa GROQ_API_KEY y GROQ_MODEL cuando WHATSAPP_USE_GROQ=true
 */
async function callGroq(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  
  if (!apiKey) {
    console.warn('[WhatsAppAI] GROQ_API_KEY no configurada');
    return 'Disculpa, estoy teniendo problemas técnicos. Por favor intenta más tarde o llámanos al 6076911308. 📞';
  }
  
  try {
    console.log(`[WhatsAppAI] Llamando a Groq modelo: ${model}`);
    const response = await axios.post(apiUrl, {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    return response.data.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';
    
  } catch (error: any) {
    console.error('[WhatsAppAI] Error llamando Groq:', error.response?.data || error.message);
    return 'Disculpa, estoy teniendo problemas para responder. ¿Podrías repetir tu solicitud? 🙏';
  }
}

/**
 * Llamar al proveedor de AI configurado
 * WHATSAPP_USE_GROQ=true  -> Usa Groq (más rápido, económico)
 * WHATSAPP_USE_GROQ=false -> Usa ChatGPT (más preciso)
 */
async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const useGroq = process.env.WHATSAPP_USE_GROQ?.toLowerCase() === 'true';
  
  if (useGroq) {
    console.log('[WhatsAppAI] WHATSAPP_USE_GROQ=true -> Usando Groq');
    return callGroq(messages);
  } else {
    console.log('[WhatsAppAI] WHATSAPP_USE_GROQ=false -> Usando ChatGPT');
    return callOpenAI(messages);
  }
}

// =========================================================================
// FUNCIÓN PRINCIPAL
// =========================================================================

/**
 * Procesar mensaje de WhatsApp y generar respuesta
 */
export async function processWhatsAppMessage(
  phone: string, 
  message: string,
  profileName?: string
): Promise<AIResponse> {
  const startTime = Date.now();
  
  try {
    // Obtener estado de conversación
    const conv = getConversation(phone);
    
    // Detectar intención
    const intent = detectIntent(message);
    console.log(`[WhatsAppAI] Procesando mensaje de ${phone}, intent: ${intent}, step: ${conv.step}`);
    
    // Ejecutar herramientas MCP si es necesario
    const mcpContext = await executeMCPTools(conv, intent, message);
    
    // Agregar contexto MCP al mensaje del usuario si hay
    let userMessage = message;
    if (mcpContext) {
      userMessage = `${message}\n\n---\nCONTEXTO DEL SISTEMA (no mostrar al usuario, usar para responder):\n${mcpContext}`;
    }
    
    // Agregar mensaje del usuario al historial
    conv.messages.push({ role: 'user', content: userMessage });
    
    // Mantener historial limitado (últimos 10 mensajes + system)
    if (conv.messages.length > 21) {
      conv.messages = [conv.messages[0], ...conv.messages.slice(-20)];
    }
    
    // Llamar a la IA (OpenAI o DeepSeek según configuración)
    const aiResponse = await callAI(conv.messages);
    
    // Guardar respuesta en historial
    conv.messages.push({ role: 'assistant', content: aiResponse });
    
    const responseTime = Date.now() - startTime;
    console.log(`[WhatsAppAI] Respuesta generada en ${responseTime}ms`);
    
    return {
      text: aiResponse,
      toolCalls: mcpContext ? [{ name: 'mcp_context', result: mcpContext }] : undefined
    };
    
  } catch (error: any) {
    console.error('[WhatsAppAI] Error procesando mensaje:', error);
    return {
      text: 'Disculpa, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo? 🙏'
    };
  }
}

/**
 * Obtener estado de una conversación (para debugging)
 */
export function getConversationState(phone: string): ConversationState | undefined {
  return conversations.get(phone);
}

/**
 * Limpiar conversación de un número
 */
export function clearConversation(phone: string): boolean {
  return conversations.delete(phone);
}

/**
 * Obtener estadísticas de conversaciones activas
 */
export function getConversationStats(): { active: number; phones: string[] } {
  return {
    active: conversations.size,
    phones: Array.from(conversations.keys())
  };
}
