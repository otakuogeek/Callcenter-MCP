/**
 * Utilidades de fecha y hora para el módulo WhatsApp
 * @module whatsapp/utils/date
 */

import {
  formatDateTimeColombia,
  formatDateColombia,
  formatTimeColombia,
  formatFullDateColombia,
  getTodayColombia
} from '../../utils/dateUtils';

export { getTodayColombia };

/** Convierte fecha/hora UTC-0 a UTC-5 (Colombia) */
export function convertToColombiaTime(dateStr: string, timeStr: string): { date: string; time: string } {
  if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  utcDate.setUTCHours(utcDate.getUTCHours() - 5);

  const colYear = utcDate.getUTCFullYear();
  const colMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const colDay = String(utcDate.getUTCDate()).padStart(2, '0');
  const colHours = String(utcDate.getUTCHours()).padStart(2, '0');
  const colMinutes = String(utcDate.getUTCMinutes()).padStart(2, '0');

  return {
    date: `${colYear}-${colMonth}-${colDay}`,
    time: `${colHours}:${colMinutes}`
  };
}

/** Formatea fecha YYYY-MM-DD → DD/MM/YYYY */
export function formatDate(dateStr: string): string {
  if (!dateStr) return 'Fecha pendiente';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Formatea hora HH:MM → 8:00 a.m. */
export function formatTime(timeStr: string): string {
  if (!timeStr) return 'Hora pendiente';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

/** Formatea fecha para comparación humana: "10 de febrero" */
export function formatDateForComparison(dateStr: string): string {
  try {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    const month = months[date.getMonth()];
    return `${day} de ${month}`;
  } catch {
    return dateStr;
  }
}

/** Formatea hora para comparación: "2:00" */
export function formatTimeForComparison(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${hour12}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return timeStr;
  }
}

/** Obtiene la fecha/hora actual en Colombia como string amigable */
export function getCurrentDateTimeColombia(): string {
  return new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short'
  });
}

/** Obtiene la fecha/hora actual en formato ISO */
export function getCurrentISODateTime(): string {
  return new Date().toISOString().split('.')[0];
}

// ─── Normalización de resultados de herramientas (UTC→Colombia) ──────────────

const AMPM_REGEX = /(a\.?\s?m\.?|p\.?\s?m\.?|am|pm)/i;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/;

/** Recorre recursivamente un resultado de herramienta y añade campos *_colombia */
export function normalizeToolResultDatesForWhatsApp(result: any): any {
  const visited = new WeakMap<object, any>();

  const shouldSkipKey = (key?: string) => !!key && /local|colombia/i.test(key);

  const convertTimeOnly = (tv: string) => {
    const normalized = tv.length === 5 ? `${tv}:00` : tv;
    return formatTimeColombia(`1970-01-01 ${normalized}`);
  };

  const addColombiaFields = (out: any, key: string, value: string) => {
    if (shouldSkipKey(key) || AMPM_REGEX.test(value)) return;

    if (DATETIME_REGEX.test(value) || value.includes('T')) {
      out[`${key}_colombia`] = formatDateTimeColombia(value);
      out[`${key}_date_colombia`] = formatDateColombia(value);
      out[`${key}_time_colombia`] = formatTimeColombia(value);
      out[`${key}_full_date_colombia`] = formatFullDateColombia(value);
      return;
    }
    if (DATE_ONLY_REGEX.test(value)) {
      out[`${key}_colombia`] = formatDateColombia(value);
      out[`${key}_full_date_colombia`] = formatFullDateColombia(value);
      return;
    }
    if (TIME_ONLY_REGEX.test(value)) {
      out[`${key}_colombia`] = convertTimeOnly(value);
    }
  };

  const walk = (value: any, key?: string): any => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(item => walk(item));

    if (typeof value === 'object') {
      if (visited.has(value)) return visited.get(value);
      const out: any = {};
      visited.set(value, out);

      for (const [k, v] of Object.entries(value)) {
        if (v instanceof Date) {
          const iso = (v as Date).toISOString();
          out[k] = iso;
          addColombiaFields(out, k, iso);
          continue;
        }
        out[k] = walk(v, k);
        if (typeof v === 'string') addColombiaFields(out, k, v);
      }
      return out;
    }
    return value;
  };

  return walk(result);
}
