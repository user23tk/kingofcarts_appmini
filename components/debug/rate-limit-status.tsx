"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, ShieldOff, AlertTriangle, Info } from "lucide-react"
import { debugFetch } from "@/lib/debug/auth-helper"

interface RateLimitStatusData {
  isDisabled: boolean
  config: {
    dailyLimit: number
    hourlyLimit: number
    burstLimit: number
    burstWindow: number
  }
}

export function RateLimitStatus() {
  const [status, setStatus] = useState<RateLimitStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await debugFetch("/api/debug/rate-limit-status")
      if (!response.ok) throw new Error("Failed to fetch rate limit status")

      const data = await response.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rate Limiting Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rate Limiting Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading rate limit status: {error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status?.isDisabled ? (
            <ShieldOff className="h-5 w-5 text-orange-500" />
          ) : (
            <Shield className="h-5 w-5 text-green-500" />
          )}
          Rate Limiting Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={status?.isDisabled ? "destructive" : "default"}>
            {status?.isDisabled ? "DISABLED" : "ENABLED"}
          </Badge>
        </div>

        {status?.isDisabled && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Rate limiting is currently disabled. All users can make unlimited requests. This
              should only be used for testing purposes.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Daily Limit:</span>
            <div className="text-muted-foreground">{status?.config.dailyLimit} requests/day</div>
          </div>
          <div>
            <span className="font-medium">Hourly Limit:</span>
            <div className="text-muted-foreground">{status?.config.hourlyLimit} requests/hour</div>
          </div>
          <div>
            <span className="font-medium">Burst Limit:</span>
            <div className="text-muted-foreground">{status?.config.burstLimit} requests</div>
          </div>
          <div>
            <span className="font-medium">Burst Window:</span>
            <div className="text-muted-foreground">{status?.config.burstWindow} seconds</div>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            To disable rate limiting for testing, set the environment variable{" "}
            <code className="bg-muted px-1 rounded">DISABLE_RATE_LIMITS=true</code>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
