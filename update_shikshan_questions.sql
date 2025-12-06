-- ============================================
-- UPDATE SHIKSHAN SECTION QUESTIONS
-- ============================================
-- This updates the rendering conditions for शिक्षण section questions

-- ============================================
-- 1. UPDATE "पदवीचे नाव" (Question ID 29)
-- ============================================
-- Change rendering condition to show only when:
-- "शिक्षित असल्यास / शिक्षण घेत असल्यास" = "पदवीधर" OR "डिप्लोमा" OR "डॉक्टरेट"
-- Previously it was showing for "शिक्षण" = "शिक्षित"

UPDATE `questions`
SET 
    `rendering_condition` = 'Yes',
    `rendering_question` = 'शिक्षित असल्यास / शिक्षण घेत असल्यास',
    `rendering_value` = 'पदवीधर,डिप्लोमा,डॉक्टरेट',
    `updated_by` = 1,
    `updated_on` = NOW()
WHERE 
    `id` = 29 
    AND `question` = 'पदवीचे नाव'
    AND `section_id` = 2;

-- ============================================
-- 2. UPDATE "आपणांस संगणकाचे ज्ञान आहे का?" (Question ID 26)
-- ============================================
-- Change rendering condition to show only when:
-- "शिक्षित असल्यास / शिक्षण घेत असल्यास" = "माध्यमिक" OR "उच्च माध्यमिक" OR "पदवी" OR "पदवीधर" OR "डिप्लोमा" OR "डॉक्टरेट"
-- This will hide it when "प्राथमिक" is selected
-- Previously it was showing for "शिक्षण" = "शिक्षण घेत आहे,शिक्षित"

UPDATE `questions`
SET 
    `rendering_condition` = 'Yes',
    `rendering_question` = 'शिक्षित असल्यास / शिक्षण घेत असल्यास',
    `rendering_value` = 'माध्यमिक,उच्च माध्यमिक,पदवी,पदवीधर,डिप्लोमा,डॉक्टरेट',
    `updated_by` = 1,
    `updated_on` = NOW()
WHERE 
    `id` = 26 
    AND `question` = 'आपणांस संगणकाचे ज्ञान आहे का?'
    AND `section_id` = 2;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check the updated questions
SELECT `id`, `question`, `rendering_condition`, `rendering_question`, `rendering_value`
FROM `questions` 
WHERE `id` IN (26, 29);

-- Check all शिक्षण section questions
SELECT `id`, `question`, `rendering_condition`, `rendering_question`, `rendering_value`
FROM `questions` 
WHERE `section_id` = 2 
ORDER BY `id`;

