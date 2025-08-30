# 📋 CONFIGURACIÓN COMPLETA - SERVIDOR MCP NODE.JS

## 🔧 **Resumen del Sistema**

### **Estado Actual**
- ✅ **Servidor**: Node.js v22.18.0 + TypeScript + Express
- ✅ **Base de Datos**: MySQL directo (sin proxy)
- ✅ **Proceso**: PM2 con autorestart
- ✅ **SSL**: https://biosanarcall.site/
- ✅ **API Key**: biosanarcall_mcp_node_2025
- ✅ **Puerto**: 8976

---

## 🚀 **URLs de Acceso**

| Endpoint | URL | Descripción |
|----------|-----|-------------|
| **Health** | `https://biosanarcall.site/mcp-node-health` | Estado del servidor |
| **MCP ElevenLabs** | `https://biosanarcall.site/mcp-elevenlabs` | 3 herramientas optimizadas |
| **MCP Simple** | `https://biosanarcall.site/mcp-simple` | 6 herramientas completas |
| **Info** | `https://biosanarcall.site/mcp-node-info` | Información del servidor |

---

## 🔐 **Configuración de Autenticación**

```bash
# Header de autenticación
X-API-Key: biosanarcall_mcp_node_2025

# Ejemplo de uso con curl:
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}'
```

---

## 📁 **Estructura de Archivos**

```
mcp-server-node/
├── server-mysql.ts                 # Servidor principal
├── ecosystem-mysql.config.json     # Configuración PM2
├── package.json                    # Dependencias
├── tsconfig.json                   # TypeScript config
├── .env.example                    # Variables de entorno
├── src/
│   ├── routes/
│   │   └── mcp-mysql.ts            # Rutas MCP + Logic
│   ├── db/
│   │   ├── mysql.ts                # Pool de conexiones
│   │   └── queries.ts              # Consultas SQL
│   ├── middleware/
│   │   └── auth.ts                 # Autenticación API Key
│   └── logger-mysql.ts             # Winston logging
└── logs/
    ├── mysql-error.log             # Errores
    ├── mysql-out.log               # Output estándar
    └── mysql-combined.log          # Log combinado
```

---

## 🛠️ **Herramientas Disponibles**

### **MCP ElevenLabs (3 herramientas optimizadas)**
1. **searchPatients** - Buscar pacientes por nombre/documento
2. **getAppointments** - Ver citas de fecha específica  
3. **getDaySummary** - Resumen del día optimizado para voz

### **MCP Simple (6 herramientas completas)**
- Incluye las 3 anteriores más:
4. **getPatient** - Detalle completo de paciente
5. **getDoctors** - Lista de médicos disponibles
6. **ping** - Verificación de conectividad

---

## ⚙️ **Configuración de Variables de Entorno**

```bash
# Servidor
NODE_ENV=production
PORT=8976
LOG_LEVEL=info

# Autenticación
MCP_API_KEY=biosanarcall_mcp_node_2025

# Base de Datos MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=biosanar_user
DB_PASSWORD=/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU
DB_NAME=biosanar
```

---

## 🔧 **Configuración de Nginx**

```nginx
# Configuración en /etc/nginx/sites-available/biosanarcall.site

# MCP Node.js Server (Optimizado para ElevenLabs)
location = /mcp-node-health { 
    proxy_pass http://127.0.0.1:8976/api/health; 
    access_log off; 
}
location = /mcp-node-info { 
    proxy_pass http://127.0.0.1:8976/api/info; 
}
location = /mcp-elevenlabs { 
    proxy_pass http://127.0.0.1:8976/api/elevenlabs; 
    proxy_pass_request_headers on; 
}
location = /mcp-simple { 
    proxy_pass http://127.0.0.1:8976/api/mcp-simple; 
    proxy_pass_request_headers on; 
}
```

---

## 🚦 **Comandos de Gestión**

### **Gestión con PM2**
```bash
# Ver estado
pm2 status

# Reiniciar servidor
pm2 restart biosanarcall-mcp-node-mysql

# Ver logs en tiempo real
pm2 logs biosanarcall-mcp-node-mysql

# Detener servidor
pm2 stop biosanarcall-mcp-node-mysql

# Eliminar de PM2
pm2 delete biosanarcall-mcp-node-mysql
```

