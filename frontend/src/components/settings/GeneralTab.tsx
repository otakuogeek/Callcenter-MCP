import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GeneralTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [state, setState] = useState({
    org_name: "",
    org_address: "",
    org_phone: "",
  org_nit: "",
  org_logo_url: "",
  org_timezone: "America/Bogota",
    cc_call_recording_enabled: true,
    cc_auto_distribution_enabled: true,
    cc_max_wait_minutes: 15,
  // Automatizaciones de agenda
  auto_cancel_without_confirmation: false,
  auto_cancel_also_appointments_default: true,
  });
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, tzs] = await Promise.all([
          api.getSettings(),
          api.fetchTimezones()
        ]);
        setState({
          org_name: s?.org_name || "",
          org_address: s?.org_address || "",
          org_phone: s?.org_phone || "",
          org_nit: s?.org_nit || "",
          org_logo_url: s?.org_logo_url || "",
          org_timezone: s?.org_timezone || "America/Bogota",
          cc_call_recording_enabled: !!s?.cc_call_recording_enabled,
          cc_auto_distribution_enabled: !!s?.cc_auto_distribution_enabled,
          cc_max_wait_minutes: s?.cc_max_wait_minutes ?? 15,
          auto_cancel_without_confirmation: !!s?.auto_cancel_without_confirmation,
          auto_cancel_also_appointments_default: s?.auto_cancel_also_appointments_default ?? true,
        });
        setTimezones(tzs);
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "No se pudo cargar la configuración", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const save = async () => {
    if (isSaving) return;
    if (!state.org_name.trim()) return toast({ title: "Validación", description: "El nombre de la IPS es requerido", variant: "destructive" });
    if (state.cc_max_wait_minutes < 1 || state.cc_max_wait_minutes > 240) return toast({ title: "Validación", description: "Tiempo máximo de espera entre 1 y 240", variant: "destructive" });
    if (state.org_logo_url && !(/^https?:\/\//i.test(state.org_logo_url) || state.org_logo_url.startsWith('/'))) {
      return toast({ title: "Validación", description: "El logo debe ser URL http/https o ruta local (/uploads/…)", variant: "destructive" });
    }
    try {
      setIsSaving(true);
      const payload = {
        ...state,
        org_address: state.org_address.trim() || null,
        org_phone: state.org_phone.trim() || null,
        org_nit: state.org_nit.trim() || null,
        org_logo_url: state.org_logo_url.trim() ? state.org_logo_url.trim() : null,
        org_timezone: state.org_timezone.trim() || "America/Bogota",
      };
      const saved = await api.updateSettings(payload);
      setState({
        org_name: saved?.org_name || "",
        org_address: saved?.org_address || "",
        org_phone: saved?.org_phone || "",
    org_nit: saved?.org_nit || "",
    org_logo_url: saved?.org_logo_url || "",
    org_timezone: saved?.org_timezone || "America/Bogota",
        cc_call_recording_enabled: !!saved?.cc_call_recording_enabled,
        cc_auto_distribution_enabled: !!saved?.cc_auto_distribution_enabled,
        cc_max_wait_minutes: saved?.cc_max_wait_minutes ?? 15,
  auto_cancel_without_confirmation: !!saved?.auto_cancel_without_confirmation,
  auto_cancel_also_appointments_default: saved?.auto_cancel_also_appointments_default ?? true,
      });
      toast({ title: "Guardado", description: "Configuración actualizada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Cargando configuración…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la IPS</CardTitle>
          <CardDescription>Datos básicos de la institución</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ips-name">Nombre de la IPS</Label>
            <Input id="ips-name" value={state.org_name} onChange={(e) => setState(s => ({ ...s, org_name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="ips-address">Dirección Principal</Label>
            <Input id="ips-address" value={state.org_address} onChange={(e) => setState(s => ({ ...s, org_address: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="ips-phone">Teléfono Principal</Label>
            <Input id="ips-phone" value={state.org_phone} onChange={(e) => setState(s => ({ ...s, org_phone: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="ips-nit">NIT</Label>
            <Input id="ips-nit" value={state.org_nit} onChange={(e) => setState(s => ({ ...s, org_nit: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="ips-logo">Logo (URL)
            </Label>
            <Input id="ips-logo" placeholder="https://..." value={state.org_logo_url} onChange={(e) => setState(s => ({ ...s, org_logo_url: e.target.value }))} />
            <div className="mt-2 flex items-center gap-2">
              <Input id="ips-logo-file" type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setIsUploading(true);
                  const { url } = await api.uploadImage(file);
                  setState(s => ({ ...s, org_logo_url: url }));
                  toast({ title: "Logo subido", description: "Se actualizó la URL del logo" });
                } catch (err: any) {
                  toast({ title: "Error", description: err.message || 'No se pudo subir el logo', variant: 'destructive' });
                } finally {
                  setIsUploading(false);
                }
              }} />
              {isUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div>
            <Label htmlFor="ips-tz">Zona horaria</Label>
            <Select value={state.org_timezone} onValueChange={(v) => setState(s => ({ ...s, org_timezone: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una zona horaria" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map(tz => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Sugeridas: America/Bogota, America/Lima, UTC</p>
          </div>
          <Button onClick={save} disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</> : "Guardar Cambios"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Call Center</CardTitle>
          <CardDescription>Parámetros operativos del sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Grabación de Llamadas</Label>
              <p className="text-sm text-gray-600">Grabar todas las llamadas automáticamente</p>
            </div>
            <Switch checked={state.cc_call_recording_enabled} onCheckedChange={(v) => setState(s => ({ ...s, cc_call_recording_enabled: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Distribución Automática</Label>
              <p className="text-sm text-gray-600">Asignar llamadas automáticamente a agentes</p>
            </div>
            <Switch checked={state.cc_auto_distribution_enabled} onCheckedChange={(v) => setState(s => ({ ...s, cc_auto_distribution_enabled: v }))} />
          </div>
          <div>
            <Label htmlFor="max-wait">Tiempo Máximo de Espera (minutos)</Label>
            <Input id="max-wait" type="number" value={state.cc_max_wait_minutes} onChange={(e) => setState(s => ({ ...s, cc_max_wait_minutes: Number(e.target.value) }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatización de Agenda</CardTitle>
          <CardDescription>Controla cómo se cancelan las agendas vencidas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-cancelar sin confirmación</Label>
              <p className="text-sm text-gray-600">Cuando una agenda esté vencida, cancelarla automáticamente sin mostrar diálogo. Se mantendrá un registro.</p>
            </div>
            <Switch checked={state.auto_cancel_without_confirmation} onCheckedChange={(v) => setState(s => ({ ...s, auto_cancel_without_confirmation: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>También cancelar citas asociadas (por defecto)</Label>
              <p className="text-sm text-gray-600">Si está activo, al auto-cancelar agendas se cancelarán también sus citas, salvo que se cambie en el diálogo.</p>
            </div>
            <Switch checked={state.auto_cancel_also_appointments_default} onCheckedChange={(v) => setState(s => ({ ...s, auto_cancel_also_appointments_default: v }))} />
          </div>
          <Button onClick={save} disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</> : "Guardar Cambios"}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default GeneralTab;
