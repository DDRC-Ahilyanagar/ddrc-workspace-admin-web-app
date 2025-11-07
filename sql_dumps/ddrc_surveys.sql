-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: ddrc_surveys
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `aadhaars`
--

DROP TABLE IF EXISTS `aadhaars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `aadhaars` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `aadhaar_number` char(12) NOT NULL,
  `officer_id` bigint(20) unsigned NOT NULL DEFAULT 1,
  `camp_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aadhaars_camp_id_aadhaar_number_unique` (`camp_id`,`aadhaar_number`),
  KEY `aadhaars_aadhaar_number_index` (`aadhaar_number`),
  CONSTRAINT `aadhaars_camp_id_foreign` FOREIGN KEY (`camp_id`) REFERENCES `camps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `aadhaars`
--

LOCK TABLES `aadhaars` WRITE;
/*!40000 ALTER TABLE `aadhaars` DISABLE KEYS */;
INSERT INTO `aadhaars` VALUES (1,'976456546546',1,1,'2025-10-22 09:08:35','2025-10-22 09:08:35'),(2,'545688879878',1,1,'2025-10-22 09:13:33','2025-10-22 09:13:33'),(3,'755757557847',1,1,'2025-10-22 09:14:55','2025-10-22 09:14:55'),(4,'544657657657',1,1,'2025-10-22 09:16:16','2025-10-22 09:16:16'),(5,'653121848764',1,1,'2025-10-28 00:49:22','2025-10-28 00:49:22'),(6,'461351810494',1,1,'2025-10-28 00:53:51','2025-10-28 00:53:51'),(7,'854757547547',1,1,'2025-10-28 01:20:29','2025-10-28 01:20:29'),(8,'756766477467',1,1,'2025-10-28 01:42:55','2025-10-28 01:42:55'),(9,'654465464654',1,1,'2025-10-28 01:43:42','2025-10-28 01:43:42'),(10,'374567567357',1,1,'2025-10-28 02:05:16','2025-10-28 02:05:16');
/*!40000 ALTER TABLE `aadhaars` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `access_requests`
--

DROP TABLE IF EXISTS `access_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `access_requests` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `selfie_url` varchar(255) NOT NULL,
  `status` enum('pending','approved','declined') NOT NULL DEFAULT 'pending',
  `admin_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_access_requests_phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `access_requests`
--

LOCK TABLES `access_requests` WRITE;
/*!40000 ALTER TABLE `access_requests` DISABLE KEYS */;
INSERT INTO `access_requests` VALUES (1,'karisha','7768817710','/uploads/access_requests/1762513333702-1c5b6736-5afd-49a7-9ee2-80c090ba896d.jpg','pending',NULL,'2025-11-07 11:02:13','2025-11-07 11:02:13');
/*!40000 ALTER TABLE `access_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `answers`
--

DROP TABLE IF EXISTS `answers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `answers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `camp_id` bigint(20) unsigned DEFAULT NULL,
  `aadhaar_id` bigint(20) unsigned NOT NULL,
  `officer_id` bigint(20) unsigned NOT NULL,
  `question_id` bigint(20) unsigned NOT NULL,
  `answer_text` text DEFAULT NULL,
  `answer_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`answer_json`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `aadhar_no` varchar(20) DEFAULT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `section_id` bigint(20) unsigned DEFAULT NULL,
  `answer` text DEFAULT NULL,
  `aadhar_id` bigint(20) unsigned DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `answers`
--

LOCK TABLES `answers` WRITE;
/*!40000 ALTER TABLE `answers` DISABLE KEYS */;
/*!40000 ALTER TABLE `answers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(191) NOT NULL,
  `setting_value` varchar(191) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES (1,'rate_per_survey_field_officer','10','2025-11-06 13:26:43','2025-11-06 13:25:33');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `camps`
--

DROP TABLE IF EXISTS `camps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `camps` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `year_label` varchar(255) NOT NULL,
  `location` varchar(255) NOT NULL,
  `start_date` date NOT NULL,
  `days_count` tinyint(4) NOT NULL,
  `end_date` date NOT NULL,
  `phase` enum('data_collection','examination','distribution') NOT NULL DEFAULT 'data_collection',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `camps_start_date_end_date_index` (`start_date`,`end_date`),
  KEY `camps_is_active_index` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `camps`
--

LOCK TABLES `camps` WRITE;
/*!40000 ALTER TABLE `camps` DISABLE KEYS */;
INSERT INTO `camps` VALUES (1,'SIPDA','2024-25','Ahilyanagar','2025-10-21',3,'2025-10-29','data_collection',1,'2025-10-22 08:17:05','2025-10-22 08:41:09'),(2,'SIPDA','2025-26','Ahilyanagar','2025-10-21',3,'2025-10-29','data_collection',1,'2025-10-22 08:17:05','2025-10-22 08:41:09'),(3,'ADIP','2024-25','Ahilyanagar','2025-10-21',3,'2025-10-29','data_collection',1,'2025-10-22 08:17:05','2025-10-22 08:41:09'),(4,'ADIP','2025-26','Ahilyanagar','2025-10-21',3,'2025-10-29','data_collection',1,'2025-10-22 08:17:05','2025-10-22 08:41:09');
/*!40000 ALTER TABLE `camps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `disability_types`
--

DROP TABLE IF EXISTS `disability_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `disability_types` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `label_marathi` varchar(255) NOT NULL,
  `label_english` varchar(255) NOT NULL,
  `aliases` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`aliases`)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_labels` (`label_marathi`,`label_english`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `disability_types`
--

LOCK TABLES `disability_types` WRITE;
/*!40000 ALTER TABLE `disability_types` DISABLE KEYS */;
INSERT INTO `disability_types` VALUES (1,'अंध','Blindness','[\"Blindness\",\"Blind\",\"अंध\"]'),(2,'दृष्टिदोष','Low Vision','[\"Low Vision\",\"Low-vision\",\"दृष्टिदोष\"]'),(3,'कर्णबधिर','Hearing Impairment','[\"Hearing Impairment\",\"deaf and hard of hearing\",\"कर्णबधिर\"]'),(4,'वाचादोष','Speech and Language Disability','[\"Speech and Language Disability\",\"Speech & Language\",\"वाचादोष\"]'),(5,'अस्थिव्यंग','Locomotor Disability','[\"Locomotor Disability\",\"अस्थिव्यंग\"]'),(6,'मानसिक आजार','Mental Illness','[\"Mental Illness\",\"मानसिक आजार\"]'),(7,'अध्ययन अक्षमता','Specific Learning Disabilities','[\"Specific Learning Disabilities\",\"Learning Disability\",\"अध्ययन अक्षमता\"]'),(8,'सेरेब्रल पालसी - मेंदूचा पक्षाघात','Cerebral Palsy','[\"Cerebral Palsy\",\"सेरेब्रल पालसी\"]'),(9,'स्वमग्न','Autism Spectrum Disorder','[\"Autism Spectrum Disorder\",\"Autism\",\"स्वमग्न\"]'),(10,'बहुविकलांग','Multiple Disabilities including Deafblindness','[\"Multiple Disabilities including deafblindness\",\"Multiple Disabilities\",\"बहुविकलांग\"]'),(11,'कुष्ठरोग','Leprosy Cured Persons','[\"Leprosy Cured persons\",\"Leprosy\",\"कुष्ठरोग\"]'),(12,'बुटकेपणा','Dwarfism','[\"Dwarfism\",\"बुटकेपणा\"]'),(13,'मतिमंद','Intellectual Disability','[\"Intellectual Disability\",\"ID\",\"मतिमंद\"]'),(14,'अविकसित मांसपेशी','Muscular Dystrophy','[\"Muscular Dystrophy\",\"अविकसित मांसपेशी\"]'),(15,'मज्जासंस्थेचे तीव्र आजार','Chronic Neurological Conditions','[\"Chronic Neurological conditions\",\"Neurological\",\"मज्जासंस्थेचे तीव्र आजार\"]'),(16,'मेंदूतील चेतासंस्था संबंधी आजार','Multiple Sclerosis','[\"Multiple Sclerosis\",\"MS\",\"मेंदूतील चेतासंस्था संबंधी आजार\"]'),(17,'रक्ता संबंधी कॅन्सर','Thalassemia','[\"Thalassemia\",\"थॅलेसेमिया\",\"रक्ता संबंधी कॅन्सर\"]'),(18,'रक्तवाहिन्या संबंधित आजार','Hemophilia','[\"Hemophilia\",\"रक्तवाहिन्या संबंधित आजार\"]'),(19,'रक्ता संबंधी रक्ताचे प्रमाण कमी','Sickle Cell Disease','[\"Sickle Cell disease\",\"Sickle Cell\",\"रक्ता संबंधी रक्ताचे प्रमाण कमी\"]'),(20,'एसिड हल्लाग्रस्त पीडित','Acid Attack Victim','[\"Acid Attack victim\",\"Acid Attack\",\"एसिड हल्लाग्रस्त पीडित\"]'),(21,'कंपावत रोग','Parkinson\'s Disease','[\"Parkinson\'s disease\",\"Parkinsons\",\"कंपावत रोग\"]');
/*!40000 ALTER TABLE `disability_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2025_10_22_075220_create_otp_verifications_table',1),(5,'2025_10_22_104639_create_surveys_table',1),(6,'2025_10_22_114020_create_sections_table',1),(7,'2025_10_22_114021_create_questions_table',1),(8,'2025_10_22_120452_create_camps_table',1),(9,'2025_10_22_120455_create_aadhaars_table',1),(10,'2025_10_22_120500_create_officers_table',1),(11,'2025_10_22_120501_create_answers_table',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `officers`
--

DROP TABLE IF EXISTS `officers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `officers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `officers`
--

LOCK TABLES `officers` WRITE;
/*!40000 ALTER TABLE `officers` DISABLE KEYS */;
INSERT INTO `officers` VALUES (1,'Default Officer','officer@ddrc.com','9561923703','Field Officer',1,'2025-10-22 08:17:05','2025-10-22 08:17:05'),(2,'Admin Officer','admin@ddrc.com','9561923704','Admin Officer',1,'2025-10-22 08:17:05','2025-10-22 08:17:05');
/*!40000 ALTER TABLE `officers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `otp_verifications`
--

DROP TABLE IF EXISTS `otp_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_verifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `phone` varchar(15) NOT NULL,
  `otp` varchar(6) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('sent','verified','expired') NOT NULL DEFAULT 'sent',
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `otp_verifications_phone_status_index` (`phone`,`status`),
  KEY `otp_verifications_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `otp_verifications`
--

LOCK TABLES `otp_verifications` WRITE;
/*!40000 ALTER TABLE `otp_verifications` DISABLE KEYS */;
INSERT INTO `otp_verifications` VALUES (1,'9561923703','503169','2025-10-28 06:18:50','verified',NULL,'2025-10-28 00:48:37','2025-10-28 00:48:50'),(2,'7768068585','612767','2025-11-04 02:58:54','sent',NULL,'2025-11-04 02:53:54','2025-11-04 02:53:54'),(3,'7768068585','177644','2025-11-04 02:59:37','sent',NULL,'2025-11-04 02:54:37','2025-11-04 02:54:37'),(4,'7768068585','234534','2025-11-04 03:00:40','sent',NULL,'2025-11-04 02:55:40','2025-11-04 02:55:40'),(5,'9561923703','354921','2025-11-04 03:01:10','sent',NULL,'2025-11-04 02:56:10','2025-11-04 02:56:10'),(6,'9561923703','299511','2025-11-04 03:03:13','sent',NULL,'2025-11-04 02:58:13','2025-11-04 02:58:13'),(7,'7768068585','991305','2025-11-04 03:11:07','sent',NULL,'2025-11-04 03:06:07','2025-11-04 03:06:07'),(8,'7768068585','333449','2025-11-04 03:13:36','sent',NULL,'2025-11-04 03:08:36','2025-11-04 03:08:36'),(9,'7768068585','120585','2025-11-04 03:16:13','sent',NULL,'2025-11-04 03:11:13','2025-11-04 03:11:13'),(10,'7768068585','430707','2025-11-04 03:20:26','sent',NULL,'2025-11-04 03:15:26','2025-11-04 03:15:26'),(11,'7768068585','137405','2025-11-04 03:23:10','sent',NULL,'2025-11-04 03:18:10','2025-11-04 03:18:10'),(12,'7768068585','109034','2025-11-04 03:21:06','verified','2025-11-04 03:21:06','2025-11-04 03:20:47','2025-11-04 03:21:06'),(13,'7768068585','827540','2025-11-04 03:41:20','verified','2025-11-04 03:41:20','2025-11-04 03:38:39','2025-11-04 03:41:20'),(14,'7768068585','316144','2025-11-04 04:18:24','verified','2025-11-04 04:18:24','2025-11-04 04:18:13','2025-11-04 04:18:24'),(15,'7768068585','766925','2025-11-05 04:30:08','verified','2025-11-05 04:30:08','2025-11-05 04:29:55','2025-11-05 04:30:08'),(16,'7768068585','704334','2025-11-07 10:29:22','expired',NULL,'2025-11-06 12:34:43','2025-11-07 10:29:22'),(17,'7768068585','691033','2025-11-07 10:29:19','expired',NULL,'2025-11-06 12:40:09','2025-11-07 10:29:19'),(18,'9561923703','397377','2025-11-06 12:59:41','sent',NULL,'2025-11-06 12:54:41','2025-11-06 12:54:41'),(19,'9561923703','208496','2025-11-06 12:55:35','verified','2025-11-06 12:55:35','2025-11-06 12:55:26','2025-11-06 12:55:35'),(20,'9561923703','151316','2025-11-06 13:14:19','sent',NULL,'2025-11-06 13:09:19','2025-11-06 13:09:19'),(21,'9561923703','627950','2025-11-06 13:14:58','verified','2025-11-06 13:14:58','2025-11-06 13:14:49','2025-11-06 13:14:58'),(22,'9561923703','165351','2025-11-06 13:43:45','verified','2025-11-06 13:43:45','2025-11-06 13:43:37','2025-11-06 13:43:45'),(23,'9561923703','552218','2025-11-06 14:16:29','verified','2025-11-06 14:16:29','2025-11-06 14:16:22','2025-11-06 14:16:29'),(24,'9561923703','884222','2025-11-06 14:33:45','verified','2025-11-06 14:33:45','2025-11-06 14:33:39','2025-11-06 14:33:45'),(25,'9561923703','347156','2025-11-06 15:04:48','verified','2025-11-06 15:04:48','2025-11-06 15:04:41','2025-11-06 15:04:48'),(26,'9561923703','927045','2025-11-06 15:30:19','verified','2025-11-06 15:30:19','2025-11-06 15:30:09','2025-11-06 15:30:19'),(27,'9561923703','990956','2025-11-06 15:47:50','verified','2025-11-06 15:47:50','2025-11-06 15:47:41','2025-11-06 15:47:50'),(28,'9561923703','618055','2025-11-06 16:21:31','verified','2025-11-06 16:21:31','2025-11-06 16:21:23','2025-11-06 16:21:31'),(29,'9561923703','151846','2025-11-06 16:24:37','verified','2025-11-06 16:24:37','2025-11-06 16:24:29','2025-11-06 16:24:37'),(30,'9561923703','588519','2025-11-06 16:30:04','verified','2025-11-06 16:30:04','2025-11-06 16:29:54','2025-11-06 16:30:04'),(31,'9561923703','358390','2025-11-06 16:37:11','verified','2025-11-06 16:37:11','2025-11-06 16:37:03','2025-11-06 16:37:11'),(32,'9561923703','393843','2025-11-07 06:34:53','verified','2025-11-07 06:34:53','2025-11-07 06:34:45','2025-11-07 06:34:53'),(33,'7768068585','565918','2025-11-07 10:26:22','verified','2025-11-07 10:26:22','2025-11-07 10:26:06','2025-11-07 10:26:22'),(34,'7768068585','488172','2025-11-07 10:29:34','verified','2025-11-07 10:29:34','2025-11-07 10:29:24','2025-11-07 10:29:34'),(35,'7768068585','380033','2025-11-07 11:03:24','verified','2025-11-07 11:03:24','2025-11-07 11:03:14','2025-11-07 11:03:24');
/*!40000 ALTER TABLE `otp_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questions`
--

DROP TABLE IF EXISTS `questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questions` (
  `id` bigint(20) unsigned NOT NULL,
  `section_id` bigint(20) unsigned NOT NULL,
  `question` text NOT NULL,
  `question_type` varchar(50) NOT NULL,
  `multi_select` tinyint(1) NOT NULL DEFAULT 0,
  `options` text DEFAULT NULL,
  `rendering_condition` varchar(10) DEFAULT NULL,
  `rendering_question` varchar(255) DEFAULT NULL,
  `rendering_value` varchar(255) DEFAULT NULL,
  `regex` varchar(255) DEFAULT NULL,
  `valid_input` varchar(20) DEFAULT NULL,
  `max_length` int(11) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Active',
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_on` timestamp NULL DEFAULT NULL,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `updated_on` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_section_id` (`section_id`),
  CONSTRAINT `fk_questions_section` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (1,1,'दिव्यांगांचे नाव','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:11:04',NULL,NULL),(2,1,'जन्म तारीख','date',0,NULL,'No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:11:24',NULL,NULL),(4,1,'वय','short_answer',0,NULL,'No',NULL,NULL,'','numeric',3,'Active',1,'2023-09-27 10:20:00',NULL,NULL),(5,1,'लिंग','MCQ',0,'पुरुष,स्त्री,इतर','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:12:03',NULL,NULL),(6,1,'वैवाहिक स्थिती','MCQ',0,'विवाहित,अविवाहित,विधवा,विधुर,घटस्फोटीत','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:14:40',NULL,NULL),(7,1,'मोबाईल नं','short_answer',0,NULL,'No',NULL,NULL,'^\\d{10}$','numeric',10,'Active',1,'2023-09-27 10:14:59',NULL,NULL),(8,1,'ईमेल आयडी','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:17:18',NULL,NULL),(9,1,'वडील/आई चे नाव','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:17:37',NULL,NULL),(10,1,'वडील किंवा काळजीवाहकाचा मोबाईल नं','short_answer',0,NULL,'No',NULL,NULL,'^\\d{10}$','numeric',10,'Active',1,'2023-09-27 10:17:55',NULL,NULL),(11,1,'कुटूंब प्रमुखाचे नाव','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:18:09',NULL,NULL),(12,1,'घरातील एकूण सदस्य','short_answer',0,NULL,'No',NULL,NULL,'','text',10,'Active',1,'2023-09-27 10:18:21',NULL,NULL),(13,1,'प्रवर्ग','MCQ',0,'अनुसूचित जाती,अनु.जमाती,ओबीसी,इतर मागासवर्ग,भटके विमुक्त,खुला प्रवर्ग','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:19:26',NULL,NULL),(14,1,'रक्त गट','MCQ',0,'A+, A-,  B+, B-,  O+, O-,  AB+, AB-','No',NULL,NULL,'','',10,'Active',NULL,NULL,NULL,NULL),(15,2,'शिक्षण','MCQ',0,'शिक्षित,अशिक्षित,शिक्षण घेत आहे','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:31:12',NULL,NULL),(16,2,'शिक्षित असल्यास / शिक्षण घेत असल्यास','MCQ',0,'प्राथमिक,माध्यमिक,उच्च माध्यमिक,पदवी,पदवीधर,डिप्लोमा,डॉक्टरेट','Yes','शिक्षण','शिक्षित,शिक्षण घेत आहे','','',10,'Active',1,'2023-09-27 10:33:03',NULL,NULL),(17,2,'शिक्षण घेत असलेल्या शाळेचा प्रकार?','MCQ',0,'सामान्य शाळा,विशेष शाळा,समावेशक शाळा,इतर','Yes','शिक्षण','शिक्षण घेत आहे','','',10,'Active',1,'2023-09-27 10:33:03',NULL,NULL),(18,2,'शिक्षण शाखा','MCQ',0,'कला,वाणिज्य,विज्ञान,','Yes','शिक्षित असल्यास / शिक्षण घेत असल्यास','शिक्षित,शिक्षण घेत आहे','','',10,'Active',1,'2023-09-27 10:33:18',NULL,NULL),(19,2,'शिक्षण संस्थेचे/कॉलेजचे नाव','short_answer',0,NULL,'Yes','शिक्षण','शिक्षण घेत आहे','','text',50,'Active',1,'2023-09-27 10:33:31',NULL,NULL),(20,2,'आपण खेळात नैपुण्य मिळविले आहे का?','MCQ',0,'होय,नाही','Yes','शिक्षण','शिक्षित,शिक्षण घेत आहे,अशिक्षित','','',10,'Active',1,'2023-09-27 10:33:50',NULL,NULL),(21,2,'शिष्यवृत्ती योजनेचा लाभ घेतला किंवा घेत आहे का?','MCQ',0,'होय,नाही','Yes','शिक्षण','शिक्षण घेत आहे','','',10,'Active',1,'2023-09-29 06:05:20',NULL,NULL),(22,2,'असल्यास शिष्यवृत्ती योजनेचे नाव','short_answer',0,NULL,'Yes','शिष्यवृत्ती योजनेचा लाभ घेतला किंवा घेत आहे का?','होय','','text',50,'Active',1,'2023-09-29 06:06:35',NULL,NULL),(23,2,'खेळ प्रकार','MCQ',0,'मैदानी खेळ,सांघिक खेळ,वैयक्तिक खेळ','Yes','आपण खेळात नैपुण्य मिळविले आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(24,2,'खेळ','MCQ',0,NULL,'Yes','आपण खेळात नैपुण्य मिळविले आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(25,2,'आपण सांस्कृतिक स्पर्धेत भाग घेतला आहे का?','MCQ',0,'होय,नाही','Yes','शिक्षण','शिक्षित,अशिक्षित,शिक्षण घेत आहे','','',10,'Active',NULL,NULL,NULL,NULL),(26,2,'होय असल्यास सांस्कृतिक गुणाचे नाव','MCQ',0,'संगीत,गायन,वाद्य,नाटक,नृत्य','Yes','आपण सांस्कृतिक स्पर्धेत भाग घेतला आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(27,2,'आपणांस संगणकाचे ज्ञान आहे का?','MCQ',0,'होय,नाही','Yes','शिक्षण','शिक्षण घेत आहे,शिक्षित','','',10,'Active',NULL,NULL,NULL,NULL),(28,2,'असल्यास आपण कोणती परीक्षा दिली आहे का?','MCQ',0,'होय,नाही','Yes','आपणांस संगणकाचे ज्ञान आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(29,2,'परीक्षेचे नाव','short_answer',0,'','Yes','असल्यास आपण कोणती परीक्षा दिली आहे का?','होय','','text',50,'Active',NULL,NULL,NULL,NULL),(30,2,'पदवीचे नाव','short_answer',0,'पदवी,पदवीधर,डिप्लोमा,डॉक्टरेट','Yes','शिक्षण','शिक्षित','','text',50,'Active',NULL,NULL,NULL,NULL),(31,2,'उत्तीर्ण झाल्याचे वर्ष','short_answer',0,NULL,'Yes','शिक्षण','शिक्षित','','text',4,'Active',NULL,NULL,NULL,NULL),(32,2,'घरापासून शाळेचे अंतर ( किमी )','short_answer',0,NULL,'Yes','शिक्षण','शिक्षण घेत आहे','','text',5,'Active',1,'2023-09-27 10:33:31',NULL,NULL),(33,2,'शाळेत जाण्यासाठी साधन','MCQ',0,'बस,तीनचाकी सायकल,मोटारसायकल,इतरांवर अवलंबून','Yes','शिक्षण','शिक्षण घेत आहे','','',10,'Active',1,'2023-09-27 10:33:31',NULL,NULL),(34,3,'पत्ता','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:36:06',NULL,NULL),(35,3,'खूण / रोड','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:36:19',NULL,NULL),(36,3,'पोस्ट','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:36:31',NULL,NULL),(37,3,'जि.','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:37:01',NULL,NULL),(38,3,'ता.','MCQ',0,'Nagar,Akole,Jamkhed,Karjat,Kopargaon,Newasa,Parner,Pathardi,Rahata,Rahuri,Sangamner,Shevgaon,Shrirampur,Shrigonda','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:36:50',NULL,NULL),(39,3,'तलाठी कार्यालय','MCQ',0,'--Select--','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:43:46',NULL,NULL),(40,3,'गाव','MCQ',0,'--Select--','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:43:27',NULL,NULL),(41,3,'ग्रामपंचायत','short_answer',0,'','No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:20:00',NULL,NULL),(42,3,'पिन कोड','short_answer',0,NULL,'No',NULL,NULL,'^\\d{6}$','numeric',6,'Active',1,'2023-09-27 10:37:16',NULL,NULL),(43,3,'प्राथमिक आरोग्य केंद्र','MCQ',0,'--Select--','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:43:57',NULL,NULL),(44,3,'सध्याचा पत्ता','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:39:29',NULL,NULL),(45,3,'सध्याचा खूण / रोड','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:42:05',NULL,NULL),(46,3,'सध्याचा पोस्ट','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:42:17',NULL,NULL),(47,3,'सध्याचा जि.','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:42:39',NULL,NULL),(48,3,'सध्याचा ता.','MCQ',0,'Nagar,Akole,Jamkhed,Karjat,Kopargaon,Newasa,Parner,Pathardi,Rahata,Rahuri,Sangamner,Shevgaon,Shrirampur,Shrigonda','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:42:29',NULL,NULL),(49,3,'सध्याचा तलाठी कार्यालय','MCQ',0,'--Select--','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:43:46',NULL,NULL),(50,3,'सध्याचा गाव','MCQ',0,'--Select--','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:43:27',NULL,NULL),(51,3,'सध्याचा ग्रामपंचायत','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-27 10:20:00',NULL,NULL),(52,3,'सध्याचा पिन कोड','short_answer',0,NULL,'No',NULL,NULL,'^\\d{6}$','numeric',6,'Active',1,'2023-09-27 10:42:54',NULL,NULL),(53,3,'सध्याचा प्राथमिक आरोग्य केंद्र','MCQ',0,'--Select--','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:43:57',NULL,NULL),(54,4,'आधार कार्ड आहे का ?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:44:49',NULL,NULL),(55,4,'आधार कार्ड नंबर','short_answer',0,NULL,'Yes','आधार कार्ड आहे का ?','होय','/^\\d{4}-\\d{4}-\\d{4}$/','numeric',12,'Active',1,'2023-09-27 10:45:04',NULL,NULL),(56,4,'पॅन कार्ड आहे का ?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:48:59',NULL,NULL),(57,4,'पॅन कार्ड नंबर','short_answer',0,NULL,'Yes','पॅन कार्ड आहे का ?','होय','^[A-Z]{5}[0-9]{4}[A-Z]$','numeric',9,'Active',1,'2023-09-27 10:52:02',NULL,NULL),(58,4,'मतदान कार्ड आहे का ?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 10:58:42',NULL,NULL),(59,4,'मतदान कार्ड नंबर','short_answer',0,NULL,'Yes','मतदान कार्ड आहे का ?','होय','^[A-Z]{3}[0-9]{7}$','numeric',10,'Active',NULL,NULL,NULL,NULL),(60,4,'आधार कार्ड (पुढील बाजू)','upload',0,NULL,'Yes','आधार कार्ड आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(61,4,'लोकसभा मतदारसंघ','MCQ',0,'३८ शिर्डी लोकसभा मतदारसंघ,३७ अहिल्यानगर लोकसभा मतदारसंघ','Yes','मतदान कार्ड आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(62,4,'विधानसभा मतदार संघः','MCQ',0,'','Yes','मतदान कार्ड आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(63,4,'मतदान केंद्रावर तुम्हाला व्हील चेअरची गरज आहे का?','MCQ',0,'होय,नाही','Yes','मतदान कार्ड आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(64,4,'आधार कार्ड (मागील बाजू)','upload',0,NULL,'Yes','आधार कार्ड आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(65,5,'दिव्यांग प्रमाणपत्र (SADM)','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:00:28',NULL,NULL),(66,5,'प्रमाणपत्र नं','short_answer',0,NULL,'Yes','दिव्यांग प्रमाणपत्र (SADM)','होय','','numeric',10,'Active',1,'2023-09-27 11:00:43',NULL,NULL),(67,5,'वैश्विक कार्ड (UDID)','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:02:14',NULL,NULL),(68,5,'UDID प्रमाणपत्र नं','short_answer',0,NULL,'Yes','वैश्विक कार्ड (UDID)','होय','^[A-Z]{2}[0-9]{16}$','numeric',18,'Active',1,'2023-09-27 11:02:32',NULL,NULL),(69,5,'मिळाल्याची तारीख','date',0,NULL,'Yes','वैश्विक कार्ड (UDID)','होय','','',10,'Active',1,'2023-09-27 11:02:48',NULL,NULL),(70,5,'दिव्यांगता प्रकार (Disability Type)','MCQ',0,NULL,'No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:03:22',NULL,NULL),(71,5,'दिव्यांगता टक्केवारी (% of Disability)','short_answer',0,NULL,'No',NULL,NULL,'','text',10,'Active',1,'2023-09-27 11:03:37',NULL,NULL),(72,5,'निदान (Diagnosis)','MCQ',0,NULL,'No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:03:54',NULL,NULL),(73,5,'दिव्यांगता कारण','MCQ',0,'जन्मत:,अपघात,वांशिक,अनुवांशिक','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:04:43',NULL,NULL),(74,5,'दिव्यांगता अवयव','MCQ',0,'हाथ,पाय,डोळे,कान,पाठ,मेंदु','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:06:28',NULL,NULL),(75,5,'दिव्यांगता बरे होण्यासाठी काही उपचार घेतले आहेत का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:07:46',NULL,NULL),(76,5,'आपणास खालील पैकी उपचारांची गरज आहे का?','MCQ',0,'भौतिकोपचार,वाचाउपचार,मानसिक उपचार,श्रवण यंत्र,कृत्रिम अवयव,सुधारात्मक  शस्त्रक्रिया,इतर वैद्यकीय उपचार','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:10:08',NULL,NULL),(77,5,'आपण उपयोग करीत असलेल्या परिवहनाची साधने','MCQ',0,'बस,तीनचाकी सायकल,मोटारसायकल,इतरांवर अवलंबून,इतर दिव्यांग साहित्य,चारचाकी मोटार','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:11:14',NULL,NULL),(78,5,'आपल्या घरात इतर कोणी दिव्यांग आहेत का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:15:36',NULL,NULL),(79,5,'असल्यास नाते','MCQ',0,'पती,पत्नी,मुलगा,मुलगी,वडील,आई','Yes','आपल्या घरात इतर कोणी दिव्यांग आहेत का?','होय','','',10,'Active',1,'2023-09-27 11:15:49',NULL,NULL),(80,5,'दिव्यांगता बरे होण्यासाठी काही उपचार घेतले आहेत का?','MCQ',0,'भौतिकोपचार,वाचाउपचार,मानसिक उपचार,श्रवण यंत्र,कृत्रिम अवयव,सुधारात्मक शस्त्रक्रिया,इतर वैद्यकीय उपचार','Yes','दिव्यांगता बरे होण्यासाठी काही उपचार घेतले आहेत का?','होय','','',10,'Active',1,'2023-09-27 11:07:46',NULL,NULL),(81,6,'रेशन कार्ड आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:07:46',NULL,NULL),(82,6,'रेशन कार्ड असल्यास प्रकार','MCQ',0,'दारिद्र रेषेखाली (पिवळे),अंत्योदय (केसरी),उच्च उत्पन्न (पांढरे)','Yes','रेशन कार्ड आहे का?','होय','','',10,'Active',1,'2023-09-27 11:07:46',NULL,NULL),(83,6,'रेशन कार्ड वरील एकूण व्यक्ती','MCQ',0,'1,2,3,4,5,6','Yes','रेशन कार्ड आहे का?','होय','','',6,'Active',1,'2023-09-27 10:14:59',NULL,NULL),(84,6,'रेशन कार्डची ऑनलाइन नोंदणी केली आहे का?','MCQ',0,'होय,नाही','Yes','रेशन कार्ड आहे का?','होय','','',10,'Active',1,'2023-09-27 11:07:46',NULL,NULL),(85,6,'रेशन कार्ड आधार कार्डशी संलग्न आहे का?','MCQ',0,'होय,नाही','Yes','रेशन कार्ड आहे का?','होय','','',10,'Active',1,'2023-09-27 11:07:46',NULL,NULL),(86,6,'रेशन कार्ड वरती मासिक रेशन भेटते का?','MCQ',0,'होय,नाही','Yes','रेशन कार्ड आहे का?','होय','','',10,'Active',1,'2023-09-27 11:07:46',NULL,NULL),(87,6,'रेशान कार्ड क्रमांक','short_answer',0,NULL,'Yes','रेशन कार्ड आहे का?','होय','','alphanumeric',10,'Active',1,'2024-09-26 18:30:00',NULL,NULL),(88,6,'रेशन कार्ड पुडील बाजू (Upload)','upload',0,NULL,'Yes','रेशन कार्ड आहे का?','होय','','',10,'Active',1,'2024-09-26 18:30:00',NULL,NULL),(89,6,'रेशन कार्ड मागील बाजू (Upload)','upload',0,NULL,'Yes','रेशन कार्ड आहे का?','होय','','',10,'Active',1,'2024-09-26 18:30:00',NULL,NULL),(90,7,'विवाह घरगुती संबंधात झाला का ?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:18:01',NULL,NULL),(91,7,'संबंधात झाला असल्यास संबंध नमूद करावा','short_answer',0,NULL,'Yes','विवाह घरगुती संबंधात झाला का ?','होय','','text',50,'Active',1,'2023-09-27 11:18:14',NULL,NULL),(92,7,'पत्नी किंवा पती दिव्यांग आहे का ?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:18:41',NULL,NULL),(93,7,'पती / पत्नीचे उदरनिर्वाहाचे साधन','short_answer',0,NULL,'Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','text',50,'Active',1,'2023-09-27 11:18:51',NULL,NULL),(94,7,'पत्नी किंवा पती नाव','short_answer',0,NULL,'Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','text',50,'Active',NULL,NULL,NULL,NULL),(95,7,'पत्नी किंवा पती दिव्यांगता प्रकार (Disability Type)','MCQ',0,'Blindness (अंध), Low-vision (दृष्टिदोष), Hearing Impairment (deaf and hard of hearing) (कर्णबधिर), Speech and Language disability (वाचादोष), Locomotor Disability (अस्थिव्यंग), Mental Illness (मानसिक आजार), Specific Learning Disabilities (अध्ययन अक्षमता), Cerebral Palsy (सेरेब्रल पालसी - मेंदूचा पक्षाघात), Autism Spectrum Disorder (स्वमग्न), Multiple Disabilities including deafblindness (बहुविकलांग), Leprosy Cured persons (कुष्ठरोग), Dwarfism (बुटकेपणा), Intellectual Disability (मतिमंद), Muscular Dystrophy (अविकसित मांसपेशी), Chronic Neurological conditions (मज्जासंस्थेचे तीव्र आजार), Multiple Sclerosis (मेंदूतील चेतासंस्था संबंधी आजार), Thalassemia (रक्ता संबंधी कॅन्सर), Hemophilia (रक्तवाहिन्या संबंधित आजार), Sickle Cell disease (रक्ता संबंधी रक्ताचे प्रमाण कमी), Acid Attack victim (एसिड हल्लाग्रस्त पीडित), Parkinson\'s disease (कंपावत रोग)\n','Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(96,7,'पत्नी किंवा पती दिव्यांगता टक्केवारी (% of Disability)','short_answer',0,NULL,'Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','text',10,'Active',NULL,NULL,NULL,NULL),(97,7,'पत्नी किंवा पती दिव्यांग प्रमाणपत्र (SADM)','MCQ',0,'होय,नाही','Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(98,7,'पत्नी किंवा पती वैश्विक कार्ड (UDID) आहे का ?','MCQ',0,'होय,नाही','Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(99,7,'पत्नी किंवा पती प्रमाणपत्र नं UDID','short_answer',0,NULL,'Yes','पत्नी किंवा पती वैश्विक कार्ड (UDID) आहे का ?','होय','','numeric',10,'Active',NULL,NULL,NULL,NULL),(100,7,'पत्नी किंवा पती निदान (Diagnosis)','MCQ',0,NULL,'Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(101,7,'पत्नी किंवा पती दिव्यांगता कारण','MCQ',0,'जन्मत:,अपघात,वांशिक,अनुवांशिक','Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(102,7,'पत्नी किंवा पती दिव्यांगता अवयव','MCQ',0,'हाथ,पाय,डोळे,कान,पाठ,मेंदु','Yes','पत्नी किंवा पती दिव्यांग आहे का ?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(103,8,'शेती आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 05:51:10',NULL,NULL),(104,8,'शेती असल्यास एकूण क्षेत्र','short_answer',0,NULL,'Yes','शेती आहे का?','होय','','numeric',10,'Active',1,'2023-09-29 05:51:27',NULL,NULL),(105,8,'शेतीचा प्रकार','MCQ',0,'बागायती,जिरायती','Yes','शेती आहे का?','होय','','',10,'Active',1,'2023-09-29 05:52:07',NULL,NULL),(106,8,'शेतीची मालकी','MCQ',0,'स्वत:,वडील,भाऊ,पती,इतर','Yes','शेती आहे का?','होय','','',10,'Active',1,'2023-09-29 05:53:08',NULL,NULL),(107,8,'शेती असलेल्या ठिकाणचा पत्ता','short_answer',0,NULL,'Yes','शेती आहे का?','होय','','text',50,'Active',1,'2023-09-29 05:53:22',NULL,NULL),(108,8,'शेतीचा तालुका','MCQ',0,'--Select--','Yes','शेती आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(109,8,'शेतीचे तलाठी कार्यालय','MCQ',0,'','Yes','शेती आहे का?','होय','','',10,'Active',1,'2023-09-29 05:53:36',NULL,NULL),(110,8,'शेतीची ग्रामपंचायत','short_answer',0,'--select--','Yes','शेती आहे का?','होय','','text',50,'Active',NULL,NULL,NULL,NULL),(111,8,'शेतीचे गाव','MCQ',0,'--select--','Yes','शेती आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(112,8,'शेती मध्ये पाण्याची व्यवस्था आहे का?','MCQ',0,'होय,नाही','Yes','शेती आहे का?','होय','','',10,'Active',1,'2023-09-29 05:54:04',NULL,NULL),(113,8,'शेती मध्ये विजेचे कनेक्शन आहे का?','MCQ',0,'होय,नाही','Yes','शेती आहे का?','होय','','',10,'Active',1,'2023-09-29 05:54:37',NULL,NULL),(114,8,'शेती साठी कर्ज आहे का? ','MCQ',0,'होय,नाही','Yes','शेती आहे का?','होय','','',10,'Active',1,'2023-09-29 06:00:08',NULL,NULL),(115,8,'घेतल्यास कोणत्या बँकेचे आहे','short_answer',0,NULL,'Yes','शेती साठी कर्ज आहे का? ','होय','','text',50,'Active',1,'2023-09-29 06:00:24',NULL,NULL),(116,8,'किती कर्ज घेतले आहे?','short_answer',0,NULL,'Yes','शेती साठी कर्ज आहे का? ','होय','','numeric',10,'Active',1,'2023-09-29 06:00:51',NULL,NULL),(117,8,'शेती साठी पीक विमा घेतला आहे का?','MCQ',0,'होय,नाही','Yes','शेती साठी कर्ज आहे का? ','होय','','',10,'Active',1,'2023-09-29 06:01:18',NULL,NULL),(118,8,'घेतल्यास कोणत्या कंपनीचा आहे','short_answer',0,NULL,'Yes','शेती साठी पीक विमा घेतला आहे का?','होय','','text',50,'Active',1,'2023-09-29 06:01:33',NULL,NULL),(119,8,'पंतप्रधान किसान सन्मान निधी योजनेचा लाभ मिळतो का?','MCQ',0,'होय,नाही','Yes','शेती साठी पीक विमा घेतला आहे का?','होय','','',10,'Active',1,'2023-09-29 06:01:57',NULL,NULL),(120,8,'प्रधानमंत्री कुसुम (सौर पंप ) योजनेचा लाभ घेतला आहे का?','MCQ',0,'होय,नाही','Yes','शेती साठी पीक विमा घेतला आहे का?','होय','','',10,'Active',1,'2023-09-29 06:02:40',NULL,NULL),(121,8,'नमो शेतकरी महासन्मान योजना? ','MCQ',0,'होय,नाही','Yes','शेती साठी पीक विमा घेतला आहे का?','होय','','',10,'Active',1,'2023-09-29 06:03:21',NULL,NULL),(122,8,'प्रधानमंत्री कृषी सिचंन योजना (ठिबक) अनुदान?','MCQ',0,'होय,नाही','Yes','शेती साठी पीक विमा घेतला आहे का?','होय','','',10,'Active',1,'2023-09-29 06:04:00',NULL,NULL),(123,8,'पशुपालन करता का? ','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:04:24',NULL,NULL),(124,8,'पशुपालन कर्ज योजनेचा फायदा घेतला आहे का?','MCQ',0,'होय,नाही','Yes','पशुपालन करता का? ','होय','','',10,'Active',1,'2023-09-29 06:04:51',NULL,NULL),(125,8,'होय असल्यास किती कर्ज घेतले आहे?','short_answer',0,'','Yes','पशुपालन कर्ज योजनेचा फायदा घेतला आहे का?','होय','','numeric',10,'Active',NULL,NULL,NULL,NULL),(126,9,'संजय गांधी निराधार योजनेचा लाभ घेतला आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:07:01',NULL,NULL),(127,9,'निरामय योजनेची नोंदणी केली आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:07:27',NULL,NULL),(128,9,'रेल्वे पास काढला आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:07:53',NULL,NULL),(129,9,'बस पास काढला आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:08:18',NULL,NULL),(130,9,'कौशल्य विकास योजनेचा लाभ घेतला आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:08:42',NULL,NULL),(131,9,'बिजभांडवल योजनेचा लाभ घेतला आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:09:13',NULL,NULL),(132,9,'दिव्यांग आर्थिक विकास महामंडळाकडुन कर्ज घेतले आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:09:41',NULL,NULL),(133,9,'घेतले असल्यास किती रु.','short_answer',0,NULL,'Yes','दिव्यांग आर्थिक विकास महामंडळाकडुन कर्ज घेतले आहे का?','होय','','text',10,'Active',1,'2023-09-29 06:09:58',NULL,NULL),(134,9,'आर्थिक विकास महामंडळाचे कर्ज कधी घेतले आहे?','short_answer',0,NULL,'Yes','दिव्यांग आर्थिक विकास महामंडळाकडुन कर्ज घेतले आहे का?','होय','','numeric',10,'Active',1,'2023-09-29 06:10:09',NULL,NULL),(135,9,'महामंडळाचे कर्ज कोणत्या व्यवसायासाठी घेतले आहे?','short_answer',0,NULL,'Yes','दिव्यांग आर्थिक विकास महामंडळाकडुन कर्ज घेतले आहे का?','होय','','numeric',10,'Active',1,'2023-09-29 06:10:21',NULL,NULL),(136,9,'मतिमंद असल्यास पालकांकडे पालकत्व प्रमाणपत्र आहे का?','MCQ',0,'होय,नाही','Yes','दिव्यांगता प्रकार (Disability Type)',' Mental Illness (मानसिक आजार)','','',10,'Active',1,'2023-09-29 06:10:46',NULL,NULL),(137,10,'सहाय्यक साधने वापरता का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:11:14',NULL,NULL),(138,10,'वापरत असल्यास साहित्याचे नाव','MCQ',0,'BTE Digital Type Hearing Aid Cat-I Along with 36 Batteries of TD 0E 11 (टीडी 0ई 11 च्या 36 बॅटरीसह बीटीई डिजिटल प्रकार श्रवणयंत्र कॅट-I),\r\nBTE Digital Type Hearing Aid Cat-I Along with 36 Batteries of TD 0E 21 (टीडी 0ई 21 च्या 36 बॅटरीसह बीटीई डिजिटल प्रकार श्रवणयंत्र कॅट-I),\r\nCerebral Palsy Chair (सीपी चेअर),\r\nCerebral Palsy Chair Dlx (CP चेअर Dlx),\r\nCrutch Axilla Adjustable (Aluminium) Medium (क्रच ऍक्सिला समायोज्य (ॲल्युमिनियम) मध्यम),\r\nCrutch Axilla Adjustable (Aluminium) Large (क्रच ऍक्सिला ऍडजस्टेबल (ॲल्युमिनियम) मोठा),\r\nCrutch Axilla Adjustable (Aluminium) Small (क्रच ऍक्सिला ऍडजस्टेबल (ॲल्युमिनियम) लहान),\r\nCrutch Elbow Adjustable (Aluminium) Size II (क्रच एल्बो समायोज्य (ॲल्युमिनियम) आकार II),\r\nCrutch Elbow Adjustable (Aluminium) Size I (क्रच एल्बो ॲडजस्टेबल (ॲल्युमिनियम) आकार I),\r\nMotorized Tricycle (with box) (मोटराइज्ड ट्रायसायकल (बॉक्ससह)),\r\nRollator Size II (Adult) (रोलेटर आकार II (प्रौढ)),\r\nRollator Size I (Child) (रोलेटर आकार I (मुल)),\r\nSmart Phone with Screen Reader (स्मार्ट फोन स्क्रीन रीडरसह)),\r\nTricycle Conventional Hand Propelled (GATIMAAN) (ट्रायसायकल कन्व्हेन्शनल हँड प्रोपेल्ड (गतिमन)),\r\nTricycle Conventional Hand Propelled (HAMRAHI) (ट्रायसायकल कन्व्हेन्शनल हँड प्रोपेल्ड (हमराही)),\r\nWalking Stick (चालण्याची काठी),\r\nWheel Chair Folding Child Size (MAMTA) (व्हील चेअर फोल्डिंग चाइल्ड साइज (MAMTA)),\r\nWheel Chair Folding Standard Model Adult Size (SAATHI) (व्हील चेअर फोल्डिंग स्टँडर्ड मॉडेल प्रौढ आकार (SAATHI)),\r\nBraille Kit (ब्रेल किट),\r\nBraille Kit with TD0S23 + TD0S03 + TD1N70 (TD0S23 + TD0S03 + TD1N70 सह ब्रेल किट),\r\nDaisy Player (डेझी प्लेअर),\r\nADL kit for Leprosy affected (कुष्ठरोगग्रस्तांसाठी ADL किट),\r\nBraille Cane Folding for Visually Handicapped (Deluxe) (दृष्टीहीन अपंगांसाठी ब्रेल केन फोल्डिंग (डिलक्स)),\r\nMulti-Sensory Inclusive Educational Developmental Kit (MSIED) (मल्टी-सेन्सरी इन्क्लुसिव्ह एज्युकेशनल डेव्हलपमेंटल किट (MSIED)),\r\nSmart  Cane Type I (स्मार्ट केन प्रकार I),\r\nCommode Chair (कमोड खुर्ची)','Yes','सहाय्यक साधने वापरता का?','होय','','',10,'Active',1,'2023-09-29 06:11:27',NULL,NULL),(139,10,'सहाय्यक साधने शिबिरात मिळाले आहेत का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:11:54',NULL,NULL),(140,10,'कोणत्या वर्षी मिळाले','MCQ',0,'2020,2021,2022,2023','Yes','सहाय्यक साधने शिबिरात मिळाले आहेत का?','होय','','',10,'Active',1,'2023-09-29 06:12:07',NULL,NULL),(141,10,'कोणत्या शिबिरात मिळाले','MCQ',0,'एडिप,सीपडा,एस एस ए,आरोग्य विभाग, इतर','Yes','सहाय्यक साधने शिबिरात मिळाले आहेत का?','होय','','',10,'Active',1,'2023-09-29 06:12:18',NULL,NULL),(142,10,'नवीन सहाय्यक साधनांची गरज आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:12:41',NULL,NULL),(143,10,'गरज असल्यास सहाय्यक साधनांचे नाव','MCQ',0,'BTE Digital Type Hearing Aid Cat-I Along with 36 Batteries of TD 0E 11 (टीडी 0ई 11 च्या 36 बॅटरीसह बीटीई डिजिटल प्रकार श्रवणयंत्र कॅट-I),\r\nBTE Digital Type Hearing Aid Cat-I Along with 36 Batteries of TD 0E 21 (टीडी 0ई 21 च्या 36 बॅटरीसह बीटीई डिजिटल प्रकार श्रवणयंत्र कॅट-I),\r\nCerebral Palsy Chair (सीपी चेअर),\r\nCerebral Palsy Chair Dlx (CP चेअर Dlx),\r\nCrutch Axilla Adjustable (Aluminium) Medium (क्रच ऍक्सिला समायोज्य (ॲल्युमिनियम) मध्यम),\r\nCrutch Axilla Adjustable (Aluminium) Large (क्रच ऍक्सिला ऍडजस्टेबल (ॲल्युमिनियम) मोठा),\r\nCrutch Axilla Adjustable (Aluminium) Small (क्रच ऍक्सिला ऍडजस्टेबल (ॲल्युमिनियम) लहान),\r\nCrutch Elbow Adjustable (Aluminium) Size II (क्रच एल्बो समायोज्य (ॲल्युमिनियम) आकार II),\r\nCrutch Elbow Adjustable (Aluminium) Size I (क्रच एल्बो ॲडजस्टेबल (ॲल्युमिनियम) आकार I),\r\nMotorized Tricycle (with box) (मोटराइज्ड ट्रायसायकल (बॉक्ससह)),\r\nRollator Size II (Adult) (रोलेटर आकार II (प्रौढ)),\r\nRollator Size I (Child) (रोलेटर आकार I (मुल)),\r\nSmart Phone with Screen Reader (स्मार्ट फोन स्क्रीन रीडरसह)),\r\nTricycle Conventional Hand Propelled (GATIMAAN) (ट्रायसायकल कन्व्हेन्शनल हँड प्रोपेल्ड (गतिमन)),\r\nTricycle Conventional Hand Propelled (HAMRAHI) (ट्रायसायकल कन्व्हेन्शनल हँड प्रोपेल्ड (हमराही)),\r\nWalking Stick (चालण्याची काठी),\r\nWheel Chair Folding Child Size (MAMTA) (व्हील चेअर फोल्डिंग चाइल्ड साइज (MAMTA)),\r\nWheel Chair Folding Standard Model Adult Size (SAATHI) (व्हील चेअर फोल्डिंग स्टँडर्ड मॉडेल प्रौढ आकार (SAATHI)),\r\nBraille Kit (ब्रेल किट),\r\nBraille Kit with TD0S23 + TD0S03 + TD1N70 (TD0S23 + TD0S03 + TD1N70 सह ब्रेल किट),\r\nDaisy Player (डेझी प्लेअर),\r\nADL kit for Leprosy affected (कुष्ठरोगग्रस्तांसाठी ADL किट),\r\nBraille Cane Folding for Visually Handicapped (Deluxe) (दृष्टीहीन अपंगांसाठी ब्रेल केन फोल्डिंग (डिलक्स)),\r\nMulti-Sensory Inclusive Educational Developmental Kit (MSIED) (मल्टी-सेन्सरी इन्क्लुसिव्ह एज्युकेशनल डेव्हलपमेंटल किट (MSIED)),\r\nSmart  Cane Type I (स्मार्ट केन प्रकार I),\r\nCommode Chair (कमोड खुर्ची)','Yes','नवीन सहाय्यक साधनांची गरज आहे का?','होय','','',10,'Active',1,'2023-09-29 06:12:54',NULL,NULL),(144,11,'घरकुल योजनेचा लाभ घेतला आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:21:24',NULL,NULL),(145,11,'पंतप्रधान आयुष्यमान भारत कार्ड काढले आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:23:21',NULL,NULL),(146,11,'पंतप्रधान आयुष्यमान भारत कार्ड नंबर?','short_answer',0,NULL,'Yes','पंतप्रधान आयुष्यमान भारत कार्ड काढले आहे का?','होय','','numeric',10,'Active',1,'2023-09-29 06:23:21',NULL,NULL),(147,11,'प्रधानमंत्री उज्ज्वला योजनेचा लाभ घेतला आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:23:42',NULL,NULL),(148,11,'घरी स्वत: चे स्वच्छता गृह आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:24:09',NULL,NULL),(149,11,'घरी पिण्याच्या स्वच्छ पाण्याची व्यवस्था आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:24:32',NULL,NULL),(150,11,'घरी विजेचे कनेक्शन आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:24:55',NULL,NULL),(151,11,'होय असल्यास घर पट्टी भरता का?','MCQ',0,'होय,नाही','Yes','घरकुल योजनेचा लाभ घेतला आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(152,11,'पंतप्रधान आयुष्यमान भारत कार्ड नं','short_answer',0,NULL,'Yes','पंतप्रधान आयुष्यमान भारत कार्ड आहे का?','होय','','numeric',10,'Active',NULL,NULL,NULL,NULL),(153,12,'जेवण तयार करणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:26:52',NULL,NULL),(154,12,'हाताने वस्तु हाताळणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:28:06',NULL,NULL),(155,12,'समान जमिनीवर चालणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:28:39',NULL,NULL),(156,12,'घरात व घराच्या आजूबाजूला चालणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:28:57',NULL,NULL),(157,12,'जवळच्या बाजारात पायी चालणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:29:11',NULL,NULL),(158,12,'शैच्यास जाणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:29:27',NULL,NULL),(159,12,'बसून एका जागेवरून दुसऱ्या जागेवरती जाणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:29:43',NULL,NULL),(160,12,'प्रवासासाठी परिवहनची साधने वापरणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:29:59',NULL,NULL),(161,12,'स्वतः चे कपडे स्वतः घालणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:30:14',NULL,NULL),(162,12,'आंघोळ करणे','MCQ',0,'काहीच कठीण नाही,थोडे कठीण  आहे,जास्त कठीण,खुप कठीण,करु शकत नाही,सांगितले नाही,लागु नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 06:30:28',NULL,NULL),(163,13,'आपणास इतर कोणता दुर्रधर आजार आहे का?','MCQ',0,'होय,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-27 11:16:18',NULL,NULL),(164,13,'आजार असल्यास, कोणता?','MCQ',0,'Diabetes Mellitus - मधुमेह, Hypertension - उच्च रक्तदाब, Heart Disease - हृदयरोग, Arthritis - संधिवात, Chronic Obstructive Pulmonary Disease (COPD) - फुफुसांचा आजार, Chronic Kidney Disease (CKD) - किडणीचा आजार, Asthma - दमा, Parkinson\'s Disease - हाथ व पायाचा थरकाप, Osteoporosis - हाडांचा ठिसूळपना, Rheumatoid Arthritis - संधिवात, Chronic Liver Disease - जुनाट यकृत रोग, Psoriasis - त्वचा रोग, HIV/AIDS - एचआयव्ही/एड्स, Chronic Migraines - तीव्र डोकेदुखी, Chronic Pancreatitis - तीव्र स्वादुपिंडाचा दाह, Hypothyroidism - हायपोथायरॉईडीझम, Epilepsy - अपस्मार, Osteoarthritis - संधिवात, Generalized Anxiety Disorder (GAD) - सामान्यीकृत चिंता विकार (GAD), Attention-Deficit/Hyperactivity Disorder (ADHD) - अटेंशन-डेफिसिट/हायपरएक्टिव्हिटी डिसऑर्डर (ADHD), Autism Spectrum Disorder (ASD) - ऑटिझम स्पेक्ट्रम डिसऑर्डर (ASD), Down Syndrome - डाऊन सिंड्रोम, Huntington\'s Disease - हंटिंगटन रोग, Hemophilia - हिमोफिलिया, Leukemia - रक्ताचा कर्करोग, Ovarian Cancer - गर्भाशयाचा कर्करोग, Breast Cancer - स्तनाचा कर्करोग, Hemiplegia - अर्धांगवायू','Yes','आपणास इतर कोणता दुर्रधर आजार आहे का?','होय','','',10,'Active',1,'2023-09-27 11:16:41',NULL,NULL),(165,13,'या आजारासाठी आपण उपचार घेता का?','MCQ',0,'होय,नाही','Yes','आपणास इतर कोणता दुर्रधर आजार आहे का?','होय','','',10,'Active',1,'2023-09-27 11:17:06',NULL,NULL),(166,13,'या आजारासाठी आपल्याला इतर उपचाराची गरज आहे का?','MCQ',0,'होय,नाही','Yes','आपणास इतर कोणता दुर्रधर आजार आहे का?','होय','','',10,'Active',1,'2023-09-27 11:17:30',NULL,NULL),(167,14,'एकूण अपत्यांची संख्या','MCQ',0,'0,1,2,3,4,5','No',NULL,NULL,'','',6,'Active',1,'2023-09-29 05:20:09',NULL,NULL),(168,14,'अपत्यांचे नाव','short_answer',0,'','Yes','एकूण अपत्यांची संख्या','1,2,3,4,5','','text',50,'Active',1,'2023-09-29 05:20:34',NULL,NULL),(169,14,'अपत्यांचे लिंग','MCQ',0,'मुलगा,मुलगी','Yes','एकूण अपत्यांची संख्या','1,2,3,4,5','','',10,'Active',1,'2023-09-29 05:20:48',NULL,NULL),(170,14,'अपत्यांची शैक्षणिक स्थिती:','MCQ',0,'शिक्षित,अशिक्षित,शिक्षण घेत आहे','Yes','एकूण अपत्यांची संख्या','1,2,3,4,5','','',10,'Active',1,'2023-09-29 05:21:06',NULL,NULL),(171,14,'अपत्य दिव्यांग आहे का?','MCQ',0,'होय,नाही','Yes','एकूण अपत्यांची संख्या','1,2,3,4,5','','',10,'Active',1,'2023-09-29 05:21:22',NULL,NULL),(172,14,'अपत्य दिव्यांग प्रमाणपत्र (SADM)','MCQ',0,'होय,नाही','Yes','अपत्य दिव्यांग आहे का?','होय','','',10,'Active',1,'2023-09-29 05:21:41',NULL,NULL),(173,14,'अपत्य वैश्विक कार्ड (UDID) आहे का ?','MCQ',0,'होय,नाही','Yes','अपत्य दिव्यांग आहे का?','होय','','',10,'Active',1,'2023-09-29 05:22:32',NULL,NULL),(174,14,'अपत्य प्रमाणपत्र नं UDID','short_answer',0,NULL,'Yes','अपत्य वैश्विक कार्ड (UDID) आहे का ?','होय','','numeric',10,'Active',1,'2023-09-29 05:22:46',NULL,NULL),(175,15,'नोकरी किंवा व्यवसाय करता का?','MCQ',0,'नोकरी,व्यवसाय,शेतमजूर,नाही','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 05:23:27',NULL,NULL),(176,15,'नोकरी करत असल्यास','MCQ',0,'संस्था,सरकारी,खाजगी,दुकान,शेतमजूर,इतर','Yes','नोकरी किंवा व्यवसाय करता का?','नोकरी','','',10,'Active',1,'2023-09-29 05:24:47',NULL,NULL),(177,15,'नोकरीच्या ठिकाणचा पत्ता','short_answer',0,NULL,'Yes','नोकरी किंवा व्यवसाय करता का?','नोकरी','','text',50,'Active',1,'2023-09-29 05:25:03',NULL,NULL),(178,15,'व्यवसाय असल्यास त्याचे नाव','short_answer',0,NULL,'Yes','नोकरी किंवा व्यवसाय करता का?','व्यवसाय','','text',50,'Active',1,'2023-09-29 05:25:19',NULL,NULL),(179,15,'कुटुंबाचे एकूण वार्षिक उत्पन्न','MCQ',0,'10000 पेक्षा कमी,10000 ते 50000,50000 ते 1000000','No',NULL,NULL,'','',10,'Active',1,'2023-09-29 05:27:00',NULL,NULL),(180,15,'वडिलांचे / पतीचे उत्पन्न','short_answer',0,NULL,'No',NULL,NULL,'','text',50,'Active',1,'2023-09-29 05:50:32',NULL,NULL),(181,1,'प्रोफाइल फोटो','upload',0,NULL,'No',NULL,NULL,'','',10,'Active',NULL,NULL,NULL,NULL),(182,14,'अपत्य दिव्यांगता प्रकार (Disability Type)','MCQ',0,'Blindness (अंध), Low-vision (दृष्टिदोष), Hearing Impairment (deaf and hard of hearing) (कर्णबधिर), Speech and Language disability (वाचादोष), Locomotor Disability (अस्थिव्यंग), Mental Illness (मानसिक आजार), Specific Learning Disabilities (अध्ययन अक्षमता), Cerebral Palsy (सेरेब्रल पालसी - मेंदूचा पक्षाघात), Autism Spectrum Disorder (स्वमग्न), Multiple Disabilities including deafblindness (बहुविकलांग), Leprosy Cured persons (कुष्ठरोग), Dwarfism (बुटकेपणा), Intellectual Disability (मतिमंद), Muscular Dystrophy (अविकसित मांसपेशी), Chronic Neurological conditions (मज्जासंस्थेचे तीव्र आजार), Multiple Sclerosis (मेंदूतील चेतासंस्था संबंधी आजार), Thalassemia (रक्ता संबंधी कॅन्सर), Hemophilia (रक्तवाहिन्या संबंधित आजार), Sickle Cell disease (रक्ता संबंधी रक्ताचे प्रमाण कमी), Acid Attack victim (एसिड हल्लाग्रस्त पीडित), Parkinson\'s disease (कंपावत रोग)\n','Yes','अपत्य दिव्यांग आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(183,14,'अपत्य दिव्यांगता टक्केवारी (% of Disability)','short_answer',0,NULL,'Yes','अपत्य दिव्यांग आहे का?','होय','','text',10,'Active',NULL,NULL,NULL,NULL),(184,14,'अपत्य निदान (Diagnosis)','MCQ',0,NULL,'Yes','अपत्य दिव्यांग आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(185,14,'अपत्य दिव्यांगता कारण','MCQ',0,'जन्मत:,अपघात,वांशिक,अनुवांशिक','Yes','अपत्य दिव्यांग आहे का?','होय','','',10,'Active',NULL,NULL,NULL,NULL),(186,14,'अपत्य दिव्यांगता टक्केवारी (% of Disability)','short_answer',0,NULL,'Yes','अपत्य दिव्यांग आहे का?','होय','','text',10,'Active',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sections`
--

DROP TABLE IF EXISTS `sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sections` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title_marathi` varchar(255) NOT NULL,
  `title_english` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sections_sort_order_index` (`sort_order`),
  KEY `sections_is_active_index` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sections`
--

LOCK TABLES `sections` WRITE;
/*!40000 ALTER TABLE `sections` DISABLE KEYS */;
INSERT INTO `sections` VALUES (1,'',NULL,0,1,NULL,NULL,'वैयक्तिक माहिती'),(2,'',NULL,0,1,NULL,NULL,'शैक्षणिक माहिती'),(3,'',NULL,0,1,NULL,NULL,'पत्ता'),(4,'',NULL,0,1,NULL,NULL,'ओळखपत्र'),(5,'',NULL,0,1,NULL,NULL,'दिव्यांगता तपशील'),(6,'',NULL,0,1,NULL,NULL,'रेशन कार्ड विषयी'),(7,'',NULL,0,1,NULL,NULL,'वैवाहिक माहिती'),(8,'',NULL,0,1,NULL,NULL,'शेती'),(9,'',NULL,0,1,NULL,NULL,'दिव्यांग योजनेचा लाभ'),(10,'',NULL,0,1,NULL,NULL,'सहाय्यक साधने'),(11,'',NULL,0,1,NULL,NULL,'इतर शासकीय योजना'),(12,'',NULL,0,1,NULL,NULL,'दैनंदिन काम'),(13,'',NULL,0,1,NULL,NULL,'दिव्यांगता सोडून इतर आजाराविषयी'),(14,'',NULL,0,1,NULL,NULL,'अपत्याविषयी माहिती'),(15,'',NULL,0,1,NULL,NULL,'नोकरी / व्यवसाय');
/*!40000 ALTER TABLE `sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_aadhar`
--

DROP TABLE IF EXISTS `survey_aadhar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_aadhar` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `aadhar_no` varchar(20) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 1,
  `front_image` text DEFAULT NULL,
  `back_image` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `holder_name` varchar(255) DEFAULT NULL,
  `address_text` text DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `taluka` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `dob` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_aadhar` (`aadhar_no`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_aadhar`
--

LOCK TABLES `survey_aadhar` WRITE;
/*!40000 ALTER TABLE `survey_aadhar` DISABLE KEYS */;
INSERT INTO `survey_aadhar` VALUES (1,'3711-9809-2009',1,NULL,NULL,'2025-11-06 13:44:56','2025-11-07 06:35:34',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(9,'9563-1431-5244',1,NULL,NULL,'2025-11-07 06:40:22','2025-11-07 06:40:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `survey_aadhar` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `surveys`
--

DROP TABLE IF EXISTS `surveys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `surveys` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `village_name` varchar(255) NOT NULL,
  `district` varchar(255) NOT NULL,
  `state` varchar(255) NOT NULL,
  `status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  `questions_answered` int(11) NOT NULL DEFAULT 0,
  `total_questions` int(11) NOT NULL DEFAULT 196,
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `surveys`
--

LOCK TABLES `surveys` WRITE;
/*!40000 ALTER TABLE `surveys` DISABLE KEYS */;
/*!40000 ALTER TABLE `surveys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_types`
--

DROP TABLE IF EXISTS `user_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_types` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_type` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_type` (`user_type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_types`
--

LOCK TABLES `user_types` WRITE;
/*!40000 ALTER TABLE `user_types` DISABLE KEYS */;
INSERT INTO `user_types` VALUES (1,'Field officer','2025-11-06 06:23:26',NULL,'2025-11-06 06:23:26',NULL,'active'),(2,'admin','2025-11-06 06:23:26',NULL,'2025-11-06 06:23:26',NULL,'active'),(3,'practitioner','2025-11-06 06:23:26',NULL,'2025-11-06 06:23:26',NULL,'active');
/*!40000 ALTER TABLE `user_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `passkey` smallint(5) unsigned DEFAULT NULL,
  `user_type` enum('field_officer','admin','supervisor') NOT NULL DEFAULT 'field_officer',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `otp_verified_at` timestamp NULL DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `user_type_id` bigint(20) unsigned DEFAULT NULL,
  `profile_photo` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_phone_unique` (`contact_number`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `unique_email` (`email`),
  UNIQUE KEY `unique_contact` (`contact_number`),
  UNIQUE KEY `unique_passkey` (`passkey`),
  KEY `users_phone_user_type_index` (`contact_number`,`user_type`),
  KEY `users_is_active_index` (`is_active`),
  KEY `fk_user_type` (`user_type_id`),
  CONSTRAINT `fk_user_type` FOREIGN KEY (`user_type_id`) REFERENCES `user_types` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_passkey_4digit` CHECK (`passkey` is null or `passkey` between 1000 and 9999)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Admin User','utkrranti@gmail.com','7768068585',NULL,'admin',1,NULL,NULL,NULL,NULL,NULL,'2025-11-06 12:51:54','2025-11-06 12:51:54',2,NULL,NULL,NULL,'active'),(2,'Pranit','utkrranti.cc@gmail.com','9561923703',5668,'field_officer',1,NULL,NULL,NULL,NULL,NULL,'2025-11-06 12:51:54','2025-11-06 12:51:54',1,NULL,NULL,NULL,'active');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `view_sections_with_questions`
--

DROP TABLE IF EXISTS `view_sections_with_questions`;
/*!50001 DROP VIEW IF EXISTS `view_sections_with_questions`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `view_sections_with_questions` AS SELECT 
 1 AS `question_id`,
 1 AS `section_id`,
 1 AS `section_name`,
 1 AS `section_title_marathi`,
 1 AS `section_title_english`,
 1 AS `section_sort_order`,
 1 AS `section_is_active`,
 1 AS `question_sort_order`,
 1 AS `question_marathi`,
 1 AS `question_english`,
 1 AS `question_type`,
 1 AS `multi_select`,
 1 AS `options`,
 1 AS `rendering_condition`,
 1 AS `rendering_question`,
 1 AS `rendering_value`,
 1 AS `regex`,
 1 AS `valid_input`,
 1 AS `max_length`,
 1 AS `question_is_active`,
 1 AS `is_required`,
 1 AS `question_created_at`,
 1 AS `question_updated_at`,
 1 AS `question_title`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `view_sections_with_questions`
--

/*!50001 DROP VIEW IF EXISTS `view_sections_with_questions`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_sections_with_questions` AS select `q`.`id` AS `question_id`,`q`.`section_id` AS `section_id`,`s`.`name` AS `section_name`,`s`.`name` AS `section_title_marathi`,NULL AS `section_title_english`,`s`.`id` AS `section_sort_order`,1 AS `section_is_active`,`q`.`id` AS `question_sort_order`,`q`.`question` AS `question_marathi`,NULL AS `question_english`,`q`.`question_type` AS `question_type`,`q`.`multi_select` AS `multi_select`,`q`.`options` AS `options`,`q`.`rendering_condition` AS `rendering_condition`,`q`.`rendering_question` AS `rendering_question`,`q`.`rendering_value` AS `rendering_value`,`q`.`regex` AS `regex`,`q`.`valid_input` AS `valid_input`,`q`.`max_length` AS `max_length`,case when `q`.`status` = 'Active' then 1 else 0 end AS `question_is_active`,case when coalesce(`q`.`rendering_condition`,'No') in ('Yes','yes') then 0 else 1 end AS `is_required`,`q`.`created_on` AS `question_created_at`,`q`.`updated_on` AS `question_updated_at`,`s`.`name` AS `question_title` from (`questions` `q` join `sections` `s` on(`s`.`id` = `q`.`section_id`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-07 17:56:43
