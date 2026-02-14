-- =====================================================
-- Migration: Chapter Generation Schema
-- Tabelle per lock e rate limiting generazione capitoli
-- =====================================================

-- 1. Tabella per lock di generazione (previene generazione concorrente)
CREATE TABLE IF NOT EXISTS public.chapter_generation_locks (
  lock_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index per pulizia lock scaduti
CREATE INDEX IF NOT EXISTS idx_gen_locks_expires ON public.chapter_generation_locks(expires_at);

-- 2. Tabella per tracking giornaliero (rate limiting 5/giorno/tema)
CREATE TABLE IF NOT EXISTS public.chapter_generation_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  theme TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index per query di conteggio giornaliero
CREATE INDEX IF NOT EXISTS idx_gen_daily_theme_date ON public.chapter_generation_daily(theme, generated_at);

-- 3. Aggiungi colonne a story_chapters per tracciare capitoli generati
ALTER TABLE public.story_chapters
  ADD COLUMN IF NOT EXISTS is_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS background_image_url TEXT;

-- 4. Pulisci lock scaduti automaticamente (funzione schedulabile con pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_generation_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM chapter_generation_locks WHERE expires_at < NOW();
END;
$$;

-- 5. RLS policies (permetti accesso solo tramite service role)
ALTER TABLE public.chapter_generation_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_generation_daily ENABLE ROW LEVEL SECURITY;

-- Service role ha accesso completo
CREATE POLICY "service_role_gen_locks" ON public.chapter_generation_locks
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_gen_daily" ON public.chapter_generation_daily
  FOR ALL USING (auth.role() = 'service_role');
