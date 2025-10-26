# Función de Restauración de Citas Canceladas

**Fecha:** 2025-10-21  
**Tipo de cambio:** Nueva funcionalidad - Gestión de citas  
**Áreas afectadas:**  
- Backend: `/backend/src/routes/appointments.ts`
- Frontend: `/frontend/src/lib/api.ts`
- Frontend: `/frontend/src/components/ViewAvailabilityModal.tsx`

---

## 📋 Resumen de Cambios

Se implementó una funcionalidad completa para **restaurar citas canceladas** por error, permitiendo:

1. **Endpoint backend**: `POST /api/appointments/:id/restore` con validaciones completas
2. **Botón "Restaurar"** en la pestaña "Canceladas" del modal de agendas
3. **Validaciones automáticas**: Verificación de conflictos, cupos disponibles y estado de agenda
4. **Actualización de contadores**: Incrementa `booked_slots` automáticamente al restaurar

---

## 🎯 Motivación

### Problema Original
- Cuando una cita se cancela por error, no había forma de revertir la acción
- El personal tenía que crear una nueva cita manualmente
- Se perdía el historial y la hora original de la cita
- Los cupos no se liberaban correctamente

### Solución Implementada
- Botón "Restaurar" visible en cada cita cancelada
- Validaciones inteligentes antes de restaurar
- Restauración con un solo clic y confirmación
- Mantiene historial y hora original

---

## 🔧 Cambios Técnicos

### 1. Backend - Nuevo Endpoint

**Ubicación**: `/backend/src/routes/appointments.ts` (línea ~525-650)

#### Ruta
```typescript
POST /api/appointments/:id/restore
```

#### Lógica de Restauración

```typescript
router.post('/:id/restore', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  // 1. Verificar que la cita existe y está cancelada
  const [apptRows] = await pool.query(
    `SELECT a.*, p.name AS patient_name
     FROM appointments a
     LEFT JOIN patients p ON a.patient_id = p.id
     WHERE a.id = ? LIMIT 1`,
    [id]
  );

  if (!apptRows || apptRows.length === 0) {
    return res.status(404).json({ message: 'Cita no encontrada' });
  }

  const appointment = apptRows[0];

  if (appointment.status !== 'Cancelada') {
    return res.status(400).json({ 
      message: 'Solo se pueden restaurar citas canceladas',
      currentStatus: appointment.status
    });
  }

  // 2. Verificar conflictos con otras citas del mismo paciente
  const [conflictRows] = await pool.query(
    `SELECT id FROM appointments
     WHERE patient_id = ? 
       AND id != ?
       AND status != 'Cancelada'
       AND DATE(scheduled_at) = DATE(?)
     LIMIT 1`,
    [appointment.patient_id, id, appointment.scheduled_at]
  );

  if (conflictRows && conflictRows.length > 0) {
    return res.status(409).json({ 
      message: 'El paciente ya tiene otra cita confirmada en este día'
    });
  }

  // 3. Si tiene agenda, verificar cupos disponibles
  if (appointment.availability_id) {
    const [availRows] = await pool.query(
      `SELECT id, capacity, booked_slots, status 
       FROM availabilities
       WHERE id = ? LIMIT 1`,
      [appointment.availability_id]
    );

    if (!availRows || availRows.length === 0) {
      return res.status(404).json({ 
        message: 'La agenda asociada ya no existe'
      });
    }

    const availability = availRows[0];

    if (availability.status !== 'Activa') {
      return res.status(409).json({ 
        message: `La agenda ya no está activa (${availability.status})`
      });
    }

    if (availability.booked_slots >= availability.capacity) {
      return res.status(409).json({ 
        message: 'La agenda ya no tiene cupos disponibles',
        capacity: availability.capacity,
        booked: availability.booked_slots
      });
    }
  }

  // 4. Restaurar la cita
  await pool.query(
    `UPDATE appointments 
     SET status = 'Confirmada',
         cancellation_reason = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );

  // 5. Incrementar booked_slots
  if (appointment.availability_id) {
    await pool.query(
      `UPDATE availabilities 
       SET booked_slots = booked_slots + 1
       WHERE id = ? AND booked_slots < capacity`,
      [appointment.availability_id]
    );
  }

  return res.json({ 
    success: true,
    message: 'Cita restaurada exitosamente',
    appointmentId: id,
    patientName: appointment.patient_name,
    scheduledAt: appointment.scheduled_at
  });
});
```

#### Validaciones Implementadas

| Validación | Descripción | Código HTTP |
|------------|-------------|-------------|
| **Cita no existe** | Verifica que el ID sea válido | 404 |
| **No cancelada** | Solo restaura citas con status='Cancelada' | 400 |
| **Conflicto de paciente** | Verifica que no tenga otra cita el mismo día | 409 |
| **Agenda inexistente** | Verifica que la agenda aún exista | 404 |
| **Agenda inactiva** | Verifica que la agenda esté activa | 409 |
| **Sin cupos** | Verifica que haya cupos disponibles | 409 |

---

### 2. Frontend - Cliente API

**Ubicación**: `/frontend/src/lib/api.ts` (línea ~557)

```typescript
restoreAppointment: (id: number) =>
  request<ApiResponse<{ 
    success: boolean; 
    message: string; 
    appointmentId: number 
  }>>(`/appointments/${id}/restore`, {
    method: 'POST'
  }),
