/**
 * Sistema de logging centralizado con Pino
 * Reemplaza todos los console.log del proyecto
 * 
 * @module logger
 * @version 1.0.0
 */

import pino, { Logger as PinoLogger } from 'pino';
import { ILogger, LogLevel, LogContext } from '../types';

/**
 * Configuración de Pino según ambiente
 */
const getPinoConfig = (env: string) => {
  const isDev = env === 'development';

  if (isDev) {
    return {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
      level: 'debug',
    };
  }

  // Producción: JSON estructurado
  return {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label: string) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
};

/**
 * Instancia global de Pino
 */
const pinoInstance = pino(getPinoConfig(process.env.NODE_ENV || 'development'));

/**
 * Logger centralizado que implementa ILogger
 * Proporciona métodos tipados para diferentes niveles de log
 */
class Logger implements ILogger {
  private logger: PinoLogger;
  private requestId?: string;

  constructor(logger: PinoLogger = pinoInstance) {
    this.logger = logger;
  }

  /**
   * Establecer requestId para trazabilidad
   */
  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  /**
   * Limpiar requestId
   */
  clearRequestId(): void {
    this.requestId = undefined;
  }

  /**
   * Log de nivel DEBUG
   * Uso: Información detallada para debugging (solo en desarrollo)
   */
  debug(message: string, context?: LogContext): void {
    this.logger.debug(
      { ...context, requestId: this.requestId },
      message
    );
  }

  /**
   * Log de nivel INFO
   * Uso: Eventos importantes del aplicación (inicio, configuración, etc.)
   */
  info(message: string, context?: LogContext): void {
    this.logger.info(
      { ...context, requestId: this.requestId },
      message
    );
  }

  /**
   * Log de nivel WARN
   * Uso: Situaciones inesperadas pero manejables (deprecated, retry)
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(
      { ...context, requestId: this.requestId },
      message
    );
  }

  /**
   * Log de nivel ERROR
   * Uso: Errores que no detienen la aplicación (validación, timeout)
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(
      {
        ...context,
        requestId: this.requestId,
        error: error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : undefined,
      },
      message
    );
  }

  /**
   * Log de nivel FATAL
   * Uso: Errores críticos que rompen la aplicación (crash, BD offline)
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    this.logger.fatal(
      {
        ...context,
        requestId: this.requestId,
        error: error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : undefined,
      },
      message
    );
  }

  /**
   * Log de solicitud HTTP (entrada)
   */
  logRequest(method: string, path: string, context?: Partial<LogContext>): void {
    this.info('HTTP Request', {
      method,
      path,
      ...context,
    });
  }

  /**
   * Log de respuesta HTTP (salida)
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: Partial<LogContext>
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this[level as LogLevel](`HTTP Response ${statusCode}`, {
      method,
      path,
      statusCode,
      duration,
      ...context,
    } as any);
  }

  /**
   * Log de error de BD
   */
  logDatabaseError(error: Error, query?: string, context?: Partial<LogContext>): void {
    this.error('Database Error', error, {
      query,
      ...context,
    });
  }

  /**
   * Log de error de servicio externo
   */
  logExternalServiceError(
    service: string,
    error: Error,
    context?: Partial<LogContext>
  ): void {
    this.error(`External Service Error [${service}]`, error, {
      service,
      ...context,
    });
  }

  /**
   * Log de evento de negocio (auditoría)
   */
  logBusinessEvent(event: string, context?: Partial<LogContext>): void {
    this.info(`Business Event: ${event}`, context);
  }

  /**
   * Log de cambio de estado (auditoría)
   */
  logStateChange(
    resource: string,
    from: string,
    to: string,
    context?: Partial<LogContext>
  ): void {
    this.info(`State Change: ${resource}`, {
      from,
      to,
      ...context,
    });
  }
}

/**
 * Instancia singleton del logger
 */
export const logger = new Logger(pinoInstance);

/**
 * Crear logger hijo con contexto específico
 */
export function createLogger(namespace: string): ILogger {
  const childLogger = pinoInstance.child({ namespace });
  return new Logger(childLogger);
}

/**
 * Middleware de logging para Express
 * Registra entrada y salida de solicitudes HTTP
 */
export function loggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const requestId = req.id || `${Date.now()}-${Math.random()}`;
    req.id = requestId;
    logger.setRequestId(requestId);

    const startTime = Date.now();
    const originalSend = res.send;

    // Log de solicitud
    logger.logRequest(req.method, req.path, {
      userId: req.user?.id,
      ip: req.ip,
    });

    // Log de respuesta
    res.send = function (data: any) {
      const duration = Date.now() - startTime;
      logger.logResponse(req.method, req.path, res.statusCode, duration, {
        userId: req.user?.id,
      });
      logger.clearRequestId();
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Helper: Convertir console.log a logger.info
 * Uso: Para búsqueda/reemplazo en archivos existentes
 * 
 * Patrón: console.log → logger.info
 * Patrón: console.error → logger.error
 * Patrón: console.warn → logger.warn
 */
export function setupConsoleOverrides() {
  if (process.env.NODE_ENV === 'development') {
    // En desarrollo, mantener console para debugging
    return;
  }

  // En producción, redirigir console a logger
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    logger.info(args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' '));
  };

  console.error = (...args: any[]) => {
    logger.error(args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' '));
  };

  console.warn = (...args: any[]) => {
    logger.warn(args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' '));
  };
}

export default logger;
