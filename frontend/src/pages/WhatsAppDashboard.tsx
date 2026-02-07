import { useState, useEffect, useCallback, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Bot,
  QrCode,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Send,
  Loader2,
  Smartphone,
  Phone,
  Search,
  MoreVertical,
  Menu,
  ArrowLeft,
  User,
  Clock,
  Mic
} from "lucide-react";
import api from "@/lib/api";

interface WhatsAppStatus {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending';
  qrCode: string | null;
  lastError: string | null;
  session: {
    id: string;
    phone: string;
    lastActivity: string;
  } | null;
  stats: {
    todayMessages: number;
    inboundMessages: number;
    outboundMessages: number;
    aiResponses: number;
    failedMessages: number;
    activeConversations: number;
  };
  config: {
    aiProvider: string;
    aiModel: string;
    autoReply: boolean;
    businessHoursOnly: boolean;
  };
}

interface Conversation {
  id: number;
  phone_number: string;
  patient_name: string | null;
  last_message: string;
  last_activity: string;
  status: string;
  message_count: number;
  unread_count?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{ name: string; result: string }>;
}

const WhatsAppDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: WhatsAppStatus }>('/whatsapp/status');
      if (response.success) {
        const data = response.data;
        setStatus(data);
        if (data.qrCode) {
          setQrCodeImage(data.qrCode);
        }
        if (data.connected) {
          setQrCodeImage(null);
          setConnecting(false);
        }
      }
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
    }
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Conversation[] }>('/whatsapp/conversations');
      if (response.success) {
        setConversations(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, []);

  // Load messages for a specific conversation
  const loadConversationMessages = useCallback(async (phone: string) => {
    if (phone === 'valeria-ia') {
      // For Valeria IA test chat, don't load messages from DB
      return;
    }
    
    setLoadingMessages(true);
    try {
      const encodedPhone = encodeURIComponent(phone);
      const response = await api.get<{ 
        success: boolean; 
        data: { 
          conversation: any;
          messages: Array<{
            id: number;
            from_number: string;
            body: string;
            direction: 'inbound' | 'outbound';
            created_at: string;
          }>;
        } 
      }>(`/whatsapp/conversations/${encodedPhone}`);
      
      if (response.success && response.data?.messages) {
        const formattedMessages: ChatMessage[] = response.data.messages.map(msg => ({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.body || '',
          timestamp: new Date(msg.created_at)
        }));
        setChatMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      setChatMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Send message - real WhatsApp for conversations, AI test for valeria-ia
  const handleChatSend = async () => {
    if (!chatInput.trim() || chatSending || !selectedChat) return;

    const messageContent = chatInput.trim();
    setChatInput("");
    setChatSending(true);

    // For real WhatsApp conversations, send via WhatsApp API
    if (selectedChat !== 'valeria-ia') {
      try {
        const response = await api.post<{ success: boolean; data: { messageId: string }; error?: string }>('/whatsapp/messages/send', {
          to: selectedChat,
          message: messageContent
        });

        if (response.success) {
          // Add sent message to the chat (as assistant since we're sending)
          const sentMessage: ChatMessage = {
            role: 'assistant',
            content: messageContent,
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, sentMessage]);
        } else {
          throw new Error(response.error || 'Error enviando mensaje');
        }
      } catch (error: any) {
        // Show error but don't add fake message
        console.error('Error sending WhatsApp message:', error);
        alert(`Error al enviar: ${error.message || 'No se pudo enviar el mensaje'}`);
      } finally {
        setChatSending(false);
      }
      return;
    }

    // For Valeria IA test chat, use AI endpoint
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);

    try {
      const response = await api.post<{ success: boolean; data: { response: string; toolCalls?: Array<{ name: string; result: string }> }; error?: string }>('/whatsapp/chat/test', {
        message: userMessage.content,
        history: chatMessages.map(m => ({ role: m.role, content: m.content }))
      });

      if (response.success) {
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date(),
          toolCalls: response.data.toolCalls
        };
        setChatMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(response.error || 'Error en respuesta');
      }
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${error.message || 'No se pudo procesar el mensaje'}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatSending(false);
    }
  };

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchConversations()]);
      setLoading(false);
    };
    loadAll();

    const interval = setInterval(() => {
      fetchStatus();
      fetchConversations();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchConversations]);

  // QR Polling
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if ((status?.status === 'qr_pending' || connecting) && !status?.connected) {
      pollingRef.current = setInterval(() => {
        fetchStatus();
      }, 2000);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [status?.status, status?.connected, connecting, fetchStatus]);

  // Connect
  const handleConnect = async () => {
    setConnecting(true);
    setQrCodeImage(null);
    try {
      const response = await api.post<{ success: boolean; data: { qrCode?: string; connected: boolean; status: string }; error?: string }>('/whatsapp/connect');
      
      if (response.success) {
        const qr = response.data?.qrCode;
        if (qr) {
          setQrCodeImage(qr);
        }
        toast({
          title: "Conexión iniciada",
          description: "Escanee el código QR con WhatsApp",
        });
        if (!qr) {
          await fetchStatus();
        }
      } else {
        throw new Error(response.error || 'Error iniciando conexión');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo iniciar la sesión",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    try {
      await api.post('/whatsapp/disconnect');
      setQrCodeImage(null);
      setConnecting(false);
      toast({
        title: "Desconectado",
        description: "Sesión de WhatsApp cerrada",
      });
      fetchStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo desconectar",
        variant: "destructive",
      });
    }
  };

  // Select a conversation
  const handleSelectChat = async (phone: string) => {
    setSelectedChat(phone);
    setChatMessages([]);
    // Load messages from backend
    await loadConversationMessages(phone);
  };

  // Format phone number for display
  const formatPhone = (phone: string) => {
    if (!phone) return '';
    // Remove country code for display
    if (phone.startsWith('57')) {
      return phone.slice(2).replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    }
    return phone;
  };

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return date.toLocaleDateString('es-CO', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
  };

  // Get initials from name or phone
  const getInitials = (name: string | null, phone: string) => {
    if (name) {
      const parts = name.split(' ');
      return parts.length >= 2 
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
    }
    return phone.slice(-2);
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.phone_number?.includes(searchQuery) ||
      conv.patient_name?.toLowerCase().includes(searchLower) ||
      conv.last_message?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gray-100">
          <AppSidebar />
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
              <p className="text-gray-600">Cargando WhatsApp...</p>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  // QR Screen - when not connected
  if (!status?.connected) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gray-100">
          <AppSidebar />
          <main className="flex-1 flex items-center justify-center p-8">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
            {/* Logo */}
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">
              WhatsApp Web
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              Vincula tu cuenta de WhatsApp para comenzar
            </p>

            {/* QR Code */}
            {qrCodeImage ? (
              <div className="bg-white p-4 rounded-xl inline-block mb-6 border-2 border-gray-100">
                <img 
                  src={qrCodeImage} 
                  alt="Código QR" 
                  className="w-64 h-64 object-contain"
                />
              </div>
            ) : connecting ? (
              <div className="py-12 mb-6">
                <Loader2 className="w-16 h-16 text-green-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Generando código QR...</p>
              </div>
            ) : (
              <div className="py-8 mb-6">
                <div className="w-64 h-64 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center mx-auto mb-6 bg-gray-50">
                  <Smartphone className="w-16 h-16 text-gray-400" />
                </div>
                <Button 
                  size="lg" 
                  className="bg-green-500 hover:bg-green-600 text-white px-8"
                  onClick={handleConnect}
                >
                  <QrCode className="w-5 h-5 mr-2" />
                  Generar QR
                </Button>
              </div>
            )}

            {/* Instructions */}
            {(qrCodeImage || connecting) && (
              <div className="text-left bg-gray-50 rounded-lg p-4 text-sm">
                <p className="text-gray-700 font-medium mb-3">Para escanear el código:</p>
                <ol className="text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">1.</span>
                    Abre WhatsApp en tu teléfono
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">2.</span>
                    Toca Menú ⋮ → Dispositivos vinculados
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">3.</span>
                    Toca Vincular un dispositivo
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">4.</span>
                    Escanea el código QR
                  </li>
                </ol>
              </div>
            )}

            {status?.lastError && (
              <div className="mt-4 space-y-3">
                <p className="text-red-500 text-sm">{status.lastError}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    setConnecting(true);
                    try {
                      const response = await api.post<{ success: boolean; data: { qrCode?: string }; error?: string }>('/whatsapp/force-restart');
                      if (response.success) {
                        const qr = response.data?.qrCode;
                        if (qr) setQrCodeImage(qr);
                        toast({ title: 'Reconexión iniciada', description: 'Escanee el nuevo código QR' });
                        await fetchStatus();
                      } else {
                        throw new Error(response.error || 'Error reiniciando');
                      }
                    } catch (error: any) {
                      toast({ title: 'Error', description: error.message || 'No se pudo reiniciar', variant: 'destructive' });
                    } finally {
                      setConnecting(false);
                    }
                  }}
                  disabled={connecting}
                >
                  {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Reiniciar conexión
                </Button>
              </div>
            )}
          </div>
        </main>
        </div>
      </SidebarProvider>
    );
  }

  // Main Chat Interface - WhatsApp Web Style (Light Theme)
  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-[#eae6df]">
        <AppSidebar />
        <main className="flex-1 flex overflow-hidden">
          {/* Left Panel - Conversations */}
          <div className={`${showSidebar ? 'w-[380px]' : 'w-0'} flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 bg-green-500">
              <AvatarFallback className="bg-green-500 text-white">
                <Bot className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-800">Biosanar IPS</p>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {status?.session?.phone || 'Conectado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-gray-600 hover:bg-gray-200 rounded-full"
              onClick={fetchConversations}
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-gray-600 hover:bg-gray-200 rounded-full"
              onClick={handleDisconnect}
            >
              <WifiOff className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar o iniciar chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#f0f2f5] border-0 rounded-lg text-sm focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {/* Chat with Valeria (AI Test) - Always first */}
          <div
            onClick={() => handleSelectChat('valeria-ia')}
            className={`flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-[#f5f6f6] border-b border-gray-100 ${
              selectedChat === 'valeria-ia' ? 'bg-[#f0f2f5]' : ''
            }`}
          >
            <Avatar className="w-12 h-12 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white">
                <Bot className="w-6 h-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="text-base font-medium text-gray-900 truncate">Valeria IA</h3>
                <span className="text-xs text-gray-500">Ahora</span>
              </div>
              <p className="text-sm text-gray-500 truncate">Prueba de chat con asistente</p>
            </div>
            <Badge className="bg-green-500 text-white text-xs px-2 py-0.5">IA</Badge>
          </div>

          {/* Real Conversations */}
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelectChat(conv.phone_number)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-[#f5f6f6] border-b border-gray-100 ${
                  selectedChat === conv.phone_number ? 'bg-[#f0f2f5]' : ''
                }`}
              >
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <AvatarFallback className="bg-gray-300 text-gray-600">
                    {getInitials(conv.patient_name, conv.phone_number)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-base font-medium text-gray-900 truncate">
                      {conv.patient_name || formatPhone(conv.phone_number)}
                    </h3>
                    <span className="text-xs text-gray-500">{formatTime(conv.last_activity)}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{conv.last_message || 'Sin mensajes'}</p>
                </div>
                {conv.unread_count && conv.unread_count > 0 && (
                  <Badge className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center p-0 text-xs">
                    {conv.unread_count}
                  </Badge>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No hay conversaciones</p>
              <p className="text-gray-400 text-xs mt-1">Los chats aparecerán aquí</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col bg-[#eae6df]">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-[#f0f2f5] px-4 py-2 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden text-gray-600 hover:bg-gray-200 rounded-full"
                  onClick={() => setSelectedChat(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10">
                  <AvatarFallback className={`${selectedChat === 'valeria-ia' ? 'bg-green-500' : 'bg-gray-300'} text-white`}>
                    {selectedChat === 'valeria-ia' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-base font-medium text-gray-900">
                    {selectedChat === 'valeria-ia' ? 'Valeria - Asistente IA' : formatPhone(selectedChat)}
                  </h2>
                  <p className="text-xs text-green-600">En línea</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-200 rounded-full">
                  <Search className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-200 rounded-full">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div 
              className="flex-1 overflow-y-auto px-16 py-4"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cdefs%3E%3Cpattern id='p' width='80' height='80' patternUnits='userSpaceOnUse'%3E%3Cpath d='M0 0h80v80H0z' fill='%23eae6df'/%3E%3Cpath d='M20 20h4v4h-4zm12 0h4v4h-4zm12 0h4v4h-4zm12 0h4v4h-4zm-48 12h4v4H8zm12 0h4v4h-4zm12 0h4v4h-4zm12 0h4v4h-4zm12 0h4v4h-4zm12 0h4v4h-4zM8 44h4v4H8zm24 0h4v4h-4zm24 0h4v4h-4zM20 56h4v4h-4zm24 0h4v4h-4zm24 0h4v4h-4zM8 68h4v4H8zm24 0h4v4h-4zm36 0h4v4h-4z' fill='%23dcd7ce' fill-opacity='.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23p)'/%3E%3C/svg%3E")`,
              }}
            >
              <div className="max-w-3xl mx-auto space-y-1">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="text-center bg-white/90 rounded-xl p-8 shadow-sm">
                      <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                      <p className="text-gray-500 text-sm">Cargando mensajes...</p>
                    </div>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="text-center bg-white/90 rounded-xl p-8 shadow-sm">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-gray-800 text-lg font-medium mb-2">
                        {selectedChat === 'valeria-ia' ? 'Chat con Valeria IA' : 'Iniciar conversación'}
                      </h3>
                      <p className="text-gray-500 text-sm mb-6">
                        {selectedChat === 'valeria-ia' 
                          ? 'Prueba el asistente de citas médicas' 
                          : 'Escribe un mensaje para comenzar'}
                      </p>
                      {selectedChat === 'valeria-ia' && (
                        <div className="flex flex-wrap justify-center gap-2">
                          {[
                            "Hola, necesito una cita",
                            "¿Qué especialidades tienen?",
                            "Mi cédula es 17265900"
                          ].map((suggestion, i) => (
                            <button
                              key={i}
                              onClick={() => setChatInput(suggestion)}
                              className="px-4 py-2 bg-green-50 text-green-700 text-sm rounded-full hover:bg-green-100 transition-colors border border-green-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg, idx) => {
                      const isAudioMessage = msg.content.startsWith('🎤');
                      const displayContent = isAudioMessage ? msg.content.substring(2).trim() : msg.content;
                      
                      return (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[65%] px-3 py-2 rounded-lg shadow-sm ${
                              msg.role === 'user'
                                ? 'bg-[#d9fdd3] rounded-tr-none'
                                : 'bg-white rounded-tl-none'
                            }`}
                          >
                            {isAudioMessage && (
                              <div className="flex items-center gap-1 mb-1 text-xs text-purple-600">
                                <Mic className="w-3 h-3" />
                                <span>Mensaje de voz</span>
                              </div>
                            )}
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{displayContent}</p>
                            {/* Herramientas ejecutadas - ocultas para una experiencia más limpia */}
                            <p className={`text-[11px] mt-1 flex items-center justify-end gap-1 text-gray-500`}>
                              {msg.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                              {msg.role === 'user' && (
                                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {chatSending && (
                      <div className="flex justify-start">
                        <div className="bg-white px-4 py-3 rounded-lg rounded-tl-none shadow-sm">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f2f5] px-4 py-3">
              <div className="max-w-3xl mx-auto flex items-center gap-3">
                <Input
                  placeholder="Escribe un mensaje"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  disabled={chatSending}
                  className="flex-1 bg-white border-0 rounded-lg py-3 px-4 text-sm focus-visible:ring-0 shadow-sm"
                />
                <Button
                  onClick={handleChatSend}
                  disabled={chatSending || !chatInput.trim()}
                  size="icon"
                  className="bg-green-500 hover:bg-green-600 rounded-full w-12 h-12 flex-shrink-0 shadow-sm"
                >
                  {chatSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* No chat selected */
          <div className="flex-1 flex items-center justify-center bg-[#f0f2f5]">
            <div className="text-center">
              <div className="w-64 h-64 mx-auto mb-6">
                <svg viewBox="0 0 303 172" className="w-full h-full opacity-80">
                  <path fill="#DAF7F3" d="M229.565 160.229c32.647-16.138 54.109-49.2 54.109-87.229C283.674 32.651 251.023 0 210.674 0c-23.238 0-44.217 10.859-57.674 27.79C139.543 10.859 118.565 0 95.326 0 54.977 0 22.326 32.651 22.326 73c0 38.029 21.462 71.091 54.109 87.229l76.565 45.771 76.565-45.771z"/>
                  <path fill="#fff" d="M153 106c-.537 0-1.078-.063-1.606-.189C149.406 105.4 148 103.787 148 101.818V72.182c0-1.969 1.406-3.582 3.394-3.993.528-.126 1.069-.189 1.606-.189h46c2.209 0 4 1.791 4 4v30c0 2.209-1.791 4-4 4h-46z"/>
                  <path fill="#00A884" d="M153 109c-.709 0-1.419-.083-2.098-.246-3.39-.814-5.902-3.889-5.902-7.236V71.482c0-3.347 2.512-6.422 5.902-7.236.679-.163 1.389-.246 2.098-.246h46c3.866 0 7 3.134 7 7v31c0 3.866-3.134 7-7 7h-46zm46-42h-46c-.205 0-.41.024-.606.071-.793.19-1.394.898-1.394 1.611v30.036c0 .713.601 1.421 1.394 1.611.196.047.401.071.606.071h46c.552 0 1-.449 1-1V68c0-.551-.448-1-1-1z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-light text-gray-700 mb-2">WhatsApp Web</h2>
              <p className="text-gray-500 text-sm max-w-md">
                Envía y recibe mensajes desde tu computadora.<br/>
                Selecciona un chat o inicia una conversación con Valeria IA.
              </p>
            </div>
          </div>
        )}
        </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default WhatsAppDashboard;
