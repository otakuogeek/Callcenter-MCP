/**
 * Tipos TypeScript mejorados para la API
 * Reemplaza los 'any' genéricos con tipos específicos
 */

// ===== Patient Types =====
export interface CreatePatientData {
  name: string;
  document: string;
  document_type?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'Otro';
  phone?: string;
  email?: string;
  address?: string;
  municipality_id?: number;
  blood_type?: string;
  allergies?: string;
  chronic_conditions?: string;
  eps_id?: number;
  affiliation_type?: string;
  education_level?: string;
  marital_status?: string;
  occupation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface UpdatePatientData extends Partial<CreatePatientData> {
  id: number;
}

// ===== Doctor Types =====
export interface CreateDoctorData {
  name: string;
  specialty_id: number;
  license_number?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
}

export interface UpdateDoctorData extends Partial<CreateDoctorData> {
  id: number;
}

// ===== Specialty Types =====
export interface CreateSpecialtyData {
  name: string;
  description?: string;
  duration_minutes?: number;
}

export interface UpdateSpecialtyData extends Partial<CreateSpecialtyData> {
  id: number;
}

// ===== Location Types =====
export interface CreateLocationData {
  name: string;
  address?: string;
  phone?: string;
  municipality_id?: number;
  location_type_id?: number;
  is_active?: boolean;
}

export interface UpdateLocationData extends Partial<CreateLocationData> {
  id: number;
}

// ===== EPS Types =====
export interface CreateEpsData {
  name: string;
  nit?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
}

export interface UpdateEpsData extends Partial<CreateEpsData> {
  id: number;
}

// ===== Zone Types =====
export interface CreateZoneData {
  name: string;
  department?: string;
  code?: string;
}

export interface UpdateZoneData extends Partial<CreateZoneData> {
  id: number;
}

// ===== Location Type =====
export interface CreateLocationTypeData {
  name: string;
  description?: string;
}

export interface UpdateLocationTypeData extends Partial<CreateLocationTypeData> {
  id: number;
}

// ===== API Response Types =====
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ===== Availability Types =====
export interface GroupedAvailability {
  grouped_by_date: {
    [date: string]: any[]; // Mantenido por compatibilidad, mejorar después
  };
}
