/**
 * GPT Audio Service - Modelo de Chat con Audio Integrado
 * Usa gpt-audio-mini-2025-12-15 para generar respuestas de texto + audio en una sola llamada
 * 
 * @version 1.0.0
 * @description Combina chat y TTS en una sola llamada API, reduciendo latencia y costos
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

// Logger estructurado
const audioLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'gpt-audio-service',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GPT_AUDIO_MODEL = process.env.GPT_AUDIO_MODEL || 'gpt-audio-mini-2025-12-15';
const GPT_AUDIO_VOICE = process.env.GPT_AUDIO_VOICE || 'nova';
const GPT_AUDIO_FORMAT = process.env.GPT_AUDIO_FORMAT || 'mp3';

// Voces disponibles para gpt-audio-mini
export const AVAILABLE_VOICES = {
  alloy: 'Voz neutral y balanceada',
  ash: 'Voz masculina clara',
  ballad: 'Voz narrativa expresiva',
  coral: 'Voz femenina cálida',
  echo: 'Voz masculina suave',
  sage: 'Voz sabia y calmada',
  shimmer: 'Voz femenina suave',
  verse: 'Voz versátil',
  nova: 'Voz femenina cálida (ideal para Valeria)'
} as const;

export type GPTAudioVoice = keyof typeof AVAILABLE_VOICES;

interface GPTAudioResponse {
  success: boolean;
  text?: string;           // Respuesta de texto (transcripción)
  audioBase64?: string;    // Audio en base64
  audioBuffer?: Buffer;    // Audio como Buffer
  filePath?: string;       // Path del archivo guardado
  audioId?: string;        // ID del audio generado
  voice?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    audioTokens: number;
  };
}

interface GPTAudioOptions {
  voice?: GPTAudioVoice;
  format?: 'mp3' | 'wav' | 'flac' | 'opus';
  systemPrompt?: string;
  saveToFile?: boolean;
  tools?: any[];           // Herramientas MCP/function calling
}

// System prompt por defecto para Valeria
const DEFAULT_SYSTEM_PROMPT = `Eres Valeria, la recepcionista virtual de Fundación Biosanar IPS, una institución de salud en Colombia.

Tu personalidad:
- Eres amable, cálida y profesional
- Hablas español colombiano natural (usas "con gusto", "claro que sí", "permítame un momento")
- Eres eficiente y vas al grano sin ser brusca
- Muestras empatía genuina con los pacientes

Tu rol principal:
- Ayudar a agendar citas médicas
- Consultar disponibilidad de especialidades
- Verificar datos de pacientes
- Responder preguntas sobre servicios de la IPS

Instrucciones:
- Responde de forma breve y clara (máximo 2-3 oraciones)
- Si necesitas información del paciente, pídela de forma amable
- Siempre ofrece ayuda adicional al finalizar`;

/**
 * Genera una respuesta de chat con audio integrado usando gpt-audio-mini
 * @param userMessage Mensaje del usuario
 * @param conversationHistory Historial de conversación opcional
 * @param options Opciones de configuración
 */
