import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Phone, 
  MapPin, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Calendar,
  X
} from "lucide-react";
import CancelAppointmentModal from "./CancelAppointmentModal";

interface Patient {
  id: string;
  patientName: string;
  patientId: string;
  phone: string;
  email: string;
  age: number;
  doctor: string;
  time: string;
  duration: number;
  appointmentType: string;
  location: string;
  reason: string;
  status: string;
  insuranceType: string;
  notes?: string;
  date: string;
  specialty: string;
}

interface SpecialtyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  specialty: string;
  patients: Patient[];
}

const SpecialtyDetailsModal = ({ isOpen, onClose, specialty, patients }: SpecialtyDetailsModalProps) => {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmada": return "bg-success-100 text-success-800 border-success-200";
      case "Pendiente confirmación": return "bg-warning-100 text-warning-800 border-warning-200";
      case "En consulta": return "bg-medical-100 text-medical-800 border-medical-200";
      case "Completada": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Confirmada": return <CheckCircle className="w-4 h-4" />;
      case "Pendiente confirmación": return <AlertCircle className="w-4 h-4" />;
      case "En consulta": return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getEndTime = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const handleCancelAppointment = (patient: Patient) => {
    console.log(`Iniciando cancelación de cita para ${patient.patientName}`);
    setSelectedPatientForCancel(patient);
    setIsCancelModalOpen(true);
  };

  const sortedPatients = patients.sort((a, b) => a.time.localeCompare(b.time));

  const patientsByDoctor = sortedPatients.reduce((acc, patient) => {
    if (!acc[patient.doctor]) {
      acc[patient.doctor] = [];
    }
    acc[patient.doctor].push(patient);
    return acc;
  }, {} as Record<string, Patient[]>);

  const getSpecialtyIcon = () => {
    switch (specialty.toLowerCase()) {
      case "medicina general": return "🩺";
      case "cardiología": return "❤️";
      case "pediatría": return "👶";
      case "dermatología": return "🔬";
      case "medicina interna": return "⚕️";
      default: return "🏥";
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl text-medical-800">
              <span className="text-2xl">{getSpecialtyIcon()}</span>
              <span>Agenda de {specialty}</span>
              <Badge variant="outline" className="ml-2">
                {patients.length} pacientes
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {Object.entries(patientsByDoctor).map(([doctor, doctorPatients]) => (
              <div key={doctor} className="border border-medical-100 rounded-lg p-4 bg-medical-25">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-medical-800 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {doctor}
                  </h4>
                  <Badge variant="outline" className="text-medical-600">
                    {doctorPatients.length} pacientes
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {doctorPatients.map((patient) => (
                    <div key={patient.id} className="bg-white border border-medical-100 rounded-lg p-4">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                        {/* Horario */}
                        <div className="lg:col-span-2">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-medical-500" />
                            <div className="text-sm">
                              <p className="font-bold text-medical-800 text-base">
                                {patient.time} - {getEndTime(patient.time, patient.duration)}
                              </p>
                              <p className="text-medical-600">
                                {patient.duration} min
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Información del paciente */}
                        <div className="lg:col-span-5">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-medical-800">
                                  {patient.patientName}
                                </p>
                                <p className="text-sm text-medical-600">
                                  {patient.age} años • ID: {patient.patientId}
                                </p>
                              </div>
                              <Badge className={`${getStatusColor(patient.status)} border`}>
                                <div className="flex items-center space-x-1">
                                  {getStatusIcon(patient.status)}
                                  <span className="text-xs">{patient.status}</span>
                                </div>
                              </Badge>
                            </div>
                            
                            <div className="text-sm space-y-1">
                              <p className="text-medical-700">
                                <strong>Motivo:</strong> {patient.reason}
                              </p>
                              <p className="text-medical-600">
                                <strong>Seguro:</strong> {patient.insuranceType}
                              </p>
                              <p className="text-medical-600">
                                <strong>Tipo:</strong> {patient.appointmentType}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Contacto */}
                        <div className="lg:col-span-2">
                          <div className="text-xs text-medical-600 space-y-2">
                            <p className="flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {patient.phone}
                            </p>
                            <p className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {patient.location}
                            </p>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="lg:col-span-3">
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                              <FileText className="w-3 h-3" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                              <Phone className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="h-8 px-3"
                              onClick={() => handleCancelAppointment(patient)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>

                      {patient.notes && (
                        <div className="mt-3 pt-3 border-t border-medical-100">
                          <p className="text-xs text-medical-600">
                            <strong>Notas:</strong> {patient.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de cancelación */}
      <CancelAppointmentModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setSelectedPatientForCancel(null);
        }}
        patient={selectedPatientForCancel}
      />
    </>
  );
};

export default SpecialtyDetailsModal;
