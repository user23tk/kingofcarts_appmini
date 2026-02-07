-- Remove theme constraint to allow event themes
-- This fixes the 406/400 errors when users try to play event themes like "halloween"

-- Drop the restrictive theme constraint
ALTER TABLE public.user_progress 
DROP CONSTRAINT IF EXISTS valid_theme;

-- Add a more flexible constraint that allows any non-empty theme
ALTER TABLE public.user_progress 
ADD CONSTRAINT valid_theme_not_empty CHECK (current_theme IS NOT NULL AND current_theme != '');

-- Create index for event themes
CREATE INDEX IF NOT EXISTS idx_user_progress_current_theme 
ON public.user_progress(current_theme);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.user_progress TO anon, authenticated;

COMMENT ON CONSTRAINT valid_theme_not_empty ON public.user_progress IS 
'Allows any theme including event themes - only requires non-empty string';
