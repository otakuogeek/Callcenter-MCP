
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, MapPin, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Availability } from "@/hooks/useAppointmentData";
import api from "@/lib/api";

interface ViewAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  availability: Availability | null;
}

type AppointmentRow = {
  id: number;
  status: string;
  scheduled_at: string;
  patient_name: string;
  patient_phone?: string | null;
  patient_email?: string | null;
};

const ViewAvailabilityModal = ({ isOpen, onClose, availability }: ViewAvailabilityModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !availability) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await api.getAppointments(undefined, undefined, availability.id);
        setAppointments(rows as AppointmentRow[]);
      } catch (e: any) {
        setError(e?.message || "No se pudo cargar las citas");
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, availability?.id]);

  if (!availability) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Activa":
        return "bg-success-100 text-success-800";
      case "Completa":
        return "bg-medical-100 text-medical-800";
      case "Cancelada":
        return "bg-danger-100 text-danger-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Activa":
        return <CheckCircle className="w-4 h-4" />;
      case "Completa":
        return <CheckCircle className="w-4 h-4" />;
      case "Cancelada":
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getAvailabilityPercentage = (booked: number, capacity: number) => {
    return Math.round((booked / capacity) * 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-medical-600">
            <Calendar className="w-5 h-5" />
            <span>Detalles de la Disponibilidad</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Estado */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Estado:</span>
            <Badge className={`${getStatusColor(availability.status)} flex items-center gap-1`}>
              {getStatusIcon(availability.status)}
              {availability.status}
            </Badge>
          </div>

          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-medical-600" />
                <span className="text-sm font-medium text-gray-600">Doctor:</span>
              </div>
              <p className="text-base font-semibold">{availability.doctor}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-medical-600" />
                <span className="text-sm font-medium text-gray-600">Ubicación:</span>
              </div>
              <p className="text-base">{availability.locationName}</p>
            </div>
          </div>

          {/* Fecha y horario */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-medical-600" />
                <span className="text-sm font-medium text-gray-600">Fecha:</span>
              </div>
              <p className="text-base">
                {format(new Date(availability.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-medical-600" />
                <span className="text-sm font-medium text-gray-600">Horario:</span>
              </div>
              <p className="text-base">{availability.startTime} - {availability.endTime}</p>
            </div>
          </div>

          {/* Especialidad */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-600">Especialidad:</span>
            <Badge variant="outline" className="text-sm">
              {availability.specialty}
            </Badge>
          </div>

          {/* Capacidad y cupos */}
          <div className="bg-medical-50 rounded-lg p-4">
            <h3 className="font-semibold text-medical-800 mb-3">Información de Cupos</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-medical-600">{availability.capacity}</p>
                <p className="text-sm text-gray-600">Capacidad Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-success-600">{availability.bookedSlots}</p>
                <p className="text-sm text-gray-600">Cupos Ocupados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-warning-600">
                  {getAvailabilityPercentage(availability.bookedSlots, availability.capacity)}%
                </p>
                <p className="text-sm text-gray-600">Ocupación</p>
              </div>
            </div>
          </div>

          {/* Pacientes agendados para esta disponibilidad */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Pacientes en esta agenda</h3>
            {loading && (
              <p className="text-sm text-gray-500">Cargando pacientes…</p>
            )}
            {error && (
              <p className="text-sm text-danger-600">{error}</p>
            )}
            {!loading && !error && appointments.length === 0 && (
              <p className="text-sm text-gray-500">No hay pacientes asignados a esta disponibilidad.</p>
            )}
            {!loading && !error && appointments.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-auto pr-1">
                {appointments.map((ap) => (
                  <div key={ap.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ap.patient_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {ap.patient_phone || "Sin teléfono"} {ap.patient_email ? `• ${ap.patient_email}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-600 hidden sm:inline">
                        {format(new Date(ap.scheduled_at), "HH:mm", { locale: es })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {ap.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          {availability.notes && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-600">Notas:</span>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm">{availability.notes}</p>
              </div>
            </div>
          )}

          {/* Información de creación */}
          <div className="text-xs text-gray-500 pt-4 border-t">
            <p>Creado el: {format(new Date(availability.createdAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}</p>
          </div>

          {/* Botón cerrar */}
          <div className="flex justify-end pt-4 relative z-50">
            <Button variant="outline" onClick={onClose} className="relative z-50">
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewAvailabilityModal;
