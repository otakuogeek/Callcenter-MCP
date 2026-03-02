/**
 * WhatsApp Chat Memory Service
 * 
 * Servicio para gestionar la memoria persistente de conversaciones de WhatsApp.
 * Permite recordar contexto, pacientes identificados y preferencias del usuario.
 * 
 * @version 1.0.0
 */

import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pino from 'pino';

const logger = pino({
  name: 'whatsapp-memory',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// INTERFACES
// ============================================================================

export interface ChatSession {
  id: number;
  phone: string;
  patient_id: number | null;
  patient_name: string | null;
  patient_document: string | null;
  current_state: string;
  last_specialty_id: number | null;
  last_location_id: number | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
  last_activity_at: Date;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_name: string | null;
  tool_result: Record<string, any> | null;
  tokens_used: number | null;
  response_time_ms: number | null;
  created_at: Date;
}

export interface SessionContext {
  session: ChatSession;
  recentMessages: ChatMessage[];
  summaries: string[];
  patientInfo: {
    id: number;
    name: string;
    document: string;
    phone: string;
    eps_name: string | null;
  } | null;
}

// ============================================================================
// GESTIÓN DE SESIONES
// ============================================================================

/**
 * Obtiene o crea una sesión de chat para un número de teléfono
 */
export async function getOrCreateSession(phone: string): Promise<ChatSession> {
  const cleanPhone = phone.replace(/@.*/, '');
  
  try {
    // Buscar sesión existente
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM whatsapp_chat_sessions WHERE phone = ?',
      [cleanPhone]
    );
    
    if (rows.length > 0) {
      // Actualizar última actividad
      await pool.execute(
        'UPDATE whatsapp_chat_sessions SET last_activity_at = NOW() WHERE id = ?',
        [rows[0].id]
      );
      
      return rows[0] as ChatSession;
    }
    
    // Crear nueva sesión
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO whatsapp_chat_sessions (phone, current_state, last_activity_at) 
       VALUES (?, 'idle', NOW())`,
      [cleanPhone]
    );
    
    logger.info({ phone: cleanPhone, sessionId: result.insertId }, 'Nueva sesión de chat creada');
    
    return {
      id: result.insertId,
      phone: cleanPhone,
      patient_id: null,
      patient_name: null,
      patient_document: null,
      current_state: 'idle',
      last_specialty_id: null,
      last_location_id: null,
      metadata: null,
      created_at: new Date(),
      updated_at: new Date(),
      last_activity_at: new Date()
    };
  } catch (error: any) {
    logger.error({ error: error.message, phone: cleanPhone }, 'Error obteniendo/creando sesión');
    throw error;
  }
}

/**
 * Actualiza la información del paciente en la sesión
 */
export async function updateSessionPatient(
  sessionId: number,
  patientId: number,
  patientName: string,
  patientDocument: string
): Promise<void> {
  try {
    await pool.execute(
      `UPDATE whatsapp_chat_sessions 
       SET patient_id = ?, patient_name = ?, patient_document = ?, 
           current_state = 'identified', updated_at = NOW()
       WHERE id = ?`,
      [patientId, patientName, patientDocument, sessionId]
    );
    
    logger.info({ sessionId, patientId, patientName }, 'Sesión actualizada con paciente');
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error actualizando paciente en sesión');
  }
}

/**
 * Actualiza el estado de la sesión
 */
export async function updateSessionState(
  sessionId: number,
  state: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    if (metadata) {
      await pool.execute(
        `UPDATE whatsapp_chat_sessions 
         SET current_state = ?, metadata = JSON_MERGE_PATCH(COALESCE(metadata, '{}'), ?), updated_at = NOW()
         WHERE id = ?`,
        [state, JSON.stringify(metadata), sessionId]
      );
    } else {
      await pool.execute(
        'UPDATE whatsapp_chat_sessions SET current_state = ?, updated_at = NOW() WHERE id = ?',
        [state, sessionId]
      );
    }
  } catch (error: any) {
    logger.error({ error: error.message, sessionId, state }, 'Error actualizando estado de sesión');
  }
}

/**
 * Actualiza la última especialidad/ubicación consultada
 */
export async function updateSessionPreferences(
  sessionId: number,
  specialtyId?: number,
  locationId?: number
): Promise<void> {
  try {
    const updates: string[] = [];
    const params: any[] = [];
    
    if (specialtyId !== undefined) {
      updates.push('last_specialty_id = ?');
      params.push(specialtyId);
    }
    if (locationId !== undefined) {
      updates.push('last_location_id = ?');
      params.push(locationId);
    }
    
    if (updates.length > 0) {
      params.push(sessionId);
      await pool.execute(
        `UPDATE whatsapp_chat_sessions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
    }
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error actualizando preferencias de sesión');
  }
}

