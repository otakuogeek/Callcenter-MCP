import axios from 'axios';
import pool from '../db/pool';
import { 
  formatDateColombia, 
  formatTimeColombia, 
  formatTime24Colombia,
  parseMySQLDatetime,
  COLOMBIA_TIMEZONE 
} from '../utils/dateUtils';
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
  api_response?: string;
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
   * Formatea un número telefónico al formato internacional SIN el signo +
   * LabsMobile requiere formato internacional: 57XXXXXXXXXX (sin +)
   * También soporta números de Venezuela (58)
   */
  private formatPhoneNumber(phone: string): string {
    // Eliminar todos los caracteres que no sean dígitos (incluido el +)
    let cleaned = phone.replace(/\D/g, '');

    // Eliminar el prefijo 0 si está presente al inicio
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Casos de números colombianos (código país 57)
    if (cleaned.length === 10 && cleaned.startsWith('3')) {
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

    // Casos de números de Venezuela (código país 58)
    if (cleaned.startsWith('58') && cleaned.length >= 12) {
      // Ya tiene código de país 58 (ej: 584263774021)
      return cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('4')) {
      // Número venezolano de 10 dígitos (ej: 4263774021)
      return '58' + cleaned;
    }

    // Si el número tiene más de 10 dígitos y empieza con código país válido, devolverlo limpio
    if (cleaned.length >= 11) {
      return cleaned;
    }

    // Por defecto, asumir código de Colombia
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
            api_response: JSON.stringify(response.data),
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
            api_response: JSON.stringify(response.data),
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

      // Registrar error en base de datos - usar números formateados (sin +)
      const numbers = Array.isArray(number) ? number : [number];
      for (const phone of numbers) {
        await this.logSMS({
          recipient_number: this.formatPhoneNumber(phone),
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
          api_response,
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
        entry.api_response || null,
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
   * Formatea una fecha para SMS, convirtiendo de UTC-0 a Colombia UTC-5
   * Utiliza las funciones centralizadas de dateUtils.ts
   * @param dateString - Fecha en formato MySQL o ISO (UTC-0)
   * @returns Fecha formateada como DD/MM/YYYY en zona horaria Colombia
   */
  private formatDate(dateString: string): string {
    try {
      if (!dateString) return '';
      
      // Usar la utilidad centralizada que maneja correctamente UTC-0 → UTC-5
      return formatDateColombia(dateString);
    } catch (error) {
      console.warn('Error formateando fecha para SMS:', dateString, error);
      return dateString; // Retornar original si hay error
    }
  }

  /**
   * Formatea una hora para SMS, convirtiendo de UTC-0 a Colombia UTC-5
   * @param dateOrTimeString - Fecha/hora completa de MySQL (UTC-0) o solo hora HH:mm
   * @returns Hora formateada como h:mm AM/PM en zona horaria Colombia
   */
  private formatTime(dateOrTimeString: string): string {
    try {
      if (!dateOrTimeString) return '';
      
      // Si es solo una hora (ej: "14:00" o "14:00:00"), crear un datetime para convertir
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(dateOrTimeString)) {
        // Hora sola sin fecha - asumir que ya está en la zona horaria correcta
        // ya que se usa cuando la hora ya fue extraída de la disponibilidad
        const [hours, minutes] = dateOrTimeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      }
      
      // Si es un datetime completo, usar la utilidad centralizada
      return formatTimeColombia(dateOrTimeString);
    } catch (error) {
      console.warn('Error formateando hora para SMS:', dateOrTimeString, error);
      return dateOrTimeString; // Retornar original si hay error
    }
  }

  /**
   * Formatea fecha y hora desde un datetime completo de MySQL (UTC-0) a Colombia (UTC-5)
   * @param scheduledAt - Datetime de MySQL en formato 'YYYY-MM-DD HH:mm:ss' (UTC-0)
   * @returns Objeto con fecha y hora formateadas para Colombia
   */
  private formatAppointmentDateTime(scheduledAt: string): { date: string; time: string } {
    try {
      // Usar las utilidades centralizadas de dateUtils.ts
      const date = formatDateColombia(scheduledAt); // DD/MM/YYYY
      const time = formatTimeColombia(scheduledAt); // h:mm a. m./p. m.
      return { date, time };
    } catch (error) {
      console.warn('Error formateando datetime para SMS:', scheduledAt, error);
      return { date: scheduledAt, time: '' };
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
    const formattedDate = this.formatDate(appointmentDate);
    const formattedTime = this.formatTime(appointmentTime);

    const message = `Hola ${patientName}, su cita con ${doctorName} está confirmada para el ${formattedDate} a las ${formattedTime} en ${location}. Fundación Biosanar IPS.`;

    return this.sendSMS({
      number: phone,
      message
    });
  }

  /**
   * Envía SMS de confirmación de cita usando datetime completo de MySQL (UTC-0)
   * Esta versión convierte automáticamente a la zona horaria de Colombia (UTC-5)
   * @param phone - Número de teléfono del paciente
   * @param patientName - Nombre del paciente
   * @param scheduledAt - Datetime de MySQL (UTC-0) en formato 'YYYY-MM-DD HH:mm:ss'
   * @param doctorName - Nombre del doctor
   * @param location - Sede/ubicación
   */
  async sendAppointmentConfirmationFromScheduledAt(
    phone: string,
    patientName: string,
    scheduledAt: string,
    doctorName: string,
    location: string
  ): Promise<SMSResult> {
    const { date, time } = this.formatAppointmentDateTime(scheduledAt);

    const message = `Hola ${patientName}, su cita con ${doctorName} está confirmada para el ${date} a las ${time} en ${location}. Fundación Biosanar IPS.`;

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
    const formattedDate = this.formatDate(appointmentDate);
    const formattedTime = this.formatTime(appointmentTime);

    const message = `Recordatorio: ${patientName}, su cita con ${doctorName} es mañana ${formattedDate} a las ${formattedTime} en ${location}. Fundación Biosanar IPS.`;

    return this.sendSMS({
      number: phone,
      message
    });
  }

  /**
   * Envía SMS de recordatorio de cita usando datetime completo de MySQL (UTC-0)
   * Esta versión convierte automáticamente a la zona horaria de Colombia (UTC-5)
   */
  async sendAppointmentReminderFromScheduledAt(
    phone: string,
    patientName: string,
    scheduledAt: string,
    doctorName: string,
    location: string
  ): Promise<SMSResult> {
    const { date, time } = this.formatAppointmentDateTime(scheduledAt);

    const message = `Recordatorio: ${patientName}, su cita con ${doctorName} es mañana ${date} a las ${time} en ${location}. Fundación Biosanar IPS.`;

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
    const formattedDate = this.formatDate(appointmentDate);
    const formattedTime = this.formatTime(appointmentTime);

    let message = `${patientName}, su cita del ${formattedDate} a las ${formattedTime} ha sido cancelada.`;
    if (reason) {
      message += ` Motivo: ${reason}.`;
    }
    message += ' Para reagendar, comuníquese con Fundación Biosanar IPS.';

    return this.sendSMS({
      number: phone,
      message
    });
  }

  /**
   * Envía SMS de cancelación de cita usando datetime completo de MySQL (UTC-0)
   * Esta versión convierte automáticamente a la zona horaria de Colombia (UTC-5)
   */
  async sendAppointmentCancellationFromScheduledAt(
    phone: string,
    patientName: string,
    scheduledAt: string,
    reason?: string
  ): Promise<SMSResult> {
    const { date, time } = this.formatAppointmentDateTime(scheduledAt);

    let message = `${patientName}, su cita del ${date} a las ${time} ha sido cancelada.`;
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
