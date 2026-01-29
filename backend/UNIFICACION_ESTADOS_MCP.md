# 🔄 Unificación Sistema de Estados + Flujo MCP

## 📋 Problema Resuelto

**Situación:** El sistema de estados implementado estaba interfiriendo con el flujo natural de las herramientas MCP, causando que se perdiera el contexto de las herramientas de búsqueda y otros pasos del flujo original.

**Solución:** Integración transparente donde el sistema de estados **NO controla** el flujo, solo lo **monitorea** y proporciona **recuperación de errores**.

---

## 🎯 Principios de la Unificación

### 1. **Estados como Tracking, No como Control**

**Antes (Problema):**
```typescript
// Estado bloqueaba el flujo
if (currentState !== AWAITING_DOCUMENT) {
  return "Error: Estado incorrecto"; // ❌ Bloqueaba herramientas
}
```

**Ahora (Solución):**
```typescript
// Estado solo observa y registra
updateState(phone, AWAITING_PHONE_CONFIRMATION, { patientId: 123 });
// ✅ El flujo MCP continúa normalmente
```

### 2. **Herramientas MCP Controlan el Flujo**

El prompt original del MCP (`promt.md`) define el flujo completo:
- PASO 1: Verificación de horario
- PASO 2: Bienvenida y solicitud de documento
- PASO 3: Búsqueda (`searchPatient`)
- PASO 4: Gestión del resultado
  - CASO A: Paciente encontrado → `cancelarCitasVencidas` → `getPatientAppointments` → `actualizarPhone`
  - CASO B: Paciente no encontrado → `registerPatientSimple`
- PASO 5: Ecografías → `searchCups` / `searchCupsByName`
- PASO 6: Agendamiento → `checkAvailabilityQuota` → `getAvailableTimeSlots` → `scheduleAppointment`

**El sistema de estados NO interrumpe este flujo.**

### 3. **Contexto Completo en Mensajes**

```typescript
// CRÍTICO: Agregar resultado COMPLETO al contexto
context.messages.push({
  role: 'system',
  content: `[Resultado de ${toolCall.name}]: ${JSON.stringify(toolResult, null, 2)}`
});
```

Esto asegura que el modelo AI **siempre ve** los resultados de las herramientas y puede continuar el flujo correctamente.

---

## 🔧 Implementación Técnica

### Actualizaciones de Estado (Transparentes)

Cada herramienta actualiza el estado **sin bloquear**:

```typescript
// searchPatient - Paciente encontrado
if (toolResult.success && toolResult.data?.found) {
  updateState(cleanPhone, ConversationState.AWAITING_PHONE_CONFIRMATION, {
    patientId: toolResult.data.patient?.id,
    patientName: toolResult.data.patient?.full_name,
    patientDocument: toolCall.args.document
  });
  console.log(`[WhatsAppAI] ✓ Paciente encontrado: ${name} (ID: ${id})`);
}

// registerPatientSimple - Paciente registrado
updateState(cleanPhone, ConversationState.AWAITING_SPECIALTY, {
  patientId: toolResult.data?.id,
  patientName: toolCall.args.name
});
console.log(`[WhatsAppAI] ✓ Paciente registrado`);

// checkAvailabilityQuota - Cupos verificados
const canSchedule = toolResult.data?.can_schedule;
console.log(`[WhatsAppAI] ✓ Cupos: ${canSchedule ? 'Disponibles' : 'No disponibles'}`);
if (canSchedule) {
  updateState(cleanPhone, ConversationState.AWAITING_TIME);
}

// scheduleAppointment - Cita agendada
if (toolResult.data?.waiting_list) {
  console.log(`[WhatsAppAI] ✓ Lista de espera: Posición ${queue_position}`);
  updateState(cleanPhone, ConversationState.COMPLETED);
} else {
  console.log(`[WhatsAppAI] ✓ Cita agendada: ID ${appointment_id}`);
  updateState(cleanPhone, ConversationState.COMPLETED);
}

// Auto-reset después de 5 segundos
setTimeout(() => resetState(cleanPhone), 5000);
```

### Logging Mejorado

```typescript
console.log(
  `[WhatsAppAI] ✅ Procesamiento exitoso\n` +
  `  ⏱ Duración: ${duration}ms\n` +
  `  📊 Estado: ${currentState.currentState}\n` +
  `  🔧 Herramientas: ${toolsExecuted}\n` +
  `  🔄 Reintentos: ${retryCount}/3\n` +
  `  📝 Última herramienta: ${lastSuccessfulTool}`
);
```

**Salida ejemplo:**
```
[WhatsAppAI] ✅ Procesamiento exitoso
  ⏱ Duración: 1245ms
  📊 Estado: completed
  🔧 Herramientas: searchPatient, getPatientAppointments, checkAvailabilityQuota, getAvailableTimeSlots, scheduleAppointment
  🔄 Reintentos: 0/3
  📝 Última herramienta: scheduleAppointment
```

