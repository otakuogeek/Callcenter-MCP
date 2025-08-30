-- Migración: añadir campos para manejo de IA en system_settings (MySQL 8.0.29+)
-- Schema objetivo: la BD donde está tu tabla `system_settings` (p. ej., `callcenter`)

-- IMPORTANTE: Requiere MySQL 8.0.29+ para usar ADD COLUMN IF NOT EXISTS
-- Si ejecutas en una versión menor, ver nota al final.

-- Asegurar fila única id=1
INSERT INTO `system_settings` (`id`)
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `id` = 1);

-- Agregar columnas de IA (idempotente)
ALTER TABLE `system_settings`
  ADD COLUMN IF NOT EXISTS `ai_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS `ai_auto_answer` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS `ai_response_timeout_seconds` SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS `ai_start_time` TIME NULL,
  ADD COLUMN IF NOT EXISTS `ai_end_time` TIME NULL,
  ADD COLUMN IF NOT EXISTS `ai_mon` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS `ai_tue` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS `ai_wed` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS `ai_thu` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS `ai_fri` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS `ai_sat` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS `ai_sun` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS `ai_pause_holidays` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS `ai_vacation_mode` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS `ai_break_start` TIME NULL,
  ADD COLUMN IF NOT EXISTS `ai_break_end` TIME NULL,
  ADD COLUMN IF NOT EXISTS `ai_message_welcome` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `ai_message_offline` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `ai_message_transfer` VARCHAR(255) NULL;

-- Opcional: establecer valores por defecto de mensajes (ejecuta si lo deseas)
-- UPDATE `system_settings` SET
--   `ai_message_welcome` = COALESCE(`ai_message_welcome`, 'Hola, ¿en qué puedo ayudarte?'),
--   `ai_message_offline` = COALESCE(`ai_message_offline`, 'Estamos fuera de horario. Te contactaremos pronto.'),
--   `ai_message_transfer` = COALESCE(`ai_message_transfer`, 'Te transferiré con un agente, por favor espera un momento.')
-- WHERE `id` = 1;

-- Nota compatibilidad (< 8.0.29): si tu servidor no soporta IF NOT EXISTS en columnas,
-- deberás ejecutar ALTER por columna verificando en information_schema.COLUMNS antes de cada ADD.
