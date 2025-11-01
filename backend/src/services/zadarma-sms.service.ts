import crypto from 'crypto';
import axios from 'axios';

interface ZadarmaSMSResponse {
  status: string;
  messages?: number;
  cost?: number;
  currency?: string;
  sms_detalization?: Array<{
    senderid: string;
    number: string;
    cost: number;
  }>;
  denied_numbers?: Array<{
    number: string;
    message: string;
  }>;
  message?: string;
}

interface SendSMSParams {
  number: string | string[]; // Puede ser un número o varios separados por coma
  message?: string; // Opcional: solo si no se usa template_id
  template_id?: number; // ID de plantilla de Zadarma
  template_vars?: string[]; // Variables para la plantilla ({$var})
  sender?: string; // Opcional: número virtual o texto
  language?: string; // Opcional: idioma de la plantilla
}

// IDs de plantillas de Zadarma para el sistema médico
const ZADARMA_TEMPLATES = {
  CITA_CONFIRMACION: 9574, // "Tiene cita con nosotros el: {$var} a las {$var}.\n¡Que tenga un buen día!\n{$var}"
  CITA_MODIFICADA: 9587,   // "Clínica {$var}, cita modificada a {$var}."
  CITA_ADJUDICADA: 9586,   // "Clínica {$var} le espera el {$var} a las {$var}."
  CANCELACION: 9561,       // "Compañía {$var} le informa sobre la cancelación de su reserva {$var}."
} as const;

