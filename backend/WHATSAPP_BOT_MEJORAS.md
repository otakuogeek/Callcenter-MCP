# Sistema Mejorado de WhatsApp Bot - Biosanarcall

## 🎯 Mejoras Implementadas (Basadas en moltbot)

### 1. **Sistema de Personalidad Avanzado**
- ✅ Manejo de contexto conversacional con historial
- ✅ Detección automática de intenciones
- ✅ Respuestas contextuales según estado de conversación
- ✅ Personalidad configurable (tono, estilo, capacidades)
- ✅ Limpieza automática de contextos inactivos

### 2. **Gestión de Estados de Conversación**
- ✅ Máquina de estados para flujos complejos
- ✅ 11 estados predefinidos (idle, greeting, scheduling, etc.)
- ✅ Transiciones automáticas con validación
- ✅ Timeouts configurables por estado
- ✅ Persistencia en base de datos

### 3. **Manejo Inteligente de Flujos**
- ✅ Detección automática del siguiente paso
- ✅ Recuperación de errores
- ✅ Resumen de conversación al completar
- ✅ Métricas y estadísticas de uso

## 📚 Guía de Integración

### Paso 1: Inicializar el Sistema

```typescript
import { personalityManager } from './services/WhatsAppPersonality';
import { conversationManager } from './services/WhatsAppConversationManager';

// En el inicio de tu aplicación
await conversationManager.ensureTableExists();
```

### Paso 2: Manejar Mensajes Entrantes

```typescript
// En tu handler de mensajes de WhatsApp
async function handleIncomingMessage(phoneNumber: string, message: string) {
  // 1. Obtener conversación actual
  const conversation = await conversationManager.getOrCreateConversation(phoneNumber);
  
  // 2. Detectar intención
  const intent = personalityManager.detectIntent(message);
  
  // 3. Obtener respuesta contextual si es simple
  const quickResponse = personalityManager.generateContextualResponse(intent, phoneNumber);
  
  if (quickResponse) {
    await sendWhatsAppMessage(phoneNumber, quickResponse);
    await conversationManager.incrementMessageCount(phoneNumber, message);
    return;
  }
  
  // 4. Construir mensajes para AI con personalidad
  const messages = personalityManager.buildMessagesForAI(phoneNumber, message);
  
  // 5. Obtener respuesta de AI
  const aiResponse = await getAIResponse(messages);
  
  // 6. Agregar al historial
  personalityManager.addMessage(phoneNumber, 'user', message);
  personalityManager.addMessage(phoneNumber, 'assistant', aiResponse);
  
  // 7. Actualizar estado según intención
  await updateConversationState(phoneNumber, intent, conversation);
  
  // 8. Enviar respuesta
  await sendWhatsAppMessage(phoneNumber, aiResponse);
  await conversationManager.incrementMessageCount(phoneNumber, message);
}
```

### Paso 3: Manejo de Estados Específicos

```typescript
async function updateConversationState(
  phoneNumber: string, 
  intent: string, 
  currentConversation: ConversationState
) {
  switch (intent) {
    case 'schedule':
      if (currentConversation.state === 'idle' || currentConversation.state === 'greeting') {
        await conversationManager.transitionState(phoneNumber, 'identifying', 'awaiting_document');
      } else if (currentConversation.state === 'identifying') {
        await conversationManager.transitionState(phoneNumber, 'checking_availability');
      }
      break;
      
    case 'cancel':
      await conversationManager.transitionState(phoneNumber, 'canceling', 'confirming_cancellation');
      break;
      
    case 'waiting_list':
      await conversationManager.transitionState(phoneNumber, 'waiting_list', 'adding_to_queue');
      break;
      
    case 'goodbye':
      await conversationManager.completeConversation(phoneNumber, 'Usuario se despidió');
      break;
      
    default:
      // Mantener estado actual
      break;
  }
}
```

### Paso 4: Ejemplo de Flujo Completo - Agendamiento

