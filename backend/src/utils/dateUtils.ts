/**
 * 🇨🇴 Utilidades de Fecha para Colombia (UTC-5)
 * 
 * Este módulo centraliza todas las conversiones de fecha/hora para asegurar
 * que las fechas almacenadas en MySQL (UTC-0) se conviertan correctamente
 * a la zona horaria de Colombia (UTC-5 / America/Bogota).
 * 
 * IMPORTANTE: 
 * - Campos DATETIME/TIMESTAMP: Se almacenan en UTC-0, se convierten a UTC-5
 * - Campos DATE (solo fecha): Se usan TAL CUAL, sin conversión de timezone
 */

export const COLOMBIA_TIMEZONE = 'America/Bogota';
export const COLOMBIA_LOCALE = 'es-CO';

/**
 * Detecta si un string es solo una fecha (YYYY-MM-DD) sin componente de hora
 */
function isDateOnly(str: string): boolean {
  // Formato YYYY-MM-DD exacto (10 caracteres)
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/**
 * Convierte un datetime de MySQL (UTC-0) a objeto Date interpretándolo como UTC
 * @param mysqlDatetime - Fecha de MySQL en formato 'YYYY-MM-DD HH:mm:ss' o Date
 * @returns Date object en UTC
 */
export function parseMySQLDatetime(mysqlDatetime: string | Date): Date {
  if (!mysqlDatetime) return new Date();
  
  if (mysqlDatetime instanceof Date) {
    return mysqlDatetime;
  }
  
  // Si ya tiene 'Z' o offset, parsearlo directamente
  if (mysqlDatetime.includes('Z') || mysqlDatetime.includes('+')) {
    return new Date(mysqlDatetime);
  }
  
  // Verificar si tiene offset al final (ej: +00:00 o -05:00)
  if (/[+-]\d{2}:\d{2}$/.test(mysqlDatetime)) {
    return new Date(mysqlDatetime);
  }
  
  // MySQL datetime sin timezone: interpretar como UTC
  // Reemplazar espacio por T y agregar Z para indicar UTC
  const isoString = mysqlDatetime.replace(' ', 'T') + 'Z';
  return new Date(isoString);
}

/**
 * 🆕 Formatea una fecha DATE (sin hora) directamente sin conversión de timezone
 * Para campos tipo DATE de MySQL que no necesitan conversión
 * Acepta string "YYYY-MM-DD" o objeto Date en UTC
 */
function formatDateOnlyDirect(dateInput: string | Date): { day: number; month: number; year: number; weekday: string } {
  let year: number, month: number, day: number;
  
  if (typeof dateInput === 'string') {
    // String: parsear directamente
    [year, month, day] = dateInput.split('-').map(Number);
  } else {
    // Date object: usar getUTC* para obtener la fecha sin cambio de timezone
    // MySQL2 devuelve Date con UTC (ej: 2026-02-08T00:00:00.000Z)
    year = dateInput.getUTCFullYear();
    month = dateInput.getUTCMonth() + 1;  // getUTCMonth es 0-indexed
    day = dateInput.getUTCDate();
  }
  
  // Crear fecha local (sin UTC) para obtener el día de la semana correcto
  const localDate = new Date(year, month - 1, day, 12, 0, 0);
  
  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  return {
    day,
    month,
    year,
    weekday: weekdays[localDate.getDay()]
  };
}

/**
 * Detecta si un objeto Date representa una fecha de medianoche UTC
 * (típico de campos DATE de MySQL devueltos por mysql2)
 */
function isDateObjectFromDateField(date: Date): boolean {
  // Los campos DATE de MySQL vienen como UTC medianoche: 2026-02-08T00:00:00.000Z
  return date.getUTCHours() === 0 && 
         date.getUTCMinutes() === 0 && 
         date.getUTCSeconds() === 0 && 
         date.getUTCMilliseconds() === 0;
}

/**
 * Formatea una fecha a formato corto DD/MM/YYYY
 * @param date - Fecha de MySQL o Date object
 * @returns Fecha formateada como 'DD/MM/YYYY'
 */
export function formatDateColombia(date: string | Date): string {
  if (!date) return '';
  
  // Caso 1: String en formato DATE (YYYY-MM-DD) - formatear directamente
  if (typeof date === 'string' && isDateOnly(date)) {
    const { day, month, year } = formatDateOnlyDirect(date);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  
  // Caso 2: Date object de campo DATE de MySQL (medianoche UTC)
  if (date instanceof Date && isDateObjectFromDateField(date)) {
    const { day, month, year } = formatDateOnlyDirect(date);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  
  // Caso 3: DATETIME - usar conversión de timezone
  const d = parseMySQLDatetime(date);
  return d.toLocaleDateString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formatea una fecha a formato largo
 * Ej: "lunes, 15 de enero de 2026"
 * IMPORTANTE: Si es DATE (solo fecha), se usa directamente sin conversión timezone
 * @param date - Fecha de MySQL o Date object
 * @returns Fecha formateada con día de semana, día, mes y año
 */
export function formatFullDateColombia(date: string | Date): string {
  if (!date) return '';
  
  const months = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  // Caso 1: String en formato DATE (YYYY-MM-DD) - formatear directamente
  if (typeof date === 'string' && isDateOnly(date)) {
    const { day, month, year, weekday } = formatDateOnlyDirect(date);
    return `${weekday}, ${day} de ${months[month]} de ${year}`;
  }
  
  // Caso 2: Date object de campo DATE de MySQL (medianoche UTC)
  if (date instanceof Date && isDateObjectFromDateField(date)) {
    const { day, month, year, weekday } = formatDateOnlyDirect(date);
    return `${weekday}, ${day} de ${months[month]} de ${year}`;
  }
  
  // Caso 3: DATETIME - usar conversión de timezone
  const d = parseMySQLDatetime(date);
  return d.toLocaleDateString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formatea hora en formato 12 horas con AM/PM en zona horaria Colombia
 * Ej: "3:45 p. m."
 * @param date - Fecha de MySQL o Date object
 * @returns Hora formateada como 'H:mm a. m./p. m.'
 */
export function formatTimeColombia(date: string | Date): string {
  if (!date) return '';
  const d = parseMySQLDatetime(date);
  return d.toLocaleTimeString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formatea hora en formato 24 horas en zona horaria Colombia
 * Ej: "15:45"
 * @param date - Fecha de MySQL o Date object
 * @returns Hora formateada como 'HH:mm'
 */
export function formatTime24Colombia(date: string | Date): string {
  if (!date) return '';
  const d = parseMySQLDatetime(date);
  return d.toLocaleTimeString(COLOMBIA_LOCALE, { 
    timeZone: COLOMBIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Formatea fecha y hora completa en zona horaria Colombia
 * Ej: "15/01/2026, 3:45 p. m."
 * @param date - Fecha de MySQL o Date object
 * @returns Fecha y hora formateadas
 */
export function formatDateTimeColombia(date: string | Date): string {
  if (!date) return '';
  const d = parseMySQLDatetime(date);
  return d.toLocaleString(COLOMBIA_LOCALE, { 
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
 * Obtiene la fecha actual en Colombia como string YYYY-MM-DD
 * Útil para comparaciones con fechas de la base de datos
 * @returns Fecha actual en Colombia como 'YYYY-MM-DD'
 */
export function getTodayColombia(): string {
  const now = new Date();
  const colombiaDate = new Date(now.toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE }));
  const year = colombiaDate.getFullYear();
  const month = String(colombiaDate.getMonth() + 1).padStart(2, '0');
  const day = String(colombiaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene la hora actual en Colombia
 * @returns Objeto con hour (0-23), minute (0-59), dayOfWeek (0-6)
 */
export function getCurrentTimeColombia(): { hour: number; minute: number; dayOfWeek: number } {
  const now = new Date();
  const colombiaDateStr = now.toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE });
  const colombiaDate = new Date(colombiaDateStr);
  return {
    hour: colombiaDate.getHours(),
    minute: colombiaDate.getMinutes(),
    dayOfWeek: colombiaDate.getDay()
  };
}

/**
 * Convierte una fecha Date a formato MySQL datetime string
 * SIN conversión de timezone (preserva la hora local)
 * @param date - Date object
 * @returns String en formato 'YYYY-MM-DD HH:mm:ss'
 */
export function formatDateForMySQL(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Extrae solo la parte de fecha de un datetime MySQL
 * sin problemas de zona horaria (no usa new Date())
 * @param mysqlDatetime - Fecha de MySQL en formato 'YYYY-MM-DD HH:mm:ss' o 'YYYY-MM-DD'
 * @returns Fecha como 'YYYY-MM-DD'
 */
export function extractDatePart(mysqlDatetime: string): string {
  if (!mysqlDatetime) return '';
  // Si tiene T o espacio, tomar solo la primera parte
  if (mysqlDatetime.includes('T')) {
    return mysqlDatetime.split('T')[0];
  }
  if (mysqlDatetime.includes(' ')) {
    return mysqlDatetime.split(' ')[0];
  }
  return mysqlDatetime;
}

/**
 * Extrae solo la parte de hora de un datetime MySQL
 * sin problemas de zona horaria (no usa new Date())
 * @param mysqlDatetime - Fecha de MySQL en formato 'YYYY-MM-DD HH:mm:ss'
 * @returns Hora como 'HH:mm'
 */
export function extractTimePart(mysqlDatetime: string): string {
  if (!mysqlDatetime) return '';
  let timePart = '';
  if (mysqlDatetime.includes('T')) {
    timePart = mysqlDatetime.split('T')[1];
  } else if (mysqlDatetime.includes(' ')) {
    timePart = mysqlDatetime.split(' ')[1];
  } else {
    return mysqlDatetime; // Asumir que ya es solo hora
  }
  // Remover Z o timezone si existe y tomar solo HH:mm
  return timePart.replace('Z', '').substring(0, 5);
}

/**
 * Verifica si una hora está dentro del horario comercial (Colombia)
 * @param date - Fecha/hora a verificar
 * @param startHour - Hora de inicio (default 7)
 * @param endHour - Hora de fin (default 19)
 * @returns true si está dentro del horario comercial
 */
export function isWithinBusinessHours(
  date: string | Date, 
  startHour: number = 7, 
  endHour: number = 19
): boolean {
  const d = parseMySQLDatetime(date);
  const colombiaDateStr = d.toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE });
  const colombiaDate = new Date(colombiaDateStr);
  const hour = colombiaDate.getHours();
  return hour >= startHour && hour < endHour;
}

/**
 * Verifica si una fecha es fin de semana en Colombia
 * @param date - Fecha a verificar
 * @returns true si es sábado o domingo
 */
export function isWeekendColombia(date: string | Date): boolean {
  const d = parseMySQLDatetime(date);
  const colombiaDateStr = d.toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE });
  const colombiaDate = new Date(colombiaDateStr);
  const dayOfWeek = colombiaDate.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

export function formatDateForMySQLUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function parseYMD(input: string): { year: number; month: number; day: number } {
  const datePart = String(input || '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) throw new Error(`Fecha inválida: ${input}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parseTimeToParts(input: string): { hour: number; minute: number; second: number } {
  const raw = String(input || '').trim();
  if (!raw) throw new Error(`Hora inválida: ${input}`);

  const normalized = raw
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const [timeToken, meridiemToken] = normalized.split(' ');
  const t = timeToken || normalized;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (!m) throw new Error(`Hora inválida: ${input}`);

  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] != null ? Number(m[3]) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) throw new Error(`Hora inválida: ${input}`);
  if (minute < 0 || minute > 59 || second < 0 || second > 59) throw new Error(`Hora inválida: ${input}`);

  const meridiem = meridiemToken || '';
  const isAM = meridiem.startsWith('a');
  const isPM = meridiem.startsWith('p');
  if (isAM || isPM) {
    if (hour < 1 || hour > 12) throw new Error(`Hora inválida: ${input}`);
    if (isPM && hour !== 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
  } else {
    if (hour < 0 || hour > 23) throw new Error(`Hora inválida: ${input}`);
  }

  return { hour, minute, second };
}

export function utcDateFromYMDAndUTCTime(dateYMD: string, time: string): Date {
  const { year, month, day } = parseYMD(dateYMD);
  const { hour, minute, second } = parseTimeToParts(time);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
}

export function utcDateFromYMDAndColombiaTime(dateYMD: string, time: string): Date {
  const { year, month, day } = parseYMD(dateYMD);
  const { hour, minute, second } = parseTimeToParts(time);
  let utcHour = hour + 5;
  let dayOffset = 0;
  if (utcHour >= 24) {
    utcHour -= 24;
    dayOffset = 1;
  }
  return new Date(Date.UTC(year, month - 1, day + dayOffset, utcHour, minute, second, 0));
}
