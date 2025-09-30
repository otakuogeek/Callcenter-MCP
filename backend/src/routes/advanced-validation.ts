import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Esquema para validación avanzada de citas
const advancedValidationSchema = z.object({
  patient_id: z.number().int(),
  availability_id: z.number().int().optional(),
  location_id: z.number().int(),
  specialty_id: z.number().int(),
  doctor_id: z.number().int(),
  room_id: z.number().int().optional(),
  scheduled_at: z.string(),
  duration_minutes: z.number().int().min(5).max(480),
  appointment_type: z.enum(['Presencial', 'Telemedicina']),
  status: z.enum(['Pendiente', 'Confirmada', 'Completada', 'Cancelada']),
  reason: z.string().optional(),
  insurance_type: z.string().optional(),
  notes: z.string().optional(),
  cancellation_reason: z.string().optional(),
  priority_level: z.enum(['Baja', 'Media', 'Alta', 'Urgente']).default('Media'),
  requires_special_equipment: z.boolean().default(false),
  is_follow_up: z.boolean().default(false),
  parent_appointment_id: z.number().int().optional(),
});

// Servicio de validaciones avanzadas
router.post('/validate-appointment', requireAuth, async (req: Request, res: Response) => {
  const parsed = advancedValidationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: parsed.error.flatten()
    });
  }

  const data = parsed.data;

  try {
    const validationResults = await performAdvancedValidation(data);

    return res.json({
      success: true,
      data: {
        is_valid: validationResults.isValid,
        conflicts: validationResults.conflicts,
        warnings: validationResults.warnings,
        suggestions: validationResults.suggestions,
        score: validationResults.score
      }
    });

  } catch (error) {
    console.error('Error en validación avanzada:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Función principal de validación avanzada
async function performAdvancedValidation(data: any): Promise<{
  isValid: boolean;
  conflicts: any[];
  warnings: any[];
  suggestions: any[];
  score: number;
}> {
  const conflicts: any[] = [];
  const warnings: any[] = [];
  const suggestions: any[] = [];
  let score = 100; // Puntaje inicial perfecto

  // 1. Validación de conflictos de horario del doctor
  const doctorConflicts = await validateDoctorScheduleConflicts(data);
  if (doctorConflicts.hasConflicts) {
    conflicts.push({
      type: 'doctor_schedule',
      severity: 'high',
      message: 'Conflicto de horario con el doctor',
      details: doctorConflicts.details
    });
    score -= 30;
  }

  // 2. Validación de conflictos de horario del paciente
  const patientConflicts = await validatePatientScheduleConflicts(data);
  if (patientConflicts.hasConflicts) {
    conflicts.push({
      type: 'patient_schedule',
      severity: 'high',
      message: 'Conflicto de horario con el paciente',
      details: patientConflicts.details
    });
    score -= 25;
  }

  // 3. Validación de sala/consultorio (si aplica)
  if (data.room_id) {
    const roomConflicts = await validateRoomConflicts(data);
    if (roomConflicts.hasConflicts) {
      conflicts.push({
        type: 'room_schedule',
        severity: 'high',
        message: 'Sala/consultorio no disponible',
        details: roomConflicts.details
      });
      score -= 20;
    }
  }

  // 4. Validación de capacidad de disponibilidad
  const capacityValidation = await validateAvailabilityCapacity(data);
  if (!capacityValidation.isValid) {
    conflicts.push({
      type: 'capacity_exceeded',
      severity: 'high',
      message: 'Capacidad de disponibilidad excedida',
      details: capacityValidation.details
    });
    score -= 25;
  }

  // 5. Validaciones de negocio
  const businessValidations = await validateBusinessRules(data);
  warnings.push(...businessValidations.warnings);
  suggestions.push(...businessValidations.suggestions);
  score -= businessValidations.scorePenalty;

  // 6. Validaciones médicas específicas
  const medicalValidations = await validateMedicalRules(data);
  warnings.push(...medicalValidations.warnings);
  suggestions.push(...medicalValidations.suggestions);
  score -= medicalValidations.scorePenalty;

  // 7. Validaciones de seguro/salud
  const insuranceValidations = await validateInsuranceRules(data);
  warnings.push(...insuranceValidations.warnings);
  suggestions.push(...insuranceValidations.suggestions);
  score -= insuranceValidations.scorePenalty;

  // Ajustar score mínimo
  score = Math.max(0, score);

  return {
    isValid: conflicts.length === 0,
    conflicts,
    warnings,
    suggestions,
    score
  };
}

// Validación de conflictos de horario del doctor
async function validateDoctorScheduleConflicts(data: any): Promise<{
  hasConflicts: boolean;
  details: any[];
}> {
  const conflicts = [];

  const [rows] = await pool.query(
    `SELECT a.id, a.scheduled_at, a.duration_minutes, a.status,
            p.name as patient_name, s.name as specialty_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN specialties s ON s.id = a.specialty_id
     WHERE a.doctor_id = ?
     AND a.status != 'Cancelada'
     AND a.scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
     AND DATE_ADD(a.scheduled_at, INTERVAL a.duration_minutes MINUTE) > ?
     AND a.id != ?`, // Excluir la cita actual si está siendo editada
    [
      data.doctor_id,
      data.scheduled_at,
      data.duration_minutes,
      data.scheduled_at,
      data.id || 0
    ]
  );

  if (Array.isArray(rows) && rows.length > 0) {
    conflicts.push(...rows);
  }

  return {
    hasConflicts: conflicts.length > 0,
    details: conflicts
  };
}

// Validación de conflictos de horario del paciente
async function validatePatientScheduleConflicts(data: any): Promise<{
  hasConflicts: boolean;
  details: any[];
}> {
  const conflicts = [];

  const [rows] = await pool.query(
    `SELECT a.id, a.scheduled_at, a.duration_minutes, a.status,
      d.name as doctor_name, s.name as specialty_name
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     JOIN specialties s ON s.id = a.specialty_id
     WHERE a.patient_id = ?
     AND a.status != 'Cancelada'
     AND a.scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
     AND DATE_ADD(a.scheduled_at, INTERVAL a.duration_minutes MINUTE) > ?
     AND a.id != ?`,
    [
      data.patient_id,
      data.scheduled_at,
      data.duration_minutes,
      data.scheduled_at,
      data.id || 0
    ]
  );

  if (Array.isArray(rows) && rows.length > 0) {
    conflicts.push(...rows);
  }

  return {
    hasConflicts: conflicts.length > 0,
    details: conflicts
  };
}

// Validación de conflictos de sala
async function validateRoomConflicts(data: any): Promise<{
  hasConflicts: boolean;
  details: any[];
}> {
  const conflicts = [];

  const [rows] = await pool.query(
    `SELECT a.id, a.scheduled_at, a.duration_minutes, a.status,
      p.name as patient_name, d.name as doctor_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN doctors d ON d.id = a.doctor_id
     WHERE a.room_id = ?
     AND a.location_id = ?
     AND a.status != 'Cancelada'
     AND a.scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
     AND DATE_ADD(a.scheduled_at, INTERVAL a.duration_minutes MINUTE) > ?
     AND a.id != ?`,
    [
      data.room_id,
      data.location_id,
      data.scheduled_at,
      data.duration_minutes,
      data.scheduled_at,
      data.id || 0
    ]
  );

  if (Array.isArray(rows) && rows.length > 0) {
    conflicts.push(...rows);
  }

  return {
    hasConflicts: conflicts.length > 0,
    details: conflicts
  };
}

// Validación de capacidad de disponibilidad
async function validateAvailabilityCapacity(data: any): Promise<{
  isValid: boolean;
  details: any;
}> {
  if (!data.availability_id) {
    return { isValid: true, details: null };
  }

  const [rows] = await pool.query(
    `SELECT capacity, booked_slots,
            (capacity - booked_slots) as available_slots
     FROM availabilities
     WHERE id = ?`,
    [data.availability_id]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      isValid: false,
      details: { message: 'Disponibilidad no encontrada' }
    };
  }

  const availability = rows[0] as any;
  const wouldExceedCapacity = (availability.booked_slots + 1) > availability.capacity;

  return {
    isValid: !wouldExceedCapacity,
    details: wouldExceedCapacity ? {
      message: 'Capacidad excedida',
      current_booked: availability.booked_slots,
      capacity: availability.capacity,
      available: availability.available_slots
    } : null
  };
}

// Validaciones de reglas de negocio
async function validateBusinessRules(data: any): Promise<{
  warnings: any[];
  suggestions: any[];
  scorePenalty: number;
}> {
  const warnings = [];
  const suggestions = [];
  let scorePenalty = 0;

  // Validar horario comercial
  const appointmentTime = new Date(data.scheduled_at);
  const hour = appointmentTime.getHours();
  const dayOfWeek = appointmentTime.getDay();

  if (hour < 7 || hour > 19) {
    warnings.push({
      type: 'business_hours',
      message: 'Cita fuera del horario comercial estándar (7:00 - 19:00)'
    });
    scorePenalty += 5;
  }

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    warnings.push({
      type: 'weekend_appointment',
      message: 'Cita programada para fin de semana'
    });
    scorePenalty += 3;
  }

  // Validar duración inusual
  if (data.duration_minutes > 120) {
    warnings.push({
      type: 'long_appointment',
      message: 'Duración de cita inusualmente larga'
    });
    suggestions.push({
      type: 'split_appointment',
      message: 'Considerar dividir la cita en sesiones más cortas'
    });
    scorePenalty += 5;
  }

  // Validar citas de último momento
  const hoursUntilAppointment = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilAppointment < 24 && data.priority_level !== 'Urgente') {
    warnings.push({
      type: 'last_minute',
      message: 'Cita programada con menos de 24 horas de anticipación'
    });
    scorePenalty += 10;
  }

  return { warnings, suggestions, scorePenalty };
}

