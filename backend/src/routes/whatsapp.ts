import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import WhatsAppAI from '../services/WhatsAppAIService';
import MCPTools from '../services/MCPToolsClient';
import WhatsAppConnection, { whatsappEvents } from '../services/WhatsAppConnection';
import { normalizeIncomingText } from '../utils/whatsappUtils';
import { resetState } from '../services/WhatsAppStateManager';
import * as ChatMemoryService from '../services/ChatMemoryService';
import { resetConversationData } from '../services/ConversationPersistence';

const router = Router();

const phoneProcessingQueue = new Map<string, Promise<any>>();

async function runWithPhoneLock<T>(phone: string, task: () => Promise<T>): Promise<T> {
  const key = (phone || '').replace(/@.*/, '').trim();
  const previous = phoneProcessingQueue.get(key) || Promise.resolve();

  const current = previous
    .catch(() => undefined)
    .then(task);

  phoneProcessingQueue.set(key, current as Promise<any>);

  try {
    return await current;
  } finally {
    if (phoneProcessingQueue.get(key) === current) {
      phoneProcessingQueue.delete(key);
    }
  }
}

// ============================================================================
// RATE LIMITING POR NÚMERO DE TELÉFONO
// ============================================================================

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
  blocked: boolean;
  blockedUntil?: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Configuración de rate limiting
const RATE_LIMIT_WINDOW_MS = 60_000;      // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 20;        // máximo 20 mensajes por minuto
const RATE_LIMIT_BLOCK_DURATION_MS = 300_000; // bloqueo de 5 minutos
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000; // limpiar cada minuto

/**
 * Verificar rate limit para un número de teléfono
 * @returns true si está permitido, false si está bloqueado
 */
function checkRateLimit(phone: string): { allowed: boolean; reason?: string; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  
  // Si no hay entrada, crear una nueva
  if (!entry) {
    rateLimitMap.set(phone, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
      blocked: false
    });
    return { allowed: true };
  }
  
  // Si está bloqueado, verificar si ya pasó el tiempo
  if (entry.blocked && entry.blockedUntil) {
    if (now < entry.blockedUntil) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      return { 
        allowed: false, 
        reason: `Rate limit excedido. Intenta de nuevo en ${retryAfter} segundos.`,
        retryAfter 
      };
    }
    // Desbloquear y resetear
    entry.blocked = false;
    entry.blockedUntil = undefined;
    entry.count = 1;
    entry.firstRequest = now;
    entry.lastRequest = now;
    return { allowed: true };
  }
  
  // Si la ventana expiró, resetear contador
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.firstRequest = now;
    entry.lastRequest = now;
    return { allowed: true };
  }
  
  // Incrementar contador
  entry.count++;
  entry.lastRequest = now;
  
  // Verificar si excedió el límite
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    entry.blocked = true;
    entry.blockedUntil = now + RATE_LIMIT_BLOCK_DURATION_MS;
    console.warn(`[RateLimit] Número ${phone} bloqueado por exceder ${RATE_LIMIT_MAX_REQUESTS} mensajes/minuto`);
    return { 
      allowed: false, 
      reason: `Has enviado demasiados mensajes. Espera 5 minutos antes de continuar.`,
      retryAfter: RATE_LIMIT_BLOCK_DURATION_MS / 1000
    };
  }
  
  return { allowed: true };
}

// normalizeIncomingText importada desde ../utils/whatsappUtils

const MAX_RATE_LIMIT_ENTRIES = 10000; // Límite máximo de entradas en el mapa

// Limpiar entradas antiguas del rate limit periódicamente
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  const expiredCutoff = now - RATE_LIMIT_WINDOW_MS * 2;
  
  for (const [phone, entry] of rateLimitMap.entries()) {
    // Eliminar entradas inactivas por más de 2 ventanas
    if (entry.lastRequest < expiredCutoff && !entry.blocked) {
      rateLimitMap.delete(phone);
    }
    // Eliminar bloqueos expirados
    if (entry.blocked && entry.blockedUntil && now > entry.blockedUntil) {
      rateLimitMap.delete(phone);
    }
  }
  // Si aún hay demasiadas entradas, eliminar las más antiguas
  if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    const sorted = Array.from(rateLimitMap.entries())
      .sort((a, b) => a[1].lastRequest - b[1].lastRequest);
    const toRemove = sorted.slice(0, rateLimitMap.size - MAX_RATE_LIMIT_ENTRIES);
    for (const [phone] of toRemove) {
      rateLimitMap.delete(phone);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);
if (rateLimitCleanupTimer.unref) rateLimitCleanupTimer.unref();

// ============================================================================
// MÉTRICAS DE FALLOS POR INTENT
// ============================================================================

interface IntentMetric {
  total: number;
  success: number;
  failed: number;
  avgResponseTimeMs: number;
  lastError?: string;
  lastErrorTime?: number;
}

const intentMetrics = new Map<string, IntentMetric>();
const globalMetrics = {
  totalRequests: 0,
  totalFailures: 0,
  rateLimitBlocks: 0,
  normalizedMessages: 0,
  startTime: Date.now()
};

