"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Eye, EyeOff } from "lucide-react"

export function useDebugAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const storedToken = sessionStorage.getItem("debug_auth_token")
    if (storedToken) {
      setToken(storedToken)
      setIsAuthenticated(true)
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem("debug_auth_token")
    setToken(null)
    setIsAuthenticated(false)
  }, [])

  return { token, isAuthenticated, logout }
}

interface DebugAuthProps {
  onAuthenticated: () => void
}

export function DebugAuth({ onAuthenticated }: DebugAuthProps) {
  const [adminKey, setAdminKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAuth = async () => {
    if (!adminKey.trim()) {
      setError("Admin key is required")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/debug/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey }),
      })

      if (response.ok) {
        // Store auth token in sessionStorage
        const { token } = await response.json()
        sessionStorage.setItem("debug_auth_token", token)
        onAuthenticated()
      } else {
        const { error } = await response.json()
        setError(error || "Invalid admin key")
      }
    } catch (err) {
      setError("Authentication failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAuth()
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Debug Dashboard Access</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your admin key to access the debug dashboard</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="adminKey" className="text-sm font-medium">
              Admin Key
            </label>
            <div className="relative">
              <Input
                id="adminKey"
                type={showKey ? "text" : "password"}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter admin key..."
                className="pr-10"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
                disabled={loading}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleAuth} className="w-full" disabled={loading}>
            {loading ? "Authenticating..." : "Access Dashboard"}
          </Button>

          <div className="text-xs text-muted-foreground text-center">
            This dashboard contains sensitive system information and should only be accessed by authorized
            administrators.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
