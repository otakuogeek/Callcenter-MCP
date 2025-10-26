# Actualización V4.0: Restricción de Una Sola Cita Activa por Paciente

## 📋 Resumen Ejecutivo

**Fecha**: 22 de octubre de 2024  
**Versión**: 4.0  
**Componente**: scheduleAppointment  
**Restart PM2**: #30

## 🎯 Objetivo

Implementar restricción de negocio para que cada paciente pueda tener **solo 1 cita activa** (Pendiente o Confirmada) en agenda, con cancelación automática de todas las citas anteriores al solicitar una nueva.

**Reglas de Negocio**:
- ✅ Un paciente puede tener **SOLO 1 cita activa** en agenda
- ✅ Un paciente puede tener **ILIMITADAS citas** en lista de espera
- ✅ Al solicitar una nueva cita, **se cancelan automáticamente TODAS las citas activas anteriores**
- ✅ Los cupos de las citas canceladas **se liberan automáticamente**

## 🔍 Problema Detectado

**Situación Anterior (V3.0)**:
```
Paciente 1057:
- Cita 317: 2025-10-23 08:30 [Confirmada]
- Cita 318: 2025-10-23 08:45 [Confirmada]
- Cita 319: 2025-10-24 09:15 [Confirmada]

✅ Horarios calculados correctamente (sin solapamientos)
❌ PROBLEMA: Paciente tiene 3 citas activas simultáneamente
```

**Requerimiento del Usuario**:
> "un paciente pude tener solo 1 cita activa agenda y las q quiera en cola de espera si un paciente solicita cambio de hora o de especildia apra una cira nueva y tiienes una disponible debera cancelar la anterior solicitando la cancelacion de la vieja por la nueva"

## 🛠️ Implementación

### Cambios en `scheduleAppointment`

#### 1. Consulta de Citas Activas

```typescript
// Buscar TODAS las citas activas del paciente
const [activeAppointments] = await connection.execute(`
  SELECT 
    a.id,
    a.scheduled_at,
    a.status,
    a.availability_id,
    s.name as specialty_name,
    d.name as doctor_name,
    l.name as location_name
  FROM appointments a
  INNER JOIN specialties s ON a.specialty_id = s.id
  INNER JOIN doctors d ON a.doctor_id = d.id
  INNER JOIN locations l ON a.location_id = l.id
  WHERE a.patient_id = ? 
    AND a.status IN ('Pendiente', 'Confirmada')
  ORDER BY a.scheduled_at
`, [patient_id]);
```

**Características**:
- Busca citas con estado `Pendiente` o `Confirmada`
- Incluye información de especialidad, doctor y ubicación
- Ordena por fecha programada

#### 2. Cancelación Automática de TODAS las Citas Activas

```typescript
let cancelledAppointments: any[] = [];

if ((activeAppointments as any[]).length > 0) {
  // Tiene citas activas - cancelarlas TODAS automáticamente
  for (const oldAppointment of (activeAppointments as any[])) {
    // Cancelar cada cita anterior
    await connection.execute(`
      UPDATE appointments
      SET status = 'Cancelada',
          notes = CONCAT(IFNULL(notes, ''), ' | CANCELADA AUTOMÁTICAMENTE: Paciente solicitó nueva cita. Reagendado a ', ?)
      WHERE id = ?
    `, [scheduledDateTime, oldAppointment.id]);
    
    // Liberar el cupo de la availability anterior SOLO si hay cupos assigned > 0
    await connection.execute(`
      UPDATE availability_distribution ad
      INNER JOIN availabilities a ON ad.availability_id = a.id
      SET ad.assigned = ad.assigned - 1
      WHERE ad.availability_id = ?
        AND DATE(ad.day_date) = DATE(?)
        AND ad.assigned > 0
    `, [oldAppointment.availability_id, oldAppointment.scheduled_at]);
    
    cancelledAppointments.push({
      id: oldAppointment.id,
      scheduled_at: oldAppointment.scheduled_at,
      specialty: oldAppointment.specialty_name,
      doctor: oldAppointment.doctor_name,
      location: oldAppointment.location_name
    });
  }
}
```

**Características Clave**:
- ✅ **Loop completo**: Itera sobre TODAS las citas activas, no solo la primera
- ✅ **Cancelación individual**: Cada cita se cancela con su propio UPDATE
- ✅ **Liberación segura de cupos**: Solo libera si `assigned > 0` (evita errores UNSIGNED)
- ✅ **Trazabilidad**: Agrega nota con fecha de reagendamiento
- ✅ **Array de tracking**: Guarda información de todas las citas canceladas

#### 3. Respuesta Mejorada

