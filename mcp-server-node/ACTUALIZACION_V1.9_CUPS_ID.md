# 📋 Actualización V1.9 - cups_id en addToWaitingList

**Fecha:** 17 de Octubre, 2025  
**Versión:** V1.9  
**Servidor:** mcp-unified (Puerto 8977)

---

## 🎯 Objetivo de la Actualización

Permitir que la herramienta `addToWaitingList` acepte el parámetro `cups_id` para registrar el procedimiento CUPS específico solicitado por el paciente en la lista de espera.

---

## 📝 Cambios Implementados

### 1. Nuevo Parámetro `cups_id` (OPCIONAL)

**Agregado en schema de addToWaitingList:**
```typescript
cups_id: {
  type: 'number',
  description: 'ID del procedimiento CUPS (OPCIONAL - obtenido de searchCups). 
                Ej: 325 para Ecografía de mama (código 881201). 
                Si se proporciona, se almacenará la referencia al procedimiento 
                específico solicitado.'
}
```

**Características:**
- ✅ **OPCIONAL**: No es requerido, la herramienta funciona con o sin él
- ✅ **Validado**: Si se proporciona, verifica que exista en la tabla `cups`
- ✅ **Almacenado**: Se guarda en `appointments_waiting_list.cups_id`
- ✅ **Retornado**: Aparece en la respuesta con información completa del procedimiento

### 2. Validación de CUPS

Si se proporciona `cups_id`, la función:
1. Busca el procedimiento en la tabla `cups`
2. Valida que exista
3. Obtiene: id, code, name, category, specialty_id, price
4. Retorna error si no existe

```typescript
// Validación automática
if (finalCupsId) {
  const [cupsCheck] = await connection.execute(
    `SELECT id, code, name, category, specialty_id, price 
     FROM cups WHERE id = ?`,
    [finalCupsId]
  );
  
  if (!cupsCheck) {
    return {
      error: 'Procedimiento CUPS no encontrado',
      suggestion: 'Use searchCups para encontrar el ID correcto'
    };
  }
}
```

### 3. Almacenamiento en Base de Datos

**Campo en tabla:** `appointments_waiting_list.cups_id`
- Tipo: `int(10) unsigned`
- Null: YES (opcional)
- Key: MUL (índice)
- Foreign Key: Referencia a `cups.id`

**INSERT actualizado:**
```sql
INSERT INTO appointments_waiting_list (
  patient_id, specialty_id, cups_id, availability_id, 
  scheduled_date, appointment_type, reason, notes, 
  priority_level, status, requested_by, call_type, 
  created_at, updated_at
) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())
```

### 4. Respuesta Mejorada

**Nuevo campo en respuesta:** `cups_procedure`

```json
{
  "success": true,
  "waiting_list_id": 232,
  "requested_for": {
    "specialty": {
      "id": 6,
      "name": "Ecografías"
    },
    "cups_procedure": {
      "id": 325,
      "code": "881201",
      "name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
      "category": "Ecografía",
      "price": 128030.00
    }
  },
  "info": "Agregado a lista de espera para Ecografías - ECOGRAFIA DE MAMA... (881201)"
}
```

**Si NO se proporciona cups_id:**
```json
{
  "cups_procedure": null
}
```

---

## 📤 Parámetros Actualizados

### Obligatorios
- `patient_id` (number): ID del paciente
- `specialty_id` (number): ID de la especialidad
- `reason` (string): Motivo de la consulta

### Opcionales
- **`cups_id` (number)**: ID del procedimiento CUPS ← **NUEVO**
- `scheduled_date` (string): Fecha deseada
- `appointment_type` (string): Presencial/Telemedicina
- `notes` (string): Notas adicionales
- `priority_level` (string): Baja/Normal/Alta/Urgente
- `requested_by` (string): Quién solicita
- `call_type` (string): normal/reagendar

---

## 📝 Ejemplos de Uso

### Ejemplo 1: CON cups_id (Ecografía de mama)

