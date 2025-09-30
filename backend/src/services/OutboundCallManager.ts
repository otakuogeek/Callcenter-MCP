import { z } from 'zod';
import mysql from 'mysql2/promise';
import Redis from 'ioredis';
import axios from 'axios';
import { format, addDays, addHours, isBefore, isAfter } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Schemas de validación
export const CampaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['appointment_reminder', 'post_consultation', 'satisfaction_survey', 'emergency_notification', 'medication_reminder']),
  script_template: z.string().min(1),
  max_attempts: z.number().int().min(1).max(10).default(3),
  retry_interval: z.number().int().min(300).default(3600), // mínimo 5 minutos
  priority: z.number().int().min(1).max(10).default(1),
  status: z.enum(['active', 'paused', 'completed']).default('active')
});

export const OutboundCallSchema = z.object({
  campaign_id: z.number().int(),
  patient_id: z.number().int(),
  phone_number: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  scheduled_at: z.date(),
  variables: z.record(z.string()).optional(),
  max_attempts: z.number().int().min(1).max(10).default(3),
  notes: z.string().optional()
});

// Interfaces
export interface Campaign {
  id: number;
  name: string;
  type: string;
  status: string;
  script_template: string;
  max_attempts: number;
  retry_interval: number;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export interface OutboundCall {
  id: number;
  campaign_id: number;
  patient_id: number;
  phone_number: string;
  scheduled_at: Date;
  attempted_at?: Date;
  completed_at?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'retry' | 'cancelled';
  attempts: number;
  max_attempts: number;
  call_duration: number;
  response_data?: any;
  notes?: string;
  variables?: Record<string, string>;
}

export interface CampaignStats {
  total_calls: number;
  completed: number;
  failed: number;
  pending: number;
  in_progress: number;
  cancelled: number;
  success_rate: number;
  average_duration: number;
  conversion_rate: number;
}

export class OutboundCallManager {
  private db: mysql.Connection;
  private redis: Redis;
  private zadarmaApiKey: string;
  private zadarmaSecret: string;
  private callerIdInternational: string;
  private maxConcurrentCalls: number;
  private timezone: string;
  private operatingHours: { start: number; end: number };
  private rateLimit: number; // llamadas por minuto
  private cooldownPeriod: number; // segundos entre llamadas al mismo número

  constructor(config: {
    db: mysql.Connection;
    redis: Redis;
    zadarmaApiKey: string;
    zadarmaSecret: string;
    callerIdInternational: string;
    maxConcurrentCalls?: number;
    timezone?: string;
    operatingHours?: { start: number; end: number };
    rateLimit?: number;
    cooldownPeriod?: number;
  }) {
    this.db = config.db;
    this.redis = config.redis;
    this.zadarmaApiKey = config.zadarmaApiKey;
    this.zadarmaSecret = config.zadarmaSecret;
    this.callerIdInternational = config.callerIdInternational;
    this.maxConcurrentCalls = config.maxConcurrentCalls || 5;
    this.timezone = config.timezone || 'America/Bogota';
    this.operatingHours = config.operatingHours || { start: 8, end: 18 };
    this.rateLimit = config.rateLimit || 10;
    this.cooldownPeriod = config.cooldownPeriod || 30;
  }

  // ==================== CAMPAÑAS ====================

