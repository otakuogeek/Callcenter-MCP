import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Filter, Search, X, Zap } from "lucide-react";
import { useAppointmentData, type AvailabilityForm } from "@/hooks/useAppointmentData";
import AppointmentFilters from "./AppointmentFilters";
import AppointmentCalendar from "./AppointmentCalendar";
import EnhancedAppointmentCalendar from "./EnhancedAppointmentCalendar";
import AvailabilityList from "./AvailabilityList";
import CreateAvailabilityModal from "./CreateAvailabilityModal";
import ViewAppointmentsModal from "./ViewAppointmentsModal";
import DistributionCalendar from "./DistributionCalendar";
import SmartAppointmentModal from "./SmartAppointmentModal";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const AppointmentManagement = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isCreateAvailabilityOpen, setIsCreateAvailabilityOpen] = useState(false);
  const [isViewAppointmentsOpen, setIsViewAppointmentsOpen] = useState(false);
  const [isSmartAppointmentOpen, setIsSmartAppointmentOpen] = useState(false);
  const [viewAppointmentsDate, setViewAppointmentsDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"calendar" | "distribution">("calendar");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [enhancedMode] = useState(true);
  const [enhancedFilters, setEnhancedFilters] = useState({
    doctors: [] as number[],
    specialties: [] as number[],
    locations: [] as number[],
    dateRange: { start: '', end: '' },
    status: [] as string[],
    timeRange: { start: '', end: '' },
    searchTerm: ''
  });

  // Auto-cancelación: estado para confirmación y registro
  const [autoCancelOpen, setAutoCancelOpen] = useState(false);
  const [autoCancelCandidates, setAutoCancelCandidates] = useState<Array<{ id: number; label: string }>>([]);
  const [autoCancelProcessing, setAutoCancelProcessing] = useState(false);
  const [autoCancelAlsoAppointments, setAutoCancelAlsoAppointments] = useState(true);
  const [autoCancelLog, setAutoCancelLog] = useState<Array<{ id: number; label: string; when: string; appointmentsCancelled?: number }>>([]);
  const [autoCancelKnown, setAutoCancelKnown] = useState<Set<number>>(new Set());
  
  // Preferencias desde settings
  const [autoCancelSettings, setAutoCancelSettings] = useState<{ auto_cancel_without_confirmation?: boolean; auto_cancel_also_appointments_default?: boolean }>({});

  const { 
    locations, 
    availabilities,
    loadAvailabilities,
    calendarSummary,
    loadCalendarSummary,
    getLocationSpecialties, 
    getActiveLocations,
    addAvailability,
    updateAvailabilityStatus,
    specialtiesAll
  } = useAppointmentData();
  
  const { toast } = useToast();

  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityForm>({
    locationId: "",
    specialty: "",
    doctor: "",
    date: "",
    startTime: "",
    endTime: "",
    capacity: 1,
  notes: "",
  autoPreallocate: false,
  preallocationPublishDate: '',
  autoDistribute: false,
  distributionStartDate: '',
  distributionEndDate: '',
  excludeWeekends: true
  });

  const validateAvailabilityForm = (form: AvailabilityForm): string[] => {
    const errors: string[] = [];
    
    if (!form.locationId) errors.push("Debe seleccionar una ubicación");
    if (!form.specialty) errors.push("Debe seleccionar una especialidad");
    if (!form.doctor) errors.push("Debe seleccionar un doctor");
    if (!form.date) errors.push("Debe seleccionar una fecha");
    if (!form.startTime) errors.push("Debe especificar hora de inicio");
    if (!form.endTime) errors.push("Debe especificar hora de fin");
    
    // Validar que la fecha no sea pasada
    if (form.date && new Date(form.date) < new Date(new Date().toDateString())) {
      errors.push("No puede crear una agenda en una fecha pasada");
    }
    
    // Validar que la hora de fin sea posterior a la de inicio
    if (form.startTime && form.endTime && form.startTime >= form.endTime) {
      errors.push("La hora de fin debe ser posterior a la hora de inicio");
    }
    
    // Validar capacidad
    if (form.capacity < 1) {
      errors.push("La capacidad debe ser al menos 1");
    }
    
    return errors;
  };

  const handleCreateAvailability = async () => {
    if (!availabilityForm) {
      console.error('[handleCreateAvailability] availabilityForm undefined');
      toast({ title: 'Error', description: 'Formulario no inicializado', variant: 'destructive' });
      return;
    }
    const validationErrors = validateAvailabilityForm(availabilityForm);
    
    if (validationErrors.length > 0) {
      toast({ 
        title: 'Datos inválidos', 
        description: validationErrors.join('. '), 
        variant: 'destructive' 
      });
      return;
    }

    let result: any = null;
    try {
      result = await addAvailability(availabilityForm);
    } catch (e: any) {
      console.error('[handleCreateAvailability] addAvailability fallo', e);
      toast({ title: 'Error creando agenda', description: e.message || 'Error inesperado', variant: 'destructive' });
      return;
    }
    if (result !== null) {
      // Solo limpiar el formulario si la operación fue exitosa
      setAvailabilityForm({
        locationId: "",
        specialty: "",
        doctor: "",
        date: "",
        startTime: "",
        endTime: "",
        capacity: 1,
  notes: "",
  autoPreallocate: false,
  preallocationPublishDate: ''
      });
      setIsCreateAvailabilityOpen(false);
    }
  };

  useEffect(() => {
    const d = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    loadAvailabilities(d);
    // También cargar resumen mensual para marcar el calendario
    const ref = date || new Date();
    loadCalendarSummary(ref.getUTCMonth(), ref.getUTCFullYear());
  }, [date, loadAvailabilities, loadCalendarSummary]);

  // Cargar settings globales para auto-cancel
  useEffect(() => {
    (async () => {
      try {
        const s = await api.getSettings();
        setAutoCancelSettings({
          auto_cancel_without_confirmation: !!s?.auto_cancel_without_confirmation,
          auto_cancel_also_appointments_default: s?.auto_cancel_also_appointments_default ?? true,
        });
        if (typeof s?.auto_cancel_also_appointments_default === 'boolean') {
          setAutoCancelAlsoAppointments(!!s.auto_cancel_also_appointments_default);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Auto-refresco cada 90s en el día actual
  useEffect(() => {
    const toYMD = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    const selectedYMD = toYMD(date ?? new Date());
    const todayYMD = toYMD(new Date());
    if (selectedYMD !== todayYMD) return;
    const timer = setInterval(() => {
      loadAvailabilities(selectedYMD);
    }, 90_000);
    return () => clearInterval(timer);
  }, [date, loadAvailabilities]);

  // Filtros activos para mostrar como chips
  const activeFilters = [
    selectedLocation !== "all" && { key: "location", value: selectedLocation, label: `Sede: ${selectedLocation}` },
    selectedSpecialty !== "all" && { key: "specialty", value: selectedSpecialty, label: `Especialidad: ${selectedSpecialty}` },
    selectedStatus !== "all" && { key: "status", value: selectedStatus, label: `Estado: ${selectedStatus}` },
    searchTerm && { key: "search", value: searchTerm, label: `Búsqueda: ${searchTerm}` }
  ].filter(Boolean) as Array<{ key: string; value: string; label: string }>;

  const clearFilter = (filterKey: string) => {
    switch (filterKey) {
      case "location": setSelectedLocation("all"); break;
      case "specialty": setSelectedSpecialty("all"); break;
      case "status": setSelectedStatus("all"); break;
      case "search": setSearchTerm(""); break;
    }
  };

  const clearAllFilters = () => {
    setSelectedLocation("all");
    setSelectedSpecialty("all");
    setSelectedStatus("all");
    setSearchTerm("");
  };

  const filteredAvailabilities = availabilities.filter(availability => {
    if (date) {
      const availabilityDate = new Date(availability.date);
      const selectedDate = new Date(date);
      if (availabilityDate.toDateString() !== selectedDate.toDateString()) {
        return false;
      }
    }

    const matchesSearch = availability.doctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         availability.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         availability.locationName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = selectedLocation === "all" || availability.locationName === selectedLocation;
    const matchesSpecialty = selectedSpecialty === "all" || availability.specialty === selectedSpecialty;
    const matchesStatus = selectedStatus === "all" || availability.status === selectedStatus;
    
    return matchesSearch && matchesLocation && matchesSpecialty && matchesStatus;
  });

  // Detección de agendas vencidas y confirmación antes de cancelar
  useEffect(() => {
    if (autoCancelProcessing) return;
    const now = new Date();
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayYMD = ymd(now);
    const selectedYMD = ymd(date ?? new Date());
    const isPastDay = selectedYMD < todayYMD;
    const isToday = selectedYMD === todayYMD;

    const newCandidates: Array<{ id: number; label: string }> = [];
    for (const a of filteredAvailabilities) {
      if (a.status === 'Cancelada' || a.status === 'Completa') continue;
      if (autoCancelKnown.has(a.id)) continue; // ya procesada o descartada esta sesión
      if (isPastDay) {
        newCandidates.push({ id: a.id, label: `${a.doctor} · ${a.startTime}-${a.endTime} · ${a.locationName}` });
      } else if (isToday) {
        const [eh, em] = a.endTime.split(':').map(Number);
        const end = new Date(now);
        end.setHours(eh, em, 0, 0);
        if (now > end) newCandidates.push({ id: a.id, label: `${a.doctor} · ${a.startTime}-${a.endTime} · ${a.locationName}` });
      }
    }
    if (newCandidates.length) {
      setAutoCancelCandidates(newCandidates);
      // Si está activo "sin confirmación", ejecutar directo; si no, abrir diálogo
      if (autoCancelSettings.auto_cancel_without_confirmation) {
        // Asegurar que el switch refleje el default desde settings
        if (typeof autoCancelSettings.auto_cancel_also_appointments_default === 'boolean') {
          setAutoCancelAlsoAppointments(!!autoCancelSettings.auto_cancel_also_appointments_default);
        }
        // Ejecutar automáticamente
        handleConfirmAutoCancel();
      } else {
        setAutoCancelOpen(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, filteredAvailabilities, autoCancelSettings, autoCancelProcessing]);

  const performAutoCancel = async (
    candidates: Array<{ id: number; label: string }>,
    alsoAppointments: boolean
  ) => {
    setAutoCancelProcessing(true);
    const ids = candidates.map(c => c.id);
    const logs: Array<{ id: number; label: string; when: string; appointmentsCancelled?: number }> = [];
    for (const c of candidates) {
      let apptCancelled = 0;
      try {
        if (alsoAppointments) {
          const appts = await api.getAppointments(undefined, undefined, c.id);
          const toCancel = (appts || []).filter(a => a.status !== 'Cancelada' && a.status !== 'Completada');
          for (const a of toCancel) {
            try {
              await api.updateAppointment(Number(a.id), { status: 'Cancelada', cancel_reason: 'Disponibilidad vencida' });
              apptCancelled += 1;
            } catch {/* ignore single */}
          }
        }
        await updateAvailabilityStatus(c.id, 'Cancelada');
        logs.push({ id: c.id, label: c.label, when: new Date().toISOString(), appointmentsCancelled: apptCancelled });
      } catch {/* ignore */}
    }
    setAutoCancelLog(prev => [...logs, ...prev].slice(0, 20));
    setAutoCancelKnown(prev => new Set([...Array.from(prev), ...ids]));
    setAutoCancelProcessing(false);
    setAutoCancelOpen(false);
    if (logs.length) {
      toast({ title: 'Auto-cancelación completada', description: `${logs.length} agenda(s) canceladas.` });
    }
  };

  const handleConfirmAutoCancel = async () => {
    await performAutoCancel(autoCancelCandidates, autoCancelAlsoAppointments);
  };

  // Funciones para el calendario mejorado
  const handleCreateAvailabilityFromCalendar = (dateString: string) => {
    const targetDate = new Date(dateString + 'T00:00:00');
    setDate(targetDate);
    setAvailabilityForm(prev => ({ ...prev, date: dateString }));
    setIsCreateAvailabilityOpen(true);
  };

  const handleViewAppointmentsFromCalendar = (dateString: string) => {
    setViewAppointmentsDate(dateString);
    setIsViewAppointmentsOpen(true);
  };

  const handleEnhancedFiltersChange = (filters: any) => {
    setEnhancedFilters(filters);
    // Aplicar también a los filtros básicos para compatibilidad
    setSearchTerm(filters.searchTerm || '');
  };

  const handleDismissAutoCancel = () => {
    const ids = autoCancelCandidates.map(c => c.id);
    setAutoCancelKnown(prev => new Set([...Array.from(prev), ...ids]));
    setAutoCancelOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header con diseño mejorado */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-2">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Gestión de Agenda Médica
            </h1>
            <p className="text-gray-600 text-lg font-medium">
              Administra y supervisa las disponibilidades de consultas médicas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "distribution")} className="bg-white/80 backdrop-blur-sm rounded-xl p-1 shadow-lg border border-white/20">
              <TabsList className="grid w-full grid-cols-2 gap-1">
                <TabsTrigger value="calendar" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">Calendario</span>
                </TabsTrigger>
                <TabsTrigger value="distribution" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">Distribución</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button 
              onClick={() => setIsSmartAppointmentOpen(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
              size="lg"
            >
              <Zap className="w-5 h-5" />
              <span className="hidden sm:inline">Nueva Cita</span>
              <span className="sm:hidden">Cita</span>
            </Button>
            
            <Button 
              onClick={() => {
                console.log('Opening create availability modal...');
                setIsCreateAvailabilityOpen(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
              size="lg"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Crear Agenda</span>
              <span className="sm:hidden">Agenda</span>
            </Button>
          </div>
        </div>

        {/* Barra de búsqueda y filtros con diseño premium */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-t-lg">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 max-w-lg">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    placeholder="Buscar por doctor, especialidad o ubicación..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 pr-12 py-3 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl shadow-sm text-base"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={`flex items-center gap-2 border-2 transition-all duration-200 hover:shadow-md ${
                  activeFilters.length > 0 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros {activeFilters.length > 0 && (
                  <Badge className="bg-blue-600 text-white ml-1">{activeFilters.length}</Badge>
                )}
              </Button>
            </div>

            {/* Chips de filtros activos con diseño mejorado */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros activos:
                  </span>
                  {activeFilters.map((filter) => (
                    <Badge
                      key={filter.key}
                      variant="secondary"
                      className="flex items-center gap-2 bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 px-3 py-1"
                    >
                      {filter.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearFilter(filter.key)}
                        className="h-4 w-4 p-0 hover:bg-blue-300 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded-lg"
                  >
                    Limpiar todos
                  </Button>
                </div>
              </div>
            )}

            {/* Panel de filtros expandible con animación */}
            {isFiltersOpen && (
              <>
                <Separator className="my-4" />
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <AppointmentFilters
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    selectedLocation={selectedLocation}
                    setSelectedLocation={setSelectedLocation}
                    selectedSpecialty={selectedSpecialty}
                    setSelectedSpecialty={setSelectedSpecialty}
                    selectedStatus={selectedStatus}
                    setSelectedStatus={setSelectedStatus}
                    getActiveLocations={getActiveLocations}
                    specialties={specialtiesAll}
                    enhancedMode={enhancedMode}
                    doctors={[]}
                    onEnhancedFiltersChange={handleEnhancedFiltersChange}
                  />
                </div>
              </>
            )}
          </CardHeader>
        </Card>

        {/* Contenido principal con tabs mejorado */}
        <Tabs value={viewMode} className="space-y-6">
          <TabsContent value="calendar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-12 gap-6">
              {/* Calendario con diseño responsivo mejorado */}
              <div className="lg:col-span-2 xl:col-span-4 space-y-6">
                <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm">
                  <CardContent className="p-3 lg:p-4">
                    {enhancedMode ? (
                      <EnhancedAppointmentCalendar 
                        date={date} 
                        setDate={setDate} 
                        summary={calendarSummary} 
                        onMonthChange={(m, y) => loadCalendarSummary(m, y)}
                        onCreateAvailability={handleCreateAvailabilityFromCalendar}
                        onViewAppointments={handleViewAppointmentsFromCalendar}
                        selectedFilters={{
                          doctors: enhancedFilters.doctors,
                          specialties: enhancedFilters.specialties,
                          locations: enhancedFilters.locations
                        }}
                      />
                    ) : (
                      <AppointmentCalendar 
                        date={date} 
                        setDate={setDate} 
                        summary={calendarSummary} 
                        onMonthChange={(m, y) => loadCalendarSummary(m, y)} 
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Lista de disponibilidades mejorada */}
              <div className="lg:col-span-3 xl:col-span-8">
                <AvailabilityList 
                  date={date} 
                  filteredAvailabilities={filteredAvailabilities} 
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-6">
            {/* Vista de distribución de cupos */}
            <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Distribución de Cupos
                </CardTitle>
                <p className="text-gray-600">
                  Visualiza la distribución automática de cupos por día y doctor
                </p>
              </CardHeader>
              <CardContent>
                <DistributionCalendar />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal Crear Disponibilidad */}
        <CreateAvailabilityModal
          isOpen={isCreateAvailabilityOpen}
          onClose={() => {
            console.log('Closing modal...');
            setIsCreateAvailabilityOpen(false);
          }}
          availabilityForm={availabilityForm}
          setAvailabilityForm={setAvailabilityForm}
          onCreateAvailability={handleCreateAvailability}
          getActiveLocations={getActiveLocations}
          getLocationSpecialties={getLocationSpecialties}
          locations={locations}
        />

        {/* Modal Ver Citas */}
        <ViewAppointmentsModal
          isOpen={isViewAppointmentsOpen}
          onClose={() => setIsViewAppointmentsOpen(false)}
          date={viewAppointmentsDate}
        />

        {/* Modal Asignación Inteligente de Citas */}
        <SmartAppointmentModal
          isOpen={isSmartAppointmentOpen}
          onClose={() => setIsSmartAppointmentOpen(false)}
          onSuccess={(result) => {
            // Recargar datos después de crear una cita o agregar a cola
            loadAvailabilities();
            loadCalendarSummary();
            
            if (result.assignmentType === 'appointment') {
              toast({
                title: "¡Cita creada exitosamente!",
                description: result.message,
                variant: "default",
              });
            } else {
              toast({
                title: "Agregado a cola de espera",
                description: result.message,
                variant: "default",
              });
            }
          }}
        />

        {/* Confirmación de auto-cancelación */}
        <Dialog open={autoCancelOpen} onOpenChange={(o) => !autoCancelProcessing && setAutoCancelOpen(o)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar agendas vencidas</DialogTitle>
              <DialogDescription>
                Se detectaron agendas vencidas para la fecha seleccionada. ¿Deseas cancelarlas automáticamente?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-60 overflow-auto border rounded-md p-2 bg-gray-50">
              {autoCancelCandidates.map(c => (
                <div key={c.id} className="text-sm text-gray-700">• {c.label}</div>
              ))}
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="also-appts" className="text-sm">Cancelar también citas asociadas</Label>
              <Switch id="also-appts" checked={autoCancelAlsoAppointments} onCheckedChange={setAutoCancelAlsoAppointments as any} />
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={autoCancelProcessing} onClick={handleDismissAutoCancel}>Omitir</Button>
              <Button onClick={handleConfirmAutoCancel} disabled={autoCancelProcessing}>
                {autoCancelProcessing ? 'Cancelando…' : 'Cancelar ahora'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Registro simple de auto-cancelaciones */}
        {autoCancelLog.length > 0 && (
          <Card className="border-0 shadow-md bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Registro de auto-cancelaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-gray-700">
              {autoCancelLog.map(item => (
                <div key={item.id + item.when} className="flex items-center justify-between">
                  <div className="truncate mr-2">{item.label}</div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">{new Date(item.when).toLocaleString()}</div>
                  {typeof item.appointmentsCancelled === 'number' && (
                    <Badge variant="secondary" className="ml-2">Citas canceladas: {item.appointmentsCancelled}</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AppointmentManagement;
