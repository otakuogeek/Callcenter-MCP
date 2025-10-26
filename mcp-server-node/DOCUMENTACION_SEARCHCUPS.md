# 🔍 Documentación - Herramienta searchCups

**Fecha:** 16 de Octubre, 2025  
**Versión:** V1.8  
**Servidor:** mcp-unified (Puerto 8977)

---

## 🎯 Propósito

La herramienta `searchCups` permite buscar y consultar procedimientos médicos en la tabla CUPS (Clasificación Única de Procedimientos en Salud) del sistema. Es especialmente útil para identificar tipos de ecografías y otros procedimientos médicos por su código CUPS, nombre o categoría.

---

## 📋 Características

- **Búsqueda flexible**: Por código CUPS, nombre, categoría o especialidad
- **Búsqueda parcial**: No requiere coincidencia exacta
- **Información completa**: Precio, duración, requisitos, complejidad
- **Filtros múltiples**: Combinar varios criterios de búsqueda
- **Control de resultados**: Límite configurable (1-100 registros)
- **Estado flexible**: Activos, inactivos, descontinuados o todos

---

## 🔧 Parámetros

### Todos los parámetros son OPCIONALES

| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `code` | string | Código CUPS (búsqueda parcial) | "881201", "8812" |
| `name` | string | Nombre del procedimiento (búsqueda parcial) | "abdomen", "mama", "ecografia" |
| `category` | string | Categoría (búsqueda parcial) | "Ecografía", "Laboratorio" |
| `specialty_id` | number | ID de especialidad asociada | 6 |
| `status` | string | Estado del procedimiento | "Activo", "Inactivo", "Descontinuado", "Todos" |
| `limit` | number | Máximo de resultados (default: 20, max: 100) | 10, 50 |

**Nota:** Si no se proporciona ningún parámetro, retorna los primeros 20 procedimientos activos.

---

## 📤 Respuesta

### Estructura JSON

```json
{
  "success": true,
  "message": "Se encontraron X procedimiento(s) CUPS",
  "search_criteria": {
    "code": "código buscado o 'Todos'",
    "name": "nombre buscado o 'Todos'",
    "category": "categoría buscada o 'Todas'",
    "specialty_id": "ID especialidad o 'Todas'",
    "status": "estado filtrado"
  },
  "total": 5,
  "procedures": [
    {
      "id": 325,
      "code": "881201",
      "name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
      "category": "Ecografía",
      "subcategory": null,
      "description": null,
      "specialty": {
        "id": 6,
        "name": "Ecografías"
      },
      "pricing": {
        "price": 128030.00,
        "requires_authorization": false
      },
      "requirements": {
        "complexity_level": "Alta",
        "estimated_duration_minutes": 60,
        "requires_anesthesia": false,
        "requires_hospitalization": false,
        "requires_previous_studies": false,
        "is_surgical": false
      },
      "status": "Activo",
      "notes": null
    }
  ],
  "usage_note": "Use el campo 'code' (código CUPS) o 'id' para referenciar procedimientos"
}
```

### Campos de cada procedimiento

#### Información Básica
- **id**: ID interno del procedimiento
- **code**: Código CUPS oficial
- **name**: Nombre completo del procedimiento
- **category**: Categoría (Ecografía, Laboratorio, etc.)
- **subcategory**: Subcategoría (puede ser null)
- **description**: Descripción adicional (puede ser null)

#### Especialidad
- **specialty**: Objeto con id y nombre de la especialidad asociada (puede ser null)

#### Costos
- **pricing.price**: Precio del procedimiento en pesos
- **pricing.requires_authorization**: Si requiere autorización de EPS

#### Requisitos
- **requirements.complexity_level**: Baja, Media o Alta
- **requirements.estimated_duration_minutes**: Duración estimada
- **requirements.requires_anesthesia**: Si requiere anestesia
- **requirements.requires_hospitalization**: Si requiere hospitalización
- **requirements.requires_previous_studies**: Si requiere estudios previos
- **requirements.is_surgical**: Si es procedimiento quirúrgico