/**
 * Registrar métrica de un intent procesado
 */
function recordIntentMetric(intent: string, success: boolean, responseTimeMs: number, error?: string): void {
  const metric = intentMetrics.get(intent) || {
    total: 0,
    success: 0,
    failed: 0,
    avgResponseTimeMs: 0
  };
  
  metric.total++;
  if (success) {
    metric.success++;
  } else {
    metric.failed++;
    metric.lastError = error;
    metric.lastErrorTime = Date.now();
    globalMetrics.totalFailures++;
  }
  
  // Calcular promedio móvil del tiempo de respuesta
  metric.avgResponseTimeMs = Math.round(
    (metric.avgResponseTimeMs * (metric.total - 1) + responseTimeMs) / metric.total
  );
  
  intentMetrics.set(intent, metric);
  globalMetrics.totalRequests++;
}

/**
 * Obtener métricas de intents
 */
function getIntentMetrics(): { intents: Record<string, IntentMetric>; global: typeof globalMetrics } {
  const intents: Record<string, IntentMetric> = {};
  for (const [intent, metric] of intentMetrics.entries()) {
    intents[intent] = { ...metric };
  }
  
  return {
    intents,
    global: {
      ...globalMetrics,
      uptimeSeconds: Math.round((Date.now() - globalMetrics.startTime) / 1000),
      activeRateLimits: rateLimitMap.size,
      blockedNumbers: Array.from(rateLimitMap.values()).filter(e => e.blocked).length
    } as any
  };
}

// ============================================================================
// INTERFACES
// ============================================================================

interface WhatsAppSession extends RowDataPacket {
  id: number;
  session_id: string;
  phone_number: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending';
  qr_code: string | null;
  last_activity: Date;
  created_at: Date;
  updated_at: Date;
}

interface WhatsAppMessage extends RowDataPacket {
  id: number;
  session_id: string;
  message_id: string;
  from_number: string;
  to_number: string;
  body: string;
  media_url: string | null;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  ai_response: string | null;
  created_at: Date;
}

interface WhatsAppStats extends RowDataPacket {
  total_messages: number;
  inbound_messages: number;
  outbound_messages: number;
  ai_responses: number;
  failed_messages: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function ensureTablesExist(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    // Crear tabla de sesiones WhatsApp
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS wa_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        phone_number VARCHAR(20),
        status ENUM('connected', 'disconnected', 'connecting', 'qr_pending') DEFAULT 'disconnected',
        qr_code TEXT,
        auth_data JSON,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_phone (phone_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Crear tabla de mensajes WhatsApp
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS wa_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        message_id VARCHAR(100) UNIQUE,
        from_number VARCHAR(50) NOT NULL,
        to_number VARCHAR(50),
        body TEXT,
        media_url TEXT,
        media_type VARCHAR(50),
        direction ENUM('inbound', 'outbound') NOT NULL,
        status ENUM('pending', 'sent', 'delivered', 'read', 'failed') DEFAULT 'pending',
        ai_response TEXT,
        ai_model VARCHAR(50),
        response_time_ms INT,
        metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_session (session_id),
        INDEX idx_direction (direction),
        INDEX idx_status (status),
        INDEX idx_from (from_number),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Crear tabla de conversaciones activas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS wa_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        patient_id INT,
        context JSON,
        last_message TEXT,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'waiting', 'closed') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_session_phone (session_id, phone_number),
        INDEX idx_patient (patient_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ WhatsApp tables verified/created');
  } finally {
    connection.release();
  }
}

// Inicializar tablas al cargar el módulo
ensureTablesExist().catch(err => {
  console.error('Error creating WhatsApp tables:', err);
});

// ============================================================================
// STATUS & HEALTH ENDPOINTS
// ============================================================================

/**
 * GET /api/whatsapp/status
 * Obtener estado general del sistema WhatsApp
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Obtener estado real de la conexión Baileys
    const connectionStatus = WhatsAppConnection.getStatus();
    
    const connection = await pool.getConnection();
    try {
      // Obtener estadísticas de hoy
      const [statsRows] = await connection.execute<WhatsAppStats[]>(`
        SELECT 
          COUNT(*) as total_messages,
          SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound_messages,
          SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound_messages,
          SUM(CASE WHEN ai_response IS NOT NULL THEN 1 ELSE 0 END) as ai_responses,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_messages
        FROM wa_messages
        WHERE DATE(created_at) = CURDATE()
      `);

      const stats = statsRows[0] || {
        total_messages: 0,
        inbound_messages: 0,
        outbound_messages: 0,
        ai_responses: 0,
        failed_messages: 0
      };

      // Obtener conversaciones activas
      const [convRows] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as active_conversations
        FROM wa_conversations
        WHERE status = 'active'
        AND last_activity > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
      `);

      res.json({
        success: true,
        data: {
          connected: connectionStatus.connected,
          status: connectionStatus.status,
          session: {
            id: connectionStatus.sessionId,
            phone: connectionStatus.phoneNumber,
            lastActivity: new Date()
          },
          qrCode: connectionStatus.qrCode,
          lastError: connectionStatus.lastError,
          stats: {
            todayMessages: stats.total_messages || 0,
            inboundMessages: stats.inbound_messages || 0,
            outboundMessages: stats.outbound_messages || 0,
            aiResponses: stats.ai_responses || 0,
            failedMessages: stats.failed_messages || 0,
            activeConversations: convRows[0]?.active_conversations || 0
          },
          config: {
            aiProvider: process.env.WHATSAPP_USE_GROQ?.toLowerCase() === 'true' ? 'groq' : 'chatgpt',
            aiModel: process.env.WHATSAPP_USE_GROQ?.toLowerCase() === 'true' 
              ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile')
              : (process.env.CHATGPT_MODEL || 'gpt-4o-mini'),
            useLangGraph: process.env.WHATSAPP_USE_LANGGRAPH === 'true',
            autoReply: process.env.WHATSAPP_AUTO_REPLY === 'true',
            businessHoursOnly: process.env.WHATSAPP_BUSINESS_HOURS_ONLY === 'true'
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado de WhatsApp'
    });
  }
});

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * GET /api/whatsapp/sessions
 * Listar todas las sesiones
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const [sessions] = await pool.execute<WhatsAppSession[]>(`
      SELECT id, session_id, phone_number, status, last_activity, created_at, updated_at
      FROM wa_sessions
      ORDER BY updated_at DESC
    `);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Error listando sesiones'
    });
  }
});

/**
 * POST /api/whatsapp/sessions/create
 * Crear nueva sesión (iniciar conexión a WhatsApp)
 */
router.post('/sessions/create', async (req: Request, res: Response) => {
  try {
    console.log('[WhatsApp] Iniciando conexión...');
    
    const result = await WhatsAppConnection.startConnection();
    
    res.json({
      success: result.success,
      data: {
        status: WhatsAppConnection.getStatus().status,
        message: result.message,
        qrCode: result.qrCode || null
      }
    });
  } catch (error: any) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error creando sesión'
    });
  }
});

