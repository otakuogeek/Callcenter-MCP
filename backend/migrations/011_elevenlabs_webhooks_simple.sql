-- Migración simplificada para webhooks de ElevenLabs
-- Sin triggers ni stored procedures para evitar problemas de privilegios

-- Tabla para almacenar conversaciones de ElevenLabs
CREATE TABLE IF NOT EXISTS elevenlabs_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NULL,
    status VARCHAR(50) DEFAULT 'completed',
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    duration_secs INT DEFAULT 0,
    cost INT DEFAULT 0, -- Costo en centavos
    transcript_summary TEXT NULL,
    call_successful ENUM('success', 'failure', 'unknown') DEFAULT 'unknown',
    termination_reason VARCHAR(255) NULL,
    full_transcript JSON NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_agent_id (agent_id),
    INDEX idx_user_id (user_id),
    INDEX idx_start_time (start_time),
    INDEX idx_call_successful (call_successful)
);

-- Tabla para notificaciones de llamadas (inicio y fin)
CREATE TABLE IF NOT EXISTS call_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    patient_id BIGINT UNSIGNED NULL,
    agent_id VARCHAR(255) NOT NULL,
    call_type ENUM('started', 'completed') NOT NULL,
    timestamp DATETIME NOT NULL,
    duration_secs INT DEFAULT 0,
    cost INT DEFAULT 0,
    summary TEXT NULL,
    success_status ENUM('success', 'failure', 'unknown') DEFAULT 'unknown',
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_patient_id (patient_id),
    INDEX idx_agent_id (agent_id),
    INDEX idx_call_type (call_type),
    INDEX idx_timestamp (timestamp),
    
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

-- Tabla para almacenar audio de conversaciones (opcional)
CREATE TABLE IF NOT EXISTS elevenlabs_audio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    full_audio LONGTEXT NULL, -- Audio en base64
    file_size_bytes INT DEFAULT 0,
    duration_secs INT DEFAULT 0,
    format VARCHAR(10) DEFAULT 'mp3',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_conversation_audio (conversation_id),
    INDEX idx_conversation_id (conversation_id),
    
    FOREIGN KEY (conversation_id) REFERENCES elevenlabs_conversations(conversation_id) ON DELETE CASCADE
);

-- Tabla para configuración de webhooks
CREATE TABLE IF NOT EXISTS webhook_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    endpoint_url VARCHAR(500) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    webhook_types JSON NOT NULL, -- ['transcription', 'audio']
    retry_count INT DEFAULT 3,
    timeout_seconds INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_service (service_name),
    INDEX idx_service_name (service_name),
    INDEX idx_is_active (is_active)
);

-- Tabla para logs de webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    webhook_config_id INT NOT NULL,
    conversation_id VARCHAR(255) NULL,
    webhook_type ENUM('transcription', 'audio') NOT NULL,
    request_payload JSON NULL,
    response_status INT NULL,
    response_body TEXT NULL,
    processing_time_ms INT DEFAULT 0,
    error_message TEXT NULL,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_webhook_config_id (webhook_config_id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_webhook_type (webhook_type),
    INDEX idx_response_status (response_status),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (webhook_config_id) REFERENCES webhook_config(id) ON DELETE CASCADE
);

-- Insertar configuración inicial para ElevenLabs
INSERT INTO webhook_config (service_name, endpoint_url, secret_key, webhook_types) 
VALUES (
    'elevenlabs', 
    'https://biosanarcall.site/api/webhooks/elevenlabs', 
    'elevenlabs_webhook_secret_2025', 
    JSON_ARRAY('transcription', 'audio')
) ON DUPLICATE KEY UPDATE
    endpoint_url = VALUES(endpoint_url),
    webhook_types = VALUES(webhook_types),
    updated_at = CURRENT_TIMESTAMP;
