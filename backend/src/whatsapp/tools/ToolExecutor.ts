/**
 * @module whatsapp/tools/ToolExecutor
 * @description Unified tool execution engine.
 *              1. Looks up the tool in the registry
 *              2. Fixes placeholder arguments from conversation state
 *              3. Executes via the registered handler (DirectDBTools)
 *              4. Applies post-execution state transitions & side effects
 *              5. Records audit trail in WhatsAppPersistenceService
 */

import { logger } from '../config';
import * as ToolRegistry from './ToolRegistry';
import { getStateContext, updateState } from '../state/UnifiedStateManager';
import { createDefaultStateContext } from '../types/state';
import { isPlaceholder } from '../utils/validation';
import { normalizeToolResultDatesForWhatsApp } from '../utils/date';
import type { ToolResult, ToolContext, ConversationContext } from '../types';
import type { ConversationState } from '../types/state';
import * as PersistenceService from '../../services/WhatsAppPersistenceService';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  toolName: string;
  result: any;
  elapsedMs: number;
  success: boolean;
}

// ─── Main Execute ──────────────────────────────────────────────────────────

/**
 * Execute a tool by name with automatic placeholder fixing,
 * state transitions, and audit logging.
 */
export async function execute(
  toolName: string,
  args: Record<string, any>,
  context: ConversationContext,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const cleanPhone = context.phone?.replace(/@.*/, '') || '';

  // 1. Look up the tool
  const toolDef = ToolRegistry.get(toolName);
  if (!toolDef) {
    logger.warn({ tool: toolName }, 'Unknown tool requested');
    return {
      toolName,
      result: { success: false, error: `Herramienta desconocida: ${toolName}` },
      elapsedMs: Date.now() - startTime,
      success: false,
    };
  }

  // 2. Fix placeholders from state context
  const stateCtx = cleanPhone ? getStateContext(cleanPhone) : null;
  fixPlaceholders(args, stateCtx, context, cleanPhone);

  logger.debug({ tool: toolName, args }, 'Executing tool');

  try {
    // 3. Execute the handler
    const toolCtx = {
      phone: cleanPhone,
      stateContext: stateCtx || createDefaultStateContext(),
      conversation: context,
      patientId: stateCtx?.patientId ?? undefined,
      patientName: stateCtx?.patientName ?? undefined,
      patientDocument: stateCtx?.patientDocument ?? undefined,
    };
    let result = await toolDef.handler(args, toolCtx);

    // 4. Normalize dates (UTC → Colombia) in result
    if (result && typeof result === 'object') {
      result = normalizeToolResultDatesForWhatsApp(result);
    }

    // 5. Apply post-execution side effects (state updates, context enrichment)
    if (toolDef.afterExecute) {
      await toolDef.afterExecute(result, args, toolCtx);
    }

    const elapsed = Date.now() - startTime;
    logger.info({ tool: toolName, elapsed, success: result?.success }, 'Tool execution completed');

    // 6. Audit trail
    await recordAudit(cleanPhone, toolName, args, result, elapsed, true);

    return { toolName, result, elapsedMs: elapsed, success: result?.success ?? true };
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    logger.error({ tool: toolName, error: error.message }, 'Tool execution failed');
    await recordAudit(cleanPhone, toolName, args, null, elapsed, false, error.message);

    return {
      toolName,
      result: { success: false, error: error.message },
      elapsedMs: elapsed,
      success: false,
    };
  }
}

// ─── Placeholder Fixing ───────────────────────────────────────────────────

function fixPlaceholders(
  args: Record<string, any>,
  stateCtx: any,
  context: ConversationContext,
  phone: string,
): void {
  // patient_id
  if (isPlaceholder(args.patient_id)) {
    const real = stateCtx?.patientId || context.patient_id;
    if (real) {
      logger.warn({ phone, original: args.patient_id, corrected: real }, '🔧 Fixed patient_id placeholder');
      args.patient_id = real;
    }
  }

  // availability_id
  if (isPlaceholder(args.availability_id)) {
    const real = stateCtx?.availabilityId;
    if (real) {
      logger.warn({ phone, original: args.availability_id, corrected: real }, '🔧 Fixed availability_id placeholder');
      args.availability_id = real;
    }
  }

  // scheduled_date
  if (!args.scheduled_date || isPlaceholder(args.scheduled_date)) {
    if (stateCtx?.selectedDate && stateCtx?.selectedTime) {
      const corrected = `${stateCtx.selectedDate} ${stateCtx.selectedTime}`;
      logger.warn({ phone, original: args.scheduled_date, corrected }, '🔧 Fixed scheduled_date placeholder');
      args.scheduled_date = corrected;
    }
  }

  // appointment_id (for cancel flows)
  if (isPlaceholder(args.appointment_id)) {
    if (stateCtx?.lastAppointmentId) {
      logger.warn({ phone, original: args.appointment_id, corrected: stateCtx.lastAppointmentId }, '🔧 Fixed appointment_id placeholder');
      args.appointment_id = stateCtx.lastAppointmentId;
    }
  }
}

// ─── Audit Trail ──────────────────────────────────────────────────────────

