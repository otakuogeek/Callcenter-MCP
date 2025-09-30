import React, { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDistribution } from '@/hooks/useDistribution';
import DistributionCalendar from '@/components/DistributionCalendar';
import DistributionManagement from '@/components/DistributionManagement';
import { BarChart3, Calendar, Settings, TrendingUp, RefreshCw } from 'lucide-react';

const DistributionDashboard: React.FC = () => {
  const { 
    distributionList, 
    loading, 
    getAllDistributions
  } = useDistribution();
  
  const [refreshing, setRefreshing] = useState(false);

  // Cargar distribuciones al montar el componente
  useEffect(() => {
    loadDistributions();
  }, []);

  const loadDistributions = async () => {
    setRefreshing(true);
    try {
      await getAllDistributions();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDistributionUpdate = () => {
    // Recargar datos después de una actualización
    loadDistributions();
  };

  // Calcular estadísticas básicas
  const totalQuota = distributionList.reduce((sum, dist) => sum + (dist.quota || 0), 0);
  const totalAssigned = distributionList.reduce((sum, dist) => sum + (dist.assigned || 0), 0);
  const totalRemaining = totalQuota - totalAssigned;
  const utilizationRate = totalQuota > 0 ? (totalAssigned / totalQuota) * 100 : 0;

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 p-6">
        <SidebarTrigger />
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Panel de Distribución</h1>
              <p className="text-muted-foreground">
                Gestiona y visualiza la distribución de cupos médicos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={loadDistributions}
                disabled={loading || refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>

          {/* Resumen rápido */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Distribuciones</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{distributionList.length}</div>
                <p className="text-xs text-muted-foreground">
                  Todas las distribuciones
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cupos Totales</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalQuota}</div>
                <p className="text-xs text-muted-foreground">
                  Cupos disponibles
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cupos Asignados</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{totalAssigned}</div>
                <p className="text-xs text-muted-foreground">
                  Pacientes agendados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilización</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {utilizationRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalRemaining} disponibles
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Contenido principal con tabs */}
          <Tabs defaultValue="calendar" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Calendario
              </TabsTrigger>
              <TabsTrigger value="management" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Gestión
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vista de Calendario</CardTitle>
                  <CardDescription>
                    Visualiza la distribución de cupos en el calendario interactivo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DistributionCalendar />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="management" className="space-y-4">
              <DistributionManagement 
                distributions={distributionList}
                onDistributionUpdate={handleDistributionUpdate}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default DistributionDashboard;
