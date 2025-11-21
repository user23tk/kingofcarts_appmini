import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Check database connection
    const supabase = await createClient()
    const { data, error } = await supabase.from("global_stats").select("stat_name, stat_value").limit(1)

    if (error) {
      throw error
    }

    // Check Telegram bot token
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured")
    }

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        telegram: "configured",
      },
      version: "1.0.0",
    })
  } catch (error) {
    console.error("[v0] Health check failed:", error)

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    )
  }
}
