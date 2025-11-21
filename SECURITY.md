# 🔒 Security Documentation

## Overview

This document outlines the security measures implemented in the Telegram Storytelling Bot project.

## Authentication & Authorization

### Telegram WebApp Authentication
- **Method**: HMAC-SHA256 validation of Telegram initData
- **Implementation**: `lib/telegram/webapp-auth.ts`
- **Token Expiry**: 24 hours for initData validation
- **Session Duration**: 7 days for JWT tokens

### Debug Dashboard Authentication
- **Method**: Admin key validation via `DEBUG_ADMIN_KEY` environment variable
- **Implementation**: `lib/security/debug-auth.ts`
- **Rate Limiting**: 5 failed attempts per IP per 5 minutes
- **Token Expiry**: 24 hours for debug JWT tokens

### Service Role Usage
⚠️ **Important**: The application uses Supabase Service Role to bypass RLS by design.

**Rationale**:
- Authentication is handled by Telegram WebApp validation
- Server-side operations need to bypass RLS for performance
- User identity is validated via Telegram's HMAC-SHA256 signature

**Security Measures**:
- Service role client only used in server-side API routes
- Never exposed to client-side code
- All user operations validated via `MiniAppSecurity.validateRequest()`
- Comprehensive audit logging for all operations

**Production Recommendation**:
Consider migrating to Supabase JWT-based authentication with proper RLS policies for enhanced security.

## Row Level Security (RLS)

### Enabled Tables
All tables have RLS enabled:
- `users`
- `user_progress`
- `story_sessions`
- `themes`
- `story_chapters`
- `global_stats`
- `audit_logs`

### RLS Policies
See `scripts/SETUP_RLS_POLICIES.sql` for complete policy definitions.

**Note**: RLS policies are defined but bypassed by service role usage. They serve as a safety net if anon keys are used in the future.

## Database Security

### Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

**Tables with RLS:**
- `users` - Users can only read/update their own data
- `user_progress` - Users can only access their own progress
- `themes` - Public read, authenticated write
- `story_chapters` - Public read, authenticated write
- `event_leaderboard` - Public read, authenticated write
- `pp_audit` - Service role only (audit trail)
- `rate_limits` - Service role only
- `security_events` - Service role only
- `audit_logs` - Service role only

**Note**: `story_sessions` is defined in scripts but does NOT exist in production database.

### Foreign Key Constraints

**With CASCADE DELETE:**
- `user_progress.user_id` → `users.id` (CASCADE)
- `user_sessions.user_id` → `users.id` (CASCADE)
- `story_chapters.theme_id` → `themes.id` (CASCADE)
- `rate_limits.user_id` → `users.id` (CASCADE)
- `security_events.user_id` → `users.id` (CASCADE)
- `audit_logs.user_id` → `users.id` (CASCADE)

**Without FK (TEXT type mismatch):**
- `event_leaderboard.user_id` - Stores telegram_id as TEXT (no FK to users.id possible)
- `pp_audit.user_id` - Stores telegram_id as TEXT (no FK to users.id possible)

These tables use TEXT for `user_id` to store Telegram IDs directly, which prevents FK constraints but is intentional for the bot architecture. This means:
- No automatic CASCADE DELETE when users are deleted
- Manual cleanup required if user deletion is implemented
- Consider adding cleanup procedures or migrating to UUID references

### Database Consistency

**Deprecated Fields:**
- `total_chapters_completed` is DEPRECATED - use `chapters_completed` instead
- Kept for backward compatibility only
- Automatically synced via database trigger

**JSONB Synchronization:**
- `theme_progress` JSONB is automatically validated and synced
- Trigger `sync_theme_progress()` ensures aggregate columns match JSONB data
- Prevents data inconsistencies
- No manual synchronization needed

**Schema Alignment:**

The production database has some differences from script definitions:

1. **Type Mismatches**: `event_leaderboard.user_id` and `pp_audit.user_id` are TEXT instead of UUID
2. **Missing Tables**: `story_sessions` is not created in production
3. **Duplicate Columns**: `user_progress` has both `total_chapters_completed` (deprecated) and `chapters_completed` (current)

