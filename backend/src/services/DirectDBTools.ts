/**
 * DirectDBTools - Herramientas directas a la base de datos para WhatsApp Bot
 * 
 * TABLAS CORRECTAS:
 * - patients: document, name (no first_name/last_name)
 * - doctors: name (no first_name/last_name)
 * - availabilities (no doctor_availabilities): date, capacity, booked_slots, status='Activa'
 * 
 * Mejoras v2.0:
 * - Reintentos automáticos en errores de conexión
 * - Mejor formateo de horarios (AM/PM)
 * - Validación de fechas (sin fines de semana)
 * - Logging mejorado
 */

import pool from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pino from 'pino';

const logger = pino({
  name: 'direct-db-tools',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// CONFIGURACIÓN DE REINTENTOS
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Ejecuta una función con reintentos automáticos
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Solo reintentar en errores de conexión
      const isRetryable = 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.message?.includes('timeout') ||
        error.message?.includes('Too many connections');
      
      if (!isRetryable || attempt === MAX_RETRIES) {
        logger.error({
          operation: operationName,
          attempt,
          error: error.message,
          code: error.code
        }, 'Operation failed (no more retries)');
        throw error;
      }
      
      logger.warn({
        operation: operationName,
        attempt,
        error: error.message,
        nextRetryMs: RETRY_DELAY_MS
      }, 'Operation failed, retrying...');
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  
  throw lastError;
}

// ============================================================================
// UTILIDADES DE FORMATO
// ============================================================================

/**
 * Extrae la cadena de hora UTC (HH:MM:SS) de un valor scheduled_at que puede ser Date o string
 */
function extractTimeFromScheduledAt(scheduledAt: any): string {
  if (scheduledAt instanceof Date) {
    return scheduledAt.toISOString().substring(11, 19);
  }
  const dateStr = String(scheduledAt);
  if (dateStr.includes('T')) {
    return dateStr.split('T')[1].substring(0, 8);
  } else if (dateStr.includes(' ')) {
    return dateStr.split(' ')[1].substring(0, 8);
  }
  return dateStr;
}

/**
 * Genera slots de tiempo disponibles para una agenda dada, excluyendo los ya ocupados.
 * Función DRY usada por getAvailableAppointments, getAvailableTimeSlots y getAvailableTimeSlotsForDoctorOnDate.
 */
function generateTimeSlots(
  startTimeUTC: string,
  endTimeUTC: string,
  durationMinutes: number,
  occupiedTimesUTC: Set<string>
): Array<{ time_colombia: string; time_utc: string; time_formatted: string }> {
  const slots: Array<{ time_colombia: string; time_utc: string; time_formatted: string }> = [];
  let currentTimeUTC = startTimeUTC + ':00';
  const endTimeUTCFull = endTimeUTC + ':00';
  
  while (currentTimeUTC < endTimeUTCFull) {
    const timeStrUTC = currentTimeUTC.substring(0, 5);
    
    // Verificar si este slot NO está ocupado (comparar en UTC)
    if (!occupiedTimesUTC.has(currentTimeUTC) && !occupiedTimesUTC.has(timeStrUTC + ':00')) {
      const timeColombiaStr = utcToColombiaTime(timeStrUTC);
      slots.push({
        time_colombia: timeColombiaStr,
        time_utc: timeStrUTC,
        time_formatted: formatColombiaTimeToAMPM(timeColombiaStr)
      });
    }
    
    // Avanzar al siguiente slot
    const [hours, minutes] = timeStrUTC.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    currentTimeUTC = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:00`;
  }
  
  return slots;
}

/**
 * Construye un Set de horarios ocupados a partir de citas existentes (para comparación UTC)
 */
function buildOccupiedTimesSet(existingAppts: RowDataPacket[]): Set<string> {
  const bookedTimesUTC = new Set<string>();
  for (const appt of existingAppts) {
    const timeStr = extractTimeFromScheduledAt(appt.scheduled_at || appt.scheduled_time);
    bookedTimesUTC.add(timeStr);
    bookedTimesUTC.add(timeStr.substring(0, 5) + ':00');
  }
  return bookedTimesUTC;
}

/**
 * Convierte hora UTC a hora Colombia (UTC-5)
 */
function utcToColombiaTime(utcTimeStr: string): string {
  // utcTimeStr formato: "HH:MM:SS" o "HH:MM"
  const parts = utcTimeStr.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  
  // Restar 5 horas para Colombia (UTC-5)
  hours = hours - 5;
  if (hours < 0) hours += 24;
  
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/**
 * Convierte hora Colombia a UTC (sumar 5 horas)
 */
function colombiaToUtcTime(colombiaTimeStr: string): string {
  // colombiaTimeStr formato: "HH:MM:SS" o "HH:MM"
  const parts = colombiaTimeStr.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  
  // Sumar 5 horas para convertir a UTC
  hours = hours + 5;
  if (hours >= 24) hours -= 24;
  
  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
}

function normalizePriorityLevel(priority?: string): 'Urgente' | 'Alta' | 'Normal' | 'Baja' {
  const value = (priority || '').trim().toLowerCase();
  if (value === 'urgente') return 'Urgente';
  if (value === 'alta') return 'Alta';
  if (value === 'baja') return 'Baja';
  return 'Normal';
}

/**
 * Convierte hora 24h a formato 12h AM/PM legible
 */
function formatTimeToAMPM(timeStr: string): string {
  if (!timeStr) return '';
  
  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; // Convertir 0 a 12 y 13-23 a 1-11
  
  return `${hours}:${minutes} ${period}`;
}

/**
 * Convierte hora Colombia (ya convertida de UTC) a formato AM/PM
 */
function formatColombiaTimeToAMPM(colombiaTimeStr: string): string {
  return formatTimeToAMPM(colombiaTimeStr);
}

/**
 * Valida si una fecha es válida para agendar (no fin de semana, no pasada)
 */
function isValidAppointmentDate(dateStr: string): { valid: boolean; error?: string } {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Verificar que no sea fecha pasada
  if (date < today) {
    return { valid: false, error: 'La fecha seleccionada ya pasó' };
  }
  
  // Verificar que no sea fin de semana
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { valid: false, error: 'No atendemos fines de semana. Por favor selecciona un día de lunes a viernes.' };
  }
  
  return { valid: true };
}

/**
 * Formatea fecha a formato legible en español
 */
function formatDateToSpanish(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
}

// ============================================================================
// BÚSQUEDA DE PACIENTE
// ============================================================================

export async function searchPatient(args: { document: string }): Promise<any> {
  return withRetry(async () => {
  const startTime = Date.now();
  const document = args.document?.toString().replace(/\D/g, '');
  
  if (!document) {
    logger.warn('searchPatient called without document');
    return { success: false, error: 'Número de documento requerido' };
  }

  logger.info({ document }, 'searchPatient: searching for patient');

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          p.id,
          p.document,
          p.name,
          p.phone,
          p.email,
          p.birth_date,
          p.gender,
          p.insurance_eps_id,
          e.name AS eps_name
        FROM patients p
        LEFT JOIN eps e ON p.insurance_eps_id = e.id
        WHERE p.document = ?
        LIMIT 1
      `, [document]);

      const elapsed = Date.now() - startTime;
      logger.info({ document, elapsed, found: rows.length > 0, rowCount: rows.length }, 'searchPatient completed');

      if (rows.length > 0) {
        const patient = rows[0];
        return {
          success: true,
          data: {
            found: true,
            patient: {
              id: patient.id,
              document: patient.document,
              name: patient.name,
              full_name: patient.name,
              phone: patient.phone,
              email: patient.email,
              birth_date: patient.birth_date,
              gender: patient.gender,
              insurance_eps_id: patient.insurance_eps_id,
              eps_name: patient.eps_name
            }
          }
        };
      } else {
        return {
          success: true,
          data: { found: false, message: 'Paciente no encontrado' }
        };
      }
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, document, stack: error.stack }, 'searchPatient error');
    return { success: false, error: error.message };
  }
  }, 'searchPatient');
}

// ============================================================================
// DISPONIBILIDAD DE CITAS
// ============================================================================

