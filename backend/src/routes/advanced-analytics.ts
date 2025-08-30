import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Esquema para filtros de analytics
const analyticsFiltersSchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  location_id: z.number().int().optional(),
  specialty_id: z.number().int().optional(),
  doctor_id: z.number().int().optional(),
  appointment_type: z.enum(['Presencial', 'Telemedicina']).optional(),
  status: z.enum(['Pendiente', 'Confirmada', 'Completada', 'Cancelada']).optional(),
});

// Función auxiliar para construir WHERE clause
function buildWhereClause(filters: any): string {
  const conditions: string[] = [];

  if (filters.date_from) conditions.push(`a.scheduled_at >= '${filters.date_from}'`);
  if (filters.date_to) conditions.push(`a.scheduled_at <= '${filters.date_to}'`);
  if (filters.location_id) conditions.push(`a.location_id = ${filters.location_id}`);
  if (filters.specialty_id) conditions.push(`a.specialty_id = ${filters.specialty_id}`);
  if (filters.doctor_id) conditions.push(`a.doctor_id = ${filters.doctor_id}`);
  if (filters.appointment_type) conditions.push(`a.appointment_type = '${filters.appointment_type}'`);
  if (filters.status) conditions.push(`a.status = '${filters.status}'`);

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

// Obtener métricas generales del dashboard
router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  const parsed = analyticsFiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Filtros inválidos',
      errors: parsed.error.flatten()
    });
  }

  const filters = parsed.data;

  try {
    const whereClause = buildWhereClause(filters);

    // Métricas generales
    const [generalMetrics] = await pool.query(`
      SELECT
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) as completed_appointments,
        SUM(CASE WHEN status = 'Cancelada' THEN 1 ELSE 0 END) as cancelled_appointments,
        ROUND(AVG(duration_minutes), 1) as avg_duration,
        ROUND((SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as completion_rate
      FROM appointments a
      ${whereClause}
    `);

    const metrics = Array.isArray(generalMetrics) && generalMetrics[0] ? generalMetrics[0] : {
      total_appointments: 0,
      completed_appointments: 0,
      cancelled_appointments: 0,
      avg_duration: 0,
      completion_rate: 0
    };

    return res.json({
      success: true,
      data: {
        general_metrics: metrics,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generando dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener análisis de rendimiento por doctor
router.get('/doctor-performance', requireAuth, async (req: Request, res: Response) => {
  const parsed = analyticsFiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Filtros inválidos',
      errors: parsed.error.flatten()
    });
  }

  const filters = parsed.data;

  try {
    const whereClause = buildWhereClause(filters);

    const [doctorMetrics] = await pool.query(`
      SELECT
        d.name as doctor_name,
        COUNT(*) as total_appointments,
        SUM(CASE WHEN a.status = 'Completada' THEN 1 ELSE 0 END) as completed_appointments,
        ROUND(AVG(a.duration_minutes), 1) as avg_duration,
        ROUND((SUM(CASE WHEN a.status = 'Completada' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as completion_rate
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      ${whereClause}
      GROUP BY d.id, d.name
      ORDER BY total_appointments DESC
      LIMIT 20
    `);

    return res.json({
      success: true,
      data: {
        doctor_performance: Array.isArray(doctorMetrics) ? doctorMetrics : [],
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error analizando rendimiento de doctores:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener análisis de ocupación y capacidad
router.get('/capacity-analysis', requireAuth, async (req: Request, res: Response) => {
  const parsed = analyticsFiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Filtros inválidos',
      errors: parsed.error.flatten()
    });
  }

  const filters = parsed.data;

  try {
    const whereClause = buildWhereClause(filters);

    const [capacityMetrics] = await pool.query(`
      SELECT
        DATE(a.scheduled_at) as date,
        COUNT(*) as total_slots,
        SUM(CASE WHEN a.status != 'Cancelada' THEN 1 ELSE 0 END) as booked_slots,
        ROUND((SUM(CASE WHEN a.status != 'Cancelada' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as utilization_rate
      FROM availabilities av
      LEFT JOIN appointments a ON a.availability_id = av.id
      ${whereClause.replace('a.', 'av.')}
      GROUP BY DATE(av.date)
      ORDER BY date DESC
      LIMIT 30
    `);

    return res.json({
      success: true,
      data: {
        capacity_analysis: Array.isArray(capacityMetrics) ? capacityMetrics : [],
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error analizando capacidad:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener tendencias temporales
router.get('/trends', requireAuth, async (req: Request, res: Response) => {
  const parsed = analyticsFiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Filtros inválidos',
      errors: parsed.error.flatten()
    });
  }

  const filters = parsed.data;

  try {
    const whereClause = buildWhereClause(filters);

    const [trends] = await pool.query(`
      SELECT
        DATE_FORMAT(a.scheduled_at, '%Y-%m') as period,
        COUNT(*) as total_appointments,
        SUM(CASE WHEN a.status = 'Completada' THEN 1 ELSE 0 END) as completed_appointments,
        ROUND(AVG(a.duration_minutes), 1) as avg_duration,
        ROUND((SUM(CASE WHEN a.status = 'Completada' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as completion_rate
      FROM appointments a
      ${whereClause}
      GROUP BY DATE_FORMAT(a.scheduled_at, '%Y-%m')
      ORDER BY period DESC
      LIMIT 12
    `);

    const trendsArray = Array.isArray(trends) ? trends : [];

    return res.json({
      success: true,
      data: {
        trends: trendsArray,
        summary: {
          total_periods: trendsArray.length,
          avg_appointments_per_period: trendsArray.length > 0 ?
            Math.round(trendsArray.reduce((sum: number, t: any) => sum + (t.total_appointments || 0), 0) / trendsArray.length) : 0,
          growth_rate: 0, // Simplified
          best_period: trendsArray.length > 0 ? (trendsArray[0] as any).period : null,
          worst_period: trendsArray.length > 0 ? (trendsArray[trendsArray.length - 1] as any).period : null
        },
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error obteniendo tendencias:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener análisis de pacientes
router.get('/patient-analysis', requireAuth, async (req: Request, res: Response) => {
  const parsed = analyticsFiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Filtros inválidos',
      errors: parsed.error.flatten()
    });
  }

  const filters = parsed.data;

  try {
    const whereClause = buildWhereClause(filters);

    // Demografía de pacientes
    const [patientDemographics] = await pool.query(`
      SELECT
        COUNT(DISTINCT p.id) as total_patients,
        AVG(TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE())) as avg_age,
        SUM(CASE WHEN TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) < 18 THEN 1 ELSE 0 END) as pediatric_patients,
        SUM(CASE WHEN TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) > 65 THEN 1 ELSE 0 END) as elderly_patients
      FROM patients p
      JOIN appointments a ON a.patient_id = p.id
      ${whereClause}
    `);

    // Frecuencia de visitas
    const [visitFrequency] = await pool.query(`
      SELECT
        patient_visits,
        COUNT(*) as count,
        ROUND((COUNT(*) / (SELECT COUNT(*) FROM (
          SELECT COUNT(*) as visits FROM appointments ${whereClause} GROUP BY patient_id
        ) t)) * 100, 2) as percentage
      FROM (
        SELECT patient_id, COUNT(*) as patient_visits
        FROM appointments ${whereClause}
        GROUP BY patient_id
      ) visits
      GROUP BY patient_visits
      ORDER BY patient_visits
    `);

    // Tasa de retorno
    const [returnRate] = await pool.query(`
      SELECT
        ROUND((COUNT(DISTINCT CASE WHEN visit_count > 1 THEN patient_id END) /
               COUNT(DISTINCT patient_id)) * 100, 2) as return_rate
      FROM (
        SELECT patient_id, COUNT(*) as visit_count
        FROM appointments ${whereClause}
        GROUP BY patient_id
      ) patient_visits
    `);

    const demographics = Array.isArray(patientDemographics) && patientDemographics[0] ? patientDemographics[0] : {
      total_patients: 0,
      avg_age: 0,
      pediatric_patients: 0,
      elderly_patients: 0
    };

    const rate = Array.isArray(returnRate) && returnRate[0] ? returnRate[0] : { return_rate: 0 };

    return res.json({
      success: true,
      data: {
        demographics,
        visit_frequency: Array.isArray(visitFrequency) ? visitFrequency : [],
        return_rate: rate,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error analizando pacientes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
