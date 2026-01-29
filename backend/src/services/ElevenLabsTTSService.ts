/**
 * ElevenLabs Text-to-Speech Service
 * Usa la API de ElevenLabs para voz de alta calidad en español
 * 
 * @version 1.1.0
 * @description Convierte texto a voz usando voces realistas de ElevenLabs
 *              Incluye conversión a OGG/OPUS para compatibilidad con WhatsApp
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Logger estructurado
const elevenLabsLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'elevenlabs-tts',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined
});

// Configuración de ElevenLabs
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Voces en español disponibles
export const SPANISH_VOICES = {
  // Voces colombianas (ideales para Colombia)
  'b2htR0pMe28pYwCY9gnP': {
    name: 'Sofía',
    description: 'Natural and Conversational - Colombiana, joven, agradable',
    accent: 'colombian',
    gender: 'female',
    recommended: true // Recomendada para Valeria
  },
  'VmejBeYhbrcTPwDniox7': {
    name: 'Lina', 
    description: 'Carefree & Fresh - Colombiana, joven, casual',
    accent: 'colombian',
    gender: 'female'
  },
  '46EMT3mXVIA8qk57PAZe': {
    name: 'Yorley',
    description: 'Voz personalizada en español',
    accent: 'spanish',
    gender: 'female'
  },
  'qHkrJuifPpn95wK3rm2A': {
    name: 'Andrea',
    description: 'Casual - Latinoamericana, joven, conversacional',
    accent: 'latin american', 
    gender: 'female'
  }
} as const;

export type ElevenLabsVoiceId = keyof typeof SPANISH_VOICES;

// Voz por defecto para Valeria (Sofía - colombiana, natural)
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'b2htR0pMe28pYwCY9gnP';

// Modelos disponibles
export const ELEVENLABS_MODELS = {
  'eleven_multilingual_v2': 'Multilingüe v2 - Mejor calidad, soporta español',
  'eleven_turbo_v2_5': 'Turbo v2.5 - Más rápido, buena calidad',
  'eleven_turbo_v2': 'Turbo v2 - Rápido',
  'eleven_monolingual_v1': 'Monolingüe v1 - Solo inglés'
} as const;

const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

interface ElevenLabsTTSResult {
  success: boolean;
  audioBuffer?: Buffer;
  filePath?: string;
  error?: string;
  duration?: number;
  voiceId?: string;
  voiceName?: string;
  provider: 'elevenlabs';
}

interface ElevenLabsTTSOptions {
  voiceId?: string;
  model?: string;
  stability?: number; // 0.0 a 1.0 (más estable = más consistente)
  similarityBoost?: number; // 0.0 a 1.0 (más alto = más parecido a la voz original)
  style?: number; // 0.0 a 1.0 (exageración del estilo)
  useSpeakerBoost?: boolean;
  saveToFile?: boolean;
  outputFormat?: 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'ulaw_8000';
}

/**
 * Convierte texto a audio usando ElevenLabs TTS
 */
