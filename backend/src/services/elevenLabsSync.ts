/**
 * ElevenLabs Sync Service
 * Handles syncing conversations from ElevenLabs API to local database
 */

import pool from '../db/pool';
import axios from 'axios';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

interface ElevenLabsCall {
  conversation_id: string;
  call_id?: string;
  agent_id?: string;
  caller_number?: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  transcript?: string;
  analysis?: any;
  summary?: string;
  metadata?: any;
  end_reason?: string;
}

export class ElevenLabsSync {
  
  /**
   * Sync latest calls from ElevenLabs API
   * @param limit Number of recent calls to sync (default: 100)
   */
  static async syncLatestCalls(limit: number = 100): Promise<{ synced: number; errors: number }> {
    const syncLogId = await this.createSyncLog('polling');
    let synced = 0;
    let errors = 0;

    try {
      console.log(`[ElevenLabs Sync] Fetching latest ${limit} calls from API...`);
      console.log(`[ElevenLabs Sync] API Key: ${ELEVENLABS_API_KEY?.substring(0, 10)}...`);
      console.log(`[ElevenLabs Sync] Agent ID: ${ELEVENLABS_AGENT_ID}`);
      
      const response = await axios.get(
        `https://api.elevenlabs.io/v1/convai/conversations`,
        {
          headers: { 'xi-api-key': ELEVENLABS_API_KEY },
          params: {
            agent_id: ELEVENLABS_AGENT_ID,
            page_size: limit
          }
        }
      );

      const calls = response.data.conversations || [];
      console.log(`[ElevenLabs Sync] Fetched ${calls.length} conversations`);

      for (const call of calls) {
        try {
          // Obtener detalles completos de la conversación para tener el número del cliente
          console.log(`[ElevenLabs Sync] Fetching details for ${call.conversation_id}...`);
          const detailsResponse = await axios.get(
            `https://api.elevenlabs.io/v1/convai/conversations/${call.conversation_id}`,
            {
              headers: { 'xi-api-key': ELEVENLABS_API_KEY }
            }
          );
          
          // Combinar datos de lista con detalles completos
          const fullCallData = {
            ...call,
            ...detailsResponse.data,
            // Preservar campos de la lista que podrían no estar en detalles
            call_duration_secs: call.call_duration_secs,
            start_time_unix_secs: call.start_time_unix_secs
          };
          
          await this.upsertCall(fullCallData);
          synced++;
        } catch (error) {
          console.error(`[ElevenLabs Sync] Error syncing call ${call.conversation_id}:`, error);
          errors++;
        }
      }

      await this.completeSyncLog(syncLogId, 'success', synced, errors);
      console.log(`[ElevenLabs Sync] Completed: ${synced} synced, ${errors} errors`);

    } catch (error: any) {
      console.error('[ElevenLabs Sync] Fatal error:', error.message);
      await this.completeSyncLog(syncLogId, 'failed', synced, errors, error.message);
      errors++;
    }

    return { synced, errors };
  }

  /**
   * Upsert (insert or update) a call record
   */
  static async upsertCall(call: any): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      // Los datos vienen en formatos diferentes según la fuente (API vs Webhook)
      // API: campos directos como call_duration_secs, start_time_unix_secs
      // Webhook: anidados en metadata
      
      // Extraer número del cliente de dynamic_variables (prioritario)
      const dynamicVars = call.conversation_initiation_client_data?.dynamic_variables;
      
      const callerNumber = dynamicVars?.system__caller_id ||
                          call.caller_number || 
                          call.metadata?.caller_number || 
                          call.metadata?.from_number || 
                          null;
      
      const calleeNumber = dynamicVars?.system__called_number ||
                          call.callee_number ||
                          call.metadata?.callee_number || 
                          call.metadata?.to_number || 
                          process.env.ELEVENLABS_PHONE_NUMBER || 
                          null;

      const startTimeUnix = call.start_time_unix_secs || 
                           call.metadata?.start_time_unix_secs ||
                           null;
                           
      const durationSecs = call.call_duration_secs ||
                          call.duration_seconds ||
                          call.metadata?.call_duration_secs ||
                          0;
      
      const endTimeUnix = startTimeUnix && durationSecs 
        ? startTimeUnix + durationSecs 
        : call.end_time_unix_secs || null;

      const sql = `
        INSERT INTO elevenlabs_calls (
          conversation_id, call_id, agent_id, caller_number, callee_number,
          status, call_direction, call_type,
          started_at, ended_at, duration_seconds,
          transcript, analysis, summary, metadata,
          end_reason, recording_url, synced_from_api
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          call_id = VALUES(call_id),
          agent_id = VALUES(agent_id),
          caller_number = VALUES(caller_number),
          callee_number = VALUES(callee_number),
          status = VALUES(status),
          call_direction = VALUES(call_direction),
          call_type = VALUES(call_type),
          started_at = VALUES(started_at),
          ended_at = VALUES(ended_at),
          duration_seconds = VALUES(duration_seconds),
          transcript = VALUES(transcript),
          analysis = VALUES(analysis),
          summary = VALUES(summary),
          metadata = VALUES(metadata),
          end_reason = VALUES(end_reason),
          recording_url = VALUES(recording_url),
          synced_from_api = VALUES(synced_from_api),
          last_synced_at = CURRENT_TIMESTAMP
      `;

