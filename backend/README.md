# Backend Cita Central IPS

API Express + MySQL2 (TypeScript).

## Configuración

1. Copia `.env.example` a `.env` y ajusta variables. Ejemplo de configuración MySQL:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=biosanar_user
DB_PASS=TU_PASSWORD
DB_NAME=biosanar
```

Opcional (si tienes privilegios para crear BD en init):

```
DB_ADMIN_USER=
DB_ADMIN_PASS=
```

SMTP opcional, por defecto `MAIL_ENABLED=false`.

## Scripts

- `npm run dev`: desarrollo (ts-node-dev)
- `npm run build`: compilar a `dist/`
- `npm start`: ejecutar compilado
- `npm run db:init`: crea BD (si hay privilegios) y aplica `schema.sql` si existe
- `npm run db:seed`: crea usuario admin inicial (usar variables `SEED_ADMIN_*`)
- `npm run db:check`: prueba conexión a MySQL

## Notas

- El servidor expone `/api/*` y sirve `/uploads` desde `backend/uploads`.
- Asegura que MySQL acepte conexiones locales para el usuario configurado y que este tenga permisos sobre `DB_NAME`.

## Variables de Entorno Adicionales

Optimización y métricas añadidas recientemente:

```
# Seguridad
JWT_SECRET=super_secret_key_cambia_esto

# Archivo y métricas de llamadas
CALL_ARCHIVE_DAYS=30                # Días antes de archivar llamadas
CALL_EVENTS_RETENTION_DAYS=180      # (Planificado) días para purga de eventos

# Búsqueda de pacientes
ENABLE_FULLTEXT_SEARCH=true         # Usa MATCH ... AGAINST si está disponible
PATIENT_SEARCH_CACHE_TTL_MS=5000    # TTL de caché para quick-search (ms)

# Caché genérica (si se amplía)
CACHE_DEFAULT_TTL_MS=10000
```

Si una variable no está presente se aplicarán valores por defecto seguros en el código.
