# 🤖 Biosanarcall WhatsApp Agent

Agente inteligente de WhatsApp para atención médica automatizada que integra Twilio, ChatGPT y el sistema MCP de Biosanarcall.

## 🌐 **Subdominio en Producción**
**URL**: `https://whatsapp.biosanarcall.site`

## ✨ Características

- 🩺 **Consultas médicas automatizadas** usando ChatGPT-4
- 📱 **Integración completa con WhatsApp** vía Twilio
- 🔗 **Conexión al servidor MCP** con 34 herramientas médicas
- 🚨 **Detección de emergencias** automática
- 📊 **Gestión de citas** y pacientes
- 🧠 **Memoria conversacional** persistente
- 📈 **Estadísticas en tiempo real**

## 🚀 Estado del Sistema

| Servicio | Estado | URL |
|----------|--------|-----|
| **Agente WhatsApp** | ✅ Online | `https://whatsapp.biosanarcall.site` |
| **Health Check** | ✅ Healthy | `https://whatsapp.biosanarcall.site/health` |
| **Servidor MCP** | ✅ 41 Tools | `http://localhost:8977/mcp-unified` |
| **ChatGPT Integration** | ✅ GPT-4 | Configurado |
| **Twilio WhatsApp** | ⚙️ Ready | Requiere configuración |

## 📋 Endpoints Disponibles

### 🔧 **Administrativos**
- `GET /` - Información del servicio
- `GET /health` - Health check del sistema
- `GET /stats` - Estadísticas de uso
- `GET /conversations` - Conversaciones activas (IP restringida)

### 📱 **WhatsApp Integration**
- `POST /webhook` - Webhook principal de Twilio

## 🛠️ Configuración Rápida

### 1. **Configurar Webhook en Twilio**
```bash
# Ejecutar script de configuración automática
./configure-twilio.sh
```

**O configurar manualmente:**
1. Ve a [Twilio WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/whatsapp/sandbox)
2. Configura:
   - **Webhook URL**: `https://whatsapp.biosanarcall.site/webhook`
   - **Método**: POST

### 2. **Probar la Integración**
1. Envía WhatsApp a: `+14155238886`
2. Mensaje de unión: `join nearby-explain`
3. Envía tu consulta médica

### 3. **Verificar Estado**
```bash
# Health check
curl https://whatsapp.biosanarcall.site/health

# Estadísticas
curl https://whatsapp.biosanarcall.site/stats

# Información completa
curl https://whatsapp.biosanarcall.site/
```

## 🔧 Gestión del Servicio

### **PM2 Commands**
```bash
# Ver estado
pm2 list

# Logs del agente
pm2 logs biosanarcall-whatsapp-agent

# Reiniciar
pm2 restart biosanarcall-whatsapp-agent

# Detener
pm2 stop biosanarcall-whatsapp-agent
```

### **Nginx Logs**
```bash
# Logs de acceso
sudo tail -f /var/log/nginx/whatsapp.biosanarcall.site.access.log

# Logs de errores
sudo tail -f /var/log/nginx/whatsapp.biosanarcall.site.error.log
```

## 🩺 Capacidades Médicas

### **Funciones Automáticas**
- ✅ Búsqueda de pacientes por documento/nombre
- ✅ Información de doctores y especialidades
- ✅ Consulta de disponibilidad de citas
- ✅ Agendamiento automático de citas
- ✅ Información de EPS y municipios
- ✅ Detección de urgencias médicas
- ✅ Resúmenes diarios de consultas

### **Integración MCP**
El agente utiliza **41 herramientas médicas** del servidor MCP unificado:
- Gestión de pacientes y doctores
- Sistema de citas y disponibilidad
- Memoria conversacional avanzada
- Análisis de consultas médicas
- Notificaciones y recordatorios

## 🔐 Seguridad Implementada

- 🔒 **HTTPS obligatorio** con certificado SSL
- 🛡️ **Headers de seguridad** completos
- 🚦 **Rate limiting** en webhooks
- 🔑 **Validación de Twilio signatures**
- 🏠 **Restricción de IP** para endpoints admin
- ⏱️ **Timeouts configurados** para respuestas

## 🎯 Configuración Avanzada

### **Variables de Entorno**
```env
# Twilio
TWILIO_ACCOUNT_SID=[your_twilio_account_sid]
TWILIO_AUTH_TOKEN=[your_twilio_auth_token]
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenAI
OPENAI_API_KEY=[your_openai_api_key]

# MCP Server
MCP_SERVER_URL=http://localhost:8977/mcp-unified

# Configuración
PORT=3001
NODE_ENV=production
MAX_CONVERSATION_LENGTH=50
RESPONSE_TIMEOUT=30000
```

