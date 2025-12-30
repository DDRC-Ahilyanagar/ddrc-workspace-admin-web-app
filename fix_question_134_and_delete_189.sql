-- ============================================
-- FIX QUESTION 134: महामंडळाचे कर्ज कोणते व्यवसायासाठी घेतले आहे?
-- ============================================
-- Change valid_input from "numeric" to "text" to accept letters instead of numbers
UPDATE questions 
SET valid_input = 'text',
    max_length = 100
WHERE id = 134 
  AND question = 'महामंडळाचे कर्ज कोणत्या व्यवसायासाठी घेतले आहे?';

-- ============================================
-- DELETE QUESTION 189: नोकरी प्रकार
-- ============================================
-- Note: Question 190 ("नोकरी साठी 4% राखीव जागांचा लाभ घेतला आहे का?") 
-- depends on question 189. We need to update question 190's dependency first.

-- Step 1: Update question 190 to depend on question 175 ("नोकरी करत असल्यास") 
-- instead of question 189 ("नोकरी प्रकार")
-- Question 175 has options: "संस्था,सरकारी,खाजगी,दुकान,शेतमजूर,इतर"
-- We'll make question 190 show when "सरकारी" is selected from question 175
UPDATE questions
SET rendering_question = 'नोकरी करत असल्यास',
    rendering_value = 'सरकारी'
WHERE id = 190
  AND question = 'नोकरी साठी 4% राखीव जागांचा लाभ घेतला आहे का?';

-- Step 2: Delete question 189 (नोकरी प्रकार)
DELETE FROM questions
WHERE id = 189
  AND question = 'नोकरी प्रकार';

-- ============================================
-- VERIFY CHANGES
-- ============================================
-- Check question 134 fix
SELECT 
  id, 
  question, 
  valid_input, 
  max_length
FROM questions 
WHERE id = 134;

-- Check if question 189 is deleted
SELECT 
  id, 
  question
FROM questions 
WHERE id = 189;

-- Check question 190 dependency update
SELECT 
  id, 
  question, 
  rendering_question,
  rendering_value
FROM questions 
WHERE id = 190;

-- Check all related questions
SELECT 
  id, 
  question, 
  question_type, 
  valid_input, 
  max_length,
  SUBSTRING(options, 1, 50) as options_preview,
  rendering_question,
  rendering_value
FROM questions 
WHERE id IN (134, 175, 189, 190)
ORDER BY id;

