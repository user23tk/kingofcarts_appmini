-- Remove the chapter limit constraint to allow infinite progression
ALTER TABLE public.user_progress 
DROP CONSTRAINT IF EXISTS valid_chapter;

-- Add new constraint that only ensures positive chapter numbers
ALTER TABLE public.user_progress 
ADD CONSTRAINT valid_chapter_positive CHECK (current_chapter >= 1);

-- Update any existing records that might be at the old limit
-- This is safe as it just ensures consistency
UPDATE public.user_progress 
SET updated_at = NOW() 
WHERE current_chapter = 10;
