// ==============================================
// COMPONENTE DE GESTIÓN DE SESIONES
// ==============================================

import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  MapPin, 
  Clock, 
  LogOut, 
  Shield, 
  Activity,
  AlertTriangle,
  RefreshCw,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface UserSession {
  id: string;
  user_id: number;
  ip_address: string;
  user_agent?: string;
  created_at: string;
  last_activity: string;
  expires_at: string;
  is_current?: boolean;
  user_name?: string;
  user_email?: string;
}

export function SessionManager({ isAdmin = false }: { isAdmin?: boolean }) {
  const [mySessions, setMySessions] = useState<UserSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(isAdmin ? 'active' : 'my');
  const { toast } = useToast();

  // Cargar mis sesiones
  const loadMySessions = async () => {
    try {
      setLoading(true);
      const response = await api.sessions.getMySessions();
      if (response.success) {
        setMySessions(response.data);
      }
    } catch (error) {
      console.error('Error loading my sessions:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las sesiones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar sesiones activas (solo admin)
  const loadActiveSessions = async () => {
    if (!isAdmin) return;
    
    try {
      setLoading(true);
      const response = await api.sessions.getActiveSessions();
      if (response.success) {
        setActiveSessions(response.data);
      }
    } catch (error) {
      console.error('Error loading active sessions:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las sesiones activas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Terminar una sesión específica
  const endSession = async (sessionId: string, isMySession = true) => {
    try {
      const response = await api.sessions.endSession(sessionId);
      if (response.success) {
        toast({
          title: "Sesión terminada",
          description: response.message,
        });
        
        if (isMySession) {
          loadMySessions();
        } else {
          loadActiveSessions();
        }
      }
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: "Error",
        description: "No se pudo terminar la sesión",
        variant: "destructive",
      });
    }
  };

  // Terminar todas mis sesiones
  const endAllMySessions = async () => {
    try {
      const response = await api.sessions.endAllSessions(true);
      if (response.success) {
        toast({
          title: "Sesiones terminadas",
          description: response.message,
        });
        loadMySessions();
      }
    } catch (error) {
      console.error('Error ending all sessions:', error);
      toast({
        title: "Error",
        description: "No se pudieron terminar las sesiones",
        variant: "destructive",
      });
    }
  };

  // Forzar cierre de sesiones de un usuario (solo admin)
  const forceEndUserSessions = async (userId: number) => {
    if (!isAdmin) return;
    
    try {
      const response = await api.sessions.forceEndUserSessions(userId);
      if (response.success) {
        toast({
          title: "Sesiones terminadas",
          description: response.message,
        });
        loadActiveSessions();
      }
    } catch (error) {
      console.error('Error forcing end user sessions:', error);
      toast({
        title: "Error",
        description: "No se pudieron terminar las sesiones del usuario",
        variant: "destructive",
      });
    }
  };

  // Obtener icono del dispositivo basado en user agent
  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />;
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />;
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  // Obtener información del navegador
  const getBrowserInfo = (userAgent?: string) => {
    if (!userAgent) return 'Desconocido';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    return 'Otro navegador';
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calcular tiempo desde última actividad
  const getTimeSinceActivity = (dateString: string) => {
    const now = new Date();
    const lastActivity = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Activo ahora';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    if (diffInMinutes < 1440) return `Hace ${Math.floor(diffInMinutes / 60)}h`;
    return `Hace ${Math.floor(diffInMinutes / 1440)}d`;
  };

  // Verificar si la sesión está próxima a expirar
  const isSessionExpiringSoon = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffInHours = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffInHours < 2; // Menos de 2 horas
  };

  useEffect(() => {
    if (activeTab === 'my') {
      loadMySessions();
    } else if (activeTab === 'active' && isAdmin) {
      loadActiveSessions();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    // Recargar datos cada 30 segundos
    const interval = setInterval(() => {
      if (activeTab === 'my') {
        loadMySessions();
      } else if (activeTab === 'active' && isAdmin) {
        loadActiveSessions();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, isAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Gestión de Sesiones</h2>
          <p className="text-muted-foreground">
            Administra las sesiones activas y el acceso a tu cuenta
          </p>
        </div>
        <Button onClick={() => activeTab === 'my' ? loadMySessions() : loadActiveSessions()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my">Mis Sesiones</TabsTrigger>
          {isAdmin && <TabsTrigger value="active">Sesiones Activas</TabsTrigger>}
        </TabsList>

        <TabsContent value="my" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Gestiona todas las sesiones donde has iniciado sesión
            </p>
            {mySessions.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar todas las sesiones
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Cerrar todas las sesiones?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esto cerrará todas tus sesiones excepto la actual. Tendrás que iniciar sesión nuevamente en otros dispositivos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={endAllMySessions}>
                      Cerrar todas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando sesiones...</p>
            </div>
          ) : mySessions.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No hay sesiones activas</h3>
                  <p className="text-muted-foreground">
                    No tienes sesiones activas en este momento
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {mySessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getDeviceIcon(session.user_agent)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{getBrowserInfo(session.user_agent)}</h4>
                            {session.is_current && (
                              <Badge variant="default">Sesión actual</Badge>
                            )}
                            {isSessionExpiringSoon(session.expires_at) && (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Expira pronto
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>{session.ip_address}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Última actividad: {getTimeSinceActivity(session.last_activity)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              <span>Conectado desde: {formatDate(session.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {!session.is_current && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <X className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Cerrar esta sesión?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción cerrará la sesión de forma permanente. El usuario tendrá que iniciar sesión nuevamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => endSession(session.id, true)}>
                                Cerrar sesión
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="active" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Monitorea y administra todas las sesiones activas del sistema
            </p>

            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Cargando sesiones activas...</p>
              </div>
            ) : activeSessions.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No hay sesiones activas</h3>
                    <p className="text-muted-foreground">
                      No hay usuarios conectados en este momento
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <Card key={session.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getDeviceIcon(session.user_agent)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{session.user_name || 'Usuario desconocido'}</h4>
                              <Badge variant="outline">{session.user_email}</Badge>
                              {isSessionExpiringSoon(session.expires_at) && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Expira pronto
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Monitor className="h-3 w-3" />
                                <span>{getBrowserInfo(session.user_agent)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span>{session.ip_address}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>Última actividad: {getTimeSinceActivity(session.last_activity)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                <span>Conectado desde: {formatDate(session.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <X className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Cerrar esta sesión?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción cerrará la sesión de {session.user_name}. El usuario tendrá que iniciar sesión nuevamente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => endSession(session.id, false)}>
                                  Cerrar sesión
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <LogOut className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Cerrar todas las sesiones del usuario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción cerrará todas las sesiones de {session.user_name}. El usuario tendrá que iniciar sesión nuevamente en todos sus dispositivos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => forceEndUserSessions(session.user_id)}>
                                  Cerrar todas
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default SessionManager;
