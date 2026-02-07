import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, LogOut, QrCode, Download, User, Phone, Mail, MapPin, Home, X, AlertTriangle, CalendarDays, Clock, MessageSquare, Bell, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import QRCode from 'qrcode';
import { useToast } from "@/hooks/use-toast";
import { convertUTCToColombiaTime, formatTimeToDisplay } from "@/utils/dateHelpers";

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
    // Crear URL de verificación pública
    const baseUrl = window.location.origin;
    const verifyUrl = `${baseUrl}/verificar/${appointment.appointment_id}`;

    // Generar QR code con la URL de verificación
    const qrCodeDataURL = await QRCode.toDataURL(verifyUrl, {
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
    ctx.fillText(convertUTCToColombiaTime(appointment.scheduled_time), 150, yPos);

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
  const [smsNotifications, setSmsNotifications] = useState<any[]>([]);
  const [loadingSms, setLoadingSms] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'citas' | 'notificaciones'>('citas');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [epsList, setEpsList] = useState<any[]>([]);
  const [zonesList, setZonesList] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [authorizedSpecialties, setAuthorizedSpecialties] = useState<any[]>([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<any>(null);
  const [availableLocations, setAvailableLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [waitingListResult, setWaitingListResult] = useState<any>(null);
  const [appointmentResult, setAppointmentResult] = useState<any>(null);

  // Set para rastrear qué especialidades tienen disponibilidad
  const [specialtiesWithAvailability, setSpecialtiesWithAvailability] = useState<Set<number>>(new Set<number>());
  
  // Estado para rastrear si estamos agendando desde lista de espera
  const [schedulingFromWaitingListId, setSchedulingFromWaitingListId] = useState<number | null>(null);

  // Estados para CUPS (Ecografías) - Múltiples códigos
  const [showCupsModal, setShowCupsModal] = useState(false);
  const [cupsCode, setCupsCode] = useState('');
  const [cupsData, setCupsData] = useState<any>(null);
  const [cupsManualName, setCupsManualName] = useState('');
  const [searchingCups, setSearchingCups] = useState(false);
  const [cupsNotFound, setCupsNotFound] = useState(false);
  const [cupsList, setCupsList] = useState<any[]>([]); // Lista de hasta 3 CUPS
  const [currentCupsIndex, setCurrentCupsIndex] = useState(0); // CUPS actual siendo editado

  // Estados para cancelación de citas
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellingAppointment, setCancellingAppointment] = useState(false);

  // Estados para reasignación de citas
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<any>(null);
  const [selectedNewSchedule, setSelectedNewSchedule] = useState<any>(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [reschedulingAppointment, setReschedulingAppointment] = useState(false);

  // Estados para filtro de sede en reasignación
  const [selectedLocationForReschedule, setSelectedLocationForReschedule] = useState<string>('');
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [filteredSchedules, setFilteredSchedules] = useState<any[]>([]);

  // Estados para selección de hora específica
  const [selectedScheduleForTime, setSelectedScheduleForTime] = useState<any>(null);
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Estados para cita doble
  const [isDoubleAppointment, setIsDoubleAppointment] = useState(false);
  const [consecutiveTimeAvailable, setConsecutiveTimeAvailable] = useState(false);
  const [nextConsecutiveTime, setNextConsecutiveTime] = useState<string | null>(null);

  // Estados para eliminar solicitud de lista de espera
  const [showDeleteWaitingListModal, setShowDeleteWaitingListModal] = useState(false);
  const [waitingListToDelete, setWaitingListToDelete] = useState<any>(null);
  const [deletingWaitingList, setDeletingWaitingList] = useState(false);

  // Estados para selección de hora en reasignación
  const [selectedScheduleForRescheduleTime, setSelectedScheduleForRescheduleTime] = useState<any>(null);
  const [showRescheduleTimeSelector, setShowRescheduleTimeSelector] = useState(false);
  const [selectedRescheduleTime, setSelectedRescheduleTime] = useState<string>('');

  // Estados para edición de teléfono
  const [showEditPhoneModal, setShowEditPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [updatingPhone, setUpdatingPhone] = useState(false);

  const { toast } = useToast();

  // Estado del formulario de registro
  const [registerForm, setRegisterForm] = useState({
    document: '',
    name: '',
    birth_date: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    eps: '',
    zone_id: ''
  });

  // Función para verificar disponibilidad de especialidades en lista de espera
  const checkAvailabilityForWaitingList = async () => {
    if (!waitingList || waitingList.length === 0) {
      setSpecialtiesWithAvailability(new Set());
      return;
    }

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      
      // Obtener especialidades únicas de la lista de espera
      const uniqueSpecialtyIds = [...new Set(waitingList.map((item: any) => item.specialty_id))];
      
      console.log('🔍 Verificando disponibilidad para especialidades:', uniqueSpecialtyIds);
      
      const availableSpecialties = new Set<number>();

      // Verificar disponibilidad para cada especialidad
      for (const specialtyId of uniqueSpecialtyIds) {
        const url = baseUrl.endsWith('/api')
          ? `${baseUrl}/availabilities/public?specialty_id=${specialtyId}`
          : `${baseUrl}/api/availabilities/public?specialty_id=${specialtyId}`;

        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            
            // Verificar si hay al menos una agenda con cupos disponibles
            if (Array.isArray(data) && data.length > 0) {
              // Filtrar solo fechas futuras (no incluir hoy)
              const now = new Date();
              const todayInColombia = new Date(now.getTime() - (5 * 60 * 60 * 1000));
              const todayStr = todayInColombia.toISOString().split('T')[0];
              
              const hasAvailableSlots = data.some((schedule: any) => 
                schedule.available_slots > 0 && schedule.date > todayStr
              );
              
              if (hasAvailableSlots) {
                availableSpecialties.add(specialtyId);
                console.log(`✅ Disponibilidad encontrada para especialidad ${specialtyId}`);
              }
            }
          }
        } catch (err) {
          console.error(`Error verificando especialidad ${specialtyId}:`, err);
        }
      }

      console.log('✅ Especialidades con disponibilidad:', Array.from(availableSpecialties));
      setSpecialtiesWithAvailability(availableSpecialties);
    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
    }
  };

  // useEffect para verificar disponibilidad cuando cambia la lista de espera
  useEffect(() => {
    if (isAuthenticated && waitingList.length > 0) {
      checkAvailabilityForWaitingList();
    }
  }, [isAuthenticated, waitingList]);

  // Cargar lista de EPS y Zonas al abrir el modal de registro
  useEffect(() => {
    if (showRegisterModal) {
      // Cargar EPS si no están cargadas
      if (epsList.length === 0) {
        console.log('🔄 Cargando lista de EPS...');
        const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
        const epsUrl = baseUrl.endsWith('/api') ? `${baseUrl}/lookups/public/eps` : `${baseUrl}/api/lookups/public/eps`;
        fetch(epsUrl)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              console.log('✅ EPS cargadas:', data.data.length, data.data);
              setEpsList(data.data);
            }
          })
          .catch(err => {
            console.error('❌ Error cargando EPS:', err);
            toast({
              title: "Advertencia",
              description: "No se pudieron cargar las EPS.",
              variant: "default"
            });
          });
      }

      // Cargar Zonas si no están cargadas
      if (zonesList.length === 0) {
        console.log('🔄 Cargando lista de Zonas...');
        const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
        const zonesUrl = baseUrl.endsWith('/api') ? `${baseUrl}/lookups/public/zones` : `${baseUrl}/api/lookups/public/zones`;
        fetch(zonesUrl)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              console.log('✅ Zonas cargadas:', data.data.length, data.data);
              setZonesList(data.data);
            }
          })
          .catch(err => {
            console.error('❌ Error cargando Zonas:', err);
            toast({
              title: "Advertencia",
              description: "No se pudieron cargar las zonas.",
              variant: "default"
            });
          });
      }
    }
  }, [showRegisterModal, toast]);

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
            // Obtener fecha actual en formato YYYY-MM-DD (hora de Colombia UTC-5)
            const now = new Date();
            const todayInColombia = new Date(now.getTime() - (5 * 60 * 60 * 1000));
            const todayStr = todayInColombia.toISOString().split('T')[0];

            // Filtrar citas canceladas Y citas con fechas pasadas
            const activeAppointments = (appointmentsJson.data || []).filter((apt: any) => {
              // Excluir citas canceladas
              if (apt.status === 'Cancelada') return false;
              // Excluir citas con fecha anterior a hoy
              if (apt.scheduled_date < todayStr) return false;
              return true;
            });
            setAppointments(activeAppointments);
            setWaitingList(appointmentsJson.waiting_list || []);
          } else {
            setAppointments([]);
            setWaitingList([]);
          }

          // Cargar notificaciones SMS del paciente
          try {
            setLoadingSms(true);
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
            
            // Cargar mensajes
            const smsResponse = await fetch(`${baseUrl}/sms/patient/${foundPatient.patient_id}?limit=50`);
            if (smsResponse.ok) {
              const smsJson = await smsResponse.json();
              setSmsNotifications(smsJson.data || []);
            } else {
              setSmsNotifications([]);
            }
            
            // Cargar conteo de no leídos
            const unreadResponse = await fetch(`${baseUrl}/sms/patient/${foundPatient.patient_id}/unread-count`);
            if (unreadResponse.ok) {
              const unreadJson = await unreadResponse.json();
              setUnreadCount(unreadJson.unread || 0);
            }
          } catch (smsErr) {
            console.error('Error cargando SMS:', smsErr);
            setSmsNotifications([]);
          } finally {
            setLoadingSms(false);
          }
        } catch (err) {
          console.error('Error cargando citas:', err);
          setAppointments([]);
          setWaitingList([]);
        }
      } else {
        // Paciente no encontrado - abrir modal de registro
        setRegisterForm({ ...registerForm, document: normalized });
        setShowRegisterModal(true);
        setError('');
      }
    } catch (err: any) {
      setError(err.message || 'Error al buscar paciente');
    } finally {
      setLoading(false);
    }
  };

  // Registrar nuevo paciente
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/patients-v2/public/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerForm),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "¡Registro exitoso!",
          description: "Tu cuenta ha sido creada. Ahora puedes acceder a tus citas.",
        });

        // Cerrar modal y hacer login automático con el documento
        setShowRegisterModal(false);

        // Buscar el paciente recién creado para hacer login automático
        const normalized = normalizeDocument(registerForm.document);
        const searchResponse: any = await api.searchPatientsV2(normalized);

        if (searchResponse.patients && searchResponse.patients.length > 0) {
          const foundPatient = searchResponse.patients[0];
          setPatient(foundPatient);
          setIsAuthenticated(true);
          setAppointments([]);
          setWaitingList([]);
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Error al registrar",
          description: errorData.error || "No se pudo completar el registro",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
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

  // Actualizar teléfono del paciente
  const handleUpdatePhone = async () => {
    if (!newPhone || newPhone.trim().length === 0) {
      toast({
        title: "Error",
        description: "Por favor, ingresa un número de teléfono válido",
        variant: "destructive",
      });
      return;
    }

    // Validar que tenga exactamente 10 dígitos (número colombiano sin código de país)
    const phoneDigits = newPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      toast({
        title: "Error",
        description: "El número debe tener exactamente 10 dígitos",
        variant: "destructive",
      });
      return;
    }

    // Agregar prefijo +57 al número
    const fullPhoneNumber = `+57${phoneDigits}`;

    setUpdatingPhone(true);

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/patients-v2/public/update-phone`
        : `${baseUrl}/api/patients-v2/public/update-phone`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: patient.patient_id,
          document: patient.document,
          phone: fullPhoneNumber,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar el estado del paciente con el nuevo teléfono
        setPatient({ ...patient, phone: fullPhoneNumber });
        
        toast({
          title: "Teléfono actualizado",
          description: "Tu número de teléfono se ha actualizado exitosamente",
        });

        setShowEditPhoneModal(false);
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo actualizar el teléfono",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error actualizando teléfono:', error);
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor",
        variant: "destructive",
      });
    } finally {
      setUpdatingPhone(false);
    }
  };

  // Abrir modal de agendamiento y cargar especialidades
  const handleOpenScheduleModal = async (preSelectedSpecialtyId?: number, waitingListId?: number) => {
    // Guardar el ID de lista de espera si se proporciona
    if (waitingListId) {
      setSchedulingFromWaitingListId(waitingListId);
      console.log(`📋 Agendando desde lista de espera ID: ${waitingListId}`);
    } else {
      setSchedulingFromWaitingListId(null);
    }
    if (!patient?.insurance_eps_id) {
      toast({
        title: "Error",
        description: "No se pudo determinar tu EPS. Por favor, actualiza tu información.",
        variant: "destructive",
      });
      return;
    }

    // Verificar que el EPS tenga acceso a al menos una ubicación
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const epsLocationsUrl = baseUrl.endsWith('/api')
        ? `${baseUrl}/locations/public/eps/${patient.insurance_eps_id}`
        : `${baseUrl}/api/locations/public/eps/${patient.insurance_eps_id}`;

      const locationsResponse = await fetch(epsLocationsUrl);
      if (locationsResponse.ok) {
        const locationData = await locationsResponse.json();
        if (!Array.isArray(locationData) || locationData.length === 0) {
          toast({
            title: "Sin acceso autorizado",
            description: "Tu EPS no tiene autorización para agendar citas en ninguna de nuestras sedes. Por favor, contacta a tu EPS para verificar la cobertura en Fundación Biosanar IPS.",
            variant: "destructive",
          });
          return;
        }
        console.log(`✅ EPS tiene acceso a ${locationData.length} ubicación(es): ${locationData.map(l => l.zone_name).join(', ')}`);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo verificar acceso por zonas, continuando...', error);
    }

    setShowScheduleModal(true);
    setLoadingSpecialties(true);

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/patients-v2/public/authorized-specialties/${patient.insurance_eps_id}`
        : `${baseUrl}/api/patients-v2/public/authorized-specialties/${patient.insurance_eps_id}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setAuthorizedSpecialties(data.data);
        console.log(`✅ Especialidades autorizadas cargadas: ${data.data.length}`);
        
        // Si se pasó un specialty_id, pre-seleccionarla automáticamente
        if (preSelectedSpecialtyId) {
          const specialty = data.data.find((s: any) => s.id === preSelectedSpecialtyId);
          if (specialty) {
            console.log(`🎯 Pre-seleccionando especialidad: ${specialty.name}`);
            // Dar tiempo para que se muestre el modal antes de seleccionar
            setTimeout(() => {
              handleSelectSpecialty(specialty);
            }, 300);
          }
        }
      } else {
        toast({
          title: "Error",
          description: "No se pudieron cargar las especialidades disponibles",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error cargando especialidades:', error);
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor",
        variant: "destructive",
      });
    } finally {
      setLoadingSpecialties(false);
    }
  };

  // Seleccionar especialidad y cargar sedes disponibles
  const handleSelectSpecialty = async (specialty: any) => {
    setSelectedSpecialty(specialty);
    setSelectedLocation(null); // Reset location selection
    setAvailableSchedules([]); // Reset schedules

    // Si es Ecografía, primero solicitar código CUPS
    if (specialty.name && specialty.name.toLowerCase().includes('ecograf')) {
      console.log('🔍 Especialidad de Ecografía detectada, solicitando código CUPS...');
      setShowCupsModal(true);
      return; // Detener aquí, continuará después de ingresar CUPS
    }

    // Para otras especialidades, cargar sedes disponibles
    await loadAvailableLocations(specialty);
  };

  // Función para cargar sedes disponibles para la especialidad
  const loadAvailableLocations = async (specialty: any) => {
    setLoadingSchedules(true);

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

      // Primero, verificar qué ubicaciones están autorizadas para este EPS
      const authorizedLocationsUrl = baseUrl.endsWith('/api')
        ? `${baseUrl}/locations/public/eps/${patient.insurance_eps_id}`
        : `${baseUrl}/api/locations/public/eps/${patient.insurance_eps_id}`;

      console.log(`🔍 Consultando ubicaciones autorizadas para EPS ${patient.insurance_eps_id}: ${authorizedLocationsUrl}`);

      const locationsResponse = await fetch(authorizedLocationsUrl);
      if (!locationsResponse.ok) {
        throw new Error(`Error al cargar ubicaciones autorizadas: ${locationsResponse.status}`);
      }

      const authorizedLocationsData = await locationsResponse.json();
      console.log(`✅ Ubicaciones autorizadas:`, authorizedLocationsData);

      if (!Array.isArray(authorizedLocationsData) || authorizedLocationsData.length === 0) {
        console.log(`❌ No hay ubicaciones autorizadas para este EPS`);
        setAvailableLocations([]);
        setAvailableSchedules([]);
        setLoadingSchedules(false);
        toast({
          title: "Sin acceso",
          description: `Tu EPS no tiene autorización para agendar citas en ninguna sede. Contacta a tu EPS para más información.`,
          variant: "destructive",
        });
        return;
      }

      // Extraer los IDs de las ubicaciones autorizadas
      const authorizedLocationIds = authorizedLocationsData.map(loc => loc.id);
      console.log(`🏥 IDs de ubicaciones autorizadas: [${authorizedLocationIds.join(', ')}]`);

      // Ahora cargar las agendas disponibles para la especialidad
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/availabilities/public?specialty_id=${specialty.id}`
        : `${baseUrl}/api/availabilities/public?specialty_id=${specialty.id}`;

      console.log(`🔍 Consultando agendas disponibles: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`❌ Error HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();

      // El nuevo endpoint devuelve directamente un array de agendas con cupos
      if (Array.isArray(data) && data.length > 0) {
        // Obtener la fecha actual en Colombia (UTC-5)
        const now = new Date();
        const todayInColombia = new Date(now.getTime() - (5 * 60 * 60 * 1000)); // Ajustar a UTC-5
        const todayStr = todayInColombia.toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`📅 Hoy en Colombia: ${todayStr}`);

        // Filtrar agendas: solo las que NO sean del día actual Y que estén en ubicaciones autorizadas
        const schedulesWithSlots = data.filter((schedule: any) => {
          // Excluir SOLO el día actual, permitir desde mañana en adelante
          const isNotToday = schedule.date > todayStr;

          // Verificar si la ubicación está autorizada para este EPS
          const isLocationAuthorized = authorizedLocationIds.includes(schedule.location_id);

          if (!isNotToday) {
            console.log(`❌ Excluyendo agenda del ${schedule.date} (es hoy o pasado)`);
          }

          if (!isLocationAuthorized) {
            console.log(`❌ Excluyendo agenda en ${schedule.location_name} (ubicación no autorizada para este EPS)`);
          }

          return isNotToday && isLocationAuthorized;
        });

        if (schedulesWithSlots.length > 0) {
          // Extraer sedes únicas solo de las agendas con cupos disponibles Y autorizadas
          const locationsMap = new Map();
          schedulesWithSlots.forEach((schedule: any) => {
            if (!locationsMap.has(schedule.location_name)) {
              // Buscar la información completa de la ubicación autorizada
              const authorizedLocation = authorizedLocationsData.find(loc => loc.id === schedule.location_id);
              locationsMap.set(schedule.location_name, {
                name: schedule.location_name,
                address: schedule.location_address || authorizedLocation?.address || 'Dirección no disponible',
                zone_name: authorizedLocation?.zone_name || 'Zona no especificada',
                eps_name: authorizedLocation?.eps_name || 'EPS no especificada',
                schedules_count: 0
              });
            }
            const loc = locationsMap.get(schedule.location_name);
            loc.schedules_count++;
          });

          const locations = Array.from(locationsMap.values());
          setAvailableLocations(locations);

          console.log(`🏥 Ubicaciones disponibles filtradas por EPS: `, locations);

          // Adaptar el formato para que sea compatible con el resto del código
          const adaptedSchedules = schedulesWithSlots.map((schedule: any) => ({
            ...schedule,
            // Normalizar campos: algunas APIs devuelven `id`, otras `availability_id`
            availability_id: schedule.availability_id || schedule.id,
            appointment_date: schedule.date,
            slots_available: schedule.available_slots,
            // available_time se usa en la vista de reasignación; usar start_time como fallback
            available_time: schedule.available_time || schedule.start_time || schedule.start_time_formatted
          }));

          setAvailableSchedules(adaptedSchedules);

          console.log(`✅ Sedes con cupos disponibles (sin agendas de hoy): ${locations.length}`, locations);
        } else {
          // NO hay cupos disponibles en ninguna agenda futura, ir directo a lista de espera
          console.log('⚠️ No hay cupos disponibles en fechas futuras, agregando a lista de espera...');
          await addToWaitingListAuto(specialty);
        }
      } else {
        // NO hay agendas, agregar automáticamente a lista de espera
        console.log('⚠️ No hay agendas disponibles, agregando a lista de espera...');
        await addToWaitingListAuto(specialty);
      }
    } catch (error: any) {
      console.error('❌ Error cargando sedes:', error);
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor",
        variant: "destructive",
      });
      // En caso de error, también agregar a lista de espera
      await addToWaitingListAuto(specialty);
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Función para seleccionar una sede y mostrar sus agendas
  const handleSelectLocation = (location: any) => {
    setSelectedLocation(location);
    console.log(`📍 Sede seleccionada: ${location.name}`);
  };

  // Agregar automáticamente a lista de espera cuando no hay agenda
  const addToWaitingListAuto = async (specialty: any) => {
    // Si es ecografía y tenemos datos de CUPS, usar endpoint especializado
    if (specialty.name && specialty.name.toLowerCase().includes('ecograf') && (cupsData || cupsManualName.trim())) {
      await addToWaitingListWithCups(specialty);
      return;
    }

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/patients-v2/public/add-to-waiting-list`
        : `${baseUrl}/api/patients-v2/public/add-to-waiting-list`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.patient_id,
          specialty_id: specialty.id,
          eps_id: patient.insurance_eps_id,
          reason: `Consulta de ${specialty.name}`
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Guardar resultado para mostrar en el modal
        setWaitingListResult({
          specialty: specialty.name,
          position: data.data.position,
          waiting_list_id: data.data.waiting_list_id,
          message: data.data.message
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo agregar a la lista de espera",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error agregando a lista de espera:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive",
      });
    }
  };

  // Buscar código CUPS en la base de datos
  const handleSearchCups = async () => {
    if (!cupsCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código CUPS",
        variant: "destructive",
      });
      return;
    }

    setSearchingCups(true);
    setCupsNotFound(false);

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/patients-v2/public/search-cups/${cupsCode.trim()}`
        : `${baseUrl}/api/patients-v2/public/search-cups/${cupsCode.trim()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.found) {
        // Código CUPS encontrado
        setCupsData(data.data);
        setCupsNotFound(false);
        toast({
          title: "Código encontrado",
          description: `Estudio: ${data.data.name}`,
        });
      } else {
        // Código no encontrado, permitir ingreso manual
        setCupsNotFound(true);
        setCupsData(null);
        toast({
          title: "Código no encontrado",
          description: "Por favor ingresa el nombre del estudio manualmente",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error buscando código CUPS:', error);
      toast({
        title: "Error",
        description: "No se pudo buscar el código CUPS",
        variant: "destructive",
      });
    } finally {
      setSearchingCups(false);
    }
  };

  // Confirmar CUPS y continuar con agendamiento
  const handleConfirmCups = async () => {
    // Validar que tengamos al menos un CUPS en la lista
    if (cupsList.length === 0) {
      toast({
        title: "Error",
        description: "Por favor agrega al menos un estudio",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ handleConfirmCups - cupsList:', cupsList);

    // Cerrar modal de CUPS
    setShowCupsModal(false);

    // Continuar con el flujo normal de agendamiento cargando las sedes disponibles
    if (selectedSpecialty) {
      await loadAvailableLocations(selectedSpecialty);
    }
  };

  // Agregar a lista de espera con información de CUPS
  const addToWaitingListWithCups = async (specialty: any) => {
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/patients-v2/public/add-to-waiting-list-with-cups`
        : `${baseUrl}/api/patients-v2/public/add-to-waiting-list-with-cups`;

      const requestBody: any = {
        patient_id: patient.patient_id,
        specialty_id: specialty.id,
        eps_id: patient.insurance_eps_id,
        reason: `Consulta de ${specialty.name}`
      };

      // Agregar información de múltiples CUPS
      if (cupsList.length > 0) {
        requestBody.cups_list = cupsList.map(cups => ({
          cups_id: cups.id || null,
          cups_code: cups.code,
          cups_name: cups.name,
          category: cups.category || null,
          manual: cups.manual || false
        }));

        // Crear descripción con todos los estudios
        const studiesNames = cupsList.map(c => c.name).join(', ');
        requestBody.reason = `${specialty.name} - Estudios: ${studiesNames}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        // Guardar resultado para mostrar en el modal
        setWaitingListResult({
          specialty: specialty.name,
          position: data.data.position,
          waiting_list_id: data.data.waiting_list_id,
          cups_count: cupsList.length,
          cups_names: cupsList.map(c => c.name).join(', '),
          message: data.data.message
        });

        // Limpiar estados de CUPS
        setCupsCode('');
        setCupsData(null);
        setCupsManualName('');
        setCupsNotFound(false);
        setCupsList([]);
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo agregar a la lista de espera",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error agregando a lista de espera con CUPS:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive",
      });
    }
  };

  // Validar si hay horarios consecutivos disponibles
  const checkConsecutiveTimeSlots = (selectedTime: string, availableSlots: string[]): { available: boolean; nextTime: string | null; error?: string } => {
    try {
      if (!selectedTime || !availableSlots || availableSlots.length === 0) {
        return { available: false, nextTime: null };
      }

      // Ordenar los slots disponibles cronológicamente
      const sortedSlots = [...availableSlots].sort((a, b) => {
        const [ha, ma] = a.split(':').map(Number);
        const [hb, mb] = b.split(':').map(Number);
        return (ha * 60 + ma) - (hb * 60 + mb);
      });

      // Encontrar el índice del slot seleccionado
      const selectedIndex = sortedSlots.indexOf(selectedTime);

      if (selectedIndex === -1) {
        console.warn(`[checkConsecutiveTimeSlots] Hora ${selectedTime} no encontrada en slots disponibles`);
        return { available: false, nextTime: null };
      }

      if (selectedIndex >= sortedSlots.length - 1) {
        // Es el último slot, no hay consecutivo
        return { available: false, nextTime: null };
      }

      // El siguiente slot en la lista ordenada
      const nextTime = sortedSlots[selectedIndex + 1];

      // Calcular el intervalo mínimo de la agenda analizando TODOS los pares consecutivos
      // Esto es más robusto que usar solo los primeros dos slots
      let minInterval = 60; // valor máximo inicial (60 min)

      for (let i = 0; i < sortedSlots.length - 1; i++) {
        const [h1, m1] = sortedSlots[i].split(':').map(Number);
        const [h2, m2] = sortedSlots[i + 1].split(':').map(Number);
        const interval = (h2 * 60 + m2) - (h1 * 60 + m1);

        // Solo considerar intervalos positivos y razonables (entre 5 y 60 min)
        if (interval > 0 && interval <= 60 && interval < minInterval) {
          minInterval = interval;
        }
      }

      // Si no encontramos un intervalo válido, usar 30 min por defecto
      if (minInterval === 60) {
        minInterval = 30;
      }

      // Verificar que el siguiente slot está dentro del intervalo esperado
      const [selH, selM] = selectedTime.split(':').map(Number);
      const [nextH, nextM] = nextTime.split(':').map(Number);
      const actualInterval = (nextH * 60 + nextM) - (selH * 60 + selM);

      console.log(`[checkConsecutiveTimeSlots] Hora: ${selectedTime}, Siguiente: ${nextTime}, Intervalo actual: ${actualInterval}min, Intervalo mínimo detectado: ${minInterval}min`);

      // El siguiente slot debe estar dentro del intervalo mínimo detectado (con margen de 5 minutos)
      const isConsecutive = actualInterval > 0 && actualInterval <= minInterval + 5;

      return {
        available: isConsecutive,
        nextTime: isConsecutive ? nextTime : null
      };
    } catch (error) {
      console.error('[checkConsecutiveTimeSlots] Error:', error);
      return {
        available: false,
        nextTime: null,
        error: 'Error al verificar horarios consecutivos'
      };
    }
  };

  // Agendar cita con hora secuencial
  const handleScheduleAppointment = async (schedule: any) => {
    // Si no hay horarios específicos disponibles o solo hay uno, agendar directamente
    if (!schedule.available_time_slots || schedule.available_time_slots.length === 0) {
      await scheduleAppointmentDirectly(schedule, null);
      return;
    }

    // Si solo hay una hora disponible, agendar directamente
    if (schedule.available_time_slots.length === 1) {
      await scheduleAppointmentDirectly(schedule, schedule.available_time_slots[0]);
      return;
    }

    // Si hay múltiples horarios, mostrar selector
    setSelectedScheduleForTime(schedule);
    setSelectedTime('');
    setShowTimeSelector(true);
  };

  // Confirmar agendamiento con hora seleccionada
  const confirmScheduleWithTime = async () => {
    if (!selectedScheduleForTime || !selectedTime) return;

    // Si se solicita cita doble y la especialidad lo permite, verificar que hay horarios consecutivos
    if (isDoubleAppointment && Boolean(Number(selectedSpecialty?.allows_double_appointment))) {
      if (!consecutiveTimeAvailable || !nextConsecutiveTime) {
        toast({
          title: "Horarios consecutivos no disponibles",
          description: "No hay dos horarios consecutivos disponibles para la fecha seleccionada. Por favor, selecciona una hora diferente o agenda una cita sencilla.",
          variant: "destructive",
          duration: 6000,
        });
        return;
      }
    }

    setShowTimeSelector(false);
    await scheduleAppointmentDirectly(selectedScheduleForTime, selectedTime);
    setSelectedScheduleForTime(null);
    setSelectedTime('');
    setIsDoubleAppointment(false);
    setConsecutiveTimeAvailable(false);
    setNextConsecutiveTime(null);
  };

  // Función principal de agendamiento
  const scheduleAppointmentDirectly = async (schedule: any, selectedTimeSlot?: string) => {
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/patients-v2/public/schedule-appointment`
        : `${baseUrl}/api/patients-v2/public/schedule-appointment`;

      const allowsDouble = Boolean(Number(selectedSpecialty?.allows_double_appointment));
      const shouldCreateDouble = isDoubleAppointment && allowsDouble && consecutiveTimeAvailable && nextConsecutiveTime;

      const requestBody: any = {
        patient_id: patient.patient_id,
        specialty_id: selectedSpecialty.id,
        doctor_id: schedule.doctor_id,
        availability_id: schedule.availability_id,
        reason: shouldCreateDouble
          ? `Consulta de ${selectedSpecialty.name} - CITA DOBLE (1/2)`
          : `Consulta de ${selectedSpecialty.name}`
      };

      // Agregar hora específica si fue seleccionada
      if (selectedTimeSlot) {
        requestBody.selected_time = selectedTimeSlot;
      }

      // DEBUG: Ver estado de CUPS
      console.log('🔍 DEBUG CUPS:', {
        cupsList_length: cupsList.length,
        cupsList: cupsList,
        cupsData: cupsData,
        cupsManualName: cupsManualName
      });

      // Agregar información de CUPS si existe (para Ecografías)
      // Prioridad: cupsList (múltiples CUPS) > cupsData (CUPS individual) > cupsManualName
      if (cupsList.length > 0) {
        // Usar el primer CUPS de la lista como cups_id principal
        const firstCups = cupsList[0];
        requestBody.cups_id = firstCups.id || null;
        requestBody.cups_name = firstCups.name;
        requestBody.cups_code = firstCups.code;

        // Enviar la lista completa para múltiples estudios
        requestBody.cups_list = cupsList.map(cups => ({
          cups_id: cups.id || null,
          cups_code: cups.code,
          cups_name: cups.name,
          category: cups.category || null,
          manual: cups.manual || false
        }));

        // Agregar descripción de todos los estudios al motivo
        const studiesNames = cupsList.map(c => c.name).join(', ');
        requestBody.reason = shouldCreateDouble
          ? `${selectedSpecialty.name} - Estudios: ${studiesNames} - CITA DOBLE (1/2)`
          : `${selectedSpecialty.name} - Estudios: ${studiesNames}`;
      } else if (cupsData) {
        requestBody.cups_id = cupsData.id;
        requestBody.cups_name = cupsData.name;
        requestBody.cups_code = cupsData.code;
      } else if (cupsManualName.trim()) {
        requestBody.cups_name = cupsManualName.trim();
      }

      // Crear la primera cita
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        let appointmentData = {
          appointment_id: data.data.appointment_id,
          doctor_name: data.data.doctor_name,
          appointment_date: data.data.appointment_date,
          scheduled_time: data.data.scheduled_time,
          location_name: schedule.location_name,
          specialty: selectedSpecialty.name,
          cups_name: cupsData?.name || cupsManualName || null
        };

        // Si es cita doble, crear la segunda cita
        if (shouldCreateDouble && nextConsecutiveTime) {
          console.log('🔄 Creando segunda cita consecutiva para:', nextConsecutiveTime);

          const secondRequestBody = {
            ...requestBody,
            selected_time: nextConsecutiveTime,
            reason: `Consulta de ${selectedSpecialty.name} - CITA DOBLE (2/2)`,
            is_consecutive_double: true,
            first_appointment_id: data.data.appointment_id
          };

          try {
            const secondResponse = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(secondRequestBody),
            });

            const secondData = await secondResponse.json();

            if (secondData.success) {
              console.log('✅ Segunda cita creada exitosamente:', secondData.data.appointment_id);
              toast({
                title: "¡Cita doble confirmada!",
                description: `Se han creado dos citas consecutivas: ${data.data.scheduled_time} y ${nextConsecutiveTime}`,
                duration: 5000,
              });
            } else {
              console.error('❌ Error creando segunda cita:', secondData.error);
              toast({
                title: "Advertencia",
                description: "La primera cita fue creada, pero hubo un problema con la segunda. Por favor, contacta con nosotros.",
                variant: "destructive",
                duration: 8000,
              });
            }
          } catch (secondError) {
            console.error('❌ Error en creación de segunda cita:', secondError);
            toast({
              title: "Advertencia",
              description: "La primera cita fue creada, pero hubo un problema con la segunda. Por favor, contacta con nosotros.",
              variant: "destructive",
              duration: 8000,
            });
          }
        }

        // Mostrar resultado exitoso
        setAppointmentResult(appointmentData);
        
        // Si se agendó desde lista de espera, marcarla como "assigned"
        if (schedulingFromWaitingListId) {
          try {
            console.log(`📝 Marcando lista de espera ID ${schedulingFromWaitingListId} como "reassigned"...`);
            
            const updateUrl = baseUrl.endsWith('/api')
              ? `${baseUrl}/patients-v2/public/waiting-list/${schedulingFromWaitingListId}/status`
              : `${baseUrl}/api/patients-v2/public/waiting-list/${schedulingFromWaitingListId}/status`;
            
            const statusResponse = await fetch(updateUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'reassigned' })
            });
            
            if (statusResponse.ok) {
              console.log(`✅ Lista de espera marcada como "reassigned"`);
              
              // Recargar la lista de espera para reflejar el cambio
              const appointmentsUrl = baseUrl.endsWith('/api')
                ? `${baseUrl}/patients-v2/${patient.patient_id}/appointments`
                : `${baseUrl}/api/patients-v2/${patient.patient_id}/appointments`;
              
              const wlResponse = await fetch(appointmentsUrl);
              if (wlResponse.ok) {
                const wlData = await wlResponse.json();
                if (wlData.success) {
                  // Actualizar tanto las citas como la lista de espera
                  setAppointments(wlData.data || []);
                  setWaitingList(wlData.waiting_list || []);
                  console.log(`🔄 Lista de espera actualizada (${wlData.waiting_list?.length || 0} solicitudes pendientes)`);
                }
              }
            } else {
              console.warn(`⚠️ No se pudo actualizar el estado de lista de espera:`, await statusResponse.text());
            }
            
            // Limpiar el ID de lista de espera
            setSchedulingFromWaitingListId(null);
          } catch (updateError) {
            console.error('Error actualizando lista de espera:', updateError);
            // No mostrar error al usuario ya que la cita se agendó correctamente
          }
        }

        // Limpiar estados de CUPS
        setCupsCode('');
        setCupsData(null);
        setCupsManualName('');
        setCupsNotFound(false);
        setCupsList([]); // Limpiar lista de múltiples CUPS

        // Limpiar caché de horarios y formularios para evitar datos obsoletos
        try {
          sessionStorage.removeItem('availableSchedules');
          sessionStorage.removeItem('selectedTime');
          sessionStorage.removeItem('scheduleCache');
        } catch (error) {
          console.error('Error limpiando sessionStorage:', error);
        }
      } else {
        // Manejar error específico de cita activa por especialidad (409)
        if (response.status === 409) {
          const details = data.details;
          toast({
            title: "Ya tienes una cita en esta especialidad",
            description: data.message || `Ya tienes una cita ${details?.status?.toLowerCase()} programada para el ${details?.scheduled_date} a las ${details?.scheduled_time}. Solo puedes tener una cita activa por especialidad.`,
            variant: "destructive",
            duration: 8000, // Mostrar por más tiempo para que puedan leer
          });
        } else {
          toast({
            title: "Error",
            description: data.error || "No se pudo agendar la cita",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error agendando cita:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive",
      });
    }
  };

  // Función para cancelar una cita
  const handleCancelAppointment = async () => {
    if (!appointmentToCancel || !patient) return;

    try {
      setCancellingAppointment(true);

      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/patients-v2/public/appointments/${appointmentToCancel.appointment_id}/cancel`
        : `${baseUrl}/api/patients-v2/public/appointments/${appointmentToCancel.appointment_id}/cancel`;

      // Verificar si viene el ID de cita relacionada (cita doble)
      const relatedAppointmentId = (appointmentToCancel as any).relatedAppointmentId;
      const isDoubleAppointment = !!relatedAppointmentId;

      console.log('🔍 Cancelando cita:', appointmentToCancel.appointment_id);
      if (isDoubleAppointment) {
        console.log('✅ Es cita doble, también se cancelará cita relacionada:', relatedAppointmentId);
      }

      // Cancelar la cita principal
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.patient_id,
          cancellationReason: cancellationReason
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar la lista de citas
        let updatedAppointments = appointments.map(apt =>
          apt.appointment_id === appointmentToCancel.appointment_id
            ? { ...apt, status: 'Cancelada' }
            : apt
        );

        // Si es cita doble, cancelar también la cita relacionada
        if (isDoubleAppointment && relatedAppointmentId) {
          console.log(`🔄 Cancelando cita relacionada ID ${relatedAppointmentId}...`);
          const relatedUrl = baseUrl.endsWith('/api')
            ? `${baseUrl}/patients-v2/public/appointments/${relatedAppointmentId}/cancel`
            : `${baseUrl}/api/patients-v2/public/appointments/${relatedAppointmentId}/cancel`;

          try {
            const relatedResponse = await fetch(relatedUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                patientId: patient.patient_id,
                cancellationReason: `${cancellationReason} (cita doble relacionada)`
              }),
            });

            const relatedData = await relatedResponse.json();
            if (relatedData.success) {
              console.log(`✅ Cita relacionada cancelada exitosamente`);
              updatedAppointments = updatedAppointments.map(apt =>
                apt.appointment_id === relatedAppointmentId
                  ? { ...apt, status: 'Cancelada' }
                  : apt
              );
            } else {
              console.error('❌ Error cancelando cita relacionada:', relatedData.error);
            }
          } catch (relatedError) {
            console.error('❌ Error en cancelación de cita relacionada:', relatedError);
          }
        }

        setAppointments(updatedAppointments);

        // Cerrar modal y limpiar estados
        setShowCancelDialog(false);
        setAppointmentToCancel(null);
        setCancellationReason('');

        toast({
          title: "Cita cancelada",
          description: isDoubleAppointment
            ? `Ambas citas del ${appointmentToCancel.scheduled_date} han sido canceladas exitosamente.`
            : `Tu cita del ${appointmentToCancel.scheduled_date} a las ${convertUTCToColombiaTime(appointmentToCancel.scheduled_time)} ha sido cancelada exitosamente.`,
          variant: "default",
        });
      } else {
        // Si el error es que la cita ya está cancelada, actualizar el estado local
        if (data.error && data.error.includes('ya está cancelada')) {
          setAppointments(prev => prev.map(apt =>
            apt.appointment_id === appointmentToCancel.appointment_id
              ? { ...apt, status: 'Cancelada' }
              : apt
          ));

          setShowCancelDialog(false);
          setAppointmentToCancel(null);
          setCancellationReason('');

          toast({
            title: "Cita cancelada",
            description: "Esta cita ya estaba cancelada en el sistema.",
            variant: "default",
          });
        } else {
          toast({
            title: "Error al cancelar",
            description: data.error || "No se pudo cancelar la cita",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error cancelando cita:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la cancelación",
        variant: "destructive",
      });
    } finally {
      setCancellingAppointment(false);
    }
  };

  // Función para abrir el diálogo de cancelación
  const openCancelDialog = (appointment: any) => {
    setAppointmentToCancel(appointment);
    setShowCancelDialog(true);
    setCancellationReason('');
  };

  // Función para abrir el diálogo de reasignación
  const openRescheduleDialog = async (appointment: any) => {
    setAppointmentToReschedule(appointment);
    setRescheduleReason('');
    setSelectedNewSchedule(null);
    setAvailableSchedules([]);
    setSelectedLocationForReschedule('');
    setShowLocationSelector(true);
    setFilteredSchedules([]);
    setShowRescheduleDialog(true);

    // Cargar horarios disponibles para mostrar las sedes disponibles
    await loadAvailableSchedules(appointment.specialty_id, patient.insurance_eps_id);
  };

  // Función para cargar horarios disponibles
  const loadAvailableSchedules = async (specialtyId: number, epsId: number) => {
    setLoadingSchedules(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/patients-v2/public/available-schedules/${specialtyId}/${epsId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success && data.data) {
        setAvailableSchedules(data.data);
      } else {
        toast({
          title: "Error",
          description: "No se pudieron cargar los horarios disponibles",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error cargando horarios:', error);
      toast({
        title: "Error",
        description: "Error de conexión al cargar horarios",
        variant: "destructive",
      });
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Función para seleccionar sede y filtrar horarios
  const selectLocationForReschedule = (locationName: string) => {
    setSelectedLocationForReschedule(locationName);
    setShowLocationSelector(false);

    // Filtrar horarios por sede seleccionada
    const filtered = availableSchedules.filter(schedule =>
      schedule.location_name.toLowerCase().includes(locationName.toLowerCase())
    );
    setFilteredSchedules(filtered);
  };

  // Función para obtener las sedes únicas disponibles
  const getAvailableLocations = () => {
    const locations = new Set<string>();
    availableSchedules.forEach(schedule => {
      const locationName = schedule.location_name.toLowerCase();
      if (locationName.includes('san gil')) {
        locations.add('San Gil');
      } else if (locationName.includes('socorro')) {
        locations.add('Socorro');
      }
    });
    return Array.from(locations);
  };

  // Función para obtener color por sede
  const getLocationColor = (locationName: string) => {
    if (locationName.toLowerCase().includes('san gil')) {
      return {
        bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-300',
        selected: 'border-blue-500 bg-blue-50',
        text: 'text-blue-700',
        badge: 'bg-blue-500'
      };
    } else if (locationName.toLowerCase().includes('socorro')) {
      return {
        bg: 'bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-300',
        selected: 'border-orange-500 bg-orange-50',
        text: 'text-orange-700',
        badge: 'bg-orange-500'
      };
    }
    return {
      bg: 'bg-gray-50 hover:bg-gray-100 border-gray-200 hover:border-gray-300',
      selected: 'border-gray-500 bg-gray-50',
      text: 'text-gray-700',
      badge: 'bg-gray-500'
    };
  };

  // Función para eliminar solicitud de lista de espera
  const handleDeleteWaitingList = async () => {
    if (!waitingListToDelete || !patient) return;

    try {
      setDeletingWaitingList(true);

      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api')
        ? `${baseUrl}/appointments/waiting-list/patient/${patient.patient_id}/${waitingListToDelete.id}`
        : `${baseUrl}/api/appointments/waiting-list/patient/${patient.patient_id}/${waitingListToDelete.id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar la lista de espera local
        setWaitingList(prev => prev.filter(item => item.id !== waitingListToDelete.id));

        toast({
          title: "Solicitud eliminada",
          description: "Tu solicitud ha sido eliminada de la cola de espera exitosamente",
        });

        setShowDeleteWaitingListModal(false);
        setWaitingListToDelete(null);
      } else {
        toast({
          title: "Error",
          description: data.message || "No se pudo eliminar la solicitud",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error eliminando solicitud:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive",
      });
    } finally {
      setDeletingWaitingList(false);
    }
  };

  // Función para procesar la reasignación
  const handleRescheduleAppointment = async () => {
    if (!appointmentToReschedule || !selectedNewSchedule || !rescheduleReason.trim()) {
      toast({
        title: "Error",
        description: "Debe seleccionar un nuevo horario y proporcionar un motivo",
        variant: "destructive",
      });
      return;
    }

    // Verificar si el horario seleccionado tiene múltiples horas disponibles
    if (selectedNewSchedule.available_time_slots && selectedNewSchedule.available_time_slots.length > 1) {
      // Mostrar selector de hora específica para reasignación
      setSelectedScheduleForRescheduleTime(selectedNewSchedule);
      setSelectedRescheduleTime('');
      setShowRescheduleTimeSelector(true);
      return;
    }

    // Si solo hay una hora o ningún slot específico, proceder con reasignación directa
    const selectedTime = selectedNewSchedule.available_time_slots && selectedNewSchedule.available_time_slots.length === 1
      ? selectedNewSchedule.available_time_slots[0]
      : null;

    await executeReschedule(selectedTime);
  };

  // Confirmar reasignación con hora seleccionada
  const confirmRescheduleWithTime = async () => {
    if (!selectedRescheduleTime) return;

    setShowRescheduleTimeSelector(false);
    await executeReschedule(selectedRescheduleTime);
    setSelectedScheduleForRescheduleTime(null);
    setSelectedRescheduleTime('');
  };

  // Función principal de reasignación
  const executeReschedule = async (selectedTimeSlot?: string) => {
    setReschedulingAppointment(true);

    try {
      const requestBody: any = {
        patientId: patient.patient_id,
        newAvailabilityId: selectedNewSchedule.availability_id,
        reason: rescheduleReason.trim(),
      };

      // Agregar hora específica si fue seleccionada
      if (selectedTimeSlot) {
        requestBody.selected_time = selectedTimeSlot;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/patients-v2/public/appointments/${appointmentToReschedule.appointment_id}/reschedule`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Usar la hora formateada que viene del backend (ya está en UTC-5)
        // selectedTimeSlot viene de available_time_slots (ya convertido a Colombia)
        // selectedNewSchedule.start_time viene en UTC y necesita conversión
        const horaFormateada = data.data?.scheduled_time
          || (selectedTimeSlot ? formatTimeToDisplay(selectedTimeSlot) : convertUTCToColombiaTime(selectedNewSchedule.start_time));

        // Actualizar la lista de citas con los nuevos datos
        setAppointments(prev => prev.map(apt =>
          apt.appointment_id === appointmentToReschedule.appointment_id
            ? {
              ...apt,
              scheduled_date: selectedNewSchedule.appointment_date,
              scheduled_time: horaFormateada, // Usar la hora ya formateada en UTC-5
              doctor_name: selectedNewSchedule.doctor_name,
              location_name: selectedNewSchedule.location_name
            }
            : apt
        ));

        // Cerrar modal y limpiar estados
        setShowRescheduleDialog(false);
        setShowRescheduleTimeSelector(false);
        setAppointmentToReschedule(null);
        setSelectedNewSchedule(null);
        setSelectedScheduleForRescheduleTime(null);
        setSelectedRescheduleTime('');
        setRescheduleReason('');
        setAvailableSchedules([]);

        toast({
          title: "✅ Cita reagendada exitosamente",
          description: `Tu cita ha sido reagendada para el ${formatDateDDMMYYYY(selectedNewSchedule.appointment_date)} a las ${horaFormateada} con ${selectedNewSchedule.doctor_name}. Te enviamos un SMS de confirmación.`,
          variant: "default",
        });
      } else {
        // Mensajes de error más específicos según el tipo
        let errorMessage = data.error || "No se pudo reagendar la cita";
        let errorTitle = "Error al reagendar";

        if (data.error?.includes('Ya hay una cita programada')) {
          errorMessage = "Ese horario ya fue ocupado. Por favor selecciona otro horario disponible.";
          errorTitle = "Horario no disponible";
        } else if (data.error?.includes('fuera del horario')) {
          errorMessage = "La hora seleccionada está fuera del horario de atención. Intenta con otra hora.";
          errorTitle = "Hora fuera de rango";
        } else if (data.error?.includes('no hay cupos')) {
          errorMessage = "No hay más cupos disponibles en esta agenda. Por favor selecciona otra fecha.";
          errorTitle = "Sin cupos disponibles";
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error reagendando cita:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la reasignación",
        variant: "destructive",
      });
    } finally {
      setReschedulingAppointment(false);
    }
  };

  // Función para limpiar caché y cookies del portal de usuarios
  const clearUserPortalCache = () => {
    try {
      // Limpiar localStorage relacionado con agendamiento
      const keysToRemove = ['selectedSpecialty', 'availableSchedules', 'cupsData', 'appointmentCache'];
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Limpiar sessionStorage
      sessionStorage.clear();

      // Limpiar cookies del dominio (excepto autenticación si existe)
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        // No eliminar cookie de autenticación si existe
        if (name !== 'auth_token' && name !== 'user_session') {
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
        }
      }

      console.log('✅ Caché y cookies limpiados exitosamente');
    } catch (error) {
      console.error('Error limpiando caché:', error);
    }
  };

  // Cerrar modal después de ver resultado de lista de espera
  const handleCloseWaitingListResult = () => {
    setWaitingListResult(null);
    setShowScheduleModal(false);
    setSelectedSpecialty(null);
    setAvailableSchedules([]);

    // Limpiar caché y cookies antes de recargar
    clearUserPortalCache();

    // Recargar citas y lista de espera con caché limpio
    window.location.reload();
  };

  // Cerrar modal después de ver resultado del agendamiento exitoso
  const handleCloseAppointmentResult = () => {
    setAppointmentResult(null);
    setShowScheduleModal(false);
    setSelectedSpecialty(null);
    setAvailableSchedules([]);

    // Limpiar caché y cookies antes de recargar
    clearUserPortalCache();

    // Recargar página para mostrar nueva cita con caché limpio
    window.location.reload();
  };

  // Función para formatear fecha de manera legible
  const formatAppointmentDate = (dateString: string) => {
    try {
      // Si la fecha viene en formato YYYY-MM-DD, parsearla manualmente
      // para evitar problemas de zona horaria
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        const months = [
          'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        return `${day} de ${months[month - 1]} de ${year}`;
      }

      // Fallback: intentar parsear como fecha ISO completa
      const date = new Date(dateString);

      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return dateString; // Retornar original si no se puede parsear
      }

      const day = date.getDate();
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      const month = months[date.getMonth()];
      const year = date.getFullYear();

      return `${day} de ${month} de ${year}`;
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return dateString; // Retornar original en caso de error
    }
  };

  // Función para formatear fecha en formato DD/MM/AAAA
  const formatDateDDMMYYYY = (dateString: string): string => {
    try {
      // Si la fecha viene en formato YYYY-MM-DD, parsearla manualmente
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
      }

      // Fallback: intentar parsear como fecha ISO completa
      const date = new Date(dateString);

      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return dateString; // Retornar original si no se puede parsear
      }

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formateando fecha DD/MM/AAAA:', error);
      return dateString; // Retornar original en caso de error
    }
  };

  // Pantalla de login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 p-3 sm:p-4">
        {/* Banner de Mantenimiento */}
        <div className="w-full max-w-md bg-yellow-400 text-yellow-900 px-4 py-3 rounded-lg mb-6 shadow-lg z-20 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="font-semibold text-sm">
            Estamos realizando una mejora interna
          </p>
        </div>
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

        {/* Modal de Registro */}
        <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-blue-600">Registro de Nuevo Paciente</DialogTitle>
              <DialogDescription>
                No encontramos un registro con ese documento. Por favor, complete los siguientes datos para crear su cuenta.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleRegister} className="space-y-4 pt-4">
              {/* Información Personal */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Información Personal
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-document">Documento *</Label>
                    <Input
                      id="reg-document"
                      value={registerForm.document}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Nombre Completo *</Label>
                    <Input
                      id="reg-name"
                      placeholder="Nombre y apellidos"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-birth">Fecha de Nacimiento *</Label>
                    <Input
                      id="reg-birth"
                      type="date"
                      value={registerForm.birth_date}
                      onChange={(e) => setRegisterForm({ ...registerForm, birth_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-gender">Género *</Label>
                    <Select
                      value={registerForm.gender}
                      onValueChange={(value) => setRegisterForm({ ...registerForm, gender: value })}
                    >
                      <SelectTrigger id="reg-gender">
                        <SelectValue placeholder="Seleccione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Femenino">Femenino</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Información de Contacto */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Phone className="h-5 w-5 text-blue-600" />
                  Información de Contacto
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Teléfono *</Label>
                    <Input
                      id="reg-phone"
                      type="tel"
                      placeholder="3001234567"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Correo Electrónico</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Información de Residencia */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Información de Residencia
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="reg-address">Dirección</Label>
                    <Input
                      id="reg-address"
                      placeholder="Calle, Carrera, etc."
                      value={registerForm.address}
                      onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-city">Ciudad/Municipio</Label>
                    <Input
                      id="reg-city"
                      placeholder="San Gil"
                      value={registerForm.city}
                      onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="reg-zone">Zona de Atención</Label>
                    <Select
                      value={registerForm.zone_id}
                      onValueChange={(value) => setRegisterForm({ ...registerForm, zone_id: value })}
                    >
                      <SelectTrigger id="reg-zone">
                        <SelectValue placeholder="Seleccione su zona de atención" />
                      </SelectTrigger>
                      <SelectContent>
                        {zonesList.length === 0 ? (
                          <SelectItem value="__loading__" disabled>Cargando zonas...</SelectItem>
                        ) : (
                          zonesList.map(zone => (
                            <SelectItem key={zone.id} value={zone.id.toString()}>
                              {zone.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Información de Salud */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Home className="h-5 w-5 text-blue-600" />
                  Información de Salud
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="reg-eps">EPS</Label>
                  <Select
                    value={registerForm.eps}
                    onValueChange={(value) => setRegisterForm({ ...registerForm, eps: value })}
                  >
                    <SelectTrigger id="reg-eps">
                      <SelectValue placeholder="Seleccione su EPS" />
                    </SelectTrigger>
                    <SelectContent>
                      {epsList.length === 0 ? (
                        <SelectItem value="__loading__" disabled>Cargando EPS...</SelectItem>
                      ) : (
                        epsList.map(eps => (
                          <SelectItem key={eps.id} value={eps.name}>
                            {eps.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1"
                  disabled={registering}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={registering}
                >
                  {registering ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Registrando...
                    </span>
                  ) : (
                    'Registrar'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Dashboard del paciente
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header responsivo */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        {/* Banner de Mantenimiento */}
        <div className="bg-yellow-400 text-yellow-900 px-4 py-2 flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-sm font-semibold">
            Estamos realizando una mejora interna
          </p>
        </div>
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
                Bienvenido(a), {patient?.first_name} {patient?.last_name}
              </h1>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-semibold">Cédula:</span> {patient?.document}
                </p>
                {patient?.eps_name && (
                  <p className="text-xs sm:text-sm text-gray-600">
                    <span className="font-semibold">EPS:</span> {patient?.eps_name}
                  </p>
                )}
                {patient?.phone && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs sm:text-sm text-gray-600">
                      <span className="font-semibold">Teléfono:</span> {patient?.phone}
                    </p>
                    <button
                      onClick={() => {
                        // Extraer solo los 10 dígitos del número (sin +57)
                        const currentPhone = patient?.phone || '';
                        const digitsOnly = currentPhone.replace(/^\+57/, '').replace(/\D/g, '');
                        setNewPhone(digitsOnly);
                        setShowEditPhoneModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-700 text-xs underline"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              onClick={handleOpenScheduleModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md hover:shadow-lg"
            >
              <Calendar className="w-4 h-4" />
              <span>Agendar Cita</span>
            </Button>

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
      </div>

      {/* Navegación por Pestañas */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 sm:gap-2" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('citas')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold border-b-3 transition-all ${
                activeTab === 'citas'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Mis Citas</span>
              {(appointments.length + waitingList.length) > 0 && (
                <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'citas' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {appointments.length + waitingList.length}
                </span>
              )}
            </button>
            <button
              onClick={async () => {
                setActiveTab('notificaciones');
                // Marcar mensajes como leídos al entrar a la pestaña
                if (unreadCount > 0 && patient) {
                  try {
                    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
                    await fetch(`${baseUrl}/sms/patient/${patient.patient_id}/mark-read`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    setUnreadCount(0);
                  } catch (err) {
                    console.error('Error marcando como leídos:', err);
                  }
                }
              }}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold border-b-3 transition-all ${
                activeTab === 'notificaciones'
                  ? 'border-purple-600 text-purple-600 bg-purple-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Notificaciones</span>
              {unreadCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white font-bold animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Pestaña de Citas */}
        {activeTab === 'citas' && (
          <>
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
              <Button
                onClick={handleOpenScheduleModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-all"
              >
                Agendar Cita
              </Button>
            </div>
          ) : (
            (() => {
              // Agrupar citas dobles
              const processedAppointments: Array<{
                type: 'single' | 'double';
                appointments: typeof appointments;
              }> = [];
              const usedIds = new Set<number>();

              appointments.forEach((apt) => {
                if (usedIds.has(apt.appointment_id)) return;

                const isDouble = apt.reason?.toUpperCase().includes('CITA DOBLE');

                if (isDouble) {
                  // Buscar la cita relacionada
                  const relatedApt = appointments.find(other =>
                    other.appointment_id !== apt.appointment_id &&
                    !usedIds.has(other.appointment_id) &&
                    other.specialty_name === apt.specialty_name &&
                    other.scheduled_date === apt.scheduled_date &&
                    other.reason?.toUpperCase().includes('CITA DOBLE')
                  );

                  if (relatedApt) {
                    // Ordenar por hora: la más temprana primero
                    const sortedPair = [apt, relatedApt].sort((a, b) => {
                      const timeA = a.scheduled_time || '00:00';
                      const timeB = b.scheduled_time || '00:00';
                      return timeA.localeCompare(timeB);
                    });

                    processedAppointments.push({
                      type: 'double',
                      appointments: sortedPair
                    });
                    usedIds.add(apt.appointment_id);
                    usedIds.add(relatedApt.appointment_id);
                  } else {
                    // Si no encuentra pareja, mostrar como cita simple
                    processedAppointments.push({
                      type: 'single',
                      appointments: [apt]
                    });
                    usedIds.add(apt.appointment_id);
                  }
                } else {
                  processedAppointments.push({
                    type: 'single',
                    appointments: [apt]
                  });
                  usedIds.add(apt.appointment_id);
                }
              });

              return processedAppointments.map((group, index) => {
                const apt = group.appointments[0];
                const apt2 = group.type === 'double' ? group.appointments[1] : null;
                // Función para obtener colores por especialidad
                const getSpecialtyColors = (specialtyName: string) => {
                  const specialtyColors: Record<string, { bg: string, text: string, accent: string }> = {
                    'Medicina General': {
                      bg: 'from-blue-600 to-blue-700',
                      text: 'text-blue-600',
                      accent: 'bg-blue-100'
                    },
                    'Odontología': {
                      bg: 'from-emerald-600 to-emerald-700',
                      text: 'text-emerald-600',
                      accent: 'bg-emerald-100'
                    },
                    'Ginecología': {
                      bg: 'from-pink-600 to-pink-700',
                      text: 'text-pink-600',
                      accent: 'bg-pink-100'
                    },
                    'Cardiología': {
                      bg: 'from-red-600 to-red-700',
                      text: 'text-red-600',
                      accent: 'bg-red-100'
                    },
                    'Psicología': {
                      bg: 'from-purple-600 to-purple-700',
                      text: 'text-purple-600',
                      accent: 'bg-purple-100'
                    },
                    'Dermatología': {
                      bg: 'from-orange-600 to-orange-700',
                      text: 'text-orange-600',
                      accent: 'bg-orange-100'
                    },
                    'Neurología': {
                      bg: 'from-indigo-600 to-indigo-700',
                      text: 'text-indigo-600',
                      accent: 'bg-indigo-100'
                    },
                    'Pediatría': {
                      bg: 'from-yellow-600 to-yellow-700',
                      text: 'text-yellow-600',
                      accent: 'bg-yellow-100'
                    },
                    'Oftalmología': {
                      bg: 'from-teal-600 to-teal-700',
                      text: 'text-teal-600',
                      accent: 'bg-teal-100'
                    },
                    'Urología': {
                      bg: 'from-cyan-600 to-cyan-700',
                      text: 'text-cyan-600',
                      accent: 'bg-cyan-100'
                    }
                  };

                  // Color por defecto si no se encuentra la especialidad
                  return specialtyColors[specialtyName] || {
                    bg: 'from-gray-600 to-gray-700',
                    text: 'text-gray-600',
                    accent: 'bg-gray-100'
                  };
                };

                const specialtyColors = getSpecialtyColors(apt.specialty_name || '');

                // Formatear fecha SIN conversión de timezone
                const formatDate = (dateStr: string) => {
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
                    key={group.type === 'double' ? `double-${apt.appointment_id}-${apt2?.appointment_id}` : apt.appointment_id}
                    className={`group bg-white rounded-2xl border-l-4 ${specialtyColors.text.replace('text-', 'border-')} border-t border-r border-b border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden`}
                  >
                    {/* Header con fecha - Color específico por especialidad */}
                    <div className={`bg-gradient-to-r ${specialtyColors.bg} text-white px-4 sm:px-6 py-4 sm:py-5`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Fecha */}
                        <div className="flex items-center gap-4">
                          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center min-w-fit">
                            <div className="text-2xl sm:text-3xl font-bold">{formattedDate.day}</div>
                            <div className="text-xs sm:text-sm uppercase tracking-widest opacity-90">{formattedDate.month}</div>
                            <div className="text-xs opacity-75">{formattedDate.year}</div>
                          </div>
                          <div>
                            {group.type === 'double' && apt2 ? (
                              <>
                                <div className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                  </svg>
                                  {convertUTCToColombiaTime(apt.scheduled_time)} y {convertUTCToColombiaTime(apt2.scheduled_time)}
                                </div>
                                <p className="text-xs sm:text-sm opacity-90 mt-1">Citas consecutivas</p>
                              </>
                            ) : (
                              <>
                                <div className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                  </svg>
                                  {apt.scheduled_time ? convertUTCToColombiaTime(apt.scheduled_time) : 'Hora por confirmar'}
                                </div>
                                <p className="text-xs sm:text-sm opacity-90 mt-1">Hora de consulta</p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Estado y ID */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs opacity-75">Cita{group.type === 'double' ? 's' : ''} N°</p>
                            {group.type === 'double' && apt2 ? (
                              <p className="text-sm sm:text-base font-mono font-bold">
                                #{apt.appointment_id} y #{apt2.appointment_id}
                              </p>
                            ) : (
                              <p className="text-sm sm:text-base font-mono font-bold">#{apt.appointment_id}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 whitespace-nowrap ${statusColor}`}>
                              {apt.status}
                            </span>
                            {group.type === 'double' && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold border-2 bg-purple-100 text-purple-800 border-purple-200 whitespace-nowrap flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                </svg>
                                Cita Doble
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contenido principal */}
                    <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-4">
                      {/* Grid de información */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Doctor */}
                        <div className="flex items-start gap-3">
                          <div className={`${specialtyColors.accent} rounded-lg p-2.5 mt-0.5`}>
                            <svg className={`w-5 h-5 ${specialtyColors.text}`} fill="currentColor" viewBox="0 0 24 24">
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
                            <div className={`${specialtyColors.accent} rounded-lg p-2.5 mt-0.5`}>
                              <svg className={`w-5 h-5 ${specialtyColors.text}`} fill="currentColor" viewBox="0 0 24 24">
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
                            <div className={`${specialtyColors.accent} rounded-lg p-2.5 mt-0.5`}>
                              <svg className={`w-5 h-5 ${specialtyColors.text}`} fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
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
                      {group.type === 'double' && apt2 ? (
                        <div className="space-y-3">
                          <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                            <p className="text-xs sm:text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                              </svg>
                              Primera cita ({convertUTCToColombiaTime(apt.scheduled_time)}):
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">{apt.reason}</p>
                          </div>
                          <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                            <p className="text-xs sm:text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                              </svg>
                              Segunda cita ({convertUTCToColombiaTime(apt2.scheduled_time)}):
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">{apt2.reason}</p>
                          </div>
                        </div>
                      ) : apt.reason && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <p className="text-xs sm:text-sm font-bold text-gray-700 mb-2">Motivo de consulta:</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{apt.reason}</p>
                        </div>
                      )}

                      {/* Botones de acción */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Botón QR */}
                        <button
                          onClick={() => generateAppointmentQR(apt, patient)}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 group/btn"
                        >
                          <QrCode className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          <span className="hidden sm:inline">Descargar QR</span>
                          <span className="sm:hidden">QR</span>
                        </button>

                        {/* Botón Reagendar - Solo para citas Confirmadas o Pendientes */}
                        {(apt.status === 'Confirmada' || apt.status === 'Pendiente') && (
                          <button
                            onClick={() => openRescheduleDialog(apt)}
                            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold py-3 px-4 rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 group/btn-reschedule"
                          >
                            <CalendarDays className="w-5 h-5 group-hover/btn-reschedule:scale-110 transition-transform" />
                            <span className="hidden sm:inline">Reagendar Cita</span>
                            <span className="sm:hidden">Reagendar</span>
                          </button>
                        )}

                        {/* Botón Cancelar - Solo para citas Confirmadas o Pendientes */}
                        {(apt.status === 'Confirmada' || apt.status === 'Pendiente') && (
                          <button
                            onClick={() => {
                              if (group.type === 'double' && apt2) {
                                // Para citas dobles, preparar ambas citas
                                setAppointmentToCancel({
                                  ...apt,
                                  relatedAppointmentId: apt2.appointment_id
                                });
                              } else {
                                setAppointmentToCancel(apt);
                              }
                              setShowCancelDialog(true);
                            }}
                            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-3 px-4 rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 group/btn-cancel"
                          >
                            <X className="w-5 h-5 group-hover/btn-cancel:scale-110 transition-transform" />
                            <span className="hidden sm:inline">Cancelar {group.type === 'double' ? 'Citas' : 'Cita'}</span>
                            <span className="sm:hidden">Cancelar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          )
          }
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

              // Verificar si esta especialidad tiene disponibilidad
              const hasAvailability = specialtiesWithAvailability.has(item.specialty_id);

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
                  className={`group bg-white rounded-2xl border-2 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden ${hasAvailability
                    ? 'border-green-400 ring-4 ring-green-200 ring-opacity-50 animate-pulse cursor-pointer hover:scale-[1.02]'
                    : 'border-yellow-200'
                    }`}
                  onClick={() => hasAvailability && handleOpenScheduleModal(item.specialty_id, item.id)}
                  role={hasAvailability ? 'button' : undefined}
                  tabIndex={hasAvailability ? 0 : undefined}
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200 px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasAvailability && (
                          <span className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-gradient-to-r from-green-500 to-green-600 text-white animate-pulse shadow-lg">
                            ✨ CUPOS DISPONIBLES
                          </span>
                        )}
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
                    {hasAvailability ? (
                      <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-4 border-l-4 border-green-500 shadow-lg">
                        <div className="flex gap-3">
                          <svg className="w-6 h-6 text-green-700 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm sm:text-base font-bold text-green-900 mb-1">
                              ¡Excelente noticia! Hay citas disponibles para {item.specialty_name}
                            </p>
                            <p className="text-xs sm:text-sm text-green-800">
                              Haz clic en esta tarjeta para ver las fechas y horarios disponibles y agendar tu cita ahora mismo.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {/* Footer con ID de solicitud y botón eliminar */}
                  <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setWaitingListToDelete(item);
                        setShowDeleteWaitingListModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar</span>
                    </button>
                    <p className="text-xs sm:text-sm text-gray-600">Solicitud N° <span className="font-mono font-bold text-gray-900">#{item.id}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </>
        )}

        {/* Pestaña de Notificaciones / SMS */}
        {activeTab === 'notificaciones' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 rounded-xl p-2.5">
                  <Bell className="w-6 h-6 text-purple-700" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Notificaciones / SMS
                </h2>
              </div>
              <p className="text-sm sm:text-base text-gray-600 pl-14">
                Historial de mensajes SMS enviados a tu número de teléfono
              </p>
            </div>

            {loadingSms ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600">Cargando notificaciones...</span>
            </div>
          ) : smsNotifications.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
              <div className="bg-purple-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-purple-600" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">No hay notificaciones SMS</h3>
              <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">
                Cuando te enviemos mensajes de confirmación, recordatorio o información importante, aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {smsNotifications.map((sms: any) => {
                const sentDate = new Date(sms.sent_at);
                const formattedDate = sentDate.toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
                const formattedTime = sentDate.toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });

                const isSuccess = sms.status === 'success';
                
                // Detectar si es un mensaje interno del sistema
                const isInternalNotification = sms.template_id && sms.template_id.startsWith('waiting_list');
                
                // Título para mensajes internos según el tipo
                const getInternalTitle = (templateId: string) => {
                  switch (templateId) {
                    case 'waiting_list_deleted':
                      return '📋 Notificación del Sistema';
                    case 'waiting_list_assigned':
                      return '✅ Asignación de Cita';
                    default:
                      return '🔔 Notificación Interna';
                  }
                };

                return (
                  <div 
                    key={sms.id} 
                    className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${isInternalNotification ? 'border-gray-300' : 'border-gray-200'}`}
                  >
                    {/* Título para mensajes internos */}
                    {isInternalNotification && (
                      <div className="bg-gray-800 px-4 sm:px-6 py-2">
                        <p className="text-sm font-semibold text-white">
                          {getInternalTitle(sms.template_id)}
                        </p>
                      </div>
                    )}
                    
                    {/* Header con fecha y estado */}
                    <div className={`px-4 sm:px-6 py-3 flex items-center justify-between ${isSuccess ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100' : 'bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
                          <MessageSquare className={`w-4 h-4 ${isSuccess ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{formattedDate}</p>
                          <p className="text-xs text-gray-600">{formattedTime}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Badge de tipo de mensaje */}
                        {isInternalNotification ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                            Sistema
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            SMS
                          </span>
                        )}
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isSuccess ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Enviado</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Falló</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contenido del mensaje */}
                    <div className="px-4 sm:px-6 py-4">
                      <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {sms.message}
                      </p>
                    </div>

                    {/* Footer con info adicional */}
                    <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{sms.recipient_number.startsWith('+') ? sms.recipient_number : '+' + sms.recipient_number}</span>
                      </div>
                      {sms.parts > 1 && (
                        <span className="text-gray-400">
                          {sms.parts} partes
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        )}
      </div>

      {/* Modal de Código CUPS (para Ecografías) - Múltiples códigos */}
      <Dialog open={showCupsModal} onOpenChange={setShowCupsModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Información del Estudio - Orden con Múltiples Estudios
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Puedes agregar hasta 3 códigos CUPS para una misma orden médica
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Lista de CUPS agregados */}
            {cupsList.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">Estudios agregados ({cupsList.length}/3):</h4>
                {cupsList.map((cups, index) => (
                  <div key={index} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="bg-blue-100 rounded-full p-2 mt-1">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-blue-900">Estudio #{index + 1}</h5>
                          <div className="space-y-1 text-sm mt-1">
                            {cups.code && <p><span className="font-semibold">Código:</span> {cups.code}</p>}
                            <p><span className="font-semibold">Nombre:</span> {cups.name}</p>
                            {cups.category && <p><span className="font-semibold">Categoría:</span> {cups.category}</p>}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newList = cupsList.filter((_, i) => i !== index);
                          setCupsList(newList);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Solo mostrar formulario si no se han agregado 3 estudios */}
            {cupsList.length < 3 && (
              <>
                {/* Campo de código CUPS */}
                <div className="space-y-2">
                  <Label htmlFor="cups-code" className="text-base font-semibold">
                    {cupsList.length === 0 ? 'Primer Código CUPS' : `Código CUPS adicional (${cupsList.length + 1}/3)`}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="cups-code"
                      type="text"
                      placeholder="Ej: 881611"
                      value={cupsCode}
                      onChange={(e) => setCupsCode(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchCups();
                        }
                      }}
                      className="flex-1"
                      disabled={searchingCups}
                    />
                    <Button
                      onClick={handleSearchCups}
                      disabled={searchingCups || !cupsCode.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {searchingCups ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Buscando...
                        </>
                      ) : (
                        'Buscar'
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Ingresa el código CUPS del estudio y presiona "Buscar" para validar
                  </p>
                </div>

                {/* Resultado de búsqueda - Encontrado */}
                {cupsData && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 rounded-full p-2">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-green-900 mb-2">Código CUPS encontrado</h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="font-semibold">Código:</span> {cupsData.code}</p>
                          <p><span className="font-semibold">Nombre:</span> {cupsData.name}</p>
                          {cupsData.category && <p><span className="font-semibold">Categoría:</span> {cupsData.category}</p>}
                        </div>
                        <Button
                          onClick={() => {
                            setCupsList([...cupsList, cupsData]);
                            setCupsCode('');
                            setCupsData(null);
                            setCupsNotFound(false);
                            toast({
                              title: "Estudio agregado",
                              description: `${cupsData.name} ha sido agregado a la orden`,
                            });
                          }}
                          className="mt-3 bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          Agregar este estudio
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resultado de búsqueda - No encontrado */}
                {cupsNotFound && (
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="bg-yellow-100 rounded-full p-2">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-yellow-900 mb-2">Código no encontrado</h4>
                        <p className="text-sm text-yellow-800 mb-3">
                          El código CUPS ingresado no se encuentra en nuestra base de datos.
                          Por favor ingresa el nombre del estudio manualmente.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cups-manual-name" className="text-base font-semibold">
                        Nombre del Estudio
                      </Label>
                      <Input
                        id="cups-manual-name"
                        type="text"
                        placeholder="Ej: Ecografía articular de codo"
                        value={cupsManualName}
                        onChange={(e) => setCupsManualName(e.target.value)}
                        className="w-full"
                      />
                      <p className="text-sm text-gray-500">
                        Describe el tipo de ecografía solicitada
                      </p>
                      <Button
                        onClick={() => {
                          if (cupsManualName.trim()) {
                            setCupsList([...cupsList, {
                              code: cupsCode.trim(),
                              name: cupsManualName.trim(),
                              manual: true
                            }]);
                            setCupsCode('');
                            setCupsManualName('');
                            setCupsNotFound(false);
                            toast({
                              title: "Estudio agregado",
                              description: `${cupsManualName} ha sido agregado a la orden`,
                            });
                          }
                        }}
                        disabled={!cupsManualName.trim()}
                        className="mt-2 bg-yellow-600 hover:bg-yellow-700"
                        size="sm"
                      >
                        Agregar estudio manual
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {cupsList.length === 3 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
                <p className="text-blue-900 font-semibold">
                  ✓ Has alcanzado el límite de 3 estudios por orden
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Puedes eliminar un estudio si necesitas modificar la lista
                </p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCupsModal(false);
                  setCupsCode('');
                  setCupsData(null);
                  setCupsManualName('');
                  setCupsNotFound(false);
                  setCupsList([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmCups}
                disabled={cupsList.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                Continuar con agendamiento ({cupsList.length} {cupsList.length === 1 ? 'estudio' : 'estudios'})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Agendamiento de Citas */}
      <Dialog open={showScheduleModal} onOpenChange={(open) => {
        setShowScheduleModal(open);
        if (!open) {
          setSelectedSpecialty(null);
          setAvailableSchedules([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {!selectedSpecialty ? 'Agendar Nueva Cita' : `${selectedSpecialty.name}`}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {!selectedSpecialty
                ? 'Selecciona la especialidad médica que necesitas para tu consulta'
                : loadingSchedules
                  ? 'Buscando agendas disponibles...'
                  : availableSchedules.length > 0
                    ? 'Selecciona la fecha y horario que prefieras'
                    : 'Procesando solicitud...'}
            </DialogDescription>
          </DialogHeader>

          {/* Vista de Especialidades */}
          {!selectedSpecialty && (
            <>
              {loadingSpecialties ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Cargando especialidades disponibles...</p>
                </div>
              ) : authorizedSpecialties.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay especialidades disponibles</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Tu EPS no tiene especialidades autorizadas actualmente. Por favor, contacta con nosotros para más información.
                  </p>
                </div>
              ) : (
                <>
                  {/* Panel de Resumen de Especialidades */}
                  <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-600 rounded-xl p-2">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Especialidades disponibles para tu EPS</h3>
                        <p className="text-sm text-gray-600">Selecciona la especialidad médica que necesitas</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-700 font-semibold">Total:</span>
                      <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-bold">
                        {authorizedSpecialties.length} {authorizedSpecialties.length === 1 ? 'especialidad' : 'especialidades'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {authorizedSpecialties.map((specialty) => (
                      <div
                        key={specialty.id}
                        className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
                        onClick={() => handleSelectSpecialty(specialty)}
                      >
                        {/* Icono de especialidad */}
                        <div className="flex items-start gap-4 mb-4">
                          <div className="bg-blue-100 group-hover:bg-blue-600 rounded-xl p-3 transition-colors">
                            <svg className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                              {specialty.name}
                            </h3>
                            <p className="text-sm text-gray-600">{specialty.description}</p>
                          </div>
                        </div>

                        {/* Información adicional */}
                        <div className="space-y-3">
                          {/* Autorización */}
                          {specialty.requiere_autorizacion === 1 && (
                            <div className="flex items-center gap-2 text-sm text-orange-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="font-medium">Requiere autorización previa</span>
                            </div>
                          )}

                          {/* Copago */}
                          {specialty.copago_minimo && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-medium">Copago: {specialty.copago_minimo}%</span>
                            </div>
                          )}
                        </div>

                        {/* Botón de acción */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white group-hover:bg-blue-700">
                            Seleccionar esta especialidad
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Vista de Selección de Sede */}
          {selectedSpecialty && !selectedLocation && !appointmentResult && !waitingListResult && (
            <>
              {loadingSchedules ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Buscando sedes disponibles...</p>
                </div>
              ) : availableLocations.length > 0 ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedSpecialty(null);
                      setAvailableLocations([]);
                      setAvailableSchedules([]);
                    }}
                    className="mb-4"
                  >
                    ← Volver a especialidades
                  </Button>

                  {/* Panel de Resumen de Sedes Disponibles */}
                  <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-blue-600 rounded-xl p-2">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Selecciona la sede para tu cita</h3>
                        <p className="text-gray-600">Especialidad: <span className="font-bold text-blue-700">{selectedSpecialty.name}</span></p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-700 font-semibold">Sedes disponibles:</span>
                      <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-bold">
                        {availableLocations.length} {availableLocations.length === 1 ? 'sede' : 'sedes'}
                      </span>
                      <span className="text-gray-400">•</span>
                      {(() => {
                        const locationColors = [
                          { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
                          { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
                          { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
                          { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
                          { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
                        ];

                        return availableLocations.map((location, index) => {
                          const colors = locationColors[index % locationColors.length];
                          const shortName = location.name
                            .replace('Sede biosanar ', '')
                            .replace('Sede Biosanar ', '')
                            .replace('sede ', '');

                          return (
                            <span
                              key={location.name}
                              className={`${colors.bg} ${colors.text} px-3 py-1 rounded-full text-sm font-bold border-2 ${colors.border}`}
                            >
                              {shortName}
                            </span>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Tarjetas de Sedes con Colores Únicos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const locationThemes = [
                        {
                          gradient: 'from-emerald-500 to-teal-600',
                          bg: 'bg-emerald-50',
                          border: 'border-emerald-200 hover:border-emerald-500',
                          iconBg: 'bg-emerald-100 group-hover:bg-emerald-600',
                          iconColor: 'text-emerald-600 group-hover:text-white',
                          badgeBg: 'bg-emerald-100',
                          badgeText: 'text-emerald-700',
                          button: 'bg-emerald-600 hover:bg-emerald-700 group-hover:bg-emerald-700',
                          titleHover: 'group-hover:text-emerald-600'
                        },
                        {
                          gradient: 'from-amber-500 to-orange-600',
                          bg: 'bg-amber-50',
                          border: 'border-amber-200 hover:border-amber-500',
                          iconBg: 'bg-amber-100 group-hover:bg-amber-600',
                          iconColor: 'text-amber-600 group-hover:text-white',
                          badgeBg: 'bg-amber-100',
                          badgeText: 'text-amber-700',
                          button: 'bg-amber-600 hover:bg-amber-700 group-hover:bg-amber-700',
                          titleHover: 'group-hover:text-amber-600'
                        },
                        {
                          gradient: 'from-purple-500 to-indigo-600',
                          bg: 'bg-purple-50',
                          border: 'border-purple-200 hover:border-purple-500',
                          iconBg: 'bg-purple-100 group-hover:bg-purple-600',
                          iconColor: 'text-purple-600 group-hover:text-white',
                          badgeBg: 'bg-purple-100',
                          badgeText: 'text-purple-700',
                          button: 'bg-purple-600 hover:bg-purple-700 group-hover:bg-purple-700',
                          titleHover: 'group-hover:text-purple-600'
                        },
                        {
                          gradient: 'from-rose-500 to-pink-600',
                          bg: 'bg-rose-50',
                          border: 'border-rose-200 hover:border-rose-500',
                          iconBg: 'bg-rose-100 group-hover:bg-rose-600',
                          iconColor: 'text-rose-600 group-hover:text-white',
                          badgeBg: 'bg-rose-100',
                          badgeText: 'text-rose-700',
                          button: 'bg-rose-600 hover:bg-rose-700 group-hover:bg-rose-700',
                          titleHover: 'group-hover:text-rose-600'
                        },
                        {
                          gradient: 'from-cyan-500 to-blue-600',
                          bg: 'bg-cyan-50',
                          border: 'border-cyan-200 hover:border-cyan-500',
                          iconBg: 'bg-cyan-100 group-hover:bg-cyan-600',
                          iconColor: 'text-cyan-600 group-hover:text-white',
                          badgeBg: 'bg-cyan-100',
                          badgeText: 'text-cyan-700',
                          button: 'bg-cyan-600 hover:bg-cyan-700 group-hover:bg-cyan-700',
                          titleHover: 'group-hover:text-cyan-600'
                        },
                      ];

                      return availableLocations.map((location, index) => {
                        const theme = locationThemes[index % locationThemes.length];

                        return (
                          <div
                            key={location.name}
                            className={`bg-white border-2 ${theme.border} rounded-xl p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer group relative overflow-hidden`}
                            onClick={() => handleSelectLocation(location)}
                          >
                            {/* Barra de color superior */}
                            <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${theme.gradient}`}></div>

                            {/* Icono de ubicación */}
                            <div className="flex items-start gap-4 mb-4 mt-2">
                              <div className={`${theme.iconBg} rounded-xl p-3 transition-colors duration-300`}>
                                <svg className={`w-8 h-8 ${theme.iconColor} transition-colors duration-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <h3 className={`text-lg font-bold text-gray-900 ${theme.titleHover} transition-colors duration-300 mb-1`}>
                                  {location.name}
                                </h3>
                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                  </svg>
                                  {location.address}
                                </p>
                              </div>
                            </div>

                            {/* Información de agendas disponibles */}
                            <div className={`flex items-center justify-between gap-2 text-sm ${theme.badgeBg} rounded-lg p-3 mb-4`}>
                              <div className="flex items-center gap-2">
                                <svg className={`w-5 h-5 ${theme.badgeText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className={`${theme.badgeText} font-semibold`}>
                                  {location.schedules_count} agenda{location.schedules_count > 1 ? 's' : ''} disponible{location.schedules_count > 1 ? 's' : ''}
                                </span>
                              </div>
                              <svg className={`w-5 h-5 ${theme.badgeText} group-hover:translate-x-1 transition-transform duration-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </div>

                            {/* Botón de acción */}
                            <Button className={`w-full ${theme.button} text-white transition-all duration-300 shadow-md hover:shadow-lg`}>
                              Ver agendas en esta sede
                            </Button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              ) : null}
            </>
          )}

          {/* Vista de Agendas Disponibles (filtradas por sede) */}
          {selectedSpecialty && selectedLocation && !appointmentResult && !waitingListResult && (
            <>
              {loadingSchedules ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Buscando agendas disponibles...</p>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedLocation(null);
                    }}
                    className="mb-4"
                  >
                    ← Volver a sedes
                  </Button>

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Agendas disponibles en {selectedLocation.name}</h3>
                    <p className="text-gray-600">Especialidad: <span className="font-semibold">{selectedSpecialty.name}</span></p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 py-4">
                    {availableSchedules
                      .filter(schedule => schedule.location_name === selectedLocation.name)
                      .map((schedule) => {
                        // Formatear fecha directamente sin Date object para evitar problemas de timezone
                        const dateParts = schedule.appointment_date.split('-');
                        const year = dateParts[0];
                        const monthNum = parseInt(dateParts[1]);
                        const dayNum = parseInt(dateParts[2]);

                        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                        const month = months[monthNum - 1];

                        // Calcular día de la semana
                        const tempDate = new Date(year, monthNum - 1, dayNum);
                        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                        const dayName = dayNames[tempDate.getDay()];

                        return (
                          <div
                            key={schedule.availability_id}
                            className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-green-500 hover:shadow-lg transition-all group"
                          >
                            <div className="flex flex-col md:flex-row gap-6">
                              {/* Fecha */}
                              <div className="flex items-center gap-4">
                                <div className="bg-blue-100 group-hover:bg-green-600 rounded-xl p-4 text-center min-w-[80px] transition-colors">
                                  <div className="text-3xl font-bold text-blue-600 group-hover:text-white transition-colors">{dayNum}</div>
                                  <div className="text-sm font-semibold text-blue-600 group-hover:text-white transition-colors uppercase">{month.substring(0, 3)}</div>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500 capitalize">{dayName}</p>
                                  <p className="text-lg font-bold text-gray-900 capitalize">{dayNum} de {month}</p>
                                </div>
                              </div>

                              {/* Separador vertical */}
                              <div className="hidden md:block w-px bg-gray-200"></div>

                              {/* Doctor */}
                              <div className="flex-1">
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="bg-purple-100 rounded-lg p-2.5">
                                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-500">Doctor</p>
                                    <p className="text-lg font-bold text-gray-900">Dr. {schedule.doctor_name}</p>
                                  </div>
                                </div>

                                {/* Horario general */}
                                <div className="flex items-center gap-2 text-gray-700 mb-3">
                                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-semibold">{convertUTCToColombiaTime(schedule.start_time)} - {convertUTCToColombiaTime(schedule.end_time)}</span>
                                </div>

                                {/* Horas específicas disponibles */}
                                {schedule.next_available_times && schedule.next_available_times.length > 0 && (
                                  <div className="mb-3">
                                    <p className="text-sm text-gray-600 mb-2 font-medium">Próximas horas disponibles:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {schedule.next_available_times.slice(0, 3).map((time: string, index: number) => (
                                        <div key={index} className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg">
                                          <span className="text-sm font-semibold text-blue-700">{formatTimeToDisplay(time)}</span>
                                        </div>
                                      ))}
                                      {schedule.next_available_times.length > 3 && (
                                        <div className="bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg">
                                          <span className="text-sm text-gray-600">+{schedule.next_available_times.length - 3} más</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Sede */}
                                <div className="flex items-center gap-2 text-gray-700">
                                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <span className="text-sm">{schedule.location_name}</span>
                                </div>
                              </div>

                              {/* Cupos y botón */}
                              <div className="flex flex-col items-end justify-between">
                                <div className="bg-green-100 px-4 py-2 rounded-lg mb-4">
                                  <p className="text-xs text-green-700 font-medium">Cupos disponibles</p>
                                  <p className="text-2xl font-bold text-green-600 text-center">{schedule.slots_available}</p>
                                </div>

                                <Button
                                  onClick={() => handleScheduleAppointment(schedule)}
                                  className="bg-green-600 hover:bg-green-700 text-white w-full md:w-auto"
                                >
                                  {schedule.next_available_times && schedule.next_available_times.length > 1
                                    ? 'Seleccionar hora'
                                    : 'Agendar esta cita'
                                  }
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Vista de Resultado de Lista de Espera */}
          {waitingListResult && (
            <div className="py-8">
              <div className="max-w-md mx-auto bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
                {/* Icono de éxito */}
                <div className="bg-green-100 w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                {/* Título */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Agregado a Lista de Espera!</h3>

                {/* Información */}
                <div className="bg-white rounded-xl p-4 mb-6 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-600 font-medium">Especialidad:</span>
                    <span className="font-bold text-gray-900">{waitingListResult.specialty}</span>
                  </div>

                  {/* Mostrar información de CUPS (uno o múltiples) */}
                  {waitingListResult.cups_count > 0 && (
                    <div className="border-b pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 font-medium">
                          Estudios ({waitingListResult.cups_count}):
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 text-left bg-gray-50 p-2 rounded">
                        {waitingListResult.cups_names}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">N° de solicitud:</span>
                    <span className="font-mono font-bold text-gray-900">#{waitingListResult.waiting_list_id}</span>
                  </div>
                </div>

                {/* Mensaje explicativo */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-gray-700 text-left">
                      No hay agenda disponible en este momento. Te notificaremos automáticamente
                      por mensaje de texto o llamada tan pronto se libere un cupo para tu consulta.
                    </p>
                  </div>
                </div>

                {/* Botón */}
                <Button
                  onClick={handleCloseWaitingListResult}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                >
                  Entendido
                </Button>
              </div>
            </div>
          )}

          {/* Vista de Resultado de Cita Agendada Exitosamente */}
          {appointmentResult && (
            <div className="py-8">
              <div className="max-w-md mx-auto bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
                {/* Icono de éxito */}
                <div className="bg-green-100 w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                {/* Título */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Cita Agendada Exitosamente!</h3>

                {/* Información de la cita */}
                <div className="bg-white rounded-xl p-4 mb-6 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-600 font-medium">N° de Cita:</span>
                    <span className="font-mono font-bold text-green-600">#{appointmentResult.appointment_id}</span>
                  </div>

                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-600 font-medium">Especialidad:</span>
                    <span className="font-bold text-gray-900">{appointmentResult.specialty}</span>
                  </div>

                  {/* Mostrar nombre del CUPS si existe (para Ecografías) */}
                  {appointmentResult.cups_name && (
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-gray-600 font-medium">Estudio:</span>
                      <span className="font-bold text-gray-900 text-right">{appointmentResult.cups_name}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-600 font-medium">Doctor(a):</span>
                    <span className="font-bold text-gray-900">{appointmentResult.doctor_name}</span>
                  </div>

                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-600 font-medium">Fecha:</span>
                    <span className="font-bold text-gray-900">{formatAppointmentDate(appointmentResult.appointment_date)}</span>
                  </div>

                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-600 font-medium">Hora:</span>
                    <span className="text-xl font-bold text-blue-600">{appointmentResult.scheduled_time}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Sede:</span>
                    <span className="font-bold text-gray-900">{appointmentResult.location_name}</span>
                  </div>
                </div>

                {/* Mensaje explicativo */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-gray-700 text-left">
                      Tu cita ha sido confirmada exitosamente. Puedes encontrar los detalles
                      en la sección "Mis Citas" de este portal. Te recomendamos llegar 15 minutos antes de la hora programada.
                    </p>
                  </div>
                </div>

                {/* Botón */}
                <Button
                  onClick={handleCloseAppointmentResult}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                >
                  ¡Perfecto!
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de cancelación de cita */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Cancelar Cita Médica
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar esta cita? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {appointmentToCancel && (
            <div className="space-y-4">
              {/* Información de la cita a cancelar */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-gray-900">Detalles de la cita:</h4>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Fecha:</span> {appointmentToCancel.scheduled_date}</div>
                  <div><span className="font-medium">Hora:</span> {convertUTCToColombiaTime(appointmentToCancel.scheduled_time)}</div>
                  <div><span className="font-medium">Doctor:</span> {appointmentToCancel.doctor_name}</div>
                  <div><span className="font-medium">Especialidad:</span> {appointmentToCancel.specialty_name}</div>
                  <div><span className="font-medium">Sede:</span> {appointmentToCancel.location_name}</div>
                </div>
              </div>

              {/* Campo para razón de cancelación (opcional) */}
              <div className="space-y-2">
                <Label htmlFor="cancellation-reason">
                  Motivo de cancelación (opcional)
                </Label>
                <Input
                  id="cancellation-reason"
                  placeholder="Ej: Emergencia familiar, cambio de horario..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1"
                  disabled={cancellingAppointment}
                >
                  Mantener Cita
                </Button>
                <Button
                  onClick={handleCancelAppointment}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={cancellingAppointment}
                >
                  {cancellingAppointment ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Cancelando...
                    </div>
                  ) : (
                    'Confirmar Cancelación'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar solicitud de lista de espera */}
      <Dialog open={showDeleteWaitingListModal} onOpenChange={setShowDeleteWaitingListModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Eliminar Solicitud de Espera
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar esta solicitud de la cola de espera? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {waitingListToDelete && (
            <div className="space-y-4">
              {/* Información de la solicitud a eliminar */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-gray-900">Detalles de la solicitud:</h4>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Especialidad:</span> {waitingListToDelete.specialty_name}</div>
                  <div><span className="font-medium">Prioridad:</span> {waitingListToDelete.priority_level}</div>
                  {waitingListToDelete.reason && (
                    <div><span className="font-medium">Motivo:</span> {waitingListToDelete.reason}</div>
                  )}
                  <div><span className="font-medium">N° Solicitud:</span> #{waitingListToDelete.id}</div>
                </div>
              </div>

              {/* Advertencia */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Si eliminas esta solicitud, perderás tu lugar en la cola de espera y tendrás que volver a registrarte si deseas ser atendido.
                </p>
              </div>

              {/* Botones de acción */}
              <DialogFooter className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteWaitingListModal(false);
                    setWaitingListToDelete(null);
                  }}
                  className="flex-1"
                  disabled={deletingWaitingList}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteWaitingList}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={deletingWaitingList}
                >
                  {deletingWaitingList ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Eliminando...
                    </div>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Confirmar Eliminación
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de reasignación de cita */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CalendarDays className="w-5 h-5" />
              Reagendar Cita Médica
            </DialogTitle>
            <DialogDescription>
              Selecciona un nuevo horario para tu cita médica.
            </DialogDescription>
          </DialogHeader>

          {appointmentToReschedule && (
            <div className="space-y-6">
              {/* Información de la cita actual */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-gray-900">Cita actual:</h4>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Fecha:</span> {formatDateDDMMYYYY(appointmentToReschedule.scheduled_date)}</div>
                  <div><span className="font-medium">Hora:</span> {convertUTCToColombiaTime(appointmentToReschedule.scheduled_time)}</div>
                  <div><span className="font-medium">Doctor:</span> {appointmentToReschedule.doctor_name}</div>
                  <div><span className="font-medium">Especialidad:</span> {appointmentToReschedule.specialty_name}</div>
                  <div><span className="font-medium">Sede:</span> {appointmentToReschedule.location_name}</div>
                </div>
              </div>

              {/* Motivo de reasignación */}
              <div className="space-y-2">
                <Label htmlFor="reschedule-reason">
                  Motivo del cambio <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="reschedule-reason"
                  placeholder="Ej: Conflicto de horario, emergencia..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              {/* Selector de sede y horarios disponibles */}
              <div className="space-y-4">
                {showLocationSelector ? (
                  // Selector de sede
                  <>
                    <h4 className="font-semibold text-gray-900">¿En cuál sede deseas agendar?</h4>

                    {loadingSchedules ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-gray-600">Cargando sedes disponibles...</span>
                        </div>
                      </div>
                    ) : getAvailableLocations().length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay horarios disponibles para esta especialidad en este momento.</p>
                        <p className="text-sm mt-2">Intenta nuevamente más tarde o contacta al centro médico.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {getAvailableLocations().map((location) => {
                          const colors = getLocationColor(location);
                          const scheduleCount = availableSchedules.filter(s =>
                            s.location_name.toLowerCase().includes(location.toLowerCase())
                          ).length;

                          return (
                            <div
                              key={location}
                              className={`p-6 rounded-lg border-2 cursor-pointer transition-all duration-200 ${colors.bg}`}
                              onClick={() => selectLocationForReschedule(location)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full ${colors.badge}`}></div>
                                  <div>
                                    <h5 className={`font-semibold text-lg ${colors.text}`}>
                                      Sede {location}
                                    </h5>
                                    <p className="text-sm text-gray-600">
                                      {scheduleCount} horario{scheduleCount !== 1 ? 's' : ''} disponible{scheduleCount !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-white text-sm font-medium ${colors.badge}`}>
                                  Ver horarios
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  // Mostrar horarios filtrados por sede
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">
                        Horarios disponibles en Sede {selectedLocationForReschedule}:
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowLocationSelector(true);
                          setSelectedLocationForReschedule('');
                          setSelectedNewSchedule(null);
                        }}
                        className="text-xs"
                      >
                        Cambiar sede
                      </Button>
                    </div>

                    {filteredSchedules.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay horarios disponibles en esta sede.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                        {filteredSchedules.map((schedule) => {
                          const colors = getLocationColor(schedule.location_name);
                          return (
                            <div
                              key={schedule.availability_id}
                              className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${selectedNewSchedule?.availability_id === schedule.availability_id
                                ? colors.selected
                                : colors.bg
                                }`}
                              onClick={() => {
                                setSelectedNewSchedule(schedule);
                                // Si hay múltiples horarios disponibles, abrir el selector de hora
                                if (schedule.available_time_slots && schedule.available_time_slots.length > 0) {
                                  setSelectedScheduleForRescheduleTime(schedule);
                                  setSelectedRescheduleTime('');
                                  setShowRescheduleTimeSelector(true);
                                }
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold text-gray-900">
                                      {formatDateDDMMYYYY(schedule.appointment_date)}
                                    </div>
                                    <div className={`px-2 py-1 rounded-md text-xs font-medium ${colors.badge} text-white`}>
                                      Seleccionar →
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Dr. {schedule.doctor_name}
                                  </div>
                                  <div className={`text-sm ${colors.text} flex items-center gap-1`}>
                                    <div className={`w-2 h-2 rounded-full ${colors.badge}`}></div>
                                    {schedule.location_name}
                                  </div>
                                  {/* Mostrar TODOS los horarios disponibles */}
                                  {schedule.available_time_slots && schedule.available_time_slots.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      <div className="text-xs font-medium text-gray-700">
                                        Horarios disponibles ({schedule.available_time_slots.length}):
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {schedule.available_time_slots.map((time: string, index: number) => (
                                          <span
                                            key={index}
                                            className={`text-xs px-2 py-1 rounded-md ${colors.badge} text-white`}
                                          >
                                            {formatTimeToDisplay(time)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Resumen comparativo del cambio cuando hay nuevo horario seleccionado */}
              {selectedNewSchedule && selectedRescheduleTime && !showLocationSelector && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-amber-800 flex items-center gap-2 text-sm">
                    <CalendarDays className="w-4 h-4" />
                    Resumen del cambio:
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Cita actual */}
                    <div className="bg-white/70 rounded-lg p-3 border border-red-200">
                      <div className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        Cita Actual
                      </div>
                      <div className="text-xs space-y-1 text-gray-600">
                        <div><strong>Fecha:</strong> {formatDateDDMMYYYY(appointmentToReschedule?.scheduled_date)}</div>
                        <div><strong>Hora:</strong> {convertUTCToColombiaTime(appointmentToReschedule?.scheduled_time)}</div>
                        <div><strong>Doctor:</strong> {appointmentToReschedule?.doctor_name}</div>
                      </div>
                    </div>
                    {/* Nueva cita */}
                    <div className="bg-white/70 rounded-lg p-3 border border-green-200">
                      <div className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Nueva Cita
                      </div>
                      <div className="text-xs space-y-1 text-gray-600">
                        <div><strong>Fecha:</strong> {formatDateDDMMYYYY(selectedNewSchedule.appointment_date)}</div>
                        <div><strong>Hora:</strong> {formatTimeToDisplay(selectedRescheduleTime)}</div>
                        <div><strong>Doctor:</strong> {selectedNewSchedule.doctor_name}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRescheduleDialog(false)}
                  className="flex-1"
                  disabled={reschedulingAppointment}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!rescheduleReason.trim()) {
                      toast({
                        title: "Motivo requerido",
                        description: "Por favor ingresa el motivo del cambio de cita",
                        variant: "destructive",
                      });
                      return;
                    }
                    executeReschedule(selectedRescheduleTime);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={reschedulingAppointment || !selectedNewSchedule || !selectedRescheduleTime}
                >
                  {reschedulingAppointment ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Reagendando...
                    </div>
                  ) : (
                    <>
                      <CalendarDays className="w-4 h-4 mr-1" />
                      Confirmar Reagendamiento
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de selección de hora específica */}
      <Dialog open={showTimeSelector} onOpenChange={setShowTimeSelector}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Clock className="w-5 h-5" />
              Seleccionar Hora de Cita
            </DialogTitle>
            <DialogDescription>
              Selecciona la hora específica en la que deseas agendar tu cita.
            </DialogDescription>
          </DialogHeader>

          {selectedScheduleForTime && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Información de la agenda seleccionada */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <h4 className="font-semibold text-gray-900 text-sm">Detalles de la agenda:</h4>
                <div className="text-xs space-y-0.5">
                  <div><span className="font-medium">Fecha:</span> {formatDateDDMMYYYY(selectedScheduleForTime.appointment_date)}</div>
                  <div><span className="font-medium">Doctor:</span> Dr. {selectedScheduleForTime.doctor_name}</div>
                  <div><span className="font-medium">Especialidad:</span> {selectedSpecialty?.name}</div>
                  <div><span className="font-medium">Sede:</span> {selectedScheduleForTime.location_name}</div>
                </div>
              </div>

              {/* Selección de hora */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">
                  Horarios disponibles:
                </Label>
                <div className="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {selectedScheduleForTime.available_time_slots?.map((time: string) => {
                    const consecutiveCheck = checkConsecutiveTimeSlots(time, selectedScheduleForTime.available_time_slots);
                    const isSelected = selectedTime === time;
                    const allowsDouble = Boolean(Number(selectedSpecialty?.allows_double_appointment));
                    const displayTime = formatTimeToDisplay(time);

                    return (
                      <button
                        key={time}
                        type="button"
                        className={`p-2 text-center rounded-lg border-2 transition-all duration-200 ${isSelected
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white hover:border-green-300 text-gray-700'
                          }`}
                        onClick={() => {
                          setSelectedTime(time);
                          // Validar si hay horarios consecutivos disponibles (para todas las especialidades que lo permiten)
                          if (isDoubleAppointment && allowsDouble) {
                            if (consecutiveCheck.error) {
                              toast({
                                title: "Error de verificación",
                                description: consecutiveCheck.error,
                                variant: "destructive",
                              });
                            }
                            setConsecutiveTimeAvailable(consecutiveCheck.available);
                            setNextConsecutiveTime(consecutiveCheck.nextTime);
                          }
                        }}
                      >
                        <div className="font-semibold text-sm">{displayTime}</div>
                        <div className="text-[10px] text-gray-500">Disponible</div>
                        {isSelected && isDoubleAppointment && allowsDouble && (
                          <div className={`text-[10px] mt-0.5 font-medium ${consecutiveCheck.available ? 'text-green-600' : 'text-red-600'}`}>
                            {consecutiveCheck.available
                              ? `✓ ${consecutiveCheck.nextTime ? formatTimeToDisplay(consecutiveCheck.nextTime) : ''}`
                              : '✗ Sin consecutivo'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Checkbox para cita doble (solo especialidades que lo permiten) */}
              {Boolean(Number(selectedSpecialty?.allows_double_appointment)) && (
                <div className="space-y-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="w-3 h-3 text-white" />
                    </div>
                    <h4 className="font-bold text-purple-900 text-sm">Opción de Cita Doble</h4>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="doubleAppointment"
                      checked={isDoubleAppointment}
                      onCheckedChange={(checked) => {
                        setIsDoubleAppointment(checked as boolean);
                        // Re-validar el horario seleccionado si existe
                        if (selectedTime && checked) {
                          const consecutiveCheck = checkConsecutiveTimeSlots(selectedTime, selectedScheduleForTime.available_time_slots);
                          if (consecutiveCheck.error) {
                            toast({
                              title: "Error de verificación",
                              description: consecutiveCheck.error,
                              variant: "destructive",
                            });
                          }
                          setConsecutiveTimeAvailable(consecutiveCheck.available);
                          setNextConsecutiveTime(consecutiveCheck.nextTime);
                        } else {
                          setConsecutiveTimeAvailable(false);
                          setNextConsecutiveTime(null);
                        }
                      }}
                      className="mt-0.5 h-4 w-4 border-2 border-purple-400 data-[state=checked]:bg-purple-600"
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor="doubleAppointment" className="text-sm font-semibold text-purple-900 cursor-pointer">
                        ¿Necesita cita extendida (doble)?
                      </Label>
                      <p className="text-xs text-purple-700 mt-0.5">
                        Se reservarán <strong>dos turnos consecutivos</strong> para más tiempo de atención.
                      </p>

                      {/* Vista previa de horarios cuando está activo */}
                      {isDoubleAppointment && selectedTime && consecutiveTimeAvailable && nextConsecutiveTime && (
                        <div className="mt-2 bg-green-100 border border-green-300 rounded-lg p-2">
                          <div className="flex items-center gap-2 text-green-800 flex-wrap">
                            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md shadow-sm text-sm">
                              <Clock className="w-3 h-3" />
                              <span className="font-bold">{formatTimeToDisplay(selectedTime)}</span>
                            </div>
                            <span className="text-green-600">→</span>
                            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md shadow-sm text-sm">
                              <Clock className="w-3 h-3" />
                              <span className="font-bold">{formatTimeToDisplay(nextConsecutiveTime)}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-green-700 mt-1">✓ Horarios consecutivos disponibles</p>
                        </div>
                      )}

                      {/* Alerta cuando no hay horarios consecutivos */}
                      {isDoubleAppointment && selectedTime && !consecutiveTimeAvailable && (
                        <div className="mt-2 bg-red-50 border border-red-300 rounded-lg p-2">
                          <p className="text-xs text-red-800">
                            <strong>No disponible:</strong> Sin horario consecutivo libre.
                          </p>
                        </div>
                      )}

                      {/* Mensaje informativo cuando no hay hora seleccionada */}
                      {isDoubleAppointment && !selectedTime && (
                        <p className="text-[10px] text-purple-600 mt-1 italic">
                          Selecciona un horario para verificar disponibilidad.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botones de acción - siempre visibles */}
          <div className="flex gap-3 pt-3 flex-shrink-0 border-t mt-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowTimeSelector(false);
                setSelectedScheduleForTime(null);
                setSelectedTime('');
                setIsDoubleAppointment(false);
                setConsecutiveTimeAvailable(false);
                setNextConsecutiveTime(null);
              }}
              className="flex-1"
              size="sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmScheduleWithTime}
              className={`flex-1 text-white ${isDoubleAppointment && consecutiveTimeAvailable
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-green-600 hover:bg-green-700'
                }`}
              disabled={!selectedTime || (isDoubleAppointment && !consecutiveTimeAvailable)}
              size="sm"
            >
              {isDoubleAppointment && consecutiveTimeAvailable ? (
                <>
                  <CalendarDays className="w-4 h-4 mr-1" />
                  Cita Doble
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de selección de hora para reagendamiento */}
      <Dialog open={showRescheduleTimeSelector} onOpenChange={setShowRescheduleTimeSelector}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Clock className="w-5 h-5" />
              Seleccionar Nueva Hora
            </DialogTitle>
            <DialogDescription>
              Selecciona la hora específica para reagendar tu cita.
            </DialogDescription>
          </DialogHeader>

          {selectedScheduleForRescheduleTime && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Información de la agenda seleccionada */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 space-y-2 border border-green-200">
                <h4 className="font-semibold text-green-800 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Nueva agenda seleccionada:
                </h4>
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Fecha:</span>
                    <span className="bg-white px-2 py-0.5 rounded text-green-700 font-semibold">
                      {formatDateDDMMYYYY(selectedScheduleForRescheduleTime.appointment_date)}
                    </span>
                  </div>
                  <div><span className="font-medium text-gray-700">Doctor:</span> Dr. {selectedScheduleForRescheduleTime.doctor_name}</div>
                  <div><span className="font-medium text-gray-700">Especialidad:</span> {appointmentToReschedule?.specialty_name}</div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-700">Sede:</span>
                    <span className={`text-sm ${getLocationColor(selectedScheduleForRescheduleTime.location_name).text}`}>
                      {selectedScheduleForRescheduleTime.location_name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selección de horarios disponibles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">
                  Horarios disponibles:
                </Label>
                {selectedScheduleForRescheduleTime.available_time_slots && selectedScheduleForRescheduleTime.available_time_slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1">
                    {selectedScheduleForRescheduleTime.available_time_slots.map((time: string) => {
                      const isSelected = selectedRescheduleTime === time;
                      const displayTime = formatTimeToDisplay(time);

                      return (
                        <button
                          key={time}
                          type="button"
                          className={`p-2 text-center rounded-lg border-2 transition-all duration-200 ${isSelected
                            ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700'
                            }`}
                          onClick={() => setSelectedRescheduleTime(time)}
                        >
                          <div className="font-semibold text-sm">{displayTime}</div>
                          <div className={`text-[10px] ${isSelected ? 'text-green-600' : 'text-gray-500'}`}>
                            {isSelected ? '✓ Seleccionado' : 'Disponible'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No hay horarios específicos disponibles
                  </div>
                )}
              </div>

              {/* Resumen del reagendamiento */}
              {selectedRescheduleTime && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-800 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Tu cita será:</span>
                      <span className="font-bold">{formatDateDDMMYYYY(selectedScheduleForRescheduleTime.appointment_date)}</span>
                      <span className="text-gray-600">a las</span>
                      <span className="font-bold">{formatTimeToDisplay(selectedRescheduleTime)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botones de acción - siempre visibles */}
          <div className="flex gap-3 pt-3 flex-shrink-0 border-t mt-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowRescheduleTimeSelector(false);
                setSelectedScheduleForRescheduleTime(null);
                setSelectedRescheduleTime('');
                setSelectedNewSchedule(null);
              }}
              className="flex-1"
              size="sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                // Solo cerrar el modal de hora y mantener la hora seleccionada
                setShowRescheduleTimeSelector(false);
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={!selectedRescheduleTime}
              size="sm"
            >
              <Clock className="w-4 h-4 mr-1" />
              Confirmar Hora
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de edición de teléfono */}
      <Dialog open={showEditPhoneModal} onOpenChange={setShowEditPhoneModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Phone className="w-5 h-5" />
              Actualizar Teléfono
            </DialogTitle>
            <DialogDescription>
              Actualiza tu número de teléfono para notificaciones y recordatorios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-phone">
                Número de Teléfono <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-0">
                <div className="flex items-center justify-center bg-gray-100 border border-r-0 border-gray-300 rounded-l-md px-3 h-10 text-gray-700 font-semibold">
                  +57
                </div>
                <Input
                  id="new-phone"
                  type="tel"
                  placeholder="3001234567"
                  value={newPhone}
                  onChange={(e) => {
                    // Solo permitir dígitos y máximo 10
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setNewPhone(digits);
                  }}
                  maxLength={10}
                  className="flex-1 rounded-l-none"
                />
              </div>
              <p className="text-xs text-gray-500">
                Ingresa los 10 dígitos de tu número celular colombiano
              </p>
            </div>

            {patient?.phone && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Teléfono actual:</span> {patient.phone}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setShowEditPhoneModal(false);
                setNewPhone('');
              }}
              variant="outline"
              className="flex-1"
              disabled={updatingPhone}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdatePhone}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={updatingPhone || !newPhone}
            >
              {updatingPhone ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Actualizando...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Actualizar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
