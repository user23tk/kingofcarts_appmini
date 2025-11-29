import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET
    const appDomain = (process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app").replace(/\/$/, "")

    if (!botToken) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 })
    }

    const steps = []

    // Step 1: Delete existing webhook to start fresh
    console.log("[v0] Step 1: Deleting old webhook...")
    const deleteResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`,
    )
    const deleteResult = await deleteResponse.json()
    steps.push({
      step: 1,
      action: "Delete old webhook",
      success: deleteResult.ok,
      details: deleteResult,
    })

    // Wait a bit for Telegram to process
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Step 2: Set new webhook with correct configuration
    console.log("[v0] Step 2: Setting up new webhook...")
    const webhookUrl = `${appDomain}/api/telegram`
    console.log("[v0] Webhook URL (normalized):", webhookUrl)

    const webhookResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ["message", "callback_query", "inline_query"],
        drop_pending_updates: true,
        max_connections: 40,
      }),
    })
    const webhookResult = await webhookResponse.json()
    steps.push({
      step: 2,
      action: "Configure webhook",
      success: webhookResult.ok,
      details: webhookResult,
      webhookUrl,
    })

    // Step 3: Configure bot commands
    console.log("[v0] Step 3: Setting up bot commands...")
    const commands = [
      { command: "start", description: "🎭 Inizia l'avventura con King of Carts" },
      { command: "continue", description: "▶️ Continua la storia corrente" },
      { command: "stats", description: "📊 Visualizza le tue statistiche" },
      { command: "leaderboard", description: "🏆 Visualizza la classifica globale" },
      { command: "reset", description: "🔄 Ricomincia il tema attuale" },
      { command: "help", description: "📖 Mostra i comandi disponibili" },
    ]

    const commandsResponse = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    })
    const commandsResult = await commandsResponse.json()
    steps.push({
      step: 3,
      action: "Configure bot commands",
      success: commandsResult.ok,
      details: commandsResult,
      commands: commands.length,
    })

    // Step 4: Verify inline mode status
    console.log("[v0] Step 4: Checking inline mode status...")
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const botInfo = await botInfoResponse.json()
    const inlineEnabled = botInfo.result?.supports_inline_queries

    steps.push({
      step: 4,
      action: "Check inline mode",
      success: inlineEnabled,
      details: {
        supports_inline_queries: inlineEnabled,
        username: botInfo.result?.username,
      },
      warning: !inlineEnabled
        ? "Inline mode NOT enabled. You must enable it manually via @BotFather using /setinline"
        : undefined,
    })

    // Step 5: Get final webhook info
    console.log("[v0] Step 5: Getting final webhook info...")
    const finalWebhookResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const finalWebhookInfo = await finalWebhookResponse.json()
    steps.push({
      step: 5,
      action: "Verify webhook setup",
      success: finalWebhookInfo.result?.url === webhookUrl,
      details: finalWebhookInfo.result,
    })

    const allSuccess = steps.every((s) => s.success !== false)
    const needsManualInlineSetup = !inlineEnabled

    return NextResponse.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      steps,
      summary: {
        webhook: webhookResult.ok ? "Configured ✓" : "Failed ✗",
        commands: commandsResult.ok ? `${commands.length} commands set ✓` : "Failed ✗",
        inlineMode: inlineEnabled ? "Enabled ✓" : "REQUIRES MANUAL SETUP ✗",
      },
      nextSteps: needsManualInlineSetup
        ? [
            "⚠️ IMPORTANT: Inline mode must be enabled manually",
            "1. Open Telegram and find @BotFather",
            "2. Send the command: /setinline",
            "3. Select your bot from the list",
            "4. Enter a placeholder text (e.g., 'Share your adventure...')",
            "5. Test /start command and inline queries (@kingofcarts_betabot)",
          ]
        : [
            "✅ Bot is fully configured and ready to use!",
            "Test /start command in the bot",
            "Test inline queries by typing @kingofcarts_betabot in any chat",
          ],
    })
  } catch (error) {
    console.error("[v0] Error in fix-bot:", error)
    return NextResponse.json(
      {
        error: "Failed to fix bot configuration",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