**Automatic Synchronization:**
- Script `029_align_with_real_database.sql` synchronizes duplicate columns
- Trigger `sync_theme_progress()` keeps JSONB in sync with aggregate columns

**Performance Indexes:**
- Composite index on `(chapters_completed, themes_completed, total_pp)` for leaderboard queries
- GIN index on `theme_progress` JSONB for fast JSON queries
- Standard indexes on all foreign keys

## Rate Limiting

### User Rate Limits
- **Daily Limit**: 20 requests (configurable via `RATE_LIMIT_DAILY_MAX`)
- **Hourly Limit**: 10 requests (configurable via `RATE_LIMIT_HOURLY_MAX`)
- **Burst Limit**: 3 requests per 60 seconds (configurable)
- **Implementation**: `lib/security/rate-limiter.ts`

### Debug Endpoint Rate Limits
- **Failed Auth Attempts**: 5 per IP per 5 minutes
- **Implementation**: `lib/security/debug-auth.ts`

### Bypass
Rate limiting can be disabled via `DISABLE_RATE_LIMITS=true` (development only).

## Security Headers

### Frame Embedding Policy

**Telegram Mini App Routes** (`/:path*`)
- ✅ **Allowed**: Embedding in Telegram clients
- CSP: `frame-ancestors 'self' https://*.telegram.org https://telegram.org https://web.telegram.org https://t.me`
- No `X-Frame-Options` header (would conflict with CSP and block Telegram)

**API Routes** (`/api/:path*`)
- ❌ **Blocked**: No iframe embedding
- `X-Frame-Options: DENY`
- CSP: `frame-ancestors 'none'`

**Debug Routes** (`/debug/:path*`)
- ❌ **Blocked**: No iframe embedding
- `X-Frame-Options: DENY`
- CSP: `frame-ancestors 'none'`

### Why This Configuration?

1. **Telegram Mini Apps** require iframe embedding from Telegram domains
2. **API endpoints** should never be embedded (clickjacking protection)
3. **Debug panel** should never be embedded (admin interface protection)

### Global Headers (All Routes)
- `Strict-Transport-Security`: Force HTTPS
- `X-Content-Type-Options`: Prevent MIME sniffing
- `X-XSS-Protection`: Enable XSS filtering
- `Referrer-Policy`: Control referrer information
- `Permissions-Policy`: Restrict browser features

### CORS Configuration

**Current Setup**
- No explicit CORS headers (Next.js defaults)
- API routes are same-origin by default

**Recommendations for Production**

If you need to allow cross-origin requests:

