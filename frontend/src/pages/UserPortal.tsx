import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, LogOut, QrCode, Download } from "lucide-react";
import { api } from "@/lib/api";
import QRCode from 'qrcode';

// Función de normalización de documento
const normalizeDocument = (doc: string): string => {
  let normalized = doc.trim();
  normalized = normalized.replace(/\s+/g, '');
  normalized = normalized.replace(/[-.]/g, '');
  normalized = normalized.toUpperCase();
  return normalized;
};

// Función para generar y descargar QR de la cita
const generateAppointmentQR = async (appointment: any, patient: any) => {
  try {
    // Crear objeto con información de la cita
    const appointmentData = {
      tipo: 'CITA_MEDICA',
      paciente: {
        nombre: patient.name,
        documento: patient.document,
        telefono: patient.phone || 'No especificado'
      },
      cita: {
        id: appointment.appointment_id,
        fecha: appointment.scheduled_date,
        hora: appointment.scheduled_time,
        doctor: appointment.doctor_name || 'Por asignar',
        especialidad: appointment.specialty_name || 'No especificada',
        sede: appointment.location_name || 'No especificada',
        motivo: appointment.reason || 'Consulta general',
        estado: appointment.status
      },
      generado: new Date().toISOString(),
      institucion: 'Fundación Biosanar IPS'
    };

    // Convertir a JSON string
    const qrData = JSON.stringify(appointmentData);

    // Generar QR code como data URL
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Crear canvas para agregar información adicional al QR
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensiones del canvas
    canvas.width = 600;
    canvas.height = 800;

    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header con color de marca
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(0, 0, canvas.width, 80);

    // Título
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Fundación Biosanar IPS', canvas.width / 2, 50);

    // Información de la cita
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('CONFIRMACIÓN DE CITA', canvas.width / 2, 130);

    // Detalles del paciente
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    let yPos = 170;
    
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Paciente:', 50, yPos);
    ctx.font = '16px Arial';
    ctx.fillText(patient.name, 150, yPos);
    
    yPos += 30;
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Documento:', 50, yPos);
    ctx.font = '16px Arial';
    ctx.fillText(patient.document, 150, yPos);

    yPos += 40;
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#2563EB';
    ctx.fillText('Detalles de la Cita:', 50, yPos);
    ctx.fillStyle = '#000000';

    yPos += 30;
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Fecha:', 50, yPos);
    ctx.font = '16px Arial';
    const formatDate = (dateStr: string) => {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return dateStr;
      const [, year, month, day] = match;
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return `${Number(day)} de ${months[Number(month) - 1]} de ${year}`;
    };
    ctx.fillText(formatDate(appointment.scheduled_date), 150, yPos);

    yPos += 30;
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Hora:', 50, yPos);
    ctx.font = '16px Arial';
    ctx.fillText(appointment.scheduled_time, 150, yPos);

    yPos += 30;
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Doctor(a):', 50, yPos);
    ctx.font = '16px Arial';
    ctx.fillText(appointment.doctor_name || 'Por asignar', 150, yPos);

    yPos += 30;
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Sede:', 50, yPos);
    ctx.font = '16px Arial';
    ctx.fillText(appointment.location_name || 'No especificada', 150, yPos);

    // Agregar el código QR
    const qrImage = new Image();
    qrImage.onload = () => {
      const qrSize = 300;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = yPos + 40;
      
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      // Texto instructivo
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#666666';
      ctx.fillText('Escanee este código al llegar a su cita', canvas.width / 2, qrY + qrSize + 30);
      ctx.fillText(`ID de Cita: #${appointment.appointment_id}`, canvas.width / 2, qrY + qrSize + 55);

      // Convertir canvas a blob y descargar
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Cita_${appointment.appointment_id}_${patient.document}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    qrImage.src = qrCodeDataURL;

  } catch (error) {
    console.error('Error generando QR:', error);
    alert('Error al generar el código QR. Por favor, intente nuevamente.');
  }
};

export default function UserPortal() {
  const [documentNumber, setDocumentNumber] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [waitingList, setWaitingList] = useState<any[]>([]);

  // Login del paciente
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalized = normalizeDocument(documentNumber);
      const response: any = await api.searchPatientsV2(normalized);
      
      if (response.patients && response.patients.length > 0) {
        const foundPatient = response.patients[0];
        setPatient(foundPatient);
        setIsAuthenticated(true);
        
        // Cargar citas y lista de espera del paciente
        try {
          const appointmentsResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/patients-v2/${foundPatient.patient_id}/appointments`);
          if (appointmentsResponse.ok) {
            const appointmentsJson: any = await appointmentsResponse.json();
            setAppointments(appointmentsJson.data || []);
            setWaitingList(appointmentsJson.waiting_list || []);
          } else {
            setAppointments([]);
            setWaitingList([]);
          }
        } catch (err) {
          console.error('Error cargando citas:', err);
          setAppointments([]);
          setWaitingList([]);
        }
      } else {
        setError('No se encontró ningún paciente con ese documento');
      }
    } catch (err: any) {
      setError(err.message || 'Error al buscar paciente');
    } finally {
      setLoading(false);
    }
  };

  // Cerrar sesión
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPatient(null);
    setDocumentNumber('');
    setAppointments([]);
    setWaitingList([]);
    setError('');
  };

  // Pantalla de login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 p-3 sm:p-4">
        {/* Decoración de fondo */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-0 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>

        <Card className="w-full max-w-md relative z-10 shadow-2xl border-0">
          <CardHeader className="text-center space-y-3 bg-white rounded-t-lg pt-8 pb-6">
            {/* Logo dentro del header */}
            <div className="flex justify-center mb-2">
              <img 
                src="/assets/images/logo.png" 
                alt="Fundación Biosanarcall IPS" 
                className="h-[200px] w-auto object-contain"
              />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-blue-600">Portal del Paciente</CardTitle>
            <CardDescription className="text-blue-600">Fundación Biosanar IPS</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="document" className="text-sm font-semibold text-gray-700">
                  Número de Documento
                </Label>
                <div className="relative">
                  <Input
                    id="document"
                    type="text"
                    placeholder="Ej: 1234567890"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    className="pl-10 py-3 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg transition-all"
                    required
                  />
                  <span className="absolute left-3 top-3 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v10a2 2 0 002 2h5m0 0h5a2 2 0 002-2V8a2 2 0 00-2-2h-5m0 0V5a2 2 0 012-2h.217a2 2 0 011.738 1.002l.001.002l1.06 1.998" />
                    </svg>
                  </span>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="border-2 border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Verificando...
                  </span>
                ) : (
                  'Ingresar'
                )}
              </Button>

              <p className="text-center text-xs text-gray-500">
                Ingrese su número de cédula para acceder a sus citas
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard del paciente
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header responsivo */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          {/* Logo y bienvenida */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1">
            {/* Logo */}
            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-lg border border-gray-200 p-1 flex items-center justify-center">
              <img 
                src="/assets/images/logo.png" 
                alt="Fundación Biosanarcall IPS" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.error('Error loading logo:', e);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            
            {/* Información del paciente */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">
                Bienvenido(a), {patient?.first_name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                <span className="font-semibold">Cédula:</span> {patient?.document}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Salir</span>
          </Button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Título de Sección */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Mis Citas</h2>
          </div>
          <p className="text-sm sm:text-base text-gray-600">Consulta y gestiona tus citas médicas</p>
        </div>

        {/* Grid de Citas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {appointments.length === 0 ? (
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
              <div className="bg-blue-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">No tienes citas programadas</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto">Comunícate con nosotros para agendar tu próxima consulta médica</p>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-all">
                Agendar Cita
              </Button>
            </div>
          ) : (
            appointments.map((apt) => {
              // Formatear fecha SIN conversión de timezone
              const formatDate = (dateStr: string) => {
                // Extraer fecha directamente sin crear objeto Date
                const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (!dateMatch) return { day: 0, month: '', year: 0 };
                
                    const [, year, monthNum, day] = dateMatch;
                    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    return {
                      day: Number(day),
                      month: months[Number(monthNum) - 1],
                      year: Number(year)
                    };
                  };

                  const formattedDate = formatDate(apt.scheduled_date);
                  
                  // Determinar color del estado
                  const statusColors: Record<string, string> = {
                    'Confirmada': 'bg-green-100 text-green-800 border-green-200',
                    'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    'Cancelada': 'bg-red-100 text-red-800 border-red-200',
                    'Completada': 'bg-blue-100 text-blue-800 border-blue-200'
                  };

                  const statusColor = statusColors[apt.status] || 'bg-gray-100 text-gray-800 border-gray-200';

                  return (
                    <div 
                      key={apt.appointment_id} 
                      className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                      {/* Header con fecha */}
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-4 sm:py-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          {/* Fecha */}
                          <div className="flex items-center gap-4">
                            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center min-w-fit">
                              <div className="text-2xl sm:text-3xl font-bold">{formattedDate.day}</div>
                              <div className="text-xs sm:text-sm uppercase tracking-widest opacity-90">{formattedDate.month}</div>
                              <div className="text-xs opacity-75">{formattedDate.year}</div>
                            </div>
                            <div>
                              <div className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                </svg>
                                {apt.scheduled_time || 'Hora por confirmar'}
                              </div>
                              <p className="text-xs sm:text-sm opacity-90 mt-1">Hora de consulta</p>
                            </div>
                          </div>

                          {/* Estado y ID */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs opacity-75">Cita N°</p>
                              <p className="text-sm sm:text-base font-mono font-bold">#{apt.appointment_id}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 whitespace-nowrap ${statusColor}`}>
                              {apt.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contenido principal */}
                      <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-4">
                        {/* Grid de información */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Doctor */}
                          <div className="flex items-start gap-3">
                            <div className="bg-blue-100 rounded-lg p-2.5 mt-0.5">
                              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm text-gray-500 font-medium">Doctor(a)</p>
                              <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{apt.doctor_name || 'Por asignar'}</p>
                            </div>
                          </div>

                          {/* Especialidad */}
                          {apt.specialty_name && (
                            <div className="flex items-start gap-3">
                              <div className="bg-purple-100 rounded-lg p-2.5 mt-0.5">
                                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2V17zm4 0h-2V7h2V17zm4 0h-2v-4h2V17z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">Especialidad</p>
                                <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{apt.specialty_name}</p>
                              </div>
                            </div>
                          )}

                          {/* Sede */}
                          {apt.location_name && (
                            <div className="flex items-start gap-3">
                              <div className="bg-green-100 rounded-lg p-2.5 mt-0.5">
                                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">Sede</p>
                                <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{apt.location_name}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Motivo de consulta */}
                        {apt.reason && (
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <p className="text-xs sm:text-sm font-bold text-gray-700 mb-2">Motivo de consulta:</p>
                            <p className="text-sm text-gray-600 leading-relaxed">{apt.reason}</p>
                          </div>
                        )}

                        {/* Botón QR */}
                        <button
                          onClick={() => generateAppointmentQR(apt, patient)}
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 group/btn"
                        >
                          <QrCode className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          <span>Descargar QR de Cita</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
        </div>

              {/* Sección de Lista de Espera */}
              {waitingList.length > 0 && (
                <div className="mt-10 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-yellow-100 rounded-xl p-2.5">
                        <svg className="w-6 h-6 text-yellow-700" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        Lista de Espera
                      </h2>
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 pl-14">
                      Tienes <span className="font-bold text-yellow-700">{waitingList.length}</span> {waitingList.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} en espera de asignación
                    </p>
                  </div>

                {waitingList.map((item: any) => {
                  const priorityColors: Record<string, string> = {
                    'Urgente': 'bg-red-100 text-red-800 border-red-200',
                    'Alta': 'bg-orange-100 text-orange-800 border-orange-200',
                    'Normal': 'bg-blue-100 text-blue-800 border-blue-200',
                    'Baja': 'bg-gray-100 text-gray-800 border-gray-200'
                  };

                  const priorityColor = priorityColors[item.priority_level] || 'bg-gray-100 text-gray-800 border-gray-200';

                  // Calcular tiempo de espera
                  const calculateWaitTime = (dateString: string) => {
                    try {
                      const date = new Date(dateString);
                      const now = new Date();
                      const diffMs = now.getTime() - date.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      const diffHours = Math.floor(diffMins / 60);
                      const diffDays = Math.floor(diffHours / 24);

                      if (diffDays > 0) return `${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
                      if (diffHours > 0) return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
                      return `${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
                    } catch {
                      return 'N/A';
                    }
                  };

                  return (
                    <div 
                      key={item.id}
                      className="group bg-white rounded-2xl border-2 border-yellow-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200 px-4 sm:px-6 py-4 sm:py-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          {/* Posición y prioridad */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="bg-yellow-500 text-white rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-bold text-sm sm:text-base">
                              #{item.queue_position}
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm text-gray-600 font-medium">Posición en lista</p>
                              <p className="font-semibold text-gray-900">
                                {item.queue_position === 1 
                                  ? 'Próximo para asignar' 
                                  : `${item.queue_position - 1} antes que tú`}
                              </p>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold border-2 ${priorityColor}`}>
                              {item.priority_level}
                            </span>
                            {item.call_type === 'reagendar' && (
                              <span className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-gradient-to-r from-red-500 to-red-600 text-white">
                                ⚡ Urgente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contenido */}
                      <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-4">
                        {/* Grid de información principal */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Especialidad */}
                          <div className="flex items-start gap-3">
                            <div className="bg-purple-100 rounded-lg p-2.5 mt-0.5">
                              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2V17zm4 0h-2V7h2V17zm4 0h-2v-4h2V17z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm text-gray-500 font-medium">Especialidad</p>
                              <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                {item.specialty_name || 'No especificada'}
                              </p>
                            </div>
                          </div>

                          {/* Tiempo en espera */}
                          <div className="flex items-start gap-3">
                            <div className="bg-orange-100 rounded-lg p-2.5 mt-0.5">
                              <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm text-gray-500 font-medium">En espera desde</p>
                              <p className="text-sm sm:text-base font-semibold text-gray-900">
                                {calculateWaitTime(item.created_at)}
                              </p>
                            </div>
                          </div>

                          {/* Doctor (si aplica) */}
                          {item.doctor_name && (
                            <div className="flex items-start gap-3">
                              <div className="bg-blue-100 rounded-lg p-2.5 mt-0.5">
                                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">Doctor(a)</p>
                                <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                  {item.doctor_name}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Sede (si aplica) */}
                          {item.location_name && (
                            <div className="flex items-start gap-3">
                              <div className="bg-green-100 rounded-lg p-2.5 mt-0.5">
                                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">Sede</p>
                                <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                  {item.location_name}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Motivo de consulta */}
                        {item.reason && (
                          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                            <p className="text-xs sm:text-sm font-bold text-yellow-900 mb-1">Motivo de consulta:</p>
                            <p className="text-sm text-yellow-800 leading-relaxed">{item.reason}</p>
                          </div>
                        )}

                        {/* CUPS (si aplica) */}
                        {item.cups_code && (
                          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <p className="text-xs sm:text-sm font-bold text-blue-900 mb-2">Servicio Solicitado:</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                {item.cups_code}
                              </span>
                              <span className="text-sm text-blue-900">{item.cups_name}</span>
                            </div>
                          </div>
                        )}

                        {/* Mensaje informativo */}
                        <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-4 border-l-4 border-yellow-500">
                          <div className="flex gap-3">
                            <svg className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs sm:text-sm text-yellow-900">
                              Te notificaremos automáticamente cuando se libere un cupo según tu prioridad y disponibilidad.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ID de solicitud */}
                      <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 text-right">
                        <p className="text-xs sm:text-sm text-gray-600">Solicitud N° <span className="font-mono font-bold text-gray-900">#{item.id}</span></p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </div>
    </div>
  );
}
