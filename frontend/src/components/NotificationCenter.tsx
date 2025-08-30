// ==============================================
// COMPONENTE DE NOTIFICACIONES
// ==============================================

import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Settings, X, AlertCircle, Info, CheckCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  user_type: 'patient' | 'doctor' | 'user';
}

interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  appointment_reminders: boolean;
  system_alerts: boolean;
  marketing_communications: boolean;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_notifications: true,
    push_notifications: true,
    appointment_reminders: true,
    system_alerts: true,
    marketing_communications: false,
  });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Cargar notificaciones
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.notifications.getMyNotifications(1, 20);
      if (response.success) {
        setNotifications(response.data);
        setUnreadCount(response.data.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar preferencias
  const loadPreferences = async () => {
    try {
      const response = await api.notifications.getPreferences();
      if (response.success) {
        setPreferences(response.data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  // Marcar como leída
  const markAsRead = async (id: number) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => prev - 1);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast({
        title: "Notificaciones marcadas",
        description: "Todas las notificaciones han sido marcadas como leídas",
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: "Error",
        description: "No se pudieron marcar las notificaciones como leídas",
        variant: "destructive",
      });
    }
  };

  // Actualizar preferencias
  const updatePreferences = async (newPreferences: NotificationPreferences) => {
    try {
      await api.notifications.updatePreferences(newPreferences);
      setPreferences(newPreferences);
      toast({
        title: "Preferencias actualizadas",
        description: "Tus preferencias de notificación han sido guardadas",
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: "Error",
        description: "No se pudieron actualizar las preferencias",
        variant: "destructive",
      });
    }
  };

  // Obtener icono según el tipo
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment':
      case 'reminder':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'alert':
      case 'emergency':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'success':
      case 'welcome':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `Hace ${Math.floor(diffInMinutes / 60)}h`;
    if (diffInMinutes < 10080) return `Hace ${Math.floor(diffInMinutes / 1440)}d`;
    
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  useEffect(() => {
    loadNotifications();
    loadPreferences();
    
    // Recargar notificaciones cada 30 segundos
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Icono de notificaciones en la barra superior */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Notificaciones</h4>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={markAllAsRead}
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Preferencias de Notificación</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="email">Notificaciones por email</Label>
                        <Switch 
                          id="email"
                          checked={preferences.email_notifications}
                          onCheckedChange={(checked) => 
                            updatePreferences({ ...preferences, email_notifications: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="push">Notificaciones push</Label>
                        <Switch 
                          id="push"
                          checked={preferences.push_notifications}
                          onCheckedChange={(checked) => 
                            updatePreferences({ ...preferences, push_notifications: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="reminders">Recordatorios de citas</Label>
                        <Switch 
                          id="reminders"
                          checked={preferences.appointment_reminders}
                          onCheckedChange={(checked) => 
                            updatePreferences({ ...preferences, appointment_reminders: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="alerts">Alertas del sistema</Label>
                        <Switch 
                          id="alerts"
                          checked={preferences.system_alerts}
                          onCheckedChange={(checked) => 
                            updatePreferences({ ...preferences, system_alerts: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="marketing">Comunicaciones de marketing</Label>
                        <Switch 
                          id="marketing"
                          checked={preferences.marketing_communications}
                          onCheckedChange={(checked) => 
                            updatePreferences({ ...preferences, marketing_communications: checked })
                          }
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
          
          <ScrollArea className="h-80">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Cargando notificaciones...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No tienes notificaciones
              </div>
            ) : (
              <div className="space-y-0">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h5 className={`text-sm font-medium ${
                            !notification.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification.title}
                          </h5>
                          {!notification.read && (
                            <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {notifications.length > 0 && (
            <div className="p-2 border-t">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => setIsOpen(false)}
              >
                Ver todas las notificaciones
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

export default NotificationCenter;
