-- Reintroducir UNIQUE limpio para conversation_id y añadir índice extra (priority,status,created_at)
-- Incluye secciones DOWN comentadas para reversión manual.

-- UP
ALTER TABLE calls
  ADD UNIQUE INDEX uk_calls_conversation (conversation_id);

ALTER TABLE calls
  ADD INDEX idx_calls_priority_status_created (priority, status, created_at);

-- DOWN (ejecutar manualmente si necesita revertir)
-- ALTER TABLE calls DROP INDEX idx_calls_priority_status_created;
-- ALTER TABLE calls DROP INDEX uk_calls_conversation;
