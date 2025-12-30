-- Drop old survey-related tables
DROP TABLE IF EXISTS `answers`;
DROP TABLE IF EXISTS `survey_aadhar`;
DROP TABLE IF EXISTS `surveys`;

-- Create new simplified survey_aadhar table (only id, user_id, aadhar_no)
CREATE TABLE `survey_aadhar` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `aadhar_no` varchar(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_aadhar_no` (`aadhar_no`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create new surveys table
CREATE TABLE `surveys` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `aadhaar_id` bigint unsigned NOT NULL,
  `no_of_questions_answered` int NOT NULL DEFAULT 0,
  `no_of_questions_unanswered` int NOT NULL DEFAULT 0,
  `survey_json` longtext NULL,
  `json_path` varchar(255) NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_aadhaar_id` (`aadhaar_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_aadhaar_id` (`aadhaar_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create new survey_files table
CREATE TABLE `survey_files` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `aadhaar_id` bigint unsigned NOT NULL,
  `file_type` enum('aadhaar_front','aadhaar_back','udid','certificate','other') NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_aadhaar_id` (`aadhaar_id`),
  KEY `idx_file_type` (`file_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

