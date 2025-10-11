-- ============================================================================
-- SISTEMA DE LISTA DE ESPERA PARA CITAS MÉDICAS
-- ============================================================================
-- Propósito: Almacenar solicitudes de citas cuando no hay cupos disponibles
-- Uso: scheduleAppointment guarda aquí cuando slots_available = 0
-- Reasignación: reassignWaitingListAppointments mueve a appointments cuando hay cupos
-- ============================================================================

-- Crear tabla de lista de espera
CREATE TABLE IF NOT EXISTS `appointments_waiting_list` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` BIGINT(20) UNSIGNED NOT NULL COMMENT 'ID del paciente que solicita la cita',
  `availability_id` BIGINT(20) UNSIGNED NOT NULL COMMENT 'ID de la disponibilidad solicitada',
  `scheduled_date` DATETIME NOT NULL COMMENT 'Fecha/hora solicitada para la cita',
  `appointment_type` ENUM('Presencial', 'Telemedicina') NOT NULL DEFAULT 'Presencial' COMMENT 'Tipo de consulta',
  `reason` TEXT NOT NULL COMMENT 'Motivo de la consulta',
  `notes` TEXT NULL COMMENT 'Notas adicionales del paciente o agente',
  `priority_level` ENUM('Baja', 'Normal', 'Alta', 'Urgente') NOT NULL DEFAULT 'Normal' COMMENT 'Nivel de prioridad para reasignación',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Momento en que se agregó a lista de espera',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `requested_by` VARCHAR(100) NULL COMMENT 'Usuario/agente que hizo la solicitud',
  `status` ENUM('pending', 'reassigned', 'cancelled', 'expired') NOT NULL DEFAULT 'pending' COMMENT 'Estado de la solicitud',
  `reassigned_at` TIMESTAMP NULL COMMENT 'Momento en que se reasignó a appointments',
  `reassigned_appointment_id` BIGINT(20) UNSIGNED NULL COMMENT 'ID de la cita creada al reasignar',
  `cancelled_reason` TEXT NULL COMMENT 'Razón de cancelación si aplica',
  `expires_at` DATETIME NULL COMMENT 'Fecha de expiración de la solicitud',
  
  PRIMARY KEY (`id`),
  INDEX `idx_patient_id` (`patient_id`),
  INDEX `idx_availability_id` (`availability_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_priority_level` (`priority_level`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_scheduled_date` (`scheduled_date`),
  INDEX `idx_status_priority` (`status`, `priority_level`, `created_at`) COMMENT 'Índice compuesto para ordenar reasignaciones',
  
  CONSTRAINT `fk_waiting_list_patient` 
    FOREIGN KEY (`patient_id`) 
    REFERENCES `patients` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  CONSTRAINT `fk_waiting_list_availability` 
    FOREIGN KEY (`availability_id`) 
    REFERENCES `availabilities` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  CONSTRAINT `fk_waiting_list_reassigned_appointment` 
    FOREIGN KEY (`reassigned_appointment_id`) 
    REFERENCES `appointments` (`id`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lista de espera para citas cuando no hay cupos disponibles';

-- ============================================================================
-- VISTA: waiting_list_with_details
-- ============================================================================
-- Propósito: Vista enriquecida con información de paciente, doctor, especialidad
-- Uso: Consultas rápidas para mostrar lista de espera con contexto completo
-- ============================================================================

CREATE OR REPLACE VIEW `waiting_list_with_details` AS
SELECT 
  wl.id AS waiting_list_id,
  wl.status,
  wl.priority_level,
  wl.scheduled_date AS requested_date,
  wl.appointment_type,
  wl.reason,
  wl.notes,
  wl.created_at AS added_to_waiting_list_at,
  wl.expires_at,
  DATEDIFF(wl.expires_at, NOW()) AS days_until_expiration,
  
  -- Información del paciente
  p.id AS patient_id,
  p.name AS patient_name,
  p.document AS patient_document,
  p.phone AS patient_phone,
  p.email AS patient_email,
  
  -- Información de la disponibilidad
  a.id AS availability_id,
  a.date AS availability_date,
  a.start_time,
  a.end_time,
  a.duration_minutes,
  
  -- Cupos actuales (para ver cuándo hay espacio)
  (
    SELECT 
      COALESCE(SUM(ad.quota), 0)
    FROM availability_distribution ad
    WHERE ad.availability_id = a.id
  ) AS total_quota_distributed,
  a.capacity AS total_capacity,
  (
    SELECT COUNT(*)
    FROM appointments app
    WHERE app.availability_id = a.id 
      AND app.status IN ('Pendiente', 'Confirmada')
  ) AS current_appointments_count,
  (
    a.capacity - (
      SELECT COUNT(*)
      FROM appointments app
      WHERE app.availability_id = a.id 
        AND app.status IN ('Pendiente', 'Confirmada')
    )
  ) AS slots_currently_available,
  
  -- Información del doctor
  d.id AS doctor_id,
  d.name AS doctor_name,
  d.email AS doctor_email,
  
  -- Información de la especialidad
  s.id AS specialty_id,
  s.name AS specialty_name,
  
  -- Información de la ubicación
  l.id AS location_id,
  l.name AS location_name,
  l.address AS location_address,
  
  -- Información de reasignación (si aplica)
  wl.reassigned_at,
  wl.reassigned_appointment_id,
  
  -- Posición en la cola (calculada por prioridad y tiempo)
  (
    SELECT COUNT(*) + 1
    FROM appointments_waiting_list wl2
    WHERE wl2.availability_id = wl.availability_id
      AND wl2.status = 'pending'
      AND (
        (wl2.priority_level = 'Urgente' AND wl.priority_level != 'Urgente')
        OR (wl2.priority_level = 'Alta' AND wl.priority_level NOT IN ('Urgente', 'Alta'))
        OR (wl2.priority_level = 'Normal' AND wl.priority_level = 'Baja')
        OR (wl2.priority_level = wl.priority_level AND wl2.created_at < wl.created_at)
      )
  ) AS queue_position

FROM appointments_waiting_list wl
INNER JOIN patients p ON wl.patient_id = p.id
INNER JOIN availabilities a ON wl.availability_id = a.id
INNER JOIN doctors d ON a.doctor_id = d.id
INNER JOIN specialties s ON a.specialty_id = s.id
INNER JOIN locations l ON a.location_id = l.id
WHERE wl.status = 'pending'
ORDER BY 
  -- Ordenar por prioridad (Urgente primero)
  CASE wl.priority_level
    WHEN 'Urgente' THEN 1
    WHEN 'Alta' THEN 2
    WHEN 'Normal' THEN 3
    WHEN 'Baja' THEN 4
  END,
  -- Luego por antigüedad (FIFO dentro de cada prioridad)
  wl.created_at ASC;

-- ============================================================================
-- PROCEDIMIENTO: process_waiting_list_for_availability
-- ============================================================================
-- Propósito: Reasignar automáticamente desde lista de espera cuando hay cupos
-- Uso: Se ejecuta manualmente o vía trigger cuando se libera un cupo
-- Parámetros: availability_id para procesar
-- ============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS `process_waiting_list_for_availability`$$

CREATE PROCEDURE `process_waiting_list_for_availability`(
  IN p_availability_id BIGINT(20) UNSIGNED
)
BEGIN
  DECLARE v_slots_available INT DEFAULT 0;
  DECLARE v_waiting_id BIGINT(20) UNSIGNED;
  DECLARE v_patient_id BIGINT(20) UNSIGNED;
  DECLARE v_scheduled_date DATETIME;
  DECLARE v_appointment_type VARCHAR(20);
  DECLARE v_reason TEXT;
  DECLARE v_notes TEXT;
  DECLARE v_priority_level VARCHAR(20);
  DECLARE v_new_appointment_id BIGINT(20) UNSIGNED;
  DECLARE v_location_id INT UNSIGNED;
  DECLARE v_specialty_id INT UNSIGNED;
  DECLARE v_doctor_id BIGINT UNSIGNED;
  DECLARE v_duration_minutes INT;
  DECLARE done INT DEFAULT FALSE;
  
  -- Cursor para procesar lista de espera por prioridad
  DECLARE waiting_cursor CURSOR FOR
    SELECT 
      id, patient_id, scheduled_date, appointment_type, 
      reason, notes, priority_level
    FROM appointments_waiting_list
    WHERE availability_id = p_availability_id
      AND status = 'pending'
    ORDER BY 
      CASE priority_level
        WHEN 'Urgente' THEN 1
        WHEN 'Alta' THEN 2
        WHEN 'Normal' THEN 3
        WHEN 'Baja' THEN 4
      END,
      created_at ASC;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  -- Obtener información de la disponibilidad
  SELECT 
    a.location_id, a.specialty_id, a.doctor_id, a.duration_minutes,
    (a.capacity - COALESCE(COUNT(app.id), 0))
  INTO 
    v_location_id, v_specialty_id, v_doctor_id, v_duration_minutes,
    v_slots_available
  FROM availabilities a
  LEFT JOIN appointments app ON app.availability_id = a.id 
    AND app.status IN ('Pendiente', 'Confirmada')
  WHERE a.id = p_availability_id
  GROUP BY a.id, a.location_id, a.specialty_id, a.doctor_id, a.duration_minutes, a.capacity;
  
  -- Si hay cupos disponibles, procesar lista de espera
  IF v_slots_available > 0 THEN
    OPEN waiting_cursor;
    
    read_loop: LOOP
      FETCH waiting_cursor INTO 
        v_waiting_id, v_patient_id, v_scheduled_date, 
        v_appointment_type, v_reason, v_notes, v_priority_level;
      
      IF done OR v_slots_available <= 0 THEN
        LEAVE read_loop;
      END IF;
      
      -- Crear cita en appointments
      INSERT INTO appointments (
        patient_id, availability_id, location_id, specialty_id, doctor_id,
        scheduled_at, duration_minutes, appointment_type, status, 
        reason, notes, priority_level
      ) VALUES (
        v_patient_id, p_availability_id, v_location_id, v_specialty_id, v_doctor_id,
        v_scheduled_date, v_duration_minutes, v_appointment_type, 'Pendiente', 
        v_reason, CONCAT('Reasignada desde lista de espera. ', IFNULL(v_notes, '')),
        v_priority_level
      );
      
      SET v_new_appointment_id = LAST_INSERT_ID();
      
      -- Marcar como reasignada en waiting_list
      UPDATE appointments_waiting_list
      SET 
        status = 'reassigned',
        reassigned_at = NOW(),
        reassigned_appointment_id = v_new_appointment_id
      WHERE id = v_waiting_id;
      
      -- Decrementar cupos disponibles
      SET v_slots_available = v_slots_available - 1;
    END LOOP;
    
    CLOSE waiting_cursor;
  END IF;
END$$

DELIMITER ;

-- ============================================================================
-- TRIGGER: auto_process_waiting_list_on_cancel
-- ============================================================================
-- Propósito: Ejecutar automáticamente el procesamiento cuando se cancela una cita
-- Uso: Se dispara al actualizar status a 'Cancelada' en appointments
-- ============================================================================

DELIMITER $$

DROP TRIGGER IF EXISTS `auto_process_waiting_list_on_cancel`$$

CREATE TRIGGER `auto_process_waiting_list_on_cancel`
AFTER UPDATE ON `appointments`
FOR EACH ROW
BEGIN
  -- Si una cita se canceló, intentar reasignar desde lista de espera
  IF OLD.status IN ('Pendiente', 'Confirmada') AND NEW.status = 'Cancelada' THEN
    -- Llamar al procedimiento de procesamiento
    CALL process_waiting_list_for_availability(NEW.availability_id);
  END IF;
END$$

DELIMITER ;

-- ============================================================================
-- CONSULTAS DE EJEMPLO Y VERIFICACIÓN
-- ============================================================================

-- Ver estadísticas de lista de espera
SELECT 
  status,
  priority_level,
  COUNT(*) AS total_requests,
  MIN(created_at) AS oldest_request,
  MAX(created_at) AS newest_request
FROM appointments_waiting_list
GROUP BY status, priority_level
ORDER BY 
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'reassigned' THEN 2
    WHEN 'cancelled' THEN 3
    WHEN 'expired' THEN 4
  END,
  CASE priority_level
    WHEN 'Urgente' THEN 1
    WHEN 'Alta' THEN 2
    WHEN 'Normal' THEN 3
    WHEN 'Baja' THEN 4
  END;

-- Ver disponibilidades con más personas en espera
SELECT 
  a.id AS availability_id,
  a.date,
  a.start_time,
  a.end_time,
  d.name AS doctor_name,
  s.name AS specialty_name,
  COUNT(wl.id) AS waiting_count,
  a.capacity AS total_capacity,
  (
    SELECT COUNT(*)
    FROM appointments app
    WHERE app.availability_id = a.id 
      AND app.status IN ('Pendiente', 'Confirmada')
  ) AS current_appointments
FROM availabilities a
INNER JOIN doctors d ON a.doctor_id = d.id
INNER JOIN specialties s ON a.specialty_id = s.id
LEFT JOIN appointments_waiting_list wl ON wl.availability_id = a.id 
  AND wl.status = 'pending'
GROUP BY a.id, a.date, a.start_time, a.end_time, d.name, s.name, a.capacity
HAVING waiting_count > 0
ORDER BY waiting_count DESC;

-- ============================================================================
-- ÍNDICES ADICIONALES PARA OPTIMIZACIÓN
-- ============================================================================

-- Índice para búsqueda rápida de cupos disponibles (si no existe)
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'appointments' 
  AND index_name = 'idx_appointments_availability_status');
SET @sql := IF(@exist = 0, 
  'CREATE INDEX idx_appointments_availability_status ON appointments(availability_id, status)', 
  'SELECT "Índice idx_appointments_availability_status ya existe"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice compuesto para vista waiting_list_with_details (si no existe)
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'appointments_waiting_list' 
  AND index_name = 'idx_waiting_list_full_search');
SET @sql := IF(@exist = 0, 
  'CREATE INDEX idx_waiting_list_full_search ON appointments_waiting_list(availability_id, status, priority_level, created_at)', 
  'SELECT "Índice idx_waiting_list_full_search ya existe"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

SELECT 
  'appointments_waiting_list' AS table_name,
  COUNT(*) AS row_count
FROM appointments_waiting_list

UNION ALL

SELECT 
  'waiting_list_with_details' AS view_name,
  COUNT(*) AS row_count
FROM waiting_list_with_details;

-- Fin del script de migración
