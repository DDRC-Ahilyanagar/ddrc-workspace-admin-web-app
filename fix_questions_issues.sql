-- Fix question issues reported by client:
-- 1. Question 79 (दिव्यांगता बरे होण्यासाठी उपचार): Should show treatment options, NOT body parts
-- 2. Question 102 (शेती आहे का?): Should show "होय,नाही", NOT body parts  
-- 3. Question 134 (महामंडळाचे कर्ज व्यवसायासाठी): Should accept text, NOT numbers

-- Fix question 134: Change valid_input from "numeric" to "text" for business type question
UPDATE questions 
SET valid_input = 'text',
    max_length = 100
WHERE id = 134 
  AND question = 'महामंडळाचे कर्ज कोणत्या व्यवसायासाठी घेतले आहे?';

-- Ensure question 79 has correct treatment options (should already be correct in DB)
-- Verify question 79 options are treatment-related, not body parts
UPDATE questions 
SET options = 'भौतिकोपचार,वाचाउपचार,मानसिक उपचार,श्रवण यंत्र,कृत्रिम अवयव,सुधारात्मक शस्त्रक्रिया,इतर वैद्यकीय उपचार'
WHERE id = 79 
  AND question = 'दिव्यांगता बरे होण्यासाठी काही उपचार घेतले आहेत का?';

-- Ensure question 102 has correct Yes/No options (should already be correct in DB)
UPDATE questions 
SET options = 'होय,नाही'
WHERE id = 102 
  AND question = 'शेती आहे का?';

-- Verify all fixes
SELECT 
  id, 
  question, 
  question_type, 
  valid_input, 
  SUBSTRING(options, 1, 50) as options_preview,
  max_length
FROM questions 
WHERE id IN (73, 79, 101, 102, 134) 
ORDER BY id;

