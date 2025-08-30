-- Migration: Advanced Agenda Management System (Adapted)
-- Created: 2025-08-30
-- Description: Add tables for agenda templates, optimization, and conflict resolution
-- Adapted to use existing 'availabilities' table

START TRANSACTION;

-- Agregar campos a availabilities para tracking de plantillas y optimización
-- Usaremos CHECK para verificar si las columnas ya existen
SET @sql = '';

-- Verificar y agregar created_from_template
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'biosanar' AND TABLE_NAME = 'availabilities' AND COLUMN_NAME = 'created_from_template';

IF @col_exists = 0 THEN
  SET @sql = 'ALTER TABLE `availabilities` ADD COLUMN `created_from_template` BOOLEAN DEFAULT FALSE';
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END IF;

-- Verificar y agregar template_id
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'biosanar' AND TABLE_NAME = 'availabilities' AND COLUMN_NAME = 'template_id';

IF @col_exists = 0 THEN
  SET @sql = 'ALTER TABLE `availabilities` ADD COLUMN `template_id` INT UNSIGNED NULL';
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END IF;

-- Verificar y agregar optimization_score
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'biosanar' AND TABLE_NAME = 'availabilities' AND COLUMN_NAME = 'optimization_score';

IF @col_exists = 0 THEN
  SET @sql = 'ALTER TABLE `availabilities` ADD COLUMN `optimization_score` DECIMAL(5,2) NULL COMMENT \'Score de optimización 0-100\'';
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END IF;

-- Verificar y agregar last_optimization_date
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'biosanar' AND TABLE_NAME = 'availabilities' AND COLUMN_NAME = 'last_optimization_date';

IF @col_exists = 0 THEN
  SET @sql = 'ALTER TABLE `availabilities` ADD COLUMN `last_optimization_date` TIMESTAMP NULL';
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END IF;

-- Verificar y agregar duration_minutes
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'biosanar' AND TABLE_NAME = 'availabilities' AND COLUMN_NAME = 'duration_minutes';

IF @col_exists = 0 THEN
  SET @sql = 'ALTER TABLE `availabilities` ADD COLUMN `duration_minutes` INT NOT NULL DEFAULT 30';
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END IF;

-- Verificar y agregar break_between_slots
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'biosanar' AND TABLE_NAME = 'availabilities' AND COLUMN_NAME = 'break_between_slots';

IF @col_exists = 0 THEN
  SET @sql = 'ALTER TABLE `availabilities` ADD COLUMN `break_between_slots` INT NOT NULL DEFAULT 0';
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END IF;

-- Agregar índices si no existen
ALTER TABLE `availabilities`
ADD INDEX IF NOT EXISTS `idx_availability_template` (`template_id`),
ADD INDEX IF NOT EXISTS `idx_availability_optimization` (`optimization_score`),
ADD INDEX IF NOT EXISTS `idx_availability_date_doctor` (`date`, `doctor_id`);

