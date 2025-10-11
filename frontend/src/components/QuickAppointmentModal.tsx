import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Phone, 
  Mail, 
  FileText, 
  Calendar, 
  Clock, 
  MapPin, 
  Stethoscope,
  AlertCircle,
  CheckCircle,
  UserPlus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import QuickPatientSelector from './QuickPatientSelector';
import api from '@/lib/api';

interface Patient {
  id: number;
  name: string;
  document: string;
  document_number?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  gender?: string;
  eps?: string;
}

interface AvailabilityData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  doctor: string;
  specialty: string;
  locationName: string;
  locationId: number;
  doctorId?: number;
  specialtyId?: number;
  capacity: number;
  bookedSlots: number;
}

interface QuickAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  availabilityData: AvailabilityData | null;
}

interface AppointmentForm {
  patientId: number | null;
  appointmentType: string;
  duration: string;
  reason: string;
  notes: string;
  insuranceType: string;
}

export const QuickAppointmentModal = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  availabilityData 
}: QuickAppointmentModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientSelector, setShowPatientSelector] = useState(true);
  
  const [appointmentForm, setAppointmentForm] = useState<AppointmentForm>({
    patientId: null,
    appointmentType: 'Presencial',
    duration: '30',
    reason: '',
    notes: '',
    insuranceType: ''
  });

  // Resetear formulario cuando se abra/cierre el modal
  useEffect(() => {
    if (isOpen) {
      setSelectedPatient(null);
      setShowPatientSelector(true);
      setAppointmentForm({
        patientId: null,
        appointmentType: 'Presencial',
        duration: '30',
        reason: '',
        notes: '',
        insuranceType: ''
      });
    }
  }, [isOpen]);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setAppointmentForm(prev => ({ ...prev, patientId: patient.id }));
    setShowPatientSelector(false);
  };

  const handleChangePatient = () => {
    setSelectedPatient(null);
    setShowPatientSelector(true);
    setAppointmentForm(prev => ({ ...prev, patientId: null }));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPatientAge = (birthDate: string) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age > 0 ? `${age} años` : '';
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!selectedPatient) errors.push('Debe seleccionar un paciente');
    if (!appointmentForm.reason.trim()) errors.push('Debe especificar el motivo de la cita');
    if (!appointmentForm.appointmentType) errors.push('Debe seleccionar el tipo de cita');
    if (!appointmentForm.duration) errors.push('Debe especificar la duración');
    
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      toast({
        title: 'Formulario incompleto',
        description: errors.join('. '),
        variant: 'destructive'
      });
      return;
    }

    if (!availabilityData || !selectedPatient) return;

    setLoading(true);
    try {
      // Construir la fecha y hora de la cita correctamente
      // El backend espera formato: 'YYYY-MM-DD HH:MM:SS'
      const dateStr = availabilityData.date.split('T')[0]; // Obtener solo la fecha sin tiempo
      const timeStr = availabilityData.startTime.split(':').slice(0, 2).join(':'); // Formato HH:MM
      const scheduledAt = `${dateStr} ${timeStr}:00`; // Formato completo YYYY-MM-DD HH:MM:SS
      
      const appointmentData = {
        patient_id: selectedPatient.id,
        availability_id: availabilityData.id,
        location_id: availabilityData.locationId || 1, // Fallback para location_id
        specialty_id: availabilityData.specialtyId || 1, // Fallback si no tiene specialtyId
        doctor_id: availabilityData.doctorId || 1, // Fallback si no tiene doctorId
        scheduled_at: scheduledAt,
        duration_minutes: parseInt(appointmentForm.duration),
        appointment_type: appointmentForm.appointmentType,
        status: 'Confirmada',
        reason: appointmentForm.reason,
        notes: appointmentForm.notes || null,
        insurance_type: appointmentForm.insuranceType || null
      };

      console.log('Datos de cita que se están enviando:', appointmentData);
      console.log('Fecha construida (scheduled_at):', scheduledAt);
      console.log('Paciente seleccionado:', selectedPatient);
      console.log('Datos de disponibilidad:', availabilityData);

      const result = await api.createAppointment(appointmentData);
      console.log('Respuesta del backend:', result);
      
      toast({
        title: 'Cita registrada exitosamente',
        description: `Cita agendada para ${selectedPatient.name} el ${formatDate(availabilityData.date)} a las ${availabilityData.startTime}`,
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error creando cita:', error);
      toast({
        title: 'Error al registrar la cita',
        description: error.response?.data?.error || error.message || 'Error inesperado',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!availabilityData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="w-6 h-6 text-blue-600" />
            Registrar Cita Rápida
          </DialogTitle>
          <DialogDescription>
            Registra una nueva cita médica de forma rápida seleccionando los datos del paciente y la agenda disponible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información de la agenda */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-900">Información de la Agenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Dr. {availabilityData.doctor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{availabilityData.specialty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>{availabilityData.locationName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>{formatDate(availabilityData.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>{availabilityData.startTime} - {availabilityData.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">
                    {availabilityData.capacity - availabilityData.bookedSlots} cupos disponibles
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Selección/información del paciente */}
          {showPatientSelector ? (
            <div className="space-y-4">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <User className="w-5 h-5" />
                Seleccionar Paciente
              </Label>
              <QuickPatientSelector
                onPatientSelect={handlePatientSelect}
                placeholder="Buscar paciente por nombre o documento..."
                autoFocus={true}
              />
            </div>
          ) : selectedPatient && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Paciente Seleccionado
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChangePatient}
                  className="text-blue-600 hover:bg-blue-50"
                >
                  Cambiar paciente
                </Button>
              </div>
              
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-900">{selectedPatient.name}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm text-green-800">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>{selectedPatient.document}</span>
                        </div>
                        {selectedPatient.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{selectedPatient.phone}</span>
                          </div>
                        )}
                        {selectedPatient.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span>{selectedPatient.email}</span>
                          </div>
                        )}
                        {selectedPatient.birth_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{getPatientAge(selectedPatient.birth_date)}</span>
                          </div>
                        )}
                      </div>
                      {selectedPatient.eps && (
                        <Badge className="mt-2 bg-blue-100 text-blue-800">
                          EPS: {selectedPatient.eps}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Detalles de la cita - solo si hay paciente seleccionado */}
          {selectedPatient && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Separator />
              
              <Label className="text-lg font-semibold">Detalles de la Cita</Label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointmentType">Tipo de Cita</Label>
                  <Select
                    value={appointmentForm.appointmentType}
                    onValueChange={(value) => 
                      setAppointmentForm(prev => ({ ...prev, appointmentType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Presencial">Presencial</SelectItem>
                      <SelectItem value="Teleconsulta">Teleconsulta</SelectItem>
                      <SelectItem value="Control">Control</SelectItem>
                      <SelectItem value="Urgencia">Urgencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duración (minutos)</Label>
                  <Select
                    value={appointmentForm.duration}
                    onValueChange={(value) => 
                      setAppointmentForm(prev => ({ ...prev, duration: value }))
                    }
                  >
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

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo de la Cita *</Label>
                <Input
                  id="reason"
                  placeholder="Ej: Consulta general, control, síntomas..."
                  value={appointmentForm.reason}
                  onChange={(e) => 
                    setAppointmentForm(prev => ({ ...prev, reason: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insuranceType">Tipo de Seguro</Label>
                <Select
                  value={appointmentForm.insuranceType}
                  onValueChange={(value) => 
                    setAppointmentForm(prev => ({ ...prev, insuranceType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo de seguro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EPS">EPS</SelectItem>
                    <SelectItem value="Particular">Particular</SelectItem>
                    <SelectItem value="Prepagada">Prepagada</SelectItem>
                    <SelectItem value="SOAT">SOAT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  placeholder="Información adicional sobre la cita..."
                  value={appointmentForm.notes}
                  onChange={(e) => 
                    setAppointmentForm(prev => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </motion.div>
          )}
        </div>

        <DialogFooter className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedPatient}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Registrar Cita
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickAppointmentModal;