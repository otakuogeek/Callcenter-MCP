/**
 * @module whatsapp/pipeline/steps/06-AIGeneration
 * @description Pipeline step 6: Generate AI response + execute tool calls loop.
 *              Calls the AI provider, parses tool calls, executes them, loops.
 */

import type { PipelineContext, ConversationContext } from '../../types';
import { ConversationState } from '../../types/state';
import { getStateContext, updateState, incrementRetry, shouldResetDueToErrors, resetState } from '../../state/UnifiedStateManager';
import { getConversationWithMemory } from '../../state/ConversationCache';
import { logger, MAX_AI_ITERATIONS, getAIProviderConfig } from '../../config';
import { callAIProvider, buildChatMessages } from '../../ai/AIProvider';
import { buildSystemPrompt, generateDynamicContext } from '../../prompts/PromptManager';
import { normalizeToolResultDatesForWhatsApp } from '../../utils/date';
import { isAffirmative, isNegative } from '../../utils/validation';
import { execute as executeTool, summarizeToolResult } from '../../tools/ToolExecutor';
import { personalityManager } from '../../../services/WhatsAppPersonality';
import * as EnhancedUnderstanding from '../../../services/WhatsAppEnhancedUnderstanding';
import * as ChatMemoryService from '../../../services/ChatMemoryService';
import { addAppointment, updateContext } from '../../../services/ConversationPersistence';
import * as SemanticMemory from '../../../services/WhatsAppSemanticMemory';

/**
 * Step 6: AI response generation + tool execution loop.
 */
export async function aiGenerationStep(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.earlyResponse) return ctx;

  const { phone, message } = ctx;
  const stateContext = getStateContext(phone);

  // Error recovery check
  if (shouldResetDueToErrors(phone)) {
    resetState(phone);
    ctx.earlyResponse = 'Disculpa, tuvimos algunos problemas. Empecemos de nuevo desde el principio. 😊\n\n¿Cuál es tu número de cédula?';
    return ctx;
  }

  // Verify AI config
  const aiConfig = getAIProviderConfig();
  if (!aiConfig.apiKey) {
    incrementRetry(phone);
    ctx.earlyResponse = 'Disculpa, tenemos una dificultad técnica momentánea. Por favor, llámanos al 6076911308 o intenta más tarde. 🏥';
    return ctx;
  }

  // Greeting reset
  const isGreeting = /^(hola|buenas|buenos días|buenas tardes|buenas noches|hey|hi|hello|saludos)/i.test(message.trim());
  if (isGreeting && stateContext.currentState !== ConversationState.IDLE) {
    resetState(phone);
    updateState(phone, ConversationState.AWAITING_DOCUMENT);
  }

  // Build conversation context
  const conversationCtx = await getConversationWithMemory(phone);
  conversationCtx.messages.push({ role: 'user', content: message });
  if (conversationCtx.messages.length > 20) {
    conversationCtx.messages = conversationCtx.messages.slice(-20);
  }

  // Save user message to memory
  if (conversationCtx.db_session_id) {
    ChatMemoryService.saveMessage(conversationCtx.db_session_id, 'user', message).catch(() => {});
  }

  // Build system prompt
  const systemPrompt = await buildFullSystemPrompt(phone, message, ctx.enrichedContextPrompt);

  // Add user message to personality history
  personalityManager.addMessage(phone, 'user', message);

  // Generate AI response
  const messages = buildChatMessages(systemPrompt, conversationCtx.messages);
  let response = await callAIProvider(messages);

  // Track personality
  if (response.text?.trim()) {
    personalityManager.addMessage(phone, 'assistant', response.text);
  }

  // Tool execution loop
  let iterations = 0;
  const executedToolKeys = new Set<string>();

  while (response.toolCalls && response.toolCalls.length > 0 && iterations < MAX_AI_ITERATIONS) {
    iterations++;

    // Deduplicate
    const uniqueToolCalls = response.toolCalls.filter(tc => {
      const key = `${tc.name}:${JSON.stringify(tc.args)}`;
      if (executedToolKeys.has(key)) return false;
      executedToolKeys.add(key);
      return true;
    });

    if (uniqueToolCalls.length === 0) break;

    for (const tc of uniqueToolCalls) {
      // Prevent double scheduling
      if (tc.name === 'scheduleAppointment') {
        const st = getStateContext(phone);
        if (st.lastAppointmentId) {
          conversationCtx.messages.push({
            role: 'system',
            content: `[Resultado de scheduleAppointment]: La cita ya fue agendada previamente con ID #${st.lastAppointmentId}. No es necesario agendar de nuevo.`,
          });
          ctx.executedTools.push({ name: 'scheduleAppointment (YA AGENDADA)', result: `Cita #${st.lastAppointmentId}` });
          continue;
        }
        // Inject scheduledDatetime
        if (st.scheduledDatetime) {
          tc.args.scheduled_date = st.scheduledDatetime;
        }
      }

      try {
        const { result, success } = await executeTool(tc.name, tc.args, conversationCtx);

        // Post-execution state transitions
        applyStateTransitions(phone, tc.name, tc.args, result, conversationCtx);

        ctx.executedTools.push({ name: tc.name, result: JSON.stringify(result).substring(0, 200) });

        // Add result to AI context
        conversationCtx.messages.push({
          role: 'system',
          content: `[Resultado de ${tc.name}]: ${summarizeToolResult(tc.name, normalizeToolResultDatesForWhatsApp(result))}`,
        });
      } catch (err: any) {
        logger.error({ tool: tc.name, error: err.message }, 'Tool execution error');
        incrementRetry(phone);
        conversationCtx.messages.push({
          role: 'system',
          content: `[Error en ${tc.name}]: ${getToolErrorMessage(tc.name, err)}`,
        });
        ctx.executedTools.push({ name: `${tc.name} (ERROR)`, result: err.message });
      }
    }

    // Generate follow-up if tools were used
    if (response.toolCalls.length > 0) {
      const followUpMessages = buildChatMessages(systemPrompt, conversationCtx.messages);
      response = await callAIProvider(followUpMessages);
      if (response.text?.trim()) personalityManager.addMessage(phone, 'assistant', response.text);
    }
  }

  // Store the AI text
  ctx.aiResponseText = response.text || '';

  // Save assistant message
  conversationCtx.messages.push({ role: 'assistant', content: ctx.aiResponseText });
  if (conversationCtx.db_session_id) {
    ChatMemoryService.saveMessage(conversationCtx.db_session_id, 'assistant', ctx.aiResponseText).catch(() => {});
  }

  return ctx;
}

