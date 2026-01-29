# 📱 Guía de Uso - Sistema de Estados WhatsApp

## 🎯 Para Administradores

### Monitoreo en Tiempo Real

```bash
# Ver logs completos con estados
pm2 logs cita-central-backend

# Ver solo mensajes de WhatsApp
pm2 logs cita-central-backend | grep WhatsApp

# Ver solo transiciones de estado
pm2 logs cita-central-backend | grep "Estado actual"

# Ver solo errores
pm2 logs cita-central-backend | grep "❌"
```

### Verificar Estado del Sistema

```bash
# Estado de procesos
pm2 status

# Reiniciar si es necesario
pm2 restart cita-central-backend

# Ver memoria utilizada
pm2 monit
```

### Consultar Conversaciones Activas

```bash
curl -X GET "http://localhost:4000/api/whatsapp/conversations" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 👥 Para Usuarios (Pacientes)

### Iniciar Conversación

Simplemente envía un saludo:
- "Hola"
- "Buenos días"
- "Buenas tardes"
- "Hey"

El sistema automáticamente:
1. ✅ Resetea cualquier conversación previa
2. ✅ Inicia un nuevo flujo desde cero
3. ✅ Pide tu número de cédula

### Flujo Normal de Agendamiento

```
🔹 PASO 1: Identificación
Tu: "Hola"
Valeria: "¡Hola! Por favor, indícame tu número de cédula"

Tu: "17265900"
Valeria: "Encontré tu registro: Dave Bastidas. 
         ¿Tu teléfono sigue siendo 04129578254?"

🔹 PASO 2: Confirmación
Tu: "Sí"
Valeria: "Perfecto. Tenemos disponibilidad en:
         - Medicina General
         - Odontología
         - Psicología
         ¿Para cuál necesitas la cita?"

🔹 PASO 3: Especialidad
Tu: "Odontología"
Valeria: "Puedes agendar en:
         - Sede Principal
         - Sede El Socorro
         ¿Cuál prefieres?"

🔹 PASO 4: Sede
Tu: "Principal"
Valeria: "Tenemos agenda para:
         - 22 de enero - Mañana
         - 25 de enero - Tarde
         ¿Qué día te queda mejor?"

🔹 PASO 5: Fecha
Tu: "22 de enero"
Valeria: "Horarios disponibles:
         - 8:00 AM
         - 10:30 AM
         - 3:45 PM
         ¿Cuál prefieres?"

🔹 PASO 6: Hora
Tu: "tarde"
(Sistema automáticamente selecciona 3:45 PM)
Valeria: "Te agendo para las 3:45 PM. 
         ¿Cuál es el motivo de tu consulta?"

🔹 PASO 7: Motivo
Tu: "limpieza dental"
Valeria: "Confirmación:
         - Doctor: Dr. Pérez
         - Fecha: 22 de enero
         - Hora: 3:45 PM
         - Sede: Principal
         ¿Confirmas?"

🔹 PASO 8: Confirmación
Tu: "confirmo"
Valeria: "✅ Cita agendada exitosamente!
         Número de cita: #12345
         Te esperamos el 22 de enero a las 3:45 PM"
```

### Respuestas Aceptadas

#### Afirmaciones
- "Sí"
- "Si"
- "Ok"
- "Vale"
- "Claro"
- "Confirmo"
- "Exacto"
- "Correcto"
- "Adelante"

#### Negaciones
- "No"
- "Nop"
- "Nope"
- "Negativo"
- "Incorrecto"
- "Otro"

#### Selección de Hora
**Específica:**
- "8 de la mañana"
- "3:45 PM"
- "las 10"

**Vaga (selección inteligente):**
- "tarde" → primer horario después de 12:00 PM
- "después de las 3" → primer horario después de 3:00 PM
- "más o menos a las 4" → horario más cercano a las 4:00 PM

---

## 🔧 Para Desarrolladores

### Estructura del Sistema de Estados

```typescript
// Obtener estado actual
const state = getStateContext(phone);
console.log(state.currentState); // 'awaiting_specialty'
console.log(state.retryCount);   // 0

// Actualizar estado
updateState(phone, ConversationState.AWAITING_DATE, {
  specialty: 'Odontología',
  availabilityId: 123
});

// Incrementar contador de errores
incrementRetry(phone);

// Verificar si debe resetear
if (shouldResetDueToErrors(phone)) {
  resetState(phone);
}

// Obtener mensaje de recuperación
const message = getRecoveryMessage(phone);
```

### Estados Disponibles

```typescript
enum ConversationState {
  IDLE,                       // Sin conversación activa
  AWAITING_DOCUMENT,          // Esperando cédula
  AWAITING_PATIENT_DATA,      // Esperando datos de registro
  AWAITING_PHONE_CONFIRMATION,// Esperando confirmación de teléfono
  AWAITING_SPECIALTY,         // Esperando especialidad
  AWAITING_DATE,              // Esperando fecha
  AWAITING_TIME,              // Esperando hora
  AWAITING_REASON,            // Esperando motivo
  AWAITING_CONFIRMATION,      // Esperando confirmación final
  COMPLETED,                  // Cita agendada
  ERROR                       // Estado de error
}
```

### Integración con Herramientas MCP

```typescript
// Transiciones automáticas según herramientas

// searchPatient exitoso
if (toolResult.success && toolResult.data) {
  updateState(phone, ConversationState.AWAITING_PHONE_CONFIRMATION, {
    patientId: toolResult.data.id,
    patientName: toolResult.data.full_name
  });
}

// registerPatientSimple exitoso
if (toolResult.success) {
  updateState(phone, ConversationState.AWAITING_SPECIALTY, {
    patientId: toolResult.data?.id
  });
}

