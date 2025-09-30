// ==============================================
// ENDPOINTS DE EXPORTACIÓN Y REPORTES
// ==============================================

import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ==============================================
// EXPORTACIÓN DE DATOS
// ==============================================

// POST /api/export/patients - Exportar datos de pacientes
router.post('/patients', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      format = 'json',
      filters = {},
      fields = [],
      date_range,
      include_statistics = false
    } = req.body;

    // Construir query base
    let query = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.document_number,
        p.birth_date,
        p.phone,
        p.email,
        p.address,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        bg.name as blood_group,
        eps.name as insurance_eps,
        m.name as municipality,
        z.name as zone,
        p.created_at,
        p.updated_at
      FROM patients p
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN zones z ON p.zone_id = z.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // Aplicar filtros
    if (filters.municipality_id) {
      conditions.push('p.municipality_id = ?');
      params.push(filters.municipality_id);
    }

    if (filters.blood_group_id) {
      conditions.push('p.blood_group_id = ?');
      params.push(filters.blood_group_id);
    }

    if (filters.age_min) {
      conditions.push('TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) >= ?');
      params.push(filters.age_min);
    }

    if (filters.age_max) {
      conditions.push('TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) <= ?');
      params.push(filters.age_max);
    }

    if (date_range?.from) {
      conditions.push('DATE(p.created_at) >= ?');
      params.push(date_range.from);
    }

    if (date_range?.to) {
      conditions.push('DATE(p.created_at) <= ?');
      params.push(date_range.to);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY p.created_at DESC LIMIT 5000';

    const [patients] = await pool.query(query, params);

    // Obtener estadísticas si se solicitan
    let statistics = null;
    if (include_statistics) {
      const [statsResult] = await pool.query(`
        SELECT 
          COUNT(*) as total_patients,
          COUNT(CASE WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) < 18 THEN 1 END) as minors,
          COUNT(CASE WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) >= 65 THEN 1 END) as seniors,
          COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as with_phone,
          COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email
        FROM patients p
        ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      `, params);
      
      statistics = (statsResult as any[])[0];
    }

    // Preparar respuesta según formato
    if (format === 'csv') {
      const csvHeaders = [
        'ID', 'Nombre', 'Apellido', 'Documento', 'Fecha Nacimiento', 
        'Teléfono', 'Email', 'Dirección', 'Edad', 'Grupo Sanguíneo',
        'EPS', 'Municipio', 'Zona', 'Fecha Creación'
      ];

      let csvContent = csvHeaders.join(',') + '\n';
      
      (patients as any[]).forEach(patient => {
        const row = [
          patient.id,
          `"${patient.first_name || ''}"`,
          `"${patient.last_name || ''}"`,
          `"${patient.document_number || ''}"`,
          patient.birth_date,
          `"${patient.phone || ''}"`,
          `"${patient.email || ''}"`,
          `"${patient.address || ''}"`,
          patient.age,
          `"${patient.blood_group || ''}"`,
          `"${patient.insurance_eps || ''}"`,
          `"${patient.municipality || ''}"`,
          `"${patient.zone || ''}"`,
          patient.created_at
        ];
        csvContent += row.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="pacientes_export.csv"');
      res.send(csvContent);
      return;
    }

    // Respuesta JSON por defecto
    res.json({
      success: true,
      data: {
        patients,
        statistics,
        export_info: {
          total_records: (patients as any[]).length,
          format,
          generated_at: new Date().toISOString(),
          filters_applied: filters
        }
      }
    });

  } catch (error) {
    console.error('Error exporting patients:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar datos de pacientes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/export/calls - Exportar datos de llamadas
router.post('/calls', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      format = 'json',
      date_range,
      agent_name,
      status,
      priority,
      include_summary = false
    } = req.body;

    const conditions: string[] = [];
    const params: any[] = [];

    if (date_range?.from) {
      conditions.push('DATE(start_time) >= ?');
      params.push(date_range.from);
    }

    if (date_range?.to) {
      conditions.push('DATE(start_time) <= ?');
      params.push(date_range.to);
    }

    if (agent_name) {
      conditions.push('agent_name LIKE ?');
      params.push(`%${agent_name}%`);
    }

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(`status IN (${status.map(() => '?').join(',')})`);
        params.push(...status);
      } else {
        conditions.push('status = ?');
        params.push(status);
      }
    }

    if (priority) {
      conditions.push('priority = ?');
      params.push(priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [calls] = await pool.query(`
      SELECT 
        id,
        conversation_id,
        patient_name,
        patient_phone,
        agent_name,
        call_type,
        status,
        priority,
        start_time,
        end_time,
        duration,
        call_notes,
        created_at
      FROM calls 
      ${whereClause}
      ORDER BY start_time DESC
      LIMIT 10000
    `, params);

    // Obtener resumen si se solicita
    let summary = null;
    if (include_summary) {
      const [summaryResult] = await pool.query(`
        SELECT 
          COUNT(*) as total_calls,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
          COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_calls,
          AVG(CASE WHEN duration > 0 THEN duration END) as avg_duration,
          COUNT(DISTINCT agent_name) as unique_agents,
          COUNT(DISTINCT patient_phone) as unique_patients
        FROM calls 
        ${whereClause}
      `, params);
      
      summary = (summaryResult as any[])[0];
    }

    if (format === 'csv') {
      const csvHeaders = [
        'ID', 'Conversación ID', 'Paciente', 'Teléfono', 'Agente',
        'Tipo Llamada', 'Estado', 'Prioridad', 'Inicio', 'Fin',
        'Duración (min)', 'Notas', 'Fecha Creación'
      ];

      let csvContent = csvHeaders.join(',') + '\n';
      
      (calls as any[]).forEach(call => {
        const row = [
          call.id,
          `"${call.conversation_id || ''}"`,
          `"${call.patient_name || ''}"`,
          `"${call.patient_phone || ''}"`,
          `"${call.agent_name || ''}"`,
          `"${call.call_type || ''}"`,
          `"${call.status || ''}"`,
          `"${call.priority || ''}"`,
          call.start_time,
          call.end_time || '',
          call.duration || 0,
          `"${(call.call_notes || '').replace(/"/g, '""')}"`,
          call.created_at
        ];
        csvContent += row.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="llamadas_export.csv"');
      res.send(csvContent);
      return;
    }

    res.json({
      success: true,
      data: {
        calls,
        summary,
        export_info: {
          total_records: (calls as any[]).length,
          format,
          generated_at: new Date().toISOString(),
          date_range
        }
      }
    });

  } catch (error) {
    console.error('Error exporting calls:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar datos de llamadas',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// REPORTES AVANZADOS
// ==============================================

// GET /api/export/reports/daily-summary - Reporte diario resumido
router.get('/reports/daily-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];

    // Estadísticas de llamadas del día
    const [callStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
        COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_calls,
        AVG(CASE WHEN duration > 0 THEN duration END) as avg_duration,
        SUM(CASE WHEN duration > 0 THEN duration END) as total_duration,
        COUNT(DISTINCT agent_name) as active_agents
      FROM calls 
      WHERE DATE(start_time) = ?
    `, [date]);

    // Estadísticas de citas del día
    const [appointmentStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'Completada' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN status = 'Cancelada' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN status = 'Programada' THEN 1 END) as pending_appointments
      FROM appointments 
      WHERE DATE(scheduled_at) = ?
    `, [date]);

    // Pacientes nuevos del día
    const [patientStats] = await pool.query(`
      SELECT 
        COUNT(*) as new_patients,
        COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as patients_with_phone
      FROM patients 
      WHERE DATE(created_at) = ?
    `, [date]);

    // Top agentes del día
    const [topAgents] = await pool.query(`
      SELECT 
        agent_name,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls,
        AVG(CASE WHEN duration > 0 THEN duration END) as avg_duration,
        ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
      FROM calls 
      WHERE DATE(start_time) = ? AND agent_name IS NOT NULL
      GROUP BY agent_name
      ORDER BY successful_calls DESC, success_rate DESC
      LIMIT 10
    `, [date]);

    // Alertas y problemas del día
    const [alerts] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_calls,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_calls,
        COUNT(CASE WHEN status = 'failed' AND priority IN ('high', 'critical') THEN 1 END) as failed_priority_calls
      FROM calls 
      WHERE DATE(start_time) = ?
    `, [date]);

    const dailySummary = {
      date,
      calls: (callStats as any[])[0],
      appointments: (appointmentStats as any[])[0],
      patients: (patientStats as any[])[0],
      top_agents: topAgents,
      alerts: (alerts as any[])[0],
      generated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: dailySummary
    });

  } catch (error) {
    console.error('Error generating daily summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte diario',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/export/reports/agent-performance - Reporte de rendimiento de agentes
router.get('/reports/agent-performance', requireAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const agent_name = req.query.agent_name as string;

    const conditions: string[] = [`start_time >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`];
    const params: any[] = [];

    if (agent_name) {
      conditions.push('agent_name = ?');
      params.push(agent_name);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Rendimiento general por agente
    const [agentPerformance] = await pool.query(`
      SELECT 
        agent_name,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
        COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_calls,
        AVG(CASE WHEN duration > 0 THEN duration END) as avg_call_duration,
        SUM(CASE WHEN duration > 0 THEN duration END) as total_call_time,
        ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate,
        COUNT(DISTINCT DATE(start_time)) as active_days,
        COUNT(DISTINCT patient_phone) as unique_patients_contacted
      FROM calls 
      ${whereClause}
      GROUP BY agent_name
      ORDER BY successful_calls DESC, success_rate DESC
    `, params);

    // Rendimiento diario del período
    const [dailyPerformance] = await pool.query(`
      SELECT 
        DATE(start_time) as call_date,
        agent_name,
        COUNT(*) as daily_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as daily_successful,
        AVG(CASE WHEN duration > 0 THEN duration END) as daily_avg_duration
      FROM calls 
      ${whereClause}
      GROUP BY DATE(start_time), agent_name
      ORDER BY call_date DESC, daily_successful DESC
    `, params);

    // Tipos de llamadas por agente
    const [callTypes] = await pool.query(`
      SELECT 
        agent_name,
        call_type,
        COUNT(*) as type_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY agent_name), 2) as type_percentage
      FROM calls 
      ${whereClause}
      GROUP BY agent_name, call_type
      ORDER BY agent_name, type_count DESC
    `, params);

    res.json({
      success: true,
      data: {
        period_days: days,
        agent_name: agent_name || 'Todos los agentes',
        overall_performance: agentPerformance,
        daily_performance: dailyPerformance,
        call_types_distribution: callTypes,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating agent performance report:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte de rendimiento de agentes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/export/reports/patient-engagement - Reporte de engagement de pacientes
router.get('/reports/patient-engagement', requireAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    // Pacientes más contactados
    const [topContactedPatients] = await pool.query(`
      SELECT 
        patient_phone,
        patient_name,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
        MAX(start_time) as last_contact,
        MIN(start_time) as first_contact,
        ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
      FROM calls 
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY patient_phone, patient_name
      HAVING COUNT(*) >= 2
      ORDER BY total_calls DESC, success_rate DESC
      LIMIT 20
    `, [days]);

    // Distribución de respuesta de pacientes
    const [responseDistribution] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM calls 
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY status
      ORDER BY count DESC
    `, [days]);

    // Patrones de horarios de respuesta
    const [timePatterns] = await pool.query(`
      SELECT 
        HOUR(start_time) as hour_of_day,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls,
        ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
      FROM calls 
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY HOUR(start_time)
      ORDER BY hour_of_day
    `, [days]);

    // Pacientes difíciles de contactar
    const [difficultPatients] = await pool.query(`
      SELECT 
        patient_phone,
        patient_name,
        COUNT(*) as attempt_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_attempts,
        COUNT(CASE WHEN status = 'no_answer' THEN 1 END) as no_answer_attempts,
        MAX(start_time) as last_attempt,
        ROUND(COUNT(CASE WHEN status IN ('failed', 'no_answer') THEN 1 END) * 100.0 / COUNT(*), 2) as failure_rate
      FROM calls 
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY patient_phone, patient_name
      HAVING COUNT(*) >= 3 AND failure_rate >= 70
      ORDER BY failure_rate DESC, attempt_count DESC
      LIMIT 15
    `, [days]);

    res.json({
      success: true,
      data: {
        period_days: days,
        top_contacted_patients: topContactedPatients,
        response_distribution: responseDistribution,
        hourly_patterns: timePatterns,
        difficult_to_contact: difficultPatients,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating patient engagement report:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte de engagement de pacientes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;