/**
 * Actualiza la selección de cita (disponibilidad, doctor, fecha, hora)
 */
export async function updateSessionAppointmentSelection(
  sessionId: number,
  selection: {
    availability_id?: number;
    selected_doctor?: string;
    selected_doctor_id?: number;
    selected_date?: string;
    selected_time?: string;
    specialty_name?: string;
    specialty_id?: number;
    last_appointment_id?: number;
  }
): Promise<void> {
  try {
    const updates: string[] = [];
    const params: any[] = [];
    
    if (selection.availability_id !== undefined) {
      updates.push('availability_id = ?');
      params.push(selection.availability_id);
    }
    if (selection.selected_doctor !== undefined) {
      updates.push('selected_doctor = ?');
      params.push(selection.selected_doctor);
    }
    if (selection.selected_doctor_id !== undefined) {
      updates.push('selected_doctor_id = ?');
      params.push(selection.selected_doctor_id);
    }
    if (selection.selected_date !== undefined) {
      updates.push('selected_date = ?');
      params.push(selection.selected_date);
    }
    if (selection.selected_time !== undefined) {
      updates.push('selected_time = ?');
      params.push(selection.selected_time);
    }
    if (selection.specialty_name !== undefined) {
      updates.push('specialty_name = ?');
      params.push(selection.specialty_name);
    }
    if (selection.specialty_id !== undefined) {
      updates.push('last_specialty_id = ?');
      params.push(selection.specialty_id);
    }
    if (selection.last_appointment_id !== undefined) {
      updates.push('last_appointment_id = ?');
      params.push(selection.last_appointment_id);
    }
    
    if (updates.length > 0) {
      params.push(sessionId);
      await pool.execute(
        `UPDATE whatsapp_chat_sessions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
      logger.info({ sessionId, selection }, 'Selección de cita actualizada en sesión');
    }
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error actualizando selección de cita');
  }
}

/**
 * Resetea la selección de cita después de agendar
 */
export async function resetSessionAppointmentSelection(sessionId: number): Promise<void> {
  try {
    await pool.execute(
      `UPDATE whatsapp_chat_sessions SET 
         availability_id = NULL, 
         selected_doctor = NULL, 
         selected_doctor_id = NULL,
         selected_date = NULL, 
         selected_time = NULL,
         appointments_scheduled = appointments_scheduled + 1,
         updated_at = NOW()
       WHERE id = ?`,
      [sessionId]
    );
    logger.info({ sessionId }, 'Selección de cita reseteada');
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error reseteando selección');
  }
}

// ============================================================================
// GESTIÓN DE MENSAJES
// ============================================================================

/**
 * Guarda un mensaje en el historial
 */
export async function saveMessage(
  sessionId: number,
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,
  options?: {
    toolName?: string;
    toolResult?: Record<string, any>;
    tokensUsed?: number;
    responseTimeMs?: number;
  }
): Promise<number> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO whatsapp_chat_messages 
       (session_id, role, content, tool_name, tool_result, tokens_used, response_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        role,
        content,
        options?.toolName || null,
        options?.toolResult ? JSON.stringify(options.toolResult) : null,
        options?.tokensUsed || null,
        options?.responseTimeMs || null
      ]
    );
    
    // Actualizar última actividad de la sesión
    await pool.execute(
      'UPDATE whatsapp_chat_sessions SET last_activity_at = NOW() WHERE id = ?',
      [sessionId]
    );
    
    return result.insertId;
  } catch (error: any) {
    logger.error({ error: error.message, sessionId, role }, 'Error guardando mensaje');
    throw error;
  }
}

/**
 * Obtiene los mensajes recientes de una sesión
 */
export async function getRecentMessages(
  sessionId: number,
  limit: number = 20
): Promise<ChatMessage[]> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM whatsapp_chat_messages 
       WHERE session_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [sessionId, limit]
    );
    
    // Parsear tool_result JSON
    return (rows as ChatMessage[]).reverse().map(msg => ({
      ...msg,
      tool_result: msg.tool_result ? 
        (typeof msg.tool_result === 'string' ? JSON.parse(msg.tool_result) : msg.tool_result) : 
        null
    }));
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error obteniendo mensajes recientes');
    return [];
  }
}

/**
 * Obtiene mensajes de hoy para una sesión
 */
export async function getTodayMessages(sessionId: number): Promise<ChatMessage[]> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM whatsapp_chat_messages 
       WHERE session_id = ? AND DATE(created_at) = CURDATE()
       ORDER BY created_at ASC`,
      [sessionId]
    );
    
    return rows as ChatMessage[];
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error obteniendo mensajes de hoy');
    return [];
  }
}

// ============================================================================
// CONTEXTO COMPLETO
// ============================================================================

/**
 * Obtiene el contexto completo de una sesión para el AI
 */
export async function getSessionContext(phone: string): Promise<SessionContext | null> {
  const cleanPhone = phone.replace(/@.*/, '');
  
  try {
    // Obtener sesión
    const session = await getOrCreateSession(cleanPhone);
    
    // Obtener mensajes recientes
    const recentMessages = await getRecentMessages(session.id, 15);
    
    // Obtener resúmenes si existen
    const [summaryRows] = await pool.execute<RowDataPacket[]>(
      `SELECT summary FROM whatsapp_chat_summaries 
       WHERE session_id = ? 
       ORDER BY created_at DESC 
       LIMIT 3`,
      [session.id]
    );
    const summaries = summaryRows.map(r => r.summary);
    
    // Obtener info del paciente si está identificado
    let patientInfo = null;
    if (session.patient_id) {
      const [patientRows] = await pool.execute<RowDataPacket[]>(
        `SELECT p.id, p.name, p.document, p.phone, eps.name as eps_name
         FROM patients p
         LEFT JOIN eps ON p.insurance_eps_id = eps.id
         WHERE p.id = ?`,
        [session.patient_id]
      );
      
      if (patientRows.length > 0) {
        patientInfo = patientRows[0] as SessionContext['patientInfo'];
      }
    }
    
    return {
      session,
      recentMessages,
      summaries,
      patientInfo
    };
  } catch (error: any) {
    logger.error({ error: error.message, phone: cleanPhone }, 'Error obteniendo contexto de sesión');
    return null;
  }
}

/**
 * Genera un prompt de contexto para el AI basado en la memoria
 */
export function generateContextPrompt(context: SessionContext): string {
  const parts: string[] = [];
  
  // Info del paciente
  if (context.patientInfo) {
    parts.push(`📋 PACIENTE IDENTIFICADO:
- Nombre: ${context.patientInfo.name}
- Documento: ${context.patientInfo.document}
- Teléfono: ${context.patientInfo.phone}
- EPS: ${context.patientInfo.eps_name || 'No especificada'}`);
  }
  
  // Estado actual
  if (context.session.current_state !== 'idle') {
    parts.push(`📊 Estado actual: ${context.session.current_state}`);
  }
  
  // Preferencias anteriores
  if (context.session.last_specialty_id || context.session.last_location_id) {
    parts.push(`🔄 Última consulta: Especialidad ID ${context.session.last_specialty_id}, Sede ID ${context.session.last_location_id}`);
  }
  
  // Resúmenes de conversaciones anteriores
  if (context.summaries.length > 0) {
    parts.push(`📝 RESUMEN DE CONVERSACIONES ANTERIORES:\n${context.summaries.join('\n')}`);
  }
  
  return parts.length > 0 ? 
    `\n\n---\n🧠 MEMORIA DEL SISTEMA (Usar para personalizar respuestas):\n${parts.join('\n\n')}` : 
    '';
}

/**
 * Convierte mensajes de la BD al formato esperado por el AI
 */
export function messagesToAIFormat(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages
    .filter(m => m.role !== 'tool') // Excluir mensajes de tool que ya están procesados
    .map(m => ({
      role: m.role === 'system' ? 'system' : (m.role === 'assistant' ? 'assistant' : 'user'),
      content: m.content
    }));
}

// ============================================================================
// LIMPIEZA Y MANTENIMIENTO
// ============================================================================

/**
 * Resetea una sesión (para empezar de nuevo)
 */
export async function resetSession(phone: string): Promise<void> {
  const cleanPhone = phone.replace(/@.*/, '');
  
  try {
    await pool.execute(
      `UPDATE whatsapp_chat_sessions 
       SET current_state = 'idle', 
           patient_id = NULL,
           patient_name = NULL,
           patient_document = NULL,
           last_specialty_id = NULL, 
           last_location_id = NULL,
           availability_id = NULL,
           selected_doctor = NULL,
           selected_doctor_id = NULL,
           selected_date = NULL,
           selected_time = NULL,
           specialty_name = NULL,
           last_appointment_id = NULL,
           metadata = NULL,
           updated_at = NOW()
       WHERE phone = ?`,
      [cleanPhone]
    );
    
    logger.info({ phone: cleanPhone }, 'Sesión reseteada');
  } catch (error: any) {
    logger.error({ error: error.message, phone: cleanPhone }, 'Error reseteando sesión');
  }
}

/**
 * Resetea completamente la sesión y elimina historial de mensajes/resúmenes.
 */
export async function resetSessionCompletely(phone: string): Promise<void> {
  const cleanPhone = phone.replace(/@.*/, '');

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM whatsapp_chat_sessions WHERE phone = ? LIMIT 1',
      [cleanPhone]
    );

    if (rows.length > 0) {
      const sessionId = rows[0].id;

      await pool.execute('DELETE FROM whatsapp_chat_messages WHERE session_id = ?', [sessionId]);
      await pool.execute('DELETE FROM whatsapp_chat_summaries WHERE session_id = ?', [sessionId]);
    }

    await resetSession(cleanPhone);
    logger.info({ phone: cleanPhone }, 'Sesión completamente reseteada (incluyendo historial)');
  } catch (error: any) {
    logger.error({ error: error.message, phone: cleanPhone }, 'Error en reset completo de sesión');
  }
}

