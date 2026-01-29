import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, MapPin, Stethoscope, FileText, Building2, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface AppointmentData {
  appointment_id: number;
  patient_name: string;
  patient_document: string;
  scheduled_date: string;
  scheduled_time: string;
  doctor_name: string;
  specialty_name: string;
  location_name: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'Confirmada': { label: 'Confirmada', color: 'bg-green-100 text-green-800 border-green-300', icon: <CheckCircle2 className="w-5 h-5" /> },
  'Pendiente': { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: <AlertCircle className="w-5 h-5" /> },
  'Cancelada': { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-300', icon: <XCircle className="w-5 h-5" /> },
  'Completada': { label: 'Completada', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: <CheckCircle2 className="w-5 h-5" /> },
  'No Asistió': { label: 'No Asistió', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: <XCircle className="w-5 h-5" /> },
};

export default function VerifyAppointment() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!appointmentId) {
        setError("ID de cita no proporcionado");
        setLoading(false);
        return;
      }

      try {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const response = await fetch(`${baseUrl}/patients-v2/public/verify/${appointmentId}`);
        const data = await response.json();

        if (data.success && data.data) {
          setAppointment(data.data);
        } else {
          setError(data.error || "No se encontró la cita");
        }
      } catch (err) {
        console.error("Error fetching appointment:", err);
        setError("Error al conectar con el servidor");
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [appointmentId]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No especificada';
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return 'No especificada';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateTimeStr;
    }
  };

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || { 
      label: status, 
      color: 'bg-gray-100 text-gray-800 border-gray-300', 
      icon: <AlertCircle className="w-5 h-5" /> 
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Verificando cita...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <CardTitle className="text-red-700">Cita No Encontrada</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error || "No se pudo verificar la información de la cita."}</p>
            <p className="text-sm text-gray-500">
              Si cree que esto es un error, por favor contacte a Fundación Biosanar IPS.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo(appointment.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header con Logo */}
        <div className="text-center mb-6">
          <img 
            src="/assets/images/logo.png" 
            alt="Fundación Biosanar IPS" 
            className="h-20 mx-auto mb-4"
          />
          <p className="text-gray-600">Verificación de Cita Médica</p>
        </div>

        {/* Verification Badge */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Cita Verificada</p>
              <p className="text-sm text-green-700">Esta cita es válida en nuestro sistema</p>
            </div>
          </CardContent>
        </Card>

        {/* Appointment Details Card */}
        <Card className="shadow-lg">
          <CardHeader className="bg-blue-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Detalles de la Cita</CardTitle>
              <Badge className={`${statusInfo.color} border flex items-center gap-1`}>
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-blue-100 text-sm">Cita #{appointment.appointment_id}</p>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            {/* Paciente */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Paciente</p>
                <p className="font-semibold text-gray-900">{appointment.patient_name}</p>
                <p className="text-sm text-gray-600">Doc: {appointment.patient_document}</p>
              </div>
            </div>

            <Separator />

            {/* Fecha y Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha</p>
                  <p className="font-semibold text-gray-900 text-sm">{formatDate(appointment.scheduled_date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Hora</p>
                  <p className="font-semibold text-gray-900">{appointment.scheduled_time}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Doctor y Especialidad */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Doctor(a)</p>
                <p className="font-semibold text-gray-900">{appointment.doctor_name || 'Por asignar'}</p>
                <p className="text-sm text-blue-600">{appointment.specialty_name}</p>
              </div>
            </div>

            <Separator />

            {/* Sede */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sede</p>
                <p className="font-semibold text-gray-900">{appointment.location_name}</p>
              </div>
            </div>

            {/* Motivo */}
            {appointment.reason && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Motivo de Consulta</p>
                    <p className="font-semibold text-gray-900">{appointment.reason}</p>
                  </div>
                </div>
              </>
            )}

            {/* Fechas de creación y modificación */}
            <Separator />
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Fecha de creación</p>
                  <p className="text-sm font-medium text-gray-700">{formatDateTime(appointment.created_at)}</p>
                </div>
              </div>
              {appointment.updated_at && appointment.updated_at !== appointment.created_at && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Última modificación</p>
                    <p className="text-sm font-medium text-gray-700">{formatDateTime(appointment.updated_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Recuerde llegar 15 minutos antes de su cita</p>
          <p className="mt-1">con su documento de identidad</p>
          <Separator className="my-4" />
          <p className="text-xs text-gray-400">
            Verificado el {new Date().toLocaleDateString('es-CO', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
