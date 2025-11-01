-- Completar migración de autenticación de doctores
-- Fecha: 2025-10-26

-- 1. Agregar índice único en email (ahora que todos tienen emails únicos)
ALTER TABLE `doctors` 
ADD UNIQUE INDEX `idx_doctor_email` (`email`);

-- 2. Asegurar que email sea NOT NULL
ALTER TABLE `doctors` 
MODIFY `email` VARCHAR(150) NOT NULL;

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

-- 5. Verificar estructura
SELECT 'Tablas creadas exitosamente' AS status;
SHOW TABLES LIKE 'doctor_%';
