// ============================================
// TIPOS COMPLETOS PARA SISTEMA DE PACIENTES  
// ============================================

// Tipo principal de Paciente con todos los campos
export interface Patient {
  // Identificación
  id: number;
  external_id?: string;
  document: string;
  document_type_id?: number;
  document_type?: string;
  
  // Información Básica
  name: string;
  birth_date?: string;
  gender: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado';
  status: 'Activo' | 'Inactivo';
  
  // Información de Contacto
  phone?: string;
  phone_alt?: string;
  email?: string;
  address?: string;
  municipality_id?: number;
  municipality?: string;
  municipality_name?: string;
  zone_id?: number;
  zone?: string;
  
  // Información Médica
  blood_group_id?: number;
  blood_group?: string;
  blood_group_name?: string;
  
  // Información de Seguro
  insurance_eps_id?: number;
  eps_name?: string;
  insurance_affiliation_type?: 'Contributivo' | 'Subsidiado' | 'Vinculado' | 'Particular' | 'Otro';
  
  // Información Demográfica
  population_group_id?: number;
  population_group?: string;
  education_level_id?: number;
  education_level?: string;
  marital_status_id?: number;
  marital_status?: string;
  has_disability: boolean;
  disability_type_id?: number;
  disability_type?: string;
  estrato?: number;
  
  // Notas y Metadata
  notes?: string;
  created_at: string;
  
  // Campos calculados (frontend)
  age?: number;
  avatar_color?: string;
  initials?: string;
}

// Filtros avanzados para búsqueda de pacientes
export interface PatientFilters {
  search?: string;
  eps_ids?: number[];
  status?: 'Activo' | 'Inactivo' | 'Todos';
  gender?: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado' | 'Todos';
  affiliation_type?: string;
  age_min?: number;
  age_max?: number;
  municipality_ids?: number[];
  has_disability?: boolean;
  estrato?: number;
  created_from?: string;
  created_to?: string;
}

// Opciones de ordenamiento
export interface PatientSortOptions {
  field: 'name' | 'document' | 'birth_date' | 'created_at' | 'status' | 'eps_name';
  order: 'asc' | 'desc';
}

// Paginación
export interface PatientPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

// Respuesta completa de listado
export interface PatientsListResponse {
  success: boolean;
  data: Patient[];
  pagination: PatientPagination;
  filters_applied?: PatientFilters;
}

// Estadísticas de pacientes
export interface PatientStats {
  total: number;
  active: number;
  inactive: number;
  new_this_month: number;
  
  by_gender: {
    masculino: number;
    femenino: number;
    otro: number;
    no_especificado: number;
  };
  
  by_age_range: {
    '0-17': number;
    '18-30': number;
    '31-45': number;
    '46-60': number;
    '60+': number;
  };
  
  by_eps: Array<{
    eps_id: number;
    eps_name: string;
    count: number;
    percentage: number;
  }>;
  
  by_affiliation_type: {
    contributivo: number;
    subsidiado: number;
    vinculado: number;
    particular: number;
    otro: number;
  };
  
  by_municipality: Array<{
    municipality_id: number;
    municipality_name: string;
    count: number;
  }>;
}

// Opciones para exportación a PDF
export interface PDFExportOptions {
  type: 'individual' | 'list';
  patient_id?: number;
  filters?: PatientFilters;
  columns?: Array<{
    field: keyof Patient;
    label: string;
    width?: number;
  }>;
  include_stats?: boolean;
  include_logo?: boolean;
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

// Datos del formulario para crear/editar
export interface PatientFormData {
  // Step 1: Información Básica
  document: string;
  document_type_id?: number;
  name: string;
  birth_date?: string;
  gender: string;
  
  // Step 2: Información de Contacto
  phone?: string;
  phone_alt?: string;
  email?: string;
  address?: string;
  municipality_id?: number;
  zone_id?: number;
  
  // Step 3: Información Médica
  blood_group_id?: number;
  
