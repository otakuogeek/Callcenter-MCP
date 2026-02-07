/**
 * WhatsApp Performance Optimizer
 * 
 * Optimizaciones de rendimiento para el agente de WhatsApp:
 * - Connection pooling mejorado con health checks
 * - Caché LRU para consultas frecuentes
 * - Batch processing de mensajes
 * - Lazy loading de servicios pesados
 * - Prefetch de datos predictivos
 * - Request coalescing para evitar consultas duplicadas
 * 
 * @version 1.0.0
 */

import pino from 'pino';
import { LRUCache } from 'lru-cache';

const logger = pino({
  name: 'whatsapp-performance',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// CACHE LRU CONFIGURABLE
// ============================================================================

interface CacheOptions {
  maxSize?: number;
  ttlMs?: number;
  updateAgeOnGet?: boolean;
}

export class SmartCache<T> {
  private cache: LRUCache<string, T>;
  private hitCount = 0;
  private missCount = 0;
  private name: string;

  constructor(name: string, options: CacheOptions = {}) {
    this.name = name;
    this.cache = new LRUCache<string, T>({
      max: options.maxSize || 1000,
      ttl: options.ttlMs || 300000, // 5 minutos por defecto
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      allowStale: true, // Permitir datos stale mientras se actualiza
      noDeleteOnStaleGet: true
    });
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hitCount++;
    } else {
      this.missCount++;
    }
    return value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, value, { ttl: ttlMs });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  getStats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.hitCount + this.missCount;
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      size: this.cache.size
    };
  }

  /**
   * Get or compute - si no está en caché, ejecuta la función y guarda el resultado
   */
  async getOrCompute(key: string, computeFn: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      logger.debug({ cache: this.name, key, action: 'hit' }, 'Cache hit');
      return cached;
    }

    logger.debug({ cache: this.name, key, action: 'miss' }, 'Cache miss, computing');
    const value = await computeFn();
    this.set(key, value, ttlMs);
    return value;
  }
}

// ============================================================================
// CACHES PRECONFIGURADOS PARA WHATSAPP
// ============================================================================

// Cache de pacientes por documento (frecuente)
export const patientCache = new SmartCache<any>('patients', {
  maxSize: 500,
  ttlMs: 600000 // 10 minutos
});

// Cache de disponibilidad por especialidad (cambia frecuentemente)
export const availabilityCache = new SmartCache<any>('availability', {
  maxSize: 100,
  ttlMs: 60000 // 1 minuto
});

// Cache de especialidades (cambia poco)
export const specialtiesCache = new SmartCache<any>('specialties', {
  maxSize: 50,
  ttlMs: 3600000 // 1 hora
});

// Cache de EPS (cambia poco)
export const epsCache = new SmartCache<any>('eps', {
  maxSize: 100,
  ttlMs: 3600000 // 1 hora
});

// Cache de conversaciones activas
export const conversationCache = new SmartCache<any>('conversations', {
  maxSize: 1000,
  ttlMs: 1800000 // 30 minutos
});

// ============================================================================
// REQUEST COALESCING - Evitar consultas duplicadas simultáneas
// ============================================================================

type PendingRequest = {
  promise: Promise<any>;
  timestamp: number;
};

const pendingRequests = new Map<string, PendingRequest>();
const COALESCE_WINDOW_MS = 100; // Ventana de coalescencia de 100ms

/**
 * Coalescencia de requests - si ya hay una request en vuelo para la misma key,
 * retorna la promesa existente en lugar de hacer otra request
 */
export async function coalesceRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const pending = pendingRequests.get(key);

  // Si hay una request pendiente y está dentro de la ventana, reutilizar
  if (pending && (now - pending.timestamp) < COALESCE_WINDOW_MS) {
    logger.debug({ key }, 'Coalescing duplicate request');
    return pending.promise as Promise<T>;
  }

  // Crear nueva request
  const promise = requestFn().finally(() => {
    // Limpiar después de un delay para evitar race conditions
    setTimeout(() => {
      const current = pendingRequests.get(key);
      if (current && current.promise === promise) {
        pendingRequests.delete(key);
      }
    }, COALESCE_WINDOW_MS);
  });

  pendingRequests.set(key, { promise, timestamp: now });
  return promise;
}

// ============================================================================
// BATCH PROCESSOR - Procesar múltiples items en lote
// ============================================================================

