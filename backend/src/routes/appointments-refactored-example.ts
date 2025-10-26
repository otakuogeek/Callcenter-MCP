/**
 * EJEMPLO DE REFACTORIZACIÓN - Appointments (Fase 1)
 * 
 * Este archivo muestra cómo refactorizar el endpoint GET /appointments
 * aplicando los patrones de Fase 1:
 * 
 * ✅ Tipos tipados (ApiSuccessResponse)
 * ✅ Error handling centralizado (AppError)
 * ✅ Logger centralizado (logger)
 * ✅ Validación middleware (validateQuery)
 * ✅ AsyncHandler wrapper
 * 
 * ANTES: 1,547 líneas monolíticas con console.log y error handling inconsistente
 * DESPUÉS: Separado en servicios, tipos claros, errores tipados
 * 
 * Ubicación actual: /backend/src/routes/appointments.ts (MONOLITO)
 * Ubicación nueva:
 *   - /backend/src/routes/appointments/index.ts (router)
 *   - /backend/src/services/appointmentService.ts (lógica de negocio)
 *   - /backend/src/types/appointments.ts (tipos)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validate';
import { asyncHandler, AppError, ensureFound } from '../middleware/errorHandler';
import { logger } from '../lib/logger';
import { ApiSuccessResponse, PaginatedResponse, Patient } from '../types';
import pool from '../db/pool';

const router = Router();

// ============================================================================
// SCHEMAS DE VALIDACIÓN (Tipado automático)
// ============================================================================

const listAppointmentsQuerySchema = z.object({
  status: z.enum(['Pendiente', 'Confirmada', 'Completada', 'Cancelada']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  patient_id: z.coerce.number().int().positive().optional(),
  availability_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['scheduled_at', 'created_at', 'status']).default('scheduled_at'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});

const createAppointmentSchema = z.object({
  patient_id: z.number().int().positive(),
  availability_id: z.number().int().positive().nullable().optional(),
  location_id: z.number().int().positive(),
  specialty_id: z.number().int().positive(),
  doctor_id: z.number().int().positive(),
  scheduled_at: z.string().datetime(),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  appointment_type: z.enum(['Presencial', 'Telemedicina']).default('Presencial'),
  status: z.enum(['Pendiente', 'Confirmada', 'Completada', 'Cancelada']).default('Pendiente'),
  reason: z.string().optional(),
  priority_level: z.enum(['Baja', 'Normal', 'Alta', 'Urgente']).default('Normal'),
  symptoms: z.string().optional(),
  insurance_policy_number: z.string().optional(),
});

// ============================================================================
// TIPOS (Exportables y reutilizables)
// ============================================================================

interface AppointmentQueryParams {
  status?: string;
  date?: string;
  patient_id?: number;
  availability_id?: number;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

interface AppointmentDetail {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_document: string;
  patient_phone: string;
  patient_email: string;
  patient_birth_date: string;
  age: number;
  patient_eps: string;
  doctor_id: number;
  doctor_name: string;
  specialty_id: number;
  specialty_name: string;
  location_id: number;
  location_name: string;
  scheduled_at: string;
  duration_minutes: number;
  appointment_type: string;
  status: string;
  reason?: string;
  priority_level: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SERVICIOS (Lógica de negocio separada)
// ============================================================================

/**
 * Obtener listado de citas con filtros y paginación
 */
