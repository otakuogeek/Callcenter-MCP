/**
 * @module whatsapp/pipeline/steps/03-QuickIntents
 * @description Pipeline step 3: Handle quick intents that don't need AI.
 *              Greetings, goodbye, thanks, check_appointment, cancel, reschedule.
 */

import type { PipelineContext } from '../../types';
import { ConversationState } from '../../types/state';
import { getStateContext, updateState, resetState } from '../../state/UnifiedStateManager';
import { logger } from '../../config';
import { personalityManager } from '../../../services/WhatsAppPersonality';

/**
 * Step 3: Resolve quick intents directly without calling AI.
 */
export async function quickIntentsStep(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.earlyResponse) return ctx;

  const { phone, message, intent } = ctx;
  const stateContext = getStateContext(phone);

  // ── Greeting without patient → ask for cédula ────────────────────────
  if (intent === 'greeting' && !stateContext.patientId) {
    updateState(phone, ConversationState.AWAITING_DOCUMENT);
    ctx.earlyResponse = '¡Hola! 😊 Soy Valeria de Fundación Biosanar IPS.\n\nPara atenderte mejor, ¿me compartes tu número de cédula?';
    return ctx;
  }

  // ── Greeting with patient → personalized hello + ask for whom ─────────
  if (intent === 'greeting' && stateContext.patientId && stateContext.patientName) {
    const firstName = stateContext.patientName.split(' ')[0];
    if (stateContext.currentState === ConversationState.AWAITING_BENEFICIARY) {
      ctx.earlyResponse = `¡Hola ${firstName}! 😊 Qué gusto saludarte.\n\n¿La cita es para ti o para otra persona?\n\n1. 🙋 *Para mí*\n2. 👥 *Para otra persona*`;
    } else {
      ctx.earlyResponse = `¡Hola ${stateContext.patientName}! 😊 Qué gusto saludarte.\n\n¿En qué puedo ayudarte hoy?`;
    }
    return ctx;
  }

  // ── Schedule intent → always ask for whom ────────────────────────────
  // Only re-route if NOT already deep in a scheduling flow
  const activeSchedulingStates: ConversationState[] = [
    ConversationState.AWAITING_SPECIALTY,
    ConversationState.AWAITING_LOCATION,
    ConversationState.AWAITING_CUPS,
    ConversationState.AWAITING_DOUBLE_APPOINTMENT,
    ConversationState.AWAITING_DATE,
    ConversationState.AWAITING_TIME,
    ConversationState.AWAITING_REASON,
    ConversationState.AWAITING_DOCTOR_SELECTION,
    ConversationState.AWAITING_CONFIRMATION,
  ];
  if (intent === 'schedule' && stateContext.patientId && stateContext.currentState !== ConversationState.AWAITING_BENEFICIARY && !activeSchedulingStates.includes(stateContext.currentState)) {
    const requestorName = stateContext.patientName || '';
    updateState(phone, ConversationState.AWAITING_BENEFICIARY, {
      requestorPatientId: stateContext.patientId,
      requestorPatientName: stateContext.patientName,
      requestorPatientDocument: stateContext.patientDocument,
    });
    const firstName = requestorName.split(' ')[0];
    ctx.earlyResponse = `¡Con gusto${firstName ? ', ' + firstName : ''}! 😊\n\n¿La cita es para ti o para otra persona?`;
    return ctx;
  }

  // ── Check appointments → redirect to portal ─────────────────────────────────
  if (intent === 'check_appointment' && stateContext.patientId) {
    const firstName = stateContext.patientName?.split(' ')[0] || '';
    ctx.earlyResponse = `${firstName ? firstName + ', para' : 'Para'} consultar tus citas puedes ingresar a nuestro portal web:\n\n🌐 *biosanarcall.site*\n\nAllí podrás ver todas tus citas programadas y listas de espera con tu número de cédula. 😊\n\n¿Necesitas algo más?`;
    return ctx;
  }

  // ── Cancel → redirect to portal ─────────────────────────────────────
  if (intent === 'cancel' && stateContext.patientId) {
    const firstName = stateContext.patientName?.split(' ')[0] || '';
    ctx.earlyResponse = `${firstName ? firstName + ', para' : 'Para'} cancelar una cita puedes hacerlo desde nuestro portal web:\n\n🌐 *biosanarcall.site*\n\nIngresa con tu número de cédula y podrás gestionar tus citas. 😊\n\n¿Necesitas algo más?`;
    return ctx;
  }

  // ── Reschedule → redirect to portal ─────────────────────────────────
  if (intent === 'reschedule' && stateContext.patientId) {
    const firstName = stateContext.patientName?.split(' ')[0] || '';
    ctx.earlyResponse = `${firstName ? firstName + ', para' : 'Para'} reagendar una cita puedes hacerlo desde nuestro portal web:\n\n🌐 *biosanarcall.site*\n\nIngresa con tu número de cédula y podrás gestionar tus citas. 😊\n\n¿Necesitas algo más?`;
    return ctx;
  }

  // ── Quick personality responses (thanks, goodbye, help...) ───────────
  const quickResponse = personalityManager.generateContextualResponse(intent!, phone);
  if (quickResponse && ['thanks', 'goodbye', 'help', 'complaint', 'price_query', 'info'].includes(intent || '')) {
    let personalized = quickResponse;
    if (stateContext.patientName && !quickResponse.includes(stateContext.patientName)) {
      const firstName = stateContext.patientName.split(' ')[0];
      if (intent === 'goodbye') {
        personalized = quickResponse.replace('!', `, ${firstName}!`);
      }
    }
    personalityManager.addMessage(phone, 'user', message);
    personalityManager.addMessage(phone, 'assistant', personalized);
    ctx.earlyResponse = personalized;
    return ctx;
  }

  return ctx;
}
