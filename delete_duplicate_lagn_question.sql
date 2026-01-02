-- Delete duplicate question ID 221 "लग्न करण्याचा मनस आहे का?"
-- Keep only ID 204 "विवाह करण्याचा मानस आहे का?"
-- These are the same question with different wording

-- First, verify the duplicate exists
SELECT id, question, section_id, rendering_condition, rendering_question, rendering_value, status
FROM questions
WHERE id IN (204, 221)
ORDER BY id;

-- Delete/Deactivate question ID 221 "लग्न करण्याचा मनस आहे का?"
-- Note: The correct question is ID 204 "विवाह करण्याचा मानस आहे का?"

-- Option 1: Deactivate (safer - keeps data for reference)
UPDATE questions
SET status = 'Inactive',
    updated_by = 1,
    updated_on = NOW()
WHERE id = 221;

-- Option 2: Completely delete (use this if you're sure and want to remove permanently)
-- DELETE FROM questions
-- WHERE id = 221;

-- Verify only the correct question ID 204 remains active
SELECT id, question, section_id, rendering_condition, rendering_question, rendering_value, status
FROM questions
WHERE id IN (204, 221)
ORDER BY id;

