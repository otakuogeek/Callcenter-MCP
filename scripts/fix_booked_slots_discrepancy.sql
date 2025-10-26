-- ============================================================================
-- Script de Corrección: Sincronizar booked_slots con la realidad
-- ============================================================================
-- Fecha: Octubre 20, 2025
-- Propósito: Corregir discrepancias entre booked_slots y cantidad real de citas
-- Autor: Sistema Biosanarcall
-- ============================================================================

-- PASO 1: Verificar el estado actual (solo lectura)
-- ============================================================================
SELECT 
  '=== ANÁLISIS DE DISCREPANCIAS ===' as info;

SELECT 
  a.id as availability_id,
  DATE_FORMAT(a.date, '%W, %d de %M de %Y') as fecha,
  d.name as doctor,
  s.name as especialidad,
  l.name as sede,
  a.capacity as capacidad_total,
  a.booked_slots as cupos_bd,
  COUNT(ap.id) as cupos_reales,
  (COUNT(ap.id) - a.booked_slots) as diferencia,
  CASE 
    WHEN COUNT(ap.id) > a.booked_slots THEN '⚠️ BD subestima'
    WHEN COUNT(ap.id) < a.booked_slots THEN '⚠️ BD sobreestima'
    ELSE '✅ Correcto'
  END as estado
FROM availabilities a
LEFT JOIN appointments ap ON ap.availability_id = a.id 
  AND ap.status = 'Confirmada'
JOIN doctors d ON d.id = a.doctor_id
JOIN specialties s ON s.id = a.specialty_id
JOIN locations l ON l.id = a.location_id
WHERE a.status = 'Activa'
  AND a.date >= CURDATE()  -- Solo agendas futuras o de hoy
GROUP BY a.id, a.date, d.name, s.name, l.name, a.capacity, a.booked_slots
HAVING diferencia != 0
ORDER BY ABS(diferencia) DESC, a.date ASC;

-- Resumen de discrepancias
SELECT 
  '=== RESUMEN ESTADÍSTICO ===' as info;

SELECT 
  COUNT(*) as total_agendas_con_discrepancia,
  SUM(CASE WHEN diferencia > 0 THEN 1 ELSE 0 END) as bd_subestima,
  SUM(CASE WHEN diferencia < 0 THEN 1 ELSE 0 END) as bd_sobreestima,
  AVG(ABS(diferencia)) as diferencia_promedio,
  MAX(ABS(diferencia)) as diferencia_maxima,
  MIN(diferencia) as diferencia_minima,
  MAX(diferencia) as diferencia_maxima_positiva
FROM (
  SELECT 
    a.id,
    (COUNT(ap.id) - a.booked_slots) as diferencia
  FROM availabilities a
  LEFT JOIN appointments ap ON ap.availability_id = a.id 
    AND ap.status = 'Confirmada'
  WHERE a.status = 'Activa'
    AND a.date >= CURDATE()
  GROUP BY a.id, a.booked_slots
  HAVING diferencia != 0
) as discrepancias;

-- ============================================================================
-- PASO 2: BACKUP de seguridad (IMPORTANTE - EJECUTAR ANTES DE CORRECCIÓN)
-- ============================================================================

-- Crear tabla de respaldo
DROP TABLE IF EXISTS availabilities_backup_booked_slots;
CREATE TABLE availabilities_backup_booked_slots AS
SELECT 
  id,
  booked_slots as booked_slots_antes,
  NOW() as backup_fecha
FROM availabilities
WHERE status = 'Activa';

SELECT 
  CONCAT('✅ Backup creado: ', COUNT(*), ' registros respaldados') as resultado
FROM availabilities_backup_booked_slots;

-- ============================================================================
-- PASO 3: CORRECCIÓN - Actualizar booked_slots
-- ============================================================================

-- ADVERTENCIA: Este UPDATE modificará la base de datos
-- Ejecutar solo después de revisar los resultados del PASO 1

UPDATE availabilities a
SET booked_slots = (
  SELECT COUNT(*)
  FROM appointments ap
  WHERE ap.availability_id = a.id
    AND ap.status = 'Confirmada'
)
WHERE a.status = 'Activa'
  AND a.date >= CURDATE();

-- Verificar cuántos registros se actualizaron
SELECT ROW_COUNT() as registros_actualizados;

