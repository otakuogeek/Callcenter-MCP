# 📋 DATOS EXACTOS PARA ELEVENLABS MCP

## ✅ **VERIFICACIÓN COMPLETADA**
- Estado: ✅ OK - Database: connected
- Herramientas: ✅ 3 tools disponibles  
- Autenticación: ✅ biosanarcall-elevenlabs

---

## 📱 **CONFIGURACIÓN EN ELEVENLABS**

### **PANTALLA 1: Basic Information**
```
┌─────────────────────────────────────────┐
│ Name                                    │
│ Biosanarcall Medical System             │
├─────────────────────────────────────────┤
│ Description                             │
│ Sistema médico para búsqueda de         │
│ pacientes y citas médicas               │
└─────────────────────────────────────────┘
```

### **PANTALLA 2: Server Configuration**
```
┌─────────────────────────────────────────┐
│ Server type                             │
│ [  SSE  ] [●Streamable HTTP]           │ ← Seleccionar NEGRO
├─────────────────────────────────────────┤
│ Server URL                              │
│ Type: [URL ▼]                          │
│ https://biosanarcall.site/mcp-elevenlabs│
└─────────────────────────────────────────┘
```

### **PANTALLA 3: Secret Token**
```
┌─────────────────────────────────────────┐
│ Secret                                  │
│ [None ▼]                               │ ← Dejar en None
└─────────────────────────────────────────┘
```

### **PANTALLA 4: HTTP Headers**
```
┌─────────────────────────────────────────┐
│ HTTP Headers            [Add header]    │
├─────────────────────────────────────────┤
│ Key: X-API-Key                         │
│ Value: biosanarcall_mcp_node_2025      │
└─────────────────────────────────────────┘
```

### **PANTALLA 5: Tool Approval Mode**
```
┌─────────────────────────────────────────┐
│ ●Always Ask          Recommended        │ ← Seleccionar este
│ ○Fine-Grained Tool Approval            │
│ ○No Approval                           │
└─────────────────────────────────────────┘
```

---

## 🎯 **DATOS PARA COPIAR/PEGAR**

### **Basic Information**
- **Name**: `Biosanarcall Medical System`
- **Description**: `Sistema médico para búsqueda de pacientes y citas médicas`

### **Server Configuration**
- **Server Type**: `Streamable HTTP`
- **URL**: `https://biosanarcall.site/mcp-elevenlabs`

### **HTTP Headers**
- **Key**: `X-API-Key`
- **Value**: `biosanarcall_mcp_node_2025`

---

## 🚨 **PUNTOS CRÍTICOS**

### **❌ ERRORES COMUNES A EVITAR**
1. **NO seleccionar SSE** - Debe ser "Streamable HTTP"
2. **NO agregar barra final** - URL sin `/` al final
3. **NO espacios en API Key** - Copiar exactamente
4. **NO olvidar el header** - Debe ser exactamente `X-API-Key`

### **✅ CONFIGURACIÓN CORRECTA**
- Server Type: **Streamable HTTP** (botón negro)
- URL: `https://biosanarcall.site/mcp-elevenlabs` (sin barra final)
- Header: `X-API-Key: biosanarcall_mcp_node_2025`
- Approval: **Always Ask**

---

## 🛠️ **HERRAMIENTAS QUE TENDRÁS DISPONIBLES**

Una vez configurado correctamente, ElevenLabs tendrá acceso a:

1. **🔍 searchPatients**
   - Buscar pacientes por nombre o documento
   - Ejemplo: "Buscar paciente Juan Pérez"

2. **📅 getAppointments**
   - Ver citas de una fecha específica
   - Ejemplo: "¿Qué citas hay hoy?"

3. **📊 getDaySummary**
   - Resumen del día optimizado para voz
   - Ejemplo: "Dame un resumen del día"

---

## ⚡ **PROCESO COMPLETO**

1. **Abrir ElevenLabs** → Ir a MCP Servers
2. **New Custom MCP Server** → Click
3. **Completar datos** → Usar los valores de arriba
4. **Add Server** → Click
5. **Esperar** → "Scanning available tools..." (10-15 segundos)
6. **¡Listo!** → Aparecerán las 3 herramientas

---

## 🔍 **SI ALGO NO FUNCIONA**

Ejecuta este comando y envíame el resultado:

```bash
curl -s https://biosanarcall.site/mcp-node-info | jq .authentication
```

**O verifica directamente:**
- Health: https://biosanarcall.site/mcp-node-health
- Info: https://biosanarcall.site/mcp-node-info

---

## 📞 **CONFIGURACIÓN FINAL RESUMIDA**

```
┌──────────────────────────────────────────┐
│ ElevenLabs MCP Server Setup              │
├──────────────────────────────────────────┤
│ Name: Biosanarcall Medical System        │
│ Description: Sistema médico para búsqueda│
│             de pacientes y citas médicas │
│                                          │
│ Server Type: Streamable HTTP             │
│ URL: https://biosanarcall.site/mcp-      │
│      elevenlabs                          │
│                                          │
│ Headers:                                 │
│   X-API-Key: biosanarcall_mcp_node_2025 │
│                                          │
│ Tool Approval: Always Ask                │
└──────────────────────────────────────────┘
```

**✅ ¡Copia estos datos exactamente como están y tu servidor MCP funcionará perfectamente con ElevenLabs!** 🚀
