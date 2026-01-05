-- ============================================
-- Verification Officer Bypass Account
-- Based on ACTUAL users table structure
-- ============================================
-- Phone: 8888888888 (bypasses OTP verification)
-- Any 6-digit OTP will be accepted
-- ============================================
-- Table structure:
-- id, email, password, name, phone, role, store_id, created_at, updated_at, profile_picture
-- ============================================

-- INSERT query for Verification Officer bypass account
INSERT INTO `users` (
  `id`,
  `email`,
  `password`,
  `name`,
  `phone`,
  `role`,
  `store_id`,
  `created_at`,
  `updated_at`,
  `profile_picture`
) VALUES (
  UUID(),  -- Generates unique ID, or use specific ID like 'verification-officer-001'
  'verification.officer@ddrc.in',
  '',  -- Empty password (or NULL if allowed)
  'Verification Officer',
  '8888888888',
  'verification_officer',  -- Change to your role value if different
  NULL,  -- No store_id for verification officer
  NOW(),
  NOW(),
  NULL
);

-- ============================================
-- Alternative: With specific ID
-- ============================================
-- INSERT INTO `users` (
--   `id`, `email`, `password`, `name`, `phone`, `role`, `store_id`, `created_at`, `updated_at`, `profile_picture`
-- ) VALUES (
--   'verification-officer-001',
--   'verification.officer@ddrc.in',
--   '',
--   'Verification Officer',
--   '8888888888',
--   'verification_officer',
--   NULL,
--   NOW(),
--   NOW(),
--   NULL
-- );

-- ============================================
-- UPDATE query (if account already exists)
-- ============================================
-- UPDATE `users` 
-- SET 
--   `name` = 'Verification Officer',
--   `email` = 'verification.officer@ddrc.in',
--   `role` = 'verification_officer',
--   `updated_at` = NOW()
-- WHERE `phone` = '8888888888';