#### Estado
- **status**: Activo, Inactivo o Descontinuado
- **notes**: Notas adicionales (puede ser null)

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Buscar por código CUPS exacto

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "searchCups",
    "arguments": {
      "code": "881201"
    }
  }
}
```

**Resultado:** 1 procedimiento encontrado
- Código: 881201
- Nombre: ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS
- Precio: $128,030.00
- Duración: 60 minutos

### Ejemplo 2: Buscar por nombre (parcial)

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "searchCups",
    "arguments": {
      "name": "abdomen"
    }
  }
}
```

**Resultado:** 6 procedimientos encontrados
- ECOGRAFIA DE ABDOMEN TOTAL
- ECOGRAFIA DE ABDOMEN SUPERIOR
- ECOGRAFIA DE ABDOMEN (PILORO)
- ECOGRAFIA DE ABDOMEN (MASAS)
- ECOGRAFIA DE TEJIDOS BLANDOS DE ABDOMEN
- ECOGRAFIA DEL ABDOMEN Y PELVIS

### Ejemplo 3: Buscar por categoría con límite

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "searchCups",
    "arguments": {
      "category": "Ecografia",
      "limit": 5
    }
  }
}
```

**Resultado:** 5 primeros procedimientos de categoría Ecografía

### Ejemplo 4: Buscar código parcial

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "searchCups",
    "arguments": {
      "code": "8813"
    }
  }
}
```

**Resultado:** Todos los códigos que empiezan con 8813

### Ejemplo 5: Búsqueda combinada

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "searchCups",
    "arguments": {
      "category": "Ecografia",
      "name": "mama",
      "status": "Activo"
    }
  }
}
```

**Resultado:** Ecografías activas que contengan "mama" en el nombre

### Ejemplo 6: Listar todos (sin filtros)

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "searchCups",
    "arguments": {
      "limit": 10
    }
  }
}
```

**Resultado:** Los primeros 10 procedimientos activos

---

## 🧪 Pruebas Realizadas

### Test 1: Código exacto ✅
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "searchCups",
      "arguments": {
        "code": "881201"
      }
    }
  }'
```
**Resultado:** 1 procedimiento (Ecografía de mama)

### Test 2: Búsqueda por nombre ✅
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "searchCups",
      "arguments": {
        "name": "abdomen"
      }
    }
  }'
```
**Resultado:** 6 procedimientos con "abdomen" en el nombre

### Test 3: Búsqueda por categoría ✅
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "searchCups",
      "arguments": {
        "category": "Ecografia",
        "limit": 5
      }
    }
  }'
```
**Resultado:** 5 ecografías encontradas

---

## 💡 Casos de Uso

### 1. Sistema de Llamadas Automático
```
Paciente: "Necesito una ecografía de mama"
Sistema: Busca "mama" + "ecografia" → Encuentra código 881201
Sistema: "Ecografía de mama, costo $128,030, duración 60 minutos"
```

### 2. Validación de Procedimientos
```
Usuario ingresa código: "8812"
Sistema: searchCups({code: "8812"})
Sistema: Lista todos los códigos que empiezan con 8812
```

### 3. Catálogo de Servicios
```
Mostrar todos los procedimientos de categoría "Ecografía"
Sistema: searchCups({category: "Ecografia", limit: 100})
```

### 4. Búsqueda por Precio
```javascript
// Buscar ecografías y filtrar por precio en aplicación
searchCups({category: "Ecografia"})
  .then(results => results.procedures.filter(p => p.pricing.price < 150000))
