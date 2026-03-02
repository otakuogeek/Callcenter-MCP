/**
 * @module whatsapp/memory/SemanticMemory
 * @description Thin adapter over WhatsAppSemanticMemory for pipeline use.
 *              All underlying functions use sessionId (not phone).
 */

import * as SemanticMem from '../../services/WhatsAppSemanticMemory';
import { logger } from '../config';

/**
 * Generate semantic memory context to inject into the AI prompt.
 * Returns a string with relevant past interactions and preferences.
 */
export async function generateMemoryContext(
  sessionId: number,
  currentMessage: string,
): Promise<string> {
  try {
    const result = await SemanticMem.generateMemoryContext(sessionId, currentMessage);
    return result || '';
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to generate semantic memory context');
    return '';
  }
}

/**
 * Auto-capture relevant facts from conversation messages.
 */
export async function autoCapture(
  sessionId: number,
  messages: Array<{ role: string; content: string }>,
  patientId?: number,
): Promise<number> {
  try {
    return await SemanticMem.autoCapture(sessionId, messages, patientId);
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to auto-capture semantic memory');
    return 0;
  }
}

/**
 * Store an explicit memory for a session.
 */
export async function storeMemory(
  sessionId: number,
  content: string,
  options?: {
    patientId?: number;
    category?: string;
    importance?: number;
    source?: 'auto' | 'manual' | 'tool';
    metadata?: Record<string, any>;
  },
): Promise<number | null> {
  try {
    return await SemanticMem.storeMemory(sessionId, content, options as any);
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to store semantic memory');
    return null;
  }
}

/**
 * Search past memories for a session.
 */
export async function searchMemories(
  sessionId: number,
  query: string,
  options?: { limit?: number; minSimilarity?: number },
) {
  try {
    return await SemanticMem.searchMemories(sessionId, query, options);
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to search semantic memories');
    return [];
  }
}

/**
 * Generate a conversation summary for persistent context.
 */
export async function generateConversationSummary(
  sessionId: number,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  try {
    const result = await SemanticMem.generateConversationSummary(sessionId, messages);
    return result || '';
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to generate conversation summary');
    return '';
  }
}

/**
 * Get stored user preferences.
 */
export async function getUserPreferences(phone: string) {
  try {
    return await SemanticMem.getUserPreferences(phone);
  } catch (err) {
    logger.error({ err, phone }, 'Failed to get user preferences');
    return { preferences: {}, lastUpdated: null };
  }
}
