# 🔍 Herramienta searchCupsByName - Búsqueda Rápida de Procedimientos CUPS

**Fecha:** 17 de Octubre, 2025  
**Versión:** V2.0  
**Servidor:** mcp-unified (Puerto 8977)  
**Herramientas:** 19 (agregada searchCupsByName)

---

## 🎯 Objetivo

Proporcionar una herramienta **SIMPLIFICADA** para buscar procedimientos CUPS usando únicamente el **NOMBRE** con coincidencias parciales. Optimizada para obtener rápidamente el `cups_id` necesario para `addToWaitingList`.

---

## 📝 Descripción

`searchCupsByName` es una herramienta especializada en búsqueda por nombre de procedimientos médicos en la tabla CUPS. A diferencia de `searchCups` (que tiene 6 parámetros), esta herramienta:

- ✅ **Solo requiere el nombre** (búsqueda parcial)
- ✅ **Retorna solo información esencial**: ID, código, nombre, precio
- ✅ **Ordenada por categoría** para fácil visualización
- ✅ **Límite ajustable** (default: 10, max: 50)
- ✅ **Incluye ejemplo de uso** con el primer resultado

---

## 🔧 Parámetros

### Obligatorios

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre o PARTE del nombre del procedimiento a buscar (case-insensitive) |

### Opcionales

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Número máximo de resultados (max: 50) |

---

## 📤 Respuesta

### Estructura JSON

```json
{
  "success": true,
  "message": "Se encontraron X procedimiento(s) con el nombre \"término\"",
  "search_term": "término buscado",
  "total": X,
  "procedures": [
    {
      "id": 325,
      "code": "881201",
      "name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
      "category": "Ecografía",
      "price": 128030.00,
      "specialty": {
        "id": 6,
        "name": "Ecografías"
      },
      "status": "Activo"
    }
  ],
  "by_category": {
    "Ecografía": [
      {
        "id": 325,
        "code": "881201",
        "name": "ECOGRAFIA DE MAMA...",
        "price": 128030
      }
    ]
  },
  "usage_note": "Use el campo \"id\" como cups_id al agregar a lista de espera",
  "example": "addToWaitingList({ ..., cups_id: 325 })"
}
```

### Campos Importantes

- **`procedures[].id`**: ⭐ Este es el `cups_id` que necesita para `addToWaitingList`
- **`procedures[].code`**: Código CUPS oficial
- **`procedures[].name`**: Nombre completo del procedimiento
- **`procedures[].price`**: Precio en pesos colombianos
- **`by_category`**: Procedimientos agrupados por categoría

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Búsqueda "mama"

**Request:**
```json
{
  "name": "searchCupsByName",
  "arguments": {
    "name": "mama"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Se encontraron 1 procedimiento(s) con el nombre \"mama\"",
  "search_term": "mama",
  "total": 1,
  "procedures": [
    {
      "id": 325,
      "code": "881201",
      "name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
      "category": "Ecografía",
      "price": 128030,
      "specialty": null,
      "status": "Activo"
    }
  ],
  "usage_note": "Use el campo \"id\" como cups_id al agregar a lista de espera",
  "example": "addToWaitingList({ ..., cups_id: 325 })"
}
```

**Siguiente paso:**
```json
{
  "name": "addToWaitingList",
  "arguments": {
    "patient_id": 1057,
    "specialty_id": 6,
    "cups_id": 325,
    "reason": "Ecografía de mama"
  }
}
```

---

### Ejemplo 2: Búsqueda "abdomen"

**Request:**
```json
{
  "name": "searchCupsByName",
  "arguments": {
    "name": "abdomen",
    "limit": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "total": 5,
  "procedures": [
    {
      "id": 351,
      "code": "881340",
      "name": "ECOGRAFIA DE ABDOMEN (MASAS ABDOMINALES Y DE RETROPERITONEO)",
      "price": 118020
    },
    {
      "id": 330,
      "code": "881305",
      "name": "ECOGRAFIA DE ABDOMEN SUPERIOR...",
      "price": 187180
    },
    {
      "id": 326,
      "code": "881302",
      "name": "ECOGRAFIA DE ABDOMEN TOTAL...",
      "price": 202020
    }
  ]
}
```

