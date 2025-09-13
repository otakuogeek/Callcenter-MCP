import twilio from 'twilio';
import { OpenAI } from 'openai';
import { MCPClient } from './MCPClient';
import { ConversationManager } from './ConversationManager';
import { Logger } from '../utils/Logger';
import { MessageParser } from '../utils/MessageParser';
import { ResponseGenerator } from '../utils/ResponseGenerator';

interface IncomingMessage {
  from: string;
  body: string;
  messageId: string;
  profileName: string;
}

interface ConversationStats {
  totalMessages: number;
  activeConversations: number;
  avgResponseTime: number;
  successRate: number;
  emergencyContacts: number;
  appointmentsScheduled: number;
}

export class WhatsAppAgent {
  private twilioClient!: twilio.Twilio;
  private openaiClient!: OpenAI;
  private mcpClient!: MCPClient;
  private conversationManager: ConversationManager;
  private logger: Logger;
  private messageParser: MessageParser;
  private responseGenerator: ResponseGenerator;
  private stats!: ConversationStats;

  constructor() {
    this.logger = Logger.getInstance();
    this.initializeClients();
    this.conversationManager = new ConversationManager();
    this.messageParser = new MessageParser();
    this.responseGenerator = new ResponseGenerator();
    this.initializeStats();
  }

  private initializeClients() {
    // Inicializar cliente de Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('Credenciales de Twilio no configuradas');
    }
    
    this.twilioClient = twilio(accountSid, authToken);
    
