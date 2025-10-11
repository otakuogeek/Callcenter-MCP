import { useState, useEffect, useMemo } from 'react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api';

interface TimeSlot {
  distribution_id: number;
  availability_id: number;
  start_time: string;
  end_time: string;
  available_slots: number;
  quota: number;
  assigned: number;
}

interface AvailableDate {
  date: string;
  day_name: string;
  total_available_slots: number;
  time_slots: TimeSlot[];
}

interface AvailabilityCalendarProps {
  doctorId: number;
  specialtyId?: number;
  locationId?: number;
  onSlotSelect: (date: string, timeSlot: TimeSlot) => void;
  selectedDate?: string;
  selectedTimeSlot?: TimeSlot;
}

export function AvailabilityCalendar({
  doctorId,
  specialtyId,
  locationId,
  onSlotSelect,
  selectedDate,
  selectedTimeSlot
}: AvailabilityCalendarProps) {
  // Iniciar en octubre 2025 donde están los datos de prueba
  const [currentDate, setCurrentDate] = useState(new Date(2025, 9, 1)); // Octubre 2025
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar datos de disponibilidad
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!doctorId) return;

      setLoading(true);
      try {
        const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

        const response = await api.getDistributionCalendar({
          doctor_id: doctorId,
          specialty_id: specialtyId,
          location_id: locationId,
          start_date: startDate,
          end_date: endDate
        });

        console.log('Availability Calendar - Request:', { 
          doctor_id: doctorId, 
          start_date: startDate, 
          end_date: endDate 
        });
        console.log('Availability Calendar - Response:', response);

        if (response.success) {
          setAvailableDates(response.data.available_dates);
          console.log('Available dates set:', response.data.available_dates);
        }
      } catch (error) {
        console.error('Error al cargar disponibilidad:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [doctorId, specialtyId, locationId, currentDate]);

  // Obtener los días del mes actual para mostrar en el calendario
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunes como primer día
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Crear un mapa de fechas disponibles para búsqueda O(1)
  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailableDate>();
    availableDates.forEach(avail => {
      const availDate = new Date(avail.date);
      const availDateStr = format(availDate, 'yyyy-MM-dd');
      map.set(availDateStr, avail);
    });
    return map;
  }, [availableDates]);

  // Obtener información de disponibilidad para una fecha específica
  const getDateAvailability = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityMap.get(dateStr);
  };

  // Navegar entre meses
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Formatear hora para mostrar
  const formatTime = (time: string) => {
    return time.slice(0, 5); // HH:MM
  };

  return (
    <div className="space-y-4">
      {/* Header del calendario */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h3 className="font-semibold">
          {format(currentDate, 'MMMM yyyy', { locale: es })}
        </h3>
        
        <Button variant="outline" size="sm" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-muted-foreground">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="p-2">
            {day}
          </div>
        ))}
      </div>

      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(day => {
          const availability = getDateAvailability(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isPast = isBefore(day, new Date()) && !isToday(day);
          const hasAvailability = availability && availability.total_available_slots > 0;
          const isSelected = selectedDate === format(day, 'yyyy-MM-dd');

          return (
            <div key={day.toISOString()} className="aspect-square">
              {hasAvailability && !isPast ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      className={`
                        w-full h-full p-1 text-xs flex flex-col items-center justify-center
                        ${!isCurrentMonth ? 'text-muted-foreground opacity-40' : ''}
                        ${isToday(day) ? 'border-primary border-2' : ''}
                        hover:bg-primary/10
                      `}
                    >
                      <span>{format(day, 'd')}</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {availability.total_available_slots}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {format(day, 'EEEE, d MMMM', { locale: es })}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Horarios disponibles:
                        </p>
                        
                        <div className="grid gap-2 max-h-40 overflow-y-auto">
                          {availability.time_slots.map(slot => (
                            <Button
                              key={`${slot.distribution_id}-${slot.start_time}`}
                              variant={
                                selectedTimeSlot?.distribution_id === slot.distribution_id &&
                                selectedTimeSlot?.start_time === slot.start_time
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              className="justify-between"
                              onClick={() => onSlotSelect(format(day, 'yyyy-MM-dd'), slot)}
                            >
                              <span>
                                {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                              </span>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span className="text-xs">{slot.available_slots}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <div className={`
                  w-full h-full p-1 text-xs flex items-center justify-center
                  ${!isCurrentMonth ? 'text-muted-foreground opacity-40' : ''}
                  ${isPast ? 'text-muted-foreground' : ''}
                  ${isToday(day) ? 'bg-primary/10 rounded border border-primary' : ''}
                `}>
                  {format(day, 'd')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-primary rounded"></div>
          <span>Día actual</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] px-1 py-0">N</Badge>
          <span>Citas disponibles</span>
        </div>
      </div>

      {loading && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Cargando disponibilidad...
        </div>
      )}
    </div>
  );
}