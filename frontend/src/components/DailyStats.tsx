
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle, AlertCircle, Stethoscope } from "lucide-react";

interface Patient {
  id: string;
  status: string;
  specialty: string;
  date: string;
}

interface DailyStatsProps {
  patients: Patient[];
  currentDate: string;
  specialtyCount: number;
}

const DailyStats = ({ patients, currentDate, specialtyCount }: DailyStatsProps) => {
  const todayPatients = patients.filter(patient => patient.date === currentDate);
  const confirmedToday = todayPatients.filter(p => p.status === "Confirmada").length;
  const pendingToday = todayPatients.filter(p => p.status === "Pendiente confirmación").length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card className="border-medical-200">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Users className="w-8 h-8 text-medical-500" />
            <div>
              <p className="text-2xl font-bold text-medical-800">{todayPatients.length}</p>
              <p className="text-sm text-medical-600">Pacientes Hoy</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-medical-200">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-8 h-8 text-success-500" />
            <div>
              <p className="text-2xl font-bold text-success-700">{confirmedToday}</p>
              <p className="text-sm text-medical-600">Confirmadas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-medical-200">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-8 h-8 text-warning-500" />
            <div>
              <p className="text-2xl font-bold text-warning-700">{pendingToday}</p>
              <p className="text-sm text-medical-600">Pendientes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-medical-200">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Stethoscope className="w-8 h-8 text-medical-500" />
            <div>
              <p className="text-2xl font-bold text-medical-800">{specialtyCount}</p>
              <p className="text-sm text-medical-600">Especialidades</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyStats;
