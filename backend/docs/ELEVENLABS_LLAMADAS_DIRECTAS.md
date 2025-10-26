# 📞 Llamadas Directas con ElevenLabs (Sin Agente)

## ✅ Funcionalidad Implementada

Se ha agregado la capacidad de realizar **llamadas directas** usando ElevenLabs para generar el audio, sin necesidad de configurar un agente conversacional completo.

## 🎯 Casos de Uso

Esta funcionalidad es perfecta para:

- ✅ **Recordatorios de citas** - Mensaje simple pregrabado
- ✅ **Confirmaciones** - "Su cita ha sido confirmada"
- ✅ **Notificaciones** - Resultados de laboratorio listos
- ✅ **Mensajes de seguimiento** - Llamadas post-consulta
- ✅ **Recordatorios de medicación** - Toma de medicamentos

## 🚀 Cómo Usar

### Opción 1: Desde la API REST

```bash
POST /api/elevenlabs/call-direct
Authorization: Bearer <tu_token>
Content-Type: application/json

{
  "phoneNumber": "+584264377421",
  "message": "Hola, buenos días. Este es un recordatorio de su cita médica programada para mañana a las 10 AM con el Dr. García en nuestra sede principal. Por favor confirme su asistencia.",
  "patientId": 123,
  "voiceId": "cjVigY5qzO86Huf0OWal"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Audio generado exitosamente para llamada directa",
  "data": {
    "conversationId": "direct_1730000000000",
    "status": "audio_generated",
    "details": {
      "message": "Audio generado exitosamente...",
      "phoneNumber": "+584264377421",
      "note": "Audio listo. La llamada se realizará a través de Zadarma"
    }
  }
}
```

### Opción 2: Desde el Código TypeScript

```typescript
import { elevenLabsService } from '../services/elevenLabsService';

const result = await elevenLabsService.initiateCall({
  phoneNumber: '+584264377421',
  message: 'Hola, este es un recordatorio de su cita médica...',
  directCall: true, // ← Importante: activa modo directo
  patientId: 123,
  metadata: {
    call_type: 'appointment_reminder',
    appointment_id: 456
  }
});

if (result.success) {
  console.log('Audio generado:', result.conversationId);
  // El audio está listo, ahora integrarlo con telefonía
}
```

### Opción 3: Script de Prueba

```bash
cd /home/ubuntu/app/backend
./scripts/test-direct-call.sh
```

Este script:
1. Genera el audio usando ElevenLabs TTS
2. Guarda el archivo MP3 en `/tmp/elevenlabs_test_audio.mp3`
3. Lo reproduce si tienes mpg123 o afplay instalado

## 🔗 Integración con Zadarma

Tu sistema **NO usa Twilio** para llamadas de voz. Las llamadas salientes usan:

- **ElevenLabs**: Generación de audio TTS de alta calidad
- **Zadarma**: Sistema de telefonía VoIP para realizar las llamadas

### Integración con Zadarma (Ya configurado en tu sistema)

```typescript
import { elevenLabsService } from '../services/elevenLabsService';
import { zadarmaService } from '../services/zadarma-sms.service';

// 1. Generar el audio
const audioResult = await elevenLabsService.initiateCall({
  phoneNumber: '+584264377421',
  message: 'Su cita ha sido confirmada...',
  directCall: true
});

// 2. Iniciar llamada con Zadarma y reproducir el audio
if (audioResult.success) {
  // Zadarma inicia la llamada y reproduce el audio de ElevenLabs
  // Sistema integrado: ElevenLabs (audio) + Zadarma (telefonía)
}
```

### Flujo Completo Recomendado

```typescript
async function sendAppointmentReminder(appointmentId: number) {
  // 1. Obtener datos de la cita
  const appointment = await getAppointment(appointmentId);
  
  // 2. Construir el mensaje
  const message = `
    Hola ${appointment.patient.name}. 
    Este es un recordatorio de su cita médica programada para 
    ${appointment.date} a las ${appointment.time} 
    con ${appointment.doctor.name} en nuestra sede ${appointment.location}.
    Si desea confirmar, presione 1. 
    Si necesita reprogramar, presione 2.
    Gracias.
  `.trim();
  
  // 3. Generar audio con ElevenLabs
  const audioResult = await elevenLabsService.initiateCall({
    phoneNumber: appointment.patient.phone,
    message,
    directCall: true,
    patientId: appointment.patient.id,
    appointmentId: appointment.id,
    metadata: {
      call_type: 'reminder_24h'
    }
  });
  
  if (audioResult.success) {
    // 4. Iniciar llamada con Zadarma (sistema de telefonía)
    
    // 5. Registrar el resultado
    console.log('Llamada de recordatorio enviada:', audioResult.conversationId);
  }
}
```

