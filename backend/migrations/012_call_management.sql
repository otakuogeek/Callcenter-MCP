-- Migración para crear tabla de gestión de llamadas
-- Archivo: 012_call_management.sql

CREATE TABLE IF NOT EXISTS calls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) UNIQUE NOT NULL,
  patient_name VARCHAR(255) NOT NULL,
  patient_phone VARCHAR(20),
  agent_name VARCHAR(255) NOT NULL,
  call_type ENUM('Consulta General', 'Urgencia', 'Seguimiento', 'Información') DEFAULT 'Consulta General',
  status ENUM('active', 'waiting', 'ended') DEFAULT 'waiting',
  priority ENUM('Normal', 'Alta', 'Baja', 'Urgencia') DEFAULT 'Normal',
  start_time TIMESTAMP NULL,
  end_time TIMESTAMP NULL,
  duration INT DEFAULT 0 COMMENT 'Duración en segundos',
  transcript TEXT,
  audio_url TEXT,
  webhook_data JSON,
  webhook_data_end JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_start_time (start_time),
  INDEX idx_created_at (created_at)
);

-- Insertar datos de ejemplo para testing
INSERT INTO calls (conversation_id, patient_name, patient_phone, agent_name, call_type, status, priority, start_time, duration) VALUES
('conv_001', 'María García', '+573001234567', 'Dr. Rodríguez', 'Consulta General', 'active', 'Normal', DATE_SUB(NOW(), INTERVAL 5 MINUTE), 300),
('conv_002', 'Juan Pérez', '+573001234568', 'Dra. López', 'Urgencia', 'active', 'Urgencia', DATE_SUB(NOW(), INTERVAL 2 MINUTE), 120),
('conv_003', 'Ana Martínez', '+573001234569', 'Dr. Torres', 'Seguimiento', 'active', 'Alta', DATE_SUB(NOW(), INTERVAL 8 MINUTE), 480),
('conv_004', 'Carlos Jiménez', '+573001234570', 'Pendiente', 'Consulta General', 'waiting', 'Normal', NULL, 0),
('conv_005', 'Laura Sánchez', '+573001234571', 'Pendiente', 'Urgencia', 'waiting', 'Alta', NULL, 0),
('conv_006', 'Pedro González', '+573001234572', 'Pendiente', 'Información', 'waiting', 'Baja', NULL, 0);
