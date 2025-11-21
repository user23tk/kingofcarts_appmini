"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Smartphone, User, BarChart3, BookOpen, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

export function MiniAppTester() {
  const [userId, setUserId] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testEndpoint = async (endpoint: string, method = "GET") => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const url = userId ? `${endpoint}?userId=${userId}` : endpoint
      const response = await fetch(url, { method })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || `HTTP ${response.status}: ${response.statusText}`)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mini App Testing Suite
          </CardTitle>
          <CardDescription>Test Mini App API endpoints and functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">User ID (UUID)</Label>
            <Input
              id="userId"
              placeholder="745e730d-1ecb-4a04-8f82-b167c3a99530"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Enter a valid user UUID from the database to test authenticated endpoints
            </p>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="story">
                <BookOpen className="h-4 w-4 mr-2" />
                Story
              </TabsTrigger>
              <TabsTrigger value="leaderboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dashboard API</CardTitle>
                  <CardDescription>GET /api/miniapp/dashboard</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => testEndpoint("/api/miniapp/dashboard")}
                    disabled={loading || !userId}
                    className="w-full"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Test Dashboard API
                  </Button>
                  <p className="text-sm text-muted-foreground">Returns user stats, rank, active session, and events</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Profile API</CardTitle>
                  <CardDescription>GET /api/miniapp/profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => testEndpoint("/api/miniapp/profile")}
                    disabled={loading || !userId}
                    className="w-full"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Test Profile API
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Returns user profile, stats, achievements, and history
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="story" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Story Start API</CardTitle>
                  <CardDescription>POST /api/miniapp/story/start</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => testEndpoint("/api/miniapp/story/start", "POST")}
                    disabled={loading || !userId}
                    className="w-full"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Test Story Start API
                  </Button>
                  <p className="text-sm text-muted-foreground">Starts a new story session for the user</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Leaderboard API</CardTitle>
                  <CardDescription>GET /api/miniapp/leaderboard</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => testEndpoint("/api/miniapp/leaderboard")}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Test Leaderboard API
                  </Button>
                  <p className="text-sm text-muted-foreground">Returns top players and user rank</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-mono text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              API Response
              <Badge variant="outline" className="ml-auto">
                Success
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
