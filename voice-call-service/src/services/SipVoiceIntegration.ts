import { DirectSipClient } from './DirectSipClient';
import { VoiceAssistantService } from './VoiceAssistantService';
import { ElevenLabsHandler } from './ElevenLabsHandler';
import { EventEmitter } from 'events';

interface SipVoiceConfig {
  sip: {
    server: string;
    port: number;
    username: string;
    password: string;
    realm: string;
  };
  voice: {
    autoAnswer: boolean;
    greetingMessage: string;
    transcriptionEnabled: boolean;
  };
}

export class SipVoiceIntegration extends EventEmitter {
  private sipClient: DirectSipClient;
  private voiceAssistant: VoiceAssistantService;
  private elevenLabs: ElevenLabsHandler;
  private config: SipVoiceConfig;

  constructor(config: SipVoiceConfig) {
    super();
    this.config = config;

    // Inicializar componentes
    this.sipClient = new DirectSipClient(config.sip);
    this.voiceAssistant = new VoiceAssistantService();
    this.elevenLabs = new ElevenLabsHandler();

    this.setupEventHandlers();
  }

  /**
   * Configurar manejadores de eventos
   */
  private setupEventHandlers(): void {
    // Eventos SIP
    this.sipClient.on('registered', () => {
      console.log('[SipVoice] 🎯 SIP registrado - Listo para recibir llamadas');
      this.emit('ready');
    });

    this.sipClient.on('incomingCall', async (session) => {
      console.log(`[SipVoice] 📞 Llamada entrante de ${session.from}`);
      await this.handleIncomingCall(session);
    });

    this.sipClient.on('callConnected', async (session) => {
      console.log(`[SipVoice] 🎉 Llamada conectada: ${session.id}`);
      await this.handleCallConnected(session);
    });

    this.sipClient.on('callEnded', async (session) => {
      console.log(`[SipVoice] 📴 Llamada terminada: ${session.id}`);
      await this.handleCallEnded(session);
    });

    this.sipClient.on('error', (error) => {
      console.error('[SipVoice] ❌ Error SIP:', error);
      this.emit('error', error);
    });
  }

  /**
   * Iniciar el servicio
   */
  async start(): Promise<void> {
    try {
      console.log('[SipVoice] 🚀 Iniciando integración SIP + Voz...');

      // Conectar SIP
      await this.sipClient.connect();

      console.log('[SipVoice] ✅ Servicio iniciado exitosamente');

    } catch (error) {
      console.error('[SipVoice] ❌ Error iniciando servicio:', error);
      throw error;
    }
  }

  /**
   * Manejar llamada entrante
   */
  private async handleIncomingCall(session: any): Promise<void> {
    try {
      console.log(`[SipVoice] 🔄 Procesando llamada entrante: ${session.from} -> ${session.to}`);

      // Crear registro en base de datos
      const callData = {
        call_id: session.id,
        caller_number: session.from,
        called_number: session.to,
        start_time: session.startTime,
        status: 'incoming' as const
      };

      // Aquí puedes integrar con tu CallLogService si está disponible
      console.log('[SipVoice] 💾 Datos de llamada:', callData);

      this.emit('callReceived', callData);

    } catch (error) {
      console.error('[SipVoice] ❌ Error manejando llamada entrante:', error);
    }
  }

  /**
   * Manejar llamada conectada
   */
  private async handleCallConnected(session: any): Promise<void> {
    try {
      console.log(`[SipVoice] 🎤 Iniciando asistente de voz para: ${session.id}`);

      // Reproducir saludo inicial
      if (this.config.voice.greetingMessage) {
        await this.playGreeting(session.id);
      }

      // Iniciar procesamiento de voz
      await this.startVoiceProcessing(session);

      this.emit('voiceStarted', session);

    } catch (error) {
      console.error('[SipVoice] ❌ Error iniciando voz:', error);
    }
  }

  /**
   * Reproducir saludo inicial
   */
  private async playGreeting(callId: string): Promise<void> {
    try {
      const greeting = this.config.voice.greetingMessage || 
        "Hola, te has comunicado con Biosanar Call, tu asistente médico virtual. Estoy aquí para ayudarte a agendar citas, consultar información médica o resolver tus dudas. ¿En qué puedo ayudarte hoy?";

      console.log(`[SipVoice] 🔊 Reproduciendo saludo en llamada: ${callId}`);

      // Generar audio con ElevenLabs
      const audioUrl = await this.elevenLabs.generateSpeech(greeting);
      
      // Aquí se reproduce el audio en el canal SIP
      await this.playAudioToSip(callId, audioUrl);

      console.log(`[SipVoice] ✅ Saludo reproducido exitosamente`);

    } catch (error) {
      console.error('[SipVoice] ❌ Error reproduciendo saludo:', error);
    }
  }

  /**
   * Iniciar procesamiento de voz
   */
  private async startVoiceProcessing(session: any): Promise<void> {
    try {
      console.log(`[SipVoice] 🎙️ Iniciando procesamiento de voz para: ${session.id}`);

      // Configurar captura de audio desde SIP
      await this.setupAudioCapture(session.id);

      // Iniciar conversación con el asistente
      const conversationData = {
        pbx_call_id: session.id,
        caller_id: session.from,
        called_id: session.to,
        event: 'SIP_CONNECTED'
      };

      await this.voiceAssistant.handleIncomingCall(conversationData);

    } catch (error) {
      console.error('[SipVoice] ❌ Error iniciando procesamiento de voz:', error);
    }
  }