**Paso 1:** Buscar el procedimiento CUPS
```json
{
  "name": "searchCups",
  "arguments": {
    "code": "881201"
  }
}
```

**Respuesta:**
```json
{
  "procedures": [{
    "id": 325,  // ← Este es el cups_id
    "code": "881201",
    "name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
    "price": 128030.00
  }]
}
```

**Paso 2:** Agregar a lista de espera con cups_id
```json
{
  "name": "addToWaitingList",
  "arguments": {
    "patient_id": 1057,
    "specialty_id": 6,
    "cups_id": 325,  // ← ID obtenido de searchCups
    "reason": "Ecografía de mama - código CUPS 881201"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "waiting_list_id": 232,
  "requested_for": {
    "specialty": {
      "id": 6,
      "name": "Ecografías"
    },
    "cups_procedure": {
      "id": 325,
      "code": "881201",
      "name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
      "category": "Ecografía",
      "price": 128030
    }
  },
  "info": "Agregado a lista de espera para Ecografías - ECOGRAFIA DE MAMA... (881201)"
}
```

### Ejemplo 2: SIN cups_id (Consulta general)

```json
{
  "name": "addToWaitingList",
  "arguments": {
    "patient_id": 1057,
    "specialty_id": 3,
    "reason": "Consulta de cardiología"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "waiting_list_id": 233,
  "requested_for": {
    "specialty": {
      "id": 3,
      "name": "Cardiología"
    },
    "cups_procedure": null  // ← Sin procedimiento específico
  },
  "info": "Agregado a lista de espera para Cardiología con prioridad Normal..."
}
```

### Ejemplo 3: cups_id inválido (Error)

```json
{
  "name": "addToWaitingList",
  "arguments": {
    "patient_id": 1057,
    "specialty_id": 6,
    "cups_id": 99999,  // ← ID que no existe
    "reason": "Test"
  }
}
```

**Respuesta:**
```json
{
  "success": false,
  "error": "Procedimiento CUPS no encontrado",
  "cups_id": 99999,
  "suggestion": "Use searchCups para encontrar el ID correcto del procedimiento"
}
```

---

## 🧪 Pruebas Realizadas

### Test 1: Con cups_id válido ✅
```bash
cups_id: 325 (Ecografía mama, código 881201)
Resultado: waiting_list_id 232, cups_id guardado correctamente
```

**Verificación en BD:**
```sql
SELECT id, specialty_id, cups_id, reason 
FROM appointments_waiting_list WHERE id = 232;

+-----+--------------+---------+----------------------------------------+
| id  | specialty_id | cups_id | reason                                 |
+-----+--------------+---------+----------------------------------------+
| 232 |            6 |     325 | Ecografía de mama - código CUPS 881201 |
+-----+--------------+---------+----------------------------------------+
```

### Test 2: Sin cups_id (null) ✅
```bash
cups_id: no proporcionado
Resultado: waiting_list_id 233, cups_id = NULL
Response: "cups_procedure": null
```

### Test 3: cups_id inválido ✅
```bash
cups_id: 99999 (no existe)
Resultado: Error con mensaje y sugerencia
```

---

## 🔄 Flujo de Trabajo Recomendado

### Opción A: Con Procedimiento Específico
```
1. searchCups({code: "881201"})
   → Obtener id: 325

2. addToWaitingList({
     patient_id: 1057,
     specialty_id: 6,
     cups_id: 325,  ← ID del procedimiento
     reason: "Ecografía mama"
   })
   → waiting_list_id: 232
   → cups_procedure incluido en respuesta
```

### Opción B: Sin Procedimiento Específico
```
1. addToWaitingList({
     patient_id: 1057,
     specialty_id: 3,
     reason: "Consulta cardiología"
   })
   → waiting_list_id: 233
   → cups_procedure: null
```

---

## 💡 Casos de Uso

