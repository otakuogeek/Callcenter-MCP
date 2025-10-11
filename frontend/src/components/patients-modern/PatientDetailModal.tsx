import { useState } from 'react';
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
  User,
  Phone,
  Mail,
  MapPin,
  Heart,
  Shield,
  GraduationCap,
  Calendar,
  FileText,
  Edit,
  Download,
  X
} from 'lucide-react';
import { Patient, calculateAge, getInitials, getAvatarColor } from '@/types/patient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PatientDetailModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (patient: Patient) => void;
  onGeneratePDF?: (patient: Patient) => void;
}

export const PatientDetailModal = ({
  patient,
  isOpen,
  onClose,
  onEdit,
  onGeneratePDF
}: PatientDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('basic');

  if (!patient) return null;

  const initials = getInitials(patient.name);
  const avatarColor = getAvatarColor(patient.id);
  const age = patient.birth_date ? calculateAge(patient.birth_date) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header con avatar y acciones */}
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg"
                style={{ backgroundColor: avatarColor }}
              >
                {initials}
              </div>
              <div>
                <DialogTitle className="text-2xl">{patient.name}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <span className="font-mono">{patient.document}</span>
                  {age && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span>{age} años</span>
                    </>
                  )}
                  <Badge 
                    variant={patient.status === 'Activo' ? 'default' : 'secondary'}
                    className="ml-2"
                  >
                    {patient.status}
                  </Badge>
                </DialogDescription>
              </div>
            </div>

            <div className="flex gap-2">
              {onGeneratePDF && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGeneratePDF(patient)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onEdit(patient);
                    onClose();
                  }}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Tabs de información */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic" className="text-xs">
              <User className="w-4 h-4 mr-1" />
              Básica
            </TabsTrigger>
            <TabsTrigger value="contact" className="text-xs">
              <Phone className="w-4 h-4 mr-1" />
              Contacto
            </TabsTrigger>
            <TabsTrigger value="medical" className="text-xs">
              <Heart className="w-4 h-4 mr-1" />
              Médica
            </TabsTrigger>
            <TabsTrigger value="insurance" className="text-xs">
              <Shield className="w-4 h-4 mr-1" />
              Seguro
            </TabsTrigger>
            <TabsTrigger value="demographic" className="text-xs">
              <GraduationCap className="w-4 h-4 mr-1" />
              Demográfica
            </TabsTrigger>
          </TabsList>

          {/* TAB: Información Básica */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información Básica</CardTitle>
                <CardDescription>Datos personales del paciente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Nombre Completo</label>
                    <p className="text-base mt-1">{patient.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Documento</label>
                    <p className="text-base mt-1 font-mono">
                      {patient.document_type || 'CC'} {patient.document}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Fecha de Nacimiento</label>
                    <p className="text-base mt-1">
                      {patient.birth_date
                        ? format(new Date(patient.birth_date), "d 'de' MMMM 'de' yyyy", { locale: es })
                        : 'No especificada'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Edad</label>
                    <p className="text-base mt-1">{age ? `${age} años` : 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Género</label>
                    <p className="text-base mt-1">{patient.gender}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Estado</label>
                    <div className="mt-1">
                      <Badge variant={patient.status === 'Activo' ? 'default' : 'secondary'}>
                        {patient.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-gray-600">Fecha de Registro</label>
                    <p className="text-base mt-1">
                      {patient.created_at
                        ? format(new Date(patient.created_at), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Información de Contacto */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información de Contacto</CardTitle>
                <CardDescription>Datos para comunicarse con el paciente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600" />
                      Teléfono Principal
                    </label>
                    <p className="text-base mt-1">{patient.phone || 'No especificado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-600" />
                      Teléfono Alternativo
                    </label>
                    <p className="text-base mt-1">{patient.phone_alt || 'No especificado'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-600" />
                      Correo Electrónico
                    </label>
                    <p className="text-base mt-1">{patient.email || 'No especificado'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-600" />
                      Dirección
                    </label>
                    <p className="text-base mt-1">{patient.address || 'No especificada'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Municipio</label>
                    <p className="text-base mt-1">
                      {patient.municipality_name || patient.municipality || 'No especificado'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Zona</label>
                    <p className="text-base mt-1">{patient.zone || 'No especificada'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Información Médica */}
          <TabsContent value="medical" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información Médica</CardTitle>
                <CardDescription>Datos médicos relevantes del paciente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Grupo Sanguíneo</label>
                    <p className="text-base mt-1">
                      {patient.blood_group_name || patient.blood_group || 'No especificado'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Tiene Discapacidad</label>
                    <p className="text-base mt-1">
                      <Badge variant={patient.has_disability ? 'default' : 'secondary'}>
                        {patient.has_disability ? 'Sí' : 'No'}
                      </Badge>
                    </p>
                  </div>
                  {patient.has_disability && (
                    <div className="col-span-2">
                      <label className="text-sm font-semibold text-gray-600">Tipo de Discapacidad</label>
                      <p className="text-base mt-1">{patient.disability_type || 'No especificado'}</p>
                    </div>
                  )}
                </div>
                
                {patient.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <label className="text-sm font-semibold text-gray-600 flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-600" />
                      Notas y Observaciones
                    </label>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Información de Seguro */}
          <TabsContent value="insurance" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información de Seguro</CardTitle>
                <CardDescription>EPS y tipo de afiliación</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-gray-600">EPS</label>
                    <p className="text-lg mt-1 font-semibold text-blue-900">
                      {patient.eps_name || 'Sin EPS asignada'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-gray-600">Tipo de Afiliación</label>
                    <div className="mt-1">
                      {patient.insurance_affiliation_type ? (
                        <Badge
                          className={
                            patient.insurance_affiliation_type === 'Contributivo'
                              ? 'bg-green-100 text-green-800'
                              : patient.insurance_affiliation_type === 'Subsidiado'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {patient.insurance_affiliation_type}
                        </Badge>
                      ) : (
                        <span className="text-gray-500">No especificado</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {patient.insurance_affiliation_type && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100">
                    <p className="text-sm text-blue-900">
                      {patient.insurance_affiliation_type === 'Contributivo' &&
                        'Afiliación contributiva: Para personas con capacidad de pago (empleados, pensionados, independientes).'}
                      {patient.insurance_affiliation_type === 'Subsidiado' &&
                        'Afiliación subsidiada: Para personas sin capacidad de pago (población más vulnerable).'}
                      {patient.insurance_affiliation_type === 'Vinculado' &&
                        'Afiliación vinculada: Personas sin capacidad de pago en proceso de afiliación.'}
                      {patient.insurance_affiliation_type === 'Particular' &&
                        'Atención particular: Paciente paga directamente por los servicios.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Información Demográfica */}
          <TabsContent value="demographic" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información Demográfica</CardTitle>
                <CardDescription>Datos socioeconómicos del paciente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Nivel de Educación</label>
                    <p className="text-base mt-1">{patient.education_level || 'No especificado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Estado Civil</label>
                    <p className="text-base mt-1">{patient.marital_status || 'No especificado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Grupo Poblacional</label>
                    <p className="text-base mt-1">{patient.population_group || 'No especificado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Estrato Socioeconómico</label>
                    <p className="text-base mt-1">
                      {patient.estrato ? `Estrato ${patient.estrato}` : 'No especificado'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer con botón cerrar */}
        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
