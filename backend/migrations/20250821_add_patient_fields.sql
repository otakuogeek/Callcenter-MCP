-- Migration: Add extended patient fields and lookup tables
-- Created: 2025-08-21
-- Notes: Non-destructive, columns nullable by default. Add foreign keys with ON DELETE SET NULL.

START TRANSACTION;

-- Lookup: document types
CREATE TABLE IF NOT EXISTS `document_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(10) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `document_types` (`code`,`name`) VALUES
('CC','Cédula de Ciudadanía'),
('CE','Cédula de Extranjería'),
('TI','Tarjeta de Identidad'),
('PS','Pasaporte'),
('NIT','NIT'),
('OT','Otro')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Lookup: blood groups
CREATE TABLE IF NOT EXISTS `blood_groups` (
  `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(3) NOT NULL,
  `name` VARCHAR(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `blood_groups` (`code`,`name`) VALUES
('A+','A+'),('A-','A-'),('B+','B+'),('B-','B-'),('AB+','AB+'),('AB-','AB-'),('O+','O+'),('O-','O-')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Lookup: education levels
CREATE TABLE IF NOT EXISTS `education_levels` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `education_levels` (`name`) VALUES
('Sin educación formal'),
('Básica primaria'),
('Básica secundaria'),
('Media/Técnica'),
('Tecnológica/Profesional'),
('Posgrado'),
('Otro')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Lookup: marital statuses
CREATE TABLE IF NOT EXISTS `marital_statuses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `marital_statuses` (`name`) VALUES
('Soltero(a)'),('Casado(a)'),('Unión libre'),('Separado(a)'),('Viudo(a)'),('Otro')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Lookup: population groups (poblaciones vulnerables)
CREATE TABLE IF NOT EXISTS `population_groups` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `population_groups` (`name`) VALUES
('General'),
('Población indígena'),
('Población afrodescendiente'),
('Población ROM'),
('Víctimas conflicto'),
('Desplazados'),
('Adultos mayores'),
('Niñez y adolescencia'),
('Otra')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Lookup: disability types
CREATE TABLE IF NOT EXISTS `disability_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `disability_types` (`name`) VALUES
('Visual'),('Auditiva'),('Motor'),('Cognitiva'),('Psicosocial'),('Otra')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Alter patients table: add nullable columns
ALTER TABLE `patients`
  ADD COLUMN `document_type_id` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN `insurance_affiliation_type` ENUM('Contributivo','Subsidiado','Vinculado','Particular','Otro') DEFAULT NULL,
  ADD COLUMN `blood_group_id` SMALLINT UNSIGNED DEFAULT NULL,
  ADD COLUMN `population_group_id` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN `education_level_id` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN `marital_status_id` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN `has_disability` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `disability_type_id` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN `estrato` TINYINT UNSIGNED DEFAULT NULL,
  ADD COLUMN `phone_alt` VARCHAR(30) DEFAULT NULL,
  ADD COLUMN `notes` TEXT DEFAULT NULL;

-- Add indexes to support foreign keys
ALTER TABLE `patients`
  ADD INDEX `idx_pat_document_type` (`document_type_id`),
  ADD INDEX `idx_pat_blood_group` (`blood_group_id`),
  ADD INDEX `idx_pat_population_group` (`population_group_id`),
  ADD INDEX `idx_pat_education_level` (`education_level_id`),
  ADD INDEX `idx_pat_marital_status` (`marital_status_id`),
  ADD INDEX `idx_pat_disability_type` (`disability_type_id`);

-- Add foreign key constraints (ON DELETE SET NULL to be non-destructive)
ALTER TABLE `patients`
  ADD CONSTRAINT `fk_pat_document_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_blood_group` FOREIGN KEY (`blood_group_id`) REFERENCES `blood_groups`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_population_group` FOREIGN KEY (`population_group_id`) REFERENCES `population_groups`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_education_level` FOREIGN KEY (`education_level_id`) REFERENCES `education_levels`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_marital_status` FOREIGN KEY (`marital_status_id`) REFERENCES `marital_statuses`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_disability_type` FOREIGN KEY (`disability_type_id`) REFERENCES `disability_types`(`id`) ON DELETE SET NULL;

COMMIT;

-- End of migration