export async function elevenLabsTextToSpeech(
  text: string,
  options: ElevenLabsTTSOptions = {}
): Promise<ElevenLabsTTSResult> {
  if (!ELEVENLABS_API_KEY) {
    elevenLabsLogger.error('ELEVENLABS_API_KEY no configurada');
    return { success: false, error: 'ElevenLabs API key no configurada', provider: 'elevenlabs' };
  }

  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Texto vacío', provider: 'elevenlabs' };
  }

  // Limitar texto (ElevenLabs tiene límite de ~5000 caracteres por request)
  const truncatedText = text.length > 4500 ? text.substring(0, 4497) + '...' : text;
  
  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const model = options.model || DEFAULT_MODEL;
  const outputFormat = options.outputFormat || 'mp3_44100_128';

  // Configuración de voz (ajustada para español natural)
  const voiceSettings = {
    stability: options.stability ?? 0.5, // Balanceado
    similarity_boost: options.similarityBoost ?? 0.75, // Alto para mantener naturalidad
    style: options.style ?? 0.3, // Algo de expresividad
    use_speaker_boost: options.useSpeakerBoost ?? true
  };

  try {
    const voiceInfo = SPANISH_VOICES[voiceId as ElevenLabsVoiceId];
    elevenLabsLogger.info({ 
      textLength: truncatedText.length, 
      voiceId,
      voiceName: voiceInfo?.name || 'Custom',
      model
    }, 'Generando audio con ElevenLabs');

    const startTime = Date.now();

    const response = await axios.post(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        text: truncatedText,
        model_id: model,
        voice_settings: voiceSettings
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        responseType: 'arraybuffer',
        timeout: 60000, // 60 segundos
        params: {
          output_format: outputFormat
        }
      }
    );

    const audioBuffer = Buffer.from(response.data);
    const duration = Date.now() - startTime;

    elevenLabsLogger.info({ 
      bufferSize: audioBuffer.length, 
      durationMs: duration,
      voiceId,
      voiceName: voiceInfo?.name || 'Custom'
    }, 'Audio ElevenLabs generado exitosamente');

    // Guardar a archivo si se solicita
    let filePath: string | undefined;
    if (options.saveToFile) {
      const tempDir = path.join('/tmp', 'whatsapp-elevenlabs');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      filePath = path.join(tempDir, `elevenlabs_${Date.now()}.mp3`);
      fs.writeFileSync(filePath, audioBuffer);
      elevenLabsLogger.debug({ filePath }, 'Audio guardado en archivo');
    }

    return {
      success: true,
      audioBuffer,
      filePath,
      duration,
      voiceId,
      voiceName: voiceInfo?.name || 'Custom Voice',
      provider: 'elevenlabs'
    };

  } catch (error: any) {
    let errorMsg = 'Error de ElevenLabs TTS';
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        errorMsg = 'API key de ElevenLabs inválida';
      } else if (status === 422) {
        errorMsg = 'Texto inválido o voz no encontrada';
      } else if (status === 429) {
        errorMsg = 'Límite de uso de ElevenLabs excedido';
      } else {
        // Intentar parsear el error si es JSON
        try {
          const errorData = typeof data === 'string' ? JSON.parse(data) : data;
          errorMsg = errorData?.detail?.message || errorData?.message || errorMsg;
        } catch {
          errorMsg = `Error ${status}: ${error.message}`;
        }
      }
    } else {
      errorMsg = error.message || errorMsg;
    }

    elevenLabsLogger.error({ error: errorMsg }, 'Error generando TTS con ElevenLabs');
    return {
      success: false,
      error: errorMsg,
      provider: 'elevenlabs'
    };
  }
}

/**
 * Convierte audio MP3 a OGG/OPUS (formato compatible con WhatsApp PTT)
 * WhatsApp requiere formato OGG con codec OPUS para notas de voz
 */
async function convertToWhatsAppFormat(mp3Buffer: Buffer): Promise<Buffer> {
  const tempDir = path.join('/tmp', 'whatsapp-elevenlabs');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const mp3Path = path.join(tempDir, `input_${timestamp}.mp3`);
  const oggPath = path.join(tempDir, `output_${timestamp}.ogg`);

  try {
    // Guardar MP3 temporal
    fs.writeFileSync(mp3Path, mp3Buffer);

    // Convertir a OGG/OPUS con ffmpeg
    // Parámetros optimizados para WhatsApp:
    // - codec: libopus (WhatsApp prefiere OPUS)
    // - bitrate: 64k (buena calidad, tamaño razonable)
    // - sample rate: 48000 (estándar para OPUS)
    // - channels: 1 (mono para notas de voz)
    const ffmpegCmd = `ffmpeg -y -i "${mp3Path}" -c:a libopus -b:a 64k -ar 48000 -ac 1 -application voip "${oggPath}"`;
    
    elevenLabsLogger.debug({ cmd: ffmpegCmd }, 'Convirtiendo audio a OGG/OPUS');
    
    await execAsync(ffmpegCmd);

    // Leer el archivo convertido
    const oggBuffer = fs.readFileSync(oggPath);

    elevenLabsLogger.info({ 
      originalSize: mp3Buffer.length, 
      convertedSize: oggBuffer.length,
      reduction: `${Math.round((1 - oggBuffer.length / mp3Buffer.length) * 100)}%`
    }, 'Audio convertido a OGG/OPUS para WhatsApp');

    // Limpiar archivos temporales
    try {
      fs.unlinkSync(mp3Path);
      fs.unlinkSync(oggPath);
    } catch (e) {
      // Ignorar errores de limpieza
    }

    return oggBuffer;

  } catch (error: any) {
    elevenLabsLogger.error({ error: error.message }, 'Error convirtiendo audio a OGG');
    // Limpiar archivos si existen
    try {
      if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
      if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
    } catch (e) {}
    
    throw error;
  }
}

