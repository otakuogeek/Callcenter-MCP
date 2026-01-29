/**
 * Audio Transcription Service
 * Usa OpenAI Whisper para transcribir mensajes de voz a texto
 */

import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHISPER_MODEL = 'whisper-1';

interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  duration?: number;
}

/**
 * Transcribe audio buffer to text using OpenAI Whisper
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/ogg'): Promise<TranscriptionResult> {
  if (!OPENAI_API_KEY) {
    console.error('[Transcription] OPENAI_API_KEY no configurada');
    return { success: false, error: 'API key no configurada' };
  }

  try {
    // Determinar extensión según el tipo de audio
    let extension = 'ogg';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
      extension = 'mp3';
    } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      extension = 'm4a';
    } else if (mimeType.includes('wav')) {
      extension = 'wav';
    } else if (mimeType.includes('webm')) {
      extension = 'webm';
    }

    // Crear archivo temporal
    const tempDir = path.join('/tmp', 'whatsapp-audio');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `audio_${Date.now()}.${extension}`);
    fs.writeFileSync(tempFile, audioBuffer);

    console.log(`[Transcription] Archivo temporal creado: ${tempFile} (${audioBuffer.length} bytes)`);

    // Crear FormData para enviar a OpenAI
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFile), {
      filename: `audio.${extension}`,
      contentType: mimeType
    });
    formData.append('model', WHISPER_MODEL);
    formData.append('language', 'es'); // Español por defecto

    // Enviar a OpenAI Whisper API
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          ...formData.getHeaders()
        },
        maxContentLength: 25 * 1024 * 1024, // 25MB max
        timeout: 60000 // 60 segundos timeout
      }
    );

    // Limpiar archivo temporal
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      console.warn('[Transcription] No se pudo eliminar archivo temporal:', e);
    }

    if (response.data && response.data.text) {
      console.log(`[Transcription] Transcripción exitosa: "${response.data.text.substring(0, 100)}..."`);
      return {
        success: true,
        text: response.data.text,
        duration: response.data.duration
      };
    }

    return { success: false, error: 'Respuesta vacía de Whisper' };

  } catch (error: any) {
    console.error('[Transcription] Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Error de transcripción'
    };
  }
}

/**
 * Transcribe audio from file path
 */
export async function transcribeAudioFile(filePath: string): Promise<TranscriptionResult> {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Archivo no encontrado' };
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  let mimeType = 'audio/ogg';
  if (ext === '.mp3') mimeType = 'audio/mpeg';
  else if (ext === '.m4a') mimeType = 'audio/mp4';
  else if (ext === '.wav') mimeType = 'audio/wav';
  else if (ext === '.webm') mimeType = 'audio/webm';

  return transcribeAudio(buffer, mimeType);
}

export default {
  transcribeAudio,
  transcribeAudioFile
};
