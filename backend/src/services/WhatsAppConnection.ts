/**
 * WhatsApp Connection Service usando Baileys
 * Maneja la conexión real a WhatsApp Web con QR code
 * 
 * @version 2.2.0
 * @description Incluye mejoras:
 *   - Backoff exponencial para reconexiones
 *   - Notificaciones al admin cuando falla reconexión
 *   - Métricas Prometheus integradas
 *   - Logging estructurado con pino
 *   - Fallback mejorado para transcripción de audio
 *   - 🆕 Normalización de texto entrante (caracteres invisibles)
 *   - 🆕 Message debouncing (agrupa mensajes rápidos) - inspirado en moltbot
 *   - 🆕 Response chunking inteligente - inspirado en moltbot
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
  proto,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import pino from 'pino';
import pool from '../db/pool';
import { ResultSetHeader } from 'mysql2';

// 🆕 Importar servicios de debouncing y chunking
import { messageDebouncer, IncomingMessage } from './WhatsAppMessageDebouncer';
import { chunkResponse, needsChunking } from './WhatsAppResponseChunker';
import { normalizeIncomingText } from '../utils/whatsappUtils';

// normalizeIncomingText importada desde ../utils/whatsappUtils

// ============================================================================
// LOGGER ESTRUCTURADO
// ============================================================================

// Logger principal para WhatsApp (estructurado)
const waLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'whatsapp-connection',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined
});

// Logger silencioso para Baileys (interno)
const logger = pino({ level: 'silent' });

// ============================================================================
// MÉTRICAS PROMETHEUS
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

/**
 * Obtener métricas actuales para Prometheus
 */
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

/**
 * Renderizar métricas en formato Prometheus
 */
export function renderWhatsAppPrometheusMetrics(): string {
  const m = getWhatsAppMetrics();
  return `
# HELP whatsapp_messages_received_total Total de mensajes recibidos
# TYPE whatsapp_messages_received_total counter
whatsapp_messages_received_total ${m.messagesReceived}

# HELP whatsapp_messages_sent_total Total de mensajes enviados
# TYPE whatsapp_messages_sent_total counter
whatsapp_messages_sent_total ${m.messagesSent}

# HELP whatsapp_messages_failed_total Total de mensajes fallidos
# TYPE whatsapp_messages_failed_total counter
whatsapp_messages_failed_total ${m.messagesFailed}

# HELP whatsapp_audio_transcriptions_total Total de transcripciones de audio
# TYPE whatsapp_audio_transcriptions_total counter
whatsapp_audio_transcriptions_total ${m.audioTranscriptions}

# HELP whatsapp_audio_transcriptions_failed_total Transcripciones de audio fallidas
# TYPE whatsapp_audio_transcriptions_failed_total counter
whatsapp_audio_transcriptions_failed_total ${m.audioTranscriptionsFailed}

# HELP whatsapp_reconnect_attempts_total Intentos de reconexión
# TYPE whatsapp_reconnect_attempts_total counter
whatsapp_reconnect_attempts_total ${m.reconnectAttempts}

# HELP whatsapp_connection_uptime_seconds Tiempo conectado en segundos
# TYPE whatsapp_connection_uptime_seconds gauge
whatsapp_connection_uptime_seconds ${m.connectionUptime}

# HELP whatsapp_ai_processing_time_avg_ms Tiempo promedio de procesamiento IA
# TYPE whatsapp_ai_processing_time_avg_ms gauge
whatsapp_ai_processing_time_avg_ms ${m.avgAiProcessingTime}
`.trim();
}

// Directorio para almacenar credenciales - usar ruta absoluta para consistencia
const AUTH_FOLDER = '/home/ubuntu/app/backend/.whatsapp-auth';

// Eventos del sistema
export const whatsappEvents = new EventEmitter();

// Estado de la conexión
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

let connectionState: ConnectionState = {
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

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 300000; // 5 minutos máximo

/**
 * Calcular delay con backoff exponencial
 */
function calculateReconnectDelay(attempt: number): number {
  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
    MAX_RECONNECT_DELAY_MS
  );
  // Añadir jitter para evitar thundering herd
  const jitter = Math.random() * 1000;
  return delay + jitter;
}

/**
 * Notificar al admin sobre fallo de conexión
 */
