# Sistema Biosanarcall - Resumen Completo v3.4

## 🆕 Novedades en v3.4

### Nueva Herramienta: checkAvailabilityQuota

**Fecha:** 2025-01-XX  
**Motivo:** Separar la lógica de verificación de cupos de la lógica de agendamiento para mejor arquitectura y flujo más claro.

**Cambios implementados:**

1. ✅ **Creada función `checkAvailabilityQuota`** (línea ~760, antes de scheduleAppointment)
   - Verifica cupos disponibles por día desde `availability_distribution`
   - Retorna información detallada: quota, assigned, available, can_schedule_direct
   - Sin efectos secundarios (solo lectura)

2. ✅ **Registrada en UNIFIED_TOOLS** (línea ~160)
   - Descripción completa para agentes AI
   - Schema con availability_id (requerido) y day_date (opcional)
   - Posicionada ANTES de scheduleAppointment en la lista

3. ✅ **Integrada en executeToolCall** (línea ~370)
   - Manejo de llamadas a la nueva herramienta
   - Retorna respuesta estructurada JSON

4. ✅ **Compilada y desplegada**
   - TypeScript compilado sin errores
   - PM2 reiniciado (15 restarts)
   - Tests exitosos con availability_id 132 (6 cupos) y 135 (0 cupos)

---

## 📊 Arquitectura del Sistema

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui + Radix UI + Tailwind CSS
- **Estado:** TanStack Query + React Hook Form + Zod
- **Rutas:** React Router 6 con ProtectedRoute

### Backend
- **Framework:** Node.js + Express + TypeScript
- **Base de datos:** MariaDB 10.11.13 (biosanar)
- **ORM:** MySQL2 con connection pooling
- **Auth:** JWT con middleware authenticateToken
- **Puerto:** 4000 (interno), https://biosanarcall.site/api (público)

### MCP Server (Unified)
- **Framework:** Node.js + Express + TypeScript
- **Puerto:** 8977 (interno), https://biosanarcall.site/mcp-unified (público)
- **Protocolo:** JSON-RPC 2.0
- **PM2:** mcp-unified (id 0), 15 restarts, online
- **Herramientas:** 8 totales

---

## 🛠️ Catálogo de Herramientas MCP v3.4

### 1. listActiveEPS
**Propósito:** Lista todas las EPS activas disponibles para registro de pacientes.  
**Input:** Ninguno  
**Output:** Array de EPS con id, name, code, status

---

### 2. registerPatientSimple
**Propósito:** Registro simplificado de pacientes con datos mínimos.  
**Input:**
- document (string, requerido)
- name (string, requerido)
- phone (string, requerido)
- insurance_eps_id (number, requerido)
- notes (string, opcional)

**Output:**
- patient_id (para usar en scheduleAppointment)
- Datos del paciente registrado

---

### 3. getAvailableAppointments
**Propósito:** Lista TODAS las agendas disponibles (con o sin cupos).  
**Cambio v3.3:** Removido filtro `HAVING SUM(ad.quota - ad.assigned) > 0`  
**Input:**
- doctor_id (number, opcional)
- specialty_id (number, opcional)
- location_id (number, opcional)
- limit (number, default: 50)

**Output:**
- Array de availabilities con:
  - availability_id
  - doctor_name, specialty_name, location_name
  - appointment_date, start_time, end_time
  - **slots_available** (puede ser 0)
  - waiting_list_count

**Regla crítica:** Retorna TODAS las especialidades/sedes, incluso si slots_available = 0

---

### 4. checkAvailabilityQuota 🆕
**Propósito:** Verificar cupos disponibles ANTES de agendar.  
**Versión:** 3.4  
**Input:**
- availability_id (number, requerido)
- day_date (string YYYY-MM-DD, opcional)

**Output:**
```json
{
  "success": true,
  "availability_id": 132,
  "quota_summary": {
    "total_quota": 10,
    "total_assigned": 4,
    "total_available": 6,
    "waiting_list_count": 3
  },
  "distributions": [...],
  "recommendation": {
    "can_schedule_direct": true,
    "should_use_waiting_list": false,
    "action": "Puede usar scheduleAppointment directamente",
    "message": "Hay 6 cupo(s) disponible(s)"
  }
}
```

