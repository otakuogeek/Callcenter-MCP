import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, isSameDay, isToday, isPast, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Users, 
  Stethoscope,
  Eye,
  Plus,
  TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";

interface DateNavigationCardsProps {
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
  onCreateAvailability: (date: string) => void;
  onViewAppointments: (date: string) => void;
  onMonthChange?: (month: number, year: number) => void;
}

const DateNavigationCards = ({
  date,
  setDate,
  summary = {},
  onCreateAvailability,
  onViewAppointments,
  onMonthChange,
}: DateNavigationCardsProps) => {
  // Estado para la semana actual
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 }); // Lunes como primer día
  });

  // Generar los 7 días de la semana actual
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Notificar cambios de mes cuando cambia la semana
  useEffect(() => {
    if (onMonthChange && weekDays.length > 0) {
      // Obtener todos los meses únicos de la semana
      const uniqueMonths = new Set<string>();
      weekDays.forEach(day => {
        const month = day.getMonth();
        const year = day.getFullYear();
        uniqueMonths.add(`${year}-${month}`);
      });
      
      // Cargar el summary para cada mes único
      uniqueMonths.forEach(monthYear => {
        const [year, month] = monthYear.split('-').map(Number);
        onMonthChange(month, year);
      });
    }
  }, [currentWeekStart, onMonthChange, weekDays]);

  // Navegar a la semana anterior
  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, -7));
  };

  // Navegar a la semana siguiente
  const goToNextWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, 7));
  };

  // Volver a la semana actual
  const goToCurrentWeek = () => {
    const today = new Date();
    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  // Seleccionar un día
  const selectDay = (selectedDate: Date) => {
    setDate(selectedDate);
  };

  // Obtener datos del día desde el summary
  const getDayData = (day: Date) => {
    const isoDate = format(day, 'yyyy-MM-dd');
    return summary[isoDate] || { appointments: 0, availabilities: 0 };
  };

  // Determinar el color del card según el estado
  const getCardStyle = (day: Date) => {
    const dayData = getDayData(day);
    const isSelected = date && isSameDay(day, date);
    const isDayToday = isToday(day);
    const isDayPast = isPast(day) && !isDayToday;
    const hasActivity = dayData.appointments > 0 || dayData.availabilities > 0;

    if (isSelected) {
      return "border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg ring-2 ring-blue-400";
    }
    if (isDayToday) {
      return "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md";
    }
    if (isDayPast) {
      return "border-gray-200 bg-gray-50 opacity-60";
    }
    if (hasActivity) {
      return "border-blue-300 bg-gradient-to-br from-blue-50/50 to-white hover:shadow-lg transition-all";
    }
    return "border-gray-200 bg-white hover:shadow-md transition-all";
  };

  // Determinar si se debe mostrar el botón de acciones
  const showActions = (day: Date) => {
    const isDayToday = isToday(day);
    const isDayPast = isPast(day) && !isDayToday;
    return !isDayPast;
  };

  return (
    <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Navegación por Semana
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {format(currentWeekStart, "d 'de' MMMM", { locale: es })} - {format(addDays(currentWeekStart, 6), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousWeek}
              className="h-9 w-9 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={goToCurrentWeek}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Hoy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextWeek}
              className="h-9 w-9 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayData = getDayData(day);
            const isSelected = date && isSameDay(day, date);
            const isDayToday = isToday(day);
            const isDayPast = isPast(day) && !isDayToday;
            const hasActivity = dayData.appointments > 0 || dayData.availabilities > 0;
            const isoDate = format(day, 'yyyy-MM-dd');

            return (
              <motion.div
                key={isoDate}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card
                  className={`cursor-pointer transition-all duration-300 hover:scale-105 ${getCardStyle(day)}`}
                  onClick={() => selectDay(day)}
                >
                  <CardContent className="p-4">
                    {/* Header del día */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600 uppercase">
                          {format(day, 'EEEE', { locale: es })}
                        </span>
                        {isDayToday && (
                          <Badge variant="default" className="bg-green-500 text-white text-xs px-2 py-0">
                            Hoy
                          </Badge>
                        )}
                        {isSelected && !isDayToday && (
                          <Badge variant="default" className="bg-blue-500 text-white text-xs px-2 py-0">
                            Seleccionado
                          </Badge>
                        )}
                      </div>
                      <div className="text-3xl font-bold text-gray-900">
                        {format(day, 'd')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(day, 'MMMM yyyy', { locale: es })}
                      </div>
                    </div>

                    {/* Estadísticas del día */}
                    {hasActivity ? (
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between p-2 bg-white/80 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-medium text-gray-700">Agendas</span>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {dayData.availabilities}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white/80 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-medium text-gray-700">Citas</span>
                          </div>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            {dayData.appointments}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500">Sin actividad</p>
                      </div>
                    )}

                    {/* Acciones */}
                    {showActions(day) && (
                      <div className="space-y-2">
                        {hasActivity && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewAppointments(isoDate);
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Ver Detalles
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateAvailability(isoDate);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {hasActivity ? 'Agregar Agenda' : 'Crear Agenda'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs font-medium text-gray-700 mb-3">Leyenda:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-50"></div>
              <span className="text-xs text-gray-600">Día actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-blue-600 bg-blue-50"></div>
              <span className="text-xs text-gray-600">Seleccionado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-blue-300 bg-blue-50"></div>
              <span className="text-xs text-gray-600">Con actividad</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-gray-200 bg-gray-50"></div>
              <span className="text-xs text-gray-600">Sin actividad</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DateNavigationCards;
