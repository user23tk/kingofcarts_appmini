"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, Download, Database, FileText, CheckCircle, XCircle, Trophy } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validateChapterStructure } from "@/lib/schemas/chapter-schema"
import { Switch } from "@/components/ui/switch"
import { useDebugAuth } from "@/components/debug/debug-auth"

const AVAILABLE_THEMES = ["fantasy", "sci-fi", "mystery", "romance", "adventure", "horror", "comedy"]

interface EventTheme {
  id: string
  name: string
  title: string
  event_emoji: string
  pp_multiplier: number
  is_active: boolean
}

export function StoryGenerator() {
  const [selectedTheme, setSelectedTheme] = useState<string>("")
  const [chapterNumber, setChapterNumber] = useState<string>("")
  const [generatedContent, setGeneratedContent] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string>("")
  const [saveLocation, setSaveLocation] = useState<"json" | "database">("json")
  const [validationStatus, setValidationStatus] = useState<"valid" | "invalid" | "pending" | null>(null)
  const [validationError, setValidationError] = useState<string>("")

  const { token } = useDebugAuth()

  const [isEventMode, setIsEventMode] = useState(false)
  const [eventThemes, setEventThemes] = useState<EventTheme[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventTheme | null>(null)

  useEffect(() => {
    if (isEventMode) {
      fetchEventThemes()
    }
  }, [isEventMode])

  const fetchEventThemes = async () => {
    setLoadingEvents(true)
    try {
      const response = await fetch("/api/debug/events")
      if (response.ok) {
        const data = await response.json()
        setEventThemes(data.events || [])
      }
    } catch (err) {
      console.error("Failed to fetch event themes:", err)
      setError("Impossibile caricare gli eventi dal database")
    } finally {
      setLoadingEvents(false)
    }
  }

  const handleEventSelect = (eventId: string) => {
    const event = eventThemes.find((e) => e.id === eventId)
    if (event) {
      setSelectedEvent(event)
      setSelectedTheme(event.name)
    }
  }

  const validateContent = (content: string) => {
    try {
      const parsed = JSON.parse(content)
      validateChapterStructure(parsed)
      setValidationStatus("valid")
      setValidationError("")
      return true
    } catch (err) {
      setValidationStatus("invalid")
      setValidationError(err instanceof Error ? err.message : "Errore di validazione")
      return false
    }
  }

  const handleGenerate = async () => {
    if (!selectedTheme) {
      setError("Seleziona un tema per generare il capitolo")
      return
    }

    if (!token) {
      setError("Autenticazione richiesta. Effettua il login come admin.")
      return
    }

    setIsGenerating(true)
    setError("")
    setGeneratedContent("")
    setValidationStatus("pending")
    setValidationError("")

    try {
      const existingChaptersResponse = await fetch(`/api/chapters?theme=${selectedTheme}`)
      const existingChaptersData = existingChaptersResponse.ok
        ? await existingChaptersResponse.json()
        : { chapters: [] }
      const existingChapters = existingChaptersData.chapters || []

      console.log("[v0] Existing chapters:", existingChapters)

      const generationContext = {
        theme: selectedTheme,
        chapterNumber: chapterNumber ? Number.parseInt(chapterNumber) : undefined,
        existingChapters: Array.isArray(existingChapters) ? existingChapters.slice(0, 5) : [],
        isEvent: isEventMode,
        eventMultiplier: selectedEvent?.pp_multiplier || 1.0,
        eventEmoji: selectedEvent?.event_emoji || "",
      }

      const response = await fetch("/api/generate-chapter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(generationContext),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Non autorizzato. Effettua nuovamente il login.")
        }
        throw new Error("Errore nella generazione del capitolo")
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullResponse += chunk
          setGeneratedContent(fullResponse)
        }
      }

      if (fullResponse.trim()) {
        validateContent(fullResponse)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto")
      setValidationStatus(null)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!generatedContent) return

    // Valida prima di salvare
    if (!validateContent(generatedContent)) {
      setError("Impossibile salvare: il contenuto non è valido")
      return
    }

    try {
      const chapterData = JSON.parse(generatedContent)

      if (saveLocation === "database") {
        setIsGenerating(true)
        setError("")

        const response = await fetch("/api/chapters", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            theme: selectedTheme,
            chapterNumber: chapterNumber ? Number.parseInt(chapterNumber) : 1,
            content: chapterData,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Errore nel salvataggio")
        }

        alert(
          `✅ Capitolo salvato con successo nel database!\n\nTema: ${selectedTheme}\nCapitolo: ${chapterNumber}\nTitolo: ${result.chapter.title}${isEventMode ? `\n🎉 Evento: ${selectedEvent?.title} (${selectedEvent?.pp_multiplier}x PP)` : ""}`,
        )

        // Reset form dopo salvataggio riuscito
        setGeneratedContent("")
        setValidationStatus(null)
        setSelectedTheme("")
        setChapterNumber("")
        setSelectedEvent(null)
      } else {
        const blob = new Blob([JSON.stringify(chapterData, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${selectedTheme}_chapter_${chapterNumber || "new"}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError(`Errore nel salvataggio: ${err instanceof Error ? err.message : "Errore sconosciuto"}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleValidate = () => {
    if (generatedContent.trim()) {
      validateContent(generatedContent)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generatore Capitoli AI (Struttura Rigida)
          </CardTitle>
          <CardDescription>
            Genera capitoli con struttura rigida: 8 scene (0-7), scelte solo in 1/3/5/7, validazione Zod integrata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/5">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              <div>
                <Label htmlFor="event-mode" className="font-semibold">
                  Modalità Evento Contest
                </Label>
                <p className="text-sm text-muted-foreground">
                  Genera capitoli per eventi temporanei con moltiplicatore PP
                </p>
              </div>
            </div>
            <Switch id="event-mode" checked={isEventMode} onCheckedChange={setIsEventMode} />
          </div>

          {isEventMode && (
            <Card className="border-accent">
              <CardHeader>
                <CardTitle className="text-sm">Seleziona Evento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingEvents ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Caricamento eventi...
                  </div>
                ) : eventThemes.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Nessun evento disponibile. Crea un evento nella tab "Events" prima di generare capitoli.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Select value={selectedEvent?.id || ""} onValueChange={handleEventSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un evento" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventThemes.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            <div className="flex items-center gap-2">
                              <span>{event.event_emoji}</span>
                              <span>{event.title}</span>
                              <Badge variant={event.is_active ? "default" : "secondary"} className="ml-2">
                                {event.pp_multiplier}x PP
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedEvent && (
                      <div className="p-3 bg-accent/10 rounded-lg space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{selectedEvent.event_emoji}</span>
                          <span className="font-semibold">{selectedEvent.title}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Tema: <code className="bg-muted px-1 rounded">{selectedEvent.name}</code>
                        </div>
                        <div className="text-sm">
                          Moltiplicatore PP: <Badge variant="default">{selectedEvent.pp_multiplier}x</Badge>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {!isEventMode && (
            <div className="space-y-2">
              <Label htmlFor="theme-select">Tema</Label>
              <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                <SelectTrigger id="theme-select">
                  <SelectValue placeholder="Seleziona un tema" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_THEMES.map((theme) => (
                    <SelectItem key={theme} value={theme}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{theme}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="chapter-number">Numero Capitolo</Label>
            <Input
              id="chapter-number"
              type="number"
              placeholder="es. 1, 2, 3..."
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Destinazione Salvataggio</Label>
            <div className="flex gap-2">
              <Button
                variant={saveLocation === "json" ? "default" : "outline"}
                size="sm"
                onClick={() => setSaveLocation("json")}
              >
                <FileText className="h-4 w-4 mr-2" />
                File JSON
              </Button>
              <Button
                variant={saveLocation === "database" ? "default" : "outline"}
                size="sm"
                onClick={() => setSaveLocation("database")}
              >
                <Database className="h-4 w-4 mr-2" />
                Database Supabase
              </Button>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating || !selectedTheme} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Genera Capitolo{" "}
                {isEventMode && selectedEvent && `(${selectedEvent.event_emoji} ${selectedEvent.pp_multiplier}x PP)`}
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                Capitolo Generato
                {validationStatus === "valid" && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Valido
                  </Badge>
                )}
                {validationStatus === "invalid" && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Non Valido
                  </Badge>
                )}
                {validationStatus === "pending" && (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Validazione...
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleValidate} size="sm" variant="outline">
                  Valida
                </Button>
                <Button onClick={handleSave} size="sm" disabled={validationStatus !== "valid"}>
                  <Download className="h-4 w-4 mr-2" />
                  Salva
                </Button>
              </div>
            </CardTitle>
            {validationError && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent>
            <Textarea
              value={generatedContent}
              onChange={(e) => {
                setGeneratedContent(e.target.value)
                setValidationStatus(null) // Reset validazione quando si modifica
              }}
              className="min-h-[400px] font-mono text-sm"
              placeholder="Il capitolo generato apparirà qui..."
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Struttura Rigida Richiesta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>8 scene indicizzate 0-7:</strong>
          </p>
          <p>• Scene 0, 2, 4, 6: Solo testo narrativo (intermezzi)</p>
          <p>• Scene 1, 3, 5, 7: Testo + 2 scelte (A/B) con pp_delta ∈ {(3, 4, 5, 6)}</p>
          <p>• Goto logic: scene 1/3/5 → scena successiva, scena 7 → goto: -1</p>
          <p>• Finale con testo + nextChapter</p>
          <p>• Validazione Zod automatica per garantire la struttura corretta</p>
        </CardContent>
      </Card>
    </div>
  )
}
