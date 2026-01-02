-- Ensure UNIQUE constraints to prevent duplicate Aadhar records and surveys

-- 1. Ensure survey_aadhar table has UNIQUE constraint on aadhar_no
ALTER TABLE survey_aadhar 
ADD UNIQUE KEY IF NOT EXISTS unique_aadhar (aadhar_no);

-- If the above doesn't work (MySQL/MariaDB version doesn't support IF NOT EXISTS), use this:
-- First check if constraint exists, then add if not
SET @dbname = DATABASE();
SET @tablename = "survey_aadhar";
SET @constraintname = "unique_aadhar";

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (CONSTRAINT_NAME = @constraintname)
      AND (CONSTRAINT_TYPE = 'UNIQUE')
  ) > 0,
  "SELECT 'UNIQUE constraint unique_aadhar already exists.' AS result;",
  CONCAT("ALTER TABLE ", @tablename, " ADD UNIQUE KEY ", @constraintname, " (aadhar_no);")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Ensure surveys table has UNIQUE constraint on aadhaar_id
SET @tablename2 = "surveys";
SET @constraintname2 = "unique_aadhaar_id";

SET @preparedStatement2 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename2)
      AND (CONSTRAINT_NAME = @constraintname2)
      AND (CONSTRAINT_TYPE = 'UNIQUE')
  ) > 0,
  "SELECT 'UNIQUE constraint unique_aadhaar_id already exists.' AS result;",
  CONCAT("ALTER TABLE ", @tablename2, " ADD UNIQUE KEY ", @constraintname2, " (aadhaar_id);")
));
PREPARE alterIfNotExists2 FROM @preparedStatement2;
EXECUTE alterIfNotExists2;
DEALLOCATE PREPARE alterIfNotExists2;

-- Verify constraints
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('survey_aadhar', 'surveys')
  AND CONSTRAINT_TYPE = 'UNIQUE'
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

