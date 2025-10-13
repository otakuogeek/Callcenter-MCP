import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Phone, FileText, LogOut, QrCode, Download } from "lucide-react";
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
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [epsList, setEpsList] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  // Cargar municipios filtrados por zona
  const loadMunicipalities = async (zoneId?: number) => {
    try {
      const url = zoneId 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/patients-v2/public/municipalities?zone_id=${zoneId}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/patients-v2/public/municipalities`;
      
      const municipalitiesResponse = await fetch(url);
      if (municipalitiesResponse.ok) {
        const municipalitiesJson: any = await municipalitiesResponse.json();
        setMunicipalities(municipalitiesJson.data || []);
      }
    } catch (err) {
      console.error('Error cargando municipios:', err);
      setMunicipalities([]);
    }
  };

  // Cargar datos complementarios
  const loadSupportData = async () => {
    try {
      // Cargar zonas primero
      const zonesResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/patients-v2/public/zones`);
      if (zonesResponse.ok) {
        const zonesJson: any = await zonesResponse.json();
        setZones(zonesJson.data || []);
      }
      
      // Si el paciente ya tiene zona, cargar municipios de esa zona
      if (patient?.zone_id) {
        await loadMunicipalities(patient.zone_id);
      } else {
        // Cargar todos los municipios
        await loadMunicipalities();
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  };

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
        
        // Cargar citas del paciente
        try {
          const appointmentsResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/patients-v2/${foundPatient.patient_id}/appointments`);
          if (appointmentsResponse.ok) {
            const appointmentsJson: any = await appointmentsResponse.json();
            setAppointments(appointmentsJson.data || []);
          } else {
            setAppointments([]);
          }
        } catch (err) {
          console.error('Error cargando citas:', err);
          setAppointments([]);
        }
        
        await loadSupportData();
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
    setError('');
  };

  // Actualizar información del paciente
  const handleUpdateInfo = async (field: string, value: any) => {
    if (!patient) return;

    try {
      const updateData: any = { [field]: value };
      await api.updatePatientV2(patient.patient_id.toString(), updateData);
      
      // Actualizar estado local
      setPatient({ ...patient, [field]: value });
      
      alert('Información actualizada correctamente');
    } catch (err: any) {
      alert('Error al actualizar: ' + (err.message || 'Error desconocido'));
    }
  };

  // Pantalla de login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Portal del Paciente</CardTitle>
            <CardDescription>Fundación Biosanar IPS</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="document">Número de Documento</Label>
                <Input
                  id="document"
                  type="text"
                  placeholder="Ingrese su número de cédula"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verificando...' : 'Ingresar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard del paciente
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                Bienvenido(a), {patient?.first_name} {patient?.last_name}
              </CardTitle>
              <CardDescription>Documento: {patient?.document}</CardDescription>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </CardHeader>
        </Card>

        {/* Tabs principales */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">
              <User className="w-4 h-4 mr-2" />
              Mi Información
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <Calendar className="w-4 h-4 mr-2" />
              Mis Citas
            </TabsTrigger>
            <TabsTrigger value="medical">
              <FileText className="w-4 h-4 mr-2" />
              Información Médica
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Información Personal */}
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>Mi Información Personal</CardTitle>
                <CardDescription>Actualiza tus datos personales (excepto documento de identidad)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Documento - Solo lectura */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Documento de Identidad</Label>
                  <Input 
                    value={patient?.document || ''} 
                    disabled 
                    className="bg-gray-100 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">Este campo no se puede modificar</p>
                </div>

                {/* Fecha de Registro - Solo lectura */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Fecha de Registro</Label>
                  <Input 
                    value={patient?.created_at ? new Date(patient.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : ''} 
                    disabled 
                    className="bg-gray-100 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">Fecha en que se registró en el sistema</p>
                </div>

                {/* Nombre Completo */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <div className="flex gap-2">
                    <Input
                      id="name"
                      type="text"
                      value={patient?.name || ''}
                      onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                    />
                    <Button onClick={() => handleUpdateInfo('name', patient?.name)}>
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Teléfono */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      type="text"
                      value={patient?.phone || ''}
                      onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                    />
                    <Button onClick={() => handleUpdateInfo('phone', patient?.phone)}>
                      <Phone className="w-4 h-4 mr-2" />
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={patient?.email || ''}
                      onChange={(e) => setPatient({ ...patient, email: e.target.value })}
                    />
                    <Button onClick={() => handleUpdateInfo('email', patient?.email)}>
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Fecha de Nacimiento */}
                <div className="space-y-2">
                  <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
                  <div className="flex gap-2">
                    <Input
                      id="birth_date"
                      type="date"
                      value={patient?.birth_date ? patient.birth_date.split('T')[0] : ''}
                      onChange={(e) => setPatient({ ...patient, birth_date: e.target.value })}
                    />
                    <Button onClick={() => handleUpdateInfo('birth_date', patient?.birth_date)}>
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Género */}
                <div className="space-y-2">
                  <Label htmlFor="gender">Género</Label>
                  <div className="flex gap-2">
                    <Select
                      value={patient?.gender || ''}
                      onValueChange={(value) => setPatient({ ...patient, gender: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccione género" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Femenino">Femenino</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => handleUpdateInfo('gender', patient?.gender)}>
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Dirección */}
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <div className="flex gap-2">
                    <Input
                      id="address"
                      type="text"
                      value={patient?.address || ''}
                      onChange={(e) => setPatient({ ...patient, address: e.target.value })}
                    />
                    <Button onClick={() => handleUpdateInfo('address', patient?.address)}>
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Zona - PRIMERO */}
                <div className="space-y-2">
                  <Label htmlFor="zone">Zona</Label>
                  <div className="flex gap-2">
                    <Select
                      value={patient?.zone_id?.toString() || ''}
                      onValueChange={(value) => {
                        const zoneId = parseInt(value);
                        setPatient({ ...patient, zone_id: zoneId, municipality_id: undefined });
                        loadMunicipalities(zoneId);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccione zona" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Cargando zonas...
                          </div>
                        ) : (
                          zones.map((zone: any) => (
                            <SelectItem key={zone.id} value={zone.id.toString()}>
                              {zone.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={() => handleUpdateInfo('zone_id', patient?.zone_id)}
                    >
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Municipio - SEGUNDO (filtrado por zona) */}
                <div className="space-y-2">
                  <Label htmlFor="municipality">Municipio</Label>
                  <div className="flex gap-2">
                    <Select
                      value={patient?.municipality_id?.toString() || ''}
                      onValueChange={(value) => setPatient({ ...patient, municipality_id: parseInt(value) })}
                      disabled={!patient?.zone_id}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={!patient?.zone_id ? "Primero seleccione zona" : "Seleccione municipio"} />
                      </SelectTrigger>
                      <SelectContent>
                        {municipalities.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {!patient?.zone_id ? 'Primero seleccione una zona' : 'Cargando municipios...'}
                          </div>
                        ) : (
                          municipalities.map((mun: any) => (
                            <SelectItem key={mun.id} value={mun.id.toString()}>
                              {mun.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={() => handleUpdateInfo('municipality_id', patient?.municipality_id)}
                      disabled={!patient?.zone_id || !patient?.municipality_id}
                    >
                      Actualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Citas */}
          <TabsContent value="appointments">
            <div className="space-y-4">
              {appointments.length === 0 ? (
                <Card>
                  <CardContent className="py-16">
                    <div className="text-center">
                      <svg 
                        className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1.5} 
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                        />
                      </svg>
                      <p className="text-lg font-medium text-muted-foreground">No tienes citas programadas</p>
                      <p className="text-sm text-muted-foreground/75 mt-1">Comunícate con nosotros para agendar tu próxima consulta</p>
                    </div>
                  </CardContent>
                </Card>
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
                    <Card key={apt.appointment_id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                      <div className="flex flex-col md:flex-row">
                        {/* Sección de Fecha - Lateral izquierdo */}
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 md:w-32 flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0">
                          <div className="text-center">
                            <div className="text-4xl font-bold">{formattedDate.day}</div>
                            <div className="text-sm uppercase tracking-wide opacity-90">{formattedDate.month}</div>
                            <div className="text-xs opacity-75">{formattedDate.year}</div>
                          </div>
                        </div>

                        {/* Contenido Principal */}
                        <div className="flex-1 p-6">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            {/* Información Principal */}
                            <div className="flex-1 space-y-3">
                              {/* Hora y Estado */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-lg font-semibold text-gray-900">
                                    {apt.scheduled_time || 'Hora por confirmar'}
                                  </span>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
                                  {apt.status}
                                </span>
                              </div>

                              {/* Doctor */}
                              <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-gray-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <div>
                                  <p className="text-sm text-gray-500">Doctor(a)</p>
                                  <p className="font-medium text-gray-900">{apt.doctor_name || 'Por asignar'}</p>
                                </div>
                              </div>

                              {/* Especialidad */}
                              {apt.specialty_name && (
                                <div className="flex items-start gap-2">
                                  <svg className="w-5 h-5 text-gray-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                  </svg>
                                  <div>
                                    <p className="text-sm text-gray-500">Especialidad</p>
                                    <p className="font-medium text-gray-900">{apt.specialty_name}</p>
                                  </div>
                                </div>
                              )}

                              {/* Sede */}
                              {apt.location_name && (
                                <div className="flex items-start gap-2">
                                  <svg className="w-5 h-5 text-gray-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <div>
                                    <p className="text-sm text-gray-500">Sede</p>
                                    <p className="font-medium text-gray-900">{apt.location_name}</p>
                                  </div>
                                </div>
                              )}

                              {/* Motivo */}
                              {apt.reason && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <p className="text-sm font-medium text-gray-700 mb-1">Motivo de consulta:</p>
                                  <p className="text-sm text-gray-600 italic">{apt.reason}</p>
                                </div>
                              )}

                              {/* Botón de descarga de QR */}
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <Button 
                                  onClick={() => generateAppointmentQR(apt, patient)}
                                  variant="outline"
                                  className="w-full md:w-auto gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-none"
                                >
                                  <QrCode className="w-4 h-4" />
                                  <Download className="w-4 h-4" />
                                  Descargar QR de Cita
                                </Button>
                                <p className="text-xs text-gray-500 mt-2">
                                  Descarga el código QR para presentarlo al llegar a tu cita
                                </p>
                              </div>
                            </div>

                            {/* ID de cita - Esquina superior derecha */}
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Cita N°</p>
                              <p className="text-sm font-mono font-semibold text-gray-700">#{apt.appointment_id}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Tab 3: Información Médica */}
          <TabsContent value="medical">
            <Card>
              <CardHeader>
                <CardTitle>Información Médica</CardTitle>
                <CardDescription>Actualiza tu información de salud</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Grupo Sanguíneo */}
                <div className="space-y-2">
                  <Label htmlFor="blood_group">Grupo Sanguíneo</Label>
                  <div className="flex gap-2">
                    <Select
                      value={patient?.blood_group || ''}
                      onValueChange={(value) => setPatient({ ...patient, blood_group: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccione grupo sanguíneo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => handleUpdateInfo('blood_group', patient?.blood_group)}>
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Teléfono Alternativo */}
                <div className="space-y-2">
                  <Label htmlFor="phone_alt">Teléfono Alternativo</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone_alt"
                      type="text"
                      value={patient?.phone_alt || ''}
                      onChange={(e) => setPatient({ ...patient, phone_alt: e.target.value })}
                      placeholder="Número de contacto adicional"
                    />
                    <Button onClick={() => handleUpdateInfo('phone_alt', patient?.phone_alt)}>
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Notas / Observaciones */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas u Observaciones</Label>
                  <div className="flex gap-2 items-start">
                    <Input
                      id="notes"
                      type="text"
                      value={patient?.notes || ''}
                      onChange={(e) => setPatient({ ...patient, notes: e.target.value })}
                      placeholder="Información adicional relevante"
                      className="flex-1"
                    />
                    <Button onClick={() => handleUpdateInfo('notes', patient?.notes)}>
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* Información de Seguro (Solo lectura) */}
                <div className="pt-6 border-t space-y-4">
                  <h3 className="font-semibold text-lg">Información de Seguro</h3>
                  <p className="text-sm text-muted-foreground">
                    Estos datos solo pueden ser modificados por la institución
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">EPS</Label>
                      <p className="font-medium">{patient?.eps_name || 'No registrado'}</p>
                    </div>

                    <div>
                      <Label className="text-muted-foreground">Tipo de Afiliación</Label>
                      <p className="font-medium capitalize">{patient?.insurance_affiliation_type || 'No registrado'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
