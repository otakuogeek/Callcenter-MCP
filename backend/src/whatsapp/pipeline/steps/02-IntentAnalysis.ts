/**
 * @module whatsapp/pipeline/steps/02-IntentAnalysis
 * @description Pipeline step 2: Analyze user intent + extract entities.
 *              Uses WhatsAppEnhancedUnderstanding for deep NLP analysis.
 *              Also auto-saves detected specialty to state.
 */

import type { PipelineContext } from '../../types';
import { getStateContext, updateState } from '../../state/UnifiedStateManager';
import { logger } from '../../config';
import * as EnhancedUnderstanding from '../../../services/WhatsAppEnhancedUnderstanding';
import { updateContext, markQuestion, saveAnswer } from '../../../services/ConversationPersistence';

/**
 * Step 2: Deep intent analysis + entity extraction.
 */
export async function intentAnalysisStep(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.earlyResponse) return ctx; // Skip if already handled

  const { phone, message } = ctx;

  // Basic intent analysis
  const intentAnalysis = EnhancedUnderstanding.analyzeIntent(message);
  ctx.intent = intentAnalysis.primaryIntent;
  ctx.entities = intentAnalysis.entities;
  ctx.confidence = intentAnalysis.confidence;

  logger.info({
    phone,
    intent: ctx.intent,
    confidence: ctx.confidence,
    entities: ctx.entities,
    sentiment: intentAnalysis.sentiment,
    urgency: intentAnalysis.urgency,
  }, '🎯 Enhanced intent analysis');

  // Build enriched context with semantic memory
  try {
    const enrichedContext = await EnhancedUnderstanding.buildEnrichedContext(phone, message);
    if (enrichedContext) {
      const memoryPrompt = EnhancedUnderstanding.generateContextPrompt(enrichedContext);
      if (memoryPrompt) {
        ctx.enrichedContextPrompt = memoryPrompt;
      }

      // Auto-save detected specialty to state
      const detectedSpecialty = enrichedContext.intentAnalysis.entities.specialty;
      const stateContext = getStateContext(phone);

      if (detectedSpecialty && !stateContext.specialtyName) {
        updateState(phone, { specialtyName: detectedSpecialty });
        await updateContext(phone, { state: 'specialty_selection', selectedSpecialty: detectedSpecialty }).catch(() => {});
        await markQuestion(phone, 'especialidad').catch(() => {});
        await saveAnswer(phone, 'especialidad', detectedSpecialty).catch(() => {});
        logger.info({ specialty: detectedSpecialty }, '✅ Specialty saved to state from message');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Error building enriched context');
  }

  return ctx;
}
