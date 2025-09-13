import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/Logger';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private static instances = new Map<string, RateLimiter>();
  private store = new Map<string, RateLimitEntry>();
  private readonly logger = Logger.getInstance();
  
  constructor(private options: RateLimitOptions) {
    // Limpiar entradas expiradas cada minuto
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  public static create(name: string, options: RateLimitOptions): RateLimiter {
    if (!this.instances.has(name)) {
      this.instances.set(name, new RateLimiter(options));
    }
    return this.instances.get(name)!;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.generateKey(req);
      const now = Date.now();
      
      let entry = this.store.get(key);
      
      // Si no existe la entrada o ha expirado, crear nueva
      if (!entry || now > entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + this.options.windowMs
        };
        this.store.set(key, entry);
      }
      
      // Incrementar contador
      entry.count++;
      
      // Verificar si excede el límite
      if (entry.count > this.options.maxRequests) {
        this.logger.warn('Rate limit exceeded', {
          key,
          count: entry.count,
          limit: this.options.maxRequests,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        const remaining = Math.ceil((entry.resetTime - now) / 1000);
        
        res.status(429).json({
          success: false,
          error: this.options.message || 'Too many requests',
          retryAfter: remaining,
          limit: this.options.maxRequests,
          windowMs: this.options.windowMs
        });
        
        return;
      }
      
      // Agregar headers informativos
      res.set({
        'X-RateLimit-Limit': this.options.maxRequests.toString(),
        'X-RateLimit-Remaining': (this.options.maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': entry.resetTime.toString()
      });
      
      this.logger.debug('Rate limit check passed', {
        key,
        count: entry.count,
        limit: this.options.maxRequests,
        remaining: this.options.maxRequests - entry.count
      });
      
      next();
    };
  }

  private generateKey(req: Request): string {
    if (this.options.keyGenerator) {
      return this.options.keyGenerator(req);
    }
    
    // Usar número de teléfono de WhatsApp si está disponible
    const phoneNumber = req.body?.From || req.body?.phoneNumber;
    if (phoneNumber) {
      return `phone:${phoneNumber}`;
    }
    
    // Fallback a IP
    return `ip:${req.ip}`;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }

  public getStats(): { totalKeys: number; entries: Array<{ key: string; count: number; resetTime: number }> } {
    return {
      totalKeys: this.store.size,
      entries: Array.from(this.store.entries()).map(([key, entry]) => ({
        key,
        count: entry.count,
        resetTime: entry.resetTime
      }))
    };
  }

  public reset(key?: string): void {
    if (key) {
      this.store.delete(key);
      this.logger.info(`Rate limit reset for key: ${key}`);
    } else {
      this.store.clear();
      this.logger.info('All rate limits reset');
    }
  }
}

// Configuraciones predefinidas
export const rateLimiters = {
  // Para webhooks de WhatsApp - más permisivo
  whatsapp: RateLimiter.create('whatsapp', {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30, // 30 mensajes por minuto por número
    message: 'Demasiados mensajes. Por favor espere un momento antes de enviar otro mensaje.',
    keyGenerator: (req: Request) => {
      const phoneNumber = req.body?.From || req.body?.phoneNumber;
      return phoneNumber ? `whatsapp:${phoneNumber}` : `ip:${req.ip}`;
    }
  }),

  // Para APIs generales - más restrictivo
  api: RateLimiter.create('api', {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 100, // 100 requests por 15 minutos
    message: 'Too many API requests. Please try again later.'
  }),

  // Para emergencias - muy permisivo
  emergency: RateLimiter.create('emergency', {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 10, // 10 mensajes de emergencia por minuto
    message: 'Límite de mensajes de emergencia alcanzado. Si es una emergencia real, llame al 123.'
  }),

  // Para autenticación - restrictivo
  auth: RateLimiter.create('auth', {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5, // 5 intentos de login por 15 minutos
    message: 'Demasiados intentos de autenticación. Intente nuevamente en 15 minutos.'
  })
};

// Middleware específico para WhatsApp con manejo de emergencias
export const whatsappRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Verificar si es un mensaje de emergencia
  const messageBody = req.body?.Body?.toLowerCase() || '';
  const emergencyKeywords = ['emergencia', 'urgente', 'ayuda', '911', '123', 'dolor intenso'];
  
  const isEmergency = emergencyKeywords.some(keyword => messageBody.includes(keyword));
  
  if (isEmergency) {
    // Usar rate limiter de emergencias
    return rateLimiters.emergency.middleware()(req, res, next);
  } else {
    // Usar rate limiter normal de WhatsApp
    return rateLimiters.whatsapp.middleware()(req, res, next);
  }
};