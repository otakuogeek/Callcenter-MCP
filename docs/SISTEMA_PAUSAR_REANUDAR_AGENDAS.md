# Sistema de Pausar/Reanudar Agendas - Documentación

## 🎯 Resumen

Se ha implementado un sistema completo para **pausar y reanudar agendas médicas**, permitiendo a los administradores bloquear temporalmente todos los cupos disponibles de una agenda sin necesidad de cancelarla.

---

## ✨ Características Principales

### **1. Pausar Agenda**
- Bloquea **todos los cupos disponibles** creando citas "fantasma" con estado `Pausada`
- Las citas fantasma **no tienen paciente asignado** (`patient_id = NULL`)
- Los cupos quedan **completamente bloqueados** y no se pueden agendar
- La agenda cambia automáticamente a estado `Completa`
- El campo `is_paused = TRUE` marca la agenda como pausada

### **2. Reanudar Agenda**
- **Elimina todas las citas fantasma** (estado `Pausada`)
- **Libera los cupos** y los hace disponibles nuevamente
- Actualiza `booked_slots` restando las citas eliminadas
- Recalcula el estado de la agenda (`Activa` o `Completa`)
- El campo `is_paused = FALSE` marca la agenda como activa

### **3. Interfaz de Usuario**
- **Botón dinámico** que muestra:
  - "⏸️ Pausar" cuando la agenda está activa
  - "▶️ Reanudar" cuando la agenda está pausada
- Ubicado junto al botón **"Registrar Cita"** en el banner verde
- Estilos visuales diferentes:
  - **Naranja** para "Pausar"
  - **Azul** para "Reanudar"

---

## 🗄️ Cambios en Base de Datos

### **1. Nueva Columna en `availabilities`**

```sql
ALTER TABLE availabilities 
ADD COLUMN is_paused BOOLEAN DEFAULT FALSE 
AFTER status;

ALTER TABLE availabilities 
ADD INDEX idx_is_paused (is_paused);
```

**Descripción:**
- `is_paused`: Indica si la agenda está pausada (TRUE) o activa (FALSE)
- Índice agregado para búsquedas rápidas

### **2. Nuevo Estado en `appointments.status`**

```sql
ALTER TABLE appointments 
MODIFY COLUMN status ENUM('Pendiente','Confirmada','Completada','Cancelada','Pausada') 
DEFAULT 'Pendiente';
```

**Descripción:**
- Se agregó el estado `Pausada` para identificar las citas fantasma
- Estas citas tienen `patient_id = NULL` y `reason = 'AGENDA PAUSADA - Cupo bloqueado temporalmente'`

---

## 🔧 Backend (API)

### **Endpoint: POST `/api/availabilities/:id/toggle-pause`**

**Autenticación:** Requerida (Bearer Token)

**Parámetros:**
- `id` (path parameter): ID de la agenda a pausar/reanudar

**Respuesta Exitosa (Pausar):**
```json
{
  "success": true,
  "action": "paused",
  "message": "Agenda pausada. Se bloquearon 8 cupos.",
  "data": {
    "availability_id": 123,
    "doctor_name": "Dr. Juan Pérez",
    "specialty_name": "Medicina General",
    "location_name": "Sede Principal",
    "date": "2025-10-28",
    "time_range": "08:00 - 12:00",
    "previous_booked_slots": 2,
    "current_booked_slots": 10,
    "available_slots": 0,
    "capacity": 10,
    "status": "Completa",
    "is_paused": true,
    "slots_blocked": 8
  }
}
```

**Respuesta Exitosa (Reanudar):**
```json
{
  "success": true,
  "action": "resumed",
  "message": "Agenda reanudada. Se liberaron 8 cupos.",
  "data": {
    "availability_id": 123,
    "doctor_name": "Dr. Juan Pérez",
    "specialty_name": "Medicina General",
    "location_name": "Sede Principal",
    "date": "2025-10-28",
    "time_range": "08:00 - 12:00",
    "previous_booked_slots": 10,
    "current_booked_slots": 2,
    "available_slots": 8,
    "capacity": 10,
    "status": "Activa",
    "is_paused": false,
    "slots_freed": 8
  }
}
```

