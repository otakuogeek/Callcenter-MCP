
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface DateFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  specialtyFilter: string;
  onSpecialtyFilterChange: (value: string) => void;
  specialties: string[];
}

const DateFilters = ({ 
  searchTerm, 
  onSearchChange, 
  specialtyFilter, 
  onSpecialtyFilterChange, 
  specialties 
}: DateFiltersProps) => {
  return (
    <Card className="border-medical-200">
      <CardHeader>
        <CardTitle className="text-medical-800">Filtros de Búsqueda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-medical-400" />
              <Input
                placeholder="Buscar por paciente, médico, especialidad..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={specialtyFilter} onValueChange={onSpecialtyFilterChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Especialidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las especialidades</SelectItem>
              {specialties.map(specialty => (
                <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default DateFilters;
