# Integración de ElevenLabs para Llamadas Salientes

## Descripción

Este sistema permite realizar llamadas telefónicas salientes utilizando la API de ElevenLabs Conversational AI. Los agentes de voz pueden interactuar con pacientes de forma natural para confirmar citas, enviar recordatorios o realizar consultas médicas básicas.

## Configuración

### Variables de Entorno (.env)

```env
# ElevenLabs API Configuration
ELEVENLABS_API_KEY=sk_b84e47ff1c163497f95d3ff87b02743c2d303b3863beeeff
ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_WEBHOOK_URL=https://biosanarcall.site/api/webhooks/elevenlabs
ELEVENLABS_WEBHOOK_SECRET=wsec_10242422f757a3433ce3983064bd5d44f74ec516cc921e972ed1561cb896bdfa
ELEVENLABS_MAX_CALL_DURATION=600
SAVE_CALL_AUDIO=true
```

### Instalación de Base de Datos

```bash
cd /home/ubuntu/app/backend
./scripts/setup-elevenlabs-db.sh
```

Esto creará las siguientes tablas:
- `elevenlabs_conversations` - Registro de todas las llamadas
- `elevenlabs_transcriptions` - Transcripciones detalladas
- `elevenlabs_analysis` - Análisis de calidad de llamadas
- `elevenlabs_audio` - Almacenamiento de audio (opcional)
- `elevenlabs_call_errors` - Registro de errores

## Endpoints de API

### 1. Listar Agentes Disponibles

```bash
GET /api/elevenlabs/agents
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "agent_id": "agent_123",
      "name": "Valeria - Asistente Médica",
      "conversation_config": {...}
    }
  ],
  "count": 1
}
```

### 2. Iniciar Llamada

```bash
POST /api/elevenlabs/call
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "+573001234567",
  "patientId": 123,
  "patientName": "Juan Pérez",
  "appointmentId": 456,
  "agentId": "agent_123",
  "customVariables": {
    "appointment_date": "2025-10-27",
    "appointment_time": "10:00 AM",
    "doctor_name": "Dr. García"
  },
  "metadata": {
    "campaign": "appointment_confirmation",
    "priority": "high"
  }
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Llamada iniciada exitosamente",
  "data": {
    "success": true,
    "conversationId": "conv_abc123",
    "callId": "conv_abc123",
    "status": "initiated"
  }
}
```

### 3. Llamar a un Paciente por ID (Simplificado)

```bash
POST /api/elevenlabs/call-patient/123
Authorization: Bearer <token>
Content-Type: application/json

{
  "appointmentId": 456,
  "customVariables": {
    "appointment_date": "2025-10-27",
    "appointment_time": "10:00 AM"
  }
}
```

Este endpoint busca automáticamente el teléfono del paciente en la base de datos.

### 4. Consultar Estado de Conversación

```bash
GET /api/elevenlabs/conversation/{conversationId}
Authorization: Bearer <token>
```

### 5. Finalizar Llamada

```bash
DELETE /api/elevenlabs/conversation/{conversationId}
Authorization: Bearer <token>
```

### 6. Historial de Llamadas

```bash
GET /api/elevenlabs/calls?page=1&limit=20&patientId=123&status=completed
Authorization: Bearer <token>
```

**Parámetros:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Resultados por página (default: 20)
- `patientId` (opcional): Filtrar por paciente
- `status` (opcional): Filtrar por estado (initiated, completed, failed, etc.)

### 7. Estadísticas

```bash
GET /api/elevenlabs/stats?startDate=2025-10-01&endDate=2025-10-31
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "total_calls": 150,
    "completed_calls": 120,
    "failed_calls": 30,
    "avg_duration": 180.5,
    "total_cost": 25.50
  }
}
```

## Uso del Servicio en Código

### Importar el Servicio

```typescript
import { elevenLabsService } from './services/elevenLabsService';
```

### Ejemplo: Iniciar Llamada

```typescript
const result = await elevenLabsService.initiateCall({
  phoneNumber: '+573001234567',
  patientId: 123,
  patientName: 'Juan Pérez',
  appointmentId: 456,
  customVariables: {
    appointment_date: '2025-10-27',
    appointment_time: '10:00 AM',
    doctor_name: 'Dr. García'
  }
});

if (result.success) {
  console.log('Llamada iniciada:', result.conversationId);
} else {
  console.error('Error:', result.error);
}
```

### Ejemplo: Obtener Estadísticas

```typescript
const stats = await elevenLabsService.getCallStats({
  startDate: '2025-10-01',
  endDate: '2025-10-31',
  status: 'completed'
});

console.log('Total de llamadas:', stats.total_calls);
```

## Webhooks

El sistema está configurado para recibir webhooks de ElevenLabs en:

```
POST https://biosanarcall.site/api/webhooks/elevenlabs
```

Los webhooks se procesan automáticamente y actualizan:
- Estado de las conversaciones
- Transcripciones
- Análisis de calidad
- Audio (si está habilitado)

## Formatos de Número Telefónico

El servicio normaliza automáticamente los números telefónicos:

- `3001234567` → `+573001234567`
- `573001234567` → `+573001234567`
- `+57 300 123 4567` → `+573001234567`

Por defecto, asume código de país de Colombia (+57).

## Estados de Llamada

- `initiated` - Llamada iniciada
- `ringing` - Timbrando
- `in_progress` - En progreso
- `completed` - Completada exitosamente
- `failed` - Fallida
- `no_answer` - Sin respuesta
- `busy` - Ocupado
- `ended_manually` - Finalizada manualmente

## Seguridad

- Todas las rutas requieren autenticación JWT (`requireAuth` middleware)
- Los webhooks verifican firma HMAC para prevenir spoofing
- Las API keys nunca se exponen en respuestas
- Los números telefónicos se normalizan y validan

## Monitoreo

### Ver Llamadas Recientes

```sql
SELECT * FROM elevenlabs_recent_calls LIMIT 10;
```

### Ver Errores

```sql
SELECT * FROM elevenlabs_call_errors 
ORDER BY created_at DESC 
LIMIT 20;
```

### Ver Estadísticas del Día

```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(duration_secs) as avg_duration,
  SUM(cost) as total_cost
FROM elevenlabs_conversations
WHERE DATE(created_at) = CURDATE()
GROUP BY status;
```

## Integración con el Sistema Existente

El servicio se integra perfectamente con:

- **Sistema de Citas**: Llama automáticamente para confirmaciones
- **Sistema de Pacientes**: Busca pacientes por teléfono
- **Sistema de Notificaciones**: Envía recordatorios por voz
- **Sistema de Outbound**: Campañas de llamadas masivas

## Próximos Pasos

1. **Crear un agente en ElevenLabs**: Ve a https://elevenlabs.io/app/conversational-ai
2. **Configurar el agente**: Define el prompt, voz y comportamiento
3. **Copiar el Agent ID**: Pégalo en `ELEVENLABS_AGENT_ID` en el `.env`
4. **Configurar webhooks**: Apunta a `https://biosanarcall.site/api/webhooks/elevenlabs`
5. **Probar**: Usa los endpoints de API para iniciar tu primera llamada

## Soporte

Para más información sobre la API de ElevenLabs:
- Documentación: https://elevenlabs.io/docs/conversational-ai/overview
- Dashboard: https://elevenlabs.io/app/conversational-ai
