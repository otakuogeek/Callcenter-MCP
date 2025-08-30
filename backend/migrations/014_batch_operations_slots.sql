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

-- Update the create_batch_availabilities procedure to handle the new logic
DELIMITER //

DROP PROCEDURE IF EXISTS `create_batch_availabilities`//

CREATE PROCEDURE `create_batch_availabilities`(
    IN p_doctor_id BIGINT,
    IN p_location_id INT,
    IN p_specialty_id INT,
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_start_time TIME,
    IN p_end_time TIME,
    IN p_capacity INT,
    IN p_slot_duration INT,
    IN p_batch_id VARCHAR(50),
    IN p_exclude_weekends BOOLEAN,
    IN p_exclude_holidays BOOLEAN
)
BEGIN
    DECLARE current_date DATE DEFAULT p_start_date;
    DECLARE current_time TIME DEFAULT p_start_time;
    DECLARE slot_count INT DEFAULT 0;
    DECLARE batch_uuid VARCHAR(50);

    -- Generate batch ID if not provided
    IF p_batch_id IS NULL OR p_batch_id = '' THEN
        SET batch_uuid = CONCAT('batch_', UNIX_TIMESTAMP(), '_', FLOOR(RAND() * 1000));
    ELSE
        SET batch_uuid = p_batch_id;
    END IF;

    -- Calculate number of slots for this day
    SET slot_count = FLOOR(TIMESTAMPDIFF(MINUTE, p_start_time, p_end_time) / p_slot_duration);

    -- Create availability record for the specific date
    INSERT INTO `availabilities` (
        `doctor_id`,
        `location_id`,
        `specialty_id`,
        `date`,
        `start_time`,
        `end_time`,
        `capacity`,
        `available_slots`,
        `slot_duration_minutes`,
        `batch_id`,
        `is_batch_created`,
        `batch_created_at`,
        `created_at`,
        `updated_at`
    ) VALUES (
        p_doctor_id,
        p_location_id,
        p_specialty_id,
        p_start_date,
        p_start_time,
        p_end_time,
        p_capacity,
        p_capacity,
        p_slot_duration,
        batch_uuid,
        1,
        NOW(),
        NOW(),
        NOW()
    );

    -- Create individual time slots for this availability
    SET current_time = p_start_time;
    WHILE current_time < p_end_time AND slot_count > 0 DO
        INSERT INTO `availability_slots` (
            `availability_id`,
            `start_time`,
            `end_time`,
            `is_available`,
            `created_at`
        ) VALUES (
            LAST_INSERT_ID(),
            current_time,
            ADDTIME(current_time, SEC_TO_TIME(p_slot_duration * 60)),
            1,
            NOW()
        );

        SET current_time = ADDTIME(current_time, SEC_TO_TIME(p_slot_duration * 60));
        SET slot_count = slot_count - 1;
    END WHILE;

END//

DELIMITER ;

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