interface BatchItem<T, R> {
  key: string;
  item: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export class BatchProcessor<T, R> {
  private queue: BatchItem<T, R>[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private batchSize: number;
  private batchDelayMs: number;
  private processFn: (items: T[]) => Promise<R[]>;

  constructor(
    processFn: (items: T[]) => Promise<R[]>,
    options: { batchSize?: number; batchDelayMs?: number } = {}
  ) {
    this.processFn = processFn;
    this.batchSize = options.batchSize || 10;
    this.batchDelayMs = options.batchDelayMs || 50;
  }

  /**
   * Agregar item al batch
   */
  add(key: string, item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, item, resolve, reject });

      // Si alcanzamos el tamaño del batch, procesar inmediatamente
      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else {
        // De lo contrario, esperar un poco para acumular más items
        this.scheduleFlush();
      }
    });
  }

  /**
   * Programar flush después del delay
   */
  private scheduleFlush(): void {
    if (this.timeout) return;
    
    this.timeout = setTimeout(() => {
      this.flush();
    }, this.batchDelayMs);
  }

  /**
   * Procesar todos los items en cola
   */
  private async flush(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    const items = batch.map(b => b.item);

    try {
      logger.debug({ batchSize: batch.length }, 'Processing batch');
      const results = await this.processFn(items);

      // Resolver cada promesa con su resultado
      batch.forEach((b, index) => {
        if (results[index] !== undefined) {
          b.resolve(results[index]);
        } else {
          b.reject(new Error(`No result for batch item ${index}`));
        }
      });
    } catch (error: any) {
      // Rechazar todas las promesas
      batch.forEach(b => b.reject(error));
    }

    // Si quedan más items, programar otro flush
    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }
}

// ============================================================================
// LAZY LOADING DE SERVICIOS PESADOS
// ============================================================================

interface LazyService<T> {
  instance: T | null;
  loading: boolean;
  loadPromise: Promise<T> | null;
}

const lazyServices = new Map<string, LazyService<any>>();

/**
 * Registrar un servicio para carga lazy
 */
export function registerLazyService<T>(
  name: string,
  loader: () => Promise<T>
): () => Promise<T> {
  lazyServices.set(name, {
    instance: null,
    loading: false,
    loadPromise: null
  });

  return async (): Promise<T> => {
    const service = lazyServices.get(name)!;

    // Si ya está cargado, retornar instancia
    if (service.instance) {
      return service.instance;
    }

    // Si está cargando, esperar la promesa existente
    if (service.loading && service.loadPromise) {
      return service.loadPromise;
    }

    // Iniciar carga
    service.loading = true;
    service.loadPromise = loader().then(instance => {
      service.instance = instance;
      service.loading = false;
      logger.info({ service: name }, 'Lazy service loaded');
      return instance;
    }).catch(error => {
      service.loading = false;
      service.loadPromise = null;
      logger.error({ service: name, error: error.message }, 'Failed to load lazy service');
      throw error;
    });

    return service.loadPromise;
  };
}

// ============================================================================
// PREFETCHER PREDICTIVO
// ============================================================================

interface PrefetchRule {
  trigger: string; // Evento que dispara el prefetch
  dataToFetch: string[];
  priority: number;
}

const prefetchRules: PrefetchRule[] = [
  {
    trigger: 'patient_identified',
    dataToFetch: ['patient_appointments', 'patient_waiting_list', 'last_specialty'],
    priority: 1
  },
  {
    trigger: 'specialty_selected',
    dataToFetch: ['availability', 'doctors', 'locations'],
    priority: 1
  },
  {
    trigger: 'greeting',
    dataToFetch: ['specialties', 'eps_list'],
    priority: 2
  }
];

type PrefetchFunction = (context: Record<string, any>) => Promise<void>;
const prefetchFunctions = new Map<string, PrefetchFunction>();

/**
 * Registrar función de prefetch
 */
export function registerPrefetch(dataType: string, fn: PrefetchFunction): void {
  prefetchFunctions.set(dataType, fn);
}

/**
 * Ejecutar prefetch basado en un trigger
 */
export async function triggerPrefetch(
  triggerEvent: string,
  context: Record<string, any>
): Promise<void> {
  const matchingRules = prefetchRules.filter(r => r.trigger === triggerEvent);
  
  if (matchingRules.length === 0) return;

  // Ordenar por prioridad
  matchingRules.sort((a, b) => a.priority - b.priority);

  // Ejecutar prefetches en paralelo (sin esperar)
  for (const rule of matchingRules) {
    for (const dataType of rule.dataToFetch) {
      const fn = prefetchFunctions.get(dataType);
      if (fn) {
        // No esperamos, solo disparamos
        fn(context).catch(err => {
          logger.debug({ dataType, error: err.message }, 'Prefetch failed (non-blocking)');
        });
      }
    }
  }

  logger.debug({ trigger: triggerEvent, rules: matchingRules.length }, 'Prefetch triggered');
}

// ============================================================================
// MÉTRICAS DE RENDIMIENTO
// ============================================================================

interface PerformanceMetric {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
}

const performanceMetrics = new Map<string, PerformanceMetric>();

