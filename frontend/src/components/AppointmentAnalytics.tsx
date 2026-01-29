import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { convertUTCToColombiaTime } from '@/utils/dateHelpers';
import { 
  BarChart3, 
  PieChart, 
  Calendar, 
  Phone, 
  Globe, 
  TrendingUp,
  Users,
  Clock,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  MapPin,
  Loader2
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface OccupancyDetail {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  availableSlots: number;
  occupancyRate: number;
  status: string;
  isOverbooked: boolean;
}

interface OccupancyDetailsData {
  doctor_id: number;
  specialty_id: number;
  doctor_name: string;
  specialty_name: string;
  summary: {
    totalCapacity: number;
    totalConfirmed: number;
    totalCancelled: number;
    availableSlots: number;
    occupancyRate: number;
    totalAvailabilities: number;
  };
  availabilities: OccupancyDetail[];
}

interface AppointmentAnalytics {
  sourceStats: {
    web: number;
    phone: number;
    system: number;
  };
  dailyStats: Array<{
    date: string;
    web: number;
    phone: number;
    system: number;
    total: number;
  }>;
  occupancyStats: Array<{
    doctorId: number;
    specialtyId: number;
    doctor: string;
    specialty: string;
    totalSlots: number;
    bookedSlots: number;
    occupancyRate: number;
  }>;
  weeklyTrend: Array<{
    week: string;
    appointments: number;
    cancellations: number;
  }>;
}

const COLORS = {
  web: '#3b82f6',     // blue-500
  phone: '#10b981',   // emerald-500
  system: '#f59e0b',  // amber-500
  booked: '#059669',  // emerald-600
  available: '#e5e7eb' // gray-200
};

const AppointmentAnalytics = () => {
  const [analytics, setAnalytics] = useState<AppointmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const { toast } = useToast();
  
  // Estado para detalles expandibles
  const [expandedOccupancy, setExpandedOccupancy] = useState<string | null>(null);
  const [occupancyDetails, setOccupancyDetails] = useState<Record<string, OccupancyDetailsData>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  const loadOccupancyDetails = async (doctorId: number, specialtyId: number) => {
    const key = `${doctorId}-${specialtyId}`;
    
    // Si ya está expandido, cerrar
    if (expandedOccupancy === key) {
      setExpandedOccupancy(null);
      return;
    }
    
    // Si ya tenemos los datos cacheados, solo expandir
    if (occupancyDetails[key]) {
      setExpandedOccupancy(key);
      return;
    }
    
    // Cargar datos
    try {
      setLoadingDetails(key);
      const response = await api.getOccupancyDetails(doctorId, specialtyId);
      
      if (response.success) {
        setOccupancyDetails(prev => ({
          ...prev,
          [key]: response.data
        }));
        setExpandedOccupancy(key);
      } else {
        throw new Error('Error al cargar detalles');
      }
    } catch (error: any) {
      console.error('Error loading occupancy details:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles de ocupación",
        variant: "destructive"
      });
    } finally {
      setLoadingDetails(null);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.getAppointmentAnalytics(dateRange.start, dateRange.end);
      
      if (response.success) {
        setAnalytics(response.data);
      } else {
        throw new Error(response.error || 'Error al cargar analytics');
      }
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const sourceData = analytics ? [
    { name: 'Web', value: analytics.sourceStats.web, color: COLORS.web },
    { name: 'Teléfono', value: analytics.sourceStats.phone, color: COLORS.phone },
    { name: 'Sistema', value: analytics.sourceStats.system, color: COLORS.system }
  ] : [];

  const totalAppointments = sourceData.reduce((sum, item) => sum + item.value, 0);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // No mostrar label si es menos del 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-lg text-gray-600">Cargando analytics...</span>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <BarChart3 className="w-12 h-12 mb-4" />
        <p className="text-lg">No hay datos disponibles</p>
        <Button onClick={loadAnalytics} variant="outline" className="mt-4">
          Intentar de nuevo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics de Citas</h2>
          <p className="text-gray-600">
            Del {format(new Date(dateRange.start), "dd 'de' MMMM", { locale: es })} al{" "}
            {format(new Date(dateRange.end), "dd 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={loadAnalytics}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Citas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAppointments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              En {Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24))} días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vía Web</CardTitle>
            <Globe className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{analytics.sourceStats.web.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalAppointments > 0 ? `${Math.round((analytics.sourceStats.web / totalAppointments) * 100)}%` : '0%'} del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vía Teléfono</CardTitle>
            <Phone className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{analytics.sourceStats.phone.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalAppointments > 0 ? `${Math.round((analytics.sourceStats.phone / totalAppointments) * 100)}%` : '0%'} del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistema Interno</CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{analytics.sourceStats.system.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalAppointments > 0 ? `${Math.round((analytics.sourceStats.system / totalAppointments) * 100)}%` : '0%'} del total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de fuentes de citas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Origen de las Citas
            </CardTitle>
            <CardDescription>
              Distribución por canal de agendamiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <RechartsPieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [value, 'Citas']}
                    labelFormatter={(label) => `Fuente: ${label}`}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry) => (
                      <span style={{ color: entry.color }}>
                        {value}: {entry.payload.value} citas
                      </span>
                    )}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de asignación por día */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Asignación Diaria
            </CardTitle>
            <CardDescription>
              Citas agendadas por día y fuente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={analytics.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), "dd/MM")}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(label) => format(new Date(label), "dd 'de' MMMM, yyyy", { locale: es })}
                  />
                  <Legend />
                  <Bar dataKey="web" stackId="a" fill={COLORS.web} name="Web" />
                  <Bar dataKey="phone" stackId="a" fill={COLORS.phone} name="Teléfono" />
                  <Bar dataKey="system" stackId="a" fill={COLORS.system} name="Sistema" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de ocupación de consultorios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Ocupación de Consultorios
          </CardTitle>
          <CardDescription>
            Nivel de llenado por doctor y especialidad (clic para ver detalles)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.occupancyStats.map((stat, index) => {
              const key = `${stat.doctorId}-${stat.specialtyId}`;
              const isExpanded = expandedOccupancy === key;
              const isLoading = loadingDetails === key;
              const details = occupancyDetails[key];
              
              return (
                <div key={index} className="border rounded-lg overflow-hidden">
                  {/* Fila principal - clickeable */}
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => loadOccupancyDetails(stat.doctorId, stat.specialtyId)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{stat.doctor}</h4>
                        {stat.occupancyRate > 100 && (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{stat.specialty}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              stat.occupancyRate > 100 
                                ? 'bg-gradient-to-r from-amber-500 to-red-500' 
                                : 'bg-gradient-to-r from-blue-500 to-blue-600'
                            }`}
                            style={{ width: `${Math.min(stat.occupancyRate, 100)}%` }}
                          />
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {stat.bookedSlots}/{stat.totalSlots}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <div className={`text-lg font-bold ${stat.occupancyRate > 100 ? 'text-amber-600' : 'text-gray-900'}`}>
                          {Math.round(stat.occupancyRate)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          Ocupación
                        </div>
                      </div>
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      ) : isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Detalle expandido */}
                  {isExpanded && details && (
                    <div className="border-t bg-gray-50 p-4">
                      {/* Resumen */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-xs text-gray-500">Agendas</div>
                          <div className="text-lg font-bold">{details.summary.totalAvailabilities}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-xs text-gray-500">Capacidad Total</div>
                          <div className="text-lg font-bold">{details.summary.totalCapacity}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-xs text-gray-500">Confirmadas</div>
                          <div className="text-lg font-bold text-green-600">{details.summary.totalConfirmed}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-xs text-gray-500">Disponibles</div>
                          <div className="text-lg font-bold text-blue-600">{details.summary.availableSlots}</div>
                        </div>
                      </div>
                      
                      {/* Tabla de agendas */}
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Detalle de agendas (desde hoy):
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left">Fecha</th>
                              <th className="px-3 py-2 text-left">Horario</th>
                              <th className="px-3 py-2 text-left">Sede</th>
                              <th className="px-3 py-2 text-center">Cupos</th>
                              <th className="px-3 py-2 text-center">Agendadas</th>
                              <th className="px-3 py-2 text-center">Disponible</th>
                              <th className="px-3 py-2 text-center">%</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {details.availabilities.map((av) => (
                              <tr 
                                key={av.id} 
                                className={`${av.isOverbooked ? 'bg-amber-50' : 'bg-white'} hover:bg-gray-50`}
                              >
                                <td className="px-3 py-2">
                                  {format(parseISO(av.date), "dd/MM/yyyy")}
                                </td>
                                <td className="px-3 py-2">
                                  {convertUTCToColombiaTime(av.startTime)} - {convertUTCToColombiaTime(av.endTime)}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-gray-400" />
                                    <span className="truncate max-w-[120px]">{av.location}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center font-medium">
                                  {av.capacity}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`font-medium ${av.isOverbooked ? 'text-amber-600' : 'text-green-600'}`}>
                                    {av.confirmedAppointments}
                                  </span>
                                  {av.cancelledAppointments > 0 && (
                                    <span className="text-red-400 ml-1 text-xs">
                                      (+{av.cancelledAppointments} canc.)
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`font-medium ${av.availableSlots === 0 ? 'text-gray-400' : 'text-blue-600'}`}>
                                    {av.availableSlots}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {av.isOverbooked ? (
                                    <Badge variant="destructive" className="text-xs">
                                      {av.occupancyRate}%
                                    </Badge>
                                  ) : av.occupancyRate >= 90 ? (
                                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                                      {av.occupancyRate}%
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-600">{av.occupancyRate}%</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {details.availabilities.some(av => av.isOverbooked) && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-700">
                            <strong>Sobregiro detectado:</strong> Hay agendas con más citas que cupos disponibles. 
                            Considere aumentar la capacidad o redistribuir las citas.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tendencia semanal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Tendencia Semanal
          </CardTitle>
          <CardDescription>
            Comparativo de citas agendadas vs cancelaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={analytics.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="appointments" 
                  stroke={COLORS.web} 
                  strokeWidth={2}
                  name="Citas Agendadas"
                />
                <Line 
                  type="monotone" 
                  dataKey="cancellations" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Cancelaciones"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentAnalytics;