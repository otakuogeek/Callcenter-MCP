import axios from 'axios';
import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface SendSMSParams {
  number: string | string[]; // Puede ser un número o array
  message: string;
  recipient_name?: string;
  patient_id?: number;
  appointment_id?: number;
  user_id?: number;
  template_id?: string;
}

interface SMSResult {
  success: boolean;
  data?: any;
  error?: string;
  details?: any;
  sent_at?: string;
  message_id?: string;
  credits_used?: number;
}

interface SMSLogEntry {
  recipient_number: string;
  recipient_name?: string;
  message: string;
  sender_id: string;
  template_id?: string;
  status: 'pending' | 'success' | 'failed';
  zadarma_response?: string;
  messages_sent?: number;
  cost?: number;
  currency?: string;
  parts?: number;
  error_message?: string;
  patient_id?: number;
  appointment_id?: number;
  user_id?: number;
}

class LabsMobileSMSService {
  private readonly apiUrl = 'https://api.labsmobile.com/json/send';
  private readonly username: string;
  private readonly token: string; // API token, no password
  private readonly sender: string;

  constructor() {
    // LabsMobile requiere username (email) y token API
    this.username = process.env.LABSMOBILE_USERNAME || 'contacto@biosanarcall.site';
    this.token = process.env.LABSMOBILE_API_KEY || 'Eq7Pcy8mxuQBiVenKqAXwdyiCAmeDER8';
    this.sender = process.env.LABSMOBILE_SENDER || 'Biosanar';
  }

  /**
   * Formatea un número telefónico colombiano al formato internacional
   * LabsMobile requiere formato internacional: 57XXXXXXXXXX (sin +)
   */
  private formatPhoneNumber(phone: string): string {
    // Eliminar todos los caracteres que no sean dígitos
    let cleaned = phone.replace(/\D/g, '');
    
    // Eliminar el prefijo 0 si está presente
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Casos de números colombianos
    if (cleaned.length === 10) {
      // Número colombiano de 10 dígitos (ej: 3105672307)
      return '57' + cleaned;
    } else if (cleaned.startsWith('57') && cleaned.length === 12) {
      // Ya tiene código de país 57 (ej: 573105672307)
      return cleaned;
    } else if (cleaned.length === 7) {
      // Teléfono fijo colombiano de 7 dígitos (falta indicativo)
      // Asumir Bogotá (601) por defecto
      return '5716' + cleaned;
    }
    
    // Si ya empieza con +, eliminarlo
    if (phone.startsWith('+')) {
      return phone.substring(1);
    }
    
    // Por defecto, agregar código de Colombia
    return '57' + cleaned;
  }

  /**
   * Envía un SMS usando LabsMobile API REST
   */
  async sendSMS(params: SendSMSParams): Promise<SMSResult> {
    const { number, message, recipient_name, patient_id, appointment_id, user_id, template_id } = params;

    try {
      console.log('📱 Iniciando envío de SMS con LabsMobile...');
      console.log('📞 Destinatario(s):', number);
      console.log('💬 Mensaje:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));

      // Validar longitud del mensaje (160 caracteres por SMS, hasta 4 concatenados)
      if (message.length > 612) {
        throw new Error(`Mensaje demasiado largo (${message.length} caracteres). Máximo: 612`);
      }

      // Formatear número(s)
      const numbers = Array.isArray(number) ? number : [number];
      const formattedNumbers = numbers.map(n => this.formatPhoneNumber(n));

      console.log('📞 Números formateados:', formattedNumbers);

      // Preparar el payload según documentación oficial de LabsMobile
      const payload = {
        recipient: formattedNumbers.map(num => ({
          msisdn: num
        })),
        message: message,
        tpoa: this.sender
      };

      console.log('📤 Enviando request a LabsMobile API...');
      
      // Autenticación con Basic Auth en el header
      const auth = Buffer.from(`${this.username}:${this.token}`).toString('base64');
      
      // Enviar SMS usando axios
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Authorization': `Basic ${auth}`
        },
        timeout: 30000 // 30 segundos timeout
      });

      console.log('📬 Respuesta de LabsMobile:', JSON.stringify(response.data, null, 2));