// ─── Build full system prompt with all context layers ──────────────────────

async function buildFullSystemPrompt(phone: string, message: string, enrichedContextPrompt?: string): Promise<string> {
  const stateContext = getStateContext(phone);
  const dynamicContext = await generateDynamicContext(stateContext, phone);
  let prompt = await buildSystemPrompt();

  // Layer: personality
  const personalityPrompt = personalityManager.buildSystemPrompt();
  prompt = dynamicContext + '\n\n' + prompt + '\n\n' + personalityPrompt;

  // Layer: enriched context (semantic memory)
  if (enrichedContextPrompt) {
    prompt += '\n\n' + enrichedContextPrompt;
  } else {
    try {
      const enriched = await EnhancedUnderstanding.buildEnrichedContext(phone, message);
      if (enriched) {
        const memCtx = EnhancedUnderstanding.generateContextPrompt(enriched);
        if (memCtx) prompt += '\n\n' + memCtx;
      }
    } catch {}
  }

  return prompt;
}

// ─── State transitions after tool execution ────────────────────────────────

function applyStateTransitions(
  phone: string, toolName: string, args: any, result: any, context: ConversationContext,
): void {
  if (!result?.success) return;

  switch (toolName) {
    case 'searchPatient':
      if (result.data?.found) {
        const p = result.data.patient || result.data.patients?.[0];
        updateState(phone, ConversationState.AWAITING_PHONE_CONFIRMATION, {
          patientId: p?.id, patientName: p?.full_name || p?.name,
          patientDocument: args.document, patientPhone: p?.phone || p?.mobile || '',
        });
        if (p?.id && context.db_session_id) {
          ChatMemoryService.updateSessionPatient(context.db_session_id, p.id, p.full_name || p.name, args.document || '').catch(() => {});
        }
      } else {
        updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
          patientDocument: args.document, registrationPending: true,
        });
      }
      break;

    case 'registerPatientSimple':
      updateState(phone, ConversationState.AWAITING_SPECIALTY, {
        patientId: result.data?.id, patientName: args.name || args.full_name,
      });
      break;

    case 'getAvailableTimeSlots':
      updateState(phone, ConversationState.AWAITING_TIME, {
        timeSlots: result.data?.available_time_slots,
      });
      break;

    case 'getAvailableTimeSlotsForDoctorOnDate':
      updateState(phone, ConversationState.AWAITING_TIME, {
        timeSlots: result.data?.slots_detail || [],
        selectedDate: result.data?.date,
      });
      break;

    case 'scheduleAppointment':
      if (result.data?.waiting_list) {
        updateState(phone, ConversationState.COMPLETED, {
          lastQuestion: `Lista de espera (Posición: ${result.data.queue_position})`,
        });
      } else if (result.data?.appointment_id) {
        updateState(phone, ConversationState.COMPLETED, {
          lastQuestion: `Cita #${result.data.appointment_id}`,
          lastAppointmentId: result.data.appointment_id,
        });
        addAppointment(phone, {
          appointmentId: result.data.appointment_id,
          specialty: result.data.specialty_name || '',
          doctorName: result.data.doctor_name || '',
          date: result.data.scheduled_date?.split(' ')[0] || '',
          time: result.data.scheduled_time || '',
          location: result.data.location_name || '',
          status: 'Confirmada',
          scheduledAt: new Date().toISOString(),
        }).catch(() => {});
        updateContext(phone, { state: 'completed' }).catch(() => {});
      }
      break;

    case 'checkAvailabilityQuota':
      if (result.data?.can_schedule) updateState(phone, ConversationState.AWAITING_TIME);
      break;

    case 'addToWaitingList':
      updateState(phone, ConversationState.COMPLETED);
      break;
  }
}

// ─── Error message helper ──────────────────────────────────────────────────

function getToolErrorMessage(toolName: string, error: any): string {
  const msg = error?.message || 'Error desconocido';
  switch (toolName) {
    case 'scheduleAppointment': return `No se pudo agendar la cita: ${msg}`;
    case 'searchPatient': return `Error buscando paciente: ${msg}`;
    case 'getAvailableAppointments': return `Error consultando disponibilidad: ${msg}`;
    default: return `Error en ${toolName}: ${msg}`;
  }
}
