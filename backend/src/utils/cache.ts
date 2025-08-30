// Caché simple en memoria (LRU mínimo) para lookups y resultados frecuentes
interface CacheEntry<T> { value: T; expires: number; }
const store = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL_MS || '10000', 10);

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { store.delete(key); return undefined; }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
  // Pequeña limpieza si crece demasiado
  if (store.size > 500) {
    for (const [k, v] of store) {
      if (Date.now() > v.expires) store.delete(k);
    }
  }
}

export function cacheWrap<T>(key: string, ttlMs: number = DEFAULT_TTL, fn: () => Promise<T>): Promise<T> {
  const existing = cacheGet<T>(key);
  if (existing !== undefined) return Promise.resolve(existing);
  return fn().then(val => { cacheSet(key, val, ttlMs); return val; });
}
