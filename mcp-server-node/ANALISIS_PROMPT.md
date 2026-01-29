# 🔍 Análisis del Prompt vs Herramientas MCP

**Fecha:** 14 de enero de 2026  
**Archivo analizado:** [promt.md](promt.md)  
**Servidor:** server-unified.ts (29 herramientas MCP)

---

## ✅ Herramientas Correctamente Implementadas (12/29)

| # | Herramienta | Ubicación en Prompt | Estado |
|---|-------------|---------------------|--------|
| 1 | `searchPatient` | PASO 3 - Búsqueda validación | ✅ OK |
| 2 | `registerPatientSimple` | CASO B - Registro nuevo | ✅ OK |
| 3 | `getPatientAppointments` | PASO 4 - Verificar citas | ✅ OK |
| 4 | `actualizarPhone` | PASO 4.1 - Actualizar teléfonos | ✅ OK |
| 5 | `cancelarCitasVencidas` | PASO 4 - Limpieza silenciosa | ✅ OK |
| 6 | `getEPSServices` | Consultar servicios autorizados | ✅ OK |
| 7 | `listActiveEPS` | Validación de EPS | ✅ OK |
| 8 | `searchSpecialties` | Obtener specialty_id | ✅ OK |
| 9 | `searchCups` | PASO 5 - Ecografías/CUPS | ✅ OK |
| 10 | `searchCupsByName` | PASO 5 CASO B | ✅ OK |
| 11 | `getAvailableAppointments` | PASO 6 - Consultar horarios | ✅ OK |
| 12 | `addToWaitingList` | PASO 6 - Sin cupos | ✅ OK |

---

## ❌ Problemas Críticos Detectados

### 1. **Falta `scheduleAppointment` en el Flujo**
**Severidad:** 🔴 CRÍTICA

**Problema:**
- PASO 6 dice "Agenda directamente" pero **NO especifica llamar a la herramienta**
- Línea: "¡Excelente! He encontrado disponibilidad y he agendado tu cita..."

