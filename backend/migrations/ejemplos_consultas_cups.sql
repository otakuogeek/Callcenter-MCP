-- ============================================================================
-- EJEMPLOS DE CONSULTAS CON RELACIÓN CUPS
-- ============================================================================

-- 1. CONSULTA: Lista de espera con información del servicio CUPS
-- Obtiene todas las solicitudes en lista de espera con el nombre del servicio
SELECT 
    awl.id AS waiting_list_id,
    awl.patient_id,
    awl.scheduled_date,
    awl.priority_level,
    awl.status,
    awl.created_at,
    -- Información del servicio CUPS
    c.id AS cups_id,
    c.code AS cups_code,
    c.name AS cups_name,
    c.category AS cups_category,
    c.price AS cups_price,
    c.requires_authorization
FROM appointments_waiting_list awl
LEFT JOIN cups c ON awl.cups_id = c.id
WHERE awl.status = 'pending'
ORDER BY awl.priority_level DESC, awl.created_at ASC;

-- ============================================================================

-- 2. CONSULTA: Citas agendadas con servicio CUPS
-- Obtiene todas las citas con el servicio médico asociado
SELECT 
    a.id AS appointment_id,
    a.patient_id,
    a.scheduled_date,
    a.scheduled_time,
    a.status,
    -- Información del servicio CUPS
    c.id AS cups_id,
    c.code AS cups_code,
    c.name AS cups_name,
    c.category AS cups_category,
    c.price AS cups_price,
    c.estimated_duration_minutes
FROM appointments a
LEFT JOIN cups c ON a.cups_id = c.id
WHERE a.status = 'scheduled'
ORDER BY a.scheduled_date, a.scheduled_time;

-- ============================================================================

-- 3. CONSULTA: Estadísticas de servicios CUPS más solicitados en lista de espera
SELECT 
    c.code AS cups_code,
    c.name AS cups_name,
    c.category AS cups_category,
    COUNT(awl.id) AS total_en_espera,
    SUM(CASE WHEN awl.priority_level = 'Urgente' THEN 1 ELSE 0 END) AS urgentes,
    SUM(CASE WHEN awl.priority_level = 'Alta' THEN 1 ELSE 0 END) AS alta_prioridad
FROM cups c
LEFT JOIN appointments_waiting_list awl ON c.id = awl.cups_id 
    AND awl.status = 'pending'
WHERE c.status = 'Activo'
GROUP BY c.id, c.code, c.name, c.category
HAVING total_en_espera > 0
ORDER BY total_en_espera DESC;

-- ============================================================================

-- 4. CONSULTA: Servicios CUPS con mayor demanda (citas + lista de espera)
SELECT 
    c.code AS cups_code,
    c.name AS cups_name,
    c.category AS cups_category,
    c.price,
    COUNT(DISTINCT a.id) AS total_citas_agendadas,
    COUNT(DISTINCT awl.id) AS total_en_lista_espera,
    (COUNT(DISTINCT a.id) + COUNT(DISTINCT awl.id)) AS demanda_total
FROM cups c
LEFT JOIN appointments a ON c.id = a.cups_id 
    AND a.status IN ('scheduled', 'confirmed')
LEFT JOIN appointments_waiting_list awl ON c.id = awl.cups_id 
    AND awl.status = 'pending'
WHERE c.status = 'Activo'
GROUP BY c.id, c.code, c.name, c.category, c.price
ORDER BY demanda_total DESC
LIMIT 20;

-- ============================================================================

-- 5. CONSULTA: Ingresos proyectados por servicio CUPS
SELECT 
    c.code AS cups_code,
    c.name AS cups_name,
    c.category AS cups_category,
    c.price AS precio_unitario,
    COUNT(a.id) AS citas_confirmadas,
    (c.price * COUNT(a.id)) AS ingreso_total
FROM cups c
INNER JOIN appointments a ON c.id = a.cups_id
WHERE a.status IN ('confirmed', 'completed')
    AND c.status = 'Activo'
GROUP BY c.id, c.code, c.name, c.category, c.price
ORDER BY ingreso_total DESC;

-- ============================================================================

-- 6. ACTUALIZAR: Asignar CUPS a una solicitud en lista de espera
-- Ejemplo: Asignar el servicio "Ecografía abdominal" (código 881201)
UPDATE appointments_waiting_list
SET cups_id = (SELECT id FROM cups WHERE code = '881201' LIMIT 1)
WHERE id = 1; -- Reemplazar con el ID de la solicitud

-- ============================================================================

-- 7. ACTUALIZAR: Asignar CUPS a una cita existente
-- Ejemplo: Asignar el servicio a una cita específica
UPDATE appointments
SET cups_id = (SELECT id FROM cups WHERE code = '881201' LIMIT 1)
WHERE id = 1; -- Reemplazar con el ID de la cita

-- ============================================================================

-- 8. CONSULTA: Verificar integridad de datos
-- Buscar registros con cups_id que no existe en la tabla cups
SELECT 
    'appointments_waiting_list' AS tabla,
    awl.id,
    awl.cups_id
FROM appointments_waiting_list awl
LEFT JOIN cups c ON awl.cups_id = c.id
WHERE awl.cups_id IS NOT NULL AND c.id IS NULL

UNION ALL

SELECT 
    'appointments' AS tabla,
    a.id,
    a.cups_id
FROM appointments a
LEFT JOIN cups c ON a.cups_id = c.id
WHERE a.cups_id IS NOT NULL AND c.id IS NULL;
