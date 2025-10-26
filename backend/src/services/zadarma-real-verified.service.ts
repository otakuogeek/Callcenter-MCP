import crypto from 'crypto';
import axios from 'axios';

/**
 * Servicio para realizar llamadas REALES usando Zadarma Request Callback
 * Usando las credenciales SMS que SÍ funcionan
 */
class ZadarmaRealCallService {
  private readonly API_BASE = 'https://api.zadarma.com';
  private readonly API_KEY: string;
  private readonly API_SECRET: string;
  private readonly SIP_NUMBER: string;
  
  constructor() {
    // Usar credenciales SMS que están funcionando
    this.API_KEY = process.env.ZADARMA_SMS_API_KEY || '';
    this.API_SECRET = process.env.ZADARMA_SMS_API_SECRET || '';
    this.SIP_NUMBER = '895480'; // SIP verificado que funciona
    
    if (!this.API_KEY || !this.API_SECRET) {
      console.error('⚠️  Credenciales de Zadarma no configuradas');
    }
  }

  /**
   * Genera la firma de autenticación para Zadarma API
   * Método verificado que funciona con la librería oficial PHP
   */
  private generateSignature(method: string, path: string, params: Record<string, string>): string {
    // Ordenar parámetros alfabéticamente
    const sortedKeys = Object.keys(params).sort();
    const paramsString = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    // Calcular MD5 de los parámetros
    const paramsMd5 = crypto.createHash('md5').update(paramsString).digest('hex');
    
    // Crear string base para la firma
    const signatureBase = `${method}${path}${paramsString}${paramsMd5}`;
    
    // Generar firma HMAC-SHA1
    const signature = crypto
      .createHmac('sha1', this.API_SECRET)
      .update(signatureBase)
      .digest('base64');
    
    return signature;
  }

  /**
   * Realiza una llamada REAL usando Request Callback
   * @param destinationNumber - Número de destino en formato internacional (+584264377421)
   * @returns Información de la llamada iniciada
   */
  async makeRealCall(destinationNumber: string): Promise<any> {
    try {
      const method = 'GET';
      const path = '/v1/request/callback/';
      
      // Normalizar número destino
      const normalizedTo = this.normalizePhoneNumber(destinationNumber);
      
      const params: Record<string, string> = {
        from: this.SIP_NUMBER,
        to: normalizedTo,
        predicted: 'predicted' // Marcado automático
      };
      
      const signature = this.generateSignature(method, path, params);
      
      console.log('📞 [Zadarma Real] Iniciando llamada REAL...');
      console.log('   Desde SIP:', this.SIP_NUMBER);
      console.log('   Hacia:', normalizedTo);
      
      const response = await axios.get(`${this.API_BASE}${path}`, {
        params,
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`
        }
      });
      
      console.log('✅ [Zadarma Real] Respuesta:', response.data);
      
      if (response.data.status === 'success') {
        return {
          success: true,
          message: '¡Llamada REAL iniciada! El teléfono debería estar sonando.',
          data: response.data,
          from: this.SIP_NUMBER,
          to: normalizedTo,
          timestamp: response.data.time || Date.now()
        };
      }
      
      return {
        success: false,
        error: response.data.message || 'Error desconocido',
        data: response.data
      };
      
    } catch (error: any) {
      console.error('❌ [Zadarma Real] Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene el balance de la cuenta
   */
  async getBalance(): Promise<any> {
    try {
      const method = 'GET';
      const path = '/v1/info/balance/';
      const params: Record<string, string> = {};
      
      const signature = this.generateSignature(method, path, params);
      
      const response = await axios.get(`${this.API_BASE}${path}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma Real] Error obteniendo balance:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Lista los números SIP disponibles
   */
  async getSipNumbers(): Promise<any> {
    try {
      const method = 'GET';
      const path = '/v1/sip/';
      const params: Record<string, string> = {};
      
      const signature = this.generateSignature(method, path, params);
      
      const response = await axios.get(`${this.API_BASE}${path}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma Real] Error listando SIPs:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Normaliza un número de teléfono al formato internacional
   */
  private normalizePhoneNumber(phone: string): string {
    // Limpiar el número
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Si empieza con +, quitarlo (Zadarma no lo requiere en algunos endpoints)
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    
    // Si empieza con 00, convertir
    if (cleaned.startsWith('00')) {
      cleaned = cleaned.substring(2);
    }
    
    return cleaned;
  }
}

export const zadarmaRealCallService = new ZadarmaRealCallService();