  async createCampaign(data: z.infer<typeof CampaignSchema>): Promise<number> {
    const validated = CampaignSchema.parse(data);
    
    const [result] = await this.db.execute(
      `INSERT INTO outbound_campaigns (name, type, script_template, max_attempts, retry_interval, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.name,
        validated.type,
        validated.script_template,
        validated.max_attempts,
        validated.retry_interval,
        validated.priority,
        validated.status
      ]
    );

    const campaignId = (result as mysql.ResultSetHeader).insertId;
    
    // Log actividad
    await this.logActivity('campaign_created', { 
      campaign_id: campaignId, 
      name: validated.name, 
      type: validated.type 
    });

    return campaignId;
  }

  async updateCampaignStatus(campaignId: number, status: 'active' | 'paused' | 'completed'): Promise<void> {
    await this.db.execute(
      'UPDATE outbound_campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, campaignId]
    );

    await this.logActivity('campaign_status_changed', { 
      campaign_id: campaignId, 
      new_status: status 
    });
  }

  async getCampaign(campaignId: number): Promise<Campaign | null> {
    const [rows] = await this.db.execute(
      'SELECT * FROM outbound_campaigns WHERE id = ?',
      [campaignId]
    );

    const campaigns = rows as Campaign[];
    return campaigns.length > 0 ? campaigns[0] : null;
  }

  async getCampaigns(): Promise<Campaign[]> {
    const [rows] = await this.db.execute(
      'SELECT * FROM outbound_campaigns ORDER BY created_at DESC'
    );

    return rows as Campaign[];
  }

  async getCampaignStats(campaignId: number): Promise<CampaignStats> {
    const [rows] = await this.db.execute(
      `SELECT 
         COUNT(*) as total_calls,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
         AVG(CASE WHEN status = 'completed' THEN call_duration ELSE NULL END) as average_duration
       FROM outbound_calls 
       WHERE campaign_id = ?`,
      [campaignId]
    );

    const stats = (rows as any[])[0];
    const successRate = stats.total_calls > 0 ? (stats.completed / stats.total_calls) * 100 : 0;
    const conversionRate = await this.calculateConversionRate(campaignId);

    return {
      total_calls: stats.total_calls || 0,
      completed: stats.completed || 0,
      failed: stats.failed || 0,
      pending: stats.pending || 0,
      in_progress: stats.in_progress || 0,
      cancelled: stats.cancelled || 0,
      success_rate: Math.round(successRate * 100) / 100,
      average_duration: Math.round(stats.average_duration || 0),
      conversion_rate: conversionRate
    };
  }

  // ==================== LLAMADAS SALIENTES ====================

  async scheduleCall(data: z.infer<typeof OutboundCallSchema>): Promise<number> {
    const validated = OutboundCallSchema.parse(data);

    // Verificar si la campaña está activa
    const campaign = await this.getCampaign(validated.campaign_id);
    if (!campaign || campaign.status !== 'active') {
      throw new Error('Campaign is not active or does not exist');
    }

    // Verificar horarios de operación
    if (!this.isWithinOperatingHours(validated.scheduled_at)) {
      validated.scheduled_at = this.adjustToOperatingHours(validated.scheduled_at);
    }

    // Verificar cooldown period
    await this.checkCooldownPeriod(validated.phone_number);

    const [result] = await this.db.execute(
      `INSERT INTO outbound_calls 
       (campaign_id, patient_id, phone_number, scheduled_at, max_attempts, notes, variables)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.campaign_id,
        validated.patient_id,
        validated.phone_number,
        validated.scheduled_at,
        validated.max_attempts,
        validated.notes || null,
        validated.variables ? JSON.stringify(validated.variables) : null
      ]
    );

    const callId = (result as mysql.ResultSetHeader).insertId;

    // Programar en Redis para procesamiento
    await this.scheduleCallInQueue(callId, validated.scheduled_at);

    await this.logActivity('call_scheduled', {
      call_id: callId,
      campaign_id: validated.campaign_id,
      phone_number: validated.phone_number,
      scheduled_at: validated.scheduled_at
    });

    return callId;
  }

