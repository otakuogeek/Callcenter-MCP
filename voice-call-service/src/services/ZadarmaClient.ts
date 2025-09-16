import crypto from 'crypto';

/**
 * Cliente Zadarma API v1 para Node.js
 * Basado en la documentación oficial: https://github.com/zadarma/user-api-v1
 */
export class ZadarmaClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly sandbox: boolean;

  constructor(apiKey: string, apiSecret: string, sandbox: boolean = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.sandbox = sandbox;
    this.baseUrl = sandbox 
      ? 'https://api-sandbox.zadarma.com' 
      : 'https://api.zadarma.com';
  }

  /**
   * Genera la firma HMAC-SHA1 según la documentación oficial
   * @param signatureString - String para firmar
   * @returns Firma en base64
   */
  private encodeSignature(signatureString: string): string {
    return crypto
      .createHmac('sha1', this.apiSecret)
      .update(signatureString)
      .digest('base64');
  }

  /**
   * Genera el header de autorización según el algoritmo oficial
   * @param method - Método API (ejemplo: /v1/info/balance/)
   * @param params - Parámetros de la consulta
   * @returns Header de autorización
   */
  private getAuthHeader(method: string, params: Record<string, any>): string {
    // Filtrar parámetros que no son objetos
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => typeof value !== 'object')
    );

    // Ordenar parámetros alfabéticamente
    const sortedParams = Object.keys(filteredParams)
      .sort()
      .reduce((result, key) => {
        result[key] = filteredParams[key];
        return result;
      }, {} as Record<string, any>);

    // Construir query string según RFC 1738
    const paramsString = new URLSearchParams(sortedParams).toString();
    
    // Generar MD5 del query string
    const paramsMd5 = crypto.createHash('md5').update(paramsString).digest('hex');
    
    // Crear string de firma: método + parámetros + MD5(parámetros)
    const signatureString = method + paramsString + paramsMd5;
    
    // Generar firma HMAC-SHA1
    const signature = this.encodeSignature(signatureString);
    
    // Retornar header de autorización
    return `${this.apiKey}:${signature}`;
  }

  /**
   * Realiza una llamada a la API de Zadarma
   * @param method - Método API (sin /v1/, ejemplo: 'info/balance')
   * @param params - Parámetros de la consulta
   * @param requestType - Tipo de petición (GET, POST, PUT, DELETE)
   * @returns Respuesta de la API
   */
  async call(
    method: string, 
    params: Record<string, any> = {}, 
    requestType: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
  ): Promise<any> {
    // Asegurar que el método comience y termine con /
    const apiMethod = `/v1/${method.replace(/^\/+|\/+$/g, '')}/`;
    
    // Agregar formato json a los parámetros
    const apiParams = { ...params, format: 'json' };
    
    // Generar header de autorización
    const authHeader = this.getAuthHeader(apiMethod, apiParams);
    
    // Construir URL y configuración de la petición
    let url = this.baseUrl + apiMethod;
    const headers: Record<string, string> = {
      'Authorization': authHeader,
      'User-Agent': 'Biosanarcall-Voice-Service/1.0',
      'Accept': 'application/json'
    };

    let body: string | undefined;

    if (requestType === 'GET') {
      // Para GET, agregar parámetros a la URL
      if (Object.keys(apiParams).length > 0) {
        url += '?' + new URLSearchParams(apiParams).toString();
      }
    } else {
      // Para POST/PUT/DELETE, enviar parámetros en el body
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(apiParams).toString();
    }

    try {
      console.log(`[ZadarmaClient] ${requestType} ${url}`);
      
      const response = await fetch(url, {
        method: requestType,
        headers,
        body
      });

      const responseText = await response.text();
      
      console.log(`[ZadarmaClient] Response: ${response.status} ${responseText.substring(0, 200)}...`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      const result = JSON.parse(responseText);

      // Verificar si la API retornó un error
      if (result.status === 'error') {
        throw new Error(`Zadarma API Error: ${result.message || 'Unknown error'}`);
      }

      return result;
    } catch (error: any) {
      console.error('[ZadarmaClient] Error:', error.message);
      throw new Error(`Zadarma API call failed: ${error.message}`);
    }
  }

  /**
   * Valida la firma de un webhook de Zadarma
   * @param postData - Datos del webhook
   * @param signature - Firma recibida en el header
   * @returns true si la firma es válida
   */
  validateWebhookSignature(postData: any, signature: string): boolean {
    try {
      let signatureString = '';
      
      // Construir string de firma según el tipo de evento
      switch (postData.event) {
        case 'NOTIFY_START':
        case 'NOTIFY_INTERNAL':
          signatureString = (postData.caller_id || '') + 
                           (postData.called_did || '') + 
                           (postData.call_start || '');
          break;
          
        case 'NOTIFY_ANSWER':
          signatureString = (postData.caller_id || '') + 
                           (postData.destination || '') + 
                           (postData.call_start || '');
          break;
          
        case 'NOTIFY_END':
          signatureString = (postData.caller_id || '') + 
                           (postData.called_did || '') + 
                           (postData.call_start || '');
          break;
          
        case 'NOTIFY_OUT_START':
        case 'NOTIFY_OUT_END':
          signatureString = (postData.internal || '') + 
                           (postData.destination || '') + 
                           (postData.call_start || '');
          break;
          
        case 'NOTIFY_RECORD':
          signatureString = (postData.pbx_call_id || '') + 
                           (postData.call_id_with_rec || '');
          break;
          
        default:
          console.warn(`[ZadarmaClient] Unknown event type: ${postData.event}`);
          return false;
      }
      
      // Generar firma esperada
      const expectedSignature = this.encodeSignature(signatureString);
      
      // Comparar firmas
      return signature === expectedSignature;
    } catch (error: any) {
      console.error('[ZadarmaClient] Signature validation error:', error.message);
      return false;
    }
  }

  // ===== MÉTODOS DE API =====

  /**
   * Obtener balance de la cuenta
   */
  async getBalance() {
    return this.call('info/balance');
  }

  /**
   * Obtener información de los números SIP
   */
  async getSip() {
    return this.call('sip');
  }

  /**
   * Obtener estado de un número SIP
   */
  async getSipStatus(sipNumber: string) {
    return this.call('sip/status', { sip: sipNumber });
  }

  /**
   * Configurar webhook para eventos
   */
  async setWebhook(webhookUrl: string) {
    return this.call('webhooks', { url: webhookUrl }, 'POST');
  }

  /**
   * Obtener estadísticas de llamadas
   */
  async getStatistics(params: {
    start?: string;
    end?: string;
    sip?: string;
    skip?: number;
    limit?: number;
  } = {}) {
    return this.call('statistics', params);
  }

  /**
   * Solicitar grabación de llamada
   */
  async getPbxRecord(callId?: string, pbxCallId?: string, lifetime?: number) {
    const params: Record<string, any> = {};
    
    if (callId) params.call_id = callId;
    if (pbxCallId) params.pbx_call_id = pbxCallId;
    if (lifetime) params.lifetime = lifetime;
    
    if (!callId && !pbxCallId) {
      throw new Error('Se requiere callId o pbxCallId');
    }
    
    return this.call('pbx/record/request', params);
  }

  /**
   * Obtener información de números directos
   */
  async getDirectNumbers() {
    return this.call('info/number');
  }

  /**
   * Configurar redirección SIP
   */
  async setSipRedirection(sipNumber: string, destination: string, enabled: boolean = true) {
    return this.call('sip/redirection', {
      sip: sipNumber,
      destination,
      status: enabled ? 'on' : 'off'
    }, 'PUT');
  }
}