export async function getAvailableAppointments(args: { 
  specialty_name?: string; 
  specialty_id?: number;
  location_id?: number;
  eps_id?: number;
}): Promise<any> {
  return withRetry(async () => {
  const startTime = Date.now();
  
  logger.info({ args }, 'getAvailableAppointments: fetching availability');

  try {
    const connection = await pool.getConnection();
    try {
      // MEJORA: Excluir fecha de hoy (solo desde mañana) y solo con cupos disponibles
      // Igual que el portal: schedule.date > todayStr && available_slots > 0
      let whereClause = "WHERE a.date > CURDATE() AND a.status = 'Activa' AND (a.is_paused = 0 OR a.is_paused IS NULL) AND (a.capacity - a.booked_slots) > 0";
      const params: any[] = [];

      if (args.specialty_name) {
        // COLLATE para normalizar acentos (Odontologia = Odontología)
        whereClause += ' AND s.name COLLATE utf8mb4_unicode_ci LIKE ?';
        params.push(`%${args.specialty_name}%`);
      }
      if (args.specialty_id) {
        whereClause += ' AND a.specialty_id = ?';
        params.push(args.specialty_id);
      }
      if ((args as any).location_id) {
        whereClause += ' AND a.location_id = ?';
        params.push((args as any).location_id);
      }
      // NUEVO: Filtrar por autorizaciones EPS (igual que portal web)
      if (args.eps_id) {
        whereClause += ` AND EXISTS (
          SELECT 1 FROM eps_specialty_location_authorizations esla
          WHERE esla.eps_id = ? 
            AND esla.specialty_id = a.specialty_id 
            AND esla.location_id = a.location_id 
            AND esla.authorized = 1
            AND (esla.valid_until IS NULL OR esla.valid_until >= CURDATE())
        )`;
        params.push(args.eps_id);
      }

      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.id AS availability_id,
          DATE_FORMAT(a.date, '%Y-%m-%d') AS appointment_date,
          a.start_time,
          a.end_time,
          a.capacity AS slots_total,
          (a.capacity - a.booked_slots) AS slots_available,
          a.duration_minutes,
          a.specialty_id,
          s.name AS specialty_name,
          a.doctor_id,
          d.name AS doctor_name,
          a.location_id,
          l.name AS location_name,
          l.address AS location_address,
          (SELECT COUNT(*) FROM appointments_waiting_list awl 
           WHERE awl.availability_id = a.id AND awl.status = 'pending') AS waiting_list_count
        FROM availabilities a
        JOIN specialties s ON a.specialty_id = s.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN locations l ON a.location_id = l.id
        ${whereClause}
        ORDER BY a.date ASC, a.start_time ASC
        LIMIT 50
      `, params);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length, args }, 'getAvailableAppointments completed');

      // ============================================================================
      // CALCULAR SLOTS ESPECÍFICOS DISPONIBLES PARA CADA AGENDA
      // ============================================================================
      
      // Obtener todas las citas existentes para las availabilities
      const availabilityIds = rows.map(r => r.availability_id);
      let existingAppointments: RowDataPacket[] = [];
      
      if (availabilityIds.length > 0) {
        const placeholders = availabilityIds.map(() => '?').join(',');
        const [appts] = await connection.execute<RowDataPacket[]>(`
          SELECT availability_id, TIME(scheduled_at) as scheduled_time
          FROM appointments
          WHERE availability_id IN (${placeholders}) AND status NOT IN ('Cancelada', 'Pendiente')
        `, availabilityIds);
        existingAppointments = appts;
      }
      
      // Crear un Set de slots ocupados por availability_id
      const occupiedSlots: { [key: number]: Set<string> } = {};
      for (const appt of existingAppointments) {
        if (!occupiedSlots[appt.availability_id]) {
          occupiedSlots[appt.availability_id] = new Set();
        }
        // El scheduled_time viene en UTC
        const timeStr = String(appt.scheduled_time).substring(0, 5);
        occupiedSlots[appt.availability_id].add(timeStr);
        occupiedSlots[appt.availability_id].add(timeStr + ':00');
      }
      
      // Agrupar por especialidad CON SLOTS REALES (usa generateTimeSlots DRY)
      const bySpecialty: { [key: string]: any[] } = {};
      for (const row of rows) {
        const specName = row.specialty_name;
        if (!bySpecialty[specName]) {
          bySpecialty[specName] = [];
        }
        // Convertir horarios de UTC a Colombia
        const startTimeStr = typeof row.start_time === 'string' ? row.start_time : String(row.start_time);
        const endTimeStr = typeof row.end_time === 'string' ? row.end_time : String(row.end_time);
        const startTimeUTC = startTimeStr.substring(0, 5);
        const endTimeUTC = endTimeStr.substring(0, 5);
        const startTimeColombia = utcToColombiaTime(startTimeUTC);
        const endTimeColombia = utcToColombiaTime(endTimeUTC);
        const durationMinutes = row.duration_minutes || 20;
        
        // Generar slots disponibles para esta agenda usando función DRY
        const occupiedSet = occupiedSlots[row.availability_id] || new Set();
        const availableSlots = generateTimeSlots(startTimeUTC, endTimeUTC, durationMinutes, occupiedSet);
        
        bySpecialty[specName].push({
          availability_id: row.availability_id,
          appointment_date: row.appointment_date,
          appointment_date_formatted: formatDateToSpanish(row.appointment_date),
          start_time: startTimeColombia,  // Ahora en hora Colombia
          end_time: endTimeColombia,      // Ahora en hora Colombia
          start_time_formatted: formatTimeToAMPM(startTimeColombia),
          end_time_formatted: formatTimeToAMPM(endTimeColombia),
          slots_total: row.slots_total,
          slots_available: row.slots_available,
          duration_minutes: row.duration_minutes,
          specialty_id: row.specialty_id,
          specialty_name: row.specialty_name,
          doctor_id: row.doctor_id,
          doctor_name: row.doctor_name,
          location_id: row.location_id,
          location_name: row.location_name,
          location_address: row.location_address,
          waiting_list_count: row.waiting_list_count || 0,
          // SLOTS ESPECÍFICOS DISPONIBLES
          horarios_disponibles: availableSlots.map(s => s.time_formatted),
          horarios_24h: availableSlots.map(s => s.time_colombia)
        });
      }

      // Calcular doctores únicos para ayudar al modelo
      const uniqueDoctors = [...new Set(rows.map(r => r.doctor_name))];
      const doctorsSummary = uniqueDoctors.map(doctorName => {
        const doctorAppts = rows.filter(r => r.doctor_name === doctorName);
        return {
          doctor_name: doctorName,
          total_appointments: doctorAppts.length,
          dates: [...new Set(doctorAppts.map(a => a.appointment_date))],
          dates_formatted: [...new Set(doctorAppts.map(a => formatDateToSpanish(a.appointment_date)))],
          locations: [...new Set(doctorAppts.map(a => a.location_name))]
        };
      });

      logger.info({ uniqueDoctorsCount: uniqueDoctors.length, doctors: uniqueDoctors }, 'getAvailableAppointments: unique doctors found');

      // Generar lista simplificada para mostrar al usuario CON HORARIOS REALES
      const opcionesParaMostrar = rows.map((r, index) => {
        const startTimeStr = typeof r.start_time === 'string' ? r.start_time : String(r.start_time);
        const endTimeStr = typeof r.end_time === 'string' ? r.end_time : String(r.end_time);
        const startTimeUTC = startTimeStr.substring(0, 5);
        const endTimeUTC = endTimeStr.substring(0, 5);
        const startTimeColombia = utcToColombiaTime(startTimeUTC);
        const durationMinutes = r.duration_minutes || 20;
        
        // Obtener los slots disponibles usando función DRY
        const occupiedSet = occupiedSlots[r.availability_id] || new Set();
        const availableSlots = generateTimeSlots(startTimeUTC, endTimeUTC, durationMinutes, occupiedSet);
        
        return {
          opcion: index + 1,
          texto_para_mostrar: `${formatDateToSpanish(r.appointment_date)} - ${r.location_name}`,
          availability_id: r.availability_id,
          fecha: formatDateToSpanish(r.appointment_date),
          fecha_iso: r.appointment_date,
          // Alias para compatibilidad con código de state management
          appointment_date: r.appointment_date,
          appointment_date_formatted: formatDateToSpanish(r.appointment_date),
          hora_inicio: formatTimeToAMPM(startTimeColombia),
          start_time_formatted: formatTimeToAMPM(startTimeColombia),
          doctor: r.doctor_name,
          doctor_name: r.doctor_name,
          doctor_id: r.doctor_id,
          sede: r.location_name,
          location_name: r.location_name,
          direccion_sede: r.location_address,
          cupos: r.slots_available,
          slots_available: r.slots_available,
          specialty_id: r.specialty_id,
          specialty_name: r.specialty_name,
          // ⭐ HORARIOS EXACTOS DISPONIBLES - USA SOLO ESTOS
          horarios_disponibles: availableSlots.map(s => s.time_formatted),
          horarios_24h: availableSlots.map(s => s.time_colombia)
        };
      });

      return {
        success: true,
        data: {
          total: rows.length,
          unique_doctors_count: uniqueDoctors.length,
          unique_doctors: uniqueDoctors,
          
          // Lista principal con HORARIOS EXACTOS DISPONIBLES
          opciones_disponibles: opcionesParaMostrar,
          
          doctors_summary: doctorsSummary,
          timezone: 'America/Bogota (UTC-5)',
          // Mantener appointments como alias compacto para compatibilidad
          appointments: opcionesParaMostrar
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getAvailableAppointments error');
    return { success: false, error: error.message };
  }
  }, 'getAvailableAppointments');
}

// ============================================================================
// HORARIOS DISPONIBLES
// ============================================================================

export async function getAvailableTimeSlots(args: { 
  availability_id: number;
  duration_minutes?: number;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'getAvailableTimeSlots: fetching time slots');

  try {
    const connection = await pool.getConnection();
    try {
      // Obtener la disponibilidad con fecha formateada como string
      // ⚠️ FILTRO DE FECHA: Solo permitir agendas de hoy o futuras
      const [availRows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.id,
          DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
          a.start_time,
          a.end_time,
          a.capacity,
          a.booked_slots,
          a.duration_minutes,
          a.specialty_id,
          a.doctor_id,
          a.location_id,
          s.name AS specialty_name,
          d.name AS doctor_name,
          l.name AS location_name,
          (a.capacity - a.booked_slots) AS slots_available
        FROM availabilities a
        JOIN specialties s ON a.specialty_id = s.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN locations l ON a.location_id = l.id
        WHERE a.id = ? AND a.date >= CURDATE()
      `, [args.availability_id]);

      if (availRows.length === 0) {
        return { success: false, error: 'Disponibilidad no encontrada' };
      }

      const avail = availRows[0];
      const durationMinutes = args.duration_minutes || avail.duration_minutes || 20;

      // Obtener citas existentes usando la fecha como string
      const [existingAppts] = await connection.execute<RowDataPacket[]>(`
        SELECT scheduled_at, duration_minutes
        FROM appointments
        WHERE availability_id = ? AND status NOT IN ('Cancelada', 'Pendiente')
        AND DATE(scheduled_at) = ?
      `, [args.availability_id, avail.date]);

      // Extraer las horas ya reservadas (en UTC)
      const bookedTimesUTC = new Set(existingAppts.map((a: any) => {
        if (a.scheduled_at instanceof Date) {
          return a.scheduled_at.toTimeString().substring(0, 8);
        }
        const dateStr = String(a.scheduled_at);
        if (dateStr.includes('T')) {
          return dateStr.split('T')[1].substring(0, 8);
        }
        if (dateStr.includes(' ')) {
          return dateStr.split(' ')[1].substring(0, 8);
        }
        return dateStr;
      }));

      // Los horarios en availabilities están en UTC, convertir a Colombia para mostrar
      const startTimeUTC = typeof avail.start_time === 'string' 
        ? avail.start_time.substring(0, 5) 
        : String(avail.start_time).substring(0, 5);
      const endTimeUTC = typeof avail.end_time === 'string' 
        ? avail.end_time.substring(0, 5) 
        : String(avail.end_time).substring(0, 5);

      logger.info({ 
        startTimeUTC, 
        endTimeUTC,
        startTimeColombia: utcToColombiaTime(startTimeUTC),
        endTimeColombia: utcToColombiaTime(endTimeUTC)
      }, 'Time conversion UTC -> Colombia');

      // Generar slots en UTC y luego convertir a Colombia para mostrar
      const slotsForDisplay: Array<{time_colombia: string, time_utc: string, scheduled_datetime: string}> = [];
      
      let currentTimeUTC = startTimeUTC + ':00';
      const endTimeUTCFull = endTimeUTC + ':00';

      while (currentTimeUTC < endTimeUTCFull) {
        const timeStrUTC = currentTimeUTC.substring(0, 5);
        
        // Verificar si este slot está ocupado
        if (!bookedTimesUTC.has(currentTimeUTC) && !bookedTimesUTC.has(timeStrUTC + ':00')) {
          const timeColombiaStr = utcToColombiaTime(timeStrUTC);
          
          // La fecha ya viene como string desde SQL (YYYY-MM-DD)
          const dateStr = avail.date;
          
          slotsForDisplay.push({
            time_colombia: timeColombiaStr,
            time_utc: timeStrUTC,
            scheduled_datetime: `${dateStr} ${currentTimeUTC}`  // Para guardar en BD
          });
        }

        // Avanzar al siguiente slot
        const [hours, minutes] = timeStrUTC.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + durationMinutes;
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        currentTimeUTC = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:00`;
      }

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, slotsCount: slotsForDisplay.length }, 'getAvailableTimeSlots completed');

      return {
        success: true,
        data: {
          availability_id: avail.id,
          appointment_date: avail.date,  // Ya es string YYYY-MM-DD
          appointment_date_formatted: formatDateToSpanish(avail.date),  // NUEVO: Fecha legible
          specialty_name: avail.specialty_name,
          doctor_name: avail.doctor_name,
          location_name: avail.location_name,
          slots_available: avail.slots_available,
          duration_minutes: durationMinutes,
          // Ahora devolvemos los horarios en hora Colombia para mostrar al usuario
          available_times: slotsForDisplay.map(s => s.time_colombia),
          // Horarios formateados en AM/PM para mostrar al usuario
          available_times_formatted: slotsForDisplay.map(s => formatColombiaTimeToAMPM(s.time_colombia)),
          // También incluimos la info completa para el agendamiento
          slots_detail: slotsForDisplay.map(s => ({
            ...s,
            time_formatted: formatColombiaTimeToAMPM(s.time_colombia)  // NUEVO: Hora en AM/PM
          })),
          timezone: 'America/Bogota',
          note: 'Horarios mostrados en hora Colombia (UTC-5). La fecha ya es correcta.'
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getAvailableTimeSlots error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// HORARIOS DISPONIBLES PARA DOCTOR EN FECHA ESPECÍFICA
// ============================================================================

/**
 * Obtiene TODOS los slots disponibles para un doctor en una fecha específica.
 * Combina múltiples agendas del mismo día y verifica qué slots ya están ocupados.
 * 
 * IMPORTANTE: Esta función resuelve el problema de ofrecer slots ocupados
 * cuando hay múltiples agendas del mismo doctor en un día.
 */
export async function getAvailableTimeSlotsForDoctorOnDate(args: {
  doctor_id?: number;
  doctor_name?: string;
  date: string;  // Formato YYYY-MM-DD
  specialty_id?: number;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'getAvailableTimeSlotsForDoctorOnDate: fetching slots');

  if (!args.date) {
    return { success: false, error: 'La fecha es requerida' };
  }

  // VALIDACIÓN: Rechazar fechas pasadas
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requestedDate = new Date(args.date + 'T00:00:00');
  if (requestedDate < today) {
    return { success: false, error: 'No se pueden consultar disponibilidades en fechas pasadas' };
  }

  if (!args.doctor_id && !args.doctor_name) {
    return { success: false, error: 'Se requiere doctor_id o doctor_name' };
  }

  try {
    const connection = await pool.getConnection();
    try {
      // FIX: Usar a.date = ? en lugar de DATE_FORMAT() para permitir uso de índice
      let whereClause = "WHERE a.date = ? AND a.status = 'Activa' AND (a.is_paused = 0 OR a.is_paused IS NULL)";
      const params: any[] = [args.date];

      if (args.doctor_id) {
        whereClause += ' AND a.doctor_id = ?';
        params.push(args.doctor_id);
      } else if (args.doctor_name) {
        whereClause += ' AND d.name LIKE ?';
        params.push(`%${args.doctor_name}%`);
      }

      if (args.specialty_id) {
        whereClause += ' AND a.specialty_id = ?';
        params.push(args.specialty_id);
      }

      const [availRows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.id AS availability_id,
          DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
          a.start_time,
          a.end_time,
          a.capacity,
          a.booked_slots,
          a.duration_minutes,
          a.specialty_id,
          a.doctor_id,
          a.location_id,
          s.name AS specialty_name,
          d.name AS doctor_name,
          l.name AS location_name,
          (a.capacity - a.booked_slots) AS slots_available
        FROM availabilities a
        JOIN specialties s ON a.specialty_id = s.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN locations l ON a.location_id = l.id
        ${whereClause}
        ORDER BY a.start_time ASC
      `, params);

      if (availRows.length === 0) {
        return { 
          success: true, 
          data: {
            available_times: [],
            available_times_formatted: [],
            message: 'No hay agendas disponibles para este doctor en esta fecha'
          }
        };
      }

      // FIX N+1: Obtener TODAS las citas existentes para TODAS las agendas en un solo query batch
      const activeAvailIds = availRows
        .filter(a => a.slots_available > 0)
        .map(a => a.availability_id);
      
      // Mapa de citas ocupadas por availability_id
      const occupiedByAvailability = new Map<number, Set<string>>();
      
      if (activeAvailIds.length > 0) {
        const placeholders = activeAvailIds.map(() => '?').join(',');
        const [existingAppts] = await connection.execute<RowDataPacket[]>(`
          SELECT availability_id, scheduled_at, duration_minutes
          FROM appointments
          WHERE availability_id IN (${placeholders}) AND status NOT IN ('Cancelada', 'Pendiente')
        `, activeAvailIds);

        // Agrupar por availability_id
        for (const appt of existingAppts) {
          if (!occupiedByAvailability.has(appt.availability_id)) {
            occupiedByAvailability.set(appt.availability_id, new Set());
          }
          const timeStr = extractTimeFromScheduledAt(appt.scheduled_at);
          occupiedByAvailability.get(appt.availability_id)!.add(timeStr);
          occupiedByAvailability.get(appt.availability_id)!.add(timeStr.substring(0, 5) + ':00');
        }
      }

      // Generar slots para cada agenda usando la función DRY
      const allSlots: Array<{
        time_colombia: string;
        time_utc: string;
        time_formatted: string;
        availability_id: number;
        specialty_name: string;
        location_name: string;
        scheduled_datetime: string;
      }> = [];

      let totalSlotsAvailable = 0;
      const agendaSummary: Array<{
        availability_id: number;
        start_time: string;
        end_time: string;
        slots_available: number;
        slots_total: number;
        is_full: boolean;
      }> = [];

      for (const avail of availRows) {
        const durationMinutes = avail.duration_minutes || 20;
        const startTimeUTC = String(avail.start_time).substring(0, 5);
        const endTimeUTC = String(avail.end_time).substring(0, 5);
        
        if (avail.slots_available <= 0) {
          agendaSummary.push({
            availability_id: avail.availability_id,
            start_time: utcToColombiaTime(startTimeUTC),
            end_time: utcToColombiaTime(endTimeUTC),
            slots_available: 0,
            slots_total: avail.capacity,
            is_full: true
          });
          continue;
        }

        // Usar la función DRY para generar slots
        const occupiedSet = occupiedByAvailability.get(avail.availability_id) || new Set();
        const slots = generateTimeSlots(startTimeUTC, endTimeUTC, durationMinutes, occupiedSet);
        
        for (const slot of slots) {
          allSlots.push({
            ...slot,
            availability_id: avail.availability_id,
            specialty_name: avail.specialty_name,
            location_name: avail.location_name,
            scheduled_datetime: `${avail.date} ${slot.time_utc}:00`
          });
          totalSlotsAvailable++;
        }

        agendaSummary.push({
          availability_id: avail.availability_id,
          start_time: utcToColombiaTime(startTimeUTC),
          end_time: utcToColombiaTime(endTimeUTC),
          slots_available: slots.length,
          slots_total: avail.capacity,
          is_full: slots.length === 0
        });
      }

      // Ordenar slots por hora
      allSlots.sort((a, b) => a.time_colombia.localeCompare(b.time_colombia));

      const elapsed = Date.now() - startTime;
      logger.info({ 
        elapsed, 
        totalSlots: allSlots.length,
        agendasProcessed: availRows.length,
      }, 'getAvailableTimeSlotsForDoctorOnDate completed');

      if (allSlots.length === 0) {
        return {
          success: true,
          data: {
            available_times: [],
            available_times_formatted: [],
            total_slots_available: 0,
            message: 'No hay horarios disponibles para este doctor en esta fecha. Todas las agendas están completas.',
            agendas_summary: agendaSummary,
            doctor_name: availRows[0]?.doctor_name,
            date: args.date,
            date_formatted: formatDateToSpanish(args.date)
          }
        };
      }

      return {
        success: true,
        data: {
          doctor_name: availRows[0].doctor_name,
          doctor_id: availRows[0].doctor_id,
          specialty_name: availRows[0].specialty_name,
          location_name: availRows[0].location_name,
          date: args.date,
          date_formatted: formatDateToSpanish(args.date),
          total_slots_available: totalSlotsAvailable,
          available_times: allSlots.map(s => s.time_colombia),
          available_times_formatted: allSlots.map(s => s.time_formatted),
          slots_detail: allSlots,
          agendas_summary: agendaSummary,
          timezone: 'America/Bogota',
          note: 'Horarios verificados contra citas existentes. Solo se muestran slots realmente disponibles.'
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getAvailableTimeSlotsForDoctorOnDate error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// AGENDAR CITA
// ============================================================================

export async function scheduleAppointment(args: {
  availability_id?: number;
  patient_id: number;
  specialty_id?: number;
  scheduled_time?: string;
  scheduled_datetime?: string;
  scheduled_date?: string;
  reason?: string;
  priority_level?: string;
  cups_code?: string;
  cups_manual_name?: string;
  create_double_appointment?: boolean;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'scheduleAppointment: creating appointment with extended options');

  return withRetry(async () => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Modo híbrido: si no hay availability_id, registrar en lista de espera por especialidad
      if (!args.availability_id) {
        await connection.rollback();

        if (!args.specialty_id) {
          return {
            success: false,
            error: 'Para agendar se requiere availability_id, o specialty_id para lista de espera.'
          };
        }

        const waitingBySpecialty = await addToWaitingList({
          patient_id: args.patient_id,
          specialty_id: args.specialty_id,
          priority_level: args.priority_level,
          reason: args.reason
        });

        if (!waitingBySpecialty.success) {
          return waitingBySpecialty;
        }

        return {
          ...waitingBySpecialty,
          waiting_list: true,
          data: {
            ...(waitingBySpecialty.data || {}),
            waiting_mode: 'specialty'
          }
        };
      }

      // Obtener disponibilidad
      const [availRows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.*,
          d.id AS doctor_id,
          d.name AS doctor_name,
          s.name AS specialty_name,
          l.name AS location_name,
          (a.capacity - a.booked_slots) AS slots_available
        FROM availabilities a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN specialties s ON a.specialty_id = s.id
        JOIN locations l ON a.location_id = l.id
        WHERE a.id = ?
        FOR UPDATE
      `, [args.availability_id]);

      if (availRows.length === 0) {
        await connection.rollback();
        return { success: false, error: 'Disponibilidad no encontrada' };
      }

      const avail = availRows[0];

      // ⚠️ VALIDACIÓN: No permitir agendar en fechas pasadas
      const availDate = avail.date instanceof Date 
        ? avail.date 
        : new Date(String(avail.date).split('T')[0] + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (availDate < today) {
        await connection.rollback();
        return { success: false, error: 'No se puede agendar en una fecha pasada. Por favor seleccione una fecha futura.' };
      }

      // Verificar si hay cupos
      if (avail.slots_available <= 0) {
        await connection.rollback();

        const waitingForAvailability = await addToWaitingList({
          patient_id: args.patient_id,
          specialty_id: avail.specialty_id,
          availability_id: args.availability_id,
          priority_level: args.priority_level,
          reason: args.reason || ''
        });

        if (!waitingForAvailability.success) {
          return waitingForAvailability;
        }

        return {
          ...waitingForAvailability,
          waiting_list: true,
          data: {
            ...(waitingForAvailability.data || {}),
            specialty_name: avail.specialty_name,
            location_name: avail.location_name,
            waiting_mode: 'availability'
          }
        };
      }

      // Determinar hora de la cita
      // Aceptar tanto scheduled_datetime como scheduled_date (alias usado por WhatsApp)
      const effectiveDatetime = args.scheduled_datetime || args.scheduled_date;
      let scheduledTime = args.scheduled_time;
      if (effectiveDatetime) {
        // Extraer hora de scheduled_datetime (formato: "YYYY-MM-DD HH:MM" o solo "HH:MM")
        const match = effectiveDatetime.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          scheduledTime = `${match[1].padStart(2, '0')}:${match[2]}:00`;
          logger.info({ effectiveDatetime, extractedTime: scheduledTime }, 'scheduleAppointment: hora extraída de scheduled_date/datetime');
        }
      }
      if (!scheduledTime) {
        scheduledTime = avail.start_time;
        logger.warn({ fallback: avail.start_time }, 'scheduleAppointment: usando start_time de la agenda como fallback');
      }

      // Calcular hora de fin
      const duration = avail.duration_minutes || 20;

      // Formatear fecha para scheduled_at
      const dateStr = avail.date instanceof Date 
        ? avail.date.toISOString().split('T')[0]
        : String(avail.date).split('T')[0];

      // Buscar CUPS si se proporcionó
      let cups_id = null;
      if (args.cups_code) {
        const [cupsRows] = await connection.execute<RowDataPacket[]>(`
          SELECT id FROM cups WHERE code = ? AND is_active = 1 LIMIT 1
        `, [args.cups_code.trim()]);
        
        if (cupsRows.length > 0) {
          cups_id = cupsRows[0].id;
          logger.info({ cups_code: args.cups_code, cups_id }, 'CUPS found');
        } else if (args.cups_manual_name) {
          // Registrar CUPS manualmente si no existe
          const [insertResult] = await connection.execute<ResultSetHeader>(`
            INSERT INTO cups (code, name, is_active) 
            VALUES (?, ?, 1)
          `, [args.cups_code.trim(), args.cups_manual_name]);
          cups_id = insertResult.insertId;
          logger.info({ cups_code: args.cups_code, cups_id, manual: true }, 'CUPS registered manually');
        }
      }

      // PROTECCIÓN: Verificar que el slot específico no esté ya ocupado (race condition)
      const [existingSlot] = await connection.execute<RowDataPacket[]>(`
        SELECT id FROM appointments 
        WHERE availability_id = ? AND scheduled_at = ? AND status NOT IN ('Cancelada', 'Pendiente')
        LIMIT 1
      `, [args.availability_id, `${dateStr} ${scheduledTime}`]);

      if (existingSlot.length > 0) {
        await connection.rollback();
        return { 
          success: false, 
          error: `El horario ${formatColombiaTimeToAMPM(utcToColombiaTime(scheduledTime.substring(0, 5)))} ya fue tomado. Por favor elige otro horario.`
        };
      }

      // PROTECCIÓN: Verificar cita duplicada — mismo paciente, misma especialidad, cualquier cita futura activa
      // ESTANDARIZADO con portal web (patients-updated.ts) que verifica scheduled_at >= NOW()
      const [duplicatePatient] = await connection.execute<RowDataPacket[]>(`
        SELECT ap.id, ap.scheduled_at, d.name AS doctor_name,
          DATE_FORMAT(ap.scheduled_at, '%Y-%m-%d') AS appointment_date,
          TIME_FORMAT(ap.scheduled_at, '%H:%i') AS appointment_time_utc
        FROM appointments ap
        JOIN doctors d ON ap.doctor_id = d.id
        WHERE ap.patient_id = ? 
          AND ap.specialty_id = ?
          AND ap.status IN ('Confirmada', 'Pendiente')
          AND ap.scheduled_at >= NOW()
        LIMIT 1
      `, [args.patient_id, avail.specialty_id]);

      if (duplicatePatient.length > 0) {
        await connection.rollback();
        const existingDate = duplicatePatient[0].appointment_date;
        const existingTimeUTC = duplicatePatient[0].appointment_time_utc;
        const existingTimeColombia = existingTimeUTC ? formatColombiaTimeToAMPM(utcToColombiaTime(existingTimeUTC)) : '';
        const existingDoctor = duplicatePatient[0].doctor_name;
        const existingId = duplicatePatient[0].id;
        return { 
          success: false, 
          duplicate: true,
          existing_appointment: {
            appointment_id: existingId,
            doctor_name: existingDoctor,
            appointment_date: existingDate,
            appointment_date_formatted: formatDateToSpanish(existingDate),
            scheduled_time: existingTimeColombia
          },
          error: `Ya tienes una cita de ${avail.specialty_name} programada para el ${formatDateToSpanish(existingDate)} a las ${existingTimeColombia} con ${existingDoctor} (Cita #${existingId}). Debes cancelar o completar esa cita antes de agendar otra en la misma especialidad.`
        };
      }

      // Insertar cita usando scheduled_at (datetime completo)
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO appointments 
        (patient_id, doctor_id, specialty_id, location_id, availability_id, 
         scheduled_at, duration_minutes, reason, cups_id, status, appointment_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmada', 'Sistema_Inteligente')
      `, [
        args.patient_id,
        avail.doctor_id,
        avail.specialty_id,
        avail.location_id,
        args.availability_id,
        `${dateStr} ${scheduledTime}`,
        duration,
        args.reason || '',
        cups_id
      ]);

      const appointmentId = result.insertId;

      // Actualizar booked_slots
      await connection.execute(`
        UPDATE availabilities 
        SET booked_slots = booked_slots + 1 
        WHERE id = ?
      `, [args.availability_id]);

      // Si se solicita cita doble, crear segunda cita consecutiva
      let secondAppointmentId = null;
      if (args.create_double_appointment) {
        try {
          // Calcular hora de la segunda cita (siguiente slot)
          const [hours, minutes] = scheduledTime.split(':').map(Number);
          const nextMinutes = minutes + duration;
          const nextHours = hours + Math.floor(nextMinutes / 60);
          const nextTime = `${String(nextHours).padStart(2, '0')}:${String(nextMinutes % 60).padStart(2, '0')}:00`;

          // Verificar que aún hay cupos
          const [checkSlots] = await connection.execute<RowDataPacket[]>(`
            SELECT (capacity - booked_slots) AS slots_available 
            FROM availabilities WHERE id = ?
          `, [args.availability_id]);

          if (checkSlots[0].slots_available > 0) {
            const [secondResult] = await connection.execute<ResultSetHeader>(`
              INSERT INTO appointments (
                patient_id, doctor_id, specialty_id, location_id, availability_id,
                scheduled_at, duration_minutes, reason, cups_id, status, appointment_source
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmada', 'Sistema_Inteligente')
            `, [
              args.patient_id,
              avail.doctor_id,
              avail.specialty_id,
              avail.location_id,
              args.availability_id,
              `${dateStr} ${nextTime}`,
              duration,
              `${args.reason || ''} (cita doble)`,
              cups_id
            ]);

            secondAppointmentId = secondResult.insertId;

            // Actualizar booked_slots nuevamente
            await connection.execute(`
              UPDATE availabilities 
              SET booked_slots = booked_slots + 1 
              WHERE id = ?
            `, [args.availability_id]);

            logger.info({ secondAppointmentId, nextTime }, 'Second appointment created (double booking)');
          } else {
            logger.warn('Cannot create second appointment: no slots available');
          }
        } catch (doubleError: any) {
          logger.error({ error: doubleError.message }, 'Error creating double appointment');
          // No fallar toda la transacción, la primera cita ya está creada
        }
      }

      await connection.commit();

      const elapsed = Date.now() - startTime;
      logger.info({ 
        appointmentId, 
        secondAppointmentId,
        elapsed,
        patientId: args.patient_id,
        scheduledTime,
        isDouble: !!secondAppointmentId,
        hasCUPS: !!cups_id
      }, 'Appointment(s) scheduled successfully');

      // Obtener info del paciente
      const [patientRows] = await connection.execute<RowDataPacket[]>(`
        SELECT name, phone FROM patients WHERE id = ?
      `, [args.patient_id]);

      const patient = patientRows[0] || {};

      // Obtener info de CUPS si existe
      let cupsInfo = null;
      if (cups_id) {
        const [cupsData] = await connection.execute<RowDataPacket[]>(`
          SELECT code, name FROM cups WHERE id = ?
        `, [cups_id]);
        if (cupsData.length > 0) {
          cupsInfo = cupsData[0];
        }
      }

      // Convertir hora UTC a hora Colombia para mostrar al usuario
      const scheduledTimeColombia = utcToColombiaTime(scheduledTime);
      const scheduledTimeFormatted = formatColombiaTimeToAMPM(scheduledTimeColombia);

      return {
        success: true,
        data: {
          appointment_id: appointmentId,
          second_appointment_id: secondAppointmentId,
          is_double_appointment: !!secondAppointmentId,
          patient_name: patient.name,
          patient_phone: patient.phone,
          doctor_name: avail.doctor_name,
          specialty_name: avail.specialty_name,
          location_name: avail.location_name,
          location_address: avail.location_address,
          appointment_date: dateStr,
          scheduled_time: scheduledTime,
          scheduled_time_colombia: scheduledTimeColombia,
          scheduled_time_formatted: scheduledTimeFormatted,
          scheduled_at: `${dateStr} ${scheduledTime}`,
          duration_minutes: duration,
          reason: args.reason,
          status: 'Confirmada',
          cups_info: cupsInfo
        }
      };
    } catch (error: any) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'scheduleAppointment error');
    return { success: false, error: error.message };
  }
  }, 'scheduleAppointment');
}

// ============================================================================
// REGISTRAR PACIENTE
// ============================================================================

export async function registerPatientSimple(args: {
  document: string;
  name: string;
  phone?: string;
  eps_id?: number;
  birth_date?: string;
  gender?: string;
  email?: string;
  municipality_name?: string;
  address?: string;
  city?: string;
  zone_id?: string;
}): Promise<any> {
  return withRetry(async () => {
  const startTime = Date.now();
  const document = args.document?.toString().replace(/\D/g, '');
  
  if (!document || !args.name) {
    return { success: false, error: 'Documento y nombre son requeridos' };
  }

  logger.info({ document, name: args.name }, 'registerPatientSimple: registering patient with extended fields');

  try {
    const connection = await pool.getConnection();
    try {
      // Verificar si ya existe
      const [existing] = await connection.execute<RowDataPacket[]>(`
        SELECT id FROM patients WHERE document = ?
      `, [document]);

      if (existing.length > 0) {
        return { 
          success: false, 
          error: 'El paciente ya existe',
          existing_patient_id: existing[0].id
        };
      }

      // Buscar municipality_id si se proporcionó city
      let municipality_id = null;
      if (args.city && args.city.trim() !== '') {
        const [municipalities] = await connection.execute<RowDataPacket[]>(`
          SELECT id FROM municipalities WHERE name LIKE ? LIMIT 1
        `, [`%${args.city.trim()}%`]);
        municipality_id = municipalities[0]?.id || null;
        if (municipality_id) {
          logger.info({ city: args.city, municipality_id }, 'Municipality found');
        }
      }

      // Convertir zone_id de string a int
      const zone_id_int = args.zone_id && args.zone_id !== '' ? parseInt(args.zone_id) : null;

      // Insertar nuevo paciente con todos los campos
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO patients (
          document, document_type_id, name, birth_date, gender,
          phone, email, address, municipality_id, insurance_eps_id,
          zone_id, status, created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', NOW())
      `, [
        document,
        args.name,
        args.birth_date || null,
        args.gender || 'No especificado',
        args.phone || null,
        args.email || null,
        args.address || null,
        municipality_id,
        args.eps_id || null,
        zone_id_int
      ]);

      const elapsed = Date.now() - startTime;
      logger.info({ 
        patientId: result.insertId, 
        elapsed,
        document,
        fieldsProvided: Object.keys(args).length
      }, 'Patient registered successfully with extended data');

      return {
        success: true,
        data: {
          patient_id: result.insertId,
          document: document,
          name: args.name,
          phone: args.phone,
          eps_id: args.eps_id,
          birth_date: args.birth_date,
          gender: args.gender,
          email: args.email,
          municipality_id
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'registerPatientSimple error');
    return { success: false, error: error.message };
  }
  }, 'registerPatientSimple');
}

// ============================================================================
// LISTAR EPS ACTIVAS (con caché in-memory, TTL 5 minutos)
// ============================================================================

const EPS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let epsCacheData: any = null;
let epsCacheTimestamp = 0;

export async function listActiveEPS(): Promise<any> {
  // Retornar caché si aún es válida
  const now = Date.now();
  if (epsCacheData && (now - epsCacheTimestamp) < EPS_CACHE_TTL_MS) {
    return epsCacheData;
  }

  const startTime = Date.now();
  
  logger.info('listActiveEPS: fetching active EPS list');

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT id, name, code
        FROM eps
        WHERE status = 'active' AND has_agreement = 1
        ORDER BY name ASC
      `);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length }, 'listActiveEPS completed');

      const result = {
        success: true,
        data: {
          total: rows.length,
          eps_list: rows.map(r => ({
            id: r.id,
            name: r.name,
            code: r.code
          }))
        }
      };

      // Guardar en caché
      epsCacheData = result;
      epsCacheTimestamp = Date.now();

      return result;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'listActiveEPS error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BUSCAR EPS POR NOMBRE EN TODA LA TABLA (activas e inactivas)
// ============================================================================
export async function findEPSByName(searchName: string): Promise<any> {
  const startTime = Date.now();
  logger.info({ searchName }, 'findEPSByName: searching all EPS');

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT id, name, status, has_agreement
        FROM eps
        ORDER BY name ASC
      `);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length }, 'findEPSByName completed');

      const normalizedSearch = searchName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const match = (rows as any[]).find((e: any) => {
        const normalizedName = e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName);
      });

      if (match) {
        return {
          success: true,
          found: true,
          eps: {
            id: match.id,
            name: match.name,
            status: match.status,
            has_agreement: match.has_agreement,
            isActive: match.status === 'active' && match.has_agreement === 1
          }
        };
      }

      return { success: true, found: false };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'findEPSByName error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// OBTENER ESPECIALIDADES AUTORIZADAS POR EPS
// ============================================================================

export async function getAuthorizedSpecialtiesForEPS(args: {
  eps_id: number;
}): Promise<any> {
  const startTime = Date.now();
  const { eps_id } = args;
  
  logger.info({ eps_id }, 'getAuthorizedSpecialtiesForEPS: fetching authorized specialties');

  try {
    const connection = await pool.getConnection();
    try {
      // Obtener nombre de la EPS
      const [epsRows] = await connection.execute<RowDataPacket[]>(`
        SELECT name FROM eps WHERE id = ?
      `, [eps_id]);

      if (epsRows.length === 0) {
        return { success: false, error: 'EPS no encontrada' };
      }

      // Obtener especialidades autorizadas (usa la vista v_eps_authorizations que valida fechas)
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT DISTINCT 
          specialty_id,
          specialty_name
        FROM v_eps_authorizations
        WHERE eps_id = ? AND authorized = 1 AND is_currently_valid = 1
        ORDER BY specialty_name
      `, [eps_id]);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length, eps_id }, 'getAuthorizedSpecialtiesForEPS completed');

      return {
        success: true,
        eps_id,
        eps_name: epsRows[0].name,
        authorized_specialties: rows,
        total: rows.length,
        message: rows.length > 0 
          ? `Encontradas ${rows.length} especialidades autorizadas`
          : 'No hay especialidades autorizadas para esta EPS'
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getAuthorizedSpecialtiesForEPS error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// OBTENER SEDES AUTORIZADAS PARA PACIENTE
// ============================================================================

export async function getAuthorizedLocationsForPatient(args: {
  eps_id: number;
  specialty_id: number;
  zone_id?: number;
}): Promise<any> {
  const startTime = Date.now();
  const { eps_id, specialty_id, zone_id } = args;
  
  logger.info({ eps_id, specialty_id, zone_id }, 'getAuthorizedLocationsForPatient: fetching locations');

  try {
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT DISTINCT 
          location_id,
          location_name,
          municipality_id AS zone_id
        FROM v_eps_authorizations
        WHERE eps_id = ? 
          AND specialty_id = ?
          AND authorized = 1
          AND is_currently_valid = 1
      `;
      
      const params: any[] = [eps_id, specialty_id];
      
      if (zone_id) {
        query += ` AND municipality_id = ?`;
        params.push(zone_id);
      }
      
      query += ` ORDER BY location_name`;
      
      const [rows] = await connection.execute<RowDataPacket[]>(query, params);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length }, 'getAuthorizedLocationsForPatient completed');

      return {
        success: true,
        locations: rows,
        total: rows.length,
        message: rows.length > 0
          ? `Encontradas ${rows.length} sedes autorizadas`
          : 'No hay sedes autorizadas para esta combinación'
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getAuthorizedLocationsForPatient error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// OBTENER INFORMACIÓN DE CÓDIGO CUPS
// ============================================================================

export async function getCUPSInfo(args: {
  cups_code: string;
}): Promise<any> {
  const startTime = Date.now();
  const cups_code = args.cups_code?.toString().trim();
  
  if (!cups_code) {
    return { success: false, error: 'Código CUPS es requerido' };
  }

  logger.info({ cups_code }, 'getCUPSInfo: fetching CUPS information');

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          id AS cups_id,
          code AS cups_code,
          name AS cups_name,
          description
        FROM cups
        WHERE code = ? AND is_active = 1
        LIMIT 1
      `, [cups_code]);

      const elapsed = Date.now() - startTime;

      if (rows.length === 0) {
        logger.info({ elapsed, cups_code }, 'CUPS not found');
        return {
          success: false,
          error: 'Código CUPS no encontrado',
          cups_code,
          suggestion: 'Proporcione el nombre del examen para registrarlo manualmente'
        };
      }

      logger.info({ elapsed, cups_id: rows[0].cups_id }, 'getCUPSInfo completed');

      return {
        success: true,
        cups_data: rows[0]
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getCUPSInfo error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BUSCAR ESPECIALIDADES
// ============================================================================

export async function searchSpecialties(args: { query?: string }): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'searchSpecialties: searching specialties');

  try {
    const connection = await pool.getConnection();
    try {
      // MEJORA: Solo especialidades con cupos reales disponibles (desde mañana)
      // Igual que el portal: solo muestra especialidades donde hay al menos 1 cupo
      let sql = `
        SELECT DISTINCT s.id, s.name, s.description, s.allows_double_appointment
        FROM specialties s
        JOIN availabilities a ON s.id = a.specialty_id
        WHERE a.status = 'Activa' 
          AND a.date > CURDATE() 
          AND (a.is_paused = 0 OR a.is_paused IS NULL)
          AND (a.capacity - a.booked_slots) > 0
      `;
      const params: any[] = [];

      if (args.query) {
        sql += ' AND s.name LIKE ?';
        params.push(`%${args.query}%`);
      }

      sql += ' ORDER BY s.name ASC';

      const [rows] = await connection.execute<RowDataPacket[]>(sql, params);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length }, 'searchSpecialties completed');

      return {
        success: true,
        data: {
          total: rows.length,
          specialties: rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            allows_double_appointment: Boolean(r.allows_double_appointment)
          }))
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'searchSpecialties error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// OBTENER CITAS DEL PACIENTE
// ============================================================================

export async function getPatientAppointments(args: { 
  patient_id?: number; 
  document?: string;
  status?: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'getPatientAppointments: fetching patient appointments');

  try {
    const connection = await pool.getConnection();
    try {
      let patientId = args.patient_id;

      // Si no hay patient_id pero hay document, buscar el paciente
      if (!patientId && args.document) {
        const [patientRows] = await connection.execute<RowDataPacket[]>(`
          SELECT id FROM patients WHERE document = ?
        `, [args.document.replace(/\D/g, '')]);

        if (patientRows.length === 0) {
          return { success: false, error: 'Paciente no encontrado' };
        }
        patientId = patientRows[0].id;
      }

      if (!patientId) {
        return { success: false, error: 'Se requiere patient_id o document' };
      }

      let sql = `
        SELECT 
          a.id AS appointment_id,
          a.specialty_id,
          DATE_FORMAT(a.scheduled_at, '%Y-%m-%d') AS scheduled_date,
          DATE_FORMAT(a.scheduled_at, '%H:%i') AS scheduled_time,
          DATE_FORMAT(DATE_ADD(a.scheduled_at, INTERVAL a.duration_minutes MINUTE), '%H:%i') AS end_time,
          a.status,
          a.reason,
          'whatsapp' AS source,
          s.name AS specialty_name,
          d.name AS doctor_name,
          l.name AS location_name
        FROM appointments a
        JOIN specialties s ON a.specialty_id = s.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN locations l ON a.location_id = l.id
        WHERE a.patient_id = ?
      `;
      const params: any[] = [patientId];

      if (args.status) {
        sql += ' AND a.status = ?';
        params.push(args.status);
      }

      sql += ' ORDER BY a.scheduled_at DESC LIMIT 20';

      const [rows] = await connection.execute<RowDataPacket[]>(sql, params);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length, patientId }, 'getPatientAppointments completed');

      return {
        success: true,
        data: {
          total: rows.length,
          appointments: rows.map(r => ({
            appointment_id: r.appointment_id,
            specialty_id: r.specialty_id,
            scheduled_date: r.scheduled_date,
            scheduled_time: r.scheduled_time,
            end_time: r.end_time,
            status: r.status,
            reason: r.reason,
            source: r.source,
            specialty_name: r.specialty_name,
            doctor_name: r.doctor_name,
            location_name: r.location_name
          }))
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getPatientAppointments error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CANCELAR CITA
// ============================================================================

export async function cancelAppointment(args: {
  appointment_id: number;
  reason?: string;
  cancellation_reason?: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'cancelAppointment: cancelling appointment');

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Obtener la cita
      const [apptRows] = await connection.execute<RowDataPacket[]>(`
        SELECT a.*, p.name AS patient_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE a.id = ?
        FOR UPDATE
      `, [args.appointment_id]);

      if (apptRows.length === 0) {
        await connection.rollback();
        return { success: false, error: 'Cita no encontrada' };
      }

      const appt = apptRows[0];

      if (appt.status === 'Cancelada') {
        await connection.rollback();
        return { success: false, error: 'La cita ya está cancelada' };
      }

      // Cancelar la cita
      await connection.execute(`
        UPDATE appointments 
        SET status = 'Cancelada', 
            cancellation_reason = ?
        WHERE id = ?
      `, [args.reason || args.cancellation_reason || 'Cancelada por paciente', args.appointment_id]);

      // Restaurar cupo en disponibilidad
      if (appt.availability_id) {
        await connection.execute(`
          UPDATE availabilities 
          SET booked_slots = GREATEST(0, booked_slots - 1) 
          WHERE id = ?
        `, [appt.availability_id]);

        try {
          await connection.execute(`CALL process_waiting_list_for_availability(?)`, [appt.availability_id]);
          logger.info({ availabilityId: appt.availability_id }, 'Waiting list processed after cancellation');
        } catch (waitingListError: any) {
          logger.warn({ error: waitingListError.message, availabilityId: appt.availability_id }, 'Could not process waiting list after cancellation');
        }
      }

      await connection.commit();

      const elapsed = Date.now() - startTime;
      logger.info({ 
        appointmentId: args.appointment_id, 
        elapsed 
      }, 'Appointment cancelled successfully');

      return {
        success: true,
        data: {
          appointment_id: args.appointment_id,
          patient_name: appt.patient_name,
          scheduled_at: appt.scheduled_at,
          status: 'Cancelada',
          message: 'Cita cancelada exitosamente'
        }
      };
    } catch (error: any) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'cancelAppointment error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// ACTUALIZAR TELÉFONO
// ============================================================================

export async function actualizarPhone(args: {
  patient_id?: number;
  document?: string;
  phone: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'actualizarPhone: updating patient phone');

  if (!args.patient_id && !args.document) {
    return { success: false, error: 'Se requiere patient_id o document' };
  }

  try {
    const connection = await pool.getConnection();
    try {
      // Limpiar teléfono
      let phone = args.phone?.toString().replace(/[^\d+]/g, '');
      if (phone && !phone.startsWith('+')) {
        if (phone.startsWith('57')) {
          phone = '+' + phone;
        } else if (phone.length === 10) {
          phone = '+57' + phone;
        }
      }

      // Soportar búsqueda por document si no viene patient_id
      let patientId = args.patient_id;
      if (!patientId && args.document) {
        const doc = args.document.toString().replace(/\D/g, '');
        const [rows] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM patients WHERE document = ? LIMIT 1', [doc]
        );
        if (rows.length === 0) {
          return { success: false, error: 'Paciente no encontrado con ese documento' };
        }
        patientId = rows[0].id;
      }

      await connection.execute(`
        UPDATE patients SET phone = ? WHERE id = ?
      `, [phone, patientId]);

      const elapsed = Date.now() - startTime;
      logger.info({ patientId: args.patient_id, elapsed }, 'Phone updated successfully');

      return {
        success: true,
        data: {
          patient_id: args.patient_id,
          phone: phone,
          message: 'Teléfono actualizado exitosamente'
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'actualizarPhone error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// VERIFICAR SLOTS CONSECUTIVOS (para cita doble)
// ============================================================================

export async function checkConsecutiveSlots(args: {
  availability_id: number;
  selected_time: string; // Hora en formato Colombia HH:MM
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'checkConsecutiveSlots: verifying consecutive slots');

  try {
    // Obtener todos los slots disponibles
    const slotsResult = await getAvailableTimeSlots({ availability_id: args.availability_id });
    
    if (!slotsResult.success || !slotsResult.data?.slots_detail) {
      return { success: false, error: 'No se pudieron obtener los slots disponibles' };
    }

    const slots = slotsResult.data.slots_detail;
    const selectedTimeColombia = args.selected_time;
    
    // Ordenar slots cronológicamente
    const sortedSlots = [...slots].sort((a, b) => {
      const [ha, ma] = a.time_colombia.split(':').map(Number);
      const [hb, mb] = b.time_colombia.split(':').map(Number);
      return (ha * 60 + ma) - (hb * 60 + mb);
    });

    // Encontrar el índice del slot seleccionado
    const selectedIndex = sortedSlots.findIndex(s => s.time_colombia === selectedTimeColombia);
    
    if (selectedIndex === -1) {
      return { 
        success: true, 
        data: { 
          consecutive_available: false, 
          reason: 'Hora seleccionada no encontrada en slots disponibles' 
        } 
      };
    }

    if (selectedIndex >= sortedSlots.length - 1) {
      return { 
        success: true, 
        data: { 
          consecutive_available: false, 
          reason: 'Es el último slot disponible, no hay consecutivo' 
        } 
      };
    }

    const nextSlot = sortedSlots[selectedIndex + 1];
    const durationMinutes = slotsResult.data.duration_minutes || 20;

    // Verificar que el siguiente slot esté dentro del intervalo esperado
    const [selH, selM] = selectedTimeColombia.split(':').map(Number);
    const [nextH, nextM] = nextSlot.time_colombia.split(':').map(Number);
    const actualInterval = (nextH * 60 + nextM) - (selH * 60 + selM);

    // El siguiente slot debe estar dentro del intervalo de duración (con margen de 5 min)
    const isConsecutive = actualInterval > 0 && actualInterval <= durationMinutes + 5;

    const elapsed = Date.now() - startTime;
    logger.info({ 
      elapsed, 
      isConsecutive, 
      selectedTime: selectedTimeColombia, 
      nextTime: nextSlot.time_colombia 
    }, 'checkConsecutiveSlots completed');

    return {
      success: true,
      data: {
        consecutive_available: isConsecutive,
        selected_time: selectedTimeColombia,
        next_consecutive_time: isConsecutive ? nextSlot.time_colombia : null,
        next_consecutive_datetime: isConsecutive ? nextSlot.scheduled_datetime : null,
        duration_minutes: durationMinutes,
        interval_detected: actualInterval
      }
    };
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'checkConsecutiveSlots error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// AGENDAR CITA DOBLE (dos citas consecutivas)
// ============================================================================

export async function scheduleDoubleAppointment(args: {
  availability_id: number;
  patient_id: number;
  scheduled_time_1: string; // Primera hora en Colombia
  scheduled_time_2: string; // Segunda hora en Colombia
  reason?: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'scheduleDoubleAppointment: creating double appointment');

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Obtener disponibilidad
      const [availRows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.*,
          d.id AS doctor_id,
          d.name AS doctor_name,
          s.name AS specialty_name,
          l.name AS location_name,
          (a.capacity - a.booked_slots) AS slots_available
        FROM availabilities a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN specialties s ON a.specialty_id = s.id
        JOIN locations l ON a.location_id = l.id
        WHERE a.id = ?
        FOR UPDATE
      `, [args.availability_id]);

      if (availRows.length === 0) {
        await connection.rollback();
        return { success: false, error: 'Disponibilidad no encontrada' };
      }

      const avail = availRows[0];

      // Verificar si hay AL MENOS 2 cupos disponibles
      if (avail.slots_available < 2) {
        await connection.rollback();
        return { 
          success: false, 
          error: `Solo hay ${avail.slots_available} cupo(s) disponible(s). Se necesitan 2 para cita doble.`,
          single_slot_available: avail.slots_available === 1
        };
      }

      const duration = avail.duration_minutes || 20;
      const dateStr = avail.date instanceof Date 
        ? avail.date.toISOString().split('T')[0]
        : String(avail.date).split('T')[0];

      // Convertir horas de Colombia a UTC para guardar
      const scheduledTimeUTC1 = colombiaToUtcTime(args.scheduled_time_1);
      const scheduledTimeUTC2 = colombiaToUtcTime(args.scheduled_time_2);

      // Calcular hora de fin para cada cita
      const calculateEndTime = (startTime: string) => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60);
        const endMinutes = totalMinutes % 60;
        return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`;
      };

      const reason1 = `${args.reason || `Consulta de ${avail.specialty_name}`} - CITA DOBLE (1/2)`;
      const reason2 = `${args.reason || `Consulta de ${avail.specialty_name}`} - CITA DOBLE (2/2)`;

      // Insertar primera cita
      const [result1] = await connection.execute<ResultSetHeader>(`
        INSERT INTO appointments 
        (patient_id, doctor_id, specialty_id, location_id, availability_id, 
         scheduled_at, duration_minutes, reason, status, appointment_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Confirmada', 'Sistema_Inteligente')
      `, [
        args.patient_id,
        avail.doctor_id,
        avail.specialty_id,
        avail.location_id,
        args.availability_id,
        `${dateStr} ${scheduledTimeUTC1}`,
        duration,
        reason1
      ]);

      // Insertar segunda cita
      const [result2] = await connection.execute<ResultSetHeader>(`
        INSERT INTO appointments 
        (patient_id, doctor_id, specialty_id, location_id, availability_id, 
         scheduled_at, duration_minutes, reason, status, appointment_source, related_appointment_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Confirmada', 'Sistema_Inteligente', ?)
      `, [
        args.patient_id,
        avail.doctor_id,
        avail.specialty_id,
        avail.location_id,
        args.availability_id,
        `${dateStr} ${scheduledTimeUTC2}`,
        duration,
        reason2,
        result1.insertId // Relacionar con primera cita
      ]);

      // Actualizar primera cita con referencia a la segunda
      await connection.execute(`
        UPDATE appointments SET related_appointment_id = ? WHERE id = ?
      `, [result2.insertId, result1.insertId]);

      // Actualizar booked_slots (+2)
      await connection.execute(`
        UPDATE availabilities 
        SET booked_slots = booked_slots + 2 
        WHERE id = ?
      `, [args.availability_id]);

      await connection.commit();

      const elapsed = Date.now() - startTime;
      logger.info({ 
        appointmentId1: result1.insertId,
        appointmentId2: result2.insertId,
        elapsed 
      }, 'Double appointment scheduled successfully');

      // Obtener info del paciente
      const [patientRows] = await connection.execute<RowDataPacket[]>(`
        SELECT name, phone FROM patients WHERE id = ?
      `, [args.patient_id]);

      const patient = patientRows[0] || {};

      return {
        success: true,
        double_appointment: true,
        data: {
          appointment_1: {
            appointment_id: result1.insertId,
            scheduled_time: args.scheduled_time_1,
            reason: reason1
          },
          appointment_2: {
            appointment_id: result2.insertId,
            scheduled_time: args.scheduled_time_2,
            reason: reason2
          },
          patient_name: patient.name,
          doctor_name: avail.doctor_name,
          specialty_name: avail.specialty_name,
          location_name: avail.location_name,
          appointment_date: dateStr,
          duration_minutes: duration,
          message: `Cita doble agendada: ${args.scheduled_time_1} y ${args.scheduled_time_2}`
        }
      };
    } catch (error: any) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'scheduleDoubleAppointment error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// AGREGAR A LISTA DE ESPERA
// ============================================================================

export async function addToWaitingList(args: {
  patient_id: number;
  specialty_id: number;
  availability_id?: number;
  priority_level?: string;
  reason?: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'addToWaitingList: adding patient to waiting list');

  try {
    const connection = await pool.getConnection();
    try {
      // Verificar que el paciente existe
      const [patientRows] = await connection.execute<RowDataPacket[]>(`
        SELECT id, name FROM patients WHERE id = ?
      `, [args.patient_id]);

      if (patientRows.length === 0) {
        return { success: false, error: 'Paciente no encontrado' };
      }

      // Verificar si ya está en lista de espera para esta especialidad
      const [existingRows] = await connection.execute<RowDataPacket[]>(`
        SELECT id FROM appointments_waiting_list 
        WHERE patient_id = ? AND specialty_id = ? AND status = 'pending'
      `, [args.patient_id, args.specialty_id]);

      if (existingRows.length > 0) {
        // Ya está en lista, obtener posición
        const [positionRows] = await connection.execute<RowDataPacket[]>(`
          SELECT COUNT(*) + 1 AS position
          FROM appointments_waiting_list wl2
          INNER JOIN appointments_waiting_list wlx ON wlx.id = ?
          WHERE wl2.status = 'pending'
            AND (
              (wlx.availability_id IS NOT NULL AND wl2.availability_id = wlx.availability_id)
              OR (wlx.availability_id IS NULL AND wl2.availability_id IS NULL AND wl2.specialty_id = wlx.specialty_id)
            )
            AND (
              CASE UPPER(TRIM(wl2.priority_level))
                WHEN 'URGENTE' THEN 1
                WHEN 'ALTA' THEN 2
                WHEN 'NORMAL' THEN 3
                WHEN 'BAJA' THEN 4
                ELSE 3
              END
              <
              CASE UPPER(TRIM(wlx.priority_level))
                WHEN 'URGENTE' THEN 1
                WHEN 'ALTA' THEN 2
                WHEN 'NORMAL' THEN 3
                WHEN 'BAJA' THEN 4
                ELSE 3
              END
              OR (
                CASE UPPER(TRIM(wl2.priority_level))
                  WHEN 'URGENTE' THEN 1
                  WHEN 'ALTA' THEN 2
                  WHEN 'NORMAL' THEN 3
                  WHEN 'BAJA' THEN 4
                  ELSE 3
                END
                =
                CASE UPPER(TRIM(wlx.priority_level))
                  WHEN 'URGENTE' THEN 1
                  WHEN 'ALTA' THEN 2
                  WHEN 'NORMAL' THEN 3
                  WHEN 'BAJA' THEN 4
                  ELSE 3
                END
                AND wl2.created_at < wlx.created_at
              )
            )
        `, [existingRows[0].id]);

        return {
          success: true,
          already_in_list: true,
          data: {
            waiting_list_id: existingRows[0].id,
            queue_position: positionRows[0].position,
            message: `Ya estás en la lista de espera en la posición ${positionRows[0].position}`
          }
        };
      }

      // Obtener nombre de especialidad
      const [specRows] = await connection.execute<RowDataPacket[]>(`
        SELECT name FROM specialties WHERE id = ?
      `, [args.specialty_id]);

      const specialtyName = specRows.length > 0 ? specRows[0].name : 'Especialidad';

      const normalizedPriority = normalizePriorityLevel(args.priority_level);

      // Insertar en lista de espera
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO appointments_waiting_list 
        (patient_id, specialty_id, availability_id, priority_level, reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', NOW())
      `, [
        args.patient_id,
        args.specialty_id,
        args.availability_id || null,
        normalizedPriority,
        args.reason || `Consulta de ${specialtyName}`
      ]);

      // Obtener posición
      const [positionRows] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) + 1 AS position
        FROM appointments_waiting_list wl2
        INNER JOIN appointments_waiting_list wlx ON wlx.id = ?
        WHERE wl2.status = 'pending'
          AND (
            (wlx.availability_id IS NOT NULL AND wl2.availability_id = wlx.availability_id)
            OR (wlx.availability_id IS NULL AND wl2.availability_id IS NULL AND wl2.specialty_id = wlx.specialty_id)
          )
          AND (
            CASE UPPER(TRIM(wl2.priority_level))
              WHEN 'URGENTE' THEN 1
              WHEN 'ALTA' THEN 2
              WHEN 'NORMAL' THEN 3
              WHEN 'BAJA' THEN 4
              ELSE 3
            END
            <
            CASE UPPER(TRIM(wlx.priority_level))
              WHEN 'URGENTE' THEN 1
              WHEN 'ALTA' THEN 2
              WHEN 'NORMAL' THEN 3
              WHEN 'BAJA' THEN 4
              ELSE 3
            END
            OR (
              CASE UPPER(TRIM(wl2.priority_level))
                WHEN 'URGENTE' THEN 1
                WHEN 'ALTA' THEN 2
                WHEN 'NORMAL' THEN 3
                WHEN 'BAJA' THEN 4
                ELSE 3
              END
              =
              CASE UPPER(TRIM(wlx.priority_level))
                WHEN 'URGENTE' THEN 1
                WHEN 'ALTA' THEN 2
                WHEN 'NORMAL' THEN 3
                WHEN 'BAJA' THEN 4
                ELSE 3
              END
              AND wl2.created_at < wlx.created_at
            )
          )
      `, [result.insertId]);

      const elapsed = Date.now() - startTime;
      logger.info({ 
        waitingListId: result.insertId, 
        position: positionRows[0].position,
        elapsed 
      }, 'Added to waiting list successfully');

      return {
        success: true,
        waiting_list: true,
        data: {
          waiting_list_id: result.insertId,
          queue_position: positionRows[0].position,
          specialty_name: specialtyName,
          priority_level: normalizedPriority,
          message: `Agregado a lista de espera de ${specialtyName} en posición ${positionRows[0].position}`
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'addToWaitingList error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// OBTENER LISTA DE ESPERA DEL PACIENTE
// ============================================================================

export async function getPatientWaitingList(args: { 
  patient_id?: number; 
  document?: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'getPatientWaitingList: fetching patient waiting list');

  try {
    const connection = await pool.getConnection();
    try {
      let patientId = args.patient_id;

      // Si no hay patient_id pero hay document, buscar el paciente
      if (!patientId && args.document) {
        const [patientRows] = await connection.execute<RowDataPacket[]>(`
          SELECT id FROM patients WHERE document = ?
        `, [args.document.replace(/\D/g, '')]);

        if (patientRows.length === 0) {
          return { success: false, error: 'Paciente no encontrado' };
        }
        patientId = patientRows[0].id;
      }

      if (!patientId) {
        return { success: false, error: 'Se requiere patient_id o document' };
      }

      const sql = `
        SELECT 
          awl.id AS waiting_list_id,
          awl.specialty_id,
          awl.priority_level,
          awl.reason,
          awl.status,
          awl.created_at,
          s.name AS specialty_name
        FROM appointments_waiting_list awl
        JOIN specialties s ON awl.specialty_id = s.id
        WHERE awl.patient_id = ? AND awl.status = 'pending'
        ORDER BY awl.created_at DESC
      `;

      const [rows] = await connection.execute<RowDataPacket[]>(sql, [patientId]);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length, patientId }, 'getPatientWaitingList completed');

      return {
        success: true,
        data: {
          total: rows.length,
          waiting_list: rows.map(r => ({
            waiting_list_id: r.waiting_list_id,
            specialty_id: r.specialty_id,
            specialty_name: r.specialty_name,
            priority_level: r.priority_level,
            reason: r.reason,
            status: r.status,
            created_at: r.created_at
          }))
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getPatientWaitingList error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BUSCAR DISPONIBILIDAD POR DOCTOR
// ============================================================================

export async function getAvailabilityByDoctor(args: {
  doctor_name?: string;
  doctor_id?: number;
  specialty_name?: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'getAvailabilityByDoctor: fetching availability for specific doctor');

  try {
    const connection = await pool.getConnection();
    try {
      let whereClause = "WHERE a.date > CURDATE() AND a.status = 'Activa' AND (a.is_paused = 0 OR a.is_paused IS NULL) AND (a.capacity - a.booked_slots) > 0";
      const params: any[] = [];

      if (args.doctor_id) {
        whereClause += ' AND a.doctor_id = ?';
        params.push(args.doctor_id);
      } else if (args.doctor_name) {
        whereClause += ' AND d.name LIKE ?';
        params.push(`%${args.doctor_name}%`);
      }

      if (args.specialty_name) {
        whereClause += ' AND s.name LIKE ?';
        params.push(`%${args.specialty_name}%`);
      }

      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.id AS availability_id,
          DATE_FORMAT(a.date, '%Y-%m-%d') AS appointment_date,
          a.start_time,
          a.end_time,
          (a.capacity - a.booked_slots) AS slots_available,
          a.duration_minutes,
          s.name AS specialty_name,
          d.id AS doctor_id,
          d.name AS doctor_name,
          l.name AS location_name
        FROM availabilities a
        JOIN specialties s ON a.specialty_id = s.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN locations l ON a.location_id = l.id
        ${whereClause}
        ORDER BY a.date ASC, a.start_time ASC
        LIMIT 30
      `, params);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length, args }, 'getAvailabilityByDoctor completed');

      if (rows.length === 0) {
        return {
          success: true,
          data: {
            found: false,
            doctor_name: args.doctor_name || 'Especificado',
            message: 'No hay disponibilidad con este doctor',
            appointments: []
          }
        };
      }

      // Agrupar por fecha
      const byDate: { [date: string]: any[] } = {};
      for (const row of rows) {
        if (!byDate[row.appointment_date]) {
          byDate[row.appointment_date] = [];
        }
        byDate[row.appointment_date].push({
          availability_id: row.availability_id,
          start_time_formatted: formatTimeToAMPM(row.start_time),
          end_time_formatted: formatTimeToAMPM(row.end_time),
          slots_available: row.slots_available
        });
      }

      return {
        success: true,
        data: {
          found: true,
          doctor_id: rows[0].doctor_id,
          doctor_name: rows[0].doctor_name,
          specialty_name: rows[0].specialty_name,
          location_name: rows[0].location_name,
          total_dates: Object.keys(byDate).length,
          dates_available: Object.keys(byDate),
          dates_formatted: Object.keys(byDate).map(d => formatDateToSpanish(d)),
          by_date: byDate,
          appointments: rows.map(r => ({
            availability_id: r.availability_id,
            appointment_date: r.appointment_date,
            appointment_date_formatted: formatDateToSpanish(r.appointment_date),
            start_time_formatted: formatTimeToAMPM(r.start_time),
            end_time_formatted: formatTimeToAMPM(r.end_time),
            slots_available: r.slots_available
          }))
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getAvailabilityByDoctor error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CONSULTAR POSICIÓN EN LISTA DE ESPERA
// ============================================================================

export async function getWaitingListPosition(args: {
  patient_id?: number;
  document?: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'getWaitingListPosition: checking waiting list status');

  try {
    const connection = await pool.getConnection();
    try {
      let patientId = args.patient_id;

      // Si no hay patient_id pero hay document, buscar el paciente
      if (!patientId && args.document) {
        const [patientRows] = await connection.execute<RowDataPacket[]>(`
          SELECT id FROM patients WHERE document = ?
        `, [args.document.replace(/\D/g, '')]);

        if (patientRows.length === 0) {
          return { success: false, error: 'Paciente no encontrado' };
        }
        patientId = patientRows[0].id;
      }

      if (!patientId) {
        return { success: false, error: 'Se requiere patient_id o document' };
      }

      // Obtener todas las solicitudes pendientes del paciente
      const [waitingRows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          wl.id,
          wl.specialty_id,
          wl.availability_id,
          wl.priority_level,
          wl.reason,
          wl.status,
          wl.created_at,
          s.name AS specialty_name
        FROM appointments_waiting_list wl
        JOIN specialties s ON wl.specialty_id = s.id
        WHERE wl.patient_id = ? AND wl.status = 'pending'
        ORDER BY wl.created_at DESC
      `, [patientId]);

      // Para cada solicitud, obtener la posición
      const waitingListItems = await Promise.all(waitingRows.map(async (wl: any) => {
        const [posRows] = await connection.execute<RowDataPacket[]>(`
          SELECT COUNT(*) + 1 AS position
          FROM appointments_waiting_list wl2
          WHERE wl2.status = 'pending'
            AND (
              (wl.availability_id IS NOT NULL AND wl2.availability_id = wl.availability_id)
              OR (wl.availability_id IS NULL AND wl2.availability_id IS NULL AND wl2.specialty_id = wl.specialty_id)
            )
            AND (
              CASE UPPER(TRIM(wl2.priority_level))
                WHEN 'URGENTE' THEN 1
                WHEN 'ALTA' THEN 2
                WHEN 'NORMAL' THEN 3
                WHEN 'BAJA' THEN 4
                ELSE 3
              END
              <
              CASE UPPER(TRIM(wl.priority_level))
                WHEN 'URGENTE' THEN 1
                WHEN 'ALTA' THEN 2
                WHEN 'NORMAL' THEN 3
                WHEN 'BAJA' THEN 4
                ELSE 3
              END
              OR (
                CASE UPPER(TRIM(wl2.priority_level))
                  WHEN 'URGENTE' THEN 1
                  WHEN 'ALTA' THEN 2
                  WHEN 'NORMAL' THEN 3
                  WHEN 'BAJA' THEN 4
                  ELSE 3
                END
                =
                CASE UPPER(TRIM(wl.priority_level))
                  WHEN 'URGENTE' THEN 1
                  WHEN 'ALTA' THEN 2
                  WHEN 'NORMAL' THEN 3
                  WHEN 'BAJA' THEN 4
                  ELSE 3
                END
                AND wl2.created_at < wl.created_at
              )
            )
        `);

        return {
          waiting_list_id: wl.id,
          specialty_name: wl.specialty_name,
          priority_level: normalizePriorityLevel(wl.priority_level),
          queue_position: posRows[0].position,
          created_at: wl.created_at,
          status: wl.status
        };
      }));

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: waitingListItems.length, patientId }, 'getWaitingListPosition completed');

      return {
        success: true,
        data: {
          total: waitingListItems.length,
          in_waiting_list: waitingListItems.length > 0,
          waiting_list_items: waitingListItems,
          message: waitingListItems.length > 0 
            ? `Tienes ${waitingListItems.length} solicitud(es) en lista de espera`
            : 'No tienes solicitudes en lista de espera'
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getWaitingListPosition error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// FUNCIÓN: LISTAR ZONAS GEOGRÁFICAS
// ============================================================================

export async function listZones(): Promise<any> {
  const startTime = Date.now();
  logger.info('listZones called');

  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          id,
          name,
          description,
          created_at
        FROM zones 
        ORDER BY name ASC
      `);

      const zonesList = rows.map(zone => ({
        id: zone.id,
        name: zone.name,
        description: zone.description || '',
        created_at: zone.created_at
      }));

      const displayList = zonesList.map(zone => zone.name).join(' o ');

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: zonesList.length }, 'listZones completed');

      return {
        success: true,
        count: zonesList.length,
        zones_list: zonesList,
        display_list: displayList,
        message: `Se encontraron ${zonesList.length} zonas disponibles`,
        usage_note: 'Use el campo "id" como zone_id para registrar pacientes con registerPatientSimple (OBLIGATORIO)',
        presentation_note: 'Al mencionar las zonas al paciente, use el campo "display_list" para una presentación más natural sin IDs'
      };
    } finally {
      connection.release();
    }
  }, 'listZones');
}