**Uso en prompt:**
1. Llamar después de seleccionar availability_id
2. Evaluar `can_schedule_direct`:
   - Si true: NO preguntar prioridad, agendar directamente
   - Si false: Preguntar prioridad, agendar con priority_level
3. Llamar scheduleAppointment con o sin priority_level

---

### 5. scheduleAppointment
**Propósito:** Agendar cita (directa o lista de espera).  
**Cambio v2.1:** Cálculo de queue_position por specialty_id (no por availability_id)  
**Input:**
- patient_id (number, requerido)
- availability_id (number, requerido)
- scheduled_date (string YYYY-MM-DD HH:MM:SS, requerido)
- reason (string, requerido)
- appointment_type (enum: Presencial/Telemedicina, default: Presencial)
- notes (string, opcional)
- **priority_level** (enum: Baja/Normal/Alta/Urgente, requerido si no hay cupos)

**Output:**
- **waiting_list: false** → Cita directa asignada
  - appointment_id
  - scheduled_date, doctor, specialty, location
  - confirmation_number

- **waiting_list: true** → Agregado a lista de espera
  - waiting_list_id
  - queue_position (por specialty_id)
  - priority_level
  - estimated_wait_time

**Lógica interna:**
1. Verifica cupos en `availability_distribution`
2. Si available > 0:
   - Crea appointment en estado "Pendiente"
   - Incrementa `assigned` en distribution
   - Retorna `waiting_list: false`
3. Si available <= 0:
   - Crea registro en `appointments_waiting_list`
   - Calcula queue_position por specialty_id
   - Retorna `waiting_list: true`

---

### 6. getPatientAppointments
**Propósito:** Consulta todas las citas de un paciente.  
**Input:**
- patient_id (number, requerido)
- status (enum: Pendiente/Confirmada/Completada/Cancelada/Todas, default: Todas)
- from_date (string YYYY-MM-DD, opcional)

**Output:**
- Array de appointments con detalles completos

---

### 7. getWaitingListAppointments
**Propósito:** Consulta solicitudes en lista de espera.  
**Cambio v2.1:** Queue_position calculado por specialty_id  
**Input:**
- patient_id (number, opcional)
- doctor_id (number, opcional)
- specialty_id (number, opcional)
- location_id (number, opcional)
- priority_level (enum, default: Todas)
- status (enum: pending/reassigned/cancelled/expired/all, default: pending)
- limit (number, default: 50)

**Output:**
- Array de waiting_list_appointments con:
  - waiting_list_id
  - patient_name, specialty_name, doctor_name, location_name
  - **queue_position** (por specialty_id)
  - priority_level, days_waiting
  - status, can_be_reassigned

**Lógica de queue_position:**
```sql
ROW_NUMBER() OVER (
  PARTITION BY a.specialty_id 
  ORDER BY 
    CASE wl.priority_level
      WHEN 'Urgente' THEN 1
      WHEN 'Alta' THEN 2
      WHEN 'Normal' THEN 3
      WHEN 'Baja' THEN 4
    END,
    wl.created_at ASC
) AS queue_position
```

---

### 8. reassignWaitingListAppointments
**Propósito:** Procesar automáticamente lista de espera para availability específica.  
**Input:**
- availability_id (number, requerido)

**Output:**
- Array de reasignaciones exitosas
- Mueve de waiting_list a appointments
- Actualiza assigned en availability_distribution

---

## 🗂️ Tablas de Base de Datos Principales

### availabilities
```sql
id, doctor_id, specialty_id, location_id, date, start_time, end_time, 
duration_minutes, capacity, status (Activa/Inactiva)
```

### availability_distribution 🔑
```sql
id, availability_id (FK), day_date, quota, assigned, created_at
-- quota: Total de cupos configurados
-- assigned: Cupos ya asignados
-- available = quota - assigned
-- UNIQUE KEY (availability_id, day_date)
```

