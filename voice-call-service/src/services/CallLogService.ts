import mysql from 'mysql2/promise';
import { CallRecord } from '../types';

export class CallLogService {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'biosanar_user',
      password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'biosanar',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  /**
   * Crea registro de llamada nueva
   */
  async createCallRecord(callData: Omit<CallRecord, 'id' | 'created_at'>): Promise<number> {
    try {
      const query = `
        INSERT INTO voice_calls (
          call_id, caller_number, called_number, start_time, 
          recording_url, status
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      const values = [
        callData.call_id,
        callData.caller_number,
        callData.called_number,
        callData.start_time,
        callData.recording_url || null,
        callData.status
      ];

      const [result] = await this.pool.execute(query, values);
      const insertId = (result as mysql.ResultSetHeader).insertId;

      console.log(`[CallLog] Nueva llamada registrada: ID ${insertId}, Call ID ${callData.call_id}`);
      return insertId;

    } catch (error: any) {
      console.error('[CallLog] Error creando registro de llamada:', error);
      throw new Error(`Error creando registro: ${error.message}`);
    }
  }

  /**
   * Actualiza registro de llamada existente
   */
  async updateCallRecord(callId: string, updates: Partial<CallRecord>): Promise<void> {
    try {
      const setClause = [];
      const values = [];

      // Construir cláusula SET dinámicamente
      if (updates.end_time !== undefined) {
        setClause.push('end_time = ?');
        values.push(updates.end_time);
      }
      if (updates.duration !== undefined) {
        setClause.push('duration = ?');
        values.push(updates.duration);
      }
      if (updates.recording_url !== undefined) {
        setClause.push('recording_url = ?');
        values.push(updates.recording_url);
      }
      if (updates.transcript !== undefined) {
        setClause.push('transcript = ?');
        values.push(updates.transcript);
      }
      if (updates.agent_response !== undefined) {
        setClause.push('agent_response = ?');
        values.push(updates.agent_response);
      }
      if (updates.audio_response_url !== undefined) {
        setClause.push('audio_response_url = ?');
        values.push(updates.audio_response_url);
      }
      if (updates.patient_id !== undefined) {
        setClause.push('patient_id = ?');
        values.push(updates.patient_id);
      }
      if (updates.appointment_created !== undefined) {
        setClause.push('appointment_created = ?');
        values.push(updates.appointment_created);
      }
      if (updates.status !== undefined) {
        setClause.push('status = ?');
        values.push(updates.status);
      }

      if (setClause.length === 0) {
        console.warn('[CallLog] No hay campos para actualizar');
        return;
      }

      const query = `
        UPDATE voice_calls 
        SET ${setClause.join(', ')} 
        WHERE call_id = ?
      `;
      values.push(callId);

      await this.pool.execute(query, values);
      console.log(`[CallLog] Llamada actualizada: ${callId}`);

    } catch (error: any) {
      console.error('[CallLog] Error actualizando llamada:', error);
      throw new Error(`Error actualizando registro: ${error.message}`);
    }
  }

  /**
   * Obtiene registro de llamada por call_id
   */
  async getCallRecord(callId: string): Promise<CallRecord | null> {
    try {
      const query = `
        SELECT * FROM voice_calls 
        WHERE call_id = ?
      `;

      const [rows] = await this.pool.execute(query, [callId]);
      const records = rows as CallRecord[];

      if (records.length === 0) {
        return null;
      }

      return records[0];

    } catch (error: any) {
      console.error('[CallLog] Error obteniendo llamada:', error);
      throw new Error(`Error obteniendo registro: ${error.message}`);
    }
  }

  /**
   * Obtiene todas las llamadas de un número
   */
  async getCallsByNumber(phoneNumber: string, limit: number = 10): Promise<CallRecord[]> {
    try {
      const query = `
        SELECT * FROM voice_calls 
        WHERE caller_number = ? 
        ORDER BY start_time DESC 
        LIMIT ?
      `;

      const [rows] = await this.pool.execute(query, [phoneNumber, limit]);
      return rows as CallRecord[];

    } catch (error: any) {
      console.error('[CallLog] Error obteniendo llamadas por número:', error);
      throw new Error(`Error obteniendo llamadas: ${error.message}`);
    }
  }

  /**
   * Obtiene llamadas recientes (últimas 24 horas)
   */
  async getRecentCalls(limit: number = 50): Promise<CallRecord[]> {
    try {
      const query = `
        SELECT * FROM voice_calls 
        WHERE start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY start_time DESC 
        LIMIT ?
      `;

      const [rows] = await this.pool.execute(query, [limit]);
      return rows as CallRecord[];

    } catch (error: any) {
      console.error('[CallLog] Error obteniendo llamadas recientes:', error);
      throw new Error(`Error obteniendo llamadas recientes: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas de llamadas
   */
  async getCallStatistics(days: number = 7): Promise<{
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    avgDuration: number;
    patientsRegistered: number;
    appointmentsCreated: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_calls,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_calls,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_calls,
          AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as avg_duration,
          SUM(CASE WHEN patient_id IS NOT NULL THEN 1 ELSE 0 END) as patients_registered,
          SUM(CASE WHEN appointment_created = 1 THEN 1 ELSE 0 END) as appointments_created
        FROM voice_calls 
        WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `;

      const [rows] = await this.pool.execute(query, [days]);
      const stats = (rows as any[])[0];

      return {
        totalCalls: parseInt(stats.total_calls) || 0,
        completedCalls: parseInt(stats.completed_calls) || 0,
        failedCalls: parseInt(stats.failed_calls) || 0,
        avgDuration: parseFloat(stats.avg_duration) || 0,
        patientsRegistered: parseInt(stats.patients_registered) || 0,
        appointmentsCreated: parseInt(stats.appointments_created) || 0
      };

    } catch (error: any) {
      console.error('[CallLog] Error obteniendo estadísticas:', error);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Marca llamada como fallida con razón
   */
  async markCallAsFailed(callId: string, reason: string): Promise<void> {
    try {
      const query = `
        UPDATE voice_calls 
        SET status = 'failed', agent_response = ?
        WHERE call_id = ?
      `;

      await this.pool.execute(query, [reason, callId]);
      console.log(`[CallLog] Llamada marcada como fallida: ${callId} - ${reason}`);

    } catch (error: any) {
      console.error('[CallLog] Error marcando llamada como fallida:', error);
      throw new Error(`Error marcando como fallida: ${error.message}`);
    }
  }

  /**
   * Busca llamadas por contenido de transcript
   */
  async searchCallsByTranscript(searchTerm: string, limit: number = 20): Promise<CallRecord[]> {
    try {
      const query = `
        SELECT * FROM voice_calls 
        WHERE transcript LIKE ? 
        ORDER BY start_time DESC 
        LIMIT ?
      `;

      const [rows] = await this.pool.execute(query, [`%${searchTerm}%`, limit]);
      return rows as CallRecord[];

    } catch (error: any) {
      console.error('[CallLog] Error buscando por transcript:', error);
      throw new Error(`Error en búsqueda: ${error.message}`);
    }
  }

  /**
   * Limpia registros antiguos (más de X días)
   */
  async cleanupOldRecords(days: number = 90): Promise<number> {
    try {
      const query = `
        DELETE FROM voice_calls 
        WHERE start_time < DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status IN ('completed', 'failed')
      `;

      const [result] = await this.pool.execute(query, [days]);
      const deletedCount = (result as mysql.ResultSetHeader).affectedRows;

      console.log(`[CallLog] ${deletedCount} registros antiguos eliminados`);
      return deletedCount;

    } catch (error: any) {
      console.error('[CallLog] Error limpiando registros antiguos:', error);
      throw new Error(`Error limpiando registros: ${error.message}`);
    }
  }

  /**
   * Verifica conectividad con la base de datos
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.pool.execute('SELECT 1');
      console.log('[CallLog] Conexión a base de datos OK');
      return true;
    } catch (error) {
      console.error('[CallLog] Error de conexión a base de datos:', error);
      return false;
    }
  }

  /**
   * Cierra pool de conexiones
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      console.log('[CallLog] Pool de conexiones cerrado');
    } catch (error) {
      console.error('[CallLog] Error cerrando pool:', error);
    }
  }
}