-- DISABLE SAFE UPDATE MODE to allow updates without primary key
SET SQL_SAFE_UPDATES = 0;

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

    'दिव्यांग प्रमाणपत्र (SADM)',
    'वैश्विक कार्ड (UDID)',
    'दिव्यांगता प्रकार (Disability Type)',
    'दिव्यांगता टक्केवारी (% of Disability)'
)
ORDER BY `section_id` ASC, `id` ASC;

-- 3. UNIFY Address Section IDs
-- Force all address-related questions to use Section ID 3 (Address Section)
UPDATE `public_form_questions`
SET `section_id` = 3
WHERE `question` IN (
    'सध्याचा ता.',
    'सध्याचा तलाठी कार्यालय',
    'सध्याचा गाव',
    'सध्याचा ग्रामपंचायत',
    'सध्याचा पिन कोड',
    'सध्याचा प्राथमिक आरोग्य केंद्र',
    'सध्याचा पत्ता',
    'सध्याचा खूण / रोड',
    'सध्याचा पोस्ट',
    'सध्याचा जि.'
);

-- 4. ORDERING
UPDATE `public_form_questions` SET `sort_order` = 1 WHERE `question` = 'सध्याचा पत्ता';
UPDATE `public_form_questions` SET `sort_order` = 2 WHERE `question` = 'सध्याचा खूण / रोड';
UPDATE `public_form_questions` SET `sort_order` = 3 WHERE `question` = 'सध्याचा पोस्ट';
UPDATE `public_form_questions` SET `sort_order` = 4 WHERE `question` = 'सध्याचा जि.';
UPDATE `public_form_questions` SET `sort_order` = 5 WHERE `question` = 'सध्याचा ता.';
UPDATE `public_form_questions` SET `sort_order` = 6 WHERE `question` = 'सध्याचा गाव';
UPDATE `public_form_questions` SET `sort_order` = 7 WHERE `question` = 'सध्याचा पिन कोड';

-- 5. ENSURE DISABILITY TYPES ARE POPULATED
-- We hardcode the full list of 21 disabilities here to guarantee they appear in the dropdown
UPDATE `public_form_questions`
SET `options` = 'Blindness,Low Vision,Hearing Impairment,Speech and Language Disability,Locomotor Disability,Mental Illness,Specific Learning Disabilities,Cerebral Palsy,Autism Spectrum Disorder,Multiple Disabilities including Deafblindness,Leprosy Cured Persons,Dwarfism,Intellectual Disability,Muscular Dystrophy,Chronic Neurological Conditions,Multiple Sclerosis,Thalassemia,Hemophilia,Sickle Cell Disease,Acid Attack Victim,Parkinson''s Disease'
WHERE `question` LIKE '%Disability Type%' OR `question` LIKE '%दिव्यांगता प्रकार%';

-- RE-ENABLE SAFE UPDATE MODE
SET SQL_SAFE_UPDATES = 1;
