import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Phone, CreditCard, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

interface Patient {
  id: number;
  document: string;
  name: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  gender: string;
  address?: string;
  municipality_id?: number;
  zone_id?: number;
  insurance_eps_id?: number;
  status: string;
  zone_name?: string;
  municipality_name?: string;
  insurance_type_name?: string;
}

interface PatientSearchProps {
  onPatientSelect: (patient: Patient) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  clearOnSelect?: boolean;
}

const PatientSearchAutocomplete: React.FC<PatientSearchProps> = ({
  onPatientSelect,
  placeholder = "Buscar por cédula, nombre o teléfono...",
  className = "",
  autoFocus = false,
  clearOnSelect = false
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Debounced search
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await api.quickSearchPatients(query);
        
        if (response.success) {
          setResults(response.data);
          setShowDropdown(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Error en búsqueda:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectPatient(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    onPatientSelect(patient);
    if (clearOnSelect) {
      setQuery('');
    } else {
      setQuery(`${patient.name} - ${patient.document}`);
    }
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (
      dropdownRef.current && 
      !dropdownRef.current.contains(e.target as Node) &&
      inputRef.current &&
      !inputRef.current.contains(e.target as Node)
    ) {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatAge = (birthDate: string) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return `${age - 1} años`;
    }
    return `${age} años`;
  };

  const formatGender = (gender: string) => {
    const genderMap: { [key: string]: string } = {
      'Masculino': '♂',
      'Femenino': '♀',
      'Otro': '⚧',
      'No especificado': '?'
    };
    return genderMap[gender] || '?';
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="pl-10 pr-4 py-3 text-base border-2 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
          autoFocus={autoFocus}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {showDropdown && (
        <Card 
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto shadow-lg border border-gray-200"
        >
          {results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {loading ? 'Buscando...' : 'No se encontraron pacientes'}
            </div>
          ) : (
            <div className="py-2">
              {results.map((patient, index) => (
                <div
                  key={patient.id}
                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    index === selectedIndex ? 'bg-medical-50' : ''
                  }`}
                  onClick={() => handleSelectPatient(patient)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-medical-600" />
                        <span className="font-semibold text-gray-900">{patient.name}</span>
                        <span className="text-gray-500">{formatGender(patient.gender)}</span>
                        {patient.birth_date && (
                          <Badge variant="outline" className="text-xs">
                            {formatAge(patient.birth_date)}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          <span>{patient.document}</span>
                        </div>
                        
                        {patient.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{patient.phone}</span>
                          </div>
                        )}
                        
                        {(patient.municipality_name || patient.zone_name) && (
                          <div className="flex items-center gap-1 col-span-1 sm:col-span-2">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {[patient.municipality_name, patient.zone_name]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {patient.insurance_type_name && (
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {patient.insurance_type_name}
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4 text-right">
                      <Badge 
                        variant={patient.status === 'Activo' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {patient.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default PatientSearchAutocomplete;