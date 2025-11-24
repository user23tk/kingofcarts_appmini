"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { User, Trophy, TrendingUp, AlertTriangle, Search, Loader2 } from "lucide-react"

interface UserValidatorData {
  identity: {
    userId: string
    telegramId: number
    username: string
  }
  ppAndRank: {
    totalPP: number
    rank: number | null
    percentile: number | null
    theoreticalPP: number
    ppConsistent: boolean
  }
  progress: {
    chaptersCompleted: number
    themesCompleted: number
    themeProgress: Array<{
      theme_id: string
      theme_name: string
      chapters_completed: number
      is_completed: boolean
    }>
  }
  validation: {
    isValid: boolean
    warnings: string[]
    lastUpdated: string
  }
}

export function UserValidator() {
  const [userId, setUserId] = useState("")
  const [telegramId, setTelegramId] = useState("")
  const [data, setData] = useState<UserValidatorData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleValidate = async () => {
    if (!userId && !telegramId) {
      setError("Please enter either User ID or Telegram ID")
      return
    }

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const params = new URLSearchParams()
      if (userId) params.append("userId", userId)
      if (telegramId) params.append("telegramId", telegramId)

      const adminKey = sessionStorage.getItem("debugAdminKey")
      const response = await fetch(`/api/debug/user-validator?${params}`, {
        headers: {
          Authorization: `Bearer ${adminKey}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to validate user")
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Validator (PP-First)
          </CardTitle>
          <CardDescription>Validate user statistics consistency with PP-first algorithm</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">User ID (UUID)</label>
              <Input
                placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value)
                  setTelegramId("")
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Telegram ID</label>
              <Input
                type="number"
                placeholder="e.g., 123456789"
                value={telegramId}
                onChange={(e) => {
                  setTelegramId(e.target.value)
                  setUserId("")
                }}
              />
            </div>
          </div>

          <Button onClick={handleValidate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Validate User
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-sm">{data.identity.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telegram ID:</span>
                <span className="font-mono">{data.identity.telegramId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username:</span>
                <span className="font-semibold">{data.identity.username}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                PP & Rank
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total PP:</span>
                <Badge variant="default" className="text-lg">
                  {data.ppAndRank.totalPP} PP
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Theoretical PP:</span>
                <Badge variant="outline" className="text-lg">
                  {data.ppAndRank.theoreticalPP} PP
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">PP Consistent:</span>
                <Badge variant={data.ppAndRank.ppConsistent ? "default" : "destructive"}>
                  {data.ppAndRank.ppConsistent ? "✓ Yes" : "✗ No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rank:</span>
                <span className="font-bold">#{data.ppAndRank.rank || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Percentile:</span>
                <span>{data.ppAndRank.percentile ? `Top ${data.ppAndRank.percentile}%` : "N/A"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-primary">{data.progress.chaptersCompleted}</div>
                  <div className="text-sm text-muted-foreground">Chapters Completed</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-primary">{data.progress.themesCompleted}</div>
                  <div className="text-sm text-muted-foreground">Themes Completed</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Theme Progress:</h4>
                {data.progress.themeProgress.map((theme) => (
                  <div key={theme.theme_id} className="flex justify-between items-center p-2 border rounded">
                    <span>{theme.theme_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{theme.chapters_completed} chapters</span>
                      {theme.is_completed && <Badge variant="default">Completed</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={data.validation.isValid ? "default" : "destructive"}>
                  {data.validation.isValid ? "✓ Valid" : "✗ Issues Found"}
                </Badge>
              </div>

              {data.validation.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-destructive">Warnings:</h4>
                  {data.validation.warnings.map((warning, i) => (
                    <Alert key={i} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Updated:</span>
                <span>{new Date(data.validation.lastUpdated).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
