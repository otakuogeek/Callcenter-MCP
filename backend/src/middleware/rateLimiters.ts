import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// Key generator compartido para obtener IP real detrás de proxy
export const getRateLimitKey = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
};

// Rate limiter ESPECÍFICO para login (más estricto)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos de login por IP cada 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: getRateLimitKey,
  message: 'Demasiados intentos de inicio de sesión. Por favor intente más tarde.',
  skipSuccessfulRequests: true, // No cuenta logins exitosos
});
