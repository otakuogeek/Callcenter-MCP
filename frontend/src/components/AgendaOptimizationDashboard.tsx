import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Calendar,
  Lightbulb,
  Activity
} from 'lucide-react';
import { EnhancedStaggerContainer, EnhancedStaggerChild } from '@/components/ui/enhanced-animated-container';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface OptimizationAnalysis {
  period: {
    start_date: string;
    end_date: string;
  };
  metrics: {
    total_slots: number;
    occupied_slots: number;
    utilization_rate: number;
    cancellation_rate: number;
    no_show_rate: number;
    peak_hours: Array<{ hour: number; slots: number; utilization: number }>;
    low_utilization_periods: Array<{ date: string; hour: number; utilization: number }>;
  };
  recommendations: Array<{
    id: string;
    type: 'redistribute' | 'increase_capacity' | 'reduce_capacity' | 'schedule_adjustment';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact_estimate: string;
    actionable: boolean;
  }>;
  trends: {
    daily_utilization: Array<{ date: string; utilization: number; slots: number }>;
    hourly_distribution: Array<{ hour: string; slots: number; utilization: number }>;
  };
}

interface PerformanceMetrics {
  efficiency_score: number;
  resource_utilization: number;
  patient_satisfaction: number;
  staff_productivity: number;
  trends: {
    weekly: Array<{ week: string; score: number }>;
    monthly: Array<{ month: string; score: number }>;
  };
  comparison: {
    vs_last_period: number;
    vs_target: number;
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

const AgendaOptimizationDashboard = () => {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<OptimizationAnalysis | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');

  // Filtros
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    doctor_id: '',
    location_id: ''
  });

