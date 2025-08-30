-- Tabla para plantillas de disponibilidad
CREATE TABLE IF NOT EXISTS availability_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  doctor_id INT,
  specialty_id INT, 
  location_id INT,
  duration_minutes INT NOT NULL DEFAULT 30,
  time_slots JSON NOT NULL, -- Array de objetos {start_time, end_time, capacity}
  days_of_week JSON NOT NULL, -- Array de números [0-6] donde 0=domingo
  is_active BOOLEAN DEFAULT true,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_doctor_id (doctor_id),
  INDEX idx_specialty_id (specialty_id),
  INDEX idx_location_id (location_id),
  INDEX idx_is_active (is_active),
  INDEX idx_created_by (created_by)
);

-- Agregar columna template_id a la tabla availabilities para rastrear origen
ALTER TABLE availabilities 
ADD COLUMN template_id INT AFTER status,
ADD INDEX idx_template_id (template_id);

-- Comentarios para documentar la estructura
ALTER TABLE availability_templates 
COMMENT = 'Plantillas reutilizables para generar agendas de disponibilidad';

COMMENT ON COLUMN availability_templates.time_slots IS 
'JSON array con objetos {start_time: "HH:MM", end_time: "HH:MM", capacity: number}';

COMMENT ON COLUMN availability_templates.days_of_week IS 
'JSON array con números 0-6 representando días (0=domingo, 1=lunes, etc.)';

-- Trigger para actualizar updated_at automáticamente
DELIMITER $$
CREATE TRIGGER tr_availability_templates_updated_at
  BEFORE UPDATE ON availability_templates
  FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$
DELIMITER ;

-- Insertar algunas plantillas de ejemplo
INSERT INTO availability_templates (
  name, description, duration_minutes, time_slots, days_of_week, is_active
) VALUES 
(
  'Medicina General - Estándar',
  'Consultas de medicina general cada 30 minutos',
  30,
  '[{"start_time": "08:00", "end_time": "12:00", "capacity": 1}, {"start_time": "14:00", "end_time": "18:00", "capacity": 1}]',
  '[1, 2, 3, 4, 5]',
  true
),
(
  'Cardiología - Intensivo', 
  'Consultas especializadas de 45 minutos',
  45,
  '[{"start_time": "08:00", "end_time": "11:15", "capacity": 1}, {"start_time": "14:00", "end_time": "17:15", "capacity": 1}]',
  '[1, 2, 3, 4, 5]',
  true
),
(
  'Pediatría - Familiar',
  'Consultas pediátricas con tiempo extendido',
  20,
  '[{"start_time": "08:00", "end_time": "12:00", "capacity": 1}, {"start_time": "15:00", "end_time": "18:00", "capacity": 1}]',
  '[1, 2, 3, 4, 5]',
  true
),
(
  'Emergencias - 24/7',
  'Atención de emergencias las 24 horas',
  15,
  '[{"start_time": "00:00", "end_time": "23:59", "capacity": 2}]',
  '[0, 1, 2, 3, 4, 5, 6]',
  true
),
(
  'Consultorios Múltiples',
  'Múltiples consultorios funcionando en paralelo',
  30,
  '[{"start_time": "08:00", "end_time": "12:00", "capacity": 3}, {"start_time": "14:00", "end_time": "18:00", "capacity": 3}]',
  '[1, 2, 3, 4, 5]',
  true
);
