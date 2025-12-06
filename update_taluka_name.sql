-- Update taluka name from "Ahilyanagar" to "Nagar" in lookup tables
-- This updates both tbl_taluka and tbl_all_talukas tables

-- Update tbl_taluka table
UPDATE tbl_taluka 
SET taluka = 'Nagar' 
WHERE taluka = 'Ahilyanagar' OR taluka = 'Ahilyanag';

-- Update tbl_all_talukas table (if it exists)
UPDATE tbl_all_talukas 
SET taluka = 'Nagar' 
WHERE taluka = 'Ahilyanagar' OR taluka = 'Ahilyanag';

-- Verify the update
SELECT taluka, COUNT(*) as count 
FROM tbl_taluka 
WHERE taluka IN ('Nagar', 'Ahilyanagar', 'Ahilyanag')
GROUP BY taluka;

-- If tbl_all_talukas exists, verify it too
SELECT taluka, COUNT(*) as count 
FROM tbl_all_talukas 
WHERE taluka IN ('Nagar', 'Ahilyanagar', 'Ahilyanag')
GROUP BY taluka;

