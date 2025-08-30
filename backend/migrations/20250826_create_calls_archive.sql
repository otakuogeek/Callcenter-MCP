-- Tabla de archivo para llamadas antiguas
CREATE TABLE IF NOT EXISTS calls_archive LIKE calls;
-- Remover índices innecesarios de alta escritura y dejar algunos para consultas históricas
ALTER TABLE calls_archive 
  DROP INDEX idx_calls_status_start,
  DROP INDEX idx_calls_priority_status,
  DROP INDEX idx_calls_start_time,
  DROP INDEX idx_calls_status_priority_start;
-- (mantener los que ayudan a búsquedas básicas)
