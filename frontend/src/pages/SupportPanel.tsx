import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { 
  LifeBuoy, 
  MessageSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Users, 
  AlertTriangle,
  ArrowLeft,
  LogOut,
  BarChart3,
  Filter,
  Paperclip,
  Image,
  FileText,
  Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

export default function SupportPanel() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadTickets();
  }, [statusFilter, priorityFilter, categoryFilter]);

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
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      params.append('limit', '200');

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
        loadAttachments(ticketId);
      }
    } catch (error) {
      console.error('Error cargando ticket:', error);
    }
  };

  const loadAttachments = async (ticketId: number) => {
    try {
      const response = await api.get(`/support/tickets/${ticketId}/attachments`);
      if (response.success) {
        setAttachments(response.data || []);
      }
    } catch (error) {
      console.error('Error cargando archivos adjuntos:', error);
      setAttachments([]);
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
        message: newMessage,
        is_internal: false
      });

      if (response.success) {
        setNewMessage('');
        handleViewTicket(selectedTicket.id);
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al Sistema
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <LifeBuoy className="h-7 w-7 text-blue-600" />
                  Panel de Administración - Soporte Técnico
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gestión centralizada de tickets y solicitudes
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Estadísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Total Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Activos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(stats.abiertos || 0) + (stats.en_progreso || 0)}
                </div>
                <p className="text-xs opacity-90 mt-1">
                  {stats.abiertos || 0} abiertos · {stats.en_progreso || 0} en progreso
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Urgentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.urgentes || 0}</div>
                <p className="text-xs opacity-90 mt-1">
                  {stats.alta_prioridad || 0} de alta prioridad
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Completados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(stats.resueltos || 0) + (stats.cerrados || 0)}
                </div>
                <p className="text-xs opacity-90 mt-1">
                  {stats.resueltos || 0} resueltos · {stats.cerrados || 0} cerrados
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Técnico">Técnico</SelectItem>
                    <SelectItem value="Agendamiento">Agendamiento</SelectItem>
                    <SelectItem value="Facturación">Facturación</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
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
            <CardDescription>{tickets.length} tickets mostrados</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
                Cargando tickets...
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <LifeBuoy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay tickets con los filtros seleccionados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <Card 
                    key={ticket.id} 
                    className="hover:shadow-lg transition-all cursor-pointer border-l-4"
                    style={{
                      borderLeftColor: 
                        ticket.priority === 'Urgente' ? '#dc2626' :
                        ticket.priority === 'Alta' ? '#f97316' :
                        ticket.status === 'Reabierto' ? '#ea580c' :
                        '#3b82f6'
                    }}
                    onClick={() => handleViewTicket(ticket.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold text-blue-600">
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
                          
                          <h3 className="font-semibold text-lg">{ticket.title}</h3>
                          
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
                              {formatUTCDate(ticket.created_at, "d MMM yyyy, h:mm a")}
                            </span>
                            {ticket.assigned_to_name && (
                              <span className="font-medium text-blue-600">
                                Asignado: {ticket.assigned_to_name}
                              </span>
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-blue-600">#{selectedTicket.ticket_number}</span>
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                  <Badge variant="outline">{selectedTicket.category}</Badge>
                </DialogTitle>
                <DialogDescription className="text-lg font-semibold">
                  {selectedTicket.title}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-4">
                  {/* Mensajes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Conversación</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
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
                    </CardContent>
                  </Card>

                  {/* Archivos Adjuntos */}
                  {attachments.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          Archivos Adjuntos ({attachments.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          {attachments.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                              <div className="flex-shrink-0">
                                {file.file_type?.startsWith('image/') ? (
                                  <Image className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <FileText className="h-5 w-5 text-gray-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {file.file_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(file.file_size / 1024).toFixed(1)} KB · {file.uploaded_by_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatUTCDate(file.uploaded_at, "d MMM, h:mm a")}
                                </p>
                              </div>
                              <a
                                href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000'}${file.file_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0"
                              >
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Responder */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Responder al Usuario</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        placeholder="Escribe tu respuesta al usuario..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        rows={4}
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={!newMessage.trim()}
                        className="w-full"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Enviar Mensaje
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Gestionar Ticket</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Cambiar Estado</Label>
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
                      </div>
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
                      <CardTitle className="text-sm">Información del Ticket</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Usuario:</span>
                        <p className="font-medium">{selectedTicket.user_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium text-blue-600">{selectedTicket.user_email}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Creado:</span>
                        <p className="font-medium">
                          {formatUTCDate(selectedTicket.created_at, "d MMM yyyy, h:mm a")}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Última actualización:</span>
                        <p className="font-medium">
                          {formatUTCDate(selectedTicket.updated_at, "d MMM yyyy, h:mm a")}
                        </p>
                      </div>
                      {selectedTicket.reopened_count > 0 && (
                        <div className="pt-2 border-t">
                          <span className="text-muted-foreground">Veces reabierto:</span>
                          <p className="font-bold text-orange-600 text-lg">
                            {selectedTicket.reopened_count}
                          </p>
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
    </div>
  );
}
