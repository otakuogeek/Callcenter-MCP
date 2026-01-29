export const MCP_TIMEZONE = process.env.MCP_TIMEZONE || 'America/Bogota';

type DateTimeParts = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
};

function two(n: string | number): string {
  return String(n).padStart(2, '0');
}

export function getNowInTimeZone(timeZone: string = MCP_TIMEZONE): DateTimeParts {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  if (!year || !month || !day || !hour || !minute || !second) {
    const iso = now.toISOString();
    return {
      date: iso.split('T')[0],
      time: iso.split('T')[1].slice(0, 8)
    };
  }

  return {
    date: `${year}-${two(month)}-${two(day)}`,
    time: `${two(hour)}:${two(minute)}:${two(second)}`
  };
}

export function formatDateInTimeZone(date: Date, timeZone: string = MCP_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value;

  const year = get('year');
  const month = get('month');
  const day = get('day');

  if (!year || !month || !day) {
    return date.toISOString().split('T')[0];
  }

  return `${year}-${two(month)}-${two(day)}`;
}

/**
 * Convierte una fecha/hora de la base de datos (UTC-0) a la zona horaria local
 * @param dbDateTime - Fecha/hora de la base de datos (string o Date)
 * @param timeZone - Zona horaria destino (default: America/Bogota)
 * @returns Objeto con fecha, hora y datetime formateados para la zona horaria local
 */
export function convertDbToLocalTime(dbDateTime: string | Date, timeZone: string = MCP_TIMEZONE): {
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM:SS
  datetime: string;  // YYYY-MM-DD HH:MM:SS
  timeFormatted: string;  // HH:MM AM/PM
  dateFormatted: string;  // Día Mes Año (ej: 5 de enero de 2026)
} {
  // Si es string, parsearlo como UTC
  let dateObj: Date;
  if (typeof dbDateTime === 'string') {
    // Si viene en formato "YYYY-MM-DD HH:MM:SS" sin timezone, tratarlo como UTC
    const cleanDateTime = dbDateTime.replace('T', ' ').replace('Z', '');
    dateObj = new Date(cleanDateTime + 'Z'); // Agregar Z para indicar UTC
  } else {
    dateObj = dbDateTime;
  }
  
  // Formatear a la zona horaria local
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  
  const year = get('year') || '0000';
  const month = get('month') || '00';
  const day = get('day') || '00';
  const hour = get('hour') || '00';
  const minute = get('minute') || '00';
  const second = get('second') || '00';
  
  // Formatear hora en AM/PM
  const hourNum = parseInt(hour);
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const hour12 = hourNum === 0 ? 12 : (hourNum > 12 ? hourNum - 12 : hourNum);
  const timeFormatted = `${hour12}:${minute} ${ampm}`;
  
  // Formatear fecha legible en español
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthIndex = parseInt(month) - 1;
  const dateFormatted = `${parseInt(day)} de ${monthNames[monthIndex]} de ${year}`;
  
  return {
    date: `${year}-${month}-${day}`,
    time: `${two(hour)}:${two(minute)}:${two(second)}`,
    datetime: `${year}-${month}-${day} ${two(hour)}:${two(minute)}:${two(second)}`,
    timeFormatted,
    dateFormatted
  };
}

/**
 * Formatea una hora para mostrar al paciente de forma legible
 * @param dbDateTime - Fecha/hora de la base de datos (UTC-0)
 * @param timeZone - Zona horaria destino
 * @returns String legible para el paciente (ej: "9:15 AM del 5 de enero de 2026")
 */
export function formatAppointmentForPatient(dbDateTime: string | Date, timeZone: string = MCP_TIMEZONE): string {
  const local = convertDbToLocalTime(dbDateTime, timeZone);
  return `${local.timeFormatted} del ${local.dateFormatted}`;
}

/**
 * Convierte una hora almacenada en UTC-0 a hora local (UTC-5 para Colombia)
 * @param utcTime - Hora en formato HH:MM o HH:MM:SS (almacenada en UTC-0)
 * @param offsetHours - Diferencia horaria (default: -5 para Colombia)
 * @returns Hora convertida en formato HH:MM
 */
export function convertTimeFromUTC(utcTime: string, offsetHours: number = -5): string {
  if (!utcTime) return utcTime;
  
  // Parsear hora, minutos y segundos
  const parts = utcTime.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  
  // Aplicar offset
  hours = hours + offsetHours;
  
  // Manejar cambio de día
  if (hours < 0) {
    hours = 24 + hours; // Día anterior
  } else if (hours >= 24) {
    hours = hours - 24; // Día siguiente
  }
  
  return `${two(hours)}:${minutes}`;
}

/**
 * Convierte hora militar (HH:MM) a formato AM/PM
 * @param time24 - Hora en formato 24h (HH:MM)
 * @returns Hora en formato 12h con AM/PM (ej: "2:30 PM")
 */
export function formatTimeToAMPM(time24: string): string {
  if (!time24) return time24;
  
  const parts = time24.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12; // 0 horas = 12 AM, 12 horas = 12 PM
  
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Convierte hora UTC-0 a hora local en formato AM/PM
 * @param utcTime - Hora en UTC-0 (HH:MM:SS)
 * @param offsetHours - Diferencia horaria (default: -5 para Colombia)
 * @returns Hora en formato AM/PM (ej: "2:30 PM")
 */
export function convertTimeFromUTCtoAMPM(utcTime: string, offsetHours: number = -5): string {
  const localTime = convertTimeFromUTC(utcTime, offsetHours);
  return formatTimeToAMPM(localTime);
}

/**
 * Formatea un rango de tiempo (start - end) de UTC-0 a hora local en formato AM/PM
 * @param startTime - Hora de inicio en UTC-0 (HH:MM:SS)
 * @param endTime - Hora de fin en UTC-0 (HH:MM:SS)
 * @param offsetHours - Diferencia horaria (default: -5 para Colombia)
 * @returns String con el rango formateado "H:MM AM - H:MM PM"
 */
export function formatTimeRangeFromUTC(startTime: string, endTime: string, offsetHours: number = -5): string {
  const localStart = convertTimeFromUTCtoAMPM(startTime, offsetHours);
  const localEnd = convertTimeFromUTCtoAMPM(endTime, offsetHours);
  return `${localStart} - ${localEnd}`;
}