-- Tabla de resoluciones de conflictos (adaptada para availabilities)
CREATE TABLE IF NOT EXISTS `conflict_resolutions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `availability_id` BIGINT UNSIGNED NOT NULL,
  `resolution_type` ENUM('reschedule', 'cancel', 'increase_capacity', 'split_slot') NOT NULL,
  `resolution_data` JSON NULL COMMENT 'Datos específicos de la resolución',
  `notes` TEXT NULL,
  `resolved_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_by` INT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_resolution_availability` (`availability_id`),
  INDEX `idx_resolution_type` (`resolution_type`),
  INDEX `idx_resolution_date` (`resolved_at`),
  INDEX `idx_resolution_user` (`resolved_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de métricas de optimización
CREATE TABLE IF NOT EXISTS `agenda_optimization_metrics` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `date` DATE NOT NULL,
  `doctor_id` BIGINT UNSIGNED NULL,
  `specialty_id` INT UNSIGNED NULL,
  `location_id` INT UNSIGNED NULL,
  `total_slots` INT NOT NULL DEFAULT 0,
  `total_capacity` INT NOT NULL DEFAULT 0,
  `total_occupied` INT NOT NULL DEFAULT 0,
  `utilization_percentage` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `efficiency_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `conflicts_detected` INT NOT NULL DEFAULT 0,
  `conflicts_resolved` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_metrics_date_doctor` (`date`, `doctor_id`, `specialty_id`, `location_id`),
  INDEX `idx_metrics_date` (`date`),
  INDEX `idx_metrics_doctor` (`doctor_id`),
  INDEX `idx_metrics_utilization` (`utilization_percentage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de patrones de demanda
CREATE TABLE IF NOT EXISTS `demand_patterns` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `day_of_week` TINYINT NOT NULL COMMENT '1=Lunes, 7=Domingo',
  `hour_of_day` TINYINT NOT NULL COMMENT '0-23',
  `doctor_id` BIGINT UNSIGNED NULL,
  `specialty_id` INT UNSIGNED NULL,
  `location_id` INT UNSIGNED NULL,
  `avg_utilization` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `demand_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `sample_size` INT NOT NULL DEFAULT 0,
  `last_calculated` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pattern` (`day_of_week`, `hour_of_day`, `doctor_id`, `specialty_id`, `location_id`),
  INDEX `idx_pattern_dow` (`day_of_week`),
  INDEX `idx_pattern_hour` (`hour_of_day`),
  INDEX `idx_pattern_demand` (`demand_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de sugerencias automáticas
CREATE TABLE IF NOT EXISTS `agenda_suggestions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `suggestion_type` ENUM('new_slot', 'modify_capacity', 'reschedule', 'cancel_slot') NOT NULL,
  `target_date` DATE NOT NULL,
  `target_time` TIME NULL,
  `doctor_id` BIGINT UNSIGNED NULL,
  `specialty_id` INT UNSIGNED NULL,
  `location_id` INT UNSIGNED NULL,
  `suggested_capacity` INT NULL,
  `confidence_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `reasoning` TEXT NULL,
  `suggestion_data` JSON NULL,
  `status` ENUM('pending', 'accepted', 'rejected', 'expired') DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NULL,
  `processed_at` TIMESTAMP NULL,
  `processed_by` INT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_suggestion_type` (`suggestion_type`),
  INDEX `idx_suggestion_date` (`target_date`),
  INDEX `idx_suggestion_status` (`status`),
  INDEX `idx_suggestion_confidence` (`confidence_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar foreign keys si las tablas referenciadas existen
SET @fk_checks = (SELECT @@foreign_key_checks);
SET foreign_key_checks = 0;

-- Foreign keys para agenda_templates (ya existe la tabla)
ALTER TABLE `agenda_templates`
ADD CONSTRAINT IF NOT EXISTS `fk_template_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
ADD CONSTRAINT IF NOT EXISTS `fk_template_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL,
ADD CONSTRAINT IF NOT EXISTS `fk_template_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL;

-- Foreign keys para availabilities
ALTER TABLE `availabilities`
ADD CONSTRAINT IF NOT EXISTS `fk_availability_template` FOREIGN KEY (`template_id`) REFERENCES `agenda_templates` (`id`) ON DELETE SET NULL;

-- Foreign keys para conflict_resolutions
ALTER TABLE `conflict_resolutions`
ADD CONSTRAINT IF NOT EXISTS `fk_resolution_availability` FOREIGN KEY (`availability_id`) REFERENCES `availabilities` (`id`) ON DELETE CASCADE,
ADD CONSTRAINT IF NOT EXISTS `fk_resolution_user` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

SET foreign_key_checks = @fk_checks;

-- Insertar datos de ejemplo para agenda_templates si no existen
INSERT IGNORE INTO `agenda_templates` (`name`, `description`, `days_of_week`, `time_slots`, `duration_minutes`, `active`) VALUES
('Horario Estándar Mañana', 'Plantilla para horarios matutinos estándar', '[1,2,3,4,5]', '[{"start":"08:00","end":"12:00","capacity":4}]', 30, TRUE),
('Horario Estándar Tarde', 'Plantilla para horarios vespertinos estándar', '[1,2,3,4,5]', '[{"start":"14:00","end":"18:00","capacity":3}]', 30, TRUE),
('Consulta Externa Sábados', 'Horarios especiales para sábados', '[6]', '[{"start":"08:00","end":"13:00","capacity":6}]', 20, TRUE);

-- Crear índices adicionales para optimización
CREATE INDEX IF NOT EXISTS `idx_appointments_availability_status` ON `appointments` (`availability_id`, `status`);

-- Actualizar trigger si existe, o crearlo
DROP TRIGGER IF EXISTS `update_optimization_metrics`;

DELIMITER $$

CREATE TRIGGER `update_optimization_metrics` 
AFTER UPDATE ON `availabilities`
FOR EACH ROW
BEGIN
    IF NEW.booked_slots != OLD.booked_slots OR NEW.capacity != OLD.capacity THEN
        INSERT INTO agenda_optimization_metrics 
        (date, doctor_id, specialty_id, location_id, total_slots, total_capacity, total_occupied, utilization_percentage)
        VALUES (
            NEW.date,
            NEW.doctor_id,
            NEW.specialty_id,
            NEW.location_id,
            1,
            NEW.capacity,
            NEW.booked_slots,
            CASE WHEN NEW.capacity > 0 THEN (NEW.booked_slots / NEW.capacity * 100) ELSE 0 END
        )
        ON DUPLICATE KEY UPDATE
            total_occupied = total_occupied - OLD.booked_slots + NEW.booked_slots,
            total_capacity = total_capacity - OLD.capacity + NEW.capacity,
            utilization_percentage = CASE WHEN total_capacity > 0 THEN (total_occupied / total_capacity * 100) ELSE 0 END;
    END IF;
END$$

DELIMITER ;

COMMIT;
