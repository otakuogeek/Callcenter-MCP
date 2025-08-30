
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Filter, 
  X, 
  Check, 
  ChevronDown,
  User,
  MapPin,
  Stethoscope,
  Calendar,
  Clock,
  Search,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Location } from "@/hooks/useAppointmentData";

interface Doctor {
  id: number;
  name: string;
  specialties: string[];
}

interface Specialty {
  id: number;
  name: string;
}

interface EnhancedFilters {
  doctors: number[];
  specialties: number[];
  locations: number[];
  dateRange: {
    start: string;
    end: string;
  };
  status: string[];
  timeRange: {
    start: string;
    end: string;
  };
  searchTerm: string;
}

interface AppointmentFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedLocation: string;
  setSelectedLocation: (value: string) => void;
  selectedSpecialty: string;
  setSelectedSpecialty: (value: string) => void;
  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  getActiveLocations: () => Location[];
  specialties: string[];
  // Enhanced props (optional for backward compatibility)
  doctors?: Doctor[];
  onEnhancedFiltersChange?: (filters: EnhancedFilters) => void;
  enhancedMode?: boolean;
}

const MultiSelectPopover = ({ 
  title, 
  options, 
  selected, 
  onSelectionChange, 
  icon: Icon,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar..."
}: {
  title: string;
  options: Array<{ id: number; name: string; extra?: string }>;
  selected: number[];
  onSelectionChange: (ids: number[]) => void;
  icon: React.ElementType;
  placeholder?: string;
  searchPlaceholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const toggleSelection = (id: number) => {
    const newSelection = selected.includes(id)
      ? selected.filter(item => item !== id)
      : [...selected, id];
    onSelectionChange(newSelection);
  };

  const selectedNames = options
    .filter(option => selected.includes(option.id))
    .map(option => option.name);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 sm:h-10 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-2">
            <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
            <span className="truncate">
              {selected.length === 0 
                ? placeholder 
                : selected.length === 1 
                  ? selectedNames[0]
                  : `${selected.length} seleccionados`
              }
            </span>
          </div>
          <ChevronDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={searchValue} onValueChange={setSearchValue} />
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.id}
                value={option.name}
                onSelect={() => toggleSelection(option.id)}
                className="flex items-center space-x-2"
              >
                <Checkbox
                  checked={selected.includes(option.id)}
                  onChange={() => toggleSelection(option.id)}
                />
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm">{option.name}</span>
                  {option.extra && (
                    <span className="text-xs text-gray-500">{option.extra}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const AppointmentFilters = ({
  searchTerm,
  setSearchTerm,
  selectedLocation,
  setSelectedLocation,
  selectedSpecialty,
  setSelectedSpecialty,
  selectedStatus,
  setSelectedStatus,
  getActiveLocations,
  specialties,
  doctors = [],
  onEnhancedFiltersChange,
  enhancedMode = false
}: AppointmentFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [enhancedFilters, setEnhancedFilters] = useState<EnhancedFilters>({
    doctors: [],
    specialties: [],
    locations: [],
    dateRange: { start: '', end: '' },
    status: [],
    timeRange: { start: '', end: '' },
    searchTerm: ''
  });

  useEffect(() => {
    setEnhancedFilters(prev => ({ ...prev, searchTerm }));
  }, [searchTerm]);

  const updateEnhancedFilters = (key: keyof EnhancedFilters, value: any) => {
    const newFilters = { ...enhancedFilters, [key]: value };
    setEnhancedFilters(newFilters);
    if (onEnhancedFiltersChange) {
      onEnhancedFiltersChange(newFilters);
    }
  };

  const getActiveFiltersCount = () => {
    if (!enhancedMode) return 0;
    return (
      enhancedFilters.doctors.length +
      enhancedFilters.specialties.length +
      enhancedFilters.locations.length +
      enhancedFilters.status.length +
      (enhancedFilters.dateRange.start || enhancedFilters.dateRange.end ? 1 : 0) +
      (enhancedFilters.timeRange.start || enhancedFilters.timeRange.end ? 1 : 0)
    );
  };

  const clearAllFilters = () => {
    if (enhancedMode) {
      const emptyFilters = {
        doctors: [],
        specialties: [],
        locations: [],
        dateRange: { start: '', end: '' },
        status: [],
        timeRange: { start: '', end: '' },
        searchTerm: ''
      };
      setEnhancedFilters(emptyFilters);
      if (onEnhancedFiltersChange) {
        onEnhancedFiltersChange(emptyFilters);
      }
    }
    setSearchTerm('');
    setSelectedLocation('all');
    setSelectedSpecialty('all');
    setSelectedStatus('all');
  };

  const statusOptions = [
    { id: 'Confirmada', name: 'Confirmada', color: 'bg-green-100 text-green-800' },
    { id: 'Pendiente', name: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    { id: 'Completada', name: 'Completada', color: 'bg-blue-100 text-blue-800' },
    { id: 'Cancelada', name: 'Cancelada', color: 'bg-red-100 text-red-800' },
  ];

  if (!enhancedMode) {
    // Modo original para compatibilidad hacia atrás
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="search" className="text-xs sm:text-sm">Buscar Paciente/Doctor/Teléfono</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                <Input
                  id="search"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-xs sm:text-sm h-8 sm:h-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location-filter" className="text-xs sm:text-sm">Ubicación</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Todas las ubicaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ubicaciones</SelectItem>
                  {getActiveLocations().map((location) => (
                    <SelectItem key={location.id} value={location.name}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="specialty-filter" className="text-xs sm:text-sm">Especialidad</Label>
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Todas las especialidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las especialidades</SelectItem>
                  {specialties.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter" className="text-xs sm:text-sm">Estado</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="Confirmada">Confirmada</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Completada">Completada</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Modo mejorado con filtros avanzados
  return (
    <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-medical-600" />
            Filtros de Agenda
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="bg-medical-100 text-medical-800">
                {getActiveFiltersCount()} activos
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? 'Contraer' : 'Expandir'}
            </Button>
            {getActiveFiltersCount() > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Búsqueda principal siempre visible */}
        <div className="mb-4">
          <Label htmlFor="search" className="text-sm font-medium mb-2 block">
            Búsqueda General
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              id="search"
              placeholder="Buscar doctor, paciente, teléfono..."
              value={enhancedFilters.searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                updateEnhancedFilters('searchTerm', e.target.value);
              }}
              className="pl-8"
            />
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Filtros principales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="doctors" className="text-sm font-medium mb-2 block">
                    Doctores
                  </Label>
                  <MultiSelectPopover
                    title="Doctores"
                    options={doctors.map(d => ({ 
                      id: d.id, 
                      name: d.name, 
                      extra: d.specialties.join(', ') 
                    }))}
                    selected={enhancedFilters.doctors}
                    onSelectionChange={(ids) => updateEnhancedFilters('doctors', ids)}
                    icon={User}
                    placeholder="Todos los doctores"
                    searchPlaceholder="Buscar doctor..."
                  />
                </div>

                <div>
                  <Label htmlFor="specialties" className="text-sm font-medium mb-2 block">
                    Especialidades
                  </Label>
                  <MultiSelectPopover
                    title="Especialidades"
                    options={specialties.map((s, i) => ({ id: i, name: s }))}
                    selected={enhancedFilters.specialties}
                    onSelectionChange={(ids) => updateEnhancedFilters('specialties', ids)}
                    icon={Stethoscope}
                    placeholder="Todas las especialidades"
                    searchPlaceholder="Buscar especialidad..."
                  />
                </div>

                <div>
                  <Label htmlFor="locations" className="text-sm font-medium mb-2 block">
                    Ubicaciones
                  </Label>
                  <MultiSelectPopover
                    title="Ubicaciones"
                    options={getActiveLocations().map(l => ({ 
                      id: l.id, 
                      name: l.name, 
                      extra: l.type 
                    }))}
                    selected={enhancedFilters.locations}
                    onSelectionChange={(ids) => updateEnhancedFilters('locations', ids)}
                    icon={MapPin}
                    placeholder="Todas las ubicaciones"
                    searchPlaceholder="Buscar ubicación..."
                  />
                </div>
              </div>

              {/* Filtros de fecha y hora */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Rango de Fechas</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        type="date"
                        value={enhancedFilters.dateRange.start}
                        onChange={(e) => updateEnhancedFilters('dateRange', {
                          ...enhancedFilters.dateRange,
                          start: e.target.value
                        })}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Input
                        type="date"
                        value={enhancedFilters.dateRange.end}
                        onChange={(e) => updateEnhancedFilters('dateRange', {
                          ...enhancedFilters.dateRange,
                          end: e.target.value
                        })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Rango de Horarios</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        type="time"
                        value={enhancedFilters.timeRange.start}
                        onChange={(e) => updateEnhancedFilters('timeRange', {
                          ...enhancedFilters.timeRange,
                          start: e.target.value
                        })}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Input
                        type="time"
                        value={enhancedFilters.timeRange.end}
                        onChange={(e) => updateEnhancedFilters('timeRange', {
                          ...enhancedFilters.timeRange,
                          end: e.target.value
                        })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado de citas */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Estado de Citas</Label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <Button
                      key={status.id}
                      variant={enhancedFilters.status.includes(status.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newStatus = enhancedFilters.status.includes(status.id)
                          ? enhancedFilters.status.filter(s => s !== status.id)
                          : [...enhancedFilters.status, status.id];
                        updateEnhancedFilters('status', newStatus);
                      }}
                      className={`${
                        enhancedFilters.status.includes(status.id) 
                          ? 'bg-medical-600 hover:bg-medical-700' 
                          : ''
                      }`}
                    >
                      {enhancedFilters.status.includes(status.id) && (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      {status.name}
                    </Button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vista compacta de filtros activos */}
        {!isExpanded && getActiveFiltersCount() > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {enhancedFilters.doctors.length > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <User className="w-3 h-3 mr-1" />
                {enhancedFilters.doctors.length} doctor{enhancedFilters.doctors.length > 1 ? 'es' : ''}
              </Badge>
            )}
            {enhancedFilters.specialties.length > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Stethoscope className="w-3 h-3 mr-1" />
                {enhancedFilters.specialties.length} especialidad{enhancedFilters.specialties.length > 1 ? 'es' : ''}
              </Badge>
            )}
            {enhancedFilters.locations.length > 0 && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                <MapPin className="w-3 h-3 mr-1" />
                {enhancedFilters.locations.length} ubicación{enhancedFilters.locations.length > 1 ? 'es' : ''}
              </Badge>
            )}
            {(enhancedFilters.dateRange.start || enhancedFilters.dateRange.end) && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                <Calendar className="w-3 h-3 mr-1" />
                Rango de fechas
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AppointmentFilters;
