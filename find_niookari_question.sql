-- Query 1: Search for "niookari prakar" (exact match)
SELECT 
    id,
    question,
    options,
    section_id,
    sort_order,
    is_active,
    status
FROM questions 
WHERE question LIKE '%niookari prakar%'
   OR question LIKE '%निओकारी प्रकार%'
   OR question LIKE '%निओकारी%'
ORDER BY id;

-- Query 2: Search with case-insensitive and various spellings
SELECT 
    id,
    question,
    options,
    section_id,
    sort_order,
    is_active,
    status
FROM questions 
WHERE LOWER(question) LIKE '%niookari%'
   OR LOWER(question) LIKE '%niokari%'
   OR question LIKE '%निओकारी%'
   OR question LIKE '%निओकरी%'
ORDER BY id;

-- Query 3: Show all columns for detailed view
SELECT * 
FROM questions 
WHERE question LIKE '%niookari%'
   OR question LIKE '%निओकारी%'
   OR question LIKE '%प्रकार%'
ORDER BY id;
