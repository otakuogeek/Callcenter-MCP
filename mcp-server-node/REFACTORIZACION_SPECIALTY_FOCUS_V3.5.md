# 🔄 Refactorización a Arquitectura Basada en ESPECIALIDAD
## Versión 3.5 - Cambio de Paradigma: Doctor-Centric → Specialty-Centric

---

## 📋 Resumen Ejecutivo

**Objetivo**: Refactorizar el sistema para que agrupe y presente información por **ESPECIALIDAD + SEDE** en lugar de **DOCTOR + ESPECIALIDAD**.

**Razón**: El usuario necesita ver las especialidades como categorías primarias, sin mezclar doctores. La sede es el segundo nivel de agrupación, y el doctor es un detalle interno.

**Impacto**: 
- ✅ 2 funciones refactorizadas
- ✅ 1 schema de herramienta actualizado
- ✅ Arquitectura completamente reorientada
- ✅ Compatible con flujo del prompt v2.1

---

## 🎯 Cambios Realizados

### **1. getAvailableAppointments** - Agrupación por ESPECIALIDAD + SEDE

#### **ANTES (v3.4) - Doctor-Centric**
```typescript
// Agrupaba por: fecha + doctor_id + specialty_id
const groupKey = `${dateKey}_doctor${apt.doctor_id}_specialty${apt.specialty_id}`;

// Estructura de salida:
grouped_by_doctor_and_specialty: [
  {
    doctor: {...},
    specialty: {...},
    location: {...},
    date: '2025-10-10',
    availabilities: [...]
  }
]
```

**Problema**: Presentaba doctores como categoría principal, especialidades como secundarias.

---

#### **DESPUÉS (v3.5) - Specialty-Centric**
```typescript
// Agrupa por: specialty_id + location_id
const groupKey = `specialty${apt.specialty_id}_location${apt.location_id}`;

// Estructura de salida:
specialties: [
  {
    specialty: {id: 10, name: "Dermatología"},
    location: {id: 1, name: "Sede biosanar san gil", ...},
    doctors: [{id: 15, name: "Dr. Erwin...", ...}],  // Array de todos los doctores
    availabilities: [
      {
        availability_id: 132,
        appointment_date: '2025-10-10',
        doctor: {id: 15, name: "Dr. Erwin..."},
        slots_available: 6,
        ...
      }
    ],
    total_slots_available: 6,
    total_waiting_list: 3,
    earliest_date: '2025-10-10',
    has_direct_availability: true
  }
]

// Además incluye:
specialties_count: 2,
specialties_list: ["Dermatología", "Medicina General"]
```

**Beneficios**:
- ✅ Especialidad es la categoría primaria
- ✅ Sede es el segundo nivel de agrupación
- ✅ Doctores aparecen como array dentro de cada especialidad+sede
- ✅ Todas las agendas de la especialidad visibles en un solo objeto
- ✅ Fácil presentar: "Tenemos disponible Dermatología en San Gil"

---

### **2. checkAvailabilityQuota** - Agregación a Nivel de Especialidad

#### **ANTES (v3.4) - Granular por Agenda Individual**
```typescript
// Input:
{
  availability_id: 132,  // Una agenda específica (1 doctor, 1 fecha, 1 hora)
  day_date: '2025-10-10' // Opcional
}

// Output:
{
  availability_id: 132,
  doctor: {id: 15, name: "Dr. Erwin..."},
  specialty: {id: 10, name: "Dermatología"},
  location: {id: 1, name: "Sede..."},
  quota_summary: {
    total_quota: 10,      // Solo de esta agenda
    total_assigned: 4,     // Solo de esta agenda
    total_available: 6     // Solo de esta agenda
  }
}
```

**Problema**: 
- Solo verificaba UNA agenda específica
- Si el doctor A estaba lleno pero el doctor B tenía cupos, el sistema no lo detectaba
- Prompt no podía tomar decisiones a nivel de especialidad

---

