-- Add unique constraint to global_stats.stat_name for ON CONFLICT to work
ALTER TABLE public.global_stats ADD CONSTRAINT global_stats_stat_name_unique UNIQUE (stat_name);

-- Initialize default global stats
INSERT INTO public.global_stats (stat_name, stat_value) VALUES 
('total_users', 0),
('total_interactions', 0),
('total_chapters_completed', 0),
('total_themes_completed', 0)
ON CONFLICT (stat_name) DO NOTHING;
