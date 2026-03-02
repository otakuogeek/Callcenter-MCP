-- =====================================================
-- MIGRACIÓN: Snapshot JSON canónico en persistencia WhatsApp
-- Fecha: 2026-02-23
-- =====================================================

ALTER TABLE whatsapp_conversation_persistence
ADD COLUMN IF NOT EXISTS conversation_json LONGTEXT NULL
COMMENT 'Snapshot JSON completo de la conversación (fuente canónica de contexto)';
