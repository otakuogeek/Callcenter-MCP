-- =============================================
-- MIGRACIÓN: Sistema de Seguimiento de Gestación
-- Fecha: 2025-10-12
-- Descripción: Tabla para gestionar el estado de embarazo de pacientes
-- =============================================

-- Tabla principal de gestaciones
CREATE TABLE IF NOT EXISTS pregnancies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  
  -- Estado de la gestación
  status ENUM('Activa', 'Completada', 'Interrumpida') NOT NULL DEFAULT 'Activa',
  
  -- Fechas de la gestación
  start_date DATE NOT NULL COMMENT 'Fecha de inicio de gestación (FUM - Fecha Última Menstruación)',
  expected_due_date DATE NOT NULL COMMENT 'Fecha probable de parto (calculada: FUM + 280 días)',
  actual_end_date DATE NULL COMMENT 'Fecha real de culminación del embarazo',
  
  -- Cálculo de tiempo de gestación
  gestational_weeks_at_registration INT NULL COMMENT 'Semanas de gestación al momento del registro',
  current_gestational_weeks INT NULL COMMENT 'Semanas actuales de gestación (calculado)',
  
  -- Información de interrupción
  interruption_date DATE NULL COMMENT 'Fecha de interrupción del embarazo',
  interruption_reason ENUM(
    'Aborto espontáneo',
    'Aborto terapéutico',
    'Muerte fetal',
    'Embarazo ectópico',
    'Otra causa'
  ) NULL COMMENT 'Causa de la interrupción',
  interruption_notes TEXT NULL COMMENT 'Detalles adicionales sobre la interrupción',
  
  -- Información del parto (si completada)
  delivery_date DATE NULL COMMENT 'Fecha del parto',
  delivery_type ENUM('Parto natural', 'Cesárea', 'Fórceps', 'Vacuum', 'Otro') NULL,
  baby_gender ENUM('Masculino', 'Femenino', 'No especificado') NULL,
  baby_weight_grams INT NULL COMMENT 'Peso del bebé en gramos',
  complications TEXT NULL COMMENT 'Complicaciones durante el embarazo o parto',
  
  -- Control prenatal
  prenatal_controls_count INT DEFAULT 0 COMMENT 'Número de controles prenatales realizados',
  last_prenatal_control_date DATE NULL,
  high_risk BOOLEAN DEFAULT FALSE COMMENT 'Embarazo de alto riesgo',
  risk_factors TEXT NULL COMMENT 'Factores de riesgo identificados',
  
  -- Metadata
  notes TEXT NULL COMMENT 'Notas generales sobre el embarazo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL COMMENT 'Usuario que registró',
  
  -- Índices y relaciones
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_status (patient_id, status),
  INDEX idx_status (status),
  INDEX idx_expected_due_date (expected_due_date),
  INDEX idx_start_date (start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Registro y seguimiento de embarazos de pacientes';

-- Tabla de controles prenatales
CREATE TABLE IF NOT EXISTS prenatal_controls (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pregnancy_id INT UNSIGNED NOT NULL,
  
  -- Información del control
  control_date DATE NOT NULL,
  gestational_weeks INT NOT NULL COMMENT 'Semanas de gestación en el momento del control',
  gestational_days INT DEFAULT 0 COMMENT 'Días adicionales (ej: 20 semanas + 3 días)',
  
  -- Mediciones
  weight_kg DECIMAL(5,2) NULL COMMENT 'Peso de la madre en kg',
  blood_pressure_systolic INT NULL,
  blood_pressure_diastolic INT NULL,
  fundal_height_cm DECIMAL(4,1) NULL COMMENT 'Altura uterina en cm',
  fetal_heart_rate INT NULL COMMENT 'Frecuencia cardíaca fetal (latidos/min)',
  
  -- Observaciones
  observations TEXT NULL,
  recommendations TEXT NULL,
  next_control_date DATE NULL,
  
  -- Exámenes realizados
  lab_tests_ordered TEXT NULL COMMENT 'Exámenes de laboratorio ordenados',
  ultrasound_performed BOOLEAN DEFAULT FALSE,
  ultrasound_notes TEXT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  
  FOREIGN KEY (pregnancy_id) REFERENCES pregnancies(id) ON DELETE CASCADE,
  INDEX idx_pregnancy_date (pregnancy_id, control_date),
  INDEX idx_control_date (control_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Controles prenatales realizados durante el embarazo';

-- Vista para obtener el embarazo activo de una paciente
CREATE OR REPLACE VIEW active_pregnancies AS
SELECT 
  p.id as pregnancy_id,
  p.patient_id,
  pat.name as patient_name,
  pat.document as patient_document,
  p.status,
  p.start_date,
  p.expected_due_date,
  p.high_risk,
  DATEDIFF(CURDATE(), p.start_date) DIV 7 as current_weeks,
  DATEDIFF(CURDATE(), p.start_date) % 7 as current_days,
  DATEDIFF(p.expected_due_date, CURDATE()) as days_until_due,
  p.prenatal_controls_count,
  p.last_prenatal_control_date,
  p.created_at
FROM pregnancies p
INNER JOIN patients pat ON p.patient_id = pat.id
WHERE p.status = 'Activa';

-- Función para calcular la fecha probable de parto (FPP)
-- Regla de Naegele: FUM + 280 días (40 semanas)
DELIMITER //

CREATE FUNCTION IF NOT EXISTS calculate_due_date(start_date DATE)
RETURNS DATE
DETERMINISTIC
BEGIN
  RETURN DATE_ADD(start_date, INTERVAL 280 DAY);
END //

CREATE FUNCTION IF NOT EXISTS calculate_gestational_weeks(start_date DATE, reference_date DATE)
RETURNS INT
DETERMINISTIC
BEGIN
  RETURN DATEDIFF(reference_date, start_date) DIV 7;
END //

CREATE FUNCTION IF NOT EXISTS calculate_gestational_days(start_date DATE, reference_date DATE)
RETURNS INT
DETERMINISTIC
BEGIN
  RETURN DATEDIFF(reference_date, start_date) % 7;
END //

DELIMITER ;

-- Trigger para actualizar automáticamente la fecha probable de parto
DELIMITER //

CREATE TRIGGER IF NOT EXISTS before_pregnancy_insert
BEFORE INSERT ON pregnancies
FOR EACH ROW
BEGIN
  IF NEW.expected_due_date IS NULL THEN
    SET NEW.expected_due_date = calculate_due_date(NEW.start_date);
  END IF;
  
  -- Calcular semanas de gestación al momento del registro
  SET NEW.current_gestational_weeks = calculate_gestational_weeks(NEW.start_date, CURDATE());
END //

CREATE TRIGGER IF NOT EXISTS before_pregnancy_update
BEFORE UPDATE ON pregnancies
FOR EACH ROW
BEGIN
  -- Actualizar semanas actuales de gestación
  IF NEW.status = 'Activa' THEN
    SET NEW.current_gestational_weeks = calculate_gestational_weeks(NEW.start_date, CURDATE());
  END IF;
  
  -- Si se marca como completada, registrar fecha de culminación
  IF NEW.status = 'Completada' AND OLD.status != 'Completada' AND NEW.actual_end_date IS NULL THEN
    SET NEW.actual_end_date = CURDATE();
  END IF;
  
  -- Si se marca como interrumpida, validar que tenga fecha y razón
  IF NEW.status = 'Interrumpida' AND OLD.status != 'Interrumpida' THEN
    IF NEW.interruption_date IS NULL THEN
      SET NEW.interruption_date = CURDATE();
    END IF;
    IF NEW.actual_end_date IS NULL THEN
      SET NEW.actual_end_date = NEW.interruption_date;
    END IF;
  END IF;
END //

-- Trigger para actualizar el contador de controles prenatales
CREATE TRIGGER IF NOT EXISTS after_prenatal_control_insert
AFTER INSERT ON prenatal_controls
FOR EACH ROW
BEGIN
  UPDATE pregnancies 
  SET 
    prenatal_controls_count = prenatal_controls_count + 1,
    last_prenatal_control_date = NEW.control_date
  WHERE id = NEW.pregnancy_id;
END //

DELIMITER ;

-- Datos de ejemplo (comentados - descomentar si se necesitan)
/*
INSERT INTO pregnancies (patient_id, start_date, status, high_risk, notes) VALUES
(1057, '2025-03-15', 'Activa', FALSE, 'Embarazo sin complicaciones'),
(1, '2025-01-20', 'Activa', TRUE, 'Embarazo de alto riesgo - Hipertensión arterial');
*/

-- Verificación
SELECT 'Migración 008: Sistema de Seguimiento de Gestación completada exitosamente' as status;