class ZadarmaSMSService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl = 'https://api.zadarma.com';
  private readonly defaultSender: string;
  private readonly defaultLanguage = process.env.ZADARMA_SMS_LANGUAGE || 'es';

  constructor() {
    // Usar credenciales de Zadarma SMS desde variables de entorno
    this.apiKey = process.env.ZADARMA_SMS_API_KEY || process.env.ZADARMA_USER_KEY || '';
    this.apiSecret = process.env.ZADARMA_SMS_API_SECRET || process.env.ZADARMA_SECRET_KEY || '';
    this.defaultSender = process.env.ZADARMA_SMS_SENDER_ID || 'BiosanaR';

    console.log('🔧 Inicializando Servicio SMS Zadarma...');
    console.log('📍 API Key:', this.apiKey);
    console.log('🔐 Secret:', this.apiSecret ? this.apiSecret.substring(0, 8) + '...' : 'NO CONFIGURADO');
    
    if (!this.apiKey || !this.apiSecret) {
      console.error('❌ ADVERTENCIA: Credenciales de Zadarma SMS no configuradas en .env');
    } else {
      console.log('✅ Servicio SMS Zadarma inicializado correctamente');
    }
  }

  /**
   * Generar firma de autenticación para Zadarma
   * Método oficial: base64(hmac_sha1(method + params + md5(params), secret))
   */
  private generateSignature(method: string, params: Record<string, any> = {}): string {
    // Filtrar objetos y ordenar parámetros alfabéticamente
    const filteredParams = Object.keys(params)
      .filter(key => typeof params[key] !== 'object')
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    // Construir query string (debe quedar igual que PHP: format=json&language=es)
    const queryString = new URLSearchParams(filteredParams).toString();
    
    // Crear MD5 del query string (en hexadecimal)
    const md5Hash = crypto.createHash('md5').update(queryString).digest('hex');
    
    // Crear firma: method + queryString + md5(queryString)
    const signatureString = method + queryString + md5Hash;
    
    // HMAC-SHA1 con base64 (digest en binario, no hex, antes de base64)
    const signature = crypto
      .createHmac('sha1', this.apiSecret)
      .update(signatureString)
      .digest('base64');

    return signature;
  }

  /**
   * Envía un SMS usando la API de Zadarma
   * @param params Parámetros del SMS (número, mensaje O template_id + vars)
   * @returns Respuesta de la API de Zadarma
   */
  async sendSMS(params: SendSMSParams): Promise<ZadarmaSMSResponse> {
    try {
      const path = '/v1/sms/send/';
      const method = 'POST';

      // Preparar parámetros (IMPORTANTE: format=json es requerido por Zadarma)
      const apiParams: Record<string, string> = {
        number: Array.isArray(params.number) ? params.number.join(',') : params.number,
        format: 'json', // Requerido por la API de Zadarma
      };

      // Opción 1: Usar plantilla (recomendado)
      if (params.template_id) {
        apiParams.template_id = params.template_id.toString();
        
        // Si hay variables para la plantilla
        if (params.template_vars && params.template_vars.length > 0) {
          params.template_vars.forEach((value, index) => {
            apiParams[`var${index + 1}`] = value;
          });
        }
      } 
      // Opción 2: Mensaje de texto libre (requiere plantilla en Zadarma)
      else if (params.message) {
        apiParams.message = params.message;
      } else {
        throw new Error('Debe proporcionar template_id con variables o message');
      }

      if (params.sender) {
        apiParams.sender = params.sender;
      }

      if (params.language) {
        apiParams.language = params.language;
      }

      // Generar firma
      const signature = this.generateSignature(path, apiParams);

      console.log('📤 Enviando SMS:', {
        number: apiParams.number,
        template_id: params.template_id,
        vars: params.template_vars,
      });

      // Realizar petición
      const response = await axios.post<ZadarmaSMSResponse>(
        `${this.baseUrl}${path}`,
        new URLSearchParams(apiParams),
        {
          headers: {
            'Authorization': `${this.apiKey}:${signature}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      console.log('✅ SMS enviado exitosamente:', {
        numbers: apiParams.number,
        messages: response.data.messages,
        cost: response.data.cost,
        currency: response.data.currency,
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error enviando SMS Zadarma:', {
        error: error.response?.data || error.message,
        params,
      });

      // Retornar error estructurado
      return {
        status: 'error',
        message: error.response?.data?.message || error.message || 'Error desconocido al enviar SMS',
      };
    }
  }

  /**
   * Obtiene la lista de plantillas SMS disponibles en Zadarma
   * @returns Lista de plantillas
   */
  async getSMSTemplates(language: string = 'es'): Promise<any> {
    try {
      const path = '/v1/sms/templates/';
      
      const params: Record<string, any> = {
        language: language,
        format: 'json'
      };

      // Generar firma
      const signature = this.generateSignature(path, params);

      console.log('📋 Consultando plantillas SMS de Zadarma...');
      console.log('DEBUG - API Key:', this.apiKey);
      console.log('DEBUG - Signature:', signature);
      console.log('DEBUG - Params:', params);

      const response = await axios.get(`${this.baseUrl}${path}`, {
        params,
        headers: {
          'Authorization': `${this.apiKey}:${signature}`,
        },
      });

      console.log('✅ Plantillas obtenidas:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error obteniendo plantillas SMS:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene la lista de sender IDs disponibles
   * @returns Lista de sender IDs
   */
  async getSenderIds(): Promise<any> {
    try {
      const path = '/v1/sms/senderid/';
      
      const params: Record<string, any> = {
        format: 'json'
      };

      // Generar firma
      const signature = this.generateSignature(path, params);

      const response = await axios.get(`${this.baseUrl}${path}`, {
        params,
        headers: {
          'Authorization': `${this.apiKey}:${signature}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error obteniendo sender IDs:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Envía un SMS de confirmación de cita usando plantilla de Zadarma
   * Plantilla ID 9574: "Tiene cita con nosotros el: {$var} a las {$var}.\n¡Que tenga un buen día!\n{$var}"
   * @param phoneNumber Número de teléfono del paciente
   * @param patientName Nombre del paciente
   * @param appointmentDate Fecha de la cita
   * @param appointmentTime Hora de la cita
   * @param doctorName Nombre del doctor
   * @param location Sede
   */
  async sendAppointmentConfirmation(
    phoneNumber: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string,
    doctorName: string,
    location: string
  ): Promise<ZadarmaSMSResponse> {
    return this.sendSMS({
      number: phoneNumber,
      template_id: ZADARMA_TEMPLATES.CITA_CONFIRMACION,
      template_vars: [
        appointmentDate,
        appointmentTime,
        `Fundación Biosanar IPS - ${location}`,
      ],
      sender: this.defaultSender,
    });
  }

  /**
   * Envía un SMS de recordatorio de cita usando plantilla de Zadarma
   * Plantilla ID 9574: "Tiene cita con nosotros el: {$var} a las {$var}.\n¡Que tenga un buen día!\n{$var}"
   * @param phoneNumber Número de teléfono del paciente
   * @param patientName Nombre del paciente
   * @param appointmentDate Fecha de la cita
   * @param appointmentTime Hora de la cita
   */
  async sendAppointmentReminder(
    phoneNumber: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string
  ): Promise<ZadarmaSMSResponse> {
    return this.sendSMS({
      number: phoneNumber,
      template_id: ZADARMA_TEMPLATES.CITA_CONFIRMACION,
      template_vars: [
        appointmentDate,
        appointmentTime,
        'Recordatorio - Fundación Biosanar IPS',
      ],
      sender: this.defaultSender,
    });
  }

  /**
   * Envía un SMS de cancelación de cita usando plantilla de Zadarma
   * Plantilla ID 9561: "Compañía {$var} le informa sobre la cancelación de su reserva {$var}."
   * @param phoneNumber Número de teléfono del paciente
   * @param patientName Nombre del paciente
   * @param appointmentDate Fecha de la cita
   */
  async sendAppointmentCancellation(
    phoneNumber: string,
    patientName: string,
    appointmentDate: string
  ): Promise<ZadarmaSMSResponse> {
    return this.sendSMS({
      number: phoneNumber,
      template_id: ZADARMA_TEMPLATES.CANCELACION,
      template_vars: [
        'Fundación Biosanar IPS',
        `cita del ${appointmentDate}`,
      ],
      sender: this.defaultSender,
    });
  }
}

export default new ZadarmaSMSService();