// ============================================================================
// FUNCIÓN: OBTENER SERVICIOS AUTORIZADOS POR EPS
// ============================================================================

export async function getEPSServices(args: { eps_id: number }): Promise<any> {
  const startTime = Date.now();
  const { eps_id } = args;
  logger.info({ eps_id }, 'getEPSServices called');

  if (!eps_id) {
    return {
      success: false,
      error: 'El parámetro eps_id es obligatorio',
      usage: 'Proporcione el ID de la EPS para consultar sus servicios autorizados'
    };
  }

  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.id as authorization_id,
          a.eps_id,
          e.name as eps_name,
          e.code as eps_code,
          a.specialty_id,
          s.name as specialty_name,
          s.description as specialty_description,
          a.location_id,
          l.name as location_name,
          l.address as location_address,
          a.authorized,
          a.authorization_date,
          a.expiration_date,
          a.max_monthly_appointments,
          a.copay_percentage,
          a.requires_prior_authorization,
          a.notes,
          a.created_at
        FROM eps_specialty_location_authorizations a
        INNER JOIN eps e ON a.eps_id = e.id
        INNER JOIN specialties s ON a.specialty_id = s.id
        INNER JOIN locations l ON a.location_id = l.id
        WHERE a.eps_id = ?
          AND a.authorized = 1
          AND (a.expiration_date IS NULL OR a.expiration_date >= CURDATE())
        ORDER BY s.name ASC, l.name ASC
      `, [eps_id]);

      const servicesList = rows.map(service => ({
        authorization_id: service.authorization_id,
        eps: {
          id: service.eps_id,
          name: service.eps_name,
          code: service.eps_code
        },
        specialty: {
          id: service.specialty_id,
          name: service.specialty_name,
          description: service.specialty_description || ''
        },
        location: {
          id: service.location_id,
          name: service.location_name,
          address: service.location_address
        },
        authorization_details: {
          max_monthly_appointments: service.max_monthly_appointments,
          copay_percentage: parseFloat(service.copay_percentage),
          requires_prior_authorization: service.requires_prior_authorization === 1,
          notes: service.notes
        }
      }));

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: servicesList.length, eps_id }, 'getEPSServices completed');

      return {
        success: true,
        count: servicesList.length,
        services: servicesList,
        message: servicesList.length > 0 
          ? `Se encontraron ${servicesList.length} servicios autorizados para la EPS`
          : 'No se encontraron servicios autorizados para esta EPS'
      };
    } finally {
      connection.release();
    }
  }, 'getEPSServices');
}

// ============================================================================
// FUNCIÓN: VERIFICAR CUPOS DISPONIBLES POR ESPECIALIDAD/SEDE
// ============================================================================

export async function checkAvailabilityQuota(args: { 
  specialty_id: number; 
  location_id: number; 
  day_date?: string 
}): Promise<any> {
  const startTime = Date.now();
  const { specialty_id, location_id, day_date } = args;
  logger.info({ specialty_id, location_id, day_date }, 'checkAvailabilityQuota called');

  if (!specialty_id || !location_id) {
    return {
      success: false,
      error: 'specialty_id y location_id son requeridos'
    };
  }

  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      // 1. Obtener información de la especialidad y sede
      const [specialtyInfo] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          s.id as specialty_id,
          s.name as specialty_name,
          l.id as location_id,
          l.name as location_name,
          l.address as location_address,
          l.phone as location_phone
        FROM specialties s
        CROSS JOIN locations l
        WHERE s.id = ? AND l.id = ?
      `, [specialty_id, location_id]);

      if (specialtyInfo.length === 0) {
        return {
          success: false,
          error: 'Especialidad o sede no encontrada'
        };
      }

      const info = specialtyInfo[0];

      // 2. Obtener TODAS las availabilities de esta especialidad en esta sede
      let availQuery = `
        SELECT 
          COALESCE(a.id, wl.availability_id) as availability_id,
          a.date as appointment_date,
          a.start_time,
          a.end_time,
          a.duration_minutes,
          a.capacity as total_capacity,
          d.id as doctor_id,
          d.name as doctor_name,
          d.email as doctor_email,
          (
            SELECT COUNT(*)
            FROM appointments app
            WHERE app.availability_id = a.id 
              AND app.status IN ('Pendiente', 'Confirmada')
          ) as booked_slots,
          (
            a.capacity - (
              SELECT COUNT(*)
              FROM appointments app
              WHERE app.availability_id = a.id 
                AND app.status IN ('Pendiente', 'Confirmada')
            )
          ) as slots_available
        FROM availabilities a
        INNER JOIN doctors d ON a.doctor_id = d.id
        WHERE a.specialty_id = ? 
          AND a.location_id = ? 
          AND a.status = 'Activa'
          AND a.date >= CURDATE()
      `;

      const queryParams: any[] = [specialty_id, location_id];

      if (day_date) {
        availQuery += ' AND a.date = ?';
        queryParams.push(day_date);
      }

      availQuery += ' ORDER BY a.date ASC, a.start_time ASC';

      const [availabilities] = await connection.execute<RowDataPacket[]>(availQuery, queryParams);

      if (availabilities.length === 0) {
        return {
          success: false,
          error: 'No hay agendas activas para esta especialidad en esta sede',
          specialty: { id: info.specialty_id, name: info.specialty_name },
          location: { id: info.location_id, name: info.location_name },
          suggestion: 'Intente con otra sede o consulte las especialidades disponibles'
        };
      }

      // Calcular totales
      const totalCapacity = availabilities.reduce((sum, a) => sum + a.total_capacity, 0);
      const totalBooked = availabilities.reduce((sum, a) => sum + a.booked_slots, 0);
      const totalAvailable = availabilities.reduce((sum, a) => sum + a.slots_available, 0);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, availabilities: availabilities.length }, 'checkAvailabilityQuota completed');

      return {
        success: true,
        specialty: { id: info.specialty_id, name: info.specialty_name },
        location: { id: info.location_id, name: info.location_name, address: info.location_address },
        summary: {
          total_capacity: totalCapacity,
          total_booked: totalBooked,
          total_available: totalAvailable,
          availabilities_count: availabilities.length
        },
        availabilities: availabilities.map(a => ({
          availability_id: a.availability_id,
          date: a.appointment_date,
          start_time: formatTimeToAMPM(utcToColombiaTime(a.start_time)),
          end_time: formatTimeToAMPM(utcToColombiaTime(a.end_time)),
          doctor: { id: a.doctor_id, name: a.doctor_name },
          capacity: a.total_capacity,
          booked: a.booked_slots,
          available: a.slots_available
        })),
        message: `Se encontraron ${totalAvailable} cupos disponibles en ${availabilities.length} agenda(s)`
      };
    } finally {
      connection.release();
    }
  }, 'checkAvailabilityQuota');
}