### **Estructura del Proyecto**
```
agentewhatsapp/
├── src/
│   ├── server.ts              # Servidor principal
│   ├── services/
│   │   ├── WhatsAppAgent.ts   # Lógica del agente
│   │   ├── MCPClient.ts       # Cliente MCP
│   │   └── ConversationManager.ts
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   └── rateLimiter.ts
│   └── utils/
├── dist/                      # Código compilado
├── logs/                      # Logs del sistema
├── configure-twilio.sh        # Script de configuración
└── CONFIGURACION_SUBDOMINIO.md
```

## 📊 Monitoreo y Estadísticas

### **Métricas Disponibles**
```json
{
  "totalMessages": 0,
  "activeConversations": 0,
  "avgResponseTime": 0,
  "successRate": 0,
  "emergencyContacts": 0,
  "appointmentsScheduled": 0
}
```

### **Health Check**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-13T20:09:08.208Z",
  "uptime": 613.62,
  "memory": {...},
  "version": "v22.18.0"
}
```

## 🚨 Soporte y Troubleshooting

### **Problemas Comunes**

1. **Agente no responde**:
   ```bash
   pm2 restart biosanarcall-whatsapp-agent
   curl https://whatsapp.biosanarcall.site/health
   ```

2. **Error de webhook en Twilio**:
   - Verificar que la URL sea: `https://whatsapp.biosanarcall.site/webhook`
   - Método debe ser POST
   - Revisar logs: `pm2 logs biosanarcall-whatsapp-agent`

3. **Error de conexión MCP**:
   ```bash
   curl http://localhost:8977/mcp-unified
   ```

### **Contacto de Emergencia**
📞 **Teléfono**: +57321654987
🌐 **Sistema Principal**: https://biosanarcall.site
📧 **Soporte**: Ver logs del sistema

---

## 🎉 **¡El agente está listo para atender consultas médicas por WhatsApp!**

**Webhook URL para Twilio**: `https://whatsapp.biosanarcall.site/webhook`

## Arquitectura

### Componentes Principales

1. **WhatsAppAgent** - Procesador principal de mensajes
2. **MCPClient** - Cliente para comunicación con servidor MCP
3. **ConversationManager** - Gestión de estado de conversaciones
4. **MessageParser** - Análisis inteligente de mensajes
5. **ResponseGenerator** - Generación de respuestas contextuales

### Flujo de Procesamiento

```
WhatsApp → Twilio Webhook → Express Server → WhatsAppAgent
                                                    ↓
MessageParser ← OpenAI GPT-4 ← ResponseGenerator ← MCPClient
                                                    ↓
ConversationManager → WhatsApp Response → Twilio API
```

## Instalación

### Prerrequisitos

- Node.js 18+
- TypeScript
- Cuenta de Twilio configurada
- API Key de OpenAI
- Servidor MCP en funcionamiento

### Configuración

1. **Clonar e instalar dependencias:**
```bash
cd /home/ubuntu/app/agentewhatsapp
npm install
```

2. **Configurar variables de entorno (.env):**
```env
# Servidor
NODE_ENV=production
PORT=3001

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4

# MCP Server
MCP_SERVER_URL=http://localhost:8977/mcp-unified

# Logs
LOG_LEVEL=info
```

3. **Compilar TypeScript:**
```bash
npm run build
```

4. **Iniciar con PM2:**
```bash
pm2 start ecosystem.config.js --env production
```

## Funcionalidades

### Procesamiento de Mensajes

- **Análisis Inteligente**: Detección automática de intenciones (emergencia, cita, consulta)
- **Extracción de Entidades**: Síntomas, urgencia, fechas, datos del paciente
- **Clasificación por Urgencia**: Emergencia, alta, media, baja

### Respuestas Contextuales

- **Emergencias**: Protocolo automático de emergencia médica
- **Citas Médicas**: Agendamiento completo vía MCP
- **Consultas**: Respuestas médicas generadas por IA
- **Seguimiento**: Preguntas contextuales automáticas

### Integración MCP

El agente utiliza las siguientes herramientas del servidor MCP:

- `buscar_paciente` - Búsqueda de pacientes registrados
- `crear_paciente` - Registro de nuevos pacientes
- `agendar_cita` - Agendamiento de citas médicas
- `buscar_disponibilidad` - Consulta de horarios disponibles
- `consulta_sintomas` - Análisis de síntomas
- `recomendacion_medica` - Recomendaciones médicas automatizadas

