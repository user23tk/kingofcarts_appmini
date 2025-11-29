"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

// Tool components
import { StatsOverview } from "./stats-overview"
import { DatabaseViewer } from "./database-viewer"
import { SystemHealth } from "./system-health"
import { TestControls } from "./test-controls"
import { WebhookConfig } from "./webhook-config"
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

// New components
import { CategorySelector } from "./category-selector"
import { QuickStatsBar } from "./quick-stats-bar"
import { ToolTabs } from "./tool-tabs"

import { type DebugCategory, DEBUG_CATEGORIES, getCategoryById } from "@/lib/debug/categories"
import { RefreshCw, AlertTriangle } from "lucide-react"

// Map tool IDs to components
const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  stats: StatsOverview,
  database: DatabaseViewer,
  health: SystemHealth,
  testing: TestControls,
  webhook: WebhookConfig,
  commands: MenuCommandsConfig,
  migration: ThemeProgressManager,
  generator: StoryGenerator,
  import: JsonImport,
  events: EventContestManager,
  validator: StatsValidator,
  miniapp: MiniAppTester,
  rank: RankDebugger,
  "user-validator": UserValidator,
  giveaway: GiveawayManager,
}

export function DebugDashboard() {
  const [selectedCategory, setSelectedCategory] = useState<DebugCategory>(DEBUG_CATEGORIES[0])
  const [selectedTool, setSelectedTool] = useState<string>(DEBUG_CATEGORIES[0].tools[0].id)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Persist selection in sessionStorage
  useEffect(() => {
    const savedCategory = sessionStorage.getItem("debug_selected_category")
    const savedTool = sessionStorage.getItem("debug_selected_tool")

    if (savedCategory) {
      const category = getCategoryById(savedCategory)
      if (category) {
        setSelectedCategory(category)
        if (savedTool && category.tools.some((t) => t.id === savedTool)) {
          setSelectedTool(savedTool)
        } else {
          setSelectedTool(category.tools[0].id)
        }
      }
    }
  }, [])

  const handleCategoryChange = (category: DebugCategory) => {
    setSelectedCategory(category)
    setSelectedTool(category.tools[0].id)
    sessionStorage.setItem("debug_selected_category", category.id)
    sessionStorage.setItem("debug_selected_tool", category.tools[0].id)
  }

  const handleToolChange = (toolId: string) => {
    setSelectedTool(toolId)
    sessionStorage.setItem("debug_selected_tool", toolId)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setLastRefresh(new Date())
    setIsRefreshing(false)
  }

  const ToolComponent = TOOL_COMPONENTS[selectedTool]
  const currentTool = selectedCategory.tools.find((t) => t.id === selectedTool)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-card-foreground">Debug Dashboard</h1>
          <p className="text-muted-foreground">Monitor and test the King of Carts system</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">Updated: {lastRefresh.toLocaleTimeString()}</div>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <QuickStatsBar />

      {/* Category Selector and Tool Content */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Debug Tools
                {selectedCategory.isLegacy && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Legacy
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{selectedCategory.description}</CardDescription>
            </div>
            <CategorySelector selectedCategory={selectedCategory} onCategoryChange={handleCategoryChange} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Legacy Warning */}
          {selectedCategory.isLegacy && (
            <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-600">Legacy Tools</AlertTitle>
              <AlertDescription className="text-yellow-600/80">
                These tools are for the old bot with inline buttons. The mini app no longer uses these features.
                Consider removing them if the old bot is fully deprecated.
              </AlertDescription>
            </Alert>
          )}

          {/* Tool Tabs */}
          <ToolTabs tools={selectedCategory.tools} selectedTool={selectedTool} onToolChange={handleToolChange} />

          {/* Tool Content */}
          <div className="pt-4">
            {ToolComponent ? (
              <ToolComponent />
            ) : (
              <div className="text-center py-8 text-muted-foreground">Tool not found: {selectedTool}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "leaderboard", tool: "rank", label: "Leaderboard" },
              { id: "events", tool: "events", label: "Events" },
              { id: "events", tool: "giveaway", label: "Giveaway" },
              { id: "miniapp", tool: "miniapp", label: "Mini App" },
              { id: "content", tool: "generator", label: "Story Generator" },
              { id: "content", tool: "import", label: "JSON Import" },
            ].map((item) => (
              <Button
                key={`${item.id}-${item.tool}`}
                variant="outline"
                size="sm"
                onClick={() => {
                  const category = getCategoryById(item.id)
                  if (category) {
                    handleCategoryChange(category)
                    handleToolChange(item.tool)
                  }
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
