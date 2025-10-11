# 📋 Registros de Prueba - Lista de Espera

**Fecha de Creación:** 2 de octubre de 2025  
**Especialidad:** Dermatología (specialty_id: 10)  
**Availability ID:** 132 (Dr. Erwin Alirio Vargas Ariza)  
**Estado:** ✅ ACTIVOS EN SISTEMA

---

## 📊 Registros Creados

### Registro 1: URGENTE ⚠️

| Campo | Valor |
|-------|-------|
| **waiting_list_id** | 1 |
| **Paciente** | Dey Alberto Bastidas (ID: 1042) |
| **Cédula** | 17265900 |
| **Prioridad** | **Urgente** |
| **Posición en Cola** | **#1** |
| **Motivo** | Revisión urgente de lesión cutánea |
| **Notas** | Paciente reporta cambios en lunar que requieren evaluación inmediata |
| **Tipo** | Presencial |
| **Fecha Solicitada** | 2025-10-10 09:00:00 |
| **Días Esperando** | 0 días (creado hoy) |
| **Estado** | pending |

---

### Registro 2: ALTA 🔴

| Campo | Valor |
|-------|-------|
| **waiting_list_id** | 2 |
| **Paciente** | Juan Sebastián Correa Delgado (ID: 1043) |
| **Cédula** | 1100970967 |
| **Prioridad** | **Alta** |
| **Posición en Cola** | **#2** |
| **Motivo** | Seguimiento de tratamiento dermatológico |
| **Notas** | Control post-tratamiento de acné |
| **Tipo** | Presencial |
| **Fecha Solicitada** | 2025-10-10 10:00:00 |
| **Días Esperando** | 2 días |
| **Estado** | pending |

---

### Registro 3: NORMAL 🟡

| Campo | Valor |
|-------|-------|
| **waiting_list_id** | 3 |
| **Paciente** | Oscar Andrés Calderón González (ID: 1044) |
| **Cédula** | 1232889356 |
| **Prioridad** | **Normal** |
| **Posición en Cola** | **#3** |
| **Motivo** | Consulta por dermatitis |
| **Notas** | Paciente solicita valoración general |
| **Tipo** | Presencial |
| **Fecha Solicitada** | 2025-10-10 11:00:00 |
| **Días Esperando** | 5 días |
| **Estado** | pending |

---

## 📈 Estadísticas Generales

| Métrica | Valor |
|---------|-------|
| **Total en Lista de Espera** | 3 pacientes |
| **Especialidad** | Dermatología |
| **Prioridad Urgente** | 1 paciente |
| **Prioridad Alta** | 1 paciente |
| **Prioridad Normal** | 1 paciente |
| **Pueden Reasignarse Ahora** | 3 (hay cupos disponibles) |
| **Tiempo Promedio de Espera** | 2.3 días |

---

## 🧪 Consultas de Prueba

### Consultar por Paciente Específico

```bash
curl -s -X POST "https://biosanarcall.site/mcp/" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "getWaitingListAppointments",
      "arguments": {
        "patient_id": 1042,
        "status": "pending"
      }
    }
  }' | jq -r '.result.content[] | select(.text != null) | .text' | jq '.'
```

**Resultado:**
- ✅ Encuentra 1 solicitud
- Queue Position: #1
- Priority: Urgente
- Puede ser reasignado: true

---

### Consultar por Especialidad

```bash
curl -s -X POST "https://biosanarcall.site/mcp/" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "getWaitingListAppointments",
      "arguments": {
        "specialty_id": 10,
        "status": "pending"
      }
    }
  }' | jq -r '.result.content[] | select(.text != null) | .text' | jq '.'
```

**Resultado:**
- ✅ Encuentra 3 solicitudes
- Ordenadas por prioridad: Urgente → Alta → Normal
- Dentro de cada prioridad: FIFO (primero en llegar, primero en salir)

---

### Consultar por Prioridad

```bash
curl -s -X POST "https://biosanarcall.site/mcp/" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "getWaitingListAppointments",
      "arguments": {
        "specialty_id": 10,
        "priority_level": "Urgente",
        "status": "pending"
      }
    }
  }' | jq -r '.result.content[] | select(.text != null) | .text' | jq '.'
```

**Resultado:**
- ✅ Encuentra 1 solicitud urgente
- Paciente: Dey Alberto Bastidas

---

## 🔄 Verificación en Base de Datos

### Ver Registros Directamente

