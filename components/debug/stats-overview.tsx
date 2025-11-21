"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Users, MessageSquare, BookOpen, Trophy, TrendingUp, Clock, Trash2, AlertTriangle } from "lucide-react"
import { debugFetch } from "@/lib/debug/auth-helper"

interface GlobalStats {
  totalUsers: number
  totalInteractions: number
  totalChaptersCompleted: number
  totalThemesCompleted: number
}

export function StatsOverview() {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminKey, setAdminKey] = useState("")
  const [userId, setUserId] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [resetLoading, setResetLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await debugFetch("/api/debug/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetGlobalStats = async () => {
    if (!adminKey) {
      alert("Admin key required")
      return
    }

    if (!confirm("Are you sure you want to reset ALL global statistics? This action cannot be undone.")) {
      return
    }

    setResetLoading("global")
    try {
      const response = await debugFetch("/api/debug/reset-global-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey }),
      })

      const result = await response.json()
      if (response.ok) {
        alert("Global statistics reset successfully")
        fetchStats() // Refresh stats
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      alert("Failed to reset global statistics")
    } finally {
      setResetLoading(null)
    }
  }

  const handleResetUserStats = async () => {
    if (!adminKey || !userId) {
      alert("Admin key and User ID required")
      return
    }

    if (!confirm(`Are you sure you want to reset statistics for user ${userId}?`)) {
      return
    }

    setResetLoading("user")
    try {
      const response = await debugFetch("/api/debug/reset-user-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, userId }),
      })

      const result = await response.json()
      if (response.ok) {
        alert(`User statistics reset successfully for ${userId}`)
        setUserId("")
        fetchStats() // Refresh stats
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      alert("Failed to reset user statistics")
    } finally {
      setResetLoading(null)
    }
  }

  const handleResetAllUsers = async () => {
    if (!adminKey || confirmText !== "RESET ALL USERS") {
      alert("Admin key and exact confirmation text 'RESET ALL USERS' required")
      return
    }

    if (!confirm("⚠️ DANGER: This will reset ALL user statistics! Are you absolutely sure?")) {
      return
    }

    setResetLoading("all")
    try {
      const response = await debugFetch("/api/debug/reset-all-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, confirmText }),
      })

      const result = await response.json()
      if (response.ok) {
        alert("All user statistics reset successfully")
        setConfirmText("")
        fetchStats() // Refresh stats
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      alert("Failed to reset all user statistics")
    } finally {
      setResetLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse">
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      description: "Registered bot users",
      icon: Users,
      color: "text-chart-1",
    },
    {
      title: "Total Interactions",
      value: stats?.totalInteractions || 0,
      description: "Messages processed",
      icon: MessageSquare,
      color: "text-chart-2",
    },
    {
      title: "Chapters Completed",
      value: stats?.totalChaptersCompleted || 0,
      description: "Story chapters finished",
      icon: BookOpen,
      color: "text-chart-3",
    },
    {
      title: "Themes Completed",
      value: stats?.totalThemesCompleted || 0,
      description: "Full themes finished",
      icon: Trophy,
      color: "text-chart-4",
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engagement Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Engagement Rate
            </CardTitle>
            <CardDescription>Average interactions per user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {stats?.totalUsers ? (stats.totalInteractions / stats.totalUsers).toFixed(1) : "0.0"}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{stats?.totalUsers ? "Active" : "No Data"}</Badge>
              <span className="text-sm text-muted-foreground">interactions per user</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-chart-2" />
              Completion Rate
            </CardTitle>
            <CardDescription>Percentage of completed stories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {stats?.totalChaptersCompleted
                ? (((stats.totalThemesCompleted * 10) / stats.totalChaptersCompleted) * 100).toFixed(1)
                : "0.0"}
              %
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">{stats?.totalThemesCompleted || 0} themes completed</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Admin Actions
          </CardTitle>
          <CardDescription>Dangerous operations that reset user data. Use with extreme caution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Admin Key Input */}
          <div className="space-y-2">
            <Label htmlFor="adminKey">Admin Key</Label>
            <Input
              id="adminKey"
              type="password"
              placeholder="Enter admin key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
            />
          </div>

          {/* Reset Global Stats */}
          <div className="space-y-2">
            <Label>Reset Global Statistics</Label>
            <Button
              variant="destructive"
              onClick={handleResetGlobalStats}
              disabled={!adminKey || resetLoading === "global"}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {resetLoading === "global" ? "Resetting..." : "Reset Global Stats"}
            </Button>
          </div>

          {/* Reset Single User */}
          <div className="space-y-2">
            <Label htmlFor="userId">Reset Single User</Label>
            <div className="flex gap-2">
              <Input
                id="userId"
                placeholder="User ID or Telegram ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
              <Button
                variant="destructive"
                onClick={handleResetUserStats}
                disabled={!adminKey || !userId || resetLoading === "user"}
              >
                {resetLoading === "user" ? "Resetting..." : "Reset User"}
              </Button>
            </div>
          </div>

          {/* Reset All Users */}
          <div className="space-y-2">
            <Label htmlFor="confirmText">Reset ALL Users (Type: RESET ALL USERS)</Label>
            <div className="space-y-2">
              <Input
                id="confirmText"
                placeholder="Type: RESET ALL USERS"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <Button
                variant="destructive"
                onClick={handleResetAllUsers}
                disabled={!adminKey || confirmText !== "RESET ALL USERS" || resetLoading === "all"}
                className="w-full"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {resetLoading === "all" ? "Resetting..." : "⚠️ RESET ALL USERS ⚠️"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
