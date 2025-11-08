# Análisis de Tablas de Base de Datos - Biosanarcall

**Fecha:** 2025
**Total de tablas:** 92 (aplicación) + 24 (phpMyAdmin) = 116

## Resumen Ejecutivo

**Tablas en USO ACTIVO:** 45
**Tablas con USO MÍNIMO (<5 referencias):** 28  
**Tablas SIN USO (0 referencias):** 19
**Total candidatas a ELIMINAR:** 47

---

## 📊 TABLAS EN USO ACTIVO (>10 referencias)

### Críticas del Sistema (>50 referencias)
- ✅ **patients** (146 refs) - Pacientes
- ✅ **availabilities** (122 refs) - Agendas disponibles
- ✅ **appointments** (116 refs) - Citas agendadas
- ✅ **doctors** (93 refs) - Médicos
- ✅ **specialties** (78 refs) - Especialidades médicas
- ✅ **locations** (60 refs) - Sedes

### Importantes (10-50 referencias)
- ✅ **calls** (36 refs) - Registro de llamadas
- ✅ **availability_distribution** (33 refs) - Distribución de agendas
- ✅ **municipalities** (30 refs) - Municipios
- ✅ **eps** (29 refs) - EPS
- ✅ **appointments_waiting_list** (23 refs) - Lista de espera
- ✅ **zones** (22 refs) - Zonas
- ✅ **cups** (22 refs) - Códigos CUPS
- ✅ **services** (18 refs) - Servicios médicos
- ✅ **queue_entries** (18 refs) - Cola de asignación
- ✅ **appointment_billing** (18 refs) - Facturación de citas
- ✅ **notifications** (17 refs) - Notificaciones
- ✅ **daily_assignment_queue** (16 refs) - Cola de asignación diaria
- ✅ **outbound_calls** (13 refs) - Llamadas salientes
- ✅ **users** (12 refs) - Usuarios del sistema
- ✅ **user_sessions** (11 refs) - Sesiones de usuarios
- ✅ **doctor_specialties** (11 refs) - Relación médico-especialidad
- ✅ **webhook_logs** (10 refs) - Logs de webhooks
- ✅ **outbound_campaigns** (10 refs) - Campañas de llamadas
- ✅ **location_types** (10 refs) - Tipos de ubicación
- ✅ **elevenlabs_conversations** (10 refs) - Conversaciones AI

---

## ⚠️ TABLAS CON USO MÍNIMO (1-9 referencias)

### Posiblemente útiles (5-9 refs)
- ⚠️ **blood_groups** (9 refs) - Tipos de sangre
- ⚠️ **patient_documents** (8 refs) - Documentos de pacientes
- ⚠️ **medical_records** (8 refs) - Historias clínicas
- ⚠️ **eps_specialty_location_authorizations** (8 refs) - Autorizaciones EPS
- ⚠️ **doctor_service_prices** (8 refs) - Precios de servicios
- ⚠️ **agenda_templates** (8 refs) - Plantillas de agenda
- ⚠️ **pregnancies** (7 refs) - Embarazos
- ⚠️ **population_groups** (7 refs) - Grupos poblacionales
- ⚠️ **marital_statuses** (7 refs) - Estados civiles
- ⚠️ **holidays** (7 refs) - Días festivos
- ⚠️ **education_levels** (7 refs) - Niveles educativos
- ⚠️ **doctor_locations** (7 refs) - Relación médico-sede
- ⚠️ **call_events** (7 refs) - Eventos de llamadas
- ⚠️ **document_types** (6 refs) - Tipos de documento
- ⚠️ **doctor_sessions** (6 refs) - Sesiones de médicos
- ⚠️ **daily_metrics** (6 refs) - Métricas diarias
- ⚠️ **call_statuses** (6 refs) - Estados de llamadas
- ⚠️ **webhook_config** (5 refs) - Configuración webhooks
- ⚠️ **system_settings** (5 refs) - Configuración del sistema
- ⚠️ **location_specialties** (5 refs) - Especialidades por sede
- ⚠️ **disability_types** (5 refs) - Tipos de discapacidad
- ⚠️ **ai_transfers** (5 refs) - Transferencias AI

