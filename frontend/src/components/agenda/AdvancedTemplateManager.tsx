import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  CalendarDays, 
  Clock, 
  Users, 
  MapPin, 
  Stethoscope,
  Plus,
  Trash2,
  Copy,
  Save,
  RefreshCw,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
}

interface TemplateData {
  id?: string;
  name: string;
  description: string;
  doctor_id: number;
  specialty_id: number;
  location_id: number;
  duration_minutes: number;
  time_slots: TimeSlot[];
  days_of_week: number[]; // 0=Sunday, 1=Monday, etc.
  is_active: boolean;
}

interface QuickTemplate {
  name: string;
  description: string;
  slots: Omit<TimeSlot, 'id'>[];
  duration: number;
}

const AdvancedTemplateManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Quick templates para diferentes especialidades
  const quickTemplates: QuickTemplate[] = [
    {
      name: "Medicina General - Estándar",
      description: "Consultas de medicina general cada 30 minutos",
      duration: 30,
      slots: [
        { start_time: "08:00", end_time: "12:00", capacity: 1 },
        { start_time: "14:00", end_time: "18:00", capacity: 1 }
      ]
    },
    {
      name: "Cardiología - Intensivo",
      description: "Consultas especializadas de 45 minutos",
      duration: 45,
      slots: [
        { start_time: "08:00", end_time: "11:15", capacity: 1 },
        { start_time: "14:00", end_time: "17:15", capacity: 1 }
      ]
    },
    {
      name: "Pediatría - Familiar",
      description: "Consultas pediátricas con tiempo extendido",
      duration: 20,
      slots: [
        { start_time: "08:00", end_time: "12:00", capacity: 1 },
        { start_time: "15:00", end_time: "18:00", capacity: 1 }
      ]
    },
    {
      name: "Consultorios Múltiples",
      description: "Múltiples consultorios en paralelo",
      duration: 30,
      slots: [
        { start_time: "08:00", end_time: "12:00", capacity: 3 },
        { start_time: "14:00", end_time: "18:00", capacity: 3 }
      ]
    }
  ];

  const [formData, setFormData] = useState<TemplateData>({
    name: '',
    description: '',
    doctor_id: 0,
    specialty_id: 0,
    location_id: 0,
    duration_minutes: 30,
    time_slots: [{ id: '1', start_time: '08:00', end_time: '12:00', capacity: 1 }],
    days_of_week: [1, 2, 3, 4, 5], // Monday to Friday
    is_active: true
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [doctorsRes, specialtiesRes, locationsRes, templatesRes] = await Promise.all([
        api.getDoctors(),
        api.getSpecialties(),
        api.getLocations(),
        api.getAvailabilityTemplates?.() || Promise.resolve([])
      ]);

      setDoctors(doctorsRes || []);
      setSpecialties(specialtiesRes || []);
      setLocations(locationsRes || []);
      setTemplates(templatesRes || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos iniciales",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTimeSlot = () => {
    const newSlot: TimeSlot = {
      id: Date.now().toString(),
      start_time: '08:00',
      end_time: '12:00',
      capacity: 1
    };
    setFormData(prev => ({
      ...prev,
      time_slots: [...prev.time_slots, newSlot]
    }));
  };

  const handleRemoveTimeSlot = (id: string) => {
    setFormData(prev => ({
      ...prev,
      time_slots: prev.time_slots.filter(slot => slot.id !== id)
    }));
  };

  const handleTimeSlotChange = (id: string, field: keyof TimeSlot, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      time_slots: prev.time_slots.map(slot =>
        slot.id === id ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const applyQuickTemplate = (template: QuickTemplate) => {
    const slotsWithIds = template.slots.map((slot, index) => ({
      ...slot,
      id: `quick_${Date.now()}_${index}`
    }));

    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      duration_minutes: template.duration,
      time_slots: slotsWithIds
    }));

    toast({
      title: "Plantilla Aplicada",
      description: `Se aplicó la plantilla: ${template.name}`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la plantilla es requerido",
        variant: "destructive"
      });
      return;
    }

    if (formData.time_slots.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un horario",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (editingTemplate) {
        // Update existing template
        await api.updateAvailabilityTemplate?.(editingTemplate.id!, formData);
        toast({
          title: "Éxito",
          description: "Plantilla actualizada correctamente",
        });
      } else {
        // Create new template
        await api.createAvailabilityTemplate?.(formData);
        toast({
          title: "Éxito",
          description: "Plantilla creada correctamente",
        });
      }

      // Reset form and reload templates
      resetForm();
      await loadInitialData();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la plantilla",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      doctor_id: 0,
      specialty_id: 0,
      location_id: 0,
      duration_minutes: 30,
      time_slots: [{ id: '1', start_time: '08:00', end_time: '12:00', capacity: 1 }],
      days_of_week: [1, 2, 3, 4, 5],
      is_active: true
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleEdit = (template: TemplateData) => {
    setFormData(template);
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('¿Está seguro de eliminar esta plantilla?')) return;

    try {
      await api.deleteAvailabilityTemplate?.(templateId);
      toast({
        title: "Éxito",
        description: "Plantilla eliminada correctamente",
      });
      await loadInitialData();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla",
        variant: "destructive"
      });
    }
  };

  const handleDuplicate = (template: TemplateData) => {
    const duplicated = {
      ...template,
      name: `${template.name} (Copia)`,
      id: undefined
    };
    setFormData(duplicated);
    setEditingTemplate(null);
    setShowForm(true);
  };

  const generateScheduleFromTemplate = async (template: TemplateData) => {
    const startDate = prompt('Fecha de inicio (YYYY-MM-DD):');
    const endDate = prompt('Fecha de fin (YYYY-MM-DD):');
    
    if (!startDate || !endDate) return;

    try {
      setLoading(true);
      await api.generateScheduleFromTemplate?.({
        template_id: template.id!,
        start_date: startDate,
        end_date: endDate
      });
      
      toast({
        title: "Éxito",
        description: "Agenda generada desde la plantilla",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar la agenda",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (dayIndex: number) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days[dayIndex];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Plantillas de Agenda</h2>
          <p className="text-gray-600 mt-1">Gestiona plantillas reutilizables para crear agendas rápidamente</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {/* Quick Templates */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Plantillas Rápidas
            </CardTitle>
            <CardDescription>
              Aplica una plantilla predefinida para empezar rápidamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickTemplates.map((template, index) => (
                <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200">
                  <CardContent className="p-4" onClick={() => applyQuickTemplate(template)}>
                    <h4 className="font-semibold text-sm mb-2">{template.name}</h4>
                    <p className="text-xs text-gray-600 mb-3">{template.description}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.duration} min
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {template.slots.length} horarios
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre de la Plantilla</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Consulta General Mañana"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duración por Cita (minutos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="15"
                    max="120"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción opcional de la plantilla"
                  rows={3}
                />
              </div>

              {/* Assignments */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="doctor">Doctor</Label>
                  <Select value={formData.doctor_id.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, doctor_id: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Cualquier doctor</SelectItem>
                      {doctors.map(doctor => (
                        <SelectItem key={doctor.id} value={doctor.id.toString()}>
                          {doctor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="specialty">Especialidad</Label>
                  <Select value={formData.specialty_id.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, specialty_id: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Cualquier especialidad</SelectItem>
                      {specialties.map(specialty => (
                        <SelectItem key={specialty.id} value={specialty.id.toString()}>
                          {specialty.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Ubicación</Label>
                  <Select value={formData.location_id.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ubicación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Cualquier ubicación</SelectItem>
                      {locations.map(location => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label>Horarios de Atención</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTimeSlot}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar Horario
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.time_slots.map(slot => (
                    <div key={slot.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Hora Inicio</Label>
                          <Input
                            type="time"
                            value={slot.start_time}
                            onChange={(e) => handleTimeSlotChange(slot.id, 'start_time', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Hora Fin</Label>
                          <Input
                            type="time"
                            value={slot.end_time}
                            onChange={(e) => handleTimeSlotChange(slot.id, 'end_time', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Capacidad</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={slot.capacity}
                            onChange={(e) => handleTimeSlotChange(slot.id, 'capacity', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      {formData.time_slots.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveTimeSlot(slot.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Days of Week */}
              <div>
                <Label className="mb-3 block">Días de la Semana</Label>
                <div className="flex gap-2 flex-wrap">
                  {[0, 1, 2, 3, 4, 5, 6].map(day => (
                    <Button
                      key={day}
                      type="button"
                      variant={formData.days_of_week.includes(day) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          days_of_week: prev.days_of_week.includes(day)
                            ? prev.days_of_week.filter(d => d !== day)
                            : [...prev.days_of_week, day].sort()
                        }));
                      }}
                    >
                      {getDayName(day)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Guardando...' : 'Guardar Plantilla'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Plantillas Existentes</CardTitle>
          <CardDescription>
            Gestiona tus plantillas guardadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando plantillas...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No hay plantillas</h4>
              <p className="text-gray-600">Crea tu primera plantilla para comenzar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(template => (
                <Card key={template.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-1">{template.name}</h4>
                        <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                        <div className="flex items-center gap-1 mb-1">
                          <Badge variant={template.is_active ? "default" : "secondary"}>
                            {template.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>{template.duration_minutes} min por cita</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-gray-500" />
                        <span>{template.time_slots.length} horarios</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span>{template.days_of_week.map(d => getDayName(d)).join(', ')}</span>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDuplicate(template)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => generateScheduleFromTemplate(template)}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(template.id!)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedTemplateManager;
