-- Script SQL para generar citas de muestra en Biosanar
-- Este script inserta citas realistas para todos los pacientes existentes

-- Desactivar autocommit para transacción
SET autocommit = 0;
START TRANSACTION;

-- Insertar citas de muestra
INSERT INTO appointments (
    patient_id, 
    doctor_id, 
    specialty_id, 
    location_id, 
    scheduled_at, 
    duration_minutes, 
    appointment_type, 
    status, 
    reason, 
    insurance_type, 
    notes, 
    created_by_user_id
) VALUES

-- Citas para Dave Bastidas (paciente ID 2)
(2, 1, 1, 1, '2025-08-25 09:00:00', 30, 'Presencial', 'Confirmada', 'Consulta de control', 'Contributivo', 'Paciente con seguimiento regular', 1),
(2, 2, 3, 1, '2025-09-15 14:30:00', 45, 'Presencial', 'Pendiente', 'Control cardiológico', 'Contributivo', null, 1),

-- Citas para Juan Pérez (paciente ID 1)
(1, 1, 1, 1, '2025-08-23 10:30:00', 30, 'Presencial', 'Confirmada', 'Chequeo preventivo', 'Subsidiado', null, 1),
(1, 4, 8, 3, '2025-09-02 16:00:00', 45, 'Telemedicina', 'Pendiente', 'Control pediátrico', 'Subsidiado', null, 1),
(1, 2, 10, 1, '2025-08-15 11:00:00', 30, 'Presencial', 'Completada', 'Revisión dermatológica', 'Subsidiado', 'Tratamiento aplicado exitosamente', 1),

-- Citas para Juan Sebastián Correa (paciente ID 4)
(4, 2, 5, 1, '2025-08-26 08:30:00', 60, 'Presencial', 'Confirmada', 'Control de diabetes', 'Contributivo', null, 1),
(4, 1, 1, 3, '2025-09-10 15:00:00', 30, 'Presencial', 'Pendiente', 'Consulta de rutina', 'Contributivo', null, 1),
(4, 4, 9, 1, '2025-08-18 13:30:00', 45, 'Presencial', 'Completada', 'Evaluación medicina interna', 'Contributivo', 'Paciente estable, continuar tratamiento', 1),

-- Citas para MARIAJOSE DELGADO (paciente ID 3)
(3, 2, 12, 1, '2025-08-27 09:30:00', 45, 'Presencial', 'Confirmada', 'Control ginecológico', 'Subsidiado', null, 1),
(3, 1, 1, 1, '2025-09-05 11:30:00', 30, 'Telemedicina', 'Pendiente', 'Seguimiento post-consulta', 'Subsidiado', null, 1),
(3, 4, 11, 3, '2025-08-20 10:00:00', 60, 'Presencial', 'Completada', 'Consulta nutricional', 'Subsidiado', 'Plan nutricional establecido', 1),

-- Citas para Paciente Prueba Backend (paciente ID 11)
(11, 1, 1, 1, '2025-08-24 14:00:00', 30, 'Presencial', 'Confirmada', 'Primera consulta', 'Particular', null, 1),
(11, 2, 7, 1, '2025-09-08 16:30:00', 60, 'Presencial', 'Pendiente', 'Evaluación psicológica', 'Particular', null, 1),

-- Citas pasadas (completadas y algunas canceladas)
(2, 1, 1, 1, '2025-08-10 09:00:00', 30, 'Presencial', 'Completada', 'Dolor abdominal', 'Contributivo', 'Paciente tratado satisfactoriamente', 1),
(1, 2, 3, 1, '2025-08-12 15:00:00', 45, 'Presencial', 'Completada', 'Control de presión arterial', 'Subsidiado', 'Presión controlada, continuar medicación', 1),
(4, 4, 6, 3, '2025-08-14 10:30:00', 30, 'Presencial', 'Cancelada', 'Ecografía abdominal', 'Contributivo', 'Cancelada por el paciente', 1),
(3, 1, 1, 1, '2025-08-16 11:00:00', 30, 'Presencial', 'Completada', 'Cefalea persistente', 'Subsidiado', 'Tratamiento analgésico prescrito', 1),

-- Más citas futuras
(2, 4, 9, 3, '2025-09-20 08:00:00', 45, 'Presencial', 'Pendiente', 'Medicina interna', 'Contributivo', null, 1),
(1, 1, 1, 1, '2025-09-25 13:30:00', 30, 'Telemedicina', 'Pendiente', 'Seguimiento telefónico', 'Subsidiado', null, 1),
(4, 2, 10, 1, '2025-09-18 09:30:00', 30, 'Presencial', 'Confirmada', 'Control dermatológico', 'Contributivo', null, 1),
(3, 4, 11, 3, '2025-09-22 14:00:00', 60, 'Presencial', 'Confirmada', 'Seguimiento nutricional', 'Subsidiado', null, 1),
(11, 1, 1, 1, '2025-09-30 16:00:00', 30, 'Presencial', 'Pendiente', 'Control general', 'Particular', null, 1);

-- Confirmar transacción
COMMIT;

-- Mostrar estadísticas
SELECT 'ESTADÍSTICAS DE CITAS GENERADAS' as resultado;

SELECT 
    status as 'Estado',
    COUNT(*) as 'Cantidad',
    ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM appointments)), 2) as 'Porcentaje %'
FROM appointments 
GROUP BY status 
ORDER BY COUNT(*) DESC;

SELECT 'CITAS POR ESPECIALIDAD' as resultado;

SELECT 
    s.name as 'Especialidad',
    COUNT(a.id) as 'Total Citas'
FROM appointments a
JOIN specialties s ON a.specialty_id = s.id
GROUP BY s.id, s.name
ORDER BY COUNT(a.id) DESC;

SELECT 'PRÓXIMAS 5 CITAS' as resultado;

SELECT 
    DATE_FORMAT(a.scheduled_at, '%d/%m/%Y %H:%i') as 'Fecha/Hora',
    p.name as 'Paciente',
    d.name as 'Doctor',
    s.name as 'Especialidad',
    l.name as 'Ubicación',
    a.status as 'Estado'
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN doctors d ON a.doctor_id = d.id
JOIN specialties s ON a.specialty_id = s.id
JOIN locations l ON a.location_id = l.id
WHERE a.scheduled_at >= NOW()
ORDER BY a.scheduled_at ASC
LIMIT 5;

SELECT CONCAT('Total de citas creadas: ', COUNT(*)) as 'Resumen'
FROM appointments;