    // Inicializar cliente de OpenAI
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      throw new Error('API Key de OpenAI no configurada');
    }
    
    this.openaiClient = new OpenAI({
      apiKey: openaiApiKey
    });
    
    // Inicializar cliente MCP
    this.mcpClient = new MCPClient(
      process.env.MCP_SERVER_URL || 'https://biosanarcall.site/mcp-inspector'
    );
  }

  private initializeStats() {
    this.stats = {
      totalMessages: 0,
      activeConversations: 0,
      avgResponseTime: 0,
      successRate: 0,
      emergencyContacts: 0,
      appointmentsScheduled: 0
    };
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Inicializando WhatsApp Agent...');
      
      // Verificar conexión con MCP
      await this.mcpClient.testConnection();
      this.logger.info('✅ Conexión MCP establecida');
      
      // Verificar credenciales de Twilio
      await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
      this.logger.info('✅ Credenciales Twilio verificadas');
      
      // Verificar OpenAI
      await this.openaiClient.models.list();
      this.logger.info('✅ API de OpenAI verificada');
      
      this.logger.info('🚀 WhatsApp Agent inicializado correctamente');
    } catch (error) {
      this.logger.error('Error inicializando WhatsApp Agent', { error });
      throw error;
    }
  }

  async processIncomingMessage(message: IncomingMessage): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      this.stats.totalMessages++;
      
      // Obtener número de teléfono limpio
      const phoneNumber = this.extractPhoneNumber(message.from);
      const sessionId = `whatsapp_${phoneNumber}`;
      
      this.logger.info('Procesando mensaje entrante', {
        from: phoneNumber,
        messageLength: message.body.length,
        profileName: message.profileName
      });

      // Analizar el mensaje
      const messageAnalysis = MessageParser.parse(message.body);
      
      // Verificar si es una emergencia
      if (messageAnalysis.type === 'emergency') {
        return await this.handleEmergency(message, phoneNumber);
      }

      // Obtener o crear conversación
      let conversation = await this.conversationManager.getConversation(sessionId);
      
      if (!conversation) {
        // Inicializar memoria en MCP
        await this.mcpClient.initializeMemory(sessionId, 'whatsapp_consultation');
        conversation = await this.conversationManager.createConversation(sessionId, phoneNumber, message.profileName);
      }

      // Agregar mensaje a la memoria
      await this.mcpClient.addToMemory(
        sessionId,
        'message',
        message.body,
        'user_input',
        { phoneNumber, profileName: message.profileName, analysis: messageAnalysis }
      );

      // Determinar la intención del usuario
      const intent = await this.determineUserIntent(message.body, conversation);
      
      // Generar respuesta basada en la intención
      const response = await this.generateContextualResponse(
        message.body,
        intent,
        conversation,
        messageAnalysis
      );

      // Enviar respuesta
      if (response) {
        await this.sendMessage(message.from, response);
        
        // Agregar respuesta a la memoria
        await this.mcpClient.addToMemory(
          sessionId,
          'response',
          response,
          'agent_response',
          { intent, timestamp: new Date().toISOString() }
        );

        // Actualizar conversación
        await this.conversationManager.updateConversation(sessionId, {
          lastMessage: message.body,
          lastResponse: response,
          lastActivity: new Date(),
          messageCount: conversation.messageCount + 1
        });
      }

      // Actualizar estadísticas
      const responseTime = Date.now() - startTime;
      this.updateStats(responseTime, true);

      return response;
    } catch (error) {
      this.logger.error('Error procesando mensaje', { error, message });
      this.updateStats(Date.now() - startTime, false);
      
      // Enviar mensaje de error amigable
      const errorResponse = 'Disculpa, tengo problemas técnicos en este momento. Por favor intenta nuevamente en unos minutos o contacta directamente a nuestra línea de emergencias.';
      await this.sendMessage(message.from, errorResponse);
      
      return null;
    }
  }

  private async handleEmergency(message: IncomingMessage, phoneNumber: string): Promise<string> {
    this.stats.emergencyContacts++;
    
    this.logger.warn('EMERGENCIA DETECTADA', {
      from: phoneNumber,
      message: message.body,
      profileName: message.profileName
    });

    // Buscar paciente en la base de datos
    const patientInfo = await this.mcpClient.searchPatients(phoneNumber);
    
    const emergencyResponse = `🚨 EMERGENCIA DETECTADA 🚨

Hola ${message.profileName}, he detectado que tu mensaje indica una emergencia médica.

${patientInfo ? `Te hemos identificado como: ${patientInfo.name}` : 'Para tu seguridad, por favor identifícate.'}

Por favor:
1️⃣ Si es una emergencia que pone en riesgo la vida, llama INMEDIATAMENTE al 123
2️⃣ Para urgencias médicas, contacta a nuestro número de emergencias: ${process.env.EMERGENCY_PHONE}
3️⃣ Proporciona tu ubicación exacta

Estoy notificando a nuestro equipo médico de emergencias.

¿Necesitas que contacte a algún familiar o conocido?`;

    // Notificar al equipo médico (aquí podrías integrar con un sistema de alertas)
    await this.notifyEmergencyTeam(message, phoneNumber, patientInfo);

    return emergencyResponse;
  }

  private async determineUserIntent(message: string, conversation: any): Promise<string> {
    try {
      const prompt = `
Analiza el siguiente mensaje de WhatsApp de un paciente y determina la intención principal.
Contexto de conversación: ${conversation.messageCount} mensajes previos.

Mensaje: "${message}"

Intenciones posibles:
- greeting: Saludo inicial
- appointment_request: Solicitar cita médica
- appointment_modify: Modificar cita existente
- symptom_inquiry: Consulta sobre síntomas
- prescription_refill: Renovar receta médica
- test_results: Preguntar por resultados de exámenes
- general_info: Información general sobre servicios
- payment_inquiry: Consultas sobre pagos o facturación
- complaint: Quejas o reclamos
- emergency: Situación de emergencia
- goodbye: Despedida

Responde solo con la intención identificada.`;

      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.1
      });

      return response.choices[0]?.message?.content?.trim().toLowerCase() || 'general_info';
    } catch (error) {
      this.logger.error('Error determinando intención', { error });
      return 'general_info';
    }
  }

  private async generateContextualResponse(
    message: string,
    intent: string,
    conversation: any,
    analysis: any
  ): Promise<string> {
    try {
      const sessionId = conversation.sessionId;
      
      // Obtener memoria de la conversación
      const memoryData = await this.mcpClient.getMemory(sessionId);
      
      // Generar contexto para ChatGPT
      const systemPrompt = `Eres un asistente médico virtual inteligente de Biosanarcall, especializado en atención médica por WhatsApp.

INFORMACIÓN DEL SISTEMA:
- Nombre: Dr. IA Biosanarcall
- Especialidad: Asistente médico virtual
- Capacidades: Programar citas, consultar síntomas, información médica general

CONTEXTO DE LA CONVERSACIÓN:
- Paciente: ${conversation.patientName || 'Sin identificar'}
- Sesión: ${sessionId}
- Mensajes previos: ${conversation.messageCount}
- Intención detectada: ${intent}
- Memoria: ${JSON.stringify(memoryData, null, 2)}

DIRECTRICES DE RESPUESTA:
1. Sé empático, profesional y amigable
2. Usa emojis apropiados para WhatsApp
3. Mantén respuestas concisas (máximo 300 caracteres por mensaje)
4. Si necesitas información médica específica, pregunta por partes
5. Para emergencias, deriva inmediatamente
6. Para citas, usa el sistema MCP para consultar disponibilidad
7. Nunca des diagnósticos definitivos
8. Siempre recuerda que eres un asistente, no reemplazas consulta médica

ACCIONES DISPONIBLES:
- Programar citas: Usa searchAvailabilities del MCP
- Buscar pacientes: Usa searchPatients del MCP
- Consultar médicos: Usa getDoctors del MCP
- Obtener información médica: Usa el conocimiento base

Responde al siguiente mensaje del paciente:`;

      const userPrompt = `Mensaje del paciente: "${message}"

Por favor, genera una respuesta apropiada considerando el contexto y la intención detectada.`;

      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      let aiResponse = response.choices[0]?.message?.content?.trim() || 'Lo siento, no pude procesar tu mensaje. ¿Podrías reformularlo?';

      // Post-procesar respuesta para intenciones específicas
      if (intent === 'appointment_request') {
        aiResponse = await this.enhanceAppointmentResponse(aiResponse, sessionId);
      } else if (intent === 'symptom_inquiry') {
        aiResponse = await this.enhanceSymptomResponse(aiResponse, sessionId);
      }

      return aiResponse;
    } catch (error) {
      this.logger.error('Error generando respuesta contextual', { error });
      return 'Disculpa, tengo dificultades para procesar tu mensaje. ¿Podrías intentar nuevamente?';
    }
  }

  private async enhanceAppointmentResponse(response: string, sessionId: string): Promise<string> {
    try {
      // Consultar disponibilidades del día
      const today = new Date().toISOString().split('T')[0];
      const availabilities = await this.mcpClient.searchAvailabilities(today);
      
      if (availabilities && availabilities.length > 0) {
        const availableSlots = availabilities.slice(0, 3).map((slot: any) => 
          `📅 ${slot.date} a las ${slot.start_time} - Dr. ${slot.doctor_name}`
        ).join('\n');
        
        response += `\n\nDisponibilidad hoy:\n${availableSlots}\n\n¿Te interesa alguno de estos horarios?`;
      }
      
      return response;
    } catch (error) {
      this.logger.error('Error mejorando respuesta de citas', { error });
      return response;
    }
  }

  private async enhanceSymptomResponse(response: string, sessionId: string): Promise<string> {
    try {
      // Agregar disclaimers médicos
      const disclaimer = '\n\n⚠️ *Importante*: Esta información es orientativa. Para un diagnóstico preciso, consulta con un médico.';
      
      return response + disclaimer;
    } catch (error) {
      this.logger.error('Error mejorando respuesta de síntomas', { error });
      return response;
    }
  }

  async sendMessage(to: string, message: string): Promise<any> {
    try {
      const result = await this.twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER!,
        to: to,
        body: message
      });

      this.logger.info('Mensaje enviado exitosamente', {
        to: to,
        messageId: result.sid,
        messageLength: message.length
      });

      return result;
    } catch (error) {
      this.logger.error('Error enviando mensaje', { error, to, message });
      throw error;
    }
  }

  private extractPhoneNumber(from: string): string {
    // Extraer número de teléfono del formato whatsapp:+1234567890
    return from.replace('whatsapp:', '').replace('+', '');
  }

  private async notifyEmergencyTeam(message: IncomingMessage, phoneNumber: string, patientInfo: any): Promise<void> {
    // Aquí puedes implementar notificaciones al equipo médico
    // Por ejemplo: email, SMS, webhook a sistema hospitalario, etc.
    this.logger.warn('NOTIFICACIÓN DE EMERGENCIA', {
      patient: patientInfo?.name || 'Desconocido',
      phone: phoneNumber,
      message: message.body,
      timestamp: new Date().toISOString()
    });
  }

  private updateStats(responseTime: number, success: boolean): void {
    // Actualizar tiempo promedio de respuesta
    this.stats.avgResponseTime = (this.stats.avgResponseTime + responseTime) / 2;
    
    // Actualizar tasa de éxito
    if (success) {
      this.stats.successRate = ((this.stats.successRate * (this.stats.totalMessages - 1)) + 100) / this.stats.totalMessages;
    } else {
      this.stats.successRate = (this.stats.successRate * (this.stats.totalMessages - 1)) / this.stats.totalMessages;
    }
  }

  async getStats(): Promise<ConversationStats> {
    this.stats.activeConversations = await this.conversationManager.getActiveConversationsCount();
    return { ...this.stats };
  }
}