// Validaciones médicas específicas
async function validateMedicalRules(data: any): Promise<{
  warnings: any[];
  suggestions: any[];
  scorePenalty: number;
}> {
  const warnings = [];
  const suggestions = [];
  let scorePenalty = 0;

  // Obtener información del paciente
  const [patientRows] = await pool.query(
    'SELECT age, gender, medical_conditions FROM patients WHERE id = ?',
    [data.patient_id]
  );

  if (Array.isArray(patientRows) && patientRows.length > 0) {
    const patient = patientRows[0] as any;

    // Validaciones basadas en edad
    if (patient.age < 18 && data.specialty_id === 1) { // Asumiendo que 1 es pediatría
      suggestions.push({
        type: 'pediatric_specialist',
        message: 'Considerar especialista pediátrico para pacientes menores de 18 años'
      });
    }

    // Validaciones para pacientes de edad avanzada
    if (patient.age > 65) {
      warnings.push({
        type: 'elderly_patient',
        message: 'Paciente de edad avanzada - considerar tiempo adicional'
      });
      scorePenalty += 3;
    }
  }

  // Validar especialidad vs tipo de cita
  if (data.appointment_type === 'Telemedicina' && data.requires_special_equipment) {
    warnings.push({
      type: 'telemedicine_equipment',
      message: 'Cita requiere equipo especial pero está programada como telemedicina'
    });
    suggestions.push({
      type: 'change_to_presential',
      message: 'Cambiar a cita presencial para acceso a equipo necesario'
    });
    scorePenalty += 15;
  }

  return { warnings, suggestions, scorePenalty };
}

