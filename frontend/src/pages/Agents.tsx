
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, User, PhoneCall, MapPin, Stethoscope, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import AISchedulingModal from "@/components/AISchedulingModal";

const Agents = () => {
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]);
  // loading eliminado (ya no usado)
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const list = await api.getTransfers('pending');
      // Validar que list sea un array, si no, usar array vacío
      const transfers = Array.isArray(list) ? list : [];
      setIncomingTransfers(transfers.map((t: any) => ({
        id: t.id,
        patientName: t.patient_name || 'Paciente',
        patientId: t.patient_identifier || (t.patient_id ? `#${t.patient_id}` : 'N/D'),
        phone: t.phone || 'N/D',
        preferredLocation: t.preferred_location_name || 'N/D',
        specialty: t.specialty_name || 'General',
        aiObservation: t.ai_observation || '',
        transferReason: t.transfer_reason || '',
        transferTime: `${t.wait_minutes ?? 0} min`,
        priority: (t.priority || 'Media').toLowerCase(),
        // raw ids for preselection
        patient_id: t.patient_id || null,
        specialty_id: t.specialty_id || null,
        preferred_location_id: t.preferred_location_id || null,
      })));
    } catch (e: any) {
      console.error('Error loading transfers:', e);
      setError(e?.message || 'Error cargando transferencias');
      setIncomingTransfers([]); // Set empty array on error
    } finally {
      /* no-op */
    }
  };

  useEffect(() => {
    refresh();
    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const token = localStorage.getItem('token') || undefined;
    const url = `${base}/transfers/stream` + (token ? `?token=${encodeURIComponent(token)}` : '');
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
        ['created','accepted','rejected','completed'].forEach(ev => es!.addEventListener(ev, onAny as any));
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

  const handleAcceptTransfer = async (transferId: number) => {
    try {
      await api.acceptTransfer(transferId);
      await refresh();
      const t = incomingTransfers.find(x => x.id === transferId);
      if (t) {
        // Intentar mapear IDs si backend los trae ocultos (guardados como propiedades internas)
        const raw: any = (t as any);
        const specialtyId = raw.specialty_id || null;
        const patientId = raw.patient_id || null;
        const preferredLocationId = raw.preferred_location_id || null;
        setSelected({
          transferId: t.id,
          patient: { id: patientId, patient: t.patientName, phone: t.phone, specialty: t.specialty, priority: (t.priority || 'Media'), waitTime: t.transferTime, type: 'Transferencia' },
          specialtyId,
          preferredLocationId,
        });
        setModalOpen(true);
      } else {
        alert(`Transferencia aceptada.`);
      }
    } catch (e: any) {
      alert(e?.message || 'No se pudo aceptar la transferencia');
    }
  };

  const handleRejectTransfer = async (transferId: number) => {
    try {
      await api.rejectTransfer(transferId);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'No se pudo rechazar la transferencia');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta":
        return "bg-red-100 text-red-800 border-red-200";
      case "media":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "baja":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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
              <h1 className="text-3xl font-bold text-medical-800 mb-2">Transferencias de Pacientes</h1>
              <p className="text-medical-600">Pacientes que la IA no pudo agendar y requieren atención humana</p>
            </div>

            {/* Transferencias Pendientes */}
            {error && (
              <Card><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>
            )}
            {incomingTransfers.length > 0 ? (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-orange-800 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Transferencias Pendientes ({incomingTransfers.length})
                  </CardTitle>
                  <CardDescription className="text-orange-700">
                    Pacientes que la IA no pudo agendar y requieren atención humana
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {incomingTransfers.map((transfer) => (
                      <div key={transfer.id} className="bg-white border rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{transfer.patientName}</h3>
                              <Badge className={`text-xs ${getPriorityColor(transfer.priority)}`}>
                                Prioridad {transfer.priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                En espera {transfer.transferTime}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User className="w-4 h-4" />
                                <span>ID: {transfer.patientId}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="w-4 h-4" />
                                <span>{transfer.phone}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin className="w-4 h-4" />
                                <span>{transfer.preferredLocation}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-medical-600 mb-3">
                              <Stethoscope className="w-4 h-4" />
                              <span className="font-medium">{transfer.specialty}</span>
                              <span className="text-gray-500">• {transfer.transferReason}</span>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <h4 className="font-medium text-blue-800 mb-1">Observaciones de la IA:</h4>
                              <p className="text-sm text-blue-700">{transfer.aiObservation}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRejectTransfer(transfer.id)}
                          >
                            Rechazar
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleAcceptTransfer(transfer.id)}
                            className="bg-medical-600 hover:bg-medical-700"
                          >
                            <PhoneCall className="w-4 h-4 mr-1" />
                            Aceptar Llamada
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay transferencias pendientes</h3>
                  <p className="text-gray-500">La IA está manejando todas las citas automáticamente</p>
                </CardContent>
              </Card>
            )}

            {/* Información sobre el proceso */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800 flex items-center">
                  <PhoneCall className="w-5 h-5 mr-2" />
                  Proceso de Transferencia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-blue-700">
                  <p>• <strong>Paso 1:</strong> La IA intenta agendar automáticamente la cita</p>
                  <p>• <strong>Paso 2:</strong> Si no es posible, la IA explica al paciente que será transferido a un especialista humano</p>
                  <p>• <strong>Paso 3:</strong> La transferencia aparece aquí con datos del paciente y observaciones de la IA</p>
                  <p>• <strong>Paso 4:</strong> Un agente acepta la transferencia y habla directamente con el paciente</p>
                  <p>• <strong>Paso 5:</strong> El agente utiliza las observaciones de la IA para resolver el problema de agendamiento</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <AISchedulingModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            patient={selected?.patient || null}
            specialty={selected?.patient?.specialty || null}
            patients={undefined}
            queueEntryId={null}
            patientId={selected?.patient?.id || null}
            specialtyId={selected?.specialtyId || null}
            transferId={selected?.transferId || null}
            preferredLocationId={selected?.preferredLocationId || null}
            onScheduled={async () => { await refresh(); setModalOpen(false); }}
          />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Agents;
