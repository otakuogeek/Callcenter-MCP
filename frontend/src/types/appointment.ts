// Tipos TypeScript para la estructura mejorada de appointments
// Sincronizado con la nueva estructura de base de datos

export interface AppointmentComplete {
  // Campos existentes
  id: number;
  patient_id: number;
  availability_id?: number;
  location_id: number;
  specialty_id: number;
  doctor_id: number;
  scheduled_at: string; // datetime
  duration_minutes: number;
  appointment_type: 'Presencial' | 'Telemedicina';
  status: 'Pendiente' | 'Confirmada' | 'Completada' | 'Cancelada';
  reason?: string; // Ampliado a TEXT
  insurance_type?: string; // Ampliado a VARCHAR(150)
  notes?: string; // TEXT
  cancellation_reason?: string;
  created_by_user_id?: number;
  created_at: string; // timestamp

  // Nuevos campos agregados en la migración
  consultation_reason_detailed?: string; // TEXT - Motivo detallado de la consulta
  additional_notes?: string; // TEXT - Notas adicionales específicas
  priority_level?: 'Baja' | 'Normal' | 'Alta' | 'Urgente'; // Nivel de prioridad
  insurance_company?: string; // VARCHAR(100) - Compañía de seguros específica
  insurance_policy_number?: string; // VARCHAR(50) - Número de póliza
  appointment_source?: 'Manual' | 'Sistema_Inteligente' | 'Llamada' | 'Web' | 'App'; // Origen de la cita
  reminder_sent?: boolean; // TINYINT(1) - Si se envió recordatorio
  reminder_sent_at?: string; // timestamp - Fecha de envío de recordatorio
  preferred_time?: string; // VARCHAR(50) - Horario preferido del paciente
  symptoms?: string; // TEXT - Síntomas reportados
  allergies?: string; // TEXT - Alergias reportadas para esta cita
  medications?: string; // TEXT - Medicamentos actuales
  emergency_contact_name?: string; // VARCHAR(100) - Contacto de emergencia
  emergency_contact_phone?: string; // VARCHAR(30) - Teléfono de emergencia
  follow_up_required?: boolean; // TINYINT(1) - Si requiere seguimiento
  follow_up_date?: string; // DATE - Fecha sugerida para seguimiento
  payment_method?: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Seguro' | 'Credito'; // Método de pago
  copay_amount?: number; // DECIMAL(10,2) - Monto de copago
  updated_at?: string; // timestamp - Fecha de última actualización
}

// Interface para crear una nueva cita (campos requeridos)
export interface AppointmentCreate {
  patient_id: number;
  availability_id?: number;
  location_id: number;
  specialty_id: number;
  doctor_id: number;
  scheduled_at: string;
  duration_minutes?: number;
  appointment_type?: 'Presencial' | 'Telemedicina';
  status?: 'Pendiente' | 'Confirmada' | 'Completada' | 'Cancelada';
  reason?: string;
  insurance_type?: string;
  notes?: string;
  consultation_reason_detailed?: string;
  additional_notes?: string;
  priority_level?: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  insurance_company?: string;
  insurance_policy_number?: string;
  appointment_source?: 'Manual' | 'Sistema_Inteligente' | 'Llamada' | 'Web' | 'App';
  preferred_time?: string;
  symptoms?: string;
  allergies?: string;
  medications?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  payment_method?: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Seguro' | 'Credito';
  copay_amount?: number;
  created_by_user_id?: number;
}

// Interface para actualizar una cita (todos los campos opcionales excepto ID)
export interface AppointmentUpdate {
  patient_id?: number;
  availability_id?: number;
  location_id?: number;
  specialty_id?: number;
  doctor_id?: number;
  scheduled_at?: string;
  duration_minutes?: number;
  appointment_type?: 'Presencial' | 'Telemedicina';
  status?: 'Pendiente' | 'Confirmada' | 'Completada' | 'Cancelada';
  reason?: string;
  insurance_type?: string;
  notes?: string;
  cancellation_reason?: string;
  consultation_reason_detailed?: string;
  additional_notes?: string;
  priority_level?: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  insurance_company?: string;
  insurance_policy_number?: string;
  appointment_source?: 'Manual' | 'Sistema_Inteligente' | 'Llamada' | 'Web' | 'App';
  reminder_sent?: boolean;
  reminder_sent_at?: string;
  preferred_time?: string;
  symptoms?: string;
  allergies?: string;
  medications?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  payment_method?: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Seguro' | 'Credito';
  copay_amount?: number;
}

// Interface con datos relacionados (joins) para mostrar en la UI
export interface AppointmentWithDetails extends AppointmentComplete {
  // Datos del paciente
  patient_name?: string;
  patient_document?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_birth_date?: string;
  patient_gender?: string;

  // Datos del doctor
  doctor_name?: string;

  // Datos de especialidad
  specialty_name?: string;

  // Datos de ubicación
  location_name?: string;
  location_address?: string;
}

// Interface para formularios de citas
export interface AppointmentFormData {
  // Información básica
  patientId: number | null;
  availabilityId?: number | null;
  locationId?: number;
  specialtyId?: number;
  doctorId?: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  duration: string; // minutos como string para Select
  appointmentType: 'Presencial' | 'Telemedicina';
  
  // Motivo y notas
  reason: string;
  consultationReasonDetailed: string;
  notes: string;
  additionalNotes: string;
  
  // Información médica
  symptoms: string;
  allergies: string;
  medications: string;
  
  // Prioridad y seguimiento
  priorityLevel: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  followUpRequired: boolean;
  followUpDate: string; // YYYY-MM-DD
  
  // Seguro y pago
  insuranceType: string;
  insuranceCompany: string;
  insurancePolicyNumber: string;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Seguro' | 'Credito' | '';
  copayAmount: string; // como string para Input
  
