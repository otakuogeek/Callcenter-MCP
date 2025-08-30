
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const NotificationsTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({
    notifications_email_enabled: true,
    notifications_email: "",
    alert_long_queue_enabled: true,
    alert_agents_offline_enabled: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getSettings();
        if (!cancelled && data) {
          setState({
            notifications_email_enabled: !!data.notifications_email_enabled,
            notifications_email: data.notifications_email || "",
            alert_long_queue_enabled: !!data.alert_long_queue_enabled,
            alert_agents_offline_enabled: !!data.alert_agents_offline_enabled,
          });
        }
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "No se pudo cargar la configuración", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  async function save() {
    try {
      const saved = await api.updateSettings(state);
      setState({
        notifications_email_enabled: !!saved.notifications_email_enabled,
        notifications_email: saved.notifications_email || "",
        alert_long_queue_enabled: !!saved.alert_long_queue_enabled,
        alert_agents_offline_enabled: !!saved.alert_agents_offline_enabled,
      });
      toast({ title: "Guardado", description: "Configuración actualizada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo guardar la configuración", variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Notificaciones</CardTitle>
        <CardDescription>Personaliza las alertas y notificaciones</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificaciones por Email</Label>
              <p className="text-sm text-gray-600">Recibir alertas importantes por correo</p>
            </div>
            <Switch checked={state.notifications_email_enabled} onCheckedChange={(v) => setState(s => ({ ...s, notifications_email_enabled: v }))} disabled={loading} />
          </div>
          <div>
            <Label htmlFor="notification-email">Correo para Notificaciones</Label>
            <Input 
              id="notification-email" 
              type="email" 
              placeholder="admin@valeriacentromedico.com"
              value={state.notifications_email}
              onChange={(e) => setState(s => ({ ...s, notifications_email: e.target.value }))}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Alertas de Cola Larga</Label>
              <p className="text-sm text-gray-600">Notificar cuando hay muchas llamadas en espera</p>
            </div>
            <Switch checked={state.alert_long_queue_enabled} onCheckedChange={(v) => setState(s => ({ ...s, alert_long_queue_enabled: v }))} disabled={loading} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Alertas de Agentes Offline</Label>
              <p className="text-sm text-gray-600">Notificar cuando un agente se desconecta</p>
            </div>
            <Switch checked={state.alert_agents_offline_enabled} onCheckedChange={(v) => setState(s => ({ ...s, alert_agents_offline_enabled: v }))} disabled={loading} />
          </div>
          <Button onClick={save} disabled={loading}>Guardar Configuración</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationsTab;
