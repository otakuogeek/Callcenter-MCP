
import React, { useMemo } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { es } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AppointmentCalendarProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  summary?: Record<string, { appointments: number; availabilities: number }>;
  onMonthChange?: (month: number, year: number) => void; // month: 0-11
}

const AppointmentCalendar = ({ date, setDate, summary = {}, onMonthChange }: AppointmentCalendarProps) => {
  const modifiers = useMemo(() => {
    // create sets for decorated days
    const hasAppointments = new Set<string>();
    const hasAvailabilities = new Set<string>();
    Object.entries(summary).forEach(([d, v]) => {
      if ((v?.appointments || 0) > 0) hasAppointments.add(d);
      if ((v?.availabilities || 0) > 0) hasAvailabilities.add(d);
    });
    const toDates = (set: Set<string>) => Array.from(set).map(d => new Date(d + 'T00:00:00'));
    return {
      hasAppointments: toDates(hasAppointments),
      hasAvailabilities: toDates(hasAvailabilities),
      freeDays: Object.keys(summary)
        .filter(d => (summary[d].appointments || 0) === 0 && (summary[d].availabilities || 0) === 0)
        .map(d => new Date(d + 'T00:00:00')),
    } as any;
  }, [summary]);

  const classNames = useMemo(() => ({
    day_hasAppointments: 'relative',
    day_hasAvailabilities: 'relative',
  day_freeDays: 'relative',
  }), []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl">Calendario</CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
  <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          locale={es}
          className="w-full max-w-none mx-auto"
          // Pasar modificadores y clases para marcar días
          modifiers={modifiers as any}
          classNames={{
            ...classNames,
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
            month: "space-y-4 w-full",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.7rem] sm:text-[0.8rem] text-center",
            row: "flex w-full mt-2",
            cell: "relative p-0 text-center text-xs sm:text-sm focus-within:relative focus-within:z-20 flex-1 min-w-0 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
            day: "h-8 sm:h-9 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex items-center justify-center",
            day_range_end: "day-range-end",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground font-semibold",
            day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
          } as any}
          // Renderizado personalizado del día con indicadores
          components={{
            DayContent: (props: any) => {
              const d: Date = props.date;
              const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
              const info = summary[iso];
              const appts = info?.appointments || 0;
              const avails = info?.availabilities || 0;
              // Intensidad por nivel (simple): 1 punto normal, >=5 doble punto
              const apptDots = appts >= 5 ? 2 : appts > 0 ? 1 : 0;
              const availDots = avails >= 5 ? 2 : avails > 0 ? 1 : 0;
              return (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                        <div className="text-[10px] sm:text-xs leading-none">{d.getDate()}</div>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {/* Puntos verdes por disponibilidad */}
                          {Array.from({ length: availDots }).map((_, i) => (
                            <span key={`a-${i}`} className="block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-green-500"></span>
                          ))}
                          {/* Puntos azules por citas */}
                          {Array.from({ length: apptDots }).map((_, i) => (
                            <span key={`c-${i}`} className="block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-500"></span>
                          ))}
                          {/* Anillo gris con mejor contraste si está libre */}
                          {appts === 0 && avails === 0 && summary[iso] && (
                            <span className="block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ring-1 ring-border/70 dark:ring-border"></span>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-xs">
                        <div><strong>{iso}</strong></div>
                        <div>{appts} cita{appts === 1 ? '' : 's'}</div>
                        <div>{avails} disponibilidad{avails === 1 ? '' : 'es'}</div>
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
        {/* Leyenda */}
        <div className="mt-3 flex items-center justify-center gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500"></span> disponibilidad</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500"></span> citas</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ring-1 ring-gray-300"></span> libre</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppointmentCalendar;
