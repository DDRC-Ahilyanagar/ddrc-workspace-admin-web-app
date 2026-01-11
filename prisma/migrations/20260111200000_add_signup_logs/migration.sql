-- Create table to log field officer signup steps
CREATE TABLE IF NOT EXISTS field_officer_signup_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  phone VARCHAR(20) NOT NULL,
  step VARCHAR(50) NOT NULL,
  step_number INT NOT NULL,
  status ENUM('started', 'completed', 'failed') DEFAULT 'started',
  data JSON NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_phone (phone),
  KEY idx_step (step),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
