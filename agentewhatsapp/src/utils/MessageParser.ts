export interface ParsedMessage {
  type: 'text' | 'appointment' | 'emergency' | 'query' | 'greeting' | 'goodbye';
  content: string;
  intent: string;
  entities: {
    patientName?: string;
    symptoms?: string[];
    urgency?: 'low' | 'medium' | 'high' | 'emergency';
    datetime?: string;
    doctorSpecialty?: string;
    medication?: string;
    allergies?: string[];
    phoneNumber?: string;
    documentNumber?: string;
  };
  confidence: number;
  requiresPatientInfo: boolean;
  requiresMedicalAction: boolean;
}

export class MessageParser {
  private static readonly EMERGENCY_KEYWORDS = [
    'emergencia', 'urgente', 'dolor intenso', 'sangrado', 'dificultad respirar',
    'pecho dolor', 'infarto', 'accidente', 'inconsciente', 'convulsiones',
    'alergia severa', 'shock', 'trauma', 'fractura', 'quemadura grave'
  ];

  private static readonly APPOINTMENT_KEYWORDS = [
    'cita', 'consulta', 'agendar', 'reservar', 'turno', 'hora',
    'doctor', 'médico', 'especialista', 'control', 'chequeo',
    'fecha', 'horario', 'disponibilidad', 'cancelar cita'
  ];

  private static readonly GREETING_KEYWORDS = [
    'hola', 'buenos días', 'buenas tardes', 'buenas noches',
    'saludos', 'qué tal', 'cómo está', 'ayuda', 'información'
  ];

  private static readonly GOODBYE_KEYWORDS = [
    'gracias', 'adiós', 'hasta luego', 'chao', 'bye',
    'nos vemos', 'que tenga buen día', 'muchas gracias'
  ];

  private static readonly SYMPTOMS_KEYWORDS = [
    'dolor', 'fiebre', 'tos', 'gripe', 'malestar', 'náuseas',
    'vómito', 'diarrea', 'estreñimiento', 'mareo', 'fatiga',
    'insomnio', 'ansiedad', 'depresión', 'erupción', 'picazón',
    'hinchazón', 'palpitaciones', 'sudoración', 'escalofríos'
  ];

  private static readonly MEDICAL_SPECIALTIES = [
    'medicina general', 'cardiología', 'dermatología', 'ginecología',
    'pediatría', 'neurología', 'psiquiatría', 'traumatología',
    'oftalmología', 'otorrinolaringología', 'urología', 'endocrinología',
    'gastroenterología', 'neumología', 'oncología', 'reumatología'
  ];

  public static parse(message: string, phoneNumber?: string): ParsedMessage {
    const normalizedMessage = this.normalizeMessage(message);
    const tokens = this.tokenize(normalizedMessage);
    
    // Determinar tipo de mensaje
    const type = this.determineMessageType(normalizedMessage, tokens);
    
    // Extraer entidades
    const entities = this.extractEntities(normalizedMessage, tokens);
    
    // Determinar intención
    const intent = this.determineIntent(type, entities, normalizedMessage);
    
    // Calcular confianza
    const confidence = this.calculateConfidence(type, entities, tokens);
    
    // Determinar si requiere información del paciente o acción médica
    const requiresPatientInfo = this.requiresPatientInfo(type, intent);
    const requiresMedicalAction = this.requiresMedicalAction(type, intent);

    return {
      type,
      content: message.trim(),
      intent,
      entities,
      confidence,
      requiresPatientInfo,
      requiresMedicalAction
    };
  }