      const values = [
        call.conversation_id,
        call.call_id || null,
        call.agent_id || ELEVENLABS_AGENT_ID,
        callerNumber,
        calleeNumber,
        call.status || 'done',
        call.direction || call.metadata?.call_direction || 'inbound',
        call.call_type || call.metadata?.call_type || null,
        startTimeUnix ? new Date(startTimeUnix * 1000) : null,
        endTimeUnix ? new Date(endTimeUnix * 1000) : null,
        durationSecs,
        call.transcript ? JSON.stringify(call.transcript) : null,
        call.analysis || call.call_successful ? JSON.stringify({
          call_successful: call.call_successful,
          summary_title: call.call_summary_title
        }) : null,
        call.transcript_summary || call.summary || null,
        JSON.stringify({
          message_count: call.message_count || 0,
          agent_name: call.agent_name || null,
          conversation_initiation_client_data: call.conversation_initiation_client_data || null,
          phone_call: call.metadata?.phone_call || null,
          ...call.metadata
        }),
        call.termination_reason || call.metadata?.end_reason || null,
        call.recording_url || call.metadata?.recording_url || null,
        true
      ];

      await connection.execute(sql, values);
      
    } finally {
      connection.release();
    }
  }

  /**
   * Get calls from database with pagination
   */
  static async getCallsFromDB(
    page: number = 1, 
    limit: number = 20,
    searchTerm?: string,
    dateFilter?: string
  ): Promise<{ calls: any[]; total: number }> {
    const connection = await pool.getConnection();
    
    try {
      const offset = (page - 1) * limit;
      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      // Search filter
      if (searchTerm) {
        whereConditions.push(`(
          conversation_id LIKE ? OR 
          caller_number LIKE ? OR 
          callee_number LIKE ?
        )`);
        const searchPattern = `%${searchTerm}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      // Date filter
      if (dateFilter) {
        whereConditions.push('DATE(started_at) = ?');
        queryParams.push(dateFilter);
      }

      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM elevenlabs_calls ${whereClause}`;
      const [countRows] = await connection.execute<RowDataPacket[]>(countSql, queryParams);
      const total = countRows[0].total;

      // Get paginated results
      const sql = `
        SELECT 
          id, conversation_id, call_id, agent_id,
          caller_number, callee_number,
          status, call_direction, call_type,
          started_at, ended_at, duration_seconds,
          transcript, analysis, summary, metadata,
          end_reason, recording_url,
          created_at, updated_at
        FROM elevenlabs_calls
        ${whereClause}
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?
      `;

      const [rows] = await connection.execute<RowDataPacket[]>(
        sql, 
        [...queryParams, limit, offset]
      );

      // Parse JSON fields
      const calls = rows.map((row: RowDataPacket) => ({
        ...row,
        analysis: row.analysis ? JSON.parse(row.analysis) : null,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        start_time: row.started_at // Alias for frontend compatibility
      }));

      return { calls, total };

    } finally {
      connection.release();
    }
  }

  /**
   * Create sync log entry
   */
  private static async createSyncLog(syncType: string): Promise<number> {
    const connection = await pool.getConnection();
    try {
      const sql = `
        INSERT INTO elevenlabs_sync_log (sync_type, status) 
        VALUES (?, 'in_progress')
      `;
      const [result] = await connection.execute<ResultSetHeader>(sql, [syncType]);
      return result.insertId;
    } finally {
      connection.release();
    }
  }

  /**
   * Complete sync log entry
   */
  private static async completeSyncLog(
    syncLogId: number,
    status: string,
    synced: number,
    failed: number,
    errorMessage?: string
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const sql = `
        UPDATE elevenlabs_sync_log 
        SET status = ?, 
            records_synced = ?, 
            records_failed = ?,
            error_message = ?,
            sync_completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      await connection.execute(sql, [status, synced, failed, errorMessage || null, syncLogId]);
    } finally {
      connection.release();
    }
  }

  /**
   * Sync call from webhook (real-time)
   */
  static async syncFromWebhook(callData: any): Promise<void> {
    const syncLogId = await this.createSyncLog('webhook');
    
    try {
      await this.upsertCall(callData);
      await this.completeSyncLog(syncLogId, 'success', 1, 0);
      console.log(`[ElevenLabs Webhook] Synced call: ${callData.conversation_id}`);
    } catch (error: any) {
      console.error('[ElevenLabs Webhook] Sync error:', error.message);
      await this.completeSyncLog(syncLogId, 'failed', 0, 1, error.message);
      throw error;
    }
  }
}
