-- ============================================================================
-- MIGRACIÓN: Sistema de Memoria Semántica para WhatsApp
-- Fecha: 2026-02-03
-- Descripción: Tabla de memorias con soporte para búsqueda vectorial
-- Inspirado en moltbot memory-lancedb
-- ============================================================================

-- Tabla de memorias semánticas (con embeddings para búsqueda vectorial)
CREATE TABLE IF NOT EXISTS whatsapp_semantic_memories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL COMMENT 'ID de la sesión de chat',
  patient_id BIGINT(20) UNSIGNED NULL COMMENT 'ID del paciente si está identificado',
  
  -- Categorización
  category ENUM(
    'preference',    -- Preferencias del usuario (doctor preferido, horario, sede)
    'medical_info',  -- Información médica (alergias, condiciones)
    'contact_info',  -- Información de contacto (teléfono, dirección)
    'appointment',   -- Historial de citas
    'feedback',      -- Retroalimentación del servicio
    'entity',        -- Entidades mencionadas (nombres, fechas importantes)
    'fact',          -- Hechos sobre el paciente
    'other'          -- Otros
  ) NOT NULL DEFAULT 'other',
  
  -- Contenido
  content TEXT NOT NULL COMMENT 'Contenido de la memoria',
  embedding JSON NULL COMMENT 'Vector embedding (1536 dimensiones para text-embedding-3-small)',
  
  -- Relevancia y origen
  importance DECIMAL(3,2) DEFAULT 0.70 COMMENT 'Importancia de la memoria (0.00-1.00)',
  source ENUM('auto', 'manual', 'tool') DEFAULT 'auto' COMMENT 'Origen de la memoria',
  
  -- Metadata adicional
  metadata JSON NULL COMMENT 'Datos adicionales en formato JSON',
  
  -- Timestamps y contadores
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  access_count INT DEFAULT 0 COMMENT 'Veces que se ha accedido a esta memoria',
  
  -- Índices
  KEY idx_session_id (session_id),
  KEY idx_patient_id (patient_id),
  KEY idx_category (category),
  KEY idx_importance (importance DESC),
  KEY idx_created_at (created_at DESC),
  KEY idx_session_category (session_id, category),
  
  -- Foreign keys
  FOREIGN KEY (session_id) REFERENCES whatsapp_chat_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Agregar campos adicionales a whatsapp_chat_sessions si no existen
-- ============================================================================

-- Campo para almacenar disponibilidad seleccionada
ALTER TABLE whatsapp_chat_sessions 
ADD COLUMN IF NOT EXISTS availability_id INT NULL COMMENT 'ID de disponibilidad seleccionada';

-- Campo para almacenar doctor seleccionado
ALTER TABLE whatsapp_chat_sessions 
ADD COLUMN IF NOT EXISTS selected_doctor VARCHAR(255) NULL COMMENT 'Nombre del doctor seleccionado';

ALTER TABLE whatsapp_chat_sessions 
ADD COLUMN IF NOT EXISTS selected_doctor_id INT NULL COMMENT 'ID del doctor seleccionado';

-- Campo para almacenar fecha/hora seleccionada
ALTER TABLE whatsapp_chat_sessions 
ADD COLUMN IF NOT EXISTS selected_date DATE NULL COMMENT 'Fecha seleccionada para cita';

ALTER TABLE whatsapp_chat_sessions 
ADD COLUMN IF NOT EXISTS selected_time TIME NULL COMMENT 'Hora seleccionada para cita';

-- Campo para especialidad
ALTER TABLE whatsapp_chat_sessions 
ADD COLUMN IF NOT EXISTS specialty_name VARCHAR(100) NULL COMMENT 'Nombre de especialidad seleccionada';

-- Contador de citas agendadas en esta sesión
ALTER TABLE whatsapp_chat_sessions 
ADD COLUMN IF NOT EXISTS appointments_scheduled INT DEFAULT 0 COMMENT 'Citas agendadas en esta sesión';

-- Última cita agendada
ALTER TABLE whatsapp_chat_sessions 
ADD COLUMN IF NOT EXISTS last_appointment_id INT NULL COMMENT 'Última cita agendada';

-- ============================================================================
-- Vista mejorada para obtener contexto completo
-- ============================================================================

CREATE OR REPLACE VIEW v_whatsapp_full_context AS
SELECT 
  s.id as session_id,
  s.phone,
  s.patient_id,
  s.patient_name,
  s.patient_document,
  s.current_state,
  s.last_specialty_id,
  s.last_location_id,
  s.specialty_name,
  s.selected_doctor,
  s.selected_date,
  s.selected_time,
  s.appointments_scheduled,
  s.last_activity_at,
  
  -- Info del paciente
  p.name as patient_full_name,
  p.phone as patient_phone,
  p.birth_date,
  eps.name as patient_eps_name,
  
  -- Contadores
  (SELECT COUNT(*) FROM whatsapp_chat_messages m WHERE m.session_id = s.id) as total_messages,
  (SELECT COUNT(*) FROM whatsapp_semantic_memories mem WHERE mem.session_id = s.id) as total_memories,
  
  -- Última interacción
  (SELECT created_at FROM whatsapp_chat_messages m WHERE m.session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
  
  -- Preferencias del usuario
  pref.preferred_specialty_id,
  pref.preferred_location_id,
  pref.preferred_doctor_id,
  pref.notes as user_notes,
  
  -- Resumen más reciente
  (SELECT summary FROM whatsapp_chat_summaries sum WHERE sum.session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_summary

FROM whatsapp_chat_sessions s
LEFT JOIN patients p ON s.patient_id = p.id
LEFT JOIN eps ON p.insurance_eps_id = eps.id
LEFT JOIN whatsapp_user_preferences pref ON s.phone = pref.phone;

-- ============================================================================
-- Procedimiento para limpieza de memorias antiguas
-- ============================================================================

DROP PROCEDURE IF EXISTS cleanup_old_semantic_memories;

DELIMITER //
CREATE PROCEDURE cleanup_old_semantic_memories()
BEGIN
  DECLARE cutoff_date TIMESTAMP;
  SET cutoff_date = DATE_SUB(NOW(), INTERVAL 90 DAY);
  
  -- Eliminar memorias con baja importancia y sin accesos recientes
  DELETE FROM whatsapp_semantic_memories 
  WHERE importance < 0.5 
    AND access_count < 3 
    AND last_accessed_at < cutoff_date;
  
  -- Mantener siempre las memorias de alta importancia (médicas, preferencias)
  -- incluso si son antiguas
  
  SELECT ROW_COUNT() as deleted_memories;
END //
DELIMITER ;

-- ============================================================================
-- Índice de texto completo para búsqueda de contenido
-- ============================================================================

ALTER TABLE whatsapp_semantic_memories 
ADD FULLTEXT INDEX ft_content (content);

-- ============================================================================
-- Tabla de log de acciones del bot (para análisis y mejora)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_bot_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  action_type ENUM(
    'message_received',
    'message_sent', 
    'tool_called',
    'memory_recalled',
    'memory_stored',
    'patient_identified',
    'appointment_scheduled',
    'error_occurred',
    'session_started',
    'session_ended'
  ) NOT NULL,
  action_details JSON NULL COMMENT 'Detalles de la acción',
  response_time_ms INT NULL COMMENT 'Tiempo de respuesta en ms',
  tokens_used INT NULL COMMENT 'Tokens utilizados',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_session_id (session_id),
  KEY idx_action_type (action_type),
  KEY idx_created_at (created_at),
  
  FOREIGN KEY (session_id) REFERENCES whatsapp_chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