  async processScheduledCalls(): Promise<void> {
    const now = new Date();
    
    // Verificar horarios de operación
    if (!this.isWithinOperatingHours(now)) {
      console.log('Outside operating hours, skipping call processing');
      return;
    }

    // Verificar límite de llamadas concurrentes
    const activeCalls = await this.getActiveCalls();
    if (activeCalls >= this.maxConcurrentCalls) {
      console.log(`Maximum concurrent calls reached (${this.maxConcurrentCalls}), skipping`);
      return;
    }

    // Obtener llamadas programadas para procesar
    const [rows] = await this.db.execute(
      `SELECT oc.*, c.script_template, c.type 
       FROM outbound_calls oc 
       JOIN outbound_campaigns c ON oc.campaign_id = c.id
       WHERE oc.status = 'scheduled' 
         AND oc.scheduled_at <= NOW()
         AND c.status = 'active'
       ORDER BY c.priority DESC, oc.scheduled_at ASC
       LIMIT ?`,
      [this.maxConcurrentCalls - activeCalls]
    );

    const calls = rows as (OutboundCall & { script_template: string; type: string })[];

    for (const call of calls) {
      await this.initiateCall(call);
    }
  }

  private async initiateCall(call: OutboundCall & { script_template: string; type: string }): Promise<void> {
    try {
      // Marcar como en progreso
      await this.updateCallStatus(call.id, 'in_progress');

      // Verificar rate limiting
      await this.checkRateLimit();

      // Preparar script personalizado
      const script = this.personalizeScript(call.script_template, call.variables || {});

      // Hacer la llamada a través de Zadarma
      const callResult = await this.makeZadarmaCall(call.phone_number, script);

      if (callResult.success) {
        await this.updateCallStatus(call.id, 'completed', {
          call_duration: callResult.duration,
          response_data: callResult.response
        });

        // Registrar resultado en campaign_results
        await this.recordCampaignResult(call.campaign_id, call.id, callResult.result_type, callResult.response);

      } else {
        await this.handleFailedCall(call);
      }

    } catch (error) {
      console.error(`Error initiating call ${call.id}:`, error);
      await this.handleFailedCall(call);
    }
  }

