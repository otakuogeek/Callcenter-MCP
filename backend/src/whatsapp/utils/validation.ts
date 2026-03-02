/**
 * Utilidades de validación reutilizables
 * @module whatsapp/utils/validation
 */

/**
 * Detecta si un valor es un placeholder del modelo AI
 * (e.g. "[id]", "{{patient_id}}", "pendiente")
 */
export function isPlaceholder(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return lower === '[id]' || lower === '[id real]' ||
      lower === 'id' || lower === '[numero]' ||
      lower.includes('[') || lower.includes('{{') ||
      lower === 'real' || lower === 'pendiente';
  }
  return false;
}

/** Respuestas afirmativas en español */
export function isAffirmative(message: string): boolean {
  return /^(s[ií]|sí|si|claro|ok|okay|dale|listo|perfecto|correcto|exacto|sip|sep|ajá|aja|bueno|vale|de una|aceptar|confirmo|yes|yep|afirmativo|así es|eso es|por supuesto)$/i.test(message.trim());
}

/** Respuestas negativas en español */
export function isNegative(message: string): boolean {
  return /^(no|nop|nah|nel|negativo|para nada|nada|ninguno|nunca|jamás|jamas|tampoco|no gracias|no, gracias)$/i.test(message.trim());
}

/** Regex para documentos colombianos (6-12 dígitos) */
export const DOCUMENT_REGEX = /^(\d{6,12})$/;

/** Regex para teléfonos colombianos (7-15 dígitos sin formato) */
export const PHONE_REGEX = /^\d{7,15}$/;

/** Regex para saludos */
export const GREETING_REGEX = /^(hola|buenas|buenos días|buenas tardes|buenas noches|hey|hi|hello|saludos)/i;

/** Regex para frases que indican que la IA afirma haber agendado una cita */
export const FALSE_SCHEDULE_CLAIM_REGEX = new RegExp([
  'cita (ha sido|fue|está) (confirmada|agendada)',
  'tu cita.*(confirmada|agendada)',
  '(he |ya |te )?agend(ado|ada|é|amos)',
  'cita #\\d+',
  'Cita #.*\\d+',
  'confirmada.*cita',
  'registrada tu cita',
  'tu cita.*queda.*para',
  'cita ha sido exitosamente',
  'cita quedó programada',
  '¡listo!.*cita'
].join('|'), 'i');

/** Regex para detectar placeholders residuales en respuestas */
export const PLACEHOLDER_IN_RESPONSE_REGEX = /\[data\.|data\.appointment_id\]|\[appointment_id\]|\[esperando.*herramienta\]/i;
