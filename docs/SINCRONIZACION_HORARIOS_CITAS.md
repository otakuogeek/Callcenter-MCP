# ⏰ Sincronización de Horarios de Citas

## 🎯 Funcionalidad Implementada

Se agregó un **botón "Sincronizar Horas"** en el modal de agenda que reorganiza automáticamente las horas de todas las citas de esa agenda de manera secuencial.

---

## ✨ ¿Qué Hace?

El botón toma todas las citas confirmadas y pendientes de una agenda y las reorganiza secuencialmente siguiendo estas reglas:

1. **Inicia** en el `start_time` de la disponibilidad
2. **Incrementa** según el `duration_minutes` configurado
3. **Suma** el `break_between_slots` (descanso entre citas) si existe
4. **Respeta** el `end_time` de la disponibilidad (no asigna citas fuera del horario)

---

## 📊 Ejemplo Visual

### Antes de Sincronizar (Horarios Desordenados)

```
Agenda: 21 de octubre 2025
Horario: 08:00 - 12:00
Duración por cita: 15 minutos
Descanso: 0 minutos

Citas actuales (desordenadas):
❌ Paciente 1: 09:00
❌ Paciente 2: 08:15
❌ Paciente 3: 10:30
❌ Paciente 4: 08:00
❌ Paciente 5: 11:00
```

### Después de Sincronizar (Horarios Secuenciales)

```
Citas reorganizadas:
✅ Paciente 4: 08:00  ← Primera cita
✅ Paciente 2: 08:15  ← +15 min
✅ Paciente 1: 08:30  ← +15 min
✅ Paciente 3: 08:45  ← +15 min
✅ Paciente 5: 09:00  ← +15 min
```

---

## 🎨 Ubicación del Botón

### En el Modal de Agenda

```
┌────────────────────────────────────────────────────────┐
│ Detalles de la Disponibilidad                    [X]  │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Doctor: Dr. Luis Fernanda Garrido                      │
│ Especialidad: Medicina General                         │
│ Fecha: lunes, 21 de octubre de 2025                    │
│ Horario: 08:00 - 12:00                                 │
│                                                         │
│ [Pestañas: Confirmados | Cancelados]                   │
│                                                         │
│ Lista de pacientes...                                  │
│                                                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│        [⏰ Sincronizar Horas]      [Cerrar]           │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Sincronización

### Proceso Paso a Paso

```
1. Usuario hace clic en "Sincronizar Horas"
       ↓
2. Sistema muestra confirmación:
   "¿Reorganizar todas las citas de esta agenda 
    de manera secuencial?"
       ↓
3. Usuario confirma
       ↓
4. Backend procesa:
   - Obtiene todas las citas (Confirmadas + Pendientes)
   - Las ordena por hora actual
   - Recalcula horarios desde start_time
   - Actualiza cada cita en la BD
       ↓
5. Frontend muestra resultado:
   "✅ 5 citas sincronizadas correctamente"
       ↓
6. Modal se recarga automáticamente
       ↓
7. Usuario ve las citas reorganizadas
```

---

## 💻 Implementación Técnica

### 1. Endpoint del Backend

**Ruta:** `POST /api/availabilities/:id/sync-appointment-times`

**Parámetros:**
- `id` (path): ID de la availability

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "5 citas sincronizadas correctamente",
  "updated": 5,
  "total": 5,
  "updates": [
    {
      "id": 123,
      "patient_name": "Carlos Velázquez",
      "old_time": "2025-10-21 09:00:00",
      "new_time": "2025-10-21 08:00:00"
    },
    ...
  ],
  "availability": {
    "id": 152,
    "doctor": "Dra. Luis Fernanda Garrido",
    "specialty": "Medicina General",
    "location": "Sede Principal",
    "date": "2025-10-21",
    "start_time": "08:00:00",
    "end_time": "12:00:00",
    "duration_minutes": 15,
    "break_between_slots": 0
  }
}
```

### 2. Método del API Cliente (Frontend)

```typescript
// En /frontend/src/lib/api.ts
syncAppointmentTimes: (availabilityId: number) =>
  fetch(`${BASE_URL}/availabilities/${availabilityId}/sync-appointment-times`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
  }).then(handleResponse),
```

### 3. Handler en el Componente

```typescript
const handleSyncAppointmentTimes = async () => {
  if (!availability) return;
  
  const confirm = window.confirm(
    '¿Está seguro de que desea reorganizar todas las citas de esta agenda ' +
    'de manera secuencial?\n\n' +
    'Las horas de las citas se ajustarán automáticamente comenzando desde ' +
    `${availability.startTime}.`
  );
  
  if (!confirm) return;
  
  setSyncing(true);
  
  try {
    const result = await api.syncAppointmentTimes(availability.id);
    
    toast({
      title: "Horarios sincronizados",
      description: `${result.updated} citas reorganizadas correctamente`,
      variant: "default",
    });
    
    // Recargar las citas para ver los cambios
    await loadAppointments();
    
  } catch (e: any) {
    toast({
      title: "Error al sincronizar",
      description: e?.message || "No se pudieron sincronizar los horarios",
      variant: "destructive",
    });
  } finally {
    setSyncing(false);
  }
};
```

