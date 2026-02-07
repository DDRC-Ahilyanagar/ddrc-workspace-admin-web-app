-- 1. Create the public_form_questions table (if not exists) & Truncate
CREATE TABLE IF NOT EXISTS `public_form_questions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `section_id` BIGINT UNSIGNED NOT NULL,
  `question` TEXT NOT NULL,
  `question_type` VARCHAR(50) NOT NULL,
  `multi_select` TINYINT(1) NOT NULL DEFAULT 0,
  `options` TEXT NULL,
  `rendering_condition` VARCHAR(10) NULL,
  `rendering_question` VARCHAR(255) NULL,
  `rendering_value` VARCHAR(255) NULL,
  `regex` VARCHAR(255) NULL,
  `valid_input` VARCHAR(20) NULL,
  `max_length` INT NULL,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) DEFAULT 'Active',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_public_section_id` (`section_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

TRUNCATE TABLE `public_form_questions`;

-- 2. Insert ONLY the STRICTLY LIMITED subset of questions requested
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
WHERE `question` IN (
    -- Personal Info (Basic Only - NO beneficiary status questions)
    'दिव्यांगांचे नाव',
    'जन्म तारीख',
    'वय',
    'लिंग',
    'वैवाहिक स्थिती',
    'मोबाईल नं',
    'ईमेल आयडी',
    'वडील/आई चे नाव',
    'वडील किंवा काळजीवाहकाचा मोबाईल नं',
    'कुटूंब प्रमुखाचे नाव',
    'घरातील एकूण सदस्य',
    'प्रवर्ग',
    'रक्त गट',
    'प्रोफाइल फोटो',

    -- Address (Current Address ONLY)
    'सध्याचा ता.',
    'सध्याचा तलाठी कार्यालय',
    'सध्याचा गाव',
    'सध्याचा ग्रामपंचायत',
    'सध्याचा पिन कोड',
    'सध्याचा प्राथमिक आरोग्य केंद्र',
    'सध्याचा पत्ता',
    'सध्याचा खूण / रोड',
    'सध्याचा पोस्ट',
    'सध्याचा जि.',

    -- Disability / Identity (Specific 4 Questions ONLY)
    'दिव्यांग प्रमाणपत्र (SADM)',
    'वैश्विक कार्ड (UDID)',
    'दिव्यांगता प्रकार (Disability Type)',
    'दिव्यांगता टक्केवारी (% of Disability)'
)
ORDER BY `section_id` ASC, `id` ASC;
