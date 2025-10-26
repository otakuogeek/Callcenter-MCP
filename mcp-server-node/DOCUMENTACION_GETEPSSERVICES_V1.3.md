# 🏥 Nueva Herramienta: getEPSServices

## 📅 Fecha: 13 de octubre de 2025
## 🎯 Versión: v1.3.0

---

## 🎯 Objetivo

Permitir consultar los servicios (especialidades y sedes) autorizados para una EPS específica, mostrando solo los servicios activos y no expirados. Esta herramienta es esencial para informar a los pacientes qué especialidades pueden usar según su EPS.

---

## 📊 Funcionalidad

### **¿Qué hace?**

La herramienta `getEPSServices` consulta la tabla `eps_specialty_location_authorizations` para obtener:
- ✅ Especialidades autorizadas por EPS
- ✅ Sedes donde puede atenderse
- ✅ Detalles de autorización (copago, autorización previa, etc.)
- ✅ Solo servicios activos y no expirados

### **¿Cuándo usarla?**

- Cuando un paciente pregunta qué especialidades cubre su EPS
- Para validar si una especialidad está autorizada antes de agendar
- Para informar al paciente las sedes disponibles según su EPS
- Para conocer requisitos especiales (copago, autorización previa)

---

## 📝 Schema de la Herramienta

```typescript
{
  name: 'getEPSServices',
  description: 'Consulta los servicios (especialidades y sedes) autorizados para una EPS específica. Retorna solo los servicios activos y no expirados.',
  inputSchema: {
    type: 'object',
    properties: {
      eps_id: {
        type: 'number',
        description: 'ID de la EPS para consultar sus servicios autorizados (obligatorio). Use listActiveEPS para obtener los IDs disponibles.'
      }
    },
    required: ['eps_id']
  }
}
```

---

## 🔍 Ejemplo de Uso

### **Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "getEPSServices",
    "arguments": {
      "eps_id": 14
    }
  }
}
```

### **Response (Exitoso):**

```json
{
  "success": true,
  "found": true,
  "eps_id": 14,
  "eps_name": "NUEVA EPS",
  "eps_code": "2718",
  "count": 11,
  "services": [
    {
      "authorization_id": 7,
      "eps": {
        "id": 14,
        "name": "NUEVA EPS",
        "code": "2718"
      },
      "specialty": {
        "id": 14,
        "name": "Medicina General",
        "description": ""
      },
      "location": {
        "id": 1,
        "name": "Sede biosanar san gil",
        "address": ""
      },
      "authorization_details": {
        "authorized": true,
        "authorization_date": "2024-01-01",
        "expiration_date": null,
        "max_monthly_appointments": null,
        "copay_percentage": null,
        "requires_prior_authorization": false
      },
      "notes": "Medicina General autorizada",
      "created_at": "2025-10-11T18:18:03.000Z"
    }
    // ... más servicios
  ],
  "summary": {
    "total_authorizations": 11,
    "unique_specialties": 11,
    "unique_locations": 1,
    "specialties_list": [
      "Dermatología",
      "Ecografías",
      "Ecografías2",
      "Ginecología",
      "Medicina familiar",
      "Medicina General",
      "Medicina interna",
      "Nutrición",
      "Odontologia",
      "Pediatría",
      "Psicología"
    ],
    "locations_list": [
      "Sede biosanar san gil"
    ],
    "specialties_display": "Dermatología, Ecografías, Ecografías2, Ginecología, Medicina familiar, Medicina General, Medicina interna, Nutrición, Odontologia, Pediatría, Psicología",
    "locations_display": "Sede biosanar san gil"
  },
  "message": "Se encontraron 11 servicio(s) autorizado(s) para NUEVA EPS",
  "usage_note": "Los servicios listados son los únicos autorizados para esta EPS. Solo puede agendar citas en estas especialidades y sedes.",
  "presentation_note": "Al informar al paciente, use summary.specialties_display para mencionar las especialidades disponibles"
}
```

---

## ❌ Casos de Error

### **Error 1: Sin eps_id**

**Request:**
```json
{
  "name": "getEPSServices",
  "arguments": {}
}
```

**Response:**
```json
{
  "success": false,
  "error": "El parámetro eps_id es obligatorio",
  "usage": "Proporcione el ID de la EPS para consultar sus servicios autorizados"
}
```

---

### **Error 2: EPS no encontrada**

**Request:**
```json
{
  "name": "getEPSServices",
  "arguments": {
    "eps_id": 9999
  }
}
```

**Response:**
```json
{
  "success": false,
  "error": "EPS no encontrada",
  "message": "No existe una EPS con id 9999",
  "suggestion": "Use la herramienta listActiveEPS para ver las EPS disponibles"
}
```

---

### **Caso 3: EPS sin servicios autorizados**

**Request:**
```json
{
  "name": "getEPSServices",
  "arguments": {
    "eps_id": 12
  }
}
```

**Response:**
```json
{
  "success": true,
  "found": false,
  "eps_id": 12,
  "eps_name": "FAMISANAR",
  "count": 0,
  "services": [],
  "message": "La EPS \"FAMISANAR\" no tiene servicios autorizados actualmente",
  "note": "No hay especialidades ni sedes autorizadas para esta EPS o sus autorizaciones han expirado"
}
```

---

## 🎓 Casos de Uso

### **Caso 1: Informar servicios disponibles**

```
👤 Paciente: "Tengo NUEVA EPS, ¿qué especialidades puedo usar?"

