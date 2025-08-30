import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type { AvailabilityForm, Location } from "@/hooks/useAppointmentData";
import { useAppointmentData } from "@/hooks/useAppointmentData";
import { AnimatedForm, AnimatedInputField, AnimatedSelectField, AnimatedTextareaField } from "@/components/ui/animated-form";
import { AnimatedButton } from "@/components/ui/animated-button";
import { EnhancedAnimatedPresenceWrapper } from "@/components/ui/enhanced-animated-container";

interface CreateAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  availabilityForm: AvailabilityForm;
  setAvailabilityForm: React.Dispatch<React.SetStateAction<AvailabilityForm>>;
  onCreateAvailability: () => void;
  getActiveLocations: () => Location[];
  getLocationSpecialties: (locationId: string) => string[];
  locations: Location[];
}

const CreateAvailabilityModal = ({
  isOpen,
  onClose,
  availabilityForm,
  setAvailabilityForm,
  onCreateAvailability,
  getActiveLocations,
  getLocationSpecialties,
  locations
}: CreateAvailabilityModalProps) => {
  const { doctors, fetchLocationSpecialties, getLocationSpecialtyOptions } = useAppointmentData();
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  
  // Validaciones locales y restricciones nativas
  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDate = availabilityForm.date ? (new Date(availabilityForm.date) < new Date(new Date().toDateString())) : false;
  const timeOrderInvalid = !!(availabilityForm.startTime && availabilityForm.endTime && availabilityForm.startTime >= availabilityForm.endTime);
  const capacityInvalid = availabilityForm.capacity < 1;

  const dateError = isPastDate ? "No puede crear una agenda en una fecha pasada" : undefined;
  const startTimeError = timeOrderInvalid ? "La hora de inicio debe ser anterior a la hora de fin" : undefined;
  const endTimeError = timeOrderInvalid ? "La hora de fin debe ser posterior a la hora de inicio" : undefined;
  const capacityError = capacityInvalid ? "La capacidad mínima es 1" : undefined;

  const isFormIncomplete = !availabilityForm.locationId || !availabilityForm.specialty || !availabilityForm.doctor || !availabilityForm.date || !availabilityForm.startTime || !availabilityForm.endTime;
  const isFormInvalid = isPastDate || timeOrderInvalid || capacityInvalid;
  const disableSubmit = isFormIncomplete || isFormInvalid;

  useEffect(() => {
    const locId = Number(availabilityForm.locationId);
    if (!locId) return;
    if (getLocationSpecialties(String(locId)).length > 0) return; // cache
    setLoadingSpecs(true);
    fetchLocationSpecialties(locId).finally(() => setLoadingSpecs(false));
  }, [availabilityForm.locationId]);

  return (
    <EnhancedAnimatedPresenceWrapper>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-medical-600" />
              Crear Agenda en Ubicación
            </DialogTitle>
            <DialogDescription>
              Configura horarios disponibles para citas en una ubicación específica
            </DialogDescription>
          </DialogHeader>

          <AnimatedForm 
            className="space-y-4 sm:space-y-6"
            onSubmit={(e) => { e.preventDefault(); if (!disableSubmit) onCreateAvailability(); }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatedSelectField
                label="Ubicación"
                placeholder="Selecciona una ubicación"
                value={availabilityForm.locationId}
                onChange={(value) => setAvailabilityForm({ ...availabilityForm, locationId: value, specialty: "" })}
                options={getActiveLocations().map((location) => ({
                  value: location.id.toString(),
                  label: `${location.name} - ${location.type}`
                }))}
                required
              />
              
              <AnimatedSelectField
                label="Especialidad"
                placeholder={loadingSpecs ? "Cargando..." : "Selecciona especialidad"}
                value={availabilityForm.specialty}
                onChange={(value) => setAvailabilityForm({ ...availabilityForm, specialty: value })}
                options={getLocationSpecialtyOptions(availabilityForm.locationId).map((opt) => ({
                  value: String(opt.id),
                  label: opt.name
                }))}
                disabled={!availabilityForm.locationId}
                required
              />
            </div>

            {availabilityForm.locationId && (
              <div className="p-3 bg-medical-50 rounded-lg border border-medical-200">
                <p className="font-medium text-medical-700 text-sm mb-1">Horarios de la ubicación:</p>
                <p className="text-xs text-medical-600">
                  {locations.find(loc => loc.id.toString() === availabilityForm.locationId)?.hours}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatedSelectField
                label="Doctor/Profesional"
                placeholder="Selecciona doctor"
                value={availabilityForm.doctor}
                onChange={(value) => setAvailabilityForm({ ...availabilityForm, doctor: value })}
                options={doctors.map((d) => ({
                  value: String(d.id),
                  label: d.name
                }))}
                required
              />

              <AnimatedInputField
                label="Fecha"
                type="date"
                value={availabilityForm.date}
                onChange={(value) => setAvailabilityForm({...availabilityForm, date: value})}
                error={dateError}
                inputProps={{ min: todayStr }}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AnimatedInputField
                label="Hora Inicio"
                type="time"
                value={availabilityForm.startTime}
                onChange={(value) => setAvailabilityForm({...availabilityForm, startTime: value})}
                error={startTimeError}
                inputProps={{ step: 300, max: availabilityForm.endTime || undefined }}
                required
              />

              <AnimatedInputField
                label="Hora Fin"
                type="time"
                value={availabilityForm.endTime}
                onChange={(value) => setAvailabilityForm({...availabilityForm, endTime: value})}
                error={endTimeError}
                inputProps={{ step: 300, min: availabilityForm.startTime || undefined }}
                required
              />

              <AnimatedInputField
                label="Capacidad"
                type="number"
                value={availabilityForm.capacity.toString()}
                onChange={(value) => setAvailabilityForm({...availabilityForm, capacity: Number(value) || 1})}
                placeholder="1"
                error={capacityError}
                inputProps={{ min: 1, step: 1 }}
                required
              />
            </div>

            <AnimatedTextareaField
              label="Observaciones"
              placeholder="Información adicional sobre este horario..."
              value={availabilityForm.notes}
              onChange={(value) => setAvailabilityForm({...availabilityForm, notes: value})}
              rows={3}
            />

            <div className="flex justify-end space-x-3 pt-4 relative z-50">
              <AnimatedButton
                variant="outline"
                onClick={onClose}
                animation="scale"
                className="relative z-50"
              >
                Cancelar
              </AnimatedButton>
              <AnimatedButton
                type="submit"
                animation="bounce"
                disabled={disableSubmit}
                className="relative z-50"
              >
                Crear Agenda
              </AnimatedButton>
            </div>
          </AnimatedForm>
        </DialogContent>
      </Dialog>
    </EnhancedAnimatedPresenceWrapper>
  );
};

export default CreateAvailabilityModal;
