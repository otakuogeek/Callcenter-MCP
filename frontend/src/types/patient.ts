// Tipos centralizados para pacientes

// Interfaz unificada para pacientes (simplificada para resolver conflictos)
export interface Patient {
  id: string | number;
  document_type?: string;
  document_number?: string;
  document?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  second_last_name?: string;
  name?: string;
  phone?: string;
  email?: string;
  birth_date: string;
  gender: string;
  address?: string;
  municipality?: string;
  municipality_name?: string;
  municipality_id?: number;
  zone?: string;
  blood_type?: string;
  allergies?: string;
  medical_conditions?: string;
  eps?: string;
  affiliation_type?: string;
  education_level?: string;
  marital_status?: string;
  occupation?: string;
  population_group?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// Interfaz para datos de paciente en dashboard/lista (extendida)
export interface PatientDashboard {
  id: string;
  name: string;
  document: string;
  phone: string;
  email?: string;
  gender: string;
  birth_date: string;
  municipality?: string;
  municipality_name?: string;
  zone?: string;
  status?: string;
  // Campos adicionales para compatibilidad completa
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  second_last_name?: string;
  document_type?: string;
  document_number?: string;
  address?: string;
  blood_type?: string;
  allergies?: string;
  chronic_conditions?: string;
  eps?: string;
  affiliation_type?: string;
  education_level?: string;
  marital_status?: string;
  occupation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

// Función para mapear datos de dashboard a formato unificado
export function mapDashboardToPatient(dashboardPatient: PatientDashboard): Patient {
  const nameParts = dashboardPatient.name.split(' ');
  return {
    id: dashboardPatient.id,
    first_name: nameParts[0] || '',
    last_name: nameParts[1] || '',
    document_number: dashboardPatient.document,
    document: dashboardPatient.document,
    name: dashboardPatient.name,
    phone: dashboardPatient.phone,
    email: dashboardPatient.email,
    birth_date: dashboardPatient.birth_date,
    gender: dashboardPatient.gender,
    municipality: dashboardPatient.municipality,
    municipality_name: dashboardPatient.municipality_name,
    status: dashboardPatient.status,
  };
}

// Función para crear formato de display para pacientes
export function createDisplayPatient(patient: Patient): PatientDashboard {
  return {
    id: String(patient.id),
    name: patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
    document: patient.document || patient.document_number || '',
    phone: patient.phone || '',
    email: patient.email,
    birth_date: patient.birth_date,
    gender: patient.gender,
    municipality: patient.municipality,
    municipality_name: patient.municipality_name,
    zone: patient.zone,
    status: patient.status || 'active',
    // Campos médicos
    blood_type: patient.blood_type,
    allergies: patient.allergies,
    chronic_conditions: patient.medical_conditions,
    eps: patient.eps,
    affiliation_type: patient.affiliation_type,
    education_level: patient.education_level,
    marital_status: patient.marital_status,
    occupation: patient.occupation,
    emergency_contact_name: patient.emergency_contact_name,
    emergency_contact_phone: patient.emergency_contact_phone,
    // Campos adicionales
    first_name: patient.first_name,
    middle_name: patient.middle_name,
    last_name: patient.last_name,
    second_last_name: patient.second_last_name,
    document_type: patient.document_type,
    document_number: patient.document_number,
    address: patient.address
  };
}

// Tipos adicionales para compatibilidad
export interface PatientDetail extends Patient {
  // Campos adicionales específicos para detalles
  chronic_conditions?: string;
}
