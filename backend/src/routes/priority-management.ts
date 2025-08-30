import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Esquema para gestión de prioridades
const priorityManagementSchema = z.object({
  appointment_id: z.number().int().optional(),
  patient_id: z.number().int(),
  priority_level: z.enum(['Baja', 'Media', 'Alta', 'Urgente', 'Emergencia']),
  reason: z.string(),
  symptoms: z.array(z.string()).optional(),
  pain_level: z.number().int().min(1).max(10).optional(),
  medical_conditions: z.array(z.string()).optional(),
  vital_signs: z.object({
    blood_pressure: z.string().optional(),
    heart_rate: z.number().int().optional(),
    temperature: z.number().optional(),
    oxygen_saturation: z.number().int().optional(),
  }).optional(),
  requires_immediate_attention: z.boolean().default(false),
  preferred_specialty: z.number().int().optional(),
  preferred_doctor: z.number().int().optional(),
  estimated_wait_time: z.number().int().optional(), // minutos
});

// Crear o actualizar prioridad de cita
router.post('/set-priority', requireAuth, async (req: Request, res: Response) => {
  const parsed = priorityManagementSchema.safeParse(req.body);
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
    // Calcular score de prioridad
    const priorityScore = calculatePriorityScore(data);

    // Determinar tiempo de respuesta esperado
    const responseTime = calculateExpectedResponseTime(data.priority_level, priorityScore);

    // Crear registro de prioridad
    const priorityData = {
      appointment_id: data.appointment_id || null,
      patient_id: data.patient_id,
      priority_level: data.priority_level,
      priority_score: priorityScore,
      reason: data.reason,
      symptoms: data.symptoms ? JSON.stringify(data.symptoms) : null,
      pain_level: data.pain_level || null,
      medical_conditions: data.medical_conditions ? JSON.stringify(data.medical_conditions) : null,
      vital_signs: data.vital_signs ? JSON.stringify(data.vital_signs) : null,
      requires_immediate_attention: data.requires_immediate_attention,
      preferred_specialty: data.preferred_specialty || null,
      preferred_doctor: data.preferred_doctor || null,
      expected_response_time: responseTime,
      status: data.requires_immediate_attention ? 'Active' : 'Pending',
      created_by: userId,
      created_at: new Date()
    };

    const [result] = await pool.query('INSERT INTO appointment_priorities SET ?', [priorityData]);
    const priorityId = (result as any).insertId;

    // Si requiere atención inmediata, crear alerta
    if (data.requires_immediate_attention) {
      await createPriorityAlert(priorityId, data, priorityScore);
    }

    // Obtener detalles completos
    const [priorityDetails] = await pool.query(
      `SELECT ap.*,
              p.name as patient_name, p.phone as patient_phone,
              s.name as specialty_name, d.name as doctor_name
       FROM appointment_priorities ap
       JOIN patients p ON p.id = ap.patient_id
       LEFT JOIN specialties s ON s.id = ap.preferred_specialty
       LEFT JOIN doctors d ON d.id = ap.preferred_doctor
       WHERE ap.id = ?`,
      [priorityId]
    );

    return res.json({
      success: true,
      message: 'Prioridad establecida exitosamente',
      data: {
        priority: (priorityDetails as any[])[0],
        recommended_actions: generateRecommendedActions(data, priorityScore),
        escalation_triggers: getEscalationTriggers(data.priority_level)
      }
    });

  } catch (error) {
    console.error('Error estableciendo prioridad:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener prioridades activas
router.get('/active-priorities', requireAuth, async (req: Request, res: Response) => {
  const status = req.query.status || 'Active';
  const limit = Number(req.query.limit) || 50;

  try {
    const [priorities] = await pool.query(
      `SELECT ap.*,
              p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
              s.name as specialty_name, d.name as doctor_name,
              TIMESTAMPDIFF(MINUTE, ap.created_at, NOW()) as minutes_since_creation
       FROM appointment_priorities ap
       JOIN patients p ON p.id = ap.patient_id
       LEFT JOIN specialties s ON s.id = ap.preferred_specialty
       LEFT JOIN doctors d ON d.id = ap.preferred_doctor
       WHERE ap.status = ?
       ORDER BY ap.priority_score DESC, ap.created_at ASC
       LIMIT ?`,
      [status, limit]
    );

    return res.json({
      success: true,
      data: {
        priorities,
        total_active: (priorities as any[]).length,
        urgent_count: (priorities as any[]).filter((p: any) => p.priority_level === 'Urgente' || p.priority_level === 'Emergencia').length
      }
    });

  } catch (error) {
    console.error('Error obteniendo prioridades activas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar estado de prioridad
router.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const userId = (req as any).user?.id;

  try {
    await pool.query(
      `UPDATE appointment_priorities
       SET status = ?, updated_at = NOW(), updated_by = ?, notes = ?
       WHERE id = ?`,
      [status, userId, notes, id]
    );

    return res.json({
      success: true,
      message: 'Estado de prioridad actualizado'
    });

  } catch (error) {
    console.error('Error actualizando estado de prioridad:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener dashboard de prioridades
router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    // Estadísticas generales
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_priorities,
        SUM(CASE WHEN priority_level = 'Emergencia' THEN 1 ELSE 0 END) as emergency_count,
        SUM(CASE WHEN priority_level = 'Urgente' THEN 1 ELSE 0 END) as urgent_count,
        SUM(CASE WHEN priority_level = 'Alta' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN priority_level = 'Media' THEN 1 ELSE 0 END) as medium_count,
        SUM(CASE WHEN priority_level = 'Baja' THEN 1 ELSE 0 END) as low_count,
        AVG(priority_score) as avg_priority_score,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_count
      FROM appointment_priorities
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    // Prioridades que requieren atención inmediata
    const [urgentPriorities] = await pool.query(
      `SELECT ap.*,
              p.name as patient_name, p.phone as patient_phone,
              TIMESTAMPDIFF(MINUTE, ap.created_at, NOW()) as wait_time_minutes
       FROM appointment_priorities ap
       JOIN patients p ON p.id = ap.patient_id
       WHERE ap.status = 'Active'
       AND (ap.priority_level IN ('Urgente', 'Emergencia') OR ap.requires_immediate_attention = true)
       ORDER BY ap.priority_score DESC
       LIMIT 10`
    );

    // Tendencias de prioridades por hora
    const [hourlyTrends] = await pool.query(`
      SELECT
        HOUR(created_at) as hour,
        COUNT(*) as priority_count,
        AVG(priority_score) as avg_score
      FROM appointment_priorities
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `);

    return res.json({
      success: true,
      data: {
        statistics: (stats as any[])[0],
        urgent_priorities: urgentPriorities,
        hourly_trends: hourlyTrends,
        alerts: generateSystemAlerts((stats as any[])[0], urgentPriorities as any[])
      }
    });

  } catch (error) {
    console.error('Error obteniendo dashboard de prioridades:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Función para calcular score de prioridad
function calculatePriorityScore(data: any): number {
  let score = 0;

  // Score base por nivel de prioridad
  const priorityScores = {
    'Baja': 10,
    'Media': 30,
    'Alta': 60,
    'Urgente': 85,
    'Emergencia': 100
  };
  score += (priorityScores as any)[data.priority_level] || 0;

  // Bonus por nivel de dolor
  if (data.pain_level) {
    score += Math.min(data.pain_level * 2, 20);
  }

  // Bonus por atención inmediata requerida
  if (data.requires_immediate_attention) {
    score += 15;
  }

  // Bonus por signos vitales críticos
  if (data.vital_signs) {
    const vitals = data.vital_signs;

    // Frecuencia cardíaca anormal
    if (vitals.heart_rate && (vitals.heart_rate < 50 || vitals.heart_rate > 120)) {
      score += 10;
    }

    // Temperatura elevada
    if (vitals.temperature && vitals.temperature > 38.5) {
      score += 8;
    }

    // Saturación de oxígeno baja
    if (vitals.oxygen_saturation && vitals.oxygen_saturation < 95) {
      score += 12;
    }
  }

  // Bonus por condiciones médicas críticas
  if (data.medical_conditions) {
    const criticalConditions = ['infarto', 'accidente', 'hemorragia', 'dolor torácico', 'dificultad respiratoria'];
    const hasCritical = data.medical_conditions.some((condition: string) =>
      criticalConditions.some(critical => condition.toLowerCase().includes(critical))
    );
    if (hasCritical) {
      score += 20;
    }
  }

  // Bonus por síntomas críticos
  if (data.symptoms) {
    const criticalSymptoms = ['dolor intenso', 'dificultad para respirar', 'pérdida de conciencia', 'convulsiones'];
    const hasCritical = data.symptoms.some((symptom: string) =>
      criticalSymptoms.some(critical => symptom.toLowerCase().includes(critical))
    );
    if (hasCritical) {
      score += 15;
    }
  }

  return Math.min(100, score);
}

// Función para calcular tiempo de respuesta esperado
function calculateExpectedResponseTime(priorityLevel: string, priorityScore: number): number {
  const baseTimes = {
    'Baja': 1440,      // 24 horas
    'Media': 480,      // 8 horas
    'Alta': 120,       // 2 horas
    'Urgente': 30,     // 30 minutos
    'Emergencia': 5    // 5 minutos
  };

  const baseTime = (baseTimes as any)[priorityLevel] || 1440;

  // Ajustar por score de prioridad
  const adjustmentFactor = 1 - (priorityScore / 100) * 0.5; // Máximo 50% de reducción
  const adjustedTime = baseTime * adjustmentFactor;

  return Math.max(5, Math.round(adjustedTime));
}

// Función para crear alerta de prioridad
async function createPriorityAlert(priorityId: number, data: any, priorityScore: number): Promise<void> {
  const alertData = {
    priority_id: priorityId,
    alert_type: data.priority_level === 'Emergencia' ? 'emergency' : 'urgent',
    message: `Prioridad ${data.priority_level}: ${data.reason}`,
    priority_score: priorityScore,
    status: 'Active',
    created_at: new Date()
  };

  await pool.query('INSERT INTO priority_alerts SET ?', [alertData]);

  // Aquí se podría integrar con sistema de notificaciones push, SMS, etc.
}

// Función para generar acciones recomendadas
function generateRecommendedActions(data: any, priorityScore: number): any[] {
  const actions = [];

  if (priorityScore >= 90) {
    actions.push({
      type: 'immediate_attention',
      priority: 'critical',
      message: 'Atención inmediata requerida',
      action: 'notify_emergency_team'
    });
  } else if (priorityScore >= 70) {
    actions.push({
      type: 'urgent_consultation',
      priority: 'high',
      message: 'Consulta urgente necesaria',
      action: 'schedule_immediate_appointment'
    });
  }

  if (data.preferred_specialty) {
    actions.push({
      type: 'specialty_assignment',
      priority: 'medium',
      message: `Asignar especialista en ${data.preferred_specialty}`,
      action: 'assign_specialist'
    });
  }

  if (data.symptoms && data.symptoms.length > 0) {
    actions.push({
      type: 'symptom_monitoring',
      priority: 'medium',
      message: 'Monitorear síntomas críticos',
      action: 'setup_monitoring'
    });
  }

  return actions;
}

// Función para obtener triggers de escalada
function getEscalationTriggers(priorityLevel: string): any[] {
  const triggers = [];

  const escalationTimes = {
    'Baja': 1440,      // 24 horas
    'Media': 480,      // 8 horas
    'Alta': 120,       // 2 horas
    'Urgente': 60,     // 1 hora
    'Emergencia': 15   // 15 minutos
  };

  const timeLimit = (escalationTimes as any)[priorityLevel] || 1440;

  triggers.push({
    type: 'time_limit',
    condition: `wait_time > ${timeLimit} minutes`,
    action: 'escalate_priority',
    message: `Escalar prioridad si espera más de ${timeLimit} minutos`
  });

  if (priorityLevel === 'Urgente' || priorityLevel === 'Emergencia') {
    triggers.push({
      type: 'symptom_worsening',
      condition: 'symptoms_worsen',
      action: 'immediate_intervention',
      message: 'Intervención inmediata si síntomas empeoran'
    });
  }

  return triggers;
}

// Función para generar alertas del sistema
function generateSystemAlerts(stats: any, urgentPriorities: any[]): any[] {
  const alerts = [];

  if (stats.emergency_count > 0) {
    alerts.push({
      type: 'emergency_alert',
      severity: 'critical',
      message: `${stats.emergency_count} caso(s) de emergencia activa(s)`,
      action_required: true
    });
  }

  if (stats.urgent_count > 3) {
    alerts.push({
      type: 'high_urgent_load',
      severity: 'high',
      message: `${stats.urgent_count} casos urgentes activos`,
      action_required: true
    });
  }

  const avgWaitTime = urgentPriorities.reduce((sum, p) => sum + p.wait_time_minutes, 0) / urgentPriorities.length;
  if (avgWaitTime > 30) {
    alerts.push({
      type: 'long_wait_times',
      severity: 'medium',
      message: `Tiempo promedio de espera: ${Math.round(avgWaitTime)} minutos`,
      action_required: true
    });
  }

  return alerts;
}

export default router;