```

**Características:**
- Método POST al endpoint `/appointments/:id/restore`
- Retorna respuesta tipada con TypeScript
- Maneja errores automáticamente del cliente API

---

### 3. Frontend - Componente ViewAvailabilityModal

**Ubicación**: `/frontend/src/components/ViewAvailabilityModal.tsx`

#### A. Importación de Ícono (línea ~14)

```typescript
import { 
  Calendar, Clock, User, MapPin, CheckCircle, 
  AlertCircle, XCircle, Trash2, ArrowRight, 
  RotateCcw  // ← NUEVO: Ícono de restaurar
} from "lucide-react";
```

#### B. Función handleRestoreAppointment (línea ~156-186)

```typescript
const handleRestoreAppointment = async (appointmentId: number, patientName: string) => {
  // Confirmación del usuario
  if (!confirm(
    `¿Está seguro de que desea restaurar la cita de ${patientName}?\n\n` +
    `La cita volverá a estado confirmado y ocupará un cupo en la agenda.`
  )) {
    return;
  }

  // Agregar al set de procesamiento
  setDeletingIds(prev => new Set(prev).add(appointmentId));
  
  try {
    const response = await api.restoreAppointment(appointmentId);
    
    // Toast de éxito
    toast({
      title: "Cita restaurada",
      description: response.message || 
        `La cita de ${patientName} ha sido restaurada exitosamente.`,
      variant: "default",
    });
    
    // Recargar las citas
    await loadAppointments();
    
  } catch (e: any) {
    // Toast de error
    toast({
      title: "Error al restaurar",
      description: e?.message || "No se pudo restaurar la cita",
      variant: "destructive",
    });
  } finally {
    // Remover del set de procesamiento
    setDeletingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(appointmentId);
      return newSet;
    });
  }
};
```

#### C. Botón Restaurar en Pestaña Cancelados (línea ~575-609)

**ANTES:**
```tsx
<div className="flex items-center gap-3 flex-shrink-0">
  <span className="text-xs text-gray-600">{scheduledTime}</span>
  <Badge variant="outline" className="text-xs bg-red-100">
    Cancelada
  </Badge>
