-- ============================================================================
-- Migración: Crear tabla de relación para múltiples CUPS por orden
-- Fecha: 2025-01-17
-- Descripción: Permite asociar hasta 3 códigos CUPS a una misma solicitud
--              en la lista de espera (para estudios múltiples como ecografías)
-- ============================================================================

-- Crear tabla de relación waiting_list_cups
CREATE TABLE IF NOT EXISTS waiting_list_cups (
  id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  waiting_list_id BIGINT(20) UNSIGNED NOT NULL COMMENT 'ID de la solicitud en lista de espera',
  cups_id INT(10) UNSIGNED NULL COMMENT 'ID del código CUPS (si existe en BD)',
  cups_code VARCHAR(20) NULL COMMENT 'Código CUPS manual o desde BD',
  cups_name VARCHAR(255) NOT NULL COMMENT 'Nombre del estudio/procedimiento',
  category VARCHAR(100) NULL COMMENT 'Categoría del CUPS',
  is_manual BOOLEAN DEFAULT FALSE COMMENT 'Si fue ingresado manualmente o viene de BD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_waiting_list_id (waiting_list_id),
  INDEX idx_cups_id (cups_id),
  
  CONSTRAINT fk_wl_cups_waiting_list
    FOREIGN KEY (waiting_list_id) 
    REFERENCES appointments_waiting_list(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
    
  CONSTRAINT fk_wl_cups_cups
    FOREIGN KEY (cups_id) 
    REFERENCES cups(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Relación N:N entre lista de espera y códigos CUPS (max 3 por orden)';

-- ============================================================================
-- Migrar datos existentes de appointments_waiting_list.cups_id
-- ============================================================================
INSERT INTO waiting_list_cups (waiting_list_id, cups_id, cups_code, cups_name, category, is_manual)
SELECT 
  awl.id as waiting_list_id,
  awl.cups_id,
  c.code as cups_code,
  c.name as cups_name,
  c.category,
  FALSE as is_manual
FROM appointments_waiting_list awl
INNER JOIN cups c ON awl.cups_id = c.id
WHERE awl.cups_id IS NOT NULL;

-- ============================================================================
-- Nota: NO eliminamos la columna cups_id de appointments_waiting_list
-- para mantener retrocompatibilidad con código existente
-- ============================================================================

-- Verificación
SELECT 
  'waiting_list_cups creada' as status,
  COUNT(*) as registros_migrados
FROM waiting_list_cups;
