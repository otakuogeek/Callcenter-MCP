# 🔄 Mejora del Sistema de Lista de Espera - Filtrado por Especialidad

**Fecha:** 14 de octubre de 2025  
**Cambio:** Sistema de lista de espera mejorado para soportar organización por `specialty_id` o `availability_id`

---

## 📋 Resumen de Cambios

El sistema de lista de espera (`appointments_waiting_list`) ahora soporta dos modos de organización:

1. **Por Especialidad** (`specialty_id`) - Pacientes esperando por cualquier cita de una especialidad
2. **Por Availability** (`availability_id`) - Pacientes esperando por una agenda específica
3. **Modo Mixto** - Ambos IDs pueden estar presentes para máxima flexibilidad

---

## 🔧 Cambios Técnicos Implementados

### 1. Estructura de Base de Datos

#### Tabla: `appointments_waiting_list`
```sql
-- Campos relevantes
specialty_id BIGINT UNSIGNED NULL        -- Nuevo: Filtrar por especialidad
availability_id BIGINT UNSIGNED NULL     -- Existente: Filtrar por agenda específica
```

#### Nuevos Índices
```sql
-- Índice para consultas por especialidad + estado
CREATE INDEX idx_specialty_status ON appointments_waiting_list(specialty_id, status);

-- Índice para consultas por especialidad + prioridad
CREATE INDEX idx_specialty_priority ON appointments_waiting_list(specialty_id, priority_level);

-- Índice para consultas mixtas
CREATE INDEX idx_both_ids ON appointments_waiting_list(specialty_id, availability_id);
```

### 2. API Endpoints Actualizados

#### GET `/api/appointments/waiting-list`

**Antes:**
```http
GET /api/appointments/waiting-list
```

**Ahora:**
```http
GET /api/appointments/waiting-list
GET /api/appointments/waiting-list?specialty_id=3
GET /api/appointments/waiting-list?availability_id=156
GET /api/appointments/waiting-list?status=pending
GET /api/appointments/waiting-list?specialty_id=3&status=pending
```

**Parámetros de Query:**
- `specialty_id` (number, opcional) - Filtrar por especialidad
- `availability_id` (number, opcional) - Filtrar por agenda específica
- `status` (string, opcional) - Filtrar por estado (`pending`, `reassigned`, `cancelled`, `expired`, `all`)

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "specialty_id": 3,
      "specialty_name": "Cardiología",
      "total_waiting": 5,
      "patients": [
        {
          "id": 56,
          "patient_id": 1057,
          "patient_name": "Juan Pérez",
          "patient_phone": "3001234567",
          "patient_document": "1234567890",
          "scheduled_date": "2025-10-15T08:30:00.000Z",
          "priority_level": "Normal",
          "call_type": "normal",
          "status": "pending",
          "created_at": "2025-10-14T00:26:34.000Z",
          "reason": "Solicitud de cita para Cardiología",
          "notes": null,
          "doctor_name": "Sin asignar",
          "location_name": "Sin asignar",
          "appointment_date": null,
          "start_time": null,
          "queue_position": 1,
          "organized_by": "specialty",
          "wl_specialty_id": 3,
          "wl_availability_id": null
        }
      ]
    }
  ],
  "stats": {
    "total_specialties": 1,
    "total_patients_waiting": 5,
    "by_priority": {
      "urgente": 0,
      "alta": 0,
      "normal": 5,
      "baja": 0
    },
    "by_status": {
      "pending": 5,
      "reassigned": 0,
      "cancelled": 0,
      "expired": 0
    },
    "filters_applied": {
      "specialty_id": 3,
      "availability_id": null,
      "status": "pending"
    }
  }
}
```

#### POST `/api/appointments/waiting-list/by-specialty` ✨ NUEVO

**Descripción:** Agregar paciente a lista de espera directamente por especialidad (sin agenda específica)

**Body:**
```json
{
  "patient_id": 1072,
  "specialty_id": 3,
  "scheduled_date": "2025-10-20 10:00:00",
  "priority_level": "Normal",
  "reason": "Control cardiológico",
  "notes": "Paciente prefiere mañanas",
  "call_type": "normal"
}
```

**Campos:**
- `patient_id` ✅ **REQUERIDO** - ID del paciente
- `specialty_id` ✅ **REQUERIDO** - ID de la especialidad (validado contra tabla `specialties`)
- `scheduled_date` ✅ **REQUERIDO** - Fecha/hora deseada (YYYY-MM-DD HH:MM:SS)
- `reason` ✅ **REQUERIDO** - Motivo de la consulta
- `priority_level` ❌ Opcional - `"Baja"`, `"Normal"`, `"Alta"`, `"Urgente"` (default: `"Normal"`)
- `notes` ❌ Opcional - Notas adicionales
- `call_type` ❌ Opcional - `"normal"` o `"reagendar"` (default: `"normal"`)

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "Paciente agregado a lista de espera por especialidad",
  "data": {
    "waiting_list_id": 89,
    "patient_id": 1072,
    "patient_name": "Juan Pérez López",
    "specialty_id": 3,
    "specialty_name": "Cardiología",
    "scheduled_date": "2025-10-20T10:00:00.000Z",
    "priority_level": "Normal",
    "queue_position": 3,
    "call_type": "normal",
    "status": "pending",
    "organized_by": "specialty"
  }
}
```