/**
 * Genera audio TTS optimizado para WhatsApp usando ElevenLabs
 * Convierte automáticamente a OGG/OPUS para compatibilidad con WhatsApp PTT
 * Usa la voz Sofía (colombiana, natural) por defecto
 */
export async function generateWhatsAppVoiceNoteElevenLabs(
  text: string,
  voiceId?: string
): Promise<ElevenLabsTTSResult> {
  // Primero generar audio MP3 con ElevenLabs
  const mp3Result = await elevenLabsTextToSpeech(text, {
    voiceId: voiceId || DEFAULT_VOICE_ID,
    model: 'eleven_multilingual_v2', // Mejor calidad para español
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.3,
    useSpeakerBoost: true,
    outputFormat: 'mp3_44100_128', // Alta calidad inicial
    saveToFile: false // No guardar MP3, solo OGG final
  });

  if (!mp3Result.success || !mp3Result.audioBuffer) {
    return mp3Result;
  }

  try {
    // Convertir MP3 a OGG/OPUS para WhatsApp
    const oggBuffer = await convertToWhatsAppFormat(mp3Result.audioBuffer);

    return {
      success: true,
      audioBuffer: oggBuffer,
      duration: mp3Result.duration,
      voiceId: mp3Result.voiceId,
      voiceName: mp3Result.voiceName,
      provider: 'elevenlabs'
    };
  } catch (conversionError: any) {
    elevenLabsLogger.warn({ error: conversionError.message }, 'Conversión falló, retornando MP3 original');
    // Si la conversión falla, retornar el MP3 original (puede funcionar en algunos casos)
    return mp3Result;
  }
}

/**
 * Lista las voces disponibles en la cuenta de ElevenLabs
 */
export async function listElevenLabsVoices(): Promise<any[]> {
  if (!ELEVENLABS_API_KEY) {
    return [];
  }

  try {
    const response = await axios.get(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });
    return response.data.voices || [];
  } catch (error: any) {
    elevenLabsLogger.error({ error: error.message }, 'Error listando voces');
    return [];
  }
}

/**
 * Obtiene información de uso de la cuenta
 */
export async function getElevenLabsUsage(): Promise<any> {
  if (!ELEVENLABS_API_KEY) {
    return null;
  }

  try {
    const response = await axios.get(`${ELEVENLABS_API_URL}/user/subscription`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });
    return response.data;
  } catch (error: any) {
    elevenLabsLogger.error({ error: error.message }, 'Error obteniendo uso');
    return null;
  }
}

/**
 * Limpia archivos de audio temporales de ElevenLabs (más de 1 hora)
 */
export async function cleanupTempElevenLabsFiles(): Promise<number> {
  const tempDir = path.join('/tmp', 'whatsapp-elevenlabs');
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
    elevenLabsLogger.info({ deleted }, 'Archivos ElevenLabs temporales limpiados');
  }

  return deleted;
}

// Limpiar archivos temporales cada hora
setInterval(cleanupTempElevenLabsFiles, 60 * 60 * 1000);

export default {
  elevenLabsTextToSpeech,
  generateWhatsAppVoiceNoteElevenLabs,
  listElevenLabsVoices,
  getElevenLabsUsage,
  cleanupTempElevenLabsFiles,
  SPANISH_VOICES,
  ELEVENLABS_MODELS,
  DEFAULT_VOICE_ID
};
