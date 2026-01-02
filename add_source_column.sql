-- Add source column to surveys table
-- This column tracks where the survey submission came from:
-- - "Divyang Self" for public route submissions
-- - Field officer's name for mobile app submissions
-- - Admin name for admin web app submissions

ALTER TABLE surveys 
ADD COLUMN source VARCHAR(255) NULL 
AFTER json_path;

-- Optional: Add index if you plan to query by source frequently
-- CREATE INDEX idx_source ON surveys(source);