async function notifyAdminConnectionFailure(reason: string): Promise<void> {
  try {
    waLogger.error({ reason, attempts: connectionState.reconnectAttempts }, 'WhatsApp connection failed - notifying admin');
    
    // Insertar notificación en BD para que el dashboard la muestre
    await pool.execute(`
      INSERT INTO wa_messages (session_id, message_id, from_number, to_number, body, direction, status, metadata)
      VALUES (?, ?, 'SYSTEM', 'ADMIN', ?, 'outbound', 'failed', ?)
    `, [
      connectionState.sessionId,
      `alert_${Date.now()}`,
      `⚠️ ALERTA: WhatsApp desconectado. Razón: ${reason}. Intentos: ${connectionState.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`,
      JSON.stringify({ type: 'connection_failure', reason, timestamp: new Date().toISOString() })
    ]);
    
    // Emitir evento para notificación en tiempo real
    whatsappEvents.emit('admin_alert', {
      type: 'connection_failure',
      reason,
      attempts: connectionState.reconnectAttempts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    waLogger.error({ error }, 'Failed to notify admin about connection failure');
  }
}

/**
 * Iniciar conexión a WhatsApp
 */
export async function startConnection(): Promise<{ success: boolean; message: string; qrCode?: string }> {
  try {
    waLogger.info({ currentStatus: connectionState.status }, 'Starting WhatsApp connection');
    
    // Si ya está conectado, retornar
    if (connectionState.status === 'connected' && connectionState.socket) {
      waLogger.info('Already connected to WhatsApp');
      return { success: true, message: 'Ya conectado a WhatsApp' };
    }

    // Si ya está conectando o esperando QR, retornar el estado actual
    if (connectionState.status === 'connecting' || connectionState.status === 'qr_pending') {
      waLogger.info({ status: connectionState.status }, 'Connection already in progress');
      return { 
        success: true, 
        message: connectionState.status === 'qr_pending' ? 'Esperando escaneo de QR' : 'Conexión en progreso',
        qrCode: connectionState.qrCodeImage || undefined
      };
    }

    // Resetear intentos de reconexión para conexión manual
    if (connectionState.reconnectAttempts > 0) {
      waLogger.info({ previousAttempts: connectionState.reconnectAttempts }, 'Resetting reconnect attempts for manual connection');
      connectionState.reconnectAttempts = 0;
    }

    // Crear directorio de auth si no existe
    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }

    connectionState.status = 'connecting';
    connectionState.lastError = null;
    connectionState.sessionId = `session_${Date.now()}`;

    // Actualizar estado en BD
    await updateSessionInDB();

    // Iniciar socket EN BACKGROUND (no bloquear)
    connectToWhatsApp().catch(err => {
      waLogger.error({ error: err.message }, 'Error starting background connection');
      connectionState.status = 'disconnected';
      connectionState.lastError = err.message;
    });

    // Esperar un poco para dar chance a que se genere el QR
    await new Promise(resolve => setTimeout(resolve, 2000));

    const currentStatus = connectionState.status as string;
    return { 
      success: true, 
      message: currentStatus === 'qr_pending' ? 'QR generado, esperando escaneo' : 'Iniciando conexión...',
      qrCode: connectionState.qrCodeImage || undefined
    };
  } catch (error: any) {
    waLogger.error({ error: error.message }, 'Error starting connection');
    connectionState.status = 'disconnected';
    connectionState.lastError = error.message;
    await updateSessionInDB();
    
    return { success: false, message: error.message };
  }
}

/**
 * Conectar a WhatsApp usando Baileys
 */
async function connectToWhatsApp(): Promise<void> {
  try {
    waLogger.info('Connecting to WhatsApp via Baileys');
    
    // Cargar estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Obtener última versión de Baileys
    const { version } = await fetchLatestBaileysVersion();
    waLogger.info({ version: version.join('.') }, 'Using Baileys version');

    // Crear socket
    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false, // Deprecated en Baileys recientes, usamos connection.update
      logger,
      browser: ['Biosanar IPS', 'Chrome', '120.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true
    });

    connectionState.socket = socket;

    // Manejar eventos de conexión
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Nuevo QR code
      if (qr) {
        waLogger.info('New QR code generated');
        connectionState.qrCode = qr;
        connectionState.status = 'qr_pending';
        
        // Generar imagen base64 del QR
        try {
          const qrImage = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          connectionState.qrCodeImage = qrImage;
          
          // Emitir evento de nuevo QR
          whatsappEvents.emit('qr', { qr, qrImage });
          
          await updateSessionInDB();
        } catch (qrError) {
          waLogger.error({ error: qrError }, 'Error generating QR image');
        }
      }

      // Conexión establecida
      if (connection === 'open') {
        waLogger.info('✅ WhatsApp connection established');
        connectionState.status = 'connected';
        connectionState.qrCode = null;
        connectionState.qrCodeImage = null;
        connectionState.reconnectAttempts = 0;
        metrics.lastConnectedAt = new Date();
        
        // Obtener número de teléfono
        const user = socket.user;
        if (user?.id) {
          connectionState.phoneNumber = user.id.split(':')[0].replace('@s.whatsapp.net', '');
        }
        
        whatsappEvents.emit('connected', { phoneNumber: connectionState.phoneNumber });
        await updateSessionInDB();
      }

      // Conexión cerrada
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        waLogger.warn({ statusCode, shouldReconnect }, 'WhatsApp connection closed');
        
        if (statusCode === DisconnectReason.loggedOut) {
          // Usuario cerró sesión, limpiar credenciales
          waLogger.info('Session logged out, clearing credentials');
          await clearCredentials();
          connectionState.status = 'disconnected';
          connectionState.phoneNumber = null;
          whatsappEvents.emit('logout');
        } else if (shouldReconnect && connectionState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          // Intentar reconectar con backoff exponencial
          connectionState.reconnectAttempts++;
          metrics.reconnectAttempts++;
          connectionState.status = 'connecting';
          
          const delay = calculateReconnectDelay(connectionState.reconnectAttempts);
          waLogger.info({ 
            attempt: connectionState.reconnectAttempts, 
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
            delayMs: delay 
          }, 'Scheduling reconnection attempt');
          
          connectionState.lastReconnectAt = Date.now();
          
          setTimeout(() => {
            connectToWhatsApp().catch(err => {
              waLogger.error({ error: err.message }, 'Error during reconnection');
            });
          }, delay);
        } else {
          // Máximo de intentos alcanzado - notificar al admin
          connectionState.status = 'disconnected';
          connectionState.lastError = 'Máximo de intentos de reconexión alcanzado';
          
          await notifyAdminConnectionFailure(
            shouldReconnect 
              ? `Máximo de intentos (${MAX_RECONNECT_ATTEMPTS}) alcanzado` 
              : `Sesión cerrada por el servidor (código ${statusCode})`
          );
        }
        
        await updateSessionInDB();
      }
    });

    // Guardar credenciales cuando se actualicen
    socket.ev.on('creds.update', saveCreds);

    // Manejar mensajes entrantes CON DEBOUNCING
    socket.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            // 🆕 Usar debouncer para agrupar mensajes rápidos
            const from = msg.key.remoteJid;
            if (!from) continue;
            
            const phoneNumber = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
            
            // Extraer texto del mensaje para el debouncer
            const messageContent = msg.message;
            let body = '';
            
            if (messageContent?.conversation) {
              body = messageContent.conversation;
            } else if (messageContent?.extendedTextMessage?.text) {
              body = messageContent.extendedTextMessage.text;
            } else if (messageContent?.imageMessage?.caption) {
              body = messageContent.imageMessage.caption;
            } else if (messageContent?.audioMessage) {
              // Audio se procesa inmediatamente (sin debounce)
              await handleIncomingMessage(msg, socket);
              continue;
            }
            
            if (!body.trim()) {
              waLogger.debug({ from }, 'Message without text (possibly unsupported media)');
              continue;
            }
            
            // Normalizar y agregar al debouncer
            body = normalizeIncomingText(body);
            
            const incomingMsg: IncomingMessage = {
              phone: phoneNumber,
              text: body,
              timestamp: Date.now(),
              messageId: msg.key?.id || `msg_${Date.now()}`,
              profileName: msg.pushName || 'Usuario'
            };
            
            // El debouncer llamará a handleDebouncedMessages cuando esté listo
            messageDebouncer.addMessage(
              incomingMsg, 
              (messages) => handleDebouncedMessages(messages, socket)
            );
          }
        }
      }
    });

  } catch (error) {
    waLogger.error({ error }, 'Error in connectToWhatsApp');
    throw error;
  }
}

