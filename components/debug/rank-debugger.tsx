"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, Sparkles, Trophy, BookOpen, Palette } from "lucide-react"

export function RankDebugger() {
  const [userId, setUserId] = useState("")
  const [telegramId, setTelegramId] = useState("")
  const [loading, setLoading] = useState(false)
  const [rpcResult, setRpcResult] = useState<any>(null)
  const [apiResult, setApiResult] = useState<any>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testUserRank = async () => {
    if (!userId && !telegramId) {
      setError("Please enter a User ID or Telegram ID")
      return
    }

    setLoading(true)
    setError(null)
    setUserStats(null)

    try {
      let userIdToTest = userId

      // If telegram ID provided, get user ID first
      if (telegramId && !userId) {
        const userResponse = await fetch(`/api/debug/get-user-by-telegram?telegramId=${telegramId}`)
        const userData = await userResponse.json()
        if (userData.error) {
          throw new Error(userData.error)
        }
        userIdToTest = userData.userId
        setUserId(userIdToTest)
      }

      // Test RPC directly
      const rpcResponse = await fetch("/api/debug/test-rank-rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdToTest }),
      })
      const rpcData = await rpcResponse.json()
      setRpcResult(rpcData)

      // Test API endpoint
      const apiResponse = await fetch(`/api/miniapp/dashboard?userId=${userIdToTest}`)
      const apiData = await apiResponse.json()
      setApiResult(apiData)

      // Get user stats from LeaderboardManager
      const statsResponse = await fetch("/api/debug/user-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdToTest }),
      })
      const statsData = await statsResponse.json()
      setUserStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test rank")
    } finally {
      setLoading(false)
    }
  }

  const expectedRank = rpcResult?.rank || 0
  const actualRank = apiResult?.user?.rank || 0
  const ranksMatch = expectedRank === actualRank

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Rank Calculation Debugger (PP-First)
        </CardTitle>
        <CardDescription>Test PP-based rank calculation and validate user stats</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Enter User ID (UUID)"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value)
              setTelegramId("")
            }}
          />
          <div className="text-center text-sm text-muted-foreground">OR</div>
          <Input
            placeholder="Enter Telegram ID"
            value={telegramId}
            onChange={(e) => {
              setTelegramId(e.target.value)
              setUserId("")
            }}
          />
          <Button onClick={testUserRank} disabled={loading} className="w-full">
            {loading ? "Testing..." : "Test Rank & Stats"}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md">
            <p className="text-sm font-medium">Error: {error}</p>
          </div>
        )}

        {rpcResult && apiResult && (
          <div className="space-y-4">
            {/* User Stats Summary */}
            {userStats && (
              <div className="bg-primary/10 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  User Stats (from LeaderboardManager)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">Total PP</p>
                      <p className="text-2xl font-bold">{userStats.totalPP || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Rank</p>
                      <p className="text-2xl font-bold">#{userStats.rank || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Themes</p>
                      <p className="text-lg font-semibold">{userStats.themesCompleted || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">Chapters</p>
                      <p className="text-lg font-semibold">{userStats.chaptersCompleted || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div>
                <h4 className="font-semibold mb-2">RPC Function Result:</h4>
                <pre className="text-xs bg-background p-2 rounded overflow-auto">
                  {JSON.stringify(rpcResult, null, 2)}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2">API Endpoint Result:</h4>
                <pre className="text-xs bg-background p-2 rounded overflow-auto">
                  {JSON.stringify(apiResult.user, null, 2)}
                </pre>
              </div>

              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div>
                  <p className="text-sm font-medium">RPC Rank: {expectedRank}</p>
                  <p className="text-sm font-medium">API Rank: {actualRank}</p>
                  <p className="text-sm font-medium">LeaderboardManager Rank: {userStats?.rank || 0}</p>
                </div>
                <Badge variant={ranksMatch && userStats?.rank === expectedRank ? "default" : "destructive"} className="flex items-center gap-1">
                  {ranksMatch && userStats?.rank === expectedRank ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      All Match
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      Mismatch
                    </>
                  )}
                </Badge>
              </div>

              {userStats?.rank === 0 && userStats?.totalPP === 0 && (
                <div className="p-3 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md">
                  <p className="text-sm">User has 0 PP - Not ranked in the PP-first leaderboard</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
