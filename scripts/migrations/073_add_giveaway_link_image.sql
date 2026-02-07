-- Migration: Add prize_link and prize_image_url columns to giveaways table
-- Run this after 070_giveaway_schema.sql if the columns don't exist

DO $$ 
BEGIN
  -- Add prize_link column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'giveaways' AND column_name = 'prize_link'
  ) THEN
    ALTER TABLE giveaways ADD COLUMN prize_link TEXT;
    COMMENT ON COLUMN giveaways.prize_link IS 'External link for the prize (e.g., Telegram gift link)';
  END IF;

  -- Add prize_image_url column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'giveaways' AND column_name = 'prize_image_url'
  ) THEN
    ALTER TABLE giveaways ADD COLUMN prize_image_url TEXT;
    COMMENT ON COLUMN giveaways.prize_image_url IS 'URL of the prize image for display';
  END IF;
END $$;
