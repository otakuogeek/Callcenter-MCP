import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  CalendarDays,
  Clock,
  Users,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  UserCheck,
  Stethoscope,
  Timer,
  AlertCircle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Settings
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "@/lib/api";
import { EnhancedStaggerContainer, EnhancedStaggerChild, AnimatedCard } from "@/components/ui/enhanced-animated-container";
import { useToast } from "@/hooks/use-toast";
import CreateAppointmentModal from "@/components/CreateAppointmentModal";
import SmartSchedulingAssistant from "@/components/agenda/SmartSchedulingAssistant";
import AdvancedTemplateManager from "@/components/agenda/AdvancedTemplateManager";
import AgendaAnalyticsDashboard from "@/components/agenda/AgendaAnalyticsDashboard";

// Tipos de datos
interface Availability {
  id: number;
  date: string;
  time_start: string;
  time_end: string;
  capacity: number;
  occupied: number;
  doctor_name?: string;
  specialty?: string;
  location_name?: string;
}

interface Appointment {
  id: number;
  date: string;
  time: string;
  patient_name: string;
  doctor_name?: string;
  specialty?: string;
  status: string;
  location_name?: string;
}

const CalendarCentricDashboard = () => {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'calendar' | 'agenda' | 'stats'>('calendar');
  
  // Estados de datos
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<any[]>([]);
  
  // Estados del modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<string>('');
  
  // Filtros
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Datos para el mes actual
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // Formatear fecha para API
  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Cargar datos del calendario
  useEffect(() => {
    loadCalendarData();
  }, [currentDate]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0);
      
      const [availabilitiesRes, appointmentsRes] = await Promise.all([
        api.getAvailabilities(),
        api.getAppointments()
      ]);

      setAvailabilities(availabilitiesRes || []);
      setAppointments(appointmentsRes || []);

      // Procesar datos para el calendario
      const calendarDays = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = formatDateForAPI(date);
        
        const dayAvailabilities = (availabilitiesRes || []).filter((a: Availability) => 
          a.date === dateStr
        );
        
        const dayAppointments = (appointmentsRes || []).filter((a: Appointment) => 
          a.date === dateStr
        );

        const totalCapacity = dayAvailabilities.reduce((sum, a) => sum + (a.capacity || 0), 0);
        const totalOccupied = dayAvailabilities.reduce((sum, a) => sum + (a.occupied || 0), 0);
        const occupancyRate = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;

        calendarDays.push({
          day,
          date: dateStr,
          availabilities: dayAvailabilities.length,
          appointments: dayAppointments.length,
          capacity: totalCapacity,
          occupied: totalOccupied,
          occupancyRate,
          hasActivity: dayAvailabilities.length > 0 || dayAppointments.length > 0
        });
      }
      
      setCalendarData(calendarDays);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del calendario",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Navegar por meses
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentMonth - 1);
    } else {
      newDate.setMonth(currentMonth + 1);
    }
    setCurrentDate(newDate);
  };

  // Manejar clic en fecha del calendario
  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentYear, currentMonth, day);
    setSelectedDate(clickedDate);
    
    // Si es doble clic, abrir modal para crear cita
    const now = Date.now();
    const lastClick = (window as any).lastClickTime;
    if (lastClick && now - lastClick < 300) {
      setSelectedDateForModal(formatDateForAPI(clickedDate));
      setShowCreateModal(true);
    }
    (window as any).lastClickTime = now;
  };

  // Obtener datos del día seleccionado
  const selectedDateData = useMemo(() => {
    const dateStr = formatDateForAPI(selectedDate);
    const dayAvailabilities = availabilities.filter(a => a.date === dateStr);
    const dayAppointments = appointments.filter(a => a.date === dateStr);
    
    return {
      availabilities: dayAvailabilities,
      appointments: dayAppointments,
      totalCapacity: dayAvailabilities.reduce((sum, a) => sum + (a.capacity || 0), 0),
      totalOccupied: dayAvailabilities.reduce((sum, a) => sum + (a.occupied || 0), 0)
    };
  }, [selectedDate, availabilities, appointments]);

  // Métricas del mes
  const monthMetrics = useMemo(() => {
    const totalDaysWithActivity = calendarData.filter(d => d.hasActivity).length;
    const totalCapacity = calendarData.reduce((sum, d) => sum + d.capacity, 0);
    const totalOccupied = calendarData.reduce((sum, d) => sum + d.occupied, 0);
    const avgOccupancy = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;
    
    return {
      activeDays: totalDaysWithActivity,
      totalCapacity,
      totalOccupied,
      avgOccupancy: Math.round(avgOccupancy),
      totalAppointments: calendarData.reduce((sum, d) => sum + d.appointments, 0)
    };
  }, [calendarData]);

  // Datos para el gráfico de actividad
  const chartData = useMemo(() => {
    return calendarData.map(d => ({
      day: d.day,
      capacidad: d.capacity,
      ocupado: d.occupied,
      citas: d.appointments
    }));
  }, [calendarData]);

  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return 'bg-red-500';
    if (rate >= 70) return 'bg-yellow-500';
    if (rate >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getOccupancyTextColor = (rate: number) => {
    if (rate >= 90) return 'text-red-700';
    if (rate >= 70) return 'text-yellow-700';
    if (rate >= 50) return 'text-blue-700';
    return 'text-green-700';
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-medical-900">Gestión de Agenda Médica</h1>
          <p className="text-medical-600">Administra y supervisa las disponibilidades de consultas médicas</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setCurrentView(currentView === 'calendar' ? 'agenda' : 'calendar')}
          >
            {currentView === 'calendar' ? (
              <>
                <CalendarDays className="w-4 h-4 mr-2" />
                Vista Agenda
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Vista Calendario
              </>
            )}
          </Button>
          <Button 
            className="bg-medical-600 hover:bg-medical-700"
            onClick={() => {
              setSelectedDateForModal(formatDateForAPI(selectedDate));
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Cita
          </Button>
        </div>
      </div>

      {/* Métricas rápidas */}
      <EnhancedStaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <EnhancedStaggerChild>
          <AnimatedCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Días Activos</CardTitle>
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{monthMetrics.activeDays}</div>
              <div className="flex items-center text-xs text-gray-600">
                <div className="text-xs text-muted-foreground">en {monthNames[currentMonth]}</div>
              </div>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>

        <EnhancedStaggerChild>
          <AnimatedCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacidad Total</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{monthMetrics.totalCapacity}</div>
              <div className="flex items-center text-xs text-gray-600">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {monthMetrics.totalOccupied} ocupados
              </div>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>

        <EnhancedStaggerChild>
          <AnimatedCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ocupación Promedio</CardTitle>
              <Timer className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{monthMetrics.avgOccupancy}%</div>
              <div className="flex items-center text-xs text-gray-600">
                <div className={`w-2 h-2 rounded-full mr-1 ${getOccupancyColor(monthMetrics.avgOccupancy)}`}></div>
                <span className={getOccupancyTextColor(monthMetrics.avgOccupancy)}>
                  {monthMetrics.avgOccupancy >= 90 ? 'Muy alta' : 
                   monthMetrics.avgOccupancy >= 70 ? 'Alta' : 
                   monthMetrics.avgOccupancy >= 50 ? 'Media' : 'Baja'}
                </span>
              </div>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>

        <EnhancedStaggerChild>
          <AnimatedCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Citas</CardTitle>
              <Stethoscope className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{monthMetrics.totalAppointments}</div>
              <div className="flex items-center text-xs text-gray-600">
                <Calendar className="w-3 h-3 mr-1" />
                programadas este mes
              </div>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>
      </EnhancedStaggerContainer>

      {/* Tabs para diferentes vistas y funcionalidades */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
          <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          <TabsTrigger value="assistant">Asistente IA</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          {/* Contenido principal del calendario */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario Principal */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <CardTitle className="text-lg">
                    {monthNames[currentMonth]} {currentYear}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                  Hoy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Días del calendario */}
              <div className="grid grid-cols-7 gap-1">
                {/* Días vacíos del mes anterior */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-16"></div>
                ))}
                
                {/* Días del mes actual */}
                {calendarData.map((dayData) => {
                  const isSelected = dayData.day === selectedDate.getDate() && 
                                   currentMonth === selectedDate.getMonth() && 
                                   currentYear === selectedDate.getFullYear();
                  const isToday = dayData.day === new Date().getDate() && 
                                 currentMonth === new Date().getMonth() && 
                                 currentYear === new Date().getFullYear();
                  
                  return (
                    <div
                      key={dayData.day}
                      className={`
                        h-16 border rounded-lg p-1 cursor-pointer transition-all hover:bg-gray-50 relative group
                        ${isSelected ? 'ring-2 ring-medical-500 bg-medical-50' : ''}
                        ${isToday ? 'bg-blue-50 border-blue-200' : ''}
                        ${dayData.hasActivity ? 'border-medical-200' : 'border-gray-200'}
                      `}
                      onClick={() => handleDateClick(dayData.day)}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex justify-between items-start">
                          <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                            {dayData.day}
                          </div>
                          
                          {/* Botón flotante para crear cita */}
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 bg-medical-600 hover:bg-medical-700 rounded-full flex items-center justify-center text-white text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateForModal(formatDateForAPI(new Date(currentYear, currentMonth, dayData.day)));
                              setShowCreateModal(true);
                            }}
                            title="Crear cita"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        
                        {dayData.hasActivity && (
                          <div className="flex-1 flex flex-col justify-center">
                            {dayData.capacity > 0 && (
                              <div className={`w-full h-1 rounded-full ${getOccupancyColor(dayData.occupancyRate)}`}></div>
                            )}
                            <div className="text-xs text-center mt-1">
                              {dayData.appointments > 0 && (
                                <span className="text-green-600">{dayData.appointments}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Leyenda */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Baja ocupación (0-49%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Media ocupación (50-69%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>Alta ocupación (70-89%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Muy alta ocupación (90%+)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Información del día seleccionado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedDate.toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedDateData.availabilities.length}</div>
                  <div className="text-xs text-gray-600">Disponibilidades</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{selectedDateData.appointments.length}</div>
                  <div className="text-xs text-gray-600">Citas</div>
                </div>
              </div>
              
              {selectedDateData.totalCapacity > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ocupación</span>
                    <span>{Math.round((selectedDateData.totalOccupied / selectedDateData.totalCapacity) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getOccupancyColor((selectedDateData.totalOccupied / selectedDateData.totalCapacity) * 100)}`}
                      style={{ width: `${(selectedDateData.totalOccupied / selectedDateData.totalCapacity) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-600 text-center">
                    {selectedDateData.totalOccupied} de {selectedDateData.totalCapacity} cupos ocupados
                  </div>
                </div>
              )}

              {selectedDateData.availabilities.length === 0 && selectedDateData.appointments.length === 0 && (
                <div className="text-center py-4">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay disponibilidades</p>
                  <p className="text-xs text-gray-400">para este día</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de actividad del mes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actividad del Mes</CardTitle>
              <CardDescription>Capacidad vs ocupación diaria</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="capacidad" fill="#e2e8f0" name="Capacidad" />
                  <Bar dataKey="ocupado" fill="#3b82f6" name="Ocupado" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
      </TabsContent>

      <TabsContent value="analytics">
        <AgendaAnalyticsDashboard />
      </TabsContent>

      <TabsContent value="templates">
        <AdvancedTemplateManager />
      </TabsContent>

      <TabsContent value="assistant">
        <SmartSchedulingAssistant />
      </TabsContent>

      <TabsContent value="config">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuración de Agenda
            </CardTitle>
            <CardDescription>
              Próximamente: configuraciones avanzadas para la gestión de agenda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-blue-50">
                <h4 className="font-semibold text-blue-900 mb-2">Funcionalidades en Desarrollo</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Configuración de horarios por especialidad</li>
                  <li>• Reglas automáticas de asignación</li>
                  <li>• Integración con sistemas externos</li>
                  <li>• Notificaciones personalizadas</li>
                  <li>• Políticas de cancelación</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    {/* Modal de creación de citas */}
    <CreateAppointmentModal
      isOpen={showCreateModal}
      onClose={() => setShowCreateModal(false)}
      onSuccess={() => {
        loadCalendarData(); // Recargar datos después de crear una cita
        toast({
          title: "¡Cita creada!",
          description: "La cita se ha creado exitosamente",
          variant: "default"
        });
      }}
      selectedDate={selectedDateForModal}
    />
  </div>
  );
};

export default CalendarCentricDashboard;
