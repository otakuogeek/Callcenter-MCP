import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { LifeBuoy, MessageSquare, Clock, AlertCircle, CheckCircle2, XCircle, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const formatUTCDate = (utcDateString: string, formatString: string): string => {
  return formatInTimeZone(parseISO(utcDateString), 'UTC', formatString, { locale: es });
};

interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  user_name: string;
  assigned_to_name: string;
  message_count: number;
  last_message: string;
  created_at: string;
  updated_at: string;
  reopened_count: number;
}

interface Stats {
  total: number;
  abiertos: number;
  en_progreso: number;
  resueltos: number;
  cerrados: number;
  reabiertos: number;
  urgentes: number;
  alta_prioridad: number;
}

export default function SupportAdmin() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    loadStats();
    loadTickets();
  }, [statusFilter, priorityFilter]);

  const loadStats = async () => {
    try {
      const response = await api.get('/support/stats');
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      params.append('limit', '100');

      const response = await api.get(`/support/tickets?${params}`);
      if (response.success) {
        setTickets(response.data || []);
      }
    } catch (error) {
      console.error('Error cargando tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTicket = async (ticketId: number) => {
    try {
      const response = await api.get(`/support/tickets/${ticketId}`);
      if (response.success) {
        setSelectedTicket(response.data.ticket);
        setMessages(response.data.messages || []);
        setNewStatus(response.data.ticket.status);
        setShowDetail(true);
      }
    } catch (error) {
      console.error('Error cargando ticket:', error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedTicket || !newStatus) return;

    try {
      const response = await api.patch(`/support/tickets/${selectedTicket.id}/status`, {
        status: newStatus
      });

      if (response.success) {
        alert('Estado actualizado');
        loadTickets();
        loadStats();
        handleViewTicket(selectedTicket.id);
      }
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      const response = await api.post(`/support/tickets/${selectedTicket.id}/messages`, {
        message: newMessage
      });

      if (response.success) {
        setNewMessage('');
        handleViewTicket(selectedTicket.id);
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      'Abierto': { variant: 'default', icon: AlertCircle, color: 'bg-blue-500' },
      'En Progreso': { variant: 'secondary', icon: Clock, color: 'bg-yellow-500' },
      'Resuelto': { variant: 'outline', icon: CheckCircle2, color: 'bg-green-500' },
      'Cerrado': { variant: 'outline', icon: XCircle, color: 'bg-gray-500' },
      'Reabierto': { variant: 'destructive', icon: AlertCircle, color: 'bg-orange-500' }
    };
    const config = variants[status] || variants['Abierto'];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      'Urgente': 'bg-red-600',
      'Alta': 'bg-orange-500',
      'Normal': 'bg-blue-500',
      'Baja': 'bg-gray-500'
    };
    return <Badge className={colors[priority] || colors.Normal}>{priority}</Badge>;
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full p-6">
        <SidebarTrigger className="mb-4" />

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <LifeBuoy className="h-8 w-8" />
              Dashboard de Soporte
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestión y administración de tickets de soporte
            </p>
          </div>

          {/* Estadísticas */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Abiertos / En Progreso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.abiertos + stats.en_progreso}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Urgentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.urgentes}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Resueltos / Cerrados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.resueltos + stats.cerrados}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Abierto">Abierto</SelectItem>
                      <SelectItem value="En Progreso">En Progreso</SelectItem>
                      <SelectItem value="Resuelto">Resuelto</SelectItem>
                      <SelectItem value="Cerrado">Cerrado</SelectItem>
                      <SelectItem value="Reabierto">Reabierto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Tickets */}
          <Card>
            <CardHeader>
              <CardTitle>Tickets de Soporte</CardTitle>
              <CardDescription>{tickets.length} tickets</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Cargando...</div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay tickets con los filtros seleccionados
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleViewTicket(ticket.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm text-muted-foreground">
                                #{ticket.ticket_number}
                              </span>
                              {getStatusBadge(ticket.status)}
                              {getPriorityBadge(ticket.priority)}
                              <Badge variant="outline">{ticket.category}</Badge>
                              {ticket.reopened_count > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  Reabierto {ticket.reopened_count}x
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold">{ticket.title}</h3>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {ticket.user_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {ticket.message_count} mensajes
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatUTCDate(ticket.created_at, "d 'de' MMM, yyyy")}
                              </span>
                              {ticket.assigned_to_name && (
                                <span>Asignado: {ticket.assigned_to_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modal Detalle */}
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono">#{selectedTicket.ticket_number}</span>
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                    <Badge variant="outline">{selectedTicket.category}</Badge>
                  </DialogTitle>
                  <DialogDescription>{selectedTicket.title}</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-4">
                    {/* Mensajes */}
                    <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.user_role === 'admin' || msg.user_role === 'superadmin' ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex-1 space-y-1 ${msg.user_role === 'admin' || msg.user_role === 'superadmin' ? 'text-right' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{msg.user_name}</span>
                              <Badge variant="outline" className="text-xs">{msg.user_role}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatUTCDate(msg.created_at, "d MMM, h:mm a")}
                              </span>
                            </div>
                            <div className={`inline-block p-3 rounded-lg ${
                              msg.user_role === 'admin' || msg.user_role === 'superadmin'
                                ? 'bg-blue-100 dark:bg-blue-900'
                                : 'bg-gray-100 dark:bg-gray-800'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Responder */}
                    <div className="space-y-2">
                      <Label>Responder</Label>
                      <Textarea
                        placeholder="Escribe tu respuesta..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        rows={3}
                      />
                      <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                        Enviar Mensaje
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Cambiar Estado</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Select value={newStatus} onValueChange={setNewStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Abierto">Abierto</SelectItem>
                            <SelectItem value="En Progreso">En Progreso</SelectItem>
                            <SelectItem value="Resuelto">Resuelto</SelectItem>
                            <SelectItem value="Cerrado">Cerrado</SelectItem>
                            <SelectItem value="Reabierto">Reabierto</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          className="w-full" 
                          onClick={handleUpdateStatus}
                          disabled={newStatus === selectedTicket.status}
                        >
                          Actualizar Estado
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Información</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Usuario:</span>
                          <p className="font-medium">{selectedTicket.user_name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <p className="font-medium">{selectedTicket.user_email}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Creado:</span>
                          <p className="font-medium">
                            {formatUTCDate(selectedTicket.created_at, "d MMM yyyy, h:mm a")}
                          </p>
                        </div>
                        {selectedTicket.reopened_count > 0 && (
                          <div>
                            <span className="text-muted-foreground">Veces reabierto:</span>
                            <p className="font-medium text-orange-600">{selectedTicket.reopened_count}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </SidebarProvider>
  );
}
