/**
 * WhatsApp Agent Core - Sistema Agéntico Avanzado
 * 
 * Implementa capacidades agénticas avanzadas inspiradas en:
 * - ReAct (Reasoning + Acting) loop
 * - Planificación multi-step con recuperación de errores
 * - Auto-corrección y reflexión
 * - Memory-augmented generation
 * - Parallel tool execution cuando es posible
 * 
 * @version 1.0.0
 * @description Sistema core para capacidades agénticas del bot WhatsApp
 */

import pino from 'pino';

const logger = pino({
  name: 'whatsapp-agent-core',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// TIPOS DEL SISTEMA AGÉNTICO
// ============================================================================

export interface AgentThought {
  reasoning: string;
  plan: string[];
  currentStep: number;
  observations: string[];
  reflections: string[];
}

export interface AgentAction {
  type: 'tool_call' | 'respond' | 'clarify' | 'escalate' | 'wait';
  toolName?: string;
  toolArgs?: Record<string, any>;
  response?: string;
  confidence: number;
  reasoning: string;
}

export interface AgentState {
  phone: string;
  goal: string;
  thought: AgentThought;
  history: AgentAction[];
  context: Record<string, any>;
  startTime: number;
  iterationCount: number;
  maxIterations: number;
  status: 'planning' | 'executing' | 'reflecting' | 'completed' | 'failed' | 'escalated';
}

export interface PlanStep {
  id: number;
  action: string;
  toolRequired?: string;
  dependsOn?: number[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

export interface ExecutionPlan {
  goal: string;
  steps: PlanStep[];
  fallbackStrategy: 'retry' | 'alternative' | 'escalate';
  estimatedSteps: number;
  createdAt: number;
}

// ============================================================================
// PATRONES DE INTENCIÓN PARA PLANIFICACIÓN
// ============================================================================

const GOAL_PATTERNS: Record<string, { 
  pattern: RegExp; 
  requiredSteps: string[];
  optionalSteps: string[];
  priority: number;
}> = {
  schedule_appointment: {
    pattern: /quiero|necesito|agendar|sacar|pedir|reservar.*cita/i,
    requiredSteps: ['identify_patient', 'get_specialty', 'check_availability', 'select_slot', 'confirm_appointment'],
    optionalSteps: ['check_eps_coverage', 'add_to_waiting_list'],
    priority: 1
  },
  check_appointments: {
    pattern: /mis citas|tengo cita|estado.*cita|consultar.*citas/i,
    requiredSteps: ['identify_patient', 'fetch_appointments', 'format_response'],
    optionalSteps: ['check_waiting_list'],
    priority: 2
  },
  cancel_appointment: {
    pattern: /cancelar|anular.*cita/i,
    requiredSteps: ['identify_patient', 'fetch_appointments', 'select_appointment', 'confirm_cancellation'],
    optionalSteps: ['offer_reschedule'],
    priority: 2
  },
  reschedule_appointment: {
    pattern: /reagendar|cambiar.*cita|otra fecha/i,
    requiredSteps: ['identify_patient', 'fetch_appointments', 'select_appointment', 'check_availability', 'select_new_slot', 'confirm_reschedule'],
    optionalSteps: [],
    priority: 2
  },
  waiting_list: {
    pattern: /lista.*espera|no hay cupos|avisar.*disponible/i,
    requiredSteps: ['identify_patient', 'get_specialty', 'add_to_waiting_list'],
    optionalSteps: ['set_priority'],
    priority: 3
  },
  general_inquiry: {
    pattern: /información|horarios|ubicación|contacto|servicios/i,
    requiredSteps: ['classify_inquiry', 'fetch_info', 'format_response'],
    optionalSteps: ['offer_appointment'],
    priority: 4
  }
};

// ============================================================================
// CLASE PRINCIPAL DEL AGENTE
// ============================================================================

export class WhatsAppAgentCore {
  private states = new Map<string, AgentState>();
  private executionPlans = new Map<string, ExecutionPlan>();
  
  // Configuración
  private readonly MAX_ITERATIONS = 10;
  private readonly REFLECTION_INTERVAL = 3; // Reflexionar cada N iteraciones
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly TIMEOUT_MS = 60000; // 1 minuto máximo por goal
  private readonly MAX_STATES = 500; // Límite máximo de estados en memoria
  private readonly STATE_TTL_MS = 30 * 60 * 1000; // 30 minutos TTL
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Limpieza periódica cada 5 minutos
    this.cleanupInterval = setInterval(() => this.cleanupStaleStates(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /**
   * Limpiar estados obsoletos para prevenir memory leaks
   */
  private cleanupStaleStates(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [phone, state] of this.states.entries()) {
      if (now - state.startTime > this.STATE_TTL_MS || state.status === 'completed' || state.status === 'failed') {
        this.states.delete(phone);
        this.executionPlans.delete(phone);
        cleaned++;
      }
    }
    // Si aún hay demasiados, eliminar los más antiguos
    if (this.states.size > this.MAX_STATES) {
      const sorted = Array.from(this.states.entries()).sort((a, b) => a[1].startTime - b[1].startTime);
      const toRemove = sorted.slice(0, this.states.size - this.MAX_STATES);
      for (const [phone] of toRemove) {
        this.states.delete(phone);
        this.executionPlans.delete(phone);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info({ cleaned, remaining: this.states.size }, 'Cleaned stale agent states');
    }
  }

  /**
   * Inicializa o recupera el estado del agente para un usuario
   */
  getOrCreateState(phone: string, goal?: string): AgentState {
    let state = this.states.get(phone);
    
    if (!state || (goal && state.goal !== goal)) {
      state = {
        phone,
        goal: goal || 'unknown',
        thought: {
          reasoning: '',
          plan: [],
          currentStep: 0,
          observations: [],
          reflections: []
        },
        history: [],
        context: {},
        startTime: Date.now(),
        iterationCount: 0,
        maxIterations: this.MAX_ITERATIONS,
        status: 'planning'
      };
      this.states.set(phone, state);
    }
    
    return state;
  }

  /**
   * 🧠 ReAct Loop: Reason → Act → Observe → Reflect
   */
  async executeReActLoop(
    phone: string,
    message: string,
    context: Record<string, any>,
    toolExecutor: (name: string, args: Record<string, any>) => Promise<any>
  ): Promise<{ response: string; actions: AgentAction[]; state: AgentState }> {
    
    const state = this.getOrCreateState(phone);
    state.iterationCount++;
    
    // Verificar timeout
    if (Date.now() - state.startTime > this.TIMEOUT_MS) {
      state.status = 'failed';
      return {
        response: 'Disculpa, tardé demasiado. ¿Podrías repetir tu solicitud? 😊',
        actions: state.history,
        state
      };
    }
    
    // Verificar límite de iteraciones
    if (state.iterationCount > state.maxIterations) {
      state.status = 'escalated';
      return {
        response: 'Parece que necesitas ayuda especializada. Te transfiero con un agente humano. 📞',
        actions: state.history,
        state
      };
    }

    try {
      // PASO 1: RAZONAR (Reason)
      const reasoning = await this.reason(state, message, context);
      state.thought.reasoning = reasoning.thought;
      state.thought.observations.push(reasoning.observation);

      // PASO 2: PLANIFICAR (Plan)
      if (state.status === 'planning' || !state.thought.plan.length) {
        const plan = await this.createPlan(state, message, context);
        state.thought.plan = plan.steps.map(s => s.action);
        this.executionPlans.set(phone, plan);
        state.status = 'executing';
      }

      // PASO 3: ACTUAR (Act)
      const action = await this.selectAction(state, context);
      state.history.push(action);

      // PASO 4: EJECUTAR ACCIÓN
      let result: any;
      if (action.type === 'tool_call' && action.toolName) {
        result = await toolExecutor(action.toolName, action.toolArgs || {});
        
        // Actualizar plan con resultado
        const plan = this.executionPlans.get(phone);
        if (plan) {
          const currentStep = plan.steps[state.thought.currentStep];
          if (currentStep) {
            currentStep.status = result.success ? 'completed' : 'failed';
            currentStep.result = result;
          }
        }
      }

      // PASO 5: OBSERVAR (Observe)
      const observation = this.observe(state, action, result);
      state.thought.observations.push(observation);

      // PASO 6: REFLEXIONAR (Reflect) - cada N iteraciones
      if (state.iterationCount % this.REFLECTION_INTERVAL === 0) {
        const reflection = await this.reflect(state);
        state.thought.reflections.push(reflection);
        
        // Auto-corrección si la reflexión detecta problemas
        if (reflection.includes('ERROR') || reflection.includes('RETRY')) {
          state.thought.currentStep = Math.max(0, state.thought.currentStep - 1);
        }
      }

      // PASO 7: DETERMINAR SIGUIENTE ACCIÓN O RESPUESTA
      if (action.type === 'respond') {
        state.status = 'completed';
        return {
          response: action.response || '',
          actions: state.history,
          state
        };
      }

      // Avanzar al siguiente paso
      state.thought.currentStep++;

      // Si hay más pasos, continuar (iteración controlada, no recursión)
      const plan = this.executionPlans.get(phone);
      if (plan && state.thought.currentStep < plan.steps.length) {
        // Usar iteración en lugar de recursión para evitar stack overflow
        // La siguiente iteración se manejará al llamar executeReActLoop de nuevo externamente
        state.status = 'executing';
        return {
          response: `Procesando paso ${state.thought.currentStep + 1} de ${plan.steps.length}...`,
          actions: state.history,
          state
        };
      }

      // Plan completado
      state.status = 'completed';
      return {
        response: this.generateFinalResponse(state),
        actions: state.history,
        state
      };

    } catch (error: any) {
      logger.error({ phone, error: error.message }, 'ReAct loop error');
      
      // Estrategia de recuperación (sin recursión para evitar stack overflow)
      const recovery = this.handleError(state, error);
      if (recovery.retry && state.iterationCount < 3) {
        state.status = 'planning';
        return {
          response: 'Reintentando... 🔄',
          actions: state.history,
          state
        };
      }
      
      state.status = 'failed';
      return {
        response: recovery.response,
        actions: state.history,
        state
      };
    }
  }

  /**
   * 🧠 Fase de Razonamiento
   */
  private async reason(
    state: AgentState, 
    message: string, 
    context: Record<string, any>
  ): Promise<{ thought: string; observation: string }> {
    
    // Detectar el goal del usuario
    let detectedGoal = 'unknown';
    for (const [goal, config] of Object.entries(GOAL_PATTERNS)) {
      if (config.pattern.test(message)) {
        detectedGoal = goal;
        break;
      }
    }
    
    if (state.goal === 'unknown') {
      state.goal = detectedGoal;
    }

    // Construir pensamiento basado en contexto
    const thought = this.buildThought(state, message, context, detectedGoal);
    const observation = `Goal detectado: ${detectedGoal}. Contexto: ${JSON.stringify(context).substring(0, 200)}`;

    return { thought, observation };
  }

  /**
   * 📋 Crear plan de ejecución
   */
  private async createPlan(
    state: AgentState,
    message: string,
    context: Record<string, any>
  ): Promise<ExecutionPlan> {
    
    const goalConfig = GOAL_PATTERNS[state.goal] || GOAL_PATTERNS.general_inquiry;
    
    const steps: PlanStep[] = goalConfig.requiredSteps.map((action, idx) => ({
      id: idx,
      action,
      toolRequired: this.mapActionToTool(action),
      dependsOn: idx > 0 ? [idx - 1] : undefined,
      status: 'pending'
    }));

    // Agregar pasos opcionales si el contexto lo requiere
    if (context.needsWaitingList && goalConfig.optionalSteps.includes('add_to_waiting_list')) {
      steps.push({
        id: steps.length,
        action: 'add_to_waiting_list',
        toolRequired: 'addToWaitingList',
        status: 'pending'
      });
    }

    const plan: ExecutionPlan = {
      goal: state.goal,
      steps,
      fallbackStrategy: 'alternative',
      estimatedSteps: steps.length,
      createdAt: Date.now()
    };

    logger.info({ phone: state.phone, goal: state.goal, steps: steps.length }, 'Plan created');
    
    return plan;
  }

  /**
   * 🎯 Seleccionar siguiente acción
   */
  private async selectAction(
    state: AgentState,
    context: Record<string, any>
  ): Promise<AgentAction> {
    
    const plan = this.executionPlans.get(state.phone);
    if (!plan || state.thought.currentStep >= plan.steps.length) {
      return {
        type: 'respond',
        response: this.generateFinalResponse(state),
        confidence: 0.9,
        reasoning: 'Plan completed, generating response'
      };
    }

    const currentStep = plan.steps[state.thought.currentStep];
    const toolName = currentStep.toolRequired;

    // Verificar dependencias
    if (currentStep.dependsOn) {
      const dependencyMet = currentStep.dependsOn.every(
        depId => plan.steps[depId]?.status === 'completed'
      );
      
      if (!dependencyMet) {
        return {
          type: 'wait',
          confidence: 0.5,
          reasoning: `Waiting for dependencies: ${currentStep.dependsOn.join(', ')}`
        };
      }
    }

    // Construir argumentos de la herramienta
    const toolArgs = this.buildToolArgs(currentStep.action, context, state);

    return {
      type: 'tool_call',
      toolName,
      toolArgs,
      confidence: 0.85,
      reasoning: `Executing step ${state.thought.currentStep + 1}: ${currentStep.action}`
    };
  }

  /**
   * 👁️ Fase de Observación
   */
  private observe(state: AgentState, action: AgentAction, result: any): string {
    if (action.type === 'tool_call') {
      const success = result?.success ?? false;
      const dataSize = JSON.stringify(result?.data || {}).length;
      return `Tool ${action.toolName}: ${success ? 'SUCCESS' : 'FAILED'} (${dataSize} bytes)`;
    }
    return `Action ${action.type}: completed`;
  }

  /**
   * 🔄 Fase de Reflexión
   */
  private async reflect(state: AgentState): Promise<string> {
    const successRate = state.history.filter(a => a.confidence > 0.7).length / state.history.length;
    const plan = this.executionPlans.get(state.phone);
    const completedSteps = plan?.steps.filter(s => s.status === 'completed').length || 0;
    const totalSteps = plan?.steps.length || 1;
    const progress = completedSteps / totalSteps;

    let reflection = `Progress: ${Math.round(progress * 100)}%. Success rate: ${Math.round(successRate * 100)}%.`;

    // Detectar patrones problemáticos
    const recentActions = state.history.slice(-3);
    const repeatedTools = new Set(recentActions.map(a => a.toolName)).size < recentActions.length;
    
    if (repeatedTools) {
      reflection += ' WARNING: Repeated tool calls detected. Consider alternative approach.';
    }

    if (successRate < 0.5) {
      reflection += ' ERROR: Low success rate. RETRY with different strategy.';
    }

    return reflection;
  }

  /**
   * 🔧 Mapear acción a herramienta
   */
  private mapActionToTool(action: string): string {
    const mapping: Record<string, string> = {
      'identify_patient': 'searchPatient',
      'get_specialty': 'searchSpecialties',
      'check_availability': 'getAvailableAppointments',
      'select_slot': 'getAvailableTimeSlots',
      'confirm_appointment': 'scheduleAppointment',
      'fetch_appointments': 'getPatientAppointments',
      'select_appointment': 'getPatientAppointments',
      'confirm_cancellation': 'cancelAppointment',
      'add_to_waiting_list': 'addToWaitingList',
      'check_eps_coverage': 'getEPSServices',
      'classify_inquiry': 'searchSpecialties',
      'fetch_info': 'getClinicInfo'
    };
    return mapping[action] || action;
  }

  /**
   * 🔨 Construir argumentos para herramienta
   */
  private buildToolArgs(
    action: string,
    context: Record<string, any>,
    state: AgentState
  ): Record<string, any> {
    
    switch (action) {
      case 'identify_patient':
        return { document: context.patientDocument };
      
      case 'check_availability':
        return { 
          specialty_name: context.specialtyName,
          specialty_id: context.specialtyId
        };
      
      case 'confirm_appointment':
        return {
          patient_id: context.patientId,
          availability_id: context.availabilityId,
          scheduled_date: context.scheduledDate,
          reason: context.reason || 'Consulta médica'
        };
      
      case 'fetch_appointments':
        return { patient_id: context.patientId };
      
      case 'confirm_cancellation':
        return { 
          appointment_id: context.appointmentId,
          reason: 'Cancelada por paciente'
        };
      
      default:
        return context;
    }
  }

  /**
   * 📝 Generar respuesta final
   */
  private generateFinalResponse(state: AgentState): string {
    const plan = this.executionPlans.get(state.phone);
    const lastResult = state.history
      .filter(a => a.type === 'tool_call')
      .pop();

    if (!plan) {
      return 'Disculpa, no pude completar tu solicitud. ¿Me repites qué necesitas? 😊';
    }

    const failedSteps = plan.steps.filter(s => s.status === 'failed');
    if (failedSteps.length > 0) {
      return `Hubo un problema al ${failedSteps[0].action}. ¿Quieres que lo intentemos de nuevo? 🔄`;
    }

    return 'Listo, he completado tu solicitud. ¿Hay algo más en lo que pueda ayudarte? 😊';
  }

  /**
   * 🛡️ Manejo de errores con recuperación
   */
  private handleError(state: AgentState, error: Error): { retry: boolean; response: string } {
    const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'rate limit'];
    const isRetryable = retryableErrors.some(e => error.message.includes(e));

    if (isRetryable && state.iterationCount < 3) {
      return {
        retry: true,
        response: ''
      };
    }

    return {
      retry: false,
      response: 'Tuvimos un problema técnico. Por favor intenta de nuevo en unos minutos. 🔧'
    };
  }

  /**
   * 🧠 Construir pensamiento estructurado
   */
  private buildThought(
    state: AgentState,
    message: string,
    context: Record<string, any>,
    goal: string
  ): string {
    const parts = [
      `GOAL: ${goal}`,
      `USER_MESSAGE: "${message.substring(0, 100)}"`,
      `CONTEXT_KEYS: ${Object.keys(context).join(', ')}`,
      `ITERATION: ${state.iterationCount}/${state.maxIterations}`,
      `CURRENT_STEP: ${state.thought.currentStep}`,
      `HISTORY_LENGTH: ${state.history.length}`
    ];

    if (context.patientId) parts.push(`PATIENT_ID: ${context.patientId}`);
    if (context.specialtyName) parts.push(`SPECIALTY: ${context.specialtyName}`);

    return parts.join(' | ');
  }

  /**
   * 🧹 Limpiar estado del agente
   */
  clearState(phone: string): void {
    this.states.delete(phone);
    this.executionPlans.delete(phone);
    logger.info({ phone }, 'Agent state cleared');
  }

  /**
   * 📊 Obtener métricas del agente
   */
  getMetrics(): {
    activeStates: number;
    avgIterations: number;
    completionRate: number;
  } {
    const states = Array.from(this.states.values());
    const completedStates = states.filter(s => s.status === 'completed');
    
    return {
      activeStates: states.length,
      avgIterations: states.reduce((sum, s) => sum + s.iterationCount, 0) / (states.length || 1),
      completionRate: completedStates.length / (states.length || 1)
    };
  }
}

// Singleton instance
export const agentCore = new WhatsAppAgentCore();
export default agentCore;
