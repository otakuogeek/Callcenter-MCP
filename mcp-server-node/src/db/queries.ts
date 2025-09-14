import { pool } from './mysql';

export async function searchPatients(searchTerm: string, limit: number = 10) {
  try {
    const query = `
      SELECT p.*, 
             dt.name as document_type_name,
             m.name as municipality_name,
             e.name as eps_name
      FROM patients p
      LEFT JOIN document_types dt ON p.document_type_id = dt.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps e ON p.insurance_eps_id = e.id
      WHERE p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ?
      LIMIT ?
    `;
    const searchPattern = `%${searchTerm}%`;
    const [rows] = await pool.execute(query, [searchPattern, searchPattern, searchPattern, limit]);
    return rows;
  } catch (error) {
    console.error('Error searching patients:', error);
    return [];
  }
}

export async function getPatientById(id: string | number) {
  try {
    const query = `
      SELECT p.*, 
             dt.name as document_type_name,
             m.name as municipality_name,
             e.name as eps_name,
             bg.name as blood_group_name,
             ms.name as marital_status_name
      FROM patients p
      LEFT JOIN document_types dt ON p.document_type_id = dt.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps e ON p.insurance_eps_id = e.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
      WHERE p.id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    return (rows as any[])[0] || null;
  } catch (error) {
    console.error('Error getting patient by ID:', error);
    return null;
  }
}

export async function getAppointmentsByDate(date: string) {
  try {
    const query = `
      SELECT a.*, 
             p.name as patient_name,
             p.document as patient_document,
             d.name as doctor_name,
             s.name as specialty_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      WHERE DATE(a.appointment_date) = ?
      ORDER BY a.appointment_date
    `;
    const [rows] = await pool.execute(query, [date]);
    return rows;
  } catch (error) {
    console.error('Error getting appointments by date:', error);
    return [];
  }
}

export async function getDoctors() {
  try {
    const query = `
      SELECT d.*, 
             s.name as specialty_name,
             l.name as location_name
      FROM doctors d
      LEFT JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN locations l ON d.location_id = l.id
      WHERE d.is_active = 1
    `;
    const [rows] = await pool.execute(query);
    return rows;
  } catch (error) {
    console.error('Error getting doctors:', error);
    return [];
  }
}

export async function getDaySummary(date: string) {
  try {
    const appointmentsQuery = `
      SELECT COUNT(*) as total_appointments,
             SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
             SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM appointments 
      WHERE DATE(appointment_date) = ?
    `;
    
    const patientsQuery = `
      SELECT COUNT(*) as new_patients
      FROM patients 
      WHERE DATE(created_at) = ?
    `;

    const [appointmentRows] = await pool.execute(appointmentsQuery, [date]);
    const [patientRows] = await pool.execute(patientsQuery, [date]);

    return {
      appointments: (appointmentRows as any[])[0],
      patients: (patientRows as any[])[0]
    };
  } catch (error) {
    console.error('Error getting day summary:', error);
    return null;
  }
}

export async function getLocations() {
  try {
    const query = `
      SELECT id, name, address, phone, type, status, capacity, current_patients, hours, emergency_hours
      FROM locations 
      WHERE status = 'Activa'
      ORDER BY name
    `;
    const [rows] = await pool.execute(query);
    return rows;
  } catch (error) {
    console.error('Error getting locations:', error);
    return [];
  }
}