```typescript
async function handleSchedulingFlow(phoneNumber: string, userInput: string) {
  const conversation = await conversationManager.getOrCreateConversation(phoneNumber);
  
  switch (conversation.state) {
    case 'idle':
    case 'greeting':
      // Iniciar proceso
      await conversationManager.transitionState(phoneNumber, 'identifying');
      return '¿Podrías compartirme tu número de documento para buscar tu información? 📋';
      
    case 'identifying':
      // Validar documento y buscar paciente
      const document = extractDocument(userInput);
      const patient = await findPatient(document);
      
      if (patient) {
        await conversationManager.updateContext(phoneNumber, { 
          patientId: patient.id, 
          document 
        });
        await conversationManager.transitionState(phoneNumber, 'scheduling', 'selecting_specialty');
        return `Hola ${patient.name}! 👋 ¿Para qué especialidad necesitas la cita?`;
      } else {
        return 'No encontré tu registro. ¿Podrías verificar el número de documento?';
      }
      
    case 'scheduling':
      if (conversation.subState === 'selecting_specialty') {
        const specialty = await findSpecialty(userInput);
        if (specialty) {
          await conversationManager.updateContext(phoneNumber, { specialtyId: specialty.id });
          await conversationManager.transitionState(phoneNumber, 'checking_availability');
          
          // Consultar disponibilidad
          const availability = await checkAvailability(specialty.id);
          
          if (availability.length > 0) {
            return formatAvailabilityMessage(availability);
          } else {
            await conversationManager.transitionState(phoneNumber, 'waiting_list');
            return '😔 Actualmente no hay cupos disponibles. ¿Te gustaría que te agregue a la lista de espera?';
          }
        }
      }
      break;
      
    case 'confirming':
      if (userInput.toLowerCase().includes('sí') || userInput.toLowerCase().includes('confirmo')) {
        // Procesar agendamiento
        const { patientId, specialtyId, selectedSlot } = conversation.contextData;
        const appointment = await createAppointment(patientId, specialtyId, selectedSlot);
        
        await conversationManager.completeConversation(phoneNumber, `Cita agendada #${appointment.id}`);
        return `✅ ¡Perfecto! Tu cita ha sido confirmada para el ${appointment.date} a las ${appointment.time}. Número de cita: #${appointment.id}`;
      }
      break;
  }
  
  return null; // Dejar que el AI maneje la respuesta
}
```

## 🔧 Configuración de Personalidad

```typescript
// Personalizar la personalidad del bot
const customPersonality = {
  tone: 'friendly' as const,
  responseStyle: 'conversational' as const,
  customInstructions: `
    Soy un asistente más informal y cercano.
    Uso más emojis y un lenguaje relajado pero profesional.
  `
};

// Al construir mensajes para AI
const messages = personalityManager.buildMessagesForAI(
  phoneNumber, 
  message, 
  customPersonality
);
```

## 📊 Monitoreo y Métricas

```typescript
// Obtener estadísticas de personalidad
const personalityStats = personalityManager.getStats();
console.log(`Conversaciones activas: ${personalityStats.activeConversations}`);

// Obtener estadísticas de estados
const conversationStats = await conversationManager.getStats();
console.log(`Estados activos:`, conversationStats.byState);
console.log(`Promedio de mensajes: ${conversationStats.avgMessageCount}`);
```

## 🧹 Mantenimiento Automático

```typescript
// Ejecutar cada hora para limpiar contextos inactivos
setInterval(() => {
  // Limpiar contextos de personalidad (60 min de inactividad)
  personalityManager.cleanupInactiveContexts(60);
  
  // Limpiar conversaciones expiradas en DB
  conversationManager.cleanupExpiredConversations();
}, 60 * 60 * 1000);
```

## 🎨 Características Avanzadas

### 1. **Detección de Contexto Médico**
```typescript
personalityManager.addMessage(userId, 'user', message, {
  isMedicalEmergency: message.includes('urgencia') || message.includes('emergencia'),
  containsSensitiveInfo: true
});
```

### 2. **Preferencias de Usuario**
```typescript
personalityManager.updateUserPreferences(userId, {
  preferredLanguage: 'es',
  notificationPreferences: ['sms', 'whatsapp']
});
```

### 3. **Temas de Conversación**
```typescript
personalityManager.setCurrentTopic(userId, 'agendamiento_cardiologia');
```

## 📱 Integración con Sistema Existente

Para integrar con tu sistema actual de WhatsApp:

1. **Importa los módulos** en `/backend/src/routes/whatsapp.ts`
2. **Inicializa** en el endpoint de inicialización
3. **Modifica** el handler de mensajes entrantes
4. **Agrega** lógica de estados en las respuestas de AI

## 🚀 Próximos Pasos Sugeridos

- [ ] Implementar NLU avanzado para mejor detección de intenciones
- [ ] Agregar análisis de sentimiento
- [ ] Crear respuestas pre-configuradas por especialidad
- [ ] Implementar multi-idioma
- [ ] Agregar webhooks para notificaciones proactivas
- [ ] Dashboard de métricas de conversación

## 📖 Referencia Completa

Ver archivos implementados:
- `/backend/src/services/WhatsAppPersonality.ts`
- `/backend/src/services/WhatsAppConversationManager.ts`

Inspirado en: https://github.com/moltbot/moltbot
