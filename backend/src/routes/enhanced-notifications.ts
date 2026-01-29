import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { formatDateColombia, formatTimeColombia, COLOMBIA_TIMEZONE } from '../utils/dateUtils';

const router = Router();

// Esquema para configuración de notificaciones
const notificationConfigSchema = z.object({
  appointment_id: z.number().int(),
  notification_types: z.array(z.enum(['email', 'sms', 'push', 'whatsapp'])),
  reminder_times: z.array(z.number().int()), // minutos antes de la cita
  custom_message: z.string().optional(),
  include_medical_info: z.boolean().default(false),
  priority_level: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

// Programar notificaciones para una cita
router.post('/schedule', requireAuth, async (req: Request, res: Response) => {
  const parsed = notificationConfigSchema.safeParse(req.body);
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
    // Obtener detalles de la cita
    const [appointmentRows] = await pool.query(
      `SELECT a.*, p.name as patient_name, p.phone, p.email,
              d.name as doctor_name, s.name as specialty_name,
              l.name as location_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       WHERE a.id = ?`,
      [data.appointment_id]
    );

    if (!Array.isArray(appointmentRows) || appointmentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    const appointment = appointmentRows[0];

    // Crear configuración de notificaciones
    const notificationConfig = {
      appointment_id: data.appointment_id,
      patient_id: (appointment as any).patient_id,
      notification_types: JSON.stringify(data.notification_types),
      reminder_times: JSON.stringify(data.reminder_times),
      custom_message: data.custom_message,
      include_medical_info: data.include_medical_info,
      priority_level: data.priority_level,
      status: 'Active',
      created_by: userId,
      created_at: new Date()
    };

    const [result] = await pool.query(
      'INSERT INTO appointment_notifications SET ?',
      [notificationConfig]
    );

    const configId = (result as any).insertId;

    // Programar notificaciones individuales
    const scheduledNotifications = await scheduleNotifications(
      configId,
      appointment,
      data
    );

    return res.json({
      success: true,
      message: 'Notificaciones programadas exitosamente',
      data: {
        config_id: configId,
        scheduled_notifications: scheduledNotifications.length,
        next_notification: scheduledNotifications[0]?.scheduled_time
      }
    });

  } catch (error) {
    console.error('Error programando notificaciones:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener notificaciones pendientes
router.get('/pending', requireAuth, async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 100;

  try {
    const [notifications] = await pool.query(
      `SELECT an.*,
              a.scheduled_at, a.status as appointment_status,
              p.name as patient_name, p.phone, p.email,
              d.name as doctor_name
       FROM appointment_notification_schedule ans
       JOIN appointment_notifications an ON an.id = ans.config_id
       JOIN appointments a ON a.id = an.appointment_id
       JOIN patients p ON p.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       WHERE ans.status = 'Pending'
       AND ans.scheduled_time <= NOW()
       ORDER BY ans.scheduled_time ASC
       LIMIT ?`,
      [limit]
    );

    return res.json({
      success: true,
      data: {
        notifications,
        total_pending: (notifications as any[]).length
      }
    });

  } catch (error: any) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.json({ success: true, data: { notifications: [], total_pending: 0 } });
    }
    console.error('Error obteniendo notificaciones pendientes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Procesar notificación (marcar como enviada)
router.patch('/:id/process', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, error_message } = req.body;
  const userId = (req as any).user?.id;

  try {
    await pool.query(
      `UPDATE appointment_notification_schedule
       SET status = ?, processed_at = NOW(), processed_by = ?, error_message = ?
       WHERE id = ?`,
      [status, userId, error_message, id]
    );

    return res.json({
      success: true,
      message: 'Notificación procesada'
    });

  } catch (error) {
    console.error('Error procesando notificación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener estadísticas de notificaciones
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 30;
  try {
    const [overallRows]: any = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END) AS sent
       FROM appointment_notification_schedule
       WHERE scheduled_time >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    const [byTypeRows]: any = await pool.query(
      `SELECT notification_type,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END) AS sent,
              ROUND((SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) AS success_rate
       FROM appointment_notification_schedule
       WHERE scheduled_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY notification_type`,
      [days]
    );
    const overall = Array.isArray(overallRows) && overallRows[0] ? overallRows[0] : { total: 0, sent: 0 };
    return res.json({ success: true, data: { overall_stats: overall, success_rates_by_type: byTypeRows, period_days: days } });
  } catch (error: any) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.json({ success: true, data: { overall_stats: { total: 0, sent: 0 }, success_rates_by_type: [], period_days: days } });
    }
    console.error('Error obteniendo estadísticas:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Plantillas de notificaciones
router.get('/templates', requireAuth, async (req: Request, res: Response) => {
  const type = req.query.type as string;

  try {
    const templates = getNotificationTemplates(type);

    return res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('Error obteniendo plantillas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Función para programar notificaciones
async function scheduleNotifications(
  configId: number,
  appointment: any,
  config: any
): Promise<any[]> {
  const scheduledNotifications = [];
  const reminderTimes = config.reminder_times || [1440, 60]; // Por defecto: 24h y 1h antes

  for (const reminderTime of reminderTimes) {
    for (const notificationType of config.notification_types) {
      const scheduledTime = new Date(appointment.scheduled_at);
      scheduledTime.setMinutes(scheduledTime.getMinutes() - reminderTime);

      // Solo programar si la hora programada es futura
      if (scheduledTime > new Date()) {
        const notificationData = {
          config_id: configId,
          notification_type: notificationType,
          scheduled_time: scheduledTime,
          status: 'Pending',
          retry_count: 0,
          created_at: new Date()
        };

        const [result] = await pool.query(
          'INSERT INTO appointment_notification_schedule SET ?',
          [notificationData]
        );

        scheduledNotifications.push({
          id: (result as any).insertId,
          type: notificationType,
          scheduled_time: scheduledTime,
          minutes_before: reminderTime
        });
      }
    }
  }

  return scheduledNotifications;
}

// Función para obtener plantillas de notificación
function getNotificationTemplates(type?: string): any[] {
  const templates = {
    reminder: [
      {
        id: 'basic_reminder',
        name: 'Recordatorio Básico',
        subject: 'Recordatorio de Cita Médica',
        message: `Estimado/a {patient_name},

Le recordamos que tiene una cita programada para el {appointment_date} a las {appointment_time}.

Detalles de la cita:
- Especialidad: {specialty_name}
- Doctor: {doctor_name}
- Ubicación: {location_name}

Por favor llegue 15 minutos antes de la hora programada.

Atentamente,
Equipo Médico`
      },
      {
        id: 'detailed_reminder',
        name: 'Recordatorio Detallado',
        subject: 'Detalles de su Cita Médica - {appointment_date}',
        message: `Estimado/a {patient_name},

Información completa de su cita:

📅 Fecha: {appointment_date}
🕐 Hora: {appointment_time}
👨‍⚕️ Doctor: {doctor_name}
🏥 Especialidad: {specialty_name}
📍 Ubicación: {location_name}

Preparación para la cita:
- Por favor llegue 15 minutos antes
- Traiga identificación y carnet de seguro
- Si tiene exámenes previos, por favor traigalos

Si necesita cancelar o reprogramar, por favor contactenos con al menos 24 horas de anticipación.

Atentamente,
Equipo Médico`
      }
    ],
    confirmation: [
      {
        id: 'appointment_confirmed',
        name: 'Confirmación de Cita',
        subject: 'Cita Confirmada - {appointment_date}',
        message: `¡Excelente! Su cita ha sido confirmada.

Estimado/a {patient_name},

Su cita médica ha sido confirmada exitosamente:

📅 Fecha: {appointment_date}
🕐 Hora: {appointment_time}
👨‍⚕️ Doctor: {doctor_name}
🏥 Especialidad: {specialty_name}
📍 Ubicación: {location_name}

Le esperamos puntualmente.

Atentamente,
Equipo Médico`
      }
    ],
    cancellation: [
      {
        id: 'appointment_cancelled',
        name: 'Cancelación de Cita',
        subject: 'Cita Cancelada',
        message: `Estimado/a {patient_name},

Lamentamos informarle que su cita programada para el {appointment_date} a las {appointment_time} con el Dr. {doctor_name} ha sido cancelada.

Si desea reprogramar, por favor contactenos.

Atentamente,
Equipo Médico`
      }
    ],
    urgent: [
      {
        id: 'urgent_reminder',
        name: 'Recordatorio Urgente',
        subject: '⚠️ RECORDATORIO URGENTE - Cita Médica Hoy',
        message: `⚠️ RECORDATORIO URGENTE

Estimado/a {patient_name},

Su cita médica es HOY:

📅 Fecha: {appointment_date}
🕐 Hora: {appointment_time}
👨‍⚕️ Doctor: {doctor_name}
🏥 Especialidad: {specialty_name}
📍 Ubicación: {location_name}

Por favor confirme su asistencia respondiendo a este mensaje.

Atentamente,
Equipo Médico`
      }
    ]
  };

  if (type && (templates as any)[type]) {
    return (templates as any)[type];
  }

  return Object.values(templates).flat();
}

// Función para generar contenido de notificación personalizado
function generateNotificationContent(
  template: any,
  appointment: any,
  notificationType: string
): string {
  let content = template.message;

  // Reemplazar variables (usando timezone Colombia UTC-5)
  const replacements = {
    patient_name: appointment.patient_name,
    appointment_date: formatDateColombia(appointment.scheduled_at),
    appointment_time: formatTimeColombia(appointment.scheduled_at),
    doctor_name: appointment.doctor_name,
    specialty_name: appointment.specialty_name,
    location_name: appointment.location_name
  };

  Object.entries(replacements).forEach(([key, value]) => {
    content = content.replace(new RegExp(`{${key}}`, 'g'), value);
  });

  // Adaptar formato según tipo de notificación
  if (notificationType === 'sms') {
    // Limitar longitud para SMS
    content = content.length > 160 ? content.substring(0, 157) + '...' : content;
  } else if (notificationType === 'whatsapp') {
    // Formato amigable para WhatsApp
    content = content.replace(/📅/g, '📅').replace(/🕐/g, '🕐').replace(/👨‍⚕️/g, '👨‍⚕️');
  }

  return content;
}

// Función para determinar el canal de notificación más efectivo
function determineBestNotificationChannel(appointment: any, priority: string): string[] {
  const channels = [];

  // Siempre incluir email si está disponible
  if (appointment.email) {
    channels.push('email');
  }

  // Para prioridades altas, incluir SMS
  if (priority === 'urgent' || priority === 'high') {
    if (appointment.phone) {
      channels.push('sms');
    }
  }

  // Para casos muy urgentes, incluir WhatsApp
  if (priority === 'urgent' && appointment.phone) {
    channels.push('whatsapp');
  }

  // Si no hay email, usar SMS como respaldo
  if (!appointment.email && appointment.phone && !channels.includes('sms')) {
    channels.push('sms');
  }

  return channels.length > 0 ? channels : ['email']; // Email como último recurso
}

export default router;
