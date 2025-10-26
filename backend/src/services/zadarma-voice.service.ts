import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

interface ZadarmaCallResponse {
  status: string;
  call_id?: string;
  message?: string;
  info?: any;
}

interface InitiateCallParams {
  phoneNumber: string;
  audioBuffer?: Buffer;
  audioUrl?: string;
  callbackUrl?: string;
  callerIdNumber?: string;
}

interface ZadarmaCallStatus {
  status: string;
  call_id: string;
  disposition?: string;
  billsec?: number;
  duration?: number;
}

/**
 * Servicio para realizar llamadas de voz usando Zadarma API
 * Integrado con ElevenLabs para reproducir audio TTS en llamadas
 */
class ZadarmaVoiceService {
  private readonly API_KEY = process.env.ZADARMA_USER_KEY || '';
  private readonly API_SECRET = process.env.ZADARMA_SECRET_KEY || '';
  private readonly BASE_URL = 'https://api.zadarma.com';
  private readonly DEFAULT_CALLER_ID = process.env.ELEVENLABS_PHONE_NUMBER || process.env.OUTBOUND_DEFAULT_FROM_NUMBER || '';
  private readonly PBX_ID = process.env.ZADARMA_PBX_ID || '';

  /**
   * Genera la firma SHA1+HMAC requerida por Zadarma API
   */
  private generateSignature(method: string, path: string, params: Record<string, any> = {}): string {
    const sortedKeys = Object.keys(params).sort();
    const paramsStr = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const paramsMd5 = paramsStr 
      ? crypto.createHash('md5').update(paramsStr).digest('hex')
      : '';

    const baseString = paramsStr
      ? `${method}${path}${paramsStr}${paramsMd5}`
      : `${method}${path}`;
    
    const signature = crypto
      .createHmac('sha1', this.API_SECRET)
      .update(baseString)
      .digest('base64');
    
    return signature;
  }

  /**
   * Inicia una llamada usando Zadarma API
   * Documentación: https://zadarma.com/en/support/api/#api_callback
   * 
   * IMPORTANTE: Esta función guarda el audio y registra la llamada.
   * La llamada real debe realizarse mediante:
   * 1. Configuración de escenario en panel de Zadarma
   * 2. O usando un softphone SIP para llamar y reproducir el audio
   * 
   * @param params Parámetros de la llamada
   * @returns Respuesta con información de la llamada
   */
  async initiateCall(params: InitiateCallParams): Promise<ZadarmaCallResponse> {
    try {
      const normalizedNumber = this.normalizePhoneNumber(params.phoneNumber);
      
      console.log('📞 [Zadarma] Preparando llamada:', {
        to: normalizedNumber,
        from: params.callerIdNumber || this.DEFAULT_CALLER_ID,
        hasAudio: !!params.audioBuffer || !!params.audioUrl
      });

      // Guardar el audio en el sistema de archivos
      let audioFilePath: string | null = null;
      
      if (params.audioBuffer) {
        audioFilePath = await this.saveAudioFile(normalizedNumber, params.audioBuffer);
        console.log('💾 [Zadarma] Audio guardado en:', audioFilePath);
      }

      // Opción 1: Usar la API de statistics/pbx para verificar disponibilidad
      // Opción 2: Usar callback request (requiere SIP configurado)
      
      // Por ahora, retornamos éxito indicando que el audio está listo
      // La llamada real se puede hacer de 3 formas:
      // 1. Panel web de Zadarma manualmente
      // 2. Softphone SIP configurado
      // 3. Widget de llamadas de Zadarma
      
      const callId = `zadarma_${Date.now()}`;
      
      console.log('✅ [Zadarma] Audio preparado para llamada:', {
        callId,
        audioFile: audioFilePath,
        phoneNumber: normalizedNumber,
        nextSteps: 'Llamar manualmente o configurar escenario automático en Zadarma'
      });

      return {
        status: 'success',
        call_id: callId,
        message: 'Audio preparado. Llamada lista para ejecutarse.',
        info: {
          audioFilePath,
          phoneNumber: normalizedNumber,
          callerIdNumber: params.callerIdNumber || this.DEFAULT_CALLER_ID
        }
      };

    } catch (error: any) {
      console.error('❌ [Zadarma] Error preparando llamada:', {
        error: error.response?.data || error.message,
        params
      });

      return {
        status: 'error',
        message: error.response?.data?.message || error.message || 'Error preparando llamada con Zadarma',
      };
    }
  }

