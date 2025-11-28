"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Gift,
  Trophy,
  Users,
  Ticket,
  RefreshCw,
  Loader2,
  Crown,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Plus,
} from "lucide-react"

interface GiveawayStats {
  giveaway_id: string
  name: string
  is_active: boolean
  starts_at: string
  ends_at: string
  unique_participants: number
  total_entries: number
  first_ticket: number | null
  last_ticket: number | null
  avg_tickets_per_user: number | null
}

interface Winner {
  user_id: string
  telegram_id: string
  username: string | null
  first_name: string | null
  last_name: string | null
  ticket_number: number
}

interface DrawResult {
  success: boolean
  winner?: Winner
  giveaway_id: string
  giveaway_name: string
  total_entries: number
  drawn_at: string
  error?: string
}

interface Giveaway {
  id: string
  name: string
  description: string | null
  is_active: boolean
  starts_at: string
  ends_at: string
  pp_per_ticket: number
  prize_title: string | null
  prize_type: string | null
}

export function GiveawayManager() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [selectedGiveaway, setSelectedGiveaway] = useState<string | null>(null)
  const [stats, setStats] = useState<GiveawayStats | null>(null)
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New giveaway form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newGiveaway, setNewGiveaway] = useState({
    name: "",
    description: "",
    pp_per_ticket: 100,
    prize_title: "",
    prize_description: "",
    ends_at: "",
  })

  const getAuthHeader = useCallback(() => {
    const token = sessionStorage.getItem("debug_auth_token")
    return token ? { "x-debug-key": token } : {}
  }, [])

  const fetchGiveaways = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/debug/giveaway/list", {
        headers: getAuthHeader(),
      })
      if (!response.ok) throw new Error("Failed to fetch giveaways")
      const data = await response.json()
      setGiveaways(data.giveaways || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  const fetchStats = useCallback(
    async (giveawayId: string) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/debug/giveaway/stats?giveaway_id=${giveawayId}`, {
          headers: getAuthHeader(),
        })
        if (!response.ok) throw new Error("Failed to fetch stats")
        const data = await response.json()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    },
    [getAuthHeader],
  )

  const handleDraw = async () => {
    if (!selectedGiveaway) return

    const confirmed = confirm("Sei sicuro di voler estrarre il vincitore? Questa azione non può essere annullata.")
    if (!confirmed) return

    setDrawing(true)
    setError(null)
    setDrawResult(null)

    try {
      const response = await fetch("/api/debug/giveaway/draw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ giveaway_id: selectedGiveaway }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Draw failed")
      }

      setDrawResult(data)
      // Refresh giveaway list after draw
      await fetchGiveaways()
      await fetchStats(selectedGiveaway)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed")
    } finally {
      setDrawing(false)
    }
  }

  const createGiveaway = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/debug/giveaway/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(newGiveaway),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create giveaway")
      }

      setShowCreateForm(false)
      setNewGiveaway({
        name: "",
        description: "",
        pp_per_ticket: 100,
        prize_title: "",
        prize_description: "",
        ends_at: "",
      })
      await fetchGiveaways()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGiveaways()
  }, [fetchGiveaways])

  useEffect(() => {
    if (selectedGiveaway) {
      fetchStats(selectedGiveaway)
    }
  }, [selectedGiveaway, fetchStats])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const isExpired = (endDate: string) => new Date(endDate) < new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" />
            Giveaway Manager
          </h2>
          <p className="text-muted-foreground">Gestisci giveaway ed estrai vincitori</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchGiveaways} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Giveaway
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Crea Nuovo Giveaway</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Giveaway</Label>
                <Input
                  value={newGiveaway.name}
                  onChange={(e) => setNewGiveaway({ ...newGiveaway, name: e.target.value })}
                  placeholder="Contest Natale 2024"
                />
              </div>
              <div className="space-y-2">
                <Label>PP per Ticket</Label>
                <Input
                  type="number"
                  value={newGiveaway.pp_per_ticket}
                  onChange={(e) =>
                    setNewGiveaway({ ...newGiveaway, pp_per_ticket: Number.parseInt(e.target.value) || 100 })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea
                value={newGiveaway.description}
                onChange={(e) => setNewGiveaway({ ...newGiveaway, description: e.target.value })}
                placeholder="Descrizione del giveaway..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titolo Premio</Label>
                <Input
                  value={newGiveaway.prize_title}
                  onChange={(e) => setNewGiveaway({ ...newGiveaway, prize_title: e.target.value })}
                  placeholder="Gift Telegram Premium"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fine</Label>
                <Input
                  type="datetime-local"
                  value={newGiveaway.ends_at}
                  onChange={(e) => setNewGiveaway({ ...newGiveaway, ends_at: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Annulla
              </Button>
              <Button onClick={createGiveaway} disabled={!newGiveaway.name || !newGiveaway.ends_at}>
                Crea Giveaway
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Giveaway List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {giveaways.map((giveaway) => (
          <Card
            key={giveaway.id}
            className={`cursor-pointer transition-all ${
              selectedGiveaway === giveaway.id ? "ring-2 ring-primary" : "hover:border-primary/50"
            } ${!giveaway.is_active ? "opacity-60" : ""}`}
            onClick={() => setSelectedGiveaway(giveaway.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{giveaway.name}</CardTitle>
                <Badge variant={giveaway.is_active ? "default" : "secondary"}>
                  {giveaway.is_active ? "Attivo" : "Chiuso"}
                </Badge>
              </div>
              {giveaway.prize_title && (
                <CardDescription className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {giveaway.prize_title}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  {giveaway.pp_per_ticket} PP/ticket
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {isExpired(giveaway.ends_at) ? "Scaduto" : "Attivo"}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 inline mr-1" />
                Fine: {formatDate(giveaway.ends_at)}
              </div>
            </CardContent>
          </Card>
        ))}

        {giveaways.length === 0 && !loading && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun giveaway trovato</p>
              <Button variant="link" className="mt-2" onClick={() => setShowCreateForm(true)}>
                Crea il primo giveaway
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats Panel */}
      {selectedGiveaway && stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Statistiche: {stats.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">{stats.unique_participants}</div>
                <div className="text-sm text-muted-foreground">Partecipanti Unici</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Ticket className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">{stats.total_entries}</div>
                <div className="text-sm text-muted-foreground">Ticket Totali</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-2">TICKET RANGE</div>
                <div className="text-xl font-bold">
                  {stats.first_ticket ? `#${stats.first_ticket} - #${stats.last_ticket}` : "-"}
                </div>
                <div className="text-sm text-muted-foreground">Primo - Ultimo</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-2">MEDIA</div>
                <div className="text-2xl font-bold">{stats.avg_tickets_per_user?.toFixed(1) || "-"}</div>
                <div className="text-sm text-muted-foreground">Ticket/Utente</div>
              </div>
            </div>

            {/* Draw Button */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Estrazione Vincitore</h4>
                  <p className="text-sm text-muted-foreground">
                    Estrae casualmente un ticket tra i {stats.total_entries} partecipanti
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleDraw}
                  disabled={drawing || !stats.is_active || stats.total_entries === 0}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  {drawing ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Crown className="h-5 w-5 mr-2" />}
                  {drawing ? "Estrazione..." : "Estrai Vincitore"}
                </Button>
              </div>

              {!stats.is_active && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Questo giveaway non è più attivo. Il vincitore potrebbe essere già stato estratto.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Winner Result */}
      {drawResult?.success && drawResult.winner && (
        <Card className="border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 mb-4">
                <Crown className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Vincitore Estratto!</h3>
              <div className="text-4xl font-bold text-primary mb-2">
                @{drawResult.winner.username || drawResult.winner.first_name || "Unknown"}
              </div>
              <div className="flex items-center justify-center gap-4 text-muted-foreground">
                <Badge variant="outline" className="text-lg py-1 px-3">
                  <Ticket className="h-4 w-4 mr-2" />
                  Ticket #{drawResult.winner.ticket_number}
                </Badge>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Giveaway: {drawResult.giveaway_name}</p>
                <p>Ticket totali: {drawResult.total_entries}</p>
                <p>Estratto il: {formatDate(drawResult.drawn_at)}</p>
              </div>
              <div className="mt-4 flex items-center justify-center text-green-500">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Estrazione completata con successo
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
