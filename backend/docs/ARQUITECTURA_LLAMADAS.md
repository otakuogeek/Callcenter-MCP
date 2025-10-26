# 📞 Arquitectura del Sistema de Llamadas - Biosanarcall

## 🎯 Sistemas de Comunicación

Tu infraestructura de comunicación está dividida en **2 sistemas independientes**:

### 1️⃣ Llamadas de Voz (Backend Principal)
**NO usa Twilio** - Sistema propio con ElevenLabs + Zadarma

```
┌─────────────────┐
│   ElevenLabs    │  ← Generación de audio TTS + Agentes conversacionales
│  (Voz + AI)     │
└────────┬────────┘
         │ Audio MP3
         ↓
┌─────────────────┐
│    Zadarma      │  ← Telefonía VoIP (realizar llamadas)
│   (Telefonía)   │
└────────┬────────┘
         │ Llamada física
         ↓
    📞 Cliente
```

**Servicios:**
- `/backend/src/services/elevenLabsService.ts` - Generación de audio
- `/backend/src/services/zadarma-sms.service.ts` - Telefonía VoIP
- **Base de datos**: `elevenlabs_*` tables

**Casos de uso:**
- ✅ Recordatorios de citas
- ✅ Confirmaciones automáticas
- ✅ Notificaciones médicas
- ✅ Llamadas salientes programadas

### 2️⃣ WhatsApp (AgenteWhatsApp)
**SÍ usa Twilio** - Solo para mensajería de WhatsApp

```
┌─────────────────┐
│  Twilio API     │  ← Mensajería de WhatsApp únicamente
│  (WhatsApp)     │
└────────┬────────┘
         │ Mensajes
         ↓
┌─────────────────┐
│ WhatsApp Agent  │  ← ChatGPT + MCP para respuestas inteligentes
│   (ChatBot)     │
└─────────────────┘
```

**Servicios:**
- `/agentewhatsapp/src/services/WhatsAppAgent.ts`
- **Twilio usado SOLO para**: Enviar/recibir mensajes de WhatsApp
- **NO se usa para**: Llamadas de voz

**Casos de uso:**
- ✅ Chat de WhatsApp con pacientes
- ✅ Agendamiento conversacional
- ✅ Consultas automáticas
- ✅ Respuestas inteligentes con IA

---

## 🔧 Configuración por Sistema

### Backend Principal (Llamadas de Voz)

**Variables en `/backend/.env`:**

```env
# ElevenLabs (Generación de audio + Agentes IA)
ELEVENLABS_API_KEY=sk_b84e47ff1c163497f95d3ff87b02743c2d303b3863beeeff
ELEVENLABS_AGENT_ID=agent_8901k8gnmjehfpx8wd5y0spkyxxp
ELEVENLABS_PHONE_NUMBER=+576076916019
ELEVENLABS_SIP_SERVER=sip:sip.rtc.elevenlabs.io:5060

# Zadarma (Telefonía VoIP)
ZADARMA_USER_KEY=524494-100
ZADARMA_SECRET_KEY=Ub4jdrUl24
ZADARMA_PBX_ID=100

# ❌ NO HAY VARIABLES DE TWILIO AQUÍ
```

**Endpoints del backend:**
- `POST /api/elevenlabs/call` - Llamada con agente conversacional
- `POST /api/elevenlabs/call-direct` - Llamada con TTS (sin agente)
- `POST /api/elevenlabs/call-patient/:id` - Llamada a paciente específico

### AgenteWhatsApp

**Variables en `/agentewhatsapp/.env`:**

```env
# Twilio (SOLO para WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# ❌ NO se usa TWILIO_PHONE_NUMBER para llamadas de voz
```

---

## 🚀 Flujo de Llamadas Salientes (ElevenLabs + Zadarma)

### Flujo Completo

```typescript
// 1. BACKEND: Generar audio con ElevenLabs
const audioResult = await elevenLabsService.initiateCall({
  phoneNumber: '+584264377421',
  message: 'Recordatorio de su cita médica...',
  directCall: true  // Usa TTS sin agente
});

// 2. BACKEND: Obtener el audio generado
const audioUrl = audioResult.data.audioUrl;
const audioBuffer = audioResult.data.audioBuffer;

// 3. ZADARMA: Iniciar llamada telefónica
const zadarmaCall = await zadarmaService.initiateCall({
  phoneNumber: '+584264377421',
  audioUrl: audioUrl  // Reproducir el audio de ElevenLabs
});

// 4. RESULTADO: Llamada completada con audio de alta calidad
```

### Tipos de Llamadas Disponibles

#### A) Llamada con Agente Conversacional (Requiere plan empresarial)

```typescript
await elevenLabsService.initiateCall({
  phoneNumber: '+584264377421',
  directCall: false,  // Usa agente de IA
  agentId: 'agent_8901k8gnmjehfpx8wd5y0spkyxxp'
});
```

**Características:**
- ✅ Conversación bidireccional inteligente
- ✅ Responde a preguntas del paciente
- ✅ Puede agendar/reprogramar citas
- ❌ Requiere plan empresarial de ElevenLabs
- 💰 Costo: ~$0.15-0.30 USD por minuto

#### B) Llamada Directa con TTS (Funciona ahora mismo)

```typescript
await elevenLabsService.initiateCall({
  phoneNumber: '+584264377421',
  message: 'Su cita es mañana a las 10 AM',
  directCall: true  // Solo TTS, sin agente
});
```

