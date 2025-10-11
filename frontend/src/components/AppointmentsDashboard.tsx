import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar,
  Clock,
  Users,
  UserCheck,
  Stethoscope,
  MapPin,
  Plus,
  Activity,
  TrendingUp,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Timer
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import QuickAppointmentModal from "@/components/QuickAppointmentModal";

// Tipos
interface AppointmentStats {
  total: number;
  confirmed: number;
  pending: number;
  completed: number;
  cancelled: number;
}

interface SpecialtyStats {
  name: string;
  total: number;
  available: number;
  occupied: number;
  percentage: number;
  discount: number;
}

interface DailyStats {
  date: string;
  appointments: number;
  realAppointments?: number;
  capacity: number;
  utilization: number;
  available?: number;
}

interface AvailabilityData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  doctor: string;
  specialty: string;
  location: string;
  capacity: number;
  booked: number;
  available: number;
  doctorId: number;
  specialtyId: number;
  locationId: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AppointmentsDashboard = () => {
  const { toast } = useToast();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats>({
    total: 0,
    confirmed: 0,
    pending: 0,
    completed: 0,
    cancelled: 0
  });
  const [specialtyStats, setSpecialtyStats] = useState<SpecialtyStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [availabilities, setAvailabilities] = useState<AvailabilityData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<AvailabilityData | null>(null);

  // Cargar datos del dashboard
  useEffect(() => {
    loadDashboardData();
    // Configurar actualización automática cada 30 segundos
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAppointmentStats(),
        loadSpecialtyStats(),
        loadDailyStats(),
        loadAvailabilities()
      ]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error cargando datos",
        description: "No se pudieron cargar las estadísticas del dashboard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAppointmentStats = async () => {
    try {
      const today = new Date();
      const startDate = getStartDate(selectedPeriod, today);
      const endDate = today.toISOString().split('T')[0];
      
      const appointments = await api.getAppointments({
        start_date: startDate,
        end_date: endDate
      });
      
      const stats = appointments.reduce((acc: AppointmentStats, appointment: any) => {
        acc.total++;
        switch (appointment.status?.toLowerCase()) {
          case 'confirmada':
            acc.confirmed++;
            break;
          case 'pendiente':
            acc.pending++;
            break;
          case 'completada':
            acc.completed++;
            break;
          case 'cancelada':
            acc.cancelled++;
            break;
        }
        return acc;
      }, { total: 0, confirmed: 0, pending: 0, completed: 0, cancelled: 0 });
      
      setAppointmentStats(stats);
    } catch (error) {
      console.error('Error loading appointment stats:', error);
    }
  };

  const loadSpecialtyStats = async () => {
    try {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 7); // Próximos 7 días
      
      const availabilities = await api.getAvailabilities({
        start_date: today.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });
      
      const specialtyMap = new Map<string, { total: number; available: number; occupied: number }>();
      
      availabilities.forEach((availability: any) => {
        const specialty = availability.specialty || 'Sin especialidad';
        const current = specialtyMap.get(specialty) || { total: 0, available: 0, occupied: 0 };
        
        const capacity = availability.capacity || 0;
        const bookedSlots = availability.booked_slots || 0;
        const availableSlots = Math.max(0, capacity - bookedSlots);
        
        current.total += capacity;
        current.occupied += bookedSlots;
        current.available += availableSlots;
        
        specialtyMap.set(specialty, current);
      });
      
      const stats = Array.from(specialtyMap.entries()).map(([name, data]) => ({
        name,
        total: data.total,
        available: data.available,
        occupied: data.occupied,
        percentage: data.total > 0 ? Math.round((data.occupied / data.total) * 100) : 0,
        discount: data.total > 0 ? Math.round((data.available / data.total) * 100) : 0
      }));
      
      setSpecialtyStats(stats);
    } catch (error) {
      console.error('Error loading specialty stats:', error);
    }
  };

  const loadDailyStats = async () => {
    try {
      const today = new Date();
      const dates = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      const dailyData = await Promise.all(
        dates.map(async (date) => {
          try {
            const [appointments, availabilities] = await Promise.all([
              api.getAppointments({ start_date: date, end_date: date }),
              api.getAvailabilities({ start_date: date, end_date: date })
            ]);
            
            const totalCapacity = availabilities.reduce((sum: number, av: any) => {
              return sum + (av.capacity || 0);
            }, 0);
            
            const totalBooked = availabilities.reduce((sum: number, av: any) => {
              return sum + (av.booked_slots || 0);
            }, 0);
            
            // Usar datos reales de booked_slots en lugar de contar citas
            const appointmentCount = totalBooked;
            const realAppointmentCount = appointments.length;
            
            return {
              date: (() => {
                try {
                  const dateObj = new Date(date);
                  if (isNaN(dateObj.getTime())) {
                    console.warn('Invalid date in loadDailyStats:', date);
                    return date; // Return string if invalid
                  }
                  return dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                } catch (error) {
                  console.warn('Error formatting date in loadDailyStats:', date, error);
                  return date;
                }
              })(),
              appointments: appointmentCount, // Cupos ocupados reales
              realAppointments: realAppointmentCount, // Citas efectivas
              capacity: totalCapacity,
              utilization: totalCapacity > 0 ? Math.round((appointmentCount / totalCapacity) * 100) : 0,
              available: totalCapacity - appointmentCount
            };
          } catch {
            return {
              date: (() => {
                try {
                  const dateObj = new Date(date);
                  if (isNaN(dateObj.getTime())) {
                    return date; // Return string if invalid
                  }
                  return dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                } catch {
                  return date;
                }
              })(),
              appointments: 0,
              realAppointments: 0,
              capacity: 0,
              utilization: 0,
              available: 0
            };
          }
        })
      );
      
      setDailyStats(dailyData);
    } catch (error) {
      console.error('Error loading daily stats:', error);
    }
  };

  const loadAvailabilities = async () => {
    try {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 7);
      
      const data = await api.getAvailabilities({
        start_date: today.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });
      
      const formattedData: AvailabilityData[] = data.map((item: any) => {
        const capacity = item.capacity || 0;
        const bookedSlots = item.booked_slots || item.occupied || 0;
        const available = Math.max(0, capacity - bookedSlots);
        
        return {
          id: item.id,
          date: item.date,
          startTime: item.start_time || item.time_start || '00:00',
          endTime: item.end_time || item.time_end || '23:59',
          doctor: item.doctor_name || item.doctor || 'Doctor no asignado',
          specialty: item.specialty_name || item.specialty || 'Sin especialidad',
          location: item.location_name || item.location || 'Sin ubicación',
          capacity: capacity,
          booked: bookedSlots,
          available: available,
          doctorId: item.doctor_id || 0,
          specialtyId: item.specialty_id || 0,
          locationId: item.location_id || 0
        };
      });
      
      setAvailabilities(formattedData);
    } catch (error) {
      console.error('Error loading availabilities:', error);
    }
  };

  const getStartDate = (period: string, today: Date) => {
    const date = new Date(today);
    switch (period) {
      case 'week':
        date.setDate(today.getDate() - 7);
        break;
      case 'month':
        date.setMonth(today.getMonth() - 1);
        break;
      case 'quarter':
        date.setMonth(today.getMonth() - 3);
        break;
      default:
        date.setDate(today.getDate() - 7);
    }
    return date.toISOString().split('T')[0];
  };

  const handleCreateAppointment = (availability: AvailabilityData) => {
    setSelectedAvailability(availability);
    setShowQuickModal(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de Citas Médicas</h1>
          <div className="flex items-center gap-2 text-gray-600">
            <p>Gestiona y supervisa todas las citas médicas</p>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="quarter">Último trimestre</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={loadDashboardData}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Button onClick={() => setShowQuickModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cita
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Citas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointmentStats.total}</div>
            <p className="text-xs text-muted-foreground">
              En el período seleccionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{appointmentStats.confirmed}</div>
            <p className="text-xs text-muted-foreground">
              {appointmentStats.total > 0 ? Math.round((appointmentStats.confirmed / appointmentStats.total) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Timer className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{appointmentStats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Requieren confirmación
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cupos Totales</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {availabilities.reduce((sum, av) => sum + av.capacity, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Próximos 7 días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {availabilities.reduce((sum, av) => sum + av.available, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {availabilities.reduce((sum, av) => sum + av.capacity, 0) > 0 ? 
                Math.round((availabilities.reduce((sum, av) => sum + av.available, 0) / 
                availabilities.reduce((sum, av) => sum + av.capacity, 0)) * 100) : 0}% libres
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilización por Especialidad */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Cupos por Especialidad</CardTitle>
            <CardDescription>Cupos ocupados, disponibles y porcentaje de utilización</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={specialtyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name, props) => {
                    const data = props.payload;
                    if (name === 'occupied') {
                      return [`${value} ocupados (${data.percentage}%)`, 'Cupos Ocupados'];
                    }
                    if (name === 'available') {
                      return [`${value} disponibles (${data.discount}%)`, 'Cupos Disponibles'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Especialidad: ${label}`}
                />
                <Legend />
                <Bar dataKey="occupied" fill="#ef4444" name="Ocupados" />
                <Bar dataKey="available" fill="#22c55e" name="Disponibles" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Cupos Ocupados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Cupos Disponibles</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tendencia Semanal */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Utilización</CardTitle>
            <CardDescription>Últimos 7 días - Cupos ocupados vs capacidad total</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'utilization') return [`${value}%`, '% Utilización'];
                    if (name === 'appointments') return [`${value}`, 'Cupos Ocupados'];
                    if (name === 'capacity') return [`${value}`, 'Capacidad Total'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="utilization" 
                  stroke="#3b82f6" 
                  name="% Utilización"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="appointments" 
                  stroke="#10b981" 
                  name="Cupos Ocupados"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="capacity" 
                  stroke="#f59e0b" 
                  name="Capacidad Total"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Disponibilidades Próximas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Disponibilidades Próximas</CardTitle>
            <CardDescription>Próximas agendas con cupos disponibles (actualización automática)</CardDescription>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={loadDashboardData}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availabilities.filter(av => av.available > 0).slice(0, 10).map((availability) => {
              const utilizationPercentage = availability.capacity > 0 ? 
                Math.round((availability.booked / availability.capacity) * 100) : 0;
              const availablePercentage = 100 - utilizationPercentage;
              
              return (
                <div key={availability.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <CalendarDays className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">{formatDate(availability.date)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{availability.startTime} - {availability.endTime}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Stethoscope className="w-4 h-4 text-green-600" />
                      <span>{availability.doctor}</span>
                    </div>
                    <Badge variant="outline">{availability.specialty}</Badge>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{availability.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-600">
                        {availability.available} disponibles
                      </div>
                      <div className="text-xs text-gray-500">
                        {availability.booked}/{availability.capacity} ocupados ({utilizationPercentage}%)
                      </div>
                      <div className="text-xs text-blue-600">
                        {availablePercentage}% libres
                      </div>
                    </div>
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500" 
                        style={{ width: `${utilizationPercentage}%` }}
                      ></div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleCreateAppointment(availability)}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={availability.available === 0}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Agendar
                    </Button>
                  </div>
                </div>
              );
            })}
            {availabilities.filter(av => av.available > 0).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>No hay cupos disponibles en los próximos días</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadDashboardData}
                  className="mt-2"
                >
                  Actualizar datos
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de creación rápida */}
      {showQuickModal && (
        <QuickAppointmentModal
          isOpen={showQuickModal}
          onClose={() => {
            setShowQuickModal(false);
            setSelectedAvailability(null);
          }}
          onSuccess={() => {
            loadDashboardData();
            toast({
              title: "Cita creada exitosamente",
              description: "La cita ha sido agendada correctamente",
            });
          }}
          availabilityData={selectedAvailability}
        />
      )}
    </div>
  );
};

export default AppointmentsDashboard;