### 1. Sistema de Llamadas con Procedimiento Específico
```
Paciente: "Necesito ecografía de mama"
Sistema: 
  1. searchCups({name: "mama"})
  2. Encuentra código 881201, id: 325
  3. addToWaitingList({
       patient_id: X,
       specialty_id: 6,
       cups_id: 325,
       reason: "Ecografía mama (881201)"
     })
  4. "Agregado a lista de espera con procedimiento específico"
```

### 2. Consulta General sin Procedimiento
```
Paciente: "Necesito cardiología"
Sistema:
  1. addToWaitingList({
       patient_id: X,
       specialty_id: 3,
       reason: "Consulta cardiología"
     })
  2. "Agregado a lista de espera, procedimiento se definirá después"
```

### 3. Operador Especifica Procedimiento
```
Operador conoce código CUPS: 881201
Sistema:
  1. searchCups({code: "881201"}) → id: 325
  2. addToWaitingList({..., cups_id: 325})
  3. Registro completo con procedimiento y precio
```

---

## 📊 Beneficios

| Beneficio | Descripción |
|-----------|-------------|
| **Precisión** | Registro exacto del procedimiento solicitado |
| **Trazabilidad** | Relación directa con tabla CUPS |
| **Información Completa** | Código, nombre y precio del procedimiento |
| **Flexibilidad** | Opcional - funciona con o sin CUPS |
| **Validación** | Verifica que el procedimiento exista |
| **Integración** | Se conecta perfectamente con searchCups |

---

## 🔧 Archivos Modificados

### `/home/ubuntu/app/mcp-server-node/src/server-unified.ts`

**Secciones modificadas:**
1. **Tool Schema (línea ~308):** Agregado parámetro `cups_id`
2. **Función addToWaitingList (línea ~2130):** 
   - Agregado parámetro `cups_id` en destructuring
   - Agregada validación de CUPS (línea ~2200)
   - Actualizado INSERT con cups_id (línea ~2220)
   - Actualizada respuesta con cups_procedure (línea ~2310)
   - Actualizado mensaje info con datos CUPS (línea ~2340)

**Líneas agregadas:** ~40
**Líneas modificadas:** ~15

---

## 📈 Comparación de Versiones

| Característica | V1.8 | V1.9 |
|----------------|------|------|
| Parámetro cups_id | ❌ No | ✅ Sí (opcional) |
| Validación CUPS | ❌ No | ✅ Sí |
| Campo en BD cups_id | Existe pero no usado | ✅ Usado |
| Respuesta cups_procedure | ❌ No | ✅ Sí |
| Info con código CUPS | ❌ No | ✅ Sí |
| Integración con searchCups | Manual | ✅ Directa |

---

## 🚀 Despliegue

```bash
# Compilación
cd /home/ubuntu/app/mcp-server-node
npm run build  # ✅ Sin errores

# Reinicio
pm2 restart mcp-unified  # ✅ Restart #24

# Verificación
curl http://localhost:8977/health
# → {"status": "healthy", "tools": 18}
```

**Estado:** ✅ OPERATIVO EN PRODUCCIÓN

---

## 📞 Información del Sistema

**Servidor:** localhost:8977  
**Endpoint:** /mcp-unified  
**Base de datos:** biosanar  
**Tabla modificada:** appointments_waiting_list  
**Campo nuevo usado:** cups_id  
**Herramientas:** 18  

---

## 🎯 Resumen

La herramienta `addToWaitingList` ahora acepta el parámetro opcional `cups_id` que permite registrar el procedimiento CUPS específico solicitado. Esto proporciona mayor precisión en el registro de solicitudes, mejor trazabilidad y información completa (código, nombre, precio) del procedimiento en la respuesta.

**Flujo completo:**
1. `searchCups` → Obtener ID del procedimiento
2. `addToWaitingList` con `cups_id` → Registrar en lista de espera
3. Sistema almacena referencia a CUPS
4. Respuesta incluye información completa del procedimiento

**Versión:** V1.9  
**Estado:** ✅ OPERATIVO  
**Fecha:** 17 de Octubre, 2025
