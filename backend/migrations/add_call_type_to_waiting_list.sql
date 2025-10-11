-- Agregar columna call_type a appointments_waiting_list
-- Esta columna permite identificar el tipo de llamada en lista de espera
-- Valores: 'normal' (llamada estándar) y 'reagendar' (cita cancelada que requiere reagendamiento)

ALTER TABLE appointments_waiting_list 
ADD COLUMN call_type ENUM('normal', 'reagendar') NOT NULL DEFAULT 'normal'
COMMENT 'Tipo de llamada: normal o reagendar (citas canceladas con prioridad visual)';

-- Crear índice para mejorar consultas filtradas por call_type
CREATE INDEX idx_call_type ON appointments_waiting_list(call_type);