---

## 🔄 Flujos de Trabajo

### Flujo 1: Lista de Espera por Especialidad (Nuevo)

```
Usuario solicita cita para "Cardiología"
            ↓
    No hay agenda específica disponible
            ↓
    POST /api/appointments/waiting-list/by-specialty
    {
      patient_id: 1072,
      specialty_id: 3,
      scheduled_date: "2025-10-20 10:00:00",
      priority_level: "Normal",
      reason: "Control cardiológico"
    }
            ↓
    Sistema:
    - Valida paciente existe
    - Valida especialidad existe
    - Calcula posición en cola
    - Inserta con specialty_id (availability_id = NULL)
            ↓
    Retorna:
    - waiting_list_id: 89
    - queue_position: 3
    - organized_by: "specialty"
            ↓
    Cuando se libere CUALQUIER agenda de Cardiología:
    - Sistema automáticamente reasigna
    - Notifica al paciente
```

### Flujo 2: Lista de Espera por Availability (Existente)

```
Usuario solicita cita para agenda específica
            ↓
    Agenda 156 (Dr. Méndez - Cardiología) está llena
            ↓
    POST /api/appointments (lógica existente)
    → Sistema detecta sin cupos
    → Añade a waiting_list con availability_id: 156
            ↓
    Sistema:
    - Inserta con availability_id: 156
    - specialty_id se puede inferir o dejar NULL
            ↓
    Cuando se libere un cupo en agenda 156:
    - Sistema reasigna SOLO de esa agenda
    - Notifica al paciente
```

### Flujo 3: Consulta de Lista de Espera

```
Administrador consulta lista de espera
            ↓
    Opción A: Ver TODAS las especialidades
    GET /api/appointments/waiting-list
            ↓
    Opción B: Ver solo Cardiología
    GET /api/appointments/waiting-list?specialty_id=3
            ↓
    Opción C: Ver solo agenda específica
    GET /api/appointments/waiting-list?availability_id=156
            ↓
    Sistema retorna lista agrupada por especialidad
    con indicador "organized_by"
```

---

## 📊 Campos Indicadores

Cada paciente en la lista de espera incluye:

```json
{
  "organized_by": "specialty",      // "specialty" o "availability"
  "wl_specialty_id": 3,              // ID directo de specialty (puede ser NULL)
  "wl_availability_id": null,        // ID directo de availability (puede ser NULL)
  "specialty_name": "Cardiología",   // Nombre de especialidad (siempre presente)
  "doctor_name": "Sin asignar"       // "Sin asignar" si organized_by = "specialty"
}
```

---

## 💡 Casos de Uso

### Caso 1: Paciente sin agenda específica
**Escenario:** Paciente llama y solo quiere "Cardiología" sin preferencia de doctor

**Solución:**
```bash
POST /api/appointments/waiting-list/by-specialty
{
  "patient_id": 1072,
  "specialty_id": 3,
  "scheduled_date": "2025-10-20 10:00:00",
  "priority_level": "Normal",
  "reason": "Control cardiológico"
}
```

**Resultado:** Paciente se añade a lista general de Cardiología. Cuando cualquier agenda de Cardiología tenga cupos, se reasigna.

### Caso 2: Paciente con preferencia de doctor
**Escenario:** Paciente quiere específicamente con "Dr. Méndez"

**Solución:**
```bash
# Flujo normal de agendamiento
POST /api/appointments
{
  "patient_id": 1072,
  "availability_id": 156,  # Agenda del Dr. Méndez
  "scheduled_date": "2025-10-20 10:00:00",
  "reason": "Control cardiológico"
}
```

**Resultado:** Si no hay cupos, sistema añade a lista de espera de esa agenda específica (availability_id = 156).

### Caso 3: Reagendamiento
**Escenario:** Agenda cancelada, mover pacientes a lista de espera

**Solución:** El sistema automáticamente usa el campo `call_type='reagendar'` y `priority_level='Alta'` al mover pacientes.

---

## 🔍 Consultas SQL Útiles

### Ver lista de espera por especialidad
```sql
SELECT 
  p.name AS patient_name,
  s.name AS specialty_name,
  wl.priority_level,
  wl.created_at,
  wl.organized_by
FROM appointments_waiting_list wl
INNER JOIN patients p ON wl.patient_id = p.id
LEFT JOIN specialties s ON wl.specialty_id = s.id
WHERE wl.status = 'pending'
  AND wl.specialty_id IS NOT NULL
ORDER BY s.name, wl.priority_level, wl.created_at;
```

