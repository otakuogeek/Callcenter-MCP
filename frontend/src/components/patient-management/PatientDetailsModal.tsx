import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, FileText, Heart, Mail, MapPin, Phone, Shield, User, Edit, Save, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Patient, PatientDetail, createDisplayPatient } from '@/types/patient';

const patientEditSchema = z.object({
  first_name: z.string().min(1, 'Primer nombre es requerido'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Primer apellido es requerido'),
  second_last_name: z.string().optional(),
  document_type: z.string().min(1, 'Tipo de documento es requerido'),
  document_number: z.string().min(1, 'Número de documento es requerido'),
  birth_date: z.string().min(1, 'Fecha de nacimiento es requerida'),
  gender: z.string().min(1, 'Género es requerido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  municipality: z.string().optional(),
  blood_type: z.string().optional(),
  allergies: z.string().optional(),
  chronic_conditions: z.string().optional(),
  eps: z.string().optional(),
  affiliation_type: z.string().optional(),
  education_level: z.string().optional(),
  marital_status: z.string().optional(),
  occupation: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

type PatientEditForm = z.infer<typeof patientEditSchema>;

interface PatientDetailsModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (patient: Patient) => void;
  onSave?: () => void;
}

const PatientDetailsModal = ({ patient, isOpen, onClose, onSave }: PatientDetailsModalProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [fullPatientData, setFullPatientData] = useState<PatientDetail | null>(null);
  const { toast } = useToast();

  // Función para obtener los datos completos del paciente
  const loadFullPatientData = async (patientId: string) => {
    try {
      const fullData = await api.getPatientV2(patientId);
      const displayData = createDisplayPatient(fullData);
      setFullPatientData(displayData);
      return displayData;
    } catch (error) {
      console.error('Error loading full patient data:', error);
      // Si falla, usar los datos disponibles del dashboard
      if (patient) {
        const displayData = createDisplayPatient(patient);
        setFullPatientData(displayData);
        return displayData;
      }
      return null;
    }
  };

  useEffect(() => {
    if (patient && isOpen) {
      loadFullPatientData(patient.id);
    }
  }, [patient, isOpen]);

  // Usar fullPatientData si está disponible, sino usar patient transformado
  const displayPatient = fullPatientData || (patient ? createDisplayPatient(patient) : null);

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
      const formatDateForInput = (dateString: string) => {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      };

      reset({
        first_name: displayPatient.first_name || '',
        middle_name: displayPatient.middle_name || '',
        last_name: displayPatient.last_name || '',
        second_last_name: displayPatient.second_last_name || '',
        document_type: displayPatient.document_type || 'CC',
        document_number: displayPatient.document_number || '',
        birth_date: formatDateForInput(displayPatient.birth_date),
        gender: displayPatient.gender || '',
        phone: displayPatient.phone || '',
        email: displayPatient.email || '',
        address: displayPatient.address || '',
        municipality: displayPatient.municipality || '',
        blood_type: displayPatient.blood_type || '',
        allergies: displayPatient.allergies || '',
        chronic_conditions: displayPatient.chronic_conditions || '',
        eps: displayPatient.eps || '',
        affiliation_type: displayPatient.affiliation_type || '',
        education_level: displayPatient.education_level || '',
        marital_status: displayPatient.marital_status || '',
        occupation: displayPatient.occupation || '',
        emergency_contact_name: displayPatient.emergency_contact_name || '',
        emergency_contact_phone: displayPatient.emergency_contact_phone || '',
      });
    }
  }, [displayPatient, isEditMode, reset]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const municipalitiesData = await api.getMunicipalities();
        setMunicipalities(Array.isArray(municipalitiesData) ? municipalitiesData : []);
      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback a datos mock si falla la carga
        setMunicipalities([
          { id: '1', name: 'Bogotá' },
          { id: '2', name: 'Medellín' },
          { id: '3', name: 'Cali' },
          { id: '4', name: 'Barranquilla' },
          { id: '5', name: 'Cartagena' },
          { id: '6', name: 'Paramo' }
        ]);
        setDocumentTypes([
          { id: 'CC', name: 'Cédula de Ciudadanía' },
          { id: 'TI', name: 'Tarjeta de Identidad' },
          { id: 'CE', name: 'Cédula de Extranjería' },
          { id: 'PAS', name: 'Pasaporte' }
        ]);
      }
    };
    
    if (isEditMode) {
      loadData();
    }
  }, [isEditMode]);

  const onSubmit = async (data: PatientEditForm) => {
    if (!displayPatient) return;

    try {
      await api.updatePatientV2(displayPatient.id, data);
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

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    reset();
  };

  const handleClose = () => {
    setIsEditMode(false);
    reset();
    onClose();
  };

  if (!displayPatient) return null;

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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                    <Label htmlFor="first_name">Primer Nombre *</Label>
                    <Input
                      id="first_name"
                      {...register('first_name')}
                      className={errors.first_name ? 'border-red-500' : ''}
                    />
                    {errors.first_name && (
                      <p className="text-red-500 text-sm mt-1">{errors.first_name.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="middle_name">Segundo Nombre</Label>
                    <Input id="middle_name" {...register('middle_name')} />
                  </div>
                  
                  <div>
                    <Label htmlFor="last_name">Primer Apellido *</Label>
                    <Input
                      id="last_name"
                      {...register('last_name')}
                      className={errors.last_name ? 'border-red-500' : ''}
                    />
                    {errors.last_name && (
                      <p className="text-red-500 text-sm mt-1">{errors.last_name.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="second_last_name">Segundo Apellido</Label>
                    <Input id="second_last_name" {...register('second_last_name')} />
                  </div>

                  <div>
                    <Label htmlFor="document_type">Tipo de Documento *</Label>
                    <Select
                      value={watch('document_type')}
                      onValueChange={(value) => setValue('document_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                        <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                        <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                        <SelectItem value="PAS">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="document_number">Número de Documento *</Label>
                    <Input
                      id="document_number"
                      {...register('document_number')}
                      className={errors.document_number ? 'border-red-500' : ''}
                    />
                    {errors.document_number && (
                      <p className="text-red-500 text-sm mt-1">{errors.document_number.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="birth_date">Fecha de Nacimiento *</Label>
                    <Input
                      id="birth_date"
                      type="date"
                      {...register('birth_date')}
                      className={errors.birth_date ? 'border-red-500' : ''}
                    />
                    {errors.birth_date && (
                      <p className="text-red-500 text-sm mt-1">{errors.birth_date.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="gender">Género *</Label>
                    <Select
                      value={watch('gender')}
                      onValueChange={(value) => setValue('gender', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar género" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                        <SelectItem value="O">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p><strong>Nombre completo:</strong> {`${displayPatient.first_name} ${displayPatient.middle_name || ''} ${displayPatient.last_name} ${displayPatient.second_last_name || ''}`.trim().replace(/\s+/g, ' ')}</p>
                  <p><strong>Documento:</strong> {displayPatient.document_type} {displayPatient.document_number}</p>
                  <p><strong>Fecha de nacimiento:</strong> {new Date(displayPatient.birth_date).toLocaleDateString()}</p>
                  <p><strong>Género:</strong> 
                    <Badge variant="outline" className="ml-2">
                      {displayPatient.gender === 'M' ? 'Masculino' : displayPatient.gender === 'F' ? 'Femenino' : 'Otro'}
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
                  
                  <div>
                    <Label htmlFor="municipality">Municipio</Label>
                    <Select
                      value={watch('municipality')}
                      onValueChange={(value) => setValue('municipality', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar municipio" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(municipalities) && municipalities.map((municipality) => (
                          <SelectItem key={municipality.id} value={municipality.id}>
                            {municipality.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayPatient.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {displayPatient.phone}
                    </p>
                  )}
                  {displayPatient.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {displayPatient.email}
                    </p>
                  )}
                  {displayPatient.address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {displayPatient.address}
                    </p>
                  )}
                  {(displayPatient.municipality_name || displayPatient.municipality) && (
                    <p><strong>Municipio:</strong> {displayPatient.municipality_name || displayPatient.municipality}</p>
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
              
              {isEditMode ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="blood_type">Tipo de Sangre</Label>
                    <Select
                      value={watch('blood_type')}
                      onValueChange={(value) => setValue('blood_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo de sangre" />
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
                  </div>
                  
                  <div>
                    <Label htmlFor="allergies">Alergias</Label>
                    <Textarea id="allergies" {...register('allergies')} />
                  </div>
                  
                  <div>
                    <Label htmlFor="chronic_conditions">Condiciones Crónicas</Label>
                    <Textarea id="chronic_conditions" {...register('chronic_conditions')} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayPatient.blood_type && (
                    <p><strong>Tipo de sangre:</strong>
                      <Badge variant="outline" className="ml-2">{displayPatient.blood_type}</Badge>
                    </p>
                  )}
                  {displayPatient.allergies && (
                    <p><strong>Alergias:</strong> {displayPatient.allergies}</p>
                  )}
                  {displayPatient.chronic_conditions && (
                    <p><strong>Condiciones crónicas:</strong> {displayPatient.chronic_conditions}</p>
                  )}
                </div>
              )}
            </div>

            {/* Información de Seguro e Información Demográfica */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Seguro y Demografía
              </h3>
              
              {isEditMode ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="eps">EPS</Label>
                    <Input id="eps" {...register('eps')} />
                  </div>
                  
                  <div>
                    <Label htmlFor="affiliation_type">Tipo de Afiliación</Label>
                    <Select
                      value={watch('affiliation_type')}
                      onValueChange={(value) => setValue('affiliation_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Contributivo">Contributivo</SelectItem>
                        <SelectItem value="Subsidiado">Subsidiado</SelectItem>
                        <SelectItem value="Particular">Particular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="education_level">Nivel Educativo</Label>
                    <Select
                      value={watch('education_level')}
                      onValueChange={(value) => setValue('education_level', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Primaria">Primaria</SelectItem>
                        <SelectItem value="Secundaria">Secundaria</SelectItem>
                        <SelectItem value="Técnico">Técnico</SelectItem>
                        <SelectItem value="Tecnológico">Tecnológico</SelectItem>
                        <SelectItem value="Universitario">Universitario</SelectItem>
                        <SelectItem value="Posgrado">Posgrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="marital_status">Estado Civil</Label>
                    <Select
                      value={watch('marital_status')}
                      onValueChange={(value) => setValue('marital_status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Soltero">Soltero</SelectItem>
                        <SelectItem value="Casado">Casado</SelectItem>
                        <SelectItem value="Unión libre">Unión libre</SelectItem>
                        <SelectItem value="Divorciado">Divorciado</SelectItem>
                        <SelectItem value="Viudo">Viudo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="occupation">Ocupación</Label>
                    <Input id="occupation" {...register('occupation')} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayPatient.eps && (
                    <p><strong>EPS:</strong> {displayPatient.eps}</p>
                  )}
                  {displayPatient.affiliation_type && (
                    <p><strong>Tipo de afiliación:</strong>
                      <Badge variant="outline" className="ml-2">{displayPatient.affiliation_type}</Badge>
                    </p>
                  )}
                  {displayPatient.education_level && (
                    <p><strong>Nivel educativo:</strong> {displayPatient.education_level}</p>
                  )}
                  {displayPatient.marital_status && (
                    <p><strong>Estado civil:</strong> {displayPatient.marital_status}</p>
                  )}
                  {displayPatient.occupation && (
                    <p><strong>Ocupación:</strong> {displayPatient.occupation}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contacto de Emergencia */}
          {(isEditMode || patient?.emergency_contact_name || patient?.emergency_contact_phone) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contacto de Emergencia
              </h3>
              
              {isEditMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergency_contact_name">Nombre del Contacto</Label>
                    <Input id="emergency_contact_name" {...register('emergency_contact_name')} />
                  </div>
                  
                  <div>
                    <Label htmlFor="emergency_contact_phone">Teléfono del Contacto</Label>
                    <Input id="emergency_contact_phone" {...register('emergency_contact_phone')} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {patient?.emergency_contact_name && (
                    <p><strong>Nombre:</strong> {patient.emergency_contact_name}</p>
                  )}
                  {patient?.emergency_contact_phone && (
                    <p><strong>Teléfono:</strong> {patient.emergency_contact_phone}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Información del Sistema */}
          {!isEditMode && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Información del Sistema
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                {patient?.created_at && (
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <strong>Creado:</strong> {new Date(patient.created_at).toLocaleString()}
                  </p>
                )}
                {patient?.updated_at && (
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <strong>Actualizado:</strong> {new Date(patient.updated_at).toLocaleString()}
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
      </DialogContent>
    </Dialog>
  );
};

export default PatientDetailsModal;