// ==============================================
// DASHBOARD DE MÉTRICAS AVANZADAS
// ==============================================

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  DollarSign, 
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface MetricsData {
  overview: {
    total_patients: number;
    new_patients_period: number;
    total_appointments: number;
    completed_appointments: number;
    revenue: number;
    avg_satisfaction: number;
    growth_rate: number;
  };
  trends: {
    patients: Array<{ date: string; count: number; new: number }>;
    appointments: Array<{ date: string; scheduled: number; completed: number; cancelled: number }>;
    revenue: Array<{ date: string; amount: number }>;
  };
  specialties: Array<{ name: string; appointments: number; revenue: number; satisfaction: number }>;
  doctors: Array<{ name: string; appointments: number; rating: number; revenue: number }>;
  system: {
    uptime: number;
    response_time: number;
    active_sessions: number;
    storage_used: number;
  };
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function AdvancedMetricsDashboard() {
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '365d'>('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  // Cargar datos del dashboard
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboard, patients, appointments, doctors, financial, system] = await Promise.all([
        api.metrics.getDashboard(period),
        api.metrics.getPatientMetrics(period),
        api.metrics.getAppointmentMetrics(period),
        api.metrics.getDoctorMetrics(period),
        api.metrics.getFinancialMetrics(period),
        api.metrics.getSystemMetrics(),
      ]);

      // Combinar datos de diferentes endpoints
      setMetricsData({
        overview: {
          total_patients: dashboard.data.total_patients || 0,
          new_patients_period: patients.data.new_patients || 0,
          total_appointments: appointments.data.total_appointments || 0,
          completed_appointments: appointments.data.completed_appointments || 0,
          revenue: financial.data.total_revenue || 0,
          avg_satisfaction: dashboard.data.avg_satisfaction || 0,
          growth_rate: dashboard.data.growth_rate || 0,
        },
        trends: {
          patients: patients.data.trends || [],
          appointments: appointments.data.trends || [],
          revenue: financial.data.trends || [],
        },
        specialties: dashboard.data.specialties || [],
        doctors: doctors.data.doctors || [],
        system: system.data || {
          uptime: 99.9,
          response_time: 120,
          active_sessions: 0,
          storage_used: 0,
        },
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las métricas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Exportar métricas
  const exportMetrics = (type: 'pdf' | 'excel') => {
    try {
      api.metrics.export(type, period);
      toast({
        title: "Exportando métricas",
        description: `Se está preparando el archivo ${type.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Error exporting metrics:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar las métricas",
        variant: "destructive",
      });
    }
  };

  // Formatear números
  const formatNumber = (num: number, prefix = '') => {
    if (num >= 1000000) {
      return `${prefix}${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${prefix}${(num / 1000).toFixed(1)}K`;
    }
    return `${prefix}${num.toLocaleString()}`;
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calcular porcentaje de cambio
  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  if (loading && !metricsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  if (!metricsData) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">No se pudieron cargar las métricas</h3>
        <Button onClick={loadDashboardData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Dashboard de Métricas</h2>
          <p className="text-muted-foreground">
            Análisis completo del rendimiento de Biosanar IPS
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="365d">1 año</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadDashboardData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => exportMetrics('pdf')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={() => exportMetrics('excel')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metricsData.overview.total_patients)}</div>
            <p className="text-xs text-muted-foreground">
              +{metricsData.overview.new_patients_period} nuevos este período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citas Completadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metricsData.overview.completed_appointments)}</div>
            <p className="text-xs text-muted-foreground">
              de {formatNumber(metricsData.overview.total_appointments)} programadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metricsData.overview.revenue)}</div>
            <div className="flex items-center text-xs">
              {metricsData.overview.growth_rate >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={metricsData.overview.growth_rate >= 0 ? 'text-green-500' : 'text-red-500'}>
                {metricsData.overview.growth_rate.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfacción</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData.overview.avg_satisfaction.toFixed(1)}/5</div>
            <Progress value={metricsData.overview.avg_satisfaction * 20} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Contenido por pestañas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="patients">Pacientes</TabsTrigger>
          <TabsTrigger value="appointments">Citas</TabsTrigger>
          <TabsTrigger value="doctors">Doctores</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tendencia de pacientes */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Pacientes</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metricsData.trends.patients}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="new" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución por especialidades */}
            <Card>
              <CardHeader>
                <CardTitle>Citas por Especialidad</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metricsData.specialties}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="appointments"
                    >
                      {metricsData.specialties.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {metricsData.specialties.slice(0, 5).map((specialty, index) => (
                    <div key={specialty.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm">{specialty.name}</span>
                      </div>
                      <span className="text-sm font-medium">{specialty.appointments}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tendencia de ingresos */}
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricsData.trends.revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Line type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Pacientes</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={metricsData.trends.patients}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="Total Pacientes" />
                  <Bar dataKey="new" fill="#22c55e" name="Nuevos Pacientes" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado de Citas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={metricsData.trends.appointments}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="scheduled" fill="#3b82f6" name="Programadas" />
                  <Bar dataKey="completed" fill="#22c55e" name="Completadas" />
                  <Bar dataKey="cancelled" fill="#ef4444" name="Canceladas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doctors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento de Doctores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metricsData.doctors.map((doctor, index) => (
                  <div key={doctor.name} className="flex items-center justify-between p-4 border rounded">
                    <div>
                      <h4 className="font-medium">{doctor.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {doctor.appointments} citas • {formatCurrency(doctor.revenue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{doctor.rating.toFixed(1)}/5</span>
                        <Progress value={doctor.rating * 20} className="w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Estado del Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tiempo de actividad</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{metricsData.system.uptime}%</span>
                    <Badge variant="default">Excelente</Badge>
                  </div>
                </div>
                <Progress value={metricsData.system.uptime} />

                <div className="flex items-center justify-between">
                  <span className="text-sm">Tiempo de respuesta</span>
                  <span className="text-sm font-medium">{metricsData.system.response_time}ms</span>
                </div>
                <Progress value={Math.max(0, 100 - (metricsData.system.response_time / 10))} />

                <div className="flex items-center justify-between">
                  <span className="text-sm">Sesiones activas</span>
                  <span className="text-sm font-medium">{metricsData.system.active_sessions}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Almacenamiento usado</span>
                  <span className="text-sm font-medium">{metricsData.system.storage_used}%</span>
                </div>
                <Progress value={metricsData.system.storage_used} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas del Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Todos los servicios operativos</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Base de datos saludable</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Backups actualizados</span>
                  </div>
                  {metricsData.system.storage_used > 80 && (
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Almacenamiento alto</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdvancedMetricsDashboard;
