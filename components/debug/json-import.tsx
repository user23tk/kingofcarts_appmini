"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { validateChapterStructure, type Chapter } from "@/lib/schemas/chapter-schema"
import { Upload, CheckCircle, XCircle, AlertTriangle, FileText } from "lucide-react"

interface ImportResult {
  success: boolean
  chapter?: Chapter
  error?: string
  message?: string
}

export function JsonImport() {
  const [jsonInput, setJsonInput] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [progress, setProgress] = useState(0)

  const handleImport = async () => {
    if (!jsonInput.trim()) return

    setIsImporting(true)
    setResults([])
    setProgress(0)

    try {
      // Parse JSON input - può essere un singolo capitolo o array di capitoli
      let chapters: any[]
      try {
        const parsed = JSON.parse(jsonInput)
        chapters = Array.isArray(parsed) ? parsed : [parsed]
      } catch (error) {
        setResults([{ success: false, error: "JSON non valido" }])
        setIsImporting(false)
        return
      }

      const importResults: ImportResult[] = []

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        setProgress(((i + 1) / chapters.length) * 50) // Prima metà per validazione

        try {
          // Validazione con schema esistente
          const validatedChapter = validateChapterStructure(chapter)

          // Salvataggio nel database
          const response = await fetch("/api/chapters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              theme: validatedChapter.id.split("_")[0] || "imported", // Estrae tema dall'ID
              chapterNumber: Number.parseInt(validatedChapter.id.split("_")[1]) || i + 1, // Estrae numero o usa indice
              content: validatedChapter, // Il capitolo completo va in content
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "Errore nel salvataggio")
          }

          const result = await response.json()

          importResults.push({
            success: true,
            chapter: validatedChapter,
            message: result.isUpdate ? "Capitolo aggiornato" : "Capitolo creato",
          })
        } catch (error) {
          importResults.push({
            success: false,
            error: error instanceof Error ? error.message : "Errore sconosciuto",
          })
        }

        setProgress(((i + 1) / chapters.length) * 100) // Seconda metà per salvataggio
      }

      setResults(importResults)
    } catch (error) {
      setResults([
        {
          success: false,
          error: error instanceof Error ? error.message : "Errore durante l'import",
        },
      ])
    } finally {
      setIsImporting(false)
      setProgress(0)
    }
  }

  const successCount = results.filter((r) => r.success).length
  const errorCount = results.filter((r) => !r.success).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Capitoli JSON
          </CardTitle>
          <CardDescription>
            Importa uno o più capitoli in formato JSON. Puoi inserire un singolo capitolo o un array di capitoli.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">JSON Capitoli</label>
            <Textarea
              placeholder={`Inserisci JSON capitolo/i qui...

Esempio singolo capitolo:
{
  "id": "tema_capitolo1",
  "title": "Il Primo Capitolo",
  "scenes": [...],
  "finale": {...}
}

Esempio array capitoli:
[
  { "id": "tema_cap1", ... },
  { "id": "tema_cap2", ... }
]`}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              disabled={isImporting}
            />
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importazione in corso...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <Button onClick={handleImport} disabled={!jsonInput.trim() || isImporting} className="w-full">
            {isImporting ? "Importazione..." : "Importa Capitoli"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Risultati Import
            </CardTitle>
            <div className="flex gap-2">
              {successCount > 0 && (
                <Badge variant="default" className="bg-green-500">
                  {successCount} Successi
                </Badge>
              )}
              {errorCount > 0 && <Badge variant="destructive">{errorCount} Errori</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((result, index) => (
              <Alert
                key={index}
                className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}
              >
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertTitle className={result.success ? "text-green-800" : "text-red-800"}>
                  {result.success ? result.message || "Capitolo Importato" : "Errore Import"}
                </AlertTitle>
                <AlertDescription className={result.success ? "text-green-700" : "text-red-700"}>
                  {result.success ? (
                    <>
                      <strong>{result.chapter?.title}</strong> (ID: {result.chapter?.id})
                      <br />
                      {result.chapter?.scenes.length} scene + finale
                    </>
                  ) : (
                    result.error
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Formato Richiesto</AlertTitle>
        <AlertDescription>
          I capitoli devono rispettare la struttura rigida: 8 scene (0-7), scene pari solo testo, scene dispari con 2
          scelte A/B, pp_delta tra 3-6. La validazione è automatica.
        </AlertDescription>
      </Alert>
    </div>
  )
}
