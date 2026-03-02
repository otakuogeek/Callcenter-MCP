/**
 * WhatsApp Message Debouncer Service
 * 
 * Inspirado en moltbot/auto-reply/inbound-debounce.ts
 * 
 * Agrupa mensajes rápidos del mismo usuario en un solo mensaje combinado
 * para evitar múltiples respuestas y reducir costos de API.
 * 
 * Ejemplo:
 *   Usuario: "Hola" (10:00:00)
 *   Usuario: "Necesito una cita" (10:00:02)
 *   Usuario: "De medicina general" (10:00:04)
 *   
 *   Sin debounce: 3 respuestas separadas (confuso, costoso)
 *   Con debounce: 1 respuesta a "Hola\nNecesito una cita\nDe medicina general"
 * 
 * @version 1.0.0
 */

import pino from 'pino';

const logger = pino({
  name: 'whatsapp-debouncer',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

// Tiempo de espera antes de procesar mensajes agrupados (ms)
const DEBOUNCE_MS = parseInt(process.env.WHATSAPP_DEBOUNCE_MS || '3000', 10);

// Máximo de mensajes a agrupar
const MAX_BUFFERED_MESSAGES = 10;

// Tiempo máximo de espera total (evita bloquear mensajes indefinidamente)
const MAX_WAIT_MS = 10000;

// ============================================================================
// TIPOS
// ============================================================================

export interface IncomingMessage {
  phone: string;
  text: string;
  messageId: string;
  profileName?: string;
  mediaUrl?: string;
  mediaType?: string;
  timestamp: number;
  isAudio?: boolean;
}

interface DebounceBuffer {
  items: IncomingMessage[];
  timeout: NodeJS.Timeout | null;
  firstMessageTime: number;
}

type FlushCallback = (phone: string, combinedMessage: IncomingMessage) => Promise<void>;

// ============================================================================
// DEBOUNCER CLASS
// ============================================================================

class MessageDebouncer {
  private buffers = new Map<string, DebounceBuffer>();
  private flushCallback: FlushCallback | null = null;
  private debounceMs: number;
  private maxBufferedMessages: number;
  private maxWaitMs: number;

  constructor(options?: {
    debounceMs?: number;
    maxBufferedMessages?: number;
    maxWaitMs?: number;
  }) {
    this.debounceMs = options?.debounceMs ?? DEBOUNCE_MS;
    this.maxBufferedMessages = options?.maxBufferedMessages ?? MAX_BUFFERED_MESSAGES;
    this.maxWaitMs = options?.maxWaitMs ?? MAX_WAIT_MS;

    logger.info({
      debounceMs: this.debounceMs,
      maxBufferedMessages: this.maxBufferedMessages,
      maxWaitMs: this.maxWaitMs
    }, 'Message debouncer initialized');
  }

  /**
   * Registra el callback que se ejecutará cuando se procesen mensajes
   */
  onFlush(callback: FlushCallback): void {
    this.flushCallback = callback;
  }

  /**
   * Encola un mensaje para procesamiento con debounce
   */
  async enqueue(message: IncomingMessage): Promise<void> {
    const phone = message.phone;

    // Obtener o crear buffer
    let buffer = this.buffers.get(phone);
    
    if (!buffer) {
      buffer = {
        items: [],
        timeout: null,
        firstMessageTime: Date.now()
      };
      this.buffers.set(phone, buffer);
    }

    // Cancelar timeout anterior
    if (buffer.timeout) {
      clearTimeout(buffer.timeout);
      buffer.timeout = null;
    }

    // Agregar mensaje al buffer
    buffer.items.push(message);

    logger.debug({
      phone,
      messageCount: buffer.items.length,
      text: message.text.substring(0, 50)
    }, 'Message buffered');

    // Verificar si debe hacer flush inmediato
    const shouldFlushNow = this.shouldFlushImmediately(buffer, message);

    if (shouldFlushNow) {
      await this.flushBuffer(phone);
      return;
    }

    // Programar flush con debounce
    buffer.timeout = setTimeout(async () => {
      await this.flushBuffer(phone);
    }, this.debounceMs);

    // Asegurar que el timeout no bloquee el proceso
    if (buffer.timeout.unref) {
      buffer.timeout.unref();
    }
  }

  /**
   * Determina si debe hacer flush inmediatamente sin esperar debounce
   */
  private shouldFlushImmediately(buffer: DebounceBuffer, message: IncomingMessage): boolean {
    // Flush si alcanzamos el máximo de mensajes
    if (buffer.items.length >= this.maxBufferedMessages) {
      logger.debug({ count: buffer.items.length }, 'Flush: max messages reached');
      return true;
    }

    // Flush si ha pasado demasiado tiempo desde el primer mensaje
    const elapsed = Date.now() - buffer.firstMessageTime;
    if (elapsed >= this.maxWaitMs) {
      logger.debug({ elapsed }, 'Flush: max wait time reached');
      return true;
    }

    // Flush si es un mensaje de audio (requiere procesamiento especial)
    if (message.isAudio) {
      logger.debug({}, 'Flush: audio message received');
      return true;
    }

    // Flush si el mensaje es largo (probablemente un mensaje completo)
    if (message.text.length > 200) {
      logger.debug({ length: message.text.length }, 'Flush: long message');
      return true;
    }

    // Flush si el mensaje parece una pregunta completa o despedida
    const immediatePatterns = [
      /\?$/,                           // Termina en pregunta
      /^(gracias|adios|chao|bye)/i,    // Despedida
      /quiero (una )?cita/i,           // Solicitud clara
      /necesito (una )?cita/i,
      /agendar(me)?/i,
      /cancelar/i,
      /mis citas/i,
    ];

    for (const pattern of immediatePatterns) {
      if (pattern.test(message.text)) {
        // Solo flush si ya tenemos múltiples mensajes
        if (buffer.items.length > 1) {
          logger.debug({ pattern: pattern.source }, 'Flush: complete intent detected');
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Procesa todos los mensajes en el buffer de un teléfono
   */
  private async flushBuffer(phone: string): Promise<void> {
    const buffer = this.buffers.get(phone);
    
    if (!buffer || buffer.items.length === 0) {
      this.buffers.delete(phone);
      return;
    }

    // Limpiar timeout si existe
    if (buffer.timeout) {
      clearTimeout(buffer.timeout);
      buffer.timeout = null;
    }

    // Remover buffer del mapa
    this.buffers.delete(phone);

    // Combinar mensajes
    const combinedMessage = this.combineMessages(buffer.items);

    logger.info({
      phone,
      originalCount: buffer.items.length,
        combinedLength: combinedMessage.text.length,
      waitTime: Date.now() - buffer.firstMessageTime
    }, 'Flushing buffered messages');

    // Ejecutar callback
    if (this.flushCallback) {
      try {
        await this.flushCallback(phone, combinedMessage);
      } catch (error: any) {
        logger.error({
          phone,
          error: error.message,
          messageCount: buffer.items.length
        }, 'Error processing flushed messages');
      }
    }
  }

  /**
   * Combina múltiples mensajes en uno solo
   */
  private combineMessages(messages: IncomingMessage[]): IncomingMessage {
    if (messages.length === 1) {
      return messages[0];
    }

    // Combinar los textos de los mensajes
    const combinedText = messages
      .map(m => m.text.trim())
      .filter(t => t.length > 0)
      .join('\n');

    // Usar el primer mensaje como base
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    return {
      phone: firstMessage.phone,
      text: combinedText,
      messageId: lastMessage.messageId, // Usar el último ID
      profileName: firstMessage.profileName,
      // Combinar media si hay
      mediaUrl: messages.find(m => m.mediaUrl)?.mediaUrl,
      mediaType: messages.find(m => m.mediaType)?.mediaType,
      timestamp: lastMessage.timestamp,
      isAudio: messages.some(m => m.isAudio)
    };
  }

  /**
   * Fuerza el procesamiento de todos los buffers pendientes
   */
  async flushAll(): Promise<void> {
    const phones = Array.from(this.buffers.keys());
    
    for (const phone of phones) {
      await this.flushBuffer(phone);
    }
  }

  /**
   * Fuerza el procesamiento del buffer de un teléfono específico
   */
  async flushPhone(phone: string): Promise<void> {
    await this.flushBuffer(phone);
  }

  /**
   * Obtiene estadísticas del debouncer
   */
  getStats(): {
    activeBuffers: number;
    totalBufferedMessages: number;
    config: { debounceMs: number; maxBufferedMessages: number; maxWaitMs: number };
  } {
    let totalMessages = 0;
    for (const buffer of this.buffers.values()) {
      totalMessages += buffer.items.length;
    }

    return {
      activeBuffers: this.buffers.size,
      totalBufferedMessages: totalMessages,
      config: {
        debounceMs: this.debounceMs,
        maxBufferedMessages: this.maxBufferedMessages,
        maxWaitMs: this.maxWaitMs
      }
    };
  }

  /**
   * Alias for enqueue - accepts inline callback for compatibility with WhatsAppConnection
   */
  addMessage(
    message: IncomingMessage,
    callback: (messages: IncomingMessage[]) => Promise<void>
  ): void {
    // Register the callback if not already set
    if (!this.flushCallback) {
      this.onFlush(async (_phone: string, combinedMsg: IncomingMessage) => {
        await callback([combinedMsg]);
      });
    }
    this.enqueue(message).catch(err => {
      logger.error({ error: err?.message, phone: message.phone }, 'Error in addMessage');
    });
  }

  /**
   * Verifica si hay mensajes pendientes para un teléfono
   */
  hasPendingMessages(phone: string): boolean {
    const buffer = this.buffers.get(phone);
    return buffer !== undefined && buffer.items.length > 0;
  }

  /**
   * Cancela el procesamiento pendiente para un teléfono
   */
  cancel(phone: string): void {
    const buffer = this.buffers.get(phone);
    if (buffer) {
      if (buffer.timeout) {
        clearTimeout(buffer.timeout);
      }
      this.buffers.delete(phone);
      logger.debug({ phone, droppedMessages: buffer.items.length }, 'Buffer cancelled');
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const messageDebouncer = new MessageDebouncer();

export default MessageDebouncer;
