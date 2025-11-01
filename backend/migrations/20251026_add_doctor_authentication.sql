-- Migración: Agregar campos de autenticación a la tabla doctors
-- Fecha: 2025-10-26
-- Descripción: Agrega password_hash, reset_token, y campos de auditoría para login de doctores

-- 1. Agregar columna de password
ALTER TABLE `doctors` 
ADD COLUMN `password_hash` VARCHAR(255) NULL AFTER `active`,
ADD COLUMN `last_login` TIMESTAMP NULL AFTER `password_hash`,
ADD COLUMN `reset_token` VARCHAR(255) NULL AFTER `last_login`,
ADD COLUMN `reset_token_expires` TIMESTAMP NULL AFTER `reset_token`,
ADD COLUMN `login_attempts` INT DEFAULT 0 AFTER `reset_token_expires`,
ADD COLUMN `locked_until` TIMESTAMP NULL AFTER `login_attempts`,
ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `locked_until`;

-- 2. Crear índice en email para login rápido (después de normalizar emails duplicados)
-- Primero, actualizar emails duplicados agregando el ID del doctor
UPDATE doctors d1
SET email = CONCAT(
  SUBSTRING_INDEX(email, '@', 1), 
  '_', 
  id, 
  '@', 
  SUBSTRING_INDEX(email, '@', -1)
)
WHERE email IN (
  SELECT email 
  FROM (
    SELECT email 
    FROM doctors 
    GROUP BY email 
    HAVING COUNT(*) > 1
  ) AS duplicates
)
AND id NOT IN (
  SELECT MIN(id) 
  FROM (
    SELECT * FROM doctors
  ) AS d2
  GROUP BY email
);

-- Ahora sí crear el índice único
ALTER TABLE `doctors` 
ADD UNIQUE INDEX `idx_doctor_email` (`email`);

-- 3. Crear tabla de sesiones de doctores
CREATE TABLE IF NOT EXISTS `doctor_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `doctor_id` BIGINT UNSIGNED NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_session_token` (`token`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_doctor_sessions_doctor` FOREIGN KEY (`doctor_id`) 
    REFERENCES `doctors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Crear tabla de auditoría de login de doctores
CREATE TABLE IF NOT EXISTS `doctor_login_audit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `doctor_id` BIGINT UNSIGNED NULL,
  `email` VARCHAR(150) NOT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `failure_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_email` (`email`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_success` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Actualizar email a NOT NULL si hay doctores sin email
UPDATE `doctors` SET `email` = CONCAT('doctor_', `id`, '@biosanarcall.site') 
WHERE `email` IS NULL OR `email` = '';

ALTER TABLE `doctors` 
MODIFY `email` VARCHAR(150) NOT NULL;

-- 6. Crear contraseña por defecto para doctores existentes (se debe cambiar en primer login)
-- Contraseña por defecto: "Biosanar2025!" (hash bcrypt)
-- Los doctores deberán cambiarla al primer login
UPDATE `doctors` 
SET `password_hash` = '$2b$10$YourHashedPasswordHere' 
WHERE `password_hash` IS NULL;

-- Nota: Ejecutar el script de configuración inicial después de esta migración
-- para generar contraseñas aleatorias seguras para cada doctor
