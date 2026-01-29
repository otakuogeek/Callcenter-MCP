/**
 * LangGraph Agent - Valeria WhatsApp Bot
 * 
 * Agente conversacional con estado usando LangGraph para manejar
 * flujos complejos de agendamiento de citas médicas.
 * 
 * @version 1.0.0
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import pino from 'pino';
import MCPTools from './MCPToolsClient';

// ============================================================================
// LOGGER
// ============================================================================

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'langgraph-agent',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined
});

// ============================================================================
// STATE DEFINITION
// ============================================================================

// Estado de la conversación usando Annotation de LangGraph
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => []
  }),
  phoneNumber: Annotation<string>(),
  patientId: Annotation<number | null>({
    default: () => null
  }),
  patientName: Annotation<string | null>({
    default: () => null
  }),
  currentStep: Annotation<string>({
    default: () => 'greeting'
  }),
  selectedSpecialty: Annotation<string | null>({
    default: () => null
  }),
  selectedLocation: Annotation<string | null>({
    default: () => null
  }),
  selectedDate: Annotation<string | null>({
    default: () => null
  }),
  availabilityId: Annotation<number | null>({
    default: () => null
  }),
  appointmentReason: Annotation<string | null>({
    default: () => null
  }),
  lastToolResult: Annotation<string | null>({
    default: () => null
  }),
  errorCount: Annotation<number>({
    default: () => 0
  })
});

type AgentStateType = typeof AgentState.State;

// ============================================================================
// TOOLS - Herramientas MCP para el agente
// ============================================================================

// Tool: Buscar paciente por documento
const searchPatientTool = tool(
  async ({ document }: { document: string }) => {
    try {
      logger.info({ document }, 'Buscando paciente por documento');
      const result = await MCPTools.callTool('searchPatientByDocument', { document });
      return JSON.stringify(result);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error buscando paciente');
      return JSON.stringify({ error: error.message, found: false });
    }
  },
  {
    name: 'searchPatientByDocument',
    description: 'Busca un paciente en el sistema por su número de documento (cédula)',
    schema: z.object({
      document: z.string().describe('Número de documento del paciente')
    })
  }
);

// Tool: Obtener disponibilidad de citas
const getAvailabilityTool = tool(
  async ({ specialty_name, location_name, date }: { specialty_name?: string; location_name?: string; date?: string }) => {
    try {
      logger.info({ specialty_name, location_name, date }, 'Consultando disponibilidad');
      const result = await MCPTools.callTool('getAvailableAppointments', {
        specialty_name,
        location_name,
        date
      });
      return JSON.stringify(result);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error consultando disponibilidad');
      return JSON.stringify({ error: error.message, slots: [] });
    }
  },
  {
    name: 'getAvailableAppointments',
    description: 'Obtiene las citas disponibles, opcionalmente filtradas por especialidad, sede y/o fecha',
    schema: z.object({
      specialty_name: z.string().optional().describe('Nombre de la especialidad médica'),
      location_name: z.string().optional().describe('Nombre de la sede'),
      date: z.string().optional().describe('Fecha en formato YYYY-MM-DD')
    })
  }
);

// Tool: Agendar cita
const scheduleAppointmentTool = tool(
  async ({ availability_id, patient_id, reason, scheduled_date }: { 
    availability_id: number; 
    patient_id: number; 
    reason: string;
    scheduled_date: string;
  }) => {
    try {
      logger.info({ availability_id, patient_id, reason }, 'Agendando cita');
      const result = await MCPTools.callTool('scheduleAppointment', {
        availability_id,
        patient_id,
        reason,
        scheduled_date
      });
      return JSON.stringify(result);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error agendando cita');
      return JSON.stringify({ error: error.message, success: false });
    }
  },
  {
    name: 'scheduleAppointment',
    description: 'Agenda una cita médica para un paciente',
    schema: z.object({
      availability_id: z.number().describe('ID de la disponibilidad seleccionada'),
      patient_id: z.number().describe('ID del paciente'),
      reason: z.string().describe('Motivo de la consulta'),
      scheduled_date: z.string().describe('Fecha de la cita en formato YYYY-MM-DD')
    })
  }
);

// Tool: Registrar paciente nuevo
const registerPatientTool = tool(
  async ({ name, document, phone, birth_date, gender, insurance_eps_id }: { 
    name: string; 
    document: string; 
    phone: string;
    birth_date: string;
    gender: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado';
    insurance_eps_id: number;
  }) => {
    try {
      logger.info({ name, document }, 'Registrando paciente nuevo');
      const result = await MCPTools.callTool('registerPatientSimple', {
        name,
        document,
        phone,
        birth_date,
        gender,
        zone_id: 1, // Zona por defecto
        insurance_eps_id
      });
      return JSON.stringify(result);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error registrando paciente');
      return JSON.stringify({ error: error.message, success: false });
    }
  },
  {
    name: 'registerPatientSimple',
    description: 'Registra un nuevo paciente en el sistema. Requiere todos los datos básicos del paciente.',
    schema: z.object({
      name: z.string().describe('Nombre completo del paciente (nombres y apellidos)'),
      document: z.string().describe('Número de documento/cédula'),
      phone: z.string().describe('Número de teléfono con indicativo (ej: 573001234567)'),
      birth_date: z.string().describe('Fecha de nacimiento en formato YYYY-MM-DD'),
      gender: z.enum(['Masculino', 'Femenino', 'Otro', 'No especificado']).describe('Género del paciente'),
      insurance_eps_id: z.number().describe('ID de la EPS (obtenido de listActiveEPS)')
    })
  }
);

// Tool: Listar EPS activas
const listEPSTool = tool(
  async () => {
    try {
      logger.info('Listando EPS activas');
      const result = await MCPTools.callTool('listActiveEPS', {});
      return JSON.stringify(result);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error listando EPS');
      return JSON.stringify({ error: error.message, eps: [] });
    }
  },
  {
    name: 'listActiveEPS',
    description: 'Lista todas las EPS activas en el sistema',
    schema: z.object({})
  }
);

// Tool: Consultar citas de paciente
const getPatientAppointmentsTool = tool(
  async ({ patient_id }: { patient_id: number }) => {
    try {
      logger.info({ patient_id }, 'Consultando citas del paciente');
      const result = await MCPTools.callTool('getPatientAppointments', { patient_id });
      return JSON.stringify(result);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error consultando citas');
      return JSON.stringify({ error: error.message, appointments: [] });
    }
  },
  {
    name: 'getPatientAppointments',
    description: 'Obtiene las citas de un paciente',
    schema: z.object({
      patient_id: z.number().describe('ID del paciente')
    })
  }
);

// Lista de todas las herramientas
const tools = [
  searchPatientTool,
  getAvailabilityTool,
  scheduleAppointmentTool,
  registerPatientTool,
  listEPSTool,
  getPatientAppointmentsTool
];

// ============================================================================
// LLM CONFIGURATION
// ============================================================================

/**
 * Crear cliente LLM basado en WHATSAPP_USE_GROQ
 * WHATSAPP_USE_GROQ=true  -> Usa Groq (más rápido, económico)
 * WHATSAPP_USE_GROQ=false -> Usa ChatGPT (más preciso)
 */
