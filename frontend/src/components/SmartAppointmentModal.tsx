import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  MapPin, 
  Stethoscope, 
  FileText,
  CheckCircle,
  Users,
  AlertTriangle,
  Zap
} from "lucide-react";
import { useSmartAppointmentAssignment, type SmartAssignmentRequest, type AssignmentResult } from "@/hooks/useSmartAppointmentAssignment";
import PatientSearchAutocomplete from "./PatientSearchAutocomplete";
import { AvailabilityDropdown } from "./AvailabilityDropdown";
import api from "@/lib/api";

interface SmartAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: AssignmentResult) => void;
  selectedDate?: string; // Fecha preseleccionada del calendario (YYYY-MM-DD)
  selectedTime?: string; // Hora preseleccionada (HH:mm)
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
    
    // Información de calendario
    selectedDate: string;
    selectedTimeSlot: any | null;
    
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
    selectedDate: "",
    selectedTimeSlot: null,
    reason: "",
    insuranceType: "",
    notes: ""
  });

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
      selectedDate: "",
      selectedTimeSlot: null,
      reason: "",
      insuranceType: "",
      notes: ""
    });
    resetResult();
  };

  // Cargar opciones dinámicas basadas en availabilities
  useEffect(() => {
    if (!isOpen) return;
    
    setCatalogLoading(true);
    // Cargar opciones iniciales sin filtros
    api.getSmartAvailabilityOptions()
    .then((response) => {
      if (response.success) {
        const { specialties, locations, doctors } = response.data;
        setSpecialties(specialties.map((s: any) => ({ id: s.id, name: s.name })));
        setLocations(locations.map((l: any) => ({ id: l.id, name: l.name })));
        setDoctors(doctors.map((d: any) => ({ id: d.id, name: d.name, specialties: [] })));
      }
    })
    .catch(console.error)
    .finally(() => setCatalogLoading(false));
  }, [isOpen]);

  // Actualizar opciones cuando cambian los filtros
  useEffect(() => {
    if (!isOpen) return;
    
    const filters: any = {};
    if (formData.specialtyId) filters.specialty_id = Number(formData.specialtyId);
    if (formData.locationId) filters.location_id = Number(formData.locationId);
    if (formData.preferredDoctorId) filters.doctor_id = Number(formData.preferredDoctorId);
    
    // Solo actualizar si hay al menos un filtro
    if (Object.keys(filters).length > 0) {
      api.getSmartAvailabilityOptions(filters)
      .then((response) => {
        if (response.success) {
          const { specialties, locations, doctors } = response.data;
          
          // Actualizar solo las opciones que no están siendo filtradas
          if (!filters.specialty_id) {
            setSpecialties(specialties.map((s: any) => ({ id: s.id, name: s.name })));
          }
          if (!filters.location_id) {
            setLocations(locations.map((l: any) => ({ id: l.id, name: l.name })));
          }
          if (!filters.doctor_id) {
            setDoctors(doctors.map((d: any) => ({ id: d.id, name: d.name, specialties: [] })));
          }
        }
      })
      .catch(console.error);
    }
  }, [formData.specialtyId, formData.locationId, formData.preferredDoctorId, isOpen]);

  // Manejar cambios en inputs
  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Manejar selección de paciente
  const handlePatientSelect = (patient: any) => {
    setFormData(prev => ({
      ...prev,
      selectedPatientId: patient.id,
      patientDocument: patient.document,
      patientName: patient.name,
      patientPhone: patient.phone || "",
      patientEmail: patient.email || "",
      insuranceType: patient.insurance_type_name || patient.eps_name || ""
    }));
  };

  // Limpiar selección de paciente
  const handleClearPatient = () => {
    setFormData(prev => ({
      ...prev,
      selectedPatientId: null,
      patientDocument: "",
      patientName: "",
      patientPhone: "",
      patientEmail: "",
      insuranceType: ""
    }));
  };

  // Manejar selección de horario en calendario
  const handleSlotSelect = (date: string, timeSlot: any) => {
    setFormData(prev => ({
      ...prev,
      selectedDate: date,
      selectedTimeSlot: timeSlot
    }));
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientDocument.trim() || !formData.patientName.trim() || !formData.specialtyId) {
      return;
    }

    // Validar calendario si se ha seleccionado un doctor específico
    if (formData.preferredDoctorId && (!formData.selectedDate || !formData.selectedTimeSlot)) {
      alert('Por favor selecciona una fecha y horario del calendario');
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
      reason: formData.reason || undefined,
      insuranceType: formData.insuranceType || undefined,
      notes: formData.notes || undefined,
      searchDaysAhead: 30,
      // Información del calendario
      preferredDate: formData.selectedDate || undefined,
      timeSlotInfo: formData.selectedTimeSlot ? {
        distributionId: formData.selectedTimeSlot.distribution_id,
        availabilityId: formData.selectedTimeSlot.availability_id,
        startTime: formData.selectedTimeSlot.start_time,
        endTime: formData.selectedTimeSlot.end_time
      } : undefined,
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
          <DialogDescription>
            {result.assignmentType === 'appointment' 
              ? 'La cita ha sido programada exitosamente' 
              : 'El paciente ha sido agregado a la cola de espera'}
          </DialogDescription>
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
          <DialogDescription className="text-medical-600">
            El sistema buscará automáticamente la mejor cita disponible. Si no encuentra disponibilidad, agregará al paciente a la cola de espera.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Información del Paciente */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg text-medical-800 flex items-center mb-4">
                <User className="w-5 h-5 mr-2" />
                Información del Paciente
              </h3>
              
              {/* Campo de búsqueda principal */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-medium">🔍 Buscar Paciente</Label>
                  {(formData.patientDocument || formData.patientName) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearPatient}
                      className="text-slate-600 hover:text-slate-800"
                    >
                      Limpiar y buscar otro
                    </Button>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  Busca por cédula, nombre completo o teléfono. Al seleccionar se cargarán automáticamente todos los datos.
                </p>
                <PatientSearchAutocomplete
                  onPatientSelect={handlePatientSelect}
                  placeholder="Escribe cédula, nombre completo o teléfono del paciente..."
                  className="w-full"
                  autoFocus={true}
                />
              </div>

              {/* Campos del paciente - Solo se muestran cuando hay datos */}
              {(formData.patientDocument || formData.patientName) && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">Información del Paciente</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="patientDocument">Documento de Identidad *</Label>
                      <Input
                        id="patientDocument"
                        placeholder="Ej: 12345678"
                        value={formData.patientDocument}
                        onChange={(e) => handleInputChange("patientDocument", e.target.value)}
                        disabled={loading}
                        className="bg-white"
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
                        className="bg-white"
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
                        className="bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="patientEmail">Correo Electrónico</Label>
                      <Input
                        id="patientEmail"
                        type="email"
                        placeholder="correo@ejemplo.com"
                        value={formData.patientEmail}
                        onChange={(e) => handleInputChange("patientEmail", e.target.value)}
                        disabled={loading}
                        className="bg-white"
                      />
                    </div>

                    {formData.insuranceType && (
                      <div className="space-y-2">
                        <Label>Tipo de Seguro</Label>
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                          📋 {formData.insuranceType}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-3 p-2 bg-green-50 rounded text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span>Paciente seleccionado. Puedes modificar los datos si es necesario.</span>
                  </div>
                </div>
              )}

              {/* Mensaje de ayuda cuando no hay paciente seleccionado */}
              {!formData.patientDocument && !formData.patientName && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Busca un paciente existente o los campos aparecerán para crear uno nuevo
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preferencias de Cita */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg text-medical-800 flex items-center mb-4">
                <Stethoscope className="w-5 h-5 mr-2" />
                Preferencias de Cita
                <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                  ⚡ Opciones Dinámicas
                </span>
              </h3>
              
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Las opciones se actualizan automáticamente según disponibilidad real</span>
                </div>
              </div>
              
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
                      {doctors.map((doctor) => (
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

          {/* Selector de Disponibilidad */}
          {formData.preferredDoctorId && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg text-medical-800 flex items-center mb-4">
                  <Calendar className="w-5 h-5 mr-2" />
                  Seleccionar Fecha y Hora
                </h3>
                
                <div className="space-y-4">
                  <AvailabilityDropdown
                    doctorId={Number(formData.preferredDoctorId)}
                    specialtyId={formData.specialtyId ? Number(formData.specialtyId) : undefined}
                    locationId={formData.locationId ? Number(formData.locationId) : undefined}
                    onSlotSelect={handleSlotSelect}
                    selectedDate={formData.selectedDate}
                    selectedTimeSlot={formData.selectedTimeSlot}
                  />
                  
                  {formData.selectedDate && formData.selectedTimeSlot && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">Horario seleccionado:</span>
                      </div>
                      <div className="mt-1 text-sm text-green-700">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(formData.selectedDate).toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {formData.selectedTimeSlot.start_time.slice(0, 5)} - {formData.selectedTimeSlot.end_time.slice(0, 5)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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