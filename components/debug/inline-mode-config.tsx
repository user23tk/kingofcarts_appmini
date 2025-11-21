"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Share2, CheckCircle, AlertCircle, ExternalLink, MessageSquare } from "lucide-react"

export function InlineModeConfig() {
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [configStatus, setConfigStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [configResult, setConfigResult] = useState<any>(null)

  const handleConfigureInlineMode = async () => {
    setIsConfiguring(true)
    setConfigStatus("idle")

    try {
      const response = await fetch("/api/debug/configure-inline-mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (response.ok) {
        setConfigStatus("success")
        setStatusMessage("Bot commands configured successfully!")
        setConfigResult(result)
      } else {
        setConfigStatus("error")
        setStatusMessage(result.error || "Failed to configure inline mode")
      }
    } catch (error) {
      setConfigStatus("error")
      setStatusMessage("Network error occurred")
    } finally {
      setIsConfiguring(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Inline Mode Configuration
          </CardTitle>
          <CardDescription>Configure bot commands and get inline mode setup instructions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleConfigureInlineMode} disabled={isConfiguring} className="w-full">
            {isConfiguring ? (
              <>
                <Share2 className="h-4 w-4 mr-2 animate-spin" />
                Configuring...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                Configure Bot Commands & Get Inline Setup
              </>
            )}
          </Button>

          {configStatus !== "idle" && (
            <Alert className={configStatus === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              {configStatus === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={configStatus === "success" ? "text-green-800" : "text-red-800"}>
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {configResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>✅ Bot Commands Configured</CardTitle>
              <CardDescription>The following commands are now available in your bot menu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {configResult.commands?.map((command: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm font-mono bg-muted p-2 rounded">
                    <Badge variant="outline">{index + 1}</Badge>
                    {command}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Inline Mode Setup Instructions
              </CardTitle>
              <CardDescription>Follow these steps to enable inline mode in @BotFather</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {configResult.inlineMode?.instructions?.map((instruction: string, index: number) => (
                  <div key={index} className="flex items-start gap-3">
                    {instruction.startsWith("🔧") || instruction.startsWith("🎯") ? (
                      <div className="font-semibold text-blue-600">{instruction}</div>
                    ) : instruction === "" ? (
                      <div className="h-2" />
                    ) : (
                      <>
                        {instruction.match(/^\d+\./) && (
                          <Badge
                            variant="outline"
                            className="mt-0.5 min-w-6 h-6 flex items-center justify-center text-xs"
                          >
                            {instruction.match(/^\d+/)?.[0]}
                          </Badge>
                        )}
                        <div className="text-sm">{instruction}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2">🎯 Inline Mode Features:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {configResult.inlineMode?.features?.map((feature: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open @BotFather
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>📖 How Inline Mode Works</CardTitle>
          <CardDescription>Understanding the sharing functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                1
              </Badge>
              <div>
                <p className="font-medium">Users click "Share" buttons</p>
                <p className="text-sm text-muted-foreground">Available in main menu, stats, and theme selection</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                2
              </Badge>
              <div>
                <p className="font-medium">Type keywords in any chat</p>
                <p className="text-sm text-muted-foreground">
                  Keywords: "fantasia", "progressi", "sfida", "invita" trigger different content
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                3
              </Badge>
              <div>
                <p className="font-medium">Select and share personalized content</p>
                <p className="text-sm text-muted-foreground">
                  Content adapts based on user progress and includes action buttons
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                4
              </Badge>
              <div>
                <p className="font-medium">Friends see invitation and can join</p>
                <p className="text-sm text-muted-foreground">Direct links to start the bot and view leaderboard</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
