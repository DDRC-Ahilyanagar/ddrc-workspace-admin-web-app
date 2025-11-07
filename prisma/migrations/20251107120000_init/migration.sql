-- Prisma migration to bootstrap legacy DDRC schema
-- Ensures tables exist without dropping existing data

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `user_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_type` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_type` (`user_type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `passkey` smallint unsigned DEFAULT NULL,
  `user_type` enum('field_officer','admin','supervisor') NOT NULL DEFAULT 'field_officer',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `otp_verified_at` timestamp NULL DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `user_type_id` bigint unsigned DEFAULT NULL,
  `profile_photo` text DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_phone_unique` (`contact_number`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `unique_contact` (`contact_number`),
  UNIQUE KEY `unique_email` (`email`),
  UNIQUE KEY `unique_passkey` (`passkey`),
  KEY `users_phone_user_type_index` (`contact_number`,`user_type`),
  KEY `users_is_active_index` (`is_active`),
  KEY `fk_user_type` (`user_type_id`),
  CONSTRAINT `fk_user_type` FOREIGN KEY (`user_type_id`) REFERENCES `user_types` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_passkey_4digit` CHECK (`passkey` IS NULL OR `passkey` BETWEEN 1000 AND 9999)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `phone` varchar(15) NOT NULL,
  `otp` varchar(6) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('sent','verified','expired') NOT NULL DEFAULT 'sent',
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `otp_verifications_phone_status_index` (`phone`,`status`),
  KEY `otp_verifications_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `access_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `selfie_url` varchar(255) NOT NULL,
  `status` enum('pending','approved','declined') NOT NULL DEFAULT 'pending',
  `admin_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_access_requests_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(191) NOT NULL,
  `setting_value` varchar(191) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title_marathi` varchar(255) NOT NULL,
  `title_english` varchar(255) DEFAULT NULL,
  `sort_order` int NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sections_sort_order_index` (`sort_order`),
  KEY `sections_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `questions` (
  `id` bigint unsigned NOT NULL,
  `section_id` bigint unsigned NOT NULL,
  `question` text NOT NULL,
  `question_type` varchar(50) NOT NULL,
  `multi_select` tinyint(1) NOT NULL DEFAULT 0,
  `options` text DEFAULT NULL,
  `rendering_condition` varchar(10) DEFAULT NULL,
  `rendering_question` varchar(255) DEFAULT NULL,
  `rendering_value` varchar(255) DEFAULT NULL,
  `regex` varchar(255) DEFAULT NULL,
  `valid_input` varchar(20) DEFAULT NULL,
  `max_length` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Active',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_on` timestamp NULL DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `updated_on` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_section_id` (`section_id`),
  CONSTRAINT `fk_questions_section` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `disability_types` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `label_marathi` varchar(255) NOT NULL,
  `label_english` varchar(255) NOT NULL,
  `aliases` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`aliases`)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_labels` (`label_marathi`,`label_english`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `camps` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `year_label` varchar(255) NOT NULL,
  `location` varchar(255) NOT NULL,
  `start_date` date NOT NULL,
  `days_count` tinyint NOT NULL,
  `end_date` date NOT NULL,
  `phase` enum('data_collection','examination','distribution') NOT NULL DEFAULT 'data_collection',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `camps_start_date_end_date_index` (`start_date`,`end_date`),
  KEY `camps_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `officers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `designation` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `officers_email_unique` (`email`),
  KEY `officers_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `aadhaars` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `aadhaar_number` char(12) NOT NULL,
  `officer_id` bigint unsigned NOT NULL DEFAULT 1,
  `camp_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aadhaars_camp_id_aadhaar_number_unique` (`camp_id`,`aadhaar_number`),
  KEY `aadhaars_aadhaar_number_index` (`aadhaar_number`),
  CONSTRAINT `aadhaars_camp_id_foreign` FOREIGN KEY (`camp_id`) REFERENCES `camps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `survey_aadhar` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `aadhar_no` varchar(20) NOT NULL,
  `user_id` bigint unsigned NOT NULL DEFAULT 1,
  `front_image` text DEFAULT NULL,
  `back_image` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `holder_name` varchar(255) DEFAULT NULL,
  `address_text` text DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `taluka` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `dob` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_aadhar` (`aadhar_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `surveys` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `village_name` varchar(255) NOT NULL,
  `district` varchar(255) NOT NULL,
  `state` varchar(255) NOT NULL,
  `status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  `questions_answered` int NOT NULL DEFAULT 0,
  `total_questions` int NOT NULL DEFAULT 196,
  `completion_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `grade` varchar(255) DEFAULT NULL,
  `rank` varchar(255) DEFAULT NULL,
  `answers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`answers`)),
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `surveys_user_id_status_index` (`user_id`,`status`),
  KEY `surveys_village_name_district_index` (`village_name`,`district`),
  KEY `surveys_completion_percentage_index` (`completion_percentage`),
  CONSTRAINT `surveys_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `answers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `camp_id` bigint unsigned DEFAULT NULL,
  `aadhaar_id` bigint unsigned NOT NULL,
  `officer_id` bigint unsigned NOT NULL,
  `question_id` bigint unsigned NOT NULL,
  `answer_text` text DEFAULT NULL,
  `answer_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`answer_json`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `aadhar_no` varchar(20) DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `section_id` bigint unsigned DEFAULT NULL,
  `answer` text DEFAULT NULL,
  `aadhar_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `answers_camp_id_aadhaar_id_question_id_unique` (`camp_id`,`aadhaar_id`,`question_id`),
  KEY `answers_officer_id_foreign` (`officer_id`),
  KEY `answers_camp_id_aadhaar_id_index` (`camp_id`,`aadhaar_id`),
  KEY `answers_question_id_index` (`question_id`),
  KEY `idx_question` (`question_id`),
  KEY `idx_section` (`section_id`),
  KEY `idx_aadhaar` (`aadhaar_id`),
  CONSTRAINT `answers_aadhaar_id_foreign` FOREIGN KEY (`aadhaar_id`) REFERENCES `aadhaars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `answers_camp_id_foreign` FOREIGN KEY (`camp_id`) REFERENCES `camps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `answers_officer_id_foreign` FOREIGN KEY (`officer_id`) REFERENCES `officers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `answers_question_id_foreign` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed reference data with idempotent inserts

INSERT INTO `user_types` (`id`,`user_type`,`created_at`,`created_by`,`updated_at`,`updated_by`,`status`)
VALUES
  (1,'Field officer','2025-11-06 06:23:26',NULL,'2025-11-06 06:23:26',NULL,'active'),
  (2,'admin','2025-11-06 06:23:26',NULL,'2025-11-06 06:23:26',NULL,'active'),
  (3,'practitioner','2025-11-06 06:23:26',NULL,'2025-11-06 06:23:26',NULL,'active')
ON DUPLICATE KEY UPDATE
  `user_type` = VALUES(`user_type`),
  `status` = VALUES(`status`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `users` (`id`,`name`,`email`,`contact_number`,`passkey`,`user_type`,`is_active`,`email_verified_at`,`otp_verified_at`,`last_login`,`password`,`remember_token`,`created_at`,`updated_at`,`user_type_id`,`profile_photo`,`created_by`,`updated_by`,`status`)
VALUES
  (1,'Admin User','utkrranti@gmail.com','7768068585',NULL,'admin',1,NULL,NULL,NULL,NULL,NULL,'2025-11-06 12:51:54','2025-11-06 12:51:54',2,NULL,NULL,NULL,'active'),
  (2,'Pranit','utkrranti.cc@gmail.com','9561923703',5668,'field_officer',1,NULL,NULL,NULL,NULL,NULL,'2025-11-06 12:51:54','2025-11-06 12:51:54',1,NULL,NULL,NULL,'active')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `user_type` = VALUES(`user_type`),
  `status` = VALUES(`status`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `otp_verifications` (`id`,`phone`,`otp`,`expires_at`,`status`,`verified_at`,`created_at`,`updated_at`)
VALUES
  (1,'9561923703','503169','2025-10-28 06:18:50','verified',NULL,'2025-10-28 00:48:37','2025-10-28 00:48:50'),
  (2,'7768068585','612767','2025-11-04 02:58:54','sent',NULL,'2025-11-04 02:53:54','2025-11-04 02:53:54'),
  (3,'7768068585','177644','2025-11-04 02:59:37','sent',NULL,'2025-11-04 02:54:37','2025-11-04 02:54:37'),
  (4,'7768068585','234534','2025-11-04 03:00:40','sent',NULL,'2025-11-04 02:55:40','2025-11-04 02:55:40'),
  (5,'9561923703','354921','2025-11-04 03:01:10','sent',NULL,'2025-11-04 02:56:10','2025-11-04 02:56:10'),
  (6,'9561923703','299511','2025-11-04 03:03:13','sent',NULL,'2025-11-04 02:58:13','2025-11-04 02:58:13'),
  (7,'7768068585','991305','2025-11-04 03:11:07','sent',NULL,'2025-11-04 03:06:07','2025-11-04 03:06:07'),
  (8,'7768068585','333449','2025-11-04 03:13:36','sent',NULL,'2025-11-04 03:08:36','2025-11-04 03:08:36'),
  (9,'7768068585','120585','2025-11-04 03:16:13','sent',NULL,'2025-11-04 03:11:13','2025-11-04 03:11:13'),
  (10,'7768068585','430707','2025-11-04 03:20:26','sent',NULL,'2025-11-04 03:15:26','2025-11-04 03:15:26'),
  (11,'7768068585','137405','2025-11-04 03:23:10','sent',NULL,'2025-11-04 03:18:10','2025-11-04 03:18:10'),
  (12,'7768068585','109034','2025-11-04 03:21:06','verified','2025-11-04 03:21:06','2025-11-04 03:20:47','2025-11-04 03:21:06'),
  (13,'7768068585','827540','2025-11-04 03:41:20','verified','2025-11-04 03:41:20','2025-11-04 03:38:39','2025-11-04 03:41:20'),
  (14,'7768068585','316144','2025-11-04 04:18:24','verified','2025-11-04 04:18:24','2025-11-04 04:18:13','2025-11-04 04:18:24'),
  (15,'7768068585','766925','2025-11-05 04:30:08','verified','2025-11-05 04:30:08','2025-11-05 04:29:55','2025-11-05 04:30:08'),
  (16,'7768068585','704334','2025-11-07 10:29:22','expired',NULL,'2025-11-06 12:34:43','2025-11-07 10:29:22'),
  (17,'7768068585','691033','2025-11-07 10:29:19','expired',NULL,'2025-11-06 12:40:09','2025-11-07 10:29:19'),
  (18,'9561923703','397377','2025-11-06 12:59:41','sent',NULL,'2025-11-06 12:54:41','2025-11-06 12:54:41'),
  (19,'9561923703','208496','2025-11-06 12:55:35','verified','2025-11-06 12:55:35','2025-11-06 12:55:26','2025-11-06 12:55:35'),
  (20,'9561923703','151316','2025-11-06 13:14:19','sent',NULL,'2025-11-06 13:09:19','2025-11-06 13:09:19'),
  (21,'9561923703','627950','2025-11-06 13:14:58','verified','2025-11-06 13:14:58','2025-11-06 13:14:49','2025-11-06 13:14:58'),
  (22,'9561923703','165351','2025-11-06 13:43:45','verified','2025-11-06 13:43:45','2025-11-06 13:43:37','2025-11-06 13:43:45'),
  (23,'9561923703','552218','2025-11-06 14:16:29','verified','2025-11-06 14:16:29','2025-11-06 14:16:22','2025-11-06 14:16:29'),
  (24,'9561923703','884222','2025-11-06 14:33:45','verified','2025-11-06 14:33:45','2025-11-06 14:33:39','2025-11-06 14:33:45'),
  (25,'9561923703','347156','2025-11-06 15:04:48','verified','2025-11-06 15:04:48','2025-11-06 15:04:41','2025-11-06 15:04:48'),
  (26,'9561923703','927045','2025-11-06 15:30:19','verified','2025-11-06 15:30:19','2025-11-06 15:30:09','2025-11-06 15:30:19'),
  (27,'9561923703','990956','2025-11-06 15:47:50','verified','2025-11-06 15:47:50','2025-11-06 15:47:41','2025-11-06 15:47:50'),
  (28,'9561923703','618055','2025-11-06 16:21:31','verified','2025-11-06 16:21:31','2025-11-06 16:21:23','2025-11-06 16:21:31'),
  (29,'9561923703','151846','2025-11-06 16:24:37','verified','2025-11-06 16:24:37','2025-11-06 16:24:29','2025-11-06 16:24:37'),
  (30,'9561923703','588519','2025-11-06 16:30:04','verified','2025-11-06 16:30:04','2025-11-06 16:29:54','2025-11-06 16:30:04'),
  (31,'9561923703','358390','2025-11-06 16:37:11','verified','2025-11-06 16:37:11','2025-11-06 16:37:03','2025-11-06 16:37:11'),
  (32,'9561923703','393843','2025-11-07 06:34:53','verified','2025-11-07 06:34:53','2025-11-07 06:34:45','2025-11-07 06:34:53'),
  (33,'7768068585','565918','2025-11-07 10:26:22','verified','2025-11-07 10:26:22','2025-11-07 10:26:06','2025-11-07 10:26:22'),
  (34,'7768068585','488172','2025-11-07 10:29:34','verified','2025-11-07 10:29:34','2025-11-07 10:29:24','2025-11-07 10:29:34'),
  (35,'7768068585','380033','2025-11-07 11:03:24','verified','2025-11-07 11:03:24','2025-11-07 11:03:14','2025-11-07 11:03:24')
ON DUPLICATE KEY UPDATE
  `status` = VALUES(`status`),
  `expires_at` = VALUES(`expires_at`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `access_requests` (`id`,`name`,`phone`,`selfie_url`,`status`,`admin_note`,`created_at`,`updated_at`)
VALUES
  (1,'karisha','7768817710','/uploads/access_requests/1762513333702-1c5b6736-5afd-49a7-9ee2-80c090ba896d.jpg','pending',NULL,'2025-11-07 11:02:13','2025-11-07 11:02:13')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `status` = VALUES(`status`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `app_settings` (`id`,`setting_key`,`setting_value`,`updated_at`,`created_at`)
VALUES
  (1,'rate_per_survey_field_officer','10','2025-11-06 13:26:43','2025-11-06 13:25:33')
ON DUPLICATE KEY UPDATE
  `setting_value` = VALUES(`setting_value`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `sections` (`id`,`title_marathi`,`title_english`,`sort_order`,`is_active`,`created_at`,`updated_at`,`name`)
VALUES
  (1,'',NULL,0,1,NULL,NULL,'वैयक्तिक माहिती'),
  (2,'',NULL,0,1,NULL,NULL,'शैक्षणिक माहिती'),
  (3,'',NULL,0,1,NULL,NULL,'पत्ता'),
  (4,'',NULL,0,1,NULL,NULL,'ओळखपत्र'),
  (5,'',NULL,0,1,NULL,NULL,'दिव्यांगता तपशील'),
  (6,'',NULL,0,1,NULL,NULL,'रेशन कार्ड विषयी'),
  (7,'',NULL,0,1,NULL,NULL,'वैवाहिक माहिती'),
  (8,'',NULL,0,1,NULL,NULL,'शेती'),
  (9,'',NULL,0,1,NULL,NULL,'दिव्यांग योजनेचा लाभ'),
  (10,'',NULL,0,1,NULL,NULL,'सहाय्यक साधने'),
  (11,'',NULL,0,1,NULL,NULL,'इतर शासकीय योजना'),
  (12,'',NULL,0,1,NULL,NULL,'दैनंदिन काम'),
  (13,'',NULL,0,1,NULL,NULL,'दिव्यांगता सोडून इतर आजाराविषयी'),
  (14,'',NULL,0,1,NULL,NULL,'अपत्याविषयी माहिती'),
  (15,'',NULL,0,1,NULL,NULL,'नोकरी / व्यवसाय')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `disability_types` (`id`,`label_marathi`,`label_english`,`aliases`)
VALUES
  (1,'अंध','Blindness','["Blindness","Blind","अंध"]'),
  (2,'दृष्टिदोष','Low Vision','["Low Vision","Low-vision","दृष्टिदोष"]'),
  (3,'कर्णबधिर','Hearing Impairment','["Hearing Impairment","deaf and hard of hearing","कर्णबधिर"]'),
  (4,'वाचादोष','Speech and Language Disability','["Speech and Language Disability","Speech & Language","वाचादोष"]'),
  (5,'अस्थिव्यंग','Locomotor Disability','["Locomotor Disability","अस्थिव्यंग"]'),
  (6,'मानसिक आजार','Mental Illness','["Mental Illness","मानसिक आजार"]'),
  (7,'अध्ययन अक्षमता','Specific Learning Disabilities','["Specific Learning Disabilities","Learning Disability","अध्ययन अक्षमता"]'),
  (8,'सेरेब्रल पालसी - मेंदूचा पक्षाघात','Cerebral Palsy','["Cerebral Palsy","सेरेब्रल पालसी"]'),
  (9,'स्वमग्न','Autism Spectrum Disorder','["Autism Spectrum Disorder","Autism","स्वमग्न"]'),
  (10,'बहुविकलांग','Multiple Disabilities including Deafblindness','["Multiple Disabilities including deafblindness","Multiple Disabilities","बहुविकलांग"]'),
  (11,'कुष्ठरोग','Leprosy Cured Persons','["Leprosy Cured persons","Leprosy","कुष्ठरोग"]'),
  (12,'बुटकेपणा','Dwarfism','["Dwarfism","बुटकेपणा"]'),
  (13,'मतिमंद','Intellectual Disability','["Intellectual Disability","ID","मतिमंद"]'),
  (14,'अविकसित मांसपेशी','Muscular Dystrophy','["Muscular Dystrophy","अविकसित मांसपेशी"]'),
  (15,'मज्जासंस्थेचे तीव्र आजार','Chronic Neurological Conditions','["Chronic Neurological conditions","Neurological","मज्जासंस्थेचे तीव्र आजार"]'),
  (16,'मेंदूतील चेतासंस्था संबंधी आजार','Multiple Sclerosis','["Multiple Sclerosis","MS","मेंदूतील चेतासंस्था संबंधी आजार"]'),
  (17,'रक्ता संबंधी कॅन्सर','Thalassemia','["Thalassemia","थॅलेसेमिया","रक्ता संबंधी कॅन्सर"]'),
  (18,'रक्तवाहिन्या संबंधित आजार','Hemophilia','["Hemophilia","रक्तवाहिन्या संबंधित आजार"]'),
  (19,'रक्ता संबंधी रक्ताचे प्रमाण कमी','Sickle Cell Disease','["Sickle Cell disease","Sickle Cell","रक्ता संबंधी रक्ताचे प्रमाण कमी"]'),
  (20,'एसिड हल्लाग्रस्त पीडित','Acid Attack Victim','["Acid Attack victim","Acid Attack","एसिड हल्लाग्रस्त पीडित"]'),
  (21,'कंपावत रोग','Parkinson''s Disease','["Parkinson''s disease","Parkinsons","कंपावत रोग"]')
ON DUPLICATE KEY UPDATE
  `label_english` = VALUES(`label_english`),
  `aliases` = VALUES(`aliases`);

INSERT INTO `camps` (`id`,`name`,`year_label`,`location`,`start_date`,`days_count`,`end_date`,`phase`,`is_active`,`created_at`,`updated_at`)
VALUES
  (1,'SIPDA','2024-25','Ahilyanagar','2025-10-21',3,'2025-10-29','data_collection',1,'2025-10-22 08:17:05','2025-10-22 08:41:09'),
  (2,'SIPDA','2025-26','Ahilyanagar','2025-10-21',3,'2025-10-29','data_collection',1,'2025-10-22 08:17:05','2025-10-22 08:41:09'),
  (3,'ADIP','2024-25','Ahilyanagar','2025-10-21',3,'2025-10-29','data_collection',1,'2025-10-22 08:17:05','2025-10-22 08:41:09'),
  (4,'ADIP','2025-26','Ahilyanagar','2025-10-21',3,'2025-10-29','data_collection',1,'2025-10-22 08:17:05','2025-10-22 08:41:09')
ON DUPLICATE KEY UPDATE
  `year_label` = VALUES(`year_label`),
  `location` = VALUES(`location`),
  `phase` = VALUES(`phase`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `officers` (`id`,`name`,`email`,`phone`,`designation`,`is_active`,`created_at`,`updated_at`)
VALUES
  (1,'Default Officer','officer@ddrc.com','9561923703','Field Officer',1,'2025-10-22 08:17:05','2025-10-22 08:17:05'),
  (2,'Admin Officer','admin@ddrc.com','9561923704','Admin Officer',1,'2025-10-22 08:17:05','2025-10-22 08:17:05')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `phone` = VALUES(`phone`),
  `designation` = VALUES(`designation`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `aadhaars` (`id`,`aadhaar_number`,`officer_id`,`camp_id`,`created_at`,`updated_at`)
VALUES
  (1,'976456546546',1,1,'2025-10-22 09:08:35','2025-10-22 09:08:35'),
  (2,'545688879878',1,1,'2025-10-22 09:13:33','2025-10-22 09:13:33'),
  (3,'755757557847',1,1,'2025-10-22 09:14:55','2025-10-22 09:14:55'),
  (4,'544657657657',1,1,'2025-10-22 09:16:16','2025-10-22 09:16:16'),
  (5,'653121848764',1,1,'2025-10-28 00:49:22','2025-10-28 00:49:22'),
  (6,'461351810494',1,1,'2025-10-28 00:53:51','2025-10-28 00:53:51'),
  (7,'854757547547',1,1,'2025-10-28 01:20:29','2025-10-28 01:20:29'),
  (8,'756766477467',1,1,'2025-10-28 01:42:55','2025-10-28 01:42:55'),
  (9,'654465464654',1,1,'2025-10-28 01:43:42','2025-10-28 01:43:42'),
  (10,'374567567357',1,1,'2025-10-28 02:05:16','2025-10-28 02:05:16')
ON DUPLICATE KEY UPDATE
  `officer_id` = VALUES(`officer_id`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `survey_aadhar` (`id`,`aadhar_no`,`user_id`,`front_image`,`back_image`,`created_at`,`updated_at`,`holder_name`,`address_text`,`pincode`,`taluka`,`district`,`gender`,`dob`)
VALUES
  (1,'3711-9809-2009',1,NULL,NULL,'2025-11-06 13:44:56','2025-11-07 06:35:34',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
  (9,'9563-1431-5244',1,NULL,NULL,'2025-11-07 06:40:22','2025-11-07 06:40:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL)
ON DUPLICATE KEY UPDATE
  `updated_at` = VALUES(`updated_at`);

SET FOREIGN_KEY_CHECKS=1;

