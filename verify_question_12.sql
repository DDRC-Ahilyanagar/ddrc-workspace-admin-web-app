-- ============================================
-- VERIFY QUESTION 12: प्रवर्ग (Category)
-- ============================================
-- Run this to check what's currently in the database

SELECT 
    `id`, 
    `question`, 
    `section_id`,
    `question_type`,
    `options`,
    `updated_on`,
    `updated_by`
FROM `questions` 
WHERE `id` = 12;

-- Check all questions with "प्रवर्ग" in the question text
SELECT 
    `id`, 
    `question`, 
    `section_id`,
    `options`
FROM `questions` 
WHERE `question` LIKE '%प्रवर्ग%'
ORDER BY `id`;