**Errores Posibles:**
- `400`: ID de agenda inválido
- `404`: Agenda no encontrada
- `400`: No hay cupos disponibles para pausar (agenda ya completa)
- `500`: Error interno del servidor

---

## 💻 Frontend

### **1. Actualización de Interfaz `Availability`**

**Archivo:** `/frontend/src/hooks/useAppointmentData.ts`

```typescript
export interface Availability {
  id: number;
  locationId: number;
  locationName: string;
  specialty: string;
  doctor: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedSlots: number;
  status: 'active' | 'cancelled' | 'completed';
  isPaused?: boolean; // 🔥 NUEVO
  notes?: string;
  createdAt: string;
}
```

### **2. Nueva Función en API Client**

**Archivo:** `/frontend/src/lib/api.ts`

```typescript
togglePauseAvailability: (id: number) =>
  request<ApiResponse<{ 
    action: 'paused' | 'resumed'; 
    slots_blocked?: number; 
    slots_freed?: number 
  }>>(`/availabilities/${id}/toggle-pause`, { 
    method: 'POST' 
  }),
```

### **3. Handler en `AvailabilityList.tsx`**

```typescript
const handleTogglePause = async (availability: Availability, e: React.MouseEvent) => {
  e.stopPropagation();
  
  try {
    const response = await api.togglePauseAvailability(availability.id);
    
    if (response.success) {
      const action = response.data?.action;
      const message = action === 'paused' 
        ? `Agenda pausada. Se bloquearon ${response.data?.slots_blocked} cupos.`
        : `Agenda reanudada. Se liberaron ${response.data?.slots_freed} cupos.`;
      
      toast({
        title: action === 'paused' ? "Agenda Pausada" : "Agenda Reanudada",
        description: message,
        variant: "default"
      });
      
      window.location.reload();
    }
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "No se pudo pausar/reanudar la agenda",
      variant: "destructive"
    });
  }
};
```

### **4. Botón en UI**

**Ubicación:** Banner verde de "¡Cupos Disponibles!" en cada card de agenda activa

```tsx
<Button
  size="lg"
  variant={availability.isPaused ? "default" : "secondary"}
  className={availability.isPaused 
    ? "bg-white text-blue-600 hover:bg-blue-50 ..."
    : "bg-white text-orange-600 hover:bg-orange-50 ..."
  }
  onClick={(e) => handleTogglePause(availability, e)}
  title={availability.isPaused 
    ? "Reanudar agenda y liberar cupos" 
    : "Pausar agenda y bloquear cupos"
  }
>
  {availability.isPaused ? (
    <>
      <Play className="w-5 h-5 mr-2" />
      Reanudar
    </>
  ) : (
    <>
      <Pause className="w-5 h-5 mr-2" />
      Pausar
    </>
  )}
</Button>
```

---

## 🎬 Flujo de Uso

### **Escenario 1: Pausar una Agenda**

**Situación:**  
El doctor informa que tiene una emergencia y no podrá atender su agenda del día.

**Pasos:**

1. Administrador ingresa a la página de **Citas** (`/appointments`)
2. Selecciona la fecha de la agenda afectada
3. Localiza la agenda del doctor (aparece con banner verde si tiene cupos)
4. Hace clic en el botón **"⏸️ Pausar"** junto a "Registrar Cita"
5. El sistema:
   - Crea citas fantasma para todos los cupos disponibles
   - Marca la agenda como `is_paused = TRUE`
   - Cambia el estado a `Completa`
   - Actualiza `booked_slots` sumando los cupos bloqueados
6. Se muestra un toast: "Agenda pausada. Se bloquearon X cupos."
7. La página se recarga automáticamente
8. El botón ahora muestra **"▶️ Reanudar"** en azul

**Resultado:**
- Ningún paciente puede agendar en esa agenda
- Los cupos están completamente bloqueados
- El sistema de colas no asignará citas a esta agenda

