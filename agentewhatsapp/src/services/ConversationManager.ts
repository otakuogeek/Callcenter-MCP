import { Logger } from '../utils/Logger';

interface Conversation {
  sessionId: string;
  phoneNumber: string;
  patientName: string;
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  lastMessage?: string;
  lastResponse?: string;
  isActive: boolean;
  context: {
    intent?: string;
    patientId?: number;
    appointmentInProgress?: boolean;
    emergencyMode?: boolean;
    language?: string;
  };
}

export class ConversationManager {
  private conversations: Map<string, Conversation>;
  private logger: Logger;
  private readonly SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '3600000'); // 1 hora

  constructor() {
    this.conversations = new Map();
    this.logger = Logger.getInstance();
    
    // Limpiar conversaciones inactivas cada 10 minutos
    setInterval(() => {
      this.cleanupInactiveConversations();
    }, 10 * 60 * 1000);
  }

  async createConversation(sessionId: string, phoneNumber: string, patientName: string): Promise<Conversation> {
    const conversation: Conversation = {
      sessionId,
      phoneNumber,
      patientName,
      startTime: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      isActive: true,
      context: {}
    };

    this.conversations.set(sessionId, conversation);
    
    this.logger.info('Nueva conversación creada', {
      sessionId,
      phoneNumber,
      patientName
    });

    return conversation;
  }

  async getConversation(sessionId: string): Promise<Conversation | null> {
    const conversation = this.conversations.get(sessionId);
    
    if (!conversation) {
      return null;
    }

    // Verificar si la conversación ha expirado
    const now = new Date();
    const timeDiff = now.getTime() - conversation.lastActivity.getTime();
    
    if (timeDiff > this.SESSION_TIMEOUT) {
      this.logger.info('Conversación expirada', { sessionId, timeDiff });
      await this.endConversation(sessionId);
      return null;
    }

    return conversation;
  }

  async updateConversation(sessionId: string, updates: Partial<Conversation>): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    
    if (!conversation) {
      this.logger.warn('Intento de actualizar conversación inexistente', { sessionId });
      return;
    }

    // Actualizar campos proporcionados
    Object.assign(conversation, updates);
    conversation.lastActivity = new Date();

    this.conversations.set(sessionId, conversation);
    
    this.logger.debug('Conversación actualizada', {
      sessionId,
      updates: Object.keys(updates)
    });
  }

  async updateContext(sessionId: string, contextUpdates: Partial<Conversation['context']>): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    
    if (!conversation) {
      this.logger.warn('Intento de actualizar contexto de conversación inexistente', { sessionId });
      return;
    }

    conversation.context = {
      ...conversation.context,
      ...contextUpdates
    };

    conversation.lastActivity = new Date();
    this.conversations.set(sessionId, conversation);
    
    this.logger.debug('Contexto de conversación actualizado', {
      sessionId,
      context: conversation.context
    });
  }

  async endConversation(sessionId: string): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    
    if (conversation) {
      conversation.isActive = false;
      
      this.logger.info('Conversación finalizada', {
        sessionId,
        duration: Date.now() - conversation.startTime.getTime(),
        messageCount: conversation.messageCount
      });

      // Mantener en memoria por un tiempo para estadísticas
      setTimeout(() => {
        this.conversations.delete(sessionId);
      }, 5 * 60 * 1000); // 5 minutos
    }
  }

  async getActiveConversationsCount(): Promise<number> {
    let activeCount = 0;
    
    for (const conversation of this.conversations.values()) {
      if (conversation.isActive) {
        const timeDiff = Date.now() - conversation.lastActivity.getTime();
        if (timeDiff <= this.SESSION_TIMEOUT) {
          activeCount++;
        }
      }
    }
    
    return activeCount;
  }

  async getAllConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values());
  }

  async getConversationStats(): Promise<{
    total: number;
    active: number;
    avgDuration: number;
    avgMessageCount: number;
  }> {
    const allConversations = Array.from(this.conversations.values());
    const activeConversations = allConversations.filter(conv => conv.isActive);
    
    const avgDuration = allConversations.length > 0
      ? allConversations.reduce((sum, conv) => 
          sum + (Date.now() - conv.startTime.getTime()), 0) / allConversations.length
      : 0;
    
    const avgMessageCount = allConversations.length > 0
      ? allConversations.reduce((sum, conv) => sum + conv.messageCount, 0) / allConversations.length
      : 0;

    return {
      total: allConversations.length,
      active: activeConversations.length,
      avgDuration: Math.round(avgDuration / 1000), // en segundos
      avgMessageCount: Math.round(avgMessageCount)
    };
  }

  private cleanupInactiveConversations(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, conversation] of this.conversations.entries()) {
      const timeDiff = now - conversation.lastActivity.getTime();
      
      if (timeDiff > this.SESSION_TIMEOUT * 2) { // Doble del timeout para limpiar completamente
        this.conversations.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.info('Conversaciones inactivas limpiadas', { 
        cleanedCount,
        remainingCount: this.conversations.size
      });
    }
  }

  // Métodos de utilidad para el contexto de conversación
  async setEmergencyMode(sessionId: string, isEmergency: boolean): Promise<void> {
    await this.updateContext(sessionId, { emergencyMode: isEmergency });
  }

  async setAppointmentInProgress(sessionId: string, inProgress: boolean): Promise<void> {
    await this.updateContext(sessionId, { appointmentInProgress: inProgress });
  }

  async setPatientId(sessionId: string, patientId: number): Promise<void> {
    await this.updateContext(sessionId, { patientId });
  }

  async setLanguage(sessionId: string, language: string): Promise<void> {
    await this.updateContext(sessionId, { language });
  }

  async getConversationsByPhone(phoneNumber: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => conv.phoneNumber === phoneNumber);
  }

  async isPatientInActiveConversation(phoneNumber: string): Promise<boolean> {
    const conversations = await this.getConversationsByPhone(phoneNumber);
    return conversations.some(conv => conv.isActive);
  }
}