#### **DESPUÉS (v3.5) - Agregado por Especialidad + Sede**
```typescript
// Input:
{
  specialty_id: 10,      // Dermatología
  location_id: 1,        // San Gil
  day_date: '2025-10-10' // Opcional
}

// Output:
{
  specialty: {id: 10, name: "Dermatología"},
  location: {id: 1, name: "Sede biosanar san gil", ...},
  doctors_available: 1,                    // Total de doctores con agendas
  total_availabilities: 1,                 // Total de agendas configuradas
  quota_summary: {
    total_quota: 10,      // ✅ SUMA de TODAS las agendas
    total_assigned: 4,     // ✅ SUMA de TODAS las agendas
    total_available: 6,    // ✅ SUMA de TODAS las agendas
    waiting_list_count: 3  // Lista de espera de toda la especialidad
  },
  doctors_list: ["Dr. Erwin Alirio Vargas Ariza"],
  availabilities: [
    {
      availability_id: 132,
      appointment_date: '2025-10-10',
      doctor: {id: 15, name: "Dr. Erwin..."},
      slots_available: 6,
      has_availability: true
    }
  ],
  recommendation: {
    can_schedule_direct: true,
    suggested_availability_id: 132,  // ✅ Sugiere cuál usar
    message: "Hay 6 cupo(s) disponible(s) en toda la especialidad"
  }
}
```

**Beneficios**:
- ✅ Verifica TODOS los doctores de la especialidad en esa sede
- ✅ Agrega cupos de TODAS las agendas
- ✅ Decisión a nivel de especialidad: "¿Hay cupos en Dermatología?"
- ✅ Sugiere availability_id específico para agendar
- ✅ Si un doctor está lleno pero otro tiene cupos, lo detecta
- ✅ Prompt puede decir: "Hay cupos disponibles en Dermatología, ¿desea agendar?"

---

### **3. Schema Actualizado en UNIFIED_TOOLS**

```typescript
{
  name: 'checkAvailabilityQuota',
  description: 'Verifica cuántos cupos hay disponibles para una ESPECIALIDAD en una SEDE específica. Agrega TODOS los cupos de todos los doctores de esa especialidad...',
  inputSchema: {
    type: 'object',
    properties: {
      specialty_id: {
        type: 'number',
        description: 'ID de la especialidad a verificar (obtenido de getAvailableAppointments en specialty.id)'
      },
      location_id: {
        type: 'number',
        description: 'ID de la sede/ubicación a verificar (obtenido de getAvailableAppointments en location.id)'
      },
      day_date: {
        type: 'string',
        description: 'Fecha específica a verificar en formato YYYY-MM-DD (opcional)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      }
    },
    required: ['specialty_id', 'location_id']  // ✅ Cambió de availability_id
  }
}
```

---

## 🧪 Pruebas Realizadas

### **Test 1: getAvailableAppointments - Agrupación por Especialidad**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"getAvailableAppointments","arguments":{}}}'
```

**Resultado**:
```json
{
  "specialties_count": 2,
  "specialties_list": ["Dermatología", "Medicina General"],
  "specialties": [
    {
      "specialty": {"id": 10, "name": "Dermatología"},
      "location": {"id": 1, "name": "Sede biosanar san gil"},
      "doctors": [{"id": 15, "name": "Dr. Erwin..."}],
      "total_slots_available": 6,
      "has_direct_availability": true
    }
  ]
}
```
✅ **Éxito**: Agrupado por ESPECIALIDAD + SEDE

---

### **Test 2: checkAvailabilityQuota - Dermatología CON cupos**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"checkAvailabilityQuota","arguments":{"specialty_id":10,"location_id":1}}}'
```

**Resultado**:
```json
{
  "specialty": {"id": 10, "name": "Dermatología"},
  "doctors_available": 1,
  "quota_summary": {
    "total_quota": 10,
    "total_assigned": 4,
    "total_available": 6
  },
  "recommendation": {
    "can_schedule_direct": true,
    "suggested_availability_id": 132,
    "message": "Hay 6 cupo(s) disponible(s) en toda la especialidad"
  }
}
```
✅ **Éxito**: Agregó cupos de toda la especialidad