\`\`\`typescript
// middleware.ts or individual API routes
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Only for specific API routes that need CORS
  if (request.nextUrl.pathname.startsWith('/api/public')) {
    response.headers.set('Access-Control-Allow-Origin', 'https://yourdomain.com')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  
  return response
}
\`\`\`

⚠️ **Never use `Access-Control-Allow-Origin: *` in production**

## Input Validation

### Implemented Validations
- **User ID**: UUID format validation
- **Theme Names**: Alphanumeric and hyphens only
- **Choice IDs**: Alphanumeric and underscores only
- **Scene Index**: 0-9 range validation
- **Implementation**: `lib/security/miniapp-security.ts`

### SQL Injection Protection
- ✅ All queries use Supabase parameterized queries
- ✅ No raw SQL with user input
- ✅ Input sanitization before database operations

## Audit Logging

### Logged Events
- User authentication (Mini App)
- Debug dashboard access
- Failed authentication attempts
- Data modification operations (stats reset, test data deletion)
- Rate limit violations

### Audit Log Schema
\`\`\`sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### Implementation
- `lib/security/miniapp-security.ts` - `MiniAppSecurity.auditLog()`
- Automatic logging via `validateRequest()` method

## Debug Endpoints Security

### Protected Endpoints
All `/api/debug/*` endpoints require authentication:

| Endpoint | Auth Method | Rate Limited |
|----------|-------------|--------------|
| `/api/debug/users` | Admin Key | ✅ Yes |
| `/api/debug/clear-test-data` | Admin Key | ✅ Yes |
| `/api/debug/test-story` | Admin Key | ✅ Yes |
| `/api/debug/rate-limit-status` | Admin Key | ✅ Yes |
| `/api/debug/validate-stats` | Admin Key | ✅ Yes |
| `/api/debug/authenticate` | Admin Key (POST) | ✅ Yes |
| `/api/debug/verify-auth` | JWT Token | ❌ No |
| All others | Admin Key | ✅ Yes |

### Authentication Methods
1. **Header**: `x-admin-key: <your-admin-key>`
2. **Bearer Token**: `Authorization: Bearer <your-admin-key>`

### Centralized Auth
- Implementation: `lib/security/debug-auth.ts`
- Function: `requireDebugAuth(request)`
- Features:
  - Timing-safe string comparison
  - Failed attempt logging
  - IP-based rate limiting
  - Consistent error responses

## Environment Variables

### Required Security Variables
\`\`\`env
# Debug Authentication
DEBUG_ADMIN_KEY=<32-character-random-string>

# JWT Secret (dedicated secret recommended)
JWT_SECRET=<your-jwt-secret>

# Fallback to webhook secret if JWT_SECRET not set
TELEGRAM_WEBHOOK_SECRET=<your-webhook-secret>

# Rate Limiting
RATE_LIMIT_DAILY_MAX=20
RATE_LIMIT_HOURLY_MAX=10
RATE_LIMIT_BURST_MAX=3
RATE_LIMIT_BURST_WINDOW_SECONDS=60
DISABLE_RATE_LIMITS=false

# Supabase
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
\`\`\`

### Secret Generation
\`\`\`bash
# Generate DEBUG_ADMIN_KEY
node scripts/generate-admin-key.js

# Generate JWT_SECRET
openssl rand -base64 32
\`\`\`

## Webhook Security

### Telegram Webhook Validation
- **Method**: `X-Telegram-Bot-Api-Secret-Token` header validation
- **Implementation**: `app/api/telegram/route.tsx`
- **Token**: Set via `TELEGRAM_WEBHOOK_SECRET`

### Anti-Replay Protection
- **Implementation**: `lib/security/anti-replay.ts`
- **Method**: Callback token tracking
- **Expiry**: 5 minutes (configurable via `CALLBACK_TOKEN_EXPIRY_MINUTES`)

## Security Checklist

### Before Production Deployment

- [ ] Regenerate all secrets (`DEBUG_ADMIN_KEY`, `JWT_SECRET`)
- [ ] Ensure `DISABLE_RATE_LIMITS=false`
- [ ] Verify all debug endpoints require authentication
- [ ] Enable HTTPS (Strict-Transport-Security header)
- [ ] Review and test RLS policies
- [ ] Set up monitoring for failed auth attempts
- [ ] Configure proper CORS if needed
- [ ] Review audit logs regularly
- [ ] Set up alerts for suspicious activity
- [ ] Consider migrating to Supabase JWT auth with RLS

### Regular Maintenance

- [ ] Rotate `DEBUG_ADMIN_KEY` every 90 days
- [ ] Review audit logs weekly
- [ ] Monitor rate limit violations
- [ ] Update dependencies for security patches
- [ ] Review and update CSP policies as needed

## Incident Response

### Suspected Breach
1. Immediately rotate all secrets
2. Review audit logs for suspicious activity
3. Check rate limit violations
4. Verify webhook token hasn't been compromised
5. Review Supabase access logs

### Failed Auth Spike
1. Check audit logs for IP addresses
2. Verify rate limiting is working
3. Consider temporary IP blocking if needed
4. Investigate source of attacks

## Known Limitations

1. **Service Role Bypass**: RLS is bypassed by design - consider migration to JWT auth
2. **IP-Based Rate Limiting**: Can be bypassed with VPN/proxy rotation
3. **Debug Endpoints**: Should be removed or further restricted in production
4. **No WAF**: Consider adding Web Application Firewall for production

## Security Contacts

For security issues, please contact the development team immediately.

**Do not** open public GitHub issues for security vulnerabilities.

---

Last Updated: 2025-01-02
Version: 1.0.0
