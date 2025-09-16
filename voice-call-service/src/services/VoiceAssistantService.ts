import express from 'express';
import { ElevenLabsHandler } from './ElevenLabsHandler';
import { ZadarmaClient } from './ZadarmaClient';

export class VoiceAssistantService {
  private elevenLabs: ElevenLabsHandler;
  private zadarma: ZadarmaClient;

  constructor() {
    this.elevenLabs = new ElevenLabsHandler();
    this.zadarma = new ZadarmaClient(
      process.env.ZADARMA_KEY || '',
      process.env.ZADARMA_SECRET || ''
    );
  }

  /**
   * Maneja una llamada entrante con asistente de voz
   */
  async handleIncomingCall(callData: any): Promise<string> {
    try {
      console.log('[VoiceAssistant] Procesando llamada entrante:', callData);

      // 1. Responder la llamada automáticamente
      await this.answerCall(callData.pbx_call_id);

      // 2. Reproducir saludo inicial
      const greeting = await this.generateGreeting(callData.caller_id);
      await this.playAudioToCall(callData.pbx_call_id, greeting);

      // 3. Iniciar conversación con ElevenLabs
      await this.startConversation(callData);

      return 'success';
    } catch (error: any) {
      console.error('[VoiceAssistant] Error:', error.message);
      throw error;
    }
  }

  /**
   * Responde una llamada automáticamente
   */
  private async answerCall(callId: string): Promise<void> {
    try {
      // Usar API de Zadarma para responder la llamada
      await this.zadarma.call('request/callback', {
        number: '100', // Extensión que responderá
        from: '576076916019'
      }, 'POST');
    } catch (error) {
      console.error('[VoiceAssistant] Error respondiendo llamada:', error);
    }
  }

  /**
   * Genera saludo personalizado
   */
  private async generateGreeting(callerNumber: string): Promise<string> {
    const greeting = `Hola, te has comunicado con Biosanar Call, tu asistente médico virtual. 
    Estoy aquí para ayudarte a agendar citas, consultar información médica o resolver tus dudas. 
    ¿En qué puedo ayudarte hoy?`;

    try {
      // Generar audio con ElevenLabs
      const audioUrl = await this.elevenLabs.generateSpeech(greeting);
      return audioUrl;
    } catch (error) {
      console.error('[VoiceAssistant] Error generando saludo:', error);
      return greeting; // Fallback texto
    }
  }

  /**
   * Reproduce audio en una llamada activa
   */
  private async playAudioToCall(callId: string, audioUrl: string): Promise<void> {
    try {
      // Implementar reproducción de audio en la llamada
      // Esto depende de las capacidades de Zadarma
      console.log(`[VoiceAssistant] Reproduciendo audio en llamada ${callId}: ${audioUrl}`);
    } catch (error) {
      console.error('[VoiceAssistant] Error reproduciendo audio:', error);
    }
  }

  /**
   * Inicia conversación interactiva con ElevenLabs
   */
  private async startConversation(callData: any): Promise<void> {
    try {
      // Configurar conversación con ElevenLabs Conversational AI
      const conversationConfig = {
        agent_id: process.env.ELEVENLABS_AGENT_ID,
        webhook_url: 'https://biosanarcall.site/webhook/elevenlabs',
        call_data: callData
      };

      // Iniciar sesión de conversación
      await this.elevenLabs.startConversation(conversationConfig);
      
    } catch (error) {
      console.error('[VoiceAssistant] Error iniciando conversación:', error);
    }
  }

  /**
   * Procesa respuesta del usuario durante la llamada
   */
  async processUserSpeech(audioData: any, callId: string): Promise<string> {
    try {
      // 1. Transcribir audio del usuario
      const transcript = await this.elevenLabs.transcribeAudio(audioData);
      
      // 2. Procesar intención (agendar cita, consulta, etc.)
      const intent = await this.processIntent(transcript);
      
      // 3. Generar respuesta apropiada
      const response = await this.generateResponse(intent, transcript);
      
      // 4. Convertir respuesta a audio
      const audioResponse = await this.elevenLabs.generateSpeech(response);
      
      // 5. Reproducir en la llamada
      await this.playAudioToCall(callId, audioResponse);
      
      return response;
    } catch (error: any) {
      console.error('[VoiceAssistant] Error procesando voz:', error.message);
      return 'Lo siento, no pude procesar tu solicitud. ¿Puedes repetirla?';
    }
  }

  /**
   * Procesa la intención del usuario
   */
  private async processIntent(transcript: string): Promise<string> {
    const lowerText = transcript.toLowerCase();
    
    if (lowerText.includes('cita') || lowerText.includes('agendar')) {
      return 'schedule_appointment';
    } else if (lowerText.includes('cancelar') || lowerText.includes('cambiar')) {
      return 'modify_appointment';
    } else if (lowerText.includes('información') || lowerText.includes('consulta')) {
      return 'medical_inquiry';
    } else if (lowerText.includes('emergencia') || lowerText.includes('urgente')) {
      return 'emergency';
    }
    
    return 'general_inquiry';
  }

  /**
   * Genera respuesta basada en la intención
   */
  private async generateResponse(intent: string, transcript: string): Promise<string> {
    switch (intent) {
      case 'schedule_appointment':
        return `Perfecto, te ayudo a agendar una cita. ¿Para qué especialidad necesitas la cita? 
                Tenemos disponibilidad en medicina general, pediatría, ginecología y otras especialidades.`;
        
      case 'modify_appointment':
        return `Entiendo que quieres modificar o cancelar una cita. 
                ¿Podrías proporcionarme tu número de documento o el código de tu cita?`;
        
      case 'medical_inquiry':
        return `Estoy aquí para ayudarte con información médica general. 
                ¿Sobre qué tema específico te gustaría consultar?`;
        
      case 'emergency':
        return `Si tienes una emergencia médica, te recomiendo contactar inmediatamente al 123 
                o dirigirte al centro de urgencias más cercano. Para citas regulares, puedo ayudarte aquí.`;
        
      default:
        return `Entiendo tu consulta. Puedo ayudarte a agendar citas médicas, consultar información 
                de salud general, o modificar citas existentes. ¿Con cuál de estas opciones te gustaría continuar?`;
    }
  }

  /**
   * Finaliza la llamada
   */
  async endCall(callId: string, reason: string = 'completed'): Promise<void> {
    try {
      console.log(`[VoiceAssistant] Finalizando llamada ${callId}: ${reason}`);
      
      // Enviar mensaje de despedida
      const farewell = `Gracias por contactar a Biosanar Call. 
                       Tu consulta ha sido procesada. ¡Que tengas un excelente día!`;
      
      const farewellAudio = await this.elevenLabs.generateSpeech(farewell);
      await this.playAudioToCall(callId, farewellAudio);
      
      // Colgar después de unos segundos
      setTimeout(async () => {
        await this.zadarma.call('request/hangup', {
          call_id: callId
        }, 'POST');
      }, 3000);
      
    } catch (error) {
      console.error('[VoiceAssistant] Error finalizando llamada:', error);
    }
  }
}