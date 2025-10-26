# Actualización v1.4 - addToWaitingList con scheduled_date OPCIONAL

## 📅 Fecha
13 de octubre de 2025

## 🎯 Objetivo
Hacer que el campo `scheduled_date` sea **OPCIONAL** en la herramienta `addToWaitingList`, ya que no siempre se sabe cuándo se podrá asignar la cita al momento de agregar un paciente a la lista de espera.

## 🔧 Cambios Implementados

### 1. Schema de la Herramienta
**Archivo:** `src/server-unified.ts`

**Cambio en `required`:**
```typescript
// ANTES (v1.3)
required: ['patient_id', 'availability_id', 'scheduled_date', 'reason']

// DESPUÉS (v1.4)
required: ['patient_id', 'availability_id', 'reason']
```

**Cambio en descripción:**
```typescript
scheduled_date: {
  type: 'string',
  description: 'Fecha y hora deseada en formato YYYY-MM-DD HH:MM:SS (OPCIONAL - si no se proporciona, se asignará cuando haya cupo)',
  pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$'
}
```

### 2. Función addToWaitingList()

**Validación de parámetros actualizada:**
```typescript
// Validación de parámetros obligatorios (scheduled_date ahora es OPCIONAL)
if (!patient_id || !availability_id || !reason) {
  await connection.rollback();
  return {
    success: false,
    error: 'Faltan parámetros obligatorios',
    required: ['patient_id', 'availability_id', 'reason'],
    provided: { patient_id, availability_id, reason }
  };
}

// Si no se proporciona scheduled_date, usar NULL (se asignará cuando haya cupo)
const finalScheduledDate = scheduled_date || null;
```

**Inserción en base de datos:**
```typescript
INSERT INTO appointments_waiting_list (
  patient_id,
  availability_id,
  scheduled_date,  // Ahora puede ser NULL
  appointment_type,
  reason,
  notes,
  priority_level,
  status,
  requested_by,
  call_type,
  created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())
```

**Valores insertados:**
```typescript
[
  patient_id,
  availability_id,
  finalScheduledDate,  // NULL si no se proporcionó
  appointment_type,
  reason,
  notes || null,
  priority_level,
  requested_by,
  call_type
]
```

**Respuesta mejorada:**
```typescript
requested_for: {
  scheduled_date: finalScheduledDate,
  scheduled_date_status: finalScheduledDate 
    ? 'Fecha específica solicitada' 
    : 'Sin fecha específica - Se asignará cuando haya cupo',
  // ... resto de campos
},
info: `Ha sido agregado a la lista de espera para ${availability.specialty_name} con prioridad ${priority_level}. Está en la posición ${queuePosition} de ${totalWaiting} personas esperando.${finalScheduledDate ? ` Fecha deseada: ${finalScheduledDate}` : ' La fecha se asignará cuando haya disponibilidad.'}`
```

### 3. Estructura de Base de Datos
La tabla `appointments_waiting_list` ya soporta NULL en `scheduled_date`:

```sql
mysql> DESCRIBE appointments_waiting_list;
+----------------+----------+------+-----+---------+-------+
| Field          | Type     | Null | Key | Default | Extra |
+----------------+----------+------+-----+---------+-------+
| scheduled_date | datetime | YES  | MUL | NULL    |       |
+----------------+----------+------+-----+---------+-------+
```

✅ **No se requieren cambios en la base de datos**

## 📋 Casos de Uso

### Caso 1: Paciente SIN fecha preferida
```json
{
  "tool": "addToWaitingList",
  "arguments": {
    "patient_id": 1057,
    "availability_id": 142,
    "reason": "Control médico general",
    "priority_level": "Normal"
  }
}
```

**Resultado:**
- `scheduled_date` = `NULL` en la base de datos
- Mensaje: "La fecha se asignará cuando haya disponibilidad"
- La operadora asignará fecha cuando haya cupo disponible

### Caso 2: Paciente CON fecha preferida
```json
{
  "tool": "addToWaitingList",
  "arguments": {
    "patient_id": 1057,
    "availability_id": 142,
    "scheduled_date": "2025-10-25 14:00:00",
    "reason": "Control médico general",
    "priority_level": "Alta"
  }
}
```

**Resultado:**
- `scheduled_date` = `2025-10-25 14:00:00` en la base de datos
- Mensaje: "Fecha deseada: 2025-10-25 14:00:00"
- La operadora intentará asignar cerca de esta fecha si es posible

## 🧪 Tests Realizados

### Test 1: Inserción SIN fecha (NULL)
```javascript
✅ PASADO
- scheduled_date = NULL insertado correctamente
- Consulta retorna NULL como esperado
- Mensaje informativo adecuado
```