🤖 Agente: [Llama a getEPSServices con eps_id=14]

🤖 Agente: "Con su EPS NUEVA EPS, puede acceder a las siguientes 
            especialidades: Dermatología, Ecografías, Ginecología, 
            Medicina General, Pediatría, Psicología, y más.
            Todas disponibles en nuestra Sede biosanar san gil."
```

---

### **Caso 2: Validar especialidad antes de agendar**

```
👤 Paciente: "Quiero agendar Cardiología con NUEVA EPS"

🤖 Agente: [Llama a getEPSServices con eps_id=14]
           [Verifica si "Cardiología" está en specialties_list]

// Si NO está autorizada:
🤖 Agente: "Disculpe, Cardiología no está cubierta por su EPS NUEVA EPS.
            Las especialidades disponibles son: Dermatología, Ginecología,
            Medicina General, Pediatría, Psicología..."

// Si SÍ está autorizada:
🤖 Agente: "Perfecto, Cardiología sí está cubierta por su EPS.
            Vamos a buscar disponibilidad..."
```

---

### **Caso 3: Verificar requisitos especiales**

```
🤖 Agente: [Llama a getEPSServices con eps_id=14]
           [Revisa authorization_details de la especialidad]

// Si requiere autorización previa:
🤖 Agente: "Para esta especialidad necesita autorización previa de su EPS.
            ¿Ya cuenta con ella?"

// Si tiene copago:
🤖 Agente: "Tenga en cuenta que esta consulta tiene un copago del 10%."
```

---

## 🔐 Lógica de Filtrado

La herramienta aplica estos filtros automáticamente:

```sql
WHERE a.eps_id = ?
  AND a.authorized = 1
  AND (a.expiration_date IS NULL OR a.expiration_date >= CURDATE())
```

**Esto significa que:**
- ✅ Solo muestra servicios con `authorized = 1`
- ✅ Solo muestra servicios no expirados (expiration_date NULL o futuro)
- ✅ Filtra por la EPS específica solicitada

---

## 📊 Estructura de Datos

### **Tablas involucradas:**

1. **`eps_specialty_location_authorizations`** (tabla principal)
   - Autorizaciones por EPS + Especialidad + Sede
   
2. **`eps`** (JOIN)
   - Información de la EPS (nombre, código)
   
3. **`specialties`** (JOIN)
   - Información de especialidades (nombre, descripción)
   
4. **`locations`** (JOIN)
   - Información de sedes (nombre, dirección)

### **Campos importantes:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `eps_id` | int | ID de la EPS |
| `specialty_id` | int | ID de la especialidad |
| `location_id` | int | ID de la sede |
| `authorized` | boolean | ¿Está autorizado? (1/0) |
| `expiration_date` | date | Fecha de expiración (NULL = sin expiración) |
| `max_monthly_appointments` | int | Límite mensual de citas |
| `copay_percentage` | decimal | Porcentaje de copago |
| `requires_prior_authorization` | boolean | ¿Requiere autorización previa? |

---

## 🧪 Tests Ejecutados

| # | Test | Input | Resultado | Validación |
|---|------|-------|-----------|------------|
| 1 | EPS con servicios | eps_id: 14 | ✅ SUCCESS | 11 servicios encontrados |
| 2 | EPS sin servicios | eps_id: 12 | ✅ SUCCESS | 0 servicios, mensaje informativo |
| 3 | Sin eps_id | `{}` | ❌ ERROR | Validación correcta |
| 4 | EPS inexistente | eps_id: 9999 | ❌ ERROR | Mensaje de sugerencia |

**Tasa de éxito:** 4/4 tests (100%) ✅

---

## 📈 Impacto en el Sistema

### **Antes (sin getEPSServices):**

| Situación | Resultado |
|-----------|-----------|
| Paciente pregunta especialidades | ❌ Agente no puede informar |
| Validar cobertura | ❌ Manual o no posible |
| Información de copago | ❌ No disponible |
| Requisitos especiales | ❌ Desconocidos |

### **Ahora (con getEPSServices):**

| Situación | Resultado |
|-----------|-----------|
| Paciente pregunta especialidades | ✅ Lista completa y precisa |
| Validar cobertura | ✅ Automático y confiable |
| Información de copago | ✅ Disponible en authorization_details |
| Requisitos especiales | ✅ Identificados (autorización previa) |

---

## 🔄 Integración con Otras Herramientas

### **Flujo recomendado:**

```
1. listActiveEPS
   ↓ (obtener eps_id)
   
