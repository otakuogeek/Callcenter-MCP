# 📞 Sistema de Llamadas ElevenLabs - Guía Rápida

## 🚀 Inicio Rápido

### 1. Configuración Inicial

La API key de ElevenLabs ya está configurada en tu `.env`:

```env
ELEVENLABS_API_KEY=sk_b84e47ff1c163497f95d3ff87b02743c2d303b3863beeeff
```

### 2. Crear las Tablas de Base de Datos

```bash
npm run elevenlabs:setup
```

### 3. Crear un Agente en ElevenLabs

1. Ve a: https://elevenlabs.io/app/conversational-ai
2. Crea un nuevo agente con estas características:

**Configuración Sugerida:**
- **Nombre**: Valeria - Asistente Biosanarcall
- **Idioma**: Español (Colombia)
- **Voz**: Selecciona una voz femenina natural
- **Temperatura**: 0.7 (equilibrio entre creatividad y consistencia)

**Prompt del Sistema:**
```
Eres Valeria, asistente virtual de Fundación Biosanar IPS en Colombia.

INFORMACIÓN DEL PACIENTE:
- Nombre: {{patient_name}}
- ID: {{patient_id}}

INFORMACIÓN DE LA CITA:
- Fecha: {{appointment_date}}
- Hora: {{appointment_time}}
- Doctor: {{doctor_name}}
- Especialidad: {{specialty}}
- Sede: {{location}}

TU MISIÓN:
1. Saluda cordialmente: "Hola, buenos días/tardes. Soy Valeria de Fundación Biosanar."
2. Confirma identidad: "¿Hablo con {{patient_name}}?"
3. Informa sobre la cita: "Le estoy llamando para confirmar su cita médica programada para el {{appointment_date}} a las {{appointment_time}} con {{doctor_name}} en nuestra sede {{location}}."
4. Solicita confirmación: "¿Puede confirmar su asistencia a esta cita?"
5. Si confirma: "Perfecto, su cita está confirmada. Le esperamos puntualmente."
6. Si NO confirma: "Entendido. ¿Desea reprogramar la cita para otra fecha?"
7. Despedida: "Que tenga un excelente día. Hasta pronto."

REGLAS:
- Sé breve y profesional
- Habla de forma natural y amigable
- Si el paciente hace preguntas fuera del alcance, indica que un asesor se comunicará
- Máxima duración de llamada: 2 minutos
```

**Variables Dinámicas Requeridas:**
- `patient_name`
- `patient_id`
- `appointment_date`
- `appointment_time`
- `doctor_name`
- `specialty`
- `location`

3. **Copia el Agent ID** generado

4. **Actualiza el `.env`:**
```bash
ELEVENLABS_AGENT_ID=tu_agent_id_aqui
```

### 4. Configurar Webhook

En la configuración del agente en ElevenLabs:

**URL del Webhook:**
```
https://biosanarcall.site/api/webhooks/elevenlabs
```

**Secreto del Webhook:**
```
wsec_10242422f757a3433ce3983064bd5d44f74ec516cc921e972ed1561cb896bdfa
```

**Eventos a Escuchar:**
- ✅ `post_call_transcription` - Para recibir transcripciones
- ✅ `post_call_audio` - Para recibir grabaciones (opcional)

### 5. Probar la Integración

```bash
npm run elevenlabs:test
```

## 📡 Endpoints Disponibles

### Listar Agentes
```bash
GET /api/elevenlabs/agents
```

### Iniciar Llamada
```bash
POST /api/elevenlabs/call
Content-Type: application/json

{
  "phoneNumber": "+573001234567",
  "patientName": "María García",
  "customVariables": {
    "appointment_date": "27 de octubre de 2025",
    "appointment_time": "10:00 AM",
    "doctor_name": "Dr. Juan Pérez",
    "specialty": "Medicina General",
    "location": "Sede Principal"
  }
}
```

### Llamar a un Paciente (simplificado)
```bash
POST /api/elevenlabs/call-patient/123
Content-Type: application/json

{
  "appointmentId": 456,
  "customVariables": {
    "appointment_date": "27 de octubre de 2025",
    "appointment_time": "10:00 AM"
  }
}
```

### Historial de Llamadas
```bash
GET /api/elevenlabs/calls?page=1&limit=20&status=completed
```

### Estadísticas
```bash
GET /api/elevenlabs/stats?startDate=2025-10-01&endDate=2025-10-31
```

## 🔄 Automatización

### Enviar Llamadas de Confirmación Automáticas

Para citas programadas para mañana:

```bash
npm run elevenlabs:confirm-calls
```

Este script:
- ✅ Busca citas programadas para mañana
- ✅ Filtra pacientes con teléfono registrado
- ✅ Evita duplicar llamadas del mismo día
- ✅ Incluye toda la información de la cita
- ✅ Reporta estadísticas al finalizar

