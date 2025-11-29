"use client"

import { useState, useEffect } from "react"
import { Suspense } from "react"
import { DebugDashboard } from "@/components/debug/debug-dashboard"
import { DebugAuth } from "@/components/debug/debug-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

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
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
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
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <span className="font-bold text-card-foreground">🎭 King of Carts Debug Dashboard</span>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <span className="text-sm text-muted-foreground">System Monitoring & Testing</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="ml-4 bg-transparent">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6">
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
      </div>
    </div>
  )
}
