/**
 * WhatsApp Connection Service — Baileys v7 Refactored
 * 
 * @version 3.0.0
 * @description Refactorización completa para corregir recepción de mensajes:
 *   1. getMessage() callback requerido por Baileys v7 para reintentos y ACK
 *   2. Logging directo con console.log para visibilidad en PM2
 *   3. Debounce simplificado inline (sin módulo externo que pierda mensajes)
 *   4. Chunking de respuesta inline
 *   5. Health check mejorado
 *   6. Manejo robusto de errores en TODOS los catch
 *   7. Reconexión con backoff exponencial y jitter
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  isJidGroup,
  WAMessageKey
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import pino from 'pino';
import pool from '../db/pool';
import { ResultSetHeader } from 'mysql2';
import { normalizeIncomingText } from '../utils/whatsappUtils';
import { COLOMBIA_TIMEZONE } from '../utils/dateUtils';
import ResponseChunker from './WhatsAppResponseChunker';
import { messageDebouncer, IncomingMessage as DebouncerMessage } from './WhatsAppMessageDebouncer';

// ============================================================================
// LOGGING — console directo para que PM2 capture TODO sin pino-pretty
// ============================================================================

const LOG_PREFIX = '[WhatsApp]';

function logInfo(msg: string, data?: any): void {
  if (data !== undefined) {
    console.log(`${LOG_PREFIX} INFO: ${msg}`, typeof data === 'string' ? data : JSON.stringify(data));
  } else {
    console.log(`${LOG_PREFIX} INFO: ${msg}`);
  }
}

function logWarn(msg: string, data?: any): void {
  if (data !== undefined) {
    console.warn(`${LOG_PREFIX} WARN: ${msg}`, typeof data === 'string' ? data : JSON.stringify(data));
  } else {
    console.warn(`${LOG_PREFIX} WARN: ${msg}`);
  }
}

function logError(msg: string, data?: any): void {
  if (data !== undefined) {
    console.error(`${LOG_PREFIX} ERROR: ${msg}`, typeof data === 'string' ? data : JSON.stringify(data));
  } else {
    console.error(`${LOG_PREFIX} ERROR: ${msg}`);
  }
}

function logDebug(msg: string, data?: any): void {
  if (process.env.LOG_LEVEL === 'debug' || process.env.WHATSAPP_DEBUG === 'true') {
    if (data !== undefined) {
      console.log(`${LOG_PREFIX} DEBUG: ${msg}`, typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      console.log(`${LOG_PREFIX} DEBUG: ${msg}`);
    }
  }
}

// Logger silencioso para Baileys (evita ruido excesivo)
const baileysLogger = pino({ level: 'silent' });

// ============================================================================
// MÉTRICAS
// ============================================================================

interface WhatsAppMetrics {
  messagesReceived: number;
  messagesSent: number;
  messagesFailed: number;
  audioTranscriptions: number;
  audioTranscriptionsFailed: number;
  reconnectAttempts: number;
  connectionUptime: number;
  lastConnectedAt: Date | null;
  aiProcessingTimeTotal: number;
  aiProcessingCount: number;
}

const metrics: WhatsAppMetrics = {
  messagesReceived: 0,
  messagesSent: 0,
  messagesFailed: 0,
  audioTranscriptions: 0,
  audioTranscriptionsFailed: 0,
  reconnectAttempts: 0,
  connectionUptime: 0,
  lastConnectedAt: null,
  aiProcessingTimeTotal: 0,
  aiProcessingCount: 0
};

export function getWhatsAppMetrics(): WhatsAppMetrics & { avgAiProcessingTime: number } {
  return {
    ...metrics,
    connectionUptime: metrics.lastConnectedAt
      ? Math.floor((Date.now() - metrics.lastConnectedAt.getTime()) / 1000)
      : 0,
    avgAiProcessingTime: metrics.aiProcessingCount > 0
      ? metrics.aiProcessingTimeTotal / metrics.aiProcessingCount
      : 0
  };
}

export function renderWhatsAppPrometheusMetrics(): string {
  const m = getWhatsAppMetrics();
  return [
    '# HELP whatsapp_messages_received_total Total de mensajes recibidos',
    '# TYPE whatsapp_messages_received_total counter',
    `whatsapp_messages_received_total ${m.messagesReceived}`,
    '',
    '# HELP whatsapp_messages_sent_total Total de mensajes enviados',
    '# TYPE whatsapp_messages_sent_total counter',
    `whatsapp_messages_sent_total ${m.messagesSent}`,
    '',
    '# HELP whatsapp_messages_failed_total Total de mensajes fallidos',
    '# TYPE whatsapp_messages_failed_total counter',
    `whatsapp_messages_failed_total ${m.messagesFailed}`,
    '',
    '# HELP whatsapp_reconnect_attempts_total Intentos de reconexión',
    '# TYPE whatsapp_reconnect_attempts_total counter',
    `whatsapp_reconnect_attempts_total ${m.reconnectAttempts}`,
    '',
    '# HELP whatsapp_connection_uptime_seconds Tiempo conectado en segundos',
    '# TYPE whatsapp_connection_uptime_seconds gauge',
    `whatsapp_connection_uptime_seconds ${m.connectionUptime}`,
    '',
    '# HELP whatsapp_ai_processing_time_avg_ms Tiempo promedio IA en ms',
    '# TYPE whatsapp_ai_processing_time_avg_ms gauge',
    `whatsapp_ai_processing_time_avg_ms ${m.avgAiProcessingTime}`
  ].join('\n');
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const AUTH_FOLDER = '/home/ubuntu/app/backend/.whatsapp-auth';
const MAX_RECONNECT_ATTEMPTS = 15;
const BASE_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 300_000; // 5 min
const QUICK_QR_RECONNECT_DELAY_MS = 3000;
const HEALTH_CHECK_INTERVAL_MS = 60_000;

// ============================================================================
// EVENT EMITTER
// ============================================================================

export const whatsappEvents = new EventEmitter();
whatsappEvents.setMaxListeners(25);

// ============================================================================
// ESTADO DE CONEXIÓN
// ============================================================================

interface ConnectionState {
  socket: WASocket | null;
  qrCode: string | null;
  qrCodeImage: string | null;
  status: 'disconnected' | 'connecting' | 'qr_pending' | 'connected';
  phoneNumber: string | null;
  lastError: string | null;
  sessionId: string;
  reconnectAttempts: number;
  lastReconnectAt: number;
}

const conn: ConnectionState = {
  socket: null,
  qrCode: null,
  qrCodeImage: null,
  status: 'disconnected',
  phoneNumber: null,
  lastError: null,
  sessionId: `session_${Date.now()}`,
  reconnectAttempts: 0,
  lastReconnectAt: 0
};

// ============================================================================
// MESSAGE STORE — Requerido por Baileys v7 para getMessage callback
// ============================================================================

const messageStore = new Map<string, proto.IWebMessageInfo>();
const MESSAGE_STORE_MAX_SIZE = 5000;

function storeMessage(msg: proto.IWebMessageInfo): void {
  if (!msg.key?.remoteJid || !msg.key?.id) return;
  const key = `${msg.key.remoteJid}_${msg.key.id}`;
  messageStore.set(key, msg);

  // Limpieza LRU si excedemos el tamaño máximo
  if (messageStore.size > MESSAGE_STORE_MAX_SIZE) {
    const keys = Array.from(messageStore.keys());
    const toDelete = keys.slice(0, keys.length - MESSAGE_STORE_MAX_SIZE);
    for (const k of toDelete) messageStore.delete(k);
  }
}

function getMessageFromStore(key: WAMessageKey): proto.IMessage | undefined {
  const storeKey = `${key.remoteJid}_${key.id}`;
  const msg = messageStore.get(storeKey);
  return msg?.message || undefined;
}

// ============================================================================
// MUTEX POR TELÉFONO — Serializa procesamiento por usuario
// ============================================================================
// Evita race conditions cuando un usuario envía múltiples mensajes rápidos
// y el anterior aún está siendo procesado por la IA (10-30s).

const phoneLocks = new Map<string, Promise<void>>();

/**
 * Ejecuta `fn` de forma serializada por número de teléfono.
 * Si ya hay un procesamiento activo para ese phone, el nuevo se encola
 * y espera a que termine el anterior (FIFO).
 */
