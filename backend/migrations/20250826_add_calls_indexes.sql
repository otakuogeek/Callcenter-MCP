-- Índices recomendados para optimizar consultas de llamadas
-- Ejecutar una sola vez en producción

ALTER TABLE `calls`
  ADD INDEX `idx_calls_status_start` (`status`, `start_time`),
  ADD INDEX `idx_calls_priority_status` (`priority`, `status`),
  ADD INDEX `idx_calls_start_time` (`start_time`),
  ADD UNIQUE INDEX `uk_calls_conversation` (`conversation_id`),
  ADD INDEX `idx_calls_agent_name` (`agent_name`),
  ADD INDEX `idx_calls_patient_name` (`patient_name`),
  ADD INDEX `idx_calls_patient_phone` (`patient_phone`);

-- Para búsquedas combinadas en historial con filtros y orden por start_time DESC
-- (status, priority, start_time) ayuda a filtrar rápido
ALTER TABLE `calls`
  ADD INDEX `idx_calls_status_priority_start` (`status`, `priority`, `start_time`);

-- Verificación rápida del tamaño de la tabla y uso de índices
-- EXPLAIN SELECT * FROM calls WHERE status='active' ORDER BY start_time DESC LIMIT 20;
-- EXPLAIN SELECT * FROM calls WHERE status='ended' AND start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ORDER BY end_time DESC LIMIT 20;
