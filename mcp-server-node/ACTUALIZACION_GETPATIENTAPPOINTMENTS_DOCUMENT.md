# 📋 Actualización: getPatientAppointments - Búsqueda por Documento

**Fecha:** 20 de Octubre, 2025  
**Versión:** V2.0 (getPatientAppointments)  
**Servidor:** mcp-unified (Puerto 8977)

---

## 🎯 Objetivo de la Actualización

Permitir que la herramienta `getPatientAppointments` pueda consultar citas usando el **número de documento (cédula)** del paciente, además del `patient_id` existente.

---

## 📝 Cambios Implementados

### 1. Nuevo Parámetro `document` (OPCIONAL)

**Agregado en schema de getPatientAppointments:**
```typescript
document: {
  type: 'string',
  description: 'Número de cédula o documento del paciente (opcional si se proporciona patient_id)'
}
```

**Características:**
- ✅ **OPCIONAL**: Se puede usar `patient_id` O `document` (no ambos son necesarios)
- ✅ **Flexible**: Si se proporciona `document`, busca primero el `patient_id`
- ✅ **Validado**: Verifica que el paciente exista y esté activo
- ✅ **Informativo**: Retorna datos del paciente encontrado

### 2. Schema Actualizado

**Antes (V1.0):**
```typescript
{
  name: 'getPatientAppointments',
  description: 'Consulta todas las citas de un paciente...',
  properties: {
    patient_id: { type: 'number' }  // OBLIGATORIO
  },
  required: ['patient_id']  // ← REQUERIDO
}
```

**Después (V2.0):**
```typescript
{
  name: 'getPatientAppointments',
  description: 'Consulta todas las citas de un paciente... Puede buscar por patient_id O por document (cédula).',
  properties: {
    patient_id: { type: 'number', description: '(opcional si se proporciona document)' },
    document: { type: 'string', description: '(opcional si se proporciona patient_id)' }
  },
  required: []  // ← Sin campos requeridos (pero al menos uno debe proporcionarse)
}
```

### 3. Lógica de Búsqueda

**Flujo implementado:**

```typescript
// 1. Validar que se proporcione al menos uno
if (!patient_id && !document) {
  return { error: 'Debe proporcionar patient_id o document' };
}

// 2. Si se proporciona document, buscar patient_id
if (!patient_id && document) {
  const [patientCheck] = await connection.execute(
    'SELECT id, name, document, phone FROM patients WHERE document = ? AND status = "Activo"',
    [document]
  );
  
  if (patientCheck.length === 0) {
    return { error: 'Paciente no encontrado con ese documento' };
  }
  
  finalPatientId = patientCheck[0].id;
  patientInfo = patientCheck[0];
}

// 3. Continuar con la consulta usando finalPatientId
```

### 4. Respuesta Mejorada

**Nuevo campo en respuesta:** `patient`

```json
{
  "success": true,
  "message": "Se encontraron 3 citas",
  "patient": {
    "id": 1057,
    "name": "Dave Bastidas",
    "document": "17265900",
    "phone": "04263774021"
  },
  "count": 3,
  "summary": { ... },
  "upcoming_appointments": [ ... ],
  "past_appointments": [ ... ]
}
```

**Beneficios:**
- Confirma qué paciente se encontró
- Muestra documento, nombre y teléfono
- Útil cuando se busca por documento

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Búsqueda por DOCUMENT (NUEVO)

```json
{
  "name": "getPatientAppointments",
  "arguments": {
    "document": "17265900"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Se encontraron 3 citas",
  "patient": {
    "id": 1057,
    "name": "Dave Bastidas",
    "document": "17265900",
    "phone": "04263774021"
  },
  "count": 3,
  "summary": {
    "total": 3,
    "upcoming": 1,
    "past": 2,
    "by_status": {
      "pendiente": 0,
      "confirmada": 1,
      "completada": 0,
      "cancelada": 2
    }
  },
  "upcoming_appointments": [
    {
      "id": 263,
      "scheduled_at": "2025-10-21T14:00:00.000Z",
      "appointment_type": "Presencial",
      "status": "Confirmada",
      "reason": "Consulta de medicina general",
      "doctor": {
        "id": 6,
        "name": "Ana Teresa Escobar"
      },
      "specialty": {
        "id": 1,
        "name": "Medicina General"
      }
    }
  ],
  "past_appointments": [ ... ]
}
```

### Ejemplo 2: Búsqueda por PATIENT_ID (Original - mantiene compatibilidad)

```json
{
  "name": "getPatientAppointments",
  "arguments": {
    "patient_id": 1057
  }
}
```

**Respuesta:** (Idéntica al Ejemplo 1)

### Ejemplo 3: Con filtros adicionales (document + status)

```json
{
  "name": "getPatientAppointments",
  "arguments": {
    "document": "17265900",
    "status": "Confirmada"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Se encontraron 1 citas",
  "patient": {
    "id": 1057,
    "name": "Dave Bastidas",
    "document": "17265900",
    "phone": "04263774021"
  },
  "count": 1,
  "upcoming_appointments": [
    {
      "id": 263,
      "status": "Confirmada",
      ...
    }
  ]
}
```

### Ejemplo 4: Documento no encontrado (Error)

```json
{
  "name": "getPatientAppointments",
  "arguments": {
    "document": "99999999"
  }
}
```

**Respuesta:**
```json
{
  "success": false,
  "error": "Paciente no encontrado con ese documento",
  "document": "99999999",
  "suggestion": "Verifique el número de documento o use searchPatient para buscar"
}
```

### Ejemplo 5: Sin parámetros (Error de validación)

```json
{
  "name": "getPatientAppointments",
  "arguments": {}
}
```

**Respuesta:**
```json
{
  "success": false,
  "error": "Debe proporcionar patient_id o document para buscar citas",
  "required": "patient_id OR document"
}
```

---

## 🧪 Pruebas Realizadas

### Test 1: Búsqueda por document válido ✅
```bash
Document: "17265900"
Paciente: Dave Bastidas (ID: 1057)
Resultado: 3 citas encontradas (1 próxima, 2 pasadas)
```

### Test 2: Búsqueda por patient_id válido ✅
```bash
patient_id: 1057
Resultado: 3 citas encontradas (mismos resultados que Test 1)
Compatibilidad: ✅ Mantiene funcionalidad original
```

### Test 3: Document no encontrado ✅
```bash
Document: "1037643890" (no existe)
Resultado: Error con mensaje descriptivo
Suggestion: "Use searchPatient para buscar"
```

### Test 4: Sin parámetros ✅
```bash
Arguments: {}
Resultado: Error de validación
Message: "Debe proporcionar patient_id o document"
```

### Test 5: Con filtros adicionales ✅
```bash
Document: "17265900" + status: "Confirmada"
Resultado: Solo citas confirmadas (1 cita)
```

---

## 🔄 Casos de Uso

### Caso 1: Sistema de Llamadas (Tiene documento, no ID)
```
Operador: "Quiero consultar citas del paciente con cédula 17265900"
Sistema:
  1. getPatientAppointments({ document: "17265900" })
  2. Encuentra paciente ID 1057
  3. Retorna 3 citas con información completa
  4. Operador ve: "Dave Bastidas tiene 1 cita próxima"
```

### Caso 2: Sistema Interno (Tiene ID de base de datos)
```
Sistema interno: "Consultar citas del patient_id 1057"
Sistema:
  1. getPatientAppointments({ patient_id: 1057 })
  2. Consulta directa (sin búsqueda adicional)
  3. Retorna citas inmediatamente
```

