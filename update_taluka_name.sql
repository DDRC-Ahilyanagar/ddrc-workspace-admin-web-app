-- Update taluka name from "Ahilyanagar" to "Nagar" in all relevant tables
-- This updates lookup tables, camps, and any survey data

-- Update tbl_taluka table
UPDATE tbl_taluka 
SET taluka = 'Nagar' 
WHERE taluka = 'Ahilyanagar' OR taluka = 'Ahilyanag';

-- Update tbl_all_talukas table (if it exists)
UPDATE tbl_all_talukas 
SET taluka = 'Nagar' 
WHERE taluka = 'Ahilyanagar' OR taluka = 'Ahilyanag';

-- Update camps table location field
UPDATE camps 
SET location = 'Nagar' 
WHERE location = 'Ahilyanagar' OR location = 'Ahilyanag';

-- Update survey_aadhar table if it has taluka field
UPDATE survey_aadhar 
SET taluka = 'Nagar' 
WHERE taluka = 'Ahilyanagar' OR taluka = 'Ahilyanag';

-- Update surveys table JSON data (if taluka is stored in survey_json)
-- Note: This updates JSON strings, so it's a bit more complex
UPDATE surveys 
SET survey_json = REPLACE(survey_json, '"Ahilyanagar"', '"Nagar"')
WHERE survey_json LIKE '%Ahilyanagar%';

UPDATE surveys 
SET survey_json = REPLACE(survey_json, '"Ahilyanag"', '"Nagar"')
WHERE survey_json LIKE '%Ahilyanag%';

-- Verify the updates
SELECT 'tbl_taluka' as table_name, taluka, COUNT(*) as count 
FROM tbl_taluka 
WHERE taluka IN ('Nagar', 'Ahilyanagar', 'Ahilyanag')
GROUP BY taluka

UNION ALL

SELECT 'tbl_all_talukas' as table_name, taluka, COUNT(*) as count 
FROM tbl_all_talukas 
WHERE taluka IN ('Nagar', 'Ahilyanagar', 'Ahilyanag')
GROUP BY taluka

UNION ALL

SELECT 'camps' as table_name, location as taluka, COUNT(*) as count 
FROM camps 
WHERE location IN ('Nagar', 'Ahilyanagar', 'Ahilyanag')
GROUP BY location;

