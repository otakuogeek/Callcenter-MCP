/**
 * WhatsApp Enhanced Understanding Service
 * 
 * Servicio de comprensión mejorada para WhatsApp que integra:
 * - Memoria semántica persistente
 * - Detección avanzada de intenciones
 * - Extracción de entidades
 * - Contexto enriquecido para respuestas más personalizadas
 * 
 * Inspirado en moltbot para mejor comprensión contextual
 * 
 * @version 1.0.0
 */

import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import pino from 'pino';
import SemanticMemory, { MemoryCategory } from './WhatsAppSemanticMemory';
import * as ChatMemoryService from './ChatMemoryService';

const logger = pino({
  name: 'whatsapp-understanding',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// TIPOS
// ============================================================================

export interface ExtractedEntities {
  document?: string;
  phone?: string;
  email?: string;
  date?: string;
  time?: string;
  specialty?: string;
  location?: string;
  doctorName?: string;
  numbers?: string[];
  names?: string[];
}

export interface IntentAnalysis {
  primaryIntent: string;
  secondaryIntents: string[];
  confidence: number;
  entities: ExtractedEntities;
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface EnrichedContext {
  session: ChatMemoryService.ChatSession | null;
  patientInfo: {
    id: number;
    name: string;
    document: string;
    phone: string;
    epsName: string | null;
    birthDate: string | null;
  } | null;
  recentMessages: ChatMemoryService.ChatMessage[];
  relevantMemories: string | null;
  userPreferences: {
    preferredSpecialtyId?: number;
    preferredLocationId?: number;
    preferredDoctorId?: number;
  } | null;
  lastSummary: string | null;
  intentAnalysis: IntentAnalysis;
}

// ============================================================================
// PATRONES DE EXTRACCIÓN DE ENTIDADES
// ============================================================================

const ENTITY_PATTERNS = {
  // Documentos de identidad (cédula) — excluir números de teléfono colombianos
  document: [
    /[cC][cC]\s*:?\s*(\d+)/,
    /[cC][eE]dula\s*:?\s*(\d+)/i,
    /documento\s*:?\s*(\d+)/i,
    /\b(\d{6,12})\b/,    // Genérico al final, desambiguado en extractEntities()
  ],

  // Teléfonos colombianos (10 dígitos empezando por 3)
  phone: [
    /\+?\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,
    /\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/,   // Celular colombiano 3XX XXX XXXX
    /\+?\d{10,13}/,
    /\(\d{3}\)\s*\d{3}[\s.-]?\d{4}/,
  ],

  // Email
  email: [
    /[\w.-]+@[\w.-]+\.\w+/,
  ],

  // Fechas en español
  date: [
    /(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s*(?:de|del)?\s*(\d{4}))?/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(lunes|martes|mi[ée]rcoles|jueves|viernes|s[aá]bado|domingo)/i,
    /(hoy|ma[nñ]ana|pasado ma[nñ]ana|la pr[oó]xima semana)/i,
  ],

  // Horas
  time: [
    /(\d{1,2})\s*(?::|h|hrs?)?\s*(am|pm|a\.?m\.?|p\.?m\.?)/i,
    /(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i,
    /(ma[nñ]ana|tarde|noche)/i,
    /(temprano|medio d[ií]a|mediod[ií]a)/i,
  ],

  // Especialidades médicas (expandido)
  specialty: [
    /(medicina\s*general|medico\s*general)/i,
    /(odontolog[ií]a|dentista|dientes|limpieza\s*dental)/i,
    /(psicolog[ií]a|psic[oó]logo)/i,
    /(ginecolog[ií]a|ginec[oó]logo)/i,
    /(pediatr[ií]a|pediatra|ni[nñ]os?)/i,
    /(cardiolog[ií]a|cardi[oó]logo|coraz[oó]n)/i,
    /(oftalmolog[ií]a|oftalm[oó]logo|ojos|visi[oó]n)/i,
    /(dermatolog[ií]a|dermat[oó]logo|piel)/i,
    /(traumatolog[ií]a|traumat[oó]logo|huesos|fractura)/i,
    /(nutrici[oó]n|nutricionista|dieta)/i,
    /(fisioterapia|fisioterapeuta|rehabilitaci[oó]n)/i,
    /(control\s*prenatal|embarazo|prenatal)/i,
    /(urolog[ií]a|ur[oó]logo)/i,
    /(otorrinolaringolog[ií]a|otorrino|o[ií]dos?|garganta|nariz)/i,
    /(neurolog[ií]a|neur[oó]logo|cabeza|cerebro)/i,
    /(endocrinolog[ií]a|endocrin[oó]logo|tiroides|diabetes)/i,
    /(gastroenterolog[ií]a|gastro|est[oó]mago|digestivo)/i,
    /(neumolog[ií]a|neum[oó]logo|pulmones?|respirar)/i,
    /(reumatolog[ií]a|reumat[oó]logo|artritis)/i,
    /(cirug[ií]a\s*general|cirujano)/i,
    /(fonoaudiolog[ií]a|fonoaudi[oó]logo)/i,
    /(optometr[ií]a|optometrista|lentes|gafas)/i,
    /(ecograf[ií]a|ultrasonido)/i,
  ],
};

// Mapeo de especialidades detectadas a nombres estándar
const SPECIALTY_MAPPING: Record<string, string> = {
  // Medicina General
  'medicina general': 'Medicina General',
  'medico general': 'Medicina General',
  // Odontología
  'odontologia': 'Odontología',
  'odontología': 'Odontología',
  'dentista': 'Odontología',
  'dientes': 'Odontología',
  'limpieza dental': 'Odontología',
  // Psicología
  'psicologia': 'Psicología',
  'psicología': 'Psicología',
  'psicologo': 'Psicología',
  'psicólogo': 'Psicología',
  // Ginecología
  'ginecologia': 'Ginecología',
  'ginecología': 'Ginecología',
  'ginecologo': 'Ginecología',
  'ginecólogo': 'Ginecología',
  // Pediatría
  'pediatria': 'Pediatría',
  'pediatría': 'Pediatría',
  'pediatra': 'Pediatría',
  'niños': 'Pediatría',
  'ninos': 'Pediatría',
  // Cardiología
  'cardiologia': 'Cardiología',
  'cardiología': 'Cardiología',
  'cardiologo': 'Cardiología',
  'cardiólogo': 'Cardiología',
  'corazon': 'Cardiología',
  'corazón': 'Cardiología',
  // Oftalmología
  'oftalmologia': 'Oftalmología',
  'oftalmología': 'Oftalmología',
  'oftalmologo': 'Oftalmología',
  'oftalmólogo': 'Oftalmología',
  'ojos': 'Oftalmología',
  'vision': 'Oftalmología',
  'visión': 'Oftalmología',
  // Dermatología
  'dermatologia': 'Dermatología',
  'dermatología': 'Dermatología',
  'dermatologo': 'Dermatología',
  'dermatólogo': 'Dermatología',
  'piel': 'Dermatología',
  // Traumatología
  'traumatologia': 'Traumatología',
  'traumatología': 'Traumatología',
  'traumatologo': 'Traumatología',
  'traumatólogo': 'Traumatología',
  'huesos': 'Traumatología',
  'fractura': 'Traumatología',
  // Nutrición
  'nutricion': 'Nutrición',
  'nutrición': 'Nutrición',
  'nutricionista': 'Nutrición',
  'dieta': 'Nutrición',
  // Fisioterapia
  'fisioterapia': 'Fisioterapia',
  'fisioterapeuta': 'Fisioterapia',
  'rehabilitacion': 'Fisioterapia',
  'rehabilitación': 'Fisioterapia',
  // Control Prenatal
  'control prenatal': 'Control Prenatal',
  'embarazo': 'Control Prenatal',
  'prenatal': 'Control Prenatal',
  // Urología
  'urologia': 'Urología',
  'urología': 'Urología',
  'urologo': 'Urología',
  'urólogo': 'Urología',
  // Otorrinolaringología
  'otorrinolaringologia': 'Otorrinolaringología',
  'otorrinolaringología': 'Otorrinolaringología',
  'otorrino': 'Otorrinolaringología',
  'oidos': 'Otorrinolaringología',
  'oídos': 'Otorrinolaringología',
  'garganta': 'Otorrinolaringología',
  'nariz': 'Otorrinolaringología',
  // Neurología
  'neurologia': 'Neurología',
  'neurología': 'Neurología',
  'neurologo': 'Neurología',
  'neurólogo': 'Neurología',
  'cerebro': 'Neurología',
  // Endocrinología
  'endocrinologia': 'Endocrinología',
  'endocrinología': 'Endocrinología',
  'endocrinologo': 'Endocrinología',
  'endocrinólogo': 'Endocrinología',
  'tiroides': 'Endocrinología',
  'diabetes': 'Endocrinología',
  // Gastroenterología
  'gastroenterologia': 'Gastroenterología',
  'gastroenterología': 'Gastroenterología',
  'gastro': 'Gastroenterología',
  'estomago': 'Gastroenterología',
  'estómago': 'Gastroenterología',
  'digestivo': 'Gastroenterología',
  // Neumología
  'neumologia': 'Neumología',
  'neumología': 'Neumología',
  'neumologo': 'Neumología',
  'neumólogo': 'Neumología',
  'pulmones': 'Neumología',
  'respirar': 'Neumología',
  // Reumatología
  'reumatologia': 'Reumatología',
  'reumatología': 'Reumatología',
  'reumatologo': 'Reumatología',
  'reumatólogo': 'Reumatología',
  'artritis': 'Reumatología',
  // Cirugía General
  'cirugia general': 'Cirugía General',
  'cirugía general': 'Cirugía General',
  'cirujano': 'Cirugía General',
  // Fonoaudiología
  'fonoaudiologia': 'Fonoaudiología',
  'fonoaudiología': 'Fonoaudiología',
  'fonoaudiologo': 'Fonoaudiología',
  'fonoaudiólogo': 'Fonoaudiología',
  // Optometría
  'optometria': 'Optometría',
  'optometría': 'Optometría',
  'optometrista': 'Optometría',
  'lentes': 'Optometría',
  'gafas': 'Optometría',
  // Ecografía
  'ecografia': 'Ecografía',
  'ecografía': 'Ecografía',
  'ultrasonido': 'Ecografía',
};

// ============================================================================
// ANÁLISIS DE INTENCIÓN AVANZADO
// ============================================================================

const INTENT_PATTERNS: Record<string, { patterns: RegExp[]; weight: number }> = {
  'greeting': {
    patterns: [
      /^(hola+|buenas?( tardes?| d[ií]as?| noches?)?|saludos?|hey+|hi+|hello+)[!.,\s]*$/i,
      /^(ola+|holaa*|buenas+|wenas?|bnas?|bn|buen[ao]s?)[!.,\s]*$/i,
      /^(que tal|como estas?|como va[ns]?|como andas?|aloh?)[!.,\s]*$/i,
      /^(epa|ey|oye|holi|holis|alo|q hubo|q hay|quiubo|quihubo)[!.,\s]*$/i,
    ],
    weight: 1.0
  },
  'schedule': {
    patterns: [
      /quiero( una)?( la)? cita/i,
      /necesito (una )?cita/i,
      /agendar(me)?( una)?( cita)?/i,
      /sacar( una)? cita/i,
      /pedir( una)? cita/i,
      /reservar( una)? cita/i,
      /(me )?(puede[ns]?|podria[ns]?|podr[ií]a[ns]?) agendar/i,
      /tiene[ns]? disponibilidad/i,
      /hay cupos?/i,
      /pa( una| la)? cita/i,
      /pa sacar cita/i,
      /me urge+ (una )?cita/i,
      /necesito q(ue)? me vea (un )?(doctor|medico)/i,
      /quiero (ir al|ver al|ver un) (doctor|medico|especialista)/i,
      /cita (para|con|de|en)/i,
      /me puede[ns]? (dar|asignar) (una )?cita/i,
      /hay agenda/i,
      /hay espacio/i,
      /quiero (consultar|consulta)/i,
      /puedo (sacar|pedir|agendar) (una )?cita/i,
    ],
    weight: 0.95
  },
  'check_appointment': {
    patterns: [
      /(?<!cancel[aeoó]r? )(mi[s]? cita[s]?)(?!.*cancel)/i,
      /cita[s]? que tengo/i,
      /tengo cita[s]?/i,
      /cita[s]? pendiente[s]?/i,
      /cuando (es|tengo) (mi )?cita/i,
      /estado de mi cita/i,
      /consultar (mi )?cita/i,
      /ver (mi[s]? )?cita[s]?/i,
      /revisar (mi[s]? )?cita[s]?/i,
      /lista de espera/i,
      /que citas tengo/i,
      /q citas tengo/i,
      /cuales son mis citas/i,
      /cuales citas/i,
      /pa cuando es mi cita/i,
      /pa cuando tengo/i,
      /cuando me toca/i,
      /a que hora (es|tengo) (la )?cita/i,
      /que dia (es|tengo) (la )?cita/i,
      /info(rmacion)? de mi[s]? cita[s]?/i,
      /recordarme mi[s]? cita[s]?/i,
      /tengo algo agendado/i,
      /tengo algo programado/i,
      /tengo alguna cita/i,
    ],
    weight: 0.85
  },
  'cancel': {
    patterns: [
      /cancel[aeoó]r?( la| mi| mis| todas| una)?( cita[s]?)?/i,
      /cancela( la| mi| mis| todas)?( cita[s]?)?( de| del)?/i,
      /anular( la| mi)?( cita)?/i,
      /anula( la| mi| mis)?( cita[s]?)?/i,
      /no (voy a |puedo )?(ir|asistir)/i,
      /eliminar( la| mi)?( cita)?/i,
      /quiero cancelar/i,
      /deseo cancelar/i,
      /necesito cancelar/i,
      /quitar(me)?( la| mi)?( cita)?/i,
      /borrar( la| mi)?( cita)?/i,
      /ya no (quiero|puedo|voy a?) ir/i,
      /no voy a poder/i,
      /no asistir[eé]/i,
      /deshacer (la )?cita/i,
    ],
    weight: 0.95
  },
  'reschedule': {
    patterns: [
      /cambiar( la| mi)?( cita| hora| fecha)?/i,
      /reprogramar( la| mi)?( cita)?/i,
      /mover( la| mi)?( cita)?/i,
      /otro (d[ií]a|horario|fecha)/i,
      /otra (hora|fecha)/i,
      /posponer( la| mi)?( cita)?/i,
      /reagendar( la| mi)?( cita)?/i,
      /pasar(la)? (para|a) (otro|otra)/i,
      /correr( la| mi)?( cita)?/i,
      /adelantar( la| mi)?( cita)?/i,
      /cambio de (hora|fecha|d[ií]a)/i,
    ],
    weight: 0.9
  },
  'medical_question': {
    patterns: [
      /que especialidad necesito/i,
      /que (doctor|medico|médico) (debo|tengo que) ver/i,
      /me duele/i,
      /tengo (dolor|molestia)/i,
      /s[ií]ntomas?/i,
      /es urgente/i,
      /emergencia/i,
      /a donde (debo|tengo que) ir/i,
      /que hago si/i,
      /me siento mal/i,
    ],
    weight: 0.85
  },
  'info': {
    patterns: [
      /informaci[oó]n( sobre)?/i,
      /que servicios/i,
      /que especialidades/i,
      /donde queda[n]?/i,
      /direcci[oó]n/i,
      /ubicaci[oó]n/i,
      /horarios? de atenci[oó]n/i,
      /tel[eé]fono/i,
      /datos de contacto/i,
      /como llego/i,
      /que atienden/i,
    ],
    weight: 0.8
  },
  'waiting_list': {
    patterns: [
      /lista de espera/i,
      /cola de espera/i,
      /espera(r)?( turno)?/i,
      /avisarme cuando haya/i,
      /notificarme/i,
      /(mi )?posici[oó]n en (la )?lista/i,
      /poner(me)? en (la )?lista/i,
      /anotar(me)? en (la )?lista/i,
    ],
    weight: 0.85
  },
  'price_query': {
    patterns: [
      /cu[aá]nto (cuesta|vale|cobra[n]?)/i,
      /qu[eé] precio/i,
      /tarifa[s]?/i,
      /costo[s]?/i,
      /valor (de la|de una)/i,
      /es (gratis|gratuito)/i,
    ],
    weight: 0.85
  },
  'confirm': {
    patterns: [
      /^(s[ií]|sip|sep|claro|dale|ok|va|arre|okey|vale|listo|perfecto|confirmo|correcto|exacto|as[ií] es|bueno|ya|ajá|aja)[!.,\s]*$/i,
      /^(s[ií],?\s*por favor|esta bien|est[aá] bien|de acuerdo|eso|esa|ese|hecho|va pues)[!.,\s]*$/i,
      /\b(s[ií]|sip|claro|dale|ok|vale|listo|perfecto|confirmo|correcto)\b/i,
    ],
    weight: 1.0
  },
  'deny': {
    patterns: [
      /^(no|nop|nope|nel|negativo|para nada|nan|ñ|nah|nel pastel)[!.,\s]*$/i,
      /^(no,?\s*gracias|prefiero no|mejor no|ninguno|ninguna|ni loco)[!.,\s]*$/i,
      /\b(no quiero|no gracias|no,?\s*mejor|tampoco|ni modo)\b/i,
    ],
    weight: 1.0
  },
  'thanks': {
    patterns: [
      /(muchas? )?gracias/i,
      /te lo agradezco/i,
      /muy amable/i,
      /grax|grcias|grasias/i,
      /mil gracias/i,
      /thank/i,
    ],
    weight: 0.8
  },
  'goodbye': {
    patterns: [
      /adi[oó]s/i,
      /chao/i,
      /chau/i,
      /hasta (luego|pronto|ma[nñ]ana|la vista|otro d[ií]a)/i,
      /nos vemos/i,
      /bye+/i,
      /bai/i,
      /me despido/i,
      /hasta la pr[oó]xima/i,
    ],
    weight: 0.9
  },
  'complaint': {
    patterns: [
      /queja/i,
      /reclamo/i,
      /molest(o|a|ia)/i,
      /no me gusta/i,
      /mal servicio/i,
      /p[eé]simo/i,
      /indignado/i,
      /demora mucho/i,
      /nadie (me )?contest/i,
      /no (me )?(atienden|responden)/i,
    ],
    weight: 0.9
  },
  'update_info': {
    patterns: [
      /actualizar (mi )?datos?/i,
      /cambiar (mi )?(tel[eé]fono|n[uú]mero|direcci[oó]n|correo)/i,
      /mi nuevo (tel[eé]fono|n[uú]mero|correo)/i,
      /me cambi[eé]/i,
      /corregir (mis? )?datos/i,
    ],
    weight: 0.85
  },
};

// Análisis de sentimiento simple
const SENTIMENT_PATTERNS = {
  positive: [
    /gracias/i, /excelente/i, /perfecto/i, /genial/i, /maravilloso/i,
    /bueno/i, /bien/i, /feliz/i, /contento/i, /satisfecho/i,
    /bacano/i, /chevere/i, /chévere/i, /super/i, /súper/i, /brutal/i,
    /😊|😀|👍|💚|❤️|✨|🤩|🙏|🎉/,
  ],
  negative: [
    /mal/i, /horrible/i, /p[eé]simo/i, /terrible/i, /queja/i, /molest/i,
    /frustrad/i, /enojad/i, /decepcionad/i, /harto/i, /cansado de/i,
    /indignado/i, /insatisfecho/i, /demora/i, /tard[ae]/i,
    /😠|😡|😤|😞|😢|😔|😩|😭/,
  ],
};

// Indicadores de urgencia
const URGENCY_PATTERNS = {
  critical: [
    /emergencia/i, /urgente/i, /inmediato/i, /ahora mismo/i,
    /dolor intenso/i, /no puedo respirar/i, /sangrado/i, /accidente/i,
    /me estoy muriendo/i, /auxilio/i, /ayuda urgente/i, /es de vida o muerte/i,
  ],
  high: [
    /lo antes posible/i, /hoy/i, /necesito ya/i, /es urgente/i,
    /muy importante/i, /pronto/i, /lo m[aá]s r[aá]pido/i, /cuanto antes/i,
    /no puede esperar/i, /me urge/i,
  ],
  medium: [
    /esta semana/i, /pronto/i, /cuando pueda/i, /en estos d[ií]as/i,
    /ma[nñ]ana/i, /pasado ma[nñ]ana/i,
  ],
};

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Extrae entidades de un mensaje
 */
export function extractEntities(message: string): ExtractedEntities {
  const entities: ExtractedEntities = {};
  const cleanMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Extraer teléfono PRIMERO (para desambiguar de documento)
  let detectedPhone: string | null = null;
  for (const pattern of ENTITY_PATTERNS.phone) {
    const match = message.match(pattern);
    if (match) {
      detectedPhone = match[0].replace(/[^\d+]/g, '');
      entities.phone = detectedPhone;
      break;
    }
  }

  // Extraer documento — desambiguar de teléfonos colombianos
  for (const pattern of ENTITY_PATTERNS.document) {
    const match = message.match(pattern);
    if (match) {
      const doc = (match[1] || match[0]).replace(/[^\d]/g, '');
      if (doc.length >= 6 && doc.length <= 12) {
        // Desambiguación: 10 dígitos empezando por 3 = teléfono colombiano, NO cédula
        const looksLikePhone = doc.length === 10 && doc.startsWith('3');
        // Si se detectó el mismo número como teléfono, es teléfono
        const sameAsPhone = detectedPhone && detectedPhone.replace(/\+/, '').endsWith(doc);

        if (looksLikePhone || sameAsPhone) {
          // Es un teléfono, no un documento — asegurar que esté en entities.phone
          if (!entities.phone) entities.phone = doc;
          continue; // No asignar como documento
        }

        entities.document = doc;
        break;
      }
    }
  }

  // Extraer email
  for (const pattern of ENTITY_PATTERNS.email) {
    const match = message.match(pattern);
    if (match) {
      entities.email = match[0].toLowerCase();
      break;
    }
  }

  // Extraer especialidad
  for (const pattern of ENTITY_PATTERNS.specialty) {
    const match = cleanMessage.match(pattern);
    if (match) {
      const detected = match[0].toLowerCase();
      // Buscar en el mapeo
      for (const [key, value] of Object.entries(SPECIALTY_MAPPING)) {
        if (detected.includes(key)) {
          entities.specialty = value;
          break;
        }
      }
      if (entities.specialty) break;
    }
  }

  // Extraer fecha
  for (const pattern of ENTITY_PATTERNS.date) {
    const match = message.match(pattern);
    if (match) {
      entities.date = match[0];
      break;
    }
  }

  // Extraer hora
  for (const pattern of ENTITY_PATTERNS.time) {
    const match = message.match(pattern);
    if (match) {
      entities.time = match[0];
      break;
    }
  }

  // Extraer todos los números (para posibles selecciones)
  const numberMatches = message.match(/\b\d+\b/g);
  if (numberMatches) {
    entities.numbers = numberMatches;
  }

  return entities;
}

/**
 * Analiza la intención del mensaje con confianza
 */
export function analyzeIntent(message: string): IntentAnalysis {
  // Normalizar: quitar acentos, minúsculas
  const cleanMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Normalizar abreviaciones y typos comunes en español colombiano
  const normalizedMessage = cleanMessage
    .replace(/\bq\b/g, 'que')
    .replace(/\bpa\b/g, 'para')
    .replace(/\bx\b/g, 'por')
    .replace(/\bxq\b/g, 'porque')
    .replace(/\bbn\b/g, 'buenas')
    .replace(/\bbnas\b/g, 'buenas')
    .replace(/\bwenas\b/g, 'buenas')
    .replace(/\bdoc\b/g, 'doctor')
    .replace(/\binfo\b/g, 'informacion')
    .replace(/\bcel\b/g, 'celular')
    .replace(/\bgrax\b/g, 'gracias')
    .replace(/\bgrcias\b/g, 'gracias')
    .replace(/\bgrasias\b/g, 'gracias')
    .replace(/\btbien\b/g, 'tambien')
    .replace(/\btbn\b/g, 'tambien')
    .replace(/\bpls\b/g, 'por favor')
    .replace(/\bpf\b/g, 'por favor')
    .replace(/\bxfa\b/g, 'por favor')
    // Quitar letras repetidas excesivas (holaaa → hola, siii → si)
    .replace(/(.)\1{2,}/g, '$1$1');

  const entities = extractEntities(message);

  // Detectar intenciones — probar contra el mensaje original y normalizado
  const detectedIntents: Array<{ intent: string; confidence: number }> = [];

  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(cleanMessage) || pattern.test(normalizedMessage)) {
        detectedIntents.push({
          intent,
          confidence: config.weight
        });
        break;
      }
    }
  }

  // Si solo hay un número largo, probablemente es un documento
  if (detectedIntents.length === 0 && entities.document && !entities.specialty) {
    detectedIntents.push({ intent: 'provide_document', confidence: 0.85 });
  }

  // Si menciona una especialidad sin otra intención clara, probablemente quiere agendar
  if (entities.specialty && !detectedIntents.some(d => d.intent === 'schedule')) {
    detectedIntents.push({ intent: 'schedule', confidence: 0.7 });
  }

  // Si el mensaje es solo un número del 1 al 15, probablemente es una selección
  if (/^\d{1,2}$/.test(message.trim()) && parseInt(message.trim()) <= 15) {
    if (!detectedIntents.some(d => d.intent === 'confirm' || d.intent === 'provide_document')) {
      detectedIntents.push({ intent: 'confirm', confidence: 0.6 });
    }
  }

  // Ordenar por confianza
  detectedIntents.sort((a, b) => b.confidence - a.confidence);

  const primaryIntent = detectedIntents[0]?.intent || 'unknown';
  const confidence = detectedIntents[0]?.confidence || 0;
  const secondaryIntents = detectedIntents.slice(1, 3).map(d => d.intent);

  // Analizar sentimiento — probar contra ambas versiones
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  const positiveCount = SENTIMENT_PATTERNS.positive.filter(p => p.test(message) || p.test(normalizedMessage)).length;
  const negativeCount = SENTIMENT_PATTERNS.negative.filter(p => p.test(message) || p.test(normalizedMessage)).length;

  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > positiveCount) sentiment = 'negative';

  // Analizar urgencia
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (URGENCY_PATTERNS.critical.some(p => p.test(cleanMessage) || p.test(normalizedMessage))) {
    urgency = 'critical';
  } else if (URGENCY_PATTERNS.high.some(p => p.test(cleanMessage) || p.test(normalizedMessage))) {
    urgency = 'high';
  } else if (URGENCY_PATTERNS.medium.some(p => p.test(cleanMessage) || p.test(normalizedMessage))) {
    urgency = 'medium';
  }

  return {
    primaryIntent,
    secondaryIntents,
    confidence,
    entities,
    sentiment,
    urgency
  };
}

