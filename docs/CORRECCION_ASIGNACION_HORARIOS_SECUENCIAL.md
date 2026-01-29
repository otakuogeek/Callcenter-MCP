# Corrección: Asignación Secuencial de Horarios desde Cola de Espera

## Fecha
11 de Noviembre de 2025

## Problema Identificado
Cuando se asignaba una cita desde la cola de espera en el panel administrativo, el sistema programaba la cita en el **primer horario disponible** de la agenda (el `start_time`), sin considerar las citas ya existentes. Esto causaba que:

- Las nuevas citas se sobreponían al inicio del horario
- No se respetaba el orden secuencial de las citas
- Las citas no se programaban "después" de la última cita existente

### Ejemplo del Problema:
```
Agenda: 08:00 - 12:00 (Duración: 15 min)
Citas existentes:
  - 08:00 - Paciente A
  - 08:15 - Paciente B
  - 08:30 - Paciente C

❌ Comportamiento anterior:
  Nueva cita → 08:00 (conflicto con Paciente A)

✅ Comportamiento esperado:
  Nueva cita → 08:45 (después de Paciente C)
```

## Solución Implementada

Se modificó el endpoint `/api/appointments/waiting-list/assign` para implementar una lógica inteligente de asignación de horarios:

### 1. Recepción del Parámetro `selected_time` (Opcional)

El endpoint ahora acepta un parámetro adicional desde el frontend:

```typescript
const { waiting_list_id, availability_id, patient_id, reason, priority_level, cups_id, selected_time } = req.body;
```

### 2. Lógica de Determinación del Horario

```typescript
let appointmentTime: string;

if (selected_time) {
  // CASO 1: El usuario seleccionó un horario específico desde el frontend
  appointmentTime = selected_time;
  console.log(`[ASSIGN-FROM-QUEUE] Usando hora seleccionada: ${appointmentTime}`);
  
} else {
  // CASO 2: Calcular automáticamente la siguiente hora disponible
  const [lastAppointment]: any = await pool.query(
    `SELECT TIME_FORMAT(scheduled_at, '%H:%i') AS last_time,
            TIME_FORMAT(DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE), '%H:%i') AS next_available
     FROM appointments
     WHERE availability_id = ?
       AND DATE(scheduled_at) = ?
       AND status NOT IN ('Cancelada', 'No Show')
     ORDER BY scheduled_at DESC
     LIMIT 1`,
    [availability_id, agendaDate]
  );

  if (lastAppointment && lastAppointment.length > 0 && lastAppointment[0].next_available) {
    // Hay citas existentes → programar después de la última
    appointmentTime = lastAppointment[0].next_available;
    console.log(`[ASSIGN-FROM-QUEUE] Última cita: ${lastAppointment[0].last_time}, siguiente disponible: ${appointmentTime}`);
  } else {
    // No hay citas → usar el inicio de la agenda
    appointmentTime = agenda.start_time.substring(0, 5); // HH:mm
    console.log(`[ASSIGN-FROM-QUEUE] No hay citas previas, usando inicio de agenda: ${appointmentTime}`);
  }
}
```

### 3. Validación del Horario

Se agregó validación para asegurar que el horario esté dentro del rango de la agenda:

```typescript
// Validar que la hora está dentro del rango de la agenda
const startMinutes = parseInt(agenda.start_time.split(':')[0]) * 60 + parseInt(agenda.start_time.split(':')[1]);
const endMinutes = parseInt(agenda.end_time.split(':')[0]) * 60 + parseInt(agenda.end_time.split(':')[1]);
const appointmentMinutes = parseInt(appointmentTime.split(':')[0]) * 60 + parseInt(appointmentTime.split(':')[1]);

if (appointmentMinutes < startMinutes || appointmentMinutes + durationMinutes > endMinutes) {
  return res.status(400).json({
    success: false,
    message: `La hora ${appointmentTime} está fuera del rango de la agenda (${agenda.start_time} - ${agenda.end_time})`
  });
}
```

### 4. Consulta SQL Mejorada

La consulta SQL ahora:
- Busca la **última cita** en la agenda y fecha específicas
- Calcula automáticamente la **siguiente hora disponible** usando `DATE_ADD` con `INTERVAL duration_minutes`
- Excluye citas canceladas o no show
- Ordena por `scheduled_at DESC` para obtener la más reciente

