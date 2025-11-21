"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/miniapp/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Rocket, Search, Heart, Laugh, Skull, Zap, BarChart3, User, Trophy, Clock } from "lucide-react"
import { hapticFeedback } from "@/lib/telegram/webapp-client"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"

interface ThemeData {
  id: string
  name: string
  description: string
  emoji: string
  chapterCount: number
}

interface ActiveEvent {
  id: string
  theme_key: string
  event_name: string
  event_emoji: string
  pp_multiplier: number
  event_end_date: string
  description?: string
}

const THEME_ICONS: Record<string, any> = {
  fantasy: Sparkles,
  "sci-fi": Rocket,
  mystery: Search,
  romance: Heart,
  comedy: Laugh,
  horror: Skull,
  adventure: Zap,
}

const THEME_COLORS: Record<string, string> = {
  fantasy: "from-purple-500 to-pink-500",
  "sci-fi": "from-blue-500 to-cyan-500",
  mystery: "from-gray-600 to-gray-800",
  romance: "from-pink-400 to-rose-500",
  comedy: "from-yellow-400 to-orange-500",
  horror: "from-red-900 to-black",
  adventure: "from-green-500 to-emerald-600",
}

export default function ThemesPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [themes, setThemes] = useState<ThemeData[]>([])
  const [themesLoading, setThemesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [themesResponse, eventResponse] = await Promise.all([
          fetch("/api/miniapp/themes"),
          fetch("/api/leaderboard/event"),
        ])

        if (!themesResponse.ok) {
          throw new Error("Failed to fetch themes")
        }

        const themesData = await themesResponse.json()
        if (themesData.success && themesData.themes) {
          setThemes(themesData.themes)
        } else {
          throw new Error("Invalid response format")
        }

        if (eventResponse.ok) {
          const eventData = await eventResponse.json()
          if (eventData.activeEvent) {
            setActiveEvent(eventData.activeEvent)
            console.log("[v0] Active event found:", eventData.activeEvent)
          }
        }
      } catch (err) {
        console.error("[v0] Error fetching data:", err)
        setError(err instanceof Error ? err.message : "Failed to load themes")
      } finally {
        setThemesLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleThemeSelect = (themeId: string) => {
    hapticFeedback("light")
    router.push(`/story/${themeId}`)
  }

  const handleEventSelect = () => {
    if (activeEvent) {
      hapticFeedback("medium")
      router.push(`/story/${activeEvent.theme_key}`)
    }
  }

  if (isLoading || themesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="mb-4 text-destructive">Failed to load themes</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pb-20">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Choose Your Theme</h1>
            <p className="text-sm text-muted-foreground">
              {user?.firstName ? `Welcome back, ${user.firstName}!` : "Select a story to begin"}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              hapticFeedback("light")
              router.push("/profile")
            }}
          >
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {activeEvent && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-6">
          <Card
            className="cursor-pointer transition-all hover:shadow-xl active:scale-[0.98] bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/20 border-2 border-yellow-500/50"
            onClick={handleEventSelect}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="default" className="bg-yellow-500 text-black font-bold">
                  <Trophy className="w-3 h-3 mr-1" />
                  EVENTO ATTIVO
                </Badge>
                <Badge variant="secondary" className="bg-accent/50">
                  {activeEvent.pp_multiplier}x PP
                </Badge>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg">
                    <span className="text-4xl">{activeEvent.event_emoji}</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl mb-1">{activeEvent.event_name}</CardTitle>
                    <CardDescription className="text-sm">
                      {activeEvent.description || "Contest speciale con moltiplicatore PP!"}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Termina il:</span>
                  <span className="font-semibold">{new Date(activeEvent.event_end_date).toLocaleDateString()}</span>
                </div>
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                  Gioca Ora →
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {activeEvent && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Altri Temi</h2>
        </div>
      )}

      {/* Themes Grid */}
      <div className="grid grid-cols-1 gap-4">
        {themes
          .filter((theme) => !activeEvent || theme.id !== activeEvent.theme_key)
          .map((theme) => {
            const Icon = THEME_ICONS[theme.id] || Sparkles
            const color = THEME_COLORS[theme.id] || "from-gray-500 to-gray-700"

            return (
              <Card
                key={theme.id}
                className="cursor-pointer transition-all hover:shadow-lg active:scale-[0.98]"
                onClick={() => handleThemeSelect(theme.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}
                      >
                        <span className="text-2xl">{theme.emoji}</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">{theme.name}</CardTitle>
                        <CardDescription className="text-sm">{theme.description}</CardDescription>
                      </div>
                    </div>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Badge variant={theme.chapterCount > 0 ? "secondary" : "outline"} className="text-xs">
                      {theme.chapterCount > 0 ? `${theme.chapterCount} Chapters` : "Coming Soon"}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-8" disabled={theme.chapterCount === 0}>
                      {theme.chapterCount > 0 ? "Start →" : "Not Available"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-2xl items-center justify-around p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              hapticFeedback("light")
              router.push("/themes")
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Themes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              hapticFeedback("light")
              router.push("/leaderboard")
            }}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Leaderboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              hapticFeedback("light")
              router.push("/profile")
            }}
          >
            <User className="mr-2 h-4 w-4" />
            Profile
          </Button>
        </div>
      </div>
    </div>
  )
}
