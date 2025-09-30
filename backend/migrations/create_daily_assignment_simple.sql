-- =======================================================
-- TABLA DE COLA DE ASIGNACIÓN DIARIA (simplificada)
-- =======================================================

CREATE TABLE IF NOT EXISTS `daily_assignment_queue` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
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
  `appointment_id` bigint UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_patient` (`patient_id`),
  KEY `idx_specialty` (`specialty_id`),
  KEY `idx_doctor` (`doctor_id`),
  KEY `idx_location` (`location_id`),
  KEY `idx_status_created` (`status`, `created_at`),
  KEY `idx_requested_date` (`requested_date`)
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
  UNIQUE KEY `unique_specialty` (`specialty_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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