---

### Ejemplo 3: Búsqueda Parcial "obstetri"

**Request:**
```json
{
  "name": "searchCupsByName",
  "arguments": {
    "name": "obstetri"
  }
}
```

**Response:**
```json
{
  "success": true,
  "total": 3,
  "procedures": [
    {
      "id": 341,
      "code": "881436",
      "name": "ECOGRAFIA OBSTETRICA CON TRANSLUCENCIA NUCAL"
    },
    {
      "id": 338,
      "code": "881431",
      "name": "ECOGRAFIA OBSTETRICA TRANSABDOMINAL"
    },
    {
      "id": 347,
      "code": "881432",
      "name": "ECOGRAFIA OBSTETRICA TRANSVAGINAL"
    }
  ]
}
```

---

### Ejemplo 4: Sin Resultados

**Request:**
```json
{
  "name": "searchCupsByName",
  "arguments": {
    "name": "xyz123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "No se encontraron procedimientos con el nombre \"xyz123\"",
  "search_term": "xyz123",
  "total": 0,
  "procedures": [],
  "suggestion": "Intente con otro término de búsqueda o use palabras más generales (ej: \"mama\", \"abdomen\", \"hemograma\")"
}
```

---

## 🔄 Flujo de Trabajo Completo

### Escenario: Paciente solicita ecografía de mama

```
1. Operador escucha: "Necesito ecografía de mama"

2. Sistema llama:
   searchCupsByName({ name: "mama" })
   
3. Respuesta:
   {
     "procedures": [
       { "id": 325, "code": "881201", "name": "ECOGRAFIA DE MAMA..." }
     ]
   }

4. Sistema llama:
   addToWaitingList({
     patient_id: 1057,
     specialty_id: 6,
     cups_id: 325,
     reason: "Ecografía de mama (código 881201)"
   })

5. Respuesta:
   {
     "success": true,
     "waiting_list_id": 234,
     "cups_procedure": {
       "code": "881201",
       "name": "ECOGRAFIA DE MAMA...",
       "price": 128030
     }
   }
```

---

## 💡 Casos de Uso

### 1. Sistema de Llamadas Automático

```javascript
// Paciente dice: "ecografía de abdomen"
const search = await searchCupsByName({ name: "abdomen" });

// Mostrar opciones al paciente
if (search.total > 1) {
  console.log("Encontramos varios tipos de ecografía de abdomen:");
  search.procedures.forEach((proc, i) => {
    console.log(`${i+1}. ${proc.name} - $${proc.price}`);
  });
}

// Paciente selecciona opción 3
const selectedCupsId = search.procedures[2].id; // 326

// Agregar a lista de espera
await addToWaitingList({
  patient_id: patientId,
  specialty_id: 6,
  cups_id: selectedCupsId,
  reason: "Ecografía abdomen total"
});
```

### 2. Búsqueda Rápida en ElevenLabs

```python
# Paciente menciona procedimiento
patient_input = "necesito un hemograma"

# Extraer palabra clave
keyword = extract_keyword(patient_input)  # "hemograma"

# Buscar en CUPS
cups_result = search_cups_by_name(name=keyword)

if cups_result['total'] > 0:
    cups_id = cups_result['procedures'][0]['id']
    
    # Agregar a lista de espera
    add_to_waiting_list(
        patient_id=patient_id,
        specialty_id=get_specialty_for_procedure(cups_id),
        cups_id=cups_id,
        reason=f"Solicitud de {keyword}"
    )
```

### 3. Autocompletado en Frontend

```typescript
// Usuario escribe en campo de búsqueda
const handleSearch = async (searchTerm: string) => {
  if (searchTerm.length < 3) return;
  
  const results = await searchCupsByName({ 
    name: searchTerm,
    limit: 5 
  });
  
  // Mostrar autocompletado
  setSuggestions(results.procedures.map(proc => ({
    value: proc.id,
    label: `${proc.name} - $${proc.price.toLocaleString()}`
  })));
};
```

