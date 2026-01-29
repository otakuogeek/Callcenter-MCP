/**
 * Pagina de Auditoria - BIOSANAR IPS
 * Visualizacion de logs de auditoria inmutables del sistema.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
  Activity
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface AuditStats {
  totalLogs: number;
  todayLogs: number;
  topUsers: Array<{ user_id: number; user_name: string; count: number }>;
  actionsByType: Array<{ action_type: string; count: number }>;
  recentActivity: AuditLog[];
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

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

  const { data: statsData } = useQuery({
    queryKey: ["audit-stats"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AuditStats }>("/audit/stats?days=7");
      return response.data as AuditStats;
    },
    staleTime: 60000,
  });

  const { data: usersData } = useQuery({
    queryKey: ["audit-users"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>("/audit/users");
      return response.data;
    },
    staleTime: 120000,
  });

  const { data: entityTypesData } = useQuery({
    queryKey: ["audit-entity-types"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: string[] }>("/audit/entity-types");
      return response.data as string[];
    },
    staleTime: 120000,
  });

  const { data: actionTypesData } = useQuery({
    queryKey: ["audit-action-types"],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: string[] }>("/audit/action-types");
      return response.data as string[];
    },
    staleTime: 300000,
  });

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination || { total: 0, page: 1, limit: 25, totalPages: 0 };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy HH:mm:ss", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const parseJSON = (str: string | null) => {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
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
      const allLogs = response.data.data || [];
      const headers = ["ID","Fecha","Usuario","Email","Rol","Accion","Entidad","ID Entidad","Descripcion","IP","Metodo","Ruta"];
      const rows = allLogs.map((log: AuditLog) => [
        log.id, log.created_at, log.user_name || "", log.user_email || "",
        log.user_role || "", log.action_type, log.entity_type || "",
        log.entity_id || "", (log.description || "").replace(/,/g, ";"),
        log.ip_address || "", log.request_method || "", log.request_path || "",
      ]);
      const csvContent = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "auditoria_" + format(new Date(), "yyyy-MM-dd_HH-mm") + ".csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exportando:", error);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-medical-600" />
            Auditoria del Sistema
          </h1>
          <p className="text-gray-500 text-sm mt-1">Registro inmutable de todas las acciones del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" />Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />Exportar CSV
          </Button>
        </div>
      </div>

      {statsData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Total Registros</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{statsData.totalLogs.toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Hoy</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{statsData.todayLogs.toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Usuario mas activo</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-semibold truncate">{statsData.topUsers?.[0]?.user_name || "N/A"}</div>
              <div className="text-sm text-gray-500">{statsData.topUsers?.[0]?.count || 0} acciones</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Accion mas frecuente</CardTitle></CardHeader>
            <CardContent>
              <Badge className={actionColors[statsData.actionsByType?.[0]?.action_type] || actionColors.OTHER}>
                {statsData.actionsByType?.[0]?.action_type || "N/A"}
              </Badge>
              <div className="text-sm text-gray-500 mt-1">{statsData.actionsByType?.[0]?.count || 0} veces</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs" className="flex items-center gap-1"><ClipboardList className="w-4 h-4" />Logs</TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1"><Activity className="w-4 h-4" />Actividad Reciente</TabsTrigger>
        </TabsList>

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
                    <Input placeholder="Descripcion..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Tipo de Accion</Label>
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
                      <TableHead className="w-[120px]">Accion</TableHead>
                      <TableHead className="w-[100px]">Entidad</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead className="w-[100px]">IP</TableHead>
                      <TableHead className="w-[60px]">Ver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">Cargando...</TableCell></TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No se encontraron registros</TableCell></TableRow>
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
                          <TableCell className="text-sm max-w-[300px] truncate" title={log.description || ""}>{log.description || "-"}</TableCell>
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
              <span className="text-sm">Pagina {page} de {pagination.totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente (ultimas 20 acciones)</CardTitle>
              <CardDescription>Vista rapida de las ultimas acciones del sistema</CardDescription>
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
                      </p>
                    </div>
                  </div>
                )) || <p className="text-gray-500 text-center py-4">No hay actividad reciente</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" />Detalle de Auditoria #{selectedLog?.id}</DialogTitle>
            <DialogDescription>Informacion completa del registro</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs text-gray-500">Fecha</Label><p className="font-medium">{formatDate(selectedLog.created_at)}</p></div>
                <div><Label className="text-xs text-gray-500">Accion</Label><Badge className={actionColors[selectedLog.action_type] || actionColors.OTHER}>{selectedLog.action_type}</Badge></div>
                <div><Label className="text-xs text-gray-500">Usuario</Label><p className="font-medium">{selectedLog.user_name || "Sistema"}</p>{selectedLog.user_email && <p className="text-sm text-gray-500">{selectedLog.user_email}</p>}</div>
                <div><Label className="text-xs text-gray-500">Rol</Label><p className="font-medium">{selectedLog.user_role || "-"}</p></div>
                <div><Label className="text-xs text-gray-500">Entidad</Label><p className="font-medium">{selectedLog.entity_type || "-"}</p>{selectedLog.entity_id && <p className="text-sm text-gray-500">ID: {selectedLog.entity_id}</p>}</div>
                <div><Label className="text-xs text-gray-500">IP Address</Label><p className="font-mono text-sm">{selectedLog.ip_address || "-"}</p></div>
                <div className="col-span-2"><Label className="text-xs text-gray-500">Descripcion</Label><p className="font-medium">{selectedLog.description || "-"}</p></div>
                {selectedLog.request_path && <div className="col-span-2"><Label className="text-xs text-gray-500">Request</Label><p className="font-mono text-sm bg-gray-100 p-2 rounded">{selectedLog.request_method} {selectedLog.request_path}</p></div>}
                {selectedLog.duration_ms && <div><Label className="text-xs text-gray-500">Duracion</Label><p className="font-medium">{selectedLog.duration_ms}ms</p></div>}
                {selectedLog.response_status && <div><Label className="text-xs text-gray-500">Status</Label><Badge variant={selectedLog.response_status < 400 ? "default" : "destructive"}>{selectedLog.response_status}</Badge></div>}
              </div>
              {selectedLog.changed_fields && (
                <div><Label className="text-xs text-gray-500">Campos modificados</Label><div className="flex flex-wrap gap-1 mt-1">{parseJSON(selectedLog.changed_fields)?.map((field: string) => <Badge key={field} variant="outline" className="text-xs">{field}</Badge>)}</div></div>
              )}
              {(selectedLog.old_values || selectedLog.new_values) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.old_values && <div><Label className="text-xs text-gray-500">Valores anteriores</Label><pre className="text-xs bg-red-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(parseJSON(selectedLog.old_values), null, 2)}</pre></div>}
                  {selectedLog.new_values && <div><Label className="text-xs text-gray-500">Valores nuevos</Label><pre className="text-xs bg-green-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(parseJSON(selectedLog.new_values), null, 2)}</pre></div>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