---

### **Test 3: checkAvailabilityQuota - Medicina General SIN cupos**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"checkAvailabilityQuota","arguments":{"specialty_id":1,"location_id":1}}}'
```

**Resultado**:
```json
{
  "specialty": {"id": 1, "name": "Medicina General"},
  "quota_summary": {
    "total_quota": 10,
    "total_assigned": 10,
    "total_available": 0
  },
  "recommendation": {
    "can_schedule_direct": false,
    "should_use_waiting_list": true,
    "message": "No hay cupos disponibles en ningún doctor. Se agregará a lista de espera automáticamente."
  }
}
```
✅ **Éxito**: Detectó que NO hay cupos y recomienda lista de espera

---

### **Test 4: Verificar Schema Actualizado**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -d '{"jsonrpc":"2.0","method":"tools/list"}'
```

**Resultado**:
```json
{
  "name": "checkAvailabilityQuota",
  "required": ["specialty_id", "location_id"]
}
```
✅ **Éxito**: Schema actualizado correctamente

---

## 📊 Comparativa de Arquitectura

| Aspecto | v3.4 (Doctor-Centric) | v3.5 (Specialty-Centric) |
|---------|----------------------|--------------------------|
| **Agrupación Primaria** | Doctor + Especialidad | **Especialidad + Sede** |
| **Presentación** | "Dr. Erwin tiene citas en Dermatología" | **"Dermatología disponible en San Gil"** |
| **checkAvailabilityQuota** | Verifica 1 agenda específica | **Verifica TODA la especialidad** |
| **Decisión de Cupos** | Por doctor individual | **Por especialidad completa** |
| **Input Principal** | `availability_id` | **`specialty_id + location_id`** |
| **Agregación** | Una agenda | **Todas las agendas de la especialidad** |
| **Detección Multi-Doctor** | ❌ No detecta si otro doctor tiene cupos | **✅ Detecta cupos en cualquier doctor** |
| **UX del Prompt** | "¿Quiere cita con Dr. Erwin?" | **"¿Quiere cita en Dermatología?"** |

---

## 🔗 Integración con Prompt v2.1

### **PASO 3: Presentación de Especialidades**
```
Valeria: "Tenemos agenda disponible para Dermatología y Medicina General."
```
✅ Usa `specialties_list` de `getAvailableAppointments`

---

### **PASO 3: Presentación de Sedes**
```
Valeria: "Para Dermatología, puede agendar en Sede San Gil."
```
✅ Usa `specialties[].location.name`

---

### **PASO 3.5: Verificación Interna de Cupos**
```javascript
// Prompt llama INTERNAMENTE (sin informar al paciente):
checkAvailabilityQuota({
  specialty_id: 10,  // Dermatología
  location_id: 1     // San Gil
})

// Si can_schedule_direct = true:
//   → AGENDA_DIRECTA = true
//   → Continúa flujo normal
// Si can_schedule_direct = false:
//   → LISTA_ESPERA = true
//   → Pide prioridad y agenda en lista de espera
```
✅ Decisión a nivel de especialidad completa

---

### **PASO 6: Agendamiento**
```javascript
// Para AGENDA_DIRECTA:
scheduleAppointment({
  patient_id: 123,
  availability_id: response.recommendation.suggested_availability_id,  // ✅ Sugerido por checkAvailabilityQuota
  scheduled_date: '2025-10-10 08:00:00',
  reason: 'Control dermatológico'
})

// Para LISTA_ESPERA:
scheduleAppointment({
  patient_id: 123,
  availability_id: response.recommendation.suggested_availability_id,
  scheduled_date: '2025-10-10 08:00:00',
  reason: 'Control dermatológico',
  priority_level: 'Alta'  // ✅ Sistema detecta que no hay cupos y usa lista de espera
})
```

---

## 🚀 Impacto en UX

