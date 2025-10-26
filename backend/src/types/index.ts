/**
 * Sistema de tipos global para Biosanarcall Backend
 * Define interfaces y tipos reutilizables en toda la aplicación
 * 
 * @module types
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';

// ============================================================================
// API RESPONSES
// ============================================================================

/**
 * Respuesta genérica de API exitosa
 * @template T - Tipo de datos devueltos
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  metadata?: Record<string, any>;
}

/**
 * Respuesta genérica de API con error
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

/** Tipo unión de respuestas de API */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Respuesta paginada
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  message?: string;
}

// ============================================================================
// ENTITIES
// ============================================================================

/**
 * Paciente - Modelo de dominio
 */
export interface Patient {
  id: string;
  document: string; // Cédula normalizada
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  birth_date?: Date;
  gender?: 'M' | 'F' | 'O';
  blood_type?: string;
  allergies?: string;
  medical_conditions?: string;
  eps_id?: string;
  insurance_number?: string;
  address?: string;
  municipality?: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

/**
 * Cita médica - Modelo de dominio
 */
export interface Appointment {
  id: string;
  patient_id: string;
  availability_id: string;
  appointment_date: Date;
  start_time: string;
  duration_minutes: number;
  reason?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  doctor_name?: string;
  location_name?: string;
  specialty_name?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Disponibilidad de citas
 */
export interface Availability {
  id: string;
  doctor_id?: string;
  doctor_name: string;
  specialty_name: string;
  location_name: string;
  appointment_date: Date;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  slots_available: number;
  max_slots: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Usuario del sistema
 */
export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'staff' | 'doctor' | 'patient';
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Evento de llamada
 */
export interface CallEvent {
  id: string;
  patient_id?: string;
  phone_number: string;
  call_type: 'inbound' | 'outbound';
  status: 'initiated' | 'ringing' | 'answered' | 'failed' | 'completed';
  duration_seconds?: number;
  transcript?: string;
  recording_url?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request extendido con usuario autenticado
 * Usa tipado dinámico para evitar conflictos con auth middleware
 */
export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Contexto de ejecución del controlador
 */
export interface ControllerContext {
  req: AuthenticatedRequest;
  res: Response;
  next: NextFunction;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Error personalizado de API
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: Record<string, any>;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';

    // Mantener proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convertir error a respuesta de API
   */
  toJSON(): ApiErrorResponse {
    return {
      success: false,
      error: this.message,
      code: this.code,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Errores comunes predefinidos
 */
export const ErrorCodes = {
  // Cliente (4xx)
  BAD_REQUEST: { statusCode: 400, code: 'BAD_REQUEST' },
  UNAUTHORIZED: { statusCode: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { statusCode: 403, code: 'FORBIDDEN' },
  NOT_FOUND: { statusCode: 404, code: 'NOT_FOUND' },
  CONFLICT: { statusCode: 409, code: 'CONFLICT' },
  VALIDATION_ERROR: { statusCode: 422, code: 'VALIDATION_ERROR' },
  RATE_LIMIT: { statusCode: 429, code: 'RATE_LIMIT' },

  // Servidor (5xx)
  INTERNAL_ERROR: { statusCode: 500, code: 'INTERNAL_ERROR' },
  SERVICE_UNAVAILABLE: { statusCode: 503, code: 'SERVICE_UNAVAILABLE' },

  // Dominio específico
  PATIENT_NOT_FOUND: { statusCode: 404, code: 'PATIENT_NOT_FOUND' },
  APPOINTMENT_NOT_FOUND: { statusCode: 404, code: 'APPOINTMENT_NOT_FOUND' },
  INVALID_DOCUMENT: { statusCode: 422, code: 'INVALID_DOCUMENT' },
  INSUFFICIENT_SLOTS: { statusCode: 409, code: 'INSUFFICIENT_SLOTS' },
  EXTERNAL_SERVICE_ERROR: { statusCode: 503, code: 'EXTERNAL_SERVICE_ERROR' },
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Resultado de validación
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

/**
 * Opciones de validación
 */
export interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Niveles de log
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Contexto de log estructurado
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

/**
 * Logger estructurado
 */
export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;
}

// ============================================================================
// DATABASE
// ============================================================================

/**
 * Opciones de conexión a BD
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
  waitForConnections?: boolean;
  connectionTimeoutMillis?: number;
  enableKeepAlive?: boolean;
  keepAliveInitialDelayMillis?: number;
}

/**
 * Pool de conexiones
 */
export interface DatabasePool {
  query(sql: string, values?: any[]): Promise<any>;
  execute(sql: string, values?: any[]): Promise<any>;
  getConnection(): Promise<any>;
  end(): Promise<void>;
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Parámetros de paginación
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Resultado paginado
 */
export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

// ============================================================================
// EXTERNAL SERVICES
// ============================================================================

/**
 * Configuración de servicio externo
 */
export interface ExternalServiceConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  circuitBreakerThreshold?: number;
}

/**
 * Respuesta de servicio externo
 */
export interface ExternalServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

// ============================================================================
// QUEUE & ASYNC OPERATIONS
// ============================================================================

/**
 * Tarea en cola
 */
export interface QueuedTask {
  id: string;
  type: string;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

/**
 * Evento de llamada saliente
 */
export interface OutboundCallPayload {
  patient_id?: string;
  phone_number: string;
  message?: string;
  callbackUrl?: string;
  priority?: 'low' | 'normal' | 'high';
  scheduledFor?: Date;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuración global de la aplicación
 */
export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  port: number;
  host: string;
  database: DatabaseConfig;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  cors: {
    origins: string[];
  };
  logging: {
    level: LogLevel;
    format: 'json' | 'text';
  };
  services: {
    elevenLabs?: ExternalServiceConfig;
    zadarma?: ExternalServiceConfig;
    mailService?: ExternalServiceConfig;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ApiError,
  ErrorCodes,
};
