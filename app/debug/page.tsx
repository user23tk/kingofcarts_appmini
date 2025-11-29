"use client"

import { useState, useEffect } from "react"
import { Suspense } from "react"
import { DebugDashboard } from "@/components/debug/debug-dashboard"
import { DebugAuth } from "@/components/debug/debug-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogOut, Crown } from "lucide-react"

export default function DebugPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = sessionStorage.getItem("debug_auth_token")
    if (token) {
      // Verify token is still valid
      fetch("/api/debug/verify-auth", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => {
          if (response.ok) {
            setIsAuthenticated(true)
          } else {
            sessionStorage.removeItem("debug_auth_token")
          }
        })
        .catch(() => {
          sessionStorage.removeItem("debug_auth_token")
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogout = () => {
    sessionStorage.removeItem("debug_auth_token")
    sessionStorage.removeItem("debug_selected_category")
    sessionStorage.removeItem("debug_selected_tool")
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-[300px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 animate-pulse" />
              Loading...
            </CardTitle>
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

  if (!isAuthenticated) {
    return <DebugAuth onAuthenticated={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <span className="font-bold text-card-foreground">King of Carts</span>
            <span className="text-muted-foreground hidden md:inline">Debug Dashboard</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-6">
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <CardTitle>Loading Dashboard...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          }
        >
          <DebugDashboard />
        </Suspense>
      </main>
    </div>
  )
}
