# Sistema de Personalidad de WhatsApp - Valeria

## 🎯 Resumen

Se ha implementado un sistema completo de personalidad y gestión de conversaciones para el bot de WhatsApp, con una personalidad específica de **Valeria**, una recepcionista colombiana alegre, amigable, conocedora de salud y temas médicos, joven, soñadora y muy atenta.

## ✨ Características Implementadas

### 1. **Sistema de Personalidad Avanzado** (`WhatsAppPersonality.ts`)

- **Gestión de Contexto de Conversación**: Mantiene el historial de hasta 10 mensajes por usuario
- **Detección de Intenciones**: Identifica 11 tipos de intenciones diferentes:
  - greeting (saludo)
  - schedule (agendar cita)
  - cancel (cancelar cita)
  - reschedule (reagendar)
  - availability (consultar disponibilidad)
  - waiting_list (lista de espera)
  - info (información general)
  - help (ayuda)
  - thanks (agradecimientos)
  - goodbye (despedida)
  - unknown (desconocido)

- **Respuestas Contextuales Rápidas**: Para intenciones simples (saludo, despedida, gracias)
- **Limpieza Automática**: Contextos inactivos se limpian después de 60 minutos

### 2. **Máquina de Estados de Conversación** (`WhatsAppConversationManager.ts`)

- **11 Estados de Conversación**:
  - `idle`: Usuario inactivo
  - `greeting`: Saludo inicial
  - `identifying`: Identificando paciente (esperando cédula)
  - `scheduling`: En proceso de agendamiento
  - `checking_availability`: Consultando disponibilidad
  - `confirming`: Confirmando detalles de cita
  - `waiting_list`: Gestionando lista de espera
  - `canceling`: Cancelando cita
  - `rescheduling`: Reagendando cita
  - `info_request`: Solicitando información
  - `completed`: Conversación completada
  - `error`: Error en el flujo

- **Timeouts Inteligentes**: Cada estado tiene su propio timeout (5-60 minutos)
- **Persistencia en MySQL**: Tabla `wa_conversation_states` para mantener estado entre sesiones
- **Métricas y Estadísticas**: Conversaciones activas, distribución por estado, promedio de mensajes

### 3. **Personalidad de Valeria** 🇨🇴

#### Características Principales:
- **Edad**: 25 años
- **Origen**: Colombiana
- **Personalidad**: Alegre, amigable, atenta, soñadora, joven

#### Estilo de Comunicación:
- Usa expresiones colombianas naturales:
  - "mi amor", "mi vida", "mi cielo" (términos de cariño comunes)
  - "ratito", "ahoritica" (diminutivos temporales)
  - "¡Listo!", "¡Dale!", "¡Claro que sí!" (expresiones de confirmación)
  - "¿Cómo estás?", "¿Todo bien?" (preguntas de cortesía)

- **Emojis Moderados**: Usa emojis para dar calidez (😊 💚 ✨ 🌟)
- **Diminutivos**: "Ratito", "horita", "cosita"

#### Conocimientos Médicos:
- ✅ Conoce todas las especialidades médicas
- ✅ Puede orientar sobre síntomas generales
- ✅ Conoce preparación para exámenes básicos
- ❌ NO realiza diagnósticos
- ❌ NO receta medicamentos
- ❌ NO da consejos médicos específicos

#### Protocolos Especiales:

1. **Emergencias**:
   - Detecta palabras clave: "dolor de pecho", "sangrado abundante", "dificultad para respirar", "emergencia"
   - Redirige inmediatamente a urgencias o línea 123
   - Mensaje: "Por favor, dirígete de inmediato a urgencias o llama al 123"

2. **Pacientes Frustrados**:
   - Reconoce frustración en el tono
   - Responde con empatía extra
   - Mensaje: "Entiendo tu molestia, mi amor. Voy a ayudarte en lo que pueda..."

3. **Datos Sensibles**:
   - Maneja con confidencialidad: diagnósticos, tratamientos, condiciones
   - No comparte información personal entre pacientes
   - Respeta privacidad médica

## 🔧 Integración Técnica

### En `WhatsAppAIService.ts`:

#### 1. Sistema de Detección y Respuestas Rápidas (PASO 0):
```typescript
// Detectar intención
const intent = personalityManager.detectIntent(message);

// Respuestas rápidas para saludos, gracias, despedidas
const quickResponse = personalityManager.generateContextualResponse(intent, cleanPhone);
if (quickResponse && (intent === 'greeting' || intent === 'thanks' || intent === 'goodbye' || intent === 'help')) {
  return quickResponse;
}
```

#### 2. Actualización de Estados:
```typescript
// Transición de estado basada en intención
await updateConversationStateByIntent(cleanPhone, intent, conversation.state);
```

