/**
 * Middleware de manejo global de errores
 * Centraliza la gestión de excepciones en toda la aplicación
 * 
 * @module middleware/errorHandler
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError, ErrorCodes, ApiErrorResponse } from '../types';
import { logger } from '../lib/logger';

/**
 * Mapper de errores a códigos y mensajes consistentes
 */
const mapErrorToResponse = (error: unknown): {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, any>;
} => {
  // Error personalizado de API
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.details,
    };
  }

  // Error de validación Zod
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(err.message);
    });

    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: { fields: fieldErrors },
    };
  }

  // Error de JWT
  if (error instanceof Error && error.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired token',
    };
  }

  // Error de base de datos (conexión)
  if (error instanceof Error && 
      (error.message.includes('ECONNREFUSED') || 
       error.message.includes('PROTOCOL_CONNECTION_LOST'))) {
    return {
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database service is unavailable',
    };
  }

  // Error de base de datos (sintaxis SQL)
  if (error instanceof Error && error.message.includes('SQL')) {
    return {
      statusCode: 500,
      code: 'DATABASE_ERROR',
      message: 'An error occurred while processing your request',
    };
  }

  // Error genérico de Error
  if (error instanceof Error) {
    return {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An internal error occurred' 
        : error.message,
    };
  }

  // Error desconocido (no es instancia de Error)
  return {
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
};

/**
 * Middleware de manejo global de errores
 * DEBE estar registrado al final de todos los demás middlewares
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { statusCode, code, message, details } = mapErrorToResponse(error);

  // Log del error con contexto
  const logContext = {
    requestId: (req as any).id,
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id,
    statusCode,
    code,
  };

  if (statusCode >= 500) {
    logger.error(message, error as Error, logContext);
  } else if (statusCode >= 400) {
    logger.warn(message, logContext as any);
  }

  // Enviar respuesta de error al cliente
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * Wrapper para capturar errores síncronos y asíncronos en rutas
 * 
 * Uso:
 * ```typescript
 * router.post('/endpoint', asyncHandler(async (req, res) => {
 *   const result = await someAsyncOperation();
 *   res.json({ success: true, data: result });
 * }));
 * ```
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wrapper alternativo con tipado mejorado
 */
export const withErrorHandling = <P extends any[], R>(
  fn: (...args: P) => Promise<R> | R
) => {
  return async (...args: P): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error('Operation failed', error as Error);
      throw error;
    }
  };
};

/**
 * Wrapper para validación de entrada y salida
 * 
 * Uso:
 * ```typescript
 * const validateAndExecute = createValidatedHandler(
 *   inputSchema,
 *   outputSchema,
 *   async (validatedData) => {
 *     // lógica con datos validados
 *     return result;
 *   }
 * );
 * ```
 */
export const createValidatedHandler = <T, R>(
  validateInput: (data: unknown) => Promise<T> | T,
  executeLogic: (data: T) => Promise<R> | R,
  validateOutput?: (data: unknown) => Promise<R> | R
) => {
  return async (input: unknown): Promise<R> => {
    try {
      const validatedInput = await validateInput(input);
      const result = await executeLogic(validatedInput);
      
      if (validateOutput) {
        return await validateOutput(result);
      }
      
      return result;
    } catch (error) {
      logger.error('Validated operation failed', error as Error);
      throw error;
    }
  };
};

/**
 * Errores predefinidos para uso en controladores
 */
export class AppError extends ApiError {
  constructor(
    statusCode: number = 500,
    message: string = 'An error occurred',
    code?: string,
    details?: Record<string, any>
  ) {
    super(statusCode, message, code, details);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: Record<string, any>) {
    return new AppError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new AppError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden') {
    return new AppError(403, message, 'FORBIDDEN');
  }

  static notFound(message: string = 'Not found') {
    return new AppError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string, details?: Record<string, any>) {
    return new AppError(409, message, 'CONFLICT', details);
  }

  static unprocessable(message: string, details?: Record<string, any>) {
    return new AppError(422, message, 'VALIDATION_ERROR', details);
  }

  static tooManyRequests(message: string = 'Too many requests') {
    return new AppError(429, message, 'RATE_LIMIT');
  }

  static internalError(message: string = 'Internal server error') {
    return new AppError(500, message, 'INTERNAL_ERROR');
  }

  static serviceUnavailable(message: string = 'Service unavailable') {
    return new AppError(503, message, 'SERVICE_UNAVAILABLE');
  }

  static externalServiceError(
    service: string,
    originalError?: Error,
    details?: Record<string, any>
  ) {
    return new AppError(
      503,
      `${service} service is currently unavailable`,
      'EXTERNAL_SERVICE_ERROR',
      { service, originalError: originalError?.message, ...details }
    );
  }
}

/**
 * Helper para NOT_FOUND automático
 */
export const ensureFound = <T>(
  item: T | null | undefined,
  resource: string = 'Resource'
): T => {
  if (!item) {
    throw AppError.notFound(`${resource} not found`);
  }
  return item;
};

/**
 * Helper para validación de duplicados
 */
export const ensureUnique = <T>(
  item: T | null | undefined,
  resource: string = 'Resource'
): void => {
  if (item) {
    throw AppError.conflict(`${resource} already exists`);
  }
};

export default {
  errorHandler,
  asyncHandler,
  AppError,
  ensureFound,
  ensureUnique,
};
