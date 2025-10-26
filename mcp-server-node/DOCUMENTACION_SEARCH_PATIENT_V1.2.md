# 🔍 Nueva Herramienta: searchPatient

## 🎯 Descripción

Herramienta para **buscar y consultar pacientes** en la base de datos. Solo muestra pacientes con estado **ACTIVO**. Si un paciente existe pero está inactivo, NO aparecerá en los resultados.

**Fecha:** Octubre 13, 2025  
**Versión:** 1.2.0  
**Estado:** ✅ Completado y Probado

---

## 📊 Características

### ✅ Búsqueda Flexible
Puede buscar por cualquiera de estos criterios:
- **Documento** (cédula)
- **Nombre** (completo o parcial)
- **Teléfono**
- **ID del paciente**

### ✅ Solo Pacientes Activos
- Filtra automáticamente por `status = 'Activo'`
- Pacientes inactivos NO aparecen en resultados
- Ideal para verificar registros válidos

### ✅ Información Completa
Retorna datos completos del paciente:
- Datos personales (documento, nombre, teléfono, email)
- **Edad calculada automáticamente**
- Género y fecha de nacimiento
- Dirección y municipio
- Zona geográfica
- EPS
- Notas
- Fecha de creación

---

## 📝 Schema de la Herramienta

```typescript
{
  name: 'searchPatient',
  description: 'Busca y consulta pacientes en la base de datos. Puede buscar por documento (cédula), nombre, teléfono o ID. Solo muestra pacientes ACTIVOS.',
  inputSchema: {
    type: 'object',
    properties: {
      document: {
        type: 'string',
        description: 'Número de cédula o documento de identidad para buscar (opcional)'
      },
      name: {
        type: 'string',
        description: 'Nombre completo o parcial del paciente para buscar (opcional)'
      },
      phone: {
        type: 'string',
        description: 'Número de teléfono para buscar (opcional)'
      },
      patient_id: {
        type: 'number',
        description: 'ID del paciente para consultar datos completos (opcional)'
      }
    },
    required: []  // Al menos UN criterio debe proporcionarse
  }
}
```

---

## 🔍 Ejemplos de Uso

### **1. Buscar por Documento (Cédula)**

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "searchPatient",
    "arguments": {
      "document": "17265900"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "found": true,
  "count": 1,
  "patients": [
    {
      "id": 1057,
      "document": "17265900",
      "name": "Dave Bastidas",
      "phone": "04263774021",
      "email": "bastidasdaveusa@gmail.com",
      "birth_date": "1984-04-01T00:00:00.000Z",
      "age": 41,
      "gender": "Femenino",
      "address": "av principal cc valle verde...",
      "municipality": "Gambita",
      "zone": {
        "id": 3,
        "name": "Zona de Socorro",
        "description": "..."
      },
      "eps": {
        "id": 12,
        "name": "FAMISANAR",
        "code": "2718"
      },
      "status": "Activo",
      "notes": "Diabetico",
      "created_at": "2025-10-08T14:29:33.000Z"
    }
  ],
  "message": "Se encontraron 1 paciente(s) activo(s)",
  "search_criteria": {
    "document": "17265900",
    "name": null,
    "phone": null,
    "patient_id": null
  }
}
```

---

### **2. Buscar por Nombre Parcial**

**Request:**
```json
{
  "name": "searchPatient",
  "arguments": {
    "name": "María"
  }
}
```

**Response:**
```json
{
  "success": true,
  "found": true,
  "count": 2,
  "patients": [
    {
      "id": 1074,
      "name": "María José Pérez García",
      "age": 40,
      ...
    },
    {
      "id": 1059,
      "name": "María Rosario Polo Guerra",
      "age": null,
      ...
    }
  ],
  "message": "Se encontraron 2 paciente(s) activo(s)"
}
```

---

### **3. Buscar por Teléfono**

**Request:**
```json
{
  "name": "searchPatient",
  "arguments": {
    "phone": "3157894561"
  }
}
```

---

### **4. Buscar por ID de Paciente**

**Request:**
```json
{
  "name": "searchPatient",
  "arguments": {
    "patient_id": 1057
  }
}
```

---

### **5. Búsqueda Combinada (Múltiples Criterios)**

**Request:**
```json
{
  "name": "searchPatient",
  "arguments": {
    "name": "Bastidas",
    "document": "17265900"
  }
}
```

**Nota:** Si se proporcionan múltiples criterios, la búsqueda aplicará **AND** (todos deben coincidir).

---

## ❌ Casos de Error

### **Error 1: Sin Criterios de Búsqueda**

**Request:**
```json
{
  "name": "searchPatient",
  "arguments": {}
}
```

**Response:**
```json
{
  "success": false,
  "error": "Debe proporcionar al menos un criterio de búsqueda",
  "available_criteria": {
    "document": "Número de cédula o documento",
    "name": "Nombre completo o parcial",
    "phone": "Número de teléfono",
    "patient_id": "ID del paciente"
  }
}
```

---

### **Error 2: Paciente No Encontrado**

**Request:**
```json
{
  "name": "searchPatient",
  "arguments": {
    "document": "999999999"
  }
}
```

**Response:**
```json
{
  "success": true,
  "found": false,
  "count": 0,
  "message": "No se encontraron pacientes activos con los criterios proporcionados",
  "search_criteria": {
    "document": "999999999",
    "name": null,
    "phone": null,
    "patient_id": null
  },
  "note": "Solo se muestran pacientes con estado ACTIVO"
}
```

---

## 🎓 Flujo de Uso Recomendado

### **Caso 1: Verificar si Paciente Existe (ANTES de Registrar)**

```
👤 Paciente: "Quiero agendar una cita"

