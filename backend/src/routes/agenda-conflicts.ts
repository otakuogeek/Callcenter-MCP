import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const conflictResolutionSchema = z.object({
  conflict_id: z.number(),
  resolution_type: z.enum(['reschedule', 'cancel', 'increase_capacity', 'split_slot']),
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  new_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  notes: z.string().optional()
});

// Detectar conflictos en la agenda
router.get('/detect', async (req: Request, res: Response) => {
  try {
    const { date_from, date_to, doctor_id, auto_fix } = req.query;
    
    let whereConditions = ['a.date >= CURDATE()'];
    let params: any[] = [];
    
    if (date_from) {
      whereConditions = ['a.date >= ?'];
      params.push(date_from);
    }
    if (date_to) {
      whereConditions.push('a.date <= ?');
      params.push(date_to);
    }
    if (doctor_id) {
      whereConditions.push('a.doctor_id = ?');
      params.push(doctor_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Detectar sobreagendamiento (booked_slots > capacity)
    const [overbookingConflicts] = await pool.query(`
      SELECT 
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.booked_slots,
        (a.booked_slots - a.capacity) as overflow,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name,
        'overbooking' as conflict_type,
        'high' as severity
      FROM availabilities a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE ${whereClause} AND a.booked_slots > a.capacity
      ORDER BY a.date, a.start_time
    `, params);

    // Detectar conflictos de horarios superpuestos
    const [overlappingConflicts] = await pool.query(`
      SELECT 
        a1.id as slot1_id,
        a2.id as slot2_id,
        a1.date,
        a1.start_time as slot1_start,
        a1.end_time as slot1_end,
        a2.start_time as slot2_start,
        a2.end_time as slot2_end,
        d.name as doctor_name,
        'overlapping_slots' as conflict_type,
        'medium' as severity
      FROM availabilities a1
      JOIN availabilities a2 ON a1.doctor_id = a2.doctor_id 
        AND a1.date = a2.date 
        AND a1.id < a2.id
        AND a1.start_time < a2.end_time 
        AND a2.start_time < a1.end_time
      LEFT JOIN doctors d ON a1.doctor_id = d.id
      WHERE ${whereClause.replace('a.', 'a1.')}
      ORDER BY a1.date, a1.start_time
    `, params);

    // Detectar citas sin disponibilidad válida
    const [orphanedAppointments] = await pool.query(`
      SELECT 
        ap.id as appointment_id,
        ap.date,
        ap.time,
        ap.patient_name,
        ap.availability_id,
        'orphaned_appointment' as conflict_type,
        'high' as severity
      FROM appointments ap
      LEFT JOIN availabilities a ON ap.availability_id = a.id
      WHERE a.id IS NULL AND ap.date >= CURDATE()
      ORDER BY ap.date, ap.time
    `);

    // Detectar slots con baja eficiencia (muy poca capacidad vs demanda)
    const [inefficiencyConflicts] = await pool.query(`
      SELECT 
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.booked_slots,
        COUNT(ap.id) as waiting_list_count,
        d.name as doctor_name,
        'capacity_inefficiency' as conflict_type,
        'low' as severity
      FROM availabilities a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN appointments ap ON a.id = ap.availability_id AND ap.status = 'waiting'
      WHERE ${whereClause} 
        AND a.capacity < 3 
        AND a.booked_slots >= a.capacity
      GROUP BY a.id
      HAVING waiting_list_count > 0
      ORDER BY waiting_list_count DESC, a.date, a.start_time
    `, params);

    const allConflicts = [
      ...(overbookingConflicts as any[]),
      ...(overlappingConflicts as any[]),
      ...(orphanedAppointments as any[]),
      ...(inefficiencyConflicts as any[])
    ] as any[];

    // Auto-resolución si está habilitada
    const autoResolutions = [];
    if (auto_fix === 'true') {
      for (const conflict of overbookingConflicts as any[]) {
        try {
          // Intentar aumentar capacidad automáticamente
          await pool.query(
            'UPDATE availabilities SET capacity = booked_slots, updated_at = NOW() WHERE id = ?',
            [conflict.id]
          );
          
          autoResolutions.push({
            conflict_id: conflict.id,
            action: 'increased_capacity',
            old_capacity: conflict.capacity,
            new_capacity: conflict.booked_slots
          });
        } catch (error) {
          console.error('Error auto-fixing conflict:', error);
        }
      }
    }

    res.json({
      success: true,
      data: {
        conflicts: allConflicts,
        summary: {
          total_conflicts: allConflicts.length,
          by_type: {
            overbooking: (overbookingConflicts as any[]).length,
            overlapping: (overlappingConflicts as any[]).length,
            orphaned: (orphanedAppointments as any[]).length,
            inefficiency: (inefficiencyConflicts as any[]).length
          },
          by_severity: {
            high: allConflicts.filter(c => c.severity === 'high').length,
            medium: allConflicts.filter(c => c.severity === 'medium').length,
            low: allConflicts.filter(c => c.severity === 'low').length
          }
        },
        auto_resolutions: autoResolutions
      }
    });

  } catch (error) {
    console.error('Error detecting conflicts:', error);
    res.status(500).json({ success: false, error: 'Error al detectar conflictos' });
  }
});

// Resolver conflicto específico
router.post('/resolve', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const data = conflictResolutionSchema.parse(req.body);
    
    await connection.beginTransaction();

    // Obtener información del conflicto
    const [conflictInfo] = await connection.query(
      'SELECT * FROM availabilities WHERE id = ?',
      [data.conflict_id]
    ) as any;

    if (!conflictInfo.length) {
      throw new Error('Slot de disponibilidad no encontrado');
    }

    const slot = conflictInfo[0];
    let resolutionResult;

    switch (data.resolution_type) {
      case 'increase_capacity':
        await connection.query(
          'UPDATE availabilities SET capacity = booked_slots, updated_at = NOW() WHERE id = ?',
          [data.conflict_id]
        );
        resolutionResult = {
          action: 'Capacidad aumentada',
          old_capacity: slot.capacity,
          new_capacity: slot.booked_slots
        };
        break;

      case 'split_slot':
        // Dividir el slot en dos
        const splitTime = new Date(`2000-01-01 ${slot.start_time}`);
        splitTime.setMinutes(splitTime.getMinutes() + 30);
        const splitTimeStr = splitTime.toTimeString().substr(0, 5);

        // Crear segundo slot
        const [newSlotResult] = await connection.query(
          `INSERT INTO availabilities 
           (doctor_id, specialty_id, location_id, date, start_time, end_time, capacity, duration_minutes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            slot.doctor_id,
            slot.specialty_id,
            slot.location_id,
            slot.date,
            splitTimeStr,
            slot.end_time,
            Math.ceil(slot.capacity / 2),
            slot.duration_minutes
          ]
        ) as any;

        // Actualizar slot original
        await connection.query(
          'UPDATE availabilities SET end_time = ?, capacity = ? WHERE id = ?',
          [splitTimeStr, Math.floor(slot.capacity / 2), data.conflict_id]
        );

        resolutionResult = {
          action: 'Slot dividido',
          original_slot: data.conflict_id,
          new_slot: newSlotResult.insertId,
          split_time: splitTimeStr
        };
        break;

      case 'reschedule':
        if (!data.new_date || !data.new_time) {
          throw new Error('Nueva fecha y hora requeridas para reprogramar');
        }

        await connection.query(
          'UPDATE availabilities SET date = ?, start_time = ?, updated_at = NOW() WHERE id = ?',
          [data.new_date, data.new_time, data.conflict_id]
        );

        resolutionResult = {
          action: 'Reprogramado',
          new_date: data.new_date,
          new_time: data.new_time
        };
        break;

      case 'cancel':
        // Cancelar citas asociadas
        await connection.query(
          'UPDATE appointments SET status = "cancelled", notes = CONCAT(COALESCE(notes, ""), " - Cancelado por conflicto de agenda") WHERE availability_id = ?',
          [data.conflict_id]
        );

        // Eliminar slot
        await connection.query(
          'DELETE FROM availabilities WHERE id = ?',
          [data.conflict_id]
        );

        resolutionResult = {
          action: 'Slot cancelado',
          affected_appointments: 'Citas canceladas automáticamente'
        };
        break;
    }

    // Registrar la resolución
    await connection.query(
      `INSERT INTO conflict_resolutions 
       (slot_id, resolution_type, resolution_data, notes, resolved_at, resolved_by)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [
        data.conflict_id,
        data.resolution_type,
        JSON.stringify(resolutionResult),
        data.notes || null,
        (req as any).user?.id || null
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      data: {
        conflict_id: data.conflict_id,
        resolution: resolutionResult,
        notes: data.notes
      },
      message: 'Conflicto resuelto exitosamente'
    });

  } catch (error) {
    await connection.rollback();
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Datos inválidos', 
        details: error.errors 
      });
    }
    console.error('Error resolving conflict:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error al resolver conflicto' 
    });
  } finally {
    connection.release();
  }
});

// Obtener historial de resoluciones
router.get('/resolutions', async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    const [rows] = await pool.query(`
      SELECT 
        cr.*,
        u.name as resolved_by_name,
        a.date as slot_date,
        a.start_time,
        a.end_time,
  d.name as doctor_name
      FROM conflict_resolutions cr
      LEFT JOIN users u ON cr.resolved_by = u.id
      LEFT JOIN availabilities a ON cr.slot_id = a.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      ORDER BY cr.resolved_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit as string), parseInt(offset as string)]);

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM conflict_resolutions'
    ) as any;

    res.json({
      success: true,
      data: {
        resolutions: rows,
        pagination: {
          total: countResult[0].total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });

  } catch (error) {
    console.error('Error getting conflict resolutions:', error);
    res.status(500).json({ success: false, error: 'Error al obtener resoluciones' });
  }
});

export default router;
