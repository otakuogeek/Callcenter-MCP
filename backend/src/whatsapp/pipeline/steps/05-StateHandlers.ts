/**
 * @module whatsapp/pipeline/steps/05-StateHandlers
 * @description Pipeline step 5: Handle state-specific user interactions.
 *              AWAITING_PHONE_CONFIRMATION, CANCELING_APPOINTMENT, RESCHEDULING,
 *              AWAITING_DOCTOR_SELECTION, AWAITING_DATE, AWAITING_TIME, AWAITING_REASON.
 */

import type { PipelineContext } from '../../types';
import { ConversationState } from '../../types/state';
import { getStateContext, updateState, resetState } from '../../state/UnifiedStateManager';
import { isAffirmative, isNegative } from '../../utils/validation';
import { convertToColombiaTime, formatDate, formatTime } from '../../utils/date';
import { logger } from '../../config';
import DirectDBTools from '../../../services/DirectDBTools';
import * as PersistenceService from '../../../services/WhatsAppPersistenceService';

/**
 * Step 5: State-specific interaction handlers.
 */
export async function stateHandlersStep(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.earlyResponse) return ctx;

  const { phone, message } = ctx;
  const stateContext = getStateContext(phone);
  const normalizedMsg = message.trim().toLowerCase();

  switch (stateContext.currentState) {
    case ConversationState.AWAITING_BENEFICIARY:
      return handleBeneficiaryQuestion(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_PHONE_CONFIRMATION:
      return handlePhoneConfirmation(ctx, stateContext, normalizedMsg);

    case ConversationState.CANCELING_APPOINTMENT:
      return handleCancelSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.RESCHEDULING:
      return handleRescheduleSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_DOCTOR_SELECTION:
      return handleDoctorSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_DATE:
      return handleDateSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_TIME:
      return handleTimeSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_REASON:
      return handleAutoSchedule(ctx, stateContext, message);

    case ConversationState.COMPLETED:
      return handleCompletedCycle(ctx, stateContext, normalizedMsg);

    default:
      return ctx;
  }
}

// ─── Beneficiary Question ─────────────────────────────────────────────────

async function handleBeneficiaryQuestion(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;

  const isForSelf = isAffirmative(ctx.message) ||
    /para m[ií]|es para m[ií]|yo mismo|soy yo|la m[ií]a|mi cita|para mi/i.test(msg);

  const isForOther = /otra persona|para otro|para ella|para él|para alguien|familiar|tercero|mi (esposa|esposo|mam[aá]|pap[aá]|hij[ao]|hermano|hermana|pareja|abuelo|abuela)/i.test(msg) ||
    (!isForSelf && isNegative(ctx.message));

  // Raw cedula — let 01-Identify handle via isBeneficiaryFlow
  const cleanMsg = ctx.message.replace(/[.\-\s,]/g, '');
  if (/^\d{6,12}$/.test(cleanMsg)) {
    updateState(phone, ConversationState.AWAITING_BENEFICIARY, { isThirdParty: true });
    return ctx;
  }

  if (isForSelf) {
    const requestorId = state.requestorPatientId || state.patientId;
    const requestorName = state.requestorPatientName || state.patientName;
    const requestorDoc = state.requestorPatientDocument || state.patientDocument;
    updateState(phone, ConversationState.AWAITING_SPECIALTY, {
      patientId: requestorId,
      patientName: requestorName,
      patientDocument: requestorDoc,
      isThirdParty: false,
    });
    const firstName = requestorName?.split(' ')[0] || '';
    ctx.earlyResponse = `¡Perfecto${firstName ? ', ' + firstName : ''}! 😊 ¿Para qué especialidad necesitas la cita?`;
    return ctx;
  }

  if (isForOther) {
    updateState(phone, ConversationState.AWAITING_DOCUMENT, { isThirdParty: true });
    ctx.earlyResponse = `¡Con gusto! 😊 ¿Me das el número de cédula de la persona que necesita la cita?`;
    return ctx;
  }

  ctx.earlyResponse = `¿La cita es para ti o es para otra persona? 😊\nResponde “para mí” o “para otra persona”.`;
  return ctx;
}

// ─── Completed Cycle ──────────────────────────────────────────────────────

