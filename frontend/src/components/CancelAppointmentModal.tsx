
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

interface Patient {
  id: string;
  patientName: string;
  phone: string;
  date: string;
  time: string;
  doctor: string;
  specialty: string;
}

interface CancelAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

const CancelAppointmentModal = ({ isOpen, onClose, patient }: CancelAppointmentModalProps) => {
  const { toast } = useToast();
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCallingPatient, setIsCallingPatient] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [enableRescheduling, setEnableRescheduling] = useState(false);

  // Prompt del administrador para cancelaciones
  const adminCancelPrompt = `Eres un asistente médico profesional que debe explicar de manera empática y clara la cancelación de una cita médica. 

  Debes crear una explicación que incluya:
  1. Una disculpa sincera por la cancelación
  2. Una breve explicación del motivo (emergencia médica, enfermedad del doctor, etc.)
  3. Ofrecimiento de reagendar la cita
  4. Información de contacto para reagendar
  5. Un tono profesional pero empático

  El mensaje debe ser directo, comprensible y tranquilizador para el paciente.`;

  const generateAIExplanation = async () => {
    if (!patient) return;

    setIsGeneratingExplanation(true);
    console.log("Generando explicación con IA para cancelación...");

    try {
      // Simular llamada a IA (aquí iría la integración real con OpenAI/Anthropic)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let explanation = `Estimado/a ${patient.patientName},

Nos dirigimos a usted para informarle que, debido a una situación médica imprevista del ${patient.doctor}, nos vemos en la necesidad de cancelar su cita programada para el día ${new Date(patient.date).toLocaleDateString('es-ES', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})} a las ${patient.time} en el área de ${patient.specialty}.

Lamentamos profundamente cualquier inconveniente que esta cancelación pueda causarle. Entendemos la importancia de su cita médica y queremos asegurarle que estamos trabajando para reprogramar su consulta a la mayor brevedad posible.`;

      // Si hay fecha y hora de reagendamiento, añadir esa información
      if (enableRescheduling && newDate && newTime) {
        explanation += `

Nos complace informarle que hemos podido reagendar su cita para el día ${new Date(newDate).toLocaleDateString('es-ES', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})} a las ${newTime}. Por favor confirme su disponibilidad para esta nueva fecha.`;
      } else {
        explanation += `

Nuestro equipo de coordinación médica se pondrá en contacto con usted en las próximas 24 horas para ofrecerle nuevas opciones de fechas y horarios que se ajusten a su disponibilidad.`;
      }

      explanation += `

Si tiene alguna urgencia médica o necesita atención inmediata, no dude en contactarnos al teléfono de emergencias o dirigirse al servicio de urgencias más cercano.

Para reagendar su cita o si tiene alguna pregunta, puede contactarnos al +57 1 234 5678 o escribirnos a citas@clinica.com

Agradecemos su comprensión y esperamos poder atenderle pronto.

Cordialmente,
Equipo de Coordinación Médica
Clínica Medical Center`;

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

  const handleAICall = async () => {
    if (!patient || !aiExplanation) return;

    setIsCallingPatient(true);
    console.log("Iniciando llamada con IA al paciente:", patient.phone);

    try {
      // Simular llamada con IA
      await new Promise(resolve => setTimeout(resolve, 3000));

      toast({
        title: "Llamada Realizada",
        description: `La IA ha realizado la llamada a ${patient.patientName} notificando la cancelación`,
      });

      // Si hay reagendamiento automático
      if (enableRescheduling && newDate && newTime) {
        console.log("Reagendando automáticamente para:", newDate, newTime);
        
        // Simular proceso de reagendamiento
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        toast({
          title: "Cita Reagendada",
          description: `La cita ha sido reagendada automáticamente para el ${new Date(newDate).toLocaleDateString('es-ES')} a las ${newTime}`,
        });
      }

    } catch (error) {
      console.error("Error en llamada con IA:", error);
      toast({
        title: "Error",
        description: "No se pudo realizar la llamada automática",
        variant: "destructive",
      });
    } finally {
      setIsCallingPatient(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!patient) return;

    setIsCancelling(true);
    console.log("Cancelando cita:", patient.id);
    console.log("Explicación generada:", aiExplanation);

    try {
      // Aquí iría la lógica para cancelar la cita en la base de datos
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: "Cita Cancelada",
        description: `La cita de ${patient.patientName} ha sido cancelada exitosamente`,
      });

      onClose();
    } catch (error) {
      console.error("Error cancelando cita:", error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la cita",
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

  if (!patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span>Cancelar Cita Médica</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Información del paciente */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">Información de la Cita a Cancelar</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><strong>Paciente:</strong> {patient.patientName}</p>
              <p><strong>Teléfono:</strong> {patient.phone}</p>
              <p><strong>Fecha:</strong> {new Date(patient.date).toLocaleDateString('es-ES')}</p>
              <p><strong>Hora:</strong> {patient.time}</p>
              <p><strong>Doctor:</strong> {patient.doctor}</p>
              <p><strong>Especialidad:</strong> {patient.specialty}</p>
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
                Reagendar automáticamente
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
                  <Label htmlFor="newTime">Nueva Hora</Label>
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
                Explicación para el Paciente
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
                  placeholder="La explicación generada por IA aparecerá aquí..."
                />
              </div>
            )}

            {!aiExplanation && (
              <div className="text-center py-8 text-medical-600">
                <Bot className="w-12 h-12 mx-auto mb-2 text-medical-300" />
                <p>Haga clic en "Generar con IA" para crear una explicación personalizada para el paciente</p>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancelar Operación
            </Button>
            
            <div className="space-x-2">
              <Button 
                variant="outline" 
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                disabled={!aiExplanation || isCallingPatient}
                onClick={handleAICall}
              >
                <Phone className="w-4 h-4 mr-2" />
                {isCallingPatient ? "Llamando..." : "Llamar con IA"}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleCancelAppointment}
                disabled={isCancelling || !aiExplanation}
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

export default CancelAppointmentModal;
