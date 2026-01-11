-- ============================================
-- TEST QUERIES FOR CURRENT_GAAV
-- ============================================

-- 1. Check if current_gaav is being inserted/updated
SELECT 
    user_id,
    current_gaav,
    taluka,
    primary_gaav,
    additional_gaavs,
    updated_at
FROM field_officer_profiles
WHERE user_id = 23;

-- 2. Check recent updates to current_gaav (if you have a timestamp column)
SELECT 
    user_id,
    current_gaav,
    taluka,
    updated_at,
    TIMESTAMPDIFF(MINUTE, updated_at, NOW()) as minutes_ago
FROM field_officer_profiles
WHERE user_id = 23
ORDER BY updated_at DESC;

-- 3. Manually test updating current_gaav
-- UPDATE field_officer_profiles 
-- SET current_gaav = 'Bhalawani',
--     taluka = 'Parner',
--     updated_at = NOW()
-- WHERE user_id = 23;

-- 4. Check all field officers and their current_gaav status
SELECT 
    u.id as user_id,
    u.name,
    p.current_gaav,
    p.primary_gaav,
    p.additional_gaavs,
    p.taluka,
    CASE 
        WHEN p.current_gaav IS NOT NULL AND p.current_gaav != '' THEN 'YES' 
        ELSE 'NO' 
    END as has_current_gaav,
    p.updated_at
FROM users u
LEFT JOIN field_officer_profiles p ON u.id = p.user_id
WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer')
AND u.is_active = 1
ORDER BY p.updated_at DESC;
