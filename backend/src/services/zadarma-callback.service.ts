import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

/**
 * Servicio para realizar llamadas reales usando Zadarma Request Callback API
 * Este método hace que Zadarma:
 * 1. Llame primero a un número SIP interno
 * 2. Cuando se contesta, llama al número destino
 * 3. Conecta ambas llamadas
 */
class ZadarmaCallbackService {
  private readonly API_BASE = 'https://api.zadarma.com/v1';
  private readonly API_KEY: string;
  private readonly API_SECRET: string;
  private readonly SIP_NUMBER: string; // Número SIP interno de Zadarma
  
  constructor() {
    // Intentar con las credenciales SMS primero (parecen más recientes)
    this.API_KEY = process.env.ZADARMA_SMS_API_KEY || process.env.ZADARMA_USER_KEY || '';
    this.API_SECRET = process.env.ZADARMA_SMS_API_SECRET || process.env.ZADARMA_SECRET_KEY || '';
    this.SIP_NUMBER = process.env.ZADARMA_SIP_NUMBER || '100'; // SIP interno por defecto
    
    if (!this.API_KEY || !this.API_SECRET) {
      console.error('⚠️  Credenciales de Zadarma no configuradas');
    }
  }

  /**
   * Genera la firma de autenticación para Zadarma API
   */
  private generateSignature(method: string, params: Record<string, string>): string {
    // Ordenar parámetros alfabéticamente
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const data = method + sortedParams + crypto.createHash('md5').update(this.API_SECRET).digest('hex');
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Realiza una llamada usando el método request_callback
   * @param from - Número SIP interno o número de Zadarma desde el cual llamar
   * @param to - Número de teléfono destino (formato internacional)
   * @param audioUrl - URL del audio a reproducir (opcional)
   */
  async requestCallback(to: string, from?: string, audioUrl?: string): Promise<any> {
    try {
      const method = '/v1/request/callback/';
      const fromNumber = from || this.SIP_NUMBER;
      
      // Normalizar número destino
      const normalizedTo = this.normalizePhoneNumber(to);
      
      const params: Record<string, string> = {
        from: fromNumber,
        to: normalizedTo,
        predicted: 'predicted' // Marcar automáticamente cuando el destino conteste
      };
      
      // Si hay URL de audio, agregarla
      if (audioUrl) {
        params.record_audio_url = audioUrl;
      }
      
      const signature = this.generateSignature(method, params);
      
      console.log('📞 [Zadarma] Iniciando llamada callback...');
      console.log('   Desde:', fromNumber);
      console.log('   Hacia:', normalizedTo);
      
      const response = await axios.get(`${this.API_BASE}${method}`, {
        params,
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`
        }
      });
      
      console.log('✅ [Zadarma] Llamada iniciada:', response.data);
      
      return {
        success: true,
        data: response.data,
        callId: response.data.call_id || null,
        from: fromNumber,
        to: normalizedTo
      };
      
    } catch (error: any) {
      console.error('❌ [Zadarma] Error en callback:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Solicita una llamada usando el número virtual de Zadarma
   * Este método NO requiere SIP configurado, solo un número virtual comprado
   */
  async makeCallWithVirtualNumber(virtualNumber: string, destinationNumber: string, audioPath?: string): Promise<any> {
    try {
      console.log('📞 [Zadarma] Preparando llamada con número virtual...');
      console.log('   Número virtual:', virtualNumber);
      console.log('   Destino:', destinationNumber);
      
      // Si tenemos audio local, primero subirlo a un servidor accesible
      let audioUrl: string | undefined;
      if (audioPath) {
        // Por ahora, el audio debe estar accesible públicamente
        // TODO: Implementar servidor de audio o usar CDN
        audioUrl = `https://biosanarcall.site/uploads/call-audio/${path.basename(audioPath)}`;
        console.log('   Audio URL:', audioUrl);
      }
      
      return await this.requestCallback(destinationNumber, virtualNumber, audioUrl);
      
    } catch (error: any) {
      console.error('❌ [Zadarma] Error en llamada con número virtual:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene información de la cuenta de Zadarma
   */
  async getAccountInfo(): Promise<any> {
    try {
      const method = '/v1/info/balance/';
      const params = {};
      const signature = this.generateSignature(method, params);
      
      const response = await axios.get(`${this.API_BASE}${method}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error obteniendo info:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Lista los números virtuales disponibles en la cuenta
   */
  async getVirtualNumbers(): Promise<any> {
    try {
      const method = '/v1/info/number/';
      const params = {};
      const signature = this.generateSignature(method, params);
      
      const response = await axios.get(`${this.API_BASE}${method}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error listando números:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Normaliza un número de teléfono al formato internacional
   */
  private normalizePhoneNumber(phone: string): string {
    // Limpiar el número
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Si empieza con +, ya está en formato internacional
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Si empieza con 00, convertir a +
    if (cleaned.startsWith('00')) {
      return '+' + cleaned.substring(2);
    }
    
    // Si es un número de 10 dígitos sin código de país, asumir Colombia (+57)
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
      return '+57' + cleaned;
    }
    
    // Si ya tiene código de país pero sin +, agregarlo
    if ((cleaned.startsWith('57') || cleaned.startsWith('58')) && cleaned.length > 10) {
      return '+' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Guarda el audio en un archivo local
   */
  async saveAudioFile(audioBase64: string, phoneNumber: string): Promise<string> {
    const audioDir = '/home/ubuntu/app/uploads/call-audio';
    await fs.mkdir(audioDir, { recursive: true });
    
    const timestamp = Date.now();
    const filename = `call_${phoneNumber.replace(/\+/g, '')}_${timestamp}.mp3`;
    const filePath = path.join(audioDir, filename);
    
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    await fs.writeFile(filePath, audioBuffer);
    
    console.log(`💾 Audio guardado en: ${filePath}`);
    return filePath;
  }
}

export const zadarmaCallbackService = new ZadarmaCallbackService();
