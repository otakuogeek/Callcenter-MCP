// ==============================================
// SERVICIO DE NOTIFICACIONES
// ==============================================

import pool from '../db/pool';
import { Notification } from '../types/enhanced-types';
import mailer from './mailer';

export class NotificationService {
  
  static async createNotification(notification: Omit<Notification, 'id' | 'created_at'>): Promise<number> {
    const [result] = await pool.execute(
      `INSERT INTO notifications 
       (user_id, patient_id, type, title, message, data, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notification.user_id,
        notification.patient_id,
        notification.type,
        notification.title,
        notification.message,
        notification.data ? JSON.stringify(notification.data) : null,
        notification.priority,
        notification.status
      ]
    );
    
    const insertId = (result as any).insertId;
    
    // Auto-enviar si es de alta prioridad
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      await this.sendNotification(insertId);
    }
    
    return insertId;
  }

  static async sendNotification(notificationId: number): Promise<boolean> {
    try {
      const [rows] = await pool.execute(
        `SELECT n.*, u.email as user_email, u.phone as user_phone,
                p.email as patient_email, p.phone as patient_phone, p.name as patient_name
         FROM notifications n
         LEFT JOIN users u ON n.user_id = u.id
         LEFT JOIN patients p ON n.patient_id = p.id
         WHERE n.id = ?`,
        [notificationId]
      );

      const notification = (rows as any[])[0];
      if (!notification) return false;

      let sent = false;

      // Enviar por email si está disponible
      if (notification.user_email || notification.patient_email) {
        const email = notification.user_email || notification.patient_email;
        sent = await this.sendEmail(email, notification.title, notification.message);
      }

      // Aquí se pueden agregar otros métodos (SMS, Push, etc.)

      if (sent) {
        await pool.execute(
          `UPDATE notifications SET status = 'sent', sent_at = NOW(), sent_via = 'email' WHERE id = ?`,
          [notificationId]
        );
      } else {
        await pool.execute(
          `UPDATE notifications SET status = 'failed' WHERE id = ?`,
          [notificationId]
        );
      }

      return sent;
    } catch (error) {
      console.error('Error sending notification:', error);
      await pool.execute(
        `UPDATE notifications SET status = 'failed' WHERE id = ?`,
        [notificationId]
      );
      return false;
    }
  }

  static async sendEmail(to: string, subject: string, message: string): Promise<boolean> {
    try {
      const enabled = String(process.env.MAIL_ENABLED || 'false').toLowerCase() === 'true';
      if (!enabled) {
        console.log('Email disabled, skipping notification');
        return false;
      }

      // Reutiliza el servicio centralizado de mail (mailer.ts)
      const result = await mailer.sendMail({
        to,
        subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
      });

      // nodemailer devuelve un objeto con "accepted" array cuando fue aceptado por el SMTP
      if (result && Array.isArray((result as any).accepted) && (result as any).accepted.length > 0) {
        return true;
      }
      // Si no hay accepted, aún puede considerarse enviado según el servicio; devolver true por precaución si no hay error
      return !!result;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  static async getNotifications(
    userId?: number,
    patientId?: number,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    let query = `SELECT * FROM notifications WHERE 1=1`;
    const params: any[] = [];

    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }

    if (patientId) {
      query += ` AND patient_id = ?`;
      params.push(patientId);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows as Notification[];
  }

  static async markAsRead(notificationId: number): Promise<boolean> {
    try {
      await pool.execute(
        `UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = ?`,
        [notificationId]
      );
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  static async processPendingNotifications(): Promise<void> {
    try {
      const [rows] = await pool.execute(
        `SELECT id FROM notifications WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 10`
      );

      const notifications = rows as { id: number }[];
      
      for (const notification of notifications) {
        await this.sendNotification(notification.id);
      }
    } catch (error) {
      console.error('Error processing pending notifications:', error);
    }
  }

  // Métodos específicos para diferentes tipos de notificaciones
  static async createAppointmentReminder(appointmentId: number, patientId: number): Promise<number> {
    return this.createNotification({
      patient_id: patientId,
      type: 'appointment_reminder',
      title: 'Recordatorio de Cita Médica',
      message: `Recuerde su cita médica programada. ID: ${appointmentId}`,
      priority: 'normal',
      status: 'pending'
    });
  }

  static async createAppointmentConfirmation(appointmentId: number, patientId: number): Promise<number> {
    return this.createNotification({
      patient_id: patientId,
      type: 'appointment_confirmation',
      title: 'Confirmación de Cita Médica',
      message: `Su cita médica ha sido confirmada. ID: ${appointmentId}`,
      priority: 'high',
      status: 'pending'
    });
  }

  static async createSystemAlert(userId: number, message: string): Promise<number> {
    return this.createNotification({
      user_id: userId,
      type: 'system_alert',
      title: 'Alerta del Sistema',
      message,
      priority: 'urgent',
      status: 'pending'
    });
  }

  // ==============================================
  // FUNCIONES DE WEBHOOK ELEVENLABS
  // ==============================================

  /**
   * Secretos de webhook para diferentes tipos de eventos de ElevenLabs
   */
  private static readonly WEBHOOK_SECRETS = {
    call_started: process.env.ELEVENLABS_WEBHOOK_SECRET_STARTED || 'wsec_10242422f757a3433ce3983064bd5d44f74ec516cc921e972ed1561cb896bdfa',
    call_ended: process.env.ELEVENLABS_WEBHOOK_SECRET_ENDED || 'wsec_2704eb64eb523848d3ed499d627f6683fad77967a11a5072c77132fd4ad1fb31',
    general: process.env.ELEVENLABS_WEBHOOK_SECRET || 'wsec_10242422f757a3433ce3983064bd5d44f74ec516cc921e972ed1561cb896bdfa'
  };

  /**
   * Verifica la firma HMAC del webhook de ElevenLabs
   */
  static verifyElevenLabsWebhookSignature(
    payload: string, 
    signature: string, 
    webhookType: 'call_started' | 'call_ended' | 'general' = 'general'
  ): boolean {
    try {
      if (!signature) {
        console.error('❌ No signature provided');
        return false;
      }

      console.log(`🔍 Verificando firma ElevenLabs para ${webhookType}...`);
      console.log('📝 Signature recibida:', signature);
      console.log('📦 Payload length:', payload.length);

      // ElevenLabs puede usar diferentes formatos de firma
      let hashToVerify = signature;
      let timestampToCheck = null;

      // Si contiene comas, puede ser formato con timestamp
      if (signature.includes(',')) {
        const parts = signature.split(',');
        const timestampPart = parts.find(p => p.startsWith('t='));
        const hashPart = parts.find(p => p.startsWith('v1=') || p.startsWith('v0='));

        if (timestampPart && hashPart) {
          timestampToCheck = timestampPart.substring(2);
          hashToVerify = hashPart.includes('v1=') ? hashPart.substring(3) : hashPart.substring(3);
          
          // Verificar timestamp (tolerancia de 5 minutos para ElevenLabs)
          const tolerance = 5 * 60;
          const currentTime = Math.floor(Date.now() / 1000);
          if (currentTime - parseInt(timestampToCheck) > tolerance) {
            console.error('⏰ Webhook timestamp too old');
            return false;
          }
        }
      } else if (signature.startsWith('v1=') || signature.startsWith('v0=')) {
        // Formato vX=hash sin timestamp
        hashToVerify = signature.substring(3);
      }

      // Preparar payload para verificación
      let payloadToHash = payload;
      if (timestampToCheck) {
        payloadToHash = `${timestampToCheck}.${payload}`;
      }

      // Obtener el secreto correcto para el tipo de webhook
      const webhookSecret = this.WEBHOOK_SECRETS[webhookType];
      const secret = webhookSecret.startsWith('wsec_') ? webhookSecret.substring(5) : webhookSecret;
      
      const crypto = require('crypto');
      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(payloadToHash)
        .digest('hex');

      console.log('🔑 Hash esperado:', expectedHash.substring(0, 16) + '...');
      console.log('📨 Hash recibido:', hashToVerify.substring(0, 16) + '...');

      // Comparar hashes de forma segura
      const isValid = crypto.timingSafeEqual(
        Buffer.from(hashToVerify, 'hex'),
        Buffer.from(expectedHash, 'hex')
      );

      if (isValid) {
        console.log(`✅ Firma webhook ${webhookType} válida`);
      } else {
        console.log(`❌ Firma webhook ${webhookType} inválida`);
      }

      return isValid;
    } catch (error) {
      console.error('❌ Error verifying webhook signature:', error);
      
      // En desarrollo, permitir webhooks sin firma válida para testing
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Desarrollo: Permitiendo webhook sin firma válida');
        return true;
      }
      
      return false;
    }
  }

  /**
   * Procesa notificación de inicio de llamada
   */
  static async processCallStartedWebhook(webhookData: any): Promise<number | null> {
    try {
      const conversationId = webhookData.conversation_id || 'unknown';
      const agentId = webhookData.agent_id || 'unknown';
      
      // Crear la llamada en el CallManagerService
      const { CallManagerService } = await import('./callManagerService');
      const callId = await CallManagerService.createCall(webhookData);
      
      // Crear notificación
      const notificationId = await this.createNotification({
        type: 'call_started',
        title: 'Llamada Iniciada - ElevenLabs',
        message: `Nueva llamada iniciada. Conversación: ${conversationId}, Agente: ${agentId}`,
        data: {
          ...webhookData,
          call_id: callId
        },
        priority: 'normal',
        status: 'pending'
      });
      
      console.log(`📞 Llamada iniciada - Call ID: ${callId}, Notification ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('Error processing call started webhook:', error);
      return null;
    }
  }

