import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import AgendaTemplatesManager from '../components/AgendaTemplatesManager';
import AgendaOptimizationDashboard from '../components/AgendaOptimizationDashboard';
import AgendaConflictManager from '../components/AgendaConflictManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Settings, AlertTriangle, BarChart3 } from 'lucide-react';

const AgendaManagement = () => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1">
        <div className="flex items-center gap-4 p-4 border-b">
          <SidebarTrigger />
          <div>
            <h1 className="text-2xl font-bold">Gestión de Agenda</h1>
            <p className="text-muted-foreground">
              Herramientas avanzadas para la gestión, optimización y resolución de conflictos en la agenda médica
            </p>
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="templates" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Plantillas de Agenda
              </TabsTrigger>
              <TabsTrigger value="optimization" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Optimización
              </TabsTrigger>
              <TabsTrigger value="conflicts" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Gestión de Conflictos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-6">
              <AgendaTemplatesManager />
            </TabsContent>

            <TabsContent value="optimization" className="space-y-6">
              <AgendaOptimizationDashboard />
            </TabsContent>

            <TabsContent value="conflicts" className="space-y-6">
              <AgendaConflictManager />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default AgendaManagement;