### **Antes (v3.4)**
```
Valeria: "Tengo disponible al Dr. Erwin Vargas en Dermatología..."
Paciente: "¿Y hay otros doctores?"
Valeria: [No sabe, debe consultar de nuevo]
```

### **Después (v3.5)**
```
Valeria: "Tengo disponible Dermatología en San Gil."
Paciente: "¿Hay cupos?"
Valeria: [Ya verificó TODA la especialidad] "Sí, hay 6 cupos disponibles."
Paciente: "¿Con qué doctor?"
Valeria: [Después de confirmar] "Su cita quedó con el Dr. Erwin Vargas."
```

**Ventajas**:
- ✅ Conversación más natural (por especialidad, no por doctor)
- ✅ Información completa de la especialidad
- ✅ Decisión informada ANTES de pedir datos del paciente
- ✅ Si un doctor está lleno, ofrece automáticamente otro de la misma especialidad

---

## 📝 Archivos Modificados

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `server-unified.ts` | ~3,085 | ✅ getAvailableAppointments refactorizado (líneas 516-747) |
| | | ✅ checkAvailabilityQuota refactorizado (líneas 750-950) |
| | | ✅ UNIFIED_TOOLS schema actualizado (línea 158-175) |
| `REFACTORIZACION_SPECIALTY_FOCUS_V3.5.md` | Nuevo | ✅ Documentación técnica de cambios |

---

## ✅ Estado del Sistema

- **Backend MCP**: ✅ Online, PM2 (16 restarts)
- **Versión**: v3.5
- **Herramientas**: 8 total
- **Compilación**: ✅ Sin errores
- **Pruebas**: ✅ 4/4 exitosas
- **Arquitectura**: ✅ **Specialty-Centric**

---

## 📌 Próximos Pasos (Pendientes)

### ⚠️ **IMPORTANTE: Actualizar newprompt.md**

El prompt v2.1 actual todavía hace referencia a:
```markdown
PASO 3.5: Llama checkAvailabilityQuota con el `availability_id` seleccionado
```

**Debe actualizarse a**:
```markdown
PASO 3.5: Llama checkAvailabilityQuota con `specialty_id` y `location_id` elegidos
```

### Cambios en el Prompt

1. **PASO 3.5** - Actualizar llamada a checkAvailabilityQuota:
   ```
   VIEJO: "Llama a checkAvailabilityQuota con availability_id"
   NUEVO: "Llama a checkAvailabilityQuota con specialty_id y location_id"
   ```

2. **PASO 6** - Usar suggested_availability_id:
   ```
   NUEVO: "Usa el suggested_availability_id retornado por checkAvailabilityQuota"
   ```

3. **Regla 9** - Actualizar parámetros:
   ```
   VIEJO: "checkAvailabilityQuota(availability_id)"
   NUEVO: "checkAvailabilityQuota(specialty_id, location_id)"
   ```

---

## 🎓 Lecciones Aprendidas

1. **Especialidad como Categoría Principal**: Los pacientes piensan en "necesito Dermatología", no en "necesito al Dr. X"
2. **Agregación Multi-Doctor**: Esencial verificar TODOS los doctores de una especialidad
3. **Decisión Informada**: checkAvailabilityQuota debe dar respuesta a nivel de especialidad completa
4. **UX Natural**: Presentar especialidades primero, doctores después
5. **Flexibilidad**: Si un doctor está lleno, el sistema automáticamente busca otros

---

## 📖 Referencias

- **Sistema Anterior**: v3.4 (Doctor-Centric)
- **Sistema Actual**: v3.5 (Specialty-Centric)
- **Prompt Actual**: v2.1 (requiere actualización)
- **Documentación**: CHECKAVAILABILITYQUOTA_TOOL.md, RESUMEN_SISTEMA_COMPLETO_V3.4.md

---

**Fecha**: 2025-01-XX  
**Autor**: GitHub Copilot  
**Versión**: 3.5  
**Estado**: ✅ Implementado y Probado
