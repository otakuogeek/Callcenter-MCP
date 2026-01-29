# 📱 Informe Detallado del Sistema WhatsApp - Biosanar IPS

**Última actualización:** Diciembre 15, 2025  
**URL Dashboard:** https://biosanarcall.site/admin/whatsapp  
**Estado actual:** ✅ Conectado y Operativo

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes Principales](#componentes-principales)
4. [Configuración del Bot](#configuración-del-bot)
5. [Flujo de Mensajes](#flujo-de-mensajes)
6. [APIs y Endpoints](#apis-y-endpoints)
7. [Base de Datos](#base-de-datos)
8. [Configuración de PM2](#configuración-de-pm2)
9. [Integración con MCP](#integración-con-mcp)
10. [Transcripción de Audio](#transcripción-de-audio)
11. [Inicio Automático](#inicio-automático)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 Resumen Ejecutivo

El sistema WhatsApp de Biosanar IPS es un bot conversacional que permite a los pacientes:
- Agendar citas médicas
- Consultar disponibilidad de especialidades
- Registrarse como nuevos pacientes
- Consultar información de la IPS

### Estado Actual
```
✅ Conectado: Sí
📞 Teléfono vinculado: +57 311 458 9580
🤖 Proveedor IA: DeepSeek (deepseek-chat)
⚡ Auto-respuesta: Activada
🕐 Horario comercial: 07:00 - 18:00
```

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React + TypeScript + shadcn/ui                                 │
│  /admin/whatsapp → WhatsAppDashboard.tsx                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX REVERSE PROXY                         │
│  biosanarcall.site → localhost:4000                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                  │
│  PM2: cita-central-backend (puerto 4000)                        │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│  │ WhatsApp Routes │  │ WhatsAppConnection│  │ WhatsAppAI    │   │
│  │ /api/whatsapp/* │→ │ @whiskeysockets/ │→ │ Service       │   │
│  │                 │  │ baileys          │  │ (Valeria Bot) │   │
│  └─────────────────┘  └─────────────────┘  └────────────────┘   │
│                                                   │              │
│                                                   ▼              │
│                              ┌──────────────────────────────┐   │
│                              │ MCP Tools Client             │   │
│                              │ - searchPatient              │   │
│                              │ - scheduleAppointment        │   │
│                              │ - getAvailableAppointments   │   │
│                              │ - registerPatientSimple      │   │
│                              └──────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MySQL (biosanar)                          │
│  Tablas: wa_messages, wa_conversations, wa_sessions             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes Principales

### 1. WhatsAppConnection.ts
**Ubicación:** `/backend/src/services/WhatsAppConnection.ts`

Servicio principal que maneja la conexión a WhatsApp usando Baileys.

```typescript
// Funciones exportadas
export async function startConnection()     // Iniciar conexión
export async function disconnect()          // Desconectar
export async function sendMessage(to, msg)  // Enviar mensaje
export function getStatus()                 // Obtener estado
```

**Características:**
- Genera código QR para vincular teléfono
- Reconexión automática (máximo 5 intentos)
- Almacenamiento de credenciales en `/backend/.whatsapp-auth/`
- Eventos: `qr`, `connected`, `message`, `logout`

### 2. WhatsAppAIService.ts
**Ubicación:** `/backend/src/services/WhatsAppAIService.ts`

Bot conversacional "Valeria" usando DeepSeek AI.

```typescript
// Función principal
export async function processMessage(
  message: string, 
  phoneNumber: string, 
  history: Array<{role: string, content: string}>
): Promise<{success: boolean, response: string}>
```

**Flujo del Bot:**
1. Saluda y pide cédula
2. Busca paciente en el sistema
3. Si no existe, registra nuevo paciente
4. Consulta disponibilidad de citas
5. Agenda cita o agrega a lista de espera

### 3. AudioTranscriptionService.ts
**Ubicación:** `/backend/src/services/AudioTranscriptionService.ts`

Transcribe mensajes de voz a texto usando OpenAI Whisper.

```typescript
export async function transcribeAudio(
  audioBuffer: Buffer, 
  mimeType: string
): Promise<{success: boolean, text?: string}>
```

**Formatos soportados:**
- OGG (nativo WhatsApp)
- MP3, M4A, WAV, WebM

### 4. Rutas API
**Ubicación:** `/backend/src/routes/whatsapp.ts`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/status` | Estado de conexión |
| GET | `/qr` | Código QR para vincular |
| POST | `/connect` | Iniciar conexión |
| POST | `/disconnect` | Cerrar sesión |
| GET | `/conversations` | Lista de conversaciones |
| GET | `/conversations/:phone` | Mensajes de una conversación |
| POST | `/messages/send` | Enviar mensaje |
| GET | `/analytics` | Estadísticas |
| GET | `/config` | Configuración del bot |
| POST | `/chat/test` | Probar chat con IA |

---

## ⚙️ Configuración del Bot

### Variables de Entorno (.env)

```bash
# --- WhatsApp Bot Configuration ---
# Proveedor de IA
DEEPSEEK_API_KEY=sk-a021d3f21d4c4472b01f2ea863e0b808
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# Configuración del Bot
WHATSAPP_AI_PROVIDER=deepseek           # Proveedor: deepseek
WHATSAPP_AI_MODEL=deepseek-chat         # Modelo a usar
WHATSAPP_AUTO_REPLY=true                # Respuestas automáticas
WHATSAPP_BUSINESS_HOURS_ONLY=true       # Solo horario comercial
WHATSAPP_BUSINESS_HOURS_START=07:00     # Inicio horario
WHATSAPP_BUSINESS_HOURS_END=18:00       # Fin horario
WHATSAPP_WELCOME_MESSAGE=Bienvenido a Biosanar IPS...
WHATSAPP_AWAY_MESSAGE=Gracias por contactarnos...
WHATSAPP_MAX_CONV_LENGTH=50             # Máx mensajes en historial
WHATSAPP_SESSION_TIMEOUT=3600000        # Timeout sesión (1 hora)

# Para transcripción de audio
OPENAI_API_KEY=sk-proj-G-Tjvnpg...      # API OpenAI Whisper
```

### Directorio de Credenciales

```
/home/ubuntu/app/backend/.whatsapp-auth/
├── creds.json              # Credenciales de sesión
├── app-state-sync-key-*.json
├── pre-key-*.json
├── sender-key-*.json
└── session-*.json
```

**⚠️ IMPORTANTE:** No borrar este directorio. Contiene las credenciales de autenticación. Si se borra, se requiere escanear QR nuevamente.

---

## 🔄 Flujo de Mensajes

### Mensaje Entrante (Texto)

```
Usuario envía mensaje
        │
        ▼
WhatsAppConnection.handleIncomingMessage()
        │
        ├── Extrae texto del mensaje
        │
        ├── Guarda en BD (wa_messages)
        │
        ├── Si WHATSAPP_AUTO_REPLY=true
        │         │
        │         ▼
        │   WhatsAppAIService.processMessage()
        │         │
        │         ├── Consulta historial de conversación
        │         │
        │         ├── Envía a DeepSeek con system prompt
        │         │
        │         ├── Si requiere herramienta MCP
        │         │         │
        │         │         ▼
        │         │   MCPToolsClient.callTool()
        │         │
        │         ▼
        │   Genera respuesta
        │
        ▼
WhatsAppConnection.sendMessage()
        │
        ▼
Guarda respuesta en BD
```

### Mensaje Entrante (Audio)

```
Usuario envía mensaje de voz
        │
        ▼
WhatsAppConnection.handleIncomingMessage()
        │
        ├── Detecta audioMessage
        │
        ├── downloadMediaMessage() - Descarga audio
        │
        ├── AudioTranscriptionService.transcribeAudio()
        │         │
        │         ├── Crea archivo temporal
        │         │
        │         ├── Envía a OpenAI Whisper
        │         │
        │         ▼
        │   Retorna texto transcrito
        │
        ├── Guarda en BD con prefijo 🎤
        │
        ▼
Continúa flujo normal con texto transcrito
```

---

## 🌐 APIs y Endpoints

### Obtener Estado
```bash
GET /api/whatsapp/status

# Respuesta
{
  "success": true,
  "data": {
    "connected": true,
    "status": "connected",
    "session": {
      "id": "session_1765479448698",
      "phone": "573114589580",
      "lastActivity": "2025-12-15T01:47:40.726Z"
    },
    "config": {
      "aiProvider": "deepseek",
      "aiModel": "deepseek-chat",
      "autoReply": true,
      "businessHoursOnly": true
    }
  }
}
```

### Iniciar Conexión
```bash
POST /api/whatsapp/connect

# Respuesta (si necesita QR)
{
  "success": true,
  "message": "QR generado, esperando escaneo",
  "qrCode": "data:image/png;base64,..."
}
```

### Enviar Mensaje
```bash
POST /api/whatsapp/messages/send
Content-Type: application/json

{
  "to": "573001234567",
  "message": "Hola, este es un mensaje de prueba"
}
```

### Listar Conversaciones
```bash
GET /api/whatsapp/conversations

# Respuesta
{
  "success": true,
  "data": [
    {
      "id": 52,
      "phone_number": "573001234567",
      "last_message": "Gracias por su cita",
      "last_activity": "2025-12-15T10:30:00Z",
      "message_count": 15
    }
  ]
}
```

---

## 🗄️ Base de Datos

### Tablas WhatsApp

#### wa_sessions
```sql
CREATE TABLE wa_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(100) UNIQUE,
  phone_number VARCHAR(20),
  status ENUM('active', 'inactive', 'expired'),
  auth_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### wa_conversations
```sql
CREATE TABLE wa_conversations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(100),
  phone_number VARCHAR(50),
  patient_id INT,
  context JSON,
  last_message TEXT,
  last_activity TIMESTAMP,
  status ENUM('active', 'closed'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### wa_messages
```sql
CREATE TABLE wa_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(100),
  message_id VARCHAR(100),
  from_number VARCHAR(50),
  to_number VARCHAR(50),
  body TEXT,
  media_url VARCHAR(500),
  media_type VARCHAR(50),
  direction ENUM('inbound', 'outbound'),
  status ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
  ai_response TEXT,
  ai_model VARCHAR(50),
  response_time_ms INT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 🚀 Configuración de PM2

### ecosystem.config.js

```javascript
module.exports = {
  apps: [
    {
      name: 'cita-central-backend',
      cwd: __dirname,
      script: 'dist/src/server.js',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '0.0.0.0'
      },
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      max_memory_restart: '300M',
    },
  ],
};
```

### Comandos PM2 Útiles

```bash
# Ver estado
pm2 list

# Ver logs
pm2 logs cita-central-backend

# Reiniciar
pm2 restart cita-central-backend

# Detener
pm2 stop cita-central-backend

# Iniciar
pm2 start ecosystem.config.js

# Guardar configuración (para inicio automático)
pm2 save

# Configurar inicio en boot
pm2 startup
```

---

## 🔗 Integración con MCP

El bot usa el servidor MCP (Model Context Protocol) para ejecutar operaciones en el sistema.

### Servidor MCP
- **Puerto:** 8977
- **Proceso:** `mcp-unified` (PM2)

### Herramientas Disponibles

| Herramienta | Descripción |
|-------------|-------------|
| `searchPatient` | Buscar paciente por documento |
| `registerPatientSimple` | Registrar nuevo paciente |
| `listActiveEPS` | Listar EPS activas |
| `listZones` | Listar zonas geográficas |
| `getEPSServices` | Servicios de una EPS |
| `getPatientAppointments` | Citas de un paciente |
| `getAvailableAppointments` | Disponibilidad de citas |
| `scheduleAppointment` | Agendar cita |
| `addToWaitingList` | Agregar a lista de espera |
| `searchCups` | Buscar código CUPS |
| `actualizarPhone` | Actualizar teléfono |

### Configuración MCP Client

```typescript
// /backend/src/services/MCPToolsClient.ts
const MCP_SERVER_URL = 'http://127.0.0.1:8977';

async function callTool(toolName: string, params: object) {
  const response = await axios.post(MCP_SERVER_URL, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: params }
  });
  return response.data.result;
}
```

---

## 🎙️ Transcripción de Audio

### Configuración

```bash
# .env
OPENAI_API_KEY=sk-proj-G-TjvnpgW-2F-3oX0Wzob...
```

### Flujo de Transcripción

1. **Detección:** Sistema detecta `audioMessage` en el mensaje
2. **Descarga:** Usa `downloadMediaMessage()` de Baileys
3. **Archivo temporal:** Guarda en `/tmp/whatsapp-audio/`
4. **Transcripción:** Envía a OpenAI Whisper API
5. **Limpieza:** Elimina archivo temporal
6. **Procesamiento:** Usa texto transcrito para responder

### Formatos Soportados
- OGG (códec opus) - Nativo WhatsApp
- MP3, M4A, WAV, WebM

### Identificación en BD
Los mensajes de audio se guardan con prefijo 🎤:
```
🎤 Hola necesito una cita para mañana
```

---

## 🔄 Inicio Automático

### Configuración para que el sistema inicie automáticamente

#### 1. PM2 Startup (Recomendado)

```bash
# Generar script de inicio
pm2 startup

# Seguir las instrucciones que muestra
# Ejemplo: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Guardar lista actual de procesos
pm2 save
```

#### 2. Verificar Configuración

```bash
# Ver procesos guardados
pm2 resurrect

# Verificar que WhatsApp se conecta al iniciar
pm2 logs cita-central-backend --lines 50
```

#### 3. Script de Inicio Personalizado

Si necesitas un script adicional, crear `/home/ubuntu/app/start-whatsapp.sh`:

```bash
#!/bin/bash

# Esperar a que el backend esté listo
sleep 10

# Llamar al endpoint de conexión
curl -X POST http://127.0.0.1:4000/api/whatsapp/connect \
  -H "Content-Type: application/json"

echo "WhatsApp connection initiated"
```

Y agregarlo al crontab:
```bash
crontab -e

# Agregar línea:
@reboot /home/ubuntu/app/start-whatsapp.sh >> /var/log/whatsapp-init.log 2>&1
```

### Reconexión Automática

El sistema tiene reconexión automática incorporada:

```typescript
// WhatsAppConnection.ts
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;

// Si la conexión se pierde, intenta reconectar hasta 5 veces
if (shouldReconnect && connectionState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
  connectionState.reconnectAttempts++;
  setTimeout(() => connectToWhatsApp(), RECONNECT_DELAY_MS);
}
```

---

## 🔧 Troubleshooting

### Problema: WhatsApp no conecta

```bash
# 1. Verificar que el backend esté corriendo
pm2 list

# 2. Ver logs de error
pm2 logs cita-central-backend --err

# 3. Reiniciar el servicio
pm2 restart cita-central-backend

# 4. Verificar estado
curl http://127.0.0.1:4000/api/whatsapp/status | jq
```

### Problema: Necesito escanear QR nuevamente

```bash
# 1. Desconectar sesión actual
curl -X POST http://127.0.0.1:4000/api/whatsapp/disconnect

# 2. Limpiar credenciales (opcional, solo si hay problemas)
rm -rf /home/ubuntu/app/backend/.whatsapp-auth/*

# 3. Reiniciar
pm2 restart cita-central-backend

# 4. Ir al dashboard y escanear nuevo QR
# https://biosanarcall.site/admin/whatsapp
```

### Problema: Mensajes de audio no se transcriben

```bash
# 1. Verificar API key de OpenAI
grep OPENAI_API_KEY /home/ubuntu/app/backend/.env

# 2. Probar conexión a Whisper
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[] | select(.id | contains("whisper"))'

# 3. Ver logs de transcripción
pm2 logs cita-central-backend | grep "Transcription"
```

### Problema: Bot no responde

```bash
# 1. Verificar que auto-reply esté activo
curl http://127.0.0.1:4000/api/whatsapp/config | jq '.data.autoReply'

# 2. Verificar API de DeepSeek
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" | jq

# 3. Probar chat manualmente
curl -X POST http://127.0.0.1:4000/api/whatsapp/chat/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola", "history": []}'
```

### Problema: Error de base de datos

```bash
# 1. Verificar conexión MySQL
mysql -u biosanar_user -p biosanar -e "SELECT 1"

# 2. Verificar tablas WhatsApp
mysql -u biosanar_user -p biosanar -e "SHOW TABLES LIKE 'wa_%'"

# 3. Recrear tablas si es necesario
cd /home/ubuntu/app/backend
npm run db:init
```

---

## 📊 Métricas y Monitoreo

### Endpoint de Analytics

```bash
GET /api/whatsapp/analytics

{
  "success": true,
  "data": {
    "todayMessages": 45,
    "inboundMessages": 28,
    "outboundMessages": 17,
    "aiResponses": 17,
    "failedMessages": 0,
    "activeConversations": 5,
    "avgResponseTime": 2300
  }
}
```

### Logs Importantes

```bash
# Logs del backend
tail -f /home/ubuntu/app/backend/logs/out.log

# Buscar eventos de WhatsApp
grep "WhatsApp" /home/ubuntu/app/backend/logs/out.log | tail -50

# Buscar errores
grep -i "error" /home/ubuntu/app/backend/logs/error.log | tail -20
```

---

## 📝 Resumen de Archivos

| Archivo | Descripción |
|---------|-------------|
| `/backend/src/services/WhatsAppConnection.ts` | Conexión principal a WhatsApp |
| `/backend/src/services/WhatsAppAIService.ts` | Bot de IA "Valeria" |
| `/backend/src/services/AudioTranscriptionService.ts` | Transcripción de audio |
| `/backend/src/services/MCPToolsClient.ts` | Cliente para herramientas MCP |
| `/backend/src/routes/whatsapp.ts` | Rutas API de WhatsApp |
| `/backend/.whatsapp-auth/` | Credenciales de sesión |
| `/backend/.env` | Variables de entorno |
| `/backend/ecosystem.config.js` | Configuración PM2 |
| `/frontend/src/pages/WhatsAppDashboard.tsx` | Dashboard de administración |

---

## ✅ Checklist de Verificación

- [ ] PM2 corriendo: `pm2 list`
- [ ] Backend respondiendo: `curl http://127.0.0.1:4000/api/whatsapp/status`
- [ ] WhatsApp conectado: `connected: true` en status
- [ ] Auto-reply activo: `autoReply: true` en config
- [ ] MCP server corriendo: `pm2 list | grep mcp-unified`
- [ ] Credenciales guardadas: `ls /home/ubuntu/app/backend/.whatsapp-auth/`
- [ ] Dashboard accesible: https://biosanarcall.site/admin/whatsapp

---

**Documento generado automáticamente**  
**Sistema:** Biosanar IPS - Callcenter MCP  
**Versión Backend:** 0.1.0
