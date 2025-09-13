import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, Phone, AlertCircle, CalendarPlus, Bot } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import AISchedulingModal from "@/components/AISchedulingModal";

const Queue = () => {
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedQueueEntryId, setSelectedQueueEntryId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<number | null>(null);

  const [overview, setOverview] = useState<{ waiting: number; avg_wait_hm?: string; max_wait_hm?: string; avg_wait_seconds?: number; max_wait_seconds?: number; agents_available: number } | null>(null);
  const [grouped, setGrouped] = useState<Array<{ specialty_id: number; specialty_name: string; count: number; items: Array<{ id: number; position: number; priority: 'Alta'|'Normal'|'Baja'; wait_seconds: number; patient: { id: number; name: string; phone?: string } }> }>>([]);
  const [specialties, setSpecialties] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fmtHM = (s?: number) => {
    if (s == null) return "00:00";
    const m = Math.floor(s / 60); const ss = s % 60; return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  const refresh = async () => {
    try {
      setError(null);
      const [ov, grp, specs] = await Promise.all([
        api.getQueueOverview(),
        api.getQueueGrouped(),
        api.getSpecialties(),
      ]);
      setOverview(ov);
      setGrouped(grp);
      setSpecialties((specs || []).map((s: any) => ({ id: s.id, name: s.name }))); 
    } catch (e: any) {
      setError(e?.message || 'Error cargando cola');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Suscripción SSE con retry/backoff + fallback polling
    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const token = localStorage.getItem('token') || undefined;
    const url = `${base}/queue/stream` + (token ? `?token=${encodeURIComponent(token)}` : '');
    let es: EventSource | null = null;
    let attempts = 0;
    let closed = false;
    let fallbackInterval: any = null;

    const startFallback = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(()=>{ refresh(); }, 10000);
      refresh();
    };
    const stopFallback = () => { if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval=null; } };
    const onAny = () => { refresh(); };
    const connect = () => {
      if (closed) return;
      try {
        es = new EventSource(url);
        es.onopen = () => { attempts = 0; stopFallback(); };
        ['enqueue','assign','scheduled','cancelled'].forEach(ev => es!.addEventListener(ev, onAny as any));
        es.onerror = () => {
          try { es?.close(); } catch {}
          es = null; attempts += 1;
          if (attempts >= 3) startFallback();
          const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
            if (!closed) setTimeout(connect, delay);
        };
      } catch {
        attempts += 1;
        if (attempts >= 3) startFallback();
        const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
        if (!closed) setTimeout(connect, delay);
      }
    };
    connect();
    return () => { closed = true; try { es?.close(); } catch {}; stopFallback(); };
  }, []);

  // Adaptar grupos a estructura de UI
  const sections = useMemo(() => {
    // Mapa por specialty_id desde el backend agrupado
    const map = new Map<number, any[]>();
    for (const g of grouped) {
      const items = g.items.map((it, idx) => ({
        id: it.id,
        patient: it.patient.name,
        patient_id: it.patient.id,
        waitTime: fmtHM(it.wait_seconds),
        type: 'Esperando',
        priority: it.priority,
        phone: it.patient.phone || '',
        specialty: g.specialty_name,
        specialty_id: g.specialty_id,
        position: it.position ?? (idx + 1),
      }));
      map.set(g.specialty_id, items);
    }
    // Construir una sección por cada especialidad existente
    const arr = specialties
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        specialty_id: s.id,
        specialty_name: s.name,
        items: map.get(s.id) || [],
      }));
    return arr;
  }, [grouped, specialties]);

  const [loadingSpecialtyId, setLoadingSpecialtyId] = useState<number | null>(null);
  const handleScheduleSpecialty = async (specialty_id: number, specialty_name: string) => {
    setLoadingSpecialtyId(specialty_id);
    setMessage(null);
    try {
      const next: any = await api.nextInQueue(specialty_id);
      if (next && next.id) {
        await api.scheduleFromQueue(next.id, { outcome: 'Cita agendada' });
        setMessage(`Agendada 1 persona de ${specialty_name}`);
        await refresh();
      } else {
        setMessage(`No hay personas en espera para ${specialty_name}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Error agendando');
    } finally {
      setLoadingSpecialtyId(null);
    }
  };

  const handleScheduleIndividual = async (item: any) => {
    // item.id es el id de la entrada en cola
    setLoadingItemId(item.id);
    setMessage(null);
  // Abrir modal para crear cita real
  setSelectedPatient({ 
    id: item.patient_id, 
    patient: item.patient, 
    phone: item.phone, 
    specialty: item.specialty, 
    priority: item.priority, 
    waitTime: item.waitTime, 
    type: item.type,
  });
  setSelectedSpecialty(item.specialty);
  setSelectedQueueEntryId(item.id);
  setSelectedPatientId(item.patient_id);
  setSelectedSpecialtyId(item.specialty_id);
  setIsScheduleModalOpen(true);
  };

  const getSpecialtyIcon = (specialty: string) => {
    switch (specialty.toLowerCase()) {
      case "medicina general": return "🩺";
      case "cardiología": return "❤️";
      case "pediatría": return "👶";
      case "dermatología": return "🔬";
      default: return "🏥";
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-medical-800 mb-2">Cola de Espera</h1>
              <p className="text-medical-600">Gestión de llamadas en espera organizadas por especialidad</p>
              {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              {message && <p className="text-green-700 text-sm mt-2">{message}</p>}
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-medical-600" />
                    <div>
                      <p className="text-sm text-gray-600">En Espera</p>
                      <p className="text-2xl font-bold text-medical-800">{overview?.waiting ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-warning-600" />
                    <div>
                      <p className="text-sm text-gray-600">Tiempo Promedio</p>
                      <p className="text-2xl font-bold text-warning-700">{overview?.avg_wait_hm ?? fmtHM(overview?.avg_wait_seconds)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-danger-600" />
                    <div>
                      <p className="text-sm text-gray-600">Mayor Espera</p>
                      <p className="text-2xl font-bold text-danger-700">{overview?.max_wait_hm ?? fmtHM(overview?.max_wait_seconds)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-success-600" />
                    <div>
                      <p className="text-sm text-gray-600">Agentes Disponibles</p>
                      <p className="text-2xl font-bold text-success-700">{overview?.agents_available ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Especialidades */}
            <div className="space-y-6">
              {sections.map((section) => (
                <Card key={section.specialty_id} className="border-medical-200">
                  <CardHeader className="bg-gradient-to-r from-medical-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getSpecialtyIcon(section.specialty_name)}</span>
                        <div>
                          <CardTitle className="text-xl text-medical-800">{section.specialty_name}</CardTitle>
                          <CardDescription>
                            {section.items.length} pacientes en espera
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleScheduleSpecialty(section.specialty_id, section.specialty_name)}
                        className="bg-medical-600 hover:bg-medical-700"
                        disabled={loading || loadingSpecialtyId === section.specialty_id}
                      >
                        <Bot className="w-4 h-4 mr-2" />
                        {loadingSpecialtyId === section.specialty_id ? 'Agendando...' : 'Agendar Especialidad'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {section.items.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-medical-50">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-medical-100 rounded-full flex items-center justify-center text-medical-700 font-semibold">
                              {section.items[index]?.position ?? index + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{item.patient}</span>
                                <Badge 
                                  variant={item.priority === "Alta" ? "destructive" : item.priority === "Normal" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {item.priority}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-2">
                                <Phone className="w-3 h-3" />
                                {item.phone} • {item.type}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-mono text-warning-600 font-semibold">
                                {item.waitTime}
                              </div>
                              <div className="text-xs text-gray-500">
                                Esperando
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleScheduleIndividual(item)}
                              disabled={loading || loadingItemId === item.id}
                            >
                              <CalendarPlus className="w-4 h-4 mr-1" />
                              {loadingItemId === item.id ? 'Agendando...' : 'Agendar'}
                            </Button>
                          </div>
                        </div>
                      ))}
                      {section.items.length === 0 && (
                        <div className="text-sm text-gray-500 italic">No hay pacientes en espera</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Modal de agendamiento con IA */}
          <AISchedulingModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            patient={selectedPatient}
            specialty={selectedSpecialty}
            // no pasamos "patients" para que sea flujo individual
            queueEntryId={selectedQueueEntryId}
            patientId={selectedPatientId}
            specialtyId={selectedSpecialtyId}
            onScheduled={async () => { await refresh(); }}
          />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Queue;