🤖 Agente: "Claro, ¿me regala su número de cédula?"

👤 Paciente: "17265900"

🤖 Agente: [Llama a searchPatient con document="17265900"]

// Si found=true:
🤖 Agente: "Perfecto, veo que ya está registrado en nuestro sistema como 
            Dave Bastidas. Tiene 41 años y está afiliado a FAMISANAR. 
            Vamos a buscar disponibilidad para su cita..."

// Si found=false:
🤖 Agente: "No lo tengo registrado aún en el sistema. Vamos a completar 
            su registro rápidamente. ¿Me puede indicar su nombre completo?"
```

---

### **Caso 2: Búsqueda de Paciente por Nombre**

```
👤 Personal médico: "Busca al paciente María García"

🤖 Asistente: [Llama a searchPatient con name="María García"]

// Retorna lista de coincidencias
🤖 Asistente: "Encontré 2 pacientes:
               1. María José Pérez García - Cédula: TEST1760384672
               2. María Rosario Polo Guerra - Cédula: 1001747685
               ¿Cuál es el que buscas?"
```

---

## 🔐 Seguridad

### **Filtro de Estado ACTIVO**
La consulta SQL incluye automáticamente:
```sql
WHERE p.status = 'Activo'
```

**Beneficios:**
- ✅ Pacientes inactivos no aparecen
- ✅ Datos GDPR/privacidad respetados
- ✅ Solo registros válidos en resultados
- ✅ Evita confusiones con pacientes dados de baja

---

## 📈 Límites y Consideraciones

### **Límite de Resultados**
- Máximo: **20 pacientes** por búsqueda
- Orden: Por fecha de creación (más recientes primero)
- Si hay más de 20, solo muestra los 20 más recientes

### **Búsqueda de Nombre**
- Usa **LIKE** con wildcards: `%nombre%`
- No distingue mayúsculas/minúsculas
- Busca en cualquier parte del nombre

**Ejemplos:**
- `"María"` → encuentra "María José", "Ana María", "María Rosario"
- `"Pérez"` → encuentra "María Pérez", "Juan Pérez García"

---

## 🧪 Tests Ejecutados

| # | Test | Resultado | Descripción |
|---|------|-----------|-------------|
| 1 | Sin criterios | ✅ PASS | Error con lista de criterios disponibles |
| 2 | Por documento | ✅ PASS | Encuentra paciente existente |
| 3 | Por nombre parcial | ✅ PASS | Encuentra por "Dave" |
| 4 | Por teléfono | ✅ PASS | Encuentra por número completo |
| 5 | Por ID | ✅ PASS | Encuentra paciente específico |
| 6 | Inexistente | ✅ PASS | Retorna found=false con mensaje |
| 7 | Múltiples criterios | ✅ PASS | AND entre criterios funciona |
| 8 | Nombre con múltiples resultados | ✅ PASS | Retorna 2 pacientes con "María" |
| 9 | Schema verificado | ✅ PASS | 4 propiedades opcionales |

---

## 🔄 Comparación con Funcionalidad Previa

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Búsqueda de pacientes** | No existía | ✅ Implementada |
| **Verificación antes de registro** | No | ✅ Sí |
| **Filtro por estado** | No | ✅ Solo activos |
| **Búsqueda flexible** | No | ✅ 4 criterios |
| **Cálculo de edad** | No | ✅ Automático |

---

## 📊 Impacto en el Sistema

```
🟢 Herramientas totales:     14 (13 + 1 nueva)
🟢 Estado:                   ONLINE
🟢 Compilación:              SIN ERRORES
🟢 Tests:                    9/9 PASADOS ✅
```

---

## 🎯 Casos de Uso

### **1. Prevención de Duplicados**
Antes de llamar a `registerPatientSimple`, usar `searchPatient` para verificar si el paciente ya existe.

### **2. Consulta Rápida**
Personal médico puede buscar información de paciente sin necesidad de sistema completo.

### **3. Verificación de Datos**
Confirmar información del paciente antes de agendar cita.

### **4. Búsqueda por Múltiples Criterios**
Si solo se tiene nombre parcial o teléfono, se puede buscar y confirmar identidad.

---

## 🤖 Integración con el Agente (newprompt.md)

### **Actualización Sugerida al Prompt:**

```markdown
PASO 3.5: Verificar si el Paciente Existe (NUEVO)