/**
 * 🆕 Handler para mensajes agrupados por el debouncer
 */
async function handleDebouncedMessages(
  messages: IncomingMessage[], 
  socket: WASocket
): Promise<void> {
  if (messages.length === 0) return;
  
  const phone = messages[0].phone;
  const profileName = messages[0].profileName;
  
  // Combinar todos los mensajes en uno solo
  const combinedText = messages.map(m => m.text).join('\n');
  
  waLogger.info({
    phone,
    messagesCount: messages.length,
    combinedLength: combinedText.length,
    texts: messages.map(m => m.text.substring(0, 30))
  }, '🔄 Processing debounced messages');
  
  // Crear un mensaje sintético para procesar
  const syntheticMsg = {
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
}

/**
 * Manejar mensaje entrante
 */
async function handleIncomingMessage(msg: proto.IWebMessageInfo, socket: WASocket): Promise<void> {
  const startTime = Date.now();
  
  try {
    if (!msg.key) return;
    const from = msg.key.remoteJid;
    if (!from) return;

    // Incrementar métrica
    metrics.messagesReceived++;

    // Extraer texto del mensaje
    const messageContent = msg.message;
    let body = '';
    let isAudioMessage = false;
    let audioTranscription = '';
    
    if (messageContent?.conversation) {
      body = messageContent.conversation;
    } else if (messageContent?.extendedTextMessage?.text) {
      body = messageContent.extendedTextMessage.text;
    } else if (messageContent?.imageMessage?.caption) {
      body = messageContent.imageMessage.caption;
    } else if (messageContent?.videoMessage?.caption) {
      body = messageContent.videoMessage.caption;
    } else if (messageContent?.audioMessage && msg.key) {
      // Mensaje de audio - transcribir con OpenAI Whisper (con retry)
      isAudioMessage = true;
      waLogger.info({ from }, 'Audio message detected, starting transcription');
      
      const transcriptionResult = await transcribeAudioWithRetry(msg, messageContent.audioMessage, socket);
      
      if (transcriptionResult.success && transcriptionResult.text) {
        audioTranscription = transcriptionResult.text;
        body = audioTranscription;
        metrics.audioTranscriptions++;
        waLogger.info({ from, textLength: body.length }, 'Audio transcribed successfully');
      } else {
        metrics.audioTranscriptionsFailed++;
        waLogger.warn({ from, error: transcriptionResult.error }, 'Audio transcription failed');
        // Usar mensaje de fallback amigable
        body = transcriptionResult.fallbackMessage || '[No pude entender el audio, por favor escríbeme tu mensaje]';
      }
    }

    if (!body.trim()) {
      waLogger.debug({ from }, 'Message without text (possibly unsupported media)');
      return;
    }

    // Normalizar texto entrante (eliminar caracteres invisibles)
    body = normalizeIncomingText(body);

    const phoneNumber = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const pushName = msg.pushName || 'Usuario';
    const messageId = msg.key?.id || `msg_${Date.now()}`;

    waLogger.info({ 
      from: phoneNumber, 
      profileName: pushName, 
      isAudio: isAudioMessage,
      messagePreview: body.substring(0, 100)
    }, 'Processing incoming message');

    // Guardar mensaje entrante en BD (incluir nota si es audio transcrito)
    const bodyToSave = isAudioMessage && audioTranscription 
      ? `🎤 ${body}` 
      : body;
    
    await saveMessageToDB({
      messageId,
      from: phoneNumber,
      body: bodyToSave,
      direction: 'inbound',
      profileName: pushName
    });

    // Emitir evento
    whatsappEvents.emit('message', {
      from: phoneNumber,
      body,
      messageId,
      profileName: pushName,
      isAudio: isAudioMessage
    });

    // Procesar con IA si auto-reply está habilitado
    const autoReply = process.env.WHATSAPP_AUTO_REPLY === 'true';
    
    if (autoReply) {
      try {
        // Determinar si responder con voz:
        // - Si el usuario envió audio Y WHATSAPP_VOICE_RESPONSES está habilitado
        const shouldRespondWithVoice = isAudioMessage && 
          process.env.WHATSAPP_VOICE_RESPONSES === 'true';
        
        // Si vamos a responder con voz Y tenemos GPT Audio habilitado, usar flujo integrado
        const useGPTAudioIntegrated = shouldRespondWithVoice && 
          process.env.USE_GPT_AUDIO_MODEL === 'true';
        
        if (useGPTAudioIntegrated) {
          // Flujo optimizado: GPT Audio genera respuesta + audio en una llamada
          waLogger.info({ to: phoneNumber }, 'Using GPT Audio integrated flow (chat + TTS in one call)');
          
          const aiStartTime = Date.now();
          const audioResult = await processAndRespondWithAudio(phoneNumber, body);
          const aiDuration = Date.now() - aiStartTime;
          
          // Actualizar métricas de IA
          metrics.aiProcessingTimeTotal += aiDuration;
          metrics.aiProcessingCount++;
          
          if (audioResult.success && audioResult.response) {
            // Guardar respuesta en BD
            await saveMessageToDB({
              messageId: audioResult.messageId || `resp_gptaudio_${Date.now()}`,
              from: connectionState.phoneNumber || 'bot',
              to: phoneNumber,
              body: `🔊 ${audioResult.response}`,
              direction: 'outbound',
              aiResponse: audioResult.response
            });
            
            waLogger.info({ 
              to: phoneNumber, 
              aiDuration,
              responseType: 'gpt-audio-integrated'
            }, 'GPT Audio response sent');
          } else {
            waLogger.warn({ error: audioResult.error }, 'GPT Audio failed, falling back to standard flow');
            // Fallback al flujo tradicional
            await fallbackToStandardAIFlow(body, phoneNumber, shouldRespondWithVoice);
          }
        } else {
          // Flujo tradicional: AI Service + TTS separados
          await fallbackToStandardAIFlow(body, phoneNumber, shouldRespondWithVoice);
        }
      } catch (aiError: any) {
        waLogger.error({ error: aiError.message, phone: phoneNumber }, 'Error processing with AI');
        metrics.messagesFailed++;
      }
    }

  } catch (error: any) {
    waLogger.error({ error: error.message }, 'Error handling incoming message');
    metrics.messagesFailed++;
  }
}

/**
 * Flujo tradicional de IA (WhatsAppAI + TTS separado)
 * Usado como fallback cuando GPT Audio no está disponible
 * 🆕 Ahora con chunking inteligente para respuestas largas
 */
async function fallbackToStandardAIFlow(
  body: string, 
  phoneNumber: string, 
  shouldRespondWithVoice: boolean
): Promise<void> {
  // Importar servicio de IA dinámicamente para evitar dependencias circulares
  const WhatsAppAI = await import('./WhatsAppAIService');
  
  const aiStartTime = Date.now();
  const result = await WhatsAppAI.processMessage(body, phoneNumber, []);
  const aiDuration = Date.now() - aiStartTime;
  
  // Actualizar métricas de IA
  metrics.aiProcessingTimeTotal += aiDuration;
  metrics.aiProcessingCount++;
  
  // 🆕 Verificar si es respuesta silenciosa (silent token)
  if (result.success && (result as any).silent) {
    waLogger.info({ to: phoneNumber }, '🤫 Silent response - not sending message');
    return;
  }
  
  if (result.success && result.response) {
    // 🆕 Aplicar chunking si la respuesta es muy larga
    const responseChunks = needsChunking(result.response) 
      ? chunkResponse(result.response, { mode: 'smart' }).chunks
      : [result.response];
    
    waLogger.debug({ 
      to: phoneNumber, 
      responseLength: result.response.length,
      chunksCount: responseChunks.length 
    }, 'Response chunking applied');
    
    if (shouldRespondWithVoice) {
      // Responder con nota de voz (TTS tradicional) - solo primer chunk
      waLogger.info({ to: phoneNumber }, 'Responding with voice note (TTS flow)');
      await sendVoiceNote(phoneNumber, responseChunks[0], false);
      
      // Guardar respuesta en BD
      await saveMessageToDB({
        messageId: `resp_voice_${Date.now()}`,
        from: connectionState.phoneNumber || 'bot',
        to: phoneNumber,
        body: `🔊 ${result.response}`,
        direction: 'outbound',
        aiResponse: result.response
      });
    } else {
      // 🆕 Responder con texto usando chunking si hay múltiples chunks
      for (let i = 0; i < responseChunks.length; i++) {
        const chunk = responseChunks[i];
        await sendMessage(phoneNumber, chunk);
        
        // Pequeño delay entre chunks para evitar spam
        if (i < responseChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Guardar respuesta completa en BD
      await saveMessageToDB({
        messageId: `resp_${Date.now()}`,
        from: connectionState.phoneNumber || 'bot',
        to: phoneNumber,
        body: result.response,
        direction: 'outbound',
        aiResponse: result.response
      });
    }
    
    waLogger.info({ 
      to: phoneNumber, 
      aiDuration,
      toolCalls: result.toolCalls?.length || 0,
      responseType: shouldRespondWithVoice ? 'voice-tts' : 'text',
      chunksCount: responseChunks.length
    }, 'AI response sent (standard flow)');
  }
}

/**
 * Transcribir audio con retry y fallback
 */
async function transcribeAudioWithRetry(
  msg: proto.IWebMessageInfo,
  audioMessage: proto.Message.IAudioMessage,
  socket: WASocket,
  maxRetries: number = 2
): Promise<{ success: boolean; text?: string; error?: string; fallbackMessage?: string }> {
  let lastError = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Descargar el audio
      const downloadableMessage = {
        ...msg,
        key: msg.key
      } as Parameters<typeof downloadMediaMessage>[0];
      
      const audioBuffer = await downloadMediaMessage(
        downloadableMessage,
        'buffer',
        {},
        {
          logger,
          reuploadRequest: socket.updateMediaMessage
        }
      ) as Buffer;
      
      if (!audioBuffer || audioBuffer.length === 0) {
        lastError = 'Buffer de audio vacío';
        continue;
      }
      
      waLogger.debug({ attempt, bufferSize: audioBuffer.length }, 'Audio downloaded for transcription');
      
      // Importar servicio de transcripción
      const { transcribeAudio } = await import('./AudioTranscriptionService');
      
      const mimeType = audioMessage.mimetype || 'audio/ogg; codecs=opus';
      const transcriptionResult = await transcribeAudio(audioBuffer, mimeType);
      
      if (transcriptionResult.success && transcriptionResult.text) {
        return { success: true, text: transcriptionResult.text };
      }
      
      lastError = transcriptionResult.error || 'Transcripción fallida';
      
    } catch (error: any) {
      lastError = error.message;
      waLogger.warn({ attempt, error: error.message }, 'Transcription attempt failed');
    }
    
    // Esperar antes de reintentar
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  // Todos los intentos fallaron - retornar mensaje amigable
  return {
    success: false,
    error: lastError,
    fallbackMessage: '🎤 Recibí tu mensaje de voz pero no pude procesarlo. ¿Podrías escribirme tu consulta, por favor?'
  };
}

/**
 * Enviar mensaje de texto
 */
export async function sendMessage(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!connectionState.socket || connectionState.status !== 'connected') {
      waLogger.warn({ to }, 'Cannot send message - WhatsApp not connected');
      return { success: false, error: 'WhatsApp no conectado' };
    }

    // Formatear número
    let jid = to;
    if (!jid.includes('@')) {
      // Limpiar número
      jid = jid.replace(/\D/g, '');
      // Añadir sufijo de WhatsApp
      jid = `${jid}@s.whatsapp.net`;
    }

    waLogger.debug({ to: jid, textLength: text.length }, 'Sending message');

    const result = await connectionState.socket.sendMessage(jid, { text });
    
    metrics.messagesSent++;
    
    return { 
      success: true, 
      messageId: result?.key?.id || `sent_${Date.now()}`
    };
  } catch (error: any) {
    waLogger.error({ error: error.message, to }, 'Error sending message');
    metrics.messagesFailed++;
    return { success: false, error: error.message };
  }
}

/**
 * Enviar nota de voz (mensaje de audio)
 * Convierte texto a audio usando el proveedor configurado (ElevenLabs, OpenAI TTS, GPT Audio)
 * @param useGPTAudio Si true, fuerza uso de gpt-audio-mini (ignorado si TTS_PROVIDER='elevenlabs')
 */
export async function sendVoiceNote(
  to: string, 
  text: string,
  useGPTAudio: boolean = false
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!connectionState.socket || connectionState.status !== 'connected') {
      waLogger.warn({ to }, 'Cannot send voice note - WhatsApp not connected');
      return { success: false, error: 'WhatsApp no conectado' };
    }

    let audioBuffer: Buffer | undefined;
    const ttsProvider = process.env.TTS_PROVIDER || 'openai';

    // Prioridad: ElevenLabs > GPT Audio > OpenAI TTS
    if (ttsProvider === 'elevenlabs') {
      // Usar ElevenLabs TTS (voz colombiana natural)
      const ElevenLabsTTS = await import('./ElevenLabsTTSService');
      
      waLogger.info({ to, textLength: text.length, provider: 'elevenlabs' }, 'Generating voice note with ElevenLabs');
      
      const elevenResult = await ElevenLabsTTS.generateWhatsAppVoiceNoteElevenLabs(text);
      
      if (elevenResult.success && elevenResult.audioBuffer) {
        audioBuffer = elevenResult.audioBuffer;
        waLogger.info({ 
          to, 
          audioSize: audioBuffer.length,
          voice: elevenResult.voiceName,
          duration: elevenResult.duration
        }, 'ElevenLabs audio generated successfully');
      } else {
        waLogger.warn({ error: elevenResult.error }, 'ElevenLabs failed, falling back to OpenAI TTS');
      }
    } else if ((ttsProvider === 'gpt-audio' || useGPTAudio) && process.env.USE_GPT_AUDIO_MODEL === 'true') {
      // Usar el nuevo modelo gpt-audio-mini-2025-12-15
      const GPTAudioService = await import('./GPTAudioService');
      
      waLogger.info({ to, textLength: text.length, provider: 'gpt-audio' }, 'Generating voice note with GPT Audio model');
      
      const gptResult = await GPTAudioService.generateWhatsAppAudio(text, true);
      
      if (gptResult.success && gptResult.audioBuffer) {
        audioBuffer = gptResult.audioBuffer;
        waLogger.info({ to, audioSize: audioBuffer.length }, 'GPT Audio generated successfully');
      } else {
        waLogger.warn({ error: gptResult.error }, 'GPT Audio failed, falling back to TTS');
      }
    }

    // Fallback a OpenAI TTS si no hay audio aún
    if (!audioBuffer) {
      const { generateWhatsAppVoiceNote } = await import('./TextToSpeechService');
      
      waLogger.info({ to, textLength: text.length, provider: 'openai-tts' }, 'Generating voice note with OpenAI TTS');
      
      const ttsResult = await generateWhatsAppVoiceNote(text);
      
      if (!ttsResult.success || !ttsResult.audioBuffer) {
        waLogger.error({ error: ttsResult.error }, 'Failed to generate TTS audio');
        return sendMessage(to, text);
      }
      
      audioBuffer = ttsResult.audioBuffer;
    }

    // Formatear número
    let jid = to;
    if (!jid.includes('@')) {
      jid = jid.replace(/\D/g, '');
      jid = `${jid}@s.whatsapp.net`;
    }

    waLogger.debug({ to: jid, audioSize: audioBuffer.length }, 'Sending voice note');

    // Determinar mimetype basado en el proveedor
    // ElevenLabs ahora genera OGG/OPUS, OpenAI TTS genera OPUS directamente
    const isElevenLabs = ttsProvider === 'elevenlabs';
    const mimetype = isElevenLabs ? 'audio/ogg; codecs=opus' : 'audio/ogg; codecs=opus';

    // Enviar como nota de voz (ptt = push to talk)
    const result = await connectionState.socket.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: mimetype, // OGG/OPUS para compatibilidad con WhatsApp PTT
      ptt: true // Esto marca el audio como nota de voz
    });
    
    metrics.messagesSent++;
    
    waLogger.info({ to, messageId: result?.key?.id, mimetype }, 'Voice note sent successfully');
    
    return { 
      success: true, 
      messageId: result?.key?.id || `voice_${Date.now()}`
    };
  } catch (error: any) {
    waLogger.error({ error: error.message, to }, 'Error sending voice note');
    metrics.messagesFailed++;
    // Fallback: intentar enviar como texto
    waLogger.info({ to }, 'Falling back to text message');
    return sendMessage(to, text);
  }
}

