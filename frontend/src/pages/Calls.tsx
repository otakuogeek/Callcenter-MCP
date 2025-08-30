
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, PhoneCall, Clock, User } from "lucide-react";

const Calls = () => {
  const activeCalls = [
    { id: 1, patient: "María García", duration: "00:05:23", type: "Consulta General", agent: "Dr. Rodríguez" },
    { id: 2, patient: "Juan Pérez", duration: "00:02:15", type: "Urgencia", agent: "Dra. López" },
    { id: 3, patient: "Ana Martínez", duration: "00:08:47", type: "Seguimiento", agent: "Dr. Torres" },
  ];

  const queuedCalls = [
    { id: 4, patient: "Carlos Jiménez", waitTime: "00:03:12", type: "Consulta General", priority: "Normal" },
    { id: 5, patient: "Laura Sánchez", waitTime: "00:01:45", type: "Urgencia", priority: "Alta" },
    { id: 6, patient: "Pedro González", waitTime: "00:05:08", type: "Información", priority: "Baja" },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-medical-800 mb-2">Gestión de Llamadas</h1>
              <p className="text-medical-600">Control en tiempo real de llamadas activas y cola de espera</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Llamadas Activas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-medical-700">
                    <PhoneCall className="w-5 h-5" />
                    Llamadas Activas
                  </CardTitle>
                  <CardDescription>
                    Llamadas actualmente en curso
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {activeCalls.map((call) => (
                      <div key={call.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-medical-600" />
                            <span className="font-semibold">{call.patient}</span>
                            <Badge variant="outline" className="text-xs">
                              {call.type}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            Agente: {call.agent}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-medical-600 font-mono">
                            <Clock className="w-4 h-4" />
                            {call.duration}
                          </div>
                          <Button size="sm" variant="outline" className="mt-2">
                            Transferir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cola de Espera */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-medical-700">
                    <Phone className="w-5 h-5" />
                    Cola de Espera
                  </CardTitle>
                  <CardDescription>
                    Llamadas pendientes de atención
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {queuedCalls.map((call) => (
                      <div key={call.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-medical-600" />
                            <span className="font-semibold">{call.patient}</span>
                            <Badge 
                              variant={call.priority === "Alta" ? "destructive" : call.priority === "Normal" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {call.priority}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            Tipo: {call.type}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-warning-600 font-mono">
                            <Clock className="w-4 h-4" />
                            {call.waitTime}
                          </div>
                          <Button size="sm" className="mt-2">
                            Atender
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Calls;
