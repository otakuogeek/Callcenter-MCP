import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { 
  redistributeUnassignedQuota, 
  redistributeAllActiveAvailabilities,
  getUnassignedQuotaSummary 
} from '../utils/redistribution';
import {
  syncAvailabilitySlots,
  syncAllAvailabilities,
  validateAvailabilityCapacity,
  incrementBookedSlots,
  decrementBookedSlots
} from '../utils/availabilitySync';
import { formatDateForMySQLUTC, utcDateFromYMDAndColombiaTime, utcDateFromYMDAndUTCTime } from '../utils/dateUtils';

const router = Router();

const schema = z.object({
  location_id: z.number().int(),
  specialty_id: z.number().int(),
  doctor_id: z.number().int(),
  date: z.string(),
  dates: z.array(z.string()).optional(), // 🔥 NUEVO: Array de fechas para creación múltiple
  start_time: z.string(),
  end_time: z.string(),
  capacity: z.number().int().min(1).default(1),
  duration_minutes: z.number().int().min(1).max(240).optional().default(30),
  booked_slots: z.number().int().min(0).optional(), // Para sincronización automática
  status: z.enum(['active','cancelled','completed','Activa','Cancelada','Completa']).default('Activa'),
  notes: z.string().optional().nullable(),
  auto_preallocate: z.boolean().optional(),
  preallocation_publish_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  // Nuevos campos para distribución automática
  auto_distribute: z.boolean().optional(),
  distribution_start_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  distribution_end_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  exclude_weekends: z.boolean().optional().default(true)
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const date = String(req.query.date || '');
  const specialtyId = req.query.specialty_id ? Number(req.query.specialty_id) : null;
  const includePast = req.query.include_past === 'true' || req.query.include_past === '1';
  const includeAllStatus = req.query.include_all_status === 'true' || req.query.include_all_status === '1';
  
  let whereClause = '';
  let params: any[] = [];
  
  try {
    if (date) {
      whereClause = 'WHERE a.date = ?';
      params.push(date);
    } else if (includePast) {
      // Si se solicita incluir pasadas, no filtrar por fecha
      whereClause = 'WHERE 1=1';
    } else {
      whereClause = 'WHERE a.date >= CURDATE()';
    }
    
    // Agregar filtro por especialidad si se proporciona
    if (specialtyId) {
      whereClause += ' AND a.specialty_id = ?';
      params.push(specialtyId);
    }
    
    // Filtrar por status solo si no se solicita incluir todos los status
    if (includeAllStatus) {
      // Mostrar todas las agendas sin importar el status
      whereClause += ' AND (a.is_paused = 0 OR a.is_paused IS NULL OR a.is_paused = 1)';
    } else {
      // Mostrar solo agendas activas (no canceladas, no pausadas)
      whereClause += ' AND a.status IN ("Activa", "Completa") AND (a.is_paused = 0 OR a.is_paused IS NULL)';
    }
    
    console.log('[AVAILABILITIES] Query params:', { date, specialtyId, includePast, includeAllStatus, whereClause, params });
    
    // Determinar orden: si include_past, ordenar por cercanía a hoy (desc para ver recientes primero)
    const orderDirection = includePast ? 'DESC' : 'ASC';
    
    const [rows] = await pool.query(
      `SELECT a.id,
              DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
              a.start_time,
              a.end_time,
              a.doctor_id,
              a.specialty_id,
              a.location_id,
              a.capacity,
              a.booked_slots,
              GREATEST(0, CAST(a.capacity AS SIGNED) - CAST(a.booked_slots AS SIGNED)) AS available_slots,
              a.duration_minutes,
              a.status,
              a.is_paused,
              a.created_at,
              d.name AS doctor_name, 
              s.name AS specialty_name, 
              l.name AS location_name
       FROM availabilities a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id  
       JOIN locations l ON l.id = a.location_id
       ${whereClause}
       ORDER BY a.date ${orderDirection}, a.start_time ASC 
       LIMIT 500`,
      params
    );
    
    console.log(`[AVAILABILITIES] Found ${Array.isArray(rows) ? rows.length : 0} rows`);
    return res.json(rows);
  } catch (e: any) {
    console.error('[AVAILABILITIES] Error en GET /availabilities:', e);
    console.error('[AVAILABILITIES] Params:', params);
    console.error('[AVAILABILITIES] Where clause:', whereClause);
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) {
      return res.json([]);
    }
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data as any;
  
  // Mapear status de inglés a español para compatibilidad con BD
  const statusMap: Record<string, string> = {
    'active': 'Activa',
    'cancelled': 'Cancelada',
    'completed': 'Completa'
  };
  const dbStatus = statusMap[d.status] || 'Activa';
  
  // 🔥 NUEVO: Determinar las fechas a procesar
  const datesToProcess = d.dates && d.dates.length > 0 ? d.dates : [d.date];
  
  // 🔥 COMENTADO: Permitir agendas en fines de semana
  /*
  // Validar que no sean sábados ni domingos
  const weekendDates: string[] = [];
  for (const dateStr of datesToProcess) {
    const appointmentDate = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = appointmentDate.getDay(); // 0 = Domingo, 6 = Sábado
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDates.push(dateStr);
    }
  }
  
  if (weekendDates.length > 0) {
    return res.status(400).json({ 
      message: `Las siguientes fechas son fines de semana y no se pueden usar: ${weekendDates.join(', ')}`,
      error: 'weekend_not_allowed',
      invalidDates: weekendDates
    });
  }
  */
  
  try {
    const createdAvailabilities: any[] = [];
    const errors: any[] = [];
    
    // 🔥 NUEVO: Crear una agenda por cada fecha
    for (const dateStr of datesToProcess) {
      try {
        const [result] = await pool.query(
          `INSERT INTO availabilities (location_id, specialty_id, doctor_id, date, start_time, end_time, capacity, duration_minutes, booked_slots, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [d.location_id, d.specialty_id, d.doctor_id, dateStr, d.start_time, d.end_time, d.capacity, d.duration_minutes ?? 30, dbStatus, d.notes ?? null]
        );
        // @ts-ignore
        const availabilityId = result.insertId as number;

        let preallocation: any = null;
        if (d.auto_preallocate) {
          try {
            const { generateRandomPreallocation } = await import('../utils/randomPreallocation');
            preallocation = await generateRandomPreallocation({
              target_date: dateStr,
              total_slots: d.capacity,
              publish_date: d.preallocation_publish_date,
              doctor_id: d.doctor_id,
              location_id: d.location_id,
              specialty_id: d.specialty_id,
              availability_id: availabilityId,
              apply: true
            });
          } catch (e) {
            console.warn(`Fallo preallocation automática para ${dateStr}:`, e);
          }
        }

        // Distribución automática de cupos
        let distribution: any = null;
        if (d.auto_distribute && d.distribution_start_date && d.distribution_end_date) {
          try {
            const { generateAvailabilityDistribution } = await import('../utils/availabilityDistribution');
            distribution = await generateAvailabilityDistribution({
              availability_id: availabilityId,
              start_date: d.distribution_start_date,
              end_date: d.distribution_end_date,
              total_quota: d.capacity,
              exclude_weekends: d.exclude_weekends ?? true
            });
          } catch (e) {
            console.warn(`Fallo distribución automática para ${dateStr}:`, e);
          }
        } else {
          // Si NO se activa la distribución automática, asignar toda la capacidad al día de la cita
          try {
            const { generateAvailabilityDistribution } = await import('../utils/availabilityDistribution');
            distribution = await generateAvailabilityDistribution({
              availability_id: availabilityId,
              start_date: dateStr, // Mismo día de la cita
              end_date: dateStr,   // Mismo día de la cita
              total_quota: d.capacity,
              exclude_weekends: true
            });
          } catch (e) {
            console.warn(`Fallo distribución automática del día de la cita para ${dateStr}:`, e);
          }
        }

        createdAvailabilities.push({
          id: availabilityId,
          date: dateStr,
          preallocation,
          distribution
        });
      } catch (e: any) {
        console.error(`[CREATE-AVAILABILITY] Error creando agenda para ${dateStr}:`, e);
        errors.push({
          date: dateStr,
          error: e?.message || 'Error desconocido',
          details: e?.sqlMessage || e?.toString()
        });
      }
    }

    // Verificar si todas fallaron
    if (createdAvailabilities.length === 0 && errors.length > 0) {
      return res.status(500).json({ 
        success: false,
        message: 'No se pudo crear ninguna agenda', 
        errors
      });
    }

    // Respuesta exitosa con resumen
    return res.status(201).json({ 
      success: true,
      message: `Se crearon ${createdAvailabilities.length} agenda(s) exitosamente`,
      created: createdAvailabilities.length,
      failed: errors.length,
      availabilities: createdAvailabilities,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (e: any) {
    console.error('[CREATE-AVAILABILITY] Error general:', e);
    return res.status(500).json({ 
      message: 'Server error', 
      error: e?.message || 'Unknown error',
      details: e?.sqlMessage || e?.toString()
    });
  }
});

// Endpoint para actualizar cupos asignados de una distribución específica
router.put('/distributions/:id/assigned', requireAuth, async (req: Request, res: Response) => {
  const distributionId = Number(req.params.id);
  const { assigned } = req.body;
  
  if (Number.isNaN(distributionId)) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de distribución inválido' 
    });
  }
  
  if (typeof assigned !== 'number' || assigned < 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'El número de asignados debe ser un número mayor o igual a 0' 
    });
  }
  
  try {
    // Verificar que la distribución existe
    const [existing] = await pool.query(
      'SELECT * FROM availability_distribution WHERE id = ?',
      [distributionId]
    );
    
    if (!Array.isArray(existing) || existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Distribución no encontrada' 
      });
    }
    
    const distribution = existing[0] as any;
    
    // Verificar que no se exceda la cuota
    if (assigned > distribution.quota) {
      return res.status(400).json({ 
        success: false, 
        message: `No se pueden asignar ${assigned} cupos. La cuota máxima es ${distribution.quota}` 
      });
    }
    
    // Actualizar la distribución
    await pool.query(
      'UPDATE availability_distribution SET assigned = ? WHERE id = ?',
      [assigned, distributionId]
    );
    
    // Obtener la distribución actualizada con información completa
    const [updated] = await pool.query(`
      SELECT 
        ad.id,
        ad.availability_id,
        ad.day_date,
        ad.quota,
        ad.assigned,
        ad.created_at,
        a.doctor_id,
        a.specialty_id,
        a.location_id,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        a.date AS availability_date,
        a.start_time,
        a.end_time,
        a.capacity AS total_capacity,
        (ad.quota - ad.assigned) AS remaining
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE ad.id = ?
    `, [distributionId]);
    
    return res.json({
      success: true,
      message: 'Cupos asignados actualizados correctamente',
      data: (updated as any[])[0]
    });
  } catch (error: any) {
    console.error('Error updating assigned slots:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al actualizar cupos asignados', 
      error: error.message 
    });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  
  // Si se está actualizando la fecha, validar que no sea fin de semana
  if (d.date) {
    // 🔥 IMPORTANTE: Crear fecha en formato UTC para evitar problemas de zona horaria
    // La fecha viene como "YYYY-MM-DD" del frontend y debe mantenerse exacta
    const appointmentDate = new Date(d.date + 'T12:00:00Z'); // Agregar T12:00:00Z para interpretarla en UTC
    const dayOfWeek = appointmentDate.getUTCDay(); // Usar getUTCDay() en vez de getDay()
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({ 
        message: 'No se pueden crear disponibilidades en fines de semana (sábados y domingos)',
        error: 'weekend_not_allowed'
      });
    }
  }
  
  try {
    // 🔥 SI SE ESTÁ CANCELANDO LA AGENDA, PROCESAR CITAS ASOCIADAS
    if (d.status === 'cancelled') {
      console.log(`🔄 Cancelando agenda ${id} - Procesando citas asociadas...`);
      
      // 1. Verificar si hay citas Confirmadas - NO se permite cancelar hasta que se cancelen internamente
      const [confirmedCitas] = await pool.query(`
        SELECT COUNT(*) as count
        FROM appointments a
        WHERE a.availability_id = ? 
          AND a.status = 'Confirmada'
      `, [id]) as any;

      const confirmedCount = confirmedCitas[0]?.count || 0;
      if (confirmedCount > 0) {
        return res.status(400).json({ 
          success: false,
          message: `No se puede cancelar la agenda porque hay ${confirmedCount} cita(s) confirmada(s). Por favor, cancele todas las citas confirmadas primero.`,
          error: 'confirmed_appointments_exist',
          confirmedAppointments: confirmedCount
        });
      }

      // 2. Obtener citas Pendientes (se moverán a lista de espera y se marcarán como Canceladas)
      const [pendingCitas] = await pool.query(`
        SELECT 
          a.id,
          a.patient_id,
          a.scheduled_at,
          a.reason,
          a.status
        FROM appointments a
        WHERE a.availability_id = ? 
          AND a.status = 'Pendiente'
      `, [id]) as any;

      // 3. Mover citas pendientes a la lista de espera con call_type='reagendar' y marcarlas como Canceladas
      if (Array.isArray(pendingCitas) && pendingCitas.length > 0) {
        console.log(`📋 Procesando ${pendingCitas.length} citas pendientes...`);
        
        for (const apt of pendingCitas) {
          // Insertar en lista de espera
          await pool.query(`
            INSERT INTO appointments_waiting_list 
            (patient_id, availability_id, scheduled_date, reason, priority_level, call_type, status)
            VALUES (?, ?, ?, ?, 'Alta', 'reagendar', 'pending')
          `, [
            apt.patient_id,
            id, // availability_id original
            apt.scheduled_at,
            apt.reason || 'Reagendamiento por cancelación de agenda'
          ]);

          // Cambiar estado a Cancelada en appointments (NO eliminar)
          await pool.query(`
            UPDATE appointments 
            SET status = 'Cancelada', 
                updated_at = NOW()
            WHERE id = ?
          `, [apt.id]);
        }

        console.log(`✅ ${pendingCitas.length} citas pendientes movidas a lista de espera y marcadas como Canceladas`);
      } else {
        console.log(`ℹ️ No hay citas pendientes para procesar`);
      }

      // 4. Las citas ya Canceladas se mantienen en appointments con su estado
      const [alreadyCancelledCitas] = await pool.query(`
        SELECT COUNT(*) as count
        FROM appointments a
        WHERE a.availability_id = ? 
          AND a.status = 'Cancelada'
      `, [id]) as any;

      const alreadyCancelledCount = alreadyCancelledCitas[0]?.count || 0;
      if (alreadyCancelledCount > 0) {
        console.log(`ℹ️ ${alreadyCancelledCount} citas ya canceladas se mantienen en appointments`);
      }
    }

    // Mapear estados del inglés (frontend/schema) al español (base de datos)
    const statusMap: Record<string, string> = {
      'active': 'Activa',
      'cancelled': 'Cancelada',
      'completed': 'Completa'
    };

    const fields: string[] = []; const values: any[] = [];
    for (const k of Object.keys(d) as (keyof typeof d)[]) { 
      fields.push(`${k} = ?`); 
      // @ts-ignore - Mapear status si es necesario
      const value = k === 'status' && typeof d[k] === 'string' 
        ? (statusMap[d[k] as string] || d[k])
        : d[k];
      values.push(value ?? null);
    }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    
    console.log(`📝 Actualizando availability ${id}`);
    console.log(`📅 Fecha recibida del frontend:`, d.date, `(tipo: ${typeof d.date})`);
    console.log(`📋 Campos a actualizar:`, fields);
    console.log(`📊 Valores:`, values);
    
    await pool.query(`UPDATE availabilities SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (error: any) {
    console.error('❌ Error updating availability:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    console.error('❌ Availability ID:', id);
    console.error('❌ Data received:', JSON.stringify(d, null, 2));
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM availabilities WHERE id = ?', [id]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// New schemas for batch creation and holidays
const batchSchema = z.object({
  doctor_id: z.number().int(),
  location_id: z.number().int(),
  specialty_id: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  capacity: z.number().int().min(1).default(1),
  slot_duration_minutes: z.number().int().min(1).max(120).default(30),
  exclude_weekends: z.boolean().default(true),
  exclude_holidays: z.boolean().default(true),
  batch_id: z.string().optional(),
});

const holidaySchema = z.object({
  date: z.string(),
  name: z.string().min(1),
  type: z.enum(['national','regional','local','personal']).default('national'),
  location_id: z.number().int().optional(),
  is_recurring: z.boolean().default(false),
  description: z.string().optional(),
});

// Create availabilities for date range
router.post('/batch', requireAuth, async (req: Request, res: Response) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const d = parsed.data;
  const batchId = d.batch_id || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Generate date range excluding weekends if specified
    const startDate = new Date(d.start_date + 'T12:00:00');
    const endDate = new Date(d.end_date + 'T12:00:00');
    const availabilities = [];
    
    const currentDate = new Date(startDate);
    let createdCount = 0;
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 6 = Sábado
      
      // Skip weekends if exclude_weekends is true
      if (d.exclude_weekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Create availability for this date
      try {
        const [result] = await pool.query(
          `INSERT INTO availabilities (doctor_id, location_id, specialty_id, date, start_time, end_time, capacity, duration_minutes, booked_slots, batch_id, exclude_weekends, exclude_holidays) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            d.doctor_id,
            d.location_id,
            d.specialty_id,
            currentDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
            d.start_time,
            d.end_time,
            d.capacity,
            d.slot_duration_minutes ?? 30, // Usar slot_duration_minutes del batchSchema
            batchId,
            d.exclude_weekends,
            d.exclude_holidays
          ]
        );
        createdCount++;
      } catch (insertError: any) {
        console.error('Error inserting availability for date:', currentDate, insertError);
        // Continue with next date instead of failing entire batch
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return res.status(201).json({
      batch_id: batchId,
      created_count: createdCount,
      message: `Batch availabilities created successfully. ${d.exclude_weekends ? 'Weekends excluded.' : ''}`
    });
  } catch (error: any) {
    console.error('Batch creation error:', error);
    return res.status(500).json({ message: 'Failed to create batch availabilities', error: error.message });
  }
});

// Get availabilities by batch
router.get('/batch/:batchId', requireAuth, async (req: Request, res: Response) => {
  const { batchId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT a.*,
              d.name AS doctor_name,
              s.name AS specialty_name,
              l.name AS location_name,
              a.booked_slots
       FROM availabilities a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       WHERE a.batch_id = ?
       ORDER BY a.date ASC, a.start_time ASC`,
      [batchId]
    );
    return res.json(rows);
  } catch (error: any) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.json([]);
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete availabilities by batch
router.delete('/batch/:batchId', requireAuth, async (req: Request, res: Response) => {
  const { batchId } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM availabilities WHERE batch_id = ?',
      [batchId]
    );
    // @ts-ignore
    return res.json({ deleted_count: result.affectedRows, message: 'Batch deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get non-working days (holidays + weekends)
router.get('/non-working-days', requireAuth, async (req: Request, res: Response) => {
  const { start_date, end_date, location_id } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ message: 'start_date and end_date are required' });
  }

  try {
    let query = `
      SELECT date, name, type, location_id, is_recurring, description
      FROM holidays
      WHERE date BETWEEN ? AND ?
    `;
    const params = [start_date, end_date];

    if (location_id) {
      query += ' AND (location_id IS NULL OR location_id = ?)';
      params.push(location_id);
    }

    let holidays: any = [];
    try {
      const [rows] = await pool.query(query, params);
      holidays = rows;
    } catch (e: any) {
      if (!(e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146))) throw e;
      holidays = [];
    }

    // Generate weekends in the date range
    const weekends: any[] = [];
    const start = new Date((start_date as string) + 'T12:00:00');
    const end = new Date((end_date as string) + 'T12:00:00');

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekends.push({
          date: date.toISOString().split('T')[0],
          name: dayOfWeek === 0 ? 'Domingo' : 'Sábado',
          type: 'weekend',
          is_recurring: true,
          description: 'Fin de semana'
        });
      }
    }

    return res.json({
      holidays: Array.isArray(holidays) ? holidays : [],
      weekends,
      non_working_days: [...(Array.isArray(holidays) ? holidays : []), ...weekends]
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Holiday management endpoints
router.get('/holidays', requireAuth, async (req: Request, res: Response) => {
  const { year, type, location_id } = req.query;
  try {
    let query = 'SELECT * FROM holidays WHERE 1=1';
    const params: any[] = [];

    if (year) {
      query += ' AND YEAR(date) = ?';
      params.push(year);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (location_id) {
      query += ' AND (location_id IS NULL OR location_id = ?)';
      params.push(location_id);
    }

    query += ' ORDER BY date ASC';

    const [rows] = await pool.query(query, params);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/holidays', requireAuth, async (req: Request, res: Response) => {
  const parsed = holidaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const d = parsed.data;
  try {
    const [result] = await pool.query(
      `INSERT INTO holidays (date, name, type, location_id, is_recurring, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.date, d.name, d.type, d.location_id || null, d.is_recurring, d.description || null]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Holiday already exists for this date and location' });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/holidays/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const parsed = holidaySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const d = parsed.data;
  try {
    const fields: string[] = [];
    const values: any[] = [];

    for (const k of Object.keys(d) as (keyof typeof d)[]) {
      fields.push(`${k} = ?`);
      // @ts-ignore
      values.push(d[k] ?? null);
    }

    if (!fields.length) return res.status(400).json({ message: 'No changes' });

    values.push(id);
    await pool.query(`UPDATE holidays SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/holidays/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    await pool.query('DELETE FROM holidays WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Distribute appointments randomly across batch availabilities
router.post('/distribute-appointments', requireAuth, async (req: Request, res: Response) => {
  const { batch_id, total_appointments } = req.body;

  if (!batch_id || !total_appointments) {
    return res.status(400).json({ message: 'batch_id and total_appointments are required' });
  }

  try {
    // Get available dates for this batch
    const [availabilities] = await pool.query(
      'SELECT id, date, capacity FROM availabilities WHERE batch_id = ? AND status = "active" ORDER BY date ASC',
      [batch_id]
    );

    const availabilitiesArray = Array.isArray(availabilities) ? availabilities : [];

    if (availabilitiesArray.length === 0) {
      return res.status(404).json({ message: 'No availabilities found for this batch' });
    }

    // Calculate distribution
    const appointmentsPerDate = Math.floor(total_appointments / availabilitiesArray.length);
    const remainingAppointments = total_appointments % availabilitiesArray.length;

    const distribution = availabilitiesArray.map((avail: any, index: number) => ({
      availability_id: avail.id,
      date: avail.date,
      appointments: appointmentsPerDate + (index < remainingAppointments ? 1 : 0)
    }));

    return res.json({
      batch_id,
      total_appointments,
      distribution,
      summary: {
        dates_count: availabilitiesArray.length,
        appointments_per_date: appointmentsPerDate,
        remaining_appointments: remainingAppointments
      }
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Endpoint para obtener la distribución de un availability
router.get('/:id/distribution', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid availability id' });

  try {
    const { getAvailabilityDistribution } = await import('../utils/availabilityDistribution');
    const distribution = await getAvailabilityDistribution(id);
    return res.json({
      success: true,
      availability_id: id,
      distribution
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Endpoint para regenerar la distribución de un availability
router.post('/:id/regenerate-distribution', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid availability id' });

  const distributionSchema = z.object({
    start_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    end_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    total_quota: z.number().int().min(1),
    exclude_weekends: z.boolean().optional().default(true)
  });

  const parsed = distributionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  try {
    const { generateAvailabilityDistribution } = await import('../utils/availabilityDistribution');
    const distribution = await generateAvailabilityDistribution({
      availability_id: id,
      ...parsed.data
    });
    
    return res.json({
      success: true,
      message: 'Distribución regenerada exitosamente',
      distribution
    });
  } catch (error: any) {
    return res.status(400).json({ 
      message: 'Error al regenerar distribución', 
      error: error.message 
    });
  }
});

// Endpoint para obtener las citas agendadas de una disponibilidad específica
router.get('/:id/appointments', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid availability id' });

  try {
    // Obtener información de la disponibilidad
    const [availabilityRows] = await pool.query<any[]>(`
      SELECT 
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.booked_slots,
        a.status,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name
      FROM availabilities a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id
      LEFT JOIN locations l ON l.id = a.location_id
      WHERE a.id = ?
    `, [id]);

    if (!availabilityRows || availabilityRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Disponibilidad no encontrada' });
    }

    const availability = availabilityRows[0];

    // Obtener las citas agendadas para esta disponibilidad
    const [appointments] = await pool.query<any[]>(`
      SELECT 
        ap.id AS appointment_id,
        ap.scheduled_at,
        ap.status,
        ap.reason,
        ap.duration_minutes,
        ap.created_at,
        p.id AS patient_id,
        p.name AS patient_name,
        p.document_type,
        p.document,
        p.phone
      FROM appointments ap
      JOIN patients p ON p.id = ap.patient_id
      WHERE ap.availability_id = ?
      ORDER BY ap.scheduled_at ASC
    `, [id]);

    // Contar por estado
    const statusCounts = appointments.reduce((acc: any, apt: any) => {
      acc[apt.status] = (acc[apt.status] || 0) + 1;
      return acc;
    }, {});

    const confirmedCount = appointments.filter((a: any) => 
      !['Cancelada', 'No asistió'].includes(a.status)
    ).length;

    return res.json({
      success: true,
      data: {
        availability: {
          id: availability.id,
          date: availability.date,
          startTime: availability.start_time,
          endTime: availability.end_time,
          capacity: availability.capacity,
          bookedSlots: availability.booked_slots,
          status: availability.status,
          doctorName: availability.doctor_name,
          specialtyName: availability.specialty_name,
          locationName: availability.location_name
        },
        summary: {
          totalAppointments: appointments.length,
          confirmedAppointments: confirmedCount,
          cancelledAppointments: statusCounts['Cancelada'] || 0,
          noShowAppointments: statusCounts['No asistió'] || 0,
          capacity: availability.capacity,
          availableSlots: Math.max(0, availability.capacity - confirmedCount),
          occupancyRate: availability.capacity > 0 
            ? Math.round((confirmedCount / availability.capacity) * 100) 
            : 0,
          isOverbooked: confirmedCount > availability.capacity
        },
        statusBreakdown: statusCounts,
        appointments: appointments.map((apt: any) => ({
          id: apt.appointment_id,
          scheduledAt: apt.scheduled_at,
          status: apt.status,
          reason: apt.reason,
          durationMinutes: apt.duration_minutes,
          createdAt: apt.created_at,
          patient: {
            id: apt.patient_id,
            name: apt.patient_name,
            documentType: apt.document_type,
            document: apt.document,
            phone: apt.phone
          }
        }))
      }
    });
  } catch (error: any) {
    console.error('Error fetching availability appointments:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener las citas de la disponibilidad', 
      error: error.message 
    });
  }
});

// Endpoint para obtener todas las distribuciones existentes
router.get('/distributions', requireAuth, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ad.id,
        ad.availability_id,
        ad.day_date,
        ad.quota,
        ad.assigned,
        ad.created_at,
        a.doctor_id,
        a.specialty_id,
        a.location_id,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        a.date AS availability_date,
        a.start_time,
        a.end_time,
        a.capacity AS total_capacity
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE a.status = 'Activa'
      ORDER BY ad.day_date ASC, a.start_time ASC
    `);
    
    return res.json({
      success: true,
      data: rows
    });
  } catch (error: any) {
    console.error('Error fetching all distributions:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener las distribuciones', 
      error: error.message 
    });
  }
});

// Endpoint para obtener distribuciones por rango de fechas
router.get('/distributions/range', requireAuth, async (req: Request, res: Response) => {
  const { start_date, end_date, doctor_id, specialty_id, location_id } = req.query;
  
  try {
    let whereConditions = ['a.status = ?'];
    let params: any[] = ['Activa'];
    
    if (start_date) {
      whereConditions.push('ad.day_date >= ?');
      params.push(start_date);
    }
    
    if (end_date) {
      whereConditions.push('ad.day_date <= ?');
      params.push(end_date);
    }
    
    if (doctor_id) {
      whereConditions.push('a.doctor_id = ?');
      params.push(Number(doctor_id));
    }
    
    if (specialty_id) {
      whereConditions.push('a.specialty_id = ?');
      params.push(Number(specialty_id));
    }
    
    if (location_id) {
      whereConditions.push('a.location_id = ?');
      params.push(Number(location_id));
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const [rows] = await pool.query(`
      SELECT 
        ad.id,
        ad.availability_id,
        ad.day_date,
        ad.quota,
        ad.assigned,
        ad.created_at,
        a.doctor_id,
        a.specialty_id,
        a.location_id,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        a.date AS availability_date,
        a.start_time,
        a.end_time,
        a.capacity AS total_capacity,
        (ad.quota - ad.assigned) AS remaining
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE ${whereClause}
      ORDER BY ad.day_date ASC, a.start_time ASC
    `, params);
    
    return res.json({
      success: true,
      data: rows,
      filters: {
        start_date,
        end_date,
        doctor_id,
        specialty_id,
        location_id
      }
    });
  } catch (error: any) {
    console.error('Error fetching distributions by range:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener las distribuciones por rango', 
      error: error.message 
    });
  }
});

// Endpoint para obtener estadísticas de distribución
router.get('/distributions/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const [totalStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_days,
        SUM(ad.quota) as total_quota,
        SUM(ad.assigned) as total_assigned,
        SUM(ad.quota - ad.assigned) as total_remaining,
        ROUND(AVG(ad.quota), 2) as avg_quota_per_day,
        ROUND((SUM(ad.assigned) / SUM(ad.quota)) * 100, 2) as utilization_percentage
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      WHERE a.status = 'Activa'
    `);
    
    const [byDoctor] = await pool.query(`
      SELECT 
        d.name as doctor_name,
        COUNT(DISTINCT ad.day_date) as days_with_distribution,
        SUM(ad.quota) as total_quota,
        SUM(ad.assigned) as total_assigned,
        SUM(ad.quota - ad.assigned) as total_remaining,
        ROUND((SUM(ad.assigned) / SUM(ad.quota)) * 100, 2) as utilization_percentage
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.status = 'Activa'
      GROUP BY a.doctor_id, d.name
      ORDER BY total_quota DESC
    `);
    
    const [bySpecialty] = await pool.query(`
      SELECT 
        s.name as specialty_name,
        COUNT(DISTINCT ad.day_date) as days_with_distribution,
        SUM(ad.quota) as total_quota,
        SUM(ad.assigned) as total_assigned,
        SUM(ad.quota - ad.assigned) as total_remaining,
        ROUND((SUM(ad.assigned) / SUM(ad.quota)) * 100, 2) as utilization_percentage
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN specialties s ON s.id = a.specialty_id
      WHERE a.status = 'Activa'
      GROUP BY a.specialty_id, s.name
      ORDER BY total_quota DESC
    `);
    
    const [recentActivity] = await pool.query(`
      SELECT 
        ad.day_date,
        COUNT(*) as availabilities_count,
        SUM(ad.quota) as day_total_quota,
        SUM(ad.assigned) as day_total_assigned,
        SUM(ad.quota - ad.assigned) as day_total_remaining
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      WHERE a.status = 'Activa'
        AND ad.day_date > DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      GROUP BY ad.day_date
      ORDER BY ad.day_date ASC
      LIMIT 30
    `);
    
    return res.json({
      success: true,
      data: {
        overview: (totalStats as any[])[0],
        by_doctor: byDoctor,
        by_specialty: bySpecialty,
        upcoming_days: recentActivity
      }
    });
  } catch (error: any) {
    console.error('Error fetching distribution stats:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener estadísticas de distribución', 
      error: error.message 
    });
  }
});

// Endpoint para obtener availabilities activas (para el dropdown de selección)
router.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.status,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        (SELECT COUNT(*) FROM availability_distribution ad WHERE ad.availability_id = a.id) as has_distribution
      FROM availabilities a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE a.status = 'Activa'
        AND a.date > DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      ORDER BY a.date ASC, a.start_time ASC
    `);
    
    return res.json({
      success: true,
      data: rows
    });
  } catch (error: any) {
    console.error('Error fetching active availabilities:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener disponibilidades activas', 
      error: error.message 
    });
  }
});

// Obtener listas para filtros (doctores, especialidades, ubicaciones)
router.get('/filters/options', requireAuth, async (req, res) => {
  try {
    // Obtener doctores únicos
    const [doctorsRows] = await pool.execute(`
      SELECT DISTINCT d.id, d.name 
      FROM doctors d
      INNER JOIN availabilities a ON d.id = a.doctor_id
      WHERE a.status = 'Activa'
      ORDER BY d.name
    `);

    // Obtener especialidades únicas
    const [specialtiesRows] = await pool.execute(`
      SELECT DISTINCT s.id, s.name 
      FROM specialties s
      INNER JOIN availabilities a ON s.id = a.specialty_id
      WHERE a.status = 'Activa'
      ORDER BY s.name
    `);

    // Obtener ubicaciones únicas
    const [locationsRows] = await pool.execute(`
      SELECT DISTINCT l.id, l.name 
      FROM locations l
      INNER JOIN availabilities a ON l.id = a.location_id
      WHERE a.status = 'Activa'
      ORDER BY l.name
    `);

    res.json({
      success: true,
      data: {
        doctors: doctorsRows,
        specialties: specialtiesRows,
        locations: locationsRows
      }
    });
  } catch (error) {
    console.error('Error getting filter options:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// GET /api/availabilities/:id/distribution - Obtener distribución de cupos para una agenda específica
router.get('/:id/distribution', requireAuth, async (req: Request, res: Response) => {
  const availabilityId = Number(req.params.id);
  
  if (Number.isNaN(availabilityId)) {
    return res.status(400).json({
      success: false,
      message: 'ID de agenda inválido'
    });
  }

  try {
    // Obtener información de la agenda
    const [availabilityRows] = await pool.query(
      `SELECT a.*, d.name as doctor_name, s.name as specialty_name, l.name as location_name
       FROM availabilities a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       WHERE a.id = ?`,
      [availabilityId]
    );

    if (!Array.isArray(availabilityRows) || availabilityRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agenda no encontrada'
      });
    }

    // Obtener distribución
    const [distributionRows] = await pool.query(
      `SELECT * FROM availability_distribution 
       WHERE availability_id = ? 
       ORDER BY day_date ASC`,
      [availabilityId]
    );

    const availability = availabilityRows[0];
    const distribution = Array.isArray(distributionRows) ? distributionRows : [];

    // Calcular estadísticas
    const totalQuota = distribution.reduce((sum: number, d: any) => sum + (d.quota || 0), 0);
    const totalAssigned = distribution.reduce((sum: number, d: any) => sum + (d.assigned || 0), 0);
    const remaining = totalQuota - totalAssigned;

    return res.json({
      success: true,
      data: {
        availability: availability,
        distribution: distribution,
        stats: {
          total_quota: totalQuota,
          total_assigned: totalAssigned,
          remaining: remaining,
          distribution_days: distribution.length,
          average_per_day: distribution.length > 0 ? Number((totalQuota / distribution.length).toFixed(2)) : 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting availability distribution:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Endpoint para obtener opciones dinámicas basadas en availabilities activas
router.get('/smart-options', requireAuth, async (req: Request, res: Response) => {
  const { date, specialty_id, location_id, doctor_id } = req.query;
  
  try {
    let whereConditions = ['a.status = ?', 'a.date > DATE_SUB(CURDATE(), INTERVAL 1 DAY)'];
    let params: any[] = ['Activa'];
    
    // Filtrar por fecha si se proporciona
    if (date) {
      whereConditions.push('a.date = ?');
      params.push(date);
    }
    
    // Construir query base para obtener availabilities activas
    const baseQuery = `
      FROM availabilities a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id  
      JOIN locations l ON l.id = a.location_id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    // Obtener especialidades disponibles
    let specialtiesQuery = `SELECT DISTINCT s.id, s.name ${baseQuery}`;
    let specialtiesParams = [...params];
    
    if (location_id) {
      specialtiesQuery += ' AND a.location_id = ?';
      specialtiesParams.push(Number(location_id));
    }
    if (doctor_id) {
      specialtiesQuery += ' AND a.doctor_id = ?';
      specialtiesParams.push(Number(doctor_id));
    }
    specialtiesQuery += ' ORDER BY s.name';
    
    // Obtener ubicaciones disponibles
    let locationsQuery = `SELECT DISTINCT l.id, l.name ${baseQuery}`;
    let locationsParams = [...params];
    
    if (specialty_id) {
      locationsQuery += ' AND a.specialty_id = ?';
      locationsParams.push(Number(specialty_id));
    }
    if (doctor_id) {
      locationsQuery += ' AND a.doctor_id = ?';
      locationsParams.push(Number(doctor_id));
    }
    locationsQuery += ' ORDER BY l.name';
    
    // Obtener doctores disponibles
    let doctorsQuery = `SELECT DISTINCT d.id, d.name ${baseQuery}`;
    let doctorsParams = [...params];
    
    if (specialty_id) {
      doctorsQuery += ' AND a.specialty_id = ?';
      doctorsParams.push(Number(specialty_id));
    }
    if (location_id) {
      doctorsQuery += ' AND a.location_id = ?';
      doctorsParams.push(Number(location_id));
    }
    doctorsQuery += ' ORDER BY d.name';
    
    // Ejecutar queries en paralelo
    const [specialtiesResult, locationsResult, doctorsResult] = await Promise.all([
      pool.query(specialtiesQuery, specialtiesParams),
      pool.query(locationsQuery, locationsParams),
      pool.query(doctorsQuery, doctorsParams)
    ]);
    
    // Obtener slots disponibles si se proporciona especialidad, ubicación y doctor
    let availableSlots: any[] = [];
    if (specialty_id && location_id && doctor_id) {
      let slotsConditions = [...whereConditions, 'a.specialty_id = ?', 'a.location_id = ?', 'a.doctor_id = ?'];
      let slotsParams = [...params, Number(specialty_id), Number(location_id), Number(doctor_id)];
      
      const [slotsResult] = await pool.query(`
        SELECT 
          a.id as availability_id,
          a.date,
          a.start_time,
          a.end_time,
          a.capacity,
          a.booked_slots,
          (a.capacity - a.booked_slots) AS available_slots
        ${baseQuery.replace('WHERE', 'WHERE')} 
        AND a.specialty_id = ? AND a.location_id = ? AND a.doctor_id = ?
        HAVING available_slots > 0
        ORDER BY a.date ASC, a.start_time ASC
      `, slotsParams);
      
      availableSlots = Array.isArray(slotsResult) ? slotsResult : [];
    }
    
    return res.json({
      success: true,
      data: {
        specialties: Array.isArray(specialtiesResult[0]) ? specialtiesResult[0] : [],
        locations: Array.isArray(locationsResult[0]) ? locationsResult[0] : [],
        doctors: Array.isArray(doctorsResult[0]) ? doctorsResult[0] : [],
        available_slots: availableSlots
      },
      filters: {
        date: date || null,
        specialty_id: specialty_id ? Number(specialty_id) : null,
        location_id: location_id ? Number(location_id) : null,
        doctor_id: doctor_id ? Number(doctor_id) : null
      }
    });
  } catch (error: any) {
    console.error('Error getting smart options:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al obtener opciones inteligentes', 
      error: error.message 
    });
  }
});

// Endpoint para obtener distribución de disponibilidad por doctor/especialidad/ubicación
router.get('/distribution-calendar', requireAuth, async (req: Request, res: Response) => {
  const { doctor_id, specialty_id, location_id, start_date, end_date } = req.query;
  
  if (!doctor_id) {
    return res.status(400).json({
      success: false,
      message: 'doctor_id es requerido'
    });
  }
  
  try {
    let whereConditions = [
      'a.doctor_id = ?',
      'a.status = ?',
      'ad.day_date > DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    ];
    let params: any[] = [Number(doctor_id), 'Activa'];
    
    // Filtros opcionales
    if (specialty_id) {
      whereConditions.push('a.specialty_id = ?');
      params.push(Number(specialty_id));
    }
    
    if (location_id) {
      whereConditions.push('a.location_id = ?');
      params.push(Number(location_id));
    }
    
    if (start_date) {
      whereConditions.push('ad.day_date >= ?');
      params.push(start_date);
    }
    
    if (end_date) {
      whereConditions.push('ad.day_date <= ?');
      params.push(end_date);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const [rows] = await pool.query(`
      SELECT 
        ad.id as distribution_id,
        ad.availability_id,
        ad.day_date,
        ad.quota,
        ad.assigned,
        (ad.quota - ad.assigned) as available_slots,
        a.doctor_id,
        a.specialty_id,
        a.location_id,
        a.start_time,
        a.end_time,
        a.capacity as total_capacity,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name,
        DAYNAME(ad.day_date) as day_name_en,
        CASE DAYOFWEEK(ad.day_date)
          WHEN 1 THEN 'Domingo'
          WHEN 2 THEN 'Lunes'
          WHEN 3 THEN 'Martes'
          WHEN 4 THEN 'Miércoles'
          WHEN 5 THEN 'Jueves'
          WHEN 6 THEN 'Viernes'
          WHEN 7 THEN 'Sábado'
        END as day_name_es
      FROM availability_distribution ad
      JOIN availabilities a ON a.id = ad.availability_id
      JOIN doctors d ON d.id = a.doctor_id
      JOIN specialties s ON s.id = a.specialty_id
      JOIN locations l ON l.id = a.location_id
      WHERE ${whereClause}
      HAVING available_slots > 0
      ORDER BY ad.day_date ASC, a.start_time ASC
    `, params);
    
    // Agrupar por fecha para facilitar el manejo en frontend
    const groupedByDate: { [key: string]: any[] } = {};
    const availableDates: any[] = [];
    
    if (Array.isArray(rows)) {
      rows.forEach((row: any) => {
        const dateKey = row.day_date;
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
          availableDates.push({
            date: dateKey,
            day_name: row.day_name_es,
            total_available_slots: 0,
            time_slots: []
          });
        }
        
        const dateEntry = availableDates.find(d => d.date === dateKey);
        if (dateEntry) {
          dateEntry.total_available_slots += row.available_slots;
          dateEntry.time_slots.push({
            distribution_id: row.distribution_id,
            availability_id: row.availability_id,
            start_time: row.start_time,
            end_time: row.end_time,
            available_slots: row.available_slots,
            quota: row.quota,
            assigned: row.assigned
          });
        }
        
        groupedByDate[dateKey].push(row);
      });
    }
    
    return res.json({
      success: true,
      data: {
        available_dates: availableDates,
        grouped_by_date: groupedByDate,
        total_days: availableDates.length,
        total_slots: availableDates.reduce((sum, d) => sum + d.total_available_slots, 0)
      },
      filters: {
        doctor_id: Number(doctor_id),
        specialty_id: specialty_id ? Number(specialty_id) : null,
        location_id: location_id ? Number(location_id) : null,
        start_date: start_date || null,
        end_date: end_date || null
      }
    });
  } catch (error: any) {
    console.error('Error getting distribution calendar:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener calendario de distribución',
      error: error.message
    });
  }
});

// Endpoint para recalcular booked_slots de todas las disponibilidades
// Útil para sincronizar datos después de migraciones o correcciones
router.post('/recalculate-booked-slots', requireAuth, async (req: Request, res: Response) => {
  try {
    // Actualizar booked_slots basado en el conteo real de citas no canceladas
    const [result] = await pool.query(`
      UPDATE availabilities a
      SET a.booked_slots = (
        SELECT COUNT(*) 
        FROM appointments ap 
        WHERE ap.availability_id = a.id 
        AND ap.status != 'Cancelada'
      )
    `);

    // @ts-ignore
    const affectedRows = result.affectedRows || 0;

    return res.json({
      success: true,
      message: `Se recalcularon ${affectedRows} disponibilidades correctamente`,
      affected_rows: affectedRows
    });
  } catch (error: any) {
    console.error('Error recalculando booked_slots:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al recalcular booked_slots',
      error: error.message
    });
  }
});

// ===== REDISTRIBUCIÓN DE CUPOS NO ASIGNADOS =====

/**
 * POST /api/availabilities/:id/redistribute
 * Redistribuye cupos no asignados de días pasados hacia días futuros
 * para una disponibilidad específica
 */
router.post('/:id/redistribute', requireAuth, async (req: Request, res: Response) => {
  try {
    const availabilityId = parseInt(req.params.id);
    const { until_date } = req.body;

    if (isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de disponibilidad inválido'
      });
    }

    // Verificar que la disponibilidad existe
    const [availRows] = await pool.query(
      'SELECT id, status FROM availabilities WHERE id = ?',
      [availabilityId]
    );

    if ((availRows as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Disponibilidad no encontrada'
      });
    }

    // Ejecutar redistribución
    const result = await redistributeUnassignedQuota(availabilityId, until_date);

    return res.json({
      success: true,
      message: `Redistribución completada: ${result.redistributed_quota} cupos redistribuidos`,
      data: result
    });

  } catch (error: any) {
    console.error('Error en redistribución de cupos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al redistribuir cupos',
      error: error.message
    });
  }
});

/**
 * POST /api/availabilities/redistribute/all
 * Redistribuye cupos para todas las disponibilidades activas
 */
router.post('/redistribute/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const { until_date } = req.body;

    const result = await redistributeAllActiveAvailabilities(until_date);

    return res.json({
      success: true,
      message: `Redistribución global completada: ${result.total_redistributed} cupos redistribuidos en ${result.total_availabilities} disponibilidades`,
      data: result
    });

  } catch (error: any) {
    console.error('Error en redistribución global:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al redistribuir cupos globalmente',
      error: error.message
    });
  }
});

/**
 * GET /api/availabilities/:id/unassigned-summary
 * Obtiene resumen de cupos no asignados para una disponibilidad
 */
router.get('/:id/unassigned-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const availabilityId = parseInt(req.params.id);

    if (isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de disponibilidad inválido'
      });
    }

    const summary = await getUnassignedQuotaSummary(availabilityId);

    return res.json({
      success: true,
      data: summary,
      total_unassigned: summary.reduce((sum, day) => sum + day.unassigned, 0)
    });

  } catch (error: any) {
    console.error('Error obteniendo resumen de cupos no asignados:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener resumen',
      error: error.message
    });
  }
});

// Endpoint para sincronizar horas de citas secuencialmente
router.post('/:id/sync-appointment-times', requireAuth, async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const availabilityId = parseInt(req.params.id);

    if (isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de disponibilidad inválido'
      });
    }

    await connection.beginTransaction();

    // Obtener la availability completa
    const [availabilityRows] = await connection.query(`
      SELECT 
        av.id,
        av.location_id,
        av.specialty_id,
        av.doctor_id,
        DATE_FORMAT(av.date, '%Y-%m-%d') as date,
        av.start_time,
        av.end_time,
        av.capacity,
        av.booked_slots,
        av.duration_minutes,
        av.break_between_slots,
        l.name as location_name,
        s.name as specialty_name,
        d.name as doctor_name
      FROM availabilities av
      LEFT JOIN locations l ON av.location_id = l.id
      LEFT JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN doctors d ON av.doctor_id = d.id
      WHERE av.id = ?
    `, [availabilityId]);

    if (!Array.isArray(availabilityRows) || availabilityRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Availability no encontrada'
      });
    }

    const availability = availabilityRows[0] as any;

    // Obtener todas las citas confirmadas y pendientes de esta availability
    const [appointments] = await connection.query(`
      SELECT 
        a.id,
        a.patient_id,
        a.scheduled_at,
        a.duration_minutes,
        a.status,
        p.name as patient_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE a.availability_id = ?
        AND a.status IN ('Pendiente', 'Confirmada')
      ORDER BY a.scheduled_at, a.id
    `, [availabilityId]);

    if (!Array.isArray(appointments) || appointments.length === 0) {
      await connection.rollback();
      return res.json({
        success: true,
        message: 'No hay citas para sincronizar',
        updated: 0
      });
    }

    // Calcular hora de inicio base
    const fechaFormateada = String(availability.date).split('T')[0].split(' ')[0];
    const fechaHoraInicio = `${fechaFormateada} ${availability.start_time}`;
    let currentTime = utcDateFromYMDAndUTCTime(fechaFormateada, availability.start_time);

    console.log('🔧 Sincronización de horas iniciada:');
    console.log('  - Availability ID:', availabilityId);
    console.log('  - Fecha:', fechaFormateada);
    console.log('  - Hora inicio:', availability.start_time);
    console.log('  - Hora fin:', availability.end_time);
    console.log('  - Duration minutes:', availability.duration_minutes);
    console.log('  - Break between slots:', availability.break_between_slots);
    console.log('  - Total citas a reorganizar:', (appointments as any[]).length);

    if (isNaN(currentTime.getTime())) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Fecha/hora inválida: ${fechaHoraInicio}`
      });
    }

    const endTimeDate = utcDateFromYMDAndUTCTime(fechaFormateada, availability.end_time);
    let updatedCount = 0;
    const updates: any[] = [];

    // Reorganizar cada cita secuencialmente
    for (let i = 0; i < (appointments as any[]).length; i++) {
      const apt = (appointments as any[])[i];
      
      // Verificar si la cita excede el end_time de la availability
      if (currentTime >= endTimeDate) {
        console.log(`⚠️  ADVERTENCIA: Cita ${i + 1} excede el horario de fin (${availability.end_time})`);
        break; // No procesar más citas que excedan el horario
      }
      
      // Formatear la nueva hora para MySQL datetime
      const newScheduledAt = formatDateForMySQLUTC(currentTime);
      const oldScheduledAt = new Date(apt.scheduled_at).toISOString().slice(0, 19).replace('T', ' ');
      
      console.log(`  📅 Cita ${i + 1}: ${apt.patient_name}`);
      console.log(`     Hora anterior: ${oldScheduledAt}`);
      console.log(`     Hora nueva: ${newScheduledAt}`);
      
      // Actualizar la cita
      await connection.execute(
        `UPDATE appointments 
         SET scheduled_at = ? 
         WHERE id = ?`,
        [newScheduledAt, apt.id]
      );

      updates.push({
        id: apt.id,
        patient_name: apt.patient_name,
        old_time: oldScheduledAt,
        new_time: newScheduledAt
      });

      updatedCount++;

      // Calcular siguiente hora: sumar duration_minutes + break_between_slots
      const totalMinutes = availability.duration_minutes + (availability.break_between_slots || 0);
      console.log(`     Total minutos a sumar: ${totalMinutes} (duration: ${availability.duration_minutes} + break: ${availability.break_between_slots || 0})`);
      currentTime = new Date(currentTime.getTime() + (totalMinutes * 60 * 1000));
      console.log(`     Siguiente hora disponible: ${currentTime.toISOString().slice(11, 19)}`);
    }

    console.log(`✅ Sincronización completada: ${updatedCount} citas actualizadas`);

    await connection.commit();

    return res.json({
      success: true,
      message: `${updatedCount} citas sincronizadas correctamente`,
      updated: updatedCount,
      total: (appointments as any[]).length,
      updates: updates,
      availability: {
        id: availability.id,
        doctor: availability.doctor_name,
        specialty: availability.specialty_name,
        location: availability.location_name,
        date: fechaFormateada,
        start_time: availability.start_time,
        end_time: availability.end_time,
        duration_minutes: availability.duration_minutes,
        break_between_slots: availability.break_between_slots
      }
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('Error sincronizando horas de citas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al sincronizar horas',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Endpoint para sincronizar horas de TODAS las agendas activas (hoy y futuras)
router.post('/sync-all-appointment-times', requireAuth, async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Obtener TODAS las availabilities activas de hoy en adelante
    const today = new Date().toISOString().split('T')[0];
    
    const [availabilities] = await connection.query(`
      SELECT 
        av.id,
        av.location_id,
        av.specialty_id,
        av.doctor_id,
        DATE_FORMAT(av.date, '%Y-%m-%d') as date,
        av.start_time,
        av.end_time,
        av.capacity,
        av.booked_slots,
        av.duration_minutes,
        av.break_between_slots,
        l.name as location_name,
        s.name as specialty_name,
        d.name as doctor_name
      FROM availabilities av
      LEFT JOIN locations l ON av.location_id = l.id
      LEFT JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN doctors d ON av.doctor_id = d.id
      WHERE DATE(av.date) >= DATE(?)
        AND av.status = 'Activa'
      ORDER BY av.date, av.start_time, av.id
    `, [today]);

    if (!Array.isArray(availabilities) || availabilities.length === 0) {
      await connection.rollback();
      return res.json({
        success: true,
        message: 'No hay agendas activas para sincronizar',
        totalAgendas: 0,
        totalUpdated: 0
      });
    }

    console.log(`🔧 Sincronización GLOBAL de horas iniciada`);
    console.log(`  - Desde fecha: ${today}`);
    console.log(`  - Total agendas a procesar: ${availabilities.length}`);

    let totalUpdated = 0;
    let totalAgendas = 0;
    const agendaResults: any[] = [];

    // Procesar cada availability
    for (const availability of availabilities as any[]) {
      // Obtener todas las citas confirmadas y pendientes de esta availability
      const [appointments] = await connection.query(`
        SELECT 
          a.id,
          a.patient_id,
          a.scheduled_at,
          a.duration_minutes,
          a.status,
          p.name as patient_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        WHERE a.availability_id = ?
          AND a.status IN ('Pendiente', 'Confirmada')
        ORDER BY a.scheduled_at, a.id
      `, [availability.id]);

      if (!Array.isArray(appointments) || appointments.length === 0) {
        continue; // Saltar agendas sin citas
      }

      totalAgendas++;

      // Calcular hora de inicio base
      const fechaFormateada = String(availability.date).split('T')[0].split(' ')[0];
      const fechaHoraInicio = `${fechaFormateada} ${availability.start_time}`;
      let currentTime = utcDateFromYMDAndUTCTime(fechaFormateada, availability.start_time);

      if (isNaN(currentTime.getTime())) {
        console.log(`  ⚠️ Fecha/hora inválida para agenda ${availability.id}: ${fechaHoraInicio}`);
        continue;
      }

      const endTimeDate = utcDateFromYMDAndUTCTime(fechaFormateada, availability.end_time);
      let updatedInAgenda = 0;

      console.log(`  📋 Procesando agenda: ${availability.doctor_name} - ${availability.specialty_name}`);
      console.log(`     Citas a reorganizar: ${(appointments as any[]).length}`);

      // Reorganizar cada cita secuencialmente
      for (let i = 0; i < (appointments as any[]).length; i++) {
        const apt = (appointments as any[])[i];
        
        // Verificar si la cita excede el end_time de la availability
        if (currentTime >= endTimeDate) {
          console.log(`     ⚠️ Cita ${i + 1} excede el horario de fin`);
          break;
        }
        
        // Formatear la nueva hora para MySQL datetime
        const newScheduledAt = formatDateForMySQLUTC(currentTime);
        
        // Actualizar la cita
        await connection.execute(
          `UPDATE appointments 
           SET scheduled_at = ? 
           WHERE id = ?`,
          [newScheduledAt, apt.id]
        );

        updatedInAgenda++;
        totalUpdated++;

        // Calcular siguiente hora: sumar duration_minutes + break_between_slots
        const totalMinutes = availability.duration_minutes + (availability.break_between_slots || 0);
        currentTime = new Date(currentTime.getTime() + (totalMinutes * 60 * 1000));
      }

      agendaResults.push({
        id: availability.id,
        doctor: availability.doctor_name,
        specialty: availability.specialty_name,
        location: availability.location_name,
        updated: updatedInAgenda
      });

      console.log(`     ✅ ${updatedInAgenda} citas sincronizadas`);
    }

    console.log(`✅ Sincronización GLOBAL completada:`);
    console.log(`   - Agendas procesadas: ${totalAgendas}`);
    console.log(`   - Total citas actualizadas: ${totalUpdated}`);

    await connection.commit();

    return res.json({
      success: true,
      message: `${totalUpdated} citas sincronizadas en ${totalAgendas} agendas`,
      totalAgendas,
      totalUpdated,
      agendas: agendaResults
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('Error sincronizando horas globalmente:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al sincronizar horas',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Obtener agendas disponibles para reasignación (misma especialidad, con cupos)
router.get('/:id/available-for-reassignment', requireAuth, async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const availabilityId = parseInt(req.params.id);

    if (isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de disponibilidad inválido'
      });
    }

    // Obtener la availability original para conocer su especialidad
    const [originalRows] = await connection.query(`
      SELECT 
        av.specialty_id,
        s.name as specialty_name
      FROM availabilities av
      LEFT JOIN specialties s ON av.specialty_id = s.id
      WHERE av.id = ?
    `, [availabilityId]);

    if (!Array.isArray(originalRows) || originalRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Availability original no encontrada'
      });
    }

    const original = originalRows[0] as any;

    // Buscar agendas de la misma especialidad con cupos disponibles
    // Excluir la agenda actual y solo mostrar agendas con cupos disponibles REALES
    // (basado en booked_slots < capacity, independiente del status)
    const [availableRows] = await connection.query(`
      SELECT 
        av.id,
        av.location_id,
        av.specialty_id,
        av.doctor_id,
        DATE_FORMAT(av.date, '%Y-%m-%d') as date,
        av.start_time,
        av.end_time,
        av.capacity,
        av.booked_slots,
        (av.capacity - av.booked_slots) as available_slots,
        av.duration_minutes,
        av.status,
        l.name as location_name,
        s.name as specialty_name,
        d.name as doctor_name
      FROM availabilities av
      LEFT JOIN locations l ON av.location_id = l.id
      LEFT JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN doctors d ON av.doctor_id = d.id
      WHERE av.specialty_id = ?
        AND av.id != ?
        AND av.status IN ('Activa', 'Completa')
        AND av.booked_slots < av.capacity
        AND av.date >= CURDATE()
      ORDER BY av.date ASC, av.start_time ASC
      LIMIT 50
    `, [original.specialty_id, availabilityId]);

    // Calcular los time slots disponibles para cada agenda
    const agendasWithTimeSlots = await Promise.all(
      (availableRows as any[]).map(async (agenda) => {
        const availableTimeSlots = await calculateAvailableTimeSlots(agenda);
        return {
          ...agenda,
          available_time_slots: availableTimeSlots
        };
      })
    );

    return res.json({
      success: true,
      data: {
        original_availability_id: availabilityId,
        specialty_id: original.specialty_id,
        specialty_name: original.specialty_name,
        available_agendas: agendasWithTimeSlots
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo agendas disponibles:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener agendas disponibles',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Reasignar una cita a otra agenda
router.post('/reassign-appointment', requireAuth, async (req: Request, res: Response) => {
  console.log('[REASSIGN] ===== ENDPOINT LLAMADO =====');
  console.log('[REASSIGN] Body completo:', JSON.stringify(req.body, null, 2));
  console.log('[REASSIGN] Headers:', req.headers['content-type']);
  
  const connection = await pool.getConnection();
  
  try {
    const { appointment_id, new_availability_id, selected_time, transfer_reason } = req.body;

    console.log('[REASSIGN] Inicio de reasignación:', { appointment_id, new_availability_id, selected_time, transfer_reason });

    if (!appointment_id || !new_availability_id) {
      console.log('[REASSIGN] Error: Faltan parámetros requeridos');
      return res.status(400).json({
        success: false,
        message: 'appointment_id y new_availability_id son requeridos'
      });
    }

    await connection.beginTransaction();

    // Obtener la cita actual
    const [appointmentRows] = await connection.query(`
      SELECT 
        a.id,
        a.patient_id,
        a.availability_id as old_availability_id,
        a.scheduled_at,
        a.duration_minutes,
        a.reason,
        a.status,
        p.name as patient_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE a.id = ?
    `, [appointment_id]);

    if (!Array.isArray(appointmentRows) || appointmentRows.length === 0) {
      await connection.rollback();
      console.log('[REASSIGN] Error: Cita no encontrada', appointment_id);
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    const appointment = appointmentRows[0] as any;
    console.log('[REASSIGN] Cita encontrada:', {
      id: appointment.id,
      patient: appointment.patient_name,
      status: appointment.status,
      old_availability_id: appointment.old_availability_id
    });

    // Verificar que la cita esté confirmada o pendiente
    if (appointment.status === 'Cancelada' || appointment.status === 'Completada') {
      await connection.rollback();
      console.log('[REASSIGN] Error: Cita no se puede reasignar, status:', appointment.status);
      return res.status(400).json({
        success: false,
        message: 'No se puede reasignar una cita cancelada o completada'
      });
    }

    // Obtener la nueva availability
    const [newAvailRows] = await connection.query(`
      SELECT 
        av.id,
        av.location_id,
        av.specialty_id,
        av.doctor_id,
        DATE_FORMAT(av.date, '%Y-%m-%d') as date,
        av.start_time,
        av.end_time,
        av.capacity,
        av.booked_slots,
        av.duration_minutes,
        av.status,
        l.name as location_name,
        s.name as specialty_name,
        d.name as doctor_name
      FROM availabilities av
      LEFT JOIN locations l ON av.location_id = l.id
      LEFT JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN doctors d ON av.doctor_id = d.id
      WHERE av.id = ?
    `, [new_availability_id]);

    if (!Array.isArray(newAvailRows) || newAvailRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Nueva agenda no encontrada'
      });
    }

    const newAvail = newAvailRows[0] as any;

    // Verificar que la nueva agenda esté activa
    if (newAvail.status !== 'Activa') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'La agenda de destino no está activa'
      });
    }

    // Verificar que haya cupos disponibles
    if (newAvail.booked_slots >= newAvail.capacity) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'La agenda de destino no tiene cupos disponibles'
      });
    }

    // Calcular la nueva hora de la cita
    const fechaFormateada = String(newAvail.date).split('T')[0].split(' ')[0];
    let newScheduledAtUTC: string;

    // Si se proporcionó una hora específica, usarla
    if (selected_time) {
      console.log('[REASSIGN] Usando hora específica seleccionada (Colombia):', selected_time);
      const utcDate = utcDateFromYMDAndColombiaTime(fechaFormateada, selected_time);
      newScheduledAtUTC = formatDateForMySQLUTC(utcDate);
      
      console.log('[REASSIGN] Hora convertida a UTC:', newScheduledAtUTC);
    } else {
      // Si no se proporcionó hora específica, usar start_time que ya está en UTC
      let newScheduledTime = utcDateFromYMDAndUTCTime(fechaFormateada, newAvail.start_time);

      // Obtener las citas ya agendadas en la nueva availability para encontrar el primer slot libre
      const [existingAppointments] = await connection.query(`
        SELECT scheduled_at
        FROM appointments
        WHERE availability_id = ?
          AND status IN ('Confirmada', 'Pendiente')
        ORDER BY scheduled_at ASC
      `, [new_availability_id]);

      // Calcular el primer slot disponible
      if (Array.isArray(existingAppointments) && existingAppointments.length > 0) {
        const durationMinutes = newAvail.duration_minutes || 15;
        let currentSlot = newScheduledTime;
        
        for (const existingApt of existingAppointments as any[]) {
          const existingTime = new Date(existingApt.scheduled_at);
          
          // Si el slot actual está ocupado, avanzar al siguiente
          if (Math.abs(currentSlot.getTime() - existingTime.getTime()) < 60000) { // Menos de 1 minuto de diferencia
            currentSlot = new Date(currentSlot.getTime() + (durationMinutes * 60 * 1000));
          }
        }
        
        newScheduledTime = currentSlot;
      }
      
      newScheduledAtUTC = formatDateForMySQLUTC(newScheduledTime);
    }

    console.log('[REASSIGN] Guardando scheduled_at (UTC):', newScheduledAtUTC);

    // Actualizar la cita con la nueva availability, doctor, location, specialty y hora
    await connection.execute(
      `UPDATE appointments 
       SET availability_id = ?,
           doctor_id = ?,
           location_id = ?,
           specialty_id = ?,
           scheduled_at = ?,
           duration_minutes = ?
       WHERE id = ?`,
      [
        new_availability_id,
        newAvail.doctor_id,
        newAvail.location_id,
        newAvail.specialty_id,
        newScheduledAtUTC,
        newAvail.duration_minutes || appointment.duration_minutes,
        appointment_id
      ]
    );

    // Actualizar cupos de la agenda antigua (decrementar)
    await connection.execute(
      `UPDATE availabilities 
       SET booked_slots = IF(booked_slots > 0, booked_slots - 1, 0)
       WHERE id = ?`,
      [appointment.old_availability_id]
    );

    // Actualizar cupos de la nueva agenda (incrementar)
    await connection.execute(
      `UPDATE availabilities 
       SET booked_slots = IF(booked_slots < capacity, booked_slots + 1, capacity)
       WHERE id = ?`,
      [new_availability_id]
    );

    await connection.commit();

    // Calcular hora Colombia para respuesta (restar 5 horas del UTC guardado)
    const scheduledUTCDate = new Date(newScheduledAtUTC.replace(' ', 'T') + 'Z');
    const colombiaTime = new Date(scheduledUTCDate.getTime() - (5 * 60 * 60 * 1000));
    const newTimeForDisplay = colombiaTime.toISOString().slice(11, 16); // HH:mm

    return res.json({
      success: true,
      message: `Cita de ${appointment.patient_name} reasignada exitosamente`,
      data: {
        appointment_id: appointment_id,
        patient_name: appointment.patient_name,
        old_availability_id: appointment.old_availability_id,
        new_availability_id: new_availability_id,
        new_doctor: newAvail.doctor_name,
        new_location: newAvail.location_name,
        new_date: fechaFormateada,
        new_time: newTimeForDisplay,
        new_scheduled_at: newScheduledAtUTC
      }
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('[REASSIGN] Error crítico reasignando cita:', {
      error: error.message,
      stack: error.stack,
      appointment_id: req.body.appointment_id,
      new_availability_id: req.body.new_availability_id
    });
    return res.status(500).json({
      success: false,
      message: 'Error al reasignar la cita',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ENDPOINTS DE SINCRONIZACIÓN DE DISPONIBILIDADES
// ============================================

/**
 * POST /sync/:id - Sincroniza una disponibilidad específica
 */
router.post('/sync/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const availabilityId = Number(req.params.id);
    
    if (!availabilityId || isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de disponibilidad inválido'
      });
    }
    
    const success = await syncAvailabilitySlots(availabilityId);
    
    if (success) {
      // Obtener datos actualizados
      const [rows]: any = await pool.query(
        'SELECT id, capacity, booked_slots, status FROM availabilities WHERE id = ?',
        [availabilityId]
      );
      
      return res.json({
        success: true,
        message: 'Disponibilidad sincronizada correctamente',
        data: rows[0]
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Error al sincronizar la disponibilidad'
      });
    }
    
  } catch (error: any) {
    console.error('[SYNC] Error en endpoint /sync/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

/**
 * POST /sync-all - Sincroniza todas las disponibilidades activas
 */
router.post('/sync-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await syncAllAvailabilities();
    
    return res.json({
      success: true,
      message: `Sincronización completada: ${result.synced} exitosas, ${result.errors} errores`,
      data: result
    });
    
  } catch (error: any) {
    console.error('[SYNC] Error en endpoint /sync-all:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

/**
 * GET /validate/:id - Valida si se puede agregar una cita
 */
router.get('/validate/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const availabilityId = Number(req.params.id);
    
    if (!availabilityId || isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de disponibilidad inválido'
      });
    }
    
    const validation = await validateAvailabilityCapacity(availabilityId);
    
    return res.json({
      success: true,
      data: validation
    });
    
  } catch (error: any) {
    console.error('[SYNC] Error en endpoint /validate/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

// 🔄 SINCRONIZACIÓN AUTOMÁTICA DE TODAS LAS AGENDAS
router.post('/sync-all', requireAuth, async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    console.log('[SYNC-ALL] Iniciando sincronización global de availabilities');
    
    // Ejecutar el procedimiento almacenado
    const [results] = await connection.query('CALL sync_all_availability_slots()');
    
    const stats = (results as any)[0][0];
    
    console.log('[SYNC-ALL] Sincronización completada:', stats);
    
    return res.json({
      success: true,
      message: 'Sincronización completada exitosamente',
      data: {
        total_agendas: stats.total_agendas,
        activas: stats.activas,
        completas: stats.completas,
        con_cupos_disponibles: stats.con_cupos,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[SYNC-ALL] Error en sincronización global:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al sincronizar agendas',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 🔄 SINCRONIZACIÓN DE UNA AGENDA ESPECÍFICA
router.post('/:id/sync-slots', requireAuth, async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const availabilityId = parseInt(req.params.id);
    
    if (isNaN(availabilityId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de availability inválido'
      });
    }
    
    console.log(`[SYNC] Sincronizando availability ${availabilityId}`);
    
    // Obtener estado de la availability
    const [avResult] = await connection.query(`
      SELECT capacity, booked_slots, status, is_paused
      FROM availabilities
      WHERE id = ?
    `, [availabilityId]);
    
    if (!Array.isArray(avResult) || avResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Availability no encontrada'
      });
    }
    
    const availability = avResult[0] as any;
    
    // Si la agenda está pausada, omitir la sincronización
    if (availability.is_paused) {
      console.log(`[SYNC] Availability ${availabilityId} está pausada - sincronización omitida`);
      return res.json({
        success: true,
        message: 'Agenda pausada - sincronización omitida',
        skipped: true,
        data: {
          availability_id: availabilityId,
          is_paused: true,
          booked_slots: availability.booked_slots,
          capacity: availability.capacity,
          status: availability.status
        }
      });
    }
    
    // Contar citas confirmadas reales (excluyendo las pausadas)
    const [countResult] = await connection.query(`
      SELECT COUNT(*) as confirmed_count
      FROM appointments
      WHERE availability_id = ? AND status = 'Confirmada'
    `, [availabilityId]);
    
    const realBookedSlots = (countResult as any[])[0].confirmed_count;
    
    const newStatus = realBookedSlots >= availability.capacity ? 'Completa' : 'Activa';
    
    // Actualizar booked_slots y status
    await connection.query(`
      UPDATE availabilities
      SET booked_slots = ?,
          status = ?
      WHERE id = ?
    `, [realBookedSlots, newStatus, availabilityId]);
    
    console.log(`[SYNC] Availability ${availabilityId} actualizada: ${availability.booked_slots} → ${realBookedSlots} cupos, status: ${newStatus}`);
    
    return res.json({
      success: true,
      message: 'Sincronización completada',
      data: {
        availability_id: availabilityId,
        previous_booked_slots: availability.booked_slots,
        current_booked_slots: realBookedSlots,
        capacity: availability.capacity,
        available_slots: availability.capacity - realBookedSlots,
        previous_status: availability.status,
        current_status: newStatus,
        updated: availability.booked_slots !== realBookedSlots || availability.status !== newStatus
      }
    });
    
  } catch (error: any) {
    console.error('[SYNC] Error en sincronización:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al sincronizar availability',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /availabilities/:id/toggle-pause
 * Pausar o reanudar una agenda
 * - Pausar: Crea citas "fantasma" con estado "Pausada" para ocupar los cupos disponibles
 * - Reanudar: Elimina las citas fantasma y libera los cupos
 */
router.post('/:id/toggle-pause', requireAuth, async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const availabilityId = parseInt(req.params.id);
    
    if (!availabilityId || isNaN(availabilityId)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'ID de agenda inválido'
      });
    }
    
    // Obtener información de la agenda
    const [availabilityRows] = await connection.query(`
      SELECT 
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.booked_slots,
        a.is_paused,
        a.status,
        a.doctor_id,
        a.specialty_id,
        a.location_id,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM availabilities a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `, [availabilityId]);
    
    if (!Array.isArray(availabilityRows) || availabilityRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Agenda no encontrada'
      });
    }
    
    const availability = availabilityRows[0] as any;
    const isPaused = Boolean(availability.is_paused);
    
    if (isPaused) {
      // =================== REANUDAR AGENDA ===================
      
      // Contar cuántas citas reales (NO pausadas) existen
      const [realAppointmentsRows] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM appointments 
        WHERE availability_id = ? AND status != 'Pausada'
      `, [availabilityId]) as any;
      
      const realAppointmentsCount = realAppointmentsRows[0]?.count || 0;
      
      // Eliminar todas las citas con estado "Pausada"
      const [deleteResult] = await connection.query(`
        DELETE FROM appointments 
        WHERE availability_id = ? AND status = 'Pausada'
      `, [availabilityId]) as any;
      
      const deletedCount = deleteResult.affectedRows || 0;
      
      // Actualizar booked_slots con el conteo REAL de citas (sin las pausadas)
      await connection.query(`
        UPDATE availabilities 
        SET booked_slots = ?,
            is_paused = FALSE
        WHERE id = ?
      `, [realAppointmentsCount, availabilityId]);
      
      // Recalcular el estado de la agenda
      const newBookedSlots = realAppointmentsCount;
      const newStatus = newBookedSlots >= availability.capacity ? 'Completa' : 'Activa';
      
      await connection.query(`
        UPDATE availabilities 
        SET status = ?
        WHERE id = ?
      `, [newStatus, availabilityId]);
      
      await connection.commit();
      
      // Registrar en log de auditoría
      await connection.query(`
        INSERT INTO availability_pause_log 
        (availability_id, action, slots_affected, phantom_appointments_created, 
         phantom_appointments_deleted, previous_booked_slots, new_booked_slots, 
         user_id, notes)
        VALUES (?, 'resumed', ?, 0, ?, ?, ?, ?, ?)
      `, [
        availabilityId,
        deletedCount,
        deletedCount,
        availability.booked_slots,
        newBookedSlots,
        (req as any).user?.id || null,
        `Agenda reanudada. Doctor: ${availability.doctor_name}, Especialidad: ${availability.specialty_name}`
      ]);
      
      return res.json({
        success: true,
        action: 'resumed',
        message: `Agenda reanudada. Se liberaron ${deletedCount} cupos.`,
        data: {
          availability_id: availabilityId,
          doctor_name: availability.doctor_name,
          specialty_name: availability.specialty_name,
          location_name: availability.location_name,
          date: availability.date,
          time_range: `${availability.start_time} - ${availability.end_time}`,
          previous_booked_slots: availability.booked_slots,
          current_booked_slots: newBookedSlots,
          available_slots: availability.capacity - newBookedSlots,
          capacity: availability.capacity,
          status: newStatus,
          is_paused: false,
          slots_freed: deletedCount
        }
      });
      
    } else {
      // =================== PAUSAR AGENDA ===================
      
      // Calcular cupos disponibles
      const availableSlots = availability.capacity - availability.booked_slots;
      
      if (availableSlots <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'No hay cupos disponibles para pausar. La agenda ya está completa.'
        });
      }
      
      // Buscar o crear paciente "Fundación Biosanar IPS" para citas pausadas
      const [systemPatientRows] = await connection.query(`
        SELECT id FROM patients WHERE document = 'SISTEMA-PAUSA' LIMIT 1
      `) as any;
      
      let systemPatientId: number;
      
      if (systemPatientRows.length === 0) {
        // Crear paciente sistema si no existe
        const [insertResult] = await connection.query(`
          INSERT INTO patients (document, name, birth_date, gender, phone, email)
          VALUES ('SISTEMA-PAUSA', 'Fundación Biosanar IPS', '1900-01-01', 'Otro', '0000000000', 'sistema@biosanarcall.site')
        `) as any;
        systemPatientId = insertResult.insertId;
      } else {
        systemPatientId = systemPatientRows[0].id;
      }
      
      // Crear citas "fantasma" para ocupar los cupos disponibles
      const pausedAppointments = [];
      const scheduledDateTime = `${availability.date.toISOString().split('T')[0]} ${availability.start_time}`;
      
      for (let i = 0; i < availableSlots; i++) {
        pausedAppointments.push([
          systemPatientId, // patient_id del sistema
          availabilityId, // availability_id
          availability.location_id,
          availability.specialty_id,
          availability.doctor_id,
          scheduledDateTime, // scheduled_at
          30, // duration_minutes
          'Presencial',
          'Pausada', // status
          'AGENDA PAUSADA - Cupo bloqueado temporalmente',
          null, // insurance_type
          'Cita fantasma creada por pausa de agenda',
          null, // cancellation_reason
          (req as any).user?.id || null // created_by_user_id
        ]);
      }
      
      // Insertar todas las citas de pausa
      if (pausedAppointments.length > 0) {
        await connection.query(`
          INSERT INTO appointments 
          (patient_id, availability_id, location_id, specialty_id, doctor_id, 
           scheduled_at, duration_minutes, appointment_type, status, reason, 
           insurance_type, notes, cancellation_reason, created_by_user_id)
          VALUES ?
        `, [pausedAppointments]);
      }
      
      // Actualizar booked_slots y marcar como pausada
      await connection.query(`
        UPDATE availabilities 
        SET booked_slots = booked_slots + ?,
            is_paused = TRUE,
            status = 'Completa'
        WHERE id = ?
      `, [availableSlots, availabilityId]);
      
      await connection.commit();
      
      // Registrar en log de auditoría
      await connection.query(`
        INSERT INTO availability_pause_log 
        (availability_id, action, slots_affected, phantom_appointments_created, 
         phantom_appointments_deleted, previous_booked_slots, new_booked_slots, 
         user_id, notes)
        VALUES (?, 'paused', ?, ?, 0, ?, ?, ?, ?)
      `, [
        availabilityId,
        availableSlots,
        availableSlots,
        availability.booked_slots,
        availability.capacity,
        (req as any).user?.id || null,
        `Agenda pausada. Doctor: ${availability.doctor_name}, Especialidad: ${availability.specialty_name}`
      ]);
      
      return res.json({
        success: true,
        action: 'paused',
        message: `Agenda pausada. Se bloquearon ${availableSlots} cupos.`,
        data: {
          availability_id: availabilityId,
          doctor_name: availability.doctor_name,
          specialty_name: availability.specialty_name,
          location_name: availability.location_name,
          date: availability.date,
          time_range: `${availability.start_time} - ${availability.end_time}`,
          previous_booked_slots: availability.booked_slots,
          current_booked_slots: availability.capacity,
          available_slots: 0,
          capacity: availability.capacity,
          status: 'Completa',
          is_paused: true,
          slots_blocked: availableSlots
        }
      });
    }
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error en toggle-pause:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al pausar/reanudar agenda',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// ===== ENDPOINT PÚBLICO PARA OBTENER AVAILABILITIES =====
// GET /api/availabilities/public - Para uso desde portal de usuarios sin autenticación
// Función auxiliar para calcular slots de tiempo disponibles
async function calculateAvailableTimeSlots(availability: any): Promise<string[]> {
  try {
    // IMPORTANTE: start_time y end_time están almacenados en UTC en la base de datos
    // Debemos convertirlos a hora Colombia (UTC-5) para que coincidan con las citas convertidas
    const startTimeUTC = availability.start_time; // formato HH:mm:ss (hora UTC)
    const endTimeUTC = availability.end_time;     // formato HH:mm:ss (hora UTC)
    const duration = availability.duration_minutes || availability.default_duration_minutes || 15;
    const availabilityId = availability.id;
    const date = availability.date;

    // Convertir times a minutos desde medianoche
    const parseTimeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const formatMinutesToTime = (minutes: number): string => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    // Convertir de UTC a hora Colombia (restar 5 horas = 300 minutos)
    const UTC_OFFSET_MINUTES = 5 * 60; // 5 horas = 300 minutos
    let startMinutes = parseTimeToMinutes(startTimeUTC) - UTC_OFFSET_MINUTES;
    let endMinutes = parseTimeToMinutes(endTimeUTC) - UTC_OFFSET_MINUTES;
    
    // Manejar caso donde las horas se vuelven negativas (cruzando medianoche)
    if (startMinutes < 0) startMinutes += 24 * 60;
    if (endMinutes < 0) endMinutes += 24 * 60;
    
    // Generar todos los slots posibles en hora Colombia
    const allSlots: string[] = [];
    for (let time = startMinutes; time + duration <= endMinutes; time += duration) {
      allSlots.push(formatMinutesToTime(time));
    }

    // Consultar citas ya agendadas para esta agenda y fecha
    // scheduled_at está en UTC, convertir a UTC-5 (Colombia) para comparar
    const [bookedAppointments] = await pool.query(
      `SELECT TIME_FORMAT(CONVERT_TZ(scheduled_at, '+00:00', '-05:00'), '%H:%i') AS booked_time 
       FROM appointments 
       WHERE availability_id = ? 
         AND DATE(CONVERT_TZ(scheduled_at, '+00:00', '-05:00')) = ? 
         AND status NOT IN ('Cancelada', 'No Show')
       ORDER BY scheduled_at`,
      [availabilityId, date]
    );

    // Crear set de horas ocupadas (ya en hora local Colombia)
    const bookedTimes = new Set(
      (bookedAppointments as any[]).map(app => app.booked_time)
    );

    // Filtrar slots disponibles (ahora ambos están en hora Colombia)
    const availableSlots = allSlots.filter(slot => !bookedTimes.has(slot));
    
    console.log(`[CALCULATE-TIME-SLOTS] Agenda ${availabilityId}: UTC(${startTimeUTC}-${endTimeUTC}) -> COL(${formatMinutesToTime(startMinutes)}-${formatMinutesToTime(endMinutes)}). Slots: ${availableSlots.length}/${allSlots.length} disponibles. Ocupados: ${Array.from(bookedTimes).join(', ')}`);
    return availableSlots;
  } catch (error) {
    console.error('[CALCULATE-TIME-SLOTS] Error:', error);
    return [];
  }
}

