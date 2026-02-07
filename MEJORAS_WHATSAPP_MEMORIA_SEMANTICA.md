# Mejoras de WhatsApp - Sistema de Memoria Semántica y Comprensión Mejorada

## 📋 Resumen de Implementación

Se han implementado mejoras significativas al sistema de WhatsApp Bot de Fundación Biosanar IPS, inspiradas en el proyecto moltbot/memory-lancedb, para proporcionar:

1. **Memoria Persistente Semántica** - Recuerda información importante a largo plazo
2. **Comprensión Mejorada** - Extracción de entidades e intenciones
3. **Personalidad Consistente** - Valeria con contexto enriquecido
4. **Auto-captura de Información** - Guarda datos relevantes automáticamente

---

## 🧠 Componentes Implementados

### 1. WhatsAppSemanticMemory.ts

**Ubicación:** `/backend/src/services/WhatsAppSemanticMemory.ts`

Sistema de memoria a largo plazo basado en embeddings vectoriales.

#### Características:

| Función | Descripción |
|---------|-------------|
| `generateEmbedding()` | Genera vectores con OpenAI text-embedding-3-small |
| `storeMemory()` | Guarda memorias con categorización automática |
| `searchMemories()` | Búsqueda semántica por similitud coseno |
| `autoCapture()` | Detecta y captura información importante |
| `recallRelevantMemories()` | Recupera memorias relevantes para contexto |
| `generateConversationSummary()` | Genera resúmenes de conversaciones largas |

#### Categorías de Memoria:

```typescript
type MemoryCategory = 
  | 'preference'    // Preferencias del usuario
  | 'medical_info'  // Información médica (alergias, condiciones)
  | 'contact_info'  // Información de contacto
  | 'appointment'   // Historial de citas
  | 'feedback'      // Retroalimentación del servicio
  | 'entity'        // Entidades importantes
  | 'fact'          // Hechos sobre el paciente
  | 'other';
```

#### Patrones de Captura Automática:

| Patrón | Categoría | Importancia |
|--------|-----------|-------------|
| "prefiero", "me gusta más" | preference | 0.8 |
| "soy alérgico", "no puedo tomar" | medical_info | 0.95 |
| "mi número nuevo es" | contact_info | 0.9 |
| "siempre me atiende el Dr..." | preference | 0.8 |
| "mi correo es..." | contact_info | 0.8 |

---

### 2. WhatsAppEnhancedUnderstanding.ts

**Ubicación:** `/backend/src/services/WhatsAppEnhancedUnderstanding.ts`

Sistema de comprensión avanzada de mensajes.

#### Funcionalidades:

| Función | Descripción |
|---------|-------------|
| `extractEntities()` | Detecta documentos, teléfonos, fechas, especialidades |
| `analyzeIntent()` | Analiza intención con IA (confianza, sentimiento, urgencia) |
| `buildEnrichedContext()` | Construye contexto completo con memorias |
| `generateContextPrompt()` | Genera prompt optimizado para la IA |

#### Entidades Detectables:

```typescript
type EntityType = 
  | 'document'    // 1234567890, CC 123456
  | 'phone'       // +57 300 123 4567
  | 'email'       // usuario@email.com
  | 'date'        // mañana, 15 de enero
  | 'time'        // 8am, 3 de la tarde
  | 'specialty'   // medicina general, odontología
  | 'location'    // sede norte, centro
  | 'person';     // Dr. García
```

#### Análisis de Intención:

```typescript
interface IntentAnalysis {
  primary_intent: string;    // agendar_cita, consultar, cancelar
  confidence: number;        // 0-1
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  entities_mentioned: string[];
  requires_tool: boolean;
  follow_up_needed: boolean;
  suggested_response_tone: string;
}
```

---

### 3. Integración en WhatsAppAIService.ts

**Versión:** 4.0.0

La integración conecta los nuevos servicios con el flujo principal.

#### Flujo de Procesamiento Mejorado:

```
1. Mensaje Entrante
      ↓
2. Extracción de Entidades (EnhancedUnderstanding)
      ↓
3. Análisis de Intención (IA o Reglas)
      ↓
4. Búsqueda de Memorias Relevantes (SemanticMemory)
      ↓
5. Construcción de Contexto Enriquecido
      ↓
6. Generación de Respuesta (Groq/ChatGPT)
      ↓
7. Auto-captura de Información (Post-procesamiento)
      ↓
8. Respuesta al Usuario
```

---

## 🗄️ Tablas de Base de Datos

### whatsapp_semantic_memories

```sql
CREATE TABLE whatsapp_semantic_memories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  patient_id BIGINT UNSIGNED,
  category ENUM('preference', 'medical_info', 'contact_info', 
                'appointment', 'feedback', 'entity', 'fact', 'other'),
  content TEXT NOT NULL,
  embedding LONGTEXT,           -- Vector JSON
  importance DECIMAL(3,2),      -- 0.00 - 1.00
  source ENUM('auto', 'manual', 'tool'),
  metadata LONGTEXT,            -- JSON
  created_at TIMESTAMP,
  last_accessed_at TIMESTAMP,
  access_count INT DEFAULT 0
);
```

### whatsapp_chat_summaries

```sql
CREATE TABLE whatsapp_chat_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  summary TEXT NOT NULL,
  key_points LONGTEXT,         -- JSON array
  appointments_discussed LONGTEXT,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  messages_count INT,
  created_at TIMESTAMP
);
```

