CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `recipient_type` enum('admin','field_officer') NOT NULL,
  `recipient_email` varchar(255) NOT NULL,
  `recipient_user_id` bigint unsigned DEFAULT NULL,
  `email_subject` varchar(500) NOT NULL,
  `email_body` text NOT NULL,
  `status` enum('sent','failed','pending') DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recipient_type` (`recipient_type`),
  KEY `idx_recipient_email` (`recipient_email`),
  KEY `idx_recipient_user_id` (`recipient_user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sent_at` (`sent_at`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_email_logs_user` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

