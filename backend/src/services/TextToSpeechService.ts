/**
 * Text-to-Speech Service
 * Usa OpenAI TTS para convertir texto en audio de voz
 * 
 * @version 1.0.0
 * @description Convierte respuestas de texto a mensajes de voz para WhatsApp
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

// Logger estructurado
const ttsLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'text-to-speech',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TTS_MODEL = process.env.TTS_MODEL || 'tts-1'; // tts-1 (rápido) o tts-1-hd (alta calidad)
const TTS_VOICE = process.env.TTS_VOICE || 'nova'; // alloy, echo, fable, onyx, nova, shimmer

// Voces disponibles con descripciones
export const AVAILABLE_VOICES = {
  alloy: 'Voz neutral y balanceada',
  echo: 'Voz masculina suave',
  fable: 'Voz expresiva con acento británico',
  onyx: 'Voz masculina profunda',
  nova: 'Voz femenina cálida y amigable (recomendada para Valeria)',
  shimmer: 'Voz femenina suave y clara'
} as const;

export type TTSVoice = keyof typeof AVAILABLE_VOICES;

interface TTSResult {
  success: boolean;
  audioBuffer?: Buffer;
  filePath?: string;
  error?: string;
  duration?: number;
  voice?: string;
}

interface TTSOptions {
  voice?: TTSVoice;
  model?: 'tts-1' | 'tts-1-hd';
  speed?: number; // 0.25 a 4.0
  saveToFile?: boolean;
  outputFormat?: 'mp3' | 'opus' | 'aac' | 'flac';
}

/**
 * Convierte texto a audio usando OpenAI TTS
 */
export async function textToSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  if (!OPENAI_API_KEY) {
    ttsLogger.error('OPENAI_API_KEY no configurada');
    return { success: false, error: 'API key no configurada' };
  }

  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Texto vacío' };
  }

  // Limitar texto a 4096 caracteres (límite de OpenAI TTS)
  const truncatedText = text.length > 4096 ? text.substring(0, 4093) + '...' : text;
  
  const voice = options.voice || (TTS_VOICE as TTSVoice);
  const model = options.model || TTS_MODEL;
  const speed = options.speed || 1.0;
  const format = options.outputFormat || 'opus'; // opus es ideal para WhatsApp

  try {
    ttsLogger.info({ 
      textLength: truncatedText.length, 
      voice, 
      model,
      speed 
    }, 'Generando audio TTS');

    const startTime = Date.now();

    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model,
        input: truncatedText,
        voice,
        speed,
        response_format: format
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 60000 // 60 segundos
      }
    );

    const audioBuffer = Buffer.from(response.data);
    const duration = Date.now() - startTime;

    ttsLogger.info({ 
      bufferSize: audioBuffer.length, 
      durationMs: duration,
      voice 
    }, 'Audio TTS generado exitosamente');

    // Guardar a archivo si se solicita
    let filePath: string | undefined;
    if (options.saveToFile) {
      const tempDir = path.join('/tmp', 'whatsapp-tts');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      filePath = path.join(tempDir, `tts_${Date.now()}.${format}`);
      fs.writeFileSync(filePath, audioBuffer);
      ttsLogger.debug({ filePath }, 'Audio guardado en archivo');
    }

    return {
      success: true,
      audioBuffer,
      filePath,
      duration,
      voice
    };

  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message || 'Error de TTS';
    ttsLogger.error({ error: errorMsg }, 'Error generando TTS');
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Genera audio TTS optimizado para WhatsApp (formato opus, voz Valeria/nova)
 */
export async function generateWhatsAppVoiceNote(text: string): Promise<TTSResult> {
  return textToSpeech(text, {
    voice: 'nova', // Voz femenina cálida para Valeria
    model: 'tts-1', // Modelo rápido
    speed: 1.0,
    outputFormat: 'opus' // Formato compatible con WhatsApp
  });
}

/**
 * Limpia archivos de audio temporales antiguos (más de 1 hora)
 */
export async function cleanupTempAudioFiles(): Promise<number> {
  const tempDir = path.join('/tmp', 'whatsapp-tts');
  if (!fs.existsSync(tempDir)) {
    return 0;
  }

  const files = fs.readdirSync(tempDir);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  let deleted = 0;

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > oneHour) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    } catch (e) {
      // Ignorar errores de archivos
    }
  }

  if (deleted > 0) {
    ttsLogger.info({ deleted }, 'Archivos TTS temporales limpiados');
  }

  return deleted;
}

// Limpiar archivos temporales cada hora
setInterval(cleanupTempAudioFiles, 60 * 60 * 1000);

export default {
  textToSpeech,
  generateWhatsAppVoiceNote,
  cleanupTempAudioFiles,
  AVAILABLE_VOICES
};
