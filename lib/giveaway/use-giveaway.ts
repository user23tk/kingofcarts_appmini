"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import type { GiveawayWithUserData, AllocateTicketResponse } from "./types"

const fetcher = async (url: string, initData: string) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  })
  if (!response.ok) throw new Error("Failed to fetch")
  return response.json()
}

export function useGiveaway(initData: string | null) {
  const [isUsingTicket, setIsUsingTicket] = useState(false)
  const [isClaimingBonus, setIsClaimingBonus] = useState(false)

  const { data, error, isLoading, mutate } = useSWR<GiveawayWithUserData>(
    initData ? ["/api/miniapp/giveaway/active", initData] : null,
    ([url, init]) => fetcher(url, init),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    },
  )

  const useTicket = useCallback(async () => {
    if (!data?.giveaway?.id || !initData) return null

    setIsUsingTicket(true)
    try {
      const response = await fetch("/api/miniapp/giveaway/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          giveaway_id: data.giveaway.id,
        }),
      })

      const result: AllocateTicketResponse = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to allocate ticket")
      }

      // Refresh data
      await mutate()

      return result
    } finally {
      setIsUsingTicket(false)
    }
  }, [data?.giveaway?.id, initData, mutate])

  const claimOnboardingBonus = useCallback(async () => {
    if (!initData) return null

    setIsClaimingBonus(true)
    try {
      const response = await fetch("/api/miniapp/onboarding/bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to claim bonus")
      }

      // Refresh giveaway data to update PP count
      await mutate()

      return result
    } finally {
      setIsClaimingBonus(false)
    }
  }, [initData, mutate])

  return {
    giveaway: data?.giveaway || null,
    userData: data?.user_data || null,
    winner: data?.winner || null,
    isLoading,
    error,
    useTicket,
    isUsingTicket,
    claimOnboardingBonus,
    isClaimingBonus,
    refresh: mutate,
  }
}
