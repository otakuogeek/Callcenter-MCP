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
  timestamp?: Date;
  isVoiceMessage?: boolean;
  mediaUrl?: string;
  mediaContentType?: string;
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
      
      // Enviar mensaje de error amigable con información útil inmediata
      const errorResponse = `Disculpa, hay una dificultad técnica momentánea. Mientras tanto, puedes contactarnos directamente:

🏥 **SEDE SAN GIL:**
📞 6076911308
📍 Cra. 9 #10-29, San Gil, Santander
🕒 Lunes a Viernes 7am-6pm | Urgencias 24/7

🏥 **SEDE SOCORRO:**
📞 77249700  
📍 Calle 12 #13-31, Socorro, Santander
🕒 Lunes a viernes 7am-6pm

Para emergencias médicas, acude inmediatamente a nuestra sede de San Gil que cuenta con atención 24 horas.`;
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
- patient_registration: Registrar nuevo paciente o completar datos personales
- specialty_inquiry: Consulta sobre especialidades médicas
- doctor_availability: Consulta de disponibilidad médica
- eps_inquiry: Información sobre EPS y seguros
- document_inquiry: Información sobre documentos requeridos
- location_inquiry: Información sobre ubicaciones y sedes
- symptom_inquiry: Consulta sobre síntomas
- prescription_refill: Renovar receta médica
- test_results: Preguntar por resultados de exámenes
- general_info: Información general sobre servicios
- payment_inquiry: Consultas sobre pagos o facturación
- complaint: Quejas o reclamos
- emergency: Situación de emergencia médica
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
      const systemPrompt = await this.buildDynamicSystemPrompt(intent, conversation, memoryData, sessionId);

      const userPrompt = `Mensaje del paciente: "${message}"

IMPORTANTE: Responde de manera inmediata y útil. No uses frases como "permíteme un momento", "dame un momento" o similares. Proporciona información específica y opciones concretas basadas en tu conocimiento actualizado de sedes, especialidades y médicos.`;

      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 600,
        temperature: 0.5
      });

      let aiResponse = response.choices[0]?.message?.content?.trim() || 'Lo siento, no pude procesar tu mensaje. ¿Podrías reformularlo?';

      // Post-procesar respuesta para intenciones específicas
      this.logger.info('Intent detectado:', { intent });
      
      if (intent === 'appointment_request') {
        aiResponse = await this.enhanceAppointmentResponse(aiResponse, sessionId);
      } else if (intent === 'patient_registration') {
        this.logger.info('🔍 Procesando registro de paciente', { message, sessionId });
        aiResponse = await this.handlePatientRegistration(message, sessionId, memoryData);
      } else if (intent === 'symptom_inquiry') {
        aiResponse = await this.enhanceSymptomResponse(aiResponse, sessionId);
      } else if (intent === 'location_inquiry') {
        aiResponse = await this.enhanceLocationResponse(aiResponse, sessionId);
      } else if (intent === 'eps_inquiry') {
        aiResponse = await this.enhanceEPSResponse(aiResponse, sessionId);
      } else if (intent === 'document_inquiry') {
        aiResponse = await this.enhanceDocumentResponse(aiResponse, sessionId);
      }
      // Nota: specialty_inquiry removido para evitar duplicación - la información ya está en buildDynamicSystemPrompt

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

  private async handlePatientRegistration(message: string, sessionId: string, memoryData: any): Promise<string> {
    try {
      // Extraer información del mensaje (nombre y documento) - VERSIÓN MEJORADA
      const nameMatch = message.match(/(?:soy|llamo|nombre es|me llamo)\s+([A-Za-z\sáéíóúñü]+?)(?:\s*,|\s*y|\s*con|\s*c[eé]dula|\s*documento|\s*el|\s*mi|\s*$)/i);
      const documentMatch = message.match(/(?:c[eé]dula|documento|cedula|cc|identificaci[oó]n)?\s*:?\s*(\d{7,12})/i);
      
      // Patrones mejorados para diferentes formatos
      const formats = [
        // "Nombre Apellido 12345678" (nombre seguido de números)
        { pattern: /^([A-Za-z\sáéíóúñü]+?)\s+(\d{7,12})$/i, nameGroup: 1, docGroup: 2 },
        // "12345678 Nombre Apellido" (documento seguido de nombre)  
        { pattern: /^(\d{7,12})\s+([A-Za-z\sáéíóúñü]+)$/i, nameGroup: 2, docGroup: 1 },
        // "Nombre, 12345678" (con coma)
        { pattern: /^([A-Za-z\sáéíóúñü]+),\s*(\d{7,12})$/i, nameGroup: 1, docGroup: 2 },
        // "12345678, Nombre" (documento con coma)
        { pattern: /^(\d{7,12}),\s*([A-Za-z\sáéíóúñü]+)$/i, nameGroup: 2, docGroup: 1 }
      ];
      
      let extractedName = '';
      let extractedDocument = '';
      
      // Probar todos los patrones
      for (const format of formats) {
        const match = message.match(format.pattern);
        if (match) {
          extractedName = match[format.nameGroup].trim();
          extractedDocument = match[format.docGroup].trim();
          console.log(`✅ Patrón detectado: ${format.pattern}`, { extractedName, extractedDocument });
          break;
        }
      }
      
      // Si no encontramos con patrones combinados, buscar individualmente
      if (!extractedName && !extractedDocument) {
        if (nameMatch) extractedName = nameMatch[1].trim();
        if (documentMatch) extractedDocument = documentMatch[1].trim();
        
        // Buscar solo nombre si es texto sin números
        if (!extractedName && /^[A-Za-z\sáéíóúñü]+$/.test(message.trim())) {
          extractedName = message.trim();
          console.log('✅ Solo nombre detectado:', extractedName);
        }
        
        // Buscar solo documento si es solo números
        if (!extractedDocument && /^\d{7,12}$/.test(message.trim())) {
          extractedDocument = message.trim();
          console.log('✅ Solo documento detectado:', extractedDocument);
        }
      }
      
      // Limpiar y normalizar nombre
      if (extractedName) {
        extractedName = extractedName.replace(/[^\w\sáéíóúñü]/gi, '').trim();
        extractedName = extractedName.replace(/\s+/g, ' '); // Normalizar espacios
        // Capitalizar primera letra de cada palabra
        extractedName = extractedName.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
      
      // Limpiar documento (solo números)
      if (extractedDocument) {
        extractedDocument = extractedDocument.replace(/\D/g, '');
      }
      
      console.log('📝 Datos extraídos del mensaje:', { extractedName, extractedDocument });
      
      // Revisar memoria para ver si tenemos información previa
      let storedName = '';
      let storedDocument = '';
      
      if (memoryData && memoryData.conversation_data) {
        try {
          const conversation = JSON.parse(memoryData.conversation_data);
          storedName = conversation.patient_name || '';
          storedDocument = conversation.patient_document || '';
        } catch (e) {
          // Si no se puede parsear, continuar sin memoria
        }
      }
      
      // Combinar información actual con la almacenada
      const finalName = extractedName || storedName;
      const finalDocument = extractedDocument || storedDocument;
      
      // Actualizar memoria con nueva información
      const memoryUpdate: any = {};
      if (extractedName) memoryUpdate.patient_name = extractedName;
      if (extractedDocument) memoryUpdate.patient_document = extractedDocument;
      
      if (Object.keys(memoryUpdate).length > 0) {
        await this.mcpClient.addToMemory(
          sessionId,
          'patient_data',
          JSON.stringify(memoryUpdate),
          'patient_info'
        );
      }
      
      // Si tenemos nombre y documento, proceder con el registro
      if (finalName && finalDocument) {
        this.logger.info('Intentando registrar paciente', { 
          name: finalName, 
          document: finalDocument,
          sessionId 
        });
        
        try {
          const registrationResult = await this.mcpClient.createSimplePatient({
            name: finalName,
            document: finalDocument
          });
          
          if (registrationResult && !registrationResult.error) {
            this.logger.info('Paciente registrado exitosamente', { 
              patientId: registrationResult.id,
              name: finalName,
              document: finalDocument 
            });
            
            return `✅ **¡Registro Completado!**

¡Perfecto! He registrado exitosamente a **${finalName}** con el número de documento **${finalDocument}** en nuestro sistema Biosanar. 😊

📋 **Información registrada:**
• **Nombre:** ${finalName}
• **Documento:** ${finalDocument}
• **ID del paciente:** ${registrationResult.id || 'Asignado'}

✨ **Ahora puedes:**
• Agendar citas médicas
• Consultar tus citas programadas  
• Hacer consultas médicas con nuestros especialistas

🏥 **Disponemos de:**
• 12 especialidades médicas
• Sedes en San Gil y Socorro
• Horarios flexibles

¿Te gustaría agendar una cita médica ahora? 📅`;
          } else {
            this.logger.error('Error en el registro de paciente', { 
              error: registrationResult?.error,
              name: finalName,
              document: finalDocument 
            });
            
            return `❌ **Error en el Registro**

Lo siento, hubo un problema al registrarte en el sistema:
${registrationResult?.error || 'Error desconocido'}

Por favor, intenta nuevamente o contacta con nuestro soporte.`;
          }
        } catch (error) {
          this.logger.error('Excepción durante el registro de paciente', { 
            error: error,
            name: finalName,
            document: finalDocument 
          });
          
          return `❌ **Error Técnico**

Lo siento, no pude completar tu registro en este momento debido a un error técnico.

Por favor, intenta nuevamente en unos minutos o contacta con nuestro soporte.`;
        }
      } else {
        // Solicitar información faltante
        if (!finalName && !finalDocument) {
          return `📝 **Registro de Nuevo Paciente**

¡Excelente! Te ayudo a registrarte en nuestro sistema.

Para completar tu registro, solo necesito 2 datos básicos:

👤 **Tu nombre completo**
🆔 **Tu número de documento**

Por favor compártelos conmigo.`;
        } else if (!finalName) {
          return `👤 **Necesito tu Nombre**

Ya tengo tu número de documento: **${finalDocument}**

Solo me falta tu nombre completo para completar el registro.

¿Cuál es tu nombre completo?`;
        } else if (!finalDocument) {
          return `🆔 **Necesito tu Documento**

Ya tengo tu nombre: **${finalName}**

Solo me falta tu número de cédula para completar el registro.

¿Cuál es tu número de documento?`;
        }
      }
      
      return 'Por favor proporciona tu nombre completo y número de documento para registrarte.';
      
    } catch (error) {
      this.logger.error('Error manejando registro de paciente', { error, sessionId });
      return 'Lo siento, hubo un error procesando tu registro. Por favor intenta nuevamente.';
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

  private async buildDynamicSystemPrompt(intent: string, conversation: any, memoryData: any, sessionId: string): Promise<string> {
    try {
      // Consultar dinámicamente información actualizada del MCP
      const [locationsData, specialtiesData] = await Promise.all([
        this.mcpClient.getLocations(),
        this.mcpClient.getSpecialties()
      ]);

      // Construir información de sedes dinámicamente
      let sedesInfo = 'INFORMACIÓN DE NUESTRAS SEDES:\n\n';
      
      if (locationsData?.locations?.length > 0) {
        locationsData.locations.forEach((location: any) => {
          sedesInfo += `🏥 ${location.name.toUpperCase()}:\n`;
          sedesInfo += `📍 Dirección: ${location.address}\n`;
          sedesInfo += `📞 Teléfono: ${location.phone}\n`;
          if (location.capacity) {
            sedesInfo += `👥 Capacidad: ${location.capacity} pacientes activos\n`;
          }
          if (location.hours) {
            sedesInfo += `🕒 Horarios: ${location.hours}\n`;
          }
          if (location.emergency_hours) {
            sedesInfo += `🚨 Urgencias: ${location.emergency_hours}\n`;
          }
          sedesInfo += '\n';
        });
      } else {
        sedesInfo += '🏥 Información de sedes en actualización. Contacta directamente para detalles.\n\n';
      }

      // Construir información de especialidades dinámicamente
      let especialidadesInfo = 'ESPECIALIDADES MÉDICAS DISPONIBLES:\n\n';
      
      if (specialtiesData?.specialties?.length > 0) {
        // Ordenar alfabéticamente para presentación consistente
        const sortedSpecialties = specialtiesData.specialties.sort((a: any, b: any) => 
          a.name.localeCompare(b.name)
        );

        // Agrupar por primera letra para mejor organización
        const specialtiesByLetter = sortedSpecialties.reduce((acc: any, specialty: any) => {
          const firstLetter = specialty.name.charAt(0).toUpperCase();
          if (!acc[firstLetter]) {
            acc[firstLetter] = [];
          }
          acc[firstLetter].push(specialty);
          return acc;
        }, {});

        // Mostrar todas las especialidades organizadas alfabéticamente
        Object.keys(specialtiesByLetter).sort().forEach(letter => {
          especialidadesInfo += `**${letter}:**\n`;
          specialtiesByLetter[letter].forEach((spec: any) => {
            especialidadesInfo += `• **${spec.name}** (${spec.default_duration_minutes} min)`;
            if (spec.description && spec.description !== spec.name) {
              especialidadesInfo += ` - ${spec.description}`;
            }
            especialidadesInfo += '\n';
          });
          especialidadesInfo += '\n';
        });

        especialidadesInfo += `**INFORMACIÓN IMPORTANTE:**\n`;
        especialidadesInfo += `- Total de especialidades activas: ${specialtiesData.specialties.length}\n`;
        especialidadesInfo += `- Todas las especialidades están disponibles en nuestras sedes\n`;
        especialidadesInfo += `- Sistema de citas online disponible las 24 horas\n`;
        especialidadesInfo += `- Para casos urgentes, contamos con servicio de emergencias\n\n`;
      } else {
        especialidadesInfo += '🩺 Información de especialidades en actualización. Contacta directamente para detalles.\n\n';
      }

      // Construir prompt completo
      const systemPrompt = `Eres Valeria, la asistente virtual de Biosanarcall - un sistema médico especializado en San Gil y Socorro, Santander, Colombia.

${sedesInfo}

${especialidadesInfo}

CONTEXTO DE LA CONVERSACIÓN:
- Paciente: ${conversation.patientName || 'Sin identificar'}
- Sesión: ${sessionId}
- Mensajes previos: ${conversation.messageCount}
- Intención detectada: ${intent}
- Memoria: ${JSON.stringify(memoryData, null, 2)}

TU PERSONALIDAD Y COMPORTAMIENTO:
- Sé cálida, profesional y empática
- Usa emojis apropiados para hacer la conversación más amigable
- Mantén un tono conversacional pero informativo
- Siempre ofrece opciones específicas cuando sea posible
- Si no tienes información específica, ofrece contactar directamente

CAPACIDADES ESPECIALES:
- Puedes agendar citas consultando disponibilidad en tiempo real
- Tienes acceso a información de especialistas y horarios
- Puedes consultar información de EPS y tipos de documento
- Puedes proporcionar direcciones y datos de contacto de las sedes
- Puedes responder preguntas sobre servicios y procedimientos

INFORMACIÓN DETALLADA DE MÉDICOS:
- SIEMPRE incluye nombre completo del médico cuando menciones disponibilidad
- SIEMPRE especifica horarios de atención (mañana 8:00-12:00, tarde 14:00-17:00)
- SIEMPRE menciona la especialidad del médico
- SIEMPRE indica en qué sede atiende el médico
- Ejemplo correcto: "Dra. Ana Teresa Escobar (Medicina General) atiende en mañanas de 8:00 a 12:00 y tardes de 14:00 a 17:00 en nuestra sede de San Gil"

BÚSQUEDA INTELIGENTE DE MÉDICOS:
- Si alguien menciona solo un nombre (ej: "Doctor Carlos"), LISTA TODOS los médicos con ese nombre
- Incluye nombre completo, especialidad y sede para cada coincidencia
- Sugiere búsqueda por especialidad si hay múltiples opciones
- Ejemplo: "Tenemos varios médicos llamados Carlos: 1) Dr. Carlos Rafael Almira (Ginecología) en San Gil, 2) Dr. Carlos Escorcia (Medicina General) en Socorro. ¿Cuál te interesa o prefieres buscar por especialidad?"
- Si no hay coincidencias exactas, sugiere nombres similares y búsqueda por especialidad

INSTRUCCIONES ESPECÍFICAS:
- Para citas urgentes, prioriza las sedes con servicio de urgencias 24h
- Para consultas de rutina, ofrece ambas sedes según conveniencia del paciente
- Siempre confirma datos importantes antes de agendar
- Si detectas una emergencia médica, recomienda acudir inmediatamente a urgencias
- Mantén la confidencialidad y profesionalismo en todo momento

REGLAS CRÍTICAS DE RESPUESTA:
- NUNCA digas "Permíteme un momento", "Dame un momento", "Espera mientras busco" o similares
- NUNCA pongas al paciente en espera - siempre da una respuesta inmediata
- SIEMPRE responde con información útil desde el primer mensaje
- Si necesitas información adicional, pide los datos específicos que necesitas
- Proporciona opciones concretas y accionables en cada respuesta
- Si no tienes información completa, ofrece lo que sí puedes proporcionar inmediatamente

REGLAS ANTI-ALUCINACIÓN (MUY IMPORTANTE):
- SOLO usa nombres de médicos que aparezcan EXACTAMENTE en los datos del MCP
- NUNCA inventes o modifiques nombres de médicos (como "Dr. Carlos Mendoza" o "Dra. Laura Camila Martínez")
- SOLO menciona especialidades que existan realmente en la base de datos
- Si no hay médicos para una especialidad, informa claramente que no están disponibles
- SIEMPRE verifica que el médico y especialidad coincidan con los datos reales
- Si dudas sobre un dato, mejor di que no tienes la información y ofrece contactar directamente

ESTILO DE RESPUESTA:
- Respuestas directas y útiles desde el primer contacto
- Proporciona información inmediata basada en tu conocimiento actualizado
- Ofrece opciones específicas y siguientes pasos claros
- Usa un tono amigable pero eficiente

EJEMPLOS DE RESPUESTAS CORRECTAS (SIN ESPERAS - SOLO DATOS REALES):
✅ "Tenemos 12 especialidades disponibles en nuestras dos sedes..."
✅ "Para Medicina General, tenemos a la Dra. Ana Teresa Escobar que atiende en San Gil."
✅ "Te ayudo inmediatamente. Para Ginecología tenemos al Dr. Carlos Rafael Almira que atiende en San Gil."
✅ "Para agendar con el Dr. Alexander Rugeles (Medicina Familiar) necesito tu tipo y número de documento. Él atiende en San Gil."
✅ "La Dra. Laura Juliana Morales Poveda (Odontología) atiende en San Gil y Socorro. ¿Prefieres alguna sede en particular?"
✅ "Para Dermatología tenemos al Dr. Erwin Alirio Vargas Ariza en nuestra sede de San Gil."

EJEMPLOS DE BÚSQUEDA POR NOMBRE:
✅ "Tenemos varios médicos llamados Carlos: 1) Dr. Carlos Rafael Almira (Ginecología) en San Gil, 2) Dr. Calixto Escorcia Angulo (Medicina General) en Socorro. ¿Cuál te interesa?"
✅ "Encontré estas opciones con el nombre Laura: Dra. Laura Juliana Morales Poveda (Odontología) en San Gil y Socorro. ¿Es la que buscas?"
✅ "Para el nombre Alexander tenemos: Dr. Alexander Rugeles (Medicina Familiar) en San Gil. ¿Te sirve esta información?"
✅ "No encontré médicos con el nombre 'Dave'. ¿Podrías especificar el nombre completo o prefieres buscar por especialidad?"

RESPUESTAS CUANDO NO HAY MÉDICOS DISPONIBLES:
✅ "Lo siento, actualmente no tenemos cardiólogos registrados en nuestras sedes. Te sugiero contactar directamente con nuestras sedes para más información."
✅ "No encontré especialistas en esa área en nuestro registro actual. ¿Te interesa alguna otra especialidad que sí tengamos disponible?"
✅ "Para esa especialidad no tengo médicos disponibles en este momento. Puedo ofrecerte información de contacto de nuestras sedes para consulta directa."

EJEMPLOS INCORRECTOS (NUNCA USES):
❌ "Permíteme un momento mientras busco..."
❌ "Dame un segundo para consultar..."
❌ "Espera que reviso la información..."
❌ "Un momento por favor..."
❌ "Tenemos médicos disponibles" (sin especificar nombres, horarios y especialidad)
❌ NUNCA inventes nombres de médicos como "Dr. Carlos Mendoza" o "Dra. Laura Camila Martínez"
❌ NUNCA cambies nombres reales como cambiar "Laura Juliana Morales Poveda" por "Laura Camila Martínez"

ACCIONES DISPONIBLES (SOLO DATOS REALES):
- Programar citas: Usa searchAvailabilities del MCP para obtener horarios específicos REALES
- Buscar pacientes: Usa searchPatients del MCP  
- Registrar pacientes nuevos: Usa createSimplePatient del MCP (ULTRA-SIMPLE: solo nombre completo y documento)
- Consultar médicos: Usa getDoctors del MCP (incluye nombres, especialidades, sedes) - SOLO datos verificados
- Verificar disponibilidad: Usa getAvailabilities para horarios detallados (start_time, end_time, doctor_name, specialty_name, location_name)
- Si no hay datos disponibles: Informa claramente que no hay médicos registrados en esa especialidad

IMPORTANTE PARA REGISTRO DE PACIENTES:
- SIEMPRE usa createSimplePatient (NO createPatient) para registro desde WhatsApp
- ULTRA-SIMPLE: Solo requiere 2 campos OBLIGATORIOS: nombre completo y número de documento
- NO pidas teléfono, email, fecha nacimiento, ni otros datos - son INNECESARIOS
- El sistema auto-completa todos los demás campos automáticamente
- Después del registro exitoso, confirma al paciente que ya está registrado en el sistema

EJEMPLO DE USO:
Usuario: "Quiero registrarme, soy Juan Pérez, cédula 12345678"
Agente: Usa createSimplePatient con {document: "12345678", name: "Juan Pérez"}

PROTOCOLO DE VERIFICACIÓN DE DATOS:
1. ANTES de mencionar un médico, VERIFICA que existe en los datos del MCP
2. ANTES de mencionar una especialidad, CONFIRMA que hay médicos registrados
3. Si no encuentras médicos para una especialidad solicitada, di: "No tenemos [especialidad] registrada actualmente"
4. Si no estás seguro de un dato, di: "Te recomiendo contactar directamente con nuestras sedes"

PROTOCOLO PARA BÚSQUEDA POR NOMBRE:
1. Si mencionan solo un nombre (ej: "Doctor Carlos", "Doctora Laura"):
   - Busca TODOS los médicos que contengan ese nombre en cualquier parte
   - Lista cada coincidencia con: Nombre completo, especialidad, sede
   - Pregunta cuál específicamente le interesa
   - Sugiere búsqueda por especialidad como alternativa
2. Si no hay coincidencias:
   - Confirma que no tienes médicos con ese nombre
   - Sugiere verificar el nombre completo o buscar por especialidad
   - Ofrece listar especialidades disponibles

FORMATO REQUERIDO PARA INFORMACIÓN DE MÉDICOS (SOLO DATOS VERIFICADOS):
Cuando menciones médicos disponibles, SIEMPRE incluye:
1. Nombre completo del médico EXACTO del MCP (ej: "Dra. Ana Teresa Escobar")
2. Especialidad entre paréntesis EXACTA del MCP (ej: "(Medicina General)")  
3. Horarios específicos basados en disponibilidades reales (ej: "mañanas 8:00-12:00, tardes 14:00-17:00")
4. Sede donde atiende REAL del MCP (ej: "en nuestra sede de San Gil")

Responde al siguiente mensaje del paciente:`;

      return systemPrompt;
    } catch (error) {
      this.logger.error('Error construyendo prompt dinámico', { error });
      
      // Fallback a prompt básico si hay error
      return `Eres Valeria, la asistente virtual de Biosanarcall. 
      
      Estoy experimentando dificultades técnicas para acceder a la información actualizada de nuestras sedes y especialidades. 
      Para obtener información precisa sobre ubicaciones, horarios y especialidades disponibles, por favor contacta directamente con nuestras sedes.
      
      CONTEXTO DE LA CONVERSACIÓN:
      - Paciente: ${conversation.patientName || 'Sin identificar'}
      - Sesión: ${sessionId}
      - Intención detectada: ${intent}
      
      Responde de manera empática y profesional, ofreciendo contactar directamente para información específica.`;
    }
  }

  private async enhanceSpecialtyResponse(response: string, sessionId: string): Promise<string> {
    try {
      const specialtiesData = await this.mcpClient.getSpecialties();
      
      if (specialtiesData?.specialties?.length > 0) {
        let categorizedInfo = '\n\n*📋 Especialidades Médicas Disponibles:*\n\n';
        
        // Ordenar alfabéticamente para presentación consistente
        const sortedSpecialties = specialtiesData.specialties.sort((a: any, b: any) => 
          a.name.localeCompare(b.name)
        );

        // Mostrar todas las especialidades dinámicamente
        sortedSpecialties.forEach((spec: any) => {
          categorizedInfo += `• **${spec.name}** (${spec.default_duration_minutes} min)`;
          if (spec.description && spec.description !== spec.name) {
            categorizedInfo += ` - ${spec.description}`;
          }
          categorizedInfo += '\n';
        });

        categorizedInfo += '\n*💡 Información importante:*\n';
        categorizedInfo += `• Total de especialidades: ${specialtiesData.specialties.length}\n`;
        categorizedInfo += '• Disponibles en todas nuestras sedes\n';
        categorizedInfo += '• Citas disponibles online 24/7\n';

        return response + categorizedInfo;
      } else {
        return response + '\n\n*ℹ️ Para información específica sobre especialidades, contacta directamente con nuestras sedes.*';
      }
    } catch (error) {
      this.logger.error('Error enriqueciendo respuesta de especialidades', { error });
      return response;
    }
  }

  private async enhanceLocationResponse(response: string, sessionId: string): Promise<string> {
    try {
      const locationsData = await this.mcpClient.getLocations();
      
      if (locationsData?.locations?.length > 0) {
        let locationInfo = '\n\n*📍 Información detallada de nuestras sedes:*\n\n';
        
        locationsData.locations.forEach((location: any) => {
          locationInfo += `*🏥 ${location.name.toUpperCase()}*\n`;
          locationInfo += `📍 *Dirección:* ${location.address}\n`;
          locationInfo += `📞 *Teléfono:* ${location.phone}\n`;
          locationInfo += `🕒 *Horarios:* ${location.operating_hours}\n`;
          
          if (location.services) {
            locationInfo += `🏥 *Servicios:* ${location.services}\n`;
          }
          
          if (location.patient_capacity) {
            locationInfo += `👥 *Capacidad:* ${location.patient_capacity} pacientes\n`;
          }
          
          locationInfo += '\n';
        });
        
        locationInfo += '*🚗 Cómo llegar:*\n';
        locationInfo += '• Ambas sedes están ubicadas en el centro de cada ciudad\n';
        locationInfo += '• Fácil acceso en transporte público\n';
        locationInfo += '• Parqueadero disponible\n';
        
        return response + locationInfo;
      } else {
        return response + '\n\n*ℹ️ Para información detallada sobre ubicaciones, contacta directamente con nuestras sedes.*';
      }
    } catch (error) {
      this.logger.error('Error enriqueciendo respuesta de ubicaciones', { error });
      return response;
    }
  }

  private async enhanceEPSResponse(response: string, sessionId: string): Promise<string> {
    try {
      const epsData = await this.mcpClient.getEPS();
      
      if (epsData?.eps?.length > 0) {
        let epsInfo = '\n\n*📋 EPS que atendemos:*\n';
        epsData.eps.forEach((eps: any) => {
          epsInfo += `• ${eps.name}\n`;
        });
        
        epsInfo += '\n*ℹ️ Información importante:*\n';
        epsInfo += '• Verifica que tu EPS esté al día\n';
        epsInfo += '• Trae tu carnet de afiliación\n';
        epsInfo += '• Algunos servicios pueden requerir autorización previa\n';
        epsInfo += '• Para consultas particulares, consulta nuestras tarifas\n';
        
        return response + epsInfo;
      } else {
        return response + '\n\n*ℹ️ Para información específica sobre tu EPS, contacta directamente con nuestras sedes.*';
      }
    } catch (error) {
      this.logger.error('Error enriqueciendo respuesta de EPS', { error });
      return response;
    }
  }

  private async enhanceDocumentResponse(response: string, sessionId: string): Promise<string> {
    try {
      const docTypes = await this.mcpClient.getDocumentTypes();
      
      if (docTypes?.document_types?.length > 0) {
        let docInfo = '\n\n*📄 Documentos de identificación que aceptamos:*\n';
        docTypes.document_types.forEach((doc: any) => {
          docInfo += `• ${doc.name} (${doc.code})\n`;
        });
        
        return response + docInfo;
      } else {
        return response + '\n\n*ℹ️ Aceptamos cédula de ciudadanía, tarjeta de identidad, pasaporte y otros documentos oficiales.*';
      }
    } catch (error) {
      this.logger.error('Error enriqueciendo respuesta de documentos', { error });
      return response;
    }
  }
}