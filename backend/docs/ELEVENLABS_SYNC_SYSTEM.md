# Sistema de Sincronización de Llamadas ElevenLabs

## 📋 Descripción

Sistema híbrido para gestionar llamadas de ElevenLabs que combina:
- **5 últimas llamadas** desde la API en tiempo real
- **Resto de llamadas** desde base de datos local (alta velocidad)
- **Sincronización automática** vía webhooks
- **Sincronización manual** para datos históricos

## 🗄️ Estructura de Base de Datos

### Tabla: `elevenlabs_calls`

Almacena todas las conversaciones/llamadas de ElevenLabs con la siguiente estructura:

```sql
CREATE TABLE elevenlabs_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(100) UNIQUE NOT NULL,
    call_id VARCHAR(100),
    agent_id VARCHAR(100),
    caller_number VARCHAR(50),
    callee_number VARCHAR(50),
    
    status ENUM('done', 'in_progress', 'failed', 'waiting'),
    call_direction ENUM('inbound', 'outbound'),
    call_type VARCHAR(50),
    
    started_at DATETIME,
    ended_at DATETIME,
    duration_seconds INT,
    
    transcript LONGTEXT,
    analysis JSON,
    summary TEXT,
    metadata JSON,
    end_reason VARCHAR(100),
    recording_url VARCHAR(500),
    
    synced_from_api BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Tabla: `elevenlabs_sync_log`

Registro de sincronizaciones para auditoría:

```sql
CREATE TABLE elevenlabs_sync_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sync_type ENUM('webhook', 'polling', 'manual'),
    records_synced INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    error_message TEXT,
    sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_completed_at TIMESTAMP NULL,
    status ENUM('success', 'failed', 'in_progress')
);
```

## 🔄 Flujo de Sincronización

### 1. Sincronización en Tiempo Real (Webhooks)

Cuando una llamada finaliza, ElevenLabs envía un webhook que:
1. Procesa la información de la llamada
2. La guarda en `elevenlabs_conversations` (tabla original)
3. **NUEVO**: La sincroniza automáticamente en `elevenlabs_calls`

```typescript
// En webhooks.ts
await ElevenLabsSync.syncFromWebhook(payload.data);
```

### 2. Consulta Híbrida (API + Base de Datos)

Cuando el frontend solicita llamadas:

```
GET /api/consultations/elevenlabs?page=1&page_size=20
```

El backend ejecuta:
1. **Paso 1**: Obtiene las 5 llamadas más recientes de la API de ElevenLabs
2. **Paso 2**: Las sincroniza en background (no bloquea la respuesta)
3. **Paso 3**: Obtiene el resto desde la base de datos local
4. **Paso 4**: Combina ambos resultados evitando duplicados

```typescript
// Respuesta del endpoint
{
  "success": true,
  "data": [...], // Llamadas combinadas
  "stats": {
    "total_conversations": 1463,
    "from_api": 5,          // Últimas 5 en tiempo real
    "from_database": 15,    // Del cache local
    "total_duration_minutes": 1234
  },
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1463,
    "total_pages": 74
  }
}
```

### 3. Sincronización Manual (Históricos)

Para sincronizar llamadas históricasexiste un script bash:

```bash
# Sincronizar últimas 100 llamadas
cd /home/ubuntu/app/backend
./scripts/sync-calls.sh 100

# Sincronizar todas (en lotes de 100)
for i in {1..15}; do 
  ./scripts/sync-calls.sh 100
  sleep 1
done
```

También disponible vía API:

```bash
POST /api/consultations/elevenlabs/sync
{
  "limit": 100
}
```

## 📊 Endpoints Disponibles

### GET `/api/consultations/elevenlabs`

Obtiene llamadas con sistema híbrido.

**Query Parameters:**
- `page` (default: 1)
- `page_size` (default: 20)
- `search` - Buscar por ID o número de teléfono
- `date_filter` - Filtrar por fecha (YYYY-MM-DD)

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "conversation_id": "conv_123...",
      "status": "done",
      "caller_number": "+573001234567",
      "callee_number": "+576076916019",
      "started_at": "2025-10-29T14:30:00Z",
      "duration_seconds": 180,
      "transcript": "...",
      "summary": "..."
    }
  ],
  "stats": {
    "total_conversations": 1463,
    "from_api": 5,
    "from_database": 15
  }
}
```

### POST `/api/consultations/elevenlabs/sync`

Sincronización manual.

**Body:**
```json
{
  "limit": 100
}
```

### GET `/api/consultations/elevenlabs/sync/stats`

Estadísticas de sincronización.

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "total_calls": 1485,
    "by_status": [
      { "status": "done", "count": 1463 },
      { "status": "failed", "count": 22 }
    ],
    "recent_syncs": [...]
  }
}
```

## 🛠️ Mantenimiento

### Verificar Estado

```bash
# Llamadas en base de datos
mysql -h127.0.0.1 -ubiosanar_user -p'...' biosanar \
  -e "SELECT COUNT(*) FROM elevenlabs_calls"

# Últimas sincronizaciones
mysql -h127.0.0.1 -ubiosanar_user -p'...' biosanar \
  -e "SELECT * FROM elevenlabs_sync_log ORDER BY sync_started_at DESC LIMIT 10"
```

### Resincronizar Datos

Si hay inconsistencias:

```bash
cd /home/ubuntu/app/backend
./scripts/sync-calls.sh 500
```

### Verificar Webhooks

```bash
pm2 logs cita-central-backend | grep "ElevenLabs Webhook"
```

## 🚀 Ventajas del Sistema

1. **Velocidad**: La mayoría de consultas se sirven desde DB local (milisegundos vs segundos)
2. **Tiempo Real**: Siempre muestra las 5 llamadas más recientes desde la API
3. **Confiabilidad**: Datos persistentes en caso de problemas con la API de ElevenLabs
4. **Escalabilidad**: Soporta miles de llamadas sin degradación de rendimiento
5. **Búsqueda Rápida**: Índices en DB para búsquedas instantáneas
6. **Histórico Completo**: Mantiene registro de todas las llamadas

## 📝 Notas

- La API de ElevenLabs limita las peticiones a 100 registros por llamada
- Las sincronizaciones en background no bloquean las respuestas
- Los webhooks actualizan automáticamente cuando una llamada finaliza
- El sistema detecta y evita duplicados usando `conversation_id` único

## 🔧 Comandos NPM

```bash
# Sincronización inicial
npm run sync:initial 100

# Sincronización manual
npm run sync:calls 500
```

## 📅 Migración Aplicada

```bash
mysql -h127.0.0.1 -ubiosanar_user -p biosanar < migrations/20251030_create_elevenlabs_calls.sql
```

Fecha: 30 de octubre de 2025
Estado: ✅ Completado (1,485+ llamadas sincronizadas)
