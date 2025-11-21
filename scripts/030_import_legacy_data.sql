-- =====================================================
-- IMPORT LEGACY DATA FROM OLD VERSION
-- =====================================================
-- This script imports data from the button-based version
-- to the current Mini App version with data validation
-- =====================================================

BEGIN;

-- =====================================================
-- 1. IMPORT THEMES
-- =====================================================
-- Convert legacy themes to new schema
-- Note: share_bonus_pp field is dropped (not in new schema)

INSERT INTO themes (id, name, title, description, emoji, is_active, is_event, event_emoji, event_start_date, event_end_date, pp_multiplier, created_at, updated_at)
VALUES 
  ('18fac2e8-361c-469f-be67-fa413e49f5a6', 'romance', 'Romance', 'Storie d''amore e connessioni del cuore', '💕', true, false, '🎉', NULL, NULL, 1.0, '2025-09-09 00:07:46.313937+00', '2025-09-09 00:07:46.313937+00'),
  ('47b0ae08-db62-4133-9c54-3699d4affae2', 'halloween', 'halloween 2025', 'evento contest x2 PP', '🎃', false, true, '🎃', '2025-10-17 12:11:59.692+00', '2025-11-02 15:00:00+00', 2, '2025-10-17 12:11:59.993024+00', '2025-10-17 12:11:59.993024+00'),
  ('607ba5b4-1597-4bfc-af21-c057489d153d', 'comedy', 'Comedy', 'Risate cosmiche e saggezza divertente', '😂', true, false, '🎉', NULL, NULL, 1.0, '2025-09-09 00:07:46.313937+00', '2025-09-09 00:07:46.313937+00'),
  ('8e8370e1-dbac-409f-8094-0b5e614bc2e1', 'sci-fi', 'Sci-Fi', 'Esplorazioni futuristiche nello spazio', '🚀', true, false, '🎉', NULL, NULL, 1.0, '2025-09-09 00:07:46.313937+00', '2025-09-09 00:07:46.313937+00'),
  ('bd084d1b-5640-43af-a32c-1a2694685886', 'adventure', 'Avventura', 'Esplorazioni epiche e tesori nascosti', '🗺️', true, false, '🎉', NULL, NULL, 1.0, '2025-09-09 00:07:46.313937+00', '2025-09-09 00:07:46.313937+00'),
  ('bd4d3afc-3d88-4bc0-961c-2b2b60bc54ff', 'fantasy', 'Fantasy', 'Avventure magiche in regni incantati', '🧙', true, false, '🎉', NULL, NULL, 1.0, '2025-09-09 00:07:46.313937+00', '2025-09-09 00:07:46.313937+00'),
  ('bee8bb3a-2c7f-4687-9724-9836103d8fe7', 'horror', 'Horror', 'Storie spaventose trasformate in amore', '👻', true, false, '🎉', NULL, NULL, 1.0, '2025-09-09 00:07:46.313937+00', '2025-09-09 00:07:46.313937+00'),
  ('ee5ab9d5-c8a5-46d6-848c-e71618442403', 'mystery', 'Mistero', 'Enigmi da risolvere e misteri da svelare', '🔍', true, false, '🎉', NULL, NULL, 1.0, '2025-09-09 00:07:46.313937+00', '2025-09-09 00:07:46.313937+00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  is_active = EXCLUDED.is_active,
  is_event = EXCLUDED.is_event,
  event_emoji = EXCLUDED.event_emoji,
  event_start_date = EXCLUDED.event_start_date,
  event_end_date = EXCLUDED.event_end_date,
  pp_multiplier = EXCLUDED.pp_multiplier,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 2. IMPORT STORY CHAPTERS
-- =====================================================
-- Import the halloween chapter (example - add more as needed)

INSERT INTO story_chapters (id, theme_id, chapter_number, title, content, is_active, version, created_at, updated_at)
VALUES (
  '01ef7b03-df13-4872-a8b6-d1f954e6cebd',
  '47b0ae08-db62-4133-9c54-3699d4affae2',
  1,
  '🎃 Nebbie di Zucchero Spettrale e il Patto del Contest',
  '{"id":"halloween_1","title":"🎃 Nebbie di Zucchero Spettrale e il Patto del Contest","finale":{"text":"La lanterna sorride e il tabellone del Contest canta il tuo nome: i punti si compongono in una costellazione morbida, {{TOTAL_PP}} come un abbraccio numerico. {{KING}} sfiora l''aria: «Respira, qui l''ombra è solo un colore in attesa di te».","nextChapter":"halloween_2"},"scenes":[{"text":"Nella notte di Halloween, la città si veste di foschie color caramello e di zucche che brillano come occhi gentili nel buio; l''aria ha il sapore di vaniglia bruciata e menta lunare, e ogni respiro sembra un piccolo sortilegio. Tra i vicoli, una bruma lattiginosa disegna arabeschi: qualcuno la chiama «la scia del laboratorio». Si dice che sia il passaggio di {{KING}}, ora un''eco gentile, un fantasma che appare quando i cuori cercano coraggio e gioco. Le luci delle vetrine tremano come fiammelle intelligenti, e i corvi di carta ronzano allegri, come se ascoltassero una canzone dimenticata. 👻✨","index":0},{"text":"Un campanello antico vibra e il portale del vecchio Emporio Aromatico si apre davanti a {{PLAYER}}: scaffali di vetro ospitano boccette con costellazioni intrappolate e cartucce lucenti che sussurrano colori. Una lanterna a forma di zucca proietta ombre danzanti, e un manifesto ricamato in filo d''argento annuncia un «Contest delle Ombre Profumate», dove ogni scelta è un passo verso la propria immaginazione. Tra i vapori, uno specchio mostra un riflesso diverso, più audace, come se l''Emporio volesse incoraggiare a trasformare la paura in meraviglia. Una risatina gentile vibra nell''aria, simile a un brindisi tra spiriti amici, e una firma fluorescente: <i>— {{KING}}</i>.","index":1,"choices":[{"id":"choice_1_a","text":"💨 Prendere una «Nebbia di Zucchero Spettrale», una nuvoletta color caramello che sa di vaniglia bruciata e sussurra incoraggiamenti dolci","pp":3,"emoji":"💨"},{"id":"choice_1_b","text":"🌙 Scegliere una «Boccetta di Luna Gentile», che contiene una l... <truncated>
  true,
  1,
  '2025-10-17 12:11:59.993024+00',
  '2025-10-17 12:11:59.993024+00'
)
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  title = EXCLUDED.title,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- NOTE: Add more story_chapters INSERT statements here as needed
-- You can copy the pattern above for each chapter

-- =====================================================
-- 3. IMPORT USERS
-- =====================================================
-- Import users with data type conversion
-- Note: telegram_id is converted from text to bigint

-- Added ::timestamptz cast for created_at and updated_at
INSERT INTO users (id, telegram_id, username, first_name, last_name, language_code, is_bot, created_at, updated_at)
SELECT 
  id::uuid,
  telegram_id::bigint,
  username,
  first_name,
  last_name,
  COALESCE(language_code, 'it'),
  COALESCE(is_bot::boolean, false),
  created_at::timestamptz,
  updated_at::timestamptz
FROM (VALUES
  ('00fb17dc-5834-474b-900e-0139350fa473', '557207727', 'IM20k24', '420', '🖤💙', 'it', 'false', '2025-09-30 16:11:14.780308+00', '2025-09-30 16:12:42.772677+00'),
  ('014d17f4-c586-41ce-9117-f182153bd7a3', '695354460', 'jagmut', 'lear', null, 'it', 'false', '2025-09-30 19:09:08.574241+00', '2025-09-30 19:09:13.367249+00'),
  ('073db221-2d2a-4ef8-bc5b-0a5dc8887720', '622663206', 'diomemerda', 'NinoArancino', null, 'it', 'false', '2025-10-27 09:34:33.61566+00', '2025-10-27 09:50:08.559426+00')
  -- Add more users here...
) AS legacy_users(id, telegram_id, username, first_name, last_name, language_code, is_bot, created_at, updated_at)
ON CONFLICT (telegram_id) DO UPDATE SET
  username = EXCLUDED.username,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 4. IMPORT USER PROGRESS
-- =====================================================
-- Convert user_progress with data transformations:
-- - completed_themes: JSON string to ARRAY
-- - total_pp: text to integer
-- - Add chapters_completed and themes_completed
-- - Skip records where user_id doesn't exist in users table

-- Added WHERE clause to skip user_progress for non-existent users
INSERT INTO user_progress (
  id, 
  user_id, 
  current_theme, 
  current_chapter, 
  completed_themes, 
  total_chapters_completed,
  chapters_completed,
  themes_completed,
  last_interaction, 
  created_at, 
  updated_at, 
  theme_progress, 
  total_pp
)
SELECT 
  id::uuid,
  user_id::uuid,
  current_theme,
  current_chapter::integer,
  -- Handle malformed JSON by defaulting to empty array
  CASE 
    WHEN completed_themes IS NULL OR completed_themes = '' OR completed_themes = '"{]}"' OR completed_themes = '[]' THEN ARRAY[]::text[]
    WHEN completed_themes ~ '^\[.*\]$' THEN 
      (SELECT ARRAY(SELECT jsonb_array_elements_text(completed_themes::jsonb)))::text[]
    ELSE ARRAY[]::text[]
  END AS completed_themes,
  total_chapters_completed::integer,
  total_chapters_completed::integer AS chapters_completed,
  0 AS themes_completed,
  last_interaction::timestamptz,
  created_at::timestamptz,
  updated_at::timestamptz,
  theme_progress::jsonb,
  COALESCE(total_pp::integer, 0)
FROM (VALUES
  ('02df9c08-fee4-4949-a664-af34602704d8', 'edd16219-0c9d-4788-a316-d5c6f9f1353d', 'halloween', '3', '"{]}"', '2', '2025-10-23 09:13:49.199581+00', '2025-10-23 09:09:45.094308+00', '2025-10-23 09:13:49.317409+00', '{"halloween":{"completed":false,"current_chapter":3,"last_interaction":"2025-10-23T09:13:49.199581+00:00"}}', '72'),
  ('030bf9fd-65ab-4401-921e-c22820079b4e', '5d43c9b1-76e3-4e25-a51a-0835e073a259', 'horror', '1', '"{]}"', '0', '2025-09-30 16:02:10.013072+00', '2025-09-30 16:02:00.273169+00', '2025-09-30 16:02:10.013072+00', '{"horror":{"completed":false,"current_chapter":1,"last_interaction":"2025-09-30T16:02:10.013072+00:00"}}', '0')
  -- Add more user_progress records here...
) AS legacy_progress(id, user_id, current_theme, current_chapter, completed_themes, total_chapters_completed, last_interaction, created_at, updated_at, theme_progress, total_pp)
WHERE EXISTS (
  SELECT 1 FROM users WHERE users.id = legacy_progress.user_id::uuid
)
ON CONFLICT (user_id) DO UPDATE SET
  current_theme = EXCLUDED.current_theme,
  current_chapter = EXCLUDED.current_chapter,
  completed_themes = EXCLUDED.completed_themes,
  total_chapters_completed = EXCLUDED.total_chapters_completed,
  chapters_completed = EXCLUDED.chapters_completed,
  theme_progress = EXCLUDED.theme_progress,
  total_pp = EXCLUDED.total_pp,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 5. UPDATE CALCULATED FIELDS
-- =====================================================
-- Update themes_completed based on theme_progress

UPDATE user_progress
SET themes_completed = (
  SELECT COUNT(*)
  FROM jsonb_each(theme_progress) AS tp
  WHERE (tp.value->>'completed')::boolean = true
);

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (Run these to check import)
-- =====================================================
-- SELECT COUNT(*) FROM themes;
-- SELECT COUNT(*) FROM story_chapters;
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM user_progress;
-- SELECT * FROM themes WHERE is_event = true;
-- SELECT * FROM user_progress LIMIT 5;
