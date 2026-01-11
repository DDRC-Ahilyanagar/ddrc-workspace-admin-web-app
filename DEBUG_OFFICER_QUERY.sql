-- ============================================
-- DEBUG: Why is the auto-assignment query not finding officer 23?
-- ============================================

-- 1. Check user 23's exact values
SELECT 
    id,
    name,
    user_type,
    status,
    is_active,
    CASE 
        WHEN user_type = 'field_officer' THEN 'MATCHES field_officer'
        WHEN user_type = 'field officer' THEN 'MATCHES field officer'
        ELSE CONCAT('NO MATCH: ', user_type)
    END as user_type_check,
    CASE 
        WHEN status = 'active' OR status IS NULL THEN 'MATCHES'
        ELSE CONCAT('NO MATCH: ', status)
    END as status_check,
    CASE 
        WHEN is_active = 1 THEN 'MATCHES'
        ELSE CONCAT('NO MATCH: ', is_active)
    END as is_active_check
FROM users
WHERE id = 23;

-- 2. Check if profile exists for user 23
SELECT 
    id,
    user_id,
    primary_gaav,
    additional_gaavs,
    current_gaav,
    taluka
FROM field_officer_profiles
WHERE user_id = 23;

-- 3. EXACT QUERY THAT AUTO-ASSIGNMENT USES
SELECT 
    u.id,
    u.user_type,
    u.status,
    u.is_active,
    p.primary_gaav,
    p.additional_gaavs,
    p.taluka,
    p.current_gaav
FROM users u
JOIN field_officer_profiles p ON u.id = p.user_id
WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer')
AND (u.status = 'active' OR u.status IS NULL)
AND u.is_active = 1;

-- 4. Check ALL field officers (without filters)
SELECT 
    u.id,
    u.name,
    u.user_type,
    u.status,
    u.is_active,
    p.id as profile_id,
    p.primary_gaav,
    p.additional_gaavs,
    p.current_gaav
FROM users u
LEFT JOIN field_officer_profiles p ON u.id = p.user_id
WHERE u.user_type LIKE '%field%'
ORDER BY u.id;

-- 5. Check if JOIN is the problem (use LEFT JOIN to see all users)
SELECT 
    u.id,
    u.name,
    u.user_type,
    u.status,
    u.is_active,
    p.id as profile_id,
    CASE 
        WHEN p.id IS NULL THEN 'NO PROFILE'
        ELSE 'HAS PROFILE'
    END as profile_status
FROM users u
LEFT JOIN field_officer_profiles p ON u.id = p.user_id
WHERE u.id = 23;