### whatsapp_user_preferences

```sql
CREATE TABLE whatsapp_user_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  patient_id BIGINT UNSIGNED,
  preference_key VARCHAR(100),
  preference_value TEXT,
  source ENUM('explicit', 'inferred', 'tool'),
  confidence DECIMAL(3,2),
  last_updated TIMESTAMP
);
```

### whatsapp_bot_analytics

```sql
CREATE TABLE whatsapp_bot_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  metric_type ENUM('intent_accuracy', 'memory_recall', 'tool_usage', 
                   'response_time', 'user_satisfaction'),
  metric_value DECIMAL(10,4),
  context_data LONGTEXT,
  created_at TIMESTAMP
);
```

### Vista: v_whatsapp_full_context

```sql
CREATE VIEW v_whatsapp_full_context AS
SELECT 
    s.id AS session_id,
    s.phone,
    s.patient_id,
    s.current_state,
    s.specialty_name,
    s.selected_doctor,
    p.name AS patient_name,
    p.document AS patient_document,
    cs.summary AS last_summary,
    (SELECT COUNT(*) FROM whatsapp_semantic_memories 
     WHERE session_id = s.id) AS total_memories
FROM whatsapp_chat_sessions s
LEFT JOIN patients p ON s.patient_id = p.id
LEFT JOIN whatsapp_chat_summaries cs ON s.id = cs.session_id;
```

---

## 📊 Ejemplos de Uso

### Ejemplo 1: Auto-captura de Alergia

**Usuario:** "Soy alérgico a la penicilina, por favor téngalo en cuenta"

**Sistema detecta:**
- Categoría: `medical_info`
- Importancia: `0.95`
- Contenido: "Paciente alérgico a la penicilina"

**En siguientes conversaciones:**
"Recuerdo que usted nos comentó sobre su alergia a la penicilina..."

### Ejemplo 2: Preferencia de Doctor

**Usuario:** "Siempre me atiende la doctora García y me gusta mucho como trabaja"

**Sistema detecta:**
- Categoría: `preference`
- Importancia: `0.8`
- Preferencia: Doctor preferido = "Dra. García"

**Al agendar cita:**
"Veo que usted prefiere atenderse con la Dra. García, ¿le gustaría que le busque disponibilidad con ella?"

### Ejemplo 3: Análisis de Intención

**Usuario:** "Necesito cancelar mi cita de mañana urgente!!!"

**Análisis:**
```json
{
  "primary_intent": "cancelar_cita",
  "confidence": 0.95,
  "sentiment": "negative",
  "urgency": "urgent",
  "entities_mentioned": ["fecha:mañana"],
  "requires_tool": true
}
```

---

## ⚙️ Configuración

### Variables de Entorno

```env
# Ya existente
OPENAI_API_KEY=sk-xxx          # Requerido para embeddings

# Configuración de memoria
MEMORY_SIMILARITY_THRESHOLD=0.7
MEMORY_DUPLICATE_THRESHOLD=0.95
MAX_MEMORIES_PER_CAPTURE=3
AUTO_RECALL_LIMIT=5
```

### Parámetros de Búsqueda Semántica

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| EMBEDDING_MODEL | text-embedding-3-small | Modelo de OpenAI |
| EMBEDDING_DIMENSIONS | 1536 | Dimensiones del vector |
| SIMILARITY_THRESHOLD | 0.7 | Similitud mínima para recall |
| DUPLICATE_THRESHOLD | 0.95 | Umbral de duplicados |

---

## 🔍 Monitoreo y Analytics

### Métricas Rastreadas

1. **intent_accuracy** - Precisión de detección de intención
2. **memory_recall** - Efectividad de recuperación de memorias
3. **tool_usage** - Herramientas MCP utilizadas
4. **response_time** - Tiempo de respuesta del bot
5. **user_satisfaction** - Satisfacción inferida

### Consultas de Analytics

```sql
-- Memorias más accedidas
SELECT category, content, access_count, importance
FROM whatsapp_semantic_memories
ORDER BY access_count DESC
LIMIT 10;

-- Resumen de sesiones con contexto
SELECT * FROM v_whatsapp_full_context
WHERE total_memories > 0;

-- Métricas de rendimiento
SELECT metric_type, AVG(metric_value) as avg_value, COUNT(*) as count
FROM whatsapp_bot_analytics
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY metric_type;
```

---

## 🚀 Roadmap Futuro

### Fase 2 - Mejoras Planificadas

- [ ] Implementar LanceDB para búsqueda vectorial real
- [ ] Cache de embeddings para reducir costos API
- [ ] Sistema de "decay" para memorias antiguas
- [ ] Detección de contradicciones en memorias
- [ ] Reportes de analytics en dashboard admin

### Fase 3 - Características Avanzadas

- [ ] Aprendizaje de patrones de respuesta
- [ ] Personalización por tipo de paciente
- [ ] Integración con historial médico
- [ ] Multi-idioma con detección automática

---

## 📝 Notas de Implementación

1. **Embeddings:** Se usa OpenAI text-embedding-3-small por balance costo/calidad
2. **Deduplicación:** Sistema automático para evitar memorias duplicadas
3. **Privacidad:** Las memorias médicas tienen protección especial
4. **Performance:** Las búsquedas usan índices en session_id y patient_id

---

*Documentación creada: 2026-02-03*
*Versión del sistema: WhatsAppAIService v4.0.0*