async function withPhoneLock(phone: string, fn: () => Promise<void>): Promise<void> {
  const existingLock = phoneLocks.get(phone);

  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  phoneLocks.set(phone, newLock);

  // Si había un lock previo, esperar a que termine
  if (existingLock) {
    logInfo(`⏳ Mensaje de ${phone} en cola, esperando procesamiento anterior...`);
    await existingLock;
  }

  try {
    await fn();
  } finally {
    // Liberar el lock
    releaseLock!();
    // Limpiar solo si somos el último en la cadena
    if (phoneLocks.get(phone) === newLock) {
      phoneLocks.delete(phone);
    }
  }
}

// ============================================================================
// DEBOUNCE — Delegado a WhatsAppMessageDebouncer
// ============================================================================
// La implementación inline anterior fue reemplazada por el servicio dedicado
// WhatsAppMessageDebouncer que incluye detección inteligente de flush,
// estadisticas, y soporte para audio.

// Tipo alias para compatibilidad interna
type PendingMessage = DebouncerMessage;

// ============================================================================
// CHUNKING DE RESPUESTA — delegado a WhatsAppResponseChunker
// ============================================================================

function chunkResponse(text: string): string[] {
  const result = ResponseChunker.chunkResponse(text, { mode: 'smart' });
  return result.chunks;
}

// ============================================================================
// UTILIDADES
// ============================================================================

function calculateReconnectDelay(attempt: number): number {
  const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
  return delay + Math.random() * 1000; // jitter
}

function phoneToJid(phone: string): string {
  let jid = phone;
  if (!jid.includes('@')) {
    jid = jid.replace(/\D/g, '');
    jid = `${jid}@s.whatsapp.net`;
  }
  return jid;
}

/**
 * Extrae el contenido de texto de un mensaje de WhatsApp.
 * Centraliza la lógica que antes estaba duplicada en messages.upsert y handleIncomingMessage.
 */
function extractMessageContent(mc: proto.IMessage | null | undefined): {
  body: string;
  isAudio: boolean;
  isUnsupportedMedia: boolean;
} {
  if (!mc) return { body: '', isAudio: false, isUnsupportedMedia: false };

  if (mc.conversation) {
    return { body: mc.conversation, isAudio: false, isUnsupportedMedia: false };
  }
  if (mc.extendedTextMessage?.text) {
    return { body: mc.extendedTextMessage.text, isAudio: false, isUnsupportedMedia: false };
  }
  if (mc.imageMessage?.caption) {
    return { body: mc.imageMessage.caption, isAudio: false, isUnsupportedMedia: false };
  }
  if (mc.videoMessage?.caption) {
    return { body: mc.videoMessage.caption, isAudio: false, isUnsupportedMedia: false };
  }
  if (mc.buttonsResponseMessage?.selectedButtonId) {
    return {
      body: mc.buttonsResponseMessage.selectedDisplayText || mc.buttonsResponseMessage.selectedButtonId,
      isAudio: false,
      isUnsupportedMedia: false
    };
  }
  if (mc.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return {
      body: mc.listResponseMessage.title || mc.listResponseMessage.singleSelectReply.selectedRowId,
      isAudio: false,
      isUnsupportedMedia: false
    };
  }
  if (mc.templateButtonReplyMessage?.selectedId) {
    return {
      body: mc.templateButtonReplyMessage.selectedDisplayText || mc.templateButtonReplyMessage.selectedId,
      isAudio: false,
      isUnsupportedMedia: false
    };
  }
  if (mc.audioMessage) {
    return { body: '', isAudio: true, isUnsupportedMedia: false };
  }
  if (mc.documentMessage || mc.stickerMessage || mc.contactMessage || mc.locationMessage) {
    return { body: '', isAudio: false, isUnsupportedMedia: true };
  }

  return { body: '', isAudio: false, isUnsupportedMedia: false };
}

