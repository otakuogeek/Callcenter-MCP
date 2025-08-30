import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';
import { generateRandomPreallocation } from '../utils/randomPreallocation';

const router = Router();
router.use(requireAuth);

const optimizationSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doctor_id: z.number().optional(),
  specialty_id: z.number().optional(),
  location_id: z.number().optional(),
  min_utilization: z.number().min(0).max(100).default(70),
  auto_adjust: z.boolean().default(false)
});

// Análisis de utilización de agenda
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const data = optimizationSchema.parse(req.body);
    
    let whereConditions = ['a.date BETWEEN ? AND ?'];
    let params: any[] = [data.date_from, data.date_to];
    
    if (data.doctor_id) {
      whereConditions.push('a.doctor_id = ?');
      params.push(data.doctor_id);
    }
    if (data.specialty_id) {
      whereConditions.push('a.specialty_id = ?');
      params.push(data.specialty_id);
    }
    if (data.location_id) {
      whereConditions.push('a.location_id = ?');
      params.push(data.location_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Análisis de utilización por slot
    const [availabilities] = await pool.execute(`
      SELECT 
        a.*,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name,
        ROUND((a.booked_slots / a.capacity) * 100, 2) as utilization_percentage,
        CASE 
          WHEN (a.booked_slots / a.capacity) * 100 < ? THEN 'low'
          WHEN (a.booked_slots / a.capacity) * 100 >= ? AND (a.booked_slots / a.capacity) * 100 < 90 THEN 'optimal'
          ELSE 'high'
        END as utilization_status
      FROM availabilities a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE ${whereClause}
      ORDER BY a.date, a.start_time
    `, [...params, data.min_utilization, data.min_utilization]);

    // Estadísticas generales
    const [statsRows] = await pool.query(`
      SELECT 
        COUNT(*) as total_slots,
        SUM(a.capacity) as total_capacity,
        SUM(a.booked_slots) as total_occupied,
        ROUND(AVG((a.booked_slots / a.capacity) * 100), 2) as avg_utilization,
        COUNT(CASE WHEN (a.booked_slots / a.capacity) * 100 < ? THEN 1 END) as low_utilization_slots,
        COUNT(CASE WHEN (a.booked_slots / a.capacity) * 100 >= ? AND (a.booked_slots / a.capacity) * 100 < 90 THEN 1 END) as optimal_slots,
        COUNT(CASE WHEN (a.booked_slots / a.capacity) * 100 >= 90 THEN 1 END) as high_utilization_slots
      FROM availabilities a
      WHERE ${whereClause}
    `, [...params, data.min_utilization, data.min_utilization]);

    // Recomendaciones automáticas
    const recommendations = [];
    const utilizationRows = availabilities as any[];
    const lowUtilizationSlots = utilizationRows.filter(slot => slot.utilization_status === 'low');
    
    if (lowUtilizationSlots.length > 0) {
      recommendations.push({
        type: 'reduce_capacity',
        description: `${lowUtilizationSlots.length} slots con baja utilización podrían reducir capacidad`,
        slots: lowUtilizationSlots.map(slot => slot.id),
        potential_savings: lowUtilizationSlots.reduce((sum, slot) => sum + (slot.capacity - slot.booked_slots), 0)
      });
    }

    // Identificar patrones de demanda
    const [demandPatterns] = await pool.query(`
      SELECT 
        DAYOFWEEK(a.date) as day_of_week,
        TIME(a.start_time) as time_slot,
        AVG((a.booked_slots / a.capacity) * 100) as avg_utilization,
        COUNT(*) as slot_count
      FROM availabilities a
      WHERE ${whereClause}
      GROUP BY DAYOFWEEK(a.date), TIME(a.start_time)
      HAVING slot_count >= 3
      ORDER BY avg_utilization DESC
    `, params);

    res.json({
      success: true,
      data: {
        utilization_analysis: utilizationRows,
        statistics: (statsRows as any[])[0],
        demand_patterns: demandPatterns,
        recommendations,
        analysis_period: {
          from: data.date_from,
          to: data.date_to,
          min_utilization_threshold: data.min_utilization
        }
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Datos inválidos', 
        details: error.errors 
      });
    }
    console.error('Error analyzing agenda optimization:', error);
    res.status(500).json({ success: false, error: 'Error al analizar optimización' });
  }
});

