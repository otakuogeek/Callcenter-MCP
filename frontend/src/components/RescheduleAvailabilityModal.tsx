import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface RescheduleAvailabilityModalProps {
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
    booked_slots?: number;
  } | null;
  onSave?: () => void;
}

const RescheduleAvailabilityModal = ({ 
  isOpen, 
  onClose, 
  availability, 
  onSave 
}: RescheduleAvailabilityModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

  const handleReschedule = async () => {
    if (!availability) return;

    if (!newDate || !newStartTime || !newEndTime) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (newStartTime >= newEndTime) {
      toast({
        title: "Error",
        description: "La hora de inicio debe ser anterior a la hora de fin",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await api.updateAvailability(availability.id, {
        date: newDate,
        start_time: newStartTime,
        end_time: newEndTime,
      });

      toast({
        title: "Éxito",
        description: "Agenda reagendada correctamente",
      });

      if (onSave) onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo reagendar la agenda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!availability) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-blue-600">
            <Calendar className="w-5 h-5" />
            Reagendar Agenda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Información actual */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h4 className="font-semibold text-gray-800 mb-2">Agenda Actual</h4>
            <div className="text-sm space-y-1">
              <div><strong>Doctor:</strong> {availability.doctor_name}</div>
              <div><strong>Fecha:</strong> {availability.date}</div>
              <div><strong>Horario:</strong> {availability.start_time} - {availability.end_time}</div>
              {availability.booked_slots && availability.booked_slots > 0 && (
                <div className="text-orange-600">
                  <strong>⚠️ Citas afectadas:</strong> {availability.booked_slots} pacientes
                </div>
              )}
            </div>
          </div>

          {/* Nueva fecha y horario */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="new_date">Nueva Fecha</Label>
              <Input
                id="new_date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} // No permitir fechas pasadas
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new_start_time">Hora de Inicio</Label>
                <Input
                  id="new_start_time"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="new_end_time">Hora de Fin</Label>
                <Input
                  id="new_end_time"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {availability.booked_slots && availability.booked_slots > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-sm text-yellow-800">
                <strong>💡 Nota:</strong> Al reagendar esta agenda, se notificará automáticamente 
                a los {availability.booked_slots} pacientes que tienen citas programadas.
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleReschedule} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Reagendando...' : 'Reagendar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleAvailabilityModal;
