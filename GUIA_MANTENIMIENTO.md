# Guía de Mantenimiento y Actualización — Biosanarcall

Esta guía proporciona instrucciones paso a paso para mantener y actualizar el sistema en producción.

---

## 📋 Índice

1. [Rutinas de Mantenimiento](#rutinas-de-mantenimiento)
2. [Actualización de Código](#actualización-de-código)
3. [Gestión de Base de Datos](#gestión-de-base-de-datos)
4. [Monitoreo y Logs](#monitoreo-y-logs)
5. [Backups y Recuperación](#backups-y-recuperación)
6. [Regeneración del Manual](#regeneración-del-manual)
7. [Troubleshooting Común](#troubleshooting-común)

---

## 🔄 Rutinas de Mantenimiento

### Diarias

**1. Verificar estado de servicios PM2**
```bash
pm2 list
pm2 monit
```

Servicios que deben estar corriendo:
- `cita-central-backend` (uptime > 0%, memory < 300M)
- `mcp-server-python` (uptime > 0%)
- `elevenlabs-sync` (si está configurado)

**2. Revisar logs de errores**
```bash
# Backend
pm2 logs cita-central-backend --lines 50 --err

# MCP Server
pm2 logs mcp-server-python --lines 50 --err

# Nginx
sudo tail -f /var/log/nginx/error.log
```

**3. Verificar espacio en disco**
```bash
df -h /home/ubuntu
du -sh /home/ubuntu/app/backend/logs
du -sh /home/ubuntu/app/backend/uploads
```

Limpiar si es necesario:
```bash
# Logs antiguos (>30 días)
find /home/ubuntu/app/backend/logs -name "*.log" -mtime +30 -delete

# Archivos temporales
cd /home/ubuntu/app/backend/uploads && rm -rf tmp/*
```

### Semanales

**1. Limpieza de base de datos**
```bash
# Archivar llamadas antiguas (configurado en CALL_ARCHIVE_DAYS)
mysql -u biosanar_user -p biosanar -e "
DELETE FROM elevenlabs_calls 
WHERE created_at < NOW() - INTERVAL 30 DAY 
AND status IN ('completed', 'failed');
"

# Limpiar logs SMS antiguos
mysql -u biosanar_user -p biosanar -e "
DELETE FROM sms_logs 
WHERE created_at < NOW() - INTERVAL 90 DAY;
"
```

**2. Actualizar estadísticas de tablas**
```bash
mysql -u biosanar_user -p biosanar -e "
ANALYZE TABLE patients;
ANALYZE TABLE appointments;
ANALYZE TABLE appointments_waiting_list;
ANALYZE TABLE consultations;
"
```

**3. Verificar backup automático**
```bash
# Ver último backup
ls -lht /home/ubuntu/app/backups/ | head -5

# Crear backup manual si es necesario
./scripts/backup_database.sh
```

### Mensuales

**1. Actualizar dependencias (con precaución)**
```bash
# Backend - verificar vulnerabilidades
cd /home/ubuntu/app/backend
npm audit
npm audit fix # Solo si no hay breaking changes

# Frontend
cd /home/ubuntu/app/frontend
npm audit
npm audit fix
```

**2. Revisar y renovar certificados SSL**
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

**3. Optimizar base de datos**
```bash
mysql -u biosanar_user -p biosanar -e "
OPTIMIZE TABLE patients;
OPTIMIZE TABLE appointments;
OPTIMIZE TABLE availabilities;
"
```

---

## 🚀 Actualización de Código

### Frontend (React)

**1. Hacer cambios en local o rama de desarrollo**
```bash
cd /home/ubuntu/app/frontend
git pull origin main
npm install # Si hay nuevas dependencias
```

**2. Compilar para producción**
```bash
npm run build
```

**3. Verificar build**
```bash
ls -lh dist/
# Debe contener: index.html, assets/, etc.
```

**4. Nginx ya está apuntando a dist/, no requiere acción adicional**

**5. Limpiar cache del navegador** (avisar a usuarios):
```
Ctrl + Shift + R (Chrome/Firefox)
```

### Backend (Node.js + Express)

**1. Hacer cambios y pull**
```bash
cd /home/ubuntu/app/backend
git pull origin main
npm install # Si hay nuevas dependencias
```

**2. Compilar TypeScript**
```bash
npm run build
```

**3. Verificar compilación**
```bash
ls -lh dist/src/
# Debe contener: server.js, routes/, services/, etc.
```

**4. Reiniciar servicio PM2**
```bash
pm2 restart cita-central-backend
```

**5. Verificar que arrancó correctamente**
```bash
pm2 logs cita-central-backend --lines 20
curl -I http://localhost:4000/api/health # Si tienes endpoint health
```

### Migraciones de Base de Datos

**1. Crear nueva migración**
```bash
cd /home/ubuntu/app/backend/migrations
# Crear archivo: YYYYMMDD_nombre_descriptivo.sql
nano 20251101_add_new_field.sql
```

**2. Aplicar migración**
```bash
mysql -u biosanar_user -p biosanar < migrations/20251101_add_new_field.sql
```

**3. Verificar cambios**
```bash
mysql -u biosanar_user -p biosanar -e "DESCRIBE nombre_tabla;"
```

**4. Documentar en README o docs/**

### Rollback (si algo sale mal)

**Frontend**:
```bash
cd /home/ubuntu/app/frontend
git checkout HEAD~1 # Volver 1 commit atrás
npm run build
# Nginx servirá automáticamente la nueva versión de dist/
```

**Backend**:
```bash
cd /home/ubuntu/app/backend
git checkout HEAD~1
npm run build
pm2 restart cita-central-backend
```

**Base de datos**:
```bash
# Restaurar desde backup
mysql -u biosanar_user -p biosanar < /home/ubuntu/app/backups/backup_YYYYMMDD.sql
```

---

## 🗄️ Gestión de Base de Datos

### Conexión Manual
```bash
mysql -u biosanar_user -p biosanar
```

### Queries Útiles

**Ver pacientes en cola de espera**:
```sql
SELECT 
  p.full_name,
  s.specialty_name,
  awl.priority_level,
  awl.queue_position,
  awl.created_at
FROM appointments_waiting_list awl
JOIN patients p ON awl.patient_id = p.patient_id
JOIN specialties s ON awl.specialty_id = s.specialty_id
WHERE awl.status = 'pending'
ORDER BY s.specialty_id, awl.queue_position;
```

**Ver citas del día**:
```sql
SELECT 
  a.appointment_id,
  p.full_name,
  s.specialty_name,
  d.full_name AS doctor_name,
  a.scheduled_date,
  a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
JOIN availabilities av ON a.availability_id = av.availability_id
JOIN specialties s ON av.specialty_id = s.specialty_id
JOIN doctors d ON av.doctor_id = d.doctor_id
WHERE DATE(a.scheduled_date) = CURDATE()
ORDER BY a.scheduled_date;
```

**Estadísticas de SMS**:
```sql
SELECT 
  status,
  COUNT(*) as total,
  DATE(created_at) as fecha
FROM sms_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY status, DATE(created_at)
ORDER BY fecha DESC;
```

### Verificar Integridad

**Pacientes duplicados**:
```sql
SELECT document_number, COUNT(*) as duplicados
FROM patients
GROUP BY document_number
HAVING COUNT(*) > 1;
```

**Citas huérfanas** (sin availability_id válido):
```sql
SELECT a.appointment_id, a.patient_id, a.availability_id
FROM appointments a
LEFT JOIN availabilities av ON a.availability_id = av.availability_id
WHERE av.availability_id IS NULL;
```

**Teléfonos sin formato E.164**:
```sql
SELECT patient_id, phone_number
FROM patients
WHERE phone_number NOT LIKE '+57%'
AND phone_number IS NOT NULL;
```

Normalizar si es necesario:
```bash
cd /home/ubuntu/app/scripts
bash normalize_all_phones.sh
```

---

## 📊 Monitoreo y Logs

### PM2 Logs

**Ver logs en tiempo real**:
```bash
pm2 logs cita-central-backend
pm2 logs mcp-server-python
```

**Ver solo errores**:
```bash
pm2 logs cita-central-backend --err
```

**Limpiar logs antiguos**:
```bash
pm2 flush
```

**Configurar rotación de logs** (ya configurado en ecosystem.config.js):
```javascript
{
  log_file: 'logs/combined.log',
  error_file: 'logs/error.log',
  out_file: 'logs/out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
}
```

### Nginx Logs

**Access log**:
```bash
sudo tail -f /var/log/nginx/access.log | grep biosanarcall
```

**Error log**:
```bash
sudo tail -f /var/log/nginx/error.log
```

**Analizar errores 500**:
```bash
sudo grep "500" /var/log/nginx/access.log | tail -20
```

### MySQL Logs

**Error log**:
```bash
sudo tail -f /var/log/mysql/error.log
```

**Slow query log** (si está habilitado):
```bash
sudo tail -f /var/log/mysql/slow-query.log
```

Habilitar slow query log:
```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2; -- segundos
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow-query.log';
```

---

## 💾 Backups y Recuperación

### Backup Manual de Base de Datos

**Backup completo**:
```bash
mysqldump -u biosanar_user -p biosanar > /home/ubuntu/app/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

**Backup con compresión**:
```bash
mysqldump -u biosanar_user -p biosanar | gzip > /home/ubuntu/app/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Backup solo estructura** (sin datos):
```bash
mysqldump -u biosanar_user -p --no-data biosanar > /home/ubuntu/app/backups/schema_only.sql
```

**Backup solo datos** (sin estructura):
```bash
mysqldump -u biosanar_user -p --no-create-info biosanar > /home/ubuntu/app/backups/data_only.sql
```

### Restauración

**Desde backup sin comprimir**:
```bash
mysql -u biosanar_user -p biosanar < /home/ubuntu/app/backups/backup_20251101.sql
```

**Desde backup comprimido**:
```bash
gunzip < /home/ubuntu/app/backups/backup_20251101.sql.gz | mysql -u biosanar_user -p biosanar
```

**Restaurar solo una tabla**:
```bash
mysql -u biosanar_user -p biosanar -e "DROP TABLE patients;"
mysqldump -u biosanar_user -p biosanar patients < /home/ubuntu/app/backups/backup_20251101.sql
```

### Backup de Archivos

**Uploads (documentos de pacientes)**:
```bash
tar -czf /home/ubuntu/app/backups/uploads_$(date +%Y%m%d).tar.gz /home/ubuntu/app/backend/uploads/
```

**Código fuente** (ya en Git, pero por si acaso):
```bash
tar -czf /home/ubuntu/app/backups/source_$(date +%Y%m%d).tar.gz /home/ubuntu/app/ --exclude=node_modules --exclude=dist
```

### Automatizar Backups con Cron

**Editar crontab**:
```bash
crontab -e
```

**Agregar líneas**:
```bash
# Backup diario de BD a las 2 AM
0 2 * * * /usr/bin/mysqldump -u biosanar_user -pPASSWORD biosanar | gzip > /home/ubuntu/app/backups/daily_$(date +\%Y\%m\%d).sql.gz

# Backup semanal de uploads (domingos a las 3 AM)
0 3 * * 0 tar -czf /home/ubuntu/app/backups/uploads_$(date +\%Y\%m\%d).tar.gz /home/ubuntu/app/backend/uploads/

# Limpiar backups antiguos (>30 días)
0 4 * * * find /home/ubuntu/app/backups -name "*.sql.gz" -mtime +30 -delete
```

---

## 📸 Regeneración del Manual

### Cuándo Regenerar

Regenera el manual cuando:
- ✅ Cambies la interfaz de usuario significativamente
- ✅ Agregues nuevas funcionalidades o secciones
- ✅ Modifiques workflows principales
- ✅ Actualices el diseño o colores

**NO es necesario** regenerar por:
- ❌ Cambios solo en backend
- ❌ Correcciones de bugs sin impacto visual
- ❌ Ajustes menores de estilos

### Proceso Completo

**1. Asegúrate de que el frontend esté actualizado**:
```bash
cd /home/ubuntu/app/frontend
git pull origin main
npm install
npm run build
```

**2. Verifica que el sistema esté accesible**:
```bash
curl -I https://biosanarcall.site
# Debe retornar: HTTP/2 200
```

**3. Ejecuta el script de generación**:
```bash
cd /home/ubuntu/app/scripts/manual
bash run_manual_fixed.sh
```

**4. Verifica las capturas generadas**:
```bash
ls -lh /home/ubuntu/app/docs/manual_screenshots/
# Deben ser 9 archivos .png con tamaños razonables (>100KB)
```

**5. Revisa el manual actualizado**:
```bash
# Abre en navegador o editor
code /home/ubuntu/app/docs/MANUAL_DE_USO.md
```

**6. Commit y push**:
```bash
cd /home/ubuntu/app
git add docs/manual_screenshots/ docs/MANUAL_DE_USO.md
git commit -m "docs: Update manual screenshots"
git push origin main
```

### Regeneración con Datos Específicos

Si quieres que las capturas muestren datos específicos:

**1. Modifica el script para incluir acciones previas**:
```javascript
// generate_manual.js - después del login
await page.goto(BASE_URL + '/queue');

// Expandir acordeón de especialidad específica
await page.click('[data-specialty-id="1"]');
await page.waitForTimeout(2000);

// Capturar
await screenshotPage(page, '02_queue.png', 'main');
```

**2. O prepara datos en BD antes de ejecutar**:
```sql
-- Agregar pacientes de prueba a una especialidad
INSERT INTO appointments_waiting_list (...) VALUES (...);
```

---

## 🔧 Troubleshooting Común

### Frontend no carga / Pantalla blanca

**Diagnóstico**:
```bash
# 1. Verificar que dist/ existe y tiene contenido
ls -la /home/ubuntu/app/frontend/dist/

# 2. Verificar configuración Nginx
sudo nginx -t
sudo systemctl status nginx

# 3. Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

**Solución**:
```bash
# Recompilar frontend
cd /home/ubuntu/app/frontend
npm run build

# Reiniciar Nginx si es necesario
sudo systemctl restart nginx
```

### Backend no responde / 502 Bad Gateway

**Diagnóstico**:
```bash
# 1. Verificar que PM2 está corriendo
pm2 list

# 2. Ver logs
pm2 logs cita-central-backend --lines 50

# 3. Verificar puerto
netstat -tulpn | grep 4000
```

**Solución**:
```bash
# Reiniciar backend
pm2 restart cita-central-backend

# Si no arranca, verificar código
cd /home/ubuntu/app/backend
npm run build
pm2 restart cita-central-backend
```

### Base de datos no conecta

**Diagnóstico**:
```bash
# 1. Verificar que MySQL está corriendo
sudo systemctl status mysql

# 2. Probar conexión manual
mysql -u biosanar_user -p biosanar

# 3. Verificar credenciales en .env
cat /home/ubuntu/app/backend/.env | grep DB_
```

**Solución**:
```bash
# Reiniciar MySQL si es necesario
sudo systemctl restart mysql

# Verificar permisos de usuario
mysql -u root -p -e "SHOW GRANTS FOR 'biosanar_user'@'localhost';"
```

### SMS no se envían

**Diagnóstico**:
```bash
# 1. Verificar logs de backend
pm2 logs cita-central-backend | grep -i sms

# 2. Verificar credenciales de LabsMobile
cat /home/ubuntu/app/backend/.env | grep LABSMOBILE

# 3. Revisar tabla sms_logs
mysql -u biosanar_user -p biosanar -e "SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 10;"
```

**Solución**:
```bash
# Test directo de API
curl -X POST "https://api.labsmobile.com/json/send" \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD","message":"Test","recipient":["+573001234567"]}'
```

### Llamadas ElevenLabs no sincronizan

**Diagnóstico**:
```bash
# 1. Verificar sincronización está corriendo
pm2 list | grep elevenlabs-sync

# 2. Ver logs de sincronización
pm2 logs elevenlabs-sync

# 3. Verificar última sincronización
mysql -u biosanar_user -p biosanar -e "SELECT * FROM elevenlabs_calls ORDER BY updated_at DESC LIMIT 5;"
```

**Solución**:
```bash
# Reiniciar sincronización
pm2 restart elevenlabs-sync

# Ejecutar manualmente
cd /home/ubuntu/app/backend
node dist/scripts/syncInitial.js
```

### Manual de usuario no se regenera

**Diagnóstico**:
```bash
# 1. Verificar que Playwright está instalado
cd /home/ubuntu/app/scripts/manual
npm list playwright

# 2. Verificar que frontend está accesible
curl -I https://biosanarcall.site

# 3. Ejecutar con verbose
bash -x run_manual_fixed.sh
```

**Solución**:
```bash
# Reinstalar Playwright y navegadores
cd /home/ubuntu/app/scripts/manual
rm -rf node_modules package-lock.json
npm install
npx playwright install chromium

# Ejecutar nuevamente
bash run_manual_fixed.sh
```

### Alto uso de memoria

**Diagnóstico**:
```bash
# 1. Ver procesos por memoria
pm2 monit

# 2. Ver memoria del sistema
free -h
top
```

**Solución**:
```bash
# Ajustar límites PM2 en ecosystem.config.js
{
  max_memory_restart: '200M', // Reducir si es necesario
}

# Reiniciar con nuevos límites
pm2 delete all
pm2 start ecosystem.config.js
```

---

## 📞 Contactos y Recursos

### Documentación Técnica
- **Arquitectura**: `/home/ubuntu/app/RESUMEN_PROYECTO_COMPLETO.md`
- **API Backend**: `/home/ubuntu/app/backend/README.md`
- **MCP Server**: `/home/ubuntu/app/mcp-server-python/README.md`
- **Manual Usuario**: `/home/ubuntu/app/docs/MANUAL_DE_USO.md`

### Logs Importantes
- **PM2 Backend**: `/home/ubuntu/app/backend/logs/`
- **Nginx Access**: `/var/log/nginx/access.log`
- **Nginx Error**: `/var/log/nginx/error.log`
- **MySQL**: `/var/log/mysql/error.log`

### Comandos Rápidos
```bash
# Estado general
pm2 list && sudo systemctl status nginx && sudo systemctl status mysql

# Reiniciar todo
pm2 restart all && sudo systemctl restart nginx

# Ver todos los logs
pm2 logs --lines 20

# Backup rápido
mysqldump -u biosanar_user -p biosanar | gzip > ~/backup_$(date +%Y%m%d).sql.gz
```

---

**Última actualización**: 1 de noviembre de 2025  
**Mantenedor**: Sistema Biosanarcall  
**Repositorio**: Callcenter-MCP
