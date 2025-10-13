import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, FileText, Heart, Mail, MapPin, Phone, Shield, User, Edit, Save, X, Clock, CalendarDays, QrCode, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Patient } from '@/types/patient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import QRCode from 'qrcode';

// Función auxiliar para formatear fechas sin conversión de zona horaria
const formatDateWithoutTimezone = (dateString: string | null | undefined): string => {
  if (!dateString) return 'No especificado';
  
  // Extraer solo la parte de la fecha YYYY-MM-DD, ignorando el tiempo y timezone
  const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dayNum = Number(day);
    const monthNum = Number(month) - 1;
    return `${dayNum} de ${monthNames[monthNum]} de ${year}`;
  }
  
  return 'Fecha inválida';
};

const patientEditSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  document: z.string().min(3, 'Número de documento es requerido (mínimo 3 caracteres)'),
  birth_date: z.string().optional(),
  gender: z.enum(['Masculino','Femenino','Otro','No especificado']).optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  municipality_id: z.number().optional(),
  zone_id: z.number().optional(),
  insurance_eps_id: z.number().optional(),
});

type PatientEditForm = z.infer<typeof patientEditSchema>;

interface Appointment {
  id: number;
  scheduled_at: string;
  status: string;
  reason: string;
  specialty_name: string;
  doctor_name: string;
  location_name: string;
  start_time: string;
}

interface PatientDetailsModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (patient: Patient) => void;
  onSave?: () => void;
}