### Ver lista de espera por agenda
```sql
SELECT 
  p.name AS patient_name,
  d.name AS doctor_name,
  s.name AS specialty_name,
  wl.priority_level,
  wl.created_at
FROM appointments_waiting_list wl
INNER JOIN patients p ON wl.patient_id = p.id
INNER JOIN availabilities a ON wl.availability_id = a.id
INNER JOIN doctors d ON a.doctor_id = d.id
INNER JOIN specialties s ON a.specialty_id = s.id
WHERE wl.status = 'pending'
  AND wl.availability_id IS NOT NULL
ORDER BY d.name, wl.priority_level, wl.created_at;
```

### Contar pacientes por modo de organización
```sql
SELECT 
  CASE 
    WHEN specialty_id IS NOT NULL AND availability_id IS NULL THEN 'Por Especialidad'
    WHEN specialty_id IS NULL AND availability_id IS NOT NULL THEN 'Por Availability'
    WHEN specialty_id IS NOT NULL AND availability_id IS NOT NULL THEN 'Modo Mixto'
    ELSE 'Sin Clasificar'
  END AS modo_organizacion,
  COUNT(*) AS total
FROM appointments_waiting_list
WHERE status = 'pending'
GROUP BY modo_organizacion;
```

---

## ⚠️ Validaciones Implementadas

### A Nivel de Aplicación

```typescript
// Validación: Al menos uno de los IDs debe estar presente
if (!specialty_id && !availability_id) {
  throw new Error('Debe proporcionar specialty_id o availability_id');
}

// Validación: specialty_id existe en tabla specialties
const [specialtyCheck] = await pool.query(
  'SELECT id, name FROM specialties WHERE id = ?',
  [specialty_id]
);

if (specialtyCheck.length === 0) {
  throw new Error('Especialidad no encontrada');
}
```

### A Nivel de Base de Datos

- ✅ Índices creados para optimizar consultas
- ✅ Campos `specialty_id` y `availability_id` como NULL permitidos
- ⚠️ No se puede crear constraint CHECK en esta versión de MariaDB

---

## 📈 Beneficios de la Mejora

1. **Mayor Flexibilidad** - Pacientes pueden esperar por especialidad general o agenda específica
2. **Mejor UX** - Pacientes sin preferencia de doctor obtienen cita más rápido
3. **Optimización de Recursos** - Sistema puede reasignar de cualquier agenda disponible
4. **Reportes Mejorados** - Filtrado avanzado por especialidad en estadísticas
5. **Escalabilidad** - Preparado para múltiples doctores por especialidad

---

## 🚀 Endpoints Disponibles

### Lista de Espera
```
GET    /api/appointments/waiting-list                    # Ver lista completa
GET    /api/appointments/waiting-list?specialty_id=3     # Filtrar por especialidad
GET    /api/appointments/waiting-list?availability_id=156 # Filtrar por agenda
POST   /api/appointments/waiting-list/by-specialty       # Añadir por especialidad (NUEVO)
```

### Otros Endpoints Relacionados
```
GET    /api/appointments/daily-queue                     # Cola diaria
POST   /api/appointments                                 # Agendar cita (con lista de espera automática)
```

---

## 📝 Archivos Modificados

1. **Backend:**
   - `/backend/src/routes/appointments.ts` - Lógica de lista de espera actualizada
   - `/backend/migrations/improve_waiting_list_specialty_filter.sql` - Migración de BD

2. **Base de Datos:**
   - Tabla `appointments_waiting_list` - Índices agregados
   - Tabla `specialties` - Referencia cruzada mejorada

---

## 🧪 Testing

### Prueba 1: Añadir a lista de espera por especialidad
```bash
curl -X POST http://localhost:4000/api/appointments/waiting-list/by-specialty \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patient_id": 1057,
    "specialty_id": 3,
    "scheduled_date": "2025-10-20 10:00:00",
    "priority_level": "Normal",
    "reason": "Control cardiológico"
  }'
```

### Prueba 2: Consultar lista de espera por especialidad
```bash
curl http://localhost:4000/api/appointments/waiting-list?specialty_id=3 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Prueba 3: Consultar lista completa
```bash
curl http://localhost:4000/api/appointments/waiting-list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Estadísticas Retornadas

```json
{
  "stats": {
    "total_specialties": 3,
    "total_patients_waiting": 12,
    "by_priority": {
      "urgente": 2,
      "alta": 3,
      "normal": 7,
      "baja": 0
    },
    "by_status": {
      "pending": 12,
      "reassigned": 0,
      "cancelled": 0,
      "expired": 0
    },
    "filters_applied": {
      "specialty_id": null,
      "availability_id": null,
      "status": "pending"
    }
  }
}
```

---

## ✅ Estado de Implementación

- ✅ Migración de base de datos aplicada
- ✅ Índices creados
- ✅ Endpoint GET actualizado con filtros
- ✅ Endpoint POST nuevo creado
- ✅ Backend compilado y reiniciado
- ✅ Validaciones implementadas
- ✅ Documentación generada

---

**Autor:** GitHub Copilot  
**Fecha:** 14 de octubre de 2025  
**Versión:** 2.0.0  
**Estado:** ✅ Implementado y Desplegado
