import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { STTResult, AudioFile } from '../types';

export class STTService {
  private openai: OpenAI;
  private tempDir: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.tempDir = path.join(__dirname, '../../temp');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Convierte audio a texto usando OpenAI Whisper
   */
  async transcribeAudio(audioFile: AudioFile): Promise<STTResult> {
    try {
      console.log(`[STT] Iniciando transcripción de: ${audioFile.url}`);
      
      // Descargar archivo de audio si es una URL remota
      const localPath = await this.downloadAudioFile(audioFile);
      
      // Preparar archivo para Whisper
      const fileStream = fs.createReadStream(localPath);
      
      // Llamar a Whisper API
      const transcription = await this.openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        language: 'es', // Español como idioma por defecto
        response_format: 'verbose_json'
      });

      // Limpiar archivo temporal
      this.cleanupTempFile(localPath);

      const result: STTResult = {
        text: transcription.text.trim(),
        confidence: this.calculateConfidence(transcription),
        language: transcription.language || 'es',
        duration: transcription.duration
      };

      console.log(`[STT] Transcripción exitosa: "${result.text.substring(0, 100)}..."`);
      return result;

    } catch (error: any) {
      console.error('[STT] Error en transcripción:', error);
      throw new Error(`Error de transcripción: ${error.message}`);
    }
  }

  /**
   * Descarga archivo de audio desde URL de Zadarma
   */
  private async downloadAudioFile(audioFile: AudioFile): Promise<string> {
    if (audioFile.localPath && fs.existsSync(audioFile.localPath)) {
      return audioFile.localPath;
    }

    const fileName = `audio_${Date.now()}.${audioFile.format}`;
    const localPath = path.join(this.tempDir, fileName);

    try {
      const response = await axios({
        method: 'get',
        url: audioFile.url,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'BiosanarcallVoiceService/1.0'
        }
      });

      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`[STT] Audio descargado: ${localPath}`);
          resolve(localPath);
        });
        writer.on('error', reject);
      });

    } catch (error: any) {
      console.error('[STT] Error descargando audio:', error);
      throw new Error(`Error descargando audio: ${error.message}`);
    }
  }

  /**
   * Calcula confianza estimada basada en la respuesta de Whisper
   */
  private calculateConfidence(transcription: any): number {
    // Whisper no proporciona confidence score directamente
    // Estimamos basado en duración y presencia de texto
    if (!transcription.text || transcription.text.trim().length < 3) {
      return 0.1;
    }

    const textLength = transcription.text.trim().length;
    const duration = transcription.duration || 1;
    
    // Heurística: más palabras por segundo = mayor confianza
    const wordsPerSecond = textLength / 6 / duration; // ~6 chars por palabra
    
    if (wordsPerSecond > 2) return 0.9;
    if (wordsPerSecond > 1) return 0.8;
    if (wordsPerSecond > 0.5) return 0.7;
    return 0.6;
  }

  /**
   * Limpia archivos temporales
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[STT] Archivo temporal eliminado: ${filePath}`);
      }
    } catch (error: any) {
      console.warn(`[STT] Error eliminando archivo temporal: ${error.message}`);
    }
  }

  /**
   * Procesa múltiples archivos de audio en paralelo
   */
  async transcribeMultipleAudios(audioFiles: AudioFile[]): Promise<STTResult[]> {
    const promises = audioFiles.map(audio => this.transcribeAudio(audio));
    return Promise.all(promises);
  }

  /**
   * Valida si el audio es procesable
   */
  validateAudioFile(audioFile: AudioFile): boolean {
    // Validar formato soportado
    const supportedFormats = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
    if (!supportedFormats.includes(audioFile.format.toLowerCase())) {
      console.warn(`[STT] Formato no soportado: ${audioFile.format}`);
      return false;
    }

    // Validar tamaño (máximo 25MB para Whisper)
    if (audioFile.size && audioFile.size > 25 * 1024 * 1024) {
      console.warn(`[STT] Archivo muy grande: ${audioFile.size} bytes`);
      return false;
    }

    return true;
  }

  /**
   * Limpia directorio temporal al finalizar
   */
  cleanup(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
      console.log('[STT] Directorio temporal limpiado');
    } catch (error: any) {
      console.warn(`[STT] Error limpiando directorio temporal: ${error.message}`);
    }
  }
}