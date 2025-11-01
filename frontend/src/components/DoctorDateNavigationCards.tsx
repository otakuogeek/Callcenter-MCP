import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, isSameDay, isToday, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Users, 
  Stethoscope,
  Eye
} from "lucide-react";

interface DoctorDateNavigationCardsProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  summary?: Record<string, { 
    appointments: number; 
    availabilities: number;
  }>;
  onViewAppointments: (date: string) => void;
}

const DoctorDateNavigationCards = ({
  date,
  setDate,
  summary = {},
  onViewAppointments,
}: DoctorDateNavigationCardsProps) => {
  // Estado para la semana actual
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 }); // Lunes como primer día
  });

  // Generar los 7 días de la semana actual
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

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
    const dayData = getDayData(day);
    const hasAppointments = dayData.appointments > 0;
    return hasAppointments && !isDayPast;
  };

  return (
    <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Mis Citas - Calendario Semanal
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
          {weekDays.map((day) => {
            const dayData = getDayData(day);
            const isSelected = date && isSameDay(day, date);
            const isDayToday = isToday(day);
            const isDayPast = isPast(day) && !isDayToday;
            const hasActivity = dayData.appointments > 0 || dayData.availabilities > 0;
            const isoDate = format(day, 'yyyy-MM-dd');

            return (
              <Card
                key={isoDate}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${getCardStyle(day)}`}
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

                  {/* Información del día */}
                  {hasActivity ? (
                    <div className="space-y-2 mb-3">
                      {/* Agendas */}
                      {dayData.availabilities > 0 && (
                        <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-medium text-gray-700">Agendas</span>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {dayData.availabilities}
                          </Badge>
                        </div>
                      )}

                      {/* Citas */}
                      <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
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
                      <p className="text-xs text-gray-500">Sin citas</p>
                    </div>
                  )}

                  {/* Acciones */}
                  {showActions(day) && (
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🔍 Ver citas del día:', isoDate, 'Citas:', dayData.appointments);
                          onViewAppointments(isoDate);
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ver Citas del Día
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
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
              <span className="text-xs text-gray-600">Con citas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-gray-200 bg-gray-50"></div>
              <span className="text-xs text-gray-600">Sin citas</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorDateNavigationCards;
