import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  Calendar,
  Clock,
  Copy,
  Edit,
  Plus,
  FileText,
  Trash2,
  Users,
  MapPin,
  TrendingUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { EnhancedStaggerContainer, EnhancedStaggerChild } from '@/components/ui/enhanced-animated-container';

interface AgendaTemplate {
  id: string;
  name: string;
  description?: string;
  schedule_pattern: any;
  default_doctor_id?: number;
  default_location_id?: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Doctor {
  id: number;
  name: string;
}

interface Location {
  id: number;
  name: string;
}

const AgendaTemplatesManager = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<AgendaTemplate[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<AgendaTemplate | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [usageStats, setUsageStats] = useState<any>(null);

  // Formulario para crear/editar plantilla
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule_pattern: {
      days_of_week: [] as number[],
      time_slots: [] as { start_time: string; end_time: string; capacity: number }[],
      recurring: true
    },
    default_doctor_id: '',
    default_location_id: ''
  });

  // Formulario para aplicar plantilla
  const [applyData, setApplyData] = useState({
    template_id: '',
    start_date: '',
    end_date: '',
    doctor_ids: [] as number[],
    location_ids: [] as number[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesRes, doctorsRes, locationsRes, statsRes] = await Promise.all([
        api.agendaTemplates.getAll(),
        api.getDoctors(),
        api.getLocations(),
        api.agendaTemplates.getUsageStats().catch(() => null)
      ]);

      // Validaciones defensivas para asegurar que son arrays
      setTemplates(Array.isArray(templatesRes?.data) ? templatesRes.data : 
                   Array.isArray(templatesRes) ? templatesRes : []);
      setDoctors(Array.isArray(doctorsRes?.data) ? doctorsRes.data : 
                 Array.isArray(doctorsRes) ? doctorsRes : []);
      setLocations(Array.isArray(locationsRes?.data) ? locationsRes.data : 
                   Array.isArray(locationsRes) ? locationsRes : []);
      setUsageStats(statsRes);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las plantillas de agenda',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const dataToSend = {
        ...formData,
        default_doctor_id: formData.default_doctor_id ? parseInt(formData.default_doctor_id) : null,
        default_location_id: formData.default_location_id ? parseInt(formData.default_location_id) : null
      };

      await api.agendaTemplates.create(dataToSend);
      
      toast({
        title: 'Éxito',
        description: 'Plantilla de agenda creada correctamente'
      });

      setIsCreateModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear la plantilla',
        variant: 'destructive'
      });
    }
  };

  const handleApplyTemplate = async () => {
    try {
      await api.agendaTemplates.apply(applyData);
      
      toast({
        title: 'Éxito',
        description: 'Plantilla aplicada correctamente a la agenda'
      });

      setIsApplyModalOpen(false);
      resetApplyForm();
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo aplicar la plantilla',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) return;

    try {
      await api.agendaTemplates.delete(templateId);
      
      toast({
        title: 'Éxito',
        description: 'Plantilla eliminada correctamente'
      });

      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la plantilla',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      schedule_pattern: {
        days_of_week: [],
        time_slots: [],
        recurring: true
      },
      default_doctor_id: '',
      default_location_id: ''
    });
  };

  const resetApplyForm = () => {
    setApplyData({
      template_id: '',
      start_date: '',
      end_date: '',
      doctor_ids: [],
      location_ids: []
    });
  };

  const addTimeSlot = () => {
    setFormData(prev => ({
      ...prev,
      schedule_pattern: {
        ...prev.schedule_pattern,
        time_slots: [
          ...prev.schedule_pattern.time_slots,
          { start_time: '08:00', end_time: '17:00', capacity: 10 }
        ]
      }
    }));
  };

  const removeTimeSlot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      schedule_pattern: {
        ...prev.schedule_pattern,
        time_slots: prev.schedule_pattern.time_slots.filter((_, i) => i !== index)
      }
    }));
  };

  const updateTimeSlot = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      schedule_pattern: {
        ...prev.schedule_pattern,
        time_slots: prev.schedule_pattern.time_slots.map((slot, i) =>
          i === index ? { ...slot, [field]: value } : slot
        )
      }
    }));
  };

  const toggleDayOfWeek = (day: number) => {
    setFormData(prev => ({
      ...prev,
      schedule_pattern: {
        ...prev.schedule_pattern,
        days_of_week: prev.schedule_pattern.days_of_week.includes(day)
          ? prev.schedule_pattern.days_of_week.filter(d => d !== day)
          : [...prev.schedule_pattern.days_of_week, day]
      }
    }));
  };

  const daysOfWeek = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Plantillas de Agenda</h2>
          <p className="text-muted-foreground">
            Gestiona y aplica plantillas reutilizables para la programación de horarios
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Plantilla
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Plantilla</DialogTitle>
              <DialogDescription>
                Define un patrón de horarios reutilizable para múltiples médicos y ubicaciones
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre de la plantilla</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Horario Estándar Mañana"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción de la plantilla"
                  />
                </div>
              </div>

              {/* Días de la semana */}
              <div>
                <Label>Días de la semana</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {daysOfWeek.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={formData.schedule_pattern.days_of_week.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDayOfWeek(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Horarios */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>Horarios de atención</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addTimeSlot}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar horario
                  </Button>
                </div>
                <div className="space-y-2 mt-2">
                  {formData.schedule_pattern.time_slots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <div className="flex-1">
                        <Label className="text-xs">Inicio</Label>
                        <Input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => updateTimeSlot(index, 'start_time', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Fin</Label>
                        <Input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => updateTimeSlot(index, 'end_time', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Capacidad</Label>
                        <Input
                          type="number"
                          value={slot.capacity}
                          onChange={(e) => updateTimeSlot(index, 'capacity', parseInt(e.target.value) || 0)}
                          min="1"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTimeSlot(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configuración por defecto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="default_doctor">Médico por defecto (opcional)</Label>
                  <Select value={formData.default_doctor_id} onValueChange={(value) => setFormData(prev => ({ ...prev, default_doctor_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar médico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin médico específico</SelectItem>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id.toString()}>
                          {doctor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="default_location">Ubicación por defecto (opcional)</Label>
                  <Select value={formData.default_location_id} onValueChange={(value) => setFormData(prev => ({ ...prev, default_location_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ubicación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin ubicación específica</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTemplate} disabled={!formData.name || formData.schedule_pattern.time_slots.length === 0}>
                Crear Plantilla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            Plantillas
          </TabsTrigger>
          <TabsTrigger value="stats">
            <TrendingUp className="h-4 w-4 mr-2" />
            Estadísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <EnhancedStaggerContainer>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <EnhancedStaggerChild key={template.id}>
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          {template.description && (
                            <CardDescription className="mt-1">
                              {template.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {template.schedule_pattern?.days_of_week?.length || 0} días
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {template.schedule_pattern?.time_slots?.length || 0} horarios
                        </div>
                        <div className="flex items-center gap-1">
                          <Copy className="h-4 w-4" />
                          {template.usage_count} usos
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Dialog open={isApplyModalOpen && applyData.template_id === template.id} onOpenChange={(open) => {
                          setIsApplyModalOpen(open);
                          if (open) {
                            setApplyData(prev => ({ ...prev, template_id: template.id }));
                          } else {
                            resetApplyForm();
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="flex-1">
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Aplicar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Aplicar Plantilla: {template.name}</DialogTitle>
                              <DialogDescription>
                                Configura el rango de fechas y los recursos donde aplicar esta plantilla
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="start_date">Fecha de inicio</Label>
                                  <Input
                                    id="start_date"
                                    type="date"
                                    value={applyData.start_date}
                                    onChange={(e) => setApplyData(prev => ({ ...prev, start_date: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="end_date">Fecha de fin</Label>
                                  <Input
                                    id="end_date"
                                    type="date"
                                    value={applyData.end_date}
                                    onChange={(e) => setApplyData(prev => ({ ...prev, end_date: e.target.value }))}
                                  />
                                </div>
                              </div>

                              <div>
                                <Label>Médicos (opcional - dejar vacío para aplicar a todos)</Label>
                                <Select onValueChange={(value) => {
                                  const doctorId = parseInt(value);
                                  if (!applyData.doctor_ids.includes(doctorId)) {
                                    setApplyData(prev => ({
                                      ...prev,
                                      doctor_ids: [...prev.doctor_ids, doctorId]
                                    }));
                                  }
                                }}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar médicos" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {doctors.map((doctor) => (
                                      <SelectItem key={doctor.id} value={doctor.id.toString()}>
                                        {doctor.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {applyData.doctor_ids.map((doctorId) => {
                                    const doctor = doctors.find(d => d.id === doctorId);
                                    return (
                                      <Badge key={doctorId} variant="secondary" className="text-xs">
                                        {doctor?.name}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 ml-1"
                                          onClick={() => setApplyData(prev => ({
                                            ...prev,
                                            doctor_ids: prev.doctor_ids.filter(id => id !== doctorId)
                                          }))}
                                        >
                                          ×
                                        </Button>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>

                              <div>
                                <Label>Ubicaciones (opcional - dejar vacío para aplicar a todas)</Label>
                                <Select onValueChange={(value) => {
                                  const locationId = parseInt(value);
                                  if (!applyData.location_ids.includes(locationId)) {
                                    setApplyData(prev => ({
                                      ...prev,
                                      location_ids: [...prev.location_ids, locationId]
                                    }));
                                  }
                                }}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar ubicaciones" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {locations.map((location) => (
                                      <SelectItem key={location.id} value={location.id.toString()}>
                                        {location.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {applyData.location_ids.map((locationId) => {
                                    const location = locations.find(l => l.id === locationId);
                                    return (
                                      <Badge key={locationId} variant="secondary" className="text-xs">
                                        {location?.name}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 ml-1"
                                          onClick={() => setApplyData(prev => ({
                                            ...prev,
                                            location_ids: prev.location_ids.filter(id => id !== locationId)
                                          }))}
                                        >
                                          ×
                                        </Button>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsApplyModalOpen(false)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleApplyTemplate} disabled={!applyData.start_date || !applyData.end_date}>
                                Aplicar Plantilla
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Button variant="outline" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </EnhancedStaggerChild>
              ))}
            </div>
          </EnhancedStaggerContainer>

          {templates.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No hay plantillas creadas</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crea tu primera plantilla para agilizar la programación de horarios
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Plantilla
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {usageStats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Plantillas
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageStats.total_templates || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {usageStats.active_templates || 0} activas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Usos Este Mes
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageStats.monthly_usage || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    +{usageStats.usage_growth || 0}% vs mes anterior
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Más Usada
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">{usageStats.most_used?.name || 'N/A'}</div>
                  <p className="text-xs text-muted-foreground">
                    {usageStats.most_used?.usage_count || 0} usos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Tiempo Ahorrado
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageStats.time_saved_hours || 0}h</div>
                  <p className="text-xs text-muted-foreground">
                    Este mes
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgendaTemplatesManager;
