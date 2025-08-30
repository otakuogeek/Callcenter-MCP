
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye
} from "lucide-react";

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

interface SpecialtyCardProps {
  specialty: string;
  patients: Patient[];
  onViewDetails: () => void;
}

const SpecialtyCard = ({ specialty, patients, onViewDetails }: SpecialtyCardProps) => {
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

  // Obtener el rango de horas de las citas
  const times = patients.map(p => p.time).sort();
  const firstTime = times[0];
  const lastTime = times[times.length - 1];

  return (
    <Card className="border-medical-200 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="bg-gradient-to-r from-medical-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{getSpecialtyIcon()}</span>
            <div>
              <CardTitle className="text-xl text-medical-800">{specialty}</CardTitle>
              <p className="text-sm text-medical-600 mt-1">
                {firstTime && lastTime ? `${firstTime} - ${lastTime}` : 'Sin horarios'}
              </p>
            </div>
          </div>
          <Button 
            onClick={onViewDetails}
            variant="outline" 
            size="sm"
            className="text-medical-600 hover:text-medical-800"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver Detalles
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="space-y-4">
          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-medical-500" />
              <span className="text-sm text-medical-600">
                {patients.length} pacientes
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-medical-500" />
              <span className="text-sm text-medical-600">
                {doctors.length} médico{doctors.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Estados */}
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

          {/* Médicos */}
          <div>
            <p className="text-xs text-medical-600 mb-2">Médicos asignados:</p>
            <div className="flex flex-wrap gap-1">
              {doctors.map((doctor, index) => (
                <Badge key={index} variant="secondary" className="text-xs bg-medical-100 text-medical-700">
                  {doctor}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpecialtyCard;
