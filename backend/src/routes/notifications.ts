// ==============================================
// RUTAS DE NOTIFICACIONES
// ==============================================

import express from 'express';
import { NotificationService } from '../services/notificationService';
import { requireAuth } from '../middleware/auth';
import mailer from '../services/mailer';

const router = express.Router();

// Obtener notificaciones del usuario
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    const notifications = await NotificationService.getNotifications(
      userId, undefined, status, limit, offset
    );

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total: notifications.length
      }
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones'
    });
  }
});

// Marcar notificación como leída
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const success = await NotificationService.markAsRead(notificationId);

    if (success) {
      res.json({
        success: true,
        message: 'Notificación marcada como leída'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar notificación como leída'
    });
  }
});

// Crear nueva notificación (solo admin)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Verificar permisos de admin
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para crear notificaciones'
      });
    }

    const { user_id, patient_id, type, title, message, priority = 'normal' } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: type, title, message'
      });
    }

    const notificationId = await NotificationService.createNotification({
      user_id,
      patient_id,
      type,
      title,
      message,
      priority,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      data: { id: notificationId },
      message: 'Notificación creada exitosamente'
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear notificación'
    });
  }
});

// Obtener notificaciones de un paciente
router.get('/patient/:patientId', requireAuth, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    const notifications = await NotificationService.getNotifications(
      undefined, patientId, status, limit, offset
    );

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error getting patient notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones del paciente'
    });
  }
});

// Reenviar notificación
router.post('/:id/resend', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Verificar permisos
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para reenviar notificaciones'
      });
    }

    const notificationId = parseInt(req.params.id);
    const success = await NotificationService.sendNotification(notificationId);

    if (success) {
      res.json({
        success: true,
        message: 'Notificación reenviada exitosamente'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error al reenviar notificación'
      });
    }
  } catch (error) {
    console.error('Error resending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reenviar notificación'
    });
  }
});

export default router;

// Ruta de debug: enviar correo de prueba (solo si MAIL_ENABLED=true)
router.post('/debug/send-test-email', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    // Solo admins o supervisors pueden usar esta ruta
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return res.status(403).json({ success: false, message: 'No tienes permisos' });
    }

    const enabled = String(process.env.MAIL_ENABLED || 'false').toLowerCase() === 'true';
    if (!enabled) {
      return res.status(400).json({ success: false, message: 'Mailing no está habilitado en el servidor' });
    }

    const { to, subject, text } = req.body;
    if (!to || !subject || !text) {
      return res.status(400).json({ success: false, message: 'Faltan campos: to, subject, text' });
    }

    const result = await mailer.sendMail({ to, subject, text, html: `<p>${text.replace(/\n/g, '<br/>')}</p>` });
    return res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending test email:', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
});
