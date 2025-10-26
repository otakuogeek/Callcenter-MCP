-- Tabla para almacenar conversaciones de ElevenLabs
CREATE TABLE IF NOT EXISTS elevenlabs_conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL UNIQUE,
  agent_id VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  user_id VARCHAR(255),
  patient_id BIGINT UNSIGNED,
  appointment_id BIGINT UNSIGNED,
  status VARCHAR(50) DEFAULT 'initiated',
  start_time TIMESTAMP NULL,
  end_time TIMESTAMP NULL,
  duration_secs INT,
  cost DECIMAL(10, 4),
  call_successful VARCHAR(50),
  transcript_summary TEXT,
  termination_reason VARCHAR(100),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_patient_id (patient_id),
  INDEX idx_appointment_id (appointment_id),
  INDEX idx_phone_number (phone_number),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para almacenar transcripciones detalladas
CREATE TABLE IF NOT EXISTS elevenlabs_transcriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'agent' o 'user'
  message TEXT NOT NULL,
  timestamp_secs DECIMAL(15, 3),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_role (role),
  FOREIGN KEY (conversation_id) REFERENCES elevenlabs_conversations(conversation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para almacenar análisis de llamadas
CREATE TABLE IF NOT EXISTS elevenlabs_analysis (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL UNIQUE,
  evaluation_criteria_results JSON,
  latency_metrics JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation_id (conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES elevenlabs_conversations(conversation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para almacenar audio de llamadas (si está habilitado)
CREATE TABLE IF NOT EXISTS elevenlabs_audio (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  audio_url VARCHAR(500),
  audio_base64 LONGTEXT,
  audio_size_bytes INT,
  duration_secs INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation_id (conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES elevenlabs_conversations(conversation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para almacenar errores de llamadas
CREATE TABLE IF NOT EXISTS elevenlabs_call_errors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(20),
  patient_id BIGINT UNSIGNED,
  error_details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_patient_id (patient_id),
  INDEX idx_phone_number (phone_number),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vista para consultas rápidas de llamadas recientes
CREATE OR REPLACE VIEW elevenlabs_recent_calls AS
SELECT 
  ec.id,
  ec.conversation_id,
  ec.phone_number,
  ec.status,
  ec.start_time,
  ec.end_time,
  ec.duration_secs,
  ec.cost,
  ec.call_successful,
  ec.transcript_summary,
  ec.created_at,
  p.id as patient_id,
  p.name as patient_name,
  p.document as patient_document,
  a.id as appointment_id,
  a.scheduled_at as appointment_date
FROM elevenlabs_conversations ec
LEFT JOIN patients p ON ec.patient_id = p.id
LEFT JOIN appointments a ON ec.appointment_id = a.id
ORDER BY ec.created_at DESC
LIMIT 100;
