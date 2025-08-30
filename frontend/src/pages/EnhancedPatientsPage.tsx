// ==============================================
// PÁGINA MEJORADA DE GESTIÓN DE PACIENTES
// ==============================================

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload,
  FileText,
  Bell,
  Activity,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { useToast } from '@/hooks/use-toast';
import DocumentManager from '@/components/DocumentManager';
import api from '@/lib/api';

interface Patient {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  telefono: string;
  email: string;
  fecha_nacimiento: string;
  genero: string;
  direccion: string;
  barrio: string;
  municipio_id: number;
  municipio_nombre?: string;
  eps_id: number;
  eps_nombre?: string;
  tipo_sangre?: string;
  alergias?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_telefono?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface PatientDetails {
  paciente: Patient;
  documentos: any[];
  notificaciones: any[];
  historial_medico: any[];
}

export function EnhancedPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientDetails | null>(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    eps_id: '',
    municipio_id: '',
    tipo_documento: '',
    genero: '',
    page: 1,
    limit: 20,
    sort_by: 'nombre',
    sort_order: 'ASC' as 'ASC' | 'DESC',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [epsOptions, setEpsOptions] = useState<any[]>([]);
  const [municipioOptions, setMunicipioOptions] = useState<any[]>([]);
  const { toast } = useToast();

  // Cargar pacientes con filtros
  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await api.enhancedPatients.search(searchFilters);
      
      if (response.success) {
        setPatients(response.data);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Error loading patients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar opciones para filtros
  const loadFilterOptions = async () => {
    try {
      const [epsResponse, municipiosResponse] = await Promise.all([
        api.getEps(),
        api.getMunicipalities(),
      ]);
      
      setEpsOptions(epsResponse);
      setMunicipioOptions(municipiosResponse);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  // Ver detalles completos del paciente
  const viewPatientDetails = async (patientId: number) => {
    try {
      setLoading(true);
      const response = await api.enhancedPatients.getWithDetails(patientId);
      
      if (response.success) {
        setSelectedPatient(response.data);
        setShowDetailsModal(true);
      }
    } catch (error) {
      console.error('Error loading patient details:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del paciente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Crear/actualizar paciente
  const savePatient = async (patientData: any) => {
    try {
      let response;
      
      if (editingPatient) {
        response = await api.enhancedPatients.update(editingPatient.id, patientData);
      } else {
        response = await api.enhancedPatients.create(patientData);
      }
      
      if (response.success) {
        toast({
          title: editingPatient ? "Paciente actualizado" : "Paciente creado",
          description: response.message,
        });
        setShowPatientModal(false);
        setEditingPatient(null);
        loadPatients();
      }
    } catch (error) {
      console.error('Error saving patient:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el paciente",
        variant: "destructive",
      });
    }
  };

  // Eliminar paciente
  const deletePatient = async (patientId: number) => {
    try {
      const response = await api.enhancedPatients.delete(patientId);
      
      if (response.success) {
        toast({
          title: "Paciente eliminado",
          description: response.message,
        });
        loadPatients();
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el paciente",
        variant: "destructive",
      });
    }
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  // Calcular edad
  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  // Columnas de la tabla
  const columns: ColumnDef<Patient>[] = [
    {
      accessorKey: "numero_documento",
      header: "Documento",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.numero_documento}</div>
          <div className="text-sm text-muted-foreground">{row.original.tipo_documento}</div>
        </div>
      ),
    },
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.nombre}</div>
          <div className="text-sm text-muted-foreground">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: "telefono",
      header: "Contacto",
      cell: ({ row }) => (
        <div>
          <div>{row.original.telefono}</div>
          <div className="text-sm text-muted-foreground">{row.original.barrio}</div>
        </div>
      ),
    },
    {
      accessorKey: "fecha_nacimiento",
      header: "Edad",
      cell: ({ row }) => (
        <div>
          <div>{calculateAge(row.original.fecha_nacimiento)} años</div>
          <div className="text-sm text-muted-foreground">{formatDate(row.original.fecha_nacimiento)}</div>
        </div>
      ),
    },
    {
      accessorKey: "eps_nombre",
      header: "EPS",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.eps_nombre || 'No asignada'}
        </Badge>
      ),
    },
    {
      accessorKey: "genero",
      header: "Género",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => viewPatientDetails(row.original.id)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingPatient(row.original);
              setShowPatientModal(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deletePatient(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    loadPatients();
    loadFilterOptions();
  }, [searchFilters]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Pacientes</h1>
          <p className="text-muted-foreground">
            Sistema completo de gestión de pacientes con documentos y notificaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button onClick={() => {
            setEditingPatient(null);
            setShowPatientModal(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Paciente
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder="Nombre, documento, teléfono..."
                value={searchFilters.search}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              />
            </div>
            <div>
              <Label htmlFor="eps">EPS</Label>
              <Select 
                value={searchFilters.eps_id} 
                onValueChange={(value) => setSearchFilters(prev => ({ ...prev, eps_id: value, page: 1 }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las EPS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las EPS</SelectItem>
                  {epsOptions.map((eps) => (
                    <SelectItem key={eps.id} value={eps.id.toString()}>
                      {eps.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tipo_documento">Tipo de Documento</Label>
              <Select 
                value={searchFilters.tipo_documento} 
                onValueChange={(value) => setSearchFilters(prev => ({ ...prev, tipo_documento: value, page: 1 }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los tipos</SelectItem>
                  <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                  <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                  <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                  <SelectItem value="PP">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="genero">Género</Label>
              <Select 
                value={searchFilters.genero} 
                onValueChange={(value) => setSearchFilters(prev => ({ ...prev, genero: value, page: 1 }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los géneros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los géneros</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de pacientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Pacientes ({pagination.total})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="limit">Mostrar:</Label>
              <Select 
                value={searchFilters.limit.toString()} 
                onValueChange={(value) => setSearchFilters(prev => ({ ...prev, limit: parseInt(value), page: 1 }))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={patients}
            loading={loading}
            pagination={{
              pageIndex: pagination.page - 1,
              pageSize: pagination.limit,
              pageCount: pagination.pages,
              total: pagination.total,
            }}
            onPaginationChange={(updater) => {
              const newPagination = typeof updater === 'function' 
                ? updater({
                    pageIndex: pagination.page - 1,
                    pageSize: pagination.limit,
                  })
                : updater;
              
              setSearchFilters(prev => ({
                ...prev,
                page: newPagination.pageIndex + 1,
                limit: newPagination.pageSize,
              }));
            }}
          />
        </CardContent>
      </Card>

      {/* Modal de detalles del paciente */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalles de {selectedPatient?.paciente.nombre}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPatient && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="documents">Documentos</TabsTrigger>
                <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Información Personal</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre completo</Label>
                      <p className="font-medium">{selectedPatient.paciente.nombre}</p>
                    </div>
                    <div>
                      <Label>Documento</Label>
                      <p className="font-medium">
                        {selectedPatient.paciente.tipo_documento} {selectedPatient.paciente.numero_documento}
                      </p>
                    </div>
                    <div>
                      <Label>Fecha de nacimiento</Label>
                      <p className="font-medium">
                        {formatDate(selectedPatient.paciente.fecha_nacimiento)} 
                        ({calculateAge(selectedPatient.paciente.fecha_nacimiento)} años)
                      </p>
                    </div>
                    <div>
                      <Label>Género</Label>
                      <p className="font-medium">{selectedPatient.paciente.genero}</p>
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <p className="font-medium">{selectedPatient.paciente.telefono}</p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="font-medium">{selectedPatient.paciente.email}</p>
                    </div>
                    <div className="col-span-2">
                      <Label>Dirección</Label>
                      <p className="font-medium">
                        {selectedPatient.paciente.direccion}, {selectedPatient.paciente.barrio}
                      </p>
                    </div>
                    {selectedPatient.paciente.tipo_sangre && (
                      <div>
                        <Label>Tipo de sangre</Label>
                        <p className="font-medium">{selectedPatient.paciente.tipo_sangre}</p>
                      </div>
                    )}
                    {selectedPatient.paciente.alergias && (
                      <div className="col-span-2">
                        <Label>Alergias</Label>
                        <p className="font-medium">{selectedPatient.paciente.alergias}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {(selectedPatient.paciente.contacto_emergencia_nombre || selectedPatient.paciente.contacto_emergencia_telefono) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Contacto de Emergencia</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nombre</Label>
                        <p className="font-medium">{selectedPatient.paciente.contacto_emergencia_nombre}</p>
                      </div>
                      <div>
                        <Label>Teléfono</Label>
                        <p className="font-medium">{selectedPatient.paciente.contacto_emergencia_telefono}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="documents">
                <DocumentManager 
                  patientId={selectedPatient.paciente.id} 
                  compact={false}
                />
              </TabsContent>
              
              <TabsContent value="notifications" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notificaciones Recientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedPatient.notificaciones.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No hay notificaciones recientes
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {selectedPatient.notificaciones.map((notification: any) => (
                          <div key={notification.id} className="flex items-start gap-3 p-3 border rounded">
                            <Bell className="h-4 w-4 mt-1 text-blue-500" />
                            <div className="flex-1">
                              <h4 className="font-medium">{notification.title}</h4>
                              <p className="text-sm text-muted-foreground">{notification.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(notification.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Historial Médico
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedPatient.historial_medico.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No hay historial médico registrado
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {selectedPatient.historial_medico.map((cita: any) => (
                          <div key={cita.id} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <h4 className="font-medium">{cita.servicio_nombre}</h4>
                              <p className="text-sm text-muted-foreground">Dr. {cita.doctor_nombre}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{formatDate(cita.fecha_cita)}</p>
                              <Badge variant={
                                cita.estado === 'completada' ? 'default' :
                                cita.estado === 'cancelada' ? 'destructive' : 'secondary'
                              }>
                                {cita.estado}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de crear/editar paciente */}
      <Dialog open={showPatientModal} onOpenChange={setShowPatientModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Aquí iría el formulario de paciente */}
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Formulario de paciente - Implementar según necesidades específicas
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EnhancedPatientsPage;
