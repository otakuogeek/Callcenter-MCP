import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface CallData {
  id: number;
  conversation_id: string;
  patient_name: string;
  patient_phone?: string;
  agent_name: string;
  call_type: 'Consulta General' | 'Urgencia' | 'Seguimiento' | 'Información';
  status: 'active' | 'waiting' | 'ended';
  priority: 'Normal' | 'Alta' | 'Baja' | 'Urgencia';
  start_time: Date;
  end_time?: Date;
  duration?: number;
  transcript?: string;
  audio_url?: string;
  created_at: Date;
  updated_at: Date;
}

export class CallManagerService {
  
  /**
   * Crear una nueva llamada cuando llega el webhook de inicio
   */
  static async createCall(webhookData: any): Promise<number | null> {
    try {
      const conversationId = webhookData.conversation_id || `call_${Date.now()}`;
      const agentId = webhookData.agent_id || 'unknown';
      
      // Extraer información del paciente si está disponible
      const clientData = webhookData.conversation_initiation_client_data || {};
      const dynamicVars = clientData.dynamic_variables || {};
      
      const patientName = dynamicVars.user_name || dynamicVars.patient_name || 'Paciente Desconocido';
      const patientPhone = dynamicVars.phone || dynamicVars.patient_phone || null;
      const callType = this.determineCallType(webhookData);
      const priority = this.determinePriority(webhookData);
      
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO calls 
         (conversation_id, patient_name, patient_phone, agent_name, call_type, status, priority, start_time, webhook_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), ?, NOW(), NOW())`,
        [
          conversationId,
          patientName,
          patientPhone,
          `Dr. ${agentId}`,
          callType,
          priority,
          JSON.stringify(webhookData)
        ]
      );
      // Registrar evento started
      await pool.execute(
        `INSERT INTO call_events (call_id, conversation_id, event_type, agent_name, meta) VALUES (?,?,?,?,?)`,
        [result.insertId, conversationId, 'started', `Dr. ${agentId}`, JSON.stringify({ priority, callType })]
      );
      
      console.log(`📞 Nueva llamada creada: ID ${result.insertId}, Conversación: ${conversationId}`);
      return result.insertId;
      
    } catch (error) {
      console.error('❌ Error creating call:', error);
      return null;
    }
  }

  /**
   * Finalizar una llamada cuando llega el webhook de fin
   */
  static async endCall(webhookData: any): Promise<boolean> {
    try {
      const conversationId = webhookData.conversation_id;
      if (!conversationId) {
        console.error('❌ No conversation_id provided for end call');
        return false;
      }

      // Calcular duración
      const duration = webhookData.duration || this.calculateDurationFromWebhook(webhookData);
      const transcript = webhookData.transcript || null;
      const audioUrl = webhookData.audio_url || webhookData.full_audio || null;

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE calls 
         SET status = 'ended', end_time = NOW(), duration = ?, transcript = ?, audio_url = ?, 
             webhook_data_end = ?, updated_at = NOW()
         WHERE conversation_id = ? AND status = 'active'`,
        [
          duration,
          transcript,
          audioUrl,
          JSON.stringify(webhookData),
          conversationId
        ]
      );

      if (result.affectedRows > 0) {
        console.log(`📵 Llamada finalizada: Conversación ${conversationId}, Duración: ${duration}s`);
        // Registrar evento ended (intentamos obtener id)
        const [rows] = await pool.execute<RowDataPacket[]>(`SELECT id, agent_name FROM calls WHERE conversation_id=?`, [conversationId]);
        const callRow = rows[0];
        await pool.execute(
          `INSERT INTO call_events (call_id, conversation_id, event_type, agent_name, meta) VALUES (?,?,?,?,?)`,
          [callRow?.id || null, conversationId, 'ended', callRow?.agent_name || null, JSON.stringify({ duration })]
        );
        return true;
      } else {
        console.warn(`⚠️ No se encontró llamada activa para conversación: ${conversationId}`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error ending call:', error);
      return false;
    }
  }

