/**
 * @module whatsapp/tools/definitions/appointment.tools
 * @description Tool definitions for appointment scheduling, time slots, and cancellation.
 */

import DirectDBTools from '../../../services/DirectDBTools';
import { ConversationState } from '../../types/state';
import { updateState } from '../../state/UnifiedStateManager';
import { logger } from '../../config';
import * as ChatMemoryService from '../../../services/ChatMemoryService';
import * as PersistenceService from '../../../services/WhatsAppPersistenceService';
import pool from '../../../db/pool';
import type { RowDataPacket } from 'mysql2';
import type { ToolDefinition } from '../../types';

// ─── Helper ────────────────────────────────────────────────────────────────

async function getSessionIdForPhone(phone: string): Promise<number | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM whatsapp_chat_sessions WHERE phone = ? LIMIT 1',
      [phone],
    );
    return rows.length > 0 ? rows[0].id : null;
  } catch {
    return null;
  }
}

// ─── Definitions ───────────────────────────────────────────────────────────

export const getAvailableAppointmentsTool: ToolDefinition = {
  name: 'getAvailableAppointments',
  category: 'appointment',
  description: 'Get available appointment slots, optionally filtered by specialty',
  handler: async (args) => DirectDBTools.getAvailableAppointments(args),
  afterExecute: async (result, args, ctx) => {
    if (!result?.success || !result.data) return;
    const phone = ctx.phone;
    if (!phone) return;

    const appointments = result.data.appointments || [];
    const stateUpdate: Record<string, any> = {
      specialtyName: args.specialty_name || appointments[0]?.specialty_name,
      specialtyId: appointments[0]?.specialty_id,
    };

    if (result.data.unique_doctors) {
      stateUpdate.availableDoctors = result.data.unique_doctors;
    }

    // Pre-select if only one option
    if (appointments.length === 1) {
      stateUpdate.availabilityId = appointments[0].availability_id;
      stateUpdate.selectedDoctor = appointments[0].doctor_name;
      stateUpdate.selectedDoctorId = appointments[0].doctor_id;
      stateUpdate.selectedDate = appointments[0].appointment_date;
      logger.info({ phone, availabilityId: appointments[0].availability_id }, 'Pre-selected single availability');
    }

    stateUpdate.availableAppointments = appointments;
    updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, stateUpdate);
  },
};

export const getAvailableTimeSlotsTool: ToolDefinition = {
  name: 'getAvailableTimeSlots',
  category: 'appointment',
  description: 'Get available time slots for a specific availability block',
  handler: async (args) => DirectDBTools.getAvailableTimeSlots(args as any),
};

export const getAvailableTimeSlotsForDoctorOnDateTool: ToolDefinition = {
  name: 'getAvailableTimeSlotsForDoctorOnDate',
  category: 'appointment',
  description: 'Get real available time slots checking existing appointments',
  handler: async (args) => DirectDBTools.getAvailableTimeSlotsForDoctorOnDate(args as any),
};

export const scheduleAppointmentTool: ToolDefinition = {
  name: 'scheduleAppointment',
  category: 'appointment',
  description: 'Schedule an appointment (also handles waiting list if no slots)',
  handler: async (args) => DirectDBTools.scheduleAppointment(args as any),
  afterExecute: async (result, args, ctx) => {
    if (!result?.success || !result.data?.appointment_id || !ctx.phone) return;

    try {
      const sessionId = await getSessionIdForPhone(ctx.phone);
      await PersistenceService.recordScheduledAppointment({
        session_id: sessionId || 0,
        phone: ctx.phone,
        patient_id: args.patient_id || result.data.patient_id,
        appointment_id: result.data.appointment_id,
        availability_id: args.availability_id,
        doctor_name: result.data.doctor_name,
        specialty_name: result.data.specialty_name,
        scheduled_date: result.data.appointment_date || args.scheduled_date?.split(' ')[0],
        scheduled_time: result.data.hora_cita_local || args.scheduled_date?.split(' ')[1],
        location_name: result.data.location_name,
        status: 'scheduled',
      });

      if (sessionId) {
        await ChatMemoryService.updateSessionAppointmentSelection(sessionId, {
          last_appointment_id: result.data.appointment_id,
        });
      }

      logger.info({ phone: ctx.phone, appointmentId: result.data.appointment_id }, '✅ Appointment recorded in persistence');
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error recording appointment in persistence');
    }
  },
};

export const cancelAppointmentTool: ToolDefinition = {
  name: 'cancelAppointment',
  category: 'appointment',
  description: 'Cancel an existing appointment',
  handler: async (args) => DirectDBTools.cancelAppointment(args as any),
};

export const getPatientAppointmentsTool: ToolDefinition = {
  name: 'getPatientAppointments',
  category: 'appointment',
  description: 'Get appointments for a specific patient',
  handler: async (args) => DirectDBTools.getPatientAppointments(args),
};

export const checkConsecutiveSlotsTool: ToolDefinition = {
  name: 'checkConsecutiveSlots',
  category: 'appointment',
  description: 'Check if consecutive time slots are available for double appointments',
  handler: async (args) => DirectDBTools.checkConsecutiveSlots(args as any),
};

export const scheduleDoubleAppointmentTool: ToolDefinition = {
  name: 'scheduleDoubleAppointment',
  category: 'appointment',
  description: 'Schedule a double appointment (two consecutive slots)',
  handler: async (args) => DirectDBTools.scheduleDoubleAppointment(args as any),
};

export const getAvailabilityByDoctorTool: ToolDefinition = {
  name: 'getAvailabilityByDoctor',
  category: 'appointment',
  description: 'Get availability slots for a specific doctor',
  handler: async (args) => DirectDBTools.getAvailabilityByDoctor(args as any),
};

export const cancelarCitasVencidasTool: ToolDefinition = {
  name: 'cancelarCitasVencidas',
  category: 'appointment',
  description: 'Cancel expired/past appointments',
  handler: async (args) => DirectDBTools.cancelarCitasVencidas(args as any),
};

export const checkAvailabilityQuotaTool: ToolDefinition = {
  name: 'checkAvailabilityQuota',
  category: 'appointment',
  description: 'Check remaining quota for a specific availability block',
  handler: async (args) => DirectDBTools.checkAvailabilityQuota(args as any),
};

// ─── Exported collection ───────────────────────────────────────────────────

export const appointmentTools: ToolDefinition[] = [
  getAvailableAppointmentsTool,
  getAvailableTimeSlotsTool,
  getAvailableTimeSlotsForDoctorOnDateTool,
  scheduleAppointmentTool,
  cancelAppointmentTool,
  getPatientAppointmentsTool,
  checkConsecutiveSlotsTool,
  scheduleDoubleAppointmentTool,
  getAvailabilityByDoctorTool,
  cancelarCitasVencidasTool,
  checkAvailabilityQuotaTool,
];