---

## 📊 Flujo Completo Unificado

```
┌────────────────────────────────────────────────────────────────┐
│                    MENSAJE DE WHATSAPP                         │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  PASO 1: Verificar estado de errores                           │
│  ├─ shouldResetDueToErrors? → Reset automático                 │
│  └─ Verificar timeout (>30min) → Expirado                      │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  PASO 2: Detectar saludos                                      │
│  ├─ "Hola", "Buenas", etc. → Reset + AWAITING_DOCUMENT         │
│  └─ No es saludo → Continuar                                   │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  PASO 3: Generar respuesta AI                                  │
│  ├─ System prompt con flujo MCP completo                       │
│  ├─ Historial de mensajes (últimos 15)                         │
│  └─ Contexto de herramientas previas                           │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  PASO 4: Parsear tool calls                                    │
│  └─ [TOOL:searchPatient:{"document":"17265900"}]               │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  PASO 5: Ejecutar herramientas (loop hasta 5 iteraciones)      │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  searchPatient                                           │ │
│  │  ├─ Ejecutar → Resultado completo                        │ │
│  │  ├─ Actualizar estado → AWAITING_PHONE_CONFIRMATION      │ │
│  │  ├─ Agregar a context.messages                           │ │
│  │  └─ Log: "✓ Paciente encontrado: Dave Bastidas"         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  getPatientAppointments                                  │ │
│  │  ├─ Ejecutar → Resultado completo                        │ │
│  │  ├─ Mantener estado actual                               │ │
│  │  ├─ Agregar a context.messages                           │ │
│  │  └─ Log: "✓ Citas consultadas"                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  checkAvailabilityQuota                                  │ │
│  │  ├─ Ejecutar → can_schedule: true                        │ │
│  │  ├─ Actualizar estado → AWAITING_TIME                    │ │
│  │  ├─ Agregar a context.messages                           │ │
│  │  └─ Log: "✓ Cupos: Disponibles"                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  getAvailableTimeSlots                                   │ │
│  │  ├─ Ejecutar → Lista de horarios                         │ │
│  │  ├─ Guardar en stateContext.timeSlots                    │ │
│  │  ├─ Agregar a context.messages                           │ │
│  │  └─ Log: "✓ Horarios: 5 disponibles"                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  scheduleAppointment                                     │ │
│  │  ├─ Ejecutar → appointment_id: 12345                     │ │
│  │  ├─ Actualizar estado → COMPLETED                        │ │
│  │  ├─ Agregar a context.messages                           │ │
│  │  ├─ Log: "✓ Cita agendada: ID 12345"                    │ │
│  │  └─ setTimeout → Reset automático (5s)                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Si hay más tool calls → Generar nueva respuesta AI           │
│  Repetir hasta 5 iteraciones o sin más tool calls             │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  PASO 6: Validar respuesta                                     │
│  ├─ Respuesta vacía? → getRecoveryMessage()                    │
│  ├─ Respuesta muy corta? → incrementRetry()                    │
│  └─ Respuesta OK → Continuar                                   │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  PASO 7: Logging detallado                                     │
│  ✅ Procesamiento exitoso                                      │
│  ⏱ Duración: 1245ms                                            │
│  📊 Estado: completed                                          │
│  🔧 Herramientas: searchPatient, scheduleAppointment...        │
│  🔄 Reintentos: 0/3                                             │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                    RESPUESTA AL USUARIO                        │
│  "¡Listo! Tu cita ha sido confirmada..."                       │
└────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Mecanismos de Protección (Sin Interferir)

### 1. Retry Limiting (3 intentos)
```typescript
if (shouldResetDueToErrors(cleanPhone)) {
  resetState(cleanPhone);
  return { response: "Empecemos de nuevo..." };
}
```

### 2. Timeout Automático (30 minutos)
```typescript
const STATE_TIMEOUT = 1800000; // 30 minutos
// Cleanup automático cada 10 minutos
setInterval(cleanupOldStates, 600000);
```

### 3. Mensajes de Recuperación Contextuales
```typescript
const recoveryMessage = getRecoveryMessage(cleanPhone);
// Según el estado actual:
// - AWAITING_DOCUMENT: "No entendí tu documento..."
// - AWAITING_TIME: "Estos son los horarios disponibles..."
```

---

## ✅ Verificación de Funcionalidad

### Flujo Completo Funcional

```
Usuario: "Hola"
Estado: IDLE → AWAITING_DOCUMENT
AI: "¿Cuál es tu número de documento?"

Usuario: "17265900"
Herramienta: searchPatient → Paciente encontrado (Dave Bastidas)
Estado: AWAITING_DOCUMENT → AWAITING_PHONE_CONFIRMATION
AI: "Hola Dave. ¿Tu teléfono sigue siendo 04129578254?"

