-- Tabla para registrar historial de pausas/reanudaciones
CREATE TABLE IF NOT EXISTS availability_pause_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  availability_id BIGINT UNSIGNED NOT NULL,
  action ENUM('paused', 'resumed') NOT NULL,
  slots_affected INT NOT NULL DEFAULT 0,
  phantom_appointments_created INT NOT NULL DEFAULT 0,
  phantom_appointments_deleted INT NOT NULL DEFAULT 0,
  previous_booked_slots INT NOT NULL DEFAULT 0,
  new_booked_slots INT NOT NULL DEFAULT 0,
  user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL,
  FOREIGN KEY (availability_id) REFERENCES availabilities(id) ON DELETE CASCADE,
  INDEX idx_availability_action (availability_id, action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trigger para prevenir sincronización automática cuando está pausada
DELIMITER $$

CREATE TRIGGER prevent_sync_when_paused
BEFORE UPDATE ON availabilities
FOR EACH ROW
BEGIN
  -- Si la agenda está pausada y alguien intenta modificar booked_slots directamente
  -- (no a través de toggle-pause), revertir el cambio
  IF OLD.is_paused = TRUE AND NEW.is_paused = TRUE THEN
    IF NEW.booked_slots != OLD.booked_slots THEN
      -- Mantener el valor anterior de booked_slots cuando está pausada
      SET NEW.booked_slots = OLD.booked_slots;
    END IF;
  END IF;
END$$

DELIMITER ;
