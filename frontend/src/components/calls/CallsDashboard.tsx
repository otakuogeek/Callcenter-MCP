/**
 * Dashboard principal de llamadas con datos de ElevenLabs
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Phone, PhoneCall, Clock, Users, Activity, ArrowRightLeft, Play, Pause } from 'lucide-react';
import { callsApi, CallData, DashboardData, formatDuration, getPriorityColor, getStatusColor } from '@/services/callsApi';
import { toast } from 'sonner';

const CallsDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transferDialog, setTransferDialog] = useState<{ open: boolean; callId: number | null }>({
    open: false,
    callId: null
  });
  const [attendDialog, setAttendDialog] = useState<{ open: boolean; callId: number | null }>({
    open: false,
    callId: null
  });
  const [agentName, setAgentName] = useState('');

  // Cargar datos del dashboard
  const loadDashboardData = async () => {
    try {
      const data = await callsApi.getDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refrescar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  // Transferir llamada
  const handleTransfer = async () => {
    if (!transferDialog.callId || !agentName) return;

    try {
      await callsApi.transferCall(transferDialog.callId, agentName);
      toast.success('Llamada transferida exitosamente');
      setTransferDialog({ open: false, callId: null });
      setAgentName('');
      await loadDashboardData();
    } catch (error) {
      console.error('Error transferring call:', error);
      toast.error('Error al transferir llamada');
    }
  };

  // Atender llamada
  const handleAttend = async () => {
    if (!attendDialog.callId || !agentName) return;

    try {
      await callsApi.attendCall(attendDialog.callId, agentName);
      toast.success('Llamada atendida exitosamente');
      setAttendDialog({ open: false, callId: null });
      setAgentName('');
      await loadDashboardData();
    } catch (error) {
      console.error('Error attending call:', error);
      toast.error('Error al atender llamada');
    }
  };

  // Poner en espera
  const handleHold = async (callId: number) => {
    try {
      await callsApi.holdCall(callId);
      toast.success('Llamada puesta en espera');
      await loadDashboardData();
    } catch (error) {
      console.error('Error holding call:', error);
      toast.error('Error al poner llamada en espera');
    }
  };

  // Componente para mostrar una llamada
  const CallCard: React.FC<{ call: CallData; isActive: boolean }> = ({ call, isActive }) => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {isActive ? <Phone className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-yellow-500" />}
              {call.patient_name}
            </CardTitle>
            <CardDescription>{call.patient_phone}</CardDescription>
          </div>
          <div className="flex flex-col gap-2">
            <Badge className={getPriorityColor(call.priority)}>
              {call.priority}
            </Badge>
            <Badge className={getStatusColor(call.status)}>
              {call.status === 'active' ? 'Activa' : call.status === 'waiting' ? 'En espera' : 'Finalizada'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Agente</p>
            <p className="font-medium">{call.agent_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tipo de llamada</p>
            <p className="font-medium">{call.call_type}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Duración</p>
            <p className="font-medium">
              {isActive 
                ? formatDuration(call.current_duration || call.duration)
                : call.waiting_time 
                  ? `Esperando: ${formatDuration(call.waiting_time)}`
                  : formatDuration(call.duration)
              }
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">ID Conversación</p>
            <p className="font-medium text-xs">{call.conversation_id}</p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 flex-wrap">
          {isActive ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTransferDialog({ open: true, callId: call.id })}
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Transferir
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleHold(call.id)}
              >
                <Pause className="h-4 w-4 mr-1" />
                En espera
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={() => setAttendDialog({ open: true, callId: call.id })}
            >
              <Play className="h-4 w-4 mr-1" />
              Atender
            </Button>
          )}

          {/* Mostrar datos de webhook si existen */}
          {call.webhook_data && (
            <Badge variant="secondary" className="text-xs">
              ElevenLabs Data
            </Badge>
          )}
        </div>

        {/* Mostrar información adicional de ElevenLabs */}
        {call.audio_url && (
          <div className="mt-3 p-2 bg-muted rounded">
            <p className="text-sm text-muted-foreground mb-1">Audio de la llamada:</p>
            <audio controls className="w-full">
              <source src={call.audio_url} type="audio/mpeg" />
              Tu navegador no soporta el elemento de audio.
            </audio>
          </div>
        )}

        {call.transcript && (
          <div className="mt-3 p-2 bg-muted rounded">
            <p className="text-sm text-muted-foreground mb-1">Transcripción:</p>
            <p className="text-sm">{call.transcript}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Efecto para cargar datos iniciales y actualizar cada 30 segundos
  useEffect(() => {
    loadDashboardData();
    
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000); // Actualizar cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando llamadas...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Llamadas</h1>
          <p className="text-muted-foreground">Gestión en tiempo real con ElevenLabs</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Estadísticas */}
      {dashboardData?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Activas</p>
                  <p className="text-2xl font-bold">{dashboardData.stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">En espera</p>
                  <p className="text-2xl font-bold">{dashboardData.stats.waiting}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Completadas hoy</p>
                  <p className="text-2xl font-bold">{dashboardData.stats.completed_today}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Duración promedio</p>
                  <p className="text-lg font-bold">{formatDuration(Math.floor(dashboardData.stats.avg_duration))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Tiempo total</p>
                  <p className="text-lg font-bold">{formatDuration(dashboardData.stats.total_duration)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs para llamadas activas y en espera */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Llamadas Activas ({dashboardData?.active.length || 0})
          </TabsTrigger>
          <TabsTrigger value="waiting">
            Cola de Espera ({dashboardData?.waiting.length || 0})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-4">
          {dashboardData?.active.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay llamadas activas en este momento</p>
              </CardContent>
            </Card>
          ) : (
            dashboardData?.active.map((call) => (
              <CallCard key={call.id} call={call} isActive={true} />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="waiting" className="mt-4">
          {dashboardData?.waiting.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay llamadas en espera</p>
              </CardContent>
            </Card>
          ) : (
            dashboardData?.waiting.map((call) => (
              <CallCard key={call.id} call={call} isActive={false} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para transferir llamada */}
      <Dialog open={transferDialog.open} onOpenChange={(open) => setTransferDialog({ open, callId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Llamada</DialogTitle>
            <DialogDescription>
              Ingrese el nombre del agente al que desea transferir la llamada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="agent" className="text-right">
                Agente
              </Label>
              <Input
                id="agent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="col-span-3"
                placeholder="Nombre del agente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleTransfer} disabled={!agentName}>
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para atender llamada */}
      <Dialog open={attendDialog.open} onOpenChange={(open) => setAttendDialog({ open, callId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atender Llamada</DialogTitle>
            <DialogDescription>
              Ingrese el nombre del agente que atenderá la llamada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="attendAgent" className="text-right">
                Agente
              </Label>
              <Input
                id="attendAgent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="col-span-3"
                placeholder="Nombre del agente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAttend} disabled={!agentName}>
              Atender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CallsDashboard;