/**
 * Procesar mensaje y responder con audio usando gpt-audio-mini
 * Esta función combina IA + TTS en una sola llamada API
 */
export async function processAndRespondWithAudio(
  to: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  systemPrompt?: string
): Promise<{ 
  success: boolean; 
  messageId?: string; 
  response?: string; 
  error?: string 
}> {
  try {
    if (!connectionState.socket || connectionState.status !== 'connected') {
      waLogger.warn({ to }, 'Cannot process - WhatsApp not connected');
      return { success: false, error: 'WhatsApp no conectado' };
    }

    // Usar GPT Audio para generar respuesta + audio en una llamada
    const GPTAudioService = await import('./GPTAudioService');
    
    waLogger.info({ to, messageLength: userMessage.length }, 'Processing with GPT Audio (chat + TTS integrated)');
    
    const startTime = Date.now();
    const result = await GPTAudioService.generateChatWithAudio(
      userMessage,
      conversationHistory,
      {
        voice: 'nova',
        format: 'mp3',
        saveToFile: false,
        systemPrompt
      }
    );
    const duration = Date.now() - startTime;

    if (!result.success || !result.audioBuffer) {
      waLogger.error({ error: result.error }, 'GPT Audio processing failed');
      return { success: false, error: result.error };
    }

    // Formatear número
    let jid = to;
    if (!jid.includes('@')) {
      jid = jid.replace(/\D/g, '');
      jid = `${jid}@s.whatsapp.net`;
    }

    // Enviar como nota de voz
    const sendResult = await connectionState.socket.sendMessage(jid, {
      audio: result.audioBuffer,
      mimetype: 'audio/mpeg',
      ptt: true
    });

    metrics.messagesSent++;

    waLogger.info({ 
      to, 
      messageId: sendResult?.key?.id,
      responseLength: result.text?.length,
      durationMs: duration 
    }, 'GPT Audio response sent successfully');

    return {
      success: true,
      messageId: sendResult?.key?.id || `gpt_audio_${Date.now()}`,
      response: result.text
    };

  } catch (error: any) {
    waLogger.error({ error: error.message, to }, 'Error in processAndRespondWithAudio');
    metrics.messagesFailed++;
    return { success: false, error: error.message };
  }
}

