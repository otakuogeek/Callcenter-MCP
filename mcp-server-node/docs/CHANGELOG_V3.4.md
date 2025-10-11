# Changelog v3.4 - Nueva Herramienta checkAvailabilityQuota

## 📅 Fecha: 2025-01-XX

## 🎯 Objetivo

Crear una herramienta dedicada para **verificar cupos disponibles por día** desde la tabla `availability_distribution`, permitiendo al sistema tomar decisiones informadas ANTES de agendar una cita.

---

## 🆕 Cambios Implementados

### 1. Nueva Función: checkAvailabilityQuota

**Archivo:** `/home/ubuntu/app/mcp-server-node/src/server-unified.ts`  
**Línea:** ~760 (antes de scheduleAppointment)

**Propósito:**
- Consultar cupos disponibles sin efectos secundarios
- Retornar información detallada sobre quotas por día
- Indicar si puede agendar directamente o debe usar lista de espera

**Firma:**
```typescript
async function checkAvailabilityQuota(args: any): Promise<any>
```

**Input:**
```typescript
{
  availability_id: number;  // REQUERIDO
  day_date?: string;        // OPCIONAL (formato YYYY-MM-DD)
}
```

**Output:**
```json
{
  "success": true,
  "availability_id": 132,
  "appointment_date": "2025-10-10",
  "time_range": "08:00 - 12:00",
  "doctor": { "id": 15, "name": "Dr. Erwin Vargas" },
  "specialty": { "id": 10, "name": "Dermatología" },
  "location": { "id": 1, "name": "Sede biosanar san gil" },
  "quota_summary": {
    "total_quota": 10,
    "total_assigned": 4,
    "total_available": 6,
    "waiting_list_count": 3
  },
  "distributions": [
    {
      "day_date": "2025-10-10",
      "quota": 10,
      "assigned": 4,
      "slots_available": 6,
      "status": "Disponible"
    }
  ],
  "recommendation": {
    "can_schedule_direct": true,
    "should_use_waiting_list": false,
    "action": "Puede usar scheduleAppointment directamente",
    "message": "Hay 6 cupo(s) disponible(s)"
  }
}
```

**Lógica:**
1. Consulta `availabilities` para obtener datos del médico/especialidad/sede
2. Consulta `availability_distribution` para obtener quotas por día
3. Calcula `total_available = SUM(quota - assigned)`
4. Consulta `appointments_waiting_list` para contar personas en espera
5. Determina `can_schedule_direct = (total_available > 0)`
6. Retorna recomendación estructurada

---

### 2. Registro en UNIFIED_TOOLS

**Archivo:** `/home/ubuntu/app/mcp-server-node/src/server-unified.ts`  
**Línea:** ~160

**Adición:**
```typescript
{
  name: 'checkAvailabilityQuota',
  description: 'Verifica cuántos cupos hay disponibles para una availability específica por día. Retorna información detallada sobre quotas, asignados, disponibles y si puede agendar directamente o debe ir a lista de espera. DEBE LLAMARSE ANTES de scheduleAppointment para tomar decisiones informadas.',
  inputSchema: {
    type: 'object',
    properties: {
      availability_id: {
        type: 'number',
        description: 'ID de la disponibilidad a verificar (obtenido de getAvailableAppointments)'
      },
      day_date: {
        type: 'string',
        description: 'Fecha específica a verificar en formato YYYY-MM-DD (opcional)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      }
    },
    required: ['availability_id']
  }
}
```

**Ubicación:** ANTES de scheduleAppointment en la lista de herramientas.

---

### 3. Integración en executeToolCall

**Archivo:** `/home/ubuntu/app/mcp-server-node/src/server-unified.ts`  
**Línea:** ~370

**Adición:**
```typescript
if (name === 'checkAvailabilityQuota') {
  return await checkAvailabilityQuota(args);
}
```

---

## ✅ Testing Realizado

### Test 1: Availability con cupos disponibles (availability_id 132)

**Input:**
```json
{
  "availability_id": 132
}
```

