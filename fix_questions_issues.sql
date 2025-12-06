-- Fix question issues:
-- 1. Question 134: Change valid_input from "numeric" to "text" for business type question
-- 2. Ensure questions don't get wrong options injected

-- Fix question 134: महामंडळाचे कर्ज कोणत्या व्यवसायासाठी घेतले आहे?
UPDATE questions 
SET valid_input = 'text' 
WHERE id = 134 
  AND question = 'महामंडळाचे कर्ज कोणत्या व्यवसायासाठी घेतले आहे?';

-- Verify the fix
SELECT id, question, question_type, valid_input, options 
FROM questions 
WHERE id IN (73, 79, 101, 102, 134) 
ORDER BY id;

