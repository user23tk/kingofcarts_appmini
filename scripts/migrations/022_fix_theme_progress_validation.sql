-- Fix theme progress to validate against available chapters
-- This resolves the issue where the game tries to load non-existent chapters
-- for contest themes where chapters are added manually over time

-- Replace get_theme_progress to validate chapter availability
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
  v_saved_chapter integer;
  v_available_chapters integer;
  v_validated_chapter integer;
begin
  -- Get user's saved progress
  select theme_progress into v_progress
  from public.user_progress
  where user_id = p_user_id;
  
  -- If no progress exists, return chapter 1 as default
  if v_progress is null or v_progress -> p_theme_name is null then
    return jsonb_build_object(
      'current_chapter', 1,
      'completed', false,
      'last_interaction', now()
    );
  end if;
  
  -- Get saved chapter from progress
  v_theme_data := v_progress -> p_theme_name;
  v_saved_chapter := (v_theme_data->>'current_chapter')::integer;
  
  -- Count how many chapters actually exist for this theme
  select count(*) into v_available_chapters
  from public.story_chapters sc
  join public.themes t on sc.theme_id = t.id
  where t.name = p_theme_name
    and sc.is_active = true;
  
  -- If no chapters exist, return chapter 1
  if v_available_chapters = 0 then
    return jsonb_build_object(
      'current_chapter', 1,
      'completed', false,
      'last_interaction', now()
    );
  end if;
  
  -- Validate: if saved chapter is beyond available chapters, cap it
  -- This handles the case where user completed chapter 1 (saved as 2), 
  -- but chapter 2 doesn't exist yet
  if v_saved_chapter > v_available_chapters then
    v_validated_chapter := v_available_chapters;
  else
    v_validated_chapter := v_saved_chapter;
  end if;
  
  -- Return validated progress
  return jsonb_build_object(
    'current_chapter', v_validated_chapter,
    'completed', (v_theme_data->>'completed')::boolean,
    'last_interaction', (v_theme_data->>'last_interaction')::timestamptz
  );
end;
$$;
