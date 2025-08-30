-- Índices para optimizar búsquedas de pacientes
ALTER TABLE patients
  ADD INDEX idx_patients_status_name (status, name),
  ADD INDEX idx_patients_status_created (status, created_at);

-- Índice FULLTEXT (requiere MySQL 5.6+ / 8.0+) para búsquedas rápidas (nombre, documento, teléfono, email)
-- Ignorar error si ya existe o motor no soporta FULLTEXT sobre todas las columnas
ALTER TABLE patients
  ADD FULLTEXT INDEX ft_patients_search (name, document, phone, email);
