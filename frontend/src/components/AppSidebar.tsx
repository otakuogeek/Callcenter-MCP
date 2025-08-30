import { Calendar, Users, BarChart3, Clock, HeadphonesIcon, MapPin, FileText, Activity, Settings } from "lucide-react";
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
  {
    title: "Monitor de Llamadas",
    url: "/calls/monitor",
    icon: Activity,
    highlight: true,
  },
];

// Menu items de gestión
const managementItems = [
  {
    title: "Cola de Espera",
    url: "/queue",
    icon: Clock,
  },
  {
    title: "Agentes",
    url: "/agents",
    icon: HeadphonesIcon,
  },
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
 
];

// Nuevos items para funcionalidades mejoradas
const advancedItems = [
  {
    title: "Gestión Avanzada de Agenda",
    url: "/agenda-management",
    icon: Calendar,
  },
];

export function AppSidebar() {
  const [queueCount, setQueueCount] = useState<number>(0);
  const [transferCount, setTransferCount] = useState<number>(0);
  const location = useLocation();

  // const currentDate = new Date(); // (no usado actualmente)

  // Helper: crea EventSource con token con manejo de errores mejorado
  function subscribe(path: string, onEvent: (ev: MessageEvent) => void) {
    try {
      const token = localStorage.getItem('token') || undefined;
      const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const url = `${base}${path}`;
      const es = new EventSource(url + (token ? `?token=${encodeURIComponent(token)}` : ''));
      
      // Manejar eventos con mejor tolerancia a errores
      es.onmessage = onEvent;
      es.addEventListener('enqueue', onEvent as any);
      es.addEventListener('assign', onEvent as any);
      es.addEventListener('scheduled', onEvent as any);
      es.addEventListener('cancelled', onEvent as any);
      es.addEventListener('created', onEvent as any);
      es.addEventListener('accepted', onEvent as any);
      es.addEventListener('rejected', onEvent as any);
      es.addEventListener('completed', onEvent as any);
      
      // Manejar errores de conexión
      es.onerror = (error) => {
        console.warn(`EventSource error for ${path}:`, error);
        // No relanzar error para evitar spam en consola
      };
      
      return es;
    } catch (error) {
      console.warn(`Failed to create EventSource for ${path}:`, error);
      return null;
    }
  }

  useEffect(() => {
    let esQueue: EventSource | null = null;
    let esTransfers: EventSource | null = null;
    
    const fetchInitial = async () => {
      try {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const token = localStorage.getItem('token') || '';
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Obtener overview de queue con manejo de errores
        try {
          const ovRes = await fetch(`${base}/queue/overview`, { headers });
          if (ovRes.ok) {
            const ov = await ovRes.json();
            setQueueCount(Number(ov?.waiting || 0));
          }
        } catch (error) {
          console.warn('Error fetching queue overview:', error);
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

    const onQueue = (ev: MessageEvent) => {
      try {
        // naive: recompute based on event type
        if (ev.type === 'enqueue') setQueueCount((c) => c + 1);
        if (ev.type === 'scheduled' || ev.type === 'cancelled' || ev.type === 'assign') setQueueCount((c) => Math.max(0, c - 1));
      } catch (error) {
        console.warn('Error handling queue event:', error);
      }
    };
    
    const onTransfers = (ev: MessageEvent) => {
      try {
        if (ev.type === 'created') setTransferCount((c) => c + 1);
        if (ev.type === 'accepted' || ev.type === 'rejected' || ev.type === 'completed') setTransferCount((c) => Math.max(0, c - 1));
      } catch (error) {
        console.warn('Error handling transfers event:', error);
      }
    };
    
    esQueue = subscribe('/queue/stream', onQueue);
    esTransfers = subscribe('/transfers/stream', onTransfers);
    
    return () => {
      esQueue?.close();
      esTransfers?.close();
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-medical-700 font-semibold">
            Herramientas Avanzadas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {advancedItems.map((item) => (
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
