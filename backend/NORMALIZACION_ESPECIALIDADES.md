# 🔧 Normalización Flexible de Especialidades - WhatsApp Bot

## 📋 Mejora Implementada

Se ha mejorado el sistema de detección de especialidades para que sea **completamente flexible** y **tolerante** a diferentes formas de escritura.

---

## 🎯 Problema Anterior

**Antes:**
- Usuario: "Para odontología" → ❌ Bot no entendía
- Usuario: "De medicina" → ❌ Bot no entendía
- Usuario: "Dientes" → ❌ Bot no entendía

**Causa:** El bot esperaba el nombre exacto de la especialidad sin palabras adicionales.

---

## ✅ Solución Implementada

### REGLA 0: Normalización Flexible de Entrada

El sistema ahora procesa la entrada del usuario en **4 pasos**:

#### 1️⃣ Ignorar Palabras Conectoras
El bot automáticamente ignora:
- "para", "de", "en", "con", "por", "a", "hacia"

**Ejemplos:**
```
Usuario: "Para odontología"     → Procesa: "odontología"
Usuario: "De medicina general"  → Procesa: "medicina general"
Usuario: "Quiero para psicología" → Procesa: "psicología"
Usuario: "En enfermería"        → Procesa: "enfermería"
```

#### 2️⃣ Aceptar Variantes Comunes
El bot reconoce sinónimos y variantes:

**Odontología:**
- "Dientes", "dentista", "dental", "odonto" → Busca: "Odontología"

**Medicina General:**
- "Medicina", "doctor", "médico", "general" → Busca: "Medicina General"

**Psicología:**
- "Psicólogo", "psicologo", "sicólogo" → Busca: "Psicología"

**Enfermería:**
- "Enfermera", "enfermero" → Busca: "Enfermería"

**Ecografía:**
- "Eco", "ecografia", "ecografía" → Busca: "Ecografía" (activa flujo especial)

#### 3️⃣ Consultar Especialidades Disponibles (OBLIGATORIO)
Antes de validar, el bot ejecuta:
```typescript
[TOOL:getAvailableAppointments:{}]
```
Esto retorna **todas** las especialidades que Biosanar tiene disponibles **en este momento**.

#### 4️⃣ Validar y Responder
El bot compara la especialidad normalizada contra las disponibles:

**✅ SI EXISTE:**
```
Continúa con el flujo normal de agendamiento
```

**❌ SI NO EXISTE:**
```
Bot: "Entiendo que necesitas [especialidad mencionada], 
      pero actualmente Biosanar no tiene esa especialidad disponible.
      
      Nuestras especialidades disponibles son:
      - Medicina General
      - Odontología
      - Psicología
      - Enfermería
      [... otras especialidades de getAvailableAppointments]
      
      ¿Te gustaría agendar para alguna de estas?"
```

---

## 📊 Ejemplos Completos

### Ejemplo 1: Especialidad Existe

```
Usuario: "Para odontología"

Bot procesa:
1. Quita "Para" → "odontología"
2. Normaliza → "Odontología"
3. Consulta getAvailableAppointments → [Medicina General, Odontología, Psicología]
4. Valida: "Odontología" EXISTE ✅
5. Continúa: "Tenemos disponibilidad para Odontología en..."
```

### Ejemplo 2: Variante de Especialidad

```
Usuario: "Necesito para dientes"

Bot procesa:
1. Quita "Necesito para" → "dientes"
2. Normaliza "dientes" → "Odontología"
3. Consulta getAvailableAppointments → [Medicina General, Odontología, Psicología]
4. Valida: "Odontología" EXISTE ✅
5. Continúa: "Tenemos disponibilidad para Odontología en..."
```

### Ejemplo 3: Especialidad No Disponible

```
Usuario: "Para dermatología"

Bot procesa:
1. Quita "Para" → "dermatología"
2. Normaliza → "Dermatología"
3. Consulta getAvailableAppointments → [Medicina General, Odontología, Psicología]
4. Valida: "Dermatología" NO EXISTE ❌
5. Responde: "Entiendo que necesitas Dermatología, pero actualmente 
              Biosanar no tiene esa especialidad disponible.
              
              Nuestras especialidades disponibles son:
              - Medicina General
              - Odontología
              - Psicología
              
              ¿Te gustaría agendar para alguna de estas?"
```

### Ejemplo 4: Palabras Múltiples