// ============================================================================
// FUNCIÓN: BUSCAR CUPS POR NOMBRE
// ============================================================================

export async function searchCupsByName(args: { name: string; limit?: number }): Promise<any> {
  const startTime = Date.now();
  const { name, limit = 10 } = args;
  logger.info({ name, limit }, 'searchCupsByName called');

  if (!name || name.trim() === '') {
    return {
      success: false,
      error: 'El parámetro "name" es obligatorio',
      usage: 'Proporcione un nombre o parte del nombre del procedimiento a buscar'
    };
  }

  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      const validLimit = Math.min(Math.max(1, limit), 50);
      const searchPattern = `%${name.trim()}%`;

      const [cupsList] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          c.id,
          c.code,
          c.name,
          c.category,
          c.price,
          c.status,
          s.id as specialty_id,
          s.name as specialty_name
        FROM cups c
        LEFT JOIN specialties s ON c.specialty_id = s.id
        WHERE c.name LIKE ?
          AND c.status = 'Activo'
        ORDER BY c.category, c.name
        LIMIT ?
      `, [searchPattern, validLimit]);

      if (cupsList.length === 0) {
        return {
          success: true,
          message: `No se encontraron procedimientos con el nombre "${name}"`,
          search_term: name,
          total: 0,
          procedures: [],
          suggestion: 'Intente con otro término de búsqueda o use palabras más generales (ej: "mama", "abdomen", "hemograma")'
        };
      }

      const formattedProcedures = cupsList.map(cup => ({
        id: cup.id,
        code: cup.code,
        name: cup.name,
        category: cup.category,
        price: parseFloat(cup.price),
        specialty: cup.specialty_id ? {
          id: cup.specialty_id,
          name: cup.specialty_name
        } : null,
        status: cup.status
      }));

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: cupsList.length, name }, 'searchCupsByName completed');

      return {
        success: true,
        message: `Se encontraron ${cupsList.length} procedimiento(s) con el nombre "${name}"`,
        search_term: name,
        total: cupsList.length,
        procedures: formattedProcedures,
        usage_note: 'Use el campo "id" como cups_id al agregar a lista de espera (addToWaitingList)'
      };
    } finally {
      connection.release();
    }
  }, 'searchCupsByName');
}

// ============================================================================
// FUNCIÓN: BUSCAR CUPS POR CÓDIGO U OTROS FILTROS
// ============================================================================

export async function searchCups(args: { 
  code?: string; 
  name?: string; 
  category?: string;
  specialty_id?: number;
  status?: string;
  limit?: number 
}): Promise<any> {
  const startTime = Date.now();
  const { code, name, category, specialty_id, status = 'Activo', limit = 20 } = args;
  logger.info({ code, name, category, specialty_id, status, limit }, 'searchCups called');

  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      const finalLimit = Math.min(Math.max(1, limit), 100);

      let query = `
        SELECT 
          c.id,
          c.code,
          c.name,
          c.category,
          c.subcategory,
          c.description,
          c.specialty_id,
          s.name as specialty_name,
          c.price,
          c.requires_authorization,
          c.complexity_level,
          c.estimated_duration_minutes,
          c.status,
          c.notes
        FROM cups c
        LEFT JOIN specialties s ON c.specialty_id = s.id
        WHERE 1=1
      `;

      const queryParams: any[] = [];

      if (code) {
        query += ` AND c.code LIKE ?`;
        queryParams.push(`%${code}%`);
      }

      if (name) {
        query += ` AND c.name LIKE ?`;
        queryParams.push(`%${name}%`);
      }

      if (category) {
        query += ` AND c.category LIKE ?`;
        queryParams.push(`%${category}%`);
      }

      if (specialty_id) {
        query += ` AND c.specialty_id = ?`;
        queryParams.push(specialty_id);
      }

      if (status !== 'Todos') {
        query += ` AND c.status = ?`;
        queryParams.push(status);
      }

      query += ` ORDER BY c.category, c.name LIMIT ?`;
      queryParams.push(finalLimit);

      const [cupsList] = await connection.execute<RowDataPacket[]>(query, queryParams);

      if (cupsList.length === 0) {
        return {
          success: true,
          message: 'No se encontraron procedimientos CUPS con los criterios especificados',
          search_criteria: { code, name, category, specialty_id, status },
          total: 0,
          procedures: []
        };
      }

      const formattedProcedures = cupsList.map(cup => ({
        id: cup.id,
        code: cup.code,
        name: cup.name,
        category: cup.category,
        subcategory: cup.subcategory,
        description: cup.description,
        specialty: cup.specialty_id ? { id: cup.specialty_id, name: cup.specialty_name } : null,
        price: parseFloat(cup.price),
        requires_authorization: cup.requires_authorization === 1,
        complexity_level: cup.complexity_level,
        estimated_duration_minutes: cup.estimated_duration_minutes,
        status: cup.status,
        notes: cup.notes
      }));

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: cupsList.length }, 'searchCups completed');

      return {
        success: true,
        message: `Se encontraron ${cupsList.length} procedimiento(s) CUPS`,
        total: cupsList.length,
        procedures: formattedProcedures
      };
    } finally {
      connection.release();
    }
  }, 'searchCups');
}

// ============================================================================
// FUNCIÓN: CONSULTAR LISTA DE ESPERA
// ============================================================================

export async function getWaitingListAppointments(args: {
  patient_id?: number;
  doctor_id?: number;
  specialty_id?: number;
  location_id?: number;
  priority_level?: string;
  status?: string;
  limit?: number;
}): Promise<any> {
  const startTime = Date.now();
  const {
    patient_id,
    doctor_id,
    specialty_id,
    location_id,
    priority_level = 'Todas',
    status = 'pending',
    limit = 50
  } = args;
  logger.info({ patient_id, doctor_id, specialty_id, location_id, priority_level, status, limit }, 'getWaitingListAppointments called');

  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT 
          wl.id as waiting_list_id,
          wl.status,
          wl.priority_level,
          wl.scheduled_date as requested_date,
          wl.appointment_type,
          wl.reason,
          wl.notes,
          wl.created_at as added_to_waiting_list_at,
          wl.expires_at,
          DATEDIFF(wl.expires_at, NOW()) as days_until_expiration,
          wl.reassigned_at,
          wl.reassigned_appointment_id,
          wl.availability_id as waiting_availability_id,
          wl.specialty_id as waiting_specialty_id,
          
          p.id as patient_id,
          p.name as patient_name,
          p.document as patient_document,
          p.phone as patient_phone,
          p.email as patient_email,
          
          a.id as availability_id,
          a.date as availability_date,
          a.start_time,
          a.end_time,
          a.duration_minutes,
          a.capacity as total_capacity,
          
          (
            SELECT COUNT(*)
            FROM appointments app
            WHERE app.availability_id = a.id 
              AND app.status IN ('Pendiente', 'Confirmada')
          ) as current_appointments_count,
          
          d.id as doctor_id,
          d.name as doctor_name,
          d.email as doctor_email,
          
          COALESCE(sw.id, sa.id) as specialty_id,
          COALESCE(sw.name, sa.name) as specialty_name,
          
          l.id as location_id,
          l.name as location_name,
          l.address as location_address,
          
          (
            SELECT COUNT(*) + 1
            FROM appointments_waiting_list wl2
            WHERE wl2.status = 'pending'
              AND (
                (wl.availability_id IS NOT NULL AND wl2.availability_id = wl.availability_id)
                OR (
                  wl.availability_id IS NULL
                  AND wl2.availability_id IS NULL
                  AND wl2.specialty_id = wl.specialty_id
                )
              )
              AND (
                CASE UPPER(TRIM(wl2.priority_level))
                  WHEN 'URGENTE' THEN 1
                  WHEN 'ALTA' THEN 2
                  WHEN 'NORMAL' THEN 3
                  WHEN 'BAJA' THEN 4
                  ELSE 3
                END
                <
                CASE UPPER(TRIM(wl.priority_level))
                  WHEN 'URGENTE' THEN 1
                  WHEN 'ALTA' THEN 2
                  WHEN 'NORMAL' THEN 3
                  WHEN 'BAJA' THEN 4
                  ELSE 3
                END
                OR (
                  CASE UPPER(TRIM(wl2.priority_level))
                    WHEN 'URGENTE' THEN 1
                    WHEN 'ALTA' THEN 2
                    WHEN 'NORMAL' THEN 3
                    WHEN 'BAJA' THEN 4
                    ELSE 3
                  END
                  =
                  CASE UPPER(TRIM(wl.priority_level))
                    WHEN 'URGENTE' THEN 1
                    WHEN 'ALTA' THEN 2
                    WHEN 'NORMAL' THEN 3
                    WHEN 'BAJA' THEN 4
                    ELSE 3
                  END
                  AND wl2.created_at < wl.created_at
                )
              )
          ) as queue_position,

          CASE
            WHEN wl.availability_id IS NOT NULL THEN 'availability'
            ELSE 'specialty'
          END as waiting_mode
        
        FROM appointments_waiting_list wl
        INNER JOIN patients p ON wl.patient_id = p.id
        LEFT JOIN availabilities a ON wl.availability_id = a.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN specialties sa ON a.specialty_id = sa.id
        LEFT JOIN specialties sw ON wl.specialty_id = sw.id
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE 1=1
      `;

      const params: any[] = [];

      if (patient_id) {
        query += ' AND wl.patient_id = ?';
        params.push(patient_id);
      }

      if (doctor_id) {
        query += ' AND a.doctor_id = ?';
        params.push(doctor_id);
      }

      if (specialty_id) {
        query += ' AND COALESCE(wl.specialty_id, a.specialty_id) = ?';
        params.push(specialty_id);
      }

      if (location_id) {
        query += ' AND a.location_id = ?';
        params.push(location_id);
      }

      if (priority_level !== 'Todas') {
        query += ' AND UPPER(TRIM(wl.priority_level)) = UPPER(TRIM(?))';
        params.push(priority_level);
      }

      if (status !== 'all') {
        query += ' AND wl.status = ?';
        params.push(status);
      }

      query += ` 
        ORDER BY 
          CASE UPPER(TRIM(wl.priority_level))
            WHEN 'URGENTE' THEN 1
            WHEN 'ALTA' THEN 2
            WHEN 'NORMAL' THEN 3
            WHEN 'BAJA' THEN 4
            ELSE 3
          END,
          wl.created_at ASC
        LIMIT ?
      `;
      params.push(limit);

      const [rows] = await connection.execute<RowDataPacket[]>(query, params);

      if (rows.length === 0) {
        return {
          success: true,
          message: 'No hay solicitudes en lista de espera con los filtros aplicados',
          count: 0,
          waiting_list: [],
          filters_applied: { patient_id, doctor_id, specialty_id, location_id, priority_level, status, limit }
        };
      }

      const waitingList = rows.map(wl => ({
        waiting_list_id: wl.waiting_list_id,
        status: wl.status,
        priority_level: normalizePriorityLevel(wl.priority_level),
        queue_position: wl.queue_position,
        requested_date: wl.requested_date,
        appointment_type: wl.appointment_type,
        reason: wl.reason,
        notes: wl.notes,
        added_at: wl.added_to_waiting_list_at,
        expires_at: wl.expires_at,
        days_until_expiration: wl.days_until_expiration,
        waiting_mode: wl.waiting_mode,
        patient: {
          id: wl.patient_id,
          name: wl.patient_name,
          document: wl.patient_document,
          phone: wl.patient_phone,
          email: wl.patient_email
        },
        availability: wl.availability_id ? {
          id: wl.availability_id,
          date: wl.availability_date,
          start_time: wl.start_time ? formatTimeToAMPM(utcToColombiaTime(wl.start_time)) : null,
          end_time: wl.end_time ? formatTimeToAMPM(utcToColombiaTime(wl.end_time)) : null,
          capacity: wl.total_capacity,
          current_appointments: wl.current_appointments_count,
          slots_available: (wl.total_capacity || 0) - (wl.current_appointments_count || 0),
          can_be_reassigned: ((wl.total_capacity || 0) - (wl.current_appointments_count || 0)) > 0
        } : null,
        doctor: wl.doctor_id ? { id: wl.doctor_id, name: wl.doctor_name, email: wl.doctor_email } : null,
        specialty: wl.specialty_id ? { id: wl.specialty_id, name: wl.specialty_name } : null,
        location: wl.location_id ? { id: wl.location_id, name: wl.location_name, address: wl.location_address } : null,
        reassignment_info: wl.reassigned_at ? {
          reassigned_at: wl.reassigned_at,
          appointment_id: wl.reassigned_appointment_id
        } : null
      }));

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length }, 'getWaitingListAppointments completed');

      return {
        success: true,
        count: rows.length,
        waiting_list: waitingList,
        filters_applied: { patient_id, doctor_id, specialty_id, location_id, priority_level, status, limit }
      };
    } finally {
      connection.release();
    }
  }, 'getWaitingListAppointments');
}

