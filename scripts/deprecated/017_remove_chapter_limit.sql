-- Remove chapter limit from user_progress table
-- Allows unlimited chapter progression

ALTER TABLE user_progress 
DROP CONSTRAINT IF EXISTS user_progress_current_chapter_check;

-- Allow any positive chapter number
ALTER TABLE user_progress 
ADD CONSTRAINT user_progress_current_chapter_check 
CHECK (current_chapter > 0);