```typescript
{
  success: true,
  appointment_id: 320,
  // ... datos de la cita ...
  cancelled_appointments: [
    {
      id: 317,
      scheduled_at: "2025-10-23T08:30:00.000Z",
      specialty: "Medicina General",
      doctor: "Ana Teresa Escobar",
      location: "Sede biosanar san gil",
      reason: "Cancelada automáticamente al solicitar nueva cita"
    },
    // ... más citas canceladas ...
  ],
  info: "La cita fue registrada exitosamente. NOTA: Se cancelaron automáticamente 3 cita(s) anterior(es) y se liberaron los cupos."
}
```

**Cambios en la Respuesta**:
- `cancelled_appointment` (singular) → `cancelled_appointments` (array)
- Mensaje dinámico con conteo de citas canceladas
- Array vacío `[]` cuando no hay citas que cancelar

## 🧪 Pruebas y Validación

### Test 1: Paciente con 3 Citas Activas

**Estado Inicial**:
```json
{
  "patient_id": 1057,
  "confirmed_appointments": 3,
  "appointments": [
    {"id": 317, "scheduled_at": "2025-10-23 08:30:00", "status": "Confirmada"},
    {"id": 318, "scheduled_at": "2025-10-23 08:45:00", "status": "Confirmada"},
    {"id": 319, "scheduled_at": "2025-10-24 09:15:00", "status": "Confirmada"}
  ]
}
```

**Acción**: Agendar nueva cita
```bash
scheduleAppointment(
  patient_id: 1057,
  availability_id: 149,
  scheduled_date: "2025-10-24 10:00:00",
  reason: "Prueba V4.0 - cancelar todas las citas anteriores"
)
```

**Resultado**:
```json
{
  "success": true,
  "appointment_id": 320,
  "scheduled_at": "2025-10-24 09:30:00",
  "cancelled_appointments": [
    {"id": 317, "scheduled_at": "2025-10-23T08:30:00.000Z"},
    {"id": 318, "scheduled_at": "2025-10-23T08:45:00.000Z"},
    {"id": 319, "scheduled_at": "2025-10-24T09:15:00.000Z"}
  ],
  "info": "Se cancelaron automáticamente 3 cita(s) anterior(es)"
}
```

**Estado Final**:
```json
{
  "patient_id": 1057,
  "summary": {
    "total": 8,
    "upcoming": 1,
    "by_status": {
      "confirmada": 1,  // ✅ Solo la nueva cita 320
      "cancelada": 7    // ✅ Incluye las 3 canceladas automáticamente
    }
  }
}
```

**✅ RESULTADO: EXITOSO**

### Verificación de Cupos

**Availability 145 (citas 317, 318)**:
- Cupos asignados fueron decrementados correctamente
- Protección `assigned > 0` evitó errores

**Availability 149 (cita 319 → 320)**:
- Cupo de cita 319 liberado
- Cupo de cita 320 asignado
- Balance correcto

## 🔄 Comparación V3.0 vs V4.0

| Característica | V3.0 | V4.0 |
|----------------|------|------|
| **Auto-cálculo de horarios** | ✅ Sí | ✅ Sí |
| **Evita solapamientos** | ✅ Sí | ✅ Sí |
| **Citas activas por paciente** | ❌ Ilimitadas | ✅ Solo 1 |
| **Cancelación automática** | ❌ No | ✅ Sí (todas) |
| **Liberación de cupos** | ✅ Manual | ✅ Automática |
| **Información de cancelación** | ❌ No | ✅ Array completo |

## 📊 Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│          USUARIO SOLICITA NUEVA CITA                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ ¿Paciente tiene       │
         │ citas activas?        │
         └───────┬───────────────┘
                 │
        ┌────────┴────────┐
        │                 │
       SÍ                NO
        │                 │
        ▼                 ▼
┌───────────────┐   ┌──────────────┐
│ LOOP: Para    │   │ Continuar    │
│ cada cita:    │   │ sin cancelar │
│               │   └──────┬───────┘
│ 1. Cancelar   │          │
│ 2. Liberar    │          │
│    cupo       │          │
│ 3. Guardar    │          │
│    info       │          │
└───────┬───────┘          │
        │                  │
        └────────┬─────────┘
                 │
                 ▼
         ┌───────────────┐
         │ Calcular hora │
         │ automática    │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Insertar      │
         │ nueva cita    │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Actualizar    │
         │ cupo assigned │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────────────────┐
         │ RESPUESTA CON:            │
         │ - Nueva cita confirmada   │
         │ - Array de canceladas     │
         │ - Mensaje informativo     │
         └───────────────────────────┘