---

### **Escenario 2: Reanudar una Agenda**

**Situación:**  
La emergencia se resolvió y el doctor ya puede atender su agenda.

**Pasos:**

1. Administrador ingresa a la página de **Citas** (`/appointments`)
2. Selecciona la fecha de la agenda pausada
3. Localiza la agenda (ahora con botón azul "▶️ Reanudar")
4. Hace clic en el botón **"▶️ Reanudar"**
5. El sistema:
   - Elimina todas las citas fantasma (estado `Pausada`)
   - Marca la agenda como `is_paused = FALSE`
   - Recalcula el estado (`Activa` o `Completa`)
   - Actualiza `booked_slots` restando los cupos liberados
6. Se muestra un toast: "Agenda reanudada. Se liberaron X cupos."
7. La página se recarga automáticamente
8. El botón vuelve a mostrar **"⏸️ Pausar"** en naranja
9. Los cupos están disponibles nuevamente

**Resultado:**
- Los pacientes pueden volver a agendar en esta agenda
- El sistema de colas puede asignar citas
- La agenda funciona con normalidad

---

## 🔍 Validaciones Implementadas

### **En el Backend:**

1. **Validación de ID:**
   - Verifica que el `availability_id` sea un número válido
   
2. **Existencia de Agenda:**
   - Valida que la agenda existe en la base de datos
   
3. **Cupos Disponibles (al pausar):**
   - No permite pausar si no hay cupos disponibles
   - Error: "No hay cupos disponibles para pausar. La agenda ya está completa."

4. **Transacciones Atómicas:**
   - Todas las operaciones se realizan en una transacción
   - Si falla algo, se hace rollback completo

5. **Recálculo Automático:**
   - El sistema recalcula `booked_slots` y `status` después de cada operación

### **En el Frontend:**

1. **Muestra el estado correcto:**
   - El botón refleja el estado actual de la agenda

2. **Feedback inmediato:**
   - Toast notifications con mensajes claros
   
3. **Recarga automática:**
   - La página se recarga para mostrar los cambios

---

## 📊 Estructura de Datos

### **Cita Fantasma (Pausada)**

```sql
INSERT INTO appointments (
  patient_id,           -- NULL (sin paciente)
  availability_id,      -- ID de la agenda
  location_id,          -- Sede de la agenda
  specialty_id,         -- Especialidad de la agenda
  doctor_id,            -- Doctor de la agenda
  scheduled_at,         -- Fecha y hora de la agenda
  duration_minutes,     -- 30 (por defecto)
  appointment_type,     -- 'Presencial'
  status,               -- 'Pausada' ⭐
  reason,               -- 'AGENDA PAUSADA - Cupo bloqueado temporalmente'
  notes,                -- 'Cita fantasma creada por pausa de agenda'
  created_by_user_id    -- ID del usuario que pausó
) VALUES (...);
```

### **Consulta para Ver Agendas Pausadas**

```sql
SELECT 
  a.id,
  a.date,
  a.start_time,
  a.end_time,
  a.is_paused,
  a.status,
  d.name AS doctor_name,
  s.name AS specialty_name,
  l.name AS location_name,
  a.capacity,
  a.booked_slots,
  (a.capacity - a.booked_slots) AS available_slots
FROM availabilities a
LEFT JOIN doctors d ON a.doctor_id = d.id
LEFT JOIN specialties s ON a.specialty_id = s.id
LEFT JOIN locations l ON a.location_id = l.id
WHERE a.is_paused = TRUE
ORDER BY a.date, a.start_time;
```

### **Consulta para Ver Citas Pausadas**

```sql
SELECT 
  ap.id,
  ap.availability_id,
  ap.scheduled_at,
  ap.status,
  ap.reason,
  d.name AS doctor_name,
  s.name AS specialty_name
FROM appointments ap
LEFT JOIN availabilities av ON ap.availability_id = av.id
LEFT JOIN doctors d ON av.doctor_id = d.id
LEFT JOIN specialties s ON av.specialty_id = s.id
WHERE ap.status = 'Pausada'
ORDER BY ap.scheduled_at;
```

