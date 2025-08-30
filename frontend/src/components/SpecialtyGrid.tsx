
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import SpecialtyCard from "./SpecialtyCard";
import SpecialtyDetailsModal from "./SpecialtyDetailsModal";

interface Patient {
  id: string;
  patientName: string;
  patientId: string;
  phone: string;
  email: string;
  age: number;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  duration: number;
  appointmentType: string;
  location: string;
  reason: string;
  status: string;
  insuranceType: string;
  notes?: string;
}

interface SpecialtyGridProps {
  groupedBySpecialty: Record<string, Patient[]>;
  selectedDate?: Date;
}

const SpecialtyGrid = ({ groupedBySpecialty }: SpecialtyGridProps) => {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewDetails = (specialty: string) => {
    setSelectedSpecialty(specialty);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSpecialty(null);
  };

  return (
    <div>
      {Object.keys(groupedBySpecialty).length === 0 ? (
        <Card className="border-medical-200">
          <CardContent className="p-8 text-center">
            <CalendarDays className="w-12 h-12 text-medical-300 mx-auto mb-4" />
            <p className="text-medical-600">No hay agendas disponibles</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(groupedBySpecialty).map(([specialty, patients]) => (
              <SpecialtyCard
                key={specialty}
                specialty={specialty}
                patients={patients}
                onViewDetails={() => handleViewDetails(specialty)}
              />
            ))}
          </div>

          {/* Modal de detalles */}
          {selectedSpecialty && (
            <SpecialtyDetailsModal
              isOpen={isModalOpen}
              onClose={handleCloseModal}
              specialty={selectedSpecialty}
              patients={groupedBySpecialty[selectedSpecialty] || []}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SpecialtyGrid;
