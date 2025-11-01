-- Tabla para almacenar el historial de SMS enviados
CREATE TABLE IF NOT EXISTS sms_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Información del destinatario
    recipient_number VARCHAR(20) NOT NULL,
    recipient_name VARCHAR(255) DEFAULT NULL,
    
    -- Contenido del mensaje
    message TEXT NOT NULL,
    
    -- Información del envío
    sender_id VARCHAR(50) DEFAULT NULL COMMENT 'Caller ID / Remitente',
    template_id VARCHAR(100) DEFAULT NULL COMMENT 'ID de plantilla si se usó',
    
    -- Respuesta de Zadarma
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    zadarma_response JSON DEFAULT NULL COMMENT 'Respuesta completa de la API',
    messages_sent INT DEFAULT 0,
    cost DECIMAL(10, 4) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    parts INT DEFAULT 1 COMMENT 'Número de partes del SMS',
    
    -- Errores
    error_message TEXT DEFAULT NULL,
    
    -- Relaciones opcionales
    patient_id INT DEFAULT NULL,
    appointment_id INT DEFAULT NULL,
    user_id INT DEFAULT NULL COMMENT 'Usuario que envió el SMS',
    
    -- Metadata
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_recipient_number (recipient_number),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at),
    INDEX idx_patient_id (patient_id),
    INDEX idx_appointment_id (appointment_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para estadísticas mensuales de SMS
CREATE TABLE IF NOT EXISTS sms_monthly_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    month INT NOT NULL,
    
    total_sent INT DEFAULT 0,
    total_success INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    total_cost DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_year_month (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
