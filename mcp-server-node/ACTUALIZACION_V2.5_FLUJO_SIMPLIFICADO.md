# Actualización v2.5 - Flujo Simplificado en 8 Pasos

**Fecha:** 2025-01-XX  
**Versión Anterior:** v2.4 (UX Ultra Simplificada)  
**Versión Nueva:** v2.5 (Flujo Optimizado)

---

## 🎯 Objetivo del Cambio

**Simplificar radicalmente la estructura del flujo de trabajo**, pasando de un sistema complejo con múltiples PASOS anidados y condicionales visibles, a un **flujo lineal y secuencial de 8 pasos claros**.

### Problema Identificado

El flujo v2.4 tenía:
- 7 PASOS principales con muchos sub-pasos
- Lógica condicional visible (PASO 3.5, PASO 6 con bifurcaciones)
- Estructura compleja que dificultaba seguir el proceso
- Demasiados detalles técnicos expuestos en el flujo principal

### Solución Implementada

**Nuevo flujo de 8 pasos numerados:**

1. **Ofrecer especialidades disponibles** (saludo + consulta)
2. **Ofrecer ubicación/sede** (filtrar por especialidad)
3. **Confirmar intención de agendar** (pregunta simple)
4. **Solicitar cédula y verificar paciente** (buscar o registrar)
5. **Registrar cita automáticamente** (sin mencionar cupos)
6. **Confirmar resultado** (detalles completos o mensaje de contacto)
7. **Ofrecer ayuda adicional** (despedida amable)
8. **Colgar llamada** (cierre profesional)

---

## 📋 Cambios Detallados

### 1. Restructuración del Flujo Principal

#### Antes (v2.4):
```
PASO 1: Saludo e Inicio
PASO 2: Consulta y Presentación
  - Consultar disponibilidad
  - Evaluar respuesta
  - Presentar especialidades
PASO 3: Selección de Sede
  - Filtrar por especialidad
  - Presentar sedes
  - Confirmar intención
  - Guardar identificadores
PASO 3.5: Verificación de Cupos (VISIBLE)
  - Verificar cupos
  - Evaluar respuesta
  - Guardar datos internos
  - Obtener nombre del doctor
  - REGLA CRÍTICA
PASO 4: Verificación de Datos del Paciente
  - Manejo de preguntas
  - Solicitar cédula
  - Normalizar
  - Buscar paciente
  - Evaluar búsqueda
PASO 5: Validación de Datos Adicionales
PASO 6: Agendamiento y Confirmación (BIFURCADO)
  - SI flag = CITA_CONFIRMADA → rama 1
  - SI flag = SOLICITUD_PENDIENTE → rama 2
PASO 7: Cierre
```

#### Ahora (v2.5):
```
PASO 1: Ofrecer especialidades disponibles
PASO 2: Ofrecer ubicación/sede
PASO 3: Confirmar intención de agendar
PASO 3.5: Verificación interna de cupos (NO VISIBLE - nota técnica)
PASO 4: Solicitar cédula y verificar paciente
PASO 5: Registrar cita automáticamente
PASO 6: Confirmar resultado
PASO 7: Ofrecer ayuda adicional
PASO 8: Colgar llamada
```

### 2. Ocultación de Complejidad Técnica

#### PASO 3.5 - Ahora Completamente Interno

**Antes (v2.4):** El PASO 3.5 era una sección visible del flujo principal con múltiples sub-pasos y alertas.

**Ahora (v2.5):** El PASO 3.5 se mantiene como **nota técnica interna** que el agente ejecuta pero NO es parte visible del flujo secuencial.

```markdown
### **PASO 3.5: Verificación Interna de Cupos (NO MENCIONAR AL PACIENTE)**

- **Verificar Cupos:** Llama a `checkAvailabilityQuota`...
- **Guardar Internamente:** flags, availability_id, fecha, hora, doctor
- **REGLA CRÍTICA:** NO informes al paciente sobre cupos. Esta verificación es INTERNA.
```

