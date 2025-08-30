
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Clock, 
  Phone, 
  MapPin, 
  CheckCircle, 
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar
} from "lucide-react";
import { useState } from "react";

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
}

interface SpecialtySectionProps {
  specialty: string;
  patients: Patient[];
}

const SpecialtySection = ({ specialty, patients }: SpecialtySectionProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const confirmedPatients = patients.filter(p => p.status === "Confirmada").length;
  const pendingPatients = patients.filter(p => p.status === "Pendiente confirmación").length;
  const doctors = [...new Set(patients.map(p => p.doctor))];

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

  // Calcular el tiempo de fin de cada cita
  const getEndTime = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const sortedPatients = patients.sort((a, b) => a.time.localeCompare(b.time));

  // Agrupar pacientes por doctor para mejor organización
  const patientsByDoctor = sortedPatients.reduce((acc, patient) => {
    if (!acc[patient.doctor]) {
      acc[patient.doctor] = [];
    }
    acc[patient.doctor].push(patient);
    return acc;
  }, {} as Record<string, Patient[]>);

  return (
    <Card className="border-medical-200 shadow-sm">
      <CardHeader className="pb-4 bg-gradient-to-r from-medical-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-3xl">{getSpecialtyIcon()}</span>
              <div>
                <CardTitle className="text-xl text-medical-800">{specialty}</CardTitle>
                <p className="text-sm text-medical-600 mt-1">
                  Agenda de consultas • {patients.length} pacientes programados
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              <Badge variant="outline" className="bg-success-50 text-success-700 border-success-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                {confirmedPatients} confirmadas
              </Badge>
              <Badge variant="outline" className="bg-warning-50 text-warning-700 border-warning-200">
                <AlertCircle className="w-3 h-3 mr-1" />
                {pendingPatients} pendientes
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-medical-600 hover:text-medical-800"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Contraer
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Expandir
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Información de médicos */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-medical-100">
          <div className="flex items-center text-sm text-medical-600">
            <Users className="w-4 h-4 mr-1" />
            Médicos asignados:
          </div>
          {doctors.map((doctor, index) => (
            <Badge key={index} variant="secondary" className="text-xs bg-medical-100 text-medical-700">
              {doctor}
            </Badge>
          ))}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-6">
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
                  {doctorPatients.map((patient, index) => (
                    <div key={patient.id} className="bg-white border border-medical-100 rounded-lg p-4 hover:shadow-md transition-all duration-200">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                        {/* Horario y duración */}
                        <div className="lg:col-span-2">
                          <div className="flex items-center space-x-2 mb-2">
                            <Clock className="w-4 h-4 text-medical-500" />
                            <div className="text-sm">
                              <p className="font-bold text-medical-800 text-base">
                                {patient.time} - {getEndTime(patient.time, patient.duration)}
                              </p>
                              <p className="text-medical-600">
                                {patient.duration} minutos
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Información del paciente */}
                        <div className="lg:col-span-6">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-medical-800 text-base">
                                  {patient.patientName}
                                </p>
                                <p className="text-sm text-medical-600">
                                  {patient.age} años • ID: {patient.patientId}
                                </p>
                              </div>
                              <Badge className={`${getStatusColor(patient.status)} border`}>
                                <div className="flex items-center space-x-1">
                                  {getStatusIcon(patient.status)}
                                  <span className="text-xs font-medium">{patient.status}</span>
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

                        {/* Contacto y ubicación */}
                        <div className="lg:col-span-2">
                          <div className="text-xs text-medical-600 space-y-2">
                            <p className="flex items-center">
                              <Phone className="w-3 h-3 mr-1 text-medical-500" />
                              {patient.phone}
                            </p>
                            <p className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1 text-medical-500" />
                              {patient.location}
                            </p>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="lg:col-span-2">
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                              <FileText className="w-3 h-3" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                              <Phone className="w-3 h-3" />
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
        </CardContent>
      )}
    </Card>
  );
};

export default SpecialtySection;
