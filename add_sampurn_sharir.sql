-- ============================================
-- ADD "संपूर्ण शरीर" (Sampurn Sharir) TO DISABILITY ORGANS
-- ============================================
-- This adds "संपूर्ण शरीर" (entire body/whole body) option to the disability organs list

-- Option 1: Insert with sort_order 20 (before "लागू नाही")
-- This will place it logically before "not applicable"
INSERT INTO `disability_organs` (`label_marathi`, `sort_order`, `is_active`) 
VALUES ('संपूर्ण शरीर', 20, 1);

-- Update "लागू नाही" to sort_order 21 to maintain order
UPDATE `disability_organs` 
SET `sort_order` = 21 
WHERE `label_marathi` = 'लागू नाही';

-- ============================================
-- ALTERNATIVE: If you want it at the end (after "लागू नाही")
-- ============================================
-- Uncomment below if you prefer this option:

-- INSERT INTO `disability_organs` (`label_marathi`, `sort_order`, `is_active`) 
-- VALUES ('संपूर्ण शरीर', 21, 1);

-- ============================================
-- VERIFY THE INSERTION
-- ============================================
SELECT * FROM `disability_organs` 
WHERE `is_active` = 1 
ORDER BY `sort_order` ASC, `id` ASC;