#### PASO 5 y 6 - Unificación de Registro

**Antes (v2.4):** PASO 6 tenía dos caminos visibles separados (CITA_CONFIRMADA vs SOLICITUD_PENDIENTE) con estructura if/then.

**Ahora (v2.5):** 
- **PASO 5** maneja el registro automático (oculta la decisión de cupos)
- **PASO 6** solo presenta el resultado (confirmación diferenciada pero sin exponer lógica interna)

### 3. Cambios en Mensajes y Lenguaje

#### Presentación de Especialidades (PASO 1)

**Antes:**
```
"En este momento podemos procesar su solicitud para [especialidades]."
```

**Ahora:**
```
"En este momento tenemos disponible [especialidades]. ¿Para cuál necesita la cita?"
```

Más directo y natural.

#### Confirmación de Sede (PASO 2)

**Antes:**
```
"Para [especialidad], podemos procesar su solicitud en [sedes]."
```

**Ahora:**
```
"Para [especialidad], podemos atenderle en [sedes]. ¿Cuál le queda mejor?"
```

Enfoque en el servicio al paciente.

#### Confirmación de Intención (PASO 3 - NUEVO)

**Antes:** Parte de PASO 3 original (mezclado con selección de sede).

**Ahora:**
```
"Perfecto. ¿Desea que le agendemos la cita con [especialidad] en [sede]?"
```

Paso separado y claro.

#### Solicitud de Cédula (PASO 4)

**Antes:**
```
"Para procesar su solicitud, por favor, indíqueme su número de cédula."
```

**Ahora:**
```
"Muy bien. Para procesar su cita, por favor indíqueme su número de cédula."
```

Cambio sutil: "solicitud" → "cita" (lenguaje más positivo).

#### Registro de Cita (PASO 5)

**Antes:** Era parte del PASO 6 con lógica condicional visible.

**Ahora:** 
```
"Para finalizar, ¿cuál es el motivo de la consulta?"
[Sistema registra automáticamente según disponibilidad]
```

Proceso simplificado y unificado.

#### Confirmación con Cupo (PASO 6)

**Antes:**
```
"¡Perfecto! Su cita ha sido confirmada. Le confirmo los detalles: es con el/la doctor/a [nombre] el día [fecha]..."
```

**Ahora:** (Mismo mensaje, pero ahora es PASO 6 dedicado)
```
"¡Perfecto! Su cita ha sido confirmada. Le confirmo los detalles:"
"Es con el/la doctor/a [nombre doctor]"
"El día [fecha conversacional]"
"A las [hora conversacional]"
"En la sede [nombre sede]"
"El número de su cita es el [appointment_id]"
```

Formato más estructurado y claro.

#### Confirmación sin Cupo (PASO 6)

**Sin cambios de contenido** - Solo reorganización estructural.

### 4. Eliminación de Flujo de Referencia Antiguo

**Antes:** El documento tenía dos secciones:
1. "Flujo de Trabajo en 8 Pasos" (nuevo)
2. "Flujo de Trabajo Detallado (Versión Original - Referencia)" (viejo)

**Ahora:** Solo existe el **"Flujo de Trabajo en 8 Pasos"** como flujo único y autorizado.

---

## 🔧 Cambios Técnicos (Backend)

**NINGUNO** - Esta actualización es **SOLO de prompt**. El backend v3.5 con mensajes v2.4 sigue siendo el mismo.

### Sistema Backend (Sin Cambios):
- `checkAvailabilityQuota`: Mensajes neutrales (v2.4) ✅
- `getAvailableAppointments`: Agrupación por specialty + location (v3.5) ✅
- `scheduleAppointment`: Manejo automático de cupos y lista de espera ✅
- Base de datos: MariaDB con todas las tablas operativas ✅

---

## 📊 Comparación de Estructuras

### Complejidad del Flujo