  /**
   * Procesa notificación de fin de llamada
   */
  static async processCallEndedWebhook(webhookData: any): Promise<number | null> {
    try {
      const conversationId = webhookData.conversation_id || 'unknown';
      const duration = webhookData.duration || 0;
      const transcript = webhookData.transcript || 'No transcript available';
      
      // Finalizar la llamada en el CallManagerService
      const { CallManagerService } = await import('./callManagerService');
      const success = await CallManagerService.endCall(webhookData);
      
      // Crear notificación
      const notificationId = await this.createNotification({
        type: 'call_ended',
        title: 'Llamada Finalizada - ElevenLabs',
        message: `Llamada finalizada. Conversación: ${conversationId}, Duración: ${duration}s. Transcripción disponible.`,
        data: {
          ...webhookData,
          transcript_preview: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
          call_ended_success: success
        },
        priority: 'high',
        status: 'pending'
      });
      
      console.log(`📵 Llamada finalizada - Conversación: ${conversationId}, Success: ${success}, Notification ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('Error processing call ended webhook:', error);
      return null;
    }
  }

  /**
   * Obtiene estadísticas de webhooks procesados
   */
  static async getWebhookStats(hours: number = 24): Promise<{
    call_started: number;
    call_ended: number;
    total: number;
  }> {
    try {
      const [rows] = await pool.execute(
        `SELECT type, COUNT(*) as count 
         FROM notifications 
         WHERE type IN ('call_started', 'call_ended') 
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         GROUP BY type`,
        [hours]
      );

      const stats = { call_started: 0, call_ended: 0, total: 0 };
      
      (rows as any[]).forEach(row => {
        stats[row.type as keyof typeof stats] = row.count;
        stats.total += row.count;
      });

      return stats;
    } catch (error) {
      console.error('Error getting webhook stats:', error);
      return { call_started: 0, call_ended: 0, total: 0 };
    }
  }
}
