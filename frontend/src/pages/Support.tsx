import { useState, useEffect, useRef } from 'react';
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
import { LifeBuoy, Plus, MessageSquare, Clock, AlertCircle, CheckCircle2, XCircle, Paperclip, Upload, Image, FileText, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Función helper para mostrar fechas en UTC-0
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
  assigned_to_name: string;
  message_count: number;
  last_message: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  last_viewed_at?: string;
  last_viewed_by_name?: string;
}

interface Message {
  id: number;
  ticket_id: number;
  user_name: string;
  user_role: string;
  message: string;
  is_internal: number;
  created_at: string;
}

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showTicketDetail, setShowTicketDetail] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Formulario nuevo ticket
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Otro');
  const [priority, setPriority] = useState('Normal');
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);
  const newTicketFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/support/tickets?limit=100');
      if (response.success) {
        setTickets(response.data || []);
      }
    } catch (error) {
      console.error('Error cargando tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      if (!title || !description) {
        alert('Por favor complete todos los campos');
        return;
      }

      const response = await api.post('/support/tickets', {
        title,
        description,
        category,
        priority
      });

      if (response.success) {
        const ticketId = response.data.id;
        
        // Si hay archivos adjuntos, subirlos
        if (newTicketFiles.length > 0) {
          const formData = new FormData();
          newTicketFiles.forEach(file => {
            formData.append('files', file);
          });

          const token = localStorage.getItem('token');
          await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/support/tickets/${ticketId}/attachments`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            }
          );
        }

        alert('Ticket creado exitosamente' + (newTicketFiles.length > 0 ? ` con ${newTicketFiles.length} archivo(s) adjunto(s)` : ''));
        setShowNewTicket(false);
        setTitle('');
        setDescription('');
        setCategory('Otro');
        setPriority('Normal');
        setNewTicketFiles([]);
        if (newTicketFileInputRef.current) {
          newTicketFileInputRef.current.value = '';
        }
        loadTickets();
      }
    } catch (error) {
      console.error('Error creando ticket:', error);
      alert('Error al crear ticket');
    }
  };

  const handleNewTicketFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} es demasiado grande. Máximo 10MB por archivo.`);
          return false;
        }
        return true;
      });
      setNewTicketFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleRemoveNewTicketFile = (index: number) => {
    setNewTicketFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleViewTicket = async (ticketId: number) => {
    try {
      const response = await api.get(`/support/tickets/${ticketId}`);
      if (response.success) {
        setSelectedTicket(response.data.ticket);
        setMessages(response.data.messages || []);
        setShowTicketDetail(true);
        // Cargar archivos adjuntos
        loadAttachments(ticketId);
        
        // Actualización optimista: limpiar contador de este ticket localmente
        setTickets(prev => prev.map(t => 
          t.id === ticketId ? { ...t, unread_count: 0 } : t
        ));
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
      console.error('Error cargando archivos:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      // Validar tamaño (máximo 10MB por archivo)
      const validFiles = fileArray.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} es demasiado grande. Máximo 10MB por archivo.`);
          return false;
        }
        return true;
      });
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async () => {
    if (!selectedTicket || selectedFiles.length === 0) return;

    try {
      setUploading(true);
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/support/tickets/${selectedTicket.id}/attachments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      const data = await response.json();

      if (data.success) {
        alert(`${selectedFiles.length} archivo(s) subido(s) correctamente`);
        setSelectedFiles([]);
        loadAttachments(selectedTicket.id);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        alert(data.message || 'Error al subir archivos');
      }
    } catch (error) {
      console.error('Error subiendo archivos:', error);
      alert('Error al subir archivos');
    } finally {
      setUploading(false);
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
        // Recargar mensajes
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <LifeBuoy className="h-8 w-8" />
                Soporte Técnico
              </h1>
              <p className="text-muted-foreground mt-1">
                Centro de ayuda y tickets de soporte
              </p>
            </div>
            <Button onClick={() => setShowNewTicket(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Ticket
            </Button>
          </div>

          {/* Lista de Tickets */}
          <Card>
            <CardHeader>
              <CardTitle>Mis Tickets</CardTitle>
              <CardDescription>
                {tickets.length} tickets en total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tienes tickets aún. Crea uno para obtener soporte.
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer relative"
                          onClick={() => handleViewTicket(ticket.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-muted-foreground">
                                #{ticket.ticket_number}
                              </span>
                              {getStatusBadge(ticket.status)}
                              {getPriorityBadge(ticket.priority)}
                              <Badge variant="outline">{ticket.category}</Badge>
                              {ticket.unread_count && ticket.unread_count > 0 && (
                                <Badge className="bg-red-500 hover:bg-red-600 text-white">
                                  {ticket.unread_count} nuevo{ticket.unread_count > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-lg">{ticket.title}</h3>
                            {ticket.last_message && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {ticket.last_message}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {ticket.message_count} mensajes
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatUTCDate(ticket.created_at, "d 'de' MMMM, yyyy")}
                              </span>
                              {ticket.assigned_to_name && (
                                <span>Asignado a: {ticket.assigned_to_name}</span>
                              )}
                            </div>
                          </div>
                          {ticket.unread_count && ticket.unread_count > 0 && (
                            <div className="flex-shrink-0 ml-4">
                              <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm animate-pulse">
                                {ticket.unread_count}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modal Nuevo Ticket */}
        <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Ticket de Soporte</DialogTitle>
              <DialogDescription>
                Describe tu problema o solicitud y te ayudaremos lo antes posible
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  placeholder="Resumen breve del problema"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Técnico">Técnico</SelectItem>
                      <SelectItem value="Agendamiento">Agendamiento</SelectItem>
                      <SelectItem value="Facturación">Facturación</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baja">Baja</SelectItem>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descripción *</Label>
                <Textarea
                  placeholder="Describe el problema con el mayor detalle posible..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                />
              </div>

              {/* Sección de archivos adjuntos */}
              <div className="border-t pt-4">
                <Label className="flex items-center gap-2 mb-3">
                  <Paperclip className="h-4 w-4" />
                  Archivos Adjuntos (Opcional)
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Puedes adjuntar imágenes o documentos para evidenciar el problema (máx. 10MB por archivo)
                </p>
                <input
                  ref={newTicketFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleNewTicketFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => newTicketFileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar archivos
                </Button>

                {newTicketFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium">
                      {newTicketFiles.length} archivo(s) seleccionado(s):
                    </p>
                    {newTicketFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {file.type.startsWith('image/') ? (
                            <Image className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          )}
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveNewTicketFile(index)}
                          className="flex-shrink-0"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowNewTicket(false);
                setTitle('');
                setDescription('');
                setCategory('Otro');
                setPriority('Normal');
                setNewTicketFiles([]);
                if (newTicketFileInputRef.current) {
                  newTicketFileInputRef.current.value = '';
                }
              }}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTicket}>
                Crear Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Detalle Ticket */}
        <Dialog open={showTicketDetail} onOpenChange={async (open) => {
          if (!open && selectedTicket) {
            // Marcar como leído antes de cerrar
            try {
              await api.patch(`/support/tickets/${selectedTicket.id}/mark-read`);
            } catch (error) {
              console.error('Error marking ticket as read:', error);
            }
            // Recargar tickets para actualizar contadores
            await loadTickets();
          }
          setShowTicketDetail(open);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="font-mono">#{selectedTicket.ticket_number}</span>
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                  </DialogTitle>
                  <DialogDescription>
                    <div>{selectedTicket.title}</div>
                    {selectedTicket.last_viewed_at && selectedTicket.last_viewed_by_name && (
                      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          Última visualización: {formatUTCDate(selectedTicket.last_viewed_at, "d MMM yyyy, h:mm a")} 
                          {' por '}<span className="font-semibold">{selectedTicket.last_viewed_by_name}</span>
                        </span>
                      </div>
                    )}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Mensajes */}
                  <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.user_role === 'admin' || msg.user_role === 'superadmin' ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-1 space-y-1 ${msg.user_role === 'admin' || msg.user_role === 'superadmin' ? 'text-right' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{msg.user_name}</span>
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
                  {selectedTicket.status !== 'Cerrado' && (
                    <div className="space-y-3">
                      <Label>Responder</Label>
                      <Textarea
                        placeholder="Escribe tu mensaje..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        rows={3}
                      />
                      
                      {/* Sección de Archivos Adjuntos */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            Archivos Adjuntos (Evidencia)
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Seleccionar Archivos
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </div>

                        {/* Archivos seleccionados para subir */}
                        {selectedFiles.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Archivos seleccionados ({selectedFiles.length}):
                            </p>
                            <div className="space-y-1">
                              {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    {file.type.startsWith('image/') ? (
                                      <Image className="h-4 w-4 text-blue-500" />
                                    ) : (
                                      <FileText className="h-4 w-4 text-gray-500" />
                                    )}
                                    <span className="text-sm">{file.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({(file.size / 1024).toFixed(1)} KB)
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveFile(index)}
                                  >
                                    ✕
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <Button
                              type="button"
                              onClick={handleUploadFiles}
                              disabled={uploading}
                              size="sm"
                              className="w-full"
                            >
                              {uploading ? 'Subiendo...' : `Subir ${selectedFiles.length} archivo(s)`}
                            </Button>
                          </div>
                        )}

                        {/* Archivos ya subidos */}
                        {attachments.length > 0 && (
                          <div className="space-y-2 border-t pt-3">
                            <p className="text-sm font-medium">Archivos adjuntos ({attachments.length}):</p>
                            <div className="space-y-1">
                              {attachments.map((att: any) => (
                                <div key={att.id} className="flex items-center gap-2 bg-blue-50 p-2 rounded">
                                  {att.file_type?.startsWith('image/') ? (
                                    <Image className="h-4 w-4 text-blue-500" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-gray-500" />
                                  )}
                                  <span className="text-sm flex-1 min-w-0 truncate">{att.file_name}</span>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">
                                    {(att.file_size / 1024).toFixed(1)} KB
                                  </span>
                                  <a
                                    href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000'}${att.file_path}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0"
                                    title="Descargar archivo"
                                  >
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Enviar Mensaje
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </SidebarProvider>
  );
}
