---
applyTo: "backend/**"
description: "Backend Express+TS conventions: security middleware, JWT auth, MySQL2 pool, Pino logging, audit middleware, standardized API responses."
---

# Backend Conventions

## API Response Pattern
```typescript
// Success
res.json({ success: true, data: result });
// Error
res.status(400).json({ success: false, error: 'Mensaje descriptivo' });
// Paginated
res.json({ success: true, data: items, pagination: { page, limit, total, pages } });
```

## Route Pattern
- All routes under `/api/` prefix
- Auth: `authenticateToken` middleware (except public endpoints)
- Doctor routes: separate `authenticateDoctorToken`
- Validation: Zod schemas with `validate()` middleware
- Audit: auto-logged for POST/PUT/DELETE via `auditMiddleware`

## Database
- Use `pool.execute()` with parameterized queries (never string concatenation)
- Transactions: `const conn = await pool.getConnection(); await conn.beginTransaction();`
- Dates: Store as MySQL `DATETIME`, convert to Colombia timezone (`America/Bogota`) for display

## Webhooks
- Meta WhatsApp: `express.raw()` body + HMAC-SHA256 verification via `WHATSAPP_META_APP_SECRET`
- ElevenLabs: signature verification via `ELEVENLABS_WEBHOOK_SECRET`
- Always respond 200 immediately, process in background

## Build
```bash
npm run build    # esbuild → dist/server.js (minified)
npm run dev      # ts-node-dev auto-reload
```
