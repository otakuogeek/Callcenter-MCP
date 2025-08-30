-- Migration: Advanced Agenda Management System
-- Created: 2025-08-30
-- Description: Add tables for agenda templates, optimization, and conflict resolution

START TRANSACTION;

-- Tabla de plantillas de agenda
CREATE TABLE IF NOT EXISTS `agenda_templates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `doctor_id` INT UNSIGNED NULL,
  `specialty_id` INT UNSIGNED NULL,
  `location_id` INT UNSIGNED NULL,
  `days_of_week` JSON NOT NULL COMMENT 'Array de días de la semana [1,2,3,4,5]',
  `time_slots` JSON NOT NULL COMMENT 'Array de horarios [{"start":"08:00","end":"12:00","capacity":4}]',
  `duration_minutes` INT NOT NULL DEFAULT 30,
  `break_between_slots` INT NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_template_doctor` (`doctor_id`),
  INDEX `idx_template_specialty` (`specialty_id`),
  INDEX `idx_template_location` (`location_id`),
  INDEX `idx_template_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar campos a availability_slots para tracking de plantillas
ALTER TABLE `availability_slots` 
ADD COLUMN `created_from_template` BOOLEAN DEFAULT FALSE,
ADD COLUMN `template_id` INT UNSIGNED NULL,
ADD COLUMN `optimization_score` DECIMAL(5,2) NULL COMMENT 'Score de optimización 0-100',
ADD COLUMN `last_optimization_date` TIMESTAMP NULL,
ADD INDEX `idx_availability_template` (`template_id`),
ADD INDEX `idx_availability_optimization` (`optimization_score`);

-- Tabla de resoluciones de conflictos
CREATE TABLE IF NOT EXISTS `conflict_resolutions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slot_id` INT UNSIGNED NOT NULL,
  `resolution_type` ENUM('reschedule', 'cancel', 'increase_capacity', 'split_slot') NOT NULL,
  `resolution_data` JSON NULL COMMENT 'Datos específicos de la resolución',
  `notes` TEXT NULL,
  `resolved_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_by` INT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_resolution_slot` (`slot_id`),
  INDEX `idx_resolution_type` (`resolution_type`),
  INDEX `idx_resolution_date` (`resolved_at`),
  INDEX `idx_resolution_user` (`resolved_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de métricas de optimización
CREATE TABLE IF NOT EXISTS `agenda_optimization_metrics` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `date` DATE NOT NULL,
  `doctor_id` INT UNSIGNED NULL,
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
  `doctor_id` INT UNSIGNED NULL,
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
  `doctor_id` INT UNSIGNED NULL,
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

-- Foreign keys para agenda_templates
ALTER TABLE `agenda_templates`
ADD CONSTRAINT `fk_template_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
ADD CONSTRAINT `fk_template_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL,
ADD CONSTRAINT `fk_template_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL;

-- Foreign keys para availability_slots
ALTER TABLE `availability_slots`
ADD CONSTRAINT `fk_availability_template` FOREIGN KEY (`template_id`) REFERENCES `agenda_templates` (`id`) ON DELETE SET NULL;

-- Foreign keys para conflict_resolutions
ALTER TABLE `conflict_resolutions`
ADD CONSTRAINT `fk_resolution_slot` FOREIGN KEY (`slot_id`) REFERENCES `availability_slots` (`id`) ON DELETE CASCADE,
ADD CONSTRAINT `fk_resolution_user` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

SET foreign_key_checks = @fk_checks;

-- Insertar datos de ejemplo para agenda_templates
INSERT INTO `agenda_templates` (`name`, `description`, `days_of_week`, `time_slots`, `duration_minutes`, `active`) VALUES
('Horario Estándar Mañana', 'Plantilla para horarios matutinos estándar', '[1,2,3,4,5]', '[{"start":"08:00","end":"12:00","capacity":4}]', 30, TRUE),
('Horario Estándar Tarde', 'Plantilla para horarios vespertinos estándar', '[1,2,3,4,5]', '[{"start":"14:00","end":"18:00","capacity":3}]', 30, TRUE),
('Consulta Externa Sábados', 'Horarios especiales para sábados', '[6]', '[{"start":"08:00","end":"13:00","capacity":6}]', 20, TRUE);

-- Crear índices adicionales para optimización
CREATE INDEX `idx_availability_date_doctor` ON `availability_slots` (`date`, `doctor_id`);
CREATE INDEX `idx_availability_utilization` ON `availability_slots` ((occupied/capacity));
CREATE INDEX `idx_appointments_availability_status` ON `appointments` (`availability_id`, `status`);

-- Trigger para actualizar métricas automáticamente
DELIMITER $$

CREATE TRIGGER `update_optimization_metrics` 
AFTER UPDATE ON `availability_slots`
FOR EACH ROW
BEGIN
    IF NEW.occupied != OLD.occupied OR NEW.capacity != OLD.capacity THEN
        INSERT INTO agenda_optimization_metrics 
        (date, doctor_id, specialty_id, location_id, total_slots, total_capacity, total_occupied, utilization_percentage)
        VALUES (
            NEW.date,
            NEW.doctor_id,
            NEW.specialty_id,
            NEW.location_id,
            1,
            NEW.capacity,
            NEW.occupied,
            (NEW.occupied / NEW.capacity * 100)
        )
        ON DUPLICATE KEY UPDATE
            total_occupied = total_occupied - OLD.occupied + NEW.occupied,
            total_capacity = total_capacity - OLD.capacity + NEW.capacity,
            utilization_percentage = (total_occupied / total_capacity * 100);
    END IF;
END$$

DELIMITER ;

COMMIT;
