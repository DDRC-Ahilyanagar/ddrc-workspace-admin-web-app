-- ============================================
-- UPDATE QUESTION 12: प्रवर्ग (Category)
-- ============================================
-- Update options to include all categories with full names and English codes
-- Combines options from both field officer app and web app
-- Options: SC, ST, OBC, VJ/NT (भटके विमुक्त), OPEN/GENERAL, MINORITY

-- Update question 12 - Try multiple WHERE conditions to ensure it matches
UPDATE `questions`
SET 
    `options` = 'अनुसूचित जाती (SC),अनुसूचित जमाती (ST),इतर मागास वर्ग (OBC),विशेष मागास प्रवर्ग (VJ/NT),खुला प्रवर्ग (OPEN/GENERAL),अल्पसंख्याक (MINORITY)',
    `updated_by` = 1,
    `updated_on` = NOW()
WHERE 
    `id` = 12;

-- Alternative: Update by question text (in case ID doesn't match)
UPDATE `questions`
SET 
    `options` = 'अनुसूचित जाती (SC),अनुसूचित जमाती (ST),इतर मागास वर्ग (OBC),विशेष मागास प्रवर्ग (VJ/NT),खुला प्रवर्ग (OPEN/GENERAL),अल्पसंख्याक (MINORITY)',
    `updated_by` = 1,
    `updated_on` = NOW()
WHERE 
    `question` = 'प्रवर्ग'
    AND `section_id` = 1;

-- ============================================
-- VERIFY UPDATE
-- ============================================
-- Check the updated question
SELECT 
    `id`, 
    `question`, 
    `question_type`,
    `options`,
    `updated_on`
FROM `questions` 
WHERE `id` = 12;

-- Also check if there are multiple questions with same text (just in case)
SELECT 
    `id`, 
    `question`, 
    `section_id`,
    `options`
FROM `questions` 
WHERE `question` LIKE '%प्रवर्ग%'
ORDER BY `id`;

