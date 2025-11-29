-- Script: 112_sync_chapters_completed_trigger.sql
-- Sync chapters_completed and total_chapters_completed columns via trigger
-- This ensures backward compatibility while consolidating data

-- Create trigger function to sync the duplicate columns
CREATE OR REPLACE FUNCTION sync_chapters_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Keep both columns in sync
  IF NEW.chapters_completed IS DISTINCT FROM NEW.total_chapters_completed THEN
    -- Use the greater value to avoid data loss
    IF COALESCE(NEW.chapters_completed, 0) > COALESCE(NEW.total_chapters_completed, 0) THEN
      NEW.total_chapters_completed := NEW.chapters_completed;
    ELSE
      NEW.chapters_completed := NEW.total_chapters_completed;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_chapters_completed_trigger ON user_progress;

-- Create trigger
CREATE TRIGGER sync_chapters_completed_trigger
  BEFORE INSERT OR UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION sync_chapters_completed();

-- One-time sync of existing data
UPDATE user_progress
SET 
  total_chapters_completed = GREATEST(
    COALESCE(chapters_completed, 0), 
    COALESCE(total_chapters_completed, 0)
  ),
  chapters_completed = GREATEST(
    COALESCE(chapters_completed, 0), 
    COALESCE(total_chapters_completed, 0)
  )
WHERE chapters_completed IS DISTINCT FROM total_chapters_completed
   OR chapters_completed IS NULL
   OR total_chapters_completed IS NULL;