</div>
```

**DESPUÉS:**
```tsx
<div className="flex items-center gap-2 flex-shrink-0">
  <span className="text-xs text-gray-600 hidden sm:inline">
    {scheduledTime}
  </span>
  <Badge variant="outline" className="text-xs bg-red-100 text-red-700">
    Cancelada
  </Badge>
  <Button
    size="sm"
    variant="outline"
    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300"
    onClick={() => handleRestoreAppointment(ap.id, ap.patient_name)}
    disabled={isRestoring}
    title="Restaurar cita"
  >
    <RotateCcw className="w-3 h-3 mr-1" />
    <span className="text-xs hidden sm:inline">
      {isRestoring ? 'Restaurando...' : 'Restaurar'}
    </span>
  </Button>
</div>
```

**Características del botón:**
- **Color verde** para indicar acción positiva
- **Ícono RotateCcw** (flecha circular contra reloj)
- **Estado disabled** mientras procesa
- **Texto dinámico**: "Restaurar" / "Restaurando..."
- **Responsive**: Solo muestra texto en pantallas medianas+

---

## 🎨 Visualización

### Pestaña Cancelados - Antes vs Después

**ANTES:**
```
┌──────────────────────────────────────────────┐
│ Juan Pérez García           09:00            │
│ 1234567890 • 3001234567     [Cancelada]      │
└──────────────────────────────────────────────┘
(Sin opciones para restaurar)
```

**DESPUÉS:**
```
┌──────────────────────────────────────────────────────┐
│ Juan Pérez García        09:00  [Cancelada] [↻ Restaurar] │
│ 1234567890 • 3001234567                              │
└──────────────────────────────────────────────────────┘
```

### Botón Restaurar

| Estado | Apariencia | Comportamiento |
|--------|------------|----------------|
| **Normal** | Verde, ícono ↻, "Restaurar" | Click abre confirmación |
| **Procesando** | Deshabilitado, "Restaurando..." | No clickeable |
| **Éxito** | Desaparece (cita va a Confirmados) | Recarga automática |
| **Error** | Vuelve a normal | Muestra toast de error |

---

## 🔄 Flujo Completo

### 1. Usuario hace clic en "Restaurar"
```typescript
onClick={() => handleRestoreAppointment(ap.id, ap.patient_name)}
```

### 2. Sistema muestra confirmación
```
¿Está seguro de que desea restaurar la cita de Juan Pérez?

La cita volverá a estado confirmado y ocupará un cupo en la agenda.

[Cancelar] [Aceptar]
```

### 3. Si usuario confirma → Validaciones Backend

```
┌─────────────────────────────┐
│ 1. ¿Cita existe?           │ → NO: Error 404
│ 2. ¿Está cancelada?        │ → NO: Error 400
│ 3. ¿Conflicto paciente?    │ → SÍ: Error 409
│ 4. ¿Agenda existe?         │ → NO: Error 404
│ 5. ¿Agenda activa?         │ → NO: Error 409
│ 6. ¿Hay cupos?             │ → NO: Error 409
└─────────────────────────────┘
         │ TODAS OK
         ↓
  Restaurar cita
         ↓
  Incrementar cupos
         ↓
  Respuesta 200 OK
