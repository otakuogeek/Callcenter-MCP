/**
 * Estado de conversación y contexto para el flujo de WhatsApp
 * @module whatsapp/types/state
 */

export enum ConversationState {
  IDLE = 'idle',
  AWAITING_DOCUMENT = 'awaiting_document',
  AWAITING_PATIENT_DATA = 'awaiting_patient_data',
  AWAITING_PHONE_CONFIRMATION = 'awaiting_phone_confirmation',
  AWAITING_SPECIALTY = 'awaiting_specialty',
  AWAITING_LOCATION = 'awaiting_location',
  AWAITING_DOCTOR_SELECTION = 'awaiting_doctor_selection',
  AWAITING_DATE = 'awaiting_date',
  AWAITING_TIME_PREFERENCE = 'awaiting_time_preference',
  AWAITING_TIME = 'awaiting_time',
  AWAITING_REASON = 'awaiting_reason',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  CHECKING_APPOINTMENTS = 'checking_appointments',
  CANCELING_APPOINTMENT = 'canceling_appointment',
  RESCHEDULING = 'rescheduling',
  WAITING_LIST = 'waiting_list',
  AWAITING_BENEFICIARY = 'awaiting_beneficiary',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface StateContext {
  currentState: ConversationState;
  previousState?: ConversationState;
  suppressAutoIdentifyUntil?: number;
  confirmationRequestedAt?: number;

  // Paciente (beneficiario de la cita)
  patientId?: number;
  patientName?: string;
  patientDocument?: string;
  patientPhone?: string;
  registrationPending?: boolean;

  // Solicitante (quien chatea — puede ser distinto al beneficiario)
  isThirdParty?: boolean;
  requestorPatientId?: number;
  requestorPatientName?: string;
  requestorPatientDocument?: string;

  // Especialidad
  specialty?: any;
  specialtyId?: number;
  specialtyName?: string;

  // Doctor
  selectedDoctor?: string;
  selectedDoctorId?: number;

  // Ubicación
  selectedLocation?: string;
  selectedLocationId?: number;

  // Fecha/Hora
  selectedDate?: string;
  selectedTime?: string;
  scheduledDatetime?: string;

  // Disponibilidad
  availabilityId?: number;
  timeSlots?: any[];
  availableDoctors?: any[];
  availableAppointments?: any[];
  timePreference?: 'morning' | 'afternoon' | 'any';

  // Tracking
  lastQuestion?: string;
  lastAppointmentId?: number;
  appointmentToCancel?: number;
  appointmentToReschedule?: number;
  pendingIntent?: string;
  reason?: string;
  cancelAll?: boolean;

  // Métricas
  retryCount: number;
  lastError?: string;
  timestamp: number;
  createdAt: number;
  stateTransitions: number;
}

/** Crea un StateContext nuevo con valores por defecto */
export function createDefaultStateContext(): StateContext {
  const now = Date.now();
  return {
    currentState: ConversationState.IDLE,
    retryCount: 0,
    timestamp: now,
    createdAt: now,
    stateTransitions: 0
  };
}
