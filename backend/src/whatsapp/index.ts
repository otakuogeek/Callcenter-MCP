/**
 * @module whatsapp
 * @description Public API for the modular WhatsApp AI Service.
 *
 * Drop-in replacement for the monolithic WhatsAppAIService.
 * Consumers only need to change their import path:
 *
 *   // Before:
 *   import WhatsAppAI from '../services/WhatsAppAIService';
 *
 *   // After:
 *   import WhatsAppAI from '../whatsapp';
 *
 * The external contract (processMessage, resetConversation, etc.) is unchanged.
 */

import { runPipeline } from './pipeline';
import { initializeTools } from './tools';
import { getAIProviderConfig, isAIConfigured, logger } from './config';
import { getStateMetrics, resetState, cleanupExpiredStates } from './state/UnifiedStateManager';
import { deleteConversation, getCacheStats as getConvCacheStats } from './state/ConversationCache';
import { resetConversationData } from '../services/ConversationPersistence';
import * as ChatMemoryService from '../services/ChatMemoryService';
import type { ProcessMessageResult } from './types';

// ── Initialize tools on first import ──────────────────────────────
initializeTools();
logger.info('WhatsApp module initialized — tools registered');

// ── Periodic cleanup ──────────────────────────────────────────────
const cleanupTimer = setInterval(() => {
  try {
    cleanupExpiredStates();
  } catch (_) { /* silenciar errores de limpieza */ }
}, 10 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

// ── Public API ────────────────────────────────────────────────────

/**
 * Process an incoming WhatsApp message through the full pipeline.
 * This is the main entry point called by routes and WhatsAppConnection.
 */
export async function processMessage(
  message: string,
  phone: string,
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<ProcessMessageResult> {
  return runPipeline(phone, message, messageHistory);
}

/**
 * Reset all conversation state for a phone number.
 * Called when a user wants to start over or on admin reset.
 */
export function resetConversation(phone: string): void {
  const cleanPhone = phone.replace(/@.*/, '');
  resetState(cleanPhone);
  deleteConversation(cleanPhone);

  // Also reset persistence and chat memory (fire-and-forget)
  resetConversationData(cleanPhone).catch(() => {});
  ChatMemoryService.resetSessionCompletely(cleanPhone).catch(() => {});

  logger.info({ phone: cleanPhone }, 'Conversation fully reset');
}

/**
 * Get service statistics for the admin dashboard.
 */
export function getServiceStats(): {
  activeConversations: number;
  aiProvider: string;
  aiModel: string;
  cacheStats: ReturnType<typeof getCacheStats>;
} {
  const config = getAIProviderConfig();
  return {
    activeConversations: getStateMetrics().totalContexts,
    aiProvider: config.provider,
    aiModel: config.model,
    cacheStats: getCacheStats(),
  };
}

/**
 * Get conversation cache statistics.
 */
export function getCacheStats() {
  const convCache = getConvCacheStats();
  const stateMetrics = getStateMetrics();

  return {
    activeConversations: convCache.activeConversations,
    oldestEntry: null as Date | null,
    newestEntry: null as Date | null,
    expiringWithin5Min: 0,
    stateMetrics,
  };
}

/**
 * Check if the AI service is properly configured (has API key).
 */
export function isConfigured(): boolean {
  return isAIConfigured();
}

// ── Default export (matches original WhatsAppAIService contract) ──
export default {
  processMessage,
  resetConversation,
  getServiceStats,
  getCacheStats,
  isConfigured,
};
