INSERT INTO users (
  name,
  contact_number,
  user_type,
  status,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'Admin User',
  '9876543210',
  'admin',
  'active',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  user_type = 'admin',
  status = 'active',
  is_active = 1,
  updated_at = NOW();