  private async makeZadarmaCall(phoneNumber: string, script: string): Promise<any> {
    try {
      // Simular llamada a Zadarma API
      // En implementación real, usar la API de Zadarma para iniciar llamada
      
      const response = await axios.post('https://api.zadarma.com/v1/request/callback/', {
        from: this.callerIdInternational,
        to: phoneNumber,
        predicted: true,
        caller_id: this.callerIdInternational
      }, {
        headers: {
          'Authorization': `Bearer ${this.zadarmaApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // Simular procesamiento de la llamada y respuesta del paciente
      // En implementación real, esto se manejaría a través de webhooks de Zadarma
      
      return {
        success: true,
        duration: Math.floor(Math.random() * 120) + 30, // 30-150 segundos
        response: { 
          answered: true, 
          user_input: '1', // simulación
          satisfaction_score: 4 
        },
        result_type: 'confirmed'
      };

    } catch (error) {
      console.error('Zadarma API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handleFailedCall(call: OutboundCall): Promise<void> {
    const newAttempts = call.attempts + 1;

    if (newAttempts >= call.max_attempts) {
      await this.updateCallStatus(call.id, 'failed');
      await this.logActivity('call_failed_max_attempts', {
        call_id: call.id,
        attempts: newAttempts
      });
    } else {
      // Programar reintento
      const campaign = await this.getCampaign(call.campaign_id);
      const retryTime = new Date(Date.now() + (campaign?.retry_interval || 3600) * 1000);
      
      await this.db.execute(
        'UPDATE outbound_calls SET status = ?, attempts = ?, scheduled_at = ? WHERE id = ?',
        ['retry', newAttempts, retryTime, call.id]
      );

      await this.scheduleCallInQueue(call.id, retryTime);
      
      await this.logActivity('call_retry_scheduled', {
        call_id: call.id,
        attempt: newAttempts,
        retry_at: retryTime
      });
    }
  }

  // ==================== CAMPAÑAS AUTOMÁTICAS ====================

  async scheduleAppointmentReminders(): Promise<void> {
    // Obtener citas del próximo día
    const tomorrow = addDays(new Date(), 1);
    
    const [rows] = await this.db.execute(
      `SELECT a.*, p.phone, p.first_name, p.last_name, d.first_name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id  
       WHERE DATE(a.appointment_date) = DATE(?)
         AND a.status IN ('scheduled', 'confirmed')
         AND p.phone IS NOT NULL
         AND p.phone != ''`,
      [format(tomorrow, 'yyyy-MM-dd')]
    );

    const appointments = rows as any[];

    // Obtener o crear campaña de recordatorios
    let campaign = await this.getCampaignByType('appointment_reminder');
    if (!campaign) {
      const campaignId = await this.createCampaign({
        name: 'Recordatorios de Citas Automáticos',
        type: 'appointment_reminder',
        status: 'active',
        script_template: `Hola {patient_name}, soy Valeria de Biosanarcall.
Le recordamos que tiene una cita médica programada para mañana {date} a las {time} con el Dr. {doctor_name}.

Para confirmar su cita, presione 1.
Para reprogramar, presione 2. 
Para cancelar, presione 3.

Si no puede atender ahora, también puede confirmar por WhatsApp.
Gracias y que tenga un buen día.`,
        max_attempts: 2,
        retry_interval: 7200, // 2 horas
        priority: 5
      });
      campaign = await this.getCampaign(campaignId);
    }

    if (!campaign) return;

    // Programar llamadas para las citas
    for (const appointment of appointments) {
      const reminderTime = addHours(new Date(), 1); // 1 hora desde ahora
      
      await this.scheduleCall({
        campaign_id: campaign.id,
        patient_id: appointment.patient_id,
        phone_number: appointment.phone,
        max_attempts: 2,
        scheduled_at: reminderTime,
        variables: {
          patient_name: `${appointment.first_name} ${appointment.last_name}`,
          date: format(new Date(appointment.appointment_date), 'dd \'de\' MMMM'),
          time: format(new Date(appointment.appointment_date), 'HH:mm'),
          doctor_name: appointment.doctor_name
        }
      });
    }

    console.log(`Scheduled ${appointments.length} appointment reminder calls`);
  }

  async schedulePostConsultationFollowups(): Promise<void> {
    // Obtener consultas de hace 2-3 días
    const startDate = addDays(new Date(), -3);
    const endDate = addDays(new Date(), -2);

    const [rows] = await this.db.execute(
      `SELECT a.*, p.phone, p.first_name, p.last_name, d.first_name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE DATE(a.appointment_date) BETWEEN ? AND ?
         AND a.status = 'completed'
         AND p.phone IS NOT NULL
         AND p.phone != ''
         AND NOT EXISTS (
           SELECT 1 FROM outbound_calls oc 
           JOIN outbound_campaigns c ON oc.campaign_id = c.id
           WHERE oc.patient_id = p.id 
             AND c.type = 'post_consultation'
             AND oc.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         )`,
      [format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')]
    );

    const consultations = rows as any[];

    // Obtener o crear campaña de seguimiento
    let campaign = await this.getCampaignByType('post_consultation');
    if (!campaign) {
      const campaignId = await this.createCampaign({
        name: 'Seguimiento Post-Consulta',
        type: 'post_consultation',
        status: 'active',
        script_template: `Hola {patient_name}, soy Valeria de Biosanarcall.
Espero se encuentre bien. Le llamo para hacer seguimiento a su consulta del {consultation_date} con el Dr. {doctor_name}.

¿Cómo se ha sentido después del tratamiento?
¿Ha seguido las indicaciones del doctor?
¿Ha presentado algún síntoma nuevo?

Para responder Sí, presione 1. Para No, presione 2.
Si necesita una nueva cita, presione 3.`,
        max_attempts: 2,
        retry_interval: 86400, // 24 horas
        priority: 3
      });
      campaign = await this.getCampaign(campaignId);
    }

    if (!campaign) return;

    for (const consultation of consultations) {
      const followupTime = addHours(new Date(), 2);
      
      await this.scheduleCall({
        campaign_id: campaign.id,
        patient_id: consultation.patient_id,
        phone_number: consultation.phone,
        max_attempts: 2,
        scheduled_at: followupTime,
        variables: {
          patient_name: `${consultation.first_name} ${consultation.last_name}`,
          consultation_date: format(new Date(consultation.appointment_date), 'dd \'de\' MMMM'),
          doctor_name: consultation.doctor_name
        }
      });
    }

    console.log(`Scheduled ${consultations.length} post-consultation followup calls`);
  }

  // ==================== UTILIDADES ====================

  private personalizeScript(template: string, variables: Record<string, string>): string {
    let script = template;
    for (const [key, value] of Object.entries(variables)) {
      script = script.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return script;
  }

  private isWithinOperatingHours(date: Date): boolean {
    const zonedDate = toZonedTime(date, this.timezone);
    const hour = zonedDate.getHours();
    const dayOfWeek = zonedDate.getDay();
    
    // No operar domingos (0) ni después de horario
    if (dayOfWeek === 0) return false;
    
    return hour >= this.operatingHours.start && hour < this.operatingHours.end;
  }

  private adjustToOperatingHours(date: Date): Date {
    const zonedDate = toZonedTime(date, this.timezone);
    const hour = zonedDate.getHours();
    
    if (hour < this.operatingHours.start) {
      zonedDate.setHours(this.operatingHours.start, 0, 0, 0);
    } else if (hour >= this.operatingHours.end) {
      zonedDate.setDate(zonedDate.getDate() + 1);
      zonedDate.setHours(this.operatingHours.start, 0, 0, 0);
    }
    
    // Si es domingo, mover al lunes
    if (zonedDate.getDay() === 0) {
      zonedDate.setDate(zonedDate.getDate() + 1);
    }
    
    return zonedDate;
  }

  private async checkCooldownPeriod(phoneNumber: string): Promise<void> {
    const lastCall = await this.redis.get(`last_call:${phoneNumber}`);
    if (lastCall) {
      const timeSinceLastCall = Date.now() - parseInt(lastCall);
      if (timeSinceLastCall < this.cooldownPeriod * 1000) {
        throw new Error(`Cooldown period not met for ${phoneNumber}`);
      }
    }
  }

  private async checkRateLimit(): Promise<void> {
    const currentMinute = Math.floor(Date.now() / 60000);
    const key = `rate_limit:${currentMinute}`;
    
    const currentCount = await this.redis.incr(key);
    await this.redis.expire(key, 60);
    
    if (currentCount > this.rateLimit) {
      throw new Error('Rate limit exceeded');
    }
  }

  private async scheduleCallInQueue(callId: number, scheduledAt: Date): Promise<void> {
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    await this.redis.zadd('scheduled_calls', Date.now() + delay, callId.toString());
  }

  private async updateCallStatus(
    callId: number, 
    status: OutboundCall['status'], 
    data?: { call_duration?: number; response_data?: any }
  ): Promise<void> {
    const updateFields = ['status = ?'];
    const updateValues: any[] = [status];

    if (status === 'in_progress') {
      updateFields.push('attempted_at = CURRENT_TIMESTAMP', 'attempts = attempts + 1');
    } else if (status === 'completed') {
      updateFields.push('completed_at = CURRENT_TIMESTAMP');
      if (data?.call_duration) {
        updateFields.push('call_duration = ?');
        updateValues.push(data.call_duration);
      }
      if (data?.response_data) {
        updateFields.push('response_data = ?');
        updateValues.push(JSON.stringify(data.response_data));
      }
    }

    updateValues.push(callId);

    await this.db.execute(
      `UPDATE outbound_calls SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    );
  }

  private async getActiveCalls(): Promise<number> {
    const [rows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM outbound_calls WHERE status = ?',
      ['in_progress']
    );
    return (rows as any[])[0].count;
  }

  private async getCampaignByType(type: string): Promise<Campaign | null> {
    const [rows] = await this.db.execute(
      'SELECT * FROM outbound_campaigns WHERE type = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
      [type, 'active']
    );
    const campaigns = rows as Campaign[];
    return campaigns.length > 0 ? campaigns[0] : null;
  }

  private async calculateConversionRate(campaignId: number): Promise<number> {
    const [rows] = await this.db.execute(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN result_type IN ('confirmed', 'completed_survey') THEN 1 ELSE 0 END) as converted
       FROM campaign_results 
       WHERE campaign_id = ?`,
      [campaignId]
    );

    const stats = (rows as any[])[0];
    return stats.total > 0 ? Math.round((stats.converted / stats.total) * 100 * 100) / 100 : 0;
  }

  private async recordCampaignResult(
    campaignId: number, 
    callId: number, 
    resultType: string, 
    resultData: any
  ): Promise<void> {
    await this.db.execute(
      'INSERT INTO campaign_results (campaign_id, call_id, result_type, result_data) VALUES (?, ?, ?, ?)',
      [campaignId, callId, resultType, JSON.stringify(resultData)]
    );
  }

  private async logActivity(action: string, data: any): Promise<void> {
    console.log(`[OutboundCallManager] ${action}:`, data);
    
    // Opcional: guardar en tabla de logs
    try {
      await this.db.execute(
        'INSERT INTO activity_logs (action, data, created_at) VALUES (?, ?, NOW())',
        [action, JSON.stringify(data)]
      );
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to log activity:', error);
    }
  }

  // ==================== REPORTES Y ANÁLISIS ====================

  async generateDailyReport(date: Date = new Date()): Promise<any> {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const [callStats] = await this.db.execute(
      `SELECT 
         c.type,
         COUNT(*) as total_calls,
         SUM(CASE WHEN oc.status = 'completed' THEN 1 ELSE 0 END) as completed,
         AVG(CASE WHEN oc.status = 'completed' THEN oc.call_duration ELSE NULL END) as avg_duration
       FROM outbound_calls oc
       JOIN outbound_campaigns c ON oc.campaign_id = c.id
       WHERE DATE(oc.scheduled_at) = ?
       GROUP BY c.type`,
      [dateStr]
    );

    const [resultStats] = await this.db.execute(
      `SELECT 
         cr.result_type,
         COUNT(*) as count
       FROM campaign_results cr
       JOIN outbound_calls oc ON cr.call_id = oc.id
       WHERE DATE(oc.scheduled_at) = ?
       GROUP BY cr.result_type`,
      [dateStr]
    );

    return {
      date: dateStr,
      call_statistics: callStats,
      result_statistics: resultStats,
      generated_at: new Date()
    };
  }

  async getTopPerformingCampaigns(limit: number = 10): Promise<any[]> {
    const [rows] = await this.db.execute(
      `SELECT 
         c.id,
         c.name,
         c.type,
         COUNT(oc.id) as total_calls,
         SUM(CASE WHEN oc.status = 'completed' THEN 1 ELSE 0 END) as completed_calls,
         AVG(CASE WHEN oc.status = 'completed' THEN oc.call_duration ELSE NULL END) as avg_duration,
         (SUM(CASE WHEN oc.status = 'completed' THEN 1 ELSE 0 END) / COUNT(oc.id)) * 100 as success_rate
       FROM outbound_campaigns c
       LEFT JOIN outbound_calls oc ON c.id = oc.campaign_id
       WHERE c.status = 'active'
       GROUP BY c.id, c.name, c.type
       HAVING total_calls > 0
       ORDER BY success_rate DESC, total_calls DESC
       LIMIT ?`,
      [limit]
    );

    return rows as any[];
  }
}

export default OutboundCallManager;