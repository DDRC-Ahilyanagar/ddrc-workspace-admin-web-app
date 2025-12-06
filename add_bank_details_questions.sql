-- ============================================
-- ADD BANK DETAIL QUESTIONS IN RATION CARD SECTION
-- ============================================
-- These questions appear when "बँक खाते आहे का?" (Question ID 79) = "होय"
-- Section ID: 6 (रेशन कार्ड विषयी)

-- ============================================
-- 1. बँकेचे नाव (Bank Name)
-- ============================================
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
    194,                                    -- Next available ID after 193
    6,                                      -- Section ID for "रेशन कार्ड विषयी"
    'बँकेचे नाव',
    'short_answer',
    0,                                      -- No multi-select
    NULL,
    'Yes',                                  -- Conditional rendering
    'बँक खाते आहे का?',                    -- Depends on "बँक खाते आहे का?"
    'होय',                                 -- Shows when "होय" is selected
    '',
    'text',
    100,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 2. खाते क्रमांक (Account Number)
-- ============================================
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
    195,                                    -- Next available ID
    6,                                      -- Section ID for "रेशन कार्ड विषयी"
    'खाते क्रमांक',
    'short_answer',
    0,                                      -- No multi-select
    NULL,
    'Yes',                                  -- Conditional rendering
    'बँक खाते आहे का?',                    -- Depends on "बँक खाते आहे का?"
    'होय',                                 -- Shows when "होय" is selected
    '',
    'numeric',
    20,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 3. खातेदाराचे नाव (Account Holder Name)
-- ============================================
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
    196,                                    -- Next available ID
    6,                                      -- Section ID for "रेशन कार्ड विषयी"
    'खातेदाराचे नाव',
    'short_answer',
    0,                                      -- No multi-select
    NULL,
    'Yes',                                  -- Conditional rendering
    'बँक खाते आहे का?',                    -- Depends on "बँक खाते आहे का?"
    'होय',                                 -- Shows when "होय" is selected
    '',
    'text',
    100,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 4. बँक IFSC (Bank IFSC Code)
-- ============================================
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
    197,                                    -- Next available ID
    6,                                      -- Section ID for "रेशन कार्ड विषयी"
    'बँक IFSC',
    'short_answer',
    0,                                      -- No multi-select
    NULL,
    'Yes',                                  -- Conditional rendering
    'बँक खाते आहे का?',                    -- Depends on "बँक खाते आहे का?"
    'होय',                                 -- Shows when "होय" is selected
    '^[A-Z]{4}0[A-Z0-9]{6}$',              -- IFSC format: 4 letters + 0 + 6 alphanumeric
    'text',
    11,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- 5. बँक शाखा (Bank Branch Name)
-- ============================================
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
    198,                                    -- Next available ID
    6,                                      -- Section ID for "रेशन कार्ड विषयी"
    'बँक शाखा',
    'short_answer',
    0,                                      -- No multi-select
    NULL,
    'Yes',                                  -- Conditional rendering
    'बँक खाते आहे का?',                    -- Depends on "बँक खाते आहे का?"
    'होय',                                 -- Shows when "होय" is selected
    '',
    'text',
    100,
    'Active',
    1,
    NOW(),
    NULL,
    NULL
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all new bank detail questions
SELECT `id`, `question`, `question_type`, `rendering_condition`, `rendering_question`, `rendering_value`, `max_length`
FROM `questions` 
WHERE `id` IN (194, 195, 196, 197, 198)
ORDER BY `id`;

-- Check all questions in रेशन कार्ड section (should show bank question and bank details)
SELECT `id`, `question`, `question_type`, `rendering_condition`, `rendering_question`, `rendering_value`
FROM `questions` 
WHERE `section_id` = 6 
ORDER BY `id`;

-- ============================================
-- SUMMARY
-- ============================================
-- 
-- NEW QUESTIONS ADDED (5 total):
-- 
-- 1. ID 194 - Section 6 (रेशन कार्ड विषयी)
--    Question: "बँकेचे नाव"
--    Type: short_answer (text)
--    Condition: Shows when "बँक खाते आहे का?" = "होय"
-- 
-- 2. ID 195 - Section 6 (रेशन कार्ड विषयी)
--    Question: "खाते क्रमांक"
--    Type: short_answer (numeric)
--    Condition: Shows when "बँक खाते आहे का?" = "होय"
-- 
-- 3. ID 196 - Section 6 (रेशन कार्ड विषयी)
--    Question: "खातेदाराचे नाव"
--    Type: short_answer (text)
--    Condition: Shows when "बँक खाते आहे का?" = "होय"
-- 
-- 4. ID 197 - Section 6 (रेशन कार्ड विषयी)
--    Question: "बँक IFSC"
--    Type: short_answer (text, with IFSC format validation)
--    Condition: Shows when "बँक खाते आहे का?" = "होय"
-- 
-- 5. ID 198 - Section 6 (रेशन कार्ड विषयी)
--    Question: "बँक शाखा"
--    Type: short_answer (text)
--    Condition: Shows when "बँक खाते आहे का?" = "होय"
-- 
-- ============================================