// ============================================================================
// BD — Guardar sesión
// ============================================================================

async function updateSessionInDB(): Promise<void> {
  try {
    await pool.execute(`
      INSERT INTO wa_sessions (session_id, phone_number, status, qr_code, last_activity)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        phone_number = VALUES(phone_number),
        status = VALUES(status),
        qr_code = VALUES(qr_code),
        last_activity = NOW(),
        updated_at = NOW()
    `, [conn.sessionId, conn.phoneNumber, conn.status, conn.qrCode]);
  } catch (error: any) {
    logError('Error updating session in DB', error?.message);
  }
}

// ============================================================================
// BD — Guardar mensaje
// ============================================================================

async function saveMessageToDB(data: {
  messageId: string;
  from: string;
  to?: string;
  body: string;
  direction: 'inbound' | 'outbound';
  profileName?: string;
  aiResponse?: string;
}): Promise<void> {
  try {
    await pool.execute<ResultSetHeader>(`
      INSERT INTO wa_messages
      (session_id, message_id, from_number, to_number, body, direction, status, ai_response)
      VALUES (?, ?, ?, ?, ?, ?, 'delivered', ?)
      ON DUPLICATE KEY UPDATE updated_at = NOW()
    `, [
      conn.sessionId,
      data.messageId,
      data.from,
      data.to || null,
      data.body,
      data.direction,
      data.aiResponse || null
    ]);

    // Actualizar conversación
    const phone = data.direction === 'inbound' ? data.from : data.to;
    if (phone) {
      await pool.execute(`
        INSERT INTO wa_conversations (session_id, phone_number, last_message, last_activity, status)
        VALUES (?, ?, ?, NOW(), 'active')
        ON DUPLICATE KEY UPDATE
          last_message = VALUES(last_message),
          last_activity = NOW(),
          status = 'active'
      `, [conn.sessionId, phone, data.body.substring(0, 500)]);
    }
  } catch (error: any) {
    logError('Error saving message to DB', error?.message);
  }
}

// ============================================================================
// CONEXIÓN PRINCIPAL
// ============================================================================

export async function startConnection(): Promise<{ success: boolean; message: string; qrCode?: string }> {
  try {
    logInfo(`=== startConnection() called (current status: ${conn.status}) ===`);

    // Si ya está conectado, no hacer nada
    if (conn.status === 'connected' && conn.socket) {
      logInfo('Already connected to WhatsApp');
      return { success: true, message: 'Ya conectado a WhatsApp' };
    }

    // Si está en proceso, retornar estado actual
    if (conn.status === 'connecting' || conn.status === 'qr_pending') {
      return {
        success: true,
        message: conn.status === 'qr_pending' ? 'Esperando escaneo de QR' : 'Conexión en progreso',
        qrCode: conn.qrCodeImage || undefined
      };
    }

    conn.reconnectAttempts = 0;
    conn.status = 'connecting';
    conn.lastError = null;
    conn.sessionId = `session_${Date.now()}`;

    // Asegurar que el directorio de autenticación exista
    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
      logInfo(`Created auth folder: ${AUTH_FOLDER}`);
    }

    await updateSessionInDB();

    // Iniciar conexión en background (no bloquear)
    connectToWhatsApp().catch(err => {
      logError('Error in background connectToWhatsApp', err?.message || err);
      conn.status = 'disconnected';
      conn.lastError = err?.message || 'Error desconocido al conectar';
    });

    // Dar tiempo al QR para generarse
    await new Promise(resolve => setTimeout(resolve, 3000));

    return {
      success: true,
      message: conn.status === 'qr_pending' ? 'QR generado, escanee con WhatsApp' : 'Iniciando conexión...',
      qrCode: conn.qrCodeImage || undefined
    };
  } catch (error: any) {
    logError('Error in startConnection', error?.message);
    conn.status = 'disconnected';
    conn.lastError = error?.message;
    await updateSessionInDB();
    return { success: false, message: error?.message || 'Error desconocido' };
  }
}

export async function forceRestartWithCleanSession(): Promise<{ success: boolean; message: string; qrCode?: string }> {
  try {
    logWarn('Force restart requested: cleaning auth session and regenerating QR');

    if (conn.socket) {
      try {
        await disconnect();
      } catch (disconnectErr: any) {
        logWarn('Force restart: disconnect failed (continuing)', disconnectErr?.message);
      }
    }

    await clearCredentials();

    conn.socket = null;
    conn.status = 'disconnected';
    conn.qrCode = null;
    conn.qrCodeImage = null;
    conn.phoneNumber = null;
    conn.lastError = null;
    conn.reconnectAttempts = 0;
    conn.lastReconnectAt = 0;
    conn.sessionId = `session_${Date.now()}`;

    await updateSessionInDB();

    return await startConnection();
  } catch (error: any) {
    logError('Error in forceRestartWithCleanSession', error?.message);
    conn.status = 'disconnected';
    conn.lastError = error?.message || 'Error forzando reinicio limpio';
    await updateSessionInDB();
    return { success: false, message: conn.lastError };
  }
}

/**
 * Conexión real a WhatsApp usando Baileys v7.
 * Esta función configura el socket, registra TODOS los event handlers
 * y maneja reconexiones.
 */