function createLLM() {
  const useGroq = process.env.WHATSAPP_USE_GROQ?.toLowerCase() === 'true';
  
  if (useGroq) {
    const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    logger.info({ provider: 'Groq', model: groqModel }, 'WHATSAPP_USE_GROQ=true -> Inicializando LLM Groq');
    return new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: groqModel,
      temperature: 0.3,
    }).bindTools(tools);
  }
  
  // ChatGPT cuando WHATSAPP_USE_GROQ=false
  const chatgptModel = process.env.CHATGPT_MODEL || 'gpt-4o';
  // Usar WHATSAPP_CHATGPT_API_KEY primero, luego fallback a OPENAI_API_KEY
  const chatgptApiKey = process.env.WHATSAPP_CHATGPT_API_KEY || process.env.OPENAI_API_KEY;
  logger.info({ provider: 'ChatGPT', model: chatgptModel }, 'WHATSAPP_USE_GROQ=false -> Inicializando LLM ChatGPT');
  return new ChatOpenAI({
    apiKey: chatgptApiKey,
    model: chatgptModel,
    temperature: 0.3,
  }).bindTools(tools);
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function getSystemPrompt(phoneNumber: string): string {
  const now = new Date();
  const colombiaTime = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short'
  }).format(now);
  
  return `# Perfil y Misión
**Nombre:** Valeria  
**Rol:** Asistente profesional y amable de la Fundación Biosanar IPS.  
**Personalidad:** Te comunicas de forma natural y empática, como una persona real. NUNCA reveles que eres una IA.

## INFORMACIÓN DE CONTEXTO
- Número de WhatsApp del usuario: ${phoneNumber}
- Fecha y hora actual (Colombia): ${colombiaTime}

## FLUJO DE TRABAJO PARA AGENDAMIENTO

### PASO 1: SALUDO
- Saluda amablemente y pregunta en qué puedes ayudar
- Si mencionan "cita", pasa al PASO 2

### PASO 2: CONSULTAR DISPONIBILIDAD
- Usa la herramienta getAvailableAppointments SIN parámetros para ver qué hay disponible
- Presenta las especialidades disponibles al paciente

### PASO 3: VERIFICAR PACIENTE
- Pide el número de cédula
- Usa searchPatientByDocument para verificar si existe en la base de datos
- ⚠️ IMPORTANTE: Si searchPatientByDocument retorna found: false o el paciente NO existe:
  1. Informa amablemente: "No encuentro tu registro en el sistema. Necesito tomar tus datos para crear tu perfil."
  2. SOLICITA LOS SIGUIENTES DATOS UNO POR UNO (espera respuesta entre cada pregunta):
     a) "¿Cuál es tu nombre completo (nombres y apellidos)?"
     b) "¿Cuál es tu número de teléfono?"
     c) "¿Cuál es tu fecha de nacimiento? (día, mes, año)"
     d) "¿Cuál es tu género, masculino o femenino?"
     e) "¿A qué EPS perteneces?"
  3. Valida la EPS con listActiveEPS para obtener el insurance_eps_id
  4. Registra con registerPatientSimple usando TODOS los campos requeridos

### PASO 4: SELECCIONAR CITA
- Presenta opciones de sede y fecha basadas en la especialidad elegida
- Pide motivo de consulta

### PASO 5: CONFIRMAR Y AGENDAR
- Confirma todos los datos con el paciente
- Usa scheduleAppointment para agendar
- Proporciona el número de cita

## REGLAS IMPORTANTES
1. SIEMPRE usa searchPatientByDocument para verificar si el paciente existe - NUNCA asumas que existe
2. Si el paciente NO existe, DEBES solicitar TODOS los datos básicos antes de registrar
3. NUNCA inventes información sobre pacientes ni disponibilidad
4. Sé conciso en WhatsApp - mensajes cortos y claros
5. Si hay error, ofrece alternativas amablemente
6. Responde SIEMPRE en español

## DATOS REQUERIDOS PARA REGISTRO DE PACIENTE NUEVO
- document: Número de cédula (ya lo tienes)
- name: Nombre completo (nombres y apellidos)
- phone: Teléfono con indicativo país (ej: 573001234567)
- birth_date: Fecha de nacimiento formato YYYY-MM-DD
- gender: Masculino o Femenino
- insurance_eps_id: ID de la EPS (obtener de listActiveEPS)

## FORMATO DE RESPUESTA
- Usa emojis moderadamente para hacer el mensaje amigable
- Usa saltos de línea para separar ideas
- No uses markdown complejo (WhatsApp no lo renderiza bien)`;
}

