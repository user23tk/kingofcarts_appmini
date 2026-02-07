# 🛠️ RPC Functions Documentation

This document lists all Remote Procedure Calls (RPC) enabled in the Supabase database for the **King of Carts** project.

## 👤 Core User & Progress

| Function | Signature | Description |
|----------|-----------|-------------|
| `get_user_rank` | `(p_user_id: uuid) -> integer` | Calculates and returns the user's global rank based on completed chapters. Updates the cached `rank` in `user_progress`. |
| `get_leaderboard` | `(limit_count: int default 100) -> table` | Returns global leaderboard (user_id, username, photo, chapters, rank). |
| `update_theme_progress` | `(p_user_id: uuid, p_theme_id: text) -> void` | Marks a theme as completed in the `completed_themes` array. |
| `check_rate_limit` | `(p_user_id: uuid, p_daily_limit: int, p_should_count: bool) -> jsonb` | Checks if user exceeded rate limits. Returns `{ allowed, current_count, limit }`. |

## 🏆 Event System

| Function | Signature | Description |
|----------|-----------|-------------|
| `get_active_event` | `() -> table` | Returns the currently active event theme (based on `themes.is_event = true` and dates). |
| `get_event_leaderboard_v2`| `(p_theme: text, p_limit: int) -> table` | Returns leaderboard for a specific event theme. |
| `update_event_leaderboard_atomic` | `(p_user_id: uuid, p_theme: text, p_pp_gained: int) -> void` | **Atomic UPSERT** to update user's PP and chapter count in event leaderboard. |
| `get_user_event_stats` | `(p_user_id: uuid, p_theme: text) -> table` | Returns specific user stats (rank, pp, chapters) for an event. |
| `deactivate_expired_events` | `() -> integer` | Sets `is_active = false` for events where `event_end_date < NOW()`. Used by Cron. |

## 🎁 Giveaway System

| Function | Signature | Description |
|----------|-----------|-------------|
| `calculate_user_tickets` | `(p_user_id: uuid, p_giveaway_id: uuid) -> jsonb` | Calculates total tickets available based on User's Total PP and Giveaway cost. |
| `allocate_giveaway_ticket` | `(p_giveaway_id: uuid, p_user_id: uuid) -> jsonb` | Atomically allocates a new ticket number from sequence. Checks limits. |
| `draw_giveaway_winner` | `(p_giveaway_id: uuid, p_admin_id: uuid) -> jsonb` | **Admin Only**. Randomly selects one winner from entries and closes the giveaway. |
| `get_active_giveaway_for_user` | `(p_user_id: uuid) -> jsonb` | Returns active giveaway details + user's ticket status + onboarding bonus status. |

## 🛡️ Security

| Function | Signature | Description |
|----------|-----------|-------------|
| `check_onboarding_bonus_status` | `(p_user_id: uuid) -> jsonb` | Checks if user is eligible for onboarding bonus. |
| `grant_onboarding_bonus` | `(p_user_id: uuid) -> jsonb` | Grants bonus PP. Idempotent (checks `onboarding_bonus_claimed` flag). |

---

*Generated: January 2026*
