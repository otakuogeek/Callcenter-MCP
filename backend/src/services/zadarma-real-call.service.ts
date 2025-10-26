import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Servicio para realizar llamadas REALES usando Zadarma API
 * 
 * Método usado: /v1/request/callback/
 * Este método hace que Zadarma:
 * 1. Llame primero a tu número SIP interno
 * 2. Cuando contestes, llame al número de destino
 * 3. Conecte ambas llamadas
 * 
 * Para llamadas completamente automatizadas necesitas:
 * - Un escenario configurado en Zadarma
 * - Un número virtual de Zadarma
 */
class ZadarmaRealCallService {
  private readonly API_KEY = process.env.ZADARMA_SMS_API_KEY || process.env.ZADARMA_USER_KEY || '';
  private readonly API_SECRET = process.env.ZADARMA_SMS_API_SECRET || process.env.ZADARMA_SECRET_KEY || '';
  private readonly BASE_URL = 'https://api.zadarma.com';

  /**
   * Genera firma para autenticación de Zadarma
   */
  private generateSignature(method: string, apiPath: string, params: Record<string, any> = {}): string {
    const sortedKeys = Object.keys(params).sort();
    const paramsStr = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const paramsMd5 = paramsStr 
      ? crypto.createHash('md5').update(paramsStr).digest('hex')
      : '';

    const baseString = paramsStr
      ? `${method}${apiPath}${paramsStr}${paramsMd5}`
      : `${method}${apiPath}`;
    
    const signature = crypto
      .createHmac('sha1', this.API_SECRET)
      .update(baseString)
      .digest('base64');
    
    return signature;
  }

  /**
   * Obtiene el balance de la cuenta de Zadarma
   * Útil para verificar configuración
   */
  async getBalance(): Promise<any> {
    try {
      const apiPath = '/v1/info/balance/';
      const method = 'GET';
      const signature = this.generateSignature(method, apiPath);

      const response = await axios.get(`${this.BASE_URL}${apiPath}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`,
        },
      });

      console.log('✅ [Zadarma] Balance obtenido:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error obteniendo balance:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Solicita una llamada de callback
   * 
   * IMPORTANTE: Este método requiere que tengas:
   * 1. Un número SIP configurado en Zadarma (parámetro 'from')
   * 2. O un número virtual de Zadarma
   * 
   * Flujo:
   * 1. Zadarma llama a tu SIP/número (from)
   * 2. Cuando contestas, Zadarma llama al destino (to)
   * 3. Conecta ambas llamadas
   * 
   * Para automatización completa, usa un escenario que:
   * - Auto-conteste la primera llamada
   * - Reproduzca el audio automáticamente
   */
  async requestCallback(params: {
    from: string;  // Tu número SIP o número virtual de Zadarma
    to: string;    // Número de destino
    sip?: string;  // Número SIP interno (opcional)
    predicted?: string;  // Número a mostrar en caller ID (opcional)
  }): Promise<any> {
    try {
      const apiPath = '/v1/request/callback/';
      const method = 'GET';

      const apiParams: Record<string, string> = {
        from: params.from,
        to: params.to,
      };

      if (params.sip) {
        apiParams.sip = params.sip;
      }

      if (params.predicted) {
        apiParams.predicted = params.predicted;
      }

      const signature = this.generateSignature(method, apiPath, apiParams);

      console.log('📞 [Zadarma] Solicitando callback:', apiParams);

      const response = await axios.get(`${this.BASE_URL}${apiPath}`, {
        params: apiParams,
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`,
        },
      });

      if (response.data.status === 'success') {
        console.log('✅ [Zadarma] Callback solicitado exitosamente:', response.data);
      } else {
        console.error('❌ [Zadarma] Error en callback:', response.data);
      }

      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error solicitando callback:', error.response?.data || error.message);
      
      // Mensajes de error comunes
      if (error.response?.data) {
        const errorData = error.response.data;
        if (errorData.message?.includes('sip')) {
          console.error('💡 [Zadarma] Necesitas configurar un número SIP en tu cuenta de Zadarma');
        } else if (errorData.message?.includes('number')) {
          console.error('💡 [Zadarma] Verifica que tengas un número virtual asignado en Zadarma');
        }
      }
      
      throw error;
    }
  }

  /**
   * Obtiene información de la cuenta
   */
  async getAccountInfo(): Promise<any> {
    try {
      const apiPath = '/v1/info/';
      const method = 'GET';
      const signature = this.generateSignature(method, apiPath);

      const response = await axios.get(`${this.BASE_URL}${apiPath}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`,
        },
      });

      console.log('ℹ️  [Zadarma] Información de cuenta:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error obteniendo info:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene la lista de números SIP configurados
   */
  async getSipNumbers(): Promise<any> {
    try {
      const apiPath = '/v1/sip/';
      const method = 'GET';
      const signature = this.generateSignature(method, apiPath);

      const response = await axios.get(`${this.BASE_URL}${apiPath}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`,
        },
      });

      console.log('📋 [Zadarma] Números SIP:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error obteniendo SIP:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de PBX
   */
  async getPbxStats(): Promise<any> {
    try {
      const apiPath = '/v1/statistics/pbx/';
      const method = 'GET';
      const signature = this.generateSignature(method, apiPath);

      const response = await axios.get(`${this.BASE_URL}${apiPath}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ [Zadarma] Error obteniendo stats:', error.response?.data || error.message);
      throw error;
    }
  }
}

export default new ZadarmaRealCallService();
