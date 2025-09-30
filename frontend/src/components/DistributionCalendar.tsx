import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, User, MapPin, Users, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDistribution, DistributionDay } from '@/hooks/useDistribution';
import { cn } from '@/lib/utils';
import { format, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface AvailabilityInfo {
  id: number;
  doctor_name: string;
  specialty_name: string;
  location_name: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  status: string;
}

interface DistributionCalendarProps {
  availabilityId?: number;
  availabilityInfo?: AvailabilityInfo;
}

interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  distributionsForDay: DistributionDay[];
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  distributionsForDay
}) => {
  const [currentDoctorIndex, setCurrentDoctorIndex] = useState(0);

  // Reset index when modal opens or date changes
  useEffect(() => {
    setCurrentDoctorIndex(0);
  }, [selectedDate, isOpen]);

  if (!selectedDate || !distributionsForDay.length) return null;

  const currentDistribution = distributionsForDay[currentDoctorIndex];
  const totalDoctors = distributionsForDay.length;

  const remaining = currentDistribution.quota - currentDistribution.assigned;
  const occupancyPercent = currentDistribution.quota > 0 ? (currentDistribution.assigned / currentDistribution.quota) * 100 : 0;

  const handlePrevDoctor = () => {
    setCurrentDoctorIndex((prev) => (prev > 0 ? prev - 1 : totalDoctors - 1));
  };

  const handleNextDoctor = () => {
    setCurrentDoctorIndex((prev) => (prev < totalDoctors - 1 ? prev + 1 : 0));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
          </DialogTitle>
          <DialogDescription>
            {totalDoctors === 1 
              ? "Detalles de disponibilidad para este día" 
              : `${totalDoctors} doctores disponibles este día`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Navegación entre doctores */}
          {totalDoctors > 1 && (
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevDoctor}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              
              <div className="text-sm font-medium">
                {currentDoctorIndex + 1} de {totalDoctors} doctores
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextDoctor}
                className="flex items-center gap-1"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Información del Doctor y Especialidad */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-4 w-4" />
                {currentDistribution.doctor_name || 'Doctor no especificado'}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {currentDistribution.specialty_name || 'Especialidad'} • {currentDistribution.location_name || 'Ubicación'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {currentDistribution.start_time || '08:00'} - {currentDistribution.end_time || '17:00'}
              </div>
            </CardContent>
          </Card>

          {/* Información de Cupos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4" />
                Disponibilidad de Cupos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{currentDistribution.quota}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{remaining}</div>
                  <div className="text-xs text-muted-foreground">Disponibles</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{currentDistribution.assigned}</div>
                  <div className="text-xs text-muted-foreground">Asignados</div>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Ocupación</span>
                  <span>{occupancyPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      occupancyPercent < 50 ? "bg-green-500" :
                      occupancyPercent < 80 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Estado */}
              <div className="flex justify-center">
                <Badge 
                  variant={remaining > 0 ? "default" : "secondary"}
                  className={cn(
                    remaining > 5 ? "bg-green-100 text-green-800" :
                    remaining > 0 ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  )}
                >
                  {remaining > 0 ? `${remaining} cupos disponibles` : "Sin cupos disponibles"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Resumen de todos los doctores del día */}
          {totalDoctors > 1 && (
            <Card className="bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Resumen del día</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="font-semibold text-blue-600">
                      {distributionsForDay.reduce((sum, d) => sum + d.quota, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total día</div>
                  </div>
                  <div>
                    <div className="font-semibold text-green-600">
                      {distributionsForDay.reduce((sum, d) => sum + (d.quota - d.assigned), 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Disponibles día</div>
                  </div>
                  <div>
                    <div className="font-semibold text-orange-600">
                      {distributionsForDay.reduce((sum, d) => sum + d.assigned, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Asignados día</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const DistributionCalendar: React.FC<DistributionCalendarProps> = ({
  availabilityId,
  availabilityInfo
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { distributionList, loading, getDistribution, getAllDistributions, simulateDistribution } = useDistribution();

  useEffect(() => {
    if (availabilityId) {
      getDistribution(availabilityId);
    } else {
      // Cargar todas las distribuciones de la base de datos
      getAllDistributions();
    }
  }, [availabilityId]);

  const handleDayClick = (date: Date) => {
    // Buscar todas las distribuciones para este día
    const distributionsForDay = distributionList.filter(d => 
      isSameDay(parseISO(d.day_date), date)
    );

    if (distributionsForDay.length > 0) {
      setSelectedDate(date);
      setIsModalOpen(true);
    }
  };

  const getDistributionsForSelectedDay = () => {
    if (!selectedDate) return [];
    return distributionList.filter(d => 
      isSameDay(parseISO(d.day_date), selectedDate)
    );
  };

  // Personalizar los días del calendario considerando múltiples doctores
  const modifiers = {
    hasDistribution: distributionList.map(d => parseISO(d.day_date)),
    hasAvailableSlots: distributionList
      .filter(d => (d.quota - d.assigned) > 0)
      .map(d => parseISO(d.day_date)),
    fullyBooked: (() => {
      // Un día está completamente reservado si TODOS los doctores están llenos
      const dayGroups = distributionList.reduce((groups, d) => {
        const date = d.day_date;
        if (!groups[date]) groups[date] = [];
        groups[date].push(d);
        return groups;
      }, {} as Record<string, DistributionDay[]>);
      
      return Object.entries(dayGroups)
        .filter(([_, distributions]) => 
          distributions.every(d => (d.quota - d.assigned) === 0)
        )
        .map(([date, _]) => parseISO(date));
    })(),
    multipleDoctors: (() => {
      // Marcar días con múltiples doctores
      const dayGroups = distributionList.reduce((groups, d) => {
        const date = d.day_date;
        if (!groups[date]) groups[date] = [];
        groups[date].push(d);
        return groups;
      }, {} as Record<string, DistributionDay[]>);
      
      return Object.entries(dayGroups)
        .filter(([_, distributions]) => distributions.length > 1)
        .map(([date, _]) => parseISO(date));
    })()
  };

  const modifiersStyles = {
    hasDistribution: {
      fontWeight: 'bold',
      position: 'relative' as const,
    },
    hasAvailableSlots: {
      backgroundColor: '#dcfce7',
      color: '#166534',
      borderRadius: '6px'
    },
    fullyBooked: {
      backgroundColor: '#fecaca',
      color: '#991b1b',
      borderRadius: '6px'
    },
    multipleDoctors: {
      border: '2px solid #3b82f6',
      borderRadius: '6px'
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendario de Distribución</CardTitle>
          <CardDescription>Cargando distribución...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Calendario de Distribución</CardTitle>
          <CardDescription>
            Haz clic en los días marcados para ver detalles de disponibilidad
            {distributionList.length > 0 && (
              <span className="block mt-1">
                {distributionList.length} distribuciones • 
                {distributionList.reduce((sum, d) => sum + d.quota, 0)} cupos totales
                {(() => {
                  const uniqueDays = new Set(distributionList.map(d => d.day_date)).size;
                  const uniqueDoctors = new Set(distributionList.map(d => d.doctor_name)).size;
                  return ` • ${uniqueDays} días • ${uniqueDoctors} doctores`;
                })()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {distributionList.length > 0 ? (
            <div className="space-y-4">
              <Calendar
                mode="single"
                onDayClick={handleDayClick}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                className="rounded-md border"
                locale={es}
              />
              
              {/* Leyenda */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-500 rounded"></div>
                  <span>Con cupos disponibles</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-500 rounded"></div>
                  <span>Sin cupos disponibles</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
                  <span>Múltiples doctores</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay distribución configurada para esta agenda</p>
            </div>
          )}
        </CardContent>
      </Card>

      <DayDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        distributionsForDay={getDistributionsForSelectedDay()}
      />
    </>
  );
};

export default DistributionCalendar;