router.get('/public', async (req: Request, res: Response) => {
  const date = String(req.query.date || '');
  const specialtyId = req.query.specialty_id ? Number(req.query.specialty_id) : null;
  
  let whereClause = '';
  let params: any[] = [];
  
  try {
    if (date) {
      whereClause = 'WHERE a.date = ?';
      params.push(date);
    } else {
      whereClause = 'WHERE a.date >= CURDATE()';
    }
    
    // Agregar filtro por especialidad si se proporciona
    if (specialtyId) {
      whereClause += ' AND a.specialty_id = ?';
      params.push(specialtyId);
    }
    
    // Mostrar solo agendas activas con cupos disponibles
    whereClause += ' AND a.status IN ("Activa", "Completa") AND (a.is_paused = 0 OR a.is_paused IS NULL)';
    whereClause += ' AND GREATEST(0, CAST(a.capacity AS SIGNED) - CAST(a.booked_slots AS SIGNED)) > 0';
    
    console.log('[AVAILABILITIES-PUBLIC] Query params:', { date, specialtyId, whereClause, params });
    
    const [rows] = await pool.query(
      `SELECT a.id,
              DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
              a.start_time,
              a.end_time,
              a.doctor_id,
              a.specialty_id,
              a.location_id,
              a.capacity,
              a.booked_slots,
              GREATEST(0, CAST(a.capacity AS SIGNED) - CAST(a.booked_slots AS SIGNED)) AS available_slots,
              a.duration_minutes,
              s.default_duration_minutes,
              a.status,
              d.name AS doctor_name, 
              s.name AS specialty_name, 
              l.name AS location_name
       FROM availabilities a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id  
       JOIN locations l ON l.id = a.location_id
       ${whereClause}
       ORDER BY a.date ASC, a.start_time ASC 
       LIMIT 100`,
      params
    );
    
    console.log(`[AVAILABILITIES-PUBLIC] Found ${Array.isArray(rows) ? rows.length : 0} rows with available slots`);
    
    // Calcular horarios disponibles para cada agenda
    const availabilitiesWithTimeSlots = await Promise.all(
      (rows as any[]).map(async (availability) => {
        const availableTimeSlots = await calculateAvailableTimeSlots(availability);
        
        return {
          ...availability,
          available_time_slots: availableTimeSlots,
          next_available_times: availableTimeSlots.slice(0, 5) // Mostrar las próximas 5 horas disponibles
        };
      })
    );
    
    return res.json(availabilitiesWithTimeSlots);
  } catch (e: any) {
    console.error('[AVAILABILITIES-PUBLIC] Error:', e);
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) {
      return res.json([]);
    }
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
});

export default router;
