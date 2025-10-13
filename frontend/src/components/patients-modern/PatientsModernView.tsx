// ============================================
// VISTA MODERNA DE GESTIÓN DE PACIENTES
// ============================================

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  Filter,
  Download,
  Plus,
  TrendingUp,
  User,
  Activity,
  Archive
} from 'lucide-react';
import { PatientCard } from './PatientCard';
import { PatientDetailModal } from './PatientDetailModal';
import { PatientFormModal } from './PatientFormModal';
import { DeletePatientDialog } from './DeletePatientDialog';
import { Patient, PatientFilters } from '@/types/patient';
import { 
  PatientBasicFormData, 
  PatientFullFormData 
} from '@/schemas/patientSchemas';
import { generatePatientPDF, generatePatientsListPDF } from '@/utils/pdfGenerators';

export const PatientsModernView = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<PatientFilters>({
    status: 'Todos',
    gender: 'Todos',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Estados para CRUD
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formPatient, setFormPatient] = useState<Patient | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null);

  // Consultar pacientes
  const { data: patientsData, isLoading } = useQuery({
    queryKey: ['patients', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/patients', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar pacientes');
      
      const result = await response.json();
      return result.data || result;
    },
  });

  // ====== MUTATIONS PARA CRUD ======
  
  // Crear paciente
  const createPatientMutation = useMutation({
    mutationFn: async (data: PatientBasicFormData | PatientFullFormData) => {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear paciente');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setIsFormModalOpen(false);
      setFormPatient(null);
      toast({
        title: '✅ Paciente creado',
        description: 'El paciente ha sido registrado exitosamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Error al crear paciente',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Actualizar paciente
  const updatePatientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PatientFullFormData }) => {
      console.log('🔄 Iniciando actualización de paciente:', { id, data });
      
      const response = await fetch(`/api/patients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });
      
      console.log('📡 Respuesta del servidor:', { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok 
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error en la respuesta:', error);
        
        // Construir mensaje detallado de error
        let errorMessage = error.message || 'Error al actualizar paciente';
        
        if (error.errors) {
          const fieldErrors = Object.entries(error.errors)
            .map(([field, messages]: [string, any]) => {
              const fieldName = field.replace(/_/g, ' ');
              return `${fieldName}: ${Array.isArray(messages) ? messages.join(', ') : messages}`;
            })
            .join('\n');
          
          if (fieldErrors) {
            errorMessage += '\n\nErrores de validación:\n' + fieldErrors;
          }
        }
        
        if (error.error) {
          errorMessage += '\n\nDetalle técnico: ' + error.error;
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log('✅ Paciente actualizado exitosamente:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('✅ Mutation onSuccess:', data);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setIsFormModalOpen(false);
      setFormPatient(null);
      toast({
        title: '✅ Paciente actualizado',
        description: 'Los datos del paciente han sido actualizados exitosamente',
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      console.error('❌ Mutation onError:', error);
      
      toast({
        title: '❌ Error al actualizar paciente',
        description: error.message,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  // Eliminar paciente (soft o hard delete)
  const deletePatientMutation = useMutation({
    mutationFn: async ({ id, hardDelete }: { id: number; hardDelete: boolean }) => {
      const url = hardDelete 
        ? `/api/patients/${id}?hard=true` 
        : `/api/patients/${id}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al procesar la solicitud');
      }
      
      // Hard delete retorna 204 sin contenido
      if (response.status === 204) {
        return { success: true, hardDelete: true };
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setIsDeleteDialogOpen(false);
      setDeletePatient(null);
      
      if (data.hardDelete) {
        toast({
          title: '🗑️ Paciente eliminado permanentemente',
          description: 'El paciente ha sido eliminado de la base de datos',
        });
      } else {
        toast({
          title: '📦 Paciente inactivado',
          description: 'El paciente ha sido marcado como inactivo',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Error al procesar solicitud',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filtrar y buscar pacientes
  const filteredPatients = useMemo(() => {
    if (!patientsData) return [];
    
    let filtered = [...patientsData];

    // Filtro por tab activo (Activos o Inactivos)
    filtered = filtered.filter(p => 
      activeTab === 'active' ? p.status === 'Activo' : p.status === 'Inactivo'
    );

    // Búsqueda por texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(term) ||
        p.document?.toLowerCase().includes(term) ||
        p.phone?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term)
      );
    }

    // Filtro por género
    if (filters.gender && filters.gender !== 'Todos') {
      filtered = filtered.filter(p => p.gender === filters.gender);
    }

    // Filtro por EPS
    if (filters.eps_ids && filters.eps_ids.length > 0) {
      filtered = filtered.filter(p => 
        p.insurance_eps_id && filters.eps_ids?.includes(p.insurance_eps_id)
      );
    }

    // Filtro por rango de edad
    if (filters.age_min !== undefined || filters.age_max !== undefined) {
      filtered = filtered.filter(p => {
        if (!p.birth_date) return false;
        const age = calculatePatientAge(p.birth_date);
        if (filters.age_min !== undefined && age < filters.age_min) return false;
        if (filters.age_max !== undefined && age > filters.age_max) return false;
        return true;
      });
    }

    return filtered;
  }, [patientsData, searchTerm, filters, activeTab]);

  // Paginación
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPatients.slice(startIndex, endIndex);
  }, [filteredPatients, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);

  // Estadísticas
  const stats = useMemo(() => {
    if (!patientsData) return null;

    const total = patientsData.length;
    const active = patientsData.filter((p: Patient) => p.status === 'Activo').length;
    const inactive = patientsData.filter((p: Patient) => p.status === 'Inactivo').length;

    // Por género
    const byGender = {
      masculino: patientsData.filter((p: Patient) => p.gender === 'Masculino').length,
      femenino: patientsData.filter((p: Patient) => p.gender === 'Femenino').length,
      otro: patientsData.filter((p: Patient) => p.gender === 'Otro').length,
    };

    // Por EPS (top 5)
    const epsCounts: Record<string, number> = {};
    patientsData.forEach((p: Patient) => {
      if (p.eps_name) {
        epsCounts[p.eps_name] = (epsCounts[p.eps_name] || 0) + 1;
      }
    });
    const topEPS = Object.entries(epsCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Debug: Log de EPS para verificar datos
    if (topEPS.length > 0) {
      console.log('📊 Top EPS:', topEPS);
    } else {
      console.warn('⚠️ No se encontraron datos de EPS en los pacientes');
      console.log('Muestra de pacientes:', patientsData.slice(0, 2).map(p => ({ 
        name: p.name, 
        eps_name: p.eps_name, 
        insurance_eps_id: p.insurance_eps_id 
      })));
    }

    // Nuevos este mes
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const newThisMonth = patientsData.filter((p: Patient) => {
      if (!p.created_at) return false;
      const createdDate = new Date(p.created_at);
      return createdDate >= thisMonth;
    }).length;

    return {
      total,
      active,
      inactive,
      byGender,
      topEPS,
      newThisMonth,
    };
  }, [patientsData]);

  // Helper para calcular edad
  const calculatePatientAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Handlers
  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsDetailModalOpen(true);
  };

  const handleEditPatient = async (patient: Patient) => {
    try {
      // Hacer fetch completo del paciente con todos los datos
      console.log('🔍 Cargando datos completos del paciente:', patient.id);
      
      const response = await fetch(`/api/patients/${patient.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar datos del paciente');
      }
      
      const fullPatientData = await response.json();
      console.log('✅ Datos completos cargados:', fullPatientData);
      
      setFormPatient(fullPatientData);
      setIsFormModalOpen(true);
    } catch (error) {
      console.error('❌ Error al cargar paciente:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos del paciente',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePatient = (patient: Patient) => {
    setDeletePatient(patient);
    setIsDeleteDialogOpen(true);
  };

  const handleCreatePatient = () => {
    setFormPatient(null);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = (data: PatientBasicFormData | PatientFullFormData, isQuickMode: boolean) => {
    console.log('📝 handleFormSubmit llamado:', { 
      isEditing: !!formPatient, 
      patientId: formPatient?.id,
      isQuickMode,
      dataKeys: Object.keys(data),
      data 
    });
    
    if (formPatient) {
      // Modo edición
      console.log('✏️ Modo EDICIÓN - Llamando updatePatientMutation');
      console.log('📤 Datos a enviar:', JSON.stringify(data, null, 2));
      
      updatePatientMutation.mutate({
        id: formPatient.id,
        data: data as PatientFullFormData,
      });
    } else {
      // Modo creación
      console.log('➕ Modo CREACIÓN - Llamando createPatientMutation');
      console.log('📤 Datos a enviar:', JSON.stringify(data, null, 2));
      
      createPatientMutation.mutate(data);
    }
  };

  const handleConfirmDelete = (hardDelete: boolean) => {
    if (deletePatient) {
      deletePatientMutation.mutate({ 
        id: deletePatient.id, 
        hardDelete 
      });
    }
  };

  const handleGeneratePatientPDF = (patient: Patient) => {
    try {
      generatePatientPDF(patient);
      toast({
        title: "PDF Generado",
        description: `Se ha generado el PDF de ${patient.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  const handleGenerateListPDF = () => {
    try {
      generatePatientsListPDF(
        filteredPatients,
        filters,
        stats ? {
          total: stats.total,
          active: stats.active,
          inactive: stats.inactive,
        } : undefined
      );
      toast({
        title: "PDF Generado",
        description: `Se ha generado el PDF con ${filteredPatients.length} pacientes`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header con título y botones principales */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            Gestión de Pacientes
          </h1>
          <p className="text-gray-600 mt-1">
            Administra la información completa de tus pacientes
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateListPDF} 
            variant="outline"
            aria-label="Exportar lista de pacientes a PDF"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button 
            onClick={handleCreatePatient}
            aria-label="Crear nuevo paciente"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Paciente
          </Button>
        </div>
      </div>

      {/* Dashboard de estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Pacientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.active} activos, {stats.inactive} inactivos
                  </p>
                </div>
                <Users className="w-12 h-12 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Nuevos Este Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-green-600">{stats.newThisMonth}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Registrados en {new Date().toLocaleDateString('es', { month: 'long' })}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Por Género
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Masculino</span>
                  <Badge className="bg-blue-100 text-blue-800">{stats.byGender.masculino}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Femenino</span>
                  <Badge className="bg-pink-100 text-pink-800">{stats.byGender.femenino}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Otro</span>
                  <Badge className="bg-purple-100 text-purple-800">{stats.byGender.otro}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Top 3 EPS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topEPS.slice(0, 3).map(([eps, count]) => (
                  <div key={eps} className="flex justify-between items-center">
                    <span className="text-sm truncate flex-1">{eps}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Búsqueda */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, documento, teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro por género */}
            <Select
              value={filters.gender}
              onValueChange={(value) => setFilters({ ...filters, gender: value as any })}
            >
              <SelectTrigger aria-label="Filtrar por género">
                <SelectValue placeholder="Género" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos los géneros</SelectItem>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Femenino">Femenino</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>

            {/* Botón limpiar filtros */}
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setFilters({ status: 'Todos', gender: 'Todos' });
                setCurrentPage(1);
              }}
              aria-label="Limpiar todos los filtros"
            >
              <Filter className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Tabs para separar Activos e Inactivos */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'inactive')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activos ({patientsData?.filter((p: Patient) => p.status === 'Activo').length || 0})
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex items-center gap-2">
            <Archive className="w-4 h-4" />
            Inactivos ({patientsData?.filter((p: Patient) => p.status === 'Inactivo').length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab Content para Activos */}
        <TabsContent value="active" className="mt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-600" />
              <p className="text-gray-600">Cargando pacientes...</p>
            </div>
          ) : paginatedPatients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No se encontraron pacientes activos
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || filters.gender !== 'Todos'
                    ? 'Intenta ajustar los filtros de búsqueda'
                    : 'Comienza agregando tu primer paciente'}
                </p>
                <Button onClick={() => {
                  setIsFormModalOpen(true);
                  setFormPatient(null);
                }} aria-label="Agregar nuevo paciente">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Paciente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Mostrando {paginatedPatients.length} de {filteredPatients.length} pacientes activos
                {searchTerm || filters.gender !== 'Todos' ? ' (filtrados)' : ''}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedPatients.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    onView={handleViewPatient}
                    onEdit={handleEditPatient}
                    onDelete={handleDeletePatient}
                    onGeneratePDF={handleGeneratePatientPDF}
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab Content para Inactivos */}
        <TabsContent value="inactive" className="mt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-600" />
              <p className="text-gray-600">Cargando pacientes...</p>
            </div>
          ) : paginatedPatients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Archive className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No hay pacientes inactivos
                </h3>
                <p className="text-gray-600">
                  {searchTerm || filters.gender !== 'Todos'
                    ? 'No se encontraron pacientes inactivos con los filtros aplicados'
                    : 'Los pacientes inactivados aparecerán aquí'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Mostrando {paginatedPatients.length} de {filteredPatients.length} pacientes inactivos
                {searchTerm || filters.gender !== 'Todos' ? ' (filtrados)' : ''}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedPatients.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    onView={handleViewPatient}
                    onEdit={handleEditPatient}
                    onDelete={handleDeletePatient}
                    onGeneratePDF={handleGeneratePatientPDF}
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Paginación */}
      {!isLoading && paginatedPatients.length > 0 && totalPages > 1 && (
        <Card className="mt-6">
          <CardContent className="py-4">
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                aria-label="Página anterior"
              >
                Anterior
              </Button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      aria-label={`Ir a página ${pageNum}`}
                      aria-current={currentPage === pageNum ? 'page' : undefined}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                aria-label="Página siguiente"
              >
                Siguiente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de detalles del paciente */}
      <PatientDetailModal
        patient={selectedPatient}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onEdit={handleEditPatient}
        onGeneratePDF={handleGeneratePatientPDF}
      />

      {/* Modal de formulario (crear/editar) */}
      <PatientFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setFormPatient(null);
        }}
        onSubmit={handleFormSubmit}
        patient={formPatient}
        isLoading={createPatientMutation.isPending || updatePatientMutation.isPending}
      />

      {/* Diálogo de confirmación para eliminar */}
      <DeletePatientDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setDeletePatient(null);
        }}
        onConfirm={handleConfirmDelete}
        patient={deletePatient}
        isLoading={deletePatientMutation.isPending}
      />
    </div>
  );
};
