import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, Phone, AlertCircle, CalendarPlus } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import AISchedulingModal from "@/components/AISchedulingModal";

const Queue = () => {
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedQueueEntryId, setSelectedQueueEntryId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<number | null>(null);

  const [waitingListData, setWaitingListData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const response = await api.getWaitingList();
      setWaitingListData(response);
    } catch (e: any) {
      setError(e?.message || 'Error cargando cola de espera');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Actualizar cada 30 segundos
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleScheduleIndividual = async (item: any) => {
    setLoadingItemId(item.id);
    setMessage(null);
    // Abrir modal para crear cita real
    setSelectedPatient({ 
      id: item.patient_id, 
      patient: item.patient_name, 
      phone: item.patient_phone, 
      specialty: item.specialty_name, 
      priority: item.priority_level, 
      waitTime: formatWaitTime(item.created_at),
      type: 'Esperando',
    });
    setSelectedSpecialty(item.specialty_name);
    setSelectedQueueEntryId(item.id);
    setSelectedPatientId(item.patient_id);
    setSelectedSpecialtyId(item.specialty_id);
    setIsScheduleModalOpen(true);
  };

  const formatWaitTime = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
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
                      <p className="text-2xl font-bold text-medical-800">{waitingListData?.stats?.total_patients_waiting ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-danger-600" />
                    <div>
                      <p className="text-sm text-gray-600">Alta Prioridad</p>
                      <p className="text-2xl font-bold text-danger-700">{(waitingListData?.stats?.by_priority?.urgente ?? 0) + (waitingListData?.stats?.by_priority?.alta ?? 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-warning-600" />
                    <div>
                      <p className="text-sm text-gray-600">Normal</p>
                      <p className="text-2xl font-bold text-warning-700">{waitingListData?.stats?.by_priority?.normal ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-success-600" />
                    <div>
                      <p className="text-sm text-gray-600">Especialidades</p>
                      <p className="text-2xl font-bold text-success-700">{waitingListData?.stats?.total_specialties ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Especialidades */}
            <div className="space-y-6">
              {waitingListData?.data?.map((section: any) => (
                <Card key={section.specialty_id} className="border-medical-200">
                  <CardHeader className="bg-gradient-to-r from-medical-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getSpecialtyIcon(section.specialty_name)}</span>
                        <div>
                          <CardTitle className="text-xl text-medical-800">{section.specialty_name}</CardTitle>
                          <CardDescription>
                            {section.total_waiting} pacientes en espera
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {section.patients?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-medical-50">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-medical-100 rounded-full flex items-center justify-center text-medical-700 font-semibold">
                              {item.queue_position}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{item.patient_name}</span>
                                <Badge 
                                  variant={item.priority_level === "Urgente" || item.priority_level === "Alta" ? "destructive" : item.priority_level === "Normal" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {item.priority_level}
                                </Badge>
                                {/* 🔥 NUEVO: Badge especial para reagendamientos */}
                                {item.call_type === 'reagendar' && (
                                  <Badge 
                                    className="text-xs bg-black text-yellow-400 hover:bg-black/90 font-bold"
                                  >
                                    ⚡ Reagendar
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-2">
                                <Phone className="w-3 h-3" />
                                {item.patient_phone} • Doc: {item.patient_document}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {item.reason ? item.reason : 'Sin motivo especificado'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-mono text-warning-600 font-semibold">
                                {formatWaitTime(item.created_at)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Esperando
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Dr. {item.doctor_name}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleScheduleIndividual({ ...item, specialty_name: section.specialty_name, specialty_id: section.specialty_id })}
                              disabled={loading || loadingItemId === item.id}
                            >
                              <CalendarPlus className="w-4 h-4 mr-1" />
                              {loadingItemId === item.id ? 'Agendando...' : 'Agendar'}
                            </Button>
                          </div>
                        </div>
                      ))}
                      {section.patients?.length === 0 && (
                        <div className="text-sm text-gray-500 italic">No hay pacientes en espera</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {!loading && (!waitingListData?.data || waitingListData.data.length === 0) && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-500 text-lg">No hay pacientes en cola de espera</p>
                  </CardContent>
                </Card>
              )}
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
