import axios, { AxiosInstance } from 'axios';
import pool from '../db/pool';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import zadarmaVoiceService from './zadarma-voice.service';
import { elevenLabsOutboundService } from './elevenlabs-outbound.service';
import { zadarmaRealCallService } from './zadarma-real-verified.service';

interface ElevenLabsConfig {
  apiKey: string;
  agentId?: string;
  webhookUrl?: string;
  maxCallDuration?: number;
}

interface CallOptions {
  phoneNumber: string;
  patientId?: number;
  patientName?: string;
  appointmentId?: number;
  agentId?: string;
  metadata?: Record<string, any>;
  customVariables?: Record<string, any>;
  directCall?: boolean; // Si es true, usa llamada directa sin agente
  message?: string; // Mensaje directo a reproducir (solo para directCall)
  voiceId?: string; // ID de voz para llamadas directas
}

interface CallResponse {
  success: boolean;
  conversationId?: string;
  callId?: string;
  status?: string;
  error?: string;
  details?: any;
}

interface AgentInfo {
  agent_id: string;
  name: string;
  conversation_config?: any;
  platform_settings?: any;
}

/**
 * Servicio para gestionar llamadas salientes con ElevenLabs Conversational AI
 */
export class ElevenLabsService {
  private client: AxiosInstance;
  private config: ElevenLabsConfig;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(config?: Partial<ElevenLabsConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.ELEVENLABS_API_KEY || '',
      agentId: config?.agentId || process.env.ELEVENLABS_AGENT_ID,
      webhookUrl: config?.webhookUrl || process.env.ELEVENLABS_WEBHOOK_URL,
      maxCallDuration: config?.maxCallDuration 
        ? parseInt(config.maxCallDuration.toString()) 
        : parseInt(process.env.ELEVENLABS_MAX_CALL_DURATION || '600')
    };