  // Filtros para sugerencias
  const [suggestionsFilters, setSuggestionsFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    doctor_id: '',
    location_id: ''
  });

  // Formulario de preasignación
  const [preallocForm, setPreallocForm] = useState({
    target_date: new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0],
    total_slots: 50,
    publish_date: new Date().toISOString().split('T')[0],
    doctor_id: '',
    location_id: '',
    specialty_id: '',
    apply: false
  });
  const [preallocResult, setPreallocResult] = useState<any|null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'analysis') {
      runAnalysis();
    } else if (activeTab === 'suggestions') {
      loadSuggestions();
    } else if (activeTab === 'metrics') {
      loadPerformanceMetrics();
    }
  }, [activeTab, filters, suggestionsFilters]);

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

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: filters.start_date,
        end_date: filters.end_date,
        ...(filters.doctor_id && { doctor_id: parseInt(filters.doctor_id) }),
        ...(filters.location_id && { location_id: parseInt(filters.location_id) })
      };

      const result = await api.agendaOptimization.analyze(params);
      setAnalysis(result);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo realizar el análisis de optimización',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const params = {
        date: suggestionsFilters.date,
        ...(suggestionsFilters.doctor_id && { doctor_id: parseInt(suggestionsFilters.doctor_id) }),
        ...(suggestionsFilters.location_id && { location_id: parseInt(suggestionsFilters.location_id) })
      };

      const result = await api.agendaOptimization.getSuggestions(params);
      setSuggestions(result.suggestions || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las sugerencias',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceMetrics = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: filters.start_date,
        end_date: filters.end_date
      };

      const result = await api.agendaOptimization.getPerformanceMetrics(params);
      setMetrics(result);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las métricas de rendimiento',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const runPreallocation = async () => {
    setLoading(true);
    try {
      const payload: any = {
        target_date: preallocForm.target_date,
        total_slots: Number(preallocForm.total_slots),
        publish_date: preallocForm.publish_date,
        apply: preallocForm.apply
      };
      if (preallocForm.doctor_id) payload.doctor_id = Number(preallocForm.doctor_id);
      if (preallocForm.location_id) payload.location_id = Number(preallocForm.location_id);
      if (preallocForm.specialty_id) payload.specialty_id = Number(preallocForm.specialty_id);
      const res = await api.agendaOptimization.randomDistribution(payload);
      setPreallocResult(res.data);
      toast({ title: 'Distribución generada', description: res.data.persisted ? `Persistidos ${res.data.persisted_rows} días` : 'Solo simulación' });
    } catch (e:any) {
      toast({ title: 'Error', description: e.message || 'No se pudo generar', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const applySuggestion = async (suggestionId: string, applyAll: boolean = false) => {
    try {
      await api.agendaOptimization.applySuggestion({
        suggestion_id: suggestionId,
        apply_all: applyAll
      });

      toast({
        title: 'Éxito',
        description: applyAll ? 'Todas las sugerencias se aplicaron correctamente' : 'Sugerencia aplicada correctamente'
      });

      loadSuggestions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo aplicar la sugerencia',
        variant: 'destructive'
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Target className="h-4 w-4" />;
      case 'low': return <Lightbulb className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'redistribute': return <Activity className="h-4 w-4" />;
      case 'increase_capacity': return <TrendingUp className="h-4 w-4" />;
      case 'reduce_capacity': return <TrendingDown className="h-4 w-4" />;
      case 'schedule_adjustment': return <Clock className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  // const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']; // Reservado para futuras gráficas

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Optimización de Agenda</h2>
          <p className="text-muted-foreground">
            Analiza el rendimiento y obtén sugerencias para optimizar la gestión de horarios
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="analysis">Análisis</TabsTrigger>
          <TabsTrigger value="suggestions">Sugerencias</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="preallocation">Preasignación</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          {/* Filtros para análisis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros de Análisis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="start_date">Fecha inicio</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">Fecha fin</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="doctor_filter">Médico (opcional)</Label>
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
                  <Label htmlFor="location_filter">Ubicación (opcional)</Label>
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
              <div className="mt-4">
                <Button onClick={runAnalysis} disabled={loading}>
                  {loading ? 'Analizando...' : 'Ejecutar Análisis'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {analysis && (
            <EnhancedStaggerContainer>
              {/* Métricas principales */}
              <EnhancedStaggerChild>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Utilización</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(analysis.metrics.utilization_rate * 100).toFixed(1)}%
                      </div>
                      <Progress value={analysis.metrics.utilization_rate * 100} className="mt-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Slots Totales</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{analysis.metrics.total_slots}</div>
                      <p className="text-xs text-muted-foreground">
                        {analysis.metrics.occupied_slots} ocupados
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Cancelaciones</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(analysis.metrics.cancellation_rate * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tasa de cancelación
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">No Shows</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(analysis.metrics.no_show_rate * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Inasistencias
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </EnhancedStaggerChild>

              {/* Gráficos */}
              <EnhancedStaggerChild>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Utilización Diaria</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analysis.trends.daily_utilization}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: any, name: string) => [
                              name === 'utilization' ? `${(value * 100).toFixed(1)}%` : value,
                              name === 'utilization' ? 'Utilización' : 'Slots'
                            ]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="utilization" 
                            stroke="#8884d8" 
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribución por Hora</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analysis.trends.hourly_distribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="slots" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </EnhancedStaggerChild>

              {/* Recomendaciones */}
              <EnhancedStaggerChild>
                <Card>
                  <CardHeader>
                    <CardTitle>Recomendaciones de Optimización</CardTitle>
                    <CardDescription>
                      Sugerencias basadas en el análisis de datos para mejorar la eficiencia
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analysis.recommendations.map((rec) => (
                      <div key={rec.id} className="flex items-start gap-3 p-4 border rounded-lg">
                        <div className="flex-shrink-0 mt-1">
                          {getRecommendationIcon(rec.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{rec.title}</h4>
                            <Badge variant={getPriorityColor(rec.priority)} className="text-xs">
                              {getPriorityIcon(rec.priority)}
                              <span className="ml-1 capitalize">{rec.priority}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                          <div className="text-xs text-green-600">
                            Impacto estimado: {rec.impact_estimate}
                          </div>
                        </div>
                        {rec.actionable && (
                          <Button variant="outline" size="sm">
                            Aplicar
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </EnhancedStaggerChild>
            </EnhancedStaggerContainer>
          )}

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          {/* Filtros para sugerencias */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sugerencias del Día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="suggestion_date">Fecha</Label>
                  <Input
                    id="suggestion_date"
                    type="date"
                    value={suggestionsFilters.date}
                    onChange={(e) => setSuggestionsFilters(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="suggestion_doctor">Médico (opcional)</Label>
                  <Select value={suggestionsFilters.doctor_id} onValueChange={(value) => setSuggestionsFilters(prev => ({ ...prev, doctor_id: value }))}>
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
                  <Label htmlFor="suggestion_location">Ubicación (opcional)</Label>
                  <Select value={suggestionsFilters.location_id} onValueChange={(value) => setSuggestionsFilters(prev => ({ ...prev, location_id: value }))}>
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

          {/* Lista de sugerencias */}
          <div className="space-y-4">
            {suggestions.map((suggestion) => (
              <Card key={suggestion.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getPriorityColor(suggestion.priority)}>
                          {getPriorityIcon(suggestion.priority)}
                          <span className="ml-1 capitalize">{suggestion.priority}</span>
                        </Badge>
                        <Badge variant="outline">{suggestion.type}</Badge>
                      </div>
                      <h3 className="font-semibold mb-2">{suggestion.title}</h3>
                      <p className="text-muted-foreground mb-3">{suggestion.description}</p>
                      <div className="text-sm text-green-600">
                        {suggestion.impact_estimate}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => applySuggestion(suggestion.id)}
                        disabled={!suggestion.actionable}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Aplicar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {suggestions.length === 0 && !loading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No hay sugerencias disponibles</h3>
                  <p className="text-muted-foreground text-center">
                    Todo parece estar funcionando de manera óptima para la fecha seleccionada
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="flex justify-center">
              <Button 
                variant="outline"
                onClick={() => applySuggestion('', true)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aplicar Todas las Sugerencias
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {metrics && (
            <EnhancedStaggerContainer>
              {/* Métricas de rendimiento */}
              <EnhancedStaggerChild>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Score Eficiencia</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.efficiency_score}%</div>
                      <Progress value={metrics.efficiency_score} className="mt-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {metrics.comparison.vs_last_period > 0 ? '+' : ''}{metrics.comparison.vs_last_period}% vs período anterior
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Utilización Recursos</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.resource_utilization}%</div>
                      <Progress value={metrics.resource_utilization} className="mt-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Satisfacción Pacientes</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.patient_satisfaction}%</div>
                      <Progress value={metrics.patient_satisfaction} className="mt-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Productividad Staff</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.staff_productivity}%</div>
                      <Progress value={metrics.staff_productivity} className="mt-2" />
                    </CardContent>
                  </Card>
                </div>
              </EnhancedStaggerChild>

              {/* Gráficos de tendencias */}
              <EnhancedStaggerChild>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tendencia Semanal</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={metrics.trends.weekly}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="week" />
                          <YAxis />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#8884d8" 
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Tendencia Mensual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={metrics.trends.monthly}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="score" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </EnhancedStaggerChild>
            </EnhancedStaggerContainer>
          )}

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preallocation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución Aleatoria de Cupos</CardTitle>
              <CardDescription>Genera un plan de cupos antes de la fecha objetivo (excluye fines de semana).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Fecha Objetivo</Label>
                  <Input type="date" value={preallocForm.target_date} onChange={e=>setPreallocForm(f=>({...f,target_date:e.target.value}))} />
                </div>
                <div>
                  <Label>Total Cupos</Label>
                  <Input type="number" min={1} value={preallocForm.total_slots} onChange={e=>setPreallocForm(f=>({...f,total_slots:e.target.value}))} />
                </div>
                <div>
                  <Label>Fecha Publicación (inicio)</Label>
                  <Input type="date" value={preallocForm.publish_date} onChange={e=>setPreallocForm(f=>({...f,publish_date:e.target.value}))} />
                </div>
                <div>
                  <Label>Doctor</Label>
                  <Select value={preallocForm.doctor_id} onValueChange={(v)=>setPreallocForm(f=>({...f,doctor_id:v}))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {doctors.map(d=> <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sede</Label>
                  <Select value={preallocForm.location_id} onValueChange={(v)=>setPreallocForm(f=>({...f,location_id:v}))}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {locations.map(l=> <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end space-x-2">
                  <div className="flex items-center space-x-2">
                    <input id="applyPersist" type="checkbox" className="h-4 w-4" checked={preallocForm.apply} onChange={e=>setPreallocForm(f=>({...f,apply:e.target.checked}))} />
                    <Label htmlFor="applyPersist">Persistir</Label>
                  </div>
                </div>
              </div>
              <Button disabled={loading} onClick={runPreallocation}>{loading? 'Generando...' : 'Generar Distribución'}</Button>
              {preallocResult && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">{preallocResult.working_days} días hábiles | Total asignado {preallocResult.stats.total} | Promedio {preallocResult.stats.average_per_day.toFixed(2)} | Desv.Std {preallocResult.stats.std_deviation}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {preallocResult.distribution.map((d:any)=> (
                      <div key={d.date} className="border rounded p-2 text-center text-sm">
                        <div className="font-medium">{d.date}</div>
                        <div className="text-primary text-lg font-bold">{d.assigned}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgendaOptimizationDashboard;