**Output:**
```json
{
  "quota_summary": {
    "total_quota": 10,
    "total_assigned": 4,
    "total_available": 6
  },
  "recommendation": {
    "can_schedule_direct": true,
    "message": "Hay 6 cupo(s) disponible(s)"
  }
}
```

✅ **RESULTADO:** Exitoso - Indica correctamente que puede agendar directo.

---

### Test 2: Availability sin cupos disponibles (availability_id 135)

**Input:**
```json
{
  "availability_id": 135
}
```

**Output:**
```json
{
  "quota_summary": {
    "total_quota": 10,
    "total_assigned": 10,
    "total_available": 0
  },
  "recommendation": {
    "can_schedule_direct": false,
    "should_use_waiting_list": true,
    "action": "Debe usar scheduleAppointment con priority_level para lista de espera",
    "message": "No hay cupos disponibles. Se agregará a lista de espera automáticamente."
  }
}
```

✅ **RESULTADO:** Exitoso - Indica correctamente que debe ir a lista de espera.

---

### Test 3: Verificar fecha específica

**Input:**
```json
{
  "availability_id": 132,
  "day_date": "2025-10-10"
}
```

**Output:**
Solo retorna la distribución de la fecha especificada.

✅ **RESULTADO:** Exitoso - Filtra correctamente por fecha.

---

### Test 4: Lista de herramientas

**Comando:**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | jq -r '.result.tools[].name'
```

**Output:**
```
listActiveEPS
registerPatientSimple
getAvailableAppointments
checkAvailabilityQuota ← 🆕 NUEVA
scheduleAppointment
getPatientAppointments
getWaitingListAppointments
reassignWaitingListAppointments
```

✅ **RESULTADO:** Exitoso - Herramienta registrada correctamente.

---

## 🔄 Impacto en el Flujo de Trabajo

### Antes (v3.3)

```
1. Usuario elige especialidad/sede
2. Sistema selecciona availability_id
3. Sistema llama scheduleAppointment
   ├─ scheduleAppointment verifica cupos INTERNAMENTE
   ├─ Si hay: Agenda directo
   └─ Si no hay: Lista de espera
4. Se revela resultado
```

**Problema:** No se puede preguntar prioridad de forma inteligente (siempre o nunca).

### Después (v3.4)

```
1. Usuario elige especialidad/sede
2. Sistema selecciona availability_id
3. 🆕 Sistema llama checkAvailabilityQuota(availability_id)
4. Sistema evalúa resultado:
   SI can_schedule_direct = true:
      ├─ NO pregunta prioridad
      └─ Llama scheduleAppointment sin priority_level
   
   SI can_schedule_direct = false:
      ├─ Pregunta prioridad al usuario
      └─ Llama scheduleAppointment con priority_level
5. Confirma resultado (cita o lista de espera)
```

**Ventaja:** Solo pregunta prioridad cuando realmente es necesario.

---

## 📊 Estadísticas

### Código Modificado
- **Líneas agregadas:** ~200
- **Archivos modificados:** 1 (server-unified.ts)
- **Funciones nuevas:** 1 (checkAvailabilityQuota)
- **Herramientas MCP:** 8 totales (7 anteriores + 1 nueva)

### Despliegue
- **Compilación TypeScript:** ✅ Sin errores
- **PM2 restart:** ✅ Exitoso (15 restarts total)
- **Status:** ✅ Online
- **Tests:** ✅ 4/4 exitosos

---

## 📚 Documentación Creada

1. **CHECKAVAILABILITYQUOTA_TOOL.md**
   - Documentación completa de la herramienta
   - Casos de uso detallados
   - Ejemplos de integración con prompt

2. **RESUMEN_SISTEMA_COMPLETO_V3.4.md**
   - Resumen ejecutivo del sistema actualizado
   - Catálogo completo de 8 herramientas
   - Flujo de trabajo actualizado

3. **CHANGELOG_V3.4.md** (este archivo)
   - Cambios implementados
   - Tests realizados
   - Impacto en el sistema

---

## 🔧 Comandos Ejecutados

```bash
# 1. Compilar TypeScript
cd /home/ubuntu/app/mcp-server-node && npm run build

