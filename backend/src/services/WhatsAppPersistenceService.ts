/**
 * WhatsApp Persistence Service
 * Servicio para persistir auditoría de herramientas y citas agendadas desde WhatsApp
 * 
 * Tablas utilizadas:
 * - whatsapp_scheduled_appointments: Citas agendadas desde WhatsApp
 * - whatsapp_tool_calls: Auditoría de llamadas a herramientas
 */

import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pino from 'pino';

const persistenceLogger = pino({
  name: 'wa-persistence',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// TIPOS
// ============================================================================

export interface ScheduledAppointmentDB {
  id?: number;
  session_id?: number;
  phone: string;
  patient_id: number;
  appointment_id: number;
  availability_id?: number;
  doctor_name?: string;
  specialty_name?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  location_name?: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  created_at?: Date;
  updated_at?: Date;
}

export interface ToolCallDB {
  id?: number;
  session_id?: number;
  phone: string;
  message_id?: string;
  tool_name: string;
  tool_args: Record<string, any>;
  tool_result?: any;
  success: boolean;
  execution_time_ms?: number;
  error_message?: string;
  created_at?: Date;
}

// ============================================================================
// GESTIÓN DE CITAS AGENDADAS
// ============================================================================

/**
 * Registra una cita agendada desde WhatsApp
 */
export async function recordScheduledAppointment(
  data: Omit<ScheduledAppointmentDB, 'id' | 'created_at' | 'updated_at'>
): Promise<number | null> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO whatsapp_scheduled_appointments (
        session_id, phone, patient_id, appointment_id, availability_id,
        doctor_name, specialty_name, scheduled_date, scheduled_time,
        location_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.session_id || null,
        data.phone,
        data.patient_id,
        data.appointment_id,
        data.availability_id || null,
        data.doctor_name || null,
        data.specialty_name || null,
        data.scheduled_date || null,
        data.scheduled_time || null,
        data.location_name || null,
        data.status
      ]
    );
    
    persistenceLogger.info({
      id: result.insertId,
      phone: data.phone,
      appointmentId: data.appointment_id
    }, 'Cita registrada en persistencia');
    
    return result.insertId;
  } catch (error: any) {
    persistenceLogger.error({ error: error.message }, 'Error registrando cita');
    return null;
  }
}

/**
 * Verifica si ya existe una cita agendada para este paciente y disponibilidad
 */
export async function checkExistingAppointment(
  phone: string,
  availabilityId: number
): Promise<boolean> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM whatsapp_scheduled_appointments 
       WHERE phone = ? AND availability_id = ? AND status IN ('scheduled', 'confirmed')
       LIMIT 1`,
      [phone, availabilityId]
    );
    return rows.length > 0;
  } catch (error: any) {
    persistenceLogger.error({ error: error.message }, 'Error verificando cita existente');
    return false;
  }
}

/**
 * Obtiene la última cita agendada para un usuario
 */
export async function getLastScheduledAppointment(
  phone: string
): Promise<ScheduledAppointmentDB | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM whatsapp_scheduled_appointments 
       WHERE phone = ? AND status IN ('scheduled', 'confirmed')
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    return rows.length > 0 ? rows[0] as ScheduledAppointmentDB : null;
  } catch (error: any) {
    persistenceLogger.error({ error: error.message }, 'Error obteniendo última cita');
    return null;
  }
}

/**
 * Actualiza el estado de una cita agendada
 */
export async function updateAppointmentStatus(
  appointmentId: number,
  status: ScheduledAppointmentDB['status']
): Promise<boolean> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE whatsapp_scheduled_appointments SET status = ?, updated_at = NOW() WHERE appointment_id = ?`,
      [status, appointmentId]
    );
    return result.affectedRows > 0;
  } catch (error: any) {
    persistenceLogger.error({ error: error.message }, 'Error actualizando estado de cita');
    return false;
  }
}

// ============================================================================
// AUDITORÍA DE LLAMADAS A HERRAMIENTAS
// ============================================================================

/**
 * Registra una llamada a herramienta
 */
export async function recordToolCall(
  data: Omit<ToolCallDB, 'id' | 'created_at'>
): Promise<number | null> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO whatsapp_tool_calls (
        session_id, phone, message_id, tool_name, tool_args,
        tool_result, success, execution_time_ms, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.session_id || null,
        data.phone,
        data.message_id || null,
        data.tool_name,
        JSON.stringify(data.tool_args || {}),
        data.tool_result ? JSON.stringify(data.tool_result) : null,
        data.success ? 1 : 0,
        data.execution_time_ms || null,
        data.error_message || null
      ]
    );
    
    return result.insertId;
  } catch (error: any) {
    persistenceLogger.debug({ error: error.message }, 'Error registrando tool call');
    return null;
  }
}

/**
 * Obtiene el historial de llamadas a herramientas para un usuario
 */
export async function getToolCallHistory(
  phone: string,
  limit: number = 20
): Promise<ToolCallDB[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM whatsapp_tool_calls 
       WHERE phone = ? 
       ORDER BY created_at DESC LIMIT ?`,
      [phone, limit]
    );
    return rows as ToolCallDB[];
  } catch (error: any) {
    persistenceLogger.error({ error: error.message }, 'Error obteniendo historial de tools');
    return [];
  }
}

/**
 * Verifica si scheduleAppointment fue ejecutado en los últimos N minutos
 */
export async function wasScheduleAppointmentExecuted(
  phone: string,
  minutesAgo: number = 5
): Promise<boolean> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM whatsapp_tool_calls 
       WHERE phone = ? 
         AND tool_name = 'scheduleAppointment' 
         AND success = 1
         AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
       LIMIT 1`,
      [phone, minutesAgo]
    );
    return rows.length > 0;
  } catch (error: any) {
    persistenceLogger.error({ error: error.message }, 'Error verificando scheduleAppointment');
    return false;
  }
}

// ============================================================================
// LIMPIEZA
// ============================================================================

/**
 * Limpia registros de tool_calls antiguos (más de X días)
 */
export async function cleanupOldToolCalls(daysOld: number = 30): Promise<number> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM whatsapp_tool_calls WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [daysOld]
    );
    
    if (result.affectedRows > 0) {
      persistenceLogger.info({ deleted: result.affectedRows }, 'Tool calls antiguos eliminados');
    }
    
    return result.affectedRows;
  } catch (error: any) {
    persistenceLogger.error({ error: error.message }, 'Error limpiando tool calls');
    return 0;
  }
}
