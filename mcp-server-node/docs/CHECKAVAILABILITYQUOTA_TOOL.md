# checkAvailabilityQuota Tool - Documentación Completa

## 📋 Resumen Ejecutivo

La herramienta `checkAvailabilityQuota` permite **verificar cuántos cupos hay disponibles** para una availability específica **antes de intentar agendar una cita**. Esta herramienta es crítica para tomar decisiones informadas sobre si:

1. **Agendar directamente** → Si hay cupos disponibles (`can_schedule_direct: true`)
2. **Ir a lista de espera** → Si no hay cupos (`should_use_waiting_list: true`)

## 🎯 Propósito y Contexto

### ¿Por qué se creó esta herramienta?

Anteriormente, la lógica de verificación de cupos estaba **embebida dentro de `scheduleAppointment`**, lo que significaba que:

- No se podía verificar disponibilidad sin iniciar una transacción de agendamiento
- El prompt de Valeria no podía tomar decisiones informadas antes de agendar
- No se podía preguntar al paciente sobre prioridad solo cuando era necesario

### Beneficios de la separación

✅ **Mejor arquitectura**: Separación de responsabilidades (verificar vs agendar)  
✅ **Flujo más claro**: El prompt puede verificar cupos → Decidir si pedir prioridad → Agendar  
✅ **Mejor experiencia**: Solo se pregunta prioridad cuando realmente no hay cupos  
✅ **Más testeable**: Se puede verificar disponibilidad sin efectos secundarios

## 📊 Estructura de Datos

### Input Parameters

```typescript
{
  availability_id: number;  // REQUERIDO - ID de la availability a verificar
  day_date?: string;        // OPCIONAL - Fecha específica en formato YYYY-MM-DD
}
```

### Output Structure

```json
{
  "success": true,
  "availability_id": 132,
  "appointment_date": "2025-10-10T00:00:00.000Z",
  "time_range": "08:00 - 12:00",
  
  "doctor": {
    "id": 15,
    "name": "Dr. Erwin Alirio Vargas Ariza"
  },
  
  "specialty": {
    "id": 10,
    "name": "Dermatología"
  },
  
  "location": {
    "id": 1,
    "name": "Sede biosanar san gil"
  },
  
  "quota_summary": {
    "total_quota": 10,         // Total de cupos configurados
    "total_assigned": 4,       // Cupos ya asignados
    "total_available": 6,      // Cupos disponibles (quota - assigned)
    "waiting_list_count": 3    // Personas en lista de espera
  },
  
  "distributions": [
    {
      "day_date": "2025-10-10T00:00:00.000Z",
      "quota": 10,
      "assigned": 4,
      "slots_available": 6,
      "status": "Disponible"    // "Disponible" o "Lleno"
    }
  ],
  
  "recommendation": {
    "can_schedule_direct": true,                               // ✅ Puede agendar directamente
    "should_use_waiting_list": false,                          // ❌ No necesita lista de espera
    "action": "Puede usar scheduleAppointment directamente",   // Acción recomendada
    "message": "Hay 6 cupo(s) disponible(s)"                   // Mensaje informativo
  }
}
```

## 🔍 Casos de Uso

### Caso 1: Hay cupos disponibles

**Input:**
```json
{
  "availability_id": 132
}
```

**Output clave:**
```json
{
  "quota_summary": {
    "total_available": 6
  },
  "recommendation": {
    "can_schedule_direct": true,
    "should_use_waiting_list": false,
    "action": "Puede usar scheduleAppointment directamente",
    "message": "Hay 6 cupo(s) disponible(s)"
  }
}
```

**Acción en el prompt:**
- ✅ NO preguntar nivel de prioridad
- ✅ Llamar `scheduleAppointment` directamente
- ✅ Informar al paciente que la cita se agendará

---

### Caso 2: NO hay cupos disponibles

**Input:**
```json
{
  "availability_id": 135
}
```

**Output clave:**
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

**Acción en el prompt:**
- ✅ Preguntar nivel de prioridad al paciente
- ✅ Llamar `scheduleAppointment` con `priority_level` (Urgente/Alta/Normal/Baja)
- ✅ Informar que será agregado a lista de espera

---

### Caso 3: Verificar fecha específica

**Input:**
```json
{
  "availability_id": 132,
  "day_date": "2025-10-10"
}
```

**Output:**
Solo retorna la distribución de esa fecha específica (en lugar de todas las fechas).

---

### Caso 4: No hay distribución configurada

**Output:**
```json
{
  "success": false,
  "error": "No hay distribución de cupos configurada para esta availability",
  "availability_info": {
    "availability_id": 999,
    "doctor": "Dr. Juan Pérez",
    "specialty": "Cardiología",
    "location": "Sede Principal"
  },
  "suggestion": "Contacte al administrador para configurar la distribución de cupos"
}
```

## 🔄 Flujo de Integración con el Prompt

### Flujo Original (SIN checkAvailabilityQuota)

```
1. Paciente elige especialidad/sede
2. Sistema llama scheduleAppointment
3. scheduleAppointment verifica cupos INTERNAMENTE
   ├─ Si hay cupos → Agenda
   └─ Si NO hay cupos → Lista de espera
4. Se revela resultado al paciente
```

**Problema:** No se puede preguntar prioridad de forma inteligente.

---