### Programar con Cron

Edita el crontab:
```bash
crontab -e
```

Agrega esta línea para ejecutar diariamente a las 9 AM:
```cron
0 9 * * * cd /home/ubuntu/app/backend && npm run elevenlabs:confirm-calls >> logs/elevenlabs-cron.log 2>&1
```

## 📊 Consultas SQL Útiles

### Ver Llamadas Recientes
```sql
SELECT * FROM elevenlabs_recent_calls LIMIT 20;
```

### Estadísticas del Día
```sql
SELECT 
  status,
  COUNT(*) as total,
  AVG(duration_secs) as avg_duration,
  SUM(cost) as total_cost
FROM elevenlabs_conversations
WHERE DATE(created_at) = CURDATE()
GROUP BY status;
```

### Llamadas Exitosas por Paciente
```sql
SELECT 
  p.name,
  p.phone,
  COUNT(*) as total_calls,
  MAX(ec.created_at) as last_call
FROM elevenlabs_conversations ec
JOIN patients p ON ec.patient_id = p.id
WHERE ec.call_successful = 'success'
GROUP BY p.id
ORDER BY total_calls DESC;
```

### Errores Recientes
```sql
SELECT * FROM elevenlabs_call_errors 
ORDER BY created_at DESC 
LIMIT 20;
```

## 💡 Ejemplos de Uso en Código

### Llamar a un Paciente después de Crear una Cita

```typescript
import { elevenLabsService } from '../services/elevenLabsService';

// Después de crear la cita...
const appointment = await createAppointment(data);

// Llamar al paciente para confirmar
const callResult = await elevenLabsService.initiateCall({
  phoneNumber: patient.phone,
  patientId: patient.id,
  patientName: patient.name,
  appointmentId: appointment.id,
  customVariables: {
    appointment_date: formatDate(appointment.scheduled_at),
    appointment_time: formatTime(appointment.scheduled_at),
    doctor_name: doctor.name,
    specialty: specialty.name,
    location: location.name
  }
});

if (callResult.success) {
  console.log('✅ Llamada iniciada:', callResult.conversationId);
}
```

### Recordatorio Masivo

```typescript
import { elevenLabsService } from '../services/elevenLabsService';

const upcomingAppointments = await getAppointmentsForTomorrow();

for (const apt of upcomingAppointments) {
  await elevenLabsService.initiateCall({
    phoneNumber: apt.patient.phone,
    patientId: apt.patient.id,
    patientName: apt.patient.name,
    appointmentId: apt.id,
    customVariables: {
      appointment_date: formatDate(apt.scheduled_at),
      appointment_time: formatTime(apt.scheduled_at),
      doctor_name: apt.doctor.name,
      specialty: apt.specialty.name,
      location: apt.location.name,
      reminder_type: 'confirmacion_24h'
    },
    metadata: {
      campaign: 'daily_reminders'
    }
  });
  
  // Esperar 2 segundos entre llamadas
  await sleep(2000);
}
```

## 🔧 Troubleshooting

### "Agent ID is required"
```bash
# Verifica que esté configurado
grep ELEVENLABS_AGENT_ID .env

# Si no está, agrégalo:
echo "ELEVENLABS_AGENT_ID=tu_agent_id" >> .env
```

### "Invalid API key"
```bash
# Verifica la API key
grep ELEVENLABS_API_KEY .env

# Debe empezar con sk_
```

### Webhook no recibe eventos
1. Verifica que la URL sea accesible:
   ```bash
   curl https://biosanarcall.site/api/webhooks/elevenlabs
   ```

2. Revisa los logs:
   ```bash
   tail -f logs/app.log | grep elevenlabs
   ```

3. Verifica el secreto del webhook en ElevenLabs

## 📈 Mejores Prácticas

1. **Horarios**: Configura llamadas entre 9 AM - 6 PM
2. **Frecuencia**: No más de 1 llamada por paciente por día
3. **Duración**: Mantén las conversaciones bajo 3 minutos
4. **Monitoreo**: Revisa diariamente las estadísticas
5. **Costos**: Monitorea el consumo en el dashboard de ElevenLabs

## 📚 Documentación Completa

- **Guía de Integración**: `docs/ELEVENLABS_INTEGRATION.md`
- **Setup Completo**: `docs/ELEVENLABS_SETUP_COMPLETE.md`
- **API de ElevenLabs**: https://elevenlabs.io/docs

## 🆘 Soporte

- Dashboard ElevenLabs: https://elevenlabs.io/app
- Documentación: https://elevenlabs.io/docs
- Pricing: https://elevenlabs.io/pricing

---

**¡Tu sistema está listo para realizar llamadas automáticas con IA!** 🎉
