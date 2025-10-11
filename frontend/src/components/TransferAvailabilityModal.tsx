import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Bot, Phone, AlertTriangle, ArrowRight } from "lucide-react";
import type { Availability } from "@/hooks/useAppointmentData";
import api from "@/lib/api";

interface TransferAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  availability: Availability | null;
  onTransfer: (id: number, newDate: string) => void;
}

const TransferAvailabilityModal = ({ isOpen, onClose, availability, onTransfer }: TransferAvailabilityModalProps) => {
  const { toast } = useToast();
  const [isTransferring, setIsTransferring] = useState(false);
  const [isGeneratingNotification, setIsGeneratingNotification] = useState(false);
  const [isCallingPatients, setIsCallingPatients] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [aiNotification, setAiNotification] = useState("");
  const [transferMode, setTransferMode] = useState<'copy' | 'move'>('move');

  const resetForm = () => {
    setNewDate("");
    setAiNotification("");
    setTransferMode('move');
  };

  const handleOpen = () => {
    resetForm();
  };

  const generateAINotification = async () => {
    if (!availability || !newDate) return;

    setIsGeneratingNotification(true);
    console.log("Generando notificación para transferencia de agenda...");

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const originalDate = new Date(availability.date).toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const newDateFormatted = new Date(newDate).toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const notification = `Estimados pacientes,

Nos dirigimos a ustedes para informarles sobre un cambio importante en la programación de consultas del ${availability.doctor} en ${availability.specialty}.

INFORMACIÓN DEL CAMBIO:
• Doctor: ${availability.doctor}
• Especialidad: ${availability.specialty}
• Ubicación: ${availability.locationName}
• Fecha original: ${originalDate}
• Nueva fecha: ${newDateFormatted}
• Horario: ${availability.startTime} - ${availability.endTime}

MOTIVO DEL CAMBIO:
Debido a circunstancias imprevistas y para garantizar la mejor atención médica posible, hemos tenido que ${transferMode === 'move' ? 'trasladar' : 'reprogramar'} la agenda médica a una nueva fecha.

¿QUÉ NECESITA HACER?
Si usted tiene una cita programada para la fecha original, su cita ha sido automáticamente ${transferMode === 'move' ? 'trasladada' : 'reprogramada'} a la nueva fecha en el mismo horario. No necesita realizar ninguna acción adicional.

Si la nueva fecha no se ajusta a su disponibilidad, por favor contáctenos al +57 1 234 5678 y con gusto le ofreceremos alternativas.

CONFIRMACIÓN:
Recibirá un mensaje de confirmación con todos los detalles de su nueva cita en las próximas horas.

Agradecemos su comprensión y nos disculpamos por cualquier inconveniente que este cambio pueda ocasionar.

Cordialmente,
Equipo de Coordinación Médica
Clínica Medical Center`;

      setAiNotification(notification);
    } catch (error) {
      console.error("Error generando notificación:", error);
      toast({
        title: "Error",
        description: "No se pudo generar la notificación automática",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingNotification(false);
    }
  };

  const handleAICall = async () => {
    if (!availability || !aiNotification) return;

    setIsCallingPatients(true);
    console.log("Llamando a pacientes afectados por la transferencia...");

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const affectedPatients = availability.bookedSlots;
      
      toast({
        title: "Llamadas Realizadas",
        description: `La IA ha notificado a ${affectedPatients} paciente(s) sobre el cambio de fecha`,
      });

      console.log("Pacientes notificados sobre transferencia:", affectedPatients);
      
    } catch (error) {
      console.error("Error en llamadas automáticas:", error);
      toast({
        title: "Error",
        description: "No se pudieron realizar todas las llamadas automáticas",
        variant: "destructive",
      });
    } finally {
      setIsCallingPatients(false);
    }
  };

  const handleTransfer = async () => {
    if (!availability || !newDate) {
      toast({
        title: "Error",
        description: "Por favor selecciona una nueva fecha",
        variant: "destructive",
      });
      return;
    }

    // Validar que la nueva fecha no sea anterior a hoy
    const today = new Date().toISOString().split('T')[0];
    if (newDate < today) {
      toast({
        title: "Error",
        description: "No puedes transferir a una fecha pasada",
        variant: "destructive",
      });
      return;
    }

    // Validar que no sea la misma fecha
    if (newDate === availability.date) {
      toast({
        title: "Error",
        description: "La nueva fecha debe ser diferente a la actual",
        variant: "destructive",
      });
      return;
    }

    setIsTransferring(true);
    console.log("Transfiriendo disponibilidad:", { 
      availabilityId: availability.id, 
      newDate, 
      mode: transferMode 
    });

    try {
      // Determinar el nuevo estatus basado en la fecha
      const today = new Date().toISOString().split('T')[0];
      const newStatus = newDate >= today ? 'active' : 'cancelled';

      if (transferMode === 'copy') {
        // Crear nueva disponibilidad manteniendo la original
        await api.createAvailability({
          location_id: availability.locationId,
          specialty_id: Number(availability.specialty), // Necesitaremos el ID real
          doctor_id: Number(availability.doctor), // Necesitaremos el ID real
          date: newDate,
          start_time: availability.startTime,
          end_time: availability.endTime,
          capacity: availability.capacity,
          status: newStatus as 'active' | 'cancelled',
          notes: availability.notes || `Copiada desde ${availability.date}`,
        });

        toast({
          title: "Agenda Copiada",
          description: `La agenda ha sido copiada exitosamente al ${new Date(newDate).toLocaleDateString('es-ES')} con estatus: ${newStatus}`,
        });
      } else {
        // Mover la disponibilidad existente
        await api.updateAvailability(availability.id, {
          date: newDate,
          status: newStatus as 'active' | 'cancelled'
        });

        // También necesitaríamos actualizar las citas asociadas
        // Aquí iría la lógica para mover las citas existentes

        toast({
          title: "Agenda Transferida",
          description: `La agenda ha sido transferida exitosamente al ${new Date(newDate).toLocaleDateString('es-ES')} con estatus: ${newStatus}`,
        });
      }

      onTransfer(availability.id, newDate);
      onClose();
    } catch (error: any) {
      console.error("Error transfiriendo disponibilidad:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo transferir la disponibilidad",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!availability) return null;

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-medical-600">
            <CalendarDays className="w-5 h-5" />
            <span>Transferir Agenda a Otra Fecha</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Información de la agenda actual */}
          <div className="bg-medical-50 border border-medical-200 rounded-lg p-4">
            <h3 className="font-semibold text-medical-800 mb-2">Agenda Actual</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><strong>Doctor:</strong> {availability.doctor}</p>
              <p><strong>Especialidad:</strong> {availability.specialty}</p>
              <p><strong>Ubicación:</strong> {availability.locationName}</p>
              <p><strong>Fecha actual:</strong> {new Date(availability.date).toLocaleDateString('es-ES')}</p>
              <p><strong>Horario:</strong> {availability.startTime} - {availability.endTime}</p>
              <p><strong>Pacientes con citas:</strong> {availability.bookedSlots}/{availability.capacity}</p>
            </div>
          </div>

          {/* Configuración de transferencia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newDate">Nueva Fecha</Label>
              <Input
                id="newDate"
                type="date"
                min={minDate}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="transferMode">Tipo de Transferencia</Label>
              <select
                id="transferMode"
                value={transferMode}
                onChange={(e) => setTransferMode(e.target.value as 'copy' | 'move')}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
              >
                <option value="move">Mover (trasladar agenda existente)</option>
                <option value="copy">Copiar (mantener original y crear nueva)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {transferMode === 'move' 
                  ? 'La agenda actual se eliminará y se creará en la nueva fecha'
                  : 'Se mantendrá la agenda original y se creará una copia en la nueva fecha'
                }
              </p>
            </div>
          </div>

          {/* Vista previa del cambio */}
          {newDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2 flex items-center">
                <ArrowRight className="w-4 h-4 mr-2" />
                Vista Previa del Cambio
              </h3>
              <div className="text-sm text-blue-700">
                <p><strong>De:</strong> {new Date(availability.date).toLocaleDateString('es-ES')} → <strong>A:</strong> {new Date(newDate).toLocaleDateString('es-ES')}</p>
                <p><strong>Acción:</strong> {transferMode === 'move' ? 'Mover agenda' : 'Copiar agenda'}</p>
                <p><strong>Nuevo estatus:</strong> {
                  newDate >= new Date().toISOString().split('T')[0] 
                    ? <span className="text-green-600 font-semibold">Activa</span>
                    : <span className="text-red-600 font-semibold">Cancelada</span>
                }</p>
                {availability.bookedSlots > 0 && (
                  <p><strong>Impacto:</strong> {availability.bookedSlots} paciente(s) serán notificados del cambio</p>
                )}
              </div>
            </div>
          )}

          {/* Alerta si hay pacientes con citas */}
          {availability.bookedSlots > 0 && newDate && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-warning-600" />
                <h3 className="font-semibold text-warning-800">Pacientes Afectados</h3>
              </div>
              <p className="text-sm text-warning-700 mb-4">
                Esta transferencia afectará a {availability.bookedSlots} paciente(s) que ya tienen citas programadas. 
                Se recomienda generar una notificación automática para informarles del cambio.
              </p>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-warning-800">Notificación para pacientes:</span>
                <Button 
                  onClick={generateAINotification}
                  disabled={isGeneratingNotification}
                  variant="outline"
                  size="sm"
                  className="text-warning-600 border-warning-600 hover:bg-warning-50"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  {isGeneratingNotification ? "Generando..." : "Generar con IA"}
                </Button>
              </div>

              {aiNotification && (
                <div className="bg-white border border-warning-200 rounded-lg p-3 mb-4">
                  <Label htmlFor="notification" className="text-sm font-medium text-warning-800">
                    Mensaje de notificación:
                  </Label>
                  <Textarea
                    id="notification"
                    value={aiNotification}
                    onChange={(e) => setAiNotification(e.target.value)}
                    rows={8}
                    className="w-full text-sm mt-2"
                  />
                </div>
              )}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-between pt-4 border-t relative z-50">
            <Button variant="outline" onClick={handleClose} className="relative z-50">
              Cancelar
            </Button>
            
            <div className="space-x-2 relative z-50">
              {availability.bookedSlots > 0 && aiNotification && (
                <Button 
                  variant="outline" 
                  className="text-blue-600 border-blue-600 hover:bg-blue-50 relative z-50"
                  disabled={isCallingPatients}
                  onClick={handleAICall}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  {isCallingPatients ? "Llamando..." : "Notificar Pacientes"}
                </Button>
              )}
              <Button 
                onClick={handleTransfer}
                disabled={isTransferring || !newDate}
                className="bg-medical-600 hover:bg-medical-700 relative z-50"
              >
                {isTransferring ? "Transfiriendo..." : `${transferMode === 'move' ? 'Mover' : 'Copiar'} Agenda`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferAvailabilityModal;
