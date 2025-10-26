// Cache buster: Updated 2025-10-16 - CUPS management added
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, User, Phone, AlertCircle, CalendarPlus, Trash2, FileText, X, Search, Download, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import AISchedulingModal from "@/components/AISchedulingModal";
import AssignFromQueueModal from "@/components/AssignFromQueueModal";
import { Input } from "@/components/ui/input";
import { generateWaitingListPDF } from "@/utils/pdfGenerators";
import { useToast } from "@/hooks/use-toast";

const Queue = () => {
  const { toast } = useToast();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedQueueEntryId, setSelectedQueueEntryId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<number | null>(null);

  // Estados para gestión de CUPS
  const [isCupsDialogOpen, setIsCupsDialogOpen] = useState(false);
  const [cupsDialogItem, setCupsDialogItem] = useState<any | null>(null);
  const [availableCups, setAvailableCups] = useState<any[]>([]);
  const [filteredCups, setFilteredCups] = useState<any[]>([]);
  const [cupsSearchTerm, setCupsSearchTerm] = useState<string>('');
  const [selectedCupsId, setSelectedCupsId] = useState<string>('');
  const [loadingCups, setLoadingCups] = useState(false);

  const [waitingListData, setWaitingListData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Estados para búsqueda en tiempo real
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredData, setFilteredData] = useState<any>(null);

  // Función para generar PDF de una especialidad
  const handleGeneratePDF = (section: any) => {
    try {
      generateWaitingListPDF(section);
      toast({
        title: "✅ PDF Generado",
        description: `Se ha generado el PDF de la lista de espera para ${section.specialty_name}`,
      });
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  // Función para generar PDF de todas las especialidades
  const handleGenerateAllPDF = () => {
    try {
      if (!waitingListData?.data || waitingListData.data.length === 0) {
        toast({
          title: "⚠️ Sin datos",
          description: "No hay datos para generar el PDF",
          variant: "destructive",
        });
        return;
      }

      // Usar la primera especialidad como referencia y pasar todas las demás
      generateWaitingListPDF(
        waitingListData.data[0], 
        true, // includeAllSpecialties
        waitingListData.data
      );
      
      toast({
        title: "✅ PDF Generado",
        description: `Se ha generado el PDF con todas las especialidades (${waitingListData.data.length} especialidades)`,
      });
    } catch (error) {
      console.error('Error generando PDF completo:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo generar el PDF completo",
        variant: "destructive",
      });
    }
  };

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

  // Cargar lista de CUPS disponibles
  const loadCupsList = async () => {
    try {
      const response = await api.getCups({ status: 'Activo', page: 1, limit: 500 });
      const cupsList = response.data.cups || [];
      setAvailableCups(cupsList);
      setFilteredCups(cupsList); // Inicialmente mostrar todos
    } catch (e: any) {
      console.error('Error cargando CUPS:', e);
    }
  };

  // Filtrar CUPS en tiempo real basado en búsqueda
  const handleCupsSearch = (searchValue: string) => {
    setCupsSearchTerm(searchValue);
    
    if (!searchValue.trim()) {
      setFilteredCups(availableCups);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const filtered = availableCups.filter((cup) => {
      const codeMatch = cup.code?.toLowerCase().includes(searchLower);
      const nameMatch = cup.name?.toLowerCase().includes(searchLower);
      const categoryMatch = cup.category?.toLowerCase().includes(searchLower);
      return codeMatch || nameMatch || categoryMatch;
    });
    
    setFilteredCups(filtered);
  };

  // Abrir diálogo para gestionar CUPS
  const handleOpenCupsDialog = async (item: any) => {
    setCupsDialogItem(item);
    setSelectedCupsId(item.cups_id ? String(item.cups_id) : '');
    setCupsSearchTerm(''); // Limpiar búsqueda al abrir
    setIsCupsDialogOpen(true);
    
    // Cargar lista de CUPS si aún no está cargada
    if (availableCups.length === 0) {
      await loadCupsList();
    } else {
      setFilteredCups(availableCups); // Mostrar todos al abrir
    }
  };

  // Guardar cambios de CUPS
  const handleSaveCups = async () => {
    if (!cupsDialogItem) return;
    
    setLoadingCups(true);
    try {
      const cups_id = selectedCupsId === '' || selectedCupsId === 'null' ? null : Number(selectedCupsId);
      
      await api.updateWaitingListCups(cupsDialogItem.id, cups_id);
      
      setMessage(cups_id === null ? 'CUPS eliminado exitosamente' : 'CUPS actualizado exitosamente');
      setIsCupsDialogOpen(false);
      await refresh(); // Recargar datos
    } catch (e: any) {
      setError(e?.message || 'Error actualizando CUPS');
    } finally {
      setLoadingCups(false);
    }
  };

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

  const handleAssignFromQueue = async (item: any) => {
    setMessage(null);
    // Abrir modal para asignar desde cola de espera a agenda real
    setSelectedPatient({ 
      id: item.patient_id, 
      patient: item.patient_name, 
      phone: item.patient_phone, 
      specialty: item.specialty_name, 
      priority: item.priority_level, 
      waitTime: formatWaitTime(item.created_at),
      type: 'Esperando',
      waiting_list_id: item.id,
      reason: item.reason,
      cups_id: item.cups_id,
    });
    setSelectedSpecialty(item.specialty_name);
    setSelectedQueueEntryId(item.id);
    setSelectedPatientId(item.patient_id);
    setSelectedSpecialtyId(item.specialty_id);
    setIsAssignModalOpen(true);
  };

  const handleDeleteFromQueue = async (item: any) => {
    if (!confirm(`¿Estás seguro de eliminar a ${item.patient_name} de la cola de espera?`)) {
      return;
    }

    setDeletingItemId(item.id);
    setMessage(null);
    setError(null);

    try {
      await api.deleteWaitingListEntry(item.id);
      setMessage(`${item.patient_name} eliminado de la cola de espera`);
      await refresh(); // Recargar la lista
    } catch (e: any) {
      setError(e?.message || 'Error al eliminar de la cola de espera');
    } finally {
      setDeletingItemId(null);
    }
  };

  const formatWaitTime = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    } else {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    }
  };

  const formatRequestDateTime = (createdAt: string) => {
    const created = new Date(createdAt);
    const day = created.getDate().toString().padStart(2, '0');
    const month = (created.getMonth() + 1).toString().padStart(2, '0');
    const year = created.getFullYear();
    let hour = created.getHours();
    const minute = created.getMinutes().toString().padStart(2, '0');
    const ampm = hour >= 12 ? 'pm' : 'am';
    hour = hour % 12 || 12;
    return `${day}/${month}/${year} ${hour}:${minute} ${ampm}`;
  };

  const calculateAge = (birthDate: string | null | undefined): string => {
    if (!birthDate) return 'N/A';
    
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      
      return age >= 0 ? `${age} años` : 'N/A';
    } catch {
      return 'N/A';
    }
  };

  // Función de búsqueda en tiempo real
  const handleSearch = (searchValue: string) => {
    setSearchTerm(searchValue);
    
    if (!searchValue.trim() || !waitingListData?.data) {
      setFilteredData(waitingListData);
      return;
    }

    const searchLower = searchValue.toLowerCase().trim();
    
    // Filtrar cada especialidad
    const filtered = {
      ...waitingListData,
      data: waitingListData.data.map((specialty: any) => {
        // Filtrar pacientes dentro de cada especialidad
        const filteredPatients = specialty.patients.filter((patient: any) => {
          const nameMatch = patient.patient_name?.toLowerCase().includes(searchLower);
          const documentMatch = patient.patient_document?.toLowerCase().includes(searchLower);
          return nameMatch || documentMatch;
        });

        return {
          ...specialty,
          patients: filteredPatients,
          total_waiting: filteredPatients.length
        };
      }).filter((specialty: any) => specialty.patients.length > 0) // Solo especialidades con resultados
    };

    setFilteredData(filtered);
  };

  // Actualizar filteredData cuando cambie waitingListData
  useEffect(() => {
    if (searchTerm) {
      handleSearch(searchTerm);
    } else {
      setFilteredData(waitingListData);
    }
  }, [waitingListData]);

  // Función para contar solicitudes duplicadas por documento
  const getDuplicateRequestsCount = (patientDocument: string): number => {
    if (!waitingListData?.data) return 0;
    
    let count = 0;
    waitingListData.data.forEach((specialty: any) => {
      specialty.patients?.forEach((patient: any) => {
        if (patient.patient_document === patientDocument) {
          count++;
        }
      });
    });
    return count;
  };

  // Verificar si un paciente tiene múltiples solicitudes
  const hasMultipleRequests = (patientDocument: string): boolean => {
    return getDuplicateRequestsCount(patientDocument) > 1;
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-medical-800 mb-2">Cola de Espera</h1>
                <p className="text-medical-600">Gestión de llamadas en espera organizadas por especialidad</p>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                {message && <p className="text-green-700 text-sm mt-2">{message}</p>}
              </div>
              {waitingListData?.data && waitingListData.data.length > 0 && (
                <Button
                  onClick={handleGenerateAllPDF}
                  variant="outline"
                  className="gap-2 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:from-blue-100 hover:to-purple-100"
                >
                  <FileText className="w-4 h-4" />
                  Exportar Todo (PDF)
                </Button>
              )}
            </div>

            {/* Buscador en tiempo real */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o documento de identidad..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 pr-10 bg-white border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => handleSearch('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {searchTerm && (
                  <p className="text-sm text-blue-700 mt-2">
                    {filteredData?.data?.reduce((acc: number, s: any) => acc + s.patients.length, 0) ?? 0} resultado(s) encontrado(s)
                  </p>
                )}
              </CardContent>
            </Card>

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
              {filteredData?.data?.map((section: any) => (
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
                      <Button
                        onClick={() => handleGeneratePDF(section)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Exportar PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {section.patients?.map((item: any) => {
                        const isMultipleRequests = hasMultipleRequests(item.patient_document);
                        const requestCount = getDuplicateRequestsCount(item.patient_document);
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all ${
                              isMultipleRequests 
                                ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100' 
                                : 'hover:bg-medical-50'
                            }`}
                          >
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
                                {/* 🔥 Badge para pacientes con múltiples solicitudes */}
                                {isMultipleRequests && (
                                  <Badge 
                                    className="text-xs bg-yellow-500 text-black hover:bg-yellow-600 font-bold"
                                  >
                                    📋 {requestCount} solicitudes
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-2">
                                <Phone className="w-3 h-3" />
                                {item.patient_phone} • Doc: {item.patient_document}
                                {item.birth_date && (
                                  <span className="ml-2 text-medical-600 font-medium">
                                    • {calculateAge(item.birth_date)}
                                  </span>
                                )}
                              </div>
                              {/* EPS del paciente */}
                              {item.eps_name && (
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <span className="font-semibold">EPS:</span> {item.eps_name}
                                </div>
                              )}
                              {/* Motivo de la consulta */}
                              <div className="text-xs text-gray-500 mt-1">
                                {item.reason ? item.reason : 'Sin motivo especificado'}
                              </div>
                              {/* 🔥 NUEVO: Información del servicio CUPS */}
                              {item.cups_code && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {item.cups_code}
                                  </Badge>
                                  <span className="text-xs text-medical-700 font-medium">
                                    {item.cups_name}
                                  </span>
                                </div>
                              )}
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
                                Fecha {formatRequestDateTime(item.created_at)}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Dr. {item.doctor_name}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCupsDialog(item)}
                                disabled={loading || loadingItemId === item.id || deletingItemId === item.id}
                                title={item.cups_code ? "Cambiar CUPS" : "Asignar CUPS"}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAssignFromQueue({ ...item, specialty_name: section.specialty_name, specialty_id: section.specialty_id })}
                                disabled={loading || loadingItemId === item.id || deletingItemId === item.id}
                                className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {loadingItemId === item.id ? 'Asignando...' : 'Asignar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteFromQueue({ ...item, specialty_name: section.specialty_name, specialty_id: section.specialty_id })}
                                disabled={loading || loadingItemId === item.id || deletingItemId === item.id}
                                title="Eliminar de la cola"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                      {section.patients?.length === 0 && (
                        <div className="text-sm text-gray-500 italic">No hay pacientes en espera</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {!loading && searchTerm && (!filteredData?.data || filteredData.data.length === 0) && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 text-lg font-medium">No se encontraron resultados</p>
                    <p className="text-gray-500 text-sm mt-2">No hay pacientes que coincidan con "{searchTerm}"</p>
                    <Button
                      onClick={() => handleSearch('')}
                      variant="outline"
                      className="mt-4"
                    >
                      Limpiar búsqueda
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {!loading && !searchTerm && (!waitingListData?.data || waitingListData.data.length === 0) && (
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

          {/* Diálogo para gestionar CUPS */}
          <Dialog open={isCupsDialogOpen} onOpenChange={setIsCupsDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {cupsDialogItem?.cups_code ? 'Cambiar CUPS' : 'Asignar CUPS'}
                </DialogTitle>
                <DialogDescription>
                  Gestionar código CUPS para {cupsDialogItem?.patient_name}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {cupsDialogItem?.cups_code && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm font-semibold text-blue-900">CUPS Actual:</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono">
                        {cupsDialogItem.cups_code}
                      </Badge>
                      <span className="text-sm text-blue-700">
                        {cupsDialogItem.cups_name}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {cupsDialogItem?.cups_code ? 'Nuevo CUPS:' : 'Seleccionar CUPS:'}
                  </label>
                  
                  {/* 🔍 BUSCADOR DE CUPS */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Buscar por código, nombre o categoría..."
                      value={cupsSearchTerm}
                      onChange={(e) => handleCupsSearch(e.target.value)}
                      className="pl-10"
                    />
                    {cupsSearchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => handleCupsSearch('')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Contador de resultados */}
                  {cupsSearchTerm && (
                    <div className="text-xs text-gray-500">
                      {filteredCups.length} {filteredCups.length === 1 ? 'resultado' : 'resultados'} encontrados
                    </div>
                  )}
                  
                  <Select
                    value={selectedCupsId}
                    onValueChange={setSelectedCupsId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un código CUPS" />
                    </SelectTrigger>
                    <SelectContent>
                      {cupsDialogItem?.cups_code && (
                        <SelectItem value="null">
                          <div className="flex items-center gap-2">
                            <X className="w-4 h-4 text-red-500" />
                            <span className="text-red-600">Eliminar CUPS</span>
                          </div>
                        </SelectItem>
                      )}
                      {filteredCups.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-gray-500">
                          No se encontraron códigos CUPS
                        </div>
                      ) : (
                        filteredCups.map((cup) => (
                          <SelectItem key={cup.id} value={String(cup.id)}>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{cup.code}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {cup.category}
                                </Badge>
                              </div>
                              <span className="text-xs text-gray-600">
                                {cup.name.substring(0, 60)}...
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCupsDialogOpen(false)}
                  disabled={loadingCups}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveCups}
                  disabled={loadingCups || selectedCupsId === (cupsDialogItem?.cups_id ? String(cupsDialogItem.cups_id) : '')}
                >
                  {loadingCups ? 'Guardando...' : 'Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Asignación desde Lista de Espera */}
          {selectedPatient && (
            <AssignFromQueueModal
              isOpen={isAssignModalOpen}
              waitingListId={selectedPatient.waiting_list_id}
              patientId={selectedPatient.id}
              patientName={selectedPatient.patient}
              specialtyId={selectedSpecialtyId!}
              specialtyName={selectedSpecialty!}
              priority={selectedPatient.priority}
              reason={selectedPatient.reason}
              cupsId={selectedPatient.cups_id}
              onClose={() => {
                setIsAssignModalOpen(false);
                setLoadingItemId(null);
              }}
              onAssignSuccess={async () => {
                setIsAssignModalOpen(false);
                setLoadingItemId(null);
                toast({
                  title: "Cita asignada exitosamente",
                  description: `${selectedPatient.patient} ha sido asignado a una agenda y eliminado de la cola de espera.`,
                });
                await refresh(); // Recargar lista de espera
              }}
            />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Queue;
