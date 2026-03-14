import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Separator removed - unused
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
import { Progress } from "@/components/ui/progress";
import {
  Stethoscope,
  Calendar,
  LogOut,
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
  ChevronUp,
  Heart,
  Thermometer,
  Clipboard,
  Pill,
  CalendarCheck,
  AlertCircle,
  LayoutDashboard,
  Search,
  BookOpen,
  BarChart3,
  RefreshCw,
  Loader2,
  Users,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDoctorAuth } from "@/hooks/useDoctorAuth";
import VoiceDictationButton from "@/components/VoiceDictationButton";
import DoctorDateNavigationCards from "@/components/DoctorDateNavigationCards";
import DoctorEnhancedStats from "@/components/DoctorEnhancedStats";
import DoctorPatientSearch from "@/components/DoctorPatientSearch";
import DoctorMyRecords from "@/components/DoctorMyRecords";
import PatientDetailPanel from "@/components/PatientDetailPanel";
import { convertUTCToColombiaTime, formatDateColombia, formatDateTimeColombia, formatFullDateColombia } from "@/utils/dateHelpers";
import { format } from "date-fns";
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
  availability_id?: number;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string;
  reason: string;
  patient_name: string;
  patient_phone: string;
  patient_document: string;
  patient_email?: string;
  specialty_name: string;
  location_name: string;
  location_address: string;
  appointment_source?: string;
  created_by_name?: string;
  created_at?: string;
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
    const [showPatientInfoBeforeRecord, setShowPatientInfoBeforeRecord] = useState(false);
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
  const { logout, getMe, getStats, getAppointments, changePassword, createMedicalRecord, transcribeAudio, updateAppointmentStatus, getEnhancedStats, getMyAvailabilities, searchPatients, getPatientHistory, getMyMedicalRecords } = useDoctorAuth();

  // Tab activa del dashboard principal
  const [activeMainTab, setActiveMainTab] = useState("resumen");
  // Patient detail view from patient search or recent patients
  const [patientDetailId, setPatientDetailId] = useState<number | null>(null);

  // Agendas del doctor con ocupación
  interface AvailabilityItem {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    locationAddress: string;
    capacity: number;
    confirmedAppointments: number;
    cancelledAppointments: number;
    availableSlots: number;
    occupancyRate: number;
    status: string;
    isOverbooked: boolean;
  }
  interface SpecialtyAgenda {
    specialty_id: number;
    specialty_name: string;
    availabilities: AvailabilityItem[];
    summary: {
      totalCapacity: number;
      totalConfirmed: number;
      totalCancelled: number;
      availableSlots: number;
      occupancyRate: number;
      totalAvailabilities: number;
    };
  }
  const [doctorAgendas, setDoctorAgendas] = useState<SpecialtyAgenda[]>([]);
  const [globalAgendaSummary, setGlobalAgendaSummary] = useState<{
    totalCapacity: number;
    totalConfirmed: number;
    totalAvailabilities: number;
    availableSlots: number;
    occupancyRate: number;
  } | null>(null);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<number | null>(null);
  const [loadingAgendas, setLoadingAgendas] = useState(false);

  useEffect(() => {
    loadDoctorData();
    loadDoctorAgendas();
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

  const loadDoctorAgendas = async () => {
    try {
      setLoadingAgendas(true);
      const data = await getMyAvailabilities();
      setDoctorAgendas(data.specialties || []);
      setGlobalAgendaSummary(data.globalSummary || null);
    } catch (error) {
      console.error('Error al cargar agendas:', error);
    } finally {
      setLoadingAgendas(false);
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
  const _groupAppointmentsByDay = (appointments: Appointment[]) => {
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
  const _formatSafeDate = (dateString: string) => {
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
  const _groupAppointmentsByAgenda = (appointments: any[]) => {
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
  const _getFutureAppointments = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allAppointments.filter(appointment => {
      const appointmentDate = new Date(appointment.scheduled_date);
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate >= today;
    });
  };

  const _getHistoricAppointments = () => {
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
  const _handleCreateAvailability = (_date: string) => {
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
        description: `No hay citas programadas para el ${formatDateColombia(date + 'T12:00:00')}`,
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Navigation Tabs */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 h-12">
            <TabsTrigger value="resumen" className="flex items-center gap-2 text-sm">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="agenda" className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Mi Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="pacientes" className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Pacientes</span>
            </TabsTrigger>
            <TabsTrigger value="historiales" className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Mis Historiales</span>
            </TabsTrigger>
          </TabsList>

          {/* ==================== TAB: RESUMEN ==================== */}
          <TabsContent value="resumen" className="space-y-6">
            <DoctorEnhancedStats
              getEnhancedStats={getEnhancedStats}
              onPatientClick={(id) => { setPatientDetailId(id); setActiveMainTab("pacientes"); }}
            />

            {/* Mis Agendas - Panel interactivo con ocupación */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Card className="shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-indigo-600" />
                        Mis Agendas
                      </CardTitle>
                      <CardDescription>
                        Resumen de ocupación de tus agendas programadas
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {globalAgendaSummary && (
                        <Badge className={`text-sm px-3 py-1 ${globalAgendaSummary.occupancyRate >= 90 ? 'bg-red-600' : globalAgendaSummary.occupancyRate >= 70 ? 'bg-amber-600' : 'bg-green-600'}`}>
                          {globalAgendaSummary.occupancyRate}% Ocupación
                        </Badge>
                      )}
                      <Button variant="outline" size="sm" onClick={loadDoctorAgendas} disabled={loadingAgendas}>
                        {loadingAgendas ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingAgendas ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Cargando agendas...</p>
                    </div>
                  ) : doctorAgendas.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-14 w-14 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 text-base font-medium">No tienes agendas programadas</p>
                      <p className="text-gray-400 text-sm mt-1">Contacta al administrador para crear agendas</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Resumen global */}
                      {globalAgendaSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                            <div className="text-xs text-indigo-600 font-medium">Agendas</div>
                            <div className="text-xl font-bold text-indigo-900">{globalAgendaSummary.totalAvailabilities}</div>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <div className="text-xs text-blue-600 font-medium">Capacidad Total</div>
                            <div className="text-xl font-bold text-blue-900">{globalAgendaSummary.totalCapacity}</div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                            <div className="text-xs text-green-600 font-medium">Confirmadas</div>
                            <div className="text-xl font-bold text-green-700">{globalAgendaSummary.totalConfirmed}</div>
                          </div>
                          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                            <div className="text-xs text-amber-600 font-medium">Disponibles</div>
                            <div className="text-xl font-bold text-amber-700">{globalAgendaSummary.availableSlots}</div>
                          </div>
                        </div>
                      )}

                      {/* Por Especialidad */}
                      {doctorAgendas.map((specAgenda) => (
                        <div key={specAgenda.specialty_id} className="border rounded-lg overflow-hidden">
                          {/* Header de especialidad */}
                          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-4 w-4 text-indigo-600" />
                              <span className="font-semibold text-gray-900">{specAgenda.specialty_name}</span>
                              <Badge variant="outline" className="text-xs">
                                {specAgenda.summary.totalAvailabilities} agendas
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-500">
                                {specAgenda.summary.totalConfirmed}/{specAgenda.summary.totalCapacity}
                              </span>
                              <div className="w-24">
                                <Progress 
                                  value={Math.min(specAgenda.summary.occupancyRate, 100)} 
                                  className="h-2"
                                />
                              </div>
                              <span className={`text-sm font-bold ${
                                specAgenda.summary.occupancyRate >= 90 ? 'text-red-600' :
                                specAgenda.summary.occupancyRate >= 70 ? 'text-amber-600' :
                                'text-green-600'
                              }`}>
                                {specAgenda.summary.occupancyRate}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Tabla de agendas */}
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Horario</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Sede</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Cupos</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Agendadas</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Disponible</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">%</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {specAgenda.availabilities.map((av) => (
                                  <tr 
                                    key={av.id} 
                                    className={`${
                                      selectedAvailabilityId === av.id ? 'bg-indigo-50 ring-1 ring-indigo-300' :
                                      av.isOverbooked ? 'bg-amber-50' : 'bg-white'
                                    } hover:bg-gray-50 cursor-pointer transition-colors`}
                                    onClick={() => {
                                      setSelectedAvailabilityId(selectedAvailabilityId === av.id ? null : av.id);
                                    }}
                                  >
                                    <td className="px-3 py-2 font-medium">
                                      {formatDateColombia(av.date + 'T12:00:00')}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">
                                      {convertUTCToColombiaTime(av.startTime)} - {convertUTCToColombiaTime(av.endTime)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-gray-400" />
                                        <span className="truncate max-w-[140px] text-gray-600">{av.location}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-center font-medium">{av.capacity}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`font-medium ${av.isOverbooked ? 'text-amber-600' : 'text-green-600'}`}>
                                        {av.confirmedAppointments}
                                      </span>
                                      {av.cancelledAppointments > 0 && (
                                        <span className="text-red-400 ml-1 text-xs">(+{av.cancelledAppointments} canc.)</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`font-medium ${av.availableSlots === 0 ? 'text-gray-400' : 'text-blue-600'}`}>
                                        {av.availableSlots}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {av.isOverbooked ? (
                                        <Badge variant="destructive" className="text-xs">{av.occupancyRate}%</Badge>
                                      ) : av.occupancyRate >= 90 ? (
                                        <Badge className="bg-amber-100 text-amber-700 text-xs border-amber-200">{av.occupancyRate}%</Badge>
                                      ) : av.occupancyRate >= 70 ? (
                                        <Badge className="bg-yellow-100 text-yellow-700 text-xs border-yellow-200">{av.occupancyRate}%</Badge>
                                      ) : (
                                        <span className="text-gray-600">{av.occupancyRate}%</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 w-6 p-0" 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setSelectedAvailabilityId(selectedAvailabilityId === av.id ? null : av.id); 
                                        }}
                                      >
                                        {selectedAvailabilityId === av.id ? 
                                          <ChevronUp className="h-4 w-4 text-indigo-600" /> : 
                                          <ChevronDown className="h-4 w-4 text-gray-400" />
                                        }
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Panel de citas de la agenda seleccionada */}
            {selectedAvailabilityId && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="shadow-lg border-indigo-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        {(() => {
                          const selectedAv = doctorAgendas.flatMap(s => s.availabilities).find(a => a.id === selectedAvailabilityId);
                          return selectedAv ? (
                            <>
                              <CardTitle className="flex items-center gap-2">
                                <CalendarCheck className="h-5 w-5 text-indigo-600" />
                                Citas de la Agenda - {formatDateColombia(selectedAv.date + 'T12:00:00')}
                              </CardTitle>
                              <CardDescription>
                                {convertUTCToColombiaTime(selectedAv.startTime)} - {convertUTCToColombiaTime(selectedAv.endTime)} · {selectedAv.location}
                              </CardDescription>
                            </>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-600 text-sm px-3 py-1">
                          {allAppointments.filter(apt => apt.availability_id === selectedAvailabilityId).length} citas
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => setSelectedAvailabilityId(null)}>
                          <XCircle className="h-4 w-4 mr-1" /> Cerrar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      {allAppointments
                        .filter(apt => apt.availability_id === selectedAvailabilityId)
                        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                        .length > 0 ? (
                        <div className="space-y-2">
                          {allAppointments
                            .filter(apt => apt.availability_id === selectedAvailabilityId)
                            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                            .map((appointment, index) => (
                              <motion.div
                                key={appointment.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                              >
                                <Card
                                  className={`hover:shadow-md transition-all cursor-pointer border-l-4 ${
                                    appointment.status === 'Completada' ? 'border-l-green-500 bg-green-50/30' :
                                    appointment.status === 'Cancelada' ? 'border-l-red-500 bg-red-50/30' :
                                    'border-l-indigo-500 hover:border-l-indigo-600'
                                  }`}
                                  onClick={() => {
                                    setSelectedAppointment(appointment);
                                    setShowPatientInfoBeforeRecord(true);
                                  }}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 min-w-[100px]">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                          <Clock className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                          <p className="text-base font-bold text-indigo-600">
                                            {convertUTCToColombiaTime(appointment.start_time)}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            {convertUTCToColombiaTime(appointment.end_time)}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex-1 px-3">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <User className="h-3.5 w-3.5 text-gray-400" />
                                          <span className="font-semibold text-sm text-gray-900">
                                            {appointment.patient_name}
                                          </span>
                                          <span className="text-xs text-gray-400">{appointment.patient_document}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          {appointment.appointment_source && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                              {appointment.appointment_source === 'WhatsApp' ? '💬 WhatsApp' : 
                                               appointment.appointment_source === 'Manual' ? '✋ Manual' :
                                               appointment.appointment_source === 'Llamada' ? '📞 Llamada' :
                                               appointment.appointment_source === 'App' ? '📱 App' :
                                               appointment.appointment_source}
                                            </Badge>
                                          )}
                                          {appointment.created_by_name && (
                                            <span className="text-[10px] text-gray-400">por {appointment.created_by_name}</span>
                                          )}
                                          {appointment.reason && (
                                            <span className="truncate max-w-[200px]">{appointment.reason}</span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={
                                            appointment.status === 'Confirmada' ? 'default' :
                                            appointment.status === 'Completada' ? 'default' :
                                            appointment.status === 'Pendiente' ? 'secondary' : 'destructive'
                                          }
                                          className={`text-xs ${appointment.status === 'Completada' ? 'bg-green-600' : ''}`}
                                        >
                                          {appointment.status}
                                        </Badge>
                                        {appointment.status === 'Confirmada' && (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e: any) => e.stopPropagation()}>
                                                <ChevronDown className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                              <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); setActionTargetAppointment(appointment); setConfirmAction('Completada'); setShowConfirmStatusDialog(true); }}>
                                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Marcar completada
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); setActionTargetAppointment(appointment); setConfirmAction('Cancelada'); setShowConfirmStatusDialog(true); }}>
                                                <XCircle className="h-4 w-4 mr-2 text-red-600" /> Cancelar cita
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <Users className="h-14 w-14 text-gray-200 mx-auto mb-3" />
                          <p className="text-gray-500 text-base font-medium">No hay citas en esta agenda</p>
                          <p className="text-gray-400 text-sm mt-1">Aún no se han agendado pacientes para este bloque</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Agenda de Hoy (compact) - se muestra solo si no hay agenda seleccionada */}
            {!selectedAvailabilityId && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                <Card className="shadow-lg">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <CalendarCheck className="h-5 w-5 text-green-600" />
                          Agenda de Hoy
                        </CardTitle>
                        <CardDescription>
                          {formatFullDateColombia(new Date())}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600 text-sm px-3 py-1">
                          {allAppointments.filter(apt => normalizeDateString(apt.scheduled_date) === format(new Date(), 'yyyy-MM-dd')).length} citas
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => setActiveMainTab("agenda")}>
                          Ver todo
                          <ChevronDown className="h-4 w-4 ml-1 -rotate-90" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      {allAppointments
                        .filter(apt => normalizeDateString(apt.scheduled_date) === format(new Date(), 'yyyy-MM-dd'))
                        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                        .length > 0 ? (
                        <div className="space-y-2">
                          {allAppointments
                            .filter(apt => normalizeDateString(apt.scheduled_date) === format(new Date(), 'yyyy-MM-dd'))
                            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                            .map((appointment, index) => (
                              <motion.div
                                key={appointment.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                              >
                                <Card
                                  className={`hover:shadow-md transition-all cursor-pointer border-l-4 ${
                                    appointment.status === 'Completada' ? 'border-l-green-500 bg-green-50/30' :
                                    appointment.status === 'Cancelada' ? 'border-l-red-500 bg-red-50/30' :
                                    'border-l-blue-500 hover:border-l-blue-600'
                                  }`}
                                  onClick={() => {
                                    setSelectedAppointment(appointment);
                                    setShowPatientInfoBeforeRecord(true);
                                  }}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 min-w-[100px]">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                          <Clock className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                          <p className="text-base font-bold text-blue-600">
                                            {convertUTCToColombiaTime(appointment.start_time)}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            {convertUTCToColombiaTime(appointment.end_time)}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex-1 px-3">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <User className="h-3.5 w-3.5 text-gray-400" />
                                          <span className="font-semibold text-sm text-gray-900">
                                            {appointment.patient_name}
                                          </span>
                                          <span className="text-xs text-gray-400">{appointment.patient_document}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          {appointment.appointment_source && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                              {appointment.appointment_source === 'WhatsApp' ? '💬 WhatsApp' : 
                                               appointment.appointment_source === 'Manual' ? '✋ Manual' :
                                               appointment.appointment_source === 'Llamada' ? '📞 Llamada' :
                                               appointment.appointment_source === 'App' ? '📱 App' :
                                               appointment.appointment_source}
                                            </Badge>
                                          )}
                                          {appointment.created_by_name && (
                                            <span className="text-[10px] text-gray-400">por {appointment.created_by_name}</span>
                                          )}
                                          {appointment.reason && (
                                            <span className="truncate max-w-[200px]">{appointment.reason}</span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={
                                            appointment.status === 'Confirmada' ? 'default' :
                                            appointment.status === 'Completada' ? 'default' :
                                            appointment.status === 'Pendiente' ? 'secondary' : 'destructive'
                                          }
                                          className={`text-xs ${appointment.status === 'Completada' ? 'bg-green-600' : ''}`}
                                        >
                                          {appointment.status}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs hidden md:flex">
                                          <MapPin className="h-2.5 w-2.5 mr-1" />
                                          {appointment.location_name}
                                        </Badge>
                                        {appointment.status === 'Confirmada' && (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e: any) => e.stopPropagation()}>
                                                <ChevronDown className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                              <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); setActionTargetAppointment(appointment); setConfirmAction('Completada'); setShowConfirmStatusDialog(true); }}>
                                                Marcar completada
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
                              </motion.div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <CalendarCheck className="h-14 w-14 text-gray-200 mx-auto mb-3" />
                          <p className="text-gray-500 text-base font-medium">No hay citas programadas para hoy</p>
                          <p className="text-gray-400 text-sm mt-1">Revisa el calendario para ver citas en otras fechas</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* ==================== TAB: MI AGENDA ==================== */}
          <TabsContent value="agenda" className="space-y-6">
            {/* Calendario semanal */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Calendario de Citas
                </CardTitle>
                <CardDescription>
                  Navega por semana para ver tus citas programadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DoctorDateNavigationCards
                  date={selectedDate}
                  setDate={setSelectedDate}
                  summary={calendarSummary}
                  onViewAppointments={handleViewAppointments}
                />
              </CardContent>
            </Card>

            {/* Agenda de Hoy completa */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarCheck className="h-5 w-5 text-green-600" />
                      Agenda de Hoy
                    </CardTitle>
                    <CardDescription>
                      Pacientes a atender el día de hoy ({formatDateColombia(new Date())})
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
                            className={`hover:shadow-md transition-all cursor-pointer border-l-4 ${
                              appointment.status === 'Completada' ? 'border-l-green-500 bg-green-50/30' :
                              appointment.status === 'Cancelada' ? 'border-l-red-500 bg-red-50/30' :
                              'border-l-green-500 hover:border-l-green-600'
                            }`}
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setShowPatientInfoBeforeRecord(true);
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
                                      {convertUTCToColombiaTime(appointment.start_time)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {convertUTCToColombiaTime(appointment.end_time)}
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
                                  <div className="flex items-center gap-2 mt-1">
                                    {appointment.appointment_source && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                        {appointment.appointment_source === 'WhatsApp' ? '💬 WhatsApp' : 
                                         appointment.appointment_source === 'Manual' ? '✋ Manual' :
                                         appointment.appointment_source === 'Llamada' ? '📞 Llamada' :
                                         appointment.appointment_source === 'App' ? '📱 App' :
                                         appointment.appointment_source}
                                      </Badge>
                                    )}
                                    {appointment.created_by_name && (
                                      <span className="text-[10px] text-gray-400">Agendó: {appointment.created_by_name}</span>
                                    )}
                                    {appointment.created_at && (
                                      <span className="text-[10px] text-gray-300">
                                        {formatDateTimeColombia(appointment.created_at)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Estado y Especialidad */}
                                <div className="flex flex-col items-end gap-2 min-w-[180px]">
                                  <Badge
                                    variant={
                                      appointment.status === 'Confirmada' ? 'default' :
                                      appointment.status === 'Completada' ? 'default' :
                                      appointment.status === 'Pendiente' ? 'secondary' : 'destructive'
                                    }
                                    className={`text-xs ${appointment.status === 'Completada' ? 'bg-green-600' : ''}`}
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

                                {/* Acciones del doctor */}
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
          </TabsContent>

          {/* ==================== TAB: PACIENTES ==================== */}
          <TabsContent value="pacientes">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-600" />
                  Buscar Pacientes
                </CardTitle>
                <CardDescription>
                  Busca pacientes por nombre, cédula o teléfono para ver su perfil completo e historial clínico
                </CardDescription>
              </CardHeader>
              <CardContent>
                {patientDetailId ? (
                  <PatientDetailPanel
                    patientId={patientDetailId}
                    getPatientHistory={getPatientHistory}
                    onCreateRecord={(patientId, patientName) => {
                      // Create a synthetic appointment for record creation
                      setSelectedAppointment({
                        id: 0,
                        patient_id: patientId,
                        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
                        start_time: '',
                        end_time: '',
                        status: '',
                        reason: '',
                        patient_name: patientName,
                        patient_phone: '',
                        patient_document: '',
                        specialty_name: '',
                        location_name: '',
                        location_address: '',
                      } as Appointment);
                      setShowMedicalRecord(true);
                    }}
                    onClose={() => setPatientDetailId(null)}
                  />
                ) : (
                  <DoctorPatientSearch
                    searchPatients={searchPatients}
                    getPatientHistory={getPatientHistory}
                    onCreateRecord={(patientId, patientName) => {
                      setSelectedAppointment({
                        id: 0,
                        patient_id: patientId,
                        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
                        start_time: '',
                        end_time: '',
                        status: '',
                        reason: '',
                        patient_name: patientName,
                        patient_phone: '',
                        patient_document: '',
                        specialty_name: '',
                        location_name: '',
                        location_address: '',
                      } as Appointment);
                      setShowMedicalRecord(true);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TAB: MIS HISTORIALES ==================== */}
          <TabsContent value="historiales">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                  Mis Historias Clínicas
                </CardTitle>
                <CardDescription>
                  Todas las historias clínicas que has creado. Filtra por estado o busca por paciente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DoctorMyRecords getMyMedicalRecords={getMyMedicalRecords} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                {selectedDate && formatFullDateColombia(selectedDate)}
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
                            setShowPatientInfoBeforeRecord(true);
                            setShowDayAgendas(false);
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold text-blue-600">
                                    {convertUTCToColombiaTime(appointment.start_time)} - {convertUTCToColombiaTime(appointment.end_time)}
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
                      <span>Confirma que deseas marcar la cita de <strong>{actionTargetAppointment.patient_name}</strong> a las <strong>{convertUTCToColombiaTime(actionTargetAppointment.start_time)}</strong> como <strong>completada</strong>.</span>
                    ) : (
                      <span>Indica el motivo de cancelación para la cita de <strong>{actionTargetAppointment.patient_name}</strong> a las <strong>{convertUTCToColombiaTime(actionTargetAppointment.start_time)}</strong>.</span>
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

      {/* Diálogo: Información del Paciente ANTES de crear historia clínica */}
      <Dialog open={showPatientInfoBeforeRecord} onOpenChange={setShowPatientInfoBeforeRecord}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <User className="h-6 w-6 text-blue-600" />
              Información del Paciente
            </DialogTitle>
            <DialogDescription className="flex items-center gap-4 mt-1">
              {selectedAppointment && (
                <>
                  <span className="font-semibold">{selectedAppointment.patient_name}</span>
                  <span className="text-sm">{selectedAppointment.patient_document}</span>
                  {selectedAppointment.start_time && (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" /> {convertUTCToColombiaTime(selectedAppointment.start_time)}
                    </Badge>
                  )}
                  {selectedAppointment.specialty_name && (
                    <Badge variant="outline" className="text-xs">
                      <Stethoscope className="h-3 w-3 mr-1" /> {selectedAppointment.specialty_name}
                    </Badge>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-2 mt-2">
            {selectedAppointment?.patient_id && (
              <PatientDetailPanel
                patientId={selectedAppointment.patient_id}
                getPatientHistory={getPatientHistory}
                onCreateRecord={() => {
                  setShowPatientInfoBeforeRecord(false);
                  setShowMedicalRecord(true);
                }}
              />
            )}
          </ScrollArea>

          <div className="flex justify-between items-center pt-3 border-t mt-2">
            <Button variant="outline" onClick={() => setShowPatientInfoBeforeRecord(false)}>
              Cerrar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setShowPatientInfoBeforeRecord(false);
                setShowMedicalRecord(true);
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Crear Nueva Historia Clínica
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
