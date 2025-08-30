
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, User, Phone, MapPin, CheckCircle, AlertCircle, XCircle, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import CancelAppointmentModal from "./CancelAppointmentModal";

interface AppointmentListProps {
  date: Date | undefined;
  filteredAppointments: any[];
}

const AppointmentList = ({ date, filteredAppointments }: AppointmentListProps) => {
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmada":
        return "bg-success-100 text-success-800";
      case "Pendiente":
        return "bg-warning-100 text-warning-800";
      case "Completada":
        return "bg-medical-100 text-medical-800";
      case "Cancelada":
        return "bg-danger-100 text-danger-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Confirmada":
        return <CheckCircle className="w-4 h-4" />;
      case "Pendiente":
        return <AlertCircle className="w-4 h-4" />;
      case "Completada":
        return <CheckCircle className="w-4 h-4" />;
      case "Cancelada":
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const handleCancelAppointment = (appointment: any) => {
    // Transform appointment data to match the modal's expected format
    const patientData = {
      id: appointment.id.toString(),
      patientName: appointment.patient,
      phone: appointment.phone,
      date: date ? date.toISOString() : new Date().toISOString(),
      time: appointment.time,
      doctor: appointment.doctor,
      specialty: appointment.specialty
    };
    
    setSelectedPatient(patientData);
    setIsCancelModalOpen(true);
  };

  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false);
    setSelectedPatient(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg sm:text-xl">
            Agenda del {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : "día seleccionado"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {filteredAppointments.length} cita(s) para el día seleccionado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 max-h-96 sm:max-h-[500px] overflow-y-auto">
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <CalendarIcon className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2 sm:mb-4" />
              <p className="text-sm sm:text-base text-gray-500">No hay citas programadas para este día</p>
            </div>
          ) : (
            filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                  <div className="flex-1 space-y-1 sm:space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(appointment.status)} flex items-center gap-1 text-xs`}>
                        {getStatusIcon(appointment.status)}
                        {appointment.status}
                      </Badge>
                      <span className="text-xs sm:text-sm font-medium text-gray-600">
                        {appointment.time} ({appointment.duration} min)
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 sm:w-4 sm:h-4 text-medical-600" />
                        <span className="text-sm sm:text-base font-semibold">{appointment.patient}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                        <span className="text-xs sm:text-sm text-gray-600">{appointment.phone}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                        <span className="text-xs sm:text-sm text-gray-600">{appointment.location}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      <Badge variant="outline" className="text-xs">
                        {appointment.specialty}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {appointment.doctor}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs px-2 py-1">
                      Ver
                    </Button>
                    <Button size="sm" className="text-xs px-2 py-1">
                      Editar
                    </Button>
                    {appointment.status !== "Cancelada" && appointment.status !== "Completada" && (
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="text-xs px-2 py-1"
                        onClick={() => handleCancelAppointment(appointment)}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Cancel Appointment Modal */}
      <CancelAppointmentModal
        isOpen={isCancelModalOpen}
        onClose={handleCloseCancelModal}
        patient={selectedPatient}
      />
    </>
  );
};

export default AppointmentList;
