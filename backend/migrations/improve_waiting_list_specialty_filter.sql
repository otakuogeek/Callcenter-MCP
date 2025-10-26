-- Migración: Mejorar appointments_waiting_list para soportar filtrado por specialty_id
-- Fecha: 2025-10-14
-- Autor: Sistema de Gestión Biosanar

-- NOTA: El constraint CHECK no es soportado en esta versión de MariaDB
-- La validación de que al menos uno de los IDs tenga valor se hará a nivel de aplicación

-- 1. Agregar índice compuesto para mejorar consultas por specialty_id + status
CREATE INDEX IF NOT EXISTS idx_specialty_status ON appointments_waiting_list(specialty_id, status);

-- 2. Agregar índice compuesto para consultas por specialty_id + priority_level
CREATE INDEX IF NOT EXISTS idx_specialty_priority ON appointments_waiting_list(specialty_id, priority_level);

-- 3. Agregar índice para consultas mixtas
CREATE INDEX IF NOT EXISTS idx_both_ids ON appointments_waiting_list(specialty_id, availability_id);

-- 4. Comentarios en la tabla para documentar la nueva funcionalidad
ALTER TABLE appointments_waiting_list 
COMMENT = 'Lista de espera de citas. Puede organizarse por specialty_id (para filtrar por categoría) o availability_id (para agenda específica). Al menos uno debe ser NOT NULL.';

-- Ejemplos de uso:
-- 
-- CASO 1: Lista de espera por especialidad (sin agenda específica)
-- INSERT INTO appointments_waiting_list 
-- (patient_id, specialty_id, scheduled_date, priority_level, reason, status)
-- VALUES (1072, 3, '2025-10-20 10:00:00', 'Alta', 'Control cardiológico', 'pending');
--
-- CASO 2: Lista de espera por availability específico
-- INSERT INTO appointments_waiting_list 
-- (patient_id, availability_id, scheduled_date, priority_level, reason, status)
-- VALUES (1072, 156, '2025-10-20 10:00:00', 'Normal', 'Cita programada', 'pending');
--
-- CASO 3: Lista de espera con ambos (specialty + availability)
-- INSERT INTO appointments_waiting_list 
-- (patient_id, specialty_id, availability_id, scheduled_date, priority_level, reason, status)
-- VALUES (1072, 3, 156, '2025-10-20 10:00:00', 'Urgente', 'Control urgente', 'pending');