async function handleCompletedCycle(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;

  if (isAffirmative(ctx.message) || /otra cita|nueva cita|agendar otra|más citas|otro turno/i.test(msg)) {
    const requestorId = state.requestorPatientId || state.patientId;
    const requestorName = state.requestorPatientName || state.patientName;
    const requestorDoc = state.requestorPatientDocument || state.patientDocument;
    updateState(phone, ConversationState.AWAITING_BENEFICIARY, {
      patientId: requestorId,
      patientName: requestorName,
      patientDocument: requestorDoc,
      requestorPatientId: requestorId,
      requestorPatientName: requestorName,
      requestorPatientDocument: requestorDoc,
      specialtyId: undefined,
      specialtyName: undefined,
      selectedDoctor: undefined,
      selectedDoctorId: undefined,
      selectedDate: undefined,
      selectedTime: undefined,
      scheduledDatetime: undefined,
      availabilityId: undefined,
      timeSlots: undefined,
      availableAppointments: undefined,
      isThirdParty: undefined,
      reason: undefined,
    });
    const firstName = requestorName?.split(' ')[0] || '';
    ctx.earlyResponse = `¡Con gusto${firstName ? ', ' + firstName : ''}! 😊 ¿La nueva cita es para ti o para otra persona?`;
    return ctx;
  }

  if (isNegative(ctx.message)) {
    resetState(phone);
    const name = state.requestorPatientName || state.patientName || '';
    const firstName = name.split(' ')[0];
    ctx.earlyResponse = `¡Perfecto${firstName ? ', ' + firstName : ''}! Fue un gusto atenderte. ¡Hasta pronto! 😊`;
    return ctx;
  }

  return ctx;
}

// ─── Phone Confirmation ────────────────────────────────────────────────────

async function handlePhoneConfirmation(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;
  const patientName = state.patientName || 'paciente';

  if (isAffirmative(ctx.message)) {
    // After confirming identity, always ask for whom the appointment is
    updateState(phone, ConversationState.AWAITING_BENEFICIARY, {
      requestorPatientId: state.patientId,
      requestorPatientName: state.patientName,
      requestorPatientDocument: state.patientDocument,
    });
    const firstName = (state.patientName || '').split(' ')[0];
    ctx.earlyResponse = `¡Perfecto, ${firstName || patientName}! 😊\n\n¿La cita es para ti o para otra persona?`;
    return ctx;
  }

  if (isNegative(ctx.message)) {
    ctx.earlyResponse = 'Entendido. ¿Cuál es tu número de teléfono correcto? 📱';
    return ctx;
  }

  // Might be a new phone number
  const cleanedMsg = msg.replace(/[\s\-\.\(\)]/g, '');
  if (/^\d{7,15}$/.test(cleanedMsg)) {
    updateState(phone, ConversationState.AWAITING_SPECIALTY);
    ctx.earlyResponse = `¡Perfecto ${patientName}! He registrado tu número ${cleanedMsg}. 😊 ¿Qué tipo de cita necesitas?`;
    return ctx;
  }

  return ctx; // Fall through to AI
}

// ─── Cancel Selection ──────────────────────────────────────────────────────

async function handleCancelSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const appts = state.availableAppointments || [];
  if (!appts.length) {
    updateState(ctx.phone, ConversationState.IDLE);
    ctx.earlyResponse = 'No encuentro citas confirmadas para cancelar. ¿Quieres consultar tus citas o agendar una nueva?';
    return ctx;
  }
  const match = msg.match(/\d+/);
  const idx = match ? parseInt(match[0], 10) - 1 : -1;
  if (idx < 0 || idx >= appts.length) {
    ctx.earlyResponse = 'Por favor responde con el número de la cita que deseas cancelar. 📋';
    return ctx;
  }
  const selected = appts[idx];
  const result = await DirectDBTools.cancelAppointment({ appointment_id: selected.appointment_id, reason: 'Cancelada por paciente' });
  if (!result.success) {
    ctx.earlyResponse = 'No pude cancelar la cita en este momento. ¿Quieres intentar de nuevo?';
    return ctx;
  }
  updateState(ctx.phone, ConversationState.COMPLETED, { appointmentToCancel: undefined });
  const dt = convertToColombiaTime(selected.scheduled_date, selected.scheduled_time);
  ctx.earlyResponse = `✅ Tu cita de ${selected.specialty_name} para el ${formatDate(dt.date)} a las ${formatTime(dt.time)} fue cancelada correctamente.`;
  return ctx;
}

// ─── Reschedule Selection ──────────────────────────────────────────────────