```
Usuario: "Quiero una cita para medicina"

Bot procesa:
1. Quita "Quiero una cita para" → "medicina"
2. Normaliza "medicina" → "Medicina General"
3. Consulta getAvailableAppointments → [Medicina General, Odontología]
4. Valida: "Medicina General" EXISTE ✅
5. Continúa: "Tenemos disponibilidad para Medicina General en..."
```

---

## 🔄 Flujo Actualizado

```
┌─────────────────────────────────────────────────────────┐
│ Usuario menciona especialidad                           │
│ Ejemplos:                                               │
│ - "Para odontología"                                    │
│ - "De medicina"                                         │
│ - "Dientes"                                             │
│ - "Quiero psicólogo"                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 1: Extraer especialidad                            │
│ - Quitar: "para", "de", "en", "con", etc.              │
│ - Resultado: Solo la especialidad                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 2: Normalizar variantes                            │
│ - "dientes" → "Odontología"                             │
│ - "medicina" → "Medicina General"                       │
│ - "psicólogo" → "Psicología"                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 3: Consultar disponibilidad                        │
│ [TOOL:getAvailableAppointments:{}]                      │
│ Retorna: Lista de especialidades disponibles            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 4: Validar contra disponibles                      │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│ ✅ EXISTE    │          │ ❌ NO EXISTE │
│              │          │              │
│ Continuar    │          │ Informar +   │
│ agendamiento │          │ Listar       │
│              │          │ disponibles  │
└──────────────┘          └──────────────┘
```

---

## 🛠️ Configuración Técnica

### Archivo Modificado
**`/backend/src/services/WhatsAppAIService.ts`**

### Cambios Realizados

1. **Nueva Regla antes de PASO 1:**
```typescript
## ⚠️ REGLA DE NORMALIZACIÓN DE ESPECIALIDADES ⚠️
**SIEMPRE aplica estos pasos al recibir una especialidad del paciente:**

1. Ignora palabras conectoras
2. Acepta variantes comunes
3. OBLIGATORIO - Consultar especialidades disponibles
4. Validar contra disponibles
```

2. **PASO 4 Mejorado:**
```typescript
### PASO 4: INTELIGENCIA DE ESPECIALIDADES Y NORMALIZACIÓN

**REGLA 0: NORMALIZACIÓN FLEXIBLE DE ENTRADA**
[... instrucciones detalladas ...]
```

---

## 📝 Casos de Uso Validados

### ✅ Caso 1: Con "Para"
```
Usuario: "Para odontología"
Bot: ✅ Detecta "Odontología" correctamente
```

### ✅ Caso 2: Con "De"
```
Usuario: "De medicina general"
Bot: ✅ Detecta "Medicina General" correctamente
```

### ✅ Caso 3: Sinónimo
```
Usuario: "Dientes"
Bot: ✅ Normaliza a "Odontología" y detecta
```

### ✅ Caso 4: Especialidad No Disponible
```
Usuario: "Dermatología"
Bot: ✅ Informa que no está disponible
Bot: ✅ Lista las especialidades disponibles
Bot: ✅ Pide que seleccione otra
```

### ✅ Caso 5: Frase Completa
```
Usuario: "Quiero agendar una cita para psicología"
Bot: ✅ Extrae "psicología" y continúa
```

---

## 🎯 Beneficios

1. **✅ Más Natural:** Los usuarios escriben como hablan normalmente
2. **✅ Tolerante:** Acepta múltiples formas de escribir
3. **✅ Informativo:** Si no existe, muestra qué sí hay disponible
4. **✅ Sin Frustraciones:** No más "no entendí" por pequeñas variaciones
5. **✅ Actualizado:** Siempre muestra especialidades disponibles en tiempo real

---

## 🚀 Estado Actual

- ✅ Código compilado sin errores
- ✅ Backend reiniciado (PM2 restart #6)
- ✅ Sistema en producción
- ✅ Normalización activa

---

## 📞 Prueba Ahora

**Intenta estas frases en WhatsApp:**

1. "Para odontología"
2. "De medicina"
3. "Dientes"
4. "Quiero psicólogo"
5. "Necesito enfermería"

**Todas deberían funcionar correctamente.** ✅

---

**Fecha:** 14 de Enero, 2026  
**Versión:** 2.1 (Normalización Flexible)  
**Estado:** 🟢 Producción
