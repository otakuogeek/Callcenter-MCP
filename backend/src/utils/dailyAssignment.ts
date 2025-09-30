import pool from '../db/pool';

export interface DailyAssignmentResult {
  success: boolean;
  assigned: boolean;
  appointment_id?: number;
  queue_id?: number;
  message: string;
}

/**
 * Intenta asignar una cita para el día actual
 * Si no hay disponibilidad, agrega a cola de espera
 */
export async function tryAssignTodayOrQueue(params: {
  patient_id: number;
  specialty_id: number;
  doctor_id?: number;
  location_id?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
}): Promise<DailyAssignmentResult> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // 1. Verificar si el paciente ya está en cola para la misma especialidad
    const [existingQueue] = await pool.query(`
      SELECT id FROM daily_assignment_queue 
      WHERE patient_id = ? AND specialty_id = ? AND status = 'waiting'
    `, [params.patient_id, params.specialty_id]);

    if ((existingQueue as any[]).length > 0) {
      return {
        success: false,
        assigned: false,
        message: 'El paciente ya está en cola de espera para esta especialidad'
      };
    }

    // 2. Verificar si ya tiene cita programada para hoy en la misma especialidad
    const [existingAppointment] = await pool.query(`
      SELECT a.id
      FROM appointments a
      JOIN availabilities av ON av.id = a.availability_id
      WHERE a.patient_id = ? 
        AND av.specialty_id = ? 
        AND DATE(a.scheduled_at) = ?
        AND a.status IN ('Pendiente', 'Confirmada')
    `, [params.patient_id, params.specialty_id, today]);

    if ((existingAppointment as any[]).length > 0) {
      return {
        success: false,
        assigned: false,
        message: 'El paciente ya tiene una cita programada hoy para esta especialidad'
      };
    }

    // 3. Buscar disponibilidad para HOY
    const [availabilities] = await pool.query(`
      SELECT a.id, a.start_time, a.end_time,
             COALESCE(ad.quota, 0) as quota,
             COALESCE(ad.assigned, 0) as assigned,
             (COALESCE(ad.quota, 0) - COALESCE(ad.assigned, 0)) as available_slots
      FROM availabilities a
      LEFT JOIN availability_distribution ad ON ad.availability_id = a.id AND ad.day_date = ?
      WHERE a.date = ?
        AND a.specialty_id = ?
        AND (? IS NULL OR a.doctor_id = ?)
        AND (? IS NULL OR a.location_id = ?)
        AND a.status = 'Activa'
        AND (COALESCE(ad.quota, 0) - COALESCE(ad.assigned, 0)) > 0
      ORDER BY 
        CASE WHEN a.doctor_id = ? THEN 1 ELSE 2 END,
        CASE WHEN a.location_id = ? THEN 1 ELSE 2 END,
        a.start_time ASC
      LIMIT 1
    `, [
      today, today, params.specialty_id, 
      params.doctor_id, params.doctor_id,
      params.location_id, params.location_id,
      params.doctor_id || null,
      params.location_id || null
    ]);

    // 4. Si hay disponibilidad HOY, asignar directamente
    if ((availabilities as any[]).length > 0) {
      const availability = (availabilities as any[])[0];
      
      // Crear la cita
      const [appointmentResult] = await pool.query(`
        INSERT INTO appointments (
          patient_id, 
          availability_id, 
          status, 
          scheduled_at,
          created_at
        ) VALUES (?, ?, 'Pendiente', NOW(), NOW())
      `, [params.patient_id, availability.id]);

      const appointmentId = (appointmentResult as any).insertId;

      // Actualizar distribución
      await pool.query(`
        INSERT INTO availability_distribution (availability_id, day_date, quota, assigned)
        VALUES (?, ?, 1, 1)
        ON DUPLICATE KEY UPDATE assigned = assigned + 1
      `, [availability.id, today]);

      return {
        success: true,
        assigned: true,
        appointment_id: appointmentId,
        message: `Cita asignada para hoy a las ${availability.start_time}`
      };
    }

    // 5. Si NO hay disponibilidad hoy, agregar a cola de espera
    const [queueResult] = await pool.query(`
      INSERT INTO daily_assignment_queue (
        patient_id,
        specialty_id,
        doctor_id,
        location_id,
        priority,
        notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, 'waiting')
    `, [
      params.patient_id,
      params.specialty_id,
      params.doctor_id || null,
      params.location_id || null,
      params.priority || 'normal',
      params.notes || null
    ]);

    return {
      success: true,
      assigned: false,
      queue_id: (queueResult as any).insertId,
      message: 'No hay disponibilidad hoy. Paciente agregado a cola de espera'
    };

  } catch (error: any) {
    console.error('Error in tryAssignTodayOrQueue:', error);
    return {
      success: false,
      assigned: false,
      message: `Error al procesar solicitud: ${error.message}`
    };
  }
}

/**
 * Verificar disponibilidades de HOY por especialidad
 */
