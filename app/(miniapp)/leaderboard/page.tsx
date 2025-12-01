"use client"

import { useState, useCallback } from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/miniapp/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Trophy, Medal, Crown, Users, BookOpen, Target, Zap, Clock, RefreshCw } from "lucide-react"
import { useBackButton, hapticFeedback } from "@/lib/telegram/webapp-client"
import { motion } from "framer-motion"
import useSWR from "swr"

interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  totalPP: number
  chaptersCompleted: number
  themesCompleted: number
  isCurrentUser: boolean
}

interface LeaderboardData {
  rankings: LeaderboardEntry[]
  userRank: {
    rank: number
    totalPlayers: number
  } | null
  stats: {
    totalPlayers: number
    averageChapters: number
    topScore: number
    completionRate: number
  }
}

interface EventLeaderboardEntry {
  rank: number
  user_id: string
  first_name: string
  total_pp: number
  chapters_completed: number
}

interface ActiveEvent {
  id: string
  theme_key: string
  event_name: string
  event_emoji: string
  pp_multiplier: number
  event_end_date: string
}

const fetcher = async (url: string) => {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  })
  if (!response.ok) {
    throw new Error("Failed to fetch")
  }
  return response.json()
}

export default function LeaderboardPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<"general" | "event">("general")
  const [isRefreshing, setIsRefreshing] = useState(false)

  useBackButton(() => {
    router.push("/")
  })

  const {
    data: leaderboardData,
    error: leaderboardError,
    isLoading: leaderboardLoading,
    mutate: mutateLeaderboard,
  } = useSWR(user?.id ? `/api/miniapp/leaderboard?userId=${user.id}&limit=100` : null, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 30000,
  })

  const {
    data: eventData,
    error: eventError,
    isLoading: eventLoading,
    mutate: mutateEvent,
  } = useSWR("/api/leaderboard/event", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  })

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true)
    hapticFeedback("light")
    try {
      await Promise.all([mutateLeaderboard(), mutateEvent()])
    } finally {
      setIsRefreshing(false)
    }
  }, [mutateLeaderboard, mutateEvent])

  const activeEvent = eventData?.activeEvent || null
  const eventLeaderboard: EventLeaderboardEntry[] = eventData?.players || []

  useEffect(() => {
    if (eventData) {
      console.log("[v0] [LeaderboardPage] Event data received:", {
        hasActiveEvent: !!eventData.activeEvent,
        playersCount: eventData.players?.length || 0,
        debug: eventData._debug,
      })
    }
  }, [eventData])

  useEffect(() => {
    if (activeEvent && activeTab === "general") {
      setActiveTab("event")
    } else if (!activeEvent && activeTab === "event") {
      setActiveTab("general")
    }
  }, [activeEvent])

  const loading = isLoading || leaderboardLoading || eventLoading
  const error = leaderboardError || eventError

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />
    return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
  }

  const hasPlayers = leaderboardData && leaderboardData.rankings.length > 0
  const hasEventPlayers = eventLeaderboard.length > 0

  return (
    <div className="relative min-h-screen pb-20">
      <div className="absolute inset-0 bg-[#17212B]" />

      <div className="relative z-10 p-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => {
                hapticFeedback("light")
                router.push("/")
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
              <p className="text-sm text-gray-400">
                {activeEvent ? "Contest e classifica globale" : "Top players worldwide"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "general" | "event")} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-[#242F3D]">
            <TabsTrigger value="general" className="data-[state=active]:bg-[#2AABEE]">
              <Trophy className="w-4 h-4 mr-2" />
              Generale
            </TabsTrigger>
            <TabsTrigger
              value="event"
              className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black"
              disabled={!activeEvent}
            >
              <Zap className="w-4 h-4 mr-2" />
              {activeEvent ? `${activeEvent.event_emoji} Contest` : "Nessun Contest"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <Card className="bg-[#242F3D] border-[#2C3847]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#FFD700]" />
                    Global Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{leaderboardData?.stats.totalPlayers || 0}</p>
                      <p className="text-xs text-gray-400">Total Players</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/20">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{leaderboardData?.stats.topScore || 0}</p>
                      <p className="text-xs text-gray-400">Top Score</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <BookOpen className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {leaderboardData?.stats.averageChapters
                          ? leaderboardData.stats.averageChapters.toFixed(1)
                          : "0.0"}
                      </p>
                      <p className="text-xs text-gray-400">Avg Chapters</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Target className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {leaderboardData?.stats.completionRate
                          ? `${(leaderboardData.stats.completionRate * 100).toFixed(1)}%`
                          : "0%"}
                      </p>
                      <p className="text-xs text-gray-400">Completion Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {leaderboardData && leaderboardData.rankings.length >= 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="text-center">
                    <div className="bg-[#242F3D] rounded-lg p-3 mb-2 border border-[#2C3847]">
                      <Medal className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-white truncate">
                        {leaderboardData.rankings[1]?.username || "N/A"}
                      </p>
                      <p className="text-xs text-[#FFD700]">{leaderboardData.rankings[1]?.totalPP || 0} PP</p>
                    </div>
                    <div className="h-16 bg-gray-400/20 rounded-t-lg" />
                  </div>

                  <div className="text-center">
                    <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-lg p-4 mb-2 border-2 border-yellow-500/50">
                      <Crown className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-white truncate">
                        {leaderboardData.rankings[0]?.username || "N/A"}
                      </p>
                      <p className="text-xs text-[#FFD700]">{leaderboardData.rankings[0]?.totalPP || 0} PP</p>
                    </div>
                    <div className="h-24 bg-yellow-500/20 rounded-t-lg" />
                  </div>

                  <div className="text-center">
                    <div className="bg-[#242F3D] rounded-lg p-3 mb-2 border border-[#2C3847]">
                      <Medal className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-white truncate">
                        {leaderboardData.rankings[2]?.username || "N/A"}
                      </p>
                      <p className="text-xs text-[#FFD700]">{leaderboardData.rankings[2]?.totalPP || 0} PP</p>
                    </div>
                    <div className="h-12 bg-amber-600/20 rounded-t-lg" />
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-[#242F3D] border-[#2C3847]">
                <CardHeader>
                  <CardTitle className="text-white">Top 100 Players</CardTitle>
                  <CardDescription className="text-gray-400">Classifica generale globale</CardDescription>
                </CardHeader>
                <CardContent>
                  {!hasPlayers ? (
                    <div className="text-center py-8">
                      <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No players yet. Be the first to play!</p>
                      <Button
                        className="mt-4"
                        onClick={() => {
                          hapticFeedback("medium")
                          router.push("/themes")
                        }}
                      >
                        Start Playing
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {leaderboardData.rankings.map((entry, index) => (
                        <motion.div
                          key={entry.userId}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            entry.isCurrentUser
                              ? "bg-[#2AABEE]/20 border border-[#2AABEE]/50"
                              : "bg-[#2C3847]/50 hover:bg-[#2C3847]"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-8">{getRankIcon(entry.rank)}</div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${entry.isCurrentUser ? "text-[#2AABEE]" : "text-white"}`}
                              >
                                {entry.username}
                                {entry.isCurrentUser && <span className="ml-2 text-xs">(You)</span>}
                              </p>
                              <p className="text-xs text-gray-400">
                                {entry.chaptersCompleted} chapters • {entry.themesCompleted} themes
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30">
                            {entry.totalPP} PP
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="event" className="space-y-6">
            {activeEvent && (
              <>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/20 border-2 border-yellow-500/50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-5xl">{activeEvent.event_emoji}</div>
                          <div>
                            <CardTitle className="text-white text-xl">{activeEvent.event_name}</CardTitle>
                            <CardDescription className="text-gray-300">Contest Speciale</CardDescription>
                          </div>
                        </div>
                        <Badge className="bg-yellow-500 text-black font-bold text-lg px-3 py-1">
                          {activeEvent.pp_multiplier}x PP
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-white">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Termina il: </span>
                        <span className="font-semibold">
                          {new Date(activeEvent.event_end_date).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="bg-[#242F3D] border-[#2C3847]">
                    <CardHeader>
                      <CardTitle className="text-white">Classifica Contest</CardTitle>
                      <CardDescription className="text-gray-400">
                        I punti di questo contest vengono aggiunti anche alla classifica generale
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!hasEventPlayers ? (
                        <div className="text-center py-8">
                          <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                          <p className="text-gray-400">Nessuno ha ancora giocato a questo contest!</p>
                          <p className="text-sm text-gray-500 mt-2">Sii il primo a partecipare!</p>
                          <Button
                            className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-black"
                            onClick={() => {
                              hapticFeedback("medium")
                              router.push(`/story/${activeEvent.theme_key}`)
                            }}
                          >
                            Gioca Ora
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {eventLeaderboard.map((entry, index) => {
                            const isCurrentUser = entry.user_id === user?.id
                            return (
                              <motion.div
                                key={entry.user_id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.02 }}
                                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                                  isCurrentUser
                                    ? "bg-yellow-500/20 border border-yellow-500/50"
                                    : "bg-[#2C3847]/50 hover:bg-[#2C3847]"
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0 w-8">{getRankIcon(entry.rank)}</div>
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={`text-sm font-medium truncate ${isCurrentUser ? "text-yellow-500" : "text-white"}`}
                                    >
                                      {entry.first_name}
                                      {isCurrentUser && <span className="ml-2 text-xs">(Tu)</span>}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {entry.chapters_completed || 0} capitoli completati
                                    </p>
                                  </div>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-bold"
                                >
                                  {entry.total_pp} PP
                                </Badge>
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {leaderboardData?.userRank && leaderboardData.userRank.rank > 0 && (
          <div className="sticky bottom-20 left-0 right-0 p-4 z-30">
            <Card className="bg-[#242F3D]/95 backdrop-blur-md border-[#2AABEE] shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      {activeTab === "general" ? "Posizione Generale" : "Gioca per scalare la classifica!"}
                    </p>
                    {activeTab === "general" && (
                      <p className="text-xl font-bold text-white">
                        #{leaderboardData.userRank.rank} / {leaderboardData.userRank.totalPlayers}
                      </p>
                    )}
                  </div>
                  <Button
                    className="bg-[#2AABEE] hover:bg-[#2AABEE]/80"
                    onClick={() => {
                      hapticFeedback("medium")
                      router.push("/themes")
                    }}
                  >
                    Gioca
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
