-- Migration: Add holidays table and enhance availabilities for date ranges
-- Date: 2025-08-29

-- Create holidays table for non-working days
CREATE TABLE IF NOT EXISTS `holidays` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('national','regional','local','personal') NOT NULL DEFAULT 'national',
  `location_id` int UNSIGNED DEFAULT NULL,
  `is_recurring` tinyint(1) NOT NULL DEFAULT 0,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_date_location` (`date`, `location_id`),
  KEY `idx_date` (`date`),
  KEY `idx_type` (`type`),
  KEY `idx_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add working days configuration to doctors table
ALTER TABLE `doctors`
ADD COLUMN IF NOT EXISTS `working_days` JSON DEFAULT ('["monday","tuesday","wednesday","thursday","friday"]'),
ADD COLUMN IF NOT EXISTS `working_hours_start` TIME DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS `working_hours_end` TIME DEFAULT '17:00:00',
ADD COLUMN IF NOT EXISTS `lunch_break_start` TIME DEFAULT '12:00:00',
ADD COLUMN IF NOT EXISTS `lunch_break_end` TIME DEFAULT '13:00:00',
ADD COLUMN IF NOT EXISTS `slot_duration_minutes` INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS `max_daily_appointments` INT DEFAULT 20;

-- Add batch creation fields to availabilities table
ALTER TABLE `availabilities`
ADD COLUMN IF NOT EXISTS `batch_id` VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `is_batch_created` TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS `batch_created_at` TIMESTAMP NULL,
ADD KEY IF NOT EXISTS `idx_batch_id` (`batch_id`),
ADD KEY IF NOT EXISTS `idx_batch_created` (`is_batch_created`);

-- Insert some default holidays for Colombia
INSERT IGNORE INTO `holidays` (`date`, `name`, `type`, `is_recurring`, `description`) VALUES
('2025-01-01', 'Año Nuevo', 'national', 1, 'Celebración del año nuevo'),
('2025-01-06', 'Día de los Reyes Magos', 'national', 1, 'Epifanía del Señor'),
('2025-03-24', 'Día de San José', 'national', 1, 'Festividad religiosa'),
('2025-04-13', 'Domingo de Ramos', 'national', 0, 'Semana Santa'),
('2025-04-18', 'Jueves Santo', 'national', 0, 'Semana Santa'),
('2025-04-19', 'Viernes Santo', 'national', 0, 'Semana Santa'),
('2025-04-20', 'Domingo de Resurrección', 'national', 1, 'Pascua'),
('2025-05-01', 'Día del Trabajo', 'national', 1, 'Celebración laboral'),
('2025-05-12', 'Día de la Ascensión', 'national', 0, 'Festividad religiosa'),
('2025-06-02', 'Corpus Christi', 'national', 0, 'Festividad religiosa'),
('2025-06-23', 'Sagrado Corazón', 'national', 0, 'Festividad religiosa'),
('2025-07-20', 'Día de la Independencia', 'national', 1, 'Grito de Independencia'),
('2025-08-07', 'Batalla de Boyacá', 'national', 1, 'Victoria militar'),
('2025-08-18', 'La Asunción', 'national', 1, 'Festividad religiosa'),
('2025-10-13', 'Día de la Raza', 'national', 1, 'Descubrimiento de América'),
('2025-11-03', 'San Martín de Porres', 'national', 0, 'Festividad religiosa'),
('2025-11-17', 'Independencia de Cartagena', 'national', 1, 'Independencia regional'),
('2025-12-08', 'Día de la Inmaculada Concepción', 'national', 1, 'Festividad religiosa'),
('2025-12-25', 'Navidad', 'national', 1, 'Nacimiento de Jesús');

