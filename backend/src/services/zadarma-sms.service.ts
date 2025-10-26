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
  private readonly API_KEY = process.env.ZADARMA_SMS_API_KEY || '95bedd9dbcc065b5ef54';
  private readonly API_SECRET = process.env.ZADARMA_SMS_API_SECRET || '66fc39c8dae8c5ad99f2';
  private readonly BASE_URL = 'https://api.zadarma.com';
  private readonly DEFAULT_SENDER = process.env.ZADARMA_SMS_SENDER_ID || 'BiosanaR';
  private readonly DEFAULT_LANGUAGE = process.env.ZADARMA_SMS_LANGUAGE || 'es';

  /**
   * Genera la firma SHA1+HMAC requerida por Zadarma API
   * Algoritmo según documentación oficial:
   * 1. Ordenar parámetros alfabéticamente
   * 2. Crear query string
   * 3. Calcular MD5 del query string
   * 4. Crear base string: METHOD + PATH + QUERY_STRING + MD5(QUERY_STRING)
   * 5. Aplicar HMAC-SHA1 con el SECRET
   * 6. Codificar en Base64
   * 
   * @param method Método HTTP (GET, POST, etc.)
   * @param path Ruta de la API
   * @param params Parámetros de la petición
   */
  private generateSignature(method: string, path: string, params: Record<string, any> = {}): string {
    // Paso 1 y 2: Ordenar parámetros y crear query string
    const sortedKeys = Object.keys(params).sort();
    const paramsStr = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');

    // Paso 3: Calcular MD5 del query string
    const paramsMd5 = paramsStr 
      ? crypto.createHash('md5').update(paramsStr).digest('hex')
      : '';

    // Paso 4: Crear base string = METHOD + PATH + PARAMS_STRING + MD5(PARAMS_STRING)
    const baseString = paramsStr
      ? `${method}${path}${paramsStr}${paramsMd5}`
      : `${method}${path}`;
    
    console.log('🔐 Generando firma Zadarma:', {
      method,
      path,
      params,
      paramsStr,
      paramsMd5,
      baseString: baseString.substring(0, 50) + '...',
    });
    
    // Paso 5 y 6: HMAC-SHA1 + Base64
    const signature = crypto
      .createHmac('sha1', this.API_SECRET)
      .update(baseString)
      .digest('base64');
    console.log('✅ Firma generada:', signature);
    
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
      const signature = this.generateSignature(method, path, apiParams);

      console.log('📤 Enviando SMS:', {
        number: apiParams.number,
        template_id: params.template_id,
        vars: params.template_vars,
      });

      // Realizar petición
      const response = await axios.post<ZadarmaSMSResponse>(
        `${this.BASE_URL}${path}`,
        new URLSearchParams(apiParams),
        {
          headers: {
            'Authorization': `${this.API_KEY}:${signature}`,
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
   * Obtiene la lista de sender IDs disponibles
   * @returns Lista de sender IDs
   */
  async getSenderIds(): Promise<any> {
    try {
      const path = '/v1/sms/senderid/';
      const method = 'GET';

      // Generar firma
      const signature = this.generateSignature(method, path);

      const response = await axios.get(`${this.BASE_URL}${path}`, {
        headers: {
          'Authorization': `${this.API_KEY}:${signature}`,
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
      sender: this.DEFAULT_SENDER,
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
      sender: this.DEFAULT_SENDER,
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
      sender: this.DEFAULT_SENDER,
    });
  }
}

export default new ZadarmaSMSService();
