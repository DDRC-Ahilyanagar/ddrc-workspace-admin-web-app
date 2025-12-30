-- SQL Queries to add new question and update existing question
-- Run these queries on your MySQL database

-- ============================================
-- 1. ADD NEW QUESTION IN SHIKSHAN SECTION
-- ============================================
-- Question: "प्रवेश घेण्यासाठी 5% राखीव जागांचा लाभ घेतला आहे का?"
-- Shows when "शिक्षित" OR "शिक्षण घेत आहे" is selected

INSERT INTO `questions` (
    `id`,
    `section_id`,
    `question`,
    `question_type`,
    `multi_select`,
    `options`,
    `rendering_condition`,
    `rendering_question`,
    `rendering_value`,
    `regex`,
    `valid_input`,
    `max_length`,
    `status`,
    `created_by`,
    `created_on`,
    `updated_by`,
    `updated_on`
) VALUES (
    187,                                    -- Next available ID after 186
    2,                                      -- Section ID for "शैक्षणिक माहिती"
    'प्रवेश घेण्यासाठी 5% राखीव जागांचा लाभ घेतला आहे का?',
    'MCQ',
    0,                                      -- No multi-select
    'होय,नाही',
    'Yes',                                  -- Conditional rendering
    'शिक्षण',                               -- Depends on "शिक्षण" question
    'शिक्षित,शिक्षण घेत आहे',              -- Shows when either "शिक्षित" OR "शिक्षण घेत आहे" is selected
    '',
    '',
    10,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 2. ADD BANK ACCOUNT QUESTION IN RATION CARD SECTION
-- ============================================
-- Question: "बँक खाते आहे का?"
-- Should appear BEFORE "रेशन कार्ड आहे का?" (question ID 80)
-- Using ID 79 to place it right before question 80

INSERT INTO `questions` (
    `id`,
    `section_id`,
    `question`,
    `question_type`,
    `multi_select`,
    `options`,
    `rendering_condition`,
    `rendering_question`,
    `rendering_value`,
    `regex`,
    `valid_input`,
    `max_length`,
    `status`,
    `created_by`,
    `created_on`,
    `updated_by`,
    `updated_on`
) VALUES (
    79,                                     -- ID 79 to appear before question 80
    6,                                      -- Section ID for "रेशन कार्ड विषयी"
    'बँक खाते आहे का?',
    'MCQ',
    0,                                      -- No multi-select
    'होय,नाही',
    'No',                                   -- No conditional rendering - always shows
    NULL,                                   -- No dependency
    NULL,                                   -- No rendering value
    '',
    '',
    10,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 3. ADD NOKARI PRAKAR QUESTION IN NOKARI/VYAVASAY SECTION
-- ============================================
-- Question: "नोकरी प्रकार"
-- Shows when "नोकरी" is selected from "नोकरी किंवा व्यवसाय करता का?"
-- Only 2 options: "सरकारी,खाजगी"

INSERT INTO `questions` (
    `id`,
    `section_id`,
    `question`,
    `question_type`,
    `multi_select`,
    `options`,
    `rendering_condition`,
    `rendering_question`,
    `rendering_value`,
    `regex`,
    `valid_input`,
    `max_length`,
    `status`,
    `created_by`,
    `created_on`,
    `updated_by`,
    `updated_on`
) VALUES (
    189,                                    -- Next available ID after 188
    15,                                     -- Section ID for "नोकरी / व्यवसाय"
    'नोकरी प्रकार',
    'MCQ',
    0,                                      -- No multi-select
    'सरकारी,खाजगी',
    'Yes',                                  -- Conditional rendering
    'नोकरी किंवा व्यवसाय करता का?',        -- Depends on this question
    'नोकरी',                                -- Shows when "नोकरी" is selected
    '',
    '',
    10,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 4. ADD 4% RESERVATION QUESTION FOR SARKARI NOKARI
-- ============================================
-- Question: "नोकरी साठी 4% राखीव जागांचा लाभ घेतला आहे का?"
-- Shows when "सरकारी" is selected from "नोकरी प्रकार"

INSERT INTO `questions` (
    `id`,
    `section_id`,
    `question`,
    `question_type`,
    `multi_select`,
    `options`,
    `rendering_condition`,
    `rendering_question`,
    `rendering_value`,
    `regex`,
    `valid_input`,
    `max_length`,
    `status`,
    `created_by`,
    `created_on`,
    `updated_by`,
    `updated_on`
) VALUES (
    190,                                    -- Next available ID after 189
    15,                                     -- Section ID for "नोकरी / व्यवसाय"
    'नोकरी साठी 4% राखीव जागांचा लाभ घेतला आहे का?',
    'MCQ',
    0,                                      -- No multi-select
    'होय,नाही',
    'Yes',                                  -- Conditional rendering
    'नोकरी प्रकार',                         -- Depends on "नोकरी प्रकार" question
    'सरकारी',                               -- Shows when "सरकारी" is selected
    '',
    '',
    10,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 5. ADD DEPENDENCY QUESTION IN UTPANNA SECTION
-- ============================================
-- Question: "कुटुंब पूर्णपणे दिव्यांग व्यक्तीच्या उत्पन्नावर अवलंबून आहे का?"
-- Goes in "नोकरी / व्यवसाय" section (section 15) which contains utpanna questions

INSERT INTO `questions` (
    `id`,
    `section_id`,
    `question`,
    `question_type`,
    `multi_select`,
    `options`,
    `rendering_condition`,
    `rendering_question`,
    `rendering_value`,
    `regex`,
    `valid_input`,
    `max_length`,
    `status`,
    `created_by`,
    `created_on`,
    `updated_by`,
    `updated_on`
) VALUES (
    191,                                    -- Next available ID after 190
    15,                                     -- Section ID for "नोकरी / व्यवसाय" (utpanna section)
    'कुटुंब पूर्णपणे दिव्यांग व्यक्तीच्या उत्पन्नावर अवलंबून आहे का?',
    'MCQ',
    0,                                      -- No multi-select
    'होय,नाही',
    'No',                                   -- No conditional rendering - always shows
    NULL,                                   -- No dependency
    NULL,                                   -- No rendering value
    '',
    '',
    10,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 6. ADD LOCAL SELF-GOVERNMENT 5% SCHEME QUESTION
-- ============================================
-- Question: "स्थानिक स्वराज्य संस्थांच्या वैयक्तिक लाभाच्या 5% योजनेचा लाभ घेतला आहे का?"
-- In "इतर शासकीय योजना" section

INSERT INTO `questions` (
    `id`,
    `section_id`,
    `question`,
    `question_type`,
    `multi_select`,
    `options`,
    `rendering_condition`,
    `rendering_question`,
    `rendering_value`,
    `regex`,
    `valid_input`,
    `max_length`,
    `status`,
    `created_by`,
    `created_on`,
    `updated_by`,
    `updated_on`
) VALUES (
    192,                                    -- Next available ID after 191
    11,                                     -- Section ID for "इतर शासकीय योजना"
    'स्थानिक स्वराज्य संस्थांच्या वैयक्तिक लाभाच्या 5% योजनेचा लाभ घेतला आहे का?',
    'MCQ',
    0,                                      -- No multi-select
    'होय,नाही',
    'No',                                   -- No conditional rendering - always shows
    NULL,                                   -- No dependency
    NULL,                                   -- No rendering value
    '',
    '',
    10,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 7. ADD MNREGA EMPLOYMENT QUESTION
-- ============================================
-- Question: "मनरेगा योजनेत रोजगार मिळाला आहे का?"
-- In "इतर शासकीय योजना" section

INSERT INTO `questions` (
    `id`,
    `section_id`,
    `question`,
    `question_type`,
    `multi_select`,
    `options`,
    `rendering_condition`,
    `rendering_question`,
    `rendering_value`,
    `regex`,
    `valid_input`,
    `max_length`,
    `status`,
    `created_by`,
    `created_on`,
    `updated_by`,
    `updated_on`
) VALUES (
    193,                                    -- Next available ID after 192
    11,                                     -- Section ID for "इतर शासकीय योजना"
    'मनरेगा योजनेत रोजगार मिळाला आहे का?',
    'MCQ',
    0,                                      -- No multi-select
    'होय,नाही',
    'No',                                   -- No conditional rendering - always shows
    NULL,                                   -- No dependency
    NULL,                                   -- No rendering value
    '',
    '',
    10,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 8. UPDATE DIVYANGATA KARAN QUESTION (ID 72)
-- ============================================
-- Add "वैद्यकीय / आजारणे" option to existing options

UPDATE `questions`
SET 
    `options` = 'जन्मत:,अपघात,वांशिक,अनुवांशिक,वैद्यकीय / आजारणे',
    `updated_by` = 1,
    `updated_on` = NOW()
WHERE 
    `id` = 72 
    AND `question` = 'दिव्यांगता कारण'
    AND `section_id` = 5;

-- ============================================
-- VERIFICATION QUERIES (Optional - run to check)
-- ============================================

-- Check the new Shikshan question was inserted
SELECT * FROM `questions` WHERE `id` = 187;

-- Check the new Bank Account question was inserted
SELECT * FROM `questions` WHERE `id` = 79;

-- Check the updated Divyangata Karan question
SELECT `id`, `question`, `options` FROM `questions` WHERE `id` = 72;

-- Check all questions in रेशन कार्ड section (should show bank question and ration card question)
SELECT `id`, `question`, `options` FROM `questions` WHERE `section_id` = 6 ORDER BY `id`;

-- Check new नोकरी questions
SELECT * FROM `questions` WHERE `id` IN (189, 190, 191);

-- Check all questions in नोकरी / व्यवसाय section
SELECT `id`, `question`, `options`, `rendering_question`, `rendering_value` 
FROM `questions` 
WHERE `section_id` = 15 
ORDER BY `id`;

-- Check new इतर शासकीय योजना questions
SELECT * FROM `questions` WHERE `id` IN (192, 193);

-- Check all questions in इतर शासकीय योजना section
SELECT `id`, `question`, `options` 
FROM `questions` 
WHERE `section_id` = 11 
ORDER BY `id`;

-- ============================================
-- COMPLETE SUMMARY OF ALL QUESTIONS ADDED/UPDATED
-- ============================================
-- 
-- NEW QUESTIONS ADDED (7 total):
-- 
-- 1. ID 79  - Section 6 (रेशन कार्ड विषयी)
--    Question: "बँक खाते आहे का?"
--    Options: "होय,नाही"
--    Condition: Always visible
-- 
-- 2. ID 187 - Section 2 (शैक्षणिक माहिती)
--    Question: "प्रवेश घेण्यासाठी 5% राखीव जागांचा लाभ घेतला आहे का?"
--    Options: "होय,नाही"
--    Condition: Shows when "शिक्षण" = "शिक्षित" OR "शिक्षण घेत आहे"
-- 
-- 3. ID 189 - Section 15 (नोकरी / व्यवसाय)
--    Question: "नोकरी प्रकार"
--    Options: "सरकारी,खाजगी"
--    Condition: Shows when "नोकरी किंवा व्यवसाय करता का?" = "नोकरी"
-- 
-- 4. ID 190 - Section 15 (नोकरी / व्यवसाय)
--    Question: "नोकरी साठी 4% राखीव जागांचा लाभ घेतला आहे का?"
--    Options: "होय,नाही"
--    Condition: Shows when "नोकरी प्रकार" = "सरकारी"
-- 
-- 5. ID 191 - Section 15 (नोकरी / व्यवसाय)
--    Question: "कुटुंब पूर्णपणे दिव्यांग व्यक्तीच्या उत्पन्नावर अवलंबून आहे का?"
--    Options: "होय,नाही"
--    Condition: Always visible
-- 
-- 6. ID 192 - Section 11 (इतर शासकीय योजना)
--    Question: "स्थानिक स्वराज्य संस्थांच्या वैयक्तिक लाभाच्या 5% योजनेचा लाभ घेतला आहे का?"
--    Options: "होय,नाही"
--    Condition: Always visible
-- 
-- 7. ID 193 - Section 11 (इतर शासकीय योजना)
--    Question: "मनरेगा योजनेत रोजगार मिळाला आहे का?"
--    Options: "होय,नाही"
--    Condition: Always visible
-- 
-- UPDATED QUESTIONS (1 total):
-- 
-- 1. ID 72  - Section 5 (दिव्यांगता तपशील)
--    Question: "दिव्यांगता कारण"
--    Updated Options: "जन्मत:,अपघात,वांशिक,अनुवांशिक,वैद्यकीय / आजारणे"
--    (Added "वैद्यकीय / आजारणे" to existing options)
-- 
-- ============================================

