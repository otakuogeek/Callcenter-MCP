import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, Phone, RefreshCw, Calendar, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export default function DailyQueue() {
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getDailyQueue();
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
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

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
                  Asignación automática para hoy - {dailyData?.date ? formatDate(dailyData.date) : ''}
                </p>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              </div>
              <Button onClick={refresh} disabled={loading} variant="outline" size="sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
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
              <p className="text-sm text-gray-600">Pacientes en espera de asignación para hoy</p>

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
                              <div className="text-right">
                                {item.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.status}
                                  </Badge>
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
    </SidebarProvider>
  );
}
