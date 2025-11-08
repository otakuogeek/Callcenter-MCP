
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { safeFormatDate } from "@/utils/dateHelpers";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, MapPin, CheckCircle, AlertCircle, XCircle, Trash2, ArrowRight, RotateCcw, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Availability } from "@/hooks/useAppointmentData";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ReassignAppointmentModal from "./ReassignAppointmentModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ViewAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  availability: Availability | null;
}

type AppointmentRow = {
  id: number;
  status: string;
  scheduled_at: string;
  created_at?: string; // 🔥 Fecha de solicitud de la cita
  patient_name: string;
  patient_document?: string;
  patient_phone?: string | null;
  patient_email?: string | null;
  patient_eps?: string | null;
  age?: number;
  specialty_name?: string;
  location_name?: string;
  doctor_name?: string;
};

type AllAppointmentRow = AppointmentRow & {
  specialty_name?: string;
  doctor_name?: string;
  location_name?: string;
  availability_id?: number;
};

const ViewAvailabilityModal = ({ isOpen, onClose, availability }: ViewAvailabilityModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [allAppointments, setAllAppointments] = useState<AllAppointmentRow[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedAppointmentForReassign, setSelectedAppointmentForReassign] = useState<{
    id: number;
    patientName: string;
    patientPhone?: string | null;
    scheduledAt?: string;
  } | null>(null);
  
  // Estados para devolver a espera
  const [returnToQueueOpen, setReturnToQueueOpen] = useState(false);
  const [appointmentToReturn, setAppointmentToReturn] = useState<AppointmentRow | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [autoAssign, setAutoAssign] = useState(false);
  const [returningToQueue, setReturningToQueue] = useState(false);
  
  // Estados para cancelación con SMS
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<AppointmentRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  
  // Estado para enviar SMS masivos
  const [sendingSMS, setSendingSMS] = useState(false);
  
  const { toast } = useToast();

  // Calcular cupos ocupados en tiempo real basándose en la lista de pacientes
  const getRealBookedSlots = () => {
    // Contar solo las citas confirmadas en la lista actual
    return appointments.filter(ap => ap.status === 'Confirmada').length;
  };

  const getRealAvailableSlots = () => {
    if (!availability) return 0;
    return availability.capacity - getRealBookedSlots();
  };

  // Función para sincronizar los cupos de la BD con la realidad
  const syncBookedSlotsWithDB = async (realBookedSlots: number) => {
    if (!availability) return;
    
    // Solo sincronizar si hay discrepancia
    if (availability.bookedSlots !== realBookedSlots) {
      try {
        // Actualizar en la BD a través del API
        await api.updateAvailability(availability.id, {
          booked_slots: realBookedSlots
        });
        
        console.log(`✅ Sincronizado: BD actualizada de ${availability.bookedSlots} a ${realBookedSlots} cupos ocupados`);
      } catch (error: any) {
        // Silenciar el error si es "No changes" (significa que ya está sincronizado)
        if (error?.message !== 'No changes') {
          console.error('Error sincronizando cupos con BD:', error);
        }
      }
    }
  };

  const loadAppointments = async () => {
    if (!isOpen || !availability) return;
    setLoading(true);
    setError(null);
    try {
      // 🔄 SINCRONIZAR PRIMERO los cupos de esta agenda con la BD
      try {
        const syncResult = await api.syncAvailabilitySlots(availability.id);
        if (syncResult.success && syncResult.data.updated) {
          console.log('[ViewAvailability] Cupos sincronizados:', syncResult.data);
        }
      } catch (syncError) {
        console.warn('[ViewAvailability] No se pudo sincronizar:', syncError);
      }
      
      // Cargar citas de esta agenda específica con include_cancelled='true'
      // para mostrar tanto confirmadas como canceladas en pestañas separadas
      const rows = await api.getAppointments({ 
        availability_id: availability.id,
        include_cancelled: 'true'
      });
      setAppointments(rows as AppointmentRow[]);
      
      // Cargar TODAS las citas confirmadas del sistema para detectar duplicados globales
      const allRows = await api.getAppointments({ status: 'Confirmada' });
      setAllAppointments(allRows as AllAppointmentRow[]);
      
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar las citas");
      setAppointments([]);
      setAllAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [isOpen, availability?.id]);

  const handleCancelAppointment = async (appointmentId: number, _patientName: string) => {
    // Buscar la cita completa en la lista
    const appointment = appointments.find(ap => ap.id === appointmentId);
    if (!appointment) return;
    
    // Abrir modal de cancelación
    setAppointmentToCancel(appointment);
    setCancelReason("");
    setCancelModalOpen(true);
  };
  
  // Función que ejecuta la cancelación con SMS
  const executeCancellation = async () => {
    if (!appointmentToCancel || !cancelReason.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Debe especificar el motivo de la cancelación",
        variant: "destructive",
      });
      return;
    }

    setCancelling(true);
    
    try {
      // 1. Cancelar la cita
      await api.cancelAppointment(appointmentToCancel.id, cancelReason);
      
      // 2. Enviar SMS de notificación al paciente (si tiene teléfono)
      if (appointmentToCancel.patient_phone && availability) {
        try {
          const appointmentDate = new Date(availability.date);
          const formattedDate = appointmentDate.toLocaleDateString('es-CO', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          
          const message = `Hola ${appointmentToCancel.patient_name}. Lamentamos informarle que su cita ha sido CANCELADA.\n\n` +
            `📅 Cita cancelada:\n` +
            `👨‍⚕️ Doctor: ${availability.doctor}\n` +
            `🏥 Especialidad: ${availability.specialty}\n` +
            `📍 Sede: ${availability.locationName}\n` +
            `📆 Fecha: ${formattedDate}\n` +
            `🕐 Hora: ${appointmentToCancel.scheduled_at?.substring(11, 16) || 'N/A'}\n\n` +
            `Motivo: ${cancelReason}\n\n` +
            `Para reagendar, comuníquese con nosotros.\n` +
            `- Fundación Biosanar IPS`;

          await fetch(`${import.meta.env.VITE_API_URL}/sms/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              number: appointmentToCancel.patient_phone,
              message,
              recipient_name: appointmentToCancel.patient_name,
              patient_id: appointmentToCancel.id,
              template_id: 'appointment_cancellation'
            })
          });
        } catch (smsError) {
          console.error('Error enviando SMS de cancelación:', smsError);
          // No detener el flujo si falla el SMS
        }
      }
      
      toast({
        title: "Cita cancelada",
        description: `La cita de ${appointmentToCancel.patient_name} ha sido cancelada y se envió notificación por SMS.`,
        variant: "default",
      });
      
      // Cerrar modal y recargar
      setCancelModalOpen(false);
      setAppointmentToCancel(null);
      setCancelReason("");
      await loadAppointments();
      
    } catch (e: any) {
      toast({
        title: "Error al cancelar",
        description: e?.message || "No se pudo cancelar la cita",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleReturnToQueueClick = (appointment: AppointmentRow) => {
    setAppointmentToReturn(appointment);
    setCancellationReason("");
    setAutoAssign(false);
    setReturnToQueueOpen(true);
  };

  const handleReturnToQueue = async () => {
    if (!appointmentToReturn) return;

    setReturningToQueue(true);
    try {
      const response = await api.cancelAndReassign(
        appointmentToReturn.id,
        cancellationReason || "Devuelto a cola de espera",
        autoAssign
      );

      if (response.success) {
        // Enviar SMS al paciente informando que pasó a lista de espera
        if (appointmentToReturn.patient_phone && availability) {
          try {
            const appointmentDate = new Date(availability.date);
            const formattedDate = appointmentDate.toLocaleDateString('es-CO', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            
            const message = `Hola ${appointmentToReturn.patient_name}. Su cita ha sido MOVIDA A LISTA DE ESPERA.\n\n` +
              `📋 Información de la cita:\n` +
              `👨‍⚕️ Doctor: ${availability.doctor}\n` +
              `🏥 Especialidad: ${availability.specialty}\n` +
              `📍 Sede: ${availability.locationName}\n` +
              `📆 Fecha original: ${formattedDate}\n\n` +
              `✅ Le notificaremos por SMS cuando se le asigne una nueva cita.\n\n` +
              `Puede verificar el estado y reagendar desde:\n` +
              `🌐 https://biosanarcall.site/users\n\n` +
              `Disculpe las molestias.\n` +
              `- Fundación Biosanar IPS`;

            await fetch(`${import.meta.env.VITE_API_URL}/sms/send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                number: appointmentToReturn.patient_phone,
                message,
                recipient_name: appointmentToReturn.patient_name,
                patient_id: appointmentToReturn.id,
                template_id: 'appointment_to_waiting_list'
              })
            });
          } catch (smsError) {
            console.error('Error enviando SMS de lista de espera:', smsError);
            // No detener el flujo si falla el SMS
          }
        }

        toast({
          title: "Cita devuelta a cola",
          description: autoAssign && response.data?.reassignment?.assigned
            ? `Cupo reasignado a: ${response.data.reassignment.patient_assigned}`
            : response.data?.next_in_queue
            ? `Siguiente en cola: ${response.data.next_in_queue.patient_name}. SMS enviado al paciente.`
            : "Cupo liberado exitosamente. SMS enviado al paciente.",
        });

        // Recargar las citas
        await loadAppointments();
        
        // Cerrar modal
        setReturnToQueueOpen(false);
        setAppointmentToReturn(null);
        setCancellationReason("");
      } else {
        toast({
          title: "Error",
          description: response.error || "No se pudo devolver a cola",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error al devolver a cola:', error);
      toast({
        title: "Error",
        description: error.message || "Error al procesar la solicitud",
        variant: "destructive",
      });
    } finally {
      setReturningToQueue(false);
    }
  };

  const handleRestoreAppointment = async (
    appointmentId: number, 
    patientName: string, 
    scheduledAt: string,
    specialtyName?: string,
    locationName?: string
  ) => {
    // Formatear la fecha y hora
    const fecha = new Date(scheduledAt).toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const hora = scheduledAt.includes('T') 
      ? scheduledAt.split('T')[1].substring(0, 5)
      : scheduledAt.split(' ')[1].substring(0, 5);

    // Mensaje detallado con toda la información
    const mensaje = `¿Está seguro de que desea restaurar la cita de ${patientName}?\n\n` +
      `📋 DETALLES DE LA CITA:\n` +
      `• Especialidad: ${specialtyName || 'No especificada'}\n` +
      `• Sede: ${locationName || 'No especificada'}\n` +
      `• Fecha: ${fecha}\n` +
      `• Hora: ${hora}\n\n` +
      `La cita volverá a estado confirmado y ocupará un cupo en la agenda.`;

    if (!confirm(mensaje)) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(appointmentId));
    
    try {
      const response = await api.restoreAppointment(appointmentId);
      
      toast({
        title: "Cita restaurada",
        description: response.message || `La cita de ${patientName} ha sido restaurada exitosamente.`,
        variant: "default",
      });
      
      // Recargar las citas
      await loadAppointments();
    } catch (e: any) {
      toast({
        title: "Error al restaurar",
        description: e?.message || "No se pudo restaurar la cita",
        variant: "destructive",
      });
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };

  const handleSyncAppointmentTimes = async () => {
    if (!availability) return;

    if (!confirm('¿Está seguro de que desea sincronizar las horas de las citas?\n\nEsto reorganizará todas las citas secuencialmente desde la hora de inicio de la agenda.')) {
      return;
    }

    try {
      toast({
        title: "Sincronizando horas",
        description: "Por favor espere...",
      });

      const result = await api.syncAppointmentTimes(availability.id);

      if (result.success && result.data) {
        toast({
          title: "Sincronización exitosa",
          description: `${result.data.updated} citas sincronizadas correctamente`,
          variant: "default",
        });

        // Recargar las citas para mostrar los nuevos horarios
        await loadAppointments();
      } else {
        toast({
          title: "Aviso",
          description: result.message || "No hay citas para sincronizar",
          variant: "default",
        });
      }
    } catch (e: any) {
      toast({
        title: "Error al sincronizar",
        description: e?.message || "No se pudo sincronizar las horas",
        variant: "destructive",
      });
    }
  };

  const handleNotifySMS = async () => {
    if (!availability) return;

    const confirmedCount = appointments.filter(ap => ap.status === 'Confirmada').length;
    
    if (confirmedCount === 0) {
      toast({
        title: "Sin pacientes",
        description: "No hay pacientes confirmados para notificar",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`¿Está seguro de enviar SMS de recordatorio a ${confirmedCount} paciente(s) confirmado(s)?\n\nSe enviará información sobre:\n- Especialidad: ${availability.specialty}\n- Doctor: ${availability.doctor}\n- Fecha y hora de la cita\n- Sede: ${availability.locationName}`)) {
      return;
    }

    setSendingSMS(true);

    try {
      toast({
        title: "Enviando SMS...",
        description: `Notificando a ${confirmedCount} paciente(s)`,
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL}/sms/notify-availability-patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          availability_id: availability.id
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "SMS enviados exitosamente",
          description: `${result.data.sms_enviados} SMS enviados, ${result.data.sms_fallidos} fallidos`,
          variant: result.data.sms_fallidos > 0 ? "default" : "default",
        });
      } else {
        toast({
          title: "Error al enviar SMS",
          description: result.error || "No se pudieron enviar los SMS",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error enviando SMS:', error);
      toast({
        title: "Error",
        description: "No se pudo conectar con el servicio de SMS",
        variant: "destructive",
      });
    } finally {
      setSendingSMS(false);
    }
  };

  if (!availability) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Activa":
        return "bg-success-100 text-success-800";
      case "Completa":
        return "bg-medical-100 text-medical-800";
      case "Cancelada":
        return "bg-danger-100 text-danger-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Activa":
        return <CheckCircle className="w-4 h-4" />;
      case "Completa":
        return <CheckCircle className="w-4 h-4" />;
      case "Cancelada":
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getAvailabilityPercentage = (booked: number, capacity: number) => {
    return Math.round((booked / capacity) * 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-medical-600">
            <Calendar className="w-5 h-5" />
            <span>Detalles de la Disponibilidad</span>
          </DialogTitle>
          <DialogDescription>
            Información detallada sobre la disponibilidad seleccionada, incluyendo horarios, ubicación y estadísticas.
          </DialogDescription>
        </DialogHeader>

        {/* Contenedor scrollable para el contenido */}
        <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2"  style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* Estado */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Estado:</span>
            <Badge className={`${getStatusColor(availability.status)} flex items-center gap-1`}>
              {getStatusIcon(availability.status)}
              {availability.status}
            </Badge>
          </div>

          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-medical-600" />
                <span className="text-sm font-medium text-gray-600">Doctor:</span>
              </div>
              <p className="text-base font-semibold">{availability.doctor}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-medical-600" />
                <span className="text-sm font-medium text-gray-600">Ubicación:</span>
              </div>
              <p className="text-base">{availability.locationName}</p>
            </div>
          </div>

          {/* Fecha y horario */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-medical-600" />
                <span className="text-sm font-medium text-gray-600">Fecha:</span>
              </div>
              <p className="text-base">
                {safeFormatDate(availability.date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-medical-600" />
                <span className="text-sm font-medium text-gray-600">Horario:</span>
              </div>
              <p className="text-base">{availability.startTime} - {availability.endTime}</p>
            </div>
          </div>

          {/* Especialidad */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-600">Especialidad:</span>
            <Badge variant="outline" className="text-sm">
              {availability.specialty}
            </Badge>
          </div>

          {/* Capacidad y cupos */}
          <div className="bg-medical-50 rounded-lg p-4">
            <h3 className="font-semibold text-medical-800 mb-3">Información de Cupos</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-medical-600">{availability.capacity}</p>
                <p className="text-sm text-gray-600">Capacidad Total</p>
              </div>
              <div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-success-600">{getRealBookedSlots()}</p>
                  <p className="text-sm text-gray-600">Cupos Ocupados</p>
                  {getRealBookedSlots() !== availability.bookedSlots && (
                    <p className="text-xs text-orange-600 font-medium">
                      (BD: {availability.bookedSlots})
                    </p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-warning-600">
                  {getAvailabilityPercentage(getRealBookedSlots(), availability.capacity)}%
                </p>
                <p className="text-sm text-gray-600">Ocupación</p>
              </div>
            </div>
            
            {/* Advertencia si hay discrepancia - Informando sincronización automática */}
            {getRealBookedSlots() !== availability.bookedSlots && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                🔄 <strong>Sincronizando:</strong> La base de datos registra {availability.bookedSlots} cupos ocupados, 
                pero hay {getRealBookedSlots()} pacientes confirmados en la lista. 
                El sistema está actualizando automáticamente la BD para mostrar los datos reales.
              </div>
            )}
            
            {/* Mostrar cupos disponibles */}
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-green-600">{getRealAvailableSlots()}</span> cupos disponibles
              </p>
            </div>
          </div>

          {/* Pacientes agendados para esta disponibilidad */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold text-gray-800 mb-3">
              Pacientes en esta agenda
            </h3>
            
            {loading && (
              <p className="text-sm text-gray-500">Cargando pacientes…</p>
            )}
            {error && (
              <p className="text-sm text-danger-600">{error}</p>
            )}
            {!loading && !error && appointments.length === 0 && (
              <p className="text-sm text-gray-500">No hay pacientes asignados a esta disponibilidad.</p>
            )}
            
            {!loading && !error && appointments.length > 0 && (
              <Tabs defaultValue="confirmados" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="confirmados" className="relative">
                    Confirmados
                    <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                      {getRealBookedSlots()}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="cancelados" className="relative">
                    Cancelados
                    <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                      {appointments.filter(ap => ap.status === 'Cancelada').length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="confirmados" className="mt-3">
                  {appointments.filter(ap => ap.status === 'Confirmada').length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">No hay pacientes confirmados.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-auto pr-1">
                {(() => {
                  // Detectar duplicados por documento en TODAS las agendas
                  const documentAppointmentsMap = new Map<string, AllAppointmentRow[]>();
                  
                  // Agrupar todas las citas por documento
                  allAppointments.forEach(ap => {
                    if (ap.patient_document && ap.status === 'Confirmada') {
                      const existing = documentAppointmentsMap.get(ap.patient_document) || [];
                      documentAppointmentsMap.set(ap.patient_document, [...existing, ap]);
                    }
                  });
                  
                  // FILTRAR SOLO CITAS CONFIRMADAS PARA MOSTRAR EN LA LISTA
                  const confirmedAppointments = appointments.filter(ap => ap.status === 'Confirmada');
                  
                  return confirmedAppointments.map((ap) => {
                    // Extraer la hora directamente del string para evitar problemas de zona horaria
                    const scheduledTime = ap.scheduled_at.includes('T') 
                      ? ap.scheduled_at.split('T')[1].substring(0, 5)  // ISO: "2025-10-21T14:00:00.000Z" → "14:00"
                      : ap.scheduled_at.split(' ')[1].substring(0, 5); // MySQL: "2025-10-21 14:00:00" → "14:00"
                    
                    // Obtener todas las citas de este paciente
                    const patientAppointments = ap.patient_document 
                      ? (documentAppointmentsMap.get(ap.patient_document) || [])
                      : [];
                    
                    // Verificar si hay duplicados (más de 1 cita)
                    const isDuplicate = patientAppointments.length > 1;
                    
                    // Encontrar otras citas (no la actual) y solo mostrar las de fecha igual o posterior
                    const currentAppointmentDate = ap.scheduled_at.includes('T')
                      ? ap.scheduled_at.split('T')[0]
                      : ap.scheduled_at.split(' ')[0];
                    
                    const otherAppointments = patientAppointments.filter(other => {
                      if (other.id === ap.id) return false;
                      if (other.availability_id === availability?.id && availability) return false;
                      
                      // Extraer fecha de la otra cita
                      const otherDate = other.scheduled_at.includes('T')
                        ? other.scheduled_at.split('T')[0]
                        : other.scheduled_at.split(' ')[0];
                      
                      // Solo mostrar si la fecha es igual o posterior a la cita actual
                      return otherDate >= currentAppointmentDate;
                    });
                    
                    return (
                      <div 
                        key={ap.id} 
                        className={`flex flex-col gap-2 border rounded-md p-2 ${
                          isDuplicate ? 'bg-yellow-100 border-yellow-400' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {ap.patient_name}
                              {isDuplicate && (
                                <span className="ml-2 text-xs text-yellow-700 font-semibold">
                                  ⚠️ DUPLICADO
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {ap.patient_document && <span className="font-medium text-gray-700">{ap.patient_document}</span>}
                              {ap.patient_document && ap.patient_phone && " • "}
                              {ap.patient_phone || "Sin teléfono"}
                            </p>
                            {ap.patient_eps && (
                              <p className="text-xs text-blue-600 font-medium">
                                EPS: {ap.patient_eps}
                              </p>
                            )}
                            {ap.created_at && (() => {
                              const createdDate = new Date(ap.created_at);
                              const now = new Date();
                              const diffMs = now.getTime() - createdDate.getTime();
                              const diffMins = Math.floor(diffMs / 60000);
                              const hours = Math.floor(diffMins / 60);
                              const mins = diffMins % 60;
                              const timeAgo = hours > 0 ? `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}` : `00:${mins.toString().padStart(2, '0')}`;
                              
                              // Formatear fecha y hora: DD/MM/AAAA HH:MM am/pm
                              const day = createdDate.getDate().toString().padStart(2, '0');
                              const month = (createdDate.getMonth() + 1).toString().padStart(2, '0');
                              const year = createdDate.getFullYear();
                              let hour = createdDate.getHours();
                              const minute = createdDate.getMinutes().toString().padStart(2, '0');
                              const ampm = hour >= 12 ? 'pm' : 'am';
                              hour = hour % 12 || 12; // Convertir a formato 12 horas
                              const formattedDateTime = `${day}/${month}/${year} ${hour}:${minute} ${ampm}`;
                              
                              return (
                                <div className="text-xs space-y-0.5">
                                  <p className="text-gray-600 font-medium">
                                    {timeAgo}
                                  </p>
                                  <p className="text-gray-500">
                                    Fecha {formattedDateTime}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-600 hidden sm:inline">
                              {scheduledTime}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300"
                              onClick={() => handleReturnToQueueClick(ap)}
                              title="Devolver a lista de espera"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              <span className="text-xs hidden sm:inline">A Espera</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300"
                              onClick={() => {
                                setSelectedAppointmentForReassign({
                                  id: ap.id,
                                  patientName: ap.patient_name,
                                  patientPhone: ap.patient_phone,
                                  scheduledAt: ap.scheduled_at
                                });
                                setReassignModalOpen(true);
                              }}
                              title="Reasignar a otra agenda"
                            >
                              <ArrowRight className="w-3 h-3 mr-1" />
                              <span className="text-xs hidden sm:inline">Reasignar</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                              onClick={() => handleCancelAppointment(ap.id, ap.patient_name)}
                              title="Cancelar cita"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              <span className="text-xs hidden sm:inline">Cancelar</span>
                            </Button>
                          </div>
                        </div>
                        
                        {/* Mostrar información de otras citas */}
                        {otherAppointments.length > 0 && (
                          <div className="mt-1 pl-2 border-l-2 border-yellow-500 bg-yellow-50 p-2 rounded">
                            <p className="text-xs font-semibold text-yellow-800 mb-2">
                              Otras citas confirmadas:
                            </p>
                            <div className="space-y-2">
                              {otherAppointments.map((other) => {
                                const otherDate = other.scheduled_at.includes('T')
                                  ? other.scheduled_at.split('T')[0]
                                  : other.scheduled_at.split(' ')[0];
                                const otherTime = other.scheduled_at.includes('T')
                                  ? other.scheduled_at.split('T')[1].substring(0, 5)
                                  : other.scheduled_at.split(' ')[1].substring(0, 5);
                                
                                const isDeleting = deletingIds.has(other.id);
                                
                                return (
                                  <div 
                                    key={other.id} 
                                    className="flex items-start justify-between gap-2 bg-white/50 p-2 rounded border border-yellow-200"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-yellow-700">
                                        • <span className="font-medium">{other.specialty_name || 'N/A'}</span>
                                        {' - '}
                                        {safeFormatDate(otherDate, "d 'de' MMM", { locale: es })}
                                        {' a las '}
                                        {otherTime}
                                      </p>
                                      {other.location_name && (
                                        <p className="text-xs text-gray-600 ml-2 mt-0.5">
                                          📍 {other.location_name}
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                      onClick={() => handleCancelAppointment(other.id, ap.patient_name)}
                                      disabled={isDeleting}
                                    >
                                      {isDeleting ? (
                                        <span className="text-xs">...</span>
                                      ) : (
                                        <>
                                          <Trash2 className="w-3 h-3 mr-1" />
                                          <span className="text-xs">Eliminar</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="cancelados" className="mt-3">
                  {appointments.filter(ap => ap.status === 'Cancelada').length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">No hay pacientes cancelados.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-auto pr-1">
                      {appointments.filter(ap => ap.status === 'Cancelada').map((ap) => {
                        // Extraer la hora
                        const scheduledTime = ap.scheduled_at.includes('T') 
                          ? ap.scheduled_at.split('T')[1].substring(0, 5)
                          : ap.scheduled_at.split(' ')[1].substring(0, 5);
                        
                        const isRestoring = deletingIds.has(ap.id);
                        
                        return (
                          <div 
                            key={ap.id} 
                            className="flex flex-col gap-2 border rounded-md p-2 bg-red-50 border-red-200 opacity-75"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate text-gray-700">
                                  {ap.patient_name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {ap.patient_document && <span className="font-medium text-gray-700">{ap.patient_document}</span>}
                                  {ap.patient_document && ap.patient_phone && " • "}
                                  {ap.patient_phone || "Sin teléfono"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-gray-600 hidden sm:inline">
                                  {scheduledTime}
                                </span>
                                <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-300">
                                  Cancelada
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300"
                                  onClick={() => handleRestoreAppointment(
                                    ap.id, 
                                    ap.patient_name, 
                                    ap.scheduled_at,
                                    ap.specialty_name,
                                    ap.location_name
                                  )}
                                  disabled={isRestoring}
                                  title="Restaurar cita"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  <span className="text-xs hidden sm:inline">
                                    {isRestoring ? 'Restaurando...' : 'Restaurar'}
                                  </span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
            
            {/* Resumen de citas */}
            {!loading && !error && appointments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="font-semibold text-green-600">{appointments.filter(ap => ap.status === 'Confirmada').length}</p>
                    <p className="text-gray-500">Confirmados</p>
                  </div>
                  <div>
                    <p className="font-semibold text-red-600">{appointments.filter(ap => ap.status === 'Cancelada').length}</p>
                    <p className="text-gray-500">Cancelados</p>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-600">{appointments.filter(ap => ap.status === 'Pendiente').length}</p>
                    <p className="text-gray-500">Pendientes</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          {availability.notes && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-600">Notas:</span>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm">{availability.notes}</p>
              </div>
            </div>
          )}

          {/* Información de creación */}
          <div className="text-xs text-gray-500 pt-4 border-t">
            <p>Creado el: {format(new Date(availability.createdAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}</p>
          </div>
        </div>

        {/* Botones de acción - FUERA del scroll, siempre visibles */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t mt-4 bg-white">
          <div className="flex gap-2">
            {/* Botón Sincronizar Horas */}
            {!loading && !error && appointments.filter(ap => ap.status === 'Confirmada' || ap.status === 'Pendiente').length > 0 && (
              <Button 
                variant="default" 
                onClick={handleSyncAppointmentTimes}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Clock className="w-4 h-4 mr-2" />
                Sincronizar Horas
              </Button>
            )}
            
            {/* Botón Notificar SMS */}
            {!loading && !error && appointments.filter(ap => ap.status === 'Confirmada').length > 0 && (
              <Button 
                variant="default" 
                onClick={handleNotifySMS}
                disabled={sendingSMS}
                className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {sendingSMS ? 'Enviando...' : 'Notificar SMS'}
              </Button>
            )}
          </div>
          
          {/* Botón Cerrar */}
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>

      {/* Modal de Reasignación */}
      {selectedAppointmentForReassign && availability && (
        <ReassignAppointmentModal
          isOpen={reassignModalOpen}
          onClose={() => {
            setReassignModalOpen(false);
            setSelectedAppointmentForReassign(null);
          }}
          appointmentId={selectedAppointmentForReassign.id}
          patientName={selectedAppointmentForReassign.patientName}
          currentAvailabilityId={availability.id}
          patientPhone={selectedAppointmentForReassign.patientPhone}
          currentDoctor={availability.doctor}
          currentDate={availability.date}
          currentTime={selectedAppointmentForReassign.scheduledAt?.substring(11, 16)}
          currentLocation={availability.locationName}
          onReassignSuccess={() => {
            // Recargar las citas después de reasignar
            loadAppointments();
          }}
        />
      )}

      {/* Modal de Devolver a Lista de Espera */}
      <AlertDialog open={returnToQueueOpen} onOpenChange={setReturnToQueueOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver Cita a Lista de Espera</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de cancelar la cita de <strong>{appointmentToReturn?.patient_name}</strong> y devolver el cupo a la lista de espera?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason-modal">Motivo de cancelación (opcional)</Label>
              <Input
                id="reason-modal"
                placeholder="Ingrese el motivo..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-assign-modal"
                checked={autoAssign}
                onCheckedChange={(checked) => setAutoAssign(checked as boolean)}
              />
              <label
                htmlFor="auto-assign-modal"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Asignar automáticamente al siguiente en cola
              </label>
            </div>

            {appointmentToReturn && availability && (
              <div className="bg-gray-50 p-3 rounded-md text-sm space-y-1">
                <p><strong>Paciente:</strong> {appointmentToReturn.patient_name}</p>
                {appointmentToReturn.patient_document && <p><strong>Documento:</strong> {appointmentToReturn.patient_document}</p>}
                <p><strong>Doctor:</strong> {availability.doctor}</p>
                <p><strong>Especialidad:</strong> {availability.specialty}</p>
                <p><strong>Sede:</strong> {availability.locationName}</p>
                <p><strong>Fecha:</strong> {format(new Date(availability.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={returningToQueue}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturnToQueue}
              disabled={returningToQueue}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {returningToQueue ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Devolver a Espera
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Cancelación con SMS */}
      <AlertDialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Cancelar Cita y Notificar al Paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelará la cita y se enviará un SMS automático al paciente informándole de la cancelación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {appointmentToCancel && availability && (
            <div className="space-y-4 py-4">
              {/* Información de la cita */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md space-y-2">
                <h4 className="font-semibold text-blue-900 mb-3">Información de la Cita a Cancelar</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Paciente:</p>
                    <p className="font-semibold text-gray-900">{appointmentToCancel.patient_name}</p>
                  </div>
                  
                  {appointmentToCancel.patient_document && (
                    <div>
                      <p className="text-gray-600">Documento:</p>
                      <p className="font-semibold text-gray-900">{appointmentToCancel.patient_document}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-gray-600">Teléfono:</p>
                    <p className="font-semibold text-gray-900">{appointmentToCancel.patient_phone || 'No registrado'}</p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600">Doctor:</p>
                    <p className="font-semibold text-gray-900">{availability.doctor}</p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600">Especialidad:</p>
                    <p className="font-semibold text-gray-900">{availability.specialty}</p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600">Sede:</p>
                    <p className="font-semibold text-gray-900">{availability.locationName}</p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600">Fecha:</p>
                    <p className="font-semibold text-gray-900">
                      {format(new Date(availability.date + 'T12:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600">Hora:</p>
                    <p className="font-semibold text-gray-900">
                      {appointmentToCancel.scheduled_at?.substring(11, 16) || availability.startTime}
                    </p>
                  </div>
                </div>
              </div>

              {/* Campo de motivo */}
              <div className="space-y-2">
                <Label htmlFor="cancel-reason" className="text-base font-semibold text-red-600">
                  Motivo de cancelación <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cancel-reason"
                  placeholder="Ej: Agenda reprogramada, Doctor no disponible, Solicitud del paciente..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="border-2"
                  autoFocus
                />
                <p className="text-xs text-gray-500">
                  Este motivo se incluirá en el SMS que se enviará al paciente.
                </p>
              </div>

              {/* Advertencia de SMS */}
              {appointmentToCancel.patient_phone ? (
                <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-md">
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-green-900">SMS de notificación</p>
                      <p className="text-green-700">
                        Se enviará un SMS automático al <strong>{appointmentToCancel.patient_phone}</strong> informando de la cancelación.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-900">Sin teléfono registrado</p>
                      <p className="text-yellow-700">
                        Este paciente no tiene teléfono registrado. No se enviará SMS de notificación.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeCancellation}
              disabled={cancelling || !cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Cancelando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar Cita y Enviar SMS
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};


export default ViewAvailabilityModal;
