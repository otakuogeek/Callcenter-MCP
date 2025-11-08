import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, ArrowRight, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    if (isOpen && currentAvailabilityId) {
      loadAvailableAgendas();
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

    const confirmMessage = `¿Está seguro de reasignar a ${patientName}?\n\nNueva agenda:\n• Doctor: ${selectedAgenda.doctor_name}\n• Sede: ${selectedAgenda.location_name}\n• Fecha: ${format(new Date(selectedAgenda.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: es })}\n• Horario: ${selectedAgenda.start_time} - ${selectedAgenda.end_time}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setReassigning(true);

    try {
      const response = await api.reassignAppointment(appointmentId, selectedAgendaId);

      if (response.success && response.data) {
        // Enviar SMS al paciente informando de la reasignación
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

            const message = `Hola ${patientName}. Su cita ha sido REASIGNADA.\n\n` +
              `📅 CITA ANTERIOR:\n` +
              `👨‍⚕️ Doctor: ${currentDoctor || 'N/A'}\n` +
              `📍 Sede: ${currentLocation || 'N/A'}\n` +
              `📆 Fecha: ${oldDateFormatted}\n` +
              `🕐 Hora: ${currentTime || 'N/A'}\n\n` +
              `✅ NUEVA CITA:\n` +
              `👨‍⚕️ Doctor: ${response.data.new_doctor}\n` +
              `📍 Sede: ${response.data.new_location}\n` +
              `📆 Fecha: ${newDateFormatted}\n` +
              `🕐 Hora: ${response.data.new_time?.substring(0, 5) || 'Por asignar'}\n\n` +
              `Puede verificar su cita en:\n` +
              `🌐 https://biosanarcall.site/users\n\n` +
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
                template_id: 'appointment_reassignment'
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-medical-600">
            <ArrowRight className="w-5 h-5" />
            <span>Reasignar Cita</span>
          </DialogTitle>
          <DialogDescription>
            Seleccione una agenda disponible para reasignar a <strong>{patientName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Información de especialidad */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Especialidad:</strong> {specialtyName}
          </p>
        </div>

        {/* Contenedor scrollable */}
        <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 250px)' }}>
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
                  onClick={() => setSelectedAgendaId(agenda.id)}
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

        {/* Footer con botones */}
        <div className="flex justify-end items-center gap-3 pt-4 border-t mt-4 bg-white">
          <Button variant="outline" onClick={onClose} disabled={reassigning}>
            Cancelar
          </Button>
          <Button
            onClick={handleReassign}
            disabled={!selectedAgendaId || reassigning || loading}
            className="bg-medical-600 hover:bg-medical-700 text-white"
          >
            {reassigning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Reasignando...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Reasignar Cita
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReassignAppointmentModal;
