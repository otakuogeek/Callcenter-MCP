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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Stethoscope, 
  FileText,
  CheckCircle,
  Users,
  AlertTriangle,
  Zap
} from "lucide-react";
import { useSmartAppointmentAssignment, type SmartAssignmentRequest, type AssignmentResult } from "@/hooks/useSmartAppointmentAssignment";
import { Combobox } from "@/components/ui/combobox";
import api from "@/lib/api";

interface SmartAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: AssignmentResult) => void;
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

const SmartAppointmentModal = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  selectedDate,
  selectedTime
}: SmartAppointmentModalProps) => {
  const { loading, result, performSmartAssignment, resetResult } = useSmartAppointmentAssignment();
  
  // Estados de catálogos
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Estados del formulario
  const [formData, setFormData] = useState<{
    // Paciente
    selectedPatientId: number | null;
    patientDocument: string;
    patientName: string;
    patientPhone: string;
    patientEmail: string;
    
    // Preferencias de cita
    specialtyId: string;
    locationId: string;
    preferredDoctorId: string;
    urgencyLevel: 'Baja' | 'Media' | 'Alta' | 'Urgente';
    appointmentType: 'Presencial' | 'Telemedicina';
    durationMinutes: string;
    
    // Información adicional
    reason: string;
    insuranceType: string;
    notes: string;
  }>({
    selectedPatientId: null,
    patientDocument: "",
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    specialtyId: "",
    locationId: "",
    preferredDoctorId: "",
    urgencyLevel: "Media",
    appointmentType: "Presencial",
    durationMinutes: "30",
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
      specialtyId: "",
      locationId: "",
      preferredDoctorId: "",
      urgencyLevel: "Media",
      appointmentType: "Presencial",
      durationMinutes: "30",
      reason: "",
      insuranceType: "",
      notes: ""
    });
    setPatientQuery("");
    resetResult();
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
    .then(([locations, specialties, doctors]) => {
      setLocations((locations || []).map((l: any) => ({ id: l.id, name: l.name })));
      setSpecialties((specialties || []).map((s: any) => ({ id: s.id, name: s.name })));
      setDoctors((doctors || []).map((d: any) => ({ 
        id: d.id, 
        name: d.name,
        specialties: d.specialties || []
      })));
    })
    .catch(console.error)
    .finally(() => setCatalogLoading(false));
  }, [isOpen]);

  // Buscar pacientes
  useEffect(() => {
    if (!patientQuery.trim()) {
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
      .catch(() => setPatients([]))
      .finally(() => setPatientLoading(false));
  }, [patientQuery]);

  // Manejar cambios en inputs
  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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

  // Filtrar doctores por especialidad
  const filteredDoctors = doctors.filter(doctor => 
    !formData.specialtyId || doctor.specialties.some(s => s.id === Number(formData.specialtyId))
  );

  // Opciones para el combobox de pacientes
  const patientOptions = patients.map(patient => ({
    value: String(patient.id),
    label: `${patient.name} - ${patient.document}`,
    description: patient.phone || 'Sin teléfono'
  }));

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientDocument.trim() || !formData.patientName.trim() || !formData.specialtyId) {
      return;
    }

    const request: SmartAssignmentRequest = {
      patientDocument: formData.patientDocument,
      patientName: formData.patientName,
      patientPhone: formData.patientPhone || undefined,
      patientEmail: formData.patientEmail || undefined,
      specialtyId: Number(formData.specialtyId),
      locationId: formData.locationId ? Number(formData.locationId) : undefined,
      preferredDoctorId: formData.preferredDoctorId ? Number(formData.preferredDoctorId) : undefined,
      urgencyLevel: formData.urgencyLevel,
      appointmentType: formData.appointmentType,
      durationMinutes: Number(formData.durationMinutes),
      reason: formData.reason || undefined,
      insuranceType: formData.insuranceType || undefined,
      notes: formData.notes || undefined,
      searchDaysAhead: 30,
    };

    try {
      const result = await performSmartAssignment(request);
      onSuccess?.(result);
    } catch (error) {
      // Error handling es manejado por el hook
    }
  };

  // Manejar cierre del modal
  const handleClose = () => {
    if (result) {
      resetForm();
    }
    onClose();
  };

  // Renderizar resultado si existe
  if (result && !loading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
              {result.assignmentType === 'appointment' ? '¡Cita Asignada!' : 'Agregado a Cola'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Información del resultado */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold">{result.patient.name}</p>
                      <p className="text-sm text-muted-foreground">Documento: {result.patient.document}</p>
                    </div>
                  </div>

                  {result.assignmentType === 'appointment' && result.appointment ? (
                    <div className="space-y-3">
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <Calendar className="w-4 h-4 mr-1" />
                        Cita Confirmada
                      </Badge>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">Fecha y Hora</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(result.appointment.scheduledAt).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">Doctor</p>
                            <p className="text-sm text-muted-foreground">{result.appointment.doctor.name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">Ubicación</p>
                            <p className="text-sm text-muted-foreground">{result.appointment.location.name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">Especialidad</p>
                            <p className="text-sm text-muted-foreground">{result.appointment.specialty.name}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : result.queueEntry ? (
                    <div className="space-y-3">
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                        <Users className="w-4 h-4 mr-1" />
                        En Cola de Espera
                      </Badge>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <div>
                            <p className="text-sm font-medium">Posición en Cola</p>
                            <p className="text-sm text-muted-foreground">#{result.queueEntry.position}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <div>
                            <p className="text-sm font-medium">Tiempo Estimado</p>
                            <p className="text-sm text-muted-foreground">
                              {result.queueEntry.estimatedWaitTime || 'Por determinar'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:col-span-2">
                          <FileText className="w-4 h-4 text-amber-600" />
                          <div>
                            <p className="text-sm font-medium">Especialidad</p>
                            <p className="text-sm text-muted-foreground">{result.queueEntry.specialty.name}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">{result.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetForm}>
                Crear Otra Cita
              </Button>
              <Button onClick={handleClose} className="bg-medical-600 hover:bg-medical-700">
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center space-x-3 text-2xl text-medical-800">
            <div className="p-2 bg-medical-100 rounded-lg">
              <Zap className="w-6 h-6 text-medical-600" />
            </div>
            <span>Asignación Inteligente de Citas</span>
          </DialogTitle>
          <p className="text-medical-600">
            El sistema buscará automáticamente la mejor cita disponible. Si no encuentra disponibilidad, agregará al paciente a la cola de espera.
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

          {/* Preferencias de Cita */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg text-medical-800 flex items-center mb-4">
                <Stethoscope className="w-5 h-5 mr-2" />
                Preferencias de Cita
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
                  <Label htmlFor="urgencyLevel">Nivel de Urgencia</Label>
                  <Select value={formData.urgencyLevel} onValueChange={(value: any) => handleInputChange("urgencyLevel", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baja">Baja</SelectItem>
                      <SelectItem value="Media">Media</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="durationMinutes">Duración (minutos)</Label>
                  <Select value={formData.durationMinutes} onValueChange={(value) => handleInputChange("durationMinutes", value)}>
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
                  <Select value={formData.appointmentType} onValueChange={(value: any) => handleInputChange("appointmentType", value)}>
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
                  <Label htmlFor="locationId">Ubicación (Preferida)</Label>
                  <Select value={formData.locationId} onValueChange={(value) => handleInputChange("locationId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Cualquier ubicación" />
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

                <div className="space-y-2">
                  <Label htmlFor="preferredDoctorId">Doctor (Preferido)</Label>
                  <Select value={formData.preferredDoctorId} onValueChange={(value) => handleInputChange("preferredDoctorId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Cualquier doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDoctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={String(doctor.id)}>
                          <Stethoscope className="w-4 h-4 mr-2 inline" />
                          {doctor.name}
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

                <div className="space-y-2 md:col-span-2">
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

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || catalogLoading || !formData.patientDocument.trim() || !formData.patientName.trim() || !formData.specialtyId}
              className="bg-medical-600 hover:bg-medical-700"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Asignar Inteligentemente
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SmartAppointmentModal;