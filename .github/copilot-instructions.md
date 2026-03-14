# Biosanarcall Medical System — Workspace Instructions

> Sistema integral de gestión médica para Fundación Biosanar IPS (Colombia).
> IPS con múltiples sedes en Santander · EPS + CUPS · Regulación salud colombiana.

## Stack & Puertos

| Componente | Stack | Puerto | Entrada |
|---|---|---|---|
| Backend API | Express 4 + TS + MySQL2 | 4000 | `backend/src/server.ts` |
| Frontend | React 18 + Vite + shadcn/ui | 8080 | `frontend/src/App.tsx` |
| MCP Server | Express + TS + MySQL2 (JSON-RPC 2.0) | 8977 | `mcp-server-node/src/server-unified.ts` |
| Voice Service | Express + TS + ElevenLabs + Zadarma | 3001 | `voice-call-service/src/server.ts` |
| Mobile | Expo 54 + React Native 0.81 | — | `mobile-app/App.tsx` |
| Cluster Monitor | Express + SSH | 5055 | `cluster-monitor/src/server.js` |

## Build & Run

```bash
# Backend
cd backend && npm run dev          # ts-node-dev auto-reload
cd backend && npm run build        # esbuild → dist/server.js
cd backend && npm run db:check     # Test MySQL connection
cd backend && npm run db:migrate   # Apply migrations
cd backend && npm run test:features

# Frontend (port 8080, NOT 5173)
cd frontend && npm run dev
cd frontend && npm run build       # ~17s, includes type-check

# Deploy (PM2)
cd backend && npm run build && pm2 restart cita-central-backend
cd frontend && npm run build       # dist/ → Nginx root
```

## Architecture Conventions

### Backend
- **Security-first**: helmet, CORS (`CORS_ORIGINS` env), rate limiting (20 req/15min login, 50k general)
- **Auth**: JWT (min 16 chars secret, verified at startup). 6 roles: superadmin, admin, supervisor, agent, doctor, reception
- **Doctor auth**: Independent JWT via `/api/doctor-auth/*`
- **Response format**: `{ success: true, data: T }` / `{ success: false, error: string }`
- **Logging**: Pino + pino-http (JSON prod, pretty dev). Audit middleware auto-logs POST/PUT/DELETE
- **Webhooks**: `express.raw()` for Meta WhatsApp + ElevenLabs signature verification
- **Caching**: In-memory Map with 60s TTL for analytics endpoints

### Frontend
- **shadcn/ui + Radix** exclusively — never write custom UI from scratch
- **React Router 6** with `ProtectedRoute` + `DoctorProtectedRoute` wrappers
- **TanStack Query 5** for server state (refetch on mount, not window focus)
- **React Hook Form + Zod** for all forms
- **React.lazy + Suspense** for all 35+ pages in `App.tsx`
- **Layout**: Every page uses `<SidebarProvider><AppSidebar /><main>...</main></SidebarProvider>`
- **API client**: `frontend/src/lib/api.ts` — centralized fetch + token handling + 401 redirect

### Database
- MySQL 8 (MariaDB prod). Master (82.29.62.188) ↔ Slave (72.62.164.88)
- 52+ tables, 70+ migrations in `backend/migrations/`
- Connection pool (25) via mysql2

## API Routes

| Prefix | Purpose |
|---|---|
| `/api/auth/*` | Login, logout, token refresh |
| `/api/doctor-auth/*` | Doctor portal (independent) |
| `/api/patients/*` | Patient CRUD |
| `/api/appointments/*` | Scheduling + waiting list |
| `/api/availabilities/*` | Doctor availability management |
| `/api/lookups/*` | Reference data (municipalities, EPS, specialties) |
| `/api/daily-queue` | Daily assignment queue |
| `/api/analytics/*` | Cached analytics (60s TTL) |
| `/api/whatsapp/meta/webhook` | Meta Cloud API webhooks (HMAC-SHA256) |
| `/api/webhooks/elevenlabs` | ElevenLabs voice webhooks |

## Performance Pitfalls

**Queue page** (`/queue`) handles 785+ patients with 3-tier optimization:
1. Summary mode: `GET /api/appointments/waiting-list?summary=true` (90% payload reduction)
2. Lazy load per specialty: `GET /api/appointments/waiting-list/specialty/:id`
3. react-window virtualization — **Props MUST use `rowProps` object, NOT closures**

**Bundle**: vendor ~2.36 MB, pages ~233 KB, components ~625 KB. Use dynamic imports for heavy features.

## WhatsApp Bot Architecture

Pipeline in `backend/src/whatsapp/`:
```
01-Identify → 02-IntentAnalysis → 03-QuickIntents → 04-AutoAvailability
→ 05-StateHandlers → 06-AIGeneration → 07-Validation
```
Each step checks `ctx.earlyResponse`; if set, subsequent steps skip.
Conversation AI: GPT-5-mini via ChatGPT API (configurable to Groq).
See `.github/skills/whatsapp-flow-improvement/SKILL.md` for diagnosis patterns.

## Waiting List Data Model

```sql
-- Mode 1: By Specialty (flexible, any doctor/location)
specialty_id: NOT NULL, availability_id: NULL
-- Mode 2: By Specific Availability (tied to doctor/location)
availability_id: NOT NULL, specialty_id: NULL
-- Queue position = specialty_id + priority + FIFO
```

## Key Files

- **Backend entry**: `backend/src/server.ts`
- **Backend routes**: `backend/src/routes/` (57 files, largest: appointments.ts ~2648 lines, availabilities.ts ~3338 lines)
- **WhatsApp services**: `backend/src/services/WhatsApp*.ts` (13 files)
- **Frontend router**: `frontend/src/App.tsx` (35+ lazy routes)
- **API client**: `frontend/src/lib/api.ts`
- **Queue optimization**: `frontend/src/pages/Queue.tsx` + `frontend/src/components/VirtualizedPatientList.tsx`
- **MCP tools**: `mcp-server-node/src/server-unified.ts` (58 tools)
- **PM2 configs**: `backend/ecosystem.config.js`, `mcp-server-node/ecosystem.config.js`
- **Nginx**: `/etc/nginx/sites-enabled/biosanarcall.site`

## Troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| 401 en API | JWT expirado | Verificar token, usar refresh |
| CORS error | Dominio no en CORS_ORIGINS | Actualizar `.env` |
| Webhook 401 | APP_SECRET incorrecto | Verificar HMAC con `WHATSAPP_META_APP_SECRET` |
| Queue lenta | summary mode desactivado | Usar `?summary=true` |
| `handleChangePriority undefined` | Props via closure en react-window | Usar `rowProps` object |
| DB connection failed | Pool exhausted | `npm run db:check`, verificar pool size |
