/**
 * Utilidades del módulo WhatsApp — barrel export
 * @module whatsapp/utils
 */

export {
  isPlaceholder,
  isAffirmative,
  isNegative,
  DOCUMENT_REGEX,
  PHONE_REGEX,
  GREETING_REGEX,
  FALSE_SCHEDULE_CLAIM_REGEX,
  PLACEHOLDER_IN_RESPONSE_REGEX
} from './validation';

export {
  cleanResponseFromToolResults,
  limitEmojisPerLine,
  stripResidualPlaceholders,
  replacePlaceholdersWithId,
  cleanPhone
} from './text';

export {
  convertToColombiaTime,
  formatDate,
  formatTime,
  formatDateForComparison,
  formatTimeForComparison,
  getCurrentDateTimeColombia,
  getCurrentISODateTime,
  getTodayColombia,
  normalizeToolResultDatesForWhatsApp
} from './date';
