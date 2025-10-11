-- Actualizar estado de las disponibilidades
UPDATE availabilities SET status = 'active' WHERE status = 'Activa';
UPDATE availabilities SET status = 'cancelled' WHERE status = 'Cancelada';
UPDATE availabilities SET status = 'completed' WHERE status = 'Completa';

-- Cambiar tipo de columna en availabilities
ALTER TABLE availabilities MODIFY COLUMN status ENUM('active', 'cancelled', 'completed') NOT NULL DEFAULT 'active';

-- Actualizar estado de las locaciones
UPDATE locations SET status = 'active' WHERE status = 'Activa';
UPDATE locations SET status = 'maintenance' WHERE status = 'En Mantenimiento';
UPDATE locations SET status = 'inactive' WHERE status = 'Inactiva';

-- Cambiar tipo de columna en locations
ALTER TABLE locations MODIFY COLUMN status ENUM('active', 'maintenance', 'inactive') NOT NULL DEFAULT 'active';

-- Actualizar estado de las EPS
UPDATE eps SET status = 'active' WHERE status = 'Activa';
UPDATE eps SET status = 'inactive' WHERE status = 'Inactiva';
UPDATE eps SET status = 'liquidation' WHERE status = 'Liquidación';

-- Cambiar tipo de columna en eps
ALTER TABLE eps MODIFY COLUMN status ENUM('active', 'inactive', 'liquidation') NOT NULL DEFAULT 'active';