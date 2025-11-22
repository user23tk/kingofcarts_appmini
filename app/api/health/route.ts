import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-singleton" // Use admin client for robust check

export const dynamic = "force-dynamic"

export async function GET() {
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      telegram: "unknown",
    },
    version: "1.0.1",
  }

  try {
    // Check database connection using Admin Client (more reliable for system checks)
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("global_stats").select("stat_name").limit(1)

    if (error) {
      console.error("[Health] DB Check Failed:", error)
      healthCheck.services.database = "error"
      throw error
    } else {
      healthCheck.services.database = "connected"
    }

    // Check Telegram bot token presence
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      healthCheck.services.telegram = "misconfigured"
      // Don't throw, just report
    } else {
      healthCheck.services.telegram = "configured"
    }

    return NextResponse.json(healthCheck)
  } catch (error) {
    console.error("[v0] Health check critical failure:", error)

    return NextResponse.json(
      {
        ...healthCheck,
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    )
  }
}
