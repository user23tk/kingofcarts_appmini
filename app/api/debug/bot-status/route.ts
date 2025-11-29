import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    const appDomain = process.env.APP_DOMAIN

    console.log("[v0] Starting bot diagnostics...")

    if (!botToken) {
      return NextResponse.json(
        {
          error: "TELEGRAM_BOT_TOKEN not configured",
          status: "CRITICAL",
        },
        { status: 500 },
      )
    }

    // Get webhook info
    const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const webhookInfo = await webhookInfoResponse.json()

    // Get bot info
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const botInfo = await botInfoResponse.json()

    // Get current commands
    const commandsResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMyCommands`)
    const commandsInfo = await commandsResponse.json()

    // Check bot inline mode settings (not directly available via API, but we can infer)
    const botDescription = await fetch(`https://api.telegram.org/bot${botToken}/getMyDescription`)
    const descriptionInfo = await botDescription.json()

    const diagnostics = {
      timestamp: new Date().toISOString(),
      botInfo: {
        username: botInfo.result?.username,
        id: botInfo.result?.id,
        first_name: botInfo.result?.first_name,
        can_join_groups: botInfo.result?.can_join_groups,
        can_read_all_group_messages: botInfo.result?.can_read_all_group_messages,
        supports_inline_queries: botInfo.result?.supports_inline_queries, // KEY: This should be true
      },
      webhook: {
        url: webhookInfo.result?.url,
        has_custom_certificate: webhookInfo.result?.has_custom_certificate,
        pending_update_count: webhookInfo.result?.pending_update_count,
        last_error_date: webhookInfo.result?.last_error_date,
        last_error_message: webhookInfo.result?.last_error_message,
        max_connections: webhookInfo.result?.max_connections,
        allowed_updates: webhookInfo.result?.allowed_updates,
        ip_address: webhookInfo.result?.ip_address,
      },
      commands: {
        configured: commandsInfo.result || [],
        count: commandsInfo.result?.length || 0,
      },
      environment: {
        botToken: botToken ? "Configured ✓" : "Missing ✗",
        webhookSecret: webhookSecret ? "Configured ✓" : "Missing ✗",
        appDomain: appDomain || "Using default",
        expectedWebhookUrl: `${appDomain || "https://v0-telegram-storytelling-bot.vercel.app"}/api/telegram`,
      },
      description: descriptionInfo.result || {},
      issues: [] as string[],
      recommendations: [] as string[],
    }

    // Analyze issues
    if (!botInfo.result?.supports_inline_queries) {
      diagnostics.issues.push("❌ CRITICAL: Inline queries are NOT enabled for this bot")
      diagnostics.recommendations.push(
        "1. Open @BotFather on Telegram\n2. Send /setinline\n3. Select your bot\n4. Enter a placeholder text (e.g., 'Search stories...')",
      )
    }

    if (!webhookInfo.result?.url) {
      diagnostics.issues.push("❌ Webhook is not configured")
      diagnostics.recommendations.push("Call POST /api/debug/configure-webhook to set up the webhook")
    } else if (!webhookInfo.result.url.includes(appDomain || "v0-telegram-storytelling-bot")) {
      diagnostics.issues.push("⚠️ Webhook URL doesn't match APP_DOMAIN")
      diagnostics.recommendations.push("Update webhook with correct domain via POST /api/debug/configure-webhook")
    }

    if (webhookInfo.result?.last_error_message) {
      diagnostics.issues.push(`⚠️ Last webhook error: ${webhookInfo.result.last_error_message}`)
    }

    if (webhookInfo.result?.pending_update_count > 50) {
      diagnostics.issues.push(`⚠️ High pending updates: ${webhookInfo.result.pending_update_count}`)
      diagnostics.recommendations.push("Consider calling webhook setup with drop_pending_updates: true")
    }

    if (!webhookInfo.result?.allowed_updates?.includes("inline_query")) {
      diagnostics.issues.push("⚠️ inline_query not in allowed_updates")
      diagnostics.recommendations.push("Reconfigure webhook to include inline_query in allowed_updates")
    }

    if (commandsInfo.result?.length === 0) {
      diagnostics.issues.push("⚠️ No bot commands configured")
      diagnostics.recommendations.push("Call POST /api/debug/configure-inline-mode to set up commands")
    }

    // Overall status
    const criticalIssues = diagnostics.issues.filter((i) => i.includes("CRITICAL")).length
    const warningIssues = diagnostics.issues.filter((i) => i.includes("⚠️")).length

    diagnostics.status = criticalIssues > 0 ? "CRITICAL" : warningIssues > 0 ? "WARNING" : "HEALTHY"

    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error) {
    console.error("[v0] Error in bot diagnostics:", error)
    return NextResponse.json(
      {
        error: "Failed to run diagnostics",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
