
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import DailyStats from "./DailyStats";
import DateFilters from "./DateFilters";
import SpecialtyGrid from "./SpecialtyGrid";
import ManualAppointmentModal from "./ManualAppointmentModal";
import { usePatientData } from "@/hooks/usePatientData";

const DailySchedule = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [isManualAppointmentOpen, setIsManualAppointmentOpen] = useState(false);

  const { scheduledPatients, specialties, getFilteredPatients, getGroupedByDate, refresh } = usePatientData();

  // Filtrar pacientes sin fecha específica
  const filteredPatients = getFilteredPatients(searchTerm, specialtyFilter);

  // Agrupar por fecha
  const groupedByDate = getGroupedByDate(filteredPatients);

  const handleManualAppointment = () => {
    console.log("Abriendo modal para agendar cita manual");
    setIsManualAppointmentOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-medical-800">Agenda Diaria</h1>
          <p className="text-medical-600 mt-1">
            Visualiza las agendas organizadas por fecha y especialidad
          </p>
        </div>
        <Button 
          onClick={handleManualAppointment}
          className="bg-medical-600 hover:bg-medical-700"
        >
          <CalendarPlus className="w-4 h-4 mr-2" />
          Agendar Cita Manual
        </Button>
      </div>

      {/* Estadísticas del día */}
      <DailyStats 
        patients={scheduledPatients}
        currentDate={format(new Date(), "yyyy-MM-dd")}
        specialtyCount={specialties.length}
      />

      {/* Filtros */}
      <DateFilters 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        specialtyFilter={specialtyFilter}
        onSpecialtyFilterChange={setSpecialtyFilter}
        specialties={specialties}
      />

      {/* Agendas por fecha */}
      <div className="space-y-8">
        {Object.keys(groupedByDate).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-medical-600">No hay agendas disponibles con los filtros seleccionados</p>
          </div>
        ) : (
          Object.entries(groupedByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, patients]) => (
              <div key={date} className="space-y-4">
                <h2 className="text-2xl font-bold text-medical-800 border-b border-medical-200 pb-2">
                  {format(new Date(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                </h2>
                <SpecialtyGrid 
                  groupedBySpecialty={patients.reduce((acc, patient) => {
                    if (!acc[patient.specialty]) {
                      acc[patient.specialty] = [];
                    }
                    acc[patient.specialty].push(patient);
                    return acc;
                  }, {} as Record<string, typeof patients>)}
                  selectedDate={new Date(date)}
                />
              </div>
            ))
        )}
      </div>

      {/* Modal de agendar cita manual */}
      <ManualAppointmentModal
        isOpen={isManualAppointmentOpen}
        onClose={() => setIsManualAppointmentOpen(false)}
        onSuccess={() => refresh()}
      />
    </div>
  );
};

export default DailySchedule;
