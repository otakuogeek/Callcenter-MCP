# 🏥 SERVIDOR MCP UNIFICADO - CONFIGURACIÓN COMPLETA

## ✅ ESTADO ACTUAL
- **Servidor:** Ejecutándose correctamente en puerto 8976
- **PM2:** `biosanar-mcp-unified` activo y estable
- **Base de datos:** Conectada a MySQL (biosanar)
- **Nginx:** Configurado para direccionar todos los endpoints MCP al servidor unificado

## 🔧 CONFIGURACIÓN TÉCNICA

### Servidor MCP Unificado
- **Archivo:** `/home/ubuntu/app/mcp-server-node/src/server-unified.js` (compilado)
- **Puerto:** 8976
- **Proceso PM2:** `biosanar-mcp-unified`
- **Estado:** Online
- **Herramientas disponibles:** 17 herramientas MCP completas

### Base de Datos
- **Host:** 127.0.0.1:3306
- **Usuario:** biosanar_user
- **Base de datos:** biosanar
- **Conexión:** Pooling MySQL con 10 conexiones máximas

### Nginx - Endpoints Disponibles
Todos los endpoints apuntan al servidor unificado en puerto 8976:

#### Endpoints Principales
- `POST /mcp-unified` - Endpoint principal MCP
- `GET /mcp-health` - Estado del servidor
- `GET /mcp-test-db` - Test de conexión a BD

#### Endpoints de Compatibilidad
- `POST /mcp-elevenlabs` - Compatible con ElevenLabs
- `POST /mcp-simple` - Herramientas básicas
- `POST /mcp-complete` - Herramientas completas
- `POST /mcp` - Endpoint genérico
- `POST /mcp-demo` - Herramientas demo
- `POST /mcp-inspector` - Inspector de herramientas
- `POST /elevenlabs` - Alias para Python compatibility

## 🛠️ HERRAMIENTAS MCP DISPONIBLES (17 total)

### 👥 GESTIÓN DE PACIENTES
1. **searchPatients** - Buscar pacientes por nombre/documento/teléfono
2. **getPatient** - Obtener información detallada de un paciente
3. **createPatient** - Crear nuevo paciente
4. **updatePatient** - Actualizar información de paciente

### 📅 GESTIÓN DE CITAS
5. **getAppointments** - Obtener citas por fecha/estado/paciente/médico
6. **createAppointment** - Crear nueva cita médica
7. **updateAppointmentStatus** - Actualizar estado de cita

### 👨‍⚕️ GESTIÓN DE MÉDICOS
8. **getDoctors** - Listar médicos con especialidades y ubicaciones
9. **createDoctor** - Crear nuevo médico

### 🏥 GESTIÓN DE ESPECIALIDADES
10. **getSpecialties** - Listar especialidades médicas
11. **createSpecialty** - Crear nueva especialidad

### 📍 GESTIÓN DE UBICACIONES
12. **getLocations** - Listar sedes/ubicaciones
13. **createLocation** - Crear nueva sede

### 📊 CONSULTAS ESPECIALES
14. **getDaySummary** - Resumen completo del día con estadísticas
15. **getPatientHistory** - Historial de citas de un paciente
16. **getDoctorSchedule** - Agenda de médico por fecha
17. **executeCustomQuery** - Ejecutar consultas SQL personalizadas (SELECT)

## 🌐 URLS DE ACCESO

### Producción (HTTPS)
- `https://biosanarcall.site/mcp-unified`
- `https://biosanarcall.site/mcp-elevenlabs`
- `https://biosanarcall.site/mcp-health`

### Local (HTTP)
- `http://localhost:8976/mcp-unified`
- `http://localhost:8976/health`
- `http://localhost:8976/test-db`

## 📝 EJEMPLO DE USO

### Listar herramientas disponibles
```bash
curl -X POST "https://biosanarcall.site/mcp-unified" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Buscar pacientes
```bash
curl -X POST "https://biosanarcall.site/mcp-elevenlabs" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"searchPatients","arguments":{"q":"Juan","limit":5}}}'
```

### Resumen del día
```bash
curl -X POST "https://biosanarcall.site/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"getDaySummary","arguments":{}}}'
```

## 🔒 SEGURIDAD
- Todas las consultas SQL están parametrizadas
- Solo se permiten consultas SELECT en executeCustomQuery
- CORS configurado para acceso externo
- Headers de seguridad configurados en Nginx

## ⚡ RENDIMIENTO
- Pool de conexiones MySQL (10 conexiones)
- Gzip habilitado en Nginx
- Cache de archivos estáticos
- Proceso único PM2 con auto-restart

## 🔄 GESTIÓN DE PROCESOS

### Comandos PM2
```bash
pm2 status                    # Ver estado
pm2 restart biosanar-mcp-unified  # Reiniciar
pm2 logs biosanar-mcp-unified     # Ver logs
pm2 monit                     # Monitoreo en tiempo real
```

### Logs
- Error: `/home/ubuntu/app/mcp-server-node/logs/unified-error.log`
- Output: `/home/ubuntu/app/mcp-server-node/logs/unified-out.log`
- Combined: `/home/ubuntu/app/mcp-server-node/logs/unified-combined.log`

## ✨ VENTAJAS DEL SERVIDOR UNIFICADO
1. **Centralización:** Un solo punto de acceso para todas las operaciones MCP
2. **Compatibilidad:** Mantiene endpoints existentes para ElevenLabs y otros clientes
3. **Escalabilidad:** Pool de conexiones y gestión eficiente de recursos
4. **Monitoreo:** Logs centralizados y métricas en tiempo real
5. **Mantenimiento:** Configuración simplificada y actualización centralizada
6. **Rendimiento:** Optimizado para el sistema médico completo

---
**Estado:** ✅ OPERATIVO
**Fecha:** 2025-08-20
**Herramientas:** 17 disponibles
**Base de datos:** biosanar (3 pacientes, 3 médicos, 1 cita)
