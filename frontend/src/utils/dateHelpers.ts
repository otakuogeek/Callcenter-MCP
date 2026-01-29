/**
 * Utilidades para manejo seguro de fechas
 * Resuelve problemas de zona horaria en fechas ISO (YYYY-MM-DD)
 */
import { format } from 'date-fns';

/**
 * Convierte un string de fecha a objeto Date de forma segura
 * Agrega 'T12:00:00' para evitar problemas de zona horaria
 * @param dateString - String de fecha en formato YYYY-MM-DD
 * @returns Date object o null si la fecha es inválida
 */
export function safeDateFromString(dateString: string | null | undefined): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  
  try {
    // Si ya tiene hora, úsalo directamente
    if (dateString.includes('T')) {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Si es solo fecha (YYYY-MM-DD), agregar hora del mediodía para evitar cambio de día
    const date = new Date(dateString + 'T12:00:00');
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('Error parsing date:', dateString, error);
    return null;
  }
}

/**
 * Valida si un string de fecha es válido
 * @param dateString - String de fecha
 * @returns true si es válida, false si no
 */
export function isValidDateString(dateString: string | null | undefined): boolean {
  return safeDateFromString(dateString) !== null;
}

/**
 * Obtiene el día de la semana de forma segura
 * @param dateString - String de fecha en formato YYYY-MM-DD
 * @returns Número del día (0=Domingo, 6=Sábado) o null si es inválido
 */
export function safeDayOfWeek(dateString: string | null | undefined): number | null {
  const date = safeDateFromString(dateString);
  return date ? date.getDay() : null;
}

/**
 * Formatea una fecha de forma segura usando date-fns
 * @param dateString - String de fecha
 * @param formatStr - String de formato de date-fns
 * @param options - Opciones adicionales (locale, etc)
 * @returns String formateado o fallback
 */
export function safeFormatDate(
  dateString: string | null | undefined,
  formatStr: string,
  options?: any,
  fallback: string = 'Sin fecha'
): string {
  const date = safeDateFromString(dateString);
  if (!date) return fallback;
  
  try {
    return format(date, formatStr, options);
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return fallback;
  }
}

/**
 * Convierte una hora de UTC a UTC-5 (Colombia/Bogotá)
 * @param timeString - Hora en formato HH:mm o HH:mm:ss (UTC)
 * @returns Hora en formato HH:mm (UTC-5)
 */
export function convertUTCToColombiaTime(timeString: string): string {
  if (!timeString) return timeString;
  
  try {
    // Si ya está formateada con AM/PM, retornarla sin modificar
    // Nota: es-CO usa non-breaking space (NBSP \u00A0) entre "a." y "m."
    const lowerTime = timeString.toLowerCase();
    // Normalizar espacios (convertir NBSP a espacio normal) para la detección
    const normalizedTime = lowerTime.replace(/\u00A0/g, ' ');
    if (normalizedTime.includes('a. m.') || normalizedTime.includes('p. m.') || 
        normalizedTime.includes('am') || normalizedTime.includes('pm') ||
        normalizedTime.includes('a.m') || normalizedTime.includes('p.m') ||
        normalizedTime.includes(' m.')) {
      return timeString;
    }
    
    // Manejar diferentes formatos de hora
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    
    // Validar que sean números válidos
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Invalid time format:', timeString);
      return timeString;
    }
    
    // Restar 5 horas para UTC-5
    let colombiaHours = hours - 5;
    
    // Manejar cambio de día
    if (colombiaHours < 0) {
      colombiaHours += 24;
    }
    
    // Formatear a 12 horas con AM/PM
    const period = colombiaHours >= 12 ? 'p.m.' : 'a.m.';
    let displayHours = colombiaHours % 12;
    if (displayHours === 0) displayHours = 12; // 0 horas = 12 AM, 12 horas = 12 PM
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    console.warn('Error converting time to Colombia timezone:', timeString, error);
    return timeString;
  }
}

