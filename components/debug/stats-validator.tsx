"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, XCircle, AlertTriangle, Play, Wrench } from "lucide-react"

interface ValidationResult {
  isValid: boolean
  issues: Array<{
    type: string
    severity: "error" | "warning"
    description: string
    affectedCount: number
  }>
  summary: {
    totalUsers: number
    usersWithIssues: number
    totalIssues: number
  }
}

export function StatsValidator() {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [repairing, setRepairing] = useState(false)

  const handleValidate = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/debug/validate-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate" }),
      })

      if (response.ok) {
        const data = await response.json()
        setValidationResult(data)
      } else {
        alert("Errore durante la validazione")
      }
    } catch (error) {
      console.error("Validation error:", error)
      alert("Errore di connessione")
    } finally {
      setLoading(false)
    }
  }

  const handleRepair = async () => {
    if (!confirm("Sei sicuro di voler riparare le inconsistenze trovate? Questa operazione modificherà i dati.")) {
      return
    }

    setRepairing(true)
    try {
      const response = await fetch("/api/debug/validate-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repair" }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(
          `Riparazione completata!\n\nUtenti aggiornati: ${data.repaired.usersFixed}\nStatistiche globali aggiornate: ${data.repaired.globalStatsFixed ? "Sì" : "No"}`,
        )
        // Re-validate after repair
        handleValidate()
      } else {
        alert("Errore durante la riparazione")
      }
    } catch (error) {
      console.error("Repair error:", error)
      alert("Errore di connessione")
    } finally {
      setRepairing(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-accent" />
            Validazione Consistenza Statistiche
          </CardTitle>
          <CardDescription>
            Verifica l'integrità dei dati e rileva inconsistenze tra statistiche utente, progressi temi e contatori
            globali
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handleValidate} disabled={loading || repairing} className="flex-1">
              <Play className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Validazione in corso..." : "Avvia Validazione"}
            </Button>
            {validationResult && !validationResult.isValid && (
              <Button onClick={handleRepair} disabled={loading || repairing} variant="destructive" className="flex-1">
                <Wrench className={`h-4 w-4 mr-2 ${repairing ? "animate-spin" : ""}`} />
                {repairing ? "Riparazione in corso..." : "Ripara Inconsistenze"}
              </Button>
            )}
          </div>

          {validationResult && (
            <>
              <Separator />

              {/* Summary Alert */}
              <Alert
                className={
                  validationResult.isValid
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-destructive/20 bg-destructive/5"
                }
              >
                {validationResult.isValid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <AlertTitle className="font-semibold">
                  {validationResult.isValid ? "✅ Tutti i Dati Sono Consistenti" : "⚠️ Inconsistenze Rilevate"}
                </AlertTitle>
                <AlertDescription>
                  {validationResult.isValid ? (
                    <span>Nessun problema trovato. Le statistiche sono accurate e sincronizzate.</span>
                  ) : (
                    <div className="space-y-1 mt-2">
                      <div>
                        Utenti totali: <strong>{validationResult.summary.totalUsers}</strong>
                      </div>
                      <div>
                        Utenti con problemi: <strong>{validationResult.summary.usersWithIssues}</strong>
                      </div>
                      <div>
                        Problemi totali: <strong>{validationResult.summary.totalIssues}</strong>
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              {/* Issues List */}
              {!validationResult.isValid && validationResult.issues.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Problemi Rilevati:</h3>
                  {validationResult.issues.map((issue, index) => (
                    <Card key={index} className="border-l-4 border-l-destructive">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          {issue.severity === "error" ? (
                            <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={issue.severity === "error" ? "destructive" : "secondary"}>
                                {issue.type}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {issue.affectedCount} utenti interessati
                              </span>
                            </div>
                            <p className="text-sm">{issue.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-accent/20 bg-accent/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-accent" />
            Cosa Viene Verificato
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <div>
            • <strong>Temi Completati:</strong> Verifica che l'array completed_themes corrisponda ai temi con flag
            completed=true
          </div>
          <div>
            • <strong>Conteggio Capitoli:</strong> Controlla che i capitoli completati siano calcolati correttamente da
            theme_progress
          </div>
          <div>
            • <strong>Statistiche Globali:</strong> Valida che i contatori globali riflettano la somma dei progressi
            individuali
          </div>
          <div>
            • <strong>Integrità PP:</strong> Verifica che i PP totali siano consistenti con i progressi dei temi
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
