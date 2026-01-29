import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, CheckCircle, Users } from 'lucide-react';
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
  // Campos adicionales para horarios específicos
  available_time_slots?: string[];
  next_available_times?: string[];
}

interface AssignFromQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  waitingListId: number;
  patientId: number;
  patientName: string;
  specialtyId: number;
  specialtyName: string;
  priority: string;
  reason?: string;
  cupsId?: number;
  onAssignSuccess: () => void;
}

const AssignFromQueueModal: React.FC<AssignFromQueueModalProps> = ({
  isOpen,
  onClose,
  waitingListId,
  patientId,
  patientName,
  specialtyId,
  specialtyName,
  priority,
  reason,
  cupsId,
  onAssignSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [availableAgendas, setAvailableAgendas] = useState<AvailableAgenda[]>([]);
  const [selectedAgendaId, setSelectedAgendaId] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && specialtyId) {
      loadAvailableAgendas();
      // Resetear selecciones al abrir
      setSelectedAgendaId(null);
      setSelectedTime('');
      setShowTimeSelector(false);
    }
  }, [isOpen, specialtyId]);

  const loadAvailableAgendas = async () => {
    setLoading(true);
    try {
      // Obtener agendas disponibles de la especialidad
      const agendas = await api.getAvailableAgendas(specialtyId);
      
      // Filtrar solo agendas con cupos disponibles (aunque el backend ya lo hace)
      const agendasWithSlots = agendas.filter((agenda: AvailableAgenda) => 
        agenda.available_slots > 0 && agenda.status === 'Activa'
      );
      setAvailableAgendas(agendasWithSlots);
      
      if (agendasWithSlots.length === 0) {
        toast({
          title: "Sin agendas disponibles",
          description: `No hay agendas con cupos disponibles para ${specialtyName}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error loading agendas:', error);
      toast({
        title: "Error",
        description: error?.message || "Error al cargar agendas disponibles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgenda = (agendaId: number) => {
    setSelectedAgendaId(agendaId);
    const agenda = availableAgendas.find(a => a.id === agendaId);
    
    // Si la agenda tiene horarios específicos disponibles, mostrar selector
    if (agenda && agenda.available_time_slots && agenda.available_time_slots.length > 0) {
      setShowTimeSelector(true);
      setSelectedTime(''); // Resetear hora seleccionada
    } else {
      setShowTimeSelector(false);
      setSelectedTime(''); // No hay horarios específicos
    }
  };

  const handleAssign = async () => {
    if (!selectedAgendaId) {
      toast({
        title: "Seleccione una agenda",
        description: "Debe seleccionar una agenda para asignar la cita",
        variant: "destructive",
      });
      return;
    }

    const selectedAgenda = availableAgendas.find(a => a.id === selectedAgendaId);
    if (!selectedAgenda) return;

    // Validar que si hay horarios específicos, se haya seleccionado uno
    if (selectedAgenda.available_time_slots && selectedAgenda.available_time_slots.length > 0 && !selectedTime) {
      toast({
        title: "Seleccione un horario",
        description: "Debe seleccionar un horario específico para esta agenda",
        variant: "destructive",
      });
      return;
    }

    const timeInfo = selectedTime ? `\n• Hora específica: ${selectedTime}` : '';
    const confirmMessage = `¿Está seguro de asignar a ${patientName} desde la cola de espera?\n\nAgenda seleccionada:\n• Doctor: ${selectedAgenda.doctor_name}\n• Sede: ${selectedAgenda.location_name}\n• Fecha: ${format(new Date(selectedAgenda.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: es })}${timeInfo}\n• Horario: ${selectedAgenda.start_time} - ${selectedAgenda.end_time}\n\nEsto eliminará al paciente de la cola de espera y creará una cita confirmada.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setAssigning(true);

    try {
      // Crear la cita desde la cola de espera
      const requestData: any = {
        waiting_list_id: waitingListId,
        availability_id: selectedAgendaId,
        patient_id: patientId,
        reason: reason || 'Asignado desde cola de espera',
        priority_level: priority,
        cups_id: cupsId
      };

      // Agregar hora específica si fue seleccionada
      if (selectedTime) {
        requestData.selected_time = selectedTime;
      }

      const response = await api.assignFromWaitingList(requestData);

      if (response.success) {
        const timeAssigned = selectedTime || selectedAgenda.start_time;
        toast({
          title: "✅ Asignación exitosa",
          description: `${patientName} ha sido asignado/a para el ${format(new Date(selectedAgenda.date + 'T12:00:00'), "d 'de' MMMM", { locale: es })} a las ${timeAssigned} con Dr. ${selectedAgenda.doctor_name}`,
          variant: "default",
        });

        onAssignSuccess();
        onClose();
        
        // Resetear estados
        setSelectedAgendaId(null);
        setSelectedTime('');
        setShowTimeSelector(false);
      } else {
        toast({
          title: "Error",
          description: response.message || "No se pudo asignar la cita",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error al asignar",
        description: error?.message || "No se pudo completar la asignación",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
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
            <CheckCircle className="w-5 h-5" />
            <span>Asignar Cita desde Cola de Espera</span>
          </DialogTitle>
          <DialogDescription>
            Seleccione una agenda disponible para asignar a <strong>{patientName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Información del paciente */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
          <p className="text-sm text-blue-800">
            <strong>Especialidad:</strong> {specialtyName}
          </p>
          <p className="text-sm text-blue-800">
            <strong>Prioridad:</strong> <Badge variant={priority === 'Urgente' || priority === 'Alta' ? 'destructive' : 'default'}>{priority}</Badge>
          </p>
          {reason && (
            <p className="text-sm text-blue-800">
              <strong>Motivo:</strong> {reason}
            </p>
          )}
        </div>

        {/* Contenedor scrollable */}
        <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 300px)' }}>
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
                No se encontraron agendas de {specialtyName} con cupos disponibles
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

                      {/* Horarios específicos disponibles */}
                      {agenda.available_time_slots && agenda.available_time_slots.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Horarios específicos disponibles:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {agenda.available_time_slots.slice(0, 6).map((time, index) => (
                              <span key={index} className="text-xs px-2 py-1 rounded-md bg-green-100 text-green-700 font-medium">
                                {time}
                              </span>
                            ))}
                            {agenda.available_time_slots.length > 6 && (
                              <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600">
                                +{agenda.available_time_slots.length - 6} más
                              </span>
                            )}
                          </div>
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
                        <CheckCircle className="w-4 h-4" />
                        Agenda seleccionada
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selector de hora específica */}
        {showTimeSelector && selectedAgendaId && availableAgendas.find(a => a.id === selectedAgendaId)?.available_time_slots && availableAgendas.find(a => a.id === selectedAgendaId)!.available_time_slots!.length > 0 && (
          <div className="border-t pt-4 mt-4 bg-gradient-to-br from-green-50 to-emerald-50 -mx-6 px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-gray-900">Seleccione la hora específica:</h4>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Fecha: {safeFormatDate(availableAgendas.find(a => a.id === selectedAgendaId)!.date, "d 'de' MMMM 'de' yyyy", { locale: es })} - Dr. {availableAgendas.find(a => a.id === selectedAgendaId)!.doctor_name}
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
              {availableAgendas.find(a => a.id === selectedAgendaId)!.available_time_slots!.map((time) => (
                <button
                  key={time}
                  type="button"
                  className={`p-3 text-center rounded-lg border-2 transition-all duration-200 ${
                    selectedTime === time
                      ? 'border-green-500 bg-green-600 text-white shadow-lg'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTime(time);
                  }}
                >
                  <div className="font-semibold text-sm">{time}</div>
                  <div className="text-xs mt-1 opacity-80">
                    {selectedTime === time ? '✓' : 'Disponible'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer con botones */}
        <div className="flex justify-end items-center gap-3 pt-4 border-t mt-4 bg-white">
          <Button variant="outline" onClick={onClose} disabled={assigning}>
            Cancelar
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedAgendaId || assigning || loading || (showTimeSelector && !selectedTime)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {assigning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Asignando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {selectedTime ? `Asignar a las ${selectedTime}` : 'Asignar Cita'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignFromQueueModal;