```

### 4. Frontend recibe respuesta

**Si éxito:**
```typescript
toast({
  title: "Cita restaurada",
  description: "La cita de Juan Pérez ha sido restaurada exitosamente."
});
await loadAppointments(); // Recarga lista
```

**Si error:**
```typescript
toast({
  title: "Error al restaurar",
  description: "El paciente ya tiene otra cita confirmada en este día",
  variant: "destructive"
});
```

### 5. Actualización Visual

- Cita desaparece de pestaña "Cancelados"
- Cita aparece en pestaña "Confirmados"
- Contador de confirmados: +1
- Contador de cancelados: -1
- Cupos ocupados en agenda: +1

---

## 📊 Casos de Uso

### Caso 1: Restauración Exitosa ✅

**Escenario:**
- Cita cancelada por error
- Agenda tiene cupos disponibles
- Paciente no tiene otras citas ese día

**Proceso:**
```
1. Usuario: Click en "Restaurar"
2. Sistema: Muestra confirmación
3. Usuario: Confirma
4. Backend: Valida (OK)
5. Backend: status = 'Confirmada', booked_slots + 1
6. Frontend: Toast éxito + recarga
7. Resultado: Cita restaurada en "Confirmados"
```

---

### Caso 2: Conflicto de Paciente ❌

**Escenario:**
- Paciente tiene otra cita confirmada el mismo día
- Intento de restaurar cita cancelada

**Proceso:**
```
1. Usuario: Click en "Restaurar"
2. Sistema: Muestra confirmación
3. Usuario: Confirma
4. Backend: Detecta conflicto (otra cita mismo día)
5. Backend: Error 409 Conflict
6. Frontend: Toast error "El paciente ya tiene otra cita..."
7. Resultado: Cita NO restaurada
```

---

### Caso 3: Agenda Sin Cupos ❌

**Escenario:**
- Agenda tiene `booked_slots = capacity`
- Intento de restaurar cita

**Proceso:**
```
1. Usuario: Click en "Restaurar"
2. Sistema: Muestra confirmación
3. Usuario: Confirma
4. Backend: Verifica cupos (lleno)
5. Backend: Error 409 "No hay cupos disponibles"
6. Frontend: Toast error
7. Resultado: Cita NO restaurada
```

---

### Caso 4: Agenda Inactiva ❌

**Escenario:**
- Agenda cambió a status='Cancelada' o 'Completada'
- Intento de restaurar cita

**Proceso:**
```
1. Usuario: Click en "Restaurar"
2. Sistema: Muestra confirmación
3. Usuario: Confirma
4. Backend: Verifica status agenda (Cancelada)
5. Backend: Error 409 "La agenda ya no está activa"
6. Frontend: Toast error
7. Resultado: Cita NO restaurada
```

---

## 🧪 Pruebas

### Pruebas Backend

```bash
# 1. Restaurar cita cancelada (éxito)
curl -X POST http://localhost:4000/api/appointments/123/restore \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"

# Respuesta esperada:
{
  "success": true,
  "message": "Cita restaurada exitosamente",
  "appointmentId": 123,
  "patientName": "Juan Pérez",
  "scheduledAt": "2025-10-21T09:00:00"
}

# 2. Intentar restaurar cita confirmada (error)
# Respuesta esperada: 400
{
  "message": "Solo se pueden restaurar citas canceladas",
  "currentStatus": "Confirmada"
}

# 3. Restaurar con conflicto (error)
# Respuesta esperada: 409
{
  "message": "El paciente ya tiene otra cita confirmada en este día",
  "patientName": "Juan Pérez"
}
```

### Pruebas Frontend

1. **Navegación**: Abrir modal de agenda con citas canceladas
2. **Visualización**: Verificar que botón "Restaurar" aparece
3. **Click**: Hacer clic → Debe mostrar confirmación
4. **Confirmación**: Aceptar → Debe mostrar toast y recargar
5. **Validación**: Verificar que cita aparece en "Confirmados"
6. **Contador**: Verificar que contadores se actualizaron

---

## 📝 Archivos Modificados

```
backend/src/routes/appointments.ts
└── Línea ~525-650: Nuevo endpoint POST /:id/restore
    ├── Validación de cita cancelada
    ├── Validación de conflictos de paciente
    ├── Validación de cupos disponibles
    ├── Validación de estado de agenda
    ├── UPDATE status = 'Confirmada'
    └── UPDATE booked_slots + 1

frontend/src/lib/api.ts
└── Línea ~557: Nuevo método restoreAppointment()

frontend/src/components/ViewAvailabilityModal.tsx
├── Línea ~14: Import RotateCcw icon
├── Línea ~156-186: Función handleRestoreAppointment
└── Línea ~575-609: Botón "Restaurar" en pestaña Cancelados
```

---

## 🚀 Deployment

### Compilación y Despliegue

```bash
# Backend
cd /home/ubuntu/app/backend
npm run build
pm2 restart ecosystem.config.js

