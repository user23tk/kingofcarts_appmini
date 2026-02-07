"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Trophy, Zap, AlertCircle, CheckCircle2, Plus, Trash2, Gift } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { debugFetch } from "@/lib/debug/auth-helper"

interface EventContest {
  id: string
  name: string
  title: string
  description: string
  event_emoji: string
  pp_multiplier: number
  event_start_date: string
  event_end_date: string | null
  is_active: boolean
  created_at: string
}

export function EventContestManager() {
  const [events, setEvents] = useState<EventContest[]>([])
  const [activeEvent, setActiveEvent] = useState<EventContest | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [adminKey, setAdminKey] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    event_emoji: "🎃",
    pp_multiplier: 1.5,
    event_end_date: "",
    is_active: false,
  })

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const response = await debugFetch("/api/debug/events")
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
        setActiveEvent(data.activeEvent || null)
      }
    } catch (error) {
      console.error("Failed to fetch events:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async () => {
    if (!adminKey) {
      setMessage({ type: "error", text: "Admin key richiesta" })
      return
    }

    if (!formData.name || !formData.title) {
      setMessage({ type: "error", text: "Nome e titolo sono obbligatori" })
      return
    }

    if (formData.pp_multiplier < 1 || formData.pp_multiplier > 5) {
      setMessage({ type: "error", text: "Il moltiplicatore PP deve essere tra 1 e 5" })
      return
    }

    setCreating(true)
    setMessage(null)

    try {
      const response = await debugFetch("/api/debug/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, ...formData }),
      })

      if (response.ok) {
        setMessage({ type: "success", text: "Evento creato con successo!" })
        setFormData({
          name: "",
          title: "",
          description: "",
          event_emoji: "🎃",
          pp_multiplier: 1.5,
          event_end_date: "",
          is_active: false,
        })
        fetchEvents()
      } else {
        const error = await response.json()
        setMessage({ type: "error", text: error.error || "Errore nella creazione dell'evento" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Errore di connessione" })
    } finally {
      setCreating(false)
    }
  }

  const handleToggleEvent = async (eventId: string, isActive: boolean) => {
    if (!adminKey) {
      setMessage({ type: "error", text: "Admin key richiesta per modificare eventi" })
      return
    }

    try {
      const response = await debugFetch("/api/debug/events/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, eventId, isActive }),
      })

      if (response.ok) {
        setMessage({ type: "success", text: `Evento ${isActive ? "attivato" : "disattivato"} con successo!` })
        fetchEvents()
      } else {
        const error = await response.json()
        setMessage({ type: "error", text: error.error || "Errore nell'aggiornamento dell'evento" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Errore di connessione" })
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!adminKey) {
      setMessage({ type: "error", text: "Admin key richiesta per eliminare eventi" })
      return
    }

    if (!confirm("Sei sicuro di voler eliminare questo evento? I dati della classifica rimarranno salvati.")) {
      return
    }

    try {
      const response = await debugFetch("/api/debug/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, eventId }),
      })

      if (response.ok) {
        setMessage({ type: "success", text: "Evento eliminato con successo!" })
        fetchEvents()
      } else {
        const error = await response.json()
        setMessage({ type: "error", text: error.error || "Errore nell'eliminazione dell'evento" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Errore di connessione" })
    }
  }

  const handleCreateGiveaway = async (eventId: string) => {
    if (!adminKey) {
      setMessage({ type: "error", text: "Admin key richiesta" })
      return
    }

    const prizeTitle = prompt("Inserisci il titolo del premio per il giveaway (es: 1000 Stars):")
    if (!prizeTitle) return

    try {
      const response = await debugFetch("/api/debug/events/create-giveaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminKey,
          theme_id: eventId,
          prize_title: prizeTitle,
          top_n: 10 // Default
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessage({ type: "success", text: `Giveaway creato con successo! (${data.entries_created} partecipanti)` })
      } else {
        const error = await response.json()
        setMessage({ type: "error", text: error.error || "Errore nella creazione del giveaway" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Errore di connessione" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Admin Key Input */}
      <Card>
        <CardHeader>
          <CardTitle>Autenticazione Admin</CardTitle>
          <CardDescription>Inserisci la chiave admin per gestire gli eventi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="adminKey">Admin Key</Label>
            <Input
              id="adminKey"
              type="password"
              placeholder="Inserisci admin key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Active Event Status */}
      {activeEvent && (
        <Card className="border-accent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-accent" />
                <CardTitle>Evento Attivo</CardTitle>
              </div>
              <Badge variant="default" className="bg-accent">
                LIVE
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeEvent.event_emoji}</span>
                <span className="font-bold text-lg">{activeEvent.title}</span>
              </div>
              <p className="text-sm text-muted-foreground">{activeEvent.description}</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4 text-accent" />
                  <span>Moltiplicatore: {activeEvent.pp_multiplier}x</span>
                </div>
                {activeEvent.event_end_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Fine: {new Date(activeEvent.event_end_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create New Event */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Crea Nuovo Evento Contest
          </CardTitle>
          <CardDescription>Configura un evento temporaneo con classifica separata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Tema (es: halloween)</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase() })}
                placeholder="halloween"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emoji">Emoji</Label>
              <Input
                id="emoji"
                value={formData.event_emoji}
                onChange={(e) => setFormData({ ...formData, event_emoji: e.target.value })}
                placeholder="🎃"
                maxLength={2}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titolo Evento</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Halloween Contest 2025"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Un evento speciale per Halloween con storie spaventose..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="multiplier">Moltiplicatore PP (1-5)</Label>
              <Input
                id="multiplier"
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={formData.pp_multiplier}
                onChange={(e) => setFormData({ ...formData, pp_multiplier: Number.parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Data Fine (opzionale)</Label>
              <Input
                id="end_date"
                type="datetime-local"
                value={formData.event_end_date}
                onChange={(e) => setFormData({ ...formData, event_end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="active">Attiva immediatamente</Label>
            </div>
            <Button onClick={handleCreateEvent} disabled={creating}>
              {creating ? "Creazione..." : "Crea Evento"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Eventi Esistenti</CardTitle>
          <CardDescription>Gestisci tutti gli eventi contest</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse h-20 bg-muted rounded" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nessun evento creato</div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{event.event_emoji}</span>
                    <div>
                      <div className="font-semibold">{event.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.name} • {event.pp_multiplier}x PP
                        {event.event_end_date && ` • Fine: ${new Date(event.event_end_date).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleCreateGiveaway(event.id)} title="Crea Giveaway da questo evento">
                      <Gift className="h-4 w-4" />
                    </Button>
                    <Badge variant={event.is_active ? "default" : "secondary"}>
                      {event.is_active ? "Attivo" : "Disattivato"}
                    </Badge>
                    <Switch
                      checked={event.is_active}
                      onCheckedChange={(checked) => handleToggleEvent(event.id, checked)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEvent(event.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
