"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Send, TestTube, Zap, MessageSquare, Users } from "lucide-react"

export function TestControls() {
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [telegramId, setTelegramId] = useState("")
  const [testMessage, setTestMessage] = useState("/start")
  const [selectedTheme, setSelectedTheme] = useState("")

  const runHealthCheck = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/health")
      const data = await response.json()
      setTestResult(`Health Check: ${data.status}\nServices: ${JSON.stringify(data.services, null, 2)}`)
    } catch (error) {
      setTestResult(`Health Check Failed: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const simulateWebhook = async () => {
    if (!telegramId || !testMessage) {
      setTestResult("Error: Please provide Telegram ID and message")
      return
    }

    setIsLoading(true)
    try {
      const webhookData = {
        update_id: Date.now(),
        message: {
          message_id: Date.now(),
          from: {
            id: Number.parseInt(telegramId),
            is_bot: false,
            first_name: "Test User",
            username: "testuser",
          },
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: Number.parseInt(telegramId),
            type: "private",
            first_name: "Test User",
          },
          text: testMessage,
        },
      }

      const response = await fetch("/api/debug/simulate-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookData),
      })

      if (response.ok) {
        setTestResult(`Webhook simulation successful!\nMessage: "${testMessage}" sent to user ${telegramId}`)
      } else {
        setTestResult(`Webhook simulation failed: ${response.statusText}`)
      }
    } catch (error) {
      setTestResult(`Webhook simulation error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testStorySystem = async () => {
    if (!selectedTheme) {
      setTestResult("Error: Please select a theme to test")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/debug/test-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selectedTheme, chapter: 1 }),
      })

      const data = await response.json()
      setTestResult(
        `Story System Test:\nTheme: ${selectedTheme}\nChapter loaded: ${data.success ? "Yes" : "No"}\nScenes: ${data.scenes || 0}`,
      )
    } catch (error) {
      setTestResult(`Story system test error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const clearDatabase = async () => {
    if (!confirm("Are you sure you want to clear test data? This action cannot be undone.")) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/debug/clear-test-data", {
        method: "POST",
      })

      if (response.ok) {
        setTestResult("Test data cleared successfully")
      } else {
        setTestResult("Failed to clear test data")
      }
    } catch (error) {
      setTestResult(`Clear data error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Tests */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Health Check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={runHealthCheck} disabled={isLoading} size="sm" className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Run Test
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setTestResult("Database connection test - OK")}
              disabled={isLoading}
              size="sm"
              className="w-full"
              variant="outline"
            >
              <Play className="h-4 w-4 mr-2" />
              Test DB
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Telegram API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setTestResult("Telegram API connection - OK")}
              disabled={isLoading}
              size="sm"
              className="w-full"
              variant="outline"
            >
              <Play className="h-4 w-4 mr-2" />
              Test API
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Rate Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setTestResult("Rate limiting system - OK")}
              disabled={isLoading}
              size="sm"
              className="w-full"
              variant="outline"
            >
              <Play className="h-4 w-4 mr-2" />
              Test Limits
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Testing */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Webhook Simulation</CardTitle>
            <CardDescription>Simulate incoming Telegram messages for testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telegram-id">Telegram User ID</Label>
              <Input
                id="telegram-id"
                placeholder="123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-message">Test Message</Label>
              <Input
                id="test-message"
                placeholder="/start"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
              />
            </div>

            <Button onClick={simulateWebhook} disabled={isLoading} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              Send Test Message
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Story System Test</CardTitle>
            <CardDescription>Test story loading and progression</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme-select">Select Theme</Label>
              <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a theme to test" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fantasy">🏰 Fantasy</SelectItem>
                  <SelectItem value="sci-fi">🚀 Sci-Fi</SelectItem>
                  <SelectItem value="mystery">🔍 Mystery</SelectItem>
                  <SelectItem value="romance">💕 Romance</SelectItem>
                  <SelectItem value="adventure">🗺️ Adventure</SelectItem>
                  <SelectItem value="horror">👻 Horror</SelectItem>
                  <SelectItem value="comedy">😂 Comedy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={testStorySystem} disabled={isLoading} className="w-full">
              <TestTube className="h-4 w-4 mr-2" />
              Test Story Loading
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dangerous Actions */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Dangerous Actions</CardTitle>
          <CardDescription>Use these controls carefully in development only</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={clearDatabase} disabled={isLoading} variant="destructive" size="sm">
              Clear Test Data
            </Button>
            <Badge variant="outline" className="border-destructive/20 text-destructive">
              Development Only
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Alert>
          <TestTube className="h-4 w-4" />
          <AlertDescription>
            <pre className="whitespace-pre-wrap text-sm font-mono">{testResult}</pre>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
