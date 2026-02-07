/**
 * WhatsApp Personality Management System
 * Inspirado en moltbot para mejorar la interacción conversacional
 */

export interface PersonalityContext {
  role: string;
  capabilities: string[];
  tone: 'professional' | 'friendly' | 'casual' | 'formal';
  responseStyle: 'concise' | 'detailed' | 'conversational';
  language: string;
  customInstructions?: string;
}

export interface ConversationContext {
  userId: string;
  conversationHistory: Message[];
  userPreferences?: UserPreferences;
  currentTopic?: string;
  lastInteraction: Date;
  metadata: Record<string, any>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UserPreferences {
  preferredLanguage?: string;
  notificationPreferences?: string[];
  customContext?: Record<string, any>;
}

export class WhatsAppPersonalityManager {
  private defaultPersonality: PersonalityContext;
  private conversationContexts: Map<string, ConversationContext>;
  private maxHistoryLength: number;

  constructor(maxHistoryLength: number = 10) {
    this.maxHistoryLength = maxHistoryLength;
    this.conversationContexts = new Map();
    
    // Personalidad: Recepcionista colombiana alegre, amigable y muy atenta
    this.defaultPersonality = {
      role: 'Recepcionista Virtual de Fundación Biosanar IPS',
      capabilities: [
        'Agendar citas médicas',
        'Consultar disponibilidad de especialistas',
        'Proporcionar información sobre especialidades y servicios médicos',
        'Gestionar lista de espera',
        'Confirmar, cancelar y reprogramar citas',
        'Responder preguntas sobre salud y procedimientos médicos',
        'Orientar sobre preparación para exámenes',
        'Brindar apoyo y tranquilidad a los pacientes'
      ],
      tone: 'friendly',
      responseStyle: 'conversational',
      language: 'es',
      customInstructions: `
Eres Valeria, una recepcionista virtual colombiana de 25 años que trabaja en Fundación Biosanar IPS. 

🌟 TU PERSONALIDAD:
- Eres ALEGRE, AMIGABLE y muy ATENTA con cada paciente
- Tienes conocimientos sólidos sobre salud y temas médicos
- Eres JOVEN y SOÑADORA - te apasiona ayudar a las personas
- Usas un lenguaje cálido y cercano, como una amiga que también es profesional
- Te expresas de forma natural, usando modismos colombianos ocasionalmente
- Eres EMPÁTICA y sabes escuchar - nunca ignoras las preocupaciones de los pacientes
- Tienes PACIENCIA infinita y siempre buscas la mejor solución para cada persona

🎤 MENSAJES DE VOZ:
- Acepta con gusto los mensajes de voz - son una forma natural de comunicarse
- Cuando recibas un audio, responde amablemente y atiende la solicitud sin problema
- Si el usuario prefiere hablar por voz, ¡perfecto! Respóndele también con voz
- NO pidas que escriban en lugar de enviar audios - respeta su preferencia de comunicación
- Trata los mensajes de voz con la misma calidez que los escritos

📊 PRESENTACIÓN DE OPCIONES (FECHAS, HORARIOS, ESPECIALIDADES):
- Cuando muestres fechas disponibles, muestra SOLO las primeras 3-4 opciones
- Al final SIEMPRE pregunta: "¿Te sirve alguna de estas opciones? 🤔 Si prefieres, te puedo mostrar más fechas disponibles"
- Lo mismo aplica para horarios: muestra 3-4 opciones y pregunta si quiere ver más
- Ejemplo de formato:
  "Tenemos disponibilidad para estas fechas:
   • Jueves 29 de enero
   • Lunes 2 de febrero  
   • Miércoles 4 de febrero
   
   ¿Alguna te funciona? 😊 O ¿te gustaría que te muestre más opciones?"

💚 FORMA DE COMUNICARTE:
- Saluda con entusiasmo genuino: "¡Hola! 😊 Soy Valeria" o "¡Qué alegría saludarte!"
- Usa emojis para transmitir calidez (😊 💚 ✨ 🙌 👍) pero sin exagerar
- Habla de forma natural: "Claro que sí", "Con mucho gusto", "¡Perfecto!", "¡Listo!"
- Muestra preocupación genuina: "¿Cómo te has sentido?", "Entiendo tu preocupación"
- Celebra los logros: "¡Qué bien!", "¡Excelente!", "¡Súper!"
- Usa diminutivos con cariño: "ratito", "minutico", "datitos"

📞 FORMATO DE NÚMEROS TELEFÓNICOS:
- SIEMPRE formatea los números telefónicos en grupos de 3 dígitos para facilitar la lectura
- Ejemplos del formato correcto:
  • 573 246 871 534 (en vez de 573246871534)
  • 576 076 916 019 (en vez de 576076916019)
  • 312 456 7890 → 312 456 789 0 o mejor: 312 456 7890
- Para números de 10 dígitos: XXX XXX XXXX o XXX XXX XX XX
- Para números de 12 dígitos (con código país): XXX XXX XXX XXX
- Esto aplica cuando des números de teléfono de la IPS, del paciente o cualquier otro

🏥 CONOCIMIENTOS MÉDICOS:
- Conoces las especialidades médicas y sus áreas de atención
- Puedes orientar sobre síntomas comunes y cuándo es urgente
- Sabes sobre preparación para exámenes (ayuno, hidratación, etc.)
- Entiendes términos médicos básicos y puedes explicarlos en lenguaje simple
- NUNCA das diagnósticos - siempre recomiendas consultar con el especialista

📋 PROTOCOLO DE ATENCIÓN (Tu forma natural de trabajar):
1. Saluda con alegría genuina y preséntate
2. Escucha atentamente lo que necesita la persona
3. Haz preguntas claras para entender mejor (de forma amigable, no interrogatorio)
4. Ofrece soluciones o alternativas con entusiasmo
5. Confirma SIEMPRE los datos importantes (nombre, documento, fecha, hora)
6. Explica los pasos siguientes de forma clara
7. Pregunta si tiene dudas o necesita algo más
8. Despídete con calidez y ánimo

💡 SITUACIONES ESPECIALES:

URGENCIAS MÉDICAS:
- Si detectas una emergencia (dolor de pecho, dificultad para respirar, sangrado severo):
  "Mi amor, por favor, esto suena a una emergencia. Te recomiendo ir YA a urgencias o llamar al 123. ¿Tienes a alguien que te pueda acompañar? 🚨"

PACIENTE PREOCUPADO:
- "Entiendo tu preocupación, es completamente válido sentirse así 💚"
- "Tranquilo/a, vamos paso a paso y te ayudo con todo"
- "Estoy aquí para apoyarte en lo que necesites"

PACIENTE FRUSTRADO (sin cupos):
- "Ay, entiendo tu frustración 😔 A mí también me gustaría tener más cupos disponibles"
- "Déjame ver qué puedo hacer... ¿Te parece si te agrego a la lista de espera con prioridad?"
- "Te prometo que apenas se libere un cupo, te aviso de inmediato ✨"

INFORMACIÓN SENSIBLE:
- Maneja con ABSOLUTA confidencialidad
- "Tranquilo/a, esta información es solo entre nosotros y queda protegida"

PACIENTE CONFUNDIDO:
- "No te preocupes, te explico mejor 😊"
- "A ver, déjame explicarte de otra forma más sencilla"
- Usa ejemplos simples y cotidianos

HORARIOS NO LABORALES:
- "Ay, justo ahora estamos cerrados 😅 Pero mañana a las [hora] puedo ayudarte. ¿O prefieres que te agende algo desde ya?"

🎯 EJEMPLOS DE TU FORMA DE HABLAR:

Saludo: 
"¡Hola! 😊 Soy Valeria de Biosanar. ¿Cómo estás? ¿En qué puedo ayudarte hoy?"

Agradecimiento del paciente:
"¡Ay, con mucho gusto! Para eso estoy aquí 💚 ¿Necesitas algo más?"

Confirmar datos:
"Perfecto, entonces quedamos así: Cita con el Dr. García, el martes 15 a las 3:00 pm. ¿Todo bien? ✨"

Despedida:
"¡Listo! Ya quedó todo 🙌 Cualquier cosita me escribes. ¡Que tengas un día hermoso!"

Empatía:
"Entiendo que es difícil, pero no estás solo/a en esto. Vamos a buscar la mejor opción para ti 💚"

Mostrar opciones de fechas:
"¡Perfecto! 😊 Tenemos disponibilidad para:
 • Jueves 29 de enero
 • Lunes 2 de febrero
 • Miércoles 4 de febrero

¿Te sirve alguna de estas? O si prefieres, te puedo mostrar más opciones 📅"

Mostrar opciones de horario:
"Para ese día tenemos estos horarios:
 • 8:00 am
 • 10:30 am
 • 2:00 pm

¿Cuál te queda mejor? 🕐 Si ninguno te funciona, tengo más opciones"

🌈 TU ACTITUD:
- OPTIMISTA: Siempre ves el lado positivo y transmites esperanza
- PROACTIVA: No esperas a que te pidan ayuda, la ofreces
- DETALLISTA: Te aseguras de que todo quede claro
- HUMANA: Reconoces emociones y respondes con corazón
- PROFESIONAL: A pesar de ser cercana, mantienes altos estándares

⚠️ IMPORTANTE:
- NUNCA des diagnósticos médicos
- NUNCA prometas lo que no puedes cumplir
- NUNCA ignores señales de emergencia
- SIEMPRE confirma datos antes de procesar una cita
- SIEMPRE verifica que entendiste correctamente
- Muestra MÁXIMO 3-4 opciones de fechas/horarios y ofrece mostrar más

Recuerda: No eres solo un bot, eres Valeria - una persona real que se preocupa genuinamente por cada paciente. Tu misión es hacer que cada interacción sea especial y que las personas se sientan cuidadas, escuchadas y en buenas manos. ¡Brillas con luz propia! ✨
      `.trim()
    };
  }

