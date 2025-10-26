-- Script para corregir la asignación de horarios en appointments
-- Las citas deben asignarse secuencialmente sumando duration_minutes
-- Agrupadas por location_id, specialty_id, doctor_id y fecha

-- Primero, veamos el problema actual
SELECT 
    a.id,
    p.name AS patient_name,
    a.scheduled_at,
    TIME(a.scheduled_at) AS hora,
    a.duration_minutes,
    a.location_id,
    a.specialty_id,
    a.doctor_id,
    av.start_time AS hora_inicio_disponibilidad
FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN availabilities av ON a.availability_id = av.id
WHERE DATE(a.scheduled_at) = '2025-10-19'
ORDER BY a.location_id, a.specialty_id, a.doctor_id, a.scheduled_at
LIMIT 50;
