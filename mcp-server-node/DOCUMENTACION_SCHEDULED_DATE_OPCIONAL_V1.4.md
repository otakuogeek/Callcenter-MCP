# Actualización v1.4: Campo scheduled_date OPCIONAL en Lista de Espera

**Fecha**: 13 de octubre de 2025  
**Versión**: 1.4.0  
**Herramienta**: `addToWaitingList`  
**Estado**: ✅ Implementado y probado

---

## 🎯 Objetivo

Hacer que el campo `scheduled_date` sea **OPCIONAL** en la herramienta `addToWaitingList` y en la tabla `appointments_waiting_list`, ya que en muchos casos no se sabe cuándo se podrá asignar la cita.

## 📋 Cambios Realizados

### 1. Modificación de Base de Datos

**Tabla**: `appointments_waiting_list`  
**Campo**: `scheduled_date`

```sql
-- ANTES: NOT NULL
scheduled_date datetime NOT NULL

-- DESPUÉS: NULL (permitido)
scheduled_date datetime NULL DEFAULT NULL
```

**SQL ejecutado**:
```sql
ALTER TABLE appointments_waiting_list 
MODIFY COLUMN scheduled_date datetime NULL DEFAULT NULL;
```

### 2. Actualización del Código TypeScript

#### a) Schema de la herramienta

**Archivo**: `src/server-unified.ts` (línea ~306)

```typescript
scheduled_date: {
  type: 'string',
  description: 'Fecha y hora deseada en formato YYYY-MM-DD HH:MM:SS (OPCIONAL - no se sabe cuándo se podrá asignar, se asignará cuando haya cupo disponible)',
  pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$'
},
```

**Cambio en `required`**:
```typescript
// ANTES
required: ['patient_id', 'availability_id', 'scheduled_date', 'reason']

// DESPUÉS  
required: ['patient_id', 'availability_id', 'reason']
```

#### b) Validación de parámetros

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
```

#### c) Manejo de NULL en INSERT

```typescript
// Si no se proporciona scheduled_date, usar NULL (se asignará cuando haya cupo)
const finalScheduledDate = scheduled_date || null;

// En el INSERT:
INSERT INTO appointments_waiting_list (..., scheduled_date, ...)
VALUES (..., ?, ...)
```

Parámetros:
```typescript
[
  patient_id,
  availability_id,
  scheduled_date || null,  // NULL si no se proporciona
  appointment_type,
  // ...
]
```

#### d) Mensaje condicional en respuesta

```typescript
scheduled_date_status: finalScheduledDate 
  ? 'Fecha específica solicitada' 
  : 'Sin fecha específica - Se asignará cuando haya cupo',
```

### 3. Correcciones de Nombres de Campos

Durante la implementación se corrigieron nombres de campos incorrectos:

```typescript
// ANTES (incorrecto)
SELECT id, name, document, eps_id, phone_1, phone_2 
FROM patients

// DESPUÉS (correcto)
SELECT id, name, document, insurance_eps_id, phone, phone_alt 
FROM patients
```

```typescript
// ANTES (incorrecto)
patient.eps_id
patient.phone_1
patient.phone_2

// DESPUÉS (correcto)
patient.insurance_eps_id
patient.phone
patient.phone_alt
```

---

## 🧪 Pruebas Realizadas

### Test 1: Sin fecha programada (scheduled_date = NULL)

**Request**:
```json
{
  "tool": "addToWaitingList",
  "arguments": {
    "patient_id": 1057,
    "availability_id": 155,
    "appointment_type": "Presencial",
    "reason": "Consulta de control general - fecha flexible",
    "notes": "Paciente puede asistir cualquier día disponible",
    "priority_level": "Normal"
    // NO se incluye scheduled_date
  }
}
```

**Response**:
```json
{
  "success": true,
  "waiting_list_id": 47,
  "status": "pending",
  "queue_info": {
    "position": 1,
    "total_waiting_specialty": 1,
    "priority_level": "Normal"
  },
  "requested_for": {
    "scheduled_date": null,
    "scheduled_date_status": "Sin fecha específica - Se asignará cuando haya cupo"
  }
}
```

**Verificación en BD**:
```sql
SELECT id, patient_id, scheduled_date, status 
FROM appointments_waiting_list 
WHERE id = 47;

-- Resultado:
-- id: 47
-- patient_id: 1057
-- scheduled_date: NULL ✅
-- status: pending
```

### Test 2: Con fecha programada (scheduled_date = valor específico)

**Request**:
```json
{
  "tool": "addToWaitingList",
  "arguments": {
    "patient_id": 1058,
    "availability_id": 156,
    "scheduled_date": "2025-10-22 10:00:00",
    "appointment_type": "Telemedicina",
    "reason": "Consulta especializada - fecha preferida",
    "priority_level": "Alta"
  }
}
```

**Response**:
```json
{
  "success": true,
  "waiting_list_id": 48,
  "status": "pending",
  "queue_info": {
    "position": 1,
    "total_waiting_specialty": 2,
    "priority_level": "Alta"
  },
  "requested_for": {
    "scheduled_date": "2025-10-22 10:00:00",
    "scheduled_date_status": "Fecha específica solicitada"
  }
}
```

**Verificación en BD**:
```sql
SELECT id, patient_id, scheduled_date, status 
FROM appointments_waiting_list 
WHERE id = 48;