---

## 🚀 Ventajas del Sistema

### **1. No Requiere Cancelar la Agenda**
- La agenda permanece activa pero pausada temporalmente
- Se preservan todas las citas reales ya agendadas

### **2. Bloqueo Completo de Cupos**
- Los cupos quedan **completamente bloqueados**
- Ningún sistema (manual, automático, voice agent) puede asignar citas

### **3. Reversible**
- Se puede reanudar en cualquier momento
- Los cupos se liberan automáticamente

### **4. Auditable**
- Las citas pausadas quedan registradas con:
  - Fecha de creación
  - Usuario que pausó (`created_by_user_id`)
  - Motivo claro en el campo `reason`

### **5. Sin Pérdida de Datos**
- Las citas reales permanecen intactas
- Solo se eliminan las citas fantasma al reanudar

---

## 📈 Casos de Uso

### **1. Emergencias Médicas**
- El doctor tiene una emergencia y no puede atender
- Se pausa la agenda inmediatamente
- Los pacientes no pueden agendar

### **2. Mantenimiento de Infraestructura**
- La sede debe cerrar por mantenimiento
- Se pausan todas las agendas de ese día
- Los pacientes no pueden agendar en esa sede

### **3. Ausencias Temporales**
- El doctor sale de vacaciones
- Se pausan todas sus agendas durante el período
- Se reanudan al regreso

### **4. Reorganización de Horarios**
- Se necesita redistribuir cupos entre doctores
- Se pausan las agendas afectadas
- Se reanudan después de hacer los cambios

---

## 🔐 Seguridad

### **1. Autenticación Requerida**
- Solo usuarios autenticados pueden pausar/reanudar
- JWT token validado en cada request

### **2. Transacciones Atómicas**
- Rollback automático si algo falla
- No hay estados inconsistentes

### **3. Validación de Permisos**
- Solo administradores deberían tener acceso
- (Se puede agregar validación de rol si es necesario)

---

## 📝 Notas Importantes

### **1. Citas Reales No Se Afectan**
- Las citas con pacientes reales permanecen intactas
- Solo se bloquean/liberan los cupos **disponibles**

### **2. Estado de la Agenda**
- Al pausar: `status = 'Completa'` (porque todos los cupos están ocupados)
- Al reanudar: Se recalcula automáticamente

### **3. Compatibilidad con Sistema de Colas**
- Las agendas pausadas no aparecen en las búsquedas de cupos disponibles
- El sistema de colas no las considerará para asignación

---

## ✅ Checklist de Implementación

- ✅ Campo `is_paused` agregado a tabla `availabilities`
- ✅ Estado `Pausada` agregado a `appointments.status`
- ✅ Endpoint `/api/availabilities/:id/toggle-pause` implementado
- ✅ Validaciones de backend implementadas
- ✅ Interfaz `Availability` actualizada en frontend
- ✅ Función `togglePauseAvailability` en API client
- ✅ Handler `handleTogglePause` implementado
- ✅ Botón "Pausar/Reanudar" agregado a UI
- ✅ Estilos visuales implementados
- ✅ Toast notifications implementadas
- ✅ Backend compilado y desplegado
- ✅ Frontend compilado exitosamente
- ✅ Documentación completa

---

## 🎓 Conclusión

El sistema de **Pausar/Reanudar Agendas** está completamente implementado y listo para usar. Proporciona una forma eficiente y segura de **bloquear temporalmente cupos** sin necesidad de cancelar agendas, manteniendo la integridad de las citas reales y permitiendo una **gestión flexible** de la disponibilidad médica.

**El sistema es profesional, seguro y fácil de usar.** ⏸️▶️✨

---

**Documentado por:** GitHub Copilot Assistant  
**Fecha:** Octubre 27, 2025  
**Versión:** 1.0.0 - Sistema de Pausar/Reanudar Agendas
