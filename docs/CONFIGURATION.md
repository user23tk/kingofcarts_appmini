# Configuration Guide

All configuration documentation has been moved here from the root directory.

## Environment Variables

Required environment variables for King of Carts:

### Telegram Bot
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `TELEGRAM_WEBHOOK_SECRET` - Secret for webhook validation
- `BOT_USERNAME` - Bot username (without @)
- `BOT_DISPLAY_NAME` - Display name for the bot

### Supabase Database
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Application Settings
- `APP_DOMAIN` - Your app domain
- `JWT_SECRET` - Secret for JWT tokens
- `LOG_LEVEL` - Logging level (info, debug, error)

### Rate Limiting
- `RATE_LIMIT_DAILY_MAX` - Max daily actions per user
- `RATE_LIMIT_HOURLY_MAX` - Max hourly actions per user
- `RATE_LIMIT_BURST_MAX` - Max burst actions
- `RATE_LIMIT_BURST_WINDOW_SECONDS` - Burst window in seconds
- `DISABLE_RATE_LIMITS` - Set to 'true' to disable rate limiting

### Debug Settings
- `DEBUG_ADMIN_KEY` - Admin key for debug panel access
- `CALLBACK_TOKEN_EXPIRY_MINUTES` - Callback token expiry time
- `INLINE_CACHE_TIME` - Inline query cache time in seconds