/**
 * Enviar respuesta (decide automáticamente si enviar texto o voz)
 * @param to Número de destino
 * @param text Texto a enviar
 * @param asVoice Si es true, envía como nota de voz
 */
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

/**
 * Desconectar de WhatsApp
 */
export async function disconnect(): Promise<{ success: boolean; message: string }> {
  try {
    waLogger.info('Disconnecting from WhatsApp');
    
    if (connectionState.socket) {
      await connectionState.socket.logout();
      connectionState.socket = null;
    }
    
    connectionState.status = 'disconnected';
    connectionState.qrCode = null;
    connectionState.qrCodeImage = null;
    connectionState.phoneNumber = null;
    
    await updateSessionInDB();
    
    waLogger.info('Successfully disconnected from WhatsApp');
    return { success: true, message: 'Desconectado de WhatsApp' };
  } catch (error: any) {
    waLogger.error({ error: error.message }, 'Error disconnecting');
    return { success: false, message: error.message };
  }
}

/**
 * Obtener estado actual
 */
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
    connected: connectionState.status === 'connected',
    status: connectionState.status,
    phoneNumber: connectionState.phoneNumber,
    qrCode: connectionState.qrCodeImage,
    sessionId: connectionState.sessionId,
    lastError: connectionState.lastError,
    reconnectAttempts: connectionState.reconnectAttempts,
    metrics: getWhatsAppMetrics()
  };
}

