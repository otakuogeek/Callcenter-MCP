-- Limpieza de índices duplicados y nuevo índice para consultas por fin de llamada
-- Ejecutar una sola vez. Si algún DROP falla por inexistencia, puede ignorarse manualmente.

-- Eliminar índices redundantes sobre conversation_id (ya existe índice único implícito por la columna UNIQUE)
DROP INDEX idx_conversation_id ON calls;
DROP INDEX uk_calls_conversation ON calls;

-- Nuevo índice para optimizar consultas de llamadas finalizadas ordenadas por end_time
ALTER TABLE calls
  ADD INDEX idx_calls_status_end (status, end_time);

-- Verificación sugerida:
-- SHOW INDEX FROM calls LIKE 'idx_calls_status_end';
-- EXPLAIN SELECT conversation_id FROM calls WHERE status='ended' ORDER BY end_time DESC LIMIT 20;
