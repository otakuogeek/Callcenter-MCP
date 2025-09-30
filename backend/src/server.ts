import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import apiRouter from './routes';
import bootstrap from './db/bootstrap';
import path from 'path';
import fs from 'fs';
import { initializeOutboundCallManager, shutdownOutboundCallManager } from './config/outbound';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 16) {
  // Forzar configuración segura de JWT
  console.error('❌ JWT_SECRET faltante o demasiado corto (>=16 chars requerido).');
  process.exit(1);
}

const app = express();
// Si se despliega detrás de Nginx/Proxy, habilitar trust proxy para IPs y HTTPS correctos
app.set('trust proxy', true);
// CORS restringido: por defecto solo el dominio público; configurable vía CORS_ORIGINS (coma-separado)
const defaultOrigins = ['https://biosanarcall.site'];
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const origins = allowedOrigins.length ? allowedOrigins : defaultOrigins;
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // permite herramientas servidor-servidor y curl
    return origins.includes(origin) ? cb(null, true) : cb(null, false);
  },
  credentials: false,
};
app.use(cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Compresión: desactivar para streams SSE (causa errores HTTP2_PROTOCOL_ERROR si se comprimen)
app.use(compression({
  filter: (req, res) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/event-stream')) return false;
    if (req.path.endsWith('/stream')) return false;
    return compression.filter(req, res);
  },
}));
app.use(pinoHttp({ logger }));
// Rate limiting con configuración mejorada para trust proxy
if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimit({ 
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // límite por ventana de tiempo
    standardHeaders: true,
    legacyHeaders: false,
    // Deshabilitar validación permisiva de trust proxy
    validate: {
      trustProxy: false,
    },
    // Key generator personalizado para manejar IPs detrás de proxy
    keyGenerator: (req) => {
      // Usar IP del header X-Forwarded-For si está disponible
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded && typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      // Fallback a la IP de conexión directa
      return req.socket.remoteAddress || 'unknown';
    },
    skip: (req) => {
      // Omitir rate limiting para endpoints de salud y webhooks
      return req.path === '/health' || req.path === '/ready' || req.path.startsWith('/api/webhooks');
    }
  }));
}
// Responder preflight usando las mismas reglas
app.options('*', cors(corsOptions));

// Raw body parser para webhooks (antes del JSON parser)
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Health & readiness endpoints
app.get('/health', (_req, res) => res.json({ ok: true, service: 'backend', time: new Date().toISOString() }));
app.get('/ready', (_req, res) => res.json({ ready: true }));

// Serve archivos subidos
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Servir archivos estáticos del dashboard
const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use('/dashboard', express.static(publicDir));

// Inicializaciones DB ligeras (no bloqueantes si fallan)
// Montar rutas inmediatamente
app.use('/api', apiRouter);
// Fallback endpoints returning empty responses
app.get('/api/especialidades', (_req, res) => res.json([]));
app.get('/api/ubicaciones', (_req, res) => res.json([]));
app.get('/api/zonas', (_req, res) => res.json([]));
app.get('/api/municipios', (_req, res) => res.json([]));
app.get('/api/servicios', (_req, res) => res.json([]));
app.get('/api/eps', (_req, res) => res.json([]));

// Inicializar OutboundCallManager si está habilitado
if (process.env.OUTBOUND_ENABLED === 'true') {
  initializeOutboundCallManager()
    .then((manager) => {
      app.locals.outboundManager = manager;
      logger.info('OutboundCallManager initialized and attached to app');
    })
    .catch((error) => {
      logger.error({ error }, 'Failed to initialize OutboundCallManager');
    });
}

// 404 handler (después de montar rutas /api)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Not Found', path: req.path });
  }
  next();
});

// Inicializaciones DB ligeras (no bloqueantes si fallan)
bootstrap().catch(() => {/* ignora errores de bootstrap para no bloquear el arranque */});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const host = process.env.HOST || '0.0.0.0';
// Central error handler (fallback)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(port, host as any, () => {
  logger.info({ port, host, origins }, 'API listening');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await shutdownOutboundCallManager();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await shutdownOutboundCallManager();
  process.exit(0);
});
