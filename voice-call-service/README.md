# Voice Call Service - Sistema de Llamadas de Voz

Sistema de procesamiento de llamadas de voz para Biosanarcall que integra Zadarma, STT (OpenAI Whisper), TTS (ElevenLabs) y el agente de WhatsApp existente.

## Características

- **Integración Zadarma**: Recepción de webhooks y manejo de eventos de llamadas
- **STT (Speech-to-Text)**: Transcripción usando OpenAI Whisper
- **TTS (Text-to-Speech)**: Síntesis de voz usando ElevenLabs
- **Procesamiento Inteligente**: Reutiliza la lógica del agente de WhatsApp
- **Base de Datos**: Logging completo de llamadas y transcripciones
- **Sesiones**: Manejo de contexto durante llamadas activas

## Arquitectura

```
Zadarma (Llamada) → Webhook → Voice Handler → STT → WhatsApp Agent → TTS → Respuesta
                                    ↓
                              Base de Datos (Logs)
```

## Instalación

1. **Instalar dependencias**:
```bash
cd voice-call-service
npm install
```

2. **Configurar variables de entorno**:
```bash
cp .env.example .env
# Editar .env con las credenciales correctas
```

3. **Ejecutar migraciones de base de datos**:
```bash
mysql -u biosanar_user -p biosanar < migrations/001_create_voice_calls_tables.sql
```

4. **Compilar TypeScript**:
```bash
npm run build
```

5. **Iniciar en desarrollo**:
```bash
npm run dev
```

## Configuración

### Variables de Entorno Requeridas

```env
# Base de datos
DB_HOST=127.0.0.1
DB_USER=biosanar_user
DB_PASSWORD=tu_password
DB_NAME=biosanar

# OpenAI (STT)
OPENAI_API_KEY=sk-...

# ElevenLabs (TTS)
ELEVENLABS_API_KEY=tu_api_key
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB

# Zadarma
ZADARMA_API_KEY=tu_api_key
ZADARMA_API_SECRET=tu_secret

# Backend integration
BACKEND_BASE_URL=http://127.0.0.1:4000/api
BACKEND_TOKEN=jwt_token_aqui

# Servicio
PORT=3001
BASE_URL=https://biosanarcall.site
CORS_ORIGINS=https://biosanarcall.site
```

### Configuración de Zadarma

1. **Configurar webhook en panel de Zadarma**:
   - URL: `https://biosanarcall.site/webhook/zadarma`
   - Eventos: `NOTIFY_START`, `NOTIFY_END`, `NOTIFY_RECORD`

2. **Configurar DID (número entrante)**:
   - Asignar número DID para recibir llamadas
   - Habilitar grabación de llamadas
   - Configurar IVR si es necesario

## Estructura del Proyecto

```
voice-call-service/
├── src/
│   ├── types/           # Definiciones de tipos TypeScript
│   ├── services/        # Servicios principales
│   │   ├── STTService.ts          # Transcripción con OpenAI Whisper
│   │   ├── TTSService.ts          # Síntesis con ElevenLabs
│   │   ├── CallLogService.ts      # Logs en base de datos
│   │   ├── WhatsAppAgentService.ts # Integración con agente
│   │   └── VoiceCallHandler.ts    # Coordinador principal
│   └── server.ts        # Servidor Express con webhooks
├── migrations/          # Migraciones de base de datos
├── temp/               # Archivos temporales de audio
├── audio-output/       # Archivos de audio generados
├── logs/               # Logs del servicio
└── dist/               # Código JavaScript compilado
```

## API Endpoints

### Webhooks

- `POST /webhook/zadarma` - Webhook principal para eventos de Zadarma

### Consultas

- `GET /health` - Estado del servicio y validación de APIs
- `GET /stats?days=7` - Estadísticas de llamadas
- `GET /search?q=texto&limit=20` - Buscar en transcripciones
- `GET /session/:callId` - Información de sesión activa

### Archivos Estáticos

- `GET /audio/:filename` - Servir archivos de audio generados

## Flujo de Procesamiento

### 1. Recepción de Llamada
```
Zadarma → NOTIFY_START → Crear registro → Iniciar sesión
```

### 2. Procesamiento de Audio
```
Zadarma → NOTIFY_RECORD → Descargar grabación → STT (Whisper) → Transcript
```

### 3. Procesamiento Inteligente
```
Transcript → Extraer datos → WhatsApp Agent → Respuesta contextual
```

### 4. Generación de Respuesta
```
Respuesta → TTS (ElevenLabs) → Audio → Actualizar logs
```