async function connectToWhatsApp(): Promise<void> {
  try {
    logInfo('Connecting to WhatsApp via Baileys v7...');

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();
    logInfo(`Baileys version: ${version.join('.')}, Auth folder: ${AUTH_FOLDER}`);

    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
      },
      printQRInTerminal: true,
      logger: baileysLogger,
      browser: ['Biosanar IPS', 'Chrome', '120.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,

      // *** CRÍTICO: getMessage callback requerido por Baileys v7 ***
      // Sin esto, Baileys no puede re-enviar mensajes fallidos ni confirmar
      // recepción de mensajes, lo que puede resultar en pérdida silenciosa.
      getMessage: async (key: WAMessageKey) => {
        logDebug('getMessage callback invoked', { remoteJid: key.remoteJid, id: key.id });
        const msg = getMessageFromStore(key);
        if (msg) return msg;
        // Fallback: retornar mensaje vacío (no undefined) para evitar errores en Baileys
        return { conversation: '' };
      }
    });

    conn.socket = socket;
    logInfo('WASocket created, registering event handlers...');

    // =======================================================================
    // EVENT: connection.update
    // =======================================================================
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      logInfo('connection.update', {
        connection: connection || 'N/A',
        hasQr: !!qr,
        hasLastDisconnect: !!lastDisconnect
      });

      // --- QR Code ---
      if (qr) {
        logInfo('New QR code generated — scan with WhatsApp to connect');
        conn.qrCode = qr;
        conn.status = 'qr_pending';

        try {
          const qrImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          conn.qrCodeImage = qrImage;
          whatsappEvents.emit('qr', { qr, qrImage });
          await updateSessionInDB();
        } catch (qrErr: any) {
          logError('Error generating QR image', qrErr?.message);
        }
      }

      // --- Connected ---
      if (connection === 'open') {
        logInfo('*** WhatsApp CONNECTED successfully! ***');
        conn.status = 'connected';
        conn.qrCode = null;
        conn.qrCodeImage = null;
        conn.reconnectAttempts = 0;
        metrics.lastConnectedAt = new Date();

        if (socket.user?.id) {
          conn.phoneNumber = socket.user.id.split(':')[0].replace('@s.whatsapp.net', '');
          logInfo(`Connected phone: ${conn.phoneNumber}`);
        }

        whatsappEvents.emit('connected', { phoneNumber: conn.phoneNumber });
        await updateSessionInDB();
      }

      // --- Disconnected ---
      if (connection === 'close') {
        const wasAwaitingQr = conn.status === 'qr_pending' || (conn.status === 'connecting' && !conn.phoneNumber);
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logWarn(`Connection CLOSED (statusCode: ${statusCode}, shouldReconnect: ${shouldReconnect})`);

        // Limpiar socket
        conn.socket = null;

        if (statusCode === DisconnectReason.loggedOut) {
          logInfo('Session logged out — clearing credentials');
          await clearCredentials();
          conn.status = 'disconnected';
          conn.phoneNumber = null;
          whatsappEvents.emit('logout');
          await updateSessionInDB();
          return;
        }

        if (shouldReconnect && conn.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const fastQrRetry = statusCode === 408 && wasAwaitingQr;

          if (!fastQrRetry) {
            conn.reconnectAttempts++;
            metrics.reconnectAttempts++;
          }

          conn.status = 'connecting';
          conn.lastReconnectAt = Date.now();

          const delay = fastQrRetry
            ? QUICK_QR_RECONNECT_DELAY_MS
            : calculateReconnectDelay(conn.reconnectAttempts);

          logInfo(
            fastQrRetry
              ? `Scheduling fast QR reconnect in ${Math.round(delay / 1000)}s (statusCode=408)`
              : `Scheduling reconnect ${conn.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${Math.round(delay / 1000)}s`
          );

          setTimeout(() => {
            connectToWhatsApp().catch(err => {
              logError('Error during scheduled reconnection', err?.message || err);
            });
          }, delay);
        } else {
          conn.status = 'disconnected';
          conn.lastError = `Reconnect limit reached (${MAX_RECONNECT_ATTEMPTS}) or loggedOut`;
          logError(`Cannot reconnect: ${conn.lastError}`);
          await notifyAdminConnectionFailure(conn.lastError);
        }

        await updateSessionInDB();
      }
    });

    // =======================================================================
    // EVENT: creds.update — guardar credenciales
    // =======================================================================
    socket.ev.on('creds.update', saveCreds);

    // =======================================================================
    // EVENT: messages.upsert — RECEPCIÓN DE MENSAJES (PARTE MÁS CRÍTICA)
    // =======================================================================
    socket.ev.on('messages.upsert', async (upsert) => {
      const { messages: msgs, type } = upsert;

      logInfo(`>>> messages.upsert: type=${type}, count=${msgs.length}`);

      // IMPORTANTE: Solo procesar 'notify' (mensajes nuevos en tiempo real)
      // No procesar 'append' (history sync) para evitar reprocesar mensajes antiguos
      if (type !== 'notify') {
        logDebug(`Skipping messages.upsert type="${type}" (not notify)`);
        return;
      }

      for (const msg of msgs) {
        try {
          // Guardar SIEMPRE en store (para getMessage callback)
          storeMessage(msg);

          // Ignorar mensajes propios
          if (msg.key.fromMe) {
            logDebug(`Skipping own message: ${msg.key.id}`);
            continue;
          }

          // Ignorar sin contenido
          if (!msg.message) {
            logDebug(`Skipping message without content: ${msg.key.id}`);
            continue;
          }

          // Ignorar grupos
          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || isJidGroup(remoteJid)) {
            logDebug(`Skipping group/null jid: ${remoteJid}`);
            continue;
          }

          // Ignorar protocolo / reacciones / encuestas
          if (msg.message.protocolMessage || msg.message.reactionMessage || msg.message.pollCreationMessage) {
            logDebug('Skipping protocol/reaction/poll message');
            continue;
          }

          const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
          const pushName = msg.pushName || 'Usuario';
          // --- Extraer texto usando función centralizada ---
          const extracted = extractMessageContent(msg.message);

          if (extracted.isAudio) {
            logInfo(`Audio message received from ${phoneNumber} (${pushName})`);
            // Audio: procesar directamente sin debounce
            await handleIncomingMessage(msg, socket);
            continue;
          }

          if (extracted.isUnsupportedMedia) {
            logDebug(`Unsupported media type from ${phoneNumber}, skipping`);
            continue;
          }

          let body = extracted.body;
          if (!body.trim()) {
            logDebug(`Empty body from ${phoneNumber} after extraction, skipping`);
            continue;
          }

          // Normalizar
          body = normalizeIncomingText(body);

          logInfo(`Message from ${phoneNumber} (${pushName}): "${body.substring(0, 100)}${body.length > 100 ? '...' : ''}"`);

          // Agregar al debounce (usando MessageDebouncer singleton)
          messageDebouncer.addMessage(
            {
              phone: phoneNumber,
              text: body,
              messageId: msg.key.id || `msg_${Date.now()}`,
              profileName: pushName,
              timestamp: Date.now()
            },
            async (messages: DebouncerMessage[]) => {
              await handleDebouncedMessages(messages, socket);
            }
          );

        } catch (msgErr: any) {
          logError(`Error processing message ${msg?.key?.id} from ${msg?.key?.remoteJid}`, msgErr?.message);
          logError(`Stack trace:`, msgErr?.stack);
        }
      }
    });

    // =======================================================================
    // EVENT: messages.update — status updates (read receipts, etc.)
    // =======================================================================
    socket.ev.on('messages.update', (updates) => {
      for (const update of updates) {
        logDebug(`Message status update: ${update.key.id} -> ${update.update?.status}`);
      }
    });

    logInfo('All Baileys event handlers registered successfully');

  } catch (error: any) {
    logError('FATAL: Error in connectToWhatsApp', error?.message);
    logError('Stack:', error?.stack);
    throw error;
  }
}