// ============================================================================
// GRAPH NODES
// ============================================================================

// Nodo: Procesar mensaje con el LLM
async function agentNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const llm = createLLM();
  
  // Construir mensajes con sistema
  const systemMessage = new SystemMessage(getSystemPrompt(state.phoneNumber));
  const allMessages = [systemMessage, ...state.messages];
  
  logger.info({ 
    messageCount: state.messages.length,
    currentStep: state.currentStep 
  }, 'Procesando con LLM');
  
  try {
    const response = await llm.invoke(allMessages);
    
    logger.info({ 
      hasToolCalls: response.tool_calls && response.tool_calls.length > 0,
      toolCalls: response.tool_calls?.map(tc => tc.name)
    }, 'Respuesta del LLM');
    
    return {
      messages: [response]
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error en LLM');
    return {
      messages: [new AIMessage('Disculpa, tuve un problema técnico. ¿Podrías repetir tu mensaje?')],
      errorCount: state.errorCount + 1
    };
  }
}

// Nodo: Ejecutar herramientas
async function toolNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.tool_calls || [];
  
  if (toolCalls.length === 0) {
    return { messages: [] };
  }
  
  const toolMessages: ToolMessage[] = [];
  
  for (const toolCall of toolCalls) {
    logger.info({ tool: toolCall.name, args: toolCall.args }, 'Ejecutando herramienta');
    
    try {
      // Encontrar la herramienta correspondiente
      const toolFn = tools.find(t => t.name === toolCall.name);
      
      if (!toolFn) {
        toolMessages.push(new ToolMessage({
          tool_call_id: toolCall.id!,
          content: JSON.stringify({ error: `Herramienta ${toolCall.name} no encontrada` })
        }));
        continue;
      }
      
      const result = await toolFn.invoke(toolCall.args);
      
      logger.info({ tool: toolCall.name, resultLength: result.length }, 'Herramienta ejecutada');
      
      toolMessages.push(new ToolMessage({
        tool_call_id: toolCall.id!,
        content: result
      }));
    } catch (error: any) {
      logger.error({ tool: toolCall.name, error: error.message }, 'Error ejecutando herramienta');
      toolMessages.push(new ToolMessage({
        tool_call_id: toolCall.id!,
        content: JSON.stringify({ error: error.message })
      }));
    }
  }
  
  return { messages: toolMessages };
}

