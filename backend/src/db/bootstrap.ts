import pool from './pool';

// Simple logger para bootstrap (evita dependencia circular con pino)
const logger = {
  info: (msg: string, extra?: any) => console.log(`[BOOTSTRAP] ${msg}`, extra || ''),
  warn: (msg: string, extra?: any) => console.warn(`[BOOTSTRAP] ${msg}`, extra || ''),
  error: (msg: string, extra?: any) => console.error(`[BOOTSTRAP] ${msg}`, extra || ''),
};

async function ensureRow(): Promise<void> {
  await pool.query("INSERT INTO system_settings (id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE id = 1)");
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [table, column]
  );
  return (rows as any[]).length > 0;
}

async function ensureSystemSettingsColumns(): Promise<void> {
  const cols: Array<{ name: string; ddl: string }> = [
    { name: 'org_nit', ddl: 'ALTER TABLE system_settings ADD COLUMN `org_nit` varchar(30) NULL' },
    { name: 'org_logo_url', ddl: 'ALTER TABLE system_settings ADD COLUMN `org_logo_url` varchar(255) NULL' },
    { name: 'org_timezone', ddl: "ALTER TABLE system_settings ADD COLUMN `org_timezone` varchar(64) NOT NULL DEFAULT 'America/Bogota'" },
  ];
  
  for (const c of cols) {
    try {
      const exists = await columnExists('system_settings', c.name);
      if (!exists) {
        await pool.query(c.ddl);
        logger.info(`Added column ${c.name} to system_settings`);
      }
    } catch (error: any) {
      // Log específico para errores de permisos vs errores estructurales
      if (error.code === 'ER_TABLEACCESS_DENIED_ERROR' || error.code === 'ER_ACCESS_DENIED_ERROR') {
        logger.warn(`Insufficient privileges to add column ${c.name}, skipping`);
      } else {
        logger.error(`Failed to add column ${c.name}:`, error.message);
      }
    }
  }
}

async function ensureTimezones(): Promise<void> {
  try {
    await pool.query(
      "CREATE TABLE IF NOT EXISTS `timezones` (\n  `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT,\n  `name` varchar(64) NOT NULL,\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `uk_timezone_name` (`name`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"
    );
    const tzs = [
      'UTC',
      'America/Bogota', 'America/Lima', 'America/Guayaquil', 'America/Caracas',
      'America/Mexico_City', 'America/Panama', 'America/Santo_Domingo',
      'America/La_Paz', 'America/Santiago', 'America/Asuncion', 'America/Montevideo', 'America/Argentina/Buenos_Aires',
      'America/Chicago', 'America/New_York', 'America/Los_Angeles',
      'Atlantic/Cape_Verde', 'Atlantic/Azores',
      'Europe/London', 'Europe/Madrid', 'Europe/Berlin', 'Europe/Paris', 'Europe/Rome',
    ];
    const values = tzs.map(() => '(?)').join(',');
    await pool.query(`INSERT IGNORE INTO timezones (name) VALUES ${values}` as any, tzs as any);
  } catch {
    // ignore errors to avoid blocking startup
  }
}

