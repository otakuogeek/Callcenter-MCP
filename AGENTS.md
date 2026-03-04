# AGENTS.md — Biosanarcall Medical System

> Guía maestra para agentes de IA (Codex, Copilot, Claude, etc.) que operan sobre este repositorio.  
> Última actualización: 2026-03-03

---

## Tabla de Contenidos

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Arquitectura de Alto Nivel](#2-arquitectura-de-alto-nivel)
3. [Backend — API Central](#3-backend--api-central)
4. [Frontend — Panel Administrativo](#4-frontend--panel-administrativo)
5. [MCP Server Node — Herramientas para Agentes IA](#5-mcp-server-node--herramientas-para-agentes-ia)
6. [Voice Call Service — Llamadas con IA](#6-voice-call-service--llamadas-con-ia)
7. [Aplicación Móvil — Portal del Paciente](#7-aplicación-móvil--portal-del-paciente)
8. [Cluster Monitor — Infraestructura](#8-cluster-monitor--infraestructura)
9. [Voice Web Interface — Dashboard de Voz](#9-voice-web-interface--dashboard-de-voz)
10. [Scripts de Utilidad](#10-scripts-de-utilidad)
11. [Base de Datos — Esquema y Convenciones](#11-base-de-datos--esquema-y-convenciones)
12. [Flujos de Negocio Críticos](#12-flujos-de-negocio-críticos)
13. [Guía de Desarrollo](#13-guía-de-desarrollo)
14. [Despliegue y Producción](#14-despliegue-y-producción)
15. [Convenciones y Reglas para Agentes](#15-convenciones-y-reglas-para-agentes)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Visión General del Sistema

**Biosanarcall** es un sistema integral de gestión médica para **Fundación Biosanar IPS** (Colombia). Abarca la totalidad del ciclo de atención al paciente: desde el agendamiento de citas por múltiples canales (web, móvil, teléfono, WhatsApp, agentes IA) hasta el seguimiento clínico, facturación, auditoría y firma digital de documentos.

### Componentes del Ecosistema

| Componente | Stack | Puerto | Propósito |
|------------|-------|--------|-----------|
| **Backend API** | Express + TypeScript + MySQL2 | 4000 | API REST central, lógica de negocio, auth, SMS, WhatsApp, ElevenLabs |
| **Frontend Admin** | React 18 + Vite + shadcn/ui | 8080 | Panel administrativo completo (35+ páginas) |
| **MCP Server Node** | Express + TypeScript + MySQL2 | 8977 | 58 herramientas MCP (JSON-RPC 2.0) para agentes IA |
| **Voice Call Service** | Express + TypeScript + Zadarma + ElevenLabs | 3001 | Llamadas telefónicas automatizadas con IA |
| **Mobile App** | Expo 54 + React Native + React 19 | N/A | Portal del paciente (Android APK) |
| **Cluster Monitor** | Express + Node.js + SSH | 5055 | Monitoreo de infraestructura 2 servidores |
| **Voice Web Interface** | HTML + Alpine.js + TailwindCSS | estático | Dashboard de monitoreo de llamadas de voz |

### Dominio de Negocio

- **IPS colombiana** con múltiples sedes y especialidades médicas
- **EPS** (Entidades Promotoras de Salud) con autorizaciones por especialidad/sede
- **Códigos CUPS** (Clasificación Única de Procedimientos en Salud)
- **Zonas geográficas**: San Gil, Socorro, y municipios aledaños (Santander, Colombia)
- **Regulación**: Normativa de salud colombiana

---

## 2. Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTES / CANALES                          │
├───────────┬──────────┬──────────┬──────────┬──────────┤
│  Frontend │  Mobile  │ WhatsApp │ Teléfono │ Agentes  │
│  (React)  │  (Expo)  │ (Baileys)│(Zadarma) │ IA (MCP) │
│   :8080   │   APK    │  Bot IA  │  :3001   │  :8977   │
└─────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
      │          │          │          │          │
      ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND API (Express :4000)                     │
│  57 archivos de rutas · 35+ servicios · JWT Auth · Auditoría       │
│  SMS (LabsMobile) · WhatsApp (Baileys+LangGraph) · ElevenLabs      │
│  SSE (colas, transferencias) · Caché en memoria · Rate limiting    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                    MySQL 8.0 (MariaDB en prod)                      │
│  Master (82.29.62.188) ←──replicación──→ Slave (72.62.164.88)      │
│  52+ tablas core · 50+ migraciones · Connection pool (25)           │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                    INFRAESTRUCTURA                                   │
│  Nginx (LB + static) · PM2 (procesos) · Redis (caché/colas)        │
│  NFS (archivos compartidos) · SSL/HTTPS · Cluster Monitor :5055     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend — API Central

**Ubicación**: `/backend/`  
**Tecnología**: Express 4 + TypeScript, compilado con esbuild  
**Entrada**: `src/server.ts` → `dist/src/server.js` (producción)

### 3.1 Configuración del Servidor

| Aspecto | Configuración |
|---------|---------------|
| **Puerto** | 4000 (env `PORT`) |
| **Seguridad** | Helmet, CORS restringido (`CORS_ORIGINS`), trust proxy |
| **Rate Limiting** | 50,000 req/15min general; 20 req/15min para login |
| **Compresión** | Habilitada (excepto SSE streams) |
| **Logging** | Pino + pino-http (JSON en prod, pretty en dev) |
| **Body Parsing** | `express.raw` para webhooks, `express.json` para el resto |
| **Sanitización** | Middleware XSS global en body/query/params |
| **JWT** | Mínimo 16 chars en `JWT_SECRET` o el servidor no arranca |
| **Auto-limpieza** | Cada 6h marca disponibilidades pasadas como "Completa" |
| **Graceful Shutdown** | SIGTERM/SIGINT cierra OutboundCallManager |

### 3.2 Endpoints de API (57 archivos de rutas)

#### Autenticación y Sesiones

| Ruta | Método | Endpoint | Descripción |
|------|--------|----------|-------------|
| `/api/auth` | POST | `/login` | Login JWT (8h), rate-limited, auditoría |
| `/api/users` | CRUD | `/` | Usuarios del sistema (6 roles) |
| `/api/doctor-auth` | POST/GET | `/login`, `/logout`, `/me`, `/change-password`, `/appointments`, `/stats` | Auth independiente para doctores |
| `/api/doctor-management` | GET/POST/DELETE | `/`, `/:id/set-password`, `/:id/sessions` | Admin de credenciales de doctores |
| `/api/sessions` | GET/DELETE | `/my-sessions`, `/active`, `/user/:userId` | Gestión de sesiones activas |

**Roles del sistema**: `superadmin`, `admin`, `supervisor`, `agent`, `doctor`, `reception`

#### Pacientes (3 versiones coexistentes)

| Versión | Ruta | Líneas | Características |
|---------|------|--------|-----------------|
| **v1** | `/api/patients` | 662 | CRUD básico, búsqueda, import/export CSV |
| **v2** | `/api/patients-v2` | 3500+ | Rutas públicas (OTP, auto-agendamiento), registro avanzado |
| **Enhanced** | `/api/patients-enhanced` | — | Búsqueda avanzada, detección de duplicados, stats |

**Rutas públicas (sin auth)** en v2:
- `POST /public/register` — Auto-registro
- `POST /public/auth/request-otp` / `verify-otp` — Autenticación OTP por SMS
- `POST /public/schedule-appointment` — Auto-agendamiento
- `GET /public/available-schedules/:specialtyId/:epsId` — Consulta disponibilidad
- `PUT /public/appointments/:id/cancel` / `reschedule` — Auto-gestión de citas

#### Agendamiento y Disponibilidad

| Ruta | Líneas | Endpoints Clave |
|------|--------|-----------------|
| `/api/appointments` | 2648 | CRUD, historial, summary, conflictos, waiting-list (por especialidad, por paciente), daily-queue, reasignación, estadísticas |
| `/api/availabilities` | 3338 | CRUD, batch, holidays, distribución, smart-options, calendario, pausa, redistribute, público por especialidad |
| `/api/agenda-templates` | — | Plantillas de agenda reutilizables |
| `/api/agenda-optimization` | — | Optimización automática de agenda |
| `/api/agenda-conflicts` | — | Detección y resolución de conflictos |
| `/api/auto-assignment` | — | `smart-assign`, `auto-assign`, `suggestions` |
| `/api/daily-queue` | — | Cola diaria con asignación, stats, process-queue |
| `/api/orders` | — | Vista de citas como órdenes médicas |

#### Catálogos y Datos Maestros

| Ruta | Recursos |
|------|----------|
| `/api/specialties` | Especialidades médicas + usage |
| `/api/services` | Servicios médicos |
| `/api/locations` | Sedes + métricas + capacidad diaria + especialidades por sede |
| `/api/doctors` | Médicos + especialidades + ubicaciones + contraseñas |
| `/api/eps` | Entidades Promotoras de Salud + transferencia de pacientes + stats |
| `/api/eps-authorizations` | Autorizaciones EPS/Especialidad/Sede + batch + auditoría |
| `/api/cups` | Códigos CUPS colombianos + categorías + stats |
| `/api/zones` | Zonas geográficas |
| `/api/municipalities` | Municipios |
| `/api/location-types` | Tipos de sede |
| `/api/timezones` | 22 zonas horarias |
| `/api/lookups` | Tipos documento, grupos sanguíneos, educación, estado civil, poblaciones, discapacidades |
| `/api/settings` | Configuración del sistema (org_name, org_nit, org_logo_url, timezone) |

#### Comunicaciones

| Ruta | Líneas | Canales |
|------|--------|---------|
| `/api/sms` | 1500+ | SMS via LabsMobile: individual, bulk, confirmaciones, recordatorios, cancelaciones, historial, stats, normalización |
| `/api/whatsapp` | 1700+ | WhatsApp via Baileys: QR, mensajes, conversaciones, TTS, transcripción, chat IA (LangGraph/DeepSeek), analytics, métricas |
| `/api/notifications` | — | CRUD notificaciones + alertas médicas + preferencias + webhook |

#### Llamadas e IA de Voz

| Ruta | Descripción |
|------|-------------|
| `/api/calls` | Monitor en tiempo real: activas, en espera, historial, stats, dashboard, transferencias |
| `/api/call-logs` | Registro de llamadas (CRUD) |
| `/api/call-statuses` | Estados de llamadas (CRUD) |
| `/api/elevenlabs` | Agentes ElevenLabs, iniciar llamada, conversaciones, stats |
| `/api/consultations` | Sincronización de consultas telefónicas ElevenLabs |
| `/api/outbound` | Campañas outbound: llamadas bulk, recordatorios automáticos, reportes |
| `/api/voice-agent` | Procesamiento de voz, llamadas MCP |
| `/api/webhooks` | Webhooks ElevenLabs (call-started, call-ended, stats, logs) |
| `/api/transcription` | Transcripción de audio (Whisper/OpenAI) |

#### Analítica, Auditoría y Reportes

| Ruta | Descripción |
|------|-------------|
| `/api/analytics` | Overview con caché 60s |
| `/api/metrics` | KPIs, daily, specialty/location performance, trends, system-health |
| `/api/export` | Exportar pacientes/llamadas, reportes diarios/agente/engagement |
| `/api/search` | Búsqueda global + autocomplete |
| `/api/audit` | Logs de auditoría, stats, summary, cambios de campos, usuarios online, logout masivo |

#### Otros Módulos

| Ruta | Descripción |
|------|-------------|
| `/api/queue` | Cola de espera con SSE streaming, overview, agrupada |
| `/api/transfers` | Transferencias IA→humano con SSE, accept/reject/complete |
| `/api/documents` | Upload/download documentos de pacientes |
| `/api/appointment-billing` | Facturación de citas |
| `/api/pregnancies` | Seguimiento de embarazos + controles prenatales |
| `/api/medical-records` | Historias clínicas (auth doctor independiente) |
| `/api/wiki` | Documentación/wiki interna |
| `/api/support` | Tickets de soporte con mensajes y adjuntos |
| `/api/public` | Municipios y estado de mantenimiento (sin auth) |

### 3.3 Middleware

| Middleware | Función |
|------------|---------|
| `requireAuth` | Valida JWT de header `Authorization` o query `?token=`. Cache 5min |
| `requireRole(roles[])` | Control de acceso por rol |
| `asyncHandler` | Wrapper try/catch para rutas async |
| `errorHandler` | Mapea ApiError, ZodError, JWT errors, DB errors a respuestas estándar |
| `validateBody/Params/Query` | Validación con Zod |
| `sanitizeInput` | Limpia XSS en body/query/params |
| `loginLimiter` | 20 req/15min para login |
| `auditMiddleware` | Auditoría automática por HTTP method, entity detection desde URL |

### 3.4 Servicios Internos (35+)

| Servicio | Propósito |
|----------|-----------|
| `auditService` | Auditoría inmutable con sanitización de datos sensibles |
| `callManagerService` | Gestión de llamadas en tiempo real |
| `OutboundCallManager` | Campañas de llamadas salientes (Redis + ElevenLabs) |
| `elevenLabsService` | Integración ElevenLabs TTS/llamadas IA |
| `labsmobile-sms.service` | SMS via LabsMobile |
| `notificationService` | Sistema de notificaciones |
| `mailer` | Email con nodemailer |
| `documentService` | Gestión de documentos |
| `sessionService` | Sesiones de usuario |
| `metricsService` | Métricas del sistema |
| `WhatsApp*` (13 servicios) | Bot completo: Baileys, IA con LangGraph/DeepSeek, memoria semántica, personalidad, chunking, TTS, transcripción |
| `LangGraphAgent` | Agente IA con LangGraph |
| `MCPClient` / `MCPToolsClient` | Clientes MCP para herramientas de IA |

### 3.5 Eventos en Tiempo Real

- **SSE (Server-Sent Events)**: Canales `queue` y `transfers`
- **Heartbeat automático** para mantener conexiones abiertas
- **Token via query param** (`?token=`) para SSE (no soporta headers)

### 3.6 Formato de Respuesta Estándar

```typescript
// Éxito
{ success: true, data: T, message?: string }

// Error
{ success: false, error: string, details?: any }
```

---

## 4. Frontend — Panel Administrativo

**Ubicación**: `/frontend/`  
**Tecnología**: React 18 + TypeScript + Vite 5 (SWC) + shadcn/ui  
**Puerto**: 8080 (dev y preview)

### 4.1 Arquitectura

| Capa | Tecnología | Detalle |
|------|-----------|---------|
| **UI** | shadcn/ui (57 componentes) + Radix UI (22 paquetes) + Tailwind CSS | Nunca escribir UI custom desde cero |
| **Routing** | React Router 6 (con flags v7) | `React.lazy + Suspense` en todas las páginas |
| **Estado Servidor** | TanStack Query 5 | staleTime: 30s, retry: 1, no refetch on focus |
| **Formularios** | React Hook Form 7 + Zod | Patrón estándar en todo el sistema |
| **Auth Admin** | localStorage via `authStorage.ts` | Token JWT + datos de usuario |
| **Auth Doctor** | Hook `useDoctorAuth` | Token JWT separado |
| **Sesión** | `useSessionManager` | Auto-logout por inactividad (5 min), heartbeat (1 min) |
| **Build** | Vite + Terser | Manual chunks: vendor, pages, components |

### 4.2 Mapa de Rutas (35+ páginas)

#### Rutas Públicas
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | `UserPortalWrapper` | Portal público del paciente (4808 líneas) — agendamiento, consulta de citas, verificación con cédula |
| `/admin/login` | `Login` | Login administrativo |
| `/doctor-login` | `DoctorLogin` | Login de doctores |
| `/verificar/:appointmentId` | `VerifyAppointment` | Verificación pública de cita por QR |
| `/support-panel-login` | `SupportPanelLogin` | Login panel de soporte independiente |
| `/support-panel` | `SupportPanel` | Panel de soporte independiente |

#### Rutas Protegidas (Admin — `ProtectedRoute`)
| Ruta | Página | Líneas | Función Principal |
|------|--------|--------|-------------------|
| `/admin` | `Index` (Dashboard) | 352 | Dashboard principal con KPIs |
| `/admin/patients` | `PatientsModernPage` | — | Gestión moderna de pacientes |
| `/admin/patients/new` | `NewPatientPage` | — | Registro de nuevo paciente |
| `/admin/appointments` | `Appointments` | — | Gestión de citas |
| `/admin/daily-schedule` | `DailySchedule` | — | Agenda diaria |
| `/admin/agenda-management` | `AgendaManagement` | — | Gestión avanzada de agendas |
| `/admin/distribution` | `DistributionDashboard` | 169 | Distribución de disponibilidad |
| `/admin/queue` | `Queue` | 1013 | Cola de espera (summary mode + react-window) |
| `/admin/daily-queue` | `DailyQueue` | 599 | Cola diaria con auto-reasignación |
| `/admin/calls` | `Calls` | 132 | Historial de llamadas |
| `/admin/calls/monitor` | `CallsPage` | 64 | Monitor ElevenLabs |
| `/admin/callcenter` | `CallCenter` | 107 | Centro de contacto |
| `/admin/consultations` | `Consultations` | 710 | Consultas telefónicas |
| `/admin/agents` | `Agents` | 283 | Transferencias IA → agentes |
| `/admin/locations` | `Locations` | 1379 | Sedes + métricas + capacidad |
| `/admin/analytics` | `Analytics` | — | Analíticas avanzadas |
| `/admin/billing` | `Billing` | — | Facturación |
| `/admin/orders` | `Orders` | 629 | Órdenes médicas |
| `/admin/sms` | `SMS` | 980 | Envío masivo de SMS |
| `/admin/whatsapp` | `WhatsAppDashboard` | 845 | Dashboard WhatsApp + QR |
| `/admin/settings` | `Settings` | 69 | Config: General, Users, Notifications, AI |
| `/admin/audit` | `AuditPage` | 840 | Logs de auditoría |
| `/admin/wiki` | `Wiki` | 368 | Wiki interna (Markdown) |
| `/admin/support` | `Support` | 748 | Sistema de tickets |
| `/admin/support-admin` | `SupportAdmin` | 471 | Admin de soporte |
| `/admin/my-appointments` | `MyAppointments` | 428 | Mis citas (solo lectura) |

#### Ruta Protegida (Doctor — `DoctorProtectedRoute`)
| Ruta | Página | Líneas | Función |
|------|--------|--------|---------|
| `/doctor-dashboard` | `DoctorDashboard` | 2639 | Panel completo del doctor: citas, historial, registros médicos |

### 4.3 Componentes Principales (no shadcn/ui)

#### Gestión de Pacientes (modular, 6 sub-componentes)
- `PatientBasicInfo` (378 líneas) — Nombre, documento, fecha nacimiento, género
- `PatientContactInfo` (304) — Teléfono, email, dirección, municipio
- `PatientMedicalInfo` (287) — Sangre, alergias, condiciones
- `PatientInsuranceInfo` (296) — EPS, tipo afiliación
- `PatientDemographicInfo` (313) — Educación, estado civil, ocupación
- `PatientsList` (674) — Búsqueda y gestión

#### Vista Moderna de Pacientes
- `PatientsModernView` (893) — Vista principal 
- `PatientFormModal` (1075) — Formulario completo
- `PatientDetailModal` (663) — Detalle con historial
- `PregnancyManagement` (406) — Gestión de embarazos
- `DuplicatesView` (370) — Detección de duplicados

#### Agendamiento y Disponibilidad
- `ViewAvailabilityModal` (1406) — Modal de disponibilidad con detalle y reasignación
- `AvailabilityList` (1046) — Listado con filtros avanzados
- `AppointmentManagement` (940) — Gestión completa
- `SmartAppointmentModal` (732) — Agendamiento inteligente
- `ManualAppointmentModal` (667) — Agendamiento manual
- `CreateAppointmentModal` (656) — Crear cita
- `ReassignAppointmentModal` (701) — Reasignación
- `QuickAppointmentModal` (538) — Agendamiento rápido
- `AISchedulingModal` (510) — Agendamiento con IA
- `AutoAppointmentAssignment` (625) — Asignación automática

#### Cola y Optimización
- `QueueStatistics` (830) — Estadísticas detalladas de cola
- `DailyQueueManager` (743) — Gestión de cola diaria
- `VirtualizedPatientList` (354) — Lista con react-window (virtualización)
- `AgendaOptimizationDashboard` (827) — Optimización de agendas
- `AgendaConflictManager` (766) — Conflictos de agenda

### 4.4 API Client (`/frontend/src/lib/api.ts` — 1740 líneas, ~150+ métodos)

Función `request<T>()` genérica con fetch, manejo automático de JWT (verificación, expiración, redirect a login). Secciones:

- **Auth**: login
- **Patients** (v1, v2, enhanced): CRUD, búsqueda, import/export, stats
- **Lookups**: todos los catálogos
- **Doctors**: CRUD + especialidades/ubicaciones/contraseñas
- **Specialties/Locations/EPS/CUPS/Zones**: CRUD completo
- **Availabilities**: CRUD + batch + distribución + pausa + redistribución + sync
- **Appointments**: CRUD + filtros + summary + conflictos + reasignación + analytics
- **Waiting List**: summary, por especialidad, eliminar, asignar, disponibles
- **Queue**: overview, grouped, enqueue, assign, next, schedule
- **Users/Settings/Analytics/Metrics**: CRUD y consultas
- **Notifications/Documents/Audit/Sessions**: gestión completa
- **Transfers/Templates/ElevenLabs/Pregnancy**: operaciones especializadas
- **SMS/Distributions/Daily Queue**: envío y gestión

### 4.5 Optimización de Performance (Cola de Espera)

La página `/admin/queue` implementa **optimización de tres niveles** para 785+ pacientes:

1. **Summary Mode**: `GET /api/appointments/waiting-list?summary=true` — Solo metadata, sin arrays de pacientes (~90% reducción de payload)
2. **Lazy Loading por Especialidad**: `GET /api/appointments/waiting-list/specialty/:id` — Carga pacientes solo al expandir el acordeón
3. **Virtualización**: `react-window` con `VirtualizedPatientList` — Solo renderiza items visibles

**IMPORTANTE**: Props DEBEN pasarse via objeto `rowProps`, NO closures:
```typescript
// ✅ CORRECTO
const rowProps = { patients, handleChangePriority, handleCallPatient };
<List rowProps={rowProps} />

// ❌ INCORRECTO - causa "undefined" errors
const Row = () => { handleChangePriority(...) }; // closure no funciona
```

### 4.6 Build y Chunks

| Chunk | Tamaño | Contenido |
|-------|--------|-----------|
| `vendor` | ~2.36 MB | node_modules (TanStack, React Router, shadcn/ui) |
| `pages` | ~233 KB | `/src/pages/` |
| `components` | ~625 KB | `/src/components/` |
| **Límite advertencia** | 1000 kB | Configurado en vite.config.ts |

---

## 5. MCP Server Node — Herramientas para Agentes IA

**Ubicación**: `/mcp-server-node/`  
**Tecnología**: Express + TypeScript + MySQL2 directo (sin pasar por backend)  
**Puerto**: 8977  
**Protocolo**: JSON-RPC 2.0 (Model Context Protocol)

### 5.1 Herramientas Core (UNIFIED_TOOLS — 28 herramientas)

| # | Herramienta | Parámetros | Descripción |
|---|-------------|------------|-------------|
| 1 | `listActiveEPS` | — | Lista EPS activas |
| 2 | `listZones` | — | Zonas geográficas |
| 3 | `getEPSServices` | eps_id | Servicios autorizados por EPS |
| 4 | `searchPatient` | document, name, phone, patient_id | Busca paciente por múltiples criterios |
| 5 | `registerPatientSimple` | document_number, full_name, phone, birth_date, gender, zone_id, eps_id | Registro completo |
| 6 | `getAvailableAppointments` | doctor_id?, specialty_id?, location_id? | Disponibilidad con filtros opcionales |
| 7 | `checkAvailabilityQuota` | specialty_id, location_id | Verifica cupos |
| 8 | `getAvailableTimeSlots` | availability_id | Horarios específicos |
| 9 | `scheduleAppointment` | availability_id, patient_id, reason, scheduled_date, priority_level? | Agenda cita (soporta dobles en Odontología) |
| 10 | `addToWaitingList` | patient_id, specialty_id, priority_level, notes? | Agrega a lista de espera |
| 11 | `getPatientAppointments` | patient_id, status? | Historial de citas |
| 12 | `getWaitingListAppointments` | patient_id, status? | Estado en lista de espera |
| 13 | `searchSpecialties` | query? | Busca especialidades |
| 14 | `searchCups` | code | Busca por código CUPS |
| 15 | `searchCupsByName` | name | Busca CUPS por nombre |
| 16 | `reassignWaitingListAppointments` | waiting_list_id, availability_id | Reasigna desde lista de espera |
| 17 | `registerPregnancy` | patient_id, last_period_date, estimated_due_date | Registra embarazo |
| 18 | `getActivePregnancies` | patient_id | Embarazos activos |
| 19 | `updatePregnancyStatus` | pregnancy_id, status | Actualiza estado |
| 20 | `registerPrenatalControl` | pregnancy_id, control_data | Control prenatal |
| 21 | `cancelAppointment` | appointment_id, reason | Cancela cita |
| 22 | `syncAvailabilityQuotas` | availability_id? | Sincroniza cupos |
| 23 | `auditAvailabilityQuotas` | — | Audita cupos |
| 24 | `actualizarPhone` | patient_id, phone | Actualiza teléfono |
| 25 | `cancelarCitasVencidas` | — | Cancela citas vencidas |

### 5.2 Herramientas Mejoradas (ENHANCED_MEDICAL_TOOLS — 30 extras)

| Categoría | Herramientas |
|-----------|-------------|
| **Pacientes Avanzados** | `searchPatientsAdvanced`, `getPatientProfile`, `updatePatientExtended`, `mergePatients` |
| **Historiales Médicos** | `createMedicalRecord`, `getMedicalRecords`, `updateMedicalRecord` |
| **Alergias/Antecedentes** | `addPatientAllergy`, `getPatientAllergies`, `addMedicalHistory` |
| **Prescripciones** | `createPrescription`, `getActivePrescriptions`, `searchMedications` |
| **Laboratorio** | `createLabOrder`, `getLabOrders`, `addLabResults`, `getLabResults` |
| **Tratamientos** | `createTreatmentPlan`, `getTreatmentPlans`, `updateTreatmentTask` |
| **Citas Avanzadas** | `getAppointmentsAdvanced`, `scheduleAppointmentAdvanced`, `rescheduleAppointment`, `getAppointmentConflicts` |
| **Reportes** | `generatePatientReport`, `getDashboardStats`, `getAppointmentAnalytics`, `getPatientAnalytics` |
| **Sistema** | `intelligentSearch`, `getSystemHealth`, `optimizeDatabase` |

### 5.3 Integración

- **Acceso directo a MySQL** (no pasa por el backend API)
- **SMS via LabsMobile** para confirmaciones, lista de espera, cancelaciones, reagendamientos
- **API key de autenticación**: `biosanarcall_mcp_node_2025` (rutas alternativas en `mcp-complete.ts`)
- **Especialidades flexibles**: Medicina General (ID=1) y Odontología (ID=5) permiten agenda flexible

### 5.4 Flujo de Agente de Voz (Protocolo de Atención)

El agente sigue un flujo estricto de 7 pasos para agendamiento telefónico:

1. **Saludo**: "Hola, bienvenido a Fundación Biosanar IPS. Le atiende Valeria..."
2. **Consulta disponibilidad**: `getAvailableAppointments()` sin parámetros → presenta especialidades
3. **Selección sede/fecha**: Filtra por especialidad elegida, presenta sedes y fechas CON cupos (`slots_available > 0`)
4. **Verificación paciente**: Solicita cédula → `searchPatient()` → si no existe, registra con `registerPatientSimple()`
5. **Validación datos**: Nombre, teléfono, EPS (vía `listActiveEPS()`)
6. **Agendamiento**: `scheduleAppointment()` → confirma con doctor_name, fecha, hora, sede, appointment_id
7. **Cierre**: Ofrece ayuda adicional → despedida profesional

**Flujo de Lista de Espera**: Si no hay cupos → ofrece cola → pregunta prioridad (Urgente/Alta/Normal/Baja) → `scheduleAppointment()` con `priority_level` → confirma `queue_position` y `waiting_list_id`

---

## 6. Voice Call Service — Llamadas con IA

**Ubicación**: `/voice-call-service/`  
**Tecnología**: Express + TypeScript + Zadarma + ElevenLabs + OpenAI  
**Puerto**: 3001

### 6.1 Flujo de Llamada

```
Llamada entrante
       │
       ▼
Zadarma webhook ──→ NOTIFY_START ──→ VoiceCallHandler crea sesión
       │
       ▼
VoiceAssistantService saluda (ElevenLabs TTS)
       │
       ▼
Paciente habla ──→ NOTIFY_RECORD ──→ STT (OpenAI Whisper) ──→ texto
       │
       ▼
WhatsAppAgentService procesa intención ──→ respuesta texto
       │
       ▼
ElevenLabs TTS ──→ audio respuesta ──→ paciente escucha
       │
       ▼
NOTIFY_END ──→ cierra sesión + guarda logs
```

### 6.2 Servicios Internos

| Servicio | Función |
|----------|---------|
| `VoiceCallHandler` | Orquestador: inicio/fin llamada, grabaciones, sesiones |
| `VoiceAssistantService` | Asistente de voz: saludo, procesamiento de intenciones |
| `ElevenLabsHandler` | TTS con ElevenLabs, webhooks, transcripción |
| `ZadarmaClient` | Cliente API Zadarma con auth HMAC-SHA1 |
| `SipProxyServer` | Servidor SIP/UDP (REGISTER, INVITE, ACK, BYE, OPTIONS) |
| `SipVoiceIntegration` | Integración SIP+Voz: auto-answer, greeting |
| `STTService` / `TTSService` | Speech-to-Text y Text-to-Speech |
| `CallLogService` | Registro de llamadas en MySQL |

### 6.3 Configuración

```env
PORT=3001
ZADARMA_KEY=xxx
ZADARMA_SECRET=xxx
ZADARMA_SIP_SERVER=sip.zadarma.com
ELEVENLABS_API_KEY=xxx
ELEVENLABS_AGENT_ID=xxx
ELEVENLABS_VOICE_ID=xxx
SIP_ENABLED=true/false
VOICE_ASSISTANT_ENABLED=true/false
```

---

## 7. Aplicación Móvil — Portal del Paciente

**Ubicación**: `/mobile-app/`  
**Tecnología**: Expo SDK 54 + React Native 0.81 + React 19 + TypeScript  
**API Base**: `https://biosanarcall.site/api`

### 7.1 Pantallas

| Screen | Tab | Función |
|--------|-----|---------|
| `LoginScreen` | — | Auth OTP en 3 pasos: cédula → teléfono + OTP → verificación 6 dígitos |
| `AppointmentsScreen` | "Mis Citas" | Citas activas, lista de espera, cancelar, reagendar, editar teléfono |
| `ScheduleScreen` | "Agendar Cita" | Wizard 3 pasos: especialidad (filtrada por EPS) → sede → horario disponible |
| `NotificationsScreen` | "Notificaciones" | SMS enviados al paciente, badge no leídas, marcar leídas |

### 7.2 Flujo de Autenticación

1. Paciente ingresa número de documento
2. Sistema busca paciente → muestra datos parciales
3. Paciente confirma/corrige teléfono
4. Backend envía OTP por SMS (LabsMobile)
5. Paciente ingresa código de 6 dígitos
6. Si `Recordarme` activo → persiste sesión en AsyncStorage

### 7.3 Integración API (15 endpoints públicos)

```
/patients-v2/public/auth/request-otp     → Solicitar OTP
/patients-v2/public/auth/verify-otp      → Verificar OTP
/patients-v2/search                       → Buscar paciente por documento
/patients-v2/{id}/appointments            → Citas + lista de espera
/patients-v2/public/update-phone          → Actualizar teléfono
/patients-v2/public/authorized-specialties/{epsId} → Especialidades autorizadas
/locations/public/eps/{epsId}             → Sedes por EPS
/availabilities/public?specialty_id=      → Disponibilidad
/patients-v2/public/schedule-appointment  → Agendar cita
/patients-v2/public/add-to-waiting-list   → Lista de espera
/patients-v2/public/appointments/{id}/cancel    → Cancelar
/patients-v2/public/appointments/{id}/reschedule → Reagendar
/sms/patient/{id}                         → Historial SMS
/sms/patient/{id}/unread-count            → Conteo no leídas
/sms/patient/{id}/mark-read               → Marcar leídas
```

---

## 8. Cluster Monitor — Infraestructura

**Ubicación**: `/cluster-monitor/`  
**Tecnología**: Express + node-ssh + systeminformation  
**Puerto**: 5055

### 8.1 Arquitectura del Cluster

| Servidor | IP | Rol |
|----------|-----|------|
| **Server 1 (Master)** | 82.29.62.188 | Master MariaDB, Nginx LB, NFS, Redis |
| **Server 2 (Réplica)** | 72.62.164.88 | Slave MariaDB, Failover |

### 8.2 Métricas Recolectadas (SSE cada 5s)

Por servidor: CPU, RAM, Disco, Uptime, Red (rx/tx), PM2 (procesos, estado, CPU, memoria, restarts), Nginx (conexiones, requests), MariaDB (conexiones, queries/s), Replicación (IO/SQL running, seconds behind), Redis (solo S1), NFS (solo S1), Load Balancer, Failover (solo S2).

### 8.3 Pruebas de Estrés (4 modos)

| Modo | Descripción |
|------|-------------|
| **Ramp** | Escalado gradual hasta maxConcurrent |
| **Spike** | Baseline → ráfaga súbita → recovery |
| **Endurance** | Carga sostenida N segundos |
| **Find-limit** | Escala hasta 2000 para encontrar punto de ruptura |

Mide: latencias (avg/min/max/p50/p95/p99), throughput, status codes, errores, CPU/RAM/DB.

---

## 9. Voice Web Interface — Dashboard de Voz

**Ubicación**: `/voice-web-interface/`  
**Tecnología**: HTML estático + Alpine.js + TailwindCSS (CDN)

Dashboard de administración para monitorear el servicio de llamadas de voz:
- KPIs: Balance Zadarma, Llamadas hoy, Tiempo promedio, Tasa de éxito
- Estado de servicios en tiempo real (polling 30s)
- Test de API, webhooks y simulación de llamadas
- Historial de llamadas con grabaciones

---

## 10. Scripts de Utilidad

**Ubicación**: `/scripts/`

### Despliegue

| Script | Función |
|--------|---------|
| `deploy-cluster.sh` | Build backend → restart Server 1 → rsync a Server 2 → restart → health check |
| `deploy-frontend.sh` | `npm ci` → build → rsync a webroot → Nginx reload → sync Server 2 |
| `deploy-eps-authorizations.sh` | Deploy frontend con rollback automático |
| `deploy-voice-service.sh` | Deploy voice service con PM2 + Nginx |
| `cluster-status.sh` | Estado rápido del cluster (PM2, MariaDB, Redis, Nginx, NFS) |
| `clear-frontend-cache.sh` | Fuerza rebuild con timestamp para invalidar caché |

### Datos y Migración

| Script | Función |
|--------|---------|
| `import_csv_to_patients.py` | Importa pacientes desde CSV con upsert por documento |
| `reorganize_names_with_zone.py` | Reorganiza CSV + clasificación geográfica por regex |
| `update_database_with_zones.py` | Actualiza zones en BD desde CSV |
| `update_zone_relationships.py` | Asigna zone_id numérico por texto |
| `analyze_duplicates.py` | Detecta duplicados y recomienda CONSERVAR/ELIMINAR |
| `verify_csv_patients.py` | Verifica existencia de pacientes CSV en BD |
| `normalize_all_phones.sh` | Normaliza teléfonos a formato `+57XXXXXXXXXX` |

### Mantenimiento

| Script | Función |
|--------|---------|
| `cleanup.sh` | Limpieza de archivos temporales (dry-run + --delete) |
| `update_status_strings.sh` | Migración de strings de estado (Activa→active, etc.) |

---

## 11. Base de Datos — Esquema y Convenciones

**Motor**: MySQL 8.0 / MariaDB (producción)  
**Pool**: mysql2/promise, 25 conexiones, queue limit 50, timeout 30s  
**Charset**: utf8mb4, timezone UTC (+00:00)

### 12.1 Tablas Principales (52+)

#### Core del Negocio
| Tabla | Campos Clave | Propósito |
|-------|-------------|-----------|
| `patients` | document, full_name, phone, email, birth_date, gender, zone_id, municipality_id, eps_id, blood_group, education_level | Pacientes |
| `doctors` | name, email, phone, license_number, role, active, password_hash | Médicos |
| `doctor_specialties` / `doctor_locations` | doctor_id, specialty_id/location_id | Relaciones M:N |
| `specialties` | name, description, active | Especialidades médicas |
| `locations` | name, type, address, municipality_id, capacity | Sedes |
| `users` | name, email, role, password_hash | Usuarios del sistema |

#### Agendamiento
| Tabla | Propósito |
|-------|-----------|
| `availabilities` | Bloques de disponibilidad (doctor, specialty, location, date, start/end_time, capacity, booked_slots, is_paused) |
| `appointments` | Citas (patient, doctor, specialty, location, availability, scheduled_at, status, reason, cups_id) |
| `appointments_waiting_list` | Lista de espera (specialty_id OR availability_id, priority, queue_position) |
| `availability_distribution` | Distribución de citas |
| `scheduling_preallocation` | Pre-asignación de cupos |
| `daily_assignment_queue` / `daily_assignment_config` | Asignación diaria |

#### Catálogos
| Tabla | Propósito |
|-------|-----------|
| `eps` | Entidades Promotoras de Salud |
| `eps_specialty_location_authorizations` | Autorizaciones EPS/Especialidad/Sede |
| `cups` / `cups_services` / `cups_eps_config` | Códigos CUPS colombianos |
| `zones` / `municipalities` | División geográfica |
| `document_types`, `blood_groups`, `education_levels`, `marital_statuses` | Lookups |

#### Comunicaciones e IA
| Tabla | Propósito |
|-------|-----------|
| `calls` / `call_logs` / `call_events` / `calls_archive` | Registro de llamadas |
| `elevenlabs_conversations` / `elevenlabs_audio` / `elevenlabs_calls` | ElevenLabs |
| `sms_logs` / `sms_monthly_stats` | SMS |
| `whatsapp_chat_sessions` / `messages` / `summaries` / `preferences` | WhatsApp bot |
| `whatsapp_semantic_memories` / `conversation_persistence` | Memoria IA |

#### Clínico
| Tabla | Propósito |
|-------|-----------|
| `pregnancies` / `prenatal_controls` | Seguimiento de embarazos |
| `medical_records` / `medical_record_attachments` | Historias clínicas |
| `patient_allergies` / `patient_medical_history` / `patient_medications` | Datos clínicos |

#### Sistema
| Tabla | Propósito |
|-------|-----------|
| `system_settings` | Config global (org_name, org_nit, timezone) |
| `services` / `doctor_service_prices` / `appointment_billing` | Facturación |
| `ai_transfers` | Transferencias IA→humano |
| `support_tickets` / `support_messages` / `support_attachments` | Soporte |
| `doctor_sessions` / `doctor_login_audit` | Auth doctores |

### 12.2 Lista de Espera — Dos Modos

```sql
-- Modo 1: Por Especialidad (flexible, cualquier doctor/sede)
specialty_id: NOT NULL, availability_id: NULL

-- Modo 2: Por Disponibilidad Específica (ligado a doctor/sede)
availability_id: NOT NULL, specialty_id: NULL (o coincide)

-- Posición calculada por: specialty_id + priority + FIFO
```

### 12.3 Bootstrap Automático

Al arrancar, `bootstrap.ts` ejecuta migraciones no destructivas:
- Crea tablas faltantes, agrega columnas, índices, FKs
- Crea triggers y procedimientos almacenados (`recalc_availability_slots`)
- Crea vistas (`appointment_daily_stats`)
- Backfill de datos huérfanos

---

## 12. Flujos de Negocio Críticos

### 13.1 Agendamiento de Cita (Flujo Completo)

```
1. Consulta disponibilidad → getAvailableAppointments()
2. Filtrar por especialidad → presentar sedes
3. Filtrar por sede → presentar fechas con cupos (slots_available > 0)
4. Paciente elige fecha → buscar/registrar paciente (searchPatient/registerPatientSimple)
5. Solicitar motivo de consulta
6. scheduleAppointment() → confirmar con datos completos
7. SMS de confirmación automático (LabsMobile)
```

### 13.2 Lista de Espera (Sin Cupos)

```
1. No hay cupos disponibles → ofrecer lista de espera
2. Preguntar prioridad: Urgente/Alta/Normal/Baja
3. addToWaitingList() → confirmar queue_position y waiting_list_id
4. Cuando se libera cupo → notificar paciente
5. reassignWaitingListAppointments() → asignar cita
```

### 13.3 Cancelación y Reasignación

```
1. cancelAppointment(id, reason) → libera cupo
2. Sistema verifica lista de espera → si hay alguien:
   - cancelAndReassign() → asigna al siguiente en cola
   - SMS de notificación al nuevo paciente
```

### 13.4 Flujo de Autenticación

```
Admin/Staff:
  POST /api/auth/login → JWT (8h) con { id, role, name, email }
  Header: Authorization: Bearer <token>
  Cache de tokens: 5min en memoria

Doctor:
  POST /api/doctor-auth/login → JWT independiente
  Tabla: doctor_sessions + doctor_login_audit

Paciente (Móvil):
  POST /patients-v2/public/auth/request-otp → SMS con código
  POST /patients-v2/public/auth/verify-otp → Token de sesión
  AsyncStorage: persistencia "Recordarme"
```

---

## 13. Guía de Desarrollo

### 14.1 Comandos de Desarrollo

```bash
# Backend
cd backend
npm run dev          # ts-node-dev con auto-reload
npm run build        # TypeScript → dist/ (esbuild)
npm run db:init      # Inicializar esquema
npm run db:seed      # Crear admin (SEED_ADMIN_* env vars)
npm run db:check     # Test conexión MySQL
npm run test:features # Tests de features

# Frontend
cd frontend
npm run dev          # Vite dev server (:8080)
npm run build        # Build producción (~17s)

# MCP Server
cd mcp-server-node
npm run dev          # ts-node-dev

# Mobile
cd mobile-app
npx expo start       # Dev con Expo
./build_apk.sh       # Build APK release

# Voice Service
cd voice-call-service
npm run dev          # ts-node-dev
```

### 14.2 Variables de Entorno Críticas

```env
# Backend (/backend/.env)
DB_HOST=127.0.0.1
DB_USER=biosanar_user
DB_NAME=biosanar
DB_PASSWORD=xxx
JWT_SECRET=min_16_chars
CORS_ORIGINS=https://biosanarcall.site,https://www.biosanarcall.site
PORT=4000
CALL_ARCHIVE_DAYS=30
ENABLE_FULLTEXT_SEARCH=true
PATIENT_SEARCH_CACHE_TTL_MS=5000

# MCP Server (/mcp-server-node/.env)
PORT=8977
DB_HOST=127.0.0.1
DB_TIMEZONE=+00:00
LABSMOBILE_USERNAME=xxx
LABSMOBILE_API_KEY=xxx

# Voice Service (/voice-call-service/.env)
PORT=3001
ZADARMA_KEY=xxx
ZADARMA_SECRET=xxx
ELEVENLABS_API_KEY=xxx
ELEVENLABS_VOICE_ID=xxx

# Mobile (/mobile-app/)
API_BASE=https://biosanarcall.site/api
```

### 14.3 Patrones de Código

#### Backend — Ruta Estándar
```typescript
router.get('/', requireAuth, requireRole(['admin', 'superadmin']), asyncHandler(async (req, res) => {
  const data = await pool.query('SELECT ...');
  res.json({ success: true, data });
}));
```

#### Backend — Validación con Zod
```typescript
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
router.post('/', requireAuth, validateBody(schema), asyncHandler(async (req, res) => { ... }));
```

#### Frontend — Formulario Estándar
```tsx
const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema)
});
```

#### Frontend — Lazy Loading
```tsx
const Queue = lazy(() => import("./pages/Queue"));
<Route path="/queue" element={
  <Suspense fallback={<LoadingScreen />}>
    <Queue />
  </Suspense>
} />
```

#### Frontend — Layout con Sidebar
```tsx
<SidebarProvider>
  <AppSidebar />
  <main className="w-full">
    <SidebarTrigger />
    {/* Contenido */}
  </main>
</SidebarProvider>
```

---

## 14. Despliegue y Producción

### 15.1 PM2 Ecosystem

```javascript
// backend/ecosystem.config.js
{
  name: 'cita-central-backend',
  script: 'dist/src/server.js',
  env: { NODE_ENV: 'production', PORT: 4000 },
  max_memory_restart: '300M',
  out_file: 'logs/out.log',
  error_file: 'logs/error.log'
}
```

### 15.2 Nginx

- Frontend servido como archivos estáticos desde `frontend/dist/`
- Backend proxied a `:4000`
- MCP Server proxied a `:8977`
- Voice Service webhooks proxied a `:3001`
- SSL/HTTPS obligatorio en producción
- Dominio: `biosanarcall.site`

### 15.3 Flujo de Deploy

```bash
# Backend
cd backend && npm run build && pm2 restart cita-central-backend

# Frontend
cd frontend && npm run build  # → dist/ → rsync a Nginx root

# Cluster completo
./scripts/deploy-cluster.sh   # Build → S1 → rsync → S2 → health check
```

---

## 15. Convenciones y Reglas para Agentes

### 16.1 Reglas Generales

1. **Nunca escribir componentes UI desde cero** — usar siempre shadcn/ui + Radix UI
2. **Todas las páginas usan lazy loading** — `React.lazy + Suspense` en App.tsx
3. **Validación siempre con Zod** — tanto en backend como frontend
4. **Respuestas API estándar** — `{ success: true/false, data?, error?, message? }`
5. **Fechas en UTC** — la conversión a Colombia (UTC-5) se hace en la capa de presentación
6. **JWT mínimo 16 chars** — el servidor no arranca si es menor
7. **Auditoría automática** — el middleware registra todas las operaciones CRUD
8. **No usar closures en react-window** — siempre pasar props via `rowProps`

### 16.2 Convenciones de Naming

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Archivos de ruta (backend) | kebab-case | `eps-authorizations.ts` |
| Componentes React | PascalCase | `PatientBasicInfo.tsx` |
| Hooks | camelCase con `use` | `useSessionManager` |
| API methods | camelCase | `getWaitingListBySpecialty` |
| Tablas BD | snake_case | `appointments_waiting_list` |
| Variables de entorno | SCREAMING_SNAKE | `CORS_ORIGINS` |

### 16.3 Reglas de Seguridad

- **Nunca exponer JWT_SECRET, contraseñas o API keys** en logs o respuestas
- **Rate limiting** obligatorio en endpoints de autenticación
- **Sanitización XSS** automática en middleware (no confiar en el cliente)
- **CORS restringido** — solo dominios explícitos en producción
- **Auditoría** registra IP, user-agent y timestamp de cada operación sensible
- **bcrypt** para hash de contraseñas (nunca texto plano)

### 16.4 Reglas de Base de Datos

- **Connection pooling siempre** — nunca crear conexiones individuales
- **Transacciones** para operaciones multi-tabla (especialmente en agendamiento)
- **Índices** en columnas de búsqueda frecuente (document, phone, email, scheduled_at)
- **UTF8MB4** como charset por defecto
- **UTC** como timezone de la BD — convertir en aplicación
- **Procedimiento `recalc_availability_slots`** — recalcula cupos automáticamente

### 16.5 Reglas de Performance

- **Summary mode** obligatorio para cargas iniciales de listas grandes
- **Lazy loading** por especialidad en listas de espera
- **Virtualización** con react-window para listas >100 items
- **Caché en memoria** con TTL (60s para analytics, 5s para búsqueda de pacientes)
- **Imports dinámicos** para features pesadas (PDF, charts, Excel)
- **Compresión** habilitada en servidor (excepto SSE)

---

## 16. Troubleshooting

| Síntoma | Causa Probable | Solución |
|---------|---------------|----------|
| 401 en API | JWT expirado | Verificar token, refrescar o re-login |
| 404 en endpoint | Endpoint no implementado | Usar fallback graceful, verificar versión de ruta |
| CORS bloqueado | Dominio no en `CORS_ORIGINS` | Agregar dominio a variable de entorno |
| BD no conecta | Credenciales o servicio caído | `npm run db:check`, verificar MariaDB status |
| `handleChangePriority is not defined` | Props pasadas con closure en react-window | Usar `rowProps` object pattern |
| Cola lenta | Sin summary mode | Asegurar `?summary=true` en carga inicial |
| Build lento | Sin caché | Verificar node_modules, usar `npm ci` |
| Bundle >1MB warning | Vendor chunk grande | Esperado (~2.36MB), no es crítico |
| SMS no llegan | Balance LabsMobile o formato teléfono | Verificar `/api/sms/balance`, normalizar a `+57XXXXXXXXXX` |
| WhatsApp desconectado | Sesión expirada | Re-escanear QR desde `/admin/whatsapp` |
| Replicación atrasada | Carga alta o red lenta | Verificar `SHOW SLAVE STATUS`, seconds_behind_master |
| Llamadas sin audio | ElevenLabs voice_id inválido | Verificar `ELEVENLABS_VOICE_ID` en env |

---

## Apéndice: Dependencias Principales

### Backend
| Categoría | Paquetes |
|-----------|----------|
| **Framework** | express, cors, helmet, compression, express-rate-limit |
| **BD** | mysql2 |
| **Auth** | jsonwebtoken, bcrypt/bcryptjs |
| **Validación** | zod |
| **IA/NLP** | @langchain/core, @langchain/groq, @langchain/openai, @langchain/langgraph, openai |
| **Telefonía** | @elevenlabs/elevenlabs-js |
| **WhatsApp** | @whiskeysockets/baileys |
| **SMS** | labsmobile-sms |
| **Email** | nodemailer |
| **Cache** | ioredis |
| **Logging** | pino, pino-http |
| **Fechas** | date-fns, date-fns-tz |
| **Uploads** | multer |
| **Build** | esbuild, typescript |

### Frontend
| Categoría | Paquetes |
|-----------|----------|
| **Core** | react 18, react-dom 18, typescript 5, vite 5 |
| **UI** | shadcn/ui (57), radix-ui (22), lucide-react, tailwindcss 3, framer-motion |
| **Estado** | @tanstack/react-query 5, @tanstack/react-table 8 |
| **Formularios** | react-hook-form 7, zod |
| **Routing** | react-router-dom 6 |
| **Virtualización** | react-window, react-virtuoso |
| **PDF/Excel/QR** | jspdf, xlsx, qrcode |
| **Gráficas** | recharts |

### Mobile
| Categoría | Paquetes |
|-----------|----------|
| **Core** | expo 54, react-native 0.81, react 19 |
| **Navegación** | @react-navigation/native 7, native-stack, bottom-tabs |
| **Persistencia** | @react-native-async-storage/async-storage |
