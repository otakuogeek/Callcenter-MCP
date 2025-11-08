import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Phone, Clock, Users, Building, Edit, Settings, TrendingUp, Plus, Trash2, AlertTriangle, Loader2, Calendar, Activity } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend, Tooltip } from "recharts";

// Componente auxiliar para mostrar la capacidad diaria de una sede
const DailyCapacityTab = ({ locationId }: { locationId?: number }) => {
  const [capacityData, setCapacityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    const loadCapacityData = async () => {
      try {
        setLoading(true);
        const data = await api.getLocationDailyCapacity(locationId);
        setCapacityData(data);
      } catch (error) {
        console.error('Error loading capacity data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCapacityData();
  }, [locationId]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando datos de capacidad diaria...
      </div>
    );
  }

  if (!capacityData) {
    return (
      <div className="text-center text-muted-foreground p-8">
        No hay datos disponibles
      </div>
    );
  }

  // Combinar datos de citas y disponibilidad por fecha
  const combinedData = capacityData.appointments.map((apt: any) => {
    const avail = capacityData.availability.find((a: any) => a.date === apt.date);
    return {
      date: new Date(apt.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      fullDate: apt.date,
      confirmed: apt.confirmed,
      completed: apt.completed,
      cancelled: apt.cancelled,
      total_appointments: apt.total_appointments,
      total_slots: avail?.total_slots || 0,
      available_slots: avail?.available_slots || 0,
      booked_slots: avail?.booked_slots || 0,
      utilizacion: avail?.total_slots > 0 
        ? Math.round((avail.booked_slots / avail.total_slots) * 100) 
        : 0,
    };
  });

  // Calcular totales
  const totals = combinedData.reduce((acc: any, day: any) => ({
    confirmed: acc.confirmed + day.confirmed,
    completed: acc.completed + day.completed,
    cancelled: acc.cancelled + day.cancelled,
    total_slots: acc.total_slots + day.total_slots,
    available_slots: acc.available_slots + day.available_slots,
    booked_slots: acc.booked_slots + day.booked_slots,
  }), {
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    total_slots: 0,
    available_slots: 0,
    booked_slots: 0,
  });

  const avgUtilization = totals.total_slots > 0 
    ? Math.round((totals.booked_slots / totals.total_slots) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Citas Confirmadas</p>
              <p className="text-2xl font-bold text-medical-700">{totals.confirmed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Citas Completadas</p>
              <p className="text-2xl font-bold text-success-700">{totals.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Cupos Disponibles</p>
              <p className="text-2xl font-bold text-blue-700">{totals.available_slots}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Utilización Promedio</p>
              <p className="text-2xl font-bold text-warning-700">{avgUtilization}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de citas por día */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-medical-600" />
            Citas por Día (últimos 30 días + próximos 30 días)
          </CardTitle>
          <CardDescription>
            Distribución de citas confirmadas, completadas y canceladas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="confirmed" fill="#0ea5e9" name="Confirmadas" />
                <Bar dataKey="completed" fill="#22c55e" name="Completadas" />
                <Bar dataKey="cancelled" fill="#ef4444" name="Canceladas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de utilización de capacidad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-medical-600" />
            Utilización de Capacidad
          </CardTitle>
          <CardDescription>
            Porcentaje de cupos reservados vs disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="utilizacion" stroke="#0ea5e9" strokeWidth={2} name="Utilización (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Locations = () => {
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    phone: "",
    capacity: 0,
    hours: "",
    emergencyHours: "",
    specialties: []
  });

  const [createForm, setCreateForm] = useState({
    name: "",
    type: "",
    zoneId: "",
    municipalityId: "",
    address: "",
    phone: "",
    capacity: 0,
    hours: "",
    emergencyHours: "",
    specialties: []
  });
  const [isEmergency247, setIsEmergency247] = useState(false);

  // Zonas y municipios desde backend
  const [zones, setZones] = useState<any[]>([]);
  const [municipalities, setMunicipalities] = useState<any[]>([]);

  // Cargar zonas al montar
  useEffect(() => {
    (async () => {
      try {
        const rows = await api.getZones();
        setZones(rows as any[]);
      } catch {
        setZones([]);
      }
    })();
  }, []);

  // Cargar municipios al cambiar la zona seleccionada
  useEffect(() => {
    const zIdNum = Number(createForm.zoneId);
    if (!zIdNum) { setMunicipalities([]); return; }
    (async () => {
      try {
        const rows = await api.getMunicipalities(zIdNum);
        setMunicipalities(rows as any[]);
      } catch {
        setMunicipalities([]);
      }
    })();
  }, [createForm.zoneId]);

  const [locations, setLocations] = useState<any[]>([]);
  const [allSpecialties, setAllSpecialties] = useState<any[]>([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const [specialtiesFilter, setSpecialtiesFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusChangeSelected, setStatusChangeSelected] = useState<string>("");
  const [statusChangeNote, setStatusChangeNote] = useState<string>("");

  // Cargar sedes desde backend al montar
  useEffect(() => {
    (async () => {
      try {
        const rows = await api.getLocations();
        // Normalizar nombres de campos a los usados en UI
        const mapped = (rows as any[]).map((r) => ({
          id: r.id,
          name: r.name,
          address: r.address,
          phone: r.phone,
          type: r.type,
          status: r.status,
          capacity: r.capacity ?? 0,
          currentPatients: r.current_patients ?? r.currentPatients ?? 0,
          specialties: r.specialties || [],
          hours: r.hours,
          emergencyHours: r.emergency_hours ?? r.emergencyHours,
        }));
        setLocations(mapped);
      } catch {
        setLocations([]);
      }
    })();
    // también cargar catálogo de especialidades
    (async () => {
      try {
        const srows = await api.getSpecialties();
        setAllSpecialties(srows as any[]);
      } catch {
        setAllSpecialties([]);
      }
    })();
  }, []);

  const [locationTypes, setLocationTypes] = useState<{ id: number; name: string; status: string }[]>([]);

  useEffect(() => {
    // Cargar tipos de sede activos desde backend
    (async () => {
      try {
        const rows = await api.getLocationTypes();
        setLocationTypes((rows as any[]).filter(t => t.status === 'active'));
      } catch (e) {
        // si falla, dejamos vacío y el Select mostrará opciones vacías
        setLocationTypes([]);
      }
    })();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Activa":
        return "bg-success-100 text-success-800";
      case "En Mantenimiento":
        return "bg-warning-100 text-warning-800";
      case "Inactiva":
        return "bg-danger-100 text-danger-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCapacityColor = (current: number, total: number) => {
    const percentage = (current / total) * 100;
    if (percentage >= 90) return "text-danger-600";
    if (percentage >= 70) return "text-warning-600";
    return "text-success-600";
  };

  const handleViewDetails = (location) => {
    setSelectedLocation(location);
    setIsDetailsOpen(true);
  };

  const handleManage = (location) => {
    setSelectedLocation(location);
    setEditForm({
      name: location.name,
      address: location.address,
      phone: location.phone,
      capacity: location.capacity,
      hours: location.hours,
      emergencyHours: location.emergencyHours,
      specialties: location.specialties
    });
    // Cargar especialidades actuales desde backend si tenemos id
    (async () => {
      try {
        setLoadingSpecialties(true);
        const rows = await api.getLocationSpecialties(location.id);
        // rows: [{id,name,active}], guardamos por id para edición
        setEditForm((prev) => ({ ...prev, specialties: rows.map((r: any) => r.id) }));
      } catch { /* ignore */ }
      finally { setLoadingSpecialties(false); }
    })();
    setIsManageOpen(true);
  };

  const handleStatusConfig = (location) => {
    setSelectedLocation(location);
  setStatusChangeSelected(location.status);
  setStatusChangeNote("");
    setIsStatusOpen(true);
  };

  const handleDeleteLocation = (location) => {
    setLocationToDelete(location);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!locationToDelete) return;
    try {
      await api.deleteLocation(locationToDelete.id);
      setLocations((list) => list.filter((loc) => loc.id !== locationToDelete.id));
    } catch (e) {
      // opcional: mostrar toast
    }
    setLocationToDelete(null);
    setIsDeleteOpen(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedLocation) return;
    try {
      setIsSavingStatus(true);
      await api.updateLocation(selectedLocation.id, { status: newStatus });
      setLocations((list) => list.map((loc) => (loc.id === selectedLocation.id ? { ...loc, status: newStatus } : loc)));
      toast({ title: "Estado actualizado", description: `${selectedLocation.name}: ${newStatus}${statusChangeNote ? ` — ${statusChangeNote}` : ""}` });
    } catch (e) {
      toast({ title: "Error al actualizar estado", description: (e as Error).message });
    }
    setIsSavingStatus(false);
    setIsStatusOpen(false);
  };

  const handleCreateLocation = async () => {
  if (!createForm.name.trim()) { toast({ title: "Nombre requerido", description: "Ingresa el nombre de la sede" }); return; }
  if (!createForm.type) { toast({ title: "Tipo requerido", description: "Selecciona el tipo de sede" }); return; }
    try {
      const payload = {
        municipality_id: createForm.municipalityId ? Number(createForm.municipalityId) : null,
        name: createForm.name.trim(),
        address: createForm.address || null,
        phone: createForm.phone || null,
        type: createForm.type,
        status: 'Activa' as const,
        capacity: Number(createForm.capacity) || 0,
        current_patients: 0,
        hours: createForm.hours || null,
        emergency_hours: createForm.emergencyHours || null,
      };
      const created = await api.createLocation(payload as any);
      setLocations((list) => [
        ...list,
        {
          id: (created as any).id,
          name: payload.name,
          address: payload.address,
          phone: payload.phone,
          type: payload.type,
          status: payload.status,
          capacity: payload.capacity,
          currentPatients: payload.current_patients,
          specialties: [],
          hours: payload.hours,
          emergencyHours: payload.emergency_hours,
        },
      ]);
  toast({ title: "Sede creada", description: `${payload.name} creada correctamente` });
    } catch (e) {
  toast({ title: "Error al crear", description: (e as Error).message });
    }
    setCreateForm({
      name: "",
      type: "",
      zoneId: "",
      municipalityId: "",
      address: "",
      phone: "",
      capacity: 0,
      hours: "",
      emergencyHours: "",
      specialties: []
    });
    setIsCreateOpen(false);
  };

  const handleSaveChanges = async () => {
    if (!selectedLocation) return;
  if (!editForm.name.trim()) { toast({ title: "Nombre requerido", description: "Ingresa el nombre de la sede" }); return; }
    const payload = {
      name: editForm.name?.trim(),
      address: editForm.address || null,
      phone: editForm.phone || null,
      capacity: Number(editForm.capacity) || 0,
      hours: editForm.hours || null,
      emergency_hours: editForm.emergencyHours || null,
      status: selectedLocation.status,
    };
    try {
      setIsSaving(true);
      await api.updateLocation(selectedLocation.id, payload as any);
      // Persistir especialidades (mapear por nombre si vinieron como strings)
      const selectedIds: number[] = editForm.specialties
        .map((s: any) => {
          if (typeof s === 'number') return s;
          const found = allSpecialties.find((sp) => sp.name === s);
          return found ? found.id : null;
        })
        .filter((x: any) => Number.isInteger(x));
      await api.setLocationSpecialties(selectedLocation.id, selectedIds);
      const updatedSpecialtyNames = selectedIds
        .map((sid) => {
          const found = allSpecialties.find((sp) => sp.id === sid);
          return found ? found.name : null;
        })
        .filter((n): n is string => Boolean(n));
      setLocations((list) => list.map((loc) => (loc.id === selectedLocation.id ? {
        ...loc,
        name: payload.name,
        address: payload.address,
        phone: payload.phone,
        capacity: payload.capacity,
        hours: payload.hours,
        emergencyHours: payload.emergency_hours,
        specialties: updatedSpecialtyNames,
      } : loc)));
      toast({ title: "Cambios guardados", description: `${payload.name} actualizado` });
    } catch (e) {
      toast({ title: "Error al guardar", description: (e as Error).message });
    }
    setIsSaving(false);
    setIsManageOpen(false);
  };

  // Métricas (cargadas desde backend por sede)
  const [metricsWeeks, setMetricsWeeks] = useState<{ name: string; citas: number; capacidad: number }[]>([]);
  const [metricsTotals, setMetricsTotals] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const loadLocationMetrics = async (locId: number) => {
    try {
      setLoadingMetrics(true);
      const now = new Date();
      const data = await api.getLocationMetrics(locId, now.getMonth() + 1, now.getFullYear());
      const weeks = data.weeks.map((w: any, idx: number) => ({ name: `Sem ${w.wom || idx + 1}`, citas: w.citas, capacidad: w.capacidad }));
      setMetricsWeeks(weeks);
      setMetricsTotals(data.totals);
    } catch {
      setMetricsWeeks([]);
      setMetricsTotals(null);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const chartConfig = {
    citas: {
      label: "Citas Agendadas",
      color: "hsl(var(--medical-500))",
    },
    capacidad: {
      label: "Capacidad Total",
      color: "hsl(var(--medical-200))",
    },
  };

  // Municipios para la zona seleccionada (ya filtrados por API)
  const availableMunicipalities = municipalities;

  // Cargar métricas cuando abrimos gestionar una sede
  useEffect(() => {
    if (isManageOpen && selectedLocation?.id) {
      loadLocationMetrics((selectedLocation as any).id);
    }
  }, [isManageOpen, selectedLocation]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-medical-800 mb-2">Gestión de Ubicaciones</h1>
                <p className="text-medical-600">Red de sedes y consultorios de Valeria</p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Crear Nueva Sede
              </Button>
            </div>

            {/* Resumen General */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-medical-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Ubicaciones</p>
                      <p className="text-2xl font-bold text-medical-700">{locations.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-success-600" />
                    <div>
                      <p className="text-sm text-gray-600">Activas</p>
                      <p className="text-2xl font-bold text-success-700">
                        {locations.filter(l => l.status === "Activa").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-warning-600" />
                    <div>
                      <p className="text-sm text-gray-600">Ocupación Total del Mes</p>
                      <p className="text-2xl font-bold text-warning-700">
                        {locations.reduce((sum, loc) => sum + (loc.currentPatients ?? 0), 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Ubicaciones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {locations.map((location) => (
                <Card key={location.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-medical-700">
                          <Building className="w-5 h-5" />
                          {location.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="w-4 h-4" />
                          {location.address}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={`${getStatusColor(location.status)} cursor-pointer hover:opacity-80`}
                          onClick={() => handleStatusConfig(location)}
                        >
                          {location.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteLocation(location)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Información de Contacto */}
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-medical-600" />
                      <span>{location.phone}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {location.type}
                      </Badge>
                    </div>

                    {/* Capacidad */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Ocupación</span>
                        <span className={`font-semibold ${getCapacityColor(location.currentPatients ?? 0, location.capacity ?? 0)}`}>
                          {(location.currentPatients ?? 0)}/{location.capacity ?? 0}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-medical-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${((location.currentPatients ?? 0) / (location.capacity || 1)) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Especialidades */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Especialidades:</p>
                      <div className="flex flex-wrap gap-1">
                        {location.specialties.map((specialty, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Horarios */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-medical-600" />
                        <span className="font-medium">Horario:</span>
                        <span className="text-gray-600">{location.hours}</span>
                      </div>
                      {location.emergencyHours !== "No disponible" && (
                        <div className="text-sm text-success-700 ml-6">
                          🚨 Urgencias: {location.emergencyHours}
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleViewDetails(location)}
                      >
                        Ver Detalles
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleManage(location)}
                      >
                        Gestionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Modal de Configurar Estado */}
          <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-medical-600" />
                  Configurar Estado de {selectedLocation?.name}
                </DialogTitle>
                <DialogDescription>
                  Selecciona el nuevo estado para esta ubicación
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label>Estado Actual</Label>
                  <Badge className={`${getStatusColor(selectedLocation?.status || "")} ml-2`}>
                    {selectedLocation?.status}
                  </Badge>
                </div>
                
                <div>
                  <Label htmlFor="new-status">Nuevo Estado</Label>
                  <Select value={statusChangeSelected} onValueChange={(v)=>setStatusChangeSelected(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Activa">Activa</SelectItem>
                      <SelectItem value="En Mantenimiento">En Mantenimiento</SelectItem>
                      <SelectItem value="Inactiva">Inactiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Nota (opcional)</Label>
                  <Input
                    placeholder="Motivo o comentario"
                    value={statusChangeNote}
                    onChange={(e)=>setStatusChangeNote(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsStatusOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={()=>handleStatusChange(statusChangeSelected)} disabled={!statusChangeSelected || isSavingStatus}>
                    {isSavingStatus && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                    Confirmar Cambio
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal de Confirmación de Eliminación */}
          <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Confirmar Eliminación
                </DialogTitle>
                <DialogDescription>
                  Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar esta ubicación?
                </DialogDescription>
              </DialogHeader>
              
              {locationToDelete && (
                <div className="space-y-4">
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-800">{locationToDelete.name}</h4>
                    <p className="text-sm text-red-600">{locationToDelete.address}</p>
                    <p className="text-sm text-red-600">Tipo: {locationToDelete.type}</p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={confirmDelete}>
                      Eliminar Ubicación
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Modal de Crear Nueva Sede */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-medical-600" />
                  Crear Nueva Sede
                </DialogTitle>
                <DialogDescription>
                  Ingrese la información de la nueva sede médica
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-name">Nombre de la Sede</Label>
                    <Input
                      id="create-name"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                      placeholder="Ej: Valeria Bucaramanga"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-type">Tipo de Sede</Label>
                    <Select 
                      value={createForm.type} 
                      onValueChange={(value) => setCreateForm({...createForm, type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationTypes.map(t => (
                          <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-zone">Zona</Label>
                    <Select 
                      value={createForm.zoneId} 
                      onValueChange={(value) => setCreateForm({...createForm, zoneId: value, municipalityId: ""})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una zona" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={String(zone.id)}>
                            {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="create-municipality">Municipio</Label>
                    <Select 
                      value={createForm.municipalityId} 
                      onValueChange={(value) => setCreateForm({...createForm, municipalityId: value})}
                      disabled={!createForm.zoneId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un municipio" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMunicipalities.map((municipality) => (
                          <SelectItem key={municipality.id} value={String(municipality.id)}>
                            {municipality.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="create-address">Dirección Completa</Label>
                  <Textarea
                    id="create-address"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({...createForm, address: e.target.value})}
                    placeholder="Ingrese la dirección completa de la sede"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-phone">Teléfono Principal</Label>
                    <Input
                      id="create-phone"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({...createForm, phone: e.target.value})}
                      placeholder="+57 7 123 4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-capacity">Capacidad Total</Label>
                    <Input
                      id="create-capacity"
                      type="number"
                      value={createForm.capacity}
                      onChange={(e) => setCreateForm({...createForm, capacity: parseInt(e.target.value)})}
                      placeholder="150"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-hours">Horario Regular</Label>
                    <Input
                      id="create-hours"
                      value={createForm.hours}
                      onChange={(e) => setCreateForm({...createForm, hours: e.target.value})}
                      placeholder="Lunes a Viernes: 7:00 AM - 6:00 PM"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-emergency">Horario de Urgencias</Label>
                    <Input
                      id="create-emergency"
                      value={createForm.emergencyHours}
                      onChange={(e) => setCreateForm({...createForm, emergencyHours: e.target.value})}
                      placeholder="24/7 o No disponible"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateLocation}>
                    Crear Sede
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal de Detalles */}
          <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-medical-600" />
                  Detalles de {selectedLocation?.name}
                </DialogTitle>
                <DialogDescription>
                  Información completa de la ubicación
                </DialogDescription>
              </DialogHeader>
              
              {selectedLocation && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Ubicación</Label>
                      <p className="text-sm text-gray-600">{selectedLocation.address}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Teléfono</Label>
                      <p className="text-sm text-gray-600">{selectedLocation.phone}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Tipo</Label>
                      <Badge variant="outline">{selectedLocation.type}</Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Estado</Label>
                      <Badge className={getStatusColor(selectedLocation.status)}>
                        {selectedLocation.status}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Capacidad</Label>
                    <div className="bg-gray-100 p-3 rounded">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Ocupación actual</span>
                        <span className={`font-semibold ${getCapacityColor(selectedLocation.currentPatients, selectedLocation.capacity)}`}>
                          {selectedLocation.currentPatients}/{selectedLocation.capacity}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-medical-500 h-2 rounded-full"
                          style={{ width: `${(selectedLocation.currentPatients / selectedLocation.capacity) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Especialidades</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedLocation.specialties.map((specialty, index) => (
                        <Badge key={index} variant="secondary">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Horario Regular</Label>
                      <p className="text-sm text-gray-600">{selectedLocation.hours}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Urgencias</Label>
                      <p className="text-sm text-gray-600">{selectedLocation.emergencyHours}</p>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Modal de Gestión Mejorado */}
          <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-medical-600" />
                  Gestionar {selectedLocation?.name}
                </DialogTitle>
                <DialogDescription>
                  Administra la información completa de la sede
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="info" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="info">Información General</TabsTrigger>
                  <TabsTrigger value="schedule">Horarios y Contacto</TabsTrigger>
                  <TabsTrigger value="capacity">Capacidad Diaria</TabsTrigger>
                  <TabsTrigger value="metrics">Métricas de Ocupación</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nombre de la Sede</Label>
                      <Input
                        id="name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        placeholder="Ej: Valeria Centro"
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Tipo de Sede</Label>
                      <Input
                        id="type"
                        value={selectedLocation?.type || ""}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Dirección Completa</Label>
                    <Textarea
                      id="address"
                      value={editForm.address}
                      onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                      placeholder="Ingrese la dirección completa de la sede"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="capacity">Capacidad Total</Label>
                      <Input
                        id="capacity"
                        type="number"
                        value={editForm.capacity}
                        onChange={(e) => setEditForm({...editForm, capacity: parseInt(e.target.value)})}
                        placeholder="Capacidad total"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Estado Actual</Label>
                      <Select
                        value={selectedLocation?.status}
                        onValueChange={(value) => setSelectedLocation((prev) => prev ? { ...prev, status: value } : prev)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Activa">Activa</SelectItem>
                          <SelectItem value="En Mantenimiento">En Mantenimiento</SelectItem>
                          <SelectItem value="Inactiva">Inactiva</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Especialidades Disponibles</Label>
                      <span className="text-xs text-gray-600">{Array.isArray(editForm.specialties)?editForm.specialties.length:0} seleccionadas</span>
                    </div>
                    <div className="mt-2">
                      <Input
                        placeholder="Filtrar por nombre..."
                        value={specialtiesFilter}
                        onChange={(e)=>setSpecialtiesFilter(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 p-3 border rounded min-h-[120px]">
                      {loadingSpecialties && (
                        <div className="col-span-full flex items-center justify-center text-gray-500"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Cargando...</div>
                      )}
                      {!loadingSpecialties && allSpecialties
                        .filter(sp=>sp.name.toLowerCase().includes(specialtiesFilter.toLowerCase()))
                        .map((sp) => {
                        const checked = Array.isArray(editForm.specialties)
                          ? editForm.specialties.includes(sp.id) || editForm.specialties.includes(sp.name)
                          : false;
                        return (
                          <label key={sp.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(val) => {
                                setEditForm((prev) => {
                                  const arr = Array.isArray(prev.specialties) ? [...prev.specialties] : [];
                                  const asIdArr = arr.map((x:any)=>typeof x==='number'?x:(allSpecialties.find(s=>s.name===x)?.id)).filter((x:any)=>Number.isInteger(x));
                                  const exists = asIdArr.includes(sp.id);
                                  if (val && !exists) asIdArr.push(sp.id);
                                  if (!val && exists) asIdArr.splice(asIdArr.indexOf(sp.id), 1);
                                  return { ...prev, specialties: asIdArr };
                                });
                              }}
                            />
                            {sp.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Clock className="w-5 h-5" />
                          Horarios de Atención
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="regular-hours">Horario Regular</Label>
                          <Input
                            id="regular-hours"
                            value={editForm.hours}
                            onChange={(e) => setEditForm({...editForm, hours: e.target.value})}
                            placeholder="Ej: Lunes a Viernes: 7:00 AM - 6:00 PM"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="emergency-hours">Horario de Urgencias</Label>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <span>24/7</span>
                              <Switch
                                checked={isEmergency247}
                                onCheckedChange={(v) => {
                                  setIsEmergency247(!!v);
                                  setEditForm((prev) => ({ ...prev, emergencyHours: v ? "24/7" : prev.emergencyHours === "24/7" ? "" : prev.emergencyHours }));
                                }}
                              />
                            </div>
                          </div>
                          <Input
                            id="emergency-hours"
                            value={editForm.emergencyHours}
                            onChange={(e) => setEditForm({...editForm, emergencyHours: e.target.value})}
                            placeholder="Ej: 24/7 o No disponible"
                            disabled={isEmergency247}
                          />
                        </div>
                        <div>
                          <Label htmlFor="weekend-hours">Horario Fines de Semana</Label>
                          <Input
                            id="weekend-hours"
                            placeholder="Ej: Sábados: 8:00 AM - 2:00 PM"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Phone className="w-5 h-5" />
                          Números de Contacto
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="main-phone">Teléfono Principal</Label>
                          <Input
                            id="main-phone"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="ext-recepcion">Extensión Recepción</Label>
                          <Input
                            id="ext-recepcion"
                            placeholder="Ej: Ext. 101"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ext-urgencias">Extensión Urgencias</Label>
                          <Input
                            id="ext-urgencias"
                            placeholder="Ej: Ext. 911"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ext-admin">Extensión Administración</Label>
                          <Input
                            id="ext-admin"
                            placeholder="Ej: Ext. 200"
                          />
                        </div>
                        <div>
                          <Label htmlFor="whatsapp">WhatsApp de la Sede</Label>
                          <Input
                            id="whatsapp"
                            placeholder="Ej: +57 300 123 4567"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="capacity" className="space-y-4">
                  <DailyCapacityTab locationId={selectedLocation?.id} />
                </TabsContent>

                <TabsContent value="metrics" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-medical-600" />
                            Ocupación Mensual - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                          </CardTitle>
                          <CardDescription>
                            Seguimiento de citas agendadas vs capacidad total
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Promedio del mes</p>
                          <p className="text-2xl font-bold text-medical-700">
                            {metricsTotals?.avgOccupancyPct ?? 0}%
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingMetrics ? (
                        <div className="h-64 flex items-center justify-center text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mr-2"/> Cargando métricas...
                        </div>
                      ) : (
                        <ChartContainer config={chartConfig} className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metricsWeeks} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar dataKey="capacidad" fill="var(--color-capacidad)" name="Capacidad" />
                              <Bar dataKey="citas" fill="var(--color-citas)" name="Citas Agendadas" />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Total Citas del Mes</p>
                          <p className="text-2xl font-bold text-medical-700">{metricsTotals?.totalAppointments ?? 0}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Capacidad Disponible</p>
                          <p className="text-2xl font-bold text-success-700">{Math.max((metricsTotals?.totalCapacity ?? 0) - (metricsTotals?.totalAppointments ?? 0), 0)}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Semana Más Ocupada</p>
                          <p className="text-2xl font-bold text-warning-700">{metricsTotals?.busiestWeekCitas ?? 0} citas</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsManageOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                  Guardar Cambios
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Locations;
