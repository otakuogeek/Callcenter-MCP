import { STTService } from './STTService';
import { TTSService } from './TTSService';
import { CallLogService } from './CallLogService';
import { WhatsAppAgentService } from './WhatsAppAgentService';
import { 
  ZadarmaCallEvent, 
  CallRecord, 
  VoiceProcessingResult, 
  CallSession,
  AudioFile,
  PatientData
} from '../types';

export class VoiceCallHandler {
  private sttService: STTService;
  private ttsService: TTSService;
  private callLogService: CallLogService;
  private whatsappAgentService: WhatsAppAgentService;
  private activeSessions: Map<string, CallSession> = new Map();

  constructor() {
    this.sttService = new STTService();
    this.ttsService = new TTSService();
    this.callLogService = new CallLogService();
    this.whatsappAgentService = new WhatsAppAgentService();
    
    // Limpiar sesiones expiradas cada 10 minutos
    setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000);
  }

  /**
   * Maneja inicio de llamada desde webhook de Zadarma
   */
  async handleCallStart(event: ZadarmaCallEvent): Promise<void> {
    try {
      console.log(`[VoiceHandler] Llamada iniciada: ${event.pbx_call_id} desde ${event.caller_id}`);

      // Crear registro de llamada
      const callRecord: Omit<CallRecord, 'id' | 'created_at'> = {
        call_id: event.pbx_call_id,
        caller_number: event.caller_id,
        called_number: event.called_did,
        start_time: new Date(event.call_start),
        status: 'incoming'
      };

      await this.callLogService.createCallRecord(callRecord);

      // Crear sesión de llamada
      const session: CallSession = {
        callId: event.pbx_call_id,
        callerId: event.caller_id,
        startTime: new Date(event.call_start),
        context: {
          conversationHistory: [],
          currentIntent: 'unknown',
          step: 'greeting'
        },
        lastActivity: new Date()
      };

      this.activeSessions.set(event.pbx_call_id, session);

      // Actualizar estado
      await this.callLogService.updateCallRecord(event.pbx_call_id, {
        status: 'processing'
      });

      console.log(`[VoiceHandler] Sesión de llamada creada: ${event.pbx_call_id}`);

    } catch (error: any) {
      console.error('[VoiceHandler] Error manejando inicio de llamada:', error);
      await this.callLogService.markCallAsFailed(event.pbx_call_id, `Error inicio: ${error.message}`);
    }
  }

  /**
   * Maneja fin de llamada
   */
  async handleCallEnd(event: ZadarmaCallEvent): Promise<void> {
    try {
      console.log(`[VoiceHandler] Llamada finalizada: ${event.pbx_call_id}, duración: ${event.duration}s`);

      // Actualizar registro con duración
      await this.callLogService.updateCallRecord(event.pbx_call_id, {
        end_time: new Date(),
        duration: event.duration,
        status: 'completed'
      });

      // Limpiar sesión activa
      this.activeSessions.delete(event.pbx_call_id);

      console.log(`[VoiceHandler] Llamada completada: ${event.pbx_call_id}`);

    } catch (error) {
      console.error('[VoiceHandler] Error manejando fin de llamada:', error);
    }
  }

  /**
   * Procesa grabación de llamada cuando está disponible
   */
  async handleCallRecording(event: ZadarmaCallEvent, recordingUrl: string): Promise<VoiceProcessingResult> {
    try {
      console.log(`[VoiceHandler] Procesando grabación: ${event.pbx_call_id}`);

      const session = this.activeSessions.get(event.pbx_call_id);
      if (!session) {
        throw new Error('Sesión de llamada no encontrada');
      }

      // Actualizar URL de grabación
      await this.callLogService.updateCallRecord(event.pbx_call_id, {
        recording_url: recordingUrl
      });

      // Convertir grabación a formato procesable
      const audioFile: AudioFile = {
        url: recordingUrl,
        format: 'mp3' // Zadarma típicamente usa MP3
      };

      // Transcribir audio
      const sttResult = await this.sttService.transcribeAudio(audioFile);
      console.log(`[VoiceHandler] Transcripción: "${sttResult.text}"`);

      // Actualizar transcript en base de datos
      await this.callLogService.updateCallRecord(event.pbx_call_id, {
        transcript: sttResult.text
      });

      // Extraer datos de paciente del transcript
      const patientData = this.whatsappAgentService.extractPatientDataFromVoice(sttResult.text);
      
      // Actualizar contexto de sesión
      session.context.patientData = { ...session.context.patientData, ...patientData };
      session.context.conversationHistory.push(`Cliente: ${sttResult.text}`);
      session.context.currentIntent = this.whatsappAgentService.determineVoiceIntent(sttResult.text);
      session.lastActivity = new Date();

      // Procesar mensaje con agente de WhatsApp
      const agentResponse = await this.whatsappAgentService.processVoiceMessage(
        sttResult.text,
        session.callerId,
        session.context
      );

      // Adaptar respuesta para voz
      const voiceResponse = this.whatsappAgentService.adaptResponseForVoice(agentResponse);

      // Actualizar historial
      session.context.conversationHistory.push(`Asistente: ${voiceResponse.message}`);

      // Generar audio de respuesta
      const contextType = this.determineResponseContext(session.context.currentIntent);
      const ttsResult = await this.ttsService.generateMedicalResponse(voiceResponse.message, contextType);

      // Actualizar registro con respuesta
      await this.callLogService.updateCallRecord(event.pbx_call_id, {
        agent_response: voiceResponse.message,
        audio_response_url: this.ttsService.getPublicAudioUrl(ttsResult.audioUrl),
        patient_id: (await this.getPatientIdIfRegistered(patientData)) || undefined,
        appointment_created: this.checkIfAppointmentCreated(agentResponse)
      });

      const result: VoiceProcessingResult = {
        success: true,
        transcript: sttResult.text,
        response: voiceResponse.message,
        audioUrl: this.ttsService.getPublicAudioUrl(ttsResult.audioUrl),
        patientRegistered: agentResponse.mcpToolsUsed?.includes('createSimplePatient') || false,
        appointmentCreated: agentResponse.mcpToolsUsed?.includes('createAppointment') || false
      };

      console.log(`[VoiceHandler] Procesamiento completado para ${event.pbx_call_id}`);
      return result;

    } catch (error: any) {
      console.error('[VoiceHandler] Error procesando grabación:', error);
      
      await this.callLogService.markCallAsFailed(
        event.pbx_call_id, 
        `Error procesamiento: ${error.message}`
      );

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Procesa llamada en tiempo real (si se implementa streaming)
   */
  async handleRealTimeCall(callId: string, audioChunk: Buffer): Promise<string | null> {
    try {
      const session = this.activeSessions.get(callId);
      if (!session) {
        console.warn(`[VoiceHandler] Sesión no encontrada para llamada en tiempo real: ${callId}`);
        return null;
      }

      // Aquí se implementaría procesamiento en tiempo real
      // Por ahora retornamos null indicando que se procesará al final
      session.lastActivity = new Date();
      return null;

    } catch (error) {
      console.error('[VoiceHandler] Error en procesamiento tiempo real:', error);
      return null;
    }
  }

  /**
   * Obtiene información de sesión activa
   */
  getActiveSession(callId: string): CallSession | null {
    return this.activeSessions.get(callId) || null;
  }

  /**
   * Obtiene estadísticas de llamadas
   */
  async getCallStatistics(days: number = 7) {
    return this.callLogService.getCallStatistics(days);
  }

  /**
   * Busca llamadas por contenido
   */
  async searchCalls(searchTerm: string, limit: number = 20) {
    return this.callLogService.searchCallsByTranscript(searchTerm, limit);
  }

  /**
   * Determina contexto de respuesta según intent
   */
  private determineResponseContext(intent: string): 'greeting' | 'appointment' | 'registration' | 'emergency' | 'general' {
    switch (intent) {
      case 'greeting':
        return 'greeting';
      case 'appointment_request':
      case 'appointment_cancel':
      case 'appointment_reschedule':
        return 'appointment';
      case 'patient_registration':
        return 'registration';
      case 'emergency':
        return 'emergency';
      default:
        return 'general';
    }
  }

  /**
   * Verifica si se registró un paciente
   */
  private async getPatientIdIfRegistered(patientData: Partial<PatientData>): Promise<number | null> {
    if (!patientData.document) return null;
    
    try {
      // Aquí se buscaría en la base de datos si el paciente fue registrado
      // Por ahora retornamos null - esto se implementaría con una consulta real
      return null;
    } catch (error) {
      console.warn('[VoiceHandler] Error verificando registro de paciente:', error);
      return null;
    }
  }

  /**
   * Verifica si se creó una cita
   */
  private checkIfAppointmentCreated(agentResponse: any): boolean {
    return agentResponse.mcpToolsUsed?.includes('createAppointment') || 
           agentResponse.mcpToolsUsed?.includes('scheduleAppointment') || 
           false;
  }

  /**
   * Limpia sesiones expiradas (más de 30 minutos sin actividad)
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredThreshold = 30 * 60 * 1000; // 30 minutos

    for (const [callId, session] of this.activeSessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > expiredThreshold) {
        console.log(`[VoiceHandler] Limpiando sesión expirada: ${callId}`);
        this.activeSessions.delete(callId);
      }
    }
  }

  /**
   * Valida configuración de todos los servicios
   */
  async validateServices(): Promise<{
    stt: boolean;
    tts: boolean;
    database: boolean;
    whatsapp: boolean;
  }> {
    const results = {
      stt: true, // STTService no tiene validación específica
      tts: await this.ttsService.validateConfiguration(),
      database: await this.callLogService.checkConnection(),
      whatsapp: await this.whatsappAgentService.validateConfiguration()
    };

    console.log('[VoiceHandler] Validación de servicios:', results);
    return results;
  }

  /**
   * Limpieza al cerrar el servicio
   */
  async cleanup(): Promise<void> {
    console.log('[VoiceHandler] Iniciando limpieza...');
    
    // Limpiar archivos temporales
    this.sttService.cleanup();
    this.ttsService.cleanupOldAudioFiles();
    
    // Cerrar conexiones
    await this.callLogService.close();
    
    // Limpiar sesiones
    this.activeSessions.clear();
    
    console.log('[VoiceHandler] Limpieza completada');
  }
}