// ============================================================================
// PROCESAR MENSAJES DEBOUNCED (agrupados)
// ============================================================================

async function handleDebouncedMessages(messages: PendingMessage[], socket: WASocket): Promise<void> {
  if (messages.length === 0) return;

  const phone = messages[0].phone;

  // Serializar procesamiento por teléfono para evitar race conditions
  await withPhoneLock(phone, async () => {
    const profileName = messages[0].profileName;
    const combinedText = messages.map(m => m.text).join('\n');

    logInfo(`Processing ${messages.length} debounced msg(s) from ${phone}: "${combinedText.substring(0, 120)}"`);

    // Construir mensaje sintético
    const syntheticMsg: proto.IWebMessageInfo = {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        id: messages[messages.length - 1].messageId
      },
      pushName: profileName,
      message: {
        conversation: combinedText
      }
    } as proto.IWebMessageInfo;

    await handleIncomingMessage(syntheticMsg, socket);
  }); // fin withPhoneLock
}

// ============================================================================
// HANDLER PRINCIPAL DE MENSAJES ENTRANTES
// ============================================================================

async function handleIncomingMessage(msg: proto.IWebMessageInfo, socket: WASocket): Promise<void> {
  const startTime = Date.now();
  const from = msg.key?.remoteJid;
  if (!from) return;

  metrics.messagesReceived++;

  const phoneNumber = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
  const pushName = msg.pushName || 'Usuario';
  const messageId = msg.key?.id || `msg_${Date.now()}`;

  try {
    let body = '';
    let isAudioMessage = false;
    let audioTranscription = '';

    // Extraer contenido usando función centralizada
    const extracted = extractMessageContent(msg.message);
    body = extracted.body;
    isAudioMessage = extracted.isAudio;

    if (isAudioMessage && msg.message?.audioMessage) {
      logInfo(`Transcribing audio from ${phoneNumber}...`);

      const result = await transcribeAudioSafe(msg, msg.message.audioMessage, socket);
      if (result.success && result.text) {
        audioTranscription = result.text;
        body = audioTranscription;
        metrics.audioTranscriptions++;
        logInfo(`Audio transcribed: "${body.substring(0, 100)}"`);
      } else {
        metrics.audioTranscriptionsFailed++;
        logWarn(`Audio transcription failed for ${phoneNumber}: ${result.error}`);
        body = result.fallbackText || '[Audio no procesable]';
      }
    }

    if (!body.trim()) {
      logDebug(`No processable content from ${phoneNumber}`);
      return;
    }

    body = normalizeIncomingText(body);

    logInfo(`Processing for ${phoneNumber}: audio=${isAudioMessage}, text="${body.substring(0, 100)}"`);

    // Guardar mensaje entrante en BD
    const bodyToSave = isAudioMessage && audioTranscription ? `🎤 ${body}` : body;
    await saveMessageToDB({
      messageId,
      from: phoneNumber,
      body: bodyToSave,
      direction: 'inbound',
      profileName: pushName
    });

    // Emitir evento para listeners externos
    whatsappEvents.emit('message', {
      from: phoneNumber,
      body,
      messageId,
      profileName: pushName,
      isAudio: isAudioMessage
    });

    // ---- Procesar con IA si auto-reply está habilitado ----
    const autoReply = process.env.WHATSAPP_AUTO_REPLY === 'true';
    if (!autoReply) {
      logInfo(`Auto-reply DISABLED, message stored but not responded to`);
      return;
    }

    // Verificar horario de atención si está configurado
    if (process.env.WHATSAPP_BUSINESS_HOURS_ONLY === 'true') {
      // Usar hora Colombia (UTC-5) en lugar de UTC del servidor
      const colombiaNow = new Date(new Date().toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE }));
      const hour = colombiaNow.getHours();
      const day = colombiaNow.getDay(); // 0=domingo
      // Horario: L-V 7am-7pm, S 8am-1pm
      const isBusinessHours =
        (day >= 1 && day <= 5 && hour >= 7 && hour < 19) ||
        (day === 6 && hour >= 8 && hour < 13);

      if (!isBusinessHours) {
        logInfo(`Outside business hours, sending auto-reply to ${phoneNumber}`);
        await sendMessage(phoneNumber, 'Gracias por comunicarse con Fundación Biosanar IPS. En este momento estamos fuera de nuestro horario de atención. Nuestro horario es de lunes a viernes de 7am a 7pm y sábados de 8am a 1pm. Le responderemos lo más pronto posible.');
        return;
      }
    }

    const shouldRespondWithVoice = isAudioMessage && process.env.WHATSAPP_VOICE_RESPONSES === 'true';
    const useGPTAudioIntegrated = shouldRespondWithVoice && process.env.USE_GPT_AUDIO_MODEL === 'true';

    if (useGPTAudioIntegrated) {
      await handleGPTAudioFlow(phoneNumber, body);
    } else {
      await handleStandardAIFlow(body, phoneNumber, shouldRespondWithVoice);
    }

    const totalMs = Date.now() - startTime;
    logInfo(`Message processed for ${phoneNumber} in ${totalMs}ms`);

  } catch (error: any) {
    logError(`CRITICAL error handling message from ${phoneNumber}: ${error?.message}`);
    logError(`Stack: ${error?.stack}`);
    metrics.messagesFailed++;

    // Intentar enviar mensaje de disculpa
    try {
      await sendMessage(phoneNumber, 'Disculpa, tuve un problema procesando tu mensaje. Por favor intenta de nuevo.');
    } catch (sendErr: any) {
      logError(`Failed to send error fallback to ${phoneNumber}: ${sendErr?.message}`);
    }
  }
}

