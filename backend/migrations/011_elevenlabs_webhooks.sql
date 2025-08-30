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
    
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    FOREIGN KEY (conversation_id) REFERENCES elevenlabs_conversations(conversation_id) ON DELETE CASCADE
);

-- Tabla para estadísticas de llamadas por agente
CREATE TABLE IF NOT EXISTS agent_call_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    total_calls INT DEFAULT 0,
    successful_calls INT DEFAULT 0,
    failed_calls INT DEFAULT 0,
    total_duration_secs INT DEFAULT 0,
    total_cost INT DEFAULT 0,
    avg_call_duration DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_agent_date (agent_id, date),
    INDEX idx_agent_id (agent_id),
    INDEX idx_date (date)
);

-- Vista para estadísticas de llamadas
CREATE OR REPLACE VIEW call_stats_view AS
SELECT 
    DATE(c.start_time) as call_date,
    c.agent_id,
    COUNT(*) as total_calls,
    SUM(CASE WHEN c.call_successful = 'success' THEN 1 ELSE 0 END) as successful_calls,
    SUM(CASE WHEN c.call_successful = 'failure' THEN 1 ELSE 0 END) as failed_calls,
    SUM(c.duration_secs) as total_duration_secs,
    SUM(c.cost) as total_cost,
    AVG(c.duration_secs) as avg_duration_secs,
    AVG(c.cost) as avg_cost
FROM elevenlabs_conversations c
WHERE c.start_time IS NOT NULL
GROUP BY DATE(c.start_time), c.agent_id;

-- Procedimiento para actualizar estadísticas de agente
DELIMITER //
CREATE PROCEDURE UpdateAgentStats(IN p_agent_id VARCHAR(255), IN p_date DATE)
BEGIN
    INSERT INTO agent_call_stats (
        agent_id, 
        date, 
        total_calls, 
        successful_calls, 
        failed_calls, 
        total_duration_secs, 
        total_cost, 
        avg_call_duration
    )
    SELECT 
        agent_id,
        call_date,
        total_calls,
        successful_calls,
        failed_calls,
        total_duration_secs,
        total_cost,
        avg_duration_secs
    FROM call_stats_view 
    WHERE agent_id = p_agent_id AND call_date = p_date
    ON DUPLICATE KEY UPDATE
        total_calls = VALUES(total_calls),
        successful_calls = VALUES(successful_calls),
        failed_calls = VALUES(failed_calls),
        total_duration_secs = VALUES(total_duration_secs),
        total_cost = VALUES(total_cost),
        avg_call_duration = VALUES(avg_call_duration),
        updated_at = CURRENT_TIMESTAMP;
END //
DELIMITER ;

-- Trigger para actualizar estadísticas automáticamente
DELIMITER //
CREATE TRIGGER update_agent_stats_after_conversation
    AFTER INSERT ON elevenlabs_conversations
    FOR EACH ROW
BEGIN
    IF NEW.start_time IS NOT NULL THEN
        CALL UpdateAgentStats(NEW.agent_id, DATE(NEW.start_time));
    END IF;
END //
DELIMITER ;

DELIMITER //
CREATE TRIGGER update_agent_stats_after_conversation_update
    AFTER UPDATE ON elevenlabs_conversations
    FOR EACH ROW
BEGIN
    IF NEW.start_time IS NOT NULL THEN
        CALL UpdateAgentStats(NEW.agent_id, DATE(NEW.start_time));
    END IF;
    
    -- Si cambió la fecha, actualizar también la fecha anterior
    IF OLD.start_time IS NOT NULL AND DATE(OLD.start_time) != DATE(NEW.start_time) THEN
        CALL UpdateAgentStats(OLD.agent_id, DATE(OLD.start_time));
    END IF;
END //
DELIMITER ;
