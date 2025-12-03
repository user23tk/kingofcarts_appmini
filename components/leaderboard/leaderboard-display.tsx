"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trophy, Medal, Award, RefreshCw, Flame } from "lucide-react"
import type { LeaderboardEntry } from "@/lib/leaderboard/leaderboard-manager"

interface EventLeaderboardEntry {
  rank: number
  user_id: string
  first_name: string
  total_pp: number // Changed from total_event_pp to total_pp to match API response
  chapters_completed?: number
  last_updated: string
}

interface ActiveEvent {
  theme_key: string
  event_name: string
  event_emoji: string
  event_end_date: string
  pp_multiplier: number
}

export function LeaderboardDisplay() {
  const [players, setPlayers] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const [activeTab, setActiveTab] = useState<"general" | "event">("general")
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null)
  const [eventPlayers, setEventPlayers] = useState<EventLeaderboardEntry[]>([])
  const [eventLoading, setEventLoading] = useState(false)

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)

      const playersResponse = await fetch(`/api/miniapp/leaderboard?_ts=${Date.now()}`)

      if (!playersResponse.ok) {
        const playersError = await playersResponse.text()
        throw new Error(`Failed to fetch leaderboard data: ${playersError}`)
      }

      const playersData = await playersResponse.json()
      setPlayers(playersData.rankings || [])
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const fetchEventLeaderboard = async () => {
    try {
      setEventLoading(true)

      const eventResponse = await fetch(`/api/leaderboard/event?_ts=${Date.now()}`)

      if (!eventResponse.ok) {
        setActiveEvent(null)
        setEventPlayers([])
        return
      }

      const eventData = await eventResponse.json()

      if (eventData.activeEvent) {
        setActiveEvent(eventData.activeEvent)
        setEventPlayers(eventData.players || [])
      } else {
        setActiveEvent(null)
        setEventPlayers([])
      }
    } catch (err) {
      setActiveEvent(null)
      setEventPlayers([])
    } finally {
      setEventLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
    fetchEventLeaderboard()
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
    }
  }

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Ora"
    if (diffInHours < 24) return `${diffInHours}h fa`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}g fa`
    return date.toLocaleDateString("it-IT")
  }

  const formatEventEndDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Trophy className="h-5 w-5" />
              Caricamento Classifica...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-white/20 rounded-full"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-white/20 rounded w-1/3"></div>
                    <div className="h-3 bg-white/20 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="bg-red-500/20 border-red-500/30 backdrop-blur-sm">
        <AlertDescription className="text-white">
          Errore nel caricamento della classifica: {error}
          <Button
            onClick={fetchLeaderboard}
            variant="outline"
            size="sm"
            className="ml-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Riprova
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {activeEvent && (
        <div className="flex gap-2 justify-center">
          <Button
            onClick={() => setActiveTab("general")}
            variant={activeTab === "general" ? "default" : "outline"}
            className={
              activeTab === "general"
                ? "bg-white/20 text-white border-white/30"
                : "bg-white/10 text-white/70 border-white/20 hover:bg-white/15 hover:text-white"
            }
          >
            <Trophy className="h-4 w-4 mr-2" />
            Classifica Generale
          </Button>
          <Button
            onClick={() => setActiveTab("event")}
            variant={activeTab === "event" ? "default" : "outline"}
            className={
              activeTab === "event"
                ? "bg-white/20 text-white border-white/30"
                : "bg-white/10 text-white/70 border-white/20 hover:bg-white/15 hover:text-white"
            }
          >
            <Flame className="h-4 w-4 mr-2" />
            {activeEvent.event_emoji} Contest
          </Button>
        </div>
      )}

      {activeTab === "general" ? (
        <>
          {/* General Leaderboard */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <Trophy className="h-5 w-5" />
                Top Viaggiatori
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/70">Aggiornato: {lastUpdated.toLocaleTimeString("it-IT")}</span>
                <Button
                  onClick={fetchLeaderboard}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {players.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-white/50" />
                  <p className="text-white/70">Nessun giocatore trovato. Sii il primo a completare una storia!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {players.map((player) => (
                    <div
                      key={player.userId}
                      className={`flex items-center space-x-4 p-4 rounded-lg border transition-all duration-200 ${player.rank <= 3
                        ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30 shadow-lg"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                    >
                      <div className="flex-shrink-0">{getRankIcon(player.rank)}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate text-white">{player.firstName}</h3>
                        </div>

                        <div className="flex flex-wrap gap-2 text-sm">
                          <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30">
                            📚 {player.chaptersCompleted} capitoli
                          </Badge>
                          <Badge className="bg-yellow-500/20 text-yellow-200 border-yellow-500/30">
                            ⭐ {player.totalScore} punti
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right text-sm text-white/60">{formatLastActive(player.lastActive || new Date().toISOString())}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4">
              <div className="text-sm text-white/80 space-y-2">
                <p>
                  <strong className="text-white">Come funziona il punteggio:</strong>
                </p>
                <p>• Completa i capitoli per guadagnare PP (Power Points)</p>
                <p>• Le tue scelte influenzano i PP guadagnati</p>
                <p className="mt-4">
                  <strong className="text-white">Vuoi partecipare?</strong> Inizia il tuo viaggio con King of Carts su
                  Telegram!
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6">
              <div className="text-center space-y-3">
                <div className="text-6xl mb-2">{activeEvent?.event_emoji}</div>
                <h1 className="text-4xl font-bold text-white uppercase tracking-wide">
                  Contest {activeEvent?.event_name}
                </h1>
                <div className="flex items-center justify-center gap-4 text-white/90">
                  <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-400" />
                    <span className="text-lg font-semibold">Moltiplicatore: {activeEvent?.pp_multiplier}x PP</span>
                  </div>
                </div>
                <p className="text-white/70 text-sm">
                  Termina il: <strong>{activeEvent && formatEventEndDate(activeEvent.event_end_date)}</strong>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <Trophy className="h-5 w-5" />
                Classifica Contest
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={fetchEventLeaderboard}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {eventLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-white/20 rounded-full"></div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-white/20 rounded w-1/3"></div>
                        <div className="h-3 bg-white/20 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : eventPlayers.length === 0 ? (
                <div className="text-center py-8">
                  <Flame className="h-12 w-12 mx-auto mb-4 text-orange-400/50" />
                  <p className="text-white/70">Nessun partecipante ancora. Sii il primo a partecipare al contest!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {eventPlayers.map((player) => (
                    <div
                      key={player.user_id}
                      className={`flex items-center space-x-4 p-4 rounded-lg border transition-all duration-200 ${player.rank <= 3
                        ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30 shadow-lg"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                    >
                      <div className="flex-shrink-0">{getRankIcon(player.rank)}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate text-white">{player.first_name}</h3>
                          {player.rank <= 3 && (
                            <Badge className="bg-yellow-500/30 text-yellow-100 border-yellow-500/50 text-xs">
                              TOP {player.rank}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-sm">
                          <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30">
                            📚 {player.chapters_completed || 0}{" "}
                            {player.chapters_completed === 1 ? "capitolo" : "capitoli"}
                          </Badge>
                          <Badge className="bg-yellow-500/20 text-yellow-200 border-yellow-500/30 font-bold text-base">
                            ⭐ {player.total_pp || 0} PP
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right text-sm text-white/60">{formatLastActive(player.last_updated)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event Instructions */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4">
              <div className="text-sm text-white/80 space-y-2">
                <p>
                  <strong className="text-white">Come funziona il Contest:</strong>
                </p>
                <p>• Completa i capitoli del tema contest per guadagnare PP</p>
                <p>• I PP sono moltiplicati per {activeEvent?.pp_multiplier}x durante l'evento</p>
                <p>• La classifica è separata da quella generale</p>
                <p>• Il contest termina il {activeEvent && formatEventEndDate(activeEvent.event_end_date)}</p>
                <p className="mt-4">
                  <strong className="text-white">Partecipa ora!</strong> Seleziona il tema contest su Telegram!
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