// ============================================================================
// FUNCIÓN: REASIGNAR DESDE LISTA DE ESPERA
// ============================================================================

export async function reassignWaitingListAppointments(args: { availability_id: number }): Promise<any> {
  const startTime = Date.now();
  const { availability_id } = args;
  logger.info({ availability_id }, 'reassignWaitingListAppointments called');

  if (!availability_id) {
    return {
      success: false,
      error: 'El parámetro availability_id es obligatorio'
    };
  }

  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      // Verificar que la disponibilidad existe
      const [availCheck] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.id, a.date, a.start_time, a.end_time,
          d.name as doctor_name,
          s.name as specialty_name,
          l.name as location_name,
          a.capacity,
          (
            SELECT COUNT(*)
            FROM appointments app
            WHERE app.availability_id = a.id 
              AND app.status IN ('Pendiente', 'Confirmada')
          ) as current_appointments
        FROM availabilities a
        INNER JOIN doctors d ON a.doctor_id = d.id
        INNER JOIN specialties s ON a.specialty_id = s.id
        INNER JOIN locations l ON a.location_id = l.id
        WHERE a.id = ?
      `, [availability_id]);

      if (availCheck.length === 0) {
        return {
          success: false,
          error: 'Disponibilidad no encontrada'
        };
      }

      const availability = availCheck[0];
      const slotsAvailable = availability.capacity - availability.current_appointments;

      if (slotsAvailable <= 0) {
        return {
          success: false,
          message: 'No hay cupos disponibles para reasignar',
          availability_info: {
            availability_id: availability.id,
            date: availability.date,
            doctor: availability.doctor_name,
            specialty: availability.specialty_name,
            location: availability.location_name,
            capacity: availability.capacity,
            current_appointments: availability.current_appointments,
            slots_available: slotsAvailable
          }
        };
      }

      // Llamar al procedimiento almacenado
      await connection.execute(`CALL process_waiting_list_for_availability(?)`, [availability_id]);

      // Consultar resultados
      const [reassignedResult] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as total_reassigned
        FROM appointments_waiting_list
        WHERE availability_id = ? AND status = 'reassigned'
      `, [availability_id]);

      const totalReassigned = reassignedResult[0].total_reassigned;

      const [stillWaitingResult] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) as still_waiting
        FROM appointments_waiting_list
        WHERE availability_id = ? AND status = 'pending'
      `, [availability_id]);

      const stillWaiting = stillWaitingResult[0].still_waiting;

      // Nueva consulta de cupos actuales
      const [updatedAvailCheck] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.capacity,
          (
            SELECT COUNT(*)
            FROM appointments app
            WHERE app.availability_id = a.id 
              AND app.status IN ('Pendiente', 'Confirmada')
          ) as current_appointments
        FROM availabilities a
        WHERE a.id = ?
      `, [availability_id]);

      const updated = updatedAvailCheck[0];
      const slotsRemainingAfter = updated.capacity - updated.current_appointments;

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, totalReassigned, stillWaiting }, 'reassignWaitingListAppointments completed');

      return {
        success: true,
        message: `Se procesó la lista de espera exitosamente`,
        reassigned_count: totalReassigned,
        still_waiting_count: stillWaiting,
        availability_info: {
          availability_id: availability.id,
          date: availability.date,
          doctor: availability.doctor_name,
          specialty: availability.specialty_name,
          location: availability.location_name,
          capacity: updated.capacity,
          appointments_before: availability.current_appointments,
          appointments_after: updated.current_appointments,
          slots_available_before: slotsAvailable,
          slots_available_after: slotsRemainingAfter
        },
        info: totalReassigned > 0
          ? `Se reasignaron ${totalReassigned} solicitudes de la lista de espera a citas confirmadas`
          : 'No se reasignó ninguna solicitud (puede que no hayan solicitudes o los cupos ya estén llenos)'
      };
    } finally {
      connection.release();
    }
  }, 'reassignWaitingListAppointments');
}

