-- SQL Query to verify that all survey data has been cleared
-- This checks all survey-related tables and shows record counts

SELECT 
    'surveys' AS table_name,
    COUNT(*) AS record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ CLEARED'
        ELSE '❌ NOT CLEARED'
    END AS status
FROM surveys

UNION ALL

SELECT 
    'survey_files' AS table_name,
    COUNT(*) AS record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ CLEARED'
        ELSE '❌ NOT CLEARED'
    END AS status
FROM survey_files

UNION ALL

SELECT 
    'survey_aadhar' AS table_name,
    COUNT(*) AS record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ CLEARED'
        ELSE '❌ NOT CLEARED'
    END AS status
FROM survey_aadhar

ORDER BY table_name;

-- Summary: Check if all tables are cleared
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM surveys) = 0 
         AND (SELECT COUNT(*) FROM survey_files) = 0 
         AND (SELECT COUNT(*) FROM survey_aadhar) = 0 
        THEN '✅ ALL SURVEY DATA CLEARED SUCCESSFULLY'
        ELSE '❌ SOME DATA STILL EXISTS - CHECK ABOVE'
    END AS verification_result;