-- ============================================================================
-- PASO 4: VERIFICACIÓN Post-Corrección
-- ============================================================================

SELECT 
  '=== VERIFICACIÓN POST-CORRECCIÓN ===' as info;

-- Verificar que ya no hay discrepancias
SELECT 
  a.id as availability_id,
  DATE_FORMAT(a.date, '%W, %d de %M de %Y') as fecha,
  d.name as doctor,
  a.booked_slots as cupos_bd,
  COUNT(ap.id) as cupos_reales,
  (COUNT(ap.id) - a.booked_slots) as diferencia,
  CASE 
    WHEN COUNT(ap.id) = a.booked_slots THEN '✅ Correcto'
    ELSE '❌ Aún hay discrepancia'
  END as estado
FROM availabilities a
LEFT JOIN appointments ap ON ap.availability_id = a.id 
  AND ap.status = 'Confirmada'
JOIN doctors d ON d.id = a.doctor_id
WHERE a.status = 'Activa'
  AND a.date >= CURDATE()
GROUP BY a.id, a.date, d.name, a.booked_slots
HAVING diferencia != 0;

-- Si no retorna filas, ¡todo está correcto! ✅

-- ============================================================================
-- PASO 5: Comparación ANTES vs DESPUÉS
-- ============================================================================

SELECT 
  '=== COMPARACIÓN: ANTES vs DESPUÉS ===' as info;

SELECT 
  a.id as availability_id,
  DATE_FORMAT(a.date, '%d/%m/%Y') as fecha,
  d.name as doctor,
  b.booked_slots_antes as antes,
  a.booked_slots as despues,
  (a.booked_slots - b.booked_slots_antes) as cambio,
  CASE 
    WHEN a.booked_slots > b.booked_slots_antes THEN '📈 Incrementó'
    WHEN a.booked_slots < b.booked_slots_antes THEN '📉 Decrementó'
    ELSE '➡️ Sin cambio'
  END as tendencia
FROM availabilities a
JOIN availabilities_backup_booked_slots b ON b.id = a.id
JOIN doctors d ON d.id = a.doctor_id
WHERE a.booked_slots != b.booked_slots_antes
ORDER BY ABS(a.booked_slots - b.booked_slots_antes) DESC;

-- ============================================================================
-- PASO 6: TRIGGERS para Prevenir Futuras Discrepancias
-- ============================================================================

-- Eliminar triggers si ya existen
DROP TRIGGER IF EXISTS update_booked_slots_after_insert;
DROP TRIGGER IF EXISTS update_booked_slots_after_update;
DROP TRIGGER IF EXISTS update_booked_slots_after_delete;

DELIMITER $$

-- Trigger 1: Cuando se INSERTA una nueva cita
CREATE TRIGGER update_booked_slots_after_insert
AFTER INSERT ON appointments
FOR EACH ROW
BEGIN
  IF NEW.status = 'Confirmada' AND NEW.availability_id IS NOT NULL THEN
    UPDATE availabilities 
    SET booked_slots = booked_slots + 1
    WHERE id = NEW.availability_id;
  END IF;
END$$

-- Trigger 2: Cuando se ACTUALIZA una cita
CREATE TRIGGER update_booked_slots_after_update
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
  -- Si cambió de NO confirmada a Confirmada
  IF OLD.status != 'Confirmada' AND NEW.status = 'Confirmada' AND NEW.availability_id IS NOT NULL THEN
    UPDATE availabilities 
    SET booked_slots = booked_slots + 1
    WHERE id = NEW.availability_id;
    
  -- Si cambió de Confirmada a NO confirmada
  ELSEIF OLD.status = 'Confirmada' AND NEW.status != 'Confirmada' AND OLD.availability_id IS NOT NULL THEN
    UPDATE availabilities 
    SET booked_slots = GREATEST(0, booked_slots - 1)
    WHERE id = OLD.availability_id;
    
  -- Si cambió de una agenda a otra (manteniendo estado Confirmada)
  ELSEIF OLD.status = 'Confirmada' AND NEW.status = 'Confirmada' 
         AND OLD.availability_id IS NOT NULL 
         AND NEW.availability_id IS NOT NULL
         AND OLD.availability_id != NEW.availability_id THEN
    -- Decrementar en la agenda antigua
    UPDATE availabilities 
    SET booked_slots = GREATEST(0, booked_slots - 1)
    WHERE id = OLD.availability_id;
    -- Incrementar en la agenda nueva
    UPDATE availabilities 
    SET booked_slots = booked_slots + 1
    WHERE id = NEW.availability_id;
  END IF;
