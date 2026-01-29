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
}

// ============================================================================
// DISPONIBILIDAD DE CITAS
// ============================================================================

export async function getAvailableAppointments(args: { specialty_name?: string; specialty_id?: number }): Promise<any> {
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
        whereClause += ' AND s.name LIKE ?';
        params.push(`%${args.specialty_name}%`);
      }
      if (args.specialty_id) {
        whereClause += ' AND a.specialty_id = ?';
        params.push(args.specialty_id);
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

      // Agrupar por especialidad
      const bySpecialty: { [key: string]: any[] } = {};
      for (const row of rows) {
        const specName = row.specialty_name;
        if (!bySpecialty[specName]) {
          bySpecialty[specName] = [];
        }
        // Convertir horarios de UTC a Colombia
        const startTimeStr = typeof row.start_time === 'string' ? row.start_time : String(row.start_time);
        const endTimeStr = typeof row.end_time === 'string' ? row.end_time : String(row.end_time);
        const startTimeColombia = utcToColombiaTime(startTimeStr.substring(0, 5));
        const endTimeColombia = utcToColombiaTime(endTimeStr.substring(0, 5));
        
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
          waiting_list_count: row.waiting_list_count || 0
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

      return {
        success: true,
        data: {
          total: rows.length,
          unique_doctors_count: uniqueDoctors.length,
          unique_doctors: uniqueDoctors,
          doctors_summary: doctorsSummary,
          IMPORTANTE: uniqueDoctors.length > 1 
            ? `⚠️ HAY ${uniqueDoctors.length} DOCTORES DISPONIBLES: ${uniqueDoctors.join(', ')}. ¡DEBES mostrar TODOS al paciente!`
            : `Solo hay 1 doctor disponible: ${uniqueDoctors[0] || 'Ninguno'}`,
          timezone: 'America/Bogota (UTC-5)',
          by_specialty: bySpecialty,
          appointments: rows.map(r => {
            const startTimeStr = typeof r.start_time === 'string' ? r.start_time : String(r.start_time);
            const endTimeStr = typeof r.end_time === 'string' ? r.end_time : String(r.end_time);
            const startTimeColombia = utcToColombiaTime(startTimeStr.substring(0, 5));
            const endTimeColombia = utcToColombiaTime(endTimeStr.substring(0, 5));
            
            return {
              availability_id: r.availability_id,
              appointment_date: r.appointment_date,
              appointment_date_formatted: formatDateToSpanish(r.appointment_date),
              start_time: startTimeColombia,
              end_time: endTimeColombia,
              start_time_formatted: formatTimeToAMPM(startTimeColombia),
              end_time_formatted: formatTimeToAMPM(endTimeColombia),
              slots_total: r.slots_total,
              slots_available: r.slots_available,
              duration_minutes: r.duration_minutes,
              specialty_id: r.specialty_id,
              specialty_name: r.specialty_name,
              doctor_id: r.doctor_id,
              doctor_name: r.doctor_name,
              location_id: r.location_id,
              location_name: r.location_name,
              waiting_list_count: r.waiting_list_count || 0
            };
          })
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'getAvailableAppointments error');
    return { success: false, error: error.message };
  }
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
        WHERE a.id = ?
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
// AGENDAR CITA
// ============================================================================

export async function scheduleAppointment(args: {
  availability_id: number;
  patient_id: number;
  scheduled_time?: string;
  scheduled_datetime?: string;
  reason?: string;
  priority_level?: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'scheduleAppointment: creating appointment');

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

      // Verificar si hay cupos
      if (avail.slots_available <= 0) {
        // Agregar a lista de espera
        const [waitingResult] = await connection.execute<ResultSetHeader>(`
          INSERT INTO appointments_waiting_list 
          (patient_id, specialty_id, location_id, availability_id, priority_level, reason, status)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `, [
          args.patient_id,
          avail.specialty_id,
          avail.location_id,
          args.availability_id,
          args.priority_level || 'normal',
          args.reason || ''
        ]);

        // Obtener posición en lista
        const [positionRows] = await connection.execute<RowDataPacket[]>(`
          SELECT COUNT(*) AS position 
          FROM appointments_waiting_list 
          WHERE specialty_id = ? AND status = 'pending' AND id <= ?
        `, [avail.specialty_id, waitingResult.insertId]);

        await connection.commit();

        const elapsed = Date.now() - startTime;
        logger.info({ waitingListId: waitingResult.insertId, elapsed }, 'Added to waiting list');

        return {
          success: true,
          waiting_list: true,
          data: {
            waiting_list_id: waitingResult.insertId,
            queue_position: positionRows[0].position,
            specialty_name: avail.specialty_name,
            location_name: avail.location_name,
            message: `Añadido a lista de espera en posición ${positionRows[0].position}`
          }
        };
      }

      // Determinar hora de la cita
      let scheduledTime = args.scheduled_time;
      if (args.scheduled_datetime) {
        // Extraer hora de scheduled_datetime (formato: "YYYY-MM-DD HH:MM" o solo "HH:MM")
        const match = args.scheduled_datetime.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          scheduledTime = `${match[1].padStart(2, '0')}:${match[2]}:00`;
        }
      }
      if (!scheduledTime) {
        scheduledTime = avail.start_time;
      }

      // Calcular hora de fin
      const duration = avail.duration_minutes || 20;

      // Formatear fecha para scheduled_at
      const dateStr = avail.date instanceof Date 
        ? avail.date.toISOString().split('T')[0]
        : String(avail.date).split('T')[0];

      // Insertar cita usando scheduled_at (datetime completo)
      const [result] = await connection.execute<ResultSetHeader>(`
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
        `${dateStr} ${scheduledTime}`,
        duration,
        args.reason || ''
      ]);

      // Actualizar booked_slots
      await connection.execute(`
        UPDATE availabilities 
        SET booked_slots = booked_slots + 1 
        WHERE id = ?
      `, [args.availability_id]);

      await connection.commit();

      const elapsed = Date.now() - startTime;
      logger.info({ 
        appointmentId: result.insertId, 
        elapsed,
        patientId: args.patient_id,
        scheduledTime
      }, 'Appointment scheduled successfully');

      // Obtener info del paciente
      const [patientRows] = await connection.execute<RowDataPacket[]>(`
        SELECT name, phone FROM patients WHERE id = ?
      `, [args.patient_id]);

      const patient = patientRows[0] || {};

      return {
        success: true,
        data: {
          appointment_id: result.insertId,
          patient_name: patient.name,
          patient_phone: patient.phone,
          doctor_name: avail.doctor_name,
          specialty_name: avail.specialty_name,
          location_name: avail.location_name,
          appointment_date: dateStr,
          scheduled_time: scheduledTime,
          scheduled_at: `${dateStr} ${scheduledTime}`,
          duration_minutes: duration,
          reason: args.reason,
          status: 'Confirmada'
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
}

// ============================================================================
// REGISTRAR PACIENTE
// ============================================================================

export async function registerPatientSimple(args: {
  document: string;
  name: string;
  phone?: string;
  eps_id?: number;
}): Promise<any> {
  const startTime = Date.now();
  const document = args.document?.toString().replace(/\D/g, '');
  
  if (!document || !args.name) {
    return { success: false, error: 'Documento y nombre son requeridos' };
  }

  logger.info({ document, name: args.name }, 'registerPatientSimple: registering patient');

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

      // Insertar nuevo paciente
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO patients (document, name, phone, insurance_eps_id, status)
        VALUES (?, ?, ?, ?, 'Activo')
      `, [document, args.name, args.phone || null, args.eps_id || null]);

      const elapsed = Date.now() - startTime;
      logger.info({ 
        patientId: result.insertId, 
        elapsed,
        document
      }, 'Patient registered successfully');

      return {
        success: true,
        data: {
          patient_id: result.insertId,
          document: document,
          name: args.name,
          phone: args.phone,
          eps_id: args.eps_id
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, args, stack: error.stack }, 'registerPatientSimple error');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// LISTAR EPS ACTIVAS
// ============================================================================

export async function listActiveEPS(): Promise<any> {
  const startTime = Date.now();
  
  logger.info('listActiveEPS: fetching active EPS list');

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT id, name, code, nit, active
        FROM eps
        WHERE active = 1
        ORDER BY name ASC
      `);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length }, 'listActiveEPS completed');

      return {
        success: true,
        data: {
          total: rows.length,
          eps_list: rows.map(r => ({
            id: r.id,
            name: r.name,
            code: r.code,
            nit: r.nit
          }))
        }
      };
    } finally {
      connection.release();
    }
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'listActiveEPS error');
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
          a.scheduled_date,
          a.scheduled_time,
          a.end_time,
          a.status,
          a.reason,
          a.source,
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

      sql += ' ORDER BY a.scheduled_date DESC, a.scheduled_time DESC LIMIT 20';

      const [rows] = await connection.execute<RowDataPacket[]>(sql, params);

      const elapsed = Date.now() - startTime;
      logger.info({ elapsed, count: rows.length, patientId }, 'getPatientAppointments completed');

      return {
        success: true,
        data: {
          total: rows.length,
          appointments: rows.map(r => ({
            appointment_id: r.appointment_id,
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

      if (appt.status === 'cancelled') {
        await connection.rollback();
        return { success: false, error: 'La cita ya está cancelada' };
      }

      // Cancelar la cita
      await connection.execute(`
        UPDATE appointments 
        SET status = 'cancelled', 
            cancellation_reason = ?,
            cancelled_at = NOW()
        WHERE id = ?
      `, [args.reason || 'Cancelada por paciente', args.appointment_id]);

      // Restaurar cupo en disponibilidad
      if (appt.availability_id) {
        await connection.execute(`
          UPDATE availabilities 
          SET booked_slots = GREATEST(0, booked_slots - 1) 
          WHERE id = ?
        `, [appt.availability_id]);
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
          scheduled_date: appt.scheduled_date,
          status: 'cancelled',
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
  patient_id: number;
  phone: string;
}): Promise<any> {
  const startTime = Date.now();
  
  logger.info({ args }, 'actualizarPhone: updating patient phone');

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

      await connection.execute(`
        UPDATE patients SET phone = ? WHERE id = ?
      `, [phone, args.patient_id]);

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
          SELECT COUNT(*) AS position 
          FROM appointments_waiting_list 
          WHERE specialty_id = ? AND status = 'pending' AND id <= ?
        `, [args.specialty_id, existingRows[0].id]);

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

      // Insertar en lista de espera (sin location_id porque la tabla no tiene esa columna)
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO appointments_waiting_list 
        (patient_id, specialty_id, availability_id, priority_level, reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', NOW())
      `, [
        args.patient_id,
        args.specialty_id,
        args.availability_id || null,
        args.priority_level || 'Normal',
        args.reason || `Consulta de ${specialtyName}`
      ]);

      // Obtener posición
      const [positionRows] = await connection.execute<RowDataPacket[]>(`
        SELECT COUNT(*) AS position 
        FROM appointments_waiting_list 
        WHERE specialty_id = ? AND status = 'pending' AND id <= ?
      `, [args.specialty_id, result.insertId]);

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
          priority_level: args.priority_level || 'normal',
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
          SELECT COUNT(*) AS position 
          FROM appointments_waiting_list 
          WHERE specialty_id = ? AND status = 'pending' AND id <= ?
        `, [wl.specialty_id, wl.id]);

        return {
          waiting_list_id: wl.id,
          specialty_name: wl.specialty_name,
          priority_level: wl.priority_level,
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
// EXPORT DEFAULT
// ============================================================================

const DirectDBTools = {
  searchPatient,
  getAvailableAppointments,
  getAvailableTimeSlots,
  scheduleAppointment,
  registerPatientSimple,
  listActiveEPS,
  searchSpecialties,
  getPatientAppointments,
  cancelAppointment,
  actualizarPhone,
  // Nuevas funciones (lógica del portal)
  checkConsecutiveSlots,
  scheduleDoubleAppointment,
  addToWaitingList,
  getWaitingListPosition,
  getAvailabilityByDoctor
};

export default DirectDBTools;