Antes de solicitar datos para registro, verificar si el paciente ya está 
en el sistema:

**Flujo:**
1. Solicitar cédula al paciente
2. Llamar a `searchPatient` con `document`
3. **SI found=true:**
   - Usar el `patient_id` obtenido
   - Confirmar datos al paciente
   - Continuar directamente a agendamiento de cita
4. **SI found=false:**
   - Continuar con flujo de registro completo (PASO 4)
   - Solicitar: nombre, teléfono, fecha nacimiento, género, zona, EPS
```

---

## 📚 Documentación SQL

La herramienta ejecuta la siguiente consulta:

```sql
SELECT 
  p.id, p.document, p.name, p.phone, p.email, p.birth_date,
  p.gender, p.address, p.status, p.created_at, p.notes,
  eps.id as eps_id, eps.name as eps_name, eps.code as eps_code,
  z.id as zone_id, z.name as zone_name, z.description as zone_description,
  m.name as municipality_name
FROM patients p
LEFT JOIN eps ON p.insurance_eps_id = eps.id
LEFT JOIN zones z ON p.zone_id = z.id
LEFT JOIN municipalities m ON p.municipality_id = m.id
WHERE p.status = 'Activo'
  AND [criterios dinámicos]
ORDER BY p.created_at DESC
LIMIT 20
```

---

## ✅ Conclusión

✅ **Herramienta searchPatient implementada exitosamente**  
✅ **Búsqueda flexible por 4 criterios**  
✅ **Filtro automático de pacientes activos**  
✅ **9/9 tests pasados**  
✅ **Edad calculada automáticamente**  
✅ **Información completa en response**  

**Próximo paso:** Actualizar el prompt del agente para incluir verificación de paciente existente antes del registro.

---

**Creado:** 2025-10-13  
**Versión:** 1.2.0  
**Estado:** ✅ Producción
