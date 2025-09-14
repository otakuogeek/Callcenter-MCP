import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { WhatsAppAgent } from './services/WhatsAppAgent';
import { Logger } from './utils/Logger';
import { whatsappRateLimit } from './middleware/rateLimiter';
import { ErrorHandler } from './middleware/errorHandler';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const logger = Logger.getInstance();

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://biosanarcall.site'] 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Middleware para parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(whatsappRateLimit);

// Logging de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' ? req.body : undefined
  });
  next();
});

// Inicializar el agente de WhatsApp
const whatsappAgent = new WhatsAppAgent();

// Rutas principales
app.get('/', (req, res) => {
  res.json({
    service: 'Biosanarcall WhatsApp Agent',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      webhook: '/webhook (POST)',
      health: '/health (GET)',
      stats: '/stats (GET)',
      conversations: '/conversations (GET)'
    },
    integration: {
      twilio: 'configured',
      openai: 'configured',
      mcp_server: process.env.MCP_SERVER_URL,
      domain: 'https://whatsapp.biosanarcall.site'
    },
    documentation: 'https://github.com/otakuogeek/Callcenter-MCP'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Verificación del webhook (GET request)
app.get('/webhook', (req, res) => {
  logger.info('Verificación webhook recibida', { 
    query: req.query, 
    headers: req.headers 
  });
  res.status(200).send('Webhook verificado correctamente');
});

app.get('/webhook/whatsapp', (req, res) => {
  logger.info('Verificación webhook WhatsApp recibida', { 
    query: req.query, 
    headers: req.headers 
  });
  res.status(200).send('Webhook WhatsApp verificado correctamente');
});

// Webhook específico para status de entrega de Twilio
app.post('/webhook/status', (req, res) => {
  logger.info('Status de entrega recibido', { 
    status: req.body.MessageStatus || req.body.SmsStatus,
    messageId: req.body.MessageSid,
    to: req.body.To
  });
  res.status(200).send('OK');
});

// Webhook de Twilio para mensajes entrantes de WhatsApp
app.post('/webhook', async (req, res): Promise<void> => {
  try {
    logger.info('Webhook WhatsApp recibido', { body: req.body });
    
    const { 
      From, 
      Body, 
      MessageSid, 
      ProfileName,
      NumMedia,
      MediaUrl0,
      MediaContentType0,
      MessageStatus,
      SmsStatus
    } = req.body;
    
    // Filtrar webhooks de status de entrega (sent, delivered, read) - NO "received"
    // "received" indica mensaje entrante, no status de entrega
    if ((MessageStatus && MessageStatus !== 'received') || 
        (SmsStatus && SmsStatus !== 'received' && SmsStatus !== 'queued')) {
      logger.info('Webhook de status de entrega recibido - redirigiendo', { 
        status: MessageStatus || SmsStatus,
        from: From,
        messageId: MessageSid
      });
      res.status(200).send('OK');
      return;
    }
    
    if (!From || !Body) {
      logger.warn('Webhook incompleto - falta remitente o mensaje', { body: req.body });
      res.status(400).send('Datos incompletos');
      return;
    }

    // Verificar que el From no sea nuestro propio número (evitar loops)
    if (From === process.env.TWILIO_WHATSAPP_NUMBER) {
      logger.info('Mensaje de nuestro propio número - ignorando para evitar loop');
      res.status(200).send('OK');
      return;
    }

    // Detectar tipo de mensaje
    const hasMedia = NumMedia && parseInt(NumMedia) > 0;
    const isVoiceMessage = hasMedia && MediaContentType0 && 
      (MediaContentType0.includes('audio') || MediaContentType0.includes('ogg'));
    
    logger.info('Tipo de mensaje detectado', {
      from: From,
      hasMedia,
      isVoiceMessage,
      mediaType: MediaContentType0,
      bodyLength: Body?.length || 0
    });

    // Procesar mensaje con el agente
    const response = await whatsappAgent.processIncomingMessage({
      from: From,
      body: Body,
      messageId: MessageSid,
      profileName: ProfileName || 'Usuario',
      timestamp: new Date(),
      isVoiceMessage: isVoiceMessage,
      mediaUrl: MediaUrl0,
      mediaContentType: MediaContentType0
    });

    logger.info('Respuesta enviada', { 
      from: From, 
      responseLength: response?.length || 0 
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error procesando webhook WhatsApp', { error });
    res.status(500).send('Error interno');
  }
});

// Webhook de Twilio para mensajes entrantes de WhatsApp (alternativo)
app.post('/webhook/whatsapp', async (req, res): Promise<void> => {
  try {
    logger.info('Webhook WhatsApp recibido', { body: req.body });
    
    const { From, Body, MessageSid, ProfileName } = req.body;
    
    if (!From || !Body) {
      logger.warn('Webhook incompleto recibido', { body: req.body });
      res.status(400).send('Datos incompletos');
      return;
    }

    // Procesar mensaje con el agente
    const response = await whatsappAgent.processIncomingMessage({
      from: From,
      body: Body,
      messageId: MessageSid,
      profileName: ProfileName || 'Usuario',
      timestamp: new Date(),
      isVoiceMessage: false,
      mediaUrl: undefined,
      mediaContentType: undefined
    });

    logger.info('Respuesta enviada', { 
      from: From, 
      responseLength: response?.length || 0 
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error procesando webhook WhatsApp', { error });
    res.status(500).send('Error interno');
  }
});

// Endpoint para envío manual de mensajes (testing)
app.post('/send-message', async (req, res): Promise<void> => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      res.status(400).json({
        error: 'Faltan parámetros requeridos: to, message'
      });
      return;
    }

    const result = await whatsappAgent.sendMessage(to, message);
    
    res.json({
      success: true,
      messageId: result.sid,
      to: to,
      message: message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error enviando mensaje manual', { error });
    res.status(500).json({
      error: 'Error enviando mensaje',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Endpoint de status para callbacks de Twilio
app.get('/status', (req, res) => {
  logger.info('Status callback recibido', { 
    query: req.query, 
    headers: req.headers 
  });
  res.status(200).send('Status callback procesado');
});

app.post('/status', (req, res) => {
  logger.info('Status callback POST recibido', { 
    body: req.body, 
    headers: req.headers 
  });
  res.status(200).send('Status callback procesado');
});

// Endpoint para estadísticas del agente
app.get('/stats', async (req, res) => {
  try {
    const stats = await whatsappAgent.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error obteniendo estadísticas', { error });
    res.status(500).json({
      error: 'Error obteniendo estadísticas'
    });
  }
});

// Endpoint para configuración del agente
app.get('/config', (req, res) => {
  res.json({
    twilioConfigured: !!process.env.TWILIO_ACCOUNT_SID,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    mcpServerUrl: process.env.MCP_SERVER_URL,
    maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH || '50'),
    responseTimeout: parseInt(process.env.RESPONSE_TIMEOUT || '30000'),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000')
  });
});

// Middleware de manejo de errores
app.use(ErrorHandler.handle());

// Manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method
  });
});

// Iniciar servidor
async function startServer() {
  try {
    // Inicializar el agente de WhatsApp
    await whatsappAgent.initialize();
    
    app.listen(PORT, () => {
      logger.info(`🚀 Servidor WhatsApp Agent iniciado`, {
        port: PORT,
        environment: process.env.NODE_ENV,
        features: [
          'Twilio WhatsApp ✅',
          'ChatGPT AI ✅',
          'MCP Integration ✅'
        ]
      });
      
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                🏥 BIOSANARCALL WHATSAPP AGENT                ║
╠══════════════════════════════════════════════════════════════╣
║  Puerto: ${PORT}                                          ║
║  Webhook: http://localhost:${PORT}/webhook/whatsapp          ║
║  Health: http://localhost:${PORT}/health                     ║
║  Stats: http://localhost:${PORT}/stats                       ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Error iniciando servidor', { error });
    process.exit(1);
  }
}

// Manejo de señales del sistema
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido, cerrando servidor...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// Iniciar aplicación
startServer();