import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Search, Calendar, Clock, Filter, RefreshCw, CheckCircle, XCircle, FileText, AlertCircle, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const Consultations = () => {
  const [consultations, setConsultations] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [conversationDetails, setConversationDetails] = useState<any>(null);

  const loadConsultations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getElevenLabsConsultations({ page_size: 50 });
      setConsultations(response);
    } catch (err: any) {
      console.error('Error cargando consultas:', err);
      setError(err.message || 'Error al cargar las consultas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsultations();
    const interval = setInterval(loadConsultations, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleViewDetails = async (conversation: any) => {
    setSelectedConversation(conversation);
    setIsModalOpen(true);
    setLoadingDetails(true);
    setConversationDetails(null);
    
    try {
      const response = await api.getElevenLabsConversation(conversation.conversation_id);
      // La API devuelve { success: true, data: {...} }
      setConversationDetails(response.data || response);
    } catch (err: any) {
      console.error('Error cargando detalles:', err);
      setConversationDetails({ error: 'No se pudieron cargar los detalles de la conversación' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedConversation(null);
    setConversationDetails(null);
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Completada</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="w-3 h-3 mr-1" />En Curso</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Fallida</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredConsultations = consultations?.data?.filter((conv: any) => {
    if (!search) return true;
    return conv.conversation_id?.toLowerCase().includes(search.toLowerCase()) ||
           conv.caller_number?.toLowerCase().includes(search.toLowerCase()) ||
           conv.summary?.toLowerCase().includes(search.toLowerCase());
  }) || [];

  if (loading && !consultations) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
          <AppSidebar />
          <main className="flex-1 p-6">
            <div className="mb-4">
              <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
            </div>
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-medical-600" />
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-medical-800 mb-2">Consultas Telefónicas</h1>
                <p className="text-medical-600">Registro de llamadas atendidas por la asistente virtual Valeria</p>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              </div>
              <Button onClick={loadConsultations} disabled={loading} variant="outline" size="sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-medical-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Llamadas</p>
                      <p className="text-2xl font-bold text-medical-700">
                        {consultations?.stats?.total_conversations || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Completadas</p>
                      <p className="text-2xl font-bold text-green-700">
                        {consultations?.stats?.by_status?.completed || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">En Curso</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {consultations?.stats?.by_status?.in_progress || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-sm text-gray-600">Fallidas</p>
                      <p className="text-2xl font-bold text-red-700">
                        {consultations?.stats?.by_status?.failed || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-medical-700">Filtros de Búsqueda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input 
                        placeholder="Buscar por ID de conversación o número de teléfono..." 
                        className="pl-10"
                        value={search}
                        onChange={e=>setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-medical-700">Historial de Consultas Telefónicas</CardTitle>
                <CardDescription>
                  Conversaciones registradas por ElevenLabs - Agente: Valeria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredConsultations.length > 0 ? (
                    filteredConsultations.map((conv: any) => (
                      <div key={conv.conversation_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-medical-50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-medical-100 rounded-full flex items-center justify-center">
                              <Phone className="w-5 h-5 text-medical-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-gray-700 font-medium">
                                  {conv.conversation_id.substring(0, 24)}...
                                </span>
                                {getStatusBadge(conv.status)}
                              </div>
                              {conv.caller_number && (
                                <div className="text-sm text-gray-600 mt-1">
                                  <Phone className="w-3 h-3 inline mr-1" />
                                  {conv.caller_number}
                                </div>
                              )}
                              {conv.summary && (
                                <div className="text-sm text-gray-700 mt-1">
                                  {conv.summary}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right space-y-1">
                            <div className="flex items-center gap-1 text-medical-600">
                              <Calendar className="w-4 h-4" />
                              <span className="text-sm">{formatDate(conv.started_at)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-medical-600">
                              <Clock className="w-4 h-4" />
                              <span className="text-sm">{formatTime(conv.started_at)}</span>
                            </div>
                            {conv.duration_seconds && conv.duration_seconds > 0 && (
                              <div className="text-xs text-gray-500">
                                Duración: {Math.floor(conv.duration_seconds / 60)}m {conv.duration_seconds % 60}s
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewDetails(conv)}
                            className="flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            Ver Detalles
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Cargando consultas...
                        </div>
                      ) : (
                        'No se encontraron consultas'
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Modal de Detalles de Conversación */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-medical-600" />
              Detalles de la Conversación
            </DialogTitle>
            <DialogDescription>
              Información completa de la llamada telefónica
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-medical-600" />
            </div>
          ) : conversationDetails?.error ? (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{conversationDetails.error}</span>
            </div>
          ) : conversationDetails ? (
            <div className="space-y-4">
              {/* Información de la Llamada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información de la Llamada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">ID de Conversación</p>
                      <p className="font-mono text-sm font-medium break-all">{conversationDetails.conversation_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Estado</p>
                      <div className="mt-1">{getStatusBadge(conversationDetails.status)}</div>
                    </div>
                    {conversationDetails.caller_number && (
                      <div>
                        <p className="text-sm text-gray-600">Número del Llamante</p>
                        <p className="font-medium flex items-center gap-1">
                          <Phone className="w-4 h-4 text-medical-600" />
                          {conversationDetails.caller_number}
                        </p>
                      </div>
                    )}
                    {conversationDetails.started_at && (
                      <div>
                        <p className="text-sm text-gray-600">Fecha y Hora</p>
                        <p className="font-medium">
                          {formatDate(conversationDetails.started_at)} - {formatTime(conversationDetails.started_at)}
                        </p>
                      </div>
                    )}
                    {(conversationDetails.duration_seconds || conversationDetails.metadata?.call_duration_secs) && (
                      <div>
                        <p className="text-sm text-gray-600">Duración</p>
                        <p className="font-medium">
                          {Math.floor((conversationDetails.duration_seconds || conversationDetails.metadata?.call_duration_secs || 0) / 60)} minutos {(conversationDetails.duration_seconds || conversationDetails.metadata?.call_duration_secs || 0) % 60} segundos
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Botón de descarga de audio */}
                  {(conversationDetails.audio_url || conversationDetails.recording_url) && (
                    <div className="pt-3 border-t">
                      <Button 
                        variant="outline" 
                        className="w-full flex items-center justify-center gap-2"
                        onClick={() => window.open(conversationDetails.audio_url || conversationDetails.recording_url, '_blank')}
                      >
                        <Download className="w-4 h-4" />
                        Descargar Audio de la Llamada
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Transcripción */}
              {conversationDetails.transcript && conversationDetails.transcript.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Transcripción de la Conversación
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {conversationDetails.transcript.map((message: any, index: number) => (
                        <div 
                          key={index}
                          className={`p-3 rounded-lg ${
                            message.role === 'user' 
                              ? 'bg-blue-50 border-l-4 border-blue-500' 
                              : 'bg-green-50 border-l-4 border-green-500'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">
                              {message.role === 'user' ? '👤 Usuario' : '🤖 Valeria'}
                            </span>
                            {message.timestamp && (
                              <span className="text-xs text-gray-500">
                                {new Date(message.timestamp * 1000).toLocaleTimeString('es-CO')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800">{message.message}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No hay transcripción disponible para esta conversación</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Metadata adicional */}
              {conversationDetails.metadata && Object.keys(conversationDetails.metadata).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Información Adicional</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                      {JSON.stringify(conversationDetails.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default Consultations;
