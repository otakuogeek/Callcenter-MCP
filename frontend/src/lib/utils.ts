import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🇨🇴 Zona horaria de Colombia
 * Todas las fechas del sistema se manejan en hora Colombia (UTC-5)
 */
export const COLOMBIA_TIMEZONE = 'America/Bogota';

/**
 * Parsea una fecha como si fuera hora Colombia, sin conversión de zona horaria
 * Útil para fechas que vienen del backend ya en hora Colombia
 */
export function parseAsColombiaTime(dateString: string | Date): Date {
  if (!dateString) return new Date();
  
  const dateStr = typeof dateString === 'string' ? dateString : dateString.toISOString();
  
  // Si la fecha tiene 'Z' o timezone, la parseamos y ajustamos a Colombia
  if (dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('T')) {
    // Crear fecha en UTC y convertir a Colombia
    const utcDate = new Date(dateStr);
    // Obtener la hora en Colombia usando Intl
    const colombiaStr = utcDate.toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE });
    return new Date(colombiaStr);
  }
  
  // Si es solo fecha (YYYY-MM-DD) o datetime sin timezone, tratarla como Colombia
  return new Date(dateStr.replace(' ', 'T'));
}

/**
 * Formatea una fecha en hora Colombia
 */
export function formatColombiaTime(date: string | Date, formatStr: string = 'HH:mm'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: COLOMBIA_TIMEZONE,
  };
  
  // Mapear formato simple a opciones de Intl
  if (formatStr === 'HH:mm') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  } else if (formatStr === 'HH:mm:ss') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
    options.hour12 = false;
  }
  
  return d.toLocaleTimeString('es-CO', options);
}

/**
 * Obtiene la fecha actual en Colombia
 */
export function getNowInColombia(): Date {
  const nowStr = new Date().toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE });
  return new Date(nowStr);
}

/**
 * Compara si una fecha es futura en hora Colombia
 */
export function isFutureInColombia(date: string | Date): boolean {
  const colombiaDate = parseAsColombiaTime(date);
  const nowColombia = getNowInColombia();
  return colombiaDate >= nowColombia;
}