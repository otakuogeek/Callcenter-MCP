import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, LogOut, QrCode, Download, User, Phone, Mail, MapPin, Home } from "lucide-react";
import { api } from "@/lib/api";
import QRCode from 'qrcode';
import { useToast } from "@/hooks/use-toast";

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
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [epsList, setEpsList] = useState<any[]>([]);
  const [zonesList, setZonesList] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [authorizedSpecialties, setAuthorizedSpecialties] = useState<any[]>([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<any>(null);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [waitingListResult, setWaitingListResult] = useState<any>(null);
  const [appointmentResult, setAppointmentResult] = useState<any>(null);
  
  // Set para rastrear qué especialidades tienen disponibilidad
  const specialtiesWithAvailability = new Set<number>();
  
  // Estados para CUPS (Ecografías)
  const [showCupsModal, setShowCupsModal] = useState(false);
  const [cupsCode, setCupsCode] = useState('');
  const [cupsData, setCupsData] = useState<any>(null);
  const [cupsManualName, setCupsManualName] = useState('');
  const [searchingCups, setSearchingCups] = useState(false);
  const [cupsNotFound, setCupsNotFound] = useState(false);
  
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
            // Filtrar citas canceladas
            const activeAppointments = (appointmentsJson.data || []).filter((apt: any) => apt.status !== 'Cancelada');
            setAppointments(activeAppointments);
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

  // Abrir modal de agendamiento y cargar especialidades
  const handleOpenScheduleModal = async () => {
    if (!patient?.insurance_eps_id) {
      toast({
        title: "Error",
        description: "No se pudo determinar tu EPS. Por favor, actualiza tu información.",
        variant: "destructive",
      });
      return;
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

  // Seleccionar especialidad y cargar agendas disponibles
  const handleSelectSpecialty = async (specialty: any) => {
    setSelectedSpecialty(specialty);
    
    // Si es Ecografía, primero solicitar código CUPS
    if (specialty.name && specialty.name.toLowerCase().includes('ecograf')) {
      console.log('🔍 Especialidad de Ecografía detectada, solicitando código CUPS...');
      setShowCupsModal(true);
      return; // Detener aquí, continuará después de ingresar CUPS
    }
    
    // Para otras especialidades, continuar con el flujo normal
    await loadAvailableSchedules(specialty);
  };

  // Función separada para cargar agendas disponibles
  const loadAvailableSchedules = async (specialty: any) => {
    setLoadingSchedules(true);

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api') 
        ? `${baseUrl}/patients-v2/public/available-schedules/${specialty.id}/${patient.insurance_eps_id}`
        : `${baseUrl}/api/patients-v2/public/available-schedules/${specialty.id}/${patient.insurance_eps_id}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        if (data.has_availability && data.data.length > 0) {
          // Hay agendas disponibles, mostrarlas
          setAvailableSchedules(data.data);
          console.log(`✅ Agendas disponibles: ${data.data.length}`);
        } else {
          // NO hay agendas, agregar automáticamente a lista de espera
          console.log('⚠️ No hay agendas disponibles, agregando a lista de espera...');
          await addToWaitingListAuto(specialty);
        }
      } else {
        toast({
          title: "Error",
          description: "No se pudieron cargar las agendas disponibles",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error cargando agendas:', error);
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor",
        variant: "destructive",
      });
    } finally {
      setLoadingSchedules(false);
    }
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
    // Validar que tengamos información del CUPS
    if (!cupsData && !cupsManualName.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa el nombre del estudio",
        variant: "destructive",
      });
      return;
    }

    // Cerrar modal de CUPS
    setShowCupsModal(false);

    // Continuar con el flujo normal de agendamiento
    await loadAvailableSchedules(selectedSpecialty);
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

      // Agregar información de CUPS si existe
      if (cupsData) {
        requestBody.cups_id = cupsData.id;
        requestBody.cups_name = cupsData.name;
      } else if (cupsManualName.trim()) {
        requestBody.cups_name = cupsManualName.trim();
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
          cups_name: data.data.cups_name,
          message: data.data.message
        });

        // Limpiar estados de CUPS
        setCupsCode('');
        setCupsData(null);
        setCupsManualName('');
        setCupsNotFound(false);
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

  // Agendar cita con hora secuencial
  const handleScheduleAppointment = async (schedule: any) => {
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
      const url = baseUrl.endsWith('/api') 
        ? `${baseUrl}/patients-v2/public/schedule-appointment`
        : `${baseUrl}/api/patients-v2/public/schedule-appointment`;
      
      const requestBody: any = {
        patient_id: patient.patient_id,
        specialty_id: selectedSpecialty.id,
        doctor_id: schedule.doctor_id,
        availability_id: schedule.availability_id,
        reason: `Consulta de ${selectedSpecialty.name}`
      };

      // Agregar información de CUPS si existe (para Ecografías)
      if (cupsData) {
        requestBody.cups_id = cupsData.id;
        requestBody.cups_name = cupsData.name;
      } else if (cupsManualName.trim()) {
        requestBody.cups_name = cupsManualName.trim();
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        // Mostrar resultado exitoso en lugar de cerrar modal
        const appointmentData = {
          appointment_id: data.data.appointment_id,
          doctor_name: data.data.doctor_name,
          appointment_date: data.data.appointment_date,
          scheduled_time: data.data.scheduled_time,
          location_name: schedule.location_name,
          specialty: selectedSpecialty.name,
          cups_name: cupsData?.name || cupsManualName || null
        };
        
        setAppointmentResult(appointmentData);
        
        // Limpiar estados de CUPS
        setCupsCode('');
        setCupsData(null);
        setCupsManualName('');
        setCupsNotFound(false);
      } else {
        // Manejar error específico de cita activa (409)
        if (response.status === 409) {
          const details = data.details;
          toast({
            title: "Ya tienes una cita activa",
            description: data.message || `Ya tienes una cita ${details?.status?.toLowerCase()} programada para el ${details?.scheduled_date} a las ${details?.scheduled_time}. No puedes agendar otra cita hasta completar o cancelar la anterior.`,
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

  // Cerrar modal después de ver resultado de lista de espera
  const handleCloseWaitingListResult = () => {
    setWaitingListResult(null);
    setShowScheduleModal(false);
    setSelectedSpecialty(null);
    setAvailableSchedules([]);
    
    // Recargar citas y lista de espera
    window.location.reload();
  };

  // Cerrar modal después de ver resultado del agendamiento exitoso
  const handleCloseAppointmentResult = () => {
    setAppointmentResult(null);
    setShowScheduleModal(false);
    setSelectedSpecialty(null);
    setAvailableSchedules([]);
    
    // Recargar página para mostrar nueva cita
    window.location.reload();
  };

  // Función para formatear fecha de manera legible
  const formatAppointmentDate = (dateString: string) => {
    try {
      // Intentar parsear la fecha ISO
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
              <Button 
                onClick={handleOpenScheduleModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-all"
              >
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
                      className={`group bg-white rounded-2xl border-2 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden ${
                        hasAvailability 
                          ? 'border-green-400 ring-4 ring-green-200 ring-opacity-50 animate-pulse cursor-pointer hover:scale-[1.02]' 
                          : 'border-yellow-200'
                      }`}
                      onClick={() => hasAvailability && handleOpenScheduleModal(item.specialty_id)}
                      role={hasAvailability ? 'button' : undefined}
                      tabIndex={hasAvailability ? 0 : undefined}
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

      {/* Modal de Código CUPS (para Ecografías) */}
      <Dialog open={showCupsModal} onOpenChange={setShowCupsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Información del Estudio
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Por favor ingresa el código CUPS del estudio de ecografía solicitado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Campo de código CUPS */}
            <div className="space-y-2">
              <Label htmlFor="cups-code" className="text-base font-semibold">
                Código CUPS
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
                </div>
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
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmCups}
                disabled={!cupsData && !cupsManualName.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                Continuar con agendamiento
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
                  <div className="space-y-2">
                    {/* Sedes disponibles */}
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-gray-700">
                        <span className="font-semibold">{specialty.sedes_disponibles}</span> sede{specialty.sedes_disponibles > 1 ? 's' : ''} disponible{specialty.sedes_disponibles > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Nombre de sedes */}
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-gray-600 text-xs leading-relaxed">{specialty.sedes}</span>
                    </div>

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
          )}
            </>
          )}

          {/* Vista de Agendas Disponibles */}
          {selectedSpecialty && !appointmentResult && !waitingListResult && (
            <>
              {loadingSchedules ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Buscando agendas disponibles...</p>
                </div>
              ) : availableSchedules.length > 0 ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedSpecialty(null);
                      setAvailableSchedules([]);
                    }}
                    className="mb-4"
                  >
                    ← Volver a especialidades
                  </Button>
                  
                  <div className="grid grid-cols-1 gap-4 py-4">
                    {availableSchedules.map((schedule) => {
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
                          className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-green-500 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => handleScheduleAppointment(schedule)}
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

                              {/* Horario */}
                              <div className="flex items-center gap-2 text-gray-700">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-semibold">{schedule.start_time} - {schedule.end_time}</span>
                              </div>

                              {/* Sede */}
                              <div className="flex items-center gap-2 text-gray-700 mt-2">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-sm">{schedule.location_name}</span>
                              </div>
                            </div>

                            {/* Cupos */}
                            <div className="flex flex-col items-end justify-between">
                              <div className="bg-green-100 px-4 py-2 rounded-lg">
                                <p className="text-xs text-green-700 font-medium">Cupos disponibles</p>
                                <p className="text-2xl font-bold text-green-600 text-center">{schedule.slots_available}</p>
                              </div>

                              <Button className="bg-green-600 hover:bg-green-700 text-white mt-4 w-full md:w-auto">
                                Agendar esta cita
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
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
                  
                  {/* Mostrar nombre del CUPS si existe (para Ecografías) */}
                  {waitingListResult.cups_name && (
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-gray-600 font-medium">Estudio:</span>
                      <span className="font-bold text-gray-900 text-right">{waitingListResult.cups_name}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-600 font-medium">Posición en cola:</span>
                    <span className="text-2xl font-bold text-blue-600">#{waitingListResult.position}</span>
                  </div>
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
    </div>
  );
}
