-- Script SQL para sincronizar booked_slots con citas reales

-- Primero, ver el estado actual
SELECT 
    a.id,
    DATE_FORMAT(a.date, '%Y-%m-%d') as fecha,
    a.capacity,
    a.booked_slots as slots_actuales,
    COUNT(apt.id) as citas_reales,
    a.status
FROM availabilities a
LEFT JOIN appointments apt ON apt.availability_id = a.id 
    AND apt.status IN ('Confirmada', 'Reagendada', 'En sala de espera', 'En consulta')
WHERE a.date >= CURDATE()
    AND a.status IN ('Activa', 'Completa')
GROUP BY a.id, a.date, a.capacity, a.booked_slots, a.status
ORDER BY a.date, a.start_time;

-- Actualizar booked_slots basado en citas reales
UPDATE availabilities a
SET booked_slots = (
    SELECT COUNT(*)
    FROM appointments apt
    WHERE apt.availability_id = a.id
        AND apt.status IN ('Confirmada', 'Reagendada', 'En sala de espera', 'En consulta')
)
WHERE a.date >= CURDATE()
    AND a.status IN ('Activa', 'Completa');

-- Actualizar status basado en la ocupación
UPDATE availabilities 
SET status = CASE
    WHEN booked_slots >= capacity THEN 'Completa'
    WHEN booked_slots < capacity THEN 'Activa'
    ELSE status
END
WHERE date >= CURDATE()
    AND status IN ('Activa', 'Completa');

-- Verificar resultado
SELECT 
    a.id,
    DATE_FORMAT(a.date, '%Y-%m-%d') as fecha,
    a.capacity,
    a.booked_slots,
    GREATEST(0, CAST(a.capacity AS SIGNED) - CAST(a.booked_slots AS SIGNED)) as disponibles,
    a.status
FROM availabilities a
WHERE a.date >= CURDATE()
    AND a.status IN ('Activa', 'Completa')
ORDER BY a.date, a.start_time;
