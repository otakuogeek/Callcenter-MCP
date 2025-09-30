import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';
import { 
  tryAssignTodayOrQueue, 
  getTodayAvailability, 
  getDailyAssignmentStats,
  processWaitingQueue 
} from '../utils/dailyAssignment';

const router = Router();

// Schema para agregar paciente a cola
const addToQueueSchema = z.object({
  patient_id: z.number().int().positive(),
  specialty_id: z.number().int().positive(),
  doctor_id: z.number().int().positive().optional(),
  location_id: z.number().int().positive().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  requested_date: z.string().optional(),
  notes: z.string().optional()
});

// Schema para asignación manual
const manualAssignSchema = z.object({
  queue_id: z.number().int().positive(),
  availability_id: z.number().int().positive(),
  assigned_by_user_id: z.number().int().positive()
});

// GET /api/daily-queue - Obtener cola de espera actual
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { specialty_id, status = 'waiting', limit = '50' } = req.query;

    let whereConditions = ['1=1'];
    const params: any[] = [];

    if (specialty_id) {
      whereConditions.push('daq.specialty_id = ?');
      params.push(Number(specialty_id));
    }

    if (status) {
      whereConditions.push('daq.status = ?');
      params.push(status);
    }

    const query = `
      SELECT 
        daq.id,
        daq.patient_id,
        p.name as patient_name,
        p.document as patient_document,
        p.phone as patient_phone,
        daq.specialty_id,
        s.name as specialty_name,
        daq.doctor_id,
        d.name as doctor_name,
        daq.location_id,
        l.name as location_name,
        daq.priority,
        daq.requested_date,
        daq.status,
        daq.notes,
        daq.created_at,
        daq.assigned_at,
        daq.assigned_by_user_id,
        u.full_name as assigned_by_name,
        daq.appointment_id,
        TIMESTAMPDIFF(MINUTE, daq.created_at, NOW()) as waiting_minutes,
        (SELECT COUNT(*) + 1 
         FROM daily_assignment_queue daq2 
         WHERE daq2.specialty_id = daq.specialty_id 
           AND daq2.status = 'waiting' 
           AND daq2.created_at < daq.created_at
        ) as queue_position
      FROM daily_assignment_queue daq
      JOIN patients p ON p.id = daq.patient_id
      JOIN specialties s ON s.id = daq.specialty_id
      LEFT JOIN doctors d ON d.id = daq.doctor_id
      LEFT JOIN locations l ON l.id = daq.location_id
      LEFT JOIN users u ON u.id = daq.assigned_by_user_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE daq.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2  
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        daq.created_at ASC
      LIMIT ?
    `;

    params.push(Number(limit));

    const [rows] = await pool.query(query, params);
    
    return res.json({
      success: true,
      data: rows,
      total: (rows as any[]).length
    });
  } catch (error: any) {
    console.error('Error fetching daily queue:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener la cola de espera', 
      error: error.message 
    });
  }
});

