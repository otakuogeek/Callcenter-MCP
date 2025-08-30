import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, History, Activity } from 'lucide-react';
import CallMonitor from '@/components/CallMonitor';
import CallsDashboard from '@/components/calls/CallsDashboard';
import CallsHistory from '@/components/calls/CallsHistory';
import ProtectedRoute from '@/components/ProtectedRoute';

const CallsPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1">
            <div className="p-6">
              <div className="flex items-center mb-6">
                <SidebarTrigger className="mr-4" />
                <div>
                  <h1 className="text-3xl font-bold">Sistema de Llamadas ElevenLabs</h1>
                  <p className="text-gray-600">Gestión completa con datos en tiempo real y histórico</p>
                </div>
              </div>
              
              <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="dashboard" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Dashboard Avanzado
                  </TabsTrigger>
                  <TabsTrigger value="monitor" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Monitor Simple
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historial Completo
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="dashboard">
                  <CallsDashboard />
                </TabsContent>
                
                <TabsContent value="monitor">
                  <CallMonitor />
                </TabsContent>
                
                <TabsContent value="history">
                  <CallsHistory />
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
};

export default CallsPage;