  // Contacto de emergencia
  emergencyContactName: string;
  emergencyContactPhone: string;
  
  // Preferencias
  preferredTime: string;
  
  // Metadatos
  appointmentSource: 'Manual' | 'Sistema_Inteligente' | 'Llamada' | 'Web' | 'App';
}

// Interface para validación de formularios
export interface AppointmentValidationErrors {
  patientId?: string;
  date?: string;
  time?: string;
  duration?: string;
  reason?: string;
  consultationReasonDetailed?: string;
  doctorId?: string;
  specialtyId?: string;
  locationId?: string;
  copayAmount?: string;
  followUpDate?: string;
  general?: string;
}

// Opciones para dropdowns
export interface AppointmentTypeOption {
  value: 'Presencial' | 'Telemedicina';
  label: string;
  description?: string;
}

export interface PriorityLevelOption {
  value: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  label: string;
  color: string;
  description?: string;
}

export interface PaymentMethodOption {
  value: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Seguro' | 'Credito';
  label: string;
  description?: string;
}

export interface AppointmentSourceOption {
  value: 'Manual' | 'Sistema_Inteligente' | 'Llamada' | 'Web' | 'App';
  label: string;
  description?: string;
}

// Constantes de opciones
export const APPOINTMENT_TYPE_OPTIONS: AppointmentTypeOption[] = [
  { value: 'Presencial', label: 'Presencial', description: 'Cita en las instalaciones médicas' },
  { value: 'Telemedicina', label: 'Telemedicina', description: 'Consulta virtual/telefónica' },
];

export const PRIORITY_LEVEL_OPTIONS: PriorityLevelOption[] = [
  { value: 'Baja', label: 'Baja', color: 'text-green-600', description: 'Sin urgencia' },
  { value: 'Normal', label: 'Normal', color: 'text-blue-600', description: 'Prioridad estándar' },
  { value: 'Alta', label: 'Alta', color: 'text-orange-600', description: 'Requiere atención pronta' },
  { value: 'Urgente', label: 'Urgente', color: 'text-red-600', description: 'Requiere atención inmediata' },
];

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: 'Efectivo', label: 'Efectivo', description: 'Pago en efectivo' },
  { value: 'Tarjeta', label: 'Tarjeta', description: 'Tarjeta de crédito/débito' },
  { value: 'Transferencia', label: 'Transferencia', description: 'Transferencia bancaria' },
  { value: 'Seguro', label: 'Seguro', description: 'Cubierto por seguro médico' },
  { value: 'Credito', label: 'Crédito', description: 'Pago a crédito' },
];

export const APPOINTMENT_SOURCE_OPTIONS: AppointmentSourceOption[] = [
  { value: 'Manual', label: 'Manual', description: 'Creada manualmente por usuario' },
  { value: 'Sistema_Inteligente', label: 'Sistema Inteligente', description: 'Asignada automáticamente' },
  { value: 'Llamada', label: 'Llamada', description: 'Agendada por teléfono' },
  { value: 'Web', label: 'Web', description: 'Agendada desde sitio web' },
  { value: 'App', label: 'App', description: 'Agendada desde aplicación móvil' },
];

export const DURATION_OPTIONS = [
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '45', label: '45 minutos' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1 hora 30 min' },
  { value: '120', label: '2 horas' },
];

// Funciones de utilidad
export const getDefaultAppointmentFormData = (): AppointmentFormData => ({
  patientId: null,
  availabilityId: null,
  locationId: undefined,
  specialtyId: undefined,
  doctorId: undefined,
  date: '',
  time: '',
  duration: '30',
  appointmentType: 'Presencial',
  reason: '',
  consultationReasonDetailed: '',
  notes: '',
  additionalNotes: '',
  symptoms: '',
  allergies: '',
  medications: '',
  priorityLevel: 'Normal',
  followUpRequired: false,
  followUpDate: '',
  insuranceType: '',
  insuranceCompany: '',
  insurancePolicyNumber: '',
  paymentMethod: '' as any,
  copayAmount: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  preferredTime: '',
  appointmentSource: 'Manual',
});

export const convertFormDataToAppointmentCreate = (
  formData: AppointmentFormData
): AppointmentCreate => ({
  patient_id: formData.patientId!,
  availability_id: formData.availabilityId || undefined,
  location_id: formData.locationId!,
  specialty_id: formData.specialtyId!,
  doctor_id: formData.doctorId!,
  scheduled_at: `${formData.date}T${formData.time}:00`,
  duration_minutes: parseInt(formData.duration),
  appointment_type: formData.appointmentType,
  status: 'Pendiente',
  reason: formData.reason || undefined,
  consultation_reason_detailed: formData.consultationReasonDetailed || undefined,
  additional_notes: formData.additionalNotes || undefined,
  notes: formData.notes || undefined,
  priority_level: formData.priorityLevel,
  insurance_type: formData.insuranceType || undefined,
  insurance_company: formData.insuranceCompany || undefined,
  insurance_policy_number: formData.insurancePolicyNumber || undefined,
  appointment_source: formData.appointmentSource,
  preferred_time: formData.preferredTime || undefined,
  symptoms: formData.symptoms || undefined,
  allergies: formData.allergies || undefined,
  medications: formData.medications || undefined,
  emergency_contact_name: formData.emergencyContactName || undefined,
  emergency_contact_phone: formData.emergencyContactPhone || undefined,
  follow_up_required: formData.followUpRequired,
  follow_up_date: formData.followUpDate || undefined,
  payment_method: formData.paymentMethod || undefined,
  copay_amount: formData.copayAmount ? parseFloat(formData.copayAmount) : undefined,
});