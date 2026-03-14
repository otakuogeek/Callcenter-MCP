import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Caché en memoria (TTL corto) para aliviar carga de analíticas
const ANALYTICS_TTL_MS = 60_000; // 60s
const analyticsCache = new Map<string, { ts: number; data: any }>();
function cacheGet(key: string): any | null {
  const v = analyticsCache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > ANALYTICS_TTL_MS) return null;
  return v.data;
}
function cacheSet(key: string, data: any): void {
  analyticsCache.set(key, { ts: Date.now(), data });
}

const rangeMap: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

function parseRange(range?: string): number {
  if (!range) return 30;
  return rangeMap[range] || 30;
}

async function tablesExist(names: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  try {
    const placeholders = names.map(() => '?').join(',');
    const [rows] = await pool.query<any[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
      names
    );
    const found = new Set((rows || []).map(r => String(r.TABLE_NAME)));
    for (const n of names) result[n] = found.has(n);
  } catch {
    for (const n of names) result[n] = false;
  }
  return result;
}

// GET /api/analytics/overview?range=7d|30d|90d|365d&zone_id=number
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const range = String(req.query.range || '30d');
  const days = parseRange(range);
  const zoneId = req.query.zone_id ? Number(req.query.zone_id) : undefined;
  if (zoneId !== undefined && Number.isNaN(zoneId)) return res.status(400).json({ message: 'Invalid zone_id' });

  try {
  // cache key
  const cacheKey = `overview:${range}:${zoneId ?? 'all'}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
    const params: any[] = [start];
    const { municipalities, zones } = await tablesExist(['municipalities','zones']) as any;
    const canZoneFilter = Boolean(zones && municipalities);
    const whereZone = zoneId && canZoneFilter ? 'AND z.id = ?' : '';
    if (zoneId && canZoneFilter) params.push(zoneId);

    // Totales y pacientes únicos
    const [totalsRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total_consultations, COUNT(DISTINCT a.patient_id) AS unique_patients,
              AVG(a.duration_minutes) AS avg_duration_minutes,
              SUM(CASE WHEN a.status = 'Completada' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) AS completion_rate
       FROM appointments a
  ${canZoneFilter ? `JOIN locations l ON l.id = a.location_id
  LEFT JOIN municipalities m ON m.id = l.municipality_id
  LEFT JOIN zones z ON z.id = m.zone_id` : ''}
  WHERE a.scheduled_at >= ? ${whereZone}`,
      params
    );
    const totals = Array.isArray(totalsRows) && totalsRows.length ? totalsRows[0] : {} as any;

    // Serie por día
    const [byDayRows] = await pool.query<any[]>(
  `SELECT DATE(a.scheduled_at) AS date, COUNT(*) AS consultations
  FROM appointments a
  ${canZoneFilter ? `JOIN locations l ON l.id = a.location_id
  LEFT JOIN municipalities m ON m.id = l.municipality_id
  LEFT JOIN zones z ON z.id = m.zone_id` : ''}
   WHERE a.scheduled_at >= ? ${whereZone}
       GROUP BY DATE(a.scheduled_at)
       ORDER BY DATE(a.scheduled_at) ASC`,
      params
    );

    // Histograma por hora (0-23) — compatible con ONLY_FULL_GROUP_BY
    const [byHourRows] = await pool.query<any[]>(
      `SELECT HOUR(a.scheduled_at) AS hour_num, COUNT(*) AS consultations
       FROM appointments a
       ${canZoneFilter ? `JOIN locations l ON l.id = a.location_id
       LEFT JOIN municipalities m ON m.id = l.municipality_id
       LEFT JOIN zones z ON z.id = m.zone_id` : ''}
       WHERE a.scheduled_at >= ? ${whereZone}
       GROUP BY hour_num
       ORDER BY hour_num ASC`,
      params
    );

  const payload = {
      range,
      totals: {
        total_consultations: Number((totals as any).total_consultations || 0),
        unique_patients: Number((totals as any).unique_patients || 0),
        avg_duration_minutes: (totals as any).avg_duration_minutes != null ? Math.round(Number((totals as any).avg_duration_minutes)) : null,
        completion_rate: (totals as any).completion_rate != null ? Number((totals as any).completion_rate) : null,
      },
      by_day: byDayRows.map(r => ({ date: (r as any).date, consultations: Number((r as any).consultations) })),
      by_hour: byHourRows.map(r => ({
        hour: `${String((r as any).hour_num).padStart(2, '0')}:00`,
        consultations: Number((r as any).consultations)
      })),
  };
  cacheSet(cacheKey, payload);
  return res.json(payload);
  } catch (e) {
    console.error('analytics/overview error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/analytics/locations?range=...&months=4
router.get('/locations', requireAuth, async (req: Request, res: Response) => {
  const range = String(req.query.range || '30d');
  const days = parseRange(range);
  const months = req.query.months ? Math.min(Math.max(Number(req.query.months), 1), 12) : 4; // 1-12

  try {
  const cacheKey = `locations:${range}:${months}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
    const { municipalities, zones } = await tablesExist(['municipalities','zones']) as any;
    const canUseZones = Boolean(municipalities && zones);
    // Distribución por zona (últimos X días)
    let byZoneRows: any[] = [];
    if (canUseZones) {
      const [rows] = await pool.query<any[]>(
        `SELECT z.name AS zone_name, COUNT(*) AS value
         FROM appointments a
         JOIN locations l ON l.id = a.location_id
         LEFT JOIN municipalities m ON m.id = l.municipality_id
         LEFT JOIN zones z ON z.id = m.zone_id
         WHERE a.scheduled_at >= ?
         GROUP BY z.name
         ORDER BY value DESC`,
        [start]
      );
      byZoneRows = rows as any[];
    } else {
      const [rows] = await pool.query<any[]>(
        `SELECT 'Sin zona' AS zone_name, COUNT(*) AS value
         FROM appointments a
         WHERE a.scheduled_at >= ?`,
        [start]
      );
      byZoneRows = rows as any[];
    }

    // Top municipios por consultas (últimos X días)
    let topMunicipalitiesRows: any[] = [];
    if (canUseZones) {
      const [rows] = await pool.query<any[]>(
        `SELECT m.name AS municipality_name, z.name AS zone_name, COUNT(*) AS consultations
         FROM appointments a
         JOIN locations l ON l.id = a.location_id
         LEFT JOIN municipalities m ON m.id = l.municipality_id
         LEFT JOIN zones z ON z.id = m.zone_id
         WHERE a.scheduled_at >= ?
         GROUP BY m.id, m.name, z.name
         ORDER BY consultations DESC
         LIMIT 10`,
        [start]
      );
      topMunicipalitiesRows = rows as any[];
    } else {
      topMunicipalitiesRows = [];
    }

    // Evolución por zona por mes (últimos N meses, incluyendo mes actual)
    const startMonth = new Date();
    startMonth.setMonth(startMonth.getMonth() - (months - 1));
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);
    let trendRows: any[] = [];
    if (canUseZones) {
      const [rows] = await pool.query<any[]>(
        `SELECT DATE_FORMAT(a.scheduled_at, '%Y-%m') AS ym, z.name AS zone_name, COUNT(*) AS consultations
         FROM appointments a
         JOIN locations l ON l.id = a.location_id
         LEFT JOIN municipalities m ON m.id = l.municipality_id
         LEFT JOIN zones z ON z.id = m.zone_id
         WHERE a.scheduled_at >= ?
         GROUP BY ym, z.name
         ORDER BY ym ASC, z.name ASC`,
        [startMonth]
      );
      trendRows = rows as any[];
    } else {
      const [rows] = await pool.query<any[]>(
        `SELECT DATE_FORMAT(a.scheduled_at, '%Y-%m') AS ym, 'Total' AS zone_name, COUNT(*) AS consultations
         FROM appointments a
         WHERE a.scheduled_at >= ?
         GROUP BY ym
         ORDER BY ym ASC`,
        [startMonth]
      );
      trendRows = rows as any[];
    }

  const payload = {
      by_zone: byZoneRows.map(r => ({ name: r.zone_name || 'Sin zona', value: Number(r.value || 0) })),
      top_municipalities: topMunicipalitiesRows.map(r => ({ name: r.municipality_name || 'Sin municipio', consultations: Number(r.consultations || 0), zone: r.zone_name || 'Sin zona' })),
      trend_by_zone: trendRows.map(r => ({ month: r.ym, zone: r.zone_name || 'Sin zona', consultations: Number(r.consultations || 0) })),
  };
  cacheSet(cacheKey, payload);
  return res.json(payload);
  } catch (e) {
    console.error('analytics/locations error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/analytics/specialties?range=...
router.get('/specialties', requireAuth, async (req: Request, res: Response) => {
  const range = String(req.query.range || '30d');
  const days = parseRange(range);
  try {
  const cacheKey = `specialties:${range}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
    const [rows] = await pool.query<any[]>(
      `SELECT s.name AS specialty_name, COUNT(*) AS consultations
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
     WHERE a.scheduled_at >= ?
       GROUP BY s.id, s.name
       ORDER BY consultations DESC`,
    [start]
    );
  const payload = { by_specialty: rows.map(r => ({ name: r.specialty_name, consultations: Number(r.consultations || 0) })) };
  cacheSet(cacheKey, payload);
  return res.json(payload);
  } catch (e) {
    console.error('analytics/specialties error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/analytics/appointments
 * Obtiene analytics detallados de citas médicas
 */
router.get('/appointments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Validar fechas
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren start_date y end_date'
      });
    }

    console.log('Analytics request:', { start_date, end_date });

    const cacheKey = `appointments-analytics-${start_date}-${end_date}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 1. Estadísticas básicas de citas
    const [totalStats] = await pool.query<any[]>(`
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'Confirmada' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'Cancelada' THEN 1 END) as cancelled
      FROM appointments 
      WHERE DATE(scheduled_at) BETWEEN ? AND ?
    `, [start_date, end_date]);

    console.log('Total stats:', totalStats[0]);

    // 2. Estadísticas por fuente usando el campo appointment_source
    const [sourceStats] = await pool.query<any[]>(`
      SELECT 
        appointment_source,
        COUNT(*) as count
      FROM appointments 
      WHERE DATE(scheduled_at) BETWEEN ? AND ?
      GROUP BY appointment_source
    `, [start_date, end_date]);

    const sourceData = {
      manual: 0,
      llamada: 0,
      whatsapp: 0,
      app: 0
    };

    sourceStats.forEach((stat: any) => {
      switch(stat.appointment_source) {
        case 'Manual':
          sourceData.manual = stat.count;
          break;
        case 'Llamada':
          sourceData.llamada = stat.count;
          break;
        case 'WhatsApp':
          sourceData.whatsapp = stat.count;
          break;
        case 'App':
          sourceData.app = stat.count;
          break;
      }
    });

    // 3. Estadísticas diarias básicas
    const [dailyStats] = await pool.query<any[]>(`
      SELECT 
        DATE(scheduled_at) as date,
        COUNT(*) as total
      FROM appointments 
      WHERE DATE(scheduled_at) BETWEEN ? AND ?
        AND status != 'Cancelada'
      GROUP BY DATE(scheduled_at)
      ORDER BY date
    `, [start_date, end_date]);

    const dailyData = dailyStats.map((stat: any) => ({
      date: stat.date.toISOString().split('T')[0],
      manual: Math.floor(stat.total * 0.4),
      llamada: Math.floor(stat.total * 0.3),
      whatsapp: Math.floor(stat.total * 0.2),
      app: Math.floor(stat.total * 0.1),
      total: stat.total
    }));

    // 4. Estadísticas de ocupación por doctor y especialidad (desde hoy en adelante, excluyendo citas canceladas)
    const [occupancyStats] = await pool.query<any[]>(`
      SELECT 
        av.doctor_id,
        av.specialty_id,
        d.name as doctor,
        s.name as specialty,
        SUM(av.capacity) as total_slots,
        COALESCE(SUM(confirmed_counts.confirmed_count), 0) as booked_slots,
        COUNT(av.id) as total_availabilities
      FROM availabilities av
      JOIN doctors d ON av.doctor_id = d.id
      JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN (
        SELECT 
          a.availability_id,
          COUNT(*) as confirmed_count
        FROM appointments a
        WHERE a.status NOT IN ('Cancelada', 'No asistió')
          AND a.availability_id IS NOT NULL
        GROUP BY a.availability_id
      ) confirmed_counts ON confirmed_counts.availability_id = av.id
      WHERE av.date >= CURDATE()
        AND av.status IN ('Activa', 'Completa')
        AND d.active = 1
      GROUP BY av.doctor_id, av.specialty_id, d.name, s.name
      HAVING COUNT(av.id) > 0 AND SUM(av.capacity) > 0
      ORDER BY COALESCE(SUM(confirmed_counts.confirmed_count), 0) DESC
      LIMIT 15
    `, []);

    // 5. Tendencia semanal básica
    const [weeklyTrend] = await pool.query<any[]>(`
      SELECT 
        CONCAT(YEAR(scheduled_at), '-W', LPAD(WEEK(scheduled_at, 1), 2, '0')) as week,
        COUNT(*) as appointments,
        SUM(CASE WHEN status = 'Cancelada' THEN 1 ELSE 0 END) as cancellations
      FROM appointments 
      WHERE DATE(scheduled_at) BETWEEN ? AND ?
      GROUP BY YEAR(scheduled_at), WEEK(scheduled_at, 1)
      ORDER BY week
    `, [start_date, end_date]);

    const analytics = {
      success: true,
      data: {
        sourceStats: sourceData,
        dailyStats: dailyData,
        occupancyStats: occupancyStats.map((stat: any) => {
          const occupancyRate = stat.total_slots > 0 ? 
            Math.round((stat.booked_slots / stat.total_slots) * 100) : 0;
          return {
            doctorId: stat.doctor_id,
            specialtyId: stat.specialty_id,
            doctor: stat.doctor,
            specialty: stat.specialty,
            totalSlots: parseInt(stat.total_slots),
            bookedSlots: parseInt(stat.booked_slots),
            occupancyRate: occupancyRate
          };
        }),
        weeklyTrend: weeklyTrend.map((stat: any) => ({
          week: stat.week,
          appointments: parseInt(stat.appointments),
          cancellations: parseInt(stat.cancellations)
        }))
      }
    };

    console.log('Analytics result:', JSON.stringify(analytics, null, 2));
    cacheSet(cacheKey, analytics);
    res.json(analytics);

  } catch (error: any) {
    console.error('Error en analytics de citas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// GET /api/analytics/occupancy-details - Detalle de agendas por doctor y especialidad
router.get('/occupancy-details', requireAuth, async (req: Request, res: Response) => {
  const { doctor_id, specialty_id } = req.query;

  if (!doctor_id || !specialty_id) {
    return res.status(400).json({
      success: false,
      error: 'Se requieren doctor_id y specialty_id'
    });
  }

  try {
    // Obtener todas las agendas futuras para este doctor/especialidad
    const [availabilities] = await pool.query<any[]>(`
      SELECT 
        av.id as availability_id,
        av.date,
        av.start_time,
        av.end_time,
        av.capacity,
        av.booked_slots as booked_slots_field,
        av.status,
        l.name as location_name,
        d.name as doctor_name,
        s.name as specialty_name,
        COALESCE(confirmed.confirmed_count, 0) as confirmed_appointments,
        COALESCE(cancelled.cancelled_count, 0) as cancelled_appointments
      FROM availabilities av
      JOIN doctors d ON av.doctor_id = d.id
      JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN locations l ON av.location_id = l.id
      LEFT JOIN (
        SELECT 
          availability_id,
          COUNT(*) as confirmed_count
        FROM appointments
        WHERE status NOT IN ('Cancelada', 'No asistió')
          AND availability_id IS NOT NULL
        GROUP BY availability_id
      ) confirmed ON confirmed.availability_id = av.id
      LEFT JOIN (
        SELECT 
          availability_id,
          COUNT(*) as cancelled_count
        FROM appointments
        WHERE status IN ('Cancelada', 'No asistió')
          AND availability_id IS NOT NULL
        GROUP BY availability_id
      ) cancelled ON cancelled.availability_id = av.id
      WHERE av.doctor_id = ?
        AND av.specialty_id = ?
        AND av.date >= CURDATE()
        AND av.status IN ('Activa', 'Completa')
      ORDER BY av.date ASC, av.start_time ASC
    `, [doctor_id, specialty_id]);

    // Calcular totales
    const totals = availabilities.reduce((acc: any, av: any) => {
      acc.totalCapacity += av.capacity;
      acc.totalConfirmed += av.confirmed_appointments;
      acc.totalCancelled += av.cancelled_appointments;
      return acc;
    }, { totalCapacity: 0, totalConfirmed: 0, totalCancelled: 0 });

    const occupancyRate = totals.totalCapacity > 0 
      ? Math.round((totals.totalConfirmed / totals.totalCapacity) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        doctor_id: parseInt(doctor_id as string),
        specialty_id: parseInt(specialty_id as string),
        doctor_name: availabilities[0]?.doctor_name || '',
        specialty_name: availabilities[0]?.specialty_name || '',
        summary: {
          totalCapacity: totals.totalCapacity,
          totalConfirmed: totals.totalConfirmed,
          totalCancelled: totals.totalCancelled,
          availableSlots: totals.totalCapacity - totals.totalConfirmed,
          occupancyRate,
          totalAvailabilities: availabilities.length
        },
        availabilities: availabilities.map((av: any) => {
          // Formatear fecha como YYYY-MM-DD para evitar problemas de timezone
          let dateStr = av.date;
          if (av.date instanceof Date) {
            dateStr = av.date.toISOString().split('T')[0];
          } else if (typeof av.date === 'string' && av.date.includes('T')) {
            dateStr = av.date.split('T')[0];
          }
          return {
            id: av.availability_id,
            date: dateStr,
            startTime: av.start_time,
            endTime: av.end_time,
            location: av.location_name || 'Sin sede',
            capacity: av.capacity,
            confirmedAppointments: av.confirmed_appointments,
            cancelledAppointments: av.cancelled_appointments,
            availableSlots: Math.max(0, av.capacity - av.confirmed_appointments),
            occupancyRate: av.capacity > 0 
              ? Math.round((av.confirmed_appointments / av.capacity) * 100) 
              : 0,
            status: av.status,
            isOverbooked: av.confirmed_appointments > av.capacity
          };
        })
      }
    });

  } catch (error: any) {
    console.error('Error al obtener detalles de ocupación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;
