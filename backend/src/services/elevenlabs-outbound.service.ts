import axios from 'axios';

/**
 * Servicio para realizar llamadas salientes REALES usando ElevenLabs Conversational AI
 * Este método hace llamadas telefónicas directas usando la API de ElevenLabs
 */
class ElevenLabsOutboundService {
  private readonly API_KEY: string;
  private readonly AGENT_ID: string;
  private readonly API_BASE = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.API_KEY = process.env.ELEVENLABS_API_KEY || '';
    this.AGENT_ID = process.env.ELEVENLABS_AGENT_ID || '';

    if (!this.API_KEY) {
      throw new Error('ELEVENLABS_API_KEY no está configurado');
    }
  }

  /**
   * Inicia una llamada saliente REAL usando ElevenLabs
   * @param phoneNumber - Número de teléfono destino (formato internacional +584264377421)
   * @param customMessage - Mensaje personalizado que el agente dirá (opcional)
   */
  async makeOutboundCall(phoneNumber: string, customMessage?: string): Promise<any> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      console.log('📞 [ElevenLabs] Iniciando llamada saliente real...');
      console.log('   Número destino:', normalizedPhone);
      console.log('   Agente ID:', this.AGENT_ID);

      // Preparar el payload para la llamada
      const payload: any = {
        agent_id: this.AGENT_ID,
        // Número destino en formato E.164
        phone_number: normalizedPhone,
      };

      // Si hay mensaje personalizado, agregarlo como primera frase del agente
      if (customMessage) {
        payload.first_message = customMessage;
      }

      // Llamar a la API de ElevenLabs para iniciar llamada saliente
      const response = await axios.post(
        `${this.API_BASE}/convai/conversation/phone`,
        payload,
        {
          headers: {
            'xi-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ [ElevenLabs] Llamada iniciada exitosamente');
      console.log('   Conversation ID:', response.data.conversation_id);
      console.log('   Estado:', response.data.status);

      return {
        success: true,
        conversationId: response.data.conversation_id,
        phoneNumber: normalizedPhone,
        status: response.data.status,
        message: 'Llamada telefónica real iniciada con ElevenLabs',
        data: response.data
      };

    } catch (error: any) {
      console.error('❌ [ElevenLabs] Error iniciando llamada:', error.response?.data || error.message);
      
      // Manejar errores específicos
      if (error.response?.status === 404) {
        throw new Error(
          'Las llamadas salientes no están disponibles en tu plan de ElevenLabs. ' +
          'Necesitas: 1) Actualizar a plan Enterprise, o 2) Comprar un número de teléfono en ElevenLabs'
        );
      }
      
      if (error.response?.status === 403) {
        throw new Error('El agente no tiene permisos para hacer llamadas salientes');
      }

      throw error;
    }
  }

  /**
   * Obtiene el estado de una llamada
   */
  async getCallStatus(conversationId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.API_BASE}/convai/conversation/${conversationId}`,
        {
          headers: {
            'xi-api-key': this.API_KEY
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ [ElevenLabs] Error obteniendo estado:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Normaliza un número de teléfono al formato E.164 requerido por ElevenLabs
   * Formato: +[código país][número] sin espacios ni caracteres especiales
   */
  private normalizePhoneNumber(phone: string): string {
    // Limpiar el número de espacios, guiones y paréntesis
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Si ya tiene +, verificar que sea válido
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // Si empieza con 00, convertir a +
    if (cleaned.startsWith('00')) {
      return '+' + cleaned.substring(2);
    }

    // Si no tiene código de país, asumir Colombia (+57)
    if (cleaned.length === 10) {
      return '+57' + cleaned;
    }

    // Si tiene código de país sin +, agregarlo
    if ((cleaned.startsWith('57') || cleaned.startsWith('58')) && cleaned.length > 10) {
      return '+' + cleaned;
    }

    // Si ya está correcto, devolverlo con +
    return '+' + cleaned;
  }
}

export const elevenLabsOutboundService = new ElevenLabsOutboundService();