**Ubicación:** [promt.md](promt.md#L33)

**Solución:**
```markdown
Si hay cupos (desde mañana en adelante): 
→ Llama a scheduleAppointment(
    patient_id=[del PASO 3 o CASO B],
    availability_id=[de getAvailableAppointments],
    reason=[motivo conversacional],
    scheduled_date=[fecha seleccionada],
    appointment_type="Presencial"
  )
→ Informa: "¡Excelente! He agendado tu cita para [Especialidad]..."
```

---

### 2. **Falta `checkAvailabilityQuota` Antes de Agendar**
**Severidad:** 🟠 ALTA

**Problema:**
- No se verifica cupos agregados antes de intentar agendar
- Según docs: "DEBE LLAMARSE ANTES de scheduleAppointment"

**Solución:**
```markdown
PASO 6 (nuevo sub-paso):
1. checkAvailabilityQuota(specialty_id, location_id, day_date)
2. Analizar respuesta:
   - Si can_schedule=true → Procede con scheduleAppointment
   - Si can_schedule=false → Ofrece addToWaitingList
```

---

### 3. **Cancelación de Citas Duplicadas No Implementada**
**Severidad:** 🟠 ALTA

**Problema:**
- PASO 4 dice: "Si ya tiene una cita en la misma especialidad, se cancela automáticamente"
- ❌ **NO especifica llamar a `cancelAppointment`**

**Ubicación:** Análisis de citas vigentes (PASO 4)

**Solución:**
```markdown
ESCENARIO A (mejorado):
Si la especialidad solicitada es IGUAL a una cita confirmada:
1. Pregunta: "Ya tienes una cita activa para [Especialidad] el [Fecha]. 
   ¿Deseas cancelarla y agendar una nueva?"
2. Si acepta:
   → cancelAppointment(appointment_id, cancellation_reason="Reagendamiento solicitado")
   → Procede con scheduleAppointment
3. Si rechaza:
   → Ofrece addToWaitingList
```

---

### 4. **Base de Conocimientos No Documentada**
**Severidad:** 🟡 MEDIA

**Problema:**
- REGLA A menciona: "base de conocimientos con ID: **x5jys5UkEfEDYizJiX1n**"
- Este ID NO aparece en ningún archivo del sistema

**Acción requerida:**
- ✅ Verificar que el ID existe en ElevenLabs Agent Studio
- ✅ Documentar qué información contiene esa base de conocimientos

---

## ⚠️ Herramientas Disponibles NO Usadas (17/29)

### Gestión de Catálogos
- `listZones` - Útil para mostrar zonas en CASO 1

### Gestión de Citas
- `cancelAppointment` - Para cancelar citas duplicadas
- `reassignWaitingListAppointments` - Procesar lista de espera
- `getWaitingListAppointments` - Consultar posición en cola

### Mantenimiento
- `syncAvailabilityQuotas` - Corregir inconsistencias
- `auditAvailabilityQuotas` - Auditar cupos

### Embarazos (No mencionados en prompt)
- `registerPregnancy`
- `getActivePregnancies`
- `updatePregnancyStatus`
- `registerPrenatalControl`

---

## 🔧 Mejoras Sugeridas al Flujo

### **Mejora 1: Verificación de Cupos Antes de Agendar**

**Insertar entre PASO 6 actual:**

```markdown
PASO 6A: VERIFICACIÓN DE CUPOS (NUEVO)
Antes de agendar, verifica disponibilidad agregada:

checkAvailabilityQuota(
  specialty_id=[de getAvailableAppointments],
  location_id=[de getAvailableAppointments],
  day_date=[fecha seleccionada YYYY-MM-DD]
)

Analizar respuesta:
- total_quota: Cupos totales del día
- assigned_quota: Cupos ya asignados
- available_quota: Cupos libres
- can_schedule: true/false

SI can_schedule = true:
  → Procede a PASO 6B (Agendar)

SI can_schedule = false:
  → Salta a PASO 6C (Lista de Espera)
```

---

### **Mejora 2: Llamada Explícita a scheduleAppointment**

**Reemplazar en PASO 6:**

```markdown
PASO 6B: AGENDAMIENTO DIRECTO (MEJORADO)
Ejecutar:
scheduleAppointment(
  patient_id=[obtenido en PASO 3 o CASO B],
  availability_id=[de getAvailableAppointments],
  reason=[motivo conversacional del paciente],
  scheduled_date=[fecha elegida en formato YYYY-MM-DD],
  appointment_type="Presencial",
  priority_level="Normal"
)

Respuesta al paciente:
"¡Excelente! He agendado tu cita para [Especialidad] 
el día [Fecha] a las [Hora]. 
En breve recibirás un mensaje de confirmación con todos los detalles. 
¿Puedo ayudarte en algo más?"
```

---

### **Mejora 3: Gestión de Citas Duplicadas**

**Insertar en PASO 4 (después de "Analizar Citas"):**

```markdown
MANEJO DE CITAS DUPLICADAS EN MISMA ESPECIALIDAD:

SI encuentra cita "Confirmada" en la MISMA especialidad solicitada:

1. Informar situación:
   "Veo que ya tienes una cita confirmada para [Especialidad] 
   programada el [Fecha] a las [Hora]."

2. Ofrecer opciones:
   a) "¿Deseas mantener esa cita o prefieres cancelarla y agendar una nueva?"
   
3. SI elige cancelar:
   → cancelAppointment(
       appointment_id=[de getPatientAppointments],
       cancellation_reason="Paciente solicitó reagendar"
     )
   → Confirma: "He cancelado tu cita anterior."
   → Procede con nuevo agendamiento (PASO 6)

4. SI elige mantener:
   → Responde: "Perfecto, mantenemos tu cita del [Fecha]."
   → Finaliza o pregunta si necesita otra cosa
```

---

### **Mejora 4: Uso de Prioridad en Lista de Espera**

**Actualizar en PASO 6:**

```markdown
PASO 6C: LISTA DE ESPERA (MEJORADO)
Si NO hay cupos después del filtro:

1. Evaluar urgencia del caso (interno):
   - Síntomas graves → priority_level="Urgente"
   - Seguimiento médico → priority_level="Alta"
   - Consulta preventiva → priority_level="Normal"
   - Otro → priority_level="Baja"

2. Llamar herramienta:
   addToWaitingList(
     patient_id=[del PASO 3 o CASO B],
     specialty_id=[de searchSpecialties],
     cups_id=[si aplica, del PASO 5],
     reason=[motivo conversacional],
     priority_level=[determinado en punto 1],
     appointment_type="Presencial",
     requested_by="Sistema_ElevenLabs"
   )

3. Informar al paciente:
   "Te he agregado a nuestra lista de espera para [Especialidad]. 
   Te contactaremos cuando tengamos disponibilidad. 
   ¿Hay algo más en lo que te pueda ayudar?"
```

---

## 📊 Estadísticas de Uso

| Categoría | Total Disponibles | Usadas en Prompt | % Uso |
|-----------|-------------------|------------------|-------|
| **Gestión Catálogos** | 3 | 2 | 67% |
| **Gestión Pacientes** | 3 | 3 | 100% |
| **Sistema de Citas** | 9 | 4 | 44% |
| **CUPS/Procedimientos** | 2 | 2 | 100% |
| **Embarazos** | 4 | 0 | 0% |
| **Mantenimiento** | 4 | 0 | 0% |
| **Utilidades** | 2 | 2 | 100% |
| **TOTAL** | **29** | **12** | **41%** |

---

## ✅ Validaciones Correctas

### 1. Normalización de Documentos ✅
```markdown
Ejemplo: "17-265.900" → "17265900"
```
Correcto según implementación en server-unified.ts

### 2. Vocalización de Números (REGLA C) ✅
- Teléfonos: 3-3-4 dígitos
- Documentos: Pares
- CUPS: Pares

### 3. Filtro de Fechas (REGLA E) ✅
```markdown
Fechas pasadas: DESCARTAR
Fecha actual (HOY): DESCARTAR  
Oferta: Desde MAÑANA en adelante
```

### 4. Lógica de Medicina General (REGLA 1) ✅
- Hipertensión, medicamentos, controles crónicos → "Medicina General"

### 5. Tabla de Crecimiento y Desarrollo (REGLA 2) ✅
- Correctamente implementada por edades

---

## 🎯 Plan de Acción Recomendado

### Prioridad 1 (Críticas - Implementar YA)
- [ ] Agregar llamada explícita a `scheduleAppointment` en PASO 6
- [ ] Implementar `checkAvailabilityQuota` antes de agendar
- [ ] Especificar uso de `cancelAppointment` para citas duplicadas

### Prioridad 2 (Altas - Próxima Iteración)
- [ ] Verificar ID de base de conocimientos en ElevenLabs
- [ ] Agregar parámetro `priority_level` en lista de espera
- [ ] Documentar manejo de casos urgentes

### Prioridad 3 (Medias - Mejoras Futuras)
- [ ] Integrar gestión de embarazos si aplica
- [ ] Usar `listZones` para mostrar alternativas
- [ ] Implementar `getWaitingListAppointments` para consultar posición

### Prioridad 4 (Bajas - Opcional)
- [ ] Corregir puerto en README.md (8976→8977)
- [ ] Documentar herramientas de mantenimiento
- [ ] Crear flujos para reagendamiento

---

## 📝 Conclusión

**Estado General:** 🟡 FUNCIONAL CON MEJORAS NECESARIAS

**Cobertura:** 41% de herramientas utilizadas (12/29)

**Problemas Críticos:** 3
- Falta `scheduleAppointment` explícito
- No usa `checkAvailabilityQuota`
- Cancelación de duplicados no implementada

**Fortalezas:**
- ✅ Flujo conversacional bien estructurado
- ✅ Validaciones de datos correctas
- ✅ Manejo de casos especiales (PyP, Medicina General)
- ✅ Filtros de fecha implementados

**Debilidades:**
- ❌ Herramientas clave no llamadas explícitamente
- ❌ Falta verificación de cupos agregados
- ❌ Gestión de embarazos no integrada

---

**Próximo Paso:**
Aplicar las mejoras de Prioridad 1 al archivo [promt.md](promt.md) para garantizar uso correcto de todas las herramientas MCP disponibles.