// ============================================================================
// FUNCIÓN: CANCELAR CITAS VENCIDAS
// ============================================================================

export async function cancelarCitasVencidas(args: { 
  document: string; 
  current_date: string; 
  dry_run?: boolean 
}): Promise<any> {
  const startTime = Date.now();
  let { document, current_date, dry_run = false } = args;
  logger.info({ document, current_date, dry_run }, 'cancelarCitasVencidas called');

  // Normalizar documento
  if (document) {
    document = document.replace(/[^0-9]/g, '');
  }

  if (!document) {
    return {
      success: false,
      error: 'El parámetro document es obligatorio',
      suggestion: 'Proporcione el número de documento del paciente para cancelar sus citas vencidas'
    };
  }

  if (!current_date) {
    return {
      success: false,
      error: 'El parámetro current_date es obligatorio',
      suggestion: 'Proporcione la fecha actual en formato ISO 8601 (YYYY-MM-DDTHH:mm:ss)'
    };
  }

  // Validar formato de fecha
  const currentDateTime = new Date(current_date);
  if (isNaN(currentDateTime.getTime())) {
    return {
      success: false,
      error: 'Formato de fecha inválido',
      received: current_date,
      expected_format: 'ISO 8601 (YYYY-MM-DDTHH:mm:ss)',
      example: '2025-11-21T15:30:00'
    };
  }

  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      // Verificar que el paciente existe
      const [patientRows] = await connection.execute<RowDataPacket[]>(`
        SELECT id, document, name, phone, status
        FROM patients
        WHERE document = ?
        LIMIT 1
      `, [document]);

      if (patientRows.length === 0) {
        return {
          success: false,
          error: 'Paciente no encontrado',
          document: document,
          suggestion: 'Verifique el número de documento o use searchPatient para buscar'
        };
      }

      const patient = patientRows[0];

      if (patient.status !== 'Activo') {
        return {
          success: false,
          error: 'El paciente no está activo en el sistema',
          patient: {
            name: patient.name,
            document: patient.document,
            status: patient.status
          },
          suggestion: 'Solo se pueden cancelar citas de pacientes activos'
        };
      }

      // Buscar citas vencidas del paciente
      const [expiredAppointments] = await connection.execute<RowDataPacket[]>(`
        SELECT 
          a.id,
          a.patient_id,
          a.scheduled_at,
          a.status,
          a.reason,
          p.name as patient_name,
          p.document as patient_document,
          p.phone as patient_phone,
          d.name as doctor_name,
          s.name as specialty_name,
          l.name as location_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN specialties s ON a.specialty_id = s.id
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE a.patient_id = ?
          AND a.scheduled_at < ?
          AND a.status != 'Cancelada'
        ORDER BY a.scheduled_at ASC
      `, [patient.id, current_date]);

      const expiredList = expiredAppointments as any[];

      if (expiredList.length === 0) {
        return {
          success: true,
          message: 'No se encontraron citas vencidas para este paciente',
          patient: {
            id: patient.id,
            name: patient.name,
            document: patient.document,
            phone: patient.phone
          },
          expired_appointments_count: 0,
          expired_appointments: []
        };
      }

      // Si es dry_run, solo mostrar lo que se cancelaría
      if (dry_run) {
        return {
          success: true,
          dry_run: true,
          message: `Se encontraron ${expiredList.length} citas vencidas que serían canceladas`,
          patient: {
            id: patient.id,
            name: patient.name,
            document: patient.document,
            phone: patient.phone
          },
          expired_appointments_count: expiredList.length,
          expired_appointments: expiredList.map(apt => ({
            id: apt.id,
            scheduled_at: apt.scheduled_at,
            status: apt.status,
            doctor: apt.doctor_name,
            specialty: apt.specialty_name,
            location: apt.location_name,
            reason: apt.reason
          }))
        };
      }

      // Cancelar las citas vencidas
      const appointmentIds = expiredList.map(apt => apt.id);
      await connection.execute(`
        UPDATE appointments 
        SET status = 'Cancelada', 
            cancellation_reason = 'Cita vencida - cancelación automática',
            updated_at = NOW()
        WHERE id IN (${appointmentIds.map(() => '?').join(',')})
      `, appointmentIds);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, cancelled: expiredList.length, document }, 'cancelarCitasVencidas completed');

      return {
        success: true,
        message: `Se cancelaron ${expiredList.length} citas vencidas exitosamente`,
        patient: {
          id: patient.id,
          name: patient.name,
          document: patient.document,
          phone: patient.phone
        },
        cancelled_appointments_count: expiredList.length,
        cancelled_appointments: expiredList.map(apt => ({
          id: apt.id,
          scheduled_at: apt.scheduled_at,
          previous_status: apt.status,
          new_status: 'Cancelada',
          doctor: apt.doctor_name,
          specialty: apt.specialty_name,
          location: apt.location_name
        }))
      };
    } finally {
      connection.release();
    }
  }, 'cancelarCitasVencidas');
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

const DirectDBTools = {
  searchPatient,
  getAvailableAppointments,
  getAvailableTimeSlots,
  getAvailableTimeSlotsForDoctorOnDate,  // NUEVO: Slots verificados por doctor/fecha
  scheduleAppointment,
  registerPatientSimple,
  listActiveEPS,
  findEPSByName,
  getAuthorizedSpecialtiesForEPS,
  getAuthorizedLocationsForPatient,
  getCUPSInfo,
  searchSpecialties,
  getPatientAppointments,
  getPatientWaitingList,
  cancelAppointment,
  actualizarPhone,
  // Funciones de cita doble
  checkConsecutiveSlots,
  scheduleDoubleAppointment,
  // Funciones de lista de espera
  addToWaitingList,
  getWaitingListPosition,
  getAvailabilityByDoctor,
  // Nuevas funciones (migradas de MCP)
  listZones,
  getEPSServices,
  checkAvailabilityQuota,
  searchCupsByName,
  searchCups,
  getWaitingListAppointments,
  reassignWaitingListAppointments,
  cancelarCitasVencidas
};

export default DirectDBTools;
