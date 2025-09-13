import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload { 
  id: number; 
  role: string; 
  name: string; 
  email: string; 
}

// Cache simple de tokens válidos (evita verificación repetida en el mismo proceso)
const tokenCache = new Map<string, { payload: AuthPayload; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function extractToken(req: Request): string | null {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  // Soporte para SSE / EventSource: permite ?token= en query cuando no se pueden enviar headers
  if (typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
}

function validateToken(token: string): AuthPayload | null {
  // Verificar cache primero
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.payload;
  }

  try {
    // Bypass en entorno de test si coincide con TEST_JWT
    if (process.env.NODE_ENV === 'test' && process.env.TEST_JWT && token === process.env.TEST_JWT) {
      const testPayload: AuthPayload = { id: 1, role: 'admin', name: 'Test User', email: 'test@example.com' };
      return testPayload;
    }

    const raw = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    
    // Normalizar campos (compatibilidad con tokens históricos)
    const normalized: AuthPayload = {
      id: raw.id || raw.userId,
      role: raw.role || 'admin',
      name: raw.name || 'Unknown User',
      email: raw.email || 'unknown@example.com'
    };

    if (!normalized.id) {
      return null;
    }

    // Guardar en cache
    tokenCache.set(token, {
      payload: normalized,
      expires: Date.now() + CACHE_TTL
    });

    return normalized;
  } catch (error) {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const user = validateToken(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  (req as any).user = user;
  next();
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthPayload | undefined;
    if (!user) {
      return res.status(401).json({ message: 'No authentication provided' });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

// Limpiar cache periódicamente para evitar memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [token, cached] of tokenCache.entries()) {
    if (cached.expires <= now) {
      tokenCache.delete(token);
    }
  }
}, CACHE_TTL);
