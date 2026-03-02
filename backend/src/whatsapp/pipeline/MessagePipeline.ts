/**
 * @module whatsapp/pipeline/MessagePipeline
 * @description Orchestrates the 7-step message processing pipeline.
 *              Each step is independent, testable, and <200 lines.
 *
 *              Pipeline flow:
 *              1. Identify     → Auto-identify patient, detect document
 *              2. IntentAnalysis → Deep NLP intent + entity extraction
 *              3. QuickIntents → Handle greeting, goodbye, cancel, check_appointment
 *              4. AutoAvailability → Auto-fetch appointments when context is known
 *              5. StateHandlers → State-specific handlers (date/time/doctor selection)
 *              6. AIGeneration → LLM call + tool execution loop
 *              7. Validation   → Hallucination guard, cleanup, silent token
 */

import type { PipelineContext, ProcessMessageResult } from '../types';
import { createDefaultStateContext } from '../types/state';
import { logger } from '../config';
import { limitEmojisPerLine } from '../utils/text';
import { getRecoveryMessage, incrementRetry, getStateContext } from '../state/UnifiedStateManager';
import { getOrCreateCachedConversation } from '../state/ConversationCache';

// Steps
import { identifyStep } from './steps/01-Identify';
import { intentAnalysisStep } from './steps/02-IntentAnalysis';
import { quickIntentsStep } from './steps/03-QuickIntents';
import { autoAvailabilityStep } from './steps/04-AutoAvailability';
import { stateHandlersStep } from './steps/05-StateHandlers';
import { aiGenerationStep } from './steps/06-AIGeneration';
import { validationStep } from './steps/07-Validation';

// ─── Pipeline Execution ────────────────────────────────────────────────────

/**
 * Process a WhatsApp message through the full pipeline.
 * This is the main entry point that replaces processWhatsAppMessage().
 */
export async function runPipeline(
  phone: string,
  message: string,
  messageHistory: Array<{ role: string; content: string }> = [],
): Promise<ProcessMessageResult> {
  const startTime = Date.now();
  const cleanPhone = phone.replace(/@.*/, '');

  // Initialize pipeline context
  const stateContext = getStateContext(cleanPhone);
  const conversationContext = getOrCreateCachedConversation(cleanPhone);

  const ctx: PipelineContext = {
    phone: cleanPhone,
    cleanPhone,
    rawMessage: message,
    message,
    messageHistory: messageHistory as Array<{ role: 'user' | 'assistant'; content: string }>,
    stateContext,
    conversationContext,
    startTime,
    executedTools: [],
    shouldStop: false,
    intent: undefined,
    entities: undefined,
    confidence: 0,
    enrichedContextPrompt: undefined,
    earlyResponse: undefined,
    aiResponseText: undefined,
    finalResponse: undefined,
    isSilent: false,
  };

  try {
    // Execute pipeline steps sequentially
    // Each step checks ctx.earlyResponse — if set, subsequent steps skip processing

    await identifyStep(ctx);
    await intentAnalysisStep(ctx);
    await quickIntentsStep(ctx);
    await autoAvailabilityStep(ctx);
    await stateHandlersStep(ctx);
    await aiGenerationStep(ctx);
    await validationStep(ctx);

    // Build result
    const duration = Date.now() - startTime;
    const state = getStateContext(cleanPhone);

    logger.info({
      phone: cleanPhone,
      duration,
      state: state.currentState,
      toolsCount: ctx.executedTools.length,
      intent: ctx.intent,
      hasFinalResponse: !!ctx.finalResponse,
      silent: ctx.isSilent,
    }, 'Pipeline completed');

    if (ctx.isSilent) {
      return {
        success: true,
        response: '',
        toolCalls: ctx.executedTools,
        intent: 'silent',
        silent: true,
      };
    }

    return {
      success: true,
      response: ctx.finalResponse || '',
      toolCalls: ctx.executedTools,
      intent: ctx.intent,
    };
  } catch (error: any) {
    logger.error({ error: error.message, phone: cleanPhone }, 'Pipeline error');
    incrementRetry(cleanPhone);

    const recovery = getRecoveryMessage(cleanPhone);
    const fallback = recovery || 'Disculpa, tuve un problema procesando tu solicitud. ¿Podrías repetirlo? Si el problema persiste, llámanos al 6076911308. 📞';

    return {
      success: false,
      response: limitEmojisPerLine(fallback, 1),
      toolCalls: ctx.executedTools,
      error: error.message,
      intent: 'error',
    };
  }
}
