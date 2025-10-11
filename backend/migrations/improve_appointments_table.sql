-- Migración para mejorar la tabla appointments
-- Fecha: 2025-09-30
-- Descripción: Ajustar tabla appointments para soportar todos los campos de los formularios

USE biosanar;

-- 1. Ampliar el campo reason para motivos de consulta más detallados
ALTER TABLE appointments 
MODIFY COLUMN reason TEXT;

-- 2. Ampliar el campo insurance_type para incluir más opciones
ALTER TABLE appointments 
MODIFY COLUMN insurance_type VARCHAR(150);

-- 3. Agregar campos adicionales que se requieren en los formularios
ALTER TABLE appointments 
ADD COLUMN consultation_reason_detailed TEXT COMMENT 'Motivo detallado de la consulta',
ADD COLUMN additional_notes TEXT COMMENT 'Notas adicionales específicas',
ADD COLUMN priority_level ENUM('Baja', 'Normal', 'Alta', 'Urgente') DEFAULT 'Normal' COMMENT 'Nivel de prioridad de la cita',
ADD COLUMN insurance_company VARCHAR(100) COMMENT 'Compañía de seguros específica',
ADD COLUMN insurance_policy_number VARCHAR(50) COMMENT 'Número de póliza de seguro',
ADD COLUMN appointment_source ENUM('Manual', 'Sistema_Inteligente', 'Llamada', 'Web', 'App') DEFAULT 'Manual' COMMENT 'Origen de la cita',
ADD COLUMN reminder_sent TINYINT(1) DEFAULT 0 COMMENT 'Si se envió recordatorio',
ADD COLUMN reminder_sent_at TIMESTAMP NULL COMMENT 'Fecha cuando se envió el recordatorio',
ADD COLUMN preferred_time VARCHAR(50) COMMENT 'Horario preferido del paciente',
ADD COLUMN symptoms TEXT COMMENT 'Síntomas reportados por el paciente',
ADD COLUMN allergies TEXT COMMENT 'Alergias reportadas para esta cita',
ADD COLUMN medications TEXT COMMENT 'Medicamentos actuales del paciente',
ADD COLUMN emergency_contact_name VARCHAR(100) COMMENT 'Nombre contacto de emergencia',
ADD COLUMN emergency_contact_phone VARCHAR(30) COMMENT 'Teléfono contacto de emergencia',
ADD COLUMN follow_up_required TINYINT(1) DEFAULT 0 COMMENT 'Si requiere seguimiento',
ADD COLUMN follow_up_date DATE NULL COMMENT 'Fecha sugerida para seguimiento',
ADD COLUMN payment_method ENUM('Efectivo', 'Tarjeta', 'Transferencia', 'Seguro', 'Credito') COMMENT 'Método de pago',
ADD COLUMN copay_amount DECIMAL(10,2) COMMENT 'Monto de copago',
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización';

-- 4. Agregar índices para mejorar rendimiento
CREATE INDEX idx_appointments_priority ON appointments(priority_level);
CREATE INDEX idx_appointments_source ON appointments(appointment_source);
CREATE INDEX idx_appointments_reminder ON appointments(reminder_sent);
CREATE INDEX idx_appointments_updated_at ON appointments(updated_at);

-- 5. Agregar restricciones para validar datos
ALTER TABLE appointments 
ADD CONSTRAINT chk_copay_amount CHECK (copay_amount >= 0);

-- 6. Comentario en la tabla
ALTER TABLE appointments 
COMMENT = 'Tabla de citas médicas con campos extendidos para formularios completos';

-- 7. Ver la estructura final
DESCRIBE appointments;