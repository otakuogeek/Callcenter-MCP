/**
 * Tipos para el sistema de herramientas (tools) del bot
 * @module whatsapp/types/tools
 */

import type { StateContext, ConversationState } from './state';

/** Resultado de la ejecución de una herramienta */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  userFriendlyError?: string;
}

/** Contexto pasado a cada herramienta durante su ejecución */
export interface ToolContext {
  phone: string;
  stateContext: StateContext;
  patientId?: number;
  patientName?: string;
  patientDocument?: string;
  patientEpsId?: number;
  /** Referencia al contexto de conversación en cache (opcional) */
  conversation?: any;
}

/** Transición de estado provocada al completarse una herramienta */
export interface ToolStateTransition {
  /** Nuevo estado tras éxito */
  onSuccess?: ConversationState;
  /** Actualizaciones parciales al estado tras éxito */
  onSuccessUpdates?: (args: Record<string, any>, result: any, ctx: ToolContext) => Partial<StateContext>;
  /** Nuevo estado tras error */
  onError?: ConversationState;
}

/** Definición declarativa de una herramienta */
export interface ToolDefinition {
  /** Nombre único de la herramienta (usado en [TOOL:name:{args}]) */
  name: string;
  /** Descripción para el system prompt de la IA */
  description: string;
  /** Categoría para organización */
  category?: string;
  /** JSON Schema de los parámetros (optional) */
  parameters?: Record<string, any>;
  /** Función que ejecuta la herramienta */
  handler: (args: Record<string, any>, ctx?: ToolContext) => Promise<ToolResult>;
  /** Gancho post-ejecución opcional (e.g. actualizar estado, guardar en BD) */
  afterExecute?: (result: ToolResult, args: Record<string, any>, ctx: ToolContext & { conversation?: any }) => Promise<void>;
  /** Transiciones de estado opcionales */
  stateTransitions?: ToolStateTransition;
}
