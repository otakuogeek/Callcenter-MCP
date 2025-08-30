import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Phone, 
  PhoneOff, 
  Clock, 
  Activity, 
  RefreshCw,
  PlayCircle,
  StopCircle,
  Volume2,
  FileText,
  
} from 'lucide-react';
import { format } from 'date-fns';
import { callsApi, CallStatusData } from '@/services/callsApi';
import { es } from 'date-fns/locale';

// Tipos locales eliminados: ahora se usan los provistos por el servicio

const CallMonitor: React.FC = () => {
  const [callData, setCallData] = useState<CallStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const safeParseDate = (value: any): Date | null => {
    if (!value || typeof value !== 'string') return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const safeFormat = (value: any, pattern: string): string => {
    const d = safeParseDate(value);
    if (!d) return '—';
    try {
      return format(d, pattern, { locale: es });
    } catch {
      return '—';
    }
  };

  const fetchCallStatus = async () => {
    try {
      const data = await callsApi.getCallStatus();
      setCallData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error fetching call status:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getCallStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 animate-pulse';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getCallStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'En línea';
      case 'completed':
        return 'Completada';
      default:
        return 'Desconocido';
    }
  };

  useEffect(() => {
    fetchCallStatus();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchCallStatus, 5000); // Actualizar cada 5 segundos
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh]);

  const handleRefresh = () => {
    setLoading(true);
    fetchCallStatus();
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  if (loading && !callData) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando estado de llamadas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center text-red-600">
            <Phone className="h-5 w-5 mr-2" />
            <span>Error: {error}</span>
          </div>
          <Button onClick={handleRefresh} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!callData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold flex items-center">
            <Activity className="h-6 w-6 mr-2" />
            Monitor de Llamadas
          </h2>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Actualizado: {safeFormat(callData.last_updated, 'HH:mm:ss')}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleAutoRefresh}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-actualizar
          </Button>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Llamadas Activas</p>
                <p className="text-2xl font-bold text-green-600">{callData.stats.active_calls}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completadas Hoy</p>
                <p className="text-2xl font-bold text-blue-600">{callData.stats.completed_calls}</p>
              </div>
              <StopCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total del Día</p>
                <p className="text-2xl font-bold text-purple-600">{callData.stats.total}</p>
              </div>
              <Phone className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasa de Completado</p>
                <p className="text-2xl font-bold text-orange-600">
                  {callData.stats.total > 0 ? Math.round((callData.stats.call_ended / callData.stats.total) * 100) : 0}%
                </p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Llamadas activas */}
      {callData.active_calls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PlayCircle className="h-5 w-5 mr-2 text-green-500" />
              Llamadas Activas ({callData.active_calls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {callData.active_calls.map((call) => (
                <div key={call.id} className="border rounded-lg p-4 bg-green-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={getCallStatusColor(call.status)}>
                        <Volume2 className="h-3 w-3 mr-1" />
                        {getCallStatusText(call.status)}
                      </Badge>
                      <span className="font-mono text-sm text-gray-600">ID: {call.id}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Agente: {call.agent_name || 'N/A'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Iniciada</p>
                      <p className="font-medium">
                        {safeFormat(call.started_at, 'HH:mm:ss dd/MM')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duración</p>
                      <p className="font-medium text-green-600">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {formatDuration(call.duration || 0)}
                      </p>
                    </div>
                    <div>
                      <Progress 
                        value={Math.min(((call.duration || 0) / 1800) * 100, 100)} 
                        className="mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {(call.duration || 0) > 1800 ? 'Llamada larga' : 'En progreso'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Llamadas recientes completadas */}
      {callData.completed_calls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <StopCircle className="h-5 w-5 mr-2 text-blue-500" />
              Llamadas Completadas Recientes ({callData.completed_calls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {callData.completed_calls.slice(0, 5).map((call) => (
                <div key={call.id} className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={getCallStatusColor(call.status)}>
                        <PhoneOff className="h-3 w-3 mr-1" />
                        {getCallStatusText(call.status)}
                      </Badge>
                      <span className="font-mono text-sm text-gray-600">ID: {call.id}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Agente: {call.agent_name || 'N/A'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Iniciada</p>
                      <p className="text-sm">
                        {safeFormat(call.started_at, 'HH:mm:ss')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Finalizada</p>
                      <p className="text-sm">
                        {call.ended_at ? safeFormat(call.ended_at, 'HH:mm:ss') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duración</p>
                      <p className="font-medium text-blue-600">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {formatDuration(call.duration || 0)}
                      </p>
                    </div>
                    <div>
                      {call.transcript && (
                        <div className="flex items-center text-xs text-gray-500">
                          <FileText className="h-3 w-3 mr-1" />
                          Transcripción disponible
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensaje cuando no hay llamadas */}
      {callData.active_calls.length === 0 && callData.completed_calls.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Phone className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No hay llamadas registradas</h3>
            <p className="text-gray-500">
              Las llamadas aparecerán aquí cuando se inicien a través de ElevenLabs
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CallMonitor;
