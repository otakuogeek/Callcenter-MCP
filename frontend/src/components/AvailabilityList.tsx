import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarIcon, User, MapPin, CheckCircle, AlertCircle, XCircle, Eye, Edit, X, Clock, Stethoscope, Users, TrendingUp, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import type { Availability } from "@/hooks/useAppointmentData";
import { useAppointmentData } from "@/hooks/useAppointmentData";
import CancelAvailabilityModal from "./CancelAvailabilityModal";
import ViewAvailabilityModal from "./ViewAvailabilityModal";
import EditAvailabilityModal from "./EditAvailabilityModal";
import TransferAvailabilityModal from "./TransferAvailabilityModal";
import ManualAppointmentModal from "./ManualAppointmentModal";

interface AvailabilityListProps {
  date: Date | undefined;
  filteredAvailabilities: Availability[];
}

const AvailabilityList = ({ date, filteredAvailabilities }: AvailabilityListProps) => {
  const { updateAvailabilityStatus, updateAvailability, addAvailability, getLocationSpecialtyOptions, fetchLocationSpecialties, doctors } = useAppointmentData();
  const [selectedAvailability, setSelectedAvailability] = useState<Availability | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDefaults, setManualDefaults] = useState<{
    availabilityId?: number;
    locationId?: number;
    specialtyId?: number;
    doctorId?: number;
    date?: string;
    startTime?: string;
    endTime?: string;
  } | null>(null);

  const getStatusBadge = (status: string) => {
    const variants = {
      'Activa': 'bg-green-100 text-green-800 border-green-200',
      'Completa': 'bg-blue-100 text-blue-800 border-blue-200',
      'Cancelada': 'bg-red-100 text-red-800 border-red-200'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  const handleCancelAvailability = (availability: Availability) => {
    setSelectedAvailability(availability);
    setIsCancelModalOpen(true);
  };

  const handleViewAvailability = (availability: Availability) => {
    setSelectedAvailability(availability);
    setIsViewModalOpen(true);
  };

  const handleEditAvailability = (availability: Availability) => {
    setSelectedAvailability(availability);
    setIsEditModalOpen(true);
  };

  const handleTransferAvailability = (availability: Availability) => {
    setSelectedAvailability(availability);
    setIsTransferModalOpen(true);
  };

  const handleUpdateAvailability = async (id: number, updates: Partial<Availability>) => {
    try {
      await updateAvailability(id, updates);
      console.log("Disponibilidad actualizada exitosamente:", id, updates);
    } catch (error) {
      console.error("Error actualizando disponibilidad:", error);
    }
  };

  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false);
    setSelectedAvailability(null);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedAvailability(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedAvailability(null);
  };

  const handleCloseTransferModal = () => {
    setIsTransferModalOpen(false);
    setSelectedAvailability(null);
  };

  const handleTransferSuccess = (id: number, newDate: string) => {
    console.log("Agenda transferida:", id, "a la fecha:", newDate);
    // Aquí se actualizaría la lista de disponibilidades
    setIsTransferModalOpen(false);
    setSelectedAvailability(null);
  };

  const getAvailabilityPercentage = (booked: number, capacity: number) => {
    return Math.round((booked / capacity) * 100);
  };

  const computeNewEndTime = (oldStart: string, oldEnd: string, newStart: string) => {
    const [oh, om] = oldStart.split(":").map(Number);
    const [eh, em] = oldEnd.split(":").map(Number);
    const [nh, nm] = newStart.split(":").map(Number);
    const dur = (eh * 60 + em) - (oh * 60 + om);
    const endTotal = nh * 60 + nm + Math.max(dur, 0);
    const ehh = Math.floor(endTotal / 60) % 24;
    const emm = endTotal % 60;
    return `${String(ehh).padStart(2,'0')}:${String(emm).padStart(2,'0')}`;
  };

  const onPersistCancel = async (a: Availability) => {
    await updateAvailabilityStatus(a.id, 'Cancelada');
  };

  const onPersistReschedule = async (a: Availability, newDate: string, newStart: string) => {
    // asegurar especialidades cargadas para la sede
    await fetchLocationSpecialties(a.locationId);
    const opts = getLocationSpecialtyOptions(String(a.locationId));
    const spec = opts.find(o => o.name === a.specialty);
    const doc = doctors.find(d => d.name === a.doctor);
    if (!spec || !doc) return; // no se puede reagendar si no resolvemos IDs
    const newEnd = computeNewEndTime(a.startTime, a.endTime, newStart);
    await addAvailability({
      locationId: String(a.locationId),
      specialty: String(spec.id),
      doctor: String(doc.id),
      date: newDate,
      startTime: newStart,
      endTime: newEnd,
      capacity: a.capacity,
      notes: a.notes || ''
    });
  };

  return (
    <>
      <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
        <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Disponibilidades del día
              {date && (
                <span className="text-base font-normal text-gray-500 ml-2">
                  ({format(date, "EEEE, d 'de' MMMM", { locale: es })})
                </span>
              )}
            </CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {filteredAvailabilities.length} agenda{filteredAvailabilities.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <CardDescription className="text-sm text-gray-600">
            Gestiona y supervisa las agendas médicas programadas
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6">
          {filteredAvailabilities.length === 0 ? (
            <div className="text-center py-16">
              <CalendarIcon className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No hay disponibilidades</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {date 
                  ? `No se encontraron agendas para el ${format(date, "EEEE, d 'de' MMMM", { locale: es })}`
                  : "Selecciona una fecha para ver las disponibilidades disponibles"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredAvailabilities.map((availability, index) => (
                  <motion.div
                    key={availability.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card 
                      className={`border-l-4 transition-all duration-300 hover:shadow-lg cursor-pointer group ${
                        availability.status === 'Activa' ? 'border-l-green-500 bg-gradient-to-r from-green-50/80 to-white' :
                        availability.status === 'Completa' ? 'border-l-blue-500 bg-gradient-to-r from-blue-50/80 to-white' :
                        'border-l-red-500 bg-gradient-to-r from-red-50/80 to-white'
                      } ${expandedCard === availability.id ? 'shadow-xl ring-2 ring-blue-100' : 'shadow-md'}`}
                      onClick={() => setExpandedCard(expandedCard === availability.id ? null : availability.id)}
                    >
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          {/* Header principal */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Stethoscope className="w-6 h-6 text-blue-600" />
                                </div>
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                                  Dr. {availability.doctor}
                                </h3>
                                <p className="text-sm text-gray-600">{availability.specialty}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={`${getStatusBadge(availability.status)} flex items-center gap-1`}>
                                {getStatusIcon(availability.status)}
                                {availability.status}
                              </Badge>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-sm font-bold text-gray-700">
                                  <Clock className="w-4 h-4" />
                                  {availability.startTime} - {availability.endTime}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Información principal */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <MapPin className="w-5 h-5 text-gray-500" />
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Ubicación</p>
                                <p className="font-medium text-gray-900">{availability.locationName}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <Users className="w-5 h-5 text-gray-500" />
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Ocupación</p>
                                <p className="font-medium text-gray-900">
                                  {availability.bookedSlots}/{availability.capacity} cupos
                                </p>
                                {availability.capacity > 0 && (
                                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                    <div 
                                      className={`h-2 rounded-full transition-all duration-500 ${
                                        (availability.bookedSlots / availability.capacity) >= 1 ? 'bg-red-500' :
                                        (availability.bookedSlots / availability.capacity) >= 0.8 ? 'bg-yellow-500' :
                                        'bg-green-500'
                                      }`}
                                      style={{ 
                                        width: `${Math.min((availability.bookedSlots / availability.capacity) * 100, 100)}%` 
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <TrendingUp className="w-5 h-5 text-gray-500" />
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Porcentaje</p>
                                <p className="font-medium text-gray-900">
                                  {getAvailabilityPercentage(availability.bookedSlots, availability.capacity)}%
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Información expandida */}
                          <AnimatePresence>
                            {expandedCard === availability.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-4"
                              >
                                <Separator />
                                
                                {availability.notes && (
                                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <p className="text-sm font-medium text-blue-900 mb-2">Notas importantes:</p>
                                    <p className="text-sm text-blue-800">{availability.notes}</p>
                                  </div>
                                )}
                                
                                <div className="flex flex-wrap gap-3 pt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewAvailability(availability);
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                    Ver detalles
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditAvailability(availability);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                    Editar agenda
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-2 bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTransferAvailability(availability);
                                    }}
                                  >
                                    <CalendarDays className="w-4 h-4" />
                                    Transferir a otra fecha
                                  </Button>

                                  {availability.status === "Activa" && availability.bookedSlots < availability.capacity && (
                                    <Button
                                      size="sm"
                                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        // Resolver IDs de especialidad y doctor
                                        await fetchLocationSpecialties(availability.locationId);
                                        const specOpts = getLocationSpecialtyOptions(String(availability.locationId));
                                        const spec = specOpts.find(o => o.name === availability.specialty);
                                        const doc = doctors.find(d => d.name === availability.doctor);
                                        setManualDefaults({
                                          availabilityId: availability.id,
                                          locationId: availability.locationId,
                                          specialtyId: spec ? Number(spec.id) : undefined,
                                          doctorId: doc ? Number(doc.id) : undefined,
                                          date: availability.date,
                                          startTime: availability.startTime,
                                          endTime: availability.endTime,
                                        });
                                        setIsManualModalOpen(true);
                                      }}
                                    >
                                      <User className="w-4 h-4" />
                                      Agendar cita
                                    </Button>
                                  )}
                                  
                                  {availability.status === "Activa" && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="flex items-center gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelAvailability(availability);
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                      Cancelar o Reagendar
                                    </Button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Availability Modal */}
      <ViewAvailabilityModal
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        availability={selectedAvailability}
      />

      {/* Edit Availability Modal */}
      <EditAvailabilityModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        availability={selectedAvailability}
        onUpdate={handleUpdateAvailability}
      />

      {/* Transfer Availability Modal */}
      <TransferAvailabilityModal
        isOpen={isTransferModalOpen}
        onClose={handleCloseTransferModal}
        availability={selectedAvailability}
        onTransfer={handleTransferSuccess}
      />

      {/* Cancel Availability Modal */}
      <CancelAvailabilityModal
        isOpen={isCancelModalOpen}
        onClose={handleCloseCancelModal}
        availability={selectedAvailability}
  onCancel={onPersistCancel}
  onReschedule={onPersistReschedule}
      />

      {/* Manual Appointment Modal desde disponibilidad */}
      <ManualAppointmentModal
        isOpen={isManualModalOpen}
        onClose={() => { setIsManualModalOpen(false); setManualDefaults(null); }}
        onSuccess={() => { setIsManualModalOpen(false); setManualDefaults(null); }}
        defaults={manualDefaults || undefined}
      />
    </>
  );
};

export default AvailabilityList;
