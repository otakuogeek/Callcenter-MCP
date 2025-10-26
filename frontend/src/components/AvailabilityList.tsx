import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarIcon, User, MapPin, CheckCircle, AlertCircle, XCircle, Eye, Edit, X, Clock, Stethoscope, Users, TrendingUp, CalendarDays, UserPlus, Printer, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { safeFormatDate } from "@/utils/dateHelpers";
import { motion, AnimatePresence } from "framer-motion";
import type { Availability } from "@/hooks/useAppointmentData";
import { useAppointmentData } from "@/hooks/useAppointmentData";
import CancelAvailabilityModal from "./CancelAvailabilityModal";
import ViewAvailabilityModal from "./ViewAvailabilityModal";
import EditAvailabilityModal from "./EditAvailabilityModal";
import TransferAvailabilityModal from "./TransferAvailabilityModal";
import ManualAppointmentModal from "./ManualAppointmentModal";
import QuickAppointmentModal from "./QuickAppointmentModal";
import { generateDailyAgendaPDF, exportSingleAgendaToExcel } from "@/utils/pdfGenerators";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface AvailabilityListProps {
  date: Date | undefined;
  filteredAvailabilities: Availability[];
}

const AvailabilityList = ({ date, filteredAvailabilities }: AvailabilityListProps) => {
  const { updateAvailabilityStatus, updateAvailability, addAvailability, getLocationSpecialtyOptions, fetchLocationSpecialties, doctors } = useAppointmentData();
  const { toast } = useToast();
  const [selectedAvailability, setSelectedAvailability] = useState<Availability | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isQuickAppointmentModalOpen, setIsQuickAppointmentModalOpen] = useState(false);
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

  // Función auxiliar para calcular cupos disponibles (protegida contra negativos)
  const getAvailableSlots = (capacity: number, bookedSlots: number): number => {
    return Math.max(0, capacity - bookedSlots);
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

  const handleQuickAppointment = (availability: Availability) => {
    setSelectedAvailability(availability);
    setIsQuickAppointmentModalOpen(true);
  };

  const handleCloseQuickAppointmentModal = () => {
    setIsQuickAppointmentModalOpen(false);
    setSelectedAvailability(null);
  };

  const handleQuickAppointmentSuccess = () => {
    // Recargar las disponibilidades para reflejar los cambios
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      // Usar el hook loadAvailabilities que ya está disponible
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  const handleTransferSuccess = (id: number, newDate: string) => {
    console.log("Agenda transferida:", id, "a la fecha:", newDate);
    // Aquí se actualizaría la lista de disponibilidades
    setIsTransferModalOpen(false);
    setSelectedAvailability(null);
  };

  const handlePrintSingleAgenda = async (availability: Availability) => {
    try {
      toast({
        title: "Generando PDF",
        description: "Por favor espere...",
      });

      // Obtener la fecha formateada
      const dateStr = availability.date;
      
      // Obtener las citas para esta fecha específica
      const appointments = await api.getAppointments({ date: dateStr });
      
      console.log('Disponibilidad seleccionada:', availability);
      console.log('Total de citas obtenidas:', appointments.length);
      console.log('Ejemplo de cita completa:', JSON.stringify(appointments[0], null, 2));
      
      // Filtrar citas para este doctor y la disponibilidad específica
      const doctorAppointments = appointments.filter((apt: any) => {
        // Extraer solo la fecha del scheduled_at (formato ISO: 2025-10-20T08:00:00.000Z)
        const scheduledAt = apt.scheduled_at || apt.scheduled_date || '';
        const aptDate = scheduledAt.includes('T') 
          ? scheduledAt.split('T')[0] 
          : scheduledAt.split(' ')[0];
        
        const matchDoctor = apt.doctor_name === availability.doctor;
        const matchDate = aptDate === dateStr;
        
        // Filtrar también por availability_id si está disponible
        const matchAvailability = !apt.availability_id || apt.availability_id === availability.id;
        
        console.log(`Cita ${apt.id}: aptDate="${aptDate}", matchDoctor=${matchDoctor}, matchDate=${matchDate}, matchAvailability=${matchAvailability}`);
        
        return matchDoctor && matchDate && matchAvailability;
      });
      
      console.log('Citas filtradas para el doctor:', doctorAppointments.length, doctorAppointments);

      if (doctorAppointments.length === 0) {
        toast({
          title: "Sin citas",
          description: `No hay citas programadas para ${availability.doctor} en esta fecha`,
          variant: "destructive"
        });
        return;
      }

      // Agrupar por doctor con el formato correcto
      const agendaByDoctor = [{
        doctor_name: availability.doctor,
        specialty_name: availability.specialty,
        location_name: availability.locationName,
        date: availability.date,
        start_time: availability.startTime,
        end_time: availability.endTime,
        appointments: doctorAppointments.map((apt: any) => ({
          id: apt.id,
          patient_name: apt.patient_name,
          patient_document: apt.patient_document,
          patient_phone: apt.patient_phone,
          patient_email: apt.patient_email,
          patient_eps: apt.patient_eps,
          scheduled_at: apt.scheduled_at,
          duration_minutes: apt.duration_minutes,
          status: apt.status,
          reason: apt.reason,
          age: apt.age
        }))
      }];

      console.log('Datos para PDF:', agendaByDoctor);

      // Generar el PDF
      generateDailyAgendaPDF(agendaByDoctor as any);

      toast({
        title: "PDF Generado",
        description: `Agenda de ${availability.doctor} con ${doctorAppointments.length} citas`,
      });
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  const handleExportSingleAgenda = async (availability: Availability) => {
    try {
      toast({
        title: "Generando Excel",
        description: "Por favor espere...",
      });

      // Obtener la fecha formateada
      const dateStr = availability.date;
      
      // Obtener las citas para esta fecha específica
      const appointments = await api.getAppointments({ date: dateStr });
      
      // Filtrar citas para este doctor y la disponibilidad específica
      const doctorAppointments = appointments.filter((apt: any) => {
        // Extraer solo la fecha del scheduled_at (formato ISO: 2025-10-20T08:00:00.000Z)
        const scheduledAt = apt.scheduled_at || apt.scheduled_date || '';
        const aptDate = scheduledAt.includes('T') 
          ? scheduledAt.split('T')[0] 
          : scheduledAt.split(' ')[0];
        
        const matchDoctor = apt.doctor_name === availability.doctor;
        const matchDate = aptDate === dateStr;
        
        // Filtrar también por availability_id si está disponible
        const matchAvailability = !apt.availability_id || apt.availability_id === availability.id;
        
        return matchDoctor && matchDate && matchAvailability;
      });

      if (doctorAppointments.length === 0) {
        toast({
          title: "Sin citas",
          description: `No hay citas programadas para ${availability.doctor} en esta fecha`,
          variant: "destructive"
        });
        return;
      }

      // Preparar datos para Excel
      const agendaData = {
        doctor_name: availability.doctor,
        specialty_name: availability.specialty,
        location_name: availability.locationName,
        date: availability.date,
        start_time: availability.startTime,
        end_time: availability.endTime,
        appointments: doctorAppointments.map((apt: any) => ({
          id: apt.id,
          patient_name: apt.patient_name,
          patient_document: apt.patient_document,
          patient_phone: apt.patient_phone,
          patient_email: apt.patient_email,
          patient_eps: apt.patient_eps,
          scheduled_at: apt.scheduled_at,
          duration_minutes: apt.duration_minutes,
          status: apt.status,
          reason: apt.reason,
          age: apt.age
        }))
      };

      // Generar el archivo Excel
      exportSingleAgendaToExcel(agendaData as any);

      toast({
        title: "Excel Generado",
        description: `Agenda de ${availability.doctor} con ${doctorAppointments.length} citas`,
      });
    } catch (error) {
      console.error('Error generando Excel:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el archivo Excel",
        variant: "destructive",
      });
    }
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
              {date ? 'Agendas del Día Seleccionado' : 'Próximas Disponibilidades'}
            </CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {filteredAvailabilities.length} agenda{filteredAvailabilities.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <CardDescription className="text-sm text-gray-600">
            {date 
              ? `Mostrando agendas para el ${format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}`
              : 'Gestiona y supervisa todas las agendas médicas futuras'
            }
          </CardDescription>
        </CardHeader>
        
        {/* Banner de filtro activo por fecha */}
        {date && (
          <div className="mx-6 mt-2 mb-4 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-base">Filtro por Fecha Activo</p>
                  <p className="text-sm text-blue-50">
                    {filteredAvailabilities.length === 0 
                      ? `No hay agendas programadas para esta fecha`
                      : `Mostrando ${filteredAvailabilities.length} agenda${filteredAvailabilities.length !== 1 ? 's' : ''} programada${filteredAvailabilities.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-white hover:bg-white/20 hover:text-white"
                onClick={() => {
                  // Trigger parent component to clear date filter
                  const event = new CustomEvent('clearDateFilter');
                  window.dispatchEvent(event);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Ver Todas
              </Button>
            </div>
          </div>
        )}
        
        <CardContent className="p-6">
          {filteredAvailabilities.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="max-w-md mx-auto">
                {date ? (
                  // Mensaje específico cuando se filtra por fecha
                  <>
                    <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
                      <CalendarIcon className="w-12 h-12 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      No hay agendas para este día
                    </h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                      No se encontraron agendas programadas para el{' '}
                      <span className="font-semibold text-blue-600">
                        {format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                      </span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        variant="default"
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        onClick={() => {
                          const event = new CustomEvent('createAvailabilityForDate', { 
                            detail: { date: date.toISOString().split('T')[0] } 
                          });
                          window.dispatchEvent(event);
                        }}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Crear Agenda para este Día
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const event = new CustomEvent('clearDateFilter');
                          window.dispatchEvent(event);
                        }}
                      >
                        <CalendarDays className="w-4 h-4 mr-2" />
                        Ver Todas las Agendas
                      </Button>
                    </div>
                  </>
                ) : (
                  // Mensaje general cuando no hay filtro de fecha
                  <>
                    <CalendarIcon className="w-20 h-20 text-gray-300 mx-auto mb-6" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">No hay disponibilidades</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      No se encontraron agendas próximas que coincidan con los filtros seleccionados
                    </p>
                  </>
                )}
              </div>
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
                        availability.status === 'active' ? 'border-l-green-500 bg-gradient-to-r from-green-50/80 to-white' :
                        availability.status === 'completed' ? 'border-l-blue-500 bg-gradient-to-r from-blue-50/80 to-white' :
                        'border-l-red-500 bg-gradient-to-r from-red-50/80 to-white'
                      } ${expandedCard === availability.id ? 'shadow-xl ring-2 ring-blue-100' : 'shadow-md'}`}
                      onClick={() => setExpandedCard(expandedCard === availability.id ? null : availability.id)}
                    >
                      <CardContent className="p-6">
                        {/* Banner de acción rápida para agendas activas con cupos */}
                        {availability.status === 'Activa' && availability.bookedSlots < availability.capacity && (
                          <div className="mb-4 -mx-6 -mt-6 bg-gradient-to-r from-green-500 to-green-600 text-white p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="bg-white text-green-600 rounded-full p-2">
                                  <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-lg">¡Cupos Disponibles!</h4>
                                  <p className="text-green-100">
                                    {availability.capacity - availability.bookedSlots} de {availability.capacity} cupos libres
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="lg"
                                className="bg-white text-green-600 hover:bg-green-50 font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAppointment(availability);
                                }}
                              >
                                <UserPlus className="w-5 h-5 mr-2" />
                                Registrar Cita
                              </Button>
                            </div>
                          </div>
                        )}
                        
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
                              {availability.status === 'active' && availability.bookedSlots < availability.capacity && (
                                <Badge className="bg-green-500 text-white border-green-600 flex items-center gap-1 animate-pulse">
                                  <UserPlus className="w-3 h-3" />
                                  {availability.capacity - availability.bookedSlots} disponibles
                                </Badge>
                              )}
                              {availability.status === 'active' && availability.bookedSlots < availability.capacity && (
                                <Button
                                  size="sm"
                                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAppointment(availability);
                                  }}
                                >
                                  <UserPlus className="w-4 h-4" />
                                  Registrar Cita
                                </Button>
                              )}
                              <div className="text-right">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1 text-sm font-bold text-blue-700">
                                    <CalendarIcon className="w-4 h-4" />
                                    {safeFormatDate(availability.date, "EEE, d 'de' MMM", { locale: es })}
                                  </div>
                                  <div className="flex items-center gap-1 text-sm font-bold text-gray-700">
                                    <Clock className="w-4 h-4" />
                                    {availability.startTime} - {availability.endTime}
                                  </div>
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

                          {/* Barra de acciones rápidas */}
                          {availability.status === "Activa" && availability.bookedSlots < availability.capacity && (
                            <div className="flex items-center justify-center pt-4">
                              <Button
                                size="lg"
                                className="flex items-center gap-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAppointment(availability);
                                }}
                              >
                                <UserPlus className="w-5 h-5" />
                                Registrar Cita Ahora
                                <span className="bg-white text-green-700 px-2 py-1 rounded-full text-sm font-semibold">
                                  {availability.capacity - availability.bookedSlots} cupos
                                </span>
                              </Button>
                            </div>
                          )}

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
                                    variant="outline"
                                    className="flex items-center gap-2 bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintSingleAgenda(availability);
                                    }}
                                  >
                                    <Printer className="w-4 h-4" />
                                    Imprimir
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-2 bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExportSingleAgenda(availability);
                                    }}
                                  >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Exportar Excel
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleQuickAppointment(availability);
                                      }}
                                    >
                                      <UserPlus className="w-4 h-4" />
                                      Registrar Cita
                                    </Button>
                                  )}

                                  {availability.status === "Activa" && availability.bookedSlots < availability.capacity && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex items-center gap-2 bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
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
                                      Cita Manual
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

      {/* Quick Appointment Modal */}
      <QuickAppointmentModal
        isOpen={isQuickAppointmentModalOpen}
        onClose={handleCloseQuickAppointmentModal}
        onSuccess={handleQuickAppointmentSuccess}
        availabilityData={selectedAvailability ? {
          id: selectedAvailability.id,
          date: selectedAvailability.date,
          startTime: selectedAvailability.startTime,
          endTime: selectedAvailability.endTime,
          doctor: selectedAvailability.doctor,
          specialty: selectedAvailability.specialty,
          locationName: selectedAvailability.locationName,
          locationId: selectedAvailability.locationId,
          doctorId: selectedAvailability.doctorId,
          specialtyId: selectedAvailability.specialtyId,
          capacity: selectedAvailability.capacity,
          bookedSlots: selectedAvailability.bookedSlots
        } : null}
      />
    </>
  );
};

export default AvailabilityList;