async function recordAudit(
  phone: string,
  toolName: string,
  args: Record<string, any>,
  result: any,
  elapsedMs: number,
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  if (!phone) return;
  try {
    await PersistenceService.recordToolCall({
      phone,
      tool_name: toolName,
      tool_args: args,
      tool_result: success
        ? { success: true, summary: getSummaryFromResult(result) }
        : result,
      success,
      execution_time_ms: elapsedMs,
      error_message: errorMessage || undefined,
    });
  } catch (err: any) {
    logger.debug({ error: err.message }, 'Error recording tool call (non-critical)');
  }
}

// ─── Result Summary (for audit) ───────────────────────────────────────────

export function getSummaryFromResult(result: any): any {
  if (!result?.data) return { dataPresent: false };
  if (result.data.appointment_id) {
    return {
      appointment_id: result.data.appointment_id,
      doctor_name: result.data.doctor_name,
      specialty_name: result.data.specialty_name,
    };
  }
  if (result.data.found !== undefined) {
    return { found: result.data.found, patient_id: result.data.patient?.id };
  }
  if (result.data.appointments) {
    return { appointmentsCount: result.data.appointments.length };
  }
  return { dataPresent: true };
}

// ─── Tool Result Summarizer (for token-efficient history) ─────────────────

/**
 * Compress tool results for conversation history to save tokens.
 * Critical results (scheduleAppointment) are kept in full.
 */
export function summarizeToolResult(toolName: string, result: any): string {
  if (!result || !result.success) return JSON.stringify(result);

  const d = result.data;

  switch (toolName) {
    case 'searchPatient':
      if (d?.found) {
        const p = d.patient || d.patients?.[0];
        return JSON.stringify({
          success: true,
          data: {
            found: true,
            patient: {
              id: p?.id, name: p?.full_name || p?.name, document: p?.document,
              phone: p?.phone || p?.mobile, eps_name: p?.eps_name, eps_id: p?.eps_id,
            },
          },
        });
      }
      return JSON.stringify({ success: true, data: { found: false } });

    case 'getAvailableAppointments':
      if (d?.opciones_disponibles && d.opciones_disponibles.length > 0) {
        const doctorMap: Record<string, any> = {};
        for (const o of d.opciones_disponibles) {
          const dName = o.doctor || 'Sin asignar';
          if (!doctorMap[dName]) {
            doctorMap[dName] = { doctor_name: dName, doctor_id: o.doctor_id, dates: [] };
          }
          doctorMap[dName].dates.push({
            availability_id: o.availability_id,
            fecha: o.fecha, fecha_iso: o.fecha_iso, sede: o.sede,
            direccion_sede: o.direccion_sede, cupos: o.cupos,
            specialty_id: o.specialty_id,
            horarios_disponibles: (o.horarios_disponibles || []).slice(0, 6),
            horarios_24h: (o.horarios_24h || []).slice(0, 6),
          });
        }
        const specialists = Object.values(doctorMap);
        return JSON.stringify({
          success: true,
          data: {
            total_agendas: d.total,
            total_especialistas: specialists.length,
            especialistas: specialists.map((s: any) => ({
              doctor_name: s.doctor_name, doctor_id: s.doctor_id,
              fechas_disponibles: s.dates.slice(0, 5),
            })),
            instrucciones: 'Presenta máximo 3 fechas al usuario. Si hay más, pregunta si desea ver más opciones. Cuando elija fecha, llama getAvailableTimeSlots con el availability_id correspondiente.',
          },
        });
      }
      return JSON.stringify({ success: true, data: { total_agendas: 0, mensaje: 'No hay agendas disponibles' } });

    case 'getAvailableTimeSlots':
    case 'getAvailableTimeSlotsForDoctorOnDate':
      if (d?.available_time_slots || d?.available_times) {
        const slots = (d.available_time_slots || d.slots_detail || []).slice(0, 12);
        return JSON.stringify({
          success: true,
          data: { ...d, available_time_slots: slots, slots_detail: slots.slice(0, 12) },
        });
      }
      return JSON.stringify(result).substring(0, 1500);

    case 'scheduleAppointment':
      return JSON.stringify(result); // Full — critical for confirmation

    case 'listActiveEPS':
      if (d?.eps_list) {
        return JSON.stringify({
          success: true,
          data: { eps_list: d.eps_list.map((e: any) => ({ id: e.id, name: e.name })) },
        });
      }
      return JSON.stringify(result);

    case 'getPatientAppointments':
      if (d?.appointments) {
        return JSON.stringify({
          success: true,
          data: {
            appointments: d.appointments.slice(0, 5).map((a: any) => ({
              id: a.id, specialty: a.specialty_name, doctor: a.doctor_name,
              date: a.scheduled_date_colombia || a.scheduled_date,
              time: a.scheduled_time_colombia || a.scheduled_time,
              status: a.status, location: a.location_name,
            })),
          },
        });
      }
      return JSON.stringify(result).substring(0, 1500);

    default: {
      const json = JSON.stringify(result);
      return json.length > 1500 ? json.substring(0, 1500) + '...' : json;
    }
  }
}