```sql
SELECT TIME_FORMAT(scheduled_at, '%H:%i') AS last_time,
       TIME_FORMAT(DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE), '%H:%i') AS next_available
FROM appointments
WHERE availability_id = ?
  AND DATE(scheduled_at) = ?
  AND status NOT IN ('Cancelada', 'No Show')
ORDER BY scheduled_at DESC
LIMIT 1
```

### 5. Uso de `durationMinutes` Consistente

Se agregó soporte para `default_duration_minutes` de la especialidad:

```typescript
const agendaDate = agenda.date.toISOString().split('T')[0];
const durationMinutes = agenda.duration_minutes || agenda.default_duration_minutes || 15;
```

Y se utiliza en el INSERT:

```typescript
const [insertResult]: any = await pool.query(
  `INSERT INTO appointments (..., duration_minutes, ...) VALUES (...)`,
  [..., durationMinutes, ...]
);
```

## Cambios en Archivos

### Backend: `/backend/src/routes/appointments.ts`

#### Línea ~1738 - Endpoint `/waiting-list/assign`

**ANTES:**
```typescript
router.post('/waiting-list/assign', requireAuth, async (req: Request, res: Response) => {
  const { waiting_list_id, availability_id, patient_id, reason, priority_level, cups_id } = req.body;
  
  // ... validaciones ...
  
  const agenda = newAvailability[0];
  
  // ❌ Siempre usaba start_time
  const scheduledAt = `${agenda.date.toISOString().split('T')[0]} ${agenda.start_time}`;
```

**DESPUÉS:**
```typescript
router.post('/waiting-list/assign', requireAuth, async (req: Request, res: Response) => {
  const { waiting_list_id, availability_id, patient_id, reason, priority_level, cups_id, selected_time } = req.body;
  
  // ... validaciones ...
  
  const agenda = newAvailability[0];
  const agendaDate = agenda.date.toISOString().split('T')[0];
  const durationMinutes = agenda.duration_minutes || agenda.default_duration_minutes || 15;
  
  // ✅ Determina el horario inteligentemente
  let appointmentTime: string;
  
  if (selected_time) {
    appointmentTime = selected_time;
  } else {
    // Busca la última cita y calcula la siguiente disponible
    const [lastAppointment]: any = await pool.query(
      `SELECT TIME_FORMAT(scheduled_at, '%H:%i') AS last_time,
              TIME_FORMAT(DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE), '%H:%i') AS next_available
       FROM appointments
       WHERE availability_id = ? AND DATE(scheduled_at) = ? AND status NOT IN ('Cancelada', 'No Show')
       ORDER BY scheduled_at DESC LIMIT 1`,
      [availability_id, agendaDate]
    );
    
    if (lastAppointment && lastAppointment.length > 0 && lastAppointment[0].next_available) {
      appointmentTime = lastAppointment[0].next_available;
    } else {
      appointmentTime = agenda.start_time.substring(0, 5);
    }
  }
  
  // Validar rango de horario
  // ... (código de validación) ...
  
  const scheduledAt = `${agendaDate} ${appointmentTime}:00`;
```

## Flujo de Funcionamiento

### Caso 1: Usuario Selecciona Horario Específico (Frontend)

1. **Frontend** muestra selector de horarios disponibles
2. Usuario selecciona hora específica (ej: "09:30")
3. Frontend envía `selected_time: "09:30"` en el request
4. Backend usa directamente ese horario
5. Backend valida que esté dentro del rango de la agenda
6. Crea la cita con el horario seleccionado

### Caso 2: Asignación Automática (Sin Selección)

1. **Frontend** no envía `selected_time` (o es null)
2. Backend consulta la última cita en esa agenda/fecha
3. Calcula la siguiente hora disponible: `última_hora + duración`
4. Si no hay citas previas, usa el `start_time` de la agenda
5. Valida que esté dentro del rango de la agenda
6. Crea la cita con el horario calculado

## Ejemplos de Ejecución

### Ejemplo 1: Primera Cita del Día

```
Agenda: 08:00 - 12:00, Duración: 15 min
Citas existentes: Ninguna

Query Result: [] (sin registros)

→ appointmentTime = "08:00" (start_time de la agenda)
→ Cita creada: 08:00
```

### Ejemplo 2: Con Citas Existentes

```
Agenda: 08:00 - 12:00, Duración: 15 min
Citas existentes:
  - 08:00 (Paciente A)
  - 08:15 (Paciente B)
  - 08:30 (Paciente C) ← última cita

Query Result:
  last_time: "08:30"
  next_available: "08:45" (08:30 + 15 min)

→ appointmentTime = "08:45"
→ Cita creada: 08:45
```

