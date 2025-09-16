import axios from 'axios';
import { WhatsAppAgentResponse, PatientData } from '../types';

export class WhatsAppAgentService {
  private backendBaseUrl: string;
  private backendToken: string;

  constructor() {
    this.backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000/api';
    this.backendToken = process.env.BACKEND_TOKEN || '';
  }

  /**
   * Procesa mensaje de voz usando la misma lógica del agente de WhatsApp
   */
  async processVoiceMessage(
    transcript: string,
    callerNumber: string,
    context?: {
      conversationHistory?: string[];
      patientData?: Partial<PatientData>;
      currentIntent?: string;
    }
  ): Promise<WhatsAppAgentResponse> {
    try {
      console.log(`[WhatsApp Agent] Procesando mensaje de voz de ${callerNumber}: "${transcript.substring(0, 100)}..."`);

      // Preparar payload similar al agente de WhatsApp
      const payload = {
        message: transcript,
        from: callerNumber,
        messageType: 'voice',
        context: {
          isVoiceCall: true,
          conversationHistory: context?.conversationHistory || [],
          patientData: context?.patientData || {},
          currentIntent: context?.currentIntent || 'unknown',
          channel: 'voice'
        }
      };

      // Llamar al servicio del agente de WhatsApp adaptado para voz
      const response = await axios({
        method: 'post',
        url: `${this.backendBaseUrl}/whatsapp/process-voice`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.backendToken}`
        },
        data: payload,
        timeout: 30000
      });

      if (response.data.success) {
        const agentResponse: WhatsAppAgentResponse = {
          message: response.data.data.message,
          followUpQuestions: response.data.data.followUpQuestions || [],
          suggestedActions: response.data.data.suggestedActions || [],
          requiresHumanIntervention: response.data.data.requiresHumanIntervention || false,
          mcpToolsUsed: response.data.data.mcpToolsUsed || [],
          confidence: response.data.data.confidence || 0.8
        };

        console.log(`[WhatsApp Agent] Respuesta generada con confianza: ${agentResponse.confidence}`);
        return agentResponse;
      } else {
        throw new Error(response.data.error || 'Error procesando mensaje');
      }

    } catch (error) {
      console.error('[WhatsApp Agent] Error procesando mensaje de voz:', error);
      
      // Respuesta de fallback
      return {
        message: 'Disculpe, no pude procesar su solicitud correctamente. ¿Podría repetir o contactar directamente con el consultorio?',
        followUpQuestions: [],
        suggestedActions: ['contact_office'],
        requiresHumanIntervention: true,
        mcpToolsUsed: [],
        confidence: 0.1
      };
    }
  }

  /**
   * Extrae datos de paciente desde transcript
   */
  extractPatientDataFromVoice(transcript: string): Partial<PatientData> {
    const patientData: Partial<PatientData> = {};

    // Patrones para extraer información básica
    const patterns = {
      name: /(?:me llamo|soy|mi nombre es)\s+([a-záéíóúñ\s]+)/i,
      document: /(?:cedula|documento|identificación|id)\s*:?\s*(\d+)/i,
      phone: /(?:teléfono|celular|número)\s*:?\s*([\d\s\-\+]+)/i,
      email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      birthDate: /(?:nací|nacimiento|fecha de nacimiento|cumpleaños)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      specialty: /(?:especialidad|doctor|médico|consulta)\s+([a-záéíóúñ\s]+)/i,
      appointmentDate: /(?:cita|consulta|turno)\s+(?:para|el|día)?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+de\s+[a-z]+)/i
    };

    // Extraer datos usando patrones
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        
        switch (key) {
          case 'name':
            // Limpiar y capitalizar nombre
            patientData.name = value.replace(/\s+/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
            break;
          
          case 'document':
            // Solo números
            patientData.document = value.replace(/\D/g, '');
            break;
          
          case 'phone':
            // Limpiar número de teléfono
            patientData.phone = value.replace(/[^\d+]/g, '');
            break;
          
          case 'email':
            patientData.email = value.toLowerCase();
            break;
          
          default:
            (patientData as any)[key] = value;
        }
      }
    }

    // Inferir intent basado en palabras clave
    if (transcript.includes('cita') || transcript.includes('consulta') || transcript.includes('turno')) {
      patientData.specialty = this.inferSpecialtyFromTranscript(transcript);
    }

    return patientData;
  }

  /**
   * Infiere especialidad médica desde el transcript
   */
  private inferSpecialtyFromTranscript(transcript: string): string {
    const specialties = {
      'medicina general': ['general', 'médico general', 'medicina familiar'],
      'cardiología': ['corazón', 'cardiólogo', 'cardiología', 'presión'],
      'dermatología': ['piel', 'dermatólogo', 'dermatología', 'alergia'],
      'ginecología': ['ginecólogo', 'ginecología', 'mujer', 'embarazo'],
      'pediatría': ['niño', 'niña', 'pediatra', 'pediatría', 'bebé'],
      'traumatología': ['huesos', 'traumatólogo', 'fractura', 'lesión'],
      'oftalmología': ['ojos', 'oftalmólogo', 'vista', 'visión'],
      'odontología': ['dientes', 'dentista', 'odontólogo', 'muela'],
      'psicología': ['psicólogo', 'psicología', 'estrés', 'ansiedad'],
      'neurología': ['neurólogo', 'neurología', 'cabeza', 'mareos']
    };

    const lowerTranscript = transcript.toLowerCase();
    
    for (const [specialty, keywords] of Object.entries(specialties)) {
      if (keywords.some(keyword => lowerTranscript.includes(keyword))) {
        return specialty;
      }
    }

    return 'medicina general'; // Por defecto
  }

  /**
   * Determina el intent principal del mensaje de voz
   */
  determineVoiceIntent(transcript: string): string {
    const intents = {
      'appointment_request': ['cita', 'consulta', 'turno', 'agendar', 'reservar'],
      'patient_registration': ['registrar', 'nuevo paciente', 'primera vez', 'inscribir'],
      'appointment_cancel': ['cancelar', 'anular', 'suspender cita'],
      'appointment_reschedule': ['cambiar cita', 'mover cita', 'reprogramar'],
      'information_request': ['información', 'horarios', 'precio', 'costos'],
      'emergency': ['urgencia', 'emergencia', 'grave', 'dolor fuerte'],
      'greeting': ['hola', 'buenos días', 'buenas tardes', 'buenas noches'],
      'complaint': ['queja', 'reclamo', 'problema', 'mala atención']
    };

    const lowerTranscript = transcript.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerTranscript.includes(keyword))) {
        return intent;
      }
    }

    return 'general_inquiry';
  }

  /**
   * Adapta respuesta del agente para contexto de voz
   */
  adaptResponseForVoice(response: WhatsAppAgentResponse): WhatsAppAgentResponse {
    // Simplificar mensaje para voz (evitar URLs, emojis, etc.)
    let voiceMessage = response.message
      .replace(/https?:\/\/[^\s]+/g, 'sitio web del consultorio')
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/\*([^*]+)\*/g, '$1') // Remover markdown
      .replace(/\n\n+/g, '. ') // Convertir saltos de línea en pausas
      .trim();

    // Asegurar que no sea muy largo para TTS
    if (voiceMessage.length > 500) {
      voiceMessage = voiceMessage.substring(0, 450) + '... Para más información puede contactar directamente con el consultorio.';
    }

    return {
      ...response,
      message: voiceMessage
    };
  }

  /**
   * Valida configuración del servicio
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      const response = await axios({
        method: 'get',
        url: `${this.backendBaseUrl}/health`,
        headers: {
          'Authorization': `Bearer ${this.backendToken}`
        },
        timeout: 10000
      });

      console.log('[WhatsApp Agent] Configuración válida');
      return response.status === 200;

    } catch (error: any) {
      console.error('[WhatsApp Agent] Error validando configuración:', error.message);
      return false;
    }
  }
}