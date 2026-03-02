/**
 * Tests for whatsapp/middleware (RateLimiter + PhoneLock)
 */

import { checkRateLimit, resetRateLimit, getRateLimitStats } from '../../whatsapp/middleware/RateLimiter';
import { acquireLock, releaseLock, isLocked, getLockStats, withPhoneLock } from '../../whatsapp/middleware/PhoneLock';

describe('RateLimiter', () => {
  const testPhone = '573009999999';

  beforeEach(() => {
    resetRateLimit(testPhone);
  });

  it('should allow first request', () => {
    const result = checkRateLimit(testPhone);
    expect(result.allowed).toBe(true);
  });

  it('should allow up to MAX_REQUESTS (20)', () => {
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(testPhone).allowed).toBe(true);
    }
  });

  it('should block after exceeding MAX_REQUESTS', () => {
    for (let i = 0; i < 21; i++) {
      checkRateLimit(testPhone);
    }
    const result = checkRateLimit(testPhone);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should track blocked phones in stats', () => {
    for (let i = 0; i < 22; i++) {
      checkRateLimit(testPhone);
    }
    const stats = getRateLimitStats();
    expect(stats.blockedPhones).toBeGreaterThanOrEqual(1);
  });

  it('resetRateLimit should clear the entry', () => {
    for (let i = 0; i < 22; i++) {
      checkRateLimit(testPhone);
    }
    resetRateLimit(testPhone);
    expect(checkRateLimit(testPhone).allowed).toBe(true);
  });
});

describe('PhoneLock', () => {
  const testPhone = '573001111111';

  afterEach(() => {
    releaseLock(testPhone);
  });

  it('should acquire lock on first call', () => {
    expect(acquireLock(testPhone)).toBe(true);
  });

  it('should reject second lock attempt', () => {
    acquireLock(testPhone);
    expect(acquireLock(testPhone)).toBe(false);
  });

  it('should allow re-acquire after release', () => {
    acquireLock(testPhone);
    releaseLock(testPhone);
    expect(acquireLock(testPhone)).toBe(true);
  });

  it('isLocked should reflect lock state', () => {
    expect(isLocked(testPhone)).toBe(false);
    acquireLock(testPhone);
    expect(isLocked(testPhone)).toBe(true);
    releaseLock(testPhone);
    expect(isLocked(testPhone)).toBe(false);
  });

  it('getLockStats should return active count', () => {
    acquireLock(testPhone);
    const stats = getLockStats();
    expect(stats.activeCount).toBeGreaterThanOrEqual(1);
    expect(stats.phones).toContain(testPhone);
  });

  describe('withPhoneLock', () => {
    it('should execute function with lock held', async () => {
      const result = await withPhoneLock(testPhone, async () => 'done');
      expect(result).toBe('done');
      expect(isLocked(testPhone)).toBe(false);
    });

    it('should return null if lock already held', async () => {
      acquireLock(testPhone);
      const result = await withPhoneLock(testPhone, async () => 'should not run');
      expect(result).toBeNull();
    });

    it('should release lock even if function throws', async () => {
      try {
        await withPhoneLock(testPhone, async () => {
          throw new Error('test error');
        });
      } catch (e) {
        // expected
      }
      expect(isLocked(testPhone)).toBe(false);
    });
  });
});