-- Resultado:
-- id: 48
-- patient_id: 1058
-- scheduled_date: 2025-10-22 10:00:00 ✅
-- status: pending
```

---

## 📊 Resultados

| Test | Patient ID | scheduled_date | Resultado |
|------|------------|----------------|-----------|
| 1    | 1057       | NULL           | ✅ PASSED |
| 2    | 1058       | 2025-10-22 10:00:00 | ✅ PASSED |

**Tasa de éxito**: 2/2 (100%)

---

## 💡 Casos de Uso

### Caso 1: Paciente flexible con disponibilidad
```
Paciente: "Necesito cita de Odontología pero cualquier día me sirve"
Sistema: Agrega a lista de espera SIN fecha específica (NULL)
Resultado: Sistema asignará automáticamente cuando haya cupo
```

### Caso 2: Paciente con preferencia de fecha
```
Paciente: "Prefiero el 22 de octubre a las 10am, pero si no se puede acepto otra"
Sistema: Agrega a lista de espera CON fecha preferida
Resultado: Se intentará asignar esa fecha, pero hay flexibilidad
```

### Caso 3: Sistema automático sin conocimiento de disponibilidad
```
Sistema: Detecta necesidad de cita pero no tiene agenda disponible
Sistema: Agrega a lista de espera SIN fecha
Resultado: Operadora llamará al paciente cuando haya cupo
```

---

## 🔄 Flujo de Trabajo Actualizado

```
┌─────────────────────────────────────────────┐
│ Llamada: addToWaitingList                   │
│ - patient_id: 1057                          │
│ - availability_id: 155                      │
│ - scheduled_date: NO proporcionado          │
│ - reason: "Consulta general"                │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│ Sistema valida parámetros obligatorios:     │
│ ✅ patient_id                               │
│ ✅ availability_id                          │
│ ✅ reason                                   │
│ ⚠️  scheduled_date: OPCIONAL (NULL)         │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│ INSERT en appointments_waiting_list:        │
│ - scheduled_date = NULL                     │
│ - status = 'pending'                        │
│ - priority_level = 'Normal'                 │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│ Respuesta al usuario:                       │
│ "Se asignará cuando haya cupo disponible"   │
│ "Posición en cola: 1"                       │
└─────────────────────────────────────────────┘
```

---

## 📝 Cambios en Documentación

### Schema JSON actualizado

```json
{
  "name": "addToWaitingList",
  "inputSchema": {
    "properties": {
      "scheduled_date": {
        "type": "string",
        "description": "OPCIONAL - no se sabe cuándo se podrá asignar"
      }
    },
    "required": ["patient_id", "availability_id", "reason"]
  }
}
```

---

## 🚀 Despliegue

### Compilación
```bash
cd /home/ubuntu/app/mcp-server-node
npx tsc src/server-unified.ts --outDir dist --esModuleInterop --resolveJsonModule --moduleResolution node --target ES2020 --module commonjs
```

### Reinicio del servidor
```bash
pm2 restart mcp-unified
```

**Estado**: ✅ Online  
**Herramientas disponibles**: 16  
**Reinicio #**: 12

---

## 📈 Impacto

### Mejoras de UX
- ✅ Pacientes pueden solicitar citas sin especificar fecha
- ✅ Sistema más flexible para gestionar demanda
- ✅ Reduce fricción en el proceso de solicitud
- ✅ Operadoras pueden gestionar mejor la asignación

### Mejoras Técnicas
- ✅ Base de datos normalizada (NULL cuando no hay dato)
- ✅ Menos errores por fechas inválidas o inventadas
- ✅ Compatibilidad con flujos automatizados
- ✅ Reduce validaciones innecesarias

### Beneficios Operacionales
- 📞 Operadora llama al paciente cuando hay cupo
- 📅 Asignación de fecha real y confirmada
- 🎯 Mejor distribución de citas según disponibilidad real
- ⏱️ Ahorro de tiempo en reagendamientos

---

## 🔍 Verificación Post-Despliegue

```bash
# Ver últimos registros
mysql -u biosanar_user -p'...' -D biosanar -e "
  SELECT id, patient_id, scheduled_date, status 
  FROM appointments_waiting_list 
  ORDER BY id DESC LIMIT 5;
"

# Verificar NULL values
mysql -u biosanar_user -p'...' -D biosanar -e "
  SELECT COUNT(*) as total_sin_fecha
  FROM appointments_waiting_list 
  WHERE scheduled_date IS NULL AND status = 'pending';
"
```

---

## ✅ Conclusión

La actualización v1.4 implementa exitosamente el campo `scheduled_date` como **OPCIONAL** en la lista de espera, permitiendo una mayor flexibilidad en la gestión de citas y mejorando la experiencia del usuario al no requerir una fecha específica cuando no es conocida o relevante.

**Próximos pasos**:
- Actualizar el prompt con las nuevas instrucciones
- Documentar el flujo de asignación cuando scheduled_date es NULL
- Considerar notificaciones automáticas cuando haya cupos disponibles
