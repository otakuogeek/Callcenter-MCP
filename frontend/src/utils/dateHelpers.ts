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
