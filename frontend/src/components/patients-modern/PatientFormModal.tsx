import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  patientBasicSchema,
  patientFullSchema,
  defaultBasicValues,
  defaultFullValues,
  type PatientBasicFormData,
  type PatientFullFormData,
} from '@/schemas/patientSchemas';
import type { Patient, Municipality, Zone, EPS } from '@/types/patient';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Heart,
  Shield,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
  ClipboardList,
} from 'lucide-react';

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PatientBasicFormData | PatientFullFormData, isQuickMode: boolean) => void;
  patient?: Patient | null; // Si existe, es modo edición
  isLoading?: boolean;
}

type FormMode = 'quick' | 'complete';
type WizardStep = 1 | 2 | 3 | 4 | 5;

export const PatientFormModal: React.FC<PatientFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  patient,
  isLoading = false,
}) => {
  const { toast } = useToast();
  const [formMode, setFormMode] = useState<FormMode>('quick');
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const isEditMode = !!patient;

  // Cargar municipios desde la API
  const { data: municipalitiesData } = useQuery<Municipality[]>({
    queryKey: ['municipalities'],
    queryFn: async () => {
      const response = await fetch('/api/lookups/municipalities', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error al cargar municipios');
      const result = await response.json();
      return result.data || result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Cargar zonas desde la API
  const { data: zonesData } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => {
      const response = await fetch('/api/lookups/zones', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error al cargar zonas');
      const result = await response.json();
      return result.data || result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Cargar EPS desde la API
  const { data: epsData } = useQuery<EPS[]>({
    queryKey: ['eps'],
    queryFn: async () => {
      const response = await fetch('/api/lookups/eps', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error al cargar EPS');
      const result = await response.json();
      return result.data || result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Form para modo rápido
  const quickForm = useForm<PatientBasicFormData>({
    resolver: zodResolver(patientBasicSchema),
    defaultValues: defaultBasicValues,
  });

  // Form para modo completo
  const completeForm = useForm<PatientFullFormData>({
    resolver: zodResolver(patientFullSchema),
    defaultValues: defaultFullValues as PatientFullFormData,
    mode: 'onChange', // Validar en cada cambio
    reValidateMode: 'onChange', // Re-validar en cada cambio
  });

  // Cuando se abre el modal en modo edición, rellenar datos
  useEffect(() => {
    if (isOpen && patient) {
      console.log('📝 Cargando paciente en formulario:', patient);
      
      setFormMode('complete');
      setCurrentStep(1); // Asegurar que empiece en paso 1 para mostrar todos los campos
      
      // Función para convertir fecha ISO a formato yyyy-MM-dd
      const formatDateForInput = (dateValue: string | null): string | null => {
        if (!dateValue) return null;
        try {
          // Si es ISO string, convertir a yyyy-MM-dd
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return null;
          
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } catch (error) {
          console.warn('Error al formatear fecha:', error);
          return null;
        }
      };
      
      const formData = {
        document: patient.document || '',
        document_type_id: patient.document_type_id || null,
        name: patient.name || '',
        phone: patient.phone || '',
        phone_alt: patient.phone_alt || null,
        email: patient.email || null,
        address: patient.address || null,
        municipality_id: patient.municipality_id || null,
        zone_id: patient.zone_id || null,
        birth_date: formatDateForInput(patient.birth_date),
        gender: patient.gender || null,
        status: patient.status || 'Activo',
        blood_group_id: patient.blood_group_id || null,
        has_disability: patient.has_disability || false,
        disability_type_id: patient.disability_type_id || null,
        notes: patient.notes || null,
        insurance_eps_id: patient.insurance_eps_id || null,
        insurance_affiliation_type: patient.insurance_affiliation_type || null,
        education_level_id: patient.education_level_id || null,
        marital_status_id: patient.marital_status_id || null,
        population_group_id: patient.population_group_id || null,
        estrato: patient.estrato || null,
      };
      
      console.log('📋 Datos a cargar en formulario:', formData);
      
      // Usar reset con valores para forzar actualización
      setTimeout(() => {
        completeForm.reset(formData, { keepDefaultValues: false });
        console.log('✅ Formulario reseteado con datos del paciente');
      }, 50);
    }
  }, [isOpen, patient]);

  // Resetear al cerrar
  useEffect(() => {
    if (!isOpen) {
      quickForm.reset(defaultBasicValues);
      completeForm.reset(defaultFullValues as PatientFullFormData);
      setFormMode('quick');
      setCurrentStep(1);
    }
  }, [isOpen, quickForm, completeForm]);

  const handleQuickSubmit = (data: PatientBasicFormData) => {
    onSubmit(data, true);
  };

  const handleCompleteSubmit = (data: PatientFullFormData) => {
    console.log('✅ handleCompleteSubmit ejecutado con datos:', data);
    console.log('🔍 Errores del formulario:', completeForm.formState.errors);
    onSubmit(data, false);
  };

  const handleNextStep = async () => {
    let isValid = false;

    // Validar según el paso actual
    switch (currentStep) {
      case 1:
        isValid = await completeForm.trigger(['document', 'name', 'birth_date', 'gender', 'status']);
        break;
      case 2:
        isValid = await completeForm.trigger(['phone', 'phone_alt', 'email', 'address', 'municipality_id']);
        break;
      case 3:
        isValid = await completeForm.trigger(['blood_group_id', 'has_disability', 'disability_type_id']);
        break;
      case 4:
        isValid = await completeForm.trigger(['insurance_eps_id', 'insurance_affiliation_type']);
        break;
      case 5:
        isValid = true; // Último paso, todos los campos son opcionales
        break;
    }

    if (isValid && currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    } else if (!isValid) {
      toast({
        title: 'Campos incompletos',
        description: 'Por favor complete los campos requeridos antes de continuar',
        variant: 'destructive',
      });
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const calculateProgress = () => {
    return (currentStep / 5) * 100;
  };

  // Pantalla de selección de modo (solo al crear nuevo)
  if (!isEditMode && formMode === 'quick' && currentStep === 1) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Registrar Nuevo Paciente</DialogTitle>
            <DialogDescription>
              Seleccione el tipo de registro que desea realizar
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6">
            {/* Opción Registro Rápido */}
            <button
              onClick={() => setFormMode('quick')}
              className="group relative flex items-start gap-4 rounded-lg border-2 border-gray-200 p-6 hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 group-hover:bg-blue-500">
                <Zap className="h-6 w-6 text-blue-600 group-hover:text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg mb-1">Registro Rápido</h3>
                <p className="text-sm text-gray-600">
                  Solo los datos esenciales: documento, nombre y teléfono.
                  Ideal para registros urgentes.
                </p>
                <p className="text-xs text-blue-600 mt-2 font-medium">⚡ 30 segundos</p>
              </div>
            </button>

            {/* Opción Registro Completo */}
            <button
              onClick={() => {
                setFormMode('complete');
                setCurrentStep(1);
              }}
              className="group relative flex items-start gap-4 rounded-lg border-2 border-gray-200 p-6 hover:border-green-500 hover:bg-green-50 transition-all"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 group-hover:bg-green-500">
                <ClipboardList className="h-6 w-6 text-green-600 group-hover:text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg mb-1">Registro Completo</h3>
                <p className="text-sm text-gray-600">
                  Formulario guiado paso a paso con toda la información:
                  contacto, médica, seguro y demográfica.
                </p>
                <p className="text-xs text-green-600 mt-2 font-medium">📋 5 pasos • 3-5 minutos</p>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Formulario Rápido
  if (formMode === 'quick' && !isEditMode) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              Registro Rápido
            </DialogTitle>
            <DialogDescription>
              Complete solo los datos esenciales. Podrá agregar más información después.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={quickForm.handleSubmit(handleQuickSubmit)} className="space-y-4">
            {/* Documento */}
            <div className="space-y-2">
              <Label htmlFor="document" className="required">
                Número de Documento
              </Label>
              <Input
                id="document"
                placeholder="Ej: 1234567890"
                {...quickForm.register('document')}
                className={quickForm.formState.errors.document ? 'border-red-500' : ''}
              />
              {quickForm.formState.errors.document && (
                <p className="text-sm text-red-500">
                  {quickForm.formState.errors.document.message}
                </p>
              )}
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name" className="required">
                Nombre Completo
              </Label>
              <Input
                id="name"
                placeholder="Ej: Juan Pérez García"
                {...quickForm.register('name')}
                className={quickForm.formState.errors.name ? 'border-red-500' : ''}
              />
              {quickForm.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {quickForm.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="required">
                Teléfono
              </Label>
              <Input
                id="phone"
                placeholder="Ej: 3001234567"
                {...quickForm.register('phone')}
                className={quickForm.formState.errors.phone ? 'border-red-500' : ''}
              />
              {quickForm.formState.errors.phone && (
                <p className="text-sm text-red-500">
                  {quickForm.formState.errors.phone.message}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormMode('quick')}
              >
                Volver
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Guardando...' : 'Registrar Paciente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Formulario Completo - Wizard de 5 pasos
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        key={patient?.id || 'new'} 
        className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEditMode ? 'Editar Paciente' : 'Registro Completo de Paciente'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Modifique la información del paciente'
              : `Paso ${currentStep} de 5 - Complete la información solicitada`}
          </DialogDescription>
        </DialogHeader>

        {/* Barra de progreso */}
        {!isEditMode && (
          <div className="space-y-2">
            <Progress value={calculateProgress()} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span className={currentStep >= 1 ? 'text-blue-600 font-medium' : ''}>
                Personal
              </span>
              <span className={currentStep >= 2 ? 'text-blue-600 font-medium' : ''}>
                Contacto
              </span>
              <span className={currentStep >= 3 ? 'text-blue-600 font-medium' : ''}>
                Médica
              </span>
              <span className={currentStep >= 4 ? 'text-blue-600 font-medium' : ''}>
                Seguro
              </span>
              <span className={currentStep >= 5 ? 'text-blue-600 font-medium' : ''}>
                Demográfica
              </span>
            </div>
          </div>
        )}

        <form
          onSubmit={completeForm.handleSubmit(
            handleCompleteSubmit,
            (errors) => {
              console.error('❌ Errores de validación del formulario:', errors);
              console.error('📋 Valores actuales:', completeForm.getValues());
            }
          )}
          className="space-y-6"
        >
          {/* PASO 1: Información Personal */}
          {(currentStep === 1 || isEditMode) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                <User className="h-5 w-5 text-blue-500" />
                <span>Información Personal</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Documento */}
                <div className="space-y-2">
                  <Label htmlFor="complete-document" className="required">
                    Número de Documento
                  </Label>
                  <Input
                    id="complete-document"
                    placeholder="1234567890"
                    {...completeForm.register('document')}
                    className={completeForm.formState.errors.document ? 'border-red-500' : ''}
                  />
                  {completeForm.formState.errors.document && (
                    <p className="text-sm text-red-500">
                      {completeForm.formState.errors.document.message}
                    </p>
                  )}
                </div>

                {/* Tipo de Documento */}
                <div className="space-y-2">
                  <Label htmlFor="document_type_id">Tipo de Documento</Label>
                  <Select
                    onValueChange={(value) =>
                      completeForm.setValue('document_type_id', value ? parseInt(value) : null)
                    }
                    value={completeForm.watch('document_type_id')?.toString() || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Cédula de Ciudadanía</SelectItem>
                      <SelectItem value="2">Tarjeta de Identidad</SelectItem>
                      <SelectItem value="3">Cédula de Extranjería</SelectItem>
                      <SelectItem value="4">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Nombre Completo */}
              <div className="space-y-2">
                <Label htmlFor="complete-name" className="required">
                  Nombre Completo
                </Label>
                <Input
                  id="complete-name"
                  placeholder="Juan Pérez García"
                  {...completeForm.register('name')}
                  className={completeForm.formState.errors.name ? 'border-red-500' : ''}
                />
                {completeForm.formState.errors.name && (
                  <p className="text-sm text-red-500">
                    {completeForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Fecha de Nacimiento */}
                <div className="space-y-2">
                  <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    {...completeForm.register('birth_date')}
                  />
                </div>

                {/* Género */}
                <div className="space-y-2">
                  <Label htmlFor="gender">Género</Label>
                  <Select
                    onValueChange={(value) =>
                      completeForm.setValue('gender', (value || null) as 'Masculino' | 'Femenino' | 'Otro' | null)
                    }
                    value={completeForm.watch('gender') || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Estado */}
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  onValueChange={(value) =>
                    completeForm.setValue('status', value as 'Activo' | 'Inactivo')
                  }
                  value={completeForm.watch('status')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* PASO 2: Información de Contacto */}
          {(currentStep === 2 || isEditMode) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                <Phone className="h-5 w-5 text-green-500" />
                <span>Información de Contacto</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Teléfono Principal */}
                <div className="space-y-2">
                  <Label htmlFor="complete-phone" className="required">
                    Teléfono Principal
                  </Label>
                  <Input
                    id="complete-phone"
                    placeholder="3001234567"
                    {...completeForm.register('phone')}
                    className={completeForm.formState.errors.phone ? 'border-red-500' : ''}
                  />
                  {completeForm.formState.errors.phone && (
                    <p className="text-sm text-red-500">
                      {completeForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                {/* Teléfono Alternativo */}
                <div className="space-y-2">
                  <Label htmlFor="phone_alt">Teléfono Alternativo</Label>
                  <Input
                    id="phone_alt"
                    placeholder="3009876543"
                    {...completeForm.register('phone_alt')}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  {...completeForm.register('email')}
                />
              </div>

              {/* Dirección */}
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  placeholder="Calle 123 #45-67"
                  {...completeForm.register('address')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Zona - PRIMERO */}
                <div className="space-y-2">
                  <Label htmlFor="zone_id">Zona</Label>
                  <Select
                    onValueChange={(value) => {
                      const zoneId = parseInt(value);
                      completeForm.setValue('zone_id', zoneId);
                      // Limpiar municipio cuando cambia la zona
                      completeForm.setValue('municipality_id', undefined as any);
                    }}
                    value={completeForm.watch('zone_id')?.toString() || ''}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una zona" />
                    </SelectTrigger>
                    <SelectContent>
                      {zonesData && zonesData.length > 0 ? (
                        zonesData.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id.toString()}>
                            {zone.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="0" disabled>
                          Cargando zonas...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Municipio - SEGUNDO (filtrado por zona) */}
                <div className="space-y-2">
                  <Label htmlFor="municipality_id">Municipio</Label>
                  <Select
                    onValueChange={(value) =>
                      completeForm.setValue('municipality_id', value ? parseInt(value) : null)
                    }
                    value={completeForm.watch('municipality_id')?.toString() || ''}
                    disabled={!completeForm.watch('zone_id')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        completeForm.watch('zone_id') 
                          ? "Seleccione un municipio" 
                          : "Primero seleccione una zona"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const selectedZoneId = completeForm.watch('zone_id');
                        if (!selectedZoneId) {
                          return (
                            <SelectItem value="0" disabled>
                              Primero seleccione una zona
                            </SelectItem>
                          );
                        }
                        
                        const filteredMunicipalities = municipalitiesData?.filter(
                          m => m.zone_id === selectedZoneId
                        ) || [];

                        if (filteredMunicipalities.length === 0) {
                          return (
                            <SelectItem value="0" disabled>
                              No hay municipios para esta zona
                            </SelectItem>
                          );
                        }

                        return filteredMunicipalities.map((municipality) => (
                          <SelectItem key={municipality.id} value={municipality.id.toString()}>
                            {municipality.name}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Información Médica */}
          {(currentStep === 3 || isEditMode) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                <Heart className="h-5 w-5 text-red-500" />
                <span>Información Médica</span>
              </div>

              {/* Grupo Sanguíneo */}
              <div className="space-y-2">
                <Label htmlFor="blood_group_id">Grupo Sanguíneo</Label>
                <Select
                  onValueChange={(value) =>
                    completeForm.setValue('blood_group_id', value ? parseInt(value) : null)
                  }
                  value={completeForm.watch('blood_group_id')?.toString() || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">A+</SelectItem>
                    <SelectItem value="2">A-</SelectItem>
                    <SelectItem value="3">B+</SelectItem>
                    <SelectItem value="4">B-</SelectItem>
                    <SelectItem value="5">AB+</SelectItem>
                    <SelectItem value="6">AB-</SelectItem>
                    <SelectItem value="7">O+</SelectItem>
                    <SelectItem value="8">O-</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Discapacidad */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_disability"
                  checked={completeForm.watch('has_disability')}
                  onCheckedChange={(checked) =>
                    completeForm.setValue('has_disability', checked as boolean)
                  }
                />
                <Label htmlFor="has_disability" className="cursor-pointer">
                  ¿Presenta alguna discapacidad?
                </Label>
              </div>

              {/* Tipo de Discapacidad (solo si tiene discapacidad) */}
              {completeForm.watch('has_disability') && (
                <div className="space-y-2">
                  <Label htmlFor="disability_type_id">Tipo de Discapacidad</Label>
                  <Select
                    onValueChange={(value) =>
                      completeForm.setValue('disability_type_id', value ? parseInt(value) : null)
                    }
                    value={completeForm.watch('disability_type_id')?.toString() || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Física</SelectItem>
                      <SelectItem value="2">Visual</SelectItem>
                      <SelectItem value="3">Auditiva</SelectItem>
                      <SelectItem value="4">Cognitiva</SelectItem>
                      <SelectItem value="5">Psicosocial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notas Médicas */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas Médicas / Alergias</Label>
                <Textarea
                  id="notes"
                  placeholder="Escriba cualquier información médica relevante, alergias, condiciones preexistentes, etc."
                  {...completeForm.register('notes')}
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* PASO 4: Información de Seguro */}
          {(currentStep === 4 || isEditMode) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                <Shield className="h-5 w-5 text-purple-500" />
                <span>Información de Seguro</span>
              </div>

              {/* EPS */}
              <div className="space-y-2">
                <Label htmlFor="insurance_eps_id">EPS</Label>
                <Select
                  onValueChange={(value) =>
                    completeForm.setValue('insurance_eps_id', value ? parseInt(value) : null)
                  }
                  value={completeForm.watch('insurance_eps_id')?.toString() || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una EPS" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {epsData && epsData.length > 0 ? (
                      epsData.map((eps) => (
                        <SelectItem key={eps.id} value={eps.id.toString()}>
                          {eps.name} {eps.affiliation_type ? `(${eps.affiliation_type})` : ''}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="0" disabled>
                        Cargando EPS...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Afiliación */}
              <div className="space-y-2">
                <Label htmlFor="insurance_affiliation_type">Tipo de Afiliación</Label>
                <Select
                  onValueChange={(value) =>
                    completeForm.setValue(
                      'insurance_affiliation_type',
                      (value || null) as 'Contributivo' | 'Subsidiado' | 'Particular' | 'Otro' | null
                    )
                  }
                  value={completeForm.watch('insurance_affiliation_type') || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contributivo">Contributivo</SelectItem>
                    <SelectItem value="Subsidiado">Subsidiado</SelectItem>
                    <SelectItem value="Particular">Particular</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* PASO 5: Información Demográfica */}
          {(currentStep === 5 || isEditMode) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                <GraduationCap className="h-5 w-5 text-orange-500" />
                <span>Información Demográfica</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Nivel Educativo */}
                <div className="space-y-2">
                  <Label htmlFor="education_level_id">Nivel Educativo</Label>
                  <Select
                    onValueChange={(value) =>
                      completeForm.setValue('education_level_id', value ? parseInt(value) : null)
                    }
                    value={completeForm.watch('education_level_id')?.toString() || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Primaria</SelectItem>
                      <SelectItem value="2">Secundaria</SelectItem>
                      <SelectItem value="3">Técnico</SelectItem>
                      <SelectItem value="4">Tecnólogo</SelectItem>
                      <SelectItem value="5">Profesional</SelectItem>
                      <SelectItem value="6">Posgrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Estado Civil */}
                <div className="space-y-2">
                  <Label htmlFor="marital_status_id">Estado Civil</Label>
                  <Select
                    onValueChange={(value) =>
                      completeForm.setValue('marital_status_id', value ? parseInt(value) : null)
                    }
                    value={completeForm.watch('marital_status_id')?.toString() || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Soltero(a)</SelectItem>
                      <SelectItem value="2">Casado(a)</SelectItem>
                      <SelectItem value="3">Unión Libre</SelectItem>
                      <SelectItem value="4">Divorciado(a)</SelectItem>
                      <SelectItem value="5">Viudo(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Grupo Poblacional */}
                <div className="space-y-2">
                  <Label htmlFor="population_group_id">Grupo Poblacional</Label>
                  <Select
                    onValueChange={(value) =>
                      completeForm.setValue('population_group_id', value ? parseInt(value) : null)
                    }
                    value={completeForm.watch('population_group_id')?.toString() || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Ninguno</SelectItem>
                      <SelectItem value="2">Indígena</SelectItem>
                      <SelectItem value="3">Afrocolombiano</SelectItem>
                      <SelectItem value="4">ROM</SelectItem>
                      <SelectItem value="5">Palenquero</SelectItem>
                      <SelectItem value="6">Raizal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Estrato */}
                <div className="space-y-2">
                  <Label htmlFor="estrato">Estrato Socioeconómico</Label>
                  <Select
                    onValueChange={(value) =>
                      completeForm.setValue('estrato', value ? parseInt(value) : null)
                    }
                    value={completeForm.watch('estrato')?.toString() || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Estrato 1</SelectItem>
                      <SelectItem value="2">Estrato 2</SelectItem>
                      <SelectItem value="3">Estrato 3</SelectItem>
                      <SelectItem value="4">Estrato 4</SelectItem>
                      <SelectItem value="5">Estrato 5</SelectItem>
                      <SelectItem value="6">Estrato 6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Botones de navegación */}
          <DialogFooter className="gap-2">
            {!isEditMode && currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrevStep}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>

            {!isEditMode && currentStep < 5 ? (
              <Button type="button" onClick={handleNextStep}>
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isLoading}
                onClick={() => {
                  console.log('🔘 Click en botón Actualizar/Registrar');
                  console.log('📝 Datos del formulario:', completeForm.getValues());
                  console.log('❌ Errores:', completeForm.formState.errors);
                  console.log('✅ Es válido:', completeForm.formState.isValid);
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                {isLoading ? 'Guardando...' : isEditMode ? 'Actualizar' : 'Registrar'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
