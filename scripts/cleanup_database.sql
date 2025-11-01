-- ============================================================
-- SCRIPT DE LIMPIEZA DE BASE DE DATOS - BIOSANARCALL
-- Fecha: 2025-10-29
-- Backup creado: biosanar_backup_20251029_014240.sql
-- Total tablas a eliminar: 35
-- ============================================================

USE biosanar;

-- ============================================================
-- PASO 1: ELIMINAR VISTAS SIN USO (3 vistas)
-- ============================================================

DROP VIEW IF EXISTS call_stats_view;
DROP VIEW IF EXISTS patient_summary;
DROP VIEW IF EXISTS waiting_list_with_details;
DROP VIEW IF EXISTS active_pregnancies;
DROP VIEW IF EXISTS appointment_daily_stats;
DROP VIEW IF EXISTS doctor_dashboard_stats;
DROP VIEW IF EXISTS elevenlabs_recent_calls;
DROP VIEW IF EXISTS patient_stats_by_specialty;
DROP VIEW IF EXISTS v_eps_authorizations;

-- ============================================================
-- PASO 2: ELIMINAR FOREIGN KEYS PROBLEMÁTICAS
-- ============================================================

-- Foreign keys de prescription_medications
ALTER TABLE prescription_medications DROP FOREIGN KEY IF EXISTS fk_pm_medication;
ALTER TABLE prescription_medications DROP FOREIGN KEY IF EXISTS fk_pm_prescription;

-- Foreign keys de call_logs
ALTER TABLE call_logs DROP FOREIGN KEY IF EXISTS fk_call_queue;

-- Foreign keys de medical_record_diagnoses
ALTER TABLE medical_record_diagnoses DROP FOREIGN KEY IF EXISTS fk_mrd_diagnosis;

-- Foreign keys de lab_order_tests
ALTER TABLE lab_order_tests DROP FOREIGN KEY IF EXISTS fk_lot_order;
ALTER TABLE lab_order_tests DROP FOREIGN KEY IF EXISTS fk_lot_test;

-- Foreign keys de treatment_tasks
ALTER TABLE treatment_tasks DROP FOREIGN KEY IF EXISTS fk_tt_plan;

-- Foreign keys de lab_results
ALTER TABLE lab_results DROP FOREIGN KEY IF EXISTS fk_lr_order_test;

-- ============================================================
-- PASO 3: ELIMINAR TABLAS DEPENDIENTES PRIMERO
-- ============================================================

-- Tablas que dependen de otras
DROP TABLE IF EXISTS prescription_medications;
DROP TABLE IF EXISTS medical_record_diagnoses;
DROP TABLE IF EXISTS medical_record_attachments;
DROP TABLE IF EXISTS lab_results;
DROP TABLE IF EXISTS lab_order_tests;
DROP TABLE IF EXISTS treatment_tasks;

-- ============================================================
-- PASO 4: FUNCIONALIDADES NO IMPLEMENTADAS (8 tablas)
-- ============================================================

DROP TABLE IF EXISTS agenda_optimization_metrics;
DROP TABLE IF EXISTS agenda_suggestions;
DROP TABLE IF EXISTS demand_patterns;
DROP TABLE IF EXISTS treatment_plans;
DROP TABLE IF EXISTS waiting_queue;

-- ============================================================
-- PASO 5: SISTEMA DE LABORATORIO NO IMPLEMENTADO (4 tablas)
-- ============================================================

DROP TABLE IF EXISTS lab_orders;
DROP TABLE IF EXISTS lab_tests;

-- ============================================================
-- PASO 6: SISTEMA MÉDICO NO IMPLEMENTADO (7 tablas)
-- ============================================================

DROP TABLE IF EXISTS conversation_memory;
DROP TABLE IF EXISTS medical_diagnoses;
DROP TABLE IF EXISTS medications;
DROP TABLE IF EXISTS prescriptions;

-- ============================================================
-- PASO 7: ELEVENLABS NO IMPLEMENTADOS (3 tablas)
-- ============================================================

DROP TABLE IF EXISTS elevenlabs_analysis;
DROP TABLE IF EXISTS elevenlabs_transcriptions;

-- ============================================================
-- PASO 8: DUPLICADOS Y SIN USO (7 tablas)
-- ============================================================

DROP TABLE IF EXISTS cups_services;
DROP TABLE IF EXISTS feriados;
DROP TABLE IF EXISTS patients_cp;
DROP TABLE IF EXISTS voice_calls;
DROP TABLE IF EXISTS migration_log;
DROP TABLE IF EXISTS agent_call_stats;

-- ============================================================
-- PASO 9: OTROS (3 tablas)
-- ============================================================

DROP TABLE IF EXISTS daily_assignment_config;
DROP TABLE IF EXISTS eps_agreements;

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

SELECT 'LIMPIEZA COMPLETADA' AS status;
SELECT COUNT(*) AS total_tablas_restantes FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'biosanar' AND TABLE_TYPE = 'BASE TABLE';

-- ============================================================
-- PARA RESTAURAR EN CASO DE ERROR:
-- mysql -h 127.0.0.1 -u biosanar_user -p biosanar < /home/ubuntu/app/backups/biosanar_backup_20251029_014240.sql
-- ============================================================
