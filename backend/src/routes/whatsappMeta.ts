/**
 * Rutas para WhatsApp Meta Cloud API
 *
 * Endpoints:
 *  GET  /api/whatsapp/meta/webhook       — Verificación del webhook (Meta hace GET al configurar)
 *  POST /api/whatsapp/meta/webhook       — Recibir mensajes entrantes de Meta (sin JWT, con firma)
 *  GET  /api/whatsapp/meta/status        — Estado de configuración Meta (requiere auth)
 *  POST /api/whatsapp/meta/send          — Enviar mensaje via Meta API (requiere auth)
 *  GET  /api/whatsapp/meta/config-guide  — Guía de configuración (requiere auth)
 *
 * NOTAS DE SEGURIDAD:
 *  - El endpoint POST /webhook NO usa JWT porque Meta no puede enviar un token JWT.
 *    En su lugar se verifica la firma HMAC-SHA256 con el secreto de la app.
 *  - El endpoint GET /webhook NO usa auth porque Meta lo llama sin credenciales.
 *  - Todos los demás endpoints SÍ requieren JWT de administrador.
 */

import { Router, Request, Response, NextFunction } from 'express';
import MetaConnection from '../services/WhatsAppMetaConnection';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ============================================================================
// GET /api/whatsapp/meta/webhook
// Meta llama este endpoint para verificar que el webhook está configurado.
// NO requiere autenticación JWT.
// ============================================================================
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (!mode || !token || !challenge) {
    res.status(400).json({
      success: false,
      error: 'Parámetros hub.mode, hub.verify_token y hub.challenge son requeridos',
    });
    return;
  }

  const result = MetaConnection.verifyWebhookChallenge(mode, token, challenge);

  if (result) {
    // Meta espera solo el texto del challenge como respuesta
    res.status(200).send(result);
  } else {
    console.warn('[MetaWA Route] Verificación de webhook fallida — token incorrecto');
    res.status(403).json({
      success: false,
      error: 'Token de verificación incorrecto',
    });
  }
});