### 5. Finalización
```
Zadarma → NOTIFY_END → Actualizar duración → Limpiar sesión
```

## Integración con WhatsApp Agent

El servicio reutiliza la lógica existente del agente de WhatsApp:

```typescript
// Procesar mensaje de voz como mensaje de WhatsApp
const agentResponse = await whatsappAgentService.processVoiceMessage(
  transcript,
  callerNumber,
  context
);

// Adaptar respuesta para voz (sin URLs, emojis, etc.)
const voiceResponse = whatsappAgentService.adaptResponseForVoice(agentResponse);
```

## Base de Datos

### Tabla Principal: `voice_calls`
- Registro completo de cada llamada
- Transcripción y respuesta del agente
- Relación con pacientes registrados
- Estado de procesamiento

### Tabla de Sesiones: `voice_call_sessions`
- Contexto temporal durante llamadas activas
- Historial de conversación
- Datos de paciente extraídos

### Métricas: `voice_quality_metrics`
- Confianza de transcripción
- Tiempos de procesamiento
- Calidad de audio

## Monitoreo y Logs

### Logs del Servicio
```bash
# Ver logs en tiempo real
pm2 logs voice-call-service

# Logs específicos
tail -f logs/voice-service.log
```

### Métricas de Salud
```bash
# Verificar estado del servicio
curl https://biosanarcall.site/health

# Estadísticas de llamadas (últimos 7 días)
curl https://biosanarcall.site/stats?days=7
```

### Búsqueda en Transcripciones
```bash
# Buscar llamadas por contenido
curl "https://biosanarcall.site/search?q=cita cardiología&limit=10"
```

## Despliegue en Producción

### 1. Compilar y Configurar
```bash
npm run build
pm2 start ecosystem.config.js
```

### 2. Configurar Nginx
```nginx
# Agregar al archivo nginx-biosanarcall.conf
location /webhook/zadarma {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /audio/ {
    proxy_pass http://127.0.0.1:3001;
}
```

### 3. Configurar SSL
El webhook de Zadarma requiere HTTPS. Asegurar que el certificado SSL esté configurado.

### 4. Monitoreo
```bash
# Verificar estado
pm2 status voice-call-service

# Reiniciar si es necesario
pm2 restart voice-call-service

# Ver métricas
pm2 monit
```

## Mantenimiento

### Limpieza Automática
- Archivos de audio temporales: cada 24 horas
- Registros antiguos: cada 90 días (configurable)
- Sesiones expiradas: cada 10 minutos

### Backup de Audio
```bash
# Respaldar archivos de audio importantes
rsync -av ./audio-output/ /backup/voice-audio/
```

### Rotación de Logs
```bash
# Configurar logrotate para logs del servicio
sudo logrotate -f /etc/logrotate.d/voice-service
```

## Troubleshooting

### Problemas Comunes

1. **Error de conexión con Zadarma**:
   - Verificar credenciales en `.env`
   - Comprobar configuración de webhook

2. **Falla en transcripción (STT)**:
   - Verificar API key de OpenAI
   - Comprobar formato de audio soportado

3. **Error en síntesis de voz (TTS)**:
   - Verificar API key de ElevenLabs
   - Comprobar límites de caracteres

4. **Base de datos desconectada**:
   - Verificar credenciales MySQL
   - Ejecutar migración si es necesario

### Logs de Debug
```bash
# Habilitar logs detallados
NODE_ENV=development npm run dev

# Ver logs específicos de servicios
grep "STT" logs/voice-service.log
grep "TTS" logs/voice-service.log
grep "WhatsApp Agent" logs/voice-service.log
```

## Desarrollo

### Ejecutar en Modo Desarrollo
```bash
npm run dev
# Servidor con recarga automática en puerto 3001
```

### Testing Manual
```bash
# Simular webhook de Zadarma
curl -X POST http://localhost:3001/webhook/zadarma \
  -H "Content-Type: application/json" \
  -d '{
    "event": "NOTIFY_START",
    "pbx_call_id": "test123",
    "caller_id": "+584263774021",
    "called_did": "+12345678900",
    "call_start": "2024-12-19 10:30:00"
  }'
```

### Agregar Nuevas Funcionalidades
1. Definir tipos en `src/types/`
2. Implementar servicio en `src/services/`
3. Integrar en `VoiceCallHandler`
4. Actualizar endpoints en `server.ts`
5. Documentar en README

## Licencia

Proyecto privado - Biosanarcall Medical System