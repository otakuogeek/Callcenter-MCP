# Migración y Mejora de la Tabla Appointments

## Fecha: 30 de Septiembre de 2025

### Resumen
Se ha realizado una migración completa de la tabla `appointments` para soportar todos los campos requeridos por los formularios de "Asignación Inteligente de Citas" y "Registrar Cita Rápida". La estructura ahora incluye 20 campos adicionales que permiten un registro completo y detallado de las citas médicas.

## Nuevos Campos Agregados

### 1. Información de la Consulta
- `consultation_reason_detailed` (TEXT) - Motivo detallado de la consulta
- `additional_notes` (TEXT) - Notas adicionales específicas
- `symptoms` (TEXT) - Síntomas reportados por el paciente

### 2. Información Médica
- `allergies` (TEXT) - Alergias reportadas para esta cita
- `medications` (TEXT) - Medicamentos actuales del paciente

### 3. Prioridad y Seguimiento
- `priority_level` (ENUM) - Baja, Normal, Alta, Urgente
- `follow_up_required` (BOOLEAN) - Si requiere seguimiento
- `follow_up_date` (DATE) - Fecha sugerida para seguimiento

### 4. Seguro y Pago
- `insurance_company` (VARCHAR(100)) - Compañía de seguros específica
- `insurance_policy_number` (VARCHAR(50)) - Número de póliza de seguro
- `payment_method` (ENUM) - Efectivo, Tarjeta, Transferencia, Seguro, Credito
- `copay_amount` (DECIMAL(10,2)) - Monto de copago

### 5. Recordatorios
- `reminder_sent` (BOOLEAN) - Si se envió recordatorio
- `reminder_sent_at` (TIMESTAMP) - Fecha cuando se envió el recordatorio

### 6. Contacto de Emergencia
- `emergency_contact_name` (VARCHAR(100)) - Nombre contacto de emergencia
- `emergency_contact_phone` (VARCHAR(30)) - Teléfono contacto de emergencia

### 7. Preferencias y Origen
- `preferred_time` (VARCHAR(50)) - Horario preferido del paciente
- `appointment_source` (ENUM) - Manual, Sistema_Inteligente, Llamada, Web, App

### 8. Metadatos
- `updated_at` (TIMESTAMP) - Fecha de última actualización

## Campos Modificados

### Campos Ampliados
- `reason` - Cambiado de VARCHAR(255) a TEXT para motivos más largos
- `insurance_type` - Cambiado de VARCHAR(100) a VARCHAR(150) para más opciones

## Índices Agregados

Se agregaron los siguientes índices para mejorar el rendimiento:
- `idx_appointments_priority` - Para consultas por prioridad
- `idx_appointments_source` - Para consultas por origen
- `idx_appointments_reminder` - Para gestión de recordatorios
- `idx_appointments_updated_at` - Para consultas por fecha de actualización

## Restricciones Agregadas

- `chk_copay_amount` - Validación que el copago sea mayor o igual a 0

## Archivos Modificados

### Backend
1. **`/migrations/improve_appointments_table.sql`** - Script de migración SQL
2. **`/src/routes/appointments.ts`** - Esquema Zod actualizado con nuevos campos
3. **Nuevos tipos**: Se recomienda usar los tipos de `/src/types/enhanced-types.ts`

### Frontend
1. **`/src/types/appointment.ts`** - Nuevos tipos TypeScript completos
2. **`/src/examples/ExtendedAppointmentForm.tsx`** - Ejemplo de formulario completo

## Compatibilidad

### Retrocompatibilidad
✅ **Totalmente compatible** - Todos los campos nuevos son opcionales (`NULL` permitido)
✅ **APIs existentes** - Siguen funcionando sin cambios
✅ **Formularios actuales** - No requieren modificación inmediata

### Campos Requeridos
Solo los campos originales siguen siendo requeridos:
- `patient_id`
- `location_id`
- `specialty_id` 
- `doctor_id`
- `scheduled_at`

## Uso en Formularios

### Formulario de Asignación Inteligente
Puede utilizar todos los nuevos campos:
- Información médica detallada (síntomas, alergias, medicamentos)
- Contacto de emergencia
- Nivel de prioridad
- Seguimiento automático

### Formulario de Cita Rápida
Campos principales utilizados:
- Motivo detallado de consulta
- Tipo de seguro específico
- Método de pago
- Notas adicionales

## Ejemplos de Uso

### Crear Cita con Nuevos Campos
```typescript
import { AppointmentCreate } from '@/types/appointment';

const newAppointment: AppointmentCreate = {
  patient_id: 123,
  location_id: 1,
  specialty_id: 2,
  doctor_id: 45,
  scheduled_at: '2025-10-15T09:00:00',
  duration_minutes: 30,
  appointment_type: 'Presencial',
  reason: 'Consulta general',
  consultation_reason_detailed: 'Control rutinario con revisión de exámenes',
  priority_level: 'Normal',
  insurance_company: 'Sura',
  appointment_source: 'Sistema_Inteligente',
  symptoms: 'Dolor de cabeza ocasional',
  follow_up_required: true,
  follow_up_date: '2025-11-15'
};
```

### Consulta SQL con Nuevos Campos
```sql
SELECT 
  a.*,
  p.name as patient_name,
  d.name as doctor_name,
  s.name as specialty_name,
  l.name as location_name
FROM appointments a
JOIN patients p ON p.id = a.patient_id
JOIN doctors d ON d.id = a.doctor_id  
JOIN specialties s ON s.id = a.specialty_id
JOIN locations l ON l.id = a.location_id
WHERE a.priority_level = 'Alta'
  AND a.appointment_source = 'Sistema_Inteligente'
  AND a.follow_up_required = 1
ORDER BY a.scheduled_at ASC;
```

## Recomendaciones de Implementación

### Fase 1: Migración Completada ✅
- [x] Estructura de base de datos actualizada
- [x] Tipos TypeScript definidos
- [x] Esquema Zod del backend actualizado

### Fase 2: Actualización de Formularios (Siguiente)
1. Actualizar `QuickAppointmentModal.tsx` para usar nuevos campos
2. Actualizar `SmartAppointmentModal.tsx` para funcionalidad completa
3. Modificar APIs de frontend para enviar nuevos datos

### Fase 3: Funcionalidades Avanzadas (Futuro)
1. Sistema de recordatorios automáticos
2. Seguimiento de citas
3. Reportes por prioridad y origen
4. Dashboard de copagos

## Notas Importantes

⚠️ **Backup**: Se recomienda tener backup antes de cualquier cambio adicional
📊 **Monitoreo**: Los nuevos índices mejorarán el rendimiento de consultas
🔒 **Validación**: Todos los campos tienen validación tanto en BD como en TypeScript
🎯 **Objetivo**: Estructura preparada para formularios completos y funcionalidades avanzadas

## Próximos Pasos

1. **Actualizar formularios existentes** para usar los nuevos campos
2. **Implementar validaciones frontend** con los nuevos tipos
3. **Crear funcionalidades de seguimiento** usando `follow_up_required` y `follow_up_date`
4. **Desarrollar sistema de recordatorios** con `reminder_sent` y `reminder_sent_at`
5. **Implementar filtros avanzados** por prioridad, origen y método de pago

La estructura está lista para soportar un sistema de citas médicas completo y profesional. 🎉