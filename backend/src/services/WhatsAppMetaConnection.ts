/**
 * WhatsApp Meta Cloud API Connection Service
 *
 * Implementa la integración con la API oficial de WhatsApp Business de Meta
 * (https://developers.facebook.com/docs/whatsapp/cloud-api)
 *
 * DIFERENCIAS CLAVE vs Baileys:
 *  - Sin escaneo QR — se autentica con credenciales del portal Meta Business
 *  - Los mensajes llegan vía HTTP webhook (POST de Meta a nuestro servidor)
 *  - Los mensajes se envían con HTTP REST a graph.facebook.com
 *  - Totalmente oficial y soportado por Meta
 *
 * VARIABLES DE ENTORNO REQUERIDAS:
 *  WHATSAPP_PROVIDER=meta
 *  WHATSAPP_META_PHONE_NUMBER_ID=123456789        (ID del número de teléfono en Meta Business)
 *  WHATSAPP_META_ACCESS_TOKEN=EAAxxxxx            (Token de acceso permanente)
 *  WHATSAPP_META_APP_SECRET=abcdef123             (Secreto de app para verificar firmas)
 *  WHATSAPP_META_VERIFY_TOKEN=mi_token_secreto    (Token personalizado para verificación del webhook)
 *
 * @version 1.0.0
 */

import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import pool from '../db/pool';
import { ResultSetHeader } from 'mysql2';
import { normalizeIncomingText } from '../utils/whatsappUtils';
import { messageDebouncer, IncomingMessage as DebouncerMessage } from './WhatsAppMessageDebouncer';
import ResponseChunker from './WhatsAppResponseChunker';
import { COLOMBIA_TIMEZONE } from '../utils/dateUtils';

// ============================================================================
// CONSTANTES
// ============================================================================

const META_API_VERSION = 'v20.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const LOG_PREFIX = '[MetaWA]';

// ============================================================================
// LOGGING
// ============================================================================

function logInfo(msg: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`${LOG_PREFIX} INFO: ${msg}`, typeof data === 'string' ? data : JSON.stringify(data));
  } else {
    console.log(`${LOG_PREFIX} INFO: ${msg}`);
  }
}

function logWarn(msg: string, data?: unknown): void {
  if (data !== undefined) {
    console.warn(`${LOG_PREFIX} WARN: ${msg}`, typeof data === 'string' ? data : JSON.stringify(data));
  } else {
    console.warn(`${LOG_PREFIX} WARN: ${msg}`);
  }
}