/**
 * POST /api/whatsapp/connect
 * Alias para iniciar conexión
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    console.log('[WhatsApp] Conectando...');
    
    const result = await WhatsAppConnection.startConnection();
    
    res.json({
      success: result.success,
      data: {
        ...WhatsAppConnection.getStatus(),
        message: result.message
      }
    });
  } catch (error: any) {
    console.error('Error connecting:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error conectando'
    });
  }
});

/**
 * POST /api/whatsapp/force-restart
 * Forzar reinicio completo: limpia sesión, resetea intentos e inicia nueva conexión
 */
router.post('/force-restart', async (req: Request, res: Response) => {
  try {
    console.log('[WhatsApp] Forzando reinicio completo...');
    const result = await WhatsAppConnection.forceRestartWithCleanSession();
    
    res.json({
      success: result.success,
      data: {
        ...WhatsAppConnection.getStatus(),
        message: result.success
          ? 'Reconexión forzada iniciada con sesión limpia'
          : (result.message || 'Error en reinicio forzado')
      }
    });
  } catch (error: any) {
    console.error('Error en force-restart:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error reiniciando conexión'
    });
  }
});

/**
 * POST /api/whatsapp/sessions/:sessionId/disconnect
 * Desconectar sesión
 */
router.post('/sessions/:sessionId/disconnect', async (req: Request, res: Response) => {
  try {
    const result = await WhatsAppConnection.disconnect();

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error: any) {
    console.error('Error disconnecting session:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconectando sesión'
    });
  }
});

/**
 * POST /api/whatsapp/disconnect
 * Alias para desconectar
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const result = await WhatsAppConnection.disconnect();

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error: any) {
    console.error('Error disconnecting:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconectando'
    });
  }
});

/**
 * GET /api/whatsapp/qr
 * Obtener código QR actual para conectar
 */
router.get('/qr', async (req: Request, res: Response) => {
  try {
    const status = WhatsAppConnection.getStatus();
    
    if (status.status !== 'qr_pending' || !status.qrCode) {
      res.json({
        success: true,
        data: {
          available: false,
          status: status.status,
          connected: status.connected,
          phoneNumber: status.phoneNumber,
          message: status.connected ? 'Ya conectado' : 'No hay código QR disponible'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        available: true,
        sessionId: status.sessionId,
        qrCode: status.qrCode,
        status: status.status
      }
    });
  } catch (error: any) {
    console.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo código QR'
    });
  }
});

/**
 * GET /api/whatsapp/connection-status
 * Obtener estado detallado de la conexión
 */
router.get('/connection-status', async (req: Request, res: Response) => {
  try {
    const status = WhatsAppConnection.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('Error getting connection status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo estado'
    });
  }
});

// ============================================================================
// MESSAGE MANAGEMENT
// ============================================================================

