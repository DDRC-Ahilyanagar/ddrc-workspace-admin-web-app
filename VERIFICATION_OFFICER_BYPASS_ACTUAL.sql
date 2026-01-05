-- ============================================
-- Verification Officer Bypass Account
-- Based on ACTUAL users table structure
-- ============================================
-- Phone: 8888888888 (bypasses OTP verification)
-- Any 6-digit OTP will be accepted
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
  UUID(),  -- or use a specific ID like 'verification-officer-001'
  'verification.officer@ddrc.in',
  '',  -- or NULL if password is optional
  'Verification Officer',
  '8888888888',
  'verification_officer',  -- or 'admin' or whatever role you use
  NULL,  -- or a specific store_id if needed
  NOW(),
  NOW(),
  NULL
);

-- ============================================
-- Alternative: If you want to use a specific ID
-- ============================================
-- INSERT INTO `users` (
--   `id`,
--   `email`,
--   `password`,
--   `name`,
--   `phone`,
--   `role`,
--   `store_id`,
--   `created_at`,
--   `updated_at`,
--   `profile_picture`
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

-- ============================================
-- Minimal INSERT (only required fields)
-- ============================================
-- INSERT INTO `users` (
--   `id`, `email`, `password`, `name`, `phone`, `role`, `created_at`, `updated_at`
-- ) VALUES (
--   UUID(), 'verification.officer@ddrc.in', '', 'Verification Officer', '8888888888', 'verification_officer', NOW(), NOW()
-- );