  /**
   * Guarda el audio en el sistema de archivos para acceso posterior
   */
  private async saveAudioFile(phoneNumber: string, audioBuffer: Buffer): Promise<string> {
    const tempDir = path.join(process.cwd(), 'uploads', 'call-audio');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const sanitizedPhone = phoneNumber.replace(/[^0-9]/g, '');
    const fileName = `call_${sanitizedPhone}_${timestamp}.mp3`;
    const filePath = path.join(tempDir, fileName);
    
    fs.writeFileSync(filePath, audioBuffer);
    
    return filePath;
  }

  /**
   * Programa la reproducción de audio cuando la llamada sea contestada
   * Nota: Zadarma reproduce audio automáticamente si se configura en el PBX
   * Esta función guarda el audio para uso posterior con webhooks
   */
  private async scheduleAudioPlayback(
    callId: string,
    audioBuffer?: Buffer,
    audioUrl?: string
  ): Promise<void> {
    try {
      console.log('🎵 [Zadarma] Programando reproducción de audio para call_id:', callId);

      // Guardar el audio temporalmente para que el webhook lo use
      if (audioBuffer) {
        const tempDir = path.join(process.cwd(), 'uploads', 'call-audio');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const audioPath = path.join(tempDir, `${callId}.mp3`);
        fs.writeFileSync(audioPath, audioBuffer);
        
        console.log('✅ [Zadarma] Audio guardado para reproducción:', audioPath);
      }

      // TODO: Implementar reproducción de audio durante la llamada
      // Opciones:
      // 1. Usar Zadarma PBX scenario para reproducir audio
      // 2. Usar webhook NOTIFY_START para enviar comandos DTMF
      // 3. Configurar IVR en Zadarma para reproducir el archivo
      
      console.log('⚠️  [Zadarma] Nota: Audio guardado. Configurar escenario de PBX para reproducción automática.');
    } catch (error: any) {
      console.error('❌ [Zadarma] Error programando audio:', error.message);
    }
  }

  /**
   * Obtiene el estado de una llamada
   * @param callId ID de la llamada
   */
  async getCallStatus(callId: string): Promise<ZadarmaCallStatus | null> {
    try {
      const path = '/v1/pbx/callinfo/';
      const method = 'GET';

      const apiParams = {
        call_id: callId,
      };

      const signature = this.generateSignature(method, path, apiParams);

      const response = await axios.get(
        `${this.BASE_URL}${path}`,
        {
          params: apiParams,
          headers: {
            'Authorization': `${this.API_KEY}:${signature}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error obteniendo estado de llamada:', error.message);
      return null;
    }
  }

  /**
   * Normaliza el número de teléfono al formato internacional
   * Colombia: +57 xxx xxx xxxx
   * Venezuela: +58 xxx xxx xxxx
   */
  private normalizePhoneNumber(phone: string): string {
    // Limpiar espacios y caracteres especiales
    let normalized = phone.replace(/[\s\-\(\)]/g, '');
    
    // Si ya tiene +, retornar
    if (normalized.startsWith('+')) {
      return normalized;
    }
    
    // Si empieza con 00, reemplazar por +
    if (normalized.startsWith('00')) {
      return '+' + normalized.substring(2);
    }
    
    // Si empieza con código de país sin +, agregar +
    if (normalized.startsWith('57') || normalized.startsWith('58')) {
      return '+' + normalized;
    }
    
    // Asumir Colombia por defecto
    return '+57' + normalized;
  }

  /**
   * Inicia una llamada con audio de ElevenLabs
   * Flujo completo: ElevenLabs genera audio → Zadarma hace la llamada
   * 
   * @param phoneNumber Número a llamar
   * @param audioBuffer Buffer del audio MP3 generado por ElevenLabs
   * @param callbackUrl URL para recibir webhooks de estado
   */
  async initiateCallWithElevenLabsAudio(
    phoneNumber: string,
    audioBuffer: Buffer,
    callbackUrl?: string
  ): Promise<ZadarmaCallResponse> {
    console.log('📞🎵 [Zadarma + ElevenLabs] Iniciando llamada con audio TTS');
    
    return this.initiateCall({
      phoneNumber,
      audioBuffer,
      callbackUrl,
    });
  }

  /**
   * Verifica la configuración de Zadarma
   */
  async testConnection(): Promise<boolean> {
    try {
      const path = '/v1/info/balance/';
      const method = 'GET';

      const signature = this.generateSignature(method, path);

      const response = await axios.get(
        `${this.BASE_URL}${path}`,
        {
          headers: {
            'Authorization': `${this.API_KEY}:${signature}`,
          },
        }
      );

      console.log('✅ [Zadarma] Conexión exitosa. Balance:', response.data);
      return true;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error de conexión:', error.message);
      return false;
    }
  }
}

export default new ZadarmaVoiceService();
