import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { VoiceCallHandler } from './services/VoiceCallHandler';
import { VoiceAssistantService } from './services/VoiceAssistantService';
import { ElevenLabsHandler } from './services/ElevenLabsHandler';
import { SipVoiceIntegration } from './services/SipVoiceIntegration';
import { SipProxyServer } from './services/SipProxyServer';
import { ZadarmaCallEvent } from './types';
import { ZadarmaClient } from './services/ZadarmaClient';

// Cargar variables de entorno
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Instancia global del manejador de llamadas
const voiceHandler = new VoiceCallHandler();
const voiceAssistant = new VoiceAssistantService();
const elevenLabsHandler = new ElevenLabsHandler();

// Configuración SIP para Zadarma
const sipConfig = {
  sip: {
    server: process.env.ZADARMA_SIP_SERVER || 'sip.zadarma.com',
    port: parseInt(process.env.ZADARMA_SIP_PORT || '5060'),
    username: process.env.ZADARMA_SIP_USERNAME || process.env.ZADARMA_KEY || '',
    password: process.env.ZADARMA_SIP_PASSWORD || process.env.ZADARMA_SECRET || '',
    realm: process.env.ZADARMA_SIP_REALM || 'zadarma.com'
  },
  voice: {
    autoAnswer: process.env.SIP_AUTO_ANSWER === 'true',
    greetingMessage: process.env.SIP_GREETING || '',
    transcriptionEnabled: process.env.SIP_TRANSCRIPTION === 'true'
  }
};

// Inicializar integración SIP (opcional)
let sipVoiceIntegration: SipVoiceIntegration | null = null;
if (process.env.SIP_ENABLED === 'true') {
  sipVoiceIntegration = new SipVoiceIntegration(sipConfig);
}

// Inicializar servidor SIP Proxy (opcional)
let sipProxyServer: SipProxyServer | null = null;
if (process.env.SIP_PROXY_ENABLED === 'true') {
  const sipPort = parseInt(process.env.SIP_PROXY_PORT || '5060');
  const sipHost = process.env.SIP_PROXY_HOST || '0.0.0.0';
  sipProxyServer = new SipProxyServer(sipPort, sipHost, voiceAssistant);
  
  console.log(`[Server] 🌐 Servidor SIP Proxy configurado en ${sipHost}:${sipPort}`);
}

// Cliente Zadarma con autenticación correcta
const zadarmaClient = new ZadarmaClient(
  process.env.ZADARMA_KEY || '',
  process.env.ZADARMA_SECRET || '',
  false // production
);

// Middleware de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting para webhooks
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requests por minuto
  message: 'Demasiadas solicitudes de webhook'
});

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static('public'));

