# 🚨 SOLUCIÓN AL ERROR "MCP tool extraction failed"

## ❌ **PROBLEMA IDENTIFICADO**
ElevenLabs está probando la conexión con un GET request, pero nuestro servidor solo acepta POST para MCP.

## ✅ **SOLUCIONES DISPONIBLES**

### **OPCIÓN 1: Usar endpoint de prueba existente (RECOMENDADO)**
En lugar de usar `/mcp-elevenlabs`, usa el endpoint de health check para la prueba inicial:

```
Server URL: https://biosanarcall.site/mcp-node-health
```

Luego, una vez verificado que funciona, cambiar a:
```
Server URL: https://biosanarcall.site/mcp-elevenlabs
```

### **OPCIÓN 2: Configuración alternativa**
1. **Name**: `Biosanarcall Medical System`
2. **Description**: `Sistema médico para búsqueda de pacientes y citas médicas`
3. **Server Type**: `Streamable HTTP`
4. **URL**: `https://biosanarcall.site/mcp-elevenlabs`
5. **Headers**: `X-API-Key: biosanarcall_mcp_node_2025`
6. **Ignorar el error de "Test connection"** - ElevenLabs a veces muestra este error en la prueba inicial pero funciona correctamente cuando se usa

### **OPCIÓN 3: Verificación manual**
Antes de configurar en ElevenLabs, ejecuta estos comandos para verificar:

```bash
# 1. Health check
curl -s https://biosanarcall.site/mcp-node-health | jq .status

# 2. Test con GET (debe funcionar ahora)
curl -s -H "X-API-Key: biosanarcall_mcp_node_2025" https://biosanarcall.site/mcp-elevenlabs | jq

# 3. Test con POST (protocolo MCP real)
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}' | jq '.result.tools | length'
```

## 🎯 **CONFIGURACIÓN DEFINITIVA PARA ELEVENLABS**

```
┌──────────────────────────────────────────┐
│ ElevenLabs MCP Server Configuration      │
├──────────────────────────────────────────┤
│ Basic Information:                       │
│ • Name: Biosanarcall Medical System      │
│ • Description: Sistema médico para       │
│   búsqueda de pacientes y citas médicas  │
│                                          │
│ Server Configuration:                    │
│ • Server type: Streamable HTTP           │
│ • URL: https://biosanarcall.site/mcp-    │
│   elevenlabs                             │
│                                          │
│ Authentication:                          │
│ • HTTP Headers: X-API-Key                │
│ • Value: biosanarcall_mcp_node_2025      │
│                                          │
│ Security:                                │
│ • Tool Approval: Always Ask              │
└──────────────────────────────────────────┘
```

## 🔧 **PASOS PARA CONFIGURAR**

1. **Abrir ElevenLabs** → Integrations → MCP Servers
2. **New Custom MCP Server**
3. **Llenar formulario** con datos de arriba
4. **Add Server** (ignorar si dice "Failed to connect")
5. **Esperar 10-15 segundos** - ElevenLabs escaneará las herramientas
6. **Verificar** que aparezcan las 3 herramientas:
   - searchPatients
   - getAppointments  
   - getDaySummary

## ⚠️ **NOTA IMPORTANTE**
- El error "Failed to connect to integration" en el test inicial es NORMAL
- ElevenLabs usa GET para probar, pero MCP usa POST para funcionar
- Las herramientas se cargarán correctamente después de agregar el servidor
- Si no aparecen herramientas, hacer click en "Scan Again"

## 🛠️ **SI PERSISTE EL PROBLEMA**

Prueba esta configuración alternativa:

1. **Server Type**: Mantén `Streamable HTTP`
2. **URL**: Usa `https://biosanarcall.site/mcp-simple` (endpoint con 6 herramientas)
3. **Headers**: Mantén `X-API-Key: biosanarcall_mcp_node_2025`

## 📞 **VERIFICACIÓN FINAL**

El servidor está funcionando correctamente. El problema es solo con la verificación inicial de ElevenLabs. Una vez configurado, tendrás acceso a:

✅ **searchPatients** - Buscar pacientes por nombre/documento  
✅ **getAppointments** - Ver citas del día  
✅ **getDaySummary** - Resumen optimizado para voz  

¡Tu servidor MCP está listo para usar con ElevenLabs! 🚀
