import fetch from 'node-fetch';
import crypto from 'crypto';

export class ElevenLabsHandler {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY no configurada');
    }
  }

  /**
   * Genera audio desde texto usando ElevenLabs
   */
  async generateSpeech(text: string, voiceId: string = 'EXAVITQu4vr4xnSDxMaL'): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      // Guardar el audio y retornar URL
      const audioBuffer = await response.buffer();
      const filename = `speech_${Date.now()}.mp3`;
      const audioPath = `/tmp/${filename}`;
      
      // En producción, guardar en un bucket S3 o similar
      require('fs').writeFileSync(audioPath, audioBuffer);
      
      // Retornar URL pública del audio
      return `https://biosanarcall.site/audio/${filename}`;
      
    } catch (error: any) {
      console.error('[ElevenLabs] Error generando speech:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe audio a texto
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      // ElevenLabs no tiene transcripción directa, usar OpenAI Whisper
      // O implementar con otro servicio
      
      console.log('[ElevenLabs] Transcribiendo audio...');
      
      // Por ahora, placeholder - implementar con Whisper API
      return "Texto transcrito placeholder";
      
    } catch (error: any) {
      console.error('[ElevenLabs] Error transcribiendo:', error.message);
      throw error;
    }
  }

  /**
   * Inicia conversación - Versión simplificada usando TTS
   */
  async startConversation(config: any): Promise<any> {
    try {
      console.log('[ElevenLabs] Iniciando conversación simplificada:', config);
      
      // Para SIP, usamos TTS directo en lugar de Conversational AI
      // Generar saludo inicial
      const greeting = config.greeting || "Hola, bienvenido a Biosanarcall. ¿En qué puedo ayudarte?";
      
      const audioUrl = await this.generateSpeech(
        greeting, 
        process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'
      );

      return {
        status: 'started',
        conversation_id: `conv_${Date.now()}`,
        greeting_audio: audioUrl,
        message: 'Conversación iniciada con TTS'
      };
      
    } catch (error: any) {
      console.error('[ElevenLabs] Error iniciando conversación:', error.message);
      
      // Fallback: respuesta básica sin audio
      return {
        status: 'started_fallback',
        conversation_id: `conv_${Date.now()}`,
        message: 'Conversación iniciada en modo texto'
      };
    }
  }

  /**
   * Valida webhook de ElevenLabs
   */
  validateWebhook(payload: string, signature: string): boolean {
    try {
      const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.warn('[ElevenLabs] No webhook secret configured');
        return false;
      }

      // Generar signature esperada
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      // Comparar signatures
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
      
    } catch (error: any) {
      console.error('[ElevenLabs] Error validando webhook:', error.message);
      return false;
    }
  }

  /**
   * Procesa webhook de ElevenLabs
   */
  async processWebhook(payload: any): Promise<any> {
    try {
      console.log('[ElevenLabs] Procesando webhook:', payload);

      switch (payload.type) {
        case 'conversation.started':
          return await this.handleConversationStarted(payload);
          
        case 'conversation.ended':
          return await this.handleConversationEnded(payload);
          
        case 'user.speech.transcribed':
          return await this.handleUserSpeech(payload);
          
        case 'agent.response.generated':
          return await this.handleAgentResponse(payload);
          
        default:
          console.warn('[ElevenLabs] Tipo de webhook no manejado:', payload.type);
          return { status: 'ignored' };
      }
      
    } catch (error: any) {
      console.error('[ElevenLabs] Error procesando webhook:', error.message);
      throw error;
    }
  }

  private async handleConversationStarted(payload: any): Promise<any> {
    console.log('[ElevenLabs] Conversación iniciada:', payload.conversation_id);
    return { status: 'conversation_started' };
  }

  private async handleConversationEnded(payload: any): Promise<any> {
    console.log('[ElevenLabs] Conversación finalizada:', payload.conversation_id);
    return { status: 'conversation_ended' };
  }

  private async handleUserSpeech(payload: any): Promise<any> {
    console.log('[ElevenLabs] Usuario habló:', payload.transcript);
    
    // Aquí puedes procesar la intención del usuario
    // y generar respuesta personalizada
    
    return { 
      status: 'speech_processed',
      transcript: payload.transcript 
    };
  }

  private async handleAgentResponse(payload: any): Promise<any> {
    console.log('[ElevenLabs] Agente respondió:', payload.response);
    return { status: 'agent_responded' };
  }
}