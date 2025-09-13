import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/Logger';

interface ErrorDetails {
  stack?: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: any;
}

export class ErrorHandler {
  private static readonly logger = Logger.getInstance();

  // Crear error personalizado
  public static createError(
    message: string, 
    statusCode: number = 500, 
    code?: string, 
    details?: any
  ): AppError {
    const error = new Error(message) as AppError;
    error.statusCode = statusCode;
    error.isOperational = true;
    error.code = code;
    error.details = details;
    return error;
  }

  // Middleware principal de manejo de errores
  public static handle() {
    return (error: Error | AppError, req: Request, res: Response, next: NextFunction) => {
      // Log del error
      this.logError(error, req);

      // Si es un error operacional conocido
      if (this.isOperationalError(error)) {
        return this.handleOperationalError(error as AppError, res);
      }

      // Si es un error de programación o desconocido
      return this.handleProgrammingError(error, res);
    };
  }

  // Manejar errores específicos de WhatsApp
  public static handleWhatsAppError(error: any, req: Request, res: Response): void {
    this.logger.error('WhatsApp webhook error', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
      headers: req.headers,
      method: req.method,
      url: req.url
    });

    // Para webhooks de WhatsApp, siempre responder 200 para evitar reintentos
    res.status(200).json({
      success: false,
      error: 'Error procesando mensaje de WhatsApp',
      message: 'Su mensaje no pudo ser procesado. Intente nuevamente.'
    });
  }

  // Manejar errores de MCP
  public static handleMCPError(error: any, context?: string): AppError {
    this.logger.error('MCP Server error', {
      error: error.message,
      stack: error.stack,
      context,
      mcpError: true
    });

    return this.createError(
      'Error conectando con el servidor médico. Intente nuevamente.',
      503,
      'MCP_CONNECTION_ERROR',
      { originalError: error.message, context }
    );
  }

  // Manejar errores de OpenAI
  public static handleOpenAIError(error: any): AppError {
    this.logger.error('OpenAI API error', {
      error: error.message,
      stack: error.stack,
      openaiError: true
    });

    if (error.status === 429) {
      return this.createError(
        'Servicio temporalmente saturado. Intente en unos momentos.',
        429,
        'OPENAI_RATE_LIMIT'
      );
    }

    if (error.status === 401) {
      return this.createError(
        'Error de configuración del servicio de IA.',
        500,
        'OPENAI_AUTH_ERROR'
      );
    }

    return this.createError(
      'Error en el servicio de inteligencia artificial. Intente nuevamente.',
      503,
      'OPENAI_SERVICE_ERROR',
      { originalError: error.message }
    );
  }

  // Manejar errores de base de datos
  public static handleDatabaseError(error: any): AppError {
    this.logger.error('Database error', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      sqlState: error.sqlState,
      databaseError: true
    });

    // Errores específicos de MySQL
    switch (error.code) {
      case 'ER_DUP_ENTRY':
        return this.createError(
          'El registro ya existe en el sistema.',
          409,
          'DUPLICATE_ENTRY'
        );
      
      case 'ER_NO_REFERENCED_ROW':
      case 'ER_ROW_IS_REFERENCED':
        return this.createError(
          'Error de integridad de datos.',
          409,
          'REFERENTIAL_INTEGRITY_ERROR'
        );
      
      case 'ECONNREFUSED':
        return this.createError(
          'Error de conexión con la base de datos.',
          503,
          'DATABASE_CONNECTION_ERROR'
        );
      
      case 'ER_ACCESS_DENIED_ERROR':
        return this.createError(
          'Error de autenticación con la base de datos.',
          500,
          'DATABASE_AUTH_ERROR'
        );
      
      default:
        return this.createError(
          'Error en la base de datos. Intente nuevamente.',
          500,
          'DATABASE_ERROR',
          { originalError: error.message, code: error.code }
        );
    }
  }

  // Manejar errores de validación
  public static handleValidationError(errors: any[]): AppError {
    const messages = errors.map(err => err.message || err).join(', ');
    
    this.logger.warn('Validation error', {
      errors,
      validationError: true
    });

    return this.createError(
      `Datos inválidos: ${messages}`,
      400,
      'VALIDATION_ERROR',
      { validationErrors: errors }
    );
  }

  // Verificar si es error operacional
  private static isOperationalError(error: Error | AppError): boolean {
    return (error as AppError).isOperational === true;
  }

  // Manejar errores operacionales
  private static handleOperationalError(error: AppError, res: Response): void {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details
    });
  }

  // Manejar errores de programación
  private static handleProgrammingError(error: Error, res: Response): void {
    // No exponer detalles del error en producción
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({
      success: false,
      error: isDevelopment ? error.message : 'Error interno del servidor',
      ...(isDevelopment && { stack: error.stack })
    });
  }

  // Log de errores
  private static logError(error: Error | AppError, req: Request): void {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      statusCode: (error as AppError).statusCode,
      code: (error as AppError).code,
      isOperational: (error as AppError).isOperational,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      },
      timestamp: new Date().toISOString()
    };

    if ((error as AppError).statusCode >= 500) {
      this.logger.error('Server error', errorInfo);
    } else {
      this.logger.warn('Client error', errorInfo);
    }
  }

  // Manejo de promesas rechazadas no capturadas
  public static handleUnhandledRejections(): void {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString()
      });
      
      // En producción, cerrar el proceso gracefully
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    });
  }

  // Manejo de excepciones no capturadas
  public static handleUncaughtExceptions(): void {
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught Exception', {
        message: error.message,
        stack: error.stack
      });
      
      // Cerrar el proceso ya que el estado es incierto
      process.exit(1);
    });
  }

  // Middleware para capturar errores async
  public static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Middleware para 404
  public static notFound() {
    return (req: Request, res: Response, next: NextFunction) => {
      const error = this.createError(
        `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
        404,
        'NOT_FOUND'
      );
      next(error);
    };
  }

  // Validar webhook de Twilio
  public static validateTwilioWebhook() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Validaciones básicas de webhook de Twilio
        if (!req.body.From || !req.body.Body) {
          throw this.createError(
            'Webhook de Twilio inválido: faltan campos requeridos',
            400,
            'INVALID_TWILIO_WEBHOOK'
          );
        }

        // Validar formato de número de teléfono
        const phoneRegex = /^\+\d{10,15}$/;
        if (!phoneRegex.test(req.body.From)) {
          throw this.createError(
            'Número de teléfono inválido',
            400,
            'INVALID_PHONE_NUMBER'
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }
}