    if (!this.config.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'xi-api-key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Obtiene la lista de agentes disponibles
   */
  async listAgents(): Promise<AgentInfo[]> {
    try {
      const response = await this.client.get('/convai/agents');
      return response.data.agents || [];
    } catch (error: any) {
      console.error('Error listing ElevenLabs agents:', error.response?.data || error.message);
      throw new Error(`Failed to list agents: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Obtiene información de un agente específico
   */
  async getAgent(agentId: string): Promise<AgentInfo> {
    try {
      const response = await this.client.get(`/convai/agents/${agentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting ElevenLabs agent:', error.response?.data || error.message);
      throw new Error(`Failed to get agent: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Inicia una llamada saliente a un número telefónico
   */
  async initiateCall(options: CallOptions): Promise<CallResponse> {
    // Si es una llamada directa sin agente, usar método alternativo
    if (options.directCall) {
      return this.initiateDirectCall(options);
    }

    try {
      const agentId = options.agentId || this.config.agentId;
      
      if (!agentId) {
        throw new Error('Agent ID is required. Set ELEVENLABS_AGENT_ID or provide agentId in options');
      }

      // Normalizar número telefónico
      const phoneNumber = this.normalizePhoneNumber(options.phoneNumber);

      // Preparar variables dinámicas para el agente
      const dynamicVariables: Record<string, string> = {
        patient_name: options.patientName || 'Paciente',
        phone_number: phoneNumber,
        ...(options.customVariables || {})
      };

      if (options.patientId) {
        dynamicVariables.patient_id = options.patientId.toString();
      }

      if (options.appointmentId) {
        dynamicVariables.appointment_id = options.appointmentId.toString();
      }

      // Configurar la llamada
      const callPayload = {
        agent_id: agentId,
        phone_number: phoneNumber,
        ...(this.config.webhookUrl && {
          webhook_url: this.config.webhookUrl
        }),
        conversation_config_override: {
          agent: {
            prompt: {
              dynamic_variables: dynamicVariables
            }
          }
        },
        metadata: {
          patient_id: options.patientId?.toString(),
          appointment_id: options.appointmentId?.toString(),
          initiated_at: new Date().toISOString(),
          ...(options.metadata || {})
        }
      };

      console.log('📞 [ElevenLabs] Iniciando llamada:', {
        agentId,
        phoneNumber,
        patientId: options.patientId,
        appointmentId: options.appointmentId
      });

      // Realizar la llamada a la API de ElevenLabs
      const response = await this.client.post('/convai/conversation/phone', callPayload);

      const conversationId = response.data.conversation_id;

      console.log('✅ [ElevenLabs] Llamada iniciada exitosamente:', {
        conversationId,
        status: response.data.status
      });

      // Guardar registro en la base de datos
      await this.saveCallRecord({
        conversationId,
        agentId,
        phoneNumber,
        patientId: options.patientId,
        appointmentId: options.appointmentId,
        status: 'initiated',
        metadata: callPayload.metadata
      });

      return {
        success: true,
        conversationId,
        callId: conversationId,
        status: response.data.status || 'initiated',
        details: response.data
      };

    } catch (error: any) {
      console.error('❌ [ElevenLabs] Error iniciando llamada:', error.response?.data || error.message);
      
      // Guardar error en logs
      await this.saveCallError({
        phoneNumber: options.phoneNumber,
        patientId: options.patientId,
        error: error.response?.data || error.message
      });

      return {
        success: false,
        error: error.response?.data?.detail || error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Inicia una llamada directa sin agente (usando Text-to-Speech)
   * Útil para mensajes simples de confirmación, recordatorios, etc.
   */
  async initiateDirectCall(options: CallOptions): Promise<CallResponse> {
    try {
      // Normalizar número telefónico
      const phoneNumber = this.normalizePhoneNumber(options.phoneNumber);

      if (!options.message) {
        throw new Error('Message is required for direct calls');
      }

      // Usar voz por defecto o la especificada
      const voiceId = options.voiceId || 'cjVigY5qzO86Huf0OWal'; // Voz del agente por defecto

      console.log('📞 [ElevenLabs] Iniciando llamada directa:', {
        phoneNumber,
        message: options.message.substring(0, 50) + '...',
        voiceId
      });

      // Generar audio del mensaje usando Text-to-Speech
      const ttsResponse = await this.client.post(
        `/text-to-speech/${voiceId}`,
        {
          text: options.message,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.0
          }
        },
        {
          responseType: 'arraybuffer'
        }
      );

      // Convertir audio a base64
      const audioBase64 = Buffer.from(ttsResponse.data).toString('base64');

      // Guardar el registro como llamada directa
      // El audio será reproducido por Zadarma (sistema de telefonía VoIP)
      console.log('[ElevenLabs] Audio TTS generado exitosamente para Zadarma');
      
      const directCallId = `direct_${Date.now()}`;

      await this.saveCallRecord({
        conversationId: directCallId,
        agentId: 'direct_call',
        phoneNumber,
        patientId: options.patientId,
        appointmentId: options.appointmentId,
        status: 'direct_call_generated',
        metadata: {
          message: options.message,
          voice_id: voiceId,
          call_type: 'direct',
          ...(options.metadata || {})
        }
      });

      console.log('✅ [ElevenLabs] Audio generado para llamada directa:', directCallId);

      // 🔥 NUEVO: Iniciar llamada automáticamente con Zadarma
      console.log('📞 [ElevenLabs → Zadarma] Iniciando llamada telefónica...');
      const audioBuffer = Buffer.from(ttsResponse.data);
      
      const zadarmaResult = await zadarmaVoiceService.initiateCallWithElevenLabsAudio(
        phoneNumber,
        audioBuffer
      );

      let finalStatus = 'audio_generated';
      let zadarmaCallId = null;

      if (zadarmaResult.status === 'success' && zadarmaResult.call_id) {
        finalStatus = 'call_initiated';
        zadarmaCallId = zadarmaResult.call_id;
        console.log('✅ [Zadarma] Llamada iniciada con éxito. Call ID:', zadarmaCallId);
      } else {
        console.warn('⚠️  [Zadarma] No se pudo iniciar la llamada:', zadarmaResult.message);
      }

      return {
        success: true,
        conversationId: directCallId,
        callId: zadarmaCallId || directCallId,
        status: finalStatus,
        details: {
          message: zadarmaCallId 
            ? `Llamada iniciada exitosamente a ${phoneNumber}` 
            : 'Audio generado. Llamada no iniciada automáticamente.',
          audioBase64: audioBase64.substring(0, 100) + '...',
          phoneNumber,
          zadarmaCallId,
          zadarmaStatus: zadarmaResult.status,
          note: zadarmaCallId 
            ? `Llamada en progreso con Zadarma (Call ID: ${zadarmaCallId})`
            : 'Audio listo. Verificar configuración de Zadarma.'
        }
      };

    } catch (error: any) {
      console.error('❌ [ElevenLabs] Error en llamada directa:', error.response?.data || error.message);
      
      await this.saveCallError({
        phoneNumber: options.phoneNumber,
        patientId: options.patientId,
        error: error.response?.data || error.message
      });

      return {
        success: false,
        error: error.response?.data?.detail || error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Inicia una llamada telefónica REAL usando ElevenLabs Conversational AI
   * Esta es la forma más directa de hacer llamadas salientes
   */
  async initiateRealCall(options: CallOptions): Promise<CallResponse> {
    try {
      const phoneNumber = this.normalizePhoneNumber(options.phoneNumber);
      
      console.log('📞 [ElevenLabs] Intentando llamada REAL saliente...');
      console.log('   Número destino:', phoneNumber);
      console.log('   Mensaje:', options.message?.substring(0, 50) + '...');

      // Intentar hacer la llamada real usando el servicio de ElevenLabs
      const result = await elevenLabsOutboundService.makeOutboundCall(
        phoneNumber,
        options.message
      );

      if (result.success) {
        // Guardar el registro de la llamada en la base de datos
        const conversationId = result.conversationId;
        
        await this.saveCallRecord({
          conversationId,
          phoneNumber,
          patientId: options.patientId,
          appointmentId: options.appointmentId,
          agentId: options.agentId || this.config.agentId || '',
          status: 'real_call_initiated',
          metadata: {
            ...options.metadata,
            message: options.message,
            callType: 'real_outbound'
          }
        });

        console.log('✅ [ElevenLabs] Llamada REAL iniciada exitosamente');
        console.log('   Conversation ID:', conversationId);
        console.log('   Estado:', result.status);

        return {
          success: true,
          conversationId,
          status: result.status,
          details: {
            message: `Llamada telefónica REAL iniciada a ${phoneNumber}`,
            phoneNumber,
            conversationId,
            note: 'El teléfono debería estar sonando en este momento'
          }
        };
      }

      return result;

    } catch (error: any) {
      console.error('❌ [ElevenLabs] Error en llamada real:', error.message);
      
      // Si es un error de plan (404), intentar con llamada directa como fallback
      if (error.message.includes('plan')) {
        console.log('⚠️  Llamadas reales no disponibles en el plan actual');
        console.log('   Usando fallback: generando audio TTS...');
        
        return await this.initiateDirectCall({
          ...options,
          directCall: true
        });
      }

      await this.saveCallError({
        phoneNumber: options.phoneNumber,
        patientId: options.patientId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Inicia una llamada telefónica REAL VERIFICADA usando Zadarma
   * Este método usa las credenciales verificadas y el SIP 895480
   */
  async makePhysicalCall(options: CallOptions): Promise<CallResponse> {
    try {
      const phoneNumber = this.normalizePhoneNumber(options.phoneNumber);
      
      console.log('📞 [ElevenLabs → Zadarma] Iniciando llamada FÍSICA real...');
      console.log('   Número destino:', phoneNumber);

      // 1. Generar audio TTS primero
      if (!options.message) {
        throw new Error('Message is required for physical calls');
      }

      const voiceId = options.voiceId || 'cjVigY5qzO86Huf0OWal';
      
      console.log('🎤 Generando audio TTS...');
      const ttsResponse = await this.client.post(
        `/text-to-speech/${voiceId}`,
        {
          text: options.message,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.0
          }
        },
        {
          responseType: 'arraybuffer'
        }
      );

      const audioBase64 = Buffer.from(ttsResponse.data).toString('base64');
      const conversationId = `physical_${Date.now()}`;

      // 2. Guardar en base de datos
      await this.saveCallRecord({
        conversationId,
        phoneNumber,
        patientId: options.patientId,
        appointmentId: options.appointmentId,
        agentId: 'zadarma_sip_895480',
        status: 'physical_call_initiated',
        metadata: {
          ...options.metadata,
          message: options.message,
          callType: 'physical_zadarma',
          audioSize: audioBase64.length
        }
      });

      // 3. Hacer la llamada REAL con Zadarma
      console.log('📞 Iniciando llamada física con Zadarma...');
      const zadarmaResult = await zadarmaRealCallService.makeRealCall(phoneNumber);

      if (zadarmaResult.success) {
        console.log('✅ [Zadarma] ¡LLAMADA FÍSICA INICIADA!');
        console.log('   From:', zadarmaResult.from);
        console.log('   To:', zadarmaResult.to);
        console.log('   Time:', zadarmaResult.timestamp);

        return {
          success: true,
          conversationId,
          status: 'physical_call_ringing',
          details: {
            message: `¡Llamada FÍSICA iniciada! El teléfono ${phoneNumber} debería estar sonando.`,
            phoneNumber,
            conversationId,
            zadarmaFrom: zadarmaResult.from,
            zadarmaTo: zadarmaResult.to,
            timestamp: zadarmaResult.timestamp,
            note: 'El SIP 895480 llamará primero, luego conectará automáticamente con el destino',
            audioGenerated: true
          }
        };
      }

      return {
        success: false,
        error: zadarmaResult.error || 'Error iniciando llamada física',
        details: zadarmaResult.data
      };

    } catch (error: any) {
      console.error('❌ [Physical Call] Error:', error.message);
      
      await this.saveCallError({
        phoneNumber: options.phoneNumber,
        patientId: options.patientId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene el estado de una conversación
   */
  async getConversationStatus(conversationId: string): Promise<any> {
    try {
      const response = await this.client.get(`/convai/conversations/${conversationId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting conversation status:', error.response?.data || error.message);
      throw new Error(`Failed to get conversation: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Finaliza una llamada activa
   */
  async endCall(conversationId: string): Promise<boolean> {
    try {
      await this.client.delete(`/convai/conversations/${conversationId}`);
      
      // Actualizar estado en la base de datos
      await pool.execute(
        `UPDATE elevenlabs_conversations 
         SET status = 'ended_manually', 
             end_time = NOW() 
         WHERE conversation_id = ?`,
        [conversationId]
      );

      console.log('✅ [ElevenLabs] Llamada finalizada:', conversationId);
      return true;
    } catch (error: any) {
      console.error('❌ [ElevenLabs] Error finalizando llamada:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Normaliza un número telefónico al formato internacional
   */
  private normalizePhoneNumber(phone: string): string {
    // Eliminar espacios, guiones y paréntesis
    let normalized = phone.replace(/[\s\-()]/g, '');

    // Si no empieza con +, agregar código de país (Colombia +57 por defecto)
    if (!normalized.startsWith('+')) {
      // Si empieza con 57, agregar +
      if (normalized.startsWith('57')) {
        normalized = '+' + normalized;
      } else {
        // Agregar código de país de Colombia
        normalized = '+57' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Guarda el registro de una llamada en la base de datos
   */
  private async saveCallRecord(data: {
    conversationId: string;
    agentId: string;
    phoneNumber: string;
    patientId?: number;
    appointmentId?: number;
    status: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await pool.execute(
        `INSERT INTO elevenlabs_conversations 
         (conversation_id, agent_id, phone_number, patient_id, appointment_id, 
          status, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         updated_at = NOW()`,
        [
          data.conversationId,
          data.agentId,
          data.phoneNumber,
          data.patientId || null,
          data.appointmentId || null,
          data.status,
          JSON.stringify(data.metadata || {})
        ]
      );
    } catch (error) {
      console.error('Error saving call record:', error);
    }
  }

  /**
   * Guarda un error de llamada
   */
  private async saveCallError(data: {
    phoneNumber: string;
    patientId?: number;
    error: any;
  }): Promise<void> {
    try {
      await pool.execute(
        `INSERT INTO elevenlabs_call_errors 
         (phone_number, patient_id, error_details, created_at)
         VALUES (?, ?, ?, NOW())`,
        [
          data.phoneNumber,
          data.patientId || null,
          JSON.stringify(data.error)
        ]
      );
    } catch (error) {
      console.error('Error saving call error:', error);
    }
  }

  /**
   * Busca un paciente por número telefónico
   */
  async findPatientByPhone(phoneNumber: string): Promise<number | null> {
    try {
      const normalized = this.normalizePhoneNumber(phoneNumber);
      
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM patients 
         WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') 
         LIKE CONCAT('%', REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), '+', ''), '%')
         LIMIT 1`,
        [normalized]
      );

      return rows.length > 0 ? rows[0].id : null;
    } catch (error) {
      console.error('Error finding patient by phone:', error);
      return null;
    }
  }

  /**
   * Obtiene estadísticas de llamadas
   */
  async getCallStats(filters?: {
    startDate?: string;
    endDate?: string;
    patientId?: number;
    status?: string;
  }): Promise<any> {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_calls,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
          AVG(duration_secs) as avg_duration,
          SUM(cost) as total_cost
        FROM elevenlabs_conversations
        WHERE 1=1
      `;
      
      const params: any[] = [];

      if (filters?.startDate) {
        query += ' AND created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        query += ' AND created_at <= ?';
        params.push(filters.endDate);
      }

      if (filters?.patientId) {
        query += ' AND patient_id = ?';
        params.push(filters.patientId);
      }

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      const [rows] = await pool.execute<RowDataPacket[]>(query, params);
      return rows[0] || {};
    } catch (error) {
      console.error('Error getting call stats:', error);
      throw error;
    }
  }
}

// Exportar instancia singleton
export const elevenLabsService = new ElevenLabsService();

// Exportar la clase para tests o instancias personalizadas
export default ElevenLabsService;