**Características:**
- ✅ Mensaje pregrabado de alta calidad
- ✅ Funciona con plan básico de ElevenLabs
- ✅ Perfecto para recordatorios/notificaciones
- ❌ No responde a preguntas
- 💰 Costo: ~$0.006 USD por mensaje

---

## 📊 Comparación: ElevenLabs vs Twilio

| Aspecto | ElevenLabs + Zadarma | Twilio |
|---------|---------------------|--------|
| **Uso en tu sistema** | ✅ Llamadas de voz | ❌ NO (solo WhatsApp) |
| **Calidad de voz** | ⭐⭐⭐⭐⭐ Ultra realista | ⭐⭐⭐ Sintética |
| **IA Conversacional** | ✅ Nativa | ⚠️ Requiere integración externa |
| **Costo por minuto** | $0.15-0.30 | $0.013-0.065 |
| **Costo TTS** | $0.00003/char | $0.04/1000 chars |
| **Voces en español** | ✅ Excelentes | ✅ Buenas |
| **SIP Integration** | ✅ Nativo | ✅ Disponible |
| **WhatsApp** | ❌ No disponible | ✅ En tu `agentewhatsapp` |

---

## 🎭 Separación de Responsabilidades

### ❌ Twilio NO se usa para:
- Llamadas de voz salientes
- Confirmaciones telefónicas automáticas
- Recordatorios por llamada
- Sistema de IVR (Respuesta de Voz Interactiva)

### ✅ Twilio SÍ se usa para:
- Mensajería de WhatsApp (enviar/recibir)
- Chat automatizado con pacientes
- Agendamiento conversacional por WhatsApp

### ✅ ElevenLabs se usa para:
- Generación de audio TTS de alta calidad
- Agentes conversacionales de IA
- Voces ultra-realistas en español

### ✅ Zadarma se usa para:
- Telefonía VoIP (iniciar llamadas físicas)
- Reproducir audio generado por ElevenLabs
- SMS (sistema secundario)

---

## 🔗 Integración Actual

### Estado de Implementación

| Componente | Estado | Descripción |
|-----------|--------|-------------|
| ElevenLabs Service | ✅ **Completo** | Generación de audio TTS |
| Zadarma Service | ✅ **Existente** | Sistema de telefonía VoIP |
| Base de datos | ✅ **Creada** | Tablas `elevenlabs_*` |
| API Endpoints | ✅ **Funcionando** | `/api/elevenlabs/*` |
| Audio TTS | ✅ **Probado** | 304KB MP3 generado |
| Integración Zadarma | ⏳ **Pendiente** | Conectar audio → llamada |

### Próximos Pasos

1. **Crear servicio de integración** ElevenLabs ↔ Zadarma
2. **Probar llamada completa** a +584264377421
3. **Automatizar recordatorios** diarios de citas
4. **Dashboard de monitoreo** de llamadas

---

## 📝 Ejemplo Completo de Uso

### Recordatorio Automático de Cita

```typescript
import { elevenLabsService } from '../services/elevenLabsService';
import { zadarmaService } from '../services/zadarma-sms.service';

async function sendAppointmentReminder(appointmentId: number) {
  // 1. Obtener datos de la cita
  const appointment = await db.query(
    'SELECT * FROM appointments WHERE id = ?',
    [appointmentId]
  );
  
  // 2. Generar mensaje personalizado
  const message = `
    Hola ${appointment.patient_name}.
    Le recordamos su cita médica para mañana
    ${appointment.date} a las ${appointment.time}
    con ${appointment.doctor_name}
    en nuestra sede ${appointment.location}.
    Para confirmar, presione 1.
    Para reprogramar, presione 2.
    Gracias.
  `.trim();
  
  // 3. Generar audio con ElevenLabs (TTS de alta calidad)
  const audioResult = await elevenLabsService.initiateCall({
    phoneNumber: appointment.patient_phone,
    message,
    directCall: true,  // Sin agente, solo TTS
    patientId: appointment.patient_id,
    appointmentId: appointment.id
  });
  
  if (!audioResult.success) {
    console.error('Error generando audio:', audioResult.error);
    return;
  }
  
  // 4. Iniciar llamada con Zadarma y reproducir el audio
  const callResult = await zadarmaService.initiateCallWithAudio({
    phoneNumber: appointment.patient_phone,
    audioUrl: audioResult.data.audioUrl,
    callbackUrl: 'https://biosanarcall.site/api/webhooks/zadarma-callback'
  });
  
  // 5. Registrar resultado
  console.log('✅ Llamada de recordatorio enviada:', callResult.callId);
  
  return {
    conversationId: audioResult.conversationId,
    callId: callResult.callId,
    status: 'sent'
  };
}
```

---

## ⚠️ Importante

### Clarificación de Sistemas

- **Tu sistema NUNCA usa Twilio para llamadas de voz**
- **Twilio solo está en `/agentewhatsapp/` para WhatsApp**
- **Las llamadas salientes usan ElevenLabs + Zadarma**
- **NO hay confusión de proveedores**

### Ventajas de tu Arquitectura

1. **Separación clara**: Voz (ElevenLabs+Zadarma) vs WhatsApp (Twilio)
2. **Mejor calidad**: Voces ultra-realistas de ElevenLabs
3. **Costo optimizado**: TTS a $0.006 por mensaje vs $0.30+ por llamada
4. **Escalabilidad**: Sistemas independientes, fácil de mantener

---

**Última actualización**: 26 de Octubre, 2025  
**Sistema principal de voz**: ElevenLabs + Zadarma  
**WhatsApp**: Twilio (solo mensajería)  
**Twilio para llamadas**: ❌ NO se usa
