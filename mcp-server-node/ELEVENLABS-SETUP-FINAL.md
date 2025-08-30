# 🎯 CONFIGURACIÓN FINAL PARA ELEVENLABS MCP

## ✅ **CONFIGURACIÓN VERIFICADA Y FUNCIONANDO**

Tu servidor MCP está completamente operativo. Aquí tienes la configuración exacta para ElevenLabs:

---

## 🔧 **CONFIGURACIÓN PARA ELEVENLABS**

### **Basic Information**
```
Name: Biosanarcall Medical System
Description: Sistema médico para búsqueda de pacientes y citas médicas
```

### **Server Configuration**
```
Server type: [Streamable HTTP] ← IMPORTANTE: Seleccionar este botón negro
Server URL: https://biosanarcall.site/mcp-elevenlabs
```

### **HTTP Headers**
Click en "Add header" y agregar:
```
Key: X-API-Key
Value: biosanarcall_mcp_node_2025
```

### **Tool Approval Mode**
```
✅ Always Ask (Recommended) ← Seleccionar esta opción
```

---

## 🧪 **VERIFICACIÓN ANTES DE CONFIGURAR**

Ejecuta estos comandos para confirmar que todo funciona:

```bash
# 1. Verificar servidor activo
curl -s https://biosanarcall.site/mcp-node-health | jq .status
# Debe devolver: "ok"

# 2. Verificar información del servidor
curl -s https://biosanarcall.site/mcp-node-info | jq .authentication
# Debe mostrar detalles de autenticación

# 3. Verificar herramientas disponibles
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}' | jq '.result.tools | length'
# Debe devolver: 3
```

---

## 🛠️ **HERRAMIENTAS DISPONIBLES**

Una vez configurado correctamente, tendrás acceso a estas 3 herramientas optimizadas para voz:

1. **searchPatients**
   - Buscar pacientes por nombre o documento
   - Parámetros: `q` (búsqueda), `limit` (opcional, máx 20)

2. **getAppointments**
   - Ver citas de una fecha específica
   - Parámetros: `date` (opcional, formato YYYY-MM-DD)

3. **getDaySummary**
   - Resumen del día optimizado para síntesis de voz
   - Parámetros: `date` (opcional, formato YYYY-MM-DD)

---

## 🚨 **SOLUCIÓN A PROBLEMAS COMUNES**

### **"Scanning available tools..." no termina**
- ✅ URL correcta: `https://biosanarcall.site/mcp-elevenlabs` (sin barra final)
- ✅ Server type: `Streamable HTTP` (NO SSE)
- ✅ Header: `X-API-Key: biosanarcall_mcp_node_2025`

### **Error de autenticación**
- Verificar que la API Key esté exactamente como: `biosanarcall_mcp_node_2025`
- No debe tener espacios en blanco al inicio o final
- Es case-sensitive (sensible a mayúsculas/minúsculas)

### **Tools no aparecen**
- Esperar 10-15 segundos después de "Add Server"
- Si no funciona, eliminar el servidor y agregarlo nuevamente
- Verificar con el comando de verificación arriba

---

## 📊 **ENDPOINTS DISPONIBLES**

| Endpoint | URL | Propósito |
|----------|-----|-----------|
| **MCP ElevenLabs** | `https://biosanarcall.site/mcp-elevenlabs` | Endpoint principal para ElevenLabs |
| **Health Check** | `https://biosanarcall.site/mcp-node-health` | Verificar estado del servidor |
| **Server Info** | `https://biosanarcall.site/mcp-node-info` | Información completa del servidor |
| **MCP Simple** | `https://biosanarcall.site/mcp-simple` | 6 herramientas (desarrollo/testing) |

---

## 🔐 **CONFIGURACIÓN DE SEGURIDAD**

- **API Key activa**: `biosanarcall_mcp_node_2025`
- **Método**: HTTP Header
- **Header name**: `X-API-Key`
- **Logging**: Todas las requests son logueadas
- **Rate limiting**: No implementado (servidor privado)

---

## 📞 **TESTING EN VIVO**

Para probar que las herramientas funcionan antes de usar en ElevenLabs:

```bash
# Buscar pacientes
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": "search",
    "method": "tools/call",
    "params": {
      "name": "searchPatients",
      "arguments": {"q": "Juan", "limit": 3}
    }
  }' | jq .result

# Ver citas de hoy
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": "appointments",
    "method": "tools/call",
    "params": {
      "name": "getAppointments",
      "arguments": {}
    }
  }' | jq .result

# Resumen del día
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": "summary",
    "method": "tools/call",
    "params": {
      "name": "getDaySummary",
      "arguments": {}
    }
  }' | jq .result
```

---

## ✅ **CHECKLIST FINAL**

Antes de configurar en ElevenLabs, confirma que todos estos puntos están ✅:

- [ ] Servidor health check OK: `curl https://biosanarcall.site/mcp-node-health`
- [ ] API Key funciona: Test con curl arriba
- [ ] 3 herramientas disponibles: `tools/list` devuelve 3 tools
- [ ] Base de datos conectada: health check muestra "connected"
- [ ] PM2 servidor online: `pm2 status` muestra "online"

---

## 🎯 **CONFIGURACIÓN PARA COPIAR/PEGAR**

```
ElevenLabs MCP Server Configuration:

Basic Information:
├─ Name: Biosanarcall Medical System
└─ Description: Sistema médico para búsqueda de pacientes y citas médicas

Server Configuration:
├─ Server type: Streamable HTTP
└─ Server URL: https://biosanarcall.site/mcp-elevenlabs

HTTP Headers:
├─ Key: X-API-Key
└─ Value: biosanarcall_mcp_node_2025

Security:
└─ Tool Approval Mode: Always Ask (Recommended)
```

**¡Ya está listo para usar con ElevenLabs! 🚀**

Si tienes algún problema, envíame el resultado de:
```bash
curl -s https://biosanarcall.site/mcp-node-info | jq .authentication
```
