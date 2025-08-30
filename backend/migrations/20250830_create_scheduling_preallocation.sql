-- Crea tablas para distribución aleatoria de cupos previos a una fecha objetivo
-- Ejecutar este script una sola vez (idempotente con CREATE IF NOT EXISTS / ALTER condicional)

-- Tabla principal de preasignaciones por día de liberación
CREATE TABLE IF NOT EXISTS scheduling_preallocation (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT NULL,
  specialty_id INT NULL,
  location_id INT NULL,
  availability_id BIGINT NULL,
  target_date DATE NOT NULL COMMENT 'Fecha de la consulta / agenda objetivo',
  pre_date DATE NOT NULL COMMENT 'Día hábil previo en que se liberan estos cupos',
  slots INT NOT NULL COMMENT 'Cupos planificados a liberar ese día',
  assigned_count INT NOT NULL DEFAULT 0 COMMENT 'Citas ya asignadas utilizando este cupo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_doctor (doctor_id),
  KEY idx_specialty (specialty_id),
  KEY idx_location (location_id),
  KEY idx_availability (availability_id),
  KEY idx_target (target_date),
  KEY idx_pre_date (pre_date),
  KEY idx_target_doctor (target_date, doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de asignaciones individuales (paciente por cupo)
CREATE TABLE IF NOT EXISTS scheduling_preallocation_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  preallocation_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_preallocation_assignment FOREIGN KEY (preallocation_id) REFERENCES scheduling_preallocation(id) ON DELETE CASCADE,
  KEY idx_patient (patient_id),
  KEY idx_preallocation (preallocation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vista de resumen por target_date
CREATE OR REPLACE VIEW v_scheduling_preallocation_summary AS
SELECT 
  target_date,
  doctor_id,
  specialty_id,
  location_id,
  SUM(slots) AS total_slots,
  SUM(assigned_count) AS total_assigned,
  SUM(slots) - SUM(assigned_count) AS remaining_slots,
  COUNT(*) AS days_count,
  MIN(pre_date) AS first_release_day,
  MAX(pre_date) AS last_release_day
FROM scheduling_preallocation
GROUP BY target_date, doctor_id, specialty_id, location_id;

-- Procedimiento para registrar asignación (incrementa assigned_count de forma segura)
DROP PROCEDURE IF EXISTS assign_preallocation_slot;
DELIMITER $$
CREATE PROCEDURE assign_preallocation_slot(IN p_preallocation_id BIGINT, IN p_patient_id BIGINT, IN p_appointment_id BIGINT)
BEGIN
  UPDATE scheduling_preallocation 
    SET assigned_count = assigned_count + 1
    WHERE id = p_preallocation_id AND assigned_count < slots;
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No hay cupos disponibles en esta preasignación';
  END IF;
  INSERT INTO scheduling_preallocation_assignments(preallocation_id, patient_id, appointment_id)
    VALUES(p_preallocation_id, p_patient_id, p_appointment_id);
END $$

-- Procedimiento para liberar (ej: cancelación de cita)
DROP PROCEDURE IF EXISTS release_preallocation_slot;
CREATE PROCEDURE release_preallocation_slot(IN p_appointment_id BIGINT)
BEGIN
  DECLARE v_preallocation_id BIGINT;
  SELECT preallocation_id INTO v_preallocation_id FROM scheduling_preallocation_assignments WHERE appointment_id = p_appointment_id LIMIT 1;
  IF v_preallocation_id IS NOT NULL THEN
    DELETE FROM scheduling_preallocation_assignments WHERE appointment_id = p_appointment_id LIMIT 1;
    UPDATE scheduling_preallocation SET assigned_count = GREATEST(0, assigned_count - 1) WHERE id = v_preallocation_id;
  END IF;
END $$
DELIMITER ;