### appointments
```sql
id, patient_id, availability_id, scheduled_date, appointment_type,
status (Pendiente/Confirmada/Completada/Cancelada), reason, notes,
confirmation_number, created_at
```

### appointments_waiting_list
```sql
id, patient_id, availability_id, requested_date, status (pending/reassigned/cancelled/expired),
priority_level (Baja/Normal/Alta/Urgente), reason, notes, created_at, reassigned_at
```

---

## 📝 Flujo de Trabajo Actualizado (v3.4)

### PASO 1: Saludo e Inicio
- Valeria saluda y pregunta en qué puede ayudar
- Si menciona cita, inicia PASO 2 inmediatamente

### PASO 2: Consulta de Disponibilidad
1. Llama `getAvailableAppointments` SIN parámetros
2. Presenta TODAS las specialties disponibles (incluso si slots=0)
3. Pregunta: "¿Para cuál especialidad necesita la cita?"

### PASO 3: Selección de Sede
1. Filtra por specialty_name elegida
2. Presenta todas las location_name únicas
3. Pregunta: "¿En cuál sede le queda mejor?"
4. Selecciona internamente el availability_id
5. **GUARDA**: availability_id, doctor_name, appointment_date, start_time

### PASO 3.5: Verificación de Cupos 🆕
1. Llama `checkAvailabilityQuota(availability_id)`
2. Evalúa `can_schedule_direct`:
   - true: Guarda flag "agendar_directo"
   - false: Guarda flag "usar_lista_espera"
3. **NO INFORMES** al paciente todavía

### PASO 4: Verificación de Datos del Paciente
1. Solicita cédula
2. Normaliza cédula (4 pasos)
3. Busca paciente con herramienta de búsqueda
4. Si EXISTE: Guarda patient_id, ve a PASO 6
5. Si NO EXISTE: Ve a PASO 5

### PASO 5: Registro de Paciente Nuevo
1. Solicita: nombre completo, teléfono
2. Llama `listActiveEPS` y pregunta EPS
3. Confirma datos verbalmente
4. Llama `registerPatientSimple`
5. Guarda patient_id

### PASO 6: Agendamiento
**SI can_schedule_direct = true:**
1. Pregunta motivo de consulta
2. Llama `scheduleAppointment` SIN priority_level
3. Recibe respuesta con `waiting_list: false`
4. Confirma: "Su cita ha sido confirmada con el/la doctor/a [doctor_name] el día [fecha] a las [hora], en la sede [location_name]. Número de cita: [appointment_id]"

**SI can_schedule_direct = false:**
1. Pregunta prioridad (Urgente/Alta/Normal/Baja)
2. Pregunta motivo de consulta
3. Llama `scheduleAppointment` CON priority_level
4. Recibe respuesta con `waiting_list: true`
5. Confirma: "Ha sido agregado a la lista de espera para [especialidad] con prioridad [priority_level]. Su posición es la número [queue_position]. Le notificaremos cuando se libere un cupo. Número de referencia: [waiting_list_id]"

### PASO 7: Cierre
1. Pregunta: "¿Hay algo más en lo que pueda colaborarle?"
2. Despedida profesional

---

## 🧪 Testing y Validación

### Test 1: Verificar lista de herramientas
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | jq -r '.result.tools[].name'

# Resultado esperado:
# listActiveEPS
# registerPatientSimple
# getAvailableAppointments
# checkAvailabilityQuota ← 🆕
# scheduleAppointment
# getPatientAppointments
# getWaitingListAppointments
# reassignWaitingListAppointments
```

### Test 2: Verificar cupos disponibles
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"checkAvailabilityQuota","arguments":{"availability_id":132}}}' \
  | jq '.result.content[0].text | fromjson | .recommendation'

# Resultado esperado:
# {
#   "can_schedule_direct": true,
#   "should_use_waiting_list": false,
#   "action": "Puede usar scheduleAppointment directamente",
#   "message": "Hay 6 cupo(s) disponible(s)"
# }
```

### Test 3: Verificar agenda sin cupos
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"checkAvailabilityQuota","arguments":{"availability_id":135}}}' \
  | jq '.result.content[0].text | fromjson | .recommendation'

