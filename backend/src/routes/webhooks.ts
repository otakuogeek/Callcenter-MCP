import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// Interfaz para el payload del webhook de ElevenLabs
interface ElevenLabsWebhookPayload {
  type: 'post_call_transcription' | 'post_call_audio';
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status?: string;
    user_id?: string;
    transcript?: any[];
    metadata?: {
      start_time_unix_secs?: number;
      call_duration_secs?: number;
      cost?: number;
      termination_reason?: string;
      [key: string]: any;
    };
    analysis?: {
      call_successful?: string;
      transcript_summary?: string;
      [key: string]: any;
    };
    conversation_initiation_client_data?: {
      dynamic_variables?: {
        user_name?: string;
        patient_id?: string;
        [key: string]: any;
      };
      [key: string]: any;
    };
    full_audio?: string; // Base64 para audio webhooks
  };
}

// Configuración del webhook (debería venir de variables de entorno)
const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || 'elevenlabs_webhook_secret_2025';

/**
 * Verifica la firma HMAC del webhook
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  try {
    if (!signature) {
      console.error('No signature provided');
      return false;
    }

    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const hashPart = parts.find(p => p.startsWith('v0='));

    if (!timestampPart || !hashPart) {
      console.error('Invalid signature format');
      return false;
    }

    const timestamp = timestampPart.substring(2);
    const receivedHash = hashPart.substring(3);

    // Verificar que el timestamp no sea muy antiguo (30 minutos)
    const tolerance = 30 * 60; // 30 minutos en segundos
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - parseInt(timestamp) > tolerance) {
      console.error('Webhook timestamp too old');
      return false;
    }

    // Crear el hash esperado
    const fullPayload = `${timestamp}.${payload}`;
    const expectedHash = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(fullPayload)
      .digest('hex');

    // Comparar hashes de forma segura
    return crypto.timingSafeEqual(
      Buffer.from(receivedHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Busca un paciente por su user_id o nombre
 */
async function findPatientByUserId(userId: string, userName?: string): Promise<number | null> {
  try {
    // Primero buscar por external_id si coincide con userId
    let [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM patients WHERE external_id = ? LIMIT 1',
      [userId]
    );

    if (rows.length > 0) {
      return rows[0].id;
    }

    // Si no se encuentra y tenemos userName, buscar por nombre
    if (userName) {
      [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM patients WHERE name LIKE ? LIMIT 1',
        [`%${userName}%`]
      );

      if (rows.length > 0) {
        return rows[0].id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding patient:', error);
    return null;
  }
}

/**
 * Procesa un webhook de transcripción (fin de llamada)
 */
async function processTranscriptionWebhook(payload: ElevenLabsWebhookPayload): Promise<void> {
  const { data } = payload;
  
  try {
    // Buscar el paciente relacionado
    const userName = data.conversation_initiation_client_data?.dynamic_variables?.user_name;
    const patientIdFromData = data.conversation_initiation_client_data?.dynamic_variables?.patient_id;
    
    let patientId: number | null = null;
    
    if (patientIdFromData) {
      patientId = parseInt(patientIdFromData);
    } else if (data.user_id || userName) {
      patientId = await findPatientByUserId(data.user_id || '', userName);
    }

    // Guardar la conversación completa
    const [conversationResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO elevenlabs_conversations 
       (conversation_id, agent_id, user_id, status, start_time, end_time, 
        duration_secs, cost, transcript_summary, call_successful, 
        termination_reason, full_transcript, metadata) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       end_time = VALUES(end_time),
       duration_secs = VALUES(duration_secs),
       cost = VALUES(cost),
       transcript_summary = VALUES(transcript_summary),
       call_successful = VALUES(call_successful),
       termination_reason = VALUES(termination_reason),
       full_transcript = VALUES(full_transcript),
       metadata = VALUES(metadata),
       updated_at = CURRENT_TIMESTAMP`,
      [
        data.conversation_id,
        data.agent_id,
        data.user_id || null,
        'completed',
        data.metadata?.start_time_unix_secs ? new Date(data.metadata.start_time_unix_secs * 1000) : null,
        new Date(payload.event_timestamp * 1000),
        data.metadata?.call_duration_secs || 0,
        data.metadata?.cost || 0,
        data.analysis?.transcript_summary || null,
        data.analysis?.call_successful || 'unknown',
        data.metadata?.termination_reason || '',
        JSON.stringify(data.transcript || []),
        JSON.stringify(data.metadata || {})
      ]
    );

    // Registrar notificación de finalización solo si tenemos un paciente válido
    if (patientId) {
      await pool.execute(
        `INSERT INTO call_notifications 
         (conversation_id, patient_id, agent_id, call_type, timestamp, 
          duration_secs, cost, summary, success_status, metadata) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.conversation_id,
          patientId,
          data.agent_id,
          'completed',
          new Date(payload.event_timestamp * 1000),
          data.metadata?.call_duration_secs || 0,
          data.metadata?.cost || 0,
          data.analysis?.transcript_summary || null,
          data.analysis?.call_successful || 'unknown',
          JSON.stringify({
            user_id: data.user_id,
            user_name: userName,
            termination_reason: data.metadata?.termination_reason,
            original_payload_type: payload.type
          })
        ]
      );
    } else {
      console.warn(`⚠️ No patient found for conversation ${data.conversation_id}, skipping call notification`);
    }

    console.log(`✅ Processed transcription webhook for conversation ${data.conversation_id}`);

    // TODO: Aquí se pueden agregar notificaciones adicionales:
    // - Enviar email al médico
    // - Crear tarea de seguimiento
    // - Actualizar historial del paciente
    // - Notificar a sistemas externos

  } catch (error) {
    console.error('Error processing transcription webhook:', error);
    throw error;
  }
}

