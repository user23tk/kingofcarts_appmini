-- Complete schema initialization script for King of Carts
-- Consolidated from previous migration scripts
-- Version: 3.6.0

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS TABLE
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  telegram_id bigint unique,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  language_code text,
  is_premium boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  referral_source text
);

-- USER PROGRESS TABLE
create table if not exists public.user_progress (
  user_id uuid references public.users(id) on delete cascade primary key,
  telegram_id bigint,
  current_theme text default 'fantasy',
  completed_themes text[] default array[]::text[],
  total_chapters_completed integer default 0,
  last_chapter_completed_at timestamptz,
  rank integer default 0,
  points integer default 0,
  energy integer default 100,
  max_energy integer default 100,
  energy_refill_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- THEMES TABLE
create table if not exists public.themes (
  id text primary key,
  name text not null,
  description text,
  is_active boolean default true,
  required_level integer default 1,
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- STORY SESSIONS
create table if not exists public.story_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  theme_id text references public.themes(id),
  status text default 'active', -- active, completed, failed
  current_chapter integer default 1,
  total_chapters integer default 5,
  context jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- EVENTS TABLE
create table if not exists public.events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  type text default 'standard', -- standard, tournament, special
  config jsonb default '{}'::jsonb,
  status text default 'scheduled', -- scheduled, active, completed, cancelled
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- EVENT PARTICIPANTS
create table if not exists public.event_participants (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  score integer default 0,
  rank integer,
  metadata jsonb default '{}'::jsonb,
  joined_at timestamptz default now(),
  primary key (event_id, user_id)
);

-- RLS POLICIES
alter table public.users enable row level security;
alter table public.user_progress enable row level security;
alter table public.themes enable row level security;
alter table public.story_sessions enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;

-- Public read access policies
create policy "Public read access" on public.users for select using (true);
create policy "Public read access" on public.user_progress for select using (true);
create policy "Public read access" on public.themes for select using (true);
create policy "Public read access" on public.events for select using (true);
create policy "Public read access" on public.event_participants for select using (true);

-- User self-access policies
create policy "User update own profile" on public.users for update using (auth.uid() = id);
create policy "User update own progress" on public.user_progress for update using (auth.uid() = user_id);
create policy "User manage sessions" on public.story_sessions using (auth.uid() = user_id);

-- RPC FUNCTIONS

-- Get User Rank
create or replace function public.get_user_rank(p_user_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_rank integer;
begin
  select count(*) + 1
  into v_rank
  from public.user_progress
  where total_chapters_completed > (
    select total_chapters_completed
    from public.user_progress
    where user_id = p_user_id
  );
  
  -- Update rank in user_progress
  update public.user_progress
  set rank = v_rank
  where user_id = p_user_id;
  
  return v_rank;
end;
$$;

-- Get Leaderboard
create or replace function public.get_leaderboard(limit_count integer default 100)
returns table (
  user_id uuid,
  username text,
  photo_url text,
  total_chapters_completed integer,
  rank integer
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    up.user_id,
    u.username,
    u.photo_url,
    up.total_chapters_completed,
    up.rank
  from public.user_progress up
  join public.users u on u.id = up.user_id
  order by up.total_chapters_completed desc
  limit limit_count;
end;
$$;

-- Update Theme Progress
create or replace function public.update_theme_progress(
  p_user_id uuid,
  p_theme_id text
)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_progress
  set 
    completed_themes = array_append(completed_themes, p_theme_id),
    updated_at = now()
  where user_id = p_user_id
  and not (p_theme_id = any(completed_themes));
end;
$$;
