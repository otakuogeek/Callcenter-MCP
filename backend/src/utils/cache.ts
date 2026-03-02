// In-memory cache with LRU eviction and size limits
interface CacheEntry<T> { value: T; expires: number; lastAccess: number; }
const store = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL_MS || '10000', 10);
const MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES || '1000', 10);

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { store.delete(key); return undefined; }
  entry.lastAccess = Date.now();
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  // LRU eviction when at capacity
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    let oldestKey = '';
    let oldestAccess = Infinity;
    for (const [k, v] of store) {
      if (Date.now() > v.expires) { store.delete(k); continue; }
      if (v.lastAccess < oldestAccess) { oldestAccess = v.lastAccess; oldestKey = k; }
    }
    if (store.size >= MAX_ENTRIES && oldestKey) store.delete(oldestKey);
  }
  const now = Date.now();
  store.set(key, { value, expires: now + ttlMs, lastAccess: now });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheInvalidatePrefix(prefix: string): number {
  let count = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) { store.delete(key); count++; }
  }
  return count;
}

export function cacheWrap<T>(key: string, ttlMs: number = DEFAULT_TTL, fn: () => Promise<T>): Promise<T> {
  const existing = cacheGet<T>(key);
  if (existing !== undefined) return Promise.resolve(existing);
  return fn().then(val => { cacheSet(key, val, ttlMs); return val; });
}

export function cacheStats() {
  return { size: store.size, maxEntries: MAX_ENTRIES };
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expires) store.delete(k);
  }
}, 5 * 60 * 1000).unref();