/**
 * Procesa un webhook de audio
 */
async function processAudioWebhook(payload: ElevenLabsWebhookPayload): Promise<void> {
  const { data } = payload;
  
  try {
    // Guardar el audio si está presente
    if (data.full_audio) {
      // Calcular el tamaño aproximado del archivo
      const audioSizeBytes = Math.floor((data.full_audio.length * 3) / 4); // Base64 a bytes
      
      await pool.execute(
        `INSERT INTO elevenlabs_audio 
         (conversation_id, full_audio, file_size_bytes, format) 
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         full_audio = VALUES(full_audio),
         file_size_bytes = VALUES(file_size_bytes)`,
        [
          data.conversation_id,
          data.full_audio,
          audioSizeBytes,
          'mp3'
        ]
      );

      console.log(`✅ Processed audio webhook for conversation ${data.conversation_id} (${audioSizeBytes} bytes)`);
    }

  } catch (error) {
    console.error('Error processing audio webhook:', error);
    throw error;
  }
}

/**
 * Log del webhook para auditoría
 */
async function logWebhookRequest(
  webhookType: string,
  conversationId: string | null,
  payload: any,
  responseStatus: number,
  responseBody: string,
  processingTimeMs: number,
  errorMessage?: string
): Promise<void> {
  try {
    // Obtener o crear el ID de configuración del webhook
    let [configRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM webhook_config WHERE service_name = ? LIMIT 1',
      ['elevenlabs']
    );

    let webhookConfigId: number;

    if (configRows.length === 0) {
      // Crear la configuración si no existe
      const [insertResult] = await pool.execute<ResultSetHeader>(
        `INSERT INTO webhook_config 
         (service_name, endpoint_url, is_active, webhook_events, retry_attempts, timeout_seconds) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'elevenlabs',
          'https://biosanarcall.site/api/webhooks/elevenlabs',
          true,
          JSON.stringify(['post_call_transcription', 'post_call_audio']),
          3,
          30
        ]
      );
      webhookConfigId = insertResult.insertId;
    } else {
      webhookConfigId = configRows[0].id;
    }

    // Truncar webhook_type si es muy largo y mapear a valores válidos
    let mappedWebhookType = 'unknown';
    if (webhookType.includes('transcription')) {
      mappedWebhookType = 'transcription';
    } else if (webhookType.includes('audio')) {
      mappedWebhookType = 'audio';
    }

    await pool.execute(
      `INSERT INTO webhook_logs 
       (webhook_config_id, conversation_id, webhook_type, request_payload, 
        response_status, response_body, processing_time_ms, error_message) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        webhookConfigId,
        conversationId,
        mappedWebhookType,
        JSON.stringify(payload),
        responseStatus,
        responseBody,
        processingTimeMs,
        errorMessage || null
      ]
    );
  } catch (error) {
    console.error('Error logging webhook request:', error);
  }
}

