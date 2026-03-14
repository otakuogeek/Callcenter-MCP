/**
 * @module whatsapp/pipeline/steps/07-Validation
 * @description Pipeline step 7: Post-processing validation.
 *              - Detect false scheduling claims (hallucination guard)
 *              - Auto-schedule if data is available
 *              - Replace placeholders with real IDs
 *              - Validate registration flow
 *              - Clean response text
 */

import type { PipelineContext } from '../../types';
import { ConversationState } from '../../types/state';
import { getStateContext, updateState, incrementRetry, getRecoveryMessage } from '../../state/UnifiedStateManager';
import { cleanResponseFromToolResults, limitEmojisPerLine, stripResidualPlaceholders } from '../../utils/text';
import { logger, SILENT_TOKENS } from '../../config';
import DirectDBTools from '../../../services/DirectDBTools';
import * as PersistenceService from '../../../services/WhatsAppPersistenceService';
import * as ChatMemoryService from '../../../services/ChatMemoryService';
import pool from '../../../db/pool';
import type { RowDataPacket } from 'mysql2';

async function getSessionIdForPhone(phone: string): Promise<number | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM whatsapp_chat_sessions WHERE phone = ? LIMIT 1', [phone],
    );
    return rows.length > 0 ? rows[0].id : null;
  } catch { return null; }
}

const FALSE_SCHEDULE_REGEX = new RegExp([
  'cita (ha sido|fue|está) (confirmada|agendada)',
  'tu cita.*(confirmada|agendada)',
  '(he |ya |te )?agend(ado|ada|é|amos)',
  'cita #\\d+',
  'Cita #.*\\d+',
  'confirmada.*cita',
  'registrada tu cita',
  'tu cita.*queda.*para',
  'cita ha sido exitosamente',
  'cita quedó programada',
  '¡listo!.*cita',
].join('|'), 'i');

const PLACEHOLDER_REGEX = /\[data\.|data\.appointment_id\]|\[appointment_id\]|\[esperando.*herramienta\]/i;

/**
 * Step 7: Validate and clean the AI response.
 */