  /**
   * Obtener llamadas activas
   */
  static async getActiveCalls(): Promise<CallData[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT *, 
                TIMESTAMPDIFF(SECOND, start_time, NOW()) as current_duration
         FROM calls 
         WHERE status = 'active' 
         ORDER BY start_time ASC`
      );
      
      return rows.map(row => ({
        ...row,
        duration: row.current_duration
      })) as CallData[];
      
    } catch (error) {
      console.error('❌ Error getting active calls:', error);
      return [];
    }
  }

  /**
   * Obtener llamadas en cola de espera
   */
  static async getWaitingCalls(): Promise<CallData[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT *, 
                TIMESTAMPDIFF(SECOND, created_at, NOW()) as waiting_time
         FROM calls 
         WHERE status = 'waiting' 
         ORDER BY priority DESC, created_at ASC`
      );
      
      return rows.map(row => ({
        ...row,
        duration: row.waiting_time
      })) as CallData[];
      
    } catch (error) {
      console.error('❌ Error getting waiting calls:', error);
      return [];
    }
  }

  /**
   * Obtener estadísticas de llamadas
   */
  static async getCallStats(hours: number = 24): Promise<{
    active: number;
    waiting: number;
    completed_today: number;
    total_duration: number;
    avg_duration: number;
  }> {
    try {
      const [activeRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM calls WHERE status = 'active'`
      );
      
      const [waitingRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM calls WHERE status = 'waiting'`
      );
      
      const [completedRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count, SUM(duration) as total_duration, AVG(duration) as avg_duration
         FROM calls 
         WHERE status = 'ended' AND start_time >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [hours]
      );

      return {
        active: activeRows[0]?.count || 0,
        waiting: waitingRows[0]?.count || 0,
        completed_today: completedRows[0]?.count || 0,
        total_duration: completedRows[0]?.total_duration || 0,
        avg_duration: completedRows[0]?.avg_duration || 0
      };
      
    } catch (error) {
      console.error('❌ Error getting call stats:', error);
      return {
        active: 0,
        waiting: 0,
        completed_today: 0,
        total_duration: 0,
        avg_duration: 0
      };
    }
  }

  /**
   * Transferir una llamada a otro agente
   */
  static async transferCall(callId: number, newAgent: string): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE calls SET agent_name = ?, updated_at = NOW() WHERE id = ?`,
        [newAgent, callId]
      );
      
      if (result.affectedRows > 0) {
        const [rows] = await pool.execute<RowDataPacket[]>(`SELECT conversation_id FROM calls WHERE id=?`, [callId]);
        const conv = rows[0]?.conversation_id;
        await pool.execute(
          `INSERT INTO call_events (call_id, conversation_id, event_type, agent_name) VALUES (?,?, 'transfer', ?)`,
          [callId, conv, newAgent]
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error transferring call:', error);
      return false;
    }
  }

  /**
   * Mover llamada a cola de espera
   */
  static async moveToWaiting(callId: number): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE calls SET status = 'waiting', updated_at = NOW() WHERE id = ?`,
        [callId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error moving call to waiting:', error);
      return false;
    }
  }

  /**
   * Atender llamada desde cola de espera
   */
  static async attendCall(callId: number, agentName: string): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE calls 
         SET status = 'active', agent_name = ?, start_time = NOW(), updated_at = NOW() 
         WHERE id = ? AND status = 'waiting'`,
        [agentName, callId]
      );
      
      if (result.affectedRows > 0) {
        const [rows] = await pool.execute<RowDataPacket[]>(`SELECT conversation_id FROM calls WHERE id=?`, [callId]);
        const conv = rows[0]?.conversation_id;
        await pool.execute(
          `INSERT INTO call_events (call_id, conversation_id, event_type, agent_name) VALUES (?,?, 'attend', ?)`,
          [callId, conv, agentName]
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error attending call:', error);
      return false;
    }
  }

  /**
   * Poner llamada en espera
   */
  static async holdCall(callId: number): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE calls 
         SET status = 'waiting', updated_at = NOW() 
         WHERE id = ? AND status = 'active'`,
        [callId]
      );
      
      if (result.affectedRows > 0) {
        const [rows] = await pool.execute<RowDataPacket[]>(`SELECT conversation_id, agent_name FROM calls WHERE id=?`, [callId]);
        const conv = rows[0]?.conversation_id;
        const agent = rows[0]?.agent_name;
        await pool.execute(
          `INSERT INTO call_events (call_id, conversation_id, event_type, agent_name) VALUES (?,?, 'hold', ?)`,
          [callId, conv, agent]
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error holding call:', error);
      return false;
    }
  }

  // Métodos auxiliares privados
  private static determineCallType(webhookData: any): string {
    const clientData = webhookData.conversation_initiation_client_data || {};
    const dynamicVars = clientData.dynamic_variables || {};
    
    if (dynamicVars.call_type) {
      return dynamicVars.call_type;
    }
    
    // Intentar determinar por keywords en el mensaje inicial
    const initialMessage = webhookData.initial_message || '';
    if (initialMessage.toLowerCase().includes('urgencia') || initialMessage.toLowerCase().includes('emergencia')) {
      return 'Urgencia';
    } else if (initialMessage.toLowerCase().includes('seguimiento') || initialMessage.toLowerCase().includes('control')) {
      return 'Seguimiento';
    } else if (initialMessage.toLowerCase().includes('información') || initialMessage.toLowerCase().includes('consulta')) {
      return 'Información';
    }
    
    return 'Consulta General';
  }

  private static determinePriority(webhookData: any): string {
    const clientData = webhookData.conversation_initiation_client_data || {};
    const dynamicVars = clientData.dynamic_variables || {};
    
    if (dynamicVars.priority) {
      return dynamicVars.priority;
    }
    
    const callType = this.determineCallType(webhookData);
    switch (callType) {
      case 'Urgencia':
        return 'Urgencia';
      case 'Seguimiento':
        return 'Alta';
      case 'Información':
        return 'Baja';
      default:
        return 'Normal';
    }
  }

  private static calculateDurationFromWebhook(webhookData: any): number {
    // Si no viene la duración, intentar calcularla desde timestamps
    const startTime = webhookData.start_time || webhookData.created_at;
    const endTime = webhookData.end_time || Date.now();
    
    if (startTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      return Math.floor((end - start) / 1000);
    }
    
    return 0;
  }

  /**
   * Calcular duración desde datos de la fila de base de datos
   */
  private static calculateDurationFromRow(row: any): number {
    if (row.start_time && row.end_time) {
      const start = new Date(row.start_time).getTime();
      const end = new Date(row.end_time).getTime();
      return Math.floor((end - start) / 1000);
    } else if (row.start_time) {
      // Si no hay end_time, calcular desde el inicio hasta ahora
      const start = new Date(row.start_time).getTime();
      const now = Date.now();
      return Math.floor((now - start) / 1000);
    }
    
    return 0;
  }

  /**
   * Obtener historial completo de llamadas con filtros opcionales
   */
  static async getCallHistory(options: {
    status?: string;
    priority?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CallData[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (options.status && options.status !== 'all') {
        whereClause += ' AND status = ?';
        params.push(options.status);
      }

      if (options.priority && options.priority !== 'all') {
        whereClause += ' AND priority = ?';
        params.push(options.priority);
      }

      if (options.search && options.search.trim() !== '') {
        whereClause += ' AND (patient_name LIKE ? OR patient_phone LIKE ? OR agent_name LIKE ?)';
        const searchTerm = `%${options.search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      let limitClause = '';
      if (options.limit) {
        limitClause = ` LIMIT ${options.limit}`;
        if (options.offset) {
          limitClause += ` OFFSET ${options.offset}`;
        }
      }

      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT 
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
           transcript,
           audio_url,
           webhook_data,
           created_at,
           updated_at
         FROM calls 
         ${whereClause}
         ORDER BY start_time DESC
         ${limitClause}`,
        params
      );

      return rows.map(row => ({
        id: row.id,
        conversation_id: row.conversation_id,
        patient_name: row.patient_name,
        patient_phone: row.patient_phone,
        agent_name: row.agent_name,
        call_type: row.call_type,
        status: row.status,
        priority: row.priority,
        start_time: row.start_time,
        end_time: row.end_time,
        duration: row.duration || CallManagerService.calculateDurationFromRow(row),
        transcript: row.transcript,
        audio_url: row.audio_url,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

    } catch (error) {
      console.error('Error fetching call history:', error);
      throw error;
    }
  }
}