---

## 📊 Comparación con searchCups

| Característica | searchCupsByName | searchCups |
|----------------|------------------|------------|
| **Parámetros** | 1 obligatorio (name) | 0 obligatorios, 6 opcionales |
| **Complejidad** | Simple | Compleja |
| **Velocidad** | Rápida (1 parámetro) | Media (múltiples filtros) |
| **Uso principal** | Buscar por nombre | Búsqueda avanzada |
| **Respuesta** | Compacta (esencial) | Detallada (completa) |
| **Ideal para** | Obtener cups_id rápido | Análisis detallado |
| **Agrupación** | Por categoría | Lista plana |
| **Ejemplo de uso** | Incluido | No |
| **Límite default** | 10 | 20 |

---

## 🎯 Cuándo Usar Cada Herramienta

### Usar `searchCupsByName` cuando:
- ✅ Solo conoce el **nombre** del procedimiento
- ✅ Necesita el **cups_id rápidamente**
- ✅ Quiere **resultados simples**
- ✅ Búsqueda en tiempo real (autocompletado)
- ✅ Sistema de llamadas automático

### Usar `searchCups` cuando:
- ✅ Necesita **filtros múltiples** (código, categoría, especialidad, estado)
- ✅ Quiere información **muy detallada** (duración, requisitos, autorización)
- ✅ Análisis o reportes
- ✅ Búsqueda avanzada con múltiples criterios

---

## 🧪 Pruebas Realizadas

### Test 1: Búsqueda "mama" ✅
```bash
Request: { name: "mama" }
Response: 1 resultado (id: 325, código: 881201)
```

### Test 2: Búsqueda "abdomen" ✅
```bash
Request: { name: "abdomen", limit: 5 }
Response: 6 resultados (limitado a 5)
Categorías: Ecografía
```

### Test 3: Búsqueda parcial "obstetri" ✅
```bash
Request: { name: "obstetri" }
Response: 3 resultados (ecografías obstétricas)
```

### Test 4: Sin resultados ✅
```bash
Request: { name: "xyz123" }
Response: 0 resultados con sugerencia
```

---

## 🔧 Detalles Técnicos

### Query SQL
```sql
SELECT 
  c.id,
  c.code,
  c.name,
  c.category,
  c.price,
  c.status,
  s.id as specialty_id,
  s.name as specialty_name
FROM cups c
LEFT JOIN specialties s ON c.specialty_id = s.id
WHERE c.name LIKE '%término%'
  AND c.status = 'Activo'
ORDER BY c.category, c.name
LIMIT ?
```

### Características de Búsqueda
- **Case-insensitive**: "MAMA" = "mama" = "Mama"
- **Búsqueda parcial**: "abdomen" encuentra "ECOGRAFIA DE ABDOMEN..."
- **Solo activos**: Filtra procedimientos con `status = 'Activo'`
- **Ordenado**: Por categoría y nombre
- **Validación de límite**: Min: 1, Max: 50

---

## 📞 Información del Sistema

**Servidor:** localhost:8977  
**Endpoint:** /mcp-unified  
**Base de datos:** biosanar  
**Tabla:** cups (62 procedimientos)  
**Herramientas totales:** 19  

---

## 🎯 Resumen

`searchCupsByName` es una herramienta **optimizada** para búsqueda rápida de procedimientos CUPS por nombre. Su diseño simple (1 parámetro obligatorio) la hace ideal para:

- ✅ Sistemas de llamadas automáticas
- ✅ Autocompletado en interfaces
- ✅ Obtener `cups_id` para `addToWaitingList`
- ✅ Búsquedas rápidas con palabras clave

**Ventajas clave:**
- Simple y rápida
- Búsqueda parcial flexible
- Resultados agrupados por categoría
- Incluye ejemplo de uso
- Integración directa con addToWaitingList

**Versión:** V2.0  
**Estado:** ✅ OPERATIVO  
**Fecha:** 17 de Octubre, 2025
