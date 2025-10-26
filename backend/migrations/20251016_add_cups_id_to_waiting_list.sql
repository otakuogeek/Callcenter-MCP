-- ============================================================================
-- Migración: Agregar campo cups_id a appointments_waiting_list
-- Fecha: 2025-10-16
-- Descripción: Agrega campo cups_id para relacionar la lista de espera 
--              con los códigos CUPS (servicios médicos)
-- ============================================================================

-- Paso 1: Agregar la columna cups_id (nullable primero)
ALTER TABLE appointments_waiting_list
ADD COLUMN cups_id INT(10) UNSIGNED NULL 
COMMENT 'ID del código CUPS (servicio médico solicitado)'
AFTER availability_id;

-- Paso 2: Agregar índice para mejorar rendimiento en JOIN
ALTER TABLE appointments_waiting_list
ADD INDEX idx_cups_id (cups_id);

-- Paso 3: Agregar Foreign Key hacia la tabla cups
ALTER TABLE appointments_waiting_list
ADD CONSTRAINT fk_waiting_list_cups
FOREIGN KEY (cups_id) 
REFERENCES cups(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- ============================================================================
-- Verificación
-- ============================================================================
-- Para verificar que la migración se aplicó correctamente:
-- SELECT * FROM information_schema.KEY_COLUMN_USAGE 
-- WHERE TABLE_NAME = 'appointments_waiting_list' 
-- AND COLUMN_NAME = 'cups_id';
