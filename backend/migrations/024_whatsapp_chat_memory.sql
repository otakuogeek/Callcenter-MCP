-- ============================================================================
-- MIGRACIÓN: Sistema de Memoria para WhatsApp Chat
-- Fecha: 2026-01-21
-- Descripción: Tablas para almacenar conversaciones y contexto del chat
-- ============================================================================

-- Tabla principal de sesiones de chat
CREATE TABLE IF NOT EXISTS whatsapp_chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL COMMENT 'Número de teléfono del usuario',
  patient_id BIGINT(20) UNSIGNED NULL COMMENT 'ID del paciente si está identificado',
  patient_name VARCHAR(255) NULL COMMENT 'Nombre del paciente para contexto rápido',
  patient_document VARCHAR(20) NULL COMMENT 'Documento del paciente',
  current_state VARCHAR(50) DEFAULT 'idle' COMMENT 'Estado actual de la conversación',
  last_specialty_id INT NULL COMMENT 'Última especialidad consultada',
  last_location_id INT NULL COMMENT 'Última sede consultada',
  metadata JSON NULL COMMENT 'Datos adicionales en formato JSON',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Última actividad del usuario',
  
  UNIQUE KEY idx_phone (phone),
  KEY idx_patient_id (patient_id),
  KEY idx_last_activity (last_activity_at),
  
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de mensajes del chat (historial)
CREATE TABLE IF NOT EXISTS whatsapp_chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL COMMENT 'ID de la sesión de chat',
  role ENUM('user', 'assistant', 'system', 'tool') NOT NULL COMMENT 'Rol del mensaje',
  content TEXT NOT NULL COMMENT 'Contenido del mensaje',
  tool_name VARCHAR(100) NULL COMMENT 'Nombre de la herramienta si es mensaje de tool',
  tool_result JSON NULL COMMENT 'Resultado de la herramienta en JSON',
  tokens_used INT NULL COMMENT 'Tokens utilizados (para métricas)',
  response_time_ms INT NULL COMMENT 'Tiempo de respuesta en ms',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_session_id (session_id),
  KEY idx_created_at (created_at),
  KEY idx_role (role),
  
  FOREIGN KEY (session_id) REFERENCES whatsapp_chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de resúmenes de conversación (para contexto largo plazo)
CREATE TABLE IF NOT EXISTS whatsapp_chat_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  summary TEXT NOT NULL COMMENT 'Resumen de la conversación',
  key_points JSON NULL COMMENT 'Puntos clave extraídos',
  appointments_discussed JSON NULL COMMENT 'Citas discutidas en la conversación',
  period_start TIMESTAMP NOT NULL COMMENT 'Inicio del período resumido',
  period_end TIMESTAMP NOT NULL COMMENT 'Fin del período resumido',
  messages_count INT DEFAULT 0 COMMENT 'Cantidad de mensajes resumidos',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_session_id (session_id),
  KEY idx_period (period_start, period_end),
  
  FOREIGN KEY (session_id) REFERENCES whatsapp_chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de preferencias del usuario
CREATE TABLE IF NOT EXISTS whatsapp_user_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  preferred_specialty_id INT NULL COMMENT 'Especialidad preferida',
  preferred_location_id INT NULL COMMENT 'Sede preferida',
  preferred_doctor_id INT NULL COMMENT 'Médico preferido',
  language VARCHAR(10) DEFAULT 'es' COMMENT 'Idioma preferido',
  notification_preferences JSON NULL COMMENT 'Preferencias de notificación',
  notes TEXT NULL COMMENT 'Notas adicionales sobre el usuario',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para búsqueda rápida de mensajes recientes por teléfono
CREATE INDEX idx_messages_recent ON whatsapp_chat_messages (session_id, created_at DESC);

-- Vista para obtener el último contexto de cada sesión
CREATE OR REPLACE VIEW v_whatsapp_session_context AS
SELECT 
  s.id as session_id,
  s.phone,
  s.patient_id,
  s.patient_name,
  s.patient_document,
  s.current_state,
  s.last_specialty_id,
  s.last_location_id,
  s.last_activity_at,
  sp.name as last_specialty_name,
  l.name as last_location_name,
  p.name as patient_full_name,
  p.phone as patient_phone,
  eps.name as patient_eps_name,
  (SELECT COUNT(*) FROM whatsapp_chat_messages m WHERE m.session_id = s.id) as total_messages,
  (SELECT created_at FROM whatsapp_chat_messages m WHERE m.session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message_at
FROM whatsapp_chat_sessions s
LEFT JOIN patients p ON s.patient_id = p.id
LEFT JOIN eps ON p.insurance_eps_id = eps.id
LEFT JOIN specialties sp ON s.last_specialty_id = sp.id
LEFT JOIN locations l ON s.last_location_id = l.id;

-- Procedimiento para limpiar mensajes antiguos (mantener últimos 30 días)
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS cleanup_old_chat_messages()
BEGIN
  DECLARE cutoff_date TIMESTAMP;
  SET cutoff_date = DATE_SUB(NOW(), INTERVAL 30 DAY);
  
  -- Crear resúmenes antes de eliminar
  INSERT INTO whatsapp_chat_summaries (session_id, summary, period_start, period_end, messages_count)
  SELECT 
    session_id,
    CONCAT('Conversación con ', COUNT(*), ' mensajes'),
    MIN(created_at),
    MAX(created_at),
    COUNT(*)
  FROM whatsapp_chat_messages
  WHERE created_at < cutoff_date
  GROUP BY session_id
  HAVING COUNT(*) > 0;
  
  -- Eliminar mensajes antiguos
  DELETE FROM whatsapp_chat_messages WHERE created_at < cutoff_date;
  
  -- Eliminar sesiones sin actividad en 90 días
  DELETE FROM whatsapp_chat_sessions 
  WHERE last_activity_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
  AND id NOT IN (SELECT DISTINCT session_id FROM whatsapp_chat_messages);
END //
DELIMITER ;

-- Evento para ejecutar limpieza automática (ejecutar cada semana)
-- Nota: Requiere que event_scheduler esté habilitado
-- SET GLOBAL event_scheduler = ON;
CREATE EVENT IF NOT EXISTS evt_cleanup_chat_messages
ON SCHEDULE EVERY 1 WEEK
STARTS CURRENT_TIMESTAMP
DO CALL cleanup_old_chat_messages();
