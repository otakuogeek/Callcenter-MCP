import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Stethoscope,
  Calendar,
  Users,
  LogOut,
  Settings,
  Clock,
  FileText,
  Activity,
  Shield,
  Key,
  MapPin,
  Phone,
  Mail,
  User,
  ChevronDown,
  Heart,
  Thermometer,
  Clipboard,
  Pill,
  CalendarCheck,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDoctorAuth } from "@/hooks/useDoctorAuth";
import VoiceDictationButton from "@/components/VoiceDictationButton";
import DoctorDateNavigationCards from "@/components/DoctorDateNavigationCards";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from "date-fns";
import { es } from "date-fns/locale";

interface Doctor {
  id: number;
  name: string;
  email: string;
  phone: string;
  license_number: string;
}

interface Appointment {
  id: number;
  patient_id: number;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string;
  reason: string;
  patient_name: string;
  patient_phone: string;
  patient_document: string;
  specialty_name: string;
  location_name: string;
  location_address: string;
}

interface Stats {
  todayAppointments: number;
  totalPatients: number;
  monthConsultations: number;
}

const DoctorDashboard = () => {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
    const [showMedicalRecord, setShowMedicalRecord] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    // Estados para acciones de doctor sobre cita
    const [showConfirmStatusDialog, setShowConfirmStatusDialog] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'Completada' | 'Cancelada' | null>(null);
    const [actionTargetAppointment, setActionTargetAppointment] = useState<Appointment | null>(null);
    const [cancellationReason, setCancellationReason] = useState('');
    const [processingAction, setProcessingAction] = useState(false);
  
  // Estados para el calendario de navegación por semana
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showDayAgendas, setShowDayAgendas] = useState(false);
  const [calendarSummary, setCalendarSummary] = useState<Record<string, { 
    appointments: number; 
    availabilities: number;
  }>>({});
  
  const [medicalRecordData, setMedicalRecordData] = useState({
    visit_type: 'Consulta General',
    chief_complaint: '',
    current_illness: '',
    vital_signs: {
      temperature: '',
      systolic_bp: '',
      diastolic_bp: '',
      heart_rate: '',
      respiratory_rate: '',
      oxygen_saturation: '',
      weight: '',
      height: ''
    },
    physical_examination: {
      general: '',
      head_neck: '',
      chest: '',
      heart: '',
      abdomen: '',
      extremities: '',
      neurological: ''
    },
    diagnosis: '',
    treatment_plan: '',
    prescriptions: '',
    observations: '',
    follow_up_date: '',
    status: 'Completa'
  });
  const [savingRecord, setSavingRecord] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, getMe, getStats, getAppointments, changePassword, createMedicalRecord, transcribeAudio, updateAppointmentStatus } = useDoctorAuth();

  useEffect(() => {
    loadDoctorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      
      console.log('🔑 Cargando datos del doctor...');
      
      // Cargar datos del doctor, estadísticas y TODAS las citas
      const [doctorData, statsData, appointmentsData] = await Promise.all([
        getMe(),
        getStats(),
        getAppointments() // Cambio: cargar todas las citas
      ]);
      
      console.log('✅ Datos cargados exitosamente:');
      console.log('👤 Doctor:', doctorData);
      console.log('📊 Estadísticas:', statsData);
      console.log('📅 Total de citas recibidas:', appointmentsData?.length || 0);
      console.log('🗓️ Muestra de citas (primeras 3):', appointmentsData?.slice(0, 3));
      
      // Verificar formato de fechas
      if (appointmentsData && appointmentsData.length > 0) {
        const firstAppointment = appointmentsData[0];
        console.log('🔍 Formato de fecha en primera cita:');
        console.log('   - scheduled_date:', firstAppointment.scheduled_date, '(tipo:', typeof firstAppointment.scheduled_date, ')');
        console.log('   - start_time:', firstAppointment.start_time);
        console.log('   - status:', firstAppointment.status);
      }
      
      setDoctor(doctorData);
      setStats(statsData);
      // Las citas ya vienen filtradas desde el backend (sin canceladas)
      setAllAppointments(appointmentsData || []);
      
      console.log('✅ Estado actualizado con', appointmentsData?.length || 0, 'citas');
    } catch (error) {
      console.error('❌ Error al cargar datos:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del doctor",
        variant: "destructive",
      });
      
      // Esperar un momento antes de redirigir
      setTimeout(() => {
        navigate("/doctor-login");
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
      navigate("/doctor-login");
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cerrar la sesión",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas nuevas no coinciden",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 8 caracteres",
        variant: "destructive",
      });
      return;
    }

    try {
      setChangingPassword(true);
      await changePassword(currentPassword, newPassword);
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada exitosamente",
      });
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "No se pudo cambiar la contraseña",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveMedicalRecord = async () => {
    if (!selectedAppointment) return;

    // Validaciones básicas
    if (!medicalRecordData.chief_complaint.trim()) {
      toast({
        title: "Error",
        description: "El motivo de consulta es obligatorio",
        variant: "destructive",
      });
      return;
    }

    if (!medicalRecordData.diagnosis.trim()) {
      toast({
        title: "Error",
        description: "El diagnóstico es obligatorio",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingRecord(true);

      // Preparar datos para enviar
      const recordToSave = {
        patient_id: selectedAppointment.patient_id,
        appointment_id: selectedAppointment.id,
        visit_type: medicalRecordData.visit_type,
        chief_complaint: medicalRecordData.chief_complaint,
        current_illness: medicalRecordData.current_illness,
        vital_signs: medicalRecordData.vital_signs,
        physical_examination: medicalRecordData.physical_examination,
        diagnosis: medicalRecordData.diagnosis,
        treatment_plan: medicalRecordData.treatment_plan,
        prescriptions: medicalRecordData.prescriptions,
        observations: medicalRecordData.observations,
        follow_up_date: medicalRecordData.follow_up_date || null,
        status: medicalRecordData.status
      };

      await createMedicalRecord(recordToSave);

      toast({
        title: "Historia clínica guardada",
        description: "La historia clínica se ha guardado exitosamente",
      });

      // Resetear formulario y cerrar modal
      setShowMedicalRecord(false);
      setSelectedAppointment(null);
      setMedicalRecordData({
        visit_type: 'Consulta General',
        chief_complaint: '',
        current_illness: '',
        vital_signs: {
          temperature: '',
          systolic_bp: '',
          diastolic_bp: '',
          heart_rate: '',
          respiratory_rate: '',
          oxygen_saturation: '',
          weight: '',
          height: ''
        },
        physical_examination: {
          general: '',
          head_neck: '',
          chest: '',
          heart: '',
          abdomen: '',
          extremities: '',
          neurological: ''
        },
        diagnosis: '',
        treatment_plan: '',
        prescriptions: '',
        observations: '',
        follow_up_date: '',
        status: 'Completa'
      });

      // Recargar datos
      loadDoctorData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "No se pudo guardar la historia clínica",
        variant: "destructive",
      });
    } finally {
      setSavingRecord(false);
    }
  };

  // Ejecutar cambio de estado (Completada / Cancelada) solicitado por el doctor
  const performStatusChange = async () => {
    if (!actionTargetAppointment || !confirmAction) return;
    try {
      setProcessingAction(true);
      const extra: any = {};
      if (confirmAction === 'Cancelada' && cancellationReason.trim()) extra.cancellation_reason = cancellationReason.trim();

      await updateAppointmentStatus(actionTargetAppointment.id, confirmAction, extra);

      toast({
        title: 'Estado actualizado',
        description: `La cita ha sido marcada como ${confirmAction.toLowerCase()}.`,
      });

      // Refrescar datos
      await loadDoctorData();
      setShowConfirmStatusDialog(false);
      setActionTargetAppointment(null);
      setConfirmAction(null);
      setCancellationReason('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el estado de la cita',
        variant: 'destructive'
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // Función para agrupar citas por día
  const groupAppointmentsByDay = (appointments: Appointment[]) => {
    const grouped = appointments.reduce((acc, appointment) => {
      const date = new Date(appointment.scheduled_date).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!acc[date]) {
        acc[date] = {
          date: appointment.scheduled_date,
          appointments: []
        };
      }
      
      acc[date].appointments.push(appointment);
      return acc;
    }, {} as Record<string, { date: string; appointments: Appointment[] }>);

    // Ordenar las citas dentro de cada día por hora
    Object.values(grouped).forEach(group => {
      group.appointments.sort((a, b) => {
        const timeA = a.start_time || '';
        const timeB = b.start_time || '';
        return timeA.localeCompare(timeB);
      });
    });

    // Convertir a array y ordenar por fecha
    return Object.entries(grouped)
      .sort(([, a], [, b]) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(([dateLabel, data]) => ({
        dateLabel,
        ...data
      }));
  };

  // Función para formatear fechas de forma segura
  const formatSafeDate = (dateString: string) => {
    try {
      if (!dateString) return 'Fecha no disponible';
      
      // Intentar crear fecha con diferentes formatos
      let date: Date;
      
      // Si la fecha ya tiene hora, usarla directamente
      if (dateString.includes('T')) {
        date = new Date(dateString);
      } else {
        // Si es solo fecha (YYYY-MM-DD), agregar hora del mediodía para evitar problemas de timezone
        date = new Date(dateString + 'T12:00:00');
      }
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        console.error('Fecha inválida:', dateString);
        return dateString; // Retornar la fecha original si no se puede parsear
      }
      
      return format(date, "EEEE, d 'de' MMMM", { locale: es });
    } catch (error) {
      console.error('Error formateando fecha:', dateString, error);
      return dateString;
    }
  };

  // Función para agrupar citas por agenda dentro de cada día
  const groupAppointmentsByAgenda = (appointments: any[]) => {
    const grouped: { [key: string]: { [agendaId: string]: any[] } } = {};

    appointments.forEach(apt => {
      const date = apt.scheduled_date || apt.scheduled_at?.split('T')[0] || '';
      const agendaId = String(apt.availability_id || 'Sin agenda');

      if (!grouped[date]) {
        grouped[date] = {};
      }

      if (!grouped[date][agendaId]) {
        grouped[date][agendaId] = [];
      }

      grouped[date][agendaId].push(apt);
    });

    // Convertir a array ordenado por fecha
    return Object.entries(grouped)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, agendas]) => ({
        date,
        agendas: Object.entries(agendas)
          .sort(([idA], [idB]) => Number(idA) - Number(idB))
          .map(([agendaId, appointments]) => ({
            agendaId,
            appointments: appointments.sort((a, b) => 
              (a.start_time || '').localeCompare(b.start_time || '')
            )
          }))
      }));
  };

  // Función para separar citas futuras (hoy y futuro) vs históricas (pasadas)
  const getFutureAppointments = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allAppointments.filter(appointment => {
      const appointmentDate = new Date(appointment.scheduled_date);
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate >= today;
    });
  };

  const getHistoricAppointments = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allAppointments.filter(appointment => {
      const appointmentDate = new Date(appointment.scheduled_date);
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate < today;
    });
  };

  // ==================== FUNCIONES PARA EL CALENDARIO ====================
  
  // Helper: Normalizar fecha a formato 'yyyy-MM-dd'
  const normalizeDateString = (dateValue: string | Date): string => {
    try {
      // Si es un string ISO (con T o Z), extraer solo la parte de la fecha
      if (typeof dateValue === 'string') {
        // Si tiene formato ISO (2025-10-31T00:00:00.000Z)
        if (dateValue.includes('T') || dateValue.includes('Z')) {
          return dateValue.split('T')[0];
        }
        // Si ya está en formato yyyy-MM-dd
        return dateValue;
      }
      // Si es un Date object
      return format(dateValue, 'yyyy-MM-dd');
    } catch (error) {
      console.error('❌ Error normalizando fecha:', dateValue, error);
      return String(dateValue);
    }
  };
  
  // Generar resumen del calendario por día
  const generateCalendarSummary = () => {
    console.log('📊 Generando resumen del calendario con', allAppointments.length, 'citas');
    const summary: Record<string, { appointments: number; availabilities: number }> = {};
    
    allAppointments.forEach(appointment => {
      // Normalizar la fecha a formato 'yyyy-MM-dd'
      const dateKey = normalizeDateString(appointment.scheduled_date);
      console.log('🔄 Normalizando fecha:', appointment.scheduled_date, '→', dateKey);
      
      if (!summary[dateKey]) {
        summary[dateKey] = { appointments: 0, availabilities: 0 };
      }
      summary[dateKey].appointments++;
    });
    
    // Contar agendas únicas por día
    const agendaMap = new Map<string, Set<number>>();
    allAppointments.forEach(appointment => {
      const dateKey = normalizeDateString(appointment.scheduled_date);
      if (!agendaMap.has(dateKey)) {
        agendaMap.set(dateKey, new Set());
      }
      if (appointment.availability_id) {
        agendaMap.get(dateKey)!.add(appointment.availability_id);
      }
    });
    
    agendaMap.forEach((agendas, dateKey) => {
      if (summary[dateKey]) {
        summary[dateKey].availabilities = agendas.size;
      }
    });
    
    console.log('✅ Resumen generado:', summary);
    setCalendarSummary(summary);
  };

  // Actualizar resumen cuando cambien las citas
  useEffect(() => {
    if (allAppointments.length > 0) {
      generateCalendarSummary();
    }
  }, [allAppointments]);

  // Manejadores del calendario
  const handleCreateAvailability = (date: string) => {
    toast({
      title: "Información",
      description: "La creación de agendas se realiza desde el panel de administración",
      variant: "default"
    });
  };

  const handleViewAppointments = (date: string) => {
    console.log('📅 handleViewAppointments llamado con fecha:', date);
    
    // Filtrar citas comparando fechas normalizadas
    const dayAppointments = allAppointments.filter(apt => {
      const normalizedDate = normalizeDateString(apt.scheduled_date);
      console.log('🔍 Comparando:', normalizedDate, '===', date, '→', normalizedDate === date);
      return normalizedDate === date;
    });
    
    console.log('📊 Citas encontradas:', dayAppointments.length, dayAppointments);
    
    if (dayAppointments.length > 0) {
      console.log('✅ Abriendo modal de citas del día');
      // Crear fecha parseando directamente los componentes yyyy-MM-dd
      const [year, month, day] = date.split('-').map(Number);
      const correctDate = new Date(year, month - 1, day); // month es 0-indexed
      console.log('📆 Fecha establecida:', format(correctDate, 'yyyy-MM-dd'));
      setSelectedDate(correctDate);
      setShowDayAgendas(true);
    } else {
      console.log('⚠️ No hay citas para este día');
      toast({
        title: "Sin citas",
        description: `No hay citas programadas para el ${format(new Date(date), "d 'de' MMMM", { locale: es })}`,
        variant: "default"
      });
    }
  };

  // Obtener citas del día seleccionado agrupadas por agenda
  const getAgendasForSelectedDay = () => {
    if (!selectedDate) {
      console.log('⚠️ No hay fecha seleccionada');
      return [];
    }
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    console.log('🔍 Buscando agendas para fecha:', dateStr);
    
    // Filtrar citas comparando fechas normalizadas
    const dayAppointments = allAppointments.filter(apt => {
      const normalizedDate = normalizeDateString(apt.scheduled_date);
      return normalizedDate === dateStr;
    });
    
    console.log('📋 Citas del día:', dayAppointments.length);
    
    const grouped: { [agendaId: string]: Appointment[] } = {};
    dayAppointments.forEach(apt => {
      const agendaId = String(apt.availability_id || 'Sin agenda');
      if (!grouped[agendaId]) {
        grouped[agendaId] = [];
      }
      grouped[agendaId].push(apt);
    });

    const result = Object.entries(grouped)
      .sort(([idA], [idB]) => Number(idA) - Number(idB))
      .map(([agendaId, appointments]) => ({
        agendaId,
        appointments: appointments.sort((a, b) => 
          (a.start_time || '').localeCompare(b.start_time || '')
        )
      }));
    
    console.log('✅ Agendas agrupadas:', result.length, result);
    return result;
  };

  // ==================== FIN FUNCIONES DEL CALENDARIO ====================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (!doctor || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  const dashboardCards = [
    {
      title: "Citas de Hoy",
      icon: Calendar,
      value: stats.todayAppointments.toString(),
      description: "Agenda del día",
      color: "from-blue-400 to-blue-600",
    },
    {
      title: "Pacientes",
      icon: Users,
      value: stats.totalPatients.toString(),
      description: "Total asignados",
      color: "from-green-400 to-green-600",
    },
    {
      title: "Consultas",
      icon: FileText,
      value: stats.monthConsultations.toString(),
      description: "Este mes",
      color: "from-purple-400 to-purple-600",
    },
    {
      title: "Actividad",
      icon: Activity,
      value: "Activo",
      description: "Estado del sistema",
      color: "from-orange-400 to-orange-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Portal de Doctores</h1>
                <p className="text-sm text-gray-500">Fundación Biosanar IPS</p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{doctor.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowAccountInfo(true)}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Información de Cuenta</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
                  <Key className="mr-2 h-4 w-4" />
                  <span>Cambiar Contraseña</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {dashboardCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-sm font-medium">
                      {card.title}
                    </CardDescription>
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md`}
                    >
                      <card.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {card.value}
                  </div>
                  <p className="text-xs text-gray-500">{card.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Mis Citas - Con Pestañas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Mis Citas
                  </CardTitle>
                  <CardDescription>
                    Gestiona tus citas programadas e historial
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendario semanal de navegación */}
              <DoctorDateNavigationCards
                date={selectedDate}
                setDate={setSelectedDate}
                summary={calendarSummary}
                onViewAppointments={handleViewAppointments}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Lista de Pacientes de Hoy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8"
        >
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-green-600" />
                    Agenda de Hoy
                  </CardTitle>
                  <CardDescription>
                    Pacientes a atender el día de hoy ({format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })})
                  </CardDescription>
                </div>
                <Badge className="bg-green-600 text-lg px-4 py-2">
                  {allAppointments.filter(apt => normalizeDateString(apt.scheduled_date) === format(new Date(), 'yyyy-MM-dd')).length} citas
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {allAppointments
                  .filter(apt => normalizeDateString(apt.scheduled_date) === format(new Date(), 'yyyy-MM-dd'))
                  .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                  .length > 0 ? (
                  <div className="space-y-3">
                    {allAppointments
                      .filter(apt => normalizeDateString(apt.scheduled_date) === format(new Date(), 'yyyy-MM-dd'))
                      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                      .map((appointment, index) => (
                        <motion.div
                          key={appointment.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card
                            className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-green-500 hover:border-l-green-600"
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setShowMedicalRecord(true);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                {/* Hora */}
                                <div className="flex items-center gap-3 min-w-[120px]">
                                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                    <Clock className="h-6 w-6 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-lg font-bold text-green-600">
                                      {appointment.start_time?.substring(0, 5)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {appointment.end_time?.substring(0, 5)}
                                    </p>
                                  </div>
                                </div>

                                {/* Información del Paciente */}
                                <div className="flex-1 px-4">
                                  <div className="flex items-center gap-2 mb-1">
                                    <User className="h-4 w-4 text-gray-400" />
                                    <span className="font-semibold text-gray-900">
                                      {appointment.patient_name}
                                    </span>
                                    {/* Badge de Agenda */}
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-xs">
                                      <Clipboard className="h-3 w-3 mr-1" />
                                      Agenda #{appointment.availability_id || 'N/A'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                      <FileText className="h-3 w-3" />
                                      {appointment.patient_document}
                                    </span>
                                    {appointment.patient_phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {appointment.patient_phone}
                                      </span>
                                    )}
                                  </div>
                                  {appointment.reason && (
                                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                                      <Stethoscope className="h-3 w-3 inline mr-1" />
                                      {appointment.reason}
                                    </p>
                                  )}
                                </div>

                                {/* Estado y Especialidad */}
                                <div className="flex flex-col items-end gap-2 min-w-[180px]">
                                  <Badge
                                    variant={
                                      appointment.status === 'Confirmada'
                                        ? 'default'
                                        : appointment.status === 'Pendiente'
                                        ? 'secondary'
                                        : 'destructive'
                                    }
                                    className="text-xs"
                                  >
                                    {appointment.status}
                                  </Badge>
                                  <div className="text-xs text-gray-500 text-right">
                                    <p className="font-medium">{appointment.specialty_name}</p>
                                    <p className="flex items-center gap-1 justify-end">
                                      <MapPin className="h-3 w-3" />
                                      {appointment.location_name}
                                    </p>
                                  </div>
                                </div>

                                {/* Acciones del doctor: marcar completada / cancelar */}
                                <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                                  {appointment.status === 'Confirmada' && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline" onClick={(e: any) => e.stopPropagation()}>
                                          Acciones
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent>
                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); setActionTargetAppointment(appointment); setConfirmAction('Completada'); setShowConfirmStatusDialog(true); }}>
                                          Marcar como completada
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); setActionTargetAppointment(appointment); setConfirmAction('Cancelada'); setShowConfirmStatusDialog(true); }}>
                                          Cancelar cita
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>

                                {/* Indicador de clic */}
                                <ChevronDown className="h-5 w-5 text-gray-400 rotate-[-90deg]" />
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CalendarCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium">
                      No hay citas programadas para hoy
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Puedes revisar las citas de otros días en el calendario
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-8 text-center text-sm text-gray-500"
        >
          <p>
            Sistema de Gestión Médica - Fundación Biosanar IPS © {new Date().getFullYear()}
          </p>
        </motion.div>
      </main>

      {/* Dialog: Citas del Día Seleccionado */}
      <Dialog open={showDayAgendas} onOpenChange={setShowDayAgendas}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Calendar className="h-6 w-6 text-blue-600" />
              <span className="capitalize">
                {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </span>
            </DialogTitle>
            <DialogDescription>
              {selectedDate && getAgendasForSelectedDay().reduce((total, agenda) => total + agenda.appointments.length, 0)} citas programadas
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {selectedDate && getAgendasForSelectedDay().length > 0 ? (
              <div className="space-y-6">
                {getAgendasForSelectedDay().map((agendaGroup, agendaIndex) => (
                  <motion.div
                    key={agendaGroup.agendaId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: agendaIndex * 0.1 }}
                  >
                    {/* Header de la Agenda */}
                    <div className="border-l-4 border-purple-500 pl-4 pr-4 py-3 bg-purple-50 rounded-r-lg mb-3">
                      <div className="flex items-center gap-3">
                        <Clipboard className="h-5 w-5 text-purple-600" />
                        <span className="font-bold text-lg text-purple-900">
                          Agenda #{agendaGroup.agendaId}
                        </span>
                        <Badge className="bg-purple-600">
                          {agendaGroup.appointments.length} {agendaGroup.appointments.length === 1 ? 'cita' : 'citas'}
                        </Badge>
                      </div>
                    </div>

                    {/* Lista de citas de esta agenda */}
                    <div className="space-y-3 pl-6">
                      {agendaGroup.appointments.map((appointment) => (
                        <Card
                          key={appointment.id}
                          className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-400"
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setShowMedicalRecord(true);
                            setShowDayAgendas(false);
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold text-blue-600">
                                    {appointment.start_time} - {appointment.end_time}
                                  </span>
                                  <Badge
                                    variant={
                                      appointment.status === 'Confirmada'
                                        ? 'default'
                                        : appointment.status === 'Pendiente'
                                        ? 'secondary'
                                        : 'destructive'
                                    }
                                  >
                                    {appointment.status}
                                  </Badge>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">
                                      {appointment.patient_name}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      {appointment.patient_document}
                                    </span>
                                  </div>

                                  {appointment.patient_phone && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <Phone className="h-3 w-3" />
                                      {appointment.patient_phone}
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 text-sm">
                                    <Stethoscope className="h-3 w-3 text-purple-500" />
                                    <span className="text-purple-600 font-medium">
                                      {appointment.specialty_name}
                                    </span>
                                  </div>

                                  {appointment.location_name && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <MapPin className="h-3 w-3" />
                                      {appointment.location_name}
                                    </div>
                                  )}

                                  {appointment.reason && (
                                    <div className="flex items-start gap-2 text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                                      <FileText className="h-3 w-3 mt-0.5" />
                                      <span className="italic">{appointment.reason}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Acciones del doctor: marcar completada / cancelar */}
                              <div className="ml-4 flex-shrink-0 flex items-start gap-2">
                                {appointment.status === 'Confirmada' && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="outline" onClick={(e: any) => e.stopPropagation()}>
                                        Acciones
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); setActionTargetAppointment(appointment); setConfirmAction('Completada'); setShowConfirmStatusDialog(true); }}>
                                        Marcar como completada
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); setActionTargetAppointment(appointment); setConfirmAction('Cancelada'); setShowConfirmStatusDialog(true); }}>
                                        Cancelar cita
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay citas programadas para este día</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

        {/* Dialog: Confirmar cambio de estado de cita (Completada / Cancelada) */}
        <Dialog open={showConfirmStatusDialog} onOpenChange={setShowConfirmStatusDialog}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>
                {confirmAction === 'Completada' ? 'Marcar cita como completada' : 'Cancelar cita'}
              </DialogTitle>
              <DialogDescription>
                {actionTargetAppointment ? (
                  <>
                    {confirmAction === 'Completada' ? (
                      <span>Confirma que deseas marcar la cita de <strong>{actionTargetAppointment.patient_name}</strong> a las <strong>{actionTargetAppointment.start_time}</strong> como <strong>completada</strong>.</span>
                    ) : (
                      <span>Indica el motivo de cancelación para la cita de <strong>{actionTargetAppointment.patient_name}</strong> a las <strong>{actionTargetAppointment.start_time}</strong>.</span>
                    )}
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {confirmAction === 'Cancelada' && (
                <div className="space-y-2">
                  <Label>Motivo de cancelación (opcional)</Label>
                  <Textarea value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} placeholder="Ingrese motivo" />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={() => { setShowConfirmStatusDialog(false); setActionTargetAppointment(null); setConfirmAction(null); setCancellationReason(''); }}>
                  Cancelar
                </Button>
                <Button onClick={performStatusChange} disabled={processingAction}>
                  {processingAction ? 'Procesando...' : (confirmAction === 'Completada' ? 'Marcar como completada' : 'Confirmar cancelación')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Diálogo de Información de Cuenta */}
      <Dialog open={showAccountInfo} onOpenChange={setShowAccountInfo}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Información de Cuenta
            </DialogTitle>
            <DialogDescription>
              Detalles de tu cuenta de doctor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Nombre Completo</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">{doctor?.name}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Correo Electrónico</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">{doctor?.email}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Teléfono</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">{doctor?.phone || 'No registrado'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Número de Licencia</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <Shield className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">{doctor?.license_number || 'No registrado'}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowAccountInfo(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Cambio de Contraseña */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              Cambiar Contraseña
            </DialogTitle>
            <DialogDescription>
              Actualiza tu contraseña de acceso al portal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Contraseña Actual</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña actual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={changingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPassword}
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                <strong>Requisitos:</strong> La contraseña debe tener al menos 8 caracteres.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowChangePassword(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              disabled={changingPassword}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? "Actualizando..." : "Actualizar Contraseña"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Historia Clínica */}
      <Dialog open={showMedicalRecord} onOpenChange={setShowMedicalRecord}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Stethoscope className="h-6 w-6 text-blue-600" />
              Historia Clínica
            </DialogTitle>
            <DialogDescription className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-semibold">{selectedAppointment?.patient_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{selectedAppointment?.patient_document}</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger value="vitals" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Signos Vitales</span>
              </TabsTrigger>
              <TabsTrigger value="examination" className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                <span className="hidden sm:inline">Examen Físico</span>
              </TabsTrigger>
              <TabsTrigger value="diagnosis" className="flex items-center gap-2">
                <Clipboard className="h-4 w-4" />
                <span className="hidden sm:inline">Diagnóstico</span>
              </TabsTrigger>
              <TabsTrigger value="treatment" className="flex items-center gap-2">
                <Pill className="h-4 w-4" />
                <span className="hidden sm:inline">Tratamiento</span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 pr-4">
              {/* Pestaña General */}
              <TabsContent value="general" className="space-y-8 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      Tipo de Visita
                    </Label>
                    <Select
                      value={medicalRecordData.visit_type}
                      onValueChange={(value) => setMedicalRecordData({ ...medicalRecordData, visit_type: value })}
                    >
                      <SelectTrigger className="border-blue-200 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Consulta General">🏥 Consulta General</SelectItem>
                        <SelectItem value="Control">📋 Control</SelectItem>
                        <SelectItem value="Urgencia">🚨 Urgencia</SelectItem>
                        <SelectItem value="Primera Vez">👤 Primera Vez</SelectItem>
                        <SelectItem value="Seguimiento">🔄 Seguimiento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Estado
                    </Label>
                    <Select
                      value={medicalRecordData.status}
                      onValueChange={(value) => setMedicalRecordData({ ...medicalRecordData, status: value })}
                    >
                      <SelectTrigger className="border-blue-200 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Borrador">📝 Borrador</SelectItem>
                        <SelectItem value="Completa">✅ Completa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      Motivo de Consulta *
                    </Label>
                    <VoiceDictationButton
                      onTranscription={(text) => setMedicalRecordData({ 
                        ...medicalRecordData, 
                        chief_complaint: medicalRecordData.chief_complaint + (medicalRecordData.chief_complaint ? ' ' : '') + text 
                      })}
                      transcribeAudio={transcribeAudio}
                    />
                  </div>
                  <Textarea
                    placeholder="Describa el motivo principal de la consulta..."
                    value={medicalRecordData.chief_complaint}
                    onChange={(e) => setMedicalRecordData({ ...medicalRecordData, chief_complaint: e.target.value })}
                    rows={4}
                    className="border-blue-200 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Enfermedad Actual
                    </Label>
                    <VoiceDictationButton
                      onTranscription={(text) => setMedicalRecordData({ 
                        ...medicalRecordData, 
                        current_illness: medicalRecordData.current_illness + (medicalRecordData.current_illness ? ' ' : '') + text 
                      })}
                      transcribeAudio={transcribeAudio}
                    />
                  </div>
                  <Textarea
                    placeholder="Describa la evolución y características de la enfermedad actual..."
                    value={medicalRecordData.current_illness}
                    onChange={(e) => setMedicalRecordData({ ...medicalRecordData, current_illness: e.target.value })}
                    rows={6}
                    className="border-blue-200 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span><strong>Nota:</strong> Los campos marcados con asterisco (*) son obligatorios.</span>
                  </p>
                </div>
              </TabsContent>

              {/* Pestaña Signos Vitales */}
              <TabsContent value="vitals" className="space-y-8 mt-0">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-2">
                    <Activity className="h-5 w-5" />
                    Signos Vitales del Paciente
                  </h3>
                  <p className="text-sm text-blue-700">Registre los valores actuales del paciente</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Thermometer className="h-4 w-4 text-red-500" />
                      Temperatura (°C)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="36.5"
                      value={medicalRecordData.vital_signs.temperature}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        vital_signs: { ...medicalRecordData.vital_signs, temperature: e.target.value }
                      })}
                      className="border-blue-200 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">Normal: 36.5 - 37.5°C</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Activity className="h-4 w-4 text-blue-500" />
                      Presión Sistólica
                    </Label>
                    <Input
                      type="number"
                      placeholder="120"
                      value={medicalRecordData.vital_signs.systolic_bp}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        vital_signs: { ...medicalRecordData.vital_signs, systolic_bp: e.target.value }
                      })}
                      className="border-blue-200 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">Normal: 90 - 120 mmHg</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Activity className="h-4 w-4 text-purple-500" />
                      Presión Diastólica
                    </Label>
                    <Input
                      type="number"
                      placeholder="80"
                      value={medicalRecordData.vital_signs.diastolic_bp}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        vital_signs: { ...medicalRecordData.vital_signs, diastolic_bp: e.target.value }
                      })}
                      className="border-blue-200 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">Normal: 60 - 80 mmHg</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Heart className="h-4 w-4 text-pink-500" />
                      Frecuencia Cardíaca
                    </Label>
                    <Input
                      type="number"
                      placeholder="72"
                      value={medicalRecordData.vital_signs.heart_rate}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        vital_signs: { ...medicalRecordData.vital_signs, heart_rate: e.target.value }
                      })}
                      className="border-blue-200 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">Normal: 60 - 100 lpm</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Activity className="h-4 w-4 text-cyan-500" />
                      Frecuencia Respiratoria
                    </Label>
                    <Input
                      type="number"
                      placeholder="16"
                      value={medicalRecordData.vital_signs.respiratory_rate}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        vital_signs: { ...medicalRecordData.vital_signs, respiratory_rate: e.target.value }
                      })}
                      className="border-blue-200 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">Normal: 12 - 20 rpm</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Activity className="h-4 w-4 text-green-500" />
                      SpO2 (%)
                    </Label>
                    <Input
                      type="number"
                      placeholder="98"
                      value={medicalRecordData.vital_signs.oxygen_saturation}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        vital_signs: { ...medicalRecordData.vital_signs, oxygen_saturation: e.target.value }
                      })}
                      className="border-blue-200 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">Normal: 95 - 100%</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Activity className="h-4 w-4 text-orange-500" />
                      Peso (kg)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="70"
                      value={medicalRecordData.vital_signs.weight}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        vital_signs: { ...medicalRecordData.vital_signs, weight: e.target.value }
                      })}
                      className="border-blue-200 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <Activity className="h-4 w-4 text-indigo-500" />
                      Altura (cm)
                    </Label>
                    <Input
                      type="number"
                      placeholder="170"
                      value={medicalRecordData.vital_signs.height}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        vital_signs: { ...medicalRecordData.vital_signs, height: e.target.value }
                      })}
                      className="border-blue-200 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Pestaña Examen Físico */}
              <TabsContent value="examination" className="space-y-8 mt-0">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-2">
                    <Heart className="h-5 w-5" />
                    Examen Físico por Sistemas
                  </h3>
                  <p className="text-sm text-purple-700">Registre los hallazgos del examen físico</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-gray-700">
                      👤 Aspecto General
                    </Label>
                    <Textarea
                      placeholder="Estado general del paciente, constitución, actitud, facie..."
                      value={medicalRecordData.physical_examination.general}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        physical_examination: { ...medicalRecordData.physical_examination, general: e.target.value }
                      })}
                      rows={3}
                      className="border-purple-200 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-gray-700">
                      🧠 Cabeza y Cuello
                    </Label>
                    <Textarea
                      placeholder="Hallazgos en cráneo, ojos, oídos, nariz, garganta, cuello..."
                      value={medicalRecordData.physical_examination.head_neck}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        physical_examination: { ...medicalRecordData.physical_examination, head_neck: e.target.value }
                      })}
                      rows={3}
                      className="border-purple-200 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-gray-700">
                      🫁 Tórax
                    </Label>
                    <Textarea
                      placeholder="Inspección, palpación, percusión, auscultación pulmonar..."
                      value={medicalRecordData.physical_examination.chest}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        physical_examination: { ...medicalRecordData.physical_examination, chest: e.target.value }
                      })}
                      rows={3}
                      className="border-purple-200 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-gray-700">
                      ❤️ Corazón
                    </Label>
                    <Textarea
                      placeholder="Ruidos cardíacos, soplos, ritmo, frecuencia..."
                      value={medicalRecordData.physical_examination.heart}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        physical_examination: { ...medicalRecordData.physical_examination, heart: e.target.value }
                      })}
                      rows={3}
                      className="border-purple-200 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-gray-700">
                      🏥 Abdomen
                    </Label>
                    <Textarea
                      placeholder="Inspección, palpación, percusión, auscultación abdominal..."
                      value={medicalRecordData.physical_examination.abdomen}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        physical_examination: { ...medicalRecordData.physical_examination, abdomen: e.target.value }
                      })}
                      rows={3}
                      className="border-purple-200 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-gray-700">
                      🦵 Extremidades
                    </Label>
                    <Textarea
                      placeholder="Hallazgos en miembros superiores e inferiores, pulsos, edema..."
                      value={medicalRecordData.physical_examination.extremities}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        physical_examination: { ...medicalRecordData.physical_examination, extremities: e.target.value }
                      })}
                      rows={3}
                      className="border-purple-200 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-base font-semibold text-gray-700">
                      🧠 Neurológico
                    </Label>
                    <Textarea
                      placeholder="Estado mental, pares craneales, fuerza muscular, sensibilidad, reflejos..."
                      value={medicalRecordData.physical_examination.neurological}
                      onChange={(e) => setMedicalRecordData({
                        ...medicalRecordData,
                        physical_examination: { ...medicalRecordData.physical_examination, neurological: e.target.value }
                      })}
                      rows={3}
                      className="border-purple-200 focus:ring-purple-500 resize-none"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Pestaña Diagnóstico */}
              <TabsContent value="diagnosis" className="space-y-8 mt-0">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-green-900 flex items-center gap-2 mb-2">
                    <Clipboard className="h-5 w-5" />
                    Diagnóstico y Observaciones
                  </h3>
                  <p className="text-sm text-green-700">Establezca el diagnóstico y agregue observaciones relevantes</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      Diagnóstico Principal *
                    </Label>
                    <VoiceDictationButton
                      onTranscription={(text) => setMedicalRecordData({ 
                        ...medicalRecordData, 
                        diagnosis: medicalRecordData.diagnosis + (medicalRecordData.diagnosis ? ' ' : '') + text 
                      })}
                      transcribeAudio={transcribeAudio}
                    />
                  </div>
                  <Textarea
                    placeholder="Diagnóstico principal y diagnósticos secundarios (si aplica)..."
                    value={medicalRecordData.diagnosis}
                    onChange={(e) => setMedicalRecordData({ ...medicalRecordData, diagnosis: e.target.value })}
                    rows={5}
                    className="border-green-200 focus:ring-green-500 resize-none"
                  />
                  <p className="text-sm text-gray-500">Incluya código CIE-10 si es posible</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <FileText className="h-4 w-4 text-green-600" />
                      Observaciones Adicionales
                    </Label>
                    <VoiceDictationButton
                      onTranscription={(text) => setMedicalRecordData({ 
                        ...medicalRecordData, 
                        observations: medicalRecordData.observations + (medicalRecordData.observations ? ' ' : '') + text 
                      })}
                      transcribeAudio={transcribeAudio}
                    />
                  </div>
                  <Textarea
                    placeholder="Notas adicionales, consideraciones especiales, advertencias..."
                    value={medicalRecordData.observations}
                    onChange={(e) => setMedicalRecordData({ ...medicalRecordData, observations: e.target.value })}
                    rows={4}
                    className="border-green-200 focus:ring-green-500 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-base font-semibold">
                    <CalendarCheck className="h-4 w-4 text-green-600" />
                    Fecha de Seguimiento
                  </Label>
                  <Input
                    type="date"
                    value={medicalRecordData.follow_up_date}
                    onChange={(e) => setMedicalRecordData({ ...medicalRecordData, follow_up_date: e.target.value })}
                    className="border-green-200 focus:ring-green-500"
                  />
                  <p className="text-sm text-gray-500">Opcional: Programar cita de control</p>
                </div>
              </TabsContent>

              {/* Pestaña Tratamiento */}
              <TabsContent value="treatment" className="space-y-8 mt-0">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-orange-900 flex items-center gap-2 mb-2">
                    <Pill className="h-5 w-5" />
                    Plan de Tratamiento
                  </h3>
                  <p className="text-sm text-orange-700">Especifique el plan terapéutico y medicamentos</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <Clipboard className="h-4 w-4 text-orange-600" />
                      Plan de Tratamiento
                    </Label>
                    <VoiceDictationButton
                      onTranscription={(text) => setMedicalRecordData({ 
                        ...medicalRecordData, 
                        treatment_plan: medicalRecordData.treatment_plan + (medicalRecordData.treatment_plan ? ' ' : '') + text 
                      })}
                      transcribeAudio={transcribeAudio}
                    />
                  </div>
                  <Textarea
                    placeholder="Describa el plan terapéutico general: reposo, dieta, actividad física, cuidados..."
                    value={medicalRecordData.treatment_plan}
                    onChange={(e) => setMedicalRecordData({ ...medicalRecordData, treatment_plan: e.target.value })}
                    rows={5}
                    className="border-orange-200 focus:ring-orange-500 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <Pill className="h-4 w-4 text-orange-600" />
                      Prescripción Médica
                    </Label>
                    <VoiceDictationButton
                      onTranscription={(text) => setMedicalRecordData({ 
                        ...medicalRecordData, 
                        prescriptions: medicalRecordData.prescriptions + (medicalRecordData.prescriptions ? ' ' : '') + text 
                      })}
                      transcribeAudio={transcribeAudio}
                    />
                  </div>
                  <Textarea
                    placeholder="Medicamentos prescritos con dosis, frecuencia y duración:&#10;Ej: Paracetamol 500mg, 1 tableta cada 8 horas por 5 días"
                    value={medicalRecordData.prescriptions}
                    onChange={(e) => setMedicalRecordData({ ...medicalRecordData, prescriptions: e.target.value })}
                    rows={8}
                    className="border-orange-200 focus:ring-orange-500 resize-none font-mono text-sm"
                  />
                  <p className="text-sm text-gray-500">Especifique: nombre, presentación, dosis, frecuencia y duración</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Importante:</strong> Verifique las dosis, interacciones medicamentosas y alergias del paciente antes de prescribir.</span>
                  </p>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <div className="flex justify-between items-center gap-2 pt-4 border-t mt-4">
            <div className="text-sm text-gray-500">
              {medicalRecordData.status === 'Borrador' ? '📝 Guardando como borrador' : '✅ Historia completa'}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMedicalRecord(false);
                  setSelectedAppointment(null);
                }}
                disabled={savingRecord}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveMedicalRecord}
                disabled={savingRecord}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingRecord ? (
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4 animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Guardar Historia Clínica
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorDashboard;
