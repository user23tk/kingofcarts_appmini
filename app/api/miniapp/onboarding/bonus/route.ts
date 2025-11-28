import { type NextRequest, NextResponse } from "next/server"
import { requireTelegramAuth } from "@/lib/miniapp/auth-middleware"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"
import type { OnboardingBonusResponse } from "@/lib/giveaway/types"

export const dynamic = "force-dynamic"

/**
 * POST /api/miniapp/onboarding/bonus
 * Claims the +200 PP onboarding bonus (idempotent)
 */
export async function POST(request: NextRequest) {
  const auth = await requireTelegramAuth(request)
  if (!auth.authorized) return auth.response

  const userId = auth.userId!

  try {
    const supabase = await createClient()

    // Call RPC to grant bonus (idempotent)
    const { data, error } = await supabase.rpc("grant_onboarding_bonus", {
      p_user_id: userId,
    })

    if (error) {
      logger.error("onboarding-bonus", "RPC error", { error: error.message, userId })
      return NextResponse.json({ error: "Failed to grant bonus" }, { status: 500 })
    }

    const result = data as OnboardingBonusResponse

    if (!result.success) {
      logger.info("onboarding-bonus", "Bonus not granted", {
        userId,
        reason: result.reason,
      })
      return NextResponse.json({
        success: false,
        reason: result.reason,
        total_pp: result.total_pp,
      })
    }

    logger.info("onboarding-bonus", "Bonus granted successfully", {
      userId,
      bonus_amount: result.bonus_amount,
      new_total_pp: result.new_total_pp,
    })

    return NextResponse.json({
      success: true,
      bonus_amount: result.bonus_amount,
      new_total_pp: result.new_total_pp,
      message: `+${result.bonus_amount} PP Bonus Benvenuto!`,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("onboarding-bonus", "Error granting bonus", { error: errorMessage, userId })
    return NextResponse.json({ error: "Failed to grant bonus" }, { status: 500 })
  }
}

/**
 * GET status of onboarding bonus (check if already claimed)
 */
export async function GET(request: NextRequest) {
  // For GET, we need to handle auth differently since there's no body
  // We'll accept initData as a query parameter
  const { searchParams } = new URL(request.url)
  const initData = searchParams.get("initData")

  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 })
  }

  // Create a mock request with body for auth
  const mockBody = { initData }
  const mockRequest = new Request(request.url, {
    method: "POST",
    body: JSON.stringify(mockBody),
    headers: request.headers,
  })

  const auth = await requireTelegramAuth(mockRequest as NextRequest)
  if (!auth.authorized) return auth.response

  const userId = auth.userId!

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc("check_onboarding_bonus_status", {
      p_user_id: userId,
    })

    if (error) {
      logger.error("onboarding-bonus-status", "RPC error", { error: error.message, userId })
      return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("onboarding-bonus-status", "Error checking status", { error: errorMessage, userId })
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
  }
}