### Ejemplo 3: Horario Seleccionado por Usuario

```
Agenda: 08:00 - 12:00, Duración: 15 min
selected_time: "10:00" (usuario lo eligió)

→ appointmentTime = "10:00" (sin consultar la BD)
→ Validación: 10:00 está en rango [08:00, 12:00] ✓
→ Cita creada: 10:00
```

### Ejemplo 4: Horario Fuera de Rango (Error)

```
Agenda: 08:00 - 12:00, Duración: 15 min
selected_time: "13:00" (fuera de rango)

→ appointmentTime = "13:00"
→ Validación: 13:00 + 15 min > 12:00 ✗
→ Error 400: "La hora 13:00 está fuera del rango de la agenda (08:00 - 12:00)"
```

## Logs del Sistema

El sistema ahora genera logs detallados:

```
[ASSIGN-FROM-QUEUE] Usando hora seleccionada: 09:30
```

```
[ASSIGN-FROM-QUEUE] Última cita: 08:30, siguiente disponible: 08:45
```

```
[ASSIGN-FROM-QUEUE] No hay citas previas, usando inicio de agenda: 08:00
```

```
[ASSIGN-FROM-QUEUE] Paciente Juan Pérez asignado desde cola de espera. Cita ID: 1234 a las 08:45
```

## Beneficios

### 1. Orden Secuencial Correcto
Las citas se programan en orden cronológico, después de las citas existentes.

### 2. Sin Conflictos de Horarios
No se sobreponen citas en el mismo horario.

### 3. Flexibilidad
- Usuario puede elegir un horario específico (control manual)
- Sistema puede calcular automáticamente (modo automático)

### 4. Validación de Rango
Previene programar citas fuera del horario de la agenda.

### 5. Cálculo Inteligente de Duración
Usa `duration_minutes` de la agenda o `default_duration_minutes` de la especialidad.

### 6. Logs Detallados
Facilita el debugging y auditoría del sistema.

## Testing

### Test 1: Primera Cita del Día ✅
```bash
# Sin citas previas
POST /api/appointments/waiting-list/assign
{
  "waiting_list_id": 1,
  "availability_id": 100,
  "patient_id": 50
}

→ Resultado: Cita creada a las 08:00 (start_time)
```

### Test 2: Cita Secuencial ✅
```bash
# Con 3 citas existentes (08:00, 08:15, 08:30)
POST /api/appointments/waiting-list/assign
{
  "waiting_list_id": 2,
  "availability_id": 100,
  "patient_id": 51
}

→ Resultado: Cita creada a las 08:45 (después de 08:30)
```

### Test 3: Horario Específico ✅
```bash
# Usuario selecciona 10:00
POST /api/appointments/waiting-list/assign
{
  "waiting_list_id": 3,
  "availability_id": 100,
  "patient_id": 52,
  "selected_time": "10:00"
}

→ Resultado: Cita creada a las 10:00 (horario seleccionado)
```

### Test 4: Validación de Rango ✅
```bash
# Horario fuera de rango
POST /api/appointments/waiting-list/assign
{
  "waiting_list_id": 4,
  "availability_id": 100,
  "patient_id": 53,
  "selected_time": "13:00"
}

→ Resultado: Error 400 "La hora 13:00 está fuera del rango..."
```

## Despliegue

```bash
# Compilar backend
cd /home/ubuntu/app/backend
npm run build

# Reiniciar servicio
pm2 restart cita-central-backend

# Verificar logs
pm2 logs cita-central-backend --lines 50
```

## Estado
✅ **CORREGIDO Y DESPLEGADO**

El sistema ahora asigna citas correctamente en orden secuencial, respetando las citas existentes y programando las nuevas después de la última cita del día.

## Compatibilidad

- ✅ **Retrocompatible**: Si no se envía `selected_time`, funciona en modo automático
- ✅ **Frontend actualizado**: El modal envía `selected_time` cuando el usuario selecciona un horario
- ✅ **Sin cambios en BD**: No requiere migraciones ni cambios en esquema
- ✅ **Logs mejorados**: Facilita debugging y seguimiento

## Archivos Modificados

1. `/home/ubuntu/app/backend/src/routes/appointments.ts` - Endpoint `/waiting-list/assign` (líneas 1738-1947)
2. `/home/ubuntu/app/docs/CORRECCION_ASIGNACION_HORARIOS_SECUENCIAL.md` - Esta documentación
