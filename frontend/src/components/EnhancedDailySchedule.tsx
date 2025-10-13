import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Eye,
  Edit,
  Trash2
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import api from "@/lib/api";
import { EnhancedStaggerContainer, EnhancedStaggerChild, AnimatedCard } from "@/components/ui/enhanced-animated-container";
import { useToast } from "@/hooks/use-toast";

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
  status: string;
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
  phone?: string;
  notes?: string;
}

const EnhancedDailySchedule = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'timeline' | 'list' | 'calendar'>('timeline');
  
  // Estados de datos
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Formatear fecha para API
  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Cargar datos del día
  useEffect(() => {
    loadDayData();
  }, [selectedDate]);

  const loadDayData = async () => {
    setLoading(true);
    try {
      const dateStr = formatDateForAPI(selectedDate);
      
      const [availabilitiesRes, appointmentsRes] = await Promise.all([
        api.getAvailabilities(dateStr),
        // ✅ CORREGIDO: Usar objeto con date
        api.getAppointments({ date: dateStr })
      ]);

      setAvailabilities(availabilitiesRes || []);
      setAppointments(appointmentsRes || []);
    } catch (error) {
      console.error('Error loading day data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del día",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Datos filtrados
  const filteredAvailabilities = useMemo(() => {
    return availabilities.filter(a => {
      if (selectedSpecialty !== 'all' && a.specialty !== selectedSpecialty) return false;
      if (selectedDoctor !== 'all' && a.doctor_name !== selectedDoctor) return false;
      if (selectedLocation !== 'all' && a.location_name !== selectedLocation) return false;
      return true;
    });
  }, [availabilities, selectedSpecialty, selectedDoctor, selectedLocation]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (selectedSpecialty !== 'all' && a.specialty !== selectedSpecialty) return false;
      if (selectedDoctor !== 'all' && a.doctor_name !== selectedDoctor) return false;
      if (selectedLocation !== 'all' && a.location_name !== selectedLocation) return false;
      if (searchTerm && !a.patient_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [appointments, selectedSpecialty, selectedDoctor, selectedLocation, searchTerm]);

  // Métricas del día
  const dayMetrics = useMemo(() => {
    const totalCapacity = filteredAvailabilities.reduce((sum, a) => sum + (a.capacity || 0), 0);
    const totalOccupied = filteredAvailabilities.reduce((sum, a) => sum + (a.occupied || 0), 0);
    const occupancyRate = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;
    
    const appointmentsByStatus = filteredAppointments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAvailabilities: filteredAvailabilities.length,
      totalCapacity,
      totalOccupied,
      occupancyRate: Math.round(occupancyRate),
      totalAppointments: filteredAppointments.length,
      appointmentsByStatus
    };
  }, [filteredAvailabilities, filteredAppointments]);

  // Generar timeline por horas
  const timelineData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM a 7 PM
    
    return hours.map(hour => {
      const hourStart = `${hour.toString().padStart(2, '0')}:00`;
      const hourEnd = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      const hourAvailabilities = filteredAvailabilities.filter(a => {
        return a.time_start >= hourStart && a.time_start < hourEnd;
      });
      
      const hourAppointments = filteredAppointments.filter(a => {
        const appointmentHour = a.time?.split(':')[0];
        return appointmentHour === hour.toString().padStart(2, '0');
      });

      return {
        hour,
        hourDisplay: `${hour}:00`,
        availabilities: hourAvailabilities,
        appointments: hourAppointments,
        capacity: hourAvailabilities.reduce((sum, a) => sum + (a.capacity || 0), 0),
        occupied: hourAvailabilities.reduce((sum, a) => sum + (a.occupied || 0), 0)
      };
    });
  }, [filteredAvailabilities, filteredAppointments]);

  // Datos únicos para filtros
  const uniqueSpecialties = useMemo(() => {
    const specialties = new Set([
      ...availabilities.map(a => a.specialty).filter(Boolean),
      ...appointments.map(a => a.specialty).filter(Boolean)
    ]);
    return Array.from(specialties);
  }, [availabilities, appointments]);

  const uniqueDoctors = useMemo(() => {
    const doctors = new Set([
      ...availabilities.map(a => a.doctor_name).filter(Boolean),
      ...appointments.map(a => a.doctor_name).filter(Boolean)
    ]);
    return Array.from(doctors);
  }, [availabilities, appointments]);

  const uniqueLocations = useMemo(() => {
    const locations = new Set([
      ...availabilities.map(a => a.location_name).filter(Boolean),
      ...appointments.map(a => a.location_name).filter(Boolean)
    ]);
    return Array.from(locations);
  }, [availabilities, appointments]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmada':
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pendiente':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelada':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completada':
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(selectedDate.getDate() - 1);
    } else {
      newDate.setDate(selectedDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-medical-900">Agenda del Día</h1>
          <p className="text-medical-600">
            {selectedDate.toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="w-4 h-4" />
            Día Anterior
          </Button>
          <Button variant="outline" onClick={() => setSelectedDate(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" onClick={() => navigateDate('next')}>
            Día Siguiente
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button className="bg-medical-600 hover:bg-medical-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cita
          </Button>
        </div>
      </div>

      {/* Métricas del día */}
      <EnhancedStaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <EnhancedStaggerChild index={0}>
          <AnimatedCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponibilidades</CardTitle>
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{dayMetrics.totalAvailabilities}</div>
              <div className="text-xs text-muted-foreground">
                {dayMetrics.totalCapacity} cupos totales
              </div>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>

        <EnhancedStaggerChild index={1}>
          <AnimatedCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ocupación</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{dayMetrics.occupancyRate}%</div>
              <div className="text-xs text-muted-foreground">
                {dayMetrics.totalOccupied} de {dayMetrics.totalCapacity} ocupados
              </div>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>

        <EnhancedStaggerChild index={2}>
          <AnimatedCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Citas</CardTitle>
              <Stethoscope className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{dayMetrics.totalAppointments}</div>
              <div className="text-xs text-muted-foreground">
                programadas para hoy
              </div>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>

        <EnhancedStaggerChild index={3}>
          <AnimatedCard>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {dayMetrics.appointmentsByStatus['confirmada'] || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                citas confirmadas
              </div>
            </CardContent>
          </AnimatedCard>
        </EnhancedStaggerChild>
      </EnhancedStaggerContainer>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las especialidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las especialidades</SelectItem>
                {uniqueSpecialties.map(specialty => (
                  <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los doctores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los doctores</SelectItem>
                {uniqueDoctors.map(doctor => (
                  <SelectItem key={doctor} value={doctor}>{doctor}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las ubicaciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las ubicaciones</SelectItem>
                {uniqueLocations.map(location => (
                  <SelectItem key={location} value={location}>{location}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={currentView} onValueChange={(value: any) => setCurrentView(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeline">Vista Timeline</SelectItem>
                <SelectItem value="list">Vista Lista</SelectItem>
                <SelectItem value="calendar">Vista Calendario</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contenido principal */}
      <Tabs value={currentView} onValueChange={(value: any) => setCurrentView(value)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
        </TabsList>

        {/* Vista Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline del Día</CardTitle>
              <CardDescription>
                Horarios y disponibilidades organizados por hora
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timelineData.map((hourData) => (
                  <div key={hourData.hour} className="border-l-2 border-medical-200 pl-4 relative">
                    {/* Hora */}
                    <div className="absolute -left-3 top-0 bg-medical-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {hourData.hour}
                    </div>
                    
                    <div className="ml-4">
                      <h4 className="font-semibold text-lg mb-2">{hourData.hourDisplay}</h4>
                      
                      {/* Disponibilidades */}
                      {hourData.availabilities.length > 0 && (
                        <div className="mb-3">
                          <h5 className="font-medium text-sm text-gray-600 mb-2">Disponibilidades</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {hourData.availabilities.map((availability) => (
                              <div key={availability.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">{availability.doctor_name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {availability.occupied}/{availability.capacity}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-600">
                                  <div>{availability.specialty}</div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3" />
                                    {availability.location_name}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Citas */}
                      {hourData.appointments.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm text-gray-600 mb-2">Citas</h5>
                          <div className="space-y-2">
                            {hourData.appointments.map((appointment) => (
                              <div key={appointment.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="text-xs">
                                      {appointment.patient_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium text-sm">{appointment.patient_name}</div>
                                    <div className="text-xs text-gray-600">
                                      {appointment.doctor_name} • {appointment.specialty}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getStatusColor(appointment.status)}>
                                    {appointment.status}
                                  </Badge>
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost">
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost">
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {hourData.availabilities.length === 0 && hourData.appointments.length === 0 && (
                        <div className="text-gray-400 text-sm">Sin actividad</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vista Lista */}
        <TabsContent value="list" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de Disponibilidades */}
            <Card>
              <CardHeader>
                <CardTitle>Disponibilidades</CardTitle>
                <CardDescription>{filteredAvailabilities.length} disponibilidades</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredAvailabilities.map((availability) => (
                    <div key={availability.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{availability.doctor_name}</div>
                        <Badge variant="outline">
                          {availability.time_start} - {availability.time_end}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>{availability.specialty}</div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {availability.location_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {availability.occupied}/{availability.capacity} ocupado
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredAvailabilities.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay disponibilidades para este día
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de Citas */}
            <Card>
              <CardHeader>
                <CardTitle>Citas Programadas</CardTitle>
                <CardDescription>{filteredAppointments.length} citas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredAppointments.map((appointment) => (
                    <div key={appointment.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{appointment.patient_name}</div>
                        <Badge className={getStatusColor(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {appointment.time}
                        </div>
                        <div>{appointment.doctor_name} • {appointment.specialty}</div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {appointment.location_name}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="ghost">
                          <Eye className="w-3 h-3 mr-1" />
                          Ver
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredAppointments.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay citas programadas para este día
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Vista Calendario (mini calendario con detalles) */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vista de Calendario</CardTitle>
              <CardDescription>Distribución de citas y disponibilidades por hora</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hourDisplay" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="capacity" fill="#e2e8f0" name="Capacidad" />
                  <Bar dataKey="occupied" fill="#3b82f6" name="Ocupado" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedDailySchedule;
