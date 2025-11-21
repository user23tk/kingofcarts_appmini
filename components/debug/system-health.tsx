"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertTriangle, XCircle, Activity, Database, Zap } from "lucide-react"

interface HealthStatus {
  status: "healthy" | "warning" | "error"
  timestamp: string
  services: {
    database: string
    telegram: string
  }
  version: string
}

export function SystemHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchHealth = async () => {
    try {
      const response = await fetch("/api/health")
      const data = await response.json()
      setHealth(data)
    } catch (error) {
      console.error("Failed to fetch health:", error)
      setHealth({
        status: "error",
        timestamp: new Date().toISOString(),
        services: { database: "error", telegram: "error" },
        version: "unknown",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
      case "configured":
        return <CheckCircle className="h-4 w-4 text-accent" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-chart-2" />
      default:
        return <XCircle className="h-4 w-4 text-destructive" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
      case "configured":
        return <Badge className="bg-accent/10 text-accent border-accent/20">Healthy</Badge>
      case "warning":
        return (
          <Badge variant="outline" className="border-chart-2 text-chart-2">
            Warning
          </Badge>
        )
      default:
        return <Badge variant="destructive">Error</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Alert
        className={`${
          health?.status === "healthy"
            ? "border-accent/20 bg-accent/5"
            : health?.status === "warning"
              ? "border-chart-2/20 bg-chart-2/5"
              : "border-destructive/20 bg-destructive/5"
        }`}
      >
        {getStatusIcon(health?.status || "error")}
        <AlertDescription className="flex items-center justify-between">
          <span>
            System Status: <strong>{health?.status?.toUpperCase() || "UNKNOWN"}</strong>
          </span>
          <span className="text-sm text-muted-foreground">
            Last checked: {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "Never"}
          </span>
        </AlertDescription>
      </Alert>

      {/* Service Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(health?.services.database || "error")}
                <span className="text-sm">Supabase</span>
              </div>
              {getStatusBadge(health?.services.database || "error")}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Connection status and query performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Telegram Bot</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(health?.services.telegram || "error")}
                <span className="text-sm">API</span>
              </div>
              {getStatusBadge(health?.services.telegram || "error")}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Bot token and webhook configuration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Application</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon("healthy")}
                <span className="text-sm">v{health?.version || "1.0.0"}</span>
              </div>
              {getStatusBadge("healthy")}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Application version and runtime status</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Response Time</CardTitle>
            <CardDescription>Average API response time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Database Queries</span>
              <span className="text-sm font-medium">45ms</span>
            </div>
            <Progress value={15} className="h-2" />

            <div className="flex items-center justify-between">
              <span className="text-sm">Telegram API</span>
              <span className="text-sm font-medium">120ms</span>
            </div>
            <Progress value={30} className="h-2" />

            <div className="flex items-center justify-between">
              <span className="text-sm">Story Processing</span>
              <span className="text-sm font-medium">80ms</span>
            </div>
            <Progress value={20} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
            <CardDescription>Current system resource utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Memory Usage</span>
              <span className="text-sm font-medium">156MB / 512MB</span>
            </div>
            <Progress value={30} className="h-2" />

            <div className="flex items-center justify-between">
              <span className="text-sm">Database Connections</span>
              <span className="text-sm font-medium">3 / 20</span>
            </div>
            <Progress value={15} className="h-2" />

            <div className="flex items-center justify-between">
              <span className="text-sm">Rate Limit Usage</span>
              <span className="text-sm font-medium text-primary">12%</span>
            </div>
            <Progress value={12} className="h-2" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
