# Función de Reasignación de Citas entre Agendas

## 📅 Fecha
**20 de Octubre de 2025**

---

## 🎯 Funcionalidad Implementada

### Sistema de Reasignación de Citas

Permite **mover pacientes de una agenda sin cupos a otra agenda** de la misma especialidad que tenga disponibilidad, manteniendo la integridad de los datos y actualizando automáticamente los cupos ocupados.

---

## 🔧 Componentes Creados

### 1. Backend - Endpoints de Reasignación

**Archivo:** `/backend/src/routes/availabilities.ts`

#### Endpoint 1: Obtener Agendas Disponibles

```typescript
GET /api/availabilities/:id/available-for-reassignment
```

**Propósito:** Buscar agendas de la misma especialidad con cupos disponibles

**Parámetros:**
- `:id` - ID de la availability actual (en URL)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "original_availability_id": 144,
    "specialty_id": 1,
    "specialty_name": "Medicina General",
    "available_agendas": [
      {
        "id": 145,
        "doctor_name": "Dr. Juan Pérez",
        "location_name": "Sede Principal",
        "date": "2025-10-22",
        "start_time": "09:00:00",
        "end_time": "12:00:00",
        "capacity": 15,
        "booked_slots": 5,
        "available_slots": 10,
        "duration_minutes": 15
      }
    ]
  }
}
```

**Filtros aplicados:**
- ✅ Misma especialidad que la agenda original
- ✅ Solo agendas activas (`status = 'Activa'`)
- ✅ Con cupos disponibles (`booked_slots < capacity`)
- ✅ Fecha igual o posterior a hoy
- ✅ Excluye la agenda actual
- ✅ Ordenadas por fecha y hora
- ✅ Límite de 50 resultados

---

#### Endpoint 2: Reasignar Cita

```typescript
POST /api/availabilities/reassign-appointment
```

**Propósito:** Mover una cita de una agenda a otra

**Body:**
```json
{
  "appointment_id": 1234,
  "new_availability_id": 145
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Cita de Pedro Alonso Rem reasignada exitosamente",
  "data": {
    "appointment_id": 1234,
    "patient_name": "Pedro Alonso Rem",
    "old_availability_id": 144,
    "new_availability_id": 145,
    "new_doctor": "Dr. Juan Pérez",
    "new_location": "Sede Principal",
    "new_date": "2025-10-22",
    "new_time": "09:00:00",
    "new_scheduled_at": "2025-10-22 09:00:00"
  }
}
```

**Validaciones:**
- ❌ Cita no encontrada → 404
- ❌ Cita cancelada o completada → 400 "No se puede reasignar"
- ❌ Agenda destino no activa → 400 "Agenda no activa"
- ❌ Sin cupos disponibles → 400 "Sin cupos"

**Operaciones atómicas (Transacción):**
1. ✅ Actualizar la cita con:
   - Nueva `availability_id`
   - Nuevo `doctor_id`
   - Nueva `location_id`
   - Nueva `specialty_id`
   - Nueva `scheduled_at` (primer slot disponible)
   - Nueva `duration_minutes`
2. ✅ Decrementar `booked_slots` de la agenda original
3. ✅ Incrementar `booked_slots` de la agenda destino
4. ✅ Commit o rollback automático en caso de error

---

### 2. Frontend - Cliente API

**Archivo:** `/frontend/src/lib/api.ts`

#### Métodos Agregados

```typescript
// Obtener agendas disponibles para reasignación
getAvailableForReassignment: (availabilityId: number) => 
  request<ApiResponse<{...}>>(`/availabilities/${availabilityId}/available-for-reassignment`)

// Reasignar una cita
reassignAppointment: (appointmentId: number, newAvailabilityId: number) =>
  request<ApiResponse<{...}>>(`/availabilities/reassign-appointment`, {
    method: 'POST',
    body: { appointment_id, new_availability_id }
  })
