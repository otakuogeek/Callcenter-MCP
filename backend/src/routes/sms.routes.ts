import { Router, Request, Response } from 'express';
import labsmobileService from '../services/labsmobile-sms.service';
import { requireAuth } from '../middleware/auth';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

const router = Router();

/**
 * POST /api/sms/send
 * Envía un SMS genérico
 * Body: { number: string, message: string }
 */
router.post('/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const { number, message, recipient_name, patient_id, appointment_id, user_id, template_id } = req.body;

    // Validaciones
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren los campos: number y message',
      });
    }

    // Enviar SMS con LabsMobile
    const result = await labsmobileService.sendSMS({
      number,
      message,
      recipient_name,
      patient_id,
      appointment_id,
      user_id: user_id || (req as any).user?.id,
      template_id
    });

    if (result.success) {
      return res.json({
        success: true,
        data: result,
        message: `SMS enviado exitosamente a ${number}`,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Error al enviar SMS',
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
 * GET /api/sms/balance
 * Obtiene el saldo de créditos disponibles en LabsMobile
 */
router.get('/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await labsmobileService.getBalance();

    // LabsMobile retorna {code: 0, credits: "183.15..."}
    if (result.code === 0 || result.code === '0') {
      return res.json({
        success: true,
        credits: parseFloat(result.credits),
        data: result,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Error al obtener saldo',
        code: result.code,
      });
    }
  } catch (error: any) {
    console.error('Error en GET /api/sms/balance:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al obtener saldo',
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

    const result = await labsmobileService.sendAppointmentConfirmation(
      phoneNumber,
      patientName,
      appointmentDate,
      appointmentTime,
      doctorName,
      location
    );

    if (result.success) {
      return res.json({
        success: true,
        data: result,
        message: 'SMS de confirmación enviado',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Error al enviar confirmación',
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
 * Body: { phoneNumber, patientName, appointmentDate, appointmentTime, doctorName, location }
 */
router.post('/appointment-reminder', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, patientName, appointmentDate, appointmentTime, doctorName, location } = req.body;

    if (!phoneNumber || !patientName || !appointmentDate || !appointmentTime || !doctorName || !location) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos',
      });
    }

    const result = await labsmobileService.sendAppointmentReminder(
      phoneNumber,
      patientName,
      appointmentDate,
      appointmentTime,
      doctorName,
      location
    );

    if (result.success) {
      return res.json({
        success: true,
        data: result,
        message: 'SMS de recordatorio enviado',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Error al enviar recordatorio',
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
 * Body: { phoneNumber, patientName, appointmentDate, appointmentTime, reason? }
 */
router.post('/appointment-cancellation', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, patientName, appointmentDate, appointmentTime, reason } = req.body;

    if (!phoneNumber || !patientName || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos',
      });
    }

    const result = await labsmobileService.sendAppointmentCancellation(
      phoneNumber,
      patientName,
      appointmentDate,
      appointmentTime,
      reason
    );

    if (result.success) {
      return res.json({
        success: true,
        data: result,
        message: 'SMS de cancelación enviado',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Error al enviar cancelación',
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
 * GET /api/sms/templates
 * Obtiene la lista de plantillas SMS disponibles
 */
router.get('/templates', requireAuth, async (req: Request, res: Response) => {
  try {
    // LabsMobile no requiere plantillas pre-aprobadas como Zadarma
    // Retornamos las plantillas predefinidas del sistema
    const templates = [
      {
        id: 'appointment_confirmation',
        name: 'Confirmación de Cita',
        description: 'Confirma una cita médica programada',
        variables: ['patientName', 'appointmentDate', 'appointmentTime', 'doctorName', 'location']
      },
      {
        id: 'appointment_reminder',
        name: 'Recordatorio de Cita',
        description: 'Recuerda una cita médica próxima',
        variables: ['patientName', 'appointmentDate', 'appointmentTime', 'doctorName', 'location']
      },
      {
        id: 'appointment_cancellation',
        name: 'Cancelación de Cita',
        description: 'Notifica la cancelación de una cita',
        variables: ['patientName', 'appointmentDate', 'appointmentTime', 'reason']
      }
    ];

    return res.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    console.error('Error en GET /api/sms/templates:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener plantillas SMS',
      details: error.message,
    });
  }
});

/**
 * GET /api/sms/sender-ids
 * Obtiene la lista de sender IDs disponibles
 */
router.get('/sender-ids', requireAuth, async (req: Request, res: Response) => {
  try {
    // LabsMobile usa un sender ID configurado en las variables de entorno
    const senderIds = [
      {
        id: process.env.LABSMOBILE_SENDER || 'Biosanar',
        name: process.env.LABSMOBILE_SENDER || 'Biosanar',
        status: 'active',
        default: true
      }
    ];

    return res.json({
      success: true,
      data: senderIds,
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

/**
 * POST /api/sms/send-public
 * Envía un SMS sin autenticación (endpoint público para pruebas)
 * Ahora usa LabsMobile en lugar del servicio PHP/Zadarma
 * Body: { number: string, message: string }
 */
router.post('/send-public', async (req: Request, res: Response) => {
  try {
    const { number, message, recipient_name, patient_id, appointment_id } = req.body;

    console.log('📨 [SMS Público LabsMobile] Solicitud recibida:', { number, message: message?.substring(0, 50) + '...' });

    // Validaciones
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren los campos: number y message',
      });
    }

    // Enviar SMS usando LabsMobile
    const result = await labsmobileService.sendSMS({
      number,
      message,
      recipient_name,
      patient_id,
      appointment_id
    });

    console.log('✅ [SMS Público LabsMobile] Resultado:', result);

    if (result.success) {
      return res.json({
        success: true,
        data: result,
        message: `SMS enviado exitosamente a ${number}`,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Error al enviar SMS',
        details: result,
      });
    }
  } catch (error: any) {
    console.error('❌ [SMS Público LabsMobile] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al enviar SMS',
      details: error.message,
    });
  }
});

/**
 * GET /api/sms/history
 * Obtiene el historial de SMS enviados con filtros y paginación
 * Query params: page, limit, status, patient_id, appointment_id, start_date, end_date
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    const { status, patient_id, appointment_id, start_date, end_date } = req.query;

    // Construir query dinámico con filtros
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (patient_id) {
      whereClause += ' AND patient_id = ?';
      params.push(patient_id);
    }

    if (appointment_id) {
      whereClause += ' AND appointment_id = ?';
      params.push(appointment_id);
    }

    if (start_date) {
      whereClause += ' AND sent_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND sent_at <= ?';
      params.push(end_date);
    }

    // Consultar total de registros
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sms_logs ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Consultar registros con paginación
    const query = `
      SELECT 
        id,
        recipient_number,
        recipient_name,
        message,
        sender_id,
        template_id,
        status,
        messages_sent,
        cost,
        currency,
        parts,
        error_message,
        patient_id,
        appointment_id,
        user_id,
        sent_at,
        created_at
      FROM sms_logs
      ${whereClause}
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, [...params, limit, offset]);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error en GET /api/sms/history:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener historial de SMS',
      details: error.message
    });
  }
});

/**
 * GET /api/sms/stats
 * Obtiene estadísticas de SMS enviados
 * Query params: start_date, end_date
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (start_date) {
      whereClause += ' AND sent_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND sent_at <= ?';
      params.push(end_date);
    }

    // Estadísticas generales
    const [statsResult] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(cost) as total_cost,
        SUM(parts) as total_parts
      FROM sms_logs
      ${whereClause}`,
      params
    );

    const stats = statsResult[0] || {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      total_cost: 0,
      total_parts: 0
    };

    // Estadísticas por día (últimos 7 días si no se especifica rango)
    let dateRangeClause = whereClause;
    let dateParams = [...params];
    
    if (!start_date && !end_date) {
      dateRangeClause += ' AND sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    }

    const [dailyStats] = await pool.query<RowDataPacket[]>(
      `SELECT 
        DATE(sent_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(cost) as daily_cost
      FROM sms_logs
      ${dateRangeClause}
      GROUP BY DATE(sent_at)
      ORDER BY date DESC
      LIMIT 30`,
      dateParams
    );

    return res.json({
      success: true,
      data: {
        total: stats.total,
        sent: stats.sent,
        failed: stats.failed,
        pending: stats.pending,
        delivered: stats.sent, // Para compatibilidad con el frontend
        total_cost: parseFloat(stats.total_cost || 0),
        total_parts: stats.total_parts,
        daily_stats: dailyStats
      }
    });
  } catch (error: any) {
    console.error('Error en GET /api/sms/stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de SMS',
      details: error.message
    });
  }
});

/**
 * POST /api/sms/normalize-phones
 * Normaliza todos los números telefónicos en la base de datos
 * (Agrega +57 a números colombianos sin código de país)
 */
router.post('/normalize-phones', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = require('../db/pool').default;
    
    // Obtener todos los pacientes con teléfono
    const [patients]: any = await pool.query(
      'SELECT id, phone FROM patients WHERE phone IS NOT NULL AND phone != ""'
    );
    
    let updated = 0;
    let errors = 0;
    
    for (const patient of patients) {
      const phone = patient.phone;
      
      // Eliminar caracteres no numéricos
      let cleaned = phone.replace(/\D/g, '');
      
      // Eliminar 0 inicial
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      
      let formatted = phone; // Por defecto, mantener original
      
      // Formatear según la longitud y formato
      if (cleaned.length === 10 && !phone.includes('+')) {
        // Número colombiano de 10 dígitos sin +
        formatted = '+57' + cleaned;
      } else if (cleaned.startsWith('57') && cleaned.length === 12 && !phone.includes('+')) {
        // Tiene 57 pero sin +
        formatted = '+' + cleaned;
      }
      
      // Si el formato cambió, actualizar
      if (formatted !== phone) {
        try {
          await pool.query(
            'UPDATE patients SET phone = ? WHERE id = ?',
            [formatted, patient.id]
          );
          updated++;
          console.log(`✅ Paciente ${patient.id}: ${phone} → ${formatted}`);
        } catch (error) {
          errors++;
          console.error(`❌ Error actualizando paciente ${patient.id}:`, error);
        }
      }
    }
    
    return res.json({
      success: true,
      message: 'Normalización completada',
      data: {
        total: patients.length,
        updated,
        errors,
        unchanged: patients.length - updated - errors,
      },
    });
  } catch (error: any) {
    console.error('Error en POST /api/sms/normalize-phones:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al normalizar números telefónicos',
      details: error.message,
    });
  }
});

/**
 * GET /api/sms/waiting-list/eps-list
 * Obtiene la lista de EPS con pacientes en lista de espera
 * Query params:
 *   - specialty_id?: number (opcional: filtrar por especialidad)
 */
router.get('/waiting-list/eps-list', requireAuth, async (req: Request, res: Response) => {
  try {
    const { specialty_id } = req.query;

    let query = `
      SELECT DISTINCT
        e.id,
        e.name,
        COUNT(DISTINCT awl.patient_id) as patient_count
      FROM appointments_waiting_list awl
      INNER JOIN patients p ON awl.patient_id = p.id
      INNER JOIN eps e ON p.insurance_eps_id = e.id
      WHERE awl.status = 'pending'
        AND p.phone IS NOT NULL
        AND p.phone != ''
    `;

    const queryParams: any[] = [];

    if (specialty_id) {
      query += ' AND awl.specialty_id = ?';
      queryParams.push(Number(specialty_id));
    }

    query += `
      GROUP BY e.id, e.name
      ORDER BY patient_count DESC, e.name ASC
    `;

    const [epsList] = await pool.query<RowDataPacket[]>(query, queryParams);

    return res.json({
      success: true,
      data: epsList,
    });
  } catch (error: any) {
    console.error('Error en GET /api/sms/waiting-list/eps-list:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener lista de EPS',
      details: error.message,
    });
  }
});

/**
 * POST /api/sms/send-bulk-waiting-list
 * Envía SMS masivos a pacientes en lista de espera
 * Body: { 
 *   specialty_id?: number,        // Opcional: filtrar por especialidad
 *   max_count: number,            // Cantidad máxima de SMS a enviar
 *   from_position?: number,       // Posición inicial en la lista (default: 1)
 *   to_position?: number,         // Posición final en la lista
 *   excluded_eps_ids?: number[]   // IDs de EPS a excluir del envío
 * }
 */
router.post('/send-bulk-waiting-list', requireAuth, async (req: Request, res: Response) => {
  try {
    const { specialty_id, max_count, from_position, to_position, excluded_eps_ids } = req.body;

    // Validar parámetros
    const fromPos = from_position && from_position > 0 ? from_position : 1;
    const toPos = to_position && to_position > 0 ? to_position : max_count;

    // Calcular offset y limit
    const offset = fromPos - 1; // SQL OFFSET empieza en 0
    let limit = toPos - fromPos + 1;

    if (limit < 1) {
      return res.status(400).json({
        success: false,
        error: 'El rango de posiciones no es válido. La posición final debe ser mayor o igual a la inicial.',
      });
    }

    // 🔥 LÍMITE DE SEGURIDAD: Máximo 50 SMS por petición para evitar timeout
    const MAX_SMS_PER_BATCH = 50;
    const actualLimit = Math.min(limit, MAX_SMS_PER_BATCH);
    const hasMoreBatches = limit > MAX_SMS_PER_BATCH;

    console.log(`📊 [BULK SMS] Solicitados: ${limit} SMS, Procesando: ${actualLimit} SMS (Lote 1/${Math.ceil(limit / MAX_SMS_PER_BATCH)})`);
    
    limit = actualLimit;

    // Construir query para obtener pacientes en lista de espera
    let query = `
      SELECT DISTINCT
        awl.id as waiting_list_id,
        awl.patient_id,
        p.name as patient_name,
        p.phone,
        p.insurance_eps_id,
        s.name as specialty_name,
        awl.specialty_id
      FROM appointments_waiting_list awl
      INNER JOIN patients p ON awl.patient_id = p.id
      INNER JOIN specialties s ON awl.specialty_id = s.id
      WHERE awl.status = 'pending'
        AND p.phone IS NOT NULL
        AND p.phone != ''
    `;

    const queryParams: any[] = [];

    // Filtrar por especialidad si se proporciona
    if (specialty_id) {
      query += ' AND awl.specialty_id = ?';
      queryParams.push(specialty_id);
    }

    // Excluir EPS seleccionadas
    if (excluded_eps_ids && Array.isArray(excluded_eps_ids) && excluded_eps_ids.length > 0) {
      query += ` AND p.insurance_eps_id NOT IN (${excluded_eps_ids.map(() => '?').join(',')})`;
      queryParams.push(...excluded_eps_ids);
    }

    // Ordenar por prioridad y fecha de solicitud
    query += `
      ORDER BY 
        CASE awl.priority_level
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        awl.created_at ASC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    console.log('📋 [BULK SMS] Query:', query);
    console.log('📋 [BULK SMS] Params:', queryParams);
    console.log(`📋 [BULK SMS] Rango: posiciones ${fromPos} a ${toPos} (LIMIT ${limit} OFFSET ${offset})`);

    // Obtener pacientes
    const [patients] = await pool.query<RowDataPacket[]>(query, queryParams);

    if (!patients || patients.length === 0) {
      return res.json({
        success: true,
        message: 'No hay pacientes en lista de espera con los criterios especificados',
        data: {
          total_eligible: 0,
          sent: 0,
          failed: 0,
          results: []
        }
      });
    }

    console.log(`📱 [BULK SMS] Enviando SMS a ${patients.length} pacientes...`);

    // Preparar mensaje
    const message = 'Le informamos que hay citas disponibles para [Nombre de Especialidad]. Agende su cita en: https://biosanarcall.site/users';

    // Enviar SMS a cada paciente
    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const patient of patients) {
      try {
        // Personalizar mensaje con la especialidad
        const personalizedMessage = message.replace('[Nombre de Especialidad]', patient.specialty_name);

        const result = await labsmobileService.sendSMS({
          number: patient.phone,
          message: personalizedMessage,
          recipient_name: patient.patient_name,
          patient_id: patient.patient_id,
          template_id: 'bulk_waiting_list_invitation'
        });

        if (result.success) {
          sentCount++;
          results.push({
            patient_id: patient.patient_id,
            patient_name: patient.patient_name,
            phone: patient.phone,
            specialty: patient.specialty_name,
            status: 'success',
            message_id: result.message_id
          });
        } else {
          failedCount++;
          results.push({
            patient_id: patient.patient_id,
            patient_name: patient.patient_name,
            phone: patient.phone,
            specialty: patient.specialty_name,
            status: 'failed',
            error: result.error
          });
        }

        // Pequeña pausa entre envíos para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        failedCount++;
        results.push({
          patient_id: patient.patient_id,
          patient_name: patient.patient_name,
          phone: patient.phone,
          specialty: patient.specialty_name,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log(`✅ [BULK SMS] Completado: ${sentCount} exitosos, ${failedCount} fallidos`);

    // Calcular información de lotes pendientes
    const totalRequested = toPos - fromPos + 1;
    const nextFromPosition = fromPos + actualLimit;
    const remaining = totalRequested - actualLimit;

    return res.json({
      success: true,
      message: `SMS enviados a ${sentCount} de ${patients.length} pacientes`,
      data: {
        total_eligible: patients.length,
        sent: sentCount,
        failed: failedCount,
        results: results,
        // Información de lotes
        batch_info: {
          total_requested: totalRequested,
          processed_in_this_batch: actualLimit,
          remaining: remaining,
          has_more_batches: hasMoreBatches,
          next_from_position: hasMoreBatches ? nextFromPosition : null,
          next_to_position: hasMoreBatches ? toPos : null,
          current_batch: 1,
          total_batches: Math.ceil(totalRequested / MAX_SMS_PER_BATCH)
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [BULK SMS] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al enviar SMS masivos',
      details: error.message
    });
  }
});

/**
 * GET /api/sms/waiting-list/count
 * Obtiene el conteo de pacientes elegibles para envío masivo
 * Query params: specialty_id (opcional)
 */
router.get('/waiting-list/count', requireAuth, async (req: Request, res: Response) => {
  try {
    const { specialty_id } = req.query;

    let query = `
      SELECT COUNT(DISTINCT awl.patient_id) as total
      FROM appointments_waiting_list awl
      INNER JOIN patients p ON awl.patient_id = p.id
      WHERE awl.status = 'pending'
        AND p.phone IS NOT NULL
        AND p.phone != ''
    `;

    const queryParams: any[] = [];

    if (specialty_id) {
      query += ' AND awl.specialty_id = ?';
      queryParams.push(specialty_id);
    }

    const [result] = await pool.query<RowDataPacket[]>(query, queryParams);
    const total = result[0]?.total || 0;

    // También obtener el conteo por especialidad
    let specialtiesQuery = `
      SELECT 
        s.id,
        s.name,
        COUNT(DISTINCT awl.patient_id) as patient_count
      FROM appointments_waiting_list awl
      INNER JOIN patients p ON awl.patient_id = p.id
      INNER JOIN specialties s ON awl.specialty_id = s.id
      WHERE awl.status = 'pending'
        AND p.phone IS NOT NULL
        AND p.phone != ''
    `;

    if (specialty_id) {
      specialtiesQuery += ' AND awl.specialty_id = ?';
    }

    specialtiesQuery += ' GROUP BY s.id, s.name ORDER BY patient_count DESC';

    const [specialties] = await pool.query<RowDataPacket[]>(
      specialtiesQuery, 
      specialty_id ? [specialty_id] : []
    );

    return res.json({
      success: true,
      data: {
        total_eligible: total,
        by_specialty: specialties
      }
    });

  } catch (error: any) {
    console.error('Error en GET /api/sms/waiting-list/count:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener conteo de pacientes',
      details: error.message
    });
  }
});

/**
 * DELETE /api/sms/history/clear
 * Limpia completamente el historial de SMS (tabla sms_logs)
 * Requiere autenticación de administrador
 */
router.delete('/history/clear', requireAuth, async (req: Request, res: Response) => {
  try {
    // Verificar que el usuario sea administrador
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para realizar esta acción. Solo administradores pueden limpiar el historial.'
      });
    }

    // Contar registros antes de eliminar
    const [countResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM sms_logs'
    );
    const totalRegistros = countResult[0]?.total || 0;

    // Eliminar todos los registros
    await pool.query('DELETE FROM sms_logs');

    console.log(`✅ Historial de SMS limpiado: ${totalRegistros} registros eliminados`);

    return res.json({
      success: true,
      message: `Historial de SMS limpiado exitosamente`,
      data: {
        registros_eliminados: totalRegistros
      }
    });

  } catch (error: any) {
    console.error('Error en DELETE /api/sms/history/clear:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al limpiar el historial de SMS',
      details: error.message
    });
  }
});

/**
 * POST /api/sms/notify-availability-patients
 * Envía SMS a todos los pacientes agendados en una disponibilidad específica
 * Body: { availability_id: number }
 */
router.post('/notify-availability-patients', requireAuth, async (req: Request, res: Response) => {
  try {
    const { availability_id } = req.body;

    if (!availability_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el campo availability_id',
      });
    }

    // Obtener información de la disponibilidad
    const [availabilityRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name,
        l.address as location_address
       FROM availabilities a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN specialties s ON a.specialty_id = s.id
       JOIN locations l ON a.location_id = l.id
       WHERE a.id = ?`,
      [availability_id]
    );

    if (availabilityRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Disponibilidad no encontrada',
      });
    }

    const availability = availabilityRows[0];

    // Obtener todos los pacientes confirmados en esta disponibilidad
    const [appointmentsRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        ap.id as appointment_id,
        ap.scheduled_at,
        p.id as patient_id,
        p.name as patient_name,
        p.phone as patient_phone,
        p.email as patient_email
       FROM appointments ap
       JOIN patients p ON ap.patient_id = p.id
       WHERE ap.availability_id = ?
         AND ap.status = 'Confirmada'
         AND p.phone IS NOT NULL
         AND p.phone != ''
       ORDER BY ap.scheduled_at`,
      [availability_id]
    );

    if (appointmentsRows.length === 0) {
      return res.json({
        success: true,
        message: 'No hay pacientes con teléfono registrado en esta disponibilidad',
        data: {
          total_pacientes: 0,
          sms_enviados: 0,
          sms_fallidos: 0
        }
      });
    }

    // Formatear fecha y hora
    const appointmentDate = new Date(availability.date);
    const formattedDate = appointmentDate.toLocaleDateString('es-CO', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = availability.start_time.substring(0, 5); // HH:MM

    // Enviar SMS a cada paciente
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const appointment of appointmentsRows) {
      try {
        const message = `Hola ${appointment.patient_name}! 📅 Recordatorio de su cita:\n\n` +
          `🏥 Especialidad: ${availability.specialty_name}\n` +
          `👨‍⚕️ Doctor: ${availability.doctor_name}\n` +
          `📍 Sede: ${availability.location_name}\n` +
          `📆 Fecha: ${formattedDate}\n` +
          `🕐 Hora: ${formattedTime}\n\n` +
          `Por favor asista puntualmente. ¡Le esperamos!\n` +
          `- Fundación Biosanar IPS`;

        const result = await labsmobileService.sendSMS({
          number: appointment.patient_phone,
          message,
          recipient_name: appointment.patient_name,
          patient_id: appointment.patient_id,
          appointment_id: appointment.appointment_id,
          user_id: (req as any).user?.id,
          template_id: 'appointment_reminder'
        });

        if (result.success) {
          successCount++;
          results.push({
            patient_id: appointment.patient_id,
            patient_name: appointment.patient_name,
            phone: appointment.patient_phone,
            status: 'enviado',
            message_id: result.message_id
          });
        } else {
          failCount++;
          results.push({
            patient_id: appointment.patient_id,
            patient_name: appointment.patient_name,
            phone: appointment.patient_phone,
            status: 'fallido',
            error: result.error
          });
        }

        // Pequeña pausa entre envíos para evitar saturar la API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        failCount++;
        results.push({
          patient_id: appointment.patient_id,
          patient_name: appointment.patient_name,
          phone: appointment.patient_phone,
          status: 'error',
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      message: `SMS enviados: ${successCount} exitosos, ${failCount} fallidos`,
      data: {
        availability_info: {
          doctor: availability.doctor_name,
          specialty: availability.specialty_name,
          location: availability.location_name,
          date: formattedDate,
          time: formattedTime
        },
        total_pacientes: appointmentsRows.length,
        sms_enviados: successCount,
        sms_fallidos: failCount,
        resultados: results
      }
    });

  } catch (error: any) {
    console.error('Error en POST /api/sms/notify-availability-patients:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al enviar notificaciones SMS',
      details: error.message
    });
  }
});

export default router;
