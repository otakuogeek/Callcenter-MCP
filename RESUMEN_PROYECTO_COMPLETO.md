# Resumen Completo del Proyecto Biosanarcall Medical System

**Fecha**: 1 de noviembre de 2025  
**Sistema**: Sistema de Gestión Médica con IVR, SMS y Agendamiento  
**Stack**: React + TypeScript + Node.js + Express + MySQL + MCP Integration

---

## 📋 Índice

1. [Arquitectura General](#arquitectura-general)
2. [Funcionalidades Implementadas](#funcionalidades-implementadas)
3. [Integraciones Externas](#integraciones-externas)
4. [Optimizaciones de Rendimiento](#optimizaciones-de-rendimiento)
5. [Seguridad y Autenticación](#seguridad-y-autenticación)
6. [Documentación y Automatización](#documentación-y-automatización)
7. [Deployment y Producción](#deployment-y-producción)

---

## 🏗️ Arquitectura General

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **UI Library**: shadcn/ui + Radix UI
- **Estado**: TanStack Query + React Context
- **Routing**: React Router 6 con lazy loading
- **Forms**: React Hook Form + Zod validation
- **Producción**: Build estático en `/frontend/dist/` servido por Nginx

### Backend
- **Framework**: Node.js + Express + TypeScript
- **Database**: MySQL 8.0 con connection pooling
- **Auth**: JWT con refresh tokens
- **File Uploads**: Multer (multas médicas, documentos)
- **Process Manager**: PM2 con ecosystem.config.js
- **API**: RESTful con respuestas estandarizadas

### MCP Integration
- **Python MCP Server**: 24 herramientas médicas para agentes IA
- **Node.js MCP Server**: Implementación alternativa
- **Protocolo**: JSON-RPC 2.0
- **Endpoints**: `https://biosanarcall.site/mcp-py*`

---

## ⚙️ Funcionalidades Implementadas

### 1. Gestión de Agendas (Availabilities)

**Características**:
- ✅ Creación de bloques de agenda por doctor/especialidad/sede
- ✅ Disponibilidad en múltiples sedes por doctor
- ✅ Soporte para múltiples fechas en una sola operación
- ✅ Sistema de pausas y reanudación de agendas
- ✅ Visualización por doctor, especialidad y sede
- ✅ Slots de 15 minutos configurables
- ✅ Control de cupos disponibles en tiempo real

**Archivos clave**:
- Backend: `/backend/src/routes/availabilities.ts`
- Frontend: `/frontend/src/components/CreateAvailabilityModal.tsx`
- Docs: `/docs/SISTEMA_PAUSAR_REANUDAR_AGENDAS.md`

### 2. Cola de Espera (Waiting List)

**Características**:
- ✅ Sistema de prioridades (Urgente, Alta, Normal, Baja)
- ✅ Organización por especialidad y sede
- ✅ Posición en cola automática (FIFO + prioridad)
- ✅ Notificación automática al liberar cupos
- ✅ Reasignación inteligente de citas canceladas
- ✅ **Optimización de carga**: Summary mode + lazy loading por especialidad
- ✅ **Virtualización**: react-window para 785+ pacientes
- ✅ Interfaz de gestión con acordeón por especialidad

**Performance**:
- Carga inicial: ~90% reducción de payload con summary mode
- Renderizado: Solo ítems visibles con react-window (180px height)
- Lazy load: Por especialidad al expandir acordeón

**Archivos clave**:
- Backend: `/backend/src/routes/appointments.ts` (líneas 811-1400)
- Frontend: `/frontend/src/pages/Queue.tsx`
- Component: `/frontend/src/components/VirtualizedPatientList.tsx`

### 3. Cola Diaria (Daily Queue)

**Características**:
- ✅ Vista de citas confirmadas por día
- ✅ Filtro por especialidad con contadores
- ✅ Estados: Pendiente, En consulta, Atendido, Cancelado
- ✅ Navegación por fechas con tarjetas (hoy, ayer, mañana)
- ✅ Indicadores visuales de estado
- ✅ Acciones rápidas (iniciar consulta, marcar atendido)

**Archivos clave**:
- Backend: `/backend/src/routes/appointments.ts`
- Frontend: `/frontend/src/pages/DailyQueue.tsx`
- Component: `/frontend/src/components/DateNavigationCards.tsx`

### 4. Sistema de Pacientes

**Características**:
- ✅ Módulos especializados (6 componentes de 4-6 campos)
  - `PatientBasicInfo`: Nombre, documento, fecha nacimiento, género
  - `PatientContactInfo`: Teléfono, email, dirección, municipio
  - `PatientMedicalInfo`: Tipo sangre, alergias, condiciones
  - `PatientInsuranceInfo`: EPS, tipo afiliación
  - `PatientDemographicInfo`: Educación, estado civil, ocupación
  - `PatientsList`: Búsqueda y gestión
- ✅ Normalización automática de cédulas (4 pasos)
- ✅ Formateo automático de teléfonos (E.164)
- ✅ Búsqueda con cache (5 segundos TTL)
- ✅ Fulltext search opcional (`ENABLE_FULLTEXT_SEARCH=true`)

**Archivos clave**:
- Backend: `/backend/src/routes/patients.ts`
- Frontend: `/frontend/src/components/Patient*.tsx`
- Docs: `/SISTEMA_FORMATEO_TELEFONOS.md`

### 5. Sistema de SMS

**Características**:
- ✅ **Envío masivo por lotes**: 50 SMS/batch para evitar timeout 504
- ✅ **Rango de posiciones**: Enviar a pacientes entre posición X y Y
- ✅ **Exclusión por EPS**: Filtrar pacientes de EPS específicas
- ✅ Plantillas personalizables con variables dinámicas
- ✅ Historial de envíos con estado (enviado, fallido, pendiente)
- ✅ Integración con LabsMobile API
- ✅ Normalización de teléfonos a E.164
- ✅ Logging completo en tabla `sms_logs`

**Implementación de batches**:
```typescript
const MAX_SMS_PER_BATCH = 50;
// Procesamiento en grupos con await entre batches
```

**Archivos clave**:
- Backend: `/backend/src/routes/sms.routes.ts`
- Service: `/backend/src/services/labsmobile-sms.service.ts`
- Frontend: `/frontend/src/pages/SMS.tsx`
- Component: `/frontend/src/components/BulkSMSModal.tsx`
- Docs: `/ESTADO_FINAL_SMS.md`, `/FILTRO_EPS_SMS.md`, `/RANGO_POSICIONES_SMS.md`

### 6. Sistema de Llamadas (IVR)

**Características**:
- ✅ Integración con ElevenLabs para voz sintética
- ✅ Sincronización automática de llamadas (cada 1 minuto)
- ✅ Estados: Pendiente, En curso, Completada, Fallida
- ✅ Grabación y transcripción de llamadas
- ✅ Respuestas del paciente capturadas
- ✅ Scripts de monitoreo (`backend/scripts/monitor-sync.sh`)

**Archivos clave**:
- Backend: `/backend/src/routes/webhooks.ts`
- Service: `/backend/src/services/elevenLabsSync.ts`
- Docs: `/backend/docs/ELEVENLABS_SYNC_SYSTEM.md`

### 7. Portal de Doctores

**Características**:
- ✅ Login separado con credenciales únicas
- ✅ Dashboard con citas del día
- ✅ Navegación por fechas (hoy, ayer, mañana)
- ✅ Inicio/finalización de consultas
- ✅ Integración con historias clínicas
- ✅ Dictado por voz con IA (Whisper)
- ✅ Gestión de contraseñas

**Archivos clave**:
- Backend: `/backend/src/routes/doctor-auth.ts`
- Frontend: `/frontend/src/pages/DoctorDashboard.tsx`
- Auth: `/frontend/src/hooks/useDoctorAuth.ts`
- Docs: `/DOCTOR_LOGIN_PORTAL.md`, `/backend/GESTION_CONTRASENA_DOCTORES.md`

### 8. Historias Clínicas

**Características**:
- ✅ Estructura modular (antecedentes, examen físico, diagnóstico, plan)
- ✅ Dictado por voz con Whisper API
- ✅ Plantillas por especialidad
- ✅ Historial de consultas por paciente
- ✅ Metadata de consulta (doctor, fecha, hora)

**Archivos clave**:
- Backend: `/backend/src/routes/medical-records.ts`
- Frontend: `/frontend/src/pages/Consultations.tsx`
- Component: `/frontend/src/components/VoiceDictationButton.tsx`
- Docs: `/docs/SISTEMA_HISTORIAS_CLINICAS.md`, `/docs/SISTEMA_DICTADO_VOZ_IA.md`

### 9. Análisis y Estadísticas

**Características**:
- ✅ Dashboard con KPIs principales
- ✅ **Filtros por especialidad + EPS**: Estadísticas granulares
- ✅ In-memory cache (60 segundos TTL)
- ✅ Métricas:
  - Total pacientes
  - Citas programadas
  - Citas del día
  - Pacientes en espera
  - Distribución por especialidad
  - Distribución por EPS
- ✅ Gráficos interactivos

**Archivos clave**:
- Backend: `/backend/src/routes/analytics.ts`
- Frontend: `/frontend/src/pages/Analytics.tsx`

### 10. Gestión de Ubicaciones

**Características**:
- ✅ CRUD de sedes/ubicaciones
- ✅ Asociación con doctores y especialidades
- ✅ Configuración de capacidad
- ✅ Estado activo/inactivo

**Archivos clave**:
- Backend: `/backend/src/routes/locations.ts`
- Frontend: `/frontend/src/pages/Locations.tsx`

---

## 🔌 Integraciones Externas

### LabsMobile (SMS)
- **Servicio**: Envío masivo de SMS
- **API**: RESTful con autenticación por token
- **Rate limiting**: 50 SMS por batch
- **Archivo**: `/backend/src/services/labsmobile-sms.service.ts`

### ElevenLabs (IVR/Voz)
- **Servicio**: Llamadas con voz sintética
- **Sincronización**: Cada 1 minuto vía script PM2
- **Webhooks**: Para actualización de estados
- **Archivo**: `/backend/src/services/elevenLabsSync.ts`

### OpenAI Whisper (Transcripción)
- **Servicio**: Dictado por voz en historias clínicas
- **Formato**: Multipart form-data (audio file)
- **Archivo**: `/backend/src/routes/transcription.ts`

---

## 🚀 Optimizaciones de Rendimiento

### Frontend

#### 1. Lazy Loading de Rutas
```typescript
// App.tsx - Todas las rutas con React.lazy
const Queue = lazy(() => import("./pages/Queue"));
const DailyQueue = lazy(() => import("./pages/DailyQueue"));
// ... etc
```

#### 2. Code Splitting (Vite)
```javascript
// vite.config.ts
manualChunks: {
  'vendor': ['react', 'react-dom', 'react-router-dom'],
  'pages': ['./src/pages/*'],
  'components': ['./src/components/*']
}
// Resultado:
// - vendor.js: ~2.36 MB
// - pages.js: ~233 KB
// - components.js: ~625 KB
```

#### 3. Virtualización (react-window)
```typescript
// VirtualizedPatientList.tsx
<List
  height={maxHeight}
  itemCount={patients.length}
  itemSize={180}
  rowComponent={Row}
  rowProps={{ patients, handlers }} // ¡CRÍTICO: props via rowProps!
/>
```

#### 4. Summary Mode + Lazy Load
```typescript
// Queue.tsx - Carga inicial solo metadata
const response = await api.getWaitingList(true); // summary=true

// Lazy load al expandir especialidad
const handleAccordionChange = async (values: string[]) => {
  const newlyOpened = values.filter(v => !expandedSpecialties.includes(v));
  for (const val of newlyOpened) {
    const resp = await api.getWaitingListBySpecialty(specialtyId);
    // ...
  }
};
```

### Backend

#### 1. In-Memory Cache
```typescript
// analytics.ts
const ANALYTICS_TTL_MS = 60_000;
const analyticsCache = new Map<string, { ts: number; data: any }>();
```

#### 2. Connection Pooling
```typescript
// db/index.ts
const pool = mysql.createPool({
  connectionLimit: 10,
  // ...
});
```

#### 3. Batching de SMS
```typescript
// sms.routes.ts
const MAX_SMS_PER_BATCH = 50;
for (let i = 0; i < filteredPatients.length; i += MAX_SMS_PER_BATCH) {
  const batch = filteredPatients.slice(i, i + MAX_SMS_PER_BATCH);
  await Promise.all(batch.map(p => sendSMS(p)));
}
```

---

## 🔐 Seguridad y Autenticación

### JWT Authentication
- **Tokens**: Access token (4h) + Refresh token (7d)
- **Storage**: LocalStorage (frontend)
- **Middleware**: `authenticateToken` en todas las rutas protegidas
- **Archivo**: `/backend/src/routes/auth.ts`

### Separación de Roles
- **Admin/Staff**: Login principal (`/login`)
- **Doctores**: Portal separado (`/doctor-login`)
- **Middleware**: `authenticateDoctorToken` para rutas de doctores

### Rate Limiting
```typescript
// Backend - 100 requests por 15 minutos por IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

### Helmet.js
```typescript
// Backend - Headers de seguridad
app.use(helmet());
```

### CORS
```typescript
// Backend - Solo dominios autorizados
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:8080'
}));
```

---

## 📚 Documentación y Automatización

### Manual de Usuario Automatizado

**Sistema**: Playwright automation para generar screenshots + manual

**Componentes**:
1. **generate_manual.js**: Script Playwright que:
   - Abre navegador headless (Chromium)
   - Login automático con credenciales demo
   - Navega a 9 secciones del sistema
   - Captura screenshots full-page
   - Guarda en `/docs/manual_screenshots/`

2. **run_manual_fixed.sh**: Orquestación:
   - Verifica que frontend esté disponible (curl https://biosanarcall.site)
   - Instala Playwright si no existe
   - Ejecuta generate_manual.js
   - Reporta resultados

3. **check_frontend.sh**: Pre-flight check:
   - curl -k para https
   - Timeout de 10s
   - Mensajes contextuales (producción vs dev)

4. **MANUAL_DE_USO.md**: Documento final con:
   - 9 secciones detalladas
   - Referencias a screenshots
   - Descripciones de funcionalidades
   - Workflows de usuario

**Configuración**:
- **Producción (default)**: `https://biosanarcall.site`
- **Dev (override)**: `BASE_URL=http://localhost:8080 bash run_manual_fixed.sh`

**Regenerar manual**:
```bash
cd /home/ubuntu/app/scripts/manual
bash run_manual_fixed.sh
```

**Archivos**:
- Scripts: `/scripts/manual/`
- Manual: `/docs/MANUAL_DE_USO.md`
- Screenshots: `/docs/manual_screenshots/` (9 imágenes, ~4.5 MB total)

### Otros Documentos
- `/SISTEMA_SMS_RESUMEN.md`: Resumen del sistema SMS
- `/SISTEMA_LLAMADAS_BD_RESUMEN.md`: Sistema de llamadas
- `/docs/SISTEMA_HISTORIAS_CLINICAS.md`: Historias clínicas
- `/docs/SISTEMA_PAUSAR_REANUDAR_AGENDAS.md`: Pausas de agenda
- `/backend/docs/ELEVENLABS_SYNC_SYSTEM.md`: Sincronización ElevenLabs
- `/DOCTOR_LOGIN_PORTAL.md`: Portal de doctores

---

## 🌐 Deployment y Producción

### Configuración Nginx
```nginx
# Frontend (static files)
location / {
  root /home/ubuntu/app/frontend/dist;
  try_files $uri $uri/ /index.html;
}

# Backend API
location /api {
  proxy_pass http://127.0.0.1:4000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}

# MCP Servers
location /mcp-py-simple {
  proxy_pass http://127.0.0.1:5001;
}
```

### PM2 Ecosystem

**Backend** (`/backend/ecosystem.config.js`):
```javascript
{
  name: 'cita-central-backend',
  script: 'dist/src/server.js',
  env: { NODE_ENV: 'production', PORT: 4000 },
  max_memory_restart: '300M',
  instances: 1,
  autorestart: true
}
```

**MCP Server** (`/mcp-server-python/ecosystem.config.js`):
```javascript
{
  name: 'mcp-server-python',
  script: 'server.py',
  interpreter: 'python3',
  env: { PORT: 5001 }
}
```

### Build Process

**Frontend**:
```bash
cd frontend
npm run build
# Output: dist/ (~5 MB)
# Sync to Nginx root
```

**Backend**:
```bash
cd backend
npm run build
# Output: dist/
pm2 restart cita-central-backend
```

### Variables de Entorno Críticas

**Backend** (`.env`):
```env
# Database
DB_HOST=127.0.0.1
DB_USER=biosanar_user
DB_PASSWORD=your_password
DB_NAME=biosanar

# Auth
JWT_SECRET=your_jwt_secret

# CORS
CORS_ORIGINS=https://biosanarcall.site,https://www.biosanarcall.site

# Features
ENABLE_FULLTEXT_SEARCH=true
CALL_ARCHIVE_DAYS=30
PATIENT_SEARCH_CACHE_TTL_MS=5000

# External APIs
LABSMOBILE_API_KEY=your_key
LABSMOBILE_API_SECRET=your_secret
ELEVENLABS_API_KEY=your_key
OPENAI_API_KEY=your_key
```

**MCP Servers**:
```env
BACKEND_BASE=http://127.0.0.1:4000/api
BACKEND_TOKEN=your_jwt_token
```

### Comandos PM2

```bash
# Backend
pm2 start ecosystem.config.js
pm2 restart cita-central-backend
pm2 logs cita-central-backend
pm2 monit

# Sincronización ElevenLabs
pm2 start backend/scripts/monitor-sync.sh --name elevenlabs-sync

# Ver todos los procesos
pm2 list
```

---

## 📊 Métricas del Proyecto

### Código
- **Frontend**: ~35 componentes, ~15 páginas
- **Backend**: ~20 rutas, ~10 servicios
- **Base de datos**: ~25 tablas
- **Migraciones**: ~15 archivos SQL

### Performance
- **Carga inicial frontend**: ~2.5s (producción)
- **Bundle vendor**: 2.36 MB
- **Bundle pages**: 233 KB
- **Bundle components**: 625 KB
- **Time to Interactive**: ~3.5s

### Capacidad
- **Pacientes**: 1000+ registros
- **Cola de espera**: 785+ pacientes (optimizado con virtualización)
- **Citas por día**: 100+ (promedio)
- **SMS por batch**: 50 (límite configurado)

---

## 🎯 Logros Técnicos Destacados

1. **Optimización de Cola de Espera**: Summary mode + lazy loading + virtualización → 90% reducción de payload inicial

2. **Sistema SMS Robusto**: Batching + normalización + filtros avanzados → Sin timeouts 504

3. **Manual Automatizado**: Playwright end-to-end → Documentación siempre actualizada

4. **Sincronización ElevenLabs**: PM2 cron job + webhooks → Estado en tiempo real

5. **Portal Dual**: Separación completa admin/doctor → Seguridad y UX mejoradas

6. **Dictado por Voz IA**: Whisper integration → Productividad médica incrementada

7. **Code Splitting Inteligente**: 3 chunks estratégicos → Mejor caching y TTI

8. **MCP Integration**: 24 herramientas médicas → AI-ready backend

---

## 🔄 Próximos Pasos Sugeridos

### Corto Plazo
- [ ] Tests unitarios y de integración (Jest + React Testing Library)
- [ ] CI/CD con GitHub Actions
- [ ] Logs centralizados (Winston + CloudWatch)
- [ ] Monitoreo APM (New Relic o Datadog)

### Mediano Plazo
- [ ] PWA (Progressive Web App) para uso offline
- [ ] Notificaciones push
- [ ] Chat en tiempo real (Socket.io)
- [ ] Exportación de reportes (Excel, PDF)

### Largo Plazo
- [ ] Mobile app (React Native)
- [ ] Integración con HIS (Health Information System)
- [ ] Machine Learning para predicción de demanda
- [ ] Multi-tenancy para otras IPS

---

## 📝 Notas Finales

Este proyecto representa un sistema completo de gestión médica con características empresariales:

- **Escalabilidad**: Arquitectura modular preparada para crecimiento
- **Performance**: Optimizaciones en todos los niveles (frontend, backend, DB)
- **Seguridad**: JWT, rate limiting, CORS, Helmet
- **Integraciones**: APIs externas robustas (SMS, IVR, IA)
- **Documentación**: Automatizada y mantenible
- **Producción**: Deploy exitoso con PM2 + Nginx

El sistema está en producción en `https://biosanarcall.site` y operativo para uso real en entornos médicos.

---

**Repositorio**: Callcenter-MCP  
**Owner**: otakuogeek  
**Branch**: main  
**Última actualización**: 1 de noviembre de 2025
