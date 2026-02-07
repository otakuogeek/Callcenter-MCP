/**
 * Pagina de Auditoria Mejorada - BIOSANAR IPS
 * - Visualizacion de logs de auditoria inmutables
 * - Usuarios en linea
 * - Gestion de sesiones
 * - Historial de cambios de campos
 * - Auto-logout por inactividad (5 min)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Download, 
  User, 
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  Users,
  Power,
  LogOut,
  AlertTriangle,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  FileText
} from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-purple-100 text-purple-800",
  LOGOUT: "bg-gray-100 text-gray-800",
  LOGIN_FAILED: "bg-orange-100 text-orange-800",
  SMS_SENT: "bg-cyan-100 text-cyan-800",
  EMAIL_SENT: "bg-teal-100 text-teal-800",
  APPOINTMENT_SCHEDULED: "bg-emerald-100 text-emerald-800",
  APPOINTMENT_CANCELLED: "bg-rose-100 text-rose-800",
  PASSWORD_CHANGE: "bg-amber-100 text-amber-800",
  OTHER: "bg-slate-100 text-slate-800",
};

interface AuditLog {
  id: number;
  created_at: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  description: string | null;
  ip_address: string | null;
  request_method: string | null;
  request_path: string | null;
  response_status: number | null;
  duration_ms: number | null;
  old_values: string | null;
  new_values: string | null;
  changed_fields: string | null;
  metadata: string | null;
}

interface OnlineUser {
  user_id: number;
  user_name: string;
  user_email: string;
  role: string;
  ip_address: string;
  last_activity: string;
  session_started: string;
  minutes_inactive: number;
  is_online: boolean;
  status: 'online' | 'idle' | 'away';
}

interface AuditStats {
  totalLogs: number;
  todayLogs: number;
  topUsers: Array<{ user_id: number; user_name: string; count: number }>;
  actionsByType: Array<{ action_type: string; count: number }>;
  recentActivity: AuditLog[];
}

export default function AuditPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showLogoutAllDialog, setShowLogoutAllDialog] = useState(false);
  const [userToLogout, setUserToLogout] = useState<OnlineUser | null>(null);

  // Query de logs
  const { data: logsData, isLoading: logsLoading, refetch } = useQuery({
    queryKey: ["audit-logs", page, limit, search, actionType, entityType, userId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.append("search", search);
      if (actionType && actionType !== "all") params.append("actionType", actionType);
      if (entityType && entityType !== "all") params.append("entityType", entityType);
      if (userId && userId !== "all") params.append("userId", userId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const response = await api.get<{ success: boolean; data: AuditLog[]; pagination: any }>("/audit/logs?" + params.toString());
      return response;
    },
    staleTime: 30000,
  });

  // Query de estadisticas
  const { data: statsData } = useQuery({
    queryKey: ["audit-stats"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AuditStats }>("/audit/stats?days=7");
      return response.data as AuditStats;
    },
    staleTime: 60000,
  });

  // Query de usuarios con actividad
  const { data: usersData } = useQuery({
    queryKey: ["audit-users"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>("/audit/users");
      return response.data;
    },
    staleTime: 120000,
  });

  // Query de usuarios en linea (actualiza cada 30 segundos)
  const { data: onlineUsersData, refetch: refetchOnlineUsers } = useQuery({
    queryKey: ["online-users"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { users: OnlineUser[]; total_online: number; total_sessions: number } }>("/audit/online-users");
      return response.data;
    },
    refetchInterval: 30000,
  });

  // Query de tipos de entidad
  const { data: entityTypesData } = useQuery({
    queryKey: ["audit-entity-types"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: string[] }>("/audit/entity-types");
      return response.data as string[];
    },
    staleTime: 120000,
  });

  // Query de tipos de accion
  const { data: actionTypesData } = useQuery({
    queryKey: ["audit-action-types"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: string[] }>("/audit/action-types");
      return response.data as string[];
    },
    staleTime: 300000,
  });

  // Mutation para cerrar todas las sesiones
  const logoutAllMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/audit/logout-all", {});
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sesiones cerradas",
        description: data.message || `Se cerraron ${data.sessions_closed} sesiones`,
      });
      queryClient.invalidateQueries({ queryKey: ["online-users"] });
      setShowLogoutAllDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron cerrar las sesiones",
        variant: "destructive",
      });
    },
  });

  // Mutation para cerrar sesion de un usuario
  const logoutUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await api.post(`/audit/logout-user/${userId}`, {});
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sesión cerrada",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["online-users"] });
      setUserToLogout(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cerrar la sesión",
        variant: "destructive",
      });
    },
  });

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination || { total: 0, page: 1, limit: 25, totalPages: 0 };
  const onlineUsers = onlineUsersData?.users || [];
  const totalOnline = onlineUsersData?.total_online || 0;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy HH:mm:ss", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch {
      return dateStr;
    }
  };

  const parseJSON = (str: string | null) => {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Wifi className="w-4 h-4 text-green-500" />;
      case 'idle': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'away': return <WifiOff className="w-4 h-4 text-gray-400" />;
      default: return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online': return <Badge className="bg-green-100 text-green-800">En línea</Badge>;
      case 'idle': return <Badge className="bg-yellow-100 text-yellow-800">Inactivo</Badge>;
      case 'away': return <Badge className="bg-gray-100 text-gray-800">Ausente</Badge>;
      default: return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ limit: "10000" });
      if (search) params.append("search", search);
      if (actionType && actionType !== "all") params.append("actionType", actionType);
      if (entityType && entityType !== "all") params.append("entityType", entityType);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const response = await api.get("/audit/logs?" + params.toString());
      const allLogs = response.data || [];
      const headers = ["ID","Fecha","Usuario","Email","Rol","Accion","Entidad","ID Entidad","Descripcion","IP","Metodo","Ruta","Campos Modificados"];
      const rows = allLogs.map((log: AuditLog) => [
        log.id, log.created_at, log.user_name || "", log.user_email || "",
        log.user_role || "", log.action_type, log.entity_type || "",
        log.entity_id || "", (log.description || "").replace(/,/g, ";"),
        log.ip_address || "", log.request_method || "", log.request_path || "",
        log.changed_fields || ""
      ]);
      const csvContent = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "auditoria_" + format(new Date(), "yyyy-MM-dd_HH-mm") + ".csv";
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exportado", description: `Se exportaron ${allLogs.length} registros` });
    } catch (error) {
      console.error("Error exportando:", error);
      toast({ title: "Error", description: "Error al exportar", variant: "destructive" });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-medical-600" />
            Auditoría del Sistema
          </h1>
          <p className="text-gray-500 text-sm mt-1">Registro inmutable de acciones, usuarios en línea y gestión de sesiones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchOnlineUsers(); }}>
            <RefreshCw className="w-4 h-4 mr-1" />Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />Exportar CSV
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setShowLogoutAllDialog(true)}
          >
            <Power className="w-4 h-4 mr-1" />Cerrar Todas las Sesiones
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              Usuarios En Línea
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{totalOnline}</div>
            <p className="text-xs text-green-600 mt-1">de {onlineUsers.length} sesiones activas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Total Registros</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{statsData?.totalLogs?.toLocaleString() || 0}</div></CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Hoy</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{statsData?.todayLogs?.toLocaleString() || 0}</div></CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Usuario Más Activo</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-semibold truncate">{statsData?.topUsers?.[0]?.user_name || "N/A"}</div>
            <div className="text-sm text-gray-500">{statsData?.topUsers?.[0]?.count || 0} acciones</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Acción Más Frecuente</CardTitle></CardHeader>
          <CardContent>
            <Badge className={actionColors[statsData?.actionsByType?.[0]?.action_type || ''] || actionColors.OTHER}>
              {statsData?.actionsByType?.[0]?.action_type || "N/A"}
            </Badge>
            <div className="text-sm text-gray-500 mt-1">{statsData?.actionsByType?.[0]?.count || 0} veces</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="online" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="online" className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            En Línea ({totalOnline})
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1">
            <ClipboardList className="w-4 h-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="changes" className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Cambios
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1">
            <Activity className="w-4 h-4" />
            Reciente
          </TabsTrigger>
        </TabsList>

        {/* Tab: Usuarios en Linea */}
        <TabsContent value="online" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Usuarios Conectados
              </CardTitle>
              <CardDescription>
                Monitoreo en tiempo real de usuarios activos. La sesión expira automáticamente después de 5 minutos de inactividad.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {onlineUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <WifiOff className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay usuarios conectados actualmente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {onlineUsers.map((user) => (
                    <div 
                      key={`${user.user_id}-${user.session_started}`} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        user.is_online ? 'bg-green-50 border-green-200' : 
                        user.status === 'idle' ? 'bg-yellow-50 border-yellow-200' : 
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(user.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.user_name}</span>
                            {getStatusBadge(user.status)}
                            <Badge variant="outline">{user.role}</Badge>
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                            <span>{user.user_email}</span>
                            <span className="font-mono text-xs">{user.ip_address}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Sesión iniciada: {formatRelativeTime(user.session_started)} • 
                            Última actividad: {formatRelativeTime(user.last_activity)}
                            {user.minutes_inactive > 0 && ` (${user.minutes_inactive} min inactivo)`}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setUserToLogout(user)}
                      >
                        <LogOut className="w-4 h-4 mr-1" />
                        Cerrar Sesión
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4" />Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <div>
                  <Label className="text-xs">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Descripción..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Tipo de Acción</Label>
                  <Select value={actionType} onValueChange={(v) => { setActionType(v); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {actionTypesData?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo de Entidad</Label>
                  <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {entityTypesData?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Usuario</Label>
                  <Select value={userId} onValueChange={(v) => { setUserId(v); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {usersData?.map((u: any) => <SelectItem key={u.user_id} value={String(u.user_id)}>{u.user_name || u.user_email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="h-9" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Fecha</TableHead>
                      <TableHead className="w-[120px]">Usuario</TableHead>
                      <TableHead className="w-[120px]">Acción</TableHead>
                      <TableHead className="w-[100px]">Entidad</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-[120px]">Campos</TableHead>
                      <TableHead className="w-[100px]">IP</TableHead>
                      <TableHead className="w-[60px]">Ver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">Cargando...</TableCell></TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">No se encontraron registros</TableCell></TableRow>
                    ) : (
                      logs.map((log: AuditLog) => (
                        <TableRow key={log.id} className="hover:bg-gray-50">
                          <TableCell className="text-xs text-gray-600 whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-400" />
                              <span className="text-sm truncate max-w-[100px]" title={log.user_email || ""}>{log.user_name || log.user_email || "Sistema"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={"text-xs " + (actionColors[log.action_type] || actionColors.OTHER)}>{log.action_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">{log.entity_type || "-"}</TableCell>
                          <TableCell className="text-sm max-w-[250px] truncate" title={log.description || ""}>{log.description || "-"}</TableCell>
                          <TableCell>
                            {log.changed_fields && (
                              <div className="flex flex-wrap gap-1">
                                {parseJSON(log.changed_fields)?.slice(0, 2).map((field: string) => (
                                  <Badge key={field} variant="outline" className="text-xs">{field}</Badge>
                                ))}
                                {parseJSON(log.changed_fields)?.length > 2 && (
                                  <Badge variant="outline" className="text-xs">+{parseJSON(log.changed_fields).length - 2}</Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 font-mono">{log.ip_address || "-"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="h-7 w-7 p-0"><Eye className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, pagination.total)} de {pagination.total} registros
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm">Página {page} de {pagination.totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Cambios de campos */}
        <TabsContent value="changes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Historial de Modificaciones
              </CardTitle>
              <CardDescription>
                Registros de cambios en campos específicos con valores antes y después
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs.filter(log => log.changed_fields && log.action_type === 'UPDATE').slice(0, 10).map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className={actionColors.UPDATE}>UPDATE</Badge>
                        <span className="font-medium">{log.entity_type}</span>
                        {log.entity_id && <Badge variant="outline">#{log.entity_id}</Badge>}
                      </div>
                      <div className="text-sm text-gray-500">
                        {log.user_name} • {formatRelativeTime(log.created_at)}
                      </div>
                    </div>
                    
                    {log.changed_fields && (
                      <div className="mb-3">
                        <span className="text-xs text-gray-500">Campos modificados: </span>
                        {parseJSON(log.changed_fields)?.map((field: string) => (
                          <Badge key={field} variant="outline" className="text-xs mr-1">{field}</Badge>
                        ))}
                      </div>
                    )}
                    
                    {(log.old_values || log.new_values) && (
                      <div className="grid grid-cols-2 gap-4">
                        {log.old_values && (
                          <div>
                            <Label className="text-xs text-red-600">Valor Anterior</Label>
                            <pre className="text-xs bg-red-50 p-2 rounded mt-1 overflow-auto max-h-32 border border-red-200">
                              {JSON.stringify(parseJSON(log.old_values), null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_values && (
                          <div>
                            <Label className="text-xs text-green-600">Valor Nuevo</Label>
                            <pre className="text-xs bg-green-50 p-2 rounded mt-1 overflow-auto max-h-32 border border-green-200">
                              {JSON.stringify(parseJSON(log.new_values), null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {logs.filter(log => log.changed_fields && log.action_type === 'UPDATE').length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay modificaciones recientes con detalle de campos</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Actividad Reciente */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente (últimas 20 acciones)</CardTitle>
              <CardDescription>Vista rápida de las últimas acciones del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statsData?.recentActivity?.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => setSelectedLog(log)}>
                    <div className="flex-shrink-0 mt-1">
                      <Badge className={"text-xs " + (actionColors[log.action_type] || actionColors.OTHER)}>{log.action_type}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.description}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                        <User className="w-3 h-3" />{log.user_name || "Sistema"}
                        <span className="mx-1">|</span>
                        <Calendar className="w-3 h-3" />{formatDate(log.created_at)}
                        {log.changed_fields && (
                          <>
                            <span className="mx-1">|</span>
                            <span className="text-blue-600">{parseJSON(log.changed_fields)?.length || 0} campos</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )) || <p className="text-gray-500 text-center py-4">No hay actividad reciente</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal detalle log */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" />Detalle de Auditoría #{selectedLog?.id}</DialogTitle>
            <DialogDescription>Información completa del registro</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs text-gray-500">Fecha</Label><p className="font-medium">{formatDate(selectedLog.created_at)}</p></div>
                <div><Label className="text-xs text-gray-500">Acción</Label><Badge className={actionColors[selectedLog.action_type] || actionColors.OTHER}>{selectedLog.action_type}</Badge></div>
                <div><Label className="text-xs text-gray-500">Usuario</Label><p className="font-medium">{selectedLog.user_name || "Sistema"}</p>{selectedLog.user_email && <p className="text-sm text-gray-500">{selectedLog.user_email}</p>}</div>
                <div><Label className="text-xs text-gray-500">Rol</Label><p className="font-medium">{selectedLog.user_role || "-"}</p></div>
                <div><Label className="text-xs text-gray-500">Entidad</Label><p className="font-medium">{selectedLog.entity_type || "-"}</p>{selectedLog.entity_id && <p className="text-sm text-gray-500">ID: {selectedLog.entity_id}</p>}</div>
                <div><Label className="text-xs text-gray-500">IP Address</Label><p className="font-mono text-sm">{selectedLog.ip_address || "-"}</p></div>
                <div className="col-span-2"><Label className="text-xs text-gray-500">Descripción</Label><p className="font-medium">{selectedLog.description || "-"}</p></div>
                {selectedLog.request_path && <div className="col-span-2"><Label className="text-xs text-gray-500">Request</Label><p className="font-mono text-sm bg-gray-100 p-2 rounded">{selectedLog.request_method} {selectedLog.request_path}</p></div>}
                {selectedLog.duration_ms && <div><Label className="text-xs text-gray-500">Duración</Label><p className="font-medium">{selectedLog.duration_ms}ms</p></div>}
                {selectedLog.response_status && <div><Label className="text-xs text-gray-500">Status</Label><Badge variant={selectedLog.response_status < 400 ? "default" : "destructive"}>{selectedLog.response_status}</Badge></div>}
              </div>
              {selectedLog.changed_fields && (
                <div><Label className="text-xs text-gray-500">Campos modificados</Label><div className="flex flex-wrap gap-1 mt-1">{parseJSON(selectedLog.changed_fields)?.map((field: string) => <Badge key={field} variant="outline" className="text-xs">{field}</Badge>)}</div></div>
              )}
              {(selectedLog.old_values || selectedLog.new_values) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.old_values && <div><Label className="text-xs text-gray-500">Valores anteriores</Label><pre className="text-xs bg-red-50 p-2 rounded overflow-auto max-h-40 border border-red-200">{JSON.stringify(parseJSON(selectedLog.old_values), null, 2)}</pre></div>}
                  {selectedLog.new_values && <div><Label className="text-xs text-gray-500">Valores nuevos</Label><pre className="text-xs bg-green-50 p-2 rounded overflow-auto max-h-40 border border-green-200">{JSON.stringify(parseJSON(selectedLog.new_values), null, 2)}</pre></div>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo confirmar cerrar todas las sesiones */}
      <AlertDialog open={showLogoutAllDialog} onOpenChange={setShowLogoutAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Cerrar Todas las Sesiones
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cerrará la sesión de TODOS los usuarios conectados, incluyendo la suya.
              Todos deberán volver a iniciar sesión.
              <br /><br />
              <strong>Actualmente hay {totalOnline} usuarios en línea.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => logoutAllMutation.mutate()}
              disabled={logoutAllMutation.isPending}
            >
              {logoutAllMutation.isPending ? "Cerrando..." : "Cerrar Todas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo confirmar cerrar sesión de usuario */}
      <AlertDialog open={!!userToLogout} onOpenChange={() => setUserToLogout(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-orange-500" />
              Cerrar Sesión de Usuario
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea cerrar la sesión de <strong>{userToLogout?.user_name}</strong>?
              <br />
              El usuario deberá volver a iniciar sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => userToLogout && logoutUserMutation.mutate(userToLogout.user_id)}
              disabled={logoutUserMutation.isPending}
            >
              {logoutUserMutation.isPending ? "Cerrando..." : "Cerrar Sesión"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
