# Instrucciones para usar MCP Inspector con Biosanarcall

## 🔍 MCP Inspector está funcionando

El MCP Inspector está ejecutándose en:
**http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=d563fdaa5a8f6fe0378eee1af1bba4dde769b4125f6f036795f770e6e95598d8**

## 🔧 Configuración para conectar al servidor Biosanarcall

### Opción 1: Streamable HTTP (Recomendada)

1. **Transport type**: Seleccionar "Streamable HTTP"
2. **URL**: `http://localhost:8976/api/elevenlabs`
3. **Authentication**: Configurar API Key
   - Header: `X-API-Key`
   - Value: `biosanarcall_mcp_node_2025`

### Opción 2: Usando configuración de archivo

Crear archivo `~/.config/mcp/settings.json` con:

```json
{
  "mcpServers": {
    "biosanarcall-elevenlabs": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "http://localhost:8976/api/elevenlabs",
        "-H", "Content-Type: application/json",
        "-H", "X-API-Key: biosanarcall_mcp_node_2025",
        "-d", "@-"
      ]
    }
  }
}
```

## ✅ Verificación de funcionamiento

El servidor MCP está respondiendo correctamente:

- **Initialize**: ✅ `{"jsonrpc":"2.0","id":"1","result":{"capabilities":{"tools":true},"serverInfo":{"name":"biosanarcall-elevenlabs","version":"1.0.0"}}}`
- **Tools/list**: ✅ 3 herramientas disponibles
- **Tools/call**: ✅ Funcional (searchPatients probado)
- **Ping**: ✅ Responde con pong

## 🎯 Herramientas disponibles

1. **searchPatients** - Buscar pacientes por nombre o documento
2. **getAppointments** - Ver citas de una fecha específica  
3. **getDaySummary** - Resumen hablado del día para voz

## 🔑 Credenciales

- **API Key**: `biosanarcall_mcp_node_2025`
- **Endpoint ElevenLabs**: `http://localhost:8976/api/elevenlabs`
- **Endpoint Simple**: `http://localhost:8976/api/mcp-simple`

## 📝 Comandos de prueba manual

```bash
# Inicializar
curl -X POST http://localhost:8976/api/elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"mcp-inspector","version":"1.0.0"}}}'

# Listar herramientas
curl -X POST http://localhost:8976/api/elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/list"}'

# Buscar pacientes
curl -X POST http://localhost:8976/api/elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"searchPatients","arguments":{"q":"Maria","limit":3}}}'
```