```

---

## 🔍 Tabla CUPS - Estructura

La tabla `cups` contiene 62 procedimientos médicos con la siguiente estructura:

### Campos Principales
- **id**: ID único auto-incremental
- **code**: Código CUPS (varchar 20, UNIQUE)
- **name**: Nombre del procedimiento (varchar 500)
- **category**: Categoría (varchar 100)
- **subcategory**: Subcategoría opcional
- **description**: Descripción detallada
- **specialty_id**: FK a tabla specialties
- **price**: Precio decimal(10,2)
- **requires_authorization**: Boolean
- **complexity_level**: ENUM (Baja, Media, Alta)
- **estimated_duration_minutes**: Duración en minutos
- **requires_anesthesia**: Boolean
- **requires_hospitalization**: Boolean
- **requires_previous_studies**: Boolean
- **status**: ENUM (Activo, Inactivo, Descontinuado)
- **is_surgical**: Boolean
- **notes**: Texto adicional
- **created_at**: Timestamp de creación
- **updated_at**: Timestamp de actualización

### Índices
- PRIMARY KEY (id)
- UNIQUE KEY (code)
- INDEX (name)
- INDEX (category)
- INDEX (specialty_id)
- INDEX (status)

---

## 📊 Estadísticas de la Tabla

- **Total de procedimientos:** 62
- **Categorías principales:**
  - Ecografía: Mayoría de los registros
  - Otras categorías disponibles en el sistema
- **Estados:**
  - Activo: Mayoría
  - Inactivo: Algunos
  - Descontinuado: Pocos
- **Rango de precios:** $118,020 - $202,020 (ecografías)

---

## 🚀 Integración con Otras Herramientas

### Con `searchSpecialties`
```javascript
// 1. Buscar especialidad
searchSpecialties({name: "Ecografías"}) 
// → specialty_id: 6

// 2. Buscar procedimientos de esa especialidad
searchCups({specialty_id: 6})
// → Lista todos los procedimientos de Ecografías
```

### Con `addToWaitingList`
```javascript
// 1. Buscar procedimiento
searchCups({code: "881201"})
// → Ecografía de mama, specialty_id: 6

// 2. Agregar a lista de espera
addToWaitingList({
  patient_id: 1057,
  specialty_id: 6,
  reason: "Ecografía de mama (CUPS 881201)"
})
```

### Con `getAvailableAppointments`
```javascript
// 1. Identificar procedimiento y especialidad
searchCups({name: "abdomen"})
// → Múltiples opciones con sus specialty_id

// 2. Buscar disponibilidad
getAvailableAppointments({
  specialty_id: 6,
  date_from: "2025-10-20",
  date_to: "2025-10-27"
})
```

---

## ⚠️ Consideraciones

### Búsqueda Case-Insensitive
- Todas las búsquedas por texto son insensibles a mayúsculas/minúsculas
- "ABDOMEN" = "abdomen" = "Abdomen"

### Búsqueda Parcial
- `code: "881"` → Encuentra todos los códigos que contengan "881"
- `name: "mama"` → Encuentra "ECOGRAFIA DE MAMA", "mamá", etc.

### Límite de Resultados
- Default: 20 procedimientos
- Máximo: 100 procedimientos
- Para catálogos completos: usar limit: 100

### Performance
- Query optimizado con índices en campos principales
- Búsquedas rápidas incluso con múltiples filtros
- JOIN con tabla specialties para información completa

---

## 🐛 Manejo de Errores

### Sin resultados
```json
{
  "success": true,
  "message": "No se encontraron procedimientos CUPS...",
  "total": 0,
  "procedures": []
}
```

### Error de base de datos
```json
{
  "success": false,
  "error": "Error al consultar procedimientos CUPS",
  "details": "Mensaje de error específico"
}
```

---

## 📈 Métricas

- **Función implementada:** `searchCups()`
- **Líneas de código:** ~170
- **Parámetros:** 6 opcionales
- **Tiempo de respuesta:** < 100ms (promedio)
- **Compilación:** Sin errores
- **Deployment:** PM2 restart #23

---

## 🔄 Versión

**V1.8** - 16 de Octubre, 2025
- ✅ Herramienta `searchCups` implementada
- ✅ Búsqueda flexible por múltiples criterios
- ✅ Información completa de procedimientos
- ✅ Integración con especialidades
- ✅ Pruebas exitosas
- ✅ Documentación completa

---

## 📞 Endpoints

**Servidor:** http://localhost:8977/mcp-unified  
**Health Check:** http://localhost:8977/health  
**Herramientas disponibles:** 18  
**Base de datos:** biosanar

---

## 🎯 Resumen

La herramienta `searchCups` proporciona acceso completo a la base de datos CUPS del sistema, permitiendo buscar y consultar procedimientos médicos de manera flexible y eficiente. Es especialmente útil para identificar tipos de ecografías y otros procedimientos por código, nombre o categoría, facilitando la integración con sistemas de agendamiento y listas de espera.

**Estado:** ✅ OPERATIVO EN PRODUCCIÓN
