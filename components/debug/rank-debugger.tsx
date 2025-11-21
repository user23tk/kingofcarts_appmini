"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

export function RankDebugger() {
  const [userId, setUserId] = useState("")
  const [loading, setLoading] = useState(false)
  const [rpcResult, setRpcResult] = useState<any>(null)
  const [apiResult, setApiResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testUserRank = async () => {
    if (!userId) {
      setError("Please enter a User ID")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Test RPC directly
      const rpcResponse = await fetch("/api/debug/test-rank-rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const rpcData = await rpcResponse.json()
      setRpcResult(rpcData)

      // Test API endpoint
      const apiResponse = await fetch(`/api/miniapp/dashboard?userId=${userId}`)
      const apiData = await apiResponse.json()
      setApiResult(apiData)
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
          Rank Calculation Debugger
        </CardTitle>
        <CardDescription>Test rank calculation for specific users</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter User ID (UUID)"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex-1"
          />
          <Button onClick={testUserRank} disabled={loading}>
            {loading ? "Testing..." : "Test Rank"}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md">
            <p className="text-sm font-medium">Error: {error}</p>
          </div>
        )}

        {rpcResult && apiResult && (
          <div className="space-y-4">
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
                  <p className="text-sm font-medium">Expected Rank: {expectedRank}</p>
                  <p className="text-sm font-medium">Actual Rank: {actualRank}</p>
                </div>
                <Badge variant={ranksMatch ? "default" : "destructive"} className="flex items-center gap-1">
                  {ranksMatch ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Match
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      Mismatch
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
