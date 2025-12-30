-- Migration: Add Early Detection Module (लवकर शोध)
-- Parent phone number is unique identifier, can have multiple babies

CREATE TABLE IF NOT EXISTS `early_detection_babies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `parent_phone` varchar(20) NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  
  -- Parents & Personal Information
  `father_name` varchar(255) DEFAULT NULL,
  `mother_name` varchar(255) DEFAULT NULL,
  `baby_name` varchar(255) DEFAULT NULL,
  `baby_birth_date` date DEFAULT NULL,
  `age_months` smallint unsigned DEFAULT NULL,
  
  -- Health & Siblings Information
  `gender` varchar(20) DEFAULT NULL,
  `current_weight` decimal(5,2) DEFAULT NULL,
  `birth_weight` decimal(5,2) DEFAULT NULL,
  `length_height` decimal(5,2) DEFAULT NULL,
  `head_circumference_at_birth` decimal(5,2) DEFAULT NULL,
  `blood_group` varchar(10) DEFAULT NULL,
  `no_of_siblings` smallint unsigned DEFAULT NULL,
  
  -- Address & Contact Information
  `address` text DEFAULT NULL,
  `district` varchar(255) DEFAULT NULL,
  `taluka` varchar(255) DEFAULT NULL,
  `village` varchar(255) DEFAULT NULL,
  `talathi` varchar(255) DEFAULT NULL,
  `grampanchayat` varchar(255) DEFAULT NULL,
  `phc` varchar(255) DEFAULT NULL,
  `status_universal_eye_screening` varchar(255) DEFAULT NULL,
  `status_oae_test` varchar(255) DEFAULT NULL,
  
  -- Delivery & Delivery Complications Information
  `type_of_marriage` varchar(100) DEFAULT NULL,
  `type_of_delivery` varchar(100) DEFAULT NULL,
  `prenatal_complications` text DEFAULT NULL, -- JSON array
  `perinatal_complications` text DEFAULT NULL, -- JSON array
  `postnatal_complications` text DEFAULT NULL, -- JSON array
  
  -- Ongoing and Past Medications Information
  `previous_treatment` text DEFAULT NULL,
  `current_treatment` text DEFAULT NULL,
  `current_medications` text DEFAULT NULL,
  
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  
  PRIMARY KEY (`id`),
  KEY `idx_parent_phone` (`parent_phone`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

