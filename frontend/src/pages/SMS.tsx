import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Search, CheckCircle2, XCircle, Clock, Filter, Send, X, UserPlus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface SMSLog {
  id: number;
  recipient_number: string;
  recipient_name: string | null;
  message: string;
  status: 'pending' | 'success' | 'failed';
  messages_sent: number;
  parts: number;
  patient_id: number | null;
  appointment_id: number | null;
  sent_at: string;
}

interface Patient {
  id: number;
  full_name: string;
  document_number: string;
  phone: string;
  email?: string;
}

const SMS = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatients, setSelectedPatients] = useState<Patient[]>([]);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Función para formatear números telefónicos
  const formatPhoneNumber = (phone: string): string => {
    // Eliminar espacios y caracteres especiales
    let cleaned = phone.replace(/[\s\-().]/g, '');
    
    // Si no empieza con +, agregar +57
    if (!cleaned.startsWith('+')) {
      cleaned = '+57' + cleaned;
    }
    
    return cleaned;
  };

  // Fetch SMS history
  const { data: smsData, isLoading } = useQuery({
    queryKey: ['sms-history'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      
      const response = await fetch(`${baseUrl}/sms/history?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar historial de SMS');
      }

      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Search patients
  const { data: patientsData, isLoading: isLoadingPatients, error: patientsError } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: async () => {
      if (!patientSearch || patientSearch.length < 2) return { data: [] };
      
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      
      console.log('🔍 Buscando pacientes:', patientSearch);
      
      const response = await fetch(`${baseUrl}/patients/search?q=${encodeURIComponent(patientSearch)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error en búsqueda:', response.status, errorText);
        throw new Error(`Error al buscar pacientes: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Pacientes encontrados:', data);
      return data;
    },
    enabled: patientSearch.length >= 2,
    retry: 1,
  });

  // Send SMS mutation
  const sendSMSMutation = useMutation({
    mutationFn: async (data: { recipients: Patient[], message: string }) => {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      
      // Enviar SMS a cada paciente
      const promises = data.recipients.map(patient => 
        fetch(`${baseUrl}/sms/send-public`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: patient.phone,
            message: data.message,
            recipient_name: patient.full_name,
            patient_id: patient.id,
          }),
        })
      );

      const results = await Promise.allSettled(promises);
      
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      
      if (successCount > 0) {
        toast({
          title: "SMS enviados",
          description: `${successCount} mensaje(s) enviado(s) exitosamente${failCount > 0 ? ` (${failCount} fallido(s))` : ''}`,
        });
      }
      
      // Refetch SMS history
      queryClient.invalidateQueries({ queryKey: ['sms-history'] });
      
      // Reset form
      setSelectedPatients([]);
      setMessage("");
      setPatientSearch("");
      setIsModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudieron enviar los mensajes",
        variant: "destructive",
      });
    },
  });

  // Normalize phones mutation
  const normalizePhonesMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      
      const response = await fetch(`${baseUrl}/sms/normalize-phones`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al normalizar números');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Formateo completado",
        description: `${data.data.updated} números actualizados exitosamente`,
      });
      
      // Refetch patients if needed
      queryClient.invalidateQueries({ queryKey: ['patients-search'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo formatear la base de datos",
        variant: "destructive",
      });
    },
  });

  const smsLogs: SMSLog[] = smsData?.data || [];
  const patients: Patient[] = patientsData?.data || [];
  
  // Debug log for patients
  console.log('🔍 Patients in UI:', { 
    patientSearch, 
    patientsDataRaw: patientsData,
    patientsArray: patients, 
    count: patients.length,
    isLoadingPatients,
    patientsError 
  });

  // Add patient to selected list
  const addPatient = (patient: Patient) => {
    if (!selectedPatients.find(p => p.id === patient.id)) {
      setSelectedPatients([...selectedPatients, patient]);
    }
    setPatientSearch("");
  };

  // Check if any selected patient has Colombian number
  const hasColombianNumbers = selectedPatients.some(p => {
    const phone = formatPhoneNumber(p.phone);
    return phone.startsWith('+57');
  });

  // Template message for Colombian numbers
  const templateMessage = `IPS Biosanar le recuerda: Cita para [Nombre] el [Día y Fecha] a las [Hora] con [Doctor] de [Especialidad] en la [Sede]`;
  
  // Helper to insert template
  const useTemplate = () => {
    if (selectedPatients.length > 0) {
      const patient = selectedPatients[0];
      setMessage(`IPS Biosanar le recuerda: Cita para ${patient.full_name} el Lunes 4 de Noviembre a las 10:00 AM con Dr. García de Medicina General en la Sede San Gil`);
    } else {
      setMessage(templateMessage);
    }
  };

  // Remove patient from selected list
  const removePatient = (patientId: number) => {
    setSelectedPatients(selectedPatients.filter(p => p.id !== patientId));
  };

  // Handle send SMS
  const handleSendSMS = () => {
    if (selectedPatients.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar al menos un paciente",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Debe escribir un mensaje",
        variant: "destructive",
      });
      return;
    }

    sendSMSMutation.mutate({
      recipients: selectedPatients,
      message: message.trim(),
    });
  };

  // Filter SMS logs
  const filteredLogs = smsLogs.filter((sms) => {
    const matchesSearch = 
      sms.recipient_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sms.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sms.message.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || sms.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: smsLogs.length,
    success: smsLogs.filter(s => s.status === 'success').length,
    failed: smsLogs.filter(s => s.status === 'failed').length,
    pending: smsLogs.filter(s => s.status === 'pending').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Fallido</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full min-h-screen bg-gradient-to-br from-medical-50 to-white">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-medical-800" />
              <div>
                <h1 className="text-3xl font-bold text-medical-800 flex items-center gap-2">
                  <MessageSquare className="w-8 h-8" />
                  SMS Enviados
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Historial de mensajes de texto enviados
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Format Database Button */}
              <Button 
                variant="outline"
                onClick={() => normalizePhonesMutation.mutate()}
                disabled={normalizePhonesMutation.isPending}
                className="border-medical-600 text-medical-600 hover:bg-medical-50"
              >
                {normalizePhonesMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Formateando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Formatear BD
                  </>
                )}
              </Button>

              {/* Send Message Button */}
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-medical-600 hover:bg-medical-700">
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Mensaje
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Enviar SMS Personalizado
                  </DialogTitle>
                  <DialogDescription>
                    Busca y selecciona pacientes para enviar un mensaje personalizado
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Patient Search */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar Paciente</label>
                    <Command className="border rounded-lg">
                      <CommandInput 
                        placeholder="Buscar por nombre o documento..." 
                        value={patientSearch}
                        onValueChange={setPatientSearch}
                      />
                      <CommandList>
                        {patientSearch.length < 2 ? (
                          <div className="p-4 text-center text-sm text-gray-500">
                            Escribe al menos 2 caracteres para buscar...
                          </div>
                        ) : isLoadingPatients ? (
                          <div className="p-4 text-center text-sm text-gray-500">
                            Buscando pacientes...
                          </div>
                        ) : patients.length === 0 ? (
                          <div className="p-4 text-center text-sm text-gray-500">
                            No se encontraron pacientes con "{patientSearch}"
                          </div>
                        ) : (
                          <CommandGroup heading={`${patients.length} paciente(s) encontrado(s)`}>
                            {patients.map((patient) => (
                              <CommandItem
                                key={patient.id}
                                value={`${patient.full_name}-${patient.id}`}
                                onSelect={() => addPatient(patient)}
                                className="cursor-pointer"
                              >
                                <UserPlus className="w-4 h-4 mr-2" />
                                <div className="flex-1">
                                  <div className="font-medium">{patient.full_name}</div>
                                  <div className="text-xs text-gray-500">
                                    Doc: {patient.document_number} • Tel: {patient.phone}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </div>

                  {/* Selected Patients */}
                  {selectedPatients.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Pacientes Seleccionados ({selectedPatients.length})
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                        {selectedPatients.map((patient) => (
                          <div
                            key={patient.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">{patient.full_name}</div>
                              <div className="text-xs text-gray-500">
                                📞 {formatPhoneNumber(patient.phone)}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePatient(patient.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Colombian Number Warning */}
                  {hasColombianNumbers && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="text-yellow-600 mt-0.5">⚠️</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800">
                            Números colombianos detectados
                          </p>
                          <p className="text-xs text-yellow-700 mt-1">
                            Para números con código +57, Zadarma requiere usar la plantilla oficial.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={useTemplate}
                            className="mt-2 text-xs h-7"
                          >
                            Usar Plantilla Obligatoria
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mensaje</label>
                    <Textarea
                      placeholder="Escribe tu mensaje aquí..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      className="resize-none"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{message.length} caracteres</span>
                      <span>{Math.ceil(message.length / 160)} parte(s)</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedPatients([]);
                      setMessage("");
                      setPatientSearch("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSendSMS}
                    disabled={sendSMSMutation.isPending || selectedPatients.length === 0 || !message.trim()}
                    className="bg-medical-600 hover:bg-medical-700"
                  >
                    {sendSMSMutation.isPending ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar a {selectedPatients.length} paciente(s)
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Total Enviados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-medical-800">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Exitosos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.success}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Fallidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Pendientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por número, nombre o mensaje..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="success">Exitosos</SelectItem>
                    <SelectItem value="failed">Fallidos</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* SMS List */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Mensajes</CardTitle>
              <CardDescription>
                {filteredLogs.length} mensaje{filteredLogs.length !== 1 ? 's' : ''} encontrado{filteredLogs.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Cargando mensajes...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron mensajes
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Destinatario</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Mensaje</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-center">Partes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((sms) => (
                        <TableRow key={sms.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(sms.sent_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell>
                            {sms.recipient_name || <span className="text-gray-400">-</span>}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {sms.recipient_number}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate" title={sms.message}>
                              {sms.message}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(sms.status)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{sms.parts}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default SMS;
