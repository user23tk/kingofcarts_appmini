"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Menu, Check, AlertTriangle, Info } from "lucide-react"

const AVAILABLE_COMMANDS = [
  { command: "start", description: "🎭 Inizia l'avventura con King of Carts" },
  { command: "help", description: "📖 Mostra i comandi disponibili" },
  { command: "stats", description: "📊 Visualizza le tue statistiche" },
  { command: "continue", description: "▶️ Continua la storia corrente" },
  { command: "reset", description: "🔄 Ricomincia il tema attuale" },
  { command: "leaderboard", description: "🏆 Visualizza la classifica globale" },
]

export function MenuCommandsConfig() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastConfigured, setLastConfigured] = useState<Date | null>(null)

  const configureCommands = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch("/api/debug/configure-inline-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to configure commands")
      }

      const result = await response.json()
      console.log("[v0] Menu commands configured:", result)

      setSuccess(true)
      setLastConfigured(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Menu className="h-5 w-5" />
          Menu Comandi Telegram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Comandi Disponibili:</h4>
          <div className="grid gap-2">
            {AVAILABLE_COMMANDS.map((cmd) => (
              <div key={cmd.command} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">/{cmd.command}</Badge>
                  <span className="text-sm">{cmd.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {success && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>
              Comandi del menu configurati con successo! Gli utenti vedranno ora tutti i comandi disponibili nel menu
              Telegram.
              {lastConfigured && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Configurato: {lastConfigured.toLocaleString("it-IT")}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Errore nella configurazione: {error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            I comandi del menu appaiono quando gli utenti digitano "/" nella chat con il bot. Questa configurazione è
            permanente fino alla prossima modifica.
          </AlertDescription>
        </Alert>

        <Button onClick={configureCommands} disabled={loading} className="w-full">
          {loading ? "Configurazione in corso..." : "Configura Menu Comandi"}
        </Button>
      </CardContent>
    </Card>
  )
}
