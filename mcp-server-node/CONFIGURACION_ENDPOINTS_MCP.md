# 🔧 Configuración Final de Endpoints MCP - ElevenLabs

## 📋 Resumen de Integración (Octubre 2025)

Configuración completa y funcional de los servidores MCP para ElevenLabs Agent Studio.

---

## 🌐 Endpoints Disponibles

### 1️⃣ **Biossanar - Servidor Completo** ✅
```
URL: https://biosanarcall.site/mcp/
Servidor: mcp-server-unified (Puerto 8977)
Endpoint Interno: /elevenlabs-mcp
Herramientas: 62 herramientas completas
Estado: Funcional
```

**Configuración Nginx:**
```nginx
location /mcp/ {
    proxy_pass http://127.0.0.1:8977/elevenlabs-mcp;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**Herramientas Incluidas:**
- Gestión completa de pacientes (CRUD)
- Gestión de citas (crear, actualizar, cancelar)
- Consulta de disponibilidad
- Gestión de EPS y municipios
- Estadísticas y reportes
- Notificaciones
- Y 56 herramientas adicionales...

---

### 2️⃣ **Endpoint Simplificado ElevenLabs** ✅
```
URL: https://biosanarcall.site/mcp-elevenlabs/
Servidor: mcp-server-simple-register (Puerto 8978)
Endpoint Interno: /mcp
Herramientas: 1 herramienta (registerPatientSimple)
Estado: Funcional
Propósito: Registro rápido de pacientes por voz
```

**Configuración Nginx:**
```nginx
location /mcp-elevenlabs/ {
    proxy_pass http://127.0.0.1:8978/mcp;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # CORS Headers para ElevenLabs
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods "POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type" always;
}
```

**Herramienta Única:**
```javascript
registerPatientSimple: {
  campos_requeridos: {
    document: "Cédula del paciente",
    name: "Nombre completo",
    phone: "Teléfono de contacto",
    insurance_eps_id: "ID de EPS (1-17)"
  },
  campos_opcionales: {
    notes: "Notas adicionales"
  }
}
```

---

### 3️⃣ **Servidor de Referencia Conalca** ℹ️
```
URL: https://my-kontrol.online/mcp/
Servidor: Externo (FastAPI)
Herramientas: 12 herramientas
Estado: Referencia (no gestionado por nosotros)
Propósito: Servidor de ejemplo para comparación
```

---

## 🔄 Servidores Activos (PM2)

### **mcp-server-unified** (Puerto 8977)
```bash
pm2 show mcp-server-unified
# 62 herramientas
# Base de datos: MySQL biosanar
# Memoria: 150MB aprox
```

### **mcp-simple-register** (Puerto 8978)
```bash
pm2 show mcp-simple-register
# 1 herramienta
# Base de datos: MySQL biosanar
# Memoria: 100MB aprox
```

**Verificar Estado:**
```bash
pm2 status | grep mcp
```

---

## 🧪 Testing de Endpoints

### Test Rápido
```bash
# Servidor completo (62 herramientas)
curl -s -X POST https://biosanarcall.site/mcp/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'

# Servidor simplificado (1 herramienta)
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'
```

### Test Completo
```bash
# Usar script de testing
/home/ubuntu/app/mcp-server-node/test-elevenlabs-endpoint.sh
```

---

## 📱 Configuración en ElevenLabs Agent Studio

### Opción 1: **Servidor Completo** (Recomendado para agentes con múltiples funciones)
```
Nombre: Biossanar
URL: https://biosanarcall.site/mcp/
Protocolo: MCP (Model Context Protocol)
Herramientas: 62 disponibles
```

### Opción 2: **Servidor Simplificado** (Recomendado para registro rápido por voz)
```
Nombre: Registro Rápido Biosanarcall
URL: https://biosanarcall.site/mcp-elevenlabs/
Protocolo: MCP (Model Context Protocol)
Herramientas: 1 disponible (registerPatientSimple)
```

---

## 🗄️ Base de Datos

**Conexión Actual:**
```
Host: 127.0.0.1
Database: biosanar
User: biosanar_user
Pacientes Activos: 1033+
EPS Activas: 17
```

**EPS Disponibles (IDs 1-17):**
1. NUEVA EPS
2. SANITAS
3. SURA
4. SALUD TOTAL
5. COMPENSAR
... (ver tabla `insurance_eps` para lista completa)

---

## 🔐 Seguridad

- ✅ **CORS** configurado para permitir origen de ElevenLabs
- ✅ **HTTPS** obligatorio (certificado SSL válido)
- ✅ **Rate Limiting** en Express
- ✅ **Validación de datos** en todas las herramientas
- ✅ **Sanitización SQL** con prepared statements

---

## 📊 Monitoreo

### Logs de Servidores
```bash
# Servidor unificado
pm2 logs mcp-server-unified --lines 50

