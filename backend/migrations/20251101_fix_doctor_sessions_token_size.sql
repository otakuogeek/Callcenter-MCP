-- Migración: Aumentar tamaño de columna token en doctor_sessions
-- Fecha: 2025-11-01
-- Razón: Los JWT tokens pueden ser más largos de 255 caracteres

-- Eliminar índice único existente
ALTER TABLE doctor_sessions DROP INDEX IF EXISTS idx_session_token;

-- Modificar columna token de VARCHAR(255) a TEXT
ALTER TABLE doctor_sessions MODIFY COLUMN token TEXT NOT NULL;

-- Recrear índice único con prefijo de 255 caracteres
ALTER TABLE doctor_sessions ADD UNIQUE INDEX idx_session_token (token(255));