  /**
   * Configurar captura de audio desde SIP
   */
  private async setupAudioCapture(callId: string): Promise<void> {
    try {
      console.log(`[SipVoice] 🎧 Configurando captura de audio para: ${callId}`);

      // Aquí se configuraría la captura RTP del audio
      // Por ahora, simulamos con un timer que procesa audio cada pocos segundos
      
      const audioInterval = setInterval(async () => {
        try {
          // Simular captura de audio (en implementación real vendría del RTP)
          const simulatedAudio = this.generateSimulatedAudioData();
          
          await this.processIncomingAudio(callId, simulatedAudio);
          
        } catch (error) {
          console.error('[SipVoice] Error procesando audio capturado:', error);
        }
      }, 3000); // Procesar cada 3 segundos

      // Guardar referencia para poder limpiar después
      (this.sipClient as any).audioIntervals = (this.sipClient as any).audioIntervals || new Map();
      (this.sipClient as any).audioIntervals.set(callId, audioInterval);

    } catch (error) {
      console.error('[SipVoice] ❌ Error configurando captura de audio:', error);
    }
  }

  /**
   * Procesar audio entrante del usuario
   */
  private async processIncomingAudio(callId: string, audioData: Buffer): Promise<void> {
    try {
      if (!this.config.voice.transcriptionEnabled) {
        return;
      }

      console.log(`[SipVoice] 🔄 Procesando audio de usuario en: ${callId}`);

      // Convertir audio a base64 para el procesamiento
      const audioBase64 = audioData.toString('base64');

      // Procesar con el asistente de voz
      const response = await this.voiceAssistant.processUserSpeech(audioBase64, callId);

      if (response) {
        // Generar respuesta de audio
        const responseAudio = await this.elevenLabs.generateSpeech(response);
        
        // Reproducir respuesta en SIP
        await this.playAudioToSip(callId, responseAudio);
      }

    } catch (error) {
      console.error('[SipVoice] ❌ Error procesando audio entrante:', error);
    }
  }

  /**
   * Reproducir audio en canal SIP
   */
  private async playAudioToSip(callId: string, audioUrl: string): Promise<void> {
    try {
      console.log(`[SipVoice] 🔊 Reproduciendo audio en SIP: ${callId}`);
      
      // En implementación real, aquí se enviaría el audio por RTP
      // Por ahora solo loggeamos
      console.log(`[SipVoice] 🎵 Audio URL: ${audioUrl}`);

      // Simular tiempo de reproducción
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error('[SipVoice] ❌ Error reproduciendo audio en SIP:', error);
    }
  }

  /**
   * Generar datos de audio simulados (para testing)
   */
  private generateSimulatedAudioData(): Buffer {
    // Generar buffer de audio simulado (en implementación real vendría del RTP)
    const audioSize = 1024;
    const audioBuffer = Buffer.alloc(audioSize);
    
    // Llenar con datos aleatorios que simulen audio
    for (let i = 0; i < audioSize; i++) {
      audioBuffer[i] = Math.floor(Math.random() * 256);
    }
    
    return audioBuffer;
  }

  /**
   * Manejar llamada terminada
   */
  private async handleCallEnded(session: any): Promise<void> {
    try {
      console.log(`[SipVoice] 🏁 Finalizando llamada: ${session.id}`);

      // Limpiar intervalos de audio
      const audioIntervals = (this.sipClient as any).audioIntervals;
      if (audioIntervals && audioIntervals.has(session.id)) {
        clearInterval(audioIntervals.get(session.id));
        audioIntervals.delete(session.id);
      }

      // Finalizar asistente de voz
      await this.voiceAssistant.endCall(session.id, 'call_ended');

      this.emit('callCompleted', session);

    } catch (error) {
      console.error('[SipVoice] ❌ Error finalizando llamada:', error);
    }
  }

  /**
   * Colgar llamada manualmente
   */
  async hangupCall(callId: string): Promise<void> {
    try {
      console.log(`[SipVoice] 📴 Colgando llamada: ${callId}`);
      this.sipClient.hangupCall(callId);
    } catch (error) {
      console.error('[SipVoice] ❌ Error colgando llamada:', error);
      throw error;
    }
  }

  /**
   * Obtener estado del servicio
   */
  getStatus(): any {
    return {
      sipRegistered: this.sipClient.getRegistrationStatus(),
      activeCalls: this.sipClient.getActiveCalls(),
      config: {
        server: this.config.sip.server,
        username: this.config.sip.username,
        autoAnswer: this.config.voice.autoAnswer
      }
    };
  }

  /**
   * Detener servicio
   */
  stop(): void {
    try {
      console.log('[SipVoice] 🛑 Deteniendo servicio...');
      
      // Limpiar intervalos de audio
      const audioIntervals = (this.sipClient as any).audioIntervals;
      if (audioIntervals) {
        for (const interval of audioIntervals.values()) {
          clearInterval(interval);
        }
        audioIntervals.clear();
      }

      this.sipClient.disconnect();
      
      console.log('[SipVoice] ✅ Servicio detenido');
      
    } catch (error) {
      console.error('[SipVoice] ❌ Error deteniendo servicio:', error);
    }
  }
}