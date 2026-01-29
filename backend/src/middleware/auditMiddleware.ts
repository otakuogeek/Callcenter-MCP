/**
 * 🔒 MIDDLEWARE DE AUDITORÍA - BIOSANAR IPS
 * 
 * Captura automáticamente las acciones de usuarios en endpoints API.
 */

import { Request, Response, NextFunction } from 'express';
import { logAudit, AuditActionType } from '../services/auditService';

// Usar any para evitar conflictos con el tipo AuthPayload existente
interface AuthenticatedRequest extends Request {
  user?: any;
}

// Mapeo de métodos HTTP a tipos de acción
function getActionType(method: string, path: string): AuditActionType {
  // Casos especiales primero
  if (path.includes('/login')) return 'LOGIN';
  if (path.includes('/logout')) return 'LOGOUT';
  if (path.includes('/password')) return 'PASSWORD_CHANGE';
  if (path.includes('/sms')) return 'SMS_SENT';
  if (path.includes('/email') || path.includes('/mail')) return 'EMAIL_SENT';
  if (path.includes('/call')) return 'CALL_INITIATED';
  if (path.includes('/whatsapp')) return 'WHATSAPP_SENT';
  if (path.includes('/export')) return 'EXPORT';
  if (path.includes('/import')) return 'IMPORT';
  if (path.includes('/upload')) return 'UPLOAD';
  
  // Por método HTTP
  switch (method.toUpperCase()) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return 'OTHER';
  }
}

// Determina el tipo de entidad desde la ruta
function getEntityType(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  
  // Buscar después de 'api'
  const apiIndex = parts.indexOf('api');
  if (apiIndex >= 0 && parts[apiIndex + 1]) {
    // Singularizar el nombre
    let entity = parts[apiIndex + 1];
    if (entity.endsWith('ies')) {
      entity = entity.slice(0, -3) + 'y';
    } else if (entity.endsWith('s') && !entity.endsWith('ss')) {
      entity = entity.slice(0, -1);
    }
    return entity;
  }
  
  return null;
}

// Extrae el ID de la entidad de la ruta
function getEntityId(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  
  for (let i = parts.length - 1; i >= 0; i--) {
    // Buscar un número o UUID
    if (/^\d+$/.test(parts[i]) || /^[a-f0-9-]{36}$/i.test(parts[i])) {
      return parts[i];
    }
  }
  
  return null;
}

// Rutas que NO deben auditarse (muy frecuentes o de solo lectura)
const EXCLUDED_PATHS = [
  '/api/health',
  '/api/ready',
  '/api/audit', // Evitar recursión
  '/api/metrics',
  '/api/sse',
  '/health',
  '/ready'
];

// Rutas de solo lectura que podrían auditarse opcionalmente
const READ_ONLY_PATTERNS = [
  /^\/api\/lookups/,
  /^\/api\/timezones/,
  /^\/api\/zones/,
  /^\/api\/municipalities/,
  /^\/api\/eps$/
];

/**
 * Middleware de auditoría automática
 * Coloca DESPUÉS de los middlewares de autenticación
 */
export function auditMiddleware(options?: {
  auditReads?: boolean; // Si auditar GETs (default: false)
  excludePaths?: string[]; // Rutas adicionales a excluir
}) {
  const auditReads = options?.auditReads ?? false;
  const extraExcluded = options?.excludePaths ?? [];
  const allExcluded = [...EXCLUDED_PATHS, ...extraExcluded];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalPath = req.originalUrl || req.path;
    const basePath = originalPath.split('?')[0];
    
    // Saltar rutas excluidas
    if (allExcluded.some(p => basePath.startsWith(p))) {
      return next();
    }
    
    // Saltar GETs si no está habilitado
    if (req.method === 'GET' && !auditReads) {
      return next();
    }
    
    // Saltar lookups en GETs
    if (req.method === 'GET' && READ_ONLY_PATTERNS.some(p => p.test(basePath))) {
      return next();
    }
    
    // Capturar respuesta
    const originalSend = res.send;
    let responseBody: any;
    
    res.send = function(body): Response {
      responseBody = body;
      return originalSend.call(this, body);
    };
    
    // Continuar con la petición
    res.on('finish', async () => {
      try {
        const durationMs = Date.now() - startTime;
        const actionType = getActionType(req.method, basePath);
        
        // Solo auditar acciones de escritura o si se especificó
        if (actionType === 'OTHER' && req.method === 'GET') {
          return;
        }
        
        // Extraer datos de respuesta si es JSON
        let newValues: any = null;
        if (responseBody && typeof responseBody === 'string') {
          try {
            const parsed = JSON.parse(responseBody);
            if (parsed.data && typeof parsed.data === 'object') {
              newValues = parsed.data;
            }
          } catch {
            // No es JSON, ignorar
          }
        }
        
        // Extraer IP real (considerando proxies)
        const ipAddress = 
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          req.ip;
        
        await logAudit({
          userId: req.user?.id ?? null,
          userName: req.user?.name ?? null,
          userEmail: req.user?.email ?? null,
          userRole: req.user?.role ?? null,
          actionType,
          entityType: getEntityType(basePath),
          entityId: getEntityId(basePath),
          requestMethod: req.method,
          requestPath: basePath,
          requestQuery: Object.keys(req.query).length > 0 ? req.query as Record<string, any> : null,
          requestBody: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : null,
          responseStatus: res.statusCode,
          ipAddress: ipAddress ?? null,
          userAgent: req.headers['user-agent'] ?? null,
          newValues,
          durationMs
        });
      } catch (error) {
        console.error('Error en middleware de auditoría:', error);
        // No bloquear la respuesta
      }
    });
    
    next();
  };
}

/**
 * Función helper para auditar manualmente acciones específicas
 */
export async function auditAction(
  req: AuthenticatedRequest,
  actionType: AuditActionType,
  entityType: string,
  entityId?: string | number,
  options?: {
    entityName?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    description?: string;
    metadata?: Record<string, any>;
  }
): Promise<number | null> {
  const ipAddress = 
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip;
  
  return logAudit({
    userId: req.user?.id ?? null,
    userName: req.user?.name ?? null,
    userEmail: req.user?.email ?? null,
    userRole: req.user?.role ?? null,
    actionType,
    entityType,
    entityId: entityId ?? null,
    entityName: options?.entityName,
    oldValues: options?.oldValues,
    newValues: options?.newValues,
    description: options?.description,
    metadata: options?.metadata,
    requestMethod: req.method,
    requestPath: req.originalUrl || req.path,
    ipAddress: ipAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null
  });
}

export default auditMiddleware;
