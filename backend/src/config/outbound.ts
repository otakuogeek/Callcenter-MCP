import Redis from 'ioredis';
import mysql from 'mysql2/promise';
import OutboundCallManager from '../services/OutboundCallManager';

let outboundManager: OutboundCallManager | null = null;

export async function initializeOutboundCallManager(): Promise<OutboundCallManager> {
  try {
    // Crear conexión a Redis
    const redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
    });

    // Crear conexión a MySQL
    const dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    // Crear instancia del OutboundCallManager
    outboundManager = new OutboundCallManager({
      db: dbConnection,
      redis,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
      elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID || '',
      callerIdInternational: process.env.OUTBOUND_DEFAULT_CALLER_ID || '',
      maxConcurrentCalls: parseInt(process.env.OUTBOUND_MAX_CONCURRENT_CALLS || '5'),
      timezone: process.env.OUTBOUND_SCHEDULE_TIMEZONE || 'America/Bogota',
      operatingHours: {
        start: parseInt(process.env.OUTBOUND_SCHEDULE_START_HOUR || '9'),
        end: parseInt(process.env.OUTBOUND_SCHEDULE_END_HOUR || '18')
      },
      rateLimit: parseInt(process.env.OUTBOUND_RATE_LIMIT || '10'),
      cooldownPeriod: parseInt(process.env.OUTBOUND_COOLDOWN_PERIOD || '30'),
    });

    console.log('✅ OutboundCallManager initialized successfully');
    return outboundManager;
  } catch (error) {
    console.error('❌ Error initializing OutboundCallManager:', error);
    throw error;
  }
}

export function getOutboundCallManager(): OutboundCallManager | null {
  return outboundManager;
}

export async function shutdownOutboundCallManager(): Promise<void> {
  if (outboundManager) {
    // Aquí podrías añadir métodos de limpieza si existen en el OutboundCallManager
    console.log('🛑 OutboundCallManager shutdown');
    outboundManager = null;
  }
}