async function listAppointments(
  params: AppointmentQueryParams
): Promise<{ data: AppointmentDetail[]; total: number }> {
  const filters: string[] = [];
  const values: any[] = [];

  // Construir cláusula WHERE dinámicamente
  if (params.status) {
    filters.push('a.status = ?');
    values.push(params.status);
  }
  if (params.date) {
    filters.push('DATE(a.scheduled_at) = ?');
    values.push(params.date);
  }
  if (params.patient_id) {
    filters.push('a.patient_id = ?');
    values.push(params.patient_id);
  }
  if (params.availability_id) {
    filters.push('a.availability_id = ?');
    values.push(params.availability_id);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  // Calcular OFFSET
  const offset = (params.page - 1) * params.limit;

  try {
    // Obtener total de registros
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM appointments a ${whereClause}`,
      values
    );
    const total = (countResult as any)[0].total;

    // Obtener datos paginados
    const [rows] = await pool.query(
      `SELECT 
        a.id,
        a.patient_id,
        p.name AS patient_name,
        p.document AS patient_document,
        p.phone AS patient_phone,
        p.email AS patient_email,
        p.birth_date AS patient_birth_date,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) AS age,
        eps.name AS patient_eps,
        a.doctor_id,
        d.name AS doctor_name,
        a.specialty_id,
        s.name AS specialty_name,
        a.location_id,
        l.name AS location_name,
        a.scheduled_at,
        a.duration_minutes,
        a.appointment_type,
        a.status,
        a.reason,
        a.priority_level,
        a.created_at,
        a.updated_at
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       ${whereClause}
       ORDER BY a.${params.sortBy} ${params.sortOrder}
       LIMIT ? OFFSET ?`,
      [...values, params.limit, offset]
    );

    return {
      data: (rows as any[]) || [],
      total,
    };
  } catch (error) {
    logger.error('Failed to list appointments', error as Error, {
      filters,
      params,
    });
    throw AppError.internalError('Failed to retrieve appointments');
  }
}

/**
 * Obtener una cita por ID
 */
async function getAppointmentById(id: number): Promise<AppointmentDetail> {
  try {
    const [rows] = await pool.query(
      `SELECT 
        a.id,
        a.patient_id,
        p.name AS patient_name,
        p.document AS patient_document,
        p.phone AS patient_phone,
        p.email AS patient_email,
        p.birth_date AS patient_birth_date,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) AS age,
        eps.name AS patient_eps,
        a.doctor_id,
        d.name AS doctor_name,
        a.specialty_id,
        s.name AS specialty_name,
        a.location_id,
        l.name AS location_name,
        a.scheduled_at,
        a.duration_minutes,
        a.appointment_type,
        a.status,
        a.reason,
        a.priority_level,
        a.created_at,
        a.updated_at
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       WHERE a.id = ?`,
      [id]
    );

    const appointment = ensureFound(
      (rows as any[])?.[0],
      'Appointment'
    );

    return appointment;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to get appointment', error as Error, { id });
    throw AppError.internalError('Failed to retrieve appointment');
  }
}

// ============================================================================
// RUTAS (Controllers delgados, delegando a servicios)
// ============================================================================

/**
 * GET /appointments
 * Listar citas con filtros y paginación
 * 
 * Query params:
 *   - status: enum
 *   - date: YYYY-MM-DD
 *   - patient_id: number
 *   - availability_id: number
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
 *   - sortBy: 'scheduled_at' | 'created_at' | 'status'
 *   - sortOrder: 'ASC' | 'DESC'
 */
router.get(
  '/',
  requireAuth,
  validateQuery(listAppointmentsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const params = (req as any).validatedQuery as AppointmentQueryParams;

    logger.info('Listing appointments', {
      userId: (req as any).user?.id,
      filters: {
        status: params.status,
        date: params.date,
        patient_id: params.patient_id,
      },
      pagination: {
        page: params.page,
        limit: params.limit,
      },
    });

    const { data, total } = await listAppointments(params);

    const pages = Math.ceil(total / params.limit);
    const response: PaginatedResponse<AppointmentDetail> = {
      success: true,
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        pages,
      },
    };

    res.json(response);
  })
);

/**
 * GET /appointments/:id
 * Obtener detalle de una cita
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw AppError.badRequest('Invalid appointment ID');
    }

    logger.info('Getting appointment details', {
      userId: (req as any).user?.id,
      appointmentId: id,
    });

    const appointment = await getAppointmentById(id);

    const response: ApiSuccessResponse<AppointmentDetail> = {
      success: true,
      data: appointment,
      message: 'Appointment retrieved successfully',
    };

    res.json(response);
  })
);

/**
 * POST /appointments
 * Crear nueva cita
 */
router.post(
  '/',
  requireAuth,
  validateBody(createAppointmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appointmentData = (req as any).validatedBody;

    logger.info('Creating new appointment', {
      userId: (req as any).user?.id,
      patientId: appointmentData.patient_id,
      doctorId: appointmentData.doctor_id,
    });

    try {
      const [result] = await pool.query(
        `INSERT INTO appointments (
          patient_id, location_id, specialty_id, doctor_id, 
          scheduled_at, duration_minutes, appointment_type, 
          status, reason, priority_level, symptoms, insurance_policy_number,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          appointmentData.patient_id,
          appointmentData.location_id,
          appointmentData.specialty_id,
          appointmentData.doctor_id,
          appointmentData.scheduled_at,
          appointmentData.duration_minutes,
          appointmentData.appointment_type,
          appointmentData.status,
          appointmentData.reason,
          appointmentData.priority_level,
          appointmentData.symptoms,
          appointmentData.insurance_policy_number,
        ]
      );

      const appointmentId = (result as any).insertId;
      const appointment = await getAppointmentById(appointmentId);

      logger.info('Appointment created successfully', {
        userId: (req as any).user?.id,
        appointmentId,
      });

      const response: ApiSuccessResponse<AppointmentDetail> = {
        success: true,
        data: appointment,
        message: 'Appointment created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create appointment', error as Error, {
        userId: (req as any).user?.id,
      });
      throw AppError.internalError('Failed to create appointment');
    }
  })
);

export default router;

// ============================================================================
// PRÓXIMOS PASOS (Fase 2+)
// ============================================================================

/**
 * FASE 2 - REFACTORIZACIÓN COMPLETA:
 * 
 * 1. Controllers separados:
 *    - /backend/src/controllers/appointmentController.ts
 *    
 * 2. Services completos:
 *    - /backend/src/services/appointmentService.ts
 *    - Métodos: create, update, cancel, get, list, etc.
 *    
 * 3. Repository pattern (Data access):
 *    - /backend/src/repositories/appointmentRepository.ts
 *    - Aislación de queries SQL
 *    
 * 4. Tests unitarios:
 *    - /backend/src/services/__tests__/appointmentService.test.ts
 *    - /backend/src/controllers/__tests__/appointmentController.test.ts
 *    
 * 5. Validación de dominio:
 *    - Verificar disponibilidad del slot
 *    - Validar paciente existe
 *    - Verificar doctor disponible
 *    
 * RESULTADO: Código modular, testeable, type-safe, y mantenible
 */
