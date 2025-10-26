import { Router, Request, Response } from 'express';
import zadarmaSMSService from '../services/zadarma-sms.service';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/sms/send
 * Envía un SMS genérico
 * Body: { number: string, message: string, sender?: string, language?: string }
 */
router.post('/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const { number, message, sender, language } = req.body;

    // Validaciones
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren los campos: number y message',
      });
    }

    // Enviar SMS
    const result = await zadarmaSMSService.sendSMS({
      number,
      message,
      sender,
      language: language || 'es',
    });

    if (result.status === 'success') {
      return res.json({
        success: true,
        data: result,
        message: `SMS enviado exitosamente a ${number}`,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message || 'Error al enviar SMS',
        details: result,
      });
    }
  } catch (error: any) {
    console.error('Error en POST /api/sms/send:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al enviar SMS',
      details: error.message,
    });
  }
});

/**
 * POST /api/sms/appointment-confirmation
 * Envía SMS de confirmación de cita
 * Body: { phoneNumber, patientName, appointmentDate, appointmentTime, doctorName, location }
 */
router.post('/appointment-confirmation', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, patientName, appointmentDate, appointmentTime, doctorName, location } = req.body;

    // Validaciones
    if (!phoneNumber || !patientName || !appointmentDate || !appointmentTime || !doctorName || !location) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos',
      });
    }

    const result = await zadarmaSMSService.sendAppointmentConfirmation(
      phoneNumber,
      patientName,
      appointmentDate,
      appointmentTime,
      doctorName,
      location
    );

    if (result.status === 'success') {
      return res.json({
        success: true,
        data: result,
        message: 'SMS de confirmación enviado',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message || 'Error al enviar confirmación',
      });
    }
  } catch (error: any) {
    console.error('Error en POST /api/sms/appointment-confirmation:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al enviar confirmación',
      details: error.message,
    });
  }
});

/**
 * POST /api/sms/appointment-reminder
 * Envía SMS de recordatorio de cita
 * Body: { phoneNumber, patientName, appointmentDate, appointmentTime }
 */
router.post('/appointment-reminder', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, patientName, appointmentDate, appointmentTime } = req.body;

    if (!phoneNumber || !patientName || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos',
      });
    }

    const result = await zadarmaSMSService.sendAppointmentReminder(
      phoneNumber,
      patientName,
      appointmentDate,
      appointmentTime
    );

    if (result.status === 'success') {
      return res.json({
        success: true,
        data: result,
        message: 'SMS de recordatorio enviado',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message || 'Error al enviar recordatorio',
      });
    }
  } catch (error: any) {
    console.error('Error en POST /api/sms/appointment-reminder:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al enviar recordatorio',
      details: error.message,
    });
  }
});

/**
 * POST /api/sms/appointment-cancellation
 * Envía SMS de cancelación de cita
 * Body: { phoneNumber, patientName, appointmentDate }
 */
router.post('/appointment-cancellation', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, patientName, appointmentDate } = req.body;

    if (!phoneNumber || !patientName || !appointmentDate) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos',
      });
    }

    const result = await zadarmaSMSService.sendAppointmentCancellation(
      phoneNumber,
      patientName,
      appointmentDate
    );

    if (result.status === 'success') {
      return res.json({
        success: true,
        data: result,
        message: 'SMS de cancelación enviado',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message || 'Error al enviar cancelación',
      });
    }
  } catch (error: any) {
    console.error('Error en POST /api/sms/appointment-cancellation:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al enviar cancelación',
      details: error.message,
    });
  }
});

/**
 * GET /api/sms/sender-ids
 * Obtiene la lista de sender IDs disponibles en Zadarma
 */
router.get('/sender-ids', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await zadarmaSMSService.getSenderIds();

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error en GET /api/sms/sender-ids:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener sender IDs',
      details: error.message,
    });
  }
});

export default router;
