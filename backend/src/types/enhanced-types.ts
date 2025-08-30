// ==============================================
// NUEVOS TIPOS TYPESCRIPT PARA BD MEJORADA
// ==============================================
// Enhanced types para integrar con las mejoras de BD
export interface AuditLog {
  id: number;
  table_name: string;
  record_id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface UserSession {
  id: string;
  user_id: number;
  ip_address: string;
  user_agent?: string;
  last_activity: Date;
  created_at: Date;
  expires_at: Date;
}

export interface Notification {
  id: number;
  user_id?: number;
  patient_id?: number;
  type: 'appointment_reminder' | 'appointment_confirmation' | 'payment_due' | 'system_alert' | 'ai_transfer' | 'call_started' | 'call_ended';
  title: string;
  message: string;
  data?: Record<string, any>;
  sent_via?: ('email' | 'sms' | 'push' | 'in_app')[];
  sent_at?: Date;
  read_at?: Date;
  status: 'pending' | 'sent' | 'failed' | 'read';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: Date;
}

export interface PatientDocument {
  id: number;
  patient_id: number;
  appointment_id?: number;
  document_type: 'cedula' | 'orden_medica' | 'resultado_laboratorio' | 'imagen_diagnostica' | 'historia_clinica' | 'consentimiento' | 'otro';
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by_user_id?: number;
  notes?: string;
  created_at: Date;
}

export interface AppointmentReminder {
  id: number;
  appointment_id: number;
  reminder_type: '24h_before' | '2h_before' | '30m_before' | 'custom';
  scheduled_for: Date;
  sent_at?: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  method: 'email' | 'sms' | 'call' | 'whatsapp';
  attempts: number;
  last_error?: string;
  created_at: Date;
}

export interface DailyMetrics {
  id: number;
  date: Date;
  location_id?: number;
  specialty_id?: number;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  no_show_appointments: number;
  total_patients: number;
  new_patients: number;
  total_revenue: number;
  avg_wait_time_minutes?: number;
  patient_satisfaction_avg?: number;
  created_at: Date;
  updated_at: Date;
}

export interface SatisfactionSurvey {
  id: number;
  appointment_id: number;
  patient_id: number;
  doctor_id: number;
  overall_rating: number; // 1-5
  doctor_rating?: number; // 1-5
  facility_rating?: number; // 1-5
  wait_time_rating?: number; // 1-5
  would_recommend?: boolean;
  comments?: string;
  submitted_at: Date;
}

// Enhanced Patient type
export interface EnhancedPatient {
  id: number;
  external_id?: string;
  document: string;
  name: string;
  phone?: string;
  email?: string;
  birth_date?: Date;
  gender: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado';
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  allergies?: string;
  medical_history?: string;
  blood_type?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Desconocido';
  marital_status?: 'Soltero' | 'Casado' | 'Divorciado' | 'Viudo' | 'Unión libre' | 'Otro';
  occupation?: string;
  notes?: string;
  last_visit_date?: Date;
  municipality_id?: number;
  zone_id?: number;
  insurance_eps_id?: number;
  status: 'Activo' | 'Inactivo';
  created_at: Date;
  updated_at: Date;
}

// Enhanced Doctor type
export interface EnhancedDoctor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  license_number: string;
  specialization?: string;
  years_experience?: number;
  education?: string;
  bio?: string;
  consultation_fee?: number;
  emergency_available: boolean;
  languages?: string;
  rating?: number;
  total_reviews: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Enhanced Appointment type
export interface EnhancedAppointment {
  id: number;
  patient_id: number;
  availability_id?: number;
  location_id: number;
  specialty_id: number;
  doctor_id: number;
  scheduled_at: Date;
  patient_arrival_time?: Date;
  doctor_start_time?: Date;
  appointment_end_time?: Date;
  wait_time_minutes?: number;
  duration_minutes: number;
  appointment_type: 'Presencial' | 'Telemedicina';
  status: 'Pendiente' | 'Confirmada' | 'Completada' | 'Cancelada';
  reason?: string;
  insurance_type?: string;
  notes?: string;
  cancellation_reason?: string;
  reminder_sent: boolean;
  confirmation_sent: boolean;
  created_by_user_id?: number;
  created_at: Date;
  updated_at: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
