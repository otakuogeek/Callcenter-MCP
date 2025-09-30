import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  Users, 
  UserPlus, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Filter,
  Search,
  BarChart3,
  Phone,
  User,
  Stethoscope,
  MapPin,
  ArrowRight,
  Timer
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface QueueItem {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_document: string;
  patient_phone: string;
  specialty_id: number;
  specialty_name: string;
  doctor_id?: number;
  doctor_name?: string;
  location_id?: number;
  location_name?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requested_date?: string;
  status: 'waiting' | 'assigned' | 'cancelled' | 'expired';
  notes?: string;
  created_at: string;
  assigned_at?: string;
  assigned_by_name?: string;
  appointment_id?: number;
  waiting_minutes: number;
  queue_position: number;
}

interface TodayAvailability {
  id: number;
  doctor_id: number;
  doctor_name: string;
  location_id: number;
  location_name: string;
  start_time: string;
  end_time: string;
  total_quota: number;
  assigned_quota: number;
  available_slots: number;
}

interface DailyStats {
  today: {
    total_availabilities: number;
    total_quota: number;
    total_assigned: number;
    remaining_slots: number;
  };
  queue: {
    total_waiting: number;
    urgent_count: number;
    high_count: number;
    normal_count: number;
    low_count: number;
    avg_waiting_minutes: number;
  };
  by_specialty: Array<{
    specialty_name: string;
    availabilities: number;
    quota: number;
    assigned: number;
    remaining: number;
    queue_count: number;
  }>;
}

const priorityColors = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  normal: 'bg-blue-100 text-blue-800 border-blue-200',
  low: 'bg-gray-100 text-gray-800 border-gray-200'
};

const priorityLabels = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja'
};

