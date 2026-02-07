/**
 * Advanced Conversation Management System
 * Basado en patrones de moltbot para mejor manejo de estado y flujo
 */

import pool from '../db/pool';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface ConversationState {
  id: number;
  userId: string;
  phoneNumber: string;
  state: ConversationStateType;
  subState?: string;
  contextData: Record<string, any>;
  lastMessage: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export type ConversationStateType =
  | 'idle'              // Sin conversación activa
  | 'greeting'          // Saludo inicial
  | 'identifying'       // Identificando paciente
  | 'scheduling'        // Proceso de agendamiento
  | 'checking_availability' // Consultando disponibilidad
  | 'confirming'        // Confirmando información
  | 'waiting_list'      // Gestionando lista de espera
  | 'canceling'         // Cancelando cita
  | 'rescheduling'      // Reprogramando
  | 'info_request'      // Solicitando información
  | 'completed'         // Tarea completada
  | 'error';            // Estado de error

export interface StateTransition {
  from: ConversationStateType;
  to: ConversationStateType;
  condition?: (context: Record<string, any>) => boolean;
  action?: (context: Record<string, any>) => Promise<void>;
}

export class WhatsAppConversationManager {
  private stateTimeouts: Map<ConversationStateType, number> = new Map([
    ['idle', 60 * 60 * 1000], // 1 hora
    ['greeting', 5 * 60 * 1000], // 5 minutos
    ['identifying', 10 * 60 * 1000], // 10 minutos
    ['scheduling', 15 * 60 * 1000], // 15 minutos
    ['checking_availability', 10 * 60 * 1000],
    ['confirming', 5 * 60 * 1000],
    ['waiting_list', 15 * 60 * 1000],
    ['canceling', 5 * 60 * 1000],
    ['rescheduling', 15 * 60 * 1000],
    ['info_request', 5 * 60 * 1000],
    ['completed', 2 * 60 * 1000], // 2 minutos antes de reset
    ['error', 5 * 60 * 1000]
  ]);

  /**
   * Obtiene o crea un estado de conversación
   */
  async getOrCreateConversation(phoneNumber: string): Promise<ConversationState> {
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM wa_conversation_states 
       WHERE phone_number = ? AND expires_at > NOW() 
       ORDER BY updated_at DESC LIMIT 1`,
      [phoneNumber]
    );

    if (existing.length > 0) {
      const row = existing[0];
      return {
        id: row.id,
        userId: row.user_id,
        phoneNumber: row.phone_number,
        state: row.state,
        subState: row.sub_state,
        contextData: JSON.parse(row.context_data || '{}'),
        lastMessage: row.last_message,
        messageCount: row.message_count,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        expiresAt: new Date(row.expires_at)
      };
    }

    // Crear nueva conversación
    const timeout = this.stateTimeouts.get('idle') || 3600000;
    const expiresAt = new Date(Date.now() + timeout);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO wa_conversation_states 
       (user_id, phone_number, state, context_data, last_message, message_count, expires_at) 
       VALUES (?, ?, 'idle', '{}', '', 0, ?)`,
      [phoneNumber, phoneNumber, expiresAt]
    );

    return {
      id: result.insertId,
      userId: phoneNumber,
      phoneNumber,
      state: 'idle',
      contextData: {},
      lastMessage: '',
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt
    };
  }

  /**
   * Transiciona al siguiente estado
   */
  async transitionState(
    phoneNumber: string,
    newState: ConversationStateType,
    subState?: string,
    contextUpdate?: Record<string, any>
  ): Promise<ConversationState> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    
    const timeout = this.stateTimeouts.get(newState) || 3600000;
    const expiresAt = new Date(Date.now() + timeout);
    
    const updatedContext = {
      ...conversation.contextData,
      ...(contextUpdate || {}),
      previousState: conversation.state,
      stateTransitionAt: new Date().toISOString()
    };

    await pool.execute(
      `UPDATE wa_conversation_states 
       SET state = ?, sub_state = ?, context_data = ?, expires_at = ?, updated_at = NOW() 
       WHERE phone_number = ? AND id = ?`,
      [newState, subState || null, JSON.stringify(updatedContext), expiresAt, phoneNumber, conversation.id]
    );

    console.log(`📊 Estado transicionado: ${conversation.state} -> ${newState} (${phoneNumber})`);

    return {
      ...conversation,
      state: newState,
      subState,
      contextData: updatedContext,
      updatedAt: new Date(),
      expiresAt
    };
  }

  /**
   * Actualiza el contexto sin cambiar el estado
   */
  async updateContext(phoneNumber: string, contextUpdate: Record<string, any>): Promise<void> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    
    const updatedContext = {
      ...conversation.contextData,
      ...contextUpdate
    };

    await pool.execute(
      `UPDATE wa_conversation_states 
       SET context_data = ?, updated_at = NOW() 
       WHERE phone_number = ? AND id = ?`,
      [JSON.stringify(updatedContext), phoneNumber, conversation.id]
    );
  }

  /**
   * Incrementa el contador de mensajes
   */
  async incrementMessageCount(phoneNumber: string, message: string): Promise<void> {
    await pool.execute(
      `UPDATE wa_conversation_states 
       SET message_count = message_count + 1, last_message = ?, updated_at = NOW() 
       WHERE phone_number = ? AND expires_at > NOW()`,
      [message, phoneNumber]
    );
  }

  /**
   * Completa y resetea la conversación
   */
  async completeConversation(phoneNumber: string, summary?: string): Promise<void> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    
    await pool.execute(
      `UPDATE wa_conversation_states 
       SET state = 'completed', 
           context_data = JSON_SET(context_data, '$.completionSummary', ?, '$.completedAt', ?),
           expires_at = DATE_ADD(NOW(), INTERVAL 2 MINUTE)
       WHERE phone_number = ? AND id = ?`,
      [summary || 'Conversación completada', new Date().toISOString(), phoneNumber, conversation.id]
    );

    console.log(`✅ Conversación completada: ${phoneNumber}`);
  }

  /**
   * Marca la conversación como error
   */
  async markAsError(phoneNumber: string, error: string): Promise<void> {
    await this.transitionState(phoneNumber, 'error', undefined, {
      errorMessage: error,
      errorAt: new Date().toISOString()
    });
  }

  /**
   * Obtiene el flujo sugerido según el estado actual
   */
  getNextSteps(state: ConversationStateType): string[] {
    const flowMap: Record<ConversationStateType, string[]> = {
      'idle': ['Saludo inicial', 'Identificación del paciente'],
      'greeting': ['Identificar paciente', 'Captar intención'],
      'identifying': ['Validar documento', 'Consultar datos existentes'],
      'scheduling': ['Consultar disponibilidad', 'Seleccionar especialidad', 'Elegir fecha/hora'],
      'checking_availability': ['Mostrar opciones', 'Ofrecer alternativas', 'Lista de espera'],
      'confirming': ['Validar datos', 'Procesar agendamiento', 'Generar confirmación'],
      'waiting_list': ['Agregar a cola', 'Informar posición', 'Explicar notificaciones'],
      'canceling': ['Confirmar cancelación', 'Solicitar motivo', 'Procesar cancelación'],
      'rescheduling': ['Consultar nueva disponibilidad', 'Confirmar cambio'],
      'info_request': ['Proporcionar información', 'Ofrecer ayuda adicional'],
      'completed': ['Agradecer', 'Ofrecer ayuda adicional', 'Despedida'],
      'error': ['Explicar error', 'Ofrecer alternativas', 'Contacto humano']
    };

    return flowMap[state] || ['Continuar conversación'];
  }

  /**
   * Determina si el estado actual requiere una acción del sistema
   */
  requiresSystemAction(state: ConversationStateType): boolean {
    const actionStates: ConversationStateType[] = [
      'identifying',
      'checking_availability',
      'confirming',
      'waiting_list',
      'canceling',
      'rescheduling'
    ];
    
    return actionStates.includes(state);
  }

  /**
   * Limpia conversaciones expiradas
   */
  async cleanupExpiredConversations(): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM wa_conversation_states WHERE expires_at < NOW()'
    );

    const deleted = result.affectedRows;
    if (deleted > 0) {
      console.log(`🧹 Limpiadas ${deleted} conversaciones expiradas`);
    }

    return deleted;
  }

  /**
   * Obtiene estadísticas de conversaciones
   */
  async getStats(): Promise<{
    active: number;
    byState: Record<string, number>;
    avgMessageCount: number;
  }> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        state, 
        COUNT(*) as count, 
        AVG(message_count) as avg_messages 
       FROM wa_conversation_states 
       WHERE expires_at > NOW() 
       GROUP BY state`
    );

    const byState: Record<string, number> = {};
    let totalMessages = 0;
    let totalConversations = 0;

    rows.forEach(row => {
      byState[row.state] = row.count;
      totalMessages += row.avg_messages * row.count;
      totalConversations += row.count;
    });

    return {
      active: totalConversations,
      byState,
      avgMessageCount: totalConversations > 0 ? totalMessages / totalConversations : 0
    };
  }

  /**
   * Crea la tabla si no existe (con cache para evitar consultas repetitivas)
   */
  private _tableEnsured = false;
  async ensureTableExists(): Promise<void> {
    if (this._tableEnsured) return;
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS wa_conversation_states (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        state VARCHAR(50) NOT NULL DEFAULT 'idle',
        sub_state VARCHAR(50),
        context_data JSON,
        last_message TEXT,
        message_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX idx_phone (phone_number),
        INDEX idx_state (state),
        INDEX idx_expires (expires_at),
        INDEX idx_phone_expires (phone_number, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    this._tableEnsured = true;
  }
}

// Singleton
export const conversationManager = new WhatsAppConversationManager();
