import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Esquema para solicitud de asignación automática
const autoAssignmentSchema = z.object({
  patient_id: z.number().int(),
  specialty_id: z.number().int(),
  location_id: z.number().int().optional(),
  preferred_doctor_id: z.number().int().optional(),
  urgency_level: z.enum(['Baja', 'Media', 'Alta', 'Urgente']).default('Media'),
  appointment_type: z.enum(['Presencial', 'Telemedicina']).default('Presencial'),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  reason: z.string().optional(),
  insurance_type: z.string().optional(),
  notes: z.string().optional(),
  search_days_ahead: z.number().int().min(1).max(90).default(30),
  preferred_time_slots: z.array(z.string()).optional(), // ['09:00-12:00', '14:00-17:00']
});

// Algoritmo de asignación inteligente con fallback a cola
router.post('/smart-assign', requireAuth, async (req: Request, res: Response) => {
  const parsed = autoAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: parsed.error.flatten()
    });
  }

  const data = parsed.data;
  const userId = (req as any).user?.id;

  try {
    // 1. Obtener información del paciente
    const [patientRows] = await pool.query(
      'SELECT * FROM patients WHERE id = ?',
      [data.patient_id]
    );

    if (!Array.isArray(patientRows) || patientRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    const patient = patientRows[0];

    // 2. Intentar asignación automática de cita
    try {
      const bestSlots = await findBestAvailableSlots(data);

      if (bestSlots.length > 0) {
        // Encontrar slot disponible - crear cita
        const bestSlot = selectBestSlot(bestSlots, data);

        const appointmentData = {
          patient_id: data.patient_id,
          availability_id: bestSlot.availability_id,
          location_id: bestSlot.location_id,
          specialty_id: data.specialty_id,
          doctor_id: bestSlot.doctor_id,
          scheduled_at: bestSlot.scheduled_at,
          duration_minutes: data.duration_minutes,
          appointment_type: data.appointment_type,
          status: 'Confirmada',
          reason: data.reason,
          insurance_type: data.insurance_type,
          notes: data.notes,
          manual: false
        };

        // Insertar cita
        const [result] = await pool.query(
          'INSERT INTO appointments SET ?',
          [appointmentData]
        );

        const appointmentId = (result as any).insertId;

        // Actualizar contador de cupos ocupados
        await pool.query(
          'UPDATE availabilities SET booked_slots = booked_slots + 1 WHERE id = ?',
          [bestSlot.availability_id]
        );

        // Marcar disponibilidad como completa si es necesario
        await pool.query(
          `UPDATE availabilities SET status = 'Completa'
           WHERE id = ? AND booked_slots >= capacity`,
          [bestSlot.availability_id]
        );

        // Obtener detalles completos de la cita creada
        const [appointmentDetails] = await pool.query(
          `SELECT a.*,
                  p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
                  d.name AS doctor_name, s.name AS specialty_name, l.name AS location_name
           FROM appointments a
           JOIN patients p ON p.id = a.patient_id
           JOIN doctors d ON d.id = a.doctor_id
           JOIN specialties s ON s.id = a.specialty_id
           JOIN locations l ON l.id = a.location_id
           WHERE a.id = ?`,
          [appointmentId]
        );

        return res.json({
          success: true,
          assignment_type: 'appointment',
          message: 'Cita asignada automáticamente exitosamente',
          data: {
            appointment: (appointmentDetails as any[])[0],
            assignment_score: bestSlot.score,
            alternatives_count: bestSlots.length - 1
          }
        });
      }
    } catch (appointmentError) {
      console.log('Error en asignación de cita, intentando cola:', appointmentError);
    }

    // 3. Si no hay citas disponibles, agregar a cola automáticamente
    try {
      // Mapear urgencia a prioridad de cola
      const priority = data.urgency_level === 'Urgente' || data.urgency_level === 'Alta' ? 'Alta' : 
                      data.urgency_level === 'Baja' ? 'Baja' : 'Normal';

      // Verificar si ya está en cola para evitar duplicados
      const [existingQueue] = await pool.query(
        `SELECT id FROM queue_entries 
         WHERE status='waiting' AND patient_id = ? AND specialty_id = ? 
         ORDER BY created_at ASC LIMIT 1`,
        [data.patient_id, data.specialty_id]
      );

      let queueId;
      if (Array.isArray(existingQueue) && existingQueue.length) {
        queueId = (existingQueue as any)[0].id;
      } else {
        // Crear nueva entrada en cola
        const [queueResult] = await pool.query(
          `INSERT INTO queue_entries (patient_id, specialty_id, priority, reason, phone)
           VALUES (?, ?, ?, ?, ?)`,
          [data.patient_id, data.specialty_id, priority, data.reason || null, (patient as any).phone || null]
        );
        queueId = (queueResult as any).insertId;
      }

      // Obtener posición en cola
      const [positionResult] = await pool.query(
        `SELECT COUNT(*) + 1 as position
         FROM queue_entries 
         WHERE status = 'waiting' AND specialty_id = ? AND created_at < (
           SELECT created_at FROM queue_entries WHERE id = ?
         )`,
        [data.specialty_id, queueId]
      );

      const position = Array.isArray(positionResult) && positionResult.length ? 
                      (positionResult as any)[0].position : 1;

      // Obtener nombre de especialidad
      const [specialtyResult] = await pool.query(
        'SELECT name FROM specialties WHERE id = ?',
        [data.specialty_id]
      );

      const specialtyName = Array.isArray(specialtyResult) && specialtyResult.length ?
                           (specialtyResult as any)[0].name : 'Especialidad';

      return res.json({
        success: true,
        assignment_type: 'queue',
        message: `No hay citas disponibles. Paciente agregado a cola de espera en posición ${position}`,
        data: {
          queue_entry: {
            id: queueId,
            position: position,
            specialty_name: specialtyName,
            priority: priority,
            estimated_wait_minutes: position * 15 // Estimación simple
          }
        }
      });

    } catch (queueError) {
      throw new Error(`Error agregando a cola: ${queueError}`);
    }

  } catch (error) {
    console.error('Error en asignación inteligente:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Algoritmo de asignación automática inteligente (original)
router.post('/auto-assign', requireAuth, async (req: Request, res: Response) => {
  const parsed = autoAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: parsed.error.flatten()
    });
  }

  const data = parsed.data;
  const userId = (req as any).user?.id;

  try {
    // 1. Obtener información del paciente
    const [patientRows] = await pool.query(
      'SELECT * FROM patients WHERE id = ?',
      [data.patient_id]
    );

    if (!Array.isArray(patientRows) || patientRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    const patient = patientRows[0];

    // 2. Buscar mejores opciones de disponibilidad
    const bestSlots = await findBestAvailableSlots(data);

    if (bestSlots.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron disponibilidades disponibles para los criterios especificados'
      });
    }

    // 3. Seleccionar la mejor opción basada en algoritmo de puntuación
    const bestSlot = selectBestSlot(bestSlots, data);

    // 4. Crear la cita automáticamente
    const appointmentData = {
      patient_id: data.patient_id,
      availability_id: bestSlot.availability_id,
      location_id: bestSlot.location_id,
      specialty_id: data.specialty_id,
      doctor_id: bestSlot.doctor_id,
      scheduled_at: bestSlot.scheduled_at,
      duration_minutes: data.duration_minutes,
      appointment_type: data.appointment_type,
      status: 'Confirmada', // Automáticamente confirmada
      reason: data.reason,
      insurance_type: data.insurance_type,
      notes: data.notes,
      manual: false
    };

    // Insertar cita
    const [result] = await pool.query(
      'INSERT INTO appointments SET ?',
      [appointmentData]
    );

    const appointmentId = (result as any).insertId;

    // 5. Actualizar contador de cupos ocupados
    await pool.query(
      'UPDATE availabilities SET booked_slots = booked_slots + 1 WHERE id = ?',
      [bestSlot.availability_id]
    );

    // 6. Marcar disponibilidad como completa si es necesario
    await pool.query(
      `UPDATE availabilities
       SET status = 'Completa'
       WHERE id = ? AND booked_slots >= capacity`,
      [bestSlot.availability_id]
    );

    // 7. Obtener detalles completos de la cita creada
    const [appointmentDetails] = await pool.query(
      `SELECT a.*,
              p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
              d.name AS doctor_name, s.name AS specialty_name, l.name AS location_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       WHERE a.id = ?`,
      [appointmentId]
    );

    return res.json({
      success: true,
      message: 'Cita asignada automáticamente exitosamente',
      data: {
        appointment: (appointmentDetails as any[])[0],
        assignment_score: bestSlot.score,
        alternatives_count: bestSlots.length - 1
      }
    });

  } catch (error) {
    console.error('Error en asignación automática:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Función para encontrar mejores slots disponibles
async function findBestAvailableSlots(data: any): Promise<any[]> {
  const { specialty_id, location_id, preferred_doctor_id, search_days_ahead, preferred_time_slots } = data;

  // Construir consulta base
  let query = `
    SELECT
      a.id as availability_id,
      a.doctor_id,
      a.location_id,
      a.date,
      a.start_time,
      a.end_time,
      a.capacity,
      a.booked_slots,
      d.name as doctor_name,
      s.name as specialty_name,
      l.name as location_name,
      (a.capacity - a.booked_slots) as available_slots,
      -- Calcular score basado en múltiples factores
      (
        -- Preferencia por doctor específico (50 puntos)
        CASE WHEN a.doctor_id = ? THEN 50 ELSE 0 END +
        -- Preferencia por ubicación específica (30 puntos)
        CASE WHEN a.location_id = ? THEN 30 ELSE 0 END +
        -- Disponibilidad alta (20 puntos)
        CASE WHEN (a.capacity - a.booked_slots) >= 3 THEN 20
             WHEN (a.capacity - a.booked_slots) >= 2 THEN 15
             WHEN (a.capacity - a.booked_slots) >= 1 THEN 10
             ELSE 5 END +
        -- Franja horaria preferida (20 puntos)
        CASE WHEN ? IS NOT NULL AND
             JSON_CONTAINS(?, JSON_QUOTE(TIME_FORMAT(a.start_time, '%H:%i'))) THEN 20 ELSE 0 END +
        -- Día más cercano (10 puntos)
        CASE WHEN DATEDIFF(a.date, CURDATE()) = 0 THEN 10
             WHEN DATEDIFF(a.date, CURDATE()) = 1 THEN 8
             WHEN DATEDIFF(a.date, CURDATE()) = 2 THEN 6
             WHEN DATEDIFF(a.date, CURDATE()) <= 7 THEN 4
             ELSE 2 END
      ) as score
    FROM availabilities a
    JOIN doctors d ON d.id = a.doctor_id
    JOIN specialties s ON s.id = a.specialty_id
    JOIN locations l ON l.id = a.location_id
    WHERE a.status = 'Activa'
    AND a.date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
    AND (a.capacity - a.booked_slots) > 0
    AND s.id = ?
  `;

  const params = [
    preferred_doctor_id || null,
    location_id || null,
    preferred_time_slots ? JSON.stringify(preferred_time_slots) : null,
    preferred_time_slots ? JSON.stringify(preferred_time_slots) : null,
    search_days_ahead,
    specialty_id
  ];

  // Agregar filtros opcionales
  if (location_id) {
    query += ' AND a.location_id = ?';
    params.push(location_id);
  }

  if (preferred_doctor_id) {
    query += ' AND a.doctor_id = ?';
    params.push(preferred_doctor_id);
  }

  query += ' ORDER BY score DESC, a.date ASC, a.start_time ASC LIMIT 20';

  let rows: any[] = [];
  try {
    const [r] = await pool.query(query, params);
    rows = r as any[];
  } catch (err: any) {
    // Safe-mode si faltan tablas
    if (err?.code === 'ER_NO_SUCH_TABLE' || err?.errno === 1146) {
      return [];
    }
    throw err;
  }

  // Generar slots específicos de tiempo para cada disponibilidad
  const slots = [];
  for (const availability of rows as any[]) {
    const timeSlots = generateTimeSlots(availability, data.duration_minutes);
    for (const slot of timeSlots) {
      slots.push({
        ...availability,
        scheduled_at: slot,
        time_slot: slot
      });
    }
  }

  return slots;
}

// Función para generar slots de tiempo disponibles
function generateTimeSlots(availability: any, durationMinutes: number): string[] {
  const slots = [];
  const startTime = new Date(`2000-01-01T${availability.start_time}`);
  const endTime = new Date(`2000-01-01T${availability.end_time}`);
  const slotDuration = durationMinutes * 60 * 1000; // en milisegundos

  let currentTime = new Date(startTime);

  while (currentTime.getTime() + slotDuration <= endTime.getTime()) {
    const slotTime = `${availability.date} ${currentTime.toTimeString().slice(0, 5)}:00`;
    slots.push(slotTime);
    currentTime = new Date(currentTime.getTime() + slotDuration);
  }

  return slots;
}

// Función para seleccionar el mejor slot
function selectBestSlot(slots: any[], data: any): any {
  if (slots.length === 0) return null;

  // Para urgencias, seleccionar el slot más cercano
  if (data.urgency_level === 'Urgente') {
    return slots[0];
  }

  // Para otros casos, usar el score más alto
  return slots.reduce((best, current) =>
    current.score > best.score ? current : best
  );
}

// Endpoint para obtener sugerencias de asignación
router.post('/suggestions', requireAuth, async (req: Request, res: Response) => {
  const parsed = autoAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: parsed.error.flatten()
    });
  }

  const data = parsed.data;

  try {
    const suggestions = await findBestAvailableSlots(data);

    // Limitar a top 5 sugerencias
    const topSuggestions = suggestions.slice(0, 5);

    return res.json({
      success: true,
      data: {
        suggestions: topSuggestions,
        total_found: suggestions.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo sugerencias:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
