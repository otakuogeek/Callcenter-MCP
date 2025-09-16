-- Migración para crear tabla de llamadas de voz
-- Fecha: 2024-12-19
-- Descripción: Tabla para registrar llamadas de voz, transcripciones y respuestas del agente

USE biosanar;

-- Crear tabla para logs de llamadas de voz
CREATE TABLE IF NOT EXISTS voice_calls (
    id INT PRIMARY KEY AUTO_INCREMENT,
    call_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'ID único de la llamada desde Zadarma',
    caller_number VARCHAR(20) NOT NULL COMMENT 'Número del que llama',
    called_number VARCHAR(20) NOT NULL COMMENT 'Número llamado (DID)',
    start_time DATETIME NOT NULL COMMENT 'Hora de inicio de la llamada',
    end_time DATETIME NULL COMMENT 'Hora de fin de la llamada',
    duration INT NULL COMMENT 'Duración en segundos',
    recording_url VARCHAR(500) NULL COMMENT 'URL de la grabación en Zadarma',
    transcript TEXT NULL COMMENT 'Transcripción del audio (STT)',
    agent_response TEXT NULL COMMENT 'Respuesta generada por el agente',
    audio_response_url VARCHAR(500) NULL COMMENT 'URL del archivo de audio de respuesta (TTS)',
    patient_id BIGINT UNSIGNED NULL COMMENT 'ID del paciente si fue registrado',
    appointment_created BOOLEAN DEFAULT FALSE COMMENT 'Si se creó una cita',
    status ENUM('incoming', 'processing', 'completed', 'failed') DEFAULT 'incoming' COMMENT 'Estado de la llamada',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
    
    -- Índices para optimizar consultas
    INDEX idx_call_id (call_id),
    INDEX idx_caller_number (caller_number),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status),
    INDEX idx_patient_id (patient_id),
    
    -- Relación con tabla de pacientes (si existe)
    CONSTRAINT fk_voice_calls_patient 
        FOREIGN KEY (patient_id) 
        REFERENCES patients(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Registro de llamadas de voz procesadas por el sistema';

-- Crear tabla para sesiones de llamada (contexto temporal)
CREATE TABLE IF NOT EXISTS voice_call_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    call_id VARCHAR(100) NOT NULL COMMENT 'ID de la llamada',
    session_data JSON NOT NULL COMMENT 'Datos de contexto de la sesión',
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL COMMENT 'Cuando expira la sesión',
    
    -- Índices
    INDEX idx_call_id (call_id),
    INDEX idx_expires_at (expires_at),
    
    -- Relación con llamadas
    CONSTRAINT fk_sessions_voice_calls 
        FOREIGN KEY (call_id) 
        REFERENCES voice_calls(call_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Sesiones temporales de llamadas activas';

-- Crear tabla para métricas de calidad de voz
CREATE TABLE IF NOT EXISTS voice_quality_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    call_id VARCHAR(100) NOT NULL,
    stt_confidence DECIMAL(3,2) NULL COMMENT 'Confianza de la transcripción (0.00-1.00)',
    stt_duration DECIMAL(6,2) NULL COMMENT 'Duración del procesamiento STT en segundos',
    tts_duration DECIMAL(6,2) NULL COMMENT 'Duración del procesamiento TTS en segundos',
    agent_confidence DECIMAL(3,2) NULL COMMENT 'Confianza de la respuesta del agente',
    processing_time DECIMAL(6,2) NULL COMMENT 'Tiempo total de procesamiento',
    audio_quality_score DECIMAL(3,2) NULL COMMENT 'Puntuación de calidad del audio',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_call_id (call_id),
    INDEX idx_created_at (created_at),
    
    -- Relación con llamadas
    CONSTRAINT fk_quality_voice_calls 
        FOREIGN KEY (call_id) 
        REFERENCES voice_calls(call_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Métricas de calidad y rendimiento de llamadas de voz';

-- Insertar datos de configuración del sistema de voz (solo si existe la tabla)
INSERT IGNORE INTO configuration (config_key, config_value, description) 
SELECT * FROM (
  SELECT 'voice_system_enabled', 'true', 'Sistema de llamadas de voz habilitado' UNION ALL
  SELECT 'voice_max_call_duration', '300', 'Duración máxima de llamada en segundos' UNION ALL
  SELECT 'voice_cleanup_interval', '24', 'Intervalo de limpieza de archivos en horas' UNION ALL
  SELECT 'voice_session_timeout', '30', 'Timeout de sesión en minutos' UNION ALL
  SELECT 'voice_recording_retention', '90', 'Días de retención de grabaciones' UNION ALL
  SELECT 'voice_default_language', 'es', 'Idioma por defecto para STT/TTS' UNION ALL
  SELECT 'voice_quality_threshold', '0.70', 'Umbral mínimo de calidad de transcripción'
) AS config_data
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'biosanar' AND table_name = 'configuration');

-- Crear vista para estadísticas de llamadas de voz
CREATE OR REPLACE VIEW voice_call_stats AS
SELECT 
    DATE(start_time) as call_date,
    COUNT(*) as total_calls,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_calls,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_calls,
    AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as avg_duration,
    SUM(CASE WHEN patient_id IS NOT NULL THEN 1 ELSE 0 END) as patients_registered,
    SUM(CASE WHEN appointment_created = 1 THEN 1 ELSE 0 END) as appointments_created,
    COUNT(DISTINCT caller_number) as unique_callers
FROM voice_calls 
WHERE start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(start_time)
ORDER BY call_date DESC;

-- Crear procedimiento para limpiar registros antiguos
DELIMITER $$

CREATE PROCEDURE CleanupOldVoiceCalls(IN days_to_keep INT)
BEGIN
    DECLARE affected_rows INT;
    
    -- Limpiar métricas antiguas
    DELETE FROM voice_quality_metrics 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
    
    -- Limpiar sesiones expiradas
    DELETE FROM voice_call_sessions 
    WHERE expires_at < NOW();
    
    -- Limpiar llamadas completadas muy antiguas (conservar fallidas por más tiempo)
    DELETE FROM voice_calls 
    WHERE start_time < DATE_SUB(NOW(), INTERVAL days_to_keep DAY)
    AND status IN ('completed');
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    -- Log de limpieza (solo si existe la tabla system_logs)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'system_logs') THEN
        INSERT INTO system_logs (level, message, created_at) 
        VALUES ('INFO', CONCAT('Limpieza de llamadas de voz: ', affected_rows, ' registros eliminados'), NOW());
    END IF;
    
END$$

DELIMITER ;

-- Crear evento para limpieza automática (ejecutar diariamente a las 2 AM)
CREATE EVENT IF NOT EXISTS daily_voice_cleanup
ON SCHEDULE EVERY 1 DAY STARTS '2024-12-20 02:00:00'
DO
    CALL CleanupOldVoiceCalls(90);

-- Habilitar el scheduler de eventos si no está habilitado
SET GLOBAL event_scheduler = ON;

-- Crear triggers para auditoría (solo si existe la tabla audit_log)
DELIMITER $$

CREATE TRIGGER voice_calls_audit_insert
    AFTER INSERT ON voice_calls
    FOR EACH ROW
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'audit_log') THEN
        INSERT INTO audit_log (table_name, operation, record_id, new_values, created_at)
        VALUES ('voice_calls', 'INSERT', NEW.id, JSON_OBJECT(
            'call_id', NEW.call_id,
            'caller_number', NEW.caller_number,
            'status', NEW.status
        ), NOW());
    END IF;