  // Step 4: Información de Seguro
  insurance_eps_id?: number;
  insurance_affiliation_type?: string;
  
  // Step 5: Información Demográfica
  population_group_id?: number;
  education_level_id?: number;
  marital_status_id?: number;
  has_disability: boolean;
  disability_type_id?: number;
  estrato?: number;
  
  // Notas
  notes?: string;
}

// Validación de formulario por pasos
export interface FormStepValidation {
  step: number;
  is_valid: boolean;
  errors: Record<string, string>;
}

// Historial de citas del paciente
export interface PatientAppointment {
  id: number;
  appointment_date: string;
  scheduled_time: string;
  scheduled_date: string;
  specialty_name: string;
  doctor_name: string;
  status: string;
  reason?: string;
  notes?: string;
}

// Respuesta de historial de citas
export interface PatientAppointmentsResponse {
  success: boolean;
  data: PatientAppointment[];
  total: number;
}

// Acciones en lote
export interface BatchAction {
  action: 'activate' | 'deactivate' | 'delete' | 'export_pdf';
  patient_ids: number[];
}

// Vista de configuración (para guardar preferencias del usuario)
export interface PatientViewConfig {
  items_per_page: number;
  default_sort: PatientSortOptions;
  visible_columns: string[];
  default_filters: Partial<PatientFilters>;
}

// Colores para avatares (se asignan por ID)
export const AVATAR_COLORS = [
  '#FF6B6B', // Rojo
  '#4ECDC4', // Turquesa
  '#45B7D1', // Azul
  '#96CEB4', // Verde
  '#FFEAA7', // Amarillo
  '#DFE6E9', // Gris
  '#74B9FF', // Azul claro
  '#A29BFE', // Púrpura
  '#FD79A8', // Rosa
  '#FDCB6E', // Naranja
];

// Función helper para obtener iniciales
export const getInitials = (name: string): string => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Función helper para calcular edad
export const calculateAge = (birthDate: string): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Función helper para obtener color de avatar por ID
export const getAvatarColor = (id: number): string => {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
};

// Función helper para formatear nombre de EPS
export const formatEPSName = (epsName?: string): string => {
  if (!epsName) return 'Sin EPS';
  return epsName.toUpperCase();
};

// Función helper para badge de estado
export const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
  return status === 'Activo' ? 'default' : 'secondary';
};

// Función helper para badge de género
export const getGenderBadgeColor = (gender: string): string => {
  switch (gender) {
    case 'Masculino': return 'bg-blue-100 text-blue-800';
    case 'Femenino': return 'bg-pink-100 text-pink-800';
    case 'Otro': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Función helper para badge de tipo de afiliación
export const getAffiliationBadgeColor = (type?: string): string => {
  switch (type) {
    case 'Contributivo': return 'bg-green-100 text-green-800';
    case 'Subsidiado': return 'bg-blue-100 text-blue-800';
    case 'Vinculado': return 'bg-yellow-100 text-yellow-800';
    case 'Particular': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Columnas por defecto para exportación
export const DEFAULT_PDF_COLUMNS: Array<{field: keyof Patient; label: string; width?: number}> = [
  { field: 'document', label: 'Documento', width: 80 },
  { field: 'name', label: 'Nombre Completo', width: 120 },
  { field: 'phone', label: 'Teléfono', width: 70 },
  { field: 'eps_name', label: 'EPS', width: 80 },
  { field: 'insurance_affiliation_type', label: 'Tipo', width: 60 },
  { field: 'status', label: 'Estado', width: 50 },
];

// ============================================
// TIPOS PARA LOOKUPS (Municipios, Zonas, EPS)
// ============================================

export interface Municipality {
  id: number;
  name: string;
  zone_id?: number;
  zone_name?: string;
}

export interface Zone {
  id: number;
  name: string;
}

export interface EPS {
  id: number;
  code: string;
  name: string;
  affiliation_type: string;
  phone?: string;
  email?: string;
  website?: string;
  status: string;
  has_agreement: number;
}

