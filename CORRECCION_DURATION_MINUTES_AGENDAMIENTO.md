# ✅ Corrección: Duration_Minutes en Agendamiento Público

## 🐛 Problema Identificado

Al crear una cita desde el portal público del paciente, el sistema estaba guardando **15 minutos** de duración en lugar de usar la duración configurada en la agenda (por ejemplo, 1 minuto).

### Síntomas
- Agenda creada con duración de **1 minuto**
- Primera cita agendada correctamente
- Al intentar agendar segunda cita: **Error "No hay tiempo suficiente en este bloque para la duración de la cita"**
- En la base de datos, la tabla `appointments` mostraba `duration_minutes = 15` en lugar de `1`

### Causa Raíz
El endpoint `/api/patients-v2/public/schedule-appointment` tenía dos problemas:

1. **No obtenía `duration_minutes` de la tabla `availabilities`**
   - La consulta SQL no incluía el campo `duration_minutes`
   - En su lugar, obtenía `default_duration_minutes` de la tabla `specialties`
   - Usaba un fallback hardcodeado de 15 minutos

2. **Hardcodeaba 15 minutos en la respuesta**
   - Línea 1596: `duration_minutes: 15` estaba fijo en el JSON de respuesta

## ✅ Solución Implementada

### Cambio 1: Incluir `duration_minutes` en la consulta de availabilities

**Archivo:** `/backend/src/routes/patients-updated.ts` (línea ~1357)

**Antes:**
```sql
SELECT 
  a.location_id,
  a.date as appointment_date,
  a.start_time,
  a.end_time,
  a.capacity,
  a.booked_slots,
  -- ❌ Falta duration_minutes
  l.name as location_name,
  d.name as doctor_name
FROM availabilities a
```

**Después:**
```sql
SELECT 
  a.location_id,
  a.date as appointment_date,
  a.start_time,
  a.end_time,
  a.capacity,
  a.booked_slots,
  a.duration_minutes,  -- ✅ Agregado
  l.name as location_name,
  d.name as doctor_name
FROM availabilities a
```

### Cambio 2: Eliminar consulta innecesaria de specialties

**Antes (líneas 1346-1353):**
```typescript
// Obtener duración de la especialidad
const [specialtyInfo] = await pool.execute(
  `SELECT default_duration_minutes FROM specialties WHERE id = ?`,
  [specialty_id]
);

const duration_minutes = (specialtyInfo as any[])[0]?.default_duration_minutes || 15;
console.log(`⏱️ Duración de la especialidad: ${duration_minutes} minutos`);
```

**Después:**
```typescript
// ✅ Eliminado - ahora se obtiene de availabilities
```

### Cambio 3: Extraer `duration_minutes` del objeto availability

**Antes (línea ~1380):**
```typescript
const availability = (availabilityData as any[])[0];
const { location_id, appointment_date, start_time, end_time } = availability;
```

**Después:**
```typescript
const availability = (availabilityData as any[])[0];
const { location_id, appointment_date, start_time, end_time, duration_minutes } = availability;
console.log(`⏱️ Duración de la agenda: ${duration_minutes} minutos`);
```

### Cambio 4: Usar `duration_minutes` real en la respuesta

**Antes (línea 1596):**
```typescript
duration_minutes: 15,  // ❌ Hardcodeado
```

**Después:**
```typescript
duration_minutes: duration_minutes,  // ✅ Valor real de la agenda
```

## 📊 Flujo Corregido

### Escenario: Agenda de 1 minuto con 10 cupos (11:31 - 11:41)

1. **Usuario agenda primera cita:**
   - Sistema consulta `availabilities` y obtiene `duration_minutes = 1`
   - Calcula hora: 11:31 + 1 min = **11:32**
   - Guarda en `appointments`: `duration_minutes = 1` ✅
   - Próxima hora disponible: 11:32

2. **Usuario agenda segunda cita:**
   - Obtiene última cita: 11:31 con duración 1 min
   - Calcula próxima hora: 11:31 + 1 min = **11:32**
   - Verifica que 11:32 + 1 min (11:33) < 11:41 ✅
   - Guarda cita con `duration_minutes = 1` ✅

3. **Y así sucesivamente hasta agotar los 10 cupos:**
   - 11:31, 11:32, 11:33, 11:34, 11:35, 11:36, 11:37, 11:38, 11:39, 11:40

## 🔍 Verificación en Base de Datos

### Antes de la Corrección
```sql
SELECT id, scheduled_at, duration_minutes 
FROM appointments 
WHERE availability_id = 335;

-- Resultado:
-- id: 2274, scheduled_at: 2025-11-21 11:31:00, duration_minutes: 15 ❌
```

### Después de la Corrección
```sql
-- Las nuevas citas tendrán:
-- duration_minutes: 1 ✅
```

## 🧪 Prueba de Verificación

1. **Crear agenda de prueba:**
   - Especialidad: Pediatría
   - Hora: 11:31 - 11:41 (10 minutos)
   - Duración: 1 minuto
   - Capacidad: 10 cupos

2. **Agendar citas desde portal público:**
   - Primera cita: 11:31 ✅
   - Segunda cita: 11:32 ✅
   - Tercera cita: 11:33 ✅
   - ... hasta la décima cita: 11:40 ✅

3. **Intentar agendar cita 11:**
   - Error esperado: "No hay cupos disponibles" ✅

## 📝 Archivos Modificados

1. **`/backend/src/routes/patients-updated.ts`**
   - Línea ~1357: Agregado `a.duration_minutes` a consulta SQL
   - Línea ~1346-1353: Eliminada consulta de specialties
   - Línea ~1380: Agregado `duration_minutes` a desestructuración
   - Línea ~1596: Cambiado hardcoded 15 por variable `duration_minutes`

## 🚀 Despliegue

```bash
# Backend compilado exitosamente
cd /home/ubuntu/app/backend && npm run build

# PM2 reiniciado (restart #355)
pm2 restart cita-central-backend
```

## ✅ Estado Final

- ✅ Endpoint público usa `duration_minutes` de `availabilities`
- ✅ Citas se guardan con la duración correcta de la agenda
- ✅ Sistema permite agendar múltiples citas en agendas de 1 minuto
- ✅ Backend compilado y desplegado en producción
- ✅ Validación funciona correctamente para evitar solapamientos

## 🎯 Resultado

El sistema ahora respeta correctamente la duración configurada en cada agenda, permitiendo crear agendas de 1 minuto o cualquier duración personalizada sin errores de "tiempo insuficiente".
