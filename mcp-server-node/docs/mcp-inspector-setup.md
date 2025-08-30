# Instrucciones para MCP Inspector - Biosanarcall

## ✅ **Servidor Funcionando Correctamente**

Tu servidor MCP está funcionando perfectamente. Aquí están las instrucciones para usar el **MCP Inspector**:

## 🔗 **URLs Disponibles**

### Para el MCP Inspector (SIN autenticación):
```
https://biosanarcall.site/mcp-inspector
```

### Para ElevenLabs (CON autenticación):
```
https://biosanarcall.site/mcp-elevenlabs
```

## 🛠️ **Configuración del MCP Inspector**

### Opción 1: **Interfaz Web** (Recomendado)
1. Ve a: **http://localhost:6274/** (si está ejecutándose)
2. O instala el Inspector:
   ```bash
   npm install -g @modelcontextprotocol/inspector
   npx @modelcontextprotocol/inspector
   ```

### Configuración en el Inspector:
- **Transport Type**: `Streamable HTTP`
- **URL**: `https://biosanarcall.site/mcp-inspector`
- **Authentication**: ❌ **DEJALO VACÍO** (no requiere autenticación)
- **OAuth 2.0 Flow**: ❌ Deshabilitado

### Opción 2: **Línea de Comandos**
```bash
# Inicializar
curl -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": "1", "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}}}'

# Listar herramientas
curl -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": "2", "method": "tools/list"}'

# Buscar pacientes
curl -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": "3", "method": "tools/call", "params": {"name": "searchPatients", "arguments": {"q": "Juan", "limit": 3}}}'
```

## 🎯 **Herramientas Disponibles**

1. **searchPatients** - Buscar pacientes por nombre
   - Parámetros: `q` (texto), `limit` (número, 1-20)

2. **getAppointments** - Ver citas de una fecha
   - Parámetros: `date` (YYYY-MM-DD, opcional)

3. **getDaySummary** - Resumen del día para voz
   - Parámetros: `date` (YYYY-MM-DD, opcional)

## ✅ **Pruebas Realizadas - Todo Funciona**

- ✅ **Initialize**: Servidor responde correctamente
- ✅ **Tools/List**: 3 herramientas disponibles
- ✅ **Tools/Call**: Búsqueda de pacientes funcional
- ✅ **Database**: Conexión MySQL operativa
- ✅ **Authentication**: Bypass correcto para Inspector

## 🚀 **Para ElevenLabs** (producción)

Cuando configures ElevenLabs, usa:
- **URL**: `https://biosanarcall.site/mcp-elevenlabs`
- **Authentication**: `X-API-Key: biosanarcall_mcp_node_2025`

## 🔍 **Resolución de Problemas**

Si el Inspector no conecta:
1. Verifica que uses `https://biosanarcall.site/mcp-inspector` (NO mcp-elevenlabs)
2. No agregues autenticación para el Inspector
3. Usa "Streamable HTTP" como transport
4. El servidor está en puerto 8976, proxy por Nginx

## 📊 **Estado del Sistema**

- **Servidor**: ✅ Online (PM2: biosanarcall-mcp-node-mysql)
- **Base de Datos**: ✅ MySQL conectada
- **Nginx**: ✅ Proxy configurado
- **SSL**: ✅ Let's Encrypt activo
- **Inspector Endpoint**: ✅ Funcionando sin autenticación
- **ElevenLabs Endpoint**: ✅ Funcionando con autenticación

¡Todo está listo para usar! 🎉
