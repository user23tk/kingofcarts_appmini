"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, Activity, Users, Calendar } from "lucide-react"

interface QuickStats {
  rateLimit: { status: string; isDisabled: boolean }
  systemHealth: string
  activeUsers: number
  activeEvent: { name: string; emoji: string } | null
}

export function QuickStatsBar() {
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const token = sessionStorage.getItem("debug_auth_token")
      if (!token) return

      try {
        // Fetch rate limit status
        const rateLimitRes = await fetch("/api/debug/rate-limit-status", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const rateLimitData = rateLimitRes.ok ? await rateLimitRes.json() : { isDisabled: false }

        // Fetch stats
        const statsRes = await fetch("/api/debug/stats", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const statsData = statsRes.ok ? await statsRes.json() : { userStats: { total: 0 }, activeEvent: null }

        setStats({
          rateLimit: {
            status: rateLimitData.isDisabled ? "Disabled" : "Normal",
            isDisabled: rateLimitData.isDisabled,
          },
          systemHealth: "Healthy",
          activeUsers: statsData.userStats?.total || 0,
          activeEvent: statsData.activeEvent || null,
        })
      } catch (error) {
        console.error("Failed to fetch quick stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-6 w-24" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Shield className="h-4 w-4" />
          Rate Limit
        </div>
        <div className={`font-semibold ${stats?.rateLimit.isDisabled ? "text-yellow-500" : "text-green-500"}`}>
          {stats?.rateLimit.status || "Unknown"}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Activity className="h-4 w-4" />
          System
        </div>
        <div className="font-semibold text-green-500">{stats?.systemHealth || "Unknown"}</div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Users className="h-4 w-4" />
          Users
        </div>
        <div className="font-semibold">{stats?.activeUsers?.toLocaleString() || 0}</div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Calendar className="h-4 w-4" />
          Event
        </div>
        <div className="font-semibold">
          {stats?.activeEvent ? (
            <span>
              {stats.activeEvent.emoji} {stats.activeEvent.name}
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </div>
      </Card>
    </div>
  )
}