---

## 🎨 Diseño del Botón

### Código del Botón

```tsx
<Button
  variant="outline"
  onClick={handleSyncAppointmentTimes}
  disabled={syncing || loading}
  className="flex items-center gap-2"
>
  {syncing ? (
    <>
      <Clock className="w-4 h-4 animate-spin" />
      <span>Sincronizando...</span>
    </>
  ) : (
    <>
      <Clock className="w-4 h-4" />
      <span>Sincronizar Horas</span>
    </>
  )}
</Button>
```

**Características:**
- ✅ Icono de reloj (Clock de lucide-react)
- ✅ Estado de carga con animación
- ✅ Deshabilitado durante sincronización
- ✅ Variant "outline" (borde sin relleno)

---

## 📋 Lógica de Sincronización (Backend)

### Algoritmo

```typescript
// 1. Obtener availability
const availability = await getAvailability(availabilityId);

// 2. Obtener citas confirmadas y pendientes
const appointments = await getAppointments({
  availability_id: availabilityId,
  status: ['Confirmada', 'Pendiente']
});

// 3. Ordenar por hora actual
appointments.sort((a, b) => a.scheduled_at - b.scheduled_at);

// 4. Calcular hora de inicio
const startTime = `${availability.date}T${availability.start_time}`;
let currentTime = new Date(startTime);

// 5. Reorganizar cada cita
for (const appointment of appointments) {
  // Verificar que no exceda el end_time
  if (currentTime >= endTime) {
    console.log('⚠️ Cita excede horario de fin');
    break;
  }
  
  // Actualizar scheduled_at
  await updateAppointment(appointment.id, {
    scheduled_at: currentTime
  });
  
  // Calcular siguiente hora
  const totalMinutes = 
    availability.duration_minutes + 
    (availability.break_between_slots || 0);
  
  currentTime.setMinutes(currentTime.getMinutes() + totalMinutes);
}
```

---

## 🔍 Validaciones

### En el Backend

1. ✅ **ID válido**: Verifica que el ID de availability sea un número
2. ✅ **Availability existe**: Verifica que la agenda exista en la BD
3. ✅ **Hay citas**: Verifica que haya citas para sincronizar
4. ✅ **Fecha válida**: Verifica que la fecha/hora sean válidas
5. ✅ **Respeta end_time**: No asigna citas fuera del horario
6. ✅ **Transacción**: Usa transacción para rollback en caso de error

### En el Frontend

1. ✅ **Confirmación**: Pide confirmación antes de ejecutar
2. ✅ **Estado de carga**: Deshabilita botón durante proceso
3. ✅ **Manejo de errores**: Muestra toast con mensaje de error
4. ✅ **Recarga automática**: Actualiza la lista después de sincronizar

---

## 📊 Casos de Uso

### Caso 1: Agenda con Citas Desordenadas

**Estado inicial:**
```
Agenda: 21 oct 2025, 08:00-12:00
Duración: 15 min
Descanso: 0 min

Citas:
- Paciente A: 10:00
- Paciente B: 08:30
- Paciente C: 09:15
- Paciente D: 08:00
- Paciente E: 11:30
```

**Después de sincronizar:**
```
Citas reorganizadas:
- Paciente D: 08:00  ← Empieza desde start_time
- Paciente B: 08:15  ← +15 min
- Paciente C: 08:30  ← +15 min
- Paciente A: 08:45  ← +15 min
- Paciente E: 09:00  ← +15 min
```

### Caso 2: Con Descanso Entre Citas

**Configuración:**
```
Agenda: 21 oct 2025, 08:00-12:00
Duración: 15 min
Descanso: 5 min  ← DESCANSO ACTIVO

Total por cita: 15 + 5 = 20 minutos
```

**Resultado:**
```
- Paciente 1: 08:00
- Paciente 2: 08:20  ← +15 min cita + 5 min descanso
- Paciente 3: 08:40  ← +20 min
- Paciente 4: 09:00  ← +20 min
- Paciente 5: 09:20  ← +20 min
```

### Caso 3: Citas Exceden Horario

**Configuración:**
```
Agenda: 08:00-09:00 (1 hora)
Duración: 15 min
Citas: 6 (necesitan 90 minutos)
```

**Resultado:**
```
✅ Cita 1: 08:00
✅ Cita 2: 08:15
✅ Cita 3: 08:30
✅ Cita 4: 08:45
❌ Cita 5: NO ASIGNADA (excede 09:00)
❌ Cita 6: NO ASIGNADA (excede 09:00)

Mensaje: "4 citas sincronizadas correctamente"
Log: "⚠️ Cita 5 excede el horario de fin"
```

### Caso 4: Sin Citas para Sincronizar

**Estado:**
```
Agenda: 21 oct 2025
Citas: 0
```

**Resultado:**
```
Mensaje: "No hay citas para sincronizar"
updated: 0
total: 0
```

---

## 🎓 Para Administrativos

### ¿Cuándo Usar Este Botón?

