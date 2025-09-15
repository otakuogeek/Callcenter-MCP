import { ParsedMessage } from './MessageParser';

export interface ResponseContext {
  patientName?: string;
  patientId?: number;
  sessionId: string;
  conversationHistory: string[];
  lastMCPResponse?: any;
  currentIntent?: string;
  requiresFollowUp?: boolean;
}

export interface GeneratedResponse {
  message: string;
  followUpQuestions?: string[];
  suggestedActions?: string[];
  requiresHumanIntervention?: boolean;
  requiresFollowUp?: boolean;
  mcpToolsUsed?: string[];
  confidence: number;
}

export class ResponseGenerator {
  private static readonly EMERGENCY_RESPONSES = {
    high: "🚨 **EMERGENCIA MÉDICA DETECTADA** 🚨\n\nSu situación requiere atención médica inmediata. Por favor:\n\n1. **Llame al 123** (línea de emergencias)\n2. **Diríjase al hospital más cercano**\n3. Si no puede moverse, pida a alguien que llame una ambulancia\n\nMientras tanto, manténgase en un lugar seguro y evite movimientos bruscos.",
    
    medium: "⚠️ Su situación requiere atención médica urgente. Le recomiendo:\n\n1. Contactar a su médico de cabecera inmediatamente\n2. Si no está disponible, dirigirse al servicio de urgencias\n3. Manténgase hidratado y en reposo\n\n¿Puede proporcionarme más detalles sobre sus síntomas?",
    
    low: "Entiendo su preocupación. Basándome en la información que me proporciona, le sugiero:\n\n1. Agendar una cita médica en las próximas 24-48 horas\n2. Monitorear sus síntomas\n3. Mantener reposo y hidratación\n\n¿Le gustaría que le ayude a agendar una cita?"
  };

  private static readonly GREETING_RESPONSES = [
    "¡Hola! Bienvenido/a a BiosanarCall 🏥\n\nSoy su asistente médico virtual y estoy aquí para ayudarle con:\n\n• Agendar citas médicas\n• Consultas sobre síntomas\n• Información de especialistas\n• Emergencias médicas\n\n¿En qué puedo asistirle hoy?",
    
    "¡Buenos días! 😊\n\nSoy el asistente virtual de BiosanarCall. Estoy disponible 24/7 para ayudarle con sus necesidades médicas.\n\n¿Cómo puedo ayudarle hoy?",
    
    "¡Saludos! 👋\n\nGracias por contactar a BiosanarCall. Estoy aquí para brindarle asistencia médica profesional.\n\n¿Qué necesita consultar?"
  ];

  private static readonly GOODBYE_RESPONSES = [
    "¡Que tenga un excelente día! 😊\n\nRecuerde que estamos disponibles 24/7 para cualquier consulta médica.\n\n🏥 BiosanarCall - Su salud es nuestra prioridad",
    
    "¡Hasta pronto! 👋\n\nEspero haber podido ayudarle. No dude en contactarnos cuando lo necesite.\n\nCuídese mucho! 💙",
    
    "¡Muchas gracias por usar BiosanarCall! 🙏\n\nEstaremos aquí cuando nos necesite. ¡Que se mejore pronto!"
  ];

  public static generateResponse(
    parsedMessage: ParsedMessage,
    context: ResponseContext,
    mcpResponse?: any
  ): GeneratedResponse {
    
    switch (parsedMessage.intent) {
      case 'handle_emergency':
        return this.generateEmergencyResponse(parsedMessage, context);
      
      case 'welcome_patient':
        return this.generateGreetingResponse(context);
      
      case 'farewell_patient':
        return this.generateGoodbyeResponse(context);
      
      case 'schedule_appointment':
        return this.generateAppointmentResponse(parsedMessage, context, mcpResponse);
      
      case 'patient_registration':
        return this.generatePatientRegistrationResponse(parsedMessage, context, mcpResponse);
      
      case 'cancel_appointment':
        return this.generateCancelAppointmentResponse(parsedMessage, context, mcpResponse);
      
      case 'symptom_consultation':
        return this.generateSymptomConsultationResponse(parsedMessage, context, mcpResponse);
      
      case 'general_medical_query':
        return this.generateMedicalQueryResponse(parsedMessage, context, mcpResponse);
      
      default:
        return this.generateGeneralResponse(parsedMessage, context, mcpResponse);
    }
  }

