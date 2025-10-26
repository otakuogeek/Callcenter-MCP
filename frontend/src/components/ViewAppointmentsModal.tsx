import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Calendar, Clock, Phone, MapPin, CheckCircle, AlertCircle, XCircle, Users, Stethoscope, Edit } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import CancelAppointmentModal from "./CancelAppointmentModal";
import EditAvailabilityModal from "./EditAvailabilityModal";
import RescheduleAvailabilityModal from "./RescheduleAvailabilityModal";

interface ViewAppointmentsModalProps { isOpen: boolean; onClose: () => void; date: string | null; }

type Appointment = { id: number; patient_name: string; patient_document?: string; patient_phone?: string | null; patient_email?: string | null; scheduled_at: string; duration_minutes: number; status: string; doctor_name: string; specialty_name: string; location_name: string; appointment_type: string; reason?: string | null; notes?: string | null; insurance_type?: string | null; availability_id?: number; };
type Availability = { id: number; doctor_id: number; specialty_id: number; location_id: number; location_name: string; specialty_name: string; doctor_name: string; date: string; start_time: string; end_time: string; capacity: number; booked_slots: number; status: string; notes?: string; appointments?: Appointment[] };

const ViewAppointmentsModal = ({ isOpen, onClose, date }: ViewAppointmentsModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<Availability | null>(null);

  useEffect(() => { if (isOpen && date) loadData(); }, [isOpen, date]);

  const loadData = async () => {
    if (!date) return;
    setLoading(true);
    try {
      const [appointmentsData, availabilitiesData] = await Promise.all([
        // ✅ CORREGIDO: Usar objeto con date
        api.getAppointments({ date }),
        api.getAvailabilities({ date }) // ✅ FIX: Pasar como objeto
      ]);
      setAppointments(appointmentsData || []);
      const enriched = (availabilitiesData || []).map((a: any) => {
        const related = (appointmentsData || []).filter((apt: any) => apt.availability_id === a.id);
        return { id: a.id, doctor_id: a.doctor_id, specialty_id: a.specialty_id, location_id: a.location_id, location_name: a.location_name, specialty_name: a.specialty_name, doctor_name: a.doctor_name, date: a.date, start_time: a.start_time, end_time: a.end_time, capacity: a.capacity, booked_slots: a.booked_slots || related.length, status: a.status, notes: a.notes, appointments: related } as Availability;
      });
      setAvailabilities(enriched);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudieron cargar los datos", variant: "destructive" });
      setAppointments([]); setAvailabilities([]);
    } finally { setLoading(false); }
  };

  const getStatusColor = (s: string) => {
    switch (s) { case "Confirmada": case "Activa": return "bg-green-100 text-green-800 border-green-200"; case "Pendiente": return "bg-yellow-100 text-yellow-800 border-yellow-200"; case "Completada": case "Completa": return "bg-blue-100 text-blue-800 border-blue-200"; case "Cancelada": return "bg-red-100 text-red-800 border-red-200"; default: return "bg-gray-100 text-gray-800 border-gray-200"; }
  };
  const getStatusIcon = (s: string) => { switch (s) { case "Confirmada": case "Activa": return <CheckCircle className="w-3 h-3" />; case "Pendiente": return <AlertCircle className="w-3 h-3" />; case "Completada": case "Completa": return <CheckCircle className="w-3 h-3" />; case "Cancelada": return <XCircle className="w-3 h-3" />; default: return <Clock className="w-3 h-3" />; } };
  const formatDate = (d: string) => { try { return format(new Date(d + 'T00:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }); } catch { return d; } };
  const formatTime = (t: string) => { try { if (t.includes('T')) return format(new Date(t), "HH:mm", { locale: es }); const [h, m] = t.split(':'); return `${h}:${m}`; } catch { return t; } };

  const handleCancelAppointment = (apt: Appointment) => { const pd = { id: apt.id, patientName: apt.patient_name, phone: apt.patient_phone, email: apt.patient_email, date: date!, time: formatTime(apt.scheduled_at), doctor: apt.doctor_name, specialty: apt.specialty_name }; setSelectedPatient(pd); setIsCancelModalOpen(true); };
  const handleCloseCancelModal = () => { setIsCancelModalOpen(false); setSelectedPatient(null); loadData(); };
  const handleEditAvailability = (av: Availability) => { setSelectedAvailability(av); setIsEditModalOpen(true); };
  const handleCloseEditModal = () => { setIsEditModalOpen(false); setSelectedAvailability(null); loadData(); };
  const handleRescheduleAvailability = (av: Availability) => { setSelectedAvailability(av); setIsRescheduleModalOpen(true); };
  const handleCloseRescheduleModal = () => { setIsRescheduleModalOpen(false); setSelectedAvailability(null); loadData(); };

  if (!date) return null;
  const totalCapacity = availabilities.reduce((t, a) => t + a.capacity, 0);
  const totalBooked = availabilities.reduce((t, a) => t + (a.booked_slots || 0), 0);
  const totalAvailable = totalCapacity - totalBooked;
  const totalPending = appointments.filter(a => a.status === 'Pendiente').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-blue-600"><Calendar className="w-5 h-5" />Detalles del {formatDate(date)}</DialogTitle>
          <DialogDescription>
            Visualización de agendas médicas y citas programadas para la fecha seleccionada
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-blue-200 bg-blue-50"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-blue-800">Agendas</p><p className="text-2xl font-bold text-blue-600">{availabilities.length}</p></div><Stethoscope className="w-8 h-8 text-blue-500" /></div></CardContent></Card>
            <Card className="border-green-200 bg-green-50"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-green-800">Ocupados</p><p className="text-2xl font-bold text-green-600">{totalBooked}</p></div><Users className="w-8 h-8 text-green-500" /></div></CardContent></Card>
            <Card className="border-yellow-200 bg-yellow-50"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-yellow-800">Disponibles</p><p className="text-2xl font-bold text-yellow-600">{totalAvailable}</p></div><CheckCircle className="w-8 h-8 text-yellow-500" /></div></CardContent></Card>
            <Card className="border-purple-200 bg-purple-50"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-purple-800">Pendientes</p><p className="text-2xl font-bold text-purple-600">{totalPending}</p></div><AlertCircle className="w-8 h-8 text-purple-500" /></div></CardContent></Card>
          </div>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8"><p className="text-gray-500">Cargando agendas...</p></div>
            ) : availabilities.length === 0 ? (
              <div className="text-center py-8"><Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">No hay agendas programadas para este día</p></div>
            ) : (
              <div className="space-y-4">
                {availabilities.map(av => (
                  <Card key={av.id} className="border hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={`${getStatusColor(av.status)} flex items-center gap-1`}>{getStatusIcon(av.status)}{av.status}</Badge>
                          <div><span className="font-semibold text-lg text-gray-800">{av.doctor_name}</span><div className="text-sm text-gray-600 mt-1">{av.specialty_name}</div></div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-blue-600">{formatTime(av.start_time)} - {formatTime(av.end_time)}</div>
                          <div className="text-sm text-gray-600">Capacidad: <span className="font-medium">{av.capacity} citas</span></div>
                          <div className="text-sm">Ocupado: <span className={`font-medium ${av.booked_slots === av.capacity ? 'text-red-600' : av.booked_slots / av.capacity > 0.8 ? 'text-yellow-600' : 'text-green-600'}`}>{av.booked_slots}/{av.capacity}</span><span className="text-xs text-gray-500 ml-1">({av.capacity > 0 ? Math.round((av.booked_slots / av.capacity) * 100) : 0}%)</span></div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2"><Stethoscope className="w-4 h-4 text-blue-500" /><span className="font-medium text-blue-700">{av.specialty_name}</span></div>
                        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500" /><span className="text-gray-700">{av.location_name}</span></div>
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-500" /><span className="text-gray-700">{formatDate(av.date)}</span></div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><Stethoscope className="w-4 h-4" />Detalles de la Agenda</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div><span className="text-blue-700 font-medium">Horario:</span><span className="ml-2 text-blue-900">{formatTime(av.start_time)} - {formatTime(av.end_time)}</span></div>
                          <div><span className="text-blue-700 font-medium">Duración:</span><span className="ml-2 text-blue-900">{(() => { const start = new Date(`2000-01-01T${av.start_time}`); const end = new Date(`2000-01-01T${av.end_time}`); const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60)); return `${hours} horas`; })()}</span></div>
                          <div><span className="text-blue-700 font-medium">Capacidad Total:</span><span className="ml-2 text-blue-900">{av.capacity} pacientes</span></div>
                          <div><span className="text-blue-700 font-medium">Disponibles:</span><span className={`ml-2 font-medium ${(av.capacity - av.booked_slots) === 0 ? 'text-red-600' : (av.capacity - av.booked_slots) <= 5 ? 'text-yellow-600' : 'text-green-600'}`}>{av.capacity - av.booked_slots} cupos</span></div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mb-4 pb-4 border-b">
                        <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => handleEditAvailability(av)}><Edit className="w-4 h-4" />Editar Agenda</Button>
                        <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => handleRescheduleAvailability(av)}><Calendar className="w-4 h-4" />Reagendar</Button>
                      </div>
                      {av.notes && (<div className="mb-4 p-3 bg-gray-50 rounded-lg border"><h5 className="font-medium text-gray-800 mb-1">Notas de la agenda:</h5><p className="text-sm text-gray-700">{av.notes}</p></div>)}
                      {av.appointments && av.appointments.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-800 flex items-center gap-2"><Users className="w-4 h-4" />Pacientes Agendados ({av.appointments.length}/{av.capacity})</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg">
                            {av.appointments.map((apt, i) => (
                              <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="text-sm font-medium text-gray-600">#{i + 1}</div>
                                  <Badge className={`${getStatusColor(apt.status)} text-xs`}>{apt.status}</Badge>
                                  <div>
                                    <p className="font-medium text-gray-900">{apt.patient_name}</p>
                                    <p className="text-xs text-gray-600">
                                      {formatTime(apt.scheduled_at)} <span className="ml-2">({apt.duration_minutes} min)</span>
                                      {apt.reason && (<span className="ml-2 text-blue-600">• {apt.reason}</span>)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {apt.patient_phone && (<div className="text-xs text-gray-500"><Phone className="w-3 h-3 inline mr-1" />{apt.patient_phone}</div>)}
                                  {apt.patient_document && (<div className="text-xs text-gray-600 font-medium">CC: {apt.patient_document}</div>)}
                                  <Button variant="ghost" size="sm" onClick={() => handleCancelAppointment(apt)} className="h-8 w-8 p-0" title="Gestionar cita"><Edit className="w-3 h-3" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200"><Users className="w-8 h-8 text-gray-400 mx-auto mb-2" /><p className="text-gray-600 font-medium">No hay pacientes agendados</p><p className="text-sm text-gray-500">Esta agenda tiene {av.capacity} cupos disponibles</p></div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      <CancelAppointmentModal isOpen={isCancelModalOpen} onClose={handleCloseCancelModal} patient={selectedPatient} />
      <EditAvailabilityModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} availability={selectedAvailability} onSave={handleCloseEditModal} />
      <RescheduleAvailabilityModal isOpen={isRescheduleModalOpen} onClose={handleCloseRescheduleModal} availability={selectedAvailability} onSave={handleCloseRescheduleModal} />
    </Dialog>
  );
};

export default ViewAppointmentsModal;