#### 3. Construcción de Prompts con Personalidad:
```typescript
// System prompt mejorado con personalidad
const enhancedSystemPrompt = systemPrompt + '\n\n' + 
  personalityManager['buildSystemPrompt'](customPersonality);

// Mensajes con contexto
const messages = [
  { role: 'system', content: enhancedSystemPrompt },
  ...context.messages.slice(-15)
];
```

#### 4. Historial de Conversación:
```typescript
// Agregar mensaje del usuario
personalityManager.addMessage(cleanPhone, 'user', message);

// Agregar respuesta del AI
personalityManager.addMessage(cleanPhone, 'assistant', aiResponse);

// Limpieza automática cada 60 minutos
personalityManager.cleanupInactiveContexts(60);
```

#### 5. Cierre de Conversación:
```typescript
case 'goodbye':
  await conversationManager.completeConversation(phone, 'Usuario se despidió');
  personalityManager.clearConversationHistory(phone);
  break;
```

## 📊 Base de Datos

### Tabla `wa_conversation_states`:
```sql
CREATE TABLE IF NOT EXISTS wa_conversation_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100),
  phone_number VARCHAR(50) NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'idle',
  sub_state VARCHAR(50),
  context_data JSON,
  last_message TEXT,
  message_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at DATETIME,
  INDEX idx_phone (phone_number),
  INDEX idx_state (state),
  INDEX idx_expires (expires_at)
);
```

## 🎨 Ejemplos de Interacción

### Ejemplo 1: Saludo Inicial
**Usuario**: "Hola"  
**Valeria**: "¡Hola! 😊 Soy Valeria de Fundación Biosanar IPS. ¿Cómo estás? ¿En qué puedo ayudarte el día de hoy?"

### Ejemplo 2: Confirmación de Teléfono
**Usuario**: "Necesito una cita"  
**Valeria**: "¡Claro que sí, mi amor! 💚 Permíteme validar tus datos. Tu número de contacto registrado es 573114589580. ¿Es correcto?"

### Ejemplo 3: Despedida
**Usuario**: "Muchas gracias"  
**Valeria**: "¡Ay, con mucho gusto! 💚 Es un placer poder ayudarte. ¿Necesitas algo más?"

**Usuario**: "No, eso es todo"  
**Valeria**: "¡Perfecto! ✨ Que tengas un día hermoso. Cualquier cosa, aquí estamos para ti. ¡Hasta pronto! 🌟"

### Ejemplo 4: Emergencia Detectada
**Usuario**: "Tengo dolor en el pecho muy fuerte"  
**Valeria**: "⚠️ **Mi amor, esto puede ser grave.** Por favor, dirígete de inmediato a urgencias o llama al 123. No esperes. Tu salud es primero."

## 📈 Métricas Disponibles

```typescript
// Obtener estadísticas
const stats = await conversationManager.getStats();
// Retorna:
// {
//   active: 25,
//   byState: {
//     'idle': 10,
//     'scheduling': 8,
//     'greeting': 5,
//     'confirming': 2
//   },
//   avgMessageCount: 4.5
// }
```

## 🔐 Privacidad y Seguridad

- **Contextos en Memoria**: Historial de conversación se mantiene en memoria (no en DB)
- **Limpieza Automática**: Contextos inactivos >60min se eliminan
- **Estados Persistentes**: Solo información de estado se guarda en DB (no mensajes completos)
- **Datos Sensibles**: No se guardan diagnósticos ni información médica sensible en logs

## 🚀 Próximos Pasos

1. **Monitoreo**: Agregar dashboards de métricas en tiempo real
2. **A/B Testing**: Probar variaciones de personalidad
3. **Personalización**: Permitir personalidades diferentes por sede o especialidad
4. **Análisis de Sentimiento**: Detectar niveles de satisfacción del usuario
5. **Mejora Continua**: Entrenar con conversaciones reales exitosas

## 📝 Notas Importantes

- **Version**: 3.5.0 (actualizada)
- **Dependencias**: 
  - `WhatsAppPersonality.ts`
  - `WhatsAppConversationManager.ts`
  - MySQL 8.0+
  - Node.js 18+

- **Compatibilidad**: Totalmente compatible con:
  - Sistema existente de MCP Tools
  - Direct DB Tools
  - Chat Memory Service
  - Estado de conversación actual

## 🎯 Resultado Final

El bot de WhatsApp ahora tiene:
- ✅ Personalidad cálida y profesional colombiana
- ✅ Gestión inteligente de estados de conversación
- ✅ Respuestas contextuales y naturales
- ✅ Detección de emergencias médicas
- ✅ Manejo empático de frustraciones
- ✅ Privacidad y seguridad de datos
- ✅ Métricas y estadísticas de uso
- ✅ Limpieza automática de contextos

**Valeria está lista para brindar una experiencia excepcional a los pacientes de Fundación Biosanar IPS.** 🌟
