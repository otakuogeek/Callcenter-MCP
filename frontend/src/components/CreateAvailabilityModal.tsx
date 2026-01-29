import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Calendar, X } from "lucide-react";
import type { AvailabilityForm, Location } from "@/hooks/useAppointmentData";
import { useAppointmentData } from "@/hooks/useAppointmentData";
import { AnimatedForm, AnimatedInputField, AnimatedSelectField, AnimatedTextareaField } from "@/components/ui/animated-form";
import { AnimatedButton } from "@/components/ui/animated-button";
import { EnhancedAnimatedPresenceWrapper } from "@/components/ui/enhanced-animated-container";
import { safeDateFromString } from "@/utils/dateHelpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

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
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  
  // Validaciones locales y restricciones nativas
  const todayStr = new Date().toISOString().split('T')[0];
  const formDate = safeDateFromString(availabilityForm.date);
  const today = new Date(new Date().toDateString());
  const isPastDate = formDate ? formDate < today : false;
  const timeOrderInvalid = !!(availabilityForm.startTime && availabilityForm.endTime && availabilityForm.startTime >= availabilityForm.endTime);
  const capacityInvalid = availabilityForm.capacity < 1;

  const dateError = isPastDate ? "No puede crear una agenda en una fecha pasada" : undefined;
  const startTimeError = timeOrderInvalid ? "La hora de inicio debe ser anterior a la hora de fin" : undefined;
  const endTimeError = timeOrderInvalid ? "La hora de fin debe ser posterior a la hora de inicio" : undefined;
  const capacityError = capacityInvalid ? "La capacidad mínima es 1" : undefined;

  const isFormIncomplete = !availabilityForm.locationId || !availabilityForm.specialty || !availabilityForm.doctor || selectedDates.length === 0 || !availabilityForm.startTime || !availabilityForm.endTime;
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

  // 🔥 NUEVO: Limpiar fechas seleccionadas cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setSelectedDates([]);
    }
  }, [isOpen]);

  // 🔥 NUEVO: Asegurar valores por defecto cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      // Si capacity o durationMinutes están vacíos, establecer valores por defecto
      if (!availabilityForm.capacity || availabilityForm.capacity < 1) {
        setAvailabilityForm(prev => ({ ...prev, capacity: 1 }));
      }
      if (!availabilityForm.durationMinutes || availabilityForm.durationMinutes < 1) {
        setAvailabilityForm(prev => ({ ...prev, durationMinutes: 15 }));
      }
    }
  }, [isOpen]);

  // 🔥 NUEVO: Calcular hora final automáticamente cuando cambian startTime, capacity o durationMinutes
  useEffect(() => {
    if (!availabilityForm.startTime || !availabilityForm.capacity || !availabilityForm.durationMinutes) {
      return;
    }

    const [hours, minutes] = availabilityForm.startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const totalMinutes = availabilityForm.capacity * availabilityForm.durationMinutes;
    const endMinutes = startMinutes + totalMinutes;
    
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    
    // Limitar a 23:59 como máximo
    const finalHours = Math.min(endHours, 23);
    const finalMins = endHours >= 24 ? 59 : endMins;
    
    const endTime = `${String(finalHours).padStart(2, '0')}:${String(finalMins).padStart(2, '0')}`;
    
    // Solo actualizar si el endTime calculado es diferente
    if (endTime !== availabilityForm.endTime) {
      setAvailabilityForm(prev => ({...prev, endTime}));
    }
  }, [availabilityForm.startTime, availabilityForm.capacity, availabilityForm.durationMinutes]);

  return (
    <EnhancedAnimatedPresenceWrapper>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-medical-600" />
              Crear Agenda en Ubicación
            </DialogTitle>
            <DialogDescription>
              Configura horarios disponibles para citas en una ubicación específica
            </DialogDescription>
          </DialogHeader>

          <AnimatedForm 
            className="space-y-3 sm:space-y-4 pb-4"
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
            </div>

            {/* 🔥 NUEVO: Calendario con selección múltiple */}
            <div className="p-3 sm:p-4 border rounded-lg bg-purple-50 border-purple-200 space-y-3">
              <div>
                <span className="font-medium text-sm text-purple-900">Fechas para crear agendas</span>
                <p className="text-xs text-purple-700 mt-0.5">
                  Haz clic en el calendario para seleccionar múltiples fechas con la misma configuración
                </p>
              </div>
              
              {/* Calendario de selección múltiple */}
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <DayPicker
                  mode="multiple"
                  showOutsideDays
                  weekStartsOn={1}
                  selected={selectedDates.map(d => new Date(d + 'T12:00:00'))}
                  onSelect={(dates) => {
                    if (!dates) {
                      setSelectedDates([]);
                      setAvailabilityForm({
                        ...availabilityForm,
                        date: "",
                        dates: []
                      });
                      return;
                    }
                    const sortedDates = dates
                      .map(d => {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      })
                      .sort();
                    setSelectedDates(sortedDates);
                    setAvailabilityForm({
                      ...availabilityForm,
                      date: sortedDates[0] || "",
                      dates: sortedDates
                    });
                  }}
                  disabled={{ before: new Date() }}
                  locale={es}
                  className="mx-auto"
                  classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-sm font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex",
                    head_cell: "text-purple-600 rounded-md w-9 font-normal text-[0.8rem]",
                    row: "flex w-full mt-2",
                    cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-purple-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-purple-100 rounded-md",
                    day_selected: "bg-purple-600 text-white hover:bg-purple-700 hover:text-white focus:bg-purple-600 focus:text-white",
                    day_today: "bg-purple-50 text-purple-900 font-semibold",
                    day_outside: "text-gray-400 opacity-50",
                    day_disabled: "text-gray-400 opacity-50 cursor-not-allowed",
                    day_range_middle: "aria-selected:bg-purple-100 aria-selected:text-purple-900",
                    day_hidden: "invisible",
                  }}
                />
              </div>

              {selectedDates.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-purple-700 mb-1.5 font-medium">
                    Fechas seleccionadas ({selectedDates.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {selectedDates.map((date) => (
                      <Badge 
                        key={date} 
                        variant="secondary"
                        className="bg-purple-100 text-purple-800 hover:bg-purple-200 flex items-center gap-1 text-xs py-1"
                      >
                        <Calendar className="w-3 h-3" />
                        <span className="hidden sm:inline">
                          {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </span>
                        <span className="sm:hidden">
                          {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { 
                            day: '2-digit', 
                            month: 'short'
                          })}
                        </span>
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-purple-900"
                          onClick={() => {
                            const newDates = selectedDates.filter(d => d !== date);
                            setSelectedDates(newDates);
                            setAvailabilityForm({
                              ...availabilityForm,
                              date: newDates[0] || "",
                              dates: newDates
                            });
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-purple-600 mt-1.5">
                    Se crearán {selectedDates.length} agenda{selectedDates.length > 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {selectedDates.length === 0 && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <span>⚠️</span> Debes seleccionar al menos una fecha en el calendario
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
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
                inputProps={{ step: 300, min: availabilityForm.startTime || undefined, readOnly: true }}
                required
                className="bg-gray-50"
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

            {/* 🔥 NUEVO: Campo de Duración por Agenda */}
            <div className="p-3 sm:p-4 border rounded-lg bg-blue-50 border-blue-200 space-y-2">
              <span className="font-medium text-sm text-blue-900">Duración de cada cita</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <AnimatedInputField
                  label="Minutos por cita"
                  type="number"
                  value={availabilityForm.durationMinutes?.toString() || "15"}
                  onChange={(value) => setAvailabilityForm({...availabilityForm, durationMinutes: Number(value) || 15})}
                  placeholder="15"
                  inputProps={{ min: 1, step: 1 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setAvailabilityForm({...availabilityForm, durationMinutes: 15})}
                  className="px-2 py-1.5 text-xs bg-white border rounded hover:bg-blue-100 h-fit self-end"
                >
                  15 min
                </button>
                <button
                  type="button"
                  onClick={() => setAvailabilityForm({...availabilityForm, durationMinutes: 20})}
                  className="px-2 py-1.5 text-xs bg-white border rounded hover:bg-blue-100 h-fit self-end"
                >
                  20 min
                </button>
                <button
                  type="button"
                  onClick={() => setAvailabilityForm({...availabilityForm, durationMinutes: 30})}
                  className="px-2 py-1.5 text-xs bg-white border rounded hover:bg-blue-100 h-fit self-end"
                >
                  30 min
                </button>
              </div>
            </div>

            <AnimatedTextareaField
              label="Observaciones"
              placeholder="Información adicional sobre este horario..."
              value={availabilityForm.notes}
              onChange={(value) => setAvailabilityForm({...availabilityForm, notes: value})}
              rows={2}
            />

            {/* Auto distribución de cupos aleatoria */}
            <div className="p-3 sm:p-4 border rounded-lg bg-gray-50 space-y-2 sm:space-y-3">
              <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium text-sm">Distribuir cupos automáticamente</span>
                  <span className="text-xs text-gray-600">Reparte la capacidad aleatoriamente en días hábiles</span>
                </div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={!!availabilityForm.autoDistribute}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, autoDistribute: e.target.checked })}
                  />
                  <span className="hidden sm:inline">Activar</span>
                </label>
              </div>
              {availabilityForm.autoDistribute && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <AnimatedInputField
                      label="Fecha de Inicio"
                      type="date"
                      value={availabilityForm.distributionStartDate || ''}
                      onChange={(value) => setAvailabilityForm({ ...availabilityForm, distributionStartDate: value })}
                      inputProps={{ min: todayStr }}
                      placeholder="Desde"
                      required={availabilityForm.autoDistribute}
                    />
                    <AnimatedInputField
                      label="Fecha de Fin"
                      type="date"
                      value={availabilityForm.distributionEndDate || ''}
                      onChange={(value) => setAvailabilityForm({ ...availabilityForm, distributionEndDate: value })}
                      inputProps={{ min: availabilityForm.distributionStartDate || todayStr }}
                      placeholder="Hasta"
                      required={availabilityForm.autoDistribute}
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={!!availabilityForm.excludeWeekends}
                      onChange={(e) => setAvailabilityForm({ ...availabilityForm, excludeWeekends: e.target.checked })}
                    />
                    Excluir fines de semana
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 sticky bottom-0 bg-white z-10 border-t mt-4 -mx-6 px-6 py-3">
              <AnimatedButton
                variant="outline"
                onClick={onClose}
                animation="scale"
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancelar
              </AnimatedButton>
              <AnimatedButton
                type="submit"
                animation="bounce"
                disabled={disableSubmit}
                className="w-full sm:w-auto order-1 sm:order-2"
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
