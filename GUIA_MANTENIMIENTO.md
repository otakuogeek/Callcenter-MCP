# 🔧 Guía de Mantenimiento

## Procedimientos de Mantenimiento del Sistema

Esta guía describe los procedimientos de mantenimiento rutinario y solución de problemas del sistema Biosanarcall.

---

## 📅 Mantenimiento Diario

### Verificar Servicios
```bash
# Ver estado de todos los servicios
pm2 status

# Verificar logs de errores
pm2 logs cita-central-backend --lines 50
pm2 logs mcp-unified --lines 50
```

### Verificar Base de Datos
```bash
# Conectar a MySQL
mysql -u biosanar_user -p biosanar

# Verificar conexiones activas
SHOW PROCESSLIST;

# Verificar tamaño de tablas
SELECT table_name, 
       ROUND(data_length/1024/1024, 2) as 'Data MB',
       ROUND(index_length/1024/1024, 2) as 'Index MB'
FROM information_schema.tables 
WHERE table_schema = 'biosanar'
ORDER BY data_length DESC;
```

---

## 🔄 Reinicio de Servicios

### Backend
```bash
cd /home/ubuntu/app/backend
npm run build
pm2 restart cita-central-backend
```

### MCP Server
```bash
pm2 restart mcp-unified
```

### Frontend (Solo si hay cambios)
```bash
cd /home/ubuntu/app/frontend
npm run build
# Los archivos estáticos se sirven automáticamente desde dist/
```

---

## 🐛 Solución de Problemas

### Error 401 - Token Inválido
**Síntoma**: Usuarios reciben error de autenticación
**Solución**:
1. Verificar que JWT_SECRET en `.env` coincida
2. Pedir al usuario cerrar sesión y volver a entrar
3. Verificar fecha/hora del servidor

### Error de Conexión a BD
**Síntoma**: "ECONNREFUSED" en logs
**Solución**:
```bash
# Verificar MySQL está corriendo
systemctl status mysql

# Reiniciar si es necesario
systemctl restart mysql

# Verificar credenciales
mysql -u biosanar_user -p biosanar -e "SELECT 1"
```

### SMS No Se Envían
**Síntoma**: Botón de SMS no funciona
**Solución**:
1. Verificar saldo en LabsMobile
```bash
curl -s "https://api.labsmobile.com/json/balance" \
  -u "contacto@biosanarcall.site:API_KEY"
```
2. Verificar formato de teléfonos (deben empezar con código país)
3. Revisar logs de errores en consola

### WhatsApp Bot Desconectado
**Síntoma**: QR code aparece de nuevo
**Solución**:
1. Escanear QR nuevamente desde el admin
2. Si persiste, reiniciar servicio de WhatsApp

---

## 🗄️ Backup de Base de Datos

### Backup Manual
```bash
# Crear backup
mysqldump -u biosanar_user -p biosanar > backup_$(date +%Y%m%d).sql

# Comprimir
gzip backup_$(date +%Y%m%d).sql
```

### Restaurar Backup
```bash
# Descomprimir
gunzip backup_20260131.sql.gz

# Restaurar
mysql -u biosanar_user -p biosanar < backup_20260131.sql
```

---

## 📊 Monitoreo

### Logs Importantes
| Archivo | Descripción |
|---------|-------------|
| `/home/ubuntu/app/backend/logs/out.log` | Output del backend |
| `/home/ubuntu/app/backend/logs/error.log` | Errores del backend |
| `pm2 logs` | Logs en tiempo real |

### Métricas a Revisar
- Uso de CPU y memoria de PM2
- Conexiones activas a MySQL
- Saldo de SMS en LabsMobile
- Estado de WhatsApp Bot

---

## 🔐 Seguridad

### Rotar Credenciales
Cada 90 días cambiar:
1. Password de base de datos
2. JWT_SECRET
3. API Keys de servicios externos

### Actualizar Dependencias
```bash
# Frontend
cd frontend && npm audit && npm update

# Backend
cd backend && npm audit && npm update
```

---

## 📞 Contacto de Soporte

Para problemas que requieran asistencia:
1. Documentar el error (screenshots, logs)
2. Crear ticket en sistema de soporte
3. Incluir pasos para reproducir

---

*Guía actualizada: Enero 2026*