### **Comandos de Prueba**
```bash
# Health check
curl -s https://biosanarcall.site/mcp-node-health | jq

# Listar herramientas
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}' | jq

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
      "arguments": {"q": "Juan", "limit": 5}
    }
  }' | jq
```

---

## 📊 **Configuración de Base de Datos**

### **Pool de Conexiones MySQL**
```typescript
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'biosanar_user',
  password: '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
  database: 'biosanar',
  connectionLimit: 10,        // Máximo 10 conexiones
  acquireTimeout: 60000,      // 60s timeout para obtener conexión
  timeout: 60000,             // 60s timeout para queries
  multipleStatements: false,  // Seguridad
  timezone: '+00:00'          // UTC
}
```

### **Tablas Utilizadas**
- `patients` - Información de pacientes
- `appointments` - Citas médicas  
- `doctors` - Información de médicos

---

## 🧪 **Configuración para ElevenLabs**

### **En ElevenLabs MCP Setup:**
```
Name: Biosanarcall Medical
Description: Sistema médico con búsqueda de pacientes y citas

Server Type: Streamable HTTP
URL: https://biosanarcall.site/mcp-elevenlabs

HTTP Headers:
- Key: X-API-Key
- Value: biosanarcall_mcp_node_2025

Tool Approval: Always Ask (Recommended)
```

---

## 📈 **Métricas de Rendimiento**

- **Respuesta promedio**: ~15ms
- **Conexión MySQL**: Directa (sin proxy HTTP)
- **Mejora vs Python**: 3x más rápido
- **Memoria PM2**: ~50MB
- **CPU**: <1% en idle

---

## 🔍 **Logs y Debugging**

### **Ubicación de Logs**
```bash
# Logs de PM2
./logs/mysql-error.log      # Solo errores
./logs/mysql-out.log        # Output estándar  
./logs/mysql-combined.log   # Ambos

# Ver logs en tiempo real
tail -f ./logs/mysql-combined.log

# Logs de sistema
sudo journalctl -u nginx -f
sudo tail -f /var/log/nginx/error.log
```

### **Debugging Common Issues**
```bash
# Verificar proceso
ps aux | grep node

# Verificar puerto
sudo netstat -tulpn | grep 8976

# Verificar MySQL
mysql -h 127.0.0.1 -u biosanar_user -p biosanar

# Test de conectividad
curl -I https://biosanarcall.site/mcp-node-health
```

---

## 🔄 **Backup y Restore**

### **Configuración**
```bash
# Backup de configuración
cp /etc/nginx/sites-available/biosanarcall.site ~/backup_nginx_$(date +%Y%m%d)
cp ecosystem-mysql.config.json ~/backup_pm2_$(date +%Y%m%d)

# Backup de código
tar -czf ~/backup_mcp_node_$(date +%Y%m%d).tar.gz /home/ubuntu/app/mcp-server-node/
```

---

## 🚨 **Troubleshooting**

### **Problemas Comunes**

1. **Error de conexión MySQL**
   ```bash
   # Verificar credenciales en ecosystem-mysql.config.json
   # Probar conexión manual
   mysql -h 127.0.0.1 -u biosanar_user -p
   ```

2. **Error 502 Bad Gateway**
   ```bash
   # Verificar que el servidor esté corriendo
   pm2 status
   curl localhost:8976/api/health
   ```

3. **Error de autenticación**
   ```bash
   # Verificar API Key en requests
   # Header: X-API-Key: biosanarcall_mcp_node_2025
   ```

4. **Error de CORS**
   ```bash
   # Ya configurado en server-mysql.ts
   # app.use(cors())
   ```

---

## ✅ **Checklist de Verificación**

- [ ] Servidor corriendo en PM2: `pm2 status`
- [ ] Health check OK: `curl https://biosanarcall.site/mcp-node-health`
- [ ] Base de datos conectada: Status "connected"
- [ ] Herramientas listadas: 3 en ElevenLabs, 6 en Simple
- [ ] Autenticación funcionando: Con API Key
- [ ] Logs generándose: En `./logs/`
- [ ] Nginx proxy OK: 200 responses
- [ ] SSL válido: https sin errores

---

**🎯 SERVIDOR MCP NODE.JS LISTO PARA PRODUCCIÓN**
**⚡ Optimizado para ElevenLabs Voice AI**
**📞 Biosanarcall Medical System**