      // Verificar respuesta según documentación
      // code: "0" = éxito
      if (response.data.code === '0' || response.data.code === 0) {
        const sentAt = new Date();

        // Registrar en base de datos
        for (const phone of formattedNumbers) {
          await this.logSMS({
            recipient_number: phone,
            recipient_name: recipient_name,
            message: message,
            sender_id: this.sender,
            template_id: template_id,
            status: 'success',
            zadarma_response: JSON.stringify(response.data),
            messages_sent: 1,
            cost: response.data.cost ? parseFloat(response.data.cost) : 0,
            currency: 'EUR',
            parts: Math.ceil(message.length / 160),
            patient_id: patient_id,
            appointment_id: appointment_id,
            user_id: user_id
          });
        }

        return {
          success: true,
          data: response.data,
          message_id: response.data.subid,
          credits_used: response.data.cost ? parseFloat(response.data.cost) : undefined,
          sent_at: sentAt.toISOString()
        };
      } else {
        // Error de LabsMobile
        const errorMessage = response.data.message || `Error código ${response.data.code}`;
        
        console.error('❌ Error de LabsMobile:', errorMessage);

        // Registrar error en base de datos
        for (const phone of formattedNumbers) {
          await this.logSMS({
            recipient_number: phone,
            recipient_name: recipient_name,
            message: message,
            sender_id: this.sender,
            template_id: template_id,
            status: 'failed',
            zadarma_response: JSON.stringify(response.data),
            error_message: errorMessage,
            patient_id: patient_id,
            appointment_id: appointment_id,
            user_id: user_id
          });
        }

        return {
          success: false,
          error: errorMessage,
          details: response.data
        };
      }
    } catch (error: any) {
      console.error('❌ Error enviando SMS con LabsMobile:', error);

      // Registrar error en base de datos
      const numbers = Array.isArray(number) ? number : [number];
      for (const phone of numbers) {
        await this.logSMS({
          recipient_number: phone,
          recipient_name: recipient_name,
          message: message,
          sender_id: this.sender,
          template_id: template_id,
          status: 'failed',
          error_message: error.message || 'Error desconocido',
          patient_id: patient_id,
          appointment_id: appointment_id,
          user_id: user_id
        });
      }

      return {
        success: false,
        error: error.message || 'Error desconocido al enviar SMS',
        details: error.response?.data || error
      };
    }
  }

  /**
   * Registra un SMS en la base de datos
   */
  private async logSMS(entry: SMSLogEntry): Promise<void> {
    try {
      const query = `
        INSERT INTO sms_logs (
          recipient_number,
          recipient_name,
          message,
          sender_id,
          template_id,
          status,
          zadarma_response,
          messages_sent,
          cost,
          currency,
          parts,
          error_message,
          patient_id,
          appointment_id,
          user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await pool.query(query, [
        entry.recipient_number,
        entry.recipient_name || null,
        entry.message,
        entry.sender_id,
        entry.template_id || null,
        entry.status,
        entry.zadarma_response || null,
        entry.messages_sent || 1,
        entry.cost || 0,
        entry.currency || 'EUR',
        entry.parts || 1,
        entry.error_message || null,
        entry.patient_id || null,
        entry.appointment_id || null,
        entry.user_id || null
      ]);

      console.log('✅ SMS registrado en base de datos');
    } catch (error: any) {
      console.error('❌ Error registrando SMS en base de datos:', error);
      // No lanzar error para no afectar el flujo principal
    }
  }

  /**
   * Obtiene el balance/créditos disponibles
   */
  async getBalance(): Promise<any> {
    try {
      // Autenticación con Basic Auth en el header
      const auth = Buffer.from(`${this.username}:${this.token}`).toString('base64');

      const response = await axios.get('https://api.labsmobile.com/json/balance', {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      console.log('💰 Balance de LabsMobile:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error obteniendo balance:', error);
      throw error;
    }
  }

  /**
   * Envía SMS de confirmación de cita
   */
  async sendAppointmentConfirmation(
    phone: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string,
    doctorName: string,
    location: string
  ): Promise<SMSResult> {
    const message = `Hola ${patientName}, su cita con ${doctorName} está confirmada para el ${appointmentDate} a las ${appointmentTime} en ${location}. Fundación Biosanar IPS.`;
    
    return this.sendSMS({
      number: phone,
      message
    });
  }

  /**
   * Envía SMS de recordatorio de cita
   */
  async sendAppointmentReminder(
    phone: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string,
    doctorName: string,
    location: string
  ): Promise<SMSResult> {
    const message = `Recordatorio: ${patientName}, su cita con ${doctorName} es mañana ${appointmentDate} a las ${appointmentTime} en ${location}. Fundación Biosanar IPS.`;
    
    return this.sendSMS({
      number: phone,
      message
    });
  }

  /**
   * Envía SMS de cancelación de cita
   */
  async sendAppointmentCancellation(
    phone: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string,
    reason?: string
  ): Promise<SMSResult> {
    let message = `${patientName}, su cita del ${appointmentDate} a las ${appointmentTime} ha sido cancelada.`;
    if (reason) {
      message += ` Motivo: ${reason}.`;
    }
    message += ' Para reagendar, comuníquese con Fundación Biosanar IPS.';
    
    return this.sendSMS({
      number: phone,
      message
    });
  }
}

// Exportar instancia única del servicio
export default new LabsMobileSMSService();
