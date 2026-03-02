/**
 * Tipos e interfaces compartidas del módulo WhatsApp
 * @module whatsapp/types
 */

export { ConversationState, type StateContext, createDefaultStateContext } from './state';
export {
  type ToolResult,
  type ToolContext,
  type ToolStateTransition,
  type ToolDefinition
} from './tools';

// Re-import para uso local dentro de este archivo
import type { StateContext } from './state';

// ─── Contexto de conversación (cache en memoria) ────────────────────────────

export interface ConversationContext {
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
  db_session_id?: number;
}

// ─── Respuesta de IA ─────────────────────────────────────────────────────────

export interface AIResponse {
  text: string;
  toolCalls?: Array<{ name: string; args: Record<string, any> }>;
  shouldContinue: boolean;
}

// ─── Resultado del procesamiento de un mensaje ──────────────────────────────

export interface ProcessMessageResult {
  success: boolean;
  response?: string;
  toolCalls?: Array<{ name: string; result: string }>;
  error?: string;
  intent?: string;
  silent?: boolean;
}

// ─── Contexto que fluye a través del pipeline ───────────────────────────────

export interface PipelineContext {
  // Entrada
  phone: string;
  cleanPhone: string;
  rawMessage: string;
  /** Alias conveniente para rawMessage (usado en los pipeline steps) */
  message: string;
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  profileName?: string;

  // Estado
  stateContext: StateContext;
  conversationContext: ConversationContext;

  // Análisis
  intent?: string;
  intentConfidence?: number;
  confidence?: number;
  intentAnalysis?: any;
  extractedEntities?: any;
  entities?: any;
  enrichedContextPrompt?: string;

  // IA
  aiResponse?: AIResponse;
  aiResponseText?: string;
  executedTools: Array<{ name: string; result: string }>;

  // Resultado
  finalResponse?: string;
  /** Respuesta temprana (corto-circuita el pipeline, evita el paso de IA) */
  earlyResponse?: string;
  shouldStop: boolean;
  isSilent?: boolean;

  // Métricas
  startTime: number;
  processingDuration?: number;
}

/** Firma de un paso del pipeline */
export type PipelineStep = (ctx: PipelineContext) => Promise<PipelineContext | null>;

// ─── Configuración de proveedor de IA ────────────────────────────────────────

export interface AIProviderConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  provider: 'Groq' | 'ChatGPT';
  isGPT5: boolean;
}
