// ==============================================
// SISTEMA DE NOTIFICACIONES Y ALERTAS
// ==============================================

import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ==============================================
// GESTIÓN DE NOTIFICACIONES
// ==============================================

// GET /api/notifications - Obtener notificaciones del usuario
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unread_only = req.query.unread_only === 'true';
    const type = req.query.type as string;

    const offset = (page - 1) * limit;
    const conditions: string[] = ['user_id = ?'];
    const params: any[] = [userId];

    if (unread_only) {
      conditions.push('is_read = FALSE');
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [notifications] = await pool.query(`
      SELECT 
        id,
        type,
        title,
        message,
        data,
        priority,
        is_read,
        created_at,
        read_at,
        expires_at
      FROM notifications 
      ${whereClause}
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Contar total y no leídas
    const [countResult] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread_count
      FROM notifications 
      WHERE user_id = ?
    `, [userId]);

    const { total, unread_count } = (countResult as any[])[0] || { total: 0, unread_count: 0 };

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        summary: {
          total_notifications: total,
          unread_count
        }
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/notifications - Crear nueva notificación
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      type,
      title,
      message,
      data = {},
      priority = 'medium',
      expires_at
    } = req.body;

    if (!user_id || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'user_id, type, title y message son requeridos'
      });
    }

    const [result] = await pool.query(`
      INSERT INTO notifications (
        user_id, type, title, message, data, priority, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [user_id, type, title, message, JSON.stringify(data), priority, expires_at]);

    const notificationId = (result as any).insertId;

    res.status(201).json({
      success: true,
      data: { id: notificationId },
      message: 'Notificación creada exitosamente'
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear notificación',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notifications/:id/read - Marcar como leída
router.put('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
    const userId = (req as any).user?.id;

    const [result] = await pool.query(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = NOW() 
      WHERE id = ? AND user_id = ?
    `, [notificationId, userId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar notificación como leída',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notifications/read-all - Marcar todas como leídas
router.put('/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const [result] = await pool.query(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = NOW() 
      WHERE user_id = ? AND is_read = FALSE
    `, [userId]);

    res.json({
      success: true,
      data: { marked_count: (result as any).affectedRows },
      message: 'Todas las notificaciones marcadas como leídas'
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar todas las notificaciones como leídas',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/notifications/:id - Eliminar notificación
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
    const userId = (req as any).user?.id;

    const [result] = await pool.query(`
      DELETE FROM notifications 
      WHERE id = ? AND user_id = ?
    `, [notificationId, userId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Notificación eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar notificación',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// SISTEMA DE ALERTAS MÉDICAS
// ==============================================

// GET /api/notifications/alerts/medical - Alertas médicas críticas
router.get('/alerts/medical', requireAuth, async (req: Request, res: Response) => {
  try {
    // Citas perdidas en las últimas 24 horas
    const [missedAppointments] = await pool.query(`
      SELECT 
        a.id,
        a.scheduled_at,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        p.phone,
        d.name as doctor_name,
        s.name as specialty_name,
        'missed_appointment' as alert_type,
        'high' as priority
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      WHERE 
        a.status = 'Programada' 
        AND a.scheduled_at < NOW() 
        AND a.scheduled_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY a.scheduled_at DESC
      LIMIT 20
    `);

    // Pacientes con citas próximas sin confirmación
    const [unconfirmedAppointments] = await pool.query(`
      SELECT 
        a.id,
        a.scheduled_at,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        p.phone,
        d.name as doctor_name,
        'unconfirmed_appointment' as alert_type,
        'medium' as priority
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE 
        a.status = 'Programada' 
        AND a.scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)
        AND (a.confirmed_at IS NULL OR a.confirmed_at = '0000-00-00 00:00:00')
      ORDER BY a.scheduled_at ASC
      LIMIT 20
    `);

    // Llamadas fallidas recientes que requieren seguimiento
    const [failedCalls] = await pool.query(`
      SELECT 
        id,
        conversation_id,
        patient_name,
        patient_phone,
        agent_name,
        start_time,
        'failed_call' as alert_type,
        priority
      FROM calls 
      WHERE 
        status IN ('failed', 'abandoned', 'error')
        AND priority IN ('high', 'critical')
        AND start_time >= DATE_SUB(NOW(), INTERVAL 4 HOUR)
      ORDER BY start_time DESC, priority ASC
      LIMIT 15
    `);

    // Pacientes con múltiples intentos de llamada fallidos
    const [problematicPatients] = await pool.query(`
      SELECT 
        patient_phone,
        patient_name,
        COUNT(*) as failed_attempts,
        MAX(start_time) as last_attempt,
        'problematic_patient' as alert_type,
        CASE 
          WHEN COUNT(*) >= 5 THEN 'critical'
          WHEN COUNT(*) >= 3 THEN 'high'
          ELSE 'medium'
        END as priority
      FROM calls 
      WHERE 
        status IN ('failed', 'abandoned', 'no_answer')
        AND start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY patient_phone, patient_name
      HAVING COUNT(*) >= 2
      ORDER BY failed_attempts DESC, last_attempt DESC
      LIMIT 10
    `);

    const alerts = {
      missed_appointments: missedAppointments,
      unconfirmed_appointments: unconfirmedAppointments,
      failed_calls: failedCalls,
      problematic_patients: problematicPatients,
      summary: {
        total_alerts: (missedAppointments as any[]).length + 
                     (unconfirmedAppointments as any[]).length + 
                     (failedCalls as any[]).length + 
                     (problematicPatients as any[]).length,
        critical_count: (failedCalls as any[]).filter(c => c.priority === 'critical').length +
                       (problematicPatients as any[]).filter(p => p.priority === 'critical').length,
        high_priority_count: (missedAppointments as any[]).length +
                            (failedCalls as any[]).filter(c => c.priority === 'high').length +
                            (problematicPatients as any[]).filter(p => p.priority === 'high').length
      }
    };

    res.json({
      success: true,
      data: alerts,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching medical alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener alertas médicas',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// PREFERENCIAS DE NOTIFICACIONES
// ==============================================

// GET /api/notifications/preferences - Obtener preferencias de notificaciones
router.get('/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const [preferences] = await pool.query(`
      SELECT 
        notification_type,
        enabled,
        delivery_method,
        frequency,
        quiet_hours_start,
        quiet_hours_end
      FROM notification_preferences 
      WHERE user_id = ?
    `, [userId]);

    // Si no hay preferencias, devolver defaults
    if ((preferences as any[]).length === 0) {
      const defaultPreferences = [
        { notification_type: 'appointment_reminder', enabled: true, delivery_method: 'in_app', frequency: 'immediate' },
        { notification_type: 'missed_appointment', enabled: true, delivery_method: 'in_app', frequency: 'immediate' },
        { notification_type: 'call_failed', enabled: true, delivery_method: 'in_app', frequency: 'immediate' },
        { notification_type: 'system_alert', enabled: true, delivery_method: 'in_app', frequency: 'immediate' },
        { notification_type: 'daily_summary', enabled: false, delivery_method: 'email', frequency: 'daily' }
      ];

      res.json({
        success: true,
        data: {
          preferences: defaultPreferences,
          quiet_hours: { start: '22:00', end: '07:00' }
        }
      });
      return;
    }

    res.json({
      success: true,
      data: { preferences }
    });

  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener preferencias de notificaciones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notifications/preferences - Actualizar preferencias
router.put('/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { preferences, quiet_hours } = req.body;

    if (!Array.isArray(preferences)) {
      return res.status(400).json({
        success: false,
        message: 'Preferences debe ser un array'
      });
    }

    // Actualizar o insertar preferencias
    for (const pref of preferences) {
      await pool.query(`
        INSERT INTO notification_preferences (
          user_id, notification_type, enabled, delivery_method, frequency,
          quiet_hours_start, quiet_hours_end, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          enabled = VALUES(enabled),
          delivery_method = VALUES(delivery_method),
          frequency = VALUES(frequency),
          quiet_hours_start = VALUES(quiet_hours_start),
          quiet_hours_end = VALUES(quiet_hours_end),
          updated_at = NOW()
      `, [
        userId,
        pref.notification_type,
        pref.enabled,
        pref.delivery_method || 'in_app',
        pref.frequency || 'immediate',
        quiet_hours?.start || '22:00',
        quiet_hours?.end || '07:00'
      ]);
    }

    res.json({
      success: true,
      message: 'Preferencias actualizadas exitosamente'
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar preferencias de notificaciones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// WEBHOOK PARA NOTIFICACIONES EXTERNAS
// ==============================================

// POST /api/notifications/webhook - Recibir notificaciones externas
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const {
      source,
      event_type,
      user_id,
      data,
      priority = 'medium',
      webhook_secret
    } = req.body;

    // Validar webhook secret (en producción usar variable de entorno)
    const expectedSecret = process.env.WEBHOOK_SECRET || 'biosanar_webhook_secret';
    if (webhook_secret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        message: 'Webhook secret inválido'
      });
    }

    // Procesar diferentes tipos de eventos
    let title = '';
    let message = '';

    switch (event_type) {
      case 'call_incoming':
        title = 'Llamada entrante';
        message = `Nueva llamada de ${data.caller_phone}`;
        break;
      case 'call_completed':
        title = 'Llamada completada';
        message = `Llamada con ${data.patient_name} finalizada`;
        break;
      case 'appointment_created':
        title = 'Nueva cita programada';
        message = `Cita creada para ${data.patient_name}`;
        break;
      case 'system_maintenance':
        title = 'Mantenimiento del sistema';
        message = data.message;
        break;
      default:
        title = 'Notificación del sistema';
        message = data.message || 'Evento recibido';
    }

    // Crear notificación
    await pool.query(`
      INSERT INTO notifications (
        user_id, type, title, message, data, priority, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [user_id, event_type, title, message, JSON.stringify(data), priority]);

    res.json({
      success: true,
      message: 'Notificación procesada exitosamente'
    });

  } catch (error) {
    console.error('Error processing webhook notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar notificación webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;