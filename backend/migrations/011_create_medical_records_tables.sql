-- =====================================================
-- MIGRATION 011: Tablas de Historias Clínicas
-- Fecha: 2025-10-27
-- Descripción: Sistema completo de historias clínicas
-- =====================================================

-- Tabla principal de historias clínicas
CREATE TABLE IF NOT EXISTS medical_records (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    patient_id BIGINT UNSIGNED NOT NULL,
    doctor_id BIGINT UNSIGNED NOT NULL,
    appointment_id BIGINT UNSIGNED,
    visit_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    visit_type ENUM('Consulta General', 'Control', 'Urgencia', 'Primera Vez', 'Seguimiento') DEFAULT 'Consulta General',
    chief_complaint TEXT COMMENT 'Motivo de consulta',
    current_illness TEXT COMMENT 'Enfermedad actual',
    vital_signs JSON COMMENT 'Signos vitales',
    physical_examination JSON COMMENT 'Examen físico',
    diagnosis TEXT COMMENT 'Diagnóstico',
    treatment_plan TEXT COMMENT 'Plan de tratamiento',
    prescriptions TEXT COMMENT 'Prescripciones',
    observations TEXT COMMENT 'Observaciones adicionales',
    follow_up_date DATE COMMENT 'Fecha de próximo control',
    status ENUM('Borrador', 'Completa', 'Archivada') DEFAULT 'Borrador',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_doctor (doctor_id),
    INDEX idx_visit_date (visit_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Historias clínicas de pacientes';

-- Tabla de alergias del paciente
CREATE TABLE IF NOT EXISTS patient_allergies (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    patient_id BIGINT UNSIGNED NOT NULL,
    allergen VARCHAR(200) NOT NULL COMMENT 'Alérgeno',
    allergy_type ENUM('Medicamento', 'Alimento', 'Ambiental', 'Otro') DEFAULT 'Otro',
    severity ENUM('Leve', 'Moderada', 'Severa', 'Mortal') DEFAULT 'Leve',
    reaction TEXT COMMENT 'Reacción presentada',
    notes TEXT COMMENT 'Notas adicionales',
    recorded_by BIGINT UNSIGNED COMMENT 'Doctor que registró',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Registro de alergias de pacientes';

-- Tabla de antecedentes médicos
CREATE TABLE IF NOT EXISTS patient_medical_history (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    patient_id BIGINT UNSIGNED NOT NULL,
    history_type ENUM('Personal', 'Familiar', 'Quirúrgico', 'Traumático', 'Ginecológico', 'Obstétrico') NOT NULL,
    condition_name VARCHAR(200) NOT NULL COMMENT 'Condición o enfermedad',
    diagnosis_date DATE COMMENT 'Fecha de diagnóstico',
    description TEXT COMMENT 'Descripción detallada',
    treatment TEXT COMMENT 'Tratamiento recibido',
    current_status ENUM('Activo', 'Controlado', 'Curado', 'Inactivo') DEFAULT 'Activo',
    recorded_by BIGINT UNSIGNED COMMENT 'Doctor que registró',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_type (history_type),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Antecedentes médicos de pacientes';

-- Tabla de medicamentos actuales
CREATE TABLE IF NOT EXISTS patient_medications (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    patient_id BIGINT UNSIGNED NOT NULL,
    medication_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(100) COMMENT 'Dosis',
    frequency VARCHAR(100) COMMENT 'Frecuencia',
    route VARCHAR(50) COMMENT 'Vía de administración',
    start_date DATE COMMENT 'Fecha de inicio',
    end_date DATE COMMENT 'Fecha de fin',
    reason TEXT COMMENT 'Motivo de prescripción',
    prescribed_by BIGINT UNSIGNED COMMENT 'Doctor que prescribió',
    status ENUM('Activo', 'Suspendido', 'Completado') DEFAULT 'Activo',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (prescribed_by) REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_patient (patient_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Medicamentos actuales de pacientes';

-- Tabla de archivos adjuntos (imágenes, laboratorios, etc)
CREATE TABLE IF NOT EXISTS medical_record_attachments (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    medical_record_id BIGINT UNSIGNED NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) COMMENT 'Tipo de archivo',
    file_size INT COMMENT 'Tamaño en bytes',
    category ENUM('Laboratorio', 'Imagen', 'Documento', 'Receta', 'Otro') DEFAULT 'Otro',
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
    INDEX idx_record (medical_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Archivos adjuntos a historias clínicas';

-- Vista resumen de paciente (información consolidada)
CREATE OR REPLACE VIEW patient_summary AS
SELECT 
    p.id,
    p.name,
    p.document,
    p.phone,
    p.email,
    p.birth_date,
    p.gender,
    p.blood_group_id,
    p.address,
    TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
    (SELECT COUNT(*) FROM medical_records mr WHERE mr.patient_id = p.id) as total_visits,
    (SELECT MAX(mr.visit_date) FROM medical_records mr WHERE mr.patient_id = p.id) as last_visit,
    (SELECT COUNT(*) FROM patient_allergies pa WHERE pa.patient_id = p.id AND pa.active = TRUE) as active_allergies,
    (SELECT COUNT(*) FROM patient_medications pm WHERE pm.patient_id = p.id AND pm.status = 'Activo') as active_medications
FROM patients p;

COMMIT;