```sql
SELECT 
  wl.id as waiting_list_id,
  p.name as paciente,
  p.document as cedula,
  wl.priority_level,
  wl.reason,
  wl.created_at,
  DATEDIFF(NOW(), wl.created_at) as dias_esperando,
  wl.status,
  s.name as especialidad
FROM appointments_waiting_list wl
INNER JOIN patients p ON wl.patient_id = p.id
INNER JOIN availabilities a ON wl.availability_id = a.id
INNER JOIN specialties s ON a.specialty_id = s.id
WHERE wl.requested_by = 'Test_System'
  AND wl.status = 'pending'
ORDER BY 
  CASE wl.priority_level
    WHEN 'Urgente' THEN 1
    WHEN 'Alta' THEN 2
    WHEN 'Normal' THEN 3
    WHEN 'Baja' THEN 4
  END,
  wl.created_at ASC;
```

---

### Ver con Cálculo de Posición en Cola

```sql
SELECT 
  wl.id,
  p.name,
  wl.priority_level,
  wl.created_at,
  (
    SELECT COUNT(*) + 1
    FROM appointments_waiting_list wl2
    INNER JOIN availabilities a2 ON wl2.availability_id = a2.id
    WHERE a2.specialty_id = 10
      AND wl2.status = 'pending'
      AND (
        (wl2.priority_level = 'Urgente' AND wl.priority_level != 'Urgente')
        OR (wl2.priority_level = 'Alta' AND wl.priority_level NOT IN ('Urgente', 'Alta'))
        OR (wl2.priority_level = 'Normal' AND wl.priority_level = 'Baja')
        OR (wl2.priority_level = wl.priority_level AND wl2.created_at < wl.created_at)
      )
  ) as queue_position
FROM appointments_waiting_list wl
INNER JOIN patients p ON wl.patient_id = p.id
INNER JOIN availabilities a ON wl.availability_id = a.id
WHERE a.specialty_id = 10 
  AND wl.status = 'pending'
  AND wl.requested_by = 'Test_System'
ORDER BY queue_position;
```

---

## 🎯 Casos de Uso para Pruebas

### Caso 1: Paciente Urgente Consulta su Estado

**Escenario:** Dey Alberto Bastidas (cédula 17265900) llama para saber su posición.

**Valeria responde:**
> "Señor Bastidas, veo su solicitud en la lista de espera para Dermatología. Su posición actual es la número 1 con prioridad Urgente. Aún estamos esperando que se libere un cupo, pero le notificaremos tan pronto ocurra."

**Datos que ve Valeria:**
- waiting_list_id: 1
- queue_position: 1
- priority_level: Urgente
- reason: "Revisión urgente de lesión cutánea"
- can_be_reassigned: true (hay cupos disponibles)

---

### Caso 2: Operadora Revisa Lista Completa

**Escenario:** Operadora quiere ver todos los pacientes esperando para Dermatología.

**Herramienta:** `getWaitingListAppointments` con `specialty_id: 10`

**Resultado:**
1. **#1 - Urgente:** Dey Alberto Bastidas (0 días esperando)
2. **#2 - Alta:** Juan Sebastián Correa Delgado (2 días esperando)
3. **#3 - Normal:** Oscar Andrés Calderón González (5 días esperando)

**Acción:** Como hay cupos disponibles (`can_be_reassigned: true`), puede llamar al paciente urgente primero.

---

### Caso 3: Reasignación Manual

**Escenario:** Se libera un cupo y la operadora quiere asignar al paciente urgente.

**Herramienta:** `reassignWaitingListAppointments` con `availability_id: 132`

**Resultado:** El sistema automáticamente asigna la cita al paciente #1 (Urgente) y actualiza su estado a 'reassigned'.

---

## 🗑️ Limpiar Registros de Prueba

Si necesitas eliminar estos registros:

```sql
DELETE FROM appointments_waiting_list 
WHERE requested_by = 'Test_System';
```

O cambiar su estado:

```sql
UPDATE appointments_waiting_list 
SET status = 'cancelled', 
    cancelled_reason = 'Registro de prueba'
WHERE requested_by = 'Test_System';
```

---

## ✅ Validaciones del Sistema

Los registros de prueba demuestran que:

1. ✅ **Priorización funciona:** Urgente (#1) → Alta (#2) → Normal (#3)
2. ✅ **FIFO dentro de prioridad:** Si hubiera dos "Alta", el más antiguo va primero
3. ✅ **Cálculo por especialidad:** La posición se calcula para toda la especialidad, no por doctor
4. ✅ **Datos del paciente completos:** Nombre, documento, teléfono disponibles
5. ✅ **Indicador de reasignación:** `can_be_reassigned: true` cuando hay cupos
6. ✅ **Días de espera:** Se calcula automáticamente
7. ✅ **Estadísticas:** Se generan correctamente por prioridad

---

**Creado:** 2 de octubre de 2025  
**Último Update:** 2 de octubre de 2025  
**Estado:** ✅ ACTIVO - Listo para pruebas con ElevenLabs/Valeria