// ============================================================================
// ROUTING LOGIC
// ============================================================================

function shouldContinue(state: AgentStateType): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  
  // Si el último mensaje es del agente y tiene tool_calls, ejecutar herramientas
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }
  
  // Si hay demasiados errores, terminar
  if (state.errorCount >= 3) {
    return END;
  }
  
  return END;
}

// ============================================================================
// CREATE GRAPH
// ============================================================================

function createAgentGraph() {
  const workflow = new StateGraph(AgentState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      [END]: END
    })
    .addEdge('tools', 'agent');
  
  return workflow.compile();
}

// Singleton del grafo compilado
let compiledGraph: ReturnType<typeof createAgentGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = createAgentGraph();
    logger.info('LangGraph agent compilado');
  }
  return compiledGraph;
}

// ============================================================================
// CONVERSATION MEMORY (In-Memory para simplicidad)
// ============================================================================

interface ConversationMemory {
  messages: BaseMessage[];
  patientId: number | null;
  patientName: string | null;
  lastActivity: Date;
}

const conversationMemory = new Map<string, ConversationMemory>();

// Limpiar conversaciones inactivas cada 30 minutos
setInterval(() => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  for (const [phone, memory] of conversationMemory.entries()) {
    if (memory.lastActivity < thirtyMinutesAgo) {
      conversationMemory.delete(phone);
      logger.info({ phone }, 'Conversación expirada eliminada');
    }
  }
}, 30 * 60 * 1000);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Procesa un mensaje de WhatsApp usando LangGraph
 */
export async function processMessageWithLangGraph(
  phoneNumber: string,
  message: string
): Promise<string> {
  const startTime = Date.now();
  
  logger.info({ phoneNumber, messageLength: message.length }, 'Procesando mensaje con LangGraph');
  
  try {
    // Obtener o crear memoria de conversación
    let memory = conversationMemory.get(phoneNumber);
    if (!memory) {
      memory = {
        messages: [],
        patientId: null,
        patientName: null,
        lastActivity: new Date()
      };
      conversationMemory.set(phoneNumber, memory);
    }
    
    // Agregar mensaje del usuario
    memory.messages.push(new HumanMessage(message));
    memory.lastActivity = new Date();
    
    // Limitar historial a últimos 20 mensajes para no exceder contexto
    if (memory.messages.length > 20) {
      memory.messages = memory.messages.slice(-20);
    }
    
    // Ejecutar el grafo
    const graph = getGraph();
    const result = await graph.invoke({
      messages: memory.messages,
      phoneNumber,
      patientId: memory.patientId,
      patientName: memory.patientName
    });
    
    // Extraer la respuesta del agente
    const agentMessages = result.messages.filter(
      (m: BaseMessage) => m instanceof AIMessage && !('tool_calls' in m && (m as AIMessage).tool_calls?.length)
    );
    
    const lastAgentMessage = agentMessages[agentMessages.length - 1];
    const responseText = lastAgentMessage?.content?.toString() || 
      'Disculpa, no pude procesar tu mensaje. ¿Podrías intentar de nuevo?';
    
    // Actualizar memoria con la respuesta
    memory.messages.push(new AIMessage(responseText));
    memory.patientId = result.patientId;
    memory.patientName = result.patientName;
    
    const duration = Date.now() - startTime;
    logger.info({ phoneNumber, duration, responseLength: responseText.length }, 'Mensaje procesado');
    
    return responseText;
  } catch (error: any) {
    logger.error({ phoneNumber, error: error.message, stack: error.stack }, 'Error procesando mensaje');
    return '😔 Disculpa, estoy teniendo problemas técnicos. Por favor intenta de nuevo en unos minutos o llama al 📞 (número de contacto).';
  }
}

/**
 * Reinicia la conversación de un usuario
 */
export function resetConversation(phoneNumber: string): void {
  conversationMemory.delete(phoneNumber);
  logger.info({ phoneNumber }, 'Conversación reiniciada');
}

/**
 * Obtiene estadísticas del agente
 */
export function getAgentStats() {
  return {
    activeConversations: conversationMemory.size,
    provider: process.env.WHATSAPP_AI_PROVIDER || 'groq',
    model: process.env.WHATSAPP_AI_MODEL || 'llama-3.3-70b-versatile'
  };
}

export default {
  processMessage: processMessageWithLangGraph,
  resetConversation,
  getAgentStats
};
