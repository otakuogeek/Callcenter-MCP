-- Migration: Sistema de Autorizaciones EPS por Especialidad y Sede
-- Fecha: 2025-10-11
-- Descripción: Crea tabla para gestionar qué EPS pueden atender en qué especialidades y sedes

-- Tabla de autorizaciones: define qué EPS puede atender qué especialidad en qué sede
CREATE TABLE IF NOT EXISTS `eps_specialty_location_authorizations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `eps_id` INT UNSIGNED NOT NULL COMMENT 'ID de la EPS autorizada',
  `specialty_id` INT UNSIGNED NOT NULL COMMENT 'ID de la especialidad autorizada',
  `location_id` INT UNSIGNED NOT NULL COMMENT 'ID de la sede donde se autoriza',
  `authorized` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Si está actualmente autorizado',
  `authorization_date` DATE NULL COMMENT 'Fecha de inicio de la autorización',
  `expiration_date` DATE NULL COMMENT 'Fecha de expiración (opcional)',
  `max_monthly_appointments` INT UNSIGNED NULL COMMENT 'Cupo máximo mensual (opcional)',
  `copay_percentage` DECIMAL(5,2) NULL COMMENT 'Porcentaje de copago si aplica',
  `requires_prior_authorization` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si requiere autorización previa',
  `notes` TEXT NULL COMMENT 'Notas adicionales sobre la autorización',
  `created_by` INT UNSIGNED NULL COMMENT 'Usuario que creó la autorización',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_eps_specialty_location` (`eps_id`, `specialty_id`, `location_id`),
  KEY `idx_eps_id` (`eps_id`),
  KEY `idx_specialty_id` (`specialty_id`),
  KEY `idx_location_id` (`location_id`),
  KEY `idx_authorized` (`authorized`),
  KEY `idx_dates` (`authorization_date`, `expiration_date`),
  CONSTRAINT `fk_eps_auth_eps` FOREIGN KEY (`eps_id`) REFERENCES `eps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eps_auth_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eps_auth_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Autorizaciones de EPS por especialidad y sede';

-- Índices adicionales para optimizar búsquedas comunes
CREATE INDEX idx_active_authorizations ON eps_specialty_location_authorizations (authorized, authorization_date, expiration_date);
CREATE INDEX idx_eps_location ON eps_specialty_location_authorizations (eps_id, location_id);
CREATE INDEX idx_specialty_location ON eps_specialty_location_authorizations (specialty_id, location_id);

-- Datos de ejemplo: Famisanar autorizada para Cardiología, Odontología y Medicina General en ambas sedes
INSERT INTO `eps_specialty_location_authorizations` 
  (`eps_id`, `specialty_id`, `location_id`, `authorized`, `authorization_date`, `notes`) 
VALUES
  -- Famisanar (ID 12) en Sede San Gil (ID 1)
  (12, 3, 1, 1, '2024-01-01', 'Convenio inicial - Cardiología'),
  (12, 5, 1, 1, '2024-01-01', 'Convenio inicial - Odontología'),
  (12, 1, 1, 1, '2024-01-01', 'Convenio inicial - Medicina General'),
  
  -- Famisanar (ID 12) en Sede Socorro (ID 3)
  (12, 3, 3, 1, '2024-01-01', 'Convenio inicial - Cardiología'),
  (12, 5, 3, 1, '2024-01-01', 'Convenio inicial - Odontología'),
  (12, 1, 3, 1, '2024-01-01', 'Convenio inicial - Medicina General'),
  
  -- Nueva EPS (ID 14) en Sede San Gil (ID 1)
  (14, 1, 1, 1, '2024-01-01', 'Medicina General autorizada'),
  (14, 8, 1, 1, '2024-01-01', 'Pediatría autorizada'),
  
  -- COOSALUD Subsidiado (ID 60) en ambas sedes
  (60, 1, 1, 1, '2024-01-01', 'Medicina General - Régimen Subsidiado'),
  (60, 1, 3, 1, '2024-01-01', 'Medicina General - Régimen Subsidiado')
ON DUPLICATE KEY UPDATE
  `authorized` = VALUES(`authorized`),
  `notes` = VALUES(`notes`);

-- Vista para facilitar consultas con nombres legibles
CREATE OR REPLACE VIEW `v_eps_authorizations` AS
SELECT 
  ea.id,
  ea.eps_id,
  e.name AS eps_name,
  e.code AS eps_code,
  e.affiliation_type,
  ea.specialty_id,
  s.name AS specialty_name,
  ea.location_id,
  l.name AS location_name,
  l.municipality_id,
  ea.authorized,
  ea.authorization_date,
  ea.expiration_date,
  ea.max_monthly_appointments,
  ea.copay_percentage,
  ea.requires_prior_authorization,
  ea.notes,
  ea.created_at,
  ea.updated_at,
  -- Verificar si la autorización está vigente
  CASE 
    WHEN ea.authorized = 1 
      AND (ea.authorization_date IS NULL OR ea.authorization_date <= CURDATE())
      AND (ea.expiration_date IS NULL OR ea.expiration_date >= CURDATE())
    THEN 1
    ELSE 0
  END AS is_currently_valid
FROM eps_specialty_location_authorizations ea
INNER JOIN eps e ON ea.eps_id = e.id
INNER JOIN specialties s ON ea.specialty_id = s.id
INNER JOIN locations l ON ea.location_id = l.id;

-- Función para verificar si una EPS está autorizada
DELIMITER $$

CREATE FUNCTION `is_eps_authorized`(
  p_eps_id INT UNSIGNED,
  p_specialty_id INT UNSIGNED,
  p_location_id INT UNSIGNED
) RETURNS TINYINT(1)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE is_authorized TINYINT(1) DEFAULT 0;
  
  SELECT COUNT(*) INTO is_authorized
  FROM eps_specialty_location_authorizations
  WHERE eps_id = p_eps_id
    AND specialty_id = p_specialty_id
    AND location_id = p_location_id
    AND authorized = 1
    AND (authorization_date IS NULL OR authorization_date <= CURDATE())
    AND (expiration_date IS NULL OR expiration_date >= CURDATE());
  
  RETURN IF(is_authorized > 0, 1, 0);
END$$

DELIMITER ;

-- Procedimiento para obtener especialidades autorizadas para una EPS en una sede
DELIMITER $$

CREATE PROCEDURE `get_authorized_specialties_for_eps`(
  IN p_eps_id INT UNSIGNED,
  IN p_location_id INT UNSIGNED
)
BEGIN
  SELECT 
    s.id AS specialty_id,
    s.name AS specialty_name,
    s.description,
    ea.authorization_date,
    ea.expiration_date,
    ea.max_monthly_appointments,
    ea.copay_percentage,
    ea.requires_prior_authorization,
    ea.notes
  FROM eps_specialty_location_authorizations ea
  INNER JOIN specialties s ON ea.specialty_id = s.id
  WHERE ea.eps_id = p_eps_id
    AND ea.location_id = p_location_id
    AND ea.authorized = 1
    AND (ea.authorization_date IS NULL OR ea.authorization_date <= CURDATE())
    AND (ea.expiration_date IS NULL OR ea.expiration_date >= CURDATE())
  ORDER BY s.name;
END$$

DELIMITER ;

-- Procedimiento para obtener sedes donde una EPS está autorizada para una especialidad
DELIMITER $$

CREATE PROCEDURE `get_authorized_locations_for_eps_specialty`(
  IN p_eps_id INT UNSIGNED,
  IN p_specialty_id INT UNSIGNED
)
BEGIN
  SELECT 
    l.id AS location_id,
    l.name AS location_name,
    l.address,
    l.phone,
    l.municipality_id,
    ea.authorization_date,
    ea.expiration_date,
    ea.max_monthly_appointments,
    ea.copay_percentage,
    ea.requires_prior_authorization,
    ea.notes
  FROM eps_specialty_location_authorizations ea
  INNER JOIN locations l ON ea.location_id = l.id
  WHERE ea.eps_id = p_eps_id
    AND ea.specialty_id = p_specialty_id
    AND ea.authorized = 1
    AND (ea.authorization_date IS NULL OR ea.authorization_date <= CURDATE())
    AND (ea.expiration_date IS NULL OR ea.expiration_date >= CURDATE())
  ORDER BY l.name;
END$$

DELIMITER ;

-- Trigger para registrar cambios en autorizaciones
CREATE TABLE IF NOT EXISTS `eps_authorization_audit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `authorization_id` BIGINT UNSIGNED NOT NULL,
  `action` ENUM('created', 'updated', 'deleted') NOT NULL,
  `old_data` JSON NULL,
  `new_data` JSON NULL,
  `changed_by` INT UNSIGNED NULL,
  `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_authorization_id` (`authorization_id`),
  KEY `idx_changed_at` (`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

CREATE TRIGGER `trg_eps_auth_after_insert` 
AFTER INSERT ON `eps_specialty_location_authorizations`
FOR EACH ROW
BEGIN
  INSERT INTO eps_authorization_audit (authorization_id, action, new_data)
  VALUES (NEW.id, 'created', JSON_OBJECT(
    'eps_id', NEW.eps_id,
    'specialty_id', NEW.specialty_id,
    'location_id', NEW.location_id,
    'authorized', NEW.authorized,
    'authorization_date', NEW.authorization_date
  ));
END$$

CREATE TRIGGER `trg_eps_auth_after_update` 
AFTER UPDATE ON `eps_specialty_location_authorizations`
FOR EACH ROW
BEGIN
  INSERT INTO eps_authorization_audit (authorization_id, action, old_data, new_data)
  VALUES (NEW.id, 'updated', 
    JSON_OBJECT(
      'eps_id', OLD.eps_id,
      'specialty_id', OLD.specialty_id,
      'location_id', OLD.location_id,
      'authorized', OLD.authorized,
      'authorization_date', OLD.authorization_date
    ),
    JSON_OBJECT(
      'eps_id', NEW.eps_id,
      'specialty_id', NEW.specialty_id,
      'location_id', NEW.location_id,
      'authorized', NEW.authorized,
      'authorization_date', NEW.authorization_date
    )
  );
END$$

DELIMITER ;
