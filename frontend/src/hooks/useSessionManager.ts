/**
 * Hook para gestión de sesión con auto-logout por inactividad
 * - Envía heartbeat cada minuto para tracking de actividad
 * - Cierra sesión después de 5 minutos de inactividad
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { clearAdminSession, getAdminToken } from '@/lib/authStorage';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const HEARTBEAT_INTERVAL = 60 * 1000; // 1 minuto
const WARNING_BEFORE_LOGOUT = 60 * 1000; // Advertir 1 minuto antes

export function useSessionManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(() => {
    clearAdminSession();
    navigate('/admin/login', { replace: true });
    toast({
      title: 'Sesión cerrada',
      description: 'Su sesión ha expirado por inactividad',
      variant: 'destructive',
    });
  }, [navigate, toast]);

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
  }, []);

  const sendHeartbeat = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;

    try {
      const response = await fetch('/api/audit/heartbeat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'session_closed') {
          handleLogout();
        }
      }
    } catch (error) {
      console.error('Error enviando heartbeat:', error);
    }
  }, [handleLogout]);

  const checkSessionValidity = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;

    try {
      const response = await fetch('/api/audit/session-check', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (!data.valid) {
        handleLogout();
      }
    } catch (error) {
      console.error('Error verificando sesión:', error);
    }
  }, [handleLogout]);

  const checkInactivity = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    const timeUntilLogout = INACTIVITY_TIMEOUT - timeSinceLastActivity;

    // Mostrar advertencia 1 minuto antes
    if (timeUntilLogout <= WARNING_BEFORE_LOGOUT && timeUntilLogout > 0 && !warningShownRef.current) {
      warningShownRef.current = true;
      toast({
        title: '⚠️ Sesión por expirar',
        description: 'Su sesión expirará en 1 minuto por inactividad. Mueva el mouse o presione una tecla.',
        duration: 10000,
      });
    }

    // Cerrar sesión por inactividad
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      handleLogout();
    }
  }, [handleLogout, toast]);

  useEffect(() => {
    // Registrar eventos de actividad del usuario
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Iniciar heartbeat
    sendHeartbeat(); // Enviar inmediatamente
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Verificar inactividad cada 30 segundos
    inactivityCheckRef.current = setInterval(checkInactivity, 30000);

    // Verificar validez de sesión cada 2 minutos
    const sessionCheckInterval = setInterval(checkSessionValidity, 2 * 60 * 1000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
      }
      clearInterval(sessionCheckInterval);
    };
  }, [updateActivity, sendHeartbeat, checkInactivity, checkSessionValidity]);

  return {
    updateActivity,
    sendHeartbeat,
  };
}

export default useSessionManager;