export async function validationStep(ctx: PipelineContext): Promise<PipelineContext> {
  // If early response was set, just clean and return
  if (ctx.earlyResponse) {
    ctx.finalResponse = limitEmojisPerLine(ctx.earlyResponse, 1);
    return ctx;
  }

  let text = ctx.aiResponseText || '';
  const { phone } = ctx;
  const state = getStateContext(phone);
  // Only consider schedule as "executed" if scheduleAppointment specifically ran (not any tool error)
  const scheduleExecuted = ctx.executedTools.some(t =>
    t.name === 'scheduleAppointment' ||
    t.name.includes('YA AGENDADA') ||
    t.name === 'scheduleAppointment (ERROR)',
  );

  // 7A: Replace placeholders with real IDs
  if (PLACEHOLDER_REGEX.test(text) && state.lastAppointmentId) {
    text = text
      .replace(/\[data\.appointment_id\]/gi, String(state.lastAppointmentId))
      .replace(/data\.appointment_id/gi, String(state.lastAppointmentId))
      .replace(/\[esperando.*herramienta\]/gi, String(state.lastAppointmentId))
      .replace(/\*\*Cita #\*\*:\s*\[.*?\]/gi, `**Cita #**: ${state.lastAppointmentId}`)
      .replace(/Cita #\*:\s*\[.*?\]/gi, `Cita #*: ${state.lastAppointmentId}`);
  }

  // 7B: Detect false scheduling claims
  const claimsScheduled = FALSE_SCHEDULE_REGEX.test(text);
  const hasPlaceholders = PLACEHOLDER_REGEX.test(text);

  if ((claimsScheduled || hasPlaceholders) && !scheduleExecuted && !state.lastAppointmentId) {
    text = await handleFalseScheduleClaim(phone, state, text);
  }

  // 7C: Clean tool results from text
  text = cleanResponseFromToolResults(text);

  // 7D: Validate AWAITING_PATIENT_DATA asks for name
  if (state.currentState === ConversationState.AWAITING_PATIENT_DATA && state.registrationPending) {
    if (!/nombre completo|tu nombre|cómo te llamas|datos|crear.*perfil|registr/i.test(text)) {
      text = `No encuentro tu registro en el sistema con el documento ${state.patientDocument || 'proporcionado'}. 😊 Para poder ayudarte, necesito crear tu perfil.\n\n¿Cuál es tu nombre completo (nombres y apellidos)?`;
    }
  }

  // 7E: Strip residual placeholders
  text = stripResidualPlaceholders(text);

  // 7F: Final false-claim guard
  const finalCheck = getStateContext(phone);
  const claimsFinal = /cita.*(?:agendada|confirmada|programada)|ha sido (?:agendada|confirmada)|Cita #\s*\[|Cita #:\s*\[|\[número de cita\]/i.test(text);
  if (claimsFinal && !finalCheck.lastAppointmentId) {
    text = await handleFalseScheduleClaim(phone, finalCheck, text);
  }

  // 7G: Empty response recovery
  if (!text || text.trim().length < 10) {
    const recovery = getRecoveryMessage(phone);
    text = recovery || 'Disculpa, ¿puedes repetir eso? No te entendí bien. 😊';
    incrementRetry(phone);
  }

  // 7H: Limit emojis
  text = limitEmojisPerLine(text, 1);

  // 7I: Silent token check
  const isSilent = SILENT_TOKENS.some(t => text.includes(t) || text.trim() === t.replace(/[\[\]{}><]/g, ''));
  if (isSilent) {
    ctx.finalResponse = '';
    ctx.isSilent = true;
    return ctx;
  }

  ctx.finalResponse = text;
  return ctx;
}

// ─── False Schedule Claim Handler ──────────────────────────────────────────

async function handleFalseScheduleClaim(phone: string, state: any, originalText: string): Promise<string> {
  if (!state.patientId || !state.availabilityId) {
    return !state.patientId ? '¿Me das tu número de cédula?' : '¿Para qué fecha y hora quieres la cita?';
  }

  // Check for recent scheduling
  const wasAlready = await PersistenceService.wasScheduleAppointmentExecuted(phone, 5);
  if (wasAlready) {
    const last = await PersistenceService.getLastScheduledAppointment(phone);
    if (last) {
      return `Ya tienes una cita agendada recientemente:\n\n• **Doctor(a):** ${last.doctor_name || 'Asignado'}\n• **Fecha:** ${last.scheduled_date}\n• **Hora:** ${last.scheduled_time}\n• **Sede:** ${last.location_name || 'Sede principal'}\n• **Cita #${last.appointment_id}**\n\n¿Hay algo más en lo que pueda ayudarte? 😊`;
    }
  }

  // Auto-schedule attempt
  try {
    const params: Record<string, any> = {
      patient_id: state.patientId,
      availability_id: state.availabilityId,
      appointment_type: 'Presencial',
      priority_level: 'Normal',
    };
    if (state.scheduledDatetime) params.scheduled_date = state.scheduledDatetime;
    else if (state.selectedDate && state.selectedTime) params.scheduled_date = `${state.selectedDate} ${state.selectedTime}`;
    else if (state.selectedDate) params.scheduled_date = state.selectedDate;
    params.reason = state.specialtyName ? `Consulta de ${state.specialtyName}` : 'Consulta médica';

    const result = await DirectDBTools.scheduleAppointment(params as any);
    if (result.success && result.data?.appointment_id) {
      updateState(phone, ConversationState.COMPLETED, { lastAppointmentId: result.data.appointment_id });

      // Persist
      try {
        const sessionId = await getSessionIdForPhone(phone);
        await PersistenceService.recordScheduledAppointment({
          session_id: sessionId || 0, phone,
          patient_id: state.patientId, appointment_id: result.data.appointment_id,
          availability_id: state.availabilityId, doctor_name: result.data.doctor_name,
          specialty_name: result.data.specialty_name || state.specialtyName,
          scheduled_date: result.data.appointment_date || state.selectedDate,
          scheduled_time: result.data.hora_cita_local || state.selectedTime,
          location_name: result.data.location_name, status: 'scheduled',
        });
        if (sessionId) {
          await ChatMemoryService.updateSessionAppointmentSelection(sessionId, { last_appointment_id: result.data.appointment_id });
          await ChatMemoryService.resetSessionAppointmentSelection(sessionId);
        }
      } catch {}

      const d = result.data;
      return `¡Listo! Tu cita quedó agendada:\n\n📅 ${d.fecha_cita_local || d.appointment_date_formatted || state.selectedDate}\n🕐 ${d.hora_cita_local || d.scheduled_time_formatted || state.selectedTime}\n👨‍⚕️ ${d.doctor_name || state.selectedDoctor}\n📍 Sede San Gil\n🎫 Cita #${d.appointment_id}\n\n¡Te esperamos! 😊`;
    }
    return 'No pude confirmar la cita. 😔 ¿Me confirmas la fecha y hora?';
  } catch {
    return 'Hubo un problema. 😔 ¿Me repites la fecha y hora que quieres?';
  }
}
