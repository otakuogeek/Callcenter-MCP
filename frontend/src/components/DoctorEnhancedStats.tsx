import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar, Users, Clock,
  TrendingUp, Stethoscope, BarChart3, User, Timer, CalendarCheck
} from "lucide-react";
import { motion } from "framer-motion";
import { convertUTCToColombiaTime, formatDateColombia } from "@/utils/dateHelpers";

interface EnhancedStats {
  today: { total: number; pending: number; confirmed: number; completed: number };
  week: { total: number };
  month: { total: number };
  overall: {
    totalPatients: number;
    totalCompleted: number;
    totalRecords: number;
    avgDurationMinutes: number;
    completionRate: number;
  };
  nextAppointment: {
    id: number;
    scheduled_date: string;
    start_time: string;
    patient_name: string;
    specialty_name: string;
  } | null;
  recentPatients: Array<{
    patient_id: number;
    name: string;
    document: string;
    phone: string;
    age: number;
    eps_name: string;
    last_visit: string;
    visit_count: number;
  }>;
  weeklyTrend: Array<{
    week_number: number;
    week_start: string;
    total: number;
    completed: number;
    unique_patients: number;
  }>;
}

interface DoctorEnhancedStatsProps {
  getEnhancedStats: () => Promise<EnhancedStats>;
  onPatientClick?: (patientId: number) => void;
}

const DoctorEnhancedStats = ({ getEnhancedStats, onPatientClick }: DoctorEnhancedStatsProps) => {
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getEnhancedStats();
      setStats(data);
    } catch (err) {
      console.error("Error loading enhanced stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      // Use Colombia timezone DD/MM/YYYY format
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      return formatDateColombia(cleanDate + 'T12:00:00');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const todayProgress = stats.today.total > 0 
    ? Math.round((stats.today.completed / stats.today.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Main stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Citas Hoy */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <Badge className="bg-blue-600 text-xs">{stats.today.total}</Badge>
              </div>
              <p className="text-2xl font-bold text-blue-900">{stats.today.total}</p>
              <p className="text-xs text-blue-600 font-medium">Citas Hoy</p>
              <div className="mt-2">
                <Progress value={todayProgress} className="h-1.5" />
                <div className="flex justify-between text-xs text-blue-500 mt-1">
                  <span>{stats.today.completed} completadas</span>
                  <span>{stats.today.pending + stats.today.confirmed} pendientes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Citas Semana */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CalendarCheck className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">{stats.week.total}</p>
              <p className="text-xs text-green-600 font-medium">Esta Semana</p>
              <p className="text-xs text-green-500 mt-2">
                {stats.month.total} este mes
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Pacientes */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">{stats.overall.totalPatients}</p>
              <p className="text-xs text-purple-600 font-medium">Pacientes Totales</p>
              <p className="text-xs text-purple-500 mt-2">
                {stats.overall.totalRecords} historias creadas
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tasa de Completación */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-orange-900">{stats.overall.totalCompleted}</p>
              <p className="text-xs text-orange-600 font-medium">Citas Completadas</p>
              {stats.overall.avgDurationMinutes > 0 && (
                <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  ~{stats.overall.avgDurationMinutes} min promedio
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Second row: Next Appointment + Daily Breakdown + Weekly Trend + Recent Patients */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Próxima Cita */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Próxima Cita
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.nextAppointment ? (
                <div className="space-y-2">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="font-bold text-blue-900 text-lg">
                      {convertUTCToColombiaTime(stats.nextAppointment.start_time)}
                    </p>
                    <p className="text-sm text-blue-700">
                      {formatDate(stats.nextAppointment.scheduled_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                    <span className="font-medium">{stats.nextAppointment.patient_name}</span>
                  </div>
                  {stats.nextAppointment.specialty_name && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Stethoscope className="h-3.5 w-3.5" />
                      {stats.nextAppointment.specialty_name}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CalendarCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin citas próximas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Desglose de Hoy */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-600" />
                Desglose de Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <span className="text-sm">Pendientes</span>
                  </div>
                  <span className="font-bold text-lg">{stats.today.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm">Confirmadas</span>
                  </div>
                  <span className="font-bold text-lg">{stats.today.confirmed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">Completadas</span>
                  </div>
                  <span className="font-bold text-lg">{stats.today.completed}</span>
                </div>
                {stats.today.total > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Progreso del día</span>
                      <span className="font-bold text-green-600">{todayProgress}%</span>
                    </div>
                    <Progress value={todayProgress} className="mt-1 h-2" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tendencia Semanal */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                Últimas 4 Semanas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.weeklyTrend.length > 0 ? (
                <div className="space-y-2">
                  {stats.weeklyTrend.slice().reverse().map((week, idx) => {
                    const maxTotal = Math.max(...stats.weeklyTrend.map(w => w.total), 1);
                    const width = Math.max(10, (week.total / maxTotal) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{formatDate(week.week_start)}</span>
                          <span className="font-medium">{week.total} citas / {week.unique_patients} pac.</span>
                        </div>
                        <div className="relative">
                          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all"
                              style={{ width: `${width}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <BarChart3 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin datos de tendencia</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Patients */}
      {stats.recentPatients.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Últimos Pacientes Atendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {stats.recentPatients.map((patient) => (
                  <Card
                    key={patient.patient_id} 
                    className={`hover:shadow-md transition-all ${onPatientClick ? 'cursor-pointer' : ''} border-t-2 border-t-blue-400`}
                    onClick={() => onPatientClick?.(patient.patient_id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-semibold truncate">{patient.name}</p>
                          <p className="text-xs text-gray-400">{patient.document}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <span>{patient.visit_count} visitas</span>
                        {patient.age && <span>{patient.age} años</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default DoctorEnhancedStats;
