import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";
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

          <AnimatedForm className="space-y-4 sm:space-y-6">
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
                options={useAppointmentData().doctors.map((d) => ({
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
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AnimatedInputField
                label="Hora Inicio"
                type="time"
                value={availabilityForm.startTime}
                onChange={(value) => setAvailabilityForm({...availabilityForm, startTime: value})}
                required
              />

                              required
              />

              <AnimatedInputField
                label="Duración Cita (min)"
                type="number"
                value={availabilityForm.duration}
                onChange={(value) => setAvailabilityForm({...availabilityForm, duration: value})}
                placeholder="30"
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

            <div className="flex justify-end space-x-3 pt-4">
              <AnimatedButton
                variant="outline"
                onClick={onClose}
                animation="scale"
              >
                Cancelar
              </AnimatedButton>
              <AnimatedButton
                onClick={onCreateAvailability}
                animation="bounce"
                disabled={!availabilityForm.locationId || !availabilityForm.specialty || !availabilityForm.doctor}
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
          </AnimatedForm>
        </DialogContent>
      </Dialog>
    </EnhancedAnimatedPresenceWrapper>
  );
              <Input
                id="end-time"
                type="time"
                value={availabilityForm.endTime}
                onChange={(e) => setAvailabilityForm({...availabilityForm, endTime: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="capacity">Cupos Disponibles *</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="20"
                value={availabilityForm.capacity}
                onChange={(e) => setAvailabilityForm({...availabilityForm, capacity: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={availabilityForm.notes}
              onChange={(e) => setAvailabilityForm({...availabilityForm, notes: e.target.value})}
              placeholder="Información adicional sobre la disponibilidad..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={onCreateAvailability}
              disabled={!availabilityForm.locationId || !availabilityForm.specialty || !availabilityForm.doctor || !availabilityForm.date || !availabilityForm.startTime || !availabilityForm.endTime}
            >
              Crear Disponibilidad
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAvailabilityModal;
