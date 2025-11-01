import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, Phone, RefreshCw, Calendar, AlertCircle, ArrowRight, RotateCcw, PhoneCall } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import ReassignAppointmentModal from "@/components/ReassignAppointmentModal";
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
import { useToast } from "@/hooks/use-toast";

export default function DailyQueue() {
  const { toast } = useToast();
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Estados para el modal de reasignación
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<{
    id: number;
    patientName: string;
    availabilityId: number;
  } | null>(null);

  // Estados para el modal de devolver a espera
  const [returnToQueueOpen, setReturnToQueueOpen] = useState(false);
  const [appointmentToReturn, setAppointmentToReturn] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [autoAssign, setAutoAssign] = useState(false);
  const [returningToQueue, setReturningToQueue] = useState(false);

  // Estados para las llamadas de ElevenLabs
  const [callingPatient, setCallingPatient] = useState<number | null>(null);

  const refresh = async (date?: Date) => {
    setLoading(true);
    setError(null);
    const dateToFetch = date || selectedDate;
    try {
      // 🔄 SINCRONIZAR todas las agendas antes de cargar datos
      try {
        await api.syncAllAvailabilities();
        console.log('[DailyQueue] Agendas sincronizadas automáticamente');
      } catch (syncError) {
        console.warn('[DailyQueue] No se pudo sincronizar:', syncError);
      }
      
      // Formatear la fecha como YYYY-MM-DD
      const formattedDate = format(dateToFetch, 'yyyy-MM-dd');
      console.log(`[DailyQueue] Consultando fecha: ${formattedDate}`);
      const response = await api.getDailyQueue(formattedDate);
      console.log('[DailyQueue] Respuesta recibida:', {
        success: response.success,
        date: response.date,
        dataLength: response.data?.length || 0,
        totalScheduled: response.stats?.total_scheduled || 0
      });
      setDailyData(response);
    } catch (err: any) {
      console.error('Error al cargar cola diaria:', err);
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Actualizar cada 30 segundos
    const interval = setInterval(() => refresh(), 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      refresh(date);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgente': return 'destructive';
      case 'alta': return 'destructive';
      case 'normal': return 'default';
      case 'baja': return 'secondary';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'waiting' ? 'En Espera' : 'Agendada';
  };

  const getTypeBadgeVariant = (type: string) => {
    return type === 'waiting' ? 'outline' : 'default';
  };

  const handleReassignClick = (item: any) => {
    // Solo permitir reasignación de citas agendadas (no en espera)
    if (item.type === 'scheduled' && item.id && item.availability_id) {
      setSelectedAppointment({
        id: item.id,
        patientName: item.patient_name,
        availabilityId: item.availability_id
      });
      setReassignModalOpen(true);
    }
  };

  const handleReassignSuccess = () => {
    // Refrescar la cola después de una reasignación exitosa
    refresh();
  };

  const handleReturnToQueueClick = (item: any) => {
    if (item.type === 'scheduled' && item.id) {
      setAppointmentToReturn(item);
      setCancellationReason("");
      setAutoAssign(false);
      setReturnToQueueOpen(true);
    }
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
        toast({
          title: "Cita cancelada",
          description: autoAssign && response.data.reassignment?.assigned
            ? `Cupo liberado y reasignado a: ${response.data.reassignment.patient_assigned}`
            : response.data.next_in_queue
            ? `Siguiente en cola: ${response.data.next_in_queue.patient_name}`
            : "Cupo liberado exitosamente",
        });

        // Refrescar la cola
        refresh();
        
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

  // Función para iniciar llamada con ElevenLabs
  const handleCallPatient = async (item: any) => {
    setCallingPatient(item.id);
    try {
      const response = await api.initiateElevenLabsCall({
        phoneNumber: item.patient_phone,
        patientId: item.patient_id,
        patientName: item.patient_name,
        appointmentId: item.type === 'scheduled' ? item.id : item.appointment_id,
        metadata: {
          specialty: item.specialty_name,
          priority: item.priority_level,
          type: item.type,
          call_type: item.call_type || 'agendar'
        }
      });

      if (response.success) {
        toast({
          title: "✅ Llamada iniciada",
          description: `Llamando a ${item.patient_name} (${item.patient_phone})`,
        });
      } else {
        toast({
          title: "Error al llamar",
          description: response.message || "No se pudo iniciar la llamada",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error al iniciar llamada:', error);
      toast({
        title: "Error",
        description: error.message || "Error al conectar con el sistema de llamadas",
        variant: "destructive",
      });
    } finally {
      setCallingPatient(null);
    }
  };

  if (loading && !dailyData) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
          <AppSidebar />
          <main className="flex-1 p-6">
            <div className="mb-4">
              <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
            </div>
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-medical-600" />
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-medical-800 mb-2">Gestión de Cola Diaria</h1>
                <p className="text-medical-600">
                  Citas programadas para: {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              </div>
              <div className="flex gap-2">
                {/* Selector de Fecha */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateChange}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
                
                <Button onClick={() => refresh()} disabled={loading} variant="outline" size="sm">
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </div>

            {/* Tarjetas de Estadísticas */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Citas Disponibles Hoy</CardTitle>
                  <Calendar className="h-4 w-4 text-medical-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-medical-700">{dailyData?.stats?.total_today || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {dailyData?.stats?.total_waiting || 0} en espera + {dailyData?.stats?.total_scheduled || 0} agendadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">En Cola de Espera</CardTitle>
                  <Clock className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-700">{dailyData?.stats?.total_waiting || 0}</div>
                  <p className="text-xs text-muted-foreground">Pacientes en espera</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                  <Clock className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">0m</div>
                  <p className="text-xs text-muted-foreground">Esperando</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Urgentes</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700">
                    {(dailyData?.stats?.by_priority?.urgente || 0) + (dailyData?.stats?.by_priority?.alta || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Prioridad alta/urgente</p>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Citas por Especialidad */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-medical-800">📋 Cola de Espera</h2>
              <p className="text-sm text-gray-600">Pacientes con citas programadas para la fecha seleccionada</p>

              {dailyData?.data && dailyData.data.length > 0 ? (
                dailyData.data.map((specialty: any) => (
                  <Card key={specialty.specialty_id} className="border-medical-200">
                    <CardHeader className="bg-gradient-to-r from-medical-50 to-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl text-medical-800">{specialty.specialty_name}</CardTitle>
                          <CardDescription>
                            {specialty.waiting_count} en espera • {specialty.scheduled_count} agendadas
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {specialty.items && specialty.items.length > 0 ? (
                          specialty.items.map((item: any, index: number) => (
                            <div 
                              key={`${item.type}-${item.id}`} 
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-medical-50 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 bg-medical-100 rounded-full flex items-center justify-center text-medical-700 font-semibold">
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <User className="w-4 h-4 text-gray-500" />
                                    <span className="font-semibold">{item.patient_name}</span>
                                    <Badge variant={getPriorityColor(item.priority_level)} className="text-xs">
                                      {item.priority_level}
                                    </Badge>
                                    <Badge variant={getTypeBadgeVariant(item.type)} className="text-xs">
                                      {getTypeLabel(item.type)}
                                    </Badge>
                                    {/* 🔥 NUEVO: Badge especial para reagendamientos */}
                                    {item.call_type === 'reagendar' && (
                                      <Badge 
                                        className="text-xs bg-black text-yellow-400 hover:bg-black/90 font-bold"
                                      >
                                        ⚡ Reagendar
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {item.patient_phone}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Creada: {formatTime(item.created_at)}
                                    </div>
                                  </div>
                                  {item.reason && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Motivo: {item.reason}
                                    </div>
                                  )}
                                  {item.doctor_name && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Dr. {item.doctor_name} • {item.location_name}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                {item.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.status}
                                  </Badge>
                                )}
                                {/* Botón Llamar - disponible para todos */}
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleCallPatient(item)}
                                  disabled={callingPatient === item.id}
                                >
                                  {callingPatient === item.id ? (
                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <PhoneCall className="w-4 h-4 mr-1" />
                                  )}
                                  {callingPatient === item.id ? 'Llamando...' : 'Llamar'}
                                </Button>
                                {/* Botones solo para citas agendadas */}
                                {item.type === 'scheduled' && item.availability_id && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                                      onClick={() => handleReturnToQueueClick(item)}
                                    >
                                      <RotateCcw className="w-4 h-4 mr-1" />
                                      Devolver a Espera
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-medical-600 hover:bg-medical-50 hover:text-medical-700"
                                      onClick={() => handleReassignClick(item)}
                                    >
                                      <ArrowRight className="w-4 h-4 mr-1" />
                                      Reasignar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 italic py-4 text-center">
                            No hay pacientes en esta especialidad
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-500 text-lg">No hay citas registradas para hoy</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Reasignación */}
      {selectedAppointment && (
        <ReassignAppointmentModal
          isOpen={reassignModalOpen}
          onClose={() => {
            setReassignModalOpen(false);
            setSelectedAppointment(null);
          }}
          appointmentId={selectedAppointment.id}
          patientName={selectedAppointment.patientName}
          currentAvailabilityId={selectedAppointment.availabilityId}
          onReassignSuccess={handleReassignSuccess}
        />
      )}

      {/* Modal de Devolver a Espera */}
      <AlertDialog open={returnToQueueOpen} onOpenChange={setReturnToQueueOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver Cita a Cola de Espera</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de cancelar la cita de <strong>{appointmentToReturn?.patient_name}</strong> y devolver el cupo a cola de espera?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo de cancelación (opcional)</Label>
              <Input
                id="reason"
                placeholder="Ingrese el motivo..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-assign"
                checked={autoAssign}
                onCheckedChange={(checked) => setAutoAssign(checked as boolean)}
              />
              <label
                htmlFor="auto-assign"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Asignar automáticamente al siguiente en cola
              </label>
            </div>

            {appointmentToReturn && (
              <div className="bg-gray-50 p-3 rounded-md text-sm space-y-1">
                <p><strong>Paciente:</strong> {appointmentToReturn.patient_name}</p>
                <p><strong>Doctor:</strong> Dr. {appointmentToReturn.doctor_name}</p>
                <p><strong>Especialidad:</strong> {appointmentToReturn.specialty_name}</p>
                <p><strong>Sede:</strong> {appointmentToReturn.location_name}</p>
                <p><strong>Hora:</strong> {appointmentToReturn.scheduled_time ? formatTime(appointmentToReturn.scheduled_time) : 'N/A'}</p>
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
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
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
    </SidebarProvider>
  );
}
