/**
 * @module whatsapp/memory/ConversationMemory
 * @description Thin adapter over ChatMemoryService for pipeline use.
 *              Provides a focused API for conversation history operations.
 */

import * as ChatMemoryService from '../../services/ChatMemoryService';
import { logger } from '../config';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Get or create a session for the given phone number.
 * Returns the session_id used throughout the conversation.
 */
export async function getOrCreateSession(phone: string): Promise<number> {
  const session = await ChatMemoryService.getOrCreateSession(phone);
  return session.id;
}

/**
 * Save a message to persistent chat memory.
 */
export async function saveMessage(
  sessionId: number,
  role: 'user' | 'assistant',
  content: string,
  options?: {
    toolName?: string;
    toolResult?: Record<string, any>;
    tokensUsed?: number;
    responseTimeMs?: number;
  },
): Promise<void> {
  try {
    await ChatMemoryService.saveMessage(sessionId, role, content, options);
  } catch (err) {
    logger.error({ err, sessionId, role }, 'Failed to save chat message');
  }
}

/**
 * Get recent messages formatted for AI consumption.
 */
export async function getRecentMessages(
  sessionId: number,
  limit: number = 20,
): Promise<Array<{ role: string; content: string }>> {
  try {
    const messages = await ChatMemoryService.getRecentMessages(sessionId, limit);
    return ChatMemoryService.messagesToAIFormat(messages);
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to get recent messages');
    return [];
  }
}

/**
 * Update session with patient information after identification.
 */
export async function updateSessionPatient(
  sessionId: number,
  patientId: number,
  patientName: string,
  patientDocument: string = '',
): Promise<void> {
  try {
    await ChatMemoryService.updateSessionPatient(sessionId, patientId, patientName, patientDocument);
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to update session patient');
  }
}

/**
 * Update session conversation state.
 */
export async function updateSessionState(
  sessionId: number,
  state: string,
): Promise<void> {
  try {
    await ChatMemoryService.updateSessionState(sessionId, state);
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to update session state');
  }
}

/**
 * Update session appointment selection data.
 */
export async function updateSessionAppointmentSelection(
  sessionId: number,
  data: {
    specialty_id?: number;
    specialty_name?: string;
    doctor_id?: number;
    doctor_name?: string;
    location_id?: number;
    location_name?: string;
    availability_id?: number;
    appointment_date?: string;
  },
): Promise<void> {
  try {
    await ChatMemoryService.updateSessionAppointmentSelection(sessionId, data);
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to update session appointment selection');
  }
}

/**
 * Reset a session completely (new conversation).
 */
export async function resetSession(phone: string): Promise<void> {
  try {
    await ChatMemoryService.resetSessionCompletely(phone);
  } catch (err) {
    logger.error({ err, phone }, 'Failed to reset session');
  }
}

/**
 * Get chat stats (for monitoring / admin).
 */
export async function getChatStats() {
  return ChatMemoryService.getChatStats();
}
