-- Migration: Add batch_operations table for tracking agenda batches
-- Date: 2025-08-29

-- Create batch_operations table to track agenda creation batches
CREATE TABLE IF NOT EXISTS `batch_operations` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) NOT NULL,
  `operation_type` enum('availability_batch','appointment_batch') NOT NULL DEFAULT 'availability_batch',
  `doctor_id` bigint UNSIGNED NOT NULL,
  `total_capacity` int NOT NULL,
  `working_days` int NOT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_batch_id` (`batch_id`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create availability_slots table if it doesn't exist
CREATE TABLE IF NOT EXISTS `availability_slots` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `availability_id` bigint UNSIGNED NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `is_available` tinyint(1) NOT NULL DEFAULT 1,
  `appointment_id` bigint UNSIGNED NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_availability_id` (`availability_id`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_is_available` (`is_available`),
  KEY `idx_appointment_id` (`appointment_id`),
  CONSTRAINT `fk_availability_slots_availability` FOREIGN KEY (`availability_id`) REFERENCES `availabilities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_availability_slots_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add indexes for better performance
ALTER TABLE `availabilities`
ADD INDEX IF NOT EXISTS `idx_doctor_date` (`doctor_id`, `date`),
ADD INDEX IF NOT EXISTS `idx_location_date` (`location_id`, `date`),
ADD INDEX IF NOT EXISTS `idx_specialty_date` (`specialty_id`, `date`);

-- Insert some sample data for testing
INSERT IGNORE INTO `batch_operations` (`batch_id`, `operation_type`, `doctor_id`, `total_capacity`, `working_days`, `created_by`, `notes`) VALUES
('sample_batch_001', 'availability_batch', 1, 50, 10, 1, 'Muestra de lote de agendas creado automáticamente');
