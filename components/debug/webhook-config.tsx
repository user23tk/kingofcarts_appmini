"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Settings, CheckCircle, AlertCircle, ExternalLink, Copy } from "lucide-react"

export function WebhookConfig() {
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [configStatus, setConfigStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [webhookInfo, setWebhookInfo] = useState<any>(null)

  const handleConfigureWebhook = async () => {
    setIsConfiguring(true)
    setConfigStatus("idle")

    try {
      const response = await fetch("/api/debug/configure-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (response.ok) {
        setConfigStatus("success")
        setStatusMessage("Webhook configured successfully!")
        setWebhookInfo(result)
      } else {
        setConfigStatus("error")
        setStatusMessage(result.error || "Failed to configure webhook")
      }
    } catch (error) {
      setConfigStatus("error")
      setStatusMessage("Network error occurred")
    } finally {
      setIsConfiguring(false)
    }
  }

  const getCurrentWebhookUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/telegram`
    }
    return "/api/telegram"
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>Configure the Telegram webhook for your bot automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook Endpoint</Label>
            <div className="flex items-center gap-2">
              <Input id="current-webhook" value={getCurrentWebhookUrl()} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(getCurrentWebhookUrl())}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button onClick={handleConfigureWebhook} disabled={isConfiguring} className="w-full">
            {isConfiguring ? (
              <>
                <Settings className="h-4 w-4 mr-2 animate-spin" />
                Configuring...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Auto-Configure Webhook
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
                {webhookInfo && (
                  <div className="mt-2 text-xs">
                    <p>Webhook URL: {webhookInfo.webhookUrl}</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Setup Instructions</CardTitle>
          <CardDescription>Follow these steps to configure your Telegram bot webhook</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                1
              </Badge>
              <div>
                <p className="font-medium">Get your bot token</p>
                <p className="text-sm text-muted-foreground">Obtain your bot token from @BotFather on Telegram</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                2
              </Badge>
              <div>
                <p className="font-medium">Configure webhook URL</p>
                <p className="text-sm text-muted-foreground">
                  Use the format:{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url={getCurrentWebhookUrl()}
                  </code>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                3
              </Badge>
              <div>
                <p className="font-medium">Test the configuration</p>
                <p className="text-sm text-muted-foreground">
                  Send a message to your bot to verify the webhook is working
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://core.telegram.org/bots/api#setwebhook"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Telegram Webhook Documentation
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
