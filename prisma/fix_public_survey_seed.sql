-- 1. Truncate the table to start fresh
TRUNCATE TABLE `public_form_questions`;

-- 2. Seed data preserving the original IDs
-- We explicitly map the 'id' column from questions to public_form_questions
INSERT INTO `public_form_questions` (
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
    `is_required`, 
    `status`
)
SELECT 
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
    `is_required`, 
    `status`
FROM `questions`
WHERE `status` = 'Active'
ORDER BY `id` ASC;
