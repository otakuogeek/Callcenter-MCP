-- =====================================================
-- Migración: Actualizar tabla EPS con campos adicionales
-- Fecha: 2025-10-04
-- Descripción: Agregar columnas para tipo de afiliación, contacto y convenios
-- =====================================================

-- Agregar columnas nuevas
ALTER TABLE eps 
  ADD COLUMN IF NOT EXISTS affiliation_type ENUM('Contributivo', 'Subsidiado', 'Especial', 'Mixto') DEFAULT 'Contributivo' COMMENT 'Tipo de régimen' AFTER code,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL COMMENT 'Teléfono de atención' AFTER affiliation_type,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL COMMENT 'Email de contacto' AFTER phone,
  ADD COLUMN IF NOT EXISTS website VARCHAR(255) NULL COMMENT 'Sitio web' AFTER email,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Actualizar el enum de status para incluir 'Liquidación'
ALTER TABLE eps 
  MODIFY COLUMN status ENUM('active', 'inactive', 'Activa', 'Inactiva', 'Liquidación') DEFAULT 'active';

-- Agregar índices
ALTER TABLE eps
  ADD INDEX IF NOT EXISTS idx_status (status),
  ADD INDEX IF NOT EXISTS idx_affiliation (affiliation_type),
  ADD INDEX IF NOT EXISTS idx_has_agreement (has_agreement);

-- Limpiar tabla para insertar datos actualizados (si no hay pacientes asociados)
-- Primero verificar si hay datos en uso
SET @patient_count = (SELECT COUNT(*) FROM patients WHERE insurance_eps_id IS NOT NULL);

-- Solo limpiar si no hay pacientes con EPS asignadas
-- DELETE FROM eps WHERE @patient_count = 0;

-- Usar INSERT IGNORE para evitar duplicados o actualizar si existe
INSERT INTO eps (code, name, affiliation_type, status, phone, website, has_agreement) VALUES
-- EPS Grandes Contributivas
('2721', 'COOMEVA', 'Contributivo', 'Activa', '01 8000 113 414', 'https://www.coomeva.com.co', TRUE),
('2720', 'SINTRAVID', 'Contributivo', 'Activa', NULL, NULL, FALSE),
('2719', 'FUNDACION AVANZAR FOS', 'Contributivo', 'Activa', NULL, NULL, FALSE),
('2718', 'FAMISANAR', 'Contributivo', 'Activa', '01 8000 423 362', 'https://www.famisanar.com.co', TRUE),
('2717', 'FOMA FIDUPREVISORA S.A', 'Contributivo', 'Activa', NULL, NULL, FALSE),
('2716', 'CAPITAL SALUD', 'Contributivo', 'Activa', '601 756 7700', 'https://www.capitalsalud.gov.co', TRUE),
('2715', 'NUEVA EPS', 'Contributivo', 'Activa', '01 8000 123 001', 'https://www.nuevaeps.com.co', TRUE),
('2714', 'SOUL MEDICAL', 'Contributivo', 'Activa', NULL, NULL, FALSE),
('2713', 'SALUD COOSALUD', 'Contributivo', 'Activa', '01 8000 410 111', 'https://www.coosalud.com', TRUE),
('2712', 'SAVIA SALUD', 'Contributivo', 'Activa', '01 8000 425 325', 'https://www.saviasalud.com', TRUE),
('2711', 'SANITAS', 'Contributivo', 'Activa', '601 651 8888', 'https://www.sanitas.com.co', TRUE),
('2710', 'SALUD TOTAL', 'Contributivo', 'Activa', '01 8000 116 600', 'https://www.saludtotal.com.co', TRUE),
('2709', 'COMPENSAR', 'Contributivo', 'Activa', '601 444 4444', 'https://www.compensar.com', TRUE),
('2708', 'ALIANSALUD', 'Contributivo', 'Activa', '01 8000 111 170', 'https://www.aliansalud.com.co', TRUE),
('2707', 'COMFENALCO VALLE', 'Contributivo', 'Activa', '602 886 6666', 'https://www.comfenalcovalle.com.co', TRUE),
('2706', 'SURAMERICANA', 'Contributivo', 'Activa', '01 8000 519 519', 'https://www.segurossura.com.co', TRUE),

-- EPS Régimen Subsidiado
('SS01', 'CAPITAL SALUD (Subsidiado)', 'Subsidiado', 'Activa', '601 756 7700', 'https://www.capitalsalud.gov.co', TRUE),
('SS02', 'COOSALUD (Subsidiado)', 'Subsidiado', 'Activa', '01 8000 410 111', 'https://www.coosalud.com', TRUE),
('SS03', 'NUEVA EPS (Subsidiado)', 'Subsidiado', 'Activa', '01 8000 123 001', 'https://www.nuevaeps.com.co', TRUE),
('SS04', 'MUTUAL SER', 'Subsidiado', 'Activa', '01 8000 127 378', 'https://www.mutualser.com', TRUE),
('SS05', 'ASMET SALUD', 'Subsidiado', 'Activa', '01 8000 113 414', 'https://www.asmetsalud.org.co', TRUE),
('SS06', 'SALUD MIA', 'Subsidiado', 'Activa', NULL, NULL, FALSE),
('SS07', 'EMDISALUD', 'Subsidiado', 'Activa', NULL, NULL, FALSE),

-- Regímenes Especiales
('RE01', 'MAGISTERIO (FOMAG)', 'Especial', 'Activa', '01 8000 114 818', 'https://www.fomag.gov.co', TRUE),
('RE02', 'FUERZAS MILITARES', 'Especial', 'Activa', NULL, NULL, FALSE),
('RE03', 'POLICIA NACIONAL', 'Especial', 'Activa', NULL, NULL, FALSE),
('RE04', 'ECOPETROL', 'Especial', 'Activa', NULL, NULL, FALSE),
('RE05', 'UNIVERSIDADES PUBLICAS', 'Especial', 'Activa', NULL, NULL, FALSE),

-- Otras EPS Activas
('2702', 'MEDIMAS', 'Contributivo', 'Activa', '01 8000 110 400', 'https://www.medimas.com.co', TRUE),
('2701', 'CAFESALUD (En liquidación)', 'Contributivo', 'Liquidación', NULL, NULL, FALSE),
('2700', 'SALUDVIDA', 'Contributivo', 'Activa', '01 8000 113 300', 'https://www.saludvida.com.co', TRUE),

-- Particular / Sin EPS
('0000', 'PARTICULAR - SIN EPS', 'Mixto', 'Activa', NULL, NULL, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  affiliation_type = VALUES(affiliation_type),
  status = VALUES(status),
  phone = VALUES(phone),
  website = VALUES(website),
  has_agreement = VALUES(has_agreement);

-- Verificar inserción
SELECT 'Total EPS insertadas:' as resultado, COUNT(*) as total FROM eps;

-- Mostrar resumen por tipo
SELECT 'Resumen por tipo de afiliación:' as resultado;
SELECT affiliation_type, COUNT(*) as cantidad, 
       SUM(CASE WHEN status = 'Activa' THEN 1 ELSE 0 END) as activas,
       SUM(CASE WHEN has_agreement = 1 THEN 1 ELSE 0 END) as con_convenio
FROM eps 
GROUP BY affiliation_type;
