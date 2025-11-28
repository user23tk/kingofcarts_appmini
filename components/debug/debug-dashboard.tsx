"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { StatsOverview } from "./stats-overview"
import { DatabaseViewer } from "./database-viewer"
import { SystemHealth } from "./system-health"
import { TestControls } from "./test-controls"
import { WebhookConfig } from "./webhook-config"
import { RateLimitStatus } from "./rate-limit-status"
import { MenuCommandsConfig } from "./menu-commands-config"
import { ThemeProgressManager } from "./theme-progress-manager"
import { StoryGenerator } from "./story-generator"
import { JsonImport } from "./json-import"
import { EventContestManager } from "./event-contest-manager"
import { StatsValidator } from "./stats-validator"
import { MiniAppTester } from "./miniapp-tester"
import { RankDebugger } from "./rank-debugger"
import { UserValidator } from "./user-validator"
import { GiveawayManager } from "./giveaway-manager"
import {
  Activity,
  Database,
  Heart,
  TestTube,
  RefreshCw,
  Settings,
  Menu,
  GitBranch,
  Sparkles,
  Upload,
  Trophy,
  CheckCircle2,
  Smartphone,
  Target,
  User,
  Gift,
} from "lucide-react"

export function DebugDashboard() {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setLastRefresh(new Date())
    setIsRefreshing(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-card-foreground">Debug Dashboard</h1>
          <p className="text-muted-foreground">Monitor and test the King of Carts Telegram bot</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">Last updated: {lastRefresh.toLocaleTimeString()}</div>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Alert className="border-accent/20 bg-accent/5">
        <Heart className="h-4 w-4 text-accent" />
        <AlertTitle className="text-primary font-semibold">System Status</AlertTitle>
        <AlertDescription className="text-foreground">
          All systems operational. Bot is responding normally to user interactions.
        </AlertDescription>
      </Alert>

      <RateLimitStatus />

      <Tabs defaultValue="stats" className="space-y-4">
        <TabsList className="grid w-full grid-cols-15">
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Testing
          </TabsTrigger>
          <TabsTrigger value="miniapp" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Mini App
          </TabsTrigger>
          <TabsTrigger value="rank" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Rank Debug
          </TabsTrigger>
          <TabsTrigger value="webhook" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="commands" className="flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Commands
          </TabsTrigger>
          <TabsTrigger value="migration" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Migration
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Story AI
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            JSON Import
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="validator" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Validator
          </TabsTrigger>
          <TabsTrigger value="user-validator" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            User Validator
          </TabsTrigger>
          <TabsTrigger value="giveaway" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Giveaway
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <StatsOverview />
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <DatabaseViewer />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <SystemHealth />
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <TestControls />
        </TabsContent>

        <TabsContent value="miniapp" className="space-y-4">
          <MiniAppTester />
        </TabsContent>

        <TabsContent value="rank" className="space-y-4">
          <RankDebugger />
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
          <WebhookConfig />
        </TabsContent>

        <TabsContent value="commands" className="space-y-4">
          <MenuCommandsConfig />
        </TabsContent>

        <TabsContent value="migration" className="space-y-4">
          <ThemeProgressManager />
        </TabsContent>

        <TabsContent value="generator" className="space-y-4">
          <StoryGenerator />
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <JsonImport />
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <EventContestManager />
        </TabsContent>

        <TabsContent value="validator" className="space-y-4">
          <StatsValidator />
        </TabsContent>

        <TabsContent value="user-validator" className="space-y-4">
          <UserValidator />
        </TabsContent>

        <TabsContent value="giveaway" className="space-y-4">
          <GiveawayManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
