# Refactorización de getAvailableAppointments v3.3
## Soporte para Lista de Espera Transparente

**Fecha:** 2 de octubre de 2025  
**Versión:** 3.3  
**Estado:** ✅ IMPLEMENTADO Y DESPLEGADO

---

## 📋 Resumen de Cambios

### Problema Anterior
`getAvailableAppointments` filtraba y **eliminaba** todas las agendas que tenían `slots_available = 0` mediante la cláusula `HAVING SUM(ad.quota - ad.assigned) > 0`. Esto causaba que:

- El asistente no pudiera ver especialidades con cupos llenos
- No se podía ofrecer lista de espera para esas especialidades
- La experiencia era negativa: "No hay disponibilidad para Medicina General"

### Solución Implementada
Se **eliminó el filtro** de `slots_available > 0` para que:

- ✅ **TODAS las agendas programadas** se retornen en `getAvailableAppointments`
- ✅ Incluye agendas con `slots_available = 0` (lista de espera)
- ✅ Incluye agendas con `slots_available > 0` (cita directa)
- ✅ El asistente puede presentar todas las especialidades disponibles
- ✅ `scheduleAppointment` decide automáticamente si es cita directa o lista de espera

---

## 🔧 Cambios Técnicos

### Archivo Modificado
`/home/ubuntu/app/mcp-server-node/src/server-unified.ts`

### Cambio 1: Eliminación del Filtro HAVING (Línea ~564)

**ANTES:**
```typescript
query += ` 
  GROUP BY a.id, a.date, a.start_time, a.end_time, a.duration_minutes, a.capacity, a.status,
           d.id, d.name, d.email, d.phone,
           s.id, s.name,
           l.id, l.name, l.address, l.phone
  HAVING SUM(ad.quota - ad.assigned) > 0  ❌ FILTRO ELIMINADO
  ORDER BY a.date, s.name, d.name, a.start_time
  LIMIT ?
`;
```

**AHORA:**
```typescript
query += ` 
  GROUP BY a.id, a.date, a.start_time, a.end_time, a.duration_minutes, a.capacity, a.status,
           d.id, d.name, d.email, d.phone,
           s.id, s.name,
           l.id, l.name, l.address, l.phone
  -- ✅ Sin filtro HAVING - retorna todas las agendas
  ORDER BY a.date, s.name, d.name, a.start_time
  LIMIT ?
`;
```

### Cambio 2: Actualización del Mensaje de Respuesta (Línea ~570)

**ANTES:**
```typescript
message: 'No hay citas disponibles con los filtros aplicados'
```

**AHORA:**
```typescript
message: 'No hay agendas programadas con los filtros aplicados'
```

### Cambio 3: Actualización del Info Object (Línea ~720)

**ANTES:**
```typescript
slots_available_info: 'slots_available es el TOTAL de cupos disponibles'
```

**AHORA:**
```typescript
slots_available_info: 'slots_available indica cupos disponibles. Si es 0, se puede agregar a lista de espera',
waiting_list_support: 'Las agendas con slots_available=0 permiten lista de espera automática'
```

---

## 📊 Ejemplos de Respuesta

### Ejemplo 1: Agenda CON Cupos Disponibles

```json
{
  "availability_id": 132,
  "appointment_date": "2025-10-10",
  "time_range": "08:00 - 12:00",
  "slots_available": 6,
  "waiting_list_count": 3,
  "doctor": {
    "id": 5,
    "name": "Dr. Erwin Vargas"
  },
  "specialty": {
    "id": 10,
    "name": "Dermatología"
  }
}
```

**Comportamiento:**
- El asistente presenta: "Podemos procesar su solicitud para Dermatología"
- `scheduleAppointment` → Cita directa confirmada

---

### Ejemplo 2: Agenda SIN Cupos Disponibles (Nueva Funcionalidad)

```json
{
  "availability_id": 135,
  "appointment_date": "2025-10-15",
  "time_range": "08:00 - 12:00",
  "slots_available": 0,
  "waiting_list_count": 0,
  "doctor": {
    "id": 1,
    "name": "Dr. Rolando Romero"
  },
  "specialty": {
    "id": 1,
    "name": "Medicina General"
  }
}
```

**Comportamiento:**
- El asistente presenta: "Podemos procesar su solicitud para Medicina General" ✅ (IGUAL que con cupos)
- Si paciente pregunta por prioridad → detecta `slots_available = 0`
- `scheduleAppointment` → Agregado a lista de espera

---

## 🎯 Flujo de Usuario (Sin Cambios Perceptibles)

