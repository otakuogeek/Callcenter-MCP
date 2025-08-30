import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Calendar,
  Clock,
  User,
  MapPin,
  FileText,
  Info,
  CheckCircle,
  AlertCircle,
  XCircle,
  PhoneCall,
  MessageCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Consultation {
  id: number;
  patient: string;
  type: string;
  date: string;
  time: string;
  agent: string;
  status: string;
  duration: string | null;
  phone: string;
  query: string;
}

interface ConsultationDetailsModalProps {
  consultation: Consultation | null;
  isOpen: boolean;
  onClose: () => void;
}

const ConsultationDetailsModal = ({ consultation, isOpen, onClose }: ConsultationDetailsModalProps) => {
  if (!consultation) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Atendida":
        return "bg-success-100 text-success-800";
      case "En Curso":
        return "bg-warning-100 text-warning-800";
      case "Pendiente":
        return "bg-medical-100 text-medical-800";
      case "Transferida":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Atendida":
        return <CheckCircle className="w-4 h-4" />;
      case "En Curso":
        return <Clock className="w-4 h-4" />;
      case "Pendiente":
        return <AlertCircle className="w-4 h-4" />;
      case "Transferida":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Información de Horarios":
        return Clock;
      case "Ubicaciones":
        return MapPin;
      case "Preparación de Exámenes":
      case "Resultados de Exámenes":
        return FileText;
      default:
        return Info;
    }
  };

  const handleWhatsAppClick = () => {
    // Limpiar el número de teléfono (remover espacios y caracteres especiales)
    const cleanPhone = consultation.phone.replace(/\D/g, '');
    // Agregar código de país si no está presente
    const phoneNumber = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    
    // Mensaje predeterminado
    const message = `Hola ${consultation.patient}, me comunico desde Valeria IPS para darle seguimiento a su consulta telefónica del ${format(new Date(consultation.date), "dd 'de' MMMM", { locale: es })} sobre ${consultation.type.toLowerCase()}.`;
    
    // Crear URL de WhatsApp
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    // Abrir WhatsApp
    window.open(whatsappUrl, '_blank');
  };

  const TypeIcon = getTypeIcon(consultation.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-medical-800 flex items-center gap-2">
            <PhoneCall className="w-6 h-6" />
            Detalles de la Consulta Telefónica
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información básica */}
          <Card className="border-medical-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-medical-800">
                <TypeIcon className="w-5 h-5" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-medical-600 mb-1">Paciente</p>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-medical-500" />
                      <p className="font-semibold text-medical-800">{consultation.patient}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-medical-600 mb-1">Tipo de Consulta</p>
                    <div className="flex items-center gap-2">
                      <TypeIcon className="w-4 h-4 text-medical-500" />
                      <Badge variant="outline" className="text-medical-700">
                        {consultation.type}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-medical-600 mb-1">Teléfono</p>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-medical-500" />
                      <p className="font-medium text-medical-800">{consultation.phone}</p>
                      <Button
                        size="sm"
                        onClick={handleWhatsAppClick}
                        className="bg-green-500 hover:bg-green-600 text-white ml-2"
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        WhatsApp
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-medical-600 mb-1">Fecha</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-medical-500" />
                      <p className="font-medium text-medical-800">
                        {format(new Date(consultation.date), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-medical-600 mb-1">Hora</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-medical-500" />
                      <p className="font-medium text-medical-800">{consultation.time}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-medical-600 mb-1">Duración</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-medical-500" />
                      <p className="font-medium text-medical-800">
                        {consultation.duration || "No registrada"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estado y Agente */}
          <Card className="border-medical-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-medical-800">
                <User className="w-5 h-5" />
                Atención
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-medical-600 mb-2">Agente Responsable</p>
                  <div className="flex items-center gap-2 p-3 bg-medical-50 rounded-lg">
                    <User className="w-5 h-5 text-medical-600" />
                    <p className="font-semibold text-medical-800">{consultation.agent}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-medical-600 mb-2">Estado de la Consulta</p>
                  <div className="flex items-center gap-2 p-3 bg-medical-50 rounded-lg">
                    {getStatusIcon(consultation.status)}
                    <Badge className={getStatusColor(consultation.status)}>
                      {consultation.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consulta detallada */}
          <Card className="border-medical-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-medical-800">
                <FileText className="w-5 h-5" />
                Detalle de la Consulta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-medical-800 leading-relaxed">{consultation.query}</p>
              </div>
            </CardContent>
          </Card>

          {/* Información adicional según el tipo */}
          {consultation.type === "Información de Horarios" && (
            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-medical-800">
                  <Clock className="w-5 h-5" />
                  Información Proporcionada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-medical-700">
                  <p>• Horarios de atención: Lunes a Viernes 7:00 AM - 5:00 PM</p>
                  <p>• Sábados: 8:00 AM - 12:00 PM</p>
                  <p>• Domingos y festivos: Cerrado</p>
                  <p>• Urgencias: 24 horas todos los días</p>
                </div>
              </CardContent>
            </Card>
          )}

          {consultation.type === "Ubicaciones" && (
            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-medical-800">
                  <MapPin className="w-5 h-5" />
                  Ubicaciones Consultadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium text-medical-800">Socorro</p>
                    <p className="text-sm text-medical-600">Calle Principal #123</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium text-medical-800">San Gil</p>
                    <p className="text-sm text-medical-600">Carrera 15 #45-67</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium text-medical-800">Málaga</p>
                    <p className="text-sm text-medical-600">Avenida Central #89</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button className="bg-medical-600 hover:bg-medical-700">
              Imprimir Reporte
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConsultationDetailsModal;
