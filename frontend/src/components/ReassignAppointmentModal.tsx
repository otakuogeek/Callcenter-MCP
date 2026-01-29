import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar, Clock, MapPin, User, ArrowRight, Users, AlertTriangle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// Función para convertir hora 24h a formato 12h AM/PM
const formatTimeToAMPM = (time24: string | null | undefined): string => {
  if (!time24) return 'N/A';
  
  // Extraer solo HH:mm si viene con segundos
  const timePart = time24.substring(0, 5);
  const [hoursStr, minutesStr] = timePart.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr;
  
  if (isNaN(hours)) return time24;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; // Convertir 0 a 12 y 13-23 a 1-11
  
  return `${hours}:${minutes} ${period}`;
};

// Causas predefinidas para el traslado de citas
const TRANSFER_REASONS = [
  { id: 'doctor_absence', label: 'Ausencia del médico', description: 'El médico no puede atender en la fecha programada' },
  { id: 'doctor_illness', label: 'Enfermedad del médico', description: 'El médico se encuentra incapacitado' },
  { id: 'medical_emergency', label: 'Emergencia médica', description: 'El médico debe atender una emergencia' },
  { id: 'schedule_change', label: 'Cambio de horario', description: 'Reorganización de la agenda médica' },
  { id: 'equipment_unavailable', label: 'Equipo no disponible', description: 'El equipo necesario no está disponible' },
  { id: 'location_issue', label: 'Problema en la sede', description: 'Inconveniente en la sede de atención' },
  { id: 'patient_request', label: 'Solicitud del paciente', description: 'El paciente solicitó el cambio' },
  { id: 'other', label: 'Otra causa', description: 'Especificar la causa del traslado' },
] as const;

interface AvailableAgenda {
  id: number;
  location_id: number;
  specialty_id: number;
  doctor_id: number;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_slots: number;
  available_slots: number;
  duration_minutes: number;
  status: string;
  location_name: string;
  specialty_name: string;
  doctor_name: string;
  available_time_slots?: string[];
}

interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: number;
  patientName: string;
  currentAvailabilityId: number;
  onReassignSuccess: () => void;
  patientPhone?: string | null;
  currentDoctor?: string;
  currentDate?: string;
  currentTime?: string;
  currentLocation?: string;
}

