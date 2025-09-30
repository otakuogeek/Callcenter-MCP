-- =======================================================
-- TABLA DE COLA DE ESPERA PARA ASIGNACIÓN DIARIA DE CITAS
-- =======================================================

CREATE TABLE IF NOT EXISTS `waiting_queue` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` int UNSIGNED NOT NULL,
  `specialty_id` int UNSIGNED NOT NULL,
  `doctor_id` int UNSIGNED DEFAULT NULL,
  `location_id` int UNSIGNED DEFAULT NULL,
  `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `requested_date` date DEFAULT NULL,
  `status` enum('waiting','assigned','cancelled','expired') NOT NULL DEFAULT 'waiting',
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `assigned_at` datetime DEFAULT NULL,
  `assigned_by_user_id` int UNSIGNED DEFAULT NULL,
  `appointment_id` int UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_patient` (`patient_id`),
  KEY `idx_specialty` (`specialty_id`),
  KEY `idx_doctor` (`doctor_id`),
  KEY `idx_location` (`location_id`),
  KEY `idx_status_created` (`status`, `created_at`),
  KEY `idx_requested_date` (`requested_date`),
  CONSTRAINT `fk_waiting_queue_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waiting_queue_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waiting_queue_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_waiting_queue_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_waiting_queue_assigned_by` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_waiting_queue_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =======================================================
-- TABLA DE CONFIGURACIÓN DE ASIGNACIÓN DIARIA
-- =======================================================

CREATE TABLE IF NOT EXISTS `daily_assignment_config` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `specialty_id` int UNSIGNED NOT NULL,
  `auto_assignment_enabled` boolean NOT NULL DEFAULT true,
  `max_daily_assignments` int UNSIGNED DEFAULT NULL,
  `assignment_start_time` time NOT NULL DEFAULT '08:00:00',
  `assignment_end_time` time NOT NULL DEFAULT '17:00:00',
  `buffer_slots` int UNSIGNED NOT NULL DEFAULT 2,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_specialty` (`specialty_id`),
  CONSTRAINT `fk_daily_config_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =======================================================
-- VISTA PARA CONSULTAS OPTIMIZADAS DE COLA DE ESPERA
-- =======================================================

CREATE OR REPLACE VIEW `waiting_queue_view` AS
SELECT 
  wq.id,
  wq.patient_id,
  p.name as patient_name,
  p.document as patient_document,
  p.phone as patient_phone,
  wq.specialty_id,
  s.name as specialty_name,
  wq.doctor_id,
  d.name as doctor_name,
  wq.location_id,
  l.name as location_name,
  wq.priority,
  wq.requested_date,
  wq.status,
  wq.notes,
  wq.created_at,
  wq.assigned_at,
  wq.assigned_by_user_id,
  u.full_name as assigned_by_name,
  wq.appointment_id,
  -- Calcular tiempo en cola
  TIMESTAMPDIFF(MINUTE, wq.created_at, NOW()) as waiting_minutes,
  -- Calcular posición en cola por especialidad
  (SELECT COUNT(*) + 1 
   FROM waiting_queue wq2 
   WHERE wq2.specialty_id = wq.specialty_id 
     AND wq2.status = 'waiting' 
     AND wq2.created_at < wq.created_at
  ) as queue_position
FROM waiting_queue wq
JOIN patients p ON p.id = wq.patient_id
JOIN specialties s ON s.id = wq.specialty_id
LEFT JOIN doctors d ON d.id = wq.doctor_id
LEFT JOIN locations l ON l.id = wq.location_id
LEFT JOIN users u ON u.id = wq.assigned_by_user_id;

-- =======================================================
-- PROCEDIMIENTO PARA AUTO-ASIGNACIÓN DIARIA
-- =======================================================

DELIMITER //

CREATE OR REPLACE PROCEDURE `AssignDailyAppointments`()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE queue_id, patient_id, specialty_id, doctor_id, location_id INT UNSIGNED;
  DECLARE today_date DATE DEFAULT CURDATE();
  
  -- Cursor para pacientes en cola de espera
  DECLARE queue_cursor CURSOR FOR 
    SELECT wq.id, wq.patient_id, wq.specialty_id, wq.doctor_id, wq.location_id
    FROM waiting_queue wq
    WHERE wq.status = 'waiting'
    ORDER BY 
      CASE wq.priority 
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2  
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      wq.created_at ASC;
      
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  OPEN queue_cursor;
  
  queue_loop: LOOP
    FETCH queue_cursor INTO queue_id, patient_id, specialty_id, doctor_id, location_id;
    
    IF done THEN
      LEAVE queue_loop;
    END IF;
    
    -- Intentar encontrar disponibilidad para hoy
    SET @availability_id = NULL;
    
    SELECT a.id INTO @availability_id
    FROM availabilities a
    LEFT JOIN availability_distribution ad ON ad.availability_id = a.id AND ad.day_date = today_date
    WHERE a.date = today_date
      AND a.specialty_id = specialty_id
      AND (doctor_id IS NULL OR a.doctor_id = doctor_id)
      AND (location_id IS NULL OR a.location_id = location_id)
      AND a.status = 'Activa'
      AND COALESCE(ad.quota, 0) - COALESCE(ad.assigned, 0) > 0
    ORDER BY 
      CASE WHEN a.doctor_id = doctor_id THEN 1 ELSE 2 END,
      CASE WHEN a.location_id = location_id THEN 1 ELSE 2 END,
      a.start_time ASC
    LIMIT 1;
    
    -- Si se encontró disponibilidad, asignar
    IF @availability_id IS NOT NULL THEN
      -- Crear la cita
      INSERT INTO appointments (
        patient_id, 
        availability_id, 
        status, 
        scheduled_at,
        created_at
      ) VALUES (
        patient_id,
        @availability_id,
        'Programada',
        NOW(),
        NOW()
      );
      
      SET @appointment_id = LAST_INSERT_ID();
      
      -- Actualizar registro en cola
      UPDATE waiting_queue 
      SET status = 'assigned',
          assigned_at = NOW(),
          appointment_id = @appointment_id
      WHERE id = queue_id;
      
      -- Actualizar distribución
      INSERT INTO availability_distribution (availability_id, day_date, quota, assigned)
      VALUES (@availability_id, today_date, 1, 1)
      ON DUPLICATE KEY UPDATE assigned = assigned + 1;
      
    END IF;
    
  END LOOP;
  
  CLOSE queue_cursor;
  
END //

DELIMITER ;

-- =======================================================
-- INSERTAR CONFIGURACIONES INICIALES
-- =======================================================

INSERT IGNORE INTO daily_assignment_config (specialty_id, auto_assignment_enabled, max_daily_assignments, assignment_start_time, assignment_end_time, buffer_slots)
SELECT 
  id as specialty_id,
  true as auto_assignment_enabled,
  10 as max_daily_assignments,
  '08:00:00' as assignment_start_time,
  '17:00:00' as assignment_end_time,
  2 as buffer_slots
FROM specialties;