import { z } from 'zod';

/**
 * Schema de validación para registro MÍNIMO de paciente
 * Solo campos obligatorios para crear un registro básico
 */
export const patientBasicSchema = z.object({
  // Campos obligatorios mínimos
  document: z.string()
    .min(5, 'El documento debe tener al menos 5 caracteres')
    .max(20, 'El documento no puede exceder 20 caracteres')
    .regex(/^[0-9]+$/, 'El documento solo puede contener números'),
  
  name: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),
  
  phone: z.string()
    .min(7, 'El teléfono debe tener al menos 7 dígitos')
    .max(15, 'El teléfono no puede exceder 15 dígitos')
    .regex(/^[0-9+\s()-]+$/, 'Formato de teléfono inválido'),
});

/**
 * Schema para datos de contacto adicionales
 */
export const patientContactSchema = z.object({
  phone: z.string()
    .min(7, 'El teléfono debe tener al menos 7 dígitos')
    .max(15, 'El teléfono no puede exceder 15 dígitos')
    .regex(/^[0-9+\s()-]+$/, 'Formato de teléfono inválido'),
  
  phone_alt: z.string()
    .max(15, 'El teléfono no puede exceder 15 dígitos')
    .regex(/^[0-9+\s()-]*$/, 'Formato de teléfono inválido')
    .optional()
    .nullable(),
  
  email: z.string()
    .email('Email inválido')
    .max(100, 'El email no puede exceder 100 caracteres')
    .optional()
    .nullable(),
  
  address: z.string()
    .max(200, 'La dirección no puede exceder 200 caracteres')
    .optional()
    .nullable(),
  
  municipality_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar un municipio válido')
      .positive('Debe seleccionar un municipio')
      .optional()
      .nullable()
  ),
  
  zone_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar una zona válida')
      .positive('Debe seleccionar una zona')
      .optional()
      .nullable()
  ),
});

/**
 * Schema para información personal adicional
 */
export const patientPersonalSchema = z.object({
  document: z.string()
    .min(5, 'El documento debe tener al menos 5 caracteres')
    .max(20, 'El documento no puede exceder 20 caracteres')
    .regex(/^[0-9]+$/, 'El documento solo puede contener números'),
  
  name: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),
  
  birth_date: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato YYYY-MM-DD)')
      .optional()
      .nullable()
  ),
  
  gender: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.enum(['Masculino', 'Femenino', 'Otro'], {
      errorMap: () => ({ message: 'Debe seleccionar un género válido' })
    }).optional().nullable()
  ),
  
  document_type_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar un tipo de documento válido')
      .positive('Debe seleccionar un tipo de documento')
      .optional()
      .nullable()
  ),
  
  status: z.enum(['Activo', 'Inactivo'], {
    errorMap: () => ({ message: 'Debe seleccionar un estado válido' })
  }).default('Activo'),
});

/**
 * Schema para información médica
 */
export const patientMedicalSchema = z.object({
  blood_group_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar un grupo sanguíneo válido')
      .positive('Debe seleccionar un grupo sanguíneo')
      .optional()
      .nullable()
  ),
  
  has_disability: z.boolean()
    .default(false),
  
  disability_type_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar un tipo de discapacidad válido')
      .positive('Debe seleccionar un tipo de discapacidad')
      .optional()
      .nullable()
  ),
  
  notes: z.string()
    .max(500, 'Las notas no pueden exceder 500 caracteres')
    .optional()
    .nullable(),
});

/**
 * Schema para información de seguro
 */
export const patientInsuranceSchema = z.object({
  insurance_eps_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar una EPS válida')
      .positive('Debe seleccionar una EPS')
      .optional()
      .nullable()
  ),
  
  insurance_affiliation_type: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.enum(['Contributivo', 'Subsidiado', 'Particular', 'Otro'], {
      errorMap: () => ({ message: 'Debe seleccionar un tipo de afiliación válido' })
    }).optional().nullable()
  ),
});

/**
 * Schema para información demográfica
 */
export const patientDemographicSchema = z.object({
  education_level_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar un nivel educativo válido')
      .positive('Debe seleccionar un nivel educativo')
      .optional()
      .nullable()
  ),
  
  marital_status_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar un estado civil válido')
      .positive('Debe seleccionar un estado civil')
      .optional()
      .nullable()
  ),
  
  population_group_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('Debe seleccionar un grupo poblacional válido')
      .positive('Debe seleccionar un grupo poblacional')
      .optional()
      .nullable()
  ),
  
  estrato: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : val,
    z.number()
      .int('El estrato debe ser un número entero')
      .min(1, 'El estrato debe ser entre 1 y 6')
      .max(6, 'El estrato debe ser entre 1 y 6')
      .optional()
      .nullable()
  ),
});

/**
 * Schema COMPLETO para crear/editar paciente con todos los campos
 */
export const patientFullSchema = patientPersonalSchema
  .merge(patientContactSchema)
  .merge(patientMedicalSchema)
  .merge(patientInsuranceSchema)
  .merge(patientDemographicSchema);

/**
 * Tipos TypeScript inferidos de los schemas
 */
export type PatientBasicFormData = z.infer<typeof patientBasicSchema>;
export type PatientContactFormData = z.infer<typeof patientContactSchema>;
export type PatientPersonalFormData = z.infer<typeof patientPersonalSchema>;
export type PatientMedicalFormData = z.infer<typeof patientMedicalSchema>;
export type PatientInsuranceFormData = z.infer<typeof patientInsuranceSchema>;
export type PatientDemographicFormData = z.infer<typeof patientDemographicSchema>;
export type PatientFullFormData = z.infer<typeof patientFullSchema>;

/**
 * Valores por defecto para formulario básico
 */
export const defaultBasicValues: PatientBasicFormData = {
  document: '',
  name: '',
  phone: '',
};

/**
 * Valores por defecto para formulario completo
 */
export const defaultFullValues: Partial<PatientFullFormData> = {
  document: '',
  name: '',
  phone: '',
  phone_alt: null,
  email: null,
  address: null,
  municipality_id: null,
  zone_id: null,
  birth_date: null,
  gender: null,
  document_type_id: null,
  status: 'Activo',
  blood_group_id: null,
  has_disability: false,
  disability_type_id: null,
  notes: null,
  insurance_eps_id: null,
  insurance_affiliation_type: null,
  education_level_id: null,
  marital_status_id: null,
  population_group_id: null,
  estrato: null,
};
