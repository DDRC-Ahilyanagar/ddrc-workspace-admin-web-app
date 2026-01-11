-- SQL Query to delete all surveys (similar to truncate)
-- This will delete all survey data including related files
-- WARNING: This is irreversible! Make sure you have a backup.

-- Step 1: Disable safe update mode (to allow DELETE without WHERE clause)
SET SQL_SAFE_UPDATES = 0;

-- Step 2: Disable foreign key checks temporarily (to avoid constraint issues)
SET FOREIGN_KEY_CHECKS = 0;

-- Step 3: Delete all survey files first (they reference aadhaar_id)
DELETE FROM survey_files;

-- Step 4: Delete all surveys
DELETE FROM surveys;

-- Step 5: Delete all survey_aadhar records
-- Comment out the next line if you want to keep Aadhaar records
DELETE FROM survey_aadhar;

-- Step 6: Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Step 7: Re-enable safe update mode
SET SQL_SAFE_UPDATES = 1;

-- Step 6: Verify deletion
SELECT 
    'surveys' AS table_name,
    COUNT(*) AS remaining_records
FROM surveys
UNION ALL
SELECT 
    'survey_files' AS table_name,
    COUNT(*) AS remaining_records
FROM survey_files
UNION ALL
SELECT 
    'survey_aadhar' AS table_name,
    COUNT(*) AS remaining_records
FROM survey_aadhar;

-- Alternative: If you want to use TRUNCATE (faster but requires disabling FK checks)
-- Note: TRUNCATE resets AUTO_INCREMENT, DELETE does not
/*
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE survey_files;
TRUNCATE TABLE surveys;
-- TRUNCATE TABLE survey_aadhar;  -- Uncomment if needed
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;
*/
