-- SQL Query to insert Play Store Reviewer user (9999999999)
-- This user will bypass OTP verification and have a complete profile
-- Run this in your MySQL database

-- Step 1: Get field officer user_type_id (if exists)
SET @fo_type_id = (
    SELECT id FROM user_types WHERE LOWER(user_type) IN ('field officer', 'field_officer') LIMIT 1
);

-- Step 2: Delete existing user with contact_number 9999999999 or ID 999999 (to avoid conflicts)
-- First, get any existing user IDs
SET @existing_user_id_1 = (SELECT id FROM users WHERE contact_number = '9999999999' LIMIT 1);
SET @existing_user_id_2 = (SELECT id FROM users WHERE id = 999999 LIMIT 1);

-- Delete profiles first (due to foreign key constraint)
DELETE FROM field_officer_profiles WHERE user_id = IFNULL(@existing_user_id_1, 0) OR user_id = IFNULL(@existing_user_id_2, 0) OR user_id = 999999;
-- Delete users
DELETE FROM users WHERE contact_number = '9999999999' OR id = 999999;

-- Step 3: Insert user into users table with specific ID 999999
-- This matches the user_id set in the Play Store bypass code
INSERT INTO users (
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
) VALUES (
    999999,
    'Play Store Reviewer',
    '9999999999',
    'playstore.reviewer@ddrcnagar.in',
    'field_officer',
    @fo_type_id,
    'active',
    1,
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    name = 'Play Store Reviewer',
    status = 'active',
    is_active = 1,
    updated_at = NOW();

-- Step 4: Set the user ID variable (should be 999999)
SET @reviewer_user_id = 999999;

-- Step 5: Insert/Update field officer profile with complete profile
INSERT INTO field_officer_profiles (
    user_id,
    profile_photo,
    taluka,
    primary_gaav,
    additional_gaavs,
    account_holder_name,
    account_number,
    bank_name,
    ifsc_code,
    upi_id,
    profile_complete,
    created_at,
    updated_at
) VALUES (
    @reviewer_user_id,
    NULL,
    'Test Taluka',
    'Test Village',
    JSON_ARRAY('Village 1', 'Village 2', 'Village 3'),
    'Play Store Reviewer',
    '1234567890',
    'Test Bank',
    'TEST0001234',
    'playstore@upi',
    1,
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    profile_complete = 1,
    updated_at = NOW();

-- Verify the insertion
SELECT 
    u.id,
    u.name,
    u.contact_number,
    u.user_type,
    u.status,
    u.is_active,
    fop.profile_complete
FROM users u
LEFT JOIN field_officer_profiles fop ON fop.user_id = u.id
WHERE u.contact_number = '9999999999';