// ============================================================================
// FLUJO IA ESTÁNDAR (Groq / ChatGPT)
// ============================================================================

async function handleStandardAIFlow(body: string, phoneNumber: string, respondWithVoice: boolean): Promise<void> {
  logInfo(`AI flow started for ${phoneNumber}...`);

  const aiStartTime = Date.now();

  // Import dinámico para evitar dependencias circulares
  const WhatsAppAI = await import('./WhatsAppAIService');

  const result = await WhatsAppAI.processMessage(body, phoneNumber, []);

  const aiDuration = Date.now() - aiStartTime;
  metrics.aiProcessingTimeTotal += aiDuration;
  metrics.aiProcessingCount++;

  logInfo(`AI processed in ${aiDuration}ms, success=${result.success}, hasResponse=${!!result.response}, tools=${result.toolCalls?.length || 0}`);

  // Respuesta silenciosa (e.g., el AI decidió no responder)
  if (result.success && (result as any).silent) {
    logInfo(`Silent response for ${phoneNumber}`);
    return;
  }

  if (!result.success || !result.response) {
    logWarn(`AI returned no response for ${phoneNumber}`, { success: result.success, error: (result as any).error });
    return;
  }

  // Enviar respuesta
  if (respondWithVoice) {
    logInfo(`Sending voice response to ${phoneNumber}`);
    await sendVoiceNote(phoneNumber, result.response, false);
    await saveMessageToDB({
      messageId: `resp_voice_${Date.now()}`,
      from: conn.phoneNumber || 'bot',
      to: phoneNumber,
      body: `🔊 ${result.response}`,
      direction: 'outbound',
      aiResponse: result.response
    });
  } else {
    const chunks = chunkResponse(result.response);
    logDebug(`Sending ${chunks.length} chunk(s) to ${phoneNumber}`);

    for (let i = 0; i < chunks.length; i++) {
      const sendResult = await sendMessage(phoneNumber, chunks[i]);
      logDebug(`Chunk ${i + 1}/${chunks.length} sent: ${sendResult.success}`);
      // Pausa entre chunks para no saturar
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    await saveMessageToDB({
      messageId: `resp_${Date.now()}`,
      from: conn.phoneNumber || 'bot',
      to: phoneNumber,
      body: result.response,
      direction: 'outbound',
      aiResponse: result.response
    });
  }

  logInfo(`Response sent to ${phoneNumber}: "${result.response.substring(0, 80)}..." (${aiDuration}ms)`);
}

// ============================================================================
// FLUJO GPT AUDIO (respuesta de voz integrada)
// ============================================================================

async function handleGPTAudioFlow(phoneNumber: string, body: string): Promise<void> {
  logInfo(`GPT Audio flow started for ${phoneNumber}`);

  const aiStartTime = Date.now();

  try {
    const audioResult = await processAndRespondWithAudio(phoneNumber, body);
    const aiDuration = Date.now() - aiStartTime;
    metrics.aiProcessingTimeTotal += aiDuration;
    metrics.aiProcessingCount++;

    if (audioResult.success && audioResult.response) {
      await saveMessageToDB({
        messageId: audioResult.messageId || `resp_gptaudio_${Date.now()}`,
        from: conn.phoneNumber || 'bot',
        to: phoneNumber,
        body: `🔊 ${audioResult.response}`,
        direction: 'outbound',
        aiResponse: audioResult.response
      });
      logInfo(`GPT Audio response sent to ${phoneNumber} in ${aiDuration}ms`);
    } else {
      logWarn(`GPT Audio failed: ${audioResult.error}, falling back to standard flow`);
      await handleStandardAIFlow(body, phoneNumber, false);
    }
  } catch (err: any) {
    logError(`GPT Audio flow error: ${err?.message}`);
    await handleStandardAIFlow(body, phoneNumber, false);
  }
}

// ============================================================================
// TRANSCRIPCIÓN DE AUDIO (con retry)
// ============================================================================

async function transcribeAudioSafe(
  msg: proto.IWebMessageInfo,
  audioMessage: proto.Message.IAudioMessage,
  socket: WASocket,
  maxRetries: number = 2
): Promise<{ success: boolean; text?: string; error?: string; fallbackText?: string }> {
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const downloadable = { ...msg, key: msg.key } as Parameters<typeof downloadMediaMessage>[0];
      const audioBuffer = await downloadMediaMessage(downloadable, 'buffer', {}, {
        logger: baileysLogger,
        reuploadRequest: socket.updateMediaMessage
      }) as Buffer;

      if (!audioBuffer || audioBuffer.length === 0) {
        lastError = 'Audio buffer vacío';
        continue;
      }

      logDebug(`Audio downloaded: ${audioBuffer.length} bytes (attempt ${attempt})`);

      const { transcribeAudio } = await import('./AudioTranscriptionService');
      const mimeType = audioMessage.mimetype || 'audio/ogg; codecs=opus';
      const result = await transcribeAudio(audioBuffer, mimeType);

      if (result.success && result.text) {
        return { success: true, text: result.text };
      }

      lastError = result.error || 'Transcripción fallida';
    } catch (err: any) {
      lastError = err?.message || 'Error desconocido';
      logWarn(`Audio transcription attempt ${attempt} failed: ${lastError}`);
    }

    // Esperar antes de reintentar
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return {
    success: false,
    error: lastError,
    fallbackText: '🎤 Recibí tu mensaje de voz pero no pude procesarlo. ¿Podrías escribirme tu consulta?'
  };
}