const ReassignAppointmentModal: React.FC<ReassignModalProps> = ({
  isOpen,
  onClose,
  appointmentId,
  patientName,
  currentAvailabilityId,
  onReassignSuccess,
  patientPhone,
  currentDoctor,
  currentDate,
  currentTime,
  currentLocation,
}) => {
  const [loading, setLoading] = useState(false);
  const [availableAgendas, setAvailableAgendas] = useState<AvailableAgenda[]>([]);
  const [specialtyName, setSpecialtyName] = useState('');
  const [selectedAgendaId, setSelectedAgendaId] = useState<number | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const { toast } = useToast();

  // Estados para la causa del traslado
  const [step, setStep] = useState<'reason' | 'select_agenda' | 'select_time'>('reason');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  
  // Estados para selección de hora
  const [selectedTime, setSelectedTime] = useState<string>('');

  useEffect(() => {
    if (isOpen && currentAvailabilityId) {
      // Resetear estados al abrir
      setStep('reason');
      setSelectedReason('');
      setCustomReason('');
      setSelectedAgendaId(null);
      setSelectedTime('');
      setAvailableAgendas([]);
    }
  }, [isOpen, currentAvailabilityId]);

  const loadAvailableAgendas = async () => {
    setLoading(true);
    try {
      const response = await api.getAvailableForReassignment(currentAvailabilityId);
      
      if (response.success && response.data) {
        setAvailableAgendas(response.data.available_agendas);
        setSpecialtyName(response.data.specialty_name);
      } else {
        toast({
          title: "Error",
          description: "No se pudieron cargar las agendas disponibles",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Error al cargar agendas disponibles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedAgendaId) {
      toast({
        title: "Seleccione una agenda",
        description: "Debe seleccionar una agenda de destino",
        variant: "destructive",
      });
      return;
    }

    const selectedAgenda = availableAgendas.find(a => a.id === selectedAgendaId);
    if (!selectedAgenda) return;

    // Validar que si hay horarios específicos disponibles, se haya seleccionado uno
    if (selectedAgenda.available_time_slots && selectedAgenda.available_time_slots.length > 0 && !selectedTime) {
      toast({
        title: "Seleccione un horario",
        description: "Debe seleccionar un horario específico para esta agenda",
        variant: "destructive",
      });
      return;
    }

    // Obtener la causa del traslado
    const reasonInfo = TRANSFER_REASONS.find(r => r.id === selectedReason);
    const finalReason = selectedReason === 'other' ? customReason : reasonInfo?.label || 'No especificada';

    const timeDisplay = selectedTime || selectedAgenda.start_time.slice(0, 5);
    const confirmMessage = `¿Está seguro de reasignar a ${patientName}?\n\n📋 Causa del traslado:\n${finalReason}\n\nNueva agenda:\n• Doctor: ${selectedAgenda.doctor_name}\n• Sede: ${selectedAgenda.location_name}\n• Fecha: ${format(new Date(selectedAgenda.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: es })}\n• Hora: ${timeDisplay}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setReassigning(true);

    try {
      const response = await api.reassignAppointment(appointmentId, selectedAgendaId, selectedTime || undefined, finalReason);

      if (response.success && response.data) {
        // Enviar SMS al paciente informando de la reasignación con la causa
        if (patientPhone) {
          try {
            const oldDateFormatted = currentDate 
              ? format(new Date(currentDate + 'T12:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
              : 'Fecha anterior';
            
            const newDateFormatted = format(
              new Date(response.data.new_date + 'T12:00:00'), 
              "EEEE, d 'de' MMMM 'de' yyyy", 
              { locale: es }
            );

            const message = `Estimado/a ${patientName}.\n\n` +
              `Le informamos que su cita ha sido REASIGNADA.\n\n` +
              `📝 MOTIVO DEL CAMBIO:\n${finalReason}\n\n` +
              `📅 CITA ANTERIOR:\n` +
              `👨‍⚕️ Doctor: ${currentDoctor || 'N/A'}\n` +
              `📍 Sede: ${currentLocation || 'N/A'}\n` +
              `📆 Fecha: ${oldDateFormatted}\n` +
              `🕐 Hora: ${formatTimeToAMPM(currentTime)}\n\n` +
              `✅ NUEVA CITA:\n` +
              `👨‍⚕️ Doctor: ${response.data.new_doctor}\n` +
              `📍 Sede: ${response.data.new_location}\n` +
              `📆 Fecha: ${newDateFormatted}\n` +
              `🕐 Hora: ${formatTimeToAMPM(response.data.new_time || selectedTime)}\n\n` +
              `Puede verificar su cita en:\n` +
              `🌐 https://biosanarcall.site/\n\n` +
              `Disculpe los inconvenientes.\n` +
              `- Fundación Biosanar IPS`;

            await fetch(`${import.meta.env.VITE_API_URL}/sms/send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                number: patientPhone,
                message,
                recipient_name: patientName,
                patient_id: appointmentId,
                template_id: 'appointment_reassignment',
                transfer_reason: finalReason
              })
            });
          } catch (smsError) {
            console.error('Error enviando SMS de reasignación:', smsError);
            // No detener el flujo si falla el SMS
          }
        }

        toast({
          title: "Reasignación exitosa",
          description: `${response.data.patient_name} ha sido reasignado/a exitosamente. ${patientPhone ? 'SMS enviado.' : ''}`,
          variant: "default",
        });

        onReassignSuccess();
        onClose();
      } else {
        toast({
          title: "Error",
          description: response.message || "No se pudo reasignar la cita",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error al reasignar",
        description: error?.message || "No se pudo completar la reasignación",
        variant: "destructive",
      });
    } finally {
      setReassigning(false);
    }
  };

  const safeFormatDate = (dateStr: string, formatStr: string, options?: any) => {
    try {
      // Agregar hora del mediodía para evitar problemas de zona horaria
      return format(new Date(dateStr + 'T12:00:00'), formatStr, options);
    } catch {
      return dateStr;
    }
  };

  // Función para continuar al siguiente paso
  const handleContinueToAgendas = () => {
    if (!selectedReason) {
      toast({
        title: "Seleccione una causa",
        description: "Debe seleccionar la causa del traslado",
        variant: "destructive",
      });
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      toast({
        title: "Especifique la causa",
        description: "Debe escribir la causa del traslado",
        variant: "destructive",
      });
      return;
    }

    setStep('select_agenda');
    loadAvailableAgendas();
  };

  // Función para volver al paso anterior
  const handleBackToReason = () => {
    setStep('reason');
    setSelectedAgendaId(null);
    setSelectedTime('');
  };

  // Función para seleccionar agenda y pasar a selección de hora
  const handleSelectAgenda = (agendaId: number) => {
    const agenda = availableAgendas.find(a => a.id === agendaId);
    setSelectedAgendaId(agendaId);
    setSelectedTime(''); // Resetear hora seleccionada
    
    // Si la agenda tiene horarios específicos disponibles, pasar al paso de selección de hora
    if (agenda && agenda.available_time_slots && agenda.available_time_slots.length > 0) {
      setStep('select_time');
    }
  };

  // Función para volver a selección de agenda
  const handleBackToAgendas = () => {
    setStep('select_agenda');
    setSelectedTime('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-medical-600">
            <ArrowRight className="w-5 h-5" />
            <span>Reasignar Cita</span>
          </DialogTitle>
          <DialogDescription>
            {step === 'reason' 
              ? `Seleccione la causa del traslado de la cita de ${patientName}`
              : step === 'select_agenda'
              ? `Seleccione una agenda disponible para reasignar a ${patientName}`
              : `Seleccione la hora específica para la cita de ${patientName}`
            }
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-4 mb-4">
          <div className={`flex items-center space-x-1 sm:space-x-2 ${step === 'reason' ? 'text-medical-600 font-semibold' : step !== 'reason' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${step === 'reason' ? 'bg-medical-600 text-white' : step !== 'reason' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step !== 'reason' ? '✓' : '1'}
            </div>
            <span className="text-xs sm:text-sm hidden sm:inline">Causa</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <div className={`flex items-center space-x-1 sm:space-x-2 ${step === 'select_agenda' ? 'text-medical-600 font-semibold' : step === 'select_time' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${step === 'select_agenda' ? 'bg-medical-600 text-white' : step === 'select_time' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step === 'select_time' ? '✓' : '2'}
            </div>
            <span className="text-xs sm:text-sm hidden sm:inline">Agenda</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <div className={`flex items-center space-x-1 sm:space-x-2 ${step === 'select_time' ? 'text-medical-600 font-semibold' : 'text-gray-400'}`}>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${step === 'select_time' ? 'bg-medical-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              3
            </div>
            <span className="text-xs sm:text-sm hidden sm:inline">Hora</span>
          </div>
        </div>

        {/* PASO 1: Selección de causa del traslado */}
        {step === 'reason' && (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Información importante</p>
                  <p className="text-sm text-yellow-700">
                    Se notificará al paciente por SMS el cambio de fecha y la causa seleccionada.
                  </p>
                </div>
              </div>
            </div>

            {/* Información de la cita actual */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Cita actual a reasignar
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Paciente:</span> <span className="font-medium">{patientName}</span></div>
                <div><span className="text-gray-500">Doctor:</span> <span className="font-medium">{currentDoctor || 'N/A'}</span></div>
                <div><span className="text-gray-500">Fecha:</span> <span className="font-medium">{currentDate ? safeFormatDate(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es }) : 'N/A'}</span></div>
                <div><span className="text-gray-500">Hora:</span> <span className="font-medium">{currentTime || 'N/A'}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Sede:</span> <span className="font-medium">{currentLocation || 'N/A'}</span></div>
              </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 450px)' }}>
              <Label className="text-base font-semibold">Seleccione la causa del traslado:</Label>
              
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason} className="space-y-2">
                {TRANSFER_REASONS.map((reason) => (
                  <div
                    key={reason.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm ${
                      selectedReason === reason.id
                        ? 'border-medical-600 bg-medical-50 ring-1 ring-medical-200'
                        : 'border-gray-200 hover:border-medical-300'
                    }`}
                    onClick={() => setSelectedReason(reason.id)}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value={reason.id} id={reason.id} className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor={reason.id} className="font-medium cursor-pointer">
                          {reason.label}
                        </Label>
                        <p className="text-sm text-gray-500">{reason.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              {/* Campo de texto para "Otra causa" */}
              {selectedReason === 'other' && (
                <div className="mt-4 pl-6">
                  <Label htmlFor="custom-reason" className="text-sm font-medium">
                    Especifique la causa del traslado:
                  </Label>
                  <Textarea
                    id="custom-reason"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Escriba aquí la causa del traslado..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Footer paso 1 */}
            <div className="flex justify-end items-center gap-3 pt-4 border-t mt-4 bg-white">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleContinueToAgendas}
                disabled={!selectedReason || (selectedReason === 'other' && !customReason.trim())}
                className="bg-medical-600 hover:bg-medical-700 text-white"
              >
                Continuar
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {/* PASO 2: Selección de nueva agenda */}
        {step === 'select_agenda' && (
          <>
            {/* Información de especialidad y causa seleccionada */}
            <div className="space-y-2 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Especialidad:</strong> {specialtyName}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  <strong>Causa del traslado:</strong> {selectedReason === 'other' ? customReason : TRANSFER_REASONS.find(r => r.id === selectedReason)?.label}
                </p>
              </div>
            </div>

            {/* Contenedor scrollable */}
            <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 350px)' }}>
              {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Cargando agendas disponibles...</p>
              </div>
            </div>
          ) : availableAgendas.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">No hay agendas disponibles</p>
              <p className="text-gray-400 text-sm">
                No se encontraron agendas de la especialidad {specialtyName} con cupos disponibles
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableAgendas.map((agenda) => (
                <div
                  key={agenda.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedAgendaId === agenda.id
                      ? 'border-medical-600 bg-medical-50 ring-2 ring-medical-200'
                      : 'border-gray-200 hover:border-medical-300'
                  }`}
                  onClick={() => handleSelectAgenda(agenda.id)}
                >
                  <div className="flex items-start justify-between">
                    {/* Información principal */}
                    <div className="flex-1 space-y-2">
                      {/* Doctor */}
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-medical-600" />
                        <span className="font-semibold text-gray-800">{agenda.doctor_name}</span>
                      </div>

                      {/* Sede */}
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{agenda.location_name}</span>
                      </div>

                      {/* Fecha y horario */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {safeFormatDate(agenda.date, "EEE, d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {agenda.start_time.slice(0, 5)} - {agenda.end_time.slice(0, 5)}
                          </span>
                        </div>
                      </div>

                      {/* Mostrar vista previa de horarios disponibles */}
                      {agenda.available_time_slots && agenda.available_time_slots.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="text-xs text-gray-500">Horarios:</span>
                          {agenda.available_time_slots.slice(0, 4).map((time) => (
                            <Badge key={time} variant="outline" className="text-xs py-0 px-1.5">
                              {time}
                            </Badge>
                          ))}
                          {agenda.available_time_slots.length > 4 && (
                            <Badge variant="outline" className="text-xs py-0 px-1.5 bg-gray-100">
                              +{agenda.available_time_slots.length - 4} más
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cupos disponibles */}
                    <div className="text-right">
                      <Badge 
                        className={`text-white ${
                          agenda.available_slots > 5 
                            ? 'bg-green-600' 
                            : agenda.available_slots > 2 
                            ? 'bg-yellow-600' 
                            : 'bg-orange-600'
                        }`}
                      >
                        {agenda.available_slots} {agenda.available_slots === 1 ? 'cupo' : 'cupos'}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {agenda.booked_slots}/{agenda.capacity}
                      </p>
                    </div>
                  </div>

                  {/* Indicador de selección */}
                  {selectedAgendaId === agenda.id && (
                    <div className="mt-3 pt-3 border-t border-medical-200">
                      <p className="text-sm text-medical-600 font-medium flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        Agenda seleccionada
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
            </div>

            {/* Footer paso 2 - Ya no tiene botón de reasignar, solo navega a paso 3 */}
            <div className="flex justify-between items-center gap-3 pt-4 border-t mt-4 bg-white">
              <Button variant="ghost" onClick={handleBackToReason} disabled={reassigning}>
                ← Volver
              </Button>
              <Button variant="outline" onClick={onClose} disabled={reassigning}>
                Cancelar
              </Button>
            </div>
          </>
        )}

        {/* PASO 3: Selección de hora específica */}
        {step === 'select_time' && selectedAgendaId && (
          <>
            {(() => {
              const selectedAgenda = availableAgendas.find(a => a.id === selectedAgendaId);
              if (!selectedAgenda) return null;
              
              return (
                <>
                  {/* Información de la agenda seleccionada */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-green-800">Seleccionar Hora de Cita</h4>
                    </div>
                    <p className="text-sm text-green-700 mb-3">
                      Selecciona la hora específica en la que deseas agendar la cita.
                    </p>
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <h5 className="font-medium text-gray-800 mb-2">Detalles de la agenda:</h5>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500">Fecha:</span> <span className="font-medium">{safeFormatDate(selectedAgenda.date, "dd/MM/yyyy", { locale: es })}</span></div>
                        <div><span className="text-gray-500">Doctor:</span> <span className="font-medium">{selectedAgenda.doctor_name}</span></div>
                        <div><span className="text-gray-500">Especialidad:</span> <span className="font-medium">{specialtyName}</span></div>
                        <div><span className="text-gray-500">Sede:</span> <span className="font-medium">{selectedAgenda.location_name}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Causa del traslado */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-orange-800">
                      <strong>Causa del traslado:</strong> {selectedReason === 'other' ? customReason : TRANSFER_REASONS.find(r => r.id === selectedReason)?.label}
                    </p>
                  </div>

                  {/* Grid de horarios disponibles */}
                  <div className="mb-4">
                    <Label className="text-base font-semibold mb-3 block">Horarios disponibles:</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                      {selectedAgenda.available_time_slots && selectedAgenda.available_time_slots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          className={`p-3 text-center rounded-lg border-2 transition-all duration-200 ${
                            selectedTime === time
                              ? 'border-green-500 bg-green-600 text-white shadow-lg scale-105'
                              : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700'
                          }`}
                          onClick={() => setSelectedTime(time)}
                        >
                          <div className="font-semibold">{time}</div>
                          <div className="text-xs mt-0.5 opacity-80">
                            {selectedTime === time ? '✓ Seleccionado' : 'Disponible'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resumen de la selección */}
                  {selectedTime && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>Hora seleccionada:</strong> {selectedTime} - La cita de <strong>{patientName}</strong> será reasignada a esta hora.
                      </p>
                    </div>
                  )}

                  {/* Footer paso 3 */}
                  <div className="flex justify-between items-center gap-3 pt-4 border-t bg-white">
                    <Button variant="ghost" onClick={handleBackToAgendas} disabled={reassigning}>
                      ← Volver
                    </Button>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={onClose} disabled={reassigning}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleReassign}
                        disabled={!selectedTime || reassigning}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {reassigning ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Reasignando...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Confirmar Reasignación
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReassignAppointmentModal;
