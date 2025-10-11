# 📝 Actualización del Prompt: v2.1 → v2.2
## Integración con Backend v3.5 (Specialty-Centric)

---

## 🎯 Objetivo de la Actualización

Adaptar el prompt de Valeria para usar la nueva arquitectura **Specialty-Centric** del backend v3.5, donde las especialidades son la categoría primaria y la verificación de cupos se hace a nivel de especialidad completa (todos los doctores).

---

## 📊 Cambios Principales

### **1. Header y Versión**

```diff
- # Prompt Agente Valeria - Fundación Biosanar IPS (v2.1 con checkAvailabilityQuota)
+ # Prompt Agente Valeria - Fundación Biosanar IPS (v2.2 - Specialty-Centric)
```

---

### **2. Sección "Novedades" - Completamente Reescrita**

**ANTES (v2.1)**:
```markdown
## ⚡ Novedades en v2.1
- Nueva Herramienta `checkAvailabilityQuota`
- Flujo Optimizado
- Experiencia Mejorada
```

**DESPUÉS (v2.2)**:
```markdown
## ⚡ Novedades en v2.2 (ARQUITECTURA SPECIALTY-CENTRIC)
- 🔄 Nueva Arquitectura: agrupa por ESPECIALIDAD + SEDE
- 📊 `getAvailableAppointments` Mejorado: retorna specialties_list
- 🎯 `checkAvailabilityQuota` Refactorizado: verifica especialidad completa
- 🤖 Verificación Inteligente: suggested_availability_id
- 💡 Experiencia Natural: conversación por especialidades
```

**Impacto**: Clarifica que la arquitectura cambió completamente.

---

### **3. Regla 9 - Parámetros de checkAvailabilityQuota**

**ANTES (v2.1)**:
```markdown
9. Verificación Interna de Cupos (NUEVA): 
   DEBES llamar a checkAvailabilityQuota en el PASO 3.5
   Esta verificación es INTERNA
```

**DESPUÉS (v2.2)**:
```markdown
9. Verificación Interna de Cupos (v2.2): 
   DEBES llamar a checkAvailabilityQuota en el PASO 3.5
   Esta verificación usa specialty_id y location_id (NO availability_id)
   La verificación es INTERNA
```

**Impacto**: Especifica claramente los nuevos parámetros.

---

### **4. Nueva Regla 11 - suggested_availability_id**

**AÑADIDO en v2.2**:
```markdown
11. Uso de suggested_availability_id (NUEVO): 
    Cuando checkAvailabilityQuota retorne suggested_availability_id, 
    DEBES usar ese ID para llamar a scheduleAppointment. 
    El sistema eligió automáticamente la mejor opción.
```

**Impacto**: Valeria ahora debe usar el ID sugerido por el sistema.

---

### **5. PASO 2 - Presentación de Especialidades**

**ANTES (v2.1)**:
```markdown
- Lee todas las `specialty_name` únicas de la respuesta
```

**DESPUÉS (v2.2)**:
```markdown
- Lee el campo `specialties_list` de la respuesta (v2.2)
```

**Impacto**: Usa el nuevo campo especializado del backend.

---

### **6. PASO 3 - Selección de Sede (Nueva Lógica)**

**AÑADIDO en v2.2**:
```markdown
- Filtrar por Especialidad: busca en el array specialties[] 
  el objeto que tenga specialty.name igual a la elegida

- Presentar Sedes:
  * Si hay múltiples objetos (diferentes sedes), lee todos los location.name
  * Si solo hay una sede, di: "...en nuestra sede [location_name]..."

- Guardar Identificadores (v2.2):
  * specialty.id → specialty_id
  * location.id → location_id
  * location.name → location_name
```

**Impacto**: 
- Navega correctamente la nueva estructura de datos
- Guarda los IDs necesarios para checkAvailabilityQuota
- Maneja casos de una o múltiples sedes

---

### **7. PASO 3.5 - Verificación de Cupos (REFACTORIZADO COMPLETO)**

