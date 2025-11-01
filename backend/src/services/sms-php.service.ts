import { exec } from 'child_process';
import { promisify } from 'util';
import pool from '../db/pool';

const execAsync = promisify(exec);

interface SendSMSParams {
  number: string | string[]; // Puede ser un número o array
  message: string;
  template_id?: number;
  template_vars?: string[];
  recipient_name?: string;
  patient_id?: number;
  appointment_id?: number;
  user_id?: number;
}

interface SMSResult {
  success: boolean;
  data?: any;
  error?: string;
  details?: any;
  sent_at?: string;
}

class SMSServicePHP {
  private readonly phpScriptPath = '/home/ubuntu/app/zadarma-oficial/send-sms-cli.php';

  /**
   * Formatea un número telefónico colombiano al formato internacional correcto
   * Formato esperado: +57XXXXXXXXXX (10 dígitos después del +57)
   */
  private formatPhoneNumber(phone: string): string {
    // Eliminar todos los caracteres que no sean dígitos
    let cleaned = phone.replace(/\D/g, '');
    
    // Eliminar el prefijo 0 si está presente (común en números colombianos)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Casos de números colombianos
    if (cleaned.length === 10) {
      // Número colombiano de 10 dígitos (ej: 3105672307)
      return '+57' + cleaned;
    } else if (cleaned.startsWith('57') && cleaned.length === 12) {
      // Ya tiene código de país 57 (ej: 573105672307)
      return '+' + cleaned;
    } else if (cleaned.length === 7) {
      // Teléfono fijo colombiano de 7 dígitos (falta indicativo)
      // Asumir Bogotá (601) por defecto - esto podría mejorarse con la ubicación del paciente
      return '+5716' + cleaned; // 57 (Colombia) + 1 (Bogotá) + 6XXXXXX
    }
    
    // Casos de otros países latinoamericanos
    const internationalCodes = [
      { code: '1', minLen: 10, maxLen: 10 },      // USA/Canadá
      { code: '52', minLen: 10, maxLen: 10 },     // México
      { code: '58', minLen: 10, maxLen: 10 },     // Venezuela
      { code: '591', minLen: 8, maxLen: 8 },      // Bolivia
      { code: '593', minLen: 9, maxLen: 9 },      // Ecuador
      { code: '594', minLen: 9, maxLen: 9 },      // Guayana Francesa
      { code: '595', minLen: 9, maxLen: 9 },      // Paraguay
      { code: '598', minLen: 8, maxLen: 9 },      // Uruguay
    ];
    
    for (const { code, minLen, maxLen } of internationalCodes) {
      if (cleaned.startsWith(code)) {
        const localNumber = cleaned.substring(code.length);
        if (localNumber.length >= minLen && localNumber.length <= maxLen) {
          return '+' + cleaned;
        }
      }
    }
    
    // Si no coincide con ningún formato conocido, asumir que es colombiano
    // y agregar +57 (puede que falten dígitos, pero al menos tendrá el formato)
    const result = '+57' + cleaned;
    
    console.log(`📞 Número formateado: "${phone}" → "${result}"`);
    return result;
  }
  
