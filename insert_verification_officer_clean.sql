-- Step 1: Ensure verification_officer role exists in user_types table
INSERT INTO user_types (user_type, description, created_at, updated_at)
SELECT 'verification_officer', 'Verification Officer - Can view and edit surveys, mark as verified', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM user_types WHERE user_type = 'verification_officer'
);

-- Step 2: Insert Verification Officer User
-- After running alter_users_table_add_verification_officer.sql, we can now use 'verification_officer' directly

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
  'Verification Officer',
  '9876543211',
  NULL,
  ut.id,
  'verification_officer',  -- Now we can use this directly after altering the table
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

