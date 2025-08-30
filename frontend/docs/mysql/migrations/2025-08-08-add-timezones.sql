-- Crea tabla timezones e inserta zonas horarias comunes
CREATE TABLE IF NOT EXISTS `timezones` (
  `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_timezone_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO `timezones` (`name`) VALUES
('UTC'),
('America/Bogota'),
('America/Lima'),
('America/Guayaquil'),
('America/Caracas'),
('America/Mexico_City'),
('America/Panama'),
('America/Santo_Domingo'),
('America/La_Paz'),
('America/Santiago'),
('America/Asuncion'),
('America/Montevideo'),
('America/Argentina/Buenos_Aires'),
('America/Chicago'),
('America/New_York'),
('America/Los_Angeles'),
('Atlantic/Cape_Verde'),
('Atlantic/Azores'),
('Europe/London'),
('Europe/Madrid'),
('Europe/Berlin'),
('Europe/Paris'),
('Europe/Rome');
