
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, User, Phone, Mail } from "lucide-react";
import api from "@/lib/api";
import { Combobox, ComboOption } from "@/components/ui/combobox";

interface ManualAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // refrescar listados al guardar
  defaults?: {
    availabilityId?: number;
    locationId?: number;
    specialtyId?: number;
    doctorId?: number;
    date?: string; // YYYY-MM-DD
    startTime?: string; // HH:mm
    endTime?: string;   // HH:mm
  };
}

const ManualAppointmentModal = ({ isOpen, onClose, onSuccess, defaults }: ManualAppointmentModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [formData, setFormData] = useState({
    patientName: "",
    patientDocument: "", // documento de identidad
    phone: "",
    email: "",
    age: "",
    doctorId: "",
    specialtyId: "",
    date: "",
    time: "",
    duration: "30",
    appointmentType: "Presencial",
    locationId: "",
    reason: "",
    insuranceType: "",
    notes: ""
  });

  // Prefill from defaults when opening
  useEffect(() => {
    if (!isOpen) return;
    if (!defaults) return;
    setFormData(prev => ({
      ...prev,
      locationId: defaults.locationId ? String(defaults.locationId) : prev.locationId,
      specialtyId: defaults.specialtyId ? String(defaults.specialtyId) : prev.specialtyId,
      doctorId: defaults.doctorId ? String(defaults.doctorId) : prev.doctorId,
      date: defaults.date || prev.date,
      time: defaults.startTime || prev.time,
    }));
  }, [isOpen]);

  // Autocompletar paciente
  const [patientQuery, setPatientQuery] = useState("");
  const [patientOptions, setPatientOptions] = useState<ComboOption<{ id: number } >[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientLabel, setSelectedPatientLabel] = useState<string>("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestHint, setSuggestHint] = useState<string>("");

  useEffect(() => {
    const q = patientQuery.trim();
    if (!isOpen) return;
    if (q.length < 2) { setPatientOptions([]); return; }
    setPatientLoading(true);
    api.getPatients(q)
      .then(rows => {
        setPatientOptions((rows || []).slice(0, 20).map((p: any) => ({
          value: String(p.id),
          label: `${p.document || 's/doc'} · ${p.name}`,
          meta: { id: Number(p.id) }
        }))
        );
      })
      .finally(() => setPatientLoading(false));
  }, [patientQuery, isOpen]);

  // catálogos
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [specialties, setSpecialties] = useState<Array<{ id: number; name: string }>>([]);
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string; specialties?: Array<{ id: number; name: string }> }>>([]);

  const filteredDoctors = useMemo(() => {
    const sid = Number(formData.specialtyId);
    if (!sid) return doctors;
    return doctors.filter(d => (d.specialties || []).some(s => Number(s.id) === sid));
  }, [doctors, formData.specialtyId]);

  useEffect(() => {
    if (!isOpen) return; // cargar catálogos cuando se abre
    setCatalogLoading(true);
    Promise.all([
      api.getLocations(),
      api.getSpecialties(),
      api.getDoctors(),
    ])
      .then(([locs, specs, docs]) => {
        setLocations((locs || []).map((l: any) => ({ id: Number(l.id), name: l.name })));
        setSpecialties((specs || []).map((s: any) => ({ id: Number(s.id), name: s.name })));
        setDoctors((docs || []).map((d: any) => ({ id: Number(d.id), name: d.name, specialties: d.specialties || [] })));
      })
      .catch(() => {
        toast({ title: "Error", description: "No se pudieron cargar catálogos", variant: "destructive" });
      })
      .finally(() => setCatalogLoading(false));
  }, [isOpen]);

  // Sugerir siguiente hora disponible dentro del rango de disponibilidad
  const findNextSlot = async (fromTime?: string): Promise<string | null> => {
    if (!defaults?.availabilityId || !defaults?.startTime || !defaults?.endTime || !formData.date || !formData.doctorId) return null;
    try {
      const appts = await api.getAppointments(undefined, formData.date, defaults.availabilityId);
      const busy: Array<{ start: number; end: number }> = (appts || [])
        .filter((a: any) => a.status !== 'Cancelada')
        .map((a: any) => {
          const t = new Date(a.scheduled_at);
          const hh = t.getHours();
          const mm = t.getMinutes();
          const start = hh * 60 + mm;
          const end = start + Number(a.duration_minutes || 30);
          return { start, end };
        })
        .sort((a, b) => a.start - b.start);

      const toMin = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        return h * 60 + m;
      };
      const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

      const dur = Number(formData.duration || '30');
      const startMin = Math.max(
        toMin(defaults.startTime),
        // si es hoy, no sugerir en pasado
        (() => {
          try {
            const todayYMD = new Date().toISOString().slice(0, 10);
            if (formData.date === todayYMD) {
              const now = new Date();
              return now.getHours() * 60 + now.getMinutes();
            }
          } catch {}
          return 0;
        })()
      );
      const endMin = toMin(defaults.endTime);
      let cursor = fromTime ? toMin(fromTime) : startMin;
      if (cursor < startMin) cursor = startMin;

      // buscar primer hueco
      while (cursor + dur <= endMin) {
        // Verificar solape local
        const overlaps = busy.some(b => !(cursor + dur <= b.start || cursor >= b.end));
        if (!overlaps) {
          const hhmm = toHHMM(cursor);
          // Confirmar con endpoint de conflictos por seguridad
          try {
            const conf = await api.checkAppointmentConflicts({
              doctor_id: Number(formData.doctorId),
              scheduled_at: `${formData.date} ${hhmm}:00`,
              duration_minutes: dur,
            });
            if (!conf?.conflict) return hhmm;
          } catch {
            // si falla el check, aceptamos hueco local
            return hhmm;
          }
        }
        cursor += dur; // avanzar por bloques del tamaño de la duración
      }
      return null;
    } catch {
      return null;
    }
  };

  const suggestNextTime = async (fromCurrent = false) => {
    if (!defaults?.availabilityId) return;
    setSuggesting(true);
    const base = fromCurrent && formData.time ? formData.time : undefined;
    const next = await findNextSlot(base ? base : undefined);
    if (next) {
      setFormData(prev => ({ ...prev, time: next }));
      setSuggestHint(`Sugerido: ${next}`);
    } else {
      setSuggestHint('Sin huecos disponibles dentro del rango');
    }
    setSuggesting(false);
  };

  // Sugerir automáticamente al abrir cuando viene de disponibilidad
  useEffect(() => {
    if (!isOpen) return;
    if (defaults?.availabilityId) {
      // si no hay hora o está fuera de rango, sugerir
      const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
      const inRange = () => {
        if (!formData.time || !defaults?.startTime || !defaults?.endTime) return false;
        const t = toMin(formData.time);
        return t >= toMin(defaults.startTime) && t <= toMin(defaults.endTime);
      };
      if (!inRange()) {
        // no esperar a interacción del usuario
        suggestNextTime(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaults?.availabilityId, formData.date, formData.doctorId, formData.duration]);

  // utilidades
  const resetForm = () => setFormData({
    patientName: "",
    patientDocument: "",
    phone: "",
    email: "",
    age: "",
    doctorId: "",
    specialtyId: "",
    date: "",
    time: "",
    duration: "30",
    appointmentType: "Presencial",
    locationId: "",
    reason: "",
    insuranceType: "",
    notes: "",
  });

  const handleInputChange = (field: string, value: string) => {
  setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validación básica
    if ((!selectedPatientId && (!formData.patientName || !formData.patientDocument)) || !formData.date || !formData.time || !formData.doctorId || !formData.specialtyId || !formData.locationId) {
      toast({ title: "Campos incompletos", description: "Paciente (seleccionado o nombre+documento), fecha, hora, doctor, especialidad y ubicación son obligatorios", variant: "destructive" });
      return;
    }

    // Si viene de una disponibilidad, validar rango horario
    if (defaults?.availabilityId && defaults?.startTime && defaults?.endTime) {
      const toMin = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        return h * 60 + m;
      };
      const t = toMin(formData.time);
      if (t < toMin(defaults.startTime) || t > toMin(defaults.endTime)) {
        toast({ title: 'Hora fuera de rango', description: `La hora debe estar entre ${defaults.startTime} y ${defaults.endTime}`, variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    try {
      // Buscar o crear paciente
      let patientIdNum: number | null = selectedPatientId ? Number(selectedPatientId) : null;
      if (!patientIdNum) {
        const q = formData.patientDocument.trim();
        try {
          const found = await api.getPatients(q);
          const byDoc = (found || []).find((p: any) => String(p.document) === q);
          if (byDoc) patientIdNum = Number(byDoc.id);
        } catch { /* ignore */ }
        if (!patientIdNum) {
          const newPatient = await api.createPatient({
            document: formData.patientDocument.trim(),
            name: formData.patientName.trim(),
            phone: formData.phone || null,
            email: formData.email || null,
            status: 'Activo',
          });
          patientIdNum = Number((newPatient as any).id);
        }
      }

      // Construir fecha-hora sin desfase de zona horaria
      const scheduledAt = `${formData.date} ${formData.time}:00`;

      // Pre-chequeo de conflictos para mejor UX
      try {
        const conflicts = await api.checkAppointmentConflicts({
          doctor_id: Number(formData.doctorId),
          patient_id: Number(patientIdNum),
          scheduled_at: scheduledAt,
          duration_minutes: Number(formData.duration || '30'),
        });
        if (conflicts?.conflict) {
          const parts: string[] = [];
          if (conflicts.doctor_conflict) parts.push('doctor');
          if (conflicts.patient_conflict) parts.push('paciente');
          if ((conflicts as any).room_conflict) parts.push('sala');
          const who = parts.length ? ` (${parts.join(', ')})` : '';
          toast({ title: 'Conflicto de agenda', description: `Existe un solapamiento en ese horario${who}. Ajusta fecha/hora o duración.`, variant: 'destructive' });
          setLoading(false);
          return;
        }
      } catch {
        // Si falla el pre-chequeo, continuamos y dejamos que el backend valide
      }

      // Crear cita
      await api.createAppointment({
        patient_id: patientIdNum,
  availability_id: defaults?.availabilityId ?? null,
        location_id: Number(formData.locationId),
        specialty_id: Number(formData.specialtyId),
        doctor_id: Number(formData.doctorId),
        scheduled_at: scheduledAt,
        duration_minutes: Number(formData.duration || '30'),
        appointment_type: formData.appointmentType as any,
        status: 'Pendiente',
        reason: formData.reason || null,
        insurance_type: formData.insuranceType || null,
        notes: formData.notes || null,
  manual: true,
      });

      const displayPatient = selectedPatientId
        ? (selectedPatientLabel?.split('·').slice(1).join('·').trim() || `Paciente #${selectedPatientId}`)
        : formData.patientName;
      toast({ title: "Cita Agendada", description: `Cita para ${displayPatient} el ${formData.date} a las ${formData.time}` });
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error al agendar", description: err?.message || 'No fue posible crear la cita', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-medical-800">
            <Calendar className="w-5 h-5" />
            <span>Agendar Cita Manual</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Información del Paciente */}
            <div className="space-y-4">
              <h3 className="font-semibold text-medical-800 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Información del Paciente
              </h3>
              
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    placeholder="Documento"
                    value={formData.patientDocument}
                    onChange={(e) => { handleInputChange("patientDocument", e.target.value); setPatientQuery(e.target.value); setSelectedPatientId(null); }}
                    disabled={!!selectedPatientId}
                  />
                  <div className="md:col-span-2">
          <Combobox
                      value={selectedPatientId ? String(selectedPatientId) : undefined}
                      onChange={(val, meta) => {
                        if (!val || !meta) return;
            setSelectedPatientId(Number(val));
            const opt = patientOptions.find(o => o.value === String(val));
            setSelectedPatientLabel(opt?.label || '');
                      }}
                      options={patientOptions}
                      loading={patientLoading}
                      placeholder="Buscar por nombre o documento"
                      emptyText="Sin resultados"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Selecciona un paciente existente o escribe documento y nombre para crear uno nuevo.</p>
                      <Input
                        id="patientName"
                        value={formData.patientName}
                        onChange={(e) => handleInputChange("patientName", e.target.value)}
                        placeholder={selectedPatientId ? "Paciente seleccionado (bloqueado)" : "Nombre completo (si es nuevo)"}
                        disabled={!!selectedPatientId}
                      />
              </div>

          {selectedPatientId && (
                      <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2 flex items-center justify-between">
            <span>Paciente seleccionado: {selectedPatientLabel || `ID ${selectedPatientId}`}. Puedes limpiar para crear nuevo.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedPatientId(null); setSelectedPatientLabel(''); }}>Limpiar</Button>
                      </div>
                    )}

              <div>
                <Label htmlFor="age">Edad</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleInputChange("age", e.target.value)}
                  placeholder="Edad del paciente"
                />
              </div>

              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+57 300 123 4567"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            {/* Información de la Cita */}
            <div className="space-y-4">
              <h3 className="font-semibold text-medical-800 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Información de la Cita
              </h3>

              <div>
                <Label htmlFor="specialty">Especialidad *</Label>
                <Select value={formData.specialtyId} onValueChange={(value) => handleInputChange("specialtyId", value)} disabled={catalogLoading || !!defaults?.availabilityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="doctor">Doctor *</Label>
                <Select value={formData.doctorId} onValueChange={(value) => handleInputChange("doctorId", value)} disabled={catalogLoading || !!defaults?.availabilityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  required
                  disabled={!!defaults?.availabilityId}
                />
              </div>

              <div>
                <Label htmlFor="time">Hora *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleInputChange("time", e.target.value)}
                  required
                />
                {defaults?.availabilityId && defaults?.startTime && defaults?.endTime && (
                  <p className="text-xs text-muted-foreground mt-1">Rango de la disponibilidad: {defaults.startTime} – {defaults.endTime}</p>
                )}
                {defaults?.availabilityId && (
                  <div className="flex items-center gap-2 mt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => suggestNextTime(true)} disabled={suggesting}>
                      {suggesting ? 'Buscando…' : 'Sugerir siguiente hora'}
                    </Button>
                    {suggestHint && <span className="text-xs text-gray-500">{suggestHint}</span>}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="duration">Duración (minutos)</Label>
                <Select value={formData.duration} onValueChange={(value) => handleInputChange("duration", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                    <SelectItem value="60">60 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Información Adicional */}
          <div className="space-y-4">
            <h3 className="font-semibold text-medical-800">Información Adicional</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="appointmentType">Tipo de Cita</Label>
                <Select value={formData.appointmentType} onValueChange={(value) => handleInputChange("appointmentType", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                    <SelectItem value="Telemedicina">Telemedicina</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location">Ubicación *</Label>
                <Select value={formData.locationId} onValueChange={(value) => handleInputChange("locationId", value)} disabled={catalogLoading || !!defaults?.availabilityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sede/consulta" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="insuranceType">Tipo de Seguro</Label>
                <Input
                  id="insuranceType"
                  value={formData.insuranceType}
                  onChange={(e) => handleInputChange("insuranceType", e.target.value)}
                  placeholder="EPS, Particular, etc."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Motivo de la Consulta</Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => handleInputChange("reason", e.target.value)}
                placeholder="Describir el motivo de la cita"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Información adicional relevante"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t relative z-50">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="relative z-50">
              Cancelar
            </Button>
            <Button type="submit" className="bg-medical-600 hover:bg-medical-700 relative z-50" disabled={loading || catalogLoading}>
              {loading ? 'Agendando…' : 'Agendar Cita'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManualAppointmentModal;