// ============================================================================
// ENVIAR MENSAJE DE TEXTO
// ============================================================================

export async function sendMessage(
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!conn.socket || conn.status !== 'connected') {
      logWarn(`Cannot send to ${to} — not connected (status: ${conn.status})`);
      return { success: false, error: 'WhatsApp no conectado' };
    }

    const jid = phoneToJid(to);
    logDebug(`Sending text to ${jid}: "${text.substring(0, 60)}..."`);

    const result = await conn.socket.sendMessage(jid, { text });
    metrics.messagesSent++;

    logDebug(`Message sent to ${to}, id=${result?.key?.id}`);
    return { success: true, messageId: result?.key?.id || `sent_${Date.now()}` };
  } catch (error: any) {
    logError(`Error sending message to ${to}: ${error?.message}`);
    metrics.messagesFailed++;
    return { success: false, error: error?.message };
  }
}

// ============================================================================
// ENVIAR NOTA DE VOZ
// ============================================================================

export async function sendVoiceNote(
  to: string,
  text: string,
  useGPTAudio: boolean = false
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!conn.socket || conn.status !== 'connected') {
      logWarn(`Cannot send voice note to ${to} — not connected`);
      return { success: false, error: 'WhatsApp no conectado' };
    }

    let audioBuffer: Buffer | undefined;
    const ttsProvider = process.env.TTS_PROVIDER || 'openai';

    // Intentar generar audio con el proveedor configurado
    try {
      if (ttsProvider === 'elevenlabs') {
        const ElevenLabsTTS = await import('./ElevenLabsTTSService');
        const result = await ElevenLabsTTS.generateWhatsAppVoiceNoteElevenLabs(text);
        if (result.success && result.audioBuffer) audioBuffer = result.audioBuffer;
      } else if ((ttsProvider === 'gpt-audio' || useGPTAudio) && process.env.USE_GPT_AUDIO_MODEL === 'true') {
        const GPTAudioService = await import('./GPTAudioService');
        const result = await GPTAudioService.generateWhatsAppAudio(text, true);
        if (result.success && result.audioBuffer) audioBuffer = result.audioBuffer;
      }
    } catch (ttsErr: any) {
      logWarn(`TTS provider "${ttsProvider}" failed: ${ttsErr?.message}`);
    }

    // Fallback a OpenAI TTS estándar
    if (!audioBuffer) {
      try {
        const { generateWhatsAppVoiceNote } = await import('./TextToSpeechService');
        const ttsResult = await generateWhatsAppVoiceNote(text);
        if (ttsResult.success && ttsResult.audioBuffer) {
          audioBuffer = ttsResult.audioBuffer;
        }
      } catch (fallbackErr: any) {
        logWarn(`Fallback TTS failed: ${fallbackErr?.message}`);
      }
    }

    // Si no se pudo generar audio, fallback a texto
    if (!audioBuffer) {
      logWarn(`All TTS providers failed, falling back to text for ${to}`);
      return sendMessage(to, text);
    }

    const jid = phoneToJid(to);
    const result = await conn.socket.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    });

    metrics.messagesSent++;
    logInfo(`Voice note sent to ${to}`);
    return { success: true, messageId: result?.key?.id || `voice_${Date.now()}` };
  } catch (error: any) {
    logError(`Error sending voice note to ${to}: ${error?.message}`);
    metrics.messagesFailed++;
    // Fallback a texto
    return sendMessage(to, text);
  }
}

// ============================================================================
// PROCESAR Y RESPONDER CON AUDIO (GPT Audio)
// ============================================================================

export async function processAndRespondWithAudio(
  to: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  systemPrompt?: string
): Promise<{ success: boolean; messageId?: string; response?: string; error?: string }> {
  try {
    if (!conn.socket || conn.status !== 'connected') {
      return { success: false, error: 'WhatsApp no conectado' };
    }

    const GPTAudioService = await import('./GPTAudioService');

    const result = await GPTAudioService.generateChatWithAudio(userMessage, conversationHistory, {
      voice: 'nova',
      format: 'mp3',
      saveToFile: false,
      systemPrompt
    });

    if (!result.success || !result.audioBuffer) {
      return { success: false, error: result.error || 'No se generó audio' };
    }

    const jid = phoneToJid(to);
    const sendResult = await conn.socket.sendMessage(jid, {
      audio: result.audioBuffer,
      mimetype: 'audio/mpeg',
      ptt: true
    });

    metrics.messagesSent++;

    return {
      success: true,
      messageId: sendResult?.key?.id || `gpt_audio_${Date.now()}`,
      response: result.text
    };
  } catch (error: any) {
    logError(`Error in processAndRespondWithAudio for ${to}: ${error?.message}`);
    metrics.messagesFailed++;
    return { success: false, error: error?.message };
  }
}

// ============================================================================
// ENVIAR RESPUESTA (selecciona text/voice automáticamente)
// ============================================================================

