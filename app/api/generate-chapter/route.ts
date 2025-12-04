import { streamText } from "ai"
import { xai } from "@ai-sdk/xai"
import type { NextRequest } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth" // Import requireDebugAuth

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDebugAuth(request)
    if (!auth.authorized) {
      return auth.response!
    }

    const { theme, chapterNumber, existingChapters, isEvent, eventMultiplier, eventEmoji } = await request.json()

    if (!theme) {
      return new Response("Theme is required", { status: 400 })
    }

    const systemPrompt = `Sei un creatore di storie interattive per il bot Telegram "King of Carts". 
Devi generare un nuovo capitolo per il tema "${theme}" seguendo ESATTAMENTE questa struttura:

STRUTTURA RIGIDA OBBLIGATORIA:
- 8 scene indicizzate 0-7
- Scene 0, 2, 4, 6: SOLO testo narrativo (intermezzi senza scelte)
- Scene 1, 3, 5, 7: testo + 2 scelte (A/B) con pp_delta ∈ {3,4,5,6}
- Goto logic: scene 1/3/5 → scena successiva (2/4/6), scena 7 → goto: -1
- Finale con testo + nextChapter

REGOLE SCELTE:
- Ogni scelta deve avere pp_delta tra 3-6 (SOLO valori positivi: 3, 4, 5, o 6)
- Scene 1, 3, 5: goto deve puntare alla scena successiva (2, 4, 6)
- Scena 7: goto deve essere -1 (indica finale)

STILE:
- Usa emoji e formattazione HTML <b>, <i>
- Mantieni il tono psichedelico, positivo, filosofico del King of Carts
- Usa i placeholder {{KING}}, {{PLAYER}}, {{TOTAL_PP}}
- Testi coinvolgenti e immersivi

Genera SOLO il JSON del capitolo, senza spiegazioni.`

    const userPrompt = `Genera un nuovo capitolo per il tema "${theme}" (numero ${chapterNumber || "auto"}).

ESEMPIO STRUTTURA (DA RISPETTARE ESATTAMENTE):
{
  "id": "${theme}_${chapterNumber || "1"}",
  "title": "Titolo Accattivante",
  "scenes": [
    { "index": 0, "text": "🎭 <b>{{KING}}</b> ti accoglie... (INTRO - solo testo)" },
    { "index": 1, "text": "Prima scena con scelta...", "choices": [
      { "id": "A", "label": "🗡️ Prima opzione", "pp_delta": 5, "goto": 2 },
      { "id": "B", "label": "🎵 Seconda opzione", "pp_delta": 3, "goto": 2 }
    ]},
    { "index": 2, "text": "Intermezzo narrativo... (solo testo)" },
    { "index": 3, "text": "Seconda scena con scelta...", "choices": [
      { "id": "A", "label": "💎 Terza opzione", "pp_delta": 4, "goto": 4 },
      { "id": "B", "label": "🤝 Quarta opzione", "pp_delta": 6, "goto": 4 }
    ]},
    { "index": 4, "text": "Altro intermezzo... (solo testo)" },
    { "index": 5, "text": "Terza scena con scelta...", "choices": [
      { "id": "A", "label": "🌀 Quinta opzione", "pp_delta": 3, "goto": 6 },
      { "id": "B", "label": "🛡️ Sesta opzione", "pp_delta": 4, "goto": 6 }
    ]},
    { "index": 6, "text": "Penultimo intermezzo... (solo testo)" },
    { "index": 7, "text": "Scena finale con scelta...", "choices": [
      { "id": "A", "label": "🔥 Scelta finale A", "pp_delta": 6, "goto": -1 },
      { "id": "B", "label": "🌈 Scelta finale B", "pp_delta": 5, "goto": -1 }
    ]}
  ],
  "finale": {
    "text": "🏆 «Magnifico, {{PLAYER}}!» sorride <b>{{KING}}</b>. PP totali: {{TOTAL_PP}}.",
    "nextChapter": "${theme}_${Number.parseInt(chapterNumber || "1") + 1}"
  }
}

GENERA IL CAPITOLO SEGUENDO ESATTAMENTE QUESTA STRUTTURA.`

    const result = streamText({
      model: xai("grok-4", {
        apiKey: process.env.XAI_API_KEY,
      }),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7, // Ridotta temperatura per maggiore consistenza
      maxTokens: 3000, // Aumentati token per contenere 8 scene
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error("Error generating chapter:", error)
    return new Response("Failed to generate chapter", { status: 500 })
  }
}
