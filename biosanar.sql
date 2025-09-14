-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Servidor: localhost:3306
-- Tiempo de generación: 14-09-2025 a las 00:01:31
-- Versión del servidor: 8.0.43-0ubuntu0.24.04.1
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
    INSERT INTO agent_call_stats (
        agent_id, 
        date, 
        total_calls, 
        successful_calls, 
        failed_calls, 
        total_duration_secs, 
        total_cost, 
        avg_call_duration
    )
    SELECT 
        agent_id,
        call_date,
        total_calls,
        successful_calls,
        failed_calls,
        total_duration_secs,
        total_cost,
        avg_duration_secs
    FROM call_stats_view 
    WHERE agent_id = p_agent_id AND call_date = p_date
    ON DUPLICATE KEY UPDATE
        total_calls = VALUES(total_calls),
        successful_calls = VALUES(successful_calls),
        failed_calls = VALUES(failed_calls),
        total_duration_secs = VALUES(total_duration_secs),
        total_cost = VALUES(total_cost),
        avg_call_duration = VALUES(avg_call_duration),
        updated_at = CURRENT_TIMESTAMP$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `agenda_optimization_metrics`
--

CREATE TABLE `agenda_optimization_metrics` (
  `id` int UNSIGNED NOT NULL,
  `date` date NOT NULL,
  `doctor_id` bigint UNSIGNED DEFAULT NULL,
  `specialty_id` int UNSIGNED DEFAULT NULL,
  `location_id` int UNSIGNED DEFAULT NULL,
  `total_slots` int NOT NULL DEFAULT '0',
  `total_capacity` int NOT NULL DEFAULT '0',
  `total_occupied` int NOT NULL DEFAULT '0',
  `utilization_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `efficiency_score` decimal(5,2) NOT NULL DEFAULT '0.00',
  `conflicts_detected` int NOT NULL DEFAULT '0',
  `conflicts_resolved` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `agenda_suggestions`
--

CREATE TABLE `agenda_suggestions` (
  `id` int UNSIGNED NOT NULL,
  `suggestion_type` enum('new_slot','modify_capacity','reschedule','cancel_slot') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_date` date NOT NULL,
  `target_time` time DEFAULT NULL,
  `doctor_id` bigint UNSIGNED DEFAULT NULL,
  `specialty_id` int UNSIGNED DEFAULT NULL,
  `location_id` int UNSIGNED DEFAULT NULL,
  `suggested_capacity` int DEFAULT NULL,
  `confidence_score` decimal(5,2) NOT NULL DEFAULT '0.00',
  `reasoning` text COLLATE utf8mb4_unicode_ci,
  `suggestion_data` json DEFAULT NULL,
  `status` enum('pending','accepted','rejected','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `processed_by` int UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `agenda_templates`
--

CREATE TABLE `agenda_templates` (
  `id` int UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `doctor_id` int UNSIGNED DEFAULT NULL,
  `specialty_id` int UNSIGNED DEFAULT NULL,
  `location_id` int UNSIGNED DEFAULT NULL,
  `days_of_week` json NOT NULL COMMENT 'Array de días de la semana [1,2,3,4,5]',
  `time_slots` json NOT NULL COMMENT 'Array de horarios [{"start":"08:00","end":"12:00","capacity":4}]',
  `duration_minutes` int NOT NULL DEFAULT '30',
  `break_between_slots` int NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
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
  `id` int NOT NULL,
  `agent_id` varchar(255) NOT NULL,
  `date` date NOT NULL,
  `total_calls` int DEFAULT '0',
  `successful_calls` int DEFAULT '0',
  `failed_calls` int DEFAULT '0',
  `total_duration_secs` int DEFAULT '0',
  `total_cost` int DEFAULT '0',
  `avg_call_duration` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ai_transfers`
--

CREATE TABLE `ai_transfers` (
  `id` bigint UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('pending','accepted','rejected','completed') NOT NULL DEFAULT 'pending',
  `patient_id` int UNSIGNED DEFAULT NULL,
  `patient_name` varchar(150) DEFAULT NULL,
  `patient_identifier` varchar(50) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `specialty_id` int UNSIGNED DEFAULT NULL,
  `preferred_location_id` int UNSIGNED DEFAULT NULL,
  `priority` enum('Alta','Media','Baja') DEFAULT 'Media',
  `transfer_reason` varchar(255) DEFAULT NULL,
  `ai_observation` text,
  `assigned_user_id` int UNSIGNED DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `rejected_reason` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `appointments`
--

CREATE TABLE `appointments` (
  `id` bigint UNSIGNED NOT NULL,
  `patient_id` bigint UNSIGNED NOT NULL,
  `availability_id` bigint UNSIGNED DEFAULT NULL,
  `location_id` int UNSIGNED NOT NULL,
  `specialty_id` int UNSIGNED NOT NULL,
  `doctor_id` bigint UNSIGNED NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `duration_minutes` smallint UNSIGNED NOT NULL DEFAULT '30',
  `appointment_type` enum('Presencial','Telemedicina') NOT NULL DEFAULT 'Presencial',
  `status` enum('Pendiente','Confirmada','Completada','Cancelada') NOT NULL DEFAULT 'Pendiente',
  `reason` varchar(255) DEFAULT NULL,
  `insurance_type` varchar(100) DEFAULT NULL,
  `notes` text,
  `cancellation_reason` varchar(255) DEFAULT NULL,
  `created_by_user_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `appointments`
--

INSERT INTO `appointments` (`id`, `patient_id`, `availability_id`, `location_id`, `specialty_id`, `doctor_id`, `scheduled_at`, `duration_minutes`, `appointment_type`, `status`, `reason`, `insurance_type`, `notes`, `cancellation_reason`, `created_by_user_id`, `created_at`) VALUES
(101, 1019, NULL, 1, 1, 6, '2025-09-01 15:00:00', 30, 'Presencial', 'Pendiente', 'Consulta medicina general', NULL, NULL, NULL, NULL, '2025-09-01 15:12:51'),
(102, 1020, NULL, 1, 7, 7, '2025-09-06 08:00:00', 30, 'Presencial', 'Pendiente', 'Terapia psicológica para hijo', NULL, NULL, NULL, NULL, '2025-09-01 15:17:35'),
(103, 1021, NULL, 1, 8, 5, '2025-09-05 10:00:00', 30, 'Presencial', 'Cancelada', 'Consulta pediatría', NULL, 'Cambio de horario solicitado por paciente', NULL, NULL, '2025-09-01 15:21:55'),
(104, 1021, NULL, 1, 8, 5, '2025-09-05 16:00:00', 30, 'Presencial', 'Pendiente', 'Consulta pediatría con resultados de laboratorio', NULL, NULL, NULL, NULL, '2025-09-01 15:26:05');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `appointment_billing`
--

CREATE TABLE `appointment_billing` (
  `id` bigint UNSIGNED NOT NULL,
  `appointment_id` int UNSIGNED NOT NULL,
  `service_id` int UNSIGNED NOT NULL,
  `doctor_id` int UNSIGNED NOT NULL,
  `base_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `doctor_price` decimal(10,2) DEFAULT NULL,
  `final_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` char(3) NOT NULL DEFAULT 'COP',
  `status` enum('pending','billed','paid','cancelled') NOT NULL DEFAULT 'pending',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `appointment_daily_stats`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `appointment_daily_stats` (
`cancelled_appointments` decimal(23,0)
,`completed_appointments` decimal(23,0)
,`completion_rate` decimal(29,2)
,`date` date
,`location_id` int unsigned
,`pending_appointments` decimal(23,0)
,`specialty_id` int unsigned
,`total_appointments` bigint
);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `availabilities`
--

CREATE TABLE `availabilities` (
  `id` bigint UNSIGNED NOT NULL,
  `location_id` int UNSIGNED NOT NULL,
  `specialty_id` int UNSIGNED NOT NULL,
  `doctor_id` bigint UNSIGNED NOT NULL,
  `date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `capacity` smallint UNSIGNED NOT NULL DEFAULT '1',
  `booked_slots` smallint UNSIGNED NOT NULL DEFAULT '0',
  `status` enum('Activa','Cancelada','Completa') NOT NULL DEFAULT 'Activa',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_from_template` tinyint(1) DEFAULT '0',
  `template_id` int UNSIGNED DEFAULT NULL,
  `optimization_score` decimal(5,2) DEFAULT NULL COMMENT 'Score de optimización 0-100',
  `last_optimization_date` timestamp NULL DEFAULT NULL,
  `duration_minutes` int NOT NULL DEFAULT '30',
  `break_between_slots` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `availabilities`
--

INSERT INTO `availabilities` (`id`, `location_id`, `specialty_id`, `doctor_id`, `date`, `start_time`, `end_time`, `capacity`, `booked_slots`, `status`, `notes`, `created_at`, `created_from_template`, `template_id`, `optimization_score`, `last_optimization_date`, `duration_minutes`, `break_between_slots`) VALUES
(46, 1, 1, 6, '2025-09-01', '08:00:00', '12:00:00', 16, 0, 'Activa', '(estar 15 minuos anters para que puedan facturar)', '2025-08-31 18:29:38', 0, NULL, NULL, NULL, 30, 0),
(47, 1, 1, 6, '2025-09-01', '08:00:00', '12:00:00', 16, 0, 'Activa', '', '2025-08-31 18:31:58', 0, NULL, NULL, NULL, 30, 0),
(48, 1, 1, 6, '2025-09-08', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-01 22:33:52', 0, NULL, NULL, NULL, 30, 0),
(49, 1, 1, 6, '2025-09-08', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-01 22:35:01', 0, NULL, NULL, NULL, 30, 0),
(50, 1, 1, 6, '2025-09-09', '08:00:00', '12:00:00', 20, 0, 'Activa', '(DEBEN ESTAR DE 10 A 15 MINUTOS ANTES FACTURANDO)', '2025-09-01 22:35:56', 0, NULL, NULL, NULL, 30, 0),
(51, 1, 1, 6, '2025-09-09', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS PARA FACTURAR)', '2025-09-01 22:36:56', 0, NULL, NULL, NULL, 30, 0),
(52, 1, 1, 6, '2025-09-10', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-01 22:38:00', 0, NULL, NULL, NULL, 30, 0),
(53, 1, 1, 6, '2025-09-10', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA PODER FACTURAR) ', '2025-09-01 22:38:47', 0, NULL, NULL, NULL, 30, 0),
(54, 1, 1, 6, '2025-09-11', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-01 22:39:53', 0, NULL, NULL, NULL, 30, 0),
(55, 1, 1, 6, '2025-09-11', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR', '2025-09-01 22:40:33', 0, NULL, NULL, NULL, 30, 0),
(56, 1, 1, 6, '2025-09-12', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:25:51', 0, NULL, NULL, NULL, 30, 0),
(57, 1, 1, 6, '2025-09-12', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:26:33', 0, NULL, NULL, NULL, 30, 0),
(58, 1, 1, 6, '2025-09-15', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:27:28', 0, NULL, NULL, NULL, 30, 0),
(59, 1, 1, 6, '2025-09-15', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:28:03', 0, NULL, NULL, NULL, 30, 0),
(60, 1, 1, 6, '2025-09-16', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:28:37', 0, NULL, NULL, NULL, 30, 0),
(61, 1, 1, 6, '2025-09-16', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:29:17', 0, NULL, NULL, NULL, 30, 0),
(62, 1, 1, 6, '2025-09-17', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:30:17', 0, NULL, NULL, NULL, 30, 0),
(63, 1, 1, 6, '2025-09-16', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:30:45', 0, NULL, NULL, NULL, 30, 0),
(64, 1, 1, 6, '2025-09-17', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:33:36', 0, NULL, NULL, NULL, 30, 0),
(65, 1, 1, 6, '2025-09-18', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:34:06', 0, NULL, NULL, NULL, 30, 0),
(66, 1, 1, 6, '2025-09-18', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:34:48', 0, NULL, NULL, NULL, 30, 0),
(67, 1, 1, 6, '2025-09-19', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:35:28', 0, NULL, NULL, NULL, 30, 0),
(68, 1, 1, 6, '2025-09-19', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 O 15 MINUTOS ANTES PARA PODER FACTURAR)', '2025-09-02 00:35:59', 0, NULL, NULL, NULL, 30, 0),
(69, 1, 1, 6, '2025-09-22', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:24:27', 0, NULL, NULL, NULL, 30, 0),
(70, 1, 1, 6, '2025-09-22', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:24:53', 0, NULL, NULL, NULL, 30, 0),
(71, 1, 1, 6, '2025-09-23', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:26:18', 0, NULL, NULL, NULL, 30, 0),
(72, 1, 1, 6, '2025-09-24', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:26:47', 0, NULL, NULL, NULL, 30, 0),
(73, 1, 1, 6, '2025-09-24', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:27:18', 0, NULL, NULL, NULL, 30, 0),
(74, 1, 1, 6, '2025-09-23', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:27:41', 0, NULL, NULL, NULL, 30, 0),
(75, 1, 1, 6, '2025-09-25', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:29:08', 0, NULL, NULL, NULL, 30, 0),
(76, 1, 1, 6, '2025-09-25', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:29:32', 0, NULL, NULL, NULL, 30, 0),
(77, 1, 1, 6, '2025-09-26', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:31:08', 0, NULL, NULL, NULL, 30, 0),
(78, 1, 1, 6, '2025-09-26', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:32:26', 0, NULL, NULL, NULL, 30, 0),
(79, 1, 1, 6, '2025-09-29', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:39:21', 0, NULL, NULL, NULL, 30, 0),
(80, 1, 1, 6, '2025-09-29', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:40:25', 0, NULL, NULL, NULL, 30, 0),
(81, 1, 1, 6, '2025-09-30', '08:00:00', '12:00:00', 16, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:41:32', 0, NULL, NULL, NULL, 30, 0),
(82, 1, 1, 6, '2025-09-30', '14:00:00', '17:00:00', 12, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:42:19', 0, NULL, NULL, NULL, 30, 0),
(83, 1, 7, 7, '2025-09-08', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:43:49', 0, NULL, NULL, NULL, 30, 0),
(84, 1, 7, 7, '2025-09-08', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:44:28', 0, NULL, NULL, NULL, 30, 0),
(85, 1, 7, 7, '2025-09-09', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:47:11', 0, NULL, NULL, NULL, 30, 0),
(86, 1, 7, 7, '2025-09-09', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:47:50', 0, NULL, NULL, NULL, 30, 0),
(87, 1, 7, 7, '2025-09-10', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:48:26', 0, NULL, NULL, NULL, 30, 0),
(88, 1, 7, 7, '2025-09-10', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:49:02', 0, NULL, NULL, NULL, 30, 0),
(89, 1, 7, 7, '2025-09-15', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:49:34', 0, NULL, NULL, NULL, 30, 0),
(90, 1, 7, 7, '2025-09-15', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:49:59', 0, NULL, NULL, NULL, 30, 0),
(91, 1, 7, 7, '2025-09-16', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:51:58', 0, NULL, NULL, NULL, 30, 0),
(92, 1, 7, 7, '2025-09-17', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:52:25', 0, NULL, NULL, NULL, 30, 0),
(93, 1, 7, 7, '2025-09-17', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:52:49', 0, NULL, NULL, NULL, 30, 0),
(94, 1, 8, 7, '2025-09-22', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:53:21', 0, NULL, NULL, NULL, 30, 0),
(95, 1, 7, 7, '2025-09-22', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:53:45', 0, NULL, NULL, NULL, 30, 0),
(96, 1, 7, 7, '2025-09-23', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:54:29', 0, NULL, NULL, NULL, 30, 0),
(97, 1, 7, 7, '2025-09-23', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:54:55', 0, NULL, NULL, NULL, 30, 0),
(98, 1, 7, 7, '2025-09-24', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:55:42', 0, NULL, NULL, NULL, 30, 0),
(99, 1, 7, 7, '2025-09-24', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:57:07', 0, NULL, NULL, NULL, 30, 0),
(100, 1, 7, 7, '2025-09-29', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:58:04', 0, NULL, NULL, NULL, 30, 0),
(101, 1, 7, 7, '2025-09-29', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:58:44', 0, NULL, NULL, NULL, 30, 0),
(102, 1, 7, 7, '2025-09-30', '08:00:00', '12:00:00', 8, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:59:14', 0, NULL, NULL, NULL, 30, 0),
(103, 1, 7, 7, '2025-09-30', '14:00:00', '17:00:00', 6, 0, 'Activa', '(DEBEN ESTAR 10 A 15 MINUTOS ANTES PARA FACTURAR)', '2025-09-02 11:59:35', 0, NULL, NULL, NULL, 30, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `availability_distribution`
--

CREATE TABLE `availability_distribution` (
  `id` bigint UNSIGNED NOT NULL,
  `availability_id` bigint UNSIGNED NOT NULL,
  `day_date` date NOT NULL,
  `quota` int UNSIGNED NOT NULL DEFAULT '0',
  `assigned` int UNSIGNED NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `billing_audit_logs`
--

CREATE TABLE `billing_audit_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `billing_id` bigint UNSIGNED NOT NULL,
  `appointment_id` int UNSIGNED NOT NULL,
  `changed_by_user_id` int UNSIGNED DEFAULT NULL,
  `old_status` enum('pending','billed','paid','cancelled') DEFAULT NULL,
  `new_status` enum('pending','billed','paid','cancelled') NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `blood_groups`
--

CREATE TABLE `blood_groups` (
  `id` smallint UNSIGNED NOT NULL,
  `code` varchar(3) NOT NULL,
  `name` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `patient_name` varchar(255) NOT NULL,
  `patient_phone` varchar(20) DEFAULT NULL,
  `agent_name` varchar(255) NOT NULL,
  `call_type` enum('Consulta General','Urgencia','Seguimiento','Información') DEFAULT 'Consulta General',
  `status` enum('active','waiting','ended') DEFAULT 'waiting',
  `priority` enum('Normal','Alta','Baja','Urgencia') DEFAULT 'Normal',
  `start_time` timestamp NULL DEFAULT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` int DEFAULT '0' COMMENT 'Duración en segundos',
  `transcript` text,
  `audio_url` text,
  `webhook_data` json DEFAULT NULL,
  `webhook_data_end` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` bigint NOT NULL,
  `call_id` int DEFAULT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `event_type` enum('started','ended','transfer','attend','hold') NOT NULL,
  `agent_name` varchar(255) DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` bigint UNSIGNED NOT NULL,
  `patient_id` bigint UNSIGNED DEFAULT NULL,
  `specialty_id` int UNSIGNED DEFAULT NULL,
  `queue_id` bigint UNSIGNED DEFAULT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `channel` enum('AI','Manual') NOT NULL DEFAULT 'AI',
  `outcome` enum('Cita agendada','No contestó','Rechazó','Número inválido','Otro') NOT NULL,
  `status_id` smallint UNSIGNED DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `call_notifications`
--

CREATE TABLE `call_notifications` (
  `id` int NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `patient_id` bigint UNSIGNED DEFAULT NULL,
  `agent_id` varchar(255) NOT NULL,
  `call_type` enum('started','completed') NOT NULL,
  `timestamp` datetime NOT NULL,
  `duration_secs` int DEFAULT '0',
  `cost` int DEFAULT '0',
  `summary` text,
  `success_status` enum('success','failure','unknown') DEFAULT 'unknown',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
`agent_id` varchar(255)
,`avg_cost` decimal(14,4)
,`avg_duration_secs` decimal(14,4)
,`call_date` date
,`failed_calls` decimal(23,0)
,`successful_calls` decimal(23,0)
,`total_calls` bigint
,`total_cost` decimal(32,0)
,`total_duration_secs` decimal(32,0)
);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `call_statuses`
--

CREATE TABLE `call_statuses` (
  `id` smallint UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL,
  `color` varchar(24) DEFAULT NULL,
  `sort_order` smallint UNSIGNED DEFAULT NULL,
  `active` enum('active','inactive') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int UNSIGNED NOT NULL,
  `availability_id` bigint UNSIGNED NOT NULL,
  `resolution_type` enum('reschedule','cancel','increase_capacity','split_slot') COLLATE utf8mb4_unicode_ci NOT NULL,
  `resolution_data` json DEFAULT NULL COMMENT 'Datos específicos de la resolución',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `resolved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_by` int UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `conversation_memory`
--

CREATE TABLE `conversation_memory` (
  `id` int NOT NULL,
  `patient_document` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `conversation_data` json NOT NULL,
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','completed','archived') COLLATE utf8mb4_unicode_ci DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `conversation_memory`
--

INSERT INTO `conversation_memory` (`id`, `patient_document`, `session_id`, `conversation_data`, `last_updated`, `created_at`, `status`) VALUES
(1, '79876543', 'session_test_001', '{\"metadata\": {\"start_time\": \"2025-08-28T13:24:29.885Z\", \"last_activity\": \"2025-08-28T13:35:45.356Z\", \"total_interactions\": 3, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"79876543\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para registro\", \"timestamp\": \"2025-08-28T13:24:29.885Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Carlos Alberto Rodríguez Mendoza\", \"timestamp\": \"2025-08-28T13:31:56.270Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Carlos Alberto Rodríguez Mendoza\", \"timestamp\": \"2025-08-28T13:35:45.356Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"registro\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-28 13:35:45', '2025-08-28 13:24:29', 'active'),
(2, '', 'new_patient_001', '{\"metadata\": {\"start_time\": \"2025-08-28T13:52:39.280Z\", \"last_activity\": \"2025-08-28T14:28:52.528Z\", \"total_interactions\": 6, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para general\", \"timestamp\": \"2025-08-28T13:52:39.280Z\", \"validated\": true}, {\"content\": \"María Elena Rodríguez Vásquez\", \"timestamp\": \"2025-08-28T13:53:15.225Z\"}, {\"content\": \"43567890\", \"timestamp\": \"2025-08-28T13:54:01.599Z\"}, {\"content\": \"María Elena Rodríguez Vásquez\", \"timestamp\": \"2025-08-28T13:57:57.457Z\"}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"María Elena Rodríguez Vásquez\", \"timestamp\": \"2025-08-28T14:24:52.476Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1990-03-15\", \"timestamp\": \"2025-08-28T14:26:16.739Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-08-28T14:28:52.528Z\", \"validated\": true}], \"conversation_context\": {\"current_step\": \"phone_collection\"}}', '2025-08-28 14:28:52', '2025-08-28 13:52:39', 'completed'),
(3, '', '1693233600_', '{\"metadata\": {\"start_time\": \"2025-08-28T14:47:54.567Z\", \"last_activity\": \"2025-08-28T14:47:54.567Z\", \"total_interactions\": 1, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para general\", \"timestamp\": \"2025-08-28T14:47:54.567Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"general\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-28 14:47:54', '2025-08-28 14:47:54', 'active'),
(4, '', '1693234890_', '{\"metadata\": {\"start_time\": \"2025-08-28T14:48:52.806Z\", \"last_activity\": \"2025-08-28T14:48:52.806Z\", \"total_interactions\": 1, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-08-28T14:48:52.806Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-28 14:48:52', '2025-08-28 14:48:52', 'active'),
(5, '172659001', '1693248000_172659001', '{\"metadata\": {\"start_time\": \"2025-08-28T14:55:37.699Z\", \"last_activity\": \"2025-08-28T14:57:16.161Z\", \"total_interactions\": 5, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"172659001\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-08-28T14:55:37.699Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"172659001\", \"timestamp\": \"2025-08-28T14:56:07.395Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Day Alberto Matías Martínez\", \"timestamp\": \"2025-08-28T14:56:20.160Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1984-04-12\", \"timestamp\": \"2025-08-28T14:56:47.816Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"04263774021\", \"timestamp\": \"2025-08-28T14:57:16.161Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-28 14:57:16', '2025-08-28 14:55:37', 'active'),
(6, '', 'timestamp_Marcos_PES_001', '{\"metadata\": {\"start_time\": \"2025-08-28T15:07:04.504Z\", \"last_activity\": \"2025-08-28T15:07:04.504Z\", \"total_interactions\": 1, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para general\", \"timestamp\": \"2025-08-28T15:07:04.504Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"general\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-28 15:07:04', '2025-08-28 15:07:04', 'active'),
(7, '23333001', '1693250000_23333001', '{\"metadata\": {\"start_time\": \"2025-08-28T15:38:33.199Z\", \"last_activity\": \"2025-08-28T15:39:34.390Z\", \"total_interactions\": 3, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"23333001\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-08-28T15:38:33.199Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"José Vengador\", \"timestamp\": \"2025-08-28T15:39:29.549Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2000-01-01\", \"timestamp\": \"2025-08-28T15:39:34.390Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-28 15:39:34', '2025-08-28 15:38:33', 'active'),
(8, '17604304', 'session_17604304_2025-08-28T00:00:00Z', '{\"metadata\": {\"start_time\": \"2025-08-28T16:53:58.284Z\", \"last_activity\": \"2025-08-28T16:54:35.921Z\", \"total_interactions\": 3, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"17604304\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-08-28T16:53:58.284Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"17604304\", \"timestamp\": \"2025-08-28T16:54:00.846Z\", \"validated\": true}, {\"type\": \"verification\", \"field\": \"name\", \"content\": \"Identidad confirmada: María José Delgado Romero con documento 17604304\", \"timestamp\": \"2025-08-28T16:54:35.921Z\"}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-28 16:54:35', '2025-08-28 16:53:58', 'active'),
(9, '11235689', 'session_11235689_2025-08-28T00:00:00Z', '{\"metadata\": {\"start_time\": \"2025-08-28T17:02:29.651Z\", \"last_activity\": \"2025-08-28T17:06:32.858Z\", \"total_interactions\": 14, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"11235689\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-08-28T17:02:29.651Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"11235689\", \"timestamp\": \"2025-08-28T17:02:32.334Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Juan Carlos Álvarez Domingo\", \"timestamp\": \"2025-08-28T17:03:04.429Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-08-28T17:03:26.063Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1997-04-30\", \"timestamp\": \"2025-08-28T17:03:42.100Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3105672307\", \"timestamp\": \"2025-08-28T17:04:11.521Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Carrera 20 #10-24\", \"timestamp\": \"2025-08-28T17:04:13.572Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"San Gil\", \"timestamp\": \"2025-08-28T17:05:11.123Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"NUEVA EPS\", \"timestamp\": \"2025-08-28T17:05:19.753Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"A+\", \"timestamp\": \"2025-08-28T17:05:43.351Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Soltero(a)\", \"timestamp\": \"2025-08-28T17:05:51.509Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-08-28T17:05:55.429Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"juancarlosdomingo@gmail.com\", \"timestamp\": \"2025-08-28T17:06:20.231Z\", \"validated\": true}, {\"type\": \"system\", \"field\": \"registration_status\", \"content\": \"createPatient ejecutado\", \"timestamp\": \"2025-08-28T17:06:32.858Z\"}], \"conversation_context\": {\"current_step\": \"crear_registro\", \"completed_steps\": [\"documento\", \"nombre\", \"tipo_documento\", \"fecha_nacimiento\", \"telefono\", \"direccion\", \"municipio\", \"eps\", \"afiliacion\", \"sangre\", \"estado_civil\", \"estrato\", \"email\"]}}', '2025-08-28 17:06:32', '2025-08-28 17:02:29', 'active'),
(10, '28252922', '28252922_20240116', '{\"metadata\": {\"start_time\": \"2025-08-29T18:11:01.791Z\", \"last_activity\": \"2025-08-29T18:12:48.503Z\", \"total_interactions\": 11, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"28252922\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-08-29T18:11:01.791Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Ana Inés Romero Fernández\", \"timestamp\": \"2025-08-29T18:11:05.706Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3185676234\", \"timestamp\": \"2025-08-29T18:11:14.967Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-08-29T18:11:21.955Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Carrera cuarta 437 Mogotis\", \"timestamp\": \"2025-08-29T18:11:36.650Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality_id\", \"content\": \"19\", \"timestamp\": \"2025-08-29T18:11:46.582Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_eps_id\", \"content\": \"14\", \"timestamp\": \"2025-08-29T18:12:02.782Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-08-29T18:12:10.282Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group_id\", \"content\": \"3\", \"timestamp\": \"2025-08-29T18:12:20.799Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status_id\", \"content\": \"2\", \"timestamp\": \"2025-08-29T18:12:34.271Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"2\", \"timestamp\": \"2025-08-29T18:12:48.503Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-29 18:12:48', '2025-08-29 18:11:01', 'active'),
(11, '63476284', '63476284_20240116', '{\"metadata\": {\"start_time\": \"2025-08-29T18:17:17.449Z\", \"last_activity\": \"2025-08-29T18:19:37.205Z\", \"total_interactions\": 13, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"63476284\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-08-29T18:17:17.449Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Blanca Celina López Dulcey\", \"timestamp\": \"2025-08-29T18:17:23.737Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type_id\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:17:41.423Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1973-08-16\", \"timestamp\": \"2025-08-29T18:17:54.500Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3157873980\", \"timestamp\": \"2025-08-29T18:18:07.553Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-08-29T18:18:13.809Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda El Hoyo\", \"timestamp\": \"2025-08-29T18:18:24.965Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality_id\", \"content\": \"19\", \"timestamp\": \"2025-08-29T18:18:32.396Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_eps_id\", \"content\": \"14\", \"timestamp\": \"2025-08-29T18:18:49.983Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-08-29T18:18:58.685Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group_id\", \"content\": \"7\", \"timestamp\": \"2025-08-29T18:19:04.793Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status_id\", \"content\": \"3\", \"timestamp\": \"2025-08-29T18:19:23.679Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:19:37.205Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-29 18:19:37', '2025-08-29 18:17:17', 'active'),
(12, '5687403', '5687403_20240104', '{\"metadata\": {\"start_time\": \"2025-08-29T18:23:10.463Z\", \"last_activity\": \"2025-08-29T18:27:51.039Z\", \"total_interactions\": 17, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"5687403\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-08-29T18:23:10.463Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Juan Bautista Muñoz\", \"timestamp\": \"2025-08-29T18:23:23.341Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type_id\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:23:44.561Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1947-05-23\", \"timestamp\": \"2025-08-29T18:23:59.892Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3173583022\", \"timestamp\": \"2025-08-29T18:24:14.403Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-08-29T18:24:24.103Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda El Hoyo\", \"timestamp\": \"2025-08-29T18:24:39.805Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality_id\", \"content\": \"19\", \"timestamp\": \"2025-08-29T18:25:47.457Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_eps_id\", \"content\": \"14\", \"timestamp\": \"2025-08-29T18:26:05.527Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-08-29T18:26:15.576Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group_id\", \"content\": \"7\", \"timestamp\": \"2025-08-29T18:26:25.596Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status_id\", \"content\": \"2\", \"timestamp\": \"2025-08-29T18:26:37.089Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:26:46.506Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"specialty_id\", \"content\": \"9\", \"timestamp\": \"2025-08-29T18:27:11.437Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"location_id\", \"content\": \"Sede Biosanar San Gil\", \"timestamp\": \"2025-08-29T18:27:16.629Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"location_id\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:27:32.649Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor_id\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:27:51.039Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-29 18:27:51', '2025-08-29 18:23:10', 'active'),
(13, '1244781445', '1244781445_20240104', '{\"metadata\": {\"start_time\": \"2025-08-29T18:32:17.825Z\", \"last_activity\": \"2025-08-29T18:36:25.320Z\", \"total_interactions\": 16, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"1244781445\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-08-29T18:32:17.825Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Sara Michelle Ruiz Serrano\", \"timestamp\": \"2025-08-29T18:32:37.322Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type_id\", \"content\": \"6\", \"timestamp\": \"2025-08-29T18:32:58.782Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2025-03-27\", \"timestamp\": \"2025-08-29T18:33:19.036Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3174614457\", \"timestamp\": \"2025-08-29T18:33:38.110Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-08-29T18:33:47.354Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda Caucho\", \"timestamp\": \"2025-08-29T18:34:04.261Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality_id\", \"content\": \"19\", \"timestamp\": \"2025-08-29T18:34:18.956Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_eps_id\", \"content\": \"14\", \"timestamp\": \"2025-08-29T18:34:36.429Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-08-29T18:34:49.193Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group_id\", \"content\": \"7\", \"timestamp\": \"2025-08-29T18:34:59.268Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status_id\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:35:03.583Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:35:18.064Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"specialty_id\", \"content\": \"6\", \"timestamp\": \"2025-08-29T18:35:49.984Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"location_id\", \"content\": \"1\", \"timestamp\": \"2025-08-29T18:36:05.538Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor_id\", \"content\": \"11\", \"timestamp\": \"2025-08-29T18:36:25.320Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-29 18:36:25', '2025-08-29 18:32:17', 'active'),
(14, '11010753500', 'reg_11010753500_20240104', '{\"metadata\": {\"start_time\": \"2025-08-29T19:14:37.734Z\", \"last_activity\": \"2025-08-29T19:18:50.331Z\", \"total_interactions\": 13, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"11010753500\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-08-29T19:14:37.734Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Andrés Felipe Romero Torozo\", \"timestamp\": \"2025-08-29T19:15:14.106Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type_id\", \"content\": \"3\", \"timestamp\": \"2025-08-29T19:15:27.963Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2009-05-14\", \"timestamp\": \"2025-08-29T19:15:43.847Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3181173333\", \"timestamp\": \"2025-08-29T19:16:03.240Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-08-29T19:16:44.444Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Calle 22, 641\", \"timestamp\": \"2025-08-29T19:17:05.829Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality_id\", \"content\": \"26\", \"timestamp\": \"2025-08-29T19:17:21.937Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_eps_id\", \"content\": \"14\", \"timestamp\": \"2025-08-29T19:17:37.223Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-08-29T19:17:49.665Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group_id\", \"content\": \"7\", \"timestamp\": \"2025-08-29T19:18:12.569Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status_id\", \"content\": \"1\", \"timestamp\": \"2025-08-29T19:18:19.017Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"2\", \"timestamp\": \"2025-08-29T19:18:50.331Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-08-29 19:18:50', '2025-08-29 19:14:37', 'active'),
(15, '1098410555', 'session_1098410555_1735076400', '{\"metadata\": {\"start_time\": \"2025-09-01T15:02:54.442Z\", \"last_activity\": \"2025-09-01T15:07:25.753Z\", \"total_interactions\": 11, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"1098410555\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:02:54.442Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"1098410555\", \"timestamp\": \"2025-09-01T15:02:57.891Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"daughter_document\", \"content\": \"1098409651\", \"timestamp\": \"2025-09-01T15:03:46.728Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Deiber Fabián\", \"timestamp\": \"2025-09-01T15:04:23.915Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Tarjeta de Identidad\", \"timestamp\": \"2025-09-01T15:04:48.536Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2014-06-20\", \"timestamp\": \"2025-09-01T15:05:14.014Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3232148337\", \"timestamp\": \"2025-09-01T15:05:34.517Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"En el páramo de Santander\", \"timestamp\": \"2025-09-01T15:06:21.580Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Páramo\", \"timestamp\": \"2025-09-01T15:07:02.648Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"COOMEVA\", \"timestamp\": \"2025-09-01T15:07:16.938Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:07:20.496Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: cancelled\", \"timestamp\": \"2025-09-01T15:07:25.753Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:07:25', '2025-09-01 15:02:54', 'completed'),
(16, '37895809', '20250108_37895809', '{\"metadata\": {\"start_time\": \"2025-09-01T15:06:27.216Z\", \"last_activity\": \"2025-09-01T15:12:57.218Z\", \"total_interactions\": 16, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"37895809\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:06:27.216Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"37895809\", \"timestamp\": \"2025-09-01T15:06:31.806Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Inés Romero Patiño\", \"timestamp\": \"2025-09-01T15:07:04.673Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:07:29.331Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1974-02-08\", \"timestamp\": \"2025-09-01T15:07:52.737Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3204778034\", \"timestamp\": \"2025-09-01T15:08:11.536Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-09-01T15:08:23.515Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda Alhaja\", \"timestamp\": \"2025-09-01T15:08:41.057Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"San Gil\", \"timestamp\": \"2025-09-01T15:09:08.238Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Famisanar\", \"timestamp\": \"2025-09-01T15:09:31.506Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:09:46.047Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"A+\", \"timestamp\": \"2025-09-01T15:10:10.087Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Separada\", \"timestamp\": \"2025-09-01T15:10:30.902Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:10:46.031Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor\", \"content\": \"Dra. Ana Teresa Escobar\", \"timestamp\": \"2025-09-01T15:11:47.936Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_datetime\", \"content\": \"2025-09-01 15:00:00\", \"timestamp\": \"2025-09-01T15:12:46.058Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-09-01T15:12:57.218Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:12:57', '2025-09-01 15:03:51', 'completed'),
(17, '', 'session_20250108_victoria', '{\"metadata\": {\"start_time\": \"2025-09-01T15:04:50.417Z\", \"last_activity\": \"2025-09-01T15:09:18.429Z\", \"total_interactions\": 10, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:04:50.417Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"1098356769\", \"timestamp\": \"2025-09-01T15:05:16.523Z\", \"validated\": true}, {\"type\": \"clarification\", \"field\": \"patient_clarification\", \"content\": \"La cita es para su hijo, no para Victoria\", \"timestamp\": \"2025-09-01T15:05:53.069Z\"}, {\"type\": \"clarification\", \"field\": \"services_clarification\", \"content\": \"Los exámenes también son para el hijo\", \"timestamp\": \"2025-09-01T15:06:01.858Z\"}, {\"type\": \"answer\", \"field\": \"child_document\", \"content\": \"1100962323\", \"timestamp\": \"2025-09-01T15:06:29.075Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"child_name\", \"content\": \"Víctor Manuel Beltrán Hernández\", \"timestamp\": \"2025-09-01T15:07:37.173Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Tarjeta de Identidad\", \"timestamp\": \"2025-09-01T15:08:07.060Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2010-10-17\", \"timestamp\": \"2025-09-01T15:08:26.055Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3138851202\", \"timestamp\": \"2025-09-01T15:08:44.959Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"tollitahernandez0@gmail.com\", \"timestamp\": \"2025-09-01T15:09:18.429Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"child_registration_needed\", \"completed_steps\": [\"mother_document_collected\", \"child_document_collected\", \"both_verified_not_found\"], \"pending_questions\": [\"child_name\", \"child_birth_date\", \"document_type\"]}}', '2025-09-01 15:09:18', '2025-09-01 15:04:50', 'active'),
(18, '37895809', '20250108_37895809', '{\"metadata\": {\"start_time\": \"2025-09-01T15:06:27.216Z\", \"last_activity\": \"2025-09-01T15:12:57.218Z\", \"total_interactions\": 16, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"37895809\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:06:27.216Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"37895809\", \"timestamp\": \"2025-09-01T15:06:31.806Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Inés Romero Patiño\", \"timestamp\": \"2025-09-01T15:07:04.673Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:07:29.331Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1974-02-08\", \"timestamp\": \"2025-09-01T15:07:52.737Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3204778034\", \"timestamp\": \"2025-09-01T15:08:11.536Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-09-01T15:08:23.515Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda Alhaja\", \"timestamp\": \"2025-09-01T15:08:41.057Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"San Gil\", \"timestamp\": \"2025-09-01T15:09:08.238Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Famisanar\", \"timestamp\": \"2025-09-01T15:09:31.506Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:09:46.047Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"A+\", \"timestamp\": \"2025-09-01T15:10:10.087Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Separada\", \"timestamp\": \"2025-09-01T15:10:30.902Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:10:46.031Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor\", \"content\": \"Dra. Ana Teresa Escobar\", \"timestamp\": \"2025-09-01T15:11:47.936Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_datetime\", \"content\": \"2025-09-01 15:00:00\", \"timestamp\": \"2025-09-01T15:12:46.058Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-09-01T15:12:57.218Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:12:57', '2025-09-01 15:06:27', 'completed'),
(19, '109840965', 'session_109840965_1735077600', '{\"metadata\": {\"start_time\": \"2025-09-01T15:08:32.225Z\", \"last_activity\": \"2025-09-01T15:17:46.440Z\", \"total_interactions\": 21, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"109840965\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-09-01T15:08:32.225Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"109840965\", \"timestamp\": \"2025-09-01T15:08:35.687Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_confirmed\", \"content\": \"1098409651\", \"timestamp\": \"2025-09-01T15:09:27.437Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Nieves Ludey Naranjo Ríos\", \"timestamp\": \"2025-09-01T15:09:45.262Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:10:10.924Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1999-01-26\", \"timestamp\": \"2025-09-01T15:10:26.624Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3232314877\", \"timestamp\": \"2025-09-01T15:10:48.027Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-09-01T15:11:00.469Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"En páramo finca del limón\", \"timestamp\": \"2025-09-01T15:11:15.778Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Páramo\", \"timestamp\": \"2025-09-01T15:11:33.304Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Nueva EPS\", \"timestamp\": \"2025-09-01T15:12:29.312Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_purpose\", \"content\": \"Cita para terapia para su hijo\", \"timestamp\": \"2025-09-01T15:13:00.885Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:13:19.754Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"O+\", \"timestamp\": \"2025-09-01T15:13:35.643Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Unión libre\", \"timestamp\": \"2025-09-01T15:13:56.060Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:14:10.034Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"specialty_selected\", \"content\": \"Psicología para terapia del hijo\", \"timestamp\": \"2025-09-01T15:14:37.873Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"location_selected\", \"content\": \"Sede Biosanar San Gil\", \"timestamp\": \"2025-09-01T15:15:20.872Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor_selected\", \"content\": \"Dra. Valentina Abaunza Ballesteros\", \"timestamp\": \"2025-09-01T15:15:47.220Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_date\", \"content\": \"Viernes 6 de septiembre 2025\", \"timestamp\": \"2025-09-01T15:17:02.270Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_time\", \"content\": \"8:00 AM\", \"timestamp\": \"2025-09-01T15:17:28.201Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-09-01T15:17:46.440Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:17:46', '2025-09-01 15:08:32', 'completed'),
(20, '', 'session_20250109_ecografia', '{\"metadata\": {\"start_time\": \"2025-09-01T15:11:01.087Z\", \"last_activity\": \"2025-09-01T15:11:47.975Z\", \"total_interactions\": 2, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:11:01.087Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"2872084\", \"timestamp\": \"2025-09-01T15:11:40.043Z\", \"validated\": true}], \"conversation_context\": {\"current_step\": \"new_patient_registration\", \"completed_steps\": [\"document_verification\"], \"pending_questions\": [\"patient_registration\", \"appointment_scheduling\"]}}', '2025-09-01 15:11:47', '2025-09-01 15:11:01', 'active'),
(21, '', 'session_20250109_recovery', '{\"metadata\": {\"start_time\": \"2025-09-01T15:11:52.144Z\", \"last_activity\": \"2025-09-01T15:12:16.526Z\", \"total_interactions\": 2, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:11:52.144Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"1109762323\", \"timestamp\": \"2025-09-01T15:12:16.526Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:12:16', '2025-09-01 15:11:52', 'active'),
(22, '110962323', 'session_110962323_2025', '{\"metadata\": {\"start_time\": \"2025-09-01T15:13:33.141Z\", \"last_activity\": \"2025-09-01T15:22:00.965Z\", \"total_interactions\": 18, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"110962323\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-09-01T15:13:33.141Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"110962323\", \"timestamp\": \"2025-09-01T15:13:36.696Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Víctor Manuel Belzán Hernández\", \"timestamp\": \"2025-09-01T15:13:54.976Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Tarjeta de identidad\", \"timestamp\": \"2025-09-01T15:14:51.181Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2010-10-17\", \"timestamp\": \"2025-09-01T15:15:36.835Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3138851202\", \"timestamp\": \"2025-09-01T15:15:57.246Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"toquitadeyuca.ernesto0@gmail.com\", \"timestamp\": \"2025-09-01T15:16:28.852Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Carrera 2B407, Barrio Las Brisas, Zarazón\", \"timestamp\": \"2025-09-01T15:16:46.530Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Socorro\", \"timestamp\": \"2025-09-01T15:17:26.057Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Nueva EPS\", \"timestamp\": \"2025-09-01T15:17:43.459Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:18:01.416Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"O+\", \"timestamp\": \"2025-09-01T15:18:51.931Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Soltero\", \"timestamp\": \"2025-09-01T15:19:19.933Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:19:31.880Z\", \"validated\": true}, {\"type\": \"system\", \"field\": \"registration_status\", \"content\": \"createPatient ejecutado exitosamente - ID: 1021\", \"timestamp\": \"2025-09-01T15:19:46.106Z\"}, {\"type\": \"answer\", \"field\": \"location\", \"content\": \"Sede Biosanar San Gil\", \"timestamp\": \"2025-09-01T15:20:30.405Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor\", \"content\": \"Dra. Yesika Andrea Fiallo\", \"timestamp\": \"2025-09-01T15:20:47.051Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"appointment_datetime\", \"content\": \"Viernes 5 de septiembre 2025 a las 10:00 AM\", \"timestamp\": \"2025-09-01T15:21:46.682Z\", \"validated\": true}, {\"type\": \"action\", \"content\": \"Conversación finalizada: completed\", \"timestamp\": \"2025-09-01T15:22:00.965Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"appointment_scheduling\", \"completed_steps\": [\"patient_registration\"]}}', '2025-09-01 15:22:00', '2025-09-01 15:13:33', 'completed'),
(23, '28423886', 'session_28423886_2025', '{\"metadata\": {\"start_time\": \"2025-09-01T15:23:24.746Z\", \"last_activity\": \"2025-09-01T15:30:53.582Z\", \"total_interactions\": 22, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"28423886\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para new_patient_registration\", \"timestamp\": \"2025-09-01T15:23:24.746Z\", \"validated\": true}, {\"type\": \"question\", \"field\": \"name\", \"content\": \"Solicitando nombre completo del paciente\", \"timestamp\": \"2025-09-01T15:23:38.077Z\"}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Graciela Silva Céllis\", \"timestamp\": \"2025-09-01T15:24:07.126Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:24:37.066Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"28423886\", \"timestamp\": \"2025-09-01T15:24:41.800Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"29 julio 1956\", \"timestamp\": \"2025-09-01T15:25:00.043Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3014555914\", \"timestamp\": \"2025-09-01T15:25:19.775Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"gracielasilvan5@hotmail.com\", \"timestamp\": \"2025-09-01T15:25:36.710Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Calle 10 Sur número 9615, segunda etapa, Rincón del Virrey, Socorro\", \"timestamp\": \"2025-09-01T15:25:56.532Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Socorro\", \"timestamp\": \"2025-09-01T15:26:21.719Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Nueva EPS (paciente particular)\", \"timestamp\": \"2025-09-01T15:27:05.407Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Contributivo\", \"timestamp\": \"2025-09-01T15:27:25.958Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"O+ (RH positivo)\", \"timestamp\": \"2025-09-01T15:27:40.402Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Soltera\", \"timestamp\": \"2025-09-01T15:27:52.761Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"3\", \"timestamp\": \"2025-09-01T15:28:07.606Z\", \"validated\": true}, {\"type\": \"system\", \"field\": \"registration_status\", \"content\": \"createPatient ejecutado exitosamente - ID: 1022\", \"timestamp\": \"2025-09-01T15:28:26.034Z\"}, {\"type\": \"answer\", \"field\": \"specialty\", \"content\": \"Medicina General\", \"timestamp\": \"2025-09-01T15:29:04.052Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"location\", \"content\": \"Sede Biosanar Socorro\", \"timestamp\": \"2025-09-01T15:29:34.292Z\", \"validated\": true}, {\"type\": \"question\", \"field\": \"doctor_selection\", \"content\": \"Ofreciendo Dr. Calixto Escorcia Angulo para medicina general\", \"timestamp\": \"2025-09-01T15:29:51.749Z\"}, {\"type\": \"answer\", \"field\": \"doctor\", \"content\": \"Dr. Calixto Escorcia Angulo - acepta\", \"timestamp\": \"2025-09-01T15:30:12.530Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"date_preference\", \"content\": \"Solicita cita para hoy - necesita precio\", \"timestamp\": \"2025-09-01T15:30:23.810Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"time_preference\", \"content\": \"Prefiere mañana - hoy en la mañana\", \"timestamp\": \"2025-09-01T15:30:53.582Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"appointment_scheduling\", \"completed_steps\": [\"patient_registration\"]}}', '2025-09-01 15:30:53', '2025-09-01 15:23:24', 'active');
INSERT INTO `conversation_memory` (`id`, `patient_document`, `session_id`, `conversation_data`, `last_updated`, `created_at`, `status`) VALUES
(24, '', 'session_20250109_001', '{\"metadata\": {\"start_time\": \"2025-09-01T15:23:52.773Z\", \"last_activity\": \"2025-09-01T15:30:48.415Z\", \"total_interactions\": 17, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:23:52.773Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"1098408107\", \"timestamp\": \"2025-09-01T15:24:47.333Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"1098408107\", \"timestamp\": \"2025-09-01T15:24:51.874Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Alba Marina Mesa\", \"timestamp\": \"2025-09-01T15:25:24.324Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:25:55.852Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1991-03-29\", \"timestamp\": \"2025-09-01T15:26:39.435Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3144908597\", \"timestamp\": \"2025-09-01T15:27:03.601Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"no tiene correo\", \"timestamp\": \"2025-09-01T15:27:15.495Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda Resguardo, Charalá, Santander\", \"timestamp\": \"2025-09-01T15:27:34.430Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Charalá\", \"timestamp\": \"2025-09-01T15:27:57.480Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Nueva EPS\", \"timestamp\": \"2025-09-01T15:28:23.860Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:28:38.121Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"A+\", \"timestamp\": \"2025-09-01T15:29:04.568Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Soltera\", \"timestamp\": \"2025-09-01T15:29:19.416Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"estrato\", \"content\": \"1\", \"timestamp\": \"2025-09-01T15:29:34.401Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"location\", \"content\": \"Sede San Gil\", \"timestamp\": \"2025-09-01T15:30:25.178Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"doctor\", \"content\": \"Dr. Andrés Romero\", \"timestamp\": \"2025-09-01T15:30:48.415Z\", \"validated\": true}], \"conversation_context\": {\"current_step\": \"new_patient_registration\", \"completed_steps\": [\"document_verification\"], \"pending_questions\": [\"name\", \"document_type\", \"birth_date\", \"phone\", \"address\"]}}', '2025-09-01 15:30:48', '2025-09-01 15:23:52', 'active'),
(25, '', 'session_20250108_pediatria', '{\"metadata\": {\"start_time\": \"2025-09-01T15:26:02.505Z\", \"last_activity\": \"2025-09-01T15:30:33.900Z\", \"total_interactions\": 13, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:26:02.505Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"1030050579\", \"timestamp\": \"2025-09-01T15:26:25.036Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Emma Jailín Rosales Guerrero\", \"timestamp\": \"2025-09-01T15:26:54.957Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Registro civil\", \"timestamp\": \"2025-09-01T15:27:27.569Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"2021-07-01\", \"timestamp\": \"2025-09-01T15:27:49.670Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"gender\", \"content\": \"Femenino\", \"timestamp\": \"2025-09-01T15:28:10.596Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3153339628\", \"timestamp\": \"2025-09-01T15:28:26.476Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"joseluisrosales@gmail.com\", \"timestamp\": \"2025-09-01T15:28:43.952Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda Lubigara, Finca Los Naranos, Barichara\", \"timestamp\": \"2025-09-01T15:29:02.752Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"municipality\", \"content\": \"Barichara\", \"timestamp\": \"2025-09-01T15:29:21.139Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Nueva EPS\", \"timestamp\": \"2025-09-01T15:29:47.109Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:30:03.567Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"O+\", \"timestamp\": \"2025-09-01T15:30:33.900Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:30:33', '2025-09-01 15:26:02', 'active'),
(26, '51855013', 'session_51855013_20250108', '{\"metadata\": {\"start_time\": \"2025-09-01T15:26:43.094Z\", \"last_activity\": \"2025-09-01T15:30:43.956Z\", \"total_interactions\": 12, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"51855013\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:26:43.094Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"51855013\", \"timestamp\": \"2025-09-01T15:26:47.021Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Luz Miriam Barbosa Díaz\", \"timestamp\": \"2025-09-01T15:27:38.192Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:28:09.179Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1967-02-09\", \"timestamp\": \"2025-09-01T15:28:28.191Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3222248250\", \"timestamp\": \"2025-09-01T15:28:45.317Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"No tiene correo electrónico\", \"timestamp\": \"2025-09-01T15:29:00.524Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Finca Vistahermosa, Palmar, municipio del Páramo\", \"timestamp\": \"2025-09-01T15:29:18.803Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"eps\", \"content\": \"Nueva EPS\", \"timestamp\": \"2025-09-01T15:29:48.651Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"insurance_affiliation_type\", \"content\": \"Subsidiado\", \"timestamp\": \"2025-09-01T15:30:04.290Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"blood_group\", \"content\": \"A+\", \"timestamp\": \"2025-09-01T15:30:25.459Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"marital_status\", \"content\": \"Casado(a)\", \"timestamp\": \"2025-09-01T15:30:43.956Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"new_patient_registration\", \"current_step\": \"new_patient_registration\", \"completed_steps\": [\"document_verification\"], \"pending_questions\": [\"name\", \"document_type\", \"birth_date\", \"phone\", \"address\"]}}', '2025-09-01 15:30:43', '2025-09-01 15:26:43', 'active'),
(27, '', 'session_20250109_appointment', '{\"metadata\": {\"start_time\": \"2025-09-01T15:28:10.842Z\", \"last_activity\": \"2025-09-01T15:30:35.495Z\", \"total_interactions\": 8, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:28:10.842Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"282720707\", \"timestamp\": \"2025-09-01T15:28:32.359Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Argenil Quintero Quintero\", \"timestamp\": \"2025-09-01T15:29:10.817Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:29:29.100Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1968-03-07\", \"timestamp\": \"2025-09-01T15:29:46.349Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3213105532\", \"timestamp\": \"2025-09-01T15:30:04.359Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-09-01T15:30:14.932Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Calle 27 número 939\", \"timestamp\": \"2025-09-01T15:30:35.495Z\", \"validated\": true}], \"conversation_context\": {\"current_step\": \"new_patient_registration\", \"completed_steps\": [\"document_verification\"], \"pending_questions\": [\"patient_registration\"]}}', '2025-09-01 15:30:35', '2025-09-01 15:28:10', 'active'),
(28, '', 'session_20250108_ecografia', '{\"metadata\": {\"start_time\": \"2025-09-01T15:28:14.096Z\", \"last_activity\": \"2025-09-01T15:30:23.343Z\", \"total_interactions\": 8, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:28:14.096Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"10463969909\", \"timestamp\": \"2025-09-01T15:28:42.670Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Francisco de Jesús\", \"timestamp\": \"2025-09-01T15:29:14.155Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Cédula de Ciudadanía\", \"timestamp\": \"2025-09-01T15:29:26.990Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"birth_date\", \"content\": \"1986-08-13\", \"timestamp\": \"2025-09-01T15:29:42.572Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"phone\", \"content\": \"3012058003\", \"timestamp\": \"2025-09-01T15:30:00.429Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"email\", \"content\": \"nomail@biosanarcall.site\", \"timestamp\": \"2025-09-01T15:30:10.512Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"address\", \"content\": \"Vereda La Cantera del municipio de Curitiba\", \"timestamp\": \"2025-09-01T15:30:23.343Z\", \"validated\": true}], \"conversation_context\": {\"current_step\": \"new_patient_registration\", \"completed_steps\": [\"document_collection\"], \"pending_questions\": [\"name\", \"document_type\", \"birth_date\", \"phone\", \"address\"]}}', '2025-09-01 15:30:23', '2025-09-01 15:28:14', 'active'),
(29, 'PT2208460', 'session_20250108_PT2208460', '{\"metadata\": {\"start_time\": \"2025-09-01T15:29:10.684Z\", \"last_activity\": \"2025-09-01T15:30:47.610Z\", \"total_interactions\": 5, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"PT2208460\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:29:10.684Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"PT2208460\", \"timestamp\": \"2025-09-01T15:29:14.323Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Liz Melis del Valle Díaz\", \"timestamp\": \"2025-09-01T15:29:52.290Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Pasaporte\", \"timestamp\": \"2025-09-01T15:30:35.835Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document_type\", \"content\": \"Otro - Permiso de Protección Temporal\", \"timestamp\": \"2025-09-01T15:30:47.610Z\", \"validated\": true}], \"conversation_context\": {\"current_step\": \"new_patient_registration\", \"completed_steps\": [\"document_verification\"], \"pending_questions\": [\"patient_registration\", \"appointment_scheduling\"]}}', '2025-09-01 15:30:47', '2025-09-01 15:29:10', 'active'),
(30, '', 'session_20250108_ultrasound', '{\"metadata\": {\"start_time\": \"2025-09-01T15:29:41.917Z\", \"last_activity\": \"2025-09-01T15:30:42.169Z\", \"total_interactions\": 3, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:29:41.917Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"document\", \"content\": \"1101074647\", \"timestamp\": \"2025-09-01T15:30:08.796Z\", \"validated\": true}, {\"type\": \"answer\", \"field\": \"name\", \"content\": \"Karen Daniela Pérez Sánchez\", \"timestamp\": \"2025-09-01T15:30:42.169Z\", \"validated\": true}], \"conversation_context\": {\"current_step\": \"new_patient_registration\", \"completed_steps\": [\"document_collection\"], \"pending_questions\": [\"name\", \"document_type\", \"birth_date\", \"phone\", \"address\"]}}', '2025-09-01 15:30:42', '2025-09-01 15:29:41', 'active'),
(31, '', 'session_20250108_pediatria', '{\"metadata\": {\"start_time\": \"2025-09-01T15:31:20.534Z\", \"last_activity\": \"2025-09-01T15:31:20.534Z\", \"total_interactions\": 1, \"conversation_quality\": \"initiated\"}, \"patient_info\": {\"document\": \"\", \"verified\": false}, \"collected_data\": {\"preferences\": {}, \"medical_info\": {}, \"personal_info\": {}, \"appointment_info\": {}}, \"interaction_history\": [{\"type\": \"action\", \"content\": \"Conversación iniciada para appointment_scheduling\", \"timestamp\": \"2025-09-01T15:31:20.534Z\", \"validated\": true}], \"conversation_context\": {\"purpose\": \"appointment_scheduling\", \"current_step\": \"initialization\", \"completed_steps\": [], \"pending_questions\": []}}', '2025-09-01 15:31:20', '2025-09-01 15:31:20', 'active');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `demand_patterns`
--

CREATE TABLE `demand_patterns` (
  `id` int UNSIGNED NOT NULL,
  `day_of_week` tinyint NOT NULL COMMENT '1=Lunes, 7=Domingo',
  `hour_of_day` tinyint NOT NULL COMMENT '0-23',
  `doctor_id` bigint UNSIGNED DEFAULT NULL,
  `specialty_id` int UNSIGNED DEFAULT NULL,
  `location_id` int UNSIGNED DEFAULT NULL,
  `avg_utilization` decimal(5,2) NOT NULL DEFAULT '0.00',
  `demand_score` decimal(5,2) NOT NULL DEFAULT '0.00',
  `sample_size` int NOT NULL DEFAULT '0',
  `last_calculated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `disability_types`
--

CREATE TABLE `disability_types` (
  `id` int UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `license_number` varchar(50) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `doctors`
--

INSERT INTO `doctors` (`id`, `name`, `email`, `phone`, `license_number`, `active`, `created_at`) VALUES
(1, 'Dr. Rolando romero', 'dr.demo@example.com', '3010001111', 'LIC-12345', 1, '2025-08-08 21:48:13'),
(4, 'Oscar Calderon', 'oscarandrescalderon19@gmail.com', '+573143131382', 'm012323', 1, '2025-08-11 20:26:26'),
(5, 'Dra. Yesika Andrea fiallo', 'lider.callcenterbiossanar@gmail.com', '3145464569', 'm000', 1, '2025-08-27 10:55:32'),
(6, 'Dra. Ana Teresa Escobar', 'lider.callcenterbiossanar@gmail.com', '3142564784', 'm1214', 1, '2025-08-27 10:56:27'),
(7, 'Dra. Valentina Abaunza Ballesteros', 'lider.callcenterbiossanar@gmail.com', '3175464789', 'mo1321', 1, '2025-08-27 10:57:38'),
(8, 'Dr. Carlos Rafael Almira', 'lider.callcenterbiossanar@gmail.com', '3175245789', 'mc123456', 1, '2025-08-27 10:58:15'),
(10, 'Dra. Claudia Sierra', 'lider.callcenterbiossanar@gmail.com', '3124578912', 'mc12345', 1, '2025-08-27 11:00:41'),
(11, 'Dr. Andres Romero', 'lider.callcenterbiossanar@gmail.com', '312457812', 'mc1234', 1, '2025-08-27 16:01:09'),
(13, 'Dra. Gina Cristina Castillo Gonzalez', 'lider.callcenterbiossanar@gmail.com', '3212456789', 'mc12344', 1, '2025-08-27 16:05:15'),
(14, 'Dr. Alexander Rugeles', 'lider.callcenterbiossanar@gmail.com', '31423564712', 'MP14785', 1, '2025-08-27 16:25:44'),
(15, 'Dr. Erwin Alirio Vargas Ariza', 'lider.callcenterbiossanar@gmail.com', '3143154785', 'MC12457', 1, '2025-08-27 16:37:48'),
(16, 'Dr. Calixto Escorcia Angulo', 'lider.callcenterbiossanar@gmail.com', '3145415471', 'mp1234', 1, '2025-08-27 21:15:34'),
(17, 'Dr. Nestor Motta', 'lider.callcenterbiossanar@gmail.com', '3145245678', 'mp12459', 1, '2025-08-27 21:15:59'),
(18, 'Dra. Laura Juliana Morales Poveda', 'lider.callcenterbiossanar@gmail.com', '31432456742', 'mp13244', 1, '2025-08-27 21:18:44');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `doctor_locations`
--

CREATE TABLE `doctor_locations` (
  `doctor_id` bigint UNSIGNED NOT NULL,
  `location_id` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `doctor_locations`
--

INSERT INTO `doctor_locations` (`doctor_id`, `location_id`) VALUES
(1, 1),
(4, 1),
(5, 1),
(6, 1),
(7, 1),
(8, 1),
(10, 1),
(11, 1),
(13, 1),
(14, 1),
(15, 1),
(17, 1),
(18, 1),
(4, 3),
(5, 3),
(7, 3),
(10, 3),
(11, 3),
(13, 3),
(15, 3),
(16, 3),
(17, 3),
(18, 3);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `doctor_service_prices`
--

CREATE TABLE `doctor_service_prices` (
  `id` bigint UNSIGNED NOT NULL,
  `doctor_id` int UNSIGNED NOT NULL,
  `service_id` int UNSIGNED NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'COP',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `doctor_specialties`
--

CREATE TABLE `doctor_specialties` (
  `doctor_id` bigint UNSIGNED NOT NULL,
  `specialty_id` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `doctor_specialties`
--

INSERT INTO `doctor_specialties` (`doctor_id`, `specialty_id`) VALUES
(6, 1),
(16, 1),
(11, 6),
(7, 7),
(5, 8),
(1, 9),
(15, 10),
(13, 11),
(4, 12),
(8, 12),
(10, 12),
(17, 12),
(14, 13),
(18, 14);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `document_types`
--

CREATE TABLE `document_types` (
  `id` int UNSIGNED NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `full_audio` longtext,
  `file_size_bytes` int DEFAULT '0',
  `duration_secs` int DEFAULT '0',
  `format` varchar(10) DEFAULT 'mp3',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `elevenlabs_conversations`
--

CREATE TABLE `elevenlabs_conversations` (
  `id` int NOT NULL,
  `conversation_id` varchar(255) NOT NULL,
  `agent_id` varchar(255) NOT NULL,
  `user_id` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'completed',
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `duration_secs` int DEFAULT '0',
  `cost` int DEFAULT '0',
  `transcript_summary` text,
  `call_successful` enum('success','failure','unknown') DEFAULT 'unknown',
  `termination_reason` varchar(255) DEFAULT NULL,
  `full_transcript` json DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `code` varchar(25) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `has_agreement` tinyint(1) NOT NULL DEFAULT '0',
  `agreement_date` date DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `eps`
--

INSERT INTO `eps` (`id`, `name`, `code`, `status`, `has_agreement`, `agreement_date`, `notes`, `created_at`) VALUES
(9, 'COOMEVA', '2721', 'active', 1, NULL, 'Activa', '2025-08-11 12:42:09'),
(10, 'SINTRAVID', '2720', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:42:44'),
(11, 'FUNDACION AVANZAR FOS', '2719', 'active', 1, '2024-01-02', 'Activa', '2025-08-11 12:43:24'),
(12, 'FAMISANAR', '2718', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:43:58'),
(13, 'FOMAG FIDUPREVISORA S.A', '2717', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:44:39'),
(14, 'NUEVA EPS', '2715', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:45:34'),
(15, 'SOUL MEDICAL', '2714', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:46:04'),
(16, 'SALUD COOSALUD', '2713', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:46:37'),
(17, 'FAMISANAR', '2706', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:47:36'),
(18, 'FUNDACION AVANZAR FOS', '2702', 'active', 1, '2024-01-11', 'Activa', '2025-08-11 12:48:39');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `eps_agreements`
--

CREATE TABLE `eps_agreements` (
  `id` bigint UNSIGNED NOT NULL,
  `eps_id` int UNSIGNED NOT NULL,
  `location_id` int UNSIGNED DEFAULT NULL,
  `specialty_id` int UNSIGNED DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `agreement_date` date DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `feriados`
--

CREATE TABLE `feriados` (
  `id` int UNSIGNED NOT NULL,
  `fecha` date NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `tipo` enum('nacional','regional','local') NOT NULL DEFAULT 'nacional',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` bigint UNSIGNED NOT NULL,
  `date` date NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('national','regional','local','personal') NOT NULL DEFAULT 'national',
  `location_id` int UNSIGNED DEFAULT NULL,
  `is_recurring` tinyint(1) NOT NULL DEFAULT '0',
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `locations`
--

CREATE TABLE `locations` (
  `id` int UNSIGNED NOT NULL,
  `municipality_id` int UNSIGNED DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `address` varchar(200) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `type` varchar(100) NOT NULL DEFAULT 'Sucursal',
  `status` enum('Activa','En Mantenimiento','Inactiva') NOT NULL DEFAULT 'Activa',
  `capacity` smallint UNSIGNED NOT NULL DEFAULT '0',
  `current_patients` int UNSIGNED NOT NULL DEFAULT '0',
  `hours` varchar(150) DEFAULT NULL,
  `emergency_hours` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `location_id` int UNSIGNED NOT NULL,
  `specialty_id` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `location_specialties`
--

INSERT INTO `location_specialties` (`location_id`, `specialty_id`) VALUES
(1, 1),
(3, 1),
(3, 3),
(1, 5),
(3, 5),
(1, 6),
(3, 6),
(1, 7),
(3, 7),
(1, 8),
(3, 8),
(1, 9),
(3, 9),
(1, 10),
(3, 10),
(1, 11),
(3, 11),
(1, 12),
(3, 12);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `location_types`
--

CREATE TABLE `location_types` (
  `id` smallint UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int UNSIGNED NOT NULL,
  `name` varchar(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
-- Estructura de tabla para la tabla `municipalities`
--

CREATE TABLE `municipalities` (
  `id` int UNSIGNED NOT NULL,
  `zone_id` int UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` bigint UNSIGNED NOT NULL,
  `external_id` varchar(50) DEFAULT NULL,
  `document` varchar(30) NOT NULL,
  `name` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` enum('Masculino','Femenino','Otro','No especificado') NOT NULL DEFAULT 'No especificado',
  `address` varchar(200) DEFAULT NULL,
  `municipality_id` int UNSIGNED DEFAULT NULL,
  `zone_id` int UNSIGNED DEFAULT NULL,
  `insurance_eps_id` int UNSIGNED DEFAULT NULL,
  `status` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `document_type_id` int UNSIGNED DEFAULT NULL,
  `insurance_affiliation_type` enum('Contributivo','Subsidiado','Vinculado','Particular','Otro') DEFAULT NULL,
  `blood_group_id` smallint UNSIGNED DEFAULT NULL,
  `population_group_id` int UNSIGNED DEFAULT NULL,
  `education_level_id` int UNSIGNED DEFAULT NULL,
  `marital_status_id` int UNSIGNED DEFAULT NULL,
  `has_disability` tinyint(1) NOT NULL DEFAULT '0',
  `disability_type_id` int UNSIGNED DEFAULT NULL,
  `estrato` tinyint UNSIGNED DEFAULT NULL,
  `phone_alt` varchar(30) DEFAULT NULL,
  `notes` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `patients`
--

INSERT INTO `patients` (`id`, `external_id`, `document`, `name`, `phone`, `email`, `birth_date`, `gender`, `address`, `municipality_id`, `zone_id`, `insurance_eps_id`, `status`, `created_at`, `document_type_id`, `insurance_affiliation_type`, `blood_group_id`, `population_group_id`, `education_level_id`, `marital_status_id`, `has_disability`, `disability_type_id`, `estrato`, `phone_alt`, `notes`) VALUES
(1002, '11097014', 'CC 11097014', 'Juan Carlos Mantiga Sáenz', '0000000000', 'nomail@biosanarcall.site', '1990-01-01', 'Otro', 'Sin dirección', 14, NULL, 14, 'Activo', '2025-08-27 19:33:22', 1, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(1006, NULL, 'CC 98765432', 'María Elena García López', '3201234567', 'maria.garcia@example.com', '1985-03-15', 'Femenino', 'Calle 123 #45-67, Barrio Centro', 25, NULL, 9, 'Activo', '2025-08-27 20:20:48', 1, 'Contributivo', 1, 1, 3, 1, 0, NULL, 3, NULL, NULL),
(1007, NULL, '52123456', 'María Elena González Pérez', '3154567890', 'maria.gonzalez@example.com', '1985-03-15', 'Femenino', 'Carrera 15 #23-45 Barrio Centro', 25, 4, 9, 'Activo', '2025-08-28 00:27:20', 1, 'Contributivo', 7, 1, 1, 2, 0, NULL, 3, '3201234567', 'Paciente registrada a través del servidor MCP para pruebas del sistema.'),
(1011, NULL, '79876543', 'Carlos Alberto Rodríguez Mendoza', '3209876543', 'nomail@biosanarcall.site', '1982-11-10', 'Masculino', 'Carrera 20 #15-30 Barrio Los Pinos', 25, NULL, 9, 'Activo', '2025-08-28 12:09:10', 1, 'Contributivo', 1, 1, 1, 1, 0, NULL, 3, NULL, NULL),
(1012, NULL, '11235689', 'Juan Carlos Álvarez Domingo', '3105672307', 'juancarlosdomingo@gmail.com', '1997-04-30', 'Masculino', 'Carrera 20 #10-24', 26, NULL, 14, 'Activo', '2025-08-28 17:06:29', 1, 'Subsidiado', 1, 1, 1, 1, 0, NULL, 1, NULL, NULL),
(1014, NULL, '28252922', 'Ana Inés Romero Fernández', '3185676234', 'nomail@biosanarcall.site', '1960-08-16', 'Femenino', 'Carrera cuarta 437 Mogotis', 19, NULL, 14, 'Activo', '2025-08-29 18:12:55', 1, 'Subsidiado', 3, 1, 1, 2, 0, NULL, 2, NULL, NULL),
(1015, NULL, '63476284', 'Blanca Celina López Dulcey', '3157873980', 'nomail@biosanarcall.site', '1973-08-16', 'Femenino', 'Vereda El Hoyo', 19, NULL, 14, 'Activo', '2025-08-29 18:19:44', 1, 'Subsidiado', 7, 1, 1, 3, 0, NULL, 1, NULL, NULL),
(1016, NULL, '5687403', 'Juan Bautista Muñoz', '3173583022', 'nomail@biosanarcall.site', '1947-05-23', 'Masculino', 'Vereda El Hoyo', 19, NULL, 14, 'Activo', '2025-08-29 18:26:53', 1, 'Subsidiado', 7, 1, 1, 2, 0, NULL, 1, NULL, NULL),
(1017, NULL, '1244781445', 'Sara Michelle Ruiz Serrano', '3174614457', 'nomail@biosanarcall.site', '2025-03-27', 'Femenino', 'Vereda Caucho', 19, NULL, 14, 'Activo', '2025-08-29 18:35:25', 6, 'Subsidiado', 7, 1, 1, 1, 0, NULL, 1, NULL, NULL),
(1018, NULL, '11010753500', 'Andrés Felipe Romero Torozo', '3181173333', 'nomail@biosanarcall.site', '2009-05-14', 'Masculino', 'Calle 22, 641', 26, NULL, 14, 'Activo', '2025-08-29 19:18:58', 3, 'Subsidiado', 7, 1, 1, 1, 0, NULL, 2, NULL, NULL),
(1019, NULL, '37895809', 'Inés Romero Patiño', '3204778034', 'nomail@biosanarcall.site', '1974-02-08', 'Femenino', 'Vereda Alhaja', 26, NULL, 12, 'Activo', '2025-09-01 15:10:54', 1, 'Subsidiado', 1, 1, 1, 4, 0, NULL, 1, NULL, NULL),
(1020, NULL, '1098409651', 'Nieves Ludey Naranjo Ríos', '3232314877', 'nomail@biosanarcall.site', '1999-01-26', 'Femenino', 'En páramo finca del limón', 25, NULL, 14, 'Activo', '2025-09-01 15:14:20', 1, 'Subsidiado', 7, 1, 1, 3, 0, NULL, 1, NULL, NULL),
(1021, NULL, '110962323', 'Víctor Manuel Belzán Hernández', '3138851202', 'toquitadeyuca.ernesto0@gmail.com', '2010-10-17', 'Masculino', 'Carrera 2B407, Barrio Las Brisas, Zarazón', 14, NULL, 14, 'Activo', '2025-09-01 15:19:40', 3, 'Subsidiado', 7, 1, 1, 1, 0, NULL, 1, NULL, NULL),
(1022, NULL, '28423886', 'Graciela Silva Céllis', '3014555914', 'gracielasilvan5@hotmail.com', '1956-07-29', 'Femenino', 'Calle 10 Sur número 9615, segunda etapa, Rincón del Virrey, Socorro', 14, NULL, 14, 'Activo', '2025-09-01 15:28:16', 1, 'Contributivo', 7, 1, 1, 1, 0, NULL, 3, NULL, NULL),
(1023, NULL, '1098408107', 'Alba Marina Mesa', '3144908597', 'nomail@biosanarcall.site', '1991-03-29', 'Femenino', 'Vereda Resguardo, Charalá, Santander', 17, NULL, 14, 'Activo', '2025-09-01 15:29:43', 1, 'Subsidiado', 1, 1, 1, 1, 0, NULL, 1, NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `population_groups`
--

CREATE TABLE `population_groups` (
  `id` int UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
-- Estructura de tabla para la tabla `queue_entries`
--

CREATE TABLE `queue_entries` (
  `id` bigint UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `patient_id` int UNSIGNED NOT NULL,
  `specialty_id` int UNSIGNED NOT NULL,
  `priority` enum('Alta','Normal','Baja') NOT NULL DEFAULT 'Normal',
  `status` enum('waiting','assigned','scheduled','cancelled') NOT NULL DEFAULT 'waiting',
  `reason` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `assigned_user_id` int UNSIGNED DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `scheduled_appointment_id` int UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `scheduling_preallocation`
--

CREATE TABLE `scheduling_preallocation` (
  `id` bigint UNSIGNED NOT NULL,
  `doctor_id` bigint DEFAULT NULL,
  `specialty_id` int DEFAULT NULL,
  `location_id` int DEFAULT NULL,
  `availability_id` bigint DEFAULT NULL,
  `target_date` date NOT NULL,
  `pre_date` date NOT NULL,
  `slots` int NOT NULL,
  `assigned_count` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `scheduling_preallocation_assignments`
--

CREATE TABLE `scheduling_preallocation_assignments` (
  `id` bigint UNSIGNED NOT NULL,
  `preallocation_id` bigint UNSIGNED NOT NULL,
  `patient_id` bigint UNSIGNED NOT NULL,
  `appointment_id` bigint UNSIGNED DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `services`
--

CREATE TABLE `services` (
  `id` int UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `category` enum('consulta','laboratorio','imagen','procedimiento','otro') NOT NULL DEFAULT 'consulta',
  `description` text,
  `base_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` char(3) NOT NULL DEFAULT 'COP',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `default_duration_minutes` smallint UNSIGNED NOT NULL DEFAULT '30',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `specialties`
--

INSERT INTO `specialties` (`id`, `name`, `description`, `default_duration_minutes`, `active`, `created_at`) VALUES
(1, 'Medicina General', 'Atención primaria', 15, 1, '2025-08-08 21:47:19'),
(3, 'Cardiología', 'Corazon', 15, 1, '2025-08-08 23:28:59'),
(5, 'Endocrinologia', 'Endocrinologos', 15, 1, '2025-08-11 03:15:32'),
(6, 'Ecografías', 'Ecografías', 15, 1, '2025-08-11 12:52:02'),
(7, 'Psicología', 'Psicología', 15, 1, '2025-08-11 12:52:18'),
(8, 'Pediatría', 'Pediatría', 15, 1, '2025-08-11 12:52:33'),
(9, 'Medicina interna', 'Medicina interna ', 15, 1, '2025-08-11 12:52:52'),
(10, 'Dermatología', 'Dermatología', 15, 1, '2025-08-11 12:53:07'),
(11, 'Nutrición', 'Nutrición', 15, 1, '2025-08-11 12:53:19'),
(12, 'Ginecología', 'Ginecología', 15, 1, '2025-08-11 12:53:30'),
(13, 'Medicina familiar', 'cuidado de familia', 15, 1, '2025-08-27 16:07:32'),
(14, 'Odontologia', 'Odontologia', 20, 1, '2025-08-27 21:17:27');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `system_settings`
--

CREATE TABLE `system_settings` (
  `id` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `notifications_email_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `notifications_email` varchar(150) DEFAULT NULL,
  `alert_long_queue_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `alert_agents_offline_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `ai_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `ai_auto_answer` tinyint(1) NOT NULL DEFAULT '1',
  `ai_response_timeout_seconds` smallint UNSIGNED NOT NULL DEFAULT '3',
  `ai_start_time` time DEFAULT NULL,
  `ai_end_time` time DEFAULT NULL,
  `ai_mon` tinyint(1) NOT NULL DEFAULT '1',
  `ai_tue` tinyint(1) NOT NULL DEFAULT '1',
  `ai_wed` tinyint(1) NOT NULL DEFAULT '1',
  `ai_thu` tinyint(1) NOT NULL DEFAULT '1',
  `ai_fri` tinyint(1) NOT NULL DEFAULT '1',
  `ai_sat` tinyint(1) NOT NULL DEFAULT '0',
  `ai_sun` tinyint(1) NOT NULL DEFAULT '0',
  `ai_pause_holidays` tinyint(1) NOT NULL DEFAULT '1',
  `ai_vacation_mode` tinyint(1) NOT NULL DEFAULT '0',
  `ai_break_start` time DEFAULT NULL,
  `ai_break_end` time DEFAULT NULL,
  `ai_message_welcome` varchar(255) DEFAULT NULL,
  `ai_message_offline` varchar(255) DEFAULT NULL,
  `ai_message_transfer` varchar(255) DEFAULT NULL,
  `org_name` varchar(150) DEFAULT NULL,
  `org_address` varchar(200) DEFAULT NULL,
  `org_phone` varchar(30) DEFAULT NULL,
  `cc_call_recording_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `cc_auto_distribution_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `cc_max_wait_minutes` smallint UNSIGNED NOT NULL DEFAULT '15',
  `org_nit` varchar(30) DEFAULT NULL,
  `org_logo_url` varchar(255) DEFAULT NULL,
  `org_timezone` varchar(64) NOT NULL DEFAULT 'America/Bogota'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `system_settings`
--

INSERT INTO `system_settings` (`id`, `notifications_email_enabled`, `notifications_email`, `alert_long_queue_enabled`, `alert_agents_offline_enabled`, `created_at`, `updated_at`, `ai_enabled`, `ai_auto_answer`, `ai_response_timeout_seconds`, `ai_start_time`, `ai_end_time`, `ai_mon`, `ai_tue`, `ai_wed`, `ai_thu`, `ai_fri`, `ai_sat`, `ai_sun`, `ai_pause_holidays`, `ai_vacation_mode`, `ai_break_start`, `ai_break_end`, `ai_message_welcome`, `ai_message_offline`, `ai_message_transfer`, `org_name`, `org_address`, `org_phone`, `cc_call_recording_enabled`, `cc_auto_distribution_enabled`, `cc_max_wait_minutes`, `org_nit`, `org_logo_url`, `org_timezone`) VALUES
(1, 1, 'bastidasdaveusa@gmail.com', 1, 1, '2025-08-08 22:20:45', '2025-08-11 12:58:36', 1, 1, 3, '08:00:00', '17:00:00', 1, 1, 1, 1, 1, 0, 0, 1, 0, '10:49:00', '11:51:00', NULL, NULL, NULL, 'Fundación Biossanar IPS', 'Cra. 9 #10-29, San Gil, Santander', '6076911308', 1, 1, 15, '9005354050', NULL, 'America/Bogota');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `timezones`
--

CREATE TABLE `timezones` (
  `id` smallint UNSIGNED NOT NULL,
  `name` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `role` enum('admin','supervisor','agent','doctor','reception') NOT NULL DEFAULT 'agent',
  `status` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `password_hash` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `phone`, `department`, `role`, `status`, `password_hash`, `created_at`) VALUES
(3, 'Demo', 'demo@demo.com', '+57123456789', 'administracion', 'admin', 'Activo', '$2a$10$NeLJqfim33EVprLZuNG36uNxuBWvEPgGsSTf6cO46Ti.ycyEBsIiO', '2025-08-09 23:03:55'),
(4, 'Administrador', 'admin@example.com', NULL, NULL, 'admin', 'Activo', '$2a$10$OCEFw6ZJYbnpH2bGWtWaLuhdXO7r/eIR1Ha6MLWjU9wybwJctBjGu', '2025-08-25 16:03:06');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `waiting_queue`
--

CREATE TABLE `waiting_queue` (
  `id` bigint UNSIGNED NOT NULL,
  `patient_id` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(150) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `specialty_id` int UNSIGNED NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `priority` enum('Alta','Normal','Baja') NOT NULL DEFAULT 'Normal',
  `status` enum('En espera','Contactado','Agendado','Descartado') NOT NULL DEFAULT 'En espera',
  `wait_seconds` int UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `webhook_config`
--

CREATE TABLE `webhook_config` (
  `id` int NOT NULL,
  `service_name` varchar(50) NOT NULL,
  `endpoint_url` varchar(500) NOT NULL,
  `secret_key` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `webhook_types` json NOT NULL,
  `retry_count` int DEFAULT '3',
  `timeout_seconds` int DEFAULT '30',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int NOT NULL,
  `webhook_config_id` int NOT NULL,
  `conversation_id` varchar(255) DEFAULT NULL,
  `webhook_type` enum('transcription','audio','call_started','call_ended') NOT NULL,
  `request_payload` json DEFAULT NULL,
  `response_status` int DEFAULT NULL,
  `response_body` text,
  `processing_time_ms` int DEFAULT '0',
  `error_message` text,
  `retry_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `id` int UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `zones`
--

INSERT INTO `zones` (`id`, `name`, `description`, `created_at`) VALUES
(3, 'Zona de Socorro', 'Aqui van los municipio en los que se va prestar el servicio', '2025-08-11 12:19:59'),
(4, 'Zona San Gil', 'Aqui van los municipio en los que se va prestar el servicio', '2025-08-11 12:20:10');

-- --------------------------------------------------------

--
-- Estructura para la vista `appointment_daily_stats`
--
DROP TABLE IF EXISTS `appointment_daily_stats`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `appointment_daily_stats`  AS SELECT cast(`appointments`.`scheduled_at` as date) AS `date`, `appointments`.`location_id` AS `location_id`, `appointments`.`specialty_id` AS `specialty_id`, count(0) AS `total_appointments`, sum((`appointments`.`status` = 'Completada')) AS `completed_appointments`, sum((`appointments`.`status` = 'Cancelada')) AS `cancelled_appointments`, sum((`appointments`.`status` = 'Pendiente')) AS `pending_appointments`, round(((sum((`appointments`.`status` = 'Completada')) / nullif(count(0),0)) * 100),2) AS `completion_rate` FROM `appointments` GROUP BY cast(`appointments`.`scheduled_at` as date), `appointments`.`location_id`, `appointments`.`specialty_id` ;

-- --------------------------------------------------------

--
-- Estructura para la vista `call_stats_view`
--
DROP TABLE IF EXISTS `call_stats_view`;

CREATE ALGORITHM=UNDEFINED DEFINER=`biosanar_user`@`localhost` SQL SECURITY DEFINER VIEW `call_stats_view`  AS SELECT cast(`c`.`start_time` as date) AS `call_date`, `c`.`agent_id` AS `agent_id`, count(0) AS `total_calls`, sum((case when (`c`.`call_successful` = 'success') then 1 else 0 end)) AS `successful_calls`, sum((case when (`c`.`call_successful` = 'failure') then 1 else 0 end)) AS `failed_calls`, sum(`c`.`duration_secs`) AS `total_duration_secs`, sum(`c`.`cost`) AS `total_cost`, avg(`c`.`duration_secs`) AS `avg_duration_secs`, avg(`c`.`cost`) AS `avg_cost` FROM `elevenlabs_conversations` AS `c` WHERE (`c`.`start_time` is not null) GROUP BY cast(`c`.`start_time` as date), `c`.`agent_id` ;

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
  ADD KEY `idx_appointments_availability_status` (`availability_id`,`status`);

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
  ADD KEY `idx_availability_date_doctor` (`date`,`doctor_id`);

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
  ADD UNIQUE KEY `uk_eps_code` (`code`);

--
-- Indices de la tabla `eps_agreements`
--
ALTER TABLE `eps_agreements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_eps_loc_spec` (`eps_id`,`location_id`,`specialty_id`),
  ADD KEY `fk_epsagr_location` (`location_id`),
  ADD KEY `fk_epsagr_specialty` (`specialty_id`);

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
  ADD KEY `idx_patients_status_created` (`status`,`created_at`);
ALTER TABLE `patients` ADD FULLTEXT KEY `ft_patients_search` (`name`,`document`,`phone`,`email`);

--
-- Indices de la tabla `population_groups`
--
ALTER TABLE `population_groups`
  ADD PRIMARY KEY (`id`);

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
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_users_email` (`email`);

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
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `agenda_suggestions`
--
ALTER TABLE `agenda_suggestions`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `agenda_templates`
--
ALTER TABLE `agenda_templates`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `agent_call_stats`
--
ALTER TABLE `agent_call_stats`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ai_transfers`
--
ALTER TABLE `ai_transfers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=105;

--
-- AUTO_INCREMENT de la tabla `appointment_billing`
--
ALTER TABLE `appointment_billing`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `availabilities`
--
ALTER TABLE `availabilities`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=104;

--
-- AUTO_INCREMENT de la tabla `availability_distribution`
--
ALTER TABLE `availability_distribution`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `billing_audit_logs`
--
ALTER TABLE `billing_audit_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `blood_groups`
--
ALTER TABLE `blood_groups`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=49;

--
-- AUTO_INCREMENT de la tabla `calls`
--
ALTER TABLE `calls`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `call_events`
--
ALTER TABLE `call_events`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `call_logs`
--
ALTER TABLE `call_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `call_notifications`
--
ALTER TABLE `call_notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `call_statuses`
--
ALTER TABLE `call_statuses`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=440;

--
-- AUTO_INCREMENT de la tabla `conflict_resolutions`
--
ALTER TABLE `conflict_resolutions`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `conversation_memory`
--
ALTER TABLE `conversation_memory`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT de la tabla `demand_patterns`
--
ALTER TABLE `demand_patterns`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `disability_types`
--
ALTER TABLE `disability_types`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `doctors`
--
ALTER TABLE `doctors`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de la tabla `doctor_service_prices`
--
ALTER TABLE `doctor_service_prices`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `document_types`
--
ALTER TABLE `document_types`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `education_levels`
--
ALTER TABLE `education_levels`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT de la tabla `elevenlabs_audio`
--
ALTER TABLE `elevenlabs_audio`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `elevenlabs_conversations`
--
ALTER TABLE `elevenlabs_conversations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `eps`
--
ALTER TABLE `eps`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de la tabla `eps_agreements`
--
ALTER TABLE `eps_agreements`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `feriados`
--
ALTER TABLE `feriados`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de la tabla `holidays`
--
ALTER TABLE `holidays`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `locations`
--
ALTER TABLE `locations`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `location_types`
--
ALTER TABLE `location_types`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=531;

--
-- AUTO_INCREMENT de la tabla `marital_statuses`
--
ALTER TABLE `marital_statuses`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `municipalities`
--
ALTER TABLE `municipalities`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT de la tabla `patients`
--
ALTER TABLE `patients`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1024;

--
-- AUTO_INCREMENT de la tabla `population_groups`
--
ALTER TABLE `population_groups`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=55;

--
-- AUTO_INCREMENT de la tabla `queue_entries`
--
ALTER TABLE `queue_entries`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `scheduling_preallocation`
--
ALTER TABLE `scheduling_preallocation`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=63;

--
-- AUTO_INCREMENT de la tabla `scheduling_preallocation_assignments`
--
ALTER TABLE `scheduling_preallocation_assignments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `services`
--
ALTER TABLE `services`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=366;

--
-- AUTO_INCREMENT de la tabla `specialties`
--
ALTER TABLE `specialties`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT de la tabla `timezones`
--
ALTER TABLE `timezones`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3090;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `waiting_queue`
--
ALTER TABLE `waiting_queue`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `webhook_config`
--
ALTER TABLE `webhook_config`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `webhook_logs`
--
ALTER TABLE `webhook_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT de la tabla `zones`
--
ALTER TABLE `zones`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `ai_transfers`
--
ALTER TABLE `ai_transfers`
  ADD CONSTRAINT `fk_ai_transfers_location` FOREIGN KEY (`preferred_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_ai_transfers_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `appointments`
--
ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appt_availability` FOREIGN KEY (`availability_id`) REFERENCES `availabilities` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_appt_createdby` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_appt_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_appt_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_appt_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_appt_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `appointment_billing`
--
ALTER TABLE `appointment_billing`
  ADD CONSTRAINT `fk_ab_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `availabilities`
--
ALTER TABLE `availabilities`
  ADD CONSTRAINT `fk_avail_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_avail_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_avail_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `availability_distribution`
--
ALTER TABLE `availability_distribution`
  ADD CONSTRAINT `fk_ad_availability` FOREIGN KEY (`availability_id`) REFERENCES `availabilities` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Filtros para la tabla `call_logs`
--
ALTER TABLE `call_logs`
  ADD CONSTRAINT `fk_call_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_call_queue` FOREIGN KEY (`queue_id`) REFERENCES `waiting_queue` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_call_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_call_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_calllogs_status` FOREIGN KEY (`status_id`) REFERENCES `call_statuses` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `call_notifications`
--
ALTER TABLE `call_notifications`
  ADD CONSTRAINT `call_notifications_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `call_notifications_ibfk_2` FOREIGN KEY (`conversation_id`) REFERENCES `elevenlabs_conversations` (`conversation_id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `doctor_locations`
--
ALTER TABLE `doctor_locations`
  ADD CONSTRAINT `fk_docloc_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_docloc_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `doctor_service_prices`
--
ALTER TABLE `doctor_service_prices`
  ADD CONSTRAINT `fk_dsp_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Filtros para la tabla `doctor_specialties`
--
ALTER TABLE `doctor_specialties`
  ADD CONSTRAINT `fk_docspec_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_docspec_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `elevenlabs_audio`
--
ALTER TABLE `elevenlabs_audio`
  ADD CONSTRAINT `elevenlabs_audio_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `elevenlabs_conversations` (`conversation_id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `eps_agreements`
--
ALTER TABLE `eps_agreements`
  ADD CONSTRAINT `fk_epsagr_eps` FOREIGN KEY (`eps_id`) REFERENCES `eps` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_epsagr_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_epsagr_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `locations`
--
ALTER TABLE `locations`
  ADD CONSTRAINT `fk_locations_municipality` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `location_specialties`
--
ALTER TABLE `location_specialties`
  ADD CONSTRAINT `fk_locspec_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_locspec_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Filtros para la tabla `municipalities`
--
ALTER TABLE `municipalities`
  ADD CONSTRAINT `fk_municipalities_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

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
  ADD CONSTRAINT `fk_patients_eps` FOREIGN KEY (`insurance_eps_id`) REFERENCES `eps` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_patients_municipality` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_patients_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `scheduling_preallocation_assignments`
--
ALTER TABLE `scheduling_preallocation_assignments`
  ADD CONSTRAINT `fk_preallocation_assignment` FOREIGN KEY (`preallocation_id`) REFERENCES `scheduling_preallocation` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `waiting_queue`
--
ALTER TABLE `waiting_queue`
  ADD CONSTRAINT `fk_queue_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_queue_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `webhook_logs`
--
ALTER TABLE `webhook_logs`
  ADD CONSTRAINT `webhook_logs_ibfk_1` FOREIGN KEY (`webhook_config_id`) REFERENCES `webhook_config` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
