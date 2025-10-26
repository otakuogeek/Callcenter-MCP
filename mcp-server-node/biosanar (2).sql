-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Servidor: localhost:3306
-- Tiempo de generación: 13-10-2025 a las 19:38:19
-- Versión del servidor: 10.11.13-MariaDB-0ubuntu0.24.04.1
-- Versión de PHP: 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `biosanar`
--

DELIMITER $$
--
-- Procedimientos
--
CREATE DEFINER=`biosanar_user`@`localhost` PROCEDURE `get_authorized_locations_for_eps_specialty` (IN `p_eps_id` INT UNSIGNED, IN `p_specialty_id` INT UNSIGNED)   BEGIN
  SELECT 
    l.id AS location_id,
    l.name AS location_name,
    l.address,
    l.phone,
    l.municipality_id,
    ea.authorization_date,
    ea.expiration_date,
    ea.max_monthly_appointments,
    ea.copay_percentage,
    ea.requires_prior_authorization,
    ea.notes
  FROM eps_specialty_location_authorizations ea
  INNER JOIN locations l ON ea.location_id = l.id
  WHERE ea.eps_id = p_eps_id
    AND ea.specialty_id = p_specialty_id
    AND ea.authorized = 1
    AND (ea.authorization_date IS NULL OR ea.authorization_date <= CURDATE())
    AND (ea.expiration_date IS NULL OR ea.expiration_date >= CURDATE())
  ORDER BY l.name$$

CREATE DEFINER=`biosanar_user`@`localhost` PROCEDURE `get_authorized_specialties_for_eps` (IN `p_eps_id` INT UNSIGNED, IN `p_location_id` INT UNSIGNED)   BEGIN
  SELECT 
    s.id AS specialty_id,
    s.name AS specialty_name,
    s.description,
    ea.authorization_date,
    ea.expiration_date,
    ea.max_monthly_appointments,
    ea.copay_percentage,
    ea.requires_prior_authorization,
    ea.notes
  FROM eps_specialty_location_authorizations ea
  INNER JOIN specialties s ON ea.specialty_id = s.id
  WHERE ea.eps_id = p_eps_id
    AND ea.location_id = p_location_id
    AND ea.authorized = 1
    AND (ea.authorization_date IS NULL OR ea.authorization_date <= CURDATE())
    AND (ea.expiration_date IS NULL OR ea.expiration_date >= CURDATE())
  ORDER BY s.name$$

CREATE DEFINER=`biosanar_user`@`localhost` PROCEDURE `process_waiting_list_for_availability` (IN `p_availability_id` BIGINT(20) UNSIGNED)   BEGIN
  DECLARE v_slots_available INT DEFAULT 0$$

CREATE DEFINER=`biosanar_user`@`localhost` PROCEDURE `recalc_availability_slots` (IN `p_avail_id` BIGINT)   BEGIN
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
    WHERE a.id = p_avail_id$$

CREATE DEFINER=`biosanar_user`@`localhost` PROCEDURE `UpdateAgentStats` (IN `p_agent_id` VARCHAR(255), IN `p_date` DATE)   BEGIN
    DECLARE v_total_calls INT DEFAULT 0$$

--
-- Funciones
--
CREATE DEFINER=`biosanar_user`@`localhost` FUNCTION `calculate_due_date` (`start_date` DATE) RETURNS DATE DETERMINISTIC BEGIN
  RETURN DATE_ADD(start_date, INTERVAL 280 DAY)$$

CREATE DEFINER=`biosanar_user`@`localhost` FUNCTION `calculate_gestational_days` (`start_date` DATE, `reference_date` DATE) RETURNS INT(11) DETERMINISTIC BEGIN
  RETURN DATEDIFF(reference_date, start_date) % 7$$

CREATE DEFINER=`biosanar_user`@`localhost` FUNCTION `calculate_gestational_weeks` (`start_date` DATE, `reference_date` DATE) RETURNS INT(11) DETERMINISTIC BEGIN
  RETURN DATEDIFF(reference_date, start_date) DIV 7$$

CREATE DEFINER=`biosanar_user`@`localhost` FUNCTION `is_eps_authorized` (`p_eps_id` INT UNSIGNED, `p_specialty_id` INT UNSIGNED, `p_location_id` INT UNSIGNED) RETURNS TINYINT(1) DETERMINISTIC READS SQL DATA BEGIN
  DECLARE is_authorized TINYINT(1) DEFAULT 0$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `active_pregnancies`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `active_pregnancies` (
`pregnancy_id` int(10) unsigned
,`patient_id` bigint(20) unsigned
,`patient_name` varchar(150)
,`patient_document` varchar(30)
,`status` enum('Activa','Completada','Interrumpida')
,`start_date` date
,`expected_due_date` date
,`high_risk` tinyint(1)
,`current_weeks` int(7)
,`current_days` int(8)
,`days_until_due` int(8)
,`prenatal_controls_count` int(11)
,`last_prenatal_control_date` date
,`created_at` timestamp
);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `agenda_optimization_metrics`
--

CREATE TABLE `agenda_optimization_metrics` (
  `id` int(10) UNSIGNED NOT NULL,
  `date` date NOT NULL,
  `doctor_id` bigint(20) UNSIGNED DEFAULT NULL,
  `specialty_id` int(10) UNSIGNED DEFAULT NULL,
  `location_id` int(10) UNSIGNED DEFAULT NULL,
  `total_slots` int(11) NOT NULL DEFAULT 0,
  `total_capacity` int(11) NOT NULL DEFAULT 0,
  `total_occupied` int(11) NOT NULL DEFAULT 0,
  `utilization_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `efficiency_score` decimal(5,2) NOT NULL DEFAULT 0.00,
  `conflicts_detected` int(11) NOT NULL DEFAULT 0,
  `conflicts_resolved` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `agenda_suggestions`
--

CREATE TABLE `agenda_suggestions` (
  `id` int(10) UNSIGNED NOT NULL,
  `suggestion_type` enum('new_slot','modify_capacity','reschedule','cancel_slot') NOT NULL,
  `target_date` date NOT NULL,
  `target_time` time DEFAULT NULL,
  `doctor_id` bigint(20) UNSIGNED DEFAULT NULL,
  `specialty_id` int(10) UNSIGNED DEFAULT NULL,
  `location_id` int(10) UNSIGNED DEFAULT NULL,
  `suggested_capacity` int(11) DEFAULT NULL,
  `confidence_score` decimal(5,2) NOT NULL DEFAULT 0.00,
  `reasoning` text DEFAULT NULL,
  `suggestion_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`suggestion_data`)),
  `status` enum('pending','accepted','rejected','expired') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `processed_by` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `agenda_templates`
--

CREATE TABLE `agenda_templates` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `doctor_id` int(10) UNSIGNED DEFAULT NULL,
  `specialty_id` int(10) UNSIGNED DEFAULT NULL,
  `location_id` int(10) UNSIGNED DEFAULT NULL,
  `days_of_week` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Array de días de la semana [1,2,3,4,5]' CHECK (json_valid(`days_of_week`)),
  `time_slots` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Array de horarios [{"start":"08:00","end":"12:00","capacity":4}]' CHECK (json_valid(`time_slots`)),
  `duration_minutes` int(11) NOT NULL DEFAULT 30,
  `break_between_slots` int(11) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `agenda_templates`
--