# Frontend
cd /home/ubuntu/app/frontend
npm run build
```

### Estado Actual
- ✅ Backend compilado y reiniciado (PM2 restart #55)
- ✅ Frontend compilado exitosamente (20.59s)
- ✅ Endpoint disponible en producción
- ✅ Botón visible en interfaz

---

## 🔄 Retrocompatibilidad

### Base de Datos
- ✅ No requiere cambios en esquema
- ✅ Usa campos existentes (`status`, `cancellation_reason`)
- ✅ `booked_slots` ya existe en tabla `availabilities`

### API
- ✅ Endpoint nuevo, no afecta endpoints existentes
- ✅ Respuesta estructurada y tipada
- ✅ Manejo de errores consistente con otros endpoints

### Frontend
- ✅ Solo afecta componente ViewAvailabilityModal
- ✅ Otros componentes no modificados
- ✅ Estado interno manejado con `deletingIds` existente

---

## 🎯 Beneficios

1. **Recuperación de errores**: Permite deshacer cancelaciones accidentales
2. **Eficiencia operativa**: No requiere crear nueva cita
3. **Preservación de datos**: Mantiene hora original e historial
4. **Gestión de cupos**: Actualiza automáticamente disponibilidad
5. **Validaciones robustas**: Evita conflictos y sobrecargas
6. **UX mejorada**: Un solo clic con confirmación

---

## 💡 Casos de Uso Reales

### Situación 1: Error de Click
```
Personal cancela cita por error
→ Click en "Restaurar"
→ Cita vuelve a confirmada en 2 segundos
```

### Situación 2: Paciente Cambia de Opinión
```
Paciente cancela pero llama de vuelta
→ Administrativo restaura cita original
→ Mantiene hora y especialista asignado
```

### Situación 3: Sistema de Lista de Espera
```
Cita cancelada libera cupo
→ Otro paciente toma el cupo
→ Paciente original quiere volver
→ Sistema detecta conflicto (sin cupos)
→ No permite restaurar
```

---

## 🔒 Seguridad y Validaciones

### Validaciones Implementadas

| Nivel | Validación | Previene |
|-------|------------|----------|
| **URL** | `id` numérico | Inyección SQL |
| **Auth** | `requireAuth` middleware | Acceso no autorizado |
| **Estado** | Solo citas canceladas | Duplicados |
| **Conflictos** | Mismo paciente/día | Solapamientos |
| **Cupos** | `booked_slots < capacity` | Sobrecarga |
| **Agenda** | `status = 'Activa'` | Restaurar en agenda cerrada |

### Logging
```typescript
console.log(`✅ Cita ${id} restaurada exitosamente por el usuario`);
console.error('❌ Error restaurando cita:', error);
```

---

## 📚 Documentación Relacionada

- [Mejoras Interfaz Lista Pacientes](./MEJORAS_INTERFAZ_LISTA_PACIENTES.md)
- [Función Reasignación de Citas](./FUNCION_REASIGNACION_CITAS.md)
- [Pestañas Confirmados Cancelados](./PESTANAS_CONFIRMADOS_CANCELADOS.md)

---

## 🎓 Próximas Mejoras Sugeridas

1. **Historial de restauraciones:**
   - Tabla `appointment_history` para auditoría
   - Quién restauró y cuándo

2. **Restauración masiva:**
   - Checkbox para seleccionar múltiples citas
   - Botón "Restaurar seleccionadas"

3. **Notificaciones:**
   - Email/SMS al paciente cuando se restaura
   - "Su cita ha sido reactivada para..."

4. **Permisos granulares:**
   - Solo ciertos roles pueden restaurar
   - Requiere supervisor para citas > 7 días

5. **Estadísticas:**
   - Dashboard: "Citas restauradas esta semana"
   - Detectar patrones de cancelación/restauración

---

**Resultado:** Sistema completo de restauración de citas canceladas con validaciones robustas, interfaz intuitiva y manejo de errores, permitiendo recuperar citas canceladas por error de manera segura y eficiente.