// scheduleAppointment exitoso
if (toolResult.success) {
  updateState(phone, ConversationState.COMPLETED, {
    lastQuestion: `Cita #${toolResult.data?.appointment_id}`
  });
  
  // Reset automático después de 5 segundos
  setTimeout(() => resetState(phone), 5000);
}
```

### Personalizar Mensajes de Recuperación

Edita `WhatsAppStateManager.ts`, función `getRecoveryMessage()`:

```typescript
case ConversationState.AWAITING_SPECIALTY:
  return "No pude identificar la especialidad. " +
         "Por favor, selecciona una de las que mencioné.";
```

### Ajustar Timeouts

Edita `WhatsAppStateManager.ts`:

```typescript
// Tiempo antes de expirar (milisegundos)
const STATE_TIMEOUT = 1800000; // 30 minutos

// Frecuencia de limpieza (milisegundos)
setInterval(cleanupOldStates, 600000); // 10 minutos

// Máximo de reintentos
const MAX_RETRIES = 3;
```

### Debugging

```typescript
// Agregar más logging
console.log('[WhatsAppAI] Estado:', state);
console.log('[WhatsAppAI] Contexto:', state.context);
console.log('[WhatsAppAI] Último error:', state.lastError);

// Ver todos los estados activos
console.log('[WhatsAppAI] Estados activos:', 
  Array.from(stateContexts.keys()));
```

---

## 🐛 Solución de Problemas

### Problema: "Conversación no resetea"

**Síntoma:** Usuario envía "Hola" pero continúa la conversación anterior

**Solución:**
1. Verificar que el saludo está en la expresión regular:
   ```typescript
   const greetings = /^(hola|buenas|...)/i;
   ```
2. Verificar logs: `pm2 logs | grep "Saludo detectado"`
3. Resetear manualmente si es necesario:
   ```bash
   curl -X POST http://localhost:4000/api/whatsapp/reset \
     -d '{"phone": "584129578254"}'
   ```

### Problema: "Bucle de errores"

**Síntoma:** Bot repite lo mismo >3 veces

**Solución:**
1. Verificar contador de errores: `pm2 logs | grep "Reintentos"`
2. Debe resetear automáticamente al 4to intento
3. Si no resetea, verificar función `shouldResetDueToErrors()`

### Problema: "Timeout no funciona"

**Síntoma:** Conversaciones no se limpian después de 30 min

**Solución:**
1. Verificar que `cleanupOldStates()` se ejecuta:
   ```bash
   pm2 logs | grep "Cleanup"
   ```
2. Verificar que el intervalo está activo:
   ```typescript
   setInterval(cleanupOldStates, 600000);
   ```

### Problema: "Estado incorrecto"

**Síntoma:** Sistema piensa que está en un estado diferente

**Solución:**
1. Ver estado actual:
   ```bash
   curl http://localhost:4000/api/whatsapp/state/584129578254
   ```
2. Resetear manualmente:
   ```bash
   curl -X POST http://localhost:4000/api/whatsapp/reset \
     -d '{"phone": "584129578254"}'
   ```

---

## 📊 Métricas de Performance

### Tiempos Esperados

- **Respuesta normal:** 200-600ms
- **Con herramienta MCP:** 500-1500ms
- **Búsqueda de paciente:** 100-300ms
- **Agendamiento completo:** 800-2000ms

### Memoria

- **Por conversación:** ~2-5 KB
- **100 conversaciones:** ~200-500 KB
- **Cleanup automático:** Cada 10 minutos

### Logs

```
[WhatsAppAI] ✅ Procesamiento exitoso en 234ms 
             Estado: awaiting_date 
             Herramientas: getAvailableAppointments
```

---

## 🔐 Seguridad

### Datos Sensibles

El sistema NO almacena:
- ❌ Contraseñas
- ❌ Números de tarjeta
- ❌ Información médica detallada

El sistema SÍ almacena:
- ✅ Número de cédula (para búsqueda)
- ✅ Nombre del paciente
- ✅ Teléfono
- ✅ Datos de cita (fecha, hora, especialidad)

### Timeout de Seguridad

- Conversaciones abandonadas se eliminan después de 30 min
- No queda información en memoria después del timeout
- Próximo mensaje crea contexto limpio

---

## 📝 Mejores Prácticas

### Para Usuarios

1. **Sé específico:** "Odontología" mejor que "diente"
2. **Confirma claramente:** "Sí" mejor que "ok tal vez"
3. **Un mensaje a la vez:** Espera la respuesta antes de enviar más
4. **Usa saludos para resetear:** Si te perdiste, di "Hola" de nuevo

### Para Administradores

1. **Monitorea logs regularmente:** `pm2 logs cita-central-backend`
2. **Verifica estados activos:** No deberían acumularse indefinidamente
3. **Revisa métricas:** Tiempo de respuesta <2s en promedio
4. **Backup de conversaciones:** Por si necesitas auditoria

### Para Desarrolladores

1. **Siempre actualiza el estado** después de ejecutar herramientas
2. **Usa `incrementRetry()`** cuando haya errores de comprensión
3. **Resetea después de COMPLETED:** No dejes estados colgados
4. **Log todo:** Facilita debugging posterior

---

## 📞 Soporte

**Logs:** `/home/ubuntu/app/backend/logs/`
**Configuración:** `/home/ubuntu/app/backend/.env`
**Código:** `/home/ubuntu/app/backend/src/services/`

**Teléfono:** 6076911308
**WhatsApp:** Mismo número

---

**Última actualización:** 14 de Enero, 2026
**Versión:** 1.0.0