INSERT INTO `agenda_templates` (`id`, `name`, `description`, `doctor_id`, `specialty_id`, `location_id`, `days_of_week`, `time_slots`, `duration_minutes`, `break_between_slots`, `active`, `created_at`, `updated_at`) VALUES
(1, 'Horario Estándar Mañana', 'Plantilla para horarios matutinos estándar', NULL, NULL, NULL, '[1, 2, 3, 4, 5]', '[{\"end\": \"12:00\", \"start\": \"08:00\", \"capacity\": 4}]', 30, 0, 1, '2025-08-30 18:13:02', NULL),
(2, 'Horario Estándar Tarde', 'Plantilla para horarios vespertinos estándar', NULL, NULL, NULL, '[1, 2, 3, 4, 5]', '[{\"end\": \"18:00\", \"start\": \"14:00\", \"capacity\": 3}]', 30, 0, 1, '2025-08-30 18:13:02', NULL),
(3, 'Consulta Externa Sábados', 'Horarios especiales para sábados', NULL, NULL, NULL, '[6]', '[{\"end\": \"13:00\", \"start\": \"08:00\", \"capacity\": 6}]', 20, 0, 1, '2025-08-30 18:13:02', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `agent_call_stats`
--

CREATE TABLE `agent_call_stats` (
  `id` int(11) NOT NULL,
  `agent_id` varchar(255) NOT NULL,
  `date` date NOT NULL,
  `total_calls` int(11) DEFAULT 0,
  `successful_calls` int(11) DEFAULT 0,
  `failed_calls` int(11) DEFAULT 0,
  `total_duration_secs` int(11) DEFAULT 0,
  `total_cost` int(11) DEFAULT 0,
  `avg_call_duration` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ai_transfers`
--

CREATE TABLE `ai_transfers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('pending','accepted','rejected','completed') NOT NULL DEFAULT 'pending',
  `patient_id` int(10) UNSIGNED DEFAULT NULL,
  `patient_name` varchar(150) DEFAULT NULL,
  `patient_identifier` varchar(50) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `specialty_id` int(10) UNSIGNED DEFAULT NULL,
  `preferred_location_id` int(10) UNSIGNED DEFAULT NULL,
  `priority` enum('Alta','Media','Baja') DEFAULT 'Media',
  `transfer_reason` varchar(255) DEFAULT NULL,
  `ai_observation` text DEFAULT NULL,
  `assigned_user_id` int(10) UNSIGNED DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `rejected_reason` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `appointments`
--

CREATE TABLE `appointments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `availability_id` bigint(20) UNSIGNED DEFAULT NULL,
  `location_id` int(10) UNSIGNED NOT NULL,
  `specialty_id` int(10) UNSIGNED NOT NULL,
  `doctor_id` bigint(20) UNSIGNED NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `duration_minutes` smallint(5) UNSIGNED NOT NULL DEFAULT 30,
  `appointment_type` enum('Presencial','Telemedicina') NOT NULL DEFAULT 'Presencial',
  `status` enum('Pendiente','Confirmada','Completada','Cancelada') NOT NULL DEFAULT 'Pendiente',
  `reason` text DEFAULT NULL,
  `insurance_type` varchar(150) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `cancellation_reason` varchar(255) DEFAULT NULL,
  `created_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `consultation_reason_detailed` text DEFAULT NULL COMMENT 'Motivo detallado de la consulta',
  `additional_notes` text DEFAULT NULL COMMENT 'Notas adicionales específicas',
  `priority_level` enum('Baja','Normal','Alta','Urgente') DEFAULT 'Normal' COMMENT 'Nivel de prioridad de la cita',
  `insurance_company` varchar(100) DEFAULT NULL COMMENT 'Compañía de seguros específica',
  `insurance_policy_number` varchar(50) DEFAULT NULL COMMENT 'Número de póliza de seguro',
  `appointment_source` enum('Manual','Sistema_Inteligente','Llamada','Web','App') DEFAULT 'Manual' COMMENT 'Origen de la cita',
  `reminder_sent` tinyint(1) DEFAULT 0 COMMENT 'Si se envió recordatorio',
  `reminder_sent_at` timestamp NULL DEFAULT NULL COMMENT 'Fecha cuando se envió el recordatorio',
  `preferred_time` varchar(50) DEFAULT NULL COMMENT 'Horario preferido del paciente',
  `symptoms` text DEFAULT NULL COMMENT 'Síntomas reportados por el paciente',
  `allergies` text DEFAULT NULL COMMENT 'Alergias reportadas para esta cita',
  `medications` text DEFAULT NULL COMMENT 'Medicamentos actuales del paciente',
  `emergency_contact_name` varchar(100) DEFAULT NULL COMMENT 'Nombre contacto de emergencia',
  `emergency_contact_phone` varchar(30) DEFAULT NULL COMMENT 'Teléfono contacto de emergencia',
  `follow_up_required` tinyint(1) DEFAULT 0 COMMENT 'Si requiere seguimiento',
  `follow_up_date` date DEFAULT NULL COMMENT 'Fecha sugerida para seguimiento',
  `payment_method` enum('Efectivo','Tarjeta','Transferencia','Seguro','Credito') DEFAULT NULL COMMENT 'Método de pago',
  `copay_amount` decimal(10,2) DEFAULT NULL COMMENT 'Monto de copago',
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de última actualización'
) ;

--
-- Volcado de datos para la tabla `appointments`
--

INSERT INTO `appointments` (`id`, `patient_id`, `availability_id`, `location_id`, `specialty_id`, `doctor_id`, `scheduled_at`, `duration_minutes`, `appointment_type`, `status`, `reason`, `insurance_type`, `notes`, `cancellation_reason`, `created_by_user_id`, `created_at`, `consultation_reason_detailed`, `additional_notes`, `priority_level`, `insurance_company`, `insurance_policy_number`, `appointment_source`, `reminder_sent`, `reminder_sent_at`, `preferred_time`, `symptoms`, `allergies`, `medications`, `emergency_contact_name`, `emergency_contact_phone`, `follow_up_required`, `follow_up_date`, `payment_method`, `copay_amount`, `updated_at`) VALUES
(135, 1057, 154, 1, 5, 19, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Chequeo general', NULL, NULL, NULL, NULL, '2025-10-08 14:29:46', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-08 14:29:46'),
(136, 1058, 151, 1, 1, 20, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'a esta manera de venir', NULL, NULL, NULL, NULL, '2025-10-08 14:33:45', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-08 14:33:45'),
(137, 1060, 154, 1, 5, 19, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Ecografía con estímulo facial', NULL, NULL, NULL, NULL, '2025-10-08 17:50:39', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-08 17:50:39'),
(138, 1061, 154, 1, 5, 19, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Revisión', NULL, NULL, NULL, NULL, '2025-10-09 12:16:16', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-09 12:16:16'),
(139, 1062, 151, 1, 1, 20, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Ecografía obstétrica con translicencia no cálcica', NULL, NULL, NULL, NULL, '2025-10-09 12:53:02', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-09 12:53:02'),
(140, 1064, 151, 1, 1, 20, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Control de tiroides y entrega de resultados', NULL, NULL, NULL, NULL, '2025-10-09 13:11:05', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-09 13:11:05'),
(141, 1065, 151, 1, 1, 20, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Consulta de medicina general', NULL, NULL, NULL, NULL, '2025-10-09 14:10:04', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-09 14:10:04'),
(142, 1067, 151, 1, 1, 20, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Consulta medicina general', NULL, NULL, NULL, NULL, '2025-10-10 13:37:10', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-10 13:37:10'),
(143, 1069, 142, 1, 1, 6, '2025-10-20 08:00:00', 30, 'Presencial', 'Confirmada', 'Ecografía de vías urinarias', NULL, NULL, NULL, NULL, '2025-10-10 16:47:59', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-10 16:47:59'),
(144, 1069, 151, 1, 1, 20, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Monitoreo ambulatorio de presión arterial', NULL, NULL, NULL, NULL, '2025-10-10 16:48:48', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-10 16:48:48'),
(145, 1070, 151, 1, 1, 20, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Control de exámenes de sangre, azúcar, colesterol y demás', NULL, 'Paciente solicita cita para entrega de resultados de exámenes', NULL, NULL, '2025-10-10 18:17:19', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-10 18:17:19'),
(146, 1071, 151, 1, 1, 20, '2025-10-20 07:00:00', 30, 'Presencial', 'Confirmada', 'Ecografía de vasos venosos del miembro inferior', NULL, NULL, NULL, NULL, '2025-10-10 19:03:56', NULL, NULL, 'Normal', NULL, NULL, 'Sistema_Inteligente', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '2025-10-10 19:03:56');

--
-- Disparadores `appointments`
--
DELIMITER $$
CREATE TRIGGER `auto_process_waiting_list_on_cancel` AFTER UPDATE ON `appointments` FOR EACH ROW BEGIN
  
  IF OLD.status IN ('Pendiente', 'Confirmada') AND NEW.status = 'Cancelada' THEN
    
    CALL process_waiting_list_for_availability(NEW.availability_id)$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_appt_after_insert` AFTER INSERT ON `appointments` FOR EACH ROW BEGIN
          IF NEW.availability_id IS NOT NULL THEN
            CALL recalc_availability_slots(NEW.availability_id)$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_appt_after_update` AFTER UPDATE ON `appointments` FOR EACH ROW BEGIN
          IF (OLD.availability_id IS NOT NULL AND OLD.availability_id != NEW.availability_id) THEN
            CALL recalc_availability_slots(OLD.availability_id)$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `appointments_waiting_list`
--

CREATE TABLE `appointments_waiting_list` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL COMMENT 'ID del paciente que solicita la cita',
  `availability_id` bigint(20) UNSIGNED NOT NULL COMMENT 'ID de la disponibilidad solicitada',
  `scheduled_date` datetime NOT NULL COMMENT 'Fecha/hora solicitada para la cita',
  `appointment_type` enum('Presencial','Telemedicina') NOT NULL DEFAULT 'Presencial' COMMENT 'Tipo de consulta',
  `reason` text NOT NULL COMMENT 'Motivo de la consulta',
  `notes` text DEFAULT NULL COMMENT 'Notas adicionales del paciente o agente',
  `priority_level` enum('Baja','Normal','Alta','Urgente') NOT NULL DEFAULT 'Normal' COMMENT 'Nivel de prioridad para reasignación',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Momento en que se agregó a lista de espera',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `requested_by` varchar(100) DEFAULT NULL COMMENT 'Usuario/agente que hizo la solicitud',
  `status` enum('pending','reassigned','cancelled','expired') NOT NULL DEFAULT 'pending' COMMENT 'Estado de la solicitud',
  `reassigned_at` timestamp NULL DEFAULT NULL COMMENT 'Momento en que se reasignó a appointments',
  `reassigned_appointment_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'ID de la cita creada al reasignar',
  `cancelled_reason` text DEFAULT NULL COMMENT 'Razón de cancelación si aplica',
  `expires_at` datetime DEFAULT NULL COMMENT 'Fecha de expiración de la solicitud',
  `call_type` enum('normal','reagendar') NOT NULL DEFAULT 'normal' COMMENT 'Tipo de llamada: normal o reagendar (citas canceladas con prioridad visual)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lista de espera para citas cuando no hay cupos disponibles';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `appointment_billing`
--

CREATE TABLE `appointment_billing` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `appointment_id` int(10) UNSIGNED NOT NULL,
  `service_id` int(10) UNSIGNED NOT NULL,
  `doctor_id` int(10) UNSIGNED NOT NULL,
  `base_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `doctor_price` decimal(10,2) DEFAULT NULL,
  `final_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'COP',
  `status` enum('pending','billed','paid','cancelled') NOT NULL DEFAULT 'pending',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `appointment_daily_stats`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `appointment_daily_stats` (
`date` date
,`location_id` int(10) unsigned
,`specialty_id` int(10) unsigned
,`total_appointments` bigint(21)
,`completed_appointments` decimal(23,0)
,`cancelled_appointments` decimal(23,0)
,`pending_appointments` decimal(23,0)
,`completion_rate` decimal(29,2)
);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `availabilities`
--

CREATE TABLE `availabilities` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `location_id` int(10) UNSIGNED NOT NULL,
  `specialty_id` int(10) UNSIGNED NOT NULL,
  `doctor_id` bigint(20) UNSIGNED NOT NULL,
  `date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `capacity` smallint(5) UNSIGNED NOT NULL DEFAULT 1,
  `booked_slots` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `status` enum('Activa','Cancelada','Completa') NOT NULL DEFAULT 'Activa',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_from_template` tinyint(1) DEFAULT 0,
  `template_id` int(10) UNSIGNED DEFAULT NULL,
  `optimization_score` decimal(5,2) DEFAULT NULL COMMENT 'Score de optimización 0-100',
  `last_optimization_date` timestamp NULL DEFAULT NULL,
  `duration_minutes` int(11) NOT NULL DEFAULT 30,
  `break_between_slots` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `availabilities`
--

INSERT INTO `availabilities` (`id`, `location_id`, `specialty_id`, `doctor_id`, `date`, `start_time`, `end_time`, `capacity`, `booked_slots`, `status`, `notes`, `created_at`, `created_from_template`, `template_id`, `optimization_score`, `last_optimization_date`, `duration_minutes`, `break_between_slots`) VALUES
(142, 1, 1, 6, '2025-10-20', '08:00:00', '11:45:00', 15, 1, 'Activa', '', '2025-10-06 14:25:21', 0, NULL, NULL, NULL, 30, 0),
(143, 1, 1, 6, '2025-10-20', '14:00:00', '16:45:00', 12, 0, 'Activa', '', '2025-10-06 14:28:15', 0, NULL, NULL, NULL, 30, 0),
(144, 1, 1, 6, '2025-10-21', '09:00:00', '11:45:00', 15, 0, 'Activa', '', '2025-10-06 14:32:51', 0, NULL, NULL, NULL, 30, 0),
(145, 1, 1, 6, '2025-10-21', '14:00:00', '16:45:00', 12, 0, 'Activa', '', '2025-10-06 14:33:39', 0, NULL, NULL, NULL, 30, 0),
(146, 1, 1, 6, '2025-10-22', '08:00:00', '11:45:00', 15, 0, 'Activa', '', '2025-10-06 14:34:49', 0, NULL, NULL, NULL, 30, 0),
(147, 1, 1, 6, '2025-10-22', '14:00:00', '16:45:00', 12, 0, 'Activa', '', '2025-10-06 14:35:24', 0, NULL, NULL, NULL, 30, 0),
(148, 1, 1, 6, '2025-10-23', '08:00:00', '11:45:00', 15, 0, 'Activa', '', '2025-10-06 14:36:44', 0, NULL, NULL, NULL, 30, 0),
(149, 1, 1, 6, '2025-10-24', '08:00:00', '11:45:00', 15, 0, 'Activa', '', '2025-10-06 14:45:56', 0, NULL, NULL, NULL, 30, 0),
(150, 1, 1, 6, '2025-10-24', '14:00:00', '16:45:00', 12, 0, 'Activa', '', '2025-10-06 14:47:41', 0, NULL, NULL, NULL, 30, 0),
(151, 1, 1, 20, '2025-10-20', '07:00:00', '11:40:00', 15, 8, 'Activa', '', '2025-10-06 14:48:54', 0, NULL, NULL, NULL, 30, 0),
(152, 1, 1, 20, '2025-10-21', '07:00:00', '11:40:00', 15, 0, 'Activa', '', '2025-10-06 14:49:49', 0, NULL, NULL, NULL, 30, 0),
(153, 1, 1, 20, '2025-10-23', '07:00:00', '11:40:00', 15, 0, 'Activa', '', '2025-10-06 14:50:32', 0, NULL, NULL, NULL, 30, 0),
(154, 1, 5, 19, '2025-10-20', '07:00:00', '11:40:00', 15, 3, 'Activa', '', '2025-10-06 15:02:34', 0, NULL, NULL, NULL, 30, 0),
(155, 1, 5, 19, '2025-10-20', '14:00:00', '16:40:00', 9, 0, 'Activa', '', '2025-10-06 15:03:13', 0, NULL, NULL, NULL, 30, 0),
(156, 1, 5, 19, '2025-10-22', '07:00:00', '11:40:00', 15, 0, 'Activa', '', '2025-10-06 15:03:56', 0, NULL, NULL, NULL, 30, 0),
(157, 1, 5, 19, '2025-10-22', '14:00:00', '16:40:00', 9, 0, 'Activa', '', '2025-10-06 15:04:32', 0, NULL, NULL, NULL, 30, 0),
(158, 1, 5, 19, '2025-10-24', '07:00:00', '11:40:00', 15, 0, 'Activa', '', '2025-10-06 15:05:12', 0, NULL, NULL, NULL, 30, 0),
(159, 1, 5, 19, '2025-10-24', '14:00:00', '16:40:00', 9, 0, 'Activa', '', '2025-10-06 15:05:43', 0, NULL, NULL, NULL, 30, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `availability_distribution`
--

CREATE TABLE `availability_distribution` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `availability_id` bigint(20) UNSIGNED NOT NULL,
  `day_date` date NOT NULL,
  `quota` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `assigned` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `availability_distribution`
--

INSERT INTO `availability_distribution` (`id`, `availability_id`, `day_date`, `quota`, `assigned`, `created_at`) VALUES
(152, 142, '2025-10-15', 1, 0, '2025-10-06 14:25:21'),
(153, 142, '2025-10-08', 0, 0, '2025-10-06 14:25:21'),
(154, 142, '2025-10-07', 0, 0, '2025-10-06 14:25:21'),
(155, 142, '2025-10-10', 0, 0, '2025-10-06 14:25:21'),
(156, 142, '2025-10-06', 0, 0, '2025-10-06 14:25:21'),
(157, 142, '2025-10-09', 0, 0, '2025-10-06 14:25:21'),
(158, 142, '2025-10-13', 8, 0, '2025-10-06 14:25:21'),
(159, 142, '2025-10-17', 1, 0, '2025-10-06 14:25:21'),
(160, 142, '2025-10-16', 2, 0, '2025-10-06 14:25:21'),
(161, 142, '2025-10-20', 2, 1, '2025-10-06 14:25:21'),
(162, 142, '2025-10-14', 1, 0, '2025-10-06 14:25:21'),
(163, 143, '2025-10-10', 0, 0, '2025-10-06 14:28:15'),
(164, 143, '2025-10-13', 7, 0, '2025-10-06 14:28:15'),
(165, 143, '2025-10-14', 1, 0, '2025-10-06 14:28:15'),
(166, 143, '2025-10-17', 1, 0, '2025-10-06 14:28:15'),
(167, 143, '2025-10-06', 0, 0, '2025-10-06 14:28:15'),
(168, 143, '2025-10-07', 0, 0, '2025-10-06 14:28:15'),
(169, 143, '2025-10-16', 1, 0, '2025-10-06 14:28:15'),
(170, 143, '2025-10-08', 0, 0, '2025-10-06 14:28:15'),
(171, 143, '2025-10-15', 1, 0, '2025-10-06 14:28:15'),
(172, 143, '2025-10-20', 1, 0, '2025-10-06 14:28:15'),
(173, 143, '2025-10-09', 0, 0, '2025-10-06 14:28:15'),
(174, 144, '2025-10-09', 0, 0, '2025-10-06 14:32:51'),
(175, 144, '2025-10-08', 0, 0, '2025-10-06 14:32:51'),
(176, 144, '2025-10-20', 1, 0, '2025-10-06 14:32:51'),
(177, 144, '2025-10-21', 1, 0, '2025-10-06 14:32:51'),
(178, 144, '2025-10-13', 9, 0, '2025-10-06 14:32:51'),
(179, 144, '2025-10-10', 0, 0, '2025-10-06 14:32:51'),
(180, 144, '2025-10-17', 1, 0, '2025-10-06 14:32:51'),
(181, 144, '2025-10-15', 1, 0, '2025-10-06 14:32:51'),
(182, 144, '2025-10-06', 0, 0, '2025-10-06 14:32:51'),
(183, 144, '2025-10-07', 0, 0, '2025-10-06 14:32:51'),
(184, 144, '2025-10-16', 1, 0, '2025-10-06 14:32:51'),
(185, 144, '2025-10-14', 1, 0, '2025-10-06 14:32:51'),
(186, 145, '2025-10-15', 1, 0, '2025-10-06 14:33:39'),
(187, 145, '2025-10-17', 1, 0, '2025-10-06 14:33:39'),
(188, 145, '2025-10-07', 1, 0, '2025-10-06 14:33:39'),
(189, 145, '2025-10-13', 1, 0, '2025-10-06 14:33:39'),
(190, 145, '2025-10-06', 1, 0, '2025-10-06 14:33:39'),
(191, 145, '2025-10-20', 1, 0, '2025-10-06 14:33:39'),
(192, 145, '2025-10-09', 1, 0, '2025-10-06 14:33:39'),
(193, 145, '2025-10-10', 1, 0, '2025-10-06 14:33:39'),
(194, 145, '2025-10-08', 1, 0, '2025-10-06 14:33:39'),
(195, 145, '2025-10-16', 1, 0, '2025-10-06 14:33:39'),
(196, 145, '2025-10-14', 1, 0, '2025-10-06 14:33:39'),
(197, 145, '2025-10-21', 1, 0, '2025-10-06 14:33:39'),
(198, 146, '2025-10-14', 1, 0, '2025-10-06 14:34:49'),
(199, 146, '2025-10-15', 1, 0, '2025-10-06 14:34:49'),
(200, 146, '2025-10-07', 1, 0, '2025-10-06 14:34:49'),
(201, 146, '2025-10-06', 1, 0, '2025-10-06 14:34:49'),
(202, 146, '2025-10-10', 1, 0, '2025-10-06 14:34:49'),
(203, 146, '2025-10-09', 2, 0, '2025-10-06 14:34:49'),
(204, 146, '2025-10-17', 1, 0, '2025-10-06 14:34:49'),
(205, 146, '2025-10-13', 1, 0, '2025-10-06 14:34:49'),
(206, 146, '2025-10-21', 1, 0, '2025-10-06 14:34:49'),
(207, 146, '2025-10-20', 2, 0, '2025-10-06 14:34:49'),
(208, 146, '2025-10-08', 1, 0, '2025-10-06 14:34:49'),
(209, 146, '2025-10-16', 1, 0, '2025-10-06 14:34:49'),
(210, 146, '2025-10-22', 1, 0, '2025-10-06 14:34:49'),
(211, 147, '2025-10-10', 3, 0, '2025-10-06 14:35:24'),
(212, 147, '2025-10-16', 4, 0, '2025-10-06 14:35:24'),
(213, 147, '2025-10-21', 1, 0, '2025-10-06 14:35:24'),
(214, 147, '2025-10-09', 1, 0, '2025-10-06 14:35:24'),
(215, 147, '2025-10-14', 1, 0, '2025-10-06 14:35:24'),
(216, 147, '2025-10-20', 2, 0, '2025-10-06 14:35:24'),
(217, 148, '2025-10-20', 1, 0, '2025-10-06 14:36:44'),
(218, 148, '2025-10-14', 1, 0, '2025-10-06 14:36:44'),
(219, 148, '2025-10-17', 1, 0, '2025-10-06 14:36:44'),
(220, 148, '2025-10-09', 2, 0, '2025-10-06 14:36:44'),
(221, 148, '2025-10-06', 1, 0, '2025-10-06 14:36:44'),
(222, 148, '2025-10-15', 1, 0, '2025-10-06 14:36:44'),
(223, 148, '2025-10-22', 1, 0, '2025-10-06 14:36:44'),
(224, 148, '2025-10-10', 1, 0, '2025-10-06 14:36:44'),
(225, 148, '2025-10-21', 1, 0, '2025-10-06 14:36:44'),
(226, 148, '2025-10-23', 1, 0, '2025-10-06 14:36:44'),
(227, 148, '2025-10-16', 1, 0, '2025-10-06 14:36:44'),
(228, 148, '2025-10-07', 1, 0, '2025-10-06 14:36:44'),
(229, 148, '2025-10-13', 1, 0, '2025-10-06 14:36:44'),
(230, 148, '2025-10-08', 1, 0, '2025-10-06 14:36:44'),
(231, 149, '2025-10-13', 1, 0, '2025-10-06 14:45:56'),
(232, 149, '2025-10-06', 1, 0, '2025-10-06 14:45:56'),
(233, 149, '2025-10-23', 1, 0, '2025-10-06 14:45:56'),
(234, 149, '2025-10-24', 1, 0, '2025-10-06 14:45:56'),
(235, 149, '2025-10-21', 1, 0, '2025-10-06 14:45:56'),
(236, 149, '2025-10-22', 1, 0, '2025-10-06 14:45:56'),
(237, 149, '2025-10-09', 1, 0, '2025-10-06 14:45:56'),
(238, 149, '2025-10-17', 1, 0, '2025-10-06 14:45:56'),
(239, 149, '2025-10-14', 1, 0, '2025-10-06 14:45:56'),
(240, 149, '2025-10-15', 1, 0, '2025-10-06 14:45:56'),
(241, 149, '2025-10-07', 1, 0, '2025-10-06 14:45:56'),
(242, 149, '2025-10-16', 1, 0, '2025-10-06 14:45:56'),
(243, 149, '2025-10-20', 1, 0, '2025-10-06 14:45:56'),
(244, 149, '2025-10-08', 1, 0, '2025-10-06 14:45:56'),
(245, 149, '2025-10-10', 1, 0, '2025-10-06 14:45:56'),
(246, 150, '2025-10-24', 2, 0, '2025-10-06 14:47:41'),
(247, 150, '2025-10-22', 2, 0, '2025-10-06 14:47:41'),
(248, 150, '2025-10-17', 1, 0, '2025-10-06 14:47:41'),
(249, 150, '2025-10-20', 1, 0, '2025-10-06 14:47:41'),
(250, 150, '2025-10-10', 2, 0, '2025-10-06 14:47:41'),
(251, 150, '2025-10-16', 1, 0, '2025-10-06 14:47:41'),
(252, 150, '2025-10-06', 1, 0, '2025-10-06 14:47:41'),
(253, 150, '2025-10-23', 2, 0, '2025-10-06 14:47:41'),
(254, 151, '2025-10-15', 1, 0, '2025-10-06 14:48:54'),
(255, 151, '2025-10-16', 2, 1, '2025-10-06 14:48:54'),
(256, 151, '2025-10-06', 1, 1, '2025-10-06 14:48:54'),
(257, 151, '2025-10-07', 2, 2, '2025-10-06 14:48:54'),
(258, 151, '2025-10-13', 1, 0, '2025-10-06 14:48:54'),
(259, 151, '2025-10-10', 1, 0, '2025-10-06 14:48:54'),
(260, 151, '2025-10-08', 2, 2, '2025-10-06 14:48:54'),
(261, 151, '2025-10-20', 1, 1, '2025-10-06 14:48:54'),
(262, 151, '2025-10-09', 1, 0, '2025-10-06 14:48:54'),
(263, 151, '2025-10-17', 1, 0, '2025-10-06 14:48:54'),
(264, 151, '2025-10-14', 2, 1, '2025-10-06 14:48:54'),
(265, 152, '2025-10-13', 9, 0, '2025-10-06 14:49:49'),
(266, 152, '2025-10-07', 0, 0, '2025-10-06 14:49:49'),
(267, 152, '2025-10-08', 0, 0, '2025-10-06 14:49:49'),
(268, 152, '2025-10-17', 1, 0, '2025-10-06 14:49:49'),
(269, 152, '2025-10-15', 1, 0, '2025-10-06 14:49:49'),
(270, 152, '2025-10-16', 1, 0, '2025-10-06 14:49:49'),
(271, 152, '2025-10-10', 0, 0, '2025-10-06 14:49:49'),
(272, 152, '2025-10-21', 1, 0, '2025-10-06 14:49:49'),
(273, 152, '2025-10-09', 0, 0, '2025-10-06 14:49:49'),
(274, 152, '2025-10-20', 1, 0, '2025-10-06 14:49:49'),
(275, 152, '2025-10-06', 0, 0, '2025-10-06 14:49:49'),
(276, 152, '2025-10-14', 1, 0, '2025-10-06 14:49:49'),
(277, 153, '2025-10-20', 1, 0, '2025-10-06 14:50:32'),
(278, 153, '2025-10-22', 1, 0, '2025-10-06 14:50:32'),
(279, 153, '2025-10-09', 1, 0, '2025-10-06 14:50:32'),
(280, 153, '2025-10-07', 1, 0, '2025-10-06 14:50:32'),
(281, 153, '2025-10-13', 1, 0, '2025-10-06 14:50:32'),
(282, 153, '2025-10-17', 1, 0, '2025-10-06 14:50:32'),
(283, 153, '2025-10-23', 1, 0, '2025-10-06 14:50:32'),
(284, 153, '2025-10-10', 1, 0, '2025-10-06 14:50:32'),
(285, 153, '2025-10-21', 2, 0, '2025-10-06 14:50:32'),
(286, 153, '2025-10-06', 1, 0, '2025-10-06 14:50:32'),
(287, 153, '2025-10-08', 1, 0, '2025-10-06 14:50:32'),
(288, 153, '2025-10-16', 1, 0, '2025-10-06 14:50:32'),
(289, 153, '2025-10-15', 1, 0, '2025-10-06 14:50:32'),
(290, 153, '2025-10-14', 1, 0, '2025-10-06 14:50:32'),
(291, 154, '2025-10-10', 1, 1, '2025-10-06 15:02:34'),
(292, 154, '2025-10-16', 1, 0, '2025-10-06 15:02:34'),
(293, 154, '2025-10-20', 1, 0, '2025-10-06 15:02:34'),
(294, 154, '2025-10-14', 2, 1, '2025-10-06 15:02:34'),
(295, 154, '2025-10-06', 1, 1, '2025-10-06 15:02:34'),
(296, 154, '2025-10-13', 6, 0, '2025-10-06 15:02:34'),
(297, 154, '2025-10-07', 0, 0, '2025-10-06 15:02:34'),
(298, 154, '2025-10-17', 1, 0, '2025-10-06 15:02:34'),
(299, 154, '2025-10-15', 2, 0, '2025-10-06 15:02:34'),
(300, 154, '2025-10-08', 0, 0, '2025-10-06 15:02:34'),
(301, 154, '2025-10-09', 0, 0, '2025-10-06 15:02:34'),
(302, 155, '2025-10-07', 3, 0, '2025-10-06 15:03:13'),
(303, 155, '2025-10-06', 1, 0, '2025-10-06 15:03:13'),
(304, 155, '2025-10-10', 3, 0, '2025-10-06 15:03:13'),
(305, 155, '2025-10-13', 2, 0, '2025-10-06 15:03:13'),
(306, 156, '2025-10-15', 1, 0, '2025-10-06 15:03:56'),
(307, 156, '2025-10-06', 1, 0, '2025-10-06 15:03:56'),
(308, 156, '2025-10-16', 1, 0, '2025-10-06 15:03:56'),
(309, 156, '2025-10-14', 1, 0, '2025-10-06 15:03:56'),
(310, 156, '2025-10-22', 1, 0, '2025-10-06 15:03:56'),
(311, 156, '2025-10-20', 1, 0, '2025-10-06 15:03:56'),
(312, 156, '2025-10-21', 1, 0, '2025-10-06 15:03:56'),
(313, 156, '2025-10-07', 1, 0, '2025-10-06 15:03:56'),
(314, 156, '2025-10-08', 1, 0, '2025-10-06 15:03:56'),
(315, 156, '2025-10-10', 1, 0, '2025-10-06 15:03:56'),
(316, 156, '2025-10-13', 1, 0, '2025-10-06 15:03:56'),
(317, 156, '2025-10-17', 1, 0, '2025-10-06 15:03:56'),
(318, 156, '2025-10-09', 3, 0, '2025-10-06 15:03:56'),
(319, 157, '2025-10-07', 2, 0, '2025-10-06 15:04:32'),
(320, 157, '2025-10-10', 3, 0, '2025-10-06 15:04:32'),
(321, 157, '2025-10-20', 1, 0, '2025-10-06 15:04:32'),
(322, 157, '2025-10-16', 1, 0, '2025-10-06 15:04:32'),
(323, 157, '2025-10-06', 1, 0, '2025-10-06 15:04:32'),
(324, 157, '2025-10-14', 1, 0, '2025-10-06 15:04:32'),
(325, 158, '2025-10-07', 1, 0, '2025-10-06 15:05:12'),
(326, 158, '2025-10-08', 1, 0, '2025-10-06 15:05:12'),
(327, 158, '2025-10-20', 1, 0, '2025-10-06 15:05:12'),
(328, 158, '2025-10-14', 1, 0, '2025-10-06 15:05:12'),
(329, 158, '2025-10-17', 1, 0, '2025-10-06 15:05:12'),
(330, 158, '2025-10-21', 1, 0, '2025-10-06 15:05:12'),
(331, 158, '2025-10-16', 1, 0, '2025-10-06 15:05:12'),
(332, 158, '2025-10-15', 1, 0, '2025-10-06 15:05:12'),
(333, 158, '2025-10-13', 1, 0, '2025-10-06 15:05:12'),
(334, 158, '2025-10-06', 1, 0, '2025-10-06 15:05:12'),
(335, 158, '2025-10-23', 1, 0, '2025-10-06 15:05:12'),
(336, 158, '2025-10-10', 1, 0, '2025-10-06 15:05:12'),
(337, 158, '2025-10-09', 1, 0, '2025-10-06 15:05:12'),
(338, 158, '2025-10-22', 1, 0, '2025-10-06 15:05:12'),
(339, 158, '2025-10-24', 1, 0, '2025-10-06 15:05:12'),
(340, 159, '2025-10-17', 1, 0, '2025-10-06 15:05:43'),
(341, 159, '2025-10-20', 1, 0, '2025-10-06 15:05:43'),
(342, 159, '2025-10-08', 2, 0, '2025-10-06 15:05:43'),
(343, 159, '2025-10-24', 2, 0, '2025-10-06 15:05:43'),
(344, 159, '2025-10-13', 2, 0, '2025-10-06 15:05:43'),
(345, 159, '2025-10-21', 1, 0, '2025-10-06 15:05:43');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `billing_audit_logs`
--

CREATE TABLE `billing_audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `billing_id` bigint(20) UNSIGNED NOT NULL,
  `appointment_id` int(10) UNSIGNED NOT NULL,
  `changed_by_user_id` int(10) UNSIGNED DEFAULT NULL,
  `old_status` enum('pending','billed','paid','cancelled') DEFAULT NULL,
  `new_status` enum('pending','billed','paid','cancelled') NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `blood_groups`
--

CREATE TABLE `blood_groups` (
  `id` smallint(5) UNSIGNED NOT NULL,
  `code` varchar(3) NOT NULL,
  `name` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `blood_groups`
--

INSERT INTO `blood_groups` (`id`, `code`, `name`) VALUES
(1, 'A+', 'A+'),
(2, 'A-', 'A-'),
(3, 'B+', 'B+'),
(4, 'B-', 'B-'),
(5, 'AB+', 'AB+'),
(6, 'AB-', 'AB-'),
(7, 'O+', 'O+'),
(8, 'O-', 'O-'),
(25, 'A+', 'A+'),
(26, 'A-', 'A-'),
(27, 'B+', 'B+'),
(28, 'B-', 'B-'),
(29, 'AB+', 'AB+'),
(30, 'AB-', 'AB-'),
(31, 'O+', 'O+'),
(32, 'O-', 'O-'),
(33, 'A+', 'A+'),
(34, 'A-', 'A-'),
(35, 'B+', 'B+'),
(36, 'B-', 'B-'),
(37, 'AB+', 'AB+'),
(38, 'AB-', 'AB-'),
(39, 'O+', 'O+'),
(40, 'O-', 'O-'),
(41, 'A+', 'A+'),
(42, 'A-', 'A-'),
(43, 'B+', 'B+'),
(44, 'B-', 'B-'),
(45, 'AB+', 'AB+'),
(46, 'AB-', 'AB-'),
(47, 'O+', 'O+'),
(48, 'O-', 'O-');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `calls`
--

CREATE TABLE `calls` (
  `id` int(11) NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `patient_name` varchar(255) NOT NULL,
  `patient_phone` varchar(20) DEFAULT NULL,
  `agent_name` varchar(255) NOT NULL,
  `call_type` enum('Consulta General','Urgencia','Seguimiento','Información') DEFAULT 'Consulta General',
  `status` enum('active','waiting','ended') DEFAULT 'waiting',
  `priority` enum('Normal','Alta','Baja','Urgencia') DEFAULT 'Normal',
  `start_time` timestamp NULL DEFAULT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` int(11) DEFAULT 0 COMMENT 'Duración en segundos',
  `transcript` text DEFAULT NULL,
  `audio_url` text DEFAULT NULL,
  `webhook_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`webhook_data`)),
  `webhook_data_end` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`webhook_data_end`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `calls`
--

INSERT INTO `calls` (`id`, `conversation_id`, `patient_name`, `patient_phone`, `agent_name`, `call_type`, `status`, `priority`, `start_time`, `end_time`, `duration`, `transcript`, `audio_url`, `webhook_data`, `webhook_data_end`, `created_at`, `updated_at`) VALUES
(1, 'conv_001', 'María García', '+573001234567', 'Dr. Nuevo Agente', 'Consulta General', 'active', 'Normal', '2025-08-26 12:13:19', NULL, 300, NULL, NULL, NULL, NULL, '2025-08-26 12:18:19', '2025-08-26 12:41:25'),
(2, 'conv_002', 'Juan Pérez', '+573001234568', 'Dra. López', 'Urgencia', 'waiting', 'Urgencia', '2025-08-26 12:16:19', NULL, 120, NULL, NULL, NULL, NULL, '2025-08-26 12:18:19', '2025-08-26 12:41:58'),
(3, 'conv_003', 'Ana Martínez', '+573001234569', 'valeria dos', 'Seguimiento', 'active', 'Alta', '2025-08-26 12:10:19', NULL, 480, NULL, NULL, NULL, NULL, '2025-08-26 12:18:19', '2025-08-26 22:50:49'),
(4, 'conv_004', 'Carlos Jiménez', '+573001234570', 'Dr. Atendiendo', 'Consulta General', 'active', 'Normal', '2025-08-26 12:41:43', NULL, 0, NULL, NULL, NULL, NULL, '2025-08-26 12:18:19', '2025-08-26 12:41:43'),
(5, 'conv_005', 'Laura Sánchez', '+573001234571', 'Pendiente', 'Urgencia', 'waiting', 'Alta', NULL, NULL, 0, NULL, NULL, NULL, NULL, '2025-08-26 12:18:19', '2025-08-26 12:18:19'),
(6, 'conv_006', 'Pedro González', '+573001234572', 'Pendiente', 'Información', 'waiting', 'Baja', NULL, NULL, 0, NULL, NULL, NULL, NULL, '2025-08-26 12:18:19', '2025-08-26 12:18:19');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `call_events`
--

CREATE TABLE `call_events` (
  `id` bigint(20) NOT NULL,
  `call_id` int(11) DEFAULT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `event_type` enum('started','ended','transfer','attend','hold') NOT NULL,
  `agent_name` varchar(255) DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `call_events`
--

INSERT INTO `call_events` (`id`, `call_id`, `conversation_id`, `event_type`, `agent_name`, `meta`, `created_at`) VALUES
(1, 9, 'test_conv_actions', 'attend', 'Dr. Tester', NULL, '2025-08-26 19:45:42'),
(2, 9, 'test_conv_actions', 'transfer', 'Dr. Nuevo', NULL, '2025-08-26 19:45:42'),
(3, 9, 'test_conv_actions', 'hold', 'Dr. Nuevo', NULL, '2025-08-26 19:45:42'),
(4, 3, 'conv_003', 'transfer', 'valeria dos', NULL, '2025-08-26 22:50:49');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `call_logs`
--

CREATE TABLE `call_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED DEFAULT NULL,
  `specialty_id` int(10) UNSIGNED DEFAULT NULL,
  `queue_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `channel` enum('AI','Manual') NOT NULL DEFAULT 'AI',
  `outcome` enum('Cita agendada','No contestó','Rechazó','Número inválido','Otro') NOT NULL,
  `status_id` smallint(5) UNSIGNED DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `call_notifications`
--

CREATE TABLE `call_notifications` (
  `id` int(11) NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `patient_id` bigint(20) UNSIGNED DEFAULT NULL,
  `agent_id` varchar(255) NOT NULL,
  `call_type` enum('started','completed') NOT NULL,
  `timestamp` datetime NOT NULL,
  `duration_secs` int(11) DEFAULT 0,
  `cost` int(11) DEFAULT 0,
  `summary` text DEFAULT NULL,
  `success_status` enum('success','failure','unknown') DEFAULT 'unknown',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `call_notifications`
--

INSERT INTO `call_notifications` (`id`, `conversation_id`, `patient_id`, `agent_id`, `call_type`, `timestamp`, `duration_secs`, `cost`, `summary`, `success_status`, `metadata`, `created_at`) VALUES
(6, 'test_conv_12345', NULL, 'test_agent_001', 'completed', '2024-11-24 17:40:00', 60, 150, 'El paciente llamó para agendar una cita médica. La conversación fue exitosa y se recopiló la información básica del paciente.', 'success', '{\"user_id\": \"test_user_789\", \"user_name\": \"Dave Alberto Bastidas\", \"termination_reason\": \"user_hangup\", \"original_payload_type\": \"post_call_transcription\"}', '2025-08-25 19:40:22'),
(9, 'test_conv_12345', NULL, 'test_agent_001', 'completed', '2024-11-24 17:40:00', 0, 0, NULL, 'unknown', '{\"user_id\": \"test_user_12345\", \"user_name\": \"Paciente Test Webhook\", \"original_payload_type\": \"post_call_transcription\"}', '2025-08-25 23:09:20'),
(10, 'test_conv_12345', NULL, 'test_agent_001', 'completed', '2024-11-24 17:40:00', 0, 0, NULL, 'unknown', '{\"user_id\": \"test_user_12345\", \"user_name\": \"Paciente Test Webhook\", \"original_payload_type\": \"post_call_transcription\"}', '2025-08-25 23:12:31'),
(11, 'test_conv_12345', NULL, 'test_agent_001', 'completed', '2024-11-24 17:40:00', 0, 0, NULL, 'unknown', '{\"user_id\": \"test_user_12345\", \"user_name\": \"Paciente Test Webhook\", \"original_payload_type\": \"post_call_transcription\"}', '2025-08-25 23:15:52');

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `call_stats_view`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `call_stats_view` (
`call_date` date
,`agent_id` varchar(255)
,`total_calls` bigint(21)
,`successful_calls` decimal(22,0)
,`failed_calls` decimal(22,0)
,`total_duration_secs` decimal(32,0)
,`total_cost` decimal(32,0)
,`avg_duration_secs` decimal(14,4)
,`avg_cost` decimal(14,4)
);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `call_statuses`
--

CREATE TABLE `call_statuses` (
  `id` smallint(5) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL,
  `color` varchar(24) DEFAULT NULL,
  `sort_order` smallint(5) UNSIGNED DEFAULT NULL,
  `active` enum('active','inactive') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `call_statuses`
--

INSERT INTO `call_statuses` (`id`, `name`, `color`, `sort_order`, `active`) VALUES
(1, 'Pendiente', 'bg-medical-100 text-medi', 10, 'active'),
(2, 'En Curso', 'bg-warning-100 text-warn', 20, 'active'),
(3, 'Atendida', 'bg-success-100 text-succ', 30, 'active'),
(4, 'Transferida', 'bg-blue-100 text-blue-80', 40, 'active');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `conflict_resolutions`
--

CREATE TABLE `conflict_resolutions` (
  `id` int(10) UNSIGNED NOT NULL,
  `availability_id` bigint(20) UNSIGNED NOT NULL,
  `resolution_type` enum('reschedule','cancel','increase_capacity','split_slot') NOT NULL,
  `resolution_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Datos específicos de la resolución' CHECK (json_valid(`resolution_data`)),
  `notes` text DEFAULT NULL,
  `resolved_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `resolved_by` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `conversation_memory`
--

CREATE TABLE `conversation_memory` (
  `id` int(11) NOT NULL,
  `patient_document` varchar(20) NOT NULL,
  `session_id` varchar(100) NOT NULL,
  `conversation_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`conversation_data`)),
  `last_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `status` enum('active','completed','archived') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `conversation_memory`
--

INSERT INTO `conversation_memory` (`id`, `patient_document`, `session_id`, `conversation_data`, `last_updated`, `created_at`, `status`) VALUES
(1, '79876543', 'session_test_001', '{\"metadata\":{\"start_time\":\"2025-08-28T13:24:29.885Z\",\"last_activity\":\"2025-08-28T13:35:45.356Z\",\"total_interactions\":3,\"conversation_quality\":\"initiated\",\"memory_size\":904,\"last_optimized\":\"2025-09-23T15:31:33.373Z\"},\"patient_info\":{\"document\":\"79876543\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para registro\",\"timestamp\":\"2025-08-28T13:24:29.885Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Carlos Alberto Rodríguez Mendoza\",\"timestamp\":\"2025-08-28T13:31:56.270Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Carlos Alberto Rodríguez Mendoza\",\"timestamp\":\"2025-08-28T13:35:45.356Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"registro\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-28 13:24:29', 'active'),
(2, '', 'new_patient_001', '{\"metadata\": {\"start_time\": \"2025-08-28T13:52:39.280Z\", \"last_activity\": \"2025-08-28T14:28:52.528Z\", \"total_interactions\": 6, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para general\", \"timestamp\": \"2025-08-28T13:52:39.280Z\", \"validated\": true}, {\"content\": \"María Elena Rodríguez Vásquez\", \"timestamp\": \"2025-08-28T13:53:15.225Z\"}, {\"content\": \"43567890\", \"timestamp\": \"2025-08-28T13:54:01.599Z\"}, {\"content\": \"María Elena Rodríguez Vásquez\", \"timestamp\": \"2025-08-28T13:57:57.457Z\"}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"María Elena Rodríguez Vásquez\", \"timestamp\": \"2025-08-28T14:24:52.476Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1990-03-15\", \"timestamp\": \"2025-08-28T14:26:16.739Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-08-28T14:28:52.528Z\", \"validated\": true}], \"conversation_context\": {\"current_step\": \"phone_collection\"}}', '2025-08-28 14:28:52', '2025-08-28 13:52:39', 'completed'),
(3, '', '1693233600_', '{\"metadata\":{\"start_time\":\"2025-08-28T14:47:54.567Z\",\"last_activity\":\"2025-08-28T14:47:54.567Z\",\"total_interactions\":1,\"conversation_quality\":\"initiated\",\"memory_size\":626,\"last_optimized\":\"2025-09-23T15:31:33.377Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para general\",\"timestamp\":\"2025-08-28T14:47:54.567Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"general\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-28 14:47:54', 'active'),
(4, '', '1693234890_', '{\"metadata\":{\"start_time\":\"2025-08-28T14:48:52.806Z\",\"last_activity\":\"2025-08-28T14:48:52.806Z\",\"total_interactions\":1,\"conversation_quality\":\"initiated\",\"memory_size\":656,\"last_optimized\":\"2025-09-23T15:31:33.378Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-08-28T14:48:52.806Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"appointment_scheduling\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-28 14:48:52', 'active'),
(5, '172659001', '1693248000_172659001', '{\"metadata\":{\"start_time\":\"2025-08-28T14:55:37.699Z\",\"last_activity\":\"2025-08-28T14:57:16.161Z\",\"total_interactions\":5,\"conversation_quality\":\"initiated\",\"memory_size\":1142,\"last_optimized\":\"2025-09-23T15:31:33.379Z\"},\"patient_info\":{\"document\":\"172659001\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-08-28T14:55:37.699Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"172659001\",\"timestamp\":\"2025-08-28T14:56:07.395Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Day Alberto Matías Martínez\",\"timestamp\":\"2025-08-28T14:56:20.160Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"1984-04-12\",\"timestamp\":\"2025-08-28T14:56:47.816Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"04263774021\",\"timestamp\":\"2025-08-28T14:57:16.161Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"appointment_scheduling\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-28 14:55:37', 'active'),
(6, '', 'timestamp_Marcos_PES_001', '{\"metadata\":{\"start_time\":\"2025-08-28T15:07:04.504Z\",\"last_activity\":\"2025-08-28T15:07:04.504Z\",\"total_interactions\":1,\"conversation_quality\":\"initiated\",\"memory_size\":626,\"last_optimized\":\"2025-09-23T15:31:33.380Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para general\",\"timestamp\":\"2025-08-28T15:07:04.504Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"general\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-28 15:07:04', 'active'),
(7, '23333001', '1693250000_23333001', '{\"metadata\":{\"start_time\":\"2025-08-28T15:38:33.199Z\",\"last_activity\":\"2025-08-28T15:39:34.390Z\",\"total_interactions\":3,\"conversation_quality\":\"initiated\",\"memory_size\":897,\"last_optimized\":\"2025-09-23T15:31:33.381Z\"},\"patient_info\":{\"document\":\"23333001\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-08-28T15:38:33.199Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"José Vengador\",\"timestamp\":\"2025-08-28T15:39:29.549Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"2000-01-01\",\"timestamp\":\"2025-08-28T15:39:34.390Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"appointment_scheduling\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-28 15:38:33', 'active'),
(8, '17604304', 'session_17604304_2025-08-28T00:00:00Z', '{\"metadata\":{\"start_time\":\"2025-08-28T16:53:58.284Z\",\"last_activity\":\"2025-08-28T16:54:35.921Z\",\"total_interactions\":3,\"conversation_quality\":\"initiated\",\"memory_size\":939,\"last_optimized\":\"2025-09-23T15:31:33.383Z\"},\"patient_info\":{\"document\":\"17604304\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-08-28T16:53:58.284Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"17604304\",\"timestamp\":\"2025-08-28T16:54:00.846Z\",\"validated\":true},{\"type\":\"verification\",\"field\":\"name\",\"content\":\"Identidad confirmada: María José Delgado Romero con documento 17604304\",\"timestamp\":\"2025-08-28T16:54:35.921Z\"}],\"conversation_context\":{\"purpose\":\"appointment_scheduling\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-28 16:53:58', 'active'),
(9, '11235689', 'session_11235689_2025-08-28T00:00:00Z', '{\"metadata\":{\"start_time\":\"2025-08-28T17:02:29.651Z\",\"last_activity\":\"2025-08-28T17:06:32.858Z\",\"total_interactions\":14,\"conversation_quality\":\"initiated\",\"memory_size\":2306,\"last_optimized\":\"2025-09-23T15:31:33.384Z\"},\"patient_info\":{\"document\":\"11235689\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-08-28T17:02:29.651Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"11235689\",\"timestamp\":\"2025-08-28T17:02:32.334Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Juan Carlos Álvarez Domingo\",\"timestamp\":\"2025-08-28T17:03:04.429Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Cédula de Ciudadanía\",\"timestamp\":\"2025-08-28T17:03:26.063Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"1997-04-30\",\"timestamp\":\"2025-08-28T17:03:42.100Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3105672307\",\"timestamp\":\"2025-08-28T17:04:11.521Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Carrera 20 #10-24\",\"timestamp\":\"2025-08-28T17:04:13.572Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"municipality\",\"content\":\"San Gil\",\"timestamp\":\"2025-08-28T17:05:11.123Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"eps\",\"content\":\"NUEVA EPS\",\"timestamp\":\"2025-08-28T17:05:19.753Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group\",\"content\":\"A+\",\"timestamp\":\"2025-08-28T17:05:43.351Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status\",\"content\":\"Soltero(a)\",\"timestamp\":\"2025-08-28T17:05:51.509Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"estrato\",\"content\":\"1\",\"timestamp\":\"2025-08-28T17:05:55.429Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"juancarlosdomingo@gmail.com\",\"timestamp\":\"2025-08-28T17:06:20.231Z\",\"validated\":true},{\"type\":\"system\",\"field\":\"registration_status\",\"content\":\"createPatient ejecutado\",\"timestamp\":\"2025-08-28T17:06:32.858Z\"}],\"conversation_context\":{\"current_step\":\"crear_registro\",\"completed_steps\":[\"documento\",\"nombre\",\"tipo_documento\",\"fecha_nacimiento\",\"telefono\",\"direccion\",\"municipio\",\"eps\",\"afiliacion\",\"sangre\",\"estado_civil\",\"estrato\",\"email\"]}}', '2025-09-23 15:31:33', '2025-08-28 17:02:29', 'active'),
(10, '28252922', '28252922_20240116', '{\"metadata\":{\"start_time\":\"2025-08-29T18:11:01.791Z\",\"last_activity\":\"2025-08-29T18:12:48.503Z\",\"total_interactions\":11,\"conversation_quality\":\"initiated\",\"memory_size\":1868,\"last_optimized\":\"2025-09-23T15:31:33.385Z\"},\"patient_info\":{\"document\":\"28252922\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para new_patient_registration\",\"timestamp\":\"2025-08-29T18:11:01.791Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Ana Inés Romero Fernández\",\"timestamp\":\"2025-08-29T18:11:05.706Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3185676234\",\"timestamp\":\"2025-08-29T18:11:14.967Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"nomail@biosanarcall.site\",\"timestamp\":\"2025-08-29T18:11:21.955Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Carrera cuarta 437 Mogotis\",\"timestamp\":\"2025-08-29T18:11:36.650Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"municipality_id\",\"content\":\"19\",\"timestamp\":\"2025-08-29T18:11:46.582Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_eps_id\",\"content\":\"14\",\"timestamp\":\"2025-08-29T18:12:02.782Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_affiliation_type\",\"content\":\"Subsidiado\",\"timestamp\":\"2025-08-29T18:12:10.282Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group_id\",\"content\":\"3\",\"timestamp\":\"2025-08-29T18:12:20.799Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status_id\",\"content\":\"2\",\"timestamp\":\"2025-08-29T18:12:34.271Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"estrato\",\"content\":\"2\",\"timestamp\":\"2025-08-29T18:12:48.503Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"new_patient_registration\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-29 18:11:01', 'active'),
(11, '63476284', '63476284_20240116', '{\"metadata\":{\"start_time\":\"2025-08-29T18:17:17.449Z\",\"last_activity\":\"2025-08-29T18:19:37.205Z\",\"total_interactions\":13,\"conversation_quality\":\"initiated\",\"memory_size\":2090,\"last_optimized\":\"2025-09-23T15:31:33.386Z\"},\"patient_info\":{\"document\":\"63476284\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para new_patient_registration\",\"timestamp\":\"2025-08-29T18:17:17.449Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Blanca Celina López Dulcey\",\"timestamp\":\"2025-08-29T18:17:23.737Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type_id\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:17:41.423Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"1973-08-16\",\"timestamp\":\"2025-08-29T18:17:54.500Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3157873980\",\"timestamp\":\"2025-08-29T18:18:07.553Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"nomail@biosanarcall.site\",\"timestamp\":\"2025-08-29T18:18:13.809Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Vereda El Hoyo\",\"timestamp\":\"2025-08-29T18:18:24.965Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"municipality_id\",\"content\":\"19\",\"timestamp\":\"2025-08-29T18:18:32.396Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_eps_id\",\"content\":\"14\",\"timestamp\":\"2025-08-29T18:18:49.983Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_affiliation_type\",\"content\":\"Subsidiado\",\"timestamp\":\"2025-08-29T18:18:58.685Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group_id\",\"content\":\"7\",\"timestamp\":\"2025-08-29T18:19:04.793Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status_id\",\"content\":\"3\",\"timestamp\":\"2025-08-29T18:19:23.679Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"estrato\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:19:37.205Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"new_patient_registration\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-29 18:17:17', 'active'),
(12, '5687403', '5687403_20240104', '{\"metadata\":{\"start_time\":\"2025-08-29T18:23:10.463Z\",\"last_activity\":\"2025-08-29T18:27:51.039Z\",\"total_interactions\":17,\"conversation_quality\":\"initiated\",\"memory_size\":2541,\"last_optimized\":\"2025-09-23T15:31:33.388Z\"},\"patient_info\":{\"document\":\"5687403\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para new_patient_registration\",\"timestamp\":\"2025-08-29T18:23:10.463Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Juan Bautista Muñoz\",\"timestamp\":\"2025-08-29T18:23:23.341Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type_id\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:23:44.561Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"1947-05-23\",\"timestamp\":\"2025-08-29T18:23:59.892Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3173583022\",\"timestamp\":\"2025-08-29T18:24:14.403Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"nomail@biosanarcall.site\",\"timestamp\":\"2025-08-29T18:24:24.103Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Vereda El Hoyo\",\"timestamp\":\"2025-08-29T18:24:39.805Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"municipality_id\",\"content\":\"19\",\"timestamp\":\"2025-08-29T18:25:47.457Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_eps_id\",\"content\":\"14\",\"timestamp\":\"2025-08-29T18:26:05.527Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_affiliation_type\",\"content\":\"Subsidiado\",\"timestamp\":\"2025-08-29T18:26:15.576Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group_id\",\"content\":\"7\",\"timestamp\":\"2025-08-29T18:26:25.596Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status_id\",\"content\":\"2\",\"timestamp\":\"2025-08-29T18:26:37.089Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"estrato\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:26:46.506Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"specialty_id\",\"content\":\"9\",\"timestamp\":\"2025-08-29T18:27:11.437Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"location_id\",\"content\":\"Sede Biosanar San Gil\",\"timestamp\":\"2025-08-29T18:27:16.629Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"location_id\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:27:32.649Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"doctor_id\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:27:51.039Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"new_patient_registration\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-29 18:23:10', 'active'),
(13, '1244781445', '1244781445_20240104', '{\"metadata\":{\"start_time\":\"2025-08-29T18:32:17.825Z\",\"last_activity\":\"2025-08-29T18:36:25.320Z\",\"total_interactions\":16,\"conversation_quality\":\"initiated\",\"memory_size\":2421,\"last_optimized\":\"2025-09-23T15:31:33.389Z\"},\"patient_info\":{\"document\":\"1244781445\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para new_patient_registration\",\"timestamp\":\"2025-08-29T18:32:17.825Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Sara Michelle Ruiz Serrano\",\"timestamp\":\"2025-08-29T18:32:37.322Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type_id\",\"content\":\"6\",\"timestamp\":\"2025-08-29T18:32:58.782Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"2025-03-27\",\"timestamp\":\"2025-08-29T18:33:19.036Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3174614457\",\"timestamp\":\"2025-08-29T18:33:38.110Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"nomail@biosanarcall.site\",\"timestamp\":\"2025-08-29T18:33:47.354Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Vereda Caucho\",\"timestamp\":\"2025-08-29T18:34:04.261Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"municipality_id\",\"content\":\"19\",\"timestamp\":\"2025-08-29T18:34:18.956Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_eps_id\",\"content\":\"14\",\"timestamp\":\"2025-08-29T18:34:36.429Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_affiliation_type\",\"content\":\"Subsidiado\",\"timestamp\":\"2025-08-29T18:34:49.193Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group_id\",\"content\":\"7\",\"timestamp\":\"2025-08-29T18:34:59.268Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status_id\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:35:03.583Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"estrato\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:35:18.064Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"specialty_id\",\"content\":\"6\",\"timestamp\":\"2025-08-29T18:35:49.984Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"location_id\",\"content\":\"1\",\"timestamp\":\"2025-08-29T18:36:05.538Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"doctor_id\",\"content\":\"11\",\"timestamp\":\"2025-08-29T18:36:25.320Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"new_patient_registration\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-29 18:32:17', 'active'),
(14, '11010753500', 'reg_11010753500_20240104', '{\"metadata\":{\"start_time\":\"2025-08-29T19:14:37.734Z\",\"last_activity\":\"2025-08-29T19:18:50.331Z\",\"total_interactions\":13,\"conversation_quality\":\"initiated\",\"memory_size\":2093,\"last_optimized\":\"2025-09-23T15:31:33.391Z\"},\"patient_info\":{\"document\":\"11010753500\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para new_patient_registration\",\"timestamp\":\"2025-08-29T19:14:37.734Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Andrés Felipe Romero Torozo\",\"timestamp\":\"2025-08-29T19:15:14.106Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type_id\",\"content\":\"3\",\"timestamp\":\"2025-08-29T19:15:27.963Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"2009-05-14\",\"timestamp\":\"2025-08-29T19:15:43.847Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3181173333\",\"timestamp\":\"2025-08-29T19:16:03.240Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"nomail@biosanarcall.site\",\"timestamp\":\"2025-08-29T19:16:44.444Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Calle 22, 641\",\"timestamp\":\"2025-08-29T19:17:05.829Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"municipality_id\",\"content\":\"26\",\"timestamp\":\"2025-08-29T19:17:21.937Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_eps_id\",\"content\":\"14\",\"timestamp\":\"2025-08-29T19:17:37.223Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_affiliation_type\",\"content\":\"Subsidiado\",\"timestamp\":\"2025-08-29T19:17:49.665Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group_id\",\"content\":\"7\",\"timestamp\":\"2025-08-29T19:18:12.569Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status_id\",\"content\":\"1\",\"timestamp\":\"2025-08-29T19:18:19.017Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"estrato\",\"content\":\"2\",\"timestamp\":\"2025-08-29T19:18:50.331Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"new_patient_registration\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-08-29 19:14:37', 'active'),
(15, '1098410555', 'session_1098410555_1735076400', '{\"metadata\": {\"start_time\": \"2025-09-01T15:02:54.442Z\", \"last_activity\": \"2025-09-01T15:07:25.753Z\", \"total_interactions\": 11, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"1098410555\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:02:54.442Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"1098410555\", \"timestamp\": \"2025-09-01T15:02:57.891Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"daughter_document\", \"content\": \"1098409651\", \"timestamp\": \"2025-09-01T15:03:46.728Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Deiber Fabián\", \"timestamp\": \"2025-09-01T15:04:23.915Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Tarjeta de Identidad\", \"timestamp\": \"2025-09-01T15:04:48.536Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2014-06-20\", \"timestamp\": \"2025-09-01T15:05:14.014Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3232148337\", \"timestamp\": \"2025-09-01T15:05:34.517Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"En el páramo de Santander\", \"timestamp\": \"2025-09-01T15:06:21.580Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Páramo\", \"timestamp\": \"2025-09-01T15:07:02.648Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"COOMEVA\", \"timestamp\": \"2025-09-01T15:07:16.938Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:07:20.496Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: cancelled\", \"timestamp\": \"2025-09-01T15:07:25.753Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:07:25', '2025-09-01 15:02:54', 'completed'),
(16, '37895809', '20250108_37895809', '{\"metadata\": {\"start_time\": \"2025-09-01T15:06:27.216Z\", \"last_activity\": \"2025-09-01T15:12:57.218Z\", \"total_interactions\": 16, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"37895809\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:06:27.216Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"37895809\", \"timestamp\": \"2025-09-01T15:06:31.806Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Inés Romero Patiño\", \"timestamp\": \"2025-09-01T15:07:04.673Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:07:29.331Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1974-02-08\", \"timestamp\": \"2025-09-01T15:07:52.737Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3204778034\", \"timestamp\": \"2025-09-01T15:08:11.536Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-09-01T15:08:23.515Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda Alhaja\", \"timestamp\": \"2025-09-01T15:08:41.057Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"San Gil\", \"timestamp\": \"2025-09-01T15:09:08.238Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Famisanar\", \"timestamp\": \"2025-09-01T15:09:31.506Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:09:46.047Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"A+\", \"timestamp\": \"2025-09-01T15:10:10.087Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Separada\", \"timestamp\": \"2025-09-01T15:10:30.902Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:10:46.031Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor\", \"content\": \"Dra. Ana Teresa Escobar\", \"timestamp\": \"2025-09-01T15:11:47.936Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_datetime\", \"content\": \"2025-09-01 15:00:00\", \"timestamp\": \"2025-09-01T15:12:46.058Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-09-01T15:12:57.218Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:12:57', '2025-09-01 15:03:51', 'completed'),
(17, '', 'session_20250108_victoria', '{\"metadata\":{\"start_time\":\"2025-09-01T15:04:50.417Z\",\"last_activity\":\"2025-09-01T15:09:18.429Z\",\"total_interactions\":10,\"conversation_quality\":\"initiated\",\"memory_size\":1964,\"last_optimized\":\"2025-09-23T15:31:33.392Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:04:50.417Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"1098356769\",\"timestamp\":\"2025-09-01T15:05:16.523Z\",\"validated\":true},{\"type\":\"clarification\",\"field\":\"patient_clarification\",\"content\":\"La cita es para su hijo, no para Victoria\",\"timestamp\":\"2025-09-01T15:05:53.069Z\"},{\"type\":\"clarification\",\"field\":\"services_clarification\",\"content\":\"Los exámenes también son para el hijo\",\"timestamp\":\"2025-09-01T15:06:01.858Z\"},{\"type\":\"answer\",\"field\":\"child_document\",\"content\":\"1100962323\",\"timestamp\":\"2025-09-01T15:06:29.075Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"child_name\",\"content\":\"Víctor Manuel Beltrán Hernández\",\"timestamp\":\"2025-09-01T15:07:37.173Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Tarjeta de Identidad\",\"timestamp\":\"2025-09-01T15:08:07.060Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"2010-10-17\",\"timestamp\":\"2025-09-01T15:08:26.055Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3138851202\",\"timestamp\":\"2025-09-01T15:08:44.959Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"tollitahernandez0@gmail.com\",\"timestamp\":\"2025-09-01T15:09:18.429Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"new_patient_registration\",\"current_step\":\"child_registration_needed\",\"completed_steps\":[\"mother_document_collected\",\"child_document_collected\",\"both_verified_not_found\"],\"pending_questions\":[\"child_name\",\"child_birth_date\",\"document_type\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:04:50', 'active'),
(18, '37895809', '20250108_37895809', '{\"metadata\": {\"start_time\": \"2025-09-01T15:06:27.216Z\", \"last_activity\": \"2025-09-01T15:12:57.218Z\", \"total_interactions\": 16, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"37895809\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:06:27.216Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"37895809\", \"timestamp\": \"2025-09-01T15:06:31.806Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Inés Romero Patiño\", \"timestamp\": \"2025-09-01T15:07:04.673Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:07:29.331Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1974-02-08\", \"timestamp\": \"2025-09-01T15:07:52.737Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3204778034\", \"timestamp\": \"2025-09-01T15:08:11.536Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-09-01T15:08:23.515Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda Alhaja\", \"timestamp\": \"2025-09-01T15:08:41.057Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"San Gil\", \"timestamp\": \"2025-09-01T15:09:08.238Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Famisanar\", \"timestamp\": \"2025-09-01T15:09:31.506Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:09:46.047Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"A+\", \"timestamp\": \"2025-09-01T15:10:10.087Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Separada\", \"timestamp\": \"2025-09-01T15:10:30.902Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:10:46.031Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor\", \"content\": \"Dra. Ana Teresa Escobar\", \"timestamp\": \"2025-09-01T15:11:47.936Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_datetime\", \"content\": \"2025-09-01 15:00:00\", \"timestamp\": \"2025-09-01T15:12:46.058Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-09-01T15:12:57.218Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:12:57', '2025-09-01 15:06:27', 'completed'),
(19, '109840965', 'session_109840965_1735077600', '{\"metadata\": {\"start_time\": \"2025-09-01T15:08:32.225Z\", \"last_activity\": \"2025-09-01T15:17:46.440Z\", \"total_interactions\": 21, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"109840965\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-09-01T15:08:32.225Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"109840965\", \"timestamp\": \"2025-09-01T15:08:35.687Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_confirmed\", \"content\": \"1098409651\", \"timestamp\": \"2025-09-01T15:09:27.437Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Nieves Ludey Naranjo Ríos\", \"timestamp\": \"2025-09-01T15:09:45.262Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:10:10.924Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1999-01-26\", \"timestamp\": \"2025-09-01T15:10:26.624Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3232314877\", \"timestamp\": \"2025-09-01T15:10:48.027Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-09-01T15:11:00.469Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"En páramo finca del limón\", \"timestamp\": \"2025-09-01T15:11:15.778Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Páramo\", \"timestamp\": \"2025-09-01T15:11:33.304Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Nueva EPS\", \"timestamp\": \"2025-09-01T15:12:29.312Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_purpose\", \"content\": \"Cita para terapia para su hijo\", \"timestamp\": \"2025-09-01T15:13:00.885Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:13:19.754Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"O+\", \"timestamp\": \"2025-09-01T15:13:35.643Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Unión libre\", \"timestamp\": \"2025-09-01T15:13:56.060Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:14:10.034Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"specialty_selected\", \"content\": \"Psicología para terapia del hijo\", \"timestamp\": \"2025-09-01T15:14:37.873Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"location_selected\", \"content\": \"Sede Biosanar San Gil\", \"timestamp\": \"2025-09-01T15:15:20.872Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor_selected\", \"content\": \"Dra. Valentina Abaunza Ballesteros\", \"timestamp\": \"2025-09-01T15:15:47.220Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_date\", \"content\": \"Viernes 6 de septiembre 2025\", \"timestamp\": \"2025-09-01T15:17:02.270Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_time\", \"content\": \"8:00 AM\", \"timestamp\": \"2025-09-01T15:17:28.201Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-09-01T15:17:46.440Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:17:46', '2025-09-01 15:08:32', 'completed'),
(20, '', 'session_20250109_ecografia', '{\"metadata\":{\"start_time\":\"2025-09-01T15:11:01.087Z\",\"last_activity\":\"2025-09-01T15:11:47.975Z\",\"total_interactions\":2,\"conversation_quality\":\"initiated\",\"memory_size\":814,\"last_optimized\":\"2025-09-23T15:31:33.393Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:11:01.087Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"2872084\",\"timestamp\":\"2025-09-01T15:11:40.043Z\",\"validated\":true}],\"conversation_context\":{\"current_step\":\"new_patient_registration\",\"completed_steps\":[\"document_verification\"],\"pending_questions\":[\"patient_registration\",\"appointment_scheduling\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:11:01', 'active'),
(21, '', 'session_20250109_recovery', '{\"metadata\":{\"start_time\":\"2025-09-01T15:11:52.144Z\",\"last_activity\":\"2025-09-01T15:12:16.526Z\",\"total_interactions\":2,\"conversation_quality\":\"initiated\",\"memory_size\":772,\"last_optimized\":\"2025-09-23T15:31:33.395Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:11:52.144Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"1109762323\",\"timestamp\":\"2025-09-01T15:12:16.526Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"appointment_scheduling\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-09-01 15:11:52', 'active'),
(22, '110962323', 'session_110962323_2025', '{\"metadata\": {\"start_time\": \"2025-09-01T15:13:33.141Z\", \"last_activity\": \"2025-09-01T15:22:00.965Z\", \"total_interactions\": 18, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"110962323\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-09-01T15:13:33.141Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"110962323\", \"timestamp\": \"2025-09-01T15:13:36.696Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Víctor Manuel Belzán Hernández\", \"timestamp\": \"2025-09-01T15:13:54.976Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Tarjeta de identidad\", \"timestamp\": \"2025-09-01T15:14:51.181Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2010-10-17\", \"timestamp\": \"2025-09-01T15:15:36.835Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3138851202\", \"timestamp\": \"2025-09-01T15:15:57.246Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"toquitadeyuca.ernesto0@gmail.com\", \"timestamp\": \"2025-09-01T15:16:28.852Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Carrera 2B407, Barrio Las Brisas, Zarazón\", \"timestamp\": \"2025-09-01T15:16:46.530Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Socorro\", \"timestamp\": \"2025-09-01T15:17:26.057Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Nueva EPS\", \"timestamp\": \"2025-09-01T15:17:43.459Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:18:01.416Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"O+\", \"timestamp\": \"2025-09-01T15:18:51.931Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Soltero\", \"timestamp\": \"2025-09-01T15:19:19.933Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:19:31.880Z\", \"validated\": true}, {\"type\": \"system\", \"field\": \"registration_status\", \"content\": \"createPatient ejecutado exitosamente - ID: 1021\", \"timestamp\": \"2025-09-01T15:19:46.106Z\"}, {\"type\": \"answer\", \"field\": \"location\", \"content\": \"Sede Biosanar San Gil\", \"timestamp\": \"2025-09-01T15:20:30.405Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor\", \"content\": \"Dra. Yesika Andrea Fiallo\", \"timestamp\": \"2025-09-01T15:20:47.051Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_datetime\", \"content\": \"Viernes 5 de septiembre 2025 a las 10:00 AM\", \"timestamp\": \"2025-09-01T15:21:46.682Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-09-01T15:22:00.965Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"appointment_scheduling\", \"completed_steps\": [\"patient_registration\"]}}', '2025-09-01 15:22:00', '2025-09-01 15:13:33', 'completed'),
(23, '28423886', 'session_28423886_2025', '{\"metadata\":{\"start_time\":\"2025-09-01T15:23:24.746Z\",\"last_activity\":\"2025-09-01T15:30:53.582Z\",\"total_interactions\":22,\"conversation_quality\":\"initiated\",\"memory_size\":3437,\"last_optimized\":\"2025-09-23T15:31:33.396Z\"},\"patient_info\":{\"document\":\"28423886\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para new_patient_registration\",\"timestamp\":\"2025-09-01T15:23:24.746Z\",\"validated\":true},{\"type\":\"question\",\"field\":\"name\",\"content\":\"Solicitando nombre completo del paciente\",\"timestamp\":\"2025-09-01T15:23:38.077Z\"},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Graciela Silva Céllis\",\"timestamp\":\"2025-09-01T15:24:07.126Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Cédula de Ciudadanía\",\"timestamp\":\"2025-09-01T15:24:37.066Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"28423886\",\"timestamp\":\"2025-09-01T15:24:41.800Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"29 julio 1956\",\"timestamp\":\"2025-09-01T15:25:00.043Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3014555914\",\"timestamp\":\"2025-09-01T15:25:19.775Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"gracielasilvan5@hotmail.com\",\"timestamp\":\"2025-09-01T15:25:36.710Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Calle 10 Sur número 9615, segunda etapa, Rincón del Virrey, Socorro\",\"timestamp\":\"2025-09-01T15:25:56.532Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"municipality\",\"content\":\"Socorro\",\"timestamp\":\"2025-09-01T15:26:21.719Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"eps\",\"content\":\"Nueva EPS (paciente particular)\",\"timestamp\":\"2025-09-01T15:27:05.407Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_affiliation_type\",\"content\":\"Contributivo\",\"timestamp\":\"2025-09-01T15:27:25.958Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group\",\"content\":\"O+ (RH positivo)\",\"timestamp\":\"2025-09-01T15:27:40.402Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status\",\"content\":\"Soltera\",\"timestamp\":\"2025-09-01T15:27:52.761Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"estrato\",\"content\":\"3\",\"timestamp\":\"2025-09-01T15:28:07.606Z\",\"validated\":true},{\"type\":\"system\",\"field\":\"registration_status\",\"content\":\"createPatient ejecutado exitosamente - ID: 1022\",\"timestamp\":\"2025-09-01T15:28:26.034Z\"},{\"type\":\"answer\",\"field\":\"specialty\",\"content\":\"Medicina General\",\"timestamp\":\"2025-09-01T15:29:04.052Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"location\",\"content\":\"Sede Biosanar Socorro\",\"timestamp\":\"2025-09-01T15:29:34.292Z\",\"validated\":true},{\"type\":\"question\",\"field\":\"doctor_selection\",\"content\":\"Ofreciendo Dr. Calixto Escorcia Angulo para medicina general\",\"timestamp\":\"2025-09-01T15:29:51.749Z\"},{\"type\":\"answer\",\"field\":\"doctor\",\"content\":\"Dr. Calixto Escorcia Angulo - acepta\",\"timestamp\":\"2025-09-01T15:30:12.530Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"date_preference\",\"content\":\"Solicita cita para hoy - necesita precio\",\"timestamp\":\"2025-09-01T15:30:23.810Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"time_preference\",\"content\":\"Prefiere mañana - hoy en la mañana\",\"timestamp\":\"2025-09-01T15:30:53.582Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"appointment_scheduling\",\"current_step\":\"appointment_scheduling\",\"completed_steps\":[\"patient_registration\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:23:24', 'active');
INSERT INTO `conversation_memory` (`id`, `patient_document`, `session_id`, `conversation_data`, `last_updated`, `created_at`, `status`) VALUES
(24, '', 'session_20250109_001', '{\"metadata\":{\"start_time\":\"2025-09-01T15:23:52.773Z\",\"last_activity\":\"2025-09-01T15:30:48.415Z\",\"total_interactions\":17,\"conversation_quality\":\"initiated\",\"memory_size\":2616,\"last_optimized\":\"2025-09-23T15:31:33.397Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:23:52.773Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"1098408107\",\"timestamp\":\"2025-09-01T15:24:47.333Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"1098408107\",\"timestamp\":\"2025-09-01T15:24:51.874Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Alba Marina Mesa\",\"timestamp\":\"2025-09-01T15:25:24.324Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Cédula de Ciudadanía\",\"timestamp\":\"2025-09-01T15:25:55.852Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"1991-03-29\",\"timestamp\":\"2025-09-01T15:26:39.435Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3144908597\",\"timestamp\":\"2025-09-01T15:27:03.601Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"no tiene correo\",\"timestamp\":\"2025-09-01T15:27:15.495Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Vereda Resguardo, Charalá, Santander\",\"timestamp\":\"2025-09-01T15:27:34.430Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"municipality\",\"content\":\"Charalá\",\"timestamp\":\"2025-09-01T15:27:57.480Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"eps\",\"content\":\"Nueva EPS\",\"timestamp\":\"2025-09-01T15:28:23.860Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_affiliation_type\",\"content\":\"Subsidiado\",\"timestamp\":\"2025-09-01T15:28:38.121Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group\",\"content\":\"A+\",\"timestamp\":\"2025-09-01T15:29:04.568Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status\",\"content\":\"Soltera\",\"timestamp\":\"2025-09-01T15:29:19.416Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"estrato\",\"content\":\"1\",\"timestamp\":\"2025-09-01T15:29:34.401Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"location\",\"content\":\"Sede San Gil\",\"timestamp\":\"2025-09-01T15:30:25.178Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"doctor\",\"content\":\"Dr. Andrés Romero\",\"timestamp\":\"2025-09-01T15:30:48.415Z\",\"validated\":true}],\"conversation_context\":{\"current_step\":\"new_patient_registration\",\"completed_steps\":[\"document_verification\"],\"pending_questions\":[\"name\",\"document_type\",\"birth_date\",\"phone\",\"address\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:23:52', 'active'),
(25, '', 'session_20250108_pediatria', '{\"metadata\":{\"start_time\":\"2025-09-01T15:31:20.534Z\",\"last_activity\":\"2025-09-01T15:31:20.534Z\",\"total_interactions\":1,\"conversation_quality\":\"initiated\",\"memory_size\":656,\"last_optimized\":\"2025-09-23T15:31:33.406Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:31:20.534Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"appointment_scheduling\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-09-01 15:26:02', 'active'),
(26, '51855013', 'session_51855013_20250108', '{\"metadata\":{\"start_time\":\"2025-09-01T15:26:43.094Z\",\"last_activity\":\"2025-09-01T15:30:43.956Z\",\"total_interactions\":12,\"conversation_quality\":\"initiated\",\"memory_size\":2114,\"last_optimized\":\"2025-09-23T15:31:33.400Z\"},\"patient_info\":{\"document\":\"51855013\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:26:43.094Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"51855013\",\"timestamp\":\"2025-09-01T15:26:47.021Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Luz Miriam Barbosa Díaz\",\"timestamp\":\"2025-09-01T15:27:38.192Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Cédula de Ciudadanía\",\"timestamp\":\"2025-09-01T15:28:09.179Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"1967-02-09\",\"timestamp\":\"2025-09-01T15:28:28.191Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3222248250\",\"timestamp\":\"2025-09-01T15:28:45.317Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"No tiene correo electrónico\",\"timestamp\":\"2025-09-01T15:29:00.524Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Finca Vistahermosa, Palmar, municipio del Páramo\",\"timestamp\":\"2025-09-01T15:29:18.803Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"eps\",\"content\":\"Nueva EPS\",\"timestamp\":\"2025-09-01T15:29:48.651Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"insurance_affiliation_type\",\"content\":\"Subsidiado\",\"timestamp\":\"2025-09-01T15:30:04.290Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"blood_group\",\"content\":\"A+\",\"timestamp\":\"2025-09-01T15:30:25.459Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"marital_status\",\"content\":\"Casado(a)\",\"timestamp\":\"2025-09-01T15:30:43.956Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"new_patient_registration\",\"current_step\":\"new_patient_registration\",\"completed_steps\":[\"document_verification\"],\"pending_questions\":[\"name\",\"document_type\",\"birth_date\",\"phone\",\"address\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:26:43', 'active'),
(27, '', 'session_20250109_appointment', '{\"metadata\":{\"start_time\":\"2025-09-01T15:28:10.842Z\",\"last_activity\":\"2025-09-01T15:30:35.495Z\",\"total_interactions\":8,\"conversation_quality\":\"initiated\",\"memory_size\":1532,\"last_optimized\":\"2025-09-23T15:31:33.401Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:28:10.842Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"282720707\",\"timestamp\":\"2025-09-01T15:28:32.359Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Argenil Quintero Quintero\",\"timestamp\":\"2025-09-01T15:29:10.817Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Cédula de Ciudadanía\",\"timestamp\":\"2025-09-01T15:29:29.100Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"1968-03-07\",\"timestamp\":\"2025-09-01T15:29:46.349Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3213105532\",\"timestamp\":\"2025-09-01T15:30:04.359Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"nomail@biosanarcall.site\",\"timestamp\":\"2025-09-01T15:30:14.932Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Calle 27 número 939\",\"timestamp\":\"2025-09-01T15:30:35.495Z\",\"validated\":true}],\"conversation_context\":{\"current_step\":\"new_patient_registration\",\"completed_steps\":[\"document_verification\"],\"pending_questions\":[\"patient_registration\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:28:10', 'active'),
(28, '', 'session_20250108_ecografia', '{\"metadata\":{\"start_time\":\"2025-09-01T15:28:14.096Z\",\"last_activity\":\"2025-09-01T15:30:23.343Z\",\"total_interactions\":8,\"conversation_quality\":\"initiated\",\"memory_size\":1580,\"last_optimized\":\"2025-09-23T15:31:33.402Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:28:14.096Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"10463969909\",\"timestamp\":\"2025-09-01T15:28:42.670Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Francisco de Jesús\",\"timestamp\":\"2025-09-01T15:29:14.155Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Cédula de Ciudadanía\",\"timestamp\":\"2025-09-01T15:29:26.990Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"birth_date\",\"content\":\"1986-08-13\",\"timestamp\":\"2025-09-01T15:29:42.572Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"phone\",\"content\":\"3012058003\",\"timestamp\":\"2025-09-01T15:30:00.429Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"email\",\"content\":\"nomail@biosanarcall.site\",\"timestamp\":\"2025-09-01T15:30:10.512Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"address\",\"content\":\"Vereda La Cantera del municipio de Curitiba\",\"timestamp\":\"2025-09-01T15:30:23.343Z\",\"validated\":true}],\"conversation_context\":{\"current_step\":\"new_patient_registration\",\"completed_steps\":[\"document_collection\"],\"pending_questions\":[\"name\",\"document_type\",\"birth_date\",\"phone\",\"address\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:28:14', 'active'),
(29, 'PT2208460', 'session_20250108_PT2208460', '{\"metadata\":{\"start_time\":\"2025-09-01T15:29:10.684Z\",\"last_activity\":\"2025-09-01T15:30:47.610Z\",\"total_interactions\":5,\"conversation_quality\":\"initiated\",\"memory_size\":1220,\"last_optimized\":\"2025-09-23T15:31:33.404Z\"},\"patient_info\":{\"document\":\"PT2208460\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:29:10.684Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"PT2208460\",\"timestamp\":\"2025-09-01T15:29:14.323Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Liz Melis del Valle Díaz\",\"timestamp\":\"2025-09-01T15:29:52.290Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Pasaporte\",\"timestamp\":\"2025-09-01T15:30:35.835Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document_type\",\"content\":\"Otro - Permiso de Protección Temporal\",\"timestamp\":\"2025-09-01T15:30:47.610Z\",\"validated\":true}],\"conversation_context\":{\"current_step\":\"new_patient_registration\",\"completed_steps\":[\"document_verification\"],\"pending_questions\":[\"patient_registration\",\"appointment_scheduling\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:29:10', 'active'),
(30, '', 'session_20250108_ultrasound', '{\"metadata\":{\"start_time\":\"2025-09-01T15:29:41.917Z\",\"last_activity\":\"2025-09-01T15:30:42.169Z\",\"total_interactions\":3,\"conversation_quality\":\"initiated\",\"memory_size\":950,\"last_optimized\":\"2025-09-23T15:31:33.405Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:29:41.917Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"document\",\"content\":\"1101074647\",\"timestamp\":\"2025-09-01T15:30:08.796Z\",\"validated\":true},{\"type\":\"answer\",\"field\":\"name\",\"content\":\"Karen Daniela Pérez Sánchez\",\"timestamp\":\"2025-09-01T15:30:42.169Z\",\"validated\":true}],\"conversation_context\":{\"current_step\":\"new_patient_registration\",\"completed_steps\":[\"document_collection\"],\"pending_questions\":[\"name\",\"document_type\",\"birth_date\",\"phone\",\"address\"]}}', '2025-09-23 15:31:33', '2025-09-01 15:29:41', 'active'),
(31, '', 'session_20250108_pediatria', '{\"metadata\":{\"start_time\":\"2025-09-01T15:31:20.534Z\",\"last_activity\":\"2025-09-01T15:31:20.534Z\",\"total_interactions\":1,\"conversation_quality\":\"initiated\",\"memory_size\":656,\"last_optimized\":\"2025-09-23T15:31:33.406Z\"},\"patient_info\":{\"document\":\"\",\"verified\":false},\"collected_data\":{\"preferences\":{},\"medical_info\":{},\"personal_info\":{},\"appointment_info\":{}},\"interaction_history\":[{\"type\":\"action\",\"content\":\"Conversación iniciada para appointment_scheduling\",\"timestamp\":\"2025-09-01T15:31:20.534Z\",\"validated\":true}],\"conversation_context\":{\"purpose\":\"appointment_scheduling\",\"current_step\":\"initialization\",\"completed_steps\":[],\"pending_questions\":[]}}', '2025-09-23 15:31:33', '2025-09-01 15:31:20', 'active'),
(32, 'test_session_123', 'test_session_123', '{\"session_id\":\"test_session_123\",\"conversation_context\":{\"user_preferences\":{},\"topics_discussed\":[],\"purpose\":\"test\",\"medical_context\":{\"patient_references\":[],\"discussed_symptoms\":[],\"mentioned_procedures\":[],\"doctor_instructions\":[],\"urgency_level\":\"low\",\"medical_specialty\":[]},\"voice_preferences\":{\"language\":\"es\",\"tone\":\"professional\",\"speed\":1,\"voice_model\":\"elevenlabs\",\"emotional_state\":\"neutral\"},\"performance_metrics\":{\"response_times\":[],\"interaction_quality\":[],\"user_satisfaction\":[]}},\"collected_data\":{\"personal_info\":{},\"medical_info\":{},\"appointment_info\":{}},\"patient_info\":{},\"interaction_history\":[],\"metadata\":{\"created_at\":\"2025-09-22T11:48:15.374Z\",\"last_activity\":\"2025-09-22T11:48:15.374Z\",\"total_interactions\":0,\"session_duration\":0,\"memory_size\":954,\"compression_ratio\":1,\"last_optimized\":\"2025-09-23T15:31:33.408Z\",\"start_time\":\"2025-09-22T11:48:15.374Z\"},\"cache\":{\"frequent_queries\":{},\"user_patterns\":{},\"quick_access\":{}}}', '2025-09-23 15:31:33', '2025-09-22 11:48:15', 'active');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `daily_assignment_config`
--

CREATE TABLE `daily_assignment_config` (
  `id` int(10) UNSIGNED NOT NULL,
  `specialty_id` int(10) UNSIGNED NOT NULL,
  `auto_assignment_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `max_daily_assignments` int(10) UNSIGNED DEFAULT NULL,
  `assignment_start_time` time NOT NULL DEFAULT '08:00:00',
  `assignment_end_time` time NOT NULL DEFAULT '17:00:00',
  `buffer_slots` int(10) UNSIGNED NOT NULL DEFAULT 2,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `daily_assignment_config`
--

INSERT INTO `daily_assignment_config` (`id`, `specialty_id`, `auto_assignment_enabled`, `max_daily_assignments`, `assignment_start_time`, `assignment_end_time`, `buffer_slots`, `created_at`, `updated_at`) VALUES
(1, 3, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(2, 10, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(3, 6, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(4, 5, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(5, 12, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(6, 13, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(7, 1, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(8, 9, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(9, 11, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(10, 14, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(11, 8, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05'),
(12, 7, 1, 10, '08:00:00', '17:00:00', 2, '2025-09-30 02:04:05', '2025-09-30 02:04:05');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `daily_assignment_queue`
--

CREATE TABLE `daily_assignment_queue` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `specialty_id` int(10) UNSIGNED NOT NULL,
  `doctor_id` int(10) UNSIGNED DEFAULT NULL,
  `location_id` int(10) UNSIGNED DEFAULT NULL,
  `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `requested_date` date DEFAULT NULL,
  `status` enum('waiting','assigned','cancelled','expired') NOT NULL DEFAULT 'waiting',
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `assigned_at` datetime DEFAULT NULL,
  `assigned_by_user_id` int(10) UNSIGNED DEFAULT NULL,
  `appointment_id` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `demand_patterns`
--

CREATE TABLE `demand_patterns` (
  `id` int(10) UNSIGNED NOT NULL,
  `day_of_week` tinyint(4) NOT NULL COMMENT '1=Lunes, 7=Domingo',
  `hour_of_day` tinyint(4) NOT NULL COMMENT '0-23',
  `doctor_id` bigint(20) UNSIGNED DEFAULT NULL,
  `specialty_id` int(10) UNSIGNED DEFAULT NULL,
  `location_id` int(10) UNSIGNED DEFAULT NULL,
  `avg_utilization` decimal(5,2) NOT NULL DEFAULT 0.00,
  `demand_score` decimal(5,2) NOT NULL DEFAULT 0.00,
  `sample_size` int(11) NOT NULL DEFAULT 0,
  `last_calculated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `disability_types`
--

CREATE TABLE `disability_types` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `disability_types`
--

INSERT INTO `disability_types` (`id`, `name`) VALUES
(1, 'Visual'),
(2, 'Auditiva'),
(3, 'Motor'),
(4, 'Cognitiva'),
(5, 'Psicosocial'),
(6, 'Otra'),
(19, 'Visual'),
(20, 'Auditiva'),
(21, 'Motor'),
(22, 'Cognitiva'),
(23, 'Psicosocial'),
(24, 'Otra'),
(25, 'Visual'),
(26, 'Auditiva'),
(27, 'Motor'),
(28, 'Cognitiva'),
(29, 'Psicosocial'),
(30, 'Otra'),
(31, 'Visual'),
(32, 'Auditiva'),
(33, 'Motor'),
(34, 'Cognitiva'),
(35, 'Psicosocial'),
(36, 'Otra');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `doctors`
--

CREATE TABLE `doctors` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `license_number` varchar(50) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `doctors`
--

INSERT INTO `doctors` (`id`, `name`, `email`, `phone`, `license_number`, `active`, `created_at`) VALUES
(1, 'Dr. Rolando romero', 'dr.demo@example.com', '3010001111', 'LIC-12345', 1, '2025-08-08 21:48:13'),
(4, 'Oscar Calderon', 'oscarandrescalderon19@gmail.com', '+573143131382', 'm012323', 1, '2025-08-11 20:26:26'),
(5, 'Dra. Yesika Andrea fiallo', 'lider.callcenterbiossanar@gmail.com', '3145464569', 'm000', 1, '2025-08-27 10:55:32'),
(6, 'Ana Teresa Escobar', 'lider.callcenterbiossanar@gmail.com', '3142564784', 'm1214', 1, '2025-08-27 10:56:27'),
(7, 'Dra. Valentina Abaunza Ballesteros', 'lider.callcenterbiossanar@gmail.com', '3175464789', 'mo1321', 1, '2025-08-27 10:57:38'),
(8, 'Dr. Carlos Rafael Almira', 'lider.callcenterbiossanar@gmail.com', '3175245789', 'mc123456', 1, '2025-08-27 10:58:15'),
(10, 'Dra. Claudia Sierra', 'lider.callcenterbiossanar@gmail.com', '3124578912', 'mc12345', 1, '2025-08-27 11:00:41'),
(11, 'Dr. Andres Romero', 'lider.callcenterbiossanar@gmail.com', '312457812', 'mc1234', 1, '2025-08-27 16:01:09'),
(13, 'Dra. Gina Cristina Castillo Gonzalez', 'lider.callcenterbiossanar@gmail.com', '3212456789', 'mc12344', 1, '2025-08-27 16:05:15'),
(14, 'Dr. Alexander Rugeles', 'lider.callcenterbiossanar@gmail.com', '31423564712', 'MP14785', 1, '2025-08-27 16:25:44'),
(15, 'Dr. Erwin Alirio Vargas Ariza', 'lider.callcenterbiossanar@gmail.com', '3143154785', 'MC12457', 1, '2025-08-27 16:37:48'),
(16, 'Dr. Calixto Escorcia Angulo', 'lider.callcenterbiossanar@gmail.com', '3145415471', 'mp1234', 1, '2025-08-27 21:15:34'),
(17, 'Dr. Nestor Motta', 'lider.callcenterbiossanar@gmail.com', '3145245678', 'mp12459', 1, '2025-08-27 21:15:59'),
(19, 'Dra. Laura Julia Podeva', 'demo@demo.com', '+57123456789', 'MP172546', 1, '2025-10-06 14:42:44'),
(20, 'Dra. Luis Fernada Garrido Castillo', 'demo@demo.com', '+57123456789', 'MP123226', 1, '2025-10-06 14:44:58');

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `doctor_dashboard_stats`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `doctor_dashboard_stats` (
`doctor_id` bigint(20) unsigned
,`doctor_name` varchar(120)
,`patients_seen_month` bigint(21)
,`total_appointments_month` bigint(21)
,`completed_appointments` bigint(21)
,`appointments_today` bigint(21)
,`pending_today` bigint(21)
,`avg_appointment_duration` decimal(9,4)
);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `doctor_locations`
--

CREATE TABLE `doctor_locations` (
  `doctor_id` bigint(20) UNSIGNED NOT NULL,
  `location_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `doctor_locations`
--

INSERT INTO `doctor_locations` (`doctor_id`, `location_id`) VALUES
(1, 1),
(4, 1),
(4, 3),
(5, 1),
(5, 3),
(6, 1),
(7, 1),
(7, 3),
(8, 1),
(10, 1),
(10, 3),
(11, 1),
(11, 3),
(13, 1),
(13, 3),
(14, 1),
(15, 1),
(15, 3),
(16, 3),
(17, 1),
(17, 3),
(19, 1),
(20, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `doctor_service_prices`
--

CREATE TABLE `doctor_service_prices` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `doctor_id` int(10) UNSIGNED NOT NULL,
  `service_id` int(10) UNSIGNED NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'COP',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `doctor_specialties`
--

CREATE TABLE `doctor_specialties` (
  `doctor_id` bigint(20) UNSIGNED NOT NULL,
  `specialty_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `doctor_specialties`
--

INSERT INTO `doctor_specialties` (`doctor_id`, `specialty_id`) VALUES
(1, 9),
(4, 12),
(5, 8),
(6, 1),
(7, 7),
(8, 12),
(10, 12),
(11, 6),
(13, 11),
(14, 13),
(15, 10),
(16, 1),
(17, 12),
(19, 5),
(20, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `document_types`
--

CREATE TABLE `document_types` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `document_types`
--

INSERT INTO `document_types` (`id`, `code`, `name`, `created_at`) VALUES
(1, 'CC', 'Cédula de Ciudadanía', '2025-08-21 16:52:35'),
(2, 'CE', 'Cédula de Extranjería', '2025-08-21 16:52:35'),
(3, 'TI', 'Tarjeta de Identidad', '2025-08-21 16:52:35'),
(4, 'PS', 'Pasaporte', '2025-08-21 16:52:35'),
(5, 'NIT', 'NIT', '2025-08-21 16:52:35'),
(6, 'OT', 'Otro', '2025-08-21 16:52:35'),
(19, 'CC', 'Cédula de Ciudadanía', '2025-08-29 21:23:31'),
(20, 'CE', 'Cédula de Extranjería', '2025-08-29 21:23:31'),
(21, 'TI', 'Tarjeta de Identidad', '2025-08-29 21:23:31'),
(22, 'PS', 'Pasaporte', '2025-08-29 21:23:31'),
(23, 'NIT', 'NIT', '2025-08-29 21:23:31'),
(24, 'OT', 'Otro', '2025-08-29 21:23:31'),
(25, 'CC', 'Cédula de Ciudadanía', '2025-08-29 21:26:08'),
(26, 'CE', 'Cédula de Extranjería', '2025-08-29 21:26:08'),
(27, 'TI', 'Tarjeta de Identidad', '2025-08-29 21:26:08'),
(28, 'PS', 'Pasaporte', '2025-08-29 21:26:08'),
(29, 'NIT', 'NIT', '2025-08-29 21:26:08'),
(30, 'OT', 'Otro', '2025-08-29 21:26:08'),
(31, 'CC', 'Cédula de Ciudadanía', '2025-08-29 21:26:45'),
(32, 'CE', 'Cédula de Extranjería', '2025-08-29 21:26:45'),
(33, 'TI', 'Tarjeta de Identidad', '2025-08-29 21:26:45'),
(34, 'PS', 'Pasaporte', '2025-08-29 21:26:45'),
(35, 'NIT', 'NIT', '2025-08-29 21:26:45'),
(36, 'OT', 'Otro', '2025-08-29 21:26:45');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `education_levels`
--

CREATE TABLE `education_levels` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `education_levels`
--

INSERT INTO `education_levels` (`id`, `name`) VALUES
(1, 'Sin educación formal'),
(2, 'Básica primaria'),
(3, 'Básica secundaria'),
(4, 'Media/Técnica'),
(5, 'Tecnológica/Profesional'),
(6, 'Posgrado'),
(7, 'Otro'),
(22, 'Sin educación formal'),
(23, 'Básica primaria'),
(24, 'Básica secundaria'),
(25, 'Media/Técnica'),
(26, 'Tecnológica/Profesional'),
(27, 'Posgrado'),
(28, 'Otro'),
(29, 'Sin educación formal'),
(30, 'Básica primaria'),
(31, 'Básica secundaria'),
(32, 'Media/Técnica'),
(33, 'Tecnológica/Profesional'),
(34, 'Posgrado'),
(35, 'Otro'),
(36, 'Sin educación formal'),
(37, 'Básica primaria'),
(38, 'Básica secundaria'),
(39, 'Media/Técnica'),
(40, 'Tecnológica/Profesional'),
(41, 'Posgrado'),
(42, 'Otro');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `elevenlabs_audio`
--

CREATE TABLE `elevenlabs_audio` (
  `id` int(11) NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `full_audio` longtext DEFAULT NULL,
  `file_size_bytes` int(11) DEFAULT 0,
  `duration_secs` int(11) DEFAULT 0,
  `format` varchar(10) DEFAULT 'mp3',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `elevenlabs_conversations`
--

CREATE TABLE `elevenlabs_conversations` (
  `id` int(11) NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `agent_id` varchar(255) NOT NULL,
  `user_id` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'completed',
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `duration_secs` int(11) DEFAULT 0,
  `cost` int(11) DEFAULT 0,
  `transcript_summary` text DEFAULT NULL,
  `call_successful` enum('success','failure','unknown') DEFAULT 'unknown',
  `termination_reason` varchar(255) DEFAULT NULL,
  `full_transcript` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`full_transcript`)),
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `elevenlabs_conversations`
--

INSERT INTO `elevenlabs_conversations` (`id`, `conversation_id`, `agent_id`, `user_id`, `status`, `start_time`, `end_time`, `duration_secs`, `cost`, `transcript_summary`, `call_successful`, `termination_reason`, `full_transcript`, `metadata`, `created_at`, `updated_at`) VALUES
(1, 'test_conv_12345', 'test_agent_001', 'test_user_789', 'completed', '2024-11-24 17:39:00', '2024-11-24 17:40:00', 0, 0, NULL, 'unknown', '', '[]', '{}', '2025-08-25 18:40:18', '2025-08-25 23:15:52');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `eps`
--

CREATE TABLE `eps` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `code` varchar(25) NOT NULL,
  `affiliation_type` enum('Contributivo','Subsidiado','Especial','Mixto') DEFAULT 'Contributivo' COMMENT 'Tipo de régimen',
  `phone` varchar(20) DEFAULT NULL COMMENT 'Teléfono de atención',
  `email` varchar(255) DEFAULT NULL COMMENT 'Email de contacto',
  `website` varchar(255) DEFAULT NULL COMMENT 'Sitio web',
  `status` enum('active','inactive','Activa','Inactiva','Liquidación') DEFAULT 'active',
  `has_agreement` tinyint(1) NOT NULL DEFAULT 0,
  `agreement_date` date DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `eps`
--

INSERT INTO `eps` (`id`, `name`, `code`, `affiliation_type`, `phone`, `email`, `website`, `status`, `has_agreement`, `agreement_date`, `notes`, `created_at`, `updated_at`) VALUES
(9, 'COOMEVA', '2721', 'Contributivo', '01 8000 113 414', NULL, 'https://www.coomeva.com.co', 'inactive', 1, NULL, 'Activa', '2025-08-11 12:42:09', '2025-10-08 15:59:40'),
(10, 'SINTRAVID', '2720', 'Contributivo', NULL, NULL, NULL, 'inactive', 0, '2024-01-11', 'Activa', '2025-08-11 12:42:44', '2025-10-08 14:32:30'),
(11, 'FUNDACION AVANZAR FOS', '2719', 'Contributivo', NULL, NULL, NULL, 'inactive', 0, '2024-01-02', 'Activa', '2025-08-11 12:43:24', '2025-10-08 14:32:37'),
(12, 'FAMISANAR', '2718', 'Contributivo', '01 8000 423 362', NULL, 'https://www.famisanar.com.co', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:43:58', '2025-10-08 14:31:30'),
(13, 'FOMA FIDUPREVISORA S.A', '2717', 'Contributivo', NULL, NULL, NULL, 'inactive', 0, '2024-01-11', 'Activa', '2025-08-11 12:44:39', '2025-10-08 15:59:58'),
(14, 'NUEVA EPS', '2715', 'Contributivo', '01 8000 123 001', NULL, 'https://www.nuevaeps.com.co', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:45:34', '2025-10-13 14:50:25'),
(15, 'SOUL MEDICAL', '2714', 'Contributivo', NULL, NULL, NULL, 'inactive', 0, '2024-01-11', 'Activa', '2025-08-11 12:46:04', '2025-10-08 16:00:48'),
(16, 'SALUD COOSALUD', '2713', 'Contributivo', '01 8000 410 111', NULL, 'https://www.coosalud.com', 'inactive', 1, '2024-01-11', 'Activa', '2025-08-11 12:46:37', '2025-10-08 14:53:21'),
(18, 'MEDIMAS', '2702', 'Contributivo', '01 8000 110 400', NULL, 'https://www.medimas.com.co', 'inactive', 1, '2024-01-11', 'Activa', '2025-08-11 12:48:39', '2025-10-08 14:46:40'),
(51, 'CAPITAL SALUD', '2716', 'Contributivo', '601 756 7700', NULL, 'https://www.capitalsalud.gov.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:38:56'),
(52, 'SAVIA SALUD', '2712', 'Contributivo', '01 8000 425 325', NULL, 'https://www.saviasalud.com', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:42:00'),
(53, 'SANITAS', '2711', 'Contributivo', '601 651 8888', NULL, 'https://www.sanitas.com.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:42:18'),
(54, 'SALUD TOTAL', '2710', 'Contributivo', '01 8000 116 600', NULL, 'https://www.saludtotal.com.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:42:30'),
(55, 'COMPENSAR', '2709', 'Contributivo', '601 444 4444', NULL, 'https://www.compensar.com', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:47:50'),
(56, 'ALIANSALUD', '2708', 'Contributivo', '01 8000 111 170', NULL, 'https://www.aliansalud.com.co', 'active', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-11 19:53:05'),
(57, 'COMFENALCO VALLE', '2707', 'Contributivo', '602 886 6666', NULL, 'https://www.comfenalcovalle.com.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:39:11'),
(58, 'SURAMERICANA', '2706', 'Contributivo', '01 8000 519 519', NULL, 'https://www.segurossura.com.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:39:54'),
(59, 'CAPITAL SALUD (Subsidiado)', 'SS01', 'Subsidiado', '601 756 7700', NULL, 'https://www.capitalsalud.gov.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:39:02'),
(60, 'COOSALUD (Subsidiado)', 'SS02', 'Subsidiado', '01 8000 410 111', NULL, 'https://www.coosalud.com', 'active', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:32:52'),
(61, 'NUEVA EPS (Subsidiado)', 'SS03', 'Subsidiado', '01 8000 123 001', NULL, 'https://www.nuevaeps.com.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 16:00:26'),
(62, 'MUTUAL SER', 'SS04', 'Subsidiado', '01 8000 127 378', NULL, 'https://www.mutualser.com', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:49:32'),
(63, 'ASMET SALUD', 'SS05', 'Subsidiado', '01 8000 113 414', NULL, 'https://www.asmetsalud.org.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:38:46'),
(64, 'SALUD MIA', 'SS06', 'Subsidiado', NULL, NULL, NULL, 'inactive', 0, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:43:15'),
(65, 'EMDISALUD', 'SS07', 'Subsidiado', NULL, NULL, NULL, 'inactive', 0, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 16:02:23'),
(66, 'MAGISTERIO (FOMAG)', 'RE01', 'Especial', '01 8000 114 818', NULL, 'https://www.fomag.gov.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 16:00:08'),
(67, 'FUERZAS MILITARES', 'RE02', 'Especial', NULL, NULL, NULL, 'inactive', 0, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 16:02:10'),
(68, 'POLICIA NACIONAL', 'RE03', 'Especial', NULL, NULL, NULL, 'inactive', 0, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:45:35'),
(69, 'ECOPETROL', 'RE04', 'Especial', NULL, NULL, NULL, 'inactive', 0, NULL, NULL, '2025-10-04 03:11:42', '2025-10-13 14:49:55'),
(70, 'UNIVERSIDADES PUBLICAS', 'RE05', 'Especial', NULL, NULL, NULL, 'inactive', 0, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:39:48'),
(71, 'CAFESALUD (En liquidación)', '2701', 'Contributivo', NULL, NULL, NULL, 'Liquidación', 0, NULL, NULL, '2025-10-04 03:11:42', '2025-10-04 03:11:42'),
(72, 'SALUDVIDA', '2700', 'Contributivo', '01 8000 113 300', NULL, 'https://www.saludvida.com.co', 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 14:42:24'),
(73, 'PARTICULAR - SIN EPS', '0000', 'Mixto', NULL, NULL, NULL, 'inactive', 1, NULL, NULL, '2025-10-04 03:11:42', '2025-10-08 16:00:34');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `eps_agreements`
--

CREATE TABLE `eps_agreements` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `eps_id` int(10) UNSIGNED NOT NULL,
  `location_id` int(10) UNSIGNED DEFAULT NULL,
  `specialty_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `agreement_date` date DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `eps_authorization_audit`
--

CREATE TABLE `eps_authorization_audit` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `authorization_id` bigint(20) UNSIGNED NOT NULL,
  `action` enum('created','updated','deleted') NOT NULL,
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_data`)),
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_data`)),
  `changed_by` int(10) UNSIGNED DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `eps_authorization_audit`
--

INSERT INTO `eps_authorization_audit` (`id`, `authorization_id`, `action`, `old_data`, `new_data`, `changed_by`, `changed_at`) VALUES
(1, 11, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 10, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-11\"}', NULL, '2025-10-11 18:34:35'),
(2, 12, 'created', NULL, '{\"eps_id\": 56, \"specialty_id\": 3, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-11\"}', NULL, '2025-10-11 19:53:44'),
(3, 13, 'created', NULL, '{\"eps_id\": 56, \"specialty_id\": 10, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-11\"}', NULL, '2025-10-11 19:53:44'),
(4, 14, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 3, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01'),
(5, 15, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 6, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01'),
(6, 16, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 14, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01'),
(7, 17, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 12, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01'),
(8, 18, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 13, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01'),
(9, 19, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 9, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01'),
(10, 20, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 11, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01'),
(11, 21, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 5, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01'),
(12, 22, 'created', NULL, '{\"eps_id\": 14, \"specialty_id\": 7, \"location_id\": 1, \"authorized\": 1, \"authorization_date\": \"2025-10-13\"}', NULL, '2025-10-13 14:51:01');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `eps_specialty_location_authorizations`
--

CREATE TABLE `eps_specialty_location_authorizations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `eps_id` int(10) UNSIGNED NOT NULL COMMENT 'ID de la EPS autorizada',
  `specialty_id` int(10) UNSIGNED NOT NULL COMMENT 'ID de la especialidad autorizada',
  `location_id` int(10) UNSIGNED NOT NULL COMMENT 'ID de la sede donde se autoriza',
  `authorized` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Si está actualmente autorizado',
  `authorization_date` date DEFAULT NULL COMMENT 'Fecha de inicio de la autorización',
  `expiration_date` date DEFAULT NULL COMMENT 'Fecha de expiración (opcional)',
  `max_monthly_appointments` int(10) UNSIGNED DEFAULT NULL COMMENT 'Cupo máximo mensual (opcional)',
  `copay_percentage` decimal(5,2) DEFAULT NULL COMMENT 'Porcentaje de copago si aplica',
  `requires_prior_authorization` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Si requiere autorización previa',
  `notes` text DEFAULT NULL COMMENT 'Notas adicionales sobre la autorización',
  `created_by` int(10) UNSIGNED DEFAULT NULL COMMENT 'Usuario que creó la autorización',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Autorizaciones de EPS por especialidad y sede';

--
-- Volcado de datos para la tabla `eps_specialty_location_authorizations`
--

INSERT INTO `eps_specialty_location_authorizations` (`id`, `eps_id`, `specialty_id`, `location_id`, `authorized`, `authorization_date`, `expiration_date`, `max_monthly_appointments`, `copay_percentage`, `requires_prior_authorization`, `notes`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 12, 3, 1, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Convenio inicial - Cardiología', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(2, 12, 5, 1, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Convenio inicial - Odontología', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(3, 12, 1, 1, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Convenio inicial - Medicina General', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(4, 12, 3, 3, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Convenio inicial - Cardiología', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(5, 12, 5, 3, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Convenio inicial - Odontología', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(6, 12, 1, 3, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Convenio inicial - Medicina General', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(7, 14, 1, 1, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Medicina General autorizada', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(8, 14, 8, 1, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Pediatría autorizada', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(10, 60, 1, 3, 1, '2024-01-01', NULL, NULL, NULL, 0, 'Medicina General - Régimen Subsidiado', NULL, '2025-10-11 18:18:03', '2025-10-11 18:18:03'),
(11, 14, 10, 1, 1, '2025-10-11', NULL, NULL, NULL, 0, 'Nueva autorización para Dermatología - Nueva EPS', NULL, '2025-10-11 18:34:35', '2025-10-11 18:34:35'),
(12, 56, 3, 1, 1, '2025-10-11', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-11 19:53:44', '2025-10-11 19:53:44'),
(13, 56, 10, 1, 1, '2025-10-11', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-11 19:53:44', '2025-10-11 19:53:44'),
(14, 14, 3, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01'),
(15, 14, 6, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01'),
(16, 14, 14, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01'),
(17, 14, 12, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01'),
(18, 14, 13, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01'),
(19, 14, 9, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01'),
(20, 14, 11, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01'),
(21, 14, 5, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01'),
(22, 14, 7, 1, 1, '2025-10-13', NULL, NULL, NULL, 0, 'Autorización creada desde la interfaz de gestión', NULL, '2025-10-13 14:51:01', '2025-10-13 14:51:01');

--
-- Disparadores `eps_specialty_location_authorizations`
--
DELIMITER $$
CREATE TRIGGER `trg_eps_auth_after_insert` AFTER INSERT ON `eps_specialty_location_authorizations` FOR EACH ROW BEGIN
  INSERT INTO eps_authorization_audit (authorization_id, action, new_data)
  VALUES (NEW.id, 'created', JSON_OBJECT(
    'eps_id', NEW.eps_id,
    'specialty_id', NEW.specialty_id,
    'location_id', NEW.location_id,
    'authorized', NEW.authorized,
    'authorization_date', NEW.authorization_date
  ))$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_eps_auth_after_update` AFTER UPDATE ON `eps_specialty_location_authorizations` FOR EACH ROW BEGIN
  INSERT INTO eps_authorization_audit (authorization_id, action, old_data, new_data)
  VALUES (NEW.id, 'updated', 
    JSON_OBJECT(
      'eps_id', OLD.eps_id,
      'specialty_id', OLD.specialty_id,
      'location_id', OLD.location_id,
      'authorized', OLD.authorized,
      'authorization_date', OLD.authorization_date
    ),
    JSON_OBJECT(
      'eps_id', NEW.eps_id,
      'specialty_id', NEW.specialty_id,
      'location_id', NEW.location_id,
      'authorized', NEW.authorized,
      'authorization_date', NEW.authorization_date
    )
  )$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `feriados`
--

CREATE TABLE `feriados` (
  `id` int(10) UNSIGNED NOT NULL,
  `fecha` date NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `tipo` enum('nacional','regional','local') NOT NULL DEFAULT 'nacional',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `feriados`
--

INSERT INTO `feriados` (`id`, `fecha`, `nombre`, `tipo`, `activo`, `created_at`) VALUES
(1, '2025-01-01', 'Año Nuevo', 'nacional', 1, '2025-08-29 16:14:23'),
(2, '2025-01-06', 'Día de los Reyes Magos', 'nacional', 1, '2025-08-29 16:14:23'),
(3, '2025-03-24', 'Día de San José', 'nacional', 1, '2025-08-29 16:14:23'),
(4, '2025-04-13', 'Domingo de Ramos', 'nacional', 1, '2025-08-29 16:14:23'),
(5, '2025-04-17', 'Jueves Santo', 'nacional', 1, '2025-08-29 16:14:23'),
(6, '2025-04-18', 'Viernes Santo', 'nacional', 1, '2025-08-29 16:14:23'),
(7, '2025-05-01', 'Día del Trabajo', 'nacional', 1, '2025-08-29 16:14:23'),
(8, '2025-06-02', 'Ascensión del Señor', 'nacional', 1, '2025-08-29 16:14:23'),
(9, '2025-06-23', 'Corpus Christi', 'nacional', 1, '2025-08-29 16:14:23'),
(10, '2025-06-30', 'Sagrado Corazón de Jesús', 'nacional', 1, '2025-08-29 16:14:23'),
(11, '2025-07-20', 'Día de la Independencia', 'nacional', 1, '2025-08-29 16:14:23'),
(12, '2025-08-07', 'Batalla de Boyacá', 'nacional', 1, '2025-08-29 16:14:23'),
(13, '2025-08-18', 'Asunción de la Virgen', 'nacional', 1, '2025-08-29 16:14:23'),
(14, '2025-10-13', 'Día de la Raza', 'nacional', 1, '2025-08-29 16:14:23'),
(15, '2025-11-03', 'Todos los Santos', 'nacional', 1, '2025-08-29 16:14:23'),
(16, '2025-11-17', 'Independencia de Cartagena', 'nacional', 1, '2025-08-29 16:14:23'),
(17, '2025-12-08', 'Inmaculada Concepción', 'nacional', 1, '2025-08-29 16:14:23'),
(18, '2025-12-25', 'Navidad', 'nacional', 1, '2025-08-29 16:14:23');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `holidays`
--

CREATE TABLE `holidays` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `date` date NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('national','regional','local','personal') NOT NULL DEFAULT 'national',
  `location_id` int(10) UNSIGNED DEFAULT NULL,
  `is_recurring` tinyint(1) NOT NULL DEFAULT 0,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `lab_orders`
--

CREATE TABLE `lab_orders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `doctor_id` bigint(20) UNSIGNED NOT NULL,
  `medical_record_id` bigint(20) UNSIGNED DEFAULT NULL,
  `order_date` datetime DEFAULT current_timestamp(),
  `priority` enum('routine','urgent','stat') DEFAULT 'routine',
  `clinical_indication` text DEFAULT NULL COMMENT 'Indicación clínica',
  `fasting_required` tinyint(1) DEFAULT 0,
  `special_instructions` text DEFAULT NULL,
  `status` enum('ordered','collected','processing','completed','cancelled') DEFAULT 'ordered',
  `collection_date` datetime DEFAULT NULL,
  `completion_date` datetime DEFAULT NULL,
  `total_tests` int(11) DEFAULT 0,
  `external_lab` varchar(200) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `lab_order_tests`
--

CREATE TABLE `lab_order_tests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `lab_order_id` bigint(20) UNSIGNED NOT NULL,
  `lab_test_id` int(10) UNSIGNED NOT NULL,
  `status` enum('ordered','collected','processing','completed','cancelled') DEFAULT 'ordered',
  `collection_method` varchar(100) DEFAULT NULL,
  `special_handling` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Disparadores `lab_order_tests`
--
DELIMITER $$
CREATE TRIGGER `tr_update_lab_order_count` AFTER INSERT ON `lab_order_tests` FOR EACH ROW BEGIN
    UPDATE lab_orders 
    SET total_tests = (
        SELECT COUNT(*) 
        FROM lab_order_tests 
        WHERE lab_order_id = NEW.lab_order_id
    )
    WHERE id = NEW.lab_order_id$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `lab_results`
--

CREATE TABLE `lab_results` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `lab_order_test_id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `result_value` varchar(200) DEFAULT NULL,
  `result_numeric` decimal(12,4) DEFAULT NULL,
  `reference_range` varchar(100) DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL,
  `abnormal_flag` enum('normal','high','low','critical_high','critical_low','abnormal') DEFAULT 'normal',
  `result_date` datetime DEFAULT current_timestamp(),
  `reviewed_by_doctor` tinyint(1) DEFAULT 0,
  `reviewed_date` datetime DEFAULT NULL,
  `doctor_comments` text DEFAULT NULL,
  `lab_comments` text DEFAULT NULL,
  `critical_result` tinyint(1) DEFAULT 0,
  `notification_sent` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `lab_tests`
--

CREATE TABLE `lab_tests` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(200) NOT NULL,
  `category` varchar(100) DEFAULT NULL COMMENT 'Química sanguínea, Hematología, etc.',
  `sample_type` varchar(50) DEFAULT NULL COMMENT 'Sangre, Orina, Heces, etc.',
  `normal_range_min` decimal(10,3) DEFAULT NULL,
  `normal_range_max` decimal(10,3) DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL COMMENT 'mg/dl, mmol/L, etc.',
  `preparation_instructions` text DEFAULT NULL,
  `turnaround_time_hours` int(11) DEFAULT 24,
  `active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `lab_tests`
--

INSERT INTO `lab_tests` (`id`, `code`, `name`, `category`, `sample_type`, `normal_range_min`, `normal_range_max`, `unit`, `preparation_instructions`, `turnaround_time_hours`, `active`) VALUES
(1, 'CBC', 'Hemograma completo', 'Hematología', 'Sangre', NULL, NULL, 'células/μL', NULL, 24, 1),
(2, 'GLU', 'Glucosa', 'Química sanguínea', 'Sangre', NULL, NULL, 'mg/dL', NULL, 24, 1),
(3, 'CREA', 'Creatinina', 'Química sanguínea', 'Sangre', NULL, NULL, 'mg/dL', NULL, 24, 1),
(4, 'BUN', 'Nitrógeno ureico', 'Química sanguínea', 'Sangre', NULL, NULL, 'mg/dL', NULL, 24, 1),
(5, 'CHOL', 'Colesterol total', 'Perfil lipídico', 'Sangre', NULL, NULL, 'mg/dL', NULL, 24, 1),
(6, 'HDL', 'Colesterol HDL', 'Perfil lipídico', 'Sangre', NULL, NULL, 'mg/dL', NULL, 24, 1),
(7, 'LDL', 'Colesterol LDL', 'Perfil lipídico', 'Sangre', NULL, NULL, 'mg/dL', NULL, 24, 1),
(8, 'TG', 'Triglicéridos', 'Perfil lipídico', 'Sangre', NULL, NULL, 'mg/dL', NULL, 24, 1),
(9, 'TSH', 'Hormona estimulante tiroides', 'Endocrinología', 'Sangre', NULL, NULL, 'mIU/L', NULL, 24, 1),
(10, 'HBA1C', 'Hemoglobina glicosilada', 'Diabetes', 'Sangre', NULL, NULL, '%', NULL, 24, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `locations`
--

CREATE TABLE `locations` (
  `id` int(10) UNSIGNED NOT NULL,
  `municipality_id` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `address` varchar(200) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `type` varchar(100) NOT NULL DEFAULT 'Sucursal',
  `status` enum('Activa','En Mantenimiento','Inactiva') NOT NULL DEFAULT 'Activa',
  `capacity` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `current_patients` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `hours` varchar(150) DEFAULT NULL,
  `emergency_hours` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `locations`
--

INSERT INTO `locations` (`id`, `municipality_id`, `name`, `address`, `phone`, `type`, `status`, `capacity`, `current_patients`, `hours`, `emergency_hours`, `created_at`) VALUES
(1, NULL, 'Sede biosanar san gil', 'Cra. 9 #10-29, San Gil, Santander', ' 6076911308', 'Sucursal', 'Activa', 600, 0, 'Lunes a Viernes de 7am a 6pm', '24/7', '2025-08-08 21:48:04'),
(3, 14, 'Sede Biosanar Socorro', 'Calle 12 #13-31, Socorro, Santander', '77249700', 'Sucursal', 'Activa', 400, 0, 'lunes a viernes 7:00 am a 6:00 pm', NULL, '2025-08-11 13:02:40');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `location_specialties`
--

CREATE TABLE `location_specialties` (
  `location_id` int(10) UNSIGNED NOT NULL,
  `specialty_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `location_specialties`
--

INSERT INTO `location_specialties` (`location_id`, `specialty_id`) VALUES
(1, 1),
(1, 5),
(1, 6),
(1, 7),
(1, 8),
(1, 9),
(1, 10),
(1, 11),
(1, 12),
(3, 1),
(3, 3),
(3, 5),
(3, 6),
(3, 7),
(3, 8),
(3, 9),
(3, 10),
(3, 11),
(3, 12);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `location_types`
--

CREATE TABLE `location_types` (
  `id` smallint(5) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `location_types`
--

INSERT INTO `location_types` (`id`, `name`, `status`) VALUES
(2, 'Sucursal', 'active'),
(221, 'Sede Principal', 'active'),
(222, 'Consultorio', 'active'),
(223, 'Centro de Especialidades', 'active');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `marital_statuses`
--

CREATE TABLE `marital_statuses` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `marital_statuses`
--

INSERT INTO `marital_statuses` (`id`, `name`) VALUES
(1, 'Soltero(a)'),
(2, 'Casado(a)'),
(3, 'Unión libre'),
(4, 'Separado(a)'),
(5, 'Viudo(a)'),
(6, 'Otro'),
(19, 'Soltero(a)'),
(20, 'Casado(a)'),
(21, 'Unión libre'),
(22, 'Separado(a)'),
(23, 'Viudo(a)'),
(24, 'Otro'),
(25, 'Soltero(a)'),
(26, 'Casado(a)'),
(27, 'Unión libre'),
(28, 'Separado(a)'),
(29, 'Viudo(a)'),
(30, 'Otro'),
(31, 'Soltero(a)'),
(32, 'Casado(a)'),
(33, 'Unión libre'),
(34, 'Separado(a)'),
(35, 'Viudo(a)'),
(36, 'Otro');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medical_diagnoses`
--

CREATE TABLE `medical_diagnoses` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(10) NOT NULL COMMENT 'Código CIE-10',
  `description` varchar(300) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `severity_level` enum('leve','moderado','severo','critico') DEFAULT NULL,
  `is_chronic` tinyint(1) DEFAULT 0,
  `active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de diagnósticos médicos CIE-10';

--
-- Volcado de datos para la tabla `medical_diagnoses`
--

INSERT INTO `medical_diagnoses` (`id`, `code`, `description`, `category`, `severity_level`, `is_chronic`, `active`) VALUES
(1, 'Z00.0', 'Examen médico general del adulto', 'Prevención', NULL, 0, 1),
(2, 'K59.0', 'Estreñimiento', 'Digestivo', NULL, 0, 1),
(3, 'I10', 'Hipertensión esencial', 'Cardiovascular', NULL, 1, 1),
(4, 'E11.9', 'Diabetes mellitus tipo 2 sin complicaciones', 'Endocrino', NULL, 1, 1),
(5, 'J06.9', 'Infección aguda de las vías respiratorias superiores', 'Respiratorio', NULL, 0, 1),
(6, 'M79.3', 'Dolor no especificado', 'Musculoesquelético', NULL, 0, 1),
(7, 'R50.9', 'Fiebre no especificada', 'Síntomas generales', NULL, 0, 1),
(8, 'N39.0', 'Infección de las vías urinarias', 'Genitourinario', NULL, 0, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medical_records`
--

CREATE TABLE `medical_records` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `appointment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `doctor_id` bigint(20) UNSIGNED NOT NULL,
  `record_type` enum('consulta','procedimiento','diagnostico','seguimiento','emergencia') NOT NULL DEFAULT 'consulta',
  `chief_complaint` text DEFAULT NULL COMMENT 'Motivo de consulta principal',
  `history_present_illness` text DEFAULT NULL COMMENT 'Historia de la enfermedad actual',
  `physical_examination` text DEFAULT NULL COMMENT 'Examen físico',
  `diagnosis_primary` text DEFAULT NULL COMMENT 'Diagnóstico principal',
  `diagnosis_secondary` text DEFAULT NULL COMMENT 'Diagnósticos secundarios',
  `treatment_plan` text DEFAULT NULL COMMENT 'Plan de tratamiento',
  `vital_signs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Signos vitales {bp, hr, temp, rr, spo2, weight, height}' CHECK (json_valid(`vital_signs`)),
  `medications_prescribed` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Medicamentos prescritos' CHECK (json_valid(`medications_prescribed`)),
  `follow_up_instructions` text DEFAULT NULL COMMENT 'Instrucciones de seguimiento',
  `next_appointment_recommended` date DEFAULT NULL,
  `record_date` datetime NOT NULL DEFAULT current_timestamp(),
  `last_modified` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_confidential` tinyint(1) DEFAULT 0,
  `status` enum('draft','completed','reviewed','archived') DEFAULT 'draft'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registros médicos detallados por consulta';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medical_record_diagnoses`
--

CREATE TABLE `medical_record_diagnoses` (
  `medical_record_id` bigint(20) UNSIGNED NOT NULL,
  `diagnosis_id` int(10) UNSIGNED NOT NULL,
  `is_primary` tinyint(1) DEFAULT 0 COMMENT '1 si es diagnóstico principal',
  `severity` enum('leve','moderado','severo','critico') DEFAULT NULL,
  `status` enum('provisional','confirmado','descartado') DEFAULT 'provisional',
  `onset_date` date DEFAULT NULL,
  `resolved_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medications`
--

CREATE TABLE `medications` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(200) NOT NULL,
  `generic_name` varchar(200) DEFAULT NULL,
  `dosage_form` varchar(100) DEFAULT NULL COMMENT 'Forma farmacéutica: tableta, jarabe, inyección, etc.',
  `strength` varchar(50) DEFAULT NULL COMMENT 'Concentración: 500mg, 250mg/5ml, etc.',
  `therapeutic_class` varchar(100) DEFAULT NULL,
  `contraindications` text DEFAULT NULL,
  `side_effects` text DEFAULT NULL,
  `requires_prescription` tinyint(1) DEFAULT 1,
  `is_controlled` tinyint(1) DEFAULT 0,
  `active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `medications`
--

INSERT INTO `medications` (`id`, `name`, `generic_name`, `dosage_form`, `strength`, `therapeutic_class`, `contraindications`, `side_effects`, `requires_prescription`, `is_controlled`, `active`, `created_at`) VALUES
(1, 'Acetaminofén', 'Paracetamol', 'Tableta', '500mg', 'Analgésico', NULL, NULL, 1, 0, 1, '2025-09-29 03:18:52'),
(2, 'Ibuprofeno', 'Ibuprofeno', 'Tableta', '400mg', 'AINE', NULL, NULL, 1, 0, 1, '2025-09-29 03:18:52'),
(3, 'Omeprazol', 'Omeprazol', 'Cápsula', '20mg', 'Inhibidor bomba protones', NULL, NULL, 1, 0, 1, '2025-09-29 03:18:52'),
(4, 'Metformina', 'Metformina', 'Tableta', '850mg', 'Antidiabético', NULL, NULL, 1, 0, 1, '2025-09-29 03:18:52'),
(5, 'Enalapril', 'Enalapril', 'Tableta', '10mg', 'IECA', NULL, NULL, 1, 0, 1, '2025-09-29 03:18:52'),
(6, 'Loratadina', 'Loratadina', 'Tableta', '10mg', 'Antihistamínico', NULL, NULL, 1, 0, 1, '2025-09-29 03:18:52');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `municipalities`
--

CREATE TABLE `municipalities` (
  `id` int(10) UNSIGNED NOT NULL,
  `zone_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `municipalities`
--

INSERT INTO `municipalities` (`id`, `zone_id`, `name`, `created_at`) VALUES
(4, 3, 'Confines', '2025-08-11 12:20:28'),
(5, 3, 'Contratación', '2025-08-11 12:20:41'),
(6, 3, 'Chima', '2025-08-11 12:20:49'),
(7, 3, 'Gambita', '2025-08-11 12:21:06'),
(8, 3, 'Guapota', '2025-08-11 12:21:20'),
(9, 3, 'Jordan', '2025-08-11 12:21:31'),
(10, 3, 'Oiba', '2025-08-11 12:21:49'),
(11, 3, 'Palmar', '2025-08-11 12:22:01'),
(12, 3, 'San Joaquin', '2025-08-11 12:22:13'),
(13, 3, 'Simacota', '2025-08-11 12:22:24'),
(14, 3, 'Socorro', '2025-08-11 12:22:34'),
(15, 4, 'Aratoca', '2025-08-11 12:22:54'),
(16, 4, 'Barichara', '2025-08-11 12:23:03'),
(17, 4, 'Charala', '2025-08-11 12:23:12'),
(18, 4, 'Curiti', '2025-08-11 12:23:22'),
(19, 4, 'Mogotes', '2025-08-11 12:23:32'),
(20, 4, 'Ocamonte', '2025-08-11 12:23:45'),
(21, 4, 'Pinchote', '2025-08-11 12:24:05'),
(22, 4, 'Valle de san jose', '2025-08-11 12:24:19'),
(23, 4, 'Onzaga', '2025-08-11 12:24:32'),
(24, 4, 'Encino', '2025-08-11 12:24:52'),
(25, 4, 'Paramo', '2025-08-11 12:25:01'),
(26, 4, 'San gil', '2025-08-11 12:25:16');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `patients`
--

CREATE TABLE `patients` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `external_id` varchar(50) DEFAULT NULL,
  `document` varchar(30) NOT NULL,
  `name` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` enum('Masculino','Femenino','Otro','No especificado') NOT NULL DEFAULT 'No especificado',
  `address` varchar(200) DEFAULT NULL,
  `municipality_id` int(10) UNSIGNED DEFAULT NULL,
  `zone_id` int(10) UNSIGNED DEFAULT NULL,
  `insurance_eps_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `document_type_id` int(10) UNSIGNED DEFAULT NULL,
  `insurance_affiliation_type` enum('Contributivo','Subsidiado','Vinculado','Particular','Otro') DEFAULT NULL,
  `blood_group_id` smallint(5) UNSIGNED DEFAULT NULL,
  `population_group_id` int(10) UNSIGNED DEFAULT NULL,
  `education_level_id` int(10) UNSIGNED DEFAULT NULL,
  `marital_status_id` int(10) UNSIGNED DEFAULT NULL,
  `has_disability` tinyint(1) NOT NULL DEFAULT 0,
  `disability_type_id` int(10) UNSIGNED DEFAULT NULL,
  `estrato` tinyint(3) UNSIGNED DEFAULT NULL,
  `phone_alt` varchar(30) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `patients`
--

INSERT INTO `patients` (`id`, `external_id`, `document`, `name`, `phone`, `email`, `birth_date`, `gender`, `address`, `municipality_id`, `zone_id`, `insurance_eps_id`, `status`, `created_at`, `document_type_id`, `insurance_affiliation_type`, `blood_group_id`, `population_group_id`, `education_level_id`, `marital_status_id`, `has_disability`, `disability_type_id`, `estrato`, `phone_alt`, `notes`) VALUES
(1057, NULL, '17265900', 'Dave Bastidas', '04263774021', 'bastidasdaveusa@gmail.com', '1984-04-01', 'Femenino', 'av principal cc valle verde nivel plana zona local 12 baja', 7, 3, 12, 'Activo', '2025-10-08 14:29:33', 1, 'Contributivo', 7, 1, 4, 2, 0, NULL, 2, NULL, 'Diabetico'),
(1058, NULL, '101992365', 'Janet Rocío Bernal Chávez', '3118816985', NULL, NULL, 'No especificado', NULL, NULL, NULL, 9, 'Activo', '2025-10-08 14:32:54', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'Registro vía llamada'),
(1059, NULL, '1001747685', 'María Rosario Polo Guerra', '3182105700', NULL, NULL, 'No especificado', NULL, NULL, NULL, 14, 'Activo', '2025-10-08 14:39:40', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1060, NULL, '91075121', 'Giovanni Efraín Sarmiento', '3154281295', NULL, NULL, 'No especificado', NULL, NULL, NULL, 12, 'Activo', '2025-10-08 17:50:38', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'Motivo: ecografía con estímulo facial'),
(1061, NULL, '1101262970', 'Daniel Felipe Hernández Castro', '3156375573', NULL, NULL, 'No especificado', NULL, NULL, NULL, 12, 'Activo', '2025-10-09 12:16:12', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1062, NULL, '1100960088', 'Andrea Cubides Lozano', '3166661916', NULL, NULL, 'No especificado', NULL, NULL, NULL, 60, 'Activo', '2025-10-09 12:52:51', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'Solicitud de ecografía de transmigencia nuclear'),
(1063, NULL, '1097282060', 'Misael Muñoz Buenahora', '3134166779', NULL, NULL, 'No especificado', NULL, NULL, NULL, 60, 'Activo', '2025-10-09 13:06:06', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1064, NULL, '1002297', 'Vázquez Corzo Luz Dari', '3172381570', NULL, NULL, 'No especificado', NULL, NULL, NULL, 60, 'Activo', '2025-10-09 13:10:38', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1065, NULL, '1100222197', 'Luz Dari Vázquez Corzo', '3154581418', NULL, NULL, 'No especificado', NULL, NULL, NULL, 12, 'Activo', '2025-10-09 14:10:00', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1066, NULL, '37897649', 'Marlene Rondón Zambrano', '3011538379', NULL, NULL, 'No especificado', NULL, NULL, NULL, 12, 'Activo', '2025-10-09 14:56:36', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1067, NULL, '961669', 'Jairo Salinas Portillo', '3224131245', NULL, NULL, 'No especificado', NULL, NULL, NULL, 12, 'Activo', '2025-10-10 13:37:08', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'Registro para cita de medicina general'),
(1068, NULL, '1096', 'Diana Senayde River Goyo', '3104972136', NULL, NULL, 'No especificado', NULL, NULL, NULL, 60, 'Activo', '2025-10-10 13:57:36', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1069, NULL, '91066231', 'Gerardo Quintero', '3103144680', NULL, NULL, 'No especificado', NULL, NULL, NULL, 12, 'Activo', '2025-10-10 16:47:46', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1070, NULL, '51733539', 'Ana Dolores Castillo', '3123298954', NULL, NULL, 'No especificado', NULL, NULL, NULL, 12, 'Activo', '2025-10-10 18:16:53', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'Solicitud de contacto por EPS no disponible'),
(1071, NULL, '63514010', 'Claudia Gisela Valderrama Medina', '3177350388', NULL, NULL, 'No especificado', NULL, NULL, NULL, 60, 'Activo', '2025-10-10 19:03:38', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1072, NULL, '9135712', 'Edgar Villanizal Vizcano', '3144573162', NULL, NULL, 'Femenino', NULL, NULL, NULL, 60, 'Activo', '2025-10-10 19:32:17', 1, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1073, NULL, '5690', 'Ángel Miguel', '3222838332', NULL, NULL, 'No especificado', NULL, NULL, NULL, 60, 'Activo', '2025-10-10 20:41:12', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `patient_allergies`
--

CREATE TABLE `patient_allergies` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `allergen` varchar(200) NOT NULL COMMENT 'Alérgeno (medicamento, alimento, etc.)',
  `allergen_type` enum('medication','food','environmental','chemical','other') NOT NULL,
  `reaction` text DEFAULT NULL COMMENT 'Tipo de reacción',
  `severity` enum('mild','moderate','severe','life_threatening') NOT NULL,
  `onset_date` date DEFAULT NULL,
  `last_reaction_date` date DEFAULT NULL,
  `confirmed_by_doctor` tinyint(1) DEFAULT 0,
  `doctor_id` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('active','resolved','suspected') DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `patient_medical_history`
--

CREATE TABLE `patient_medical_history` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `history_type` enum('personal','family','surgical','social','occupational') NOT NULL,
  `condition` varchar(200) NOT NULL,
  `relation` varchar(50) DEFAULT NULL COMMENT 'Para antecedentes familiares: padre, madre, hermano, etc.',
  `onset_age` int(11) DEFAULT NULL,
  `onset_date` date DEFAULT NULL,
  `severity` enum('mild','moderate','severe') DEFAULT NULL,
  `status` enum('active','resolved','chronic','managed') DEFAULT 'active',
  `treatment_received` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `confirmed_by_doctor` tinyint(1) DEFAULT 0,
  `doctor_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `patient_stats_by_specialty`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `patient_stats_by_specialty` (
`specialty_name` varchar(120)
,`total_patients` bigint(21)
,`total_appointments` bigint(21)
,`completed_appointments` bigint(21)
,`cancelled_appointments` bigint(21)
,`completion_rate` decimal(26,2)
);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__bookmark`
--

CREATE TABLE `pma__bookmark` (
  `id` int(10) UNSIGNED NOT NULL,
  `dbase` varchar(255) NOT NULL DEFAULT '',
  `user` varchar(255) NOT NULL DEFAULT '',
  `label` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '',
  `query` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Bookmarks';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__central_columns`
--

CREATE TABLE `pma__central_columns` (
  `db_name` varchar(64) NOT NULL,
  `col_name` varchar(64) NOT NULL,
  `col_type` varchar(64) NOT NULL,
  `col_length` text DEFAULT NULL,
  `col_collation` varchar(64) NOT NULL,
  `col_isNull` tinyint(1) NOT NULL,
  `col_extra` varchar(255) DEFAULT '',
  `col_default` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Central list of columns';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__column_info`
--

CREATE TABLE `pma__column_info` (
  `id` int(5) UNSIGNED NOT NULL,
  `db_name` varchar(64) NOT NULL DEFAULT '',
  `table_name` varchar(64) NOT NULL DEFAULT '',
  `column_name` varchar(64) NOT NULL DEFAULT '',
  `comment` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '',
  `mimetype` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '',
  `transformation` varchar(255) NOT NULL DEFAULT '',
  `transformation_options` varchar(255) NOT NULL DEFAULT '',
  `input_transformation` varchar(255) NOT NULL DEFAULT '',
  `input_transformation_options` varchar(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Column information for phpMyAdmin';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__designer_settings`
--

CREATE TABLE `pma__designer_settings` (
  `username` varchar(64) NOT NULL,
  `settings_data` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Settings related to Designer';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__export_templates`
--

CREATE TABLE `pma__export_templates` (
  `id` int(5) UNSIGNED NOT NULL,
  `username` varchar(64) NOT NULL,
  `export_type` varchar(10) NOT NULL,
  `template_name` varchar(64) NOT NULL,
  `template_data` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Saved export templates';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__favorite`
--

CREATE TABLE `pma__favorite` (
  `username` varchar(64) NOT NULL,
  `tables` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Favorite tables';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__history`
--

CREATE TABLE `pma__history` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `username` varchar(64) NOT NULL DEFAULT '',
  `db` varchar(64) NOT NULL DEFAULT '',
  `table` varchar(64) NOT NULL DEFAULT '',
  `timevalue` timestamp NOT NULL DEFAULT current_timestamp(),
  `sqlquery` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='SQL history for phpMyAdmin';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__navigationhiding`
--

CREATE TABLE `pma__navigationhiding` (
  `username` varchar(64) NOT NULL,
  `item_name` varchar(64) NOT NULL,
  `item_type` varchar(64) NOT NULL,
  `db_name` varchar(64) NOT NULL,
  `table_name` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Hidden items of navigation tree';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__pdf_pages`
--

CREATE TABLE `pma__pdf_pages` (
  `db_name` varchar(64) NOT NULL DEFAULT '',
  `page_nr` int(10) UNSIGNED NOT NULL,
  `page_descr` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='PDF relation pages for phpMyAdmin';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__recent`
--

CREATE TABLE `pma__recent` (
  `username` varchar(64) NOT NULL,
  `tables` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Recently accessed tables';

--
-- Volcado de datos para la tabla `pma__recent`
--

INSERT INTO `pma__recent` (`username`, `tables`) VALUES
('biosanar_user', '[{\"db\":\"biosanar\",\"table\":\"municipalities\"},{\"db\":\"biosanar\",\"table\":\"zones\"},{\"db\":\"biosanar\",\"table\":\"locations\"},{\"db\":\"biosanar\",\"table\":\"timezones\"},{\"db\":\"biosanar\",\"table\":\"patients\"},{\"db\":\"biosanar\",\"table\":\"eps\"},{\"db\":\"biosanar\",\"table\":\"availabilities\"},{\"db\":\"biosanar\",\"table\":\"availability_distribution\"},{\"db\":\"biosanar\",\"table\":\"appointments\"},{\"db\":\"biosanar\",\"table\":\"appointments_waiting_list\"}]');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__relation`
--

CREATE TABLE `pma__relation` (
  `master_db` varchar(64) NOT NULL DEFAULT '',
  `master_table` varchar(64) NOT NULL DEFAULT '',
  `master_field` varchar(64) NOT NULL DEFAULT '',
  `foreign_db` varchar(64) NOT NULL DEFAULT '',
  `foreign_table` varchar(64) NOT NULL DEFAULT '',
  `foreign_field` varchar(64) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Relation table';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__savedsearches`
--

CREATE TABLE `pma__savedsearches` (
  `id` int(5) UNSIGNED NOT NULL,
  `username` varchar(64) NOT NULL DEFAULT '',
  `db_name` varchar(64) NOT NULL DEFAULT '',
  `search_name` varchar(64) NOT NULL DEFAULT '',
  `search_data` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Saved searches';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__table_coords`
--

CREATE TABLE `pma__table_coords` (
  `db_name` varchar(64) NOT NULL DEFAULT '',
  `table_name` varchar(64) NOT NULL DEFAULT '',
  `pdf_page_number` int(11) NOT NULL DEFAULT 0,
  `x` float UNSIGNED NOT NULL DEFAULT 0,
  `y` float UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Table coordinates for phpMyAdmin PDF output';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__table_info`
--

CREATE TABLE `pma__table_info` (
  `db_name` varchar(64) NOT NULL DEFAULT '',
  `table_name` varchar(64) NOT NULL DEFAULT '',
  `display_field` varchar(64) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Table information for phpMyAdmin';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__table_uiprefs`
--

CREATE TABLE `pma__table_uiprefs` (
  `username` varchar(64) NOT NULL,
  `db_name` varchar(64) NOT NULL,
  `table_name` varchar(64) NOT NULL,
  `prefs` text NOT NULL,
  `last_update` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Tables'' UI preferences';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__tracking`
--

CREATE TABLE `pma__tracking` (
  `db_name` varchar(64) NOT NULL,
  `table_name` varchar(64) NOT NULL,
  `version` int(10) UNSIGNED NOT NULL,
  `date_created` datetime NOT NULL,
  `date_updated` datetime NOT NULL,
  `schema_snapshot` text NOT NULL,
  `schema_sql` text DEFAULT NULL,
  `data_sql` longtext DEFAULT NULL,
  `tracking` set('UPDATE','REPLACE','INSERT','DELETE','TRUNCATE','CREATE DATABASE','ALTER DATABASE','DROP DATABASE','CREATE TABLE','ALTER TABLE','RENAME TABLE','DROP TABLE','CREATE INDEX','DROP INDEX','CREATE VIEW','ALTER VIEW','DROP VIEW') DEFAULT NULL,
  `tracking_active` int(1) UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Database changes tracking for phpMyAdmin';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__userconfig`
--

CREATE TABLE `pma__userconfig` (
  `username` varchar(64) NOT NULL,
  `timevalue` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `config_data` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='User preferences storage for phpMyAdmin';

--
-- Volcado de datos para la tabla `pma__userconfig`
--

INSERT INTO `pma__userconfig` (`username`, `timevalue`, `config_data`) VALUES
('biosanar_user', '2025-10-03 15:51:06', '{\"lang\":\"es\",\"Console\\/Mode\":\"collapse\"}');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__usergroups`
--

CREATE TABLE `pma__usergroups` (
  `usergroup` varchar(64) NOT NULL,
  `tab` varchar(64) NOT NULL,
  `allowed` enum('Y','N') NOT NULL DEFAULT 'N'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='User groups with configured menu items';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pma__users`
--

CREATE TABLE `pma__users` (
  `username` varchar(64) NOT NULL,
  `usergroup` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin COMMENT='Users and their assignments to user groups';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `population_groups`
--

CREATE TABLE `population_groups` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `population_groups`
--

INSERT INTO `population_groups` (`id`, `name`) VALUES
(1, 'General'),
(2, 'Población indígena'),
(3, 'Población afrodescendiente'),
(4, 'Población ROM'),
(5, 'Víctimas conflicto'),
(6, 'Desplazados'),
(7, 'Adultos mayores'),
(8, 'Niñez y adolescencia'),
(9, 'Otra'),
(28, 'General'),
(29, 'Población indígena'),
(30, 'Población afrodescendiente'),
(31, 'Población ROM'),
(32, 'Víctimas conflicto'),
(33, 'Desplazados'),
(34, 'Adultos mayores'),
(35, 'Niñez y adolescencia'),
(36, 'Otra'),
(37, 'General'),
(38, 'Población indígena'),
(39, 'Población afrodescendiente'),
(40, 'Población ROM'),
(41, 'Víctimas conflicto'),
(42, 'Desplazados'),
(43, 'Adultos mayores'),
(44, 'Niñez y adolescencia'),
(45, 'Otra'),
(46, 'General'),
(47, 'Población indígena'),
(48, 'Población afrodescendiente'),
(49, 'Población ROM'),
(50, 'Víctimas conflicto'),
(51, 'Desplazados'),
(52, 'Adultos mayores'),
(53, 'Niñez y adolescencia'),
(54, 'Otra');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pregnancies`
--

CREATE TABLE `pregnancies` (
  `id` int(10) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `status` enum('Activa','Completada','Interrumpida') NOT NULL DEFAULT 'Activa',
  `start_date` date NOT NULL COMMENT 'Fecha de inicio de gestación (FUM - Fecha Última Menstruación)',
  `expected_due_date` date NOT NULL COMMENT 'Fecha probable de parto (calculada: FUM + 280 días)',
  `actual_end_date` date DEFAULT NULL COMMENT 'Fecha real de culminación del embarazo',
  `gestational_weeks_at_registration` int(11) DEFAULT NULL COMMENT 'Semanas de gestación al momento del registro',
  `current_gestational_weeks` int(11) DEFAULT NULL COMMENT 'Semanas actuales de gestación (calculado)',
  `interruption_date` date DEFAULT NULL COMMENT 'Fecha de interrupción del embarazo',
  `interruption_reason` enum('Aborto espontáneo','Aborto terapéutico','Muerte fetal','Embarazo ectópico','Otra causa') DEFAULT NULL COMMENT 'Causa de la interrupción',
  `interruption_notes` text DEFAULT NULL COMMENT 'Detalles adicionales sobre la interrupción',
  `delivery_date` date DEFAULT NULL COMMENT 'Fecha del parto',
  `delivery_type` enum('Parto natural','Cesárea','Fórceps','Vacuum','Otro') DEFAULT NULL,
  `baby_gender` enum('Masculino','Femenino','No especificado') DEFAULT NULL,
  `baby_weight_grams` int(11) DEFAULT NULL COMMENT 'Peso del bebé en gramos',
  `complications` text DEFAULT NULL COMMENT 'Complicaciones durante el embarazo o parto',
  `prenatal_controls_count` int(11) DEFAULT 0 COMMENT 'Número de controles prenatales realizados',
  `last_prenatal_control_date` date DEFAULT NULL,
  `high_risk` tinyint(1) DEFAULT 0 COMMENT 'Embarazo de alto riesgo',
  `risk_factors` text DEFAULT NULL COMMENT 'Factores de riesgo identificados',
  `notes` text DEFAULT NULL COMMENT 'Notas generales sobre el embarazo',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL COMMENT 'Usuario que registró'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro y seguimiento de embarazos de pacientes';

--
-- Volcado de datos para la tabla `pregnancies`
--

INSERT INTO `pregnancies` (`id`, `patient_id`, `status`, `start_date`, `expected_due_date`, `actual_end_date`, `gestational_weeks_at_registration`, `current_gestational_weeks`, `interruption_date`, `interruption_reason`, `interruption_notes`, `delivery_date`, `delivery_type`, `baby_gender`, `baby_weight_grams`, `complications`, `prenatal_controls_count`, `last_prenatal_control_date`, `high_risk`, `risk_factors`, `notes`, `created_at`, `updated_at`, `created_by`) VALUES
(1, 1057, 'Completada', '2025-10-05', '2026-07-11', '2025-10-13', NULL, 1, NULL, NULL, NULL, '2025-10-13', NULL, NULL, NULL, NULL, 0, NULL, 0, NULL, NULL, '2025-10-13 19:06:11', '2025-10-13 19:10:28', 3),
(2, 1057, 'Activa', '2025-02-01', '2025-11-07', NULL, NULL, 36, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, NULL, NULL, '2025-10-13 19:12:22', '2025-10-13 19:12:22', 3);

--
-- Disparadores `pregnancies`
--
DELIMITER $$
CREATE TRIGGER `before_pregnancy_insert` BEFORE INSERT ON `pregnancies` FOR EACH ROW BEGIN
  IF NEW.expected_due_date IS NULL THEN
    SET NEW.expected_due_date = calculate_due_date(NEW.start_date)$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `before_pregnancy_update` BEFORE UPDATE ON `pregnancies` FOR EACH ROW BEGIN
  
  IF NEW.status = 'Activa' THEN
    SET NEW.current_gestational_weeks = calculate_gestational_weeks(NEW.start_date, CURDATE())$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `prenatal_controls`
--

CREATE TABLE `prenatal_controls` (
  `id` int(10) UNSIGNED NOT NULL,
  `pregnancy_id` int(10) UNSIGNED NOT NULL,
  `control_date` date NOT NULL,
  `gestational_weeks` int(11) NOT NULL COMMENT 'Semanas de gestación en el momento del control',
  `gestational_days` int(11) DEFAULT 0 COMMENT 'Días adicionales (ej: 20 semanas + 3 días)',
  `weight_kg` decimal(5,2) DEFAULT NULL COMMENT 'Peso de la madre en kg',
  `blood_pressure_systolic` int(11) DEFAULT NULL,
  `blood_pressure_diastolic` int(11) DEFAULT NULL,
  `fundal_height_cm` decimal(4,1) DEFAULT NULL COMMENT 'Altura uterina en cm',
  `fetal_heart_rate` int(11) DEFAULT NULL COMMENT 'Frecuencia cardíaca fetal (latidos/min)',
  `observations` text DEFAULT NULL,
  `recommendations` text DEFAULT NULL,
  `next_control_date` date DEFAULT NULL,
  `lab_tests_ordered` text DEFAULT NULL COMMENT 'Exámenes de laboratorio ordenados',
  `ultrasound_performed` tinyint(1) DEFAULT 0,
  `ultrasound_notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Controles prenatales realizados durante el embarazo';

--
-- Disparadores `prenatal_controls`
--
DELIMITER $$
CREATE TRIGGER `after_prenatal_control_insert` AFTER INSERT ON `prenatal_controls` FOR EACH ROW BEGIN
  UPDATE pregnancies 
  SET 
    prenatal_controls_count = prenatal_controls_count + 1,
    last_prenatal_control_date = NEW.control_date
  WHERE id = NEW.pregnancy_id$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `prescriptions`
--

CREATE TABLE `prescriptions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `medical_record_id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `doctor_id` bigint(20) UNSIGNED NOT NULL,
  `prescription_date` datetime DEFAULT current_timestamp(),
  `total_medications` int(11) DEFAULT 0,
  `instructions` text DEFAULT NULL,
  `status` enum('active','completed','cancelled','expired') DEFAULT 'active',
  `valid_until` date DEFAULT NULL,
  `pharmacy_notes` text DEFAULT NULL,
  `dispensed_at` datetime DEFAULT NULL,
  `dispensed_by` varchar(200) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `prescription_medications`
--

CREATE TABLE `prescription_medications` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `prescription_id` bigint(20) UNSIGNED NOT NULL,
  `medication_id` int(10) UNSIGNED NOT NULL,
  `dosage` varchar(100) NOT NULL COMMENT 'Dosis: 1 tableta, 5ml, etc.',
  `frequency` varchar(100) NOT NULL COMMENT 'Frecuencia: cada 8 horas, 3 veces al día, etc.',
  `duration_days` int(11) DEFAULT NULL,
  `route` varchar(50) DEFAULT 'oral' COMMENT 'Vía de administración',
  `instructions` text DEFAULT NULL COMMENT 'Instrucciones específicas',
  `quantity_prescribed` decimal(8,2) DEFAULT NULL,
  `refills_allowed` int(11) DEFAULT 0,
  `refills_used` int(11) DEFAULT 0,
  `status` enum('active','completed','discontinued') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Disparadores `prescription_medications`
--
DELIMITER $$
CREATE TRIGGER `tr_update_prescription_count` AFTER INSERT ON `prescription_medications` FOR EACH ROW BEGIN
    UPDATE prescriptions 
    SET total_medications = (
        SELECT COUNT(*) 
        FROM prescription_medications 
        WHERE prescription_id = NEW.prescription_id
    )
    WHERE id = NEW.prescription_id$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `queue_entries`
--

CREATE TABLE `queue_entries` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `patient_id` int(10) UNSIGNED NOT NULL,
  `specialty_id` int(10) UNSIGNED NOT NULL,
  `priority` enum('Alta','Normal','Baja') NOT NULL DEFAULT 'Normal',
  `status` enum('waiting','assigned','scheduled','cancelled') NOT NULL DEFAULT 'waiting',
  `reason` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `assigned_user_id` int(10) UNSIGNED DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `scheduled_appointment_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `queue_entries`
--

INSERT INTO `queue_entries` (`id`, `created_at`, `updated_at`, `patient_id`, `specialty_id`, `priority`, `status`, `reason`, `phone`, `assigned_user_id`, `assigned_at`, `scheduled_appointment_id`) VALUES
(1, '2025-10-01 04:39:12', '2025-10-01 04:39:12', 1002, 1, 'Normal', 'waiting', NULL, '0000000000', NULL, NULL, NULL),
(2, '2025-10-01 04:59:17', '2025-10-01 04:59:17', 1012, 1, 'Normal', 'waiting', NULL, '3105672307', NULL, NULL, NULL),
(3, '2025-10-01 05:09:42', '2025-10-01 05:09:42', 1006, 1, 'Normal', 'waiting', NULL, '3201234567', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `scheduling_preallocation`
--

CREATE TABLE `scheduling_preallocation` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `doctor_id` bigint(20) DEFAULT NULL,
  `specialty_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `availability_id` bigint(20) DEFAULT NULL,
  `target_date` date NOT NULL,
  `pre_date` date NOT NULL,
  `slots` int(11) NOT NULL,
  `assigned_count` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `scheduling_preallocation`
--

INSERT INTO `scheduling_preallocation` (`id`, `doctor_id`, `specialty_id`, `location_id`, `availability_id`, `target_date`, `pre_date`, `slots`, `assigned_count`, `created_at`) VALUES
(63, 17, 10, 1, 105, '2025-10-28', '2025-10-02', 4, 0, '2025-09-29 22:05:44'),
(64, 17, 10, 1, 105, '2025-10-28', '2025-10-01', 3, 0, '2025-09-29 22:05:44'),
(65, 17, 10, 1, 105, '2025-10-28', '2025-10-07', 1, 0, '2025-09-29 22:05:44'),
(66, 17, 10, 1, 105, '2025-10-28', '2025-10-23', 1, 0, '2025-09-29 22:05:44'),
(67, 17, 10, 1, 105, '2025-10-28', '2025-09-30', 1, 0, '2025-09-29 22:05:44'),
(68, 17, 10, 1, 105, '2025-10-28', '2025-10-09', 1, 0, '2025-09-29 22:05:44'),
(69, 17, 10, 1, 105, '2025-10-28', '2025-09-29', 3, 0, '2025-09-29 22:05:44'),
(70, 17, 10, 1, 105, '2025-10-28', '2025-10-21', 2, 0, '2025-09-29 22:05:44'),
(71, 17, 10, 1, 105, '2025-10-28', '2025-10-20', 2, 0, '2025-09-29 22:05:44'),
(72, 17, 10, 1, 105, '2025-10-28', '2025-10-03', 1, 0, '2025-09-29 22:05:44'),
(73, 17, 10, 1, 105, '2025-10-28', '2025-10-22', 1, 0, '2025-09-29 22:05:44'),
(74, 17, 10, 1, 105, '2025-10-28', '2025-10-16', 2, 0, '2025-09-29 22:05:44'),
(75, 17, 10, 1, 105, '2025-10-28', '2025-10-06', 2, 0, '2025-09-29 22:05:44'),
(76, 17, 10, 1, 105, '2025-10-28', '2025-10-14', 2, 0, '2025-09-29 22:05:44'),
(77, 17, 10, 1, 105, '2025-10-28', '2025-10-10', 3, 0, '2025-09-29 22:05:44'),
(78, 17, 10, 1, 105, '2025-10-28', '2025-10-17', 5, 0, '2025-09-29 22:05:44'),
(79, 17, 10, 1, 105, '2025-10-28', '2025-10-13', 1, 0, '2025-09-29 22:05:44'),
(80, 17, 10, 1, 105, '2025-10-28', '2025-10-24', 1, 0, '2025-09-29 22:05:44'),
(81, 17, 10, 1, 105, '2025-10-28', '2025-10-27', 1, 0, '2025-09-29 22:05:44'),
(82, 17, 10, 1, 105, '2025-10-28', '2025-10-08', 1, 0, '2025-09-29 22:05:44'),
(83, 17, 10, 1, 105, '2025-10-28', '2025-10-15', 2, 0, '2025-09-29 22:05:44'),
(84, 6, 12, 3, 107, '2025-11-20', '2025-11-10', 4, 0, '2025-09-30 02:56:58'),
(85, 6, 12, 3, 107, '2025-11-20', '2025-11-04', 1, 0, '2025-09-30 02:56:58'),
(86, 6, 12, 3, 107, '2025-11-20', '2025-11-03', 2, 0, '2025-09-30 02:56:58'),
(87, 6, 12, 3, 107, '2025-11-20', '2025-11-14', 2, 0, '2025-09-30 02:56:58'),
(88, 6, 12, 3, 107, '2025-11-20', '2025-11-19', 3, 0, '2025-09-30 02:56:58'),
(89, 6, 12, 3, 107, '2025-11-20', '2025-11-05', 2, 0, '2025-09-30 02:56:58'),
(90, 6, 12, 3, 107, '2025-11-20', '2025-11-11', 1, 0, '2025-09-30 02:56:58'),
(91, 6, 12, 3, 107, '2025-11-20', '2025-11-07', 4, 0, '2025-09-30 02:56:58'),
(92, 6, 12, 3, 107, '2025-11-20', '2025-11-06', 1, 0, '2025-09-30 02:56:58'),
(93, 6, 12, 3, 107, '2025-11-20', '2025-11-18', 3, 0, '2025-09-30 02:56:58'),
(94, 6, 12, 3, 107, '2025-11-20', '2025-11-12', 3, 0, '2025-09-30 02:56:58'),
(95, 6, 12, 3, 107, '2025-11-20', '2025-11-17', 3, 0, '2025-09-30 02:56:58'),
(96, 6, 12, 3, 107, '2025-11-20', '2025-11-13', 1, 0, '2025-09-30 02:56:58');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `scheduling_preallocation_assignments`
--

CREATE TABLE `scheduling_preallocation_assignments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `preallocation_id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `appointment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `services`
--

CREATE TABLE `services` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `category` enum('consulta','laboratorio','imagen','procedimiento','otro') NOT NULL DEFAULT 'consulta',
  `description` text DEFAULT NULL,
  `base_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'COP',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `services`
--

INSERT INTO `services` (`id`, `name`, `category`, `description`, `base_price`, `currency`, `active`, `created_at`, `updated_at`) VALUES
(1, 'Consulta General', 'consulta', NULL, 0.00, 'COP', 1, '2025-08-15 22:18:26', '2025-08-15 22:18:26'),
(2, 'Consulta Especialista', 'consulta', NULL, 0.00, 'COP', 1, '2025-08-15 22:18:26', '2025-08-21 21:40:14'),
(3, 'Ecografía', 'imagen', 'Eco Abdominal', 250000.00, 'COP', 1, '2025-08-15 22:18:26', '2025-08-16 16:18:56'),
(4, 'Resonancia', 'imagen', NULL, 0.00, 'COP', 1, '2025-08-15 22:18:26', '2025-08-15 22:18:26'),
(5, 'Laboratorio Básico', 'laboratorio', NULL, 0.00, 'COP', 1, '2025-08-15 22:18:26', '2025-08-15 22:18:26');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `specialties`
--

CREATE TABLE `specialties` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `default_duration_minutes` smallint(5) UNSIGNED NOT NULL DEFAULT 30,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `specialties`
--

INSERT INTO `specialties` (`id`, `name`, `description`, `default_duration_minutes`, `active`, `created_at`) VALUES
(1, 'Medicina General', 'Atención primaria', 15, 1, '2025-08-08 21:47:19'),
(3, 'Cardiología', 'Corazon', 15, 1, '2025-08-08 23:28:59'),
(5, 'Odontologia', 'Odontologia', 20, 1, '2025-08-11 03:15:32'),
(6, 'Ecografías', 'Ecografías', 15, 1, '2025-08-11 12:52:02'),
(7, 'Psicología', 'Psicología', 15, 1, '2025-08-11 12:52:18'),
(8, 'Pediatría', 'Pediatría', 15, 1, '2025-08-11 12:52:33'),
(9, 'Medicina interna', 'Medicina interna ', 15, 1, '2025-08-11 12:52:52'),
(10, 'Dermatología', 'Dermatología', 15, 1, '2025-08-11 12:53:07'),
(11, 'Nutrición', 'Nutrición', 15, 1, '2025-08-11 12:53:19'),
(12, 'Ginecología', 'Ginecología', 15, 1, '2025-08-11 12:53:30'),
(13, 'Medicina familiar', 'cuidado de familia', 15, 1, '2025-08-27 16:07:32'),
(14, 'Ecografías2', 'Ecografías2', 20, 1, '2025-08-27 21:17:27');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `system_settings`
--

CREATE TABLE `system_settings` (
  `id` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `notifications_email_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `notifications_email` varchar(150) DEFAULT NULL,
  `alert_long_queue_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `alert_agents_offline_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `ai_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `ai_auto_answer` tinyint(1) NOT NULL DEFAULT 1,
  `ai_response_timeout_seconds` smallint(5) UNSIGNED NOT NULL DEFAULT 3,
  `ai_start_time` time DEFAULT NULL,
  `ai_end_time` time DEFAULT NULL,
  `ai_mon` tinyint(1) NOT NULL DEFAULT 1,
  `ai_tue` tinyint(1) NOT NULL DEFAULT 1,
  `ai_wed` tinyint(1) NOT NULL DEFAULT 1,
  `ai_thu` tinyint(1) NOT NULL DEFAULT 1,
  `ai_fri` tinyint(1) NOT NULL DEFAULT 1,
  `ai_sat` tinyint(1) NOT NULL DEFAULT 0,
  `ai_sun` tinyint(1) NOT NULL DEFAULT 0,
  `ai_pause_holidays` tinyint(1) NOT NULL DEFAULT 1,
  `ai_vacation_mode` tinyint(1) NOT NULL DEFAULT 0,
  `ai_break_start` time DEFAULT NULL,
  `ai_break_end` time DEFAULT NULL,
  `ai_message_welcome` varchar(255) DEFAULT NULL,
  `ai_message_offline` varchar(255) DEFAULT NULL,
  `ai_message_transfer` varchar(255) DEFAULT NULL,
  `org_name` varchar(150) DEFAULT NULL,
  `org_address` varchar(200) DEFAULT NULL,
  `org_phone` varchar(30) DEFAULT NULL,
  `cc_call_recording_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `cc_auto_distribution_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `cc_max_wait_minutes` smallint(5) UNSIGNED NOT NULL DEFAULT 15,
  `org_nit` varchar(30) DEFAULT NULL,
  `org_logo_url` varchar(255) DEFAULT NULL,
  `org_timezone` varchar(64) NOT NULL DEFAULT 'America/Bogota'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `system_settings`
--

INSERT INTO `system_settings` (`id`, `notifications_email_enabled`, `notifications_email`, `alert_long_queue_enabled`, `alert_agents_offline_enabled`, `created_at`, `updated_at`, `ai_enabled`, `ai_auto_answer`, `ai_response_timeout_seconds`, `ai_start_time`, `ai_end_time`, `ai_mon`, `ai_tue`, `ai_wed`, `ai_thu`, `ai_fri`, `ai_sat`, `ai_sun`, `ai_pause_holidays`, `ai_vacation_mode`, `ai_break_start`, `ai_break_end`, `ai_message_welcome`, `ai_message_offline`, `ai_message_transfer`, `org_name`, `org_address`, `org_phone`, `cc_call_recording_enabled`, `cc_auto_distribution_enabled`, `cc_max_wait_minutes`, `org_nit`, `org_logo_url`, `org_timezone`) VALUES
(1, 1, 'bastidasdaveusa@gmail.com', 1, 1, '2025-08-08 22:20:45', '2025-10-03 20:47:26', 1, 1, 3, '08:00:00', '17:00:00', 0, 1, 1, 1, 1, 0, 0, 1, 0, '10:49:00', '11:51:00', NULL, NULL, NULL, 'Fundación Biossanar IPS', 'Cra. 9 #10-29, San Gil, Santander', '6076911308', 1, 1, 15, '9005354050', NULL, 'America/Bogota');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `timezones`
--

CREATE TABLE `timezones` (
  `id` smallint(5) UNSIGNED NOT NULL,
  `name` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `timezones`
--

INSERT INTO `timezones` (`id`, `name`) VALUES
(13, 'America/Argentina/Buenos_Aires'),
(11, 'America/Asuncion'),
(2, 'America/Bogota'),
(5, 'America/Caracas'),
(14, 'America/Chicago'),
(4, 'America/Guayaquil'),
(9, 'America/La_Paz'),
(3, 'America/Lima'),
(16, 'America/Los_Angeles'),
(6, 'America/Mexico_City'),
(12, 'America/Montevideo'),
(15, 'America/New_York'),
(7, 'America/Panama'),
(10, 'America/Santiago'),
(8, 'America/Santo_Domingo'),
(18, 'Atlantic/Azores'),
(17, 'Atlantic/Cape_Verde'),
(21, 'Europe/Berlin'),
(19, 'Europe/London'),
(20, 'Europe/Madrid'),
(22, 'Europe/Paris'),
(23, 'Europe/Rome'),
(1, 'UTC');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `treatment_plans`
--

CREATE TABLE `treatment_plans` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED NOT NULL,
  `doctor_id` bigint(20) UNSIGNED NOT NULL,
  `medical_record_id` bigint(20) UNSIGNED DEFAULT NULL,
  `plan_name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('planned','active','completed','suspended','cancelled') DEFAULT 'planned',
  `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
  `goals` text DEFAULT NULL COMMENT 'Objetivos del tratamiento',
  `success_criteria` text DEFAULT NULL COMMENT 'Criterios de éxito',
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `last_updated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `treatment_tasks`
--

CREATE TABLE `treatment_tasks` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `treatment_plan_id` bigint(20) UNSIGNED NOT NULL,
  `task_name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `task_type` enum('medication','exercise','therapy','test','appointment','lifestyle','monitoring') NOT NULL,
  `frequency` varchar(100) DEFAULT NULL COMMENT 'diario, semanal, cada 3 días, etc.',
  `duration` varchar(100) DEFAULT NULL COMMENT 'por 2 semanas, por 30 días, etc.',
  `instructions` text DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('pending','in_progress','completed','skipped','cancelled') DEFAULT 'pending',
  `priority` enum('low','normal','high') DEFAULT 'normal',
  `reminder_enabled` tinyint(1) DEFAULT 0,
  `completed_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `role` enum('admin','supervisor','agent','doctor','reception') NOT NULL DEFAULT 'agent',
  `status` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `password_hash` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `phone`, `department`, `role`, `status`, `password_hash`, `created_at`) VALUES
(3, 'Demo', 'demo@demo.com', '+57123456789', 'administracion', 'admin', 'Activo', '$2a$10$yu.uhGZo6I4TqkciilKam.O1C4/2yyJnrfcTKwsTHI4/WPHYuUzkO', '2025-08-09 23:03:55'),
(4, 'Administrador', 'admin@example.com', NULL, NULL, 'admin', 'Activo', '$2a$10$17f3Du8VS.a7fZl2ELR0juoQNuZXpDKHzjg0J3OiDMla5RG3714m.', '2025-08-25 16:03:06');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `voice_calls`
--

CREATE TABLE `voice_calls` (
  `id` int(11) NOT NULL,
  `call_id` varchar(255) NOT NULL,
  `caller_number` varchar(50) NOT NULL,
  `called_number` varchar(50) NOT NULL,
  `status` enum('started','answered','ended','failed') DEFAULT 'started',
  `start_time` timestamp NULL DEFAULT current_timestamp(),
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` int(11) DEFAULT 0,
  `transcript` text DEFAULT NULL,
  `response_audio_url` varchar(500) DEFAULT NULL,
  `recording_url` varchar(500) DEFAULT NULL,
  `audio_response_url` varchar(500) DEFAULT NULL,
  `patient_id` int(11) DEFAULT NULL,
  `appointment_created` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `agent_response` text DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `conversation_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`conversation_data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `v_eps_authorizations`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `v_eps_authorizations` (
`id` bigint(20) unsigned
,`eps_id` int(10) unsigned
,`eps_name` varchar(150)
,`eps_code` varchar(25)
,`affiliation_type` enum('Contributivo','Subsidiado','Especial','Mixto')
,`specialty_id` int(10) unsigned
,`specialty_name` varchar(120)
,`location_id` int(10) unsigned
,`location_name` varchar(150)
,`municipality_id` int(10) unsigned
,`authorized` tinyint(1)
,`authorization_date` date
,`expiration_date` date
,`max_monthly_appointments` int(10) unsigned
,`copay_percentage` decimal(5,2)
,`requires_prior_authorization` tinyint(1)
,`notes` text
,`created_at` timestamp
,`updated_at` timestamp
,`is_currently_valid` int(1)
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `waiting_list_with_details`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `waiting_list_with_details` (
`waiting_list_id` bigint(20) unsigned
,`status` enum('pending','reassigned','cancelled','expired')
,`priority_level` enum('Baja','Normal','Alta','Urgente')
,`requested_date` datetime
,`appointment_type` enum('Presencial','Telemedicina')
,`reason` text
,`notes` text
,`added_to_waiting_list_at` timestamp
,`expires_at` datetime
,`days_until_expiration` int(8)
,`patient_id` bigint(20) unsigned
,`patient_name` varchar(150)
,`patient_document` varchar(30)
,`patient_phone` varchar(30)
,`patient_email` varchar(150)
,`availability_id` bigint(20) unsigned
,`availability_date` date
,`start_time` time
,`end_time` time
,`duration_minutes` int(11)
,`total_quota_distributed` decimal(32,0)
,`total_capacity` smallint(5) unsigned
,`current_appointments_count` bigint(21)
,`slots_currently_available` bigint(21) unsigned
,`doctor_id` bigint(20) unsigned
,`doctor_name` varchar(120)
,`doctor_email` varchar(150)
,`specialty_id` int(10) unsigned
,`specialty_name` varchar(120)
,`location_id` int(10) unsigned
,`location_name` varchar(150)
,`location_address` varchar(200)
,`reassigned_at` timestamp
,`reassigned_appointment_id` bigint(20) unsigned
,`queue_position` bigint(22)
);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `waiting_queue`
--

CREATE TABLE `waiting_queue` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `patient_id` bigint(20) UNSIGNED DEFAULT NULL,
  `name` varchar(150) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `specialty_id` int(10) UNSIGNED NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `priority` enum('Alta','Normal','Baja') NOT NULL DEFAULT 'Normal',
  `status` enum('En espera','Contactado','Agendado','Descartado') NOT NULL DEFAULT 'En espera',
  `wait_seconds` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `webhook_config`
--

CREATE TABLE `webhook_config` (
  `id` int(11) NOT NULL,
  `service_name` varchar(50) NOT NULL,
  `endpoint_url` varchar(500) NOT NULL,
  `secret_key` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `webhook_types` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`webhook_types`)),
  `retry_count` int(11) DEFAULT 3,
  `timeout_seconds` int(11) DEFAULT 30,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `webhook_config`
--

INSERT INTO `webhook_config` (`id`, `service_name`, `endpoint_url`, `secret_key`, `is_active`, `webhook_types`, `retry_count`, `timeout_seconds`, `created_at`, `updated_at`) VALUES
(1, 'elevenlabs', 'https://biosanarcall.site/api/webhooks/elevenlabs', 'elevenlabs_webhook_secret_2025', 1, '[\"transcription\", \"audio\"]', 3, 30, '2025-08-25 17:55:58', '2025-08-25 22:52:33');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `webhook_logs`
--

CREATE TABLE `webhook_logs` (
  `id` int(11) NOT NULL,
  `webhook_config_id` int(11) NOT NULL,
  `conversation_id` varchar(255) DEFAULT NULL,
  `webhook_type` enum('transcription','audio','call_started','call_ended') NOT NULL,
  `request_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`request_payload`)),
  `response_status` int(11) DEFAULT NULL,
  `response_body` text DEFAULT NULL,
  `processing_time_ms` int(11) DEFAULT 0,
  `error_message` text DEFAULT NULL,
  `retry_count` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `webhook_logs`
--

INSERT INTO `webhook_logs` (`id`, `webhook_config_id`, `conversation_id`, `webhook_type`, `request_payload`, `response_status`, `response_body`, `processing_time_ms`, `error_message`, `retry_count`, `created_at`) VALUES
(1, 1, 'test_conv_12345', 'transcription', '{\"data\": [123, 10, 32, 32, 34, 116, 121, 112, 101, 34, 58, 32, 34, 112, 111, 115, 116, 95, 99, 97, 108, 108, 95, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 105, 111, 110, 34, 44, 10, 32, 32, 34, 101, 118, 101, 110, 116, 95, 116, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 32, 49, 55, 51, 50, 52, 55, 48, 48, 48, 48, 44, 10, 32, 32, 34, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 34, 97, 103, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 97, 103, 101, 110, 116, 95, 48, 48, 49, 34, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 99, 111, 110, 118, 95, 49, 50, 51, 52, 53, 34, 44, 10, 32, 32, 32, 32, 34, 115, 116, 97, 116, 117, 115, 34, 58, 32, 34, 100, 111, 110, 101, 34, 44, 10, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 117, 115, 101, 114, 95, 55, 56, 57, 34, 44, 10, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 58, 32, 91, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 115, 111, 121, 32, 101, 108, 32, 97, 115, 105, 115, 116, 101, 110, 116, 101, 32, 109, 195, 169, 100, 105, 99, 111, 32, 118, 105, 114, 116, 117, 97, 108, 46, 32, 194, 191, 69, 110, 32, 113, 117, 195, 169, 32, 112, 117, 101, 100, 111, 32, 97, 121, 117, 100, 97, 114, 108, 101, 32, 104, 111, 121, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 48, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 117, 115, 101, 114, 34, 44, 32, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 110, 101, 99, 101, 115, 105, 116, 111, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 51, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 80, 111, 114, 32, 115, 117, 112, 117, 101, 115, 116, 111, 46, 32, 194, 191, 80, 111, 100, 114, 195, 173, 97, 32, 112, 114, 111, 112, 111, 114, 99, 105, 111, 110, 97, 114, 109, 101, 32, 115, 117, 32, 110, 111, 109, 98, 114, 101, 32, 99, 111, 109, 112, 108, 101, 116, 111, 32, 121, 32, 100, 111, 99, 117, 109, 101, 110, 116, 111, 32, 100, 101, 32, 105, 100, 101, 110, 116, 105, 100, 97, 100, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 56, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 93, 44, 10, 32, 32, 32, 32, 34, 109, 101, 116, 97, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 115, 116, 97, 114, 116, 95, 116, 105, 109, 101, 95, 117, 110, 105, 120, 95, 115, 101, 99, 115, 34, 58, 32, 49, 55, 51, 50, 52, 54, 57, 57, 52, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 100, 117, 114, 97, 116, 105, 111, 110, 95, 115, 101, 99, 115, 34, 58, 32, 54, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 111, 115, 116, 34, 58, 32, 49, 53, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 101, 114, 109, 105, 110, 97, 116, 105, 111, 110, 95, 114, 101, 97, 115, 111, 110, 34, 58, 32, 34, 117, 115, 101, 114, 95, 104, 97, 110, 103, 117, 112, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 97, 110, 97, 108, 121, 115, 105, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 115, 117, 99, 99, 101, 115, 115, 102, 117, 108, 34, 58, 32, 34, 115, 117, 99, 99, 101, 115, 115, 34, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 95, 115, 117, 109, 109, 97, 114, 121, 34, 58, 32, 34, 69, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 32, 108, 108, 97, 109, 195, 179, 32, 112, 97, 114, 97, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 32, 76, 97, 32, 99, 111, 110, 118, 101, 114, 115, 97, 99, 105, 195, 179, 110, 32, 102, 117, 101, 32, 101, 120, 105, 116, 111, 115, 97, 32, 121, 32, 115, 101, 32, 114, 101, 99, 111, 112, 105, 108, 195, 179, 32, 108, 97, 32, 105, 110, 102, 111, 114, 109, 97, 99, 105, 195, 179, 110, 32, 98, 195, 161, 115, 105, 99, 97, 32, 100, 101, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 46, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 110, 105, 116, 105, 97, 116, 105, 111, 110, 95, 99, 108, 105, 101, 110, 116, 95, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 100, 121, 110, 97, 109, 105, 99, 95, 118, 97, 114, 105, 97, 98, 108, 101, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 110, 97, 109, 101, 34, 58, 32, 34, 74, 117, 97, 110, 32, 80, 195, 169, 114, 101, 122, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 112, 97, 116, 105, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 49, 50, 51, 34, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 125, 10, 32, 32, 125, 10, 125], \"type\": \"Buffer\"}', 500, 'Internal server error', 16, 'Cannot add or update a child row: a foreign key constraint fails (`biosanar`.`call_notifications`, CONSTRAINT `call_notifications_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL)', 0, '2025-08-25 19:18:48'),
(2, 1, 'test_conv_12345', 'transcription', '{\"data\": [123, 10, 32, 32, 34, 116, 121, 112, 101, 34, 58, 32, 34, 112, 111, 115, 116, 95, 99, 97, 108, 108, 95, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 105, 111, 110, 34, 44, 10, 32, 32, 34, 101, 118, 101, 110, 116, 95, 116, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 32, 49, 55, 51, 50, 52, 55, 48, 48, 48, 48, 44, 10, 32, 32, 34, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 34, 97, 103, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 97, 103, 101, 110, 116, 95, 48, 48, 49, 34, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 99, 111, 110, 118, 95, 49, 50, 51, 52, 53, 34, 44, 10, 32, 32, 32, 32, 34, 115, 116, 97, 116, 117, 115, 34, 58, 32, 34, 100, 111, 110, 101, 34, 44, 10, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 117, 115, 101, 114, 95, 55, 56, 57, 34, 44, 10, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 58, 32, 91, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 115, 111, 121, 32, 101, 108, 32, 97, 115, 105, 115, 116, 101, 110, 116, 101, 32, 109, 195, 169, 100, 105, 99, 111, 32, 118, 105, 114, 116, 117, 97, 108, 46, 32, 194, 191, 69, 110, 32, 113, 117, 195, 169, 32, 112, 117, 101, 100, 111, 32, 97, 121, 117, 100, 97, 114, 108, 101, 32, 104, 111, 121, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 48, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 117, 115, 101, 114, 34, 44, 32, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 110, 101, 99, 101, 115, 105, 116, 111, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 51, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 80, 111, 114, 32, 115, 117, 112, 117, 101, 115, 116, 111, 46, 32, 194, 191, 80, 111, 100, 114, 195, 173, 97, 32, 112, 114, 111, 112, 111, 114, 99, 105, 111, 110, 97, 114, 109, 101, 32, 115, 117, 32, 110, 111, 109, 98, 114, 101, 32, 99, 111, 109, 112, 108, 101, 116, 111, 32, 121, 32, 100, 111, 99, 117, 109, 101, 110, 116, 111, 32, 100, 101, 32, 105, 100, 101, 110, 116, 105, 100, 97, 100, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 56, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 93, 44, 10, 32, 32, 32, 32, 34, 109, 101, 116, 97, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 115, 116, 97, 114, 116, 95, 116, 105, 109, 101, 95, 117, 110, 105, 120, 95, 115, 101, 99, 115, 34, 58, 32, 49, 55, 51, 50, 52, 54, 57, 57, 52, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 100, 117, 114, 97, 116, 105, 111, 110, 95, 115, 101, 99, 115, 34, 58, 32, 54, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 111, 115, 116, 34, 58, 32, 49, 53, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 101, 114, 109, 105, 110, 97, 116, 105, 111, 110, 95, 114, 101, 97, 115, 111, 110, 34, 58, 32, 34, 117, 115, 101, 114, 95, 104, 97, 110, 103, 117, 112, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 97, 110, 97, 108, 121, 115, 105, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 115, 117, 99, 99, 101, 115, 115, 102, 117, 108, 34, 58, 32, 34, 115, 117, 99, 99, 101, 115, 115, 34, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 95, 115, 117, 109, 109, 97, 114, 121, 34, 58, 32, 34, 69, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 32, 108, 108, 97, 109, 195, 179, 32, 112, 97, 114, 97, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 32, 76, 97, 32, 99, 111, 110, 118, 101, 114, 115, 97, 99, 105, 195, 179, 110, 32, 102, 117, 101, 32, 101, 120, 105, 116, 111, 115, 97, 32, 121, 32, 115, 101, 32, 114, 101, 99, 111, 112, 105, 108, 195, 179, 32, 108, 97, 32, 105, 110, 102, 111, 114, 109, 97, 99, 105, 195, 179, 110, 32, 98, 195, 161, 115, 105, 99, 97, 32, 100, 101, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 46, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 110, 105, 116, 105, 97, 116, 105, 111, 110, 95, 99, 108, 105, 101, 110, 116, 95, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 100, 121, 110, 97, 109, 105, 99, 95, 118, 97, 114, 105, 97, 98, 108, 101, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 110, 97, 109, 101, 34, 58, 32, 34, 74, 117, 97, 110, 32, 80, 195, 169, 114, 101, 122, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 112, 97, 116, 105, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 49, 50, 51, 34, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 125, 10, 32, 32, 125, 10, 125], \"type\": \"Buffer\"}', 500, 'Internal server error', 23, 'Cannot add or update a child row: a foreign key constraint fails (`biosanar`.`call_notifications`, CONSTRAINT `call_notifications_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL)', 0, '2025-08-25 19:19:43'),
(3, 1, 'test_conv_12345', 'transcription', '{\"data\": [123, 10, 32, 32, 34, 116, 121, 112, 101, 34, 58, 32, 34, 112, 111, 115, 116, 95, 99, 97, 108, 108, 95, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 105, 111, 110, 34, 44, 10, 32, 32, 34, 101, 118, 101, 110, 116, 95, 116, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 32, 49, 55, 51, 50, 52, 55, 48, 48, 48, 48, 44, 10, 32, 32, 34, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 34, 97, 103, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 97, 103, 101, 110, 116, 95, 48, 48, 49, 34, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 99, 111, 110, 118, 95, 49, 50, 51, 52, 53, 34, 44, 10, 32, 32, 32, 32, 34, 115, 116, 97, 116, 117, 115, 34, 58, 32, 34, 100, 111, 110, 101, 34, 44, 10, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 117, 115, 101, 114, 95, 55, 56, 57, 34, 44, 10, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 58, 32, 91, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 115, 111, 121, 32, 101, 108, 32, 97, 115, 105, 115, 116, 101, 110, 116, 101, 32, 109, 195, 169, 100, 105, 99, 111, 32, 118, 105, 114, 116, 117, 97, 108, 46, 32, 194, 191, 69, 110, 32, 113, 117, 195, 169, 32, 112, 117, 101, 100, 111, 32, 97, 121, 117, 100, 97, 114, 108, 101, 32, 104, 111, 121, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 48, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 117, 115, 101, 114, 34, 44, 32, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 110, 101, 99, 101, 115, 105, 116, 111, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 51, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 80, 111, 114, 32, 115, 117, 112, 117, 101, 115, 116, 111, 46, 32, 194, 191, 80, 111, 100, 114, 195, 173, 97, 32, 112, 114, 111, 112, 111, 114, 99, 105, 111, 110, 97, 114, 109, 101, 32, 115, 117, 32, 110, 111, 109, 98, 114, 101, 32, 99, 111, 109, 112, 108, 101, 116, 111, 32, 121, 32, 100, 111, 99, 117, 109, 101, 110, 116, 111, 32, 100, 101, 32, 105, 100, 101, 110, 116, 105, 100, 97, 100, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 56, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 93, 44, 10, 32, 32, 32, 32, 34, 109, 101, 116, 97, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 115, 116, 97, 114, 116, 95, 116, 105, 109, 101, 95, 117, 110, 105, 120, 95, 115, 101, 99, 115, 34, 58, 32, 49, 55, 51, 50, 52, 54, 57, 57, 52, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 100, 117, 114, 97, 116, 105, 111, 110, 95, 115, 101, 99, 115, 34, 58, 32, 54, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 111, 115, 116, 34, 58, 32, 49, 53, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 101, 114, 109, 105, 110, 97, 116, 105, 111, 110, 95, 114, 101, 97, 115, 111, 110, 34, 58, 32, 34, 117, 115, 101, 114, 95, 104, 97, 110, 103, 117, 112, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 97, 110, 97, 108, 121, 115, 105, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 115, 117, 99, 99, 101, 115, 115, 102, 117, 108, 34, 58, 32, 34, 115, 117, 99, 99, 101, 115, 115, 34, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 95, 115, 117, 109, 109, 97, 114, 121, 34, 58, 32, 34, 69, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 32, 108, 108, 97, 109, 195, 179, 32, 112, 97, 114, 97, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 32, 76, 97, 32, 99, 111, 110, 118, 101, 114, 115, 97, 99, 105, 195, 179, 110, 32, 102, 117, 101, 32, 101, 120, 105, 116, 111, 115, 97, 32, 121, 32, 115, 101, 32, 114, 101, 99, 111, 112, 105, 108, 195, 179, 32, 108, 97, 32, 105, 110, 102, 111, 114, 109, 97, 99, 105, 195, 179, 110, 32, 98, 195, 161, 115, 105, 99, 97, 32, 100, 101, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 46, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 110, 105, 116, 105, 97, 116, 105, 111, 110, 95, 99, 108, 105, 101, 110, 116, 95, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 100, 121, 110, 97, 109, 105, 99, 95, 118, 97, 114, 105, 97, 98, 108, 101, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 110, 97, 109, 101, 34, 58, 32, 34, 74, 117, 97, 110, 32, 80, 195, 169, 114, 101, 122, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 112, 97, 116, 105, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 49, 50, 51, 34, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 125, 10, 32, 32, 125, 10, 125], \"type\": \"Buffer\"}', 500, 'Internal server error', 22, 'Cannot add or update a child row: a foreign key constraint fails (`biosanar`.`call_notifications`, CONSTRAINT `call_notifications_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL)', 0, '2025-08-25 19:21:06'),
(4, 1, 'test_conv_12345', 'transcription', '{\"data\": {\"status\": \"done\", \"user_id\": \"test_user_789\", \"agent_id\": \"test_agent_001\", \"analysis\": {\"call_successful\": \"success\", \"transcript_summary\": \"El paciente llamó para agendar una cita médica. La conversación fue exitosa y se recopiló la información básica del paciente.\"}, \"metadata\": {\"cost\": 150, \"call_duration_secs\": 60, \"termination_reason\": \"user_hangup\", \"start_time_unix_secs\": 1732469940}, \"transcript\": [{\"role\": \"agent\", \"message\": \"Hola, soy el asistente médico virtual. ¿En qué puedo ayudarle hoy?\", \"time_in_call_secs\": 0}, {\"role\": \"user\", \"message\": \"Hola, necesito agendar una cita médica.\", \"time_in_call_secs\": 3}, {\"role\": \"agent\", \"message\": \"Por supuesto. ¿Podría proporcionarme su nombre completo y documento de identidad?\", \"time_in_call_secs\": 8}], \"conversation_id\": \"test_conv_12345\", \"conversation_initiation_client_data\": {\"dynamic_variables\": {\"user_name\": \"Dave Alberto Bastidas\", \"patient_id\": \"27\"}}}, \"type\": \"post_call_transcription\", \"event_timestamp\": 1732470000}', 200, 'Webhook processed successfully', 17, NULL, 0, '2025-08-25 19:40:22'),
(5, 1, 'test_conv_12345', 'transcription', '{\"data\": [123, 10, 32, 32, 34, 116, 121, 112, 101, 34, 58, 32, 34, 112, 111, 115, 116, 95, 99, 97, 108, 108, 95, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 105, 111, 110, 34, 44, 10, 32, 32, 34, 101, 118, 101, 110, 116, 95, 116, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 32, 49, 55, 51, 50, 52, 55, 48, 48, 48, 48, 44, 10, 32, 32, 34, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 34, 97, 103, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 97, 103, 101, 110, 116, 95, 48, 48, 49, 34, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 99, 111, 110, 118, 95, 49, 50, 51, 52, 53, 34, 44, 10, 32, 32, 32, 32, 34, 115, 116, 97, 116, 117, 115, 34, 58, 32, 34, 100, 111, 110, 101, 34, 44, 10, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 117, 115, 101, 114, 95, 55, 56, 57, 34, 44, 10, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 58, 32, 91, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 115, 111, 121, 32, 101, 108, 32, 97, 115, 105, 115, 116, 101, 110, 116, 101, 32, 109, 195, 169, 100, 105, 99, 111, 32, 118, 105, 114, 116, 117, 97, 108, 46, 32, 194, 191, 69, 110, 32, 113, 117, 195, 169, 32, 112, 117, 101, 100, 111, 32, 97, 121, 117, 100, 97, 114, 108, 101, 32, 104, 111, 121, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 48, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 117, 115, 101, 114, 34, 44, 32, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 110, 101, 99, 101, 115, 105, 116, 111, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 51, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 80, 111, 114, 32, 115, 117, 112, 117, 101, 115, 116, 111, 46, 32, 194, 191, 80, 111, 100, 114, 195, 173, 97, 32, 112, 114, 111, 112, 111, 114, 99, 105, 111, 110, 97, 114, 109, 101, 32, 115, 117, 32, 110, 111, 109, 98, 114, 101, 32, 99, 111, 109, 112, 108, 101, 116, 111, 32, 121, 32, 100, 111, 99, 117, 109, 101, 110, 116, 111, 32, 100, 101, 32, 105, 100, 101, 110, 116, 105, 100, 97, 100, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 56, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 93, 44, 10, 32, 32, 32, 32, 34, 109, 101, 116, 97, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 115, 116, 97, 114, 116, 95, 116, 105, 109, 101, 95, 117, 110, 105, 120, 95, 115, 101, 99, 115, 34, 58, 32, 49, 55, 51, 50, 52, 54, 57, 57, 52, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 100, 117, 114, 97, 116, 105, 111, 110, 95, 115, 101, 99, 115, 34, 58, 32, 54, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 111, 115, 116, 34, 58, 32, 49, 53, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 101, 114, 109, 105, 110, 97, 116, 105, 111, 110, 95, 114, 101, 97, 115, 111, 110, 34, 58, 32, 34, 117, 115, 101, 114, 95, 104, 97, 110, 103, 117, 112, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 97, 110, 97, 108, 121, 115, 105, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 115, 117, 99, 99, 101, 115, 115, 102, 117, 108, 34, 58, 32, 34, 115, 117, 99, 99, 101, 115, 115, 34, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 95, 115, 117, 109, 109, 97, 114, 121, 34, 58, 32, 34, 69, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 32, 108, 108, 97, 109, 195, 179, 32, 112, 97, 114, 97, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 32, 76, 97, 32, 99, 111, 110, 118, 101, 114, 115, 97, 99, 105, 195, 179, 110, 32, 102, 117, 101, 32, 101, 120, 105, 116, 111, 115, 97, 32, 121, 32, 115, 101, 32, 114, 101, 99, 111, 112, 105, 108, 195, 179, 32, 108, 97, 32, 105, 110, 102, 111, 114, 109, 97, 99, 105, 195, 179, 110, 32, 98, 195, 161, 115, 105, 99, 97, 32, 100, 101, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 46, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 110, 105, 116, 105, 97, 116, 105, 111, 110, 95, 99, 108, 105, 101, 110, 116, 95, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 100, 121, 110, 97, 109, 105, 99, 95, 118, 97, 114, 105, 97, 98, 108, 101, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 110, 97, 109, 101, 34, 58, 32, 34, 74, 117, 97, 110, 32, 80, 195, 169, 114, 101, 122, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 112, 97, 116, 105, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 49, 50, 51, 34, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 125, 10, 32, 32, 125, 10, 125], \"type\": \"Buffer\"}', 500, 'Internal server error', 77, 'Cannot add or update a child row: a foreign key constraint fails (`biosanar`.`call_notifications`, CONSTRAINT `call_notifications_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL)', 0, '2025-08-25 22:41:58'),
(6, 1, 'test_conv_12345', 'transcription', '{\"data\": [123, 10, 32, 32, 34, 116, 121, 112, 101, 34, 58, 32, 34, 112, 111, 115, 116, 95, 99, 97, 108, 108, 95, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 105, 111, 110, 34, 44, 10, 32, 32, 34, 101, 118, 101, 110, 116, 95, 116, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 32, 49, 55, 51, 50, 52, 55, 48, 48, 48, 48, 44, 10, 32, 32, 34, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 34, 97, 103, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 97, 103, 101, 110, 116, 95, 48, 48, 49, 34, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 99, 111, 110, 118, 95, 49, 50, 51, 52, 53, 34, 44, 10, 32, 32, 32, 32, 34, 115, 116, 97, 116, 117, 115, 34, 58, 32, 34, 100, 111, 110, 101, 34, 44, 10, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 117, 115, 101, 114, 95, 55, 56, 57, 34, 44, 10, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 58, 32, 91, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 115, 111, 121, 32, 101, 108, 32, 97, 115, 105, 115, 116, 101, 110, 116, 101, 32, 109, 195, 169, 100, 105, 99, 111, 32, 118, 105, 114, 116, 117, 97, 108, 46, 32, 194, 191, 69, 110, 32, 113, 117, 195, 169, 32, 112, 117, 101, 100, 111, 32, 97, 121, 117, 100, 97, 114, 108, 101, 32, 104, 111, 121, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 48, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 117, 115, 101, 114, 34, 44, 32, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 72, 111, 108, 97, 44, 32, 110, 101, 99, 101, 115, 105, 116, 111, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 51, 10, 32, 32, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 32, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 114, 111, 108, 101, 34, 58, 32, 34, 97, 103, 101, 110, 116, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 109, 101, 115, 115, 97, 103, 101, 34, 58, 32, 34, 80, 111, 114, 32, 115, 117, 112, 117, 101, 115, 116, 111, 46, 32, 194, 191, 80, 111, 100, 114, 195, 173, 97, 32, 112, 114, 111, 112, 111, 114, 99, 105, 111, 110, 97, 114, 109, 101, 32, 115, 117, 32, 110, 111, 109, 98, 114, 101, 32, 99, 111, 109, 112, 108, 101, 116, 111, 32, 121, 32, 100, 111, 99, 117, 109, 101, 110, 116, 111, 32, 100, 101, 32, 105, 100, 101, 110, 116, 105, 100, 97, 100, 63, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 116, 105, 109, 101, 95, 105, 110, 95, 99, 97, 108, 108, 95, 115, 101, 99, 115, 34, 58, 32, 56, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 93, 44, 10, 32, 32, 32, 32, 34, 109, 101, 116, 97, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 115, 116, 97, 114, 116, 95, 116, 105, 109, 101, 95, 117, 110, 105, 120, 95, 115, 101, 99, 115, 34, 58, 32, 49, 55, 51, 50, 52, 54, 57, 57, 52, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 100, 117, 114, 97, 116, 105, 111, 110, 95, 115, 101, 99, 115, 34, 58, 32, 54, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 99, 111, 115, 116, 34, 58, 32, 49, 53, 48, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 101, 114, 109, 105, 110, 97, 116, 105, 111, 110, 95, 114, 101, 97, 115, 111, 110, 34, 58, 32, 34, 117, 115, 101, 114, 95, 104, 97, 110, 103, 117, 112, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 97, 110, 97, 108, 121, 115, 105, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 99, 97, 108, 108, 95, 115, 117, 99, 99, 101, 115, 115, 102, 117, 108, 34, 58, 32, 34, 115, 117, 99, 99, 101, 115, 115, 34, 44, 10, 32, 32, 32, 32, 32, 32, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 95, 115, 117, 109, 109, 97, 114, 121, 34, 58, 32, 34, 69, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 32, 108, 108, 97, 109, 195, 179, 32, 112, 97, 114, 97, 32, 97, 103, 101, 110, 100, 97, 114, 32, 117, 110, 97, 32, 99, 105, 116, 97, 32, 109, 195, 169, 100, 105, 99, 97, 46, 32, 76, 97, 32, 99, 111, 110, 118, 101, 114, 115, 97, 99, 105, 195, 179, 110, 32, 102, 117, 101, 32, 101, 120, 105, 116, 111, 115, 97, 32, 121, 32, 115, 101, 32, 114, 101, 99, 111, 112, 105, 108, 195, 179, 32, 108, 97, 32, 105, 110, 102, 111, 114, 109, 97, 99, 105, 195, 179, 110, 32, 98, 195, 161, 115, 105, 99, 97, 32, 100, 101, 108, 32, 112, 97, 99, 105, 101, 110, 116, 101, 46, 34, 10, 32, 32, 32, 32, 125, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 110, 105, 116, 105, 97, 116, 105, 111, 110, 95, 99, 108, 105, 101, 110, 116, 95, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 100, 121, 110, 97, 109, 105, 99, 95, 118, 97, 114, 105, 97, 98, 108, 101, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 110, 97, 109, 101, 34, 58, 32, 34, 74, 117, 97, 110, 32, 80, 195, 169, 114, 101, 122, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 112, 97, 116, 105, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 49, 50, 51, 34, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 125, 10, 32, 32, 125, 10, 125], \"type\": \"Buffer\"}', 500, 'Internal server error', 45, 'Cannot add or update a child row: a foreign key constraint fails (`biosanar`.`call_notifications`, CONSTRAINT `call_notifications_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL)', 0, '2025-08-25 22:55:03'),
(7, 1, NULL, 'transcription', '{\"data\": [123, 10, 32, 32, 34, 116, 121, 112, 101, 34, 58, 32, 34, 112, 111, 115, 116, 95, 99, 97, 108, 108, 95, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 105, 111, 110, 34, 44, 10, 32, 32, 34, 101, 118, 101, 110, 116, 95, 116, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 32, 49, 55, 51, 50, 52, 55, 48, 48, 48, 48, 44, 10, 32, 32, 34, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 99, 111, 110, 118, 95, 49, 50, 51, 52, 53, 34, 44, 10, 32, 32, 32, 32, 34, 97, 103, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 97, 103, 101, 110, 116, 95, 48, 48, 49, 34, 44, 10, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 105, 100, 34, 58, 32, 34, 116, 101, 115, 116, 95, 117, 115, 101, 114, 95, 49, 50, 51, 52, 53, 34, 44, 10, 32, 32, 32, 32, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 110, 105, 116, 105, 97, 116, 105, 111, 110, 95, 99, 108, 105, 101, 110, 116, 95, 100, 97, 116, 97, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 34, 100, 121, 110, 97, 109, 105, 99, 95, 118, 97, 114, 105, 97, 98, 108, 101, 115, 34, 58, 32, 123, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 112, 97, 116, 105, 101, 110, 116, 95, 105, 100, 34, 58, 32, 34, 57, 57, 57, 34, 44, 10, 32, 32, 32, 32, 32, 32, 32, 32, 34, 117, 115, 101, 114, 95, 110, 97, 109, 101, 34, 58, 32, 34, 80, 97, 99, 105, 101, 110, 116, 101, 32, 84, 101, 115, 116, 32, 87, 101, 98, 104, 111, 111, 107, 34, 10, 32, 32, 32, 32, 32, 32, 125, 10, 32, 32, 32, 32, 125, 44, 10, 125], \"type\": \"Buffer\"}', 500, 'Internal server error', 1, 'Expected double-quoted property name in JSON at position 357 (line 14 column 1)', 0, '2025-08-25 23:07:13'),
(8, 1, 'test_conv_12345', 'transcription', '{\"data\": {\"user_id\": \"test_user_12345\", \"agent_id\": \"test_agent_001\", \"conversation_id\": \"test_conv_12345\", \"conversation_initiation_client_data\": {\"dynamic_variables\": {\"user_name\": \"Paciente Test Webhook\", \"patient_id\": \"999\"}}}, \"type\": \"post_call_transcription\", \"event_timestamp\": 1732470000}', 200, 'Webhook processed successfully', 25, NULL, 0, '2025-08-25 23:09:20'),
(9, 1, 'test_conv_12345', 'transcription', '{\"data\": {\"user_id\": \"test_user_12345\", \"agent_id\": \"test_agent_001\", \"conversation_id\": \"test_conv_12345\", \"conversation_initiation_client_data\": {\"dynamic_variables\": {\"user_name\": \"Paciente Test Webhook\", \"patient_id\": \"999\"}}}, \"type\": \"post_call_transcription\", \"event_timestamp\": 1732470000}', 200, 'Webhook processed successfully', 11, NULL, 0, '2025-08-25 23:12:31'),
(10, 1, 'test_conv_12345', 'transcription', '{\"data\": {\"user_id\": \"test_user_12345\", \"agent_id\": \"test_agent_001\", \"conversation_id\": \"test_conv_12345\", \"conversation_initiation_client_data\": {\"dynamic_variables\": {\"user_name\": \"Paciente Test Webhook\", \"patient_id\": \"999\"}}}, \"type\": \"post_call_transcription\", \"event_timestamp\": 1732470000}', 200, 'Webhook processed successfully', 11, NULL, 0, '2025-08-25 23:15:52'),
(11, 1, NULL, 'call_started', '{}', 400, 'Missing signature header', 1, 'Missing signature header', 0, '2025-08-26 01:22:35'),
(12, 1, NULL, 'call_started', '{}', 400, 'Missing signature header', 1, 'Missing signature header', 0, '2025-08-26 01:43:49'),
(13, 1, NULL, 'call_ended', '{}', 400, 'Missing signature header', 0, 'Missing signature header', 0, '2025-08-26 01:43:49'),
(14, 1, NULL, 'call_started', '{}', 400, 'Missing signature header', 1, 'Missing signature header', 0, '2025-08-26 02:03:08'),
(15, 1, NULL, 'call_started', '{}', 401, 'Invalid webhook signature', 3, 'Invalid webhook signature', 0, '2025-08-26 02:04:43'),
(16, 1, NULL, 'call_started', '{}', 401, 'Invalid webhook signature', 1, 'Invalid webhook signature', 0, '2025-08-26 02:07:44'),
(17, 1, NULL, 'call_ended', '{\"data\": [123, 34, 116, 121, 112, 101, 34, 58, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 46, 101, 110, 100, 101, 100, 34, 44, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 100, 34, 58, 34, 116, 101, 115, 116, 45, 99, 111, 110, 118, 45, 52, 53, 54, 34, 44, 34, 116, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 34, 50, 48, 50, 53, 45, 48, 56, 45, 50, 54, 84, 48, 50, 58, 48, 55, 58, 52, 52, 46, 48, 57, 55, 90, 34, 44, 34, 100, 97, 116, 97, 34, 58, 123, 34, 97, 103, 101, 110, 116, 95, 105, 100, 34, 58, 34, 116, 101, 115, 116, 45, 97, 103, 101, 110, 116, 34, 44, 34, 100, 117, 114, 97, 116, 105, 111, 110, 34, 58, 49, 50, 48, 44, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 58, 34, 84, 101, 115, 116, 32, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 32, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 125, 125], \"type\": \"Buffer\"}', 500, 'Internal server error', 0, 'Invalid time value', 0, '2025-08-26 02:07:44'),
(18, 1, NULL, 'call_started', '{}', 401, 'Invalid webhook signature', 1, 'Invalid webhook signature', 0, '2025-08-26 02:14:53'),
(19, 1, NULL, 'call_ended', '{\"data\": [123, 34, 116, 121, 112, 101, 34, 58, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 46, 101, 110, 100, 101, 100, 34, 44, 34, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 95, 105, 100, 34, 58, 34, 116, 101, 115, 116, 45, 99, 111, 110, 118, 45, 52, 53, 54, 34, 44, 34, 116, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 34, 50, 48, 50, 53, 45, 48, 56, 45, 50, 54, 84, 48, 50, 58, 49, 52, 58, 53, 51, 46, 56, 49, 55, 90, 34, 44, 34, 100, 97, 116, 97, 34, 58, 123, 34, 97, 103, 101, 110, 116, 95, 105, 100, 34, 58, 34, 116, 101, 115, 116, 45, 97, 103, 101, 110, 116, 34, 44, 34, 100, 117, 114, 97, 116, 105, 111, 110, 34, 58, 49, 50, 48, 44, 34, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 58, 34, 84, 101, 115, 116, 32, 99, 111, 110, 118, 101, 114, 115, 97, 116, 105, 111, 110, 32, 116, 114, 97, 110, 115, 99, 114, 105, 112, 116, 34, 125, 125], \"type\": \"Buffer\"}', 500, 'Internal server error', 1, 'Invalid time value', 0, '2025-08-26 02:14:53');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `zones`
--

CREATE TABLE `zones` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `zones`
--

INSERT INTO `zones` (`id`, `name`, `description`, `created_at`) VALUES
(3, 'Zona de Socorro', 'Aqui van los municipio en los que se va prestar el servicio', '2025-08-11 12:19:59'),
(4, 'Zona San Gil', 'Aqui van los municipio en los que se va prestar el servicio', '2025-08-11 12:20:10');

-- --------------------------------------------------------

--
-- Estructura para la vista `active_pregnancies`
--
DROP TABLE IF EXISTS `active_pregnancies`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `active_pregnancies`  AS SELECT `p`.`id` AS `pregnancy_id`, `p`.`patient_id` AS `patient_id`, `pat`.`name` AS `patient_name`, `pat`.`document` AS `patient_document`, `p`.`status` AS `status`, `p`.`start_date` AS `start_date`, `p`.`expected_due_date` AS `expected_due_date`, `p`.`high_risk` AS `high_risk`, (to_days(curdate()) - to_days(`p`.`start_date`)) DIV 7 AS `current_weeks`, (to_days(curdate()) - to_days(`p`.`start_date`)) MOD 7 AS `current_days`, to_days(`p`.`expected_due_date`) - to_days(curdate()) AS `days_until_due`, `p`.`prenatal_controls_count` AS `prenatal_controls_count`, `p`.`last_prenatal_control_date` AS `last_prenatal_control_date`, `p`.`created_at` AS `created_at` FROM (`pregnancies` `p` join `patients` `pat` on(`p`.`patient_id` = `pat`.`id`)) WHERE `p`.`status` = 'Activa' ;

-- --------------------------------------------------------

--
-- Estructura para la vista `appointment_daily_stats`
--
DROP TABLE IF EXISTS `appointment_daily_stats`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `appointment_daily_stats`  AS SELECT cast(`appointments`.`scheduled_at` as date) AS `date`, `appointments`.`location_id` AS `location_id`, `appointments`.`specialty_id` AS `specialty_id`, count(0) AS `total_appointments`, sum(`appointments`.`status` = 'Completada') AS `completed_appointments`, sum(`appointments`.`status` = 'Cancelada') AS `cancelled_appointments`, sum(`appointments`.`status` = 'Pendiente') AS `pending_appointments`, round(sum(`appointments`.`status` = 'Completada') / nullif(count(0),0) * 100,2) AS `completion_rate` FROM `appointments` GROUP BY cast(`appointments`.`scheduled_at` as date), `appointments`.`location_id`, `appointments`.`specialty_id` ;

-- --------------------------------------------------------

--
-- Estructura para la vista `call_stats_view`
--
DROP TABLE IF EXISTS `call_stats_view`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `call_stats_view`  AS SELECT cast(`c`.`start_time` as date) AS `call_date`, `c`.`agent_id` AS `agent_id`, count(0) AS `total_calls`, sum(case when `c`.`call_successful` = 'success' then 1 else 0 end) AS `successful_calls`, sum(case when `c`.`call_successful` = 'failure' then 1 else 0 end) AS `failed_calls`, sum(`c`.`duration_secs`) AS `total_duration_secs`, sum(`c`.`cost`) AS `total_cost`, avg(`c`.`duration_secs`) AS `avg_duration_secs`, avg(`c`.`cost`) AS `avg_cost` FROM `elevenlabs_conversations` AS `c` WHERE `c`.`start_time` is not null GROUP BY cast(`c`.`start_time` as date), `c`.`agent_id` ;

-- --------------------------------------------------------

--
-- Estructura para la vista `doctor_dashboard_stats`
--
DROP TABLE IF EXISTS `doctor_dashboard_stats`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `doctor_dashboard_stats`  AS SELECT `d`.`id` AS `doctor_id`, `d`.`name` AS `doctor_name`, count(distinct `a`.`patient_id`) AS `patients_seen_month`, count(`a`.`id`) AS `total_appointments_month`, count(case when `a`.`status` = 'Completada' then 1 end) AS `completed_appointments`, count(case when cast(`a`.`scheduled_at` as date) = curdate() then 1 end) AS `appointments_today`, count(case when cast(`a`.`scheduled_at` as date) = curdate() and `a`.`status` = 'Pendiente' then 1 end) AS `pending_today`, avg(`a`.`duration_minutes`) AS `avg_appointment_duration` FROM (`doctors` `d` left join `appointments` `a` on(`d`.`id` = `a`.`doctor_id` and `a`.`created_at` >= current_timestamp() - interval 30 day)) GROUP BY `d`.`id`, `d`.`name` ;

-- --------------------------------------------------------

--
-- Estructura para la vista `patient_stats_by_specialty`
--
DROP TABLE IF EXISTS `patient_stats_by_specialty`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `patient_stats_by_specialty`  AS SELECT `s`.`name` AS `specialty_name`, count(distinct `a`.`patient_id`) AS `total_patients`, count(`a`.`id`) AS `total_appointments`, count(case when `a`.`status` = 'Completada' then 1 end) AS `completed_appointments`, count(case when `a`.`status` = 'Cancelada' then 1 end) AS `cancelled_appointments`, round(count(case when `a`.`status` = 'Completada' then 1 end) * 100.0 / count(`a`.`id`),2) AS `completion_rate` FROM (`specialties` `s` left join `appointments` `a` on(`s`.`id` = `a`.`specialty_id`)) WHERE `a`.`created_at` >= current_timestamp() - interval 30 day GROUP BY `s`.`id`, `s`.`name` ORDER BY count(`a`.`id`) DESC ;

-- --------------------------------------------------------

--
-- Estructura para la vista `v_eps_authorizations`
--
DROP TABLE IF EXISTS `v_eps_authorizations`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `v_eps_authorizations`  AS SELECT `ea`.`id` AS `id`, `ea`.`eps_id` AS `eps_id`, `e`.`name` AS `eps_name`, `e`.`code` AS `eps_code`, `e`.`affiliation_type` AS `affiliation_type`, `ea`.`specialty_id` AS `specialty_id`, `s`.`name` AS `specialty_name`, `ea`.`location_id` AS `location_id`, `l`.`name` AS `location_name`, `l`.`municipality_id` AS `municipality_id`, `ea`.`authorized` AS `authorized`, `ea`.`authorization_date` AS `authorization_date`, `ea`.`expiration_date` AS `expiration_date`, `ea`.`max_monthly_appointments` AS `max_monthly_appointments`, `ea`.`copay_percentage` AS `copay_percentage`, `ea`.`requires_prior_authorization` AS `requires_prior_authorization`, `ea`.`notes` AS `notes`, `ea`.`created_at` AS `created_at`, `ea`.`updated_at` AS `updated_at`, CASE WHEN `ea`.`authorized` = 1 AND (`ea`.`authorization_date` is null OR `ea`.`authorization_date` <= curdate()) AND (`ea`.`expiration_date` is null OR `ea`.`expiration_date` >= curdate()) THEN 1 ELSE 0 END AS `is_currently_valid` FROM (((`eps_specialty_location_authorizations` `ea` join `eps` `e` on(`ea`.`eps_id` = `e`.`id`)) join `specialties` `s` on(`ea`.`specialty_id` = `s`.`id`)) join `locations` `l` on(`ea`.`location_id` = `l`.`id`)) ;

-- --------------------------------------------------------

--
-- Estructura para la vista `waiting_list_with_details`
--
DROP TABLE IF EXISTS `waiting_list_with_details`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `waiting_list_with_details`  AS SELECT `wl`.`id` AS `waiting_list_id`, `wl`.`status` AS `status`, `wl`.`priority_level` AS `priority_level`, `wl`.`scheduled_date` AS `requested_date`, `wl`.`appointment_type` AS `appointment_type`, `wl`.`reason` AS `reason`, `wl`.`notes` AS `notes`, `wl`.`created_at` AS `added_to_waiting_list_at`, `wl`.`expires_at` AS `expires_at`, to_days(`wl`.`expires_at`) - to_days(current_timestamp()) AS `days_until_expiration`, `p`.`id` AS `patient_id`, `p`.`name` AS `patient_name`, `p`.`document` AS `patient_document`, `p`.`phone` AS `patient_phone`, `p`.`email` AS `patient_email`, `a`.`id` AS `availability_id`, `a`.`date` AS `availability_date`, `a`.`start_time` AS `start_time`, `a`.`end_time` AS `end_time`, `a`.`duration_minutes` AS `duration_minutes`, (select coalesce(sum(`ad`.`quota`),0) from `availability_distribution` `ad` where `ad`.`availability_id` = `a`.`id`) AS `total_quota_distributed`, `a`.`capacity` AS `total_capacity`, (select count(0) from `appointments` `app` where `app`.`availability_id` = `a`.`id` and `app`.`status` in ('Pendiente','Confirmada')) AS `current_appointments_count`, `a`.`capacity`- (select count(0) from `appointments` `app` where `app`.`availability_id` = `a`.`id` and `app`.`status` in ('Pendiente','Confirmada')) AS `slots_currently_available`, `d`.`id` AS `doctor_id`, `d`.`name` AS `doctor_name`, `d`.`email` AS `doctor_email`, `s`.`id` AS `specialty_id`, `s`.`name` AS `specialty_name`, `l`.`id` AS `location_id`, `l`.`name` AS `location_name`, `l`.`address` AS `location_address`, `wl`.`reassigned_at` AS `reassigned_at`, `wl`.`reassigned_appointment_id` AS `reassigned_appointment_id`, (select count(0) + 1 from `appointments_waiting_list` `wl2` where `wl2`.`availability_id` = `wl`.`availability_id` and `wl2`.`status` = 'pending' and (`wl2`.`priority_level` = 'Urgente' and `wl`.`priority_level` <> 'Urgente' or `wl2`.`priority_level` = 'Alta' and `wl`.`priority_level` not in ('Urgente','Alta') or `wl2`.`priority_level` = 'Normal' and `wl`.`priority_level` = 'Baja' or `wl2`.`priority_level` = `wl`.`priority_level` and `wl2`.`created_at` < `wl`.`created_at`)) AS `queue_position` FROM (((((`appointments_waiting_list` `wl` join `patients` `p` on(`wl`.`patient_id` = `p`.`id`)) join `availabilities` `a` on(`wl`.`availability_id` = `a`.`id`)) join `doctors` `d` on(`a`.`doctor_id` = `d`.`id`)) join `specialties` `s` on(`a`.`specialty_id` = `s`.`id`)) join `locations` `l` on(`a`.`location_id` = `l`.`id`)) WHERE `wl`.`status` = 'pending' ORDER BY CASE `wl`.`priority_level` WHEN 'Urgente' THEN 1 WHEN 'Alta' THEN 2 WHEN 'Normal' THEN 3 WHEN 'Baja' THEN 4 END ASC, `wl`.`created_at` ASC ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `agenda_optimization_metrics`
--
ALTER TABLE `agenda_optimization_metrics`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_metrics_date_doctor` (`date`,`doctor_id`,`specialty_id`,`location_id`),
  ADD KEY `idx_metrics_date` (`date`),
  ADD KEY `idx_metrics_doctor` (`doctor_id`),
  ADD KEY `idx_metrics_utilization` (`utilization_percentage`);

--
-- Indices de la tabla `agenda_suggestions`
--
ALTER TABLE `agenda_suggestions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_suggestion_type` (`suggestion_type`),
  ADD KEY `idx_suggestion_date` (`target_date`),
  ADD KEY `idx_suggestion_status` (`status`),
  ADD KEY `idx_suggestion_confidence` (`confidence_score`);

--
-- Indices de la tabla `agenda_templates`
--
ALTER TABLE `agenda_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_template_doctor` (`doctor_id`),
  ADD KEY `idx_template_specialty` (`specialty_id`),
  ADD KEY `idx_template_location` (`location_id`),
  ADD KEY `idx_template_active` (`active`);

--
-- Indices de la tabla `agent_call_stats`
--
ALTER TABLE `agent_call_stats`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_agent_date` (`agent_id`,`date`),
  ADD KEY `idx_agent_id` (`agent_id`),
  ADD KEY `idx_date` (`date`);

--
-- Indices de la tabla `ai_transfers`
--
ALTER TABLE `ai_transfers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status_created` (`status`,`created_at`),
  ADD KEY `idx_specialty` (`specialty_id`),
  ADD KEY `idx_location` (`preferred_location_id`);

--
-- Indices de la tabla `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_appt_patient` (`patient_id`,`scheduled_at`),
  ADD KEY `idx_appt_status` (`status`),
  ADD KEY `idx_appt_date` (`scheduled_at`),
  ADD KEY `fk_appt_availability` (`availability_id`),
  ADD KEY `fk_appt_location` (`location_id`),
  ADD KEY `fk_appt_specialty` (`specialty_id`),
  ADD KEY `fk_appt_doctor` (`doctor_id`),
  ADD KEY `fk_appt_createdby` (`created_by_user_id`),
  ADD KEY `idx_appt_scheduled_at` (`scheduled_at`),
  ADD KEY `idx_appt_specialty` (`specialty_id`),
  ADD KEY `idx_appt_location` (`location_id`),
  ADD KEY `idx_appt_status_date` (`status`,`scheduled_at`),
  ADD KEY `idx_appt_doctor_date` (`doctor_id`,`scheduled_at`),
  ADD KEY `idx_appt_patient_date` (`patient_id`,`scheduled_at`),
  ADD KEY `idx_appt_availability` (`availability_id`),
  ADD KEY `idx_appointments_availability_status` (`availability_id`,`status`),
  ADD KEY `idx_patient_date_status` (`patient_id`,`scheduled_at`,`status`),
  ADD KEY `idx_doctor_date_status` (`doctor_id`,`scheduled_at`,`status`),
  ADD KEY `idx_appointments_priority` (`priority_level`),
  ADD KEY `idx_appointments_source` (`appointment_source`),
  ADD KEY `idx_appointments_reminder` (`reminder_sent`),
  ADD KEY `idx_appointments_updated_at` (`updated_at`);

--
-- Indices de la tabla `appointments_waiting_list`
--
ALTER TABLE `appointments_waiting_list`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_id` (`patient_id`),
  ADD KEY `idx_availability_id` (`availability_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_priority_level` (`priority_level`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_scheduled_date` (`scheduled_date`),
  ADD KEY `idx_status_priority` (`status`,`priority_level`,`created_at`) COMMENT 'Índice compuesto para ordenar reasignaciones',
  ADD KEY `fk_waiting_list_reassigned_appointment` (`reassigned_appointment_id`),
  ADD KEY `idx_waiting_list_full_search` (`availability_id`,`status`,`priority_level`,`created_at`),
  ADD KEY `idx_call_type` (`call_type`);

--
-- Indices de la tabla `appointment_billing`
--
ALTER TABLE `appointment_billing`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_appt_billing` (`appointment_id`),
  ADD KEY `idx_service` (`service_id`),
  ADD KEY `idx_doctor` (`doctor_id`),
  ADD KEY `idx_ab_status_created` (`status`,`created_at`),
  ADD KEY `idx_ab_doctor_created` (`doctor_id`,`created_at`),
  ADD KEY `idx_ab_service_created` (`service_id`,`created_at`);

--
-- Indices de la tabla `availabilities`
--
ALTER TABLE `availabilities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_avail_date` (`date`),
  ADD KEY `idx_avail_loc_date` (`location_id`,`date`),
  ADD KEY `idx_avail_status` (`status`),
  ADD KEY `fk_avail_specialty` (`specialty_id`),
  ADD KEY `fk_avail_doctor` (`doctor_id`),
  ADD KEY `idx_availability_template` (`template_id`),
  ADD KEY `idx_availability_optimization` (`optimization_score`),
  ADD KEY `idx_availability_date_doctor` (`date`,`doctor_id`),
  ADD KEY `idx_location_specialty_date` (`location_id`,`specialty_id`,`date`);

--
-- Indices de la tabla `availability_distribution`
--
ALTER TABLE `availability_distribution`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_avail_day` (`availability_id`,`day_date`),
  ADD KEY `idx_day_date` (`day_date`);

--
-- Indices de la tabla `billing_audit_logs`
--
ALTER TABLE `billing_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_billing` (`billing_id`),
  ADD KEY `idx_appt` (`appointment_id`);

--
-- Indices de la tabla `blood_groups`
--
ALTER TABLE `blood_groups`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `calls`
--
ALTER TABLE `calls`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `conversation_id` (`conversation_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_priority` (`priority`),
  ADD KEY `idx_start_time` (`start_time`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_calls_status_start` (`status`,`start_time`),
  ADD KEY `idx_calls_priority_status` (`priority`,`status`),
  ADD KEY `idx_calls_start_time` (`start_time`),
  ADD KEY `idx_calls_agent_name` (`agent_name`),
  ADD KEY `idx_calls_patient_name` (`patient_name`),
  ADD KEY `idx_calls_patient_phone` (`patient_phone`),
  ADD KEY `idx_calls_status_priority_start` (`status`,`priority`,`start_time`),
  ADD KEY `idx_calls_status_end` (`status`,`end_time`),
  ADD KEY `idx_calls_priority_status_created` (`priority`,`status`,`created_at`);

--
-- Indices de la tabla `call_events`
--
ALTER TABLE `call_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_call_events_type_time` (`event_type`,`created_at`),
  ADD KEY `idx_call_events_conversation` (`conversation_id`);

--
-- Indices de la tabla `call_logs`
--
ALTER TABLE `call_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_call_patient` (`patient_id`),
  ADD KEY `fk_call_specialty` (`specialty_id`),
  ADD KEY `fk_call_queue` (`queue_id`),
  ADD KEY `fk_call_user` (`user_id`),
  ADD KEY `fk_calllogs_status` (`status_id`);

--
-- Indices de la tabla `call_notifications`
--
ALTER TABLE `call_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_conversation_id` (`conversation_id`),
  ADD KEY `idx_patient_id` (`patient_id`),
  ADD KEY `idx_agent_id` (`agent_id`),
  ADD KEY `idx_call_type` (`call_type`),
  ADD KEY `idx_timestamp` (`timestamp`);

--
-- Indices de la tabla `call_statuses`
--
ALTER TABLE `call_statuses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_call_status_name` (`name`);

--
-- Indices de la tabla `conflict_resolutions`
--
ALTER TABLE `conflict_resolutions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_resolution_availability` (`availability_id`),
  ADD KEY `idx_resolution_type` (`resolution_type`),
  ADD KEY `idx_resolution_date` (`resolved_at`),
  ADD KEY `idx_resolution_user` (`resolved_by`);

--
-- Indices de la tabla `conversation_memory`
--
ALTER TABLE `conversation_memory`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_document` (`patient_document`),
  ADD KEY `idx_session_id` (`session_id`),
  ADD KEY `idx_last_updated` (`last_updated`);

--
-- Indices de la tabla `daily_assignment_config`
--
ALTER TABLE `daily_assignment_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_specialty` (`specialty_id`);

--
-- Indices de la tabla `daily_assignment_queue`
--
ALTER TABLE `daily_assignment_queue`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient` (`patient_id`),
  ADD KEY `idx_specialty` (`specialty_id`),
  ADD KEY `idx_doctor` (`doctor_id`),
  ADD KEY `idx_location` (`location_id`),
  ADD KEY `idx_status_created` (`status`,`created_at`),
  ADD KEY `idx_requested_date` (`requested_date`);

--
-- Indices de la tabla `demand_patterns`
--
ALTER TABLE `demand_patterns`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_pattern` (`day_of_week`,`hour_of_day`,`doctor_id`,`specialty_id`,`location_id`),
  ADD KEY `idx_pattern_dow` (`day_of_week`),
  ADD KEY `idx_pattern_hour` (`hour_of_day`),
  ADD KEY `idx_pattern_demand` (`demand_score`);

--
-- Indices de la tabla `disability_types`
--
ALTER TABLE `disability_types`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `doctors`
--
ALTER TABLE `doctors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_doctors_license` (`license_number`);

--
-- Indices de la tabla `doctor_locations`
--
ALTER TABLE `doctor_locations`
  ADD PRIMARY KEY (`doctor_id`,`location_id`),
  ADD KEY `fk_docloc_location` (`location_id`);

--
-- Indices de la tabla `doctor_service_prices`
--
ALTER TABLE `doctor_service_prices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_doctor_service` (`doctor_id`,`service_id`),
  ADD KEY `idx_service` (`service_id`);

--
-- Indices de la tabla `doctor_specialties`
--
ALTER TABLE `doctor_specialties`
  ADD PRIMARY KEY (`doctor_id`,`specialty_id`),
  ADD KEY `fk_docspec_specialty` (`specialty_id`);

--
-- Indices de la tabla `document_types`
--
ALTER TABLE `document_types`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `education_levels`
--
ALTER TABLE `education_levels`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `elevenlabs_audio`
--
ALTER TABLE `elevenlabs_audio`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_conversation_audio` (`conversation_id`),
  ADD KEY `idx_conversation_id` (`conversation_id`);

--
-- Indices de la tabla `elevenlabs_conversations`
--
ALTER TABLE `elevenlabs_conversations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `conversation_id` (`conversation_id`),
  ADD KEY `idx_conversation_id` (`conversation_id`),
  ADD KEY `idx_agent_id` (`agent_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_start_time` (`start_time`),
  ADD KEY `idx_call_successful` (`call_successful`);

--
-- Indices de la tabla `eps`
--
ALTER TABLE `eps`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_eps_code` (`code`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_affiliation` (`affiliation_type`),
  ADD KEY `idx_has_agreement` (`has_agreement`);

--
-- Indices de la tabla `eps_agreements`
--
ALTER TABLE `eps_agreements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_eps_loc_spec` (`eps_id`,`location_id`,`specialty_id`),
  ADD KEY `fk_epsagr_location` (`location_id`),
  ADD KEY `fk_epsagr_specialty` (`specialty_id`);

--
-- Indices de la tabla `eps_authorization_audit`
--
ALTER TABLE `eps_authorization_audit`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_authorization_id` (`authorization_id`),
  ADD KEY `idx_changed_at` (`changed_at`);

--
-- Indices de la tabla `eps_specialty_location_authorizations`
--
ALTER TABLE `eps_specialty_location_authorizations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_eps_specialty_location` (`eps_id`,`specialty_id`,`location_id`),
  ADD KEY `idx_eps_id` (`eps_id`),
  ADD KEY `idx_specialty_id` (`specialty_id`),
  ADD KEY `idx_location_id` (`location_id`),
  ADD KEY `idx_authorized` (`authorized`),
  ADD KEY `idx_dates` (`authorization_date`,`expiration_date`),
  ADD KEY `idx_active_authorizations` (`authorized`,`authorization_date`,`expiration_date`),
  ADD KEY `idx_eps_location` (`eps_id`,`location_id`),
  ADD KEY `idx_specialty_location` (`specialty_id`,`location_id`);

--
-- Indices de la tabla `feriados`
--
ALTER TABLE `feriados`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_feriado_fecha` (`fecha`),
  ADD KEY `idx_feriado_fecha_activo` (`fecha`,`activo`);

--
-- Indices de la tabla `holidays`
--
ALTER TABLE `holidays`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_date_location` (`date`,`location_id`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_location` (`location_id`);

--
-- Indices de la tabla `lab_orders`
--
ALTER TABLE `lab_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_date` (`patient_id`,`order_date`),
  ADD KEY `idx_doctor_date` (`doctor_id`,`order_date`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `fk_lo_record` (`medical_record_id`);

--
-- Indices de la tabla `lab_order_tests`
--
ALTER TABLE `lab_order_tests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order` (`lab_order_id`),
  ADD KEY `idx_test` (`lab_test_id`);

--
-- Indices de la tabla `lab_results`
--
ALTER TABLE `lab_results`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_test` (`lab_order_test_id`),
  ADD KEY `idx_patient_date` (`patient_id`,`result_date`),
  ADD KEY `idx_abnormal` (`abnormal_flag`),
  ADD KEY `idx_critical` (`critical_result`);

--
-- Indices de la tabla `lab_tests`
--
ALTER TABLE `lab_tests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_test_code` (`code`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_name` (`name`);

--
-- Indices de la tabla `locations`
--
ALTER TABLE `locations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_locations_municipality` (`municipality_id`),
  ADD KEY `idx_loc_municipality` (`municipality_id`);

--
-- Indices de la tabla `location_specialties`
--
ALTER TABLE `location_specialties`
  ADD PRIMARY KEY (`location_id`,`specialty_id`),
  ADD KEY `fk_locspec_specialty` (`specialty_id`);

--
-- Indices de la tabla `location_types`
--
ALTER TABLE `location_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_location_type_name` (`name`);

--
-- Indices de la tabla `marital_statuses`
--
ALTER TABLE `marital_statuses`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `medical_diagnoses`
--
ALTER TABLE `medical_diagnoses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_diagnosis_code` (`code`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_chronic` (`is_chronic`);

--
-- Indices de la tabla `medical_records`
--
ALTER TABLE `medical_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_date` (`patient_id`,`record_date`),
  ADD KEY `idx_doctor_date` (`doctor_id`,`record_date`),
  ADD KEY `idx_appointment` (`appointment_id`),
  ADD KEY `idx_record_type_date` (`record_type`,`record_date`);
ALTER TABLE `medical_records` ADD FULLTEXT KEY `ft_medical_search` (`chief_complaint`,`diagnosis_primary`,`diagnosis_secondary`);

--
-- Indices de la tabla `medical_record_diagnoses`
--
ALTER TABLE `medical_record_diagnoses`
  ADD PRIMARY KEY (`medical_record_id`,`diagnosis_id`),
  ADD KEY `fk_mrd_diagnosis` (`diagnosis_id`);

--
-- Indices de la tabla `medications`
--
ALTER TABLE `medications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_generic_name` (`generic_name`),
  ADD KEY `idx_therapeutic_class` (`therapeutic_class`);

--
-- Indices de la tabla `municipalities`
--
ALTER TABLE `municipalities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_municipality_zone` (`zone_id`,`name`);

--
-- Indices de la tabla `patients`
--
ALTER TABLE `patients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_patients_document` (`document`),
  ADD KEY `idx_patients_name` (`name`),
  ADD KEY `idx_patients_phone` (`phone`),
  ADD KEY `fk_patients_municipality` (`municipality_id`),
  ADD KEY `fk_patients_zone` (`zone_id`),
  ADD KEY `fk_patients_eps` (`insurance_eps_id`),
  ADD KEY `idx_pat_document_type` (`document_type_id`),
  ADD KEY `idx_pat_blood_group` (`blood_group_id`),
  ADD KEY `idx_pat_population_group` (`population_group_id`),
  ADD KEY `idx_pat_education_level` (`education_level_id`),
  ADD KEY `idx_pat_marital_status` (`marital_status_id`),
  ADD KEY `idx_pat_disability_type` (`disability_type_id`),
  ADD KEY `idx_patients_status_name` (`status`,`name`),
  ADD KEY `idx_patients_status_created` (`status`,`created_at`),
  ADD KEY `idx_name_document` (`name`,`document`),
  ADD KEY `idx_phone_search` (`phone`,`phone_alt`),
  ADD KEY `idx_municipality_eps` (`municipality_id`,`insurance_eps_id`);
ALTER TABLE `patients` ADD FULLTEXT KEY `ft_patients_search` (`name`,`document`,`phone`,`email`);
ALTER TABLE `patients` ADD FULLTEXT KEY `ft_patient_search` (`name`,`document`,`email`);

--
-- Indices de la tabla `patient_allergies`
--
ALTER TABLE `patient_allergies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_type` (`patient_id`,`allergen_type`),
  ADD KEY `idx_severity` (`severity`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `fk_pa_doctor` (`doctor_id`);

--
-- Indices de la tabla `patient_medical_history`
--
ALTER TABLE `patient_medical_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_type` (`patient_id`,`history_type`),
  ADD KEY `idx_condition` (`condition`),
  ADD KEY `fk_pmh_doctor` (`doctor_id`);

--
-- Indices de la tabla `pma__bookmark`
--
ALTER TABLE `pma__bookmark`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `pma__central_columns`
--
ALTER TABLE `pma__central_columns`
  ADD PRIMARY KEY (`db_name`,`col_name`);

--
-- Indices de la tabla `pma__column_info`
--
ALTER TABLE `pma__column_info`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `db_name` (`db_name`,`table_name`,`column_name`);

--
-- Indices de la tabla `pma__designer_settings`
--
ALTER TABLE `pma__designer_settings`
  ADD PRIMARY KEY (`username`);

--
-- Indices de la tabla `pma__export_templates`
--
ALTER TABLE `pma__export_templates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `u_user_type_template` (`username`,`export_type`,`template_name`);

--
-- Indices de la tabla `pma__favorite`
--
ALTER TABLE `pma__favorite`
  ADD PRIMARY KEY (`username`);

--
-- Indices de la tabla `pma__history`
--
ALTER TABLE `pma__history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `username` (`username`,`db`,`table`,`timevalue`);

--
-- Indices de la tabla `pma__navigationhiding`
--
ALTER TABLE `pma__navigationhiding`
  ADD PRIMARY KEY (`username`,`item_name`,`item_type`,`db_name`,`table_name`);

--
-- Indices de la tabla `pma__pdf_pages`
--
ALTER TABLE `pma__pdf_pages`
  ADD PRIMARY KEY (`page_nr`),
  ADD KEY `db_name` (`db_name`);

--
-- Indices de la tabla `pma__recent`
--
ALTER TABLE `pma__recent`
  ADD PRIMARY KEY (`username`);

--
-- Indices de la tabla `pma__relation`
--
ALTER TABLE `pma__relation`
  ADD PRIMARY KEY (`master_db`,`master_table`,`master_field`),
  ADD KEY `foreign_field` (`foreign_db`,`foreign_table`);

--
-- Indices de la tabla `pma__savedsearches`
--
ALTER TABLE `pma__savedsearches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `u_savedsearches_username_dbname` (`username`,`db_name`,`search_name`);

--
-- Indices de la tabla `pma__table_coords`
--
ALTER TABLE `pma__table_coords`
  ADD PRIMARY KEY (`db_name`,`table_name`,`pdf_page_number`);

--
-- Indices de la tabla `pma__table_info`
--
ALTER TABLE `pma__table_info`
  ADD PRIMARY KEY (`db_name`,`table_name`);

--
-- Indices de la tabla `pma__table_uiprefs`
--
ALTER TABLE `pma__table_uiprefs`
  ADD PRIMARY KEY (`username`,`db_name`,`table_name`);

--
-- Indices de la tabla `pma__tracking`
--
ALTER TABLE `pma__tracking`
  ADD PRIMARY KEY (`db_name`,`table_name`,`version`);

--
-- Indices de la tabla `pma__userconfig`
--
ALTER TABLE `pma__userconfig`
  ADD PRIMARY KEY (`username`);

--
-- Indices de la tabla `pma__usergroups`
--
ALTER TABLE `pma__usergroups`
  ADD PRIMARY KEY (`usergroup`,`tab`,`allowed`);

--
-- Indices de la tabla `pma__users`
--
ALTER TABLE `pma__users`
  ADD PRIMARY KEY (`username`,`usergroup`);

--
-- Indices de la tabla `population_groups`
--
ALTER TABLE `population_groups`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `pregnancies`
--
ALTER TABLE `pregnancies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_status` (`patient_id`,`status`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_expected_due_date` (`expected_due_date`),
  ADD KEY `idx_start_date` (`start_date`);

--
-- Indices de la tabla `prenatal_controls`
--
ALTER TABLE `prenatal_controls`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pregnancy_date` (`pregnancy_id`,`control_date`),
  ADD KEY `idx_control_date` (`control_date`);

--
-- Indices de la tabla `prescriptions`
--
ALTER TABLE `prescriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_date` (`patient_id`,`prescription_date`),
  ADD KEY `idx_doctor_date` (`doctor_id`,`prescription_date`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `fk_prescription_record` (`medical_record_id`);

--
-- Indices de la tabla `prescription_medications`
--
ALTER TABLE `prescription_medications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_prescription` (`prescription_id`),
  ADD KEY `idx_medication` (`medication_id`);

--
-- Indices de la tabla `queue_entries`
--
ALTER TABLE `queue_entries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status_created` (`status`,`created_at`),
  ADD KEY `idx_specialty_status_created` (`specialty_id`,`status`,`created_at`),
  ADD KEY `idx_assigned_user` (`assigned_user_id`);

--
-- Indices de la tabla `scheduling_preallocation`
--
ALTER TABLE `scheduling_preallocation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_availability` (`availability_id`);

--
-- Indices de la tabla `scheduling_preallocation_assignments`
--
ALTER TABLE `scheduling_preallocation_assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_preallocation_assignment` (`preallocation_id`),
  ADD KEY `idx_patient` (`patient_id`);

--
-- Indices de la tabla `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_service_name` (`name`),
  ADD KEY `idx_service_active_name` (`active`,`name`);

--
-- Indices de la tabla `specialties`
--
ALTER TABLE `specialties`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_specialty_name` (`name`);

--
-- Indices de la tabla `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `timezones`
--
ALTER TABLE `timezones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_timezone_name` (`name`);

--
-- Indices de la tabla `treatment_plans`
--
ALTER TABLE `treatment_plans`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_patient_status` (`patient_id`,`status`),
  ADD KEY `idx_doctor` (`doctor_id`),
  ADD KEY `idx_start_date` (`start_date`),
  ADD KEY `fk_tp_record` (`medical_record_id`);

--
-- Indices de la tabla `treatment_tasks`
--
ALTER TABLE `treatment_tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_plan_status` (`treatment_plan_id`,`status`),
  ADD KEY `idx_due_date` (`due_date`),
  ADD KEY `idx_task_type` (`task_type`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_users_email` (`email`);

--
-- Indices de la tabla `voice_calls`
--
ALTER TABLE `voice_calls`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `call_id` (`call_id`);

--
-- Indices de la tabla `waiting_queue`
--
ALTER TABLE `waiting_queue`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_queue_status` (`status`),
  ADD KEY `idx_queue_specialty` (`specialty_id`),
  ADD KEY `fk_queue_patient` (`patient_id`);

--
-- Indices de la tabla `webhook_config`
--
ALTER TABLE `webhook_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_service` (`service_name`),
  ADD KEY `idx_service_name` (`service_name`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indices de la tabla `webhook_logs`
--
ALTER TABLE `webhook_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_webhook_config_id` (`webhook_config_id`),
  ADD KEY `idx_conversation_id` (`conversation_id`),
  ADD KEY `idx_webhook_type` (`webhook_type`),
  ADD KEY `idx_response_status` (`response_status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indices de la tabla `zones`
--
ALTER TABLE `zones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `agenda_optimization_metrics`
--
ALTER TABLE `agenda_optimization_metrics`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `agenda_suggestions`
--
ALTER TABLE `agenda_suggestions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `agenda_templates`
--
ALTER TABLE `agenda_templates`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `agent_call_stats`
--
ALTER TABLE `agent_call_stats`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ai_transfers`
--
ALTER TABLE `ai_transfers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `appointments_waiting_list`
--
ALTER TABLE `appointments_waiting_list`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT de la tabla `appointment_billing`
--
ALTER TABLE `appointment_billing`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `availabilities`
--
ALTER TABLE `availabilities`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=160;

--
-- AUTO_INCREMENT de la tabla `availability_distribution`
--
ALTER TABLE `availability_distribution`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=346;

--
-- AUTO_INCREMENT de la tabla `billing_audit_logs`
--
ALTER TABLE `billing_audit_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `blood_groups`
--
ALTER TABLE `blood_groups`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=49;

--
-- AUTO_INCREMENT de la tabla `calls`
--
ALTER TABLE `calls`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `call_events`
--
ALTER TABLE `call_events`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `call_logs`
--
ALTER TABLE `call_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `call_notifications`
--
ALTER TABLE `call_notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `call_statuses`
--
ALTER TABLE `call_statuses`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=838;

--
-- AUTO_INCREMENT de la tabla `conflict_resolutions`
--
ALTER TABLE `conflict_resolutions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `conversation_memory`
--
ALTER TABLE `conversation_memory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT de la tabla `daily_assignment_config`
--
ALTER TABLE `daily_assignment_config`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `daily_assignment_queue`
--
ALTER TABLE `daily_assignment_queue`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `demand_patterns`
--
ALTER TABLE `demand_patterns`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `disability_types`
--
ALTER TABLE `disability_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `doctors`
--
ALTER TABLE `doctors`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT de la tabla `doctor_service_prices`
--
ALTER TABLE `doctor_service_prices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `document_types`
--
ALTER TABLE `document_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `education_levels`
--
ALTER TABLE `education_levels`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT de la tabla `elevenlabs_audio`
--
ALTER TABLE `elevenlabs_audio`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `elevenlabs_conversations`
--
ALTER TABLE `elevenlabs_conversations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `eps`
--
ALTER TABLE `eps`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=74;

--
-- AUTO_INCREMENT de la tabla `eps_agreements`
--
ALTER TABLE `eps_agreements`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `eps_authorization_audit`
--
ALTER TABLE `eps_authorization_audit`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `eps_specialty_location_authorizations`
--
ALTER TABLE `eps_specialty_location_authorizations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT de la tabla `feriados`
--
ALTER TABLE `feriados`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de la tabla `holidays`
--
ALTER TABLE `holidays`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `lab_orders`
--
ALTER TABLE `lab_orders`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `lab_order_tests`
--
ALTER TABLE `lab_order_tests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `lab_results`
--
ALTER TABLE `lab_results`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `lab_tests`
--
ALTER TABLE `lab_tests`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT de la tabla `locations`
--
ALTER TABLE `locations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `location_types`
--
ALTER TABLE `location_types`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=929;

--
-- AUTO_INCREMENT de la tabla `marital_statuses`
--
ALTER TABLE `marital_statuses`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `medical_diagnoses`
--
ALTER TABLE `medical_diagnoses`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `medical_records`
--
ALTER TABLE `medical_records`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `medications`
--
ALTER TABLE `medications`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `municipalities`
--
ALTER TABLE `municipalities`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT de la tabla `patients`
--
ALTER TABLE `patients`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1074;

--
-- AUTO_INCREMENT de la tabla `patient_allergies`
--
ALTER TABLE `patient_allergies`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `patient_medical_history`
--
ALTER TABLE `patient_medical_history`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pma__bookmark`
--
ALTER TABLE `pma__bookmark`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pma__column_info`
--
ALTER TABLE `pma__column_info`
  MODIFY `id` int(5) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pma__export_templates`
--
ALTER TABLE `pma__export_templates`
  MODIFY `id` int(5) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pma__history`
--
ALTER TABLE `pma__history`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pma__pdf_pages`
--
ALTER TABLE `pma__pdf_pages`
  MODIFY `page_nr` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pma__savedsearches`
--
ALTER TABLE `pma__savedsearches`
  MODIFY `id` int(5) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `population_groups`
--
ALTER TABLE `population_groups`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=55;

--
-- AUTO_INCREMENT de la tabla `pregnancies`
--
ALTER TABLE `pregnancies`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `prenatal_controls`
--
ALTER TABLE `prenatal_controls`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `prescriptions`
--
ALTER TABLE `prescriptions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `prescription_medications`
--
ALTER TABLE `prescription_medications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `queue_entries`
--
ALTER TABLE `queue_entries`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `scheduling_preallocation`
--
ALTER TABLE `scheduling_preallocation`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=97;

--
-- AUTO_INCREMENT de la tabla `scheduling_preallocation_assignments`
--
ALTER TABLE `scheduling_preallocation_assignments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `services`
--
ALTER TABLE `services`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=886;

--
-- AUTO_INCREMENT de la tabla `specialties`
--
ALTER TABLE `specialties`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT de la tabla `timezones`
--
ALTER TABLE `timezones`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5350;

--
-- AUTO_INCREMENT de la tabla `treatment_plans`
--
ALTER TABLE `treatment_plans`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `treatment_tasks`
--
ALTER TABLE `treatment_tasks`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `voice_calls`
--
ALTER TABLE `voice_calls`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `waiting_queue`
--
ALTER TABLE `waiting_queue`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `webhook_config`
--
ALTER TABLE `webhook_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `webhook_logs`
--
ALTER TABLE `webhook_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT de la tabla `zones`
--
ALTER TABLE `zones`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `ai_transfers`
--
ALTER TABLE `ai_transfers`
  ADD CONSTRAINT `fk_ai_transfers_location` FOREIGN KEY (`preferred_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ai_transfers_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `appointments`
--
ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appt_availability` FOREIGN KEY (`availability_id`) REFERENCES `availabilities` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_appt_createdby` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_appt_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`),
  ADD CONSTRAINT `fk_appt_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`),
  ADD CONSTRAINT `fk_appt_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  ADD CONSTRAINT `fk_appt_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`);

--
-- Filtros para la tabla `appointments_waiting_list`
--
ALTER TABLE `appointments_waiting_list`
  ADD CONSTRAINT `fk_waiting_list_availability` FOREIGN KEY (`availability_id`) REFERENCES `availabilities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_waiting_list_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_waiting_list_reassigned_appointment` FOREIGN KEY (`reassigned_appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `appointment_billing`
--
ALTER TABLE `appointment_billing`
  ADD CONSTRAINT `fk_ab_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`);

--
-- Filtros para la tabla `availabilities`
--
ALTER TABLE `availabilities`
  ADD CONSTRAINT `fk_avail_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`),
  ADD CONSTRAINT `fk_avail_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`),
  ADD CONSTRAINT `fk_avail_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`);

--
-- Filtros para la tabla `availability_distribution`
--
ALTER TABLE `availability_distribution`
  ADD CONSTRAINT `fk_ad_availability` FOREIGN KEY (`availability_id`) REFERENCES `availabilities` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `call_logs`
--
ALTER TABLE `call_logs`
  ADD CONSTRAINT `fk_call_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_call_queue` FOREIGN KEY (`queue_id`) REFERENCES `waiting_queue` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_call_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_call_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_calllogs_status` FOREIGN KEY (`status_id`) REFERENCES `call_statuses` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `call_notifications`
--
ALTER TABLE `call_notifications`
  ADD CONSTRAINT `call_notifications_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `call_notifications_ibfk_2` FOREIGN KEY (`conversation_id`) REFERENCES `elevenlabs_conversations` (`conversation_id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `daily_assignment_config`
--
ALTER TABLE `daily_assignment_config`
  ADD CONSTRAINT `fk_daily_config_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `doctor_locations`
--
ALTER TABLE `doctor_locations`
  ADD CONSTRAINT `fk_docloc_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_docloc_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`);

--
-- Filtros para la tabla `doctor_service_prices`
--
ALTER TABLE `doctor_service_prices`
  ADD CONSTRAINT `fk_dsp_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `doctor_specialties`
--
ALTER TABLE `doctor_specialties`
  ADD CONSTRAINT `fk_docspec_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_docspec_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`);

--
-- Filtros para la tabla `elevenlabs_audio`
--
ALTER TABLE `elevenlabs_audio`
  ADD CONSTRAINT `elevenlabs_audio_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `elevenlabs_conversations` (`conversation_id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `eps_agreements`
--
ALTER TABLE `eps_agreements`
  ADD CONSTRAINT `fk_epsagr_eps` FOREIGN KEY (`eps_id`) REFERENCES `eps` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_epsagr_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_epsagr_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `eps_specialty_location_authorizations`
--
ALTER TABLE `eps_specialty_location_authorizations`
  ADD CONSTRAINT `fk_eps_auth_eps` FOREIGN KEY (`eps_id`) REFERENCES `eps` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_eps_auth_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_eps_auth_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `lab_orders`
--
ALTER TABLE `lab_orders`
  ADD CONSTRAINT `fk_lo_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`),
  ADD CONSTRAINT `fk_lo_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  ADD CONSTRAINT `fk_lo_record` FOREIGN KEY (`medical_record_id`) REFERENCES `medical_records` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `lab_order_tests`
--
ALTER TABLE `lab_order_tests`
  ADD CONSTRAINT `fk_lot_order` FOREIGN KEY (`lab_order_id`) REFERENCES `lab_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lot_test` FOREIGN KEY (`lab_test_id`) REFERENCES `lab_tests` (`id`);

--
-- Filtros para la tabla `lab_results`
--
ALTER TABLE `lab_results`
  ADD CONSTRAINT `fk_lr_order_test` FOREIGN KEY (`lab_order_test_id`) REFERENCES `lab_order_tests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lr_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`);

--
-- Filtros para la tabla `locations`
--
ALTER TABLE `locations`
  ADD CONSTRAINT `fk_locations_municipality` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `location_specialties`
--
ALTER TABLE `location_specialties`
  ADD CONSTRAINT `fk_locspec_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_locspec_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `medical_records`
--
ALTER TABLE `medical_records`
  ADD CONSTRAINT `fk_medrecord_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_medrecord_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`),
  ADD CONSTRAINT `fk_medrecord_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `medical_record_diagnoses`
--
ALTER TABLE `medical_record_diagnoses`
  ADD CONSTRAINT `fk_mrd_diagnosis` FOREIGN KEY (`diagnosis_id`) REFERENCES `medical_diagnoses` (`id`),
  ADD CONSTRAINT `fk_mrd_record` FOREIGN KEY (`medical_record_id`) REFERENCES `medical_records` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `municipalities`
--
ALTER TABLE `municipalities`
  ADD CONSTRAINT `fk_municipalities_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`);

--
-- Filtros para la tabla `patients`
--
ALTER TABLE `patients`
  ADD CONSTRAINT `fk_pat_blood_group` FOREIGN KEY (`blood_group_id`) REFERENCES `blood_groups` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_disability_type` FOREIGN KEY (`disability_type_id`) REFERENCES `disability_types` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_document_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_education_level` FOREIGN KEY (`education_level_id`) REFERENCES `education_levels` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_marital_status` FOREIGN KEY (`marital_status_id`) REFERENCES `marital_statuses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pat_population_group` FOREIGN KEY (`population_group_id`) REFERENCES `population_groups` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_patients_eps` FOREIGN KEY (`insurance_eps_id`) REFERENCES `eps` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_patients_municipality` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_patients_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `patient_allergies`
--
ALTER TABLE `patient_allergies`
  ADD CONSTRAINT `fk_pa_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pa_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `patient_medical_history`
--
ALTER TABLE `patient_medical_history`
  ADD CONSTRAINT `fk_pmh_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pmh_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `pregnancies`
--
ALTER TABLE `pregnancies`
  ADD CONSTRAINT `pregnancies_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `prenatal_controls`
--
ALTER TABLE `prenatal_controls`
  ADD CONSTRAINT `prenatal_controls_ibfk_1` FOREIGN KEY (`pregnancy_id`) REFERENCES `pregnancies` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `prescriptions`
--
ALTER TABLE `prescriptions`
  ADD CONSTRAINT `fk_prescription_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`),
  ADD CONSTRAINT `fk_prescription_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  ADD CONSTRAINT `fk_prescription_record` FOREIGN KEY (`medical_record_id`) REFERENCES `medical_records` (`id`);

--
-- Filtros para la tabla `prescription_medications`
--
ALTER TABLE `prescription_medications`
  ADD CONSTRAINT `fk_pm_medication` FOREIGN KEY (`medication_id`) REFERENCES `medications` (`id`),
  ADD CONSTRAINT `fk_pm_prescription` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `scheduling_preallocation_assignments`
--
ALTER TABLE `scheduling_preallocation_assignments`
  ADD CONSTRAINT `fk_preallocation_assignment` FOREIGN KEY (`preallocation_id`) REFERENCES `scheduling_preallocation` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `treatment_plans`
--
ALTER TABLE `treatment_plans`
  ADD CONSTRAINT `fk_tp_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`),
  ADD CONSTRAINT `fk_tp_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_tp_record` FOREIGN KEY (`medical_record_id`) REFERENCES `medical_records` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `treatment_tasks`
--
ALTER TABLE `treatment_tasks`
  ADD CONSTRAINT `fk_tt_plan` FOREIGN KEY (`treatment_plan_id`) REFERENCES `treatment_plans` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `waiting_queue`
--
ALTER TABLE `waiting_queue`
  ADD CONSTRAINT `fk_queue_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_queue_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`);

--
-- Filtros para la tabla `webhook_logs`
--
ALTER TABLE `webhook_logs`
  ADD CONSTRAINT `webhook_logs_ibfk_1` FOREIGN KEY (`webhook_config_id`) REFERENCES `webhook_config` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