END$$

CREATE TRIGGER voice_calls_audit_update
    AFTER UPDATE ON voice_calls
    FOR EACH ROW
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'audit_log') THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values, new_values, created_at)
        VALUES ('voice_calls', 'UPDATE', NEW.id, JSON_OBJECT(
            'status', OLD.status,
            'patient_id', OLD.patient_id,
            'appointment_created', OLD.appointment_created
        ), JSON_OBJECT(
            'status', NEW.status,
            'patient_id', NEW.patient_id,
            'appointment_created', NEW.appointment_created
        ), NOW());
    END IF;
END$$

DELIMITER ;

-- Insertar permisos para el sistema de voz (solo si existe la tabla user_permissions)
INSERT IGNORE INTO user_permissions (permission_name, description) 
SELECT * FROM (
  SELECT 'voice_calls_view', 'Ver llamadas de voz' UNION ALL
  SELECT 'voice_calls_admin', 'Administrar sistema de llamadas de voz' UNION ALL
  SELECT 'voice_stats_view', 'Ver estadísticas de llamadas de voz'
) AS permissions_data
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'biosanar' AND table_name = 'user_permissions');

-- Verificar la estructura creada
SELECT 'Migración de llamadas de voz completada exitosamente' as status;

-- Mostrar información de las tablas creadas
SHOW TABLE STATUS WHERE Name IN ('voice_calls', 'voice_call_sessions', 'voice_quality_metrics');