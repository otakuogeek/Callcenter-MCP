import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Search, Calendar, Clock, Filter, RefreshCw, CheckCircle, XCircle, FileText, AlertCircle, Download, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [selectedDate, setSelectedDate] = useState<string>(''); // Inicialmente sin filtro
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadConsultations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getElevenLabsConsultations({ page_size: 10000 });
      setConsultations(response);
      setCurrentPage(1); // Reset a la primera página cuando se recargan datos
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
    // Filtrar por fecha seleccionada
    if (selectedDate) {
      const convDate = conv.start_time ? new Date(conv.start_time).toISOString().split('T')[0] : null;
      if (convDate !== selectedDate) return false;
    }
    
    // Filtrar por búsqueda de texto
    if (!search) return true;
    return conv.conversation_id?.toLowerCase().includes(search.toLowerCase()) ||
           conv.caller_number?.toLowerCase().includes(search.toLowerCase()) ||
           conv.summary?.toLowerCase().includes(search.toLowerCase());
  }) || [];

  // Calcular paginación
  const totalPages = Math.ceil(filteredConsultations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedConsultations = filteredConsultations.slice(startIndex, endIndex);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, search]);

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
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="w-auto"
                      placeholder="Todas las fechas"
                    />
                    {selectedDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDate('')}
                        className="text-xs"
                      >
                        Limpiar
                      </Button>
                    )}
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
                  {paginatedConsultations.length > 0 ? (
                    paginatedConsultations.map((conv: any) => {
                      // Extraer número de teléfono del cliente de múltiples ubicaciones posibles
                      const externalNumber = conv.caller_number || 
                                            conv.metadata?.phone_call?.external_number || 
                                            conv.metadata?.conversation_initiation_client_data?.dynamic_variables?.system__caller_id ||
                                            'N/A';
                      const agentNumber = conv.callee_number || 
                                         conv.metadata?.phone_call?.agent_number || 
                                         conv.metadata?.conversation_initiation_client_data?.dynamic_variables?.system__called_number ||
                                         'N/A';
                      const direction = conv.call_direction || conv.metadata?.phone_call?.direction || 'N/A';
                      const callType = conv.call_type || conv.metadata?.phone_call?.type || 'N/A';
                      const duration = conv.duration_seconds || conv.metadata?.call_duration_secs || 0;
                      const durationFormatted = duration > 0 
                        ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')} min`
                        : 'N/A';
                      const startTime = conv.metadata?.start_time_unix_secs 
                        ? new Date(conv.metadata.start_time_unix_secs * 1000).toLocaleString('es-CO')
                        : conv.started_at 
                        ? `${formatDate(conv.started_at)} - ${formatTime(conv.started_at)}`
                        : 'N/A';
                      const acceptedTime = conv.metadata?.accepted_time_unix_secs
                        ? new Date(conv.metadata.accepted_time_unix_secs * 1000).toLocaleTimeString('es-CO')
                        : 'N/A';
                      const terminationReason = conv.end_reason || conv.metadata?.termination_reason || 'N/A';
                      
                      return (
                        <Card key={conv.conversation_id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            {/* Header con ID y Estado */}
                            <div className="flex items-center justify-between mb-4 pb-3 border-b">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-medical-100 rounded-full flex items-center justify-center">
                                  <Phone className="w-6 h-6 text-medical-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">ID de Conversación</p>
                                  <p className="font-mono text-sm font-medium">{conv.conversation_id}</p>
                                </div>
                              </div>
                              {getStatusBadge(conv.status)}
                            </div>

                            {/* Grid con toda la información */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                              {/* Número Externo */}
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Número Externo (Cliente)</p>
                                <p className="font-semibold text-blue-600 text-lg flex items-center gap-2">
                                  <Phone className="w-4 h-4" />
                                  {externalNumber}
                                </p>
                              </div>

                              {/* Número del Agente */}
                              <div className="bg-green-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Número del Agente</p>
                                <p className="font-semibold text-green-600 text-lg flex items-center gap-2">
                                  <Phone className="w-4 h-4" />
                                  {agentNumber}
                                </p>
                              </div>

                              {/* Duración */}
                              <div className="bg-purple-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Duración Total</p>
                                <p className="font-semibold text-purple-600 text-lg flex items-center gap-2">
                                  <Clock className="w-5 h-5" />
                                  {durationFormatted}
                                </p>
                              </div>

                              {/* Dirección */}
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Dirección</p>
                                <Badge variant="outline" className="text-sm">
                                  {direction === 'inbound' ? '📥 Entrante' : direction === 'outbound' ? '📤 Saliente' : direction}
                                </Badge>
                              </div>

                              {/* Tipo de Llamada */}
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Tipo de Llamada</p>
                                <Badge variant="outline" className="text-sm">{callType}</Badge>
                              </div>

                              {/* Inicio de Llamada */}
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Inicio de Llamada</p>
                                <p className="font-medium text-sm">{startTime}</p>
                              </div>

                              {/* Aceptada */}
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Aceptada a las</p>
                                <p className="font-medium text-sm">{acceptedTime}</p>
                              </div>
                            </div>

                            {/* Razón de Finalización */}
                            {terminationReason !== 'N/A' && (
                              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                                <p className="text-xs text-gray-600 mb-1">Razón de Finalización</p>
                                <p className="text-sm font-medium">{terminationReason}</p>
                              </div>
                            )}

                            {/* Información Técnica */}
                            <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
                              {conv.metadata?.main_language && (
                                <div>
                                  <p className="text-xs text-gray-500">Idioma</p>
                                  <p className="font-medium">{conv.metadata.main_language.toUpperCase()}</p>
                                </div>
                              )}
                              {conv.metadata?.timezone && (
                                <div>
                                  <p className="text-xs text-gray-500">Zona Horaria</p>
                                  <p className="font-medium">{conv.metadata.timezone}</p>
                                </div>
                              )}
                              {conv.metadata?.authorization_method && (
                                <div>
                                  <p className="text-xs text-gray-500">Autorización</p>
                                  <p className="font-medium">{conv.metadata.authorization_method}</p>
                                </div>
                              )}
                              {conv.metadata?.conversation_initiation_source && (
                                <div>
                                  <p className="text-xs text-gray-500">Fuente</p>
                                  <p className="font-medium">{conv.metadata.conversation_initiation_source}</p>
                                </div>
                              )}
                            </div>

                            {/* Botón Ver Transcripción */}
                            <div className="mt-4 pt-3 border-t">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewDetails(conv)}
                                className="w-full flex items-center justify-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                Ver Transcripción Completa
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
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

                  {/* Controles de Paginación */}
                  {filteredConsultations.length > itemsPerPage && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        Mostrando {startIndex + 1} - {Math.min(endIndex, filteredConsultations.length)} de {filteredConsultations.length} consultas
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Anterior
                        </Button>
                        <div className="text-sm text-gray-600">
                          Página {currentPage} de {totalPages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Siguiente
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
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
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
              {/* Información Principal de la Llamada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📞 Información de la Llamada</CardTitle>
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
                    
                    {/* Información de teléfono */}
                    {conversationDetails.metadata?.phone_call && (
                      <>
                        <div>
                          <p className="text-sm text-gray-600">Número Externo (Cliente)</p>
                          <p className="font-medium flex items-center gap-1">
                            <Phone className="w-4 h-4 text-blue-600" />
                            {conversationDetails.metadata.phone_call.external_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Número del Agente</p>
                          <p className="font-medium flex items-center gap-1">
                            <Phone className="w-4 h-4 text-green-600" />
                            {conversationDetails.metadata.phone_call.agent_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Dirección</p>
                          <Badge variant="outline">
                            {conversationDetails.metadata.phone_call.direction === 'inbound' ? '📥 Entrante' : '📤 Saliente'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Tipo de Llamada</p>
                          <Badge variant="outline">{conversationDetails.metadata.phone_call.type}</Badge>
                        </div>
                      </>
                    )}
                    
                    {/* Fechas y duración */}
                    {conversationDetails.metadata?.start_time_unix_secs && (
                      <div>
                        <p className="text-sm text-gray-600">Inicio de Llamada</p>
                        <p className="font-medium">
                          {new Date(conversationDetails.metadata.start_time_unix_secs * 1000).toLocaleString('es-CO')}
                        </p>
                      </div>
                    )}
                    {conversationDetails.metadata?.accepted_time_unix_secs && (
                      <div>
                        <p className="text-sm text-gray-600">Aceptada a las</p>
                        <p className="font-medium">
                          {new Date(conversationDetails.metadata.accepted_time_unix_secs * 1000).toLocaleTimeString('es-CO')}
                        </p>
                      </div>
                    )}
                    {conversationDetails.metadata?.call_duration_secs && (
                      <div>
                        <p className="text-sm text-gray-600">Duración Total</p>
                        <p className="font-medium text-lg">
                          ⏱️ {Math.floor(conversationDetails.metadata.call_duration_secs / 60)}:{String(conversationDetails.metadata.call_duration_secs % 60).padStart(2, '0')} min
                        </p>
                      </div>
                    )}
                    
                    {/* Razón de terminación */}
                    {conversationDetails.metadata?.termination_reason && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600">Razón de Finalización</p>
                        <p className="font-medium text-sm">{conversationDetails.metadata.termination_reason}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Transcripción */}
              {conversationDetails.transcript && conversationDetails.transcript.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      📝 Transcripción de la Conversación
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

              {/* Información Técnica Adicional */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🔧 Información Técnica</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {conversationDetails.metadata?.main_language && (
                      <div>
                        <p className="text-gray-600">Idioma Principal</p>
                        <p className="font-medium">{conversationDetails.metadata.main_language.toUpperCase()}</p>
                      </div>
                    )}
                    {conversationDetails.metadata?.timezone && (
                      <div>
                        <p className="text-gray-600">Zona Horaria</p>
                        <p className="font-medium">{conversationDetails.metadata.timezone}</p>
                      </div>
                    )}
                    {conversationDetails.metadata?.authorization_method && (
                      <div>
                        <p className="text-gray-600">Método de Autorización</p>
                        <p className="font-medium">{conversationDetails.metadata.authorization_method}</p>
                      </div>
                    )}
                    {conversationDetails.metadata?.conversation_initiation_source && (
                      <div>
                        <p className="text-gray-600">Fuente de Inicio</p>
                        <p className="font-medium">{conversationDetails.metadata.conversation_initiation_source}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default Consultations;
