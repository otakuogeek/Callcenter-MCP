# Resumen de Configuración — Clúster de Alta Disponibilidad Biosanar

**Fecha:** 2 de marzo de 2026  
**Sistema:** Fundación Biosanar IPS — Plataforma de Gestión Médica  
**URL del Monitor:** https://biosanarcall.site/cluster-monitor/

---

## ¿Qué se hizo?

Se configuró un **sistema de dos servidores** que trabajan en conjunto para que la plataforma de Biosanar nunca se caiga. Si el servidor principal tiene problemas, el segundo servidor toma su lugar automáticamente.

---

## Los dos servidores

| Servidor | Rol | IP | Función |
|---|---|---|---|
| **S1 — Principal** | Maestro | 82.29.62.188 | Atiende las solicitudes de usuarios, almacena los datos principales |
| **S2 — Réplica** | Esclavo | 72.62.164.88 | Copia en tiempo real de S1, listo para tomar el control si S1 falla |

---

## Componentes configurados

### 1. Balanceador de carga (Nginx)
- Distribuye el tráfico de usuarios entre ambos servidores
- Si un servidor no responde, envía todo el tráfico al que sí funciona
- Maneja los certificados de seguridad (HTTPS/SSL)

### 2. Base de datos replicada (MariaDB)
- Toda la información de pacientes, citas y médicos se copia automáticamente de S1 a S2
- La copia ocurre en **tiempo real** (0 segundos de atraso)
- Se configuró protección automática: si hay un error menor de sincronización, el sistema lo salta solo sin detenerse

### 3. Panel de monitoreo
- Accesible en: `https://biosanarcall.site/cluster-monitor/`
- Muestra en tiempo real:
  - Estado de ambos servidores (CPU, memoria)
  - Estado de la base de datos y la replicación
  - Procesos activos de la aplicación
  - Logs del sistema
- Tiene animación SVG interactiva mostrando la topología del clúster
- Protegido con contraseña (inicio de sesión)
- Datos en vivo mediante conexión continua (SSE)

### 4. Aplicación backend (PM2)
- La aplicación corre con PM2, un administrador de procesos que:
  - Reinicia la aplicación automáticamente si se cae
  - Mantiene logs organizados
  - Permite actualizaciones sin tiempo de inactividad

---

## Problemas resueltos durante la configuración

### Replicación de base de datos caída
- **Problema:** La copia de datos de S1 a S2 se detenía por errores de sincronización (Error 1032 — registro no encontrado)
- **Tablas afectadas:** `audit_daily_summary` y `patients`
- **Solución:** Se resincronizaron las tablas completas y se configuró que el sistema salte automáticamente estos errores menores
- **Prevención:** Se activó `slave_skip_errors = 1032,1062` de forma permanente en S2

### Errores de seguridad en el navegador (CSP)
- **Problema:** El panel de monitoreo no cargaba correctamente por políticas de seguridad del navegador
- **Solución:** Se permitieron los recursos necesarios (gráficas Chart.js, fuentes Google Fonts)

### Conexión en tiempo real del monitor (SSE)
- **Problema:** El panel mostraba error 401 (no autorizado) al intentar recibir datos en vivo
- **Solución:** Se adaptó la autenticación para funcionar con conexiones SSE

### Archivos desactualizados en caché
- **Problema:** Los usuarios veían versiones antiguas de la aplicación
- **Solución:** Se configuró que la página principal nunca se guarde en caché del navegador

### Timeouts en operaciones largas
- **Problema:** La sincronización de agendas médicas fallaba por tiempo excedido
- **Solución:** Se aumentó el tiempo límite a 10 minutos para esa operación específica

---

## Estado actual del sistema

| Componente | Estado |
|---|---|
| Servidor S1 (Principal) | **Activo** — CPU ~18%, RAM 39% |
| Servidor S2 (Réplica) | **Activo** — CPU ~0%, RAM 14% |
| Base de datos S1 | **Online** — 24 conexiones activas |
| Base de datos S2 | **Sincronizada** — IO Thread: Sí, SQL Thread: Sí |
| Replicación | **0 segundos de atraso** |
| Balanceador Nginx | **Operativo** |
| Panel de monitoreo | **Funcionando** en /cluster-monitor/ |
| Protección auto-skip | **Activa** (errores 1032 y 1062) |

---

## Recomendaciones

1. **No escribir directamente en S2** — Toda modificación de datos debe hacerse a través de S1 (el maestro). Escribir en S2 causa conflictos de sincronización.

2. **Revisar el monitor periódicamente** — El panel en `/cluster-monitor/` muestra el estado en tiempo real. Si el "Sync Lag" sube por encima de 10 segundos, investigar.

3. **Reiniciar con cuidado** — Si se necesita reiniciar MariaDB en S2, la replicación se reconecta sola. Si queda en "Connecting", ejecutar `FLUSH HOSTS` en S1.

4. **Actualizaciones del backend** — Usar siempre los comandos PM2:
   - Compilar: `cd backend && npm run build`
   - Reiniciar: `pm2 restart cita-central-backend`
   - Ver estado: `pm2 list`

---

*Documento generado el 2 de marzo de 2026*
