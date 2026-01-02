-- Complete setup for verification_officer role
-- Run this file to set up everything needed for verification officers

-- Step 1: Add verification_officer to user_types table
INSERT INTO user_types (user_type, description, created_at, updated_at)
SELECT 'verification_officer', 'Verification Officer - Can view and edit surveys, mark as verified', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM user_types WHERE user_type = 'verification_officer'
);

-- Step 2: Alter users table to add 'verification_officer' to the ENUM
ALTER TABLE users 
MODIFY COLUMN user_type ENUM('field_officer', 'admin', 'supervisor', 'verification_officer') 
NOT NULL DEFAULT 'field_officer';

-- Step 3: Insert Verification Officer User
-- Replace 'Verification Officer' with your name
-- Replace '9876543211' with your phone number

INSERT INTO users (
  name,
  contact_number,
  email,
  user_type_id,
  user_type,
  status,
  is_active,
  created_at,
  updated_at
)
SELECT 
  'Verification Officer',  -- Change this to your name
  '9876543211',            -- Change this to your phone number (10 digits)
  NULL,                    -- Email (optional)
  ut.id,
  'verification_officer',
  'active',
  1,
  NOW(),
  NOW()
FROM user_types ut
WHERE ut.user_type = 'verification_officer'
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  user_type = 'verification_officer',
  user_type_id = (SELECT id FROM user_types WHERE user_type = 'verification_officer' LIMIT 1),
  status = 'active',
  is_active = 1,
  updated_at = NOW();

