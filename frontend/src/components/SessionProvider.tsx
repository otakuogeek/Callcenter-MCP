/**
 * SessionProvider - Componente que gestiona la sesión de usuario globalmente
 * - Auto-logout por inactividad (5 minutos)
 * - Heartbeat para tracking de actividad
 * - Advertencia antes de expirar
 */

import { useEffect, useRef, useCallback, useState, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { clearAdminSession, getAdminToken } from '@/lib/authStorage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const HEARTBEAT_INTERVAL = 60 * 1000; // 1 minuto
const WARNING_BEFORE_LOGOUT = 60 * 1000; // Advertir 1 minuto antes
const CHECK_INTERVAL = 10 * 1000; // Verificar cada 10 segundos

interface SessionContextType {
  isActive: boolean;
  lastActivity: Date;
  updateActivity: () => void;
  remainingTime: number;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(INACTIVITY_TIMEOUT);
  const [isActive, setIsActive] = useState(true);
  
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // No aplicar en rutas públicas
  const publicRoutes = ['/login', '/admin/login', '/doctor-login', '/portal', '/verify', '/support-panel-login'];
  const isPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route));

  const handleLogout = useCallback(() => {
    setShowWarning(false);
    
    // Obtener token ANTES de borrarlo para registrar el logout
    const token = getAdminToken();
    
    // Registrar logout si hay token
    if (token) {
      fetch('/api/audit/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => {});
    }
    
    // Ahora sí limpiar localStorage
    clearAdminSession();
    
    navigate('/admin/login', { replace: true });
    toast({
      title: 'Sesión cerrada',
      description: 'Su sesión ha expirado por inactividad (5 minutos)',
      variant: 'destructive',
    });
  }, [navigate, toast]);

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingTime(INACTIVITY_TIMEOUT);
  }, []);

  const extendSession = useCallback(() => {
    updateActivity();
    setShowWarning(false);
    toast({
      title: 'Sesión extendida',
      description: 'Su sesión ha sido extendida por 5 minutos más',
    });
  }, [updateActivity, toast]);

  const sendHeartbeat = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      console.log('[SessionProvider] No token, skipping heartbeat');
      return;
    }

    try {
      const response = await fetch('/api/audit/heartbeat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Solo hacer logout si la sesión fue cerrada explícitamente por admin
        // No hacer logout por errores de red o 401 normales
        try {
          const data = await response.json();
          if (data.error === 'session_closed' || data.reason === 'session_closed') {
            console.log('[SessionProvider] Session closed by admin, logging out');
            handleLogout();
          } else {
            console.log('[SessionProvider] Heartbeat failed but not session_closed:', data);
          }
        } catch {
          console.log('[SessionProvider] Heartbeat response not JSON');
        }
      }
    } catch (error) {
      // No hacer logout por errores de red
      console.error('[SessionProvider] Error enviando heartbeat (red):', error);
    }
  }, [handleLogout]);

  const checkInactivity = useCallback(() => {
    const token = getAdminToken();
    if (!token) return;

    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    const timeUntilLogout = INACTIVITY_TIMEOUT - timeSinceLastActivity;

    setRemainingTime(Math.max(0, timeUntilLogout));

    // Mostrar advertencia 1 minuto antes
    if (timeUntilLogout <= WARNING_BEFORE_LOGOUT && timeUntilLogout > 0 && !showWarning) {
      setShowWarning(true);
    }

    // Cerrar sesión por inactividad
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      handleLogout();
    }
  }, [handleLogout, showWarning]);

  useEffect(() => {
    // No ejecutar en rutas públicas
    if (isPublicRoute) return;

    const token = getAdminToken();
    if (!token) return;

    // Registrar eventos de actividad del usuario
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateActivity();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar heartbeat
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Verificar inactividad frecuentemente
    inactivityCheckRef.current = setInterval(checkInactivity, CHECK_INTERVAL);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isPublicRoute, updateActivity, sendHeartbeat, checkInactivity]);

  // Countdown cuando se muestra el warning
  useEffect(() => {
    if (showWarning) {
      countdownRef.current = setInterval(() => {
        setRemainingTime(prev => Math.max(0, prev - 1000));
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [showWarning]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const contextValue: SessionContextType = {
    isActive,
    lastActivity: new Date(lastActivityRef.current),
    updateActivity,
    remainingTime,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
      
      {/* Diálogo de advertencia de inactividad */}
      <AlertDialog open={showWarning && !isPublicRoute}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              ⚠️ Sesión por expirar
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Su sesión expirará en <strong className="text-red-600 text-lg">{formatTime(remainingTime)}</strong> por inactividad.
              </p>
              <p className="text-sm text-gray-500">
                Haga clic en "Continuar" para mantener su sesión activa, o será redirigido al login automáticamente.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleLogout}>
              Cerrar sesión
            </AlertDialogCancel>
            <AlertDialogAction onClick={extendSession}>
              Continuar trabajando
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SessionContext.Provider>
  );
}

export default SessionProvider;
