# 🔍 Nueva Herramienta: searchSpecialties

**Fecha:** 14 de Octubre, 2025  
**Versión:** V1.8  
**Herramientas totales:** 17

---

## 🎯 Objetivo

Crear una herramienta para **buscar e identificar especialidades médicas** del sistema, permitiendo búsquedas por:
- **ID** (specialty_id)
- **Nombre** (búsqueda parcial, case-insensitive)
- **Estado** (activas, inactivas o todas)

---

## 📋 Definición de la Herramienta

### Nombre
`searchSpecialties`

### Descripción
Lista y busca especialidades médicas del sistema. Permite buscar por ID, nombre o listar todas. Retorna información completa incluyendo ID, nombre, descripción, duración y estado activo/inactivo. Útil para encontrar el `specialty_id` necesario para agendar citas o agregar a lista de espera.

### Parámetros

| Parámetro | Tipo | Requerido | Descripción | Default |
|-----------|------|-----------|-------------|---------|
| `specialty_id` | number | ❌ No | ID de la especialidad a buscar (busca una específica) | - |
| `name` | string | ❌ No | Nombre o parte del nombre (búsqueda parcial) | - |
| `active_only` | boolean | ❌ No | Si es true, solo muestra activas. Si es false, todas | false |

**Nota:** Todos los parámetros son opcionales. Sin parámetros, retorna todas las especialidades.

---

## 🔧 Implementación

### SQL Query Base
```sql
SELECT 
  id,
  name,
  description,
  default_duration_minutes,
  active,
  created_at
FROM specialties
WHERE 1=1
  [AND id = ?]                    -- Si specialty_id especificado
  [AND name LIKE ?]               -- Si name especificado (%nombre%)
  [AND active = 1]                -- Si active_only = true
ORDER BY name
```

### Características de Búsqueda

1. **Búsqueda por ID**: Exacta
   ```json
   {"specialty_id": 3}
   ```

2. **Búsqueda por Nombre**: Parcial, case-insensitive
   ```json
   {"name": "cardio"}  // Encuentra "Cardiología"
   ```

3. **Búsqueda Combinada**: ID + Nombre + Estado
   ```json
   {"name": "medicina", "active_only": true}
   ```

4. **Listar Todas**: Sin parámetros
   ```json
   {}
   ```

---

## 📊 Respuesta de la Herramienta

### Estructura Exitosa
```json
{
  "success": true,
  "message": "Se encontraron 13 especialidad(es)",
  "search_criteria": {
    "specialty_id": "Todas",
    "name": "Todas",
    "active_only": "Todas (activas e inactivas)"
  },
  "total": 13,
  "specialties": [
    {
      "id": 3,
      "name": "Cardiología",
      "description": "Corazon",
      "duration_minutes": 15,
      "active": true,
      "created_at": "2025-08-08T23:28:59.000Z"
    },
    {
      "id": 16,
      "name": "Neurología",
      "description": "Especialidad de prueba INACTIVA",
      "duration_minutes": 30,
      "active": false,
      "created_at": "2025-10-14T00:09:39.000Z"
    }
    // ... más especialidades
  ],
  "usage_note": "Use el campo 'id' para specialty_id al agendar citas o agregar a lista de espera"
}
```

### Estructura Sin Resultados
```json
{
  "success": false,
  "message": "No se encontraron especialidades con los criterios especificados",
  "search_criteria": {
    "specialty_id": 999,
    "name": "No especificado",
    "active_only": false
  },
  "total": 0,
  "specialties": []
}
```

---

## ✅ Pruebas Realizadas

### Test 1: Listar Todas las Especialidades
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "searchSpecialties",
      "arguments": {}
    }
  }'
```

**Resultado:** ✅ SUCCESS
- Total: 13 especialidades
- 12 activas + 1 inactiva (Neurología)

### Test 2: Buscar por Nombre (Parcial)
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "searchSpecialties",
      "arguments": {
        "name": "cardio"
      }
    }
  }'
```

**Resultado:** ✅ SUCCESS
- Encontrado: 1 especialidad
- ID: 3
- Nombre: "Cardiología"
- Búsqueda case-insensitive funciona

### Test 3: Buscar por ID Específico
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "searchSpecialties",
      "arguments": {
        "specialty_id": 16
      }
    }
  }'
```

**Resultado:** ✅ SUCCESS
- Encontrado: Neurología (INACTIVA)
- ID: 16
- active: false

### Test 4: Solo Especialidades Activas
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "searchSpecialties",
      "arguments": {
        "active_only": true
      }
    }
  }'
```

**Resultado:** ✅ SUCCESS
- Total: 12 especialidades (sin Neurología inactiva)
- Todas con active: true

---

## 📈 Especialidades en el Sistema

| ID | Nombre | Duración | Estado |
|----|--------|----------|--------|
| 1 | Medicina General | 15 min | ✅ Activa |
| 3 | Cardiología | 15 min | ✅ Activa |
| 5 | Odontologia | 20 min | ✅ Activa |
| 6 | Ecografías | 15 min | ✅ Activa |
| 7 | Psicología | 15 min | ✅ Activa |
| 8 | Pediatría | 15 min | ✅ Activa |
| 9 | Medicina interna | 15 min | ✅ Activa |
| 10 | Dermatología | 15 min | ✅ Activa |
| 11 | Nutrición | 15 min | ✅ Activa |
| 12 | Ginecología | 15 min | ✅ Activa |
| 13 | Medicina familiar | 15 min | ✅ Activa |
| 14 | Ecografías2 | 20 min | ✅ Activa |
| 16 | Neurología | 30 min | ❌ Inactiva |