/**
 * Elimina mensajes antiguos de una sesión (mantiene últimos N)
 */
export async function pruneOldMessages(sessionId: number, keepLast: number = 50): Promise<number> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM whatsapp_chat_messages 
       WHERE session_id = ? 
       AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM whatsapp_chat_messages 
           WHERE session_id = ? 
           ORDER BY created_at DESC 
           LIMIT ?
         ) as recent
       )`,
      [sessionId, sessionId, keepLast]
    );
    
    if (result.affectedRows > 0) {
      logger.info({ sessionId, deleted: result.affectedRows }, 'Mensajes antiguos eliminados');
    }
    
    return result.affectedRows;
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error eliminando mensajes antiguos');
    return 0;
  }
}

// ============================================================================
// ESTADÍSTICAS
// ============================================================================

/**
 * Obtiene estadísticas de uso del chat
 */
export async function getChatStats(): Promise<{
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  messagesLast24h: number;
  identifiedPatients: number;
}> {
  try {
    const [stats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        (SELECT COUNT(*) FROM whatsapp_chat_sessions) as totalSessions,
        (SELECT COUNT(*) FROM whatsapp_chat_sessions WHERE last_activity_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)) as activeSessions,
        (SELECT COUNT(*) FROM whatsapp_chat_messages) as totalMessages,
        (SELECT COUNT(*) FROM whatsapp_chat_messages WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)) as messagesLast24h,
        (SELECT COUNT(*) FROM whatsapp_chat_sessions WHERE patient_id IS NOT NULL) as identifiedPatients
    `);
    
    return stats[0] as any;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error obteniendo estadísticas de chat');
    return {
      totalSessions: 0,
      activeSessions: 0,
      totalMessages: 0,
      messagesLast24h: 0,
      identifiedPatients: 0
    };
  }
}

export default {
  getOrCreateSession,
  updateSessionPatient,
  updateSessionState,
  updateSessionPreferences,
  saveMessage,
  getRecentMessages,
  getTodayMessages,
  getSessionContext,
  generateContextPrompt,
  messagesToAIFormat,
  resetSession,
  resetSessionCompletely,
  pruneOldMessages,
  getChatStats
};