// Middleware para logs
app.use((req, res, next) => {
  console.log(`[Server] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Ruta principal - redirigir al asistente de voz
 */
app.get('/', (req, res) => {
  res.redirect('/voice-assistant.html');
});

/**
 * Endpoint GET para validación de webhook de Zadarma
 * Zadarma envía un GET request con parámetro zd_echo para validar el webhook
 */
app.get('/webhook/zadarma', (req, res): any => {
  try {
    console.log('[Webhook] Validación GET de Zadarma:', req.query);
    
    // Si viene el parámetro zd_echo, lo devolvemos (validación de Zadarma)
    if (req.query.zd_echo) {
      const echo = req.query.zd_echo as string;
      console.log('[Webhook] Respondiendo zd_echo:', echo);
      return res.status(200).send(echo);
    }
    
    // Respuesta por defecto para verificación de salud
    res.status(200).json({
      success: true,
      message: 'Webhook de Zadarma operativo',
      timestamp: new Date().toISOString(),
      service: 'voice-call-service'
    });
  } catch (error) {
    console.error('[Webhook] Error en validación GET:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Webhook principal de Zadarma para eventos de llamadas
 */
app.post('/webhook/zadarma', webhookLimiter, async (req, res) => {
  try {
    console.log('[Webhook] Evento recibido de Zadarma:', req.body);
    console.log('[Webhook] Headers:', req.headers);

    const event: ZadarmaCallEvent = req.body;
    
    // Validar evento requerido
    if (!event.event) {
      return res.status(400).json({
        success: false,
        error: 'Evento inválido: falta campo event'
      });
    }

    // Validar firma del webhook (temporalmente deshabilitado)
    const signature = req.headers['signature'] as string;
    if (signature && process.env.ZADARMA_SECRET && false) { // Deshabilitado temporalmente
      const isValidSignature = zadarmaClient.validateWebhookSignature(event, signature);
      if (!isValidSignature) {
        console.warn('[Webhook] Firma inválida');
        return res.status(401).json({
          success: false,
          error: 'Firma de webhook inválida'
        });
      }
    }
    
    // Por ahora, solo logeamos la firma para debug
    if (signature) {
      console.log('[Webhook] Firma recibida:', signature);
    }

    // Procesar según tipo de evento
    switch (event.event) {
      case 'NOTIFY_START':
        await voiceHandler.handleCallStart(event);
        // Iniciar asistente de voz automáticamente
        if (process.env.VOICE_ASSISTANT_ENABLED === 'true') {
          await voiceAssistant.handleIncomingCall(event);
        }
        break;
        
      case 'NOTIFY_END':
        await voiceHandler.handleCallEnd(event);
        break;
        
      case 'NOTIFY_RECORD':
        // Procesar grabación cuando esté disponible
        if (event.call_id_with_rec) {
          const recordingUrl = await getRecordingUrl(event.call_id_with_rec);
          if (recordingUrl) {
            const result = await voiceHandler.handleCallRecording(event, recordingUrl);
            console.log('[Webhook] Resultado procesamiento:', result);
          }
        }
        break;
        
      case 'NOTIFY_ANSWER':
        console.log(`[Webhook] Llamada respondida: ${event.pbx_call_id}`);
        break;
        
      default:
        console.warn(`[Webhook] Evento no manejado: ${event.event}`);
    }

    return res.json({
      success: true,
      message: 'Evento procesado correctamente'
    });

  } catch (error: any) {
    console.error('[Webhook] Error procesando evento:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Endpoint para obtener grabación de Zadarma
 */
async function getRecordingUrl(callId: string): Promise<string | null> {
  try {
    console.log(`[Recording] Obteniendo URL de grabación para call_id: ${callId}`);
    
    if (!process.env.ZADARMA_KEY || !process.env.ZADARMA_SECRET) {
      console.warn('[Recording] Credenciales de Zadarma no configuradas');
      return null;
    }

    // Usar el cliente Zadarma con autenticación correcta
    const recordingResponse = await zadarmaClient.getPbxRecord(callId);
    
    if (recordingResponse && recordingResponse.link) {
      console.log(`[Recording] URL de grabación obtenida: ${recordingResponse.link}`);
      return recordingResponse.link;
    } else {
      console.warn('[Recording] No se encontró URL de grabación en la respuesta');
      return null;
    }

  } catch (error: any) {
    console.error('[Recording] Error obteniendo URL de grabación:', error.message);
    return null;
  }
}

/**
 * ENDPOINTS PARA ASISTENTE DE VOZ
 */

/**
 * Webhook de ElevenLabs para conversaciones
 */
app.post('/webhook/elevenlabs', async (req, res) => {
  try {
    console.log('[ElevenLabs] Webhook recibido:', req.body);
    
    // Validar firma del webhook
    const signature = req.headers['x-elevenlabs-signature'] as string;
    const payload = JSON.stringify(req.body);
    
    if (signature && !elevenLabsHandler.validateWebhook(payload, signature)) {
      return res.status(401).json({
        success: false,
        error: 'Firma de webhook inválida'
      });
    }

    // Procesar evento de ElevenLabs
    const result = await elevenLabsHandler.processWebhook(req.body);
    
    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('[ElevenLabs] Error procesando webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Endpoint para iniciar conversación de voz manualmente
 */
app.post('/voice/start-conversation', async (req, res) => {
  try {
    const { call_id, caller_number } = req.body;
    
    if (!call_id) {
      return res.status(400).json({
        success: false,
        error: 'call_id requerido'
      });
    }

    const callData = {
      pbx_call_id: call_id,
      caller_id: caller_number,
      event: 'MANUAL_START'
    };

    const result = await voiceAssistant.handleIncomingCall(callData);
    
    return res.json({
      success: true,
      message: 'Conversación iniciada',
      data: result
    });

  } catch (error: any) {
    console.error('[Voice] Error iniciando conversación:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint para procesar audio del usuario
 */
app.post('/voice/process-speech', async (req, res) => {
  try {
    const { call_id, audio_data } = req.body;
    
    if (!call_id || !audio_data) {
      return res.status(400).json({
        success: false,
        error: 'call_id y audio_data requeridos'
      });
    }

    const response = await voiceAssistant.processUserSpeech(audio_data, call_id);
    
    return res.json({
      success: true,
      response: response
    });

  } catch (error: any) {
    console.error('[Voice] Error procesando audio:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint para finalizar conversación
 */
app.post('/voice/end-conversation', async (req, res) => {
  try {
    const { call_id, reason } = req.body;
    
    if (!call_id) {
      return res.status(400).json({
        success: false,
        error: 'call_id requerido'
      });
    }

    await voiceAssistant.endCall(call_id, reason || 'user_ended');
    
    return res.json({
      success: true,
      message: 'Conversación finalizada'
    });

  } catch (error: any) {
    console.error('[Voice] Error finalizando conversación:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ENDPOINTS PARA SIP DIRECTO
 */

/**
 * Iniciar servicio SIP
 */
app.post('/sip/start', async (req, res) => {
  try {
    if (!sipVoiceIntegration) {
      return res.status(400).json({
        success: false,
        error: 'SIP no está habilitado. Configure SIP_ENABLED=true'
      });
    }

    await sipVoiceIntegration.start();
    
    return res.json({
      success: true,
      message: 'Servicio SIP iniciado exitosamente',
      status: sipVoiceIntegration.getStatus()
    });

  } catch (error: any) {
    console.error('[SIP] Error iniciando servicio:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Detener servicio SIP
 */
app.post('/sip/stop', async (req, res) => {
  try {
    if (!sipVoiceIntegration) {
      return res.status(400).json({
        success: false,
        error: 'SIP no está habilitado'
      });
    }

    sipVoiceIntegration.stop();
    
    return res.json({
      success: true,
      message: 'Servicio SIP detenido'
    });

  } catch (error: any) {
    console.error('[SIP] Error deteniendo servicio:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Estado del servicio SIP
 */
app.get('/sip/status', (req, res) => {
  try {
    if (!sipVoiceIntegration) {
      return res.json({
        success: true,
        sipEnabled: false,
        message: 'SIP no está habilitado'
      });
    }

    const status = sipVoiceIntegration.getStatus();
    
    return res.json({
      success: true,
      sipEnabled: true,
      ...status
    });

  } catch (error: any) {
    console.error('[SIP] Error obteniendo estado:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Colgar llamada SIP específica
 */
app.post('/sip/hangup/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!sipVoiceIntegration) {
      return res.status(400).json({
        success: false,
        error: 'SIP no está habilitado'
      });
    }

    await sipVoiceIntegration.hangupCall(callId);
    
    return res.json({
      success: true,
      message: `Llamada ${callId} terminada`
    });

  } catch (error: any) {
    console.error('[SIP] Error colgando llamada:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ENDPOINTS DE ESTADÍSTICAS Y BÚSQUEDA
 */

/**
 * Endpoint para estadísticas de llamadas
 */
app.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const stats = await voiceHandler.getCallStatistics(days);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[Stats] Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas'
    });
  }
});

/**
 * Endpoint para buscar llamadas
 */
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro de búsqueda requerido'
      });
    }

    const results = await voiceHandler.searchCalls(query, limit);
    
    return res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('[Search] Error en búsqueda:', error);
    return res.status(500).json({
      success: false,
      error: 'Error en búsqueda'
    });
  }
});

/**
 * Endpoint para obtener sesión activa
 */
app.get('/session/:callId', (req, res) => {
  try {
    const callId = req.params.callId;
    const session = voiceHandler.getActiveSession(callId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }

    return res.json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('[Session] Error obteniendo sesión:', error);
    return res.status(500).json({
      success: false,
      error: 'Error obteniendo sesión'
    });
  }
});

/**
 * Endpoint de salud del servicio
 */
app.get('/health', async (req, res) => {
  try {
    const services = await voiceHandler.validateServices();
    
    // Verificar conectividad con Zadarma
    let zadarmaStatus = false;
    try {
      if (process.env.ZADARMA_KEY && process.env.ZADARMA_SECRET) {
        const balance = await zadarmaClient.getBalance();
        zadarmaStatus = !!balance;
      }
    } catch (error) {
      console.warn('[Health] Zadarma API no disponible:', error);
    }
    
    const allServices = {
      ...services,
      zadarma: zadarmaStatus
    };
    
    const allHealthy = Object.values(allServices).every(status => status);
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      services: allServices,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    });

  } catch (error: any) {
    console.error('[Health] Error verificando salud:', error);
    res.status(500).json({
      success: false,
      error: 'Error verificando salud del servicio'
    });
  }
});

/**
 * Endpoint para probar la API de Zadarma
 */
app.get('/api/zadarma/test', async (req, res) => {
  try {
    if (!process.env.ZADARMA_KEY || !process.env.ZADARMA_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Credenciales de Zadarma no configuradas'
      });
    }

    // Probar balance
    const balance = await zadarmaClient.getBalance();
    
    // Probar SIP
    const sipInfo = await zadarmaClient.getSip();

    return res.json({
      success: true,
      data: {
        balance,
        sip: sipInfo,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[API] Error probando Zadarma:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint para obtener estadísticas de Zadarma
 */
app.get('/api/zadarma/statistics', async (req, res) => {
  try {
    const statistics = await zadarmaClient.getStatistics();
    
    return res.json({
      success: true,
      data: statistics
    });

  } catch (error: any) {
    console.error('[API] Error obteniendo estadísticas:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Servir archivos de audio estáticos
 */
app.use('/audio', express.static('./audio-output'));

/**
 * Rutas del servidor SIP Proxy
 */
app.get('/api/sip-proxy/status', (req, res) => {
  if (!sipProxyServer) {
    return res.json({
      success: false,
      error: 'Servidor SIP Proxy no está habilitado'
    });
  }

  const status = sipProxyServer.getStatus();
  return res.json({
    success: true,
    data: status
  });
});

app.post('/api/sip-proxy/start', async (req, res) => {
  if (!sipProxyServer) {
    return res.status(400).json({
      success: false,
      error: 'Servidor SIP Proxy no está configurado'
    });
  }

  try {
    await sipProxyServer.start();
    return res.json({
      success: true,
      message: 'Servidor SIP Proxy iniciado correctamente'
    });
  } catch (error: any) {
    console.error('[API] Error iniciando SIP Proxy:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/sip-proxy/stop', async (req, res) => {
  if (!sipProxyServer) {
    return res.status(400).json({
      success: false,
      error: 'Servidor SIP Proxy no está configurado'
    });
  }

  try {
    await sipProxyServer.stop();
    return res.json({
      success: true,
      message: 'Servidor SIP Proxy detenido correctamente'
    });
  } catch (error: any) {
    console.error('[API] Error deteniendo SIP Proxy:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Manejo de errores globales
 */
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] Error no manejado:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

/**
 * Manejo de rutas no encontradas
 */
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado'
  });
});

/**
 * Iniciar servidor
 */
const server = app.listen(PORT, async () => {
  console.log(`[Server] Servicio de llamadas de voz ejecutándose en puerto ${PORT}`);
  console.log(`[Server] Webhook endpoint: http://localhost:${PORT}/webhook/zadarma`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  
  // Auto-iniciar SIP si está habilitado
  if (sipVoiceIntegration && process.env.SIP_AUTO_START === 'true') {
    try {
      console.log('[Server] 🚀 Auto-iniciando servicio SIP...');
      await sipVoiceIntegration.start();
      console.log('[Server] ✅ Servicio SIP iniciado exitosamente');
    } catch (error) {
      console.error('[Server] ❌ Error auto-iniciando SIP:', error);
    }
  }
  
  // Auto-iniciar servidor SIP Proxy si está habilitado
  if (sipProxyServer && process.env.SIP_PROXY_AUTO_START === 'true') {
    try {
      console.log('[Server] 🌐 Auto-iniciando servidor SIP Proxy...');
      await sipProxyServer.start();
      console.log('[Server] ✅ Servidor SIP Proxy iniciado exitosamente');
    } catch (error) {
      console.error('[Server] ❌ Error auto-iniciando SIP Proxy:', error);
    }
  }
});

/**
 * Manejo de señales de cierre
 */
process.on('SIGTERM', async () => {
  console.log('[Server] Recibida señal SIGTERM, cerrando servidor...');
  server.close(async () => {
    if (sipVoiceIntegration) {
      sipVoiceIntegration.stop();
    }
    if (sipProxyServer) {
      await sipProxyServer.stop();
    }
    await voiceHandler.cleanup();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('[Server] Recibida señal SIGINT, cerrando servidor...');
  server.close(async () => {
    if (sipVoiceIntegration) {
      sipVoiceIntegration.stop();
    }
    if (sipProxyServer) {
      await sipProxyServer.stop();
    }
    await voiceHandler.cleanup();
    process.exit(0);
  });
});

export default app;