/**
 * Endpoint principal para recibir webhooks de ElevenLabs
 */
router.post('/elevenlabs', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let conversationId: string | null = null;
  let webhookType = 'unknown';

  try {
    console.log('🔔 Starting webhook processing...');
    
    // Obtener el cuerpo raw como string desde el buffer
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    const signature = req.headers['elevenlabs-signature'] as string;

    console.log('🔔 Received ElevenLabs webhook:', {
      signature: signature ? 'present' : 'missing',
      bodySize: rawBody ? rawBody.length : 0,
      contentType: req.headers['content-type'],
      isBuffer: Buffer.isBuffer(req.body)
    });

    // Verificar la firma HMAC
    console.log('🔐 Verifying signature...');
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Invalid webhook signature');
      const errorMessage = 'Invalid webhook signature';
      await logWebhookRequest(webhookType, conversationId, {}, 401, errorMessage, Date.now() - startTime, errorMessage);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('✅ Signature verified, parsing payload...');
    // Parsear el payload
    const payload: ElevenLabsWebhookPayload = JSON.parse(rawBody);
    conversationId = payload.data?.conversation_id || null;
    webhookType = payload.type;

    console.log('📞 Processing webhook:', {
      type: payload.type,
      conversationId,
      agentId: payload.data?.agent_id,
      eventTimestamp: new Date(payload.event_timestamp * 1000).toISOString()
    });

    // Procesar según el tipo de webhook
    if (payload.type === 'post_call_transcription') {
      console.log('📝 Processing transcription webhook...');
      await processTranscriptionWebhook(payload);
    } else if (payload.type === 'post_call_audio') {
      console.log('🎵 Processing audio webhook...');
      await processAudioWebhook(payload);
    } else {
      console.warn(`⚠️ Unknown webhook type: ${payload.type}`);
    }

    const processingTime = Date.now() - startTime;
    const responseBody = 'Webhook processed successfully';

    console.log('📝 Logging webhook request...');
    // Log exitoso
    await logWebhookRequest(
      webhookType, 
      conversationId, 
      payload, 
      200, 
      responseBody, 
      processingTime
    );

    console.log(`✅ Webhook processed successfully in ${processingTime}ms`);
    res.status(200).json({ status: 'success', message: responseBody });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ Error processing webhook:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

    // Log del error
    try {
      await logWebhookRequest(
        webhookType,
        conversationId,
        req.body || {},
        500,
        'Internal server error',
        processingTime,
        errorMessage
      );
    } catch (logError) {
      console.error('❌ Error logging webhook failure:', logError);
    }

    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
});

/**
 * Endpoint para obtener estadísticas de webhooks
 */
router.get('/elevenlabs/stats', async (req: Request, res: Response) => {
  try {
    // Estadísticas generales
    const [conversationStats] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         COUNT(*) as total_conversations,
         COUNT(CASE WHEN call_successful = 'success' THEN 1 END) as successful_calls,
         COUNT(CASE WHEN call_successful = 'failure' THEN 1 END) as failed_calls,
         AVG(duration_secs) as avg_duration_secs,
         SUM(cost) as total_cost_cents,
         DATE(created_at) as date
       FROM elevenlabs_conversations 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`
    );

    // Estadísticas de webhooks
    const [webhookStats] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         webhook_type,
         COUNT(*) as total_requests,
         COUNT(CASE WHEN response_status = 200 THEN 1 END) as successful_requests,
         COUNT(CASE WHEN response_status != 200 THEN 1 END) as failed_requests,
         AVG(processing_time_ms) as avg_processing_time_ms
       FROM webhook_logs 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY webhook_type`
    );

    res.json({
      conversation_stats: conversationStats,
      webhook_stats: webhookStats,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting webhook stats:', error);
    res.status(500).json({ error: 'Failed to get webhook statistics' });
  }
});

/**
 * Endpoint para obtener logs recientes de webhooks
 */
router.get('/elevenlabs/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const [logs] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         wl.*,
         wc.service_name,
         wc.endpoint_url
       FROM webhook_logs wl
       JOIN webhook_config wc ON wl.webhook_config_id = wc.id
       WHERE wc.service_name = 'elevenlabs'
       ORDER BY wl.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      logs,
      pagination: {
        limit,
        offset,
        total: logs.length
      }
    });

  } catch (error) {
    console.error('Error getting webhook logs:', error);
    res.status(500).json({ error: 'Failed to get webhook logs' });
  }
});

