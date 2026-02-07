# 📞 Sistema de Llamadas Automatizadas

## Descripción General

El sistema de llamadas automatizadas utiliza **ElevenLabs Conversational AI** para realizar llamadas a pacientes con voz natural. La asistente virtual "Valeria" puede confirmar citas, recordar información y gestionar el agendamiento.

---

## 🎙️ Características

### Voz de Valeria
- **Personalidad**: Profesional, amable y eficiente
- **Idioma**: Español colombiano
- **Capacidades**:
  - Confirmar citas médicas
  - Recordar información de la cita
  - Responder preguntas básicas sobre la clínica
  - Tomar notas de cancelaciones

### Estados de Llamada
| Estado | Descripción |
|--------|-------------|
| `iniciando` | Llamada en proceso de conexión |
| `en-progreso` | Llamada activa |
| `completada` | Llamada finalizada exitosamente |
| `no-contesta` | Sin respuesta del paciente |
| `ocupado` | Línea ocupada |
| `fallida` | Error en la llamada |
| `buzón` | Fue a buzón de voz |

---

## 🔧 Configuración

### Variables de Entorno
```env
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_AGENT_ID=agent_4901k9as42pkedgbd4sd6t3zmpay
```

### Agent ElevenLabs
El agente está configurado con:
- Voz personalizada en español
- Instrucciones específicas para contexto médico
- Manejo de interrupciones
- Límites de tiempo configurables

---

## 📊 Base de Datos

### Tabla `call_logs`
```sql
CREATE TABLE call_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT,
  appointment_id INT,
  phone_number VARCHAR(20),
  call_sid VARCHAR(100),
  status VARCHAR(50),
  duration_seconds INT,
  started_at DATETIME,
  ended_at DATETIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla `call_transcripts`
Almacena la transcripción completa de cada llamada para auditoría.

---

## 🚀 Uso del Sistema

### Realizar Llamada Manual
1. Ir a **Gestión** → **Llamadas**
2. Seleccionar paciente o ingresar número
3. Click en **"Iniciar Llamada"**
4. Monitorear estado en tiempo real

### Llamadas Automáticas (Recordatorios)
El sistema puede programar llamadas automáticas para:
- Recordatorios de cita (24h antes)
- Confirmación de asistencia
- Notificación de cambios

---

## 📈 Métricas

### Dashboard de Llamadas
- Total de llamadas realizadas
- Tasa de contestación
- Duración promedio
- Llamadas por día/semana

### Ejemplo de Estadísticas
| Métrica | Valor |
|---------|-------|
| Llamadas totales | 1,250 |
| Tasa de éxito | 78% |
| Duración promedio | 45 seg |
| No contesta | 15% |
| Ocupado/Fallido | 7% |

---

## 🔄 Flujo de Llamada

```
1. Sistema inicia llamada → ElevenLabs
2. Paciente contesta
3. Valeria saluda y presenta motivo
4. Interacción conversacional
5. Cierre y despedida
6. Registro en base de datos
7. Actualización de estado de cita
```

### Script de Valeria (Ejemplo)
```
"Hola, buenos días. Le habla Valeria de Fundación Biosanar IPS. 
¿Hablo con [NOMBRE DEL PACIENTE]?

Le llamo para confirmar su cita médica programada para el 
[FECHA] a las [HORA] con el Doctor [NOMBRE] en nuestra sede 
[UBICACIÓN].

¿Puede confirmarme su asistencia?"
```

---

## ⚠️ Consideraciones

1. **Horarios**: Llamadas solo en horario laboral (7am - 6pm)
2. **Reintentos**: Máximo 2 intentos por paciente
3. **Costos**: ElevenLabs cobra por minuto de conversación
4. **Privacidad**: Transcripciones solo para auditoría interna

---

## 🔗 Integraciones

- **WhatsApp Bot**: Puede derivar a llamada si el paciente lo solicita
- **Sistema de Citas**: Actualiza automáticamente el estado de confirmación
- **MCP Server**: Los agentes AI pueden iniciar llamadas vía herramientas

---

*Última actualización: Enero 2026*