/**
 * Construye el contexto enriquecido para el AI
 */
export async function buildEnrichedContext(
  phone: string,
  message: string
): Promise<EnrichedContext> {
  const cleanPhone = phone.replace(/@.*/, '');

  // Análisis de intención
  const intentAnalysis = analyzeIntent(message);

  // Obtener sesión y contexto de memoria
  const sessionContext = await ChatMemoryService.getSessionContext(cleanPhone);

  // Obtener memorias relevantes
  let relevantMemories: string | null = null;
  if (sessionContext?.session.id) {
    relevantMemories = await SemanticMemory.generateMemoryContext(
      sessionContext.session.id,
      message
    );
  }

  // Obtener preferencias del usuario
  const userPreferences = await SemanticMemory.getUserPreferences(cleanPhone);

  // Obtener último resumen
  let lastSummary: string | null = null;
  if (sessionContext?.session.id) {
    try {
      const [summaryRows] = await pool.execute<RowDataPacket[]>(
        `SELECT summary FROM whatsapp_chat_summaries 
         WHERE session_id = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [sessionContext.session.id]
      );
      if (summaryRows.length > 0) {
        lastSummary = summaryRows[0].summary;
      }
    } catch (error) {
      // Ignorar errores de resumen
    }
  }

  // Construir info del paciente
  let patientInfo = null;
  if (sessionContext?.patientInfo) {
    patientInfo = {
      id: sessionContext.patientInfo.id,
      name: sessionContext.patientInfo.name,
      document: sessionContext.patientInfo.document,
      phone: sessionContext.patientInfo.phone,
      epsName: sessionContext.patientInfo.eps_name,
      birthDate: null // Si está disponible
    };
  }

  return {
    session: sessionContext?.session || null,
    patientInfo,
    recentMessages: sessionContext?.recentMessages || [],
    relevantMemories,
    userPreferences,
    lastSummary,
    intentAnalysis
  };
}

/**
 * Genera el prompt de contexto para inyectar al sistema
 */
export function generateContextPrompt(context: EnrichedContext): string {
  const parts: string[] = [];

  // Análisis de intención
  parts.push(`📊 ANÁLISIS DEL MENSAJE:
- Intención detectada: ${context.intentAnalysis.primaryIntent} (${Math.round(context.intentAnalysis.confidence * 100)}% confianza)
- Sentimiento: ${context.intentAnalysis.sentiment}
- Urgencia: ${context.intentAnalysis.urgency}`);

  // Entidades extraídas
  const entities = context.intentAnalysis.entities;
  if (Object.keys(entities).length > 0) {
    const entityList: string[] = [];
    if (entities.document) entityList.push(`📄 Documento: ${entities.document}`);
    if (entities.phone) entityList.push(`📞 Teléfono: ${entities.phone}`);
    if (entities.specialty) entityList.push(`🏥 Especialidad: ${entities.specialty}`);
    if (entities.date) entityList.push(`📅 Fecha: ${entities.date}`);
    if (entities.time) entityList.push(`🕐 Hora: ${entities.time}`);

    if (entityList.length > 0) {
      parts.push(`\n🔍 ENTIDADES DETECTADAS:\n${entityList.join('\n')}`);
    }
  }

  // Información del paciente - INCLUIR patient_id EXPLÍCITAMENTE
  if (context.patientInfo) {
    parts.push(`\n👤 PACIENTE IDENTIFICADO:
- ⚠️ patient_id: ${context.patientInfo.id} ← USA ESTE NÚMERO EN scheduleAppointment
- Nombre: ${context.patientInfo.name}
- Documento: ${context.patientInfo.document}
- Teléfono: ${context.patientInfo.phone}
- EPS: ${context.patientInfo.epsName || 'No especificada'}`);
  }

  // Preferencias del usuario
  if (context.userPreferences) {
    const prefs: string[] = [];
    if (context.userPreferences.preferredSpecialtyId) {
      prefs.push(`Especialidad preferida ID: ${context.userPreferences.preferredSpecialtyId}`);
    }
    if (context.userPreferences.preferredLocationId) {
      prefs.push(`Sede preferida ID: ${context.userPreferences.preferredLocationId}`);
    }
    if (context.userPreferences.preferredDoctorId) {
      prefs.push(`Doctor preferido ID: ${context.userPreferences.preferredDoctorId}`);
    }
    if (prefs.length > 0) {
      parts.push(`\n⭐ PREFERENCIAS DEL USUARIO:\n${prefs.join('\n')}`);
    }
  }

  // Memorias relevantes
  if (context.relevantMemories) {
    parts.push(context.relevantMemories);
  }

  // Resumen de conversación anterior
  if (context.lastSummary) {
    parts.push(`\n📝 RESUMEN CONVERSACIÓN ANTERIOR:\n${context.lastSummary}`);
  }

  // Estado de la sesión
  if (context.session && context.session.current_state !== 'idle') {
    parts.push(`\n📌 ESTADO DE CONVERSACIÓN: ${context.session.current_state}`);
  }

  // ⚠️ INFORMACIÓN CRÍTICA DE CITA SELECCIONADA (si existe)
  if (context.session && context.session.availability_id) {
    parts.push(`\n🔴🔴🔴 CITA PENDIENTE DE AGENDAR - USA ESTOS IDs EXACTOS 🔴🔴🔴
- ⚠️ availability_id: ${context.session.availability_id} ← USA ESTE NÚMERO
- ⚠️ patient_id: ${context.session.patient_id} ← USA ESTE NÚMERO
- Doctor(a): ${context.session.selected_doctor || 'No especificado'}
- Fecha: ${context.session.selected_date || 'No especificada'}
- Hora: ${context.session.selected_time || 'No especificada'}
- Especialidad: ${context.session.specialty_name || 'No especificada'}

⚠️ CUANDO EL USUARIO CONFIRME, EJECUTA:
[TOOL:scheduleAppointment:{"patient_id":${context.session.patient_id},"availability_id":${context.session.availability_id},"scheduled_date":"${context.session.selected_date} ${context.session.selected_time}","reason":"Consulta de ${context.session.specialty_name || 'medicina'}","appointment_type":"Presencial","priority_level":"Normal"}]`);
  }

  return `
---
🧠 CONTEXTO ENRIQUECIDO (Usar para personalizar respuesta):
${parts.join('\n')}
---
`;
}

/**
 * Post-procesa una respuesta del bot para auto-capturar memorias
 */
export async function postProcessResponse(
  sessionId: number,
  userMessage: string,
  botResponse: string,
  patientId?: number
): Promise<void> {
  try {
    // Auto-captura de memorias del mensaje del usuario
    await SemanticMemory.autoCapture(
      sessionId,
      [{ role: 'user', content: userMessage }],
      patientId
    );

    // Registrar analytics
    await pool.execute(
      `INSERT INTO whatsapp_bot_analytics 
       (session_id, action_type, action_details)
       VALUES (?, 'message_received', ?)`,
      [sessionId, JSON.stringify({ messageLength: userMessage.length })]
    );

    await pool.execute(
      `INSERT INTO whatsapp_bot_analytics 
       (session_id, action_type, action_details)
       VALUES (?, 'message_sent', ?)`,
      [sessionId, JSON.stringify({ responseLength: botResponse.length })]
    );

  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error en post-procesamiento');
  }
}

// ============================================================================
// EXPORTACIÓN
// ============================================================================

export default {
  // Extracción de entidades
  extractEntities,

  // Análisis de intención
  analyzeIntent,

  // Contexto enriquecido
  buildEnrichedContext,
  generateContextPrompt,

  // Post-procesamiento
  postProcessResponse,
};
