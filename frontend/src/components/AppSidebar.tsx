import { Calendar, Users, BarChart3, Clock, HeadphonesIcon, MapPin, FileText, Settings, MessageSquare, BookOpen, MessageCircle, ClipboardList, LifeBuoy, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { clearAdminSession } from "@/lib/authStorage";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

// Menu items principales (enfoque en calendario)
// Ocultamos Dashboard Calendario y Agenda Diaria (mantener código comentado para posible reactivación)
const calendarItems = [
  // {
  //   title: "Dashboard Calendario",
  //   url: "/admin",
  //   icon: Calendar,
  //   highlight: true,
  // },
  // {
  //   title: "Agenda Diaria",
  //   url: "/admin/daily-schedule",
  //   icon: CalendarDays,
  //   highlight: true,
  // },
  {
    title: "Gestión de agenda",
    url: "/admin/appointments",
    icon: Clock,
  },
];

const mainItems = [
  {
    title: "Pacientes",
    url: "/admin/patients",
    icon: Users,
  },
  // {
  //   title: "Monitor de Llamadas",
  //   url: "/admin/calls/monitor",
  //   icon: Activity,
  //   highlight: true,
  // },
];

// Menu items de gestión
const managementItems = [
  {
    title: "Cola de Espera",
    url: "/admin/queue",
    icon: Clock,
  },
  {
    title: "Cola Diaria",
    url: "/admin/daily-queue",
    icon: Calendar,
  },
  // {
  //   title: "Agentes",
  //   url: "/admin/agents",
  //   icon: HeadphonesIcon,
  // },
  {
    title: "Llamadas",
    url: "/admin/consultations",
    icon: FileText,
  },
  {
    title: "Órdenes",
    url: "/admin/orders",
    icon: FileText,
  },
  {
    title: "Ubicaciones",
    url: "/admin/locations",
    icon: MapPin,
  },
  {
    title: "SMS",
    url: "/admin/sms",
    icon: MessageSquare,
  },
  {
    title: "Wiki",
    url: "/admin/wiki",
    icon: BookOpen,
  },
  {
    title: "Soporte",
    url: "/admin/support",
    icon: LifeBuoy,
  },
];

// Menu items de análisis - only Analytics now
const analyticsItems = [
  {
    title: "Análisis",
    url: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Distribución",
    url: "/admin/distribution",
    icon: Calendar,
  },
];

// Menu items de WhatsApp
const whatsappItems = [
  {
    title: "WhatsApp Bot",
    url: "/admin/whatsapp",
    icon: MessageCircle,
  },
];

// Nuevos items para funcionalidades mejoradas
// (advancedItems actualmente no renderizado; se puede habilitar cuando se requiera)

// Helper para decodificar JWT y obtener el rol
const getUserRole = (): string | null => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
};

