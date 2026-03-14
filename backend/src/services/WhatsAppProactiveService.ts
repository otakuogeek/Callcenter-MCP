/**
 * WhatsApp Proactive Service - Comunicación Proactiva
 * 
 * Sistema de comunicación proactiva que permite:
 * - Recordatorios automáticos de citas
 * - Seguimiento post-cita
 * - Notificaciones de disponibilidad (lista de espera)
 * - Campañas de salud personalizadas
 * - Re-engagement de pacientes inactivos
 * 
 * @version 1.0.0
 */

import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pino from 'pino';
import WhatsAppConnection from './WhatsAppConnection';
import MetaConnection from './WhatsAppMetaConnection';

const logger = pino({
  name: 'whatsapp-proactive',
  level: process.env.LOG_LEVEL || 'info'
});

function getWhatsAppProvider(): 'baileys' | 'meta' {
  return process.env.WHATSAPP_PROVIDER?.toLowerCase() === 'meta' ? 'meta' : 'baileys';
}

function isWhatsAppAvailable(): boolean {
  return getWhatsAppProvider() === 'meta'
    ? MetaConnection.isConfigured()
    : WhatsAppConnection.getStatus().connected;
}

async function sendWhatsAppText(phone: string, message: string) {
  return getWhatsAppProvider() === 'meta'
    ? MetaConnection.sendMessage(phone, message)
    : WhatsAppConnection.sendMessage(phone, message);
}

// ============================================================================
// TIPOS
// ============================================================================

export interface ProactiveMessage {
  id?: number;
  phone: string;
  patient_id?: number;
  message_type: ProactiveMessageType;
  template: string;
  variables: Record<string, string>;
  scheduled_at: Date;
  sent_at?: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  retry_count: number;
  max_retries: number;
  related_appointment_id?: number;
  metadata?: Record<string, any>;
}

export type ProactiveMessageType = 
  | 'appointment_reminder_24h'
  | 'appointment_reminder_2h'
  | 'appointment_followup'
  | 'waiting_list_available'
  | 'health_campaign'
  | 'reengagement'
  | 'birthday_greeting'
  | 'appointment_confirmation';

// ============================================================================
// TEMPLATES DE MENSAJES
// ============================================================================