| Aspecto | v2.4 | v2.5 |
|---------|------|------|
| **Pasos principales** | 7 (PASO 1-7) | 8 (PASO 1-8) |
| **Pasos visibles** | 7 + 1 (PASO 3.5 visible) | 8 (PASO 3.5 oculto) |
| **Sub-pasos promedio** | 4-6 por paso | 1-3 por paso |
| **Bifurcaciones visibles** | 2 (PASO 6) | 0 |
| **Líneas de flujo** | ~150 líneas | ~120 líneas |
| **Complejidad percibida** | Media-Alta | Baja |

### Claridad de Lenguaje

| Aspecto | v2.4 | v2.5 |
|---------|------|------|
| **Terminología técnica** | "Procesar solicitud" | "Agendar cita", "Atender" |
| **Estructura de pasos** | Anidada (sub-pasos) | Lineal (secuencial) |
| **Lógica condicional** | Visible (if/then) | Oculta (flags internos) |
| **Mensajes al paciente** | Neutros | Positivos y directos |

---

## ✅ Reglas Mantenidas de v2.4

Las siguientes reglas **NO cambiaron** y siguen vigentes:

1. **NUNCA mencionar "lista de espera"** al paciente ✅
2. **NO preguntar prioridad** (sistema asigna "Normal") ✅
3. **Arquitectura specialty-centric** (v3.5) ✅
4. **Mensajes backend neutrales** ✅
5. **Normalización de números en 4 pasos** ✅
6. **Flujos de error (A y B)** ✅
7. **Flujo de consulta de estado** ✅
8. **Reglas críticas (12 reglas)** ✅

---

## 🎯 Resultado Esperado

### Para el Agente (Valeria):
- Flujo **más fácil de seguir** sin perderse
- Menos decisiones condicionales visibles
- Pasos claros y secuenciales
- Reducción de complejidad cognitiva

### Para el Paciente:
- **Experiencia más fluida** y natural
- Sin exposición a procesos internos
- Confirmaciones más claras y estructuradas
- Lenguaje más positivo ("agendar cita" vs "procesar solicitud")

### Para el Sistema:
- **Misma funcionalidad técnica** (backend sin cambios)
- Mejor mantenibilidad del prompt
- Estructura más escalable para futuras mejoras

---

## 📝 Archivos Modificados

### Archivos Actualizados:
- `newprompt.md` (v2.4 → v2.5) ✅
  - Header: Versión actualizada
  - Novedades: Reescritas para v2.5
  - Flujo: Completamente restructurado en 8 pasos
  - Flujo antiguo: Eliminado
  - Flujos adicionales: Mantenidos sin cambios
  - Reglas: Mantenidas sin cambios

### Archivos Nuevos:
- `ACTUALIZACION_V2.5_FLUJO_SIMPLIFICADO.md` (este documento) ✅

### Archivos a Actualizar (pendiente):
- `SIMPLE_README.md` (mencionar v2.5)
- `RESUMEN_COMPLETO_SISTEMA.md` (añadir nota de v2.5)

---

## 🔄 Proceso de Implementación

### 1. Desarrollo:
- [x] Análisis de requerimientos del usuario
- [x] Diseño de nueva estructura de 8 pasos
- [x] Reescritura de flujo principal
- [x] Ocultación de PASO 3.5
- [x] Simplificación de PASO 5 y 6
- [x] Eliminación de flujo de referencia antiguo
- [x] Actualización de header y novedades
- [x] Creación de documentación

### 2. Validación:
- [ ] Revisar consistencia de terminología
- [ ] Verificar que todas las herramientas estén mencionadas
- [ ] Comprobar que flujos adicionales sigan funcionando
- [ ] Validar que reglas críticas se mantengan

### 3. Despliegue:
- [ ] Copiar newprompt.md a entorno de producción
- [ ] Reiniciar servicio MCP (si aplica)
- [ ] Monitorear logs de llamadas
- [ ] Ajustar según feedback

---

## 🧪 Ejemplos de Conversación

### Ejemplo 1: Cita con Cupo Disponible

