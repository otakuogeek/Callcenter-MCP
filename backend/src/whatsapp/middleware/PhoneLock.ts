/**
 * @module whatsapp/middleware/PhoneLock
 * @description Per-phone message processing lock.
 *              Ensures only one message per phone number is processed at a time.
 *              Subsequent messages for the same phone are queued or rejected.
 */

import { logger } from '../config';

const activeLocks = new Map<string, { startedAt: number; resolveQueue: Array<() => void> }>();
const LOCK_TIMEOUT_MS = 60_000; // Max 60s per processing

/**
 * Acquire a per-phone processing lock.
 * Returns true if acquired, false if already locked (caller should wait or skip).
 */
export function acquireLock(phone: string): boolean {
  const cleanPhone = phone.replace(/@.*/, '');
  const existing = activeLocks.get(cleanPhone);

  if (existing) {
    // Check for stale lock
    if (Date.now() - existing.startedAt > LOCK_TIMEOUT_MS) {
      logger.warn({ phone: cleanPhone, age: Date.now() - existing.startedAt }, 'Releasing stale phone lock');
      activeLocks.delete(cleanPhone);
    } else {
      return false; // Lock held
    }
  }

  activeLocks.set(cleanPhone, { startedAt: Date.now(), resolveQueue: [] });
  return true;
}

/**
 * Release the per-phone processing lock.
 */
export function releaseLock(phone: string): void {
  const cleanPhone = phone.replace(/@.*/, '');
  activeLocks.delete(cleanPhone);
}

/**
 * Check if a phone is currently being processed.
 */
export function isLocked(phone: string): boolean {
  const cleanPhone = phone.replace(/@.*/, '');
  const lock = activeLocks.get(cleanPhone);
  if (!lock) return false;
  if (Date.now() - lock.startedAt > LOCK_TIMEOUT_MS) {
    activeLocks.delete(cleanPhone);
    return false;
  }
  return true;
}

/**
 * Get current lock stats.
 */
export function getLockStats(): { activeCount: number; phones: string[] } {
  return {
    activeCount: activeLocks.size,
    phones: Array.from(activeLocks.keys()),
  };
}

/**
 * Execute a function with the phone lock held.
 * Returns null if lock couldn't be acquired.
 */
export async function withPhoneLock<T>(
  phone: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  if (!acquireLock(phone)) {
    logger.debug({ phone }, 'Phone lock already held, skipping');
    return null;
  }

  try {
    return await fn();
  } finally {
    releaseLock(phone);
  }
}
