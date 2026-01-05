-- ============================================
-- Verification Officer Bypass Account Setup
-- ============================================
-- Phone Number: 8888888888
-- This phone number bypasses OTP verification
-- Any 6-digit OTP will be accepted
-- ============================================

-- STEP 1: Check which column name exists in your database
-- Run this first to see which column name your table uses:
SHOW COLUMNS FROM `users` LIKE '%phone%';
SHOW COLUMNS FROM `users` LIKE '%contact%';

-- ============================================
-- Option A: If your table uses 'contact_number' column
-- ============================================

-- Option A1: INSERT (if account doesn't exist)
INSERT INTO `users` (
  `name`,
  `email`,
  `contact_number`,
  `passkey`,
  `user_type`,
  `is_active`,
  `email_verified_at`,
  `otp_verified_at`,
  `last_login`,
  `password`,
  `remember_token`,
  `created_at`,
  `updated_at`,
  `user_type_id`,
  `profile_photo`,
  `created_by`,
  `updated_by`,
  `status`
) VALUES (
  'Verification Officer',
  'verification.officer@ddrc.in',
  '8888888888',
  NULL,
  'verification_officer',
  1,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NOW(),
  NOW(),
  NULL,
  NULL,
  NULL,
  NULL,
  'active'
);

-- Option A2: UPDATE (if account already exists)
-- UPDATE `users` 
-- SET 
--   `name` = 'Verification Officer',
--   `email` = 'verification.officer@ddrc.in',
--   `user_type` = 'verification_officer',
--   `is_active` = 1,
--   `status` = 'active',
--   `updated_at` = NOW()
-- WHERE `contact_number` = '8888888888';

-- ============================================
-- Option B: If your table uses 'phone' column (older schema)
-- ============================================

-- Option B1: INSERT with 'phone' column
-- INSERT INTO `users` (
--   `name`,
--   `email`,
--   `phone`,
--   `passkey`,
--   `user_type`,
--   `is_active`,
--   `email_verified_at`,
--   `otp_verified_at`,
--   `last_login`,
--   `password`,
--   `remember_token`,
--   `created_at`,
--   `updated_at`,
--   `user_type_id`,
--   `profile_photo`,
--   `created_by`,
--   `updated_by`,
--   `status`
-- ) VALUES (
--   'Verification Officer',
--   'verification.officer@ddrc.in',
--   '8888888888',
--   NULL,
--   'verification_officer',
--   1,
--   NULL,
--   NULL,
--   NULL,
--   NULL,
--   NULL,
--   NOW(),
--   NOW(),
--   NULL,
--   NULL,
--   NULL,
--   NULL,
--   'active'
-- );

-- Option B2: UPDATE with 'phone' column
-- UPDATE `users` 
-- SET 
--   `name` = 'Verification Officer',
--   `email` = 'verification.officer@ddrc.in',
--   `user_type` = 'verification_officer',
--   `is_active` = 1,
--   `status` = 'active',
--   `updated_at` = NOW()
-- WHERE `phone` = '8888888888';

-- ============================================
-- Option C: Universal INSERT (tries both column names)
-- ============================================

-- First, ensure the column exists (rename if needed)
-- ALTER TABLE `users` CHANGE COLUMN `phone` `contact_number` VARCHAR(20) NULL;

-- Then use Option A1 above

-- ============================================
-- Quick INSERT (minimal columns - safest option)
-- ============================================

-- INSERT INTO `users` (
--   `name`, 
--   `email`, 
--   `contact_number`,  -- Change to `phone` if that's your column name
--   `user_type`, 
--   `is_active`, 
--   `status`, 
--   `created_at`, 
--   `updated_at`
-- ) VALUES (
--   'Verification Officer', 
--   'verification.officer@ddrc.in', 
--   '8888888888', 
--   'verification_officer', 
--   1, 
--   'active', 
--   NOW(), 
--   NOW()
-- );

