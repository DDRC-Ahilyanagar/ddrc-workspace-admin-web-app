-- Add user_type column to access_requests table
ALTER TABLE `access_requests` 
ADD COLUMN `user_type` VARCHAR(50) NOT NULL DEFAULT 'FIELD_OFFICER' AFTER `selfie_url`;