async function handleRescheduleSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const appts = state.availableAppointments || [];
  if (!appts.length) {
    updateState(ctx.phone, ConversationState.IDLE);
    ctx.earlyResponse = 'No encuentro citas confirmadas para reagendar. ¿Quieres consultar tus citas o agendar una nueva?';
    return ctx;
  }
  const match = msg.match(/\d+/);
  const idx = match ? parseInt(match[0], 10) - 1 : -1;
  if (idx < 0 || idx >= appts.length) {
    ctx.earlyResponse = 'Por favor responde con el número de la cita que deseas reagendar. 📋';
    return ctx;
  }
  const selected = appts[idx];
  const cancelResult = await DirectDBTools.cancelAppointment({ appointment_id: selected.appointment_id, reason: 'Reagendada por paciente' });
  if (!cancelResult.success) {
    ctx.earlyResponse = 'No pude cancelar la cita actual para reagendar. ¿Quieres intentar de nuevo?';
    return ctx;
  }
  const availResult = await DirectDBTools.getAvailableAppointments({ specialty_id: selected.specialty_id, specialty_name: selected.specialty_name });
  if (availResult.success && availResult.data?.appointments?.length > 0) {
    const newAppts = availResult.data.appointments;
    updateState(ctx.phone, ConversationState.AWAITING_DOCTOR_SELECTION, {
      availableAppointments: newAppts, availableDoctors: availResult.data.unique_doctors || [],
      specialtyName: selected.specialty_name, specialtyId: selected.specialty_id,
    });
    let response = `✅ Tu cita fue cancelada y ahora vamos a reagendarla. Para ${selected.specialty_name}:\n\n`;
    newAppts.slice(0, 5).forEach((apt: any, i: number) => {
      response += `${i + 1}. 👨‍⚕️ ${apt.doctor_name}\n   📅 ${apt.appointment_date_formatted || apt.appointment_date}\n   🕐 ${apt.start_time_formatted || apt.start_time}\n   📍 ${apt.location_name}\n\n`;
    });
    response += '¿Cuál opción prefieres? 😊';
    ctx.earlyResponse = response;
    return ctx;
  }

  updateState(ctx.phone, ConversationState.AWAITING_SPECIALTY);
  ctx.earlyResponse = `Cancelé tu cita, pero no encontré disponibilidad inmediata para ${selected.specialty_name}. ¿Quieres otra especialidad o te agrego a la lista de espera?`;
  return ctx;
}

// ─── Doctor Selection ──────────────────────────────────────────────────────

async function handleDoctorSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const doctors = state.availableDoctors || [];
  if (doctors.length === 0) return ctx;

  let selectedIndex: number | null = null;

  // Match by number
  const numPatterns = [/^(?:el )?primero?$/i, /^(?:el )?1$/, /^(?:el )?segundo$/i, /^(?:el )?2$/, /^(?:el )?tercero$/i, /^(?:el )?3$/, /^opci[oó]n\s*(\d)$/i, /^(\d)$/];
  for (const p of numPatterns) {
    const m = msg.match(p);
    if (m) {
      if (/primero?/i.test(msg) || msg === '1') selectedIndex = 0;
      else if (/segundo/i.test(msg) || msg === '2') selectedIndex = 1;
      else if (/tercero/i.test(msg) || msg === '3') selectedIndex = 2;
      else if (m[1]) selectedIndex = parseInt(m[1]) - 1;
      break;
    }
  }

  // Match by name
  if (selectedIndex === null) {
    for (let i = 0; i < doctors.length; i++) {
      const dn = doctors[i].toLowerCase();
      if (msg.includes(dn) || dn.includes(msg)) { selectedIndex = i; break; }
      for (const part of dn.split(' ')) {
        if (part.length > 3 && msg.includes(part)) { selectedIndex = i; break; }
      }
      if (selectedIndex !== null) break;
    }
  }

  if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < doctors.length) {
    const selectedDoctor = doctors[selectedIndex];
    const appts = state.availableAppointments || [];
    const doctorAppt = appts.find((a: any) => a.doctor_name?.toLowerCase() === selectedDoctor.toLowerCase());
    const update: Record<string, any> = { selectedDoctor };
    if (doctorAppt) {
      update.availabilityId = doctorAppt.availability_id;
      update.selectedDoctorId = doctorAppt.doctor_id;
      update.selectedDate = doctorAppt.appointment_date;
      update.specialtyId = doctorAppt.specialty_id;
    }
    updateState(ctx.phone, ConversationState.AWAITING_DATE, update);
    // Don't set earlyResponse — let AI present dates or let date step handle it
  }

  return ctx;
}

