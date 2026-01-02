-- Add verification_officer role to user_types table
INSERT INTO `user_types` (`user_type`, `description`, `created_at`, `updated_at`)
SELECT 'verification_officer', 'Verification Officer - Can view and edit surveys, mark as verified', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `user_types` WHERE `user_type` = 'verification_officer'
);

