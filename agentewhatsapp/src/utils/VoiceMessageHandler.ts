import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { Logger } from './Logger';

export class VoiceMessageHandler {
  private openaiClient: OpenAI;
  private logger: Logger;
  private audioDir: string;

  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.logger = Logger.getInstance();
    this.audioDir = path.join(process.cwd(), 'temp-audio');
    
    // Crear directorio temporal para audios si no existe
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  /**
   * Descargar archivo de audio desde Twilio
   */
  async downloadAudio(mediaUrl: string, messageId: string): Promise<string> {
    try {
      this.logger.info('Descargando audio', { mediaUrl, messageId });

      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error descargando audio: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Generar nombre de archivo único
      const fileName = `voice_${messageId}_${Date.now()}.ogg`;
      const filePath = path.join(this.audioDir, fileName);
      
      // Guardar archivo
      fs.writeFileSync(filePath, buffer);
      
      this.logger.info('Audio descargado exitosamente', { 
        filePath, 
        size: buffer.length 
      });

      return filePath;
    } catch (error) {
      this.logger.error('Error descargando audio', { error, mediaUrl });
      throw error;
    }
  }

  /**
   * Transcribir audio a texto usando OpenAI Whisper
   */
  async transcribeAudio(audioFilePath: string): Promise<string> {
    try {
      this.logger.info('Iniciando transcripción', { audioFilePath });

      // Verificar que el archivo existe
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Archivo de audio no encontrado: ${audioFilePath}`);
      }

      // Crear stream del archivo para OpenAI
      const audioStream = fs.createReadStream(audioFilePath);

      // Llamar a Whisper API
      const transcription = await this.openaiClient.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language: 'es', // Español
        response_format: 'text',
        temperature: 0.2 // Más preciso
      });

      this.logger.info('Transcripción completada', { 
        originalFile: audioFilePath,
        transcriptionLength: transcription.length,
        transcription: transcription.substring(0, 100) + '...'
      });

      // Limpiar archivo temporal
      this.cleanupAudioFile(audioFilePath);

      return transcription.trim();
    } catch (error) {
      this.logger.error('Error en transcripción', { error, audioFilePath });
      // Limpiar archivo temporal incluso si hay error
      this.cleanupAudioFile(audioFilePath);
      throw error;
    }
  }

  /**
   * Procesar mensaje de voz completo: descargar + transcribir
   */
  async processVoiceMessage(mediaUrl: string, messageId: string): Promise<string> {
    try {
      this.logger.info('Procesando mensaje de voz', { mediaUrl, messageId });

      // Paso 1: Descargar audio
      const audioFilePath = await this.downloadAudio(mediaUrl, messageId);

      // Paso 2: Transcribir
      const transcription = await this.transcribeAudio(audioFilePath);

      this.logger.info('Mensaje de voz procesado exitosamente', {
        messageId,
        transcriptionLength: transcription.length
      });

      return transcription;
    } catch (error) {
      this.logger.error('Error procesando mensaje de voz', { error, messageId });
      throw new Error('No pude procesar el mensaje de voz. ¿Podrías repetirlo por texto?');
    }
  }

  /**
   * Limpiar archivo temporal
   */
  private cleanupAudioFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.info('Archivo temporal eliminado', { filePath });
      }
    } catch (error) {
      this.logger.warn('Error eliminando archivo temporal', { error, filePath });
    }
  }

  /**
   * Limpiar archivos antiguos (más de 1 hora)
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.audioDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(this.audioDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          fs.unlinkSync(filePath);
          this.logger.info('Archivo antiguo eliminado', { file });
        }
      }
    } catch (error) {
      this.logger.warn('Error limpiando archivos antiguos', { error });
    }
  }

  /**
   * Verificar si un tipo de contenido es audio
   */
  static isAudioContent(contentType: string): boolean {
    const audioTypes = [
      'audio/ogg',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/amr',
      'audio/aac'
    ];
    
    return audioTypes.some(type => contentType.includes(type));
  }
}