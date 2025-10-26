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
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && specialtyId) {
      loadAvailableAgendas();
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

    const confirmMessage = `¿Está seguro de asignar a ${patientName} desde la cola de espera?\n\nAgenda seleccionada:\n• Doctor: ${selectedAgenda.doctor_name}\n• Sede: ${selectedAgenda.location_name}\n• Fecha: ${format(new Date(selectedAgenda.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: es })}\n• Horario: ${selectedAgenda.start_time} - ${selectedAgenda.end_time}\n\nEsto eliminará al paciente de la cola de espera y creará una cita confirmada.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setAssigning(true);

    try {
      // Crear la cita desde la cola de espera
      const response = await api.assignFromWaitingList({
        waiting_list_id: waitingListId,
        availability_id: selectedAgendaId,
        patient_id: patientId,
        reason: reason || 'Asignado desde cola de espera',
        priority_level: priority,
        cups_id: cupsId
      });

      if (response.success) {
        toast({
          title: "✅ Asignación exitosa",
          description: `${patientName} ha sido asignado/a exitosamente a la agenda del Dr. ${selectedAgenda.doctor_name}`,
          variant: "default",
        });

        onAssignSuccess();
        onClose();
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

        {/* Footer con botones */}
        <div className="flex justify-end items-center gap-3 pt-4 border-t mt-4 bg-white">
          <Button variant="outline" onClick={onClose} disabled={assigning}>
            Cancelar
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedAgendaId || assigning || loading}
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
                Asignar Cita
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignFromQueueModal;
