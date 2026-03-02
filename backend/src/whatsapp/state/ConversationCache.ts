/**
 * Cache de conversaciones con TTL
 * @module whatsapp/state/ConversationCache
 */

import type { ConversationContext } from '../types';
import { logger, CONVERSATION_TTL_MS, CACHE_CLEANUP_INTERVAL_MS, MAX_CACHE_SIZE } from '../config';
import * as ChatMemoryService from '../../services/ChatMemoryService';

interface CacheEntry {
  context: ConversationContext;
  expiresAt: number;
}

const conversationCache = new Map<string, CacheEntry>();

/** Obtener o crear conversación (sync, solo cache en memoria) */
export function getOrCreateCachedConversation(phone: string): ConversationContext {
  const now = Date.now();
  const entry = conversationCache.get(phone);

  if (entry && entry.expiresAt > now) {
    entry.context.lastActivityAt = now;
    entry.expiresAt = now + CONVERSATION_TTL_MS;
    return entry.context;
  }

  if (entry) logger.debug({ phone }, 'Conversation expired, creating new one');

  const newContext: ConversationContext = {
    phone,
    messages: [],
    createdAt: now,
    lastActivityAt: now
  };

  conversationCache.set(phone, { context: newContext, expiresAt: now + CONVERSATION_TTL_MS });
  return newContext;
}

/** Obtener conversación con historial persistido de la BD */
export async function getConversationWithMemory(phone: string): Promise<ConversationContext> {
  const now = Date.now();
  const entry = conversationCache.get(phone);

  if (entry && entry.expiresAt > now) {
    entry.context.lastActivityAt = now;
    entry.expiresAt = now + CONVERSATION_TTL_MS;
    return entry.context;
  }

  try {
    const dbContext = await ChatMemoryService.getSessionContext(phone);
    let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

    if (dbContext && dbContext.session?.id) {
      const dbMessages = await ChatMemoryService.getRecentMessages(dbContext.session.id, 15);
      messages = ChatMemoryService.messagesToAIFormat(dbMessages) as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      logger.info({ phone, sessionId: dbContext.session.id, messagesLoaded: messages.length }, 'Loaded conversation from database');
    }

    const newContext: ConversationContext = {
      phone,
      messages,
      createdAt: now,
      lastActivityAt: now,
      patient_id: dbContext?.patientInfo?.id ?? undefined,
      patient_name: dbContext?.patientInfo?.name ?? undefined,
      patient_document: dbContext?.patientInfo?.document ?? undefined,
      db_session_id: dbContext?.session?.id ?? undefined
    };

    conversationCache.set(phone, { context: newContext, expiresAt: now + CONVERSATION_TTL_MS });
    return newContext;
  } catch (error) {
    logger.warn({ phone, error }, 'Failed to load memory from DB, using fresh context');
    return getOrCreateCachedConversation(phone);
  }
}

/** Actualizar datos del paciente en el cache */
export function updateCachedPatient(phone: string, patientId: number, patientName: string, patientDocument: string): void {
  const entry = conversationCache.get(phone);
  if (entry) {
    entry.context.patient_id = patientId;
    entry.context.patient_name = patientName;
    entry.context.patient_document = patientDocument;
  }
}

/** Limpiar cache de una conversación */
export function deleteConversation(phone: string): boolean {
  return conversationCache.delete(phone);
}

/** Estadísticas del cache */
export function getCacheStats() {
  const now = Date.now();
  const fiveMinFromNow = now + 5 * 60 * 1000;
  let oldestCreated = Infinity;
  let newestCreated = 0;
  let expiringWithin5Min = 0;

  conversationCache.forEach((entry) => {
    if (entry.context.createdAt < oldestCreated) oldestCreated = entry.context.createdAt;
    if (entry.context.createdAt > newestCreated) newestCreated = entry.context.createdAt;
    if (entry.expiresAt <= fiveMinFromNow) expiringWithin5Min++;
  });

  return {
    activeConversations: conversationCache.size,
    oldestEntry: oldestCreated !== Infinity ? new Date(oldestCreated) : null,
    newestEntry: newestCreated !== 0 ? new Date(newestCreated) : null,
    expiringWithin5Min
  };
}

/** Limpia conversaciones expiradas y controla tamaño máximo */
export function cleanupExpiredConversations(): void {
  const now = Date.now();
  let expiredCount = 0;

  for (const [phone, entry] of conversationCache.entries()) {
    if (entry.expiresAt <= now) { conversationCache.delete(phone); expiredCount++; }
  }

  if (conversationCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(conversationCache.entries())
      .sort((a, b) => a[1].context.lastActivityAt - b[1].context.lastActivityAt);
    const toRemove = entries.slice(0, conversationCache.size - MAX_CACHE_SIZE);
    for (const [phone] of toRemove) conversationCache.delete(phone);
    logger.info({ removed: toRemove.length, remaining: conversationCache.size }, 'Removed oldest conversations due to cache limit');
  }

  if (expiredCount > 0) logger.debug({ expiredCount, remaining: conversationCache.size }, 'Cleaned up expired conversations');
}

// Limpieza periódica
const _cleanupTimer = setInterval(cleanupExpiredConversations, CACHE_CLEANUP_INTERVAL_MS);
_cleanupTimer.unref();