  private static generateEmergencyResponse(
    parsedMessage: ParsedMessage,
    context: ResponseContext
  ): GeneratedResponse {
    const urgency = parsedMessage.entities.urgency || 'medium';
    
    let message = '';
    if (urgency === 'emergency' || urgency === 'high') {
      message = this.EMERGENCY_RESPONSES.high;
    } else if (urgency === 'medium') {
      message = this.EMERGENCY_RESPONSES.medium;
    } else {
      message = this.EMERGENCY_RESPONSES.low;
    }

    return {
      message,
      requiresHumanIntervention: urgency === 'emergency' || urgency === 'high',
      suggestedActions: [
        'Llamar línea de emergencias 123',
        'Dirigirse al hospital más cercano',
        'Contactar médico de cabecera'
      ],
      confidence: 0.95
    };
  }

  private static generateGreetingResponse(context: ResponseContext): GeneratedResponse {
    const randomIndex = Math.floor(Math.random() * this.GREETING_RESPONSES.length);
    const baseMessage = this.GREETING_RESPONSES[randomIndex];
    
    let personalizedMessage = baseMessage;
    if (context.patientName) {
      personalizedMessage = baseMessage.replace('Bienvenido/a', `Bienvenido/a ${context.patientName}`);
    }

    return {
      message: personalizedMessage,
      followUpQuestions: [
        '¿Necesita agendar una cita médica?',
        '¿Tiene alguna consulta sobre síntomas?',
        '¿Requiere información sobre nuestros especialistas?'
      ],
      confidence: 0.9
    };
  }

  private static generateGoodbyeResponse(context: ResponseContext): GeneratedResponse {
    const randomIndex = Math.floor(Math.random() * this.GOODBYE_RESPONSES.length);
    let message = this.GOODBYE_RESPONSES[randomIndex];
    
    if (context.patientName) {
      message = message.replace('¡Que tenga', `¡Que tenga ${context.patientName}`);
    }

    return {
      message,
      confidence: 0.9
    };
  }

  private static generateAppointmentResponse(
    parsedMessage: ParsedMessage,
    context: ResponseContext,
    mcpResponse?: any
  ): GeneratedResponse {
    let message = '';
    let followUpQuestions: string[] = [];
    let suggestedActions: string[] = [];
    let mcpToolsUsed: string[] = [];

    if (mcpResponse && mcpResponse.success) {
      // Respuesta exitosa del MCP
      message = "✅ **Cita agendada exitosamente**\n\n";
      
      if (mcpResponse.data) {
        const appointment = mcpResponse.data;
        message += `📅 **Fecha:** ${appointment.fecha || 'Por confirmar'}\n`;
        message += `🕐 **Hora:** ${appointment.hora || 'Por confirmar'}\n`;
        message += `👨‍⚕️ **Doctor:** ${appointment.doctor || 'Por asignar'}\n`;
        message += `🏥 **Especialidad:** ${appointment.especialidad || 'Por asignar'}\n\n`;
        message += "Recibirá un mensaje de confirmación 24 horas antes de su cita.";
      }
      
      mcpToolsUsed = ['agendar_cita', 'buscar_disponibilidad'];
      
    } else {
      // Necesita más información
      message = "📋 **Agendamiento de Cita Médica**\n\n";
      message += "Para agendar su cita, necesito la siguiente información:\n\n";
      
      if (!parsedMessage.entities.patientName && !context.patientName) {
        message += "👤 Su nombre completo\n";
        followUpQuestions.push("¿Cuál es su nombre completo?");
      }
      
      if (!parsedMessage.entities.documentNumber) {
        message += "🆔 Número de documento de identidad\n";
        followUpQuestions.push("¿Cuál es su número de cédula?");
      }
      
      if (!parsedMessage.entities.doctorSpecialty) {
        message += "🩺 Especialidad médica requerida\n";
        followUpQuestions.push("¿Qué especialidad médica necesita?");
      }
      
      if (!parsedMessage.entities.datetime) {
        message += "📅 Fecha y hora preferida\n";
        followUpQuestions.push("¿Qué fecha y hora prefiere para su cita?");
      }
      
      suggestedActions = [
        'Proporcionar información personal',
        'Consultar disponibilidad de doctores',
        'Seleccionar fecha y hora'
      ];
    }

    return {
      message,
      followUpQuestions,
      suggestedActions,
      mcpToolsUsed,
      requiresFollowUp: !mcpResponse?.success,
      confidence: 0.85
    };
  }

