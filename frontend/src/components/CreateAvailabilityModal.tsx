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
  const { doctors, fetchLocationSpecialties, getLocationSpecialtyOptions, getDoctorsBySpecialty } = useAppointmentData();
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [filteredDoctors, setFilteredDoctors] = useState<Array<{ id: number; name: string }>>([]);
  
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
  const disableSubmit = isFormIncomplete || isFormInvalid || loadingSpecs || loadingDoctors;

  useEffect(() => {
    const locId = Number(availabilityForm.locationId);
    if (!locId) return;
    if (getLocationSpecialties(String(locId)).length > 0) return; // cache
    setLoadingSpecs(true);
    fetchLocationSpecialties(locId).finally(() => setLoadingSpecs(false));
  }, [availabilityForm.locationId]);

  // Cargar doctores cuando se selecciona una especialidad
  useEffect(() => {
    const specialtyId = Number(availabilityForm.specialty);
    if (!specialtyId) {
      setFilteredDoctors([]);
      return;
    }

    setLoadingDoctors(true);
    getDoctorsBySpecialty(specialtyId)
      .then(setFilteredDoctors)
      .catch((error) => {
        console.error('Error loading doctors by specialty:', error);
        setFilteredDoctors([]);
      })
      .finally(() => setLoadingDoctors(false));
  }, [availabilityForm.specialty]);

  // Limpiar doctor seleccionado cuando cambia la especialidad
  useEffect(() => {
    if (availabilityForm.specialty && availabilityForm.doctor) {
      const doctorExists = filteredDoctors.some(d => d.id.toString() === availabilityForm.doctor);
      if (!doctorExists) {
        setAvailabilityForm(prev => ({ ...prev, doctor: "" }));
      }
    }
  }, [filteredDoctors, availabilityForm.specialty, availabilityForm.doctor]);

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
            onSubmit={(e) => { 
              e.preventDefault(); 
              try {
                if (disableSubmit) return;
                if (!availabilityForm) {
                  console.error('[CreateAvailabilityModal] availabilityForm undefined al enviar');
                  return;
                }
                onCreateAvailability(); 
              } catch(err){
                console.error('[CreateAvailabilityModal] Error onSubmit', err);
              }
            }}
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
                placeholder={loadingDoctors ? "Cargando doctores..." : !availabilityForm.specialty ? "Selecciona especialidad primero" : "Selecciona doctor"}
                value={availabilityForm.doctor}
                onChange={(value) => setAvailabilityForm({ ...availabilityForm, doctor: value })}
                options={filteredDoctors.map((d) => ({
                  value: String(d.id),
                  label: d.name
                }))}
                disabled={!availabilityForm.specialty || loadingDoctors}
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

            {/* Auto distribución de cupos aleatoria */}
            <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex flex-col">
                  <span className="font-medium text-sm">Distribuir cupos automáticamente</span>
                  <span className="text-xs text-gray-600 max-w-sm">Si se activa, la capacidad se reparte aleatoriamente en los días hábiles desde la fecha de inicio hasta la fecha de fin especificadas.</span>
                </div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={!!availabilityForm.autoDistribute}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, autoDistribute: e.target.checked })}
                  />
                  Activar
                </label>
              </div>
              {availabilityForm.autoDistribute && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatedInputField
                    label="Fecha de Inicio"
                    type="date"
                    value={availabilityForm.distributionStartDate || ''}
                    onChange={(value) => setAvailabilityForm({ ...availabilityForm, distributionStartDate: value })}
                    inputProps={{ min: todayStr }}
                    placeholder="Fecha desde cuando distribuir"
                    required={availabilityForm.autoDistribute}
                  />
                  <AnimatedInputField
                    label="Fecha de Fin"
                    type="date"
                    value={availabilityForm.distributionEndDate || ''}
                    onChange={(value) => setAvailabilityForm({ ...availabilityForm, distributionEndDate: value })}
                    inputProps={{ min: availabilityForm.distributionStartDate || todayStr }}
                    placeholder="Fecha hasta cuando distribuir"
                    required={availabilityForm.autoDistribute}
                  />
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={!!availabilityForm.excludeWeekends}
                        onChange={(e) => setAvailabilityForm({ ...availabilityForm, excludeWeekends: e.target.checked })}
                      />
                      Excluir fines de semana
                    </label>
                  </div>
                </div>
              )}
            </div>

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
