"use client"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/miniapp/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, BookOpen, Trophy, TrendingUp, Play, Clock, Zap } from "lucide-react"
import { AnimatedBackground } from "@/components/miniapp/animated-background"
import { hapticFeedback } from "@/lib/telegram/webapp-client"
import { motion } from "framer-motion"
import useSWR from "swr"

interface DashboardData {
  user: {
    id: string
    username: string
    firstName: string
    totalPP: number
    rank: number
  }
  stats: {
    chaptersCompleted: number
    themesUnlocked: number
    totalThemes: number
    currentStreak: number
  }
  activeSession: {
    theme: string
    chapter: number
    scene: number
  } | null
  activeEvents: Array<{
    id: string
    theme: string
    multiplier: number
    endsAt: string
  }>
}

const fetcher = async (url: string) => {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || "Failed to fetch dashboard")
  }

  return response.json()
}

export default function MiniAppHome() {
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuth()
  const {
    data: dashboardData,
    error,
    isLoading: dataLoading,
    mutate,
  } = useSWR<DashboardData>(isAuthenticated && user?.id ? `/api/miniapp/dashboard?userId=${user.id}` : null, fetcher, {
    refreshInterval: 0, // Disabled automatic polling - only fetch on mount, focus, and manual refresh
    revalidateOnFocus: true, // Refetch when user returns to tab
    revalidateOnReconnect: true, // Refetch when connection is restored
    dedupingInterval: 300000, // 5 minutes - prevents duplicate requests within this window
    focusThrottleInterval: 60000, // Throttle focus revalidation to max once per minute
  })

  const loading = isLoading || dataLoading

  if (loading) {
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
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Dashboard</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => mutate()} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No data available</p>
          <Button onClick={() => mutate()} className="mt-4">
            Reload
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen pb-20">
      <AnimatedBackground theme={dashboardData.activeSession?.theme || "fantasy"} intensity="low" variant="menu" />

      <div className="relative z-10 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 flex justify-center"
        >
          <img src="/logo.png" alt="King of Carts - The Game" className="w-48 h-48 object-contain drop-shadow-2xl" />
        </motion.div>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center space-y-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-balance">Welcome back, {dashboardData.user.firstName}!</h1>
            <p className="text-muted-foreground mt-2">Continue your epic journey</p>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Trophy className="w-3 h-3 mr-1" />
              {dashboardData.user.rank === 0 ? "Non classificato" : `Rank #${dashboardData.user.rank}`}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Sparkles className="w-3 h-3 mr-1" />
              {dashboardData.user.totalPP} PP
            </Badge>
          </div>
        </motion.div>

        {dashboardData.activeEvents && dashboardData.activeEvents.length > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-6">
            <Card className="bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/20 backdrop-blur-sm border-2 border-yellow-500/50">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Contest Attivo!
                  </CardTitle>
                  <Badge className="bg-yellow-500 text-black font-bold">
                    {dashboardData.activeEvents[0].multiplier}x PP
                  </Badge>
                </div>
                <CardDescription className="text-white/90">
                  Guadagna più punti giocando al contest speciale
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardData.activeEvents.map((event) => {
                  return (
                    <div key={event.id} className="p-3 rounded-lg bg-background/80 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold capitalize text-lg">{event.theme}</p>
                        <Badge variant="default" className="bg-yellow-500 text-black">
                          {event.multiplier}x PP
                        </Badge>
                      </div>
                      {event.endsAt && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Clock className="w-4 h-4" />
                          <span>
                            Termina il{" "}
                            {new Date(event.endsAt).toLocaleDateString("it-IT", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      <Button
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                        onClick={() => {
                          hapticFeedback("medium")
                          router.push(`/story/${event.theme}`)
                        }}
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Gioca al Contest
                      </Button>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {dashboardData.activeSession &&
          !dashboardData.activeEvents?.some((e) => e.theme === dashboardData.activeSession?.theme) && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-6">
              <Card className="bg-primary/10 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Continue Your Story
                  </CardTitle>
                  <CardDescription>
                    {dashboardData.activeSession.theme} - Chapter {dashboardData.activeSession.chapter}, Scene{" "}
                    {dashboardData.activeSession.scene}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => {
                      hapticFeedback("medium")
                      router.push(`/story/${dashboardData.activeSession?.theme}`)
                    }}
                  >
                    Continue Adventure
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

        {!dashboardData.activeSession && !dashboardData.activeEvents?.length && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <Button
              size="lg"
              className="w-full h-14 text-lg"
              onClick={() => {
                hapticFeedback("medium")
                router.push("/themes")
              }}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Start New Adventure
            </Button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4 mb-6"
        >
          <Card className="bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <BookOpen className="h-5 w-5 text-primary" />
                <Badge variant="secondary">{dashboardData.stats.chaptersCompleted}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">Chapters</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card className="bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Sparkles className="h-5 w-5 text-secondary" />
                <Badge variant="secondary">
                  {dashboardData.stats.themesUnlocked}/{dashboardData.stats.totalThemes}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">Themes</p>
              <p className="text-xs text-muted-foreground">Unlocked</p>
            </CardContent>
          </Card>

          <Card className="bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Trophy className="h-5 w-5 text-accent" />
                <Badge variant="secondary">
                  {dashboardData.user.rank === 0 ? "N/A" : `#${dashboardData.user.rank}`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">Global Rank</p>
              <p className="text-xs text-muted-foreground">
                {dashboardData.user.rank === 0 ? "Completa una storia" : "Leaderboard"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-chart-1" />
                <Badge variant="secondary">{dashboardData.user.totalPP}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">Total PP</p>
              <p className="text-xs text-muted-foreground">Points earned</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
