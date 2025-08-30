import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Schema para crear agenda con distribución aleatoria
const batchAgendaSchema = z.object({
  doctor_id: z.number().int(),
  location_id: z.number().int(),
  specialty_id: z.number().int(),
  start_date: z.string(), // formato YYYY-MM-DD
  end_date: z.string(), // formato YYYY-MM-DD
  start_time: z.string(), // formato HH:mm
  end_time: z.string(), // formato HH:mm
  total_capacity: z.number().int().min(1),
  slot_duration_minutes: z.number().int().min(5).max(120).default(30),
  exclude_weekends: z.boolean().default(true),
  exclude_holidays: z.boolean().default(true),
  custom_excluded_dates: z.array(z.string()).optional(), // fechas específicas a excluir
  distribution_mode: z.enum(['random', 'balanced']).default('random'),
  max_daily_appointments: z.number().int().optional(),
  notes: z.string().optional()
});

// Función para obtener días hábiles en un rango de fechas
async function getWorkingDays(
  startDate: Date,
  endDate: Date,
  excludeWeekends: boolean,
  excludeHolidays: boolean,
  customExcludedDates: string[] = []
): Promise<Date[]> {
  const workingDays: Date[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay(); // 0=Sunday, 6=Saturday

    let isWorkingDay = true;

    // Excluir fines de semana si está configurado
    if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      isWorkingDay = false;
    }

    // Excluir feriados si está configurado
    if (excludeHolidays && isWorkingDay) {
      const [holidayRows] = await pool.query(
        'SELECT 1 FROM holidays WHERE date = ? LIMIT 1',
        [dateStr]
      );
      if (Array.isArray(holidayRows) && holidayRows.length > 0) {
        isWorkingDay = false;
      }
    }

    // Excluir fechas personalizadas
    if (isWorkingDay && customExcludedDates.includes(dateStr)) {
      isWorkingDay = false;
    }

    if (isWorkingDay) {
      workingDays.push(new Date(currentDate));
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

// Función para distribuir capacidad de manera aleatoria
function distributeCapacityRandomly(
  totalCapacity: number,
  workingDays: Date[],
  maxDailyAppointments?: number
): Map<string, number> {
  const distribution = new Map<string, number>();
  const remainingCapacity = totalCapacity;
  const daysCount = workingDays.length;

  // Inicializar todos los días con 0
  workingDays.forEach(day => {
    const dateStr = day.toISOString().split('T')[0];
    distribution.set(dateStr, 0);
  });

  // Distribuir la capacidad de manera aleatoria
  for (let i = 0; i < remainingCapacity; i++) {
    // Seleccionar un día aleatorio
    const randomIndex = Math.floor(Math.random() * daysCount);
    const selectedDay = workingDays[randomIndex];
    const dateStr = selectedDay.toISOString().split('T')[0];

    // Verificar límite diario si está configurado
    const currentCount = distribution.get(dateStr) || 0;
    if (maxDailyAppointments && currentCount >= maxDailyAppointments) {
      // Si ya alcanzó el máximo, intentar con otro día
      i--; // Reintentar esta iteración
      continue;
    }

    distribution.set(dateStr, currentCount + 1);
  }

  return distribution;
}

// Función para distribuir capacidad de manera balanceada
function distributeCapacityBalanced(
  totalCapacity: number,
  workingDays: Date[],
  maxDailyAppointments?: number
): Map<string, number> {
  const distribution = new Map<string, number>();
  const daysCount = workingDays.length;
  const baseCapacity = Math.floor(totalCapacity / daysCount);
  const extraCapacity = totalCapacity % daysCount;

  // Asignar capacidad base a todos los días
  workingDays.forEach((day, index) => {
    const dateStr = day.toISOString().split('T')[0];
    let capacity = baseCapacity;

    // Distribuir capacidad extra en los primeros días
    if (index < extraCapacity) {
      capacity += 1;
    }

    // Aplicar límite diario si está configurado
    if (maxDailyAppointments && capacity > maxDailyAppointments) {
      capacity = maxDailyAppointments;
    }

    distribution.set(dateStr, capacity);
  });

  return distribution;
}

// Crear agenda con distribución aleatoria
router.post('/batch-create', requireAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = batchAgendaSchema.parse(req.body);

    const {
      doctor_id,
      location_id,
      specialty_id,
      start_date,
      end_date,
      start_time,
      end_time,
      total_capacity,
      slot_duration_minutes,
      exclude_weekends,
      exclude_holidays,
      custom_excluded_dates,
      distribution_mode,
      max_daily_appointments,
      notes
    } = validatedData;

    // Generar ID único para el lote
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Obtener días hábiles en el rango
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const workingDays = await getWorkingDays(
      startDateObj,
      endDateObj,
      exclude_weekends,
      exclude_holidays,
      custom_excluded_dates
    );

    if (workingDays.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay días hábiles en el rango seleccionado'
      });
    }

    // Distribuir capacidad según el modo seleccionado
    let distribution: Map<string, number>;
    if (distribution_mode === 'random') {
      distribution = distributeCapacityRandomly(total_capacity, workingDays, max_daily_appointments);
    } else {
      distribution = distributeCapacityBalanced(total_capacity, workingDays, max_daily_appointments);
    }

    // Verificar que se haya distribuido toda la capacidad
    const totalDistributed = Array.from(distribution.values()).reduce((sum, count) => sum + count, 0);
    if (totalDistributed !== total_capacity) {
      return res.status(400).json({
        success: false,
        error: `No se pudo distribuir toda la capacidad. Distribuida: ${totalDistributed}, Requerida: ${total_capacity}`
      });
    }

    // Crear las disponibilidades usando el procedimiento almacenado
    const createdAvailabilities: any[] = [];

    for (const [dateStr, dailyCapacity] of distribution) {
      if (dailyCapacity > 0) {
        try {
          // Llamar al procedimiento almacenado para crear disponibilidad
          await pool.query(
            'CALL create_batch_availabilities(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              doctor_id,
              location_id,
              specialty_id,
              dateStr,
              dateStr, // mismo día para fecha fin
              start_time,
              end_time,
              dailyCapacity,
              slot_duration_minutes,
              batchId,
              exclude_weekends,
              exclude_holidays
            ]
          );

          // Obtener las disponibilidades creadas para este día
          const [availabilities] = await pool.query(
            'SELECT * FROM availabilities WHERE doctor_id = ? AND DATE(date) = ? AND batch_id = ?',
            [doctor_id, dateStr, batchId]
          );

          if (Array.isArray(availabilities)) {
            createdAvailabilities.push(...availabilities);
          }
        } catch (error) {
          console.error(`Error creando disponibilidad para ${dateStr}:`, error);
          // Continuar con el siguiente día
        }
      }
    }

    // Registrar el lote creado
    await pool.query(
      'INSERT INTO batch_operations (batch_id, operation_type, doctor_id, total_capacity, working_days, created_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        batchId,
        'availability_batch',
        doctor_id,
        total_capacity,
        workingDays.length,
        (req as any).user?.id || 1,
        notes || ''
      ]
    );

    res.json({
      success: true,
      data: {
        batch_id: batchId,
        total_capacity: total_capacity,
        working_days: workingDays.length,
        distribution: Object.fromEntries(distribution),
        created_availabilities: createdAvailabilities.length,
        date_range: {
          start: start_date,
          end: end_date
        },
        settings: {
          exclude_weekends,
          exclude_holidays,
          distribution_mode,
          slot_duration_minutes,
          max_daily_appointments
        }
      }
    });

  } catch (error) {
    console.error('Error creating batch agenda:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Obtener información de un lote específico
router.get('/batch/:batchId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    // Obtener información del lote
    const [batchInfo] = await pool.query(
      'SELECT * FROM batch_operations WHERE batch_id = ?',
      [batchId]
    );

    if (!Array.isArray(batchInfo) || batchInfo.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado'
      });
    }

    // Obtener disponibilidades del lote
    const [availabilities] = await pool.query(
      'SELECT * FROM availabilities WHERE batch_id = ? ORDER BY date',
      [batchId]
    );

    // Obtener citas asignadas en estas disponibilidades
    const availabilityIds = Array.isArray(availabilities)
      ? availabilities.map((a: any) => a.id)
      : [];

    let appointments: any[] = [];
    if (availabilityIds.length > 0) {
      const [appointmentsResult] = await pool.query(
        'SELECT * FROM appointments WHERE availability_id IN (?)',
        [availabilityIds]
      );
      appointments = Array.isArray(appointmentsResult) ? appointmentsResult : [];
    }

    res.json({
      success: true,
      data: {
        batch_info: batchInfo[0],
        availabilities: availabilities || [],
        appointments: appointments,
        statistics: {
          total_availabilities: Array.isArray(availabilities) ? availabilities.length : 0,
          total_appointments: appointments.length,
          utilization_rate: Array.isArray(availabilities) && availabilities.length > 0
            ? (appointments.length / availabilities.length) * 100
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Error getting batch info:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Listar lotes de agendas
router.get('/batches', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [batches] = await pool.query(
      `SELECT bo.*, d.first_name, d.last_name, l.name as location_name, s.name as specialty_name
       FROM batch_operations bo
       LEFT JOIN doctors d ON bo.doctor_id = d.id
       LEFT JOIN locations l ON d.location_id = l.id
       LEFT JOIN specialties s ON d.specialty_id = s.id
       WHERE bo.operation_type = 'availability_batch'
       ORDER BY bo.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [totalCount] = await pool.query(
      'SELECT COUNT(*) as total FROM batch_operations WHERE operation_type = "availability_batch"'
    );

    res.json({
      success: true,
      data: {
        batches: batches || [],
        pagination: {
          page,
          limit,
          total: Array.isArray(totalCount) && totalCount[0] ? (totalCount[0] as any).total : 0,
          pages: Math.ceil((Array.isArray(totalCount) && totalCount[0] ? (totalCount[0] as any).total : 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error listing batches:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Eliminar un lote de agendas
router.delete('/batch/:batchId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    // Verificar que el lote existe
    const [batchInfo] = await pool.query(
      'SELECT * FROM batch_operations WHERE batch_id = ?',
      [batchId]
    );

    if (!Array.isArray(batchInfo) || batchInfo.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado'
      });
    }

    // Eliminar citas asociadas primero
    await pool.query(
      'DELETE a FROM appointments a INNER JOIN availabilities av ON a.availability_id = av.id WHERE av.batch_id = ?',
      [batchId]
    );

    // Eliminar disponibilidades del lote
    await pool.query(
      'DELETE FROM availabilities WHERE batch_id = ?',
      [batchId]
    );

    // Eliminar el registro del lote
    await pool.query(
      'DELETE FROM batch_operations WHERE batch_id = ?',
      [batchId]
    );

    res.json({
      success: true,
      message: 'Lote eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;