/**
 * Forzar reset de intentos de reconexión (útil para admin)
 */
export function resetReconnectAttempts(): void {
  waLogger.info({ previousAttempts: connectionState.reconnectAttempts }, 'Resetting reconnect attempts');
  connectionState.reconnectAttempts = 0;
  connectionState.lastError = null;
}

/**
 * Limpiar credenciales almacenadas
 */
async function clearCredentials(): Promise<void> {
  try {
    if (fs.existsSync(AUTH_FOLDER)) {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    }
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    waLogger.info('Credentials cleared successfully');
  } catch (error) {
    waLogger.error({ error }, 'Error clearing credentials');
  }
}

/**
 * Actualizar sesión en base de datos
 */
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
    `, [
      connectionState.sessionId,
      connectionState.phoneNumber,
      connectionState.status,
      connectionState.qrCode
    ]);
  } catch (error) {
    waLogger.error({ error }, 'Error updating session in DB');
  }
}

/**
 * Guardar mensaje en base de datos
 */
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
      connectionState.sessionId,
      data.messageId,
      data.from,
      data.to || null,
      data.body,
      data.direction,
      data.aiResponse || null
    ]);

    // Actualizar o crear conversación
    const phone = data.direction === 'inbound' ? data.from : data.to;
    if (phone) {
      await pool.execute(`
        INSERT INTO wa_conversations (session_id, phone_number, last_message, last_activity, status)
        VALUES (?, ?, ?, NOW(), 'active')
        ON DUPLICATE KEY UPDATE 
          last_message = VALUES(last_message),
          last_activity = NOW(),
          status = 'active'
      `, [connectionState.sessionId, phone, data.body]);
    }
  } catch (error) {
    waLogger.error({ error }, 'Error saving message to DB');
  }
}

/**
 * Intentar reconexión automática al iniciar si hay credenciales guardadas
 */
async function autoReconnect(): Promise<void> {
  try {
    // Verificar si hay credenciales guardadas
    const credsPath = path.join(AUTH_FOLDER, 'creds.json');
    if (fs.existsSync(credsPath)) {
      waLogger.info('🔄 Credentials found, attempting auto-reconnect');
      await startConnection();
    } else {
      waLogger.info('ℹ️ No saved credentials. Scan QR code to connect.');
    }
  } catch (error) {
    waLogger.error({ error }, 'Error in auto-reconnect');
  }
}

/**
 * Health check periódico: verifica que el WebSocket de Baileys esté realmente activo.
 * Si el status dice "connected" pero el socket está muerto, fuerza reconexión.
 */
const HEALTH_CHECK_INTERVAL_MS = 60_000; // cada 60 segundos
let healthCheckTimer: NodeJS.Timeout | null = null;

function startHealthCheck(): void {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  
  healthCheckTimer = setInterval(async () => {
    try {
      // Solo verificar si se supone que estamos conectados
      if (connectionState.status !== 'connected') return;
      
      const socket = connectionState.socket;
      
      // Verificar si el socket existe y el WebSocket interno está activo
      const wsState = (socket as any)?.ws?.readyState;
      const isSocketAlive = socket && (wsState === undefined || wsState === 1); // 1 = OPEN, undefined = Baileys internals vary
      
      if (!socket) {
        waLogger.warn('⚠️ Health check: status=connected but socket is null. Forcing reconnection.');
        connectionState.status = 'disconnected';
        connectionState.lastError = null;
        connectionState.reconnectAttempts = 0;
        await startConnection();
        return;
      }
      
      // Intentar un "ping" ligero: verificar que podemos acceder al user info
      try {
        const user = socket.user;
        if (!user?.id) {
          waLogger.warn('⚠️ Health check: socket exists but user info is empty. Possible zombie connection.');
          // Dar una oportunidad antes de reconectar - podría ser temporal
        }
      } catch (pingError) {
        waLogger.warn({ error: pingError }, '⚠️ Health check: socket error on user access. Forcing reconnection.');
        connectionState.status = 'disconnected';
        connectionState.lastError = null;
        connectionState.reconnectAttempts = 0;
        try {
          socket.end(undefined);
        } catch (e) { /* ignore */ }
        await startConnection();
        return;
      }
      
      // Verificar si el WebSocket subyacente está cerrado
      if (wsState !== undefined && wsState !== 1) {
        waLogger.warn({ wsState }, '⚠️ Health check: WebSocket not OPEN (state=' + wsState + '). Forcing reconnection.');
        connectionState.status = 'disconnected';
        connectionState.lastError = null;
        connectionState.reconnectAttempts = 0;
        try {
          socket.end(undefined);
        } catch (e) { /* ignore */ }
        await startConnection();
        return;
      }
      
    } catch (error) {
      waLogger.error({ error }, 'Error in health check');
    }
  }, HEALTH_CHECK_INTERVAL_MS);
  
  waLogger.info({ intervalMs: HEALTH_CHECK_INTERVAL_MS }, '🏥 WhatsApp health check started');
}

// Ejecutar auto-reconexión al cargar el módulo (con pequeño delay para que el servidor esté listo)
setTimeout(() => {
  autoReconnect().catch(err => waLogger.error({ error: err }, 'Error starting auto-reconnect'));
  startHealthCheck();
}, 3000);

// Exportar instancia singleton
export default {
  startConnection,
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
