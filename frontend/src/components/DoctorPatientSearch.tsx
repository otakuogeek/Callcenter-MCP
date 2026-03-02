import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
// Button import removed - unused
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, User, Shield, Phone, Calendar, FileText, ChevronRight, Heart, X } from "lucide-react";
import PatientDetailPanel from "./PatientDetailPanel";

interface DoctorPatientSearchProps {
  searchPatients: (query: string) => Promise<any[]>;
  getPatientHistory: (patientId: number) => Promise<any>;
  onCreateRecord?: (patientId: number, patientName: string) => void;
}

const DoctorPatientSearch = ({ searchPatients, getPatientHistory, onCreateRecord }: DoctorPatientSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const debounceTimer = useState<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    setSearched(true);
    try {
      const data = await searchPatients(searchQuery);
      setResults(data);
    } catch (err) {
      console.error("Error searching patients:", err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchPatients]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceTimer[0]) clearTimeout(debounceTimer[0]);
    const timer = setTimeout(() => handleSearch(value), 400);
    debounceTimer[1](timer);
  };

  if (selectedPatientId) {
    return (
      <PatientDetailPanel
        patientId={selectedPatientId}
        getPatientHistory={getPatientHistory}
        onCreateRecord={onCreateRecord}
        onClose={() => setSelectedPatientId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar por nombre, cédula o teléfono..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-10 pr-10 h-12 text-base border-blue-200 focus:ring-blue-500"
          autoFocus
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results */}
      {searching && (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Buscando pacientes...</p>
        </div>
      )}

      {!searching && searched && results.length === 0 && (
        <div className="text-center py-10">
          <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron pacientes</p>
          <p className="text-gray-400 text-sm mt-1">Intenta con otro término de búsqueda</p>
        </div>
      )}

      {!searching && results.length > 0 && (
        <ScrollArea className="h-[500px] pr-2">
          <div className="space-y-2">
            {results.map((patient) => (
              <Card
                key={patient.id}
                className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-blue-400 hover:border-l-blue-600"
                onClick={() => setSelectedPatientId(patient.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{patient.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {patient.document}
                          </span>
                          {patient.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {patient.phone}
                            </span>
                          )}
                          {patient.age != null && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {patient.age} años
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        {patient.eps_name && (
                          <Badge variant="outline" className="text-xs mb-1">
                            <Heart className="h-2.5 w-2.5 mr-1" />
                            {patient.eps_name}
                          </Badge>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {patient.total_visits > 0 && (
                            <span className="flex items-center gap-0.5">
                              <FileText className="h-3 w-3" /> {patient.total_visits} visitas
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {!searched && !searching && (
        <div className="text-center py-12">
          <Search className="h-16 w-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">Buscar Pacientes</p>
          <p className="text-gray-400 text-sm mt-1">
            Escribe al menos 2 caracteres para buscar por nombre, cédula o teléfono
          </p>
        </div>
      )}
    </div>
  );
};

export default DoctorPatientSearch;
