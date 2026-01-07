-- Fix location_tracking table: Change user_id from INT to BIGINT to match users.id
-- Run this if the table was created with INT UNSIGNED instead of BIGINT UNSIGNED

-- First, drop the foreign key constraint if it exists (it will fail with wrong data type)
ALTER TABLE location_tracking 
DROP FOREIGN KEY IF EXISTS fk_location_user;

-- Alter the user_id column to BIGINT UNSIGNED
ALTER TABLE location_tracking 
MODIFY COLUMN user_id BIGINT UNSIGNED NOT NULL;

-- Re-add the foreign key constraint
ALTER TABLE location_tracking 
ADD CONSTRAINT fk_location_user 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE ON UPDATE CASCADE;

