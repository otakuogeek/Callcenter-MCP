import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Brain, 
  Clock, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Zap,
  Users,
  BarChart3,
  Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface SchedulingSuggestion {
  type: 'optimization' | 'conflict' | 'opportunity' | 'efficiency';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
  impact?: string;
  data?: any;
}

interface SmartMetrics {
  efficiency_score: number;
  utilization_rate: number;
  conflict_rate: number;
  patient_satisfaction_score: number;
  recommendations_count: number;
}

const SmartSchedulingAssistant = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([]);
  const [metrics, setMetrics] = useState<SmartMetrics | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysisType, setAnalysisType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    loadSmartAnalysis();
  }, [selectedDate, analysisType]);

  const loadSmartAnalysis = async () => {
    setLoading(true);
    try {
      // Simular análisis inteligente - en producción conectar con API de IA
      const mockSuggestions: SchedulingSuggestion[] = [
        {
          type: 'optimization',
          priority: 'high',
          title: 'Optimización de Horarios Detectada',
          description: 'Se detectaron 3 huecos de 30 minutos entre citas que podrían consolidarse',
          action: 'Reagendar citas para optimizar tiempo',
          impact: 'Ahorro de 1.5 horas diarias'
        },
        {
          type: 'conflict',
          priority: 'medium',
          title: 'Potencial Sobrecarga',
          description: 'El Dr. García tiene 12 citas programadas el viernes, 20% más que el promedio',
          action: 'Redistribuir 2-3 citas a otros días',
          impact: 'Mejor calidad de atención'
        },
        {
          type: 'opportunity',
          priority: 'medium',
          title: 'Slots Subutilizados',
          description: 'Martes por la tarde tiene solo 40% de ocupación',
          action: 'Promocionar horarios disponibles',
          impact: 'Aumento de 25% en citas'
        },
        {
          type: 'efficiency',
          priority: 'low',
          title: 'Patrón de Cancelaciones',
          description: 'Lunes temprano tiene 15% más cancelaciones que otros días',
          action: 'Implementar recordatorios adicionales',
          impact: 'Reducción de 10% en cancelaciones'
        }
      ];

      const mockMetrics: SmartMetrics = {
        efficiency_score: 85,
        utilization_rate: 78,
        conflict_rate: 5,
        patient_satisfaction_score: 92,
        recommendations_count: mockSuggestions.length
      };

      setSuggestions(mockSuggestions);
      setMetrics(mockMetrics);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar el análisis inteligente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = async (suggestion: SchedulingSuggestion) => {
    try {
      toast({
        title: "Sugerencia Aplicada",
        description: `Se implementó: ${suggestion.title}`,
      });
      
      // Actualizar sugerencias después de aplicar
      await loadSmartAnalysis();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo aplicar la sugerencia",
        variant: "destructive"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'optimization': return <Zap className="w-4 h-4 text-blue-500" />;
      case 'conflict': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'opportunity': return <Target className="w-4 h-4 text-green-500" />;
      case 'efficiency': return <TrendingUp className="w-4 h-4 text-purple-500" />;
      default: return <Brain className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Brain className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Asistente Inteligente de Agenda</h2>
            <p className="text-gray-600">Optimización automática y sugerencias basadas en IA</p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label htmlFor="date">Fecha de Análisis</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="analysis">Tipo de Análisis</Label>
            <Select value={analysisType} onValueChange={(value: any) => setAnalysisType(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Análisis Diario</SelectItem>
                <SelectItem value="weekly">Análisis Semanal</SelectItem>
                <SelectItem value="monthly">Análisis Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadSmartAnalysis} disabled={loading}>
            {loading ? 'Analizando...' : 'Actualizar Análisis'}
          </Button>
        </div>
      </div>

      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-600">Eficiencia</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{metrics.efficiency_score}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-600">Utilización</span>
              </div>
              <div className="text-2xl font-bold text-green-600 mt-1">{metrics.utilization_rate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-gray-600">Conflictos</span>
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">{metrics.conflict_rate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-600">Satisfacción</span>
              </div>
              <div className="text-2xl font-bold text-purple-600 mt-1">{metrics.patient_satisfaction_score}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-600">Sugerencias</span>
              </div>
              <div className="text-2xl font-bold text-orange-600 mt-1">{metrics.recommendations_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sugerencias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            Sugerencias Inteligentes
          </CardTitle>
          <CardDescription>
            Recomendaciones automáticas para optimizar tu agenda
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Analizando patrones de agenda...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">¡Agenda Optimizada!</h4>
              <p className="text-gray-600">No se encontraron sugerencias de mejora en este momento</p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div key={index} className={`border rounded-lg p-4 ${getPriorityColor(suggestion.priority)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(suggestion.type)}
                        <h4 className="font-semibold">{suggestion.title}</h4>
                        <Badge variant="outline" className={getPriorityColor(suggestion.priority)}>
                          {suggestion.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{suggestion.description}</p>
                      {suggestion.action && (
                        <p className="text-sm font-medium mb-1">
                          <strong>Acción sugerida:</strong> {suggestion.action}
                        </p>
                      )}
                      {suggestion.impact && (
                        <p className="text-sm font-medium">
                          <strong>Impacto esperado:</strong> {suggestion.impact}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applySuggestion(suggestion)}
                      >
                        Aplicar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSuggestions(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartSchedulingAssistant;
