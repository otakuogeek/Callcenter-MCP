import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stethoscope, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface EditAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  availability: {
    id: number;
    doctor_name: string;
    specialty_name: string;
    location_name: string;
    date: string;
    start_time: string;
    end_time: string;
    capacity: number;
    status: string;
    notes?: string;
    doctor_id: number;
    specialty_id: number;
    location_id: number;
  } | null;
  onSave?: () => void;
}

const EditAvailabilityModal = ({ 
  isOpen, 
  onClose, 
  availability, 
  onSave 
}: EditAvailabilityModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    doctor_id: 0,
    specialty_id: 0,
    location_id: 0,
    date: '',
    start_time: '',
    end_time: '',
    capacity: 1,
    status: 'Activa',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadBasicData();
      if (availability) {
        console.log("🔧 Availability recibida para editar:", availability);
        
        // Formatear las horas correctamente (de HH:MM:SS a HH:MM)
        const formatTime = (timeStr: string) => {
          if (!timeStr) return '';
          // Si viene como HH:MM:SS, lo convertimos a HH:MM
          if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            return `${parts[0]}:${parts[1]}`;
          }
          return timeStr;
        };
        
        setFormData({
          doctor_id: availability.doctor_id || 0,
          specialty_id: availability.specialty_id || 0,
          location_id: availability.location_id || 0,
          date: availability.date || '',
          start_time: formatTime(availability.start_time || ''),
          end_time: formatTime(availability.end_time || ''),
          capacity: availability.capacity || 1,
          status: availability.status || 'Activa',
          notes: availability.notes || ''
        });
        
        console.log("📝 FormData después del mapeo:", {
          doctor_id: availability.doctor_id,
          specialty_id: availability.specialty_id,
          location_id: availability.location_id,
          date: availability.date,
          start_time: formatTime(availability.start_time || ''),
          end_time: formatTime(availability.end_time || ''),
        });
      }
    }
  }, [isOpen, availability]);

  const loadBasicData = async () => {
    try {
      const [doctorsData, specialtiesData, locationsData] = await Promise.all([
        api.getDoctors(),
        api.getSpecialties(),
        api.getLocations()
      ]);
      
      console.log("👨‍⚕️ Doctores cargados:", doctorsData);
      console.log("🏥 Especialidades cargadas:", specialtiesData);
      console.log("📍 Ubicaciones cargadas:", locationsData);
      
      setDoctors(doctorsData || []);
      setSpecialties(specialtiesData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error("❌ Error cargando datos básicos:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos básicos",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!availability) return;

    console.log('Saving with formData:', formData); // Debug

    if (!formData.doctor_id || !formData.specialty_id || !formData.location_id || 
        !formData.date || !formData.start_time || !formData.end_time || 
        formData.capacity < 1) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (formData.start_time >= formData.end_time) {
      toast({
        title: "Error",
        description: "La hora de inicio debe ser anterior a la hora de fin",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        doctor_id: Number(formData.doctor_id),
        specialty_id: Number(formData.specialty_id),
        location_id: Number(formData.location_id),
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        capacity: Number(formData.capacity),
        status: formData.status,
        notes: formData.notes || null
      };

      console.log('Updating availability with:', updateData); // Debug

      await api.updateAvailability(availability.id, updateData);

      toast({
        title: "Éxito",
        description: "Agenda actualizada correctamente",
      });

      if (onSave) onSave();
      onClose();
    } catch (error: any) {
      console.error('Error updating availability:', error); // Debug
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la agenda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!availability) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-blue-600">
            <Stethoscope className="w-5 h-5" />
            Editar Agenda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Información actual */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Información Actual</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Doctor:</span> {availability.doctor_name || 'No especificado'}</div>
              <div><span className="font-medium">Especialidad:</span> {availability.specialty_name || 'No especificada'}</div>
              <div><span className="font-medium">Ubicación:</span> {availability.location_name || 'No especificada'}</div>
              <div><span className="font-medium">Fecha:</span> {availability.date || 'No especificada'}</div>
              <div><span className="font-medium">Horario:</span> {availability.start_time || 'No especificado'} - {availability.end_time || 'No especificado'}</div>
              <div><span className="font-medium">Capacidad:</span> {availability.capacity || 0} pacientes</div>
            </div>
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <strong>Debug Info:</strong>
              <div>doctor_id: {availability.doctor_id || 'undefined'}</div>
              <div>specialty_id: {availability.specialty_id || 'undefined'}</div>
              <div>location_id: {availability.location_id || 'undefined'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Doctor */}
            <div className="space-y-2">
              <Label htmlFor="doctor">Doctor</Label>
              <Select
                value={formData.doctor_id > 0 ? String(formData.doctor_id) : ""}
                onValueChange={(value) => {
                  console.log("🧑‍⚕️ Doctor seleccionado:", value);
                  setFormData(prev => ({ ...prev, doctor_id: Number(value) }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={String(doctor.id)}>
                      {doctor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Especialidad */}
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidad</Label>
              <Select
                value={formData.specialty_id > 0 ? String(formData.specialty_id) : ""}
                onValueChange={(value) => {
                  console.log("🏥 Especialidad seleccionada:", value);
                  setFormData(prev => ({ ...prev, specialty_id: Number(value) }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar especialidad" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((specialty) => (
                    <SelectItem key={specialty.id} value={String(specialty.id)}>
                      {specialty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ubicación */}
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Select
                value={formData.location_id > 0 ? String(formData.location_id) : ""}
                onValueChange={(value) => {
                  console.log("📍 Ubicación seleccionada:", value);
                  setFormData(prev => ({ ...prev, location_id: Number(value) }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={String(location.id)}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activa">Activa</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                  <SelectItem value="Completa">Completa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Capacidad */}
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacidad (pacientes)</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="100"
                value={formData.capacity}
                onChange={(e) => setFormData(prev => ({ ...prev, capacity: Number(e.target.value) }))}
              />
            </div>

            {/* Hora inicio */}
            <div className="space-y-2">
              <Label htmlFor="start_time">Hora de Inicio</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>

            {/* Hora fin */}
            <div className="space-y-2">
              <Label htmlFor="end_time">Hora de Fin</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionales sobre la agenda..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditAvailabilityModal;