### Test 2: Inserción CON fecha específica
```javascript
✅ PASADO
- scheduled_date = '2025-10-25 14:00:00' insertado correctamente
- Consulta retorna la fecha como esperado
- Mensaje con fecha deseada mostrado
```

### Test 3: Validación de parámetros
```javascript
✅ PASADO
- patient_id es obligatorio
- availability_id es obligatorio
- reason es obligatorio
- scheduled_date es OPCIONAL (no genera error si falta)
```

### Test 4: Consultas con ambos casos
```javascript
✅ PASADO
- Registros con scheduled_date = NULL se consultan correctamente
- Registros con fecha específica se consultan correctamente
- Los JOINs funcionan en ambos casos
```

## 📊 Resultados de Tests

```bash
======================================
✅ TODOS LOS TESTS PASARON
======================================

📋 RESUMEN:
  ✓ scheduled_date puede ser NULL (opcional)
  ✓ scheduled_date puede tener una fecha específica
  ✓ Ambos casos se insertan correctamente
  ✓ Ambos casos se consultan correctamente

🎯 La herramienta addToWaitingList está lista:
  - Si el paciente NO tiene fecha preferida: scheduled_date = NULL
  - Si el paciente SÍ tiene fecha preferida: scheduled_date = "YYYY-MM-DD HH:MM:SS"
  - La operadora asignará fecha cuando haya disponibilidad
```

## 🔄 Flujo de Trabajo Actualizado

### Escenario A: Paciente sin fecha preferida
```
1. Agente detecta que paciente quiere cita pero sin fecha específica
2. Llama a addToWaitingList SIN scheduled_date
3. Sistema guarda con scheduled_date = NULL
4. Operadora recibe notificación
5. Cuando hay cupo, operadora llama al paciente
6. Operadora asigna fecha mutuamente conveniente
7. Operadora usa reassignWaitingListAppointments para convertir a cita
```

### Escenario B: Paciente con fecha preferida
```
1. Agente detecta que paciente quiere cita en fecha específica
2. Llama a addToWaitingList CON scheduled_date
3. Sistema guarda con la fecha solicitada
4. Operadora recibe notificación con fecha deseada
5. Cuando hay cupo cercano a esa fecha, operadora llama
6. Operadora confirma o negocia fecha cercana
7. Operadora usa reassignWaitingListAppointments para convertir a cita
```

## 💡 Beneficios

1. **Flexibilidad:** No se obliga a los pacientes a elegir una fecha cuando no la tienen
2. **Realismo:** Refleja mejor el proceso real de lista de espera
3. **Eficiencia:** Operadoras pueden asignar fechas óptimas según disponibilidad
4. **UX Mejorada:** Menos fricción en el proceso de agregar a lista de espera
5. **Priorización:** Sistema puede organizar por prioridad sin depender de fechas

## 🔢 Impacto en Versiones

| Versión | Herramientas | Cambio Principal |
|---------|-------------|------------------|
| v1.3    | 16          | addToWaitingList creada (scheduled_date obligatorio) |
| v1.4    | 16          | scheduled_date ahora OPCIONAL |

## 📝 Notas Técnicas

- La columna `scheduled_date` en la tabla ya permitía NULL desde el diseño inicial
- No se requirieron cambios de migración de base de datos
- La lógica de priorización en cola NO depende de `scheduled_date`
- Las consultas con JOIN funcionan correctamente con NULL
- La validación de duplicados por especialidad no se ve afectada

## 🚀 Estado de Deployment

- ✅ Código compilado sin errores
- ✅ Servidor reiniciado (PM2 restart #9)
- ✅ Tests pasados (100%)
- ✅ Documentación actualizada
- ✅ Lista para producción

## 📖 Documentación Relacionada

- `DOCUMENTACION_SISTEMA_MCP_v2.md` - Documentación general del sistema
- `DOCUMENTACION_LISTA_ESPERA.md` - Documentación del sistema de lista de espera
- `newprompt.md` - Prompt del agente (actualizar con nuevo comportamiento)

## 🎯 Próximos Pasos Sugeridos

1. Actualizar `newprompt.md` para reflejar que `scheduled_date` es opcional
2. Agregar ejemplos conversacionales para ambos casos
3. Documentar en guía de operadoras el flujo con fecha NULL
4. Considerar campo adicional `preferred_time_of_day` (mañana/tarde) sin fecha específica

---

**Versión:** v1.4  
**Fecha:** 13 de octubre de 2025  
**Autor:** Sistema de desarrollo MCP  
**Estado:** ✅ Completado y probado
