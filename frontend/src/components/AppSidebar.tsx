import { Calendar, Users, BarChart3, Clock, HeadphonesIcon, MapPin, FileText, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

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
import LogoutButton from "./LogoutButton";

// Menu items principales (enfoque en calendario)
// Ocultamos Dashboard Calendario y Agenda Diaria (mantener código comentado para posible reactivación)
const calendarItems = [
  // {
  //   title: "Dashboard Calendario",
  //   url: "/",
  //   icon: Calendar,
  //   highlight: true,
  // },
  // {
  //   title: "Agenda Diaria",
  //   url: "/daily-schedule",
  //   icon: CalendarDays,
  //   highlight: true,
  // },
  {
    title: "Gestión de agenda",
    url: "/appointments",
    icon: Clock,
  },
];

const mainItems = [
  {
    title: "Pacientes",
    url: "/patients",
    icon: Users,
  },
  // {
  //   title: "Monitor de Llamadas",
  //   url: "/calls/monitor",
  //   icon: Activity,
  //   highlight: true,
  // },
];

// Menu items de gestión
const managementItems = [
  {
    title: "Cola de Espera",
    url: "/queue",
    icon: Clock,
  },
  {
    title: "Cola Diaria",
    url: "/daily-queue",
    icon: Calendar,
  },
  // {
  //   title: "Agentes",
  //   url: "/agents",
  //   icon: HeadphonesIcon,
  // },
  {
    title: "Consultas",
    url: "/consultations",
    icon: FileText,
  },
  {
    title: "Ubicaciones",
    url: "/locations",
    icon: MapPin,
  },
];

// Menu items de análisis - only Analytics now
const analyticsItems = [
  {
    title: "Análisis",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Distribución",
    url: "/distribution",
    icon: Calendar,
  },
];

// Nuevos items para funcionalidades mejoradas
// (advancedItems actualmente no renderizado; se puede habilitar cuando se requiera)

export function AppSidebar() {
  const [queueCount, setQueueCount] = useState<number>(0);
  const [transferCount, setTransferCount] = useState<number>(0);
  const [connectionMode, setConnectionMode] = useState<'SSE'|'POLL'>(() => (localStorage.getItem('connMode') as any) || 'SSE');
  const location = useLocation();

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
      try {
        es = new EventSource(url);
  es.onopen = () => { attempts = 0; stopFallback(); if (connectionMode !== 'SSE') { setConnectionMode('SSE'); localStorage.setItem('connMode','SSE'); } };
        es.onmessage = onEvent;
        ['enqueue','assign','scheduled','cancelled','created','accepted','rejected','completed'].forEach(ev => es!.addEventListener(ev, onEvent as any));
        es.onerror = (err) => {
          console.warn(`EventSource error for ${path}:`, err);
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

    // Iniciar polling cada 30 segundos
    queuePollingInterval = setInterval(pollQueue, 30000);
    
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
                      {item.title === 'Cola de Espera' && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-medical-600 text-white min-w-6">
                          {queueCount}
                        </span>
                      )}
                      {item.title === 'Agentes' && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-orange-600 text-white min-w-6">
                          {transferCount}
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

       
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-medical-200 space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              className="hover:bg-medical-50 hover:text-medical-700"
            >
              <Link to="/settings" className="flex items-center space-x-3">
                <Settings className="w-4 h-4" />
                <span>Configuración</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <LogoutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