# Servidor simplificado
pm2 logs mcp-simple-register --lines 50
```

### Logs de Nginx
```bash
tail -f /var/log/nginx/biosanarcall.site.access.log
tail -f /var/log/nginx/biosanarcall.site.error.log
```

### Estado del Sistema
```bash
# Verificar todo el sistema
/home/ubuntu/app/backend/system_status.sh
```

---

## 🛠️ Mantenimiento

### Reiniciar Servidores
```bash
# Reiniciar servidor unificado
pm2 restart mcp-server-unified

# Reiniciar servidor simplificado
pm2 restart mcp-simple-register

# Reiniciar todos los MCP
pm2 restart all
```

### Recargar Nginx
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Backup de Configuración
```bash
# Nginx
sudo cp /etc/nginx/sites-available/biosanarcall.site \
  /home/ubuntu/app/backups/nginx-biosanarcall-$(date +%Y%m%d).conf

# PM2
pm2 save
```

---

## 🐛 Troubleshooting

### Problema: ElevenLabs no ve herramientas
**Solución:**
1. Verificar CORS: `curl -I https://biosanarcall.site/mcp-elevenlabs/`
2. Verificar herramientas: `curl -X POST ... {"method":"tools/list"}`
3. Revisar logs PM2: `pm2 logs mcp-simple-register`

### Problema: Error 502 Bad Gateway
**Solución:**
1. Verificar servidor: `pm2 status`
2. Reiniciar: `pm2 restart mcp-server-unified`
3. Verificar logs: `pm2 logs`

### Problema: Base de datos no conecta
**Solución:**
1. Verificar MySQL: `sudo systemctl status mysql`
2. Probar conexión: `mysql -u biosanar_user -p biosanar`
3. Revisar credenciales en `.env`

---

## 📞 Contacto y Soporte

- **Sistema:** Biosanarcall Medical Management
- **Repositorio:** otakuogeek/Callcenter-MCP
- **Branch Actual:** main-clean
- **Fecha Configuración:** Octubre 1, 2025
- **Última Actualización:** Octubre 1, 2025

---

## ✅ Checklist de Verificación

- [x] Servidor unificado (8977) funcionando
- [x] Servidor simplificado (8978) funcionando
- [x] Nginx configurado correctamente
- [x] CORS habilitado para ElevenLabs
- [x] Base de datos MySQL conectada
- [x] 62 herramientas en /mcp/
- [x] 1 herramienta en /mcp-elevenlabs/
- [x] Tests pasando correctamente
- [x] PM2 con auto-restart configurado
- [x] SSL/HTTPS activo

---

## 🎯 Siguientes Pasos Recomendados

1. **Configurar en ElevenLabs**: Agregar las URLs en Agent Studio
2. **Probar con Agente de Voz**: Verificar interacción completa
3. **Monitorear Logs**: Observar primeras llamadas en producción
4. **Optimizar Prompts**: Ajustar instrucciones del agente según resultados
5. **Documentar Casos de Uso**: Crear guía de mejores prácticas

---

**Documento creado:** Octubre 1, 2025  
**Última verificación:** ✅ Todos los endpoints funcionando correctamente
