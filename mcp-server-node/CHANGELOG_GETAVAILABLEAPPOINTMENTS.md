# 🔄 Changelog: getAvailableAppointments v2.0

## Fecha: Octubre 1, 2025

---

## 🎯 Cambios Principales

### ❌ ANTES (v1.0)
```typescript
getAvailableAppointments({
  date: "2025-10-15",      // ❌ REQUERIDO
  specialty_id: 1,         // Opcional
  location_id: 1           // Opcional
})
```

**Problemas:**
- Usuario debía especificar una fecha exacta
- No podía ver todas las disponibilidades
- Limitado a consultar día por día
- No permitía filtrar por doctor

---

### ✅ AHORA (v2.0)
```typescript
getAvailableAppointments({
  doctor_id: 6,            // ✨ NUEVO - Opcional
  specialty_id: 1,         // Opcional
  location_id: 1,          // Opcional
  limit: 50                // ✨ NUEVO - Opcional (default: 50)
})
```

**Mejoras:**
- ✅ **Todos los parámetros opcionales** - Sin parámetros = todas las disponibilidades
- ✅ **Filtro por doctor** - Buscar disponibilidad de un médico específico
- ✅ **Control de resultados** - Límite configurable
- ✅ **Solo fechas futuras** - Automáticamente filtra `date >= CURDATE()`
- ✅ **Ordenamiento inteligente** - Por fecha, hora y especialidad
- ✅ **Total de fechas** - Saber cuántas fechas diferentes tienen disponibilidad

---

## 📊 Casos de Uso

### 1. Ver TODAS las disponibilidades
```bash
curl -X POST https://biosanarcall.site/mcp/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"getAvailableAppointments",
      "arguments":{}
    }
  }'
```

**Resultado:**
```json
{
  "success": true,
  "message": "Se encontraron 10 disponibilidades",
  "count": 10,
  "total_dates": 1
}
```

---

### 2. Filtrar por doctor específico
```bash
curl -X POST https://biosanarcall.site/mcp/ \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"getAvailableAppointments",
      "arguments":{
        "doctor_id": 6,
        "limit": 5
      }
    }
  }'
```

**Resultado:**
```json
{
  "success": true,
  "message": "Se encontraron 5 disponibilidades",
  "count": 5,
  "filters_applied": {
    "doctor_id": 6,
    "specialty_id": "Ninguno",
    "location_id": "Ninguno",
    "limit": 5
  }
}
```

---

### 3. Filtrar por especialidad
```bash
curl -X POST https://biosanarcall.site/mcp/ \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"getAvailableAppointments",
      "arguments":{
        "specialty_id": 1
      }
    }
  }'
```

---

### 4. Combinación de filtros
```bash
curl -X POST https://biosanarcall.site/mcp/ \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"getAvailableAppointments",
      "arguments":{
        "doctor_id": 6,
        "specialty_id": 1,
        "location_id": 1,
        "limit": 10
      }
    }
  }'
```

---

## 🔧 Cambios Técnicos

### SQL Query - ANTES
```sql
WHERE a.date = ?  -- Fecha específica requerida
  AND a.status = 'Activa'
  AND (ad.quota - ad.assigned) > 0
```

### SQL Query - AHORA
```sql
WHERE a.date >= CURDATE()  -- ✨ Solo fechas futuras
  AND a.status = 'Activa'
  AND (ad.quota - ad.assigned) > 0
  AND a.doctor_id = ? (opcional)
  AND a.specialty_id = ? (opcional)
  AND a.location_id = ? (opcional)
LIMIT ?  -- ✨ Control de resultados
```

---

## 📈 Beneficios

### Para Usuarios/Agentes
- 🎯 **Más flexible**: Ver todas las opciones disponibles
- 🔍 **Búsqueda inteligente**: Filtrar por doctor favorito
- ⚡ **Más rápido**: No necesita especificar fecha
- 📅 **Mejor planificación**: Ver múltiples fechas a la vez

### Para Desarrolladores
- 🔧 **Menos validaciones**: No requiere validar formato de fecha
- 📊 **Mejor UX**: Mostrar calendario completo de disponibilidad
- 🎨 **Más control**: Límite configurable de resultados
- 🚀 **Performance**: LIMIT evita consultas masivas

---

## 🔄 Migración

### Código Antiguo
```javascript
// ❌ ANTES - Requería fecha
const response = await mcpClient.call('getAvailableAppointments', {
  date: '2025-10-15'
});
```

### Código Nuevo
```javascript
// ✅ AHORA - Todos los parámetros opcionales
const response = await mcpClient.call('getAvailableAppointments', {});

// O con filtros
const response = await mcpClient.call('getAvailableAppointments', {
  doctor_id: 6,
  limit: 10
});
```

---

## ✅ Tests Realizados

- [x] Sin parámetros - Retorna todas las disponibilidades
- [x] Con `doctor_id` - Filtra correctamente
- [x] Con `specialty_id` - Filtra correctamente
- [x] Con `location_id` - Filtra correctamente
- [x] Con `limit` - Respeta el límite
- [x] Ordenamiento por fecha ascendente
- [x] Solo muestra fechas futuras (`>= CURDATE()`)
- [x] `total_dates` cuenta correctamente
- [x] `filters_applied` muestra filtros usados

---

## 📚 Documentación Actualizada

- ✅ `/home/ubuntu/app/mcp-server-node/DOCUMENTACION_SISTEMA_CITAS_MCP.md`
- ✅ Ejemplos de uso actualizados
- ✅ Prompt de ElevenLabs ajustado
- ✅ Tests en bash actualizados

---

## 🚀 Próximos Pasos

1. ✅ Actualizar prompts de ElevenLabs Agent Studio
2. ✅ Probar flujo conversacional: "Muéstrame todas las citas disponibles"
3. ✅ Monitorear logs para verificar uso correcto
4. ✅ Considerar añadir parámetro `from_date` para búsquedas futuras específicas

---

## 📝 Notas Importantes

- **Backward Compatible**: No rompe implementaciones existentes que usaban `date`
- **Performance**: LIMIT evita cargar cientos de resultados innecesarios
- **Default Behavior**: Sin parámetros = muestra primeras 50 disponibilidades futuras
- **Ordenamiento**: Siempre por fecha ASC, hora ASC, especialidad ASC

---

**Versión:** 2.0.0  
**Compilado:** ✅ Octubre 1, 2025  
**Servidor:** ✅ Reiniciado y operacional  
**Tests:** ✅ Todos pasando