**Total:** 13 especialidades (12 activas, 1 inactiva)

---

## 🎯 Casos de Uso

### 1. Encontrar ID de Especialidad por Nombre
**Escenario:** Usuario dice "quiero cardiología" pero no sabemos el ID

```javascript
// Búsqueda
searchSpecialties({ name: "cardio" })

// Respuesta
{
  "specialties": [
    { "id": 3, "name": "Cardiología" }
  ]
}

// Usar ID para agendar
addToWaitingList({
  patient_id: 1057,
  specialty_id: 3,  // ← ID obtenido
  reason: "Consulta cardiología"
})
```

### 2. Verificar si Especialidad Existe
**Escenario:** Validar specialty_id antes de crear cita

```javascript
// Verificación
searchSpecialties({ specialty_id: 16 })

// Respuesta indica si existe y si está activa
{
  "specialties": [
    { "id": 16, "name": "Neurología", "active": false }
  ]
}
```

### 3. Listar Opciones Disponibles al Usuario
**Escenario:** Mostrar menú de especialidades

```javascript
// Solo activas
searchSpecialties({ active_only: true })

// Respuesta: 12 especialidades activas
// Presentar al usuario para selección
```

### 4. Búsqueda Inteligente
**Escenario:** Usuario escribe parte del nombre

```javascript
// Usuario escribe: "medi"
searchSpecialties({ name: "medi" })

// Encuentra:
// - Medicina General (ID: 1)
// - Medicina interna (ID: 9)
// - Medicina familiar (ID: 13)
```

---

## 🔗 Integración con Otras Herramientas

### Con `addToWaitingList`
```javascript
// 1. Buscar especialidad
const result = await searchSpecialties({ name: "pediatria" });
const specialty_id = result.specialties[0].id;  // 8

// 2. Agregar a lista de espera
await addToWaitingList({
  patient_id: 1057,
  specialty_id: specialty_id,
  reason: "Control pediátrico"
});
```

### Con `getAvailableAppointments`
```javascript
// 1. Buscar especialidad
const result = await searchSpecialties({ name: "odonto" });
const specialty_id = result.specialties[0].id;  // 5

// 2. Buscar disponibilidad
await getAvailableAppointments({
  specialty_id: specialty_id,
  start_date: "2025-10-15",
  end_date: "2025-10-20"
});
```

---

## 💡 Ventajas de la Herramienta

| Ventaja | Descripción |
|---------|-------------|
| **Búsqueda Flexible** | Por ID, nombre o combinación |
| **Case-insensitive** | "CARDIO", "cardio", "Cardio" funcionan igual |
| **Búsqueda Parcial** | "medi" encuentra todas las medicinas |
| **Estado Visible** | Muestra si especialidad está activa/inactiva |
| **Sin Parámetros** | Lista todas al no especificar filtros |
| **Información Completa** | ID, nombre, descripción, duración, estado |

---

## 🔧 Archivos Modificados

### `/home/ubuntu/app/mcp-server-node/src/server-unified.ts`

**Líneas modificadas:**
1. **413-432**: Tool definition (schema de searchSpecialties)
2. **691-695**: Dispatcher (registro de la función)
3. **2406-2502**: Function implementation (lógica de búsqueda)

**Total de líneas añadidas:** ~120

---

## 🚀 Despliegue

```bash
# Compilación
cd /home/ubuntu/app/mcp-server-node
npm run build

# Reinicio del servidor
pm2 restart mcp-unified

# Verificación
curl -s http://localhost:8977/health
```

**Estado actual:**
- ✅ Compilado exitosamente
- ✅ Servidor reiniciado (restart #22)
- ✅ Herramientas: 17 (antes: 16)
- ✅ Todas las pruebas exitosas

---

## 📊 Comparación Antes/Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| Herramientas totales | 16 | 17 |
| Buscar especialidades | ❌ No disponible | ✅ searchSpecialties |
| Búsqueda por nombre | ❌ Manual | ✅ Automática |
| Búsqueda por ID | ❌ Manual | ✅ Automática |
| Filtrar por estado | ❌ No | ✅ active_only |
| Información completa | ❌ Limitada | ✅ Completa |

---

## 🎯 Próximos Pasos Sugeridos

1. **Caché de especialidades:** Implementar caché en memoria para respuestas más rápidas
2. **Búsqueda avanzada:** Añadir filtro por duración de consulta
3. **Estadísticas:** Mostrar cuántas citas hay por especialidad
4. **Popularidad:** Ordenar por especialidades más solicitadas
5. **Sinónimos:** Detectar sinónimos (ej: "odonto" = "odontología")

---

## 📞 Uso en Producción

**Ejemplos de uso:**

```javascript
// Listar todas
searchSpecialties({})

// Buscar por nombre
searchSpecialties({ name: "cardio" })

// Buscar por ID
searchSpecialties({ specialty_id: 3 })

// Solo activas
searchSpecialties({ active_only: true })

// Combinado
searchSpecialties({ 
  name: "medicina", 
  active_only: true 
})
```

---

**Sistema:** Biosanarcall MCP Server  
**Versión:** V1.8  
**Herramienta:** searchSpecialties  
**Estado:** ✅ OPERATIVO EN PRODUCCIÓN

**🎉 Nueva herramienta lista para identificar especialidades! 🎉**
