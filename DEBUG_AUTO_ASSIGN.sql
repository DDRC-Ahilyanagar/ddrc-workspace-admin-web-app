-- ============================================
-- DEBUG QUERIES FOR AUTO-ASSIGNMENT
-- ============================================

-- 1. Check field officer profile for user_id = 23
SELECT 
    id,
    user_id,
    taluka,
    primary_gaav,
    additional_gaavs,
    current_gaav,
    created_at,
    updated_at
FROM field_officer_profiles
WHERE user_id = 23;

-- 2. Check users table for officer 23
SELECT 
    id,
    name,
    user_type,
    status,
    is_active,
    contact_number
FROM users
WHERE id = 23;

-- 3. Check ALL field officers and their profiles
SELECT 
    u.id as user_id,
    u.name,
    u.user_type,
    u.status,
    u.is_active,
    p.id as profile_id,
    p.taluka,
    p.primary_gaav,
    p.additional_gaavs,
    p.current_gaav,
    CASE 
        WHEN p.primary_gaav IS NOT NULL THEN 'YES' 
        ELSE 'NO' 
    END as has_primary_gaav,
    CASE 
        WHEN p.additional_gaavs IS NOT NULL THEN 'YES' 
        ELSE 'NO' 
    END as has_additional_gaavs,
    CASE 
        WHEN p.current_gaav IS NOT NULL THEN 'YES' 
        ELSE 'NO' 
    END as has_current_gaav
FROM users u
LEFT JOIN field_officer_profiles p ON u.id = p.user_id
WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer')
AND (u.status = 'active' OR u.status IS NULL)
AND u.is_active = 1;

-- 4. EXACT QUERY THAT AUTO-ASSIGNMENT USES
SELECT 
    u.id,
    p.primary_gaav,
    p.additional_gaavs,
    p.taluka,
    p.current_gaav
FROM users u
JOIN field_officer_profiles p ON u.id = p.user_id
WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer')
AND (u.status = 'active' OR u.status IS NULL)
AND u.is_active = 1;

-- 5. Check if officer 23 has ANY villages configured
SELECT 
    u.id as user_id,
    u.name,
    p.primary_gaav,
    p.additional_gaavs,
    p.current_gaav,
    CASE 
        WHEN p.primary_gaav IS NOT NULL AND p.primary_gaav != '' THEN 1 
        ELSE 0 
    END +
    CASE 
        WHEN p.current_gaav IS NOT NULL AND p.current_gaav != '' THEN 1 
        ELSE 0 
    END +
    CASE 
        WHEN p.additional_gaavs IS NOT NULL AND p.additional_gaavs != '' AND p.additional_gaavs != '[]' THEN 1 
        ELSE 0 
    END as total_villages_configured
FROM users u
LEFT JOIN field_officer_profiles p ON u.id = p.user_id
WHERE u.id = 23;

-- 6. Check recent survey assignments to see which officer got assigned
SELECT 
    sa.id,
    sa.survey_id,
    sa.field_officer_id,
    sa.source,
    sa.status,
    sa.assigned_at,
    s.aadhaar_id,
    s.user_id as survey_user_id,
    s.source as survey_source
FROM survey_assignments sa
JOIN surveys s ON sa.survey_id = s.id
ORDER BY sa.assigned_at DESC
LIMIT 10;

-- 7. Check if there are any unassigned surveys
SELECT 
    s.id,
    s.aadhaar_id,
    s.user_id,
    s.source,
    s.created_at,
    CASE 
        WHEN sa.id IS NULL THEN 'UNASSIGNED' 
        ELSE 'ASSIGNED' 
    END as assignment_status
FROM surveys s
LEFT JOIN survey_assignments sa ON sa.survey_id = s.id
WHERE (s.source = 'Divyang Self' OR s.source = 'Excel Import' OR s.source IS NULL)
AND (s.user_id = 1 OR s.user_id IS NULL)
AND s.survey_json IS NOT NULL
AND s.survey_json != ''
AND sa.id IS NULL
ORDER BY s.created_at DESC
LIMIT 10;
