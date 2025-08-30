// Tipos centralizados para pacientes

// Formato de datos que viene del dashboard/lista
export interface PatientDashboard {
  id: string;
  name: string;
  document: string;
  phone: string;
  email: string;
  gender: string;
  birth_date: string;
  municipality?: string;
  municipality_name?: string;
  zone?: string;
  status?: string;
}

// Formato completo de datos de un paciente individual
// Patient interface for dashboard display (from API)
export interface PatientDashboard {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  fecha_nacimiento: string;
  genero: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  municipio_nombre?: string;
  eps?: string;
  tipo_sangre?: string;
  alergias?: string;
  condiciones_medicas?: string;
  tipo_afiliacion?: string;
  nivel_educativo?: string;
  estado_civil?: string;
  ocupacion?: string;
  grupo_poblacional?: string;
}

// Patient interface for modal details (normalized)
export interface PatientDetail {
  id: number;
  document_type: string;
  document_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  second_last_name?: string;
  birth_date: string;
  gender: string;
  phone?: string;
  email?: string;
  address?: string;
  municipality_name?: string;
  eps?: string;
  blood_type?: string;
  allergies?: string;
  medical_conditions?: string;
  affiliation_type?: string;
  education_level?: string;
  marital_status?: string;
  occupation?: string;
  population_group?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at?: string;
  updated_at?: string;
}

// Unified Patient interface used throughout the application
export interface Patient {
  id: number;
  document_type: string;
  document_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  second_last_name?: string;
  birth_date: string;
  gender: string;
  phone?: string;
  email?: string;
  address?: string;
  municipality_name?: string;
  eps?: string;
  blood_type?: string;
  allergies?: string;
  medical_conditions?: string;
  affiliation_type?: string;
  education_level?: string;
  marital_status?: string;
  occupation?: string;
  population_group?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at?: string;
  updated_at?: string;
}

// Tipo unificado que puede manejar ambos formatos
export interface Patient {
  id: string;
  
  // Campos que pueden venir en formato dashboard o detalle
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  second_last_name?: string;
  name?: string; // Formato dashboard
  
  document_type?: string;
  document_type_id?: number;
  document_number?: string;
  document?: string; // Formato dashboard
  
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
  chronic_conditions?: string;
  eps?: string;
  affiliation_type?: string;
  education_level?: string;
  marital_status?: string;
  occupation?: string;
  status?: string;
}

// Función para mapear datos de dashboard a formato de detalle
export function mapDashboardToDetail(dashboardPatient: PatientDashboard): PatientDetail {
  // Separar el nombre completo en partes
  const nameParts = dashboardPatient.name.split(' ');
  const first_name = nameParts[0] || '';
  const last_name = nameParts[1] || '';
  const middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
  const second_last_name = nameParts.length > 2 ? nameParts[nameParts.length - 1] : '';

  return {
    id: dashboardPatient.id,
    first_name,
    middle_name,
    last_name,
    second_last_name,
    document_number: dashboardPatient.document,
    document: dashboardPatient.document,
    name: dashboardPatient.name,
    phone: dashboardPatient.phone,
    email: dashboardPatient.email,
    birth_date: dashboardPatient.birth_date,
    gender: dashboardPatient.gender as 'M' | 'F' | 'Otro',
    municipality: dashboardPatient.municipality,
    municipality_name: dashboardPatient.municipality_name,
    status: dashboardPatient.status,
  };
}

// Función para crear un objeto de visualización consistente
export function createDisplayPatient(patient: Patient): PatientDetail {
  // Manejar la separación de nombres correctamente
  let first_name = '';
  let middle_name = '';
  let last_name = '';
  let second_last_name = '';

  if (patient.first_name) {
    // Si ya tenemos los campos separados, usarlos directamente
    first_name = patient.first_name;
    middle_name = patient.middle_name || '';
    last_name = patient.last_name || '';
    second_last_name = patient.second_last_name || '';
  } else if (patient.name) {
    // Si solo tenemos el nombre completo, separarlo
    const nameParts = patient.name.trim().split(' ').filter(part => part.length > 0);
    
    if (nameParts.length >= 1) {
      first_name = nameParts[0];
    }
    if (nameParts.length >= 2) {
      last_name = nameParts[1];
    }
    if (nameParts.length >= 3) {
      middle_name = last_name; // El segundo se convierte en segundo nombre
      last_name = nameParts[2]; // El tercero es el primer apellido
    }
    if (nameParts.length >= 4) {
      second_last_name = nameParts.slice(3).join(' '); // Todo lo demás es segundo apellido
    }
  }

  return {
    id: patient.id,
    first_name,
    middle_name,
    last_name,
    second_last_name,
    document_type: patient.document_type || '',
    document_type_id: patient.document_type_id,
    document_number: patient.document_number || patient.document || '',
    document: patient.document || patient.document_number || '',
    name: patient.name || `${first_name} ${middle_name || ''} ${last_name} ${second_last_name || ''}`.trim().replace(/\s+/g, ' '),
    phone: patient.phone,
    email: patient.email,
    birth_date: patient.birth_date,
    gender: patient.gender as 'M' | 'F' | 'Otro',
    address: patient.address,
    municipality: patient.municipality,
    municipality_name: patient.municipality_name,
    municipality_id: patient.municipality_id,
    zone: patient.zone,
    blood_type: patient.blood_type,
    allergies: patient.allergies,
    chronic_conditions: patient.chronic_conditions,
    eps: patient.eps,
    affiliation_type: patient.affiliation_type,
    education_level: patient.education_level,
    marital_status: patient.marital_status,
    occupation: patient.occupation,
    status: patient.status,
  };
}