// ─── Date Selection ────────────────────────────────────────────────────────

async function handleDateSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const availAppts = state.availableAppointments || [];
  if (!availAppts.length) return ctx;

  const datePatterns = [
    /(?:el\s+)?(?:día\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*(\d{1,2})?/i,
    /(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
    /(?:fecha|opci[oó]n)\s*(\d+)/i, /^(\d)$/,
    /(?:me gusta(?:ría)?|prefiero|quiero|para)\s+(?:el\s+)?(\w+\s*\d*)/i,
  ];

  let dateMatched = false;
  for (const p of datePatterns) { if (p.test(msg)) { dateMatched = true; break; } }
  if (!dateMatched) return ctx;

  const uniqueDates = [...new Set(availAppts.map((a: any) => a.appointment_date_formatted))] as string[];
  let selectedFmt: string | null = null;

  // By option number
  const numMatch = msg.match(/(?:opci[oó]n\s*)?(\d)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1;
    if (idx >= 0 && idx < uniqueDates.length) selectedFmt = uniqueDates[idx];
  }

  // By day name
  if (!selectedFmt) {
    const days = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
    for (const d of days) {
      if (msg.includes(d)) {
        selectedFmt = uniqueDates.find(f =>
          f.toLowerCase().includes(d) ||
          (d === 'miercoles' && f.toLowerCase().includes('miércoles')) ||
          (d === 'sabado' && f.toLowerCase().includes('sábado'))
        ) || null;
        if (selectedFmt) break;
      }
    }
  }

  // By day number
  if (!selectedFmt) {
    const dayNumMatch = msg.match(/(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(\w+)?/i);
    if (dayNumMatch) {
      const dayNum = dayNumMatch[1];
      const month = dayNumMatch[2] || '';
      selectedFmt = uniqueDates.find(f => {
        const l = f.toLowerCase();
        if (month && l.includes(month.toLowerCase())) return l.includes(dayNum);
        return l.includes(` ${dayNum} `);
      }) || null;
    }
  }

  // Single option
  if (!selectedFmt && uniqueDates.length === 1) selectedFmt = uniqueDates[0];

  if (!selectedFmt) return ctx;

  const matchingAppts = availAppts.filter((a: any) => a.appointment_date_formatted === selectedFmt);
  if (!matchingAppts.length) return ctx;

  const selected = matchingAppts[0];
  const doctorId = state.selectedDoctorId || selected.doctor_id;
  const doctorName = state.selectedDoctor || selected.doctor_name;

  const slotsResult = await DirectDBTools.getAvailableTimeSlotsForDoctorOnDate({
    doctor_id: doctorId, date: selected.appointment_date, specialty_id: state.specialtyId || selected.specialty_id,
  });

  if (slotsResult.success && slotsResult.data?.available_times?.length > 0) {
    const times = slotsResult.data.available_times_formatted || slotsResult.data.available_times;
    const detail = slotsResult.data.slots_detail || [];

    updateState(ctx.phone, ConversationState.AWAITING_TIME, {
      timeSlots: detail, selectedDate: selected.appointment_date,
      selectedDoctor: doctorName, selectedDoctorId: doctorId,
      availabilityId: selected.availability_id, specialtyId: state.specialtyId || selected.specialty_id,
    });

    const dateLabel = slotsResult.data.date_formatted || selectedFmt;
    let response = `¡Excelente elección! 😊 Para el ${dateLabel}, tenemos estos horarios disponibles:\n\n`;
    times.slice(0, 5).forEach((t: string, i: number) => { response += `${i + 1}. ${t}\n`; });
    if (times.length > 5) response += `\n... y ${times.length - 5} horarios más.`;
    response += '\n\n¿Cuál horario te queda mejor? 🕐';

    ctx.executedTools.push({ name: 'getAvailableTimeSlotsForDoctorOnDate', result: `${times.length} slots` });
    ctx.earlyResponse = response;
    return ctx;
  }

  if (slotsResult.success && slotsResult.data?.available_times?.length === 0) {
    ctx.earlyResponse = `Lo siento, no hay horarios disponibles para el ${slotsResult.data.date_formatted || selectedFmt}. 😕\n\n¿Te gustaría ver otra fecha o te agrego a la lista de espera?`;
    return ctx;
  }

  return ctx;
}

// ─── Time Selection ────────────────────────────────────────────────────────

async function handleTimeSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const timeSlots = state.timeSlots || [];
  if (!timeSlots.length) return ctx;

  // "More options" request
  if (/m[aá]s\s*(opciones|horarios)|otras?\s*(opciones|horarios)|otro\s*horario/i.test(msg)) {
    const allTimes = timeSlots.map((s: any) => s.time_formatted || s.time_colombia);
    let response = '¡Claro! 😊 Estos son todos los horarios disponibles:\n\n';
    allTimes.forEach((t: string) => { response += `• ${t}\n`; });
    response += '\n¿Cuál te queda mejor?';
    ctx.earlyResponse = response;
    return ctx;
  }

  // Match by specific time (e.g. "1 pm", "2 de la tarde")
  const timePatterns = [
    /(\d{1,2})\s*(?:de la)?\s*(tarde|pm)/i,
    /(\d{1,2})\s*(?:de la)?\s*(mañana|am)/i,
    /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
    /a las?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  ];

  let requestedHour: number | null = null;
  let requestedMinute = 0;
  let isPM = false;
  let isAM = false;

  for (const p of timePatterns) {
    const m = msg.match(p);
    if (m) {
      requestedHour = parseInt(m[1]);
      if (m[2] && /^\d{2}$/.test(m[2])) requestedMinute = parseInt(m[2]);
      const ampm = m[3] || m[2] || '';
      if (/pm|tarde/i.test(ampm)) isPM = true;
      else if (/am|mañana/i.test(ampm)) isAM = true;
      break;
    }
  }

  if (requestedHour !== null) {
    const foundSlot = findTimeSlot(timeSlots, requestedHour, requestedMinute, isPM, isAM);
    if (foundSlot) {
      const selectedTime = typeof foundSlot === 'string' ? foundSlot : (foundSlot.time_formatted || foundSlot.time);
      const scheduledDatetime = typeof foundSlot === 'object' ? foundSlot.scheduled_datetime : null;
      if (scheduledDatetime) updateState(ctx.phone, ConversationState.AWAITING_REASON, { selectedTime, scheduledDatetime });
      else updateState(ctx.phone, ConversationState.AWAITING_REASON);
      ctx.earlyResponse = `¡Perfecto! Has seleccionado las ${selectedTime}. 📋 ¿Cuál es el motivo de tu consulta?`;
      return ctx;
    } else {
      const available = timeSlots.slice(0, 5).map((s: any) => typeof s === 'string' ? s : (s.time_formatted || s.time)).join(', ');
      ctx.earlyResponse = `Disculpa, ese horario no está disponible. Los horarios que tenemos son: ${available}. ¿Cuál prefieres?`;
      return ctx;
    }
  }

  // Match by index number
  const numMatch = msg.match(/^(\d{1,2})$/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    if (n >= 1 && n <= Math.min(10, timeSlots.length)) {
      const slot = timeSlots[n - 1];
      const selectedTime = typeof slot === 'string' ? slot : (slot.time_formatted || slot.time);
      const scheduledDatetime = typeof slot === 'object' ? slot.scheduled_datetime : null;
      if (scheduledDatetime) updateState(ctx.phone, ConversationState.AWAITING_REASON, { selectedTime, scheduledDatetime });
      else updateState(ctx.phone, ConversationState.AWAITING_REASON);
      ctx.earlyResponse = `¡Perfecto! Has seleccionado las ${selectedTime}. 📋 ¿Cuál es el motivo de tu consulta?`;
      return ctx;
    }
  }

  // "mañana" / "tarde" shortcuts
  if (/mañana|temprano|primera hora/i.test(msg)) {
    const first = timeSlots[0];
    const t = typeof first === 'string' ? first : (first.time_formatted || first.time);
    updateState(ctx.phone, ConversationState.AWAITING_REASON);
    ctx.earlyResponse = `¡Perfecto! Te agendo a primera hora, a las ${t}. 📋 ¿Cuál es el motivo de tu consulta?`;
    return ctx;
  }

  if (/tarde/i.test(msg)) {
    const afternoon = timeSlots.find((s: any) => {
      const t = typeof s === 'string' ? s : (s.time_formatted || s.time);
      return /PM/i.test(t);
    });
    if (afternoon) {
      const t = typeof afternoon === 'string' ? afternoon : (afternoon.time_formatted || afternoon.time);
      updateState(ctx.phone, ConversationState.AWAITING_REASON);
      ctx.earlyResponse = `¡Perfecto! Te agendo en la tarde, a las ${t}. 📋 ¿Cuál es el motivo de tu consulta?`;
      return ctx;
    }
  }

  return ctx;
}

// ─── Auto-schedule (AWAITING_REASON) ───────────────────────────────────────

async function handleAutoSchedule(ctx: PipelineContext, state: any, message: string): Promise<PipelineContext> {
  if (message.length <= 3 || !state.patientId || !state.availabilityId || !state.scheduledDatetime) return ctx;

  const wasAlreadyScheduled = await PersistenceService.wasScheduleAppointmentExecuted(ctx.phone, 5);
  if (wasAlreadyScheduled) {
    const last = await PersistenceService.getLastScheduledAppointment(ctx.phone);
    ctx.earlyResponse = `Ya tienes una cita confirmada:\n\n• **Cita #${last?.appointment_id}**\n• **Doctor:** ${last?.doctor_name}\n• **Fecha:** ${last?.scheduled_date}\n• **Hora:** ${last?.scheduled_time}\n\n¿Necesitas algo más? 😊`;
    return ctx;
  }

  const reason = message.length > 100 ? message.substring(0, 100) : message;
  try {
    const result = await DirectDBTools.scheduleAppointment({
      patient_id: state.patientId!, availability_id: state.availabilityId,
      scheduled_date: state.scheduledDatetime, reason,
      priority_level: 'Normal',
    });

    if (result.success) {
      const d = result.data;
      const firstName = state.patientName?.split(' ')[0] || '';
      const beneficiaryNote = state.isThirdParty
        ? `\n• **Paciente:** ${state.patientName || 'Beneficiario'}`
        : '';
      updateState(ctx.phone, ConversationState.COMPLETED, { lastAppointmentId: d.appointment_id });
      ctx.earlyResponse = `¡Listo${firstName ? ', ' + firstName : ''}! 🎉 Tu cita ha sido confirmada:${beneficiaryNote}\n\n• **Cita #${d.appointment_id}**\n• **Doctor:** ${d.doctor_name || state.selectedDoctor}\n• **Fecha:** ${d.appointment_date || state.selectedDate}\n• **Hora:** ${d.hora_cita_local || state.selectedTime}\n• **Sede:** ${d.location_name || 'Sede principal'}\n• **Motivo:** ${reason}\n\nTe esperamos${firstName ? ', ' + firstName : ''}. 😊\n\n¿Deseas agendar otra cita?`;
      ctx.executedTools.push({ name: 'scheduleAppointment', result: `Cita #${d.appointment_id}` });
    } else {
      ctx.earlyResponse = `Disculpa, tuve un inconveniente al confirmar tu cita: ${result.error}\n\n¿Intentamos de nuevo o prefieres llamarnos al 6076911308?`;
    }
  } catch (err: any) {
    ctx.earlyResponse = 'Disculpa, tuve un problema técnico al confirmar tu cita. Por favor, llámanos al 6076911308 para agendarla. 🏥';
  }
  return ctx;
}

// ─── Time Slot Finder Helper ───────────────────────────────────────────────

function findTimeSlot(slots: any[], hour: number, minute: number, isPM: boolean, isAM: boolean): any | null {
  const variations: string[] = [];
  if (isPM && hour <= 12) { variations.push(`${hour}:${String(minute).padStart(2, '0')} PM`); if (minute === 0) variations.push(`${hour}:00 PM`); }
  if (isAM || (!isPM && hour <= 12)) { variations.push(`${hour}:${String(minute).padStart(2, '0')} AM`); if (minute === 0) variations.push(`${hour}:00 AM`); }
  if (!isPM && !isAM) {
    variations.push(`${hour}:${String(minute).padStart(2, '0')} PM`);
    variations.push(`${hour}:${String(minute).padStart(2, '0')} AM`);
  }

  for (const slot of slots) {
    const slotTime = (typeof slot === 'string' ? slot : (slot.time_formatted || slot.time)).toUpperCase().trim();
    for (const v of variations) {
      if (slotTime === v.toUpperCase().trim()) return slot;
    }
  }
  return null;
}
