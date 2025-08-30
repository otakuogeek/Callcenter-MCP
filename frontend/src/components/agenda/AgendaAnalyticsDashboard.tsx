import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock, 
  Calendar,
  BarChart3,
  PieChart,
  AlertTriangle,
  CheckCircle,
  Timer,
  Target,
  Zap,
  Activity,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface TemplateAnalytics {
  general_stats: {
    total_templates: number;
    active_templates: number;
    avg_duration: number;
  };
  usage_stats: Array<{
    id: string;
    name: string;
    generated_slots: number;
    days_covered: number;
  }>;
  efficiency_stats: Array<{
    name: string;
    total_slots: number;
    booked_slots: number;
    utilization_rate: number;
  }>;
  day_distribution: Array<{
    days: string;
    template_count: number;
  }>;
}

interface AgendaMetrics {
  week_efficiency: number;
  month_utilization: number;
  conflicts_detected: number;
  optimization_opportunities: number;
  recommendations: Array<{
    type: 'efficiency' | 'conflict' | 'capacity' | 'distribution';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    action: string;
  }>;
}

const AgendaAnalyticsDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Obtener datos de analíticas de plantillas
  const { data: templateAnalytics, isLoading: templateLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ['template-analytics'],
    queryFn: () => api.getTemplateAnalytics?.() || Promise.resolve({
      general_stats: { total_templates: 0, active_templates: 0, avg_duration: 30 },
      usage_stats: [],
      efficiency_stats: [],
      day_distribution: []
    })
  });

  // Simular datos de métricas de agenda (esto se conectaría a una API real)
  const agendaMetrics: AgendaMetrics = {
    week_efficiency: 78,
    month_utilization: 85,
    conflicts_detected: 3,
    optimization_opportunities: 12,
    recommendations: [
      {
        type: 'efficiency',
        title: 'Optimizar horarios de Cardiología',
        description: 'Se detectaron espacios de 15 minutos entre citas que pueden aprovecharse',
        impact: 'high',
        action: 'Reducir duración de consultas de 45 a 40 minutos'
      },
      {
        type: 'capacity',
        title: 'Incrementar capacidad en Pediatría',
        description: 'Alta demanda los jueves en horario de tarde',
        impact: 'medium',
        action: 'Agregar un consultorio adicional los jueves 14:00-18:00'
      },
      {
        type: 'distribution',
        title: 'Redistribuir citas de Medicina General',
        description: 'Concentración excesiva en lunes y martes',
        impact: 'medium',
        action: 'Promover citas de miércoles a viernes con incentivos'
      },
      {
        type: 'conflict',
        title: 'Resolver conflictos de sala',
        description: '3 citas programadas simultáneamente en Sala 1',
        impact: 'high',
        action: 'Reasignar 2 citas a Salas 2 y 3'
      }
    ]
  };

  const handleRefreshAnalytics = async () => {
    setRefreshing(true);
    try {
      await refetchTemplates();
      toast({
        title: "Actualizado",
        description: "Analíticas actualizadas correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron actualizar las analíticas",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'efficiency': return <Timer className="w-4 h-4" />;
      case 'capacity': return <Users className="w-4 h-4" />;
      case 'distribution': return <BarChart3 className="w-4 h-4" />;
      case 'conflict': return <AlertTriangle className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getDayName = (dayString: string) => {
    try {
      const days = JSON.parse(dayString);
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days.map((d: number) => dayNames[d]).join(', ');
    } catch {
      return 'N/A';
    }
  };

  if (templateLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analíticas de Agenda</h2>
            <p className="text-gray-600 mt-1">Métricas y recomendaciones inteligentes</p>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando analíticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analíticas de Agenda</h2>
          <p className="text-gray-600 mt-1">Métricas y recomendaciones inteligentes</p>
        </div>
        <Button 
          onClick={handleRefreshAnalytics} 
          variant="outline"
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Eficiencia Semanal</p>
                <p className="text-2xl font-bold text-gray-900">{agendaMetrics.week_efficiency}%</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="mt-2">
              <Badge variant={agendaMetrics.week_efficiency >= 80 ? "default" : "secondary"}>
                {agendaMetrics.week_efficiency >= 80 ? "Excelente" : "Mejorable"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Utilización Mensual</p>
                <p className="text-2xl font-bold text-gray-900">{agendaMetrics.month_utilization}%</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="mt-2">
              <Badge variant={agendaMetrics.month_utilization >= 85 ? "default" : "secondary"}>
                {agendaMetrics.month_utilization >= 85 ? "Óptima" : "Puede mejorar"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conflictos Detectados</p>
                <p className="text-2xl font-bold text-gray-900">{agendaMetrics.conflicts_detected}</p>
              </div>
              <div className={`h-8 w-8 ${agendaMetrics.conflicts_detected > 0 ? 'bg-red-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
                {agendaMetrics.conflicts_detected > 0 ? 
                  <AlertTriangle className="h-4 w-4 text-red-600" /> :
                  <CheckCircle className="h-4 w-4 text-green-600" />
                }
              </div>
            </div>
            <div className="mt-2">
              <Badge variant={agendaMetrics.conflicts_detected === 0 ? "default" : "destructive"}>
                {agendaMetrics.conflicts_detected === 0 ? "Sin conflictos" : "Requiere atención"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Oportunidades</p>
                <p className="text-2xl font-bold text-gray-900">{agendaMetrics.optimization_opportunities}</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Zap className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
            <div className="mt-2">
              <Badge variant="outline">Optimizaciones disponibles</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          <TabsTrigger value="efficiency">Eficiencia</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>

        {/* Recomendaciones Inteligentes */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Recomendaciones Inteligentes
              </CardTitle>
              <CardDescription>
                Sugerencias automáticas para optimizar la gestión de agenda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agendaMetrics.recommendations.map((rec, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {getRecommendationIcon(rec.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{rec.title}</h4>
                            <Badge variant={getImpactColor(rec.impact) as any}>
                              {rec.impact === 'high' ? 'Alto impacto' : 
                               rec.impact === 'medium' ? 'Impacto medio' : 'Bajo impacto'}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-2">{rec.description}</p>
                          <p className="text-sm font-medium text-blue-600">{rec.action}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Aplicar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Análisis de Plantillas */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Estadísticas Generales */}
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas de Plantillas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total de Plantillas</span>
                    <span className="font-semibold">{templateAnalytics?.general_stats.total_templates || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Plantillas Activas</span>
                    <span className="font-semibold">{templateAnalytics?.general_stats.active_templates || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Duración Promedio</span>
                    <span className="font-semibold">{templateAnalytics?.general_stats.avg_duration || 30} min</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plantillas Más Utilizadas */}
            <Card>
              <CardHeader>
                <CardTitle>Plantillas Más Utilizadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {templateAnalytics?.usage_stats?.slice(0, 5).map((template, index) => (
                    <div key={template.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-xs text-gray-600">{template.days_covered} días cubiertos</p>
                      </div>
                      <Badge variant="outline">{template.generated_slots} slots</Badge>
                    </div>
                  )) || <p className="text-gray-500 text-center py-4">No hay datos disponibles</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Análisis de Eficiencia */}
        <TabsContent value="efficiency">
          <Card>
            <CardHeader>
              <CardTitle>Eficiencia por Plantilla</CardTitle>
              <CardDescription>
                Tasa de utilización de slots generados vs. reservados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templateAnalytics?.efficiency_stats?.map((stat, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{stat.name}</h4>
                      <Badge variant={stat.utilization_rate >= 80 ? "default" : 
                                   stat.utilization_rate >= 60 ? "secondary" : "outline"}>
                        {stat.utilization_rate}% utilización
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Total Slots</p>
                        <p className="font-medium">{stat.total_slots}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Reservados</p>
                        <p className="font-medium">{stat.booked_slots}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Disponibles</p>
                        <p className="font-medium">{stat.total_slots - stat.booked_slots}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${stat.utilization_rate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )) || <p className="text-gray-500 text-center py-8">No hay datos de eficiencia disponibles</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tendencias */}
        <TabsContent value="trends">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Días</CardTitle>
                <CardDescription>
                  Plantillas configuradas por días de la semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {templateAnalytics?.day_distribution?.map((dist, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{getDayName(dist.days)}</span>
                      <Badge variant="outline">{dist.template_count} plantillas</Badge>
                    </div>
                  )) || <p className="text-gray-500 text-center py-4">No hay datos disponibles</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Próximas Mejoras</CardTitle>
                <CardDescription>
                  Funcionalidades que se agregarán pronto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Predicción de demanda por IA</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded border-l-4 border-green-500">
                    <BarChart3 className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Optimización automática de horarios</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded border-l-4 border-yellow-500">
                    <Users className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm">Análisis de patrones de pacientes</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border-l-4 border-purple-500">
                    <PieChart className="w-4 h-4 text-purple-600" />
                    <span className="text-sm">Dashboard en tiempo real</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgendaAnalyticsDashboard;
