# Mejoras WhatsApp Bot v2.2.0 - Inspiradas en Moltbot

## Fecha: 2026-02-04

## Resumen de Mejoras Implementadas

### 1. 🔄 Message Debouncing (WhatsAppMessageDebouncer.ts)
**Archivo:** `/backend/src/services/WhatsAppMessageDebouncer.ts`

Agrupa mensajes rápidos del mismo usuario antes de procesarlos con IA.

**Configuración:**
- `DEBOUNCE_TIMEOUT`: 3 segundos de espera
- `MAX_BUFFERED_MESSAGES`: 10 mensajes máximo en buffer
- `MAX_WAIT_TIME`: 10 segundos tiempo máximo de espera

**Beneficios:**
- Reduce llamadas a la API de IA (ahorro de tokens)
- Mejor contexto al procesar mensajes juntos
- Detección inteligente de "fin de pensamiento"

### 2. 📄 Response Chunking (WhatsAppResponseChunker.ts)
**Archivo:** `/backend/src/services/WhatsAppResponseChunker.ts`

Divide respuestas largas en múltiples mensajes de WhatsApp.

**Configuración:**
- `MAX_WHATSAPP_LENGTH`: 4000 caracteres por mensaje
- Modos: `smart`, `paragraph`, `length`

**Beneficios:**
- Evita truncamiento de mensajes largos
- Preserva formato (código, listas, párrafos)
- Mejor experiencia de usuario

### 3. 🔍 Búsqueda Híbrida (WhatsAppSemanticMemory.ts)
**Modificado:** `/backend/src/services/WhatsAppSemanticMemory.ts`

Combina búsqueda vectorial + Full-Text Search (FTS).

**Funciones agregadas:**
- `searchByFullText()`: Búsqueda por palabras clave
- `mergeHybridResults()`: Fusión RRF (Reciprocal Rank Fusion)
- `hybridSearch()`: Búsqueda combinada

**Beneficios:**
- Mejor recall de memorias relevantes
- Búsqueda semántica + exacta
- Resultados más precisos

### 4. 💾 Cache de Embeddings (WhatsAppSemanticMemory.ts)
**Modificado:** `/backend/src/services/WhatsAppSemanticMemory.ts`

Cache en memoria para embeddings de OpenAI.

**Configuración:**
- `EMBEDDING_CACHE_TTL`: 1 hora
- Limpieza automática cada 10 minutos
- Hash de texto para claves

**Beneficios:**
- Reduce llamadas a OpenAI API
- Menor latencia en búsquedas repetidas
- Ahorro de costos

### 5. 🤫 Silent Token (WhatsAppAIService.ts)
**Modificado:** `/backend/src/services/WhatsAppAIService.ts`

Permite al bot decidir no responder a mensajes irrelevantes.

**Tokens soportados:**
- `[NO_REPLY]`
- `[SILENCIO]`
- `[NO_RESPONDER]`
- `{{NO_REPLY}}`
- `<<NO_REPLY>>`

**Cuándo no responder:**
- Solo emojis sin texto
- Spam/publicidad
- Caracteres random
- "ok" o "gracias" después de gestión completada

**Beneficios:**
- Experiencia más natural
- Evita respuestas innecesarias
- Ahorro de recursos

## Flujo Actualizado

```
Usuario envía mensaje(s)
         ↓
   [DEBOUNCER]
   - Agrupa mensajes rápidos (3s)
   - Máx 10 mensajes o 10s
         ↓
   [PROCESAMIENTO IA]
   - Análisis de intención
   - Búsqueda híbrida de memorias
   - Cache de embeddings
         ↓
   [SILENT TOKEN CHECK]
   - ¿Responder o no?
         ↓
   [CHUNKING]
   - Dividir si >4000 chars
         ↓
   [ENVÍO]
   - Envío secuencial con delays
```

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `WhatsAppConnection.ts` | Integración debouncer + chunker |
| `WhatsAppSemanticMemory.ts` | Cache embeddings + búsqueda híbrida |
| `WhatsAppAIService.ts` | Silent token + prompt actualizado |

## Archivos Nuevos

| Archivo | Descripción |
|---------|-------------|
| `WhatsAppMessageDebouncer.ts` | Servicio de debouncing |
| `WhatsAppResponseChunker.ts` | Servicio de chunking |

## Métricas Disponibles

El debouncer incluye estadísticas:
```typescript
messageDebouncer.getStats()
// {
//   totalMessagesReceived: number,
//   totalFlushed: number,
//   averageMessagesPerFlush: number,
//   activeBuffers: number
// }
```

## Notas de Implementación

- Compatible con el flujo existente
- No breaking changes
- Logging mejorado para debugging
- Inspirado en moltbot: inbound-debounce.ts, chunk.ts, hybrid.ts

## Próximos Pasos (Futuras Mejoras)

1. **Summarization**: Resumir conversaciones largas automáticamente
2. **Clustering**: Agrupar memorias similares
3. **LLM-as-Judge**: Evaluación automática de calidad de respuestas
4. **Sentiment Analysis**: Análisis de sentimiento más profundo
