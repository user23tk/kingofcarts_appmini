"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/miniapp/auth-context"
import { AnimatedBackground } from "@/components/miniapp/animated-background"
import { StoryScene } from "@/components/miniapp/story-scene"
import { StoryChoices } from "@/components/miniapp/story-choices"
import { StoryProgress } from "@/components/miniapp/story-progress"
import { RateLimitNotice } from "@/components/miniapp/rate-limit-notice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Home } from "lucide-react"
import { useBackButton, useHapticFeedback } from "@/lib/telegram/webapp-client"

interface Choice {
  id: string
  label: string
  pp_delta: number
}

interface Scene {
  index: number
  text: string
  choices: Choice[] | null
}

export default function StoryPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, initData } = useAuth()
  const theme = params.theme as string

  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitError, setRateLimitError] = useState<{ resetTime?: string } | null>(null)

  const [chapterNumber, setChapterNumber] = useState(1)
  const [chapterTitle, setChapterTitle] = useState("")
  const [currentScene, setCurrentScene] = useState<Scene | null>(null)
  const [sessionPP, setSessionPP] = useState(0)
  const [totalPP, setTotalPP] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [finaleText, setFinaleText] = useState("")

  const { impactOccurred } = useHapticFeedback()

  useBackButton(() => {
    if (confirm("Are you sure you want to leave? Your progress will be lost.")) {
      router.push("/themes")
    }
  })

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      loadStory()
    }
  }, [authLoading, isAuthenticated, user, theme])

  const loadStory = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setRateLimitError(null)

      const response = await fetch("/api/miniapp/story/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, theme }),
      })

      if (response.status === 429) {
        const errorData = await response.json()
        setRateLimitError({ resetTime: errorData.resetTime })
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to load story")
      }

      const data = await response.json()

      if (!data.scene || typeof data.scene.index !== "number" || !data.scene.text) {
        throw new Error("Invalid scene data received from server")
      }

      console.log("[v0] Scene loaded:", {
        index: data.scene.index,
        hasChoices: !!data.scene.choices,
        choicesCount: data.scene.choices?.length,
        choices: data.scene.choices,
      })

      setChapterNumber(data.chapterNumber)
      setChapterTitle(data.chapterTitle)
      setCurrentScene(data.scene)
      setSessionPP(data.sessionPP)
      setTotalPP(data.totalPP)
    } catch (err) {
      console.error("[v0] loadStory error:", err)
      setError(err instanceof Error ? err.message : "Failed to load story")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChoice = async (choiceId: string) => {
    if (!currentScene || isTransitioning) return

    try {
      setIsTransitioning(true)
      impactOccurred("medium")

      const response = await fetch("/api/miniapp/story/choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          theme,
          chapterNumber,
          sceneIndex: currentScene.index,
          choiceId,
        }),
      })

      if (response.status === 429) {
        const errorData = await response.json()
        setRateLimitError({ resetTime: errorData.resetTime })
        impactOccurred("heavy")
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process choice")
      }

      const data = await response.json()

      if (data.completed) {
        setIsCompleted(true)
        setFinaleText(data.finale.text)
        setTotalPP(data.totalPP)
        impactOccurred("heavy")
      } else {
        console.log("[v0] Next scene:", {
          index: data.nextScene.index,
          hasChoices: !!data.nextScene.choices,
          choicesCount: data.nextScene.choices?.length,
          choices: data.nextScene.choices,
        })
        setCurrentScene(data.nextScene)
        setSessionPP(data.sessionPP)
        setTotalPP(data.totalPP)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process choice")
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleContinueToNext = async () => {
    if (!currentScene || isTransitioning) return

    try {
      setIsTransitioning(true)
      impactOccurred("light")

      // For scene 0 (intro), automatically advance to scene 1
      const response = await fetch("/api/miniapp/story/choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          theme,
          chapterNumber,
          sceneIndex: currentScene.index,
          choiceId: "continue", // Special ID for auto-advance
        }),
      })

      if (response.status === 429) {
        const errorData = await response.json()
        setRateLimitError({ resetTime: errorData.resetTime })
        impactOccurred("heavy")
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to continue")
      }

      const data = await response.json()

      if (data.completed) {
        setIsCompleted(true)
        setFinaleText(data.finale.text)
        setTotalPP(data.totalPP)
        impactOccurred("heavy")
      } else {
        console.log("[v0] Next scene:", {
          index: data.nextScene.index,
          hasChoices: !!data.nextScene.choices,
          choicesCount: data.nextScene.choices?.length,
        })
        setCurrentScene(data.nextScene)
        setSessionPP(data.sessionPP)
        setTotalPP(data.totalPP)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue")
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleContinue = () => {
    impactOccurred("light")
    router.push("/themes")
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <AnimatedBackground theme={theme} intensity="low" variant="menu" />
        <div className="relative z-10 text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-lg text-white">Loading story...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <AnimatedBackground theme={theme} intensity="low" variant="menu" />
        <Card className="relative z-10 max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4 text-lg font-semibold text-destructive">Error</p>
            <p className="mb-6 text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => router.push("/themes")} variant="outline" className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={loadStory} className="flex-1">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (rateLimitError) {
    return (
      <>
        <RateLimitNotice resetTime={rateLimitError.resetTime} onDismiss={() => router.push("/")} />
        <div className="flex min-h-screen items-center justify-center p-4">
          <AnimatedBackground theme={theme} intensity="low" variant="menu" />
          <Card className="relative z-10 max-w-md">
            <CardContent className="p-6 text-center">
              <div className="mb-4 text-6xl">⏱️</div>
              <p className="mb-4 text-lg font-semibold">Daily Limit Reached</p>
              <p className="mb-6 text-muted-foreground">
                You've reached your daily story limit. Come back tomorrow to continue your adventure!
              </p>
              <Button onClick={() => router.push("/")} className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (isCompleted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <AnimatedBackground theme={theme} intensity="high" variant="scene" />
        <Card className="relative z-10 max-w-2xl">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="mb-4 text-6xl">🎉</div>
              <h2 className="mb-2 text-2xl font-bold">Chapter Complete!</h2>
              <p className="text-muted-foreground">You earned {sessionPP} PP this chapter</p>
            </div>
            <div className="mb-6 rounded-lg bg-muted/50 p-6">
              <p className="whitespace-pre-wrap text-lg leading-relaxed">{finaleText}</p>
            </div>
            <div className="mb-6 flex items-center justify-center gap-8 text-sm">
              <div>
                <p className="text-muted-foreground">Session PP</p>
                <p className="text-2xl font-bold text-primary">+{sessionPP}</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <p className="text-muted-foreground">Total PP</p>
                <p className="text-2xl font-bold">{totalPP}</p>
              </div>
            </div>
            <Button onClick={handleContinue} size="lg" className="w-full">
              <Home className="mr-2 h-5 w-5" />
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentScene) {
    return null
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      <AnimatedBackground theme={theme} intensity="medium" variant="scene" />

      <div className="relative z-10 h-full flex flex-col">
        {/* Progress Bar */}
        <div className="flex-shrink-0">
          <StoryProgress
            currentScene={currentScene.index}
            totalScenes={10}
            currentPP={totalPP}
            sessionPP={sessionPP}
            theme={theme}
            chapterNumber={chapterNumber}
            variant="top"
          />
        </div>

        {/* Story Content */}
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-6 min-h-0 overflow-y-auto">
          {/* Scene card - centered and properly sized */}
          <div className="w-full max-w-2xl mb-6">
            <StoryScene
              theme={theme}
              sceneText={currentScene.text}
              sceneIndex={currentScene.index}
              chapterNumber={chapterNumber}
            />
          </div>

          {/* Choices section */}
          <div className="w-full max-w-2xl">
            {currentScene.choices && currentScene.choices.length > 0 ? (
              <StoryChoices
                choices={currentScene.choices.map((c) => ({
                  id: c.id,
                  text: c.label,
                  emoji: "🎭",
                  ppDelta: c.pp_delta,
                }))}
                onSelect={handleChoice}
                disabled={isTransitioning}
              />
            ) : (
              <Button
                onClick={handleContinueToNext}
                disabled={isTransitioning}
                size="lg"
                className="w-full relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300 py-6"
              >
                {isTransitioning ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                ) : (
                  <span className="text-white font-medium text-lg">
                    {currentScene.index === 0 ? "🎬 Inizia l'avventura" : "📖 Continua"}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
