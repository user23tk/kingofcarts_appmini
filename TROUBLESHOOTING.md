# Troubleshooting Guide - King of Carts Bot

## Quick Diagnostics

### 1. Check Bot Status
\`\`\`bash
curl https://v0-beta-3-mini-app.vercel.app/api/debug/bot-status
\`\`\`

This will show:
- ✓ Bot info and username
- ✓ Webhook configuration
- ✓ Inline mode status (CRITICAL)
- ✓ Configured commands
- ✓ Any errors or warnings

### 2. Auto-Fix Common Issues
\`\`\`bash
curl -X POST https://v0-beta-3-mini-app.vercel.app/api/debug/fix-bot
\`\`\`

This will automatically:
1. Delete old webhook
2. Configure new webhook with correct settings
3. Set up bot commands
4. Verify inline mode
5. Provide next steps if manual action needed

## Common Issues

### Issue 1: `/start` Command Not Working

**Symptoms:**
- Bot doesn't respond to /start
- No error messages

**Causes:**
1. Webhook not configured
2. Webhook secret mismatch
3. Pending updates blocking new messages

**Solution:**
\`\`\`bash
# Run auto-fix
curl -X POST https://v0-beta-3-mini-app.vercel.app/api/debug/fix-bot

# Or manually configure:
curl -X POST https://v0-beta-3-mini-app.vercel.app/api/debug/configure-webhook
\`\`\`

**Verify:**
- Send /start to bot in Telegram
- Check logs for "[v0] Processing message"

---

### Issue 2: Inline Queries Not Working

**Symptoms:**
- Typing `@your_bot text` in any chat shows nothing
- No inline results appear

**Causes:**
1. **MOST COMMON**: Inline mode NOT enabled in BotFather
2. Webhook doesn't include `inline_query` in `allowed_updates`
3. Bot doesn't have inline query handler

**Solution:**

**Step 1: Enable Inline Mode (REQUIRED)**
1. Open Telegram
2. Find @BotFather
3. Send: `/setinline`
4. Select your bot
5. Enter placeholder text: `Share your adventure...`

**Step 2: Configure Webhook**
\`\`\`bash
curl -X POST https://v0-beta-3-mini-app.vercel.app/api/debug/fix-bot
\`\`\`

**Step 3: Verify**
\`\`\`bash
curl https://v0-beta-3-mini-app.vercel.app/api/debug/bot-status
\`\`\`

Look for: `"supports_inline_queries": true`

**Test:**
- In any Telegram chat, type: `@kingofcarts_betabot test`
- You should see 5 inline results

---

### Issue 3: Commands List Empty in Bot Menu

**Symptoms:**
- Bot menu button shows no commands
- Commands work when typed manually

**Solution:**
\`\`\`bash
curl -X POST https://v0-beta-3-mini-app.vercel.app/api/debug/configure-inline-mode
\`\`\`

**Verify:**
- Open bot chat in Telegram
- Tap menu button (≡) next to input field
- Should see: /start, /continue, /stats, etc.

---

### Issue 4: Webhook Errors

**Symptoms:**
- Bot diagnostics shows `last_error_message`
- High `pending_update_count`

**Common Errors:**

**"Wrong response from webhook"**
- Webhook is returning invalid response
- Check logs for errors in `/api/telegram` route

**"Connection timeout"**
- Server is slow or not responding
- Check Vercel deployment status

**"Invalid SSL certificate"**
- Domain SSL issues
- Verify APP_DOMAIN in environment variables

**Solution:**
\`\`\`bash
# Reset webhook with fresh config
curl -X POST https://v0-beta-3-mini-app.vercel.app/api/debug/fix-bot
\`\`\`

---

## Environment Variables Checklist

Ensure these are set in Vercel:

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `TELEGRAM_BOT_TOKEN` | ✓ | `7891234567:ABC...` | Bot authentication |
| `TELEGRAM_WEBHOOK_SECRET` | ✓ | Random string | Webhook security |
| `APP_DOMAIN` | ✓ | `https://your-app.vercel.app` | Webhook URL |
| `BOT_USERNAME` | ✓ | `your_bot` | For inline queries |
| `BOT_DISPLAY_NAME` |  | `Your Bot` | Display name |
| `INLINE_CACHE_TIME` |  | `10` | Inline results cache |

---

## Manual Testing

### Test Webhook
\`\`\`bash
# Get webhook info
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"

# Expected response:
{
  "ok": true,
  "result": {
    "url": "https://your-app.vercel.app/api/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "allowed_updates": ["message", "callback_query", "inline_query"]
  }
}
\`\`\`

### Test Bot Info
\`\`\`bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"

# Check for:
"supports_inline_queries": true  // MUST be true for inline mode
\`\`\`

### Test Commands
\`\`\`bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMyCommands"

# Should return 6 commands
\`\`\`

---

## Debugging Steps

1. **Check bot status**: `GET /api/debug/bot-status`
2. **Review issues**: Look at `issues` and `recommendations` in response
3. **Run auto-fix**: `POST /api/debug/fix-bot`
4. **Enable inline manually** via @BotFather if needed
5. **Test in Telegram**: Send /start and try inline query
6. **Check logs**: Look for "[v0]" prefixed messages in Vercel logs

---

## Advanced: Inline Query Flow

When user types `@your_bot text`:

1. Telegram sends POST to `/api/telegram` with `update.inline_query`
2. Webhook validates secret token
3. `handleInlineQuery()` is called
4. Gets user stats from database
5. Creates 5 personalized results:
   - General invite
   - Share stats (if user has progress)
   - Challenge friends (if user has PP)
   - Invite to current theme (if playing)
   - Share leaderboard
6. Calls `bot.answerInlineQuery()` with results
7. User sees results in Telegram

**Debugging inline queries:**
- Check logs for: `"[v0] Received Telegram update"` with `inline_query`
- Look for: `"[v0] Created X inline query results"`
- Verify: `"[v0] Successfully answered inline query"`

If you don't see these logs when testing inline, the webhook is not receiving inline_query updates.

---

## Contact Support

If issues persist after following this guide:

1. Run diagnostics: `GET /api/debug/bot-status`
2. Save the full output
3. Check Vercel logs for "[v0]" errors
4. Include bot username and error details when reporting