### Gestión de Conversaciones

- **Estado Persistente**: Mantiene contexto de conversación
- **Memoria de Sesión**: Recuerda información del paciente
- **Historial**: Guarda intercambios para continuidad
- **Timeout**: Limpieza automática de sesiones inactivas

## Uso

### Configuración de Webhook en Twilio

1. Configurar webhook URL: `https://tu-dominio.com/webhook/whatsapp`
2. Método: POST
3. Eventos: Message Received

### Comandos Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar en modo desarrollo
npm run build        # Compilar TypeScript
npm run start        # Iniciar servidor compilado

# Producción
pm2 start ecosystem.config.js --env production
pm2 logs biosanarcall-whatsapp-agent
pm2 restart biosanarcall-whatsapp-agent
pm2 stop biosanarcall-whatsapp-agent
```

### Ejemplos de Interacción

**Emergencia:**
```
Usuario: "Tengo dolor en el pecho muy intenso"
Bot: "🚨 EMERGENCIA MÉDICA DETECTADA 🚨
Su situación requiere atención médica inmediata..."
```

**Agendar Cita:**
```
Usuario: "Necesito una cita con cardiólogo"
Bot: "📋 Agendamiento de Cita Médica
Para agendar su cita, necesito:
👤 Su nombre completo
🆔 Número de cédula..."
```

**Consulta Médica:**
```
Usuario: "Tengo fiebre y tos"
Bot: "🩺 Consulta Médica Virtual
He registrado los siguientes síntomas: fiebre, tos
Basándome en los síntomas que describe..."
```

## Monitoreo

### Logs

Los logs se almacenan en `/logs/` con los siguientes archivos:

- `error.log` - Solo errores
- `combined.log` - Todos los logs
- `pm2-error.log` - Errores de PM2
- `pm2-out.log` - Salida estándar de PM2

### Métricas

El sistema genera métricas automáticas para:

- Mensajes procesados por minuto
- Tiempo de respuesta promedio
- Errores por tipo
- Uso de herramientas MCP
- Conversaciones activas

### Health Check

Endpoint disponible en: `GET /health`

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "memory": {...},
  "services": {
    "mcp": "connected",
    "openai": "connected",
    "twilio": "connected"
  }
}
```

## Seguridad

### Rate Limiting

- **WhatsApp**: 30 mensajes/minuto por número
- **Emergencias**: 10 mensajes/minuto (más permisivo)
- **API**: 100 requests/15 minutos

### Validación

- Validación de webhooks de Twilio
- Sanitización de entrada de usuarios
- Validación de formato de números telefónicos
- Verificación de integridad de mensajes

### Manejo de Errores

- Manejo específico para errores de Twilio, OpenAI y MCP
- Respuestas de error amigables para usuarios
- Logging detallado para debugging
- Reintentos automáticos para fallos temporales

## Desarrollo

### Estructura del Proyecto

```
src/
├── services/           # Servicios principales
│   ├── WhatsAppAgent.ts
│   ├── MCPClient.ts
│   └── ConversationManager.ts
├── utils/             # Utilidades
│   ├── Logger.ts
│   ├── MessageParser.ts
│   └── ResponseGenerator.ts
├── middleware/        # Middleware de Express
│   ├── rateLimiter.ts
│   └── errorHandler.ts
└── server.ts         # Servidor principal
```

### Testing

```bash
# Instalar dependencias de desarrollo
npm install --save-dev jest @types/jest

# Ejecutar tests
npm test

# Test de cobertura
npm run test:coverage
```

### Contribuir

1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -am 'Añadir nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

## Troubleshooting

### Problemas Comunes

1. **Error de conexión MCP**: Verificar que el servidor MCP esté corriendo en puerto 8977
2. **Webhook de Twilio**: Verificar configuración de URL y certificados SSL
3. **Rate Limiting**: Ajustar límites en `rateLimiter.ts`
4. **Memoria**: Monitorear uso con PM2 y ajustar `max_memory_restart`

### Logs de Debug

```bash
# Ver logs en tiempo real
pm2 logs biosanarcall-whatsapp-agent --lines 100

# Ver solo errores
pm2 logs biosanarcall-whatsapp-agent --err

# Logs con timestamp
tail -f logs/combined.log
```

## Licencia

Propietario - BiosanarCall Medical System