export async function getTodayAvailability(specialty_id: number, doctor_id?: number, location_id?: number) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.id,
        a.doctor_id,
        d.name as doctor_name,
        a.location_id,
        l.name as location_name,
        a.start_time,
        a.end_time,
        COALESCE(ad.quota, 0) as total_quota,
        COALESCE(ad.assigned, 0) as assigned_quota,
        (COALESCE(ad.quota, 0) - COALESCE(ad.assigned, 0)) as available_slots
      FROM availabilities a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN locations l ON l.id = a.location_id
      LEFT JOIN availability_distribution ad ON ad.availability_id = a.id AND ad.day_date = ?
      WHERE a.date = ?
        AND a.specialty_id = ?
        AND (? IS NULL OR a.doctor_id = ?)
        AND (? IS NULL OR a.location_id = ?)
        AND a.status = 'Activa'
      ORDER BY a.start_time ASC
    `, [
      today, today, specialty_id,
      doctor_id, doctor_id,
      location_id, location_id
    ]);

    return rows;
  } catch (error) {
    console.error('Error fetching today availability:', error);
    return [];
  }
}

/**
 * Obtener estadísticas de asignación diaria
 */
export async function getDailyAssignmentStats() {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Estadísticas generales del día
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT a.id) as total_availabilities,
        SUM(COALESCE(ad.quota, 0)) as total_quota,
        SUM(COALESCE(ad.assigned, 0)) as total_assigned,
        (SUM(COALESCE(ad.quota, 0)) - SUM(COALESCE(ad.assigned, 0))) as remaining_slots
      FROM availabilities a
      LEFT JOIN availability_distribution ad ON ad.availability_id = a.id AND ad.day_date = ?
      WHERE a.date = ? AND a.status = 'Activa'
    `, [today, today]);

    // Cola de espera actual
    const [queueStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_waiting,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN priority = 'normal' THEN 1 END) as normal_count,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_count,
        AVG(TIMESTAMPDIFF(MINUTE, created_at, NOW())) as avg_waiting_minutes
      FROM daily_assignment_queue 
      WHERE status = 'waiting'
    `);

    // Por especialidad
    const [bySpecialty] = await pool.query(`
      SELECT 
        s.name as specialty_name,
        COUNT(DISTINCT a.id) as availabilities,
        SUM(COALESCE(ad.quota, 0)) as quota,
        SUM(COALESCE(ad.assigned, 0)) as assigned,
        (SUM(COALESCE(ad.quota, 0)) - SUM(COALESCE(ad.assigned, 0))) as remaining,
        (SELECT COUNT(*) FROM daily_assignment_queue daq WHERE daq.specialty_id = s.id AND daq.status = 'waiting') as queue_count
      FROM specialties s
      LEFT JOIN availabilities a ON a.specialty_id = s.id AND a.date = ? AND a.status = 'Activa'
      LEFT JOIN availability_distribution ad ON ad.availability_id = a.id AND ad.day_date = ?
      GROUP BY s.id, s.name
      ORDER BY remaining DESC
    `, [today, today]);

    return {
      today: (todayStats as any[])[0] || {},
      queue: (queueStats as any[])[0] || {},
      by_specialty: bySpecialty || []
    };
  } catch (error) {
    console.error('Error fetching daily assignment stats:', error);
    return {
      today: {},
      queue: {},
      by_specialty: []
    };
  }
}

/**
 * Proceso automático de asignación desde cola de espera
 * Se ejecuta periódicamente para asignar automáticamente cuando hay nuevos cupos
 */
export async function processWaitingQueue(): Promise<{processed: number, assigned: number, errors: string[]}> {
  const today = new Date().toISOString().split('T')[0];
  const errors: string[] = [];
  let processed = 0;
  let assigned = 0;

  try {
    // Obtener pacientes en cola de espera ordenados por prioridad y tiempo
    const [queueItems] = await pool.query(`
      SELECT daq.*, p.name as patient_name
      FROM daily_assignment_queue daq
      JOIN patients p ON p.id = daq.patient_id
      WHERE daq.status = 'waiting'
      ORDER BY 
        CASE daq.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2  
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        daq.created_at ASC
      LIMIT 20
    `);

    for (const queueItem of (queueItems as any[])) {
      processed++;
      
      try {
        // Buscar disponibilidad para este paciente
        const [availabilities] = await pool.query(`
          SELECT a.id
          FROM availabilities a
          LEFT JOIN availability_distribution ad ON ad.availability_id = a.id AND ad.day_date = ?
          WHERE a.date = ?
            AND a.specialty_id = ?
            AND (? IS NULL OR a.doctor_id = ?)
            AND (? IS NULL OR a.location_id = ?)
            AND a.status = 'Activa'
            AND (COALESCE(ad.quota, 0) - COALESCE(ad.assigned, 0)) > 0
          ORDER BY a.start_time ASC
          LIMIT 1
        `, [
          today, today, queueItem.specialty_id,
          queueItem.doctor_id, queueItem.doctor_id,
          queueItem.location_id, queueItem.location_id
        ]);

        if ((availabilities as any[]).length > 0) {
          const availability = (availabilities as any[])[0];
          
          // Crear la cita
          const [appointmentResult] = await pool.query(`
            INSERT INTO appointments (
              patient_id, 
              availability_id, 
              status, 
              scheduled_at,
              created_at
            ) VALUES (?, ?, 'Pendiente', NOW(), NOW())
          `, [queueItem.patient_id, availability.id]);

          const appointmentId = (appointmentResult as any).insertId;

          // Actualizar registro en cola
          await pool.query(`
            UPDATE daily_assignment_queue 
            SET status = 'assigned',
                assigned_at = NOW(),
                appointment_id = ?
            WHERE id = ?
          `, [appointmentId, queueItem.id]);

          // Actualizar distribución
          await pool.query(`
            INSERT INTO availability_distribution (availability_id, day_date, quota, assigned)
            VALUES (?, ?, 1, 1)
            ON DUPLICATE KEY UPDATE assigned = assigned + 1
          `, [availability.id, today]);

          assigned++;
        }
      } catch (error: any) {
        errors.push(`Error processing queue item ${queueItem.id} for ${queueItem.patient_name}: ${error.message}`);
      }
    }

    return { processed, assigned, errors };
  } catch (error: any) {
    errors.push(`Error in processWaitingQueue: ${error.message}`);
    return { processed, assigned, errors };
  }
}