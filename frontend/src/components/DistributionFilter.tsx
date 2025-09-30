import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import api from '@/lib/api';
import { Calendar, Filter, Search, X, Users, MapPin, Stethoscope, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FilterParams {
  start_date?: string;
  end_date?: string;
  doctor_id?: number;
  specialty_id?: number;
  location_id?: number;
}

interface FilterOptions {
  doctors: Array<{ id: number; name: string }>;
  specialties: Array<{ id: number; name: string }>;
  locations: Array<{ id: number; name: string }>;
}

interface DistributionFilterProps {
  onFilterChange: (params: FilterParams) => void;
  onClearFilters: () => void;
}

const DistributionFilter: React.FC<DistributionFilterProps> = ({ 
  onFilterChange, 
  onClearFilters 
}) => {
  const [filters, setFilters] = useState<FilterParams>({});
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    doctors: [],
    specialties: [],
    locations: []
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Cargar opciones de filtros al montar el componente
  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    setLoading(true);
    try {
      const response = await api.getFilterOptions();
      if (response.success) {
        setFilterOptions(response.data);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las opciones de filtro",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Actualizar filtros activos cuando cambian los filtros
  useEffect(() => {
    const active: string[] = [];
    if (filters.start_date) active.push(`Desde: ${format(new Date(filters.start_date), 'dd/MM/yyyy')}`);
    if (filters.end_date) active.push(`Hasta: ${format(new Date(filters.end_date), 'dd/MM/yyyy')}`);
    if (filters.doctor_id) {
      const doctor = filterOptions.doctors.find(d => d.id === filters.doctor_id);
      if (doctor) active.push(`Doctor: ${doctor.name}`);
    }
    if (filters.specialty_id) {
      const specialty = filterOptions.specialties.find(s => s.id === filters.specialty_id);
      if (specialty) active.push(`Especialidad: ${specialty.name}`);
    }
    if (filters.location_id) {
      const location = filterOptions.locations.find(l => l.id === filters.location_id);
      if (location) active.push(`Ubicación: ${location.name}`);
    }
    setActiveFilters(active);
  }, [filters, filterOptions]);

  const handleFilterChange = (key: keyof FilterParams, value: any) => {
    const newFilters = { ...filters };
    if (value === "" || value === undefined) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    setFilters(newFilters);
  };

  const applyFilters = () => {
    onFilterChange(filters);
  };

  const clearAllFilters = () => {
    setFilters({});
    onClearFilters();
  };

  const removeFilter = (filterText: string) => {
    const newFilters = { ...filters };
    
    if (filterText.startsWith('Desde:')) {
      delete newFilters.start_date;
    } else if (filterText.startsWith('Hasta:')) {
      delete newFilters.end_date;
    } else if (filterText.startsWith('Doctor:')) {
      delete newFilters.doctor_id;
    } else if (filterText.startsWith('Especialidad:')) {
      delete newFilters.specialty_id;
    } else if (filterText.startsWith('Ubicación:')) {
      delete newFilters.location_id;
    }
    
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros de Distribución
          {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <CardDescription>
          Filtra las distribuciones por fecha, doctor, especialidad o ubicación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros de fecha */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Fecha de inicio
            </Label>
            <Input
              id="start_date"
              type="date"
              value={filters.start_date || ''}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Fecha de fin
            </Label>
            <Input
              id="end_date"
              type="date"
              value={filters.end_date || ''}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Filtros de selección */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Doctor
            </Label>
            <Select 
              value={filters.doctor_id?.toString() || ""} 
              onValueChange={(value) => handleFilterChange('doctor_id', value ? parseInt(value) : undefined)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los doctores</SelectItem>
                {filterOptions.doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id.toString()}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Especialidad
            </Label>
            <Select 
              value={filters.specialty_id?.toString() || ""} 
              onValueChange={(value) => handleFilterChange('specialty_id', value ? parseInt(value) : undefined)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar especialidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las especialidades</SelectItem>
                {filterOptions.specialties.map((specialty) => (
                  <SelectItem key={specialty.id} value={specialty.id.toString()}>
                    {specialty.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ubicación
            </Label>
            <Select 
              value={filters.location_id?.toString() || ""} 
              onValueChange={(value) => handleFilterChange('location_id', value ? parseInt(value) : undefined)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las ubicaciones</SelectItem>
                {filterOptions.locations.map((location) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <Button onClick={applyFilters} className="flex-1" disabled={loading}>
            <Search className="h-4 w-4 mr-2" />
            Aplicar Filtros
          </Button>
          <Button variant="outline" onClick={clearAllFilters} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
          <Button variant="outline" onClick={loadFilterOptions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filtros activos */}
        {activeFilters.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtros activos:</Label>
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeFilter(filter)}
                  >
                    {filter}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DistributionFilter;