const PatientDetailsModal = ({ patient, isOpen, onClose, onSave }: PatientDetailsModalProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [fullPatientData, setFullPatientData] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const { toast } = useToast();

  // Función para obtener los datos completos del paciente
  const loadFullPatientData = async (patientId: string) => {
    try {
      const fullData = await api.getPatients();
      const patients = Array.isArray(fullData) ? fullData : [];
      const found = patients.find((p: any) => String(p.id) === String(patientId));
      if (found) {
        setFullPatientData(found as Patient);
        return found;
      }
      return null;
    } catch (error) {
      console.error('Error loading full patient data:', error);
      return null;
    }
  };

  // Función para cargar las citas del paciente
  const loadPatientAppointments = async (patientId: string) => {
    setLoadingAppointments(true);
    try {
      const response = await api.getPatientAppointments(patientId);
      setAppointments(response.data || []);
    } catch (error) {
      console.error('Error loading patient appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas del paciente.",
        variant: "destructive",
      });
    } finally {
      setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    if (patient && isOpen) {
      loadFullPatientData(String(patient.id));
      loadPatientAppointments(String(patient.id));
    }
  }, [patient, isOpen]);

  // Usar fullPatientData si está disponible, sino usar patient
  const displayPatient = fullPatientData || patient;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<PatientEditForm>({
    resolver: zodResolver(patientEditSchema)
  });

  useEffect(() => {
    if (displayPatient && isEditMode) {
      // Formatear la fecha para el input date (YYYY-MM-DD)
      const formatDateForInput = (dateString: string | undefined) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      };

      reset({
        name: displayPatient.name || '',
        document: displayPatient.document || '',
        birth_date: formatDateForInput(displayPatient.birth_date),
        gender: displayPatient.gender as 'Masculino' | 'Femenino' | 'Otro' | 'No especificado' | undefined,
        phone: displayPatient.phone || '',
        email: displayPatient.email || '',
        address: displayPatient.address || '',
        municipality_id: displayPatient.municipality_id || undefined,
        zone_id: displayPatient.zone_id || undefined,
        insurance_eps_id: displayPatient.insurance_eps_id || undefined,
      });
    }
  }, [displayPatient, isEditMode, reset]);

  const onSubmit = async (data: PatientEditForm) => {
    if (!displayPatient || !isEditMode) return; // No submit si no estamos en modo edición

    try {
      // Limpiar datos vacíos antes de enviar
      const cleanData: any = {};
      Object.keys(data).forEach((key) => {
        const value = (data as any)[key];
        if (value !== '' && value !== undefined && value !== null) {
          cleanData[key] = value;
        }
      });

      await api.updatePatient(Number(displayPatient.id), {
        id: Number(displayPatient.id),
        ...cleanData,
      });
      toast({
        title: "Paciente actualizado",
        description: "Los datos del paciente han sido actualizados exitosamente.",
      });
      setIsEditMode(false);
      if (onSave) onSave();
    } catch (error) {
      console.error('Error updating patient:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el paciente. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (e?: React.MouseEvent) => {
    e?.preventDefault(); // Prevenir cualquier comportamiento por defecto
    e?.stopPropagation(); // Detener la propagación del evento
    setIsEditMode(true);
  };

  const handleCancel = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsEditMode(false);
    reset();
  };

  const handleClose = (e?: any) => {
    if (e) {
      e.preventDefault?.();
      e.stopPropagation?.();
    }
    setIsEditMode(false);
    reset();
    onClose();
  };

  // Función para generar y descargar QR de la cita
  const generateAppointmentQR = async (appointment: any) => {
    try {
      // Crear objeto con información de la cita
      const appointmentData = {
        tipo: 'CITA_MEDICA',
        paciente: {
          nombre: displayPatient.name,
          documento: displayPatient.document,
          telefono: displayPatient.phone || 'No especificado'
        },
        cita: {
          id: appointment.id,
          fecha: appointment.scheduled_at.split(' ')[0],
          hora: appointment.start_time || appointment.scheduled_at.split(' ')[1]?.substring(0, 5) || '',
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
      ctx.fillText(displayPatient.name, 150, yPos);
      
      yPos += 30;
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Documento:', 50, yPos);
      ctx.font = '16px Arial';
      ctx.fillText(displayPatient.document, 150, yPos);

      yPos += 40;
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#2563EB';
      ctx.fillText('Detalles de la Cita:', 50, yPos);
      ctx.fillStyle = '#000000';

      yPos += 30;
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Fecha:', 50, yPos);
      ctx.font = '16px Arial';
      const formatAppointmentDate = (dateStr: string) => {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return dateStr;
        const [, year, month, day] = match;
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${Number(day)} de ${months[Number(month) - 1]} de ${year}`;
      };
      ctx.fillText(formatAppointmentDate(appointment.scheduled_at), 150, yPos);

      yPos += 30;
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Hora:', 50, yPos);
      ctx.font = '16px Arial';
      const appointmentTime = appointment.start_time || appointment.scheduled_at.split(' ')[1]?.substring(0, 5) || '';
      ctx.fillText(appointmentTime, 150, yPos);

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
        ctx.fillText(`ID de Cita: #${appointment.id}`, canvas.width / 2, qrY + qrSize + 55);

        // Convertir canvas a blob y descargar
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Cita_${appointment.id}_${displayPatient.document}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          toast({
            title: "QR Generado",
            description: "El código QR de la cita se ha descargado exitosamente.",
          });
        }, 'image/png');
      };
      qrImage.src = qrCodeDataURL;

    } catch (error) {
      console.error('Error generando QR:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el código QR. Intente nuevamente.",
        variant: "destructive"
      });
    }
  };

  if (!displayPatient) return null;

  // Separar citas pasadas y futuras
  const now = new Date();
  const pastAppointments = appointments.filter(apt => {
    // Comparar fechas sin conversión de timezone
    const aptDate = apt.scheduled_at.split(' ')[0]; // "2025-10-20"
    const nowDate = now.toISOString().split('T')[0]; // "2025-10-13"
    return aptDate < nowDate;
  });
  const futureAppointments = appointments.filter(apt => {
    const aptDate = apt.scheduled_at.split(' ')[0];
    const nowDate = now.toISOString().split('T')[0];
    return aptDate >= nowDate;
  });

  // Función para renderizar una tarjeta de cita
  const renderAppointmentCard = (apt: Appointment) => {
    const aptDate = apt.scheduled_at.split(' ')[0];
    const nowDate = new Date().toISOString().split('T')[0];
    const isPast = aptDate < nowDate;
    
    // Formatear fecha sin conversión de timezone
    const formatAppointmentDate = (dateStr: string) => {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return 'Fecha inválida';
      
      const [, year, month, day] = match;
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      
      // Calcular día de la semana (algoritmo de Zeller simplificado)
      const d = Number(day);
      const m = Number(month);
      const y = Number(year);
      const tempDate = new Date(y, m - 1, d);
      const weekday = weekdays[tempDate.getDay()];
      
      return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${d} de ${months[m - 1]} de ${y}`;
    };
    
    const appointmentTime = apt.start_time || apt.scheduled_at.split(' ')[1]?.substring(0, 5) || '';
    
    return (
      <div key={apt.id} className={`p-4 border rounded-lg ${isPast ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="h-4 w-4 text-gray-600" />
              <span className="font-semibold">
                {formatAppointmentDate(apt.scheduled_at)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-3 w-3" />
              <span>{appointmentTime}</span>
            </div>
          </div>
          <Badge variant={isPast ? "secondary" : "default"}>
            {apt.status}
          </Badge>
        </div>
        
        <div className="space-y-1 text-sm">
          <p><strong>Especialidad:</strong> {apt.specialty_name}</p>
          <p><strong>Médico:</strong> {apt.doctor_name}</p>
          <p><strong>Sede:</strong> {apt.location_name}</p>
          {apt.reason && <p><strong>Motivo:</strong> {apt.reason}</p>}
        </div>
        
        {/* Botón de descarga de QR */}
        <div className="mt-3 pt-3 border-t border-gray-300">
          <Button
            onClick={() => generateAppointmentQR(apt)}
            variant="outline"
            size="sm"
            className="w-full gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-none"
          >
            <QrCode className="w-3 h-3" />
            <Download className="w-3 h-3" />
            Descargar QR
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditMode ? 'Editar Paciente' : 'Detalles del Paciente'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Modifica la información del paciente y guarda los cambios.' : 'Información completa del paciente registrado en el sistema.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Información del Paciente</TabsTrigger>
            <TabsTrigger value="appointments">Historial de Citas</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <form 
              onSubmit={handleSubmit(onSubmit)} 
              className="space-y-6"
              onKeyDown={(e) => {
                // Prevenir submit con Enter excepto en el campo de email o cuando estamos en modo edición
                if (e.key === 'Enter' && !isEditMode) {
                  e.preventDefault();
                }
              }}
            >
          {/* Información Personal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Información Personal
              </h3>
              
              {isEditMode ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="name">Nombre Completo *</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      className={errors.name ? 'border-red-500' : ''}
                      placeholder="Ej: Juan Sebastián Correa Delgado"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="document">Número de Documento *</Label>
                    <Input
                      id="document"
                      {...register('document')}
                      className={errors.document ? 'border-red-500' : ''}
                      placeholder="Ej: 1100970967"
                    />
                    {errors.document && (
                      <p className="text-red-500 text-sm mt-1">{errors.document.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
                    <Input
                      id="birth_date"
                      type="date"
                      {...register('birth_date')}
                    />
                  </div>

                  <div>
                    <Label htmlFor="gender">Género</Label>
                    <Select
                      value={watch('gender')}
                      onValueChange={(value) => setValue('gender', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar género" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Femenino">Femenino</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                        <SelectItem value="No especificado">No especificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p><strong>Nombre completo:</strong> {patient?.name || 'No especificado'}</p>
                  <p><strong>Documento:</strong> {patient?.document || 'No especificado'}</p>
                  <p><strong>Fecha de nacimiento:</strong> {formatDateWithoutTimezone(patient?.birth_date)}</p>
                  <p><strong>Género:</strong> 
                    <Badge variant="outline" className="ml-2">
                      {patient?.gender || 'Otro'}
                    </Badge>
                  </p>
                </div>
              )}
            </div>

            {/* Información de Contacto */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Información de Contacto
              </h3>
              
              {isEditMode ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" {...register('phone')} />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Dirección</Label>
                    <Textarea id="address" {...register('address')} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {patient?.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {patient.phone}
                    </p>
                  )}
                  {patient?.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {patient.email}
                    </p>
                  )}
                  {patient?.address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {patient.address}
                    </p>
                  )}
                  {patient?.municipality && (
                    <p><strong>Municipio:</strong> {patient.municipality}</p>
                  )}
                  {patient?.zone_name && (
                    <p><strong>Zona:</strong> {patient.zone_name}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Información Médica y Demográfica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Información Médica */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Información Médica
              </h3>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-500">No hay información médica registrada</p>
              </div>
            </div>

            {/* Información de Seguro e Información Demográfica */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Seguro y Demografía
              </h3>
              
              <div className="space-y-2">
                {patient?.insurance_affiliation_type && (
                  <p><strong>Tipo de afiliación:</strong>
                    <Badge variant="outline" className="ml-2">{patient.insurance_affiliation_type}</Badge>
                  </p>
                )}
                {patient?.notes && (
                  <p><strong>Notas:</strong> {patient.notes}</p>
                )}
                {!patient?.insurance_affiliation_type && !patient?.notes && (
                  <p className="text-sm text-gray-500">No hay información de seguro registrada</p>
                )}
              </div>
            </div>
          </div>

          {/* Información del Sistema */}
          {!isEditMode && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Información del Sistema
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                {displayPatient?.created_at && (
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <strong>Creado:</strong> {new Date(displayPatient.created_at).toLocaleString()}
                  </p>
                )}
                {displayPatient?.updated_at && (
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <strong>Actualizado:</strong> {new Date(displayPatient.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {isEditMode ? (
              <>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cerrar
                </Button>
                <Button type="button" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
          </TabsContent>

          <TabsContent value="appointments" className="mt-4">
            <div className="space-y-4">
              {loadingAppointments ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Cargando citas...</p>
                </div>
              ) : (
                <>
                  {/* Citas Futuras */}
                  {futureAppointments.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-blue-600" />
                        Próximas Citas ({futureAppointments.length})
                      </h3>
                      <div className="grid gap-3">
                        {futureAppointments.map(apt => renderAppointmentCard(apt))}
                      </div>
                    </div>
                  )}

                  {/* Citas Pasadas */}
                  {pastAppointments.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-600" />
                        Historial de Citas ({pastAppointments.length})
                      </h3>
                      <div className="grid gap-3 max-h-96 overflow-y-auto">
                        {pastAppointments.reverse().map(apt => renderAppointmentCard(apt))}
                      </div>
                    </div>
                  )}

                  {/* Sin citas */}
                  {appointments.length === 0 && (
                    <div className="text-center py-12">
                      <CalendarDays className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg">No hay citas registradas</p>
                      <p className="text-gray-400 text-sm mt-2">
                        Este paciente aún no tiene citas programadas o realizadas.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PatientDetailsModal;