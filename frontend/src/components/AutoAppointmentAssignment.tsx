import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Stethoscope,
  Zap,
  CheckCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Plus,
  Settings,
  Target
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AutoAssignmentRequest {
  patient_id: string;
  specialty_id: string;
  priority_level: 'low' | 'medium' | 'high' | 'urgent';
  preferred_date?: string;
  preferred_time?: string;
  duration_minutes: number;
  notes?: string;
  location_id?: string;
  insurance_type?: string;
  symptoms?: string[];
  medical_conditions?: string[];
}

interface AssignmentResult {
  success: boolean;
  appointment_id?: string;
  assigned_doctor?: {
    id: string;
    name: string;
    specialty: string;
  };
  assigned_slot?: {
    date: string;
    start_time: string;
    end_time: string;
  };
  score: number;
  alternatives?: Array<{
    doctor_id: string;
    doctor_name: string;
    date: string;
    start_time: string;
    end_time: string;
    score: number;
  }>;
  warnings?: string[];
  errors?: string[];
}

const AutoAppointmentAssignment = () => {
  const [loading, setLoading] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);

  const [formData, setFormData] = useState<AutoAssignmentRequest>({
    patient_id: '',
    specialty_id: '',
    priority_level: 'medium',
    duration_minutes: 30,
    notes: '',
    symptoms: [],
    medical_conditions: []
  });

  const { toast } = useToast();

  useEffect(() => {
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    try {
      const [patientsRes, specialtiesRes, locationsRes] = await Promise.all([
        api.get('/patients'),
        api.get('/lookups/specialties'),
        api.get('/lookups/locations')
      ]);

      setPatients(patientsRes.data.data || []);
      setSpecialties(specialtiesRes.data.data || []);
      setLocations(locationsRes.data.data || []);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSymptomToggle = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms?.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...(prev.symptoms || []), symptom]
    }));
  };

  const handleConditionToggle = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      medical_conditions: prev.medical_conditions?.includes(condition)
        ? prev.medical_conditions.filter(c => c !== condition)
        : [...(prev.medical_conditions || []), condition]
    }));
  };

  const handleAutoAssignment = async () => {
    if (!formData.patient_id || !formData.specialty_id) {
      toast({
        title: "Campos requeridos",
        description: "Por favor selecciona un paciente y especialidad",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auto-assignment/assign', formData);
      setAssignmentResult(response.data.data);

      if (response.data.data.success) {
        toast({
          title: "Cita asignada exitosamente",
          description: `Cita programada con ${response.data.data.assigned_doctor?.name}`,
        });
      } else {
        toast({
          title: "No se pudo asignar automáticamente",
          description: "Revisa las alternativas disponibles",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Auto assignment error:', error);
      toast({
        title: "Error en asignación",
        description: error.response?.data?.message || "Error desconocido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAlternativeSelection = async (alternative: any) => {
    try {
      const response = await api.post('/auto-assignment/confirm-alternative', {
        ...formData,
        selected_alternative: alternative
      });

      if (response.data.success) {
        toast({
          title: "Cita confirmada",
          description: "La cita alternativa ha sido programada exitosamente"
        });
        setAssignmentResult(null);
        setFormData({
          patient_id: '',
          specialty_id: '',
          priority_level: 'medium',
          duration_minutes: 30,
          notes: '',
          symptoms: [],
          medical_conditions: []
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo confirmar la cita alternativa",
        variant: "destructive"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="w-4 h-4" />;
      case 'high': return <Target className="w-4 h-4" />;
      case 'medium': return <Clock className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Zap className="w-6 h-6 text-medical-600" />
            Asignación Automática de Citas
          </CardTitle>
          <CardDescription>
            Sistema inteligente para asignar citas médicas automáticamente basado en disponibilidad, prioridad y compatibilidad
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario de asignación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nueva Asignación Automática
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Paciente */}
            <div>
              <Label htmlFor="patient">Paciente *</Label>
              <Select value={formData.patient_id} onValueChange={(value) => handleInputChange('patient_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} - {patient.document_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Especialidad */}
            <div>
              <Label htmlFor="specialty">Especialidad *</Label>
              <Select value={formData.specialty_id} onValueChange={(value) => handleInputChange('specialty_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar especialidad" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((specialty) => (
                    <SelectItem key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nivel de prioridad */}
            <div>
              <Label htmlFor="priority">Nivel de Prioridad</Label>
              <Select value={formData.priority_level} onValueChange={(value) => handleInputChange('priority_level', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Baja
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      Media
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-orange-600" />
                      Alta
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Urgente
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Duración */}
            <div>
              <Label htmlFor="duration">Duración (minutos)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => handleInputChange('duration_minutes', parseInt(e.target.value))}
                min="15"
                max="120"
                step="15"
              />
            </div>

            {/* Fecha preferida */}
            <div>
              <Label htmlFor="preferred_date">Fecha Preferida (opcional)</Label>
              <Input
                id="preferred_date"
                type="date"
                value={formData.preferred_date}
                onChange={(e) => handleInputChange('preferred_date', e.target.value)}
              />
            </div>

            {/* Hora preferida */}
            <div>
              <Label htmlFor="preferred_time">Hora Preferida (opcional)</Label>
              <Input
                id="preferred_time"
                type="time"
                value={formData.preferred_time}
                onChange={(e) => handleInputChange('preferred_time', e.target.value)}
              />
            </div>

            {/* Ubicación */}
            <div>
              <Label htmlFor="location">Ubicación (opcional)</Label>
              <Select value={formData.location_id} onValueChange={(value) => handleInputChange('location_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div>
              <Label htmlFor="notes">Notas adicionales</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Información adicional relevante para la cita..."
                rows={3}
              />
            </div>

            {/* Síntomas */}
            <div>
              <Label>Síntomas (opcional)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['Dolor de cabeza', 'Fiebre', 'Tos', 'Dolor abdominal', 'Fatiga', 'Náuseas'].map((symptom) => (
                  <div key={symptom} className="flex items-center space-x-2">
                    <Checkbox
                      id={`symptom-${symptom}`}
                      checked={formData.symptoms?.includes(symptom)}
                      onCheckedChange={() => handleSymptomToggle(symptom)}
                    />
                    <Label htmlFor={`symptom-${symptom}`} className="text-sm">
                      {symptom}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Condiciones médicas */}
            <div>
              <Label>Condiciones Médicas (opcional)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['Hipertensión', 'Diabetes', 'Asma', 'Alergias', 'Depresión', 'Ansiedad'].map((condition) => (
                  <div key={condition} className="flex items-center space-x-2">
                    <Checkbox
                      id={`condition-${condition}`}
                      checked={formData.medical_conditions?.includes(condition)}
                      onCheckedChange={() => handleConditionToggle(condition)}
                    />
                    <Label htmlFor={`condition-${condition}`} className="text-sm">
                      {condition}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Botón de asignación */}
            <Button
              onClick={handleAutoAssignment}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Buscando mejor opción...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Asignar Automáticamente
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultado de asignación */}
        <div className="space-y-4">
          {assignmentResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {assignmentResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  )}
                  Resultado de Asignación
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignmentResult.success ? (
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        ¡Cita asignada exitosamente con puntuación de {assignmentResult.score.toFixed(1)}/100!
                      </AlertDescription>
                    </Alert>

                    {assignmentResult.assigned_doctor && (
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Doctor Asignado</h4>
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium">{assignmentResult.assigned_doctor.name}</p>
                            <p className="text-sm text-gray-600">{assignmentResult.assigned_doctor.specialty}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {assignmentResult.assigned_slot && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">Horario Asignado</h4>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium">
                              {new Date(assignmentResult.assigned_slot.date).toLocaleDateString('es-ES')}
                            </p>
                            <p className="text-sm text-gray-600">
                              {assignmentResult.assigned_slot.start_time} - {assignmentResult.assigned_slot.end_time}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No se pudo asignar automáticamente. Revisa las alternativas disponibles.
                      </AlertDescription>
                    </Alert>

                    {assignmentResult.errors && assignmentResult.errors.length > 0 && (
                      <div className="p-4 bg-red-50 rounded-lg">
                        <h4 className="font-medium text-red-800 mb-2">Errores</h4>
                        <ul className="list-disc list-inside text-sm text-red-700">
                          {assignmentResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {assignmentResult.warnings && assignmentResult.warnings.length > 0 && (
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">Advertencias</h4>
                        <ul className="list-disc list-inside text-sm text-yellow-700">
                          {assignmentResult.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {assignmentResult.alternatives && assignmentResult.alternatives.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Alternativas Disponibles</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAlternatives(!showAlternatives)}
                          >
                            {showAlternatives ? 'Ocultar' : 'Mostrar'} Alternativas
                          </Button>
                        </div>

                        {showAlternatives && (
                          <div className="space-y-3">
                            {assignmentResult.alternatives.map((alt, index) => (
                              <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className={getPriorityColor('medium')}>
                                      {getPriorityIcon('medium')}
                                      Puntuación: {alt.score.toFixed(1)}
                                    </Badge>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAlternativeSelection(alt)}
                                  >
                                    Seleccionar
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="font-medium">{alt.doctor_name}</p>
                                    <p className="text-gray-600">Doctor</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {new Date(alt.date).toLocaleDateString('es-ES')}
                                    </p>
                                    <p className="text-gray-600">Fecha</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">{alt.start_time} - {alt.end_time}</p>
                                    <p className="text-gray-600">Horario</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Información del sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Información del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-medical-600" />
                  <span>Algoritmo de asignación inteligente con puntuación</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-medical-600" />
                  <span>Considera disponibilidad, especialidad y prioridad</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-medical-600" />
                  <span>Validación automática de conflictos y restricciones</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-medical-600" />
                  <span>Proporciona alternativas cuando no hay asignación perfecta</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AutoAppointmentAssignment;