END$$

-- Trigger 3: Cuando se ELIMINA una cita
CREATE TRIGGER update_booked_slots_after_delete
AFTER DELETE ON appointments
FOR EACH ROW
BEGIN
  IF OLD.status = 'Confirmada' AND OLD.availability_id IS NOT NULL THEN
    UPDATE availabilities 
    SET booked_slots = GREATEST(0, booked_slots - 1)
    WHERE id = OLD.availability_id;
  END IF;
END$$

DELIMITER ;

-- Verificar que los triggers se crearon
SHOW TRIGGERS WHERE `Table` = 'appointments';

SELECT 
  CONCAT('✅ Triggers creados exitosamente: ', COUNT(*), ' triggers activos') as resultado
FROM information_schema.TRIGGERS 
WHERE EVENT_OBJECT_TABLE = 'appointments'
  AND TRIGGER_SCHEMA = DATABASE();

-- ============================================================================
-- PASO 7: Estadísticas Finales
-- ============================================================================

SELECT 
  '=== ESTADÍSTICAS FINALES ===' as info;

SELECT 
  COUNT(*) as total_agendas_activas,
  SUM(booked_slots) as total_cupos_ocupados,
  SUM(capacity) as total_capacidad,
  ROUND(SUM(booked_slots) / SUM(capacity) * 100, 2) as porcentaje_ocupacion_general,
  SUM(capacity - booked_slots) as total_cupos_disponibles
FROM availabilities
WHERE status = 'Activa'
  AND date >= CURDATE();

-- Por especialidad
SELECT 
  s.name as especialidad,
  COUNT(a.id) as agendas_activas,
  SUM(a.booked_slots) as cupos_ocupados,
  SUM(a.capacity) as capacidad_total,
  ROUND(SUM(a.booked_slots) / SUM(a.capacity) * 100, 2) as ocupacion_pct
FROM availabilities a
JOIN specialties s ON s.id = a.specialty_id
WHERE a.status = 'Activa'
  AND a.date >= CURDATE()
GROUP BY s.name
ORDER BY ocupacion_pct DESC;

-- ============================================================================
-- PASO 8: Limpieza (Opcional - ejecutar después de validar todo)
-- ============================================================================

-- Mantener el backup por 30 días, luego eliminar
-- DROP TABLE IF EXISTS availabilities_backup_booked_slots;

-- ============================================================================
-- INSTRUCCIONES DE USO:
-- ============================================================================
-- 
-- 1. ANÁLISIS (Solo lectura):
--    - Ejecutar PASO 1 para ver discrepancias actuales
--    
-- 2. BACKUP (IMPORTANTE):
--    - Ejecutar PASO 2 para crear respaldo de seguridad
--    
-- 3. CORRECCIÓN:
--    - Ejecutar PASO 3 para actualizar booked_slots
--    
-- 4. VERIFICACIÓN:
--    - Ejecutar PASO 4 para validar que se corrigió
--    - Ejecutar PASO 5 para ver cambios realizados
--    
-- 5. PREVENCIÓN:
--    - Ejecutar PASO 6 para crear triggers automáticos
--    
-- 6. ESTADÍSTICAS:
--    - Ejecutar PASO 7 para ver estado final
--
-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 
-- ⚠️ ANTES de ejecutar PASO 3 (UPDATE), asegúrate de:
--    1. Tener un backup de la base de datos completa
--    2. Ejecutar en horario de bajo tráfico
--    3. Informar al equipo técnico
--    4. Tener plan de rollback si algo sale mal
--
-- ✅ El PASO 6 (triggers) es ALTAMENTE RECOMENDADO para evitar
--    futuras discrepancias automáticamente
--
-- 💡 El backup del PASO 2 te permite revertir los cambios si es necesario:
--    UPDATE availabilities a
--    JOIN availabilities_backup_booked_slots b ON b.id = a.id
--    SET a.booked_slots = b.booked_slots_antes;
--
-- ============================================================================

SELECT 
  '✅ Script completado. Revisa los resultados cuidadosamente.' as mensaje_final;
