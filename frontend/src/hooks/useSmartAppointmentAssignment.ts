import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

export interface SmartAssignmentRequest {
  // Información del paciente
  patientDocument: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  
  // Preferencias de cita
  specialtyId: number;
  locationId?: number;
  preferredDoctorId?: number;
  urgencyLevel: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  appointmentType: 'Presencial' | 'Telemedicina';
  durationMinutes: number;
  
  // Información adicional
  reason?: string;
  insuranceType?: string;
  notes?: string;
  
  // Configuración de búsqueda
  searchDaysAhead?: number;
  preferredTimeSlots?: string[];
}

export interface AssignmentResult {
  success: boolean;
  assignmentType: 'appointment' | 'queue';
  
  // Para citas asignadas
  appointment?: {
    id: number;
    scheduledAt: string;
    doctor: {
      id: number;
      name: string;
    };
    location: {
      id: number;
      name: string;
    };
    specialty: {
      id: number;
      name: string;
    };
  };
  
  // Para entrada en cola
  queueEntry?: {
    id: number;
    position: number;
    estimatedWaitTime?: string;
    specialty: {
      id: number;
      name: string;
    };
  };
  
  // Información adicional
  message: string;
  patient: {
    id: number;
    name: string;
    document: string;
  };
  alternatives?: Array<{
    date: string;
    time: string;
    doctorName: string;
    locationName: string;
    score: number;
  }>;
}

export function useSmartAppointmentAssignment() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssignmentResult | null>(null);
  const { toast } = useToast();

  const performSmartAssignment = async (request: SmartAssignmentRequest): Promise<AssignmentResult> => {
    setLoading(true);
    setResult(null);

    try {
      // 1. Buscar o crear paciente
      let patientId: number;
      
      try {
        // Buscar paciente existente
        const existingPatients = await api.getPatients(request.patientDocument);
        const existingPatient = existingPatients?.find((p: any) => 
          String(p.document) === request.patientDocument.trim()
        );
        
        if (existingPatient) {
          patientId = Number(existingPatient.id);
        } else {
          // Crear nuevo paciente
          const newPatient = await api.createPatient({
            document: request.patientDocument.trim(),
            name: request.patientName.trim(),
            phone: request.patientPhone || null,
            email: request.patientEmail || null,
            status: 'Activo',
          });
          patientId = Number((newPatient as any).id);
        }
      } catch (error) {
        throw new Error('Error procesando información del paciente');
      }

      // 2. Intentar asignación automática de cita
      try {
        const autoAssignmentRequest = {
          patient_id: patientId,
          specialty_id: request.specialtyId,
          location_id: request.locationId,
          preferred_doctor_id: request.preferredDoctorId,
          urgency_level: request.urgencyLevel,
          appointment_type: request.appointmentType,
          duration_minutes: request.durationMinutes,
          reason: request.reason,
          insurance_type: request.insuranceType,
          notes: request.notes,
          search_days_ahead: request.searchDaysAhead || 30,
          preferred_time_slots: request.preferredTimeSlots,
        };

        const assignmentResponse = await api.post('/auto-assignment/smart-assign', autoAssignmentRequest);
        
        if (assignmentResponse.data.success) {
          if (assignmentResponse.data.assignment_type === 'appointment') {
            // Cita asignada exitosamente
            const appointment = assignmentResponse.data.data.appointment;
            
            const successResult: AssignmentResult = {
              success: true,
              assignmentType: 'appointment',
              appointment: {
                id: appointment.id,
                scheduledAt: appointment.scheduled_at,
                doctor: {
                  id: appointment.doctor_id,
                  name: appointment.doctor_name,
                },
                location: {
                  id: appointment.location_id,
                  name: appointment.location_name,
                },
                specialty: {
                  id: appointment.specialty_id,
                  name: appointment.specialty_name,
                },
              },
              message: `¡Cita asignada exitosamente! Programada para ${formatDate(appointment.scheduled_at)} con ${appointment.doctor_name}`,
              patient: {
                id: patientId,
                name: request.patientName,
                document: request.patientDocument,
              },
            };

            setResult(successResult);
            
            toast({
              title: "¡Cita asignada exitosamente!",
              description: successResult.message,
              variant: "default",
            });

            return successResult;
            
          } else if (assignmentResponse.data.assignment_type === 'queue') {
            // Agregado a cola automáticamente
            const queueEntry = assignmentResponse.data.data.queue_entry;
            
            const queueResult: AssignmentResult = {
              success: true,
              assignmentType: 'queue',
              queueEntry: {
                id: queueEntry.id,
                position: queueEntry.position,
                estimatedWaitTime: calculateEstimatedWaitTime(queueEntry.position),
                specialty: {
                  id: request.specialtyId,
                  name: queueEntry.specialty_name,
                },
              },
              message: assignmentResponse.data.message,
              patient: {
                id: patientId,
                name: request.patientName,
                document: request.patientDocument,
              },
            };

            setResult(queueResult);
            
            toast({
              title: "Agregado a cola de espera",
              description: queueResult.message,
              variant: "default",
            });

            return queueResult;
          }
        }
      } catch (error: any) {
        throw new Error(`Error en asignación: ${error.response?.data?.message || error.message}`);
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Error inesperado';
      
      toast({
        title: "Error en asignación",
        description: errorMessage,
        variant: "destructive",
      });

      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetResult = () => {
    setResult(null);
  };

  return {
    loading,
    result,
    performSmartAssignment,
    resetResult,
  };
}

// Funciones auxiliares
function mapUrgencyToPriority(urgency: 'Baja' | 'Media' | 'Alta' | 'Urgente'): 'Baja' | 'Normal' | 'Alta' {
  switch (urgency) {
    case 'Baja':
      return 'Baja';
    case 'Media':
      return 'Normal';
    case 'Alta':
    case 'Urgente':
      return 'Alta';
    default:
      return 'Normal';
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function calculateEstimatedWaitTime(position: number): string {
  // Estimación simple: 15 minutos por persona en cola
  const estimatedMinutes = position * 15;
  
  if (estimatedMinutes < 60) {
    return `${estimatedMinutes} minutos`;
  } else {
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
}