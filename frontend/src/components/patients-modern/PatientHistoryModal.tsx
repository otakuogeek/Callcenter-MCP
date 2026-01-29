import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  CalendarDays,
  Clock,
  FileText,
  ListOrdered,
  Filter,
  History,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Pause,
  Timer
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { convertUTCToColombiaTime } from '@/utils/dateHelpers';

interface HistoryRecord {
  record_type: 'appointment' | 'waiting_list';
  id: number;
  scheduled_at: string;
  start_time: string;
  appointment_date: string;
  status: string;
  reason: string;
  notes: string;
  priority_level: string;
  cancellation_reason?: string;
  cancelled_reason?: string; // Para waiting_list
  appointment_type?: string;
  call_type?: string;
  requested_by?: string;
  reassigned_at?: string;
  reassigned_appointment_id?: number;
  created_at: string;
  updated_at: string;
  doctor_name: string;
  specialty_name: string;
  location_name: string;
  cups_code?: string;
  cups_name?: string;
}

interface PatientHistoryModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  'Pendiente': { icon: <Timer className="h-3 w-3" />, color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300' },
  'Confirmada': { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300' },
  'Completada': { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-green-700', bgColor: 'bg-green-100 border-green-300' },
  'Cancelada': { icon: <XCircle className="h-3 w-3" />, color: 'text-red-700', bgColor: 'bg-red-100 border-red-300' },
  'Pausada': { icon: <Pause className="h-3 w-3" />, color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300' },
  'pending': { icon: <Timer className="h-3 w-3" />, color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300' },
  'reassigned': { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-green-700', bgColor: 'bg-green-100 border-green-300' },
  'cancelled': { icon: <XCircle className="h-3 w-3" />, color: 'text-red-700', bgColor: 'bg-red-100 border-red-300' },
  'expired': { icon: <XCircle className="h-3 w-3" />, color: 'text-gray-700', bgColor: 'bg-gray-100 border-gray-300' },
};

const PRIORITY_CONFIG: Record<string, { color: string; bgColor: string }> = {
  'Urgente': { color: 'text-red-800', bgColor: 'bg-red-100' },
  'Alta': { color: 'text-orange-800', bgColor: 'bg-orange-100' },
  'Normal': { color: 'text-blue-800', bgColor: 'bg-blue-100' },
  'Baja': { color: 'text-gray-800', bgColor: 'bg-gray-100' },
};

export const PatientHistoryModal = ({
  patientId,
  patientName,
  isOpen,
  onClose
}: PatientHistoryModalProps) => {
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<HistoryRecord[]>([]);
  const [waitingList, setWaitingList] = useState<HistoryRecord[]>([]);
  const [summary, setSummary] = useState<{
    total_appointments: number;
    total_waiting_list: number;
    total_records: number;
    status_counts: Record<string, number>;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && patientId) {
      loadHistory();
    }
  }, [isOpen, patientId, statusFilter]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await api.getPatientHistory(patientId, statusFilter);
      if (response.success) {
        setAppointments(response.appointments || []);
        setWaitingList(response.waiting_list || []);
        setSummary(response.summary);
      }
    } catch (error) {
      console.error('Error loading patient history:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el historial del paciente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { icon: <AlertCircle className="h-3 w-3" />, color: 'text-gray-700', bgColor: 'bg-gray-100 border-gray-300' };
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} flex items-center gap-1`}>
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const config = PRIORITY_CONFIG[priority] || { color: 'text-gray-800', bgColor: 'bg-gray-100' };
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color}`}>
        {priority}
      </Badge>
    );
  };

  const renderRecord = (record: HistoryRecord) => {
    const scheduledDate = record.scheduled_at ? new Date(record.scheduled_at) : null;
    const createdDate = record.created_at ? new Date(record.created_at) : null;
    const updatedDate = record.updated_at ? new Date(record.updated_at) : null;
    const isWaitingList = record.record_type === 'waiting_list';

    return (
      <div
        key={`${record.record_type}-${record.id}`}
        className={`p-4 border rounded-lg ${
          isWaitingList ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'
        }`}
      >
        {/* Header con ID y badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
            isWaitingList ? 'bg-purple-200 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {isWaitingList ? 'Cola #' : 'Orden #'}{record.id}
          </span>
          {getStatusBadge(record.status)}
          {record.priority_level && getPriorityBadge(record.priority_level)}
          {isWaitingList && record.call_type && (
            <Badge variant="outline" className="bg-gray-100 text-gray-600">
              {record.call_type === 'reagendar' ? 'Reagendamiento' : 'Normal'}
            </Badge>
          )}
          {record.appointment_type && (
            <Badge variant="outline" className="bg-indigo-100 text-indigo-700">
              {record.appointment_type}
            </Badge>
          )}
        </div>

        {/* Fecha programada */}
        {scheduledDate && (
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            <span className="font-semibold text-gray-900">
              {format(scheduledDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </span>
            {record.start_time && (
              <>
                <Clock className="h-3 w-3 text-gray-400 ml-2" />
                <span className="text-gray-600">{convertUTCToColombiaTime(record.start_time)}</span>
              </>
            )}
          </div>
        )}

        {/* Info de especialidad, médico, sede */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mb-3">
          <div>
            <span className="text-gray-500">Especialidad:</span>
            <p className="font-medium">{record.specialty_name || 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">Médico:</span>
            <p className="font-medium">{record.doctor_name || 'Por asignar'}</p>
          </div>
          <div>
            <span className="text-gray-500">Sede:</span>
            <p className="font-medium">{record.location_name || 'N/A'}</p>
          </div>
        </div>

        {/* Motivo y notas */}
        {(record.reason || record.notes || record.cancellation_reason || record.cancelled_reason || record.requested_by || record.reassigned_appointment_id) && (
          <div className="text-sm border-t pt-2 mt-2 space-y-1">
            {record.reason && (
              <p><span className="text-gray-500">Motivo:</span> {record.reason}</p>
            )}
            {record.cancellation_reason && (
              <p className="text-red-600">
                <span className="text-red-500">Razón cancelación:</span> {record.cancellation_reason}
              </p>
            )}
            {record.cancelled_reason && (
              <p className="text-red-600">
                <span className="text-red-500">Razón cancelación:</span> {record.cancelled_reason}
              </p>
            )}
            {record.notes && (
              <p className="text-gray-600 italic">Notas: {record.notes}</p>
            )}
            {isWaitingList && record.requested_by && (
              <p className="text-gray-600">
                <span className="text-gray-500">Solicitado por:</span> {record.requested_by}
              </p>
            )}
            {isWaitingList && record.reassigned_appointment_id && (
              <p className="text-green-600">
                <span className="text-green-500">Reasignado a cita #:</span> {record.reassigned_appointment_id}
              </p>
            )}
          </div>
        )}

        {/* CUPS si existe */}
        {record.cups_code && (
          <div className="text-xs bg-gray-50 rounded p-2 mt-2">
            <span className="font-semibold">CUPS:</span> {record.cups_code} - {record.cups_name}
          </div>
        )}

        {/* Fechas de auditoría */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-3 pt-2 border-t">
          {createdDate && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>Creado: {format(createdDate, "dd/MM/yyyy HH:mm", { locale: es })}</span>
            </div>
          )}
          {updatedDate && (
            <div className="flex items-center gap-1">
              <History className="h-3 w-3" />
              <span>Modificado: {format(updatedDate, "dd/MM/yyyy HH:mm", { locale: es })}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Combinar y ordenar todos los registros
  const allRecords = [...appointments, ...waitingList].sort((a, b) => {
    const dateA = new Date(a.created_at || a.scheduled_at || 0).getTime();
    const dateB = new Date(b.created_at || b.scheduled_at || 0).getTime();
    return dateB - dateA;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            Historial Completo del Paciente
          </DialogTitle>
          <DialogDescription>
            {patientName} (ID: #{patientId})
          </DialogDescription>
        </DialogHeader>

        {/* Resumen y filtros */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b">
          {summary && (
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline" className="bg-blue-50">
                Total Citas: {summary.total_appointments}
              </Badge>
              <Badge variant="outline" className="bg-purple-50">
                Cola de Espera: {summary.total_waiting_list}
              </Badge>
              {Object.entries(summary.status_counts).map(([status, count]) => (
                <Badge key={status} variant="outline" className="bg-gray-50">
                  {status}: {count}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="Pendiente">Cita: Pendiente</SelectItem>
                <SelectItem value="Confirmada">Cita: Confirmada</SelectItem>
                <SelectItem value="Completada">Cita: Completada</SelectItem>
                <SelectItem value="Cancelada">Cita: Cancelada</SelectItem>
                <SelectItem value="Pausada">Cita: Pausada</SelectItem>
                <SelectItem value="pending">Cola: Pendiente</SelectItem>
                <SelectItem value="reassigned">Cola: Reasignada</SelectItem>
                <SelectItem value="cancelled">Cola: Cancelada</SelectItem>
                <SelectItem value="expired">Cola: Expirada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="text-xs">
              <ListOrdered className="w-4 h-4 mr-1" />
              Todos ({allRecords.length})
            </TabsTrigger>
            <TabsTrigger value="appointments" className="text-xs">
              <CalendarDays className="w-4 h-4 mr-1" />
              Citas ({appointments.length})
            </TabsTrigger>
            <TabsTrigger value="waiting" className="text-xs">
              <Timer className="w-4 h-4 mr-1" />
              Cola ({waitingList.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-3">Cargando historial...</p>
              </div>
            ) : (
              <>
                <TabsContent value="all" className="space-y-3 m-0">
                  {allRecords.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <History className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg font-medium">No hay registros</p>
                        <p className="text-gray-400 text-sm mt-2">
                          Este paciente no tiene citas ni entradas en cola de espera.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    allRecords.map(renderRecord)
                  )}
                </TabsContent>

                <TabsContent value="appointments" className="space-y-3 m-0">
                  {appointments.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <CalendarDays className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg font-medium">No hay citas registradas</p>
                      </CardContent>
                    </Card>
                  ) : (
                    appointments.map(renderRecord)
                  )}
                </TabsContent>

                <TabsContent value="waiting" className="space-y-3 m-0">
                  {waitingList.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Timer className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg font-medium">No hay entradas en cola de espera</p>
                      </CardContent>
                    </Card>
                  ) : (
                    waitingList.map(renderRecord)
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
