/**
 * WhatsApp State Redis Persistence
 * 
 * Write-through cache: los estados se guardan en memoria (L1) y Redis (L2).
 * Después de un restart, los estados se recuperan de Redis automáticamente.
 * 
 * TTL: 2 horas (alineado con STATE_TIMEOUT del StateManager)
 */

import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({
  name: 'wa-state-redis',
  level: process.env.LOG_LEVEL || 'info'
});

// Prefijo para todas las keys de estado WhatsApp
const KEY_PREFIX = 'wa:state:';
const STATE_TTL_SECONDS = 7200; // 2 horas

// Singleton Redis client
let redisClient: Redis | null = null;
let redisAvailable = false;

/**
 * Obtener o crear cliente Redis singleton.
 * Si Redis no está disponible, opera en modo degradado (solo memoria).
 */
function getRedisClient(): Redis | null {
  if (redisClient) return redisAvailable ? redisClient : null;

  try {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    redisClient = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) {
          logger.warn('Redis: max retries reached, operating in memory-only mode');
          redisAvailable = false;
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
      enableReadyCheck: true,
      connectTimeout: 5000,
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
      logger.info('✅ Redis connected for WhatsApp state persistence');
    });

    redisClient.on('error', (err) => {
      if (redisAvailable) {
        logger.error({ err: err.message }, '❌ Redis error, falling back to memory-only');
        redisAvailable = false;
      }
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });

    redisClient.on('ready', () => {
      redisAvailable = true;
      logger.info('✅ Redis ready');
    });

    return redisClient;
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to create Redis client, memory-only mode');
    redisAvailable = false;
    return null;
  }
}

// Inicializar al importar el módulo
getRedisClient();

/**
 * Guardar estado en Redis (fire-and-forget, no bloquea el flujo principal)
 */
export async function saveStateToRedis(phone: string, state: any): Promise<void> {
  if (!redisAvailable || !redisClient) return;

  try {
    const key = `${KEY_PREFIX}${phone}`;
    // Serializar excluyendo campos que no se deben persistir (objetos grandes)
    const serializable = { ...state };
    
    // Limitar tamaño de arrays grandes para no sobrecargar Redis
    if (serializable.availableAppointments?.length > 20) {
      serializable.availableAppointments = serializable.availableAppointments.slice(0, 20);
    }
    if (serializable.timeSlots?.length > 30) {
      serializable.timeSlots = serializable.timeSlots.slice(0, 30);
    }

    const json = JSON.stringify(serializable);
    await redisClient.setex(key, STATE_TTL_SECONDS, json);
  } catch (err: any) {
    // No propagar errores — Redis es best-effort
    logger.warn({ phone, err: err.message }, 'Failed to save state to Redis');
  }
}

/**
 * Cargar estado desde Redis (usado tras restart cuando el Map en memoria está vacío)
 */
export async function loadStateFromRedis(phone: string): Promise<any | null> {
  if (!redisAvailable || !redisClient) return null;

  try {
    const key = `${KEY_PREFIX}${phone}`;
    const json = await redisClient.get(key);
    if (!json) return null;

    const state = JSON.parse(json);
    logger.info({ phone, currentState: state.currentState }, '🔄 State recovered from Redis');
    return state;
  } catch (err: any) {
    logger.warn({ phone, err: err.message }, 'Failed to load state from Redis');
    return null;
  }
}

/**
 * Eliminar estado de Redis (cuando se hace reset)
 */
export async function deleteStateFromRedis(phone: string): Promise<void> {
  if (!redisAvailable || !redisClient) return;

  try {
    const key = `${KEY_PREFIX}${phone}`;
    await redisClient.del(key);
  } catch (err: any) {
    logger.warn({ phone, err: err.message }, 'Failed to delete state from Redis');
  }
}

/**
 * Verificar si Redis está disponible
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}
