-- ============================================
-- DISABILITY ORGANS (दिव्यांगता अवयव) TABLE SETUP
-- ============================================
-- This table stores the body parts/organs for disability questions
-- Used by questions: 74 (दिव्यांगता अवयव), 102 (पत्नी/पती दिव्यांगता अवयव), 174 (अपत्य दिव्यांगता अवयव)

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS `disability_organs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `label_marathi` VARCHAR(255) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_label` (`label_marathi`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert the 20 disability organ options
-- Using INSERT IGNORE to avoid duplicates if running multiple times
INSERT IGNORE INTO `disability_organs` (`id`, `label_marathi`, `sort_order`, `is_active`) VALUES
(1, 'छाती', 1, 1),
(2, 'कान', 2, 1),
(3, 'डोके', 3, 1),
(4, 'डावा डोळा', 4, 1),
(5, 'डावा हात', 5, 1),
(6, 'डावा पाय', 6, 1),
(7, 'तोंड', 7, 1),
(8, 'नाक', 8, 1),
(9, 'खांदे', 9, 1),
(10, 'गळा', 10, 1),
(11, 'उजवा डोळा', 11, 1),
(12, 'उजवा हात', 12, 1),
(13, 'उजवा पाय', 13, 1),
(14, 'पोट', 14, 1),
(15, 'डावी संपूर्ण बाजू', 15, 1),
(16, 'उजवी संपूर्ण बाजू', 16, 1),
(17, 'दोन्ही डोळे', 17, 1),
(18, 'दोन्ही हात', 18, 1),
(19, 'दोन्ही पाय', 19, 1),
(20, 'लागू नाही', 20, 1);

-- Verify the data
SELECT * FROM `disability_organs` ORDER BY `sort_order` ASC;

-- ============================================
-- SQL QUERY TO FETCH DISABILITY ORGANS
-- ============================================
-- Use this query in your API to fetch the options:

SELECT `label_marathi` 
FROM `disability_organs` 
WHERE `is_active` = 1 
ORDER BY `sort_order` ASC, `id` ASC;

-- Expected result: 20 rows with the Marathi labels in the correct order

