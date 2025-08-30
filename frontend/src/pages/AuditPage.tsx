import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  User,
  FileText,
  Filter,
  Download,
  Search,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_id: string;
  user_name?: string;
  ip_address: string;
  user_agent: string;
  details: any;
  created_at: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

const severityColors = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  critical: 'bg-purple-100 text-purple-800'
};

const severityIcons = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  critical: AlertTriangle
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    user_id: '',
    severity: '',
    start_date: '',
    end_date: '',
    search: ''
  });
  const { toast } = useToast();

  // Cargar logs de auditoría
  useEffect(() => {
    loadAuditLogs();
  }, [filters]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.audit.getLogs(params.toString());
      setLogs(response);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros de auditoría",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.audit.exportLogs(params.toString());
      
      // Crear y descargar archivo
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Éxito",
        description: "Registros de auditoría exportados correctamente"
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: "Error",
        description: "No se pudieron exportar los registros",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSeverityIcon = (severity: string) => {
    const IconComponent = severityIcons[severity as keyof typeof severityIcons] || Info;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-medical-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-medical-900">Auditoría del Sistema</h1>
            <p className="text-medical-600">Registro de todas las actividades del sistema</p>
          </div>
          <Button onClick={exportLogs} className="bg-medical-600 hover:bg-medical-700">
            <Download className="w-4 h-4 mr-2" />
            Exportar Logs
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Búsqueda</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar en logs..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Acción</label>
                <Select value={filters.action} onValueChange={(value) => setFilters({ ...filters, action: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las acciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas las acciones</SelectItem>
                    <SelectItem value="create">Crear</SelectItem>
                    <SelectItem value="read">Leer</SelectItem>
                    <SelectItem value="update">Actualizar</SelectItem>
                    <SelectItem value="delete">Eliminar</SelectItem>
                    <SelectItem value="login">Inicio de sesión</SelectItem>
                    <SelectItem value="logout">Cerrar sesión</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Tipo de Recurso</label>
                <Select value={filters.resource_type} onValueChange={(value) => setFilters({ ...filters, resource_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los recursos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los recursos</SelectItem>
                    <SelectItem value="patient">Paciente</SelectItem>
                    <SelectItem value="appointment">Cita</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Severidad</label>
                <Select value={filters.severity} onValueChange={(value) => setFilters({ ...filters, severity: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las severidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium">Fecha Inicio</label>
                <Input
                  type="datetime-local"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Fecha Fin</label>
                <Input
                  type="datetime-local"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Auditoría</CardTitle>
            <CardDescription>
              {logs.length} registro{logs.length !== 1 ? 's' : ''} encontrado{logs.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-600"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron registros de auditoría
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={severityColors[log.severity]}>
                            {getSeverityIcon(log.severity)}
                            <span className="ml-1 capitalize">{log.severity}</span>
                          </Badge>
                          <div>
                            <h4 className="font-medium">{log.action}</h4>
                            <p className="text-sm text-gray-600">
                              {log.resource_type} - {log.resource_id}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(log.created_at)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Usuario:</span>
                          <div className="flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" />
                            {log.user_name || log.user_id}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">IP:</span>
                          <div className="mt-1">{log.ip_address}</div>
                        </div>
                        <div>
                          <span className="font-medium">User Agent:</span>
                          <div className="mt-1 truncate">{log.user_agent}</div>
                        </div>
                      </div>

                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-3">
                          <span className="text-sm font-medium">Detalles:</span>
                          <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
