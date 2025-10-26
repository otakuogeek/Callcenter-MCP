# 📋 Informe Detallado de Herramientas MCP - Sistema Biosanarcall

**Fecha:** 13 de octubre de 2025  
**Servidor:** MCP Unified (Puerto 8977)  
**Protocolo:** JSON-RPC 2.0  
**Total de Herramientas:** 8 herramientas activas

---

## 📊 Índice de Herramientas

1. [listActiveEPS](#1-listactiveeps) - Consultar EPS activas
2. [registerPatientSimple](#2-registerpatientsimple) - Registro simplificado de pacientes
3. [getAvailableAppointments](#3-getavailableappointments) - Consultar citas disponibles
4. [checkAvailabilityQuota](#4-checkavailabilityquota) - Verificar cupos disponibles
5. [scheduleAppointment](#5-scheduleappointment) - Agendar cita médica
6. [getPatientAppointments](#6-getpatientappointments) - Historial de citas del paciente
7. [getWaitingListAppointments](#7-getwaitinglistappointments) - Consultar lista de espera
8. [reassignWaitingListAppointments](#8-reassignwaitinglistappointments) - Reasignar citas desde lista de espera

---

## 1. listActiveEPS

### 📝 Descripción
Consulta las EPS (Entidades Promotoras de Salud) activas disponibles para registro de pacientes. Retorna ID, nombre y código de cada EPS.

### 🔧 Parámetros de Entrada
```json
{} // No requiere parámetros
```

### 📤 Datos que Retorna
```json
{
  "success": true,
  "count": 17,
  "eps_list": [
    {
      "id": 1,
      "name": "NUEVA EPS",
      "code": "EPS001",
      "has_agreement": true,
      "agreement_date": "2024-01-15",
      "notes": "Convenio activo",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "message": "Se encontraron 17 EPS activas disponibles",
  "usage_note": "Use el campo 'id' como insurance_eps_id para registrar pacientes con registerPatientSimple (opcional)"
}
```

### 💾 Datos que Almacena
**Tabla:** `eps`  
- No crea/modifica datos, solo consulta

### 🔄 Flujo de Trabajo
```
Usuario → listActiveEPS() → BD (tabla eps) → Retorna lista de EPS activas
                                ↓
                    Usar ID para registerPatientSimple (opcional)
```

### 💡 Uso Recomendado
- Llamar al inicio del flujo de registro de pacientes
- El ID de EPS es **opcional** en el registro de pacientes (actualizado)
- Útil para agentes de voz que preguntan por la EPS del paciente

---

## 2. registerPatientSimple

### 📝 Descripción
Registro simplificado de pacientes con datos mínimos requeridos: nombre, cédula y teléfono. La EPS es opcional y puede agregarse posteriormente.

### 🔧 Parámetros de Entrada
```json
{
  "document": "1234567890",           // ✅ REQUERIDO
  "name": "Juan Pérez López",         // ✅ REQUERIDO
  "phone": "3001234567",              // ✅ REQUERIDO
  "insurance_eps_id": 1,              // ⭐ OPCIONAL (actualizado)
  "notes": "Paciente nuevo"           // ❌ Opcional
}
```

#### Validaciones
- `document`: 5-20 caracteres
- `name`: 3-150 caracteres
- `phone`: 7-15 caracteres
- `insurance_eps_id`: Número entero >= 1 (opcional)

### 📤 Datos que Retorna
```json
{
  "success": true,
  "message": "Paciente registrado exitosamente",
  "patient_id": 1072,
  "patient": {
    "id": 1072,
    "document": "1234567890",
    "name": "Juan Pérez López",
    "phone": "3001234567",
    "email": null,
    "birth_date": null,
    "age": null,
    "gender": "No especificado",
    "address": null,
    "municipality": null,
    "eps": "NUEVA EPS",
    "eps_code": "EPS001",
    "status": "Activo",
    "created_at": "2025-10-13T16:30:00.000Z"
  },
  "registration_summary": {
    "total_fields_completed": 3,
    "required_fields_completed": 3,
    "optional_fields_completed": 0,
    "eps_provided": true
  }
}
```

### 💾 Datos que Almacena
**Tabla:** `patients`  
**Operación:** INSERT

```sql
INSERT INTO patients (
  document,           -- Cédula
  name,              -- Nombre completo
  phone,             -- Teléfono
  insurance_eps_id,  -- ID de EPS (puede ser NULL)
  notes,             -- Notas adicionales
  status,            -- 'Activo'
  created_at         -- Fecha de creación
)
```

### 🔄 Flujo de Trabajo
```
Usuario ingresa datos mínimos (cédula, nombre, teléfono)
            ↓
    Validación de duplicados (por documento)
            ↓
    ¿Ya existe paciente activo?
       ↙           ↘
     SÍ            NO
      ↓             ↓
  Error      Validación EPS (si se proporciona)
  duplicado         ↓
              INSERT en tabla patients
                    ↓
              Retorna patient_id
                    ↓
          Usar para scheduleAppointment
```

### 💡 Uso Recomendado
- **Primera interacción** con el sistema
- Validar duplicados antes de insertar
- Guardar el `patient_id` para futuras operaciones
- La EPS puede agregarse después si no está disponible

### ⚠️ Casos Especiales
```json
// Caso 1: Paciente sin EPS (NUEVO - Permitido)
{
  "document": "1234567890",
  "name": "Juan Pérez",
  "phone": "3001234567"
}
// → Resultado: ✅ Registrado con insurance_eps_id = NULL

// Caso 2: Paciente duplicado
{
  "success": false,
  "error": "Paciente duplicado encontrado",
  "duplicate_patient": {
    "id": 1050,
    "document": "1234567890",
    "name": "Juan Pérez López",
    "phone": "3001234567",
    "status": "Activo"
  },
  "suggestion": "Ya existe un paciente activo con este documento"
}
```

---

## 3. getAvailableAppointments

### 📝 Descripción
Lista todas las citas médicas disponibles. Permite filtrar por médico, especialidad y ubicación. Muestra médicos, horarios, duraciones y cupos disponibles ordenados por fecha. **Agrupado por ESPECIALIDAD + SEDE**.

### 🔧 Parámetros de Entrada
```json
{
  "doctor_id": 5,        // ❌ Opcional
  "specialty_id": 2,     // ❌ Opcional
  "location_id": 1,      // ❌ Opcional
  "limit": 50            // ❌ Opcional (default: 50)
}
```

### 📤 Datos que Retorna
```json
{
  "success": true,
  "message": "Se encontraron 3 especialidades con agendas disponibles",
  "count": 25,
  "specialties_count": 3,
  "specialties_list": [
    "Cardiología",
    "Medicina General",
    "Pediatría"
  ],
  "specialties": [
    {
      "specialty": {
        "id": 2,
        "name": "Cardiología"
      },
      "location": {
        "id": 1,
        "name": "Sede Principal",
        "address": "Calle 123 #45-67",
        "phone": "6012345678"
      },
      "doctors": [
        {
          "id": 5,
          "name": "Dr. Carlos Méndez",
          "email": "carlos@biosanar.com",
          "phone": "3201234567"
        }
      ],
      "availabilities": [
        {
          "availability_id": 156,
          "appointment_date": "2025-10-15",
          "time_range": "08:00 - 12:00",
          "start_time": "08:00",
          "end_time": "12:00",
          "duration_minutes": 30,
          "doctor": {
            "id": 5,
            "name": "Dr. Carlos Méndez"
          },
          "slots_available": 5,
          "waiting_list_count": 2
        }
      ],
      "total_slots_available": 12,
      "total_waiting_list": 3,
      "earliest_date": "2025-10-15",
      "has_direct_availability": true
    }
  ],
  "available_appointments": [
    {
      "availability_id": 156,
      "appointment_date": "2025-10-15",
      "time_range": "08:00 - 12:00",
      "duration_minutes": 30,
      "slots_available": 5,
      "waiting_list_count": 2,
      "doctor_id": 5,
      "doctor_name": "Dr. Carlos Méndez",
      "specialty_id": 2,
      "specialty_name": "Cardiología",
      "location_id": 1,
      "location_name": "Sede Principal"
    }
  ],
  "info": {
    "grouping": "Agrupado por ESPECIALIDAD + SEDE",
    "specialty_focus": "Cada especialidad muestra todas sus sedes y doctores disponibles",
    "slots_available_info": "slots_available=0 permite lista de espera automática",
    "usage": "Use specialty_id + location_id para verificar cupos con checkAvailabilityQuota"
  }
}
```

### 💾 Datos que Almacena
**Tablas consultadas:**
- `availabilities`
- `availability_distribution`
- `doctors`
- `specialties`
- `locations`
- `appointments_waiting_list`

**Operación:** SELECT (solo lectura)

### 🔄 Flujo de Trabajo
```
Usuario solicita ver citas disponibles
            ↓
    ¿Filtros aplicados?
       ↙           ↘
     SÍ            NO
      ↓             ↓
  Filtrar      Mostrar todas
  por X             ↓
      ↓       Agrupar por
  Agrupar      especialidad
  por              + sede
  especialidad      ↓
  + sede       Calcular cupos
      ↓        totales
  Calcular          ↓
  cupos        Ordenar por
  totales      especialidad
      ↓        y fecha
  Ordenar           ↓
  por          Retornar
  especialidad  agendas
  y fecha      agrupadas
      ↓             ↓
  Retornar     Usuario elige
  agendas      especialidad
  agrupadas    + sede + fecha
      ↓             ↓
  Usuario      Llamar
  elige        checkAvailabilityQuota
  especialidad      ↓
  + sede       Llamar
  + fecha      scheduleAppointment
```

### 💡 Uso Recomendado
- **Primera consulta** para ver opciones disponibles
- Presentar especialidades agrupadas al usuario
- Guardar `availability_id` para agendar
- Verificar `slots_available` antes de agendar
- Si `slots_available = 0`, usar lista de espera

### 📊 Interpretación de Datos
```javascript
// ✅ Cupos disponibles - Agendar directamente
if (slots_available > 0) {
  // Llamar scheduleAppointment
}

// ⏳ Sin cupos - Lista de espera
if (slots_available === 0) {
  // Informar al usuario sobre lista de espera
  // Llamar scheduleAppointment con priority_level
}

// 📋 Lista de espera activa
if (waiting_list_count > 0) {
  // Informar posición en cola al usuario
}
```

---

## 4. checkAvailabilityQuota

### 📝 Descripción
Verifica cuántos cupos hay disponibles para una **ESPECIALIDAD** en una **SEDE** específica. Agrega TODOS los cupos de todos los doctores de esa especialidad. Retorna información detallada sobre quotas totales, asignados, disponibles y si puede agendar directamente o debe ir a lista de espera. **DEBE LLAMARSE ANTES** de `scheduleAppointment` para tomar decisiones informadas.

### 🔧 Parámetros de Entrada
```json
{
  "specialty_id": 2,                  // ✅ REQUERIDO
  "location_id": 1,                   // ✅ REQUERIDO
  "day_date": "2025-10-15"           // ❌ Opcional (formato YYYY-MM-DD)
}
```

### 📤 Datos que Retorna
```json
{
  "success": true,
  "specialty": {
    "id": 2,
    "name": "Cardiología"
  },
  "location": {
    "id": 1,
    "name": "Sede Principal",
    "address": "Calle 123 #45-67"
  },
  "summary": {
    "total_availabilities": 4,
    "total_quota": 80,
    "total_assigned": 45,
    "total_available": 35,
    "availability_percentage": 43.75,
    "has_direct_availability": true,
    "total_waiting_list": 5
  },
  "availabilities": [
    {
      "availability_id": 156,
      "appointment_date": "2025-10-15",
      "day_of_week": "Lunes",
      "time_range": "08:00 - 12:00",
      "duration_minutes": 30,
      "doctor": {
        "id": 5,
        "name": "Dr. Carlos Méndez"
      },
      "quota_info": {
        "total_quota": 20,
        "assigned": 12,
        "available": 8,
        "percentage_used": 60
      },
      "waiting_list": {
        "count": 2,
        "by_priority": {
          "Urgente": 1,
          "Alta": 0,
          "Normal": 1,
          "Baja": 0
        }
      },
      "can_schedule_direct": true
    }
  ],
  "recommendation": {
    "action": "AGENDAR_DIRECTO",
    "message": "Hay 35 cupos disponibles. Puede agendar directamente.",
    "best_availability_id": 156,
    "best_date": "2025-10-15",
    "best_time": "08:00 - 12:00"
  }
}
```

### 💾 Datos que Almacena
**Tablas consultadas:**
- `availabilities`
- `availability_distribution`
- `doctors`
- `specialties`
- `locations`
- `appointments_waiting_list`

**Operación:** SELECT (solo lectura)

### 🔄 Flujo de Trabajo
```
Usuario elige especialidad + sede
            ↓
    checkAvailabilityQuota()
            ↓
    Consultar TODAS las availabilities
    de esa especialidad en esa sede
            ↓
    Agrupar y sumar cupos
    de todos los doctores
            ↓
    ¿Hay cupos disponibles?
       ↙           ↘
     SÍ            NO
      ↓             ↓
  Recomendar   Recomendar
  agendar      lista de
  directo      espera
      ↓             ↓
  Retornar     Retornar
  mejor        conteo de
  availability  lista de
                espera
```

### 💡 Uso Recomendado
- Llamar **SIEMPRE** antes de `scheduleAppointment`
- Evaluar la recomendación del sistema
- Informar al usuario sobre disponibilidad real
- Tomar decisiones inteligentes sobre agendamiento

### 📊 Interpretación de Recomendaciones
```javascript
// ✅ AGENDAR_DIRECTO
if (recommendation.action === "AGENDAR_DIRECTO") {
  // Hay cupos disponibles
  // Usar best_availability_id para agendar
  // Llamar scheduleAppointment
}

// ⏳ LISTA_ESPERA
if (recommendation.action === "LISTA_ESPERA") {
  // No hay cupos disponibles
  // Informar al usuario sobre lista de espera
  // Llamar scheduleAppointment con priority_level
}

// ⚠️ ESPERAR_REDISTRIBUCION
if (recommendation.action === "ESPERAR_REDISTRIBUCION") {
  // Hay lista de espera activa
  // Sugerir esperar reasignación automática
}
```

---

## 5. scheduleAppointment

### 📝 Descripción
Asigna una cita médica al paciente. Actualiza la disponibilidad y crea el registro de la cita. Requiere `availability_id` y día específico del `availability_distribution`. **Soporta agendamiento directo y lista de espera automática**.

### 🔧 Parámetros de Entrada
```json
{
  "patient_id": 1072,                         // ✅ REQUERIDO
  "availability_id": 156,                     // ✅ REQUERIDO
  "scheduled_date": "2025-10-15 08:30:00",   // ✅ REQUERIDO (YYYY-MM-DD HH:MM:SS)
  "reason": "Control cardiológico",          // ✅ REQUERIDO
  "appointment_type": "Presencial",          // ❌ Opcional (default: Presencial)
  "notes": "Paciente con hipertensión",      // ❌ Opcional
  "priority_level": "Normal"                 // ❌ Opcional (default: Normal)
}
```

#### Valores Permitidos
- `appointment_type`: `"Presencial"` | `"Telemedicina"`
- `priority_level`: `"Baja"` | `"Normal"` | `"Alta"` | `"Urgente"`

### 📤 Datos que Retorna

#### Caso 1: Agendamiento Directo (Hay Cupos)
```json
{
  "success": true,
  "message": "Cita agendada exitosamente",
  "appointment_id": 2345,
  "waiting_list": false,
  "appointment": {
    "id": 2345,
    "patient": {
      "id": 1072,
      "name": "Juan Pérez López",
      "document": "1234567890",
      "phone": "3001234567"
    },
    "doctor": {
      "id": 5,
      "name": "Dr. Carlos Méndez",
      "email": "carlos@biosanar.com"
    },
    "specialty": {
      "id": 2,
      "name": "Cardiología"
    },
    "location": {
      "id": 1,
      "name": "Sede Principal",
      "address": "Calle 123 #45-67"
    },
    "scheduled_date": "2025-10-15T08:30:00.000Z",
    "appointment_type": "Presencial",
    "reason": "Control cardiológico",
    "status": "Pendiente",
    "created_at": "2025-10-13T16:45:00.000Z"
  }
}
```

#### Caso 2: Lista de Espera (Sin Cupos)
```json
{
  "success": true,
  "message": "Agregado a lista de espera exitosamente",
  "waiting_list": true,
  "waiting_list_id": 89,
  "queue_position": 3,
  "priority_level": "Alta",
  "estimated_wait_time": "2-3 días",
  "notification_info": {
    "method": "SMS + Llamada",
    "message": "Le notificaremos cuando se libere un cupo"
  },
  "details": {
    "patient_id": 1072,
    "availability_id": 156,
    "specialty_name": "Cardiología",
    "location_name": "Sede Principal",
    "requested_date": "2025-10-15"
  }
}
```

### 💾 Datos que Almacena

#### Tabla: `appointments` (Si hay cupos)
```sql
INSERT INTO appointments (
  patient_id,
  availability_id,
  scheduled_date,
  appointment_type,
  reason,
  notes,
  status,              -- 'Pendiente'
  created_at
)
```

#### Tabla: `availability_distribution` (Actualiza cupos)
```sql
UPDATE availability_distribution
SET assigned = assigned + 1
WHERE availability_id = ? AND day_date = ?
  AND (quota - assigned) > 0
```

#### Tabla: `appointments_waiting_list` (Si NO hay cupos)
```sql
INSERT INTO appointments_waiting_list (
  patient_id,
  availability_id,
  requested_date,
  priority_level,
  reason,
  notes,
  status,              -- 'pending'
  queue_position,
  created_at
)
```

### 🔄 Flujo de Trabajo
```
Usuario confirma agendar cita
            ↓
    scheduleAppointment()
            ↓
    Validar patient_id existe
            ↓
    Validar availability_id existe
            ↓
    Verificar cupos disponibles
            ↓
    ¿Hay cupos disponibles?
       ↙           ↘
     SÍ            NO
      ↓             ↓
  Iniciar      Calcular
  transacción   posición
      ↓         en cola
  Actualizar        ↓
  availability  INSERT en
  _distribution appointments
      ↓         _waiting_list
  INSERT en         ↓
  appointments  Asignar
      ↓         queue_position
  Confirmar         ↓
  transacción   Retornar
      ↓         waiting_list
  Retornar      info
  appointment       ↓
  completo      Sistema
      ↓         notificará
  Enviar        cuando haya
  confirmación  cupo
  al paciente   disponible
```

### 💡 Uso Recomendado
1. Llamar `checkAvailabilityQuota` primero
2. Evaluar la recomendación
3. Informar al usuario sobre disponibilidad
4. Llamar `scheduleAppointment` con los datos correctos
5. Manejar ambos casos (directo y lista de espera)

### ⚠️ Validaciones Importantes
```javascript
// ✅ Validación de fecha
// La fecha debe estar en formato YYYY-MM-DD HH:MM:SS
scheduled_date: "2025-10-15 08:30:00"

// ✅ Validación de cupos
// El sistema verifica automáticamente si hay cupos
// Si no hay, añade a lista de espera

// ✅ Validación de paciente
// El patient_id debe existir en la tabla patients

// ✅ Validación de availability
// El availability_id debe existir y estar activo
```

---

## 6. getPatientAppointments

### 📝 Descripción
Consulta todas las citas de un paciente (pasadas y futuras) con detalles completos de médico, especialidad, ubicación y estado.

### 🔧 Parámetros de Entrada
```json
{
  "patient_id": 1072,                  // ✅ REQUERIDO
  "status": "Todas",                   // ❌ Opcional (default: Todas)
  "from_date": "2025-01-01"           // ❌ Opcional (YYYY-MM-DD)
}
```

#### Valores de Status
- `"Pendiente"` - Citas por confirmar
- `"Confirmada"` - Citas confirmadas
- `"Completada"` - Citas realizadas
- `"Cancelada"` - Citas canceladas
- `"Todas"` - Todas las citas (default)

### 📤 Datos que Retorna
```json
{
  "success": true,
  "patient_id": 1072,
  "count": 5,
  "appointments": [
    {
      "id": 2345,
      "scheduled_date": "2025-10-15T08:30:00.000Z",
      "appointment_type": "Presencial",
      "reason": "Control cardiológico",
      "status": "Pendiente",
      "doctor": {
        "id": 5,
        "name": "Dr. Carlos Méndez",
        "phone": "3201234567"
      },
      "specialty": {
        "id": 2,
        "name": "Cardiología"
      },
      "location": {
        "id": 1,
        "name": "Sede Principal",
        "address": "Calle 123 #45-67",
        "phone": "6012345678"
      },
      "notes": "Paciente con hipertensión",
      "created_at": "2025-10-13T16:45:00.000Z"
    }
  ],
  "summary": {
    "total": 5,
    "by_status": {
      "Pendiente": 2,
      "Confirmada": 1,
      "Completada": 2,
      "Cancelada": 0
    },
    "upcoming_appointments": 2,
    "past_appointments": 3
  }
}
```

### 💾 Datos que Almacena
**Tablas consultadas:**
- `appointments`
- `patients`
- `availabilities`
- `doctors`
- `specialties`
- `locations`

**Operación:** SELECT (solo lectura)

### 🔄 Flujo de Trabajo
```
Usuario solicita ver historial de citas
            ↓
    getPatientAppointments(patient_id)
            ↓
    Consultar tabla appointments
            ↓
    ¿Filtros aplicados?
       ↙           ↘
     SÍ            NO
      ↓             ↓
  Filtrar      Traer todas
  por status   las citas
  y/o fecha        ↓
      ↓        Ordenar por
  Ordenar      fecha
  por fecha    descendente
      ↓             ↓
  JOIN con     Retornar
  tablas       historial
  relacionadas  completo
      ↓
  Retornar
  historial
  filtrado
```

### 💡 Uso Recomendado
- Ver historial completo del paciente
- Verificar citas pendientes antes de agendar nueva
- Consultar citas pasadas para seguimiento
- Filtrar por estado para gestión específica

---

## 7. getWaitingListAppointments

### 📝 Descripción
Consulta las solicitudes de citas en lista de espera. Permite filtrar por paciente, médico, especialidad o ubicación. Muestra la posición en la cola y tiempo de espera.

### 🔧 Parámetros de Entrada
```json
{
  "patient_id": 1072,          // ❌ Opcional
  "doctor_id": 5,              // ❌ Opcional
  "specialty_id": 2,           // ❌ Opcional
  "location_id": 1,            // ❌ Opcional
  "priority_level": "Todas",   // ❌ Opcional (default: Todas)
  "status": "pending",         // ❌ Opcional (default: pending)
  "limit": 50                  // ❌ Opcional (default: 50)
}
```

#### Valores de Priority Level
- `"Baja"`
- `"Normal"`
- `"Alta"`
- `"Urgente"`
- `"Todas"` (default)

#### Valores de Status
- `"pending"` - Pendiente de asignación
- `"reassigned"` - Ya asignado
- `"cancelled"` - Cancelado
- `"expired"` - Expirado
- `"all"` - Todos los estados

### 📤 Datos que Retorna
```json
{
  "success": true,
  "count": 8,
  "waiting_list": [
    {
      "id": 89,
      "queue_position": 3,
      "priority_level": "Alta",
      "status": "pending",
      "patient": {
        "id": 1072,
        "name": "Juan Pérez López",
        "document": "1234567890",
        "phone": "3001234567"
      },
      "requested_date": "2025-10-15",
      "wait_time_days": 2,
      "doctor": {
        "id": 5,
        "name": "Dr. Carlos Méndez",
        "phone": "3201234567"
      },
      "specialty": {
        "id": 2,
        "name": "Cardiología"
      },
      "location": {
        "id": 1,
        "name": "Sede Principal",
        "address": "Calle 123 #45-67"
      },
      "reason": "Control cardiológico",
      "can_be_reassigned": true,
      "estimated_availability_date": "2025-10-17",
      "created_at": "2025-10-13T16:45:00.000Z"
    }
  ],
  "summary": {
    "total_pending": 8,
    "by_priority": {
      "Urgente": 2,
      "Alta": 3,
      "Normal": 3,
      "Baja": 0
    },
    "average_wait_time_days": 2.5,
    "reassignable_count": 5
  }
}
```

### 💾 Datos que Almacena
**Tablas consultadas:**
- `appointments_waiting_list`
- `patients`
- `availabilities`
- `doctors`
- `specialties`
- `locations`

**Operación:** SELECT (solo lectura)

### 🔄 Flujo de Trabajo
```
Usuario consulta lista de espera
            ↓
    getWaitingListAppointments()
            ↓
    Consultar tabla appointments_waiting_list
            ↓
    ¿Filtros aplicados?
       ↙           ↘
     SÍ            NO
      ↓             ↓
  Filtrar      Traer todas
  por filtros  las solicitudes
      ↓             ↓
  Ordenar      Ordenar por
  por          prioridad
  prioridad    y fecha
  y fecha          ↓
      ↓        Calcular
  Calcular     tiempo de
  tiempo de    espera
  espera           ↓
      ↓        Retornar
  Retornar     lista
  lista        completa
  filtrada
```

### 💡 Uso Recomendado
- Monitorear solicitudes pendientes
- Consultar posición de paciente específico
- Evaluar tiempos de espera promedio
- Identificar solicitudes para reasignación

### 📊 Interpretación de Datos
```javascript
// ✅ Puede ser reasignado
if (can_be_reassigned === true) {
  // Hay cupos disponibles
  // Llamar reassignWaitingListAppointments
}

// ⏳ Tiempo de espera alto
if (wait_time_days > 7) {
  // Alerta: Solicitud con mucho tiempo de espera
  // Considerar redistribución manual
}

// 🔴 Prioridad urgente
if (priority_level === "Urgente" && wait_time_days > 2) {
  // Acción inmediata requerida
}
```

---

## 8. reassignWaitingListAppointments

### 📝 Descripción
Procesa automáticamente la lista de espera para una disponibilidad específica. Reasigna citas pendientes a cupos disponibles según prioridad (Urgente > Alta > Normal > Baja).

### 🔧 Parámetros de Entrada
```json
{
  "availability_id": 156   // ✅ REQUERIDO
}
```

### 📤 Datos que Retorna
```json
{
  "success": true,
  "message": "Se procesó la lista de espera exitosamente",
  "availability_id": 156,
  "processing_summary": {
    "total_in_waiting_list": 8,
    "slots_available_before": 5,
    "appointments_created": 5,
    "remaining_in_waiting_list": 3,
    "slots_available_after": 0
  },
  "reassigned_appointments": [
    {
      "appointment_id": 2350,
      "waiting_list_id": 89,
      "patient": {
        "id": 1072,
        "name": "Juan Pérez López",
        "phone": "3001234567"
      },
      "priority_level": "Alta",
      "scheduled_date": "2025-10-15T08:30:00.000Z",
      "queue_position": 3,
      "notification_sent": true
    }
  ],
  "notifications": {
    "sms_sent": 5,
    "email_sent": 3,
    "call_scheduled": 2
  }
}
```

### 💾 Datos que Almacena

#### Tabla: `appointments` (Crea citas)
```sql
INSERT INTO appointments (
  patient_id,
  availability_id,
  scheduled_date,
  appointment_type,
  reason,
  notes,
  status,              -- 'Confirmada'
  created_at
)
```

#### Tabla: `availability_distribution` (Actualiza cupos)
```sql
UPDATE availability_distribution
SET assigned = assigned + 1
WHERE availability_id = ? AND day_date = ?
```

#### Tabla: `appointments_waiting_list` (Marca como reasignado)
```sql
UPDATE appointments_waiting_list
SET status = 'reassigned',
    reassigned_at = NOW(),
    reassigned_appointment_id = ?
WHERE id = ?
```

### 🔄 Flujo de Trabajo
```
Sistema detecta cupos liberados
O administrador inicia redistribución manual
            ↓
    reassignWaitingListAppointments(availability_id)
            ↓
    Consultar lista de espera pendiente
    para esa availability
            ↓
    Ordenar por prioridad:
    Urgente > Alta > Normal > Baja
            ↓
    Dentro de cada prioridad,
    ordenar por antigüedad (FIFO)
            ↓
    ¿Hay cupos disponibles?
       ↙           ↘
     SÍ            NO
      ↓             ↓
  Iniciar      Retornar
  transacción   mensaje
      ↓         sin cambios
  Para cada
  solicitud
  en orden:
      ↓
  Crear
  appointment
      ↓
  Actualizar
  availability
  _distribution
      ↓
  Marcar
  waiting_list
  como
  'reassigned'
      ↓
  Enviar
  notificación
  al paciente
      ↓
  ¿Quedan cupos?
     ↙     ↘
   SÍ      NO
    ↓       ↓
Continuar  Detener
con        proceso
siguiente      ↓
solicitud  Confirmar
           transacción
               ↓
           Retornar
           resumen de
           reasignaciones
```

### 💡 Uso Recomendado
- **Automático:** Ejecutar cuando se cancela una cita
- **Automático:** Ejecutar cuando se liberan cupos
- **Manual:** Ejecutar desde panel de administración
- **Programado:** Ejecutar diariamente para optimizar agendas

### 📊 Criterios de Priorización
```javascript
// Orden de procesamiento (de mayor a menor prioridad)
1. Urgente + Más antiguo
2. Alta + Más antiguo
3. Normal + Más antiguo
4. Baja + Más antiguo

// Ejemplo de orden de procesamiento:
[
  { priority: "Urgente", created_at: "2025-10-10", queue_position: 1 },
  { priority: "Urgente", created_at: "2025-10-11", queue_position: 2 },
  { priority: "Alta", created_at: "2025-10-09", queue_position: 3 },
  { priority: "Alta", created_at: "2025-10-12", queue_position: 4 },
  { priority: "Normal", created_at: "2025-10-08", queue_position: 5 }
]
```

### ⚠️ Consideraciones Importantes
- El proceso es **atómico** (todo o nada)
- Se envían notificaciones automáticas (SMS, email, llamada)
- Solo procesa solicitudes con status `"pending"`
- Respeta la capacidad máxima de cupos
- Mantiene integridad de datos con transacciones

---

## 🔄 Flujo de Trabajo Completo del Sistema

### Escenario 1: Agendamiento Exitoso (Hay Cupos)

```
1. Usuario llama para agendar cita
        ↓
2. Agente: listActiveEPS()
   → Consulta EPS disponibles (opcional)
        ↓
3. Usuario proporciona: cédula, nombre, teléfono
        ↓
4. Agente: registerPatientSimple()
   → Registra paciente
   → Obtiene patient_id: 1072
        ↓
5. Agente: getAvailableAppointments()
   → Muestra especialidades disponibles
   → Usuario elige: Cardiología en Sede Principal
        ↓
6. Agente: checkAvailabilityQuota(specialty_id: 2, location_id: 1)
   → Verifica cupos disponibles
   → Hay 35 cupos disponibles
   → Recomienda: AGENDAR_DIRECTO
   → Mejor opción: availability_id: 156, fecha: 2025-10-15
        ↓
7. Usuario confirma fecha y hora
        ↓
8. Agente: scheduleAppointment()
   → patient_id: 1072
   → availability_id: 156
   → scheduled_date: "2025-10-15 08:30:00"
   → reason: "Control cardiológico"
        ↓
9. Sistema:
   → Crea cita (appointment_id: 2345)
   → Actualiza cupos disponibles
   → Envía confirmación por SMS
        ↓
10. Agente confirma al usuario:
    → Cita con Dr. Carlos Méndez
    → Cardiología - Sede Principal
    → 15 de octubre, 8:30 AM
    → Número de cita: 2345
```

### Escenario 2: Lista de Espera (Sin Cupos)

```
1-5. [Mismos pasos que Escenario 1]
        ↓
6. Agente: checkAvailabilityQuota(specialty_id: 2, location_id: 1)
   → Verifica cupos disponibles
   → NO hay cupos disponibles
   → Recomienda: LISTA_ESPERA
   → Lista de espera actual: 5 personas
        ↓
7. Agente informa al usuario:
   → No hay cupos disponibles
   → ¿Desea entrar a lista de espera?
        ↓
8. Usuario acepta lista de espera
        ↓
9. Agente pregunta urgencia:
   → ¿Es urgente, alta, normal o baja prioridad?
   → Usuario responde: "Alta"
        ↓
10. Agente: scheduleAppointment()
    → patient_id: 1072
    → availability_id: 156
    → scheduled_date: "2025-10-15 08:30:00"
    → reason: "Control cardiológico"
    → priority_level: "Alta"
        ↓
11. Sistema:
    → Detecta que no hay cupos
    → Añade a lista de espera
    → Asigna queue_position: 3
    → Retorna waiting_list_id: 89
        ↓
12. Agente confirma al usuario:
    → Agregado a lista de espera
    → Posición en cola: 3
    → Prioridad: Alta
    → Le notificaremos cuando se libere un cupo
    → Número de solicitud: 89
        ↓
[PROCESO AUTOMÁTICO - Cuando se libere un cupo]
        ↓
13. Sistema: reassignWaitingListAppointments(availability_id: 156)
    → Procesa lista de espera
    → Asigna cupo al usuario según prioridad
    → Crea cita automáticamente
    → Envía notificación por SMS y llamada
        ↓
14. Usuario recibe notificación:
    → "Su cita ha sido confirmada"
    → Fecha: 15 de octubre, 8:30 AM
    → Sede Principal - Dr. Carlos Méndez
```

### Escenario 3: Consulta de Historial

```
1. Usuario llama para consultar sus citas
        ↓
2. Agente solicita cédula
   → Usuario proporciona: "1234567890"
        ↓
3. Agente busca paciente
   → Obtiene patient_id: 1072
        ↓
4. Agente: getPatientAppointments(patient_id: 1072)
   → Sistema retorna historial completo
        ↓
5. Agente informa al usuario:
   → Tiene 2 citas pendientes:
     - Cardiología: 15 oct, 8:30 AM
     - Medicina General: 20 oct, 10:00 AM
   → Tiene 3 citas completadas:
     - Última: Control general, 5 oct
```

---

## 📊 Tablas de Base de Datos Involucradas

### Tabla: `patients`
**Operaciones:** INSERT (registerPatientSimple)
```sql
CREATE TABLE patients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  document VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  email VARCHAR(100),
  birth_date DATE,
  gender ENUM('Masculino', 'Femenino', 'Otro', 'No especificado'),
  address VARCHAR(200),
  municipality_id INT,
  insurance_eps_id INT NULL,  -- Ahora puede ser NULL
  notes TEXT,
  status ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `eps`
**Operaciones:** SELECT (listActiveEPS)
```sql
CREATE TABLE eps (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  has_agreement BOOLEAN DEFAULT false,
  agreement_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `availabilities`
**Operaciones:** SELECT (getAvailableAppointments, checkAvailabilityQuota)
```sql
CREATE TABLE availabilities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  doctor_id INT NOT NULL,
  specialty_id INT NOT NULL,
  location_id INT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INT NOT NULL,
  capacity INT NOT NULL,
  status ENUM('Activa', 'Inactiva', 'Cancelada') DEFAULT 'Activa',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (specialty_id) REFERENCES specialties(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);
```

### Tabla: `availability_distribution`
**Operaciones:** SELECT, UPDATE (scheduleAppointment, reassignWaitingListAppointments)
```sql
CREATE TABLE availability_distribution (
  id INT PRIMARY KEY AUTO_INCREMENT,
  availability_id INT NOT NULL,
  day_date DATE NOT NULL,
  quota INT NOT NULL,
  assigned INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (availability_id) REFERENCES availabilities(id),
  UNIQUE KEY unique_availability_date (availability_id, day_date)
);
```

### Tabla: `appointments`
**Operaciones:** INSERT, SELECT (scheduleAppointment, getPatientAppointments, reassignWaitingListAppointments)
```sql
CREATE TABLE appointments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  availability_id INT NOT NULL,
  scheduled_date DATETIME NOT NULL,
  appointment_type ENUM('Presencial', 'Telemedicina') DEFAULT 'Presencial',
  reason TEXT NOT NULL,
  notes TEXT,
  status ENUM('Pendiente', 'Confirmada', 'Completada', 'Cancelada') DEFAULT 'Pendiente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (availability_id) REFERENCES availabilities(id)
);
```

### Tabla: `appointments_waiting_list`
**Operaciones:** INSERT, SELECT, UPDATE (scheduleAppointment, getWaitingListAppointments, reassignWaitingListAppointments)
```sql
CREATE TABLE appointments_waiting_list (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  availability_id INT NOT NULL,
  requested_date DATE NOT NULL,
  priority_level ENUM('Baja', 'Normal', 'Alta', 'Urgente') DEFAULT 'Normal',
  reason TEXT NOT NULL,
  notes TEXT,
  status ENUM('pending', 'reassigned', 'cancelled', 'expired') DEFAULT 'pending',
  queue_position INT,
  reassigned_at DATETIME,
  reassigned_appointment_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (availability_id) REFERENCES availabilities(id),
  FOREIGN KEY (reassigned_appointment_id) REFERENCES appointments(id)
);
```

---

## 🎯 Mejores Prácticas de Uso

### 1. Orden de Llamadas Recomendado
```javascript
// Flujo estándar de agendamiento
1. listActiveEPS()                    // Opcional
2. registerPatientSimple()            // Obtener patient_id
3. getAvailableAppointments()         // Ver opciones
4. checkAvailabilityQuota()           // Verificar cupos (IMPORTANTE)
5. scheduleAppointment()              // Agendar o lista de espera
6. getPatientAppointments()           // Confirmar agendamiento
```

### 2. Manejo de Errores
```javascript
// Siempre validar success: true/false
if (!response.success) {
  // Manejar error específico
  console.error(response.error);
  // Informar al usuario amablemente
}

// Validar campos requeridos antes de llamar
if (!patient_id || !availability_id || !scheduled_date || !reason) {
  throw new Error("Faltan campos requeridos");
}
```

### 3. Optimización de Llamadas
```javascript
// ✅ CORRECTO: Llamar checkAvailabilityQuota antes de agendar
const quotaCheck = await checkAvailabilityQuota({
  specialty_id: 2,
  location_id: 1
});

if (quotaCheck.recommendation.action === "AGENDAR_DIRECTO") {
  // Proceder con agendamiento directo
  await scheduleAppointment({...});
} else {
  // Informar sobre lista de espera
  // Proceder con agendamiento en lista de espera
  await scheduleAppointment({..., priority_level: "Alta"});
}

// ❌ INCORRECTO: Agendar sin verificar cupos
// Esto puede causar errores o agendamiento en lista de espera inesperado
await scheduleAppointment({...});
```

### 4. Gestión de Lista de Espera
```javascript
// Monitoreo periódico de lista de espera
setInterval(async () => {
  const waitingList = await getWaitingListAppointments({
    status: "pending"
  });
  
  // Para cada availability con lista de espera
  for (const item of waitingList.waiting_list) {
    if (item.can_be_reassigned) {
      // Procesar reasignaciones automáticas
      await reassignWaitingListAppointments({
        availability_id: item.availability_id
      });
    }
  }
}, 3600000); // Cada hora
```

### 5. Notificaciones al Usuario
```javascript
// Después de agendar, siempre confirmar con el usuario
const appointment = await scheduleAppointment({...});

if (appointment.waiting_list) {
  // Mensaje para lista de espera
  console.log(`
    ✅ Agregado a lista de espera exitosamente
    📍 Posición: ${appointment.queue_position}
    ⏰ Tiempo estimado: ${appointment.estimated_wait_time}
    📞 Le notificaremos cuando se libere un cupo
    🔢 Número de solicitud: ${appointment.waiting_list_id}
  `);
} else {
  // Mensaje para agendamiento directo
  console.log(`
    ✅ Cita agendada exitosamente
    👨‍⚕️ Doctor: ${appointment.appointment.doctor.name}
    🏥 Especialidad: ${appointment.appointment.specialty.name}
    📍 Sede: ${appointment.appointment.location.name}
    📅 Fecha: ${appointment.appointment.scheduled_date}
    🔢 Número de cita: ${appointment.appointment_id}
  `);
}
```

---

## 🔐 Seguridad y Validaciones

### Validaciones Implementadas en el Backend

1. **Validación de Duplicados (registerPatientSimple)**
   - Verifica documento antes de insertar
   - Retorna información del paciente existente

2. **Validación de Cupos (scheduleAppointment)**
   - Verifica disponibilidad en tiempo real
   - Usa transacciones para evitar race conditions

3. **Validación de Fechas**
   - Formato correcto: YYYY-MM-DD o YYYY-MM-DD HH:MM:SS
   - Fechas no pasadas (solo futuras)

4. **Validación de IDs**
   - Verifica que existan en sus tablas respectivas
   - Retorna errores descriptivos si no existen

5. **Validación de Estado**
   - Solo procesa availabilities activas
   - Solo procesa pacientes activos

### Manejo de Concurrencia

```sql
-- Uso de transacciones para evitar race conditions
START TRANSACTION;
  -- 1. Verificar cupos disponibles
  SELECT (quota - assigned) as available
  FROM availability_distribution
  WHERE availability_id = ? AND day_date = ?
  FOR UPDATE;
  
  -- 2. Si hay cupos, actualizar
  UPDATE availability_distribution
  SET assigned = assigned + 1
  WHERE availability_id = ? AND day_date = ?
    AND (quota - assigned) > 0;
  
  -- 3. Insertar cita
  INSERT INTO appointments (...) VALUES (...);
COMMIT;
```

---

## 📈 Métricas y Estadísticas

### Información Proporcionada por las Herramientas

1. **getAvailableAppointments**
   - Total de especialidades disponibles
   - Cupos totales por especialidad y sede
   - Lista de espera activa

2. **checkAvailabilityQuota**
   - Porcentaje de ocupación
   - Cupos disponibles vs asignados
   - Recomendación de acción

3. **getWaitingListAppointments**
   - Tiempo promedio de espera
   - Distribución por prioridad
   - Solicitudes reasignables

4. **reassignWaitingListAppointments**
   - Citas creadas vs lista de espera total
   - Notificaciones enviadas
   - Cupos remanentes

---

## 🚀 Endpoints de Producción

### Servidor MCP Unified
- **URL Base:** `https://biosanarcall.site/mcp-unified`
- **Puerto Local:** 8977
- **Protocolo:** JSON-RPC 2.0
- **Método HTTP:** POST

### Ejemplo de Llamada
```bash
curl -X POST https://biosanarcall.site/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "getAvailableAppointments",
      "arguments": {
        "specialty_id": 2,
        "location_id": 1
      }
    }
  }'
```

---

## 📞 Soporte y Documentación

### Recursos Adicionales
- **Documentación MCP:** `/home/ubuntu/app/mcp-server-node/README.md`
- **Ejemplos de Uso:** `/home/ubuntu/app/mcp-server-node/examples/`
- **Logs del Servidor:** `/home/ubuntu/app/mcp-server-node/logs/unified-out.log`
- **Configuración PM2:** `/home/ubuntu/app/mcp-server-node/ecosystem.config.js`

### Contacto
- **Sistema:** Biosanarcall Medical Management System
- **Versión MCP:** 1.0.0
- **Última Actualización:** 13 de octubre de 2025

---

## 📝 Notas Finales

### Cambios Recientes
- **13/10/2025:** Campo `insurance_eps_id` ahora es opcional en `registerPatientSimple`
- **13/10/2025:** Mejora en agrupación por especialidad + sede en `getAvailableAppointments`
- **13/10/2025:** Sistema de lista de espera completamente funcional

### Próximas Mejoras Planificadas
- Integración con sistema de notificaciones SMS/Email
- Dashboard de métricas en tiempo real
- Exportación de reportes en PDF
- API REST adicional para integraciones externas

---

**Documento generado automáticamente por GitHub Copilot**  
**Fecha:** 13 de octubre de 2025  
**Versión:** 1.0.0
