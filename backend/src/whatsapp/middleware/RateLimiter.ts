/**
 * @module whatsapp/middleware/RateLimiter
 * @description Per-phone rate limiting for WhatsApp messages.
 *              Sliding window counter with automatic block/unblock.
 */

import { logger } from '../config';

// ── Configuration ──────────────────────────────────────────────────
const WINDOW_MS        = 60_000;       // 1 minute window
const MAX_REQUESTS     = 20;           // max messages per window
const BLOCK_DURATION_MS = 300_000;     // 5 minute block
const CLEANUP_INTERVAL_MS = 60_000;    // cleanup every 1 minute
const MAX_ENTRIES      = 10_000;       // prevent memory leak

// ── Types ──────────────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
  blocked: boolean;
  blockedUntil?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}

// ── State ──────────────────────────────────────────────────────────
const entries = new Map<string, RateLimitEntry>();

// ── Core ───────────────────────────────────────────────────────────

/**
 * Check if a phone number is within its rate limit.
 * Automatically manages window resets and block expiries.
 */
export function checkRateLimit(phone: string): RateLimitResult {
  const key = (phone || '').replace(/@.*/, '').trim();
  const now = Date.now();
  const entry = entries.get(key);

  // First request — allow
  if (!entry) {
    entries.set(key, { count: 1, firstRequest: now, lastRequest: now, blocked: false });
    return { allowed: true };
  }

  // Currently blocked — check expiry
  if (entry.blocked && entry.blockedUntil) {
    if (now < entry.blockedUntil) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      return {
        allowed: false,
        reason: `Rate limit excedido. Intenta de nuevo en ${retryAfter} segundos.`,
        retryAfter,
      };
    }
    // Block expired — reset
    entry.blocked = false;
    entry.blockedUntil = undefined;
    entry.count = 1;
    entry.firstRequest = now;
    entry.lastRequest = now;
    return { allowed: true };
  }

  // Window expired — reset
  if (now - entry.firstRequest > WINDOW_MS) {
    entry.count = 1;
    entry.firstRequest = now;
    entry.lastRequest = now;
    return { allowed: true };
  }

  // Increment
  entry.count++;
  entry.lastRequest = now;

  // Over limit — block
  if (entry.count > MAX_REQUESTS) {
    entry.blocked = true;
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    logger.warn({ phone: key, count: entry.count }, 'Phone blocked for exceeding rate limit');
    return {
      allowed: false,
      reason: 'Has enviado demasiados mensajes. Espera 5 minutos antes de continuar.',
      retryAfter: BLOCK_DURATION_MS / 1000,
    };
  }

  return { allowed: true };
}

// ── Cleanup ────────────────────────────────────────────────────────

function cleanup(): void {
  const now = Date.now();
  const expiredCutoff = now - WINDOW_MS * 2;

  for (const [phone, entry] of entries.entries()) {
    if (entry.lastRequest < expiredCutoff && !entry.blocked) {
      entries.delete(phone);
    }
    if (entry.blocked && entry.blockedUntil && now > entry.blockedUntil) {
      entries.delete(phone);
    }
  }

  // Evict oldest if over max
  if (entries.size > MAX_ENTRIES) {
    const sorted = Array.from(entries.entries())
      .sort((a, b) => a[1].lastRequest - b[1].lastRequest);
    const toRemove = sorted.slice(0, entries.size - MAX_ENTRIES);
    for (const [phone] of toRemove) {
      entries.delete(phone);
    }
  }
}

const cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
if (cleanupTimer.unref) cleanupTimer.unref();

// ── Stats ──────────────────────────────────────────────────────────

export function getRateLimitStats(): {
  totalEntries: number;
  blockedPhones: number;
} {
  let blocked = 0;
  for (const entry of entries.values()) {
    if (entry.blocked) blocked++;
  }
  return { totalEntries: entries.size, blockedPhones: blocked };
}

/**
 * Reset rate limit for a specific phone (e.g. after admin action).
 */
export function resetRateLimit(phone: string): void {
  const key = (phone || '').replace(/@.*/, '').trim();
  entries.delete(key);
}