// POST /api/daily-queue - Agregar paciente a cola de espera
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = addToQueueSchema.parse(req.body);

    // Verificar si el paciente ya está en cola para la misma especialidad
    const [existing] = await pool.query(`
      SELECT id FROM daily_assignment_queue 
      WHERE patient_id = ? AND specialty_id = ? AND status = 'waiting'
    `, [data.patient_id, data.specialty_id]);

    if ((existing as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El paciente ya está en cola de espera para esta especialidad'
      });
    }

    // Verificar disponibilidad para hoy antes de agregar a cola
    const today = new Date().toISOString().split('T')[0];
    const [availabilities] = await pool.query(`
      SELECT a.id, 
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
      ORDER BY a.start_time ASC
      LIMIT 1
    `, [today, today, data.specialty_id, data.doctor_id, data.doctor_id, data.location_id, data.location_id]);

    // Si hay disponibilidad hoy, asignar directamente
    if ((availabilities as any[]).length > 0) {
      const availability = (availabilities as any[])[0];
      
      // Crear cita directamente
      const [appointmentResult] = await pool.query(`
        INSERT INTO appointments (
          patient_id, 
          availability_id, 
          status, 
          scheduled_at,
          created_at
        ) VALUES (?, ?, 'Programada', NOW(), NOW())
      `, [data.patient_id, availability.id]);

      const appointmentId = (appointmentResult as any).insertId;

      // Actualizar distribución
      await pool.query(`
        INSERT INTO availability_distribution (availability_id, day_date, quota, assigned)
        VALUES (?, ?, 1, 1)
        ON DUPLICATE KEY UPDATE assigned = assigned + 1
      `, [availability.id, today]);

      return res.json({
        success: true,
        message: 'Cita asignada directamente para hoy',
        data: {
          appointment_id: appointmentId,
          availability_id: availability.id,
          assigned_immediately: true
        }
      });
    }

    // Si no hay disponibilidad hoy, agregar a cola de espera
    const [result] = await pool.query(`
      INSERT INTO daily_assignment_queue (
        patient_id,
        specialty_id,
        doctor_id,
        location_id,
        priority,
        requested_date,
        notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting')
    `, [
      data.patient_id,
      data.specialty_id,
      data.doctor_id || null,
      data.location_id || null,
      data.priority,
      data.requested_date || null,
      data.notes || null
    ]);

    return res.json({
      success: true,
      message: 'Paciente agregado a cola de espera',
      data: {
        queue_id: (result as any).insertId,
        assigned_immediately: false
      }
    });
  } catch (error: any) {
    console.error('Error adding to daily queue:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors
      });
    }

    return res.status(500).json({ 
      success: false,
      message: 'Error al agregar paciente a cola de espera', 
      error: error.message 
    });
  }
});

// POST /api/daily-queue/assign - Asignación manual desde cola
router.post('/assign', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = manualAssignSchema.parse(req.body);

    // Verificar que el registro en cola existe y está esperando
    const [queueRecord] = await pool.query(`
      SELECT * FROM daily_assignment_queue 
      WHERE id = ? AND status = 'waiting'
    `, [data.queue_id]);

    if ((queueRecord as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro en cola no encontrado o ya fue procesado'
      });
    }

    const queue = (queueRecord as any[])[0];

    // Verificar que la disponibilidad existe y tiene cupos
    const today = new Date().toISOString().split('T')[0];
    const [availability] = await pool.query(`
      SELECT a.*, 
             COALESCE(ad.quota, 0) as quota,
             COALESCE(ad.assigned, 0) as assigned,
             (COALESCE(ad.quota, 0) - COALESCE(ad.assigned, 0)) as available_slots
      FROM availabilities a
      LEFT JOIN availability_distribution ad ON ad.availability_id = a.id AND ad.day_date = ?
      WHERE a.id = ? AND a.status = 'Activa'
    `, [today, data.availability_id]);

    if ((availability as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Disponibilidad no encontrada'
      });
    }

    const avail = (availability as any[])[0];
    if (avail.available_slots <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay cupos disponibles en esta agenda'
      });
    }

    // Crear la cita
    const [appointmentResult] = await pool.query(`
      INSERT INTO appointments (
        patient_id, 
        availability_id, 
        status, 
        scheduled_at,
        created_at
      ) VALUES (?, ?, 'Programada', NOW(), NOW())
    `, [queue.patient_id, data.availability_id]);

    const appointmentId = (appointmentResult as any).insertId;

    // Actualizar registro en cola
    await pool.query(`
      UPDATE daily_assignment_queue 
      SET status = 'assigned',
          assigned_at = NOW(),
          assigned_by_user_id = ?,
          appointment_id = ?
      WHERE id = ?
    `, [data.assigned_by_user_id, appointmentId, data.queue_id]);

    // Actualizar distribución
    await pool.query(`
      INSERT INTO availability_distribution (availability_id, day_date, quota, assigned)
      VALUES (?, ?, 1, 1)
      ON DUPLICATE KEY UPDATE assigned = assigned + 1
    `, [data.availability_id, today]);

    return res.json({
      success: true,
      message: 'Cita asignada exitosamente desde cola de espera',
      data: {
        appointment_id: appointmentId,
        queue_id: data.queue_id
      }
    });
  } catch (error: any) {
    console.error('Error in manual assignment:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors
      });
    }

    return res.status(500).json({ 
      success: false,
      message: 'Error al asignar cita manualmente', 
      error: error.message 
    });
  }
});