2. getEPSServices (eps_id)
   ↓ (verificar especialidades autorizadas)
   
3. getAvailableAppointments
   ↓ (solo especialidades autorizadas)
   
4. scheduleAppointment
   ✓ (cita agendada)
```

---

## 📊 Estado del Sistema

```
┌──────────────────────────────────────────┐
│  🟢 SERVIDOR MCP v1.3.0                  │
├──────────────────────────────────────────┤
│  Estado:       ONLINE ✅                 │
│  Puerto:       8977                      │
│  Herramientas: 15 (14 → 15)             │
│  PM2 Restarts: 6                         │
│  Tests:        4/4 PASADOS ✅            │
│  Compilación:  SIN ERRORES ✅            │
├──────────────────────────────────────────┤
│  Nueva funcionalidad:                    │
│  • getEPSServices implementada ✨        │
│  • Consulta de servicios por EPS         │
│  • Filtrado automático de autorizados    │
│  • Summary con display lists             │
└──────────────────────────────────────────┘
```

---

## ✅ Checklist de Implementación

- [x] Función `getEPSServices()` implementada
- [x] Schema agregado a `UNIFIED_TOOLS`
- [x] Integración en `executeToolCall()`
- [x] Query SQL con JOINs optimizada
- [x] Validación de parámetros
- [x] Manejo de casos especiales (sin servicios, EPS inexistente)
- [x] Compilación TypeScript exitosa
- [x] PM2 restart exitoso
- [x] Tests ejecutados: 4/4 ✅
- [x] Documentación completa creada
- [x] Script de test automatizado

---

## 🚀 Próximos Pasos

### **Inmediato**

1. ✅ Compilar y desplegar (COMPLETADO)
2. ✅ Tests (COMPLETADO)
3. 🔄 Actualizar `newprompt.md` con uso de getEPSServices

### **Corto Plazo**

4. Integrar en flujo de agendamiento
   - Validar EPS del paciente antes de ofrecer especialidades
   - Filtrar especialidades según EPS

5. Optimizaciones
   - Caché de servicios por EPS
   - Índices en base de datos para performance

---

## 📚 Archivos Modificados/Creados

### **Código:**
- ✅ `src/server-unified.ts` (función + schema + case)

### **Documentación:**
- ✅ `DOCUMENTACION_GETEPSSERVICES_V1.3.md` (este archivo)

### **Testing:**
- ✅ `test-eps-services.sh` (script de tests)

---

## 🎯 Ejemplo Real Completo

```
👤 Paciente: "Hola, quiero agendar una cita"

🤖 Valeria: "Bienvenido. ¿Me regala su cédula?"

👤 Paciente: "17265900"

🤖 Valeria: [Llama a searchPatient(document="17265900")]
           [Obtiene: patient_id=1057, eps_id=12 (FAMISANAR)]

🤖 Valeria: [Llama a getEPSServices(eps_id=12)]
           [Resultado: FAMISANAR no tiene servicios autorizados]

🤖 Valeria: "Veo que su EPS es FAMISANAR. Disculpe, actualmente 
            esta EPS no tiene servicios autorizados con nosotros.
            ¿Desea actualizar su EPS o tiene otra afiliación?"

---

// Alternativa con servicios autorizados:

🤖 Valeria: [Llama a getEPSServices(eps_id=14)]
           [Resultado: 11 especialidades disponibles]

🤖 Valeria: "Perfecto, con su EPS NUEVA EPS puede acceder a:
            Medicina General, Pediatría, Ginecología, Dermatología,
            Psicología, Nutrición y más. ¿Cuál necesita?"

👤 Paciente: "Medicina General"

🤖 Valeria: [Valida que "Medicina General" esté en specialties_list]
           ✓ Sí está autorizada
           
🤖 Valeria: "Excelente, vamos a buscar disponibilidad..."
```

---

## 🎉 Conclusión

✅ **Herramienta getEPSServices implementada y probada exitosamente**

La herramienta permite:
- ✅ Consultar servicios autorizados por EPS
- ✅ Validar coberturas antes de agendar
- ✅ Informar al paciente de forma precisa
- ✅ Identificar requisitos especiales (copago, autorización previa)

**El sistema ahora puede proporcionar información precisa y personalizada según la EPS del paciente.** 🚀

---

**Creado:** 13 de octubre de 2025  
**Versión:** v1.3.0  
**Estado:** ✅ Producción
