-- Migración: campos de configuración general en system_settings (compatible)
-- Ejecutar en la BD destino (ej. callcenter)

INSERT INTO `system_settings` (`id`)
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `id` = 1);

SET @db := DATABASE();

-- org_name
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='org_name');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `org_name` VARCHAR(150) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- org_address
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='org_address');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `org_address` VARCHAR(200) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- org_phone
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='org_phone');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `org_phone` VARCHAR(30) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cc_call_recording_enabled
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='cc_call_recording_enabled');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `cc_call_recording_enabled` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cc_auto_distribution_enabled
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='cc_auto_distribution_enabled');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `cc_auto_distribution_enabled` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cc_max_wait_minutes
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='cc_max_wait_minutes');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `cc_max_wait_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 15', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
