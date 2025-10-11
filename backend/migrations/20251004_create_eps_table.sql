-- =====================================================
-- Migración: Crear tabla de EPS (Entidades Promotoras de Salud)
-- Fecha: 2025-10-04
-- Descripción: Tabla maestra de EPS colombianas para asignación a pacientes
-- =====================================================

-- Crear tabla de EPS
CREATE TABLE IF NOT EXISTS eps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE COMMENT 'Código único de la EPS',
  name VARCHAR(255) NOT NULL COMMENT 'Nombre completo de la EPS',
  affiliation_type ENUM('Contributivo', 'Subsidiado', 'Especial', 'Mixto') DEFAULT 'Contributivo' COMMENT 'Tipo de régimen',
  status ENUM('Activa', 'Inactiva', 'Liquidación') DEFAULT 'Activa' COMMENT 'Estado operativo',
  phone VARCHAR(20) NULL COMMENT 'Teléfono de atención',
  email VARCHAR(255) NULL COMMENT 'Email de contacto',
  website VARCHAR(255) NULL COMMENT 'Sitio web',
  has_agreement BOOLEAN DEFAULT FALSE COMMENT 'Si tiene convenio con la IPS',
  notes TEXT NULL COMMENT 'Notas adicionales',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status (status),
  INDEX idx_affiliation (affiliation_type),
  INDEX idx_has_agreement (has_agreement)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Entidades Promotoras de Salud';

-- Insertar EPS principales de Colombia (Régimen Contributivo)
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
('0000', 'PARTICULAR - SIN EPS', 'Mixto', 'Activa', NULL, NULL, TRUE);

-- Verificar inserción
SELECT COUNT(*) as total_eps_insertadas FROM eps;

-- Mostrar resumen por tipo
SELECT affiliation_type, COUNT(*) as cantidad, 
       SUM(CASE WHEN status = 'Activa' THEN 1 ELSE 0 END) as activas
FROM eps 
GROUP BY affiliation_type;
