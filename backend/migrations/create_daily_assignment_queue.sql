-- =======================================================
-- TABLA DE COLA DE ASIGNACIÓN DIARIA (nueva tabla)
-- =======================================================

CREATE TABLE IF NOT EXISTS `daily_assignment_queue` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` bigint UNSIGNED NOT NULL,
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
  CONSTRAINT `fk_daily_queue_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_daily_queue_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_daily_queue_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_daily_queue_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_daily_queue_assigned_by` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_daily_queue_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL
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
-- VISTA PARA CONSULTAS OPTIMIZADAS DE COLA DE ASIGNACIÓN DIARIA
-- =======================================================

CREATE OR REPLACE VIEW `daily_assignment_queue_view` AS
SELECT 
  daq.id,
  daq.patient_id,
  p.name as patient_name,
  p.document as patient_document,
  p.phone as patient_phone,
  daq.specialty_id,
  s.name as specialty_name,
  daq.doctor_id,
  d.name as doctor_name,
  daq.location_id,
  l.name as location_name,
  daq.priority,
  daq.requested_date,
  daq.status,
  daq.notes,
  daq.created_at,
  daq.assigned_at,
  daq.assigned_by_user_id,
  u.full_name as assigned_by_name,
  daq.appointment_id,
  -- Calcular tiempo en cola
  TIMESTAMPDIFF(MINUTE, daq.created_at, NOW()) as waiting_minutes,
  -- Calcular posición en cola por especialidad
  (SELECT COUNT(*) + 1 
   FROM daily_assignment_queue daq2 
   WHERE daq2.specialty_id = daq.specialty_id 
     AND daq2.status = 'waiting' 
     AND daq2.created_at < daq.created_at
  ) as queue_position
FROM daily_assignment_queue daq
JOIN patients p ON p.id = daq.patient_id
JOIN specialties s ON s.id = daq.specialty_id
LEFT JOIN doctors d ON d.id = daq.doctor_id
LEFT JOIN locations l ON l.id = daq.location_id
LEFT JOIN users u ON u.id = daq.assigned_by_user_id;

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