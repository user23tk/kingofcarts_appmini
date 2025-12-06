import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireDebugAuth(request)
    if (!authCheck.authorized) {
      return authCheck.response!
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 })
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      checks: [],
      instructions: [],
    }

    // 1. Verifica info bot
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const botInfo = await botInfoResponse.json()
    
    if (!botInfo.ok) {
      return NextResponse.json({ 
        error: "Failed to get bot info", 
        details: botInfo 
      }, { status: 500 })
    }

    const inlineEnabled = botInfo.result?.supports_inline_queries === true
    
    results.bot = {
      username: botInfo.result?.username,
      firstName: botInfo.result?.first_name,
      canJoinGroups: botInfo.result?.can_join_groups,
      canReadAllGroupMessages: botInfo.result?.can_read_all_group_messages,
      supportsInlineQueries: inlineEnabled,
    }

    results.checks.push({
      name: "Bot Info",
      status: "OK",
      details: results.bot,
    })

    // 2. Verifica inline mode
    results.checks.push({
      name: "Inline Mode",
      status: inlineEnabled ? "✅ ENABLED" : "❌ DISABLED",
      critical: !inlineEnabled,
    })

    if (!inlineEnabled) {
      results.instructions.push({
        priority: "CRITICAL",
        action: "Abilita Inline Mode su BotFather",
        steps: [
          "1. Apri @BotFather su Telegram",
          "2. Invia /setinline",
          "3. Seleziona il tuo bot (@" + botInfo.result?.username + ")",
          "4. Invia un placeholder come: Cerca o condividi...",
          "5. Fatto! L'inline mode sarà attivo in pochi secondi",
        ],
      })
    }

    // 3. Verifica webhook
    const webhookResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const webhookInfo = await webhookResponse.json()

    const hasInlineInUpdates = webhookInfo.result?.allowed_updates?.includes("inline_query")

    results.webhook = {
      url: webhookInfo.result?.url,
      hasCustomCertificate: webhookInfo.result?.has_custom_certificate,
      pendingUpdateCount: webhookInfo.result?.pending_update_count,
      lastErrorDate: webhookInfo.result?.last_error_date 
        ? new Date(webhookInfo.result.last_error_date * 1000).toISOString() 
        : null,
      lastErrorMessage: webhookInfo.result?.last_error_message,
      maxConnections: webhookInfo.result?.max_connections,
      allowedUpdates: webhookInfo.result?.allowed_updates,
      hasInlineQuery: hasInlineInUpdates,
    }

    results.checks.push({
      name: "Webhook Configuration",
      status: webhookInfo.result?.url ? "✅ SET" : "❌ NOT SET",
      details: {
        url: webhookInfo.result?.url,
        allowedUpdates: webhookInfo.result?.allowed_updates,
      },
    })

    results.checks.push({
      name: "Inline Query in Webhook",
      status: hasInlineInUpdates ? "✅ INCLUDED" : "❌ MISSING",
      critical: !hasInlineInUpdates,
    })

    if (!hasInlineInUpdates && webhookInfo.result?.url) {
      results.instructions.push({
        priority: "HIGH",
        action: "Aggiorna webhook per includere inline_query",
        steps: [
          "Chiama POST /api/debug/fix-bot per riconfigurare il webhook",
          "Oppure chiama POST /api/debug/configure-webhook",
        ],
      })
    }

    // 4. Test inline query (simulato)
    results.checks.push({
      name: "Inline Mode Ready",
      status: inlineEnabled && hasInlineInUpdates ? "✅ READY" : "⚠️ NOT READY",
      message: inlineEnabled && hasInlineInUpdates 
        ? "L'inline mode dovrebbe funzionare. Prova a digitare @" + botInfo.result?.username + " in una chat."
        : "Segui le istruzioni sopra per abilitare l'inline mode.",
    })

    // Summary
    const allOk = inlineEnabled && hasInlineInUpdates
    results.summary = {
      inlineModeWorking: allOk,
      issuesFound: results.instructions.length,
      testCommand: allOk 
        ? `Prova: @${botInfo.result?.username} natale` 
        : "Prima risolvi i problemi sopra",
    }

    return NextResponse.json(results)

  } catch (error) {
    console.error("[check-inline] Error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
