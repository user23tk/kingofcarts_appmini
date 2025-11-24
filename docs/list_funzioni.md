[
  {
    "schema": "public",
    "function_name": "check_rate_limit",
    "arguments": "user_id_param uuid, daily_limit integer DEFAULT 20, should_count boolean DEFAULT true",
    "return_type": "bool"
  },
  {
    "schema": "public",
    "function_name": "check_rate_limit_enhanced",
    "arguments": "user_id_param uuid, daily_limit integer DEFAULT 20, ip_address_param inet DEFAULT NULL::inet, user_agent_param text DEFAULT NULL::text",
    "return_type": "bool"
  },
  {
    "schema": "public",
    "function_name": "cleanup_security_events",
    "arguments": "",
    "return_type": "void"
  },
  {
    "schema": "public",
    "function_name": "complete_chapter_atomic",
    "arguments": "p_user_id uuid, p_theme_key text, p_chapter_number integer, p_pp_gained integer, p_is_event boolean DEFAULT false",
    "return_type": "jsonb"
  },
  {
    "schema": "public",
    "function_name": "deactivate_expired_events",
    "arguments": "",
    "return_type": "void"
  },
  {
    "schema": "public",
    "function_name": "detect_suspicious_pp_patterns",
    "arguments": "",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_active_event",
    "arguments": "",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_all_theme_progress",
    "arguments": "p_user_id uuid",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_all_theme_progress",
    "arguments": "p_user_id text",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_dashboard_stats",
    "arguments": "p_user_id uuid",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_event_leaderboard",
    "arguments": "p_theme text, p_limit integer DEFAULT 100",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_leaderboard_stats",
    "arguments": "",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_players_with_better_score",
    "arguments": "user_chapters integer, user_themes integer, user_pp integer",
    "return_type": "int4"
  },
  {
    "schema": "public",
    "function_name": "get_theme_progress",
    "arguments": "user_progress_row user_progress, theme_name text",
    "return_type": "jsonb"
  },
  {
    "schema": "public",
    "function_name": "get_theme_progress",
    "arguments": "p_user_id uuid, p_theme_name text",
    "return_type": "jsonb"
  },
  {
    "schema": "public",
    "function_name": "get_theme_progress",
    "arguments": "p_user_id uuid",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_top_players",
    "arguments": "p_limit integer DEFAULT 100",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_user_event_rank",
    "arguments": "p_user_id text, p_theme text",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "get_user_rank",
    "arguments": "p_user_id uuid",
    "return_type": "record"
  },
  {
    "schema": "public",
    "function_name": "increment_global_stat",
    "arguments": "stat_name_param text, increment_by integer DEFAULT 1",
    "return_type": "void"
  },
  {
    "schema": "public",
    "function_name": "log_security_event",
    "arguments": "event_type_param text, user_id_param uuid DEFAULT NULL::uuid, telegram_id_param bigint DEFAULT NULL::bigint, ip_address_param inet DEFAULT NULL::inet, user_agent_param text DEFAULT NULL::text, details_param jsonb DEFAULT NULL::jsonb",
    "return_type": "void"
  },
  {
    "schema": "public",
    "function_name": "migrate_user_progress",
    "arguments": "",
    "return_type": "int4"
  },
  {
    "schema": "public",
    "function_name": "sync_duplicate_fields",
    "arguments": "",
    "return_type": "trigger"
  },
  {
    "schema": "public",
    "function_name": "sync_telegram_user_to_auth",
    "arguments": "p_telegram_id bigint, p_username text, p_first_name text, p_last_name text",
    "return_type": "uuid"
  },
  {
    "schema": "public",
    "function_name": "sync_theme_progress",
    "arguments": "",
    "return_type": "trigger"
  },
  {
    "schema": "public",
    "function_name": "update_chapter_completion",
    "arguments": "p_user_id uuid, p_theme_name text, p_chapter_number integer, p_pp_gained integer",
    "return_type": "jsonb"
  },
  {
    "schema": "public",
    "function_name": "update_event_leaderboard_atomic",
    "arguments": "p_user_id text, p_theme text, p_pp_gained integer, p_chapter_completed boolean DEFAULT false",
    "return_type": "void"
  },
  {
    "schema": "public",
    "function_name": "update_event_leaderboard_atomic",
    "arguments": "p_user_id text, p_theme text, p_pp_gained integer",
    "return_type": "void"
  },
  {
    "schema": "public",
    "function_name": "update_theme_progress",
    "arguments": "p_user_id uuid, p_theme text, p_chapter integer, p_completed boolean",
    "return_type": "void"
  },
  {
    "schema": "public",
    "function_name": "update_updated_at_column",
    "arguments": "",
    "return_type": "trigger"
  }
]