// Validaciones de seguro/salud
async function validateInsuranceRules(data: any): Promise<{
  warnings: any[];
  suggestions: any[];
  scorePenalty: number;
}> {
  const warnings = [];
  const suggestions = [];
  let scorePenalty = 0;

  if (data.insurance_type) {
    // Verificar cobertura de seguro para la especialidad
    const [insuranceRows] = await pool.query(
      `SELECT coverage_percentage, requires_authorization
       FROM insurance_coverage
       WHERE insurance_type = ? AND specialty_id = ?`,
      [data.insurance_type, data.specialty_id]
    );

    if (Array.isArray(insuranceRows) && insuranceRows.length > 0) {
      const coverage = insuranceRows[0] as any;

      if (coverage.coverage_percentage < 50) {
        warnings.push({
          type: 'low_coverage',
          message: `Cobertura baja (${coverage.coverage_percentage}%) para esta especialidad`
        });
        scorePenalty += 5;
      }

      if (coverage.requires_authorization) {
        warnings.push({
          type: 'authorization_required',
          message: 'Esta especialidad requiere autorización previa del seguro'
        });
        suggestions.push({
          type: 'obtain_authorization',
          message: 'Obtener autorización del seguro antes de confirmar la cita'
        });
        scorePenalty += 10;
      }
    }
  }

  return { warnings, suggestions, scorePenalty };
}

export default router;