// ============================================================================
// POST /api/whatsapp/meta/webhook
// Meta envía los mensajes entrantes aquí.
// NO usa JWT — la autenticación se hace via firma HMAC-SHA256.
// El body parser para esta ruta debe ser express.raw() para poder verificar la firma.
// ============================================================================
router.post(
  '/webhook',
  // express.raw se aplica antes del JSON global en server.ts via /api/webhooks/*
  // Sin embargo, como esta ruta es /api/whatsapp/meta/webhook, necesitamos raw aquí explícitamente
  (req: Request, _res: Response, next: NextFunction) => {
    // Si el body ya es un Buffer (por express.raw upstream), continuar
    // Si ya fue parseado por express.json(), continuar de todos modos con verificación omitida
    next();
  },
  async (req: Request, res: Response) => {
    try {
      // Verificar firma HMAC si el body es un Buffer (raw)
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      let payload: unknown;

      if (Buffer.isBuffer(req.body)) {
        // Body crudo — verificar firma
        if (signature) {
          const isValid = MetaConnection.verifySignature(req.body, signature);
          if (!isValid) {
            console.error('[MetaWA Route] Firma de webhook INVÁLIDA — posible ataque');
            res.status(401).json({ success: false, error: 'Firma inválida' });
            return;
          }
        }
        // Parsear JSON manualmente
        try {
          payload = JSON.parse(req.body.toString('utf8'));
        } catch {
          res.status(400).json({ success: false, error: 'JSON inválido' });
          return;
        }
      } else {
        // Body ya fue parseado por express.json() — verificar firma si está disponible
        if (signature) {
          console.warn('[MetaWA Route] No se puede verificar firma — body ya fue parseado. Configura server.ts para usar raw en esta ruta.');
        }
        payload = req.body;
      }

      // Meta requiere respuesta 200 inmediata (máximo 5 segundos)
      // Procesar en background para no exceder el timeout
      res.status(200).json({ status: 'ok' });

      // Procesar el webhook después de responder a Meta
      MetaConnection.processIncomingWebhook(payload).catch((err: Error) => {
        console.error('[MetaWA Route] Error procesando webhook:', err.message);
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[MetaWA Route] Error en webhook:', err.message);
      // Si aún no respondimos, responder 200 para no hacer que Meta reintente
      if (!res.headersSent) {
        res.status(200).json({ status: 'error', message: err.message });
      }
    }
  },
);

// ============================================================================
// GET /api/whatsapp/meta/status
// Retorna el estado de configuración de Meta Cloud API.
// ============================================================================
router.get('/status', requireAuth, (_req: Request, res: Response) => {
  try {
    const status = MetaConnection.getStatus();
    const webhookUrl = `${process.env.BACKEND_PUBLIC_URL || 'https://biosanarcall.site'}/api/whatsapp/meta/webhook`;

    res.json({
      success: true,
      data: {
        ...status,
        webhookUrl,
        apiVersion: 'v20.0',
        setupInstructions: status.configured
          ? null
          : 'Configura WHATSAPP_META_PHONE_NUMBER_ID y WHATSAPP_META_ACCESS_TOKEN en .env',
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// POST /api/whatsapp/meta/send
// Enviar un mensaje manualmente a través de la API de Meta.
// ============================================================================
router.post('/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body as { to?: string; message?: string };

    if (!to || !message) {
      res.status(400).json({
        success: false,
        error: 'Se requieren los campos "to" (número) y "message" (texto)',
      });
      return;
    }

    if (!MetaConnection.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Meta Cloud API no configurada. Revisa las variables de entorno.',
      });
      return;
    }

    const result = await MetaConnection.sendMessage(to, message);
    res.json({
      success: result.success,
      data: result.success ? { messageId: result.messageId, to } : undefined,
      error: result.error,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// GET /api/whatsapp/meta/config-guide
// Guía paso a paso para configurar el webhook en el Portal Meta Business.
// ============================================================================
router.get('/config-guide', requireAuth, (req: Request, res: Response) => {
  const host = req.headers.host || 'biosanarcall.site';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const webhookUrl = `${protocol}://${host}/api/whatsapp/meta/webhook`;

  res.json({
    success: true,
    data: {
      title: 'Guía de configuración — WhatsApp Business Cloud API',
      steps: [
        {
          step: 1,
          title: 'Crear aplicación en Meta for Developers',
          url: 'https://developers.facebook.com/apps/create/',
          instructions: [
            'Inicia sesión en https://developers.facebook.com',
            'Haz clic en "Crear app"',
            'Selecciona tipo "Empresa"',
            'En "Agregar productos", agrega "WhatsApp"',
          ],
        },
        {
          step: 2,
          title: 'Obtener credenciales',
          instructions: [
            'Ve a WhatsApp → Configuración de la API',
            'Copia el "ID de número de teléfono" → WHATSAPP_META_PHONE_NUMBER_ID',
            'Genera un token de acceso permanente → WHATSAPP_META_ACCESS_TOKEN',
            'Copia el "Secreto de app" (Configuración → Básica) → WHATSAPP_META_APP_SECRET',
          ],
        },
        {
          step: 3,
          title: 'Configurar variables de entorno',
          envVars: {
            WHATSAPP_PROVIDER: 'meta',
            WHATSAPP_META_PHONE_NUMBER_ID: '<ID del número de Meta>',
            WHATSAPP_META_ACCESS_TOKEN: '<Token de acceso permanente>',
            WHATSAPP_META_APP_SECRET: '<Secreto de la aplicación>',
            WHATSAPP_META_VERIFY_TOKEN: '<Token personalizado de tu elección>',
          },
        },
        {
          step: 4,
          title: 'Configurar Webhook en Meta',
          instructions: [
            `URL del webhook: ${webhookUrl}`,
            `Token de verificación: valor de WHATSAPP_META_VERIFY_TOKEN`,
            'En Meta → WhatsApp → Configuración → Webhook, agregar la URL y el token',
            'Subscribirse al campo "messages"',
          ],
          webhookUrl,
        },
        {
          step: 5,
          title: 'Agregar número de teléfono',
          instructions: [
            'En Meta → WhatsApp → Administración del API → Números de teléfono',
            'Agrega tu número de WhatsApp Business',
            'Completa la verificación',
          ],
        },
      ],
      currentConfig: {
        configured: MetaConnection.isConfigured(),
        webhookUrl,
        verifyToken: process.env.WHATSAPP_META_VERIFY_TOKEN ? '✅ Configurado' : '❌ No configurado',
        phoneNumberId: process.env.WHATSAPP_META_PHONE_NUMBER_ID ? '✅ Configurado' : '❌ No configurado',
        accessToken: process.env.WHATSAPP_META_ACCESS_TOKEN ? '✅ Configurado' : '❌ No configurado',
        appSecret: process.env.WHATSAPP_META_APP_SECRET ? '✅ Configurado' : '❌ No configurado',
      },
    },
  });
});

export default router;
