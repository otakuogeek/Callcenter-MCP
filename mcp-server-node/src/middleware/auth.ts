import { Request, Response, NextFunction } from 'express';
import logger from '../logger-mysql';

export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const validApiKey = process.env.MCP_API_KEY || 'biosanarcall_mcp_node_2025';
  
  // Log de debugging (sin exponer la clave completa)
  logger.info('Auth attempt', {
    path: req.path,
    method: req.method,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    expectedKeyLength: validApiKey.length,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  if (!apiKey) {
    logger.warn('Auth failed: No API key provided', {
      path: req.path,
      ip: req.ip,
      headers: Object.keys(req.headers)
    });
    
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required in X-API-Key header or Authorization Bearer token',
      timestamp: new Date().toISOString(),
      help: {
        header: 'X-API-Key',
        example: 'X-API-Key: biosanarcall_mcp_node_2025',
        documentation: 'https://biosanarcall.site/mcp-node-info'
      }
    });
    return;
  }
  
  if (apiKey !== validApiKey) {
    logger.warn('Auth failed: Invalid API key', {
      path: req.path,
      ip: req.ip,
      providedKeyLength: apiKey.length,
      expectedKeyLength: validApiKey.length
    });
    
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
      timestamp: new Date().toISOString(),
      help: {
        expected: 'biosanarcall_mcp_node_2025',
        provided: (typeof apiKey === 'string' ? apiKey.substring(0, 10) : String(apiKey).substring(0, 10)) + '...',
        note: 'Verify the API key matches exactly'
      }
    });
    return;
  }
  
  logger.info('Auth successful', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  next();
}
