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
      web: 0,
      phone: 0,
      system: 0
    };

    sourceStats.forEach((stat: any) => {
      switch(stat.appointment_source) {
        case 'Web':
          sourceData.web = stat.count;
          break;
        case 'Llamada':
          sourceData.phone = stat.count;
          break;
        case 'Sistema_Inteligente':
          sourceData.system = stat.count;
          break;
        default:
          sourceData.system += stat.count; // Otros tipos van a sistema
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
      web: Math.floor(stat.total * 0.4),
      phone: Math.floor(stat.total * 0.5),
      system: Math.floor(stat.total * 0.1),
      total: stat.total
    }));

    // 4. Estadísticas de ocupación por doctor y especialidad (desde hoy en adelante, incluyendo agendas llenas)
    const [occupancyStats] = await pool.query<any[]>(`
      SELECT 
        d.name as doctor,
        s.name as specialty,
        SUM(av.capacity) as total_slots,
        SUM(av.booked_slots) as booked_slots,
        COUNT(av.id) as total_availabilities
      FROM availabilities av
      JOIN doctors d ON av.doctor_id = d.id
      JOIN specialties s ON av.specialty_id = s.id
      WHERE av.date >= CURDATE()
        AND av.status IN ('Activa', 'Completa')
        AND d.active = 1
      GROUP BY av.doctor_id, av.specialty_id, d.name, s.name
      HAVING COUNT(av.id) > 0 AND SUM(av.capacity) > 0
      ORDER BY SUM(av.booked_slots) DESC
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

export default router;