/**
 * GET /api/whatsapp/messages
 * Listar mensajes con filtros y paginación
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const direction = req.query.direction as string;
    const phone = req.query.phone as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    let whereClause = '1=1';
    const params: any[] = [];

    if (direction && ['inbound', 'outbound'].includes(direction)) {
      whereClause += ' AND direction = ?';
      params.push(direction);
    }

    if (phone) {
      whereClause += ' AND (from_number LIKE ? OR to_number LIKE ?)';
      params.push(`%${phone}%`, `%${phone}%`);
    }

    if (dateFrom) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(dateTo);
    }

    // Obtener total
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM wa_messages WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Obtener mensajes
    const [messages] = await pool.execute<WhatsAppMessage[]>(
      `SELECT * FROM wa_messages 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error listing messages:', error);
    res.status(500).json({
      success: false,
      error: 'Error listando mensajes'
    });
  }
});

/**
 * POST /api/whatsapp/messages/send
 * Enviar mensaje manualmente
 */
router.post('/messages/send', async (req: Request, res: Response) => {
  try {
    const { to, message, sessionId } = req.body;

    if (!to || !message) {
      res.status(400).json({
        success: false,
        error: 'Se requiere destinatario (to) y mensaje (message)'
      });
      return;
    }

    // Verificar conexión
    const status = WhatsAppConnection.getStatus();
    if (!status.connected) {
      res.status(503).json({
        success: false,
        error: 'WhatsApp no está conectado. Por favor, escanee el código QR primero.'
      });
      return;
    }

    // Enviar mensaje real via Baileys
    const sendResult = await WhatsAppConnection.sendMessage(to, message);
    
    if (!sendResult.success) {
      res.status(500).json({
        success: false,
        error: sendResult.error || 'Error enviando mensaje'
      });
      return;
    }

    // Guardar mensaje en BD
    const messageId = sendResult.messageId || `msg_${Date.now()}`;
    
    await pool.execute<ResultSetHeader>(`
      INSERT INTO wa_messages 
      (session_id, message_id, from_number, to_number, body, direction, status)
      VALUES (?, ?, ?, ?, ?, 'outbound', 'sent')
    `, [status.sessionId, messageId, status.phoneNumber || 'bot', to, message]);

    res.json({
      success: true,
      data: {
        messageId,
        to,
        status: 'sent',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando mensaje'
    });
  }
});

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * GET /api/whatsapp/conversations
 * Listar conversaciones activas (solo de la sesión conectada actual)
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string || 'active';

    // Obtener sesión conectada actual
    const [sessions] = await pool.execute<RowDataPacket[]>(`
      SELECT session_id FROM wa_sessions 
      WHERE status = 'connected' 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);

    if (sessions.length === 0) {
      res.json({
        success: true,
        data: [] // No hay sesión conectada, retornar vacío
      });
      return;
    }

    const currentSessionId = sessions[0].session_id;

    const [conversations] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        c.*,
        p.name as patient_name,
        p.document as patient_document,
        (SELECT COUNT(*) FROM wa_messages m 
         WHERE (m.from_number = c.phone_number OR m.to_number = c.phone_number)
         AND m.session_id = c.session_id) as message_count
      FROM wa_conversations c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE c.status = ? AND c.session_id = ?
      ORDER BY c.last_activity DESC
      LIMIT 100
    `, [status, currentSessionId]);

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Error listando conversaciones'
    });
  }
});

/**
 * GET /api/whatsapp/conversations/:phone
 * Obtener historial de conversación con un número (solo de sesión actual)
 */