  private static generatePatientRegistrationResponse(
    parsedMessage: ParsedMessage,
    context: ResponseContext,
    mcpResponse?: any
  ): GeneratedResponse {
    let message = '';
    let followUpQuestions: string[] = [];
    let suggestedActions: string[] = [];
    let mcpToolsUsed: string[] = [];

    if (mcpResponse && mcpResponse.success) {
      // Registro exitoso
      message = "✅ **¡Registro Completado!**\n\n";
      message += `¡Perfecto! Ya estás registrado en nuestro sistema.\n\n`;
      message += "📋 **Información registrada:**\n";
      message += `• **Nombre:** ${mcpResponse.data?.name || 'Registrado'}\n`;
      message += `• **Documento:** ${mcpResponse.data?.document || 'Registrado'}\n\n`;
      message += "✨ Ahora puedes:\n";
      message += "• Agendar citas médicas\n";
      message += "• Consultar tus citas\n";
      message += "• Hacer consultas médicas\n\n";
      message += "¿Te gustaría agendar una cita ahora? 📅";
      
      suggestedActions = [
        'Agendar cita médica',
        'Consultar especialidades disponibles',
        'Información de sedes'
      ];
      
      mcpToolsUsed = ['createSimplePatient'];
      
    } else {
      // Necesita información para registro
      message = "📝 **Registro de Nuevo Paciente**\n\n";
      message += "¡Excelente! Te ayudo a registrarte en nuestro sistema.\n\n";
      message += "Para registrarte, solo necesito 2 datos básicos:\n\n";
      
      const needsName = !parsedMessage.entities.patientName && !context.patientName;
      const needsDocument = !parsedMessage.entities.documentNumber;
      
      if (needsName) {
        message += "👤 **Tu nombre completo**\n";
        followUpQuestions.push("¿Cuál es tu nombre completo?");
      }
      
      if (needsDocument) {
        message += "🆔 **Tu número de documento**\n";
        followUpQuestions.push("¿Cuál es tu número de cédula?");
      }
      
      if (!needsName && !needsDocument) {
        // Tenemos todos los datos, deberíamos haber llamado createSimplePatient
        message += "⏳ Procesando tu registro...\n\n";
        message += "Un momento por favor mientras confirmo tu información en el sistema.";
      }
      
      if (followUpQuestions.length === 0) {
        suggestedActions = ['Confirmar registro'];
      }
    }

    return {
      message,
      followUpQuestions,
      suggestedActions,
      mcpToolsUsed,
      requiresFollowUp: !mcpResponse?.success && followUpQuestions.length > 0,
      confidence: 0.90
    };
  }

  private static generateCancelAppointmentResponse(
    parsedMessage: ParsedMessage,
    context: ResponseContext,
    mcpResponse?: any
  ): GeneratedResponse {
    let message = '';
    let mcpToolsUsed: string[] = [];

    if (mcpResponse && mcpResponse.success) {
      message = "✅ **Cita cancelada exitosamente**\n\n";
      message += "Su cita médica ha sido cancelada. ";
      message += "Si necesita reagendar, estaré encantado de ayudarle.\n\n";
      message += "¿Le gustaría agendar una nueva cita?";
      
      mcpToolsUsed = ['cancelar_cita'];
    } else {
      message = "📋 **Cancelación de Cita**\n\n";
      message += "Para cancelar su cita, necesito:\n\n";
      message += "🆔 Su número de documento\n";
      message += "📅 Fecha de la cita a cancelar\n\n";
      message += "¿Puede proporcionarme esta información?";
    }

    return {
      message,
      mcpToolsUsed,
      followUpQuestions: mcpResponse?.success ? ['¿Desea agendar una nueva cita?'] : [
        '¿Cuál es su número de cédula?',
        '¿Cuál es la fecha de la cita a cancelar?'
      ],
      confidence: 0.8
    };
  }

  private static generateSymptomConsultationResponse(
    parsedMessage: ParsedMessage,
    context: ResponseContext,
    mcpResponse?: any
  ): GeneratedResponse {
    const symptoms = parsedMessage.entities.symptoms || [];
    const urgency = parsedMessage.entities.urgency || 'medium';
    
    let message = "🩺 **Consulta Médica Virtual**\n\n";
    
    if (symptoms.length > 0) {
      message += `He registrado los siguientes síntomas: ${symptoms.join(', ')}\n\n`;
    }
    
    if (mcpResponse && mcpResponse.data) {
      // Usar respuesta del MCP si está disponible
      message += mcpResponse.data.recommendation || '';
    } else {
      // Respuesta basada en urgencia
      if (urgency === 'high' || urgency === 'emergency') {
        message += "⚠️ Sus síntomas requieren atención médica prioritaria.\n\n";
        message += "**Recomendaciones inmediatas:**\n";
        message += "• Busque atención médica urgente\n";
        message += "• No espere que los síntomas empeoren\n";
        message += "• Manténgase hidratado\n\n";
      } else {
        message += "Basándome en los síntomas que describe, le sugiero:\n\n";
        message += "• Agendar una consulta médica\n";
        message += "• Monitorear la evolución de los síntomas\n";
        message += "• Mantener reposo e hidratación\n\n";
      }
    }
    
    message += "¿Hay algún otro síntoma que deba conocer?";

    return {
      message,
      followUpQuestions: [
        '¿Cuánto tiempo lleva con estos síntomas?',
        '¿Ha tomado algún medicamento?',
        '¿Tiene alergias conocidas?',
        '¿Le gustaría agendar una cita médica?'
      ],
      suggestedActions: [
        'Agendar cita médica',
        'Consultar especialista',
        'Monitorear síntomas'
      ],
      mcpToolsUsed: mcpResponse ? ['consulta_sintomas', 'recomendacion_medica'] : [],
      confidence: 0.75
    };
  }

