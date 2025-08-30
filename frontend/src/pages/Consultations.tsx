import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Search, Calendar, Clock, Filter, Info, MapPin, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import CallStatusManager from "@/components/CallStatusManager";
import ConsultationDetailsModal from "@/components/ConsultationDetailsModal";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Consultations = () => {
  const [selectedConsultation, setSelectedConsultation] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusMgrOpen, setIsStatusMgrOpen] = useState(false);
  const [statusList, setStatusList] = useState<Array<{ id: number; name: string; color?: string; sort_order?: number; active: string }>>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState<string>("");
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const loadStatuses = async () => {
    try { const rows = await api.getCallStatuses(); setStatusList(rows); } catch { /* ignore */ }
  };
  const loadLogs = async () => {
    try { const rows = await api.getCallLogs({ q: search || undefined, date: date || undefined }); setLogs(rows); } catch { setLogs([]); }
  };

  useEffect(() => { loadStatuses(); }, []);
  useEffect(() => { loadLogs(); }, [search, date]);

  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of statusList) if (s.active !== 'inactive') m.set(s.name, s.color || 'bg-gray-100 text-gray-800');
    return m;
  }, [statusList]);

  const getStatusColor = (status: string) => {
    const c = colorMap.get(status);
    if (c) return c;
    switch (status) {
      case "Atendida":
        return "bg-success-100 text-success-800";
      case "En Curso":
        return "bg-warning-100 text-warning-800";
      case "Pendiente":
        return "bg-medical-100 text-medical-800";
      case "Transferida":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const counters = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0,10);
    const byStatus = new Map<string, number>();
    for (const l of logs) {
      const statusName = l.status_name || 'Sin Estado';
      byStatus.set(statusName, (byStatus.get(statusName) || 0) + 1);
    }
    return {
      today: logs.filter(l => String(l.created_at).slice(0,10) === todayStr).length,
      inProgress: byStatus.get('En Curso') || 0,
      pending: byStatus.get('Pendiente') || 0,
      attended: byStatus.get('Atendida') || 0,
    };
  }, [logs]);

  const updateLogStatus = async (logId: number, status_id: number | null) => {
    setSaving(prev => ({ ...prev, [logId]: true }));
    try {
      await api.updateCallLog(logId, { status_id });
      await loadLogs();
      await loadStatuses();
    } finally {
      setSaving(prev => ({ ...prev, [logId]: false }));
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Información de Horarios":
        return Clock;
      case "Ubicaciones":
        return MapPin;
      case "Preparación de Exámenes":
      case "Resultados de Exámenes":
        return FileText;
      default:
        return Info;
    }
  };

  const handleViewDetails = (consultation: any) => {
    setSelectedConsultation(consultation);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedConsultation(null);
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
              <h1 className="text-3xl font-bold text-medical-800 mb-2">Consultas Telefónicas</h1>
              <p className="text-medical-600">Registro de llamadas para solicitud de información general</p>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-medical-600" />
                    <div>
                      <p className="text-sm text-gray-600">Llamadas Hoy</p>
                      <p className="text-2xl font-bold text-medical-700">
                        {counters.today}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-warning-600" />
                    <div>
                      <p className="text-sm text-gray-600">En Curso</p>
                      <p className="text-2xl font-bold text-warning-700">
                        {counters.inProgress}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-medical-600" />
                    <div>
                      <p className="text-sm text-gray-600">Pendientes</p>
                      <p className="text-2xl font-bold text-medical-700">
                        {counters.pending}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-success-600" />
                    <div>
                      <p className="text-sm text-gray-600">Atendidas</p>
                      <p className="text-2xl font-bold text-success-700">
                        {counters.attended}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros y Búsqueda */}
            <Card>
              <CardHeader>
                <CardTitle className="text-medical-700">Filtros de Búsqueda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input 
                        placeholder="Buscar por paciente o notas..." 
                        className="pl-10"
                        value={search}
                        onChange={e=>setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Input type="date" value={date} onChange={e=>setDate(e.target.value)} />
                  </div>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros
                  </Button>
                  <Button onClick={() => setIsStatusMgrOpen(true)} className="ml-2">Gestionar Estados</Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Consultas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-medical-700">Historial de Consultas Telefónicas</CardTitle>
                <CardDescription>
                  Registro de llamadas para solicitud de información
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs.map((log) => {
                    const typeLabel = log.specialty_name ? 'Resultados de Exámenes' : 'Información General';
                    const consult = {
                      id: log.id,
                      patient: log.patient_name || 'Paciente',
                      type: typeLabel,
                      date: String(log.created_at).slice(0,10),
                      time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      agent: log.user_name || '—',
                      status: log.status_name || 'Sin Estado',
                      duration: null,
                      phone: log.patient_phone || '—',
                      query: log.notes || '',
                    };
                    const TypeIcon = getTypeIcon(typeLabel);
                    return (
                      <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-medical-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-medical-100 rounded-full flex items-center justify-center">
                              <TypeIcon className="w-5 h-5 text-medical-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{log.patient_name || 'Paciente'}</span>
                                <Badge className={`text-xs ${getStatusColor(log.status_name || '')}`}>
                                  {log.status_name || 'Sin Estado'}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600">
                                {typeLabel} • Agente: {log.user_name || '—'}
                              </div>
                              <div className="text-sm text-gray-500">
                                <Phone className="w-3 h-3 inline mr-1" />
                                {log.patient_phone || '—'}
                              </div>
                            </div>
                          </div>
                          <div className="ml-13 text-sm text-gray-700">
                            <strong>Notas:</strong> {log.notes || '—'}
                          </div>
                        </div>
                        
                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-1 text-medical-600">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">{String(log.created_at).slice(0,10)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-medical-600">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Select value={String(log.status_id ?? '')}
                              onValueChange={(v)=> updateLogStatus(log.id, v === '' ? null : Number(v))}
                              disabled={!!saving[log.id]}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Cambiar estado" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem key="none" value="">Sin Estado</SelectItem>
                                {statusList.filter(s=>s.active!=='inactive').map(s=> (
                                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(consult)}>
                              Ver Detalles
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <ConsultationDetailsModal
        consultation={selectedConsultation}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
      <CallStatusManager open={isStatusMgrOpen} onOpenChange={setIsStatusMgrOpen} />
    </SidebarProvider>
  );
};

export default Consultations;
