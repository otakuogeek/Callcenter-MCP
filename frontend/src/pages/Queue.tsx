// Cache buster: Updated 2025-10-16 - CUPS management + Statistics added
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VirtualizedPatientList } from "@/components/VirtualizedPatientList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, User, Phone, AlertCircle, CalendarPlus, Trash2, FileText, X, Search, Download, CheckCircle, PhoneCall, ChevronDown, BarChart3, MessageSquare, CalendarCheck } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import AISchedulingModal from "@/components/AISchedulingModal";
import AssignFromQueueModal from "@/components/AssignFromQueueModal";
import BulkSMSModal from "@/components/BulkSMSModal";
import { Input } from "@/components/ui/input";
import { generateWaitingListPDF } from "@/utils/pdfGenerators";
import { useToast } from "@/hooks/use-toast";
import { QueueStatistics } from "@/components/QueueStatistics";

const Queue = () => {
  const { toast } = useToast();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBulkSMSModalOpen, setIsBulkSMSModalOpen] = useState(false);
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

  // Estado para llamadas de ElevenLabs
  const [callingPatientId, setCallingPatientId] = useState<number | null>(null);
  
  // Estado para cambiar prioridad
  const [changingPriorityId, setChangingPriorityId] = useState<number | null>(null);

  // Estado para acordeones - expandir todas las especialidades con resultados de búsqueda
  const [expandedSpecialties, setExpandedSpecialties] = useState<string[]>([]);

  // Estado para disponibilidad de citas por especialidad
  const [availableSlotsBySpecialty, setAvailableSlotsBySpecialty] = useState<Record<number, { total_available_slots: number; next_available_date: string | null }>>({});

  // Función para cargar disponibilidad por especialidad
  const refreshAvailability = async () => {
    try {
      const response = await api.getAvailableSlotsBySpecialty();
      if (response.success) {
        setAvailableSlotsBySpecialty(response.data);
      }
    } catch (err) {
      console.error('Error cargando disponibilidad por especialidad:', err);
    }
  };

  // Función refresh principal - Cargar TODOS los pacientes de una vez
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cambiar a FALSE para cargar TODOS los pacientes de todas las especialidades
      const response = await api.getWaitingList(false); // NO summary mode - cargar todo
      setWaitingListData(response);
      // Si no hay búsqueda activa, usar los datos del servidor como filteredData
      if (!searchTerm) {
        setFilteredData(response);
      }
      // También actualizar disponibilidad
      await refreshAvailability();
    } catch (err: any) {
      setError(err.message || 'Error cargando cola de espera');
    } finally {
      setLoading(false);
    }
  };

  // Maneja solo la apertura/cierre de acordeones - SIN carga perezosa
  const handleAccordionChange = (values: string[] | string) => {
    // shadcn/ui Accordion can return string or string[] depending on props
    const newValues = Array.isArray(values) ? values : values ? [values] : [];
    setExpandedSpecialties(newValues);
  };

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

  // Primer carga inicial al montar el componente
  useEffect(() => {
    refresh();
    
    // Función para manejar visibilidad de la página
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refresh(); // Refrescar cuando la página vuelve a estar visible
      }
    };

    // Agregar listener para cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Actualizar cada 60 segundos (reducido de 30s para mejor rendimiento)
    // Solo actualizar si la página está visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        refresh();
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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

  // Función para notificar al paciente por SMS que hay cita disponible
  const handleCallPatient = async (item: any, section: any) => {
    setCallingPatientId(item.id);
    try {
      // Construir mensaje SMS
      const message = `Hola ${item.patient_name.split(' ')[0]}! Le informamos que hay agenda disponible para ${section.specialty_name}. Le invitamos a visitar https://biosanarcall.site y agendar su cita. Fundacion Biosanar IPS`;
      
      const response = await api.sendSingleSMS({
        phoneNumber: item.patient_phone,
        message: message,
        patientId: item.patient_id
      });

      if (response.success) {
        toast({
          title: "✅ SMS enviado",
          description: `Notificación enviada a ${item.patient_name} al ${item.patient_phone}`,
        });
      } else {
        toast({
          title: "❌ Error al enviar SMS",
          description: response.message || "No se pudo enviar el mensaje",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error al enviar SMS:', error);
      toast({
        title: "❌ Error",
        description: error.message || "Error al conectar con el sistema de SMS",
        variant: "destructive",
      });
    } finally {
      setCallingPatientId(null);
    }
  };

  // Función para cambiar la prioridad
  const handleChangePriority = async (itemId: number, newPriority: string) => {
    setChangingPriorityId(itemId);
    try {
      const response = await api.updateWaitingListPriority(itemId, newPriority);
      
      if (response.success) {
        toast({
          title: "✅ Prioridad actualizada",
          description: response.message,
        });
        await refresh(); // Recargar la cola
      } else {
        toast({
          title: "❌ Error",
          description: "No se pudo actualizar la prioridad",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error al cambiar prioridad:', error);
      toast({
        title: "❌ Error",
        description: error.message || "Error al actualizar la prioridad",
        variant: "destructive",
      });
    } finally {
      setChangingPriorityId(null);
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
    
    if (!searchValue.trim()) {
      // Si se limpia la búsqueda, recargar solo el resumen y colapsar
      setFilteredData(waitingListData);
      setExpandedSpecialties([]);
      return;
    }

    // Para búsquedas, pedir el listado completo al backend (con pacientes)
    (async () => {
      try {
        setLoading(true);
        const fullResp = await api.getWaitingList(false);
        // Filtrar localmente usando la respuesta completa
        const searchLower = searchValue.toLowerCase().trim();
        const filtered = {
          ...fullResp,
          data: fullResp.data
            .map((specialty: any) => {
              const filteredPatients = (specialty.patients || []).filter((patient: any) => {
                const nameMatch = patient.patient_name?.toLowerCase().includes(searchLower);
                const documentMatch = patient.patient_document?.toLowerCase().includes(searchLower);
                return nameMatch || documentMatch;
              });
              return {
                ...specialty,
                patients: filteredPatients,
                total_waiting: filteredPatients.length
              };
            })
            .filter((specialty: any) => (specialty.patients || []).length > 0)
        };

        setFilteredData(filtered);
        const specialtiesWithResults = filtered.data.map((s: any) => `specialty-${s.specialty_id}`);
        setExpandedSpecialties(specialtiesWithResults);
      } catch (err) {
        console.error('Error buscando:', err);
        setError('Error buscando pacientes');
      } finally {
        setLoading(false);
      }
    })();
  };

  // Actualizar filteredData cuando cambie waitingListData
  useEffect(() => {
    if (searchTerm) {
      handleSearch(searchTerm);
    } else {
      setFilteredData(waitingListData);
    }
  }, [searchTerm, waitingListData]);

  // Función para contar solicitudes duplicadas por documento EN LA MISMA ESPECIALIDAD
  // Conteo total de resultados
  const totalFilteredResults = filteredData?.data?.reduce((acc: number, s: any) => acc + (s.patients?.length || 0), 0) ?? 0;

  const getDuplicateRequestsCount = (patientDocument: string, specialtyId: number): number => {
    if (!waitingListData?.data) return 0;
    
    let count = 0;
    // Buscar la especialidad específica
    const specialty = waitingListData.data.find((s: any) => s.specialty_id === specialtyId);
    
    if (specialty) {
      specialty.patients?.forEach((patient: any) => {
        if (patient.patient_document === patientDocument) {
          count++;
        }
      });
    }
    
    return count;
  };

  // Verificar si un paciente tiene múltiples solicitudes EN LA MISMA ESPECIALIDAD
  const hasMultipleRequests = (patientDocument: string, specialtyId: number): boolean => {
    return getDuplicateRequestsCount(patientDocument, specialtyId) > 1;
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
                <p className="text-medical-600">Gestión de llamadas y estadísticas de la lista de espera</p>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                {message && <p className="text-green-700 text-sm mt-2">{message}</p>}
              </div>
            </div>

            {/* Tabs for Queue Management and Statistics */}
            <Tabs defaultValue="queue" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="queue" className="gap-2">
                  <Clock className="w-4 h-4" />
                  Cola de Espera
                </TabsTrigger>
                <TabsTrigger value="statistics" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Estadísticas
                </TabsTrigger>
              </TabsList>

              {/* Queue Tab Content */}
              <TabsContent value="queue" className="space-y-6 mt-6">
                <div className="flex justify-end gap-2">
                  {waitingListData?.data && waitingListData.data.length > 0 && (
                    <>
                      <Button
                        onClick={() => setIsBulkSMSModalOpen(true)}
                        variant="default"
                        className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Enviar SMS Masivo
                      </Button>
                      <Button
                        onClick={handleGenerateAllPDF}
                        variant="outline"
                        className="gap-2 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:from-blue-100 hover:to-purple-100"
                      >
                        <FileText className="w-4 h-4" />
                        Exportar Todo (PDF)
                      </Button>
                    </>
                  )}
                </div>

            {/* Buscador en tiempo real - STICKY */}
            <div className="sticky top-0 z-10 bg-gradient-to-br from-medical-50 to-white pb-4">
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex-1">
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allSpecialties = waitingListData?.data?.map((s: any) => `specialty-${s.specialty_id}`) || [];
                          setExpandedSpecialties(allSpecialties);
                        }}
                        className="whitespace-nowrap"
                      >
                        Expandir Todas
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedSpecialties([])}
                        className="whitespace-nowrap"
                      >
                        Colapsar Todas
                      </Button>
                    </div>
                  </div>
                  {searchTerm && (
                    <p className="text-sm text-blue-700 mt-2">
                      {totalFilteredResults} resultado(s) encontrado(s)
                    </p>
                  )}
                </CardContent>
              </Card>
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

            {/* Especialidades con Accordion */}
            <Accordion 
              type="multiple" 
              value={expandedSpecialties}
              onValueChange={handleAccordionChange}
              className="space-y-4"
            >
              {filteredData?.data?.map((section: any) => {
                // Verificar si esta especialidad tiene citas disponibles
                const availabilityInfo = availableSlotsBySpecialty[section.specialty_id];
                const hasAvailableSlots = availabilityInfo && availabilityInfo.total_available_slots > 0;
                
                return (
                <AccordionItem 
                  key={section.specialty_id} 
                  value={`specialty-${section.specialty_id}`}
                  className={`border-medical-200 rounded-lg shadow-sm overflow-hidden ${
                    hasAvailableSlots 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 ring-2 ring-green-200' 
                      : 'bg-white'
                  }`}
                >
                  <AccordionTrigger className={`hover:no-underline px-6 py-4 ${
                    hasAvailableSlots 
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 hover:from-green-150 hover:to-emerald-150' 
                      : 'bg-gradient-to-r from-medical-50 to-white hover:from-medical-100 hover:to-medical-50'
                  }`}>
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getSpecialtyIcon(section.specialty_name)}</span>
                        <div className="text-left">
                          <div className={`text-lg font-semibold ${hasAvailableSlots ? 'text-green-800' : 'text-medical-800'}`}>
                            {section.specialty_name}
                          </div>
                          <div className={`text-sm font-normal ${hasAvailableSlots ? 'text-green-600' : 'text-medical-600'}`}>
                            {section.total_waiting} paciente{section.total_waiting !== 1 ? 's' : ''} en espera
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Badge de disponibilidad */}
                        {hasAvailableSlots && (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1 animate-pulse">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            {availabilityInfo.total_available_slots} cita{availabilityInfo.total_available_slots !== 1 ? 's' : ''} disponible{availabilityInfo.total_available_slots !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGeneratePDF(section);
                          }}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    <div className="pt-2">
                      <VirtualizedPatientList
                        patients={section.patients || []}
                        sectionSpecialtyName={section.specialty_name}
                        sectionSpecialtyId={section.specialty_id}
                        hasMultipleRequests={hasMultipleRequests}
                        getDuplicateRequestsCount={getDuplicateRequestsCount}
                        changingPriorityId={changingPriorityId}
                        callingPatientId={callingPatientId}
                        loadingItemId={loadingItemId}
                        deletingItemId={deletingItemId}
                        loading={loading}
                        handleChangePriority={handleChangePriority}
                        handleCallPatient={handleCallPatient}
                        handleOpenCupsDialog={handleOpenCupsDialog}
                        handleAssignFromQueue={handleAssignFromQueue}
                        handleDeleteFromQueue={handleDeleteFromQueue}
                        formatWaitTime={formatWaitTime}
                        formatRequestDateTime={formatRequestDateTime}
                        calculateAge={calculateAge}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
              })}
            </Accordion>
              
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
              </TabsContent>

              {/* Statistics Tab Content */}
              <TabsContent value="statistics" className="mt-6">
                <QueueStatistics searchTerm={searchTerm} />
              </TabsContent>
            </Tabs>
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

          {/* Modal de Envío Masivo de SMS */}
          <BulkSMSModal
            isOpen={isBulkSMSModalOpen}
            onClose={() => setIsBulkSMSModalOpen(false)}
            onSuccess={async () => {
              toast({
                title: "✅ SMS Enviados",
                description: "Los mensajes han sido enviados exitosamente",
              });
            }}
          />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Queue;
