
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const AITab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getSettings();
        setState(s || {});
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "No se pudo cargar la configuración", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const save = async (patch: any) => {
    if (isSaving) return; // evita múltiples envíos concurrentes
    try {
      setIsSaving(true);
      const saved = await api.updateSettings(patch);
      setState(saved);
      toast({ title: "Guardado", description: "Configuración de IA actualizada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const parseTime = (t?: string | null) => {
    if (!t) return null;
    const [hh, mm] = t.split(":");
    const h = Number(hh);
    const m = Number(mm);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const validateAll = (): string | null => {
    const timeout = Number(state.ai_response_timeout_seconds || 0);
    if (timeout < 1 || timeout > 120) return "El tiempo de respuesta debe estar entre 1 y 120 segundos";
    const s = parseTime(state.ai_start_time);
    const e = parseTime(state.ai_end_time);
    if (s !== null && e !== null && s >= e) return "La hora de inicio debe ser menor a la hora de fin";
    const bs = parseTime(state.ai_break_start);
    const be = parseTime(state.ai_break_end);
    if (bs !== null && be !== null && bs >= be) return "El inicio del descanso debe ser menor al fin del descanso";
    if (s !== null && e !== null) {
      if (bs !== null && (bs < s || bs > e)) return "El descanso debe estar dentro del horario activo";
      if (be !== null && (be < s || be > e)) return "El descanso debe estar dentro del horario activo";
    }
    return null;
  };

  const saveAll = async () => {
    const err = validateAll();
    if (err) {
      toast({ title: "Validación", description: err, variant: "destructive" });
      return;
    }
  await save({
      ai_enabled: !!state.ai_enabled,
      ai_auto_answer: !!state.ai_auto_answer,
      ai_response_timeout_seconds: Number(state.ai_response_timeout_seconds || 3),
      ai_start_time: state.ai_start_time || null,
      ai_end_time: state.ai_end_time || null,
      ai_mon: !!state.ai_mon,
      ai_tue: !!state.ai_tue,
      ai_wed: !!state.ai_wed,
      ai_thu: !!state.ai_thu,
      ai_fri: !!state.ai_fri,
      ai_sat: !!state.ai_sat,
      ai_sun: !!state.ai_sun,
      ai_pause_holidays: !!state.ai_pause_holidays,
      ai_vacation_mode: !!state.ai_vacation_mode,
      ai_break_start: state.ai_break_start || null,
      ai_break_end: state.ai_break_end || null,
      ai_message_welcome: state.ai_message_welcome || null,
      ai_message_offline: state.ai_message_offline || null,
      ai_message_transfer: state.ai_message_transfer || null,
    });
  };

  if (loading) return <div className="text-sm text-gray-500">Cargando configuración…</div>;

  const disabled = !state.ai_enabled;

  // Validaciones por campo
  const validateTimeoutField = () => {
    const timeout = Number(state.ai_response_timeout_seconds || 0);
    const msg = timeout < 1 || timeout > 120 ? "Debe estar entre 1 y 120" : null;
    setErrors((e) => ({ ...e, ai_response_timeout_seconds: msg }));
    return !msg;
  };
  const validateStartEndFields = () => {
    const s = parseTime(state.ai_start_time);
    const e = parseTime(state.ai_end_time);
    const msg = s !== null && e !== null && s >= e ? "Inicio debe ser menor que fin" : null;
    setErrors((er) => ({ ...er, ai_end_time: msg }));
    return !msg;
  };
  const validateBreakFields = () => {
    const s = parseTime(state.ai_start_time);
    const e = parseTime(state.ai_end_time);
    const bs = parseTime(state.ai_break_start);
    const be = parseTime(state.ai_break_end);
    let msgStart: string | null = null;
    let msgEnd: string | null = null;
    if (bs !== null && be !== null && bs >= be) {
      msgStart = "Debe ser menor que fin";
      msgEnd = "Debe ser mayor que inicio";
    }
    if (s !== null && e !== null) {
      if (bs !== null && (bs < s || bs > e)) msgStart = "Fuera del horario activo";
      if (be !== null && (be < s || be > e)) msgEnd = "Fuera del horario activo";
    }
    setErrors((er) => ({ ...er, ai_break_start: msgStart, ai_break_end: msgEnd }));
    return !msgStart && !msgEnd;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de IA</CardTitle>
          <CardDescription>Configurar el asistente virtual para llamadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>IA Activa</Label>
              <p className="text-sm text-gray-600">Habilitar asistente virtual para llamadas</p>
            </div>
            <Switch checked={!!state.ai_enabled} onCheckedChange={(v) => save({ ai_enabled: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Respuesta Automática</Label>
              <p className="text-sm text-gray-600">La IA contesta automáticamente las llamadas</p>
            </div>
            <Switch disabled={disabled} checked={!!state.ai_auto_answer} onCheckedChange={(v) => save({ ai_auto_answer: v })} />
          </div>
          <div>
            <Label htmlFor="ai-timeout">Tiempo de Respuesta (segundos)</Label>
            <Input
              disabled={disabled}
              id="ai-timeout"
              type="number"
              min="1"
              max="120"
              value={state.ai_response_timeout_seconds ?? 3}
              onChange={(e) => {
                setState({ ...state, ai_response_timeout_seconds: Number(e.target.value) });
                setErrors((er) => ({ ...er, ai_response_timeout_seconds: null }));
              }}
              onBlur={() => {
                if (validateTimeoutField()) {
                  save({ ai_response_timeout_seconds: Number(state.ai_response_timeout_seconds || 3) });
                }
              }}
              className={errors.ai_response_timeout_seconds ? "border-red-500" : undefined}
            />
            {errors.ai_response_timeout_seconds && (
              <p className="text-xs text-red-500 mt-1">{errors.ai_response_timeout_seconds}</p>
            )}
          </div>
          <div className="pt-2">
            <Button variant="secondary" onClick={saveAll} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</> : "Guardar todo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horarios de Actividad</CardTitle>
          <CardDescription>Define cuándo la IA debe estar activa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="start-time">Hora de Inicio</Label>
            <Input
              disabled={disabled}
              id="start-time"
              type="time"
              value={state.ai_start_time || ""}
              onChange={(e) => {
                setState({ ...state, ai_start_time: e.target.value });
                setErrors((er) => ({ ...er, ai_end_time: null }));
              }}
              onBlur={() => {
                if (validateStartEndFields()) save({ ai_start_time: state.ai_start_time || null });
              }}
              className={errors.ai_end_time ? "border-red-500" : undefined}
            />
          </div>
          <div>
            <Label htmlFor="end-time">Hora de Fin</Label>
            <Input
              disabled={disabled}
              id="end-time"
              type="time"
              value={state.ai_end_time || ""}
              onChange={(e) => {
                setState({ ...state, ai_end_time: e.target.value });
                setErrors((er) => ({ ...er, ai_end_time: null }));
              }}
              onBlur={() => {
                if (validateStartEndFields()) save({ ai_end_time: state.ai_end_time || null });
              }}
              className={errors.ai_end_time ? "border-red-500" : undefined}
            />
            {errors.ai_end_time && <p className="text-xs text-red-500 mt-1">{errors.ai_end_time}</p>}
          </div>
          <div className="space-y-2">
            <Label>Días Activos</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
        <Switch disabled={disabled} id="monday" checked={!!state.ai_mon} onCheckedChange={(v) => save({ ai_mon: v })} />
                <Label htmlFor="monday">Lunes</Label>
              </div>
              <div className="flex items-center space-x-2">
        <Switch disabled={disabled} id="tuesday" checked={!!state.ai_tue} onCheckedChange={(v) => save({ ai_tue: v })} />
                <Label htmlFor="tuesday">Martes</Label>
              </div>
              <div className="flex items-center space-x-2">
        <Switch disabled={disabled} id="wednesday" checked={!!state.ai_wed} onCheckedChange={(v) => save({ ai_wed: v })} />
                <Label htmlFor="wednesday">Miércoles</Label>
              </div>
              <div className="flex items-center space-x-2">
        <Switch disabled={disabled} id="thursday" checked={!!state.ai_thu} onCheckedChange={(v) => save({ ai_thu: v })} />
                <Label htmlFor="thursday">Jueves</Label>
              </div>
              <div className="flex items-center space-x-2">
        <Switch disabled={disabled} id="friday" checked={!!state.ai_fri} onCheckedChange={(v) => save({ ai_fri: v })} />
                <Label htmlFor="friday">Viernes</Label>
              </div>
              <div className="flex items-center space-x-2">
        <Switch disabled={disabled} id="saturday" checked={!!state.ai_sat} onCheckedChange={(v) => save({ ai_sat: v })} />
                <Label htmlFor="saturday">Sábado</Label>
              </div>
              <div className="flex items-center space-x-2">
        <Switch disabled={disabled} id="sunday" checked={!!state.ai_sun} onCheckedChange={(v) => save({ ai_sun: v })} />
                <Label htmlFor="sunday">Domingo</Label>
              </div>
            </div>
          </div>
          <Button disabled={disabled || isSaving} onClick={() => save({
            ai_start_time: state.ai_start_time || null,
            ai_end_time: state.ai_end_time || null,
            ai_mon: !!state.ai_mon,
            ai_tue: !!state.ai_tue,
            ai_wed: !!state.ai_wed,
            ai_thu: !!state.ai_thu,
            ai_fri: !!state.ai_fri,
            ai_sat: !!state.ai_sat,
            ai_sun: !!state.ai_sun,
          })}>
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</> : "Guardar Horarios"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restricciones Especiales</CardTitle>
          <CardDescription>Configurar días y horarios especiales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Pausar en Festivos</Label>
              <p className="text-sm text-gray-600">Desactivar IA en días festivos</p>
            </div>
            <Switch disabled={disabled} checked={!!state.ai_pause_holidays} onCheckedChange={(v) => save({ ai_pause_holidays: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Modo Vacaciones</Label>
              <p className="text-sm text-gray-600">Activar mensaje especial en vacaciones</p>
            </div>
            <Switch disabled={disabled} checked={!!state.ai_vacation_mode} onCheckedChange={(v) => save({ ai_vacation_mode: v })} />
          </div>
          <div>
            <Label htmlFor="break-start">Inicio de Descanso</Label>
            <Input
              disabled={disabled}
              id="break-start"
              type="time"
              value={state.ai_break_start || ""}
              onChange={(e) => {
                setState({ ...state, ai_break_start: e.target.value });
                setErrors((er) => ({ ...er, ai_break_start: null, ai_break_end: null }));
              }}
              onBlur={() => {
                if (validateBreakFields()) save({ ai_break_start: state.ai_break_start || null });
              }}
              className={errors.ai_break_start ? "border-red-500" : undefined}
            />
            {errors.ai_break_start && <p className="text-xs text-red-500 mt-1">{errors.ai_break_start}</p>}
          </div>
          <div>
            <Label htmlFor="break-end">Fin de Descanso</Label>
            <Input
              disabled={disabled}
              id="break-end"
              type="time"
              value={state.ai_break_end || ""}
              onChange={(e) => {
                setState({ ...state, ai_break_end: e.target.value });
                setErrors((er) => ({ ...er, ai_break_start: null, ai_break_end: null }));
              }}
              onBlur={() => {
                if (validateBreakFields()) save({ ai_break_end: state.ai_break_end || null });
              }}
              className={errors.ai_break_end ? "border-red-500" : undefined}
            />
            {errors.ai_break_end && <p className="text-xs text-red-500 mt-1">{errors.ai_break_end}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensajes Personalizados</CardTitle>
          <CardDescription>Configurar mensajes para diferentes situaciones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="welcome-message">Mensaje de Bienvenida</Label>
            <Input disabled={disabled} id="welcome-message" value={state.ai_message_welcome || ""} onChange={(e) => setState({ ...state, ai_message_welcome: e.target.value })} onBlur={() => save({ ai_message_welcome: state.ai_message_welcome || null })} className="h-10" />
          </div>
          <div>
            <Label htmlFor="offline-message">Mensaje Fuera de Horario</Label>
            <Input disabled={disabled} id="offline-message" value={state.ai_message_offline || ""} onChange={(e) => setState({ ...state, ai_message_offline: e.target.value })} onBlur={() => save({ ai_message_offline: state.ai_message_offline || null })} className="h-10" />
          </div>
          <div>
            <Label htmlFor="transfer-message">Mensaje de Transferencia</Label>
            <Input disabled={disabled} id="transfer-message" value={state.ai_message_transfer || ""} onChange={(e) => setState({ ...state, ai_message_transfer: e.target.value })} onBlur={() => save({ ai_message_transfer: state.ai_message_transfer || null })} className="h-10" />
          </div>
          <Button disabled={disabled || isSaving} onClick={() => save({
            ai_message_welcome: state.ai_message_welcome || null,
            ai_message_offline: state.ai_message_offline || null,
            ai_message_transfer: state.ai_message_transfer || null,
          })}>
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</> : "Guardar Mensajes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AITab;