### Flujo Mejorado (CON checkAvailabilityQuota)

```
1. Paciente elige especialidad/sede
2. Sistema obtiene availability_id
3. 🆕 Sistema llama checkAvailabilityQuota(availability_id)
4. Sistema evalúa resultado:
   
   SI can_schedule_direct = true:
      ├─ NO preguntar prioridad
      ├─ Llamar scheduleAppointment SIN priority_level
      └─ Confirmar cita directa
   
   SI can_schedule_direct = false:
      ├─ Preguntar prioridad al paciente
      ├─ Llamar scheduleAppointment CON priority_level
      └─ Confirmar lista de espera
```

**Ventaja:** Solo se pregunta prioridad cuando realmente es necesario.

## 💻 Ejemplos de Uso (curl)

### Ejemplo 1: Verificar cupos disponibles

```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "checkAvailabilityQuota",
      "arguments": {
        "availability_id": 132
      }
    }
  }' | jq .
```

### Ejemplo 2: Verificar fecha específica

```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "checkAvailabilityQuota",
      "arguments": {
        "availability_id": 132,
        "day_date": "2025-10-10"
      }
    }
  }' | jq .
```

## 📝 Actualización Requerida en el Prompt

El archivo `newprompt.md` debe actualizarse para usar esta herramienta. Cambios sugeridos:

### PASO 3: Después de seleccionar availability_id

```markdown
**Verificar Cupos Disponibles:**
- Llama a checkAvailabilityQuota con el availability_id seleccionado
- Guarda internamente el resultado (can_schedule_direct)

**NO INFORMES al paciente sobre cupos o lista de espera todavía**
```

### PASO 6: Antes de agendar

```markdown
**Decidir Flujo Basado en Cupos:**

SI can_schedule_direct = true:
  - NO preguntes nivel de prioridad
  - Pregunta motivo de consulta
  - Llama scheduleAppointment SIN priority_level
  - Confirma cita directa con todos los detalles

SI can_schedule_direct = false:
  - Pregunta nivel de prioridad (Urgente/Alta/Normal/Baja)
  - Pregunta motivo de consulta
  - Llama scheduleAppointment CON priority_level
  - Confirma lista de espera con posición en cola
```

## 🗃️ Tabla de Base de Datos Utilizada

### availability_distribution

```sql
CREATE TABLE availability_distribution (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  availability_id BIGINT UNSIGNED NOT NULL,
  day_date DATE NOT NULL,
  quota INT UNSIGNED NOT NULL,           -- Total de cupos para ese día
  assigned INT UNSIGNED NOT NULL,         -- Cupos ya asignados
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (availability_id) REFERENCES availabilities(id),
  UNIQUE KEY unique_availability_date (availability_id, day_date)
);
```

**Cálculo clave:**
```sql
slots_available = quota - assigned
```

## 🧪 Testing

### Test 1: Availability con cupos disponibles

```bash
# availability_id 132: Dermatología con 6 cupos disponibles
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"checkAvailabilityQuota","arguments":{"availability_id":132}}}' \
  | jq '.result.content[0].text | fromjson | .recommendation.can_schedule_direct'

# Resultado esperado: true
```

### Test 2: Availability sin cupos disponibles

```bash
# availability_id 135: Medicina General con 0 cupos disponibles
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"checkAvailabilityQuota","arguments":{"availability_id":135}}}' \
  | jq '.result.content[0].text | fromjson | .recommendation.can_schedule_direct'

# Resultado esperado: false
```

## 🚀 Historial de Versiones

### v3.4 (2025-01-XX)
- ✅ Creación de la herramienta `checkAvailabilityQuota`
- ✅ Separación de lógica de verificación de cupos
- ✅ Integración con sistema de lista de espera
- ✅ Soporte para filtrado por fecha específica
- ✅ Documentación completa

### Commit anterior (v3.3)
- Refactorización de `getAvailableAppointments` para retornar todas las agendas

## 🔗 Herramientas Relacionadas

1. **getAvailableAppointments**: Obtiene todas las availabilities disponibles
2. **checkAvailabilityQuota**: 🆕 Verifica cupos disponibles por día
3. **scheduleAppointment**: Agenda la cita (directa o lista de espera)
4. **getWaitingListAppointments**: Consulta lista de espera
5. **reassignWaitingListAppointments**: Procesa reasignaciones automáticas

## ⚠️ Notas Importantes

1. **Llamar ANTES de scheduleAppointment**: Esta herramienta debe usarse para tomar decisiones informadas ANTES de agendar.

2. **No tiene efectos secundarios**: Esta herramienta es de SOLO LECTURA. No modifica ningún dato, solo consulta.

3. **Usa can_schedule_direct para decisiones**: El campo `recommendation.can_schedule_direct` es la clave para decidir el flujo.

4. **Lista de espera automática**: Si no hay cupos, `scheduleAppointment` agregará automáticamente a lista de espera (no falla).

## 📞 Soporte Técnico

- **Servidor MCP**: Puerto 8977 (interno), https://biosanarcall.site/mcp-unified (público)
- **PM2 Process**: mcp-unified (id 0)
- **Base de datos**: MariaDB 10.11.13, database: biosanar
- **Logs**: `pm2 logs mcp-unified`

---

**Última actualización:** 2025-01-XX  
**Autor:** Sistema Biosanarcall  
**Versión:** 3.4