// Mejoras específicas para la tabla de citas (appointments): índices, triggers y backfill.
async function ensureAppointmentImprovements(): Promise<void> {
  try {
    // Índices adicionales para patrones de consulta frecuentes
    try { await pool.query('ALTER TABLE appointments ADD KEY `idx_appt_status_date` (`status`,`scheduled_at`)'); } catch {}
    try { await pool.query('ALTER TABLE appointments ADD KEY `idx_appt_doctor_date` (`doctor_id`,`scheduled_at`)'); } catch {}
    try { await pool.query('ALTER TABLE appointments ADD KEY `idx_appt_patient_date` (`patient_id`,`scheduled_at`)'); } catch {}
    try { await pool.query('ALTER TABLE appointments ADD KEY `idx_appt_availability` (`availability_id`)'); } catch {}

    // Foreign Keys (best-effort) - ignorar si ya existen o faltan privilegios
    try { await pool.query("ALTER TABLE appointments ADD CONSTRAINT `fk_appt_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT"); } catch {}
    try { await pool.query("ALTER TABLE appointments ADD CONSTRAINT `fk_appt_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT"); } catch {}
    try { await pool.query("ALTER TABLE appointments ADD CONSTRAINT `fk_appt_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT"); } catch {}
    try { await pool.query("ALTER TABLE appointments ADD CONSTRAINT `fk_appt_location` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT"); } catch {}
    try { await pool.query("ALTER TABLE appointments ADD CONSTRAINT `fk_appt_availability` FOREIGN KEY (`availability_id`) REFERENCES `availabilities`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT"); } catch {}

    // Vista agregada diaria (consulta rápida de métricas por fecha / sede / especialidad)
    try {
      await pool.query(`CREATE OR REPLACE VIEW appointment_daily_stats AS
        SELECT 
          DATE(scheduled_at) AS date,
          location_id,
          specialty_id,
          COUNT(*) AS total_appointments,
          SUM(status = 'Completada') AS completed_appointments,
          SUM(status = 'Cancelada') AS cancelled_appointments,
          SUM(status = 'Pendiente') AS pending_appointments,
          ROUND(SUM(status = 'Completada') / NULLIF(COUNT(*),0) * 100, 2) AS completion_rate
        FROM appointments
        GROUP BY DATE(scheduled_at), location_id, specialty_id`);
    } catch { /* ignore */ }

    // Procedimiento para recalcular rapidísimo los cupos ocupados (best-effort)
    try {
      await pool.query(`CREATE PROCEDURE IF NOT EXISTS recalc_availability_slots(IN p_avail_id BIGINT)
      BEGIN
        UPDATE availabilities a
        SET a.booked_slots = (
          SELECT COUNT(*) FROM appointments ap
          WHERE ap.availability_id = a.id AND ap.status != 'Cancelada'
        ),
        a.status = CASE
          WHEN a.capacity IS NOT NULL AND a.capacity > 0 AND (
             SELECT COUNT(*) FROM appointments ap2
             WHERE ap2.availability_id = a.id AND ap2.status != 'Cancelada'
          ) >= a.capacity THEN 'Completa'
          ELSE a.status
        END
        WHERE a.id = p_avail_id;
      END`);
    } catch { /* ignore */ }

    // Trigger AFTER INSERT (recalcular slots de la disponibilidad)
    try {
      await pool.query('DROP TRIGGER IF EXISTS trg_appt_after_insert');
      await pool.query(`CREATE TRIGGER trg_appt_after_insert AFTER INSERT ON appointments
        FOR EACH ROW BEGIN
          IF NEW.availability_id IS NOT NULL THEN
            CALL recalc_availability_slots(NEW.availability_id);
          END IF;
        END`);
    } catch { /* ignore */ }

    // Trigger AFTER UPDATE (si cambia availability_id o status)
    try {
      await pool.query('DROP TRIGGER IF EXISTS trg_appt_after_update');
      await pool.query(`CREATE TRIGGER trg_appt_after_update AFTER UPDATE ON appointments
        FOR EACH ROW BEGIN
          IF (OLD.availability_id IS NOT NULL AND OLD.availability_id != NEW.availability_id) THEN
            CALL recalc_availability_slots(OLD.availability_id);
          END IF;
          IF (NEW.availability_id IS NOT NULL) THEN
            IF (OLD.status != NEW.status) OR (OLD.availability_id != NEW.availability_id) THEN
              CALL recalc_availability_slots(NEW.availability_id);
            END IF;
          END IF;
        END`);
    } catch { /* ignore */ }

    // Backfill: asociar citas sin availability_id buscando coincidencia de ventana horaria y doctor / especialidad / sede
    try {
      const [rows]: any = await pool.query(`SELECT id, doctor_id, specialty_id, location_id, scheduled_at, duration_minutes FROM appointments WHERE availability_id IS NULL LIMIT 500`);
      for (const r of (Array.isArray(rows) ? rows : [])) {
        try {
          const [cand]: any = await pool.query(`SELECT id, start_time, end_time FROM availabilities
            WHERE doctor_id = ? AND specialty_id = ? AND location_id = ? AND date = DATE(?)
              AND TIME(?) BETWEEN start_time AND end_time
            ORDER BY ABS(TIMESTAMPDIFF(MINUTE, CONCAT(date,' ',start_time), ?)) ASC
            LIMIT 1`, [r.doctor_id, r.specialty_id, r.location_id, r.scheduled_at, r.scheduled_at, r.scheduled_at]);
          if (Array.isArray(cand) && cand.length) {
            const availId = cand[0].id;
            await pool.query('UPDATE appointments SET availability_id = ? WHERE id = ?', [availId, r.id]);
            await pool.query('UPDATE availabilities SET booked_slots = (SELECT COUNT(*) FROM appointments ap WHERE ap.availability_id = ? AND ap.status != "Cancelada") WHERE id = ?', [availId, availId]);
          }
        } catch { /* ignore loop error */ }
      }
    } catch { /* ignore backfill errors */ }
  } catch { /* master ignore */ }
}