### Con Cupos Disponibles:
```
1. Valeria: "Podemos procesar su solicitud para Medicina General"
2. Paciente elige especialidad y sede
3. Valeria solicita cédula, motivo
4. scheduleAppointment → slots_available = 6
5. ✅ "Su cita ha sido confirmada con el Dr. X el día Y..."
```

### Sin Cupos Disponibles (NUEVO):
```
1. Valeria: "Podemos procesar su solicitud para Medicina General" ✅ IGUAL
2. Paciente elige especialidad y sede
3. Valeria solicita cédula, motivo, PRIORIDAD
4. scheduleAppointment → slots_available = 0
5. ⏳ "Su solicitud ha sido registrada en lista de espera..."
```

**CLAVE:** El paciente NO nota diferencia hasta el PASO 5 (confirmación final)

---

## ✅ Validación y Pruebas

### Test 1: Agenda CON Cupos
```bash
curl -X POST "https://biosanarcall.site/mcp/" \
  -d '{"method":"tools/call","params":{"name":"getAvailableAppointments","arguments":{"specialty_id":10}}}'
```

**Resultado:**
```json
{
  "success": true,
  "count": 1,
  "available_appointments": [{
    "availability_id": 132,
    "slots_available": "6",
    "specialty": "Dermatología"
  }]
}
```

### Test 2: Agenda SIN Cupos (NUEVO)
```bash
curl -X POST "https://biosanarcall.site/mcp/" \
  -d '{"method":"tools/call","params":{"name":"getAvailableAppointments","arguments":{"specialty_id":1}}}'
```

**Resultado:**
```json
{
  "success": true,
  "count": 1,
  "available_appointments": [{
    "availability_id": 135,
    "slots_available": "0",
    "specialty": "Medicina General"
  }]
}
```

✅ **ÉXITO:** Retorna agendas con `slots_available = 0`

---

## 🔗 Integración con Otros Componentes

### 1. Prompt de Valeria (newprompt.md)
- ✅ Actualizado para presentar TODAS las especialidades
- ✅ Usa lenguaje neutral: "podemos procesar su solicitud"
- ✅ NO menciona cupos ni lista de espera anticipadamente
- ✅ Revela resultado DESPUÉS de `scheduleAppointment`

### 2. scheduleAppointment (sin cambios)
- ✅ Ya tenía lógica de lista de espera
- ✅ Detecta automáticamente `slots_available = 0`
- ✅ Retorna `waiting_list: true/false`

### 3. getWaitingListAppointments (sin cambios)
- ✅ Calcula queue_position por especialidad
- ✅ Retorna estadísticas de lista de espera

---

## 📈 Beneficios del Cambio

| Aspecto | ANTES | AHORA |
|---------|-------|-------|
| **Especialidades visibles** | Solo con cupos > 0 | TODAS las programadas |
| **Experiencia usuario** | "No hay disponibilidad" ❌ | "Procesando solicitud" ✅ |
| **Lista de espera** | Manual/separada | Automática/transparente |
| **Conversión** | Baja (rechazo) | Alta (siempre procesa) |
| **Flujo** | Bifurcado | Unificado |

---

## 🚀 Despliegue

```bash
# 1. Compilar TypeScript
cd /home/ubuntu/app/mcp-server-node
npm run build

# 2. Reiniciar servidor
pm2 restart mcp-unified

# 3. Verificar logs
pm2 logs mcp-unified --lines 50
```

**Estado:** ✅ DESPLEGADO en producción  
**PM2 Restarts:** 14  
**Versión:** 3.3 (compatible con v2.1 de lista de espera)

---

## 📝 Datos de Prueba Creados

### Agenda con 0 Cupos
```sql
availability_id: 135
doctor: Dr. Rolando Romero (id: 1)
specialty: Medicina General (id: 1)
location: Sede biosanar san gil (id: 1)
date: 2025-10-15
time: 08:00 - 12:00
capacity: 10
quota: 10
assigned: 10
slots_available: 0 ✅
```

### Cómo Eliminar Datos de Prueba
```sql
DELETE FROM availability_distribution WHERE availability_id = 135;
DELETE FROM availabilities WHERE id = 135;
```

---

## 🎓 Conclusión

La refactorización de `getAvailableAppointments` permite un flujo completamente transparente donde:

1. **Todas las especialidades** se presentan igual
2. **El sistema decide** automáticamente cita directa vs lista de espera
3. **El paciente experimenta** un proceso unificado y profesional
4. **La conversión mejora** al eliminar rechazos prematuros
5. **La experiencia es positiva** en ambos casos

El cambio es mínimo (3 líneas de código) pero el impacto es significativo en la experiencia del usuario.

---

**Documentación generada por:** GitHub Copilot  
**Fecha:** 2 de octubre de 2025  
**Versión del sistema:** v3.3 (Lista de Espera Transparente)
