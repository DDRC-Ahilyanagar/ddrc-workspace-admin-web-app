-- ============================================
-- Verification Officer Bypass Account - SIMPLE VERSION
-- ============================================
-- Phone: 8888888888 (bypasses OTP)
-- ============================================

-- First, check your column name:
SHOW COLUMNS FROM `users` WHERE Field LIKE '%phone%' OR Field LIKE '%contact%';

-- If you see 'contact_number', use this:
INSERT INTO `users` (
  `name`, `email`, `contact_number`, `user_type`, `is_active`, `status`, `created_at`, `updated_at`
) VALUES (
  'Verification Officer', 'verification.officer@ddrc.in', '8888888888', 'verification_officer', 1, 'active', NOW(), NOW()
);

-- If you see 'phone' instead, use this:
-- INSERT INTO `users` (
--   `name`, `email`, `phone`, `user_type`, `is_active`, `status`, `created_at`, `updated_at`
-- ) VALUES (
--   'Verification Officer', 'verification.officer@ddrc.in', '8888888888', 'verification_officer', 1, 'active', NOW(), NOW()
-- );

-- If account already exists, use UPDATE instead:
-- UPDATE `users` 
-- SET `name` = 'Verification Officer', `email` = 'verification.officer@ddrc.in', 
--     `user_type` = 'verification_officer', `is_active` = 1, `status` = 'active', `updated_at` = NOW()
-- WHERE `contact_number` = '8888888888';  -- or WHERE `phone` = '8888888888' if that's your column

