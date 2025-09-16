import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { TTSResult } from '../types';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
}

export class TTSService {
  private apiKey: string;
  private baseUrl: string = 'https://api.elevenlabs.io/v1';
  private outputDir: string;
  private defaultVoiceId: string;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    this.defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam (inglés)
    this.outputDir = path.join(__dirname, '../../audio-output');
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Convierte texto a audio usando ElevenLabs API directa
   */
  async generateSpeech(
    text: string, 
    voiceId?: string,
    options?: {
      model?: string;
      stability?: number;
      similarityBoost?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    }
  ): Promise<TTSResult> {
    try {
      console.log(`[TTS] Generando audio para texto: "${text.substring(0, 100)}..."`);
      
      const selectedVoiceId = voiceId || this.defaultVoiceId;
      const fileName = `tts_${Date.now()}.mp3`;
      const filePath = path.join(this.outputDir, fileName);

      // Configuración por defecto optimizada para español médico
      const requestBody = {
        text: text,
        model_id: options?.model || 'eleven_multilingual_v2',
        voice_settings: {
          stability: options?.stability || 0.5,
          similarity_boost: options?.similarityBoost || 0.8,
          style: options?.style || 0.0,
          use_speaker_boost: options?.useSpeakerBoost || true
        }
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/text-to-speech/${selectedVoiceId}`,
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        data: requestBody,
        responseType: 'stream',
        timeout: 30000
      });

      // Guardar audio
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const stats = fs.statSync(filePath);
          const result: TTSResult = {
            audioUrl: filePath,
            voiceId: selectedVoiceId,
            size: stats.size,
            duration: this.estimateAudioDuration(text)
          };
          
          console.log(`[TTS] Audio generado exitosamente: ${fileName}`);
          resolve(result);
        });
        
        writer.on('error', (error) => {
          console.error('[TTS] Error guardando audio:', error);
          reject(error);
        });
      });

    } catch (error: any) {
      console.error('[TTS] Error generando audio:', error);
      throw new Error(`Error TTS: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Obtiene lista de voces disponibles
   */
  async getAvailableVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseUrl}/voices`,
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data.voices.map((voice: any) => ({
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category
      }));

    } catch (error: any) {
      console.error('[TTS] Error obteniendo voces:', error);
      throw new Error(`Error obteniendo voces: ${error.message}`);
    }
  }

  /**
   * Busca la mejor voz para contenido médico en español
   */
  async selectMedicalVoice(): Promise<string> {
    try {
      const voices = await this.getAvailableVoices();
      
      // Preferencias por nombre para contexto médico
      const medicalVoicePreferences = [
        'Adam', 'Antoni', 'Arnold', 'Domi', 'Elli', 'Josh', 'Marcus'
      ];

      for (const preference of medicalVoicePreferences) {
        const voice = voices.find(v => v.name.toLowerCase().includes(preference.toLowerCase()));
        if (voice) {
          console.log(`[TTS] Voz médica seleccionada: ${voice.name} (${voice.voice_id})`);
          return voice.voice_id;
        }
      }

      console.log('[TTS] Usando voz por defecto para contenido médico');
      return this.defaultVoiceId;

    } catch (error: any) {
      console.warn('[TTS] Error seleccionando voz médica, usando defecto:', error.message);
      return this.defaultVoiceId;
    }
  }

  /**
   * Genera respuestas específicas para contexto médico
   */
  async generateMedicalResponse(
    message: string,
    context: 'greeting' | 'appointment' | 'registration' | 'emergency' | 'general' = 'general'
  ): Promise<TTSResult> {
    // Ajustar configuración según contexto
    const contextSettings = {
      greeting: { stability: 0.6, similarityBoost: 0.9, style: 0.2 },
      appointment: { stability: 0.5, similarityBoost: 0.8, style: 0.1 },
      registration: { stability: 0.4, similarityBoost: 0.8, style: 0.0 },
      emergency: { stability: 0.3, similarityBoost: 0.7, style: 0.0 },
      general: { stability: 0.5, similarityBoost: 0.8, style: 0.1 }
    };

    const voiceId = await this.selectMedicalVoice();
    return this.generateSpeech(message, voiceId, contextSettings[context]);
  }

  /**
   * Estima duración del audio basada en el texto
   */
  private estimateAudioDuration(text: string): number {
    // Estimación: ~150 palabras por minuto en español
    const words = text.split(' ').length;
    const wordsPerSecond = 150 / 60;
    return Math.ceil(words / wordsPerSecond);
  }

  /**
   * Convierte archivo de audio local a URL accesible
   */
  getPublicAudioUrl(localPath: string): string {
    // En producción, esto debería subir a un CDN o servir estáticamente
    const fileName = path.basename(localPath);
    return `${process.env.BASE_URL}/audio/${fileName}`;
  }

  /**
   * Limpia archivos de audio antiguos
   */
  cleanupOldAudioFiles(maxAgeHours: number = 24): void {
    try {
      const files = fs.readdirSync(this.outputDir);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

      files.forEach(file => {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          console.log(`[TTS] Archivo antiguo eliminado: ${file}`);
        }
      });

    } catch (error: any) {
      console.warn('[TTS] Error limpiando archivos antiguos:', error.message);
    }
  }

  /**
   * Valida configuración de ElevenLabs
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      await axios({
        method: 'get',
        url: `${this.baseUrl}/user`,
        headers: {
          'xi-api-key': this.apiKey
        }
      });
      
      console.log('[TTS] Configuración de ElevenLabs válida');
      return true;

    } catch (error: any) {
      console.error('[TTS] Configuración de ElevenLabs inválida:', error.message);
      return false;
    }
  }

  /**
   * Genera respuesta de error en audio
   */
  async generateErrorResponse(errorType: 'connection' | 'understanding' | 'system' = 'system'): Promise<TTSResult> {
    const errorMessages = {
      connection: 'Disculpe, tengo problemas de conexión. Por favor intente nuevamente en unos momentos.',
      understanding: 'No pude entender claramente su solicitud. ¿Podría repetir o hablar más despacio?',
      system: 'Estoy experimentando dificultades técnicas. Por favor contacte directamente con el consultorio.'
    };

    return this.generateMedicalResponse(errorMessages[errorType], 'general');
  }
}