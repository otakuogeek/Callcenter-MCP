# 🏗️ Resumen del Proyecto - Arquitectura Técnica

## Descripción General

**Biosanarcall** es un sistema modular de gestión médica con arquitectura de microservicios, diseñado para manejar grandes volúmenes de pacientes y comunicaciones.

---

## 🏛️ Arquitectura

```
                    ┌─────────────────────┐
                    │     Nginx Proxy     │
                    │  (SSL/Load Balance) │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐      ┌─────────────┐     ┌─────────────┐
   │  Frontend   │      │   Backend   │     │ MCP Server  │
   │   (React)   │      │  (Node.js)  │     │  (Python)   │
   │  Port 8080  │      │  Port 4000  │     │  Port 8977  │
   └─────────────┘      └──────┬──────┘     └─────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐      ┌─────────────┐     ┌─────────────┐
   │   MySQL     │      │  LabsMobile │     │ ElevenLabs  │
   │  Database   │      │   (SMS)     │     │  (Llamadas) │
   └─────────────┘      └─────────────┘     └─────────────┘
```

---

## 📦 Componentes Principales

### Frontend (React + TypeScript)
- **Framework**: Vite + React 18
- **UI Library**: shadcn/ui + Tailwind CSS
- **Estado**: TanStack Query + React Hook Form
- **Routing**: React Router v6

**Estructura:**
```
frontend/src/
├── components/     # Componentes UI reutilizables
├── pages/          # Páginas de la aplicación
├── hooks/          # Custom React hooks
├── lib/            # Utilidades y API client
└── utils/          # Funciones auxiliares
```

### Backend (Node.js + Express)
- **Runtime**: Node.js 22
- **Framework**: Express + TypeScript
- **ORM**: mysql2/promise
- **Auth**: JWT + bcrypt

**Estructura:**
```
backend/src/
├── routes/         # Endpoints REST
├── services/       # Lógica de negocio
├── db/             # Conexión y queries
└── middleware/     # Auth, CORS, etc.
```

### MCP Server (Model Context Protocol)
- **Propósito**: Integración con agentes AI
- **Protocolo**: JSON-RPC 2.0
- **Herramientas**: 24+ tools para gestión médica

---

## 🗄️ Base de Datos

### Tablas Principales
| Tabla | Descripción | Registros |
|-------|-------------|-----------|
| `patients` | Pacientes registrados | ~40,000 |
| `appointments` | Citas médicas | ~15,000 |
| `availabilities` | Agendas médicas | ~2,000 |
| `doctors` | Médicos | ~50 |
| `specialties` | Especialidades | ~20 |
| `locations` | Sedes | ~5 |
| `sms_logs` | Historial SMS | ~7,600 |
| `call_logs` | Historial llamadas | ~1,200 |

### Relaciones
```
patients ─┬─> appointments ─> availabilities ─┬─> doctors
          │                                    ├─> specialties
          └─> sms_logs                         └─> locations
```

---

## 🔌 Integraciones Externas

### LabsMobile (SMS)
- **Tipo**: REST API
- **Función**: Envío de SMS a pacientes
- **Costo**: ~$0.043 USD/SMS (Colombia)

### ElevenLabs (Llamadas)
- **Tipo**: Conversational AI API
- **Función**: Llamadas automatizadas con voz
- **Agente**: Valeria (voz en español)

### WhatsApp (Bot)
- **Librería**: whatsapp-web.js
- **Función**: Atención automatizada 24/7
- **Estado**: Conectado vía QR

---

## 🚀 Deployment

### Servidores PM2
| Proceso | Puerto | Descripción |
|---------|--------|-------------|
| `cita-central-backend` | 4000 | API principal |
| `mcp-unified` | 8977 | MCP Server |
| `park-backend` | - | Otros servicios |

### Comandos de Deploy
```bash
# Backend
cd backend && npm run build && pm2 restart cita-central-backend

# Frontend
cd frontend && npm run build
# Archivos en dist/ → sincronizar con Nginx

# MCP Server
pm2 restart mcp-unified
```

---

## 📊 Performance

### Optimizaciones Implementadas
1. **Lazy Loading**: Páginas cargadas bajo demanda
2. **Virtualización**: react-window para listas largas
3. **Caché**: Analytics con TTL de 60s
4. **Conexiones**: Pool de MySQL con límite 10

### Métricas de Build
| Chunk | Tamaño | Gzip |
|-------|--------|------|
| vendor | 2.85 MB | 826 KB |
| components | 742 KB | 163 KB |
| pages | 421 KB | 86 KB |

---

## 🔐 Seguridad

### Implementaciones
- **JWT**: Tokens con expiración 24h
- **CORS**: Dominios permitidos configurables
- **Helmet.js**: Headers de seguridad
- **Rate Limiting**: Protección de endpoints
- **Sanitización**: Inputs validados con Zod

### Variables Sensibles
Todas en `.env`, nunca en código:
- Credenciales de DB
- API Keys de servicios
- JWT Secret

---

## 📈 Escalabilidad

### Capacidad Actual
- **Usuarios concurrentes**: ~50
- **Requests/min**: ~500
- **DB connections**: Pool de 10

### Para escalar:
1. Añadir réplicas de lectura MySQL
2. Implementar Redis para caché
3. Load balancer con múltiples instancias

---

*Documentación técnica actualizada: Enero 2026*
