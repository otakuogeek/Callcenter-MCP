# 🏥 Biosanarcall Medical System

Sistema integral de gestión médica con IVR, SMS, agendamiento inteligente, historias clínicas y portal de doctores.

[![Producción](https://img.shields.io/badge/Production-Live-brightgreen)](https://biosanarcall.site)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange)](https://www.mysql.com/)

---

## 📋 Descripción

Biosanarcall es una plataforma completa para la gestión de servicios médicos que incluye:

- 📅 **Agendamiento Inteligente**: Gestión de citas con disponibilidad por doctor/especialidad/sede
- 📊 **Cola de Espera**: Sistema de prioridades con notificación automática (optimizado para 785+ pacientes)
- 👥 **Gestión de Pacientes**: Registro completo, normalización automática de datos
- 💬 **Comunicaciones**: SMS masivo con LabsMobile + IVR con ElevenLabs
- 🩺 **Portal de Doctores**: Dashboard dedicado, historias clínicas, dictado por voz con IA
- 📈 **Analytics**: Estadísticas en tiempo real con filtros por especialidad y EPS
- 🤖 **MCP Integration**: 24 herramientas médicas para agentes de IA

---

## 🚀 Inicio Rápido

### 📚 Documentación Principal

**Empieza aquí** → [📖 Índice de Documentación](./INDICE_DOCUMENTACION.md)

**Documentos clave**:
- 🏗️ [Resumen Completo del Proyecto](./RESUMEN_PROYECTO_COMPLETO.md) - Arquitectura, stack, features
- 👤 [Manual de Usuario](./docs/MANUAL_DE_USO.md) - Guía visual con screenshots
- 🔧 [Guía de Mantenimiento](./GUIA_MANTENIMIENTO.md) - Operaciones, backups, troubleshooting

### 🛠️ Instalación y Setup

#### Requisitos Previos
- Node.js 18+
- MySQL 8.0+
- PM2 (para producción)
- Nginx (para servir frontend)

#### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edita .env con tus credenciales

# Inicializar base de datos
npm run db:init
npm run db:seed # Crear usuario admin

# Desarrollo
npm run dev

# Producción
npm run build
pm2 start ecosystem.config.js
```

#### Frontend

```bash
cd frontend
npm install

# Desarrollo
npm run dev # http://localhost:8080

# Producción (build para Nginx)
npm run build # Output: dist/
```

#### MCP Servers

```bash
# Python MCP Server
cd mcp-server-python
pip install -r requirements.txt
python server.py

# Node MCP Server
cd mcp-server-node
npm install
npm start
```

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     Nginx (Frontend)                        │
│              https://biosanarcall.site                      │
│                  (serve from dist/)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Backend API (Express)                         │
│                  Port 4000 (PM2)                            │
│   ┌──────────────────────────────────────────────────┐     │
│   │  Routes: Auth, Patients, Appointments, SMS, ...  │     │
│   └──────────────────────────────────────────────────┘     │
└────────┬──────────────────────┬────────────────────┬────────┘
         │                      │                    │
         ▼                      ▼                    ▼
┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐
│  MySQL 8.0      │   │  LabsMobile API  │   │ ElevenLabs   │
│  (biosanar DB)  │   │  (SMS masivo)    │   │ (IVR/Calls)  │
└─────────────────┘   └──────────────────┘   └──────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              MCP Servers (AI Integration)                   │
│  ┌────────────────────┐    ┌──────────────────────┐        │
│  │  Python MCP :5001  │    │  Node MCP :5002      │        │
│  │  24 medical tools  │    │  Alternative impl.   │        │
│  └────────────────────┘    └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

**Frontend**:
- React 18 + TypeScript + Vite
- shadcn/ui + Radix UI
- TanStack Query + React Router 6
- React Hook Form + Zod

**Backend**:
- Node.js + Express + TypeScript
- MySQL2 con connection pooling
- JWT authentication
- PM2 process manager

**Integraciones**:
- LabsMobile (SMS)
- ElevenLabs (IVR/Voz)
- OpenAI Whisper (Dictado)

---

## ⚙️ Funcionalidades Principales

### 1. 📊 Cola de Espera Optimizada
- **Summary Mode**: Carga inicial solo metadata (90% reducción de payload)
- **Lazy Loading**: Carga pacientes por especialidad al expandir
- **Virtualización**: react-window para renderizar 785+ pacientes sin lag
- Prioridades: Urgente, Alta, Normal, Baja
- Reasignación automática al liberar cupos

### 2. 💬 Sistema SMS Avanzado
- **Envío masivo por lotes**: 50 SMS/batch (evita timeout 504)
- **Filtros**: Por rango de posiciones (1-50) y exclusión de EPS
- Plantillas con variables dinámicas
- Normalización automática a E.164
- Historial completo con logs

### 3. 🩺 Portal de Doctores
- Login separado con JWT
- Dashboard con citas del día
- Historias clínicas modulares
- **Dictado por voz** con Whisper API
- Navegación por fechas

### 4. 📞 IVR con ElevenLabs
- Llamadas automatizadas con voz sintética
- Sincronización cada 1 minuto (PM2 cron)
- Grabación y transcripción
- Estados en tiempo real

### 5. 🗓️ Gestión de Agendas
- Bloques de 15 minutos configurables
- Múltiples fechas en una operación
- Sistema de pausas/reanudación
- Disponibilidad por doctor/especialidad/sede

---

## 📊 Métricas y Performance

### Capacidad
- ✅ 1000+ pacientes registrados
- ✅ 785+ en cola de espera (optimizado)
- ✅ 100+ citas por día
- ✅ 50 SMS por batch

### Performance Frontend
- **Bundle vendor**: 2.36 MB (TanStack Query, React Router, shadcn/ui)
- **Bundle pages**: 233 KB
- **Bundle components**: 625 KB
- **Time to Interactive**: ~3.5s (producción)

### Performance Backend
- **In-memory cache**: 60s TTL para analytics
- **Connection pooling**: 10 conexiones MySQL
- **Rate limiting**: 100 req/15min por IP

---

## 🔐 Seguridad

- ✅ JWT Authentication (Access + Refresh tokens)
- ✅ Separación de roles (Admin/Staff vs Doctores)
- ✅ Rate limiting por IP
- ✅ Helmet.js para headers de seguridad
- ✅ CORS configurado por dominio
- ✅ Validación con Zod en todos los formularios

---

## 📚 Documentación Completa

Toda la documentación está organizada en el **[Índice de Documentación](./INDICE_DOCUMENTACION.md)**:

### Por Categoría
- 🏗️ [Arquitectura y Sistemas](./INDICE_DOCUMENTACION.md#️-arquitectura-y-sistemas)
- 👥 [Gestión de Pacientes y Citas](./INDICE_DOCUMENTACION.md#-gestión-de-pacientes-y-citas)
- 💬 [Comunicaciones (SMS y Llamadas)](./INDICE_DOCUMENTACION.md#-comunicaciones-sms-y-llamadas)
- 🩺 [Portal de Doctores](./INDICE_DOCUMENTACION.md#-portal-de-doctores-e-historias-clínicas)
- 🗓️ [Agendas y Disponibilidad](./INDICE_DOCUMENTACION.md#️-agendas-y-disponibilidad)
- 🛠️ [Mantenimiento](./INDICE_DOCUMENTACION.md#️-mantenimiento-y-operaciones)

### Por Rol
- [👨‍💼 Para Administradores](./INDICE_DOCUMENTACION.md#para-administradores)
- [👨‍💻 Para Desarrolladores](./INDICE_DOCUMENTACION.md#para-desarrolladores)
- [👨‍⚕️ Para Doctores](./INDICE_DOCUMENTACION.md#para-doctores)
- [👥 Para Personal Administrativo](./INDICE_DOCUMENTACION.md#para-personal-administrativo)

---

## 🔧 Comandos Útiles

### Desarrollo

```bash
# Backend dev con hot-reload
cd backend && npm run dev

# Frontend dev (Vite)
cd frontend && npm run dev

# Ver logs PM2
pm2 logs cita-central-backend

# Monitorear procesos
pm2 monit
```

### Producción

```bash
# Build frontend
cd frontend && npm run build

# Build y restart backend
cd backend && npm run build && pm2 restart cita-central-backend

# Backup de BD
mysqldump -u biosanar_user -p biosanar > backup_$(date +%Y%m%d).sql

# Regenerar manual de usuario
cd scripts/manual && bash run_manual_fixed.sh
```

### Testing

```bash
# Suite de tests endpoints
bash test_daily_queue.sh
bash test_sms_service.sh
bash test_cups_endpoints.sh
bash test_filtro_citas_doctor.sh
```

---

## 🌐 Deployment

### Producción Actual
- **URL**: https://biosanarcall.site
- **Frontend**: Nginx sirve desde `/home/ubuntu/app/frontend/dist/`
- **Backend**: PM2 en puerto 4000
- **Database**: MySQL local
- **SSL**: Certbot (Let's Encrypt)

### Proceso de Deploy

1. **Pull últimos cambios**:
   ```bash
   cd /home/ubuntu/app
   git pull origin main
   ```

2. **Build frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   # Nginx ya apunta a dist/
   ```

3. **Build y restart backend**:
   ```bash
   cd backend
   npm install
   npm run build
   pm2 restart cita-central-backend
   ```

4. **Verificar servicios**:
   ```bash
   pm2 list
   sudo systemctl status nginx
   sudo systemctl status mysql
   ```

Ver detalles completos en [Guía de Mantenimiento - Deployment](./GUIA_MANTENIMIENTO.md#-actualización-de-código)

---

## 🤖 MCP Integration

El sistema incluye servidores MCP (Model Context Protocol) para integración con agentes de IA:

- **Python MCP Server**: 24 herramientas médicas
  - Gestión de pacientes
  - Agendamiento de citas
  - Consulta de disponibilidad
  - Estadísticas y reportes
  - Endpoint: `https://biosanarcall.site/mcp-py-simple`

- **Node MCP Server**: Implementación alternativa
  - Endpoint: `https://biosanarcall.site/mcp-node`

Ver documentación completa en `/mcp-server-python/` y `/mcp-server-node/`

---

## 📸 Screenshots

El sistema incluye un **manual de usuario automatizado** con 9 screenshots:

![Dashboard](./docs/manual_screenshots/01_dashboard.png)

Ver todas las capturas en [Manual de Usuario](./docs/MANUAL_DE_USO.md)

### Regenerar Screenshots

```bash
cd scripts/manual
bash run_manual_fixed.sh
# Genera 9 screenshots automáticamente con Playwright
```

---

## 🛠️ Troubleshooting

### Frontend no carga
```bash
cd frontend && npm run build
sudo systemctl restart nginx
```

### Backend no responde
```bash
pm2 logs cita-central-backend
pm2 restart cita-central-backend
```

### BD no conecta
```bash
sudo systemctl status mysql
mysql -u biosanar_user -p biosanar
```

Ver más en [Guía de Mantenimiento - Troubleshooting](./GUIA_MANTENIMIENTO.md#-troubleshooting-común)

---

## 📝 Mantenimiento

### Rutinas Diarias
- ✅ Verificar servicios PM2
- ✅ Revisar logs de errores
- ✅ Verificar espacio en disco

### Rutinas Semanales
- ✅ Limpieza de logs antiguos (>30 días)
- ✅ Archivar llamadas completadas
- ✅ Verificar backups

### Rutinas Mensuales
- ✅ Actualizar dependencias (`npm audit`)
- ✅ Optimizar tablas MySQL
- ✅ Renovar certificados SSL

Ver checklist completo en [Guía de Mantenimiento](./GUIA_MANTENIMIENTO.md#-rutinas-de-mantenimiento)

---

## 🎯 Roadmap

### Corto Plazo
- [ ] Tests unitarios y de integración (Jest)
- [ ] CI/CD con GitHub Actions
- [ ] Logs centralizados (Winston + CloudWatch)

### Mediano Plazo
- [ ] PWA para uso offline
- [ ] Notificaciones push
- [ ] Chat en tiempo real (Socket.io)

### Largo Plazo
- [ ] Mobile app (React Native)
- [ ] Machine Learning para predicción de demanda
- [ ] Multi-tenancy para otras IPS

---

## 📄 Licencia

Copyright © 2025 Fundación Biosanar IPS. Todos los derechos reservados.

---

## 👥 Equipo

**Desarrollo**: Equipo Biosanarcall  
**Repositorio**: Callcenter-MCP  
**Owner**: otakuogeek  
**Branch**: main

---

## 📞 Soporte

Para soporte técnico o preguntas:
- 📖 Consulta el [Índice de Documentación](./INDICE_DOCUMENTACION.md)
- 🔧 Revisa la [Guía de Troubleshooting](./GUIA_MANTENIMIENTO.md#-troubleshooting-común)
- 📊 Verifica los logs: `pm2 logs cita-central-backend`

---

**Sistema en producción**: https://biosanarcall.site  
**Última actualización**: 1 de noviembre de 2025