  private static generateMedicalQueryResponse(
    parsedMessage: ParsedMessage,
    context: ResponseContext,
    mcpResponse?: any
  ): GeneratedResponse {
    let message = "🏥 **Información Médica**\n\n";
    
    if (mcpResponse && mcpResponse.data) {
      message += mcpResponse.data.information || mcpResponse.data.answer || '';
    } else {
      message += "He recibido su consulta médica. ";
      message += "Para brindarle la mejor información posible, ";
      message += "puedo consultar nuestra base de datos médica.\n\n";
      message += "¿Podría ser más específico sobre su consulta?";
    }

    return {
      message,
      followUpQuestions: [
        '¿Necesita información sobre algún tratamiento específico?',
        '¿Requiere datos sobre especialistas?',
        '¿Le gustaría agendar una consulta?'
      ],
      mcpToolsUsed: mcpResponse ? ['consulta_medica', 'buscar_informacion'] : [],
      confidence: 0.7
    };
  }

  private static generateGeneralResponse(
    parsedMessage: ParsedMessage,
    context: ResponseContext,
    mcpResponse?: any
  ): GeneratedResponse {
    let message = "Gracias por contactar a BiosanarCall. ";
    
    if (mcpResponse && mcpResponse.data) {
      message += mcpResponse.data.response || '';
    } else {
      message += "Estoy aquí para ayudarle con:\n\n";
      message += "🏥 Información médica\n";
      message += "📅 Agendamiento de citas\n";
      message += "🩺 Consultas sobre síntomas\n";
      message += "👨‍⚕️ Información de especialistas\n\n";
      message += "¿En qué puedo asistirle específicamente?";
    }

    return {
      message,
      followUpQuestions: [
        '¿Necesita agendar una cita?',
        '¿Tiene alguna consulta médica?',
        '¿Requiere información sobre nuestros servicios?'
      ],
      confidence: 0.6
    };
  }

  public static addPersonalization(
    response: GeneratedResponse,
    context: ResponseContext
  ): GeneratedResponse {
    let personalizedMessage = response.message;
    
    // Agregar nombre del paciente si está disponible
    if (context.patientName) {
      // Buscar lugares donde agregar el nombre
      if (!personalizedMessage.includes(context.patientName)) {
        personalizedMessage = personalizedMessage.replace(
          /Su /g, 
          `${context.patientName}, su `
        );
      }
    }
    
    // Agregar contexto de conversación si es relevante
    if (context.conversationHistory.length > 0 && context.currentIntent) {
      // Agregar referencias a conversaciones anteriores si es apropiado
      if (context.currentIntent === 'schedule_appointment' && 
          context.conversationHistory.some(msg => msg.includes('síntomas'))) {
        personalizedMessage += "\n\n💡 *Veo que antes mencionó algunos síntomas. ¿Le gustaría que la cita sea prioritaria?*";
      }
    }

    return {
      ...response,
      message: personalizedMessage
    };
  }

  public static formatForWhatsApp(response: GeneratedResponse): string {
    let formatted = response.message;
    
    // Agregar preguntas de seguimiento si existen
    if (response.followUpQuestions && response.followUpQuestions.length > 0) {
      formatted += "\n\n❓ **Preguntas adicionales:**\n";
      response.followUpQuestions.forEach((question, index) => {
        formatted += `${index + 1}. ${question}\n`;
      });
    }
    
    // Agregar acciones sugeridas si existen
    if (response.suggestedActions && response.suggestedActions.length > 0) {
      formatted += "\n\n✅ **Acciones sugeridas:**\n";
      response.suggestedActions.forEach((action, index) => {
        formatted += `• ${action}\n`;
      });
    }
    
    // Agregar firma al final
    formatted += "\n\n---\n🏥 *BiosanarCall - Asistencia médica 24/7*";
    
    return formatted;
  }
}