router.get('/conversations/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    // Obtener sesión conectada actual
    const [sessions] = await pool.execute<RowDataPacket[]>(`
      SELECT session_id FROM wa_sessions 
      WHERE status = 'connected' 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);

    if (sessions.length === 0) {
      res.json({
        success: true,
        data: { conversation: null, messages: [] }
      });
      return;
    }

    const currentSessionId = sessions[0].session_id;

    const [messages] = await pool.execute<WhatsAppMessage[]>(`
      SELECT * FROM wa_messages
      WHERE (from_number LIKE ? OR to_number LIKE ?)
      AND session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [`%${phone}%`, `%${phone}%`, currentSessionId, limit]);

    // Obtener info de conversación
    const [convInfo] = await pool.execute<RowDataPacket[]>(`
      SELECT c.*, p.name as patient_name
      FROM wa_conversations c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE c.phone_number LIKE ? AND c.session_id = ?
      LIMIT 1
    `, [`%${phone}%`, currentSessionId]);

    res.json({
      success: true,
      data: {
        conversation: convInfo[0] || null,
        messages: messages.reverse() // Orden cronológico
      }
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo conversación'
    });
  }
});

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /api/whatsapp/analytics
 * Obtener analíticas detalladas
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    // Mensajes por día
    const [messagesByDay] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
        SUM(CASE WHEN ai_response IS NOT NULL THEN 1 ELSE 0 END) as ai_handled,
        AVG(response_time_ms) as avg_response_time
      FROM wa_messages
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [days]);

    // Top números activos
    const [topNumbers] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        from_number as phone,
        COUNT(*) as message_count,
        MAX(created_at) as last_activity
      FROM wa_messages
      WHERE direction = 'inbound'
      AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY from_number
      ORDER BY message_count DESC
      LIMIT 10
    `, [days]);

    // Resumen general
    const [summary] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT from_number) as unique_contacts,
        SUM(CASE WHEN ai_response IS NOT NULL THEN 1 ELSE 0 END) as ai_responses,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_messages
      FROM wa_messages
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    res.json({
      success: true,
      data: {
        period: `${days} días`,
        summary: summary[0] || {},
        messagesByDay,
        topNumbers
      }
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo analíticas'
    });
  }
});

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * GET /api/whatsapp/config
 * Obtener configuración actual
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        aiProvider: process.env.WHATSAPP_AI_PROVIDER || 'deepseek',
        aiModel: process.env.WHATSAPP_AI_MODEL || 'deepseek-chat',
        autoReply: process.env.WHATSAPP_AUTO_REPLY === 'true',
        businessHoursOnly: process.env.WHATSAPP_BUSINESS_HOURS_ONLY === 'true',
        businessHoursStart: process.env.WHATSAPP_BUSINESS_HOURS_START || '07:00',
        businessHoursEnd: process.env.WHATSAPP_BUSINESS_HOURS_END || '18:00',
        welcomeMessage: process.env.WHATSAPP_WELCOME_MESSAGE || 'Bienvenido a Biosanar IPS',
        awayMessage: process.env.WHATSAPP_AWAY_MESSAGE || 'Estamos fuera de horario de atención',
        maxConversationLength: parseInt(process.env.WHATSAPP_MAX_CONV_LENGTH || '50'),
        sessionTimeout: parseInt(process.env.WHATSAPP_SESSION_TIMEOUT || '3600000')
      }
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo configuración'
    });
  }
});

/**
 * PUT /api/whatsapp/config
 * Actualizar configuración (solo en memoria por ahora)
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const allowedKeys = [
      'autoReply', 'businessHoursOnly', 'businessHoursStart', 
      'businessHoursEnd', 'welcomeMessage', 'awayMessage'
    ];
    
    const updates: Record<string, any> = {};
    
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // En producción, esto debería guardarse en la BD o archivo .env
    res.json({
      success: true,
      message: 'Configuración actualizada',
      data: updates
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando configuración'
    });
  }
});

// ============================================================================
// VOICE MESSAGES - Mensajes de Voz con Whisper + TTS
// ============================================================================

/**
 * POST /api/whatsapp/send-voice
 * Enviar mensaje de voz (texto convertido a audio TTS)
 */
router.post('/send-voice', async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      res.status(400).json({
        success: false,
        error: 'Se requiere "to" (número) y "message" (texto)'
      });
      return;
    }

    // Verificar conexión
    const status = WhatsAppConnection.getStatus();
    if (!status.connected) {
      res.status(503).json({
        success: false,
        error: 'WhatsApp no está conectado'
      });
      return;
    }

    console.log(`[WhatsApp Voice] Enviando nota de voz a ${to}`);
    
    // Importar funciones necesarias
    const { sendVoiceNote } = await import('../services/WhatsAppConnection');
    
    const result = await sendVoiceNote(to, message);

    if (result.success) {
      // Guardar en BD
      await pool.execute(`
        INSERT INTO wa_messages 
        (session_id, message_id, from_number, to_number, body, direction, status, media_type)
        VALUES ('default', ?, 'bot', ?, ?, 'outbound', 'sent', 'audio')
      `, [result.messageId || `voice_${Date.now()}`, to, `🔊 ${message}`]);
    }

    res.json({
      success: result.success,
      data: {
        messageId: result.messageId,
        type: 'voice',
        to,
        textLength: message.length
      },
      error: result.error
    });
  } catch (error: any) {
    console.error('Error sending voice message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando mensaje de voz'
    });
  }
});

/**
 * POST /api/whatsapp/transcribe
 * Transcribir un archivo de audio a texto usando Whisper
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioUrl, audioBase64, mimeType } = req.body;

    if (!audioUrl && !audioBase64) {
      res.status(400).json({
        success: false,
        error: 'Se requiere "audioUrl" o "audioBase64"'
      });
      return;
    }

    const { transcribeAudio } = await import('../services/AudioTranscriptionService');
    const axios = await import('axios');
    
    let audioBuffer: Buffer;

    if (audioBase64) {
      // Audio en base64
      audioBuffer = Buffer.from(audioBase64, 'base64');
    } else if (audioUrl) {
      // Descargar audio desde URL
      const response = await axios.default.get(audioUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000
      });
      audioBuffer = Buffer.from(response.data);
    } else {
      res.status(400).json({ success: false, error: 'No se proporcionó audio' });
      return;
    }

    console.log(`[WhatsApp Transcribe] Transcribiendo audio (${audioBuffer.length} bytes)`);
    
    const result = await transcribeAudio(audioBuffer, mimeType || 'audio/ogg');

    res.json({
      success: result.success,
      data: {
        text: result.text,
        duration: result.duration
      },
      error: result.error
    });
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error transcribiendo audio'
    });
  }
});

/**
 * POST /api/whatsapp/tts
 * Convertir texto a audio (Text-to-Speech)
 * Soporta: ElevenLabs (por defecto), GPT Audio, OpenAI TTS
 */
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice, speed, useGPTAudio, forceProvider } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        error: 'Se requiere "text"'
      });
      return;
    }

    // Determinar proveedor TTS
    const ttsProvider = forceProvider || process.env.TTS_PROVIDER || 'openai';
    const shouldUseGPTAudio = useGPTAudio === true || 
      (ttsProvider === 'gpt-audio' && process.env.USE_GPT_AUDIO_MODEL === 'true');
    const shouldUseElevenLabs = ttsProvider === 'elevenlabs';

    let audioBuffer: Buffer | undefined;
    let audioVoice: string = voice || 'nova';
    let generationTime: number = 0;
    let provider: string = 'tts-1';

    // Prioridad: ElevenLabs > GPT Audio > OpenAI TTS
    if (shouldUseElevenLabs) {
      // Usar ElevenLabs TTS
      const ElevenLabsTTS = await import('../services/ElevenLabsTTSService');
      
      console.log(`[WhatsApp TTS] Generando con ElevenLabs (${text.length} caracteres)`);
      
      const startTime = Date.now();
      const result = await ElevenLabsTTS.generateWhatsAppVoiceNoteElevenLabs(text, voice);
      generationTime = Date.now() - startTime;

      if (result.success && result.audioBuffer) {
        audioBuffer = result.audioBuffer;
        audioVoice = result.voiceName || 'Sofía';
        provider = 'elevenlabs';
      } else {
        console.warn('[WhatsApp TTS] ElevenLabs falló, usando TTS tradicional:', result.error);
      }
    } else if (shouldUseGPTAudio) {
      // Usar GPT Audio (gpt-audio-mini-2025-12-15)
      const GPTAudioService = await import('../services/GPTAudioService');
      
      console.log(`[WhatsApp TTS] Generando con GPT Audio (${text.length} caracteres, voz: ${audioVoice})`);
      
      const startTime = Date.now();
      const result = await GPTAudioService.generateWhatsAppAudio(text, true);
      generationTime = Date.now() - startTime;

      if (result.success && result.audioBuffer) {
        audioBuffer = result.audioBuffer;
        provider = process.env.GPT_AUDIO_MODEL || 'gpt-audio-mini-2025-12-15';
      } else {
        console.warn('[WhatsApp TTS] GPT Audio falló, usando TTS tradicional:', result.error);
      }
    }

    // Fallback a OpenAI TTS si los anteriores no funcionaron
    if (!audioBuffer) {
      const { textToSpeech } = await import('../services/TextToSpeechService');
      
      console.log(`[WhatsApp TTS] Generando con OpenAI TTS (${text.length} caracteres, voz: ${audioVoice})`);
      
      const startTime = Date.now();
      const result = await textToSpeech(text, {
        voice: voice || 'nova',
        speed: speed || 1.0,
        outputFormat: 'mp3'
      });
      generationTime = Date.now() - startTime;

      if (!result.success || !result.audioBuffer) {
        res.status(500).json({
          success: false,
          error: result.error || 'Error generando audio'
        });
        return;
      }

      audioBuffer = result.audioBuffer;
      provider = process.env.TTS_MODEL || 'tts-1';
    }

    // Devolver audio como base64 o como archivo
    const returnAsFile = req.query.format === 'file';

    if (returnAsFile) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="response.mp3"');
      res.send(audioBuffer);
    } else {
      const { AVAILABLE_VOICES } = await import('../services/TextToSpeechService');
      const ElevenLabsTTS = await import('../services/ElevenLabsTTSService');
      
      res.json({
        success: true,
        data: {
          audioBase64: audioBuffer.toString('base64'),
          audioSize: audioBuffer.length,
          duration: generationTime,
          voice: audioVoice,
          provider,
          textLength: text.length,
          availableVoices: AVAILABLE_VOICES,
          elevenLabsVoices: ElevenLabsTTS.SPANISH_VOICES
        }
      });
    }
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error generando texto a voz'
    });
  }
});

/**
 * GET /api/whatsapp/tts/voices
 * Listar voces disponibles para TTS
 */
router.get('/tts/voices', async (req: Request, res: Response) => {
  try {
    const { AVAILABLE_VOICES } = await import('../services/TextToSpeechService');
    
    res.json({
      success: true,
      data: {
        voices: AVAILABLE_VOICES,
        recommended: 'nova',
        description: 'Nova es la voz recomendada para Valeria (voz femenina cálida y amigable)'
      }
    });
  } catch (error: any) {
    console.error('Error getting voices:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo voces'
    });
  }
});

/**
 * GET /api/whatsapp/voice-config
 * Obtener configuración de mensajes de voz
 */
router.get('/voice-config', async (req: Request, res: Response) => {
  try {
    const ttsProvider = process.env.TTS_PROVIDER || 'openai';
    const useGPTAudio = process.env.USE_GPT_AUDIO_MODEL === 'true';
    const useElevenLabs = ttsProvider === 'elevenlabs';
    
    res.json({
      success: true,
      data: {
        voiceResponsesEnabled: process.env.WHATSAPP_VOICE_RESPONSES === 'true',
        whisperModel: 'whisper-1',
        // Proveedor TTS activo
        ttsProvider: ttsProvider,
        // ElevenLabs Configuration
        elevenLabsEnabled: useElevenLabs,
        elevenLabsVoiceId: useElevenLabs ? (process.env.ELEVENLABS_VOICE_ID || 'b2htR0pMe28pYwCY9gnP') : null,
        elevenLabsModel: useElevenLabs ? (process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2') : null,
        elevenLabsVoiceName: useElevenLabs ? 'Sofía (colombiana, natural)' : null,
        // GPT Audio (Chat + TTS integrado)
        gptAudioEnabled: ttsProvider === 'gpt-audio' || useGPTAudio,
        gptAudioModel: useGPTAudio ? (process.env.GPT_AUDIO_MODEL || 'gpt-audio-mini-2025-12-15') : null,
        gptAudioVoice: useGPTAudio ? (process.env.GPT_AUDIO_VOICE || 'nova') : null,
        gptAudioFormat: useGPTAudio ? (process.env.GPT_AUDIO_FORMAT || 'mp3') : null,
        // OpenAI TTS Fallback
        ttsModel: process.env.TTS_MODEL || 'tts-1',
        ttsVoice: process.env.TTS_VOICE || 'nova',
        description: useElevenLabs 
          ? 'ElevenLabs habilitado: voz Sofía (colombiana, natural y conversacional) - alta calidad'
          : useGPTAudio 
            ? 'GPT Audio habilitado: genera respuesta + audio en una sola llamada API'
            : 'Usando OpenAI TTS: modelo tts-1 con voz nova'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// WEBHOOK PARA RECIBIR MENSAJES (Baileys/Twilio)
// ============================================================================

/**
 * POST /api/whatsapp/webhook
 * Recibir mensajes entrantes y procesar con IA
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { from, body: rawBody, messageId, profileName, mediaUrl, mediaType } = req.body;

    if (!from || !rawBody) {
      res.status(400).json({ success: false, error: 'Datos incompletos' });
      return;
    }

    // Aplicar rate limiting
    const rateLimitResult = checkRateLimit(from);
    if (!rateLimitResult.allowed) {
      console.warn(`[WhatsApp Webhook] Rate limit para ${from}: ${rateLimitResult.reason}`);
      globalMetrics.rateLimitBlocks++;
      res.status(429).json({ 
        success: false, 
        error: rateLimitResult.reason,
        retryAfter: rateLimitResult.retryAfter
      });
      return;
    }

    // Normalizar texto entrante
    const body = normalizeIncomingText(rawBody);
    if (body !== rawBody) {
      globalMetrics.normalizedMessages++;
    }
    
    console.log(`[WhatsApp Webhook] Mensaje de ${from}: ${body.substring(0, 100)}...`);

    // Procesar por teléfono de forma serializada para evitar carreras de estado
    const aiResponse = await runWithPhoneLock(from, async () => {
      let responseText: string | null = null;
      const autoReply = process.env.WHATSAPP_AUTO_REPLY === 'true';
      const aiStartTime = Date.now();

      if (autoReply && WhatsAppAI.isConfigured()) {
        try {
          const result = await WhatsAppAI.processMessage(body, from, []);
          const aiDuration = Date.now() - aiStartTime;

          if (result.success && result.response) {
            responseText = result.response;
            recordIntentMetric(result.intent || 'unknown', true, aiDuration);
          } else {
            recordIntentMetric(result.intent || 'unknown', false, aiDuration, result.error);
          }
          console.log(`[WhatsApp Webhook] Respuesta IA generada: ${responseText?.substring(0, 100)}...`);
        } catch (aiError: any) {
          const aiDuration = Date.now() - aiStartTime;
          recordIntentMetric('error', false, aiDuration, aiError.message);
          console.error('[WhatsApp Webhook] Error en IA:', aiError);
        }
      } else {
        const msgId = messageId || `msg_${Date.now()}`;

        await pool.execute<ResultSetHeader>(`
          INSERT INTO wa_messages 
          (session_id, message_id, from_number, body, media_url, media_type, direction, status)
          VALUES ('default', ?, ?, ?, ?, ?, 'inbound', 'delivered')
        `, [msgId, from, body, mediaUrl || null, mediaType || null]);

        await pool.execute(`
          INSERT INTO wa_conversations (session_id, phone_number, last_message, last_activity)
          VALUES ('default', ?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
            last_message = VALUES(last_message),
            last_activity = NOW(),
            status = 'active'
        `, [from, body]);
      }

      return responseText;
    });

    res.json({
      success: true,
      data: {
        messageId: messageId || `msg_${Date.now()}`,
        received: true,
        aiProcessed: !!aiResponse,
        aiResponse: aiResponse ? aiResponse.substring(0, 100) + '...' : null
      }
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando mensaje'
    });
  }
});

/**
 * POST /api/whatsapp/chat
 * Endpoint para chat interactivo (testing desde dashboard)
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      res.status(400).json({ 
        success: false, 
        error: 'Se requiere phone y message' 
      });
      return;
    }

    // Aplicar rate limiting (excepto para teléfonos de prueba)
    if (!phone.startsWith('test-')) {
      const rateLimitResult = checkRateLimit(phone);
      if (!rateLimitResult.allowed) {
        res.status(429).json({ 
          success: false, 
          error: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter
        });
        return;
      }
    }

    // Normalizar mensaje entrante
    const normalizedMessage = normalizeIncomingText(message);

    if (!WhatsAppAI.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Servicio de IA no configurado. Configure DEEPSEEK_API_KEY en .env'
      });
      return;
    }

    const startTime = Date.now();
    const result = await runWithPhoneLock(phone, async () => {
      return await WhatsAppAI.processMessage(normalizedMessage, phone, []);
    });
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        response: result.response,
        toolCalls: result.toolCalls || [],
        responseTimeMs: responseTime,
        phone,
        normalizedInput: normalizedMessage !== message // indicar si se normalizó
      }
    });
  } catch (error: any) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando chat'
    });
  }
});

/**
 * POST /api/whatsapp/reset-conversation
 * Resetear conversación de un usuario
 */
router.post('/reset-conversation', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ success: false, error: 'Se requiere phone' });
      return;
    }

    const cleanPhone = String(phone).replace(/@.*/, '').trim();

    WhatsAppAI.resetConversation(cleanPhone);
    resetState(cleanPhone);
    await ChatMemoryService.resetSessionCompletely(cleanPhone);
    await resetConversationData(cleanPhone);

    res.json({
      success: true,
      message: `Conversación reseteada integralmente para ${cleanPhone}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error reseteando conversación'
    });
  }
});

