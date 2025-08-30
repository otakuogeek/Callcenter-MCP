import React, { useMemo, useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  dayData: {
    appointments: number;
    availabilities: number;
    doctorDetails?: Array<{
      id: number;
      name: string;
      specialty: string;
      appointments: number;
      capacity: number;
      timeSlots: string[];
    }>;
  };
  onCreateAvailability: (date: string) => void;
  onViewAppointments: (date: string) => void;
}

const DayDetailModal = ({ 
  isOpen, 
  onClose, 
  date, 
  dayData, 
  onCreateAvailability,
  onViewAppointments 
}: DayDetailModalProps) => {
  if (!date) return null;

  const dateStr = format(date, "EEEE, d 'de' MMMM", { locale: es });
  const isoDate = date.toISOString().split('T')[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Agenda del {dateStr}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Resumen del día */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">Disponibilidades</p>
                    <p className="text-2xl font-bold text-green-600">{dayData.availabilities}</p>
                  </div>
                  <Users className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Citas Agendadas</p>
                    <p className="text-2xl font-bold text-blue-600">{dayData.appointments}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalles por doctor */}
          {dayData.doctorDetails && dayData.doctorDetails.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Agendas por Doctor</h3>
              <div className="space-y-3">
                {dayData.doctorDetails.map((doctor) => (
                  <Card key={doctor.id} className="border-l-4 border-l-medical-600">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-medical-800">{doctor.name}</h4>
                          <Badge variant="secondary" className="mt-1 mb-2">
                            {doctor.specialty}
                          </Badge>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Citas:</span>
                              <span className="ml-2 font-medium">{doctor.appointments}/{doctor.capacity}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Ocupación:</span>
                              <span className="ml-2 font-medium">
                                {doctor.capacity > 0 ? Math.round((doctor.appointments / doctor.capacity) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                          {doctor.timeSlots.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 mb-1">Horarios:</p>
                              <div className="flex flex-wrap gap-1">
                                {doctor.timeSlots.map((slot, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {slot}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className={`w-3 h-3 rounded-full ${
                            doctor.appointments >= doctor.capacity ? 'bg-red-500' :
                            doctor.appointments / doctor.capacity > 0.8 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => onViewAppointments(isoDate)}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Ver Citas
              </Button>
              <Button 
                onClick={() => onCreateAvailability(isoDate)}
                className="bg-medical-600 hover:bg-medical-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear Agenda
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface EnhancedAppointmentCalendarProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  summary?: Record<string, { 
    appointments: number; 
    availabilities: number;
    doctorDetails?: Array<{
      id: number;
      name: string;
      specialty: string;
      appointments: number;
      capacity: number;
      timeSlots: string[];
    }>;
  }>;
  onMonthChange?: (month: number, year: number) => void;
  onCreateAvailability: (date: string) => void;
  onViewAppointments: (date: string) => void;
  selectedFilters?: {
    doctors: number[];
    specialties: number[];
    locations: number[];
  };
}

const EnhancedAppointmentCalendar = ({ 
  date, 
  setDate, 
  summary = {}, 
  onMonthChange,
  onCreateAvailability,
  onViewAppointments,
  selectedFilters
}: EnhancedAppointmentCalendarProps) => {
  const [selectedDayData, setSelectedDayData] = useState<{
    date: Date | null;
    data: any;
  }>({ date: null, data: null });
  const [showDayModal, setShowDayModal] = useState(false);

  const modifiers = useMemo(() => {
    const hasAppointments = new Set<string>();
    const hasAvailabilities = new Set<string>();
    const highActivity = new Set<string>();
    const mediumActivity = new Set<string>();
    
    Object.entries(summary).forEach(([d, v]) => {
      const totalActivity = (v?.appointments || 0) + (v?.availabilities || 0);
      if ((v?.appointments || 0) > 0) hasAppointments.add(d);
      if ((v?.availabilities || 0) > 0) hasAvailabilities.add(d);
      
      if (totalActivity >= 10) highActivity.add(d);
      else if (totalActivity >= 5) mediumActivity.add(d);
    });
    
    const toDates = (set: Set<string>) => Array.from(set).map(d => new Date(d + 'T00:00:00'));
    return {
      hasAppointments: toDates(hasAppointments),
      hasAvailabilities: toDates(hasAvailabilities),
      highActivity: toDates(highActivity),
      mediumActivity: toDates(mediumActivity),
    } as any;
  }, [summary]);

  const classNames = useMemo(() => ({
    day_hasAppointments: 'relative hover:bg-blue-50 transition-colors cursor-pointer',
    day_hasAvailabilities: 'relative hover:bg-green-50 transition-colors cursor-pointer',
    day_highActivity: 'ring-2 ring-medical-500 ring-opacity-60',
    day_mediumActivity: 'ring-1 ring-medical-300 ring-opacity-40',
  }), []);

  const handleDayClick = (clickedDate: Date | undefined) => {
    if (!clickedDate) return;
    
    setDate(clickedDate);
    const iso = clickedDate.toISOString().split('T')[0];
    const dayData = summary[iso] || { appointments: 0, availabilities: 0 };
    
    setSelectedDayData({ date: clickedDate, data: dayData });
    setShowDayModal(true);
  };

  const getIntensityLevel = (appointments: number, availabilities: number) => {
    const total = appointments + availabilities;
    if (total >= 10) return 'high';
    if (total >= 5) return 'medium';
    if (total > 0) return 'low';
    return 'none';
  };

  const getStatusColor = (appointments: number, availabilities: number) => {
    const total = appointments + availabilities;
    if (total === 0) return 'bg-gray-100 border-gray-200';
    if (appointments === 0) return 'bg-green-50 border-green-200';
    if (availabilities === 0) return 'bg-red-50 border-red-200';
    return 'bg-blue-50 border-blue-200';
  };

  return (
    <>
      <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-medical-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-medical-600" />
              Calendario de Agendas
            </CardTitle>
            {date && (
              <Badge variant="secondary" className="bg-medical-100 text-medical-800">
                {format(date, "d 'de' MMMM", { locale: es })}
              </Badge>
            )}
          </div>
          {selectedFilters && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="w-4 h-4" />
              <span>
                {selectedFilters.doctors.length + selectedFilters.specialties.length + selectedFilters.locations.length} filtros activos
              </span>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-6">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDayClick}
            locale={es}
            className="w-full"
            modifiers={modifiers as any}
            classNames={{
              ...classNames,
              day: "h-12 w-12 text-center text-sm transition-all hover:bg-accent hover:text-accent-foreground focus-within:relative focus-within:z-20 rounded-md",
              day_selected: "bg-medical-600 text-white hover:bg-medical-700 hover:text-white focus:bg-medical-600 focus:text-white",
              day_today: "bg-accent text-accent-foreground font-semibold",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
              day_hidden: "invisible",
            } as any}
            components={{
              DayContent: (props: any) => {
                const d: Date = props.date;
                const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
                const info = summary[iso];
                const appts = info?.appointments || 0;
                const avails = info?.availabilities || 0;
                const intensity = getIntensityLevel(appts, avails);
                
                return (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`w-full h-full flex flex-col items-center justify-center gap-1 rounded-lg border-2 transition-all ${getStatusColor(appts, avails)} ${
                          intensity === 'high' ? 'ring-2 ring-medical-500' :
                          intensity === 'medium' ? 'ring-1 ring-medical-300' : ''
                        }`}>
                          <div className="text-sm font-medium">{d.getDate()}</div>
                          <div className="flex items-center gap-1">
                            {avails > 0 && (
                              <div className="flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                <span className="text-[10px] ml-0.5 text-green-700">{avails}</span>
                              </div>
                            )}
                            {appts > 0 && (
                              <div className="flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                <span className="text-[10px] ml-0.5 text-blue-700">{appts}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-white border shadow-lg">
                        <div className="text-xs space-y-1">
                          <div className="font-semibold">{format(d, "EEEE, d 'de' MMMM", { locale: es })}</div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span>{avails} disponibilidad{avails === 1 ? '' : 'es'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>{appts} cita{appts === 1 ? '' : 's'}</span>
                          </div>
                          {appts > 0 || avails > 0 ? (
                            <div className="text-medical-600 font-medium">Clic para ver detalles</div>
                          ) : (
                            <div className="text-gray-500">Sin actividad programada</div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              },
            }}
            onMonthChange={(month: Date) => {
              if (onMonthChange) onMonthChange(month.getUTCMonth(), month.getUTCFullYear());
            }}
          />
          
          {/* Leyenda mejorada */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <h4 className="text-sm font-semibold mb-3 text-gray-800">Leyenda</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span>Disponibilidades</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span>Citas agendadas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded border-2 border-medical-500"></span>
                <span>Alta actividad (10+)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded border border-medical-300"></span>
                <span>Media actividad (5-9)</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                💡 <strong>Tip:</strong> Haz clic en cualquier día para ver detalles y gestionar agendas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalles del día */}
      <DayDetailModal
        isOpen={showDayModal}
        onClose={() => setShowDayModal(false)}
        date={selectedDayData.date}
        dayData={selectedDayData.data}
        onCreateAvailability={onCreateAvailability}
        onViewAppointments={onViewAppointments}
      />
    </>
  );
};

export default EnhancedAppointmentCalendar;