export async function sendResponse(
  to: string,
  text: string,
  asVoice: boolean = false
): Promise<{ success: boolean; messageId?: string; error?: string; type: 'text' | 'voice' }> {
  if (asVoice && process.env.WHATSAPP_VOICE_RESPONSES === 'true') {
    const result = await sendVoiceNote(to, text);
    return { ...result, type: 'voice' };
  }
  const result = await sendMessage(to, text);
  return { ...result, type: 'text' };
}

// ============================================================================
// DESCONECTAR
// ============================================================================

export async function disconnect(): Promise<{ success: boolean; message: string }> {
  try {
    logInfo('Disconnecting from WhatsApp...');

    if (conn.socket) {
      try {
        await conn.socket.logout();
      } catch (logoutErr: any) {
        logWarn(`Logout error (non-fatal): ${logoutErr?.message}`);
        // Intentar cerrar de otra manera
        try {
          conn.socket.end(undefined);
        } catch (_) { /* ignore */ }
      }
      conn.socket = null;
    }

    conn.status = 'disconnected';
    conn.qrCode = null;
    conn.qrCodeImage = null;
    conn.phoneNumber = null;
    conn.lastError = null;

    await updateSessionInDB();

    logInfo('Successfully disconnected from WhatsApp');
    return { success: true, message: 'Desconectado de WhatsApp' };
  } catch (error: any) {
    logError(`Error disconnecting: ${error?.message}`);
    return { success: false, message: error?.message || 'Error al desconectar' };
  }
}

// ============================================================================
// OBTENER ESTADO
// ============================================================================

export function getStatus(): {
  connected: boolean;
  status: string;
  phoneNumber: string | null;
  qrCode: string | null;
  sessionId: string;
  lastError: string | null;
  reconnectAttempts: number;
  metrics: WhatsAppMetrics & { avgAiProcessingTime: number };
} {
  return {
    connected: conn.status === 'connected',
    status: conn.status,
    phoneNumber: conn.phoneNumber,
    qrCode: conn.qrCodeImage,
    sessionId: conn.sessionId,
    lastError: conn.lastError,
    reconnectAttempts: conn.reconnectAttempts,
    metrics: getWhatsAppMetrics()
  };
}

export function resetReconnectAttempts(): void {
  logInfo(`Resetting reconnect attempts (was ${conn.reconnectAttempts})`);
  conn.reconnectAttempts = 0;
  conn.lastError = null;
}

// ============================================================================
// CREDENCIALES
// ============================================================================

async function clearCredentials(): Promise<void> {
  try {
    if (fs.existsSync(AUTH_FOLDER)) {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    }
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    logInfo('Auth credentials cleared');
  } catch (error: any) {
    logError(`Error clearing credentials: ${error?.message}`);
  }
}

// ============================================================================
// NOTIFICAR ADMINISTRADOR
// ============================================================================

async function notifyAdminConnectionFailure(reason: string): Promise<void> {
  try {
    logError(`ADMIN ALERT: WhatsApp connection failure — ${reason}`);
    await pool.execute(`
      INSERT INTO wa_messages (session_id, message_id, from_number, to_number, body, direction, status, metadata)
      VALUES (?, ?, 'SYSTEM', 'ADMIN', ?, 'outbound', 'failed', ?)
    `, [
      conn.sessionId,
      `alert_${Date.now()}`,
      `⚠️ ALERTA: WhatsApp desconectado. Razón: ${reason}. Intentos: ${conn.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`,
      JSON.stringify({ type: 'connection_failure', reason, timestamp: new Date().toISOString() })
    ]);
    whatsappEvents.emit('admin_alert', { type: 'connection_failure', reason });
  } catch (error: any) {
    logError('Failed to store admin alert in DB', error?.message);
  }
}

// ============================================================================
// HEALTH CHECK PERIÓDICO
// ============================================================================

let healthCheckTimer: NodeJS.Timeout | null = null;

function startHealthCheck(): void {
  if (healthCheckTimer) clearInterval(healthCheckTimer);

  healthCheckTimer = setInterval(async () => {
    try {
      if (conn.status !== 'connected') {
        logDebug(`Health check: not connected (status=${conn.status})`);
        return;
      }

      if (!conn.socket) {
        logWarn('Health check: status=connected but socket=null! Triggering reconnect...');
        conn.status = 'disconnected';
        conn.reconnectAttempts = 0;
        await startConnection();
        return;
      }

      // Verificar que el socket tiene user info (indicador de sesión viva)
      const user = conn.socket.user;
      if (!user?.id) {
        logWarn('Health check: socket exists but user info is empty (zombie connection)');
        // No reconectar inmediatamente, puede ser temporal
      } else {
        logDebug(`Health check OK: connected as ${user.id.split(':')[0]}, uptime=${getWhatsAppMetrics().connectionUptime}s`);
      }
    } catch (err: any) {
      logError(`Health check error: ${err?.message}`);
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  logInfo(`Health check started (every ${HEALTH_CHECK_INTERVAL_MS / 1000}s)`);
}

// ============================================================================
// AUTO-INICIO al cargar el módulo
// ============================================================================

setTimeout(async () => {
  logInfo('=== WhatsApp Service STARTING ===');

  try {
    const credsPath = path.join(AUTH_FOLDER, 'creds.json');
    if (fs.existsSync(credsPath)) {
      logInfo('Saved credentials found, auto-connecting...');
      await startConnection();
    } else {
      logInfo('No saved credentials found. Scan QR code via /api/whatsapp/connect to start.');
    }
  } catch (err: any) {
    logError(`Auto-connect error: ${err?.message}`);
  }

  startHealthCheck();
}, 3000);

// ============================================================================
// DEFAULT EXPORT (singleton usado por las rutas)
// ============================================================================

export default {
  startConnection,
  forceRestartWithCleanSession,
  sendMessage,
  sendVoiceNote,
  sendResponse,
  processAndRespondWithAudio,
  disconnect,
  getStatus,
  resetReconnectAttempts,
  getWhatsAppMetrics,
  renderWhatsAppPrometheusMetrics,
  events: whatsappEvents
};
