-- SQL Query to update user ID 22 to active verification officer
-- This ensures the user has all required fields set correctly

-- Step 1: Get verification_officer user_type_id from user_types table
SET @vo_type_id = (
    SELECT id FROM user_types 
    WHERE LOWER(TRIM(user_type)) IN ('verification officer', 'verification_officer') 
    LIMIT 1
);

-- Step 2: If verification_officer type doesn't exist, create it
-- (This is a fallback - usually it should already exist)
INSERT INTO user_types (user_type, created_at, updated_at)
SELECT 'verification_officer', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM user_types 
    WHERE LOWER(TRIM(user_type)) IN ('verification officer', 'verification_officer')
)
LIMIT 1;

-- Step 3: Get the ID again (in case we just created it)
SET @vo_type_id = (
    SELECT id FROM user_types 
    WHERE LOWER(TRIM(user_type)) IN ('verification officer', 'verification_officer') 
    LIMIT 1
);

-- Step 4: Update user ID 22 with all required fields
UPDATE users
SET 
    user_type = 'verification_officer',
    user_type_id = @vo_type_id,
    status = 'active',
    is_active = 1,
    updated_at = NOW()
WHERE id = 22;

-- Step 5: Verify the update
SELECT 
    id,
    name,
    contact_number,
    email,
    user_type,
    user_type_id,
    status,
    is_active,
    created_at,
    updated_at
FROM users
WHERE id = 22;
