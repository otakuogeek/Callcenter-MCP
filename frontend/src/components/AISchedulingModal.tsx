
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, Phone, Calendar, Users, User, Clock, CheckCircle } from "lucide-react";
import api from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Patient {
  id: number;
  patient: string;
  phone: string;
  specialty: string;
  priority: string;
  waitTime: string;
  type: string;
}

interface AISchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  specialty?: string | null;
  patients?: Patient[];
  // IDs necesarios para crear cita del paciente individual
  queueEntryId?: number | null;
  patientId?: number | null;
  specialtyId?: number | null;
  onScheduled?: () => void;
  // Si proviene de una transferencia de IA
  transferId?: number | null;
  preferredLocationId?: number | null;
}

const AISchedulingModal = ({ isOpen, onClose, patient, specialty, patients, queueEntryId, patientId, specialtyId, onScheduled, transferId, preferredLocationId }: AISchedulingModalProps) => {
  const { toast } = useToast();
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [isCallingPatients, setIsCallingPatients] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [callResults, setCallResults] = useState<{patient: string, status: string}[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [conflict, setConflict] = useState<{ loading: boolean; has: boolean; details: any[] }>({ loading: false, has: false, details: [] });
  const [form, setForm] = useState<{ scheduled_at: string; location_id?: number; doctor_id?: number; room_id?: number; duration_minutes: number; appointment_type: 'Presencial'|'Telemedicina'; notes?: string | null; }>(
    { scheduled_at: '', duration_minutes: 30, appointment_type: 'Presencial', location_id: preferredLocationId ?? undefined, doctor_id: undefined, room_id: undefined, notes: null }
  );

  const isSpecialtyScheduling = specialty && patients;
  const targetPatients = isSpecialtyScheduling ? patients : (patient ? [patient] : []);

  const generateAIExplanation = async () => {
    setIsGeneratingExplanation(true);
    console.log("Generando explicación con IA para agendamiento...");

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let explanation = "";
      
      if (isSpecialtyScheduling) {
        explanation = `Estimados pacientes de ${specialty},

Nos complace informarles que tenemos nueva disponibilidad de citas para ${specialty}.

INFORMACIÓN DE NUEVA DISPONIBILIDAD:
• Especialidad: ${specialty}
• Nuevos horarios disponibles para los próximos días
• Múltiples opciones de fecha y hora

SOBRE SU SOLICITUD:
Hemos revisado su solicitud de cita médica y queremos ofrecerle las nuevas fechas disponibles que mejor se adapten a sus necesidades.

OPCIONES DISPONIBLES:
Durante esta llamada, nuestra asistente virtual le presentará las fechas y horarios disponibles para que pueda elegir la opción que mejor le convenga.

¿QUÉ NECESITA HACER?
Simplemente confirme la fecha y hora que prefiera de las opciones que le presentaremos. Si ninguna de las opciones se ajusta a su disponibilidad, podemos coordinar alternativas.

CONFIRMACIÓN:
Una vez seleccione su cita, recibirá un mensaje de confirmación con todos los detalles.

¡Esperamos poder atenderle pronto!

Cordialmente,
Equipo de Coordinación Médica
Clínica Medical Center`;
      } else if (patient) {
        explanation = `Estimado/a ${patient.patient},

Nos dirigimos a usted para informarle que tenemos disponibilidad de cita para ${patient.specialty}.

INFORMACIÓN DE SU SOLICITUD:
• Paciente: ${patient.patient}
• Especialidad solicitada: ${patient.specialty}
• Tipo de consulta: ${patient.type}
• Tiempo en cola: ${patient.waitTime}

NUEVA DISPONIBILIDAD:
Nos complace informarle que hemos programado nueva disponibilidad para ${patient.specialty} y queremos ofrecerle una cita.

OPCIONES DISPONIBLES:
Durante esta llamada, nuestra asistente virtual le presentará las fechas y horarios disponibles que tenemos para usted.

CONFIRMACIÓN DE CITA:
Por favor confirme la fecha y hora que mejor se ajuste a su disponibilidad. Una vez confirmada, recibirá todos los detalles de su cita.

Si tiene alguna pregunta o necesita reprogramar, nuestra asistente podrá ayudarle durante la llamada.

¡Esperamos poder atenderle pronto!

Cordialmente,
Equipo de Coordinación Médica
Clínica Medical Center`;
      }

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

  const handleAICalls = async () => {
    if (!aiExplanation || targetPatients.length === 0) return;

    setIsCallingPatients(true);
    setCallResults([]);
    console.log("Iniciando llamadas con IA a pacientes...");

    try {
      for (let i = 0; i < targetPatients.length; i++) {
        const currentPatient = targetPatients[i];
        console.log(`Llamando a ${currentPatient.patient} - ${currentPatient.phone}`);
        
        // Simular llamada con IA (2-4 segundos por llamada)
        const callDuration = 2000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, callDuration));
        
        // Simular resultado de llamada (80% éxito, 20% no contesta)
        const isSuccessful = Math.random() > 0.2;
        const status = isSuccessful ? "Cita agendada" : "No contestó";
        
        setCallResults(prev => [...prev, {
          patient: currentPatient.patient,
          status: status
        }]);

        toast({
          title: isSuccessful ? "Llamada Exitosa" : "Llamada Sin Respuesta",
          description: `${currentPatient.patient}: ${status}`,
        });
      }

      const successfulCalls = callResults.filter(r => r.status === "Cita agendada").length;
      const totalCalls = targetPatients.length;

      toast({
        title: "Proceso Completado",
        description: `Se agendaron ${successfulCalls} de ${totalCalls} pacientes`,
      });

    } catch (error) {
      console.error("Error en llamadas con IA:", error);
      toast({
        title: "Error",
        description: "No se pudieron completar todas las llamadas",
        variant: "destructive",
      });
    } finally {
      setIsCallingPatients(false);
    }
  };

  const resetForm = () => {
    setAiExplanation("");
    setCallResults([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleOpen = () => {
    if (targetPatients.length > 0) {
      generateAIExplanation();
    }
    // Cargar datos base para formulario
    (async () => {
      try {
        const [locs, docs] = await Promise.all([
          api.getLocations(),
          api.getDoctors(),
        ]);
        setLocations(locs || []);
        setDoctors(docs || []);
        // Intentar cargar salas si existe endpoint (opcional)
        try {
          // Si existe api.getRooms, úsalo; si no, deja vacío
          // @ts-ignore
          if (typeof (api as any).getRooms === 'function') {
            // @ts-ignore
            const rs = await (api as any).getRooms();
            setRooms(Array.isArray(rs) ? rs : []);
          }
        } catch {/* ignore */}
        // Prefill location if comes from transfer
        if (preferredLocationId) setForm(f => ({ ...f, location_id: preferredLocationId }));
      } catch {
        /* ignore */
      }
    })();
  };

  const canCreateAppointment = !!(patientId && specialtyId && form.scheduled_at && form.location_id && form.doctor_id);

  // Verificar conflictos cuando cambien doctor/fecha/duración
  useEffect(() => {
    const check = async () => {
      if (!form.doctor_id || !form.scheduled_at || !form.duration_minutes) { setConflict({ loading: false, has: false, details: [] }); return; }
      setConflict(c => ({ ...c, loading: true }));
      try {
        const norm = (() => {
          const v = form.scheduled_at?.trim() || '';
          if (!v) return v;
          const s = v.replace('T', ' ');
          return s.length === 16 ? `${s}:00` : s;
        })();
  const resp = await api.checkAppointmentConflicts({ doctor_id: form.doctor_id, patient_id: patientId ?? undefined, room_id: form.room_id ?? undefined, scheduled_at: norm, duration_minutes: form.duration_minutes });
        setConflict({ loading: false, has: !!resp.conflict, details: resp.items || [] });
      } catch {
        setConflict({ loading: false, has: false, details: [] });
      }
    };
    check();
  }, [form.doctor_id, form.scheduled_at, form.duration_minutes]);

  const createAppointment = async () => {
    if (!canCreateAppointment) {
      toast({ title: 'Faltan datos', description: 'Completa fecha/hora, sede y doctor', variant: 'destructive' });
      return;
    }
    try {
      setCreating(true);
      // Normalizar fecha/hora a formato 'YYYY-MM-DD HH:MM:SS'
      const norm = (() => {
        const v = form.scheduled_at?.trim() || '';
        if (!v) return v;
        const s = v.replace('T', ' ');
        return s.length === 16 ? `${s}:00` : s; // agrega :ss si falta
      })();
      const payload: any = {
        patient_id: patientId,
        availability_id: null,
        location_id: form.location_id,
        specialty_id: specialtyId,
        doctor_id: form.doctor_id,
        scheduled_at: norm,
        duration_minutes: form.duration_minutes,
        appointment_type: form.appointment_type,
        status: 'Confirmada',
        reason: null,
        insurance_type: null,
        notes: form.notes ?? null,
        cancellation_reason: null,
        manual: true,
      };
      const appt = await api.createAppointment(payload);
      if (queueEntryId) {
        await api.scheduleFromQueue(queueEntryId, { outcome: 'Cita agendada' });
      }
      if (transferId) {
        // Registrar call log simple y completar la transferencia
        try {
          await api.createCallLog({ patient_id: patientId ?? null, specialty_id: specialtyId ?? null, queue_id: null, user_id: null, channel: 'Manual', outcome: 'Cita agendada', notes: form.notes ?? null, status_id: null });
        } catch { /* ignore */ }
        try {
          await api.completeTransfer(transferId);
        } catch { /* ignore */ }
      }
      toast({ title: 'Cita creada', description: 'Se creó la cita y se actualizó la cola' });
      if (onScheduled) onScheduled();
      handleClose();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo crear la cita', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-medical-600">
            <Bot className="w-5 h-5" />
            <span>
              {isSpecialtyScheduling 
                ? `Agendar Especialidad: ${specialty}` 
                : `Agendar Paciente: ${patient?.patient}`
              }
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Información de los pacientes a contactar */}
          <div className="bg-medical-50 border border-medical-200 rounded-lg p-4">
            <h3 className="font-semibold text-medical-800 mb-2 flex items-center">
              {isSpecialtyScheduling ? <Users className="w-4 h-4 mr-2" /> : <User className="w-4 h-4 mr-2" />}
              {isSpecialtyScheduling 
                ? `Pacientes de ${specialty} (${targetPatients.length})` 
                : "Información del Paciente"
              }
            </h3>
            
            {isSpecialtyScheduling ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {targetPatients.slice(0, 6).map((p, index) => (
                  <p key={index}><strong>{p.patient}</strong> - {p.phone}</p>
                ))}
                {targetPatients.length > 6 && (
                  <p className="text-gray-600 col-span-2">... y {targetPatients.length - 6} pacientes más</p>
                )}
              </div>
            ) : patient && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><strong>Paciente:</strong> {patient.patient}</p>
                <p><strong>Teléfono:</strong> {patient.phone}</p>
                <p><strong>Especialidad:</strong> {patient.specialty}</p>
                <p><strong>Prioridad:</strong> {patient.priority}</p>
                <p><strong>Tiempo en cola:</strong> {patient.waitTime}</p>
                <p><strong>Tipo:</strong> {patient.type}</p>
              </div>
            )}
          </div>

          {/* Explicación generada por IA */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-medical-800 flex items-center">
                <Bot className="w-4 h-4 mr-2" />
                Explicación para los Pacientes
              </h3>
              {!aiExplanation && (
                <Button 
                  onClick={generateAIExplanation}
                  disabled={isGeneratingExplanation}
                  variant="outline"
                  size="sm"
                >
                  {isGeneratingExplanation ? "Generando..." : "Generar con IA"}
                </Button>
              )}
            </div>

            {aiExplanation ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Textarea
                  value={aiExplanation}
                  onChange={(e) => setAiExplanation(e.target.value)}
                  rows={12}
                  className="w-full bg-white"
                />
              </div>
            ) : (
              <div className="text-center py-8 text-medical-600">
                <Bot className="w-12 h-12 mx-auto mb-2 text-medical-300" />
                <p>La IA generará automáticamente la explicación para los pacientes</p>
              </div>
            )}
          </div>

          {/* Formulario de creación de cita (individual) */}
          {patient && (
            <div className="space-y-4">
              <h3 className="font-semibold text-medical-800 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Crear Cita
              </h3>
              {conflict.has && (
                <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm p-3">
                  Existe un conflicto de horario con otra cita del doctor, del mismo paciente o de la sala/consultorio. Cambia la hora, el doctor o la sala.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Fecha y hora</Label>
                  <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
                </div>
                <div>
                  <Label>Duración (min)</Label>
                  <Input type="number" min={5} max={480} value={form.duration_minutes} onChange={(e) => setForm(f => ({ ...f, duration_minutes: Number(e.target.value || 30) }))} />
                </div>
                <div>
                  <Label>Sede</Label>
                  <Select onValueChange={(v) => setForm(f => ({ ...f, location_id: Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona sede" /></SelectTrigger>
                    <SelectContent>
                      {locations.map((l: any) => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {rooms.length > 0 && (
                  <div>
                    <Label>Sala / Consultorio</Label>
                    <Select onValueChange={(v) => setForm(f => ({ ...f, room_id: Number(v) }))}>
                      <SelectTrigger><SelectValue placeholder="Selecciona sala" /></SelectTrigger>
                      <SelectContent>
                        {rooms.map((r: any) => (
                          <SelectItem key={r.id} value={String(r.id)}>{r.name || `Sala ${r.id}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Doctor</Label>
                  <Select onValueChange={(v) => setForm(f => ({ ...f, doctor_id: Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona doctor" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map((d: any) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Notas</Label>
                  <Textarea rows={3} value={form.notes ?? ''} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* Resultados de llamadas */}
          {callResults.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Resultados de Llamadas
              </h3>
              <div className="space-y-2">
                {callResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{result.patient}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      result.status === "Cita agendada" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {result.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            
            <div className="space-x-2">
              <Button 
                onClick={handleAICalls}
                disabled={!aiExplanation || isCallingPatients || targetPatients.length === 0}
                className="bg-medical-600 hover:bg-medical-700"
              >
                <Phone className="w-4 h-4 mr-2" />
                {isCallingPatients 
                  ? `Llamando... (${callResults.length}/${targetPatients.length})` 
                  : `Llamar con IA ${isSpecialtyScheduling ? `(${targetPatients.length} pacientes)` : ''}`
                }
              </Button>
              {patient && (
                <Button onClick={createAppointment} disabled={!canCreateAppointment || creating || conflict.has}>
                  {creating ? 'Creando...' : 'Crear Cita y Cerrar'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AISchedulingModal;
