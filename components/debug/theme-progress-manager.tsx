"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RefreshCw, Database, Users, ArrowRight, CheckCircle, AlertTriangle } from "lucide-react"

interface MigrationStatus {
  totalUsers: number
  migratedUsers: number
  pendingUsers: number
  lastMigration: string | null
}

export function ThemeProgressManager() {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<string | null>(null)

  const fetchMigrationStatus = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/debug/migration-status")
      if (response.ok) {
        const data = await response.json()
        setMigrationStatus(data)
      }
    } catch (error) {
      console.error("Error fetching migration status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const runMigration = async () => {
    setIsMigrating(true)
    setMigrationResult(null)
    try {
      const response = await fetch("/api/debug/migrate-progress", { method: "POST" })
      const data = await response.json()

      if (response.ok) {
        setMigrationResult(`✅ Migration completed successfully! ${data.migratedCount} users migrated.`)
        await fetchMigrationStatus()
      } else {
        setMigrationResult(`❌ Migration failed: ${data.error}`)
      }
    } catch (error) {
      setMigrationResult(`❌ Migration error: ${error}`)
    } finally {
      setIsMigrating(false)
    }
  }

  useEffect(() => {
    fetchMigrationStatus()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Theme Progress Migration</h2>
          <p className="text-muted-foreground">Manage migration from single to multi-theme progress system</p>
        </div>
        <Button onClick={fetchMigrationStatus} disabled={isLoading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Migration Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Migration Status
          </CardTitle>
          <CardDescription>Current state of the theme progress migration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {migrationStatus ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{migrationStatus.totalUsers}</div>
                  <div className="text-sm text-muted-foreground">Total Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{migrationStatus.migratedUsers}</div>
                  <div className="text-sm text-muted-foreground">Migrated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{migrationStatus.pendingUsers}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Migration Progress</div>
                  <div className="text-sm text-muted-foreground">
                    {migrationStatus.migratedUsers}/{migrationStatus.totalUsers} users migrated
                  </div>
                </div>
                <Badge variant={migrationStatus.pendingUsers === 0 ? "default" : "secondary"}>
                  {migrationStatus.pendingUsers === 0 ? "Complete" : "In Progress"}
                </Badge>
              </div>

              {migrationStatus.lastMigration && (
                <div className="text-sm text-muted-foreground">
                  Last migration: {new Date(migrationStatus.lastMigration).toLocaleString()}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">Loading migration status...</div>
          )}
        </CardContent>
      </Card>

      {/* Migration Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Migration Actions
          </CardTitle>
          <CardDescription>Run migration to convert existing progress to theme-based system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {migrationStatus && migrationStatus.pendingUsers > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Migration Required</AlertTitle>
              <AlertDescription>
                {migrationStatus.pendingUsers} users need to be migrated to the new theme progress system.
              </AlertDescription>
            </Alert>
          )}

          {migrationStatus && migrationStatus.pendingUsers === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Migration Complete</AlertTitle>
              <AlertDescription>
                All users have been successfully migrated to the theme progress system.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4">
            <Button
              onClick={runMigration}
              disabled={isMigrating || migrationStatus?.pendingUsers === 0}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              {isMigrating ? "Migrating..." : "Run Migration"}
            </Button>
          </div>

          {migrationResult && (
            <Alert
              className={migrationResult.includes("✅") ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}
            >
              <AlertDescription>{migrationResult}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Migration Info */}
      <Card>
        <CardHeader>
          <CardTitle>What does migration do?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Converts single-theme progress to multi-theme progress system</p>
          <p>• Preserves existing progress data in new JSON format</p>
          <p>• Maintains compatibility with current user experience</p>
          <p>• Enables users to switch between themes while keeping individual progress</p>
          <p>• Updates leaderboard calculations to use new progress structure</p>
        </CardContent>
      </Card>
    </div>
  )
}