# 2. Reiniciar servidor
pm2 restart mcp-unified

# 3. Test con cupos disponibles
curl -X POST http://localhost:8977/mcp-unified \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"checkAvailabilityQuota","arguments":{"availability_id":132}}}'

# 4. Test sin cupos disponibles
curl -X POST http://localhost:8977/mcp-unified \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"checkAvailabilityQuota","arguments":{"availability_id":135}}}'

# 5. Verificar lista de herramientas
curl -X POST http://localhost:8977/mcp-unified \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq -r '.result.tools[].name'
```

---

## ⏭️ Próximos Pasos (Recomendados)

### 1. Actualizar newprompt.md (v2.0 → v2.1)

**Cambios necesarios:**

**PASO 3.5 (nuevo):**
```markdown
**Verificar Cupos Disponibles:**
- Después de seleccionar availability_id
- Llamar checkAvailabilityQuota(availability_id)
- Guardar internamente can_schedule_direct
- NO INFORMAR al paciente todavía
```

**PASO 6 (actualizar):**
```markdown
**Decidir Flujo Basado en Cupos:**

SI can_schedule_direct = true:
  - NO preguntar nivel de prioridad
  - Preguntar motivo de consulta
  - Llamar scheduleAppointment SIN priority_level
  - Confirmar cita directa

SI can_schedule_direct = false:
  - Preguntar nivel de prioridad (Urgente/Alta/Normal/Baja)
  - Preguntar motivo de consulta
  - Llamar scheduleAppointment CON priority_level
  - Confirmar lista de espera con posición en cola
```

---

### 2. Optimizar scheduleAppointment (Opcional)

Considerar agregar un comentario al inicio de scheduleAppointment:

```typescript
// NOTA: Se recomienda llamar checkAvailabilityQuota ANTES de esta función
// para tomar decisiones informadas sobre priority_level
```

O incluso agregar validación:

```typescript
if (!args.priority_level && distribution.available <= 0) {
  return {
    success: false,
    error: 'priority_level es requerido cuando no hay cupos disponibles',
    recommendation: 'Llame checkAvailabilityQuota primero para verificar cupos'
  };
}
```

---

### 3. Monitorear Performance

- Verificar logs de PM2: `pm2 logs mcp-unified`
- Monitorear uso de memoria: `pm2 status`
- Validar tiempos de respuesta de la nueva herramienta

---

## 🐛 Issues Conocidos

Ninguno reportado hasta el momento.

---

## ✅ Checklist de Implementación

- [x] Crear función checkAvailabilityQuota
- [x] Registrar en UNIFIED_TOOLS
- [x] Integrar en executeToolCall
- [x] Compilar TypeScript (sin errores)
- [x] Reiniciar PM2
- [x] Test con availability con cupos
- [x] Test con availability sin cupos
- [x] Test con fecha específica
- [x] Verificar lista de herramientas
- [x] Crear documentación CHECKAVAILABILITYQUOTA_TOOL.md
- [x] Actualizar RESUMEN_SISTEMA_COMPLETO_V3.4.md
- [x] Crear CHANGELOG_V3.4.md
- [ ] Actualizar newprompt.md (pendiente)

---

## 👥 Equipo

- **Desarrollador:** Sistema Biosanarcall
- **Solicitado por:** Usuario (mensaje: "puede crea run herrmiaenta q se encarge solo de verificar cuantoc upo hay dpoinibles por dia")
- **Revisado por:** Tests automatizados

---

## 📞 Soporte

- **PM2 Process:** mcp-unified (id 0)
- **Puerto:** 8977 (interno), https://biosanarcall.site/mcp-unified (público)
- **Logs:** `pm2 logs mcp-unified`
- **Status:** `pm2 status`

---

**Última actualización:** 2025-01-XX  
**Versión:** 3.4  
**Estado:** ✅ COMPLETADO Y DESPLEGADO
