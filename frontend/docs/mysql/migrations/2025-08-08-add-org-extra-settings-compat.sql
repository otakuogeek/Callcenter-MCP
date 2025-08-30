-- Compatibility migration to add org_nit, org_logo_url, org_timezone to system_settings if missing
-- Safe for MySQL 8.0.x without ALTER ... IF NOT EXISTS

SET @db := DATABASE();

-- Ensure row id=1 exists
INSERT INTO system_settings (id)
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE id = 1);

-- Helper to add a column if it doesn't exist
SET @tbl := 'system_settings';

-- org_nit
SET @col := 'org_nit';
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS c WHERE c.TABLE_SCHEMA = @db AND c.TABLE_NAME = @tbl AND c.COLUMN_NAME = @col);
SET @sql := IF(@exists = 0, 'ALTER TABLE system_settings ADD COLUMN `org_nit` varchar(30) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- org_logo_url
SET @col := 'org_logo_url';
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS c WHERE c.TABLE_SCHEMA = @db AND c.TABLE_NAME = @tbl AND c.COLUMN_NAME = @col);
SET @sql := IF(@exists = 0, 'ALTER TABLE system_settings ADD COLUMN `org_logo_url` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- org_timezone (with default)
SET @col := 'org_timezone';
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS c WHERE c.TABLE_SCHEMA = @db AND c.TABLE_NAME = @tbl AND c.COLUMN_NAME = @col);
SET @sql := IF(@exists = 0, 'ALTER TABLE system_settings ADD COLUMN `org_timezone` varchar(64) NOT NULL DEFAULT ''America/Bogota''' , 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