-- Create stored procedure for batch availability creation
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS `create_batch_availabilities`(
    IN p_doctor_id BIGINT,
    IN p_location_id INT,
    IN p_specialty_id INT,
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_start_time TIME,
    IN p_end_time TIME,
    IN p_capacity INT,
    IN p_slot_duration INT,
    IN p_batch_id VARCHAR(50),
    IN p_exclude_weekends BOOLEAN,
    IN p_exclude_holidays BOOLEAN
)
BEGIN
    DECLARE current_date DATE DEFAULT p_start_date;
    DECLARE slots_per_day INT;
    DECLARE batch_uuid VARCHAR(50);

    -- Generate batch ID if not provided
    IF p_batch_id IS NULL OR p_batch_id = '' THEN
        SET batch_uuid = CONCAT('batch_', UNIX_TIMESTAMP(), '_', FLOOR(RAND() * 1000));
    ELSE
        SET batch_uuid = p_batch_id;
    END IF;

    -- Calculate slots per day
    SET slots_per_day = FLOOR(TIMESTAMPDIFF(MINUTE, p_start_time, p_end_time) / p_slot_duration);

    -- Loop through each date in the range
    WHILE current_date <= p_end_date DO
        -- Check if we should create availability for this date
        IF (NOT p_exclude_weekends OR WEEKDAY(current_date) < 5)  -- 0=Monday, 5=Saturday, 6=Sunday
            AND (NOT p_exclude_holidays OR NOT EXISTS (
                SELECT 1 FROM holidays
                WHERE date = current_date
                AND (location_id IS NULL OR location_id = p_location_id)
            )) THEN

            -- Create availability for this date
            INSERT INTO availabilities (
                location_id,
                specialty_id,
                doctor_id,
                date,
                start_time,
                end_time,
                capacity,
                status,
                batch_id,
                is_batch_created,
                batch_created_at
            ) VALUES (
                p_location_id,
                p_specialty_id,
                p_doctor_id,
                current_date,
                p_start_time,
                p_end_time,
                p_capacity,
                'Activa',
                batch_uuid,
                1,
                NOW()
            );
        END IF;

        -- Move to next date
        SET current_date = DATE_ADD(current_date, INTERVAL 1 DAY);
    END WHILE;

    -- Return the batch ID
    SELECT batch_uuid AS batch_id;
END //

DELIMITER ;

-- Create function to distribute appointments randomly across available dates
DELIMITER //

CREATE FUNCTION `distribute_appointments_random`(
    p_batch_id VARCHAR(50),
    p_total_appointments INT
) RETURNS TEXT
DETERMINISTIC
BEGIN
    DECLARE available_dates TEXT DEFAULT '';
    DECLARE date_count INT DEFAULT 0;
    DECLARE appointments_per_date INT;
    DECLARE remaining_appointments INT;
    DECLARE current_date DATE;
    DECLARE done INT DEFAULT FALSE;

    -- Cursor to get available dates for this batch
    DECLARE cur_dates CURSOR FOR
        SELECT date FROM availabilities
        WHERE batch_id = p_batch_id
        AND status = 'Activa'
        ORDER BY date;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Get all available dates
    OPEN cur_dates;
    dates_loop: LOOP
        FETCH cur_dates INTO current_date;
        IF done THEN
            LEAVE dates_loop;
        END IF;
        SET available_dates = CONCAT(available_dates, ',', DATE_FORMAT(current_date, '%Y-%m-%d'));
        SET date_count = date_count + 1;
    END LOOP;
    CLOSE cur_dates;

    -- Remove leading comma
    IF LENGTH(available_dates) > 0 THEN
        SET available_dates = SUBSTRING(available_dates, 2);
    END IF;

    -- Calculate distribution
    IF date_count > 0 THEN
        SET appointments_per_date = FLOOR(p_total_appointments / date_count);
        SET remaining_appointments = p_total_appointments MOD date_count;
    END IF;

    RETURN CONCAT('{"dates":"', available_dates, '","count":', date_count, ',"per_date":', appointments_per_date, ',"remaining":', remaining_appointments, '}');
END //

DELIMITER ;