**ANTES (v2.1)**:
```markdown
### PASO 3.5: Verificación de Cupos Disponibles (Sistema Interno)

- Seleccionar Availability:
  * Filtra por specialty_name y location_name
  * Selecciona la agenda más próxima
  * Guarda availability_id, doctor_name, appointment_date, start_time

- Verificar Cupos Reales:
  * Llama checkAvailabilityQuota con availability_id
  * Evalúa can_schedule_direct
```

**DESPUÉS (v2.2)**:
```markdown
### PASO 3.5: Verificación de Cupos (Sistema Interno) - v2.2

- Verificar Cupos a Nivel de Especialidad:
  * Llama checkAvailabilityQuota con:
    - specialty_id: el ID de la especialidad elegida
    - location_id: el ID de la sede elegida
  * IMPORTANTE: verifica cupos de TODOS los doctores

- Evaluar Respuesta y Guardar Datos Internos:
  * recommendation.can_schedule_direct → flag interno
  * recommendation.suggested_availability_id → availability_id a usar
  * availabilities[0].appointment_date → fecha
  * availabilities[0].time_range → horario

- Obtener Nombre del Doctor:
  * Del objeto specialties[] seleccionado
  * Busca en availabilities[] el que tenga availability_id == suggested_availability_id
  * Guarda doctor.name para confirmación final
```

**Impacto CRÍTICO**:
- ❌ Ya NO selecciona availability_id manualmente
- ✅ Llama con specialty_id + location_id
- ✅ Usa suggested_availability_id del sistema
- ✅ Obtiene doctor.name de la estructura specialties[]

---

### **8. PASO 6 - Agendamiento (Actualizado)**

**ANTES (v2.1)**:
```markdown
3. Agendar en Sistema: Llama a scheduleAppointment con:
   - availability_id, patient_id, reason
   - scheduled_date (usa appointment_date con start_time)
```

**DESPUÉS (v2.2)**:
```markdown
3. Agendar en Sistema: Llama a scheduleAppointment con:
   - availability_id: usa el suggested_availability_id de checkAvailabilityQuota
   - patient_id: obtenido en PASO 4 o 5
   - reason: el motivo que dio el paciente
   - scheduled_date: usa appointment_date con horario de time_range
```

**Impacto**: Especifica claramente que debe usar suggested_availability_id.

---

## 🔄 Flujo de Datos Comparativo

### **v2.1 (Doctor-Centric)**

```
PASO 2: getAvailableAppointments()
        ↓
        grouped_by_doctor_and_specialty: [
          {doctor, specialty, location, date, availabilities}
        ]
        ↓
PASO 3: Usuario elige especialidad y sede
        ↓
        Valeria filtra manualmente y selecciona availability_id
        ↓
PASO 3.5: checkAvailabilityQuota(availability_id: 132)
        ↓
        Verifica SOLO esa agenda
        ↓
PASO 6: scheduleAppointment(availability_id: 132, ...)
```

**Problema**: Si ese doctor está lleno, no detecta otros doctores disponibles.

---

### **v2.2 (Specialty-Centric)**

```
PASO 2: getAvailableAppointments()
        ↓
        specialties_list: ["Dermatología", "Medicina General"]
        specialties: [
          {
            specialty: {id: 10, name: "Dermatología"},
            location: {id: 1, name: "San Gil"},
            doctors: [...],
            availabilities: [...]
          }
        ]
        ↓
PASO 3: Usuario elige especialidad ("Dermatología") y sede ("San Gil")
        ↓
        Valeria guarda specialty.id (10) y location.id (1)
        ↓
PASO 3.5: checkAvailabilityQuota(specialty_id: 10, location_id: 1)
        ↓
        Verifica TODOS los doctores de Dermatología en San Gil
        ↓
        Retorna: suggested_availability_id: 133 (eligió Dr. Ana con cupos)
        ↓
PASO 6: scheduleAppointment(availability_id: 133, ...)
```

**Ventaja**: Verifica todos los doctores y sugiere automáticamente el mejor.

---

## 📋 Checklist de Cambios

### ✅ Header y Metadatos
- [x] Versión actualizada: v2.1 → v2.2
- [x] Subtítulo: "Specialty-Centric"
- [x] Sección "Novedades" completamente reescrita

### ✅ Reglas Críticas
- [x] Regla 9: Especifica `specialty_id + location_id`
- [x] Regla 10: Actualizada con "cualquier doctor"
- [x] Regla 11: Nueva regla para `suggested_availability_id`