**Usa "Sincronizar Horas" cuando:**

1. ✅ **Citas desordenadas**: Las horas están mezcladas (ej: 10:00, 08:00, 09:00)
2. ✅ **Espacios vacíos**: Hay huecos entre citas que quieres eliminar
3. ✅ **Reorganización**: Quieres empezar desde el inicio de la agenda
4. ✅ **Migración de datos**: Después de importar citas de otro sistema
5. ✅ **Cambio de duración**: Después de modificar `duration_minutes`

**NO uses este botón si:**

1. ❌ Las citas ya están ordenadas correctamente
2. ❌ Tienes horarios específicos que no quieres cambiar
3. ❌ Los pacientes ya fueron notificados de sus horarios actuales

### ¿Qué Pasa con los Pacientes?

**⚠️ IMPORTANTE:**

- Las horas de las citas **CAMBIARÁN**
- Los pacientes **NO son notificados automáticamente**
- Debes **comunicar los nuevos horarios** a los pacientes
- Considera usar este botón **ANTES** de confirmar citas con pacientes

---

## 🔔 Notificaciones

### Toast de Éxito

```
✅ Horarios sincronizados
5 citas reorganizadas correctamente
```

### Toast de Error

```
❌ Error al sincronizar
No se pudieron sincronizar los horarios
[Detalles del error]
```

### Confirmación Previa

```
¿Está seguro de que desea reorganizar todas las 
citas de esta agenda de manera secuencial?

Las horas de las citas se ajustarán automáticamente 
comenzando desde 08:00.

[Cancelar]  [Aceptar]
```

---

## 🛡️ Seguridad y Transacciones

### Transacción de Base de Datos

```typescript
try {
  await connection.beginTransaction();
  
  // Actualizar todas las citas
  for (const appointment of appointments) {
    await updateAppointment(appointment);
  }
  
  await connection.commit();
  // ✅ Todos los cambios se guardan
  
} catch (error) {
  await connection.rollback();
  // ❌ Si falla, NO se guarda NADA
}
```

**Beneficios:**
- ✅ Todo o nada (atomicidad)
- ✅ Si falla 1 cita, se revierten TODAS
- ✅ No deja la BD en estado inconsistente

---

## 📊 Respuesta Detallada del API

### Ejemplo Completo

```json
{
  "success": true,
  "message": "5 citas sincronizadas correctamente",
  "updated": 5,
  "total": 5,
  "updates": [
    {
      "id": 123,
      "patient_name": "Carlos Augusto Velázquez",
      "old_time": "2025-10-21 10:00:00",
      "new_time": "2025-10-21 08:00:00"
    },
    {
      "id": 124,
      "patient_name": "José Joaquín Velasque",
      "old_time": "2025-10-21 08:30:00",
      "new_time": "2025-10-21 08:15:00"
    },
    {
      "id": 125,
      "patient_name": "Blay Celis Reda",
      "old_time": "2025-10-21 09:15:00",
      "new_time": "2025-10-21 08:30:00"
    },
    {
      "id": 126,
      "patient_name": "José PH",
      "old_time": "2025-10-21 08:00:00",
      "new_time": "2025-10-21 08:45:00"
    },
    {
      "id": 127,
      "patient_name": "Marta Pimiento",
      "old_time": "2025-10-21 11:30:00",
      "new_time": "2025-10-21 09:00:00"
    }
  ],
  "availability": {
    "id": 152,
    "doctor": "Dra. Luis Fernanda Garrido Castillo",
    "specialty": "Medicina General",
    "location": "Sede Principal",
    "date": "2025-10-21",
    "start_time": "08:00:00",
    "end_time": "12:00:00",
    "duration_minutes": 15,
    "break_between_slots": 0
  }
}
```

---

## 🔧 Archivos Modificados

### Backend

**`/backend/src/routes/availabilities.ts`** (línea 1529-1691)

- Nueva ruta: `POST /:id/sync-appointment-times`
- Lógica de sincronización secuencial
- Validaciones y manejo de errores
- Respuesta detallada con cambios

### Frontend

**`/frontend/src/lib/api.ts`**

- Nuevo método: `syncAppointmentTimes(availabilityId)`

**`/frontend/src/components/ViewAvailabilityModal.tsx`**

- Nuevo estado: `syncing`
- Nuevo handler: `handleSyncAppointmentTimes`
- Nuevo botón: "Sincronizar Horas"
- Confirmación previa
- Toast notifications

---

## ✅ Testing

- ✅ Compilación backend exitosa
- ✅ Compilación frontend exitosa
- ✅ Backend reiniciado con PM2
- ✅ Ruta registrada correctamente
- ✅ Botón visible en modal
- ✅ Confirmación funciona
- ✅ Sincronización ejecuta correctamente
- ✅ Toast notifications funcionan
- ✅ Recarga automática después de sincronizar
- ✅ Listo para producción

---

**Estado**: ✅ COMPLETADO  
**Fecha**: Octubre 20, 2025  
**Versión**: 8.0  
**Sistema**: Biosanarcall - Sincronización de Horarios  
**Mejora**: Reorganización Automática de Citas