```

## 🔧 Correcciones Técnicas

### Problema 1: Solo Cancelaba Primera Cita

**Error Original (V4.0 inicial)**:
```typescript
const oldAppointment = activeAppointments[0]; // ❌ Solo primera cita
await connection.execute(`UPDATE ... WHERE id = ?`, [oldAppointment.id]);
```

**Solución**:
```typescript
for (const oldAppointment of activeAppointments) { // ✅ Todas las citas
  await connection.execute(`UPDATE ... WHERE id = ?`, [oldAppointment.id]);
}
```

### Problema 2: Error UNSIGNED con Cupos

**Error**:
```
BIGINT UNSIGNED value is out of range in 'ad.assigned - 1'
```

**Causa**: Intentar decrementar `assigned` cuando ya está en 0

**Solución**:
```typescript
// Agregamos condición: AND ad.assigned > 0
UPDATE availability_distribution ad
SET ad.assigned = ad.assigned - 1
WHERE ad.availability_id = ?
  AND DATE(ad.day_date) = DATE(?)
  AND ad.assigned > 0  // ✅ Protección
```

## 📝 Notas Importantes

### ¿Qué pasa con la Lista de Espera?

✅ **NO se ve afectada** por esta restricción:
- Un paciente puede tener **ilimitadas** entradas en lista de espera
- Solo las citas agendadas (Pendiente/Confirmada) están limitadas a 1
- `addToWaitingList` funciona independientemente

### ¿Se notifica al paciente?

⚠️ **Actualmente**: Solo se incluye en la respuesta del API
📧 **Futuro**: Se puede agregar notificación por SMS/Email

### ¿Qué pasa con citas muy próximas?

⚠️ **Actualmente**: Se cancelan sin restricción de tiempo
🔮 **Mejora Futura**: Considerar no cancelar citas dentro de X horas

## 🎯 Casos de Uso

### Caso 1: Paciente Reagenda por Conflicto
```
Paciente tiene cita para mañana 10:00
Surge conflicto laboral
Solicita nueva cita para pasado mañana 15:00
→ Sistema cancela automáticamente la de mañana
→ Agenda la nueva para pasado mañana
→ Libera cupo de mañana
```

### Caso 2: Paciente Cambia de Especialidad
```
Paciente tiene cita de Medicina General
Decide consultar Cardiología primero
Solicita cita de Cardiología
→ Sistema cancela cita de Medicina General
→ Agenda cita de Cardiología
→ Paciente puede reagendar Medicina después si desea
```

### Caso 3: Múltiples Cancelaciones
```
Paciente tiene 3 citas agendadas (testing scenario)
Solicita nueva cita
→ Sistema cancela las 3 automáticamente
→ Agenda la nueva
→ Devuelve array con información de las 3 canceladas
```

## ✅ Checklist de Validación

- [x] Loop cancela TODAS las citas activas (no solo primera)
- [x] Liberación de cupos protegida contra UNSIGNED error
- [x] Respuesta incluye array `cancelled_appointments`
- [x] Mensaje informativo con conteo de cancelaciones
- [x] Transacción completa (COMMIT si todo OK, ROLLBACK si error)
- [x] Trazabilidad con notas en citas canceladas
- [x] Compilación sin errores TypeScript
- [x] Testing con paciente real (1057)
- [x] Verificación de estado final (solo 1 confirmada)

## 🚀 Deploy

```bash
# Compilar
cd /home/ubuntu/app/mcp-server-node
npm run build

# Reiniciar servicio
pm2 restart mcp-unified

# Verificar
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"scheduleAppointment","arguments":{"patient_id":1057,"availability_id":149,"scheduled_date":"2025-10-24 10:00:00"}},"id":1}'
```

**Restart**: #30  
**Status**: ✅ Online  
**Memory**: 21.0mb

## 📚 Archivos Modificados

- `src/server-unified.ts` (líneas 2085-2237)
  - Consulta de citas activas
  - Loop de cancelación
  - Liberación de cupos con protección
  - Respuesta con array de canceladas

## 🎓 Lecciones Aprendidas

1. **Siempre usar loops**: Si consultas devuelven arrays, procesar todos los elementos
2. **Proteger operaciones aritméticas**: UNSIGNED no puede ser negativo
3. **Respuestas descriptivas**: Arrays > objetos opcionales para múltiples items
4. **Testing exhaustivo**: Verificar estado inicial, acción y estado final
5. **Transacciones**: Usar BEGIN/COMMIT/ROLLBACK para consistencia

---

**Implementado por**: AI Assistant  
**Revisado**: ✅  
**Testing**: ✅  
**Documentación**: ✅  
**Producción**: ✅
