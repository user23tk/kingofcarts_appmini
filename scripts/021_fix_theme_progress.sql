-- Fix theme progress tracking by adding JSONB column and proper RPCs
-- This resolves the issue where "Play Contest" always starts from Chapter 1

-- 1. Add theme_progress column if it doesn't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'user_progress' and column_name = 'theme_progress') then
        alter table public.user_progress add column theme_progress jsonb default '{}'::jsonb;
    end if;
end $$;

-- Drop existing function to avoid parameter default conflict
drop function if exists public.update_theme_progress(uuid, text, integer, boolean);

-- 2. Create update_theme_progress function with 4 arguments (matching TypeScript)
create or replace function public.update_theme_progress(
  p_user_id uuid,
  p_theme text,
  p_chapter integer,
  p_completed boolean
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_progress jsonb;
  v_new_theme_data jsonb;
begin
  -- Get current progress
  select theme_progress into v_current_progress
  from public.user_progress
  where user_id = p_user_id;

  if v_current_progress is null then
    v_current_progress := '{}'::jsonb;
  end if;

  -- Create new theme data
  v_new_theme_data := jsonb_build_object(
    'current_chapter', p_chapter,
    'completed', p_completed,
    'last_interaction', now()
  );

  -- Update user_progress with merged data
  update public.user_progress
  set 
    theme_progress = jsonb_set(
      coalesce(theme_progress, '{}'::jsonb),
      array[p_theme],
      v_new_theme_data,
      true
    ),
    current_theme = p_theme,
    current_chapter = p_chapter, -- Also update legacy/main fields for backward compatibility
    updated_at = now()
  where user_id = p_user_id;
  
  -- If completed, also add to completed_themes array if not present
  if p_completed then
    update public.user_progress
    set completed_themes = array_append(completed_themes, p_theme)
    where user_id = p_user_id
    and not (p_theme = any(completed_themes));
  end if;
end;
$$;

-- 3. Create get_theme_progress function
create or replace function public.get_theme_progress(
  p_user_id uuid,
  p_theme_name text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_progress jsonb;
  v_theme_data jsonb;
begin
  select theme_progress into v_progress
  from public.user_progress
  where user_id = p_user_id;
  
  if v_progress is null or v_progress -> p_theme_name is null then
    return null;
  end if;
  
  return v_progress -> p_theme_name;
end;
$$;

-- 4. Create get_all_theme_progress function
create or replace function public.get_all_theme_progress(
  p_user_id uuid
)
returns table (
  theme text,
  current_chapter integer,
  completed boolean,
  last_interaction timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    key as theme,
    (value->>'current_chapter')::integer as current_chapter,
    (value->>'completed')::boolean as completed,
    (value->>'last_interaction')::timestamptz as last_interaction
  from public.user_progress,
  jsonb_each(theme_progress)
  where user_id = p_user_id;
end;
$$;
