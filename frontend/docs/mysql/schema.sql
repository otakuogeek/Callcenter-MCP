-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: localhost
-- Tiempo de generación: 09-08-2025 a las 00:20:00
-- Versión del servidor: 8.0.42-0ubuntu0.22.04.2
-- Versión de PHP: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `callcenter`
--

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
(1, 1, 1, 1, 1, 1, '2025-08-08 09:30:00', 30, 'Presencial', 'Pendiente', NULL, NULL, NULL, NULL, 1, '2025-08-08 21:48:53');

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
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ;

--
-- Volcado de datos para la tabla `availabilities`
--

INSERT INTO `availabilities` (`id`, `location_id`, `specialty_id`, `doctor_id`, `date`, `start_time`, `end_time`, `capacity`, `booked_slots`, `status`, `notes`, `created_at`) VALUES
(1, 1, 1, 1, '2025-08-08', '09:00:00', '12:00:00', 10, 0, 'Activa', NULL, '2025-08-08 21:48:39');

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
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
(1, 'Dr. Demo 33', 'dr.demo@example.com', '3010001111', 'LIC-12345', 1, '2025-08-08 21:48:13'),
(2, 'Dr. Dave Bastidas', 'dae@gmail.com', '+584263774021', 'MP12322', 1, '2025-08-08 23:32:06');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `doctor_locations`
--

CREATE TABLE `doctor_locations` (
  `doctor_id` bigint UNSIGNED NOT NULL,
  `location_id` int UNSIGNED NOT NULL
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
(2, 3);

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
(1, 'Coosalud EPS-S', 'EPS1', 'active', 1, '2000-01-02', 'Acrtivo', '2025-08-09 01:17:10');

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
(1, NULL, 'Sede Centro', 'Calle 123 #45-67', '3001234567', 'Sucursal', 'Activa', 5, 0, 'Lunes a Viernes de 7 a 19', '24/7', '2025-08-08 21:48:04');

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
(1, 3);

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
(1, 'Sede Principal', 'active'),
(2, 'Sucursal', 'active'),
(3, 'Consultorio', 'active'),
(4, 'Centro de Especialidades', 'active');

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
(1, 1, 'Bucaramanga', '2025-08-09 00:52:09');

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
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `patients`
--

INSERT INTO `patients` (`id`, `external_id`, `document`, `name`, `phone`, `email`, `birth_date`, `gender`, `address`, `municipality_id`, `zone_id`, `insurance_eps_id`, `status`, `created_at`) VALUES
(1, NULL, 'CC100200300', 'Juan Pérez', '3022223333', 'juan.perez@example.com', NULL, 'No especificado', NULL, NULL, NULL, NULL, 'Activo', '2025-08-08 21:48:25');

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
(1, 'Medicina General2', 'Atención primaria', 30, 1, '2025-08-08 21:47:19'),
(3, 'Cardiología', 'Corazon', 30, 1, '2025-08-08 23:28:59');

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
(1, 1, 'bastidasdaveusa@gmail.com', 1, 1, '2025-08-08 22:20:45', '2025-08-09 02:51:13', 1, 1, 3, '08:00:00', '17:00:00', 1, 1, 1, 1, 1, 0, 0, 1, 0, '10:49:00', '11:51:00', NULL, NULL, NULL, 'Valeria - Centro Médico', 'Socorro, Santander, Colombia', '+57 1 234 5678', 1, 1, 15, NULL, NULL, 'America/Bogota');

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
(1, 'Administrador', 'bastidasdaveusa@gmail.com', '+15854990776', 'administracion', 'admin', 'Activo', '$2a$10$JLtxqamA9oCxXZrosEsOpew2qlZuBhSNU2obzVTCV/FS993uliUty', '2025-08-08 21:19:54');

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
(1, 'Zona Norte', 'Zona del norte', '2025-08-09 00:51:52');

--
-- Índices para tablas volcadas
--

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
  ADD KEY `fk_appt_createdby` (`created_by_user_id`);

--
-- Indices de la tabla `availabilities`
--
ALTER TABLE `availabilities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_avail_date` (`date`),
  ADD KEY `idx_avail_loc_date` (`location_id`,`date`),
  ADD KEY `idx_avail_status` (`status`),
  ADD KEY `fk_avail_specialty` (`specialty_id`),
  ADD KEY `fk_avail_doctor` (`doctor_id`);

--
-- Indices de la tabla `call_logs`
--
ALTER TABLE `call_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_call_patient` (`patient_id`),
  ADD KEY `fk_call_specialty` (`specialty_id`),
  ADD KEY `fk_call_queue` (`queue_id`),
  ADD KEY `fk_call_user` (`user_id`);

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
-- Indices de la tabla `doctor_specialties`
--
ALTER TABLE `doctor_specialties`
  ADD PRIMARY KEY (`doctor_id`,`specialty_id`),
  ADD KEY `fk_docspec_specialty` (`specialty_id`);

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
-- Indices de la tabla `locations`
--
ALTER TABLE `locations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_locations_municipality` (`municipality_id`);

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
  ADD KEY `fk_patients_eps` (`insurance_eps_id`);

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
-- Indices de la tabla `zones`
--
ALTER TABLE `zones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `availabilities`
--
ALTER TABLE `availabilities`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `call_logs`
--
ALTER TABLE `call_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `doctors`
--
ALTER TABLE `doctors`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `eps`
--
ALTER TABLE `eps`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `eps_agreements`
--
ALTER TABLE `eps_agreements`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `locations`
--
ALTER TABLE `locations`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `location_types`
--
ALTER TABLE `location_types`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT de la tabla `municipalities`
--
ALTER TABLE `municipalities`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `patients`
--
ALTER TABLE `patients`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `specialties`
--
ALTER TABLE `specialties`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `timezones`
--
ALTER TABLE `timezones`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=392;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `waiting_queue`
--
ALTER TABLE `waiting_queue`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `zones`
--
ALTER TABLE `zones`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Restricciones para tablas volcadas
--

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
-- Filtros para la tabla `availabilities`
--
ALTER TABLE `availabilities`
  ADD CONSTRAINT `fk_avail_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_avail_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_avail_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `call_logs`
--
ALTER TABLE `call_logs`
  ADD CONSTRAINT `fk_call_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_call_queue` FOREIGN KEY (`queue_id`) REFERENCES `waiting_queue` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_call_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_call_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `doctor_locations`
--
ALTER TABLE `doctor_locations`
  ADD CONSTRAINT `fk_docloc_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_docloc_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `doctor_specialties`
--
ALTER TABLE `doctor_specialties`
  ADD CONSTRAINT `fk_docspec_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_docspec_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

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
  ADD CONSTRAINT `fk_patients_eps` FOREIGN KEY (`insurance_eps_id`) REFERENCES `eps` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_patients_municipality` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_patients_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `waiting_queue`
--
ALTER TABLE `waiting_queue`
  ADD CONSTRAINT `fk_queue_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_queue_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
