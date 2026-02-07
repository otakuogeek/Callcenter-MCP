/**
 * WhatsApp Human Handoff Service
 * 
 * Sistema de transferencia a agentes humanos cuando:
 * - El bot no puede resolver la consulta
 * - El usuario solicita hablar con un humano
 * - Se detecta frustración o urgencia crítica
 * - Temas sensibles (quejas, errores médicos, etc.)
 * 
 * @version 1.0.0
 */

import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({
  name: 'whatsapp-handoff',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// TIPOS
// ============================================================================

export interface HandoffRequest {
  id?: number;
  phone: string;
  patient_id?: number;
  patient_name?: string;
  reason: HandoffReason;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  context: string;
  conversation_history: Array<{ role: string; content: string }>;
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'abandoned';
  assigned_agent_id?: number;
  assigned_at?: Date;
  resolved_at?: Date;
  resolution_notes?: string;
  created_at?: Date;
}

export type HandoffReason = 
  | 'user_requested'      // Usuario pidió hablar con humano
  | 'bot_unable'          // Bot no pudo resolver
  | 'high_frustration'    // Detectada frustración alta
  | 'sensitive_topic'     // Tema sensible (quejas, errores)
  | 'urgent_medical'      // Urgencia médica
  | 'complex_scheduling'  // Agendamiento complejo
  | 'billing_issue'       // Problema de facturación
  | 'max_retries'         // Máximo de reintentos alcanzado
  | 'error_loop';         // Detectado loop de errores

export interface HumanAgent {
  id: number;
  name: string;
  phone?: string;
  email: string;
  status: 'available' | 'busy' | 'offline';
  active_handoffs: number;
  max_handoffs: number;
  specialties?: string[];
}

// ============================================================================
// PATRONES DE DETECCIÓN
// ============================================================================

const HANDOFF_TRIGGERS = {
  // Usuario pide humano explícitamente
  user_requested: [
    /hablar con (un |una )?(persona|humano|agente|asesor|recepcion)/i,
    /quiero (un |una )?(persona|humano|agente)/i,
    /necesito (un |una )?(persona|humano|agente)/i,
    /pasame con (alguien|una persona|un agente)/i,
    /no (quiero|me gusta) (el |un )?bot/i,
    /comunicar(me)? con (alguien|una persona)/i,
    /operador/i,
    /^agente$/i
  ],
  
  // Frustración detectada
  high_frustration: [
    /esto no sirve/i,
    /no me entiendes?/i,
    /eres (muy )?(inutil|tonto|idiota)/i,
    /que (mala|pesima|horrible) atención/i,
    /voy a (demandar|quejar)/i,
    /superintendencia/i,
    /esto es (un |una )?(desastre|vergüenza)/i,
    /(!!+|\?\?+){2,}/,  // Múltiples signos de exclamación/interrogación
    /MAYUSCULAS SEGUIDAS/  // Placeholder, se detecta por análisis de texto
  ],
  
  // Temas sensibles
  sensitive_topic: [
    /queja|reclamo|denuncia/i,
    /error (medico|médico|del doctor)/i,
    /negligencia/i,
    /mala (praxis|práctica)/i,
    /me (hicieron|causaron) daño/i,
    /demanda|abogado/i,
    /tutela|derecho de petición/i
  ],
  
  // Urgencia médica
  urgent_medical: [
    /urgencia|emergencia/i,
    /dolor (fuerte|intenso|muy fuerte)/i,
    /no puedo respirar/i,
    /sangrando (mucho)?/i,
    /accidente/i,
    /me siento (muy )mal/i,
    /fiebre (alta|muy alta)/i
  ]
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

export class WhatsAppHandoffService extends EventEmitter {
  private activeHandoffs = new Map<string, HandoffRequest>();
  private agents = new Map<number, HumanAgent>();
  private _initialized = false;

  constructor() {
    super();
    // Iniciar carga de agentes con manejo de errores
    this.loadAgents().catch(err => {
      logger.error({ err }, 'Failed to load agents on startup - will retry on first use');
    });
  }

  /**
   * Asegura que los agentes estén cargados antes de usarlos
   */
  private async ensureAgentsLoaded(): Promise<void> {
    if (!this._initialized) {
      await this.loadAgents();
    }
  }

  /**
   * Cargar agentes disponibles
   */
  private async loadAgents(): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          u.id, u.name, u.email, u.phone,
          COALESCE(COUNT(h.id), 0) as active_handoffs
        FROM users u
        LEFT JOIN wa_handoff_requests h 
          ON h.assigned_agent_id = u.id AND h.status IN ('assigned', 'in_progress')
        WHERE u.role IN ('admin', 'receptionist')
        GROUP BY u.id
      `);

      for (const row of rows) {
        this.agents.set(row.id, {
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          status: 'available',
          active_handoffs: row.active_handoffs,
          max_handoffs: 5
        });
      }

      logger.info({ agentCount: this.agents.size }, 'Agents loaded');
      this._initialized = true;
    } finally {
      connection.release();
    }
  }

  /**
   * Detectar si se necesita handoff
   */
  detectHandoffNeeded(
    message: string,
    context: {
      retryCount?: number;
      frustrationLevel?: number;
      errorCount?: number;
      conversationLength?: number;
    }
  ): { needed: boolean; reason?: HandoffReason; priority?: HandoffRequest['priority'] } {
    
    // Verificar patrones de usuario solicitando humano
    for (const pattern of HANDOFF_TRIGGERS.user_requested) {
      if (pattern.test(message)) {
        return { needed: true, reason: 'user_requested', priority: 'medium' };
      }
    }

    // Verificar urgencia médica
    for (const pattern of HANDOFF_TRIGGERS.urgent_medical) {
      if (pattern.test(message)) {
        return { needed: true, reason: 'urgent_medical', priority: 'urgent' };
      }
    }

    // Verificar temas sensibles
    for (const pattern of HANDOFF_TRIGGERS.sensitive_topic) {
      if (pattern.test(message)) {
        return { needed: true, reason: 'sensitive_topic', priority: 'high' };
      }
    }

    // Verificar frustración
    for (const pattern of HANDOFF_TRIGGERS.high_frustration) {
      if (pattern.test(message)) {
        return { needed: true, reason: 'high_frustration', priority: 'high' };
      }
    }

    // Detectar MAYÚSCULAS sostenidas (frustración)
    const uppercaseRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    if (uppercaseRatio > 0.7 && message.length > 20) {
      return { needed: true, reason: 'high_frustration', priority: 'high' };
    }

    // Verificar por contexto
    if (context.retryCount && context.retryCount >= 3) {
      return { needed: true, reason: 'max_retries', priority: 'medium' };
    }

    if (context.errorCount && context.errorCount >= 5) {
      return { needed: true, reason: 'error_loop', priority: 'high' };
    }

    if (context.frustrationLevel && context.frustrationLevel > 0.8) {
      return { needed: true, reason: 'high_frustration', priority: 'high' };
    }

    return { needed: false };
  }

  /**
   * Iniciar handoff a agente humano
   */
  async initiateHandoff(
    phone: string,
    reason: HandoffReason,
    priority: HandoffRequest['priority'],
    context: {
      patientId?: number;
      patientName?: string;
      conversationHistory: Array<{ role: string; content: string }>;
      contextSummary: string;
    }
  ): Promise<{ success: boolean; request?: HandoffRequest; message: string }> {
    
    // Verificar si ya hay un handoff activo para este número
    if (this.activeHandoffs.has(phone)) {
      const existing = this.activeHandoffs.get(phone)!;
      if (existing.status === 'pending' || existing.status === 'assigned') {
        return {
          success: true,
          request: existing,
          message: 'Ya tienes una solicitud de atención en espera. Un agente te atenderá pronto. 😊'
        };
      }
    }

    const connection = await pool.getConnection();
    try {
      // Crear solicitud de handoff
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO wa_handoff_requests
        (phone, patient_id, patient_name, reason, priority, context, conversation_history, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [
        phone,
        context.patientId || null,
        context.patientName || null,
        reason,
        priority,
        context.contextSummary,
        JSON.stringify(context.conversationHistory.slice(-20)) // Últimos 20 mensajes
      ]);

      const request: HandoffRequest = {
        id: result.insertId,
        phone,
        patient_id: context.patientId,
        patient_name: context.patientName,
        reason,
        priority,
        context: context.contextSummary,
        conversation_history: context.conversationHistory,
        status: 'pending'
      };

      this.activeHandoffs.set(phone, request);

      // Intentar asignar agente automáticamente
      const assignedAgent = await this.autoAssignAgent(request);

      // Emitir evento para notificar al dashboard
      this.emit('handoff:new', request);

      logger.info({
        requestId: result.insertId,
        phone,
        reason,
        priority,
        assignedAgent: assignedAgent?.name
      }, 'Handoff initiated');

      // Generar mensaje para el usuario
      let message: string;
      if (assignedAgent) {
        message = `Entiendo tu situación. Te estoy transfiriendo con ${assignedAgent.name} quien te ayudará personalmente. 👤\n\nPor favor espera un momento mientras se conecta. 😊`;
      } else {
        message = this.getHandoffMessage(reason, priority);
      }

      return { success: true, request, message };

    } finally {
      connection.release();
    }
  }

  /**
   * Auto-asignar agente disponible
   */
  private async autoAssignAgent(request: HandoffRequest): Promise<HumanAgent | null> {
    await this.ensureAgentsLoaded();
    // Buscar agente disponible con menos carga
    let bestAgent: HumanAgent | null = null;
    let lowestLoad = Infinity;

    for (const agent of this.agents.values()) {
      if (agent.status === 'available' && agent.active_handoffs < agent.max_handoffs) {
        if (agent.active_handoffs < lowestLoad) {
          lowestLoad = agent.active_handoffs;
          bestAgent = agent;
        }
      }
    }

    if (bestAgent && request.id) {
      const connection = await pool.getConnection();
      try {
        await connection.execute(`
          UPDATE wa_handoff_requests
          SET assigned_agent_id = ?, assigned_at = NOW(), status = 'assigned'
          WHERE id = ?
        `, [bestAgent.id, request.id]);

        bestAgent.active_handoffs++;
        request.assigned_agent_id = bestAgent.id;
        request.status = 'assigned';

        // Notificar al agente
        this.emit('handoff:assigned', { request, agent: bestAgent });

        logger.info({
          requestId: request.id,
          agentId: bestAgent.id,
          agentName: bestAgent.name
        }, 'Agent auto-assigned');

        return bestAgent;
      } finally {
        connection.release();
      }
    }

    return null;
  }

  /**
   * Generar mensaje de handoff según la razón
   */
  private getHandoffMessage(reason: HandoffReason, priority: HandoffRequest['priority']): string {
    const messages: Record<HandoffReason, string> = {
      user_requested: '¡Por supuesto! Te transfiero con un agente humano. 👤\n\nPor favor espera un momento, alguien te atenderá pronto. 😊',
      
      bot_unable: 'Entiendo que necesitas ayuda especializada. Te transfiero con un agente que podrá asistirte mejor. 👤\n\nGracias por tu paciencia. 😊',
      
      high_frustration: 'Lamento mucho que estés teniendo esta experiencia. 😔\n\nTe conecto con un agente humano de inmediato para resolver tu situación. Por favor espera un momento. 🙏',
      
      sensitive_topic: 'Entiendo la importancia de tu situación. Te transfiero con un especialista que podrá ayudarte adecuadamente. 👤\n\nUn agente te contactará en breve. 📞',
      
      urgent_medical: '⚠️ Si es una emergencia médica, por favor llama al 123 o acude al servicio de urgencias más cercano.\n\nTe transfiero con un agente para orientarte. 🏥',
      
      complex_scheduling: 'Veo que tu caso de agendamiento es especial. Te conecto con una persona de recepción que te ayudará a encontrar la mejor opción. 📅',
      
      billing_issue: 'Entiendo tu inquietud sobre facturación. Te transfiero con un agente del área administrativa que podrá ayudarte. 💳',
      
      max_retries: 'Disculpa los inconvenientes. Te conecto con un agente humano para asegurarnos de resolver tu solicitud correctamente. 😊',
      
      error_loop: 'Parece que estamos teniendo dificultades técnicas. Te transfiero con un agente para asistirte personalmente. 🔧'
    };

    let message = messages[reason] || messages.bot_unable;

    // Agregar nota de prioridad para casos urgentes
    if (priority === 'urgent') {
      message += '\n\n⚡ Tu caso está marcado como prioritario.';
    }

    return message;
  }

  /**
   * Verificar si un número está en handoff
   */
  isInHandoff(phone: string): boolean {
    const request = this.activeHandoffs.get(phone);
    return request !== undefined && ['pending', 'assigned', 'in_progress'].includes(request.status);
  }

  /**
   * Obtener handoff activo
   */
  getActiveHandoff(phone: string): HandoffRequest | undefined {
    return this.activeHandoffs.get(phone);
  }

  /**
   * Resolver handoff
   */
  async resolveHandoff(
    phone: string,
    agentId: number,
    notes?: string
  ): Promise<boolean> {
    const request = this.activeHandoffs.get(phone);
    if (!request || !request.id) return false;

    const connection = await pool.getConnection();
    try {
      await connection.execute(`
        UPDATE wa_handoff_requests
        SET status = 'resolved', resolved_at = NOW(), resolution_notes = ?
        WHERE id = ?
      `, [notes || null, request.id]);

      // Actualizar contador del agente
      const agent = this.agents.get(agentId);
      if (agent && agent.active_handoffs > 0) {
        agent.active_handoffs--;
      }

      this.activeHandoffs.delete(phone);
      this.emit('handoff:resolved', { request, agentId, notes });

      logger.info({
        requestId: request.id,
        phone,
        agentId,
        notes
      }, 'Handoff resolved');

      return true;
    } finally {
      connection.release();
    }
  }

  /**
   * Transferir handoff a otro agente
   */
  async transferHandoff(
    phone: string,
    fromAgentId: number,
    toAgentId: number,
    reason?: string
  ): Promise<boolean> {
    const request = this.activeHandoffs.get(phone);
    if (!request || !request.id) return false;

    const toAgent = this.agents.get(toAgentId);
    if (!toAgent || toAgent.status !== 'available') return false;

    const connection = await pool.getConnection();
    try {
      await connection.execute(`
        UPDATE wa_handoff_requests
        SET assigned_agent_id = ?, 
            metadata = JSON_SET(COALESCE(metadata, '{}'), '$.transfer_reason', ?)
        WHERE id = ?
      `, [toAgentId, reason || null, request.id]);

      // Actualizar contadores
      const fromAgent = this.agents.get(fromAgentId);
      if (fromAgent && fromAgent.active_handoffs > 0) {
        fromAgent.active_handoffs--;
      }
      toAgent.active_handoffs++;

      request.assigned_agent_id = toAgentId;
      this.emit('handoff:transferred', { request, fromAgentId, toAgentId, reason });

      logger.info({
        requestId: request.id,
        phone,
        fromAgentId,
        toAgentId,
        reason
      }, 'Handoff transferred');

      return true;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener estadísticas de handoffs
   */
  async getStats(period: '24h' | '7d' | '30d' = '24h'): Promise<{
    total: number;
    pending: number;
    resolved: number;
    avgResolutionTimeMinutes: number;
    byReason: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const connection = await pool.getConnection();
    const intervals = { '24h': '24 HOUR', '7d': '7 DAY', '30d': '30 DAY' };
    const interval = intervals[period];

    try {
      const [total] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as count FROM wa_handoff_requests
        WHERE created_at > DATE_SUB(NOW(), INTERVAL ${interval})
      `);

      const [pending] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as count FROM wa_handoff_requests
        WHERE status IN ('pending', 'assigned', 'in_progress')
      `);

      const [resolved] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as count, AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) as avg_time
        FROM wa_handoff_requests
        WHERE status = 'resolved' AND created_at > DATE_SUB(NOW(), INTERVAL ${interval})
      `);

      const [byReason] = await connection.execute<RowDataPacket[]>(`
        SELECT reason, COUNT(*) as count FROM wa_handoff_requests
        WHERE created_at > DATE_SUB(NOW(), INTERVAL ${interval})
        GROUP BY reason
      `);

      const [byPriority] = await connection.execute<RowDataPacket[]>(`
        SELECT priority, COUNT(*) as count FROM wa_handoff_requests
        WHERE created_at > DATE_SUB(NOW(), INTERVAL ${interval})
        GROUP BY priority
      `);

      return {
        total: total[0]?.count || 0,
        pending: pending[0]?.count || 0,
        resolved: resolved[0]?.count || 0,
        avgResolutionTimeMinutes: Math.round(resolved[0]?.avg_time || 0),
        byReason: Object.fromEntries(byReason.map(r => [r.reason, r.count])),
        byPriority: Object.fromEntries(byPriority.map(r => [r.priority, r.count]))
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Crear tabla de handoffs (con cache para evitar consultas repetitivas)
   */
  private _tableEnsured = false;
  async ensureTableExists(): Promise<void> {
    if (this._tableEnsured) return;
    const connection = await pool.getConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS wa_handoff_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          phone VARCHAR(50) NOT NULL,
          patient_id INT,
          patient_name VARCHAR(200),
          reason VARCHAR(50) NOT NULL,
          priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
          context TEXT,
          conversation_history JSON,
          status ENUM('pending', 'assigned', 'in_progress', 'resolved', 'abandoned') DEFAULT 'pending',
          assigned_agent_id INT,
          assigned_at DATETIME,
          resolved_at DATETIME,
          resolution_notes TEXT,
          metadata JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_phone (phone),
          INDEX idx_agent (assigned_agent_id),
          INDEX idx_priority (priority),
          INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      this._tableEnsured = true;
      logger.info('Handoff requests table verified');
    } finally {
      connection.release();
    }
  }
}

// Singleton instance
export const handoffService = new WhatsAppHandoffService();
export default handoffService;
