import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

/**
 * Migration checklist endpoint
 * Verifies all steps are completed for production migration
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  const checks = []
  let allPassed = true

  try {
    // Check 1: Bot Token
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const hasBotToken = !!botToken
    checks.push({
      step: "1. Bot Token",
      status: hasBotToken ? "✅ Configured" : "❌ Missing",
      details: hasBotToken ? "TELEGRAM_BOT_TOKEN is set" : "Add TELEGRAM_BOT_TOKEN environment variable",
    })
    if (!hasBotToken) allPassed = false

    // Check 2: Bot Configuration
    const botUsername = process.env.BOT_USERNAME
    const botDisplayName = process.env.BOT_DISPLAY_NAME
    const hasBotConfig = !!botUsername && !!botDisplayName
    checks.push({
      step: "2. Bot Configuration",
      status: hasBotConfig ? "✅ Configured" : "⚠️ Using defaults",
      details: {
        username: botUsername || "kingofcarts_betabot (default)",
        displayName: botDisplayName || "King of Carts (default)",
      },
    })

    // Check 3: Webhook Secret
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    const hasWebhookSecret = !!webhookSecret
    checks.push({
      step: "3. Webhook Secret",
      status: hasWebhookSecret ? "✅ Configured" : "❌ Missing",
      details: hasWebhookSecret ? "TELEGRAM_WEBHOOK_SECRET is set" : "Add TELEGRAM_WEBHOOK_SECRET for security",
    })
    if (!hasWebhookSecret) allPassed = false

    // Check 4: App Domain
    const appDomain = process.env.APP_DOMAIN
    const hasAppDomain = !!appDomain
    checks.push({
      step: "4. App Domain",
      status: hasAppDomain ? "✅ Configured" : "⚠️ Using auto-detect",
      details: appDomain || "Will auto-detect from request",
    })

    // Check 5: Bot API connectivity
    if (botToken) {
      try {
        const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
        const botInfo = await botInfoResponse.json()

        if (botInfo.ok) {
          checks.push({
            step: "5. Bot API Connection",
            status: "✅ Connected",
            details: {
              username: `@${botInfo.result.username}`,
              name: botInfo.result.first_name,
              id: botInfo.result.id,
              supportsInline: botInfo.result.supports_inline_queries,
            },
          })

          // Check 6: Inline Mode
          checks.push({
            step: "6. Inline Mode",
            status: botInfo.result.supports_inline_queries ? "✅ Enabled" : "❌ Disabled",
            details: botInfo.result.supports_inline_queries
              ? "Inline queries are supported"
              : "Enable inline mode on @BotFather with /setinline",
          })
          if (!botInfo.result.supports_inline_queries) allPassed = false

          // Check 7: Webhook Status
          const webhookResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
          const webhookInfo = await webhookResponse.json()

          const webhookConfigured = webhookInfo.ok && webhookInfo.result.url
          checks.push({
            step: "7. Webhook Configuration",
            status: webhookConfigured ? "✅ Configured" : "⚠️ Not set",
            details: {
              url: webhookInfo.result.url || "Not configured",
              pendingUpdates: webhookInfo.result.pending_update_count || 0,
              lastError: webhookInfo.result.last_error_message || "None",
            },
          })

          // Check 8: Commands
          const commandsResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMyCommands`)
          const commandsInfo = await commandsResponse.json()

          const hasCommands = commandsInfo.ok && commandsInfo.result.length > 0
          checks.push({
            step: "8. Bot Commands",
            status: hasCommands ? "✅ Configured" : "⚠️ Not set",
            details: hasCommands
              ? `${commandsInfo.result.length} commands configured`
              : "Run /api/debug/configure-bot to set commands",
          })
        } else {
          checks.push({
            step: "5. Bot API Connection",
            status: "❌ Failed",
            details: botInfo.description || "Invalid bot token",
          })
          allPassed = false
        }
      } catch (error) {
        checks.push({
          step: "5. Bot API Connection",
          status: "❌ Error",
          details: String(error),
        })
        allPassed = false
      }
    }

    // Check 9: Database
    checks.push({
      step: "9. Database (Supabase)",
      status: process.env.SUPABASE_URL ? "✅ Configured" : "❌ Missing",
      details: process.env.SUPABASE_URL ? "Supabase connection configured" : "Configure Supabase integration",
    })

    // Check 10: Redis/Cache
    checks.push({
      step: "10. Redis (Upstash)",
      status: process.env.KV_REST_API_URL ? "✅ Configured" : "⚠️ Optional",
      details: process.env.KV_REST_API_URL
        ? "Redis caching available"
        : "Optional - improves performance for rate limiting",
    })

    // Summary
    const summary = {
      overallStatus: allPassed ? "✅ Ready for Production" : "⚠️ Action Required",
      checksTotal: checks.length,
      checksPassed: checks.filter((c) => c.status.startsWith("✅")).length,
      checksWarning: checks.filter((c) => c.status.startsWith("⚠️")).length,
      checksFailed: checks.filter((c) => c.status.startsWith("❌")).length,
      readyForProduction: allPassed,
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary,
      checks,
      nextSteps: allPassed
        ? [
            "✅ All critical checks passed!",
            "📱 Test the bot with /start command",
            "🔍 Test inline mode by typing @botusername in any chat",
            "🎮 Test opening the Mini App",
            "📊 Verify user data is being saved correctly",
          ]
        : [
            "⚠️ Fix all failed checks (❌) first",
            "1. Update missing environment variables on Vercel",
            "2. Redeploy the application",
            "3. Run /api/debug/configure-bot to set up commands",
            "4. Enable inline mode on @BotFather if needed",
            "5. Run this check again to verify",
          ],
      documentation: {
        migrationGuide: "/docs/MIGRATION_TO_PRODUCTION.md",
        troubleshooting: "/TROUBLESHOOTING.md",
        configuration: "/docs/CONFIGURATION.md",
      },
    })
  } catch (error) {
    logger.error("Migration check failed", error)
    return NextResponse.json(
      {
        error: "Migration check failed",
        details: String(error),
        checks,
      },
      { status: 500 },
    )
  }
}