export default async function bootstrap(): Promise<void> {
  try {
    await ensureRow();
    await ensureSystemSettingsColumns();
    await ensureTimezones();
  await ensureAppointmentImprovements();
    // ================= Billing & Servicios Médicos =================
    try {
      // Tabla de servicios / exámenes (similar a specialties pero para facturación)
      await pool.query(
        "CREATE TABLE IF NOT EXISTS `services` (\n  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,\n  `name` varchar(150) NOT NULL,\n  `category` enum('consulta','laboratorio','imagen','procedimiento','otro') NOT NULL DEFAULT 'consulta',\n  `description` text NULL,\n  `base_price` decimal(10,2) NOT NULL DEFAULT 0.00,\n  `currency` char(3) NOT NULL DEFAULT 'COP',\n  `active` tinyint(1) NOT NULL DEFAULT 1,\n  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `uk_service_name` (`name`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"
      );
  try { await pool.query('ALTER TABLE services ADD KEY `idx_service_active_name` (`active`,`name`)'); } catch {}
      // Seed básico de servicios si no existen
      try {
        const seedServices = [
          { name: 'Consulta General', category: 'consulta', price: 0 },
          { name: 'Consulta Especialista', category: 'consulta', price: 0 },
          { name: 'Ecografía', category: 'imagen', price: 0 },
          { name: 'Resonancia', category: 'imagen', price: 0 },
          { name: 'Laboratorio Básico', category: 'laboratorio', price: 0 },
        ];
        for (const s of seedServices) {
          await pool.query('INSERT IGNORE INTO services (name, category, base_price, currency, active) VALUES (?,?,?,?,1)', [s.name, s.category, s.price, 'COP']);
        }
      } catch { /* ignore seed errors */ }
      // Tabla de precios por doctor (override)
      await pool.query(
        "CREATE TABLE IF NOT EXISTS `doctor_service_prices` (\n  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,\n  `doctor_id` int UNSIGNED NOT NULL,\n  `service_id` int UNSIGNED NOT NULL,\n  `price` decimal(10,2) NOT NULL,\n  `currency` char(3) NOT NULL DEFAULT 'COP',\n  `active` tinyint(1) NOT NULL DEFAULT 1,\n  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `uk_doctor_service` (`doctor_id`,`service_id`),\n  KEY `idx_service` (`service_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"
      );
      // FKs best-effort
      try { await pool.query("ALTER TABLE doctor_service_prices ADD CONSTRAINT `fk_dsp_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT"); } catch {}
      try { await pool.query("ALTER TABLE doctor_service_prices ADD CONSTRAINT `fk_dsp_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT"); } catch {}
      // Tabla de costos por cita (1 a 1 con appointments)
      await pool.query(
        "CREATE TABLE IF NOT EXISTS `appointment_billing` (\n  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,\n  `appointment_id` int UNSIGNED NOT NULL,\n  `service_id` int UNSIGNED NOT NULL,\n  `doctor_id` int UNSIGNED NOT NULL,\n  `base_price` decimal(10,2) NOT NULL DEFAULT 0.00,\n  `doctor_price` decimal(10,2) NULL,\n  `final_price` decimal(10,2) NOT NULL DEFAULT 0.00,\n  `currency` char(3) NOT NULL DEFAULT 'COP',\n  `status` enum('pending','billed','paid','cancelled') NOT NULL DEFAULT 'pending',\n  `notes` varchar(255) NULL,\n  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `uk_appt_billing` (`appointment_id`),\n  KEY `idx_service` (`service_id`),\n  KEY `idx_doctor` (`doctor_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"
      );
      try { await pool.query("ALTER TABLE appointment_billing ADD CONSTRAINT `fk_ab_appt` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT"); } catch {}
      try { await pool.query("ALTER TABLE appointment_billing ADD CONSTRAINT `fk_ab_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT"); } catch {}
      try { await pool.query("ALTER TABLE appointment_billing ADD CONSTRAINT `fk_ab_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT"); } catch {}
      // Auditoría de cambios de facturación
      try {
        await pool.query("CREATE TABLE IF NOT EXISTS `billing_audit_logs` (\n  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,\n  `billing_id` bigint UNSIGNED NOT NULL,\n  `appointment_id` int UNSIGNED NOT NULL,\n  `changed_by_user_id` int UNSIGNED NULL,\n  `old_status` enum('pending','billed','paid','cancelled') NULL,\n  `new_status` enum('pending','billed','paid','cancelled') NOT NULL,\n  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  KEY `idx_billing` (`billing_id`),\n  KEY `idx_appt` (`appointment_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;");
      } catch {}
  // Índices recomendados para consultas de facturación
  try { await pool.query('ALTER TABLE appointment_billing ADD KEY `idx_ab_status_created` (`status`,`created_at`)'); } catch {}
  try { await pool.query('ALTER TABLE appointment_billing ADD KEY `idx_ab_doctor_created` (`doctor_id`,`created_at`)'); } catch {}
  try { await pool.query('ALTER TABLE appointment_billing ADD KEY `idx_ab_service_created` (`service_id`,`created_at`)'); } catch {}
    } catch { /* ignore billing table errors */ }
    // Cola de espera: tabla queue_entries
    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS `queue_entries` (\n  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,\n  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  `patient_id` int UNSIGNED NOT NULL,\n  `specialty_id` int UNSIGNED NOT NULL,\n  `priority` enum('Alta','Normal','Baja') NOT NULL DEFAULT 'Normal',\n  `status` enum('waiting','assigned','scheduled','cancelled') NOT NULL DEFAULT 'waiting',\n  `reason` varchar(255) DEFAULT NULL,\n  `phone` varchar(30) DEFAULT NULL,\n  `assigned_user_id` int UNSIGNED DEFAULT NULL,\n  `assigned_at` datetime DEFAULT NULL,\n  `scheduled_appointment_id` int UNSIGNED DEFAULT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_status_created` (`status`,`created_at`),\n  KEY `idx_specialty_status_created` (`specialty_id`,`status`,`created_at`),\n  KEY `idx_assigned_user` (`assigned_user_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"
      );
      // Intentar añadir FKs (ignorar errores si faltan permisos o tablas)
      try { await pool.query("ALTER TABLE queue_entries ADD CONSTRAINT `fk_queue_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT"); } catch { /* ignore */ }
      try { await pool.query("ALTER TABLE queue_entries ADD CONSTRAINT `fk_queue_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT"); } catch { /* ignore */ }
    } catch { /* ignore creation errors */ }
    // call_statuses table and relation with call_logs
    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS `call_statuses` (\n  `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT,\n  `name` varchar(50) NOT NULL,\n  `color` varchar(24) DEFAULT NULL,\n  `sort_order` smallint UNSIGNED DEFAULT NULL,\n  `active` enum('active','inactive') NOT NULL DEFAULT 'active',\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `uk_call_status_name` (`name`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"
      );
      // seed basic statuses if not exist
      const defaults = [
        ['Pendiente', 'bg-medical-100 text-medical-800', 10],
        ['En Curso', 'bg-warning-100 text-warning-800', 20],
        ['Atendida', 'bg-success-100 text-success-800', 30],
        ['Transferida', 'bg-blue-100 text-blue-800', 40],
      ];
      const placeholders = defaults.map(() => '(?, ?, ?, "active")').join(',');
      await pool.query(
        `INSERT IGNORE INTO call_statuses (name, color, sort_order, active) VALUES ${placeholders}` as any,
        defaults.flat() as any
      );
      // Ensure call_logs.status_id column exists and FK
      const hasStatusId = await columnExists('call_logs', 'status_id');
      if (!hasStatusId) {
        try {
          await pool.query('ALTER TABLE call_logs ADD COLUMN `status_id` smallint UNSIGNED NULL AFTER `outcome`');
          await pool.query('ALTER TABLE call_logs ADD KEY `fk_calllogs_status` (`status_id`)');
          await pool.query('ALTER TABLE call_logs ADD CONSTRAINT `fk_calllogs_status` FOREIGN KEY (`status_id`) REFERENCES `call_statuses` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT');
        } catch { /* ignore */ }
      }
    } catch { /* ignore creation/seed errors */ }
    // Tabla de transferencias desde IA
    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS `ai_transfers` (\n  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,\n  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  `status` enum('pending','accepted','rejected','completed') NOT NULL DEFAULT 'pending',\n  `patient_id` int UNSIGNED DEFAULT NULL,\n  `patient_name` varchar(150) DEFAULT NULL,\n  `patient_identifier` varchar(50) DEFAULT NULL,\n  `phone` varchar(30) DEFAULT NULL,\n  `specialty_id` int UNSIGNED DEFAULT NULL,\n  `preferred_location_id` int UNSIGNED DEFAULT NULL,\n  `priority` enum('Alta','Media','Baja') DEFAULT 'Media',\n  `transfer_reason` varchar(255) DEFAULT NULL,\n  `ai_observation` text,\n  `assigned_user_id` int UNSIGNED DEFAULT NULL,\n  `accepted_at` datetime DEFAULT NULL,\n  `rejected_reason` varchar(255) DEFAULT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_status_created` (`status`,`created_at`),\n  KEY `idx_specialty` (`specialty_id`),\n  KEY `idx_location` (`preferred_location_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"
      );
      try { await pool.query("ALTER TABLE ai_transfers ADD CONSTRAINT `fk_ai_transfers_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT"); } catch { /* ignore */ }
      try { await pool.query("ALTER TABLE ai_transfers ADD CONSTRAINT `fk_ai_transfers_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT"); } catch { /* ignore */ }
      try { await pool.query("ALTER TABLE ai_transfers ADD CONSTRAINT `fk_ai_transfers_location` FOREIGN KEY (`preferred_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT"); } catch { /* ignore */ }
    } catch { /* ignore */ }
    // Ajustes de tabla locations
    try {
      // Asegurar columna current_patients
      const hasCurrentPatients = await columnExists('locations', 'current_patients');
      if (!hasCurrentPatients) {
        await pool.query('ALTER TABLE locations ADD COLUMN `current_patients` int UNSIGNED NOT NULL DEFAULT 0 AFTER `capacity`');
      }
      // Asegurar que `type` sea VARCHAR(100) y no ENUM
      const [typeInfoRows] = await pool.query(
        "SELECT DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'locations' AND COLUMN_NAME = 'type' LIMIT 1"
      );
      // @ts-ignore
      const typeInfo = (typeInfoRows && typeInfoRows[0]) as any;
      if (typeInfo && String(typeInfo.DATA_TYPE).toLowerCase() === 'enum') {
        await pool.query("ALTER TABLE locations MODIFY COLUMN `type` varchar(100) NOT NULL DEFAULT 'Sucursal'");
      }
    } catch {
      // ignore - no bloquear arranque si no hay permisos
    }
    // Crear tabla de tipos de sede y sembrar valores base si no existen
    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS `location_types` (\n  `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT,\n  `name` varchar(100) NOT NULL,\n  `status` enum('active','inactive') NOT NULL DEFAULT 'active',\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `uk_location_type_name` (`name`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"
      );
      const defaults = ['Sede Principal', 'Sucursal', 'Consultorio', 'Centro de Especialidades'];
      const placeholders = defaults.map(() => '(?, "active")').join(',');
      await pool.query(
        `INSERT IGNORE INTO location_types (name, status) VALUES ${placeholders}` as any,
        defaults as any
      );
      logger.info('Location types seeded successfully');
    } catch (error: any) {
      logger.error('Failed to create/seed location_types:', error.message);
    }
    
    // Índices recomendados para rendimiento de analíticas (best-effort)
    const indexes = [
      { table: 'appointments', name: 'idx_appt_scheduled_at', sql: 'ALTER TABLE appointments ADD KEY `idx_appt_scheduled_at` (`scheduled_at`)' },
      { table: 'appointments', name: 'idx_appt_specialty', sql: 'ALTER TABLE appointments ADD KEY `idx_appt_specialty` (`specialty_id`)' },
      { table: 'appointments', name: 'idx_appt_location', sql: 'ALTER TABLE appointments ADD KEY `idx_appt_location` (`location_id`)' },
      { table: 'locations', name: 'idx_loc_municipality', sql: 'ALTER TABLE locations ADD KEY `idx_loc_municipality` (`municipality_id`)' },
    ];
    
    for (const idx of indexes) {
      try {
        await pool.query(idx.sql);
        logger.info(`Added index ${idx.name} to ${idx.table}`);
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          // Index already exists, this is fine
          continue;
        }
        logger.warn(`Failed to add index ${idx.name}:`, error.message);
      }
    }
  } catch (error: any) {
    logger.error('Bootstrap process failed:', error.message);
    // Don't throw - let server start anyway
  }
}