export function convertUTCToColombiaTime24(timeString: string): string {
  if (!timeString) return timeString;

  try {
    const normalized = String(timeString).trim().toLowerCase().replace(/\u00a0/g, ' ');
    if (normalized.includes('a. m.') || normalized.includes('p. m.') || normalized.includes('am') || normalized.includes('pm')) {
      return timeString;
    }

    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (isNaN(hours) || isNaN(minutes)) return timeString;

    let colombiaHours = hours - 5;
    if (colombiaHours < 0) colombiaHours += 24;

    return `${colombiaHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch {
    return timeString;
  }
}

/**
 * Convierte un array de horas de UTC a UTC-5 (Colombia)
 * @param timeSlots - Array de horas en formato HH:mm (UTC)
 * @returns Array de horas en formato HH:mm (UTC-5)
 */
export function convertTimeSlotsToColombiaTime(timeSlots: string[]): string[] {
  if (!timeSlots || !Array.isArray(timeSlots)) return timeSlots;
  return timeSlots.map(time => convertUTCToColombiaTime(time));
}

/**
 * Convierte una hora de UTC-5 (Colombia) a UTC
 * @param timeString - Hora en formato HH:mm (UTC-5)
 * @returns Hora en formato HH:mm (UTC)
 */
export function convertColombiaTimeToUTC(timeString: string): string {
  if (!timeString) return timeString;
  
  try {
    // Manejar diferentes formatos de hora
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    
    // Validar que sean números válidos
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Invalid time format:', timeString);
      return timeString;
    }
    
    // Sumar 5 horas para UTC
    let utcHours = hours + 5;
    
    // Manejar cambio de día
    if (utcHours >= 24) {
      utcHours -= 24;
    }
    
    return `${utcHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (error) {
    console.warn('Error converting time to UTC:', timeString, error);
    return timeString;
  }
}

// ==========================================
// 🇨🇴 FUNCIONES CON CONVERSIÓN TIMEZONE COLOMBIA
// Usar para fechas que vienen de la BD (UTC-0)
// ==========================================

const COLOMBIA_TIMEZONE = 'America/Bogota';
const COLOMBIA_LOCALE = 'es-CO';

/**
 * Formatea una fecha ISO/MySQL a formato corto DD/MM/YYYY en zona horaria Colombia
 * @param dateString - Fecha ISO o MySQL string
 * @returns Fecha formateada como 'DD/MM/YYYY'
 */
export function formatDateColombia(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formatea una fecha a formato largo en zona horaria Colombia
 * Ej: "lunes, 15 de enero de 2026"
 */
export function formatFullDateColombia(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formatea hora en formato 12 horas con AM/PM en zona horaria Colombia
 * @param dateString - Fecha ISO o MySQL string con hora
 * @returns Hora formateada como 'H:mm a. m./p. m.'
 */
export function formatTimeColombia(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formatea fecha y hora completa en zona horaria Colombia
 * Ej: "15/01/2026, 3:45 p. m."
 */
export function formatDateTimeColombia(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formatea una fecha a formato largo con hora en zona horaria Colombia
 * Ej: "15 de enero de 2026, 3:45 p. m."
 */
export function formatFullDateTimeColombia(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formatea una fecha a formato medio con hora en zona horaria Colombia
 * Ej: "15 ene 2026, 3:45 p. m."
 */
export function formatMediumDateTimeColombia(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formatea hora en formato 24 horas en zona horaria Colombia
 * Ej: "15:45"
 */
export function formatTime24Colombia(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// ==========================================
// 🕐 FUNCIONES SIN CONVERSIÓN TIMEZONE
// Usar para horas que YA vienen convertidas del backend
// ==========================================

/**
 * Formatea una hora (ya en hora local Colombia) a formato 12 horas con AM/PM
 * NO realiza ninguna conversión de timezone, solo formatea
 * Usar para horas que YA vienen convertidas del backend (como available_time_slots, next_available_times)
 * @param timeString - Hora en formato HH:mm (ya en hora Colombia)
 * @returns Hora formateada como "H:mm a.m./p.m."
 */
export function formatTimeToDisplay(timeString: string): string {
  if (!timeString) return timeString;
  
  try {
    // Si ya está formateada con AM/PM, retornarla sin modificar
    const lowerTime = timeString.toLowerCase();
    const normalizedTime = lowerTime.replace(/\u00A0/g, ' ');
    if (normalizedTime.includes('a. m.') || normalizedTime.includes('p. m.') || 
        normalizedTime.includes('am') || normalizedTime.includes('pm') ||
        normalizedTime.includes('a.m') || normalizedTime.includes('p.m') ||
        normalizedTime.includes(' m.')) {
      return timeString;
    }
    
    // Manejar diferentes formatos de hora
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    
    // Validar que sean números válidos
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Invalid time format:', timeString);
      return timeString;
    }
    
    // Formatear a 12 horas con AM/PM (SIN conversión de timezone)
    const period = hours >= 12 ? 'p.m.' : 'a.m.';
    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12; // 0 horas = 12 AM, 12 horas = 12 PM
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    console.warn('Error formatting time:', timeString, error);
    return timeString;
  }
}
