import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, Users, Settings } from "lucide-react";
import { useAppointmentData } from "@/hooks/useAppointmentData";
import { AnimatedForm, AnimatedInputField, AnimatedSelectField } from "@/components/ui/animated-form";
import { AnimatedButton } from "@/components/ui/animated-button";
import { EnhancedAnimatedPresenceWrapper } from "@/components/ui/enhanced-animated-container";
import { toast } from "sonner";

interface BatchAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchCreated?: (batchId: string, count: number) => void;
}

interface BatchFormData {
  doctor_id: number;
  location_id: number;
  specialty_id: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  slot_duration_minutes: number;
  exclude_weekends: boolean;
  exclude_holidays: boolean;
}

const BatchAvailabilityModal = ({
  isOpen,
  onClose,
  onBatchCreated
}: BatchAvailabilityModalProps) => {
  const { doctors, locations, specialties, fetchLocationSpecialties } = useAppointmentData();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BatchFormData>({
    doctor_id: 0,
    location_id: 0,
    specialty_id: 0,
    start_date: '',
    end_date: '',
    start_time: '08:00',
    end_time: '17:00',
    capacity: 20,
    slot_duration_minutes: 30,
    exclude_weekends: true,
    exclude_holidays: true
  });

  // Validations
  const todayStr = new Date().toISOString().split('T')[0];
  const isStartDatePast = formData.start_date ? (new Date(formData.start_date) < new Date(new Date().toDateString())) : false;
  const isEndDateBeforeStart = formData.start_date && formData.end_date ? (new Date(formData.end_date) < new Date(formData.start_date)) : false;
  const timeOrderInvalid = formData.start_time >= formData.end_time;
  const capacityInvalid = formData.capacity < 1;

  const startDateError = isStartDatePast ? "La fecha de inicio no puede ser en el pasado" : undefined;
  const endDateError = isEndDateBeforeStart ? "La fecha de fin debe ser posterior a la fecha de inicio" : undefined;
  const startTimeError = timeOrderInvalid ? "La hora de inicio debe ser anterior a la hora de fin" : undefined;
  const endTimeError = timeOrderInvalid ? "La hora de fin debe ser posterior a la hora de inicio" : undefined;
  const capacityError = capacityInvalid ? "La capacidad mínima es 1" : undefined;

  const isFormIncomplete = !formData.doctor_id || !formData.location_id || !formData.specialty_id ||
                          !formData.start_date || !formData.end_date || !formData.start_time || !formData.end_time;
  const isFormInvalid = isStartDatePast || isEndDateBeforeStart || timeOrderInvalid || capacityInvalid;
  const disableSubmit = isFormIncomplete || isFormInvalid;

  // Load specialties when location changes
  useEffect(() => {
    if (formData.location_id) {
      fetchLocationSpecialties(formData.location_id);
    }
  }, [formData.location_id, fetchLocationSpecialties]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disableSubmit) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/availabilities/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error creating batch availabilities');
      }

      const result = await response.json();
      toast.success(`Se crearon ${result.created_count} agendas exitosamente`);

      if (onBatchCreated) {
        onBatchCreated(result.batch_id, result.created_count);
      }

      onClose();
    } catch (error: any) {
      console.error('Batch creation error:', error);
      toast.error(error.message || 'Error al crear las agendas');
    } finally {
      setLoading(false);
    }
  };

  const getLocationSpecialtyOptions = () => {
    if (!formData.location_id) return [];

    // Get specialties for the selected location
    const locationSpecialties = specialties.filter(s =>
      locations.find(l => l.id === formData.location_id)?.specialty_ids?.includes(s.id)
    );

    return locationSpecialties.map(s => ({
      value: s.id.toString(),
      label: s.name
    }));
  };

  const getDoctorOptions = () => {
    if (!formData.location_id || !formData.specialty_id) return [];

    return doctors
      .filter(d => d.location_id === formData.location_id && d.specialty_id === formData.specialty_id)
      .map(d => ({
        value: d.id.toString(),
        label: d.name
      }));
  };

  return (
    <EnhancedAnimatedPresenceWrapper>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-medical-600" />
              Crear Agendas por Rango de Fechas
            </DialogTitle>
            <DialogDescription>
              Crea múltiples agendas automáticamente para un rango de fechas, excluyendo fines de semana y feriados
            </DialogDescription>
          </DialogHeader>

          <AnimatedForm
            className="space-y-6"
            onSubmit={handleSubmit}
          >
            {/* Location and Specialty Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatedSelectField
                label="Ubicación"
                placeholder="Selecciona ubicación"
                value={formData.location_id.toString()}
                onChange={(value) => setFormData({
                  ...formData,
                  location_id: parseInt(value),
                  specialty_id: 0,
                  doctor_id: 0
                })}
                options={locations.map((location) => ({
                  value: location.id.toString(),
                  label: `${location.name} - ${location.type}`
                }))}
                required
              />

              <AnimatedSelectField
                label="Especialidad"
                placeholder="Selecciona especialidad"
                value={formData.specialty_id.toString()}
                onChange={(value) => setFormData({
                  ...formData,
                  specialty_id: parseInt(value),
                  doctor_id: 0
                })}
                options={getLocationSpecialtyOptions()}
                disabled={!formData.location_id}
                required
              />
            </div>

            {/* Doctor Selection */}
            <AnimatedSelectField
              label="Médico"
              placeholder="Selecciona médico"
              value={formData.doctor_id.toString()}
              onChange={(value) => setFormData({
                ...formData,
                doctor_id: parseInt(value)
              })}
              options={getDoctorOptions()}
              disabled={!formData.location_id || !formData.specialty_id}
              required
            />

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatedInputField
                label="Fecha de Inicio"
                type="date"
                value={formData.start_date}
                onChange={(value) => setFormData({ ...formData, start_date: value })}
                min={todayStr}
                error={startDateError}
                required
              />

              <AnimatedInputField
                label="Fecha de Fin"
                type="date"
                value={formData.end_date}
                onChange={(value) => setFormData({ ...formData, end_date: value })}
                min={formData.start_date || todayStr}
                error={endDateError}
                required
              />
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatedInputField
                label="Hora de Inicio"
                type="time"
                value={formData.start_time}
                onChange={(value) => setFormData({ ...formData, start_time: value })}
                error={startTimeError}
                required
              />

              <AnimatedInputField
                label="Hora de Fin"
                type="time"
                value={formData.end_time}
                onChange={(value) => setFormData({ ...formData, end_time: value })}
                error={endTimeError}
                required
              />
            </div>

            {/* Capacity and Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatedInputField
                label="Capacidad por Día"
                type="number"
                value={formData.capacity.toString()}
                onChange={(value) => setFormData({ ...formData, capacity: parseInt(value) || 1 })}
                min="1"
                error={capacityError}
                required
              />

              <AnimatedSelectField
                label="Duración de Citas (minutos)"
                value={formData.slot_duration_minutes.toString()}
                onChange={(value) => setFormData({ ...formData, slot_duration_minutes: parseInt(value) })}
                options={[
                  { value: "15", label: "15 minutos" },
                  { value: "20", label: "20 minutos" },
                  { value: "30", label: "30 minutos" },
                  { value: "45", label: "45 minutos" },
                  { value: "60", label: "60 minutos" },
                  { value: "90", label: "90 minutos" },
                  { value: "120", label: "120 minutos" }
                ]}
                required
              />
            </div>

            {/* Exclusion Options */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Opciones de Exclusión
              </h4>

              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.exclude_weekends}
                    onChange={(e) => setFormData({ ...formData, exclude_weekends: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Excluir fines de semana</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.exclude_holidays}
                    onChange={(e) => setFormData({ ...formData, exclude_holidays: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Excluir feriados</span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4">
              <AnimatedButton
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </AnimatedButton>

              <AnimatedButton
                type="submit"
                disabled={disableSubmit || loading}
                loading={loading}
              >
                {loading ? 'Creando Agendas...' : 'Crear Agendas'}
              </AnimatedButton>
            </div>
          </AnimatedForm>
        </DialogContent>
      </Dialog>
    </EnhancedAnimatedPresenceWrapper>
  );
};

export default BatchAvailabilityModal;
