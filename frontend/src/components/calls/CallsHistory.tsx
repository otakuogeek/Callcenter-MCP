/**
 * Componente para mostrar el historial completo de llamadas con datos de ElevenLabs
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Search, Filter, Download, Eye, Volume2, FileText } from 'lucide-react';
import { callsApi, CallData, formatDuration, getPriorityColor, getStatusColor } from '@/services/callsApi';
import { toast } from 'sonner';

const CallsHistory: React.FC = () => {
  const [calls, setCalls] = useState<CallData[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedCall, setSelectedCall] = useState<CallData | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Cargar historial de llamadas
  const loadCallHistory = async () => {
    try {
      setLoading(true);
      const response = await callsApi.getCallHistory({
        status: statusFilter,
        priority: priorityFilter,
        search: searchTerm,
        limit,
        page
      });
  setCalls(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Error loading call history:', error);
      toast.error('Error al cargar historial de llamadas');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar detalles de la llamada
  const showCallDetails = (call: CallData) => {
    setSelectedCall(call);
    setDetailsOpen(true);
  };

  // Exportar datos (simulado)
  const exportData = () => {
    const csvContent = [
      'ID,Paciente,Teléfono,Agente,Tipo,Estado,Prioridad,Duración,Fecha',
  ...calls.map(call => [
        call.id,
        call.patient_name,
        call.patient_phone,
        call.agent_name,
        call.call_type,
        call.status,
        call.priority,
        call.duration,
        new Date(call.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llamadas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Datos exportados exitosamente');
  };

  // Efectos
  useEffect(() => {
    loadCallHistory();
  }, []);

  // Backend aplica filtros; recargamos manualmente con botón o cambios de dependencias relevantes

  // Recargar historial cuando cambian parámetros remotos
  useEffect(() => {
    loadCallHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, page, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando historial...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Historial de Llamadas</h1>
          <p className="text-muted-foreground">Registro completo con datos de ElevenLabs</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportData} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={loadCallHistory}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, teléfono o agente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activa</SelectItem>
                <SelectItem value="waiting">En espera</SelectItem>
                <SelectItem value="ended">Finalizada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                <SelectItem value="urgencia">Urgencia</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center text-sm text-muted-foreground">
              Mostrando {calls.length} de {total} llamadas (página {page + 1})
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de llamadas */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>ElevenLabs</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{call.patient_name}</p>
                      <p className="text-sm text-muted-foreground">{call.patient_phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>{call.agent_name}</TableCell>
                  <TableCell>{call.call_type}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(call.status)}>
                      {call.status === 'active' ? 'Activa' : 
                       call.status === 'waiting' ? 'En espera' : 'Finalizada'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(call.priority)}>
                      {call.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDuration(call.duration)}</TableCell>
                  <TableCell>
                    {new Date(call.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {call.webhook_data && (
                        <Badge variant="secondary" className="text-xs">
                          Webhook
                        </Badge>
                      )}
                      {call.audio_url && (
                        <Badge variant="secondary" className="text-xs">
                          Audio
                        </Badge>
                      )}
                      {call.transcript && (
                        <Badge variant="secondary" className="text-xs">
                          Transcripción
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => showCallDetails(call)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Controles de paginación */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <div>
          Página {page + 1} de {Math.max(1, Math.ceil(total / limit))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >Anterior</Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * limit >= total}
            onClick={() => setPage(p => p + 1)}
          >Siguiente</Button>
          <Select value={String(limit)} onValueChange={(v) => { setPage(0); setLimit(parseInt(v)); }}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Límite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dialog de detalles */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalles de la Llamada</DialogTitle>
            <DialogDescription>
              Información completa y datos de ElevenLabs
            </DialogDescription>
          </DialogHeader>
          
          {selectedCall && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Información básica */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Información del Paciente</h3>
                    <div className="space-y-2">
                      <p><span className="font-medium">Nombre:</span> {selectedCall.patient_name}</p>
                      <p><span className="font-medium">Teléfono:</span> {selectedCall.patient_phone}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Información de la Llamada</h3>
                    <div className="space-y-2">
                      <p><span className="font-medium">Agente:</span> {selectedCall.agent_name}</p>
                      <p><span className="font-medium">Tipo:</span> {selectedCall.call_type}</p>
                      <p><span className="font-medium">Estado:</span> 
                        <Badge className={`ml-2 ${getStatusColor(selectedCall.status)}`}>
                          {selectedCall.status}
                        </Badge>
                      </p>
                      <p><span className="font-medium">Prioridad:</span> 
                        <Badge className={`ml-2 ${getPriorityColor(selectedCall.priority)}`}>
                          {selectedCall.priority}
                        </Badge>
                      </p>
                      <p><span className="font-medium">Duración:</span> {formatDuration(selectedCall.duration)}</p>
                      <p><span className="font-medium">ID Conversación:</span> {selectedCall.conversation_id}</p>
                    </div>
                  </div>
                </div>

                {/* Datos de ElevenLabs */}
                {selectedCall.webhook_data && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Datos del Webhook (Inicio)
                    </h3>
                    <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                      {JSON.stringify(selectedCall.webhook_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedCall.webhook_data_end && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Datos del Webhook (Final)
                    </h3>
                    <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                      {JSON.stringify(selectedCall.webhook_data_end, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Audio */}
                {selectedCall.audio_url && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      Audio de la Llamada
                    </h3>
                    <audio controls className="w-full">
                      <source src={selectedCall.audio_url} type="audio/mpeg" />
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                  </div>
                )}

                {/* Transcripción */}
                {selectedCall.transcript && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Transcripción
                    </h3>
                    <div className="bg-muted p-4 rounded">
                      <p className="whitespace-pre-wrap">{selectedCall.transcript}</p>
                    </div>
                  </div>
                )}

                {/* Fechas */}
                <div>
                  <h3 className="font-semibold mb-2">Fechas</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><span className="font-medium">Creada:</span> {new Date(selectedCall.created_at).toLocaleString('es-ES')}</p>
                      <p><span className="font-medium">Actualizada:</span> {new Date(selectedCall.updated_at).toLocaleString('es-ES')}</p>
                    </div>
                    <div>
                      {selectedCall.start_time && (
                        <p><span className="font-medium">Inicio:</span> {new Date(selectedCall.start_time).toLocaleString('es-ES')}</p>
                      )}
                      {selectedCall.end_time && (
                        <p><span className="font-medium">Final:</span> {new Date(selectedCall.end_time).toLocaleString('es-ES')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CallsHistory;
