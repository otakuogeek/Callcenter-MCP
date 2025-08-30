import express from 'express';
import cors from 'cors';
import logger from './src/logger-mysql';
import mcpMysqlRoutes from './src/routes/mcp-mysql';
import mcpCompleteRoutes from './src/routes/mcp-complete';
import { testDbConnection } from './src/db/mysql';

const app = express();
const PORT = process.env.PORT || 8976;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/api', mcpMysqlRoutes);
app.use('/api', mcpCompleteRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Biosanarcall MCP Node.js Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/health - Health check',
      'POST /api/elevenlabs - MCP para ElevenLabs (3 tools)',
      'POST /api/mcp-simple - MCP simple (6 tools)',
      'POST /api/mcp-complete - MCP completo (15+ tools)',
      'POST /api/mcp-demo - MCP demo sin autenticación',
      'GET /api/tools - Lista de tools disponibles'
    ],
    features: [
      'Conexión directa MySQL',
      'Optimizado para ElevenLabs',
      'Autenticación API Key',
      'Logging estructurado'
    ]
  });
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testDbConnection();
    if (!dbConnected) {
      logger.warn('Database connection failed, but starting server anyway');
    } else {
      logger.info('Database connection successful');
    }

    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`, {
        port: PORT,
        database: dbConnected ? 'connected' : 'disconnected',
        endpoints: ['/api/elevenlabs', '/api/mcp-simple', '/api/health']
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

startServer();
