-- ============================================
-- UPDATE QUESTION 82: रेशन कार्ड वरील एकूण व्यक्ती
-- ============================================
-- Update options to include numbers 1-20 in the dropdown

UPDATE `questions`
SET 
    `options` = '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20',
    `updated_by` = 1,
    `updated_on` = NOW()
WHERE 
    `id` = 82 
    AND `question` = 'रेशन कार्ड वरील एकूण व्यक्ती';

-- ============================================
-- VERIFY UPDATE
-- ============================================
-- Check the updated question
SELECT 
    `id`, 
    `question`, 
    `question_type`,
    `options`,
    `max_length`
FROM `questions` 
WHERE `id` = 82;