Usuario: "Sí"
Herramienta: getPatientAppointments → Sin citas activas
Estado: AWAITING_PHONE_CONFIRMATION → (mantiene)
AI: "¿Para qué especialidad necesitas la cita?"

Usuario: "Odontología"
Herramienta: getAvailableAppointments → Disponible
Estado: → AWAITING_SPECIALTY
AI: "Tengo disponibilidad el 22 de enero..."

Usuario: "22 de enero"
Herramienta: checkAvailabilityQuota → can_schedule: true
Estado: → AWAITING_TIME
Herramienta: getAvailableTimeSlots → [9:00 AM, 10:30 AM, 3:45 PM]
AI: "Horarios: 1. 9:00 AM, 2. 10:30 AM, 3. 3:45 PM..."

Usuario: "tarde"
Interpretación inteligente: Selecciona 3:45 PM automáticamente
AI: "Te agendo para las 3:45 PM. ¿Motivo?"

Usuario: "limpieza dental"
Herramienta: scheduleAppointment → appointment_id: 12345
Estado: → COMPLETED
AI: "¡Listo! Cita #12345 confirmada para el 22 de enero a las 3:45 PM..."

(5 segundos después)
Estado: COMPLETED → IDLE (reset automático)
```

### Herramientas Ejecutadas en Orden

✓ `searchPatient` → Encuentra paciente
✓ `getPatientAppointments` → Consulta citas existentes
✓ `getAvailableAppointments` → Busca disponibilidad
✓ `checkAvailabilityQuota` → Verifica cupos
✓ `getAvailableTimeSlots` → Obtiene horarios
✓ `scheduleAppointment` → Agenda cita

**Todos los resultados se agregan al contexto del AI** → El modelo mantiene el contexto completo.

---

## 📈 Mejoras vs Versión Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Control de flujo** | ❌ Estados bloqueaban | ✅ Estados solo observan |
| **Contexto MCP** | ⚠️ Se perdía | ✅ Siempre completo |
| **Herramientas** | ⚠️ Se interrumpían | ✅ Flujo natural |
| **Logging** | 😐 Básico | ✅ Detallado con emojis |
| **Recuperación** | ✅ Funcional | ✅ Mejorada |
| **Timeout** | ✅ 30 min | ✅ 30 min |
| **Retry limit** | ✅ 3 intentos | ✅ 3 intentos |
| **Reset automático** | ✅ En saludos | ✅ En saludos + completado |

---

## 🎯 Casos de Uso Validados

### ✅ Caso 1: Búsqueda de Paciente
- `searchPatient` ejecuta correctamente
- Resultado completo se agrega al contexto
- AI recibe todos los datos (nombre, teléfono, EPS, etc.)
- Estado se actualiza sin bloquear

### ✅ Caso 2: Registro de Nuevo Paciente
- Flujo secuencial: nombre → teléfono → verificación → fecha → género → EPS
- Cada herramienta mantiene el contexto
- `registerPatientSimple` recibe todos los datos
- Estado se actualiza al completar

### ✅ Caso 3: Verificación de Cupos
- `checkAvailabilityQuota` ejecuta antes de `getAvailableTimeSlots`
- Si can_schedule = false → Lista de espera
- Si can_schedule = true → Muestra horarios
- Contexto preservado entre herramientas

### ✅ Caso 4: Agendamiento Completo
- Todas las herramientas del flujo se ejecutan en orden
- Cada resultado alimenta la siguiente herramienta
- `scheduleAppointment` recibe: patient_id, availability_id, scheduled_date, reason
- SMS de confirmación se envía automáticamente

### ✅ Caso 5: Lista de Espera
- Cuando no hay cupos, `scheduleAppointment` detecta automáticamente
- Agrega a `appointments_waiting_list`
- SMS de lista de espera se envía
- Estado se marca como completado

---

## 🔧 Archivos Modificados

1. **`/backend/src/services/WhatsAppAIService.ts`**
   - Sistema de estados integrado (líneas 1-30)
   - Procesamiento transparente de herramientas (líneas 550-650)
   - Logging mejorado (líneas 680-700)

2. **`/backend/src/services/WhatsAppStateManager.ts`** (existente)
   - Sin cambios necesarios
   - Funciona correctamente como está

---

## 📝 Conclusión

El sistema ahora tiene **lo mejor de ambos mundos**:

✅ **Flujo MCP Original:** Todas las herramientas funcionan en el orden correcto
✅ **Sistema de Estados:** Monitorea y proporciona recuperación de errores
✅ **Contexto Preservado:** El AI siempre ve los resultados completos
✅ **Logging Detallado:** Fácil debugging y monitoreo
✅ **Sin Interferencias:** Estados no bloquean el flujo natural

**Resultado:** Sistema robusto, mantenible y con todas las funcionalidades del MCP intactas.

---

**Fecha:** 14 de Enero, 2026  
**Versión:** 2.0 (Unificada)  
**Estado:** ✅ Producción  
**Reinicio Backend:** PM2 restart #5
