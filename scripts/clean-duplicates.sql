-- ====================================================
-- SCRIPT PARA LIMPIAR REGISTROS DUPLICADOS
-- BIOSANARCALL 2025 - Limpieza de tablas de lookup
-- ====================================================

SET foreign_key_checks = 0;

-- ===== LIMPIAR TIPOS DE DISCAPACIDAD =====
-- Mantener solo un registro de cada tipo único
DELETE d1 FROM disability_types d1
INNER JOIN disability_types d2 
WHERE d1.id > d2.id AND d1.name = d2.name;

-- ===== LIMPIAR NIVELES DE EDUCACIÓN =====
DELETE e1 FROM education_levels e1
INNER JOIN education_levels e2 
WHERE e1.id > e2.id AND e1.name = e2.name;

-- ===== LIMPIAR GRUPOS POBLACIONALES =====
DELETE p1 FROM population_groups p1
INNER JOIN population_groups p2 
WHERE p1.id > p2.id AND p1.name = p2.name;

-- ===== LIMPIAR ESTADOS CIVILES =====
DELETE m1 FROM marital_statuses m1
INNER JOIN marital_statuses m2 
WHERE m1.id > m2.id AND m1.name = m2.name;

-- ===== LIMPIAR GRUPOS SANGUÍNEOS =====
DELETE b1 FROM blood_groups b1
INNER JOIN blood_groups b2 
WHERE b1.id > b2.id AND b1.code = b2.code AND b1.name = b2.name;

-- ===== LIMPIAR TIPOS DE DOCUMENTO =====
DELETE dt1 FROM document_types dt1
INNER JOIN document_types dt2 
WHERE dt1.id > dt2.id AND dt1.code = dt2.code AND dt1.name = dt2.name;

SET foreign_key_checks = 1;

-- ===== VERIFICAR RESULTADOS =====
SELECT 'disability_types' as tabla, COUNT(*) as total FROM disability_types
UNION ALL
SELECT 'education_levels' as tabla, COUNT(*) as total FROM education_levels
UNION ALL
SELECT 'population_groups' as tabla, COUNT(*) as total FROM population_groups
UNION ALL
SELECT 'marital_statuses' as tabla, COUNT(*) as total FROM marital_statuses
UNION ALL
SELECT 'blood_groups' as tabla, COUNT(*) as total FROM blood_groups
UNION ALL
SELECT 'document_types' as tabla, COUNT(*) as total FROM document_types;

-- ===== MOSTRAR DATOS FINALES =====
SELECT 'DISABILITY TYPES:' as info;
SELECT id, name FROM disability_types ORDER BY name;

SELECT 'EDUCATION LEVELS:' as info;
SELECT id, name FROM education_levels ORDER BY id;

SELECT 'POPULATION GROUPS:' as info;
SELECT id, name FROM population_groups ORDER BY id;
