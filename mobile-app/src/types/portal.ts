export interface Patient {
  patient_id: number;
  id?: number;
  name: string;
  document: string;
  phone?: string;
  email?: string;
  insurance_eps_id?: number;
  eps_name?: string;
}

export interface Appointment {
  appointment_id: number;
  specialty_id: number;
  specialty_name: string;
  doctor_name: string;
  location_name: string;
  location_address?: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  reason?: string;
  relatedAppointmentId?: number;
}

export interface WaitingListItem {
  id: number;
  waiting_list_id?: number;
  specialty_id: number;
  specialty_name: string;
  priority_level?: string;
  queue_position?: number;
  status: string;
  created_at?: string;
}

export interface SmsNotification {
  id: number;
  message: string;
  sent_at: string;
  status?: string;
  read_at?: string | null;
}

export interface Specialty {
  id: number;
  name: string;
  description?: string;
  allows_double_appointment?: number | boolean;
}

export interface LocationAuthorization {
  id: number;
  name: string;
  address?: string;
  zone_name?: string;
  eps_name?: string;
}

export interface PublicAvailability {
  id?: number;
  availability_id?: number;
  doctor_id: number;
  doctor_name: string;
  specialty_id: number;
  specialty_name: string;
  location_id: number;
  location_name: string;
  location_address?: string;
  date: string;
  start_time: string;
  end_time: string;
  available_slots: number;
  available_time_slots?: string[];
}

export interface WaitingListResponse {
  success: boolean;
  data?: {
    waiting_list_id: number;
    position: number;
    message: string;
  };
  error?: string;
}
