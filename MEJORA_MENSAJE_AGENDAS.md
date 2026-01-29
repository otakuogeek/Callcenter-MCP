# Mejora en Mensajes de Creación de Agendas

## Fecha: 27 de enero de 2026

## Problema Identificado

El mensaje de éxito al crear agendas era genérico y no proporcionaba información útil:
- ❌ **Antes:** "Agenda(s) creada(s) exitosamente"
- No mostraba cuántas agendas se crearon
- No indicaba para qué doctor, especialidad o sede

## Solución Implementada

### Cambios en el Frontend

**Archivo modificado:** `/frontend/src/hooks/useAppointmentData.ts`

#### 1. Importación de `handleSuccess`

```typescript
// Antes
const { handleApiCall, handleError } = useErrorHandler();

// Después
const { handleApiCall, handleError, handleSuccess } = useErrorHandler();
```

#### 2. Refactorización de la función `addAvailability`

Se reemplazó el uso de `handleApiCall` con un try-catch personalizado para construir mensajes dinámicos:

**Características del nuevo mensaje:**

- ✅ Muestra el **número total de agendas creadas**
- ✅ Incluye el **nombre del doctor**
- ✅ Muestra la **especialidad**
- ✅ Indica la **sede**
- ✅ Diferencia entre singular y plural

**Ejemplo de mensajes:**

```text
Una sola agenda:
✅ Agenda creada exitosamente
📋 Doctor: Dr. Juan Pérez
🏥 Especialidad: Cardiología
📍 Sede: Sede Principal

Múltiples agendas:
✅ 5 agendas creadas exitosamente
📋 Doctor: Dra. María González
🏥 Especialidad: Pediatría
📍 Sede: Zona de Socorro
```

#### 3. Extracción de información desde los catálogos

```typescript
// Obtener nombres legibles desde los Maps de catálogos
const doctorName = doctorById.get(Number(availabilityData.doctor)) || 'el doctor';
const specialtyName = specialtyById.get(Number(availabilityData.specialty)) || 'la especialidad';
const locationName = locationById.get(Number(availabilityData.locationId)) || 'la sede';

// Calcular total de agendas creadas
const totalCreated = response.created_count || (availabilityData.dates?.length || 1);
```

#### 4. Construcción del mensaje dinámico

```typescript
let successMessage = '';
if (totalCreated === 1) {
  successMessage = `✅ Agenda creada exitosamente\n📋 Doctor: ${doctorName}\n🏥 Especialidad: ${specialtyName}\n📍 Sede: ${locationName}`;
} else {
  successMessage = `✅ ${totalCreated} agendas creadas exitosamente\n📋 Doctor: ${doctorName}\n🏥 Especialidad: ${specialtyName}\n📍 Sede: ${locationName}`;
}

handleSuccess(successMessage);
```

## Código Modificado

### Antes

```typescript
return handleApiCall(
  async () => {
    // ... código de creación ...
    return response;
  },
  "Agenda(s) creada(s) exitosamente", // ❌ Mensaje estático
  "No se pudo crear la(s) agenda(s)"
);
```

### Después

```typescript
try {
  // ... código de creación ...
  
  // 🔥 Construir mensaje de éxito con información detallada
  const totalCreated = response.created_count || (availabilityData.dates?.length || 1);
  const doctorName = doctorById.get(Number(availabilityData.doctor)) || 'el doctor';
  const specialtyName = specialtyById.get(Number(availabilityData.specialty)) || 'la especialidad';
  const locationName = locationById.get(Number(availabilityData.locationId)) || 'la sede';
  
  let successMessage = '';
  if (totalCreated === 1) {
    successMessage = `✅ Agenda creada exitosamente\n📋 Doctor: ${doctorName}\n🏥 Especialidad: ${specialtyName}\n📍 Sede: ${locationName}`;
  } else {
    successMessage = `✅ ${totalCreated} agendas creadas exitosamente\n📋 Doctor: ${doctorName}\n🏥 Especialidad: ${specialtyName}\n📍 Sede: ${locationName}`;
  }
  
  handleSuccess(successMessage);
  return response;
} catch (error) {
  handleError(error, "No se pudo crear la(s) agenda(s)");
  return null;
}
```

## Beneficios

1. **Información Clara:** El usuario sabe exactamente cuántas agendas se crearon
2. **Contexto Completo:** Se muestra toda la información relevante (doctor, especialidad, sede)
3. **Mejor UX:** Mensajes más informativos y útiles
4. **Confirmación Visual:** Los emojis hacen el mensaje más legible y atractivo
5. **Singular/Plural:** El mensaje se adapta según la cantidad de agendas creadas

## Testing

### Caso 1: Crear una sola agenda
- **Input:** Crear agenda para Dr. Juan Pérez, Cardiología, Sede Principal
- **Output esperado:**
  ```
  ✅ Agenda creada exitosamente
  📋 Doctor: Dr. Juan Pérez
  🏥 Especialidad: Cardiología
  📍 Sede: Sede Principal
  ```

### Caso 2: Crear múltiples agendas
- **Input:** Crear 5 agendas para Dra. María González, Pediatría, Zona de Socorro
- **Output esperado:**
  ```
  ✅ 5 agendas creadas exitosamente
  📋 Doctor: Dra. María González
  🏥 Especialidad: Pediatría
  📍 Sede: Zona de Socorro
  ```

## Archivos Modificados

- ✅ `/frontend/src/hooks/useAppointmentData.ts` - Función `addAvailability` refactorizada

## Despliegue

- ✅ Frontend compilado exitosamente
- ✅ Cambios listos para producción

## Notas Técnicas

- El contador `created_count` viene desde la respuesta del backend
- Como fallback, se usa la cantidad de fechas seleccionadas si `created_count` no está disponible
- Los nombres se obtienen desde los Maps de catálogos ya cargados (doctorById, specialtyById, locationById)
- El mensaje mantiene compatibilidad con la creación de una sola agenda o múltiples
