/**
 * Middleware de validación centralizado con Zod
 * Proporciona helpers para validar request body, params y query
 * 
 * @module middleware/validate
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler';
import { logger } from '../lib/logger';

/**
 * Tipos de validación
 */
type ValidationType = 'body' | 'params' | 'query' | 'headers';

/**
 * Opciones de validación
 */
interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  passthrough?: boolean; // Pasar datos inválidos al siguiente middleware
}

/**
 * Extender Request para incluir datos validados
 */
declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
      validatedParams?: any;
      validatedQuery?: any;
    }
  }
}

/**
 * Middleware genérico de validación
 */
const createValidationMiddleware = (
  schema: ZodSchema,
  type: ValidationType = 'body',
  options: ValidationOptions = {}
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[type as keyof Request];
      
      // Validar con Zod
      const result = schema.safeParse(data);

      if (!result.success) {
        // Construir mensaje de error detallado
        const fieldErrors: Record<string, string[]> = {};
        
        result.error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!fieldErrors[path]) {
            fieldErrors[path] = [];
          }
          fieldErrors[path].push(err.message);
        });

        logger.warn(`Validation failed for ${type}`, {
          type,
          fieldErrors,
          endpoint: req.path,
        });

        throw AppError.unprocessable(
          `Invalid ${type}`,
          { fields: fieldErrors }
        );
      }

      // Guardar datos validados en request
      const validatedKey = `validated${type.charAt(0).toUpperCase() + type.slice(1)}`;
      (req as any)[validatedKey] = result.data;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validar body de request
 * 
 * Uso:
 * ```typescript
 * router.post('/users', 
 *   validateBody(createUserSchema),
 *   (req, res) => {
 *     const userData = req.validatedBody;
 *   }
 * );
 * ```
 */
export const validateBody = (
  schema: ZodSchema,
  options?: ValidationOptions
) => createValidationMiddleware(schema, 'body', options);

/**
 * Validar parámetros de ruta
 * 
 * Uso:
 * ```typescript
 * router.get('/users/:id',
 *   validateParams(paramsSchema),
 *   (req, res) => {
 *     const params = req.validatedParams;
 *   }
 * );
 * ```
 */
export const validateParams = (
  schema: ZodSchema,
  options?: ValidationOptions
) => createValidationMiddleware(schema, 'params', options);

/**
 * Validar query string
 * 
 * Uso:
 * ```typescript
 * router.get('/users',
 *   validateQuery(querySchema),
 *   (req, res) => {
 *     const query = req.validatedQuery;
 *   }
 * );
 * ```
 */
export const validateQuery = (
  schema: ZodSchema,
  options?: ValidationOptions
) => createValidationMiddleware(schema, 'query', options);

/**
 * Validar múltiples schemas a la vez
 * 
 * Uso:
 * ```typescript
 * router.put('/users/:id',
 *   validateAll({
 *     body: updateUserSchema,
 *     params: paramsSchema,
 *   }),
 *   (req, res) => {
 *     const { body, params } = req.validated;
 *   }
 * );
 * ```
 */
export const validateAll = (schemas: Partial<Record<ValidationType, ZodSchema>>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated: Record<string, any> = {};

      // Validar cada schema proporcionado
      for (const [type, schema] of Object.entries(schemas)) {
        if (!schema) continue;

        const data = req[type as keyof Request];
        const result = schema.safeParse(data);

        if (!result.success) {
          const fieldErrors: Record<string, string[]> = {};
          
          result.error.errors.forEach((err) => {
            const path = err.path.join('.');
            if (!fieldErrors[path]) {
              fieldErrors[path] = [];
            }
            fieldErrors[path].push(err.message);
          });

          logger.warn(`Validation failed for ${type}`, {
            type,
            fieldErrors,
            endpoint: req.path,
          });

          throw AppError.unprocessable(
            `Invalid ${type}`,
            { fields: fieldErrors }
          );
        }

        validated[type] = result.data;
      }

      // Guardar todos los validados
      (req as any).validated = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validar entrada en servicio (no en middleware)
 * 
 * Uso:
 * ```typescript
 * const validateInput = async (data: unknown) => {
 *   return await validateSchema(createUserSchema, data);
 * };
 * 
 * const user = await validateInput(userData);
 * ```
 */
export const validateSchema = async <T>(
  schema: ZodSchema,
  data: unknown
): Promise<T> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    
    result.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(err.message);
    });

    throw AppError.unprocessable(
      'Validation failed',
      { fields: fieldErrors }
    );
  }

  return result.data as T;
};

/**
 * Validar con transformación
 * 
 * Uso:
 * ```typescript
 * const result = await validateAndTransform(
 *   schema,
 *   rawData,
 *   (data) => ({
 *     ...data,
 *     normalizedEmail: data.email.toLowerCase(),
 *   })
 * );
 * ```
 */
export const validateAndTransform = async <T, R>(
  schema: ZodSchema,
  data: unknown,
  transform: (data: T) => R
): Promise<R> => {
  const validated = await validateSchema<T>(schema, data);
  return transform(validated);
};

/**
 * Validar condicionalmente
 * 
 * Uso:
 * ```typescript
 * const schema = baseSchema.refine(
 *   (data) => validateIf(data.type === 'special', specialSchema, data),
 *   { message: 'Invalid special data' }
 * );
 * ```
 */
export const validateIf = <T>(
  condition: boolean,
  schema: ZodSchema,
  data: unknown
): boolean => {
  if (!condition) return true;

  const result = schema.safeParse(data);
  return result.success;
};

/**
 * Helper para crear schemas comunes
 */
export const CommonSchemas = {
  /**
   * Esquema de paginación
   */
  pagination: () => ({
    page: (val: any) => Math.max(1, parseInt(val) || 1),
    limit: (val: any) => Math.min(100, Math.max(1, parseInt(val) || 10)),
    sortBy: (val: any) => val || 'created_at',
    sortOrder: (val: any) => (['ASC', 'DESC'].includes(val) ? val : 'DESC'),
  }),

  /**
   * Esquema de ID (cédula normalizada)
   */
  normalizedId: () => (val: any) => {
    if (!val) return '';
    return String(val).replace(/[^0-9A-Za-z-]/g, '').toUpperCase();
  },

  /**
   * Esquema de teléfono
   */
  phoneNumber: () => (val: any) => {
    if (!val) return '';
    return String(val).replace(/[^0-9+]/g, '');
  },

  /**
   * Esquema de email
   */
  email: () => (val: any) => {
    if (!val) return '';
    return String(val).toLowerCase().trim();
  },
};

/**
 * Middleware para sanitizar entrada
 * Previene XSS y normaliza datos
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitizar strings en body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        // Remover caracteres potencialmente peligrosos
        req.body[key] = req.body[key]
          .trim()
          .replace(/[<>]/g, '')
          .substring(0, 10000); // Límite de longitud
      }
    });
  }

  // Sanitizar strings en query
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = (req.query[key] as string)
          .trim()
          .replace(/[<>]/g, '')
          .substring(0, 1000);
      }
    });
  }

  next();
};

export default {
  validateBody,
  validateParams,
  validateQuery,
  validateAll,
  validateSchema,
  validateAndTransform,
  validateIf,
  sanitizeInput,
  CommonSchemas,
};
