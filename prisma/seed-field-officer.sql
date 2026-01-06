-- Single INSERT query to seed test field officer user
-- Phone: 7777777777
-- Name: Test Field Officer
-- User Type: field_officer
-- Status: active

INSERT INTO users (
  name,
  contact_number,
  user_type,
  status,
  is_active,
  created_at,
  updated_at
) VALUES (
  'Test Field Officer',
  '7777777777',
  'field_officer',
  'active',
  1,
  NOW(),
  NOW()
);
