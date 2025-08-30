
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bot, Phone, Calendar, Clock, User, UserCheck, PhoneCall } from "lucide-react";

interface Patient {
  id: number;
  patient: string;
  phone: string;
  specialty: string;
  type: string;
  priority: string;
  waitTime: string;
}

interface ScheduleCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  specialty?: string | null;
}

const ScheduleCallModal = ({ isOpen, onClose, patient, specialty }: ScheduleCallModalProps) => {
  const { toast } = useToast();
  const [isCallingAI, setIsCallingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [transferComplete, setTransferComplete] = useState(false);

  // Agentes disponibles
  const availableAgents = [
    { id: "agent1", name: "Dr. Ana Rodríguez", specialty: "Medicina General", status: "Disponible", experience: "5 años" },
    { id: "agent2", name: "Dra. Carmen López", specialty: "Pediatría", status: "Disponible", experience: "8 años" },
    { id: "agent3", name: "Dr. Luis Torres", specialty: "Cardiología", status: "Disponible", experience: "12 años" },
    { id: "agent5", name: "Dr. Carlos Jiménez", specialty: "Medicina General", status: "Disponible", experience: "3 años" },
  ];

  // Prompt del administrador para transferencia
  const adminTransferPrompt = `Eres un asistente médico profesional que debe llamar al paciente para explicar que será transferido a un agente humano especializado.

  Tu objetivo es:
  1. Saludar cordialmente al paciente
  2. Explicar que has revisado su solicitud de cita médica
  3. Informar que para brindar la mejor atención, será transferido a un especialista humano
  4. Tranquilizar al paciente sobre el proceso
  5. Confirmar sus datos básicos
  6. Preparar la transferencia al agente humano

  Debes ser empático, profesional y tranquilizador. El paciente debe sentirse en buenas manos.`;

  const makeAICall = async () => {
    setIsCallingAI(true);
    console.log("IA llamando al paciente para explicar transferencia...");

    try {
      // Simular llamada a IA
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const targetInfo = patient ? 
        `paciente ${patient.patient} (${patient.phone}) para ${patient.specialty}` :
        `pacientes de ${specialty}`;

      const response = `✅ Llamada de preparación realizada exitosamente a ${targetInfo}

🤖 IA Agent: "Buenos días, ${patient?.patient || 'estimado paciente'}. Soy el asistente virtual de la Clínica Medical Center.

He recibido su solicitud para agendar una cita médica de ${patient?.specialty || specialty} y quiero informarle que hemos revisado cuidadosamente su caso.

Para brindarle la mejor atención personalizada y asegurar que todas sus necesidades sean atendidas correctamente, voy a transferir su llamada a uno de nuestros especialistas en agendamiento médico.

📋 Sus datos que tengo registrados son:
- Nombre: ${patient?.patient || 'Información de especialidad'}
- Teléfono: ${patient?.phone || 'A confirmar'}
- Especialidad requerida: ${patient?.specialty || specialty}
- Tipo de consulta: ${patient?.type || 'Consulta general'}

El especialista humano que lo atenderá podrá:
✅ Revisar disponibilidad en tiempo real
✅ Coordinar horarios según sus preferencias
✅ Explicar procedimientos específicos
✅ Resolver dudas sobre su seguro médico
✅ Agendar seguimientos si son necesarios

Por favor, manténgase en línea mientras realizo la transferencia. El tiempo de espera será mínimo.

¡Gracias por elegir nuestra clínica para su atención médica!"

📞 Duración de la llamada: 2 minutos 45 segundos
💬 Resultado: Paciente preparado para transferencia
📱 Estado: Listo para agente humano

⚠️ Nota: El paciente está ahora esperando ser transferido a un agente especializado para completar el agendamiento.`;

      setAiResponse(response);
    } catch (error) {
      console.error("Error en llamada con IA:", error);
      toast({
        title: "Error",
        description: "No se pudo completar la llamada con IA",
        variant: "destructive",
      });
    } finally {
      setIsCallingAI(false);
    }
  };

  const handleTransferToAgent = async () => {
    if (!selectedAgent) {
      toast({
        title: "Error",
        description: "Por favor selecciona un agente para la transferencia",
        variant: "destructive",
      });
      return;
    }

    setIsTransferring(true);
    console.log(`Transfiriendo llamada al agente: ${selectedAgent}`);

    try {
      // Simular transferencia
      await new Promise(resolve => setTimeout(resolve, 2000));

      setTransferComplete(true);

      toast({
        title: "Transferencia Exitosa",
        description: `Paciente transferido exitosamente al ${selectedAgent}`,
      });

    } catch (error) {
      console.error("Error en transferencia:", error);
      toast({
        title: "Error",
        description: "No se pudo completar la transferencia",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCompleteProcess = () => {
    toast({
      title: "Proceso Completado",
      description: "El agente humano se encargará del agendamiento",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-medical-800">
            <UserCheck className="w-5 h-5" />
            <span>Transferencia a Agente Humano</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Información del objetivo */}
          <div className="bg-medical-50 border border-medical-200 rounded-lg p-4">
            <h3 className="font-semibold text-medical-800 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" />
              {patient ? 'Información del Paciente' : 'Información de la Especialidad'}
            </h3>
            {patient ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><strong>Paciente:</strong> {patient.patient}</p>
                <p><strong>Teléfono:</strong> {patient.phone}</p>
                <p><strong>Especialidad:</strong> {patient.specialty}</p>
                <p><strong>Tipo:</strong> {patient.type}</p>
                <p><strong>Prioridad:</strong> {patient.priority}</p>
                <p><strong>Tiempo esperando:</strong> {patient.waitTime}</p>
              </div>
            ) : (
              <div className="text-sm">
                <p><strong>Especialidad:</strong> {specialty}</p>
                <p><strong>Acción:</strong> Transferir pacientes de esta especialidad a agente humano</p>
              </div>
            )}
          </div>

          {/* Paso 1: Preparación con IA */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-medical-800 flex items-center">
                <Bot className="w-4 h-4 mr-2" />
                Paso 1: Preparación del Paciente
              </h3>
              <Button 
                onClick={makeAICall}
                disabled={isCallingAI}
                className="bg-medical-600 hover:bg-medical-700"
              >
                <Phone className="w-4 h-4 mr-2" />
                {isCallingAI ? "Preparando..." : "Llamar y Preparar"}
              </Button>
            </div>

            {aiResponse && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Textarea
                  value={aiResponse}
                  onChange={(e) => setAiResponse(e.target.value)}
                  rows={15}
                  className="w-full bg-white"
                  placeholder="La respuesta de la IA aparecerá aquí..."
                />
              </div>
            )}

            {!aiResponse && (
              <div className="text-center py-8 text-medical-600">
                <Bot className="w-12 h-12 mx-auto mb-2 text-medical-300" />
                <p>La IA llamará primero al paciente para explicar que será transferido a un especialista humano</p>
                <p className="text-sm mt-2">Esto tranquiliza al paciente y prepara la transferencia</p>
              </div>
            )}
          </div>

          {/* Paso 2: Selección de Agente */}
          {aiResponse && !transferComplete && (
            <div className="space-y-4">
              <h3 className="font-semibold text-medical-800 flex items-center">
                <UserCheck className="w-4 h-4 mr-2" />
                Paso 2: Seleccionar Agente Humano
              </h3>
              
              <div className="grid gap-3">
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar agente disponible..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{agent.name}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{agent.specialty}</span>
                            <span>•</span>
                            <span>{agent.experience}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  onClick={handleTransferToAgent}
                  disabled={isTransferring || !selectedAgent}
                  className="bg-success-600 hover:bg-success-700"
                >
                  <PhoneCall className="w-4 h-4 mr-2" />
                  {isTransferring ? "Transfiriendo..." : "Transferir a Agente"}
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3: Transferencia Completada */}
          {transferComplete && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
              <h3 className="font-semibold text-success-800 mb-2 flex items-center">
                <UserCheck className="w-4 h-4 mr-2" />
                ✅ Transferencia Completada
              </h3>
              <div className="text-sm text-success-700">
                <p className="mb-2">• El paciente ha sido transferido exitosamente a <strong>{selectedAgent}</strong></p>
                <p className="mb-2">• El agente humano ahora está hablando directamente con el paciente</p>
                <p className="mb-2">• El agente se encargará de todo el proceso de agendamiento</p>
                <p>• El paciente recibirá atención personalizada y humana</p>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            
            {transferComplete && (
              <Button 
                onClick={handleCompleteProcess}
                className="bg-success-600 hover:bg-success-700"
              >
                Proceso Completado
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleCallModal;