// Aplicar optimizaciones automáticas
router.post('/auto-optimize', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const data = optimizationSchema.parse(req.body);
    
    if (!data.auto_adjust) {
      return res.status(400).json({ 
        success: false, 
        error: 'Auto-ajuste no habilitado' 
      });
    }

    await connection.beginTransaction();

    let whereConditions = ['date BETWEEN ? AND ?'];
    let params: any[] = [data.date_from, data.date_to];
    
    if (data.doctor_id) {
      whereConditions.push('doctor_id = ?');
      params.push(data.doctor_id);
    }
    if (data.specialty_id) {
      whereConditions.push('specialty_id = ?');
      params.push(data.specialty_id);
    }
    if (data.location_id) {
      whereConditions.push('location_id = ?');
      params.push(data.location_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Identificar slots con muy baja utilización (menos del 30%)
    const [lowUtilizationSlots] = await connection.query(`
      SELECT id, capacity, booked_slots, 
             ROUND((booked_slots / capacity) * 100, 2) as utilization
      FROM availabilities 
      WHERE ${whereClause} 
        AND (booked_slots / capacity) * 100 < 30 
        AND capacity > 1
        AND date >= CURDATE()
    `, params) as any;

    let optimizations = [];

    // Reducir capacidad en slots con baja utilización
    for (const slot of lowUtilizationSlots) {
      const newCapacity = Math.max(slot.booked_slots + 1, Math.ceil(slot.capacity * 0.7));
      
      if (newCapacity < slot.capacity) {
        await connection.query(
          'UPDATE availabilities SET capacity = ?, updated_at = NOW() WHERE id = ?',
          [newCapacity, slot.id]
        );

        optimizations.push({
          slot_id: slot.id,
          action: 'reduce_capacity',
          old_capacity: slot.capacity,
          new_capacity: newCapacity,
          utilization: slot.utilization
        });
      }
    }

    // Identificar y consolidar slots duplicados en el mismo día/hora
    const [duplicateSlots] = await connection.query(`
      SELECT doctor_id, specialty_id, location_id, date, start_time, 
             COUNT(*) as slot_count,
             GROUP_CONCAT(id) as slot_ids,
             SUM(capacity) as total_capacity,
             SUM(booked_slots) as total_occupied
      FROM availabilities 
      WHERE ${whereClause} 
        AND date >= CURDATE()
      GROUP BY doctor_id, specialty_id, location_id, date, start_time
      HAVING COUNT(*) > 1
    `, params) as any;

    // Consolidar slots duplicados
    for (const duplicate of duplicateSlots) {
      const slotIds = duplicate.slot_ids.split(',').map((id: string) => parseInt(id));
      const primarySlotId = slotIds[0];
      const secondarySlotIds = slotIds.slice(1);

      // Actualizar slot principal con capacidad consolidada
      await connection.query(
        'UPDATE availabilities SET capacity = ?, booked_slots = ?, updated_at = NOW() WHERE id = ?',
        [duplicate.total_capacity, duplicate.total_occupied, primarySlotId]
      );

      // Mover citas de slots secundarios al principal
      for (const secondaryId of secondarySlotIds) {
        await connection.query(
          'UPDATE appointments SET availability_id = ? WHERE availability_id = ?',
          [primarySlotId, secondaryId]
        );
      }

      // Eliminar slots secundarios
      await connection.query(
        'DELETE FROM availabilities WHERE id IN (?)',
        [secondarySlotIds]
      );

      optimizations.push({
        action: 'consolidate_slots',
        primary_slot_id: primarySlotId,
        removed_slot_ids: secondarySlotIds,
        consolidated_capacity: duplicate.total_capacity
      });
    }

    await connection.commit();

    res.json({
      success: true,
      data: {
        optimizations,
        total_optimizations: optimizations.length,
        summary: {
          capacity_reductions: optimizations.filter(opt => opt.action === 'reduce_capacity').length,
          slot_consolidations: optimizations.filter(opt => opt.action === 'consolidate_slots').length
        }
      },
      message: `Se aplicaron ${optimizations.length} optimizaciones automáticas`
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
    console.error('Error applying auto optimization:', error);
    res.status(500).json({ success: false, error: 'Error al aplicar optimizaciones' });
  } finally {
    connection.release();
  }
});

// Sugerencias de horarios basadas en demanda histórica
router.get('/suggest-slots', async (req: Request, res: Response) => {
  try {
    const { doctor_id, specialty_id, location_id, date } = req.query;

    let whereConditions = ['a.date >= DATE_SUB(?, INTERVAL 3 MONTH)'];
    let params: any[] = [date || new Date().toISOString().split('T')[0]];

    if (doctor_id) {
      whereConditions.push('a.doctor_id = ?');
      params.push(doctor_id);
    }
    if (specialty_id) {
      whereConditions.push('a.specialty_id = ?');
      params.push(specialty_id);
    }
    if (location_id) {
      whereConditions.push('a.location_id = ?');
      params.push(location_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Analizar patrones históricos de demanda
    const [demandPatterns] = await pool.query(`
      SELECT 
        DAYOFWEEK(a.date) as day_of_week,
        HOUR(a.start_time) as hour_of_day,
        AVG((a.booked_slots / a.capacity) * 100) as avg_utilization,
        COUNT(*) as historical_slots,
        SUM(a.booked_slots) as total_occupied,
        SUM(a.capacity) as total_capacity
      FROM availabilities a
      WHERE ${whereClause}
      GROUP BY DAYOFWEEK(a.date), HOUR(a.start_time)
      HAVING historical_slots >= 5
      ORDER BY avg_utilization DESC, total_occupied DESC
    `, params);

    // Generar sugerencias
    const suggestions = (demandPatterns as any[]).map(pattern => ({
      day_of_week: pattern.day_of_week,
      day_name: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][pattern.day_of_week - 1],
      suggested_hour: pattern.hour_of_day,
      expected_utilization: Math.round(pattern.avg_utilization),
      historical_demand: pattern.total_occupied,
      confidence_score: Math.min(100, (pattern.historical_slots / 20) * 100),
      recommended_capacity: Math.ceil(pattern.total_occupied / pattern.historical_slots * 1.2)
    })).filter(suggestion => suggestion.expected_utilization > 50);

    res.json({
      success: true,
      data: {
        suggestions,
        analysis_period: '3 meses históricos',
        total_suggestions: suggestions.length
      }
    });

  } catch (error) {
    console.error('Error getting slot suggestions:', error);
    res.status(500).json({ success: false, error: 'Error al obtener sugerencias' });
  }
});

export default router;
// Distribución aleatoria de cupos previos a un día específico de atención
// Entrada: target_date (día de la atención), total_slots (cupos a distribuir), doctor_id (opcional)
// Regla: Distribuir entre fecha de publicación (hoy o publish_date opcional) y el día anterior al target_date, solo lunes-viernes.
// La distribución es aleatoria por día pero la suma total = total_slots. Nunca asignar 0 a todos: al menos cada día recibe >=1 mientras queden slots suficientes.
// No se crean citas reales aquí; se devuelve el plan. Si se pasa apply=true se crean registros placeholder en tabla scheduling_preallocation (si existe) o se adjunta en respuesta con warning.
const randomDistributionSchema = z.object({
  target_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  total_slots: z.number().min(1).max(10000),
  publish_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  doctor_id: z.number().optional(),
  location_id: z.number().optional(),
  specialty_id: z.number().optional(),
  apply: z.boolean().default(false)
});

router.post('/random-distribution', async (req: Request, res: Response) => {
  try {
    const data = randomDistributionSchema.parse(req.body);
    const result = await generateRandomPreallocation(data);
    res.json({ success: true, data: result, message: 'Distribución aleatoria generada correctamente' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Datos inválidos', details: error.errors });
    }
    console.error('Error en random-distribution:', error);
    res.status(500).json({ success: false, error: (error as any).message || 'Error al generar distribución' });
  }
});

// Obtener planes de preasignación
router.get('/preallocation', async (req: Request, res: Response) => {
  try {
    const { availability_id, doctor_id, target_date, from, to, include_details } = req.query;
    let where: string[] = [];
    let params: any[] = [];

    if (availability_id) { where.push('availability_id = ?'); params.push(availability_id); }
    if (doctor_id) { where.push('doctor_id = ?'); params.push(doctor_id); }
    if (target_date) { where.push('target_date = ?'); params.push(target_date); }
    if (from && to) { where.push('pre_date BETWEEN ? AND ?'); params.push(from, to); }

    if (!where.length) {
      return res.status(400).json({ success: false, error: 'Debe especificar al menos un filtro (availability_id, doctor_id+target_date o rango).' });
    }
    const whereClause = where.join(' AND ');

    const [rows] = await pool.query(
      `SELECT id, doctor_id, specialty_id, location_id, availability_id, target_date, pre_date, slots, assigned_count,
              (slots - assigned_count) AS remaining
         FROM scheduling_preallocation
         WHERE ${whereClause}
         ORDER BY pre_date ASC`
      , params
    );

    let details: any[] | null = null;
    if (include_details === 'true') {
      const ids = Array.isArray(rows) ? (rows as any[]).map(r => r.id) : [];
      if (ids.length) {
        const [assignments] = await pool.query(
          `SELECT a.preallocation_id, a.patient_id, a.appointment_id, a.assigned_at,
                  p.full_name AS patient_name
             FROM scheduling_preallocation_assignments a
             LEFT JOIN patients_v2 p ON p.id = a.patient_id
             WHERE a.preallocation_id IN (?)
             ORDER BY a.assigned_at ASC`, [ids]
        );
        details = assignments as any[];
      }
    }

    res.json({ success: true, data: { preallocation: rows, assignments: details } });
  } catch (e) {
    console.error('Error fetch preallocation:', e);
    res.status(500).json({ success: false, error: 'Error al obtener preallocation' });
  }
});