### Caso 3: Paciente llama para consultar (Solo sabe su cédula)
```
Paciente: "Mi cédula es 17265900, ¿tengo citas pendientes?"
Sistema:
  1. getPatientAppointments({ document: "17265900" })
  2. Encuentra paciente automáticamente
  3. Responde: "Sí, tiene 1 cita próxima para el 21 de octubre"
```

### Caso 4: Verificación rápida por operador
```
Operador: "¿El paciente 17265900 tiene citas canceladas?"
Sistema:
  1. getPatientAppointments({ 
       document: "17265900",
       status: "Cancelada"
     })
  2. Retorna: 2 citas canceladas
```

---

## 📊 Comparación de Versiones

| Característica | V1.0 (Antes) | V2.0 (Después) |
|----------------|--------------|----------------|
| Parámetro patient_id | ✅ Obligatorio | ✅ Opcional |
| Parámetro document | ❌ No | ✅ Opcional (nuevo) |
| Campos requeridos | patient_id | Ninguno (pero al menos uno) |
| Búsqueda automática | ❌ No | ✅ Sí (por document) |
| Respuesta con patient info | ❌ No | ✅ Sí |
| Compatibilidad V1.0 | N/A | ✅ 100% compatible |
| Validación de parámetros | Básica | ✅ Mejorada |
| Mensajes de error | Genéricos | ✅ Descriptivos |

---

## 🔧 Archivos Modificados

### `/home/ubuntu/app/mcp-server-node/src/server-unified.ts`

**Secciones modificadas:**

1. **Tool Schema (línea ~349):**
   - Agregado parámetro `document`
   - Actualizada descripción
   - Removido `required: ['patient_id']`

2. **Función getPatientAppointments (línea ~2387):**
   - Agregado parámetro `document` en destructuring
   - Agregada validación de parámetros
   - Agregada búsqueda por document
   - Agregada obtención de patientInfo
   - Actualizada respuesta con campo `patient`

**Líneas agregadas:** ~50  
**Líneas modificadas:** ~10

---

## 💡 Beneficios

| Beneficio | Descripción |
|-----------|-------------|
| **Mayor Flexibilidad** | Permite búsqueda por ID o documento |
| **Mejor UX** | Operadores pueden usar el dato que tengan disponible |
| **Compatibilidad** | Mantiene funcionamiento original 100% |
| **Información Completa** | Retorna datos del paciente en la respuesta |
| **Validación Mejorada** | Mensajes de error más descriptivos |
| **Casos de Uso Reales** | Se adapta a flujos de trabajo reales |

---

## 🚀 Despliegue

```bash
# Compilación
cd /home/ubuntu/app/mcp-server-node
npm run build  # ✅ Sin errores

# Reinicio
pm2 restart mcp-unified  # ✅ Restart #26

# Verificación
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"getPatientAppointments","arguments":{"document":"17265900"}}}'
# → ✅ 3 citas encontradas
```

**Estado:** ✅ OPERATIVO EN PRODUCCIÓN

---

## 📞 Información del Sistema

**Servidor:** localhost:8977  
**Endpoint:** /mcp-unified  
**Base de datos:** biosanar  
**Tabla consultada:** appointments, patients  
**Herramientas totales:** 19  

---

## 🎯 Resumen

La herramienta `getPatientAppointments` ahora acepta búsqueda por **document (cédula)** además de `patient_id`. Esto permite:

1. **Flexibilidad**: Usar el parámetro que esté disponible
2. **Mejor UX**: Operadores usan documento directamente
3. **Compatibilidad**: Código existente sigue funcionando
4. **Información**: Respuesta incluye datos del paciente

**Flujo completo:**
1. Llamar `getPatientAppointments` con `document` o `patient_id`
2. Sistema busca/valida paciente automáticamente
3. Retorna citas + información del paciente
4. Maneja errores descriptivamente

**Versión:** V2.0 (getPatientAppointments)  
**Estado:** ✅ OPERATIVO  
**Fecha:** 20 de Octubre, 2025  
**Restart:** #26
