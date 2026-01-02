-- Alter users table to add 'verification_officer' to the user_type ENUM
-- This allows us to set user_type = 'verification_officer' directly

ALTER TABLE users 
MODIFY COLUMN user_type ENUM('field_officer', 'admin', 'supervisor', 'verification_officer') 
NOT NULL DEFAULT 'field_officer';

