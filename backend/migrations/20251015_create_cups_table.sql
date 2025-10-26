-- Migración: Crear tabla de códigos CUPS
-- Fecha: 2025-10-15
-- Descripción: Tabla para gestionar códigos CUPS (Clasificación Única de Procedimientos en Salud)

-- Crear tabla cups
CREATE TABLE IF NOT EXISTS cups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  
  -- Código y descripción del procedimiento
  code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Código CUPS único',
  name VARCHAR(500) NOT NULL COMMENT 'Nombre/descripción del procedimiento',
  
  -- Clasificación
  category VARCHAR(100) COMMENT 'Categoría principal del procedimiento',
  subcategory VARCHAR(100) COMMENT 'Subcategoría del procedimiento',
  
  -- Información adicional
  description TEXT COMMENT 'Descripción detallada del procedimiento',
  
  -- Relación con especialidades
  specialty_id INT UNSIGNED COMMENT 'Especialidad médica asociada',
  
  -- Información de facturación
  base_price DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Precio base del procedimiento',
  requires_authorization BOOLEAN DEFAULT FALSE COMMENT 'Requiere autorización de EPS',
  
  -- Complejidad y duración
  complexity_level ENUM('Baja', 'Media', 'Alta') DEFAULT 'Media' COMMENT 'Nivel de complejidad',
  estimated_duration_minutes INT DEFAULT 30 COMMENT 'Duración estimada en minutos',
  
  -- Requisitos
  requires_anesthesia BOOLEAN DEFAULT FALSE COMMENT 'Requiere anestesia',
  requires_hospitalization BOOLEAN DEFAULT FALSE COMMENT 'Requiere hospitalización',
  requires_previous_studies BOOLEAN DEFAULT FALSE COMMENT 'Requiere estudios previos',
  
  -- Estado y control
  status ENUM('Activo', 'Inactivo', 'Descontinuado') DEFAULT 'Activo' COMMENT 'Estado del código CUPS',
  is_surgical BOOLEAN DEFAULT FALSE COMMENT 'Es un procedimiento quirúrgico',
  
  -- Notas y observaciones
  notes TEXT COMMENT 'Notas adicionales sobre el procedimiento',
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT COMMENT 'Usuario que creó el registro',
  updated_by INT COMMENT 'Usuario que actualizó el registro',
  
  -- Índices
  INDEX idx_code (code),
  INDEX idx_category (category),
  INDEX idx_specialty (specialty_id),
  INDEX idx_status (status),
  INDEX idx_name (name(100)),
  
  -- Llave foránea con especialidades
  FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tabla de códigos CUPS - Clasificación Única de Procedimientos en Salud';

-- Tabla de relación entre CUPS y servicios
CREATE TABLE IF NOT EXISTS cups_services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cups_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE COMMENT 'Es el servicio principal para este CUPS',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_cups_service (cups_id, service_id),
  FOREIGN KEY (cups_id) REFERENCES cups(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Relación entre códigos CUPS y servicios';

-- Tabla de relación entre CUPS y EPS (para autorizaciones específicas)
CREATE TABLE IF NOT EXISTS cups_eps_config (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cups_id INT UNSIGNED NOT NULL,
  eps_id INT UNSIGNED NOT NULL,
  requires_authorization BOOLEAN DEFAULT TRUE,
  authorization_days INT DEFAULT 5 COMMENT 'Días hábiles para autorización',
  copayment_percentage DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Porcentaje de copago',
  observations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_cups_eps (cups_id, eps_id),
  FOREIGN KEY (cups_id) REFERENCES cups(id) ON DELETE CASCADE,
  FOREIGN KEY (eps_id) REFERENCES eps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración específica de CUPS por EPS';

-- Insertar algunos códigos CUPS de ejemplo
INSERT INTO cups (code, name, category, subcategory, specialty_id, base_price, complexity_level, estimated_duration_minutes, is_surgical) VALUES
-- Consultas
('890201', 'Consulta de primera vez por medicina general', 'Consultas', 'Medicina General', 1, 35000.00, 'Baja', 20, FALSE),
('890202', 'Consulta de control por medicina general', 'Consultas', 'Medicina General', 1, 30000.00, 'Baja', 15, FALSE),
('890301', 'Consulta de primera vez por medicina especializada', 'Consultas', 'Especializada', NULL, 50000.00, 'Media', 30, FALSE),
('890302', 'Consulta de control por medicina especializada', 'Consultas', 'Especializada', NULL, 45000.00, 'Media', 20, FALSE),

-- Procedimientos diagnósticos
('871101', 'Toma de presión arterial', 'Procedimientos', 'Diagnóstico', 1, 5000.00, 'Baja', 5, FALSE),
('871102', 'Toma de temperatura', 'Procedimientos', 'Diagnóstico', 1, 3000.00, 'Baja', 3, FALSE),
('872101', 'Electrocardiograma', 'Procedimientos', 'Diagnóstico', NULL, 25000.00, 'Baja', 15, FALSE),

-- Procedimientos terapéuticos
('931101', 'Curación simple', 'Procedimientos', 'Terapéutico', NULL, 15000.00, 'Baja', 10, FALSE),
('931102', 'Curación compleja', 'Procedimientos', 'Terapéutico', NULL, 35000.00, 'Media', 20, FALSE),
('932101', 'Inyección intramuscular', 'Procedimientos', 'Terapéutico', NULL, 8000.00, 'Baja', 5, FALSE),

-- Imágenes diagnósticas
('876101', 'Radiografía de tórax', 'Imágenes', 'Radiología', NULL, 45000.00, 'Baja', 15, FALSE),
('876201', 'Ecografía abdominal', 'Imágenes', 'Ecografía', NULL, 80000.00, 'Media', 30, FALSE),

-- Laboratorio clínico
('901109', 'Hemograma completo', 'Laboratorio', 'Hematología', NULL, 25000.00, 'Baja', 30, FALSE),
('902210', 'Glicemia en ayunas', 'Laboratorio', 'Química Clínica', NULL, 15000.00, 'Baja', 15, FALSE);

-- Log de cambios
INSERT INTO migration_log (migration_file, description, executed_at) 
VALUES ('20251015_create_cups_table.sql', 'Creación de tabla CUPS y tablas relacionadas', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