const MESSAGE_TEMPLATES: Record<ProactiveMessageType, string> = {
  appointment_reminder_24h: `¡Hola {{patient_name}}! 👋

Te recordamos que tienes una cita mañana:

📅 {{appointment_date}}
🕐 {{appointment_time}}
👨‍⚕️ {{doctor_name}}
🏥 {{specialty}}
📍 {{location}}

Por favor confirma tu asistencia respondiendo:
✅ "Confirmo" - Si asistirás
❌ "Cancelar" - Si no podrás asistir

¡Te esperamos! 😊`,

  appointment_reminder_2h: `¡Hola {{patient_name}}! 😊

Tu cita es en 2 horas:

🕐 {{appointment_time}}
👨‍⚕️ {{doctor_name}}
📍 {{location}}

Recuerda traer tu documento de identidad.
¡Te esperamos! 🏥`,

  appointment_followup: `¡Hola {{patient_name}}! 👋

¿Cómo te fue en tu cita de {{specialty}} con {{doctor_name}}?

Tu opinión nos ayuda a mejorar. ¿Podrías calificar tu experiencia del 1 al 5?

También puedes contarnos cualquier comentario. 😊`,

  waiting_list_available: `¡Buenas noticias, {{patient_name}}! 🎉

Se liberó un cupo para {{specialty}}:

📅 {{appointment_date}}
🕐 {{appointment_time}}
👨‍⚕️ {{doctor_name}}
📍 {{location}}

Responde "Acepto" para confirmar esta cita o "Rechazar" si ya no la necesitas.

⚠️ Este cupo se reservará por 2 horas.`,

  health_campaign: `¡Hola {{patient_name}}! 👋

En Fundación Biosanar IPS tenemos una campaña especial de {{campaign_name}}:

{{campaign_description}}

📅 Válido hasta: {{campaign_end_date}}
📍 {{location}}

¿Te gustaría agendar una cita? Responde "Sí" y te ayudo. 😊`,

  reengagement: `¡Hola {{patient_name}}! 👋

Te extrañamos en Fundación Biosanar IPS. 😊

Ha pasado tiempo desde tu última visita y queremos saber cómo estás.

¿Necesitas agendar alguna cita de control o consulta?

Estamos aquí para cuidar de tu salud. 🏥`,

  birthday_greeting: `¡Feliz cumpleaños, {{patient_name}}! 🎂🎉

En Fundación Biosanar IPS te deseamos un día muy especial.

Como regalo, te ofrecemos un 10% de descuento en tu próxima consulta particular.

¡Cuídate mucho! 😊🏥`,

  appointment_confirmation: `¡Cita confirmada, {{patient_name}}! ✅

📅 {{appointment_date}}
🕐 {{appointment_time}}
👨‍⚕️ {{doctor_name}}
🏥 {{specialty}}
📍 {{location}}
🎫 Cita #{{appointment_id}}

Recuerda traer tu documento de identidad.
¡Te esperamos! 😊`
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

export class WhatsAppProactiveService {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // Cada minuto
  private readonly MAX_MESSAGES_PER_MINUTE = 20;
  private messagesSentThisMinute = 0;

  /**
   * Inicializar el servicio proactivo
   */
  async initialize(): Promise<void> {
    await this.ensureTableExists();
    this.startScheduler();
    logger.info('Proactive service initialized');
  }

  /**
   * Crear tabla de mensajes programados (con cache para evitar consultas repetitivas)
   */
  private _tableEnsured = false;
  private async ensureTableExists(): Promise<void> {
    if (this._tableEnsured) return;
    const connection = await pool.getConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS wa_proactive_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          phone VARCHAR(50) NOT NULL,
          patient_id INT,
          message_type VARCHAR(50) NOT NULL,
          template TEXT NOT NULL,
          variables JSON,
          scheduled_at DATETIME NOT NULL,
          sent_at DATETIME,
          status ENUM('pending', 'sent', 'failed', 'cancelled') DEFAULT 'pending',
          retry_count INT DEFAULT 0,
          max_retries INT DEFAULT 3,
          related_appointment_id INT,
          metadata JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status_scheduled (status, scheduled_at),
          INDEX idx_phone (phone),
          INDEX idx_patient (patient_id),
          INDEX idx_appointment (related_appointment_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      this._tableEnsured = true;
      logger.info('Proactive messages table verified');
    } finally {
      connection.release();
    }
  }

  /**
   * Iniciar scheduler de mensajes
   */
  private startScheduler(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.checkInterval = setInterval(async () => {
      await this.processScheduledMessages();
      this.messagesSentThisMinute = 0; // Reset counter cada minuto
    }, this.CHECK_INTERVAL_MS);

    logger.info('Proactive scheduler started');
  }

  /**
   * Detener scheduler
   */
  stopScheduler(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Proactive scheduler stopped');
  }

  /**
   * Procesar mensajes programados
   */
  private async processScheduledMessages(): Promise<void> {
    const connection = await pool.getConnection();
    try {
      // Obtener mensajes pendientes que deben enviarse
      const [messages] = await connection.execute<RowDataPacket[]>(`
        SELECT * FROM wa_proactive_messages
        WHERE status = 'pending'
        AND scheduled_at <= NOW()
        AND retry_count < max_retries
        ORDER BY scheduled_at ASC
        LIMIT ?
      `, [this.MAX_MESSAGES_PER_MINUTE - this.messagesSentThisMinute]);

      if (messages.length === 0) return;

      logger.info({ count: messages.length }, 'Processing scheduled messages');

      for (const msg of messages) {
        if (this.messagesSentThisMinute >= this.MAX_MESSAGES_PER_MINUTE) {
          logger.warn('Rate limit reached, waiting for next cycle');
          break;
        }

        try {
          await this.sendProactiveMessage(msg as unknown as ProactiveMessage);
          this.messagesSentThisMinute++;
        } catch (error: any) {
          logger.error({ messageId: msg.id, error: error.message }, 'Failed to send proactive message');
        }
      }
    } finally {
      connection.release();
    }
  }

  /**
   * Enviar mensaje proactivo
   */
  private async sendProactiveMessage(message: ProactiveMessage): Promise<void> {
    const connection = await pool.getConnection();
    try {
      // Renderizar template con variables
      const renderedMessage = this.renderTemplate(message.template, message.variables);

      // Verificar que WhatsApp está conectado
      if (!isWhatsAppAvailable()) {
        throw new Error('WhatsApp not connected');
      }

      // Enviar mensaje
      const result = await sendWhatsAppText(message.phone, renderedMessage);

      if (result.success) {
        await connection.execute(`
          UPDATE wa_proactive_messages
          SET status = 'sent', sent_at = NOW()
          WHERE id = ?
        `, [message.id]);

        logger.info({ 
          messageId: message.id, 
          phone: message.phone,
          type: message.message_type 
        }, 'Proactive message sent');
      } else {
        throw new Error(result.error || 'Send failed');
      }
    } catch (error: any) {
      // Incrementar retry count
      await connection.execute(`
        UPDATE wa_proactive_messages
        SET retry_count = retry_count + 1,
            status = CASE 
              WHEN retry_count + 1 >= max_retries THEN 'failed'
              ELSE 'pending'
            END
        WHERE id = ?
      `, [message.id]);

      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Renderizar template con variables
   */
  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return rendered;
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS PARA PROGRAMAR MENSAJES
  // ============================================================================

  /**
   * Programar recordatorio de cita (24h antes)
   */
  async scheduleAppointmentReminder(
    appointmentId: number,
    phone: string,
    patientId: number,
    variables: Record<string, string>,
    appointmentDate: Date
  ): Promise<number> {
    // Recordatorio 24h antes
    const reminder24h = new Date(appointmentDate);
    reminder24h.setHours(reminder24h.getHours() - 24);

    // Recordatorio 2h antes
    const reminder2h = new Date(appointmentDate);
    reminder2h.setHours(reminder2h.getHours() - 2);

    const connection = await pool.getConnection();
    try {
      // Programar recordatorio de 24h
      const [result1] = await connection.execute<ResultSetHeader>(`
        INSERT INTO wa_proactive_messages
        (phone, patient_id, message_type, template, variables, scheduled_at, related_appointment_id)
        VALUES (?, ?, 'appointment_reminder_24h', ?, ?, ?, ?)
      `, [
        phone,
        patientId,
        MESSAGE_TEMPLATES.appointment_reminder_24h,
        JSON.stringify(variables),
        reminder24h,
        appointmentId
      ]);

      // Programar recordatorio de 2h (solo si la cita es en más de 2h)
      if (reminder2h > new Date()) {
        await connection.execute<ResultSetHeader>(`
          INSERT INTO wa_proactive_messages
          (phone, patient_id, message_type, template, variables, scheduled_at, related_appointment_id)
          VALUES (?, ?, 'appointment_reminder_2h', ?, ?, ?, ?)
        `, [
          phone,
          patientId,
          MESSAGE_TEMPLATES.appointment_reminder_2h,
          JSON.stringify(variables),
          reminder2h,
          appointmentId
        ]);
      }

      logger.info({ appointmentId, phone }, 'Appointment reminders scheduled');
      return result1.insertId;
    } finally {
      connection.release();
    }
  }

  /**
   * Programar seguimiento post-cita
   */
  async scheduleFollowup(
    appointmentId: number,
    phone: string,
    patientId: number,
    variables: Record<string, string>,
    appointmentDate: Date
  ): Promise<number> {
    // Followup 24h después de la cita
    const followupDate = new Date(appointmentDate);
    followupDate.setHours(followupDate.getHours() + 24);

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO wa_proactive_messages
        (phone, patient_id, message_type, template, variables, scheduled_at, related_appointment_id)
        VALUES (?, ?, 'appointment_followup', ?, ?, ?, ?)
      `, [
        phone,
        patientId,
        MESSAGE_TEMPLATES.appointment_followup,
        JSON.stringify(variables),
        followupDate,
        appointmentId
      ]);

      logger.info({ appointmentId, phone }, 'Followup scheduled');
      return result.insertId;
    } finally {
      connection.release();
    }
  }

  /**
   * Notificar disponibilidad de lista de espera
   */
  async notifyWaitingListAvailability(
    waitingListId: number,
    phone: string,
    patientId: number,
    variables: Record<string, string>
  ): Promise<number> {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO wa_proactive_messages
        (phone, patient_id, message_type, template, variables, scheduled_at, metadata)
        VALUES (?, ?, 'waiting_list_available', ?, ?, NOW(), ?)
      `, [
        phone,
        patientId,
        MESSAGE_TEMPLATES.waiting_list_available,
        JSON.stringify(variables),
        JSON.stringify({ waiting_list_id: waitingListId })
      ]);

      logger.info({ waitingListId, phone }, 'Waiting list notification scheduled');
      return result.insertId;
    } finally {
      connection.release();
    }
  }

  /**
   * Enviar confirmación de cita inmediata
   */
  async sendAppointmentConfirmation(
    appointmentId: number,
    phone: string,
    patientId: number,
    variables: Record<string, string>
  ): Promise<boolean> {
    const renderedMessage = this.renderTemplate(
      MESSAGE_TEMPLATES.appointment_confirmation,
      variables
    );

    if (!isWhatsAppAvailable()) {
      logger.warn({ phone }, 'WhatsApp not connected, queuing confirmation');
      // Programar para envío inmediato
      const connection = await pool.getConnection();
      try {
        await connection.execute(`
          INSERT INTO wa_proactive_messages
          (phone, patient_id, message_type, template, variables, scheduled_at, related_appointment_id)
          VALUES (?, ?, 'appointment_confirmation', ?, ?, NOW(), ?)
        `, [
          phone,
          patientId,
          MESSAGE_TEMPLATES.appointment_confirmation,
          JSON.stringify(variables),
          appointmentId
        ]);
      } finally {
        connection.release();
      }
      return false;
    }

    const result = await sendWhatsAppText(phone, renderedMessage);
    
    if (result.success) {
      logger.info({ appointmentId, phone }, 'Appointment confirmation sent');
    }
    
    return result.success;
  }

  /**
   * Programar campaña de salud
   */
  async scheduleHealthCampaign(
    patientIds: number[],
    campaignName: string,
    campaignDescription: string,
    campaignEndDate: Date,
    location: string
  ): Promise<number> {
    const connection = await pool.getConnection();
    let scheduledCount = 0;

    try {
      // Obtener datos de pacientes (IN clause con placeholders dinámicos para mysql2)
      const placeholders = patientIds.map(() => '?').join(',');
      const [patients] = await connection.query<RowDataPacket[]>(
        `SELECT id, name, phone FROM patients WHERE id IN (${placeholders})`,
        patientIds
      );

      for (const patient of patients) {
        if (!patient.phone) continue;

        const variables = {
          patient_name: patient.name.split(' ')[0], // Primer nombre
          campaign_name: campaignName,
          campaign_description: campaignDescription,
          campaign_end_date: campaignEndDate.toLocaleDateString('es-CO'),
          location
        };

        await connection.execute(`
          INSERT INTO wa_proactive_messages
          (phone, patient_id, message_type, template, variables, scheduled_at)
          VALUES (?, ?, 'health_campaign', ?, ?, NOW())
        `, [
          patient.phone,
          patient.id,
          MESSAGE_TEMPLATES.health_campaign,
          JSON.stringify(variables)
        ]);

        scheduledCount++;
      }

      logger.info({ 
        campaignName, 
        scheduledCount, 
        totalPatients: patientIds.length 
      }, 'Health campaign scheduled');

      return scheduledCount;
    } finally {
      connection.release();
    }
  }

  /**
   * Cancelar mensajes programados para una cita
   */
  async cancelAppointmentMessages(appointmentId: number): Promise<number> {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(`
        UPDATE wa_proactive_messages
        SET status = 'cancelled'
        WHERE related_appointment_id = ? AND status = 'pending'
      `, [appointmentId]);

      logger.info({ appointmentId, cancelled: result.affectedRows }, 'Appointment messages cancelled');
      return result.affectedRows;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener estadísticas del servicio
   */
  async getStats(): Promise<{
    pending: number;
    sent24h: number;
    failed24h: number;
    byType: Record<string, number>;
  }> {
    const connection = await pool.getConnection();
    try {
      const [pending] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as count FROM wa_proactive_messages WHERE status = 'pending'
      `);

      const [sent24h] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as count FROM wa_proactive_messages 
        WHERE status = 'sent' AND sent_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      const [failed24h] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as count FROM wa_proactive_messages 
        WHERE status = 'failed' AND updated_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      const [byType] = await connection.execute<RowDataPacket[]>(`
        SELECT message_type, COUNT(*) as count 
        FROM wa_proactive_messages 
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY message_type
      `);

      const typeStats: Record<string, number> = {};
      for (const row of byType) {
        typeStats[row.message_type] = row.count;
      }

      return {
        pending: pending[0]?.count || 0,
        sent24h: sent24h[0]?.count || 0,
        failed24h: failed24h[0]?.count || 0,
        byType: typeStats
      };
    } finally {
      connection.release();
    }
  }
}

// Singleton instance
export const proactiveService = new WhatsAppProactiveService();
export default proactiveService;
