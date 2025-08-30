import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Calendar,
  MapPin,
  AlertCircle,
  RefreshCw,
  Filter,
  Search,
  Eye,
  Settings,
  Zap
} from 'lucide-react';
import { EnhancedStaggerContainer, EnhancedStaggerChild } from '@/components/ui/enhanced-animated-container';

interface Conflict {
  id: string;
  type: 'scheduling' | 'resource' | 'availability' | 'appointment';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'resolved' | 'ignored';
  title: string;
  description: string;
  details: {
    affected_appointments?: Array<{
      id: number;
      patient_name: string;
      date: string;
      time: string;
    }>;
    affected_resources?: Array<{
      type: string;
      name: string;
      conflict_reason: string;
    }>;
    suggested_solutions?: Array<{
      id: string;
      type: string;
      description: string;
      impact: string;
      auto_applicable: boolean;
    }>;
  };
  detected_at: string;
  resolved_at?: string;
  resolution_method?: string;
  resolution_notes?: string;
}

interface ConflictStatistics {
  total_conflicts: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  resolution_rate: number;
  avg_resolution_time: number;
  trends: {
    daily: Array<{ date: string; conflicts: number; resolved: number }>;
    weekly: Array<{ week: string; conflicts: number; resolved: number }>;
  };
}

interface Doctor {
  id: number;
  name: string;
}

interface Location {
  id: number;
  name: string;
}

