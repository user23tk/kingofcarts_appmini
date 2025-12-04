"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { debugFetch } from "@/lib/debug/auth-helper"
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
  Link,
  ImageIcon,
  Upload,
  Trash2,
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
  prize_link: string | null
  prize_image_url: string | null
}

export function GiveawayManager() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [selectedGiveaway, setSelectedGiveaway] = useState<string | null>(null)
  const [stats, setStats] = useState<GiveawayStats | null>(null)
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New giveaway form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newGiveaway, setNewGiveaway] = useState({
    name: "",
    description: "",
    pp_per_ticket: 100,
    prize_title: "",
    prize_description: "",
    prize_link: "",
    prize_image_url: "",
    ends_at: "",
  })

  const fetchGiveaways = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await debugFetch("/api/debug/giveaway/list")
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch giveaways")
      }
      const data = await response.json()
      setGiveaways(data.giveaways || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async (giveawayId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await debugFetch(`/api/debug/giveaway/stats?giveaway_id=${giveawayId}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch stats")
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDraw = async () => {
    if (!selectedGiveaway) return

    const confirmed = confirm("Sei sicuro di voler estrarre il vincitore? Questa azione non può essere annullata.")
    if (!confirmed) return

    setDrawing(true)
    setError(null)
    setDrawResult(null)

    try {
      const response = await debugFetch("/api/debug/giveaway/draw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await debugFetch("/api/debug/upload", {
        method: "POST",
        headers: {
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to upload image")
      }

      // Use the public URL from Supabase Storage
      setNewGiveaway({ ...newGiveaway, prize_image_url: data.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  const createGiveaway = async () => {
    if (!newGiveaway.name.trim()) {
      setError("Il nome del giveaway è obbligatorio")
      return
    }
    if (!newGiveaway.prize_title.trim()) {
      setError("Il titolo del premio è obbligatorio")
      return
    }
    if (!newGiveaway.ends_at) {
      setError("La data di fine è obbligatoria")
      return
    }

    setLoading(true)
    setError(null)
    try {
      console.log("[v0] Creating giveaway with data:", newGiveaway)

      const response = await debugFetch("/api/debug/giveaway/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newGiveaway.name.trim(),
          description: newGiveaway.description.trim() || null,
          pp_per_ticket: newGiveaway.pp_per_ticket || 100,
          prize_title: newGiveaway.prize_title.trim(),
          prize_description: newGiveaway.prize_description.trim() || null,
          prize_link: newGiveaway.prize_link.trim() || null,
          prize_image_url: newGiveaway.prize_image_url || null,
          ends_at: newGiveaway.ends_at,
        }),
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
        prize_link: "",
        prize_image_url: "",
        ends_at: "",
      })
      await fetchGiveaways()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const deleteGiveaway = useCallback(
    async (giveawayId: string) => {
      if (!confirm("Sei sicuro di voler eliminare questo giveaway? Questa azione non può essere annullata.")) {
        return
      }

      setDeleting(giveawayId)
      setError(null)

      try {
        const response = await debugFetch(`/api/debug/giveaway/delete?id=${giveawayId}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to delete giveaway")
        }

        // Remove from local state
        setGiveaways((prev) => prev.filter((g) => g.id !== giveawayId))

        // Clear selection if deleted giveaway was selected
        if (selectedGiveaway === giveawayId) {
          setSelectedGiveaway(null)
          setStats(null)
          setDrawResult(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete giveaway")
      } finally {
        setDeleting(null)
      }
    },
    [selectedGiveaway],
  )

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

      {/* Create Form - Added prize_link and prize_image_url fields */}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Link Premio (opzionale)
                </Label>
                <Input
                  type="url"
                  value={newGiveaway.prize_link}
                  onChange={(e) => setNewGiveaway({ ...newGiveaway, prize_link: e.target.value })}
                  placeholder="https://t.me/..."
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Immagine Premio
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={newGiveaway.prize_image_url}
                    onChange={(e) => setNewGiveaway({ ...newGiveaway, prize_image_url: e.target.value })}
                    placeholder="URL immagine o carica..."
                    className="flex-1"
                  />
                  <Label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <Button type="button" variant="outline" size="icon" disabled={uploading} asChild>
                      <span>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </span>
                    </Button>
                  </Label>
                </div>
                {newGiveaway.prize_image_url && (
                  <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border">
                    <img
                      src={newGiveaway.prize_image_url || "/placeholder.svg"}
                      alt="Prize preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Annulla
              </Button>
              <Button onClick={createGiveaway} disabled={!newGiveaway.name || !newGiveaway.ends_at || loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
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
                <div className="flex items-center gap-2">
                  <Badge variant={giveaway.is_active ? "default" : "secondary"}>
                    {giveaway.is_active ? "Attivo" : "Chiuso"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteGiveaway(giveaway.id)
                    }}
                    disabled={deleting === giveaway.id}
                  >
                    {deleting === giveaway.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {giveaway.prize_title && (
                <CardDescription className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {giveaway.prize_title}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {giveaway.prize_image_url && (
                <div className="mb-3 w-full h-24 rounded-md overflow-hidden">
                  <img
                    src={giveaway.prize_image_url || "/placeholder.svg"}
                    alt={giveaway.prize_title || "Prize"}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
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
              {giveaway.prize_link && (
                <div className="mt-2">
                  <a
                    href={giveaway.prize_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link className="h-3 w-3" />
                    Link premio
                  </a>
                </div>
              )}
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