### Casi sin uso (1-4 refs) - **CANDIDATAS A ELIMINAR**
- 🔴 **v_eps_authorizations** (4 refs) - Vista de autorizaciones
- 🔴 **doctor_login_audit** (4 refs) - Auditoría login médicos
- 🔴 **call_logs** (4 refs) - Logs de llamadas (duplicado con `calls`?)
- 🔴 **scheduling_preallocation** (3 refs) - Pre-asignación de citas
- 🔴 **prenatal_controls** (3 refs) - Controles prenatales
- 🔴 **conflict_resolutions** (3 refs) - Resolución de conflictos
- 🔴 **billing_audit_logs** (3 refs) - Auditoría de facturación
- 🔴 **audit_log** (3 refs) - Auditoría general
- 🔴 **timezones** (2 refs) - Zonas horarias
- 🔴 **notification_preferences** (2 refs) - Preferencias de notificaciones
- 🔴 **elevenlabs_audio** (2 refs) - Audios ElevenLabs
- 🔴 **call_notifications** (2 refs) - Notificaciones de llamadas
- 🔴 **availability_pause_log** (2 refs) - Log de pausas en agendas
- 🔴 **appointment_notifications** (2 refs) - Notificaciones de citas
- 🔴 **scheduling_preallocation_assignments** (1 ref) - Asignaciones pre-asignación
- 🔴 **patient_medications** (1 ref) - Medicamentos de pacientes
- 🔴 **patient_medical_history** (1 ref) - Historial médico pacientes
- 🔴 **patient_allergies** (1 ref) - Alergias de pacientes
- 🔴 **insurance_coverage** (1 ref) - Cobertura de seguros
- 🔴 **eps_authorization_audit** (1 ref) - Auditoría autorizaciones EPS
- 🔴 **elevenlabs_call_errors** (1 ref) - Errores de llamadas ElevenLabs
- 🔴 **calls_archive** (1 ref) - Archivo de llamadas
- 🔴 **activity_logs** (1 ref) - Logs de actividad
- 🔴 **active_pregnancies** (1 ref) - Embarazos activos

---

## 🗑️ TABLAS SIN USO (0 referencias) - **ELIMINAR**

### Funcionalidades no implementadas
- ❌ **agenda_optimization_metrics** - Métricas optimización agenda
- ❌ **agenda_suggestions** - Sugerencias de agenda
- ❌ **demand_patterns** - Patrones de demanda
- ❌ **doctor_dashboard_stats** - Estadísticas dashboard médicos
- ❌ **patient_stats_by_specialty** - Estadísticas pacientes por especialidad
- ❌ **treatment_plans** - Planes de tratamiento
- ❌ **treatment_tasks** - Tareas de tratamiento
- ❌ **waiting_queue** - Cola de espera (duplicado con `queue_entries`?)

### Sistemas de laboratorio (no implementados)
- ❌ **lab_orders** - Órdenes de laboratorio
- ❌ **lab_order_tests** - Tests de órdenes
- ❌ **lab_results** - Resultados de laboratorio
- ❌ **lab_tests** - Tests de laboratorio

### Otros sin uso
- ❌ **agent_call_stats** - Estadísticas de agente
- ❌ **appointment_daily_stats** - Estadísticas diarias de citas
- ❌ **conversation_memory** - Memoria de conversaciones
- ❌ **cups_services** - Servicios CUPS (duplicado?)
- ❌ **daily_assignment_config** - Configuración asignación diaria
- ❌ **elevenlabs_analysis** - Análisis ElevenLabs
- ❌ **elevenlabs_recent_calls** - Llamadas recientes ElevenLabs
- ❌ **elevenlabs_transcriptions** - Transcripciones ElevenLabs
- ❌ **eps_agreements** - Acuerdos EPS
- ❌ **feriados** - Festivos (duplicado con `holidays`?)
- ❌ **medical_diagnoses** - Diagnósticos médicos
- ❌ **medical_record_attachments** - Adjuntos de historias
- ❌ **medical_record_diagnoses** - Diagnósticos en historias
- ❌ **medications** - Catálogo de medicamentos
- ❌ **migration_log** - Log de migraciones
- ❌ **patients_cp** - Copia de pacientes (backup?)
- ❌ **prescription_medications** - Medicamentos en recetas
- ❌ **prescriptions** - Recetas médicas
- ❌ **voice_calls** - Llamadas de voz (duplicado con `calls`?)

### Vistas sin uso
- ❌ **call_stats_view** - Vista de estadísticas de llamadas
- ❌ **patient_summary** - Resumen de pacientes
- ❌ **waiting_list_with_details** - Lista de espera con detalles

---

