-- =====================================================
-- TABLA DE PERSISTENCIA DE CONVERSACIONES WHATSAPP
-- Cada conversación tiene su archivo JSON único
-- =====================================================

CREATE TABLE IF NOT EXISTS whatsapp_conversation_persistence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Identificador único de la conversación (número de teléfono normalizado)
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    
    -- Relación con paciente si existe
    patient_id INT NULL,
    document_number VARCHAR(20) NULL,
    
    -- Ruta al archivo JSON de la conversación
    json_file_path VARCHAR(255) NOT NULL,
    
    -- Datos del paciente conocidos (cache rápido)
    patient_name VARCHAR(100) NULL,
    patient_first_name VARCHAR(50) NULL,
    patient_eps VARCHAR(100) NULL,
    
    -- Estado de la conversación
    conversation_state ENUM('new', 'identified', 'scheduling', 'completed', 'inactive') DEFAULT 'new',
    
    -- Última especialidad/servicio solicitado
    last_specialty_requested VARCHAR(100) NULL,
    last_availability_id INT NULL,
    
    -- Metadatos
    message_count INT DEFAULT 0,
    last_message_at TIMESTAMP NULL,
    first_contact_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Resumen de lo conversado (para contexto rápido)
    conversation_summary TEXT NULL,
    
    -- Citas agendadas en esta conversación
    appointments_scheduled JSON NULL,
    
    -- Índices para búsqueda rápida
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_phone (phone_number),
    INDEX idx_patient (patient_id),
    INDEX idx_document (document_number),
    INDEX idx_state (conversation_state),
    INDEX idx_last_message (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para historial de mensajes (opcional, para análisis)
CREATE TABLE IF NOT EXISTS whatsapp_message_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    
    -- Dirección del mensaje
    direction ENUM('incoming', 'outgoing') NOT NULL,
    
    -- Contenido
    message_text TEXT NULL,
    message_type ENUM('text', 'audio', 'image', 'document') DEFAULT 'text',
    
    -- Metadatos
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Datos extraídos del mensaje
    extracted_data JSON NULL,
    
    FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversation_persistence(id) ON DELETE CASCADE,
    INDEX idx_conversation (conversation_id),
    INDEX idx_processed (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