const AgendaConflictManager = () => {
  const { toast } = useToast();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [statistics, setStatistics] = useState<ConflictStatistics | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('conflicts');
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [selectedSolution, setSelectedSolution] = useState('');

  // Filtros
  const [filters, setFilters] = useState({
    type: '',
    severity: '',
    status: '',
    date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    doctor_id: '',
    location_id: '',
    search: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'conflicts') {
      loadConflicts();
    } else if (activeTab === 'statistics') {
      loadStatistics();
    }
  }, [activeTab, filters]);

  const loadInitialData = async () => {
    try {
      const [doctorsRes, locationsRes] = await Promise.all([
        api.getDoctors(),
        api.getLocations()
      ]);
      setDoctors(doctorsRes);
      setLocations(locationsRes);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos iniciales',
        variant: 'destructive'
      });
    }
  };

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const params = {
        ...(filters.type && { type: filters.type }),
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.status && { status: filters.status }),
        date_from: filters.date_from,
        date_to: filters.date_to,
        ...(filters.doctor_id && { doctor_id: parseInt(filters.doctor_id) }),
        ...(filters.location_id && { location_id: parseInt(filters.location_id) }),
        ...(filters.search && { search: filters.search })
      };

      const result = await api.agendaConflicts.getConflicts(params);
      setConflicts(result.conflicts || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los conflictos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const params = {
        date_from: filters.date_from,
        date_to: filters.date_to
      };

      const result = await api.agendaConflicts.getStatistics(params);
      setStatistics(result);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las estadísticas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const detectConflicts = async () => {
    setLoading(true);
    try {
      await api.agendaConflicts.detect({
        date_from: filters.date_from,
        date_to: filters.date_to
      });

      toast({
        title: 'Éxito',
        description: 'Detección de conflictos completada'
      });

      loadConflicts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo completar la detección de conflictos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async () => {
    if (!selectedConflict || !selectedSolution) return;

    try {
      await api.agendaConflicts.resolve({
        conflict_id: selectedConflict.id,
        solution_id: selectedSolution,
        notes: resolutionNotes
      });

      toast({
        title: 'Éxito',
        description: 'Conflicto resuelto correctamente'
      });

      setShowResolutionDialog(false);
      setSelectedConflict(null);
      setResolutionNotes('');
      setSelectedSolution('');
      loadConflicts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo resolver el conflicto',
        variant: 'destructive'
      });
    }
  };

  const autoResolveConflicts = async () => {
    try {
      const result = await api.agendaConflicts.autoResolve({
        date_from: filters.date_from,
        date_to: filters.date_to,
        severity_threshold: 'medium'
      });

      toast({
        title: 'Éxito',
        description: `${result.resolved_count} conflictos resueltos automáticamente`
      });

      loadConflicts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron resolver automáticamente los conflictos',
        variant: 'destructive'
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <AlertCircle className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      case 'low': return <CheckCircle2 className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'default';
      case 'pending': return 'destructive';
      case 'ignored': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'ignored': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'scheduling': return <Calendar className="h-4 w-4" />;
      case 'resource': return <MapPin className="h-4 w-4" />;
      case 'availability': return <Clock className="h-4 w-4" />;
      case 'appointment': return <Users className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de Conflictos</h2>
          <p className="text-muted-foreground">
            Detecta, analiza y resuelve conflictos en la programación de citas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={detectConflicts} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Detectar Conflictos
          </Button>
          <Button onClick={autoResolveConflicts} disabled={loading}>
            <Zap className="h-4 w-4 mr-2" />
            Resolución Automática
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="conflicts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Conflictos ({conflicts.length})
          </TabsTrigger>
          <TabsTrigger value="statistics">
            <Settings className="h-4 w-4 mr-2" />
            Estadísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros de Búsqueda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Buscar conflictos..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="type_filter">Tipo</Label>
                  <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos los tipos</SelectItem>
                      <SelectItem value="scheduling">Programación</SelectItem>
                      <SelectItem value="resource">Recursos</SelectItem>
                      <SelectItem value="availability">Disponibilidad</SelectItem>
                      <SelectItem value="appointment">Citas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="severity_filter">Severidad</Label>
                  <Select value={filters.severity} onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las severidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas las severidades</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="low">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status_filter">Estado</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos los estados</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="resolved">Resuelto</SelectItem>
                      <SelectItem value="ignored">Ignorado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="date_from">Fecha desde</Label>
                  <Input
                    id="date_from"
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="date_to">Fecha hasta</Label>
                  <Input
                    id="date_to"
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="doctor_filter">Médico</Label>
                  <Select value={filters.doctor_id} onValueChange={(value) => setFilters(prev => ({ ...prev, doctor_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los médicos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos los médicos</SelectItem>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id.toString()}>
                          {doctor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location_filter">Ubicación</Label>
                  <Select value={filters.location_id} onValueChange={(value) => setFilters(prev => ({ ...prev, location_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las ubicaciones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas las ubicaciones</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de conflictos */}
          <div className="space-y-4">
            <EnhancedStaggerContainer>
              {conflicts.map((conflict) => (
                <EnhancedStaggerChild key={conflict.id}>
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getSeverityColor(conflict.severity)}>
                              {getSeverityIcon(conflict.severity)}
                              <span className="ml-1 capitalize">{conflict.severity}</span>
                            </Badge>
                            <Badge variant={getStatusColor(conflict.status)}>
                              {getStatusIcon(conflict.status)}
                              <span className="ml-1 capitalize">{conflict.status}</span>
                            </Badge>
                            <Badge variant="outline">
                              {getTypeIcon(conflict.type)}
                              <span className="ml-1 capitalize">{conflict.type}</span>
                            </Badge>
                          </div>

                          <h3 className="font-semibold mb-2">{conflict.title}</h3>
                          <p className="text-muted-foreground mb-3">{conflict.description}</p>

                          <div className="text-sm text-muted-foreground">
                            Detectado: {new Date(conflict.detected_at).toLocaleString()}
                            {conflict.resolved_at && (
                              <span className="ml-4">
                                Resuelto: {new Date(conflict.resolved_at).toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Detalles del conflicto */}
                          {conflict.details.affected_appointments && conflict.details.affected_appointments.length > 0 && (
                            <div className="mt-3">
                              <h4 className="font-medium text-sm mb-1">Citas afectadas:</h4>
                              <div className="space-y-1">
                                {conflict.details.affected_appointments.map((appointment, index) => (
                                  <div key={index} className="text-sm text-muted-foreground">
                                    {appointment.patient_name} - {appointment.date} {appointment.time}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Soluciones sugeridas */}
                          {conflict.details.suggested_solutions && conflict.details.suggested_solutions.length > 0 && (
                            <div className="mt-3">
                              <h4 className="font-medium text-sm mb-1">Soluciones sugeridas:</h4>
                              <div className="space-y-1">
                                {conflict.details.suggested_solutions.map((solution) => (
                                  <div key={solution.id} className="text-sm">
                                    <span className="text-blue-600">{solution.description}</span>
                                    {solution.auto_applicable && (
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        Auto-aplicable
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedConflict(conflict)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalles
                          </Button>
                          
                          {conflict.status === 'pending' && (
                            <Button 
                              size="sm"
                              onClick={() => {
                                setSelectedConflict(conflict);
                                setShowResolutionDialog(true);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Resolver
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </EnhancedStaggerChild>
              ))}
            </EnhancedStaggerContainer>

            {conflicts.length === 0 && !loading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="font-semibold mb-2">No se encontraron conflictos</h3>
                  <p className="text-muted-foreground text-center">
                    Todo parece estar funcionando correctamente para los filtros seleccionados
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          {statistics && (
            <EnhancedStaggerContainer>
              {/* Métricas principales */}
              <EnhancedStaggerChild>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Conflictos</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{statistics.total_conflicts}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Tasa de Resolución</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{(statistics.resolution_rate * 100).toFixed(1)}%</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{statistics.avg_resolution_time}h</div>
                      <p className="text-xs text-muted-foreground">
                        Resolución promedio
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Críticos</CardTitle>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{statistics.by_severity.critical || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Requieren atención inmediata
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </EnhancedStaggerChild>

              {/* Distribución por tipo y severidad */}
              <EnhancedStaggerChild>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Conflictos por Tipo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(statistics.by_type).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(type)}
                              <span className="capitalize">{type}</span>
                            </div>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Conflictos por Severidad</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(statistics.by_severity).map(([severity, count]) => (
                          <div key={severity} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getSeverityIcon(severity)}
                              <span className="capitalize">{severity}</span>
                            </div>
                            <Badge variant={getSeverityColor(severity)}>{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </EnhancedStaggerChild>
            </EnhancedStaggerContainer>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de resolución */}
      <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolver Conflicto</DialogTitle>
            <DialogDescription>
              Selecciona una solución y añade notas de resolución
            </DialogDescription>
          </DialogHeader>

          {selectedConflict && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{selectedConflict.title}</h4>
                <p className="text-sm text-muted-foreground">{selectedConflict.description}</p>
              </div>

              {selectedConflict.details.suggested_solutions && (
                <div>
                  <Label htmlFor="solution">Solución a aplicar</Label>
                  <Select value={selectedSolution} onValueChange={setSelectedSolution}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una solución" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedConflict.details.suggested_solutions.map((solution) => (
                        <SelectItem key={solution.id} value={solution.id}>
                          {solution.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="resolution_notes">Notas de resolución</Label>
                <Textarea
                  id="resolution_notes"
                  placeholder="Describe cómo se resolvió el conflicto..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolutionDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={resolveConflict}
              disabled={!selectedSolution}
            >
              Resolver Conflicto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Procesando...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaConflictManager;
