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
import { OnboardingBonusModal } from "@/components/miniapp/onboarding-bonus-modal"

interface DashboardData {
  user: {
    id: string
    username: string
    firstName: string
    totalPP: number
    rank: number
    eventPP?: number
    eventRank?: number
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
    title: string
    description?: string
    emoji: string
    multiplier: number
    endsAt?: string
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
      <AnimatedBackground theme={(dashboardData.activeSession?.theme || "fantasy") as any} intensity="low" variant="menu" />

      {/* Onboarding Bonus Modal */}
      {user?.id && <OnboardingBonusModal userId={user.id} onClaimed={() => mutate()} />}

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
            <Card
              className="cursor-pointer transition-all hover:shadow-xl active:scale-[0.98] bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/20 border-2 border-yellow-500/50"
              onClick={() => {
                hapticFeedback("medium")
                const event = dashboardData.activeEvents[0]
                router.push(`/story/${event.theme}`)
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="default" className="bg-yellow-500 text-black font-bold">
                    <Trophy className="w-3 h-3 mr-1" />
                    EVENTO ATTIVO
                  </Badge>
                  <Badge variant="secondary" className="bg-accent/50">
                    {dashboardData.activeEvents[0].multiplier}x PP
                  </Badge>
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg">
                      <span className="text-4xl">{dashboardData.activeEvents[0].emoji}</span>
                    </div>
                    <div>
                      <CardTitle className="text-xl mb-1">{dashboardData.activeEvents[0].title}</CardTitle>
                      <CardDescription className="text-sm">
                        {dashboardData.activeEvents[0].description}
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
                    <span className="font-semibold">
                      {dashboardData.activeEvents[0].endsAt 
                        ? new Date(dashboardData.activeEvents[0].endsAt).toLocaleDateString('it-IT', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric' 
                          })
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                    Gioca Ora →
                  </Button>
                </div>
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

          <Card className="bg-background/80 backdrop-blur-sm col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-yellow-500" />
                  <p className="text-lg font-bold">Total PP</p>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {dashboardData.user.totalPP}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Power Points earned</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