export function DailyQueueManager() {
  const { toast } = useToast();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [todayAvailabilities, setTodayAvailabilities] = useState<TodayAvailability[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [newPatientData, setNewPatientData] = useState({
    patient_id: '',
    specialty_id: '',
    doctor_id: '',
    location_id: '',
    priority: 'normal' as const,
    notes: ''
  });

  useEffect(() => {
    loadInitialData();
    loadQueueData();
    loadDailyStats();
    
    // Recargar cada 30 segundos
    const interval = setInterval(() => {
      loadQueueData();
      loadDailyStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [selectedSpecialty]);

  const loadInitialData = async () => {
    try {
      const [specialtiesRes, patientsRes] = await Promise.all([
        api.getSpecialties(),
        api.getPatientsV2({ limit: 100 })
      ]);
      
      setSpecialties(specialtiesRes || []);
      setPatients(patientsRes?.data?.patients || patientsRes?.patients || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadQueueData = async () => {
    setLoading(true);
    try {
      const params: any = { status: 'waiting' };
      if (selectedSpecialty !== 'all') {
        params.specialty_id = selectedSpecialty;
      }

      const response = await fetch('/api/daily-queue?' + new URLSearchParams(params), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setQueueItems(data.data || []);
      }
    } catch (error) {
      console.error('Error loading queue:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la cola de espera",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDailyStats = async () => {
    try {
      const response = await fetch('/api/daily-queue/daily-stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDailyStats(data.data);
      }
    } catch (error) {
      console.error('Error loading daily stats:', error);
    }
  };

  const loadTodayAvailabilities = async (specialtyId: number) => {
    try {
      const response = await fetch(`/api/daily-queue/today-availability?specialty_id=${specialtyId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTodayAvailabilities(data.data || []);
      }
    } catch (error) {
      console.error('Error loading today availabilities:', error);
    }
  };

  const handleAddToQueue = async () => {
    try {
      const response = await fetch('/api/daily-queue/assign-today', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patient_id: Number(newPatientData.patient_id),
          specialty_id: Number(newPatientData.specialty_id),
          doctor_id: newPatientData.doctor_id ? Number(newPatientData.doctor_id) : undefined,
          location_id: newPatientData.location_id ? Number(newPatientData.location_id) : undefined,
          priority: newPatientData.priority,
          notes: newPatientData.notes
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: result.message
        });
        
        if (result.assigned) {
          // Si se asignó directamente, mostrar información adicional
          toast({
            title: "Cita Asignada",
            description: "La cita fue asignada automáticamente para hoy",
            duration: 5000
          });
        }
        
        setShowAddModal(false);
        setNewPatientData({
          patient_id: '',
          specialty_id: '',
          doctor_id: '',
          location_id: '',
          priority: 'normal',
          notes: ''
        });
        loadQueueData();
        loadDailyStats();
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive"
      });
    }
  };

  const handleManualAssign = async (availabilityId: number) => {
    if (!selectedQueueItem) return;

    try {
      const response = await fetch('/api/daily-queue/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          queue_id: selectedQueueItem.id,
          availability_id: availabilityId,
          assigned_by_user_id: 1 // TODO: obtener del contexto de usuario
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Cita Asignada",
          description: "La cita fue asignada exitosamente"
        });
        
        setShowAssignModal(false);
        setSelectedQueueItem(null);
        loadQueueData();
        loadDailyStats();
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error in manual assignment:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la cita",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFromQueue = async (queueId: number) => {
    try {
      const response = await fetch(`/api/daily-queue/${queueId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        toast({
          title: "Removido",
          description: "Paciente removido de la cola de espera"
        });
        loadQueueData();
        loadDailyStats();
      }
    } catch (error) {
      console.error('Error removing from queue:', error);
      toast({
        title: "Error",
        description: "No se pudo remover el paciente",
        variant: "destructive"
      });
    }
  };

  const handleProcessQueue = async () => {
    try {
      const response = await fetch('/api/daily-queue/process-queue', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Procesamiento Completo",
          description: result.message
        });
        loadQueueData();
        loadDailyStats();
      }
    } catch (error) {
      console.error('Error processing queue:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la cola",
        variant: "destructive"
      });
    }
  };

  const openAssignModal = (queueItem: QueueItem) => {
    setSelectedQueueItem(queueItem);
    loadTodayAvailabilities(queueItem.specialty_id);
    setShowAssignModal(true);
  };

  const filteredQueueItems = queueItems.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.patient_document.includes(searchTerm) ||
      item.patient_phone.includes(searchTerm);
    
    return matchesSearch;
  });

  const formatWaitingTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Cola Diaria</h1>
          <p className="text-gray-600">
            Asignación automática para hoy - {new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleProcessQueue}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Procesar Cola
          </Button>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Agregar Paciente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Agregar Paciente a Cola</DialogTitle>
                <DialogDescription>
                  Se intentará asignar para hoy, si no hay disponibilidad se agregará a cola de espera
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="patient">Paciente</Label>
                  <Select value={newPatientData.patient_id} onValueChange={(value) => 
                    setNewPatientData(prev => ({ ...prev, patient_id: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(patient => (
                        <SelectItem key={patient.id} value={patient.id.toString()}>
                          {patient.name} - {patient.document}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="specialty">Especialidad</Label>
                  <Select value={newPatientData.specialty_id} onValueChange={(value) => 
                    setNewPatientData(prev => ({ ...prev, specialty_id: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map(specialty => (
                        <SelectItem key={specialty.id} value={specialty.id.toString()}>
                          {specialty.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select value={newPatientData.priority} onValueChange={(value) => 
                    setNewPatientData(prev => ({ ...prev, priority: value as any }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Notas (opcional)</Label>
                  <Textarea 
                    value={newPatientData.notes}
                    onChange={(e) => setNewPatientData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas adicionales..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddModal(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleAddToQueue}
                    disabled={!newPatientData.patient_id || !newPatientData.specialty_id}
                  >
                    Agregar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estadísticas */}
      {dailyStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cupos Disponibles Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {dailyStats.today.remaining_slots || 0}
              </div>
              <p className="text-xs text-gray-600">
                de {dailyStats.today.total_quota || 0} totales
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">En Cola de Espera</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {dailyStats.queue.total_waiting || 0}
              </div>
              <p className="text-xs text-gray-600">
                pacientes esperando
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatWaitingTime(dailyStats.queue.avg_waiting_minutes || 0)}
              </div>
              <p className="text-xs text-gray-600">
                en cola
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Urgentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {dailyStats.queue.urgent_count || 0}
              </div>
              <p className="text-xs text-gray-600">
                prioridad alta/urgente
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, documento o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por especialidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las especialidades</SelectItem>
            {specialties.map(specialty => (
              <SelectItem key={specialty.id} value={specialty.id.toString()}>
                {specialty.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de Cola */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Cola de Espera
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
          </CardTitle>
          <CardDescription>
            Pacientes en espera de asignación para hoy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posición</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Tiempo en Cola</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueueItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        #{item.queue_position}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.patient_name}</div>
                        <div className="text-sm text-gray-600">
                          {item.patient_document} • {item.patient_phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-gray-400" />
                        {item.specialty_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[item.priority]}>
                        {priorityLabels[item.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Timer className="w-4 h-4 text-gray-400" />
                        {formatWaitingTime(item.waiting_minutes)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => openAssignModal(item)}
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Asignar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRemoveFromQueue(item.id)}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredQueueItems.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No hay pacientes en cola de espera
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Modal de Asignación Manual */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Asignar Cita Manualmente</DialogTitle>
            <DialogDescription>
              Selecciona una disponibilidad para {selectedQueueItem?.patient_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {todayAvailabilities.length > 0 ? (
              <div className="grid gap-2">
                {todayAvailabilities.map((avail) => (
                  <Card key={avail.id} className="p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleManualAssign(avail.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-medium">{avail.doctor_name}</div>
                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            {avail.location_name}
                          </div>
                        </div>
                        <div className="text-sm">
                          <div className="font-medium">{avail.start_time} - {avail.end_time}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {avail.available_slots}
                        </div>
                        <div className="text-xs text-gray-600">disponibles</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay disponibilidades para hoy en esta especialidad
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DailyQueueManager;