## 📋 RECOMENDACIONES

### Acción Inmediata (Alta Prioridad)
**Eliminar 19 tablas SIN USO:**
```sql
-- Funcionalidades no implementadas (8 tablas)
DROP TABLE IF EXISTS agenda_optimization_metrics;
DROP TABLE IF EXISTS agenda_suggestions;
DROP TABLE IF EXISTS demand_patterns;
DROP TABLE IF EXISTS doctor_dashboard_stats;
DROP TABLE IF EXISTS patient_stats_by_specialty;
DROP TABLE IF EXISTS treatment_plans;
DROP TABLE IF EXISTS treatment_tasks;
DROP TABLE IF EXISTS waiting_queue;

-- Sistema laboratorio no implementado (4 tablas)
DROP TABLE IF EXISTS lab_orders;
DROP TABLE IF EXISTS lab_order_tests;
DROP TABLE IF EXISTS lab_results;
DROP TABLE IF EXISTS lab_tests;

-- Duplicados y sin uso (7 tablas)
DROP TABLE IF EXISTS cups_services;
DROP TABLE IF EXISTS feriados;
DROP TABLE IF EXISTS patients_cp;
DROP TABLE IF EXISTS voice_calls;
DROP TABLE IF EXISTS migration_log;
DROP TABLE IF EXISTS agent_call_stats;
DROP TABLE IF EXISTS appointment_daily_stats;

-- Vistas sin uso (3 vistas)
DROP VIEW IF EXISTS call_stats_view;
DROP VIEW IF EXISTS patient_summary;
DROP VIEW IF EXISTS waiting_list_with_details;

-- ElevenLabs no implementados (3 tablas)
DROP TABLE IF EXISTS elevenlabs_analysis;
DROP TABLE IF EXISTS elevenlabs_recent_calls;
DROP TABLE IF EXISTS elevenlabs_transcriptions;

-- Sistema médico no implementado (7 tablas)
DROP TABLE IF EXISTS conversation_memory;
DROP TABLE IF EXISTS medical_diagnoses;
DROP TABLE IF EXISTS medical_record_attachments;
DROP TABLE IF EXISTS medical_record_diagnoses;
DROP TABLE IF EXISTS medications;
DROP TABLE IF EXISTS prescription_medications;
DROP TABLE IF EXISTS prescriptions;

-- Otros (3 tablas)
DROP TABLE IF EXISTS daily_assignment_config;
DROP TABLE IF EXISTS eps_agreements;
```

**Total a eliminar: 35 tablas**

### Acción Recomendada (Media Prioridad)
**Consolidar o eliminar tablas con 1-4 referencias:**

- Evaluar si `call_logs` puede consolidarse con `calls`
- Decidir si mantener auditorías con pocas referencias
- Revisar si tablas de pre-asignación son necesarias

**Total candidatas: 24 tablas**

### Mantener (Baja Prioridad)
**Tablas con 5+ referencias:**
- Mantener todas las tablas con 5 o más referencias
- Son parte activa del sistema

---

## ⚠️ ANTES DE ELIMINAR

### 1. Hacer backup completo
```bash
mysqldump -h 127.0.0.1 -u biosanar_user -p'/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU' biosanar > /home/ubuntu/app/backups/biosanar_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verificar vistas dependientes
```sql
SELECT TABLE_NAME, VIEW_DEFINITION 
FROM information_schema.VIEWS 
WHERE TABLE_SCHEMA = 'biosanar';
```

### 3. Verificar triggers
```sql
SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, ACTION_STATEMENT
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'biosanar';
```

### 4. Verificar foreign keys
```sql
SELECT 
  TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'biosanar' 
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

---

## 📊 IMPACTO ESTIMADO

- **Espacio liberado:** ~40-60% del tamaño actual de BD
- **Tablas a eliminar:** 35 tablas (38% del total)
- **Riesgo:** BAJO (todas tienen 0 referencias en código)
- **Tiempo estimado:** 5-10 minutos
- **Reversibilidad:** Alta (con backup)

---

## ✅ SIGUIENTE PASO

**Propuesta:**
1. ✅ Hacer backup completo
2. ✅ Verificar dependencias (vistas, triggers, FKs)
3. ✅ Ejecutar DROP de 35 tablas sin uso
4. ✅ Probar sistema completo
5. ⏸️ Evaluar tablas con 1-4 referencias en fase 2

**¿Proceder con la eliminación?**