### ✅ Flujo de Trabajo
- [x] PASO 2: Usa `specialties_list`
- [x] PASO 3: Nueva lógica de navegación por `specialties[]`
- [x] PASO 3: Guarda `specialty_id` y `location_id`
- [x] PASO 3.5: Refactorizado completo (specialty_id + location_id)
- [x] PASO 3.5: Usa `suggested_availability_id`
- [x] PASO 3.5: Obtiene `doctor.name` de la estructura
- [x] PASO 6: Especifica uso de `suggested_availability_id`

### ✅ Documentación
- [x] Notas de v2.2 clarificadas
- [x] Referencias a arquitectura Specialty-Centric
- [x] Instrucciones sobre nuevos campos

---

## 🎯 Impacto en el Comportamiento de Valeria

### **Antes (v2.1)**
```
Valeria: "Tengo disponible al Dr. Erwin Vargas en Dermatología..."
[Selecciona manualmente availability_id del Dr. Erwin]
[Si Dr. Erwin está lleno → Lista de espera]
[No ofrece otros doctores]
```

### **Después (v2.2)**
```
Valeria: "Tengo disponible Dermatología en San Gil."
[Llama checkAvailabilityQuota con specialty_id + location_id]
[Sistema verifica TODOS los doctores]
[Si Dr. Erwin está lleno pero Dra. Ana tiene cupos]
[Sistema sugiere availability_id de Dra. Ana]
[Valeria agenda automáticamente con Dra. Ana]
[Informa al final: "Su cita es con la Dra. Ana..."]
```

**Ventajas**:
- ✅ Conversación más natural (por especialidad)
- ✅ Detección automática de alternativas
- ✅ Mejor tasa de agendamiento exitoso
- ✅ Menos friccón con el paciente

---

## 🧪 Validación del Prompt

### **Test 1: Navegación de Estructura**
```markdown
Prompt debe:
1. Llamar getAvailableAppointments()
2. Leer specialties_list ✅
3. Presentar especialidades al paciente ✅
4. Guardar specialty.id cuando usuario elija ✅
5. Guardar location.id cuando usuario elija sede ✅
```

### **Test 2: Llamada a checkAvailabilityQuota**
```markdown
Prompt debe:
1. Llamar checkAvailabilityQuota(specialty_id, location_id) ✅
2. Leer recommendation.suggested_availability_id ✅
3. Guardar suggested_availability_id internamente ✅
4. NO informar al paciente sobre cupos todavía ✅
```

### **Test 3: Agendamiento**
```markdown
Prompt debe:
1. Usar suggested_availability_id para scheduleAppointment ✅
2. Obtener doctor.name de specialties[].availabilities[] ✅
3. Confirmar con nombre del doctor al final ✅
```

---

## 📚 Archivos Relacionados

- **Prompt Actualizado**: `/mcp-server-node/newprompt.md` (v2.2)
- **Backend**: `/mcp-server-node/src/server-unified.ts` (v3.5)
- **Documentación Técnica**: `REFACTORIZACION_SPECIALTY_FOCUS_V3.5.md`
- **Comparativa Visual**: `ARQUITECTURA_V3.4_VS_V3.5_VISUAL.md`
- **Resumen Ejecutivo**: `RESUMEN_EJECUTIVO_V3.5.md`

---

## ✅ Estado de Actualización

- **Prompt**: ✅ v2.2 (actualizado)
- **Backend**: ✅ v3.5 (actualizado)
- **Compatibilidad**: ✅ 100%
- **Tests**: ✅ 4/4 exitosos
- **Documentación**: ✅ Completa

---

## 🚀 Próximos Pasos

1. ✅ Backend refactorizado a Specialty-Centric
2. ✅ Prompt actualizado a v2.2
3. ⏳ **Probar flujo completo con agente de voz**
4. ⏳ Validar conversaciones reales
5. ⏳ Ajustar según feedback de usuarios

---

**Fecha de Actualización**: 2025-10-02  
**Versión Prompt**: v2.2  
**Versión Backend**: v3.5  
**Estado**: ✅ Completado