  private static normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^\w\s]/g, ' ') // Quitar puntuación
      .replace(/\s+/g, ' '); // Normalizar espacios
  }

  private static tokenize(message: string): string[] {
    return message.split(' ').filter(token => token.length > 2);
  }

  private static determineMessageType(
    normalizedMessage: string, 
    tokens: string[]
  ): ParsedMessage['type'] {
    // Verificar emergencia primero
    if (this.containsKeywords(normalizedMessage, this.EMERGENCY_KEYWORDS)) {
      return 'emergency';
    }

    // Verificar citas
    if (this.containsKeywords(normalizedMessage, this.APPOINTMENT_KEYWORDS)) {
      return 'appointment';
    }

    // Verificar saludos
    if (this.containsKeywords(normalizedMessage, this.GREETING_KEYWORDS)) {
      return 'greeting';
    }

    // Verificar despedidas
    if (this.containsKeywords(normalizedMessage, this.GOODBYE_KEYWORDS)) {
      return 'goodbye';
    }

    // Verificar consulta médica
    if (this.containsKeywords(normalizedMessage, this.SYMPTOMS_KEYWORDS) ||
        normalizedMessage.includes('consulta') ||
        normalizedMessage.includes('pregunta')) {
      return 'query';
    }

    return 'text';
  }

  private static extractEntities(normalizedMessage: string, tokens: string[]): ParsedMessage['entities'] {
    const entities: ParsedMessage['entities'] = {};

    // Extraer síntomas
    const symptoms = this.extractSymptoms(normalizedMessage);
    if (symptoms.length > 0) {
      entities.symptoms = symptoms;
    }

    // Extraer urgencia
    entities.urgency = this.extractUrgency(normalizedMessage);

    // Extraer especialidad médica
    const specialty = this.extractSpecialty(normalizedMessage);
    if (specialty) {
      entities.doctorSpecialty = specialty;
    }

    // Extraer información temporal
    const datetime = this.extractDateTime(normalizedMessage);
    if (datetime) {
      entities.datetime = datetime;
    }

    // Extraer número de documento
    const docNumber = this.extractDocumentNumber(normalizedMessage);
    if (docNumber) {
      entities.documentNumber = docNumber;
    }

    // Extraer nombre del paciente
    const patientName = this.extractPatientName(normalizedMessage);
    if (patientName) {
      entities.patientName = patientName;
    }

    return entities;
  }

  private static extractSymptoms(message: string): string[] {
    const symptoms: string[] = [];
    
    this.SYMPTOMS_KEYWORDS.forEach(symptom => {
      if (message.includes(symptom)) {
        symptoms.push(symptom);
      }
    });

    return symptoms;
  }

  private static extractUrgency(message: string): ParsedMessage['entities']['urgency'] {
    if (this.containsKeywords(message, this.EMERGENCY_KEYWORDS)) {
      return 'emergency';
    }
    
    if (message.includes('urgente') || message.includes('rapido') || message.includes('pronto')) {
      return 'high';
    }
    
    if (message.includes('dolor intenso') || message.includes('mucho dolor')) {
      return 'high';
    }
    
    if (message.includes('leve') || message.includes('poco') || message.includes('ocasional')) {
      return 'low';
    }

    return 'medium';
  }

  private static extractSpecialty(message: string): string | undefined {
    for (const specialty of this.MEDICAL_SPECIALTIES) {
      if (message.includes(specialty) || message.includes(specialty.split(' ')[0])) {
        return specialty;
      }
    }
    return undefined;
  }

  private static extractDateTime(message: string): string | undefined {
    // Expresiones regulares para fechas y horas
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
      /(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/,
      /(hoy|mañana|pasado mañana)/,
      /(\d{1,2}):(\d{2})/,
      /(mañana|tarde|noche)/
    ];

    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  private static extractDocumentNumber(message: string): string | undefined {
    // Buscar patrones de cédula colombiana
    const patterns = [
      /\b(\d{6,10})\b/,
      /cedula\s*:?\s*(\d+)/,
      /documento\s*:?\s*(\d+)/,
      /cc\s*:?\s*(\d+)/
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  private static extractPatientName(message: string): string | undefined {
    // Buscar patrones de nombres
    const patterns = [
      /mi nombre es ([a-zA-Z\s]+)/,
      /soy ([a-zA-Z\s]+)/,
      /me llamo ([a-zA-Z\s]+)/,
      /nombre\s*:?\s*([a-zA-Z\s]+)/
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private static determineIntent(
    type: ParsedMessage['type'],
    entities: ParsedMessage['entities'],
    message: string
  ): string {
    switch (type) {
      case 'emergency':
        return 'handle_emergency';
      case 'appointment':
        if (message.includes('cancelar')) return 'cancel_appointment';
        if (message.includes('reagendar')) return 'reschedule_appointment';
        return 'schedule_appointment';
      case 'query':
        if (entities.symptoms && entities.symptoms.length > 0) {
          return 'symptom_consultation';
        }
        return 'general_medical_query';
      case 'greeting':
        return 'welcome_patient';
      case 'goodbye':
        return 'farewell_patient';
      default:
        return 'general_assistance';
    }
  }

  private static calculateConfidence(
    type: ParsedMessage['type'],
    entities: ParsedMessage['entities'],
    tokens: string[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Aumentar confianza basada en el tipo
    if (type === 'emergency') confidence += 0.3;
    if (type === 'appointment') confidence += 0.2;
    if (type === 'query') confidence += 0.1;

    // Aumentar confianza basada en entidades encontradas
    if (entities.symptoms && entities.symptoms.length > 0) confidence += 0.2;
    if (entities.urgency) confidence += 0.1;
    if (entities.doctorSpecialty) confidence += 0.1;
    if (entities.datetime) confidence += 0.1;

    // Limitar a rango 0-1
    return Math.min(confidence, 1.0);
  }

  private static requiresPatientInfo(type: ParsedMessage['type'], intent: string): boolean {
    return ['appointment', 'query', 'emergency'].includes(type) ||
           ['schedule_appointment', 'symptom_consultation', 'handle_emergency'].includes(intent);
  }

  private static requiresMedicalAction(type: ParsedMessage['type'], intent: string): boolean {
    return ['emergency', 'appointment'].includes(type) ||
           ['handle_emergency', 'schedule_appointment', 'symptom_consultation'].includes(intent);
  }

  private static containsKeywords(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword));
  }
}