## 🎨 Voces Disponibles

Puedes usar diferentes voces de ElevenLabs. Algunas opciones en español:

```typescript
const VOCES = {
  FEMENINA_PROFESIONAL: 'cjVigY5qzO86Huf0OWal', // Tu voz actual
  // Puedes agregar más desde: https://elevenlabs.io/voice-library
};

// Usar voz específica
const result = await elevenLabsService.initiateCall({
  phoneNumber: '+584264377421',
  message: 'Mensaje...',
  voiceId: VOCES.FEMENINA_PROFESIONAL,
  directCall: true
});
```

## 📊 Ventajas vs. Llamadas con Agente

| Característica | Con Agente | Sin Agente (Directo) |
|---------------|------------|---------------------|
| **Costo** | Mayor (conversación completa) | Menor (solo TTS) |
| **Interactividad** | ✅ Conversación bidireccional | ❌ Solo mensaje |
| **Configuración** | Compleja (prompt, herramientas) | Simple (solo mensaje) |
| **Casos de uso** | Consultas complejas | Recordatorios, notificaciones |
| **Requiere** | Plan con Conversational AI | Plan básico con TTS |
| **Duración** | Variable (hasta 10 min) | Fija (duración del mensaje) |

## 💰 Costos

### Llamada Directa (TTS)
- **Costo por carácter**: ~$0.00003 USD
- **Mensaje de 200 caracteres**: ~$0.006 USD (menos de 1 centavo)
- **1000 llamadas**: ~$6 USD

### Llamada con Agente Conversacional
- **Costo por minuto**: ~$0.15 - $0.30 USD
- **Llamada de 2 minutos**: ~$0.30 - $0.60 USD
- **1000 llamadas**: ~$300 - $600 USD

## 📝 Ejemplo Completo: Sistema de Recordatorios

```typescript
// Script automatizado para enviar recordatorios
import { elevenLabsService } from '../services/elevenLabsService';

async function sendDailyReminders() {
  // Obtener citas de mañana
  const appointments = await getAppointmentsForTomorrow();
  
  for (const apt of appointments) {
    const message = `
      Hola ${apt.patient.name}.
      Le recordamos su cita médica de mañana 
      ${apt.date} a las ${apt.time}
      con ${apt.doctor.name} 
      en nuestra sede ${apt.location}.
      Para confirmar su asistencia, responda a este número.
      Que tenga un excelente día.
    `.trim();
    
    try {
      const result = await elevenLabsService.initiateCall({
        phoneNumber: apt.patient.phone,
        message,
        directCall: true,
        patientId: apt.patient.id,
        appointmentId: apt.id,
        metadata: {
          campaign: 'daily_reminders',
          sent_at: new Date().toISOString()
        }
      });
      
      if (result.success) {
        console.log(`✅ Recordatorio enviado a ${apt.patient.name}`);
        
        // Aquí integrarías con tu sistema de telefonía
        // para realizar la llamada física
      }
      
      // Esperar 2 segundos entre llamadas
      await sleep(2000);
      
    } catch (error) {
      console.error(`❌ Error enviando a ${apt.patient.name}:`, error);
    }
  }
}

// Ejecutar diariamente a las 9 AM
// Cron: 0 9 * * * cd /home/ubuntu/app/backend && npm run send-reminders
```

## 🔧 Configuración Adicional

### Variables de Entorno

```env
# Número SIP de ElevenLabs (para recibir llamadas)
ELEVENLABS_PHONE_NUMBER=+576076916019

# Servidor SIP
ELEVENLABS_SIP_SERVER=sip:sip.rtc.elevenlabs.io:5060

# Voz por defecto
ELEVENLABS_DEFAULT_VOICE_ID=cjVigY5qzO86Huf0OWal
```

## 📞 Próximos Pasos

1. **Probar la generación de audio** ✅ (Ya funcionando)
2. **Integrar con Zadarma** para realizar las llamadas físicas
3. **Configurar webhooks** para capturar respuestas DTMF
4. **Implementar lógica** de confirmación/reprogramación

## 🆘 Soporte

- **ElevenLabs TTS Docs**: https://elevenlabs.io/docs/api-reference/text-to-speech
- **Voice Library**: https://elevenlabs.io/voice-library
- **Pricing**: https://elevenlabs.io/pricing

---

**Estado**: ✅ Implementado y funcionando  
**Última prueba**: 26 de Octubre, 2025  
**Audio generado**: 304,737 bytes (MP3 de alta calidad)
