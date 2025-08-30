import { pool } from './mysql';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import logger from '../logger-mysql';

// Simple cache implementation
const cache = new Map<string, { data: any; expiry: number }>();

function getFromCache<T>(key: string): T | null {
  const item = cache.get(key);
  if (item && item.expiry > Date.now()) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T, ttlSeconds: number = 60): void {
  cache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
}

export async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  query: string, 
  params: any[] = []
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const [rows] = await pool.execute<T>(query, params);
    
    const duration = Date.now() - startTime;
    logger.info('Query executed successfully', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params.length > 0 ? params : undefined,
      duration: `${duration}ms`,
      rowCount: Array.isArray(rows) ? rows.length : 'N/A'
    });
    
    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query execution failed', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params.length > 0 ? params : undefined,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}

export async function executeQueryWithCache<T extends RowDataPacket[]>(
  query: string,
  params: any[] = [],
  cacheTTL: number = 60
): Promise<T> {
  // Generar clave de cache basada en query y parámetros
  const cacheKey = `query:${Buffer.from(query + JSON.stringify(params)).toString('base64').substring(0, 50)}`;
  
  // Intentar obtener del cache
  const cached = getFromCache<T>(cacheKey);
  if (cached) {
    logger.debug('Query result served from cache', { cacheKey });
    return cached;
  }
  
  // Ejecutar query y cachear resultado
  const result = await executeQuery<T>(query, params);
  setCache(cacheKey, result, cacheTTL);
  
  return result;
}

// Funciones específicas para operaciones comunes

export async function getPatientById(id: number) {
  return executeQueryWithCache<RowDataPacket[]>(
    'SELECT * FROM patients WHERE id = ?',
    [id],
    300 // 5 minutos
  );
}

export async function getDoctorById(id: number) {
  return executeQueryWithCache<RowDataPacket[]>(
    'SELECT * FROM doctors WHERE id = ?',
    [id],
    300 // 5 minutos
  );
}

export async function getAppointmentsByDate(date: string) {
  return executeQueryWithCache<RowDataPacket[]>(
    `SELECT a.*, 
            p.first_name as patient_first_name, p.last_name as patient_last_name,
            d.first_name as doctor_first_name, d.last_name as doctor_last_name
     FROM appointments a
     LEFT JOIN patients p ON a.patient_id = p.id
     LEFT JOIN doctors d ON a.doctor_id = d.id
     WHERE DATE(a.appointment_date) = ?
     ORDER BY a.appointment_date`,
    [date],
    60 // 1 minuto
  );
}

export async function getTodayAppointments() {
  return executeQueryWithCache<RowDataPacket[]>(
    `SELECT a.*, 
            p.first_name as patient_first_name, p.last_name as patient_last_name,
            d.first_name as doctor_first_name, d.last_name as doctor_last_name
     FROM appointments a
     LEFT JOIN patients p ON a.patient_id = p.id
     LEFT JOIN doctors d ON a.doctor_id = d.id
     WHERE DATE(a.appointment_date) = CURDATE()
     ORDER BY a.appointment_date`,
    [],
    30 // 30 segundos
  );
}

export async function createAppointment(appointmentData: {
  patient_id: number;
  doctor_id: number;
  appointment_date: string;
  notes?: string;
}) {
  const result = await executeQuery<ResultSetHeader>(
    `INSERT INTO appointments (patient_id, doctor_id, appointment_date, notes, status) 
     VALUES (?, ?, ?, ?, 'pendiente')`,
    [
      appointmentData.patient_id,
      appointmentData.doctor_id,
      appointmentData.appointment_date,
      appointmentData.notes || ''
    ]
  );
  
  // Invalidar cache relacionado
  cache.delete('dashboard_stats');
  
  return result;
}

export async function updateAppointmentStatus(appointmentId: number, status: string) {
  const result = await executeQuery<ResultSetHeader>(
    'UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, appointmentId]
  );
  
  // Invalidar cache relacionado
  cache.delete('dashboard_stats');
  
  return result;
}

export async function getPatientAppointments(patientId: number, limit: number = 10) {
  return executeQueryWithCache<RowDataPacket[]>(
    `SELECT a.*, 
            d.first_name as doctor_first_name, d.last_name as doctor_last_name,
            d.specialization as doctor_specialization
     FROM appointments a
     LEFT JOIN doctors d ON a.doctor_id = d.id
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC
     LIMIT ?`,
    [patientId, limit],
    120 // 2 minutos
  );
}

export async function getDoctorAppointments(doctorId: number, date?: string) {
  let query = `
    SELECT a.*, 
           p.first_name as patient_first_name, p.last_name as patient_last_name,
           p.phone as patient_phone, p.email as patient_email
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.doctor_id = ?
  `;
  
  const params: any[] = [doctorId];
  
  if (date) {
    query += ' AND DATE(a.appointment_date) = ?';
    params.push(date);
  } else {
    query += ' AND a.appointment_date >= CURDATE()';
  }
  
  query += ' ORDER BY a.appointment_date';
  
  return executeQueryWithCache<RowDataPacket[]>(query, params, 60);
}

export async function searchPatients(searchTerm: string, limit: number = 20) {
  return executeQueryWithCache<RowDataPacket[]>(
    `SELECT id, first_name, last_name, email, phone, date_of_birth
     FROM patients 
     WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?
     ORDER BY last_name, first_name
     LIMIT ?`,
    [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit],
    180 // 3 minutos
  );
}

export async function getAvailableDoctors(date?: string) {
  let query = `
    SELECT id, first_name, last_name, specialization, email, phone
    FROM doctors 
    WHERE status = 'activo'
  `;
  
  const params: any[] = [];
  
  if (date) {
    // Aquí podrías agregar lógica para verificar disponibilidad en una fecha específica
    // Por ahora solo retornamos doctores activos
  }
  
  query += ' ORDER BY last_name, first_name';
  
  return executeQueryWithCache<RowDataPacket[]>(query, params, 300);
}

// Función para health check de la base de datos
export async function healthCheck(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1 as health_check');
    return true;
  } catch (error) {
    logger.error('Database health check failed', error);
    return false;
  }
}
