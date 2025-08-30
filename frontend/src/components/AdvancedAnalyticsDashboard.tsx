import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import {
  Calendar,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DashboardMetrics {
  general_metrics: {
    total_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    confirmed_appointments: number;
    pending_appointments: number;
    avg_appointment_duration: number;
    unique_patients: number;
    active_doctors: number;
    completion_rate: number;
  };
  weekday_distribution: Array<{
    weekday: number;
    appointment_count: number;
    avg_duration: number;
  }>;
  hourly_distribution: Array<{
    hour: number;
    appointment_count: number;
    avg_duration: number;
  }>;
  top_specialties: Array<{
    specialty_name: string;
    appointment_count: number;
    avg_duration: number;
    completion_rate: number;
  }>;
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }>;
}

const AdvancedAnalyticsDashboard = () => {
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null);
  const [doctorPerformance, setDoctorPerformance] = useState<any>(null);
  const [capacityAnalysis, setCapacityAnalysis] = useState<any>(null);
  const [trendsData, setTrendsData] = useState<any>(null);
  const [patientInsights, setPatientInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    location_id: '',
    specialty_id: '',
    doctor_id: ''
  });

  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Cargar datos del dashboard principal
      const dashboardResponse = await api.get('/advanced-analytics/dashboard', {
        params: filters
      });
      setDashboardData(dashboardResponse.data.data);

      // Cargar rendimiento de doctores
      const doctorResponse = await api.get('/advanced-analytics/doctor-performance', {
        params: filters
      });
      setDoctorPerformance(doctorResponse.data.data);

      // Cargar análisis de capacidad
      const capacityResponse = await api.get('/advanced-analytics/capacity-analysis', {
        params: filters
      });
      setCapacityAnalysis(capacityResponse.data.data);

      // Cargar tendencias
      const trendsResponse = await api.get('/advanced-analytics/trends');
      setTrendsData(trendsResponse.data.data);

      // Cargar insights de pacientes
      const patientResponse = await api.get('/advanced-analytics/patient-insights', {
        params: filters
      });
      setPatientInsights(patientResponse.data.data);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const exportData = () => {
    const data = {
      dashboard: dashboardData,
      doctorPerformance,
      capacityAnalysis,
      trends: trendsData,
      patientInsights,
      exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportación completada",
      description: "Los datos han sido exportados exitosamente"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-medical-600" />
        <span className="ml-2 text-lg">Cargando dashboard...</span>
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-medical-600" />
                Dashboard Analítico Avanzado
              </CardTitle>
              <CardDescription>
                Métricas detalladas y insights del sistema de citas médicas
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadDashboardData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
              <Button variant="outline" onClick={exportData}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="date_from">Fecha Desde</Label>
              <Input
                id="date_from"
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="date_to">Fecha Hasta</Label>
              <Input
                id="date_to"
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="location">Ubicación</Label>
              <Select value={filters.location_id} onValueChange={(value) => handleFilterChange('location_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las ubicaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las ubicaciones</SelectItem>
                  {/* Aquí irían las opciones dinámicas */}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="specialty">Especialidad</Label>
              <Select value={filters.specialty_id} onValueChange={(value) => handleFilterChange('specialty_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las especialidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las especialidades</SelectItem>
                  {/* Aquí irían las opciones dinámicas */}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="doctor">Doctor</Label>
              <Select value={filters.doctor_id} onValueChange={(value) => handleFilterChange('doctor_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los doctores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los doctores</SelectItem>
                  {/* Aquí irían las opciones dinámicas */}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas del sistema */}
      {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              Alertas del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.alerts.map((alert, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                  alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                  alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="doctors">Rendimiento Doctores</TabsTrigger>
          <TabsTrigger value="capacity">Capacidad y Recursos</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
          <TabsTrigger value="patients">Insights Pacientes</TabsTrigger>
        </TabsList>

        {/* Vista General */}
        <TabsContent value="overview" className="space-y-6">
          {dashboardData && (
            <>
              {/* Métricas principales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Citas</p>
                        <p className="text-2xl font-bold text-medical-600">
                          {dashboardData.general_metrics.total_appointments}
                        </p>
                      </div>
                      <Calendar className="w-8 h-8 text-medical-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Tasa Completación</p>
                        <p className="text-2xl font-bold text-green-600">
                          {dashboardData.general_metrics.completion_rate}%
                        </p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Pacientes Únicos</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {dashboardData.general_metrics.unique_patients}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Duración Promedio</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {dashboardData.general_metrics.avg_appointment_duration}min
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Distribución por día de la semana */}
                <Card>
                  <CardHeader>
                    <CardTitle>Citas por Día de la Semana</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dashboardData.weekday_distribution.map(item => ({
                        day: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][item.weekday - 1],
                        citas: item.appointment_count
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="citas" fill="#0088FE" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Distribución por hora */}
                <Card>
                  <CardHeader>
                    <CardTitle>Citas por Hora del Día</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={dashboardData.hourly_distribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="appointment_count" stroke="#00C49F" fill="#00C49F" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Top especialidades */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Especialidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData.top_specialties.slice(0, 5).map((specialty, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{specialty.specialty_name}</p>
                            <p className="text-sm text-gray-600">{specialty.appointment_count} citas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{specialty.completion_rate}% completadas</p>
                          <p className="text-sm text-gray-600">{specialty.avg_duration}min promedio</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Rendimiento de Doctores */}
        <TabsContent value="doctors" className="space-y-6">
          {doctorPerformance && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-medical-600">
                        {doctorPerformance.summary.total_doctors}
                      </p>
                      <p className="text-sm text-gray-600">Doctores Activos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {doctorPerformance.summary.avg_completion_rate}%
                      </p>
                      <p className="text-sm text-gray-600">Tasa Completación Promedio</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600">
                        {doctorPerformance.summary.avg_cancellation_rate}%
                      </p>
                      <p className="text-sm text-gray-600">Tasa Cancelación Promedio</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking de Doctores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {doctorPerformance.doctor_metrics.slice(0, 10).map((doctor: any, index: number) => (
                      <div key={doctor.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{doctor.doctor_name}</p>
                            <p className="text-sm text-gray-600">{doctor.specialty_name}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-green-600">{doctor.completion_rate}%</p>
                            <p className="text-xs text-gray-600">Completadas</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-blue-600">{doctor.total_appointments}</p>
                            <p className="text-xs text-gray-600">Total Citas</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-purple-600">{doctor.performance_score.toFixed(1)}</p>
                            <p className="text-xs text-gray-600">Puntuación</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Capacidad y Recursos */}
        <TabsContent value="capacity" className="space-y-6">
          {capacityAnalysis && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Utilización de Capacidad Diaria</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={capacityAnalysis.daily_capacity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="capacity_utilization" stroke="#FFBB28" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Utilización por Doctor</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={capacityAnalysis.doctor_capacity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="doctor_name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="utilization_rate" fill="#8884D8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tendencias */}
        <TabsContent value="trends" className="space-y-6">
          {trendsData && (
            <Card>
              <CardHeader>
                <CardTitle>Tendencias de Citas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendsData.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total_appointments" stroke="#0088FE" strokeWidth={2} />
                    <Line type="monotone" dataKey="completed_appointments" stroke="#00C49F" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Insights de Pacientes */}
        <TabsContent value="patients" className="space-y-6">
          {patientInsights && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-medical-600">
                        {patientInsights.demographics.total_patients}
                      </p>
                      <p className="text-sm text-gray-600">Pacientes Totales</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">
                        {patientInsights.demographics.avg_age}
                      </p>
                      <p className="text-sm text-gray-600">Edad Promedio</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {patientInsights.return_rate.return_rate}%
                      </p>
                      <p className="text-sm text-gray-600">Tasa de Retorno</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Frecuencia de Visitas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={patientInsights.visit_frequency}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ patient_visits, percentage }) => `${patient_visits} visita(s): ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="patient_count"
                      >
                        {patientInsights.visit_frequency.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
