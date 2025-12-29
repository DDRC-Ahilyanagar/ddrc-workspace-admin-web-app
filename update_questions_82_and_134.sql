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
-- UPDATE QUESTION 134: महामंडळाचे कर्ज कोणत्या व्यवसायासाठी घेतले आहे?
-- ============================================
-- Change valid_input from "numeric" to "text" to accept letters instead of numbers
-- Update max_length from 10 to 100

UPDATE `questions`
SET 
    `valid_input` = 'text',
    `max_length` = 100,
    `updated_by` = 1,
    `updated_on` = NOW()
WHERE 
    `id` = 134 
    AND `question` = 'महामंडळाचे कर्ज कोणत्या व्यवसायासाठी घेतले आहे?';

-- ============================================
-- VERIFY UPDATES
-- ============================================
-- Check the updated questions
SELECT 
    `id`, 
    `question`, 
    `question_type`,
    `options`,
    `valid_input`,
    `max_length`
FROM `questions` 
WHERE `id` IN (82, 134)
ORDER BY `id`;

