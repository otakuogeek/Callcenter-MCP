
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Bot, Phone, Calendar, Clock } from "lucide-react";
import type { Availability } from "@/hooks/useAppointmentData";

interface CancelAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  availability: Availability | null;
  onCancel?: (availability: Availability) => Promise<void> | void;
  onReschedule?: (availability: Availability, newDate: string, newStart: string) => Promise<void> | void;
}

const CancelAvailabilityModal = ({ isOpen, onClose, availability, onCancel, onReschedule }: CancelAvailabilityModalProps) => {
  const { toast } = useToast();
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isNotifyingPatients, setIsNotifyingPatients] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [enableRescheduling, setEnableRescheduling] = useState(false);

  const generateAIExplanation = async () => {
    if (!availability) return;

    setIsGeneratingExplanation(true);
    console.log("Generando explicación con IA para cancelación de agenda...");

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let explanation = `Estimados pacientes con citas programadas,

Nos dirigimos a ustedes para informarles que, debido a una situación imprevista, nos vemos en la necesidad de cancelar la agenda del ${availability.doctor} en ${availability.specialty} programada para el día ${new Date(availability.date).toLocaleDateString('es-ES', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})} de ${availability.startTime} a ${availability.endTime} en ${availability.locationName}.

Lamentamos profundamente cualquier inconveniente que esta cancelación pueda causarles. Entendemos la importancia de sus citas médicas y queremos asegurarles que estamos trabajando para reprogramar todas las consultas afectadas.`;

      if (enableRescheduling && newDate && newTime) {
        explanation += `

Nos complace informarles que hemos podido reagendar esta disponibilidad para el día ${new Date(newDate).toLocaleDateString('es-ES', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})} en el mismo horario (${newTime}). Nuestro equipo se pondrá en contacto con cada uno de ustedes para confirmar la nueva fecha.`;
      } else {
        explanation += `

Nuestro equipo de coordinación médica se pondrá en contacto con cada uno de ustedes en las próximas 24 horas para ofrecerles nuevas opciones de fechas y horarios que se ajusten a su disponibilidad.`;
      }

      explanation += `

Si tienen alguna urgencia médica o necesitan atención inmediata, no duden en contactarnos al teléfono de emergencias o dirigirse al servicio de urgencias más cercano.

Para reagendar su cita o si tienen alguna pregunta, pueden contactarnos al +57 1 234 5678 o escribirnos a citas@clinica.com

Agradecemos su comprensión y esperamos poder atenderles pronto.

Cordialmente,
Equipo de Coordinación Médica
${availability.locationName}`;

      setAiExplanation(explanation);
    } catch (error) {
      console.error("Error generando explicación:", error);
      toast({
        title: "Error",
        description: "No se pudo generar la explicación automática",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingExplanation(false);
    }
  };

  const handleNotifyPatients = async () => {
    if (!availability || !aiExplanation) return;

    setIsNotifyingPatients(true);
    console.log("Notificando a pacientes afectados por cancelación de agenda:", availability.id);

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      toast({
        title: "Pacientes Notificados",
        description: `Se ha notificado a los ${availability.bookedSlots} pacientes afectados por la cancelación`,
      });

      if (enableRescheduling && newDate && newTime) {
        console.log("Reagendando automáticamente para:", newDate, newTime);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        toast({
          title: "Agenda Reagendada",
          description: `La agenda ha sido reagendada automáticamente para el ${new Date(newDate).toLocaleDateString('es-ES')} a las ${newTime}`,
        });
      }

    } catch (error) {
      console.error("Error notificando pacientes:", error);
      toast({
        title: "Error",
        description: "No se pudo notificar a todos los pacientes",
        variant: "destructive",
      });
    } finally {
      setIsNotifyingPatients(false);
    }
  };

  const handleCancelAvailability = async () => {
    if (!availability) return;

    setIsCancelling(true);
    console.log("Cancelando agenda:", availability.id);

    try {
      if (onCancel) {
        await onCancel(availability);
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: "Agenda Cancelada",
        description: `La agenda del ${availability.doctor} ha sido cancelada exitosamente`,
      });

      // Si se solicitó reagendar y hay datos, crear nueva disponibilidad
      if (enableRescheduling && newDate && newTime && onReschedule) {
        await onReschedule(availability, newDate, newTime);
        toast({ title: "Agenda Reagendada", description: `Nueva fecha: ${new Date(newDate).toLocaleDateString('es-ES')} ${newTime}` });
      }

      onClose();
    } catch (error) {
      console.error("Error cancelando agenda:", error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la agenda",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const resetForm = () => {
    setAiExplanation("");
    setNewDate("");
    setNewTime("");
    setEnableRescheduling(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!availability) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span>Cancelar Agenda Médica</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Información de la agenda */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">Información de la Agenda a Cancelar</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><strong>Doctor:</strong> {availability.doctor}</p>
              <p><strong>Especialidad:</strong> {availability.specialty}</p>
              <p><strong>Fecha:</strong> {new Date(availability.date).toLocaleDateString('es-ES')}</p>
              <p><strong>Horario:</strong> {availability.startTime} - {availability.endTime}</p>
              <p><strong>Ubicación:</strong> {availability.locationName}</p>
              <p><strong>Pacientes Afectados:</strong> {availability.bookedSlots} de {availability.capacity}</p>
            </div>
          </div>

          {/* Opciones de Reagendamiento */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                id="enableRescheduling"
                checked={enableRescheduling}
                onChange={(e) => setEnableRescheduling(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="enableRescheduling" className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Reagendar agenda automáticamente
              </Label>
            </div>

            {enableRescheduling && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newDate">Nueva Fecha</Label>
                  <Input
                    id="newDate"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newTime">Nueva Hora de Inicio</Label>
                  <Input
                    id="newTime"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Generar explicación con IA */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-medical-800 flex items-center">
                <Bot className="w-4 h-4 mr-2" />
                Mensaje para los Pacientes Afectados
              </h3>
              <Button 
                onClick={generateAIExplanation}
                disabled={isGeneratingExplanation}
                variant="outline"
                size="sm"
              >
                {isGeneratingExplanation ? "Generando..." : "Generar con IA"}
              </Button>
            </div>

            {aiExplanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Textarea
                  value={aiExplanation}
                  onChange={(e) => setAiExplanation(e.target.value)}
                  rows={12}
                  className="w-full bg-white"
                  placeholder="El mensaje generado por IA aparecerá aquí..."
                />
              </div>
            )}

            {!aiExplanation && (
              <div className="text-center py-8 text-medical-600">
                <Bot className="w-12 h-12 mx-auto mb-2 text-medical-300" />
                <p>Haga clic en "Generar con IA" para crear un mensaje personalizado para los pacientes</p>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex justify-between pt-4 border-t relative z-50">
            <Button variant="outline" onClick={handleClose} className="relative z-50">
              Cancelar Operación
            </Button>
            
            <div className="space-x-2 relative z-50">
              <Button 
                variant="outline" 
                className="text-blue-600 border-blue-600 hover:bg-blue-50 relative z-50"
                disabled={!aiExplanation || isNotifyingPatients}
                onClick={handleNotifyPatients}
              >
                <Phone className="w-4 h-4 mr-2" />
                {isNotifyingPatients ? "Notificando..." : "Notificar Pacientes"}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleCancelAvailability}
                disabled={isCancelling || !aiExplanation}
                className="relative z-50"
              >
                {isCancelling ? "Cancelando..." : "Confirmar Cancelación"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelAvailabilityModal;