/**
 * Medir el tiempo de una operación
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    recordMetric(operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    recordMetric(`${operation}_error`, duration);
    throw error;
  }
}

function recordMetric(operation: string, durationMs: number): void {
  let metric = performanceMetrics.get(operation);
  
  if (!metric) {
    metric = {
      count: 0,
      totalMs: 0,
      minMs: Infinity,
      maxMs: 0,
      lastMs: 0
    };
    performanceMetrics.set(operation, metric);
  }

  metric.count++;
  metric.totalMs += durationMs;
  metric.minMs = Math.min(metric.minMs, durationMs);
  metric.maxMs = Math.max(metric.maxMs, durationMs);
  metric.lastMs = durationMs;

  // Log si es muy lento
  if (durationMs > 5000) {
    logger.warn({ operation, durationMs }, 'Slow operation detected');
  }
}

/**
 * Obtener todas las métricas de rendimiento
 */
export function getPerformanceMetrics(): Record<string, {
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
}> {
  const result: Record<string, any> = {};
  
  for (const [operation, metric] of performanceMetrics.entries()) {
    result[operation] = {
      count: metric.count,
      avgMs: Math.round(metric.totalMs / metric.count),
      minMs: metric.minMs === Infinity ? 0 : metric.minMs,
      maxMs: metric.maxMs,
      lastMs: metric.lastMs
    };
  }
  
  return result;
}

/**
 * Obtener resumen de todos los caches
 */
export function getCacheStats(): Record<string, { hits: number; misses: number; hitRate: number; size: number }> {
  return {
    patients: patientCache.getStats(),
    availability: availabilityCache.getStats(),
    specialties: specialtiesCache.getStats(),
    eps: epsCache.getStats(),
    conversations: conversationCache.getStats()
  };
}

// ============================================================================
// THROTTLING Y RATE LIMITING AVANZADO
// ============================================================================

interface ThrottleOptions {
  windowMs: number;
  maxRequests: number;
  burstAllowance?: number; // Permitir burst inicial
}

class AdvancedThrottler {
  private windows = new Map<string, { count: number; resetAt: number; burstUsed: number }>();
  private options: ThrottleOptions;

  constructor(options: ThrottleOptions) {
    this.options = {
      ...options,
      burstAllowance: options.burstAllowance || Math.ceil(options.maxRequests * 0.2)
    };
  }

  /**
   * Verificar si una request está permitida
   */
  isAllowed(key: string): { allowed: boolean; retryAfterMs?: number; remaining: number } {
    const now = Date.now();
    let window = this.windows.get(key);

    // Limpiar ventana expirada
    if (window && now >= window.resetAt) {
      this.windows.delete(key);
      window = undefined;
    }

    if (!window) {
      // Nueva ventana con burst allowance
      this.windows.set(key, {
        count: 1,
        resetAt: now + this.options.windowMs,
        burstUsed: 0
      });
      return { 
        allowed: true, 
        remaining: this.options.maxRequests + this.options.burstAllowance! - 1 
      };
    }

    const totalAllowed = this.options.maxRequests + this.options.burstAllowance!;
    
    if (window.count < totalAllowed) {
      window.count++;
      
      // Marcar si estamos usando burst
      if (window.count > this.options.maxRequests) {
        window.burstUsed++;
      }
      
      return { 
        allowed: true, 
        remaining: totalAllowed - window.count 
      };
    }

    return {
      allowed: false,
      retryAfterMs: window.resetAt - now,
      remaining: 0
    };
  }

  /**
   * Reset manual de un key
   */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * Obtener estado actual
   */
  getStatus(key: string): { count: number; remaining: number; resetAt: number } | null {
    const window = this.windows.get(key);
    if (!window) return null;

    const totalAllowed = this.options.maxRequests + this.options.burstAllowance!;
    return {
      count: window.count,
      remaining: Math.max(0, totalAllowed - window.count),
      resetAt: window.resetAt
    };
  }
}

// Throttler global para mensajes entrantes
export const messageThrottler = new AdvancedThrottler({
  windowMs: 60000,      // 1 minuto
  maxRequests: 20,      // 20 mensajes/minuto base
  burstAllowance: 5     // +5 en burst
});

// Throttler para llamadas a APIs externas
export const apiThrottler = new AdvancedThrottler({
  windowMs: 1000,       // 1 segundo
  maxRequests: 10,      // 10 requests/segundo
  burstAllowance: 3
});

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Caches
  patientCache,
  availabilityCache,
  specialtiesCache,
  epsCache,
  conversationCache,
  
  // Utilities
  coalesceRequest,
  registerLazyService,
  triggerPrefetch,
  registerPrefetch,
  
  // Performance
  measurePerformance,
  getPerformanceMetrics,
  getCacheStats,
  
  // Rate limiting
  messageThrottler,
  apiThrottler,
  
  // Classes for custom instances
  SmartCache,
  BatchProcessor,
  AdvancedThrottler
};