# Resultado esperado:
# {
#   "can_schedule_direct": false,
#   "should_use_waiting_list": true,
#   "action": "Debe usar scheduleAppointment con priority_level para lista de espera",
#   "message": "No hay cupos disponibles. Se agregará a lista de espera automáticamente."
# }
```

---

## 📚 Documentación Disponible

1. **CHECKAVAILABILITYQUOTA_TOOL.md** (🆕 v3.4)
   - Documentación completa de la nueva herramienta
   - Ejemplos de uso
   - Casos de uso detallados

2. **REFACTORIZACION_GETAVAILABLE_V3.3.md** (v3.3)
   - Cambios en getAvailableAppointments
   - Remoción de filtro HAVING

3. **RESUMEN_SISTEMA_COMPLETO_V3.4.md** (🆕 este archivo)
   - Resumen ejecutivo del sistema
   - Catálogo completo de herramientas

4. **newprompt.md** (v2.0, requiere actualización a v2.1)
   - Prompt de Valeria
   - Reglas críticas
   - Flujo de trabajo

---

## 🚀 Despliegue y Producción

### Backend
- **PM2:** cita-central-backend (id 1), 29 restarts
- **Puerto:** 4000
- **Logs:** `pm2 logs cita-central-backend`

### MCP Server
- **PM2:** mcp-unified (id 0), 15 restarts
- **Puerto:** 8977
- **Logs:** `pm2 logs mcp-unified`
- **Compilación:** `cd /home/ubuntu/app/mcp-server-node && npm run build`
- **Reinicio:** `pm2 restart mcp-unified`

### Base de Datos
- **Sistema:** MariaDB 10.11.13
- **Database:** biosanar
- **User:** biosanar_user
- **Pass:** /6Tx0eXqFQONTFuoc7aqPicNlPhmuINU
- **Puerto:** 3306

---

## 🔧 Comandos Útiles

### Compilar TypeScript
```bash
cd /home/ubuntu/app/mcp-server-node && npm run build
```

### Reiniciar MCP Server
```bash
pm2 restart mcp-unified
```

### Ver logs
```bash
pm2 logs mcp-unified --lines 100
```

### Verificar estado
```bash
pm2 status
```

### Test de conectividad
```bash
curl http://localhost:8977/health
```

---

## 📊 Estadísticas del Sistema

- **Herramientas MCP:** 8 totales (7 originales + 1 nueva)
- **Líneas de código:** ~3,200 (server-unified.ts)
- **Tablas principales:** 12+ (patients, doctors, specialties, locations, availabilities, availability_distribution, appointments, appointments_waiting_list, eps, etc.)
- **Endpoints públicos:**
  - https://biosanarcall.site/api (Backend)
  - https://biosanarcall.site/mcp-unified (MCP Server)

---

## ⚠️ Notas Importantes

1. **checkAvailabilityQuota es de solo lectura**: No modifica datos, solo consulta.

2. **Llamar ANTES de scheduleAppointment**: Permite tomar decisiones informadas sobre si preguntar prioridad.

3. **getAvailableAppointments retorna TODO**: Incluso agendas con slots_available=0. El filtrado es responsabilidad del prompt.

4. **queue_position por specialty_id**: El orden en lista de espera se calcula por especialidad, no por availability específica.

5. **priority_level REQUERIDO en lista de espera**: Si no hay cupos, scheduleAppointment requiere priority_level.

---

## 🔗 Enlaces Útiles

- **Prompt actual:** `/home/ubuntu/app/mcp-server-node/newprompt.md`
- **Server code:** `/home/ubuntu/app/mcp-server-node/src/server-unified.ts`
- **Docs folder:** `/home/ubuntu/app/mcp-server-node/docs/`
- **PM2 ecosystem:** `/home/ubuntu/app/mcp-server-node/ecosystem.config.js`

---

**Última actualización:** 2025-01-XX  
**Versión:** 3.4  
**Autor:** Sistema Biosanarcall  
**Estado:** ✅ Compilado, desplegado y testeado