function logError(msg: string, data?: unknown): void {
  if (data !== undefined) {
    console.error(`${LOG_PREFIX} ERROR: ${msg}`, typeof data === 'string' ? data : JSON.stringify(data));
  } else {
    console.error(`${LOG_PREFIX} ERROR: ${msg}`);
  }
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

interface MetaConfig {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
}

function getConfig(): MetaConfig {
  return {
    phoneNumberId: process.env.WHATSAPP_META_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_META_ACCESS_TOKEN || '',
    appSecret: process.env.WHATSAPP_META_APP_SECRET || '',
    verifyToken: process.env.WHATSAPP_META_VERIFY_TOKEN || 'biosanar_webhook_verify',
  };
}

/**
 * Verifica si las variables de entorno mínimas están configuradas.
 */
export function isConfigured(): boolean {
  const { phoneNumberId, accessToken } = getConfig();
  return !!(phoneNumberId && accessToken);
}

/**
 * Retorna el estado de configuración para el endpoint de status.
 */
export function getStatus(): {
  provider: 'meta';
  configured: boolean;
  phoneNumberId: string | null;
  webhookConfigured: boolean;
} {
  const { phoneNumberId, appSecret, verifyToken } = getConfig();
  return {
    provider: 'meta',
    configured: isConfigured(),
    phoneNumberId: phoneNumberId || null,
    webhookConfigured: !!(appSecret && verifyToken),
  };
}

// ============================================================================
// SEGURIDAD — Verificación de firma del webhook
// ============================================================================

/**
 * Verifica la firma HMAC-SHA256 enviada por Meta en el header X-Hub-Signature-256.
 * Meta firma el cuerpo crudo del request con el secreto de la app.
 * SIEMPRE validar esta firma antes de procesar el payload.
 *
 * @param rawBody  Buffer con el cuerpo crudo del request (antes de parsear JSON)
 * @param signature  Valor del header X-Hub-Signature-256 (ej: "sha256=abc123")
 */
export function verifySignature(rawBody: Buffer, signature: string): boolean {
  const { appSecret } = getConfig();
  if (!appSecret) {
    logWarn('WHATSAPP_META_APP_SECRET no configurado — omitiendo verificación de firma');
    return true; // permitir si no hay secret (solo para desarrollo)
  }

  try {
    const expected = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    // Usar timingSafeEqual para prevenir timing attacks
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  } catch {
    return false;
  }
}

// ============================================================================
// VERIFICACIÓN WEBHOOK (GET)
// ============================================================================

/**
 * Maneja la verificación del webhook cuando Meta hace GET al endpoint.
 * Meta envía: hub.mode=subscribe, hub.verify_token, hub.challenge
 * Debe responder con el mismo hub.challenge si el token es correcto.
 *
 * @returns El challenge para responder a Meta, o null si el token no es válido
 */
export function verifyWebhookChallenge(
  mode: string,
  token: string,
  challenge: string,
): string | null {
  const { verifyToken } = getConfig();
  if (mode === 'subscribe' && token === verifyToken) {
    logInfo('Webhook verificado correctamente por Meta');
    return challenge;
  }
  logWarn('Verificación de webhook fallida — token incorrecto', { received: token });
  return null;
}

// ============================================================================
// ENVIAR MENSAJE
// ============================================================================

/**
 * Envía un mensaje de texto a través de la API de Nube de WhatsApp de Meta.
 *
 * @param to  Número de teléfono en formato internacional (ej: "573001234567"), sin "+"
 * @param text  Texto del mensaje
 */
export async function sendMessage(
  to: string,
  text: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { phoneNumberId, accessToken } = getConfig();

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: 'Meta WhatsApp no configurado. Revisa WHATSAPP_META_PHONE_NUMBER_ID y WHATSAPP_META_ACCESS_TOKEN.',
    };
  }

  // Limpiar número: solo dígitos
  const cleanTo = to.replace(/\D/g, '');
  if (!cleanTo) {
    return { success: false, error: `Número de destino inválido: ${to}` };
  }

  try {
    const response = await axios.post(
      `${META_API_BASE}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: { body: text, preview_url: false },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    );

    const messageId: string = response.data?.messages?.[0]?.id || `meta_${Date.now()}`;
    logInfo(`Mensaje enviado a ${cleanTo}: ${messageId}`);
    return { success: true, messageId };
  } catch (err: unknown) {
    const axiosErr = err as AxiosError<{ error?: { message?: string; code?: number } }>;
    const errMsg =
      axiosErr.response?.data?.error?.message ||
      axiosErr.message ||
      'Error desconocido al enviar';
    logError(`Error enviando a ${cleanTo}: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

/**
 * Marca un mensaje como leído (opcional pero mejora la UX mostrando los ticks azules).
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  const { phoneNumberId, accessToken } = getConfig();
  if (!phoneNumberId || !accessToken) return;

  try {
    await axios.post(
      `${META_API_BASE}/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 5_000,
      },
    );
  } catch {
    // Mark as read es no-crítico, ignorar errores
  }
}

// ============================================================================
// PROCESAR WEBHOOK ENTRANTE (POST)
// ============================================================================

/**
 * Punto de entrada principal para webhooks de Meta.
 * Parsea el payload y encola cada mensaje entrante en el debouncer.
 *
 * @param body  Objeto ya parseado del JSON del webhook
 */
export async function processIncomingWebhook(body: unknown): Promise<void> {
  const payload = body as Record<string, unknown>;

  if (payload.object !== 'whatsapp_business_account') {
    logWarn('Webhook recibido de objeto desconocido', { object: payload.object });
    return;
  }

  const entries = (payload.entry as unknown[]) || [];

  for (const entry of entries) {
    const entryObj = entry as Record<string, unknown>;
    const changes = (entryObj.changes as unknown[]) || [];

    for (const change of changes) {
      const changeObj = change as Record<string, unknown>;
      if (changeObj.field !== 'messages') continue;

      const value = changeObj.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const messages = (value.messages as unknown[]) || [];
      const contacts = (value.contacts as Array<{ wa_id: string; profile?: { name?: string } }>) || [];

      for (const rawMsg of messages) {
        const msg = rawMsg as Record<string, unknown>;
        const messageType = msg.type as string;
        const phone = msg.from as string;
        const messageId = msg.id as string;
        const contact = contacts.find((c) => c.wa_id === phone);
        const profileName = contact?.profile?.name || 'Usuario';

        // Marcar como leído (async, no bloquear)
        if (messageId) {
          markMessageAsRead(messageId).catch(() => { /* ignorar */ });
        }

        // Por ahora solo procesamos texto; audio/imagen se puede ampliar
        if (messageType === 'text') {
          const textContent = (msg.text as Record<string, string> | undefined)?.body || '';
          if (!textContent.trim()) continue;

          const normalizedText = normalizeIncomingText(textContent);
          logInfo(`Mensaje de ${phone} (${profileName}): "${normalizedText.substring(0, 80)}"`);

          // Encolar en debouncer para agrupar ráfagas de mensajes
          messageDebouncer.addMessage(
            {
              phone,
              text: normalizedText,
              messageId,
              profileName,
              timestamp: Date.now(),
            } as DebouncerMessage,
            async (messages: DebouncerMessage[]) => {
              await handleDebouncedMessages(messages);
            },
          );
        } else if (messageType === 'audio') {
          // Audio: responder con mensaje informativo (transcripción pendiente de implementar)
          logInfo(`Audio recibido de ${phone} — respondiendo con mensaje de texto`);
          await sendMessage(
            phone,
            'Hola, por ahora solo puedo procesar mensajes de texto. ¿En qué te puedo ayudar? 😊',
          );
        } else {
          logInfo(`Tipo de mensaje no soportado: ${messageType} de ${phone}`);
        }
      }
    }
  }
}

// ============================================================================
// PROCESAR MENSAJES DEBOUNCED
// ============================================================================

async function handleDebouncedMessages(messages: DebouncerMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const phone = messages[0].phone;
  const profileName = messages[0].profileName || 'Usuario';
  const combinedText = messages.map((m) => m.text).join('\n');
  const lastMessageId = messages[messages.length - 1].messageId;

  logInfo(`Procesando ${messages.length} mensaje(s) de ${phone}: "${combinedText.substring(0, 100)}"`);

  try {
    // 1. Guardar mensaje entrante en BD
    await saveMessageToDB({
      messageId: lastMessageId,
      from: phone,
      body: combinedText,
      direction: 'inbound',
      profileName,
    });

    // 2. Verificar auto-reply
    if (process.env.WHATSAPP_AUTO_REPLY !== 'true') {
      logInfo(`Auto-reply desactivado, mensaje almacenado sin responder`);
      return;
    }

    // 3. Verificar horario de atención
    if (process.env.WHATSAPP_BUSINESS_HOURS_ONLY === 'true') {
      const colombiaNow = new Date(
        new Date().toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE }),
      );
      const hour = colombiaNow.getHours();
      const day = colombiaNow.getDay();
      const isBusinessHours =
        (day >= 1 && day <= 5 && hour >= 7 && hour < 19) ||
        (day === 6 && hour >= 8 && hour < 13);

      if (!isBusinessHours) {
        logInfo(`Fuera de horario — enviando mensaje automático a ${phone}`);
        await sendMessage(
          phone,
          'Gracias por escribirnos a Fundación Biosanar IPS. 😊\n\n' +
            'En este momento estamos fuera de nuestro horario de atención.\n' +
            'Nuestro horario es lunes a viernes de 7am a 7pm y sábados de 8am a 1pm.\n\n' +
            'Le responderemos en cuanto abramos. ¡Hasta pronto! 👋',
        );
        return;
      }
    }

    // 4. Procesar con el pipeline de IA (módulo whatsapp/index.ts)
    const WhatsAppAI = await import('../whatsapp/index');
    const result = await WhatsAppAI.processMessage(combinedText, phone, []);

    // 5. Si la IA decidió ser silenciosa, no responder
    if (!result.success || !result.response || result.silent) {
      logInfo(`Sin respuesta de IA para ${phone} (silent=${result.silent})`);
      return;
    }

    // 6. Dividir respuesta larga en chunks y enviar
    const chunks = ResponseChunker.chunkResponse(result.response, { mode: 'smart' }).chunks;
    logInfo(`Enviando ${chunks.length} chunk(s) a ${phone}`);

    for (let i = 0; i < chunks.length; i++) {
      const sendResult = await sendMessage(phone, chunks[i]);
      if (!sendResult.success) {
        logError(`Error en chunk ${i + 1}/${chunks.length} a ${phone}: ${sendResult.error}`);
      }
      // Pausa entre chunks para evitar spam
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    // 7. Guardar respuesta en BD
    await saveMessageToDB({
      messageId: `meta_out_${Date.now()}`,
      from: 'bot',
      to: phone,
      body: result.response,
      direction: 'outbound',
      aiResponse: result.response,
    });

    logInfo(`Respuesta enviada a ${phone}: "${result.response.substring(0, 80)}..."`);
  } catch (error: unknown) {
    const err = error as Error;
    logError(`Error crítico procesando mensaje de ${phone}: ${err.message}`);
    // Enviar mensaje de disculpa
    try {
      await sendMessage(
        phone,
        'Disculpa, tuve un inconveniente al procesar tu mensaje. 😔\n\n' +
          'Por favor intenta de nuevo, o llámanos al *607 691 1308*.',
      );
    } catch {
      // Ignorar errores en el fallback
    }
  }
}

// ============================================================================
// BD — Guardar mensaje (reutiliza la tabla wa_messages existente)
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
    // Sesión ficticia para Meta (no hay session_id como en Baileys)
    const metaSessionId = 'meta_cloud_api';

    await pool.execute<ResultSetHeader>(
      `INSERT INTO wa_messages
       (session_id, message_id, from_number, to_number, body, direction, status, ai_response)
       VALUES (?, ?, ?, ?, ?, ?, 'delivered', ?)
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [
        metaSessionId,
        data.messageId,
        data.from,
        data.to || null,
        data.body,
        data.direction,
        data.aiResponse || null,
      ],
    );

    // Actualizar tabla wa_conversations
    const phone = data.direction === 'inbound' ? data.from : data.to;
    if (phone) {
      await pool.execute(
        `INSERT INTO wa_conversations (session_id, phone_number, last_message, last_activity, status)
         VALUES (?, ?, ?, NOW(), 'active')
         ON DUPLICATE KEY UPDATE
           last_message = VALUES(last_message),
           last_activity = NOW(),
           status = 'active'`,
        [metaSessionId, phone, data.body.substring(0, 500)],
      );
    }
  } catch (error: unknown) {
    const err = error as Error;
    logError('Error guardando mensaje en BD', err.message);
  }
}

// ============================================================================
// EXPORT DEFAULT (interfaz compatible con WhatsAppConnection)
// ============================================================================

export default {
  isConfigured,
  getStatus,
  verifySignature,
  verifyWebhookChallenge,
  sendMessage,
  markMessageAsRead,
  processIncomingWebhook,
};