// ==============================================
// ENDPOINTS ESPECÍFICOS PARA ELEVENLABS
// ==============================================

/**
 * Endpoint específico para webhooks de inicio de llamada
 */
router.post('/elevenlabs/call-started', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log('🔔 Starting call started webhook processing...');
    
    // Obtener el cuerpo raw como string
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const signature = req.headers['elevenlabs-signature'] as string;

    console.log('📞 Call Started Webhook:', {
      signature: signature ? 'present' : 'missing',
      bodySize: rawBody.length,
      contentType: req.headers['content-type']
    });

    // Verificar la firma usando NotificationService
    const { NotificationService } = await import('../services/notificationService');
    
    if (!NotificationService.verifyElevenLabsWebhookSignature(rawBody, signature, 'call_started')) {
      console.error('❌ Invalid webhook signature for call-started');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Procesar el webhook
    let webhookData;
    try {
      webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error('❌ Invalid JSON payload');
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Crear notificación usando NotificationService
    const notificationId = await NotificationService.processCallStartedWebhook(webhookData);
    
    // Registrar en webhook_logs
    const conversationId = webhookData.conversation_id || 'unknown';
    await pool.execute(
      `INSERT INTO webhook_logs (webhook_config_id, webhook_type, conversation_id, payload, status, response_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [1, 'call_started', conversationId, JSON.stringify(webhookData), 'success', JSON.stringify({ notification_id: notificationId })]
    );

    console.log(`✅ Call started webhook processed successfully in ${Date.now() - startTime}ms`);
    res.status(200).json({ 
      status: 'success', 
      message: 'Call started webhook processed',
      notification_id: notificationId,
      conversation_id: conversationId
    });

  } catch (error) {
    console.error('❌ Error processing call started webhook:', error);
    
    try {
      await pool.execute(
        `INSERT INTO webhook_logs (webhook_config_id, webhook_type, conversation_id, payload, status, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [1, 'call_started', 'unknown', JSON.stringify(req.body), 'error', error instanceof Error ? error.message : 'Unknown error']
      );
    } catch (logError) {
      console.error('❌ Error logging webhook failure:', logError);
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Endpoint específico para webhooks de fin de llamada
 */
router.post('/elevenlabs/call-ended', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log('🔔 Starting call ended webhook processing...');
    
    // Obtener el cuerpo raw como string
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const signature = req.headers['elevenlabs-signature'] as string;

    console.log('📵 Call Ended Webhook:', {
      signature: signature ? 'present' : 'missing',
      bodySize: rawBody.length,
      contentType: req.headers['content-type']
    });

    // Verificar la firma usando NotificationService
    const { NotificationService } = await import('../services/notificationService');
    
    if (!NotificationService.verifyElevenLabsWebhookSignature(rawBody, signature, 'call_ended')) {
      console.error('❌ Invalid webhook signature for call-ended');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Procesar el webhook
    let webhookData;
    try {
      webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error('❌ Invalid JSON payload');
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Crear notificación usando NotificationService
    const notificationId = await NotificationService.processCallEndedWebhook(webhookData);
    
    // Registrar en webhook_logs
    const conversationId = webhookData.conversation_id || 'unknown';
    await pool.execute(
      `INSERT INTO webhook_logs (webhook_config_id, webhook_type, conversation_id, payload, status, response_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [1, 'call_ended', conversationId, JSON.stringify(webhookData), 'success', JSON.stringify({ notification_id: notificationId })]
    );

    console.log(`✅ Call ended webhook processed successfully in ${Date.now() - startTime}ms`);
    res.status(200).json({ 
      status: 'success', 
      message: 'Call ended webhook processed',
      notification_id: notificationId,
      conversation_id: conversationId
    });

  } catch (error) {
    console.error('❌ Error processing call ended webhook:', error);
    
    try {
      await pool.execute(
        `INSERT INTO webhook_logs (webhook_config_id, webhook_type, conversation_id, payload, status, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [1, 'call_ended', 'unknown', JSON.stringify(req.body), 'error', error instanceof Error ? error.message : 'Unknown error']
      );
    } catch (logError) {
      console.error('❌ Error logging webhook failure:', logError);
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
