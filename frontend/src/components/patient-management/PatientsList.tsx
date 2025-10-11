import { useState, useEffect, useMemo } from "react";
import { 
  Search,
  Eye,
  Edit,
  MapPin,
  Phone,
  Mail,
  User,
  Settings,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import PatientDetailsModal from "./PatientDetailsModal";
import { useToast } from "@/hooks/use-toast";

interface Patient {
  id: string;
  document: string;
  document_type_name?: string;
  name: string;
  phone: string;
  email?: string;
  birth_date: string;
  gender?: string;
  address?: string;
  municipality_name?: string;
  eps_name?: string;
  insurance_affiliation_type?: string;
  blood_group_name?: string;
  status?: string;
  created_at: string;
}

interface LookupData {
  eps: Array<{id: number, name: string}>;
  municipalities: Array<{id: number, name: string}>;
  document_types: Array<{id: number, code: string, name: string}>;
  gender_options: Array<{id: string, name: string}>;
  blood_groups: Array<{id: number, code: string, name: string}>;
}

interface PatientsListProps {
  lookupData: LookupData | null;
  onPatientSelected?: (patient: Patient) => void;
  onPatientEdit?: (patient: Patient) => void;
}

const PatientsList = ({ lookupData, onPatientSelected, onPatientEdit }: PatientsListProps) => {
  const { toast } = useToast();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEps, setSelectedEps] = useState("all");
  const [selectedMunicipality, setSelectedMunicipality] = useState("all");
  const [selectedDocumentType, setSelectedDocumentType] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Estados para columnas personalizables
  const [visibleColumns, setVisibleColumns] = useState({
    document: true,
    contact: true,
    medical: true,
    insurance: true,
    location: true,
    actions: true
  });

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      // Usar la URL base de la API configurada
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${apiBase}/patients-v2`, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Raw API response:', data);
        
        // Extraer los pacientes de la respuesta
        const patientsData = data?.data?.patients || data?.patients || data || [];
        console.log('Patients data extracted:', patientsData);
        
        // Asegurar que siempre tengamos un array válido
        const validPatients = Array.isArray(patientsData) ? patientsData : [];
        setPatients(validPatients);
        
        toast({
          title: "Pacientes cargados",
          description: `Se cargaron ${validPatients.length} pacientes exitosamente`,
        });
      } else {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        
        if (response.status === 401) {
          // Token expirado, limpiar y redirigir
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        
        toast({
          title: "Error",
          description: `Error al cargar la lista de pacientes: ${response.status}`,
          variant: "destructive"
        });
        setPatients([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error loading patients:', error);
      toast({
        title: "Error",
        description: "Error de conexión al cargar pacientes",
        variant: "destructive"
      });
      setPatients([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Función para filtrar pacientes
  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      // Filtro por término de búsqueda
      const matchesSearch = !searchTerm || 
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.document.includes(searchTerm) ||
        patient.phone.includes(searchTerm) ||
        (patient.email && patient.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filtro por EPS
      const matchesEps = selectedEps === "all" || 
        (patient.eps_name && patient.eps_name === selectedEps);
      
      // Filtro por municipio
      const matchesMunicipality = selectedMunicipality === "all" || 
        (patient.municipality_name && patient.municipality_name === selectedMunicipality);
      
      // Filtro por tipo de documento
      const matchesDocumentType = selectedDocumentType === "all" || 
        (patient.document_type_name && patient.document_type_name === selectedDocumentType);
      
      // Filtro por género
      const matchesGender = selectedGender === "all" || 
        (patient.gender && patient.gender === selectedGender);
      
      return matchesSearch && matchesEps && matchesMunicipality && matchesDocumentType && matchesGender;
    });
  }, [patients, searchTerm, selectedEps, selectedMunicipality, selectedDocumentType, selectedGender]);

  // Calcular datos de paginación
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedEps, selectedMunicipality, selectedDocumentType, selectedGender]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));


  const handleViewDetails = (patient: Patient) => {
    console.log('Viewing details for patient:', patient.id); // Debug log
    setSelectedPatient(patient);
    setIsDetailsModalOpen(true);
    if (onPatientSelected) {
      onPatientSelected(patient);
    }
  };

  const handleEditPatient = (patient: Patient) => {
    if (onPatientEdit) {
      onPatientEdit(patient);
    }
  };

  const handleDeletePatient = async (patient: Patient) => {
    // Confirmar eliminación
    const confirmed = window.confirm(
      `¿Está seguro de eliminar al paciente ${patient.name}?\n\n` +
      `Esta acción eliminará:\n` +
      `- Todos los datos del paciente\n` +
      `- Todas sus citas programadas\n` +
      `- Todos sus documentos\n` +
      `- Todo su historial médico\n\n` +
      `Esta acción NO se puede deshacer.`
    );
    
    if (!confirmed) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${apiBase}/patients/${patient.id}/delete-cascade`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Paciente eliminado",
          description: `El paciente ${patient.name} y toda su información han sido eliminados exitosamente.`,
        });
        // Recargar la lista
        loadPatients();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Error al eliminar",
          description: errorData.message || `No se pudo eliminar el paciente: ${response.status}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast({
        title: "Error",
        description: "Error de conexión al intentar eliminar el paciente",
        variant: "destructive"
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedEps("all");
    setSelectedMunicipality("all");
    setSelectedDocumentType("all");
    setSelectedGender("all");
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactivo</Badge>;
      default:
        return <Badge variant="outline">Sin estado</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Lista de Pacientes
        </CardTitle>
        <CardDescription>
          Busque y gestione la información de los pacientes registrados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Controles de búsqueda y filtros */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre, documento, teléfono o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Button onClick={loadPatients} disabled={loading}>
              {loading ? "Cargando..." : "Actualizar"}
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Select value={selectedEps} onValueChange={setSelectedEps}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por EPS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las EPS</SelectItem>
                {(lookupData?.eps || []).map(eps => (
                  <SelectItem key={eps.id} value={eps.name}>
                    {eps.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedMunicipality} onValueChange={setSelectedMunicipality}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por municipio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los municipios</SelectItem>
                {(lookupData?.municipalities || []).map(municipality => (
                  <SelectItem key={municipality.id} value={municipality.name}>
                    {municipality.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedGender} onValueChange={setSelectedGender}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por género" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los géneros</SelectItem>
                {(lookupData?.gender_options || []).map(gender => (
                  <SelectItem key={gender.id} value={gender.id}>
                    {gender.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={clearFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          </div>
          
          {/* Configuración de columnas */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Columnas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Mostrar/Ocultar Columnas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(visibleColumns).map(([key, visible]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setVisibleColumns(prev => ({ ...prev, [key]: !visible }))}
                  >
                    {visible ? "✓" : "○"} {key.charAt(0).toUpperCase() + key.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <span className="text-sm text-muted-foreground">
              {filteredPatients.length} de {patients.length} pacientes
            </span>
            
            {/* Selector de elementos por página */}
            <Select value={itemsPerPage.toString()} onValueChange={(value) => {
              setItemsPerPage(Number(value));
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 por página</SelectItem>
                <SelectItem value="10">10 por página</SelectItem>
                <SelectItem value="20">20 por página</SelectItem>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabla de pacientes */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.document && (
                  <TableHead>Documento</TableHead>
                )}
                <TableHead>Nombre</TableHead>
                {visibleColumns.contact && (
                  <TableHead>Contacto</TableHead>
                )}
                {visibleColumns.medical && (
                  <TableHead>Info. Médica</TableHead>
                )}
                {visibleColumns.insurance && (
                  <TableHead>Seguro</TableHead>
                )}
                {visibleColumns.location && (
                  <TableHead>Ubicación</TableHead>
                )}
                {visibleColumns.actions && (
                  <TableHead>Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPatients.map((patient) => (
                <TableRow key={patient.id}>
                  {visibleColumns.document && (
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{patient.document}</p>
                        <p className="text-xs text-muted-foreground">
                          {patient.document_type_name || 'Sin tipo'}
                        </p>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {patient.gender} • {formatDate(patient.birth_date)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  {visibleColumns.contact && (
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {patient.phone}
                        </div>
                        {patient.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {patient.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.medical && (
                    <TableCell>
                      <div>
                        {patient.blood_group_name && (
                          <p className="text-sm">{patient.blood_group_name}</p>
                        )}
                        {getStatusBadge(patient.status)}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.insurance && (
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{patient.eps_name || 'Sin EPS'}</p>
                        {patient.insurance_affiliation_type && (
                          <p className="text-xs text-muted-foreground">
                            {patient.insurance_affiliation_type}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.location && (
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {patient.municipality_name || 'No especificado'}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.actions && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewDetails(patient);
                          }}
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPatient(patient)}
                          title="Editar paciente"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeletePatient(patient);
                          }}
                          title="Eliminar paciente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Controles de paginación */}
        {filteredPatients.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredPatients.length)} de {filteredPatients.length} resultados
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToFirstPage}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {/* Mostrar páginas cercanas */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(pageNum)}
                      className="w-8"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToLastPage}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {filteredPatients.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No se encontraron pacientes con los filtros seleccionados</p>
          </div>
        )}

        {/* Modal de detalles del paciente mejorado */}
        <PatientDetailsModal
          patient={selectedPatient}
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          onEdit={onPatientEdit}
        />
      </CardContent>
    </Card>
  );
};

export default PatientsList;
