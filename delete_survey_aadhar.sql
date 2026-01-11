-- SQL Query to delete all survey_aadhar records
-- This will delete all Aadhaar records from the survey_aadhar table
-- WARNING: This is irreversible! Make sure you have a backup.

-- Disable safe update mode (to allow DELETE without WHERE clause)
SET SQL_SAFE_UPDATES = 0;

-- Disable foreign key checks temporarily (to avoid constraint issues)
SET FOREIGN_KEY_CHECKS = 0;

-- Delete all survey_aadhar records
DELETE FROM survey_aadhar;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Re-enable safe update mode
SET SQL_SAFE_UPDATES = 1;

-- Verify deletion
SELECT 
    'survey_aadhar' AS table_name,
    COUNT(*) AS remaining_records
FROM survey_aadhar;
