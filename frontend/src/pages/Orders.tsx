import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { FileText, Search, Calendar, User, MapPin, Stethoscope, Filter, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Función helper para mostrar la hora EXACTA de la BD (UTC-0) sin conversión
const formatUTCDate = (utcDateString: string, formatString: string): string => {
  return formatInTimeZone(parseISO(utcDateString), 'UTC', formatString, { locale: es });
};

// Función para formatear fechas de auditoría
const formatDateTime = (dateString: string): string => {
  return formatInTimeZone(parseISO(dateString), 'America/Bogota', "d 'de' MMMM, yyyy 'a las' h:mm a", { locale: es });
};

interface Order {
  id: number;
  patient_id: number;
  scheduled_at: string;
  status: string;
  appointment_type: string;
  reason: string;
  priority_level: string;
  created_at: string;
  updated_at: string;
  patient_name: string;
  patient_document: string;
  patient_phone: string;
  patient_email: string;
  specialty_name: string;
  location_name: string;
  doctor_name: string | null;
  cups_name: string | null;
  cups_code: string | null;
}

interface OrderDetail extends Order {
  patient_birth_date: string;
  patient_gender: string;
  patient_address: string;
  patient_eps: string;
  specialty_code: string;
  location_address: string;
  location_phone: string;
  doctor_specialty: string;
  doctor_license: string;
  cups_description: string;
  created_by_user_name: string;
  notes: string;
  insurance_type: string;
  duration_minutes: number;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadOrders();
    loadSpecialties();
  }, [page, statusFilter, specialtyFilter, fromDate, toDate]);

  const loadSpecialties = async () => {
    try {
      const response = await api.get('/specialties');
      // La respuesta es un array directo, no tiene .data
      setSpecialties(Array.isArray(response) ? response : (response.data || []));
    } catch (error) {
      console.error('Error cargando especialidades:', error);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (specialtyFilter && specialtyFilter !== 'all') params.append('specialty_id', specialtyFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (searchTerm) params.append('search', searchTerm);

      const response = await api.get(`/orders?${params.toString()}`);
      
      if (response.success) {
        setOrders(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadOrders();
  };

  const handleViewDetails = async (orderId: number) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      if (response.success) {
        setSelectedOrder(response.data);
        setShowDetails(true);
      }
    } catch (error) {
      console.error('Error cargando detalles:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      'Pendiente': 'secondary',
      'Confirmada': 'default',
      'Completada': 'outline',
      'Cancelada': 'destructive',
      'Pausada': 'secondary'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      'Urgente': 'bg-red-500',
      'Alta': 'bg-orange-500',
      'Normal': 'bg-blue-500',
      'Baja': 'bg-gray-500'
    };
    return (
      <Badge className={colors[priority] || 'bg-gray-500'}>
        {priority}
      </Badge>
    );
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full p-6">
        <SidebarTrigger />
        
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileText className="h-8 w-8" />
                Órdenes Médicas
              </h1>
              <p className="text-muted-foreground mt-1">
                Gestión y consulta de órdenes de atención médica
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total de órdenes</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros de Búsqueda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Búsqueda por # de Orden</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Ingrese número de orden..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} size="icon">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Pendiente">Pendiente</SelectItem>
                      <SelectItem value="Confirmada">Confirmada</SelectItem>
                      <SelectItem value="Completada">Completada</SelectItem>
                      <SelectItem value="Cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Especialidad</Label>
                  <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {specialties.map((spec) => (
                        <SelectItem key={spec.id} value={spec.id.toString()}>
                          {spec.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rango de Fechas</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Órdenes */}
          <Card>
            <CardHeader>
              <CardTitle>Listado de Órdenes</CardTitle>
              <CardDescription>
                Mostrando página {page} de {totalPages} ({total} órdenes en total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Cargando órdenes...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No se encontraron órdenes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="font-semibold text-lg">Orden #{order.id}</div>
                              {getStatusBadge(order.status)}
                              {getPriorityBadge(order.priority_level)}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {order.patient_name}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    CC: {order.patient_document}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {formatUTCDate(order.scheduled_at, "d 'de' MMMM, yyyy")}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className="bg-green-600 hover:bg-green-700">
                                      {formatInTimeZone(order.scheduled_at, 'America/Bogota', "h:mm a", { locale: es })}
                                    </Badge>
                                  </div>
                                  <p className="text-muted-foreground" style={{fontSize: '0.65rem'}}>
                                    Hora BD: {formatUTCDate(order.scheduled_at, "h:mm a")} (UTC-0)
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{order.specialty_name}</p>
                                  {order.doctor_name && (
                                    <p className="text-muted-foreground text-xs">
                                      {order.doctor_name}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{order.location_name}</p>
                                  <p className="text-muted-foreground text-xs">{order.appointment_type}</p>
                                </div>
                              </div>

                              {order.reason && (
                                <div className="col-span-full">
                                  <p className="text-xs text-muted-foreground">Motivo:</p>
                                  <p className="text-sm">{order.reason}</p>
                                </div>
                              )}

                              {/* Información de fechas de creación y modificación */}
                              <div className="col-span-full pt-2 border-t">
                                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                  <p>
                                    <span className="font-medium">Creada:</span>{" "}
                                    {formatDateTime(order.created_at)}
                                  </p>
                                  {order.updated_at && (
                                    // Comparar solo los primeros 19 caracteres (sin milisegundos) para determinar si son diferentes
                                    (() => {
                                      const createdStr = order.created_at.substring(0, 19);
                                      const updatedStr = order.updated_at.substring(0, 19);
                                      return createdStr !== updatedStr ? (
                                        <p>
                                          <span className="font-medium">Modificada:</span>{" "}
                                          {formatDateTime(order.updated_at)}
                                        </p>
                                      ) : null;
                                    })()
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button
                            onClick={() => handleViewDetails(order.id)}
                            size="sm"
                            variant="outline"
                            className="ml-4"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalles
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <Button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>

                  <Button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    variant="outline"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dialog de Detalles */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles de la Orden #{selectedOrder?.id}</DialogTitle>
              <DialogDescription>
                Información completa de la orden médica
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && (
              <div className="space-y-6">
                {/* Información del Paciente */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información del Paciente
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nombre Completo</p>
                      <p className="font-medium">
                        {selectedOrder.patient_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Documento</p>
                      <p className="font-medium">{selectedOrder.patient_document}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Teléfono</p>
                      <p className="font-medium">{selectedOrder.patient_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedOrder.patient_email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">EPS</p>
                      <p className="font-medium">{selectedOrder.patient_eps || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tipo de Seguro</p>
                      <p className="font-medium">{selectedOrder.insurance_type || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Información de la Cita */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Información de la Cita
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Fecha y Hora (Colombia)</p>
                      <p className="font-medium mb-2">
                        {formatUTCDate(selectedOrder.scheduled_at, "d 'de' MMMM, yyyy 'a las'")}
                      </p>
                      <Badge className="bg-green-600 hover:bg-green-700 text-base">
                        {formatInTimeZone(selectedOrder.scheduled_at, 'America/Bogota', "h:mm a", { locale: es })}
                      </Badge>
                      <p className="text-muted-foreground mt-2" style={{fontSize: '0.7rem'}}>
                        Hora BD: {formatUTCDate(selectedOrder.scheduled_at, "h:mm a")} (UTC-0)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duración</p>
                      <p className="font-medium">{selectedOrder.duration_minutes} minutos</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estado</p>
                      <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Prioridad</p>
                      <div className="mt-1">{getPriorityBadge(selectedOrder.priority_level)}</div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tipo de Cita</p>
                      <p className="font-medium">{selectedOrder.appointment_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Creada por</p>
                      <p className="font-medium">{selectedOrder.created_by_user_name || 'Sistema'}</p>
                    </div>
                  </div>
                </div>

                {/* Información Médica */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Stethoscope className="h-5 w-5" />
                    Información Médica
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Especialidad</p>
                      <p className="font-medium">{selectedOrder.specialty_name}</p>
                    </div>
                    {selectedOrder.doctor_name && (
                      <div>
                        <p className="text-muted-foreground">Médico</p>
                        <p className="font-medium">
                          {selectedOrder.doctor_name}
                        </p>
                      </div>
                    )}
                    {selectedOrder.cups_name && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Procedimiento CUPS</p>
                          <p className="font-medium">{selectedOrder.cups_name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Código CUPS</p>
                          <p className="font-medium">{selectedOrder.cups_code}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Ubicación */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Ubicación
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Sede</p>
                      <p className="font-medium">{selectedOrder.location_name}</p>
                    </div>
                    {selectedOrder.location_address && (
                      <div>
                        <p className="text-muted-foreground">Dirección</p>
                        <p className="font-medium">{selectedOrder.location_address}</p>
                      </div>
                    )}
                    {selectedOrder.location_phone && (
                      <div>
                        <p className="text-muted-foreground">Teléfono Sede</p>
                        <p className="font-medium">{selectedOrder.location_phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Motivo y Notas */}
                {(selectedOrder.reason || selectedOrder.notes) && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Detalles Adicionales</h3>
                    {selectedOrder.reason && (
                      <div className="mb-3">
                        <p className="text-muted-foreground text-sm">Motivo de Consulta</p>
                        <p className="text-sm mt-1">{selectedOrder.reason}</p>
                      </div>
                    )}
                    {selectedOrder.notes && (
                      <div>
                        <p className="text-muted-foreground text-sm">Notas</p>
                        <p className="text-sm mt-1">{selectedOrder.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </SidebarProvider>
  );
}
