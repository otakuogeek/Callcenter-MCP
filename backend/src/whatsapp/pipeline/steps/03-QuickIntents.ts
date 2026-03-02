/**
 * @module whatsapp/pipeline/steps/03-QuickIntents
 * @description Pipeline step 3: Handle quick intents that don't need AI.
 *              Greetings, goodbye, thanks, check_appointment, cancel, reschedule.
 */

import type { PipelineContext } from '../../types';
import { ConversationState } from '../../types/state';
import { getStateContext, updateState, resetState } from '../../state/UnifiedStateManager';
import { logger } from '../../config';
import { convertToColombiaTime, formatDate, formatTime } from '../../utils/date';
import DirectDBTools from '../../../services/DirectDBTools';
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

  // ── Greeting with patient → personalized hello ───────────────────────
  if (intent === 'greeting' && stateContext.patientId && stateContext.patientName) {
    ctx.earlyResponse = `¡Hola ${stateContext.patientName}! 😊 Qué gusto saludarte.\n\n¿En qué puedo ayudarte hoy?`;
    return ctx;
  }

  // ── Schedule intent → always ask for whom ────────────────────────────
  if (intent === 'schedule' && stateContext.patientId && stateContext.currentState !== ConversationState.AWAITING_BENEFICIARY) {
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

  // ── Check appointments ───────────────────────────────────────────────
  if (intent === 'check_appointment' && stateContext.patientId) {
    ctx.earlyResponse = await buildAppointmentCheckResponse(stateContext);
    return ctx;
  }

  // ── Cancel ───────────────────────────────────────────────────────────
  if (intent === 'cancel' && stateContext.patientId) {
    ctx.earlyResponse = await buildCancelResponse(phone, stateContext);
    return ctx;
  }

  // ── Reschedule ───────────────────────────────────────────────────────
  if (intent === 'reschedule' && stateContext.patientId) {
    ctx.earlyResponse = await buildRescheduleResponse(phone, stateContext);
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

// ─── Helpers ───────────────────────────────────────────────────────────────

async function buildAppointmentCheckResponse(state: any): Promise<string> {
  const [appointmentsResult, waitingListResult] = await Promise.all([
    DirectDBTools.getPatientAppointments({ patient_id: state.patientId, status: 'Confirmada' }),
    DirectDBTools.getPatientWaitingList({ patient_id: state.patientId }),
  ]);

  let response = '';

  if (appointmentsResult.success && appointmentsResult.data?.appointments?.length > 0) {
    const appts = appointmentsResult.data.appointments;
    response += `📋 **Tienes ${appts.length} cita(s) programada(s):**\n\n`;
    appts.forEach((apt: any, idx: number) => {
      const dt = convertToColombiaTime(apt.scheduled_date, apt.scheduled_time);
      response += `${idx + 1}. 📅 ${formatDate(dt.date)}\n   🕐 ${formatTime(dt.time)}\n   👨‍⚕️ ${apt.doctor_name || 'Por asignar'}\n   🏥 ${apt.specialty_name}\n   📍 ${apt.location_name}\n`;
      if (apt.reason) response += `   📝 ${apt.reason}\n`;
      response += '\n';
    });
  } else {
    response += '📅 No tienes citas programadas actualmente.\n\n';
  }

  if (waitingListResult.success && waitingListResult.data?.waiting_list?.length > 0) {
    const wl = waitingListResult.data.waiting_list;
    response += `⏳ **Lista de espera (${wl.length}):**\n\n`;
    wl.forEach((item: any, idx: number) => {
      response += `${idx + 1}. 🏥 ${item.specialty_name}\n`;
      if (item.priority_level && item.priority_level !== 'Normal') {
        response += `   ⚡ Prioridad: ${item.priority_level}\n`;
      }
      response += '\n';
    });
  }

  const hasAppts = appointmentsResult.success && appointmentsResult.data?.appointments?.length;
  const hasWL = waitingListResult.success && waitingListResult.data?.waiting_list?.length;
  if (!hasAppts && !hasWL) {
    return 'No tienes citas programadas ni solicitudes en lista de espera actualmente 📅\n\n¿Te gustaría agendar una cita? Solo dime qué especialidad necesitas 😊';
  }

  return response + '¿Necesitas algo más? 😊';
}

async function buildCancelResponse(phone: string, state: any): Promise<string> {
  const result = await DirectDBTools.getPatientAppointments({ patient_id: state.patientId, status: 'Confirmada' });
  if (!result.success || !result.data?.appointments?.length) {
    return 'No tienes citas confirmadas para cancelar en este momento. 📅\n\n¿Quieres agendar una nueva cita?';
  }
  const appts = result.data.appointments;
  updateState(phone, ConversationState.CANCELING_APPOINTMENT, { availableAppointments: appts });

  let response = '📋 Estas son tus citas confirmadas:\n\n';
  appts.forEach((apt: any, idx: number) => {
    const dt = convertToColombiaTime(apt.scheduled_date, apt.scheduled_time);
    response += `${idx + 1}. 📅 ${formatDate(dt.date)}\n   🕐 ${formatTime(dt.time)}\n   👨‍⚕️ ${apt.doctor_name || 'Por asignar'}\n   🏥 ${apt.specialty_name}\n   📍 ${apt.location_name}\n\n`;
  });
  return response + '¿Cuál cita deseas cancelar? Responde con el número.';
}

async function buildRescheduleResponse(phone: string, state: any): Promise<string> {
  const result = await DirectDBTools.getPatientAppointments({ patient_id: state.patientId, status: 'Confirmada' });
  if (!result.success || !result.data?.appointments?.length) {
    return 'No tienes citas confirmadas para reagendar en este momento. 📅\n\n¿Quieres agendar una nueva cita?';
  }
  const appts = result.data.appointments;
  updateState(phone, ConversationState.RESCHEDULING, { availableAppointments: appts });

  let response = '📋 Estas son tus citas confirmadas:\n\n';
  appts.forEach((apt: any, idx: number) => {
    const dt = convertToColombiaTime(apt.scheduled_date, apt.scheduled_time);
    response += `${idx + 1}. 📅 ${formatDate(dt.date)}\n   🕐 ${formatTime(dt.time)}\n   👨‍⚕️ ${apt.doctor_name || 'Por asignar'}\n   🏥 ${apt.specialty_name}\n   📍 ${apt.location_name}\n\n`;
  });
  return response + '¿Cuál cita deseas reagendar? Responde con el número.';
}
