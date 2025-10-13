import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar,
  Phone,
  Clock,
  TrendingUp,
  TrendingDown,
  HeadphonesIcon,
  UserCheck,
  MapPin,
  FileText
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import api from "@/lib/api";
import { EnhancedStaggerContainer, EnhancedStaggerChild, AnimatedCard } from "@/components/ui/enhanced-animated-container";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

const Dashboard = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Estado de métricas reales
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [todayAppointments, setTodayAppointments] = useState<number>(0);
  const [activeCalls, setActiveCalls] = useState<number>(0);
  const [waitingCalls, setWaitingCalls] = useState<number>(0);
  const [avgWaitTime, setAvgWaitTime] = useState<string>("-");
  const [loading, setLoading] = useState<boolean>(true);
  const todayStr = useMemo(() => new Date().toISOString().slice(0,10), []);

  // Datos derivados (gráficos y recientes)
  const [callsData, setCallsData] = useState<{ hour: string; calls: number; resolved: number }[]>([]);
  const [consultationTypes, setConsultationTypes] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentCalls, setRecentCalls] = useState<{ id: number | string; patient: string; type: string; status: string; agent: string; time: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [patients, appts, logs, statuses] = await Promise.all([
          api.getPatients(),
          // ✅ CORREGIDO: Usar objeto con date
          api.getAppointments({ date: todayStr }),
          api.getCallLogs({ date: todayStr }),
          api.getCallStatuses(),
        ]);

        setTotalPatients(Array.isArray(patients) ? patients.length : 0);
        setTodayAppointments(Array.isArray(appts) ? appts.length : 0);

        // Mapear statuses por nombre para búsquedas básicas
        const statusById = new Map<number, any>();
        const statusIdByName = new Map<string, number>();
        (statuses || []).forEach((s: any) => {
          if (s?.id) statusById.set(Number(s.id), s);
          if (s?.name) statusIdByName.set(String(s.name).toLowerCase(), Number(s.id));
        });

        // Activas y en espera por nombre común (fallback: 0)
        const activeId = statusIdByName.get('en curso');
        const waitingId = statusIdByName.get('en espera');
        const logsToday = Array.isArray(logs) ? logs : [];
        setActiveCalls(
          typeof activeId === 'number' ? logsToday.filter((l: any) => Number(l.status_id) === activeId).length : 0
        );
        setWaitingCalls(
          typeof waitingId === 'number' ? logsToday.filter((l: any) => Number(l.status_id) === waitingId).length : 0
        );

        // Promedio de espera: si no tenemos tiempos, dejar "-"
        setAvgWaitTime('-');

        // Llamadas por hora: agrupar por hora del día
        const buckets = new Map<string, { calls: number; resolved: number }>();
        const hours = ['08','09','10','11','12','13','14','15','16','17'];
        hours.forEach(h => buckets.set(`${h}:00`, { calls: 0, resolved: 0 }));
        logsToday.forEach((l: any) => {
          const dt = l.created_at ? new Date(l.created_at) : null;
          if (!dt) return;
          const h = String(dt.getHours()).padStart(2,'0') + ':00';
          const b = buckets.get(h) || { calls: 0, resolved: 0 };
          b.calls += 1;
          const statusName = (l.status_name || statusById.get(Number(l.status_id))?.name || '').toString().toLowerCase();
          const resolved = statusName.includes('complet') || String(l.outcome || '').toLowerCase().includes('agend');
          if (resolved) b.resolved += 1;
          buckets.set(h, b);
        });
        setCallsData(hours.map(h => ({ hour: `${h}:00`, calls: buckets.get(`${h}:00`)?.calls || 0, resolved: buckets.get(`${h}:00`)?.resolved || 0 })));

        // Tipos de consulta: por especialidad de citas de hoy
        const apptBySpec = new Map<string, number>();
        (appts || []).forEach((a: any) => {
          const name = (a.specialty_name || 'Otros').toString();
          apptBySpec.set(name, (apptBySpec.get(name) || 0) + 1);
        });
        const totalAppts = Array.from(apptBySpec.values()).reduce((s, n) => s + n, 0) || 1;
        const palette = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#a3e635"];
        const types = Array.from(apptBySpec.entries()).map(([name, count], i) => ({ name, value: Math.round((count/totalAppts)*100), color: palette[i % palette.length] }));
        setConsultationTypes(types);

        // Llamadas recientes: últimas 10 por fecha
        const recent = [...logsToday]
          .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, 10)
          .map((l: any) => ({
            id: l.id,
            patient: l.patient_name || l.patient || 'Paciente',
            type: l.specialty_name || 'Consulta',
            status: l.status_name || statusById.get(Number(l.status_id))?.name || '—',
            agent: l.user_name || '-',
            time: l.created_at ? new Date(l.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
          }));
        setRecentCalls(recent);
      } catch {
        // Mantener valores por defecto en caso de error
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [todayStr]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En curso": return "bg-medical-500 text-white";
      case "Completada": return "bg-success-500 text-white";
      case "En espera": return "bg-warning-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-medical-800">Dashboard de Call Center</h1>
          <p className="text-medical-600 mt-1">
            {currentTime.toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} - {currentTime.toLocaleTimeString('es-ES')}
          </p>
        </div>
      </div>

      {/* Métricas principales */}
      {loading ? (
        <LoadingSkeleton variant="dashboard" />
      ) : (
        <EnhancedStaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <EnhancedStaggerChild>
            <AnimatedCard 
              variant="elevated" 
              className="border-medical-200 hover:shadow-lg transition-shadow"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-medical-600">Pacientes Totales</CardTitle>
                <Users className="h-4 w-4 text-medical-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-medical-800">{(totalPatients || 0).toLocaleString()}</div>
                <p className="text-xs text-success-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +12% desde el mes pasado
                </p>
              </CardContent>
            </AnimatedCard>
          </EnhancedStaggerChild>

          <EnhancedStaggerChild>
            <AnimatedCard 
              variant="elevated" 
              className="border-medical-200 hover:shadow-lg transition-shadow"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-medical-600">Citas Hoy</CardTitle>
                <Calendar className="h-4 w-4 text-medical-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-medical-800">{todayAppointments}</div>
                <p className="text-xs text-success-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +8% respecto a ayer
                </p>
              </CardContent>
            </AnimatedCard>
          </EnhancedStaggerChild>

          <EnhancedStaggerChild>
            <AnimatedCard 
              variant="elevated" 
              className="border-medical-200 hover:shadow-lg transition-shadow"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-medical-600">Llamadas Activas</CardTitle>
                <Phone className="h-4 w-4 text-medical-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-medical-800">{activeCalls}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge className="bg-warning-100 text-warning-800 text-xs">
                    {waitingCalls} en espera
                  </Badge>
                </div>
              </CardContent>
            </AnimatedCard>
          </EnhancedStaggerChild>

          <EnhancedStaggerChild>
            <AnimatedCard 
              variant="elevated" 
              className="border-medical-200 hover:shadow-lg transition-shadow"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-medical-600">Tiempo Promedio</CardTitle>
                <Clock className="h-4 w-4 text-medical-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-medical-800">{avgWaitTime}</div>
                <p className="text-xs text-success-600 flex items-center mt-1">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  -15% mejor que ayer
                </p>
              </CardContent>
            </AnimatedCard>
          </EnhancedStaggerChild>
        </EnhancedStaggerContainer>
      )}

      {/* Gráficos de análisis */}
      <EnhancedStaggerContainer className="grid grid-cols-1 lg:grid-cols-2 gap-6" delay={200}>
        <EnhancedStaggerChild>
          <AnimatedCard variant="elevated" className="border-medical-200">
            <CardHeader>
              <CardTitle className="text-medical-800">Llamadas por Hora</CardTitle>
              <CardDescription>Comparación entre llamadas recibidas y resueltas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={callsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#f8fafc', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="calls" fill="#0ea5e9" name="Recibidas" />
                  <Bar dataKey="resolved" fill="#22c55e" name="Resueltas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>

        <EnhancedStaggerChild>
          <AnimatedCard variant="elevated" className="border-medical-200">
            <CardHeader>
              <CardTitle className="text-medical-800">Tipos de Consulta</CardTitle>
              <CardDescription>Distribución de consultas por especialidad</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={consultationTypes}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {consultationTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Porcentaje']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>
      </EnhancedStaggerContainer>

      {/* Lista de llamadas recientes */}
      <EnhancedStaggerChild>
        <AnimatedCard variant="elevated" className="border-medical-200">
          <CardHeader>
            <CardTitle className="text-medical-800 flex items-center gap-2">
              <HeadphonesIcon className="h-5 w-5" />
              Llamadas Recientes
            </CardTitle>
            <CardDescription>Últimas llamadas procesadas por el call center</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCalls.length > 0 ? (
                recentCalls.map((call, index) => (
                  <EnhancedStaggerChild key={call.id} as="div" hover={true}>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-medical-500"></div>
                        <div>
                          <p className="font-medium text-medical-800">{call.patient}</p>
                          <p className="text-sm text-medical-600">{call.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(call.status)}>
                          {call.status}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm font-medium text-medical-600">{call.agent}</p>
                          <p className="text-xs text-medical-500">{call.time}</p>
                        </div>
                      </div>
                    </div>
                  </EnhancedStaggerChild>
                ))
              ) : (
                <div className="text-center py-8 text-medical-500">
                  <HeadphonesIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay llamadas recientes registradas</p>
                </div>
              )}
            </div>
          </CardContent>
        </AnimatedCard>
      </EnhancedStaggerChild>
    </div>
  );
};

export default Dashboard;