```

---

### 3. Frontend - Modal de Reasignación

**Archivo:** `/frontend/src/components/ReassignAppointmentModal.tsx`

**Props:**
```typescript
interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: number;           // ID de la cita a reasignar
  patientName: string;             // Nombre del paciente
  currentAvailabilityId: number;   // ID de la agenda actual
  onReassignSuccess: () => void;   // Callback después de reasignar
}
```

**Características:**
- 🔍 **Carga automática** de agendas disponibles al abrir
- 📋 **Lista visual** de agendas con toda la información:
  - Doctor
  - Sede
  - Fecha y horario
  - Cupos disponibles (con badge de colores)
- ✅ **Selección simple** con clic
- 🎨 **Indicador visual** de agenda seleccionada
- ⚠️ **Confirmación** antes de reasignar
- 📱 **Responsive** y scrolleable
- 🔄 **Estados de carga** y errores

**Estados del Badge de Cupos:**
- 🟢 Verde: Más de 5 cupos disponibles
- 🟡 Amarillo: 3-5 cupos disponibles
- 🟠 Naranja: 1-2 cupos disponibles

**Mensajes:**
- ✅ Éxito: "Paciente reasignado/a exitosamente"
- ❌ Sin agendas: "No hay agendas disponibles"
- ⚠️ Error: Muestra mensaje específico del backend

---

### 4. Frontend - Integración en ViewAvailabilityModal

**Archivo:** `/frontend/src/components/ViewAvailabilityModal.tsx`

**Botón "Reasignar" agregado:**
- 📍 **Ubicación:** Junto al badge de estado de cada paciente confirmado
- 🎨 **Estilo:** Botón outline azul con ícono de flecha
- 📱 **Responsive:** Muestra solo el ícono en móviles, texto en desktop
- 🔄 **Función:** Abre el modal de reasignación

**Estados agregados:**
```typescript
const [reassignModalOpen, setReassignModalOpen] = useState(false);
const [selectedAppointmentForReassign, setSelectedAppointmentForReassign] = useState<{
  id: number;
  patientName: string;
} | null>(null);
```

**Flujo:**
1. Usuario hace clic en "Reasignar" → Se abre el modal
2. Usuario selecciona una agenda disponible
3. Usuario confirma → Se reasigna la cita
4. Modal se cierra → La lista de pacientes se recarga automáticamente

---

## 📋 Flujo de Uso

### Escenario: Agenda Sin Cupos

1. **Situación:** 
   - Agenda de Medicina General el 21 de octubre
   - 12 de 12 cupos ocupados (100%)
   - Un paciente más necesita cita urgente

2. **Proceso:**
   
   **Paso 1:** Abrir detalles de la agenda
   ```
   📅 Medicina General - 21 oct 2025
   👥 12/12 cupos (Sin disponibilidad)
   ```

   **Paso 2:** Ver lista de pacientes confirmados
   ```
   ✓ Pedro Alonso Rem    09:00  [Confirmada] [Reasignar]
   ✓ Cindy Joana Díaz    09:15  [Confirmada] [Reasignar]
   ✓ Ana Martín Rucón    09:30  [Confirmada] [Reasignar]
   ...
   ```

   **Paso 3:** Hacer clic en "Reasignar" de un paciente
   ```
   → Se abre modal "Reasignar Cita"
   → Muestra: "Seleccione una agenda disponible para Pedro Alonso Rem"
   → Especialidad: Medicina General
   ```

   **Paso 4:** Ver agendas disponibles
   ```
   ┌────────────────────────────────────────────────┐
   │ Dr. Ana Teresa Escobar                         │
   │ 📍 Sede biosanár san gil                       │
   │ 📅 Mar, 22 oct 2025  🕐 09:00 - 11:45         │
   │                          [11 cupos] 🟢         │
   └────────────────────────────────────────────────┘
   
   ┌────────────────────────────────────────────────┐
   │ Dr. Carlos Méndez                              │
   │ 📍 Sede Principal                              │
   │ 📅 Mié, 23 oct 2025  🕐 14:00 - 16:45         │
   │                          [5 cupos] 🟡          │
   └────────────────────────────────────────────────┘
   ```

   **Paso 5:** Seleccionar una agenda
   ```
   → Clic en la primera opción
   → Se resalta con borde azul
   → Aparece: "✓ Agenda seleccionada"
   ```

   **Paso 6:** Confirmar reasignación
   ```
   → Clic en botón "Reasignar Cita"
   → Confirmación:
     "¿Está seguro de reasignar a Pedro Alonso Rem?
     
     Nueva agenda:
     • Doctor: Dr. Ana Teresa Escobar
     • Sede: Sede biosanár san gil
     • Fecha: 22 de octubre de 2025
     • Horario: 09:00 - 11:45"
   
   → [Cancelar] [Aceptar]
   ```

   **Paso 7:** Resultado
   ```
   ✅ "Pedro Alonso Rem ha sido reasignado/a exitosamente"
   
   Cambios automáticos:
   - Agenda del 21 oct: 11/12 cupos (liberó 1 cupo)
   - Agenda del 22 oct: 6/15 cupos (ocupó 1 cupo)
   - Cita actualizada con nueva fecha, doctor, sede
   ```

---

## 🔄 Cálculo Automático del Slot Disponible

Cuando se reasigna una cita, el sistema calcula automáticamente el **primer slot libre** en la agenda destino:

```typescript
// Lógica del backend
1. Tomar la hora de inicio de la agenda (ej: 09:00)
2. Obtener todas las citas ya agendadas, ordenadas por hora
3. Para cada slot potencial:
   - Si está ocupado → avanzar (duration_minutes)
   - Si está libre → asignar ese slot