// GET /api/daily-queue/stats - Estadísticas de cola
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const [stats] = await pool.query(`
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

    const [bySpecialty] = await pool.query(`
      SELECT 
        s.name as specialty_name,
        COUNT(*) as waiting_count,
        AVG(TIMESTAMPDIFF(MINUTE, daq.created_at, NOW())) as avg_waiting_minutes
      FROM daily_assignment_queue daq
      JOIN specialties s ON s.id = daq.specialty_id
      WHERE daq.status = 'waiting'
      GROUP BY daq.specialty_id, s.name
      ORDER BY waiting_count DESC
    `);

    return res.json({
      success: true,
      data: {
        overview: (stats as any[])[0],
        by_specialty: bySpecialty
      }
    });
  } catch (error: any) {
    console.error('Error fetching queue stats:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener estadísticas de cola', 
      error: error.message 
    });
  }
});

// POST /api/daily-queue/assign-today - Función principal de asignación diaria
router.post('/assign-today', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = addToQueueSchema.parse(req.body);
    const result = await tryAssignTodayOrQueue(data);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error in assign-today:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors
      });
    }

    return res.status(500).json({ 
      success: false,
      message: 'Error al procesar asignación diaria', 
      error: error.message 
    });
  }
});

// GET /api/daily-queue/today-availability - Disponibilidades de hoy
router.get('/today-availability', requireAuth, async (req: Request, res: Response) => {
  try {
    const { specialty_id, doctor_id, location_id } = req.query;
    
    if (!specialty_id) {
      return res.status(400).json({
        success: false,
        message: 'specialty_id es requerido'
      });
    }

    const availabilities = await getTodayAvailability(
      Number(specialty_id),
      doctor_id ? Number(doctor_id) : undefined,
      location_id ? Number(location_id) : undefined
    );

    return res.json({
      success: true,
      data: availabilities
    });
  } catch (error: any) {
    console.error('Error fetching today availability:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener disponibilidades de hoy', 
      error: error.message 
    });
  }
});

// GET /api/daily-queue/daily-stats - Estadísticas del día
router.get('/daily-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await getDailyAssignmentStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching daily stats:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener estadísticas diarias', 
      error: error.message 
    });
  }
});

// POST /api/daily-queue/process-queue - Procesamiento automático de cola
router.post('/process-queue', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await processWaitingQueue();
    
    return res.json({
      success: true,
      message: `Procesados: ${result.processed}, Asignados: ${result.assigned}`,
      data: result
    });
  } catch (error: any) {
    console.error('Error processing queue:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al procesar cola de espera', 
      error: error.message 
    });
  }
});
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const queueId = Number(req.params.id);
    
    const [result] = await pool.query(`
      UPDATE daily_assignment_queue 
      SET status = 'cancelled' 
      WHERE id = ? AND status = 'waiting'
    `, [queueId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro en cola no encontrado o ya fue procesado'
      });
    }

    return res.json({
      success: true,
      message: 'Paciente removido de cola de espera'
    });
  } catch (error: any) {
    console.error('Error removing from queue:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al remover paciente de cola', 
      error: error.message 
    });
  }
});

// DELETE /api/daily-queue/:id - Remover de cola (cancelar)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const queueId = Number(req.params.id);
    
    const [result] = await pool.query(`
      UPDATE daily_assignment_queue 
      SET status = 'cancelled' 
      WHERE id = ? AND status = 'waiting'
    `, [queueId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro en cola no encontrado o ya fue procesado'
      });
    }

    return res.json({
      success: true,
      message: 'Paciente removido de cola de espera'
    });
  } catch (error: any) {
    console.error('Error removing from queue:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al remover paciente de cola', 
      error: error.message 
    });
  }
});

export default router;