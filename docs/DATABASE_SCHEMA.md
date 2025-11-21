# Database Schema Documentation

Complete database schema for King of Carts project.

## Tables

### users
Stores Telegram user information and progress.

### user_progress
Tracks user progress across themes and chapters.

### story_chapters
Contains story content and scenes.

### story_sessions
Active story sessions with current position.

### events
Special themed events with time limits.

### global_stats
Overall bot statistics and metrics.

### rate_limits
Rate limiting tracking per user.

### processed_callbacks
Anti-replay protection for callbacks.

### pp_audit_logs
Audit trail for PP (points) transactions.

For detailed schema definitions, see the SQL scripts in `/scripts/` directory.