4. Asignar la cita al primer slot libre encontrado
```

**Ejemplo:**
```
Agenda destino: 09:00 - 12:00 (duration: 15 min)

Citas existentes:
- 09:00 → Ocupado (Paciente A)
- 09:15 → Ocupado (Paciente B)
- 09:30 → Libre ← Aquí se asigna la nueva cita
- 09:45 → Libre
- 10:00 → Ocupado (Paciente C)
```

---

## 🛡️ Validaciones y Seguridad

### Validaciones del Backend

1. **Validación de IDs**
   - ✅ IDs numéricos válidos
   - ❌ IDs inválidos → 400 "ID inválido"

2. **Validación de Cita**
   - ✅ Cita existe
   - ❌ Cita no existe → 404 "Cita no encontrada"
   - ❌ Status cancelada/completada → 400 "No se puede reasignar"

3. **Validación de Agenda Destino**
   - ✅ Agenda existe
   - ❌ Agenda no existe → 404 "Agenda no encontrada"
   - ❌ Agenda no activa → 400 "Agenda no está activa"
   - ❌ Sin cupos → 400 "Sin cupos disponibles"

4. **Validación de Especialidad**
   - ✅ Misma especialidad (filtrado automático)

5. **Integridad de Datos**
   - ✅ Transacción atómica (todo o nada)
   - ✅ Actualización de cupos consistente
   - ✅ Rollback automático en error

### Seguridad

- 🔒 **Autenticación requerida** (`requireAuth` middleware)
- 🔒 **Validación de entrada** con tipos TypeScript
- 🔒 **Transacciones SQL** para evitar inconsistencias
- 🔒 **Prepared statements** para prevenir SQL injection

---

## 📊 Casos de Uso

### Caso 1: Agenda Completa - Necesidad de Reasignar

**Situación:**
- Agenda de Odontología el 23 oct con 15/15 cupos
- Paciente urgente necesita cita
- Hay otro paciente que puede moverse a otra fecha

**Solución:**
1. Identificar paciente flexible
2. Reasignar a agenda del 24 oct con cupos disponibles
3. Liberar cupo para el paciente urgente
4. ✅ Ambos pacientes atendidos

---

### Caso 2: Cambio de Sede por Paciente

**Situación:**
- Paciente agendado en Sede A
- Paciente pide cambio a Sede B (más cerca)
- Hay disponibilidad en Sede B, misma especialidad

**Solución:**
1. Abrir detalles de la cita actual
2. Reasignar a agenda de Sede B
3. ✅ Paciente atendido en sede preferida

---

### Caso 3: Optimización de Agendas

**Situación:**
- Varias agendas con 2-3 pacientes cada una
- Mejor concentrar pacientes en menos agendas

**Solución:**
1. Seleccionar agenda objetivo
2. Reasignar pacientes de otras agendas a esta
3. ✅ Agendas consolidadas, mejor uso de recursos

---

## 🧪 Pruebas Realizadas

### ✅ Backend - Endpoints

1. **GET /api/availabilities/:id/available-for-reassignment**
   - [x] Retorna agendas de la misma especialidad
   - [x] Solo agendas activas
   - [x] Solo con cupos disponibles
   - [x] Excluye agenda actual
   - [x] Ordenadas por fecha

2. **POST /api/availabilities/reassign-appointment**
   - [x] Reasigna cita exitosamente
   - [x] Actualiza cupos de ambas agendas
   - [x] Calcula slot disponible correctamente
   - [x] Rechaza citas canceladas
   - [x] Rechaza si no hay cupos
   - [x] Rollback en caso de error

### ✅ Frontend - UI/UX

1. **Botón "Reasignar"**
   - [x] Visible junto a cada paciente
   - [x] Abre el modal correctamente
   - [x] Responsive (ícono en móvil, texto en desktop)

2. **Modal de Reasignación**
   - [x] Carga agendas disponibles
   - [x] Muestra información completa
   - [x] Selección visual clara
   - [x] Confirmación antes de reasignar
   - [x] Mensajes de éxito/error
   - [x] Recarga lista después de reasignar

---

## 🚀 Despliegue

### Backend
```bash
cd /home/ubuntu/app/backend
npm run build
pm2 restart ecosystem.config.js
# Backend online (restart #53)
```

### Frontend
```bash
cd /home/ubuntu/app/frontend
npm run build
# Build completado (15.41s)
```

---

## 📝 Archivos Creados/Modificados

### Backend
- `/backend/src/routes/availabilities.ts`
  - Línea ~1711: `GET /:id/available-for-reassignment`
  - Línea ~1779: `POST /reassign-appointment`

### Frontend
- `/frontend/src/lib/api.ts`
  - Línea ~490: Métodos `getAvailableForReassignment` y `reassignAppointment`
  
- `/frontend/src/components/ReassignAppointmentModal.tsx` (NUEVO)
  - Componente completo del modal de reasignación
  
- `/frontend/src/components/ViewAvailabilityModal.tsx`
  - Línea ~20: Import de `ReassignAppointmentModal`
  - Línea ~51-55: Estados para el modal
  - Línea ~435-450: Botón "Reasignar" en cada paciente
  - Línea ~634-647: Integración del modal

---

## 🎓 Mejoras Futuras Sugeridas

### Prioridad Alta
1. **Filtros avanzados** en el modal:
   - Por rango de fechas
   - Por sede específica
   - Por doctor

2. **Reasignación masiva**:
   - Seleccionar múltiples pacientes
   - Reasignar todos a la misma agenda destino

3. **Historial de reasignaciones**:
   - Log de cambios de agenda
   - Motivo de la reasignación

### Prioridad Media
4. **Notificaciones automáticas**:
   - Email al paciente con nueva fecha/hora
   - SMS de confirmación

5. **Restricciones personalizadas**:
   - Pacientes que prefieren ciertos doctores
   - Pacientes que solo pueden en ciertas sedes

6. **Analytics**:
   - Reporte de reasignaciones por período
   - Motivos más comunes

---

## 🆘 Troubleshooting

### Error: "No hay agendas disponibles"

**Causas posibles:**
1. No hay agendas de la misma especialidad con cupos
2. Todas las agendas están completas
3. No hay agendas futuras activas

**Solución:**
- Crear nuevas agendas de esa especialidad
- Verificar que las agendas estén marcadas como "Activa"
- Verificar que la fecha sea futura

---

### Error al reasignar: "Sin cupos disponibles"

**Causa:** 
Otro administrativo reasignó al último cupo mientras el usuario veía el modal.

**Solución:**
- Cerrar y volver a abrir el modal (recarga agendas actualizadas)
- Seleccionar otra agenda disponible

---

### Cita no aparece en la agenda destino

**Verificar:**
1. ¿El mensaje de éxito apareció?
2. ¿Se recargó la lista de pacientes?
3. ¿La cita tiene status "Confirmada"?

**Solución:**
- Refrescar la página (F5)
- Verificar en la BD:
```sql
SELECT * FROM appointments WHERE id = 1234;
-- Verificar availability_id, scheduled_at
```

---

## ✅ Checklist de Verificación

- [x] Backend compilado sin errores
- [x] PM2 reiniciado (restart #53)
- [x] Frontend compilado (15.41s)
- [x] Endpoint `available-for-reassignment` funciona
- [x] Endpoint `reassign-appointment` funciona
- [x] Modal se abre correctamente
- [x] Lista de agendas carga
- [x] Selección visual funciona
- [x] Reasignación exitosa actualiza datos
- [x] Cupos se actualizan en ambas agendas
- [x] Validaciones funcionan
- [x] Transacciones SQL son atómicas
- [x] Documentación creada

---

**Estado:** ✅ Completado  
**Versión:** 1.4.0  
**Fecha de Implementación:** 20 de Octubre de 2025
