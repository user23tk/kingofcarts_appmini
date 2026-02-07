-- Migration script to convert existing progress data to new theme-based format
-- This script safely migrates existing user progress to the new theme_progress JSON structure

-- Create a backup table first (optional, for safety)
CREATE TABLE IF NOT EXISTS user_progress_backup AS 
SELECT * FROM public.user_progress WHERE theme_progress IS NULL OR theme_progress = '{}';

-- Migration function to convert existing progress to new format
CREATE OR REPLACE FUNCTION migrate_user_progress()
RETURNS INTEGER AS $$
DECLARE
  user_record RECORD;
  migrated_count INTEGER := 0;
  theme_progress_json JSONB;
BEGIN
  -- Loop through all users with existing progress but no theme_progress data
  FOR user_record IN 
    SELECT * FROM public.user_progress 
    WHERE (theme_progress IS NULL OR theme_progress = '{}')
    AND current_theme IS NOT NULL
  LOOP
    -- Build the theme_progress JSON structure
    theme_progress_json := jsonb_build_object(
      user_record.current_theme, jsonb_build_object(
        'current_chapter', user_record.current_chapter,
        'completed', false, -- Current theme is not completed if user is still on it
        'last_interaction', COALESCE(user_record.last_interaction, user_record.updated_at, NOW())
      )
    );
    
    -- Add completed themes to the JSON structure
    IF user_record.completed_themes IS NOT NULL AND array_length(user_record.completed_themes, 1) > 0 THEN
      -- Add each completed theme
      FOR i IN 1..array_length(user_record.completed_themes, 1) LOOP
        theme_progress_json := theme_progress_json || jsonb_build_object(
          user_record.completed_themes[i], jsonb_build_object(
            'current_chapter', 10, -- Completed themes are at chapter 10
            'completed', true,
            'last_interaction', COALESCE(user_record.last_interaction, user_record.updated_at, NOW())
          )
        );
      END LOOP;
    END IF;
    
    -- Update the user record with the new theme_progress structure
    UPDATE public.user_progress 
    SET theme_progress = theme_progress_json,
        updated_at = NOW()
    WHERE id = user_record.id;
    
    migrated_count := migrated_count + 1;
    
    -- Log progress every 100 records
    IF migrated_count % 100 = 0 THEN
      RAISE NOTICE 'Migrated % user progress records', migrated_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration completed. Total records migrated: %', migrated_count;
  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_user_progress() as migrated_records;

-- Verify migration results
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN theme_progress IS NOT NULL AND theme_progress != '{}' THEN 1 END) as users_with_theme_progress,
  COUNT(CASE WHEN current_theme IS NOT NULL THEN 1 END) as users_with_current_theme
FROM public.user_progress;

-- Show sample of migrated data (first 5 records)
SELECT 
  user_id,
  current_theme,
  current_chapter,
  completed_themes,
  theme_progress
FROM public.user_progress 
WHERE theme_progress IS NOT NULL AND theme_progress != '{}'
LIMIT 5;

-- Clean up the migration function (optional)
-- DROP FUNCTION IF EXISTS migrate_user_progress();
