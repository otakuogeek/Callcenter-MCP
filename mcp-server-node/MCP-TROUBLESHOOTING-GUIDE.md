# 🔐 GUÍA DE CONFIGURACIÓN Y AUTENTICACIÓN MCP

## ⚠️ **DIAGNÓSTICO DE PROBLEMAS COMUNES**

### **Si las herramientas no cargan en ElevenLabs:**

1. **Verificar URL correcta**
   ```
   ❌ INCORRECTO: https://biosanarcall.site/mcp-elevenlabs/
   ✅ CORRECTO:   https://biosanarcall.site/mcp-elevenlabs
   ```

2. **Verificar Header de autenticación**
   ```
   Key: X-API-Key
   Value: biosanarcall_mcp_node_2025
   ```

3. **Verificar Server Type**
   ```
   ✅ Streamable HTTP (NO SSE)
   ```

---

## 🔧 **CONFIGURACIÓN PASO A PASO PARA ELEVENLABS**

### **Paso 1: Información Básica**
```
Name: Biosanarcall Medical System
Description: Sistema médico para búsqueda de pacientes y citas médicas
```

### **Paso 2: Server Configuration**
```
Server type: [Streamable HTTP] (seleccionar este botón, NO SSE)
Server URL: https://biosanarcall.site/mcp-elevenlabs
```

### **Paso 3: HTTP Headers (CRÍTICO)**
Click en "Add header" y agregar:
```
Header Key: X-API-Key
Header Value: biosanarcall_mcp_node_2025
```

### **Paso 4: Tool Approval Mode**
```
✅ Always Ask (Recommended) - Seleccionar esta opción
```

---

## 🧪 **PRUEBAS DE VERIFICACIÓN**

### **Test 1: Verificar conectividad**
```bash
curl -s https://biosanarcall.site/mcp-node-health | jq
# Debe devolver: {"status": "ok", "database": "connected"}
```

### **Test 2: Verificar autenticación**
```bash
# Sin API Key (debe fallar)
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}'

# Con API Key (debe funcionar)
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}' | jq
```

### **Test 3: Verificar herramientas**
```bash
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}' | jq -r '.result.tools[] | .name'
# Debe mostrar: searchPatients, getAppointments, getDaySummary
```

---

## 🔐 **CONFIGURACIONES DE AUTENTICACIÓN DISPONIBLES**

### **API Key Actual**
```
Clave: biosanarcall_mcp_node_2025
Método: HTTP Header
Header: X-API-Key
```

### **Para generar nueva API Key (si necesario)**
```bash
# Generar nueva clave
NEW_API_KEY="biosanarcall_mcp_$(date +%Y%m%d)_$(openssl rand -hex 8)"
echo "Nueva API Key: $NEW_API_KEY"

# Actualizar en ecosystem PM2
sed -i "s/biosanarcall_mcp_node_2025/$NEW_API_KEY/g" ecosystem-mysql.config.json

# Reiniciar servidor
pm2 restart biosanarcall-mcp-node-mysql
```

---

## 🔍 **DEBUGGING Y LOGS**

### **Verificar logs del servidor**
```bash
# Ver logs en tiempo real
pm2 logs biosanarcall-mcp-node-mysql --lines 50

# Ver solo errores
tail -f ./logs/mysql-error.log

# Ver todas las requests
tail -f ./logs/mysql-combined.log | grep "mcp-elevenlabs"
```

### **Verificar estado del servidor**
```bash
# Estado PM2
pm2 status | grep biosanarcall-mcp-node-mysql

# Test directo del puerto
curl -s localhost:8976/api/health | jq

# Test a través de nginx
curl -s https://biosanarcall.site/mcp-node-health | jq
```

---

## 🛠️ **SOLUCIÓN DE PROBLEMAS COMUNES**

### **Problema 1: "Scanning available tools..." no termina**
**Causa:** URL incorrecta o headers mal configurados
**Solución:**
```
1. Verificar URL exacta: https://biosanarcall.site/mcp-elevenlabs
2. Verificar header: X-API-Key: biosanarcall_mcp_node_2025
3. Asegurarse de seleccionar "Streamable HTTP"
```

### **Problema 2: Error de autenticación**
**Causa:** API Key incorrecta o header mal configurado
**Solución:**
```bash
# Verificar API Key actual en el servidor
grep "MCP_API_KEY" ecosystem-mysql.config.json

# Test manual
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"initialize","params":{}}'
```

### **Problema 3: Timeout o no responde**
**Causa:** Servidor caído o nginx mal configurado
**Solución:**
```bash
# Verificar servidor
pm2 restart biosanarcall-mcp-node-mysql

# Verificar nginx
sudo nginx -t && sudo systemctl reload nginx

# Test directo
curl -s -m 10 https://biosanarcall.site/mcp-node-health
```

---

## 📋 **CHECKLIST COMPLETO DE CONFIGURACIÓN**

### **En ElevenLabs MCP Setup:**
- [ ] Name: `Biosanarcall Medical System`
- [ ] Description: `Sistema médico para búsqueda de pacientes y citas`
- [ ] Server type: `Streamable HTTP` (botón negro, NO SSE)
- [ ] URL: `https://biosanarcall.site/mcp-elevenlabs` (sin barra final)
- [ ] HTTP Headers: `X-API-Key` = `biosanarcall_mcp_node_2025`
- [ ] Tool Approval: `Always Ask` (recomendado)

### **Verificaciones del servidor:**
- [ ] Health check OK: `curl https://biosanarcall.site/mcp-node-health`
- [ ] PM2 running: `pm2 status | grep online`
- [ ] Logs sin errores: `pm2 logs biosanarcall-mcp-node-mysql`
- [ ] API Key válida: Test con curl

---

## 🔄 **REINICIO COMPLETO (si nada funciona)**

```bash
# 1. Reiniciar servidor MCP
pm2 restart biosanarcall-mcp-node-mysql

# 2. Verificar estado
pm2 status

# 3. Test de conectividad
curl -s https://biosanarcall.site/mcp-node-health | jq

# 4. Test de autenticación
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}' | jq -r '.result.tools | length'

# 5. Si todo está OK, debe devolver: 3
```

---

## 📞 **CONFIGURACIÓN FINAL PARA COPIAR/PEGAR**

```
🔧 ElevenLabs MCP Configuration:

Name: Biosanarcall Medical System
Description: Sistema médico para búsqueda de pacientes y citas médicas

Server Type: Streamable HTTP
URL: https://biosanarcall.site/mcp-elevenlabs

HTTP Headers:
Key: X-API-Key
Value: biosanarcall_mcp_node_2025

Tool Approval: Always Ask (Recommended)
```

**Si sigues teniendo problemas, ejecuta este comando y envíame el resultado:**
```bash
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"debug","method":"tools/list"}' | jq
```
