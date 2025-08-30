-- Migración compatible: agregar columnas IA a system_settings sin IF NOT EXISTS
-- Ejecutar en la BD `callcenter` (o la que corresponda)

-- Asegurar fila id=1
INSERT INTO `system_settings` (`id`)
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `id` = 1);

-- Helper para ejecutar ALTER condicional usando information_schema y SQL dinámico
SET @db := DATABASE();

-- ai_enabled
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_enabled');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_enabled` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_auto_answer
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_auto_answer');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_auto_answer` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_response_timeout_seconds
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_response_timeout_seconds');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_response_timeout_seconds` SMALLINT UNSIGNED NOT NULL DEFAULT 3', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_start_time
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_start_time');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_start_time` TIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_end_time
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_end_time');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_end_time` TIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_mon
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_mon');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_mon` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_tue
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_tue');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_tue` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_wed
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_wed');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_wed` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_thu
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_thu');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_thu` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_fri
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_fri');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_fri` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_sat
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_sat');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_sat` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_sun
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_sun');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_sun` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_pause_holidays
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_pause_holidays');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_pause_holidays` TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_vacation_mode
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_vacation_mode');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_vacation_mode` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_break_start
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_break_start');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_break_start` TIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_break_end
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_break_end');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_break_end` TIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_message_welcome
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_message_welcome');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_message_welcome` VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_message_offline
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_message_offline');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_message_offline` VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_message_transfer
SET @cnt := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='system_settings' AND COLUMN_NAME='ai_message_transfer');
SET @sql := IF(@cnt=0, 'ALTER TABLE `system_settings` ADD COLUMN `ai_message_transfer` VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