**PASO 1:** "Hola, bienvenido a Fundación Biosanar IPS. Le atiende Valeria, ¿cómo puedo colaborarle?"  
→ Paciente: "Necesito una cita"  
→ [Llama `getAvailableAppointments`]  
→ "Claro que sí. En este momento tenemos disponible Dermatología, Medicina General y Odontología. ¿Para cuál necesita la cita?"

**PASO 2:** Paciente: "Dermatología"  
→ "Perfecto. Para Dermatología, podemos atenderle en nuestra sede Centro y sede San José. ¿Cuál le queda mejor?"

**PASO 3:** Paciente: "Centro"  
→ "Perfecto. ¿Desea que le agendemos la cita con Dermatología en Centro?"

**PASO 3.5 (INTERNO):** [Llama `checkAvailabilityQuota` con specialty_id=1, location_id=2]  
→ Resultado: `can_schedule_direct: true`, guarda availability_id, fecha, hora, doctor

**PASO 4:** Paciente: "Sí"  
→ "Muy bien. Para procesar su cita, por favor indíqueme su número de cédula."  
→ Paciente: "1030567890"  
→ [Busca paciente] → Encontrado (patient_id=123)

**PASO 5:** "Para finalizar, ¿cuál es el motivo de la consulta?"  
→ Paciente: "Revisión de lunares"  
→ [Llama `scheduleAppointment` con availability_id, patient_id, reason, scheduled_date]

**PASO 6:** "¡Perfecto! Su cita ha sido confirmada. Le confirmo los detalles: Es con la doctora María López el día 15 de octubre a las 9 de la mañana, en la sede Centro. El número de su cita es el 4567."

**PASO 7:** "¿Hay algo más en lo que pueda colaborarle?"  
→ Paciente: "No, gracias"

**PASO 8:** "Gracias por comunicarse con Fundación Biosanar IPS. Que tenga un excelente día."

---

### Ejemplo 2: Solicitud sin Cupo (Lista de Espera)

**PASO 1-3:** [Igual que ejemplo 1]

**PASO 3.5 (INTERNO):** [Llama `checkAvailabilityQuota`]  
→ Resultado: `can_schedule_direct: false`, guarda availability_id

**PASO 4:** [Igual que ejemplo 1]

**PASO 5:** "Para finalizar, ¿cuál es el motivo de la consulta?"  
→ Paciente: "Control de acné"  
→ [Llama `scheduleAppointment` con priority_level="Normal"]

**PASO 6:** "Listo, su solicitud ha sido registrada exitosamente. Uno de nuestros operadores se pondrá en contacto con usted muy pronto para confirmarle el día y la hora de su cita. Por favor, esté atento a su teléfono."

**PASO 7-8:** [Igual que ejemplo 1]

---

## 📈 Métricas de Éxito

### Indicadores a Monitorear:

1. **Tiempo promedio de llamada**: ¿Se reduce con el flujo simplificado?
2. **Tasa de abandono**: ¿Menos pacientes cuelgan a mitad de proceso?
3. **Errores del agente**: ¿Menos confusión al seguir el flujo?
4. **Satisfacción del paciente**: ¿Feedback positivo sobre claridad?

---

## 🚀 Conclusión

**La versión v2.5 logra:**

✅ **Simplicidad**: Flujo lineal de 8 pasos fácil de seguir  
✅ **Claridad**: Lenguaje más directo y positivo  
✅ **Ocultación**: Procesos técnicos invisibles para el paciente  
✅ **Eficiencia**: Mismo resultado con menos complejidad visible  
✅ **Mantenibilidad**: Estructura más limpia y escalable  

**Sin sacrificar:**

✅ Funcionalidad técnica del backend  
✅ Validaciones y verificaciones necesarias  
✅ Reglas de negocio y políticas de privacidad  
✅ Capacidad de manejar casos complejos  

---

**Versión del documento:** 1.0  
**Autor:** Sistema de Actualización Automática  
**Estado:** Completado ✅