  /**
   * Actualiza el número de teléfono de un paciente en la base de datos
   */
  private async updatePatientPhone(patientId: number, formattedPhone: string): Promise<void> {
    try {
      const [result]: any = await pool.query(
        'UPDATE patients SET phone = ? WHERE id = ?',
        [formattedPhone, patientId]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✅ Número actualizado en BD para paciente ${patientId}: ${formattedPhone}`);
      }
    } catch (error) {
      console.error(`❌ Error actualizando número del paciente ${patientId}:`, error);
      // No lanzar error para no interrumpir el envío del SMS
    }
  }

  /**
   * Envía un SMS usando el script PHP de Zadarma
   */
  async sendSMS(params: SendSMSParams): Promise<SMSResult> {
    const {
      number,
      message,
      template_id,
      template_vars,
      recipient_name,
      patient_id,
      appointment_id,
      user_id,
    } = params;

    // Manejar múltiples números
    const numbers = Array.isArray(number) ? number : [number];
    const results: SMSResult[] = [];

    for (const phoneNumber of numbers) {
      try {
        // Formatear el número antes de enviar
        const formattedNumber = this.formatPhoneNumber(phoneNumber);
        console.log(`📤 Enviando SMS a ${formattedNumber}...`);
        
        // Si hay patient_id y el número fue formateado, actualizar en BD
        if (patient_id && formattedNumber !== phoneNumber) {
          await this.updatePatientPhone(patient_id, formattedNumber);
        }

        // Detectar si es número colombiano y forzar uso de plantilla
        const isColombianNumber = formattedNumber.startsWith('+57');
        let finalTemplateId = template_id;
        let finalTemplateVars = template_vars;
        let finalMessage = message;

        if (isColombianNumber && !template_id) {
          // Para números colombianos, usar plantilla obligatoria
          console.log('⚠️  Número colombiano detectado - Usando plantilla obligatoria');
          finalTemplateId = 1; // ID de la plantilla en Zadarma
          
          // Extraer variables del mensaje o usar valores por defecto
          // Formato: IPS Biosanar le recuerda: Cita para {$var} el {$var} a las {$var} con {$var} de {$var} en la {$var}
          finalTemplateVars = [
            recipient_name || 'Paciente',  // {$var} - Nombre del paciente
            'Próximamente',                 // {$var} - Fecha (día y fecha)
            'Por confirmar',                // {$var} - Hora
            'Dr. Médico',                   // {$var} - Doctor
            'Medicina General',             // {$var} - Especialidad
            'Sede Principal'                // {$var} - Ubicación
          ];
          
          // Si el mensaje original tiene información, intentar extraerla
          if (message && message.includes('Cita')) {
            // El mensaje ya está estructurado, extraer variables si es posible
            const citaMatch = message.match(/Cita para (.+?) el (.+?) a las (.+?) con (.+?) de (.+?) en (?:la )?(.+?)(?:\.|$)/);
            if (citaMatch) {
              finalTemplateVars = [
                citaMatch[1] || recipient_name || 'Paciente',
                citaMatch[2] || 'Próximamente',
                citaMatch[3] || 'Por confirmar',
                citaMatch[4] || 'Dr. Médico',
                citaMatch[5] || 'Medicina General',
                citaMatch[6] || 'Sede Principal'
              ];
            }
          }
          
          console.log('📋 Variables de plantilla:', finalTemplateVars);
        }

        // Preparar datos para el script PHP
        const phpInput = {
          number: formattedNumber, // Usar número formateado
          message: finalMessage,
          template_id: finalTemplateId,
          template_vars: finalTemplateVars,
        };

        const phpInputJson = JSON.stringify(phpInput).replace(/'/g, "'\\''");

        // Ejecutar script PHP
        const { stdout, stderr } = await execAsync(
          `php ${this.phpScriptPath} '${phpInputJson}'`
        );

        if (stderr && stderr.includes('error')) {
          console.error('❌ Error PHP stderr:', stderr);
        }

        const result: SMSResult = JSON.parse(stdout);

        // Guardar en base de datos
        await this.saveSMSLog({
          recipient_number: formattedNumber, // Guardar número formateado
          recipient_name,
          message,
          template_id: template_id?.toString(),
          status: result.success ? 'success' : 'failed',
          zadarma_response: result.data || result.details,
          messages_sent: result.data?.messages || 0,
          cost: result.data?.cost || 0,
          currency: result.data?.currency || 'USD',
          parts: result.data?.sms_detalization?.[0]?.parts || 1,
          sender_id: result.data?.sms_detalization?.[0]?.callerid,
          error_message: result.error,
          patient_id,
          appointment_id,
          user_id,
          sent_at: result.sent_at,
        });

        console.log(
          `✅ SMS enviado a ${phoneNumber}${result.data?.cost ? ` - Costo: ${result.data.cost} ${result.data.currency}` : ''}`
        );

        results.push(result);
      } catch (error: any) {
        console.error(`❌ Error enviando SMS a ${phoneNumber}:`, error.message);

        const errorResult: SMSResult = {
          success: false,
          error: error.message,
        };

        // Guardar error en base de datos
        await this.saveSMSLog({
          recipient_number: phoneNumber,
          recipient_name,
          message,
          status: 'failed',
          error_message: error.message,
          patient_id,
          appointment_id,
          user_id,
        });

        results.push(errorResult);
      }
    }

    // Si solo era un número, retornar el primer resultado
    if (!Array.isArray(number)) {
      return results[0];
    }

    // Para múltiples números, retornar resumen
    const allSuccess = results.every((r) => r.success);
    return {
      success: allSuccess,
      data: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      },
    };
  }

  /**
   * Guarda el log del SMS en la base de datos
   */
  private async saveSMSLog(log: {
    recipient_number: string;
    recipient_name?: string;
    message: string;
    template_id?: string;
    sender_id?: string;
    status: 'pending' | 'success' | 'failed';
    zadarma_response?: any;
    messages_sent?: number;
    cost?: number;
    currency?: string;
    parts?: number;
    error_message?: string;
    patient_id?: number;
    appointment_id?: number;
    user_id?: number;
    sent_at?: string;
  }): Promise<void> {
    try {
      const query = `
        INSERT INTO sms_logs (
          recipient_number, recipient_name, message, template_id, sender_id,
          status, zadarma_response, messages_sent, cost, currency, parts,
          error_message, patient_id, appointment_id, user_id, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await pool.execute(query, [
        log.recipient_number,
        log.recipient_name || null,
        log.message,
        log.template_id || null,
        log.sender_id || null,
        log.status,
        log.zadarma_response ? JSON.stringify(log.zadarma_response) : null,
        log.messages_sent || 0,
        log.cost || 0,
        log.currency || 'USD',
        log.parts || 1,
        log.error_message || null,
        log.patient_id || null,
        log.appointment_id || null,
        log.user_id || null,
        log.sent_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
      ]);

      console.log('💾 SMS log guardado en base de datos');
    } catch (error: any) {
      console.error('❌ Error guardando SMS log:', error.message);
    }
  }

  /**
   * Obtiene el historial de SMS
   */
  async getSMSHistory(filters?: {
    recipient_number?: string;
    status?: string;
    patient_id?: number;
    appointment_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      let query = 'SELECT * FROM sms_logs WHERE 1=1';
      const params: any[] = [];

      if (filters?.recipient_number) {
        query += ' AND recipient_number = ?';
        params.push(filters.recipient_number);
      }

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters?.patient_id) {
        query += ' AND patient_id = ?';
        params.push(filters.patient_id);
      }

      if (filters?.appointment_id) {
        query += ' AND appointment_id = ?';
        params.push(filters.appointment_id);
      }

      query += ' ORDER BY sent_at DESC';

      if (filters?.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const [rows] = await pool.execute(query, params);
      return rows as any[];
    } catch (error: any) {
      console.error('❌ Error obteniendo historial SMS:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de SMS
   */
  async getSMSStats(year?: number, month?: number): Promise<any> {
    try {
      const currentYear = year || new Date().getFullYear();
      const currentMonth = month || new Date().getMonth() + 1;

      const query = `
        SELECT 
          COUNT(*) as total_sent,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as total_success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
          SUM(cost) as total_cost,
          currency
        FROM sms_logs
        WHERE YEAR(sent_at) = ? AND MONTH(sent_at) = ?
        GROUP BY currency
      `;

      const [rows] = await pool.execute(query, [currentYear, currentMonth]);
      return rows;
    } catch (error: any) {
      console.error('❌ Error obteniendo estadísticas SMS:', error);
      throw error;
    }
  }
}

// Exportar instancia única
export default new SMSServicePHP();