export async function generateChatWithAudio(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  options: GPTAudioOptions = {}
): Promise<GPTAudioResponse> {
  if (!OPENAI_API_KEY) {
    audioLogger.error('OPENAI_API_KEY no configurada');
    return { success: false, error: 'API key no configurada' };
  }

  if (!userMessage || userMessage.trim().length === 0) {
    return { success: false, error: 'Mensaje vacío' };
  }

  const voice = options.voice || (GPT_AUDIO_VOICE as GPTAudioVoice);
  const format = options.format || (GPT_AUDIO_FORMAT as 'mp3' | 'wav' | 'flac' | 'opus');
  const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  try {
    audioLogger.info({ 
      messageLength: userMessage.length, 
      voice, 
      format,
      historyLength: conversationHistory.length
    }, 'Generando respuesta con audio integrado');

    const startTime = Date.now();

    // Construir mensajes
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Agregar historial si existe
    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-10)); // Últimos 10 mensajes
    }

    // Agregar mensaje actual del usuario
    messages.push({ role: 'user', content: userMessage });

    const requestBody: any = {
      model: GPT_AUDIO_MODEL,
      modalities: ['text', 'audio'],
      audio: {
        voice,
        format
      },
      messages
    };

    // Agregar herramientas si se proporcionan
    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minutos para generación de audio
      }
    );

    const duration = Date.now() - startTime;
    const choice = response.data.choices?.[0];
    
    if (!choice) {
      return { success: false, error: 'Sin respuesta del modelo' };
    }

    // Extraer datos de la respuesta
    const audioData = choice.message?.audio;
    const textContent = choice.message?.content;

    if (!audioData?.data) {
      // Si no hay audio, devolver solo texto
      audioLogger.warn('No se generó audio, devolviendo solo texto');
      return {
        success: true,
        text: textContent || audioData?.transcript || '',
        voice
      };
    }

    // Decodificar audio base64
    const audioBuffer = Buffer.from(audioData.data, 'base64');

    // Guardar a archivo si se solicita
    let filePath: string | undefined;
    if (options.saveToFile) {
      const tempDir = path.join('/tmp', 'gpt-audio');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      filePath = path.join(tempDir, `gpt_audio_${Date.now()}.${format}`);
      fs.writeFileSync(filePath, audioBuffer);
      audioLogger.debug({ filePath }, 'Audio guardado en archivo');
    }

    // Extraer información de uso
    const usage = response.data.usage;

    audioLogger.info({ 
      durationMs: duration,
      audioSize: audioBuffer.length,
      textLength: audioData.transcript?.length || 0,
      voice,
      audioTokens: usage?.completion_tokens_details?.audio_tokens
    }, 'Respuesta con audio generada exitosamente');

    return {
      success: true,
      text: audioData.transcript || textContent || '',
      audioBase64: audioData.data,
      audioBuffer,
      filePath,
      audioId: audioData.id,
      voice,
      usage: {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        audioTokens: usage?.completion_tokens_details?.audio_tokens || 0
      }
    };

  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message || 'Error de GPT Audio';
    audioLogger.error({ 
      error: errorMsg, 
      status: error.response?.status 
    }, 'Error generando respuesta con audio');
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Genera solo audio desde texto (sin chat, como TTS tradicional)
 * Útil para mensajes predefinidos o respuestas ya generadas
 */
export async function textToAudio(
  text: string,
  options: Omit<GPTAudioOptions, 'systemPrompt' | 'tools'> = {}
): Promise<GPTAudioResponse> {
  // Usar el modelo como TTS simple pidiendo que "repita" el texto
  return generateChatWithAudio(
    text,
    [],
    {
      ...options,
      systemPrompt: `Repite exactamente el siguiente mensaje sin modificarlo. No agregues nada más.`
    }
  );
}

/**
 * Genera audio para WhatsApp (formato optimizado)
 * @param text Texto a convertir o mensaje del usuario
 * @param isResponse Si es true, convierte texto a audio. Si es false, genera respuesta con audio.
 * @param conversationHistory Historial opcional
 */
export async function generateWhatsAppAudio(
  text: string,
  isResponse: boolean = false,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  systemPrompt?: string
): Promise<{
  success: boolean;
  text?: string;
  audioBuffer?: Buffer;
  filePath?: string;
  error?: string;
}> {
  // Configuración optimizada para WhatsApp
  const options: GPTAudioOptions = {
    voice: 'nova',
    format: 'mp3', // WhatsApp soporta mp3 bien
    saveToFile: true, // Necesario para enviar por Baileys
    systemPrompt: systemPrompt
  };

  if (isResponse) {
    // Solo convertir texto a audio
    const result = await textToAudio(text, options);
    return {
      success: result.success,
      text: result.text,
      audioBuffer: result.audioBuffer,
      filePath: result.filePath,
      error: result.error
    };
  }

  // Generar respuesta completa con audio
  const result = await generateChatWithAudio(text, conversationHistory, options);
  return {
    success: result.success,
    text: result.text,
    audioBuffer: result.audioBuffer,
    filePath: result.filePath,
    error: result.error
  };
}

/**
 * Limpia archivos de audio temporales antiguos
 */
export function cleanupTempAudioFiles(maxAgeMs: number = 3600000): number {
  const tempDir = path.join('/tmp', 'gpt-audio');
  let deletedCount = 0;

  try {
    if (!fs.existsSync(tempDir)) return 0;

    const files = fs.readdirSync(tempDir);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      audioLogger.info({ deletedCount }, 'Archivos de audio temporales limpiados');
    }
  } catch (error) {
    audioLogger.error({ error }, 'Error limpiando archivos temporales');
  }

  return deletedCount;
}

// Ejecutar limpieza cada hora
setInterval(() => cleanupTempAudioFiles(), 3600000);

export default {
  generateChatWithAudio,
  textToAudio,
  generateWhatsAppAudio,
  cleanupTempAudioFiles,
  AVAILABLE_VOICES
};
