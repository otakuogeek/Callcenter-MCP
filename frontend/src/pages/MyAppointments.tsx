// Vista del paciente: Mis citas y solicitudes en cola (solo lectura)
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, Phone, Mail, FileText, AlertCircle, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MyAppointments = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getMyAppointments();
      setData(response.data);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar tus citas');
      console.error('Error cargando citas del paciente:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Actualizar cada 60 segundos
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgente':
        return 'destructive';
      case 'alta':
        return 'destructive';
      case 'normal':
        return 'default';
      case 'baja':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmada':
        return 'default';
      case 'pendiente':
        return 'secondary';
      case 'completada':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatWaitTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) return `${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
      if (diffHours > 0) return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
      return `${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    } catch {
      return 'N/A';
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full min-h-screen bg-gradient-to-br from-medical-50 to-white">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-3xl font-bold text-medical-800">Mis Citas</h1>
                <p className="text-gray-600">Consulta tus citas programadas y solicitudes en espera</p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Cargando tus citas...</p>
              </div>
            </div>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-red-800">
                  <AlertCircle className="w-5 h-5" />
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {/* Información del Paciente */}
              <Card className="border-medical-200">
                <CardHeader className="bg-gradient-to-r from-medical-50 to-white">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Información Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Nombre</p>
                      <p className="font-semibold text-medical-800">{data.patient.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Documento</p>
                      <p className="font-semibold">{data.patient.document}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Teléfono</p>
                      <p className="font-semibold flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {data.patient.phone}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600">Citas Programadas</p>
                        <p className="text-3xl font-bold text-blue-900">{data.summary.total_appointments}</p>
                      </div>
                      <Calendar className="w-12 h-12 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-600">En Lista de Espera</p>
                        <p className="text-3xl font-bold text-yellow-900">{data.summary.total_waiting}</p>
                      </div>
                      <Clock className="w-12 h-12 text-yellow-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Citas Programadas */}
              <Card className="border-medical-200">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-white">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Citas Programadas
                  </CardTitle>
                  <CardDescription>
                    {data.appointments.length > 0 
                      ? `Tienes ${data.appointments.length} ${data.appointments.length === 1 ? 'cita programada' : 'citas programadas'}`
                      : 'No tienes citas programadas'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {data.appointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p>No tienes citas programadas en este momento</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {data.appointments.map((appointment: any) => (
                        <div 
                          key={appointment.id} 
                          className="p-5 border rounded-lg bg-gradient-to-r from-blue-50 to-white hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={getStatusBadgeVariant(appointment.status)}>
                                  {appointment.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Cita #{appointment.id}
                                </Badge>
                              </div>
                              <h3 className="text-lg font-semibold text-medical-800">
                                {appointment.specialty_name}
                              </h3>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{formatDate(appointment.scheduled_at)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{formatTime(appointment.scheduled_at)}</span>
                                <span className="text-gray-500">({appointment.duration_minutes} min)</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Stethoscope className="w-4 h-4 text-gray-400" />
                                <span>Dr(a). {appointment.doctor_name}</span>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <div>
                                  <p className="font-medium">{appointment.location_name}</p>
                                  <p className="text-xs text-gray-500">{appointment.location_address}</p>
                                </div>
                              </div>
                              {appointment.room_name && (
                                <div className="text-sm">
                                  <span className="text-gray-600">Consultorio: </span>
                                  <span className="font-medium">{appointment.room_name}</span>
                                </div>
                              )}
                              <div className="text-sm">
                                <span className="text-gray-600">Modalidad: </span>
                                <Badge variant="secondary" className="text-xs">
                                  {appointment.appointment_type}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {appointment.reason && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm text-gray-600">Motivo:</p>
                              <p className="text-sm font-medium">{appointment.reason}</p>
                            </div>
                          )}

                          {appointment.cups_code && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-600" />
                                <Badge variant="outline" className="font-mono text-xs">
                                  {appointment.cups_code}
                                </Badge>
                                <span className="text-sm text-gray-700">{appointment.cups_name}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Solicitudes en Lista de Espera */}
              <Card className="border-medical-200">
                <CardHeader className="bg-gradient-to-r from-yellow-50 to-white">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    Solicitudes en Lista de Espera
                  </CardTitle>
                  <CardDescription>
                    {data.waiting_list.length > 0 
                      ? `Tienes ${data.waiting_list.length} ${data.waiting_list.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`
                      : 'No tienes solicitudes en espera'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {data.waiting_list.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p>No tienes solicitudes en lista de espera</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {data.waiting_list.map((item: any) => (
                        <div 
                          key={item.id} 
                          className="p-5 border rounded-lg bg-gradient-to-r from-yellow-50 to-white hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={getPriorityBadgeVariant(item.priority_level)}>
                                  {item.priority_level}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Posición #{item.queue_position}
                                </Badge>
                                {item.call_type === 'reagendar' && (
                                  <Badge className="text-xs bg-black text-yellow-400">
                                    ⚡ Reagendar
                                  </Badge>
                                )}
                              </div>
                              <h3 className="text-lg font-semibold text-medical-800">
                                {item.specialty_name || 'Especialidad no especificada'}
                              </h3>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span>En espera desde hace {formatWaitTime(item.created_at)}</span>
                              </div>
                              {item.doctor_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Stethoscope className="w-4 h-4 text-gray-400" />
                                  <span>Dr(a). {item.doctor_name}</span>
                                </div>
                              )}
                              {item.location_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="w-4 h-4 text-gray-400" />
                                  <span>{item.location_name}</span>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm">
                                <span className="text-gray-600">Estado: </span>
                                <Badge variant="secondary" className="text-xs">
                                  Pendiente de Asignación
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600">
                                <p className="mb-1">Te notificaremos cuando se asigne tu cita</p>
                              </div>
                            </div>
                          </div>

                          {item.reason && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm text-gray-600">Motivo:</p>
                              <p className="text-sm font-medium">{item.reason}</p>
                            </div>
                          )}

                          {item.cups_code && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-yellow-600" />
                                <Badge variant="outline" className="font-mono text-xs">
                                  {item.cups_code}
                                </Badge>
                                <span className="text-sm text-gray-700">{item.cups_name}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mensaje informativo */}
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">Información importante:</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        <li>Las citas se actualizan automáticamente cada minuto</li>
                        <li>Recibirás notificaciones cuando se confirme o cambie una cita</li>
                        <li>Las solicitudes en espera se asignarán según disponibilidad y prioridad</li>
                        <li>Para cancelar o reprogramar, contacta a nuestro call center</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </SidebarProvider>
  );
};

export default MyAppointments;