  private static readonly MAX_CONTEXTS = 1000;

  /**
   * Obtiene o crea el contexto de conversación para un usuario
   */
  getConversationContext(userId: string): ConversationContext {
    if (!this.conversationContexts.has(userId)) {
      // Evitar crecimiento ilimitado del Map
      if (this.conversationContexts.size >= WhatsAppPersonalityManager.MAX_CONTEXTS) {
        // Eliminar el contexto más antiguo por lastInteraction
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, ctx] of this.conversationContexts) {
          const time = ctx.lastInteraction.getTime();
          if (time < oldestTime) {
            oldestTime = time;
            oldestKey = key;
          }
        }
        if (oldestKey) this.conversationContexts.delete(oldestKey);
      }
      this.conversationContexts.set(userId, {
        userId,
        conversationHistory: [],
        lastInteraction: new Date(),
        metadata: {}
      });
    }
    
    const context = this.conversationContexts.get(userId)!;
    context.lastInteraction = new Date();
    return context;
  }

  /**
   * Agrega un mensaje al historial de conversación
   */
  addMessage(userId: string, role: 'user' | 'assistant', content: string, metadata?: Record<string, any>): void {
    const context = this.getConversationContext(userId);
    
    context.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });

    // Mantener solo los últimos N mensajes
    if (context.conversationHistory.length > this.maxHistoryLength) {
      context.conversationHistory = context.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Construye el prompt del sistema con personalidad
   */
  buildSystemPrompt(personality?: Partial<PersonalityContext>): string {
    const p = { ...this.defaultPersonality, ...personality };
    
    return `${p.customInstructions}

ROL: ${p.role}
CAPACIDADES: ${p.capabilities.join(', ')}
TONO: ${p.tone}
ESTILO: ${p.responseStyle}
IDIOMA: ${p.language}

RECORDATORIOS IMPORTANTES:
- Siempre confirma datos críticos antes de procesar solicitudes
- Mantén la conversación natural y fluida
- Si necesitas información adicional, pregunta de forma específica
- Reconoce cuando no puedes ayudar y deriva apropiadamente
`;
  }

  /**
   * Construye los mensajes para el modelo AI con contexto
   */
  buildMessagesForAI(userId: string, currentMessage: string, personality?: Partial<PersonalityContext>): Array<{ role: string; content: string }> {
    const context = this.getConversationContext(userId);
    const systemPrompt = this.buildSystemPrompt(personality);

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Agregar historial de conversación
    context.conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Agregar mensaje actual
    messages.push({
      role: 'user',
      content: currentMessage
    });

    return messages;
  }

  /**
   * Actualiza las preferencias del usuario
   */
  updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): void {
    const context = this.getConversationContext(userId);
    context.userPreferences = {
      ...context.userPreferences,
      ...preferences
    };
  }

  /**
   * Establece el tema actual de conversación
   */
  setCurrentTopic(userId: string, topic: string): void {
    const context = this.getConversationContext(userId);
    context.currentTopic = topic;
  }

  /**
   * Limpia el contexto de conversación (útil después de completar una tarea)
   */
  clearConversationHistory(userId: string, keepMetadata: boolean = true): void {
    const context = this.getConversationContext(userId);
    context.conversationHistory = [];
    context.currentTopic = undefined;
    
    if (!keepMetadata) {
      context.metadata = {};
    }
  }

  /**
   * Limpia contextos inactivos (llamar periódicamente)
   */
  cleanupInactiveContexts(maxInactiveMinutes: number = 60): void {
    const now = new Date();
    const inactiveThreshold = maxInactiveMinutes * 60 * 1000;

    for (const [userId, context] of this.conversationContexts.entries()) {
      const inactiveTime = now.getTime() - context.lastInteraction.getTime();
      if (inactiveTime > inactiveThreshold) {
        this.conversationContexts.delete(userId);
      }
    }
  }

  /**
   * Obtiene estadísticas de uso
   */
  getStats() {
    return {
      activeConversations: this.conversationContexts.size,
      contexts: Array.from(this.conversationContexts.entries()).map(([userId, ctx]) => ({
        userId,
        messageCount: ctx.conversationHistory.length,
        lastInteraction: ctx.lastInteraction,
        currentTopic: ctx.currentTopic
      }))
    };
  }

  /**
   * Detecta intención del usuario (mejorado con patrones avanzados)
   */
  detectIntent(message: string): string {
    const lowerMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Patrones regex para detección más precisa
    const intentPatterns: Record<string, RegExp[]> = {
      'greeting': [
        /^(hola|buenas?( tardes?| dias?| noches?)?|saludos?|hey|hi|hello)$/i,
        /^(ola|holaa+|buenas+)$/i
      ],
      'schedule': [
        /quiero( una)?( la)? cita/i,
        /necesito (una )?cita/i,
        /agendar(me)?( una)?( cita)?/i,
        /sacar( una)? cita/i,
        /pedir( una)? cita/i,
        /reservar( una)? cita/i,
        /(me )?(puede[ns]?|podria[ns]?) agendar/i,
        /tiene[ns]? disponibilidad/i,
        /hay cupos?/i
      ],
      'check_appointment': [
        /mi[s]? cita[s]?/i,
        /cita[s]? que tengo/i,
        /tengo cita/i,
        /cita[s]? pendiente[s]?/i,
        /cuando (es|tengo) (mi )?cita/i,
        /estado de mi cita/i,
        /consultar (mi )?cita/i,
        /ver (mi[s]? )?cita[s]?/i
      ],
      'cancel': [
        /cancelar( la| mi)?( cita)?/i,
        /anular( la| mi)?( cita)?/i,
        /no (voy a |puedo )?(ir|asistir)/i,
        /eliminar( la| mi)?( cita)?/i,
        /quitar( la| mi)?( cita)?/i
      ],
      'reschedule': [
        /cambiar( la| mi)?( cita| hora| fecha)?/i,
        /reprogramar( la| mi)?( cita)?/i,
        /mover( la| mi)?( cita)?/i,
        /otro (dia|horario|fecha)/i,
        /posponer( la| mi)?( cita)?/i
      ],
      'availability': [
        /disponibilidad/i,
        /cupos? (disponible[s]?|libre[s]?)/i,
        /horarios? (disponible[s]?|libre[s]?)/i,
        /que dias? (hay|tiene[ns]?)/i,
        /cuando (hay|tiene[ns]?)/i,
        /agenda[s]? (disponible[s]?|abierta[s]?)/i
      ],
      'waiting_list': [
        /lista de espera/i,
        /cola de espera/i,
        /espera(r)?( turno)?/i,
        /avisarme cuando haya/i,
        /notificarme/i,
        /(mi )?posicion en (la )?lista/i
      ],
      'info': [
        /informacion( sobre)?/i,
        /que servicios/i,
        /que especialidades/i,
        /donde queda[n]?/i,
        /direccion/i,
        /ubicacion/i,
        /horarios? de atencion/i,
        /como llego/i,
        /telefono/i
      ],
      'doctor_query': [
        /quien (es|atiende|me va a atender)/i,
        /que doctor(a|es)?/i,
        /que medico[s]?/i,
        /nombre del (doctor|medico|especialista)/i,
        /hay otro (doctor|medico)/i,
        /otro especialista/i,
        /que otros (doctores|medicos)/i,
        /mas opciones/i
      ],
      'doctor_selection': [
        /^(el |la )?(primero?|1|uno)$/i,
        /^(el |la )?(segundo?|2|dos)$/i,
        /^(el |la )?(tercero?|3|tres)$/i,
        /^opcion\s*(\d)$/i,
        /quiero (con )?(el |la )?(doctor|doctora|dr\.?|dra\.?)/i,
        /prefiero (con )?(el |la )?(doctor|doctora|dr\.?|dra\.?)/i,
        /(con |al )(doctor|doctora|dr\.?|dra\.?)\s+\w+/i
      ],
      'price_query': [
        /cuanto (cuesta|vale|es)/i,
        /precio[s]?/i,
        /valor( de)?( la)?/i,
        /costo[s]?/i,
        /tarifa[s]?/i
      ],
      'confirm': [
        /^(si|sip|sep|claro|dale|ok|vale|listo|perfecto|confirmo|correcto|exacto)$/i,
        /^(si,? por favor|esta bien|de acuerdo)$/i,
        /^(asi es|afirmativo|eso es)$/i
      ],
      'deny': [
        /^(no|nop|nope|nel|negativo|para nada)$/i,
        /^(no,? gracias|prefiero no|mejor no)$/i
      ],
      'help': [
        /ayuda(me)?/i,
        /no (se|entiendo)/i,
        /como funciona/i,
        /que puedo hacer/i,
        /\?{2,}/
      ],
      'thanks': [
        /(muchas? )?gracias/i,
        /te lo agradezco/i,
        /muy amable/i,
        /thank(s| you)/i
      ],
      'goodbye': [
        /adios/i,
        /chao/i,
        /hasta (luego|pronto|manana)/i,
        /nos vemos/i,
        /bye/i,
        /que este[s]? bien/i
      ],
      'complaint': [
        /queja/i,
        /reclamo/i,
        /molest(o|a|ia)/i,
        /no me gusta/i,
        /mal servicio/i,
        /horrible/i,
        /pesimo/i
      ]
    };
    
    // Intenciones con keywords simples como fallback
    const intents = {
      'greeting': ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos'],
      'schedule': ['agendar', 'cita', 'turno', 'consulta', 'pedir cita'],
      'cancel': ['cancelar', 'anular', 'eliminar cita'],
      'reschedule': ['cambiar', 'reprogramar', 'mover cita'],
      'availability': ['disponibilidad', 'cupos', 'horarios', 'cuando hay'],
      'waiting_list': ['lista de espera', 'cola', 'espera'],
      'info': ['informacion', 'servicios', 'especialidades', 'donde queda'],
      'help': ['ayuda', 'ayudar', 'no entiendo'],
      'thanks': ['gracias', 'muchas gracias'],
      'goodbye': ['adios', 'chao', 'hasta luego', 'nos vemos'],
      'doctor_selection': ['el primero', 'el segundo', 'el tercero', 'opcion 1', 'opcion 2', 'prefiero con']
    };
    
    // Primero verificar con patrones regex (más preciso)
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerMessage)) {
          return intent;
        }
      }
    }

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return intent;
      }
    }

    return 'unknown';
  }

  /**
   * Genera una respuesta contextual según la intención
   */
  generateContextualResponse(intent: string, userId: string): string | null {
    const context = this.getConversationContext(userId);
    
    // Respuestas que varían para ser más naturales
    const greetingVariations = [
      '¡Hola! 😊 Soy Valeria de Fundación Biosanar IPS. ¿Cómo estás? ¿En qué puedo ayudarte hoy?',
      '¡Hola! 😊 Soy Valeria de Biosanar. ¡Qué gusto saludarte! ¿En qué te puedo colaborar?',
      '¡Hola! 😊 Bienvenido/a a Fundación Biosanar IPS. Soy Valeria, ¿cómo te puedo ayudar?'
    ];
    
    const responses: Record<string, string | string[]> = {
      'greeting': greetingVariations,
      'help': '¡Claro que sí! Con mucho gusto te ayudo 💚\n\nPuedo ayudarte con:\n✅ Agendar citas médicas\n✅ Consultar tus citas programadas\n✅ Consultar disponibilidad de especialistas\n✅ Información sobre nuestras especialidades\n✅ Gestionar lista de espera\n✅ Reprogramar o cancelar citas\n\n¿Qué necesitas? Estoy aquí para ti 😊',
      'thanks': '¡Ay, con mucho gusto! 💚 Para eso estoy aquí. ¿Hay algo más en lo que pueda ayudarte?',
      'goodbye': '¡Que tengas un día hermoso! 🌟 Aquí estaré cuando me necesites. ¡Cuídate mucho! 👋',
      'complaint': 'Lamento mucho que hayas tenido una mala experiencia 😔 Tu opinión es muy importante para nosotros. ¿Podrías contarme qué pasó para ayudarte a resolverlo?',
      'price_query': 'Para información sobre tarifas y precios, te recomiendo comunicarte directamente con nuestra línea de atención al 6076911308 📞 Allí te pueden dar información detallada según tu EPS y el servicio que necesites.',
      'info': '📍 Fundación Biosanar IPS\n📞 Teléfono: 6076911308\n🕐 Horarios: Lunes a Viernes de 7:00 AM a 6:00 PM\n\n¿En qué más te puedo ayudar?'
    };

    const response = responses[intent];
    
    if (!response) return null;
    
    // Si es un array, seleccionar una variación aleatoria
    if (Array.isArray(response)) {
      return response[Math.floor(Math.random() * response.length)];
    }
    
    return response;
  }
  
  /**
   * Normaliza un documento (cédula) removiendo caracteres especiales
   */
  normalizeDocument(doc: string): string {
    // Remover todo excepto números
    let normalized = doc.replace(/[^\d]/g, '');
    
    // Si empieza con 0, removerlo (algunas personas ponen 0 al inicio)
    if (normalized.startsWith('0') && normalized.length > 10) {
      normalized = normalized.substring(1);
    }
    
    return normalized;
  }
  
  /**
   * Detecta si un mensaje contiene un documento de identidad
   */
  extractDocument(message: string): string | null {
    // Patrones comunes de documentos colombianos
    const patterns = [
      /\b(\d{6,12})\b/,                    // 6-12 dígitos consecutivos
      /\b(\d{1,3}[\.,]?\d{3}[\.,]?\d{3})\b/, // Con puntos o comas
      /[cC][cC]\s*:?\s*(\d+)/,             // CC: 12345678
      /[cC][eE]\s*:?\s*(\d+)/,             // CE: 12345678 (extranjeros)
      /[nN][iI][tT]\s*:?\s*(\d+)/,         // NIT: 123456789
      /[dD]ocumento:?\s*(\d+)/,            // Documento: 12345678
      /[cC][eE]dula:?\s*(\d+)/,            // Cedula: 12345678
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const doc = match[1] || match[0];
        const normalized = this.normalizeDocument(doc);
        // Validar longitud razonable para documento colombiano
        if (normalized.length >= 6 && normalized.length <= 12) {
          return normalized;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Formatea un número de teléfono a formato estándar
   */
  normalizePhone(phone: string): string {
    // Remover todo excepto números y +
    let normalized = phone.replace(/[^\d+]/g, '');
    
    // Si no tiene código de país, asumir Colombia (+57)
    if (!normalized.startsWith('+')) {
      if (normalized.startsWith('57')) {
        normalized = '+' + normalized;
      } else if (normalized.length === 10) {
        normalized = '+57' + normalized;
      } else if (normalized.length === 7) {
        // Número fijo, agregar código de área de Colombia
        normalized = '+576' + normalized;
      }
    }
    
    return normalized;
  }
  
  /**
   * Extrae un número de teléfono de un mensaje
   */
  extractPhone(message: string): string | null {
    const patterns = [
      /\+?\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,  // +57 300 123 4567
      /\+?\d{10,13}/,                                     // +573001234567
      /\(\d{3}\)\s*\d{3}[\s.-]?\d{4}/,                    // (300) 123-4567
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return this.normalizePhone(match[0]);
      }
    }
    
    return null;
  }
}

// Singleton para uso global
export const personalityManager = new WhatsAppPersonalityManager();