/**
 * GET /api/whatsapp/ai-status
 * Estado del servicio de IA
 */
router.get('/ai-status', async (req: Request, res: Response) => {
  try {
    const stats = WhatsAppAI.getServiceStats();
    const mcpConnected = await MCPTools.testMCPConnection();

    res.json({
      success: true,
      data: {
        configured: WhatsAppAI.isConfigured(),
        ...stats,
        mcpServer: {
          connected: mcpConnected,
          url: process.env.MCP_SERVER_URL || 'http://127.0.0.1:8977'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado de IA'
    });
  }
});

/**
 * GET /api/whatsapp/metrics
 * Obtener métricas detalladas del sistema WhatsApp
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = getIntentMetrics();
    
    // Calcular estadísticas adicionales
    const intentStats = Object.entries(metrics.intents).map(([intent, data]) => ({
      intent,
      ...data,
      successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0
    }));
    
    // Ordenar por número de fallos (descendente)
    intentStats.sort((a, b) => b.failed - a.failed);
    
    res.json({
      success: true,
      data: {
        global: metrics.global,
        intents: intentStats,
        rateLimiting: {
          activeEntries: rateLimitMap.size,
          blockedNumbers: Array.from(rateLimitMap.entries())
            .filter(([_, e]) => e.blocked)
            .map(([phone, e]) => ({
              phone: phone.substring(0, 6) + '****', // Enmascarar número
              blockedUntil: e.blockedUntil ? new Date(e.blockedUntil).toISOString() : null,
              messageCount: e.count
            })),
          config: {
            windowMs: RATE_LIMIT_WINDOW_MS,
            maxRequests: RATE_LIMIT_MAX_REQUESTS,
            blockDurationMs: RATE_LIMIT_BLOCK_DURATION_MS
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo métricas'
    });
  }
});

/**
 * GET /api/whatsapp/mcp-tools
 * Listar herramientas MCP disponibles
 */
router.get('/mcp-tools', async (req: Request, res: Response) => {
  try {
    const result = await MCPTools.listMCPTools();

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(503).json({
        success: false,
        error: result.error || 'No se pudo conectar al servidor MCP'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error listando herramientas MCP'
    });
  }
});

/**
 * GET /api/whatsapp/mcp/status
 * Verificar estado del servidor MCP y listar herramientas
 */
router.get('/mcp/status', async (req: Request, res: Response) => {
  try {
    const result = await MCPTools.listMCPTools();
    
    if (result.success && result.data) {
      res.json({
        success: true,
        data: {
          connected: true,
          tools: result.data.tools?.map((t: any) => t.name) || [],
          lastCheck: new Date().toISOString()
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          connected: false,
          tools: [],
          lastCheck: new Date().toISOString(),
          error: result.error
        }
      });
    }
  } catch (error: any) {
    res.json({
      success: true,
      data: {
        connected: false,
        tools: [],
        lastCheck: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

/**
 * POST /api/whatsapp/chat/test
 * Endpoint para probar el chat de IA desde el dashboard
 */
router.post('/chat/test', async (req: Request, res: Response) => {
  try {
    const { message, history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'El mensaje es requerido'
      });
    }

    // Simular un número de teléfono de prueba
    const testPhoneNumber = 'test-dashboard-chat';
    
    // Convertir historial al formato esperado
    const messageHistory = history.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    // Procesar mensaje con el servicio de IA
    const startTime = Date.now();
    const result = await WhatsAppAI.processMessage(message, testPhoneNumber, messageHistory);
    const responseTime = Date.now() - startTime;

    if (result.success) {
      res.json({
        success: true,
        data: {
          response: result.response,
          toolCalls: result.toolCalls || [],
          responseTimeMs: responseTime
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Error procesando mensaje'
      });
    }
  } catch (error: any) {
    console.error('Error en chat/test:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
});

export default router;
