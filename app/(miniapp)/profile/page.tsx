"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/miniapp/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, BookOpen, Sparkles, TrendingUp } from "lucide-react"
import { AnimatedBackground } from "@/components/miniapp/animated-background"
import { useBackButton, hapticFeedback } from "@/lib/telegram/webapp-client"
import { motion } from "framer-motion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTelegramWebApp } from "@/lib/telegram/webapp-client"

interface ProfileData {
  user: {
    id: string
    username: string
    firstName: string
    lastName: string
    totalPP: number
    rank: number
    joinedAt: string
  }
  themeProgress: Array<{
    theme: string
    chaptersCompleted: number
    totalChapters: number
    bestScore: number
    lastPlayed: string | null
  }>
  overallStats: {
    chaptersCompleted: number
    themesCompleted: number
    totalThemes: number
    totalPP: number
    rank: number
  }
}

const THEME_NAMES: Record<string, string> = {
  fantasy: "Fantasy",
  "sci-fi": "Sci-Fi",
  mystery: "Mystery",
  horror: "Horror",
  romance: "Romance",
  adventure: "Adventure",
  comedy: "Comedy",
}

const THEME_EMOJIS: Record<string, string> = {
  fantasy: "🏰",
  "sci-fi": "🚀",
  mystery: "🔍",
  horror: "👻",
  romance: "💕",
  adventure: "⚡",
  comedy: "😂",
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { user: tgUser } = useTelegramWebApp()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useBackButton(() => {
    router.push("/")
  })

  useEffect(() => {
    if (user?.id) {
      fetchProfile()
    }
  }, [user])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user?.id) {
        console.log("[v0] Profile page became visible, refreshing data")
        fetchProfile()
      }
    }

    const handleFocus = () => {
      if (user?.id) {
        console.log("[v0] Profile window focused, refreshing data")
        fetchProfile()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/miniapp/profile?userId=${user?.id}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      })
      const data = await response.json()
      console.log("[v0] Profile data received:", data)
      setProfileData(data)
    } catch (error) {
      console.error("[v0] Failed to fetch profile:", error)
    } finally {
      setLoading(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen pb-20">
      <AnimatedBackground theme="fantasy" intensity="low" variant="menu" />

      <div className="relative z-10 p-4">
        {/* Header */}
        <div className="mb-6 flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              hapticFeedback("light")
              router.push("/")
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Your adventure stats</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mb-6 bg-background/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarImage
                    src={tgUser?.photo_url || "/placeholder.svg"}
                    alt={profileData?.user.firstName || "User"}
                  />
                  <AvatarFallback className="bg-primary/20 text-xl font-bold text-primary">
                    {profileData?.user.firstName?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-xl">
                    {profileData?.user.firstName} {profileData?.user.lastName}
                  </CardTitle>
                  <CardDescription>@{profileData?.user.username || "anonymous"}</CardDescription>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Trophy className="w-3 h-3 mr-1" />
                      Rank #{profileData?.user.rank}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {profileData?.user.totalPP} PP
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4 mb-6"
        >
          <Card className="bg-background/80 backdrop-blur-sm col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-yellow-500" />
                  <p className="text-lg font-bold">Total PP</p>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {profileData?.overallStats.totalPP || 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Power Points earned</p>
            </CardContent>
          </Card>

          <Card className="bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <BookOpen className="h-5 w-5 text-secondary" />
                <Badge variant="secondary">{profileData?.overallStats.chaptersCompleted || 0}</Badge>
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
                <TrendingUp className="h-5 w-5 text-chart-1" />
                <Badge variant="secondary">#{profileData?.user.rank || "-"}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">Rank</p>
              <p className="text-xs text-muted-foreground">Global position</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
