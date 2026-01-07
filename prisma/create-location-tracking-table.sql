-- Create location_tracking table for field officer location tracking
-- This table stores location updates from the mobile app

CREATE TABLE IF NOT EXISTS location_tracking (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2) NULL,
  altitude DECIMAL(10, 2) NULL,
  speed DECIMAL(10, 2) NULL,
  heading DECIMAL(5, 2) NULL,
  timestamp DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_user_timestamp (user_id, timestamp),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

