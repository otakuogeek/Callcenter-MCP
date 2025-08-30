# Uso de API Directa - ElevenLabs

## Endpoint Mejorado para Llamadas Directas

El endpoint `/mcp-elevenlabs` ahora soporta tanto el protocolo MCP completo como llamadas directas simplificadas.

## Base URL
```
https://biosanarcall.site/mcp-elevenlabs
```

## Autenticación
Todas las llamadas requieren el header:
```
X-API-Key: biosanarcall_mcp_node_2025
```

## Métodos Disponibles

### 1. Información del Servidor (GET)
```bash
curl -X GET "https://biosanarcall.site/mcp-elevenlabs" \
  -H "X-API-Key: biosanarcall_mcp_node_2025"
```

**Respuesta:**
- Estado del servidor
- Herramientas disponibles
- Ejemplos de uso directo

### 2. Listar Herramientas (GET)
```bash
curl -X GET "https://biosanarcall.site/mcp-elevenlabs?method=tools/list" \
  -H "X-API-Key: biosanarcall_mcp_node_2025"
```

**Respuesta:**
```json
{
  "tools": [...],
  "count": 3,
  "server": "biosanarcall-elevenlabs"
}
```

### 3. Buscar Pacientes (GET)
```bash
curl -X GET "https://biosanarcall.site/mcp-elevenlabs?tool=searchPatients&q=Juan&limit=5" \
  -H "X-API-Key: biosanarcall_mcp_node_2025"
```

**Parámetros:**
- `tool=searchPatients` (requerido)
- `q=<nombre>` (texto de búsqueda)
- `limit=<número>` (opcional, límite de resultados)

### 4. Obtener Citas (GET)
```bash
curl -X GET "https://biosanarcall.site/mcp-elevenlabs?tool=getAppointments&date=2025-08-19" \
  -H "X-API-Key: biosanarcall_mcp_node_2025"
```

**Parámetros:**
- `tool=getAppointments` (requerido)
- `date=YYYY-MM-DD` (fecha específica)
- `patient_id=<id>` (opcional, paciente específico)
- `speciality=<especialidad>` (opcional, filtro por especialidad)

### 5. Resumen del Día (GET)
```bash
curl -X GET "https://biosanarcall.site/mcp-elevenlabs?tool=getDaySummary&date=2025-08-19" \
  -H "X-API-Key: biosanarcall_mcp_node_2025"
```

**Parámetros:**
- `tool=getDaySummary` (requerido)
- `date=YYYY-MM-DD` (fecha específica)

## Protocolo MCP Completo (POST)

Para funcionalidad completa del protocolo MCP, usar POST:

```bash
curl -X POST "https://biosanarcall.site/mcp-elevenlabs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "searchPatients",
      "arguments": {
        "q": "Juan",
        "limit": 5
      }
    },
    "id": 1
  }'
```

## Ejemplos de Respuesta

### Llamada Directa Exitosa:
```json
{
  "tool": "searchPatients",
  "result": [
    {
      "id": 1,
      "name": "Juan Pérez",
      "phone": "555-0123",
      "email": "juan@example.com"
    }
  ],
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

### Error:
```json
{
  "error": "Tool not found: invalidTool",
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

## Ventajas de las Llamadas Directas

1. **Simplicidad**: URLs directas sin necesidad de JSON-RPC
2. **Cacheable**: Respuestas GET pueden ser cacheadas
3. **Depuración**: Fácil testing desde navegador
4. **Flexibilidad**: Tanto GET como POST soportados
5. **Retrocompatibilidad**: Protocolo MCP completo aún disponible

## Consideraciones

- **GET**: Para consultas simples y testing
- **POST**: Para el protocolo MCP completo y operaciones complejas
- **Autenticación**: Siempre requerida para ambos métodos
- **Límites**: Respeta los mismos límites que el protocolo MCP
