import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDistribution } from '@/hooks/useDistribution';
import { RefreshCw, Calendar, Users, Clock, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DistributionStatisticsData {
  overview: {
    total_quota: number;
    total_assigned: number;
    total_remaining: number;
    utilization_rate: number;
    total_days: number;
  };
  by_doctor: Array<{
    doctor_id: number;
    doctor_name: string;
    total_quota: number;
    total_assigned: number;
    utilization_rate: number;
  }>;
  by_specialty: Array<{
    specialty_id: number;
    specialty_name: string;
    total_quota: number;
    total_assigned: number;
    utilization_rate: number;
  }>;
  by_location: Array<{
    location_id: number;
    location_name: string;
    total_quota: number;
    total_assigned: number;
    utilization_rate: number;
  }>;
}

const DistributionStatistics: React.FC = () => {
  const { getDistributionStatistics, loading } = useDistribution();
  const [statistics, setStatistics] = useState<DistributionStatisticsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatistics = async () => {
    setRefreshing(true);
    try {
      const stats = await getDistributionStatistics();
      if (stats) {
        setStatistics(stats);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  const getUtilizationColor = (rate: number | undefined | null) => {
    const safeRate = rate || 0;
    if (safeRate >= 80) return 'text-green-600';
    if (safeRate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUtilizationIcon = (rate: number | undefined | null) => {
    const safeRate = rate || 0;
    if (safeRate >= 80) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (safeRate >= 60) return <Activity className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  if (loading || refreshing) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Cargando estadísticas...</span>
      </div>
    );
  }

  if (!statistics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No hay datos de estadísticas disponibles.
            <Button 
              variant="outline" 
              onClick={loadStatistics}
              className="mt-4 ml-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { overview, by_doctor, by_specialty, by_location } = statistics;

  return (
    <div className="space-y-6">
      {/* Header con botón de actualizar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Estadísticas de Distribución</h2>
          <p className="text-muted-foreground">
            Resumen de cupos y utilización del sistema
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={loadStatistics}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Estadísticas generales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cupos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.total_quota}</div>
            <p className="text-xs text-muted-foreground">
              En {overview.total_days} días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cupos Asignados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{overview.total_assigned}</div>
            <p className="text-xs text-muted-foreground">
              Pacientes programados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cupos Disponibles</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overview.total_remaining}</div>
            <p className="text-xs text-muted-foreground">
              Disponibles para agendar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Utilización</CardTitle>
            {getUtilizationIcon(overview.utilization_rate)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getUtilizationColor(overview.utilization_rate || 0)}`}>
              {(overview.utilization_rate || 0).toFixed(1)}%
            </div>
            <Progress 
              value={overview.utilization_rate || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas por doctor */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución por Doctor</CardTitle>
          <CardDescription>
            Cupos y utilización por cada médico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {by_doctor.map((doctor) => (
                <div key={doctor.doctor_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{doctor.doctor_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {doctor.total_assigned} de {doctor.total_quota} cupos
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={(doctor.utilization_rate || 0) >= 80 ? "default" : (doctor.utilization_rate || 0) >= 60 ? "secondary" : "destructive"}>
                      {(doctor.utilization_rate || 0).toFixed(1)}%
                    </Badge>
                    {getUtilizationIcon(doctor.utilization_rate || 0)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Estadísticas por especialidad */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por Especialidad</CardTitle>
            <CardDescription>
              Distribución de cupos por especialidad médica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {by_specialty.map((specialty) => (
                  <div key={specialty.specialty_id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{specialty.specialty_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {specialty.total_assigned}/{specialty.total_quota}
                      </div>
                    </div>
                    <Badge variant="outline" className={getUtilizationColor(specialty.utilization_rate || 0)}>
                      {(specialty.utilization_rate || 0).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Estadísticas por ubicación */}
        <Card>
          <CardHeader>
            <CardTitle>Por Ubicación</CardTitle>
            <CardDescription>
              Distribución de cupos por centro médico
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {by_location.map((location) => (
                  <div key={location.location_id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{location.location_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {location.total_assigned}/{location.total_quota}
                      </div>
                    </div>
                    <Badge variant="outline" className={getUtilizationColor(location.utilization_rate || 0)}>
                      {(location.utilization_rate || 0).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Información adicional */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            Última actualización: {format(new Date(), 'PPpp', { locale: es })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributionStatistics;