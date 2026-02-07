-- Create users table for Telegram bot users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT DEFAULT 'en',
  is_bot BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "users_select_own" ON public.users 
  FOR SELECT USING (TRUE); -- Allow reading all users for bot functionality

CREATE POLICY "users_insert_own" ON public.users 
  FOR INSERT WITH CHECK (TRUE); -- Allow bot to create users

CREATE POLICY "users_update_own" ON public.users 
  FOR UPDATE USING (TRUE); -- Allow bot to update users

-- Create index for faster telegram_id lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
