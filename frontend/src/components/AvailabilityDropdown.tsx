import { useState, useEffect } from 'react';
import { es } from 'date-fns/locale';
import { Clock, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { safeDateFromString, safeDayOfWeek, safeFormatDate } from '@/utils/dateHelpers';

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

interface AvailabilityDropdownProps {
  doctorId: number;
  specialtyId?: number;
  locationId?: number;
  onSlotSelect: (date: string, timeSlot: TimeSlot) => void;
  selectedDate?: string;
  selectedTimeSlot?: TimeSlot;
}

export function AvailabilityDropdown({
  doctorId,
  specialtyId,
  locationId,
  onSlotSelect,
  selectedDate,
  selectedTimeSlot
}: AvailabilityDropdownProps) {
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDateData, setSelectedDateData] = useState<AvailableDate | null>(null);

  // Cargar datos de disponibilidad directamente desde availability_distribution
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!doctorId) return;

      setLoading(true);
      try {
        // Usar endpoint existente que ya funciona
        const response = await api.getDistributionCalendar({
          doctor_id: doctorId,
          specialty_id: specialtyId,
          location_id: locationId,
          start_date: '2025-10-01', // Octubre 2025 donde están los datos
          end_date: '2025-10-31'
        });

        logger.debug('Availability Dropdown - Request:', { 
          doctor_id: doctorId, 
          specialty_id: specialtyId,
          location_id: locationId 
        });
        logger.debug('Availability Dropdown - Response:', response);

        if (response.success && response.data?.available_dates) {
          // Filtrar solo fechas con disponibilidad y excluir fines de semana
          const availableDatesFiltered = response.data.available_dates.filter(
            (date: AvailableDate) => {
              // Verificar que tenga slots disponibles
              if (date.total_available_slots <= 0) return false;
              
              // Verificar que no sea fin de semana
              const dayOfWeek = safeDayOfWeek(date.date);
              if (dayOfWeek === null || dayOfWeek === 0 || dayOfWeek === 6) return false;
              
              return true;
            }
          );
          setAvailableDates(availableDatesFiltered);
          logger.debug('Available dates filtered (no weekends):', availableDatesFiltered);
        } else {
          setAvailableDates([]);
          logger.debug('No available dates found');
        }
      } catch (error) {
        logger.error('Error al cargar disponibilidad:', error);
        setAvailableDates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [doctorId, specialtyId, locationId]);

  // Formatear fecha para mostrar
  const formatDateDisplay = (dateStr: string, dayName: string) => {
    try {
      const formattedDate = safeFormatDate(dateStr, 'EEEE, d MMMM', { locale: es }, '');
      if (!formattedDate) return `${dayName} (${dateStr})`;
      
      const date = safeDateFromString(dateStr);
      if (!date) return `${dayName} (${dateStr})`;
      
      return `${formattedDate} (${date.toLocaleDateString('es-ES')})`;
    } catch {
      return `${dayName} (${dateStr})`;
    }
  };

  // Formatear hora para mostrar
  const formatTime = (time: string) => {
    return time.slice(0, 5); // HH:MM
  };

  // Manejar selección de fecha
  const handleDateSelect = (dateStr: string) => {
    const dateData = availableDates.find(d => d.date === dateStr);
    setSelectedDateData(dateData || null);
  };

  // Manejar selección de horario
  const handleTimeSlotSelect = (timeSlot: TimeSlot) => {
    if (selectedDateData) {
      onSlotSelect(selectedDateData.date, timeSlot);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="w-4 h-4 mr-2 animate-spin" />
            <span>Cargando disponibilidad...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (availableDates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground">
            <Calendar className="w-4 h-4 mr-2" />
            <span>No hay fechas disponibles para este doctor y especialidad</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de Fecha */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center">
          <Calendar className="w-4 h-4 mr-2" />
          Seleccionar Fecha Disponible
        </label>
        <Select value={selectedDateData?.date || ''} onValueChange={handleDateSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una fecha..." />
          </SelectTrigger>
          <SelectContent>
            {availableDates.map((dateData) => (
              <SelectItem key={dateData.date} value={dateData.date}>
                <div className="flex items-center justify-between w-full">
                  <span>{formatDateDisplay(dateData.date, dateData.day_name)}</span>
                  <Badge variant="secondary" className="ml-2">
                    {dateData.total_available_slots} disponibles
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Horarios Disponibles */}
      {selectedDateData && selectedDateData.time_slots && selectedDateData.time_slots.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Horarios Disponibles para {formatDateDisplay(selectedDateData.date, selectedDateData.day_name)}
          </label>
          <div className="grid gap-2 max-h-60 overflow-y-auto">
            {selectedDateData.time_slots.map((slot) => (
              <Button
                key={`${slot.distribution_id}-${slot.start_time}`}
                variant={
                  selectedTimeSlot?.distribution_id === slot.distribution_id &&
                  selectedTimeSlot?.start_time === slot.start_time
                    ? "default"
                    : "outline"
                }
                size="sm"
                className="justify-between h-auto p-3"
                onClick={() => handleTimeSlotSelect(slot)}
                disabled={slot.available_slots <= 0}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">
                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Cupos: {slot.quota} | Asignados: {slot.assigned}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span className="text-sm font-bold">{slot.available_slots}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Estado cuando no hay horarios */}
      {selectedDateData && (!selectedDateData.time_slots || selectedDateData.time_slots.length === 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-center text-muted-foreground">
              <Clock className="w-4 h-4 mr-2" />
              <span>No hay horarios disponibles para esta fecha</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información de ayuda */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3" />
          <span>Solo se muestran fechas con disponibilidad</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3" />
          <span>Número indica cupos disponibles</span>
        </div>
      </div>
    </div>
  );
}