export function AppSidebar() {
  const [queueCount, setQueueCount] = useState<number>(0);
  const [transferCount, setTransferCount] = useState<number>(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState<number>(0);
  const [connectionMode, setConnectionMode] = useState<'SSE'|'POLL'>(() => (localStorage.getItem('connMode') as any) || 'SSE');
  const location = useLocation();
  const navigate = useNavigate();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const { toast } = useToast();
  
  // Obtener rol del usuario para controlar visibilidad de secciones
  const userRole = getUserRole();
  const isSuperAdmin = userRole === 'superadmin';

  // const currentDate = new Date(); // (no usado actualmente)

  // Helper: crea EventSource con token con manejo de errores mejorado
  function subscribe(path: string, onEvent: (ev: MessageEvent) => void) {
    const token = localStorage.getItem('token') || undefined;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const url = `${base}${path}` + (token ? `?token=${encodeURIComponent(token)}` : '');
    let es: EventSource | null = null;
    let attempts = 0;
    let closed = false;
    let fallbackInterval: any = null;
    
    // WORKAROUND: SSE tiene problemas con HTTP/2 (ERR_HTTP2_PROTOCOL_ERROR)
    // Si estamos en HTTPS (lo cual implica HTTP/2), usar polling directamente
    const forcePolling = window.location.protocol === 'https:' || 
                        localStorage.getItem('connMode') === 'POLL';

    const pollFallback = async () => {
      try {
        if (path.includes('queue')) {
          const waitingListRes = await fetch(`${base}/appointments/waiting-list` + (token?`?token=${encodeURIComponent(token)}`:''), { headers: token?{ Authorization:`Bearer ${token}`}:undefined });
          if (waitingListRes.ok) {
            const waitingListData = await waitingListRes.json();
            // synth event
            onEvent(new MessageEvent('poll', { data: JSON.stringify({ stats: waitingListData.stats }) }));
          }
        } else if (path.includes('transfers')) {
          const trRes = await fetch(`${base}/transfers?status=pending` + (token?`&token=${encodeURIComponent(token)}`:''), { headers: token?{ Authorization:`Bearer ${token}`}:undefined });
          if (trRes.ok) {
            const list = await trRes.json();
            onEvent(new MessageEvent('poll', { data: JSON.stringify({ count: Array.isArray(list)?list.length:0 }) }));
          }
        }
      } catch {}
    };

    const startFallback = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(pollFallback, 10000);
      pollFallback();
      if (connectionMode !== 'POLL') {
        setConnectionMode('POLL');
        localStorage.setItem('connMode','POLL');
      }
    };
    const stopFallback = () => { if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval=null; } };

    const connect = () => {
      if (closed) return;
      
      // Si forzamos polling, no intentar SSE
      if (forcePolling) {
        startFallback();
        return;
      }
      
      try {
        es = new EventSource(url);
  es.onopen = () => { attempts = 0; stopFallback(); if (connectionMode !== 'SSE') { setConnectionMode('SSE'); localStorage.setItem('connMode','SSE'); } };
        es.onmessage = onEvent;
        ['enqueue','assign','scheduled','cancelled','created','accepted','rejected','completed'].forEach(ev => es!.addEventListener(ev, onEvent as any));
        es.onerror = () => {
          // Silently handle SSE errors - fallback to polling
          try { es?.close(); } catch {}
          es = null;
          attempts += 1;
          const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
          // Después de 3 intentos, activar fallback polling
          if (attempts >= 3) startFallback();
          if (!closed) setTimeout(connect, delay);
        };
      } catch (e) {
        attempts += 1;
        const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
        if (attempts >= 3) startFallback();
        if (!closed) setTimeout(connect, delay);
      }
    };

    connect();

    return {
      close() {
        closed = true;
        try { es?.close(); } catch {}
        stopFallback();
      }
    };
  }

  useEffect(() => {
  let esTransfers: any = null;
  let queuePollingInterval: any = null;
    
    const fetchInitial = async () => {
      try {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const token = localStorage.getItem('token') || '';
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Obtener datos de waiting list con manejo de errores
        try {
          const waitingListRes = await fetch(`${base}/appointments/waiting-list`, { headers });
          if (waitingListRes.ok) {
            const waitingListData = await waitingListRes.json();
            setQueueCount(Number(waitingListData?.stats?.total_patients_waiting || 0));
          }
        } catch (error) {
          console.warn('Error fetching waiting list:', error);
        }
        
        // Obtener transfers con manejo de errores
        try {
          const trRes = await fetch(`${base}/transfers?status=pending`, { headers });
          if (trRes.ok) {
            const list = await trRes.json();
            setTransferCount(Array.isArray(list) ? list.length : 0);
          }
        } catch (error) {
          console.warn('Error fetching transfers:', error);
        }

        // Obtener estado de mantenimiento
        try {
          const s = await api.getSettings();
          const m = (s as any)?.maintenance_mode;
          if (typeof m !== "undefined") setMaintenanceMode(!!m);
        } catch (error) {
          console.warn('Error fetching settings:', error);
        }
      } catch (error) {
        console.warn('Error in fetchInitial:', error);
      }
    };
    
    fetchInitial();

    // Polling periódico para la cola de espera (cada 30 segundos)
    const pollQueue = async () => {
      try {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const token = localStorage.getItem('token') || '';
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        
        const waitingListRes = await fetch(`${base}/appointments/waiting-list`, { headers });
        if (waitingListRes.ok) {
          const waitingListData = await waitingListRes.json();
          setQueueCount(Number(waitingListData?.stats?.total_patients_waiting || 0));
        }
      } catch (error) {
        console.warn('Error polling waiting list:', error);
      }
    };

    // Polling para mensajes sin leer de soporte (cada 30 segundos)
    const pollSupportUnread = async () => {
      try {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const token = localStorage.getItem('token') || '';
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        
        const supportRes = await fetch(`${base}/support/tickets`, { headers });
        if (supportRes.ok) {
          const supportData = await supportRes.json();
          if (supportData.success && Array.isArray(supportData.data)) {
            const totalUnread = supportData.data.reduce((sum: number, ticket: any) => {
              return sum + (ticket.unread_count || 0);
            }, 0);
            setSupportUnreadCount(totalUnread);
          }
        }
      } catch (error) {
        console.warn('Error polling support unread:', error);
      }
    };

    // Iniciar polling cada 30 segundos
    queuePollingInterval = setInterval(() => {
      pollQueue();
      pollSupportUnread();
    }, 30000);
    
    // Cargar datos iniciales
    pollQueue();
    pollSupportUnread();
    
    const onTransfers = (ev: MessageEvent) => {
      try {
        if (ev.type === 'created') setTransferCount((c) => c + 1);
        if (ev.type === 'accepted' || ev.type === 'rejected' || ev.type === 'completed') setTransferCount((c) => Math.max(0, c - 1));
      } catch (error) {
        console.warn('Error handling transfers event:', error);
      }
    };
    
    esTransfers = subscribe('/transfers/stream', onTransfers);

    
    return () => {
  if (queuePollingInterval) clearInterval(queuePollingInterval);
  esTransfers?.close?.();
    };
  }, [location.pathname]);

  const handleMaintenanceToggle = async (checked: boolean) => {
    try {
      const res = await api.updateSettings({ maintenance_mode: checked });
      if ((res as any)?.success || typeof (res as any)?.maintenance_mode !== "undefined") {
        setMaintenanceMode(checked);
        toast({
          title: checked ? "Modo Mantenimiento Activado" : "Modo Mantenimiento Desactivado",
          description: checked ? "El portal de pacientes mostrará la página de mantenimiento." : "El portal de pacientes vuelve a estar disponible.",
          variant: checked ? "destructive" : "default",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "No fue posible actualizar el estado de mantenimiento.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar className="border-r border-medical-200">
      <SidebarHeader className="p-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-medical-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-medical-800">Valeria</h2>
            <p className="text-xs text-medical-600">Sistema Médico Avanzado</p>
            <p className="text-[10px] mt-1 font-mono tracking-wide inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-medical-100 text-medical-700 border border-medical-200">
              <span className={connectionMode==='SSE' ? 'text-green-600' : 'text-orange-600'}>
                {connectionMode === 'SSE' ? 'SSE' : 'POLL'}
              </span>
              <span className="text-[9px] text-medical-500">live</span>
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        {/* Sección de Calendario - Prioridad */}
        <SidebarGroup>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {calendarItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className="hover:bg-medical-50 hover:text-medical-700 data-[active=true]:bg-medical-100 data-[active=true]:text-medical-800"
                  >
                    <Link to={item.url} className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-medical-700 font-semibold">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className="hover:bg-medical-50 hover:text-medical-700 data-[active=true]:bg-medical-100 data-[active=true]:text-medical-800"
                  >
                    <Link to={item.url} className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-medical-700 font-semibold">
            Gestión
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className="hover:bg-medical-50 hover:text-medical-700 data-[active=true]:bg-medical-100 data-[active=true]:text-medical-800"
                  >
                    <Link to={item.url} className="flex items-center space-x-3 w-full justify-between">
                      <span className="flex items-center space-x-3">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </span>
                      {item.title === 'Cola de Espera' && queueCount > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-medical-600 text-white min-w-6">
                          {queueCount}
                        </span>
                      )}
                      {item.title === 'Agentes' && transferCount > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-orange-600 text-white min-w-6">
                          {transferCount}
                        </span>
                      )}
                      {item.title === 'Soporte' && supportUnreadCount > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-red-500 text-white min-w-6 animate-pulse">
                          {supportUnreadCount}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        <SidebarGroup>
          <SidebarGroupLabel className="text-medical-700 font-semibold">
            Análisis
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className="hover:bg-medical-50 hover:text-medical-700 data-[active=true]:bg-medical-100 data-[active=true]:text-medical-800"
                  >
                    <Link to={item.url} className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-green-700 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            WhatsApp
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {whatsappItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className="hover:bg-green-50 hover:text-green-700 data-[active=true]:bg-green-100 data-[active=true]:text-green-800"
                  >
                    <Link to={item.url} className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4 text-green-600" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

       
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-medical-200 space-y-2">
        <SidebarMenu>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              className="hover:bg-medical-50 hover:text-medical-700"
            >
              <Link to="/admin/settings" className="flex items-center space-x-3">
                <Settings className="w-4 h-4" />
                <span>Configuración</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Auditoría solo visible para superadmin */}
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                className="hover:bg-medical-50 hover:text-medical-700"
              >
                <Link to="/admin/audit" className="flex items-center space-x-3">
                  <ClipboardList className="w-4 h-4" />
                  <span>Auditoría</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="hover:bg-red-50 hover:text-red-700 cursor-pointer"
              onClick={() => {
                clearAdminSession();
                navigate('/admin/login');
              }}
            >
              <div className="flex items-center space-x-3">
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
