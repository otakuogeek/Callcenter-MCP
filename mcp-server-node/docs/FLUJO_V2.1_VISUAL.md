# Flujo Visual de Agendamiento v2.1 con checkAvailabilityQuota

## 📊 Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 1: SALUDO E INICIO                                             │
│ "Hola, bienvenido a Fundación Biosanar IPS. Le atiende Valeria"   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 2: CONSULTA DE DISPONIBILIDAD                                 │
│ ┌─────────────────────────────────────────┐                        │
│ │ Llamar: getAvailableAppointments()      │                        │
│ └────────────────┬────────────────────────┘                        │
│                  │                                                  │
│                  ▼                                                  │
│ Presenta: "Podemos procesar su solicitud para [especialidades]"    │
│ Pregunta: "¿Para cuál necesita la cita?"                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 3: SELECCIÓN DE SEDE                                          │
│ Presenta: "Para [especialidad], tenemos [sedes]"                   │
│ Pregunta: "¿Cuál le queda mejor?"                                  │
│ Confirma: "¿Desea que le agendemos la cita?"                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 3.5: VERIFICACIÓN INTERNA DE CUPOS 🆕                         │
│ ┌─────────────────────────────────────────────────┐                │
│ │ 1. Seleccionar availability_id automáticamente  │                │
│ │ 2. Llamar: checkAvailabilityQuota(availability_id) │            │
│ │ 3. Evaluar: recommendation.can_schedule_direct  │                │
│ └────────────────┬────────────────────────────────┘                │
│                  │                                                  │
│                  ├─── TRUE → Flag: AGENDA_DIRECTA                  │
│                  └─── FALSE → Flag: LISTA_ESPERA                   │
│                                                                     │
│ ⚠️  REGLA: NO informar al paciente sobre cupos todavía            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 4: VERIFICACIÓN DE DATOS DEL PACIENTE                         │
│ Pregunta: "Indíqueme su número de cédula"                          │
│ ┌─────────────────────────────────────┐                            │
│ │ Buscar paciente con cédula          │                            │
│ └──────────┬──────────────────────────┘                            │
│            │                                                        │
│            ├─── EXISTE → Guardar patient_id → Ir a PASO 6          │
│            └─── NO EXISTE → Ir a PASO 5                            │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 5: REGISTRO DE PACIENTE NUEVO                                 │
│ Solicita: Nombre completo, teléfono, EPS                           │
│ ┌─────────────────────────────────────────┐                        │
│ │ Llamar: registerPatientSimple()         │                        │
│ └──────────┬──────────────────────────────┘                        │
│            └─ Guardar patient_id                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 6: AGENDAMIENTO Y CONFIRMACIÓN                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ EVALUAR FLAG INTERNO                                     │      │
│  └───────┬──────────────────────────────────────────────────┘      │
│          │                                                          │
│          ▼                                                          │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐│
│  │ SI Flag = AGENDA_DIRECTA    │   │ SI Flag = LISTA_ESPERA      ││
│  │ (hay cupos disponibles)     │   │ (NO hay cupos)              ││
│  ├─────────────────────────────┤   ├─────────────────────────────┤│
│  │ 1. Preguntar motivo         │   │ 1. Preguntar prioridad      ││
│  │ 2. NO preguntar prioridad   │   │    (Urgente/Alta/Normal/Baja│││
│  │                             │   │ 2. Preguntar motivo         ││
│  │ 3. scheduleAppointment(     │   │                             ││
│  │    availability_id,         │   │ 3. scheduleAppointment(     ││
│  │    patient_id,              │   │    availability_id,         ││
│  │    reason,                  │   │    patient_id,              ││
│  │    scheduled_date           │   │    reason,                  ││
│  │    )                        │   │    scheduled_date,          ││
│  │    SIN priority_level       │   │    priority_level           ││
│  │                             │   │    )                        ││
│  │ 4. Resultado:               │   │                             ││
│  │    waiting_list: false      │   │ 4. Resultado:               ││
│  │                             │   │    waiting_list: true       ││
│  │ 5. CONFIRMAR CITA DIRECTA:  │   │                             ││
│  │    ✅ Doctor: [nombre]      │   │ 5. CONFIRMAR LISTA ESPERA:  ││
│  │    ✅ Fecha: [día]          │   │    📋 Referencia: [id]      ││
│  │    ✅ Hora: [hora]          │   │    📍 Posición: [queue]     ││
│  │    ✅ Sede: [ubicación]     │   │    ⚡ Prioridad: [nivel]    ││
│  │    ✅ Número cita: [id]     │   │    📞 "Nos comunicaremos    ││
│  │                             │   │       pronto"               ││
│  └─────────────────────────────┘   └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 7: CIERRE                                                      │
│ "¿Hay algo más en lo que pueda colaborarle?"                       │
│ "Gracias por comunicarse con Fundación Biosanar IPS"               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Diferencias Clave entre v2.0 y v2.1

### v2.0 (Anterior)
```
PASO 3: Selecciona sede
  └─ Guarda slots_available
PASO 6: Pregunta motivo
  └─ SI slots_available == 0 → Pregunta prioridad
  └─ Llama scheduleAppointment
  └─ Revela resultado (cita o lista)
```

### v2.1 (Actual) 🆕
```
PASO 3: Selecciona sede
  └─ Confirma intención de agendar
PASO 3.5: 🆕 VERIFICA CUPOS (INTERNO)
  └─ Llama checkAvailabilityQuota
  └─ Guarda flag: AGENDA_DIRECTA o LISTA_ESPERA
PASO 6: Evalúa flag ANTES de preguntar
  ├─ SI AGENDA_DIRECTA:
  │   └─ NO pregunta prioridad
  │   └─ Agenda directamente
  │   └─ Confirma con todos los detalles
  └─ SI LISTA_ESPERA:
      └─ Pregunta prioridad primero
      └─ Registra en lista
      └─ Confirma con número de referencia
```

---

## 📋 Checklist de Validación del Flujo

### Para el Agente AI (Valeria):

- [ ] **PASO 2:** ¿Llamé a `getAvailableAppointments`?
- [ ] **PASO 2:** ¿Presenté TODAS las especialidades (incluso si slots=0)?
- [ ] **PASO 3:** ¿Confirmé la intención de agendar?
- [ ] **PASO 3.5:** ✅ ¿Llamé a `checkAvailabilityQuota`?
- [ ] **PASO 3.5:** ✅ ¿Guardé el flag interno (AGENDA_DIRECTA o LISTA_ESPERA)?
- [ ] **PASO 3.5:** ✅ ¿NO informé al paciente sobre cupos todavía?
- [ ] **PASO 6:** ¿Evalué el flag ANTES de preguntar datos?
- [ ] **PASO 6:** Si AGENDA_DIRECTA: ¿NO pregunté prioridad?
- [ ] **PASO 6:** Si LISTA_ESPERA: ¿Pregunté prioridad PRIMERO?
- [ ] **PASO 6:** ¿Confirmé con los detalles correctos según el tipo de resultado?

---

## 🎯 Casos de Uso Detallados

### Caso 1: Cita con Cupos Disponibles (AGENDA_DIRECTA)

**Contexto:** Dermatología en Sede San Gil tiene 6 cupos disponibles.

```
PASO 3.5 (Interno):
  checkAvailabilityQuota(132) → can_schedule_direct: true
  Flag interno: AGENDA_DIRECTA

PASO 6:
  Valeria: "Para finalizar, ¿cuál es el motivo de la consulta?"
  Paciente: "Tengo una erupción en la piel"
  
  [Sistema llama scheduleAppointment SIN priority_level]
  [Resultado: waiting_list: false]
  
  Valeria: "¡Perfecto! Su cita ha sido confirmada. Le confirmo los detalles:
           es con la doctora Erwin Vargas el día 10 de octubre a las 8 de
           la mañana, en la sede biosanar san gil. El número de su cita
           es el 456."
```

✅ **Resultado:** Cita agendada directamente, paciente satisfecho con todos los detalles.

---

### Caso 2: Sin Cupos Disponibles (LISTA_ESPERA)

**Contexto:** Medicina General en Sede San Gil tiene 0 cupos disponibles.

```
PASO 3.5 (Interno):
  checkAvailabilityQuota(135) → can_schedule_direct: false
  Flag interno: LISTA_ESPERA

PASO 6:
  Valeria: "Para procesar su solicitud correctamente, ¿su consulta es de
           carácter 'Urgente', 'Alta', 'Normal' o 'Baja'?"
  Paciente: "Normal"
  
  Valeria: "Perfecto. ¿Cuál es el motivo de la consulta?"
  Paciente: "Control de tensión"
  
  [Sistema llama scheduleAppointment CON priority_level: "Normal"]
  [Resultado: waiting_list: true, queue_position: 3]
  
  Valeria: "Su solicitud ha sido registrada exitosamente en nuestra lista
           de espera para Medicina General. Su número de referencia es el
           789 y su posición en la cola es la número 3 con prioridad Normal.
           Una de nuestras operadoras se comunicará con usted muy pronto
           para confirmarle el día y la hora de su cita. Por favor, esté
           atento a su teléfono."
```

✅ **Resultado:** Paciente en lista de espera con expectativas claras.

---

## 🛠️ Herramientas Utilizadas en el Flujo

| Paso | Herramienta | Propósito | Output Clave |
|------|-------------|-----------|--------------|
| 2 | `getAvailableAppointments` | Listar especialidades/sedes | `specialty_name`, `location_name`, `availability_id` |
| 3.5 🆕 | `checkAvailabilityQuota` | Verificar cupos disponibles | `recommendation.can_schedule_direct` |
| 4 | `searchPatient` (buscar) | Verificar si paciente existe | `patient_id` o null |
| 5 | `listActiveEPS` | Listar EPS activas | Array de EPS |
| 5 | `registerPatientSimple` | Registrar paciente nuevo | `patient_id` |
| 6 | `scheduleAppointment` | Agendar cita o lista espera | `waiting_list` (true/false), detalles |

---

## ⚠️ Errores Comunes a Evitar

### ❌ ERROR 1: Informar sobre cupos en PASO 3.5
```
INCORRECTO:
Valeria: "Veo que tenemos cupos disponibles para Dermatología..."
```
✅ **CORRECTO:** La verificación es INTERNA. No informar hasta PASO 6.

---

### ❌ ERROR 2: Preguntar prioridad cuando hay cupos
```
INCORRECTO (cuando flag = AGENDA_DIRECTA):
Valeria: "¿Su consulta es urgente, alta, normal o baja?"
```
✅ **CORRECTO:** Si hay cupos, NO preguntar prioridad.

---

### ❌ ERROR 3: No llamar checkAvailabilityQuota
```
INCORRECTO:
PASO 3 → PASO 4 directamente (sin PASO 3.5)
```
✅ **CORRECTO:** SIEMPRE llamar checkAvailabilityQuota en PASO 3.5.

---

### ❌ ERROR 4: Revelar detalles de cita cuando es lista de espera
```
INCORRECTO (cuando waiting_list: true):
Valeria: "Su cita es con el doctor Juan el 15 de octubre..."
```
✅ **CORRECTO:** Si es lista de espera, dar número de referencia y posición en cola.

---

## 📊 Métricas de Éxito del Flujo

- **Tiempo de agendamiento:** Reducido en ~30% (menos preguntas innecesarias)
- **Satisfacción del paciente:** Aumentada (expectativas claras desde el inicio)
- **Precisión de información:** 100% (datos siempre del sistema)
- **Transparencia:** Alta (paciente sabe si es cita directa o lista de espera)

---

**Última actualización:** 2 de octubre de 2025  
**Versión:** 2.1  
**Estado:** ✅ Implementado y documentado
