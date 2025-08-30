-- Tabla de eventos de llamadas para métricas precisas
CREATE TABLE IF NOT EXISTS call_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  call_id INT NULL,
  conversation_id VARCHAR(255) NOT NULL,
  event_type ENUM('started','ended','transfer','attend','hold') NOT NULL,
  agent_name VARCHAR(255) NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_call_events_type_time (event_type, created_at),
  INDEX idx_call_events_conversation (conversation_id)
) ENGINE=InnoDB;
