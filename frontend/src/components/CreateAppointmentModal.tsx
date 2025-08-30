import { useEffect, useState } from "react";
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
import { Calendar, Clock, User, Phone, Mail, MapPin, Stethoscope, FileText } from "lucide-react";
import api from "@/lib/api";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent } from "@/components/ui/card";

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedDate?: string; // Fecha preseleccionada del calendario (YYYY-MM-DD)
  selectedTime?: string; // Hora preseleccionada (HH:mm)
}

interface Patient {
  id: number;
  name: string;
  document: string;
  phone?: string;
  email?: string;
}

interface Doctor {
  id: number;
  name: string;
  specialties: Array<{ id: number; name: string }>;
}

interface Location {
  id: number;
  name: string;
}

interface Specialty {
  id: number;
  name: string;
}

const CreateAppointmentModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  selectedDate, 
  selectedTime 
}: CreateAppointmentModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Estados de catálogos
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  // Estados del formulario
  const [formData, setFormData] = useState({
    // Paciente
    selectedPatientId: null as number | null,
    patientDocument: "",
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    
    // Cita
    date: selectedDate || "",
    time: selectedTime || "",
    duration: "30",
    appointmentType: "Presencial",
    
    // Médico y ubicación
    doctorId: "",
    specialtyId: "",
    locationId: "",
    
    // Detalles adicionales
    reason: "",
    insuranceType: "",
    notes: ""
  });

  const [patientQuery, setPatientQuery] = useState("");
  const [patientLoading, setPatientLoading] = useState(false);

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      selectedPatientId: null,
      patientDocument: "",
      patientName: "",
      patientPhone: "",
      patientEmail: "",
      date: selectedDate || "",
      time: selectedTime || "",
      duration: "30",
      appointmentType: "Presencial",
      doctorId: "",
      specialtyId: "",
      locationId: "",
      reason: "",
      insuranceType: "",
      notes: ""
    });
    setPatientQuery("");
  };

  // Cargar catálogos
  useEffect(() => {
    if (!isOpen) return;
    
    setCatalogLoading(true);
    Promise.all([
      api.getLocations(),
      api.getSpecialties(),
      api.getDoctors(),
    ])
      .then(([locs, specs, docs]) => {
        setLocations((locs || []).map((l: any) => ({ 
          id: Number(l.id), 
          name: l.name 
        })));
        setSpecialties((specs || []).map((s: any) => ({ 
          id: Number(s.id), 
          name: s.name 
        })));
        setDoctors((docs || []).map((d: any) => ({ 
          id: Number(d.id), 
          name: d.name, 
          specialties: d.specialties || [] 
        })));
      })
      .catch(() => {
        toast({ 
          title: "Error", 
          description: "No se pudieron cargar los catálogos", 
          variant: "destructive" 
        });
      })
      .finally(() => setCatalogLoading(false));
  }, [isOpen, toast]);

  // Buscar pacientes
  useEffect(() => {
    if (!patientQuery || patientQuery.length < 2) {
      setPatients([]);
      return;
    }

    setPatientLoading(true);
    api.getPatients(patientQuery)
      .then((result) => {
        setPatients((result || []).map((p: any) => ({
          id: Number(p.id),
          name: p.name,
          document: p.document || p.document_number || "",
          phone: p.phone,
          email: p.email
        })));
      })
      .catch(() => {
        setPatients([]);
      })
      .finally(() => setPatientLoading(false));
  }, [patientQuery]);

  // Actualizar fecha y hora cuando se cambien las props
  useEffect(() => {
    if (selectedDate !== formData.date) {
      setFormData(prev => ({ ...prev, date: selectedDate || "" }));
    }
    if (selectedTime !== formData.time) {
      setFormData(prev => ({ ...prev, time: selectedTime || "" }));
    }
  }, [selectedDate, selectedTime]);

  // Filtrar doctores por especialidad
  const filteredDoctors = doctors.filter(doctor => 
    !formData.specialtyId || doctor.specialties.some(s => s.id === Number(formData.specialtyId))
  );

  // Opciones para el combobox de pacientes
  const patientOptions = patients.map(patient => ({
    value: String(patient.id),
    label: `${patient.document} • ${patient.name}`,
    searchableText: `${patient.name} ${patient.document}`
  }));

  // Manejar selección de paciente
  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find(p => p.id === Number(patientId));
    if (patient) {
      setFormData(prev => ({
        ...prev,
        selectedPatientId: patient.id,
        patientDocument: patient.document,
        patientName: patient.name,
        patientPhone: patient.phone || "",
        patientEmail: patient.email || ""
      }));
    }
  };

  // Manejar cambios en inputs
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Si cambia el documento del paciente, buscar automáticamente
    if (field === "patientDocument") {
      setPatientQuery(value);
      setFormData(prev => ({ ...prev, selectedPatientId: null }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    if (!formData.patientName.trim()) {
      toast({ title: "Error", description: "El nombre del paciente es requerido", variant: "destructive" });
      return false;
    }
    if (!formData.patientDocument.trim()) {
      toast({ title: "Error", description: "El documento del paciente es requerido", variant: "destructive" });
      return false;
    }
    if (!formData.date) {
      toast({ title: "Error", description: "La fecha es requerida", variant: "destructive" });
      return false;
    }
    if (!formData.time) {
      toast({ title: "Error", description: "La hora es requerida", variant: "destructive" });
      return false;
    }
    if (!formData.doctorId) {
      toast({ title: "Error", description: "Debe seleccionar un médico", variant: "destructive" });
      return false;
    }
    if (!formData.specialtyId) {
      toast({ title: "Error", description: "Debe seleccionar una especialidad", variant: "destructive" });
      return false;
    }
    if (!formData.locationId) {
      toast({ title: "Error", description: "Debe seleccionar una ubicación", variant: "destructive" });
      return false;
    }
    return true;
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      let patientId = formData.selectedPatientId;
      
      // Crear paciente si no existe
      if (!patientId) {
        const newPatient = await api.createPatient({
          name: formData.patientName.trim(),
          document: formData.patientDocument.trim(),
          phone: formData.patientPhone.trim() || null,
          email: formData.patientEmail.trim() || null,
        });
        patientId = Number(newPatient.id);
      }

      // Construir fecha y hora
      const scheduledAt = new Date(`${formData.date}T${formData.time}:00.000Z`);

      // Verificar conflictos
      try {
        const conflicts = await api.checkAppointmentConflicts({
          doctor_id: Number(formData.doctorId),
          patient_id: patientId,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: Number(formData.duration),
        });
        
        if (conflicts?.conflict) {
          const parts: string[] = [];
          if (conflicts.doctor_conflict) parts.push('médico');
          if (conflicts.patient_conflict) parts.push('paciente');
          const who = parts.length ? ` (${parts.join(', ')})` : '';
          toast({ 
            title: 'Conflicto de agenda', 
            description: `Ya existe una cita en ese horario${who}. Elija otra fecha/hora.`, 
            variant: 'destructive' 
          });
          setLoading(false);
          return;
        }
      } catch {
        // Si falla la verificación, continuar y dejar que el backend valide
      }

      // Crear la cita
      await api.createAppointment({
        patient_id: patientId,
        location_id: Number(formData.locationId),
        specialty_id: Number(formData.specialtyId),
        doctor_id: Number(formData.doctorId),
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: Number(formData.duration),
        appointment_type: formData.appointmentType as 'Presencial' | 'Telemedicina',
        status: 'Pendiente',
        reason: formData.reason.trim() || null,
        insurance_type: formData.insuranceType.trim() || null,
        notes: formData.notes.trim() || null,
        manual: true,
      });

      toast({ 
        title: "¡Cita creada exitosamente!", 
        description: `Cita para ${formData.patientName} el ${formData.date} a las ${formData.time}`,
        variant: "default"
      });
      
      resetForm();
      onClose();
      onSuccess?.();
      
    } catch (err: any) {
      toast({ 
        title: "Error al crear la cita", 
        description: err?.message || 'No se pudo crear la cita. Intente nuevamente.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Generar horarios disponibles
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 7; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center space-x-3 text-2xl text-medical-800">
            <div className="p-2 bg-medical-100 rounded-lg">
              <Calendar className="w-6 h-6 text-medical-600" />
            </div>
            <span>Nueva Cita Médica</span>
          </DialogTitle>
          <p className="text-medical-600">
            Complete la información para agendar una nueva cita
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Información del Paciente */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg text-medical-800 flex items-center mb-4">
                <User className="w-5 h-5 mr-2" />
                Información del Paciente
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patientDocument">Documento de Identidad *</Label>
                  <Input
                    id="patientDocument"
                    placeholder="Ej: 12345678"
                    value={formData.patientDocument}
                    onChange={(e) => handleInputChange("patientDocument", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Buscar Paciente Existente</Label>
                  <Combobox
                    value={formData.selectedPatientId ? String(formData.selectedPatientId) : undefined}
                    onChange={(value) => value && handlePatientSelect(value)}
                    options={patientOptions}
                    loading={patientLoading}
                    placeholder="Buscar por nombre o documento"
                    emptyText="No se encontraron pacientes"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patientName">Nombre Completo *</Label>
                  <Input
                    id="patientName"
                    placeholder="Nombre completo del paciente"
                    value={formData.patientName}
                    onChange={(e) => handleInputChange("patientName", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patientPhone">Teléfono</Label>
                  <Input
                    id="patientPhone"
                    placeholder="Ej: +57 300 123 4567"
                    value={formData.patientPhone}
                    onChange={(e) => handleInputChange("patientPhone", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="patientEmail">Correo Electrónico</Label>
                  <Input
                    id="patientEmail"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={formData.patientEmail}
                    onChange={(e) => handleInputChange("patientEmail", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalles de la Cita */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg text-medical-800 flex items-center mb-4">
                <Clock className="w-5 h-5 mr-2" />
                Detalles de la Cita
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Fecha *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    disabled={loading}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Hora *</Label>
                  <Select value={formData.time} onValueChange={(value) => handleInputChange("time", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeSlots().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duración (minutos)</Label>
                  <Select value={formData.duration} onValueChange={(value) => handleInputChange("duration", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="90">1 hora 30 min</SelectItem>
                      <SelectItem value="120">2 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label htmlFor="insuranceType">Tipo de Seguro</Label>
                  <Input
                    id="insuranceType"
                    placeholder="Ej: EPS, Prepagada, Particular"
                    value={formData.insuranceType}
                    onChange={(e) => handleInputChange("insuranceType", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Médico y Ubicación */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg text-medical-800 flex items-center mb-4">
                <Stethoscope className="w-5 h-5 mr-2" />
                Médico y Ubicación
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="specialtyId">Especialidad *</Label>
                  <Select value={formData.specialtyId} onValueChange={(value) => handleInputChange("specialtyId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map((specialty) => (
                        <SelectItem key={specialty.id} value={String(specialty.id)}>
                          {specialty.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doctorId">Médico *</Label>
                  <Select value={formData.doctorId} onValueChange={(value) => handleInputChange("doctorId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar médico" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDoctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={String(doctor.id)}>
                          {doctor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locationId">Ubicación *</Label>
                  <Select value={formData.locationId} onValueChange={(value) => handleInputChange("locationId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ubicación" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={String(location.id)}>
                          <MapPin className="w-4 h-4 mr-2 inline" />
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información Adicional */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg text-medical-800 flex items-center mb-4">
                <FileText className="w-5 h-5 mr-2" />
                Información Adicional
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Motivo de la Consulta</Label>
                  <Textarea
                    id="reason"
                    placeholder="Describe el motivo de la consulta..."
                    value={formData.reason}
                    onChange={(e) => handleInputChange("reason", e.target.value)}
                    disabled={loading}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas Adicionales</Label>
                  <Textarea
                    id="notes"
                    placeholder="Notas adicionales, alergias, medicamentos, etc..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    disabled={loading}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || catalogLoading}
              className="bg-medical-600 hover:bg-medical-700"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creando Cita...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Crear Cita
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAppointmentModal;
