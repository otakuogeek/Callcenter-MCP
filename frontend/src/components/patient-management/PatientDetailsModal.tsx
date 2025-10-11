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
import { Patient } from '@/types/patient';

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

  useEffect(() => {
    if (patient && isOpen) {
      loadFullPatientData(String(patient.id));
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
                  <p><strong>Fecha de nacimiento:</strong> {patient?.birth_date ? new Date(patient.birth_date).toLocaleDateString('es-ES') : 'Invalid Date'}</p>
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